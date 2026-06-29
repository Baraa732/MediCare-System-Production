import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
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

  async checkClinicAccess(clinicId: string, userId: string) {
    const tenantId = clinicId;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return { allowed: false, reason: 'CLINIC_NOT_FOUND' };
    if (tenant.status !== TenantStatus.ACTIVE) {
      return { allowed: false, reason: 'CLINIC_NOT_ACTIVE' };
    }

    let assignment = await this.assignmentRepo.findOne({
      where: { tenantId, userId, status: AssignmentStatus.ACTIVE },
    });

    if (!assignment) {
      const repaired = await this.ensureStaffAssignmentForUser(userId, userId);
      if (repaired.assigned && (repaired.tenantId === tenantId || repaired.clinicId === tenantId)) {
        assignment = await this.assignmentRepo.findOne({
          where: { tenantId, userId, status: AssignmentStatus.ACTIVE },
        });
      }
    }

    return assignment
      ? { allowed: true, staffRole: assignment.staffRole }
      : { allowed: false, reason: 'NO_CLINIC_ACCESS' };
  }

  /** Ensures clinic_staff_assignments row exists when user.clinicId is set (repairs legacy accounts). */
  async ensureStaffAssignmentForUser(
    userId: string,
    assignedBy: string,
  ): Promise<{ assigned: boolean; tenantId?: string; clinicId?: string; alreadyExisted?: boolean; reason?: string }> {
    const user = await this.userHttpClient.getUserById(userId);
    const staffRole = USER_ROLE_TO_STAFF_ROLE[user.role];
    if (!staffRole) {
      return { assigned: false, reason: 'ROLE_NOT_STAFF' };
    }

    let tenantId = user.tenantId ?? user.clinicId ?? undefined;
    let tenant = tenantId
      ? await this.tenantRepo.findOne({ where: { id: tenantId } })
      : null;

    if (!tenant) {
      const reconciled = await this.reconcileOrphanClinic(user);
      if (!reconciled) {
        return {
          assigned: false,
          reason: tenantId ? 'CLINIC_NOT_FOUND' : 'NO_CLINIC_ON_USER',
        };
      }
      tenantId = reconciled.id;
      tenant = reconciled;
    }

    const existing = await this.assignmentRepo.findOne({
      where: { tenantId, userId },
    });
    if (existing?.status === AssignmentStatus.ACTIVE) {
      return { assigned: true, tenantId, clinicId: tenantId, alreadyExisted: true };
    }

    await this.upsertAssignment(tenantId, userId, staffRole, assignedBy);

    this.kafkaClient.emit(
      KafkaTopics.CLINIC_STAFF_ASSIGNED,
      withTenantEvent(tenantId, {
        tenantId,
        clinicId: tenantId,
        userId,
        staffRole,
        assignedBy,
      }),
    );

    return { assigned: true, tenantId, clinicId: tenantId };
  }

  /**
   * Repairs users pointing at a missing clinic row (e.g. after DB reset).
   * Clinic admins: re-link or re-provision from their used activation code.
   * Staff: reconcile via their clinic admin first, then inherit the real clinic id.
   */
  private async reconcileOrphanClinic(user: {
    id: string;
    role: string;
    tenantId?: string | null;
    clinicId?: string | null;
    phoneNumber?: string;
  }): Promise<Tenant | null> {
    const userTenantId = user.tenantId ?? user.clinicId ?? null;
    if (user.role === 'CLINIC_ADMIN' && user.phoneNumber) {
      let tenant = await this.tenantRepo.findOne({
        where: { adminPhoneNumber: user.phoneNumber },
      });

      if (!tenant) {
        const activation = await this.systemManagerHttp.lookupUsedActivationByPhone(user.phoneNumber);
        if (activation.found && activation.activationCodeId && activation.adminPhoneNumber) {
          tenant = await this.provisionFromActivation({
            activationCodeId: activation.activationCodeId,
            adminPhoneNumber: activation.adminPhoneNumber,
            clinicLocation: activation.clinicLocation || 'Clinic',
            adminFullName: activation.adminFullName || 'Clinic Admin',
            generatedBy: activation.generatedBy,
          });
        }
      }

      if (tenant) {
        if (userTenantId !== tenant.id) {
          await this.userHttpClient.updateClinicId(user.id, tenant.id);
        }
        if (!tenant.adminUserId) {
          tenant.adminUserId = user.id;
          await this.tenantRepo.save(tenant);
        }
        await this.upsertAssignment(tenant.id, user.id, StaffRole.CLINIC_ADMIN, user.id);
        return tenant;
      }
    }

    if (userTenantId && user.role !== 'CLINIC_ADMIN') {
      const admin = await this.userHttpClient.findClinicAdminByClinicId(userTenantId);
      if (admin && admin.id !== user.id) {
        const adminTenant = await this.reconcileOrphanClinic(admin);
        if (adminTenant) {
          if (userTenantId !== adminTenant.id) {
            await this.userHttpClient.updateClinicId(user.id, adminTenant.id);
          }
          return adminTenant;
        }
      }
    }

    return null;
  }

  /** Resolve the primary clinic for a staff member (assignments are source of truth). */
  async resolveStaffTenant(userId: string): Promise<{ tenantId?: string; clinicId?: string; source?: string }> {
    const assignments = await this.assignmentRepo.find({
      where: { userId, status: AssignmentStatus.ACTIVE },
      order: { assignedAt: 'ASC' },
    });
    if (assignments.length > 0) {
      const tenantId = assignments[0].tenantId;
      return { tenantId, clinicId: tenantId, source: 'assignment' };
    }

    const repaired = await this.ensureStaffAssignmentForUser(userId, userId);
    if (repaired.assigned && repaired.tenantId) {
      return { tenantId: repaired.tenantId, clinicId: repaired.tenantId, source: 'repaired' };
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

    return this.listStaffInternal(clinicId, role);
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
    if (assignments.length === 0) {
      await this.ensureStaffAssignmentForUser(userId, userId);
      assignments = await this.assignmentRepo.find({ where });
    }
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

    assignment.status = AssignmentStatus.INACTIVE;
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
      timezone: tenant.timezone,
      status: tenant.status,
      subscriptionPlan: tenant.subscriptionPlan,
      adminUserId: tenant.adminUserId,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  private async upsertAssignment(
    tenantId: string,
    userId: string,
    staffRole: StaffRole,
    assignedBy: string,
  ): Promise<TenantStaffAssignment> {
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
      existing.status = AssignmentStatus.ACTIVE;
      existing.staffRole = staffRole;
      existing.assignedBy = assignedBy;
      return this.assignmentRepo.save(existing);
    }

    const assignment = this.assignmentRepo.create({
      tenantId,
      userId,
      staffRole,
      assignedBy,
      status: AssignmentStatus.ACTIVE,
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

    let assignment = await this.assignmentRepo.findOne({
      where: { tenantId, userId: actor.userId, status: AssignmentStatus.ACTIVE },
    });

    if (!assignment) {
      const repaired = await this.ensureStaffAssignmentForUser(actor.userId, actor.userId);
      if (repaired.assigned && (repaired.tenantId === tenantId || repaired.clinicId === tenantId)) {
        assignment = await this.assignmentRepo.findOne({
          where: { tenantId, userId: actor.userId, status: AssignmentStatus.ACTIVE },
        });
      }
    }

    if (!assignment) {
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
