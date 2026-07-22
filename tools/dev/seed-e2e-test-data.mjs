#!/usr/bin/env node
/**
 * Seeds a single E2E clinic with all roles for full flow validation.
 * Uses bcrypt (rounds=10, same as user-service registration) + SQL for reliability
 * when internal service auth blocks activation API in local stacks.
 *
 * Usage:
 *   node tools/dev/seed-e2e-test-data.mjs
 *   node tools/dev/seed-e2e-test-data.mjs --clean
 */

import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('../../Backend/NodeJS/microservices/user-service/node_modules/bcrypt');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = (process.env.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
const PASSWORD = process.env.E2E_PASSWORD || 'E2e@Test1';
const PG_USER = process.env.POSTGRES_USER || 'clinic_user';

const PHONES = {
  admin: '+963999009001',
  secretary: '+963999009002',
  doctor: '+963999009010',
  patient1: '+963999009101',
  patient2: '+963999009102',
  spareActivation: '+963999009099',
};

const IDS = {
  clinic: 'e2e00002-0002-4002-8002-000000000002',
  admin: 'e2e10001-0001-4001-8001-000000000001',
  secretary: 'e2e10003-0003-4003-8003-000000000003',
  doctor: 'e2e10002-0002-4002-8002-000000000002',
  patient1: 'e2e10004-0004-4004-8004-000000000004',
  patient2: 'e2e10005-0005-4005-8005-000000000005',
  activationUsed: 'e2e00001-0001-4001-8001-000000000001',
  activationSpare: 'e2e00099-0009-4009-8009-000000000099',
};

const ACTIVATION = { adminCode: '847291', spareCode: '593816' };

const CLINIC = {
  name: 'E2E Demo Clinic',
  city: 'Damascus',
  governorate: 'Damascus',
  address: 'Abou Rummaneh Demo Street 1',
};

function psqlExec(container, database, sql) {
  execSync(`docker exec ${container} psql -U ${PG_USER} -d ${database} -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'inherit',
    shell: true,
  });
}

function psqlQuery(container, database, sql) {
  return execSync(
    `docker exec ${container} psql -U ${PG_USER} -d ${database} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', shell: true },
  )
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function runCleanup() {
  const clinicIds = psqlQuery(
    'postgres_clinic',
    'clinic_db',
    `SELECT id FROM tenants WHERE admin_phone_number LIKE '+963999009%'`,
  );
  if (clinicIds.length) {
    const inList = clinicIds.map((id) => `'${id}'`).join(',');
    psqlExec(
      'postgres_appointment',
      'appointment_db',
      `DELETE FROM doctor_patient_assignments WHERE tenant_id IN (${inList}); DELETE FROM patient_clinic_relations WHERE tenant_id IN (${inList});`,
    );
  }
  const sql = readFileSync(path.join(__dirname, 'cleanup-e2e-seed.sql'), 'utf8');
  psqlExec('postgres_clinic', 'clinic_db', sql.split('-- postgres_system')[0].replace('-- postgres_clinic / clinic_db', '').trim());
  psqlExec('postgres_system', 'system_db', sql.split('-- postgres_system')[1].split('-- postgres_user')[0].replace('/ system_db', '').trim());
  psqlExec('postgres_user', 'user_db', sql.split('-- postgres_user')[1].replace('/ user_db', '').trim());
}

async function ensureSystemManager() {
  await fetch(`${API_BASE}/system-manager/dev/seed-default`, { method: 'POST' }).catch(() => {});
}

function seedSql(hash) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  psqlExec(
    'postgres_system',
    'system_db',
    `DELETE FROM clinic_admin_activation_codes WHERE "phoneNumber" LIKE '+963999009%'; INSERT INTO clinic_admin_activation_codes (id, code, "idNumber", "phoneNumber", "fullName", status, "expiresAt", "usedAt", "activatedAt", "clinicLocation", "clinicType", "registrationLicenseNumber", "whatsappNumber", price, "isCashPaymentDone", latitude, longitude, address, specialties, "serviceRadiusKm", "generatedBy", "attemptCount", "createdAt", "updatedAt") VALUES ('${IDS.activationUsed}', '${ACTIVATION.adminCode}', 'E2E-ADM-001', '${PHONES.admin}', 'Nour Hassan', 'used', '${expires}', NOW(), NOW(), '${CLINIC.name}', 'private_clinic', 'E2E-LIC-001', '${PHONES.admin}', 0, true, 33.5138, 36.2765, '${CLINIC.address}', 'general_practice', 10, 'e2e-seed', 0, NOW(), NOW()), ('${IDS.activationSpare}', '${ACTIVATION.spareCode}', 'E2E-ADM-SPARE', '${PHONES.spareActivation}', 'Spare E2E Admin', 'pending', '${expires}', NULL, NULL, 'Spare E2E Clinic', 'private_clinic', 'E2E-LIC-SPARE', '${PHONES.spareActivation}', 0, true, 33.5138, 36.2765, 'Damascus', 'general_practice', 10, 'e2e-seed', 0, NOW(), NOW()) ON CONFLICT (code) DO NOTHING;`,
  );

  psqlExec(
    'postgres_clinic',
    'clinic_db',
    `INSERT INTO tenants (id, name, slug, status, subscription_plan, description, address, city, governorate, phone, timezone, activation_code_id, admin_phone_number, admin_user_id, created_at, updated_at) VALUES ('${IDS.clinic}', '${CLINIC.name}', 'e2e-demo-clinic', 'ACTIVE', 'standard', 'E2E test clinic', '${CLINIC.address}', '${CLINIC.city}', '${CLINIC.governorate}', '${PHONES.admin}', 'Asia/Damascus', '${IDS.activationUsed}', '${PHONES.admin}', '${IDS.admin}', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET admin_user_id = EXCLUDED.admin_user_id, updated_at = NOW(); INSERT INTO tenant_staff_assignments (id, tenant_id, user_id, staff_role, status, assigned_by, assigned_at, updated_at) VALUES (gen_random_uuid(), '${IDS.clinic}', '${IDS.admin}', 'CLINIC_ADMIN', 'ACTIVE', '${IDS.admin}', NOW(), NOW()), (gen_random_uuid(), '${IDS.clinic}', '${IDS.secretary}', 'SECRETARY', 'ACTIVE', '${IDS.admin}', NOW(), NOW()), (gen_random_uuid(), '${IDS.clinic}', '${IDS.doctor}', 'DOCTOR', 'ACTIVE', '${IDS.admin}', NOW(), NOW()) ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE', updated_at = NOW();`,
  );

  psqlExec(
    'postgres_user',
    'user_db',
    `INSERT INTO users (id, "phoneNumber", "firstName", "lastName", email, password, role, status, "isPhoneVerified", "isEmailVerified", "isDashboardActivated", "mustChangePassword", tenant_id, permissions, specialization, "licenseNumber", "createdAt", "updatedAt") VALUES ('${IDS.admin}', '${PHONES.admin}', 'Nour', 'Hassan', 'e2e.admin@demo.medicare.local', '${hash}', 'CLINIC_ADMIN', 'ACTIVE', true, true, true, false, '${IDS.clinic}', '', NULL, NULL, NOW(), NOW()), ('${IDS.secretary}', '${PHONES.secretary}', 'Lina', 'Ahmad', 'e2e.secretary@demo.medicare.local', '${hash}', 'SECRETARY', 'ACTIVE', true, true, false, false, '${IDS.clinic}', '', NULL, NULL, NOW(), NOW()), ('${IDS.doctor}', '${PHONES.doctor}', 'Karim', 'Saleh', 'e2e.doctor@demo.medicare.local', '${hash}', 'DOCTOR', 'ACTIVE', true, true, false, false, '${IDS.clinic}', '', 'general_practice', 'E2E-DOC-001', NOW(), NOW()), ('${IDS.patient1}', '${PHONES.patient1}', 'Sara', 'Younes', 'e2e.patient1@demo.medicare.local', '${hash}', 'PATIENT', 'ACTIVE', true, true, false, false, NULL, '', NULL, NULL, NOW(), NOW()), ('${IDS.patient2}', '${PHONES.patient2}', 'Omar', 'Fares', 'e2e.patient2@demo.medicare.local', '${hash}', 'PATIENT', 'ACTIVE', true, true, false, false, NULL, '', NULL, NULL, NOW(), NOW()) ON CONFLICT ("phoneNumber") DO UPDATE SET password = EXCLUDED.password, status = 'ACTIVE', tenant_id = EXCLUDED.tenant_id, "isPhoneVerified" = true, "isDashboardActivated" = EXCLUDED."isDashboardActivated", "updatedAt" = NOW();`,
  );

  psqlExec(
    'postgres_appointment',
    'appointment_db',
    `INSERT INTO patient_clinic_relations (id, patient_id, tenant_id, first_seen_at, last_seen_at) VALUES (gen_random_uuid(), '${IDS.patient1}', '${IDS.clinic}', NOW(), NOW()), (gen_random_uuid(), '${IDS.patient2}', '${IDS.clinic}', NOW(), NOW()) ON CONFLICT (patient_id, tenant_id) DO UPDATE SET last_seen_at = NOW(); INSERT INTO doctor_patient_assignments (id, tenant_id, doctor_id, patient_id, assigned_by, status, assigned_at, created_at, updated_at) VALUES (gen_random_uuid(), '${IDS.clinic}', '${IDS.doctor}', '${IDS.patient1}', '${IDS.admin}', 'ACTIVE', NOW(), NOW(), NOW()), (gen_random_uuid(), '${IDS.clinic}', '${IDS.doctor}', '${IDS.patient2}', '${IDS.admin}', 'ACTIVE', NOW(), NOW(), NOW()) ON CONFLICT (tenant_id, doctor_id, patient_id) DO UPDATE SET status = 'ACTIVE', assigned_by = EXCLUDED.assigned_by, updated_at = NOW();`,
  );
}

function seedEmrSyncOutbox() {
  const patients = [
    {
      userId: IDS.patient1,
      phone: PHONES.patient1,
      firstName: 'Sara',
      lastName: 'Younes',
      email: 'e2e.patient1@demo.medicare.local',
    },
  ];

  for (const patient of patients) {
    const payload = JSON.stringify({
      userId: patient.userId,
      phoneNumber: patient.phone,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      role: 'PATIENT',
      tenantId: IDS.clinic,
      clinicId: IDS.clinic,
      createdAt: new Date().toISOString(),
    }).replace(/'/g, "''");

    psqlExec(
      'postgres_user',
      'user_db',
      `INSERT INTO outbox_events (id, "aggregateId", "aggregateType", "eventType", payload, status, "retryCount", "createdAt") SELECT gen_random_uuid(), '${patient.userId}', 'User', 'user.created', '${payload}'::jsonb, 'pending', 0, NOW() WHERE NOT EXISTS (SELECT 1 FROM outbox_events oe WHERE oe."aggregateId" = '${patient.userId}' AND oe."eventType" = 'user.created' AND oe.status IN ('pending', 'published'));`,
    );
  }
}

async function waitForEmrSync(userId, maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const rows = psqlQuery(
      'postgres_emr',
      'emr_db',
      `SELECT "syncStatus" FROM patient_emr_links WHERE "userId" = '${userId}' AND tenant_id = '${IDS.clinic}' LIMIT 1`,
    );
    if (rows[0] === 'SYNCED') return true;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

async function main() {
  if (process.argv.includes('--clean')) {
    console.log('Cleaning prior E2E seed data...');
    runCleanup();
  }

  console.log('Hashing password (bcrypt rounds=10)...');
  const hash = await bcrypt.hash(PASSWORD, 10);

  await ensureSystemManager();
  console.log('Seeding E2E data via SQL...');
  seedSql(hash);
  console.log('Queueing EMR sync for E2E patient...');
  seedEmrSyncOutbox();
  console.log('Waiting for OpenEMR patient sync...');
  const emrSynced = await waitForEmrSync(IDS.patient1);
  if (!emrSynced) {
    console.warn('Warning: patient1 EMR sync did not reach SYNCED within timeout — FLOW 5 may fail');
  } else {
    console.log('patient1 EMR link synced');
  }

  const output = {
    apiBase: API_BASE,
    password: PASSWORD,
    systemManager: {
      role: 'SYSTEM_MANAGER',
      username: process.env.SM_USERNAME || 'Baraa Al-Rifaee',
      password: process.env.SM_PASSWORD || 'baraaalrifaee732',
    },
    clinic: { id: IDS.clinic, name: CLINIC.name },
    users: {
      clinicAdmin: { role: 'CLINIC_ADMIN', phone: PHONES.admin, password: PASSWORD, userId: IDS.admin },
      doctor: { role: 'DOCTOR', phone: PHONES.doctor, password: PASSWORD, userId: IDS.doctor },
      secretary: { role: 'SECRETARY', phone: PHONES.secretary, password: PASSWORD, userId: IDS.secretary },
      patient1: { role: 'PATIENT', phone: PHONES.patient1, password: PASSWORD, userId: IDS.patient1 },
      patient2: { role: 'PATIENT', phone: PHONES.patient2, password: PASSWORD, userId: IDS.patient2 },
    },
    activation: {
      spareCode: ACTIVATION.spareCode,
      sparePhone: PHONES.spareActivation,
      spareStatus: 'pending',
      adminCodeUsed: ACTIVATION.adminCode,
    },
  };

  const outPath = path.join(__dirname, 'e2e-seed-output.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('\n✓ E2E seed complete\n');
  console.log('Credentials (role / phone / password):');
  console.log(`  SYSTEM_MANAGER / ${output.systemManager.username} / ${output.systemManager.password}`);
  console.log(`  CLINIC_ADMIN   / ${PHONES.admin} / ${PASSWORD}`);
  console.log(`  DOCTOR         / ${PHONES.doctor} / ${PASSWORD}`);
  console.log(`  SECRETARY      / ${PHONES.secretary} / ${PASSWORD}`);
  console.log(`  PATIENT_1      / ${PHONES.patient1} / ${PASSWORD}`);
  console.log(`  PATIENT_2      / ${PHONES.patient2} / ${PASSWORD}`);
  console.log(`\nClinic ID: ${IDS.clinic}`);
  console.log(`Spare activation: code ${ACTIVATION.spareCode} for ${PHONES.spareActivation}`);
  console.log(`Output: ${outPath}`);
}

main().catch((err) => {
  console.error('\nE2E seed failed:', err.message);
  process.exit(1);
});
