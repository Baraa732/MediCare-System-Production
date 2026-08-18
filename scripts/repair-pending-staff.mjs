#!/usr/bin/env node
/** Wait for SM deploy then activate PENDING clinic staff assignments. */
const API = (process.env.API_BASE || 'https://medicare-system-production-production-8ce0.up.railway.app/api').replace(/\/$/, '');
const SM_USERNAME = process.env.SM_USERNAME || 'Baraa Al-Rifaee';
const SM_PASSWORD = process.env.SM_PASSWORD || 'baraaalrifaee732';
const CLINIC_ID = process.env.CLINIC_ID || 'c03b20c4-9db8-49ff-b10d-10198244a299';

async function login() {
  const res = await fetch(`${API}/system-manager/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SM_USERNAME, password: SM_PASSWORD }),
  });
  const data = await res.json();
  if (!data.accessToken) throw new Error(`SM login failed: ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function main() {
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const token = await login();
    const repair = await fetch(`${API}/system-manager/platform/staff/activate-pending`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const body = await repair.json().catch(() => ({}));
    console.log(`[repair] HTTP ${repair.status}`, body);
    if (repair.ok && body.success) {
      const staff = await fetch(`${API}/system-manager/platform/clinics/${CLINIC_ID}/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      console.log(`[verify] Damascus Heart staff count=${staff.staff?.length ?? 0}`);
      console.log(JSON.stringify(staff.staff?.map((s) => ({ role: s.staffRole, status: s.status })), null, 2));
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 20_000));
  }
  console.error('Timed out waiting for activate-pending endpoint');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
