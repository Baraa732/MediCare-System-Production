import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhiAuditLog } from '../entities/phi-audit-log.entity';
import { PhiAuditEvent } from '../../phi-audit-shared/types';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

export interface PhiAuditSearchFilters {
  tenantId?: string;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  classification?: string;
  requestId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PhiAuditLogService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PhiAuditLog, 'authConnection')
    private readonly phiAuditRepo: Repository<PhiAuditLog>,
    tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(PhiAuditLogService.name, tenantContext);
  }

  /**
   * Append-only persistence — no update or delete methods exposed.
   */
  async append(event: PhiAuditEvent): Promise<PhiAuditLog> {
    // actor_id / tenant_id columns are uuid — service names (e.g. "user-service")
    // from internal calls must not be written or inserts fail and poison Kafka.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const actorId = event.actorId && uuidRe.test(event.actorId) ? event.actorId : null;
    const tenantId = event.tenantId && uuidRe.test(event.tenantId) ? event.tenantId : null;
    const row = this.phiAuditRepo.create({
      timestamp: new Date(event.timestamp),
      actorId,
      actorRole: event.actorRole ?? null,
      tenantId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
      requestId: event.requestId ?? null,
      success: event.success,
      classification: event.classification,
      sourceService: event.sourceService ?? null,
      internalCall: event.internalCall ?? false,
    });

    const saved = await this.phiAuditRepo.save(row);

    this.logger.log(
      `PHI audit persisted action=${event.action} resource=${event.resourceType}:${event.resourceId ?? '-'} success=${event.success}`,
    );

    return saved;
  }

  async search(filters: PhiAuditSearchFilters): Promise<PhiAuditLog[]> {
    const qb = this.phiAuditRepo.createQueryBuilder('a').orderBy('a.timestamp', 'DESC');

    if (filters.tenantId) qb.andWhere('a.tenant_id = :tenantId', { tenantId: filters.tenantId });
    if (filters.actorId) qb.andWhere('a.actor_id = :actorId', { actorId: filters.actorId });
    if (filters.action) qb.andWhere('a.action = :action', { action: filters.action });
    if (filters.resourceType) qb.andWhere('a.resource_type = :resourceType', { resourceType: filters.resourceType });
    if (filters.resourceId) qb.andWhere('a.resource_id = :resourceId', { resourceId: filters.resourceId });
    if (filters.classification) {
      qb.andWhere('a.classification = :classification', { classification: filters.classification });
    }
    if (filters.requestId) qb.andWhere('a.request_id = :requestId', { requestId: filters.requestId });
    if (filters.from) qb.andWhere('a.timestamp >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('a.timestamp <= :to', { to: filters.to });

    const take = Math.min(filters.limit ?? 100, 500);
    const skip = filters.offset ?? 0;
    qb.take(take).skip(skip);

    return qb.getMany();
  }
}
