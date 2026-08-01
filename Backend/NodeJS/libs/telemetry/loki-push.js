'use strict';

/**
 * Optional Loki push for Railway (no Docker socket / Promtail).
 * Auto-enabled on Railway; otherwise enabled when LOKI_URL is set.
 * Batches lines and POSTs to /loki/api/v1/push.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { isRailwayRuntime, resolveLokiPushUrl } = require('./loki-url');

const MAX_BATCH = Number(process.env.LOKI_PUSH_BATCH_SIZE || 40);
const FLUSH_MS = Number(process.env.LOKI_PUSH_INTERVAL_MS || 1000);
const MAX_QUEUE = Number(process.env.LOKI_PUSH_MAX_QUEUE || 2000);

/** @type {Map<string, Array<[string, string]>>} */
const queues = new Map();
let flushTimer = null;
let inflight = false;
let dropCount = 0;

function resolvePushUrl() {
  const explicit = (process.env.LOKI_PUSH_URL || process.env.LOKI_URL || '').trim();
  if (!explicit && !isRailwayRuntime()) return null;
  return resolveLokiPushUrl();
}

function enqueue(serviceName, line) {
  const pushUrl = resolvePushUrl();
  if (!pushUrl) return;

  let total = 0;
  for (const values of queues.values()) total += values.length;
  if (total >= MAX_QUEUE) {
    dropCount += 1;
    return;
  }

  const ns = `${Date.now()}000000`;
  const key = serviceName || 'unknown';
  if (!queues.has(key)) queues.set(key, []);
  queues.get(key).push([ns, line]);

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_MS);
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  }

  let queued = 0;
  for (const values of queues.values()) queued += values.length;
  if (queued >= MAX_BATCH) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
  }
}

async function flush() {
  if (inflight) return;
  const pushUrl = resolvePushUrl();
  if (!pushUrl || queues.size === 0) return;

  const streams = [];
  for (const [service, values] of queues.entries()) {
    if (!values.length) continue;
    streams.push({
      stream: { service, job: 'medicare' },
      values: values.splice(0, values.length),
    });
  }
  for (const [service, values] of [...queues.entries()]) {
    if (!values.length) queues.delete(service);
  }
  if (!streams.length) return;

  inflight = true;
  try {
    await postJson(pushUrl, { streams });
  } catch {
    // Best-effort: never break request path for log shipping failures.
  } finally {
    inflight = false;
    if (dropCount > 0) dropCount = 0;
  }
}

function postJson(urlString, body) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (err) {
      reject(err);
      return;
    }
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
        timeout: 5000,
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Loki push HTTP ${res.statusCode}`));
        }
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Loki push timeout'));
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { enqueue, flush, resolvePushUrl };
