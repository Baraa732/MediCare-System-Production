import { Module } from '@nestjs/common';
import { SignedKafkaPublisher } from './signed-kafka.publisher';

@Module({
  providers: [SignedKafkaPublisher],
  exports: [SignedKafkaPublisher],
})
export class KafkaSecurityModule {}
