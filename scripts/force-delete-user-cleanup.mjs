/**
 * Cleanup related rows after a hard-deleted user.
 * Usage: node scripts/force-delete-user-cleanup.mjs <userId> <+phone>
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '4068da7b-8283-4cda-8e88-f4e28a0ffc22';
const ENV = '104d5d18-6ad3-48c3-8987-6198fd3484f6';
const POSTGRES = 'b8c1076d-b87c-4a62-9954-be499f924cc8';

const userId = (process.argv[2] || '').trim();
const phone = (process.argv[3] || '').trim();
if (!userId || !phone) {
  console.error('Usage: node scripts/force-delete-user-cleanup.mjs <userId> <+phone>');
  process.exit(1);
}

const ids = [userId];
const phones = [phone];

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
  if (!json.access_token) throw new Error(JSON.stringify(json));
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

async function deleteByUserIdColumn(client, dbLabel, table, column) {
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
  const r = await client.query(sql, [ids]);
  console.log(`${dbLabel}.${table}: deleted ${r.rowCount}`);
}

const token = await ensureToken();
const vars = (
  await gql(
    token,
    `query ($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    { projectId: PROJECT, environmentId: ENV, serviceId: POSTGRES },
  )
).variables;

const baseUrl = vars.DATABASE_PUBLIC_URL || vars.DATABASE_URL;
if (!baseUrl) throw new Error('No database URL');

await withDb(baseUrl, 'user_db', async (client) => {
  const r = await client.query(
    `SELECT id, "phoneNumber", status FROM users WHERE id = $1 OR "phoneNumber" = $2`,
    [userId, phone],
  );
  console.log(`user_db remaining matches: ${r.rowCount}`);
  if (r.rowCount) {
    const del = await client.query(
      `DELETE FROM users WHERE id = $1 OR "phoneNumber" = $2 RETURNING id, "phoneNumber"`,
      [userId, phone],
    );
    console.log(`user_db.users hard-deleted: ${del.rowCount}`);
  }
});

await withDb(baseUrl, 'auth_db', async (client) => {
  for (const table of ['sessions', 'trusted_devices', 'audit_logs']) {
    await deleteByUserIdColumn(client, 'auth_db', table, 'userId');
  }
  const r = await client.query(`DELETE FROM otps WHERE "phoneNumber" = ANY($1::text[])`, [
    phones,
  ]);
  console.log(`auth_db.otps: deleted ${r.rowCount}`);
});

await withDb(baseUrl, 'notification_db', async (client) => {
  for (const table of [
    'push_device_tokens',
    'patient_inbox_notifications',
    'staff_inbox_notifications',
  ]) {
    await deleteByUserIdColumn(client, 'notification_db', table, 'userId');
  }
});

await withDb(baseUrl, 'clinic_db', async (client) => {
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  for (const { tablename } of tables.rows) {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1`,
      [tablename],
    );
    const set = new Set(cols.rows.map((r) => r.column_name));
    if (set.has('userId')) {
      await deleteByUserIdColumn(client, 'clinic_db', tablename, 'userId');
    } else if (set.has('user_id')) {
      await deleteByUserIdColumn(client, 'clinic_db', tablename, 'user_id');
    }
  }
});

console.log('FORCE DELETE CLEANUP COMPLETE');
