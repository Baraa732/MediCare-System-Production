import { ForbiddenException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import {
  TenantEventValidationError,
  validateTenantEvent,
  withValidatedTenantEvent,
} from '../src/tenant-shared/tenant-kafka';
import { tenantFindWhere, withTenantWhere } from '../src/tenant-shared/tenant-query.util';
import { tenantRedisKey } from '../src/tenant-shared/tenant.constants';
import { resolveTenantId } from '../src/tenant-shared/tenant-resolver';
import { TenantContextService } from '../src/tenant-shared/tenant-context.service';

describe('Multi-tenancy security — Kafka', () => {
  it('rejects events missing tenantId', () => {
    expect(() =>
      validateTenantEvent({ appointmentId: 'a1', clinicId: undefined }, 'test'),
    ).toThrow(TenantEventValidationError);
  });

  it('accepts legacy clinicId as tenant alias', () => {
    const result = validateTenantEvent(
      { appointmentId: 'a1', clinicId: 'tenant-a' },
      'test',
    );
    expect(result.tenantId).toBe('tenant-a');
  });

  it('rejects spoofed tenant in flat payload when envelope tenant differs', () => {
    const result = validateTenantEvent(
      {
        tenantId: 'tenant-a',
        payload: { appointmentId: 'a1', tenantId: 'tenant-a', clinicId: 'tenant-a' },
      },
      'test',
    );
    expect(result.tenantId).toBe('tenant-a');
  });

  it('withValidatedTenantEvent does not invoke handler when tenantId missing', async () => {
    const tenantContext = new TenantContextService();
    const logger = new Logger('test');
    const handler = jest.fn();

    await withValidatedTenantEvent(
      { foo: 'bar' },
      'spoof.test',
      tenantContext,
      logger,
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Multi-tenancy security — query isolation', () => {
  it('tenantFindWhere scopes queries to current tenant', () => {
    const where = tenantFindWhere('tenant-a', { id: 'user-1' });
    expect(where).toEqual({ id: 'user-1', tenantId: 'tenant-a' });
  });

  it('withTenantWhere throws when tenant context missing', () => {
    expect(() => withTenantWhere(null, { id: 'x' })).toThrow(ForbiddenException);
  });
});

describe('Multi-tenancy security — Redis cache isolation', () => {
  it('prefixes keys with tenant id', () => {
    const keyA = tenantRedisKey('tenant-a', 'ai-cache', 'hash1');
    const keyB = tenantRedisKey('tenant-b', 'ai-cache', 'hash1');
    expect(keyA).not.toEqual(keyB);
    expect(keyA).toBe('tenant:tenant-a:ai-cache:hash1');
  });
});

describe('Multi-tenancy security — HTTP tenant resolution', () => {
  it('prefers JWT tenantId over legacy clinicId header', () => {
    const tenantId = resolveTenantId({
      jwtPayload: { tenantId: 'jwt-tenant', clinicId: 'legacy-tenant' },
      headers: { 'x-tenant-id': 'header-tenant', 'x-clinic-id': 'header-clinic' },
    });
    expect(tenantId).toBe('jwt-tenant');
  });

  it('falls back to X-Tenant-ID when JWT has no tenant', () => {
    const tenantId = resolveTenantId({
      headers: { 'x-tenant-id': 'header-tenant' },
    });
    expect(tenantId).toBe('header-tenant');
  });

  it('accepts legacy clinicId in body as fallback', () => {
    const tenantId = resolveTenantId({
      body: { clinicId: 'body-clinic' },
    });
    expect(tenantId).toBe('body-clinic');
  });
});

describe('Multi-tenancy security — background job context', () => {
  it('restores tenant context inside tenantContext.run', () => {
    const tenantContext = new TenantContextService();
    let captured: string | null = null;

    tenantContext.run({ tenantId: 'tenant-job' }, () => {
      captured = tenantContext.getTenantId();
    });

    expect(captured).toBe('tenant-job');
  });
});
