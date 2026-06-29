import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { KafkaOptionsFactory } from './kafka-shared/kafka-options.factory';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { setupMedicareLogging, logServiceReady, createMedicareNestLogger } from '@medicare/telemetry';

async function bootstrap() {
  const nestLogger = createMedicareNestLogger('scheduling-service');
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger: nestLogger });
  const configService = app.get(ConfigService);
  setupMedicareLogging(app, { serviceName: 'scheduling-service', nestLogger });

  app.use(require('helmet')());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  app.connectMicroservice(
    KafkaOptionsFactory.createConsumerOptions(configService, 'scheduling-service-consumer', 'scheduling-service-consumer'),
  );
  await app.startAllMicroservices();

  const port = process.env.PORT || 3008;
  await app.listen(port);
  logServiceReady('scheduling-service', port);
}
bootstrap();
