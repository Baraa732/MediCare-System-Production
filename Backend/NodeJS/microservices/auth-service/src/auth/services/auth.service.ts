import {
  Injectable, BadRequestException, UnauthorizedException,
  Inject, Logger, OnModuleInit, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ClientKafka, EventPattern, Payload } from '@nestjs/microservices';
import * as crypto from 'crypto';
import { Otp, OtpType } from '../entities/otp.entity';
import {
  RegisterDto, SendOtpDto, VerifyOtpDto, LoginDto,
  RefreshTokenDto, LogoutDto, RevokeSessionDto, ActivateClinicAdminDto,
  CreateUserByAdminDto, ResetPasswordDto,
} from '../dto/auth.dto';
import { WhatsAppService } from './whatsapp.service';
import { SessionService } from './session.service';
import { AuditLogService } from './audit-log.service';
import { RateLimitService } from './rate-limit.service';
import { AccountLockService } from './account-lock.service';
import { SessionAnomalyService } from './session-anomaly.service';
import { JwtBlocklistService } from './jwt-blocklist.service';
import { TrustedDeviceService } from './trusted-device.service';
import { PhoneUtils } from '../../common/utils/phone.utils';
import { mapUserServiceHttpError } from '../../common/utils/user-service-error.util';
import { AuditAction, AuditResource } from '../entities/audit-log.entity';
import { RateLimitType } from '../entities/rate-limit.entity';
import { UserHttpClient, AuthUserProfile } from './user-http.client';
import { ClinicHttpClient } from './clinic-http.client';
import {
  AuthIdentityFields,
  AuthSessionResponse,
  AuthTokenRefreshResponse,
  toAuthIdentity,
} from '../types/auth-response.types';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { withOptionalTenantEvent } from '../../tenant-shared/tenant-kafka';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

const LOGIN_MFA_ROLES = new Set(['CLINIC_ADMIN', 'DOCTOR', 'SECRETARY', 'PATIENT']);

export interface OtpDeliveryResponse {
  message: string;
  whatsappSent: boolean;
  whatsappHint?: string;
  devOtp?: string;
  userId?: string;
  role?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Otp, 'authConnection')
    private otpRepository: Repository<Otp>,
    private jwtService: JwtService,
    private whatsappService: WhatsAppService,
    private sessionService: SessionService,
    private auditLogService: AuditLogService,
    private rateLimitService: RateLimitService,
    private accountLockService: AccountLockService,
    private sessionAnomalyService: SessionAnomalyService,
    private jwtBlocklistService: JwtBlocklistService,
    private trustedDeviceService: TrustedDeviceService,
    private userHttp: UserHttpClient,
    private clinicHttp: ClinicHttpClient,
    private tenantContext: TenantContextService,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
    @InjectDataSource('authConnection')
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
    this.logger.log('Auth service Kafka client connected (events only)');
  }

  // HIGH FIX: Revoke all sessions when password changes
  @EventPattern('user.password.changed')
  async handlePasswordChanged(@Payload() event: unknown): Promise<void> {
    const logger = createTenantLogger(`${AuthService.name}.kafka`, this.tenantContext);
    await withOptionalTenantEvent(
      event,
      'user.password.changed',
      this.tenantContext,
      logger,
      async (data) => {
        const { userId, phoneNumber } = data as { userId: string; phoneNumber?: string };
        try {
          await Promise.all([
            this.sessionService.revokeAllUserSessions(userId),
            this.trustedDeviceService.revokeByUserId(userId),
          ]);
          logger.log(
            `All sessions and trusted devices revoked for user ${PhoneUtils.maskPhoneNumber(phoneNumber ?? userId)} after password change`,
          );
        } catch (error: any) {
          logger.error(
            `Failed to revoke sessions for user ${PhoneUtils.maskPhoneNumber(phoneNumber ?? userId)} after password change: ${error.message}`,
          );
        }
      },
    );
  }

  private usesLoginMfa(role: string): boolean {
    return LOGIN_MFA_ROLES.has(role);
  }

  private async checkUserExists(phoneNumber: string): Promise<boolean> {
    return this.userHttp.checkExists(phoneNumber);
  }

  private async invalidateGatewayAuthCache(params: { sessionId?: string; userId?: string }): Promise<void> {
    const { sessionId, userId } = params;
    if (!sessionId && !userId) return;

    const gatewayUrl = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';
    const signingSecret = process.env.INTERNAL_AUTH_SECRET;
    if (!signingSecret) return;

    const axios = require('axios');
    const { createInternalAuthHeadersForUrl } = require('../../internal-auth-shared/internal-http.signer');
    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const path = '/internal/cache/auth/invalidate';
        const body = { sessionId, userId };
        await axios.post(`${gatewayUrl}${path}`, body, {
          timeout: 3000,
          headers: createInternalAuthHeadersForUrl(
            'auth-service',
            signingSecret,
            'POST',
            path,
            body,
          ),
        });
        return;
      } catch (error: any) {
        lastError = error;
        if (attempt < maxAttempts) {
          const backoffMs = 100 * (2 ** (attempt - 1)); // 100ms, 200ms
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Cache invalidation should not block auth revocation paths.
    this.logger.warn(
      `Gateway auth cache invalidation failed (sessionId=${sessionId || 'n/a'}, userId=${userId || 'n/a'}): ${lastError?.message}`,
    );
  }

  // ─── Register ────────────────────────────────────────────────────────────────
  // Uses request-reply (.send) to confirm user was created before saving OTP.
  // Previously used fire-and-forget (.emit) which caused OTP to be sent before
  // user existed — leading to "Phone number not registered" on verify.
  async register(registerDto: RegisterDto, createdBy?: string): Promise<OtpDeliveryResponse> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(registerDto.phoneNumber);
    const {
      firstName, lastName, email, password, role, clinicId, specialization, licenseNumber,
      middleName, nationalId, motherName, motherLastName, gender, birthDate, birthPlace,
      maritalStatus, healthStatus, yearsOfExperience, governorate, state, streetInfo,
    } = registerDto;

    // CLINIC_ADMIN must have an activated code before registering
    if (role === 'CLINIC_ADMIN') {
      const systemManagerUrl = process.env.SYSTEM_MANAGER_SERVICE_URL || 'http://system-manager-service:3003';
      const signingSecret = process.env.INTERNAL_AUTH_SECRET;
      if (!signingSecret) throw new Error('INTERNAL_AUTH_SECRET env var is not set');
      try {
        const axios = require('axios');
        const { createInternalAuthHeadersForUrl } = require('../../internal-auth-shared/internal-http.signer');
        const path = '/v1/system-manager/activation-code/check-activated';
        const res = await axios.get(
          `${systemManagerUrl}${path}`,
          {
            params: { phoneNumber: formattedPhoneNumber },
            timeout: 5000,
            headers: createInternalAuthHeadersForUrl(
              'auth-service',
              signingSecret,
              'GET',
              path,
            ),
          },
        );
        if (!res.data?.activated) {
          throw new BadRequestException('You must activate your dashboard code before registering.');
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        const msg = error.response?.data?.message;
        if (msg) throw new BadRequestException(msg);
        throw new BadRequestException('Could not verify activation status. Please try again.');
      }

      const userExists = await this.checkUserExists(formattedPhoneNumber);
      if (userExists) {
        throw new BadRequestException({
          code: 'PHONE_ALREADY_REGISTERED',
          message: 'This phone number is already registered.',
          field: 'phoneNumber',
          suggestion: 'Sign in with your password to access your clinic dashboard.',
        });
      }
    } else {
      const userExists = await this.checkUserExists(formattedPhoneNumber);
      if (userExists) {
        throw new BadRequestException({
          code: 'PHONE_ALREADY_REGISTERED',
          message: 'This phone number is already registered.',
          field: 'phoneNumber',
          suggestion: 'Sign in with your password or call POST /api/auth/send-otp for a new verification code.',
        });
      }
    }

    let createResponse: { success: boolean; userId?: string };
    try {
      createResponse = await this.userHttp.createUser({
        phoneNumber: formattedPhoneNumber,
        firstName, lastName, email, password, role,
        clinicId, specialization, licenseNumber, createdBy,
        middleName, nationalId, motherName, motherLastName, gender, birthDate, birthPlace,
        maritalStatus, healthStatus, yearsOfExperience, governorate, state, streetInfo,
      });
    } catch (error: any) {
      mapUserServiceHttpError(error);
    }

    if (!createResponse?.success) {
      throw new BadRequestException('Registration failed. Please try again.');
    }

    // User confirmed created — now safe to save OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Hash OTP before storing - never store plaintext OTPs in database
    await this.otpRepository.save({
      codeHash: Otp.hashCode(otp, formattedPhoneNumber, OtpType.PHONE_VERIFICATION),
      phoneNumber: formattedPhoneNumber,
      type: OtpType.PHONE_VERIFICATION,
      expiresAt,
    });

    this.deliverOtpWhatsAppInBackground(
      formattedPhoneNumber,
      otp,
      'Your MediCare verification code is: {otp}. Valid for 10 minutes. Do not share this code.',
    );

    this.logger.log(`Registration OTP saved: ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)} (${role})`);
    const response: OtpDeliveryResponse = {
      message:
        'Registration initiated. Please verify your phone number with the OTP sent to WhatsApp.',
      whatsappSent: false,
      userId: createResponse.userId,
      role,
      whatsappHint:
        'If the code does not arrive, ask your administrator to check the WhatsApp connection.',
    };
    if (process.env.NODE_ENV === 'development') {
      response.devOtp = otp;
    }
    return response;
  }

  /** Sends OTP via WhatsApp; never throws — caller decides response shape. */
  private deliverOtpWhatsApp(
    phoneNumber: string,
    otp: string,
    template: string,
  ): Promise<{ sent: boolean; hint?: string }> {
    const brand = process.env.WHATSAPP_PROFILE_NAME?.trim() || 'MediCare';
    const body = template.replace('{otp}', otp);
    const message = body.startsWith(brand) ? body : `*${brand}*\n${body}`;
    return this.deliverWhatsAppMessage(phoneNumber, message);
  }

  /**
   * Waits briefly for WhatsApp delivery so login/MFA responses can report whether the
   * code actually left the server. OTP is already persisted; this only affects status.
   */
  private async deliverOtpWhatsAppWithTimeout(
    phoneNumber: string,
    otp: string,
    template: string,
    timeoutMs = Number(process.env.WHATSAPP_OTP_DELIVERY_TIMEOUT_MS || 15_000),
  ): Promise<{ sent: boolean; hint?: string }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.deliverOtpWhatsApp(phoneNumber, otp, template),
        new Promise<{ sent: false; hint: string }>((resolve) => {
          timer = setTimeout(
            () =>
              resolve({
                sent: false,
                hint: 'WhatsApp delivery timed out. Try resend or ask your administrator to check the WhatsApp connection.',
              }),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Fire-and-forget OTP delivery for non-blocking flows (e.g. staff welcome message). */
  private deliverOtpWhatsAppInBackground(
    phoneNumber: string,
    otp: string,
    template: string,
  ): void {
    void this.deliverOtpWhatsApp(phoneNumber, otp, template).then((result) => {
      const masked = PhoneUtils.maskPhoneNumber(phoneNumber);
      if (result.sent) {
        this.logger.log(`OTP delivered via WhatsApp to ${masked}`);
        return;
      }
      this.logger.warn(`OTP WhatsApp delivery failed for ${masked}: ${result.hint ?? 'unknown'}`);
    });
  }

  private async deliverWhatsAppMessage(
    phoneNumber: string,
    message: string,
  ): Promise<{ sent: boolean; hint?: string }> {
    if (PhoneUtils.isDevSeedPhone(phoneNumber)) {
      this.logger.log(`Skipping WhatsApp for dev seed phone ${PhoneUtils.maskPhoneNumber(phoneNumber)}`);
      return {
        sent: false,
        hint: 'Dev seed phone — use devOtp from the API response (WhatsApp not sent).',
      };
    }

    const instanceName = process.env.WHATSAPP_INSTANCE_NAME || 'clinic-management';
    try {
      await this.whatsappService.sendMessage(instanceName, phoneNumber, message);
      return { sent: true };
    } catch (error: any) {
      this.logger.error(`WhatsApp failed for ${PhoneUtils.maskPhoneNumber(phoneNumber)}: ${error.message}`);
      const hint =
        process.env.NODE_ENV === 'development'
          ? 'Connect WhatsApp: GET /api/auth/dev/whatsapp-qr then scan QR. Dev OTP: GET /api/auth/dev/latest-otp?phoneNumber=YOUR_PHONE'
          : 'Contact administrator to connect WhatsApp delivery.';
      return { sent: false, hint };
    }
  }

  async createUserByAdmin(
    createUserDto: CreateUserByAdminDto,
    _adminId: string,
  ): Promise<{
    message: string;
    whatsappSent: boolean;
    whatsappHint?: string;
    userId?: string;
    role: string;
    activationExpiresAt?: string;
    status?: string;
    devTemporaryPassword?: string;
  }> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(createUserDto.phoneNumber);
    let clinicId = createUserDto.clinicId;
    if (!clinicId) {
      const adminClinic = await this.clinicHttp.resolveStaffClinic(_adminId);
      clinicId = adminClinic.clinicId;
    }
    if (!clinicId) {
      throw new BadRequestException(
        'Could not determine which clinic this staff member belongs to. Please contact support.',
      );
    }

    const clinicExists = await this.clinicHttp.clinicExists(clinicId);
    if (!clinicExists) {
      throw new BadRequestException(
        'Your clinic is not fully set up yet. Please contact your clinic administrator or support.',
      );
    }

    const payload = { ...createUserDto, phoneNumber: formattedPhoneNumber, clinicId };

    let response: {
      success: boolean;
      message?: string;
      userId?: string;
      temporaryPassword?: string;
      activationExpiresAt?: string;
      status?: string;
      membershipOnly?: boolean;
    };

    try {
      response = await this.userHttp.createUserByAdmin(payload);
    } catch (error: any) {
      mapUserServiceHttpError(error);
    }

    if (!response?.success || !response.userId) {
      throw new BadRequestException(response?.message || 'User creation failed');
    }

    if (response.userId && clinicId) {
      const staffRole = createUserDto.role === 'DOCTOR' ? 'DOCTOR' : 'SECRETARY';
      const assignResult = await this.clinicHttp.assignStaffInternal({
        clinicId,
        userId: response.userId,
        staffRole,
        assignedBy: _adminId,
      });
      if (!assignResult.assigned) {
        this.logger.error(
          `Staff assignment failed for ${response.userId} at clinic ${clinicId}: ${assignResult.reason ?? 'unknown'}`,
        );
        throw new BadRequestException(
          'Staff account was created but could not be linked to your clinic. Please try again.',
        );
      }
    }

    if (response.membershipOnly) {
      return {
        message: 'Staff member has been added to your clinic.',
        whatsappSent: false,
        userId: response.userId,
        role: createUserDto.role,
        status: response.status,
      };
    }

    if (!response.temporaryPassword) {
      throw new BadRequestException(response?.message || 'User creation failed');
    }

    const tempPassword = response.temporaryPassword;
    const welcomeTemplate = [
      'Welcome to MediCare',
      '',
      `Phone: ${formattedPhoneNumber}`,
      '',
      'Temporary Password:',
      '{otp}',
      '',
      'Please login within 48 hours.',
    ].join('\n');

    // Do not block the HTTP response on WhatsApp — Evolution can poll up to 90s while reconnecting.
    void this.deliverOtpWhatsApp(formattedPhoneNumber, tempPassword, welcomeTemplate).then(
      (whatsappResult) => {
        if (whatsappResult.sent) {
          this.logger.log(
            `Staff credentials sent via WhatsApp to ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)}`,
          );
          return;
        }
        this.logger.warn(
          `Staff credentials WhatsApp not delivered for ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)}: ${whatsappResult.hint ?? 'unknown'}`,
        );
      },
    );

    const result = {
      message:
        'Staff account created. Login credentials are being sent via WhatsApp — share manually if needed.',
      whatsappSent: false,
      userId: response.userId,
      role: createUserDto.role,
      activationExpiresAt: response.activationExpiresAt,
      status: response.status || 'PENDING_ACTIVATION',
      whatsappHint:
        process.env.NODE_ENV === 'development'
          ? 'WhatsApp sends in the background. Use devTemporaryPassword from the response if delivery fails.'
          : 'If WhatsApp is not connected, share the temporary password with the staff member directly.',
    };

    if (process.env.NODE_ENV === 'development') {
      return { ...result, devTemporaryPassword: tempPassword };
    }
    return result;
  }

  async sendOtp(sendOtpDto: SendOtpDto, type: OtpType = OtpType.PHONE_VERIFICATION): Promise<OtpDeliveryResponse> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(sendOtpDto.phoneNumber);

    const rateLimitCheck = await this.rateLimitService.checkRateLimit(formattedPhoneNumber, RateLimitType.OTP);
    if (!rateLimitCheck.allowed) {
      throw new BadRequestException(`Too many OTP requests. Please try again in ${rateLimitCheck.retryAfter} seconds.`);
    }

    const userExists = await this.checkUserExists(formattedPhoneNumber);
    if (!userExists) throw new BadRequestException('Phone number not registered');

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate all previous OTPs for this phone+type to prevent OTP reuse
    await this.otpRepository
      .createQueryBuilder()
      .update(Otp)
      .set({ isUsed: true })
      .where('phoneNumber = :phoneNumber AND type = :type AND isUsed = false', { 
        phoneNumber: formattedPhoneNumber, 
        type 
      })
      .execute();

    // Hash OTP before storing - never store plaintext OTPs in database
    await this.otpRepository.save({ 
      codeHash: Otp.hashCode(otp, formattedPhoneNumber, type),
      phoneNumber: formattedPhoneNumber, 
      type, 
      expiresAt 
    });

    const templates: Record<OtpType, string> = {
      [OtpType.PHONE_VERIFICATION]: 'Your MediCare verification code is: {otp}. Valid for 10 minutes. Do not share this code.',
      [OtpType.PASSWORD_RESET]: 'Your MediCare password reset code is: {otp}. Valid for 10 minutes. Do not share this code.',
      [OtpType.LOGIN_VERIFICATION]: 'Your MediCare login code is: {otp}. Valid for 10 minutes. Do not share this code.',
    };

    const whatsappResult = await this.deliverOtpWhatsAppWithTimeout(
      formattedPhoneNumber,
      otp,
      templates[type],
    );
    this.logger.log(`OTP saved for ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)} (${type})`);

    const response: OtpDeliveryResponse = {
      message: whatsappResult.sent
        ? 'Verification code sent to WhatsApp.'
        : 'Verification code created but WhatsApp delivery failed.',
      whatsappSent: whatsappResult.sent,
      ...(whatsappResult.hint ? { whatsappHint: whatsappResult.hint } : {}),
    };
    if (process.env.NODE_ENV === 'development') {
      response.devOtp = otp;
    }
    return response;
  }

  async verifyOtp(
    verifyOtpDto: VerifyOtpDto,
    type: OtpType = OtpType.PHONE_VERIFICATION,
    autoLogin = false,
    deviceInfo?: any,
  ): Promise<
    | AuthSessionResponse
    | (Partial<AuthIdentityFields> & {
        message: string;
        requiresPasswordChange?: boolean;
        activationToken?: string;
      })
  > {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(verifyOtpDto.phoneNumber);
    const { otp } = verifyOtpDto;

    // Add rate limiting for verifyOtp to prevent brute force
    const rateLimitCheck = await this.rateLimitService.checkRateLimit(formattedPhoneNumber, RateLimitType.OTP_VERIFY);
    if (!rateLimitCheck.allowed) {
      throw new BadRequestException(`Too many OTP verification attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`);
    }

    const userExists = await this.checkUserExists(formattedPhoneNumber);
    if (!userExists) throw new BadRequestException('Invalid or expired OTP'); // Generic error to prevent enumeration

    // Hash the submitted OTP and compare with stored hash
    const otpHash = Otp.hashCode(otp, formattedPhoneNumber, type);

    // Fix 23: Check failedAttempts BEFORE the atomic UPDATE.
    // If >= 5 failed attempts, invalidate the OTP and reject immediately.
    const otpRecord = await this.otpRepository.findOne({
      where: { phoneNumber: formattedPhoneNumber, type, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (otpRecord && otpRecord.failedAttempts >= 5) {
      // Invalidate the OTP to prevent further guesses
      await this.otpRepository.update(otpRecord.id, { isUsed: true });
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Atomic update: mark as used only if it exists, is valid, and not yet used.
    // This eliminates the race condition where two concurrent requests both read
    // isUsed=false before either writes isUsed=true.
    const updateResult = await this.otpRepository
      .createQueryBuilder()
      .update(Otp)
      .set({ isUsed: true })
      .where(
        'phoneNumber = :phone AND codeHash = :hash AND type = :type AND isUsed = false AND expiresAt > :now',
        { phone: formattedPhoneNumber, hash: otpHash, type, now: new Date() },
      )
      .execute();

    if (!updateResult.affected || updateResult.affected === 0) {
      // Fix 23: Increment failedAttempts on wrong guess
      if (otpRecord) {
        await this.otpRepository.increment({ id: otpRecord.id }, 'failedAttempts', 1);
      }
      await this.rateLimitService.recordFailedAttempt(formattedPhoneNumber, RateLimitType.OTP_VERIFY);
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (type === OtpType.PHONE_VERIFICATION) {
      await this.userHttp.verifyPhone(formattedPhoneNumber);
    }

    this.kafkaClient.emit('user.verify.otp', {
      phoneNumber: formattedPhoneNumber,
      type,
      verifiedAt: new Date().toISOString(),
    });

    this.logger.log(`OTP verified for ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)} (${type})`);

    if (autoLogin && type === OtpType.PHONE_VERIFICATION) {
      try {
        const userResponse = await this.userHttp.getUserByPhone(formattedPhoneNumber);

        if (!userResponse?.success || !userResponse.user) {
          return { message: 'Phone number verified. Please login manually.' };
        }

        const user = userResponse.user as AuthUserProfile;

        if (user.status === 'PENDING_ACTIVATION' || user.mustChangePassword) {
          const activationToken = await this.issueActivationPendingToken(user.id, formattedPhoneNumber);
          return {
            message: 'Phone verified. Set your new password to activate your account.',
            requiresPasswordChange: true,
            activationToken,
            ...toAuthIdentity(user),
          };
        }

        return this.issueFullLoginTokens(
          user,
          deviceInfo,
          undefined,
          { autoLoginAfterOtp: true },
          'Phone number verified. You are now logged in.',
        );
      } catch (error) {
        this.logger.error('Auto-login failed after OTP:', error);
        return { message: 'Phone number verified. Please login manually.' };
      }
    }

    const verifiedUserResponse = await this.userHttp.getUserByPhone(formattedPhoneNumber);
    const verifiedIdentity = verifiedUserResponse?.user
      ? toAuthIdentity(verifiedUserResponse.user as AuthUserProfile)
      : {};

    return {
      message: type === OtpType.PHONE_VERIFICATION
        ? 'Phone number verified successfully'
        : 'OTP verified successfully',
      ...verifiedIdentity,
    };
  }

  async login(
    loginDto: LoginDto,
    deviceInfo?: any,
    requestId?: string,
  ): Promise<
    | AuthSessionResponse
    | (AuthIdentityFields & {
        message: string;
        requiresMfa: boolean;
        mfaToken: string;
        requiresPasswordChange?: boolean;
        whatsappSent?: boolean;
        whatsappHint?: string;
      })
  > {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(loginDto.phoneNumber);
    const { password } = loginDto;
    const ip = deviceInfo?.ip || 'unknown';
    const devSeedLogin =
      process.env.NODE_ENV === 'development' && PhoneUtils.isDevSeedPhone(formattedPhoneNumber);
    const skipLoginRateLimits =
      devSeedLogin || process.env.NODE_ENV === 'development';

    // ── IP-level rate limit (prevents one IP hammering many accounts) ──────────
    if (!skipLoginRateLimits) {
      const ipLimit = await this.rateLimitService.checkRateLimitByIp(ip, RateLimitType.LOGIN);
      if (!ipLimit.allowed) {
        throw new BadRequestException(`Too many login attempts from this IP. Retry in ${ipLimit.retryAfter}s.`);
      }
    }

    // ── Per-phone rate limit ───────────────────────────────────────────────────
    if (!skipLoginRateLimits) {
      const phoneLimit = await this.rateLimitService.checkRateLimit(formattedPhoneNumber, RateLimitType.LOGIN);
      if (!phoneLimit.allowed) {
        throw new BadRequestException(`Too many login attempts. Please try again in ${phoneLimit.retryAfter} seconds.`);
      }
    }

    // ── Combined IP+phone block (failed attempts only — see recordCombinedFailedAttempt) ──
    if (!skipLoginRateLimits) {
      const combinedLimit = await this.rateLimitService.checkCombinedRateLimit(ip, formattedPhoneNumber);
      if (!combinedLimit.allowed) {
        throw new BadRequestException(
          `Too many failed login attempts. Please try again in ${combinedLimit.retryAfter ?? 900} seconds.`,
        );
      }
    }

    // ── Account lock check ────────────────────────────────────────────────────
    const lockStatus = await this.accountLockService.getLockStatus(formattedPhoneNumber);
    if (lockStatus.isLocked) {
      if (lockStatus.requiresAdminReview) {
        throw new UnauthorizedException('Account locked. Please contact support.');
      }
      throw new UnauthorizedException(
        `Account temporarily locked. Retry in ${lockStatus.retryAfterSeconds}s.`,
      );
    }

    const userResponse = await this.userHttp.validateLogin(
      formattedPhoneNumber,
      password,
      deviceInfo,
      requestId,
    );

    if (!userResponse?.success) {
      // Record failed attempt in both rate limiter and account lock service
      await Promise.all([
        this.rateLimitService.recordFailedAttempt(formattedPhoneNumber, RateLimitType.LOGIN),
        this.rateLimitService.recordCombinedFailedAttempt(ip, formattedPhoneNumber),
        this.accountLockService.recordFailedLogin(formattedPhoneNumber),
      ]);
      await this.auditLogService.createLog({
        action: AuditAction.FAILED_LOGIN,
        resource: AuditResource.USER,
        success: false,
        ip,
        requestId,
        device: deviceInfo?.deviceType,
        risk: 'medium',
        metadata: { userAgent: deviceInfo?.userAgent },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = userResponse.user as AuthUserProfile;

    await Promise.all([
      this.rateLimitService.resetLoginRateLimits(ip, formattedPhoneNumber),
      this.accountLockService.resetLock(formattedPhoneNumber),
    ]);

    if (user.role === 'CLINIC_ADMIN' && !user.isDashboardActivated) {
      throw new UnauthorizedException('Please activate your dashboard before logging in');
    }

    const isPendingActivation = user.status === 'PENDING_ACTIVATION' || user.mustChangePassword;
    const roleUsesLoginMfa = this.usesLoginMfa(user.role);
    const trustedDevice = roleUsesLoginMfa
      ? await this.trustedDeviceService.isTrustedDevice(user.id, deviceInfo)
      : false;
    const needsOtpStep = isPendingActivation || (roleUsesLoginMfa && !trustedDevice);

    if (needsOtpStep) {
      const otpStatus = await this.checkOtpStatus(formattedPhoneNumber, OtpType.LOGIN_VERIFICATION);
      const otpResult =
        otpStatus.hasActiveOtp && otpStatus.expiresIn && otpStatus.expiresIn > 540
          ? {
              message: 'Verification code already sent. Check WhatsApp.',
              whatsappSent: true,
            }
          : await this.sendOtp({ phoneNumber: formattedPhoneNumber }, OtpType.LOGIN_VERIFICATION);

      const mfaTtlSeconds = 900;
      const mfaJti = crypto.randomUUID();
      const mfaToken = this.jwtService.sign(
        { sub: user.id, role: user.role, type: 'mfa_pending', jti: mfaJti, phoneNumber: formattedPhoneNumber },
        { expiresIn: `${mfaTtlSeconds}s` } as any,
      );

      await this.jwtBlocklistService.storeMfaPendingSession(mfaJti, mfaTtlSeconds, {
        userId: user.id,
        phoneNumber: formattedPhoneNumber,
        type: 'mfa_pending',
      });

      const pendingActivation = user.status === 'PENDING_ACTIVATION' || user.mustChangePassword;
      if (pendingActivation || this.staffRoleHint(user.role)) {
        await this.linkStaffToClinic(user);
      }
      this.logger.log(
        `OTP step required: ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)} (${user.role}) pendingActivation=${pendingActivation}`,
      );
      return {
        message: pendingActivation
          ? 'OTP sent. Verify OTP then set your new password.'
          : 'MFA required',
        requiresMfa: true,
        mfaToken,
        whatsappSent: otpResult.whatsappSent,
        ...(otpResult.whatsappHint ? { whatsappHint: otpResult.whatsappHint } : {}),
        ...toAuthIdentity(user),
        ...(pendingActivation ? { requiresPasswordChange: true } : {}),
        ...(process.env.NODE_ENV === 'development' && otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
      };
    }

    this.kafkaClient.emit('user.login.success', {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      timestamp: new Date().toISOString(),
    });

    return this.issueFullLoginTokens(user, deviceInfo, requestId, {
      userAgent: deviceInfo?.userAgent,
      trustedDeviceBypass: roleUsesLoginMfa ? trustedDevice : undefined,
    });
  }

  async checkOtpStatus(phoneNumber: string, type: OtpType = OtpType.PHONE_VERIFICATION): Promise<{ hasActiveOtp: boolean; expiresIn?: number }> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(phoneNumber);

    const activeOtp = await this.otpRepository
      .createQueryBuilder('otp')
      .where('otp.phoneNumber = :phoneNumber', { phoneNumber: formattedPhoneNumber })
      .andWhere('otp.type = :type', { type })
      .andWhere('otp.isUsed = :isUsed', { isUsed: false })
      .andWhere('otp.expiresAt > :now', { now: new Date() })
      .orderBy('otp.createdAt', 'DESC')
      .getOne();

    if (!activeOtp) return { hasActiveOtp: false };

    const expiresIn = Math.max(0, Math.floor((activeOtp.expiresAt.getTime() - Date.now()) / 1000));
    return { hasActiveOtp: true, expiresIn: expiresIn > 0 ? expiresIn : undefined };
  }

  async resendOtp(sendOtpDto: SendOtpDto, type: OtpType = OtpType.PHONE_VERIFICATION): Promise<OtpDeliveryResponse> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(sendOtpDto.phoneNumber);
    const otpStatus = await this.checkOtpStatus(formattedPhoneNumber, type);

    // OTP TTL is 10 minutes — allow resend after ~60 seconds (anti-spam).
    if (otpStatus.hasActiveOtp && otpStatus.expiresIn && otpStatus.expiresIn > 540) {
      const waitSeconds = otpStatus.expiresIn - 540;
      throw new BadRequestException(
        `Please wait ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before requesting a new OTP`,
      );
    }

    return this.sendOtp(sendOtpDto, type);
  }

  /**
   * Resend login/MFA OTP during the post-login verification step.
   * Requires the mfa_pending token returned by POST /auth/login.
   */
  async resendMfaOtp(mfaToken: string): Promise<OtpDeliveryResponse> {
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (payload.type !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid MFA token type');
    }

    const metadata = await this.jwtBlocklistService.getMfaPendingSession(payload.jti);
    if (!metadata?.phoneNumber || metadata.type !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    return this.resendOtp(
      { phoneNumber: metadata.phoneNumber },
      OtpType.LOGIN_VERIFICATION,
    );
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
    clientIp?: string,
    requestId?: string,
  ): Promise<AuthTokenRefreshResponse> {
    const { refreshToken } = refreshTokenDto;
    const refreshTokenHash = this.sessionService.hashRefreshToken(refreshToken);

    const session = await this.sessionService.getSessionByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      // Fallback bucket for invalid/unknown refresh tokens - server-derived only.
      if (clientIp) {
        const limit = await this.rateLimitService.checkRateLimit(`refresh-ip:${clientIp}`, RateLimitType.REFRESH);
        if (!limit.allowed) {
          throw new BadRequestException(`Too many token refresh attempts. Retry in ${limit.retryAfter}s.`);
        }
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Per-session refresh rate limit (trusted server-derived identifier).
    const limit = await this.rateLimitService.checkRateLimit(session.sessionId, RateLimitType.REFRESH);
    if (!limit.allowed) {
      throw new BadRequestException(`Too many token refresh attempts. Retry in ${limit.retryAfter}s.`);
    }

    if (!session.isActive()) throw new UnauthorizedException('Session expired or revoked');

    const userResponse = await this.userHttp.getUserById(session.userId);
    if (!userResponse?.success || !userResponse.user) {
      throw new UnauthorizedException('Unable to retrieve user information');
    }

    const user = userResponse.user as AuthUserProfile;
    const newRefreshToken = await this.sessionService.rotateRefreshToken(session.sessionId, refreshTokenHash);

    await this.linkStaffToClinic(user);

    const jti = crypto.randomUUID();
    const staffTenantId =
      user.role === 'PATIENT'
        ? undefined
        : ((user as AuthUserProfile & { tenantId?: string }).tenantId ?? user.clinicId);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      jti,
      role: user.role,
      sessionId: session.sessionId,
      type: 'user',
      ...(staffTenantId ? { tenantId: staffTenantId } : {}),
    });

    await this.auditLogService.createLog({
      userId: user.id,
      sessionId: session.sessionId,
      action: AuditAction.TOKEN_REFRESH,
      resource: AuditResource.TOKEN,
      success: true,
      requestId,
      risk: 'low',
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      ...toAuthIdentity(user),
    };
  }

  async logout(
    userId: string,
    logoutDto: LogoutDto,
    authenticatedJti?: string,
  ): Promise<{ message: string }> {
    const { sessionId, refreshToken, jti } = logoutDto;
    const tokenJti = authenticatedJti || jti;

    // Add JWT to blocklist to prevent reuse until natural expiry
    if (tokenJti) {
      await this.jwtBlocklistService.addToBlocklist(tokenJti); // TTL derived from JWT_EXPIRES_IN
    }

    if (sessionId) {
      await this.sessionService.revokeSession(sessionId, userId);
      await this.invalidateGatewayAuthCache({ sessionId, userId });
    } else if (refreshToken) {
      const session = await this.sessionService.revokeSessionByRefreshTokenHash(
        this.sessionService.hashRefreshToken(refreshToken),
        userId,
      );
      if (session) {
        await this.invalidateGatewayAuthCache({ sessionId: session.sessionId, userId });
      }
    } else {
      await this.sessionService.revokeAllUserSessions(userId);
      await this.trustedDeviceService.revokeByUserId(userId);
      await this.invalidateGatewayAuthCache({ userId });
    }

    await this.auditLogService.createLog({
      userId,
      action: AuditAction.LOGOUT,
      resource: AuditResource.SESSION,
      success: true,
    });

    this.logger.log(`User logged out: ${userId}`);
    return { message: 'Logout successful' };
  }

  async getUserSessions(userId: string): Promise<any[]> {
    const sessions = await this.sessionService.getUserSessions(userId);
    return sessions.map(session => ({
      sessionId: session.sessionId,
      deviceInfo: {
        userAgent: session.deviceInfo?.userAgent,
        ip: session.deviceInfo?.ip,
      },
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      isCurrent: session.isCurrent,
    }));
  }

  async revokeUserSession(userId: string, revokeDto: RevokeSessionDto): Promise<{ message: string }> {
    await this.sessionService.revokeSession(revokeDto.sessionId, userId);
    await this.invalidateGatewayAuthCache({ sessionId: revokeDto.sessionId, userId });
    await this.auditLogService.createLog({
      userId,
      sessionId: revokeDto.sessionId,
      action: AuditAction.SESSION_REVOKED,
      resource: AuditResource.SESSION,
      resourceId: revokeDto.sessionId,
      success: true,
    });
    return { message: 'Session revoked successfully' };
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<{ message: string }> {
    await this.sessionService.revokeAllUserSessions(userId, exceptSessionId);
    if (!exceptSessionId) {
      await this.trustedDeviceService.revokeByUserId(userId);
    }
    await this.invalidateGatewayAuthCache({ userId });
    await this.auditLogService.createLog({
      userId,
      action: AuditAction.SESSION_REVOKED,
      resource: AuditResource.SESSION,
      success: true,
      description: 'All sessions revoked',
    });
    return { message: 'All sessions revoked successfully' };
  }

  /**
   * Fix 12: Send WhatsApp notification when login occurs from a new device/IP.
   * Non-blocking — failure does not prevent login.
   */
  private async sendLoginNotificationIfNewDevice(user: any, newSession: any, deviceInfo: any): Promise<void> {
    try {
      const recentSessions = await this.sessionService.getUserSessions(user.id);
      const previousSession = recentSessions.find(s => s.sessionId !== newSession.sessionId);
      if (!previousSession) return; // first ever session — no notification needed

      const ipChanged = previousSession.deviceInfo?.ip !== deviceInfo?.ip;
      const uaChanged = previousSession.deviceInfo?.userAgent !== deviceInfo?.userAgent;
      if (!ipChanged && !uaChanged) return;

      const instanceName = process.env.WHATSAPP_INSTANCE_NAME || 'clinic-management';
      const time = new Date().toLocaleString('en-SA', { timeZone: 'Asia/Riyadh' });
      const device = deviceInfo?.deviceType || 'Unknown device';
      await this.whatsappService.sendMessage(
        instanceName,
        user.phoneNumber,
        `New login detected from ${device} at ${time}. If this wasn't you, contact support immediately.`,
      );
    } catch (err: any) {
      this.logger.error(`Login notification failed: ${err.message}`);
    }
  }

  /**
   * Verify MFA OTP after login returns { requiresMfa: true, mfaToken }.
   * Applies to CLINIC_ADMIN, DOCTOR, SECRETARY, and PATIENT on untrusted devices.
   */
  async verifyMfa(
    mfaToken: string,
    otp: string,
    deviceInfo?: any,
    requestId?: string,
  ): Promise<
    | AuthSessionResponse
    | (AuthIdentityFields & {
        message: string;
        requiresPasswordChange: boolean;
        activationToken: string;
      })
  > {
    // Decode and verify the mfa_pending token
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (payload.type !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid MFA token type');
    }

    const metadata = await this.jwtBlocklistService.getMfaPendingSession(payload.jti);
    if (!metadata || metadata.type !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    // Verify the OTP submitted as second factor
    const userResponse = await this.userHttp.getUserById(payload.sub);

    if (!userResponse?.success || !userResponse.user) {
      throw new UnauthorizedException('Unable to retrieve user for MFA verification');
    }

    const user = userResponse.user as AuthUserProfile;
    const phone = PhoneUtils.validateAndFormat(user.phoneNumber);

    // CRITICAL FIX: Validate that the phone number matches the MFA token
    if (metadata.phoneNumber !== phone) {
      this.logger.error(`MFA token ownership mismatch: token phone=${metadata.phoneNumber}, user phone=${phone}`);
      throw new UnauthorizedException('Invalid MFA token');
    }

    // Verify the OTP
    const otpHash = Otp.hashCode(otp, phone, OtpType.LOGIN_VERIFICATION);
    const updateResult = await this.otpRepository
      .createQueryBuilder()
      .update(Otp)
      .set({ isUsed: true })
      .where(
        'phoneNumber = :phone AND codeHash = :hash AND type = :type AND isUsed = false AND expiresAt > :now',
        { phone, hash: otpHash, type: OtpType.LOGIN_VERIFICATION, now: new Date() },
      )
      .execute();

    if (!updateResult.affected || updateResult.affected === 0) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Single-use: revoke MFA token only after successful OTP verification
    if (payload.jti) {
      await this.jwtBlocklistService.consumeMfaPendingSession(payload.jti);
    }

    if (user.status === 'PENDING_ACTIVATION' || user.mustChangePassword) {
      await this.linkStaffToClinic(user);
      const activationToken = await this.issueActivationPendingToken(user.id, phone);
      this.logger.log(`MFA verified — password change required: ${PhoneUtils.maskPhoneNumber(user.phoneNumber)}`);
      return {
        message: 'OTP verified. Set your new password to activate your account.',
        requiresPasswordChange: true,
        activationToken,
        ...toAuthIdentity(user),
      };
    }

    if (this.usesLoginMfa(user.role)) {
      await this.trustedDeviceService.trustDevice(user.id, deviceInfo);
    }

    await this.linkStaffToClinic(user);

    return this.issueFullLoginTokens(user, deviceInfo, requestId, { mfa: true });
  }

  private staffRoleHint(role: string): 'DOCTOR' | 'SECRETARY' | 'CLINIC_ADMIN' | undefined {
    if (role === 'DOCTOR') return 'DOCTOR';
    if (role === 'SECRETARY') return 'SECRETARY';
    if (role === 'CLINIC_ADMIN') return 'CLINIC_ADMIN';
    return undefined;
  }

  private async linkStaffToClinic(user: AuthUserProfile): Promise<void> {
    const staffRoleHint = this.staffRoleHint(user.role);
    if (!staffRoleHint) return;

    const resolved = await this.clinicHttp.resolveStaffClinic(user.id);
    if (resolved.clinicId) {
      user.clinicId = resolved.clinicId;
      (user as AuthUserProfile & { tenantId?: string }).tenantId = resolved.clinicId;
    }
  }

  private async issueActivationPendingToken(userId: string, phoneNumber: string): Promise<string> {
    const activationJti = crypto.randomUUID();
    const activationToken = this.jwtService.sign(
      { sub: userId, type: 'activation_pending', jti: activationJti, phoneNumber },
      { expiresIn: '30m' } as any,
    );
    await this.jwtBlocklistService.addToBlocklist(activationJti, 1800, {
      userId,
      phoneNumber,
      type: 'activation_pending',
    });
    return activationToken;
  }

  private async issueFullLoginTokens(
    user: AuthUserProfile,
    deviceInfo?: any,
    requestId?: string,
    auditMeta?: Record<string, unknown>,
    message = 'Login successful',
  ): Promise<AuthSessionResponse> {
    const sessionTenantId =
      user.tenantId ??
      user.clinicId ??
      // Never persist non-UUID ambient context (e.g. Railway hostname slug).
      undefined;
    const session = await this.sessionService.createSession(
      user.id,
      deviceInfo || { userAgent: 'Unknown', ip: '127.0.0.1' },
      7,
      sessionTenantId,
    );

    this.sessionAnomalyService.analyse(user.id, session, deviceInfo || {}).catch(
      (err) => this.logger.error('Anomaly analysis failed:', err.message),
    );

    this.sendLoginNotificationIfNewDevice(user, session, deviceInfo).catch(
      (err) => this.logger.error('Login notification failed:', err.message),
    );

    await this.linkStaffToClinic(user);

    const jti = crypto.randomUUID();
    const staffTenantId =
      user.role === 'PATIENT'
        ? undefined
        : ((user as AuthUserProfile & { tenantId?: string }).tenantId ?? user.clinicId);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      jti,
      role: user.role,
      sessionId: session.sessionId,
      type: 'user',
      ...(staffTenantId ? { tenantId: staffTenantId } : {}),
    });

    const refreshToken = await this.sessionService.assignInitialRefreshToken(session.sessionId);

    return {
      message,
      accessToken,
      refreshToken,
      ...toAuthIdentity(user),
    };
  }

  async completeStaffActivation(
    activationToken: string,
    newPassword: string,
    deviceInfo?: any,
    requestId?: string,
  ): Promise<AuthSessionResponse> {
    let payload: any;
    try {
      payload = this.jwtService.verify(activationToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    if (payload.type !== 'activation_pending') {
      throw new UnauthorizedException('Invalid activation token');
    }

    const metadata = await this.jwtBlocklistService.getMetadata(payload.jti);
    if (!metadata || metadata.type !== 'activation_pending') {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    if (payload.jti) {
      await this.jwtBlocklistService.addToBlocklist(payload.jti, 1800);
    }

    const phone = PhoneUtils.validateAndFormat(metadata.phoneNumber || payload.phoneNumber);

    try {
      await this.userHttp.completeStaffActivation(payload.sub, newPassword);
    } catch (error: any) {
      const msg = error.response?.data?.message;
      if (msg) {
        throw new BadRequestException(Array.isArray(msg) ? msg[0] : msg);
      }
      throw error;
    }

    const userResponse = await this.userHttp.getUserById(payload.sub);
    if (!userResponse?.success || !userResponse.user) {
      throw new BadRequestException('Activation succeeded but login failed. Please sign in.');
    }

    const user = userResponse.user as AuthUserProfile;
    await this.clinicHttp.activatePendingMemberships(user.id);
    await this.linkStaffToClinic(user);
    await this.trustedDeviceService.trustDevice(user.id, deviceInfo);
    return this.issueFullLoginTokens(user, deviceInfo, requestId, { staffActivation: true });
  }

  async devGetLatestOtp(phoneNumber: string) {
    const formatted = PhoneUtils.validateAndFormat(phoneNumber);
    const otps = await this.otpRepository.find({
      where: { phoneNumber: formatted },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return otps.length
      ? { expiresAt: otps[0].expiresAt, note: 'OTP is stored hashed; check WhatsApp for the code' }
      : { otp: null };
  }

  async devClearRateLimits(phoneNumber?: string, ip?: string) {
    if (phoneNumber) {
      const formatted = PhoneUtils.validateAndFormat(phoneNumber);
      await this.rateLimitService.resetRateLimit(formatted, RateLimitType.LOGIN);
      await this.rateLimitService.resetRateLimit(formatted, RateLimitType.OTP);
      await this.rateLimitService.resetRateLimit(formatted, RateLimitType.OTP_VERIFY);
      if (ip) {
        await this.rateLimitService.resetLoginRateLimits(ip, formatted);
      }
      await this.accountLockService.resetLock(formatted);
      return { message: `Rate limits cleared for ${PhoneUtils.maskPhoneNumber(formatted)}` };
    }
    return { message: 'Provide phoneNumber query param to clear login rate limits.' };
  }

  async getWhatsAppStatus() {
    return this.whatsappService.getStatus();
  }

  async devGetWhatsAppQr() {
    try {
      const status = await this.whatsappService.getStatus();
      if (status.connected) {
        return { message: 'WhatsApp already connected', connected: true, state: status.state };
      }
      const qr = await this.whatsappService.getQRCode(process.env.WHATSAPP_INSTANCE_NAME || 'clinic-management');
      return qr
        ? { qrImage: `data:image/png;base64,${qr}`, connected: false, state: status.state }
        : { message: 'QR not available yet. Retry in a few seconds.', connected: false, state: status.state };
    } catch (e: any) {
      return { message: e.message, connected: false };
    }
  }

  async activateClinicAdmin(activateDto: ActivateClinicAdminDto) {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(activateDto.phoneNumber);
    const { code } = activateDto;

    this.logger.log(`Clinic admin activation attempt: code=${code}, phone=${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)}`);

    // Use HTTP to call system-manager-service directly.
    // Kafka request-reply (ClientKafka.send) has known metadata fetch issues
    // in KafkaJS v2 that cause UNKNOWN_TOPIC_OR_PARTITION on reply topics.
    const systemManagerUrl = process.env.SYSTEM_MANAGER_SERVICE_URL || 'http://system-manager-service:3003';
    const signingSecret = process.env.INTERNAL_AUTH_SECRET;
    if (!signingSecret) throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    try {
      const axios = require('axios');
      const { createInternalAuthHeadersForUrl } = require('../../internal-auth-shared/internal-http.signer');
      const path = '/v1/system-manager/activation-code/validate-internal';
      const body = { code, phoneNumber: formattedPhoneNumber };
      const response = await axios.post(
        `${systemManagerUrl}${path}`,
        body,
        {
          timeout: 10000,
          headers: createInternalAuthHeadersForUrl(
            'auth-service',
            signingSecret,
            'POST',
            path,
            body,
          ),
        },
      );
      return {
        message: response.data.message,
        adminFullName: response.data.adminFullName,
        clinicLocation: response.data.clinicLocation,
        idNumber: response.data.idNumber,
        dateOfBirth: response.data.dateOfBirth,
        email: response.data.email,
        registrationLicenseNumber: response.data.registrationLicenseNumber,
        address: response.data.address,
        phoneNumber: response.data.phoneNumber ?? formattedPhoneNumber,
      };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      this.logger.error(`Activation failed: ${msg}`);
      if (error.response?.status === 400) {
        throw new BadRequestException(msg);
      }
      throw new BadRequestException('Activation failed. Please check the activation code and try again.');
    }
  }

  async getClinicAdminOnboardingStatus(phoneNumber: string) {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(phoneNumber);
    const systemManagerUrl = process.env.SYSTEM_MANAGER_SERVICE_URL || 'http://system-manager-service:3003';
    const signingSecret = process.env.INTERNAL_AUTH_SECRET;
    if (!signingSecret) throw new Error('INTERNAL_AUTH_SECRET env var is not set');

    let dashboardActivated = false;
    let adminFullName: string | undefined;
    let clinicLocation: string | undefined;
    let idNumber: string | undefined;
    let dateOfBirth: string | undefined;
    let email: string | undefined;
    let registrationLicenseNumber: string | undefined;
    let address: string | undefined;

    try {
      const axios = require('axios');
      const { createInternalAuthHeadersForUrl } = require('../../internal-auth-shared/internal-http.signer');
      const activatedPath = '/v1/system-manager/activation-code/check-activated';
      const activatedRes = await axios.get(
        `${systemManagerUrl}${activatedPath}`,
        {
          params: { phoneNumber: formattedPhoneNumber },
          timeout: 5000,
          headers: createInternalAuthHeadersForUrl(
            'auth-service',
            signingSecret,
            'GET',
            activatedPath,
          ),
        },
      );
      dashboardActivated = activatedRes.data?.activated === true;

      if (dashboardActivated) {
        const lookupPath = '/v1/system-manager/activation-code/lookup-used-by-phone';
        const lookupRes = await axios.get(
          `${systemManagerUrl}${lookupPath}`,
          {
            params: { phoneNumber: formattedPhoneNumber },
            timeout: 5000,
            headers: createInternalAuthHeadersForUrl(
              'auth-service',
              signingSecret,
              'GET',
              lookupPath,
            ),
          },
        );
        if (lookupRes.data?.found) {
          adminFullName = lookupRes.data.adminFullName;
          clinicLocation = lookupRes.data.clinicLocation;
          idNumber = lookupRes.data.idNumber;
          dateOfBirth = lookupRes.data.dateOfBirth;
          email = lookupRes.data.email;
          registrationLicenseNumber = lookupRes.data.registrationLicenseNumber;
          address = lookupRes.data.address;
        }
      }
    } catch (error: any) {
      this.logger.warn(`Onboarding status lookup failed: ${error.message}`);
      throw new BadRequestException('Could not check onboarding status. Please try again.');
    }

    const registered = await this.checkUserExists(formattedPhoneNumber);

    return {
      phoneNumber: formattedPhoneNumber,
      dashboardActivated,
      registered,
      canActivate: !dashboardActivated,
      canRegister: dashboardActivated && !registered,
      canLogin: dashboardActivated && registered,
      adminFullName,
      clinicLocation,
      idNumber,
      dateOfBirth,
      email,
      registrationLicenseNumber,
      address,
    };
  }

  async sendPasswordResetOtp(sendOtpDto: SendOtpDto): Promise<OtpDeliveryResponse> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(sendOtpDto.phoneNumber);
    const rateLimitCheck = await this.rateLimitService.checkRateLimit(
      formattedPhoneNumber,
      RateLimitType.PASSWORD_RESET,
    );
    if (!rateLimitCheck.allowed) {
      throw new BadRequestException(
        `Too many password reset requests. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
      );
    }
    return this.sendOtp(sendOtpDto, OtpType.PASSWORD_RESET);
  }

  /** Validates password-reset OTP without consuming it (step 2 of forgot-password flow). */
  async verifyPasswordResetOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string; verified: boolean }> {
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(verifyOtpDto.phoneNumber);
    const { otp } = verifyOtpDto;
    const type = OtpType.PASSWORD_RESET;

    const rateLimitCheck = await this.rateLimitService.checkRateLimit(
      formattedPhoneNumber,
      RateLimitType.OTP_VERIFY,
    );
    if (!rateLimitCheck.allowed) {
      throw new BadRequestException(
        `Too many OTP verification attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
      );
    }

    const userExists = await this.checkUserExists(formattedPhoneNumber);
    if (!userExists) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const otpHash = Otp.hashCode(otp, formattedPhoneNumber, type);
    const otpRecord = await this.otpRepository.findOne({
      where: { phoneNumber: formattedPhoneNumber, type, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (otpRecord && otpRecord.failedAttempts >= 5) {
      await this.otpRepository.update(otpRecord.id, { isUsed: true });
      throw new BadRequestException('Invalid or expired OTP');
    }

    const validOtp = await this.otpRepository.findOne({
      where: {
        phoneNumber: formattedPhoneNumber,
        codeHash: otpHash,
        type,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!validOtp || validOtp.expiresAt < new Date()) {
      if (otpRecord) {
        await this.otpRepository.increment({ id: otpRecord.id }, 'failedAttempts', 1);
      }
      await this.rateLimitService.recordFailedAttempt(formattedPhoneNumber, RateLimitType.OTP_VERIFY);
      throw new BadRequestException('Invalid or expired OTP');
    }

    return {
      verified: true,
      message: 'Verification code accepted. Choose your new password.',
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    deviceInfo?: any,
    requestId?: string,
  ): Promise<AuthSessionResponse> {
    const { phoneNumber, otp, newPassword } = resetPasswordDto;
    const formattedPhoneNumber = PhoneUtils.validateAndFormat(phoneNumber);

    let userId: string;

    await this.dataSource.transaction(async (transactionManager) => {
      const otpHash = Otp.hashCode(otp, formattedPhoneNumber, OtpType.PASSWORD_RESET);
      const validOtp = await transactionManager.findOne(Otp, {
        where: {
          phoneNumber: formattedPhoneNumber,
          codeHash: otpHash,
          type: OtpType.PASSWORD_RESET,
          isUsed: false,
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (!validOtp || validOtp.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired OTP');
      }

      await transactionManager.update(Otp, validOtp.id, { isUsed: true });

      const userResponse = await this.userHttp.getUserByPhone(formattedPhoneNumber);
      if (!userResponse?.success || !userResponse.user) {
        throw new BadRequestException('Phone number not registered');
      }

      userId = userResponse.user.id as string;
      await this.userHttp.resetPassword(userId, newPassword);
      await Promise.all([
        this.sessionService.revokeAllUserSessions(userId),
        this.trustedDeviceService.revokeByUserId(userId),
      ]);

      await this.auditLogService.createLog({
        userId,
        action: AuditAction.PASSWORD_RESET,
        resource: AuditResource.USER,
        success: true,
        risk: 'medium',
      });
    });

    const userResponse = await this.userHttp.getUserById(userId!);
    if (!userResponse?.success || !userResponse.user) {
      throw new ServiceUnavailableException('Password reset succeeded but sign-in failed. Please log in.');
    }

    const user = userResponse.user as AuthUserProfile;

    if (this.usesLoginMfa(user.role)) {
      await this.trustedDeviceService.trustDevice(user.id, deviceInfo);
    }

    await this.linkStaffToClinic(user);

    await Promise.all([
      this.rateLimitService.resetRateLimit(formattedPhoneNumber, RateLimitType.LOGIN),
      this.accountLockService.resetLock(formattedPhoneNumber),
    ]);

    this.logger.log(
      `Password reset + auto sign-in for ${PhoneUtils.maskPhoneNumber(formattedPhoneNumber)}`,
    );

    return this.issueFullLoginTokens(
      user,
      deviceInfo,
      requestId,
      { passwordReset: true },
      'Password reset successful. You are now signed in.',
    );
  }
}
