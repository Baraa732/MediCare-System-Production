import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Request, UseGuards, UseInterceptors, UploadedFile,
  ForbiddenException, HttpCode, HttpStatus,
  UnauthorizedException, BadRequestException, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as crypto from 'crypto';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UpdateUserStatusDto } from '../dto/user.dto';
import { CreateUserByAdminDto } from '../dto/create-user-by-admin.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { User } from '../entities/user.entity';
import { rethrowIfRegistrationError } from '../../common/errors/registration.errors';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { SkipTenantGuard } from '../../tenant-shared/tenant.decorators';

// Internal endpoints (validate-login, reset-password-internal) are defined in
// InternalUserController below — they must NOT inherit the class-level JwtAuthGuard.
// LOW FIX: Add API versioning
@Controller('v1/users')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

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
  async findByPhoneNumber(@Param('phoneNumber') phoneNumber: string) {
    const user = await this.userService.findByPhoneNumber(phoneNumber);
    return {
      id: user.id, phoneNumber: user.phoneNumber, firstName: user.firstName,
      lastName: user.lastName, role: user.role, status: user.status,
      isDashboardActivated: user.isDashboardActivated,
    };
  }

  @Get('lookup/patient/:phoneNumber')
  @UseGuards(RolesGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  async lookupPatient(@Param('phoneNumber') phoneNumber: string) {
    const user = await this.userService.findByPhoneNumber(phoneNumber);
    if (user.role !== 'PATIENT') {
      throw new BadRequestException('No patient account found for this phone number');
    }
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
  async getAvatar(@Param('userId') userId: string) {
    const { buffer, mime } = await this.userService.readAvatar(userId);
    return new StreamableFile(buffer, {
      type: mime,
      disposition: 'inline',
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    if (req.user.userId !== id && !['SYSTEM_MANAGER', 'CLINIC_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Not authorized');
    }
    const user = await this.userService.findOne(id);
    if (req.user.userId === id) {
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
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    if (req.user.userId !== id && !['SYSTEM_MANAGER', 'CLINIC_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Not authorized');
    }
    const user = await this.userService.update(id, updateUserDto);
    if (req.user.userId === id) {
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
  async changePassword(@Param('id') id: string, @Body() changePasswordDto: ChangePasswordDto, @Request() req) {
    if (req.user.userId !== id) throw new ForbiddenException('Not authorized');
    return this.userService.changePassword(id, changePasswordDto);
  }

  @Post(':id/avatar')
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
  constructor(private readonly userService: UserService) {}

  private verifyHmac(req: { headers: Record<string, unknown> }, subject: string): void {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    const timestamp = req.headers['x-internal-timestamp'] as string;
    const receivedHmac = req.headers['x-internal-hmac'] as string;

    if (!internalToken || !timestamp || !receivedHmac) {
      throw new UnauthorizedException('Missing internal request signature');
    }
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > 30_000 || age < -30000) {
      throw new UnauthorizedException('Request timestamp expired');
    }
    const expectedHmac = crypto
      .createHmac('sha256', internalToken)
      .update(`${subject}:${timestamp}`)
      .digest('hex');
    if (receivedHmac !== expectedHmac) {
      throw new UnauthorizedException('Invalid request signature');
    }
  }

  private toPublicUser(user: User): Record<string, unknown> {
    const { password: _, ...rest } = user;
    return rest as Record<string, unknown>;
  }

  @Get('internal/exists')
  @UseGuards(InternalServiceGuard)
  async checkExists(@Query('phoneNumber') phoneNumber: string, @Request() req) {
    this.verifyHmac(req, phoneNumber);
    try {
      await this.userService.findByPhoneNumber(phoneNumber);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  @Get('internal/by-id/:id')
  @UseGuards(InternalServiceGuard)
  async getById(@Param('id') id: string, @Request() req) {
    this.verifyHmac(req, id);
    const user = await this.userService.findOne(id);
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
    this.verifyHmac(req, decoded);
    const user = await this.userService.findByPhoneNumber(decoded);
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
  async createInternal(@Body() body: CreateUserDto, @Request() req) {
    this.verifyHmac(req, body.phoneNumber);
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
  async createByAdminInternal(@Body() body: CreateUserByAdminDto, @Request() req) {
    this.verifyHmac(req, body.phoneNumber);
    try {
      const { user, temporaryPassword } = await this.userService.createByAdmin(body);
      return {
        success: true,
        message: 'User created successfully',
        userId: user.id,
        temporaryPassword,
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
    @Request() req,
  ) {
    this.verifyHmac(req, body.userId);
    const user = await this.userService.completeStaffActivation(body.userId, body.newPassword);
    return { success: true, user: this.toPublicUser(user) };
  }

  @Post('internal/verify-phone')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPhoneInternal(@Body() body: { phoneNumber: string }, @Request() req) {
    this.verifyHmac(req, body.phoneNumber);
    return this.userService.verifyPhone(body.phoneNumber);
  }

  // Called by auth-service during login to validate credentials over HTTPS.
  @Post('validate-login')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async validateLogin(@Body() body: any, @Request() req) {
    this.verifyHmac(req, body.phoneNumber);
    return this.userService.validateLogin(body.phoneNumber, body.password, body.skipPasswordCheck);
  }

  @Post(':id/reset-password-internal')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async resetPasswordInternal(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.userService.resetPasswordInternal(id, body.newPassword);
  }
}
