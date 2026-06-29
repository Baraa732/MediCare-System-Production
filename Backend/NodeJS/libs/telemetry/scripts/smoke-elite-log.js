'use strict';

process.env.MEDICARE_ENVIRONMENT = 'docker-local';
process.env.SERVICE_NAME = 'system-manager-service';

const { createLogger } = require('../index');

const err = new Error('relation "clinics" does not exist');
err.code = '42P01';
err.stack = [
  'Error: relation "clinics" does not exist',
  '    at PlatformStatsService.getClinicCounts (/app/platform-stats.service.ts:56:12)',
  '    at PlatformStatsService.getPlatformStats (/app/platform-stats.service.ts:32:8)',
].join('\n');

const log = createLogger('system-manager-service');
const record = log.error('Failed to read clinic counts', {
  event: 'db_query_failed',
  module: 'PlatformStatsService',
  endpoint: '/v1/system-manager/platform/stats',
  method: 'GET',
  duration_ms: 80,
  query_name: 'clinic_counts',
  error_code: '42P01',
  err,
  metadata: { table: 'clinics' },
});

console.log(JSON.stringify(record, null, 2));
