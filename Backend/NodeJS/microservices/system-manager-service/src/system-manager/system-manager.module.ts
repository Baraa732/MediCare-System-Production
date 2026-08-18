import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { SystemManagerController } from './controllers/system-manager.controller';
import { SystemManagerService } from './services/system-manager.service';
import { SystemManagerBootstrapService } from './services/system-manager-bootstrap.service';
import { ClinicHttpClient } from './services/clinic-http.client';
import { KafkaConsumerService } from './services/kafka.consumer.service';
import { PlatformHealthService } from './services/platform-health.service';
import { PlatformStatsService } from './services/platform-stats.service';
import { PlatformLogsService } from './services/platform-logs.service';
import { PlatformObservabilityService } from './services/platform-observability.service';
import { PrometheusTelemetryService } from './services/prometheus-telemetry.service';
import { LokiTelemetryService } from './services/loki-telemetry.service';
import { OtelTopologyService } from './services/otel-topology.service';
import { PlatformStreamService } from './services/platform-stream.service';
import { PlatformIncidentsService } from './services/platform-incidents.service';
import { PlatformDataService } from './services/platform-data.service';
import { ActivationDocumentService } from './services/activation-document.service';
import { UserHttpClient } from './services/user-http.client';
import { SystemManager } from './entities/system-manager.entity';
import { ClinicAdminActivation } from './entities/clinic-admin-activation.entity';
import { PlatformIncident } from './entities/platform-incident.entity';
import { PlatformDeployment } from './entities/platform-deployment.entity';
import { AuthHttpClient } from './services/auth-http.client';
import { PlatformSecurityService } from './services/platform-security.service';
import { PlatformQueuesService } from './services/platform-queues.service';
import { PlatformDeploymentsService } from './services/platform-deployments.service';
import { NotificationHttpClient } from './services/notification-http.client';
import { PlatformBroadcastService } from './services/platform-broadcast.service';
import { PlatformOpsNotifyService } from './services/platform-ops-notify.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SystemManager,
      ClinicAdminActivation,
      PlatformIncident,
      PlatformDeployment,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
          algorithm: 'HS256',
        } as any,
      }),
      inject: [ConfigService],
    }),
    // KAFKA_CLIENT must be registered here so SystemManagerService and
    // KafkaConsumerService can inject it via @Inject('KAFKA_CLIENT')
    KafkaClientModule.register({
      clientId: 'system-manager-service',
      consumerGroupId: 'system-manager-service-producer',
    }),
  ],
  // KafkaConsumerService must be in BOTH:
  // - controllers[]: so NestJS binds @EventPattern/@MessagePattern to the microservice transport
  // - providers[]: so SystemManagerService is injected into it via DI
  controllers: [SystemManagerController, KafkaConsumerService],
  providers: [
    SystemManagerService,
    SystemManagerBootstrapService,
    KafkaConsumerService,
    ClinicHttpClient,
    PlatformHealthService,
    PlatformStatsService,
    PlatformLogsService,
    PlatformObservabilityService,
    PrometheusTelemetryService,
    LokiTelemetryService,
    OtelTopologyService,
    PlatformStreamService,
    PlatformIncidentsService,
    PlatformDataService,
    UserHttpClient,
    AuthHttpClient,
    NotificationHttpClient,
    PlatformBroadcastService,
    PlatformOpsNotifyService,
    PlatformSecurityService,
    PlatformQueuesService,
    PlatformDeploymentsService,
    ActivationDocumentService,
    JwtAuthGuard,
    InternalServiceGuard,
  ],
  exports: [SystemManagerService],
})
export class SystemManagerModule {}
