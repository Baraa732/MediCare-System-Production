import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SystemManagerService } from './system-manager.service';

/** Ensures a default platform admin exists after DB resets (idempotent). */
@Injectable()
export class SystemManagerBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SystemManagerBootstrapService.name);

  constructor(private readonly systemManagerService: SystemManagerService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.AUTO_SEED_DEFAULT_ADMIN === 'false') return;

    try {
      const result = await this.systemManagerService.seedDefaultSystemManager();
      this.logger.log(`Default admin bootstrap: ${result.message} (${result.username})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Default admin bootstrap skipped: ${message}`);
    }
  }
}
