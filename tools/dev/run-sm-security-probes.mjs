#!/usr/bin/env node
/** SM dashboard security probes — Attack 1/2/3 */
const API = process.env.API_BASE || 'http://localhost:3000/api';
const MT = JSON.parse(await import('fs').then((m) => m.readFileSync('tools/dev/mt-isolation-seed-output.json', 'utf8')));
const E2E = JSON.parse(await import('fs').then((m) => m.readFileSync('tools/dev/e2e-seed-output.json', 'utf8')));
const PASS = MT.password;

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data, text };
}

async function loginStaff(phone) {
  await req('POST', `/auth/dev/clear-rate-limits?phoneNumber=${encodeURIComponent(phone)}`, { body: {} });
  const login = await req('POST', '/auth/login', { body: { phoneNumber: phone, password: PASS, deviceId: 'sm-audit-attack' } });
  if (login.data.accessToken) return login.data.accessToken;
  const mfa = await req('POST', '/auth/verify-mfa', { body: { mfaToken: login.data.mfaToken, otp: login.data.devOtp, deviceId: 'sm-audit-attack' } });
  if (!mfa.data.accessToken) throw new Error(`login failed ${phone}: ${login.status}`);
  return mfa.data.accessToken;
}

async function smLogin() {
  const r = await req('POST', '/system-manager/login', { body: { username: E2E.systemManager.username, password: E2E.systemManager.password } });
  return r.data.accessToken;
}

const adminA = await loginStaff(MT.clinicA.users.clinicAdmin.phone);
const sm = await smLogin();

const probes = [
  ['Attack 1 — Clinic admin → SM stats', await req('GET', '/system-manager/platform/stats', { token: adminA })],
  ['Attack 1 — Clinic admin → SM logs', await req('GET', '/system-manager/platform/logs?range=15m', { token: adminA })],
  ['Attack 1 — Clinic admin → SM create admin', await req('POST', '/system-manager/create', { token: adminA, body: { username: 'x', password: 'x12345', firstName: 'X', lastName: 'Y' } })],
  ['Attack 2 — No JWT → SM stats', await req('GET', '/system-manager/platform/stats')],
  ['Attack 2 — No JWT → list users', await req('GET', '/users?page=1&limit=5')],
  ['Attack 3 — SM PUT clinic (mutation)', await req('PUT', `/clinics/${MT.clinicA.clinicId}`, { token: sm, body: { description: 'SM audit touch' } })],
  ['Attack 3 — SM POST staff assign', await req('POST', `/clinics/${MT.clinicA.clinicId}/staff`, { token: sm, body: { userId: MT.clinicA.users.secretary.userId, staffRole: 'SECRETARY' } })],
];

for (const [name, r] of probes) console.log(`${name}: HTTP ${r.status} — ${JSON.stringify(r.data).slice(0, 180)}`);
