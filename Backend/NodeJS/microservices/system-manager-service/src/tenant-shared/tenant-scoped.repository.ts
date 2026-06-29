import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';

/** Apply mandatory tenant filter to a TypeORM query builder. */
export function applyTenantFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  tenantId: string | null,
  column = 'tenantId',
): SelectQueryBuilder<T> {
  if (!tenantId) {
    throw new ForbiddenException('Tenant context is required for this query');
  }
  return qb.andWhere(`${alias}.${column} = :tenantId`, { tenantId });
}
