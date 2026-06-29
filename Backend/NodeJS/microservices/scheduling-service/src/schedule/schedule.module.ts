import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { ScheduleController } from './controllers/schedule.controller';
import { InternalScheduleController } from './controllers/internal-schedule.controller';
import { ScheduleService } from './services/schedule.service';
import { ClinicHttpClient } from './services/clinic-http.client';
import { AppointmentHttpClient } from './services/appointment-http.client';
import { ClinicHours } from './entities/clinic-hours.entity';
import { DoctorAvailability } from './entities/doctor-availability.entity';
import { ScheduleBlock } from './entities/schedule-block.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ClinicHours, DoctorAvailability, ScheduleBlock]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' } as any,
      }),
      inject: [ConfigService],
    }),
    KafkaClientModule.register({
      clientId: 'scheduling-service',
      consumerGroupId: 'scheduling-service-producer',
    }),
  ],
  controllers: [ScheduleController, InternalScheduleController],
  providers: [ScheduleService, ClinicHttpClient, AppointmentHttpClient, JwtAuthGuard, InternalServiceGuard, RolesGuard],
})
export class ScheduleModule {}
