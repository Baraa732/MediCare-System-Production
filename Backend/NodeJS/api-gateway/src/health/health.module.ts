import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { GatewayService } from '../gateway/gateway.service';

@Module({
  imports: [HttpModule],
  controllers: [HealthController],
  providers: [GatewayService],
})
export class HealthModule {}