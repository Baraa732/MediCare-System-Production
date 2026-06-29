import { ForbiddenException } from '@nestjs/common';
import { EmrTenantGuardService } from '../src/emr/services/emr-tenant-guard.service';
import { PatientEmrLink, EmrSyncStatus } from '../src/emr/entities/patient-emr-link.entity';

function makeLink(overrides: Partial<PatientEmrLink> = {}): PatientEmrLink {
  const link = new PatientEmrLink();
  link.id = 'link-1';
  link.userId = 'user-1';
  link.tenantId = 'tenant-a';
  link.openemrPatientId = 'pid-100';
  link.syncStatus = EmrSyncStatus.SYNCED;
  return Object.assign(link, overrides);
}

describe('EmrTenantGuardService — cross-tenant isolation', () => {
  const mockRepo = {
    findOne: jest.fn(),
  };
  const guard = new EmrTenantGuardService(mockRepo as never);

  it('rejects access when link tenant differs from context tenant', async () => {
    const link = makeLink({ tenantId: 'tenant-b' });
    await expect(guard.assertLinkBelongsToTenant(link, 'tenant-a')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows access when link tenant matches context tenant', async () => {
    const link = makeLink({ tenantId: 'tenant-a' });
    await expect(guard.assertLinkBelongsToTenant(link, 'tenant-a')).resolves.toBeUndefined();
  });

  it('rejects OpenEMR patient lookup when pid not linked to tenant', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(
      guard.assertOpenEmrPatientBelongsToTenant('pid-999', 'tenant-a'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns link when OpenEMR pid belongs to tenant', async () => {
    const link = makeLink();
    mockRepo.findOne.mockResolvedValue(link);
    const result = await guard.assertOpenEmrPatientBelongsToTenant('pid-100', 'tenant-a');
    expect(result).toBe(link);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { openemrPatientId: 'pid-100', tenantId: 'tenant-a' },
    });
  });
});
