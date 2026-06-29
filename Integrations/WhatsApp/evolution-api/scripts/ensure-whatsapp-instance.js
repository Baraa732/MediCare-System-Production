#!/usr/bin/env node
'use strict';

const http = require('http');

const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const apiKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.WHATSAPP_INSTANCE_NAME || 'MedicareTEST';

if (!apiKey) {
  console.error('EVOLUTION_API_KEY is required');
  process.exit(1);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, evolutionUrl);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method,
        headers: {
          apikey: apiKey,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForApi() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await request('GET', '/');
      if (res.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Evolution API not ready at ${evolutionUrl}`);
}

function listHasInstance(listJson) {
  try {
    const list = JSON.parse(listJson);
    if (!Array.isArray(list)) return false;
    return list.some(
      (item) => item?.name === instanceName || item?.instance?.instanceName === instanceName,
    );
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Waiting for Evolution API at ${evolutionUrl}...`);
  await waitForApi();

  const listRes = await request('GET', '/instance/fetchInstances');
  console.log(`fetchInstances status=${listRes.status}`);

  if (listRes.status === 200 && listHasInstance(listRes.data)) {
    console.log(`Instance '${instanceName}' already exists.`);
    return;
  }

  console.log(`Creating instance '${instanceName}'...`);
  const createRes = await request('POST', '/instance/create', {
    instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  });
  console.log(`create status=${createRes.status}`);
  console.log(createRes.data.slice(0, 500));
  console.log('Open http://localhost:8080/manager/ and scan QR to connect WhatsApp.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
