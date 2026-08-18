import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';

function loadToken() {
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8')).user.accessToken;
}

const token = loadToken();
const res = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`,
    variables: { id: PROJECT },
  }),
});
const json = await res.json();
if (json.errors) {
  console.error(JSON.stringify(json.errors, null, 2));
  process.exit(1);
}
const services = json.data?.project?.services?.edges?.map((e) => e.node) ?? [];
console.log('services:', services.length);
for (const s of services) {
  const d = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($input: DeploymentListInput!, $first: Int) {
        deployments(input: $input, first: $first) {
          edges { node { status meta } }
        }
      }`,
      variables: {
        input: { projectId: PROJECT, environmentId: ENV, serviceId: s.id },
        first: 1,
      },
    }),
  });
  const body = await d.json();
  const dep = body.data?.deployments?.edges?.[0]?.node;
  const hash = dep?.meta?.commitHash?.slice?.(0, 7) ?? 'n/a';
  console.log(`${s.name}: ${dep?.status ?? 'none'} ${hash}`);
}
