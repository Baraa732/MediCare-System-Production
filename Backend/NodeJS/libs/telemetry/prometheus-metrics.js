'use strict';

const client = require('prom-client');

const registries = new Map();

function getRegistry(serviceName) {
  if (!registries.has(serviceName)) {
    const registry = new client.Registry();
    registry.setDefaultLabels({ service: serviceName });
    client.collectDefaultMetrics({ register: registry });
    registries.set(serviceName, registry);
  }
  return registries.get(serviceName);
}

function registerPrometheusRoute(expressApp, serviceName) {
  if (!expressApp || typeof expressApp.get !== 'function') return;

  const registry = getRegistry(serviceName);
  expressApp.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
}

module.exports = { registerPrometheusRoute, getRegistry };
