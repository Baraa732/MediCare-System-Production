import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AiPatientConsent } from '../entities/ai-patient-consent.entity';
import { ConsentScope } from './memory.types';
import { MemoryAuditService } from './memory-audit.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createHash } from 'crypto';

export interface GrantConsentOptions {
  actorId?: string;
  actorRole?: string;
  ipHash?: string;
  userAgentHash?: string;
}

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(AiPatientConsent)
    private readonly consentRepo: Repository<AiPatientConsent>,
    private readonly config: ConfigService,
    private readonly audit: MemoryAuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private resolveTenantId(): string | undefined {
    return this.tenantContext.getTenantId() ?? undefined;
  }

  async grantConsent(
    patientId: string,
    scope: ConsentScope,
    options: GrantConsentOptions = {},
  ): Promise<AiPatientConsent> {
    const row = this.consentRepo.create({
      tenantId: this.resolveTenantId(),
      patientId,
      scope,
      granted: true,
      version: this.policyVersion(),
      ipHash: options.ipHash,
      userAgentHash: options.userAgentHash,
    });
    const saved = await this.consentRepo.save(row);

    await this.audit.append({
      action: 'consent.grant',
      patientId,
      actorId: options.actorId || patientId,
      actorRole: options.actorRole || 'patient',
      resourceType: 'consent',
      resourceId: saved.id,
      metadata: { scope },
    });

    return saved;
  }

  async revokeConsent(
    patientId: string,
    scope: ConsentScope,
    options: GrantConsentOptions = {},
  ): Promise<AiPatientConsent> {
    const active = await this.findActiveGrant(patientId, scope);
    if (active) {
      active.revokedAt = new Date();
      await this.consentRepo.save(active);
    }

    const row = this.consentRepo.create({
      tenantId: this.resolveTenantId(),
      patientId,
      scope,
      granted: false,
      version: this.policyVersion(),
      revokedAt: new Date(),
      ipHash: options.ipHash,
      userAgentHash: options.userAgentHash,
    });
    const saved = await this.consentRepo.save(row);

    await this.audit.append({
      action: 'consent.revoke',
      patientId,
      actorId: options.actorId || patientId,
      actorRole: options.actorRole || 'patient',
      resourceType: 'consent',
      resourceId: saved.id,
      metadata: { scope },
    });

    return saved;
  }

  async hasConsent(patientId: string, scope: ConsentScope): Promise<boolean> {
    const active = await this.findActiveGrant(patientId, scope);
    return Boolean(active);
  }

  /** Hash client metadata for consent records without storing raw values. */
  static hashClientValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async findActiveGrant(
    patientId: string,
    scope: ConsentScope,
  ): Promise<AiPatientConsent | null> {
    const tenantId = this.resolveTenantId();
    const where: Record<string, unknown> = {
      patientId,
      scope,
      granted: true,
      revokedAt: IsNull(),
    };
    if (tenantId) where.tenantId = tenantId;

    return this.consentRepo.findOne({
      where: where as never,
      order: { grantedAt: 'DESC' },
    });
  }

  private policyVersion(): string {
    return this.config.get<string>('MEMORY_CONSENT_POLICY_VERSION') || '1.0';
  }
}
