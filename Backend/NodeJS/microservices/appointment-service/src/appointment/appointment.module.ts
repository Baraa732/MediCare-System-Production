import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { AppointmentController } from './controllers/appointment.controller';
import { InternalAppointmentController } from './controllers/internal-appointment.controller';
import { AppointmentService } from './services/appointment.service';
import { UserHttpClient } from './services/user-http.client';
import { ClinicHttpClient } from './services/clinic-http.client';
import { SchedulingHttpClient } from './services/scheduling-http.client';
import { Appointment } from './entities/appointment.entity';
import { PatientClinicRelation } from './entities/patient-clinic-relation.entity';
import { DoctorPatientAssignment } from './entities/doctor-patient-assignment.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { PhiAuditPublisherService } from '../phi-audit-shared/phi-audit.publisher';
import { SignedKafkaPublisher } from '../kafka-security-shared/signed-kafka.publisher';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Appointment, PatientClinicRelation, DoctorPatientAssignment]),
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
      clientId: 'appointment-service',
      consumerGroupId: 'appointment-service-producer',
    }),
  ],
  controllers: [AppointmentController, InternalAppointmentController],
  providers: [
    AppointmentService,
    UserHttpClient,
    ClinicHttpClient,
    SchedulingHttpClient,
    JwtAuthGuard,
    RolesGuard,
    InternalServiceGuard,
    PhiAuditPublisherService,
    SignedKafkaPublisher,
  ],
})
export class AppointmentModule {}
