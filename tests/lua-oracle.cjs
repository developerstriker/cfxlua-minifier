// Optional maintainer-only cross-check. Not part of npm test or the runtime.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {minify}=require('../src/minifier.cjs');
const cases=[
 'local source=source;local user_id=core.Passport(source);return source,user_id',
 'local value=2;local value,f=3,function()return value end;return value,f()',
 'local function f(source)local user_id=source+1;return user_id end;return f(3)',
 'local source=source;local f=function()return source end;do local source=99 end;return f()',
 'local function f(n)if n==0 then return 1 end;return n*f(n-1)end;return f(5)',
 'local t={value=8};local value=2;return t.value,value,t[ [=[value]=] ]',
 'local self=2;local t={n=3};function t:run()return function()return self.n end end;return t:run()(),self',
 'local n=0;repeat local done=n==2;n=n+1 until done;return n',
 'local i=3;local n=0;for i=i,5 do n=n+i end;return i,n',
 'local v=5;return v- -2,2^3^2,"x".. .2,3 .. 4',
 'local function f(_ENV)local value=value;return value end;return f({value=12})',
 'local x=1;goto label;::label:: return x',
 'local n=1;return _a+n',
 'local n=0;for k,v in pairs({a=3,b=4})do n=n+v end;return n',
];
function quote(s){let eq='=';while(s.includes(']'+eq+']'))eq+='=';return '['+eq+'['+s+']'+eq+']';}
let script='local function run(s) local env=setmetatable({source=42,_a=10,core={Passport=function(x)return x+100 end}},{__index=_G}); return table.pack(assert(load(s,"test","t",env))()) end\n';
for(const code of cases){const compact=minify(code);script+=`do local a,b=run(${quote(code)}),run(${quote(compact)}); assert(a.n==b.n); for i=1,a.n do assert(a[i]==b[i])end end\n`;}
for(const file of process.argv.slice(2)){const compact=minify(fs.readFileSync(file,'latin1').replace(/^\xef\xbb\xbf/,''));script+=`assert(load(${quote(compact)},"resource syntax","t",{}))\n`;}
const result=spawnSync(process.env.LUA_BIN||'lua',['-'],{input:script,encoding:'utf8'});
assert.equal(result.status,0,result.stderr||String(result.error));
console.log(`${cases.length} execution equivalence checks and ${process.argv.length-2} resource syntax checks passed.`);
