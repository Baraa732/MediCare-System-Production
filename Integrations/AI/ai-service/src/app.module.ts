import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health/health.controller';
import { AiExceptionFilter } from './common/filters/ai-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { TenantModule } from './tenant-shared/tenant.module';
import { TenantMiddleware } from './tenant-shared/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST') || 'postgres-ai',
        port: configService.get<number>('DATABASE_PORT') || 5432,
        username: configService.get('DATABASE_USER') || 'postgres',
        password: configService.get('DATABASE_PASSWORD') || 'postgres',
        database: configService.get('DATABASE_NAME') || 'ai_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: process.env.DB_BOOTSTRAP === 'true',
        extra: {
          max: 10,
          min: 2,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),
    AiModule,
  ],
  controllers: [HealthController],
  providers: [
    CorrelationIdMiddleware,
    {
      provide: APP_FILTER,
      useClass: AiExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, TenantMiddleware).forRoutes('*');
  }
}
