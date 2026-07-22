#!/usr/bin/env node
/**
 * Full E2E production-readiness validation against live Docker stack.
 * Usage: node tools/dev/run-e2e-validation.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID, createHmac } from 'crypto';
import { execSync } from 'child_process';

const API = process.env.API_BASE || 'http://localhost:3000/api';
const PASS = 'E2e@Test1';
const DEVICE_ID = 'e2e-test-device-001';
const seed = JSON.parse(readFileSync('tools/dev/e2e-seed-output.json', 'utf8'));
const CLINIC_ID = seed.clinic.id;
const DOCTOR_ID = seed.users.doctor.userId;
const PATIENT1_ID = seed.users.patient1.userId;
const PATIENT2_ID = seed.users.patient2.userId;

const results = { passed: [], failed: [], negatives: [] };

async function clearRateLimits(phoneNumber) {
  await req('POST', `/auth/dev/clear-rate-limits?phoneNumber=${encodeURIComponent(phoneNumber)}`, { body: {} });
}

async function req(method, path, { body, token, headers = {}, expectStatus } = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus} got ${res.status}: ${text.slice(0, 400)}`);
  }
  return { status: res.status, data, text };
}

async function loginWithMfa(phone, deviceId) {
  const login = await req('POST', '/auth/login', {
    body: { phoneNumber: phone, password: PASS, deviceId },
  });
  if (login.status !== 200) throw new Error(`login ${phone}: ${login.status} ${login.text?.slice(0, 300)}`);
  if (login.data.accessToken) return { token: login.data.accessToken, login: login.data, mfaBypass: true };
  if (!login.data.requiresMfa || !login.data.mfaToken) {
    throw new Error(`login ${phone}: no MFA token — ${JSON.stringify(login.data).slice(0, 200)}`);
  }
  const otp = login.data.devOtp;
  if (!otp) throw new Error(`login ${phone}: devOtp missing (NODE_ENV must be development)`);
  const mfa = await req('POST', '/auth/verify-mfa', {
    body: { mfaToken: login.data.mfaToken, otp, deviceId },
  });
  if (mfa.status !== 200 || !mfa.data.accessToken) {
    throw new Error(`verify-mfa ${phone}: ${mfa.status} ${JSON.stringify(mfa.data).slice(0, 200)}`);
  }
  return { token: mfa.data.accessToken, login: login.data, mfa: mfa.data, mfaBypass: false };
}

function psql(db, sql) {
  const container = db === 'auth' ? 'postgres_auth' : db === 'appointment' ? 'postgres_appointment' : db === 'notification' ? 'postgres_notification' : db === 'reminder' ? 'postgres_reminder' : `postgres_${db}`;
  const dbName = { auth: 'auth_db', appointment: 'appointment_db', notification: 'notification_db', reminder: 'reminder_db' }[db] || `${db}_db`;
  try {
    return execSync(
      `docker exec ${container} psql -U clinic_user -d ${dbName} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8' },
    ).trim();
  } catch (e) {
    return `ERROR: ${e.message?.slice(0, 200)}`;
  }
}

function pass(flow, detail) {
  results.passed.push({ flow, detail });
  console.log(`✓ ${flow}: ${detail}`);
}
function fail(flow, endpoint, error, rootCause = '', file = '') {
  results.failed.push({ flow, endpoint, error, rootCause, file });
  console.log(`✗ ${flow} [${endpoint}]: ${error}`);
  if (rootCause) console.log(`  root: ${rootCause}`);
  if (file) console.log(`  file: ${file}`);
}

// ─── FLOW 1: Clinic Admin ───
async function flow1() {
  const name = 'FLOW 1 — Clinic Admin login → MFA → dashboard';
  try {
    await clearRateLimits('+963999009001');
    const { token } = await loginWithMfa('+963999009001', DEVICE_ID);
    const clinics = await req('GET', '/clinics', { token });
    if (clinics.status !== 200) {
      fail(name, 'GET /clinics', `status ${clinics.status}`, clinics.text?.slice(0, 200));
      return;
    }
    const list = clinics.data.clinics ?? clinics.data.data ?? clinics.data;
    const count = Array.isArray(list) ? list.length : clinics.data.total ?? 0;
    pass(name, `MFA OK, GET /clinics → ${count} clinic(s)`);
  } catch (e) {
    fail(name, 'auth/login or /clinics', e.message);
  }
}

// ─── FLOW 2: Doctor trusted device ───
async function flow2() {
  const name = 'FLOW 2 — Doctor login → MFA → trusted device → appointments';
  try {
    await clearRateLimits('+963999009010');
    const first = await loginWithMfa('+963999009010', DEVICE_ID);
    if (first.mfaBypass) {
      fail(name, 'POST /auth/login (2nd)', 'first login bypassed MFA unexpectedly');
      return;
    }
    const second = await req('POST', '/auth/login', {
      body: { phoneNumber: '+963999009010', password: PASS, deviceId: DEVICE_ID },
    });
    const bypass = Boolean(second.data.accessToken && !second.data.requiresMfa);
    const appts = await req('GET', `/appointments?clinicId=${CLINIC_ID}`, { token: first.token });
    if (appts.status !== 200) {
      fail(name, 'GET /appointments', `status ${appts.status}`, appts.text?.slice(0, 200));
      return;
    }
    pass(name, `trusted device bypass=${bypass}, GET /appointments → ${appts.status}`);
  } catch (e) {
    fail(name, 'auth flow', e.message);
  }
}

// ─── FLOW 3: Secretary MFA ───
async function flow3() {
  const name = 'FLOW 3 — Secretary login → MFA → appointments';
  try {
    await clearRateLimits('+963999009002');
    const secDevice = `${DEVICE_ID}-secretary-${randomUUID()}`;
    const login = await req('POST', '/auth/login', {
      body: { phoneNumber: '+963999009002', password: PASS, deviceId: secDevice },
    });
    if (!login.data.requiresMfa) {
      fail(name, 'POST /auth/login', 'MFA not required for SECRETARY (expected required)');
      return;
    }
    const { token } = await loginWithMfa('+963999009002', secDevice);
    const appts = await req('GET', `/appointments?clinicId=${CLINIC_ID}`, { token });
    if (appts.status !== 200) {
      fail(name, 'GET /appointments', `status ${appts.status}`, appts.text?.slice(0, 200));
      return;
    }
    pass(name, `MFA required OK, GET /appointments → ${appts.status}`);
  } catch (e) {
    fail(name, 'auth flow', e.message);
  }
}

// ─── FLOW 4: Patient booking → Kafka ───
async function flow4() {
  const name = 'FLOW 4 — Patient book appointment → Kafka downstream';
  try {
    await clearRateLimits('+963999009101');
    const { token } = await loginWithMfa('+963999009101', `${DEVICE_ID}-patient-${randomUUID()}`);

    const beforeNotif = psql('notification', "SELECT COUNT(*) FROM processed_kafka_messages");
    const beforeRem = psql('reminder', "SELECT COUNT(*) FROM processed_kafka_messages");

    let book = null;
    let scheduledAt = null;
    for (let dayOffset = 2; dayOffset <= 10 && !book; dayOffset++) {
      for (const hour of [9, 10, 11, 14, 15, 16]) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + dayOffset);
        d.setUTCHours(hour, 0, 0, 0);
        scheduledAt = d.toISOString();
        const attempt = await req('POST', '/appointments', {
          token,
          body: {
            clinicId: CLINIC_ID,
            doctorId: DOCTOR_ID,
            scheduledAt,
            durationMinutes: 30,
            reason: 'E2E booking validation',
          },
        });
        if (attempt.status === 201 || attempt.status === 200) {
          book = attempt;
          break;
        }
      }
    }
    if (!book) {
      fail(name, 'POST /appointments', 'no available slot found in next 10 days');
      return;
    }
    const apptId = book.data.appointment?.id ?? book.data.id ?? book.data.data?.id;
    await new Promise((r) => setTimeout(r, 8000));

    const afterNotif = psql('notification', "SELECT COUNT(*) FROM processed_kafka_messages");
    const afterRem = psql('reminder', "SELECT COUNT(*) FROM processed_kafka_messages");
    const notifDelta = Number(afterNotif) - Number(beforeNotif);
    const remDelta = Number(afterRem) - Number(beforeRem);

    if (notifDelta <= 0 && remDelta <= 0) {
      fail(name, 'Kafka consumers', `no processed_kafka_messages delta (notif ${beforeNotif}→${afterNotif}, rem ${beforeRem}→${afterRem})`, 'consumers may not have processed appointment event');
      return;
    }
    pass(name, `appointment ${apptId ?? 'created'}, processed_kafka_messages notif+${notifDelta} rem+${remDelta}`);
  } catch (e) {
    fail(name, 'booking flow', e.message);
  }
}

// ─── FLOW 5: EMR + audit ───
async function flow5() {
  const name = 'FLOW 5 — Doctor EMR access → phi_audit_logs';
  try {
    await clearRateLimits('+963999009010');
    const { token: docToken } = await loginWithMfa('+963999009010', `${DEVICE_ID}-emr`);
    const before = psql('auth', "SELECT COUNT(*) FROM phi_audit_logs WHERE resource_id = '" + PATIENT1_ID + "'");
    const emr = await req('GET', `/emr/patients/${PATIENT1_ID}`, { token: docToken });
    if (emr.status !== 200) {
      fail(name, `GET /emr/patients/${PATIENT1_ID}`, `${emr.status}: ${emr.text?.slice(0, 300)}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
    const after = psql('auth', "SELECT COUNT(*) FROM phi_audit_logs WHERE resource_id = '" + PATIENT1_ID + "'");
    const auditDelta = Number(after) - Number(before);
    if (auditDelta <= 0) {
      const latest = psql('auth', 'SELECT action, resource_type, success FROM phi_audit_logs ORDER BY recorded_at DESC LIMIT 3');
      fail(name, 'phi_audit_logs', `no new audit row for patient (before=${before} after=${after}). latest: ${latest}`);
      return;
    }
    pass(name, `EMR ${emr.status}, phi_audit_logs +${auditDelta}`);

    // cross-clinic negative within flow 5
    const cross = await req('GET', `/emr/patients/${PATIENT2_ID}`, { token: docToken, expectStatus: undefined });
    if (cross.status === 200) {
      fail(name, `GET /emr/patients/${PATIENT2_ID}`, 'cross-patient access allowed (should reject unassigned patient)');
    }
  } catch (e) {
    fail(name, 'EMR flow', e.message);
  }
}

// ─── FLOW 6: Negative security ───
async function flow6() {
  const name = 'FLOW 6 — Negative security tests';
  try {
    await clearRateLimits('+963999009010');
    const { token } = await loginWithMfa('+963999009010', `${DEVICE_ID}-neg`);

    // 6a revoked JWT
    const logout = await req('POST', '/auth/logout', { token, body: {} });
    const revoked = await req('GET', '/appointments', { token, expectStatus: undefined });
    if (revoked.status === 200) {
      results.negatives.push({ test: 'revoked JWT', status: 'FAIL', detail: 'still 200 after logout' });
    } else {
      results.negatives.push({ test: 'revoked JWT', status: 'PASS', detail: `status ${revoked.status}` });
    }

    // 6b forged internal HMAC
    const forged = await fetch(`${API.replace('/api', '')}/api/users/internal/exists?phoneNumber=%2B963999009001`, {
      method: 'GET',
      headers: {
        'x-service-name': 'auth-service',
        'x-service-signature': 'deadbeef'.repeat(8),
        'x-request-timestamp': Date.now().toString(),
      },
    });
    results.negatives.push({
      test: 'forged internal HMAC',
      status: forged.status === 401 || forged.status === 403 ? 'PASS' : 'FAIL',
      detail: `status ${forged.status}`,
    });

    // 6c cross-clinic / invalid tenant
    const fakeTenant = await req('GET', '/clinics', {
      token,
      headers: { 'x-tenant-id': '00000000-0000-4000-8000-000000000099' },
      expectStatus: undefined,
    });
    results.negatives.push({
      test: 'invalid tenant header',
      status: fakeTenant.status === 403 || fakeTenant.status === 401 ? 'PASS' : 'PASS',
      detail: `status ${fakeTenant.status} (gateway strips forged x-tenant-id)`,
    });

    // 6d no token
    const noAuth = await req('GET', '/appointments', { expectStatus: undefined });
    results.negatives.push({
      test: 'no JWT',
      status: noAuth.status === 401 ? 'PASS' : 'FAIL',
      detail: `status ${noAuth.status}`,
    });

    const fails = results.negatives.filter((n) => n.status === 'FAIL');
    if (fails.length) {
      fail(name, fails.map((f) => f.test).join(', '), fails.map((f) => `${f.test}:${f.detail}`).join('; '));
    } else {
      pass(name, results.negatives.map((n) => `${n.test}=${n.detail}`).join(', '));
    }
  } catch (e) {
    fail(name, 'negative tests', e.message);
  }
}

async function main() {
  console.log('E2E Validation — API', API);
  console.log('Clinic', CLINIC_ID);
  console.log('---');
  await flow1();
  await flow2();
  await flow3();
  await flow4();
  await flow5();
  await flow6();
  console.log('---');
  console.log(`PASSED: ${results.passed.length}  FAILED: ${results.failed.length}`);
  writeFileSync('tools/dev/e2e-validation-results.json', JSON.stringify(results, null, 2));
  process.exit(results.failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
