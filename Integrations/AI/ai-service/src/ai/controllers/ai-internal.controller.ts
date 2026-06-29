import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { DeepSeekService } from '../services/deepseek.service';
import { GeminiService } from '../services/gemini.service';
import { AiMetricsService } from '../services/ai-metrics.service';

@ApiExcludeController()
@Controller('internal/ai')
@UseGuards(InternalServiceGuard)
export class AiInternalController {
  constructor(
    private geminiService: GeminiService,
    private deepSeekService: DeepSeekService,
    private metricsService: AiMetricsService,
  ) {}

  @Get('health')
  getHealth() {
    return {
      service: 'ai-service',
      gemini: this.geminiService.getStatus(),
      deepseek: this.deepSeekService.getStatus(),
      metrics: this.metricsService.getMetrics(),
    };
  }
}
