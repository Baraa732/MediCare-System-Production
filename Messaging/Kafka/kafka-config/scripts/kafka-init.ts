/**
 * kafka-init.ts
 *
 * Programmatic topic initialisation — single source of truth is topics.config.ts.
 * Run: npm run kafka:init
 *
 * Behaviour:
 *   - Creates topics that don't exist yet
 *   - Increases partitions when actual < expected (Kafka allows this)
 *   - Exits with code 1 when actual > expected (Kafka cannot shrink partitions —
 *     this requires manual reassignment and is a breaking change)
 *   - Logs a warning when replication factor drifts (cannot change without
 *     partition reassignment — requires kafka-reassign-partitions tool)
 */

import { Kafka, Admin, ConfigEntries } from 'kafkajs';
import { getAllTopics, TopicConfig } from '../topics/topics.config';

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map((b) => b.trim());

// Exit codes
const EXIT_OK              = 0;
const EXIT_PARTITION_DRIFT = 2; // actual > expected — needs manual intervention
const EXIT_ERROR           = 1;

interface VerifyResult {
  topic: string;
  status: 'ok' | 'increased' | 'drift_up' | 'rf_mismatch';
  expected: number;
  actual: number;
  detail?: string;
}

async function run(): Promise<void> {
  const kafka = new Kafka({
    clientId: 'kafka-init-script',
    brokers: BROKERS,
    connectionTimeout: 10000,
    requestTimeout: 30000,
    retry: { retries: 5, initialRetryTime: 500 },
  });

  const admin: Admin = kafka.admin();

  console.log(`Connecting to brokers: ${BROKERS.join(', ')}`);
  await admin.connect();

  let exitCode = EXIT_OK;

  try {
    const existingTopics = new Set(await admin.listTopics());
    const allTopics      = getAllTopics();

    const toCreate = allTopics.filter((t) => !existingTopics.has(t.name));
    const toVerify = allTopics.filter((t) =>  existingTopics.has(t.name));

    // ── Create missing topics ──────────────────────────────────────────────────
    if (toCreate.length > 0) {
      console.log(`\nCreating ${toCreate.length} missing topics...`);
      await admin.createTopics({
        waitForLeaders: true,
        topics: toCreate.map((t: TopicConfig) => ({
          topic: t.name,
          numPartitions: t.partitions,
          replicationFactor: t.replicationFactor,
          configEntries: t.config
            ? (Object.entries(t.config).map(([name, value]) => ({
                name,
                value: String(value),
              })) as ConfigEntries[])
            : [],
        })),
      });
      for (const t of toCreate) {
        console.log(`  ✓ created   ${t.name}  (partitions=${t.partitions}, rf=${t.replicationFactor})`);
      }
    } else {
      console.log(`\nAll ${allTopics.length} topics already exist.`);
    }

    // ── Verify and repair existing topics ─────────────────────────────────────
    if (toVerify.length > 0) {
      console.log(`\nVerifying ${toVerify.length} existing topics...`);

      const metadata = await admin.fetchTopicMetadata({
        topics: toVerify.map((t) => t.name),
      });

      const results: VerifyResult[] = [];
      const toIncrease: Array<{ topic: string; count: number }> = [];

      for (const meta of metadata.topics) {
        const expected = allTopics.find((t) => t.name === meta.name);
        if (!expected) continue;

        const actualPartitions = meta.partitions.length;
        const actualRf         = meta.partitions[0]?.replicas?.length ?? 0;

        if (actualPartitions === expected.partitions) {
          results.push({ topic: meta.name, status: 'ok', expected: expected.partitions, actual: actualPartitions });
        } else if (actualPartitions < expected.partitions) {
          // Kafka allows increasing partitions — queue it
          toIncrease.push({ topic: meta.name, count: expected.partitions });
          results.push({
            topic: meta.name,
            status: 'increased',
            expected: expected.partitions,
            actual: actualPartitions,
            detail: `will increase ${actualPartitions} → ${expected.partitions}`,
          });
        } else {
          // actualPartitions > expected.partitions
          // Kafka CANNOT shrink partitions. This requires:
          //   1. Delete the topic (loses all data)
          //   2. Recreate with correct partition count
          //   3. Or accept the drift and update topics.config.ts
          results.push({
            topic: meta.name,
            status: 'drift_up',
            expected: expected.partitions,
            actual: actualPartitions,
            detail: `CANNOT shrink — actual(${actualPartitions}) > expected(${expected.partitions}). ` +
                    `Either update topics.config.ts to match actual, or delete and recreate the topic.`,
          });
          exitCode = EXIT_PARTITION_DRIFT;
        }

        // Replication factor drift — warn only, cannot fix without reassignment tool
        if (actualRf !== expected.replicationFactor) {
          results.push({
            topic: meta.name,
            status: 'rf_mismatch',
            expected: expected.replicationFactor,
            actual: actualRf,
            detail: `RF drift: actual=${actualRf} expected=${expected.replicationFactor}. ` +
                    `Fix with: kafka-reassign-partitions.sh`,
          });
        }
      }

      // ── Apply partition increases ────────────────────────────────────────────
      if (toIncrease.length > 0) {
        console.log(`\nIncreasing partitions for ${toIncrease.length} topics...`);
        await admin.createPartitions({
          topicPartitions: toIncrease.map(({ topic, count }) => ({
            topic,
            count,
          })),
        });
        for (const { topic, count } of toIncrease) {
          console.log(`  ✓ increased ${topic} → ${count} partitions`);
        }
      }

      // ── Print summary ────────────────────────────────────────────────────────
      console.log('\nVerification summary:');
      for (const r of results) {
        const icon = r.status === 'ok'        ? '✓' :
                     r.status === 'increased'  ? '↑' :
                     r.status === 'drift_up'   ? '✗' : '⚠';
        const line = `  ${icon} ${r.topic}`;
        if (r.detail) {
          console[r.status === 'drift_up' ? 'error' : 'warn'](`${line}: ${r.detail}`);
        } else {
          console.log(line);
        }
      }
    }

    if (exitCode === EXIT_PARTITION_DRIFT) {
      console.error(
        '\nERROR: One or more topics have more partitions than expected.' +
        '\nKafka cannot shrink partitions. Manual intervention required.' +
        '\nSee details above.',
      );
    } else {
      console.log('\nKafka topic initialisation complete.');
    }
  } finally {
    await admin.disconnect();
  }

  process.exit(exitCode);
}

run().catch((err) => {
  console.error('kafka-init failed:', err.message);
  process.exit(EXIT_ERROR);
});
