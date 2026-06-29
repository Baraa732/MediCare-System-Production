import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from './schedule/schedule.module';
import { HealthController } from './health/health.controller';
import { TenantModule } from './tenant-shared/tenant.module';
import { TenantMiddleware } from './tenant-shared/tenant.middleware';
import { medicareTypeOrmExtras } from '@medicare/telemetry';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => ({
        type: 'postgres',
        host: c.get('DATABASE_HOST') || 'postgres-scheduling',
        port: c.get<number>('DATABASE_PORT') || 5432,
        username: c.get('DATABASE_USER') || 'postgres',
        password: c.get('DATABASE_PASSWORD') || 'postgres',
        database: c.get('DATABASE_NAME') || 'scheduling_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: c.get('NODE_ENV') !== 'production',
        ...medicareTypeOrmExtras('scheduling-service'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
