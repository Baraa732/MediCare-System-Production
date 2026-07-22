#!/usr/bin/env node
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const bcrypt = require('../../Backend/NodeJS/microservices/user-service/node_modules/bcrypt');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(path.join(__dirname, 'phase1-seed-output.json'), 'utf8'));
const API = 'http://127.0.0.1:3000/api';
const { password, phones, ids, clinics } = seed;

async function login(phone) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, password, deviceId: 'phase1-validation' }),
  });
  const j = await r.json();
  if (j.requiresMfa && j.devOtp) {
    const m = await fetch(`${API}/auth/verify-mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: j.mfaToken, otp: j.devOtp, deviceId: 'phase1-validation' }),
    });
    return (await m.json()).accessToken;
  }
  return j.accessToken;
}

async function staffAccess(token, clinicId) {
  const r = await fetch(`${API}/clinics/${clinicId}/staff`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': clinicId },
  });
  return r.status === 200;
}

function memberships(userId) {
  return execSync(
    `docker exec postgres_clinic psql -U clinic_user -d clinic_db -t -A -c "SELECT tenant_id::text, status, staff_role FROM tenant_staff_assignments WHERE user_id='${userId}' ORDER BY tenant_id"`,
    { encoding: 'utf8' },
  ).trim();
}

async function assign(adminToken, clinicId, userId) {
  const r = await fetch(`${API}/clinics/${clinicId}/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': clinicId,
    },
    body: JSON.stringify({ userId, staffRole: 'SECRETARY' }),
  });
  return { status: r.status, body: await r.text() };
}

async function main() {
  const hash = await bcrypt.hash(password, 10);
  execSync(`docker exec postgres_user psql -U clinic_user -d user_db -c "DELETE FROM users WHERE id='${ids.secretary}';"`, { shell: true });
  execSync(`docker exec postgres_clinic psql -U clinic_user -d clinic_db -c "DELETE FROM tenant_staff_assignments WHERE user_id='${ids.secretary}';"`, { shell: true });
  execSync(
    `docker exec postgres_user psql -U clinic_user -d user_db -c "INSERT INTO users (id,\\"phoneNumber\\",\\"firstName\\",\\"lastName\\",email,password,role,status,\\"isPhoneVerified\\",\\"isEmailVerified\\",\\"isDashboardActivated\\",\\"mustChangePassword\\",tenant_id,permissions,\\"createdAt\\",\\"updatedAt\\") VALUES ('${ids.secretary}','${phones.secretary}','Secretary','Sam','p1.secretary@test.local','${hash}','SECRETARY','ACTIVE',true,true,false,false,'${clinics.A}','',NOW(),NOW());"`,
    { shell: true },
  );

  const adminA = await login(phones.adminA);
  const adminB = await login(phones.adminB);
  const adminC = await login(phones.adminC);

  console.log('assign A', await assign(adminA, clinics.A, ids.secretary));
  console.log('assign B', await assign(adminB, clinics.B, ids.secretary));
  console.log('memberships', memberships(ids.secretary));

  const sec = await login(phones.secretary);
  console.log('sec login', !!sec);
  console.log('access A', await staffAccess(sec, clinics.A));
  console.log('access B', await staffAccess(sec, clinics.B));
  console.log('access C', await staffAccess(sec, clinics.C));

  const rem = await fetch(`${API}/clinics/${clinics.B}/staff/${ids.secretary}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminB}`, 'X-Tenant-ID': clinics.B },
  });
  console.log('remove B', rem.status);
  console.log('memberships after remove', memberships(ids.secretary));
  console.log('access B after', await staffAccess(sec, clinics.B));
  console.log('access A after', await staffAccess(sec, clinics.A));

  console.log('assign C', await assign(adminC, clinics.C, ids.secretary));
  console.log('final memberships', memberships(ids.secretary));
}

main();
