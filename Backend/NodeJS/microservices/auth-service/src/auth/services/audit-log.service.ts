import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditResource } from '../entities/audit-log.entity';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

export interface CreateAuditLogDto {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  description?: string;
  success: boolean;
  errorMessage?: string;
  requestId?: string;
  ip?: string;
  device?: string;
  risk?: 'low' | 'medium' | 'high' | 'critical';
}

// HIPAA §164.312(b) requires audit logs to be retained for a minimum of 6 years.
// 2190 days = 6 years. This is the MINIMUM — never reduce this value.
const HIPAA_RETENTION_DAYS = 2190;

@Injectable()
export class AuditLogService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(AuditLog, 'authConnection')
    private auditLogRepository: Repository<AuditLog>,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(AuditLogService.name, tenantContext);
  }

  async createLog(dto: CreateAuditLogDto): Promise<AuditLog> {
    const tenantId = dto.tenantId ?? this.tenantContext.getTenantId() ?? undefined;
    const auditLog = this.auditLogRepository.create({
      ...dto,
      tenantId,
      severity: dto.severity || 'info',
    });

    await this.auditLogRepository.save(auditLog);

    this.logger.log(
      `Audit: ${dto.action} on ${dto.resource} — ${dto.success ? 'SUCCESS' : 'FAILED'} ` +
      `user=${dto.userId ?? 'anon'} ip=${dto.ip ?? '-'} req=${dto.requestId ?? '-'}`,
    );

    return auditLog;
  }

  async getUserAuditLogs(userId: string, limit = 100, offset = 0): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
      skip: offset,
    });
  }

  async getSessionAuditLogs(sessionId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getAuditLogsByAction(action: AuditAction, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  async getAuditLogsByResource(resource: AuditResource, resourceId?: string): Promise<AuditLog[]> {
    const where: any = { resource };
    if (resourceId) where.resourceId = resourceId;
    return this.auditLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getFailedLogins(limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action: AuditAction.FAILED_LOGIN, success: false },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  async getSuspiciousActivity(limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action: AuditAction.SUSPICIOUS_ACTIVITY },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  /**
   * Archive logs older than HIPAA_RETENTION_DAYS to cold storage before deletion.
   *
   * IMPORTANT: In production, replace the DELETE with an INSERT INTO audit_logs_archive
   * (or an S3 export) before deleting. Never delete audit logs without archiving first.
   *
   * The default parameter is intentionally set to HIPAA_RETENTION_DAYS so a
   * misconfigured cron job cannot accidentally delete recent logs.
   */
  async archiveOldLogs(daysToKeep: number = HIPAA_RETENTION_DAYS): Promise<void> {
    if (daysToKeep < HIPAA_RETENTION_DAYS) {
      this.logger.error(
        `archiveOldLogs called with daysToKeep=${daysToKeep} which is below the ` +
        `HIPAA minimum of ${HIPAA_RETENTION_DAYS} days. Operation aborted.`,
      );
      throw new Error(`Cannot delete audit logs newer than ${HIPAA_RETENTION_DAYS} days — HIPAA violation`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // TODO: Before deleting, export to S3 Glacier or audit_logs_archive table.
    // For now we log the count that would be affected without deleting.
    const count = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .where('audit_log.createdAt < :cutoffDate', { cutoffDate })
      .getCount();

    this.logger.log(
      `archiveOldLogs: ${count} logs older than ${daysToKeep} days are eligible for archival. ` +
      `Implement S3 export before enabling deletion.`,
    );
  }
}
