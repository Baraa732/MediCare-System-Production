import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicModule } from './clinic/clinic.module';
import { HealthController } from './health/health.controller';
import { TenantMiddleware } from './tenant-shared/tenant.middleware';
import { TenantModule } from './tenant-shared/tenant.module';
import { medicareTypeOrmExtras } from '@medicare/telemetry';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST') || 'postgres-clinic',
        port: configService.get<number>('DATABASE_PORT') || 5432,
        username: configService.get('DATABASE_USER') || 'postgres',
        password: configService.get('DATABASE_PASSWORD') || 'postgres',
        database: configService.get('DATABASE_NAME') || 'clinic_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/clinic/migrations/*{.ts,.js}'],
        migrationsTableName: 'clinic_migrations',
        // TypeORM runs migrationsRun BEFORE synchronize. On an empty DB with
        // DB_BOOTSTRAP=true, skip auto-migrations so synchronize can create base tables.
        migrationsRun: process.env.DB_BOOTSTRAP !== 'true',
        synchronize: process.env.DB_BOOTSTRAP === 'true',
        extra: {
          max: 25,
          min: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        },
        ...medicareTypeOrmExtras('clinic-service'),
      }),
      inject: [ConfigService],
    }),
    ClinicModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
