import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const SM = 'a29b748e-22fe-48a7-91d2-4e0e7a8a9594';

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
