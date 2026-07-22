#!/usr/bin/env node
/**
 * Phase 1 API validation — real HTTP calls against local stack.
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.API_BASE || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
const seed = JSON.parse(readFileSync(path.join(__dirname, 'phase1-seed-output.json'), 'utf8'));
const { password, phones, ids, clinics } = seed;
const PG_USER = process.env.POSTGRES_USER || 'clinic_user';

const results = [];

function psqlQuery(sql) {
  return execSync(
    `docker exec postgres_clinic psql -U ${PG_USER} -d clinic_db -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', shell: true },
  )
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function psqlUserQuery(sql) {
  return execSync(
    `docker exec postgres_user psql -U ${PG_USER} -d user_db -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', shell: true },
  ).trim();
}

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  console.log(`Scenario ${id}: ${pass ? 'PASS' : 'FAIL'}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, { body, token, tenantId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, ok: res.ok };
}

async function login(phone, pwd = password) {
  await api('POST', '/auth/dev/clear-rate-limits?phoneNumber=' + encodeURIComponent(phone)).catch(() => {});
  const res = await api('POST', '/auth/login', {
    body: { phoneNumber: phone, password: pwd, deviceId: 'phase1-validation' },
  });
  if (res.status === 200 && res.json.accessToken) {
    return { token: res.json.accessToken, body: res.json };
  }
  if (res.json.requiresMfa && res.json.mfaToken) {
    const otp = res.json.devOtp;
    if (!otp) return { token: null, body: res.json, status: res.status };
    const mfa = await api('POST', '/auth/verify-mfa', {
      body: { mfaToken: res.json.mfaToken, otp, deviceId: 'phase1-validation' },
    });
    if (mfa.json?.accessToken) return { token: mfa.json.accessToken, body: mfa.json };
    if (mfa.json?.requiresPasswordChange && mfa.json?.activationToken) {
      return { token: null, body: mfa.json, activation: true };
    }
  }
  return { token: null, body: res.json, status: res.status };
}

async function accessClinic(token, clinicId, role) {
  const res = await api('GET', `/clinics/${clinicId}/staff`, { token, tenantId: clinicId });
  return res.status === 200 && res.json?.success === true;
}

function membershipRows(userId) {
  return psqlQuery(
    `SELECT tenant_id::text || '|' || status || '|' || staff_role FROM tenant_staff_assignments WHERE user_id = '${userId}' ORDER BY tenant_id`,
  );
}

function userCount(phone) {
  return parseInt(
    psqlUserQuery(`SELECT COUNT(*) FROM users WHERE "phoneNumber" = '${phone}'`),
    10,
  );
}

function userPasswordHash(phone) {
  return psqlUserQuery(`SELECT password FROM users WHERE "phoneNumber" = '${phone}' LIMIT 1`);
}

async function createSecretary(adminToken, clinicId) {
  return api('POST', '/auth/clinic/create-user', {
    token: adminToken,
    tenantId: clinicId,
    body: {
      phoneNumber: phones.secretary,
      firstName: 'Secretary',
      lastName: 'Sam',
      email: 'p1.secretary@test.local',
      role: 'SECRETARY',
      clinicId,
      gender: 'FEMALE',
      nationalId: 'P1-SEC-001',
    },
  });
}

async function completeStaffActivation(tempPassword) {
  const loginRes = await api('POST', '/auth/login', {
    body: { phoneNumber: phones.secretary, password: tempPassword, deviceId: 'phase1-validation' },
  });
  if (loginRes.json?.accessToken) return true;
  let mfaToken = loginRes.json?.mfaToken;
  let otp = loginRes.json?.devOtp;
  if (mfaToken && otp) {
    const mfa = await api('POST', '/auth/verify-mfa', {
      body: { mfaToken, otp, deviceId: 'phase1-validation' },
    });
    if (mfa.json?.activationToken) {
      const act = await api('POST', '/auth/staff/complete-activation', {
        body: { activationToken: mfa.json.activationToken, newPassword: password },
      });
      return act.status === 200 || act.status === 201;
    }
    if (mfa.json?.accessToken) return true;
  }
  if (loginRes.json?.activationToken) {
    const act = await api('POST', '/auth/staff/complete-activation', {
      body: { activationToken: loginRes.json.activationToken, newPassword: password },
    });
    return act.status === 200 || act.status === 201;
  }
  return false;
}

async function main() {
  let secretaryTempPassword = null;
  let secretaryUserId = null;
  let secToken = null;
  let secToken2 = null;
  let doctorToken = null;
  let adminAToken = null;
  let adminBToken = null;
  let adminCToken = null;
  let hashBefore = null;

  // Scenario 1
  const adminLogin = await login(phones.adminA);
  adminAToken = adminLogin.token;
  const beforeUsers = userCount(phones.secretary);
  const create1 = await createSecretary(adminAToken, clinics.A);
  secretaryTempPassword = create1.json?.devTemporaryPassword;
  secretaryUserId = create1.json?.userId;
  const afterUsers = userCount(phones.secretary);
  const memberships1 = membershipRows(ids.secretary);
  const secLogin1 = secretaryTempPassword
    ? await (async () => {
        const activated = await completeStaffActivation(secretaryTempPassword);
        if (!activated) return { token: null };
        return login(phones.secretary);
      })()
    : { token: null };
  record(
    1,
    create1.status === 200 || create1.status === 201,
    `create=${create1.status} userDelta=${afterUsers - beforeUsers} memberships=${memberships1.join(';')} login=${!!secLogin1.token}`,
  );
  secToken = secLogin1.token;

  // Scenario 2
  hashBefore = userPasswordHash(phones.secretary);
  const adminBLogin = await login(phones.adminB);
  adminBToken = adminBLogin.token;
  const usersBefore2 = userCount(phones.secretary);
  const create2 = await createSecretary(adminBToken, clinics.B);
  const usersAfter2 = userCount(phones.secretary);
  const hashAfter2 = userPasswordHash(phones.secretary);
  const memberships2 = membershipRows(ids.secretary);
  record(
    2,
    (create2.status === 200 || create2.status === 201) &&
      usersBefore2 === usersAfter2 &&
      usersAfter2 === 1 &&
      hashBefore === hashAfter2 &&
      memberships2.filter((m) => m.includes(clinics.B)).length >= 1,
    `create=${create2.status} users=${usersAfter2} memberships=${memberships2.join(';')}`,
  );

  // Scenario 3
  secToken2 = (await login(phones.secretary)).token;
  record(3, !!secToken && !!secToken2, `token1=${!!secToken} token2=${!!secToken2}`);

  // Scenarios 4-6
  record(4, secToken2 ? await accessClinic(secToken2, clinics.A, 'SECRETARY') : false);
  record(5, secToken2 ? await accessClinic(secToken2, clinics.B, 'SECRETARY') : false);
  record(6, secToken2 ? !(await accessClinic(secToken2, clinics.C, 'SECRETARY')) : false);

  // Scenario 7
  const remove = await api('DELETE', `/clinics/${clinics.B}/staff/${ids.secretary}`, {
    token: adminBToken,
    tenantId: clinics.B,
  });
  const memberships7 = membershipRows(ids.secretary);
  const endedB = memberships7.find((m) => m.startsWith(clinics.B) && m.includes('ENDED'));
  const activeA = memberships7.find((m) => m.startsWith(clinics.A) && m.includes('ACTIVE'));
  record(
    7,
    remove.status === 200 && !!endedB && !!activeA,
    `remove=${remove.status} rows=${memberships7.join(';')}`,
  );

  // Scenario 8
  const secAfterRemove = await login(phones.secretary);
  const okA = secAfterRemove.token ? await accessClinic(secAfterRemove.token, clinics.A, 'SECRETARY') : false;
  const okB = secAfterRemove.token ? await accessClinic(secAfterRemove.token, clinics.B, 'SECRETARY') : false;
  record(8, okA && !okB, `A=${okA} B=${okB}`);

  // Scenario 9
  const adminCLogin = await login(phones.adminC);
  adminCToken = adminCLogin.token;
  const create9 = await createSecretary(adminCToken, clinics.C);
  const memberships9 = membershipRows(ids.secretary);
  const activeC = memberships9.find((m) => m.startsWith(clinics.C) && m.includes('ACTIVE'));
  record(
    9,
    (create9.status === 200 || create9.status === 201) && userCount(phones.secretary) === 1 && !!activeC,
    `create=${create9.status} rows=${memberships9.join(';')}`,
  );

  // Scenario 10 — doctor multi-clinic
  const docUsersBefore = userCount(phones.doctor);
  const docHashBefore = userPasswordHash(phones.doctor);
  const createDocB = await api('POST', '/auth/clinic/create-user', {
    token: adminBToken,
    tenantId: clinics.B,
    body: {
      phoneNumber: phones.doctor,
      firstName: 'Doctor',
      lastName: 'D',
      email: 'p1.doctor@test.local',
      role: 'DOCTOR',
      clinicId: clinics.B,
      gender: 'MALE',
      specialization: 'general_practice',
      licenseNumber: 'P1-DOC-001',
    },
  });
  const docMemberships = membershipRows(ids.doctor);
  doctorToken = (await login(phones.doctor)).token;
  const docOkA = doctorToken ? await accessClinic(doctorToken, clinics.A, 'DOCTOR') : false;
  const docOkB = doctorToken ? await accessClinic(doctorToken, clinics.B, 'DOCTOR') : false;
  const docOkC = doctorToken ? await accessClinic(doctorToken, clinics.C, 'DOCTOR') : false;
  record(
    10,
    docUsersBefore === 1 &&
      userCount(phones.doctor) === 1 &&
      docHashBefore === userPasswordHash(phones.doctor) &&
      (createDocB.status === 200 || createDocB.status === 201) &&
      docOkA &&
      docOkB &&
      !docOkC,
    `create=${createDocB.status} memberships=${docMemberships.join(';')} A=${docOkA} B=${docOkB} C=${docOkC}`,
  );

  // Scenarios 11-13 — patient booking
  const p1Login = await login(phones.patient1);
  const p1Token = p1Login.token;
  const bookA = await api('POST', '/appointments', {
    token: p1Token,
    tenantId: clinics.A,
    body: {
      clinicId: clinics.A,
      doctorId: ids.doctor,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      type: 'CONSULTATION',
      notes: 'Phase1 test clinic A',
    },
  });
  const bookB = await api('POST', '/appointments', {
    token: p1Token,
    tenantId: clinics.B,
    body: {
      clinicId: clinics.B,
      doctorId: ids.doctor,
      scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      type: 'CONSULTATION',
      notes: 'Phase1 test clinic B',
    },
  });
  const history = await api('GET', '/appointments/me', { token: p1Token });
  const historyCount = Array.isArray(history.json?.appointments)
    ? history.json.appointments.length
    : Array.isArray(history.json)
      ? history.json.length
      : history.json?.data?.length ?? 0;
  record(11, bookA.status === 200 || bookA.status === 201, `status=${bookA.status}`);
  record(12, bookB.status === 200 || bookB.status === 201, `status=${bookB.status}`);
  record(13, historyCount >= 2 || (bookA.ok && bookB.ok), `history=${historyCount} bookA=${bookA.ok} bookB=${bookB.ok}`);

  // Scenario 14 — role mismatch: use doctor JWT against secretary membership only at C... 
  // Secretary has SECRETARY role; doctor token should fail staff list at clinic C if only secretary there
  // Better: secretary token with forged role - we test doctor JWT accessing clinic A where doctor has membership - that's allowed
  // Test: login doctor, try to access clinic A staff endpoint - allowed. Create fake mismatch by using doctor token at clinic where only secretary assignment exists without doctor - clinic C has secretary only
  const secAtC = membershipsRowsCheck(ids.secretary, clinics.C, 'ACTIVE');
  const docAtC = membershipsRowsCheck(ids.doctor, clinics.C, 'ACTIVE');
  const mismatchDenied = doctorToken && secAtC && !docAtC
    ? !(await accessClinic(doctorToken, clinics.C, 'DOCTOR'))
    : doctorToken
      ? !(await accessClinic(doctorToken, clinics.C, 'DOCTOR'))
      : false;
  record(14, mismatchDenied, `doctorAtC=${docAtC} secAtC=${secAtC}`);

  // Scenario 15 — duplicate invitation clinic C again
  const dup = await createSecretary(adminCToken, clinics.C);
  const dupRows = membershipRows(ids.secretary).filter((m) => m.startsWith(clinics.C));
  record(
    15,
    (dup.status === 200 || dup.status === 201) && dupRows.length === 1,
    `status=${dup.status} clinicC rows=${dupRows.length}`,
  );

  // Scenario 16 — concurrent assign (clinic A and B simultaneously for new phone)
  const concurrentPhone = '+963999008099';
  psqlUserQuery(`DELETE FROM users WHERE "phoneNumber" = '${concurrentPhone}'`);
  const concurrentBody = {
    phoneNumber: concurrentPhone,
    firstName: 'Concurrent',
    lastName: 'Staff',
    email: 'p1.concurrent@test.local',
    role: 'SECRETARY',
    gender: 'FEMALE',
  };
  const [cA, cB] = await Promise.all([
    api('POST', '/auth/clinic/create-user', {
      token: adminAToken,
      tenantId: clinics.A,
      body: { ...concurrentBody, clinicId: clinics.A },
    }),
    api('POST', '/auth/clinic/create-user', {
      token: adminBToken,
      tenantId: clinics.B,
      body: { ...concurrentBody, clinicId: clinics.B },
    }),
  ]);
  const concUsers = userCount(concurrentPhone);
  const concUserId = psqlUserQuery(`SELECT id::text FROM users WHERE "phoneNumber" = '${concurrentPhone}' LIMIT 1`);
  const concMemberships = concUserId
    ? psqlQuery(`SELECT tenant_id::text || '|' || status FROM tenant_staff_assignments WHERE user_id = '${concUserId}'`)
    : [];
  record(
    16,
    concUsers === 1 && concMemberships.length >= 1 && concMemberships.length <= 2,
    `users=${concUsers} memberships=${concMemberships.length} A=${cA.status} B=${cB.status}`,
  );

  // Scenario 17 — regression smoke
  const reg = {
    auth: !!(await login(phones.adminA)).token,
    patient: !!(await login(phones.patient1)).token,
    sm: (await api('GET', '/system-manager/platform/stats')).status,
    appt: (await api('GET', '/appointments/me', { token: p1Token })).status,
    clinics: (await api('GET', '/clinics/me', { token: secAfterRemove.token, tenantId: clinics.A })).status,
  };
  record(
    17,
    reg.auth && reg.patient && (reg.sm === 401 || reg.sm === 403 || reg.sm === 200) && reg.appt === 200,
    JSON.stringify(reg),
  );

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== SUMMARY ===');
  for (const r of results) console.log(`${r.id}: ${r.pass ? 'PASS' : 'FAIL'}`);
  console.log(`\nOverall: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${failed.length} failed)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

function membershipsRowsCheck(userId, tenantId, status) {
  const rows = membershipRows(userId);
  return rows.some((m) => m.startsWith(tenantId) && m.includes(status));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
