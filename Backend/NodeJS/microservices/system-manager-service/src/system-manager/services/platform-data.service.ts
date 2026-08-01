import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { createLogger } from '@medicare/telemetry';
import { ClinicHttpClient } from './clinic-http.client';

export interface PlatformClinicRecord {
  id: string;
  name: string;
  description?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  status: string;
  createdAt?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PlatformUserRecord {
  id: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  clinicId?: string;
  createdAt?: string;
}

export interface PlatformStaffRecord {
  id: string;
  userId: string;
  staffRole: string;
  status: string;
  assignedAt?: string;
  assignedBy?: string;
}

const SERVICE_NAME = 'system-manager-service';

@Injectable()
export class PlatformDataService implements OnModuleDestroy {
  private readonly log = createLogger(SERVICE_NAME);
  private clinicPool: Pool | null = null;
  private userPool: Pool | null = null;
  private clinicPoolClose: Promise<void> | null = null;
  private userPoolClose: Promise<void> | null = null;

  constructor(private readonly clinicHttpClient: ClinicHttpClient) {}

  async listClinics(): Promise<{ success: boolean; clinics: PlatformClinicRecord[] }> {
    const pool = this.getClinicPool();
    if (!pool) {
      return { success: true, clinics: [] };
    }

    const started = Date.now();
    try {
      const result = await pool.query<{
        id: string;
        name: string;
        description: string | null;
        city: string | null;
        governorate: string | null;
        phone: string | null;
        email: string | null;
        status: string;
        created_at: Date;
        latitude: number | null;
        longitude: number | null;
      }>(
        `SELECT id, name, description, city, governorate, phone, email, status, created_at, latitude, longitude
         FROM tenants
         ORDER BY name ASC`,
      );

      return {
        success: true,
        clinics: result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          city: row.city ?? undefined,
          governorate: row.governorate ?? undefined,
          phone: row.phone ?? undefined,
          email: row.email ?? undefined,
          status: row.status,
          createdAt: row.created_at?.toISOString(),
          latitude: row.latitude,
          longitude: row.longitude,
        })),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('Failed to list platform clinics', {
        event: 'db_query_failed',
        module: 'PlatformDataService',
        query_name: 'platform_clinics',
        duration_ms: Date.now() - started,
        err,
      });
      return { success: true, clinics: [] };
    }
  }

  async listUsers(page = 1, limit = 20): Promise<PlatformUserRecord[]> {
    const pool = this.getUserPool();
    if (!pool) return [];

    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const started = Date.now();

    try {
      // user_db.users uses TypeORM default camelCase column names (only tenant_id is snake_case).
      const result = await pool.query<{
        id: string;
        phoneNumber: string;
        firstName: string;
        lastName: string;
        role: string;
        status: string;
        tenant_id: string | null;
        createdAt: Date;
      }>(
        `SELECT id, "phoneNumber", "firstName", "lastName", role::text AS role, status::text AS status,
                tenant_id, "createdAt"
         FROM users
         WHERE "deletedAt" IS NULL
         ORDER BY "createdAt" DESC
         LIMIT $1 OFFSET $2`,
        [take, skip],
      );

      return result.rows.map((row) => ({
        id: row.id,
        phoneNumber: row.phoneNumber,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        status: row.status,
        clinicId: row.tenant_id ?? undefined,
        createdAt: row.createdAt?.toISOString(),
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('Failed to list platform users', {
        event: 'db_query_failed',
        module: 'PlatformDataService',
        query_name: 'platform_users',
        duration_ms: Date.now() - started,
        err,
      });
      return [];
    }
  }

  async listClinicStaff(clinicId: string): Promise<{ success: boolean; staff: PlatformStaffRecord[] }> {
    const pool = this.getClinicPool();
    if (!pool) {
      return { success: true, staff: [] };
    }

    const started = Date.now();
    try {
      const result = await pool.query<{
        id: string;
        user_id: string;
        staff_role: string;
        status: string;
        assigned_at: Date;
        assigned_by: string | null;
      }>(
        `SELECT id, user_id, staff_role, status, assigned_at, assigned_by
         FROM tenant_staff_assignments
         WHERE tenant_id = $1 AND status IN ('ACTIVE', 'PENDING')
         ORDER BY assigned_at ASC`,
        [clinicId],
      );

      return {
        success: true,
        staff: result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          staffRole: row.staff_role,
          status: row.status,
          assignedAt: row.assigned_at?.toISOString(),
          assignedBy: row.assigned_by ?? undefined,
        })),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('Failed to list clinic staff', {
        event: 'db_query_failed',
        module: 'PlatformDataService',
        query_name: 'platform_clinic_staff',
        duration_ms: Date.now() - started,
        err,
        metadata: { clinicId },
      });
      return { success: true, staff: [] };
    }
  }

  /**
   * Activates staff memberships left PENDING when auth→clinic activate-pending
   * was blocked by the internal allowlist (seed / staff onboarding).
   */
  async activatePendingStaffAssignments(): Promise<{ success: boolean; activated: number }> {
    const pool = this.getClinicPool();
    if (!pool) {
      return { success: false, activated: 0 };
    }

    const started = Date.now();
    try {
      const result = await pool.query<{ id: string }>(
        `UPDATE tenant_staff_assignments
         SET status = 'ACTIVE',
             started_at = COALESCE(started_at, NOW()),
             ended_at = NULL,
             updated_at = NOW()
         WHERE status = 'PENDING'
         RETURNING id`,
      );
      const activated = result.rowCount ?? result.rows.length;
      this.log.info('Activated pending clinic staff assignments', {
        event: 'staff_pending_activated',
        module: 'PlatformDataService',
        duration_ms: Date.now() - started,
        metadata: { activated },
      });
      return { success: true, activated };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('Failed to activate pending staff assignments', {
        event: 'db_query_failed',
        module: 'PlatformDataService',
        query_name: 'platform_activate_pending_staff',
        duration_ms: Date.now() - started,
        err,
      });
      throw err;
    }
  }

  async createClinic(body: {
    name: string;
    description?: string;
    city?: string;
    governorate?: string;
    phone?: string;
    email?: string;
  }) {
    return this.clinicHttpClient.createPlatformClinic(body);
  }

  private getClinicPool(): Pool | null {
    if (this.clinicPool) return this.clinicPool;

    const host = process.env.CLINIC_STATS_DATABASE_HOST;
    const database = process.env.CLINIC_STATS_DATABASE_NAME;
    if (!host || !database) return null;

    this.clinicPool = new Pool({
      host,
      port: parseInt(process.env.CLINIC_STATS_DATABASE_PORT || '5432', 10),
      user: process.env.CLINIC_STATS_DATABASE_USER || process.env.DATABASE_USER,
      password: process.env.CLINIC_STATS_DATABASE_PASSWORD || process.env.DATABASE_PASSWORD,
      database,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 3000,
    });

    return this.clinicPool;
  }

  private getUserPool(): Pool | null {
    if (this.userPool) return this.userPool;

    const host = process.env.USER_STATS_DATABASE_HOST;
    const database = process.env.USER_STATS_DATABASE_NAME;
    if (!host || !database) return null;

    this.userPool = new Pool({
      host,
      port: parseInt(process.env.USER_STATS_DATABASE_PORT || '5432', 10),
      user: process.env.USER_STATS_DATABASE_USER || process.env.DATABASE_USER,
      password: process.env.USER_STATS_DATABASE_PASSWORD || process.env.DATABASE_PASSWORD,
      database,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 3000,
    });

    return this.userPool;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.closePool('clinic'), this.closePool('user')]);
  }

  private async closePool(which: 'clinic' | 'user'): Promise<void> {
    const closeRef = which === 'clinic' ? 'clinicPoolClose' : 'userPoolClose';
    const poolRef = which === 'clinic' ? 'clinicPool' : 'userPool';
    if ((this as any)[closeRef]) {
      await (this as any)[closeRef];
      return;
    }

    const pool: Pool | null = (this as any)[poolRef];
    (this as any)[poolRef] = null;
    if (!pool) return;

    const closePromise = pool.end().finally(() => {
      (this as any)[closeRef] = null;
    });
    (this as any)[closeRef] = closePromise;
    await closePromise;
  }
}
