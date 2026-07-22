#!/usr/bin/env node
/** Clinic Admin + Secretary multi-tenancy negative tests */
import { readFileSync } from 'fs';

const API = process.env.API_BASE || 'http://localhost:3000/api';
const MT = JSON.parse(readFileSync('tools/dev/mt-isolation-seed-output.json', 'utf8'));
const PASS = MT.password;

const results = [];

async function req(method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data, text };
}

async function clearRateLimits(phone) {
  await req('POST', `/auth/dev/clear-rate-limits?phoneNumber=${encodeURIComponent(phone)}`, { body: {} });
}

async function loginStaff(phone, deviceId) {
  await clearRateLimits(phone);
  const login = await req('POST', '/auth/login', { body: { phoneNumber: phone, password: PASS, deviceId } });
  if (login.data.accessToken) return login.data.accessToken;
  const mfa = await req('POST', '/auth/verify-mfa', { body: { mfaToken: login.data.mfaToken, otp: login.data.devOtp, deviceId } });
  if (!mfa.data.accessToken) throw new Error(`login failed ${phone}`);
  return mfa.data.accessToken;
}

function record(role, test, pass, detail) {
  results.push({ role, test, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${role}] ${test}: ${detail}`);
}

function denied(status) {
  return status === 403 || status === 404;
}

const clinicA = MT.clinicA.clinicId;
const clinicB = MT.clinicB.clinicId;
const apptA = MT.clinicA.appointmentId;
const apptB = MT.clinicB.appointmentId;
const sharedPatient = MT.sharedPatient;
const patientB1 = MT.clinicB.users.patient1;

const adminA = await loginStaff(MT.clinicA.users.clinicAdmin.phone, 'mt-ca-audit');
const adminB = await loginStaff(MT.clinicB.users.clinicAdmin.phone, 'mt-ca-b-audit');
const secA = await loginStaff(MT.clinicA.users.secretary.phone, 'mt-sec-audit');
const secB = await loginStaff(MT.clinicB.users.secretary.phone, 'mt-sec-b-audit');
const docA = await loginStaff(MT.clinicA.users.doctor.phone, 'mt-doc-audit');

// --- Clinic Admin cross-clinic ---
const caTests = [
  ['staff B', () => req('GET', `/clinics/${clinicB}/staff`, { token: adminA })],
  ['appointments B', () => req('GET', `/appointments?clinicId=${clinicB}`, { token: adminA })],
  ['appointment B by id', () => req('GET', `/appointments/${apptB}`, { token: adminA })],
  ['schedule hours B', () => req('GET', `/schedule/clinics/${clinicB}/hours`, { token: adminA })],
  ['patient B lookup phone', () => req('GET', `/users/lookup/patient/${encodeURIComponent(patientB1.phone)}`, { token: adminA })],
  ['patient B profile by id', () => req('GET', `/users/${patientB1.userId}`, { token: adminA })],
  ['emr B patient', () => req('GET', `/emr/patients/${patientB1.userId}?clinicId=${clinicB}`, { token: adminA })],
  ['notifications inbox spoof B', () => req('GET', '/notifications/staff/inbox?page=1&limit=10', { token: adminA, headers: { 'X-Tenant-ID': clinicB } })],
  ['avatar B patient', () => req('GET', `/users/avatars/${patientB1.userId}`, { token: adminA })],
  ['shared patient emr at B (admin A)', () => req('GET', `/emr/patients/${sharedPatient.userId}?clinicId=${clinicB}`, { token: adminA })],
];

for (const [name, fn] of caTests) {
  const r = await fn();
  const ok = name === 'avatar B patient' ? r.status === 404 || r.status === 403 : denied(r.status);
  record('CLINIC_ADMIN', `Cross-clinic ${name}`, ok, `HTTP ${r.status}`);
}

// Positive: shared patient at own clinic
const sharedOwn = await req('GET', `/users/lookup/patient/${encodeURIComponent(sharedPatient.phone)}`, { token: adminA });
record('CLINIC_ADMIN', 'Shared patient lookup at Clinic A', sharedOwn.status === 200, `HTTP ${sharedOwn.status}`);

// --- Secretary cross-clinic ---
const secTests = [
  ['patient B phone lookup', () => req('GET', `/users/lookup/patient/${encodeURIComponent(patientB1.phone)}`, { token: secA })],
  ['appointments B', () => req('GET', `/appointments?clinicId=${clinicB}`, { token: secA })],
  ['appointment B by id', () => req('GET', `/appointments/${apptB}`, { token: secA })],
  ['doctors B', () => req('GET', `/clinics/${clinicB}/doctors`, { token: secA })],
  ['emr B', () => req('GET', `/emr/patients/${patientB1.userId}?clinicId=${clinicB}`, { token: secA })],
  ['shared emr at B', () => req('GET', `/emr/patients/${sharedPatient.userId}?clinicId=${clinicB}`, { token: secA })],
];

for (const [name, fn] of secTests) {
  const r = await fn();
  record('SECRETARY', `Cross-clinic ${name}`, denied(r.status), `HTTP ${r.status}`);
}

const secSharedA = await req('GET', `/users/lookup/patient/${encodeURIComponent(sharedPatient.phone)}`, { token: secA });
record('SECRETARY', 'Shared patient lookup at Clinic A', secSharedA.status === 200, `HTTP ${secSharedA.status}`);

const secApptA = await req('GET', `/appointments?clinicId=${clinicA}`, { token: secA });
record('SECRETARY', 'Own clinic appointments', secApptA.status === 200, `HTTP ${secApptA.status}`);

// Existence leak: unknown phone should be 404 not 403
const fakePhone = '+963999008999';
const leakA = await req('GET', `/users/lookup/patient/${encodeURIComponent(fakePhone)}`, { token: secA });
const leakMsg = leakA.data?.message || leakA.data?.error?.message || '';
record('SECRETARY', 'Unknown phone generic 404', leakA.status === 404 && !/clinic|forbidden|access/i.test(leakMsg), `HTTP ${leakA.status} msg=${leakMsg.slice(0,60)}`);

// Doctor API cross-clinic EMR (no frontend)
const emrCross = await req('GET', `/emr/patients/${patientB1.userId}?clinicId=${clinicB}`, { token: docA });
record('DOCTOR(API)', 'Cross-clinic EMR', denied(emrCross.status), `HTTP ${emrCross.status}`);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL: [${f.role}] ${f.test} — ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
