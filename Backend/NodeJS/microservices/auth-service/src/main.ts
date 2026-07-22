import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { KafkaOptionsFactory } from './kafka-shared/kafka-options.factory';
import { SessionService } from './auth/services/session.service';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { setupMedicareLogging, logServiceReady, createMedicareNestLogger } from '@medicare/telemetry';
import { requireInternalAuthConfig } from './internal-auth-shared/internal-auth.config';

async function bootstrap() {
  requireInternalAuthConfig('auth-service');

  const nestLogger = createMedicareNestLogger('auth-service');
  const app = await NestFactory.create(AppModule, { bodyParser: true, bufferLogs: true, logger: nestLogger });
  const configService = app.get(ConfigService);
  const logger = setupMedicareLogging(app, { serviceName: 'auth-service', nestLogger }).logger;

  // Configure trust proxy for correct IP extraction behind API gateway
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

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
    KafkaOptionsFactory.createConsumerOptions(configService, 'auth-service-consumer', 'auth-service-consumer'),
  );

  await app.startAllMicroservices();

  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Auth Service').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  logServiceReady('auth-service', port);

  const shutdown = async (signal: string) => {
    logger.info('Graceful shutdown started', { event: 'shutdown_start', module: 'bootstrap', metadata: { signal } });
    await app.close();
    logger.info('Service shut down cleanly', { event: 'shutdown_complete', module: 'bootstrap' });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ── Scheduled cleanup jobs ─────────────────────────────────────────────────
  // Run every hour to expire stale sessions. In Kubernetes, use the CronJob
  // in k8s/base/cronjobs.yaml instead and disable this interval.
  if (process.env.DISABLE_INLINE_CLEANUP !== 'true') {
    const sessionService = app.get(SessionService);
    setInterval(() => {
      sessionService.cleanupExpiredSessions().catch((err) =>
        logger.error('Session cleanup failed', { event: 'cleanup_failed', module: 'session', err }),
      );
    }, 60 * 60 * 1000); // every hour
  }
}

bootstrap();
