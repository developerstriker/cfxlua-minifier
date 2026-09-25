-- Scope-aware Lua 5.4 source minifier.  It deliberately accepts only the
-- grammar needed by normal Lua source; an unknown construct is an error.
local M = {}
local keywords = {}; for _, k in ipairs{"and","break","do","else","elseif","end","false","for","function","goto","if","in","local","nil","not","or","repeat","return","then","true","until","while"} do keywords[k] = true end
local function fail(s) error("minifier: " .. s, 0) end
local function long(s, i)
  local a, eq = s:sub(i):match("^(%[(=*)%[)"); if not a then return end
  local close = "]" .. eq .. "]"; local p = s:find(close, i + #a, true)
  if not p then fail("unterminated long string/comment") end
  return s:sub(i, p + #close - 1), p + #close
end
local function lex(s)
  local t, i = {}, 1; local function add(k,v) t[#t+1]={k=k,v=v,raw=v} end
  while i <= #s do local c=s:sub(i,i)
    if c:match("%s") then i=i+1
    elseif c=="-" and s:sub(i+1,i+1)=="-" then local _,n=long(s,i+2); i=n or (s:find("\n",i+2,true) or #s+1)
    elseif c=="'" or c=='"' then local j=i+1;local closed=false; while j<=#s do local q=s:sub(j,j); if q=="\\" then j=j+2 elseif q==c then j=j+1;closed=true;break else j=j+1 end end; if not closed then fail("unterminated string") end; add("lit",s:sub(i,j-1)); i=j
    elseif c=="[" then local v,n=long(s,i); if v then add("lit",v); i=n else add("sym",c); i=i+1 end
    elseif c=="`" then local j=s:find("`",i+1,true); if not j then fail("unterminated hash literal") end; add("hash",s:sub(i,j)); i=j+1
    elseif c:match("[%a_]") then local j=i+1; while s:sub(j,j):match("[%w_]") do j=j+1 end; local v=s:sub(i,j-1); add(keywords[v] and "kw" or "id",v); i=j
    elseif c:match("%d") or (c=="." and s:sub(i+1,i+1):match("%d")) then local rest=s:sub(i); local v=rest:match("^0[xX][%da-fA-F]+%.?[%da-fA-F]*[pP][+-]?%d+") or rest:match("^0[xX][%da-fA-F]+%.?[%da-fA-F]*") or rest:match("^%d+%.%d*[eE][+-]?%d+") or rest:match("^%d+%.%d*") or rest:match("^%d+[eE][+-]?%d+") or rest:match("^%d+") or rest:match("^%.%d+[eE][+-]?%d+") or rest:match("^%.%d+"); if not v then fail("bad number") end; add("num",v); i=i+#v
    else local v=s:sub(i,i+2); if v=="..." then add("sym",v); i=i+3 else v=s:sub(i,i+1); if v==".." or v=="//" or v=="<<" or v==">>" or v=="==" or v=="~=" or v=="<=" or v==">=" or v=="::" then add("sym",v); i=i+2 else add("sym",c); i=i+1 end end end
  end; t[#t+1]={k="eof",v="<eof>"}; return t
end
local function fresh(n) local s=""; repeat s=string.char(97+n%26)..s; n=math.floor(n/26)-1 until n<0; return "_"..s end
function M.minify(source)
  source=source:gsub("^\239\187\191",""); local t=lex(source); local p, scopes, serial=1,{},0; local used={}
  for _,x in ipairs(t) do if x.k=="id" then used[x.v]=true end end
  local function tok() return t[p] end; local function is(v) return tok().v==v end
  local function take(v) if not is(v) then fail("expected '"..v.."', got '"..tok().v.."'") end local x=tok();p=p+1;return x end
  local function scope() scopes[#scopes+1]={} end; local function unscope() scopes[#scopes]=nil end
  local function resolve(x) for n=#scopes,1,-1 do local y=scopes[n][x.v]; if y then x.v=y; return end end end
  local function bind(x, keep) local v=x.v; if not keep and v~="_ENV" then repeat v=fresh(serial);serial=serial+1 until not used[v]; used[v]=true end; scopes[#scopes][x.v]=v; x.v=v end
  local parse_exp, parse_block, parse_func
  local unary={['not']=1,['-']=1,['#']=1,['~']=1}; local prec={['or']=1,['and']=2,['<']=3,['>']=3,['<=']=3,['>=']=3,['~=']=3,['==']=3,['|']=4,['~']=5,['&']=6,['<<']=7,['>>']=7,['..']=8,['+']=9,['-']=9,['*']=10,['/']=10,['//']=10,['%']=10,['^']=12}
  local tablector
  local function args()
    if is("(") then take("("); if not is(")") then parse_exp(0); while is(",") do take(",");parse_exp(0) end end;take(")")
    elseif tok().k=="lit" then p=p+1
    elseif is("{") then tablector()
    else return false end
    return true
  end
  local function prefix()
    if tok().k=="id" then resolve(tok());p=p+1
    elseif is("(") then take("(");parse_exp(0);take(")")
    else return false end
    while true do if is(".") then take("."); if tok().k~="id" then fail("field expected") end;p=p+1
      elseif is("[") then take("[");parse_exp(0);take("]")
      elseif is(":") then take(":"); if tok().k~="id" then fail("method expected") end;p=p+1; if not args() then fail("method arguments expected") end
      elseif is("(") or tok().k=="lit" or is("{") then if not args() then return true end
      else break end end; return true
  end
  tablector = function()
    take("{"); while not is("}") do if is("[") then take("[");parse_exp(0);take("]");take("=");parse_exp(0)
      elseif tok().k=="id" and t[p+1].v=="=" then p=p+1;take("=");parse_exp(0)
      else parse_exp(0) end; if is(",") or is(";") then p=p+1 elseif not is("}") then fail("table field separator expected") end end;take("}")
  end
  function parse_func(method, consumed)
    if not consumed then take("function") end;take("(");scope(); if method then local x={v="self"}; bind(x,true) end
    if not is(")") then while true do if is("...") then p=p+1;break end; if tok().k~="id" then fail("parameter expected") end; bind(tok());p=p+1;if not is(",") then break end;take(",") end end;take(")");parse_block({end_=true});take("end");unscope()
  end
  local function primary()
    if tok().k=="num" or tok().k=="lit" or tok().k=="hash" or is("nil") or is("true") or is("false") or is("...") then p=p+1
    elseif is("function") then parse_func(false)
    elseif is("{") then tablector()
    elseif prefix() then else fail("expression expected near '"..tok().v.."'") end
  end
  function parse_exp(min)
    if unary[tok().v] then p=p+1;parse_exp(11) else primary() end
    while prec[tok().v] and prec[tok().v]>=min do local op=tok().v;local q=prec[op];p=p+1;parse_exp(q+((op=="^" or op=="..") and 0 or 1)) end
  end
  local function explist() parse_exp(0);while is(",")do take(",");parse_exp(0)end end
  local function statement()
    if is(";") then p=p+1
    elseif is("local") then take("local"); if is("function") then take("function");if tok().k~="id"then fail("local function name expected")end; local x=tok();bind(x);p=p+1;parse_func(false,true)
      else local names={};repeat if tok().k~="id"then fail("local name expected")end;names[#names+1]=tok();p=p+1;if not is(",")then break end;take(",")until false;if is("=")then take("=");explist()end;for _,x in ipairs(names)do bind(x)end end
    elseif is("function") then take("function");if tok().k~="id"then fail("function target expected")end;resolve(tok());p=p+1;local method=false;while is(".")or is(":")do local sep=tok().v;p=p+1;if tok().k~="id"then fail("function field expected")end;p=p+1;method=sep==":"end;parse_func(method,true)
    elseif is("do") then take("do");scope();parse_block({end_=true});take("end");unscope()
    elseif is("while") then take("while");parse_exp(0);take("do");scope();parse_block({end_=true});take("end");unscope()
    elseif is("repeat") then take("repeat");scope();parse_block({until_=true});take("until");parse_exp(0);unscope()
    elseif is("if") then take("if");parse_exp(0);take("then");scope();parse_block({else_=true,elseif_=true,end_=true});unscope();while is("elseif")do take("elseif");parse_exp(0);take("then");scope();parse_block({else_=true,elseif_=true,end_=true});unscope()end;if is("else")then take("else");scope();parse_block({end_=true});unscope()end;take("end")
    elseif is("for") then take("for");local names={};if tok().k~="id"then fail("for name expected")end;names[1]=tok();p=p+1;while is(",")do take(",");if tok().k~="id"then fail("for name expected")end;names[#names+1]=tok();p=p+1 end;if is("=")then take("=");explist()elseif is("in")then take("in");explist()else fail("for '=' or 'in' expected")end;take("do");scope();for _,x in ipairs(names)do bind(x)end;parse_block({end_=true});take("end");unscope()
    elseif is("return") then p=p+1;if not is("end")and not is("else")and not is("elseif")and not is("until")and not is(";")and tok().k~="eof"then explist()end
    elseif is("break") or is("goto") then p=p+1;if t[p-1].v=="goto"then if tok().k~="id"then fail("label expected")end;p=p+1 end
    elseif is("::") then take("::");if tok().k~="id"then fail("label expected")end;p=p+1;take("::")
    else if not prefix() then fail("statement expected near '"..tok().v.."'") end;if is("=")or is(",")then while is(",")do take(",");if not prefix()then fail("assignment target expected")end end;take("=");explist() end end
  end
  function parse_block(stop) while tok().k~="eof" and not(stop.end_ and is("end"))and not(stop.else_ and is("else"))and not(stop.elseif_ and is("elseif"))and not(stop.until_ and is("until"))do statement()end end
  scope();parse_block({});if tok().k~="eof"then fail("unexpected token")end;unscope()
  local out,last={},nil
  for i=1,#t-1 do
    local x=t[i]
    if last then
      local ok,pair=pcall(lex,last.v..x.v)
      local wordEnd=last.k=="id" or last.k=="kw" or last.k=="num"
      local wordStart=x.k=="id" or x.k=="kw" or x.k=="num"
      if (wordEnd and wordStart) or not ok or #pair~=3 or pair[1].v~=last.v or pair[2].v~=x.v then out[#out+1]=" " end
    end
    out[#out+1]=x.v;last=x
  end
  -- Compile only: hashes are numeric literals in CfxLua. The substituted text
  -- is used for validation, never executed or returned to the caller.
  local check={};for i=1,#t-1 do check[i]=t[i].k=="hash" and "0" or t[i].v end
  local valid,err=load(table.concat(check," "),"minified syntax","t",{})
  if not valid then fail(err) end
  return table.concat(out).."\n"
end
return M
