import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClinicService } from './clinic.service';
import {
  HttpTenantAccessChecker,
  TENANT_ACCESS_CHECKER,
  TenantAccessChecker,
} from '../../tenant-shared/tenant-access-checker';
@Injectable()
export class ClinicLocalTenantAccessChecker implements TenantAccessChecker {
  private readonly patientChecker = new HttpTenantAccessChecker();

  constructor(private readonly clinicService: ClinicService) {}

  async assertStaffAccess(tenantId: string, userId: string, role: string): Promise<void> {
    if (role === 'SYSTEM_MANAGER') return;

    const result = await this.clinicService.checkClinicAccess(tenantId, userId, role);
    if (!result.allowed) {
      throw new ForbiddenException('You do not have access to this clinic');
    }
  }

  async assertPatientAccess(tenantId: string, patientId: string): Promise<void> {
    return this.patientChecker.assertPatientAccess(tenantId, patientId);
  }

  async assertDoctorPatientAccess(
    tenantId: string,
    doctorId: string,
    patientId: string,
  ): Promise<void> {
    return this.patientChecker.assertDoctorPatientAccess(tenantId, doctorId, patientId);
  }
}

export const clinicTenantAccessProvider = {
  provide: TENANT_ACCESS_CHECKER,
  useClass: ClinicLocalTenantAccessChecker,
};
