import { ConfigService } from '@nestjs/config';
import { SASLOptions } from 'kafkajs';

export type KafkaSecurityProtocol = 'PLAINTEXT' | 'SASL_PLAINTEXT' | 'SASL_SSL';

export interface KafkaClientSecurityOptions {
  ssl?: boolean | { rejectUnauthorized: boolean };
  sasl?: SASLOptions;
}

export function getKafkaSecurityProtocol(config: ConfigService): KafkaSecurityProtocol {
  const raw = (config.get<string>('KAFKA_SECURITY_PROTOCOL') ?? 'PLAINTEXT').toUpperCase();
  if (raw === 'SASL_PLAINTEXT' || raw === 'SASL_SSL') return raw;
  return 'PLAINTEXT';
}

export function buildKafkaClientSecurityOptions(
  config: ConfigService,
): KafkaClientSecurityOptions {
  const protocol = getKafkaSecurityProtocol(config);
  if (protocol === 'PLAINTEXT') {
    return {};
  }

  const mechanism = (config.get<string>('KAFKA_SASL_MECHANISM') ?? 'scram-sha-512').toLowerCase();
  const username = config.get<string>('KAFKA_SASL_USERNAME');
  const password = config.get<string>('KAFKA_SASL_PASSWORD');

  if (!username || !password) {
    throw new Error(
      `KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD are required when KAFKA_SECURITY_PROTOCOL=${protocol}`,
    );
  }

  const sasl: SASLOptions =
    mechanism === 'plain'
      ? { mechanism: 'plain', username, password }
      : mechanism === 'scram-sha-256'
        ? { mechanism: 'scram-sha-256', username, password }
        : { mechanism: 'scram-sha-512', username, password };

  const rejectUnauthorized =
    config.get<string>('KAFKA_SSL_REJECT_UNAUTHORIZED') !== 'false';

  return {
    sasl,
    ssl: protocol === 'SASL_SSL' ? { rejectUnauthorized } : undefined,
  };
}
