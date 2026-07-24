/**
 * Seeds ONLY the default SYSTEM_MANAGER account into system_db.system_managers.
 * Mirrors system-manager-service seedDefaultSystemManager() (bcrypt cost 12, idempotent).
 *
 * Required env:
 *   DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
 * DB (either):
 *   DATABASE_URL
 *   or DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME
 * Optional:
 *   DEFAULT_ADMIN_FIRST_NAME, DEFAULT_ADMIN_LAST_NAME, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PHONE
 */
'use strict';

const bcrypt = require('bcrypt');
const { Client } = require('pg');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} env var must be set before seeding`);
  }
  return value;
}

function buildClientConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DATABASE_HOST || 'postgres-system',
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER || 'clinic_user',
    password: requireEnv('DATABASE_PASSWORD'),
    database: process.env.DATABASE_NAME || 'system_db',
  };
}

async function seedAdmin() {
  const username = requireEnv('DEFAULT_ADMIN_USERNAME');
  const password = requireEnv('DEFAULT_ADMIN_PASSWORD');
  const firstName = process.env.DEFAULT_ADMIN_FIRST_NAME || 'Admin';
  const lastName = process.env.DEFAULT_ADMIN_LAST_NAME || 'User';
  const email = process.env.DEFAULT_ADMIN_EMAIL || null;
  const phoneNumber = process.env.DEFAULT_ADMIN_PHONE || null;

  const client = new Client(buildClientConfig());
  await client.connect();

  try {
    const existing = await client.query(
      'SELECT id FROM system_managers WHERE username = $1 LIMIT 1',
      [username],
    );
    if (existing.rowCount > 0) {
      console.log(`System manager already exists: ${username}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO system_managers
        (username, password, "firstName", "lastName", email, "phoneNumber", "isActive", "linkedUserIds")
       VALUES ($1, $2, $3, $4, $5, $6, true, '[]'::jsonb)`,
      [username, hashedPassword, firstName, lastName, email, phoneNumber],
    );
    console.log(`System manager created successfully: ${username}`);
  } finally {
    await client.end();
  }
}

seedAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('seed-admin failed:', err.message || err);
    process.exit(1);
  });
