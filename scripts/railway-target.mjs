/**
 * Canonical Railway target for MediCare production.
 * Project: reliable-flow (anasdalati3)
 * Do not point ops scripts at the retired Baraa / 50517ef9 project.
 */
export const RAILWAY_PROJECT_ID = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
export const RAILWAY_ENVIRONMENT_ID = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
export const RAILWAY_PROJECT_NAME = 'reliable-flow';

export const PUBLIC_GATEWAY_ORIGIN = 'https://medicare-system-production-production-8ce0.up.railway.app';
export const PUBLIC_API_BASE = `${PUBLIC_GATEWAY_ORIGIN}/api`;

export const PUBLIC_DASHBOARDS = {
  systemManager: 'https://system-manager-dashboard-production-16c8.up.railway.app',
  clinicAdmin: 'https://clinic-admin-dashboard-production-f57a.up.railway.app',
  secretary: 'https://secretary-dashboard-production-cfc6.up.railway.app',
};

export const SERVICE_IDS = {
  Postgres: 'b8c1076d-b87c-4a62-9954-be499f924cc8',
  Redis: 'bc1658f1-ee50-48b8-aa24-81724a98f133',
  'auth-service': '8550641b-4537-4914-9300-545f32d5270f',
  'user-service': '2e53deaf-bd29-4504-9cf9-7ead72c4ecde',
  'clinic-service': 'f12e235b-60b5-47f1-9e7d-03c05219c199',
  'system-manager-service': 'a29b748e-22fe-48a7-91d2-4e0e7a8a9594',
  'appointment-service': '17bebd9b-6636-4097-bfdf-54a57388f3ee',
  'scheduling-service': 'c3bcc13d-463d-402b-828b-7b9582cd101a',
  'notification-service': '2c1f006e-bea4-4da9-b16a-06efa760a598',
  'reminder-service': 'd13d7566-ec68-42d2-b49b-7443f0403706',
  'emr-service': '57a96f70-e062-4b7a-b747-18725b62bb70',
  'MediCare-System-Production': '84d042b5-f4e0-4c6f-81db-81661c604f81',
  'system-manager-dashboard': 'f5a64b86-2750-4a2a-ba7a-dc4bff3a8856',
  'clinic-admin-dashboard': 'b3f29015-2a95-4a76-a70f-37b9470251a2',
  'secretary-dashboard': '835ca78b-6672-440e-b625-2f3e1662d9c1',
};
