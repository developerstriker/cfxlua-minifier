const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cli = path.resolve(__dirname, '../bin/cli.cjs');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
test('help works without Lua and without a resource', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Uso: lua_minify/);
});
test('version matches package metadata', () => {
  const result = run('--version');
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), require('../package.json').version);
});
test('missing source fails before invoking the builder', () => {
  const result = run(path.join(__dirname, 'nonexistent-resource'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /script-src nao encontrada|somente Windows/);
});
