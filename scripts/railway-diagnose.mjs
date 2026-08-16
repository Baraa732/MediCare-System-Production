import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';

const SERVICES = {
  'loki': 'b5ad0060-353a-4ee2-8c3a-246f57e65f46',
  'otel-collector': '1f789229-f148-4aad-a75e-db697905c45c',
  'system-manager-service': '8cfa3690-7f35-4ae3-9bc3-95eea13f87d4',
  'user-service': 'de2d0692-5cf2-4f56-ae67-5e663d62be03',
  'auth-service': '970a7ecf-a36f-41c6-b20f-47647417ebf1',
  'MediCare-System-Production': 'cf2986c8-8a3d-42eb-bad1-df457bcd3268',
  Postgres: '7becf8c2-d895-427b-9882-9b3bab30b602',
  Redis: '7bd8c86f-ace6-423a-af30-319d064621e6',
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
