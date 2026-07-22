#!/usr/bin/env node
/** Validate P1 production-critical MT/infra patches */
import { readFileSync } from 'fs';

const API = process.env.API_BASE || 'http://localhost:3000/api';
const MT = JSON.parse(readFileSync('tools/dev/mt-isolation-seed-output.json', 'utf8'));
const PASS = MT.password;

const results = [];

async function req(method, path, { token, body } = {}) {
  const h = {};
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
  return { status: res.status, data };
}

async function clearRateLimits(phone) {
  await req('POST', `/auth/dev/clear-rate-limits?phoneNumber=${encodeURIComponent(phone)}`, { body: {} });
}

async function loginStaff(phone, deviceId) {
  await clearRateLimits(phone);
  const login = await req('POST', '/auth/login', {
    body: { phoneNumber: phone, password: PASS, deviceId },
  });
  if (login.data.accessToken) return login.data.accessToken;
  const mfa = await req('POST', '/auth/verify-mfa', {
    body: { mfaToken: login.data.mfaToken, otp: login.data.devOtp, deviceId },
  });
  return mfa.data.accessToken;
}

async function loginSystemManager() {
  const seed = JSON.parse(readFileSync('tools/dev/e2e-seed-output.json', 'utf8'));
  const login = await req('POST', '/system-manager/login', {
    body: { username: seed.systemManager.username, password: seed.systemManager.password },
  });
  if (!login.data.accessToken) throw new Error(`SM login failed: ${JSON.stringify(login.data)}`);
  return login.data.accessToken;
}

function record(test, pass, detail) {
  results.push({ test, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${test}: ${detail}`);
}

const adminA = await loginStaff(MT.clinicA.users.clinicAdmin.phone, 'prod-crit-admin');
const secA = await loginStaff(MT.clinicA.users.secretary.phone, 'prod-crit-sec');
const docA = await loginStaff(MT.clinicA.users.doctor.phone, 'prod-crit-doc');
let smToken;
try {
  smToken = await loginSystemManager();
} catch (e) {
  record('SM login (prerequisite)', false, String(e.message || e));
}

if (smToken) {
  const ok = await req('GET', '/system-manager/activation-code/status?code=TEST-CODE', { token: smToken });
  record(
    'SM activation-code/status — SYSTEM_MANAGER',
    ok.status !== 401 && ok.status !== 403,
    `HTTP ${ok.status}`,
  );
}

for (const [role, token] of [
  ['CLINIC_ADMIN', adminA],
  ['SECRETARY', secA],
  ['DOCTOR', docA],
]) {
  const r = await req('GET', '/system-manager/activation-code/status?code=TEST-CODE', { token });
  record(`${role} blocked from activation-code/status`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
process.exit(failed.length ? 1 : 0);
