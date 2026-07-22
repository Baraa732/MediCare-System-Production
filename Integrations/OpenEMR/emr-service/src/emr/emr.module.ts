import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { EmrController } from './controllers/emr.controller';
import { PatientEmrLink } from './entities/patient-emr-link.entity';
import { OpenEmrOAuthConfig } from './entities/openemr-oauth-config.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { EmrRecordService } from './services/emr-record.service';
import { OpenEmrChartService } from './services/openemr-chart.service';
import { OpenEmrClient } from './services/openemr.client';
import { OpenEmrDbReader } from './services/openemr-db.reader';
import { OpenEmrFhirReader } from './services/openemr-fhir.reader';
import { PatientSyncService } from './services/patient-sync.service';
import { EmrTenantGuardService } from './services/emr-tenant-guard.service';
import { EmrSyncConcurrencyService } from './services/emr-sync-concurrency.service';
import { EmrObservabilityService } from './services/emr-observability.service';
import { EmrInternalController, KafkaConsumerService } from './services/kafka.consumer.service';
import { UserKafkaCorroborator } from './services/user-kafka-corroborator.service';
import { PhiAuditPublisherService } from '../phi-audit-shared/phi-audit.publisher';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PatientEmrLink, OpenEmrOAuthConfig]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' } as const,
      }),
      inject: [ConfigService],
    }),
    KafkaClientModule.register({
      clientId: 'emr-service',
      consumerGroupId: 'emr-service-producer',
    }),
  ],
  controllers: [EmrController, KafkaConsumerService, EmrInternalController],
  providers: [
    OpenEmrClient,
    OpenEmrDbReader,
    OpenEmrFhirReader,
    OpenEmrChartService,
    PatientSyncService,
    EmrRecordService,
    EmrTenantGuardService,
    EmrSyncConcurrencyService,
    EmrObservabilityService,
    KafkaConsumerService,
    UserKafkaCorroborator,
    JwtAuthGuard,
    RolesGuard,
    InternalServiceGuard,
    PhiAuditPublisherService,
  ],
  exports: [OpenEmrClient, PatientSyncService, EmrRecordService, OpenEmrChartService],
})
export class EmrModule {}
