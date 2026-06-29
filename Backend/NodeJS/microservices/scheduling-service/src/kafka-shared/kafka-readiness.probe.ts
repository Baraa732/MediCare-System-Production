import { Kafka } from 'kafkajs';

/**
 * Network-level Kafka readiness check (uses advertised broker hostnames, not localhost).
 * Used by /health/ready and Docker Compose healthchecks.
 */
export async function isKafkaBrokerReachable(
  brokers: string[] = (process.env.KAFKA_BROKERS ?? 'kafka-1:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean),
): Promise<boolean> {
  const kafka = new Kafka({
    clientId: 'readiness-probe',
    brokers,
    connectionTimeout: 4000,
    requestTimeout: 4000,
  });
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.describeCluster();
    return true;
  } catch {
    return false;
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}
