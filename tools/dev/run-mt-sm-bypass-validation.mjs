#!/usr/bin/env node
/**
 * Multi-tenancy regression: SYSTEM_MANAGER middleware bypass + isolation checks.
 */
import { readFileSync } from 'fs';

const API = process.env.API_BASE || 'http://localhost:3000/api';
const MT = JSON.parse(readFileSync('tools/dev/mt-isolation-seed-output.json', 'utf8'));
const E2E = JSON.parse(readFileSync('tools/dev/e2e-seed-output.json', 'utf8'));
const MT_PASS = MT.password;
const E2E_PASS = E2E.password;

const results = [];

async function req(method, path, { body, token, expectStatus } = {}) {
  const url = `${API}${path}`;
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus} got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, data, text };
}

async function clearRateLimits(phoneNumber) {
  await req('POST', `/auth/dev/clear-rate-limits?phoneNumber=${encodeURIComponent(phoneNumber)}`, { body: {} });
}

async function loginStaff(phone, password, deviceId) {
  await clearRateLimits(phone);
  const login = await req('POST', '/auth/login', {
    body: { phoneNumber: phone, password, deviceId },
  });
  if (login.status !== 200) throw new Error(`login ${phone}: ${login.status} ${login.text.slice(0, 200)}`);
  if (login.data.accessToken) return login.data.accessToken;
  const otp = login.data.devOtp;
  if (!otp) throw new Error(`login ${phone}: no devOtp`);
  const mfa = await req('POST', '/auth/verify-mfa', {
    body: { mfaToken: login.data.mfaToken, otp, deviceId },
  });
  if (mfa.status !== 200 || !mfa.data.accessToken) {
    throw new Error(`verify-mfa ${phone}: ${mfa.status}`);
  }
  return mfa.data.accessToken;
}

function record(test, pass, detail) {
  results.push({ test, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${test}: ${detail}`);
}

async function testA() {
  const name = 'Test A — System Manager global access';
  try {
    const sm = await req('POST', '/system-manager/login', {
      body: { username: E2E.systemManager.username, password: E2E.systemManager.password },
    });
    if (sm.status !== 200 && sm.status !== 201) {
      throw new Error(`SM login expected 200/201 got ${sm.status}`);
    }
    const token = sm.data.accessToken ?? sm.data.token;
    if (!token) throw new Error('no SM token');

    const clinics = await req('GET', '/clinics', { token, expectStatus: 200 });
    const users = await req('GET', '/users?page=1&limit=20', { token, expectStatus: 200 });
    const clinicCount = (clinics.data.clinics ?? []).length;
    const userTotal = users.data.pagination?.total ?? users.data.total ?? '?';
    record(name, true, `GET /clinics → ${clinicCount} clinics; GET /users → total ${userTotal}`);
  } catch (e) {
    record(name, false, e.message);
  }
}

async function testB() {
  const name = 'Test B — Clinic isolation still enforced';
  const clinicA = MT.clinicA.clinicId;
  const clinicB = MT.clinicB.clinicId;
  const device = 'mt-isolation-test-b';
  try {
    const adminA = await loginStaff(MT.clinicA.users.clinicAdmin.phone, MT_PASS, device);

    const staffB = await req('GET', `/clinics/${clinicB}/staff`, { token: adminA });
    const staffOk = staffB.status === 403 || staffB.status === 404;
    if (!staffOk) throw new Error(`cross-clinic staff expected 403/404 got ${staffB.status}`);

    const apptB = await req('GET', `/appointments?clinicId=${clinicB}`, { token: adminA });
    const apptOk = apptB.status === 403 || apptB.status === 404 || (apptB.status === 200 && (apptB.data.appointments ?? []).length === 0);
    if (!apptOk) throw new Error(`cross-clinic appointments expected deny/empty got ${apptB.status}`);

    const emrB = await req('GET', `/emr/patients/${MT.clinicB.users.patient1.userId}?clinicId=${clinicB}`, { token: adminA });
    const emrOk = emrB.status === 403 || emrB.status === 404;
    if (!emrOk) throw new Error(`cross-clinic EMR expected 403/404 got ${emrB.status}`);

    record(name, true, `Clinic A admin blocked from B staff (${staffB.status}), appointments (${apptB.status}), EMR (${emrB.status})`);
  } catch (e) {
    record(name, false, e.message);
  }
}

async function testC() {
  const name = 'Test C — Shared patient multi-clinic access';
  const sharedId = MT.sharedPatient.userId;
  const clinicA = MT.clinicA.clinicId;
  const clinicB = MT.clinicB.clinicId;
  try {
    const doctorA = await loginStaff(MT.clinicA.users.doctor.phone, MT_PASS, 'mt-shared-a');
    const doctorB = await loginStaff(MT.clinicB.users.doctor.phone, MT_PASS, 'mt-shared-b');
    const doctorUnrelated = await loginStaff(E2E.users.doctor.phone, E2E_PASS, 'mt-shared-c');

    const emrA = await req('GET', `/emr/patients/${sharedId}?clinicId=${clinicA}`, { token: doctorA, expectStatus: 200 });
    const emrB = await req('GET', `/emr/patients/${sharedId}?clinicId=${clinicB}`, { token: doctorB, expectStatus: 200 });
    const emrC = await req('GET', `/emr/patients/${sharedId}?clinicId=${E2E.clinic.id}`, { token: doctorUnrelated });
    const denied = emrC.status === 403 || emrC.status === 404;
    if (!denied) throw new Error(`unrelated clinic doctor expected 403/404 got ${emrC.status}`);

    record(
      name,
      true,
      `Doctors A/B can access shared patient; unrelated clinic doctor denied (${emrC.status})`,
    );
  } catch (e) {
    record(name, false, e.message);
  }
}

await testA();
await testB();
await testC();

const failed = results.filter((r) => !r.pass);
console.log('\n=== Summary ===');
for (const r of results) console.log(`${r.pass ? '✓' : '✗'} ${r.test}`);
process.exit(failed.length ? 1 : 0);
