/**
 * Upsert Firebase Admin + Android client env vars on notification-service.
 * Usage:
 *   node scripts/set-firebase-railway-vars.mjs "C:\path\to\serviceAccount.json"
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const NOTIFICATION_SERVICE = '076360d5-b800-41fa-b103-bb5b2a532c83';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOOGLE_SERVICES = path.resolve(
  __dirname,
  '../Frontend/Flutter/patient-app/android/app/google-services.json',
);

function loadRailwayToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  return JSON.parse(
    fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'),
  ).user.accessToken;
}

async function refreshRailwayToken() {
  const configPath = path.join(os.homedir(), '.railway', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'rlwy_oaci_onEklvmksh1hRUiCo7E2zX12',
      grant_type: 'refresh_token',
      refresh_token: cfg.user.refreshToken,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Railway refresh failed: ${JSON.stringify(json)}`);
  cfg.user.accessToken = json.access_token;
  if (json.refresh_token) cfg.user.refreshToken = json.refresh_token;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  return json.access_token;
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

const saPath = process.argv[2];
if (!saPath || !fs.existsSync(saPath)) {
  console.error('Usage: node scripts/set-firebase-railway-vars.mjs <serviceAccount.json>');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
const gs = JSON.parse(fs.readFileSync(GOOGLE_SERVICES, 'utf8'));

const projectId = sa.project_id;
const clientEmail = sa.client_email;
const privateKeyEscaped = String(sa.private_key).replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
const androidApiKey = gs.client?.[0]?.api_key?.[0]?.current_key;
const androidAppId = gs.client?.[0]?.client_info?.mobilesdk_app_id;
const messagingSenderId = gs.project_info?.project_number;
const storageBucket = gs.project_info?.storage_bucket;

if (!projectId || !clientEmail || !privateKeyEscaped.includes('BEGIN PRIVATE KEY')) {
  throw new Error('Invalid service account JSON');
}
if (!androidApiKey || !androidAppId || !messagingSenderId) {
  throw new Error('Invalid google-services.json (missing api key / app id)');
}

const variables = {
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_CLIENT_EMAIL: clientEmail,
  FIREBASE_PRIVATE_KEY: privateKeyEscaped,
  FIREBASE_MESSAGING_SENDER_ID: String(messagingSenderId),
  FIREBASE_STORAGE_BUCKET: storageBucket || `${projectId}.appspot.com`,
  FIREBASE_ANDROID_API_KEY: androidApiKey,
  FIREBASE_ANDROID_APP_ID: androidAppId,
  // Reuse Android client values for mobile-config / web bootstrap until a web app is added.
  FIREBASE_WEB_API_KEY: androidApiKey,
  FIREBASE_WEB_APP_ID: androidAppId,
  FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
};

let token = loadRailwayToken();
try {
  await gql(token, 'query { me { id } }');
} catch {
  token = await refreshRailwayToken();
}

console.log(`Upserting Firebase vars on notification-service for project ${projectId}…`);
await gql(
  token,
  `mutation ($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`,
  {
    input: {
      projectId: PROJECT,
      environmentId: ENV,
      serviceId: NOTIFICATION_SERVICE,
      variables,
      replace: false,
    },
  },
);

console.log('Set keys:', Object.keys(variables).join(', '));
console.log('Railway will redeploy notification-service. Do not commit the service-account JSON.');
