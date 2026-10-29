// Package 8 green target: 02b §§4.5/5/6.2/7.1/8/9/11/12. Tests only.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const directory = path.join(process.cwd(), 'supabase', 'migrations');
const m83Name = '20261026000083_marketplace_phase9_lean_catalogue_identity.sql';
const m84Name = '20261027000084_marketplace_phase9_catalogue_companions_completion.sql';
const levels = [85,86,87] as const;
type Level = typeof levels[number];
const pattern = (level: Level) => new RegExp(`^\\d{8}0000${level}_marketplace_phase9_[a-z0-9_]+\\.sql$`, 'u');
const names = (level: Level) => fs.readdirSync(directory).filter(name => pattern(level).test(name));
const sqlAt = (level: Level) => names(level).map(name => uncomment(read(name))).join('\n');
const chain = () => levels.map(sqlAt).join('\n');
const read = (name: string) => fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/gu, '\n');
const uncomment = (sql: string) => sql.replace(/--[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
const compact = (sql: string) => sql.replace(/\s+/gu, '').toLowerCase();
const relationRead = /\b(?:FROM|JOIN)\s+(?:public|marketplace_sec)\.\w+\b(?!\s*\()/iu;
const m83 = uncomment(read(m83Name));
const m84 = uncomment(read(m84Name));
const m85 = () => sqlAt(85);
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
const owner = (name: string): Level => /query_scope|store_cache/.test(name) ? 86 : /reuse_cache_core|reuse_candidate_edition_cache/.test(name) ? 87 : 85;
const newFunction = (name: string) => {
  baselineVisible();
  const found = functions(sqlAt(owner(name))).filter(fn => fn.name === name);
  expect(functions(sqlAt(owner(name))).map(fn => fn.name)).toContain(name);
  expect(found).toHaveLength(1);
  return found[0];
};
const effective = (name: string) => {
  baselineVisible();
  const found = [...baselineFunctions, ...functions(chain())].filter(fn => fn.name === name);
  expect(found.length).toBeGreaterThan(0);
  return found[found.length - 1];
};
const statements = (sql: string) => sql.split(';');
const cacheAlters = () => statements(m85()).filter(statement => /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.phase9_metadata_cache_entries\b/iu.test(statement));
const serviceName = 'phase9_reuse_candidate_edition_cache_v1';
const reuseTypes = ['uuid', 'text', 'text', 'integer', 'uuid', 'uuid', 'uuid', 'uuid', 'integer', 'text', 'jsonb'];
const parameterTypes = (fn: SqlFunction) => fn.parameters.trim() ? fn.parameters.split(',')
  .map(value => value.trim().split(/\s+/u).slice(1).join(' ').toLowerCase()) : [];
const signature = (fn: SqlFunction) => `${fn.name}(${parameterTypes(fn).join(',')})`;
const sourceFiles = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(root, entry.name);
  return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith('.ts') ? [full] : [];
});
const genericModules = () => [
  'supabase/functions/_shared/imageInventory', 'workers/phase9-metadata-worker',
].flatMap(root => sourceFiles(path.join(process.cwd(), root))).filter(file =>
  !/[\\/]openLibrary[\\/]/u.test(file) && /(?:cache|catalogue|companion)/iu.test(path.basename(file)));

describe('M85-M87 shared edition-list cache ordered boundaries (02b package 8)', () => {
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

  it('AC7-7/24: M85 schema and M86 publication own their assigned objects', () => {
    baselineVisible();
    for (const column of ['payload_kind', 'bibliographic_payload', 'payload_digest', 'routing_policy_version'])
      expect(cacheAlters().some(statement => new RegExp(`\\b${column}\\b`, 'iu').test(statement))).toBe(true);
    for (const level of levels) expect(names(level)).toHaveLength(1);
    expect(m85()).toMatch(/'selected_snapshot_v1'/u);
    expect(m85()).toMatch(/'edition_options_v1'/u);
    expect(sqlAt(86)).toMatch(/'psr-edition-cache-v1:'/u);
    expect(m85()).toMatch(/phase9_catalogue_valid_cache_v1\s*\(/iu);
  });

  it('AC7-16: M85 mentions both replaced lookup CHECKs and cache_hit (catalog behavior is in schema suite)', () => {
    baselineVisible();
    for (const name of ['phase9_metadata_lookups_check1','phase9_metadata_lookups_execution_mode_check'])
      expect(m85()).toContain(name);
    expect(m85()).toContain("'cache_hit'");
  });

  it('AC7-15: the one-argument safe payload validator is immutable without definer privilege', () => {
    const fn = newFunction('marketplace_sec.phase9_catalogue_valid_cache_v1');
    expect(parameterTypes(fn)).toEqual(['jsonb']);
    expect(fn.header).toMatch(/RETURNS\s+boolean/iu);
    expect(fn.header).toMatch(/\bIMMUTABLE\b/iu);
    expect(fn.header).not.toMatch(/SECURITY\s+DEFINER/iu);
    expect(fn.body).toContain('psr-edition-cache-v1');
    expect(fn.body).not.toMatch(relationRead);
  });

  it('validator relation guard distinguishes function calls and still refuses table reads', () => {
    expect('FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(NULL)').not.toMatch(relationRead);
    expect('FROM marketplace_sec.phase9_catalogue_lookup_effects e').toMatch(relationRead);
    expect('JOIN public.phase9_metadata_cache_entries c ON true').toMatch(relationRead);
  });

  it('AC7-8/16: cache-hit receipts are required by a deferred constraint trigger', () => {
    const fn = newFunction('marketplace_sec.phase9_catalogue_cache_receipt_guard');
    expect(parameterTypes(fn)).toEqual([]);
    expect(fn.header).toMatch(/RETURNS\s+trigger/iu);
    expect(fn.header).toMatch(/\bVOLATILE\b/iu);
    expect(fn.header).toMatch(/SECURITY\s+DEFINER/iu);
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
    expect(fn.header).toMatch(/\bSTABLE\b/iu);
    expect(fn.header).toMatch(/SECURITY\s+DEFINER/iu);
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

  it('AC7-11/17: M85 replaced legacy bodies mention payload_kind (behavior is in legacy suite)', () => {
    baselineVisible();
    for (const name of ['phase9_metadata_cache_reuse_context','phase9_complete_metadata_cache_reuse','phase9_store_metadata_cache']) {
      const fn=newFunction('marketplace_sec.'+name);
      expect(fn.body).toMatch(/\bpayload_kind\b/iu);
    }
  });

  it('AC7-16/23: M85 M68 body mentions cache-kind, cache-hit and normalized-payload boundaries', () => {
    const all = functions(m85());
    const fn = all.filter(value => value.name === 'marketplace_sec.phase9_edition_guard_automatic_payload').pop();
    baselineVisible();
    expect(fn).toBeDefined();
    expect(fn!.body).toMatch(/payload_kind[\s\S]*?'edition_options_v1'|'edition_options_v1'[\s\S]*?payload_kind/iu);
    expect(fn!.body).toMatch(/'cache_hit'/u);
    expect(fn!.body).toMatch(/normalized_payload/u);
  });

  it('AC7-11/17: M85 M73 body mentions private effects and cache digest', () => {
    const all = functions(m85());
    const fn = all.filter(value => value.name === 'marketplace_sec.phase9_edition_source_policy').pop();
    baselineVisible();
    expect(fn).toBeDefined();
    expect(fn!.body).toMatch(/marketplace_sec\.phase9_catalogue_lookup_effects\b/iu);
    expect(fn!.body).toMatch(/cache_payload_digest/u);
  });

  // 02b ?12 amendment: do not infer dependencies from later migration names.
  for (const level of levels) it(`M${level}: ordered chain applies and its callable signatures execute in PGlite`, () => {
    baselineVisible(); expect(names(level)).toHaveLength(1);
    const script = `
      import assert from 'node:assert/strict';
      import { createLeanDatabase,requireM85,requireM86,requireM87,catalogueBatch,completeCatalogueV2,
        scanCacheCard,cacheRequest,reuseCatalogueCache,sourcePolicy } from './supabase/tests/phase9/leanCatalogueFixture.mjs';
      import { enableOL,resetActor } from './supabase/tests/phase9/catalogueLinkFixture.mjs';
      const db=await createLeanDatabase({m${level}:true});
      try {
        await enableOL(db);
        await requireM85(db,'marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb)');
        assert.equal((await db.query('SELECT marketplace_sec.phase9_catalogue_valid_cache_v1($1) AS valid',[{}])).rows[0].valid,false);
        const f=await catalogueBatch(db,{},null,{existing:await scanCacheCard(db)});
        assert.equal((await completeCatalogueV2(db,f)).status,'completed'); await resetActor(db);
        if (${level}>=86) {
          await requireM86(db,'marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid)');
          await requireM86(db,'marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)');
          assert.equal((await db.query('SELECT marketplace_sec.phase9_catalogue_query_scope_v1($1,$2) AS scope',[f.candidateId,f.lookupId])).rows[0].scope,'public_bibliographic');
          const id=(await db.query('SELECT cache_entry_id FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0].cache_entry_id;
          assert.notEqual(id,null,'M86 completion must publish');
          const p=await sourcePolicy(db,f.facts);
          assert.equal((await db.query('SELECT marketplace_sec.phase9_catalogue_store_cache_v1($1,$2) AS id',[f.lookupId,p])).rows[0].id,id);
        }
        if (${level}===87) {
          await requireM87(db,'marketplace_sec.phase9_catalogue_reuse_cache_core_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb,jsonb)');
          const receiver=await cacheRequest(db,await scanCacheCard(db));
          assert.equal((await reuseCatalogueCache(db,receiver)).status,'completed');
        }
      } finally { await db.close(); }
    `;
    const result=spawnSync(process.execPath,['--preserve-symlinks','--preserve-symlinks-main','--input-type=module','-e',script],
      {cwd:process.cwd(),encoding:'utf8',timeout:60000});
    expect({status:result.status,error:result.error?.message,stderr:result.stderr}).toEqual({status:0,error:undefined,stderr:''});
  },90000);

  for (const level of levels) it(`M${level}: owns only its assigned changes and references no later chain object`, () => {
    baselineVisible(); expect(names(level)).toHaveLength(1);
    const owned: Record<Level,string[]> = {
      85:['phase9_catalogue_valid_cache_v1','phase9_catalogue_cache_receipt_guard','phase9_edition_guard_automatic_payload',
        'phase9_edition_source_policy','phase9_metadata_cache_reuse_context','phase9_complete_metadata_cache_reuse','phase9_store_metadata_cache'],
      86:['phase9_catalogue_query_scope_v1','phase9_catalogue_store_cache_v1'],
      87:['phase9_catalogue_reuse_cache_core_v1','phase9_reuse_candidate_edition_cache_v1'],
    };
    for (const other of levels) for (const name of owned[other]) {
      if (other>level) expect(sqlAt(level)).not.toMatch(new RegExp(`\\b(?:public|marketplace_sec)\\.${name}\\s*\\(`,'iu'));
      if (other!==level) expect(functions(sqlAt(level)).map(fn=>fn.name.split('.').pop())).not.toContain(name);
    }

    const replaced=functions(sqlAt(level));
    const permitted = new Set(['marketplace_sec.phase9_complete_candidate_edition_options_v2',
      'marketplace_sec.phase9_recover_candidate_edition_options_v1']);
    for (const baseline of functions(m84)) for (const fn of replaced.filter(f=>signature(f)===signature(baseline))) {
      if (level===86 && permitted.has(fn.name)) continue;
      expect(fn.body).toBe(baseline.body);
    }
    const permittedNames = new Set(owned[level]);
    if (level===86) for (const name of permitted) permittedNames.add(name.split('.').pop()!);
    for (const fn of replaced) expect(permittedNames.has(fn.name.split('.').pop()!)).toBe(true);
    // The ordered PGlite case above resolves the fixed signatures and calls each
    // level's real entry points. Do not substitute a self-including name inventory.
  });

  it('[baseline] AC7-21: SQL and generic worker cache/catalogue modules keep provider rules in allowed homes', () => {
    baselineVisible();
    const sql = functions(chain()).reduce((remaining, fn) => {
      if(fn.name === 'marketplace_sec.phase9_catalogue_provider_ids_valid_v1') return remaining.replace(fn.definition,'');
      // 02b sections 8.2/10: preserve M73's external predicate, with no new dispatch.
      if(fn.name === 'marketplace_sec.phase9_edition_source_policy') return remaining.replace(fn.definition,
        fn.definition.replace("r.adapter_key IN('google_books','open_library')",'true'));
      return remaining;
    },chain());
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
    for (const fn of [...baselineFunctions, ...functions(chain())]) {
      if (fn.name !== key.name) expect(fn.body).not.toContain("'psr-catalogue-v1'");
    }
    for (const fn of functions(chain()).filter(value => /pg_advisory_xact_lock/iu.test(value.body))) {
      expect(fn.body).toMatch(/phase9_catalogue_(?:identity_lock_key|plan_keys)_v1\s*\(/iu);
      expect(fn.body).not.toMatch(/(?:substr|substring)\s*\([\s\S]*?(?:sha256|digest)\s*\([\s\S]*?bit\s*\(\s*64\s*\)/iu);
    }
    for (const file of genericModules()) expect(fs.readFileSync(file, 'utf8')).not.toContain('psr-catalogue-v1');
  });
});
