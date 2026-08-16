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
  requireInternalAuthConfig('notification-service');

  if (!process.env.JWT_SECRET?.trim()) {
    console.error('ERROR: JWT_SECRET is required and cannot be empty');
    process.exit(1);
  }

  const nestLogger = createMedicareNestLogger('notification-service');
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger: nestLogger });
  const configService = app.get(ConfigService);
  setupMedicareLogging(app, { serviceName: 'notification-service', nestLogger });

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
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  app.connectMicroservice(
    KafkaOptionsFactory.createConsumerOptions(
      configService,
      'notification-service-consumer',
      'notification-service-consumer',
    ),
  );
  await startKafkaMicroservicesWithRetry(app, { logger: console });

  const port = process.env.PORT || 3009;
  await app.listen(port);
  logServiceReady('notification-service', port);

  app.enableShutdownHooks();
}

bootstrap();
