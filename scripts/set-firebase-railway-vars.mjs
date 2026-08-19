/**
 * Upsert Firebase Admin + Android client env vars on notification-service.
 * Usage:
 *   node scripts/set-firebase-railway-vars.mjs "C:\path\to\serviceAccount.json" ["C:\path\to\doctor-google-services.json"]
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const NOTIFICATION_SERVICE = '2c1f006e-bea4-4da9-b16a-06efa760a598';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATIENT_GOOGLE_SERVICES = path.resolve(
  __dirname,
  '../Frontend/Flutter/patient-app/android/app/google-services.json',
);
const DOCTOR_PACKAGE_NAME = 'com.medicare.cms_doctor_app';

function pickClientByPackage(gs, packageName) {
  const client = gs?.client?.find(
    (entry) =>
      entry?.client_info?.android_client_info?.package_name === packageName,
  );
  if (!client) {
    throw new Error(`google-services.json does not contain package ${packageName}`);
  }
  return client;
}

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
const doctorGoogleServicesPath = process.argv[3];
if (!saPath || !fs.existsSync(saPath)) {
  console.error(
    'Usage: node scripts/set-firebase-railway-vars.mjs <serviceAccount.json> [doctor-google-services.json]',
  );
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
const patientGs = JSON.parse(fs.readFileSync(PATIENT_GOOGLE_SERVICES, 'utf8'));
const doctorGs =
  doctorGoogleServicesPath && fs.existsSync(doctorGoogleServicesPath)
    ? JSON.parse(fs.readFileSync(doctorGoogleServicesPath, 'utf8'))
    : null;
const patientClient = pickClientByPackage(patientGs, 'com.medicare.cms');
const doctorClient = doctorGs
  ? pickClientByPackage(doctorGs, DOCTOR_PACKAGE_NAME)
  : null;

const projectId = sa.project_id;
const clientEmail = sa.client_email;
const privateKeyEscaped = String(sa.private_key).replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
const patientAndroidApiKey = patientClient?.api_key?.[0]?.current_key;
const patientAndroidAppId = patientClient?.client_info?.mobilesdk_app_id;
const messagingSenderId = patientGs.project_info?.project_number;
const storageBucket = patientGs.project_info?.storage_bucket;
const doctorAndroidApiKey = doctorClient?.api_key?.[0]?.current_key;
const doctorAndroidAppId = doctorClient?.client_info?.mobilesdk_app_id;

if (!projectId || !clientEmail || !privateKeyEscaped.includes('BEGIN PRIVATE KEY')) {
  throw new Error('Invalid service account JSON');
}
if (!patientAndroidApiKey || !patientAndroidAppId || !messagingSenderId) {
  throw new Error('Invalid google-services.json (missing api key / app id)');
}

const variables = {
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_CLIENT_EMAIL: clientEmail,
  FIREBASE_PRIVATE_KEY: privateKeyEscaped,
  FIREBASE_MESSAGING_SENDER_ID: String(messagingSenderId),
  FIREBASE_STORAGE_BUCKET: storageBucket || `${projectId}.appspot.com`,
  FIREBASE_ANDROID_API_KEY: patientAndroidApiKey,
  FIREBASE_ANDROID_APP_ID: patientAndroidAppId,
  // Reuse Android client values for mobile-config / web bootstrap until a web app is added.
  FIREBASE_WEB_API_KEY: patientAndroidApiKey,
  FIREBASE_WEB_APP_ID: patientAndroidAppId,
  FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
};

if (doctorAndroidApiKey && doctorAndroidAppId) {
  variables.FIREBASE_DOCTOR_ANDROID_API_KEY = doctorAndroidApiKey;
  variables.FIREBASE_DOCTOR_ANDROID_APP_ID = doctorAndroidAppId;
}

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
