import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const EXPECTED = 'af23ee4';
const SERVICES = [
  ['system-manager-dashboard', '8b8012eb-5475-4461-84a1-fb379828a54f'],
  ['system-manager-service', '8cfa3690-7f35-4ae3-9bc3-95eea13f87d4'],
  ['auth-service', '970a7ecf-a36f-41c6-b20f-47647417ebf1'],
  ['scheduling-service', 'f8c8e8e0-0000-0000-0000-000000000000'],
  ['MediCare-System-Production', 'cf2986c8-8a3d-42eb-bad1-df457bcd3268'],
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

// List all services first to find scheduling-service id
const project = await gql(
  token,
  `query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`,
  { id: PROJECT },
);
const all = project.project.services.edges.map((e) => e.node);
const targets = [
  'system-manager-dashboard',
  'system-manager-service',
  'auth-service',
  'scheduling-service',
  'user-service',
  'api-gateway',
];

for (const name of targets) {
  const svc = all.find((s) => s.name === name);
  if (!svc) {
    console.log(`? ${name}: service not found`);
    continue;
  }
  const data = await gql(
    token,
    `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt meta } }
      }
    }`,
    { input: { projectId: PROJECT, environmentId: ENV, serviceId: svc.id }, first: 1 },
  );
  const latest = data.deployments.edges[0]?.node;
  const hash = latest?.meta?.commitHash?.slice(0, 7) ?? 'n/a';
  const match = hash.startsWith(EXPECTED.slice(0, 7)) ? 'OK' : 'OLD';
  console.log(`${match.padEnd(4)} ${name}: ${latest?.status ?? 'none'} commit=${hash}`);
}
