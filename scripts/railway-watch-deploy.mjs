import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const EXPECTED = 'ae54643';
const SERVICES = [
  ['auth-service', '8550641b-4537-4914-9300-545f32d5270f'],
  ['clinic-admin-dashboard', 'b3f29015-2a95-4a76-a70f-37b9470251a2'],
  ['MediCare-System-Production', '84d042b5-f4e0-4c6f-81db-81661c604f81'],
];

function loadToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'));
  return cfg?.user?.accessToken;
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

const token = loadToken();
for (const [name, serviceId] of SERVICES) {
  const data = await gql(
    token,
    `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt meta } }
      }
    }`,
    { input: { projectId: PROJECT, environmentId: ENV, serviceId }, first: 2 },
  );
  const latest = data.deployments.edges[0]?.node;
  const hash = latest?.meta?.commitHash?.slice(0, 7) ?? 'n/a';
  const match = hash.startsWith(EXPECTED) ? '✓' : '…';
  console.log(`${match} ${name}: ${latest?.status ?? 'none'} commit=${hash}`);
}
