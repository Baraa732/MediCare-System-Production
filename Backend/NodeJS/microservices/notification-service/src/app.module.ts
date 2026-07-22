import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from './notification/notification.module';
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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST') || 'postgres-notification',
        port: configService.get<number>('DATABASE_PORT') || 5432,
        username: configService.get('DATABASE_USER') || 'postgres',
        password: configService.get('DATABASE_PASSWORD') || 'postgres',
        database: configService.get('DATABASE_NAME') || 'notification_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/notification/migrations/*{.ts,.js}'],
        migrationsTableName: 'notification_migrations',
        synchronize: configService.get('NODE_ENV') !== 'production',
        extra: { max: 25, min: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 },
        ...medicareTypeOrmExtras('notification-service'),
      }),
      inject: [ConfigService],
    }),
    NotificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
