#!/usr/bin/env node
'use strict';
const args=process.argv.slice(2);
if(args.includes('--help')||args.includes('-h')){
  console.log('Uso: lua_minify [resource | script-src]\nRequer somente Node.js 20+. Sem Lua instalado.\nGera script/server.lua e script/client.lua, preserva config e atualiza fxmanifest.lua.');
}else if(args.includes('--version')){
  console.log(require('../package.json').version);
}else{
  try{
    if(args.length>1||args.some(a=>a.startsWith('-')))throw new Error('Argumentos invalidos. Use --help.');
    const result=require('../src/builder.cjs').build(args[0]);
    console.log('Build concluido: '+result.output);
    console.log('Server: '+result.server+' | Client: '+result.client+' | Shared: '+result.shared+' | Config: '+result.config+' | Assets: '+result.assets+' | Ignorados: '+result.ignored);
    console.log('Lua fonte: '+result.bytesIn+' bytes | Bundles: '+result.bytesOut+' bytes (shared incluido nos dois)');
    if(result.backup)console.log('Backup: '+result.backup);
  }catch(error){console.error('lua_minify: '+error.message);process.exitCode=1;}
}
