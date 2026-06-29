import {
  Injectable, NotFoundException, UnauthorizedException,
  Logger, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { SystemManager } from '../entities/system-manager.entity';
import { ClinicAdminActivation, ActivationCodeStatus } from '../entities/clinic-admin-activation.entity';
import {
  SystemManagerLoginDto, CreateSystemManagerDto, CreateClinicAdminDto,
} from '../dto/system-manager.dto';
import {
  GenerateActivationCodeDto, ValidateActivationCodeDto, RevokeActivationCodeDto,
} from '../dto/clinic-admin-activation.dto';
import { ClinicHttpClient } from './clinic-http.client';

class PhoneUtils {
  static validateSyrianPhone(phoneNumber: string): string {
    if (!phoneNumber) throw new BadRequestException('Phone number is required');
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.startsWith('963') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+963${digits.substring(1)}`;
    if (digits.length === 9) return `+963${digits}`;
    throw new BadRequestException('Invalid Syrian phone number format (+963XXXXXXXXX, 0XXXXXXXXX, or XXXXXXXXX).');
  }
}

@Injectable()
export class SystemManagerService {
  private readonly logger = new Logger(SystemManagerService.name);

  constructor(
    @InjectRepository(SystemManager)
    private systemManagerRepository: Repository<SystemManager>,
    @InjectRepository(ClinicAdminActivation)
    private clinicAdminActivationRepository: Repository<ClinicAdminActivation>,
    private jwtService: JwtService,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
    private readonly clinicHttpClient: ClinicHttpClient,
  ) {}

  async login(loginDto: SystemManagerLoginDto) {
    const { username, password } = loginDto;

    const systemManager = await this.systemManagerRepository.findOne({
      where: { username },
      select: ['id', 'username', 'password', 'firstName', 'lastName', 'email', 'isActive'],
    });

    if (!systemManager?.password) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, systemManager.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');
    if (!systemManager.isActive) throw new UnauthorizedException('Account is not active');

    const accessToken = this.jwtService.sign({
      sub: systemManager.id,
      username: systemManager.username,
      role: 'SYSTEM_MANAGER',
    });

    this.kafkaClient.emit('system.manager.login', {
      systemManagerId: systemManager.id,
      username: systemManager.username,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`System manager logged in: ${username}`);

    return {
      accessToken,
      user: {
        id: systemManager.id,
        username: systemManager.username,
        firstName: systemManager.firstName,
        lastName: systemManager.lastName,
        email: systemManager.email,
      },
    };
  }

  async create(createDto: CreateSystemManagerDto) {
    const { username, password, firstName, lastName, email } = createDto;

    const existing = await this.systemManagerRepository.findOne({ where: { username } });
    if (existing) throw new BadRequestException('Username already exists');

    const hashedPassword = await bcrypt.hash(password, 12);
    const systemManager = this.systemManagerRepository.create({
      username, password: hashedPassword, firstName, lastName, email,
      isActive: true, linkedUserIds: [],
    });

    const saved = await this.systemManagerRepository.save(systemManager);

    this.kafkaClient.emit('system.manager.created', {
      systemManagerId: saved.id,
      username: saved.username,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`System manager created: ${username}`);
    return {
      id: saved.id, username: saved.username,
      firstName: saved.firstName, lastName: saved.lastName, email: saved.email,
    };
  }

  async createClinicAdmin(createDto: CreateClinicAdminDto, systemManagerId: string) {
    this.kafkaClient.emit('user.create.clinic.admin', {
      systemManagerId,
      ...createDto,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Clinic admin creation request sent by system manager: ${systemManagerId}`);
    return { message: 'Clinic admin creation request sent' };
  }

  async seedSystemManager(
    username: string, password: string, firstName: string,
    lastName: string, email?: string, phoneNumber?: string,
  ) {
    const formattedPhone = phoneNumber
      ? PhoneUtils.validateSyrianPhone(phoneNumber)
      : undefined;

    const existing = await this.systemManagerRepository.findOne({ where: { username } });
    if (existing) return { message: 'System manager already exists', username };

    const hashedPassword = await bcrypt.hash(password, 12);
    const systemManager = this.systemManagerRepository.create({
      username, password: hashedPassword, firstName, lastName,
      email, phoneNumber: formattedPhone, isActive: true, linkedUserIds: [],
    });
    await this.systemManagerRepository.save(systemManager);
    this.logger.log(`System manager seeded: ${username}`);
    return { message: 'System manager created successfully', username };
  }

  async seedDefaultSystemManager() {
    // Credentials come from environment variables — never hardcoded in source
    const username = process.env.DEFAULT_ADMIN_USERNAME;
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    const firstName = process.env.DEFAULT_ADMIN_FIRST_NAME || 'Admin';
    const lastName = process.env.DEFAULT_ADMIN_LAST_NAME || 'User';
    const email = process.env.DEFAULT_ADMIN_EMAIL;
    const phoneNumber = process.env.DEFAULT_ADMIN_PHONE;

    if (!username || !password) {
      throw new BadRequestException(
        'DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD env vars must be set before seeding',
      );
    }

    return this.seedSystemManager(
      username,
      password,
      firstName,
      lastName,
      email,
      phoneNumber,
    );
  }

  // Returns void — Kafka consumers don't need the entity back
  async updateLinkedUserIds(systemManagerId: string, userId: string, action: 'add' | 'remove'): Promise<void> {
    const systemManager = await this.systemManagerRepository.findOne({
      where: { id: systemManagerId },
    });

    if (!systemManager) {
      throw new NotFoundException(`System manager not found: ${systemManagerId}`);
    }

    if (!systemManager.linkedUserIds) systemManager.linkedUserIds = [];

    if (action === 'add') {
      if (!systemManager.linkedUserIds.includes(userId)) {
        systemManager.linkedUserIds.push(userId);
      }
    } else {
      systemManager.linkedUserIds = systemManager.linkedUserIds.filter(id => id !== userId);
    }

    await this.systemManagerRepository.save(systemManager);
    this.logger.log(`LinkedUserIds updated: systemManager=${systemManagerId} action=${action} user=${userId}`);
  }

  async generateActivationCode(generateDto: GenerateActivationCodeDto, systemManagerId: string) {
    const { idNumber, phoneNumber, fullName, clinicLocation, price, isCashPaymentDone, notes } = generateDto;
    const formattedPhoneNumber = PhoneUtils.validateSyrianPhone(phoneNumber);

    const existingPending = await this.clinicAdminActivationRepository.findOne({
      where: [
        { phoneNumber: formattedPhoneNumber, status: ActivationCodeStatus.PENDING },
        { idNumber, status: ActivationCodeStatus.PENDING },
      ],
    });

    if (existingPending) {
      existingPending.status = ActivationCodeStatus.REVOKED;
      existingPending.revokedAt = new Date();
      await this.clinicAdminActivationRepository.save(existingPending);
      this.logger.log(`Revoked existing pending activation code for phone: ${formattedPhoneNumber}`);
    }

    const code = this.generateNumericCode(6);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const activation = this.clinicAdminActivationRepository.create({
      code, idNumber, phoneNumber: formattedPhoneNumber, fullName,
      clinicLocation, price, isCashPaymentDone,
      status: ActivationCodeStatus.PENDING, expiresAt,
      generatedBy: systemManagerId, metadata: { notes },
    });

    const saved = await this.clinicAdminActivationRepository.save(activation);

    // No user is created here — clinic admin registers themselves after activating the code.

    this.kafkaClient.emit('audit.log', {
      action: 'ACTIVATION_CODE_GENERATED',
      resource: 'CLINIC_ADMIN_ACTIVATION',
      resourceId: saved.id,
      performedBy: systemManagerId,
      details: {
        phoneNumber: formattedPhoneNumber, idNumber, fullName,
        clinicLocation, price, isCashPaymentDone,
        code: code.substring(0, 4) + '****',
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Activation code generated for ${fullName} (${formattedPhoneNumber}) by ${systemManagerId}`);

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      message: 'Activation code generated successfully. Share this code with the clinic admin.',
    };
  }

  async validateActivationCode(validateDto: ValidateActivationCodeDto) {
    const { code, phoneNumber } = validateDto;
    const formattedPhoneNumber = PhoneUtils.validateSyrianPhone(phoneNumber);

    const activation = await this.clinicAdminActivationRepository.findOne({ where: { code } });
    if (!activation) throw new BadRequestException('Invalid activation code');

    if (activation.phoneNumber !== formattedPhoneNumber) {
      activation.attemptCount += 1;
      await this.clinicAdminActivationRepository.save(activation);
      this.kafkaClient.emit('audit.log', {
        action: 'ACTIVATION_CODE_FAILED', resource: 'CLINIC_ADMIN_ACTIVATION',
        resourceId: activation.id,
        details: { reason: 'PHONE_NUMBER_MISMATCH', attemptCount: activation.attemptCount },
        timestamp: new Date().toISOString(),
      });
      throw new BadRequestException('This activation code is for a different phone number');
    }

    if (activation.expiresAt < new Date()) {
      activation.status = ActivationCodeStatus.EXPIRED;
      await this.clinicAdminActivationRepository.save(activation);
      throw new BadRequestException('Activation code has expired');
    }

    if (activation.status === ActivationCodeStatus.USED) {
      throw new BadRequestException('Activation code has already been used');
    }

    if (activation.status === ActivationCodeStatus.REVOKED) {
      throw new BadRequestException('Activation code has been revoked');
    }

    // Provision the clinic BEFORE consuming the code — if this fails, code stays PENDING.
    await this.clinicHttpClient.provisionFromActivation({
      activationCodeId: activation.id,
      adminPhoneNumber: formattedPhoneNumber,
      clinicLocation: activation.clinicLocation,
      adminFullName: activation.fullName,
      generatedBy: activation.generatedBy,
    });

    // Atomic consume: only one concurrent request can move PENDING -> USED.
    const consumedAt = new Date();
    const updateResult = await this.clinicAdminActivationRepository
      .createQueryBuilder()
      .update(ClinicAdminActivation)
      .set({
        status: ActivationCodeStatus.USED,
        usedAt: consumedAt,
        activatedAt: consumedAt,
      })
      .where('id = :id', { id: activation.id })
      .andWhere('phoneNumber = :phoneNumber', { phoneNumber: formattedPhoneNumber })
      .andWhere('status = :status', { status: ActivationCodeStatus.PENDING })
      .andWhere('expiresAt > :now', { now: consumedAt })
      .execute();

    if (!updateResult.affected || updateResult.affected === 0) {
      const latest = await this.clinicAdminActivationRepository.findOne({ where: { code } });
      if (!latest) throw new BadRequestException('Invalid activation code');
      if (latest.status === ActivationCodeStatus.USED) {
        throw new BadRequestException('Activation code has already been used');
      }
      if (latest.status === ActivationCodeStatus.REVOKED) {
        throw new BadRequestException('Activation code has been revoked');
      }
      if (latest.expiresAt < new Date() || latest.status === ActivationCodeStatus.EXPIRED) {
        throw new BadRequestException('Activation code has expired');
      }
      throw new BadRequestException('Activation code is no longer valid');
    }

    activation.status = ActivationCodeStatus.USED;
    activation.usedAt = consumedAt;
    activation.activatedAt = consumedAt;

    this.kafkaClient.emit('audit.log', {
      action: 'CLINIC_ADMIN_ACTIVATED', resource: 'CLINIC_ADMIN_ACTIVATION',
      resourceId: activation.id,
      details: { fullName: activation.fullName, activatedAt: activation.activatedAt.toISOString() },
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Activation code used: ${activation.fullName} (${activation.phoneNumber})`);

    return {
      message: 'Dashboard activated successfully. Your clinic is ready — register with your phone number.',
      phoneNumber: formattedPhoneNumber,
      adminFullName: activation.fullName,
      clinicLocation: activation.clinicLocation,
    };
  }

  async checkPhoneHasActivatedCode(phoneNumber: string): Promise<{ activated: boolean }> {
    const formattedPhoneNumber = PhoneUtils.validateSyrianPhone(phoneNumber);
    const activation = await this.clinicAdminActivationRepository.findOne({
      where: { phoneNumber: formattedPhoneNumber, status: ActivationCodeStatus.USED },
    });
    return { activated: !!activation };
  }

  async lookupUsedActivationByPhone(phoneNumber: string): Promise<{
    found: boolean;
    activationCodeId?: string;
    adminPhoneNumber?: string;
    clinicLocation?: string;
    adminFullName?: string;
    generatedBy?: string;
  }> {
    const formattedPhoneNumber = PhoneUtils.validateSyrianPhone(phoneNumber);
    const activation = await this.clinicAdminActivationRepository.findOne({
      where: { phoneNumber: formattedPhoneNumber, status: ActivationCodeStatus.USED },
      order: { activatedAt: 'DESC' },
    });
    if (!activation) {
      return { found: false };
    }
    return {
      found: true,
      activationCodeId: activation.id,
      adminPhoneNumber: activation.phoneNumber,
      clinicLocation: activation.clinicLocation,
      adminFullName: activation.fullName,
      generatedBy: activation.generatedBy,
    };
  }

  async revokeActivationCode(revokeDto: RevokeActivationCodeDto, systemManagerId: string) {
    const { code, reason } = revokeDto;
    const activation = await this.clinicAdminActivationRepository.findOne({ where: { code } });
    if (!activation) throw new BadRequestException('Invalid activation code');

    if (activation.status === ActivationCodeStatus.USED) {
      throw new BadRequestException('Cannot revoke an already used activation code');
    }

    activation.status = ActivationCodeStatus.REVOKED;
    activation.revokedAt = new Date();
    await this.clinicAdminActivationRepository.save(activation);

    this.kafkaClient.emit('audit.log', {
      action: 'ACTIVATION_CODE_REVOKED', resource: 'CLINIC_ADMIN_ACTIVATION',
      resourceId: activation.id, performedBy: systemManagerId,
      details: { reason },
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Activation code revoked by ${systemManagerId}`);
    return { message: 'Activation code revoked successfully' };
  }

  async getActivationCodeStatus(code: string) {
    const activation = await this.clinicAdminActivationRepository.findOne({ where: { code } });
    if (!activation) throw new BadRequestException('Invalid activation code');
    return {
      status: activation.status,
      expiresAt: activation.expiresAt,
      usedAt: activation.usedAt,
      revokedAt: activation.revokedAt,
      attemptCount: activation.attemptCount,
    };
  }

  private generateNumericCode(length: number): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return require('crypto').randomInt(min, max + 1).toString();
  }

  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = require('crypto').randomBytes(length);
    return Array.from(bytes as Buffer).map((b: number) => chars[b % chars.length]).join('');
  }
}
