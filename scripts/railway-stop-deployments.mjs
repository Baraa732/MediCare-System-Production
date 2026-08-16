/**
 * Safely stop Railway services by removing active SUCCESS deployments only.
 * Does NOT delete project or services. Reads auth from ~/.railway/config.json
 *
 * Target: anasdalati3 reliable-flow (production)
 * Restart later with: node scripts/railway-start-deployments.mjs
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const PROJECT_ID = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV_ID = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const API = 'https://backboard.railway.com/graphql/v2';

const SERVICE_ORDER = [
  // Batch 1: API gateway, microservices, dashboards
  ['MediCare-System-Production', '84d042b5-f4e0-4c6f-81db-81661c604f81'],
  ['auth-service', '8550641b-4537-4914-9300-545f32d5270f'],
  ['user-service', '2e53deaf-bd29-4504-9cf9-7ead72c4ecde'],
  ['clinic-service', 'f12e235b-60b5-47f1-9e7d-03c05219c199'],
  ['system-manager-service', 'a29b748e-22fe-48a7-91d2-4e0e7a8a9594'],
  ['appointment-service', '17bebd9b-6636-4097-bfdf-54a57388f3ee'],
  ['scheduling-service', 'c3bcc13d-463d-402b-828b-7b9582cd101a'],
  ['notification-service', '2c1f006e-bea4-4da9-b16a-06efa760a598'],
  ['reminder-service', 'd13d7566-ec68-42d2-b49b-7443f0403706'],
  ['emr-service', '57a96f70-e062-4b7a-b747-18725b62bb70'],
  ['system-manager-dashboard', 'f5a64b86-2750-4a2a-ba7a-dc4bff3a8856'],
  ['clinic-admin-dashboard', 'b3f29015-2a95-4a76-a70f-37b9470251a2'],
  ['secretary-dashboard', '835ca78b-6672-440e-b625-2f3e1662d9c1'],
  // Batch 2: monitoring & init
  ['kafka-init', 'f8339169-3ea1-4aa5-a0cf-924cd2efb103'],
  ['otel-collector', '3d23ef81-60c6-4d61-ab3b-2f72a21acdc5'],
  ['grafana', 'dea291cc-8f9a-48dd-99a4-6ce3f4f3f48e'],
  ['loki', '6200644f-3d0a-4d97-80bc-840924ac85a0'],
  ['prometheus', '6f65a774-c1c7-4b0b-8a38-e734cb7748bf'],
  ['jaeger', '05fd429a-9b9a-4852-b1d9-cafecf023c0b'],
  // Batch 3: messaging + WhatsApp
  ['evolution-api', '62ce897d-ce96-4890-83bb-d291eb756a6b'],
  ['kafka', 'c01662ff-17da-4911-a02f-b72cfabab99f'],
  ['zookeeper', '0e191a3c-dbe8-48f3-b2bd-692172873104'],
  // Batch 4: databases & integrations (data volumes preserved)
  ['openemr', 'e27b77b2-a6a8-4756-b5d4-b5a4a82fe25e'],
  ['mariadb-openemr', 'c8f0e660-e34d-4ad2-a2b2-adfd4bef93f8'],
  ['create-evolution-db', '00ffacf6-0e88-4092-8a6f-677d3c73e52f'],
  ['Redis', 'bc1658f1-ee50-48b8-aa24-81724a98f133'],
  ['Postgres', 'b8c1076d-b87c-4a62-9954-be499f924cc8'],
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

  console.log('Stopping Railway deployments on reliable-flow (project kept, services kept)...\n');

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
  console.log('\nRestart later with: node scripts/railway-start-deployments.mjs');
  if (results.failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
