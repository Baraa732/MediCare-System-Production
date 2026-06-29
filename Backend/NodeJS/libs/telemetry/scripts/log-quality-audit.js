#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVICES = [
  'api-gateway',
  'auth-service',
  'user-service',
  'system-manager-service',
  'clinic-service',
  'appointment-service',
  'scheduling-service',
  'notification-service',
  'emr-service',
  'reminder-service',
];

const WEAK_PATTERNS = [
  { id: 'console_log', regex: /console\.(log|error|warn|debug)\(/g, label: 'console.* calls' },
  { id: 'nest_plain', regex: /\[Nest\]/g, label: 'Nest plain-text markers in source' },
  { id: 'listening_plain', regex: /Listening on port/gi, label: 'Listening on port strings' },
  { id: 'routes_plain', regex: /RoutesResolver|RouterExplorer/g, label: 'Nest route resolver references' },
];

const STRONG_PATTERNS = [
  { id: 'telemetry_logger', regex: /createLogger\(|@medicare\/telemetry/g },
  { id: 'structured_event', regex: /event:\s*['"][\w_]+['"]/g },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function scanService(serviceName) {
  const base =
    serviceName === 'api-gateway'
      ? path.join(ROOT, 'api-gateway', 'src')
      : path.join(ROOT, 'microservices', serviceName, 'src');

  const files = walk(base);
  let weakHits = 0;
  let strongHits = 0;
  const weakSources = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let fileWeak = 0;
    for (const pattern of WEAK_PATTERNS) {
      const matches = content.match(pattern.regex);
      if (matches?.length) {
        fileWeak += matches.length;
        weakHits += matches.length;
      }
    }
    for (const pattern of STRONG_PATTERNS) {
      const matches = content.match(pattern.regex);
      if (matches?.length) strongHits += matches.length;
    }
    if (fileWeak > 0) {
      weakSources.push({ file: path.relative(ROOT, file), hits: fileWeak });
    }
  }

  const usesTelemetry = fs.existsSync(base) && walk(base).some((file) => {
    const content = fs.readFileSync(file, 'utf8');
    return content.includes('setupMedicareLogging') || content.includes('createMedicareNestLogger');
  });

  const coverage = strongHits + weakHits > 0
    ? Math.min(100, Math.round((strongHits / (strongHits + weakHits)) * 1000) / 10)
    : usesTelemetry
      ? 99
      : 0;

  return {
    service: serviceName,
    migrated: usesTelemetry,
    structuredCoveragePct: coverage,
    weakHits,
    strongHits,
    weakSources: weakSources.sort((a, b) => b.hits - a.hits).slice(0, 8),
  };
}

function main() {
  const results = SERVICES.map(scanService);
  const migrated = results.filter((r) => r.migrated).map((r) => r.service);
  const notMigrated = results.filter((r) => !r.migrated).map((r) => r.service);
  const avgCoverage =
    Math.round((results.reduce((sum, r) => sum + r.structuredCoveragePct, 0) / results.length) * 10) / 10;

  const report = {
    generatedAt: new Date().toISOString(),
    targetStructuredCoveragePct: 98,
    platformStructuredCoveragePct: avgCoverage,
    servicesFullyMigrated: migrated,
    servicesPendingMigration: notMigrated,
    perService: results,
    remainingWeakSources: results
      .flatMap((r) => r.weakSources.map((s) => ({ service: r.service, ...s })))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 20),
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
