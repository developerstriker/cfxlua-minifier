"use strict";

// Scope-aware Lua 5.4 / CfxLua source minifier.  Source is treated as a JS
// string (the builder supplies Latin-1), so literal bytes are never decoded.
const keywords = new Set(["and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"]);
const fail = message => { throw new SyntaxError(`minifier: ${message}`); };

function lex(source) {
  if (typeof source !== "string") throw new TypeError("minifier: source must be a string");
  const tokens = []; let i = 0;
  const add = (kind, start, end) => tokens.push({ kind, value: source.slice(start, end), start, end });
  const long = at => {
    const m = /^\[(=*)\[/.exec(source.slice(at)); if (!m) return null;
    const close = `]${m[1]}]`, end = source.indexOf(close, at + m[0].length);
    if (end < 0) fail("unterminated long string/comment");
    return end + close.length;
  };
  while (i < source.length) {
    const start = i, c = source[i];
    // Lua's whitespace class is ASCII; do not accidentally discard a Latin-1
    // source byte such as 0xA0 while operating on builder-provided strings.
    if (/[ \f\n\r\t\v]/.test(c)) { i++; continue; }
    if (c === "-" && source[i + 1] === "-") { const end = long(i + 2); i = end ?? (() => { const n = source.indexOf("\n", i + 2); return n < 0 ? source.length : n; })(); continue; }
    if (c === "'" || c === '"') { i++; let closed = false; while (i < source.length) { if (source[i] === "\\") i += 2; else if (source[i++] === c) { closed = true; break; } } if (!closed) fail("unterminated string"); add("literal", start, i); continue; }
    if (c === "[") { const end = long(i); if (end) { add("literal", start, end); i = end; } else { add("symbol", i, ++i); } continue; }
    if (c === "`") { const end = source.indexOf("`", i + 1); if (end < 0) fail("unterminated hash literal"); i = end + 1; add("hash", start, i); continue; }
    if (/[A-Za-z_]/.test(c)) { i++; while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i++; add(keywords.has(source.slice(start, i)) ? "keyword" : "identifier", start, i); continue; }
    if (/\d/.test(c) || (c === "." && /\d/.test(source[i + 1] || ""))) {
      const rest = source.slice(i);
      const m = /^(?:0[xX][\da-fA-F]+\.(?!\.)[\da-fA-F]*[pP][+-]?\d+|0[xX][\da-fA-F]+\.(?!\.)[\da-fA-F]*|0[xX][\da-fA-F]+[pP][+-]?\d+|0[xX][\da-fA-F]+|\d+\.(?!\.)\d*[eE][+-]?\d+|\d+\.(?!\.)\d*|\d+[eE][+-]?\d+|\d+|\.\d+[eE][+-]?\d+|\.\d+)/.exec(rest);
      if (!m) fail("bad number"); i += m[0].length; add("number", start, i); continue;
    }
    const three = source.slice(i, i + 3), two = source.slice(i, i + 2);
    if (three === "...") { i += 3; add("symbol", start, i); }
    else if (["..", "//", "<<", ">>", "==", "~=", "<=", ">=", "::"].includes(two)) { i += 2; add("symbol", start, i); }
    else { i++; add("symbol", start, i); }
  }
  tokens.push({ kind: "eof", value: "<eof>", start: source.length, end: source.length });
  return tokens;
}

const fresh = n => { let s = ""; do { s = String.fromCharCode(97 + n % 26) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return `_${s}`; };

function minify(source) {
  source = source.replace(/^\uFEFF/, ""); const t = lex(source); let p = 0, serial = 0; const scopes = [], used = new Set(t.filter(x => x.kind === "identifier").map(x => x.value));
  const tok = () => t[p], is = v => tok().value === v, take = v => { if (!is(v)) fail(`expected '${v}', got '${tok().value}'`); return t[p++]; };
  const scope = () => scopes.push(new Map()), unscope = () => scopes.pop();
  const resolve = x => { for (let n = scopes.length - 1; n >= 0; n--) { const v = scopes[n].get(x.value); if (v) { x.value = v; return; } } };
  const bind = (x, keep = false) => { const original = x.value; let v = original; if (!keep && v !== "_ENV") { do v = fresh(serial++); while (used.has(v)); used.add(v); } scopes.at(-1).set(original, v); x.value = v; };
  const unary = new Set(["not", "-", "#", "~"]), prec = { or: 1, and: 2, "<": 3, ">": 3, "<=": 3, ">=": 3, "~=": 3, "==": 3, "|": 4, "~": 5, "&": 6, "<<": 7, ">>": 7, "..": 8, "+": 9, "-": 9, "*": 10, "/": 10, "//": 10, "%": 10, "^": 12 };
  let parseExp, parseBlock, parseFunc, tableCtor, loopDepth = 0;
  // Lua chunks are variadic too; nested non-variadic functions are not.
  const varargContexts = [true];
  const args = () => { if (is("(")) { take("("); if (!is(")")) { parseExp(0); while (is(",")) { take(","); parseExp(0); } } take(")"); } else if (tok().kind === "literal") p++; else if (is("{")) tableCtor(); else return false; return true; };
  const prefix = () => { let call = false; if (tok().kind === "identifier") { resolve(tok()); p++; } else if (is("(")) { take("("); parseExp(0); take(")"); } else return false; while (true) { if (is(".")) { take("."); if (tok().kind !== "identifier") fail("field expected"); p++; } else if (is("[")) { take("["); parseExp(0); take("]"); } else if (is(":")) { take(":"); if (tok().kind !== "identifier") fail("method expected"); p++; if (!args()) fail("method arguments expected"); call = true; } else if (is("(") || tok().kind === "literal" || is("{")) { args(); call = true; } else break; } return { call }; };
  tableCtor = () => { take("{"); while (!is("}")) { if (tok().kind === "eof") fail("unterminated table constructor"); if (is("[")) { take("["); parseExp(0); take("]"); take("="); parseExp(0); } else if (tok().kind === "identifier" && t[p + 1].value === "=") { p++; take("="); parseExp(0); } else parseExp(0); if (is(",") || is(";")) p++; else if (!is("}")) fail("table field separator expected"); } take("}"); };
  parseFunc = (method, consumed = false) => { if (!consumed) take("function"); take("("); scope(); const outerLoops = loopDepth; loopDepth = 0; varargContexts.push(false); if (method) bind({ value: "self" }, true); if (!is(")")) while (true) { if (is("...")) { varargContexts[varargContexts.length - 1] = true; p++; break; } if (tok().kind !== "identifier") fail("parameter expected"); bind(tok()); p++; if (!is(",")) break; take(","); } take(")"); parseBlock({ end: true }); take("end"); varargContexts.pop(); loopDepth = outerLoops; unscope(); };
  const primary = () => { if (["number", "literal", "hash"].includes(tok().kind) || ["nil", "true", "false"].includes(tok().value)) p++; else if (is("...")) { if (!varargContexts.at(-1)) fail("vararg outside a variadic function"); p++; } else if (is("function")) parseFunc(false); else if (is("{")) tableCtor(); else if (!prefix()) fail(`expression expected near '${tok().value}'`); };
  parseExp = min => { if (unary.has(tok().value)) { p++; parseExp(11); } else primary(); while (prec[tok().value] >= min) { const op = tok().value, q = prec[op]; p++; parseExp(q + (["^", ".."].includes(op) ? 0 : 1)); } };
  const expList = () => { parseExp(0); while (is(",")) { take(","); parseExp(0); } };
  const statement = () => { if (is(";")) p++; else if (is("local")) { take("local"); if (is("function")) { take("function"); if (tok().kind !== "identifier") fail("local function name expected"); const x = tok(); bind(x); p++; parseFunc(false, true); } else { const names = []; do { if (tok().kind !== "identifier") fail("local name expected"); names.push(tok()); p++; if (!is(",")) break; take(","); } while (true); if (is("=")) { take("="); expList(); } for (const x of names) bind(x); } } else if (is("function")) { take("function"); if (tok().kind !== "identifier") fail("function target expected"); resolve(tok()); p++; let method = false; while (is(".") || is(":")) { const sep = tok().value; p++; if (tok().kind !== "identifier") fail("function field expected"); p++; method = sep === ":"; } parseFunc(method, true); } else if (is("do") || is("while")) { const whileLoop = is("while"); p++; if (whileLoop) { parseExp(0); take("do"); loopDepth++; } scope(); parseBlock({ end: true }); take("end"); unscope(); if (whileLoop) loopDepth--; } else if (is("repeat")) { p++; scope(); loopDepth++; parseBlock({ until: true }); take("until"); parseExp(0); loopDepth--; unscope(); } else if (is("if")) { p++; parseExp(0); take("then"); scope(); parseBlock({ else: true, elseif: true, end: true }); unscope(); while (is("elseif")) { p++; parseExp(0); take("then"); scope(); parseBlock({ else: true, elseif: true, end: true }); unscope(); } if (is("else")) { p++; scope(); parseBlock({ end: true }); unscope(); } take("end"); } else if (is("for")) { p++; const names = []; do { if (tok().kind !== "identifier") fail("for name expected"); names.push(tok()); p++; if (!is(",")) break; take(","); } while (true); if (is("=")) { take("="); expList(); } else if (is("in")) { take("in"); expList(); } else fail("for '=' or 'in' expected"); take("do"); scope(); loopDepth++; for (const x of names) bind(x); parseBlock({ end: true }); take("end"); loopDepth--; unscope(); } else if (is("return")) { p++; if (!["end", "else", "elseif", "until", ";", "<eof>"].includes(tok().value)) expList(); if (is(";")) p++; return true; } else if (is("break") || is("goto")) { const goto = is("goto"); if (!goto && loopDepth === 0) fail("break outside a loop"); p++; if (goto) { if (tok().kind !== "identifier") fail("label expected"); p++; } } else if (is("::")) { p++; if (tok().kind !== "identifier") fail("label expected"); p++; take("::"); } else { const target = prefix(); if (!target) fail(`statement expected near '${tok().value}'`); if (is("=") || is(",")) { while (is(",")) { p++; if (!prefix()) fail("assignment target expected"); } take("="); expList(); } else if (!target.call) fail("expression statements must be function calls"); } return false; };
  parseBlock = stop => { let terminal = false; while (tok().kind !== "eof" && !(stop.end && is("end")) && !(stop.else && is("else")) && !(stop.elseif && is("elseif")) && !(stop.until && is("until"))) { if (terminal) fail(`unexpected token after return near '${tok().value}'`); terminal = statement(); } };
  scope(); parseBlock({}); if (tok().kind !== "eof") fail("unexpected token"); unscope();
  let out = "", last = null; for (const x of t.slice(0, -1)) { if (last) { let pair; try { pair = lex(last.value + x.value); } catch { pair = null; } const words = /^(identifier|keyword|number)$/.test(last.kind) && /^(identifier|keyword|number)$/.test(x.kind); const numericConcat = last.kind === "number" && x.value === ".."; if (words || numericConcat || !pair || pair.length !== 3 || pair[0].value !== last.value || pair[1].value !== x.value) out += " "; } out += x.value; last = x; } return out + "\n";
}

module.exports = { minify, lex };
