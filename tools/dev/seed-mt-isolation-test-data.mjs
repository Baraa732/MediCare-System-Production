#!/usr/bin/env node
/**
 * Seeds two isolated clinics (A + B) for multi-tenancy isolation auditing.
 *
 * Usage:
 *   node tools/dev/seed-mt-isolation-test-data.mjs
 *   node tools/dev/seed-mt-isolation-test-data.mjs --clean
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
const PASSWORD = process.env.MT_PASSWORD || 'Mt@Test1';
const PG_USER = process.env.POSTGRES_USER || 'clinic_user';

const PHONE_PREFIX = '+963999008';

const CLINIC_A = {
  id: 'aa200002-0002-4002-8002-000000000002',
  name: 'MT Isolation Clinic A',
  slug: 'mt-isolation-clinic-a',
  city: 'Damascus',
  governorate: 'Damascus',
  address: 'MT Audit Street A, Building 1',
  activationId: 'aa200001-0001-4001-8001-000000000001',
  activationCode: '881001',
  admin: {
    id: 'aa210001-0001-4001-8001-000000000001',
    phone: `${PHONE_PREFIX}001`,
    firstName: 'Admin',
    lastName: 'ClinicA',
    email: 'mt.admin.a@demo.medicare.local',
  },
  doctor: {
    id: 'aa210010-0010-4010-8010-000000000010',
    phone: `${PHONE_PREFIX}010`,
    firstName: 'Doctor',
    lastName: 'ClinicA',
    email: 'mt.doctor.a@demo.medicare.local',
    licenseNumber: 'MT-DOC-A-001',
  },
  secretary: {
    id: 'aa210003-0003-4003-8003-000000000003',
    phone: `${PHONE_PREFIX}002`,
    firstName: 'Secretary',
    lastName: 'ClinicA',
    email: 'mt.secretary.a@demo.medicare.local',
  },
  patient1: {
    id: 'aa210101-0101-4101-8101-000000000101',
    phone: `${PHONE_PREFIX}101`,
    firstName: 'Patient',
    lastName: 'A1',
    email: 'mt.patient.a1@demo.medicare.local',
  },
  appointmentId: 'aa300001-0001-4001-8001-000000000001',
};

const CLINIC_B = {
  id: 'bb200002-0002-4002-8002-000000000002',
  name: 'MT Isolation Clinic B',
  slug: 'mt-isolation-clinic-b',
  city: 'Aleppo',
  governorate: 'Aleppo',
  address: 'MT Audit Street B, Building 2',
  activationId: 'bb200001-0001-4001-8001-000000000001',
  activationCode: '881002',
  admin: {
    id: 'bb210001-0001-4001-8001-000000000001',
    phone: `${PHONE_PREFIX}011`,
    firstName: 'Admin',
    lastName: 'ClinicB',
    email: 'mt.admin.b@demo.medicare.local',
  },
  doctor: {
    id: 'bb210010-0010-4010-8010-000000000010',
    phone: `${PHONE_PREFIX}020`,
    firstName: 'Doctor',
    lastName: 'ClinicB',
    email: 'mt.doctor.b@demo.medicare.local',
    licenseNumber: 'MT-DOC-B-001',
  },
  secretary: {
    id: 'bb210003-0003-4003-8003-000000000003',
    phone: `${PHONE_PREFIX}012`,
    firstName: 'Secretary',
    lastName: 'ClinicB',
    email: 'mt.secretary.b@demo.medicare.local',
  },
  patient1: {
    id: 'bb210111-0111-4111-8111-000000000111',
    phone: `${PHONE_PREFIX}111`,
    firstName: 'Patient',
    lastName: 'B1',
    email: 'mt.patient.b1@demo.medicare.local',
  },
  appointmentId: 'bb300001-0001-4001-8001-000000000001',
};

const SHARED_PATIENT = {
  id: 'cc210200-0200-4200-8200-000000000200',
  phone: `${PHONE_PREFIX}200`,
  firstName: 'Shared',
  lastName: 'MultiClinic',
  email: 'mt.patient.shared@demo.medicare.local',
};

const stats = {
  system_db: {},
  clinic_db: {},
  user_db: {},
  appointment_db: {},
  scheduling_db: {},
  emr_db: {},
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

function recordStat(db, table, count) {
  stats[db][table] = (stats[db][table] || 0) + count;
}

function runCleanup() {
  const clinicIds = psqlQuery(
    'postgres_clinic',
    'clinic_db',
    `SELECT id FROM tenants WHERE admin_phone_number LIKE '${PHONE_PREFIX}%'`,
  );
  if (clinicIds.length) {
    const inList = clinicIds.map((id) => `'${id}'`).join(',');
    psqlExec(
      'postgres_appointment',
      'appointment_db',
      `DELETE FROM appointments WHERE tenant_id IN (${inList}); DELETE FROM doctor_patient_assignments WHERE tenant_id IN (${inList}); DELETE FROM patient_clinic_relations WHERE tenant_id IN (${inList});`,
    );
    psqlExec(
      'postgres_scheduling',
      'scheduling_db',
      `DELETE FROM doctor_availability WHERE tenant_id IN (${inList}); DELETE FROM clinic_hours WHERE tenant_id IN (${inList}); DELETE FROM schedule_blocks WHERE tenant_id IN (${inList});`,
    );
    psqlExec(
      'postgres_emr',
      'emr_db',
      `DELETE FROM patient_emr_links WHERE tenant_id IN (${inList});`,
    );
  }

  const userIds = psqlQuery(
    'postgres_user',
    'user_db',
    `SELECT id FROM users WHERE "phoneNumber" LIKE '${PHONE_PREFIX}%'`,
  );
  if (userIds.length) {
    const inUsers = userIds.map((id) => `'${id}'`).join(',');
    psqlExec(
      'postgres_emr',
      'emr_db',
      `DELETE FROM patient_emr_links WHERE "userId" IN (${inUsers});`,
    );
  }

  const sql = readFileSync(path.join(__dirname, 'cleanup-mt-isolation-seed.sql'), 'utf8');
  psqlExec('postgres_clinic', 'clinic_db', sql.split('-- postgres_system')[0].replace('-- postgres_clinic / clinic_db', '').trim());
  psqlExec('postgres_system', 'system_db', sql.split('-- postgres_system')[1].split('-- postgres_user')[0].replace('/ system_db', '').trim());
  psqlExec('postgres_user', 'user_db', sql.split('-- postgres_user')[1].split('-- postgres_appointment')[0].replace('/ user_db', '').trim());
}

async function ensureSystemManager() {
  await fetch(`${API_BASE}/system-manager/dev/seed-default`, { method: 'POST' }).catch(() => {});
}

function futureAppointmentIso(dayOffset, hourUtc) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

function seedActivations(expires) {
  const rows = [
    [CLINIC_A.activationId, CLINIC_A.activationCode, 'MT-ADM-A-001', CLINIC_A.admin.phone, 'Admin ClinicA', CLINIC_A.name, CLINIC_A.address],
    [CLINIC_B.activationId, CLINIC_B.activationCode, 'MT-ADM-B-001', CLINIC_B.admin.phone, 'Admin ClinicB', CLINIC_B.name, CLINIC_B.address],
  ];
  const values = rows
    .map(
      ([id, code, idNumber, phone, fullName, clinicLocation, address]) =>
        `('${id}', '${code}', '${idNumber}', '${phone}', '${fullName}', 'used', '${expires}', NOW(), NOW(), '${clinicLocation}', 'private_clinic', '${idNumber}', '${phone}', 0, true, 33.5138, 36.2765, '${address}', 'general_practice', 10, 'mt-isolation-seed', 0, NOW(), NOW())`,
    )
    .join(', ');
  psqlExec(
    'postgres_system',
    'system_db',
    `DELETE FROM clinic_admin_activation_codes WHERE "phoneNumber" LIKE '${PHONE_PREFIX}%'; INSERT INTO clinic_admin_activation_codes (id, code, "idNumber", "phoneNumber", "fullName", status, "expiresAt", "usedAt", "activatedAt", "clinicLocation", "clinicType", "registrationLicenseNumber", "whatsappNumber", price, "isCashPaymentDone", latitude, longitude, address, specialties, "serviceRadiusKm", "generatedBy", "attemptCount", "createdAt", "updatedAt") VALUES ${values} ON CONFLICT (code) DO NOTHING;`,
  );
  recordStat('system_db', 'clinic_admin_activation_codes', rows.length);
}

function seedClinics() {
  const clinics = [CLINIC_A, CLINIC_B];
  for (const clinic of clinics) {
    psqlExec(
      'postgres_clinic',
      'clinic_db',
      `INSERT INTO tenants (id, name, slug, status, subscription_plan, description, address, city, governorate, phone, timezone, activation_code_id, admin_phone_number, admin_user_id, created_at, updated_at) VALUES ('${clinic.id}', '${clinic.name}', '${clinic.slug}', 'ACTIVE', 'standard', 'MT isolation audit clinic', '${clinic.address}', '${clinic.city}', '${clinic.governorate}', '${clinic.admin.phone}', 'Asia/Damascus', '${clinic.activationId}', '${clinic.admin.phone}', '${clinic.admin.id}', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET admin_user_id = EXCLUDED.admin_user_id, updated_at = NOW();`,
    );
    recordStat('clinic_db', 'tenants', 1);

    psqlExec(
      'postgres_clinic',
      'clinic_db',
      `INSERT INTO tenant_staff_assignments (id, tenant_id, user_id, staff_role, status, assigned_by, assigned_at, updated_at) VALUES (gen_random_uuid(), '${clinic.id}', '${clinic.admin.id}', 'CLINIC_ADMIN', 'ACTIVE', '${clinic.admin.id}', NOW(), NOW()), (gen_random_uuid(), '${clinic.id}', '${clinic.secretary.id}', 'SECRETARY', 'ACTIVE', '${clinic.admin.id}', NOW(), NOW()), (gen_random_uuid(), '${clinic.id}', '${clinic.doctor.id}', 'DOCTOR', 'ACTIVE', '${clinic.admin.id}', NOW(), NOW()) ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE', updated_at = NOW();`,
    );
    recordStat('clinic_db', 'tenant_staff_assignments', 3);
  }
}

function seedUsers(hash) {
  const staffRows = [CLINIC_A, CLINIC_B].flatMap((clinic) => [
    `('${clinic.admin.id}', '${clinic.admin.phone}', '${clinic.admin.firstName}', '${clinic.admin.lastName}', '${clinic.admin.email}', '${hash}', 'CLINIC_ADMIN', 'ACTIVE', true, true, true, false, '${clinic.id}', '', NULL, NULL, NOW(), NOW())`,
    `('${clinic.secretary.id}', '${clinic.secretary.phone}', '${clinic.secretary.firstName}', '${clinic.secretary.lastName}', '${clinic.secretary.email}', '${hash}', 'SECRETARY', 'ACTIVE', true, true, false, false, '${clinic.id}', '', NULL, NULL, NOW(), NOW())`,
    `('${clinic.doctor.id}', '${clinic.doctor.phone}', '${clinic.doctor.firstName}', '${clinic.doctor.lastName}', '${clinic.doctor.email}', '${hash}', 'DOCTOR', 'ACTIVE', true, true, false, false, '${clinic.id}', '', 'general_practice', '${clinic.doctor.licenseNumber}', NOW(), NOW())`,
  ]);

  const patientRows = [
    `('${CLINIC_A.patient1.id}', '${CLINIC_A.patient1.phone}', '${CLINIC_A.patient1.firstName}', '${CLINIC_A.patient1.lastName}', '${CLINIC_A.patient1.email}', '${hash}', 'PATIENT', 'ACTIVE', true, true, false, false, NULL, '', NULL, NULL, NOW(), NOW())`,
    `('${CLINIC_B.patient1.id}', '${CLINIC_B.patient1.phone}', '${CLINIC_B.patient1.firstName}', '${CLINIC_B.patient1.lastName}', '${CLINIC_B.patient1.email}', '${hash}', 'PATIENT', 'ACTIVE', true, true, false, false, NULL, '', NULL, NULL, NOW(), NOW())`,
    `('${SHARED_PATIENT.id}', '${SHARED_PATIENT.phone}', '${SHARED_PATIENT.firstName}', '${SHARED_PATIENT.lastName}', '${SHARED_PATIENT.email}', '${hash}', 'PATIENT', 'ACTIVE', true, true, false, false, NULL, '', NULL, NULL, NOW(), NOW())`,
  ];

  psqlExec(
    'postgres_user',
    'user_db',
    `INSERT INTO users (id, "phoneNumber", "firstName", "lastName", email, password, role, status, "isPhoneVerified", "isEmailVerified", "isDashboardActivated", "mustChangePassword", tenant_id, permissions, specialization, "licenseNumber", "createdAt", "updatedAt") VALUES ${[...staffRows, ...patientRows].join(', ')} ON CONFLICT ("phoneNumber") DO UPDATE SET password = EXCLUDED.password, status = 'ACTIVE', tenant_id = EXCLUDED.tenant_id, "isPhoneVerified" = true, "isDashboardActivated" = EXCLUDED."isDashboardActivated", "updatedAt" = NOW();`,
  );
  recordStat('user_db', 'users', staffRows.length + patientRows.length);
}

function seedAppointmentData() {
  const apptA = futureAppointmentIso(5, 10);
  const apptB = futureAppointmentIso(5, 14);

  psqlExec(
    'postgres_appointment',
    'appointment_db',
    `INSERT INTO patient_clinic_relations (id, patient_id, tenant_id, first_seen_at, last_seen_at) VALUES (gen_random_uuid(), '${CLINIC_A.patient1.id}', '${CLINIC_A.id}', NOW(), NOW()), (gen_random_uuid(), '${SHARED_PATIENT.id}', '${CLINIC_A.id}', NOW(), NOW()), (gen_random_uuid(), '${CLINIC_B.patient1.id}', '${CLINIC_B.id}', NOW(), NOW()), (gen_random_uuid(), '${SHARED_PATIENT.id}', '${CLINIC_B.id}', NOW(), NOW()) ON CONFLICT (patient_id, tenant_id) DO UPDATE SET last_seen_at = NOW();`,
  );
  recordStat('appointment_db', 'patient_clinic_relations', 4);

  psqlExec(
    'postgres_appointment',
    'appointment_db',
    `INSERT INTO doctor_patient_assignments (id, tenant_id, doctor_id, patient_id, assigned_by, status, assigned_at, created_at, updated_at) VALUES (gen_random_uuid(), '${CLINIC_A.id}', '${CLINIC_A.doctor.id}', '${CLINIC_A.patient1.id}', '${CLINIC_A.admin.id}', 'ACTIVE', NOW(), NOW(), NOW()), (gen_random_uuid(), '${CLINIC_A.id}', '${CLINIC_A.doctor.id}', '${SHARED_PATIENT.id}', '${CLINIC_A.admin.id}', 'ACTIVE', NOW(), NOW(), NOW()), (gen_random_uuid(), '${CLINIC_B.id}', '${CLINIC_B.doctor.id}', '${CLINIC_B.patient1.id}', '${CLINIC_B.admin.id}', 'ACTIVE', NOW(), NOW(), NOW()), (gen_random_uuid(), '${CLINIC_B.id}', '${CLINIC_B.doctor.id}', '${SHARED_PATIENT.id}', '${CLINIC_B.admin.id}', 'ACTIVE', NOW(), NOW(), NOW()) ON CONFLICT (tenant_id, doctor_id, patient_id) DO UPDATE SET status = 'ACTIVE', assigned_by = EXCLUDED.assigned_by, updated_at = NOW();`,
  );
  recordStat('appointment_db', 'doctor_patient_assignments', 4);

  psqlExec(
    'postgres_appointment',
    'appointment_db',
    `INSERT INTO appointments (id, tenant_id, "doctorId", "patientId", "scheduledAt", "durationMinutes", status, reason, "createdBy", "createdAt", "updatedAt") VALUES ('${CLINIC_A.appointmentId}', '${CLINIC_A.id}', '${CLINIC_A.doctor.id}', '${CLINIC_A.patient1.id}', '${apptA}', 30, 'CONFIRMED', 'MT isolation seed appointment A', '${CLINIC_A.patient1.id}', NOW(), NOW()), ('${CLINIC_B.appointmentId}', '${CLINIC_B.id}', '${CLINIC_B.doctor.id}', '${CLINIC_B.patient1.id}', '${apptB}', 30, 'CONFIRMED', 'MT isolation seed appointment B', '${CLINIC_B.patient1.id}', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET "scheduledAt" = EXCLUDED."scheduledAt", status = 'CONFIRMED', "updatedAt" = NOW();`,
  );
  recordStat('appointment_db', 'appointments', 2);
}

function seedScheduling() {
  for (const clinic of [CLINIC_A, CLINIC_B]) {
    const hourRows = Array.from({ length: 7 }, (_, dayOfWeek) =>
      `(gen_random_uuid(), '${clinic.id}', ${dayOfWeek}, '09:00', '17:00', false)`,
    ).join(', ');
    psqlExec(
      'postgres_scheduling',
      'scheduling_db',
      `INSERT INTO clinic_hours (id, tenant_id, "dayOfWeek", "openTime", "closeTime", "isClosed") VALUES ${hourRows} ON CONFLICT (tenant_id, "dayOfWeek") DO UPDATE SET "openTime" = EXCLUDED."openTime", "closeTime" = EXCLUDED."closeTime", "isClosed" = EXCLUDED."isClosed";`,
    );
    recordStat('scheduling_db', 'clinic_hours', 7);

    const availRows = Array.from({ length: 7 }, (_, dayOfWeek) =>
      `(gen_random_uuid(), '${clinic.id}', '${clinic.doctor.id}', ${dayOfWeek}, '09:00', '17:00', 30)`,
    ).join(', ');
    psqlExec(
      'postgres_scheduling',
      'scheduling_db',
      `DELETE FROM doctor_availability WHERE tenant_id = '${clinic.id}' AND "doctorId" = '${clinic.doctor.id}'; INSERT INTO doctor_availability (id, tenant_id, "doctorId", "dayOfWeek", "startTime", "endTime", "slotDurationMinutes") VALUES ${availRows};`,
    );
    recordStat('scheduling_db', 'doctor_availability', 7);
  }
}

function queueEmrOutbox(userId, phone, firstName, lastName, email, tenantId, force = false) {
  const payload = JSON.stringify({
    userId,
    phoneNumber: phone,
    firstName,
    lastName,
    email,
    role: 'PATIENT',
    tenantId,
    clinicId: tenantId,
    createdAt: new Date().toISOString(),
  }).replace(/'/g, "''");

  const guard = force
    ? ''
    : ` AND NOT EXISTS (SELECT 1 FROM outbox_events oe WHERE oe."aggregateId" = '${userId}' AND oe."eventType" = 'user.created' AND oe.payload->>'tenantId' = '${tenantId}' AND oe.status IN ('pending', 'published'))`;

  psqlExec(
    'postgres_user',
    'user_db',
    `INSERT INTO outbox_events (id, "aggregateId", "aggregateType", "eventType", payload, status, "retryCount", "createdAt") SELECT gen_random_uuid(), '${userId}', 'User', 'user.created', '${payload}'::jsonb, 'pending', 0, NOW() WHERE TRUE${guard};`,
  );
  recordStat('user_db', 'outbox_events', 1);
}

function seedEmrOutboxEvents() {
  queueEmrOutbox(
    CLINIC_A.patient1.id,
    CLINIC_A.patient1.phone,
    CLINIC_A.patient1.firstName,
    CLINIC_A.patient1.lastName,
    CLINIC_A.patient1.email,
    CLINIC_A.id,
  );
  queueEmrOutbox(
    CLINIC_B.patient1.id,
    CLINIC_B.patient1.phone,
    CLINIC_B.patient1.firstName,
    CLINIC_B.patient1.lastName,
    CLINIC_B.patient1.email,
    CLINIC_B.id,
  );
  queueEmrOutbox(
    SHARED_PATIENT.id,
    SHARED_PATIENT.phone,
    SHARED_PATIENT.firstName,
    SHARED_PATIENT.lastName,
    SHARED_PATIENT.email,
    CLINIC_A.id,
  );
  queueEmrOutbox(
    SHARED_PATIENT.id,
    SHARED_PATIENT.phone,
    SHARED_PATIENT.firstName,
    SHARED_PATIENT.lastName,
    SHARED_PATIENT.email,
    CLINIC_B.id,
    true,
  );
}

async function waitForEmrSync(userId, tenantId, maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const rows = psqlQuery(
      'postgres_emr',
      'emr_db',
      `SELECT "syncStatus" FROM patient_emr_links WHERE "userId" = '${userId}' AND tenant_id = '${tenantId}' LIMIT 1`,
    );
    if (rows[0] === 'SYNCED') return true;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

async function waitForAllEmrLinks() {
  const targets = [
    [CLINIC_A.patient1.id, CLINIC_A.id, 'patientA1/clinicA'],
    [CLINIC_B.patient1.id, CLINIC_B.id, 'patientB1/clinicB'],
    [SHARED_PATIENT.id, CLINIC_A.id, 'shared/clinicA'],
    [SHARED_PATIENT.id, CLINIC_B.id, 'shared/clinicB'],
  ];
  const results = {};
  for (const [userId, tenantId, label] of targets) {
    const ok = await waitForEmrSync(userId, tenantId);
    results[label] = ok ? 'SYNCED' : 'TIMEOUT';
    if (ok) recordStat('emr_db', 'patient_emr_links', 1);
  }
  return results;
}

async function main() {
  if (process.argv.includes('--clean')) {
    console.log('Cleaning prior MT isolation seed data...');
    runCleanup();
  }

  console.log('Hashing password (bcrypt rounds=10)...');
  const hash = await bcrypt.hash(PASSWORD, 10);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  await ensureSystemManager();

  console.log('Seeding CLINIC A + CLINIC B...');
  seedActivations(expires);
  seedClinics();
  seedUsers(hash);
  seedAppointmentData();
  seedScheduling();

  console.log('Queueing EMR sync outbox events...');
  seedEmrOutboxEvents();

  console.log('Waiting for EMR links...');
  const emrResults = await waitForAllEmrLinks();

  const output = {
    apiBase: API_BASE,
    password: PASSWORD,
    phonePrefix: PHONE_PREFIX,
    clinicA: {
      clinicId: CLINIC_A.id,
      name: CLINIC_A.name,
      appointmentId: CLINIC_A.appointmentId,
      users: {
        clinicAdmin: { userId: CLINIC_A.admin.id, phone: CLINIC_A.admin.phone, role: 'CLINIC_ADMIN' },
        doctor: { userId: CLINIC_A.doctor.id, phone: CLINIC_A.doctor.phone, role: 'DOCTOR' },
        secretary: { userId: CLINIC_A.secretary.id, phone: CLINIC_A.secretary.phone, role: 'SECRETARY' },
        patient1: { userId: CLINIC_A.patient1.id, phone: CLINIC_A.patient1.phone, role: 'PATIENT' },
      },
    },
    clinicB: {
      clinicId: CLINIC_B.id,
      name: CLINIC_B.name,
      appointmentId: CLINIC_B.appointmentId,
      users: {
        clinicAdmin: { userId: CLINIC_B.admin.id, phone: CLINIC_B.admin.phone, role: 'CLINIC_ADMIN' },
        doctor: { userId: CLINIC_B.doctor.id, phone: CLINIC_B.doctor.phone, role: 'DOCTOR' },
        secretary: { userId: CLINIC_B.secretary.id, phone: CLINIC_B.secretary.phone, role: 'SECRETARY' },
        patient1: { userId: CLINIC_B.patient1.id, phone: CLINIC_B.patient1.phone, role: 'PATIENT' },
      },
    },
    sharedPatient: {
      userId: SHARED_PATIENT.id,
      phone: SHARED_PATIENT.phone,
      role: 'PATIENT',
      linkedClinicIds: [CLINIC_A.id, CLINIC_B.id],
    },
    insertedRows: stats,
    emrSync: emrResults,
  };

  const outPath = path.join(__dirname, 'mt-isolation-seed-output.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('\n✓ MT isolation seed complete\n');
  console.log('=== CLINIC A ===');
  console.log(`  clinicId: ${CLINIC_A.id}`);
  console.log(`  CLINIC_ADMIN / ${CLINIC_A.admin.phone} / ${PASSWORD}`);
  console.log(`  DOCTOR       / ${CLINIC_A.doctor.phone} / ${PASSWORD}`);
  console.log(`  SECRETARY    / ${CLINIC_A.secretary.phone} / ${PASSWORD}`);
  console.log(`  PATIENT_A1   / ${CLINIC_A.patient1.phone} / ${PASSWORD}`);
  console.log('\n=== CLINIC B ===');
  console.log(`  clinicId: ${CLINIC_B.id}`);
  console.log(`  CLINIC_ADMIN / ${CLINIC_B.admin.phone} / ${PASSWORD}`);
  console.log(`  DOCTOR       / ${CLINIC_B.doctor.phone} / ${PASSWORD}`);
  console.log(`  SECRETARY    / ${CLINIC_B.secretary.phone} / ${PASSWORD}`);
  console.log(`  PATIENT_B1   / ${CLINIC_B.patient1.phone} / ${PASSWORD}`);
  console.log('\n=== SHARED PATIENT (multi-clinic) ===');
  console.log(`  userId: ${SHARED_PATIENT.id}`);
  console.log(`  PATIENT      / ${SHARED_PATIENT.phone} / ${PASSWORD}`);
  console.log(`  linked to clinic A + clinic B`);
  console.log('\n=== Inserted rows ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log('\n=== EMR sync ===');
  console.log(JSON.stringify(emrResults, null, 2));
  console.log(`\nOutput: ${outPath}`);
}

main().catch((err) => {
  console.error('\nMT isolation seed failed:', err.message);
  process.exit(1);
});
