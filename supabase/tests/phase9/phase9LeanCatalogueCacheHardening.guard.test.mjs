// Owner M88 / review A1-A3, 02b sections 6.2/7.1/8.2/12. No TypeScript edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { m85Pattern,m86Pattern,m87Pattern,m88Pattern } from './leanCatalogueFixture.mjs';

const filename='20261029000088_marketplace_phase9_catalogue_cache_hardening.sql';
const sql=fs.readFileSync(migrationPath(filename),'utf8');
const uncomment=s=>s.replace(/--[^\n]*/gu,'').replace(/\/\*[\s\S]*?\*\//gu,'');
const functions=s=>[...s.matchAll(/CREATE OR REPLACE FUNCTION ([\w.]+)\(([^)]*)\)([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/gu)];
const signature='marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)';

test('M88 GUARD: ordered cache tail is M85/M86/M87/M88 with exactly one file per level',()=>{
  const names=fs.readdirSync(migrationPath(''));
  const chain=[m85Pattern,m86Pattern,m87Pattern,m88Pattern].map(pattern=>{
    const matches=names.filter(name=>pattern.test(name)); assert.equal(matches.length,1); return matches[0];
  });
  assert.equal(chain.at(-1),filename);
  assert.deepEqual(chain,chain.toSorted());
});

test('M88 GUARD: only the definer-only helper replacement and its exact OWNER/REVOKE are allowed',()=>{
  const parsed=functions(sql); assert.equal(parsed.length,1);
  const [definition,name,parameters,header]=parsed[0];
  assert.equal(name,'marketplace_sec.phase9_catalogue_store_cache_v1');
  assert.equal(parameters,'p_lookup_id uuid,p_source_policy jsonb');
  assert.match(header,/RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' /u);
  const outside=uncomment(sql.replace(definition,'')).replace(/\s+/gu,'');
  assert.equal(outside,`BEGIN;ALTERFUNCTION${signature}OWNERTOpostgres;REVOKEALLONFUNCTION${signature}FROMPUBLIC,anon,authenticated,service_role;COMMIT;`);
  assert.doesNotMatch(uncomment(sql),/\bGRANT\b|\b(?:CREATE|ALTER|DROP)\s+TABLE\b/iu);
});

test('M88 GUARD: body retains every M86 byte except the three reviewed additions',()=>{
  const predecessor=fs.readdirSync(migrationPath('')).find(name=>m86Pattern.test(name));
  const original=functions(fs.readFileSync(migrationPath(predecessor),'utf8')).find(fn=>fn[1]===signature.split('(')[0])[0];
  let body=functions(sql)[0][0];
  for(const addition of [
    "  -- M88 review A1 / Terra closeout 1: never publish under another routing policy.\n  OR a.routing_policy_version IS DISTINCT FROM l.routing_policy_version\n",
    "  -- M88 review A2 / Muse closeout 1: only the primary attempt publishes.\n  OR a.provider_role IS DISTINCT FROM 'primary'\n",
    " -- M88 review A3 / Terra slice 1 #2: the key-lock wait can exhaust this deadline.\n -- An already-expired just-inserted row is intentionally left for later replacement.\n IF deadline<=pg_catalog.clock_timestamp() THEN RETURN NULL; END IF;\n",
  ]) { assert.ok(body.includes(addition)); body=body.replace(addition,''); }
  assert.equal(body,original);
});

test('M88 GUARD: relations and clocks are qualified and expiry is checked immediately after the key lock',()=>{
  const body=uncomment(functions(sql)[0][4]);
  const reads=body.replace(/IS(?: NOT)? DISTINCT FROM/gu,'IS_DISTINCT_FROM');
  for(const [,name] of reads.matchAll(/\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE)\s+([a-z_]\w*(?:\.[a-z_]\w*)?)/giu))
    assert.match(name,/^(?:public|marketplace_sec|pg_catalog)\./u,`unqualified relation: ${name}`);
  assert.doesNotMatch(body,/(?<![\w.])clock_timestamp\s*\(/u);
  assert.match(body,/WHERE provider_cache_identity=key FOR UPDATE;\s*IF deadline<=pg_catalog\.clock_timestamp\(\) THEN RETURN NULL; END IF;/u);
  assert.match(body,/a\.routing_policy_version IS DISTINCT FROM l\.routing_policy_version/u);
  assert.match(body,/a\.provider_role IS DISTINCT FROM 'primary'/u);
});
