import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientEmrLink } from '../entities/patient-emr-link.entity';

@Injectable()
export class EmrTenantGuardService {
  constructor(
    @InjectRepository(PatientEmrLink)
    private readonly linkRepo: Repository<PatientEmrLink>,
  ) {}

  requireTenantId(tenantId: string | null | undefined): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required for EMR access');
    }
    return tenantId;
  }

  async assertLinkBelongsToTenant(link: PatientEmrLink, tenantId: string): Promise<void> {
    if (!link.tenantId) {
      throw new ForbiddenException('EMR link has no tenant assignment');
    }
    if (link.tenantId !== tenantId) {
      throw new ForbiddenException('EMR record belongs to another tenant');
    }
  }

  async assertOpenEmrPatientBelongsToTenant(
    openemrPatientId: string,
    tenantId: string,
  ): Promise<PatientEmrLink> {
    const link = await this.linkRepo.findOne({
      where: { openemrPatientId, tenantId },
    });
    if (!link) {
      throw new ForbiddenException('OpenEMR patient is not linked to this tenant');
    }
    return link;
  }

  async getLinkForTenant(userId: string, tenantId: string): Promise<PatientEmrLink | null> {
    return this.linkRepo.findOne({ where: { userId, tenantId } });
  }
}
