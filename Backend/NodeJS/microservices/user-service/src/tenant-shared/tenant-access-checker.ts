import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../internal-auth-shared/internal-http.signer';

export interface TenantAccessChecker {
  assertStaffAccess(tenantId: string, userId: string, role: string): Promise<void>;
  assertPatientAccess(tenantId: string, patientId: string): Promise<void>;
  assertDoctorPatientAccess(tenantId: string, doctorId: string, patientId: string): Promise<void>;
}

export const TENANT_ACCESS_CHECKER = 'TENANT_ACCESS_CHECKER';

@Injectable()
export class HttpTenantAccessChecker implements TenantAccessChecker {
  private readonly logger = new Logger(HttpTenantAccessChecker.name);
  private readonly clinicBaseUrl =
    process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
  private readonly appointmentBaseUrl =
    process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly serviceName = process.env.INTERNAL_AUTH_SERVICE_NAME || '';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';

  private internalHeaders(method: string, url: string, body?: unknown): Record<string, string> {
    if (!this.serviceName || !this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SERVICE_NAME and INTERNAL_AUTH_SECRET are required');
    }
    return createInternalAuthHeadersForUrl(
      this.serviceName,
      this.signingSecret,
      method,
      url,
      body,
    );
  }

  async assertStaffAccess(tenantId: string, userId: string, role: string): Promise<void> {
    if (role === 'SYSTEM_MANAGER') return;

    const staffRoles = new Set(['CLINIC_ADMIN', 'SECRETARY', 'DOCTOR']);
    if (!staffRoles.has(role)) {
      throw new ForbiddenException('Staff role required for tenant access');
    }

    try {
      const url = `${this.clinicBaseUrl}/v1/clinics/internal/check-access`;
      const body = { clinicId: tenantId, userId, role };
      const res = await axios.post(url, body, {
        timeout: 5000,
        headers: this.internalHeaders('POST', url, body),
      });
      if (res.data?.allowed !== true) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`assertStaffAccess failed: ${error}`);
      throw new ForbiddenException('Unable to verify clinic access');
    }
  }

  async hasPatientClinicRelation(tenantId: string, patientId: string): Promise<boolean> {
    try {
      const url = `${this.appointmentBaseUrl}/v1/appointments/internal/check-patient-clinic`;
      const body = { patientId, clinicId: tenantId };
      const res = await axios.post(url, body, {
        timeout: 5000,
        headers: this.internalHeaders('POST', url, body),
      });
      return res.data?.allowed === true;
    } catch (error) {
      this.logger.error(`hasPatientClinicRelation failed: ${error}`);
      return false;
    }
  }

  async assertPatientAccess(tenantId: string, patientId: string): Promise<void> {
    const allowed = await this.hasPatientClinicRelation(tenantId, patientId);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this clinic');
    }
  }

  async assertDoctorPatientAccess(
    tenantId: string,
    doctorId: string,
    patientId: string,
  ): Promise<void> {
    try {
      const url = `${this.appointmentBaseUrl}/v1/appointments/internal/check-doctor-patient`;
      const body = { clinicId: tenantId, doctorId, patientId };
      const res = await axios.post(url, body, {
        timeout: 5000,
        headers: this.internalHeaders('POST', url, body),
      });
      if (res.data?.allowed !== true) {
        throw new ForbiddenException('You are not assigned to this patient in this clinic');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`assertDoctorPatientAccess failed: ${error}`);
      throw new ForbiddenException('Unable to verify doctor-patient assignment');
    }
  }
}
