import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const EXPECTED = process.argv[2] || '9ea9528';
const SERVICES = [
  ['notification-service', '076360d5-b800-41fa-b103-bb5b2a532c83'],
  ['api-gateway', 'cf2986c8-8a3d-42eb-bad1-df457bcd3268'],
  ['system-manager-dashboard', '461a9002-af79-4769-b416-e29320ce15be'],
];

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'));
}

function loadToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  return loadConfig()?.user?.accessToken;
}

async function refreshToken() {
  const cfg = loadConfig();
  const refreshToken = cfg?.user?.refreshToken;
  if (!refreshToken) throw new Error('No Railway refresh token');
  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: 'rlwy_oaci_onEklvmksh1hRUiCo7E2zX12',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('Railway token refresh failed');
  cfg.user.accessToken = json.access_token;
  if (json.refresh_token) cfg.user.refreshToken = json.refresh_token;
  fs.writeFileSync(path.join(os.homedir(), '.railway', 'config.json'), JSON.stringify(cfg, null, 2));
  return json.access_token;
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

let token = loadToken();
try {
  await gql(token, 'query { me { id } }');
} catch {
  token = await refreshToken();
}

for (const [name, serviceId] of SERVICES) {
  const data = await gql(
    token,
    `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt meta } }
      }
    }`,
    { input: { projectId: PROJECT, environmentId: ENV, serviceId }, first: 1 },
  );
  const latest = data.deployments.edges[0]?.node;
  const hash = latest?.meta?.commitHash?.slice(0, 7) ?? 'n/a';
  const match = hash.startsWith(EXPECTED) ? '✓' : '…';
  console.log(`${match} ${name}: ${latest?.status ?? 'none'} commit=${hash}`);
}
