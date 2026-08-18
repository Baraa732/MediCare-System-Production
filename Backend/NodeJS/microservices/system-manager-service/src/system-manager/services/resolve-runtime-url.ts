/**
 * Resolve Docker Compose hostnames to Railway private DNS (and public HTTPS
 * fallbacks) so platform probes work without copying every *_URL by hand.
 */
const DOCKER_TO_RAILWAY_HOST: Record<string, string> = {
  'api-gateway': 'medicare-system-production.railway.internal',
};

function isRailwayRuntime(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT
      || process.env.RAILWAY_PROJECT_ID
      || process.env.RAILWAY_SERVICE_ID,
  );
}

function stripSlash(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function ensureAbsoluteUrl(value: string): string {
  const trimmed = stripSlash(value);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function rewriteDockerHostnameOnRailway(url: string): string {
  if (!isRailwayRuntime()) return url;
  try {
    const parsed = new URL(url);
    const mapped = DOCKER_TO_RAILWAY_HOST[parsed.hostname];
    if (mapped) {
      parsed.hostname = mapped;
      return stripSlash(parsed.toString());
    }
    if (!parsed.hostname.includes('.')) {
      parsed.hostname = `${parsed.hostname}.railway.internal`;
      return stripSlash(parsed.toString());
    }
  } catch {
    // keep the original string if it is not a valid URL
  }
  return url;
}

export function resolveRuntimeUrl(options: {
  explicit?: string;
  dockerFallback: string;
  publicEnvKey?: string;
  preferPublicOnRailway?: boolean;
}): string {
  const explicit = options.explicit?.trim();
  if (explicit) {
    return rewriteDockerHostnameOnRailway(stripSlash(explicit));
  }

  const publicHost = options.publicEnvKey
    ? process.env[options.publicEnvKey]?.trim()
    : undefined;
  if (isRailwayRuntime() && options.preferPublicOnRailway && publicHost) {
    return ensureAbsoluteUrl(publicHost);
  }

  const rewritten = rewriteDockerHostnameOnRailway(options.dockerFallback);
  if (rewritten !== options.dockerFallback) {
    return rewritten;
  }

  if (isRailwayRuntime() && publicHost) {
    return ensureAbsoluteUrl(publicHost);
  }

  return options.dockerFallback;
}

export function resolvePrometheusBaseUrl(): string {
  return resolveRuntimeUrl({
    explicit: process.env.PROMETHEUS_URL,
    dockerFallback: 'http://prometheus:9090',
    publicEnvKey: 'RAILWAY_SERVICE_PROMETHEUS_URL',
  });
}
