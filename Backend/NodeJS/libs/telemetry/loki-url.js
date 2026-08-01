'use strict';

const DOCKER_DEFAULT = 'http://loki:3100';
const RAILWAY_DEFAULT = 'http://loki.railway.internal:3100';

function isRailwayRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT
      || process.env.RAILWAY_SERVICE_ID
      || process.env.RAILWAY_PROJECT_ID
      || process.env.RAILWAY_REPLICA_ID,
  );
}

function normalizeBaseUrl(raw) {
  return String(raw).trim().replace(/\/$/, '').replace(/\/loki\/api\/v1\/push$/i, '');
}

function fixDockerHostnameOnRailway(url) {
  if (!isRailwayRuntime()) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'loki') {
      parsed.hostname = 'loki.railway.internal';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // ignore invalid URL
  }
  return url;
}

function resolveLokiBaseUrl() {
  const explicit = normalizeBaseUrl(process.env.LOKI_PUSH_URL || process.env.LOKI_URL || '');
  if (explicit) {
    return fixDockerHostnameOnRailway(explicit);
  }
  if (isRailwayRuntime()) return RAILWAY_DEFAULT;
  return DOCKER_DEFAULT;
}

function resolveLokiPushUrl() {
  return `${resolveLokiBaseUrl()}/loki/api/v1/push`;
}

module.exports = {
  DOCKER_DEFAULT,
  RAILWAY_DEFAULT,
  isRailwayRuntime,
  resolveLokiBaseUrl,
  resolveLokiPushUrl,
};
