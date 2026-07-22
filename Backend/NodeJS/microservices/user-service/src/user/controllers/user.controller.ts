import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Request, UseGuards, UseInterceptors, UploadedFile,
  ForbiddenException, HttpCode, HttpStatus,
  UnauthorizedException, BadRequestException, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { InternalRouteAllow } from '../../internal-auth-shared/internal-route-allow.decorator';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UpdateUserStatusDto, ValidateLoginDto } from '../dto/user.dto';
import { CreateUserByAdminDto } from '../dto/create-user-by-admin.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { User } from '../entities/user.entity';
import { rethrowIfRegistrationError } from '../../common/errors/registration.errors';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { SkipTenantGuard } from '../../tenant-shared/tenant.decorators';
import { PhiAuditPublisherService } from '../../phi-audit-shared/phi-audit.publisher';
import { buildPhiAuditContextFromRequest } from '../../phi-audit-shared/phi-audit-context';
import {
  PhiAuditAction,
  PhiAuditResourceType,
} from '../../phi-audit-shared/types';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { HttpTenantAccessChecker } from '../../tenant-shared/tenant-access-checker';

// Internal endpoints (validate-login, reset-password-internal) are defined in
// InternalUserController below — they must NOT inherit the class-level JwtAuthGuard.
// LOW FIX: Add API versioning
@Controller('v1/users')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly phiAudit: PhiAuditPublisherService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccess: HttpTenantAccessChecker,
  ) {}

  // Internal-only: create user — restricted to SYSTEM_MANAGER and CLINIC_ADMIN
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { id: user.id, phoneNumber: user.phoneNumber, role: user.role, status: user.status };
  }

  // Paginated — page/limit query params, SYSTEM_MANAGER only
  @Get()
  @SkipTenantGuard()
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async findAll(
    @Query() filters: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = Math.min(parseInt(limit, 10) || 20, 100); // cap at 100
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const users = await this.userService.findAll({ ...filters, take, skip });
    return users.map(u => ({
      id: u.id, phoneNumber: u.phoneNumber, firstName: u.firstName,
      lastName: u.lastName, role: u.role, status: u.status,
      clinicId: u.clinicId, createdAt: u.createdAt,
    }));
  }

  @Get('phone/:phoneNumber')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  async findByPhoneNumber(@Param('phoneNumber') phoneNumber: string, @Request() req) {
    const user = await this.userService.findByPhoneNumber(phoneNumber);
    this.phiAudit.emit({
      ...buildPhiAuditContextFromRequest(req, this.tenantContext),
      action: PhiAuditAction.PATIENT_LOOKUP_PHONE,
      resourceType: PhiAuditResourceType.PATIENT,
      resourceId: user.id,
      success: true,
      classification: 'phi',
    });
    return {
      id: user.id, phoneNumber: user.phoneNumber, firstName: user.firstName,
      lastName: user.lastName, role: user.role, status: user.status,
      isDashboardActivated: user.isDashboardActivated,
    };
  }

  @Get('lookup/patient/:phoneNumber')
  @UseGuards(RolesGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  async lookupPatient(@Param('phoneNumber') phoneNumber: string, @Request() req) {
    const notFoundMessage = 'No patient account found for this phone number';

    let user: User;
    try {
      user = await this.userService.findByPhoneNumber(phoneNumber);
    } catch {
      this.phiAudit.emit({
        ...buildPhiAuditContextFromRequest(req, this.tenantContext),
        action: PhiAuditAction.PATIENT_LOOKUP_PHONE,
        resourceType: PhiAuditResourceType.PATIENT,
        success: false,
        classification: 'phi',
      });
      throw new NotFoundException(notFoundMessage);
    }

    if (user.role !== 'PATIENT') {
      this.phiAudit.emit({
        ...buildPhiAuditContextFromRequest(req, this.tenantContext),
        action: PhiAuditAction.PATIENT_LOOKUP_PHONE,
        resourceType: PhiAuditResourceType.PATIENT,
        success: false,
        classification: 'phi',
      });
      throw new NotFoundException(notFoundMessage);
    }

    if (req.user.role !== 'SYSTEM_MANAGER') {
      const clinicId =
        this.tenantContext.getTenantId() ?? req.user.tenantId ?? req.user.clinicId;
      if (!clinicId) {
        this.phiAudit.emit({
          ...buildPhiAuditContextFromRequest(req, this.tenantContext),
          action: PhiAuditAction.PATIENT_LOOKUP_PHONE,
          resourceType: PhiAuditResourceType.PATIENT,
          resourceId: user.id,
          success: false,
          classification: 'phi',
        });
        throw new NotFoundException(notFoundMessage);
      }

      const related = await this.tenantAccess.hasPatientClinicRelation(clinicId, user.id);
      if (!related) {
        this.phiAudit.emit({
          ...buildPhiAuditContextFromRequest(req, this.tenantContext),
          action: PhiAuditAction.PATIENT_LOOKUP_PHONE,
          resourceType: PhiAuditResourceType.PATIENT,
          resourceId: user.id,
          success: false,
          classification: 'phi',
        });
        throw new NotFoundException(notFoundMessage);
      }
    }

    this.phiAudit.emit({
      ...buildPhiAuditContextFromRequest(req, this.tenantContext),
      action: PhiAuditAction.PATIENT_LOOKUP_PHONE,
      resourceType: PhiAuditResourceType.PATIENT,
      resourceId: user.id,
      success: true,
      classification: 'phi',
    });
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      status: user.status,
    };
  }

  @Get('avatars/:userId')
  async getAvatar(@Param('userId') userId: string, @Request() req) {
    const { buffer, mime } = await this.userService.readAvatar(userId, {
      userId: req.user.userId,
      role: req.user.role,
    });
    return new StreamableFile(buffer, {
      type: mime,
      disposition: 'inline',
    });
  }

  @Get(':id')
  @SkipTenantGuard()
  async findOne(@Param('id') id: string, @Request() req) {
    if (req.user.userId !== id && !['SYSTEM_MANAGER', 'CLINIC_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Not authorized');
    }
    const forSelf = req.user.userId === id;
    const user = await this.userService.findOne(id, { forSelf, actorRole: req.user.role });
    this.phiAudit.emit({
      ...buildPhiAuditContextFromRequest(req, this.tenantContext),
      action: PhiAuditAction.PATIENT_PROFILE_READ,
      resourceType: PhiAuditResourceType.PATIENT,
      resourceId: user.id,
      success: true,
      classification: 'phi',
    });
    if (forSelf) {
      return this.userService.toOwnProfileResponse(user);
    }
    return {
      id: user.id, phoneNumber: user.phoneNumber, firstName: user.firstName,
      lastName: user.lastName, email: user.email, role: user.role,
      status: user.status, isPhoneVerified: user.isPhoneVerified,
      isDashboardActivated: user.isDashboardActivated, clinicId: user.clinicId,
      specialization: user.specialization, permissions: user.permissions,
      createdAt: user.createdAt,
    };
  }

  @Put(':id')
  @SkipTenantGuard()
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    if (req.user.userId !== id && !['SYSTEM_MANAGER', 'CLINIC_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Not authorized');
    }
    const forSelf = req.user.userId === id;
    const user = await this.userService.update(id, updateUserDto, { forSelf });
    if (forSelf) {
      return this.userService.toOwnProfileResponse(user);
    }
    return {
      id: user.id, phoneNumber: user.phoneNumber, firstName: user.firstName, lastName: user.lastName,
    };
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  async updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateUserStatusDto) {
    const user = await this.userService.updateStatus(id, updateStatusDto);
    return { id: user.id, status: user.status };
  }

  @Post(':id/change-password')
  @SkipTenantGuard()
  async changePassword(@Param('id') id: string, @Body() changePasswordDto: ChangePasswordDto, @Request() req) {
    if (req.user.userId !== id) throw new ForbiddenException('Not authorized');
    return this.userService.changePassword(id, changePasswordDto, { forSelf: true });
  }

  @Post(':id/avatar')
  @SkipTenantGuard()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; size: number; mimetype: string },
    @Request() req,
  ) {
    if (req.user.userId !== id && !['SYSTEM_MANAGER', 'CLINIC_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Not authorized');
    }
    const user = await this.userService.updateAvatar(id, file);
    if (req.user.userId === id) {
      return this.userService.toOwnProfileResponse(user);
    }
    return {
      id: user.id,
      avatarUrl: (user.profileData?.avatarUrl as string) || undefined,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}

// Separate controller for internal service-to-service endpoints.
// These must NOT be under the class-level @UseGuards(JwtAuthGuard) because
// auth-service calls them before a JWT exists (login) or with a service token only.
@Controller('users')
export class InternalUserController {
  constructor(
    private readonly userService: UserService,
    private readonly phiAudit: PhiAuditPublisherService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private toPublicUser(user: User): Record<string, unknown> {
    const { password: _, ...rest } = user;
    return rest as Record<string, unknown>;
  }

  @Get('internal/exists')
  @UseGuards(InternalServiceGuard)
  async checkExists(@Query('phoneNumber') phoneNumber: string, @Request() req) {
    try {
      const user = await this.userService.findByPhoneNumber(phoneNumber);
      this.phiAudit.emit({
        ...buildPhiAuditContextFromRequest(req, this.tenantContext),
        action: PhiAuditAction.INTERNAL_PHI_ACCESS,
        resourceType: PhiAuditResourceType.PATIENT,
        resourceId: user.id,
        success: true,
        classification: 'phi',
        internalCall: true,
      });
      return { exists: true };
    } catch {
      this.phiAudit.emit({
        ...buildPhiAuditContextFromRequest(req, this.tenantContext),
        action: PhiAuditAction.INTERNAL_PHI_ACCESS,
        resourceType: PhiAuditResourceType.PATIENT,
        success: false,
        classification: 'phi',
        internalCall: true,
      });
      return { exists: false };
    }
  }

  @Get('internal/by-id/:id')
  @UseGuards(InternalServiceGuard)
  async getById(@Param('id') id: string, @Request() req) {
    const user = await this.userService.findOne(id);
    this.phiAudit.emit({
      ...buildPhiAuditContextFromRequest(req, this.tenantContext),
      action: PhiAuditAction.INTERNAL_PHI_ACCESS,
      resourceType: PhiAuditResourceType.PATIENT,
      resourceId: user.id,
      success: true,
      classification: 'phi',
      internalCall: true,
    });
    return { success: true, user: this.toPublicUser(user) };
  }

  @Post('internal/public-doctors')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async getPublicDoctors(@Body() body: { userIds?: string[] }) {
    const doctors = await this.userService.getPublicDoctorProfiles(body?.userIds || []);
    return { success: true, doctors };
  }

  @Post('internal/search-doctor-ids')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async searchDoctorIds(@Body() body: { q?: string; specialization?: string }) {
    const doctorIds = await this.userService.searchDoctorIds(body || {});
    return { success: true, doctorIds };
  }

  @Get('internal/by-phone/:phoneNumber')
  @UseGuards(InternalServiceGuard)
  async getByPhone(@Param('phoneNumber') phoneNumber: string, @Request() req) {
    const decoded = decodeURIComponent(phoneNumber);
    const user = await this.userService.findByPhoneNumber(decoded);
    this.phiAudit.emit({
      ...buildPhiAuditContextFromRequest(req, this.tenantContext),
      action: PhiAuditAction.INTERNAL_PHI_ACCESS,
      resourceType: PhiAuditResourceType.PATIENT,
      resourceId: user.id,
      success: true,
      classification: 'phi',
      internalCall: true,
    });
    return { success: true, user: this.toPublicUser(user) };
  }

  @Get('internal/clinic-admin-by-clinic/:clinicId')
  @UseGuards(InternalServiceGuard)
  async findClinicAdminByClinic(@Param('clinicId') clinicId: string) {
    const user = await this.userService.findClinicAdminByClinicId(clinicId);
    return { success: true, user: user ? this.toPublicUser(user) : null };
  }

  @Patch('internal/:id/clinic-id')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async updateClinicId(@Param('id') id: string, @Body() body: { clinicId: string }) {
    await this.userService.updateClinicId(id, body.clinicId);
    return { success: true };
  }

  @Get('internal/stats')
  @UseGuards(InternalServiceGuard)
  async getPlatformStats() {
    return this.userService.getPlatformStats();
  }

  @Post('internal/create')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async createInternal(@Body() body: CreateUserDto) {
    try {
      const existing = await this.userService.findByPhoneNumber(body.phoneNumber);
      return { success: true, userId: existing.id };
    } catch {
      // not found — create
    }
    try {
      const user = await this.userService.create(body);
      return { success: true, userId: user.id };
    } catch (error) {
      rethrowIfRegistrationError(error);
    }
  }

  @Post('internal/create-by-admin')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async createByAdminInternal(@Body() body: CreateUserByAdminDto) {
    try {
      const { user, temporaryPassword, membershipOnly } = await this.userService.createByAdmin(body);
      return {
        success: true,
        message: membershipOnly
          ? 'Staff membership created for existing user'
          : 'User created successfully',
        userId: user.id,
        temporaryPassword: temporaryPassword ?? undefined,
        membershipOnly: membershipOnly ?? false,
        activationExpiresAt: user.activationExpiresAt?.toISOString(),
        status: user.status,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      rethrowIfRegistrationError(error);
    }
  }

  @Post('internal/complete-staff-activation')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async completeStaffActivationInternal(
    @Body() body: { userId: string; newPassword: string },
  ) {
    const user = await this.userService.completeStaffActivation(body.userId, body.newPassword);
    return { success: true, user: this.toPublicUser(user) };
  }

  @Post('internal/verify-phone')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPhoneInternal(@Body() body: { phoneNumber: string }) {
    return this.userService.verifyPhone(body.phoneNumber);
  }

  // Called by auth-service during login to validate credentials over HTTPS.
  @Post('validate-login')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async validateLogin(@Body() body: ValidateLoginDto) {
    return this.userService.validateLogin(body.phoneNumber, body.password);
  }

  @Post(':id/reset-password-internal')
  @InternalRouteAllow('auth-service')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async resetPasswordInternal(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.userService.resetPasswordInternal(id, body.newPassword);
  }
}
