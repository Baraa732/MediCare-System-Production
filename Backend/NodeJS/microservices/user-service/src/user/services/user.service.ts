import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { PasswordHistory } from '../entities/password-history.entity';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UpdateUserStatusDto } from '../dto/user.dto';
import { CreateUserByAdminDto } from '../dto/create-user-by-admin.dto';
import {
  emailAlreadyRegistered,
  phoneAlreadyRegistered,
  rethrowIfRegistrationError,
  usernameAlreadyTaken,
} from '../../common/errors/registration.errors';
import { ClinicHttpClient } from './clinic-http.client';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { HttpTenantAccessChecker } from '../../tenant-shared/tenant-access-checker';
import { tenantFindWhere } from '../../tenant-shared/tenant-query.util';
import { withTenantEvent, GLOBAL_PATIENT_STORAGE_SCOPE, tenantUploadPrefix } from '../../tenant-shared/tenant.constants';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

const PASSWORD_HISTORY_LIMIT = 5;
const STAFF_ACTIVATION_HOURS = 48;

function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_DIR = process.env.AVATAR_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'avatars');
const LEGACY_AVATAR_DIR = AVATAR_DIR;
const STAFF_ROLES = new Set<string>(['CLINIC_ADMIN', 'SECRETARY', 'DOCTOR']);
const AVATAR_NOT_FOUND = 'Avatar not found';

type UploadedImageFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname?: string;
};

@Injectable()
export class UserService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OutboxEvent)
    private outboxRepository: Repository<OutboxEvent>,
    @InjectRepository(PasswordHistory)
    private passwordHistoryRepository: Repository<PasswordHistory>,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
    private dataSource: DataSource,
    private readonly clinicHttpClient: ClinicHttpClient,
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccess: HttpTenantAccessChecker,
  ) {
    this.logger = createTenantLogger(UserService.name, tenantContext);
  }

  private emitUserEvent(topic: string, user: User, payload: Record<string, unknown>): void {
    const tenantId =
      user.tenantId ?? user.clinicId ?? this.tenantContext.getTenantId() ?? undefined;
    const body = { ...payload, tenantId, clinicId: tenantId };
    this.kafkaClient.emit(topic, tenantId ? withTenantEvent(tenantId, body) : body);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const {
      phoneNumber, firstName, lastName, email, password, role, clinicId, specialization, licenseNumber,
      middleName, nationalId, motherName, motherLastName, gender, birthDate, birthPlace,
      maritalStatus, healthStatus, yearsOfExperience, governorate, state, streetInfo,
    } = createUserDto;

    await this.assertRegistrationUniques(phoneNumber, email);

    const hashedPassword = await bcrypt.hash(password, 10);

    const profileData: Record<string, unknown> = {};
    if (middleName) profileData.middleName = middleName;
    if (nationalId) profileData.nationalId = nationalId;
    if (motherName) profileData.motherName = motherName;
    if (motherLastName) profileData.motherLastName = motherLastName;
    if (gender) profileData.gender = gender;
    if (birthDate) profileData.birthDate = birthDate;
    if (birthPlace) profileData.birthPlace = birthPlace;
    if (maritalStatus) profileData.maritalStatus = maritalStatus;
    if (healthStatus) profileData.healthStatus = healthStatus;
    if (yearsOfExperience !== undefined) profileData.yearsOfExperience = yearsOfExperience;
    if (governorate || state || streetInfo) {
      profileData.location = { governorate, state, streetInfo };
    }

    try {
      const savedUser = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        phoneNumber,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role || UserRole.PATIENT,
        status: UserStatus.PENDING,
        isDashboardActivated: role === UserRole.CLINIC_ADMIN,
        clinicId,
        specialization,
        licenseNumber,
        permissions: [],
        profileData: Object.keys(profileData).length > 0 ? profileData : undefined,
      });
      user.permissions = user.getDefaultPermissionsForRole();

      const saved = await manager.save(User, user);

      // Write outbox event in the same transaction
      await manager.save(OutboxEvent, {
        aggregateId:   saved.id,
        aggregateType: 'User',
        eventType:     'user.created',
        payload: {
          userId: saved.id,
          phoneNumber: saved.phoneNumber,
          firstName: saved.firstName,
          lastName: saved.lastName,
          email: saved.email,
          role: saved.role,
          tenantId: saved.tenantId ?? saved.clinicId ?? null,
          clinicId: saved.clinicId ?? saved.tenantId ?? null,
          createdAt: new Date().toISOString(),
        },
      });

      return saved;
    });

      if (savedUser.role === UserRole.CLINIC_ADMIN) {
        const clinicId = await this.clinicHttpClient.linkClinicAdmin(savedUser.id, phoneNumber);
        if (clinicId) {
          savedUser.clinicId = clinicId;
          await this.userRepository.save(savedUser);
          this.logger.log(`Clinic admin ${savedUser.id} linked to clinic ${clinicId}`);
        }
      }

      this.logger.log(`User created: ${maskPhoneNumber(phoneNumber)} (${role})`);
      return savedUser;
    } catch (error) {
      rethrowIfRegistrationError(error);
    }
  }

  private async assertRegistrationUniques(phoneNumber: string, email?: string | null): Promise<void> {
    const existingPhone = await this.userRepository.findOne({ where: { phoneNumber } });
    if (existingPhone) {
      throw phoneAlreadyRegistered();
    }

    const normalizedEmail = email?.trim();
    if (normalizedEmail) {
      const existingEmail = await this.userRepository.findOne({ where: { email: normalizedEmail } });
      if (existingEmail) {
        throw emailAlreadyRegistered();
      }
    }
  }

  generateTemporaryPassword(length = 8): string {
    let pwd = '';
    for (let i = 0; i < length; i += 1) {
      pwd += TEMP_PASSWORD_CHARS[crypto.randomInt(0, TEMP_PASSWORD_CHARS.length)];
    }
    return pwd;
  }

  async createByAdmin(
    dto: CreateUserByAdminDto,
  ): Promise<{ user: User; temporaryPassword: string | null; membershipOnly?: boolean }> {
    const {
      phoneNumber, username, email, firstName, middleName, lastName, nationalId,
      motherName, motherLastName, gender, birthDate, birthPlace, maritalStatus,
      healthStatus, yearsOfExperience, governorate, state, streetInfo,
      role, clinicId, specialization, licenseNumber,
    } = dto;

    if (![UserRole.DOCTOR, UserRole.SECRETARY].includes(role)) {
      throw new BadRequestException('Only DOCTOR and SECRETARY can be created by clinic admin');
    }

    if (!clinicId) {
      throw new BadRequestException('clinicId is required when creating clinic staff');
    }

    const existingPhone = await this.userRepository.findOne({ where: { phoneNumber } });
    if (existingPhone) {
      if (
        existingPhone.status === UserStatus.PENDING_ACTIVATION &&
        existingPhone.clinicId === clinicId &&
        existingPhone.role === role
      ) {
        return this.refreshPendingStaffInvite(existingPhone, dto);
      }

      if (
        existingPhone.role === role &&
        [UserRole.DOCTOR, UserRole.SECRETARY].includes(role)
      ) {
        const isOtherClinic = existingPhone.clinicId !== clinicId;
        const isActiveAtSameClinic =
          existingPhone.status === UserStatus.ACTIVE && existingPhone.clinicId === clinicId;
        if (isOtherClinic || isActiveAtSameClinic) {
          return { user: existingPhone, temporaryPassword: null, membershipOnly: true };
        }
      }

      if (existingPhone.status === UserStatus.PENDING_ACTIVATION) {
        throw new BadRequestException({
          code: 'PHONE_PENDING_STAFF_INVITE',
          message: 'This phone number already has a pending staff invite.',
          field: 'phoneNumber',
          suggestion:
            'Ask the staff member to sign in with their temporary password, or use a different phone number.',
        });
      }
      throw phoneAlreadyRegistered();
    }

    const normalizedEmail = email?.trim();
    if (normalizedEmail) {
      const existingEmail = await this.userRepository.findOne({ where: { email: normalizedEmail } });
      if (existingEmail) {
        throw emailAlreadyRegistered();
      }
    }

    if (username) {
      const existingUsername = await this.userRepository.findOne({ where: { username } });
      if (existingUsername) {
        throw usernameAlreadyTaken();
      }
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const activationExpiresAt = new Date();
    activationExpiresAt.setHours(activationExpiresAt.getHours() + STAFF_ACTIVATION_HOURS);

    const profileData: Record<string, unknown> = {
      nationalId,
      middleName,
      motherName,
      motherLastName,
      gender,
      birthDate,
      birthPlace,
      maritalStatus,
      healthStatus,
      yearsOfExperience,
      location: { governorate, state, streetInfo },
    };

    try {
      const savedUser = await this.dataSource.transaction(async (manager) => {
        const user = manager.create(User, {
          phoneNumber,
          username: username || null,
          firstName,
          lastName,
          email,
          password: hashedPassword,
          role,
          status: UserStatus.PENDING_ACTIVATION,
          mustChangePassword: true,
          activationExpiresAt,
          isPhoneVerified: false,
          clinicId,
          specialization,
          licenseNumber,
          profileData,
          permissions: [],
        });
        user.permissions = user.getDefaultPermissionsForRole();

        const saved = await manager.save(User, user);

        await manager.save(OutboxEvent, {
          aggregateId: saved.id,
          aggregateType: 'User',
          eventType: KafkaTopics.USER_CREATE_BY_ADMIN,
          payload: {
            userId: saved.id,
            phoneNumber: saved.phoneNumber,
            role: saved.role,
            clinicId: saved.clinicId,
            status: saved.status,
            createdAt: new Date().toISOString(),
          },
        });

        return saved;
      });

      this.logger.log(`Staff created by admin: ${maskPhoneNumber(phoneNumber)} (${role}) — pending activation`);
      return { user: savedUser, temporaryPassword };
    } catch (error) {
      rethrowIfRegistrationError(error);
    }
  }

  /** Idempotent retry when clinic admin re-submits after a timeout (user row already exists). */
  private async refreshPendingStaffInvite(
    user: User,
    dto: CreateUserByAdminDto,
  ): Promise<{ user: User; temporaryPassword: string; membershipOnly?: boolean }> {
    const normalizedEmail = dto.email?.trim();
    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingEmail = await this.userRepository.findOne({ where: { email: normalizedEmail } });
      if (existingEmail && existingEmail.id !== user.id) {
        throw emailAlreadyRegistered();
      }
    }

    if (dto.username && dto.username !== user.username) {
      const existingUsername = await this.userRepository.findOne({ where: { username: dto.username } });
      if (existingUsername && existingUsername.id !== user.id) {
        throw usernameAlreadyTaken();
      }
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const activationExpiresAt = new Date();
    activationExpiresAt.setHours(activationExpiresAt.getHours() + STAFF_ACTIVATION_HOURS);

    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.email = normalizedEmail || user.email;
    user.username = dto.username || user.username;
    user.password = hashedPassword;
    user.mustChangePassword = true;
    user.activationExpiresAt = activationExpiresAt;
    user.specialization = dto.specialization ?? user.specialization;
    user.licenseNumber = dto.licenseNumber ?? user.licenseNumber;

    const updated = await this.userRepository.save(user);
    this.logger.log(
      `Staff invite refreshed for ${maskPhoneNumber(user.phoneNumber)} (${user.role}) — pending activation`,
    );
    return { user: updated, temporaryPassword };
  }

  async completeStaffActivation(userId: string, newPassword: string): Promise<User> {
    const user = await this.findOne(userId);

    if (user.status !== UserStatus.PENDING_ACTIVATION && !user.mustChangePassword) {
      throw new BadRequestException('Account is not pending activation');
    }

    if (user.activationExpiresAt && user.activationExpiresAt < new Date()) {
      throw new BadRequestException('Activation period has expired. Contact your clinic administrator.');
    }

    const isReused = await this.checkPasswordHistory(user.id, newPassword);
    if (isReused) {
      throw new BadRequestException('New password cannot be the same as any of your last 5 passwords');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.savePasswordHistory(user.id, hashedPassword);

    user.password = hashedPassword;
    user.mustChangePassword = false;
    user.activationExpiresAt = null;
    user.isPhoneVerified = true;
    user.status = UserStatus.ACTIVE;

    const updated = await this.userRepository.save(user);

    this.emitUserEvent('user.phone.verified', updated, {
      userId: updated.id,
      phoneNumber: updated.phoneNumber,
      verifiedAt: new Date().toISOString(),
    });

    this.emitUserEvent('user.status.updated', updated, {
      userId: updated.id,
      phoneNumber: updated.phoneNumber,
      status: updated.status,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`Staff activation completed: ${maskPhoneNumber(user.phoneNumber)}`);
    return updated;
  }

  async findAll(filters?: any): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    const ctxTenant = this.tenantContext.getTenantId();
    if (ctxTenant) {
      queryBuilder.andWhere('user.tenant_id = :ctxTenantId', { ctxTenantId: ctxTenant });
    }

    if (filters?.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }
    if (filters?.clinicId) {
      queryBuilder.andWhere('user.tenant_id = :tenantId', { tenantId: filters.clinicId });
    }
    if (filters?.tenantId) {
      queryBuilder.andWhere('user.tenant_id = :tenantId', { tenantId: filters.tenantId });
    }
    if (filters?.status) {
      queryBuilder.andWhere('user.status = :status', { status: filters.status });
    }

    // Always paginate — never return unbounded result sets
    const take = Math.min(filters?.take || 20, 100);
    const skip = filters?.skip || 0;
    queryBuilder.take(take).skip(skip).orderBy('user.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(
    id: string,
    options?: { forSelf?: boolean; actorRole?: string },
  ): Promise<User> {
    const ctxTenant = this.tenantContext.getTenantId();
    if (options?.forSelf || !ctxTenant || options?.actorRole === UserRole.SYSTEM_MANAGER) {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }

    const tenantScoped = await this.userRepository.findOne({
      where: tenantFindWhere(ctxTenant, { id }),
    });
    if (tenantScoped) {
      return tenantScoped;
    }

    const candidate = await this.userRepository.findOne({ where: { id } });
    if (candidate?.role === UserRole.PATIENT) {
      const related = await this.tenantAccess.hasPatientClinicRelation(ctxTenant, id);
      if (related) {
        return candidate;
      }
    }

    if (candidate && [UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.SECRETARY].includes(candidate.role)) {
      const related = await this.tenantAccess.hasStaffClinicRelation(
        ctxTenant,
        id,
        candidate.role,
      );
      if (related) {
        return candidate;
      }
    }

    throw new NotFoundException('User not found');
  }

  /** Safe doctor card for patients — no phone, email, or password. */
  toPublicDoctorProfile(user: User) {
    const raw = user.profileData || {};
    const profile: Record<string, unknown> = {};
    for (const key of ['bio', 'languages', 'yearsOfExperience', 'gender']) {
      if (raw[key] !== undefined) profile[key] = raw[key];
    }
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      specialization: user.specialization,
      yearsOfExperience:
        typeof raw.yearsOfExperience === 'number' ? raw.yearsOfExperience : undefined,
      status: user.status,
      profile,
    };
  }

  toOwnProfileResponse(user: User) {
    const { password: _, ...rest } = user;
    const rawProfile = user.profileData || {};
    const profileData = Object.fromEntries(
      Object.entries(rawProfile).filter(
        ([k]) => !['password', 'nationalId', 'internalNotes', 'avatarData', 'avatarMime'].includes(k),
      ),
    );
    const hasAvatar = this.userHasAvatar(user);
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
      isDashboardActivated: user.isDashboardActivated,
      clinicId: user.clinicId,
      specialization: user.specialization,
      licenseNumber: user.role === UserRole.DOCTOR ? user.licenseNumber : undefined,
      avatarUrl: hasAvatar ? this.canonicalAvatarUrl(user.id) : undefined,
      hasAvatar,
      profileData,
      permissions: user.permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getPublicDoctorProfiles(userIds: string[]) {
    if (!userIds.length) return [];
    const unique = [...new Set(userIds)];
    // Lookup by explicit IDs — do not apply ambient tenant filters (they can
    // hide doctors whose legacy tenant_id is null/mismatched). Include
    // PENDING_ACTIVATION so clinic directories show newly invited doctors.
    const users = await this.userRepository.find({
      where: {
        id: In(unique),
        role: UserRole.DOCTOR,
        status: In([UserStatus.ACTIVE, UserStatus.PENDING_ACTIVATION]),
      },
    });
    return users.map((u) => this.toPublicDoctorProfile(u));
  }

  /** Clinic-admin workforce directory — tenant-scoped staff profiles for assignments. */
  async getClinicStaffProfiles(userIds: string[]) {
    if (!userIds.length) return [];
    const unique = [...new Set(userIds)];
    const ctxTenant = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = {
      id: In(unique),
      role: In([UserRole.DOCTOR, UserRole.SECRETARY, UserRole.CLINIC_ADMIN]),
    };
    if (ctxTenant) where.tenantId = ctxTenant;
    const users = await this.userRepository.find({ where });
    return users.map((u) => this.toClinicStaffProfile(u));
  }

  toClinicStaffProfile(user: User) {
    const raw = (user.profileData || {}) as Record<string, unknown>;
    const pick = (key: string) => {
      const v = raw[key];
      return typeof v === 'string' || typeof v === 'number' ? v : undefined;
    };
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      phoneNumber: user.phoneNumber,
      email: user.email ?? undefined,
      username: user.username ?? (typeof raw.username === 'string' ? raw.username : undefined),
      role: user.role,
      status: user.status,
      specialization: user.specialization ?? undefined,
      licenseNumber: user.licenseNumber ?? undefined,
      gender: typeof raw.gender === 'string' ? raw.gender : undefined,
      yearsOfExperience:
        typeof raw.yearsOfExperience === 'number' ? raw.yearsOfExperience : undefined,
      governorate: typeof raw.governorate === 'string' ? raw.governorate : undefined,
      state: typeof raw.state === 'string' ? raw.state : undefined,
      streetInfo: typeof raw.streetInfo === 'string' ? raw.streetInfo : undefined,
      birthDate: typeof raw.birthDate === 'string' ? raw.birthDate : undefined,
      nationalId: typeof raw.nationalId === 'string' ? raw.nationalId : undefined,
      maritalStatus: typeof raw.maritalStatus === 'string' ? raw.maritalStatus : undefined,
      languages: Array.isArray(raw.languages) ? raw.languages.filter((x) => typeof x === 'string') : undefined,
      department: typeof raw.department === 'string' ? raw.department : pick('department') as string | undefined,
      shift: typeof raw.shift === 'string' ? raw.shift : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getPublicDoctorProfile(doctorId: string) {
    const user = await this.findOne(doctorId);
    if (user.role !== UserRole.DOCTOR || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Doctor not found');
    }
    return this.toPublicDoctorProfile(user);
  }

  async searchDoctorIds(filters: { q?: string; specialization?: string }): Promise<string[]> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.role = :role', { role: UserRole.DOCTOR })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE });

    if (filters.specialization?.trim()) {
      qb.andWhere('LOWER(user.specialization) LIKE :spec', {
        spec: `%${filters.specialization.trim().toLowerCase()}%`,
      });
    }
    if (filters.q?.trim()) {
      const term = `%${filters.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term OR LOWER(user.specialization) LIKE :term)',
        { term },
      );
    }

    const rows = await qb.getMany();
    return rows.map((r) => r.id);
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User> {
    const candidates = this.phoneLookupCandidates(phoneNumber);
    for (const candidate of candidates) {
      const user = await this.userRepository.findOne({ where: { phoneNumber: candidate } });
      if (user) return user;
    }
    throw new NotFoundException('User not found');
  }

  /** Accept +963 / 09… / 9… when looking up stored E.164 numbers. */
  private phoneLookupCandidates(raw: string): string[] {
    const digits = String(raw ?? '').replace(/\D/g, '');
    const out = new Set<string>();
    if (raw?.trim()) out.add(raw.trim());
    if (digits) out.add(digits);

    let e164: string | null = null;
    if (digits.startsWith('963') && digits.length === 12) e164 = `+${digits}`;
    else if (digits.startsWith('0') && digits.length === 10) e164 = `+963${digits.slice(1)}`;
    else if (digits.length === 9 && digits.startsWith('9')) e164 = `+963${digits}`;

    if (e164) {
      out.add(e164);
      out.add(e164.slice(1));
      out.add(`0${e164.slice(4)}`);
    }

    return [...out];
  }

  private sanitizeProfileData(
    profileData: Record<string, unknown>,
    role: UserRole,
  ): Record<string, unknown> {
    // avatarData is write-only via updateAvatar — never accept from client profile PATCH/PUT
    const blocked = new Set(['password', 'nationalId', 'internalNotes', 'avatarData', 'avatarMime']);
    const patientAllowed = new Set([
      'dateOfBirth',
      'gender',
      'bloodType',
      'address',
      'city',
      'governorate',
      'emergencyContact',
      'avatarUrl',
      'preferredLanguage',
    ]);
    const doctorAllowed = new Set([
      ...patientAllowed,
      'bio',
      'languages',
      'yearsOfExperience',
    ]);

    const allowed = role === UserRole.DOCTOR ? doctorAllowed : patientAllowed;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(profileData)) {
      if (blocked.has(key)) continue;
      if (role === UserRole.PATIENT && !allowed.has(key)) continue;
      if (role === UserRole.DOCTOR && !allowed.has(key)) continue;
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (key === 'emergencyContact' && value && typeof value === 'object' && !Array.isArray(value)) {
        const contact = value as Record<string, unknown>;
        sanitized[key] = {
          name: typeof contact.name === 'string' ? contact.name : undefined,
          phone: typeof contact.phone === 'string' ? contact.phone : undefined,
          relation: typeof contact.relation === 'string' ? contact.relation : undefined,
        };
      } else if (key === 'languages' && Array.isArray(value)) {
        sanitized[key] = value.filter((item) => typeof item === 'string');
      }
    }

    return sanitized;
  }

  async update(id: string, updateUserDto: UpdateUserDto, options?: { forSelf?: boolean }): Promise<User> {
    const user = await this.findOne(id, options);
    const { profileData, ...scalarFields } = updateUserDto;

    if (user.role === UserRole.PATIENT) {
      delete scalarFields.clinicId;
      delete scalarFields.specialization;
      delete scalarFields.licenseNumber;
      delete scalarFields.permissions;
      delete scalarFields.status;
    }

    Object.assign(user, scalarFields);

    if (profileData !== undefined) {
      const sanitized = this.sanitizeProfileData(profileData, user.role);
      user.profileData = { ...(user.profileData || {}), ...sanitized };
    }

    const updatedUser = await this.userRepository.save(user);

    this.emitUserEvent('user.updated', updatedUser, {
      userId: updatedUser.id,
      phoneNumber: updatedUser.phoneNumber,
      role: updatedUser.role,
      clinicId: updatedUser.clinicId,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`User updated: ${maskPhoneNumber(user.phoneNumber)}`);
    return updatedUser;
  }

  async updateStatus(id: string, updateStatusDto: UpdateUserStatusDto): Promise<User> {
    const user = await this.findOne(id);
    user.status = updateStatusDto.status;

    const updatedUser = await this.userRepository.save(user);

    this.emitUserEvent('user.status.updated', updatedUser, {
      userId: updatedUser.id,
      phoneNumber: updatedUser.phoneNumber,
      status: updatedUser.status,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`User status updated: ${maskPhoneNumber(user.phoneNumber)} -> ${updateStatusDto.status}`);
    return updatedUser;
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
    options?: { forSelf?: boolean },
  ): Promise<{ message: string }> {
    const user = await this.findOne(id, options);

    // Verify current password
    const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Fix 14: Check password history — reject if matches last 5 passwords
    const isReused = await this.checkPasswordHistory(user.id, changePasswordDto.newPassword);
    if (isReused) {
      throw new BadRequestException('New password cannot be the same as any of your last 5 passwords');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Fix 14: Save to password history before updating
    await this.savePasswordHistory(user.id, hashedPassword);

    user.password = hashedPassword;
    await this.userRepository.save(user);

    this.emitPasswordChanged(user);

    this.logger.log(`Password changed for user: ${maskPhoneNumber(user.phoneNumber)}`);
    return { message: 'Password changed successfully' };
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    
    // Soft delete
    user.status = UserStatus.DELETED;
    user.deletedAt = new Date();
    
    await this.userRepository.save(user);

    this.emitUserEvent('user.deleted', user, {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      deletedAt: new Date().toISOString(),
    });

    this.logger.log(`User deleted: ${maskPhoneNumber(user.phoneNumber)}`);
    return { message: 'User deleted successfully' };
  }

  async verifyPhone(phoneNumber: string): Promise<{ message: string }> {
    const user = await this.findByPhoneNumber(phoneNumber);
    user.isPhoneVerified = true;

    // Staff must complete password change before becoming ACTIVE
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }

    await this.userRepository.save(user);

    this.emitUserEvent('user.phone.verified', user, {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      verifiedAt: new Date().toISOString(),
    });

    this.logger.log(`Phone verified for user: ${maskPhoneNumber(phoneNumber)}`);
    return { message: 'Phone verified successfully' };
  }

  async verifyEmail(userId: string): Promise<{ message: string }> {
    const user = await this.findOne(userId);
    user.isEmailVerified = true;
    
    await this.userRepository.save(user);

    this.emitUserEvent('user.email.verified', user, {
      userId: user.id,
      email: user.email,
      verifiedAt: new Date().toISOString(),
    });

    this.logger.log(`Email verified for user: ${maskPhoneNumber(user.phoneNumber)}`);
    return { message: 'Email verified successfully' };
  }

  async updateDashboardActivation(userId: string, isActivated: boolean): Promise<{ message: string }> {
    const user = await this.findOne(userId);
    user.isDashboardActivated = isActivated;
    
    await this.userRepository.save(user);

    this.emitUserEvent('user.dashboard.activation.updated', user, {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      isDashboardActivated: isActivated,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`Dashboard activation updated for user: ${maskPhoneNumber(user.phoneNumber)} -> ${isActivated}`);
    return { message: 'Dashboard activation updated successfully' };
  }

  async validateLogin(phoneNumber: string, password: string): Promise<{ success: boolean; user?: any }> {
    try {
      if (!phoneNumber?.trim() || !password) {
        this.logger.warn('Login validation rejected: missing phoneNumber or password');
        return { success: false };
      }

      const user = await this.findByPhoneNumber(phoneNumber);

      const allowedStatuses = [UserStatus.ACTIVE, UserStatus.PENDING_ACTIVATION];
      if (!allowedStatuses.includes(user.status)) {
        this.logger.warn(`Login attempt for inactive user: ${maskPhoneNumber(phoneNumber)} (${user.status})`);
        return { success: false };
      }

      if (user.status === UserStatus.PENDING_ACTIVATION) {
        if (user.activationExpiresAt && user.activationExpiresAt < new Date()) {
          this.logger.warn(`Login attempt after activation expired: ${maskPhoneNumber(phoneNumber)}`);
          return { success: false };
        }
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${maskPhoneNumber(phoneNumber)}`);
        return { success: false };
      }

      const { password: _, ...userWithoutPassword } = user;

      this.logger.log(`Login validated for user: ${maskPhoneNumber(phoneNumber)} (${user.role})`);
      return { success: true, user: userWithoutPassword };
    } catch (error: any) {
      this.logger.error(`Login validation error for ${maskPhoneNumber(phoneNumber)}: ${error.message}`);
      return { success: false };
    }
  }

  // Called by auth-service after OTP verification — bypasses current password check.
  async resetPasswordInternal(id: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    
    // Fix 14: Check password history for password resets too
    const isReused = await this.checkPasswordHistory(user.id, newPassword);
    if (isReused) {
      throw new BadRequestException('New password cannot be the same as any of your last 5 passwords');
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.savePasswordHistory(user.id, hashedPassword);
    
    user.password = hashedPassword;
    await this.userRepository.save(user);
    this.emitPasswordChanged(user);
    this.logger.log(`Password reset (internal) for user: ${maskPhoneNumber(user.phoneNumber)}`);
    return { message: 'Password reset successfully' };
  }

  /**
   * Fix 14: Check if new password matches any of the last 5 password hashes.
   * Returns true if password is reused, false otherwise.
   */
  private async checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
    const history = await this.passwordHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: PASSWORD_HISTORY_LIMIT,
    });

    for (const entry of history) {
      const matches = await bcrypt.compare(newPassword, entry.passwordHash);
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Fix 14: Save new password hash to history and keep only last 5 entries.
   * MEDIUM FIX: Fix N+1 query by using single DELETE instead of fetch + remove
   */
  private async savePasswordHistory(userId: string, passwordHash: string): Promise<void> {
    // Insert new password history entry
    await this.passwordHistoryRepository.save({
      userId,
      passwordHash,
    });

    // MEDIUM FIX: Use single DELETE query instead of fetching and removing individually
    // This fixes the N+1 query issue where each delete was a separate query
    const historyToKeep = await this.passwordHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: PASSWORD_HISTORY_LIMIT,
      select: ['id'],
    });

    const idsToKeep = historyToKeep.map(h => h.id);

    if (idsToKeep.length > 0) {
      await this.passwordHistoryRepository
        .createQueryBuilder()
        .delete()
        .from(PasswordHistory)
        .where('userId = :userId', { userId })
        .andWhere('id NOT IN (:...ids)', { ids: idsToKeep })
        .execute();
    }
  }

  async getPlatformStats(): Promise<{
    total: number;
    active: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({
      where: { status: UserStatus.ACTIVE },
    });

    const roleRows = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany<{ role: string; count: string }>();

    const statusRows = await this.userRepository
      .createQueryBuilder('user')
      .select('user.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.status')
      .getRawMany<{ status: string; count: string }>();

    const byRole: Record<string, number> = {};
    for (const row of roleRows) {
      byRole[row.role] = parseInt(row.count, 10);
    }

    const byStatus: Record<string, number> = {};
    for (const row of statusRows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    return { total, active, byRole, byStatus };
  }

  async findClinicAdminByClinicId(clinicId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { clinicId, role: UserRole.CLINIC_ADMIN },
    });
  }

  async updateClinicId(userId: string, clinicId: string): Promise<void> {
    const user = await this.findOne(userId);
    user.clinicId = clinicId;
    await this.userRepository.save(user);
  }

  private emitPasswordChanged(user: User): void {
    const tenantId = user.tenantId ?? user.clinicId ?? this.tenantContext.getTenantId() ?? undefined;
    const payload = {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      changedAt: new Date().toISOString(),
      tenantId,
      clinicId: tenantId,
    };
    this.kafkaClient.emit(
      KafkaTopics.USER_PASSWORD_CHANGED,
      tenantId ? withTenantEvent(tenantId, payload) : payload,
    );
  }

  private avatarStorageScope(user: User): string {
    if (user.role === UserRole.PATIENT) {
      return GLOBAL_PATIENT_STORAGE_SCOPE;
    }
    return user.tenantId ?? user.clinicId ?? this.tenantContext.getTenantId() ?? GLOBAL_PATIENT_STORAGE_SCOPE;
  }

  private avatarDirForScope(scope: string): string {
    return path.join(process.cwd(), tenantUploadPrefix(scope), 'avatars');
  }

  /**
   * True only when bytes are actually available (DB base64 and/or disk).
   * Do not trust a lone avatarUrl — Railway ephemeral disk often leaves stale URLs.
   */
  userHasAvatar(user: User): boolean {
    const raw = user.profileData || {};
    const data = typeof raw.avatarData === 'string' ? raw.avatarData.trim() : '';
    if (data) return true;
    return this.findExistingAvatarPath(user) != null;
  }

  private canonicalAvatarUrl(userId: string, version?: number): string {
    const v = version ?? Date.now();
    return `/api/users/avatars/${userId}?v=${v}`;
  }

  private ensureAvatarDirForScope(scope: string): void {
    const dir = this.avatarDirForScope(scope);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      const message =
        code === 'EACCES'
          ? `Avatar upload directory is not writable: ${dir}`
          : `Failed to prepare avatar upload directory: ${dir}`;
      this.logger.error(`${message} (${(err as Error).message})`);
      throw new InternalServerErrorException(message);
    }
  }

  private avatarFilePathForUser(user: User, ext: string): string {
    return path.join(this.avatarDirForScope(this.avatarStorageScope(user)), `${user.id}${ext}`);
  }

  private legacyAvatarFilePath(userId: string, ext: string): string {
    return path.join(LEGACY_AVATAR_DIR, `${userId}${ext}`);
  }

  private findExistingAvatarPath(user: User): string | null {
    for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
      const scoped = this.avatarFilePathForUser(user, ext);
      if (fs.existsSync(scoped)) return scoped;
      const legacy = this.legacyAvatarFilePath(user.id, ext);
      if (fs.existsSync(legacy)) return legacy;
    }
    return null;
  }

  async updateAvatar(userId: string, file: UploadedImageFile): Promise<User> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Avatar file is required');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar must be 2 MB or smaller');
    }
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Avatar must be JPEG, PNG, or WebP');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';

    // Best-effort disk cache — never block durable DB persistence on ephemeral FS.
    try {
      this.ensureAvatarDirForScope(this.avatarStorageScope(user));
      const existing = this.findExistingAvatarPath(user);
      const target = this.avatarFilePathForUser(user, ext);
      if (existing && existing !== target) {
        try {
          fs.unlinkSync(existing);
        } catch {
          // ignore cleanup failures
        }
      }
      fs.writeFileSync(target, file.buffer);
    } catch (err) {
      this.logger.warn(
        `Avatar disk write failed for ${userId}; persisting in DB only (${(err as Error).message})`,
      );
    }

    const version = Date.now();
    // Persist bytes in DB so avatars survive Railway container redeploys (ephemeral disk).
    user.profileData = {
      ...(user.profileData || {}),
      avatarUrl: this.canonicalAvatarUrl(userId, version),
      avatarMime: file.mimetype,
      avatarData: file.buffer.toString('base64'),
    };

    const updated = await this.userRepository.save(user);
    this.logger.log(`Avatar updated for user ${userId}`);
    return updated;
  }

  private async assertAvatarAccess(
    targetUserId: string,
    actor: { userId: string; role: string },
  ): Promise<User> {
    if (actor.userId === targetUserId) {
      const self = await this.userRepository.findOne({ where: { id: targetUserId } });
      if (!self) {
        throw new NotFoundException(AVATAR_NOT_FOUND);
      }
      return self;
    }

    if (actor.role === UserRole.SYSTEM_MANAGER) {
      const user = await this.userRepository.findOne({ where: { id: targetUserId } });
      if (!user) {
        throw new NotFoundException(AVATAR_NOT_FOUND);
      }
      return user;
    }

    if (actor.role === UserRole.PATIENT) {
      throw new NotFoundException(AVATAR_NOT_FOUND);
    }

    if (!STAFF_ROLES.has(actor.role)) {
      throw new NotFoundException(AVATAR_NOT_FOUND);
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new NotFoundException(AVATAR_NOT_FOUND);
    }

    const target = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException(AVATAR_NOT_FOUND);
    }

    if (target.role === UserRole.PATIENT) {
      const related = await this.tenantAccess.hasPatientClinicRelation(tenantId, targetUserId);
      if (!related) {
        throw new NotFoundException(AVATAR_NOT_FOUND);
      }
      return target;
    }

    const sameTenantStaff = await this.userRepository.findOne({
      where: tenantFindWhere(tenantId, { id: targetUserId }),
    });
    if (!sameTenantStaff) {
      throw new NotFoundException(AVATAR_NOT_FOUND);
    }
    return sameTenantStaff;
  }

  async readAvatar(
    userId: string,
    actor: { userId: string; role: string },
  ): Promise<{ buffer: Buffer; mime: string }> {
    await this.assertAvatarAccess(userId, actor);
    return this.readAvatarPublic(userId);
  }

  /**
   * Public media fetch for Image.network / <img> tags (no Authorization header).
   * Prefers disk cache, then durable DB-backed avatarData (survives redeploys).
   */
  async readAvatarPublic(userId: string): Promise<{ buffer: Buffer; mime: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(AVATAR_NOT_FOUND);
    }

    const filePath = this.findExistingAvatarPath(user);
    if (filePath) {
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { buffer: fs.readFileSync(filePath), mime };
    }

    const raw = user.profileData || {};
    const data = typeof raw.avatarData === 'string' ? raw.avatarData.trim() : '';
    if (data) {
      const mime =
        typeof raw.avatarMime === 'string' && raw.avatarMime.trim()
          ? raw.avatarMime.trim()
          : 'image/jpeg';
      return { buffer: Buffer.from(data, 'base64'), mime };
    }

    throw new NotFoundException(AVATAR_NOT_FOUND);
  }
}
