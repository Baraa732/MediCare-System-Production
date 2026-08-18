import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';

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

// Environment-level variables (no service)
try {
  const envVars = await gql(
    token,
    `query ($projectId: String!, $environmentId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId)
    }`,
    { projectId: PROJECT, environmentId: ENV },
  );
  const keys = Object.keys(envVars.variables || {}).filter((k) =>
    /FIREBASE|FCM|GOOGLE/i.test(k),
  );
  console.log('env-level firebase keys:', keys);
  for (const k of keys) {
    const v = String(envVars.variables[k] ?? '');
    console.log(
      `${k}=${k.includes('PRIVATE') || k.includes('KEY') ? `[set len=${v.length}]` : v.slice(0, 60)}`,
    );
  }
} catch (e) {
  console.log('env-level query failed:', e.message.slice(0, 200));
}

const services = await gql(
  token,
  `query ($id: String!) {
    project(id: $id) {
      services {
        edges { node { id name } }
      }
    }
  }`,
  { id: PROJECT },
);

for (const edge of services.project.services.edges) {
  const { id, name } = edge.node;
  try {
    const data = await gql(
      token,
      `query ($projectId: String!, $environmentId: String!, $serviceId: String!) {
        variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
      }`,
      { projectId: PROJECT, environmentId: ENV, serviceId: id },
    );
    const vars = data.variables || {};
    const keys = Object.keys(vars).filter((k) => /FIREBASE|FCM|GOOGLE_APPLICATION/i.test(k));
    if (keys.length) {
      console.log(`\n${name} (${id})`);
      for (const k of keys) {
        const v = String(vars[k] ?? '');
        console.log(
          `  ${k}=${
            /PRIVATE|KEY|SECRET|JSON/i.test(k) ? `[set len=${v.length}]` : v.slice(0, 80)
          }`,
        );
      }
    }
  } catch (e) {
    console.log(`${name}: ${e.message.slice(0, 120)}`);
  }
}
