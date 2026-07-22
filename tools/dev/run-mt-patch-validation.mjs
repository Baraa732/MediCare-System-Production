#!/usr/bin/env node
/** Targeted multi-tenancy validation after avatar/EMR/shared-patient patches */
import { readFileSync } from 'fs';

const API = process.env.API_BASE || 'http://localhost:3000/api';
const MT = JSON.parse(readFileSync('tools/dev/mt-isolation-seed-output.json', 'utf8'));
const PASS = MT.password;

const results = [];

async function req(method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 120) };
  }
  return { status: res.status, data, text };
}

async function clearRateLimits(phone) {
  await req('POST', `/auth/dev/clear-rate-limits?phoneNumber=${encodeURIComponent(phone)}`, { body: {} });
}

async function loginStaff(phone, deviceId) {
  await clearRateLimits(phone);
  const login = await req('POST', '/auth/login', { body: { phoneNumber: phone, password: PASS, deviceId } });
  if (login.data.accessToken) return login.data.accessToken;
  const mfa = await req('POST', '/auth/verify-mfa', {
    body: { mfaToken: login.data.mfaToken, otp: login.data.devOtp, deviceId },
  });
  if (!mfa.data.accessToken) throw new Error(`login failed ${phone}: ${JSON.stringify(login.data)}`);
  return mfa.data.accessToken;
}

function record(test, pass, detail) {
  results.push({ test, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${test}: ${detail}`);
}

function denied(status) {
  return status === 403 || status === 404;
}

const patientB1 = MT.clinicB.users.patient1;
const sharedPatient = MT.sharedPatient;

const adminA = await loginStaff(MT.clinicA.users.clinicAdmin.phone, 'mt-patch-admin-a');
const secA = await loginStaff(MT.clinicA.users.secretary.phone, 'mt-patch-sec-a');

// TASK 5 negative / positive matrix
const avatarCross = await req('GET', `/users/avatars/${patientB1.userId}`, { token: adminA });
record(
  'Avatar attack — Admin A → Clinic B patient avatar',
  denied(avatarCross.status),
  `HTTP ${avatarCross.status}`,
);

const emrCross = await req('GET', `/emr/patients/${patientB1.userId}?clinicId=${MT.clinicB.clinicId}`, {
  token: adminA,
});
record(
  'EMR attack — Admin A → Clinic B patient EMR',
  denied(emrCross.status),
  `HTTP ${emrCross.status}`,
);

const sharedProfile = await req('GET', `/users/${sharedPatient.userId}`, { token: adminA });
record(
  'Shared patient — Admin A profile by ID',
  sharedProfile.status === 200,
  `HTTP ${sharedProfile.status}`,
);

const sharedAvatar = await req('GET', `/users/avatars/${sharedPatient.userId}`, { token: secA });
record(
  'Shared patient — Secretary A avatar (authorized)',
  sharedAvatar.status === 200 || (sharedAvatar.status === 404 && !sharedAvatar.text.includes('Forbidden')),
  `HTTP ${sharedAvatar.status}`,
);

const secAvatarCross = await req('GET', `/users/avatars/${patientB1.userId}`, { token: secA });
record(
  'Avatar attack — Secretary A → Clinic B patient avatar',
  denied(secAvatarCross.status),
  `HTTP ${secAvatarCross.status}`,
);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL: ${f.test} — ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
