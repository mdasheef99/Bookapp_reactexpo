// Package 8 green target: 02b §§4.5/5/6.2/7.1/8/9/11/12. Tests only.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const directory = path.join(process.cwd(), 'supabase', 'migrations');
const m83Name = '20261026000083_marketplace_phase9_lean_catalogue_identity.sql';
const m84Name = '20261027000084_marketplace_phase9_catalogue_companions_completion.sql';
const m85Pattern = /^\d{8}000085_marketplace_phase9_[a-z0-9_]+\.sql$/u;
const read = (name: string) => fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/gu, '\n');
const uncomment = (sql: string) => sql.replace(/--[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
const compact = (sql: string) => sql.replace(/\s+/gu, '').toLowerCase();
const m83 = uncomment(read(m83Name));
const m84 = uncomment(read(m84Name));
const m85Names = () => fs.readdirSync(directory).filter(name => m85Pattern.test(name));
const m85 = () => m85Names().map(name => uncomment(read(name))).join('\n');
type SqlFunction = { name: string; parameters: string; header: string; body: string; definition: string };
const functions = (sql: string): SqlFunction[] => [...sql.matchAll(
  /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([\w.]+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$([\w]*)\$([\s\S]*?)\$\4\$/giu,
)].map(match => ({ name: match[1].toLowerCase(), parameters: match[2], header: match[3], body: match[5], definition: match[0] }));
const baselineFunctions = [...functions(m83), ...functions(m84)];
const baselineVisible = () => {
  // The same scanner must find a real M84 object before a missing M85 assertion.
  expect(functions(m84).map(fn => fn.name)).toContain('marketplace_sec.phase9_complete_candidate_edition_options_v2');
  expect(m84).toMatch(/CREATE\s+TABLE\s+marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
  expect(m84).toMatch(/cache_entry_id\s+uuid[\s\S]*?cache_payload_digest\s+text/iu);
};
const newFunction = (name: string) => {
  baselineVisible();
  const found = functions(m85()).filter(fn => fn.name === name);
  expect(functions(m85()).map(fn => fn.name)).toContain(name);
  expect(found).toHaveLength(1);
  return found[0];
};
const effective = (name: string) => {
  baselineVisible();
  const found = [...baselineFunctions, ...functions(m85())].filter(fn => fn.name === name);
  expect(found.length).toBeGreaterThan(0);
  return found[found.length - 1];
};
const statements = (sql: string) => sql.split(';');
const cacheAlters = () => statements(m85()).filter(statement => /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.phase9_metadata_cache_entries\b/iu.test(statement));
const roles = ['public', 'anon', 'authenticated', 'service_role'];
const helperNames = [
  'phase9_catalogue_valid_cache_v1', 'phase9_catalogue_cache_receipt_guard',
  'phase9_catalogue_query_scope_v1', 'phase9_catalogue_store_cache_v1',
  'phase9_catalogue_reuse_cache_core_v1',
];
const serviceName = 'phase9_reuse_candidate_edition_cache_v1';
const reuseTypes = ['uuid', 'text', 'text', 'integer', 'uuid', 'uuid', 'uuid', 'uuid', 'integer', 'text', 'jsonb'];
const parameterTypes = (fn: SqlFunction) => fn.parameters.trim() ? fn.parameters.split(',')
  .map(value => value.trim().split(/\s+/u).slice(1).join(' ').toLowerCase()) : [];
const signature = (fn: SqlFunction) => `${fn.name}(${parameterTypes(fn).join(',')})`;
const functionAcl = (sql: string, fn: SqlFunction, command: string) => statements(sql).filter(statement =>
  new RegExp(`\\b${command}\\b`, 'iu').test(statement) && compact(statement).includes(`onfunction${signature(fn)}`));
const hasRole = (statement: string, role: string) => new RegExp(`\\b${role}\\b`, 'iu').test(statement.split(/\b(?:FROM|TO)\b/iu).pop() ?? '');
const sourceFiles = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(root, entry.name);
  return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith('.ts') ? [full] : [];
});
const genericModules = () => [
  'supabase/functions/_shared/imageInventory', 'workers/phase9-metadata-worker',
].flatMap(root => sourceFiles(path.join(process.cwd(), root))).filter(file =>
  !/[\\/]openLibrary[\\/]/u.test(file) && /(?:cache|catalogue|companion)/iu.test(path.basename(file)));

describe('M85 shared edition-list cache forward boundary (02b package 8)', () => {
  it('[baseline] fixture sanity sees M84 receipts, parsed functions and real generic cache modules', () => {
    baselineVisible();
    expect(functions(m83).length).toBeGreaterThan(10);
    expect(functions(m84).length).toBeGreaterThan(10);
    expect(genericModules().map(file => path.basename(file))).toContain('cache.ts');
    expect(genericModules().map(file => path.basename(file))).toContain('catalogueWrite.ts');
    expect(effective('marketplace_sec.phase9_complete_candidate_edition_options_v2').body)
      .toMatch(/INSERT\s+INTO\s+marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
  });

  it('[baseline] AC7-11/17: applied M83 and M84 files retain their exact original bytes', () => {
    baselineVisible();
    const hashes = new Map([
      [m83Name, 'f370ee56050271dc549ec59a2486193fca9eecc03fddc05cc2b9323b5887598b'],
      [m84Name, '36ac694bba9d3491d8f562b0ff56ca67c2e6f5ee1d46ef6a940877dd7a44ca5a'],
    ]);
    for (const [name, expected] of hashes)
      expect(createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')).toBe(expected);
  });

  it('AC7-7/24: one forward artifact adds the cache tagged union and isolated key namespace', () => {
    baselineVisible();
    for (const column of ['payload_kind', 'bibliographic_payload', 'payload_digest', 'routing_policy_version'])
      expect(cacheAlters().some(statement => new RegExp(`\\b${column}\\b`, 'iu').test(statement))).toBe(true);
    expect(m85Names()).toHaveLength(1);
    expect(m85()).toMatch(/'selected_snapshot_v1'/u);
    expect(m85()).toMatch(/'edition_options_v1'/u);
    expect(m85()).toMatch(/'psr-edition-cache-v1:'/u);
    expect(m85()).toMatch(/phase9_catalogue_valid_cache_v1\s*\(\s*bibliographic_payload\s*\)/iu);
  });

  it('AC7-16: both actual lookup CHECK names are replaced to admit cache_hit', () => {
    baselineVisible();
    const changes = statements(m85()).filter(statement => /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.phase9_metadata_lookups\b/iu.test(statement));
    for (const name of ['phase9_metadata_lookups_check1', 'phase9_metadata_lookups_execution_mode_check']) {
      expect(changes.some(statement => new RegExp(`DROP\\s+CONSTRAINT\\s+(?:IF\\s+EXISTS\\s+)?${name}\\b`, 'iu').test(statement))).toBe(true);
      expect(changes.some(statement => new RegExp(`ADD\\s+CONSTRAINT\\s+${name}\\s+CHECK`, 'iu').test(statement)
        && /'cache_hit'/u.test(statement))).toBe(true);
    }
  });

  it('AC7-15: the one-argument safe payload validator is immutable without definer privilege', () => {
    const fn = newFunction('marketplace_sec.phase9_catalogue_valid_cache_v1');
    expect(parameterTypes(fn)).toEqual(['jsonb']);
    expect(fn.header).toMatch(/RETURNS\s+boolean/iu);
    expect(fn.header).toMatch(/\bIMMUTABLE\b/iu);
    expect(fn.header).not.toMatch(/SECURITY\s+DEFINER/iu);
    expect(fn.body).toContain('psr-edition-cache-v1');
    expect(fn.body).toMatch(/octet_length\s*\(/iu);
    expect(fn.body).not.toMatch(/\b(?:FROM|JOIN)\s+(?:public|marketplace_sec)\./iu);
  });

  it('AC7-8/10: every new helper and service entry has explicit owner, search_path and narrow ACLs', () => {
    const sql = m85();
    baselineVisible();
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.phase9_reuse_candidate_edition_cache_v1\s*\([^)]*\)\s+TO\s+service_role/iu);
    const names = [...helperNames.map(name => `marketplace_sec.${name}`),
      `marketplace_sec.${serviceName}`, `public.${serviceName}`];
    for (const name of names) {
      const fn = newFunction(name);
      expect(fn.header).toMatch(/SET\s+search_path\s*=\s*''/iu);
      expect(compact(sql)).toContain(`alterfunction${signature(fn)}ownertopostgres`);
      for (const role of roles)
        expect(functionAcl(sql, fn, 'REVOKE').some(statement => /REVOKE\s+ALL/iu.test(statement) && hasRole(statement, role))).toBe(true);
      const grants = functionAcl(sql, fn, 'GRANT');
      if (name.endsWith(serviceName)) {
        expect(grants.some(statement => /GRANT\s+EXECUTE/iu.test(statement) && hasRole(statement, 'service_role'))).toBe(true);
        expect(fn.header).toMatch(name.startsWith('public.') ? /SECURITY\s+INVOKER/iu : /SECURITY\s+DEFINER/iu);
      } else expect(grants).toHaveLength(0);
      for (const statement of grants) {
        expect(hasRole(statement, 'public')).toBe(false);
        expect(hasRole(statement, 'anon')).toBe(false);
        expect(hasRole(statement, 'authenticated')).toBe(false);
      }
    }
    expect(sql).not.toMatch(/ALTER\s+DEFAULT\s+PRIVILEGES/iu);
  });

  it('AC7-8/16: cache-hit receipts are required by a deferred constraint trigger', () => {
    const fn = newFunction('marketplace_sec.phase9_catalogue_cache_receipt_guard');
    expect(parameterTypes(fn)).toEqual([]);
    expect(fn.header).toMatch(/RETURNS\s+trigger/iu);
    expect(fn.header).toMatch(/VOLATILE\s+SECURITY\s+DEFINER/iu);
    expect(m85()).toMatch(/CREATE\s+CONSTRAINT\s+TRIGGER\s+[\s\S]*?ON\s+public\.phase9_metadata_lookups\s+[\s\S]*?DEFERRABLE\s+INITIALLY\s+DEFERRED[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+marketplace_sec\.phase9_catalogue_cache_receipt_guard\s*\(/iu);
    expect(fn.body).toMatch(/marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
    expect(fn.body).toMatch(/cache_payload_digest/u);
    expect(fn.body).toMatch(/phase9_metadata_provider_calls/u);
    expect(fn.body).toMatch(/phase9_usage_reservations/u);
  });

  it('AC7-26: server scope derivation has only candidate/lookup inputs and stable private authority', () => {
    const fn = newFunction('marketplace_sec.phase9_catalogue_query_scope_v1');
    expect(parameterTypes(fn)).toEqual(['uuid', 'uuid']);
    expect(fn.header).toMatch(/RETURNS\s+text/iu);
    expect(fn.header).toMatch(/STABLE\s+SECURITY\s+DEFINER/iu);
    expect(fn.body).toContain('public_bibliographic');
    expect(fn.body).toContain('store_private');
  });

  it('AC7-7/16: reuse core and service wrappers expose the fixed fenced version input', () => {
    for (const schema of ['marketplace_sec', 'public']) {
      const fn = newFunction(`${schema}.${serviceName}`);
      expect(parameterTypes(fn)).toEqual(reuseTypes);
      expect(fn.parameters).toMatch(/p_cache_versions\s+jsonb/iu);
      expect(fn.parameters).not.toMatch(/p_source_policy/iu);
      if (schema === 'marketplace_sec') {
        expect(fn.body).toMatch(/auth\.role\s*\(\s*\)/iu);
        expect(fn.body).toMatch(/phase9_catalogue_source_policy_v1\s*\(/iu);
        expect(fn.body).toMatch(/phase9_catalogue_reuse_cache_core_v1\s*\(/iu);
      }
    }
    const core = newFunction('marketplace_sec.phase9_catalogue_reuse_cache_core_v1');
    expect(parameterTypes(core)).toEqual([...reuseTypes, 'jsonb']);
    expect(core.parameters).toMatch(/p_source_policy\s+jsonb/iu);
    expect(core.body).not.toMatch(/phase9_catalogue_shared_admitted_v1\s*\(/iu);
    expect(core.body).not.toMatch(/INSERT\s+INTO\s+public\.(?:phase9_usage_reservations|phase9_metadata_provider_calls)\b/iu);
  });

  it('AC7-7/15/24: publication takes persisted lookup plus trusted policy rather than a worker payload', () => {
    const fn = newFunction('marketplace_sec.phase9_catalogue_store_cache_v1');
    expect(parameterTypes(fn)).toEqual(['uuid', 'jsonb']);
    expect(fn.parameters).toMatch(/p_lookup_id\s+uuid/iu);
    expect(fn.parameters).toMatch(/p_source_policy\s+jsonb/iu);
    expect(fn.header).toMatch(/RETURNS\s+uuid/iu);
    expect(fn.body).toMatch(/phase9_catalogue_query_scope_v1\s*\(/iu);
    expect(fn.body).toMatch(/marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
    expect(fn.body).not.toMatch(/phase9_catalogue_shared_admitted_v1\s*\(/iu);
    expect(fn.body).not.toMatch(/ON\s+CONFLICT[\s\S]*?DO\s+UPDATE[\s\S]*?canonical_(?:works|editions)/iu);
  });

  it('AC7-11/17: each legacy cache reader and writer discriminates selected_snapshot_v1', () => {
    const historical = fs.readdirSync(directory).filter(name => /^\d{14}_.*\.sql$/u.test(name) && !m85Pattern.test(name));
    const known = historical.sort().flatMap(name => functions(uncomment(read(name))));
    for (const name of ['phase9_metadata_cache_reuse_context', 'phase9_complete_metadata_cache_reuse', 'phase9_store_metadata_cache']) {
      const base = known.filter(fn => fn.name === `marketplace_sec.${name}`).pop();
      expect(base).toBeDefined();
      const latest = functions(m85()).filter(fn => fn.name === base!.name).pop() ?? base!;
      expect(latest.body).toMatch(/payload_kind[\s\S]*?'selected_snapshot_v1'|'selected_snapshot_v1'[\s\S]*?payload_kind/iu);
    }
  });

  it('AC7-16/23: M68 guard gains only the named cache-kind and cache-hit boundaries', () => {
    const all = fs.readdirSync(directory).filter(name => /^\d{14}_.*\.sql$/u.test(name)).sort()
      .flatMap(name => functions(uncomment(read(name))));
    const fn = all.filter(value => value.name === 'marketplace_sec.phase9_edition_guard_automatic_payload').pop();
    baselineVisible();
    expect(fn).toBeDefined();
    expect(fn!.body).toMatch(/payload_kind[\s\S]*?'edition_options_v1'|'edition_options_v1'[\s\S]*?payload_kind/iu);
    expect(fn!.body).toMatch(/'cache_hit'/u);
    expect(fn!.body).toMatch(/normalized_payload/u);
  });

  it('AC7-11/17: M73 source policy validates cache-only lineage against private effects', () => {
    const all = fs.readdirSync(directory).filter(name => /^\d{14}_.*\.sql$/u.test(name)).sort()
      .flatMap(name => functions(uncomment(read(name))));
    const fn = all.filter(value => value.name === 'marketplace_sec.phase9_edition_source_policy').pop();
    baselineVisible();
    expect(fn).toBeDefined();
    expect(fn!.body).toMatch(/marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
    expect(fn!.body).toMatch(/cache_payload_digest/u);
  });

  it('AC7-13/17: completion publishes after its durable effect and before the job resolves', () => {
    const body = effective('marketplace_sec.phase9_complete_candidate_edition_options_v2').body;
    expect(body).toMatch(/phase9_catalogue_store_cache_v1\s*\(/iu);
    const publish = body.search(/phase9_catalogue_store_cache_v1\s*\(/iu);
    const effect = body.search(/INSERT\s+INTO\s+marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
    const finish = body.search(/UPDATE\s+public\.image_extraction_jobs\s+SET\s+status\s*=\s*'resolved'/iu);
    expect(effect).toBeGreaterThanOrEqual(0);
    expect(publish).toBeGreaterThan(effect);
    expect(finish).toBeGreaterThan(publish);
  });

  it('[baseline] AC7-17: M85 preserves unassigned M84 bodies and has no unresolved M84-only dependency', () => {
    baselineVisible();
    const replaced = functions(m85());
    const allowed = new Set(['marketplace_sec.phase9_complete_candidate_edition_options_v2']);
    for (const baseline of functions(m84)) {
      if (allowed.has(baseline.name)) continue;
      for (const candidate of replaced.filter(fn => fn.name === baseline.name))
        expect(candidate.body).toBe(baseline.body);
    }
    const available = new Set(fs.readdirSync(directory).filter(name => /^\d{14}_.*\.sql$/u.test(name))
      .flatMap(name => functions(uncomment(read(name)))).map(fn => fn.name));
    for (const call of m85().matchAll(/\b(marketplace_sec\.phase9_[a-z0-9_]+)\s*\(/giu))
      expect(available.has(call[1].toLowerCase())).toBe(true);
  });

  it('[baseline] AC7-21: SQL and generic worker cache/catalogue modules keep provider rules in allowed homes', () => {
    baselineVisible();
    const sql = functions(m85()).reduce((remaining, fn) => fn.name === 'marketplace_sec.phase9_catalogue_provider_ids_valid_v1'
      ? remaining.replace(fn.definition, '') : remaining, m85());
    expect(sql).not.toMatch(/\bopen_library\b/iu);
    expect(genericModules().length).toBeGreaterThan(1);
    for (const file of genericModules()) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/(?:from\s*|import\s*\()\s*['"][^'"]*openLibrary(?:[\/\\][^'"]*)?['"]/u);
      expect(source).not.toMatch(/adapterKey\s*[!=]={1,2}\s*['"]open_library['"]|['"]open_library['"]\s*[!=]={1,2}\s*[^;\n]*adapterKey/u);
    }
  });

  it('[baseline] AC7-22: cache callers cannot introduce a second catalogue identity-key expression', () => {
    baselineVisible();
    const key = effective('marketplace_sec.phase9_catalogue_identity_lock_key_v1');
    expect(key.body).toContain('psr-catalogue-v1');
    expect(key.body).toMatch(/pg_catalog\.sha256\s*\(/iu);
    for (const fn of [...baselineFunctions, ...functions(m85())]) {
      if (fn.name !== key.name) expect(fn.body).not.toContain("'psr-catalogue-v1'");
    }
    for (const fn of functions(m85()).filter(value => /pg_advisory_xact_lock/iu.test(value.body))) {
      expect(fn.body).toMatch(/phase9_catalogue_(?:identity_lock_key|plan_keys)_v1\s*\(/iu);
      expect(fn.body).not.toMatch(/(?:substr|substring)\s*\([\s\S]*?(?:sha256|digest)\s*\([\s\S]*?bit\s*\(\s*64\s*\)/iu);
    }
    for (const file of genericModules()) expect(fs.readFileSync(file, 'utf8')).not.toContain('psr-catalogue-v1');
  });
});
