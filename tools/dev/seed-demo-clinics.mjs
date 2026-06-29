#!/usr/bin/env node
/**
 * Seeds demo clinics via the same public API flow as Postman (no internal bypass).
 * Dev seed phones (+96399900XXXX) skip WhatsApp — devOtp is returned in responses.
 *
 * Usage: node tools/dev/seed-demo-clinics.mjs
 * Env:   API_BASE=http://localhost:3000/api (default)
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
const DEMO_PASSWORD = 'Demo@Test1';

const CLINICS = [
  {
    name: 'Damascus Heart Clinic',
    city: 'Damascus',
    governorate: 'Damascus',
    address: 'Mazzeh Highway, Building 12',
    admin: { firstName: 'Omar', lastName: 'Haddad', fullName: 'Omar Haddad', idNumber: 'DEMO-ADM-001' },
    doctors: [
      { firstName: 'Layla', lastName: 'Khalil', specialization: 'Cardiology', licenseNumber: 'SY-CARD-001' },
      { firstName: 'Samir', lastName: 'Nasser', specialization: 'Cardiology', licenseNumber: 'SY-CARD-002' },
    ],
  },
  {
    name: 'Aleppo Family Medical Center',
    city: 'Aleppo',
    governorate: 'Aleppo',
    address: 'Aziziyeh District, Street 5',
    admin: { firstName: 'Rana', lastName: 'Mansour', fullName: 'Rana Mansour', idNumber: 'DEMO-ADM-002' },
    doctors: [
      { firstName: 'Hassan', lastName: 'Youssef', specialization: 'General Practice', licenseNumber: 'SY-GP-001' },
    ],
  },
  {
    name: 'Homs Dental Care',
    city: 'Homs',
    governorate: 'Homs',
    address: 'Inshaat Neighborhood, Clinic 3',
    admin: { firstName: 'Nadia', lastName: 'Saleh', fullName: 'Nadia Saleh', idNumber: 'DEMO-ADM-003' },
    doctors: [
      { firstName: 'Karim', lastName: 'Darwish', specialization: 'Dentistry', licenseNumber: 'SY-DENT-001' },
      { firstName: 'Maya', lastName: 'Fares', specialization: 'Dentistry', licenseNumber: 'SY-DENT-002' },
      { firstName: 'Tarek', lastName: 'Hamdan', specialization: 'Dentistry', licenseNumber: 'SY-DENT-003' },
    ],
  },
];

const PATIENT = {
  phoneNumber: '+963999000100',
  firstName: 'Test',
  lastName: 'Patient',
  email: 'demo.patient@medicare.local',
};

/** +96399900CXXX — C=clinic (1-3), XXX=role slot (001 admin, 002 secretary, 101+ doctors) */
function seedPhone(clinicIndex, slot) {
  const c = clinicIndex + 1;
  return `+96399900${c}${String(slot).padStart(3, '0')}`;
}

function uuid() {
  return crypto.randomUUID();
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
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.message || data.error || JSON.stringify(data);
    throw new Error(`${method} ${path} → ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
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
  throw new Error(`Could not login patient ${phoneNumber}`);
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
      throw new Error(`No devOtp for ${phoneNumber}. Ensure NODE_ENV=development and phone matches +96399900XXXX.`);
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
  const login = await api('POST', '/auth/login', {
    phoneNumber,
    password: tempPassword,
  });

  if (!login.requiresMfa || !login.mfaToken) {
    throw new Error(`Staff login for ${phoneNumber} did not require MFA`);
  }

  const otp = login.devOtp;
  if (!otp) {
    throw new Error(`No devOtp on staff login for ${phoneNumber}. Rebuild auth-service with seed phone support.`);
  }

  const mfa = await api('POST', '/auth/verify-mfa', {
    mfaToken: login.mfaToken,
    otp,
  });

  if (!mfa.activationToken) {
    throw new Error(`No activationToken for staff ${phoneNumber}`);
  }

  const session = await api('POST', '/auth/staff/complete-activation', {
    activationToken: mfa.activationToken,
    newPassword: permanentPassword,
  });

  return session.accessToken;
}

async function ensureSystemManagerToken() {
  await api('POST', '/system-manager/dev/seed-default').catch(() => {});

  const login = await api('POST', '/system-manager/login', {
    username: process.env.SM_USERNAME || 'Baraa Al-Rifaee',
    password: process.env.SM_PASSWORD || 'baraaalrifaee732',
  });

  return login.accessToken;
}

async function seedClinic(clinicIndex, clinicDef, smToken) {
  const adminPhone = seedPhone(clinicIndex, 1);
  const secretaryPhone = seedPhone(clinicIndex, 2);

  console.log(`\n── Clinic ${clinicIndex + 1}: ${clinicDef.name} ──`);

  const activation = await api('POST', '/system-manager/activation-code/generate', {
    idNumber: clinicDef.admin.idNumber,
    phoneNumber: adminPhone,
    fullName: clinicDef.admin.fullName,
    clinicLocation: clinicDef.name,
    price: 0,
    isCashPaymentDone: true,
    notes: 'Demo seed data',
  }, { Authorization: `Bearer ${smToken}` });

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
    description: `${clinicDef.name} — demo clinic for AI booking tests`,
    address: clinicDef.address,
    city: clinicDef.city,
    governorate: clinicDef.governorate,
    phone: adminPhone,
  }, { Authorization: `Bearer ${adminSession.accessToken}` });

  let secretaryCreate;
  try {
    secretaryCreate = await api('POST', '/auth/clinic/create-user', {
      phoneNumber: secretaryPhone,
      firstName: 'Demo',
      lastName: 'Secretary',
      email: `secretary${clinicIndex + 1}@demo.medicare.local`,
      role: 'SECRETARY',
      clinicId: clinic.id,
    }, { Authorization: `Bearer ${adminSession.accessToken}` });
    await sleep(1500);
    await activateStaffMember(secretaryPhone, secretaryCreate.devTemporaryPassword);
  } catch (err) {
    if (!String(err.message).includes('PHONE_ALREADY_REGISTERED')) throw err;
    await loginPatient(secretaryPhone);
  }

  await sleep(1500);

  const doctors = [];
  for (let d = 0; d < clinicDef.doctors.length; d++) {
    const docDef = clinicDef.doctors[d];
    const doctorPhone = seedPhone(clinicIndex, 10 + d);
    let created;
    try {
      created = await api('POST', '/auth/clinic/create-user', {
        phoneNumber: doctorPhone,
        firstName: docDef.firstName,
        lastName: docDef.lastName,
        email: `doctor${clinicIndex + 1}-${d + 1}@demo.medicare.local`,
        role: 'DOCTOR',
        clinicId: clinic.id,
        specialization: docDef.specialization,
        licenseNumber: docDef.licenseNumber,
      }, { Authorization: `Bearer ${adminSession.accessToken}` });
      await sleep(1500);
      await activateStaffMember(doctorPhone, created.devTemporaryPassword);
    } catch (err) {
      if (!String(err.message).includes('PHONE_ALREADY_REGISTERED')) throw err;
      await loginPatient(doctorPhone);
    }

    await sleep(1500);

    doctors.push({
      phoneNumber: doctorPhone,
      name: `${docDef.firstName} ${docDef.lastName}`,
      specialization: docDef.specialization,
      password: DEMO_PASSWORD,
    });
  }

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
  console.log(`Seeding demo clinics via ${API_BASE}`);
  console.log('Dev seed phones: +96399900XXXX (WhatsApp skipped, devOtp in API responses)\n');

  const smToken = await ensureSystemManagerToken();
  const seededClinics = [];

  for (let i = 0; i < CLINICS.length; i++) {
    seededClinics.push(await seedClinic(i, CLINICS[i], smToken));
  }

  console.log('\n── Demo patient ──');
  const patientSession = await registerAndVerify({
    ...PATIENT,
    role: 'PATIENT',
  });
  console.log('Patient ready.');

  const output = {
    apiBase: API_BASE,
    password: DEMO_PASSWORD,
    patient: {
      ...PATIENT,
      password: DEMO_PASSWORD,
      accessToken: patientSession.accessToken,
    },
    clinics: seededClinics,
    postman: {
      registerPatient: {
        method: 'POST',
        url: `${API_BASE}/auth/register`,
        headers: { 'Idempotency-Key': '<uuid>', 'Content-Type': 'application/json' },
        body: {
          phoneNumber: '+963999000200',
          firstName: 'New',
          lastName: 'Patient',
          password: DEMO_PASSWORD,
          role: 'PATIENT',
        },
      },
      verifyOtp: {
        method: 'POST',
        url: `${API_BASE}/auth/verify-otp`,
        body: { phoneNumber: '+963999000200', otp: '<devOtp from register>', autoLogin: 'true' },
      },
      aiBooking: {
        method: 'POST',
        url: `${API_BASE}/ai/patient-booking-assistant`,
        headers: { Authorization: 'Bearer <patient accessToken>' },
        body: { sessionId: 'demo-session-1', message: 'Find cardiology clinics in Damascus' },
      },
      aiChat: {
        method: 'POST',
        url: `${API_BASE}/ai/patient-chat`,
        headers: { Authorization: 'Bearer <patient accessToken>' },
        body: { message: 'What should I bring to a cardiology visit?' },
      },
    },
  };

  const outPath = new URL('./seed-demo-output.json', import.meta.url);
  await import('fs').then(({ writeFileSync }) =>
    writeFileSync(outPath, JSON.stringify(output, null, 2)),
  );

  console.log('\n✓ Seed complete');
  console.log(`  Output: ${outPath.pathname.replace(/^\/([A-Za-z]:)/, '$1')}`);
  console.log(`  Patient: ${PATIENT.phoneNumber} / ${DEMO_PASSWORD}`);
  console.log(`  Clinics: ${seededClinics.length}`);
  console.log('\nOpen the patient test page: cd Frontend/patient-ai-test && npm run dev');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
