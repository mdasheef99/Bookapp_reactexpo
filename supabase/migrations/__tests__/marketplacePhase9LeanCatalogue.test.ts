// 02b §§1/5/6.2/9/11/12/14: M83-only identity/Add/static security proof.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertM84CacheProvenanceUnwritten } from './fixtures/leanCatalogueCacheGuard';

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


// 02b sections 3-7/9/11/12: M84 is a separate artifact; M83 assertions above stay intact.
describe('M84 companion and completion forward artifact', () => {
  const m84Pattern = /^\d{8}000084_marketplace_phase9_catalogue_companions_completion\.sql$/u;
  const files = () => fs.readdirSync(directory).filter(name => m84Pattern.test(name));
  const sql = () => files().length === 1
    ? uncomment(fs.readFileSync(path.join(directory, files()[0]), 'utf8').replace(/\r\n/gu, '\n')) : '';
  const definitions = () => [...sql().matchAll(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([\w.]+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$([\w]*)\$([\s\S]*?)\$\4\$/giu)]
    .map(match => ({ name: match[1].toLowerCase(), parameters: match[2], header: match[3], body: match[5], definition: match[0] }));
  const requiredBody = (name: string) => {
    const found = definitions().filter(fn => fn.name === name);
    expect(found.map(fn => fn.name)).toEqual([name]);
    return found[0];
  };
  const privateTables84 = ['marketplace_sec.phase9_catalogue_companions', 'marketplace_sec.phase9_catalogue_lookup_effects'];
  const chunks = () => sql().split(';');
  const acl = (operation: string, kind: string, object: string, role: string) => chunks().some(statement => {
    const match = statement.match(new RegExp(`\\b${operation}\\s+([\\s\\S]*?)\\s+ON\\s+(?:${kind}\\s+)?([\\s\\S]*?)\\s+${operation === 'GRANT' ? 'TO' : 'FROM'}\\s+([\\s\\S]*)$`, 'iu'));
    return Boolean(match && /\b(?:ALL|EXECUTE)\b/iu.test(match[1])
      && compact(match[2]).includes(compact(object)) && new RegExp(`\\b${role}\\b`, 'iu').test(match[3]));
  });

  it('[baseline] scans a real M83 function and canonical-work index', () => {
    expect(names()).toHaveLength(1);
    expect(body('phase9_catalogue_resolve_v1').body).toMatch(/canonical_works/iu);
    expect(executable()).toMatch(/CREATE\s+INDEX\s+canonical_provider_ids_edition_idx/iu);
  });

  it('AC7-17: has exactly one correctly named M84 file', () => {
    expect(files()).toHaveLength(1);
    expect(files()[0]).toMatch(m84Pattern);
  });

  it('AC7-34: adds one non-unique normalized work probe index and no other probe indexes', () => {
    const indexes = [...sql().matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s+ON\s+([\w.]+)[\s\S]*?;/giu)];
    const work = indexes.filter(match => match[3].toLowerCase() === 'public.canonical_works');
    expect(work).toHaveLength(1);
    expect(work[0][1]).toBeUndefined();
    expect(work[0][2].toLowerCase()).toBe('canonical_works_normalized_probe_idx');
    const index = compact(work[0][0]);
    expect(index).toContain(compact('pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(coalesce(title_normalized,primary_title)))'));
    expect(index).toContain(compact('marketplace_sec.phase9_catalogue_normalized_authors_v1(primary_authors)'));
    expect(indexes.filter(match => /public\.canonical_editions|public\.canonical_provider_ids|public\.book_metadata_sources/iu.test(match[3]))).toHaveLength(0);
  });

  it('AC7-30: M84 uses the locked policy builder without fixing helper placement', () => {
    expect(files()).toHaveLength(1);
    expect(sql()).toMatch(/phase9_catalogue_source_policy_v1\s*\(/iu);
    expect(sql()).toMatch(/sharedAdmitted/iu);
    // PGlite follows public Select; native observes its lock and UPDATE waiting.
  });  it('AC7-21/23: provider literals are confined to the replaced provider validator', () => {
    const validator = requiredBody('marketplace_sec.phase9_catalogue_provider_ids_valid_v1');
    expect(validator.body).toMatch(/\bCASE\s+p_adapter_key\b/iu);
    expect(validator.body).toMatch(/\bp_completion\b/iu);
    expect(validator.body).toMatch(/'open_library'/iu);
    for (const fn of definitions().filter(fn => fn.name !== validator.name)) expect(fn.body).not.toMatch(/'open_library'/iu);
  });

  it('AC7-22: completion reuses the shared identity-key function instead of a caller-local hash', () => {
    const completion = requiredBody('marketplace_sec.phase9_complete_candidate_edition_options_v2');
    expect(sql()).toMatch(/phase9_catalogue_identity_lock_key_v1\s*\(/iu);
    expect(completion.body).not.toMatch(/\b(?:hashtext|hashtextextended)\s*\(|'psr-catalogue-v1'/iu);
    expect(sql()).not.toMatch(/\b(?:hashtext|hashtextextended)\s*\(|'psr-catalogue-v1'/iu);
  });

  it('AC7-8/10: private M84 tables enable RLS and revoke every API role', () => {
    for (const table of privateTables84) {
      expect(sql()).toMatch(new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table.replace('.', '\\.')}\\b`, 'iu'));
      expect(compact(sql())).toContain(compact(`ALTER TABLE ${table} OWNER TO postgres`));
      expect(compact(sql())).toContain(compact(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      for (const role of roles) expect(acl('REVOKE', 'TABLE', table, role)).toBe(true);
      expect(chunks().filter(statement => /\bGRANT\b/iu.test(statement)
        && compact(statement).includes(compact(table)))).toHaveLength(0);
    }
  });

  it('AC7-8: every newly defined function declares ownership and the correct API boundary', () => {
    requiredBody('marketplace_sec.phase9_catalogue_valid_companion_v1');
    const older = new Set(fs.readdirSync(directory).filter(name => name.endsWith('.sql') && !m84Pattern.test(name))
      .flatMap(name => [...uncomment(fs.readFileSync(path.join(directory, name), 'utf8'))
        .matchAll(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([\w.]+)\s*\(/giu)]
        .map(match => match[1].toLowerCase())));
    const newly = definitions().filter(fn => !older.has(fn.name));
    expect(newly.length).toBeGreaterThanOrEqual(3);
    for (const fn of newly) {
      const types = fn.parameters.split(',').map(parameter => parameter.trim().split(/\s+/u).pop()).join(',');
      const signature = `${fn.name}(${types})`;
      expect(compact(sql())).toContain(compact(`ALTER FUNCTION ${signature} OWNER TO postgres`));
      for (const role of roles) expect(acl('REVOKE', 'FUNCTION', signature, role)).toBe(true);
      const serviceEntry = fn.name === 'marketplace_sec.phase9_complete_candidate_edition_options_v2'
        || fn.name === 'public.phase9_complete_candidate_edition_options_v2';
      expect(acl('GRANT', 'FUNCTION', signature, 'service_role')).toBe(serviceEntry);
      for (const role of ['PUBLIC', 'anon', 'authenticated']) expect(acl('GRANT', 'FUNCTION', signature, role)).toBe(false);
    }
  });

  it('AC7-8/20: companion validator is postgres-only and completion entries are service-only', () => {
    const validator = requiredBody('marketplace_sec.phase9_catalogue_valid_companion_v1');
    const privateEntry = requiredBody('marketplace_sec.phase9_complete_candidate_edition_options_v2');
    const publicEntry = requiredBody('public.phase9_complete_candidate_edition_options_v2');
    for (const fn of [validator, privateEntry, publicEntry]) {
      const types = fn.parameters.split(',').map(parameter => parameter.trim().split(/\s+/u).pop()).join(',');
      const signature = `${fn.name}(${types})`;
      expect(compact(sql())).toContain(compact(`ALTER FUNCTION ${signature} OWNER TO postgres`));
      expect(fn.header).toMatch(/SET\s+search_path\s*=\s*''/iu);
      for (const role of roles) expect(acl('REVOKE', 'FUNCTION', signature, role)).toBe(true);
      for (const role of ['anon', 'authenticated']) expect(acl('GRANT', 'FUNCTION', signature, role)).toBe(false);
      expect(acl('GRANT', 'FUNCTION', signature, 'service_role')).toBe(fn !== validator);
    }
    expect(validator.header).toMatch(/IMMUTABLE/iu);
    expect(privateEntry.header).toMatch(/SECURITY\s+DEFINER/iu);
    expect(publicEntry.header).not.toMatch(/SECURITY\s+DEFINER/iu);
  });

  it('AC7-17/25: v1 delegates to v2 and recovery and local completion are forward-replaced', () => {
    const v1 = requiredBody('marketplace_sec.phase9_complete_candidate_edition_options_v1');
    expect(v1.body).toMatch(/phase9_complete_candidate_edition_options_v2\s*\([\s\S]*?\bNULL(?:\s*::\s*jsonb)?\s*\)/iu);
    requiredBody('marketplace_sec.phase9_recover_candidate_edition_options_v1');
    requiredBody('marketplace_sec.phase9_complete_local_metadata_match');
  });

  // Owner B3 P2 / 02b sections 6.2/7.2: approved M32 private-wrapper deviation.
  it('P2: structural local replacement retains its private service boundary', () => {
    const fn = requiredBody('marketplace_sec.phase9_complete_structural_local_metadata_match');
    const signature = fn.name + '(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)';
    expect(fn.parameters.split(',').map(parameter => parameter.trim().split(/\s+/u).pop()).join(','))
      .toBe(signature.slice(signature.indexOf('(') + 1, -1));
    expect(fn.header).toMatch(/SECURITY\s+DEFINER/iu);
    expect(fn.header).toMatch(/SET\s+search_path\s*=\s*''/iu);
    expect(compact(sql())).toContain(compact('ALTER FUNCTION ' + signature + ' OWNER TO postgres'));
    for (const role of roles) expect(acl('REVOKE', 'FUNCTION', signature, role)).toBe(true);
    expect(acl('GRANT', 'FUNCTION', signature, 'service_role')).toBe(true);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) expect(acl('GRANT', 'FUNCTION', signature, role)).toBe(false);
    expect(definitions().filter(entry => entry.name === 'public.phase9_complete_structural_local_metadata_match')).toHaveLength(0);
  });

  it('P2: structural local wrapper locks session before assertion and rechecks returned scope', () => {
    const fn = requiredBody('marketplace_sec.phase9_complete_structural_local_metadata_match');
    const assertion = fn.body.indexOf('v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(');
    expect(assertion).toBeGreaterThan(0);
    const before = fn.body.slice(0, assertion);
    expect(before).toMatch(/FROM public\.image_extraction_candidates c[\s\S]*?WHERE c\.id=p_candidate_id\s*;/iu);
    expect(before).toMatch(/FROM public\.image_extraction_sessions s[\s\S]*?s\.id=v_scope\.session_id AND s\.store_id=v_scope\.store_id FOR UPDATE/iu);
    expect(before).not.toMatch(/FROM public\.image_extraction_candidates[^;]*FOR\s+(?:UPDATE|SHARE|KEY|NO)/iu);
    const after = fn.body.slice(assertion);
    expect(after).toMatch(/v_candidate\.session_id IS DISTINCT FROM v_session\.id[\s\S]*?v_candidate\.store_id IS DISTINCT FROM v_session\.store_id[\s\S]*?P9_STATE_CONFLICT/iu);
    expect(after).toMatch(/p_query_identity<>marketplace_sec\.phase9_metadata_candidate_query_identity\(v_candidate\)/iu);
    expect(after).toMatch(/RETURN marketplace_sec\.phase9_complete_local_metadata_match\(/iu);
  });

  it('P2: M15 keeps replay first, locks session before claim and inserts lookup before choice target', () => {
    const fn = requiredBody('marketplace_sec.phase9_complete_local_metadata_match');
    const claim = fn.body.indexOf('v_job:=marketplace_sec.phase9_assert_metadata_claim(');
    const scope = fn.body.indexOf('INTO v_scope');
    const replay = fn.body.indexOf('RETURN jsonb_build_object(');
    const validation = fn.body.lastIndexOf("RAISE EXCEPTION 'P9_REQUEST_INVALID'", claim);
    expect(replay).toBeGreaterThan(0);
    expect(validation).toBeGreaterThan(replay);
    expect(scope).toBeGreaterThan(validation);
    expect(claim).toBeGreaterThan(scope);
    expect(fn.body.slice(scope, claim)).toMatch(/FROM public\.image_extraction_sessions s[\s\S]*?FOR UPDATE/iu);
    expect(fn.body.slice(0, claim)).not.toMatch(/FROM public\.image_extraction_candidates[^;]*FOR\s+(?:UPDATE|SHARE|KEY|NO)/iu);
    const target = fn.body.indexOf('FROM marketplace_sec.phase9_catalogue_choice_target_v1(');
    const lookup = fn.body.indexOf('INSERT INTO public.phase9_metadata_lookups(');
    const state = fn.body.indexOf('PERFORM state.candidate_id');
    expect(state).toBeGreaterThan(claim);
    expect(lookup).toBeGreaterThan(state);
    expect(target).toBeGreaterThan(lookup);
    expect(fn.body.slice(claim, state)).toMatch(/v_candidate\.id IS DISTINCT FROM v_scope\.candidate_id/iu);
    expect(fn.body.slice(claim, state)).toMatch(/v_candidate\.session_id IS DISTINCT FROM v_session\.id[\s\S]*?v_candidate\.store_id IS DISTINCT FROM v_session\.store_id/iu);
    const rechecks = [...fn.body.matchAll(/phase9_edition_local_match\(v_candidate\)/gu)].map(match => match.index!);
    expect(rechecks).toHaveLength(2);
    expect(rechecks[0]).toBeLessThan(lookup);
    expect(rechecks[1]).toBeGreaterThan(target);
  });

  // Round C / 02b section 6.2: owner-wide scope precedes shared catalogue locks.
  it('AC7-22: private owner-scope lock preserves revisions and resolves the session actor', () => {
    const fn = requiredBody('marketplace_sec.phase9_catalogue_lock_owner_scope_v1');
    expect(fn.header).toMatch(/SECURITY\s+DEFINER[\s\S]*SET\s+search_path\s*=\s*''/iu);
    expect(fn.body).toMatch(/SELECT\s+s\.created_by\s+INTO\s+v_actor[\s\S]*WHERE\s+s\.id=p_session_id/iu);
    expect(fn.body).toMatch(/INSERT INTO public\.phase9_owner_review_scopes\(actor_user_id,review_scope_version\)\s*VALUES\(v_actor,1\)\s*ON CONFLICT\(actor_user_id\) DO NOTHING/iu);
    expect(fn.body).toMatch(/FROM public\.phase9_owner_review_scopes[\s\S]*WHERE actor_user_id=v_actor FOR UPDATE/iu);
    expect(fn.body).not.toMatch(/\bUPDATE\s+(?:public\.)?phase9_owner_review_scopes|DO\s+UPDATE|auth\.uid\(/iu);
  });

  it.each([
    ['phase9_add_candidate_to_inventory_v1', 'public.', 'v_session.id',
      'SELECT * INTO v_selected FROM public.phase9_candidate_edition_state', 'PERFORM effect.lookup_id'],
    ['phase9_edition_legacy_select_candidate', 'marketplace_sec.', 'c.session_id',
      'SELECT * INTO s FROM public.phase9_candidate_edition_state', "IF p_source='edition_option' THEN"],
    ['phase9_complete_local_metadata_match', 'marketplace_sec.', 'v_candidate.session_id',
      'PERFORM state.candidate_id', 'IF marketplace_sec.phase9_edition_local_match'],
  ])('AC7-22: %s prelocks owner scope immediately after private state', (name, schema, session, state, next) => {
    const fn = requiredBody(schema + name);
    const stateAt = fn.body.indexOf(state), stateEnd = fn.body.indexOf(';', stateAt);
    const lockAt = fn.body.indexOf('PERFORM marketplace_sec.phase9_catalogue_lock_owner_scope_v1(' + session + ')');
    expect(stateAt).toBeGreaterThan(0);
    expect(lockAt).toBeGreaterThan(stateEnd);
    expect(fn.body.slice(stateEnd + 1, lockAt).trim()).toBe('');
    expect(lockAt).toBeLessThan(fn.body.indexOf(next, stateEnd));
    expect(fn.body.slice(0, lockAt)).not.toMatch(/pg_advisory_xact_lock|phase9_catalogue_(?:source_policy|choice_target|link_for_add)_v1\(/iu);
  });

  it('AC7-2d: companion history is inserted without a caller update', () => {
    expect(sql()).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?marketplace_sec\.phase9_catalogue_companions/iu);
    expect(sql()).toMatch(/INSERT\s+INTO\s+marketplace_sec\.phase9_catalogue_companions/iu);
    expect(sql()).not.toMatch(/UPDATE\s+marketplace_sec\.phase9_catalogue_companions\b/iu);
    for (const statement of chunks().filter(value => /INSERT\s+INTO\s+marketplace_sec\.phase9_catalogue_companions/iu.test(value)))
      expect(statement).not.toMatch(/ON\s+CONFLICT[\s\S]*?DO\s+UPDATE/iu);
  });

  it('AC7-17: M84 excludes M85 cache objects and cache-hit writes', () => {
    expect(sql()).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?marketplace_sec\.phase9_catalogue_lookup_effects/iu);
    // 02b section 12: complete M85 object/alteration inventory, including
    // legacy functions whose bodies belong to the cache-only replacement.
    for (const name of ['payload_kind', 'bibliographic_payload',
      'phase9_metadata_lookups_check1', 'phase9_metadata_lookups_execution_mode_check',
      'phase9_catalogue_valid_cache_v1', 'phase9_catalogue_cache_receipt_guard', 'phase9_catalogue_query_scope_v1',
      'phase9_reuse_candidate_edition_cache_v1', 'phase9_catalogue_store_cache_v1',
      'phase9_catalogue_reuse_cache_core_v1']) expect(sql()).not.toMatch(new RegExp(`\\b${name}\\b`, 'iu'));
    // routing_policy_version already exists on lookup/attempt rows in M78;
    // only its M85 cache-table alteration is forbidden here.
    for (const column of ['payload_kind', 'bibliographic_payload', 'payload_digest', 'routing_policy_version'])
      expect(chunks().filter(statement => /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.phase9_metadata_cache_entries\b/iu.test(statement))
        .some(statement => new RegExp(`\\b${column}\\b`, 'iu').test(statement))).toBe(false);
    for (const name of ['phase9_edition_guard_automatic_payload', 'phase9_edition_source_policy',
      'phase9_metadata_cache_reuse_context', 'phase9_complete_metadata_cache_reuse', 'phase9_store_metadata_cache'])
      expect(sql()).not.toMatch(new RegExp(`CREATE(?:\\s+OR\\s+REPLACE)?\\s+FUNCTION\\s+(?:marketplace_sec|public)\\.${name}\\s*\\(`, 'iu'));
    expect(sql()).not.toMatch(/'cache_hit'/iu);
    assertM84CacheProvenanceUnwritten(sql());
  });
});
