/**
 * Safely stop Railway services by removing active SUCCESS deployments only.
 * Does NOT delete project or services. Reads auth from ~/.railway/config.json
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const PROJECT_ID = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV_ID = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const API = 'https://backboard.railway.com/graphql/v2';

const SERVICE_ORDER = [
  // Batch 1: API gateway, microservices, dashboards
  ['MediCare-System-Production', 'cf2986c8-8a3d-42eb-bad1-df457bcd3268'],
  ['auth-service', '970a7ecf-a36f-41c6-b20f-47647417ebf1'],
  ['user-service', 'de2d0692-5cf2-4f56-ae67-5e663d62be03'],
  ['clinic-service', '6177a21b-f364-428c-a976-aee2972f1e5a'],
  ['system-manager-service', '8cfa3690-7f35-4ae3-9bc3-95eea13f87d4'],
  ['appointment-service', 'd4d6bde6-1373-45e1-bd3d-5f53e347864d'],
  ['scheduling-service', '9c7099bb-5c7b-4786-aad7-990e82747d2f'],
  ['notification-service', '076360d5-b800-41fa-b103-bb5b2a532c83'],
  ['reminder-service', 'fac46935-914b-4f3a-9fa0-fdb47c4d552e'],
  ['emr-service', '393d045b-67b8-44b7-a50c-0189d48fcd67'],
  ['system-manager-dashboard', '461a9002-af79-4769-b416-e29320ce15be'],
  ['clinic-admin-dashboard', '8b8012eb-5475-4461-84a1-fb379828a54f'],
  ['secretary-dashboard', '22b5f358-8b79-4a33-b4b5-a2a6f63dd3e9'],
  // Batch 2: monitoring & init
  ['kafka-init', 'd7d8efe0-97c4-46ca-a71d-40d9e4be4c3a'],
  ['otel-collector', '1f789229-f148-4aad-a75e-db697905c45c'],
  ['grafana', '1b080c70-0c51-4f6a-95fd-f0d7179606ae'],
  ['loki', 'b5ad0060-353a-4ee2-8c3a-246f57e65f46'],
  ['prometheus', 'b54a1837-e202-4d5b-963f-44e9fe997325'],
  ['jaeger', 'd1f9083d-70db-4054-9ccd-38a4009fae42'],
  // Batch 3: messaging
  ['kafka', 'e97e274a-324c-46e1-b73b-29d4f9ed0305'],
  ['zookeeper', '1fcd10b7-2707-4c65-8deb-47ee0be14bd8'],
  // Batch 4: databases & integrations (data volumes preserved)
  ['openemr', 'd2a15df6-44d1-440c-b763-0f02e40fbf6c'],
  ['mariadb-openemr', 'a4423033-0cc5-41e0-8289-aa8ad70addb4'],
  ['pure-fulfillment', '1acd27e2-0014-47e7-bd1f-9b6f55c76c8c'],
  ['Redis', '7bd8c86f-ace6-423a-af30-319d064621e6'],
  ['Postgres', '7becf8c2-d895-427b-9882-9b3bab30b602'],
];

async function loadToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) {
    return process.env.RAILWAY_TOKEN.trim();
  }

  const configPath = path.join(os.homedir(), '.railway', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let token = config?.user?.accessToken;

  if (token) {
    const ok = await testToken(token);
    if (ok) return token;
  }

  const refreshToken = config?.user?.refreshToken;
  if (refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken, config);
    if (refreshed) {
      config.user.accessToken = refreshed.accessToken;
      if (refreshed.refreshToken) config.user.refreshToken = refreshed.refreshToken;
      if (refreshed.tokenExpiresAt) config.user.tokenExpiresAt = refreshed.tokenExpiresAt;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return refreshed.accessToken;
    }
  }

  throw new Error(
    'Railway auth failed. Create a token at https://railway.com/account/tokens then run:\n' +
      '  $env:RAILWAY_TOKEN="your-token"; node scripts/railway-stop-deployments.mjs',
  );
}

async function testToken(token) {
  try {
    const data = await gql(token, 'query { me { id } }', {});
    return Boolean(data?.me?.id);
  } catch {
    return false;
  }
}

async function refreshAccessToken(refreshToken, config) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const clientId = config?.user?.clientId || config?.clientId;
  if (clientId) body.set('client_id', clientId);

  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.access_token) return null;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    tokenExpiresAt: json.expires_in
      ? Math.floor(Date.now() / 1000) + json.expires_in
      : undefined,
  };
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

async function getLatestSuccessDeployment(token, serviceId) {
  const data = await gql(
    token,
    `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt } }
      }
    }`,
    {
      input: {
        projectId: PROJECT_ID,
        environmentId: ENV_ID,
        serviceId,
        status: { in: ['SUCCESS'] },
      },
      first: 1,
    },
  );
  return data.deployments.edges[0]?.node ?? null;
}

async function removeDeployment(token, deploymentId) {
  return gql(
    token,
    `mutation deploymentRemove($id: String!) { deploymentRemove(id: $id) }`,
    { id: deploymentId },
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const token = await loadToken();
  const results = { removed: [], skipped: [], failed: [] };

  console.log('Stopping Railway deployments (project kept, services kept)...\n');

  for (const [name, serviceId] of SERVICE_ORDER) {
    try {
      const deployment = await getLatestSuccessDeployment(token, serviceId);
      if (!deployment) {
        console.log(`  SKIP  ${name} — no active SUCCESS deployment`);
        results.skipped.push(name);
        continue;
      }

      await removeDeployment(token, deployment.id);
      console.log(`  OK    ${name} — removed ${deployment.id.slice(0, 8)}...`);
      results.removed.push(name);
      await sleep(800);
    } catch (err) {
      console.log(`  FAIL  ${name} — ${err.message}`);
      results.failed.push({ name, error: err.message });
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Removed: ${results.removed.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Failed:  ${results.failed.length}`);
  if (results.failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
