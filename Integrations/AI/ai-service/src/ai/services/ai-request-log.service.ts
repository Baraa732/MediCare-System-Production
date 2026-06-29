import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiRequest } from '../entities/ai-request.entity';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

export interface LogAiRequestParams {
  userId: string;
  role: string;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  executionTime: number;
}

@Injectable()
export class AiRequestLogService {
  private readonly logger = new Logger(AiRequestLogService.name);

  constructor(
    @InjectRepository(AiRequest)
    private aiRequestRepo: Repository<AiRequest>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async log(params: LogAiRequestParams): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      JSON.stringify({
        event: 'ai_request',
        tenantId: tenantId ?? 'unknown',
        service: process.env.SERVICE_NAME ?? 'ai-service',
        userId: params.userId,
        role: params.role,
        endpoint: params.endpoint,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        executionTimeMs: params.executionTime,
      }),
    );

    try {
      const record = this.aiRequestRepo.create({
        tenantId: tenantId ?? undefined,
        userId: params.userId,
        role: params.role,
        endpoint: params.endpoint,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        executionTime: params.executionTime,
      });
      await this.aiRequestRepo.save(record);
    } catch (err) {
      this.logger.error(`Failed to persist AI request log: ${(err as Error).message}`);
    }
  }
}
