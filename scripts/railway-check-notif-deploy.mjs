import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const EXPECTED = process.argv[2] || '9ea9528';
const SERVICES = [
  ['notification-service', '2c1f006e-bea4-4da9-b16a-06efa760a598'],
  ['api-gateway', '84d042b5-f4e0-4c6f-81db-81661c604f81'],
  ['system-manager-dashboard', 'f5a64b86-2750-4a2a-ba7a-dc4bff3a8856'],
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
