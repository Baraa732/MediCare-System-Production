import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const SVC = '2c1f006e-bea4-4da9-b16a-06efa760a598';

const token = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'),
).user.accessToken;

const res = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `query ($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    variables: { projectId: PROJECT, environmentId: ENV, serviceId: SVC },
  }),
});
const json = await res.json();
if (json.errors) {
  console.error(JSON.stringify(json.errors, null, 2));
  process.exit(1);
}
const vars = json.data.variables || {};
const keys = Object.keys(vars).sort();
console.log('count', keys.length);
for (const k of keys) {
  const v = String(vars[k] ?? '');
  const redact = /SECRET|PRIVATE|KEY|PASSWORD|TOKEN|JSON|CREDENTIAL/i.test(k);
  console.log(`${k}=${redact ? `[set len=${v.length}]` : v}`);
}
