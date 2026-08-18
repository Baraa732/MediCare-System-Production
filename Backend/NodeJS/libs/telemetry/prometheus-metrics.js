'use strict';

const client = require('prom-client');

let httpRequestsTotal;
let httpRequestDuration;
let httpResponsesTotal;

function getOrCreateMetric(name, create) {
  const existing = client.register.getSingleMetric(name);
  if (existing) return existing;
  return create();
}

function ensureHttpMetrics() {
  if (httpRequestsTotal && httpRequestDuration) return;

  httpRequestsTotal = getOrCreateMetric('http_requests_total', () => new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'status'],
  }));

  httpRequestDuration = getOrCreateMetric('http_request_duration_seconds', () => new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }));

  httpResponsesTotal = getOrCreateMetric('medicare_http_responses_total', () => new client.Counter({
    name: 'medicare_http_responses_total',
    help: 'HTTP responses by status class',
    labelNames: ['service', 'status_class'],
  }));
}

function statusClass(statusCode) {
  const code = Number(statusCode) || 0;
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code >= 300) return '3xx';
  if (code >= 200) return '2xx';
  return 'other';
}

function recordHttpResponse(serviceName, statusCode, durationMs, method = 'GET') {
  ensureHttpMetrics();
  const status = String(Number(statusCode) || 0);
  const labels = { method: String(method || 'GET').toUpperCase(), status };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, Math.max(0, Number(durationMs) || 0) / 1000);
  if (serviceName) {
    httpResponsesTotal.inc({
      service: serviceName,
      status_class: statusClass(statusCode),
    });
  }
}

function registerPrometheusRoute(expressApp) {
  if (!expressApp || typeof expressApp.get !== 'function') return;

  ensureHttpMetrics();
  expressApp.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
}

function getRegistry() {
  return client.register;
}

module.exports = { registerPrometheusRoute, getRegistry, recordHttpResponse };
