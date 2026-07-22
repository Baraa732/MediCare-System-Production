import { ConfigService } from '@nestjs/config';
import { KafkaOptions, Transport } from '@nestjs/microservices';

function buildKafkaClientSecurity(config: ConfigService): Record<string, unknown> {
  const protocol = (config.get<string>('KAFKA_SECURITY_PROTOCOL') ?? 'PLAINTEXT').toUpperCase();
  if (protocol === 'PLAINTEXT') return {};
  const username = config.get<string>('KAFKA_SASL_USERNAME');
  const password = config.get<string>('KAFKA_SASL_PASSWORD');
  if (!username || !password) {
    throw new Error(`KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD required for ${protocol}`);
  }
  const mechanism = (config.get<string>('KAFKA_SASL_MECHANISM') ?? 'scram-sha-512').toLowerCase();
  const sasl =
    mechanism === 'plain'
      ? { mechanism: 'plain', username, password }
      : mechanism === 'scram-sha-256'
        ? { mechanism: 'scram-sha-256', username, password }
        : { mechanism: 'scram-sha-512', username, password };
  return {
    sasl,
    ssl:
      protocol === 'SASL_SSL'
        ? { rejectUnauthorized: config.get('KAFKA_SSL_REJECT_UNAUTHORIZED') !== 'false' }
        : undefined,
  };
}

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
          ...buildKafkaClientSecurity(config),
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
          retry: { retries: 3 },
        },
        // Producer configuration for request-reply pattern (NestJS ProducerConfig subset)
        producer: {
          idempotent: true,
          maxInFlightRequestsPerConnection: 5,
        } as Record<string, unknown>,
      },
    };
  }
}
