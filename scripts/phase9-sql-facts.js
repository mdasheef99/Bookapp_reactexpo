#!/usr/bin/env node
/*
 * Read-only SQL function facts sheet.
 *
 *   node scripts/phase9-sql-facts.js <name-or-substring> [more...] [--json]
 *   node scripts/phase9-sql-facts.js --summary
 *
 * It reads the `*.sql` files directly in supabase/migrations, in file-name
 * order, and quotes the CURRENT definition of each requested function from
 * the latest migration that creates it. It never reads the database, writes
 * a file, or computes effective privileges across migrations.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TAG_RE = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;
const CREATE_STMT_RE = /^create\s+(or\s+replace\s+)?function\b/i;
const DROP_STMT_RE = /^drop\s+function\s+(if\s+exists\s+)?/i;
const ALTER_STMT_RE = /^alter\s+function\s+/i;
const DO_STMT_RE = /^do\b/i;
const EXECUTE_STMT_RE = /^execute\b/i;

const TYPE_START = new Set([
  'timestamp', 'time', 'double', 'character', 'bit', 'interval', 'national',
  'numeric', 'decimal', 'int', 'integer', 'smallint', 'bigint', 'real',
  'text', 'boolean', 'bool', 'uuid', 'jsonb', 'json', 'bytea', 'date',
  'void', 'trigger', 'record', 'varchar', 'char', 'name', 'oid', 'regclass',
  'regprocedure', 'inet', 'cidr', 'macaddr', 'money', 'xml', 'tsvector',
  'tsquery', 'public', 'marketplace_sec', 'auth', 'storage', 'pg_catalog',
]);

function normalizeText(text) {
  return String(text).replace(/\r\n?/g, '\n');
}

function makeLineOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return (index) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= index) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}

function maskText(text, opts) {
  const options = opts || {};
  const maskComments = options.maskComments !== false;
  const maskSingle = options.maskSingle !== false;
  const maskDouble = options.maskDouble !== false;
  const maskDollar = options.maskDollar !== false;
  const out = text.split('');
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    if (c === '-' && c2 === '-') {
      if (!maskComments) {
        while (i < n && text[i] !== '\n') i += 1;
        continue;
      }
      while (i < n && text[i] !== '\n') { out[i] = ' '; i += 1; }
      continue;
    }
    if (c === '/' && c2 === '*') {
      const start = i;
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (text[i] === '/' && text[i + 1] === '*') { depth += 1; i += 2; continue; }
        if (text[i] === '*' && text[i + 1] === '/') { depth -= 1; i += 2; continue; }
        i += 1;
      }
      if (maskComments) {
        for (let k = start; k < i; k += 1) if (text[k] !== '\n') out[k] = ' ';
      }
      continue;
    }
    if (c === "'") {
      const start = i;
      i += 1;
      while (i < n) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") { i += 1; break; }
        i += 1;
      }
      if (maskSingle) {
        for (let k = start; k < i; k += 1) if (text[k] !== '\n') out[k] = ' ';
      }
      continue;
    }
    if (c === '"') {
      const start = i;
      i += 1;
      while (i < n) {
        if (text[i] === '"' && text[i + 1] === '"') { i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      if (maskDouble) {
        for (let k = start; k < i; k += 1) if (text[k] !== '\n') out[k] = ' ';
      }
      continue;
    }
    if (c === '$') {
      const match = TAG_RE.exec(text.slice(i));
      if (match) {
        const tag = match[0];
        const close = text.indexOf(tag, i + tag.length);
        if (close === -1) {
          if (maskDollar) {
            for (let k = i; k < n; k += 1) if (text[k] !== '\n') out[k] = ' ';
          }
          i = n;
          continue;
        }
        if (maskDollar) {
          for (let k = i; k < close + tag.length; k += 1) if (text[k] !== '\n') out[k] = ' ';
        }
        i = close + tag.length;
        continue;
      }
    }
    i += 1;
  }
  return out.join('');
}

function findMatchingParen(text, open) {
  let depth = 0;
  let i = open;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '-' && text[i + 1] === '-') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      let block = 1;
      i += 2;
      while (i < n && block > 0) {
        if (text[i] === '/' && text[i + 1] === '*') { block += 1; i += 2; continue; }
        if (text[i] === '*' && text[i + 1] === '/') { block -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (text[i] === '"' && text[i + 1] === '"') { i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '$') {
      const match = TAG_RE.exec(text.slice(i));
      if (match) {
        const tag = match[0];
        const close = text.indexOf(tag, i + tag.length);
        i = close === -1 ? n : close + tag.length;
        continue;
      }
    }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function splitTopLevel(text, separator) {
  const parts = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '-' && text[i + 1] === '-') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      let block = 1;
      i += 2;
      while (i < n && block > 0) {
        if (text[i] === '/' && text[i + 1] === '*') { block += 1; i += 2; continue; }
        if (text[i] === '*' && text[i + 1] === '/') { block -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (text[i] === '"' && text[i + 1] === '"') { i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '$') {
      const match = TAG_RE.exec(text.slice(i));
      if (match) {
        const tag = match[0];
        const close = text.indexOf(tag, i + tag.length);
        i = close === -1 ? n : close + tag.length;
        continue;
      }
    }
    if (c === '(') paren += 1;
    else if (c === ')') paren -= 1;
    else if (c === '[') bracket += 1;
    else if (c === ']') bracket -= 1;
    else if (c === separator && paren === 0 && bracket === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  parts.push(text.slice(start));
  return parts;
}

function findTopLevelKeyword(text, keyword, from) {
  const start = from || 0;
  const upper = keyword.toUpperCase();
  let paren = 0;
  let bracket = 0;
  let i = start;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '-' && text[i + 1] === '-') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      let block = 1;
      i += 2;
      while (i < n && block > 0) {
        if (text[i] === '/' && text[i + 1] === '*') { block += 1; i += 2; continue; }
        if (text[i] === '*' && text[i + 1] === '/') { block -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (text[i] === '"' && text[i + 1] === '"') { i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '$') {
      const match = TAG_RE.exec(text.slice(i));
      if (match) {
        const tag = match[0];
        const close = text.indexOf(tag, i + tag.length);
        i = close === -1 ? n : close + tag.length;
        continue;
      }
    }
    if (c === '(') { paren += 1; i += 1; continue; }
    if (c === ')') { paren -= 1; i += 1; continue; }
    if (c === '[') { bracket += 1; i += 1; continue; }
    if (c === ']') { bracket -= 1; i += 1; continue; }
    if (paren === 0 && bracket === 0 && /[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(text[j])) j += 1;
      if (text.slice(i, j).toUpperCase() === upper) return i;
      i = j;
      continue;
    }
    i += 1;
  }
  return -1;
}

function stripComments(text) {
  return maskText(text, { maskComments: true, maskSingle: false, maskDouble: false, maskDollar: false });
}

function normalizeType(type) {
  return type
    .replace(/\s+/g, ' ')
    .replace(/\s*\[\s*/g, '[')
    .replace(/\s*\]/g, ']')
    .trim()
    .toLowerCase();
}

function typeStartToken(token) {
  return token.toLowerCase().replace(/\[.*$/, '').replace(/\(.*$/, '');
}

function isKnownMultiwordType(type) {
  const t = normalizeType(type);
  return /^timestamp(\(\d+\))? (with|without) time zone$/.test(t)
    || /^time(\(\d+\))? (with|without) time zone$/.test(t)
    || /^double precision$/.test(t)
    || /^character varying(\(\d+\))?$/.test(t)
    || /^bit varying(\(\d+\))?$/.test(t)
    || /^national character( varying)?(\(\d+\))?$/.test(t)
    || /^interval( .+)?$/.test(t);
}

function parseArguments(argText) {
  const parts = splitTopLevel(argText, ',');
  const types = [];
  for (const part of parts) {
    let raw = stripComments(part).trim();
    if (!raw) continue;
    const mode = /^(in|out|inout|variadic)\b/i.exec(raw);
    if (mode) {
      const kind = mode[1].toLowerCase();
      if (kind === 'out' || kind === 'inout' || kind === 'variadic') {
        return { error: 'argument mode ' + kind };
      }
      raw = raw.slice(mode[0].length).trim();
    }
    if (!raw) return { error: 'empty argument' };
    const defaultIndex = findTopLevelKeyword(raw, 'DEFAULT');
    const head = (defaultIndex === -1 ? raw : raw.slice(0, defaultIndex)).trim();
    if (!head) return { error: 'empty argument type' };
    if (head.indexOf('"') !== -1) return { error: 'quoted identifier in argument' };
    const tokens = head.split(/\s+/).filter(Boolean);
    let type;
    if (tokens.length === 1) {
      type = tokens[0];
    } else if (TYPE_START.has(typeStartToken(tokens[0]))) {
      type = tokens.join(' ');
    } else {
      type = tokens.slice(1).join(' ');
      if (!type) return { error: 'missing argument type' };
    }
    const normalized = normalizeType(type);
    if (!normalized) return { error: 'empty argument type' };
    if (normalized.indexOf(' ') !== -1 && !isKnownMultiwordType(normalized)) {
      return { error: 'ambiguous multi-word type: ' + normalized };
    }
    types.push(normalized);
  }
  return { types };
}

function makeIdentity(schema, name, types) {
  return schema + '.' + name + '(' + types.join(',') + ')';
}

function parseOneIdentity(text) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\(/.exec(text);
  if (!match) return null;
  const schema = (match[2] ? match[1] : 'public').toLowerCase();
  const name = (match[2] ? match[2] : match[1]).toLowerCase();
  const open = match[0].length - 1;
  const close = findMatchingParen(text, open);
  if (close === -1) return null;
  const argText = text.slice(open + 1, close);
  const types = [];
  for (const part of splitTopLevel(argText, ',')) {
    const raw = stripComments(part).trim();
    if (!raw) continue;
    if (raw.indexOf('"') !== -1) return null;
    if (/^(in|out|inout|variadic)\b/i.test(raw)) return null;
    const tokens = raw.split(/\s+/).filter(Boolean);
    let type;
    if (tokens.length === 1) {
      type = tokens[0];
    } else {
      if (!TYPE_START.has(typeStartToken(tokens[0]))) return null;
      type = tokens.join(' ');
    }
    const normalized = normalizeType(type);
    if (!normalized) return null;
    if (normalized.indexOf(' ') !== -1 && !isKnownMultiwordType(normalized)) return null;
    types.push(normalized);
  }
  return { schema, name, types, identity: makeIdentity(schema, name, types), end: close + 1 };
}

function findBodyOpener(text, from) {
  let i = from;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '-' && text[i + 1] === '-') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      let block = 1;
      i += 2;
      while (i < n && block > 0) {
        if (text[i] === '/' && text[i + 1] === '*') { block += 1; i += 2; continue; }
        if (text[i] === '*' && text[i + 1] === '/') { block -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (text[i] === '"' && text[i + 1] === '"') { i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '$') {
      const match = TAG_RE.exec(text.slice(i));
      if (match) {
        const close = text.indexOf(match[0], i + match[0].length);
        i = close === -1 ? n : close + match[0].length;
        continue;
      }
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(text[j])) j += 1;
      if (text.slice(i, j).toUpperCase() === 'AS') {
        let k = j;
        let moved = true;
        while (moved) {
          moved = false;
          while (k < n && /\s/.test(text[k])) { k += 1; moved = true; }
          if (text[k] === '-' && text[k + 1] === '-') {
            while (k < n && text[k] !== '\n') k += 1;
            moved = true;
          } else if (text[k] === '/' && text[k + 1] === '*') {
            let block = 1;
            k += 2;
            while (k < n && block > 0) {
              if (text[k] === '/' && text[k + 1] === '*') { block += 1; k += 2; continue; }
              if (text[k] === '*' && text[k + 1] === '/') { block -= 1; k += 2; continue; }
              k += 1;
            }
            moved = true;
          }
        }
        const tag = TAG_RE.exec(text.slice(k));
        if (tag) return { tag: tag[0], tagStart: k, end: k + tag[0].length };
        return null;
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return null;
}

function readSingleQuoted(text, index) {
  if (text[index] !== "'") return null;
  let i = index + 1;
  let value = '';
  while (i < text.length) {
    if (text[i] === "'" && text[i + 1] === "'") { value += "'"; i += 2; continue; }
    if (text[i] === "'") return { value, end: i + 1 };
    value += text[i];
    i += 1;
  }
  return null;
}

function extractRaises(body, bodyStartAbsolute, lineOf, file) {
  const masked = maskText(body, { maskComments: true, maskSingle: true, maskDouble: true, maskDollar: true });
  const re = /raise\s+exception\b/gi;
  const out = [];
  const seen = new Set();
  let match;
  while ((match = re.exec(masked))) {
    let i = match.index + match[0].length;
    let moved = true;
    while (moved) {
      moved = false;
      while (i < body.length && /\s/.test(body[i])) { i += 1; moved = true; }
      if (body[i] === '-' && body[i + 1] === '-') {
        while (i < body.length && body[i] !== '\n') i += 1;
        moved = true;
      } else if (body[i] === '/' && body[i + 1] === '*') {
        let block = 1;
        i += 2;
        while (i < body.length && block > 0) {
          if (body[i] === '/' && body[i + 1] === '*') { block += 1; i += 2; continue; }
          if (body[i] === '*' && body[i + 1] === '/') { block -= 1; i += 2; continue; }
          i += 1;
        }
        moved = true;
      }
    }
    const dynamic = '(dynamic) ' + file + ':' + lineOf(bodyStartAbsolute + match.index);
    if (body[i] === "'") {
      const literal = readSingleQuoted(body, i);
      if (!literal) { out.push(dynamic); continue; }
      if (!seen.has(literal.value)) {
        seen.add(literal.value);
        out.push(literal.value);
      }
    } else {
      out.push(dynamic);
    }
  }
  return out;
}

function parseCreateStatement(stmt, lineOf, file) {
  const match = /^create\s+(or\s+replace\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\(/i.exec(stmt.masked);
  if (!match) return { error: 'name or ( not readable on the CREATE line' };
  const schema = (match[3] ? match[2] : 'public').toLowerCase();
  const name = (match[3] ? match[3] : match[2]).toLowerCase();
  const open = match[0].length - 1;
  const close = findMatchingParen(stmt.text, open);
  if (close === -1) return { error: 'unterminated argument list' };
  const args = parseArguments(stmt.text.slice(open + 1, close));
  if (args.error) return { error: args.error };
  const opener = findBodyOpener(stmt.text, close + 1);
  if (!opener) return { error: 'no AS $tag$ body opener' };
  const closeTag = stmt.text.indexOf(opener.tag, opener.end);
  if (closeTag === -1) return { error: 'unterminated dollar body' };
  return {
    schema,
    name,
    types: args.types,
    identity: makeIdentity(schema, name, args.types),
    header: stmt.text.slice(0, opener.end).replace(/\s+/g, ' ').trim(),
    tag: opener.tag,
    tagStart: opener.tagStart,
    body: stmt.text.slice(opener.end, closeTag),
    bodyStart: opener.end,
    line: lineOf(stmt.start),
    raises: extractRaises(stmt.text.slice(opener.end, closeTag), stmt.start + opener.end, lineOf, file),
  };
}

function parseDropStatement(stmt) {
  const match = /^drop\s+function\s+(if\s+exists\s+)?/i.exec(stmt.masked);
  if (!match) return null;
  return parseOneIdentity(stmt.text.slice(match[0].length));
}

function parseAlterStatement(stmt) {
  const match = /^alter\s+function\s+/i.exec(stmt.masked);
  if (!match) return null;
  const id = parseOneIdentity(stmt.text.slice(match[0].length));
  if (!id) return null;
  const rest = stmt.text.slice(match[0].length + id.end);
  const rename = /^\s*rename\s+to\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(rest);
  if (rename) return { id, action: 'rename', to: rename[1].toLowerCase() };
  if (/^\s*owner\s+to\b/i.test(rest)) return { id, action: 'owner' };
  if (/^\s*set\s+schema\b/i.test(rest)) return { id, action: 'set_schema' };
  return { id, action: 'other' };
}

function parseIdentityList(text) {
  const ids = [];
  for (const part of splitTopLevel(text, ',')) {
    if (!part.trim()) continue;
    const id = parseOneIdentity(part);
    if (!id) return null;
    ids.push(id);
  }
  return ids.length ? ids : null;
}

function parseGrantStatement(stmt) {
  const match = /^(revoke|grant)\b[\s\S]*?\bon\s+function\b/i.exec(stmt.masked);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const listStart = match[0].length;
  const endWord = kind === 'revoke' ? 'FROM' : 'TO';
  const endIndex = findTopLevelKeyword(stmt.text, endWord, listStart);
  if (endIndex === -1) return null;
  const ids = parseIdentityList(stmt.text.slice(listStart, endIndex));
  if (!ids) return null;
  return { kind, ids };
}

function splitStatements(text, masked) {
  const statements = [];
  let start = 0;
  for (let i = 0; i <= masked.length; i += 1) {
    if (i !== masked.length && masked[i] !== ';') continue;
    const maskedStatement = masked.slice(start, i);
    const trimmed = maskedStatement.trimStart();
    if (trimmed.length > 0) {
      const offset = start + (maskedStatement.length - trimmed.length);
      statements.push({ start: offset, text: text.slice(offset, i), masked: masked.slice(offset, i) });
    }
    start = i + 1;
  }
  return statements;
}

function scanTextForCreateWords(text, absoluteStart, file, lineOf, reason, add) {
  const masked = maskText(text, { maskComments: true, maskSingle: true, maskDouble: true, maskDollar: true });
  const re = /create\s+(or\s+replace\s+)?function/gi;
  let match;
  while ((match = re.exec(masked))) {
    add({ file, line: lineOf(absoluteStart + match.index), reason });
  }
}

function scanDoStatement(stmt, file, lineOf, add) {
  const match = /^do\b/i.exec(stmt.text);
  if (!match) return;
  let i = match[0].length;
  while (i < stmt.text.length) {
    const tag = TAG_RE.exec(stmt.text.slice(i));
    if (tag) {
      const bodyStart = i + tag[0].length;
      const close = stmt.text.indexOf(tag[0], bodyStart);
      if (close === -1) return;
      scanTextForCreateWords(
        stmt.text.slice(bodyStart, close),
        stmt.start + bodyStart,
        file,
        lineOf,
        'create inside DO block',
        add,
      );
      return;
    }
    i += 1;
  }
}

function scanExecuteStatement(stmt, file, lineOf, add) {
  const masked = maskText(stmt.text, { maskComments: true, maskSingle: false, maskDouble: true, maskDollar: false });
  const re = /create\s+(or\s+replace\s+)?function/gi;
  let match;
  while ((match = re.exec(masked))) {
    add({ file, line: lineOf(stmt.start + match.index), reason: 'create inside EXECUTE string' });
  }
}

function parseMigrationTexts(entries) {
  const sorted = (entries || []).slice().sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const identityMap = new Map();
  const renamesSeen = [];
  const ignoredComments = [];
  const unparsed = [];
  const grantStatements = [];
  const tagMap = new Map();
  let seen = 0;
  let parsed = 0;
  let orReplace = 0;
  let plain = 0;
  let drops = 0;

  function getRecord(id) {
    let record = identityMap.get(id.identity);
    if (!record) {
      record = {
        schema: id.schema,
        name: id.name,
        types: id.types.slice(),
        identity: id.identity,
        creates: [],
        drops: [],
        renames: [],
        events: [],
      };
      identityMap.set(id.identity, record);
    }
    return record;
  }

  for (const entry of sorted) {
    const file = entry.file;
    const text = normalizeText(entry.text);
    const lineOf = makeLineOf(text);
    const masked = maskText(text, { maskComments: true, maskSingle: true, maskDouble: true, maskDollar: true });
    const commentMask = maskText(text, { maskComments: true, maskSingle: false, maskDouble: false, maskDollar: false });

    const commentRe = /create\s+(or\s+replace\s+)?function/gi;
    let commentMatch;
    while ((commentMatch = commentRe.exec(text))) {
      if (commentMask[commentMatch.index] === ' ') {
        ignoredComments.push({ file, line: lineOf(commentMatch.index) });
      }
    }

    for (const stmt of splitStatements(text, masked)) {
      const lead = stmt.masked;
      if (CREATE_STMT_RE.test(lead)) {
        if (/^create\s+or\s+replace\s+function/i.test(lead)) orReplace += 1;
        else plain += 1;
        const create = parseCreateStatement(stmt, lineOf, file);
        if (create.error) {
          seen += 1;
          unparsed.push({ file, line: lineOf(stmt.start), reason: create.error });
          continue;
        }
        seen += 1;
        parsed += 1;
        const record = getRecord(create);
        const event = {
          type: 'create',
          file,
          line: create.line,
          header: create.header,
          tag: create.tag,
          raises: create.raises,
        };
        record.creates.push(event);
        record.events.push(event);
        const tagLine = lineOf(stmt.start + create.tagStart);
        if (tagMap.has(create.tag)) {
          tagMap.get(create.tag).count += 1;
        } else {
          tagMap.set(create.tag, { tag: create.tag, count: 1, firstFile: file, firstLine: tagLine });
        }
        scanTextForCreateWords(
          create.body,
          stmt.start + create.bodyStart,
          file,
          lineOf,
          'create inside function body',
          (finding) => { seen += 1; unparsed.push(finding); },
        );
        continue;
      }
      if (DROP_STMT_RE.test(lead)) {
        const id = parseDropStatement(stmt);
        if (!id) {
          unparsed.push({ file, line: lineOf(stmt.start), reason: 'unreadable DROP FUNCTION' });
          continue;
        }
        const record = getRecord(id);
        const event = { type: 'drop', file, line: lineOf(stmt.start) };
        record.drops.push(event);
        record.events.push(event);
        drops += 1;
        continue;
      }
      if (ALTER_STMT_RE.test(lead)) {
        const alter = parseAlterStatement(stmt);
        if (!alter) {
          unparsed.push({ file, line: lineOf(stmt.start), reason: 'unreadable ALTER FUNCTION' });
          continue;
        }
        const line = lineOf(stmt.start);
        const record = getRecord(alter.id);
        if (alter.action === 'rename') {
          record.renames.push({ file, line, to: alter.to });
          renamesSeen.push({
            file,
            line,
            schema: alter.id.schema,
            name: alter.id.name,
            types: alter.id.types.slice(),
            identity: alter.id.identity,
            to: alter.to,
          });
        }
        grantStatements.push({ file, line, statement: stmt.text.trim() + ';', ids: [alter.id.identity] });
        continue;
      }
      if (/^(revoke|grant)\b/i.test(lead)) {
        const grant = parseGrantStatement(stmt);
        if (!grant) {
          if (/on\s+function\b/i.test(lead)) {
            unparsed.push({ file, line: lineOf(stmt.start), reason: 'unreadable REVOKE/GRANT ON FUNCTION' });
          }
          continue;
        }
        grantStatements.push({
          file,
          line: lineOf(stmt.start),
          statement: stmt.text.trim() + ';',
          ids: grant.ids.map((id) => id.identity),
        });
        continue;
      }
      if (DO_STMT_RE.test(lead)) {
        scanDoStatement(stmt, file, lineOf, (finding) => { seen += 1; unparsed.push(finding); });
        continue;
      }
      if (EXECUTE_STMT_RE.test(lead)) {
        scanExecuteStatement(stmt, file, lineOf, (finding) => { seen += 1; unparsed.push(finding); });
        continue;
      }
    }
  }

  const identities = [];
  for (const record of identityMap.values()) {
    let current = null;
    let dropped = null;
    for (const event of record.events) {
      if (event.type === 'create') {
        current = event;
        dropped = null;
      } else if (event.type === 'drop') {
        dropped = event;
        current = null;
      }
    }
    const earlier = current ? record.creates.filter((event) => event !== current) : record.creates.slice();
    const state = current ? 'CURRENT' : dropped ? 'DROPPED' : record.renames.length ? 'RENAMED' : 'NO_CREATE';
    const grants = current
      ? grantStatements
        .filter((grant) => grant.file === current.file && grant.ids.indexOf(record.identity) !== -1)
        .map((grant) => ({ file: grant.file, line: grant.line, statement: grant.statement }))
      : [];
    identities.push({
      identity: record.identity,
      schema: record.schema,
      name: record.name,
      types: record.types,
      state,
      current: current
        ? { file: current.file, line: current.line, header: current.header, tag: current.tag, raises: current.raises }
        : null,
      dropped: dropped ? { file: dropped.file, line: dropped.line } : null,
      earlier: earlier.map((event) => ({ file: event.file, line: event.line })),
      renames: record.renames.map((rename) => ({ file: rename.file, line: rename.line, to: rename.to })),
      grants,
    });
  }
  identities.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));

  const tags = [...tagMap.values()].sort((a, b) => (
    a.firstFile < b.firstFile ? -1 : a.firstFile > b.firstFile ? 1 : a.firstLine - b.firstLine
  ));
  return {
    identities,
    renamesSeen,
    ignoredComments,
    unparsed,
    tags,
    counts: {
      seen,
      parsed,
      orReplace,
      plain,
      unparsed: unparsed.length,
      ignoredComments: ignoredComments.length,
      drops,
      renames: renamesSeen.length,
      tagCount: tags.length,
    },
  };
}

function matchIdentities(identities, queries) {
  const normalized = queries.map((query) => query.toLowerCase());
  return identities
    .filter((entry) => normalized.some((query) => {
      if (query.indexOf('(') !== -1) return entry.identity.indexOf(query) !== -1;
      const qualified = (entry.schema + '.' + entry.name).toLowerCase();
      return qualified.indexOf(query) !== -1 || entry.name.toLowerCase().indexOf(query) !== -1;
    }))
    .sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
}

function formatIdentity(entry) {
  const lines = ['### `' + entry.identity + '`'];
  if (entry.current) {
    lines.push('- Defined in: `' + entry.current.file + '`:' + entry.current.line);
    lines.push('- Header: `' + entry.current.header + '`');
    lines.push('- Raises: ' + (entry.current.raises.length
      ? entry.current.raises.map((raise) => '`' + raise + '`').join(', ')
      : 'none'));
    if (entry.grants.length) {
      lines.push('- Grants in the defining migration:');
      lines.push('```sql');
      for (const grant of entry.grants) lines.push(grant.line + ': ' + grant.statement);
      lines.push('```');
    } else {
      lines.push('- Grants in the defining migration: none');
    }
  } else if (entry.dropped) {
    lines.push('- Defined in: DROPPED in `' + entry.dropped.file + '`:' + entry.dropped.line + '; no current definition');
    lines.push('- Header: none');
    lines.push('- Raises: none');
    lines.push('- Grants in the defining migration: none (no current definition)');
  } else {
    const first = entry.renames[0];
    lines.push('- Defined in: no CREATE seen in this folder; renamed in `' + first.file + '`:' + first.line);
    lines.push('- Header: none');
    lines.push('- Raises: none');
    lines.push('- Grants in the defining migration: none (no current definition)');
  }
  lines.push('- Earlier definitions: ' + (entry.earlier.length
    ? entry.earlier.map((earlier) => '`' + earlier.file + '`:' + earlier.line).join(', ')
    : 'none'));
  for (const rename of entry.renames) lines.push('- Renamed in `' + rename.file + '`:' + rename.line);
  return lines.join('\n');
}

function runFacts(options) {
  const opts = options || {};
  const result = parseMigrationTexts(opts.entries || []);
  const queries = opts.queries || [];
  const countsLine = 'Seen ' + result.counts.seen + ' create-function statements: '
    + result.counts.parsed + ' parsed, ' + result.counts.unparsed + ' UNPARSED, '
    + result.counts.ignoredComments + ' ignored comments.';
  const unparsedLines = result.unparsed.map((entry) => '- `' + entry.file + '`:' + entry.line + ' ' + entry.reason);

  if (opts.summary && queries.length === 0) {
    const lines = [countsLine, result.unparsed.length ? 'UNPARSED:' : 'UNPARSED: none'].concat(unparsedLines);
    return { output: lines.join('\n') + '\n', exitCode: 0 };
  }
  if (queries.length === 0) {
    return {
      output: 'Usage: node scripts/phase9-sql-facts.js <name-or-substring> [more...] [--summary] [--json]\n',
      exitCode: 1,
    };
  }
  const matches = matchIdentities(result.identities, queries);
  if (opts.json) {
    return {
      output: JSON.stringify({
        counts: result.counts,
        unparsed: result.unparsed,
        ignoredComments: result.ignoredComments,
        renamesSeen: result.renamesSeen,
        tags: result.tags,
        identities: matches,
      }, null, 2) + '\n',
      exitCode: 0,
    };
  }
  if (matches.length === 0) {
    return { output: 'No function identity matches ' + queries.map((query) => '"' + query + '"').join(', ') + '.\n', exitCode: 1 };
  }
  if (matches.length > 20) {
    const lines = matches.map((entry) => {
      let where = 'no definition';
      if (entry.current) where = entry.current.file + ':' + entry.current.line;
      else if (entry.dropped) where = entry.dropped.file + ':' + entry.dropped.line;
      else if (entry.renames.length) where = entry.renames[0].file + ':' + entry.renames[0].line;
      return '- `' + entry.identity + '` — `' + where + '`';
    });
    return {
      output: lines.join('\n') + '\nMore than 20 identities matched; ask for a narrower name.\n',
      exitCode: 0,
    };
  }
  return {
    output: matches.map(formatIdentity).join('\n') + '\n' + countsLine + '\n',
    exitCode: 0,
  };
}

function loadMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, text: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

function main(argv) {
  const args = argv || process.argv.slice(2);
  const json = args.indexOf('--json') !== -1;
  const summary = args.indexOf('--summary') !== -1;
  const queries = args.filter((arg) => arg.indexOf('--') !== 0);
  const entries = loadMigrations(path.join(__dirname, '..', 'supabase', 'migrations'));
  const result = runFacts({ entries, queries, summary, json });
  process.stdout.write(result.output);
  process.exitCode = result.exitCode;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  parseMigrationTexts,
  runFacts,
  loadMigrations,
  matchIdentities,
  formatIdentity,
  main,
};
