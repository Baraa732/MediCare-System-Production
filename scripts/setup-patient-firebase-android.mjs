/**
 * Creates Firebase Android app (com.example.cms) using notification-service
 * service-account credentials from Railway, then writes google-services.json.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const NOTIFICATION_SERVICE = '076360d5-b800-41fa-b103-bb5b2a532c83';
const PACKAGE_NAME = 'com.example.cms';
const DISPLAY_NAME = 'MediCare Patient';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(
  __dirname,
  '../Frontend/Flutter/patient-app/android/app/google-services.json',
);

function loadRailwayToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  const cfg = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'),
  );
  return cfg?.user?.accessToken;
}

async function refreshRailwayToken() {
  const configPath = path.join(os.homedir(), '.railway', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = cfg?.user?.refreshToken;
  if (!refreshToken) throw new Error('No Railway refresh token');
  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'rlwy_oaci_onEklvmksh1hRUiCo7E2zX12',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Railway token refresh failed: ${JSON.stringify(json)}`);
  }
  cfg.user.accessToken = json.access_token;
  if (json.refresh_token) cfg.user.refreshToken = json.refresh_token;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  return json.access_token;
}

async function railwayGql(token, query, variables) {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signServiceAccountJwt(clientEmail, privateKey, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(privateKey)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsigned}.${signature}`;
}

async function getGoogleAccessToken(clientEmail, privateKey) {
  const jwt = signServiceAccountJwt(clientEmail, privateKey, [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
  ]);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Google token failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function listAndroidApps(accessToken, projectId) {
  const res = await fetch(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`List android apps failed: ${JSON.stringify(json)}`);
  return json.apps ?? [];
}

async function createAndroidApp(accessToken, projectId) {
  const res = await fetch(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        packageName: PACKAGE_NAME,
        displayName: DISPLAY_NAME,
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Create android app failed: ${JSON.stringify(json)}`);
  return json;
}

async function waitForOperation(accessToken, operationName) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`https://firebase.googleapis.com/v1beta1/${operationName}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.done) {
      if (json.error) throw new Error(JSON.stringify(json.error));
      return json.response;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for Firebase operation');
}

async function downloadAndroidConfig(accessToken, appName) {
  // appName like projects/xxx/androidApps/1:123:android:abc
  const res = await fetch(
    `https://firebase.googleapis.com/v1beta1/${appName}/config`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Download config failed: ${JSON.stringify(json)}`);
  const b64 = json.configFileContents || json.configFilename;
  // API returns { configFilename, configFileContents } where contents are base64
  if (!json.configFileContents) {
    throw new Error(`Unexpected config payload: ${JSON.stringify(json)}`);
  }
  return Buffer.from(json.configFileContents, 'base64').toString('utf8');
}

async function main() {
  let railwayToken = loadRailwayToken();
  try {
    await railwayGql(railwayToken, 'query { me { id } }');
  } catch {
    railwayToken = await refreshRailwayToken();
  }

  const data = await railwayGql(
    railwayToken,
    `query variables($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    { projectId: PROJECT, environmentId: ENV, serviceId: NOTIFICATION_SERVICE },
  );

  const vars = data.variables ?? {};
  const firebaseKeys = Object.keys(vars)
    .filter((k) => /FIREBASE|FCM|GOOGLE_APPLICATION/i.test(k))
    .sort();
  console.log(`notification-service firebase-related keys: ${firebaseKeys.join(', ') || '(none)'}`);

  const projectId = (vars.FIREBASE_PROJECT_ID || vars.GCLOUD_PROJECT || '').trim();
  const clientEmail = (vars.FIREBASE_CLIENT_EMAIL || '').trim();
  let privateKey = (vars.FIREBASE_PRIVATE_KEY || '').trim();

  // Some deploys store the full service-account JSON instead.
  if ((!clientEmail || !privateKey) && vars.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(vars.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!projectId && sa.project_id) vars.FIREBASE_PROJECT_ID = sa.project_id;
      if (!clientEmail && sa.client_email) vars.FIREBASE_CLIENT_EMAIL = sa.client_email;
      if (!privateKey && sa.private_key) privateKey = sa.private_key;
    } catch {
      /* ignore */
    }
  }

  const resolvedProjectId = (projectId || vars.FIREBASE_PROJECT_ID || '').trim();
  const resolvedEmail = (clientEmail || vars.FIREBASE_CLIENT_EMAIL || '').trim();

  if (!resolvedProjectId || !resolvedEmail || !privateKey) {
    throw new Error(
      'Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY on notification-service',
    );
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  console.log(`Firebase project: ${resolvedProjectId}`);
  console.log(`Package: ${PACKAGE_NAME}`);

  const accessToken = await getGoogleAccessToken(resolvedEmail, privateKey);
  let apps = await listAndroidApps(accessToken, resolvedProjectId);
  let app = apps.find((a) => a.packageName === PACKAGE_NAME);

  if (app) {
    console.log(`Android app already exists: ${app.appId || app.name}`);
  } else {
    console.log('Creating Android app in Firebase…');
    const op = await createAndroidApp(accessToken, resolvedProjectId);
    if (op.name && !op.appId) {
      // Long-running operation
      const created = await waitForOperation(accessToken, op.name);
      app = created;
    } else {
      app = op;
    }
    // Refresh list to get canonical name
    apps = await listAndroidApps(accessToken, resolvedProjectId);
    app = apps.find((a) => a.packageName === PACKAGE_NAME) || app;
    console.log(`Created: ${app?.appId || app?.name}`);
  }

  const appName = app.name || `projects/${resolvedProjectId}/androidApps/${app.appId}`;
  const jsonText = await downloadAndroidConfig(accessToken, appName);

  // Validate JSON + package
  const parsed = JSON.parse(jsonText);
  const pkg = parsed?.client?.[0]?.android_client_info?.package_name;
  if (pkg && pkg !== PACKAGE_NAME) {
    throw new Error(`Config package mismatch: ${pkg}`);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);

  const mobilesdkAppId = parsed?.client?.[0]?.client_info?.mobilesdk_app_id;
  const apiKey = parsed?.client?.[0]?.api_key?.[0]?.current_key;
  const senderId = parsed?.project_info?.project_number;
  console.log(`ANDROID_APP_ID=${mobilesdkAppId || ''}`);
  console.log(`ANDROID_API_KEY=${apiKey ? `${apiKey.slice(0, 8)}…` : ''}`);
  console.log(`MESSAGING_SENDER_ID=${senderId || ''}`);
  console.log('Done. Rebuild the Flutter app (full restart, not hot reload).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
