#!/usr/bin/env node
/**
 * Phase 1 validation seed — deterministic fixed IDs/phones/passwords.
 * Seeds clinics A/B/C, admins, doctor D, patients P1/P2. Secretary S is created via API in tests.
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('../../Backend/NodeJS/microservices/user-service/node_modules/bcrypt');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PG_USER = process.env.POSTGRES_USER || 'clinic_user';
const PASSWORD = 'Phase1@Test1';

export const PHONES = {
  adminA: '+963999008001',
  adminB: '+963999008002',
  adminC: '+963999008003',
  secretary: '+963999008010',
  doctor: '+963999008020',
  patient1: '+963999008101',
  patient2: '+963999008102',
};

export const IDS = {
  clinicA: '11111111-0001-4001-8001-000000000001',
  clinicB: '22222222-0002-4002-8002-000000000002',
  clinicC: '33333333-0003-4003-8003-000000000003',
  adminA: '11111111-0001-4001-8001-000000000011',
  adminB: '22222222-0002-4002-8002-000000000012',
  adminC: '33333333-0003-4003-8003-000000000013',
  secretary: 'aaaaaaaa-0010-4010-8010-000000000010',
  doctor: 'bbbbbbbb-0020-4020-8020-000000000020',
  patient1: 'cccccccc-0101-4101-8101-000000000101',
  patient2: 'dddddddd-0102-4102-8102-000000000102',
};

function psqlExec(container, database, sql) {
  execSync(
    `docker exec ${container} psql -U ${PG_USER} -d ${database} -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`,
    { stdio: 'inherit', shell: true },
  );
}

function cleanup() {
  const phoneLike = `+963999008%`;
  psqlExec(
    'postgres_clinic',
    'clinic_db',
    `DELETE FROM tenant_staff_assignments WHERE user_id::text IN ('${IDS.adminA}','${IDS.adminB}','${IDS.adminC}','${IDS.secretary}','${IDS.doctor}') OR tenant_id IN ('${IDS.clinicA}','${IDS.clinicB}','${IDS.clinicC}') OR tenant_id IN (SELECT id FROM tenants WHERE admin_phone_number LIKE '${phoneLike}'); DELETE FROM tenants WHERE id IN ('${IDS.clinicA}','${IDS.clinicB}','${IDS.clinicC}') OR admin_phone_number LIKE '${phoneLike}';`,
  );
  psqlExec(
    'postgres_user',
    'user_db',
    `DELETE FROM users WHERE "phoneNumber" LIKE '${phoneLike}' OR id::text IN ('${IDS.adminA}','${IDS.adminB}','${IDS.adminC}','${IDS.secretary}','${IDS.doctor}','${IDS.patient1}','${IDS.patient2}');`,
  );
  psqlExec(
    'postgres_appointment',
    'appointment_db',
    `DELETE FROM appointments WHERE tenant_id IN ('${IDS.clinicA}','${IDS.clinicB}','${IDS.clinicC}'); DELETE FROM patient_clinic_relations WHERE tenant_id IN ('${IDS.clinicA}','${IDS.clinicB}','${IDS.clinicC}'); DELETE FROM doctor_patient_assignments WHERE tenant_id IN ('${IDS.clinicA}','${IDS.clinicB}','${IDS.clinicC}');`,
  );
}

async function main() {
  if (process.argv.includes('--clean')) {
    console.log('Cleaning Phase 1 validation seed...');
    cleanup();
  }

  const hash = await bcrypt.hash(PASSWORD, 10);

  const clinics = [
    { id: IDS.clinicA, name: 'Phase1 Clinic A', slug: 'phase1-clinic-a', admin: IDS.adminA, phone: PHONES.adminA },
    { id: IDS.clinicB, name: 'Phase1 Clinic B', slug: 'phase1-clinic-b', admin: IDS.adminB, phone: PHONES.adminB },
    { id: IDS.clinicC, name: 'Phase1 Clinic C', slug: 'phase1-clinic-c', admin: IDS.adminC, phone: PHONES.adminC },
  ];

  for (const c of clinics) {
    psqlExec(
      'postgres_clinic',
      'clinic_db',
      `INSERT INTO tenants (id, name, slug, status, subscription_plan, description, address, city, governorate, phone, timezone, admin_phone_number, admin_user_id, created_at, updated_at) VALUES ('${c.id}', '${c.name}', '${c.slug}', 'ACTIVE', 'standard', 'Phase1 validation', 'Damascus St 1', 'Damascus', 'Damascus', '${c.phone}', 'Asia/Damascus', '${c.phone}', '${c.admin}', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET admin_user_id = EXCLUDED.admin_user_id, updated_at = NOW();`,
    );
  }

  const users = [
    { id: IDS.adminA, phone: PHONES.adminA, role: 'CLINIC_ADMIN', first: 'Admin', last: 'A', email: 'p1.admin.a@test.local', tenant: IDS.clinicA, dash: true },
    { id: IDS.adminB, phone: PHONES.adminB, role: 'CLINIC_ADMIN', first: 'Admin', last: 'B', email: 'p1.admin.b@test.local', tenant: IDS.clinicB, dash: true },
    { id: IDS.adminC, phone: PHONES.adminC, role: 'CLINIC_ADMIN', first: 'Admin', last: 'C', email: 'p1.admin.c@test.local', tenant: IDS.clinicC, dash: true },
    { id: IDS.doctor, phone: PHONES.doctor, role: 'DOCTOR', first: 'Doctor', last: 'D', email: 'p1.doctor@test.local', tenant: IDS.clinicA, dash: false, spec: 'general_practice', lic: 'P1-DOC-001' },
    { id: IDS.patient1, phone: PHONES.patient1, role: 'PATIENT', first: 'Patient', last: 'P1', email: 'p1.patient1@test.local', tenant: null, dash: false },
    { id: IDS.patient2, phone: PHONES.patient2, role: 'PATIENT', first: 'Patient', last: 'P2', email: 'p1.patient2@test.local', tenant: null, dash: false },
  ];

  for (const u of users) {
    const tenantVal = u.tenant ? `'${u.tenant}'` : 'NULL';
    const spec = u.spec ? `'${u.spec}'` : 'NULL';
    const lic = u.lic ? `'${u.lic}'` : 'NULL';
    psqlExec(
      'postgres_user',
      'user_db',
      `INSERT INTO users (id, "phoneNumber", "firstName", "lastName", email, password, role, status, "isPhoneVerified", "isEmailVerified", "isDashboardActivated", "mustChangePassword", tenant_id, permissions, specialization, "licenseNumber", "createdAt", "updatedAt") VALUES ('${u.id}', '${u.phone}', '${u.first}', '${u.last}', '${u.email}', '${hash}', '${u.role}', 'ACTIVE', true, true, ${u.dash}, false, ${tenantVal}, '', ${spec}, ${lic}, NOW(), NOW()) ON CONFLICT ("phoneNumber") DO UPDATE SET password = EXCLUDED.password, status = 'ACTIVE', "updatedAt" = NOW();`,
    );
  }

  for (const c of clinics) {
    psqlExec(
      'postgres_clinic',
      'clinic_db',
      `INSERT INTO tenant_staff_assignments (id, tenant_id, user_id, staff_role, status, is_primary, started_at, assigned_by, assigned_at, updated_at) VALUES (gen_random_uuid(), '${c.id}', '${c.admin}', 'CLINIC_ADMIN', 'ACTIVE', true, NOW(), '${c.admin}', NOW(), NOW()) ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE', is_primary = true, started_at = COALESCE(tenant_staff_assignments.started_at, NOW()), updated_at = NOW();`,
    );
  }

  psqlExec(
    'postgres_clinic',
    'clinic_db',
    `INSERT INTO tenant_staff_assignments (id, tenant_id, user_id, staff_role, status, is_primary, started_at, assigned_by, assigned_at, updated_at) VALUES (gen_random_uuid(), '${IDS.clinicA}', '${IDS.doctor}', 'DOCTOR', 'ACTIVE', true, NOW(), '${IDS.adminA}', NOW(), NOW()) ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE', is_primary = true, started_at = COALESCE(tenant_staff_assignments.started_at, NOW()), updated_at = NOW();`,
  );

  const output = {
    password: PASSWORD,
    phones: PHONES,
    ids: IDS,
    clinics: {
      A: IDS.clinicA,
      B: IDS.clinicB,
      C: IDS.clinicC,
    },
  };
  writeFileSync(path.join(__dirname, 'phase1-seed-output.json'), JSON.stringify(output, null, 2));
  console.log('Phase 1 validation seed complete.');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
