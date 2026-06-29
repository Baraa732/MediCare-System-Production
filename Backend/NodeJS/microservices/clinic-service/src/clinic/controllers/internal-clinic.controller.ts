import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe, Param } from '@nestjs/common';
import { ClinicService } from '../services/clinic.service';
import {
  ProvisionFromActivationDto,
  LinkClinicAdminDto,
  VerifyStaffDto,
  CheckClinicAccessDto,
  EnsureStaffAssignmentDto,
  ResolveStaffClinicDto,
  ListStaffInternalDto,
} from '../dto/clinic.dto';
import { InternalServiceGuard } from '../guards/internal-service.guard';

/** Service-to-service endpoints — not exposed through the public gateway flow. */
@Controller('v1/clinics/internal')
export class InternalClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Post('provision-from-activation')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async provisionFromActivation(@Body() dto: ProvisionFromActivationDto) {
    const clinic = await this.clinicService.provisionFromActivation(dto);
    return {
      success: true,
      clinicId: clinic.id,
      clinic: this.clinicService.toPublicClinic(clinic),
    };
  }

  @Post('link-admin')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async linkClinicAdmin(@Body() dto: LinkClinicAdminDto) {
    const result = await this.clinicService.linkClinicAdmin(dto);
    return { success: true, ...result };
  }

  @Post('verify-staff')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async verifyStaff(@Body() dto: VerifyStaffDto) {
    return this.clinicService.verifyStaffAssignment(dto.clinicId, dto.userId, dto.staffRole);
  }

  @Post('check-access')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async checkAccess(@Body() dto: CheckClinicAccessDto) {
    return this.clinicService.checkClinicAccess(dto.clinicId, dto.userId);
  }

  @Post('ensure-staff-assignment')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async ensureStaffAssignment(@Body() dto: EnsureStaffAssignmentDto) {
    const result = await this.clinicService.ensureStaffAssignmentForUser(
      dto.userId,
      dto.assignedBy,
    );
    return { success: result.assigned, ...result };
  }

  @Post('resolve-staff-clinic')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async resolveStaffClinic(@Body() dto: ResolveStaffClinicDto) {
    const result = await this.clinicService.resolveStaffTenant(dto.userId);
    return {
      success: Boolean(result.tenantId ?? result.clinicId),
      tenantId: result.tenantId ?? result.clinicId,
      clinicId: result.clinicId ?? result.tenantId,
      source: result.source,
    };
  }

  @Post('get-by-id/:id')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const clinic = await this.clinicService.findByIdInternal(id);
    return { success: true, clinic: this.clinicService.toPublicClinic(clinic) };
  }

  @Post('list-staff')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async listStaff(@Body() dto: ListStaffInternalDto) {
    const staff = await this.clinicService.listStaffInternal(dto.clinicId, dto.staffRole);
    return { success: true, staff };
  }
}
