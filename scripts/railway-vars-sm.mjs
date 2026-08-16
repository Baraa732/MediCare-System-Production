import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const SM = '8cfa3690-7f35-4ae3-9bc3-95eea13f87d4';

function loadToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8')).user.accessToken;
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(json.errors);
    process.exit(1);
  }
  return json.data;
}

const token = loadToken();
const data = await gql(
  token,
  `query variables($projectId: String!, $environmentId: String!, $serviceId: String!) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`,
  { projectId: PROJECT, environmentId: ENV, serviceId: SM },
);

const vars = data.variables ?? {};
const keys = ['LOKI_URL', 'LOKI_PUSH_URL', 'PLATFORM_LOGS_DOCKER', 'PLATFORM_LOGS_ENABLED', 'RAILWAY_ENVIRONMENT'];
for (const name of keys) {
  if (name in vars) console.log(`${name}=${vars[name] ?? '(empty)'}`);
}
for (const [name, value] of Object.entries(vars)) {
  if (keys.includes(name)) continue;
  if (/LOKI|PLATFORM_LOGS|RAILWAY/i.test(name)) console.log(`${name}=${value ?? '(empty)'}`);
}
