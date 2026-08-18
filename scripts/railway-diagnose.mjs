import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';

const SERVICES = {
  'loki': '6200644f-3d0a-4d97-80bc-840924ac85a0',
  'otel-collector': '3d23ef81-60c6-4d61-ab3b-2f72a21acdc5',
  'system-manager-service': 'a29b748e-22fe-48a7-91d2-4e0e7a8a9594',
  'user-service': '2e53deaf-bd29-4504-9cf9-7ead72c4ecde',
  'auth-service': '8550641b-4537-4914-9300-545f32d5270f',
  'MediCare-System-Production': '84d042b5-f4e0-4c6f-81db-81661c604f81',
  Postgres: 'b8c1076d-b87c-4a62-9954-be499f924cc8',
  Redis: 'bc1658f1-ee50-48b8-aa24-81724a98f133',
};

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
if (!token) {
  console.error('No Railway token');
  process.exit(1);
}

for (const [name, serviceId] of Object.entries(SERVICES)) {
  const data = await gql(
    token,
    `query($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt } }
      }
    }`,
    { input: { projectId: PROJECT, environmentId: ENV, serviceId }, first: 3 },
  );
  const latest = data.deployments.edges.map((e) => e.node);
  console.log(`\n=== ${name} ===`);
  for (const d of latest) console.log(`  ${d.status}  ${d.id.slice(0, 8)}...  ${d.createdAt}`);
  const active = latest.find((d) => ['SUCCESS', 'CRASHED', 'FAILED', 'BUILDING', 'DEPLOYING'].includes(d.status));
  if (active) {
    const logs = await gql(
      token,
      `query($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) { message severity }
      }`,
      { deploymentId: active.id, limit: 100 },
    );
    const interesting = logs.deploymentLogs.filter((l) =>
      /error|fail|unavailable|ECONN|timeout|resetPassword|validateLogin|user service|internal auth/i.test(l.message),
    );
    if (interesting.length) {
      console.log('  --- relevant logs ---');
      for (const l of interesting.slice(-20)) console.log(`  ${l.message}`);
    }
  }
  if (active && ['CRASHED', 'FAILED'].includes(active.status)) {
    const logs = await gql(
      token,
      `query($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) { message severity }
      }`,
      { deploymentId: active.id, limit: 30 },
    );
    console.log('  --- recent logs ---');
    for (const l of logs.deploymentLogs.slice(-15)) console.log(`  ${l.message}`);
  }
}
