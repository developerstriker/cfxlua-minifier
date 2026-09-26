"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { minify, lex } = require("../src/minifier.cjs");

test("lex exposes zero-based JS offsets and preserves literal bytes", () => {
  const source = "a=`\x80x`; -- c\n b"; const tokens = lex(source);
  assert.deepEqual(tokens, [{ kind: "identifier", value: "a", start: 0, end: 1 }, { kind: "symbol", value: "=", start: 1, end: 2 }, { kind: "hash", value: "`\x80x`", start: 2, end: 6 }, { kind: "symbol", value: ";", start: 6, end: 7 }, { kind: "identifier", value: "b", start: 14, end: 15 }, { kind: "eof", value: "<eof>", start: 15, end: 15 }]);
});

test("renames locals while RHS resolves in the source scope", () => {
  assert.equal(minify("local source=source or 3;return source"), "local _a=source or 3;return _a\n");
  assert.equal(minify("local value=2;local value,f=3,function()return value end;return value,f()"), "local _a=2;local _b,_c=3,function()return _a end;return _b,_c()\n");
});

test("handles nested scopes, closures, loops, implicit self and _ENV", () => {
  const source = "local x=1;do local x=2 end;local function f(y)return x+y end;local n=0;for i=1,3 do n=n+i end;local t={};function t:add(v)return self.base+v end;t.base=7;local _ENV={value=12};local value=3;return f(n),t:add(2),_ENV.value+value";
  assert.equal(minify(source), "local _a=1;do local _b=2 end;local function _c(_d)return _a+_d end;local _e=0;for _f=1,3 do _e=_e+_f end;local _g={};function _g:add(_h)return self.base+_h end;_g.base=7;local _ENV={value=12};local _i=3;return _c(_e),_g:add(2),_ENV.value+_i\n");
});

test("preserves strings, long strings, hashes, and required token separators", () => {
  const source = "local s='a\\\\b';local l=[=[x\\ny]=];local h=`adder`;return s..l,h,1..2,3- -2";
  const result = minify(source); assert.match(result, /'a\\\\b'/); assert.match(result, /\[=\[x\\ny\]=\]/); assert.match(result, /`adder`/); assert.match(result, /1 \.\.2/); assert.match(result, /3- -2/);
  assert.equal(minify("local t={};return t [=[x]=]"), "local _a={};return _a[=[x]=]\n");
  assert.equal(minify("local t={};return t[ [=[x]=] ]"), "local _a={};return _a[ [=[x]=]]\n");
});

test("rejects malformed and explicitly unsupported syntax", () => {
  for (const source of ["local x='unterminated", "local x=[[bad", "local x=`bad", "local x=", "local x <const> = 1", "local x=1;return x; x=2", "if true then return 1", "x", "t.x", "...", "break", "while true do function f() break end end"]) assert.throws(() => minify(source), /minifier:/);
});
