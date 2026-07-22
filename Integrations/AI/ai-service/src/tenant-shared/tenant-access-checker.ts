import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TenantAccessChecker {
  assertStaffAccess(tenantId: string, userId: string, role: string): Promise<void>;
  assertPatientAccess(tenantId: string, patientId: string): Promise<void>;
}

export const TENANT_ACCESS_CHECKER = 'TENANT_ACCESS_CHECKER';

@Injectable()
export class HttpTenantAccessChecker implements TenantAccessChecker {
  private readonly logger = new Logger(HttpTenantAccessChecker.name);
  private readonly clinicBaseUrl =
    process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
  private readonly appointmentBaseUrl =
    process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';

  async assertStaffAccess(tenantId: string, userId: string, role: string): Promise<void> {
    if (role === 'SYSTEM_MANAGER') return;

    const staffRoles = new Set(['CLINIC_ADMIN', 'SECRETARY', 'DOCTOR']);
    if (!staffRoles.has(role)) {
      throw new ForbiddenException('Staff role required for tenant access');
    }

    try {
      const res = await axios.post(
        `${this.clinicBaseUrl}/v1/clinics/internal/check-access`,
        { clinicId: tenantId, userId },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      if (res.data?.allowed !== true) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`assertStaffAccess failed: ${error}`);
      throw new ForbiddenException('Unable to verify clinic access');
    }
  }

  async assertPatientAccess(tenantId: string, patientId: string): Promise<void> {
    try {
      const res = await axios.post(
        `${this.appointmentBaseUrl}/v1/appointments/internal/check-patient-clinic`,
        { patientId, clinicId: tenantId },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      if (res.data?.allowed !== true) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`assertPatientAccess failed: ${error}`);
      throw new ForbiddenException('Unable to verify patient clinic access');
    }
  }
}
