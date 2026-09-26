'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { minify, lex } = require('./minifier.cjs');

function classify(rel) {
  const dirs = rel.split('/').slice(0, -1);
  if (dirs.includes('server')) return 'server';
  if (dirs.includes('client')) return 'client';
  if (dirs.includes('shared')) return 'shared';
  const name = path.posix.basename(rel);
  return name === 'server.lua' ? 'server' : name === 'client.lua' ? 'client' : 'shared';
}
function ignoredBy(text) {
  const patterns = text.split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')).map(x => {
    x = x.replaceAll('\\', '/');
    const directory = x.endsWith('/');
    const pattern = x.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + pattern + (directory ? '.*' : '') + '$');
  });
  return rel => patterns.some(p => p.test(rel));
}
function walk(root, rel = '') {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const name = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Links simbolicos nao suportados: ' + name);
    if (entry.isDirectory()) result.push(...walk(root, name));
    else if (entry.isFile()) result.push(name);
  }
  return result;
}
function manifest(source, configs) {
  const tokens = lex(source);
  const edits = [], external = [];
  const commands = /^(server|client|shared)_scripts?$/;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const match = commands.exec(token.value);
    if (!match) continue;
    if (tokens[i-1] && ['.', ':'].includes(tokens[i-1].value)) continue;
    const first = tokens[i+1];
    if (!first) throw new Error('Declaracao de scripts incompleta no manifesto');
    let endIndex = i+1;
    if (first.value === '{' || first.value === '(') {
      const close = first.value === '{' ? '}' : ')';
      let depth = 1;
      while (++endIndex < tokens.length) {
        if (tokens[endIndex].value === first.value) depth++;
        if (tokens[endIndex].value === close && --depth === 0) break;
      }
      if (endIndex === tokens.length) throw new Error('Declaracao de scripts nao terminada no manifesto');
    } else if (!/^['"\[]/.test(first.value)) {
      throw new Error('Use listas literais para scripts no fxmanifest.lua');
    }
    for (let j=i+1;j<=endIndex;j++) {
      const value=tokens[j].value;
      if (/^['"]@/.test(value)) external.push(`${match[1]}_script ${value}`);
    }
    edits.push({ start: token.start, end: tokens[endIndex].end, value: '' });
    i=endIndex;
  }
  for (const edit of edits.reverse()) source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
  const lines = [...external];
  for (const side of ['shared','server','client']) {
    for (const rel of configs.filter(x => classify(x) === side)) lines.push(`${side}_script ${JSON.stringify('script/'+rel)}`);
  }
  lines.push("server_script 'script/server.lua'", "client_script 'script/client.lua'");
  return source.trimEnd()+'\n\n'+lines.join('\n')+'\n';
}
function build(input = '.') {
  const absolute = path.resolve(input);
  const root = path.basename(absolute) === 'script-src' ? path.dirname(absolute) : absolute;
  const src = path.join(root,'script-src');
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) throw new Error('Pasta script-src nao encontrada em: '+root);
  for (const target of [src,path.join(root,'script'),path.join(root,'fxmanifest.lua')]) {
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Link simbolico nao suportado: '+target);
  }
  const ignorePath=path.join(root,'.minifyignore');
  const ignored=ignoredBy(fs.existsSync(ignorePath)?fs.readFileSync(ignorePath,'utf8'):'');
  const groups={server:[],client:[],shared:[]}, copies=[],configs=[];
  const stats={server:0,client:0,shared:0,config:0,assets:0,ignored:0,bytesIn:0,bytesOut:0};
  for (const rel of walk(src)) {
    if (ignored(rel)) { stats.ignored++;continue; }
    const raw=fs.readFileSync(path.join(src,rel));
    if (rel.split('/').slice(0,-1).includes('config')) {
      copies.push({rel,raw});stats.config++;
      if (/\.lua$/i.test(rel)) configs.push(rel);
    } else if (/\.lua$/i.test(rel)) {
      let compact;
      // Latin-1 round trip preserves every input byte, including string encoding.
      let code=raw;
      if (raw.subarray(0,3).equals(Buffer.from([239,187,191]))) code=raw.subarray(3);
      try { compact=minify(code.toString('latin1')); } catch(e) { throw new Error(rel+': '+e.message); }
      const side=classify(rel);
      groups[side].push('do\n'+compact+'\nend\n');stats[side]++;stats.bytesIn+=raw.length;
    } else { copies.push({rel,raw});stats.assets++; }
  }
  const bundles={};
  for (const side of ['server','client']) {
    bundles[side]=Buffer.from([...groups.shared,...groups[side]].join('\n'),'latin1');
    stats.bytesOut+=bundles[side].length;
  }
  const manifestPath=path.join(root,'fxmanifest.lua');
  const oldManifest=fs.existsSync(manifestPath)?fs.readFileSync(manifestPath):null;
  const updated=Buffer.from(manifest(oldManifest?oldManifest.toString('latin1'):"fx_version 'cerulean'\ngame 'gta5'",configs),'latin1');
  const stage=fs.mkdtempSync(path.join(root,'.lua-minify-'));
  const output=path.join(root,'script');
  const backup=path.join(root,'script.backup-'+path.basename(stage));
  let moved=false,installed=false;
  try {
    for (const {rel,raw} of copies) { const dest=path.join(stage,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,raw); }
    for (const side of ['server','client']) fs.writeFileSync(path.join(stage,side+'.lua'),bundles[side]);
    if (fs.existsSync(output)) { fs.renameSync(output,backup);moved=true; }
    fs.renameSync(stage,output);installed=true;
    fs.writeFileSync(manifestPath,updated);
  } catch(e) {
    if (installed) fs.renameSync(output,stage);
    if (moved) fs.renameSync(backup,output);
    if (oldManifest) fs.writeFileSync(manifestPath,oldManifest);
    throw e;
  } finally { if (fs.existsSync(stage)) fs.rmSync(stage,{recursive:true}); }
  return {output,backup:moved?backup:null,...stats};
}
module.exports={build,manifest,classify};
