'use strict';

const os = require('os');

function resolveEnvironment() {
  const explicit =
    process.env.MEDICARE_ENVIRONMENT ??
    process.env.DEPLOYMENT_ENVIRONMENT ??
    process.env.OTEL_DEPLOYMENT_ENVIRONMENT;
  if (explicit) return String(explicit).toLowerCase();

  const nodeEnv = String(process.env.NODE_ENV ?? 'development').toLowerCase();
  const inDocker =
    process.env.DOCKER_CONTAINER === 'true' ||
    process.env.MEDICARE_RUNTIME === 'docker-local' ||
    Boolean(process.env.KUBERNETES_SERVICE_HOST && !process.env.KUBERNETES_POD_NAME);

  if (inDocker && (nodeEnv === 'development' || nodeEnv === 'test')) {
    return 'docker-local';
  }
  if (nodeEnv === 'production' || nodeEnv === 'prod') return 'production';
  if (nodeEnv === 'staging' || nodeEnv === 'stage') return 'staging';
  if (nodeEnv === 'test') return 'development';
  return nodeEnv || 'development';
}

function resolveHostMetadata(serviceName) {
  const hostname = os.hostname();
  const containerId =
    process.env.HOSTNAME && process.env.HOSTNAME.length === 12
      ? process.env.HOSTNAME
      : process.env.DOCKER_CONTAINER_ID ?? null;
  const podName = process.env.KUBERNETES_POD_NAME ?? process.env.POD_NAME ?? null;
  const instanceId =
    process.env.INSTANCE_ID ??
    process.env.ECS_CONTAINER_METADATA_URI_V4?.split('/').pop() ??
    `${hostname}-${process.pid}`;

  const host =
    process.env.MEDICARE_HOST ??
    podName ??
    (containerId ? `${serviceName ?? 'service'}-${containerId}` : hostname);

  return {
    host,
    ...(containerId ? { container_id: containerId } : {}),
    ...(podName ? { pod_name: podName } : {}),
    instance_id: instanceId,
  };
}

const ENVIRONMENT = resolveEnvironment();
const HOST_META = resolveHostMetadata(process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME);

function getRuntimeContext(serviceName) {
  const hostMeta = resolveHostMetadata(serviceName);
  return {
    environment: ENVIRONMENT,
    ...hostMeta,
  };
}

module.exports = { getRuntimeContext, resolveEnvironment, resolveHostMetadata };
