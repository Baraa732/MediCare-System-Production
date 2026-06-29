import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

function requireInternalServiceToken(serviceName: string): void {
  const token = process.env.INTERNAL_SERVICE_TOKEN?.trim();
  if (!token) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN is required and cannot be empty`);
  }
  if (token.length < 24) {
    throw new Error(`[${serviceName}] INTERNAL_SERVICE_TOKEN must be at least 24 characters long`);
  }
}

async function bootstrap() {
  requireInternalServiceToken('ai-service');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(require('helmet')());
  app.use(require('express').json({ limit: '256kb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (configService.get('NODE_ENV') === 'development') {
    const config = new DocumentBuilder()
      .setTitle('MediCare AI Service')
      .setDescription(
        'Ollama-powered AI endpoints for clinical documentation, OCR cleanup, and patient/doctor assistants',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('AI')
      .build();
    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT || 3005;
  await app.listen(port);
  console.log(`AI Service running on port ${port}`);

  app.enableShutdownHooks();
  const shutdown = async (signal: string) => {
    console.log(`${signal} received — starting graceful shutdown`);
    const forceExit = setTimeout(() => process.exit(1), 30_000);
    forceExit.unref();
    await app.close();
    clearTimeout(forceExit);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
