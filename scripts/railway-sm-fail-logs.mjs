import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const serviceId = 'f5a64b86-2750-4a2a-ba7a-dc4bff3a8856';

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
