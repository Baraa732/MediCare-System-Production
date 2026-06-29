import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from 'pg';
import { createLogger } from '@medicare/telemetry';
import {
  ActivationCodeStatus,
  ClinicAdminActivation,
} from '../entities/clinic-admin-activation.entity';
import { UserHttpClient } from './user-http.client';

export interface PlatformStatsResponse {
  timestamp: string;
  clinics: {
    total: number;
    byStatus: Record<string, number>;
  };
  users: {
    total: number;
    active: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  };
  activationCodes: {
    total: number;
    byStatus: Record<string, number>;
  };
}

const SERVICE_NAME = 'system-manager-service';

@Injectable()
export class PlatformStatsService implements OnModuleDestroy {
  private readonly log = createLogger(SERVICE_NAME);
  private clinicPool: Pool | null = null;

  constructor(
    @InjectRepository(ClinicAdminActivation)
    private readonly activationRepository: Repository<ClinicAdminActivation>,
    private readonly userHttpClient: UserHttpClient,
  ) {}

  async getPlatformStats(): Promise<PlatformStatsResponse> {
    const [clinics, users, activationCodes] = await Promise.all([
      this.getClinicCounts(),
      this.userHttpClient.getPlatformStats(),
      this.getActivationCodeCounts(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      clinics,
      users: users ?? {
        total: 0,
        active: 0,
        byRole: {},
        byStatus: {},
      },
      activationCodes,
    };
  }

  private async getClinicCounts(): Promise<PlatformStatsResponse['clinics']> {
    const pool = this.getClinicPool();
    if (!pool) {
      return { total: 0, byStatus: {} };
    }

    const started = Date.now();
    try {
      const totalResult = await pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM clinics',
      );
      const statusResult = await pool.query<{ status: string; count: string }>(
        'SELECT status, COUNT(*)::text AS count FROM clinics GROUP BY status',
      );

      const byStatus: Record<string, number> = {};
      for (const row of statusResult.rows) {
        byStatus[row.status] = parseInt(row.count, 10);
      }

      return {
        total: parseInt(totalResult.rows[0]?.count ?? '0', 10),
        byStatus,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('Failed to read clinic counts', {
        event: 'db_query_failed',
        module: 'PlatformStatsService',
        query_name: 'clinic_counts',
        duration_ms: Date.now() - started,
        err,
        error_code: (error as NodeJS.ErrnoException)?.code,
        metadata: { table: 'clinics' },
      });
      return { total: 0, byStatus: {} };
    }
  }

  private async getActivationCodeCounts(): Promise<PlatformStatsResponse['activationCodes']> {
    const rows = await this.activationRepository
      .createQueryBuilder('code')
      .select('code.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('code.status')
      .getRawMany<{ status: ActivationCodeStatus; count: string }>();

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const count = parseInt(row.count, 10);
      byStatus[row.status] = count;
      total += count;
    }

    return { total, byStatus };
  }

  private getClinicPool(): Pool | null {
    if (this.clinicPool) return this.clinicPool;

    const host = process.env.CLINIC_STATS_DATABASE_HOST;
    const database = process.env.CLINIC_STATS_DATABASE_NAME;
    if (!host || !database) {
      return null;
    }

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

  async onModuleDestroy(): Promise<void> {
    if (this.clinicPool) {
      await this.clinicPool.end();
      this.clinicPool = null;
    }
  }
}
