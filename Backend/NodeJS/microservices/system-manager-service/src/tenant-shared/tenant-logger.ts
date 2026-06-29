import { Logger } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

export function createTenantLogger(context: string, tenantContext: TenantContextService): Logger {
  const base = new Logger(context);

  const wrap = (level: 'log' | 'warn' | 'error' | 'debug' | 'verbose', args: unknown[]) => {
    const store = tenantContext.getStore();
    const prefix = [
      store?.tenantId ? `tenantId=${store.tenantId}` : null,
      store?.service ? `service=${store.service}` : process.env.SERVICE_NAME ?? context,
      store?.requestId ? `requestId=${store.requestId}` : null,
      store?.userId ? `userId=${store.userId}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    base[level](prefix ? `[${prefix}] ${message}` : message);
  };

  return {
    log: (...args: unknown[]) => wrap('log', args),
    warn: (...args: unknown[]) => wrap('warn', args),
    error: (...args: unknown[]) => wrap('error', args),
    debug: (...args: unknown[]) => wrap('debug', args),
    verbose: (...args: unknown[]) => wrap('verbose', args),
  } as Logger;
}
