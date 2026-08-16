import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const serviceId = '461a9002-af79-4769-b416-e29320ce15be';

function loadToken() {
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'))
    .user.accessToken;
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const token = loadToken();
const data = await gql(
  token,
  `query deployments($input: DeploymentListInput!, $first: Int) {
    deployments(input: $input, first: $first) {
      edges { node { id status } }
    }
  }`,
  { input: { projectId: PROJECT, environmentId: ENV, serviceId }, first: 1 },
);
const deploymentId = data.deployments.edges[0].node.id;
console.log('deployment', deploymentId, data.deployments.edges[0].node.status);

const logs = await gql(
  token,
  `query buildLogs($deploymentId: String!) {
    buildLogs(deploymentId: $deploymentId) { message }
  }`,
  { deploymentId },
);

const lines = (logs.buildLogs || []).map((l) => l.message).join('\n');
const interesting = lines
  .split('\n')
  .filter((l) => /error|Error|failed|FAILED|TS\d+|Cannot|Module/i.test(l))
  .slice(-80);
console.log(interesting.join('\n') || lines.slice(-4000));
