import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  RAILWAY_PROJECT_ID as PROJECT,
  RAILWAY_ENVIRONMENT_ID as ENV,
  SERVICE_IDS,
} from './railway-target.mjs';

const API = 'https://backboard.railway.com/graphql/v2';
const EXPECTED = (process.argv[2] || '366c057').slice(0, 7);
const SERVICES = [
  ['scheduling-service', SERVICE_IDS['scheduling-service']],
  ['clinic-admin-dashboard', SERVICE_IDS['clinic-admin-dashboard']],
  ['secretary-dashboard', SERVICE_IDS['secretary-dashboard']],
];

function hashFromMeta(meta) {
  if (!meta) return '';
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed.commitHash || parsed.hash || meta;
    } catch {
      return meta;
    }
  }
  return meta.commitHash || meta.hash || '';
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'));
}

async function refreshAccessToken(refreshToken, config) {
  const clientId = config?.user?.clientId || config?.clientId || 'rlwy_oaci_onEklvmksh1hRUiCo7E2zX12';
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.access_token) return null;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    tokenExpiresAt: json.expires_in
      ? Math.floor(Date.now() / 1000) + json.expires_in
      : undefined,
  };
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

async function loadToken() {
  const config = loadConfig();
  let token = config?.user?.accessToken;
  if (token) {
    try {
      const data = await gql(token, 'query { me { id } }', {});
      if (data?.me?.id) return token;
    } catch {
      // refresh below
    }
  }
  const refreshToken = config?.user?.refreshToken;
  if (!refreshToken) throw new Error('No Railway refresh token');
  const refreshed = await refreshAccessToken(refreshToken, config);
  if (!refreshed) throw new Error('Railway token refresh failed');
  config.user.accessToken = refreshed.accessToken;
  if (refreshed.refreshToken) config.user.refreshToken = refreshed.refreshToken;
  if (refreshed.tokenExpiresAt) config.user.tokenExpiresAt = refreshed.tokenExpiresAt;
  fs.writeFileSync(path.join(os.homedir(), '.railway', 'config.json'), JSON.stringify(config, null, 2));
  return refreshed.accessToken;
}

async function latestDeployment(token, serviceId) {
  const data = await gql(
    token,
    `query($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt meta } }
      }
    }`,
    {
      input: { projectId: PROJECT, environmentId: ENV, serviceId },
      first: 8,
    },
  );
  return data?.deployments?.edges?.map((e) => e.node) ?? [];
}

async function triggerDeploy(token, serviceId) {
  const nodes = await latestDeployment(token, serviceId);
  const matching = nodes.find((n) => hashFromMeta(n.meta).startsWith(EXPECTED));
  if (matching && ['BUILDING', 'DEPLOYING', 'QUEUED', 'INITIALIZING', 'WAITING', 'SUCCESS'].includes(matching.status)) {
    return { action: 'already', id: matching.id, status: matching.status };
  }

  await gql(
    token,
    `mutation($input: EnvironmentTriggersDeployInput!) {
      environmentTriggersDeploy(input: $input)
    }`,
    {
      input: {
        projectId: PROJECT,
        environmentId: ENV,
        serviceId,
      },
    },
  );
  return { action: 'trigger', status: 'QUEUED' };
}

async function waitFor(token, name, serviceId) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const nodes = await latestDeployment(token, serviceId);
    const match = nodes.find((n) => hashFromMeta(n.meta).startsWith(EXPECTED));
    const hash = (hashFromMeta(match?.meta) || hashFromMeta(nodes[0]?.meta) || '').slice(0, 7);
    const status = match?.status || nodes[0]?.status || 'UNKNOWN';
    console.log(`[${name}] ${status} commit=${hash || '?'}`);
    if (match?.status === 'SUCCESS') return;
    if (match && ['FAILED', 'CRASHED', 'REMOVED'].includes(match.status)) {
      throw new Error(`${name} deploy ${match.status}`);
    }
    await new Promise((r) => setTimeout(r, 12000));
  }
  throw new Error(`${name} deploy timed out waiting for ${EXPECTED}`);
}

const token = await loadToken();
console.log(`Deploying leave-request services for commit ${EXPECTED}…`);

for (const [name, id] of SERVICES) {
  console.log(`\n==> Trigger ${name}`);
  const result = await triggerDeploy(token, id);
  console.log('result:', result);
}

for (const [name, id] of SERVICES) {
  await waitFor(token, name, id);
}

console.log('\nAll services SUCCESS on', EXPECTED);
