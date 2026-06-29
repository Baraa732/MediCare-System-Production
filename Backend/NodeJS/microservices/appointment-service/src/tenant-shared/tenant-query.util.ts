import { ForbiddenException } from '@nestjs/common';
import { FindOptionsWhere, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId) {
    throw new ForbiddenException('Tenant context is required');
  }
  return tenantId;
}

export function withTenantWhere<T extends Record<string, unknown>>(
  tenantId: string | null | undefined,
  where: T,
): T & { tenantId: string } {
  return { ...where, tenantId: requireTenantId(tenantId) };
}

export function applyTenantWhere<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  tenantId: string | null | undefined,
  column = 'tenant_id',
): SelectQueryBuilder<T> {
  const id = requireTenantId(tenantId);
  return qb.andWhere(`${alias}.${column} = :tenantId`, { tenantId: id });
}

export function tenantFindWhere<T extends ObjectLiteral>(
  tenantId: string | null | undefined,
  where: FindOptionsWhere<T>,
): FindOptionsWhere<T> {
  const id = requireTenantId(tenantId);
  return { ...where, tenantId: id } as FindOptionsWhere<T>;
}
