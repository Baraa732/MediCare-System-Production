import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [PrometheusModule.register(), AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
