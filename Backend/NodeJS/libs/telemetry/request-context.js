'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function runWithRequestContext(context, fn) {
  return storage.run(context, fn);
}

function getRequestContext() {
  return storage.getStore() ?? {};
}

function mergeRequestContext(partial) {
  const current = storage.getStore();
  if (!current) {
    storage.enterWith({ ...partial });
    return storage.getStore();
  }
  Object.assign(current, partial);
  return current;
}

module.exports = {
  runWithRequestContext,
  getRequestContext,
  mergeRequestContext,
};
