import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import {
  TenantStaffAssignment,
  StaffRole,
  AssignmentStatus,
} from '../entities/tenant-staff-assignment.entity';
import {
  CreateClinicDto,
  UpdateClinicDto,
  AssignStaffDto,
  AssignStaffInternalDto,
  ProvisionFromActivationDto,
  LinkClinicAdminDto,
} from '../dto/clinic.dto';
import { UserHttpClient } from './user-http.client';
import { SchedulingHttpClient } from './scheduling-http.client';
import { SystemManagerHttpClient } from './system-manager-http.client';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';

export interface AuthUser {
  userId: string;
  role: string;
  tenantId?: string;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `tenant-${Date.now()}`;
}

const STAFF_ROLE_TO_USER_ROLE: Record<StaffRole, string> = {
  [StaffRole.CLINIC_ADMIN]: 'CLINIC_ADMIN',
  [StaffRole.DOCTOR]: 'DOCTOR',
  [StaffRole.SECRETARY]: 'SECRETARY',
};

const USER_ROLE_TO_STAFF_ROLE: Record<string, StaffRole> = {
  CLINIC_ADMIN: StaffRole.CLINIC_ADMIN,
  DOCTOR: StaffRole.DOCTOR,
  SECRETARY: StaffRole.SECRETARY,
};

const LOGO_DIR =
  process.env.CLINIC_LOGO_UPLOAD_DIR ||
  path.join(process.cwd(), 'uploads', 'clinic-logos');
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UploadedImageFile = { buffer: Buffer; size: number; mimetype: string };

@Injectable()
export class ClinicService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantStaffAssignment)
    private readonly assignmentRepo: Repository<TenantStaffAssignment>,
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientProxy,
    private readonly userHttpClient: UserHttpClient,
    private readonly schedulingHttp: SchedulingHttpClient,
    private readonly systemManagerHttp: SystemManagerHttpClient,
  ) {}

  /**
   * Manual clinic creation — SYSTEM_MANAGER only.
   * Clinic admins receive their clinic automatically via activation code provisioning.
   */
  async create(dto: CreateClinicDto, actor: AuthUser): Promise<Tenant> {
    if (actor.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can create clinics manually');
    }

    const tenant = this.tenantRepo.create({
      ...dto,
      slug: slugify(dto.name),
      timezone: dto.timezone || 'Asia/Damascus',
      status: TenantStatus.ACTIVE,
      subscriptionPlan: 'standard',
    });
    const saved = await this.tenantRepo.save(tenant);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_CREATED,
      withTenantEvent(saved.id, {
        tenantId: saved.id,
        clinicId: saved.id,
        name: saved.name,
        status: saved.status,
        createdBy: actor.userId,
        source: 'manual',
      }),
    );

    return saved;
  }

  /**
   * Provision a clinic when a clinic-admin activation code is validated.
   * Idempotent — safe to retry for the same activationCodeId.
   */
  async provisionFromActivation(dto: ProvisionFromActivationDto): Promise<Tenant> {
    const byActivation = await this.tenantRepo.findOne({
      where: { activationCodeId: dto.activationCodeId },
    });
    if (byActivation) return byActivation;

    const byPhone = await this.tenantRepo.findOne({
      where: { adminPhoneNumber: dto.adminPhoneNumber },
    });
    if (byPhone) return byPhone;

    const tenant = this.tenantRepo.create({
      name: dto.clinicLocation,
      slug: slugify(dto.clinicLocation),
      address: dto.clinicLocation,
      phone: dto.adminPhoneNumber,
      description: `Clinic for ${dto.adminFullName}`,
      timezone: 'Asia/Damascus',
      status: TenantStatus.ACTIVE,
      subscriptionPlan: 'standard',
      activationCodeId: dto.activationCodeId,
      adminPhoneNumber: dto.adminPhoneNumber,
    });
    const saved = await this.tenantRepo.save(tenant);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_CREATED,
      withTenantEvent(saved.id, {
        tenantId: saved.id,
        clinicId: saved.id,
        name: saved.name,
        status: saved.status,
        activationCodeId: dto.activationCodeId,
        adminPhoneNumber: dto.adminPhoneNumber,
        source: 'activation_code',
      }),
    );

    return saved;
  }

  /**
   * Link a registered CLINIC_ADMIN user to the clinic provisioned for their phone.
   */
  async linkClinicAdmin(dto: LinkClinicAdminDto): Promise<{ clinicId: string; tenantId: string }> {
    const clinic = await this.tenantRepo.findOne({
      where: { adminPhoneNumber: dto.phoneNumber },
    });
    if (!clinic) {
      throw new NotFoundException(
        'No clinic found for this phone number. Activate your dashboard code first.',
      );
    }

    clinic.adminUserId = dto.userId;
    await this.tenantRepo.save(clinic);

    await this.upsertAssignment(clinic.id, dto.userId, StaffRole.CLINIC_ADMIN, dto.userId);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_STAFF_ASSIGNED,
      withTenantEvent(clinic.id, {
        tenantId: clinic.id,
        clinicId: clinic.id,
        userId: dto.userId,
        staffRole: StaffRole.CLINIC_ADMIN,
        source: 'registration',
      }),
    );

    return { clinicId: clinic.id, tenantId: clinic.id };
  }

  async verifyStaffAssignment(clinicId: string, userId: string, staffRole: StaffRole) {
    const tenantId = clinicId;
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId, status: TenantStatus.ACTIVE },
    });
    if (!tenant) return { valid: false, reason: 'CLINIC_NOT_FOUND_OR_INACTIVE' };

    const assignment = await this.assignmentRepo.findOne({
      where: { tenantId, userId, staffRole, status: AssignmentStatus.ACTIVE },
    });
    return assignment
      ? { valid: true }
      : { valid: false, reason: 'STAFF_NOT_ASSIGNED' };
  }

  async findByIdInternal(clinicId: string): Promise<Tenant> {
    const clinic = await this.tenantRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  async checkClinicAccess(clinicId: string, userId: string, expectedRole?: string) {
    const tenantId = clinicId;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return { allowed: false, reason: 'CLINIC_NOT_FOUND' };
    if (tenant.status !== TenantStatus.ACTIVE) {
      return { allowed: false, reason: 'CLINIC_NOT_ACTIVE' };
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { tenantId, userId, status: AssignmentStatus.ACTIVE },
    });

    if (!assignment) {
      return { allowed: false, reason: 'NO_CLINIC_ACCESS' };
    }

    if (expectedRole) {
      const expectedStaffRole = USER_ROLE_TO_STAFF_ROLE[expectedRole];
      if (!expectedStaffRole || assignment.staffRole !== expectedStaffRole) {
        return { allowed: false, reason: 'ROLE_MISMATCH' };
      }
    }

    return { allowed: true, staffRole: assignment.staffRole };
  }

  /**
   * Read-only membership lookup — does not create or repair assignments.
   * @deprecated Prefer resolveStaffTenant or checkClinicAccess for authorization.
   */
  async ensureStaffAssignmentForUser(
    userId: string,
    _assignedBy: string,
    hints?: { clinicId?: string; staffRole?: StaffRole },
  ): Promise<{ assigned: boolean; tenantId?: string; clinicId?: string; alreadyExisted?: boolean; reason?: string }> {
    const where: Record<string, unknown> = {
      userId,
      status: AssignmentStatus.ACTIVE,
    };
    if (hints?.clinicId) where.tenantId = hints.clinicId;
    if (hints?.staffRole) where.staffRole = hints.staffRole;

    const assignment = await this.assignmentRepo.findOne({ where });
    if (!assignment) {
      return { assigned: false, reason: 'NO_ACTIVE_ASSIGNMENT' };
    }

    return {
      assigned: true,
      tenantId: assignment.tenantId,
      clinicId: assignment.tenantId,
      alreadyExisted: true,
    };
  }

  /** Links a staff user to a clinic membership (idempotent). Never mutates users.tenant_id. */
  async assignStaffInternal(
    dto: AssignStaffInternalDto,
  ): Promise<{ assigned: boolean; tenantId?: string; clinicId?: string; alreadyExisted?: boolean; reason?: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: dto.clinicId } });
    if (!tenant) {
      return { assigned: false, reason: 'CLINIC_NOT_FOUND' };
    }

    const user = await this.userHttpClient.getUserById(dto.userId);
    const expectedUserRole = STAFF_ROLE_TO_USER_ROLE[dto.staffRole];
    if (user.role !== expectedUserRole) {
      return {
        assigned: false,
        reason: `ROLE_MISMATCH:${user.role}`,
      };
    }

    const existing = await this.assignmentRepo.findOne({
      where: { tenantId: dto.clinicId, userId: dto.userId },
    });
    if (existing?.status === AssignmentStatus.ACTIVE && existing.staffRole === dto.staffRole) {
      return {
        assigned: true,
        tenantId: dto.clinicId,
        clinicId: dto.clinicId,
        alreadyExisted: true,
      };
    }

    const membershipStatus =
      user.status === 'PENDING_ACTIVATION' ? AssignmentStatus.PENDING : AssignmentStatus.ACTIVE;

    await this.upsertAssignment(
      dto.clinicId,
      dto.userId,
      dto.staffRole,
      dto.assignedBy,
      membershipStatus,
    );

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_STAFF_ASSIGNED,
      withTenantEvent(dto.clinicId, {
        tenantId: dto.clinicId,
        clinicId: dto.clinicId,
        userId: dto.userId,
        staffRole: dto.staffRole,
        assignedBy: dto.assignedBy,
        status: membershipStatus,
      }),
    );

    return { assigned: true, tenantId: dto.clinicId, clinicId: dto.clinicId };
  }

  /** Activates all PENDING memberships after staff completes platform activation. */
  async activatePendingMembershipsForUser(userId: string): Promise<{ activated: number }> {
    const pending = await this.assignmentRepo.find({
      where: { userId, status: AssignmentStatus.PENDING },
    });
    if (pending.length === 0) {
      return { activated: 0 };
    }

    const now = new Date();
    for (const assignment of pending) {
      assignment.status = AssignmentStatus.ACTIVE;
      assignment.startedAt = assignment.startedAt ?? now;
      assignment.endedAt = null;
      await this.assignmentRepo.save(assignment);
    }

    return { activated: pending.length };
  }

  /** Resolve JWT tenant from assignments; falls back to deprecated users.tenant_id for legacy rows. */
  async resolveStaffTenant(userId: string): Promise<{ tenantId?: string; clinicId?: string; source?: string }> {
    const primary = await this.assignmentRepo.findOne({
      where: { userId, status: AssignmentStatus.ACTIVE, isPrimary: true },
    });
    if (primary) {
      return { tenantId: primary.tenantId, clinicId: primary.tenantId, source: 'primary' };
    }

    const assignments = await this.assignmentRepo.find({
      where: { userId, status: AssignmentStatus.ACTIVE },
      order: { startedAt: 'ASC', assignedAt: 'ASC' },
    });
    if (assignments.length > 0) {
      const tenantId = assignments[0].tenantId;
      return { tenantId, clinicId: tenantId, source: 'assignment' };
    }

    const user = await this.userHttpClient.getUserById(userId);
    const legacyTenantId = user.tenantId ?? user.clinicId;
    if (legacyTenantId) {
      return {
        tenantId: legacyTenantId,
        clinicId: legacyTenantId,
        source: 'legacy_user_tenant_id',
      };
    }

    return {};
  }

  /** @deprecated use resolveStaffTenant */
  async resolveStaffClinic(userId: string): Promise<{ clinicId?: string; source?: string }> {
    const r = await this.resolveStaffTenant(userId);
    return { clinicId: r.tenantId ?? r.clinicId, source: r.source };
  }

  async findAll(actor: AuthUser, status?: TenantStatus): Promise<Tenant[]> {
    if (actor.role === 'SYSTEM_MANAGER') {
      const where = status ? { status } : {};
      return this.tenantRepo.find({ where, order: { name: 'ASC' } });
    }

    if (actor.role === 'PATIENT') {
      return this.tenantRepo.find({
        where: { status: TenantStatus.ACTIVE },
        order: { name: 'ASC' },
      });
    }

    const assignments = await this.assignmentRepo.find({
      where: { userId: actor.userId, status: AssignmentStatus.ACTIVE },
    });
    if (assignments.length === 0) return [];

    const tenantIds = assignments.map((a) => a.tenantId);
    const qb = this.tenantRepo
      .createQueryBuilder('tenant')
      .where('tenant.id IN (:...tenantIds)', { tenantIds })
      .orderBy('tenant.name', 'ASC');

    if (status) {
      qb.andWhere('tenant.status = :status', { status });
    }

    return qb.getMany();
  }

  async search(
    actor: AuthUser,
    filters: { q?: string; city?: string; governorate?: string; specialization?: string },
    page = 1,
    limit = 20,
  ): Promise<{ clinics: Tenant[]; total: number; page: number; limit: number }> {
    if (actor.role !== 'PATIENT' && actor.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Clinic search is for patients and system managers');
    }

    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const qb = this.tenantRepo.createQueryBuilder('tenant');

    if (actor.role === 'PATIENT') {
      qb.where('tenant.status = :active', { active: TenantStatus.ACTIVE });
    } else if (filters.q || filters.city || filters.governorate) {
      qb.where('1=1');
    } else {
      qb.where('1=1');
    }

    if (filters.q?.trim()) {
      const term = `%${filters.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(tenant.name) LIKE :term OR LOWER(tenant.description) LIKE :term OR LOWER(tenant.address) LIKE :term)',
        { term },
      );
    }
    if (filters.city?.trim()) {
      qb.andWhere('LOWER(tenant.city) LIKE :city', {
        city: `%${filters.city.trim().toLowerCase()}%`,
      });
    }
    if (filters.governorate?.trim()) {
      qb.andWhere('LOWER(tenant.governorate) LIKE :gov', {
        gov: `%${filters.governorate.trim().toLowerCase()}%`,
      });
    }

    if (filters.specialization?.trim()) {
      const doctorIds = await this.userHttpClient.searchDoctorIds({
        specialization: filters.specialization,
        q: filters.q,
      });
      if (doctorIds.length === 0) {
        return { clinics: [], total: 0, page: Math.max(page, 1), limit: take };
      }
      const assignments = await this.assignmentRepo.find({
        where: {
          userId: In(doctorIds),
          staffRole: StaffRole.DOCTOR,
          status: AssignmentStatus.ACTIVE,
        },
      });
      const tenantIds = [...new Set(assignments.map((a) => a.tenantId))];
      if (tenantIds.length === 0) {
        return { clinics: [], total: 0, page: Math.max(page, 1), limit: take };
      }
      qb.andWhere('tenant.id IN (:...tenantIds)', { tenantIds });
    }

    qb.orderBy('tenant.name', 'ASC');
    const [clinics, total] = await qb.skip(skip).take(take).getManyAndCount();
    return { clinics, total, page: Math.max(page, 1), limit: take };
  }

  async getClinicProfile(id: string, actor: AuthUser) {
    const clinic = await this.findOne(id, actor);
    const doctors = await this.listDoctorsEnriched(id, actor);
    const hours = await this.schedulingHttp.getClinicHours(id);
    return {
      clinic: this.toPublicClinic(clinic),
      doctors,
      hours,
    };
  }

  async findOne(id: string, actor: AuthUser): Promise<Tenant> {
    const clinic = await this.tenantRepo.findOne({ where: { id } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    await this.assertCanAccessClinic(id, actor);
    return clinic;
  }

  async update(id: string, dto: UpdateClinicDto, actor: AuthUser): Promise<Tenant> {
    const tenant = await this.findOne(id, actor);
    await this.assertCanManageTenant(id, actor);

    Object.assign(tenant, dto);
    const updated = await this.tenantRepo.save(tenant);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_UPDATED,
      withTenantEvent(updated.id, {
        tenantId: updated.id,
        clinicId: updated.id,
        name: updated.name,
        status: updated.status,
        updatedBy: actor.userId,
      }),
    );

    return updated;
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const tenant = await this.findOne(id, actor);
    await this.assertCanManageTenant(id, actor);

    tenant.status = TenantStatus.SUSPENDED;
    await this.tenantRepo.save(tenant);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_DELETED,
      withTenantEvent(tenant.id, {
        tenantId: tenant.id,
        clinicId: tenant.id,
        deletedBy: actor.userId,
      }),
    );
  }

  async listStaff(clinicId: string, actor: AuthUser, role?: StaffRole) {
    await this.assertCanAccessClinic(clinicId, actor);

    return this.listStaffEnriched(clinicId, role);
  }

  async listStaffEnriched(clinicId: string, role?: StaffRole) {
    const assignments = await this.listStaffInternal(clinicId, role);
    if (assignments.length === 0) return [];

    const profiles = await this.userHttpClient.getClinicStaffProfiles(
      assignments.map((a) => a.userId),
    );
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return assignments.map((a) => {
      const profile = profileMap.get(a.userId);
      return {
        userId: a.userId,
        clinicId,
        staffRole: a.staffRole,
        status: profile?.status ?? a.status,
        assignmentStatus: a.status,
        assignedAt: a.assignedAt,
        assignedBy: a.assignedBy,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        fullName: profile?.fullName,
        phoneNumber: profile?.phoneNumber,
        email: profile?.email,
        username: profile?.username,
        specialization: profile?.specialization,
        licenseNumber: profile?.licenseNumber,
        gender: profile?.gender,
        yearsOfExperience: profile?.yearsOfExperience,
        governorate: profile?.governorate,
        state: profile?.state,
        streetInfo: profile?.streetInfo,
        birthDate: profile?.birthDate,
        nationalId: profile?.nationalId,
        maritalStatus: profile?.maritalStatus,
        languages: profile?.languages,
        department: profile?.department,
        shift: profile?.shift,
        userRole: profile?.role,
        createdAt: profile?.createdAt,
      };
    });
  }

  /** Internal service-to-service — no user actor required. */
  async listStaffInternal(clinicId: string, role?: StaffRole) {
    const tenantId = clinicId;
    const where: Record<string, unknown> = {
      tenantId,
      status: AssignmentStatus.ACTIVE,
    };
    if (role) where.staffRole = role;

    const assignments = await this.assignmentRepo.find({
      where,
      order: { assignedAt: 'ASC' },
    });

    return assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      staffRole: a.staffRole,
      status: a.status,
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy,
    }));
  }

  async listDoctors(clinicId: string, actor: AuthUser) {
    return this.listDoctorsEnriched(clinicId, actor);
  }

  async listDoctorsEnriched(clinicId: string, actor: AuthUser) {
    const staff = await this.listStaff(clinicId, actor, StaffRole.DOCTOR);
    if (staff.length === 0) return [];

    const profiles = await this.userHttpClient.getPublicDoctors(staff.map((s) => s.userId));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return staff.map((s) => {
      const profile = profileMap.get(s.userId);
      return {
        ...s,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        fullName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : undefined,
        specialization: profile?.specialization,
        profile: profile?.profile,
      };
    });
  }

  /** All clinics where a user is assigned — supports multi-clinic doctors. */
  async listClinicsForUser(userId: string, actor: AuthUser, staffRole?: StaffRole) {
    if (actor.role !== 'SYSTEM_MANAGER' && actor.userId !== userId) {
      throw new ForbiddenException('You can only view your own clinic assignments');
    }

    const where: Record<string, unknown> = {
      userId,
      status: AssignmentStatus.ACTIVE,
    };
    if (staffRole) where.staffRole = staffRole;

    let assignments = await this.assignmentRepo.find({ where });
    if (assignments.length === 0) return [];

    const tenantIds = assignments.map((a) => a.tenantId);
    const clinics = await this.tenantRepo.find({
      where: { id: In(tenantIds) },
      order: { name: 'ASC' },
    });

    return clinics.map((clinic) => {
      const assignment = assignments.find((a) => a.tenantId === clinic.id);
      return {
        ...this.toPublicClinic(clinic),
        staffRole: assignment?.staffRole,
        assignmentId: assignment?.id,
      };
    });
  }

  async assignStaff(clinicId: string, dto: AssignStaffDto, actor: AuthUser) {
    const tenantId = clinicId;
    await this.assertCanManageTenant(tenantId, actor);

    const user = await this.userHttpClient.getUserById(dto.userId);
    const expectedUserRole = STAFF_ROLE_TO_USER_ROLE[dto.staffRole];
    if (user.role !== expectedUserRole) {
      throw new BadRequestException(
        `User role ${user.role} does not match staff role ${dto.staffRole}`,
      );
    }

    const assignment = await this.upsertAssignment(
      tenantId,
      dto.userId,
      dto.staffRole,
      actor.userId,
    );

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_STAFF_ASSIGNED,
      withTenantEvent(tenantId, {
        tenantId,
        clinicId: tenantId,
        userId: dto.userId,
        staffRole: dto.staffRole,
        assignedBy: actor.userId,
      }),
    );

    return {
      id: assignment.id,
      clinicId: assignment.tenantId,
      tenantId: assignment.tenantId,
      userId: assignment.userId,
      staffRole: assignment.staffRole,
      status: assignment.status,
      assignedAt: assignment.assignedAt,
    };
  }

  async removeStaff(clinicId: string, userId: string, actor: AuthUser) {
    const tenantId = clinicId;
    await this.assertCanManageTenant(tenantId, actor);

    const assignment = await this.assignmentRepo.findOne({ where: { tenantId, userId } });
    if (!assignment) throw new NotFoundException('Staff assignment not found');

    if (assignment.staffRole === StaffRole.CLINIC_ADMIN) {
      const adminCount = await this.assignmentRepo.count({
        where: {
          tenantId,
          staffRole: StaffRole.CLINIC_ADMIN,
          status: AssignmentStatus.ACTIVE,
        },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last clinic admin from a clinic');
      }
    }

    assignment.status = AssignmentStatus.ENDED;
    assignment.endedAt = new Date();
    await this.assignmentRepo.save(assignment);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_STAFF_REMOVED,
      withTenantEvent(tenantId, {
        tenantId,
        clinicId: tenantId,
        userId,
        staffRole: assignment.staffRole,
        removedBy: actor.userId,
      }),
    );

    return { success: true };
  }

  toPublicClinic(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      address: tenant.address,
      city: tenant.city,
      governorate: tenant.governorate,
      phone: tenant.phone,
      email: tenant.email,
      logoUrl: tenant.logoUrl,
      timezone: tenant.timezone,
      status: tenant.status,
      subscriptionPlan: tenant.subscriptionPlan,
      adminUserId: tenant.adminUserId,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  private ensureLogoDir(): void {
    if (!fs.existsSync(LOGO_DIR)) {
      fs.mkdirSync(LOGO_DIR, { recursive: true });
    }
  }

  private logoFilePath(tenantId: string, ext: string): string {
    return path.join(LOGO_DIR, `${tenantId}${ext}`);
  }

  private findExistingLogoPath(tenantId: string): string | null {
    for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
      const candidate = this.logoFilePath(tenantId, ext);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  async updateLogo(
    id: string,
    file: UploadedImageFile,
    actor: AuthUser,
  ): Promise<Tenant> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Logo file is required');
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('Logo must be 2 MB or smaller');
    }
    if (!LOGO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Logo must be JPEG, PNG, or WebP');
    }

    const tenant = await this.findOne(id, actor);
    await this.assertCanManageTenant(id, actor);
    this.ensureLogoDir();

    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';

    const existing = this.findExistingLogoPath(id);
    if (existing && existing !== this.logoFilePath(id, ext)) {
      fs.unlinkSync(existing);
    }

    fs.writeFileSync(this.logoFilePath(id, ext), file.buffer);

    const version = Date.now();
    tenant.logoUrl = `/api/clinics/logos/${id}?v=${version}`;
    return this.tenantRepo.save(tenant);
  }

  async readLogo(tenantId: string): Promise<{ buffer: Buffer; mime: string }> {
    const filePath = this.findExistingLogoPath(tenantId);
    if (!filePath) {
      throw new NotFoundException('Clinic logo not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { buffer: fs.readFileSync(filePath), mime };
  }

  private async upsertAssignment(
    tenantId: string,
    userId: string,
    staffRole: StaffRole,
    assignedBy: string,
    status: AssignmentStatus = AssignmentStatus.ACTIVE,
  ): Promise<TenantStaffAssignment> {
    const now = new Date();
    const existing = await this.assignmentRepo.findOne({ where: { tenantId, userId } });

    if (existing) {
      if (existing.status === AssignmentStatus.ACTIVE && existing.staffRole === staffRole) {
        throw new ConflictException('User is already assigned to this clinic with this role');
      }
      if (existing.status === AssignmentStatus.ACTIVE && existing.staffRole !== staffRole) {
        throw new ConflictException(
          `User is already assigned as ${existing.staffRole}. Remove the assignment first.`,
        );
      }
      existing.status = status;
      existing.staffRole = staffRole;
      existing.assignedBy = assignedBy;
      if (status === AssignmentStatus.ACTIVE) {
        existing.startedAt = existing.startedAt ?? now;
        existing.endedAt = null;
      }
      return this.assignmentRepo.save(existing);
    }

    const activeCount = await this.assignmentRepo.count({
      where: { userId, status: AssignmentStatus.ACTIVE },
    });

    const assignment = this.assignmentRepo.create({
      tenantId,
      userId,
      staffRole,
      assignedBy,
      status,
      isPrimary: activeCount === 0 && status === AssignmentStatus.ACTIVE,
      startedAt: status === AssignmentStatus.ACTIVE ? now : null,
      endedAt: null,
    });

    try {
      return await this.assignmentRepo.save(assignment);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('User is already assigned to this clinic');
      }
      throw err;
    }
  }

  private async assertCanAccessTenant(tenantId: string, actor: AuthUser): Promise<void> {
    if (actor.role === 'SYSTEM_MANAGER' || actor.role === 'PATIENT') return;

    const assignment = await this.assignmentRepo.findOne({
      where: { tenantId, userId: actor.userId, status: AssignmentStatus.ACTIVE },
    });

    if (!assignment) {
      throw new ForbiddenException('You do not have access to this clinic');
    }

    const expectedStaffRole = USER_ROLE_TO_STAFF_ROLE[actor.role];
    if (expectedStaffRole && assignment.staffRole !== expectedStaffRole) {
      throw new ForbiddenException('You do not have access to this clinic');
    }
  }

  /** @deprecated public API alias */
  private async assertCanAccessClinic(clinicId: string, actor: AuthUser): Promise<void> {
    return this.assertCanAccessTenant(clinicId, actor);
  }

  private async assertCanManageTenant(tenantId: string, actor: AuthUser): Promise<void> {
    if (actor.role === 'SYSTEM_MANAGER') return;

    const assignment = await this.assignmentRepo.findOne({
      where: {
        tenantId,
        userId: actor.userId,
        staffRole: StaffRole.CLINIC_ADMIN,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (!assignment) {
      throw new ForbiddenException('Only clinic admins can manage this clinic');
    }
  }

  /** @deprecated public API alias */
  private async assertCanManageClinic(clinicId: string, actor: AuthUser): Promise<void> {
    return this.assertCanManageTenant(clinicId, actor);
  }
}
