const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {build}=require('../src/builder.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lua npm [test] '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function put(root,name,value){const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value);}
test('CLI builds without Lua or any executable on PATH; configs byte exact and manifest retained',t=>{
 const root=fixture(t);
 put(root,'script-src/modules/test/server/a.lua','local source=source;local user_id=core.Passport(source);print(user_id)');
 put(root,'script-src/client.lua','print("CLIENT")');
 put(root,'script-src/shared/s.lua','print("SHARED")');
 const raw=Buffer.from([239,187,191,45,45,32,233,10]);put(root,'script-src/config/a.lua',raw);
 put(root,'script-src/asset.bin',Buffer.from([0,255,128]));
 put(root,'fxmanifest.lua',"fx_version 'cerulean'\ngame 'gta5'\nui_page 'nui/index.html'\nfiles {\n 'nui/index.html'\n}\nserver_scripts {\n '@oxmysql/lib/MySQL.lua',\n 'script-src/old.lua'\n}\n");
 const env={...process.env};for(const k of Object.keys(env))if(k.toLowerCase()==='path')env[k]='';env.LUA_BIN='nonexistent';
 const run=spawnSync(process.execPath,[path.resolve('bin/cli.cjs'),'./script-src'],{cwd:root,env,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const server=fs.readFileSync(path.join(root,'script/server.lua'),'utf8');assert.match(server,/core\.Passport/);assert.doesNotMatch(server,/user_id|CLIENT/);assert.match(server,/SHARED/);
 assert.deepEqual(fs.readFileSync(path.join(root,'script/config/a.lua')),raw);
 assert.deepEqual(fs.readFileSync(path.join(root,'script/asset.bin')),Buffer.from([0,255,128]));
 const manifest=fs.readFileSync(path.join(root,'fxmanifest.lua'),'utf8');assert.match(manifest,/ui_page 'nui\/index.html'/);assert.match(manifest,/@oxmysql/);assert.doesNotMatch(manifest,/script-src\/old/);assert.match(manifest,/script\/config\/a.lua/);
 const again=build(root);assert.ok(again.backup);assert.ok(fs.existsSync(path.join(again.backup,'server.lua')));
});
test('invalid source leaves previous output and manifest untouched',t=>{
 const root=fixture(t);put(root,'script-src/server.lua','local source =');put(root,'script/server.lua','ORIGINAL');put(root,'fxmanifest.lua','ORIGINAL');
 assert.throws(()=>build(root));assert.equal(fs.readFileSync(path.join(root,'script/server.lua'),'utf8'),'ORIGINAL');assert.equal(fs.readFileSync(path.join(root,'fxmanifest.lua'),'utf8'),'ORIGINAL');
});
test('ignore globs and byte-preserving strings',t=>{
 const root=fixture(t);put(root,'.minifyignore','debug/\n*.skip.lua');put(root,'script-src/debug/a.lua','invalid');put(root,'script-src/a.skip.lua','invalid');put(root,'script-src/server.lua',Buffer.from('print("caf\xe9")','latin1'));
 const report=build(root);assert.equal(report.ignored,2);assert.ok(fs.readFileSync(path.join(root,'script/server.lua')).includes(Buffer.from('caf\xe9','latin1')));
});
