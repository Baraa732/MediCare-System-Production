import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { KafkaOptionsFactory } from './kafka-shared/kafka-options.factory';
import { startKafkaMicroservicesWithRetry } from './kafka-shared/start-kafka-microservices';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { setupMedicareLogging, logServiceReady, createMedicareNestLogger } from '@medicare/telemetry';
import { requireInternalAuthConfig } from './internal-auth-shared/internal-auth.config';

async function bootstrap() {
  requireInternalAuthConfig('clinic-service');

  const nestLogger = createMedicareNestLogger('clinic-service');
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger: nestLogger });
  const configService = app.get(ConfigService);
  const logger = setupMedicareLogging(app, { serviceName: 'clinic-service', nestLogger }).logger;

  app.use(require('helmet')());
  app.use(require('express').json({ limit: '10kb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10kb' }));

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
  app.enableCors({
    origin: (origin, callback) => {
      // Rejecting via an Error would surface as a 500; deny the origin instead.
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  app.connectMicroservice(
    KafkaOptionsFactory.createConsumerOptions(configService, 'clinic-service-consumer', 'clinic-service-consumer'),
  );

  await startKafkaMicroservicesWithRetry(app, { logger: console });

  const port = process.env.PORT || 3006;
  await app.listen(port);
  logServiceReady('clinic-service', port);

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
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
