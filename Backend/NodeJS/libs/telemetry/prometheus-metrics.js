'use strict';

const client = require('prom-client');

const registries = new Map();
const httpResponseCounters = new Map();

function statusClass(statusCode) {
  const code = Number(statusCode) || 0;
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code >= 300) return '3xx';
  if (code >= 200) return '2xx';
  return 'other';
}

function getRegistry(serviceName) {
  if (!registries.has(serviceName)) {
    const registry = new client.Registry();
    registry.setDefaultLabels({ service: serviceName });
    client.collectDefaultMetrics({ register: registry });
    registries.set(serviceName, registry);
  }
  return registries.get(serviceName);
}

function getHttpResponseCounter(serviceName) {
  if (!httpResponseCounters.has(serviceName)) {
    const registry = getRegistry(serviceName);
    const counter = new client.Counter({
      name: 'medicare_http_responses_total',
      help: 'HTTP responses by status class',
      labelNames: ['service', 'status_class'],
      registers: [registry],
    });
    httpResponseCounters.set(serviceName, counter);
  }
  return httpResponseCounters.get(serviceName);
}

function recordHttpResponse(serviceName, statusCode) {
  if (!serviceName) return;
  getHttpResponseCounter(serviceName).inc({
    service: serviceName,
    status_class: statusClass(statusCode),
  });
}

function registerPrometheusRoute(expressApp, serviceName) {
  if (!expressApp || typeof expressApp.get !== 'function') return;

  const registry = getRegistry(serviceName);
  expressApp.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
}

module.exports = { registerPrometheusRoute, getRegistry, recordHttpResponse };
