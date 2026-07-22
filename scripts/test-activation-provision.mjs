/**
 * Smoke-test activation provisioning (multipart) against local API gateway.
 * Usage: node scripts/test-activation-provision.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const envPath = path.join(
  root,
  'Backend/NodeJS/microservices/system-manager-service/.env',
)

function loadEnv(file) {
  const vars = {}
  if (!fs.existsSync(file)) return vars
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    vars[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return vars
}

const env = loadEnv(envPath)
const username = env.DEFAULT_ADMIN_USERNAME
const password = env.DEFAULT_ADMIN_PASSWORD
if (!username || !password) {
  console.error('Missing DEFAULT_ADMIN_USERNAME/PASSWORD in system-manager-service .env')
  process.exit(1)
}

const apiBase = process.env.API_BASE ?? 'http://localhost:3000/api'

const loginRes = await fetch(`${apiBase}/system-manager/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
})
const loginJson = await loginRes.json()
if (!loginRes.ok) {
  console.error('Login failed:', loginRes.status, loginJson)
  process.exit(1)
}

const token = loginJson.accessToken
const stamp = Date.now()
const payload = {
  idNumber: `99999${String(stamp).slice(-6)}`,
  phoneNumber: `09${String(stamp).slice(-8)}`,
  fullName: 'Provision Smoke Test',
  whatsappNumber: `09${String(stamp).slice(-8)}`,
  email: 'smoke@test.local',
  dateOfBirth: '1990-06-15',
  clinicName: `Smoke Clinic ${stamp}`,
  clinicType: 'private_clinic',
  registrationLicenseNumber: `LIC-${stamp}`,
  establishmentDate: '2020-01-01',
  specialties: ['general_practice'],
  latitude: 33.5138,
  longitude: 36.2765,
  address: 'Damascus test',
  serviceRadiusKm: 5,
  yearsOfExperience: 3,
  price: 50,
  isCashPaymentDone: true,
  notes: 'automated smoke test',
}

const pdfBytes = Buffer.from('%PDF-1.4\n')
const form = new FormData()
form.append('payload', JSON.stringify(payload))
for (const field of ['nationalId', 'clinicLicense', 'governmentId']) {
  form.append(field, new Blob([pdfBytes], { type: 'application/pdf' }), `${field}.pdf`)
}

const provisionRes = await fetch(`${apiBase}/system-manager/activation-codes/provision`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
})

const provisionJson = await provisionRes.json().catch(() => null)
if (!provisionRes.ok) {
  console.error('Provision failed:', provisionRes.status, JSON.stringify(provisionJson, null, 2))
  process.exit(1)
}

console.log('Provision OK:', {
  code: provisionJson.code,
  expiresAt: provisionJson.expiresAt,
  message: provisionJson.message,
})
