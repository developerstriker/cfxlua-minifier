local minify=assert(loadfile('src/minifier.lua'))().minify
local cases={
 [[local source=source;local user_id=core.Passport(source);return source,user_id]],
 [[local function first(source)local user_id=source+1;return user_id end;local function second(source)local user_id=source+2;return user_id end;return first(3),second(4)]],
 [[local source=source;local f=function()return source end;do local source=99;assert(source==99)end;return f()]],
 [[local value=2;local value,f=3,function()return value end;return value,f()]],
 [[local function fact(n)if n==0 then return 1 end;return n*fact(n-1)end;return fact(5)]],
 [==[local t={value=8};local value=2;return t.value,value,t[ [=[value]=] ]]==],
 [[local self=2;local t={n=3};function t:run()return function()return self.n end end;return t:run()(),self]],
 [[local n=0;repeat local done=n==2;n=n+1 until done;return n]],
 [[local i=3;local n=0;for i=i,5 do n=n+i end;return i,n]],
 [[local v=5;return v- -2,2^3^2,'x'.. .2]],
 [[local function f(_ENV) local value=value;return value end;return f({value=12})]],
 [[local x=1;goto label;::label:: return x]],
 [[local n=1;return _a+n]],
}
for _,s in ipairs(cases)do
 local function run(code)
  local env=setmetatable({source=42,_a=10,core={Passport=function(x)return x+100 end}},{__index=_G})
  return table.pack(assert(load(code,'scope test','t',env))())
 end
 local compact=minify(s);local a,b=run(s),run(compact)
 assert(a.n==b.n,compact);for i=1,a.n do assert(a[i]==b[i],compact)end
end
local example=minify(cases[1]);assert(not example:find('local source',1,true));assert(not example:find('user_id',1,true));assert(example:find('=source',1,true));assert(example:find('core.Passport',1,true))
local hash=minify('local value = `adder`; return value');assert(hash:find('`adder`',1,true))
for _,bad in ipairs({'local x="unterminated','local x=[[bad','local x=`bad','local x =','local x <const> = 2','local x=1;return x; x=2'})do assert(not pcall(minify,bad),bad)end
-- Optional read-only checks of actual resource sources. Never run FiveM code.
for _,file in ipairs(arg)do local f=assert(io.open(file,'rb'));local s=f:read('*a');f:close();local compact=minify(s);assert(load(compact,file,'t',{}));print('Syntax OK: '..file)end
print('Scope regressions passed ('..#cases..' execution comparisons). Example: '..example)
