import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const EXPECTED = 'af23ee4';
const SERVICES = [
  ['system-manager-dashboard', 'b3f29015-2a95-4a76-a70f-37b9470251a2'],
  ['system-manager-service', 'a29b748e-22fe-48a7-91d2-4e0e7a8a9594'],
  ['auth-service', '8550641b-4537-4914-9300-545f32d5270f'],
  ['scheduling-service', 'f8c8e8e0-0000-0000-0000-000000000000'],
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
