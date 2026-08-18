/**
 * Force hard-delete a user by phone across Railway Postgres DBs.
 * Usage: node scripts/force-delete-user-by-phone.mjs +963934557287
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const POSTGRES = 'b8c1076d-b87c-4a62-9954-be499f924cc8';
const USER_SERVICE = '2e53deaf-bd29-4504-9cf9-7ead72c4ecde';

const phone = (process.argv[2] || '').trim();
if (!phone) {
  console.error('Usage: node scripts/force-delete-user-by-phone.mjs <+phone>');
  process.exit(1);
}

function loadConfig() {
  return JSON.parse(
    fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'),
  );
}

async function refreshToken() {
  const cfg = loadConfig();
  const res = await fetch('https://backboard.railway.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'rlwy_oaci_onEklvmksh1hRUiCo7E2zX12',
      grant_type: 'refresh_token',
      refresh_token: cfg.user.refreshToken,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Railway refresh failed: ${JSON.stringify(json)}`);
  cfg.user.accessToken = json.access_token;
  if (json.refresh_token) cfg.user.refreshToken = json.refresh_token;
  fs.writeFileSync(
    path.join(os.homedir(), '.railway', 'config.json'),
    JSON.stringify(cfg, null, 2),
  );
  return json.access_token;
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function ensureToken() {
  let token = process.env.RAILWAY_TOKEN?.trim() || loadConfig()?.user?.accessToken;
  try {
    await gql(token, 'query { me { id } }');
    return token;
  } catch {
    return refreshToken();
  }
}

async function getVars(token, serviceId) {
  const data = await gql(
    token,
    `query ($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    { projectId: PROJECT, environmentId: ENV, serviceId },
  );
  return data.variables || {};
}

function dbUrlWithName(baseUrl, dbName) {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function withDb(baseUrl, dbName, fn) {
  const client = new pg.Client({
    connectionString: dbUrlWithName(baseUrl, dbName),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const token = await ensureToken();
const pgVars = await getVars(token, POSTGRES);
const userVars = await getVars(token, USER_SERVICE);

const baseUrl =
  process.env.DATABASE_PUBLIC_URL ||
  pgVars.DATABASE_PUBLIC_URL ||
  pgVars.DATABASE_URL ||
  userVars.DATABASE_PUBLIC_URL ||
  userVars.DATABASE_URL;

if (!baseUrl) {
  throw new Error('No DATABASE_PUBLIC_URL / DATABASE_URL found on Postgres/user-service');
}

const phoneVariants = [
  phone,
  phone.startsWith('+') ? phone.slice(1) : `+${phone}`,
  phone.replace(/^\+963/, '0'),
  phone.replace(/^963/, '0'),
];

console.log(`Looking up phone variants: ${phoneVariants.join(', ')}`);

const found = await withDb(baseUrl, 'user_db', async (client) => {
  const res = await client.query(
    `SELECT id, "phoneNumber", "firstName", "lastName", role, status, "deletedAt"
     FROM users
     WHERE "phoneNumber" = ANY($1::text[])`,
    [phoneVariants],
  );
  return res.rows;
});

if (!found.length) {
  console.error('No user found for that phone.');
  process.exit(1);
}

for (const u of found) {
  console.log(
    `FOUND id=${u.id} phone=${u.phoneNumber} role=${u.role} status=${u.status} deletedAt=${u.deletedAt ?? 'null'}`,
  );
}

const ids = found.map((u) => u.id);
const phones = [...new Set(found.map((u) => u.phoneNumber))];

// 1) Hard delete from user_db
await withDb(baseUrl, 'user_db', async (client) => {
  await client.query('BEGIN');
  try {
    // account linking / invite tables if present
    const tables = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    const names = new Set(tables.rows.map((r) => r.tablename));

    for (const table of [
      'account_links',
      'idempotency_keys',
      'staff_invites',
      'pending_staff',
    ]) {
      if (!names.has(table)) continue;
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      const colSet = new Set(cols.rows.map((r) => r.column_name));
      if (colSet.has('userId')) {
        const r = await client.query(`DELETE FROM ${table} WHERE "userId" = ANY($1::uuid[])`, [ids]);
        console.log(`user_db.${table}: deleted ${r.rowCount}`);
      } else if (colSet.has('user_id')) {
        const r = await client.query(`DELETE FROM ${table} WHERE user_id = ANY($1::uuid[])`, [ids]);
        console.log(`user_db.${table}: deleted ${r.rowCount}`);
      }
    }

    const del = await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[]) RETURNING id, "phoneNumber"`, [
      ids,
    ]);
    console.log(`user_db.users: hard-deleted ${del.rowCount}`);
    for (const row of del.rows) console.log(`  - ${row.phoneNumber} (${row.id})`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
});

async function deleteByUserIdColumn(client, dbLabel, table, column, idList) {
  const colInfo = await client.query(
    `SELECT data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  if (!colInfo.rowCount) return;
  const { data_type: dataType, udt_name: udt } = colInfo.rows[0];
  const isUuid = dataType === 'uuid' || udt === 'uuid';
  const sql = isUuid
    ? `DELETE FROM "${table}" WHERE "${column}" = ANY($1::uuid[])`
    : `DELETE FROM "${table}" WHERE "${column}"::text = ANY($1::text[])`;
  const r = await client.query(sql, [idList]);
  console.log(`${dbLabel}.${table}: deleted ${r.rowCount}`);
}

// 2) auth_db sessions / devices / otps / audit
await withDb(baseUrl, 'auth_db', async (client) => {
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  const names = new Set(tables.rows.map((r) => r.tablename));

  for (const table of ['sessions', 'trusted_devices', 'audit_logs']) {
    if (!names.has(table)) continue;
    await deleteByUserIdColumn(client, 'auth_db', table, 'userId', ids);
  }
  if (names.has('otps')) {
    const r = await client.query(`DELETE FROM otps WHERE "phoneNumber" = ANY($1::text[])`, [phones]);
    console.log(`auth_db.otps: deleted ${r.rowCount}`);
  }
});

// 3) notification_db push + inbox
await withDb(baseUrl, 'notification_db', async (client) => {
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  const names = new Set(tables.rows.map((r) => r.tablename));
  for (const table of [
    'push_device_tokens',
    'patient_inbox_notifications',
    'staff_inbox_notifications',
  ]) {
    if (!names.has(table)) continue;
    await deleteByUserIdColumn(client, 'notification_db', table, 'userId', ids);
  }
});

// 4) clinic_db staff memberships
await withDb(baseUrl, 'clinic_db', async (client) => {
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  const names = new Set(tables.rows.map((r) => r.tablename));
  for (const table of names) {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1`,
      [table],
    );
    const colSet = new Set(cols.rows.map((r) => r.column_name));
    if (colSet.has('userId')) {
      await deleteByUserIdColumn(client, 'clinic_db', table, 'userId', ids);
    } else if (colSet.has('user_id')) {
      await deleteByUserIdColumn(client, 'clinic_db', table, 'user_id', ids);
    }
  }
});

// Verify gone
const verify = await withDb(baseUrl, 'user_db', async (client) => {
  const res = await client.query(
    `SELECT id, "phoneNumber", status FROM users WHERE "phoneNumber" = ANY($1::text[])`,
    [phoneVariants],
  );
  return res.rows;
});

if (verify.length) {
  console.error('VERIFY FAILED — user still present:', verify);
  process.exit(1);
}

console.log(`FORCE DELETE COMPLETE for ${phone}`);
