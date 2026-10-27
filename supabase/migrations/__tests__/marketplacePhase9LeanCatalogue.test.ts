// 02b §§1/5/6.2/9/11/12/14: M83-only identity/Add/static security proof.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const directory = path.join(process.cwd(), 'supabase', 'migrations');
const pattern = /^\d{8}000083_marketplace_phase9_lean_catalogue_identity\.sql$/u;
const names = () => fs.readdirSync(directory).filter(name => pattern.test(name));
const source = () => {
  const files = names();
  return files.length === 1 ? fs.readFileSync(path.join(directory, files[0]), 'utf8').replace(/\r\n/gu, '\n') : '';
};
const uncomment = (sql: string) => sql.replace(/--[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
const compact = (value: string) => value.replace(/\s+/gu, '').toLowerCase();
const executable = () => uncomment(source());
const statements = () => executable().split(';');
const functions = () => [...executable().matchAll(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([\w.]+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$([\w]*)\$([\s\S]*?)\$\4\$/giu)]
  .map(match => ({ name: match[1].toLowerCase(), parameters: match[2], header: match[3], body: match[5], definition: match[0] }));
const required = [
  'phase9_catalogue_isbn_v1', 'phase9_catalogue_identity_lock_key_v1', 'phase9_catalogue_resolve_v1',
  'phase9_catalogue_shared_admitted_v1', 'phase9_catalogue_provider_ids_valid_v1',
  'phase9_catalogue_source_policy_v1',
  'phase9_catalogue_increment_v1', 'phase9_catalogue_count_choice_v1',
  'phase9_catalogue_link_for_add_v1', 'phase9_edition_legacy_select_candidate', 'phase9_edition_local_match',
];
const body = (name: string) => {
  const found = functions().filter(fn => fn.name === 'marketplace_sec.' + name);
  expect(found).toHaveLength(1);
  return found[0];
};
const privateTables = ['marketplace_sec.phase9_catalogue_choice_effects', 'marketplace_sec.phase9_catalogue_isbn_blocklist'];
const publicTables = ['public.canonical_provider_ids', 'public.canonical_work_stats', 'public.canonical_edition_stats'];
const roles = ['PUBLIC', 'anon', 'authenticated', 'service_role'];
const writes = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
const forbidden = [
  'phase9_catalogue_companions', 'phase9_catalogue_lookup_effects', 'phase9_catalogue_valid_companion_v1',
  'phase9_catalogue_valid_cache_v1', 'phase9_catalogue_cache_receipt_guard', 'phase9_catalogue_query_scope_v1',
  'phase9_catalogue_store_cache_v1', 'phase9_catalogue_reuse_cache_core_v1',
  'phase9_complete_candidate_edition_options_v2', 'phase9_reuse_candidate_edition_cache_v1',
  'payload_kind', 'bibliographic_payload',
];
// Computed 2026-10-26 with node:crypto createHash('sha256') over CURRENT file
// UTF-8 text after .replace(/\r\n/g, '\n'); no migration text was modified.
// These are pinned constants, never regenerated from fixtures during a test.
const immutable = {
  '20261025000081_marketplace_phase9_catalogue_link_at_add.sql': '611b462b58c1ae75fe68ca4eb488793945507c9da50455c4c4441c00ff51759f',
  '20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql': '71db52c8355eee774cd9a0d94d88aef73fb99637cc738770ab9938bda1966a13',
};
function revokeCovers(object: string, role: string, privilege: string, kind = 'TABLE') {
  return statements().some(statement => {
    const match = statement.match(/\bREVOKE\s+([\s\S]*?)\s+ON\s+(?:TABLE\s+|FUNCTION\s+)?([\s\S]*?)\s+FROM\s+([\s\S]*)$/iu);
    return match && new RegExp(`\\b(?:ALL|${privilege})\\b`, 'iu').test(match[1])
      && (kind === 'FUNCTION' ? compact(match[2]) === compact(object) : match[2].split(',').map(item => item.trim().toLowerCase()).includes(object))
      && new RegExp(`\\b${role}\\b`, 'iu').test(match[3]);
  });
}
function grants(object: string, kind = 'TABLE') {
  return statements().flatMap(statement => {
    const match = statement.match(/\bGRANT\s+([\s\S]*?)\s+ON\s+(?:TABLE\s+|FUNCTION\s+)?([\s\S]*?)\s+TO\s+([\s\S]*)$/iu);
    const matches = match && (kind === 'FUNCTION' ? compact(match[2]) === compact(object)
      : match[2].split(',').map(item => item.trim().toLowerCase()).includes(object));
    return matches ? [{ privilege: match![1].trim().toUpperCase(), roles: match![3].split(',').map(role => role.trim().toLowerCase()) }] : [];
  });
}

describe('02b slice 7a lean catalogue identity forward artifact', () => {
  it('AC7-17: exactly one correctly named M83 transaction exists', () => {
    expect(names()).toHaveLength(1); expect(names()[0]).toMatch(pattern);
    expect(executable()).toMatch(/^\s*BEGIN\s*;/iu);
    expect(executable()).toMatch(/\bCOMMIT\s*;\s*$/iu);
  });

  it.each(required)('AC7-20/23: owns one exact %s definition', name => { body(name); });

  it('AC7-17: contains no later-slice relation, function or cache-column reference', () => {
    expect(functions().length).toBeGreaterThanOrEqual(required.length + 1);
    for (const name of forbidden) expect(executable()).not.toMatch(new RegExp(`\\b${name}\\b`, 'iu'));
    expect(executable()).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public|marketplace_sec)\.phase9_complete_candidate_edition_options_v1\b/iu);
    expect(executable()).not.toMatch(/ALTER\s+DEFAULT\s+PRIVILEGES/iu);
  });

  it('AC7-8/21: every function uses static SQL without constructed identifiers', () => {
    expect(functions().length).toBeGreaterThanOrEqual(required.length + 1);
    for (const fn of functions()) {
      expect(fn.body).not.toMatch(/\bEXECUTE\b|\b(?:format|chr)\s*\(/iu);
      expect(fn.body).not.toMatch(/\b(?:quote_ident|quote_literal|quote_nullable)\s*\(/iu);
      expect(fn.body).not.toMatch(/\b(?:FROM|JOIN|UPDATE|INTO|TABLE|FUNCTION)\s+(?:'(?:''|[^'])*'|[a-z_]\w*)\s*\|\|/iu);
      expect(fn.body).not.toMatch(/'(?:public|marketplace_sec)\.'\s*\|\|/iu);
    }
  });

  it('AC7-21: admission names the admitted provider exactly once in its allow-list', () => {
    const admitted = body('phase9_catalogue_shared_admitted_v1');
    expect(admitted?.body.match(/'open_library'/giu)).toHaveLength(1);
    expect(admitted?.body).toMatch(/(?:p_adapter_key|(?:[a-z_]\w*\.)?adapter_key)\s*(?:=\s*'open_library'|IN\s*\(\s*'open_library'\s*\))/iu);
  });

  it('AC7-21/23: provider facts use one registry-keyed validator branch only', () => {
    const validator = body('phase9_catalogue_provider_ids_valid_v1');
    expect(validator?.body).toMatch(/\bCASE\s+p_adapter_key\b/iu);
    expect(validator?.body.match(/\bWHEN\s+'open_library'\s+THEN/giu)).toHaveLength(1);
    expect(validator?.body).toMatch(/\bp_completion\s+IS\s+NOT\s+NULL\b/iu);
    expect(validator?.header).toMatch(/\bIMMUTABLE\b/iu);
    const branch = validator?.body.match(/\bWHEN\s+'open_library'\s+THEN[\s\S]*?(?=\bWHEN\s+'[^']+'\s+THEN|\bELSE\b|\bEND\s+CASE\b)/iu)?.[0] ?? '';
    expect(branch).toContain('open_library');
    expect(validator?.body.replace(branch, '')).not.toMatch(/\bopen_library\b/iu);
  });

  it('AC7-21: remaining provider literal occurs only in the source-note registry update', () => {
    let sql = executable();
    for (const name of ['phase9_catalogue_shared_admitted_v1', 'phase9_catalogue_provider_ids_valid_v1']) {
      const definition = body(name)?.definition; if (definition) sql = sql.replace(definition, '');
    }
    const update = sql.match(/\bUPDATE\s+public\.phase9_provider_registry\s+SET\s+shared_source_note\s*=\s*'(?:''|[^'])*'\s+WHERE\s+adapter_key\s*=\s*'open_library'\s*;/iu)?.[0] ?? '';
    expect(update).not.toBe('');
    expect(sql.replace(update, '')).not.toMatch(/\bopen_library\b/iu);
  });

  it('AC7-21: new schema and constructed JSON keys have provider-neutral names', () => {
    expect(publicTables.every(table => executable().includes(table))).toBe(true);
    const additions = [...executable().matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(([\s\S]*?)\)\s*;/giu)]
      .flatMap(match => [match[1], ...match[2].split(',').map(column => column.trim().split(/\s+/u)[0])]);
    additions.push(...[...executable().matchAll(/\bADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]\w*)/giu)].map(match => match[1]));
    const keys = [...executable().matchAll(/jsonb_build_object\s*\(([\s\S]*?)\)/giu)]
      .flatMap(match => [...match[1].matchAll(/(?:^|,)\s*'([^']+)'\s*,/gu)].map(key => key[1]));
    expect([...additions, ...keys].join(' ')).not.toMatch(/open[_-]?library|google[_-]?books|\bol_/iu);
  });

  it('AC7-22: exact built-in SHA-256 signed key expression occurs once, inside the shared helper', () => {
    const key = body('phase9_catalogue_identity_lock_key_v1');
    const expression = `('x' || pg_catalog.substr(pg_catalog.encode(pg_catalog.sha256(
      pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      'psr-catalogue-v1', p_kind, p_key)::text, 'UTF8')), 'hex'), 1, 16)
      )::bit(64)::bigint`;
    const expected = compact(expression), sql = compact(executable());
    expect(sql.split(expected)).toHaveLength(2);
    expect(compact(key?.body ?? '')).toContain(expected);
    expect(executable().match(/'psr-catalogue-v1'/gu)).toHaveLength(1);
    expect(executable()).not.toMatch(/\b(?:hashtext|hashtextextended)\s*\(/iu);
  });

  it('AC7-8/23: all defined functions have explicit postgres ownership and empty search_path', () => {
    expect(functions().length).toBeGreaterThanOrEqual(required.length + 1);
    for (const fn of functions()) {
      expect(fn.header).toMatch(/\bSET\s+search_path\s*=\s*''/iu);
      const types = fn.parameters.split(',').map(parameter => parameter.trim().split(/\s+/u).pop()).filter(Boolean).join(',');
      const signature = fn.name + '(' + types + ')';
      expect(statements().some(statement => compact(statement).includes(compact('ALTER FUNCTION ' + signature + ' OWNER TO postgres')))).toBe(true);
      for (const role of roles) expect(revokeCovers(signature, role, 'ALL', 'FUNCTION')).toBe(true);
      if (fn.name.startsWith('marketplace_sec.')) expect(grants(signature, 'FUNCTION')).toEqual([]);
      else expect(grants(signature, 'FUNCTION')).toEqual([{ privilege: 'EXECUTE', roles: ['authenticated'] }]);
    }
    expect(body('phase9_catalogue_isbn_v1')?.header).toMatch(/\bSTABLE\s+SECURITY\s+DEFINER\b/iu);
    for (const name of ['phase9_catalogue_identity_lock_key_v1', 'phase9_catalogue_provider_ids_valid_v1']) {
      expect(body(name)?.header).toMatch(/\bIMMUTABLE\b/iu);
      expect(body(name)?.header).not.toMatch(/\bSECURITY\s+DEFINER\b/iu);
    }
  });

  it.each([...publicTables, ...privateTables])('AC7-8: explicitly revokes broad defaults and enables RLS on %s', table => {
    expect(executable()).toMatch(new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table.replace('.', '\\.')}\\b`, 'iu'));
    expect(statements().some(statement => compact(statement).includes(compact('ALTER TABLE ' + table + ' ENABLE ROW LEVEL SECURITY')))).toBe(true);
    for (const role of roles) for (const privilege of writes) expect(revokeCovers(table, role, privilege)).toBe(true);
    const allowed = table === publicTables[0] ? ['authenticated', 'service_role'] : publicTables.includes(table) ? ['service_role'] : [];
    const actual = grants(table);
    expect(actual.every(grant => grant.privilege === 'SELECT')).toBe(true);
    expect(actual.flatMap(grant => grant.roles).sort()).toEqual(allowed.sort());
  });

  it('AC7-2d: provider target reverse indexes cover nonnull targets', () => {
    for (const column of ['canonical_edition_id', 'canonical_work_id']) {
      expect(executable()).toMatch(new RegExp(`CREATE\\s+INDEX\\s+\\w+\\s+ON\\s+public\\.canonical_provider_ids\\s*\\(\\s*${column}\\s*\\)\\s+WHERE\\s+${column}\\s+IS\\s+NOT\\s+NULL\\s*;`, 'iu'));
    }
  });

  it('AC7-8/28: reasserts canonical PUBLIC/client revokes including MAINTAIN, preserving service grants', () => {
    for (const table of ['public.canonical_works', 'public.canonical_editions']) {
      for (const role of ['PUBLIC', 'anon', 'authenticated']) for (const privilege of writes) expect(revokeCovers(table, role, privilege)).toBe(true);
      expect(grants(table)).toEqual([]);
    }
  });

  it('AC7-28: removes the source ALL policy, keeps operator SELECT and service SELECT only', () => {
    for (const role of roles) for (const privilege of writes) expect(revokeCovers('public.book_metadata_sources', role, privilege)).toBe(true);
    expect(executable()).toMatch(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"metadata sources platform write"\s+ON\s+public\.book_metadata_sources/iu);
    expect(executable()).toMatch(/CREATE\s+POLICY\s+"metadata sources platform read"\s+ON\s+public\.book_metadata_sources\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(\s*marketplace_sec\.is_platform_operator\s*\(\s*\)\s*\)/iu);
    expect(grants('public.book_metadata_sources').every(grant => grant.privilege === 'SELECT')).toBe(true);
    expect(grants('public.book_metadata_sources').some(grant => grant.roles.includes('service_role'))).toBe(true);
  });

  it.each(Object.entries(immutable))('[baseline] preserves current LF-normalized SHA-256 of %s', (file, expected) => {
    const text = fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n/gu, '\n');
    expect(createHash('sha256').update(text, 'utf8').digest('hex')).toBe(expected);
  });
});
