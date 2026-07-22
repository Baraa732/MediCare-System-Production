import { Controller, Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PhiAuditLogService } from './phi-audit-log.service';
import {
  AUDIT_LOG_TOPIC,
  PhiAuditClassification,
  PhiAuditEvent,
  PhiAuditResourceType,
} from '../../phi-audit-shared/types';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function normalizeLegacyAuditPayload(raw: Record<string, unknown>): PhiAuditEvent {
  const action = asString(raw.action) ?? 'unknown.action';
  const resource = asString(raw.resource) ?? PhiAuditResourceType.SYSTEM;
  const timestamp =
    asString(raw.timestamp) ??
    (raw.timestamp instanceof Date ? raw.timestamp.toISOString() : new Date().toISOString());

  return {
    timestamp,
    actorId: asString(raw.performedBy) ?? asString(raw.userId) ?? asString(raw.actorId),
    actorRole: asString(raw.actorRole) ?? 'SYSTEM_MANAGER',
    tenantId: asString(raw.tenantId),
    action,
    resourceType: resource.toLowerCase(),
    resourceId: asString(raw.resourceId),
    requestId: asString(raw.requestId),
    ip: asString(raw.ip),
    userAgent: asString(raw.userAgent),
    success: raw.success !== false,
    classification: 'administrative',
    sourceService: asString(raw.sourceService) ?? 'system-manager-service',
    internalCall: false,
  };
}

function normalizePhiAuditPayload(raw: Record<string, unknown>): PhiAuditEvent | null {
  const action = asString(raw.action);
  const resourceType = asString(raw.resourceType);
  if (!action || !resourceType) return null;

  const classification = asString(raw.classification) as PhiAuditClassification | undefined;

  return {
    timestamp: asString(raw.timestamp) ?? new Date().toISOString(),
    actorId: asString(raw.actorId) ?? asString(raw.performedBy) ?? asString(raw.userId),
    actorRole: asString(raw.actorRole),
    tenantId: asString(raw.tenantId),
    action,
    resourceType,
    resourceId: asString(raw.resourceId),
    ip: asString(raw.ip),
    userAgent: asString(raw.userAgent),
    requestId: asString(raw.requestId),
    success: raw.success !== false,
    classification: classification ?? 'phi',
    sourceService: asString(raw.sourceService),
    internalCall: raw.internalCall === true,
  };
}

function normalizeAuditPayload(payload: unknown): PhiAuditEvent | null {
  if (!isRecord(payload)) return null;

  const normalized = normalizePhiAuditPayload(payload);
  if (normalized) return normalized;

  if (asString(payload.action) && asString(payload.resource)) {
    return normalizeLegacyAuditPayload(payload);
  }

  return null;
}

@Controller()
@Injectable()
export class PhiAuditConsumerService {
  private readonly logger: Logger;

  constructor(
    private readonly phiAuditLogService: PhiAuditLogService,
    tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(PhiAuditConsumerService.name, tenantContext);
  }

  @EventPattern(AUDIT_LOG_TOPIC)
  async handleAuditLog(@Payload() payload: unknown): Promise<void> {
    const event = normalizeAuditPayload(payload);
    if (!event) {
      this.logger.warn('audit.log received with unrecognizable payload shape — skipped');
      return;
    }

    try {
      await this.phiAuditLogService.append(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to persist audit.log action=${event.action}: ${message}`);
      throw error;
    }
  }
}
