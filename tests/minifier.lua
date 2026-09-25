package.path="src/?.lua;../src/?.lua;"..package.path
local minify=require("minifier").minify
local function execute(s)
 local f,err=load(s,"test","t",setmetatable({_a=10},{__index=_G}));assert(f,err);return table.pack(f())
end
local cases={
 {"local source=source or 3;return source",3},
 {"local x=1;do local x=2 end;return x",1},
 {"local x=2;local function f(y)return x+y end;return f(3)",5},
 {"local t={key=9,['x']=4};return t.key+t['x']",13},
 {"local _a=1;local _b=2;return _a+_b",3},
 {"local n=1;return _a+n",nil},
 {"local n=0;for i=1,3 do n=n+i end;for k,v in pairs({a=4}) do n=n+v end;return n",10},
 {"local n=0;repeat local x=n;n=x+1 until n==2;return n",2},
 {"local t={};function t:add(x)return self.base+x end;t.base=7;return t:add(2)",9},
 {"local _ENV={value=12};local value=3;return _ENV.value+value",15},
 {"local f=function(x)return x end;return f{a=1}.a",1},
 {"return 1+2,1e+2,8//3,1<<3,8>>2,3 .. 4,3~=4,3<=4,3>=3",nil},
 {"local x=1;;return x;",1},
 {"local s='x';return s[1]",nil},
}
for _,case in ipairs(cases) do
 local original=execute(case[1]);local compact=minify(case[1]);local result=execute(compact)
 assert(original.n==result.n,compact);for i=1,original.n do assert(original[i]==result[i],compact) end
 assert(load(compact,"syntax","t"))
end
assert(not pcall(minify,"local x <const> = 1"))
print("minifier regression tests passed")
