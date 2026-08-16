import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const SVC = '076360d5-b800-41fa-b103-bb5b2a532c83';

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
