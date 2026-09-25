#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
function fail(message) { console.error(message); process.exit(1); }
if (args.includes('--help') || args.includes('-h')) {
  console.log('Uso: lua_minify [resource | script-src]\nRequer Windows e Lua 5.4 no PATH (ou LUA_BIN com o caminho do executavel).\nGera script/server.lua e script/client.lua e modifica fxmanifest.lua.\nUse --version para consultar a versao.');
  process.exit(0);
}
if (args.includes('--version')) {
  console.log(require('../package.json').version);
  process.exit(0);
}
if (process.platform !== 'win32') fail('Esta versao do builder suporta somente Windows.');
if (args.length > 1 || args.some(a => a.startsWith('-'))) fail('Argumentos invalidos. Use lua_minify --help.');
const input = path.resolve(args[0] || '.');
const root = path.basename(input) === 'script-src' ? path.dirname(input) : input;
// The legacy builder uses cmd.exe internally. Reject shell metacharacters.
if (/["%!?&|<>^\r\n]/.test(root)) fail('Caminho contem caracteres nao suportados pelo builder.');
try {
  if (!fs.statSync(path.join(root, 'script-src')).isDirectory()) throw new Error();
} catch { fail('Pasta script-src nao encontrada em: ' + root); }
const candidates = process.env.LUA_BIN ? [process.env.LUA_BIN] : ['lua', 'lua54', 'lua5.4'];
const lua = candidates.find(exe => {
  const probe = spawnSync(exe, ['-e', 'io.write(_VERSION)'], { encoding: 'utf8', windowsHide: true });
  return probe.status === 0 && probe.stdout.trim() === 'Lua 5.4';
});
if (!lua) fail('Lua 5.4 nao encontrado. Instale os binarios Windows de https://luabinaries.sourceforge.net/download.html e adicione a pasta ao PATH.\nMantenha lua54.dll junto do executavel. Alternativa no PowerShell:\n$env:LUA_BIN = "C:\\Lua\\lua54.exe"');
const result = spawnSync(lua, [path.join(__dirname, '../src/builder.lua'), root], { stdio: 'inherit', windowsHide: true });
if (result.error) fail(result.error.message);
process.exit(result.status === null ? 1 : result.status);
