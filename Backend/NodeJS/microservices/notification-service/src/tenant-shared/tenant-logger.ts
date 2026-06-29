import { createLogger, type StructuredLogger } from '@medicare/telemetry';
import { Logger } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

function resolveServiceName(fallback: string): string {
  return process.env.SERVICE_NAME ?? process.env.OTEL_SERVICE_NAME ?? fallback;
}

function tenantFields(tenantContext: TenantContextService) {
  const store = tenantContext.getStore();
  return {
    tenant_id: store?.tenantId,
    user_id: store?.userId,
    request_id: store?.requestId,
  };
}

function wrapLevel(
  logger: StructuredLogger,
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical',
  context: string,
  tenantContext: TenantContextService,
  args: unknown[],
) {
  const message = args.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
  const fields = {
    module: context,
    ...tenantFields(tenantContext),
  };

  logger[level](message, fields);
}

export function createTenantLogger(context: string, tenantContext: TenantContextService): Logger {
  const logger = createLogger(resolveServiceName(context));

  return {
    log: (...args: unknown[]) => wrapLevel(logger, 'info', context, tenantContext, args),
    warn: (...args: unknown[]) => wrapLevel(logger, 'warn', context, tenantContext, args),
    error: (...args: unknown[]) => wrapLevel(logger, 'error', context, tenantContext, args),
    debug: (...args: unknown[]) => wrapLevel(logger, 'debug', context, tenantContext, args),
    verbose: (...args: unknown[]) => wrapLevel(logger, 'debug', context, tenantContext, args),
  } as Logger;
}
