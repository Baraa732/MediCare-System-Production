/**
 * Trigger a fresh deploy of notification-service and wait until SUCCESS
 * (or fail) with the expected commit hash.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const SERVICE = '076360d5-b800-41fa-b103-bb5b2a532c83';
const EXPECTED = (process.argv[2] || '3ba9c61').slice(0, 7);

function loadConfig() {
  return JSON.parse(
    fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'),
  );
}

async function refreshToken() {
  const cfg = loadConfig();
  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'rlwy_oaci_onEklvmksh1hRUiCo7E2zX12',
      grant_type: 'refresh_token',
      refresh_token: cfg.user.refreshToken,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`refresh failed: ${JSON.stringify(json)}`);
  cfg.user.accessToken = json.access_token;
  if (json.refresh_token) cfg.user.refreshToken = json.refresh_token;
  fs.writeFileSync(
    path.join(os.homedir(), '.railway', 'config.json'),
    JSON.stringify(cfg, null, 2),
  );
  return json.access_token;
}

async function ensureToken() {
  let token =
    process.env.RAILWAY_TOKEN?.trim() || loadConfig()?.user?.accessToken;
  try {
    await gql(token, 'query { me { id } }');
    return token;
  } catch {
    return refreshToken();
  }
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function latest(token) {
  const data = await gql(
    token,
    `query ($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt meta } }
      }
    }`,
    {
      input: { projectId: PROJECT, environmentId: ENV, serviceId: SERVICE },
      first: 3,
    },
  );
  return data.deployments.edges.map((e) => e.node);
}

const token = await ensureToken();
const before = await latest(token);
console.log(
  'Current:',
  before[0]
    ? `${before[0].status} commit=${before[0].meta?.commitHash?.slice(0, 7) ?? 'n/a'}`
    : 'none',
);

console.log('Triggering environmentTriggersDeploy…');
const triggered = await gql(
  token,
  `mutation ($input: EnvironmentTriggersDeployInput!) {
    environmentTriggersDeploy(input: $input)
  }`,
  {
    input: {
      projectId: PROJECT,
      environmentId: ENV,
      serviceId: SERVICE,
    },
  },
);
console.log('Triggered:', triggered.environmentTriggersDeploy);

const deadline = Date.now() + 8 * 60 * 1000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 8000));
  const nodes = await latest(token);
  const top = nodes[0];
  const hash = top?.meta?.commitHash?.slice(0, 7) ?? 'n/a';
  console.log(`${top?.status ?? 'none'} commit=${hash}`);
  if (
    top &&
    hash.startsWith(EXPECTED) &&
    ['SUCCESS', 'FAILED', 'CRASHED', 'REMOVED'].includes(top.status)
  ) {
    if (top.status !== 'SUCCESS') {
      process.exitCode = 1;
      console.error(`Deploy ended with ${top.status}`);
    } else {
      console.log(`✓ notification-service live on ${hash}`);
    }
    process.exit();
  }
}

console.error('Timed out waiting for deploy');
process.exit(1);
