import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { GeminiService } from '../ai/services/gemini.service';
import { DeepSeekService } from '../ai/services/deepseek.service';
import { AiMetricsService } from '../ai/services/ai-metrics.service';
import { AiCacheService } from '../ai/services/ai-cache.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private geminiService: GeminiService,
    private deepSeekService: DeepSeekService,
    private metricsService: AiMetricsService,
    private cacheService: AiCacheService,
  ) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'ai-service', timestamp: new Date().toISOString() };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return { status: 'ok', service: 'ai-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const geminiStatus = await this.geminiService.checkHealth();
    const deepseekStatus = await this.deepSeekService.checkHealth();
    checks.gemini = geminiStatus.reachable ? 'ok' : 'degraded';
    checks.deepseek = deepseekStatus.reachable ? 'ok' : 'degraded';
    checks.ai_enabled = geminiStatus.configured || deepseekStatus.configured ? 'ok' : 'disabled';
    checks.redis = (await this.cacheService.ping()) ? 'ok' : 'degraded';

    const dbOk = checks.database === 'ok';
    if (!dbOk) {
      throw Object.assign(new Error('Service not ready'), {
        response: { status: 'not_ready', service: 'ai-service', checks },
        status: 503,
      });
    }

    return {
      status: 'ready',
      service: 'ai-service',
      timestamp: new Date().toISOString(),
      checks,
      ai: {
        provider: geminiStatus.reachable ? 'gemini' : deepseekStatus.reachable ? 'deepseek' : 'none',
        gemini: geminiStatus,
        deepseek: deepseekStatus,
      },
    };
  }

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  metrics() {
    return {
      service: 'ai-service',
      ai: this.metricsService.getMetrics(),
      gemini: this.geminiService.getStatus(),
      deepseek: this.deepSeekService.getStatus(),
    };
  }
}
