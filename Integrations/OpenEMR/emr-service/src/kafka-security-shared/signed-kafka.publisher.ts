import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { createSignedKafkaEnvelope } from './kafka-event.signer';
import { getKafkaProducerServiceName } from './kafka-event.config';

@Injectable()
export class SignedKafkaPublisher {
  private readonly logger = new Logger(SignedKafkaPublisher.name);

  constructor(@Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka) {}

  emit<T extends Record<string, unknown>>(eventType: string, payload: T): void {
    const producerService = getKafkaProducerServiceName();
    const envelope = createSignedKafkaEnvelope(eventType, payload, producerService);

    this.kafkaClient.emit(eventType, envelope).subscribe({
      error: (err) => {
        this.logger.error(
          `Failed to emit signed Kafka event ${eventType} eventId=${envelope.eventId}`,
          err instanceof Error ? err.stack : String(err),
        );
      },
    });
  }
}
