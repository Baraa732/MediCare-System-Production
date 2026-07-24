import './tracing';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as express from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
const CircuitBreaker = require('opossum');
import { randomUUID } from 'crypto';
import { createClient } from 'redis';
import {
  createLogger,
  setupMedicareLogging,
  logServiceReady,
  createMedicareNestLogger,
  createHttpLoggingMiddleware,
  instrumentRedisClient,
  wrapRedisCommand,
} from '@medicare/telemetry';
import { requireInternalAuthConfig } from './internal-auth/internal-auth.config';
import { createInternalAuthHeaders } from './internal-auth/internal-http.signer';
import { verifyInternalRequest } from './internal-auth/internal-auth.crypto';
import { INTERNAL_AUTH_HEADERS } from './internal-auth/types';
import { parseTrustedSecrets } from './internal-auth/internal-auth.config';

const gatewayLogger = createLogger('api-gateway');

// ─── Service registry ─────────────────────────────────────────────────────────
// Loaded from GATEWAY_ROUTES env var (JSON array) so adding a new microservice
// is environment configuration only — no code change, no rebuild.
//
// Example env var:
//   GATEWAY_ROUTES='[
//     {"prefix":"/api/auth","target":"http://auth-service:3001"},
//     {"prefix":"/api/users","target":"http://user-service:3002"}
//   ]'
//
// Falls back to hardcoded defaults when env var is absent (local dev).

interface ServiceRoute {
  prefix: string;
  target: string;
}

function loadServiceRoutes(): ServiceRoute[] {
  const raw = process.env.GATEWAY_ROUTES;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ServiceRoute[];
      if (Array.isArray(parsed) && parsed.every((r) => r.prefix && r.target)) {
        gatewayLogger.info('Gateway routes loaded from env', {
          event: 'gateway_routes_loaded',
          module: 'bootstrap',
          metadata: { count: parsed.length },
        });
        return parsed;
      }
      gatewayLogger.warn('GATEWAY_ROUTES is malformed — falling back to defaults', {
        event: 'gateway_routes_fallback',
        module: 'bootstrap',
      });
    } catch {
      gatewayLogger.warn('GATEWAY_ROUTES JSON parse failed — falling back to defaults', {
        event: 'gateway_routes_fallback',
        module: 'bootstrap',
      });
    }
  }

  return [
    { prefix: '/api/auth',            target: process.env.AUTH_SERVICE_URL           || 'http://auth-service:3001' },
    { prefix: '/api/users',           target: process.env.USER_SERVICE_URL            || 'http://user-service:3002' },
    { prefix: '/api/account-linking', target: process.env.USER_SERVICE_URL            || 'http://user-service:3002' },
    { prefix: '/api/system-manager',  target: process.env.SYSTEM_MANAGER_SERVICE_URL  || 'http://system-manager-service:3003' },
    { prefix: '/api/emr',             target: process.env.EMR_SERVICE_URL             || 'http://emr-service:3004' },
    { prefix: '/api/clinics',         target: process.env.CLINIC_SERVICE_URL          || 'http://clinic-service:3006' },
    { prefix: '/api/appointments',    target: process.env.APPOINTMENT_SERVICE_URL     || 'http://appointment-service:3007' },
    { prefix: '/api/schedule',        target: process.env.SCHEDULING_SERVICE_URL      || 'http://scheduling-service:3008' },
    { prefix: '/api/notifications',   target: process.env.NOTIFICATION_SERVICE_URL    || 'http://notification-service:3009' },
  ];
}

// ─── Public routes — skip JWT validation ─────────────────────────────────────
const PRODUCTION_PUBLIC_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/login',
  '/api/auth/refresh-token',
  '/api/auth/reset-password',
  '/api/auth/forgot-password/send-otp',
  '/api/auth/forgot-password/verify-otp',
  '/api/auth/verify-mfa',
  '/api/auth/staff/complete-activation',
  '/api/auth/resend-otp',
  '/api/auth/resend-mfa-otp',
  '/api/auth/check-otp-status',
  '/api/auth/clinic-admin/activate',
  '/api/auth/clinic-admin/onboarding-status',
  '/api/system-manager/login',
  '/api/notifications/push/web-config',
  '/health',
  '/health/live',
  '/health/ready',
  '/metrics',
]);

const DEV_ONLY_PUBLIC_PATHS = new Set([
  '/api/system-manager/dev/seed-default',
  '/api/system-manager/dev/seed',
  '/api/auth/dev/whatsapp-qr',
  '/api/auth/dev/whatsapp-status',
  '/api/auth/dev/latest-otp',
  '/api/auth/dev/clear-rate-limits',
]);

const DEV_ONLY_PUBLIC_PATH_PREFIXES = ['/api/auth/dev/', '/api/system-manager/dev/'];

function isDevGatewayEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

function isDevOnlyGatewayRoute(path: string): boolean {
  if (DEV_ONLY_PUBLIC_PATHS.has(path)) return true;
  return DEV_ONLY_PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function getPublicGatewayPaths(): Set<string> {
  if (!isDevGatewayEnvironment()) return PRODUCTION_PUBLIC_PATHS;
  return new Set([...PRODUCTION_PUBLIC_PATHS, ...DEV_ONLY_PUBLIC_PATHS]);
}

function normalizeGatewayPath(req: express.Request): string {
  // Prefer req.url so legacy /api rewrite middleware is reflected in auth checks.
  const raw = (req.url || req.originalUrl || req.path || '').split('?')[0];
  if (!raw) return '/';
  return raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function isPublicGatewayRoute(path: string, method: string): boolean {
  if (isDevOnlyGatewayRoute(path) && !isDevGatewayEnvironment()) {
    return false;
  }

  if (getPublicGatewayPaths().has(path)) return true;

  if (method !== 'POST') return false;

  // Password reset must stay public even if PUBLIC_PATHS drifts during deploys.
  return (
    path === '/api/auth/forgot-password/send-otp' ||
    path === '/api/auth/forgot-password/verify-otp' ||
    path === '/api/auth/reset-password'
  );
}

// ─── Internal headers that clients must never be able to spoof ───────────────
// These are stripped from every incoming request before we inject our own values.
const INTERNAL_HEADERS = [
  'x-service-token',
  INTERNAL_AUTH_HEADERS.SERVICE_NAME,
  INTERNAL_AUTH_HEADERS.SIGNATURE,
  INTERNAL_AUTH_HEADERS.TIMESTAMP,
  'x-request-id',
  'x-forwarded-for',
  'x-tenant-id',
];

// ─── Request ID sanitisation ──────────────────────────────────────────────────
// Accepts a client-supplied x-request-id for tracing continuity (e.g. mobile
// apps that generate their own trace IDs). Rejects values that are:
//   - empty or too long
//   - contain unsafe characters
//   - low-entropy (all same character, e.g. "aaaaaaaaaa" or "____________")
//     because these create log noise and break correlation queries
function sanitiseRequestId(raw: string): string {
  if (!raw) return randomUUID();

  // Length and character class
  if (!/^[a-zA-Z0-9\-_]{1,64}$/.test(raw)) return randomUUID();

  // Entropy check — reject if all characters are identical
  // e.g. "aaaaaaaaaaaaaaaa" or "________________"
  const unique = new Set(raw).size;
  if (unique < 2) return randomUUID();

  // Reject if more than 80% of characters are the same single character
  // e.g. "aaaaaaaaaaaaaab" — technically passes regex but is still low-entropy
  const maxFreq = Math.max(
    ...Object.values(
      raw.split('').reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {}),
    ),
  );
  if (maxFreq / raw.length > 0.8) return randomUUID();

  return raw;
}

async function bootstrap() {
  const nestLogger = createMedicareNestLogger('api-gateway');
  const app = await NestFactory.create(AppModule, {
    // Disable NestJS body parser — http-proxy-middleware needs raw body stream
    bodyParser: false,
    bufferLogs: true,
    logger: nestLogger,
  });
  const logger = setupMedicareLogging(app, {
    serviceName: 'api-gateway',
    nestLogger,
    skipHttpMiddleware: true,
  }).logger;

  // ── Redis client for JWT caching ─────────────────────────────────────────────
  let redisClient: ReturnType<typeof createClient> | null = null;
  const redisEnabled = process.env.JWT_CACHE_ENABLED !== 'false';
  
  if (redisEnabled) {
    try {
      redisClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        password: process.env.REDIS_PASSWORD,
      });

      instrumentRedisClient(redisClient, 'api-gateway', 'jwt-cache');
      wrapRedisCommand(redisClient, 'api-gateway', 'jwt-cache');
      await redisClient.connect();
      logger.info('JWT cache connected to Redis', { event: 'redis_ready', module: 'jwt-cache' });
    } catch (err) {
      logger.error('Failed to connect Redis for JWT cache', {
        event: 'redis_connect_failed',
        module: 'jwt-cache',
        err,
      });
      redisClient = null;
    }
  }

  // JWT cache helper functions — tenant-scoped keys when tenantId known
  const getCacheKey = (token: string, tenantId?: string): string => {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return tenantId ? `tenant:${tenantId}:jwt:${hash}` : `jwt:${hash}`;
  };

  const getSessionIndexKey = (sessionId: string, tenantId?: string): string =>
    tenantId ? `tenant:${tenantId}:jwt:idx:session:${sessionId}` : `jwt:idx:session:${sessionId}`;
  const getUserIndexKey = (userId: string, tenantId?: string): string =>
    tenantId ? `tenant:${tenantId}:jwt:idx:user:${userId}` : `jwt:idx:user:${userId}`;

  const removeByIndexKey = async (indexKey: string): Promise<number> => {
    if (!redisClient) return 0;
    try {
      const members = await redisClient.sMembers(indexKey);
      if (members.length === 0) {
        await redisClient.del(indexKey);
        return 0;
      }
      const keys = [...new Set(members)];
      await redisClient.del([...keys, indexKey]);
      return keys.length;
    } catch (error) {
      logger.error('Cache invalidation failed', {
        event: 'redis_cache_invalidate_failed',
        module: 'jwt-cache',
        err: error instanceof Error ? error : new Error(String(error)),
        metadata: { index_key: indexKey },
      });
      return 0;
    }
  };

  const peekTenantIdFromToken = (token: string): string | undefined => {
    try {
      const segment = token.split('.')[1];
      if (!segment) return undefined;
      const payload = JSON.parse(
        Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
      ) as { tenantId?: string };
      return payload.tenantId;
    } catch {
      return undefined;
    }
  };

  const peekRoleFromToken = (token: string): string | undefined => {
    try {
      const segment = token.split('.')[1];
      if (!segment) return undefined;
      const payload = JSON.parse(
        Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
      ) as { role?: string };
      return payload.role;
    } catch {
      return undefined;
    }
  };

  const getCachedValidation = async (token: string): Promise<any | null> => {
    if (!redisClient) return null;
    try {
      const tenantId = peekTenantIdFromToken(token);
      const key = getCacheKey(token, tenantId);
      const data = await redisClient.get(key);
      if (data) {
        const cached = JSON.parse(data);
        if (cached.expiresAt > Date.now()) {
          return cached;
        } else {
          await redisClient.del(key);
        }
      }
    } catch (error) {
      logger.error('JWT cache read failed', {
        event: 'redis_cache_read_failed',
        module: 'jwt-cache',
        err: error instanceof Error ? error : new Error(String(error)),
      });
    }
    return null;
  };

  const setCachedValidation = async (token: string, validation: any): Promise<void> => {
    if (!redisClient) return;
    try {
      const key = getCacheKey(token, validation.tenantId);
      const ttl = parseInt(process.env.JWT_CACHE_TTL || '300', 10); // 5 minutes default
      const sessionIndexKey = validation.sessionId
        ? getSessionIndexKey(validation.sessionId, validation.tenantId)
        : null;
      const userIndexKey = validation.userId
        ? getUserIndexKey(validation.userId, validation.tenantId)
        : null;

      const multi = redisClient.multi();
      multi.setEx(key, ttl, JSON.stringify(validation));
      if (sessionIndexKey) {
        multi.sAdd(sessionIndexKey, key);
        multi.expire(sessionIndexKey, ttl);
      }
      if (userIndexKey) {
        multi.sAdd(userIndexKey, key);
        multi.expire(userIndexKey, ttl);
      }
      await multi.exec();
    } catch (error) {
      logger.error('JWT cache write failed', {
        event: 'redis_cache_write_failed',
        module: 'jwt-cache',
        err: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(helmet());
  // Body parsing is intentionally scoped to the gateway's OWN endpoints only
  // (/internal/*). Proxied /api/* requests must keep their raw body stream so
  // http-proxy-middleware can pipe it directly to the upstream service.
  // Parsing the body globally consumes the stream, and with
  // http-proxy-middleware v3 the upstream then hangs waiting for a body that
  // never arrives (Content-Length set, 0 bytes received → "request aborted").
  // Fix 21: 1mb limit to prevent memory exhaustion.
  app.use('/internal', express.json({ limit: '1mb' }));
  app.use('/internal', express.urlencoded({ extended: true, limit: '1mb' }));

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    methods: 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
    credentials: true,
    maxAge: 86400, // 24 hours - cache preflight requests
    // x-request-id and x-session-id are allowed from clients for tracing
    // x-service-token is NOT listed — clients should never send it
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With,X-CSRF-Token,X-Request-Id,X-Session-Id,X-Tenant-ID,Idempotency-Key',
  });

  const expressApp = app.getHttpAdapter().getInstance();
  const internalAuth = requireInternalAuthConfig('api-gateway');
  const trustedSecrets = parseTrustedSecrets(process.env.INTERNAL_AUTH_TRUSTED_SECRETS, 'api-gateway');

  expressApp.post('/internal/cache/auth/invalidate', async (req: express.Request, res: express.Response) => {
    const callerName = req.headers[INTERNAL_AUTH_HEADERS.SERVICE_NAME] as string | undefined;
    const signature = req.headers[INTERNAL_AUTH_HEADERS.SIGNATURE] as string | undefined;
    const timestamp = req.headers[INTERNAL_AUTH_HEADERS.TIMESTAMP] as string | undefined;

    if (!callerName || !signature || !timestamp) {
      res.status(401).json({ message: 'Unauthorized internal cache invalidation request' });
      return;
    }

    const callerSecret = trustedSecrets[callerName];
    if (
      !callerSecret ||
      !verifyInternalRequest(
        callerSecret,
        'POST',
        '/internal/cache/auth/invalidate',
        req.body,
        timestamp,
        signature,
      )
    ) {
      res.status(401).json({ message: 'Unauthorized internal cache invalidation request' });
      return;
    }

    if (callerName !== 'auth-service') {
      res.status(403).json({ message: 'Forbidden internal cache invalidation caller' });
      return;
    }

    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined;

    const userId = typeof req.body?.userId === 'string' ? req.body.userId : undefined;
    const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : undefined;

    if (!sessionId && !userId) {
      res.status(400).json({ message: 'sessionId or userId is required' });
      return;
    }

    const result = { invalidatedBySession: 0, invalidatedByUser: 0 };
    if (sessionId) {
      result.invalidatedBySession = await removeByIndexKey(getSessionIndexKey(sessionId, tenantId));
      if (!result.invalidatedBySession && !tenantId) {
        result.invalidatedBySession = await removeByIndexKey(getSessionIndexKey(sessionId));
      }
    }
    if (userId) {
      result.invalidatedByUser = await removeByIndexKey(getUserIndexKey(userId, tenantId));
      if (!result.invalidatedByUser && !tenantId) {
        result.invalidatedByUser = await removeByIndexKey(getUserIndexKey(userId));
      }
    }

    res.json({ ok: true, ...result });
  });

  expressApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self';");
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    next();
  });

  // ── Strip internal headers from ALL incoming requests ────────────────────────
  expressApp.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    for (const header of INTERNAL_HEADERS) {
      delete req.headers[header];
    }
    next();
  });

  // ── Correlation ID — assigned after stripping, so clients cannot inject it ──
  expressApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const raw      = (req.headers['x-request-id'] as string | undefined)?.trim() ?? '';
    const requestId = sanitiseRequestId(raw);
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  expressApp.use(createHttpLoggingMiddleware('api-gateway'));

  // ── Health check — handled locally, never proxied ───────────────────────────
  expressApp.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Compat: older dashboard builds called gateway paths without the /api prefix
  // (e.g. /system-manager/login). Rewrite so cached clients still reach public
  // routes instead of getting 401 "Authorization header is required".
  const LEGACY_UNPREFIXED_API =
    /^\/(auth|users|account-linking|system-manager|emr|clinics|appointments|schedule|notifications)(\/|$|\?)/;
  expressApp.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const raw = req.url || '';
    const pathOnly = raw.split('?')[0];
    if (pathOnly.startsWith('/api/') || pathOnly === '/api') return next();
    if (!LEGACY_UNPREFIXED_API.test(pathOnly)) return next();
    req.url = '/api' + raw;
    next();
  });

  // ── Auth validation middleware ───────────────────────────────────────────────
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
  const systemManagerServiceUrl =
    process.env.SYSTEM_MANAGER_SERVICE_URL || 'http://system-manager-service:3003';

  const validateTokenUrl = (path: string, token: string): string => {
    if (path.startsWith('/api/system-manager/')) {
      const role = peekRoleFromToken(token);
      if (role && role !== 'SYSTEM_MANAGER') {
        return `${authServiceUrl}/v1/auth/validate-token`;
      }
      return `${systemManagerServiceUrl}/v1/system-manager/validate-token`;
    }

    // Platform-admin JWTs are issued by system-manager-service (no auth sessionId).
    // Validating them against auth-service always fails with "Authentication failed".
    try {
      const segment = token.split('.')[1];
      if (segment) {
        const payload = JSON.parse(
          Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
        ) as { role?: string };
        if (payload.role === 'SYSTEM_MANAGER') {
          return `${systemManagerServiceUrl}/v1/system-manager/validate-token`;
        }
      }
    } catch {
      // Fall through to auth-service validation.
    }

    return `${authServiceUrl}/v1/auth/validate-token`;
  };

  expressApp.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestPath = normalizeGatewayPath(req);

    if (isDevOnlyGatewayRoute(requestPath) && !isDevGatewayEnvironment()) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    if (isPublicGatewayRoute(requestPath, req.method) || req.method === 'OPTIONS') return next();

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      res.status(401).json({ message: 'Authorization header is required' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Check cache first
      const cached = await getCachedValidation(token);
      
      if (cached) {
        req.headers['x-user-id'] = cached.userId;
        req.headers['x-user-role'] = cached.role;
        if (cached.tenantId && cached.role !== 'PATIENT') {
          req.headers['x-tenant-id'] = cached.tenantId;
        }
        if (cached.sessionId) {
          req.headers['x-session-id'] = cached.sessionId;
        }
        return next();
      }

      // Cache miss — auth-service for users; system-manager-service for platform admin JWT
      const axios = require('axios');
      const validateUrl = validateTokenUrl(req.path, token);
      const validatePath = new URL(validateUrl).pathname;
      const validateHeaders = createInternalAuthHeaders(
        internalAuth.serviceName,
        internalAuth.signingSecret,
        'GET',
        validatePath,
        '',
        { authorization: authHeader, 'x-request-id': req.headers['x-request-id'] as string },
      );
      const response = await axios.get(validateUrl, {
        headers: validateHeaders,
        timeout: 5000,
      });

      // Cache the validation result
      if (response.data?.user) {
        const sessionId =
          response.data.user.sessionId ||
          (req.path.startsWith('/api/system-manager/')
            ? `sm-${response.data.user.id}`
            : undefined);

        const tenantId =
          response.data.user.tenantId ||
          peekTenantIdFromToken(token) ||
          (req.headers['x-tenant-id'] as string | undefined);

        await setCachedValidation(token, {
          userId: response.data.user.id,
          role: response.data.user.role,
          sessionId: sessionId || '',
          tenantId: tenantId || '',
          expiresAt: Date.now() + (5 * 60 * 1000),
        });
        
        req.headers['x-user-id'] = response.data.user.id;
        req.headers['x-user-role'] = response.data.user.role;
        if (sessionId) {
          req.headers['x-session-id'] = sessionId;
        }
        if (tenantId && response.data.user.role !== 'PATIENT') {
          req.headers['x-tenant-id'] = tenantId;
        }
      }

      next();
    } catch (err: any) {
      const status  = err.response?.status  || 503;
      const message = err.response?.data?.message || 'Authentication failed';
      res.status(status).json({ message });
    }
  });

  // ── Dynamic proxy routes with per-service circuit breakers ──────────────────
  const serviceRoutes = loadServiceRoutes();

  for (const route of serviceRoutes) {
    const routeTimeoutMs = 60_000;

    const proxy = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      timeout: routeTimeoutMs,
      proxyTimeout: routeTimeoutMs,
      // Microservices use /v1/* controllers. expressApp.use(route.prefix) strips the
      // mount path from req.url (e.g. /api/auth/register → /register), so rewrite the
      // relative path instead of matching the full public prefix.
      pathRewrite: (path: string) => `${route.prefix.replace('/api', '/v1')}${path}`,
      on: {
        proxyReq: (proxyReq, req) => {
          const expressReq = req as express.Request;
          const method = (expressReq.method || 'GET').toUpperCase();
          const relativePath = (expressReq.url || '').split('?')[0];
          const upstreamPath = `${route.prefix.replace('/api', '/v1')}${relativePath}`;
          const authHeaders = createInternalAuthHeaders(
            internalAuth.serviceName,
            internalAuth.signingSecret,
            method,
            upstreamPath,
            '',
          );
          for (const [key, value] of Object.entries(authHeaders)) {
            proxyReq.setHeader(key, value);
          }
          proxyReq.setHeader('x-request-id', expressReq.headers['x-request-id'] || '');
          // Inject real client IP for downstream rate limiting and audit logs
          const clientIp = (req as express.Request).socket.remoteAddress || '';
          proxyReq.setHeader('x-forwarded-for', clientIp);
          proxyReq.setHeader('x-real-ip', clientIp);
          const tenantHeader = (req as express.Request).headers['x-tenant-id'];
          if (tenantHeader) {
            proxyReq.setHeader('x-tenant-id', tenantHeader);
          }
          const contentType = (req as express.Request).headers['content-type'] ?? '';
          if (!contentType.includes('multipart/form-data')) {
            fixRequestBody(proxyReq, req as express.Request);
          }
        },
        error: (_err, _req, res) => {
          (res as express.Response)
            .status(502)
            .json({ message: 'Bad gateway — upstream service unreachable' });
        },
      },
    });

    // Fix 20: Tighten circuit breaker — open after 5 failures in 10s, reset after 10s
    const breaker = new CircuitBreaker(
      (req: express.Request, res: express.Response) =>
        new Promise<void>((resolve, reject) => {
          const done = () => resolve();
          res.once('finish', done);
          res.once('close', done);
          proxy(req, res, (err?: unknown) => {
            if (err) {
              res.off('finish', done);
              res.off('close', done);
              reject(err);
            }
          });
        }),
      {
        timeout: routeTimeoutMs,
        errorThresholdPercentage: 50,
        resetTimeout: 15_000,
        volumeThreshold: 5,
        name: route.prefix,
      },
    );

    breaker.fallback((_req: express.Request, res: express.Response) => {
      res.status(503).json({
        message: 'Service temporarily unavailable. Please retry in a moment.',
        service: route.prefix,
      });
    });

    breaker.on('open', () =>
      logger.warn('Circuit breaker opened', {
        event: 'circuit_open',
        module: 'circuit-breaker',
        metadata: { route: route.prefix },
      }),
    );
    breaker.on('halfOpen', () =>
      logger.info('Circuit breaker half-open', {
        event: 'circuit_half_open',
        module: 'circuit-breaker',
        metadata: { route: route.prefix },
      }),
    );
    breaker.on('close', () =>
      logger.info('Circuit breaker closed', {
        event: 'circuit_closed',
        module: 'circuit-breaker',
        metadata: { route: route.prefix },
      }),
    );

    expressApp.use(route.prefix, (req: express.Request, res: express.Response) => {
      breaker.fire(req, res).catch(() => {
        // fallback already handled by breaker.fallback()
      });
    });
  }

  // ── Swagger — development only ───────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('MediCare API Gateway')
      .setDescription('Dynamic proxy — routes loaded from GATEWAY_ROUTES env var')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api-docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT || 3000;
  const server = await app.listen(port);
  logServiceReady('api-gateway', port);
  logger.debug('Gateway proxy routes registered', {
    event: 'gateway_routes_registered',
    module: 'bootstrap',
    metadata: { routes: serviceRoutes.map((r) => r.prefix) },
  });

  // Fix 22: Graceful shutdown — drain in-flight requests before exit
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => {
    logger.info('Graceful shutdown started', { event: 'shutdown_start', module: 'bootstrap', metadata: { signal: 'SIGTERM' } });
    server.close(() => logger.info('HTTP server closed', { event: 'http_server_closed', module: 'bootstrap' }));
    const forceExit = setTimeout(() => {
      logger.error('Drain timeout exceeded', { event: 'shutdown_timeout', module: 'bootstrap' });
      process.exit(1);
    }, 30_000);
    forceExit.unref();
    await app.close();
    process.exit(0);
  });
}

bootstrap();
