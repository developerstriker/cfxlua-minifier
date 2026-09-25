-- cfxlua-builder: minificador lexical. Nao gera bytecode, VM ou criptografia.
-- Uso: lua src/builder.lua [caminho-do-resource]
local here=(arg[0] or "src/builder.lua"):match("^(.*)[\\/]") or "."
local mini=assert(loadfile(here.."/minifier.lua"))().minify
local input=arg[1] or "."
local resource=input:gsub("[\\/]$", ""); local source=resource.."/script-src"
if input:match("script%-src[\\/]?$") then source=resource;resource=resource:match("^(.+)[\\/]script%-src[\\/]?$") or "." end
local output=resource.."/script"
local ignore={};local ig=io.open(resource.."/.minifyignore","r");if ig then for line in ig:lines()do line=line:gsub("%s+$","");if line~=""and not line:match("^#")then ignore[line:gsub("\\","/")]=true end end;ig:close()end
local function ignored(path)for p in pairs(ignore)do local luaPat="^"..p:gsub("([%.%+%-%^%$%(%)%[%]])","%%%1"):gsub("%*",".*").."$";if path:match(luaPat)then return true end end;return false end
local function q(s)return '"'..s:gsub('"','\\"')..'"'end
local function rd(p)local f=assert(io.open(p,"rb"));local s=f:read("*a");f:close();return s end
local function wr(p,s)local f=assert(io.open(p,"wb"));f:write(s);f:close()end
local function md(p)os.execute("mkdir "..q(p).." >nul 2>nul")end
local function build()
 local p=io.popen("for /r "..q(source).." %F in (*) do @echo %F");assert(p,"script-src nao encontrado")
 local copies={}
 local code={server={},client={},shared={}}
 local stats={lua=0,other=0,bytesIn=0,bytesOut=0,config=0}
 for f in p:lines()do
  f=f:gsub("\\","/");local rel=f:match("/script%-src/(.+)$")
  if rel and not ignored(rel) then
   local protected=rel:match("^config/")or rel:match("/config/")or rel=="config"
   if protected then local raw=rd(f);local d=output.."/"..rel;copies[#copies+1]={path=d,raw=raw};stats.config=stats.config+1
   else
   local isLua=rel:lower():match("%.lua$");local side
   if rel:match("^server/")or rel:match("/server/")then side="server"elseif rel:match("^client/")or rel:match("/client/")then side="client"elseif rel:match("^shared/")or rel:match("/shared/")then side="shared"end
   if not side then local n=rel:match("([^/]+)%.lua$");side=n and(n:match("^server$")and"server"or n:match("^client$")and"client")or"shared"end
   if isLua then local raw=rd(f);local good,result=pcall(mini,raw);if not good then error(f..": "..result,0)end;code[side][#code[side]+1]="do "..result.."end\n";stats.lua=stats.lua+1;stats.bytesIn=stats.bytesIn+#raw;stats.bytesOut=stats.bytesOut+#result else local raw=rd(f);local d=output.."/"..rel;copies[#copies+1]={path=d,raw=raw};stats.other=stats.other+1 end
   end
  end
 end;p:close()
 os.execute("if exist "..q(output).." ren "..q(output).." script.backup-"..os.date("%Y%m%d-%H%M%S"));md(output)
 for _,copy in ipairs(copies)do md(copy.path:match("(.+)/[^/]+$")or output);wr(copy.path,copy.raw)end
 local function join(a)local s="";for _,v in ipairs(a)do s=s..v.."\n"end;return s end
 wr(output.."/server.lua",join(code.shared)..join(code.server));wr(output.."/client.lua",join(code.shared)..join(code.client))
 local luac=io.popen("where luac 2>nul");local validator=luac and luac:read("*l");if luac then luac:close()end
 if validator and validator~="" then for _,f in ipairs({output.."/server.lua",output.."/client.lua"})do local ok=os.execute("luac -p "..q(f).." >nul 2>nul");if not ok then error("Lua invalido apos minificacao: "..f)end end;print("Validacao luac: OK")else print("Aviso: luac nao encontrado; validacao sintatica ignorada")end
 local fx,game="cerulean","gta5";local ok,s=pcall(rd,resource.."/fxmanifest.lua");if ok then fx=s:match("fx_version%s+['\"]([^'\"]+)")or fx;game=s:match("game%s+['\"]([^'\"]+)")or game end
 local extra="";if ok then for line in s:gmatch("[^\r\n]+")do if not line:match("^%s*fx_version")and not line:match("^%s*game")and not line:match("^%s*server_script")and not line:match("^%s*server_scripts")and not line:match("^%s*client_script")and not line:match("^%s*client_scripts")and not line:match("^%s*shared_script")and not line:match("^%s*shared_scripts")then extra=extra..line.."\n"end end end;local m="fx_version '"..fx.."'\ngame '"..game.."'\n\n"..extra.."server_script 'script/server.lua'\nclient_script 'script/client.lua'\n";wr(resource.."/fxmanifest.lua",m)
 print("Arquivos Lua: "..stats.lua.." | Outros: "..stats.other.." | Config preservado: "..stats.config.." | Lua: "..stats.bytesIn.." -> "..stats.bytesOut.." bytes")
end
build();print("Build concluido: "..output)
