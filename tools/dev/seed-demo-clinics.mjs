#!/usr/bin/env node
/**
 * Seeds demo clinics via the public API flow.
 * Reserved phones (+96399900XXXX) never send WhatsApp — OTP/temp password
 * come back in the API response (auth-service seed-phone support).
 *
 * Usage:
 *   node tools/dev/seed-demo-clinics.mjs
 *   API_BASE=https://medicare-system-production-production.up.railway.app/api node tools/dev/seed-demo-clinics.mjs
 *
 * Env:
 *   API_BASE       default http://localhost:3000/api
 *   SM_USERNAME    system manager login
 *   SM_PASSWORD    system manager password
 *   DEMO_PASSWORD  password for all seeded accounts (default Demo@Test1)
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@Test1';

const CLINICS = [
  {
    name: 'Damascus Heart Clinic',
    city: 'Damascus',
    governorate: 'Damascus',
    address: 'Mazzeh Highway, Building 12',
    clinicType: 'private_clinic',
    latitude: 33.5138,
    longitude: 36.2765,
    specialties: ['Cardiology'],
    admin: { firstName: 'Omar', lastName: 'Haddad', fullName: 'Omar Haddad', idNumber: 'DEMO-ADM-001', dateOfBirth: '1985-03-12' },
    doctors: [
      { firstName: 'Layla', lastName: 'Khalil', specialization: 'Cardiology', licenseNumber: 'SY-CARD-001' },
    ],
  },
  {
    name: 'Aleppo Family Medical Center',
    city: 'Aleppo',
    governorate: 'Aleppo',
    address: 'Aziziyeh District, Street 5',
    clinicType: 'medical_center',
    latitude: 36.2021,
    longitude: 37.1343,
    specialties: ['General Practice'],
    admin: { firstName: 'Rana', lastName: 'Mansour', fullName: 'Rana Mansour', idNumber: 'DEMO-ADM-002', dateOfBirth: '1982-07-21' },
    doctors: [
      { firstName: 'Hassan', lastName: 'Youssef', specialization: 'General Practice', licenseNumber: 'SY-GP-001' },
    ],
  },
  {
    name: 'Homs Dental Care',
    city: 'Homs',
    governorate: 'Homs',
    address: 'Inshaat Neighborhood, Clinic 3',
    clinicType: 'dental_clinic',
    latitude: 34.7268,
    longitude: 36.7234,
    specialties: ['Dentistry'],
    admin: { firstName: 'Nadia', lastName: 'Saleh', fullName: 'Nadia Saleh', idNumber: 'DEMO-ADM-003', dateOfBirth: '1988-11-05' },
    doctors: [
      { firstName: 'Karim', lastName: 'Darwish', specialization: 'Dentistry', licenseNumber: 'SY-DENT-001' },
    ],
  },
  {
    name: 'Latakia Coastal Clinic',
    city: 'Latakia',
    governorate: 'Latakia',
    address: 'Corniche Street, Floor 2',
    clinicType: 'private_clinic',
    latitude: 35.5312,
    longitude: 35.7914,
    specialties: ['Pediatrics'],
    admin: { firstName: 'Fadi', lastName: 'Issa', fullName: 'Fadi Issa', idNumber: 'DEMO-ADM-004', dateOfBirth: '1979-01-30' },
    doctors: [
      { firstName: 'Rima', lastName: 'Abboud', specialization: 'Pediatrics', licenseNumber: 'SY-PED-001' },
    ],
  },
  {
    name: 'Tartus Wellness Center',
    city: 'Tartus',
    governorate: 'Tartus',
    address: 'Al-Basel Street 18',
    clinicType: 'medical_center',
    latitude: 34.889,
    longitude: 35.8866,
    specialties: ['Dermatology'],
    admin: { firstName: 'Samer', lastName: 'Khoury', fullName: 'Samer Khoury', idNumber: 'DEMO-ADM-005', dateOfBirth: '1984-09-18' },
    doctors: [
      { firstName: 'Hala', lastName: 'Nemeh', specialization: 'Dermatology', licenseNumber: 'SY-DERM-001' },
    ],
  },
  {
    name: 'Hama General Practice',
    city: 'Hama',
    governorate: 'Hama',
    address: 'Al-Assi Square, Building 7',
    clinicType: 'private_clinic',
    latitude: 35.1318,
    longitude: 36.7578,
    specialties: ['General Practice'],
    admin: { firstName: 'Yara', lastName: 'Halabi', fullName: 'Yara Halabi', idNumber: 'DEMO-ADM-006', dateOfBirth: '1990-04-02' },
    doctors: [
      { firstName: 'Basel', lastName: 'Qassem', specialization: 'General Practice', licenseNumber: 'SY-GP-002' },
    ],
  },
  {
    name: 'Daraa Care Clinic',
    city: 'Daraa',
    governorate: 'Daraa',
    address: 'Main Street, Clinic Block A',
    clinicType: 'private_clinic',
    latitude: 32.6189,
    longitude: 36.1021,
    specialties: ['Orthopedics'],
    admin: { firstName: 'Mona', lastName: 'Shami', fullName: 'Mona Shami', idNumber: 'DEMO-ADM-007', dateOfBirth: '1987-12-14' },
    doctors: [
      { firstName: 'Walid', lastName: 'Farhat', specialization: 'Orthopedics', licenseNumber: 'SY-ORTH-001' },
    ],
  },
  {
    name: 'Sweida Mountain Clinic',
    city: 'Sweida',
    governorate: 'Sweida',
    address: 'Qanawat Road 4',
    clinicType: 'private_clinic',
    latitude: 32.7089,
    longitude: 36.5695,
    specialties: ['Gynecology'],
    admin: { firstName: 'Rami', lastName: 'Jaber', fullName: 'Rami Jaber', idNumber: 'DEMO-ADM-008', dateOfBirth: '1981-06-25' },
    doctors: [
      { firstName: 'Dina', lastName: 'Masri', specialization: 'Gynecology', licenseNumber: 'SY-GYN-001' },
    ],
  },
  {
    name: 'Idlib Community Health',
    city: 'Idlib',
    governorate: 'Idlib',
    address: 'Central District, Suite 9',
    clinicType: 'medical_center',
    latitude: 35.9306,
    longitude: 36.6339,
    specialties: ['Internal Medicine'],
    admin: { firstName: 'Lina', lastName: 'Othman', fullName: 'Lina Othman', idNumber: 'DEMO-ADM-009', dateOfBirth: '1986-08-09' },
    doctors: [
      { firstName: 'Amer', lastName: 'Zaki', specialization: 'Internal Medicine', licenseNumber: 'SY-IM-001' },
    ],
  },
  {
    name: 'Quneitra Family Clinic',
    city: 'Quneitra',
    governorate: 'Quneitra',
    address: 'New Town Street 2',
    clinicType: 'private_clinic',
    latitude: 33.1253,
    longitude: 35.8247,
    specialties: ['Family Medicine', 'ENT'],
    admin: { firstName: 'Hiba', lastName: 'Rahal', fullName: 'Hiba Rahal', idNumber: 'DEMO-ADM-010', dateOfBirth: '1983-02-28' },
    doctors: [
      { firstName: 'Nour', lastName: 'Salem', specialization: 'Family Medicine', licenseNumber: 'SY-FM-001' },
      { firstName: 'Jad', lastName: 'Karam', specialization: 'ENT', licenseNumber: 'SY-ENT-001' },
    ],
  },
];

/** 10 seed patients — phones +963999008001 … +963999008010 (no WhatsApp). */
const PATIENTS = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  return {
    phoneNumber: `+96399900${String(8000 + n).padStart(4, '0')}`,
    firstName: ['Sara', 'Omar', 'Maya', 'Tarek', 'Lina', 'Karim', 'Hala', 'Fadi', 'Rima', 'Ziad'][i],
    lastName: ['Younes', 'Fares', 'Haddad', 'Nasser', 'Saleh', 'Ahmad', 'Khalil', 'Darwish', 'Issa', 'Mansour'][i],
    email: `patient${n}@demo.medicare.local`,
  };
});

/**
 * Phone map (fits +96399900XXXX):
 *   clinic 1..10 × slot → (clinic*100 + slot) as 4 digits
 *   slot 1=admin, 2=secretary, 10+=doctors
 * Examples: clinic1 admin +963999000101, clinic10 doctor0 +963999001010
 */
function seedPhone(clinicIndex, slot) {
  const n = (clinicIndex + 1) * 100 + slot;
  return `+96399900${String(n).padStart(4, '0')}`;
}

function uuid() {
  return crypto.randomUUID();
}

/** Tiny 1×1 PNG used as placeholder verification documents for seed provisioning. */
const SEED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function parseJsonResponse(res, label) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.message || data.error || JSON.stringify(data);
    throw new Error(`${label} → ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseJsonResponse(res, `${method} ${path}`);
}

/** Provision activation code with required document uploads (no WhatsApp). */
async function provisionActivationCode(smToken, payload) {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  const blob = new Blob([new Uint8Array(SEED_PNG)], { type: 'image/png' });
  for (const field of ['nationalId', 'clinicLicense', 'governmentId']) {
    form.append(field, blob, `${field}-seed.png`);
  }

  const res = await fetch(`${API_BASE}/system-manager/activation-codes/provision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${smToken}` },
    body: form,
  });
  return parseJsonResponse(res, 'POST /system-manager/activation-codes/provision');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginPatient(phoneNumber, password = DEMO_PASSWORD) {
  const login = await api('POST', '/auth/login', { phoneNumber, password });
  if (login.accessToken) return login;
  if (login.requiresMfa && login.mfaToken && login.devOtp) {
    return api('POST', '/auth/verify-mfa', {
      mfaToken: login.mfaToken,
      otp: login.devOtp,
    });
  }
  throw new Error(`Could not login ${phoneNumber} (no accessToken / no seed OTP). Is auth-service seed-phone support deployed?`);
}

async function registerAndVerify({ phoneNumber, firstName, lastName, email, role, password = DEMO_PASSWORD }) {
  try {
    const reg = await api('POST', '/auth/register', {
      phoneNumber,
      firstName,
      lastName,
      email,
      password,
      role,
    }, { 'Idempotency-Key': uuid() });

    const otp = reg.devOtp;
    if (!otp) {
      throw new Error(
        `No seed OTP for ${phoneNumber}. Auth must skip WhatsApp and return devOtp for +96399900XXXX.`,
      );
    }

    const verified = await api('POST', '/auth/verify-otp', {
      phoneNumber,
      otp,
      autoLogin: 'true',
    });

    return { userId: reg.userId, accessToken: verified.accessToken, refreshToken: verified.refreshToken };
  } catch (err) {
    if (String(err.message).includes('PHONE_ALREADY_REGISTERED') || String(err.message).includes('already registered')) {
      return loginPatient(phoneNumber, password);
    }
    throw err;
  }
}

async function activateStaffMember(phoneNumber, tempPassword, permanentPassword = DEMO_PASSWORD) {
  if (!tempPassword) {
    throw new Error(`Missing temp password for ${phoneNumber} (WhatsApp was not used; API must return devTemporaryPassword).`);
  }

  const login = await api('POST', '/auth/login', {
    phoneNumber,
    password: tempPassword,
  });

  if (!login.requiresMfa || !login.mfaToken) {
    if (login.accessToken) return login.accessToken;
    throw new Error(`Staff login for ${phoneNumber} did not require MFA and returned no token`);
  }

  const otp = login.devOtp;
  if (!otp) {
    throw new Error(`No seed OTP on staff login for ${phoneNumber}. Rebuild/redeploy auth-service.`);
  }

  const mfa = await api('POST', '/auth/verify-mfa', {
    mfaToken: login.mfaToken,
    otp,
  });

  if (!mfa.activationToken) {
    if (mfa.accessToken) return mfa.accessToken;
    throw new Error(`No activationToken for staff ${phoneNumber}`);
  }

  const session = await api('POST', '/auth/staff/complete-activation', {
    activationToken: mfa.activationToken,
    newPassword: permanentPassword,
  });

  return session.accessToken;
}

async function ensureSystemManagerToken() {
  // Dev-only on some environments — ignore failure when already seeded.
  await api('POST', '/system-manager/dev/seed-default').catch(() => {});

  const login = await api('POST', '/system-manager/login', {
    username: process.env.SM_USERNAME || 'Baraa Al-Rifaee',
    password: process.env.SM_PASSWORD || 'baraaalrifaee732',
  });

  if (!login.accessToken) {
    throw new Error('System manager login failed — set SM_USERNAME / SM_PASSWORD');
  }
  return login.accessToken;
}

async function seedClinic(clinicIndex, clinicDef, smToken) {
  const adminPhone = seedPhone(clinicIndex, 1);
  const secretaryPhone = seedPhone(clinicIndex, 2);

  console.log(`\n── Clinic ${clinicIndex + 1}/10: ${clinicDef.name} ──`);
  console.log(`   admin ${adminPhone} · secretary ${secretaryPhone}`);

  const activation = await provisionActivationCode(smToken, {
    idNumber: clinicDef.admin.idNumber,
    phoneNumber: adminPhone,
    fullName: clinicDef.admin.fullName,
    whatsappNumber: adminPhone,
    dateOfBirth: clinicDef.admin.dateOfBirth,
    clinicName: clinicDef.name,
    clinicType: clinicDef.clinicType,
    registrationLicenseNumber: `DEMO-LIC-${String(clinicIndex + 1).padStart(3, '0')}`,
    specialties: clinicDef.specialties,
    latitude: clinicDef.latitude,
    longitude: clinicDef.longitude,
    address: clinicDef.address,
    serviceRadiusKm: 15,
    price: 0,
    isCashPaymentDone: true,
    notes: 'Demo seed data — no WhatsApp',
  });

  await api('POST', '/auth/clinic-admin/activate', {
    code: activation.code,
    phoneNumber: adminPhone,
  }).catch((err) => {
    if (!String(err.message).includes('already been used')) throw err;
  });

  let adminSession;
  try {
    adminSession = await registerAndVerify({
      phoneNumber: adminPhone,
      firstName: clinicDef.admin.firstName,
      lastName: clinicDef.admin.lastName,
      email: `admin${clinicIndex + 1}@demo.medicare.local`,
      role: 'CLINIC_ADMIN',
    });
  } catch (err) {
    adminSession = await loginPatient(adminPhone);
  }

  const clinicsRes = await api('GET', '/clinics', null, {
    Authorization: `Bearer ${adminSession.accessToken}`,
  });
  const clinic = clinicsRes.clinics?.[0];
  if (!clinic?.id) {
    throw new Error(`Could not resolve clinic id for ${clinicDef.name}`);
  }

  await api('PUT', `/clinics/${clinic.id}`, {
    name: clinicDef.name,
    description: `${clinicDef.name} — demo clinic (seed, no OTP WhatsApp)`,
    address: clinicDef.address,
    city: clinicDef.city,
    governorate: clinicDef.governorate,
    phone: adminPhone,
  }, { Authorization: `Bearer ${adminSession.accessToken}` });

  try {
    const secretaryCreate = await api('POST', '/auth/clinic/create-user', {
      phoneNumber: secretaryPhone,
      firstName: 'Demo',
      lastName: 'Secretary',
      email: `secretary${clinicIndex + 1}@demo.medicare.local`,
      role: 'SECRETARY',
      clinicId: clinic.id,
    }, { Authorization: `Bearer ${adminSession.accessToken}` });
    await sleep(800);
    await activateStaffMember(secretaryPhone, secretaryCreate.devTemporaryPassword);
  } catch (err) {
    if (!String(err.message).includes('PHONE_ALREADY_REGISTERED') && !String(err.message).includes('already registered')) {
      throw err;
    }
    await loginPatient(secretaryPhone);
  }

  await sleep(800);

  const doctors = [];
  for (let d = 0; d < clinicDef.doctors.length; d++) {
    const docDef = clinicDef.doctors[d];
    const doctorPhone = seedPhone(clinicIndex, 10 + d);
    try {
      const created = await api('POST', '/auth/clinic/create-user', {
        phoneNumber: doctorPhone,
        firstName: docDef.firstName,
        lastName: docDef.lastName,
        email: `doctor${clinicIndex + 1}-${d + 1}@demo.medicare.local`,
        role: 'DOCTOR',
        clinicId: clinic.id,
        specialization: docDef.specialization,
        licenseNumber: docDef.licenseNumber,
      }, { Authorization: `Bearer ${adminSession.accessToken}` });
      await sleep(800);
      await activateStaffMember(doctorPhone, created.devTemporaryPassword);
    } catch (err) {
      if (!String(err.message).includes('PHONE_ALREADY_REGISTERED') && !String(err.message).includes('already registered')) {
        throw err;
      }
      await loginPatient(doctorPhone);
    }

    await sleep(800);

    doctors.push({
      phoneNumber: doctorPhone,
      name: `${docDef.firstName} ${docDef.lastName}`,
      specialization: docDef.specialization,
      password: DEMO_PASSWORD,
    });
  }

  console.log(`   ✓ clinic ${clinic.id} · ${doctors.length} doctor(s)`);

  return {
    id: clinic.id,
    name: clinicDef.name,
    city: clinicDef.city,
    governorate: clinicDef.governorate,
    admin: { phoneNumber: adminPhone, password: DEMO_PASSWORD, userId: adminSession.userId },
    secretary: { phoneNumber: secretaryPhone, password: DEMO_PASSWORD },
    doctors,
  };
}

async function main() {
  console.log(`Seeding 10 clinics + staff + 10 patients via ${API_BASE}`);
  console.log('Seed phones +96399900XXXX — WhatsApp delivery skipped\n');

  const smToken = await ensureSystemManagerToken();
  const seededClinics = [];

  for (let i = 0; i < CLINICS.length; i++) {
    seededClinics.push(await seedClinic(i, CLINICS[i], smToken));
  }

  console.log('\n── Patients (10) ──');
  const seededPatients = [];
  for (const patient of PATIENTS) {
    const session = await registerAndVerify({ ...patient, role: 'PATIENT' });
    seededPatients.push({
      ...patient,
      password: DEMO_PASSWORD,
      userId: session.userId,
    });
    console.log(`   ✓ ${patient.phoneNumber} ${patient.firstName} ${patient.lastName}`);
    await sleep(400);
  }

  const output = {
    apiBase: API_BASE,
    password: DEMO_PASSWORD,
    note: 'All phones are +96399900XXXX seed numbers — no WhatsApp OTP was sent.',
    patients: seededPatients,
    clinics: seededClinics,
  };

  const outPath = new URL('./seed-demo-output.json', import.meta.url);
  await import('fs').then(({ writeFileSync }) =>
    writeFileSync(outPath, JSON.stringify(output, null, 2)),
  );

  console.log('\n✓ Seed complete');
  console.log(`  Output: ${outPath.pathname.replace(/^\/([A-Za-z]:)/, '$1')}`);
  console.log(`  Clinics: ${seededClinics.length}`);
  console.log(`  Patients: ${seededPatients.length}`);
  console.log(`  Password for all: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
