import type { INestApplication, LoggerService } from '@nestjs/common';
import type { Logger as TypeOrmLogger } from 'typeorm';

export function initTelemetry(
  serviceName: string,
  options?: { metricIntervalMs?: number },
): unknown;

export interface StructuredLogger {
  debug(message: string, extra?: Record<string, unknown>): Record<string, unknown>;
  info(message: string, extra?: Record<string, unknown>): Record<string, unknown>;
  warn(message: string, extra?: Record<string, unknown>): Record<string, unknown>;
  error(message: string, extra?: Record<string, unknown>): Record<string, unknown>;
  critical(message: string, extra?: Record<string, unknown>): Record<string, unknown>;
  log(level: string, message: string, extra?: Record<string, unknown>): Record<string, unknown>;
  child(): StructuredLogger;
  requestId(): string;
}

export function createLogger(serviceName: string): StructuredLogger;

export function emit(
  serviceName: string,
  level: string,
  message: string,
  extra?: Record<string, unknown>,
): Record<string, unknown>;

export function normalizeLevel(level: string): string;

export function createNestLogger(serviceName: string): LoggerService;

export function createHttpLoggingMiddleware(
  serviceName: string,
  options?: { skipPaths?: string[] },
): (req: unknown, res: unknown, next: () => void) => void;

export function createHttpLoggingInterceptor(
  serviceName: string,
  options?: { skipPaths?: string[] },
): new () => { intercept(context: unknown, next: { handle(): unknown }): unknown };

export function logStructuredException(
  serviceName: string,
  input: {
    exception: unknown;
    request?: {
      method?: string;
      url?: string;
      originalUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    };
    status?: number;
    module?: string;
    event?: string;
    metadata?: Record<string, unknown>;
  },
): Record<string, unknown>;

export function createTypeOrmLogger(serviceName: string): TypeOrmLogger;

export function medicareTypeOrmExtras(serviceName: string): {
  logger: TypeOrmLogger;
  maxQueryExecutionTime: number;
};

export function instrumentRedisClient(client: unknown, serviceName: string, label?: string): unknown;

export function wrapRedisCommand(client: unknown, serviceName: string, label?: string): unknown;

export function instrumentIoredisClient(client: unknown, serviceName: string, label?: string): unknown;

export function createMedicareNestLogger(serviceName: string): LoggerService;

export function overrideNestStaticLogger(nestLogger: LoggerService): void;

export function setupMedicareLogging(
  app: INestApplication,
  options: {
    serviceName: string;
    skipPaths?: string[];
    logStartup?: boolean;
    port?: number | string;
    skipHttpMiddleware?: boolean;
    nestLogger?: LoggerService;
  },
): { logger: StructuredLogger; nestLogger: LoggerService };

export function logServiceReady(serviceName: string, port?: number | string): void;

export function getRequestContext(): Record<string, unknown>;

export function mergeRequestContext(partial: Record<string, unknown>): Record<string, unknown>;

export function runWithRequestContext<T>(context: Record<string, unknown>, fn: () => T): T;
