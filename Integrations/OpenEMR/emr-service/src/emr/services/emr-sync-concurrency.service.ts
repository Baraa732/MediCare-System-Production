import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

@Injectable()
export class EmrSyncConcurrencyService {
  private readonly logger = new Logger(EmrSyncConcurrencyService.name);
  private readonly maxConcurrent: number;
  private readonly memorySlots = new Map<string, number>();

  constructor(
    configService: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.maxConcurrent = parseInt(
      configService.get<string>('EMR_TENANT_MAX_CONCURRENT') || '3',
      10,
    );
  }

  async acquire(tenantId?: string | null): Promise<() => Promise<void>> {
    const id = tenantId ?? this.tenantContext.getTenantId() ?? 'platform';
    const current = this.memorySlots.get(id) ?? 0;
    if (current >= this.maxConcurrent) {
      throw new ServiceUnavailableException('EMR sync concurrency limit reached for tenant');
    }
    this.memorySlots.set(id, current + 1);
    this.logger.debug(`tenantId=${id} event=emr_sync_acquire active=${current + 1}`);
    return async () => {
      const n = this.memorySlots.get(id) ?? 1;
      if (n <= 1) this.memorySlots.delete(id);
      else this.memorySlots.set(id, n - 1);
    };
  }
}
