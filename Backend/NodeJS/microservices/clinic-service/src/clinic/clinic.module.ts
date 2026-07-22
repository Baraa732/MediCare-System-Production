import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaClientModule } from '../kafka-shared/kafka-client.module';
import { ClinicController } from './controllers/clinic.controller';
import { InternalClinicController } from './controllers/internal-clinic.controller';
import { ClinicService } from './services/clinic.service';
import { clinicTenantAccessProvider } from './services/clinic-local-tenant-access.checker';
import { UserHttpClient } from './services/user-http.client';
import { SchedulingHttpClient } from './services/scheduling-http.client';
import { SystemManagerHttpClient } from './services/system-manager-http.client';
import { Tenant } from './entities/tenant.entity';
import { TenantStaffAssignment } from './entities/tenant-staff-assignment.entity';
import { TenantModule } from '../tenant-shared/tenant.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    TenantModule,
    ConfigModule,
    TypeOrmModule.forFeature([Tenant, TenantStaffAssignment]),
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
    KafkaClientModule.register({
      clientId: 'clinic-service',
      consumerGroupId: 'clinic-service-producer',
    }),
  ],
  controllers: [ClinicController, InternalClinicController],
  providers: [ClinicService, UserHttpClient, SchedulingHttpClient, SystemManagerHttpClient, JwtAuthGuard, InternalServiceGuard, RolesGuard, clinicTenantAccessProvider],
  exports: [ClinicService],
})
export class ClinicModule {}
