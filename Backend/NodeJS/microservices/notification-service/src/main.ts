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
  if (!token || token.length < 24) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN is required (min 24 chars)`);
  }
}

async function bootstrap() {
  requireInternalServiceToken('notification-service');

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
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
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
  await app.startAllMicroservices();

  const port = process.env.PORT || 3009;
  await app.listen(port);
  logServiceReady('notification-service', port);

  app.enableShutdownHooks();
}

bootstrap();
