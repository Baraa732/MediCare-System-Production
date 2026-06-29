import { ConfigService } from '@nestjs/config';
import { KafkaOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';

const IDEMPOTENT_PRODUCER_RETRY = {
  initialRetryTime: 300,
  retries: Number.MAX_SAFE_INTEGER,
  maxRetryTime: 30_000,
};

export class KafkaOptionsFactory {
  /**
   * Parse KAFKA_BROKERS env var (comma-separated) into a string array.
   * Falls back to KAFKA_BROKER (legacy single-broker var) for backwards compat.
   *
   * KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092
   */
  static getBrokers(config: ConfigService): string[] {
    const multi = config.get<string>('KAFKA_BROKERS');
    if (multi) return multi.split(',').map((b) => b.trim());

    // Legacy fallback — single broker
    return [config.getOrThrow<string>('KAFKA_BROKER')];
  }

  /**
   * Options for connectMicroservice() — the consumer transport that handles
   * @EventPattern and @MessagePattern decorators.
   */
  static createConsumerOptions(config: ConfigService, clientId: string, groupId: string): KafkaOptions {
    return {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId,
          brokers: KafkaOptionsFactory.getBrokers(config),
          retry: {
            initialRetryTime: config.get<number>('KAFKA_RETRY_INITIAL_MS') ?? 300,
            retries: config.get<number>('KAFKA_RETRY_COUNT') ?? 8,
          },
          connectionTimeout: config.get<number>('KAFKA_CONNECTION_TIMEOUT') ?? 10000,
          requestTimeout: config.get<number>('KAFKA_REQUEST_TIMEOUT') ?? 30000,
        },
        consumer: {
          groupId,
          allowAutoTopicCreation: false,
          retry: { retries: 8 },
        },
        producer: {
          idempotent: true,
          maxInFlightRequestsPerConnection: 5,
          createPartitioner: Partitioners.LegacyPartitioner,
          retry: IDEMPOTENT_PRODUCER_RETRY,
        } as Record<string, unknown>,
      },
    };
  }
}
