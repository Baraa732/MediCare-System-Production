#!/usr/bin/env node
/**
 * Wait until Railway auth-service returns seed OTP for reserved phones.
 * Does NOT complete registration — only probes and aborts before verify.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';
const AUTH_SERVICE = '970a7ecf-a36f-41c6-b20f-47647417ebf1';
const GATEWAY = (process.env.API_BASE || 'https://medicare-system-production-production.up.railway.app/api').replace(/\/$/, '');
const EXPECTED = (process.env.EXPECTED_COMMIT || 'f61fab9').slice(0, 7);
const PROBE_PHONE = '+963999009998';

function loadToken() {
  if (process.env.RAILWAY_TOKEN?.trim()) return process.env.RAILWAY_TOKEN.trim();
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway', 'config.json'), 'utf8'));
  return cfg?.user?.accessToken;
}

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function authDeployStatus(token) {
  const json = await gql(
    token,
    `query Deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt } }
      }
    }`,
    { input: { projectId: PROJECT, environmentId: ENV, serviceId: AUTH_SERVICE }, first: 5 },
  );
  if (json.errors) return { error: json.errors[0]?.message, edges: [] };
  return { edges: json.data?.deployments?.edges ?? [] };
}

async function probeSeedOtp() {
  const res = await fetch(`${GATEWAY}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      phoneNumber: PROBE_PHONE,
      firstName: 'Seed',
      lastName: 'Probe',
      email: 'seed.probe@demo.medicare.local',
      password: 'Demo@Test1',
      role: 'PATIENT',
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, hasDevOtp: Boolean(data.devOtp), message: data.message, data };
}

const token = loadToken();
const deadline = Date.now() + 12 * 60_000;

while (Date.now() < deadline) {
  const dep = await authDeployStatus(token);
  const latest = dep.edges[0]?.node;
  console.log(
    `[deploy] ${latest?.status ?? 'unknown'} ${latest?.createdAt ?? ''} ${dep.error ? `(${dep.error})` : ''}`,
  );

  if (latest?.status === 'SUCCESS' || latest?.status === 'DEPLOYING' || !latest) {
    try {
      const probe = await probeSeedOtp();
      console.log(`[probe] HTTP ${probe.status} hasDevOtp=${probe.hasDevOtp} msg=${probe.message ?? ''}`);
      if (probe.hasDevOtp) {
        console.log('READY — auth-service exposes seed OTP (WhatsApp skipped for seed phones).');
        process.exit(0);
      }
      if (String(probe.message || '').includes('already registered') || probe.status === 409) {
        // Probe phone may already exist from a prior wait — try login MFA for seed OTP.
        const login = await fetch(`${GATEWAY}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: PROBE_PHONE, password: 'Demo@Test1' }),
        }).then((r) => r.json());
        if (login.devOtp) {
          console.log('READY — seed OTP via login MFA.');
          process.exit(0);
        }
        console.log(`[login-probe] requiresMfa=${login.requiresMfa} hasDevOtp=${Boolean(login.devOtp)}`);
      }
    } catch (err) {
      console.log(`[probe] error: ${err.message}`);
    }
  }

  await new Promise((r) => setTimeout(r, 20_000));
}

console.error(`Timed out waiting for auth seed support (commit ${EXPECTED}).`);
process.exit(1);
