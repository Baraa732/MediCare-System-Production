import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { UserController, InternalUserController } from './controllers/user.controller';
import { PublicDoctorController } from './controllers/public-doctor.controller';
import { UserService } from './services/user.service';
import { AccountLinkingController } from './controllers/account-linking.controller';
import { AccountLinkingService } from './services/account-linking.service';
import { KafkaConsumerService } from './services/kafka.consumer.service';
import { IdempotencyService } from './services/idempotency.service';
import { SchemaValidationService } from './services/schema-validation.service';
import { User } from './entities/user.entity';
import { UserAccountLink } from './entities/user-account-link.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { PasswordHistory } from './entities/password-history.entity';
import { ProcessedMessage } from './entities/processed-message.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { OutboxPublisherService } from './services/outbox-publisher.service';
import { AlertingService } from './services/alerting.service';
import { ClinicHttpClient } from './services/clinic-http.client';
import { PhiAuditPublisherService } from '../phi-audit-shared/phi-audit.publisher';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, UserAccountLink, OutboxEvent, PasswordHistory, ProcessedMessage]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const privateKey = configService.get<string>('JWT_PRIVATE_KEY');
        const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
        
        // Use RS256 if keys are provided, otherwise fall back to HS256 for backward compatibility
        if (privateKey && publicKey) {
          return {
            privateKey,
            publicKey,
            signOptions: { algorithm: 'RS256' } as any,
          };
        }
        
        // Fallback to HS256 for backward compatibility
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: { algorithm: 'HS256' } as any,
        };
      },
      inject: [ConfigService],
    }),
    KafkaClientModule.register({
      clientId: 'user-service-producer',
      consumerGroupId: 'user-service-consumer',
    }),
  ],
  // KafkaConsumerService must be in BOTH:
  // - controllers[]: so NestJS binds @MessagePattern/@EventPattern to the microservice transport
  // - providers[]: so its dependencies (UserService, AccountLinkingService) are injected via DI
  controllers: [UserController, PublicDoctorController, InternalUserController, AccountLinkingController, KafkaConsumerService],
  providers: [UserService, AccountLinkingService, KafkaConsumerService, IdempotencyService, SchemaValidationService, JwtAuthGuard, RolesGuard, InternalServiceGuard, OutboxPublisherService, AlertingService, ClinicHttpClient, PhiAuditPublisherService],
  exports: [UserService, AccountLinkingService, OutboxPublisherService, IdempotencyService, SchemaValidationService, KafkaClientModule],
})
export class UserModule {}
