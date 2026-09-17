-- cfxlua-builder: minificador lexical. Nao gera bytecode, VM ou criptografia.
-- Uso: lua src/builder.lua [caminho-do-resource]
local input=arg[1] or "."
local resource=input:gsub("[\\/]$", ""); local source=resource.."/script-src"
if input:match("script%-src[\\/]?$") then source=resource;resource=resource:match("^(.+)[\\/]script%-src[\\/]?$") or "." end
local output=resource.."/script"
local function q(s)return '"'..s:gsub('"','\\"')..'"'end
local function rd(p)local f=assert(io.open(p,"rb"));local s=f:read("*a");f:close();return s end
local function wr(p,s)local f=assert(io.open(p,"wb"));f:write(s);f:close()end
local function md(p)os.execute("mkdir "..q(p).." >nul 2>nul")end
local function ls(s,i)local a,e=s:sub(i):match("^(%[(=*)%[)");if not a then return end;local c="]"..e.."]";local x=s:find(c,i+#a,true);if not x then return s,#s+1 end;return s:sub(i,x+#c-1),x+#c end
local kw={};for _,v in ipairs({"and","break","do","else","elseif","end","false","for","function","goto","if","in","local","nil","not","or","repeat","return","then","true","until","while"})do kw[v]=1 end
local function lex(s)
 local t,i={},1;local function a(k,v)t[#t+1]={k=k,v=v}end
 while i<=#s do local c=s:sub(i,i)
  if c:match("%s")then i=i+1
  elseif c=="-"and s:sub(i+1,i+1)=="-"then local v,n=ls(s,i+2);if v then i=n else i=s:find("\n",i+2,true)or(#s+1)end
  elseif c=="'"or c=='"' then local j=i+1;while j<=#s do if s:sub(j,j)=="\\"then j=j+2 elseif s:sub(j,j)==c then j=j+1;break else j=j+1 end end;a("p",s:sub(i,j-1));i=j
  elseif c=="["then local v,n=ls(s,i);if v then a("p",v);i=n else a("s",c);i=i+1 end
  elseif c=="`"then local j=s:find("`",i+1,true)or#s;a("p",s:sub(i,j));i=j+1
  elseif c:match("[%a_]")then local j=i+1;while j<=#s and s:sub(j,j):match("[%w_]")do j=j+1 end;local v=s:sub(i,j-1);a(kw[v]and"k"or"w",v);i=j
  elseif c:match("%d")then local j=i+1;while j<=#s and s:sub(j,j):match("[%w%.]")do j=j+1 end;a("n",s:sub(i,j-1));i=j
  else local o=s:sub(i,i+2);if o=="..."then a("s",o);i=i+3 else o=s:sub(i,i+1);if o==".."or o=="=="or o=="~="or o=="<="or o==">="or o=="//"or o=="<<"or o==">>"or o=="::"or o=="??"then a("s",o);i=i+2 else a("s",c);i=i+1 end end end
 end;return t
end
local function mini(s)
 if s:sub(1,3)=="\239\187\191" then s=s:sub(4)end
 local t=lex(s);local map,count={},{};local num=0;local function fresh()local n=num;num=num+1;local v="_";repeat v=v..string.char(97+n%26);n=math.floor(n/26)until n==0;return v end
 for i,x in ipairs(t)do if x.k=="k"and x.v=="local"then local j=i+1;if t[j]and t[j].v=="function"then j=j+1 end;while t[j]and t[j].k=="w"do count[t[j].v]=(count[t[j].v]or 0)+1;j=j+1;if not t[j]or t[j].v~=","then break end;j=j+1 end end end
 for i,x in ipairs(t)do if x.k=="k"and x.v=="local"then local j=i+1;if t[j]and t[j].v=="function"then j=j+1 end;while t[j]and t[j].k=="w"do if count[t[j].v]==1 then map[t[j].v]=map[t[j].v]or fresh();x=t[j];x.v=map[x.v]end;j=j+1;if not t[j]or t[j].v~=","then break end;j=j+1 end end end
 local o="";for i,x in ipairs(t)do local p=t[i-1];if x.k=="w"and map[x.v]and not(p and(p.v=="."or p.v==":"))then x.v=map[x.v]end;if p and(p.k=="w"or p.k=="k"or p.k=="n")and(x.k=="w"or x.k=="k"or x.k=="n")then o=o.." "end;o=o..x.v end;return o.."\n"
end
local function build()
 os.execute("if exist "..q(output).." rmdir /s /q "..q(output));md(output);local p=io.popen("for /r "..q(source).." %F in (*) do @echo %F");assert(p,"script-src nao encontrado")
 local code={server={},client={},shared={}}
 for f in p:lines()do
  f=f:gsub("\\","/");local rel=f:match("/script%-src/(.+)$")
  if rel then
   local protected=rel:match("^config/")or rel:match("/config/")or rel=="config"
   if protected then local d=output.."/"..rel;md(d:match("(.+)/[^/]+$")or output);wr(d,rd(f))
   else
   local isLua=rel:lower():match("%.lua$");local side
   if rel:match("^server/")or rel:match("/server/")then side="server"elseif rel:match("^client/")or rel:match("/client/")then side="client"elseif rel:match("^shared/")or rel:match("/shared/")then side="shared"end
   if not side then local n=rel:match("([^/]+)%.lua$");side=n and(n:match("^server$")and"server"or n:match("^client$")and"client")or"shared"end
   if isLua then code[side][#code[side]+1]=mini(rd(f))else local d=output.."/"..rel;md(d:match("(.+)/[^/]+$")or output);wr(d,rd(f))end
   end
  end
 end;p:close()
 local function join(a)local s="";for _,v in ipairs(a)do s=s..v.."\n"end;return s end
 wr(output.."/server.lua",join(code.shared)..join(code.server));wr(output.."/client.lua",join(code.shared)..join(code.client))
 local fx,game="cerulean","gta5";local ok,s=pcall(rd,resource.."/fxmanifest.lua");if ok then fx=s:match("fx_version%s+['\"]([^'\"]+)")or fx;game=s:match("game%s+['\"]([^'\"]+)")or game end
 local m="fx_version '"..fx.."'\ngame '"..game.."'\n\nserver_script 'script/server.lua'\nclient_script 'script/client.lua'\n";wr(resource.."/fxmanifest.lua",m)
end
build();print("Build concluido: "..output)
