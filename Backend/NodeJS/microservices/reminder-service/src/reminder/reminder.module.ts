import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { ScheduledReminder } from './entities/scheduled-reminder.entity';
import { ReminderService } from './services/reminder.service';
import { KafkaConsumerService } from './services/kafka.consumer.service';
import { NotificationHttpClient } from './services/notification-http.client';
import { UserHttpClient } from './services/user-http.client';
import { ClinicHttpClient } from './services/clinic-http.client';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ScheduledReminder]),
    KafkaClientModule.register({
      clientId: 'reminder-service',
      consumerGroupId: 'reminder-service-producer',
    }),
  ],
  controllers: [KafkaConsumerService],
  providers: [
    ReminderService,
    KafkaConsumerService,
    NotificationHttpClient,
    UserHttpClient,
    ClinicHttpClient,
  ],
})
export class ReminderModule {}
