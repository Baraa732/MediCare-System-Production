import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { NotificationLog } from './entities/notification-log.entity';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { StaffInboxNotification } from './entities/staff-inbox-notification.entity';
import { NotificationService } from './services/notification.service';
import { KafkaConsumerService } from './services/kafka.consumer.service';
import { WhatsAppService } from './services/whatsapp.service';
import { UserHttpClient } from './services/user-http.client';
import { ClinicHttpClient } from './services/clinic-http.client';
import { FirebasePushService } from './services/firebase-push.service';
import { StaffPushService } from './services/staff-push.service';
import { InternalNotificationController } from './controllers/internal-notification.controller';
import { NotificationController } from './controllers/notification.controller';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([NotificationLog, PushDeviceToken, StaffInboxNotification]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d', algorithm: 'HS256' } as any,
      }),
      inject: [ConfigService],
    }),
    KafkaClientModule.register({
      clientId: 'notification-service',
      consumerGroupId: 'notification-service-producer',
    }),
  ],
  controllers: [NotificationController, InternalNotificationController],
  providers: [
    NotificationService,
    KafkaConsumerService,
    WhatsAppService,
    UserHttpClient,
    ClinicHttpClient,
    FirebasePushService,
    StaffPushService,
    InternalServiceGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class NotificationModule {}
