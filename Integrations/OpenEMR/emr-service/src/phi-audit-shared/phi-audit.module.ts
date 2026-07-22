import { Module } from '@nestjs/common';
import { PhiAuditPublisherService } from './phi-audit.publisher';

@Module({
  providers: [PhiAuditPublisherService],
  exports: [PhiAuditPublisherService],
})
export class PhiAuditModule {}
