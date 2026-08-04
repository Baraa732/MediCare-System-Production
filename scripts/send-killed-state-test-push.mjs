/**
 * End-to-end killed-state patient push test.
 * 1) Refresh Railway auth
 * 2) Load Firebase Admin creds from notification-service vars
 * 3) Read FCM token from the connected Android device (or argv)
 * 4) Send notification+data FCM (same shape as the fixed backend)
 *
 * Usage:
 *   node scripts/send-killed-state-test-push.mjs [optionalFcmToken]
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const NOTIFICATION_SERVICE = '076360d5-b800-41fa-b103-bb5b2a532c83';
const PACKAGE = 'com.medicare.cms';
const ADB =
  process.env.ADB_PATH ||
  path.join(
    process.env.LOCALAPPDATA || '',
    'Android',
    'Sdk',
    'platform-tools',
    'adb.exe',
  );

function loadConfig() {
  return JSON.parse(
    fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'),
  );
}

function loadToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  return loadConfig()?.user?.accessToken;
}

async function refreshToken() {
  const cfg = loadConfig();
  const refreshToken = cfg?.user?.refreshToken;
  if (!refreshToken) throw new Error('No Railway refresh token — run railway login');
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
  if (json.expires_in) {
    cfg.user.tokenExpiresAt = Math.floor(Date.now() / 1000) + json.expires_in;
  }
  fs.writeFileSync(
    path.join(os.homedir(), '.railway', 'config.json'),
    JSON.stringify(cfg, null, 2),
  );
  return json.access_token;
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function ensureRailwayToken() {
  let token = loadToken();
  try {
    await gql(token, 'query { me { id } }');
    return token;
  } catch {
    return refreshToken();
  }
}

async function loadFirebaseAdminFromRailway(token) {
  const data = await gql(
    token,
    `query ($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(
        projectId: $projectId
        environmentId: $environmentId
        serviceId: $serviceId
      )
    }`,
    {
      projectId: PROJECT,
      environmentId: ENV,
      serviceId: NOTIFICATION_SERVICE,
    },
  );

  const map = data?.variables || {};
  const projectId = map.FIREBASE_PROJECT_ID;
  const clientEmail = map.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(map.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'Firebase Admin vars missing on notification-service (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)',
    );
  }
  return { projectId, clientEmail, privateKey };
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
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
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Google token failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

function readFcmTokenFromDevice() {
  if (!fs.existsSync(ADB)) {
    throw new Error(`adb not found at ${ADB}`);
  }
  const xml = execFileSync(
    ADB,
    [
      'shell',
      'run-as',
      PACKAGE,
      'cat',
      `shared_prefs/FlutterSharedPreferences.xml`,
    ],
    { encoding: 'utf8' },
  );
  const match = xml.match(
    /name="flutter\.medicare_fcm_token"[^>]*>([^<]+)</,
  );
  if (!match?.[1]) {
    throw new Error(
      'FCM token not found in SharedPreferences. Open the app once while logged in.',
    );
  }
  return match[1].trim();
}

async function sendNotificationPlusData({
  projectId,
  accessToken,
  fcmToken,
}) {
  const title = 'Killed-state test';
  const body = `MediCare push OK at ${new Date().toLocaleTimeString()}`;
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data: {
        title,
        body,
        category: 'SYSTEM',
        deepLink: '/notifications',
        androidChannelId: 'medicare_patient',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        source: 'killed_state_test_script',
      },
      android: {
        priority: 'HIGH',
        ttl: '86400s',
        notification: {
          channel_id: 'medicare_patient',
          notification_priority: 'PRIORITY_MAX',
          default_sound: true,
          default_vibrate_timings: true,
          visibility: 'PUBLIC',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          tag: 'killed_state_test',
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`FCM send failed: ${JSON.stringify(json)}`);
  }
  return json;
}

function forceStopApp() {
  if (!fs.existsSync(ADB)) return;
  try {
    execFileSync(ADB, ['shell', 'am', 'force-stop', PACKAGE], {
      encoding: 'utf8',
    });
    console.log(`Force-stopped ${PACKAGE} (simulates killed / removed from Recents)`);
  } catch (e) {
    console.warn(`force-stop skipped: ${e.message}`);
  }
}

const fcmTokenArg = process.argv[2]?.trim();

console.log('Refreshing Railway auth…');
const railwayToken = await ensureRailwayToken();
console.log('Loading Firebase Admin vars from notification-service…');
const firebase = await loadFirebaseAdminFromRailway(railwayToken);

const fcmToken = fcmTokenArg || readFcmTokenFromDevice();
console.log(
  `Using FCM token …${fcmToken.slice(-12)} (len=${fcmToken.length})`,
);

console.log('Force-stopping patient app before send…');
forceStopApp();

console.log('Sending notification+data FCM…');
const googleToken = await getGoogleAccessToken(
  firebase.clientEmail,
  firebase.privateKey,
);
const result = await sendNotificationPlusData({
  projectId: firebase.projectId,
  accessToken: googleToken,
  fcmToken,
});

console.log('SUCCESS — check the phone system tray (app is killed).');
console.log(`FCM name: ${result.name ?? 'ok'}`);
