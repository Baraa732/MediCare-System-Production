/**
 * Writes Messaging/Kafka/scripts/kafka-init.sh from kafka-config/topics/topics.config.ts
 * Run: npm run generate:kafka-init-sh
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateDockerKafkaInitShellScript,
  getDockerComposeTopics,
} from '../topics/topics.config';

const outPath = resolve(__dirname, '../../scripts/kafka-init.sh');
const script = generateDockerKafkaInitShellScript('kafka-1:9092');

writeFileSync(outPath, script, { encoding: 'utf8', mode: 0o755 });
console.log(`Wrote ${outPath} (${getDockerComposeTopics().length} topics)`);
