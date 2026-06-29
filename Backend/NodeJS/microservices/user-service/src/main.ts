import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { KafkaOptionsFactory } from './kafka-shared/kafka-options.factory';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { setupMedicareLogging, logServiceReady, createMedicareNestLogger } from '@medicare/telemetry';

function requireInternalServiceToken(serviceName: string): void {
  const token = process.env.INTERNAL_SERVICE_TOKEN?.trim();

  if (!token) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN is required and cannot be empty`);
  }

  if (token.length < 24) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN must be at least 24 characters long`);
  }

  const normalized = token.toLowerCase();
  const weakPatterns = ['changeme', 'replace-me', 'example', 'default', 'test', 'dummy'];
  if (weakPatterns.some((pattern) => normalized.includes(pattern))) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN appears to be a placeholder value`);
  }

  if (/\s/.test(token)) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN must not contain whitespace`);
  }
}

async function bootstrap() {
  requireInternalServiceToken('user-service');

  const nestLogger = createMedicareNestLogger('user-service');
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger: nestLogger });
  const configService = app.get(ConfigService);
  const logger = setupMedicareLogging(app, { serviceName: 'user-service', nestLogger }).logger;

  app.use(require('helmet')());
  app.use(require('express').json({ limit: '10kb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10kb' }));

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  app.connectMicroservice(
    KafkaOptionsFactory.createConsumerOptions(configService, 'user-service-consumer', 'user-service-consumer'),
  );

  await app.startAllMicroservices();

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logServiceReady('user-service', port);

  // Fix 22: Graceful shutdown — drain in-flight requests before exit.
  // The force-exit safety net must be armed ONLY after a shutdown signal is
  // received. Arming it at startup (with unref) still fires after 30s because
  // the HTTP server and Kafka consumer keep the event loop alive — which was
  // killing the process ~30s after boot and causing a restart crash-loop.
  app.enableShutdownHooks();
  const shutdown = async (signal: string) => {
    logger.info('Graceful shutdown started', { event: 'shutdown_start', module: 'bootstrap', metadata: { signal } });
    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded', { event: 'shutdown_timeout', module: 'bootstrap' });
      process.exit(1);
    }, 30_000);
    forceExit.unref();
    await app.close();
    clearTimeout(forceExit);
    logger.info('Service shut down cleanly', { event: 'shutdown_complete', module: 'bootstrap' });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap();
