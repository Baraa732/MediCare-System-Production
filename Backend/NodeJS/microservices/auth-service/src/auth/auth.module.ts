import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { UserHttpClient } from './services/user-http.client';
import { ClinicHttpClient } from './services/clinic-http.client';
import { WhatsAppService } from './services/whatsapp.service';
import { SessionService } from './services/session.service';
import { AuditLogService } from './services/audit-log.service';
import { PhiAuditLogService } from './services/phi-audit-log.service';
import { PhiAuditConsumerService } from './services/phi-audit-consumer.service';
import { RateLimitService } from './services/rate-limit.service';
import { AccountLockService } from './services/account-lock.service';
import { SessionAnomalyService } from './services/session-anomaly.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Otp } from './entities/otp.entity';
import { Session } from './entities/session.entity';
import { AuditLog } from './entities/audit-log.entity';
import { PhiAuditLog } from './entities/phi-audit-log.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { AccountLock } from './entities/account-lock.entity';
import { JwtBlocklistEntry } from './entities/jwt-blocklist.entity';
import { TrustedDevice } from './entities/trusted-device.entity';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IdempotencyGuard } from './guards/idempotency.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware';
import { IdempotencyService } from './services/idempotency.service';
import { JwtBlocklistService } from './services/jwt-blocklist.service';
import { TrustedDeviceService } from './services/trusted-device.service';
import { RedisCircuitBreakerService } from './services/redis-circuit-breaker.service';
import { CleanupTasks } from './tasks/cleanup.tasks';
import { TenantModule } from '../tenant-shared/tenant.module';
import { TenantMiddleware } from '../tenant-shared/tenant.middleware';
import { medicareTypeOrmExtras } from '@medicare/telemetry';
import { PhiAuditPublisherService } from '../phi-audit-shared/phi-audit.publisher';

@Module({
  imports: [
    TenantModule,
    ConfigModule.forRoot({ isGlobal: true }),
    // Fix 15-18: Enable NestJS scheduler for cron jobs
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      name: 'authConnection',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        host: configService.get('DATABASE_HOST') || 'postgres-auth',
        port: configService.get<number>('DATABASE_PORT') || 5432,
        username: configService.get('DATABASE_USER') || 'postgres',
        password: configService.get('DATABASE_PASSWORD') || 'postgres',
        database: configService.get('DATABASE_NAME') || 'auth_db',
        // Fix 4, 5: Register new entities for DB fallback
        entities: [Otp, Session, AuditLog, PhiAuditLog, IdempotencyKey, AccountLock, JwtBlocklistEntry, TrustedDevice],
        migrations: [__dirname + '/auth/migrations/*{.ts,.js}'],
        migrationsTableName: 'auth_migrations',
        synchronize: configService.get('NODE_ENV') !== 'production',
        // HIGH FIX: Configure connection pools for production load
        poolSize: 50,
        extra: {
          max: 50,
          min: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
        ...medicareTypeOrmExtras('auth-service'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(
      [Otp, Session, AuditLog, PhiAuditLog, IdempotencyKey, AccountLock, JwtBlocklistEntry, TrustedDevice],
      'authConnection',
    ),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const privateKey = configService.get<string>('JWT_PRIVATE_KEY');
        const publicKey = configService.get<string>('JWT_PUBLIC_KEY');

        // Fix 9: Use RS256 if keys are provided, otherwise fall back to HS256
        if (privateKey && publicKey) {
          return {
            privateKey,
            publicKey,
            signOptions: {
              expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
              algorithm: 'RS256',
            } as any,
          };
        }

        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
            algorithm: 'HS256',
          } as any,
        };
      },
      inject: [ConfigService],
    }),
    KafkaClientModule.register({
      clientId: 'auth-service',
      consumerGroupId: 'auth-service-consumer',
    }),
  ],
  controllers: [AuthController, PhiAuditConsumerService],
  providers: [
    AuthService, UserHttpClient, ClinicHttpClient, WhatsAppService, SessionService, AuditLogService,
    PhiAuditLogService, PhiAuditConsumerService, PhiAuditPublisherService,
    RateLimitService, AccountLockService, SessionAnomalyService,
    IdempotencyService, JwtBlocklistService, TrustedDeviceService, RedisCircuitBreakerService, JwtStrategy, RateLimitGuard,
    IdempotencyGuard, IdempotencyInterceptor, CsrfGuard, InternalServiceGuard,
    // Fix 15-18: Scheduled cleanup tasks
    CleanupTasks,
  ],
  exports: [
    AuthService, SessionService, AuditLogService, RateLimitService,
    AccountLockService, IdempotencyService, JwtBlocklistService, TrustedDeviceService, RedisCircuitBreakerService, JwtStrategy, PassportModule,
    RateLimitGuard, IdempotencyGuard, IdempotencyInterceptor,
    KafkaClientModule,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, TenantMiddleware).forRoutes('*');
  }
}
