#!/usr/bin/env node
/**
 * Books a few upcoming demo appointments so the patient Booking tab has data.
 *
 *   API_BASE=https://medicare-system-production-production-8ce0.up.railway.app/api node tools/dev/seed-demo-appointments.mjs
 */
import { randomUUID } from 'crypto';

const API_BASE = (process.env.API_BASE ||
  'https://medicare-system-production-production-8ce0.up.railway.app/api').replace(/\/$/, '');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@Test1';
const PATIENT_PHONES = ['+963999008001', '+963999008002', '+963999008003'];

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method === 'POST' && path === '/appointments') headers['Idempotency-Key'] = randomUUID();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
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
    const msg = data.message || data.error?.message || text.slice(0, 400);
    throw new Error(`${method} ${path} → ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

async function loginPatient(phoneNumber) {
  const login = await api('POST', '/auth/login', { phoneNumber, password: DEMO_PASSWORD });
  if (login.accessToken) return login.accessToken;
  if (login.requiresMfa && login.mfaToken && login.devOtp) {
    const mfa = await api('POST', '/auth/verify-mfa', {
      mfaToken: String(login.mfaToken),
      otp: String(login.devOtp),
    });
    return mfa.accessToken;
  }
  throw new Error(`Could not login ${phoneNumber}`);
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

async function pickSlot(token, clinicId, doctorId) {
  for (let add = 1; add <= 7; add++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + add);
    const slots = await api(
      'GET',
      `/schedule/slots?clinicId=${clinicId}&doctorId=${doctorId}&date=${ymd(date)}`,
      null,
      token,
    );
    const first = slots.slots?.[0];
    if (first) return first;
  }
  return null;
}

async function main() {
  console.log(`Seeding demo appointments via ${API_BASE}`);
  let booked = 0;

  for (const phone of PATIENT_PHONES) {
    const token = await loginPatient(phone);
    const clinicsRes = await api('GET', '/clinics?status=ACTIVE', null, token);
    const clinics = (clinicsRes.clinics || []).filter((c) => c.name !== 'test clinic');

    for (const clinic of clinics.slice(0, 2)) {
      const docsRes = await api('GET', `/clinics/${clinic.id}/doctors`, null, token);
      const doctor = docsRes.doctors?.[0];
      if (!doctor?.userId) {
        console.log(`   skip ${clinic.name} — no doctor`);
        continue;
      }
      const slot = await pickSlot(token, clinic.id, doctor.userId);
      if (!slot) {
        console.log(`   skip ${clinic.name} — no slots`);
        continue;
      }
      try {
        const created = await api('POST', '/appointments', {
          clinicId: clinic.id,
          doctorId: doctor.userId,
          scheduledAt: slot,
          durationMinutes: 30,
          reason: 'Demo seed visit',
        }, token);
        booked += 1;
        console.log(`   ✓ ${phone} @ ${clinic.name} ${created.appointment?.scheduledAt || slot}`);
      } catch (err) {
        console.log(`   skip ${clinic.name}: ${err.message}`);
      }
    }
  }

  console.log(`\n✓ Booked ${booked} demo appointment(s)`);
}

main().catch((err) => {
  console.error('\nSeed appointments failed:', err.message);
  process.exit(1);
});
