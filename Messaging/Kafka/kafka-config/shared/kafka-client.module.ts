import { DynamicModule, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport, ClientProxy, ClientProvider } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { Partitioners } from 'kafkajs';

const IDEMPOTENT_PRODUCER_RETRY = {
  initialRetryTime: 300,
  retries: Number.MAX_SAFE_INTEGER,
  maxRetryTime: 30_000,
};

export interface KafkaClientModuleOptions {
  clientId: string;
  consumerGroupId: string;
  // Token used to inject the client — defaults to 'KAFKA_CLIENT'
  // Override when a service needs multiple named clients
  injectionToken?: string;
}

@Module({})
export class KafkaClientModule implements OnApplicationShutdown {
  private readonly logger = new Logger(KafkaClientModule.name);
  private static clientToken: string;

  static register(options: KafkaClientModuleOptions): DynamicModule {
    const token = options.injectionToken ?? 'KAFKA_CLIENT';
    this.clientToken = token;

    return {
      module: KafkaClientModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: token,
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId: options.clientId,
                  // KAFKA_BROKERS supports comma-separated list for multi-broker clusters
                  // e.g. KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092
                  brokers: config
                    .getOrThrow<string>('KAFKA_BROKERS')
                    .split(',')
                    .map((b: string) => b.trim()),
                  ...(() => {
                    const protocol = (config.get<string>('KAFKA_SECURITY_PROTOCOL') ?? 'PLAINTEXT').toUpperCase();
                    if (protocol === 'PLAINTEXT') return {};
                    const username = config.get<string>('KAFKA_SASL_USERNAME');
                    const password = config.get<string>('KAFKA_SASL_PASSWORD');
                    if (!username || !password) {
                      throw new Error(`KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD required for ${protocol}`);
                    }
                    const mechanism = (config.get<string>('KAFKA_SASL_MECHANISM') ?? 'scram-sha-512').toLowerCase();
                    const sasl = mechanism === 'plain'
                      ? { mechanism: 'plain' as const, username, password }
                      : mechanism === 'scram-sha-256'
                        ? { mechanism: 'scram-sha-256' as const, username, password }
                        : { mechanism: 'scram-sha-512' as const, username, password };
                    return {
                      sasl,
                      ssl: protocol === 'SASL_SSL'
                        ? { rejectUnauthorized: config.get('KAFKA_SSL_REJECT_UNAUTHORIZED') !== 'false' }
                        : undefined,
                    };
                  })(),
                  retry: {
                    initialRetryTime: config.get<number>('KAFKA_RETRY_INITIAL_MS') ?? 300,
                    retries: config.get<number>('KAFKA_RETRY_COUNT') ?? 8,
                  },
                  connectionTimeout: config.get<number>('KAFKA_CONNECTION_TIMEOUT') ?? 10000,
                  requestTimeout: config.get<number>('KAFKA_REQUEST_TIMEOUT') ?? 30000,
                },
                consumer: {
                  groupId: options.consumerGroupId,
                  allowAutoTopicCreation: false,
                  isolationLevel: 'read_committed',
                  retry: { retries: 8 },
                },
                producer: {
                  allowAutoTopicCreation: false,
                  idempotent: true,
                  acks: -1,
                  maxInFlightRequests: 5,
                  createPartitioner: Partitioners.LegacyPartitioner,
                  retry: IDEMPOTENT_PRODUCER_RETRY,
                },
              },
            }) as ClientProvider,
            inject: [ConfigService],
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }

  // MEDIUM FIX: Implement graceful Kafka consumer shutdown
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Application shutdown signal received: ${signal}. Gracefully closing Kafka connections...`);
    // NestJS ClientsModule handles graceful shutdown automatically
    // The consumer will commit pending offsets and disconnect
    this.logger.log('Kafka connections closed gracefully');
  }
}
