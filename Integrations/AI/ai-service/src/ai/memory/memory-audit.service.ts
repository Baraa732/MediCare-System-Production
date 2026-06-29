import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiMemoryAuditLog } from '../entities/ai-memory-audit-log.entity';
import { IntegrityService } from './integrity.service';
import { MemoryAuditAction } from './memory.types';
import { getCorrelationId, hashRef } from '../security/secure-logging';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

const FORBIDDEN_METADATA_KEYS = new Set([
  'plaintext',
  'ciphertext',
  'summary',
  'dek',
  'wrapped_dek',
  'jwt',
  'token',
  'message',
  'content',
]);

export interface AuditAppendInput {
  action: MemoryAuditAction;
  patientId?: string;
  actorId?: string;
  actorRole?: string;
  resourceType?: string;
  resourceId?: string;
  reasonCode?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MemoryAuditService implements OnModuleInit {
  private readonly logger = new Logger(MemoryAuditService.name);

  constructor(
    @InjectRepository(AiMemoryAuditLog)
    private readonly auditRepo: Repository<AiMemoryAuditLog>,
    private readonly integrityService: IntegrityService,
    private readonly tenantContext: TenantContextService,
  ) {}

  onModuleInit(): void {
    this.integrityService.registerMacFailedHandler((event) => {
      void this.append({
        action: 'integrity.mac_failed',
        reasonCode: event.reason,
        metadata: {
          threadRef: event.threadId ? hashRef(event.threadId) : undefined,
          seq: event.seq,
        },
      });
    });
  }

  async append(input: AuditAppendInput): Promise<void> {
    const metadata = this.sanitizeMetadata(input.metadata || {});

    try {
      const row = this.auditRepo.create({
        tenantId: this.tenantContext.getTenantId() ?? undefined,
        patientId: input.patientId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        reasonCode: input.reasonCode,
        correlationId: getCorrelationId(),
        metadataJson: metadata,
      });
      await this.auditRepo.save(row);
    } catch (error) {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'audit_append_failed',
        action: input.action,
      });
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const lower = key.toLowerCase();
      if (FORBIDDEN_METADATA_KEYS.has(lower)) continue;
      if (lower.includes('plaintext') || lower.includes('ciphertext')) continue;
      if (typeof value === 'string' && value.length > 256) continue;
      out[key] = value;
    }
    return out;
  }
}
