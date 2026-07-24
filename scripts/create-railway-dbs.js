// One-off: create the per-service databases inside the single shared Railway Postgres.
// Run via:  railway run -s Postgres -- node scripts/create-railway-dbs.js
// Uses DATABASE_PUBLIC_URL (injected by `railway run`) so it works from a local machine.
const { Client } = require('pg');

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_PUBLIC_URL / DATABASE_URL in environment. Run through `railway run -s Postgres`.');
  process.exit(1);
}

const databases = [
  'auth_db',
  'user_db',
  'system_db',
  'clinic_db',
  'scheduling_db',
  'appointment_db',
  'notification_db',
  'reminder_db',
  'emr_db',
  'evolution_db',
];

(async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const db of databases) {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${db}"`);
      console.log('created  ' + db);
    } else {
      console.log('exists   ' + db);
    }
  }
  await client.end();
  console.log('All databases ready.');
})().catch((e) => {
  console.error('DB creation failed:', e.message);
  process.exit(1);
});
