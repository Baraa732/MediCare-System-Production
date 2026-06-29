/**
 * MediCare Clinic API — Postman Collection Generator
 *
 * Generates a production-grade collection from the live gateway route map.
 * All requests target the API Gateway (default http://localhost:3000).
 *
 * Run from repo root:
 *   node DevOps/Scripts/generate-postman-collection.mjs
 */
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(__dirname, '../../MediCare-Clinic-API.postman_collection.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(name, method, path, opts = {}) {
  const {
    auth,
    body,
    description,
    headers = [],
    tests,
    query,
    noContentType,
  } = opts;

  const pathParts = path.replace(/^\//, '').split('/').filter(Boolean);
  const url = {
    raw: query ? `{{baseUrl}}${path}?${query}` : `{{baseUrl}}${path}`,
    host: ['{{baseUrl}}'],
    path: pathParts,
  };

  if (query) {
    url.query = query.split('&').map((pair) => {
      const [key, ...rest] = pair.split('=');
      return { key, value: rest.join('=') };
    });
  }

  const defaultHeaders = noContentType
    ? []
    : [{ key: 'Content-Type', value: 'application/json' }];

  const item = {
    name,
    request: {
      method,
      header: [...defaultHeaders, ...headers],
      body: body ? { mode: 'raw', raw: JSON.stringify(body, null, 2) } : undefined,
      url,
      description,
    },
  };

  if (auth) {
    item.request.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: auth, type: 'string' }],
    };
  }

  if (tests?.length) {
    item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }];
  }

  return item;
}

function folder(name, items, description) {
  return { name, description, item: items };
}

// ─── Shared test scripts ─────────────────────────────────────────────────────

const assert2xx = [
  'pm.test("Status is 2xx", () => {',
  '  pm.expect(pm.response.code).to.be.oneOf([200, 201, 204]);',
  '});',
];

const saveAccessTokens = [
  ...assert2xx,
  'const j = pm.response.json();',
  'if (j.userId) pm.collectionVariables.set("userId", j.userId);',
  'if (j.role) pm.collectionVariables.set("currentRole", j.role);',
  'if (j.clinicId) pm.collectionVariables.set("clinicId", j.clinicId);',
  'if (j.accessToken) {',
  '  pm.collectionVariables.set("accessToken", j.accessToken);',
  '  try {',
  '    const p = JSON.parse(atob(j.accessToken.split(".")[1]));',
  '    if (!j.userId && p.sub) pm.collectionVariables.set("userId", p.sub);',
  '    if (!j.clinicId && p.clinicId) pm.collectionVariables.set("clinicId", p.clinicId);',
  '    if (!j.role && p.role) pm.collectionVariables.set("currentRole", p.role);',
  '  } catch (e) {}',
  '}',
  'if (j.refreshToken) pm.collectionVariables.set("refreshToken", j.refreshToken);',
];

const saveAuthIdentity = [
  ...assert2xx,
  'const j = pm.response.json();',
  'if (j.userId) pm.collectionVariables.set("userId", j.userId);',
  'if (j.role) pm.collectionVariables.set("currentRole", j.role);',
  'if (j.clinicId) pm.collectionVariables.set("clinicId", j.clinicId);',
];

const saveSystemManagerToken = [
  ...assert2xx,
  'const j = pm.response.json();',
  'if (j.accessToken) pm.collectionVariables.set("systemManagerToken", j.accessToken);',
  'if (j.refreshToken) pm.collectionVariables.set("systemManagerRefreshToken", j.refreshToken);',
];

const saveMfaToken = [
  'const j = pm.response.json();',
  'if (j.mfaToken) pm.collectionVariables.set("mfaToken", j.mfaToken);',
  'if (j.requiresMfa) pm.test("MFA required", () => pm.expect(j.requiresMfa).to.eql(true));',
];

const saveActivationToken = [
  'const j = pm.response.json();',
  'if (j.activationToken) pm.collectionVariables.set("activationToken", j.activationToken);',
  'if (j.devTemporaryPassword) pm.collectionVariables.set("staffTempPassword", j.devTemporaryPassword);',
];

const saveActivationCode = [
  ...assert2xx,
  'const j = pm.response.json();',
  'if (j.code) pm.collectionVariables.set("activationCode", j.code);',
];

const saveSessionId = [
  'if (pm.response.code === 200) {',
  '  const list = pm.response.json();',
  '  if (Array.isArray(list) && list[0]?.sessionId) {',
  '    pm.collectionVariables.set("sessionId", list[0].sessionId);',
  '  }',
  '}',
];

const saveLinkedUserId = [
  ...assert2xx,
  'const j = pm.response.json();',
  'if (j.userId) pm.collectionVariables.set("linkedUserId", j.userId);',
  'if (j.id) pm.collectionVariables.set("linkedUserId", j.id);',
];

const saveClinicId = [
  ...assert2xx,
  'const j = pm.response.json();',
  'const clinic = j.clinic || j.clinics?.[0];',
  'if (clinic?.id) pm.collectionVariables.set("clinicId", clinic.id);',
];

const saveDoctorId = [
  ...assert2xx,
  'const j = pm.response.json();',
  'const doctor = j.doctors?.[0];',
  'if (doctor?.userId) pm.collectionVariables.set("doctorId", doctor.userId);',
];

const saveAppointmentId = [
  ...assert2xx,
  'const j = pm.response.json();',
  'if (j.appointment?.id) pm.collectionVariables.set("appointmentId", j.appointment.id);',
];

// ─── Sample bodies ───────────────────────────────────────────────────────────

const patientRegisterBody = {
  phoneNumber: '{{phoneNumber}}',
  firstName: 'Ahmad',
  lastName: 'Patient',
  email: 'patient@example.com',
  password: '{{password}}',
  role: 'PATIENT',
};

const clinicAdminRegisterBody = {
  phoneNumber: '{{phoneNumber}}',
  firstName: 'Clinic',
  lastName: 'Admin',
  email: 'admin@clinic.com',
  password: '{{password}}',
  role: 'CLINIC_ADMIN',
  clinicId: '{{clinicId}}',
};

const doctorCreateBody = {
  username: 'dr.sara',
  phoneNumber: '{{staffPhone}}',
  email: 'doctor@clinic.com',
  firstName: 'Sara',
  middleName: 'Ahmad',
  lastName: 'Doctor',
  nationalId: '12345678901',
  motherName: 'Fatima',
  motherLastName: 'Hassan',
  gender: 'FEMALE',
  birthDate: '1990-05-15',
  birthPlace: 'Damascus',
  maritalStatus: 'SINGLE',
  healthStatus: 'Good',
  yearsOfExperience: 8,
  governorate: 'Damascus',
  state: 'Mazzeh',
  streetInfo: 'Building 12, Street 5',
  role: 'DOCTOR',
  clinicId: '{{clinicId}}',
  specialization: 'General Practice',
  licenseNumber: 'LIC-001',
};

const secretaryCreateBody = {
  username: 'sec.amina',
  phoneNumber: '{{secretaryPhone}}',
  email: 'secretary@clinic.com',
  firstName: 'Amina',
  lastName: 'Secretary',
  role: 'SECRETARY',
  clinicId: '{{clinicId}}',
};

// ─── Collection ────────────────────────────────────────────────────────────────

const collection = {
  info: {
    _postman_id: randomUUID(),
    name: 'MediCare Clinic API',
    description:
      '# MediCare Clinic Platform API\n\n' +
      '**Gateway:** `{{baseUrl}}` (default `http://localhost:3000`)\n\n' +
      'All client traffic goes through the NestJS API Gateway. Paths `/api/*` proxy to microservices as `/v1/*`.\n\n' +
      '## Quick start (local dev)\n\n' +
      '1. `docker compose up -d --build`\n' +
      '2. **Workflow → Platform bootstrap** → seed + system manager login\n' +
      '3. Generate activation code → run **Workflow → Clinic admin onboarding**\n' +
      '4. Connect WhatsApp: **Dev & Ops → WhatsApp → Get QR code**\n\n' +
      '## Auth tokens\n\n' +
      '| Variable | Used for |\n' +
      '|----------|----------|\n' +
      '| `systemManagerToken` | `/api/system-manager/*` (platform owner) |\n' +
      '| `accessToken` | `/api/auth/*`, `/api/users/*`, `/api/emr/*` (patients & staff) |\n' +
      '| `refreshToken` | `/api/auth/refresh-token` |\n' +
      '| `mfaToken` | `/api/auth/verify-mfa` (clinic admin, doctor) |\n\n' +
      '## Roles\n\n' +
      '`SYSTEM_MANAGER` · `CLINIC_ADMIN` · `DOCTOR` · `SECRETARY` · `PATIENT`\n\n' +
      '## Headers\n\n' +
      '- **Register:** `Idempotency-Key: {{$guid}}` (required for safe retries)\n' +
      '- **Protected routes:** `Authorization: Bearer {{accessToken}}`\n\n' +
      '## Password policy\n\n' +
      'Min 8 chars · uppercase · lowercase · digit · special character\n\n' +
      '## Generated\n\n' +
      `Auto-generated ${new Date().toISOString().slice(0, 10)} from gateway routes + controller map.`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },

  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          '// Auto-generate idempotency key for register flows if empty',
          'if (!pm.collectionVariables.get("idempotencyKey")) {',
          '  pm.collectionVariables.set("idempotencyKey", pm.variables.replaceIn("{{$guid}}"));',
          '}',
        ],
      },
    },
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          'pm.test("Response time < 15s", () => {',
          '  pm.expect(pm.response.responseTime).to.be.below(15000);',
          '});',
        ],
      },
    },
  ],

  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'accessToken', value: '' },
    { key: 'refreshToken', value: '' },
    { key: 'systemManagerToken', value: '' },
    { key: 'systemManagerRefreshToken', value: '' },
    { key: 'mfaToken', value: '' },
    { key: 'activationToken', value: '' },
    { key: 'phoneNumber', value: '+963912345678' },
    { key: 'staffPhone', value: '+963912345679' },
    { key: 'secretaryPhone', value: '+963912345680' },
    { key: 'linkedPatientPhone', value: '+963912345681' },
    { key: 'password', value: 'TestPass1!' },
    { key: 'userId', value: '' },
    { key: 'linkedUserId', value: '' },
    { key: 'sessionId', value: '' },
    { key: 'activationCode', value: '' },
    { key: 'idempotencyKey', value: '' },
    { key: 'clinicId', value: '' },
    { key: 'doctorId', value: '' },
    { key: 'appointmentId', value: '' },
    { key: 'staffTempPassword', value: '' },
    { key: 'systemManagerUsername', value: 'admin' },
    { key: 'systemManagerPassword', value: 'ChangeMeAdmin1!' },
    { key: 'currentRole', value: '' },
    { key: 'devOtp', value: '123456' },
  ],

  item: [
    // ── Health ───────────────────────────────────────────────────────────────
    folder('Health & Gateway', [
      req('Liveness', 'GET', '/health/live', {
        description: 'Gateway process alive. No upstream checks.',
        tests: assert2xx,
      }),
      req('Readiness', 'GET', '/health/ready', {
        description: 'Gateway + downstream microservices ready.',
        tests: assert2xx,
      }),
      req('Health (legacy)', 'GET', '/health', {
        description: 'Combined health endpoint.',
        tests: assert2xx,
      }),
    ], 'Infrastructure probes exposed by api-gateway.'),

    // ── Workflows ──────────────────────────────────────────────────────────
    folder('Workflows', [
      folder('Platform bootstrap (dev)', [
        req('1. Seed default system manager', 'POST', '/api/system-manager/dev/seed-default', {
          description: '**Dev only.** Creates platform admin from `DEFAULT_ADMIN_*` env vars. Run once on fresh stack.',
          tests: assert2xx,
        }),
        req('2. System manager login', 'POST', '/api/system-manager/login', {
          body: {
            username: '{{systemManagerUsername}}',
            password: '{{systemManagerPassword}}',
          },
          tests: saveSystemManagerToken,
        }),
        req('3. Generate clinic admin activation code', 'POST', '/api/system-manager/activation-code/generate', {
          auth: '{{systemManagerToken}}',
          description: 'Requires `SYSTEM_MANAGER` JWT. Saves `activationCode` variable.',
          body: {
            idNumber: 'ID-10001',
            phoneNumber: '{{phoneNumber}}',
            fullName: 'Clinic Admin Name',
            clinicLocation: 'Damascus — Mazzeh',
            price: 100,
            isCashPaymentDone: true,
            notes: 'Postman onboarding test',
          },
          tests: saveActivationCode,
        }),
        req('4. Check activation code status', 'GET', '/api/system-manager/activation-code/status', {
          auth: '{{systemManagerToken}}',
          query: 'code={{activationCode}}',
          tests: assert2xx,
        }),
      ], 'End-to-end platform owner setup for local development.'),

      folder('Patient registration & login', [
        req('1. Register (patient)', 'POST', '/api/auth/register', {
          description: 'Public · Idempotency-Key required · Returns userId + role · Sends WhatsApp OTP when Evolution API connected.',
          headers: [{ key: 'Idempotency-Key', value: '{{idempotencyKey}}' }],
          body: patientRegisterBody,
          tests: saveAuthIdentity,
        }),
        req('2. Dev — get latest OTP', 'GET', '/api/auth/dev/latest-otp', {
          description: '**Dev only.** Returns OTP hint when WhatsApp not connected.',
          query: 'phoneNumber={{phoneNumber}}',
        }),
        req('3. Verify OTP (auto-login)', 'POST', '/api/auth/verify-otp', {
          description: 'Public · Set `autoLogin: "true"` to receive JWT immediately.',
          body: {
            phoneNumber: '{{phoneNumber}}',
            otp: '{{devOtp}}',
            autoLogin: 'true',
          },
          tests: saveAccessTokens,
        }),
        req('4. Login', 'POST', '/api/auth/login', {
          body: { phoneNumber: '{{phoneNumber}}', password: '{{password}}' },
          tests: [...saveAccessTokens, ...saveMfaToken],
        }),
        req('5. List sessions', 'GET', '/api/auth/sessions', {
          auth: '{{accessToken}}',
          tests: [...assert2xx, ...saveSessionId],
        }),
        req('6. Logout', 'POST', '/api/auth/logout', {
          auth: '{{accessToken}}',
          body: { refreshToken: '{{refreshToken}}' },
          tests: assert2xx,
        }),
      ], 'Standard patient self-registration flow.'),

      folder('Clinic admin onboarding', [
        req('1. Activate dashboard (consumes code)', 'POST', '/api/auth/clinic-admin/activate', {
          description: 'Public · Binds activation code to phone number. Run after platform manager generates code.',
          body: { code: '{{activationCode}}', phoneNumber: '{{phoneNumber}}' },
          tests: assert2xx,
        }),
        req('2. Register (clinic admin)', 'POST', '/api/auth/register', {
          headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          body: clinicAdminRegisterBody,
          tests: assert2xx,
        }),
        req('3. Verify OTP', 'POST', '/api/auth/verify-otp', {
          body: { phoneNumber: '{{phoneNumber}}', otp: '{{devOtp}}', autoLogin: 'false' },
          tests: assert2xx,
        }),
        req('4. Login (MFA step 1)', 'POST', '/api/auth/login', {
          body: { phoneNumber: '{{phoneNumber}}', password: '{{password}}' },
          tests: saveMfaToken,
        }),
        req('5. Verify MFA', 'POST', '/api/auth/verify-mfa', {
          body: { mfaToken: '{{mfaToken}}', otp: '{{devOtp}}' },
          tests: saveAccessTokens,
        }),
      ], 'Clinic admin: activation code → register → MFA login.'),

      folder('Staff onboarding (doctor)', [
        req('1. Create doctor (clinic admin)', 'POST', '/api/auth/clinic/create-user', {
          auth: '{{accessToken}}',
          description: '**CLINIC_ADMIN** · Temp password sent via WhatsApp (48h). Saves `staffTempPassword` in dev.',
          body: doctorCreateBody,
          tests: [...assert2xx, ...saveActivationToken],
        }),
        req('2. Doctor login (temp password)', 'POST', '/api/auth/login', {
          body: { phoneNumber: '{{staffPhone}}', password: '{{staffTempPassword}}' },
          tests: saveMfaToken,
        }),
        req('3. Doctor verify MFA', 'POST', '/api/auth/verify-mfa', {
          body: { mfaToken: '{{mfaToken}}', otp: '{{devOtp}}' },
          tests: [...saveActivationToken, ...saveAccessTokens],
        }),
        req('4. Set permanent password', 'POST', '/api/auth/staff/complete-activation', {
          description: 'Public · Uses `activationToken` from MFA response when `requiresPasswordChange` is true.',
          body: { activationToken: '{{activationToken}}', newPassword: 'DoctorPass1!' },
          tests: saveAccessTokens,
        }),
      ], 'Clinic admin creates doctor → MFA → password change.'),

      folder('Staff onboarding (secretary)', [
        req('1. Create secretary (clinic admin)', 'POST', '/api/auth/clinic/create-user', {
          auth: '{{accessToken}}',
          description: '**CLINIC_ADMIN** · Secretary has simpler profile than doctor.',
          body: secretaryCreateBody,
          tests: [...assert2xx, ...saveActivationToken],
        }),
        req('2. Secretary login (temp password)', 'POST', '/api/auth/login', {
          body: { phoneNumber: '{{secretaryPhone}}', password: '{{staffTempPassword}}' },
          tests: saveMfaToken,
        }),
        req('3. Secretary verify MFA', 'POST', '/api/auth/verify-mfa', {
          body: { mfaToken: '{{mfaToken}}', otp: '{{devOtp}}' },
          tests: saveAccessTokens,
        }),
      ], 'Clinic admin creates secretary → MFA login.'),

      folder('Patient EMR (OpenEMR sync)', [
        req('1. My sync status (patient)', 'GET', '/api/emr/me/sync-status', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Shows OpenEMR link state after Kafka `user.created` sync.',
          tests: assert2xx,
        }),
        req('2. My EMR chart (patient)', 'GET', '/api/emr/me', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Full chart when syncStatus=SYNCED.',
          tests: assert2xx,
        }),
        req('3. Patient EMR by ID (doctor/staff)', 'GET', '/api/emr/patients/{{userId}}', {
          auth: '{{accessToken}}',
          description: '**DOCTOR · CLINIC_ADMIN · SYSTEM_MANAGER** · Read patient chart by MediCare userId.',
          tests: assert2xx,
        }),
        req('4. Patient sync status (doctor/staff)', 'GET', '/api/emr/patients/{{userId}}/sync-status', {
          auth: '{{accessToken}}',
          description: 'Staff view of patient OpenEMR sync state.',
          tests: assert2xx,
        }),
      ], 'EMR routes via emr-service → OpenEMR. Patient must exist and sync via Kafka.'),

      folder('Password reset', [
        req('1. Send OTP', 'POST', '/api/auth/send-otp', {
          description: 'Public · Sends phone verification OTP.',
          body: { phoneNumber: '{{phoneNumber}}' },
          tests: assert2xx,
        }),
        req('2. Reset password', 'POST', '/api/auth/reset-password', {
          description: 'Public body · Gateway may require Bearer on some deployments — try with/without token.',
          body: {
            phoneNumber: '{{phoneNumber}}',
            otp: '{{devOtp}}',
            newPassword: 'NewPass1!',
          },
          tests: assert2xx,
        }),
      ], 'Forgot-password flow.'),
    ], 'Golden-path sequences — run folders in order for E2E testing.'),

    // ── Auth ─────────────────────────────────────────────────────────────────
    folder('Auth', [
      folder('Registration & OTP', [
        req('Register', 'POST', '/api/auth/register', {
          headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          body: patientRegisterBody,
          tests: saveAuthIdentity,
        }),
        req('Send OTP', 'POST', '/api/auth/send-otp', {
          body: { phoneNumber: '{{phoneNumber}}' },
        }),
        req('Resend OTP', 'POST', '/api/auth/resend-otp', {
          body: { phoneNumber: '{{phoneNumber}}' },
        }),
        req('Check OTP status', 'POST', '/api/auth/check-otp-status', {
          body: { phoneNumber: '{{phoneNumber}}' },
        }),
        req('Verify OTP', 'POST', '/api/auth/verify-otp', {
          body: { phoneNumber: '{{phoneNumber}}', otp: '{{devOtp}}', autoLogin: 'false' },
          tests: saveAccessTokens,
        }),
      ]),
      folder('Login & sessions', [
        req('Login', 'POST', '/api/auth/login', {
          body: { phoneNumber: '{{phoneNumber}}', password: '{{password}}' },
          tests: [...saveAccessTokens, ...saveMfaToken],
        }),
        req('Verify MFA', 'POST', '/api/auth/verify-mfa', {
          body: { mfaToken: '{{mfaToken}}', otp: '{{devOtp}}' },
          tests: saveAccessTokens,
        }),
        req('Refresh token', 'POST', '/api/auth/refresh-token', {
          description: 'May require Bearer at gateway depending on deployment.',
          body: { refreshToken: '{{refreshToken}}' },
          tests: saveAccessTokens,
        }),
        req('Logout', 'POST', '/api/auth/logout', {
          auth: '{{accessToken}}',
          body: { refreshToken: '{{refreshToken}}' },
        }),
        req('List sessions', 'GET', '/api/auth/sessions', {
          auth: '{{accessToken}}',
          tests: saveSessionId,
        }),
        req('Revoke session', 'DELETE', '/api/auth/sessions/{{sessionId}}', {
          auth: '{{accessToken}}',
        }),
        req('Revoke all sessions (except current)', 'DELETE', '/api/auth/sessions', {
          auth: '{{accessToken}}',
          query: 'except={{sessionId}}',
        }),
      ]),
      folder('Clinic & staff', [
        req('Activate clinic admin', 'POST', '/api/auth/clinic-admin/activate', {
          body: { code: '{{activationCode}}', phoneNumber: '{{phoneNumber}}' },
        }),
        req('Create clinic staff', 'POST', '/api/auth/clinic/create-user', {
          auth: '{{accessToken}}',
          description: '**CLINIC_ADMIN** · Roles: DOCTOR, SECRETARY.',
          body: doctorCreateBody,
          tests: saveActivationToken,
        }),
        req('Staff complete activation', 'POST', '/api/auth/staff/complete-activation', {
          body: { activationToken: '{{activationToken}}', newPassword: 'StaffPass1!' },
          tests: saveAccessTokens,
        }),
      ]),
      folder('Password', [
        req('Reset password', 'POST', '/api/auth/reset-password', {
          body: {
            phoneNumber: '{{phoneNumber}}',
            otp: '{{devOtp}}',
            newPassword: 'NewPass1!',
          },
        }),
      ]),
    ], 'auth-service via `/api/auth` → `/v1/auth`.'),

    // ── Users ────────────────────────────────────────────────────────────────
    folder('Users', [
      req('Create user (admin)', 'POST', '/api/users', {
        auth: '{{accessToken}}',
        description: '**SYSTEM_MANAGER · CLINIC_ADMIN** · Direct user creation (not staff onboarding flow).',
        body: {
          phoneNumber: '{{linkedPatientPhone}}',
          firstName: 'Direct',
          lastName: 'User',
          password: '{{password}}',
          role: 'PATIENT',
        },
        tests: saveLinkedUserId,
      }),
      req('List users (paginated)', 'GET', '/api/users', {
        auth: '{{accessToken}}',
        description: '**SYSTEM_MANAGER** only.',
        query: 'page=1&limit=20',
        tests: assert2xx,
      }),
      req('Get user by ID', 'GET', '/api/users/{{userId}}', {
        auth: '{{accessToken}}',
        description: 'Own profile or **SYSTEM_MANAGER · CLINIC_ADMIN**.',
        tests: assert2xx,
      }),
      req('Get user by phone', 'GET', '/api/users/phone/{{phoneNumber}}', {
        auth: '{{accessToken}}',
        description: '**SYSTEM_MANAGER · CLINIC_ADMIN**.',
        tests: assert2xx,
      }),
      req('Update user profile', 'PUT', '/api/users/{{userId}}', {
        auth: '{{accessToken}}',
        body: { firstName: 'Updated', lastName: 'Name', email: 'updated@example.com' },
        tests: assert2xx,
      }),
      req('Update user status', 'PUT', '/api/users/{{userId}}/status', {
        auth: '{{accessToken}}',
        description: '**SYSTEM_MANAGER · CLINIC_ADMIN**.',
        body: { status: 'ACTIVE' },
        tests: assert2xx,
      }),
      req('Change password', 'POST', '/api/users/{{userId}}/change-password', {
        auth: '{{accessToken}}',
        body: { currentPassword: '{{password}}', newPassword: 'NewPass1!' },
        tests: assert2xx,
      }),
      req('Delete user', 'DELETE', '/api/users/{{userId}}', {
        auth: '{{accessToken}}',
        description: '**SYSTEM_MANAGER** only.',
        tests: assert2xx,
      }),
    ], 'user-service via `/api/users` → `/v1/users`. JWT required.'),

    // ── Account linking ────────────────────────────────────────────────────
    folder('Account linking', [
      req('Link patient account', 'POST', '/api/account-linking/link-patient', {
        auth: '{{systemManagerToken}}',
        description: '**SYSTEM_MANAGER** · Creates/links patient under platform manager.',
        body: {
          phoneNumber: '{{linkedPatientPhone}}',
          firstName: 'Linked',
          lastName: 'Patient',
          email: 'linked@example.com',
        },
        tests: saveLinkedUserId,
      }),
      req('Link account (generic)', 'POST', '/api/account-linking/link', {
        auth: '{{systemManagerToken}}',
        description: '**SYSTEM_MANAGER** · `systemManagerId` overridden from JWT.',
        body: {
          systemManagerId: 'ignored-from-body',
          userId: '{{userId}}',
          linkType: 'PATIENT',
        },
        tests: assert2xx,
      }),
      req('List linked accounts', 'GET', '/api/account-linking/linked', {
        auth: '{{systemManagerToken}}',
        tests: assert2xx,
      }),
      req('Unlink account', 'DELETE', '/api/account-linking/unlink/{{linkedUserId}}', {
        auth: '{{systemManagerToken}}',
        tests: assert2xx,
      }),
      req('Available roles for user', 'GET', '/api/account-linking/available-roles', {
        auth: '{{accessToken}}',
        description: 'Returns roles the authenticated user can switch to.',
        tests: assert2xx,
      }),
    ], 'user-service via `/api/account-linking` → `/v1/account-linking`.'),

    // ── System manager ─────────────────────────────────────────────────────
    folder('System manager', [
      folder('Auth', [
        req('Login', 'POST', '/api/system-manager/login', {
          body: {
            username: '{{systemManagerUsername}}',
            password: '{{systemManagerPassword}}',
          },
          tests: saveSystemManagerToken,
        }),
      ]),
      folder('Activation codes', [
        req('Generate activation code', 'POST', '/api/system-manager/activation-code/generate', {
          auth: '{{systemManagerToken}}',
          body: {
            idNumber: 'ID-20002',
            phoneNumber: '{{phoneNumber}}',
            fullName: 'New Clinic Admin',
            clinicLocation: 'Aleppo',
            price: 150,
            isCashPaymentDone: true,
            notes: '',
          },
          tests: saveActivationCode,
        }),
        req('Activation code status', 'GET', '/api/system-manager/activation-code/status', {
          auth: '{{systemManagerToken}}',
          query: 'code={{activationCode}}',
        }),
        req('Revoke activation code', 'POST', '/api/system-manager/activation-code/revoke', {
          auth: '{{systemManagerToken}}',
          body: { code: '{{activationCode}}', reason: 'Testing revoke from Postman' },
        }),
      ]),
      folder('User management', [
        req('Create system manager', 'POST', '/api/system-manager/create', {
          auth: '{{systemManagerToken}}',
          description: '**SYSTEM_MANAGER** only.',
          body: {
            username: 'sm.test',
            password: 'SmTestPass1!',
            firstName: 'Test',
            lastName: 'Manager',
            email: 'sm@test.com',
          },
        }),
        req('Create clinic admin (direct)', 'POST', '/api/system-manager/create-clinic-admin', {
          auth: '{{systemManagerToken}}',
          description: '**SYSTEM_MANAGER** · Alternative to activation-code flow.',
          body: {
            phoneNumber: '+963912345682',
            firstName: 'Direct',
            lastName: 'ClinicAdmin',
            email: 'direct-admin@clinic.com',
            clinicName: 'Test Clinic',
          },
        }),
      ]),
      folder('Dev & seed', [
        req('Seed default admin', 'POST', '/api/system-manager/dev/seed-default', {
          description: '**Dev only** · Idempotent bootstrap.',
        }),
        req('Seed custom system manager', 'POST', '/api/system-manager/dev/seed', {
          description: '**Dev only** · Custom SM account.',
          body: {
            username: 'devadmin',
            password: 'DevAdmin1!',
            firstName: 'Dev',
            lastName: 'Admin',
            email: 'devadmin@test.com',
            phoneNumber: '+963900000001',
          },
        }),
      ]),
    ], 'system-manager-service via `/api/system-manager` → `/v1/system-manager`.'),

    // ── Patient app (Flutter) ────────────────────────────────────────────────
    folder('Patient app', [
      folder('Clinic discovery', [
        req('List active clinics', 'GET', '/api/clinics', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · All ACTIVE clinics.',
          tests: saveClinicId,
        }),
        req('Search clinics', 'GET', '/api/clinics/search', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Filters: q, city, governorate, specialization, page, limit.',
          query: 'q=clinic&city=Damascus&page=1&limit=20',
          tests: saveClinicId,
        }),
        req('Clinic detail', 'GET', '/api/clinics/{{clinicId}}', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Single clinic public profile.',
          tests: assert2xx,
        }),
        req('Clinic full profile', 'GET', '/api/clinics/{{clinicId}}/profile', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Clinic + doctors (with names) + opening hours.',
          tests: saveDoctorId,
        }),
        req('Clinic doctors', 'GET', '/api/clinics/{{clinicId}}/doctors', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Doctor roster with names and specialization.',
          tests: saveDoctorId,
        }),
        req('Doctor public profile', 'GET', '/api/users/doctors/{{doctorId}}/public', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Safe doctor card (no phone/email).',
          tests: assert2xx,
        }),
      ]),
      folder('Scheduling', [
        req('Clinic opening hours', 'GET', '/api/schedule/clinics/{{clinicId}}/hours', {
          auth: '{{accessToken}}',
          tests: assert2xx,
        }),
        req('Doctor availability windows', 'GET', '/api/schedule/availability', {
          auth: '{{accessToken}}',
          query: 'clinicId={{clinicId}}&doctorId={{doctorId}}',
          tests: assert2xx,
        }),
        req('Available slots', 'GET', '/api/schedule/slots', {
          auth: '{{accessToken}}',
          description: 'Returns slots in clinic timezone; excludes booked appointments.',
          query: 'clinicId={{clinicId}}&doctorId={{doctorId}}&date=2026-12-15&durationMinutes=30',
          tests: assert2xx,
        }),
      ]),
      folder('Appointments', [
        req('Book appointment', 'POST', '/api/appointments', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Books for self. Use a slot from GET /schedule/slots.',
          body: {
            clinicId: '{{clinicId}}',
            doctorId: '{{doctorId}}',
            scheduledAt: '2026-12-15T09:00:00.000Z',
            durationMinutes: 30,
            reason: 'General checkup',
          },
          tests: saveAppointmentId,
        }),
        req('My appointments (upcoming)', 'GET', '/api/appointments/me', {
          auth: '{{accessToken}}',
          query: 'group=upcoming',
          tests: assert2xx,
        }),
        req('My appointments (all)', 'GET', '/api/appointments/me', {
          auth: '{{accessToken}}',
          query: 'group=all',
          tests: assert2xx,
        }),
        req('Appointment detail', 'GET', '/api/appointments/{{appointmentId}}', {
          auth: '{{accessToken}}',
          description: 'Enriched with clinicName, doctorName, specialization.',
          tests: assert2xx,
        }),
        req('Reschedule appointment', 'PUT', '/api/appointments/{{appointmentId}}', {
          auth: '{{accessToken}}',
          body: { scheduledAt: '2026-12-16T10:00:00.000Z' },
          tests: assert2xx,
        }),
        req('Cancel appointment', 'PATCH', '/api/appointments/{{appointmentId}}/status', {
          auth: '{{accessToken}}',
          body: { status: 'CANCELLED', cancellationReason: 'Patient request' },
          tests: assert2xx,
        }),
      ]),
      folder('Profile & health', [
        req('My profile', 'GET', '/api/users/{{userId}}', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Own profile including specialization/profileData when applicable.',
          tests: assert2xx,
        }),
        req('Update my profile', 'PUT', '/api/users/{{userId}}', {
          auth: '{{accessToken}}',
          body: {
            firstName: 'Ahmad',
            lastName: 'Patient',
            email: 'patient@example.com',
            profileData: {
              dateOfBirth: '1990-05-15',
              gender: 'male',
              city: 'Damascus',
              governorate: 'Damascus',
              preferredLanguage: 'ar',
            },
          },
          tests: assert2xx,
        }),
        req('My notification history', 'GET', '/api/notifications/me', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · WhatsApp delivery log for appointment events.',
          query: 'page=1&limit=20',
          tests: assert2xx,
        }),
        req('Patient chat (auto context)', 'POST', '/api/ai/patient-chat', {
          auth: '{{accessToken}}',
          description: '**PATIENT** · Server auto-injects upcoming appointments into context.',
          body: { question: 'When is my next appointment?' },
          tests: assert2xx,
        }),
      ]),
    ], 'End-to-end patient mobile app flows via api-gateway. Register/login as PATIENT first.'),

    // ── EMR ──────────────────────────────────────────────────────────────────
    folder('EMR (OpenEMR)', [
      req('My EMR chart', 'GET', '/api/emr/me', {
        auth: '{{accessToken}}',
        description: '**PATIENT** · FHIR/chart data when synced to OpenEMR.',
        tests: assert2xx,
      }),
      req('My sync status', 'GET', '/api/emr/me/sync-status', {
        auth: '{{accessToken}}',
        description: '**PATIENT** · Link status: PENDING | SYNCED | FAILED.',
        tests: assert2xx,
      }),
      req('Patient EMR by userId', 'GET', '/api/emr/patients/{{userId}}', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · CLINIC_ADMIN · SYSTEM_MANAGER** · Or patient accessing own ID.',
        tests: assert2xx,
      }),
      req('Patient sync status by userId', 'GET', '/api/emr/patients/{{userId}}/sync-status', {
        auth: '{{accessToken}}',
        description: 'Staff/patient sync status for a MediCare userId.',
        tests: assert2xx,
      }),
    ], 'emr-service via `/api/emr` → `/v1/emr`. Requires OpenEMR healthy + Kafka sync.'),

    // ── AI (Ollama) ─────────────────────────────────────────────────────────
    folder('AI (Ollama)', [
      req('AI status', 'GET', '/api/ai/status', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · CLINIC_ADMIN · SYSTEM_MANAGER** · Ollama + metrics snapshot.',
        tests: assert2xx,
      }),
      req('AI metrics', 'GET', '/api/ai/metrics', {
        auth: '{{systemManagerToken}}',
        description: '**SYSTEM_MANAGER** · Usage counters.',
        tests: assert2xx,
      }),
      req('Generate summary', 'POST', '/api/ai/summary', {
        auth: '{{accessToken}}',
        description: '**SECRETARY · DOCTOR · CLINIC_ADMIN · SYSTEM_MANAGER**',
        body: { text: 'Patient visited for routine checkup. BP 120/80. Continue current medication.' },
        tests: assert2xx,
      }),
      req('Generate medical report', 'POST', '/api/ai/report', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · SYSTEM_MANAGER** · Draft report JSON.',
        body: {
          patientInfo: 'John Doe, 45M',
          labResults: 'HbA1c 6.2%',
          doctorNotes: 'Stable on regimen',
          diagnoses: 'Essential hypertension',
        },
        tests: assert2xx,
      }),
      req('OCR cleanup (text)', 'POST', '/api/ai/ocr-cleanup', {
        auth: '{{accessToken}}',
        description: '**SECRETARY · CLINIC_ADMIN · SYSTEM_MANAGER** · Send raw OCR text.',
        body: { rawText: 'HbA1c: 6.2%0 Date: 2025-01-15', documentType: 'lab_report' },
        tests: assert2xx,
      }),
      req('Patient chat', 'POST', '/api/ai/patient-chat', {
        auth: '{{accessToken}}',
        description: '**PATIENT · SYSTEM_MANAGER** · General health info only.',
        body: { question: 'How do I prepare for a blood test?', context: 'Appointment Monday 9 AM' },
        tests: assert2xx,
      }),
      req('Doctor chat', 'POST', '/api/ai/doctor-chat', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · CLINIC_ADMIN · SYSTEM_MANAGER** · Documentation assistant.',
        body: { question: 'Summarize recent visit history', patientContext: '3 hypertension visits' },
        tests: assert2xx,
      }),
      req('Appointment note', 'POST', '/api/ai/appointment-note', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · SECRETARY · CLINIC_ADMIN · SYSTEM_MANAGER**',
        body: { notes: 'Pt c/o headache x2d. BP 130/85. F/U 1wk.', context: 'Follow-up' },
        tests: assert2xx,
      }),
      req('Clinical assessment', 'POST', '/api/ai/clinical-assessment', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · SYSTEM_MANAGER**',
        body: { data: '45M, BP 130/85, on lisinopril 10mg, no chest pain' },
        tests: assert2xx,
      }),
      req('Recommendations', 'POST', '/api/ai/recommendations', {
        auth: '{{accessToken}}',
        description: '**DOCTOR · SYSTEM_MANAGER**',
        body: { data: 'Hypertension, suboptimal control, no secondary symptoms' },
        tests: assert2xx,
      }),
    ], 'ai-service via `/api/ai` → `/v1/ai`. Requires Ollama + qwen3:4b model pulled.'),

    // ── Dev & Ops ──────────────────────────────────────────────────────────
    folder('Dev & Ops', [
      folder('WhatsApp (Evolution API)', [
        req('WhatsApp connection status', 'GET', '/api/auth/dev/whatsapp-status', {
          description: '**Dev only** · Check Evolution API instance state.',
          tests: assert2xx,
        }),
        req('Get WhatsApp QR code', 'GET', '/api/auth/dev/whatsapp-qr', {
          description: '**Dev only** · Base64 QR — scan with WhatsApp Linked Devices.',
          tests: [
            'pm.test("Has QR or connected flag", () => {',
            '  const j = pm.response.json();',
            '  pm.expect(j.connected === true || j.qrImage || j.message).to.be.ok;',
            '});',
          ],
        }),
        req('Get latest OTP (dev fallback)', 'GET', '/api/auth/dev/latest-otp', {
          description: '**Dev only** · When WhatsApp disconnected, use OTP from here for testing.',
          query: 'phoneNumber={{phoneNumber}}',
          tests: [
            'if (pm.response.code === 200) {',
            '  const j = pm.response.json();',
            '  if (j.devOtp) pm.collectionVariables.set("devOtp", j.devOtp);',
            '}',
          ],
        }),
      ], 'Integrations/WhatsApp · Required for OTP delivery in development.'),
      folder('Stack bootstrap', [
        req('Seed platform admin', 'POST', '/api/system-manager/dev/seed-default', {
          description: 'First request on fresh `docker compose up`.',
        }),
      ]),
    ], 'Development helpers — disabled when NODE_ENV !== development.'),
  ],
};

// ─── Write ───────────────────────────────────────────────────────────────────

writeFileSync(OUT_FILE, JSON.stringify(collection, null, 2));

const routeCount = JSON.stringify(collection)
  .match(/"method":/g)?.length ?? 0;

console.log(`✓ Postman collection written: ${OUT_FILE}`);
console.log(`  Requests: ${routeCount}`);
console.log(`  Folders: ${collection.item.length} top-level`);
