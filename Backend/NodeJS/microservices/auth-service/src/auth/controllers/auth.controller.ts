import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { SecuritySummaryService, SecurityRange } from '../services/security-summary.service';
import {
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  RevokeSessionDto,
  ActivateClinicAdminDto,
  CreateUserByAdminDto,
  CompleteStaffActivationDto,
  VerifyMfaDto,
  ResetPasswordDto,
} from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { IdempotencyGuard, Idempotent } from '../guards/idempotency.guard';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { CsrfGuard } from '../guards/csrf.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { clientIp } from '../utils/client-ip';

enum UserRole {
  SYSTEM_MANAGER = 'SYSTEM_MANAGER',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  DOCTOR = 'DOCTOR',
  SECRETARY = 'SECRETARY',
  PATIENT = 'PATIENT',
}

// LOW FIX: Add API versioning
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securitySummaryService: SecuritySummaryService,
  ) {}

  // Idempotency-Key header makes retries safe — same key + same body returns
  // the cached response without creating a second user or sending a second OTP.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @UseGuards(IdempotencyGuard, CsrfGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Request() req) {
    const autoLogin = verifyOtpDto.autoLogin === 'true';
    const deviceInfo = {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    };
    // HIGH FIX: Pass deviceInfo to verifyOtp for auto-login IP fix
    return this.authService.verifyOtp(verifyOtpDto, undefined, autoLogin, deviceInfo);
  }

  /** Called by API gateway to validate JWT before proxying protected routes */
  @UseGuards(InternalServiceGuard, JwtAuthGuard)
  @Get('validate-token')
  async validateToken(@Request() req) {
    return {
      user: {
        id: req.user.userId,
        role: req.user.role,
        sessionId: req.user.sessionId,
        tenantId: req.user.tenantId ?? req.user.clinicId,
        clinicId: req.user.tenantId ?? req.user.clinicId,
      },
    };
  }

  /** Aggregated security metrics for system-manager Control Center */
  @UseGuards(InternalServiceGuard)
  @Get('internal/security-summary')
  async securitySummary(@Query('range') range?: string) {
    const normalized: SecurityRange =
      range === '6h' || range === '24h' ? range : '1h';
    return this.securitySummaryService.getSummary(normalized);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req) {
    const deviceInfo = {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
      deviceId: loginDto.deviceId,
      browserFingerprint: loginDto.browserFingerprint,
    };
    const requestId = req.headers['x-request-id'] as string;
    return this.authService.login(loginDto, deviceInfo, requestId);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.resendOtp(sendOtpDto);
  }

  @Post('resend-mfa-otp')
  @HttpCode(HttpStatus.OK)
  async resendMfaOtp(@Body() body: { mfaToken: string }) {
    return this.authService.resendMfaOtp(body.mfaToken);
  }

  @Post('check-otp-status')
  @HttpCode(HttpStatus.OK)
  async checkOtpStatus(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.checkOtpStatus(sendOtpDto.phoneNumber);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Request() req) {
    const requestId = req.headers['x-request-id'] as string;
    return this.authService.refreshToken(refreshTokenDto, clientIp(req), requestId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Body() logoutDto: LogoutDto) {
    return this.authService.logout(req.user.userId, logoutDto, req.user.jti);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@Request() req) {
    return this.authService.getUserSessions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Request() req, @Param('sessionId') sessionId: string) {
    return this.authService.revokeUserSession(req.user.userId, { sessionId });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@Request() req, @Query('except') exceptSessionId?: string) {
    return this.authService.revokeAllUserSessions(req.user.userId, exceptSessionId);
  }

  // Clinic Admin: create staff (doctor, secretary)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Post('clinic/create-user')
  @HttpCode(HttpStatus.CREATED)
  async createClinicUser(@Body() createUserDto: CreateUserByAdminDto, @Request() req) {
    return this.authService.createUserByAdmin(createUserDto, req.user.userId);
  }


  // Clinic Admin Activation
  @Post('clinic-admin/activate')
  @HttpCode(HttpStatus.OK)
  async activateClinicAdmin(@Body() activateDto: ActivateClinicAdminDto) {
    return this.authService.activateClinicAdmin(activateDto);
  }

  @Get('clinic-admin/onboarding-status')
  @HttpCode(HttpStatus.OK)
  async getClinicAdminOnboardingStatus(@Query('phoneNumber') phoneNumber: string) {
    return this.authService.getClinicAdminOnboardingStatus(phoneNumber);
  }

  // Password Reset
  @Post('forgot-password/send-otp')
  @HttpCode(HttpStatus.OK)
  async sendPasswordResetOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendPasswordResetOtp(sendOtpDto);
  }

  @Post('forgot-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyPasswordResetOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyPasswordResetOtp(verifyOtpDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Request() req) {
    const deviceInfo = {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
      deviceId: resetPasswordDto.deviceId,
      browserFingerprint: resetPasswordDto.browserFingerprint,
    };
    const requestId = req.headers['x-request-id'] as string;
    return this.authService.resetPassword(resetPasswordDto, deviceInfo, requestId);
  }

  @Get('dev/whatsapp-qr')
  async devWhatsAppQr() {
    if (process.env.NODE_ENV !== 'development') {
      return { message: 'Only available in development' };
    }
    return this.authService.devGetWhatsAppQr();
  }

  @Get('dev/whatsapp-status')
  async devWhatsAppStatus() {
    if (process.env.NODE_ENV !== 'development') {
      return { message: 'Only available in development' };
    }
    return this.authService.getWhatsAppStatus();
  }

  @Get('dev/latest-otp')
  async devLatestOtp(@Query('phoneNumber') phoneNumber: string) {
    if (process.env.NODE_ENV !== 'development') {
      return { message: 'Only available in development' };
    }
    return this.authService.devGetLatestOtp(phoneNumber);
  }

  @Post('dev/clear-rate-limits')
  @HttpCode(HttpStatus.OK)
  async devClearRateLimits(@Query('phoneNumber') phoneNumber: string, @Request() req) {
    const allowed =
      process.env.NODE_ENV === 'development' ||
      process.env.RATE_LIMIT_ADMIN_ENABLED === 'true';
    if (!allowed) {
      return { message: 'Only available in development' };
    }
    return this.authService.devClearRateLimits(phoneNumber, clientIp(req));
  }

  // MFA verification after login returns { requiresMfa: true, mfaToken }
  @Post('verify-mfa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  async verifyMfa(@Body() body: VerifyMfaDto, @Request() req) {
    const deviceInfo = {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
      deviceId: body.deviceId,
      browserFingerprint: body.browserFingerprint,
    };
    const requestId = req.headers['x-request-id'] as string;
    return this.authService.verifyMfa(
      body.mfaToken,
      body.otp,
      deviceInfo,
      requestId,
      body.clientApp,
    );
  }

  /** Staff onboarding: set permanent password after MFA (returns access + refresh tokens). */
  @Post('staff/complete-activation')
  @HttpCode(HttpStatus.OK)
  async completeStaffActivation(@Body() dto: CompleteStaffActivationDto, @Request() req) {
    const deviceInfo = {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
      deviceId: dto.deviceId,
      browserFingerprint: dto.browserFingerprint,
    };
    const requestId = req.headers['x-request-id'] as string;
    return this.authService.completeStaffActivation(
      dto.activationToken,
      dto.newPassword,
      deviceInfo,
      requestId,
    );
  }
}
