import type { INestApplication } from '@nestjs/common';

function isRetriableKafkaStartError(err: unknown): boolean {
  const e = err as {
    type?: string;
    retriable?: boolean;
    message?: string;
    name?: string;
  };
  if (e?.retriable === true) return true;
  if (e?.type === 'UNKNOWN_TOPIC_OR_PARTITION') return true;

  const msg = `${e?.name ?? ''} ${e?.message ?? err ?? ''}`;
  return (
    msg.includes('UNKNOWN_TOPIC_OR_PARTITION') ||
    msg.includes('This server does not host this topic-partition') ||
    msg.includes('The group is rebalancing') ||
    msg.includes('CoordinatorNotAvailable') ||
    msg.includes('NotController') ||
    msg.includes('KafkaJSNumberOfRetriesExceeded')
  );
}

/**
 * Nest `startAllMicroservices()` fails hard when Kafka topics are not ready yet
 * (e.g. kafka-init still creating topics after a cold start). Retry until topics
 * exist or max attempts are exhausted.
 */
export async function startKafkaMicroservicesWithRetry(
  app: INestApplication,
  opts?: {
    maxAttempts?: number;
    delayMs?: number;
    logger?: { warn: (message: string) => void };
  },
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? Number(process.env.KAFKA_START_MAX_ATTEMPTS ?? 45);
  const delayMs = opts?.delayMs ?? Number(process.env.KAFKA_START_RETRY_MS ?? 2000);
  const logger = opts?.logger;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await app.startAllMicroservices();
      if (attempt > 1) {
        logger?.warn(`Kafka microservices started after ${attempt} attempt(s)`);
      }
      return;
    } catch (err) {
      lastError = err;
      if (!isRetriableKafkaStartError(err) || attempt >= maxAttempts) {
        throw err;
      }
      const detail = String((err as Error)?.message ?? err);
      logger?.warn(
        `Kafka microservices not ready (attempt ${attempt}/${maxAttempts}): ${detail}. Retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
