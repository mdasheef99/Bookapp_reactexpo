import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createPhase9Database,
  resetActor,
  scalar,
  setActor,
} from './databaseHarness.mjs';
import {
  bindCanonicalBenchmarkHashes,
  createCanonicalBenchmarkPayload,
  OWNER,
} from './variantOwnerFixture.mjs';

const PLATFORM = '71000000-0000-0000-0000-000000000079';
const PLATFORM_2 = '71000000-0000-0000-0000-000000000080';
const migration =
  '20260729000028_marketplace_phase9_variant_benchmark_evidence_read.sql';
const json = (value) => JSON.stringify(value).replaceAll("'", "''");
let db;
let sequence = 0;

const hash = () => (++sequence).toString(16).padStart(64, '0');
const payload = (statuses) => createCanonicalBenchmarkPayload(statuses, ++sequence);
async function record(input) {
  return scalar(db, `SELECT public.phase9_record_search_variant_benchmark(
    '${json(input.manifest)}'::jsonb,'${json(input.execution)}'::jsonb)`);
}
async function rejectRecord(input, pattern) {
  await assert.rejects(record(input), pattern);
}
async function serverCanonicalHashes(input) {
  return (await db.query(`WITH evidence AS (
    SELECT '${json(input.manifest)}'::jsonb manifest
  )
  SELECT encode(sha256(convert_to(jsonb_build_array(
      manifest->>'canonicalization_version',
      manifest-ARRAY['canonicalization_version','sample_count',
        'dataset_identity','fixture_set_sha256'])::text,'UTF8')),'hex')
      AS dataset_identity,
    encode(sha256(convert_to(jsonb_build_array(
      manifest->>'canonicalization_version',manifest->'fixtures'
    )::text,'UTF8')),'hex') AS fixture_set_sha256
  FROM evidence`)).rows[0];
}
async function review(executionId, action, request, prior = null, actor = PLATFORM) {
  await setActor(db, actor, 'authenticated');
  const priorSql = prior === null ? 'NULL' : `'${prior}'`;
  return scalar(db, `SELECT public.phase9_review_search_variant_benchmark(
    '${executionId}','${action}','benchmark_${action}',NULL,
    '${request}',${priorSql})`);
}

before(async () => {
  db = await createPhase9Database({ throughMigration: migration });
  await db.exec(`CREATE OR REPLACE FUNCTION marketplace_sec.has_platform_role(
    roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT auth.uid() IN ('${PLATFORM}'::uuid,'${PLATFORM_2}'::uuid)
        AND 'platform_admin'=ANY(roles)
    $$`);
});
beforeEach(async () => {
  await resetActor(db);
  await db.exec(`TRUNCATE public.phase9_search_variant_rollout_audit,
    public.phase9_search_variant_language_rollouts,
    public.phase9_search_variant_benchmark_reviews,
    public.phase9_search_variant_benchmark_executions,
    public.phase9_search_variant_benchmark_manifests CASCADE`);
  await setActor(db, PLATFORM, 'service_role');
});
after(async () => db.close());

test('server derives structural eligibility from complete evidence', async () => {
  for (const count of [0, 99, 100]) {
    const input = payload(Array(count).fill('complete'));
    const saved = await record(input);
    assert.equal(await scalar(db, `SELECT eligible_for_review
      FROM public.phase9_search_variant_benchmark_executions
      WHERE id='${saved.execution_id}'`), count === 100);
  }
  const failed = payload([...Array(100).fill('complete'), 'failed']);
  const invalid = payload([...Array(100).fill('complete'), 'invalid']);
  const excluded = payload([...Array(100).fill('complete'), 'excluded']);
  for (const input of [failed, invalid, excluded]) {
    const saved = await record(input);
    assert.equal(await scalar(db, `SELECT eligible_for_review
      FROM public.phase9_search_variant_benchmark_executions
      WHERE id='${saved.execution_id}'`), true);
  }
});

test('SQL derives exact match and rejects coordinated forged quality metrics', async () => {
  const forged = payload(Array(100).fill('complete'));
  forged.manifest.fixtures[0].captured_output = 'different-output';
  bindCanonicalBenchmarkHashes(forged);
  await rejectRecord(
    forged,
    /P9_BENCHMARK_(EXACT_MATCH_MISMATCH|COUNT_MISMATCH)/,
  );

  const falseNegative = payload(Array(100).fill('complete'));
  falseNegative.execution.result.items[0].exact_match = false;
  falseNegative.execution.result.aggregate.exact_match_count -= 1;
  falseNegative.execution.result.per_field[0].exact_match_count -= 1;
  falseNegative.execution.result.per_scenario[0].exact_match_count -= 1;
  await rejectRecord(
    falseNegative,
    /P9_BENCHMARK_(EXACT_MATCH_MISMATCH|COUNT_MISMATCH)/,
  );
});

test('SQL rejects a forged caller execution-result hash', async () => {
  const forged = payload(Array(100).fill('complete'));
  forged.execution.result_sha256 = 'f'.repeat(64);
  await rejectRecord(forged, /P9_BENCHMARK_RESULT_IDENTITY_MISMATCH/);
});

test('every enabled rollout capability requires effective approved evidence', async () => {
  for (const [vision, romanization, automatic] of [
    [true, false, false],
    [false, true, false],
    [false, false, true],
  ]) {
    await setActor(db, PLATFORM, 'authenticated');
    await assert.rejects(db.query(
      `SELECT public.phase9_set_search_variant_language_rollout(
        'kn','Knda','fixture-policy-v1',1,${vision},${romanization},
        ${automatic},NULL,'approval_required','${hash()}')`),
    /P9_ROLLOUT_EVIDENCE_INVALID/);
  }
  await setActor(db, PLATFORM, 'authenticated');
  assert.equal((await scalar(db,
    `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,false,false,false,NULL,
      'all_disabled','${hash()}')`)).replayed, false);
});

test('platform-only evidence reads provide deterministic reconstruction', async () => {
  const input = payload(Array(100).fill('complete'));
  const saved = await record(input);
  await setActor(db, PLATFORM, 'authenticated');
  const summary = await scalar(db,
    `SELECT public.phase9_platform_search_variant_benchmark_summary(
      '${saved.execution_id}')`);
  assert.equal(summary.execution_identity, input.execution.execution_identity);
  assert.equal(summary.sample_count, 100);
  const first = (await db.query(
    `SELECT * FROM public.phase9_platform_search_variant_benchmark_evidence(
      '${saved.execution_id}',NULL,40)`)).rows;
  const second = (await db.query(
    `SELECT * FROM public.phase9_platform_search_variant_benchmark_evidence(
      '${saved.execution_id}','${first.at(-1).fixture_id}',100)`)).rows;
  const ids = [...first, ...second].map((row) => row.fixture_id);
  assert.equal(ids.length, 100);
  assert.equal(new Set(ids).size, 100);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(first[0].source_text, input.manifest.fixtures[0].source_text);
  assert.equal(first[0].evaluation_obligation, 'required');
  assert.equal(first[0].exact_match, true);

  for (const [actor, role] of [
    [OWNER, 'authenticated'],
    ['71000000-0000-0000-0000-000000000081', 'authenticated'],
    [OWNER, 'anon'],
  ]) {
    await setActor(db, actor, role);
    await assert.rejects(db.query(
      `SELECT public.phase9_platform_search_variant_benchmark_summary(
        '${saved.execution_id}')`),
    /P9_OWNER_NOT_AUTHORIZED|permission denied/i);
  }
  await setActor(db, PLATFORM, 'authenticated');
  await assert.rejects(db.query(
    `SELECT public.phase9_platform_search_variant_benchmark_summary(
      '00000000-0000-0000-0000-000000000000')`),
  /P9_REQUEST_INVALID/);
});

test('canonical manifest is immutable reconstructable and hash bound', async () => {
  const valid = payload(Array(100).fill('complete'));
  const saved = await record(valid);
  const persisted = (await db.query(`SELECT canonicalization_version,
    canonical_manifest,dataset_identity,fixture_set_sha256
    FROM public.phase9_search_variant_benchmark_manifests
    WHERE id='${saved.manifest_id}'`)).rows[0];
  assert.equal(
    persisted.canonicalization_version,
    'p9-search-variant-benchmark-canonical-v1',
  );
  assert.equal(persisted.canonical_manifest.fixtures.length, 100);
  assert.deepEqual(
    persisted.canonical_manifest.fixtures[0],
    valid.manifest.fixtures[0],
  );
  await resetActor(db);
  await assert.rejects(
    db.query(`UPDATE public.phase9_search_variant_benchmark_manifests
      SET canonical_manifest='{}' WHERE id='${saved.manifest_id}'`),
    /P9_APPEND_ONLY_VIOLATION/,
  );
  await setActor(db, PLATFORM, 'service_role');

  for (const key of ['source_text', 'expected_variant', 'captured_output']) {
    const missing = payload(Array(100).fill('complete'));
    delete missing.manifest.fixtures[0][key];
    await rejectRecord(missing, /P9_BENCHMARK_RESULT_INVALID/);
  }
  const forgedManifest = payload(Array(100).fill('complete'));
  forgedManifest.manifest.dataset_identity = 'a'.repeat(64);
  forgedManifest.execution.result.dataset_identity = 'a'.repeat(64);
  await rejectRecord(forgedManifest, /P9_BENCHMARK_IDENTITY_MISMATCH/);
  const forgedFixtures = payload(Array(100).fill('complete'));
  forgedFixtures.manifest.fixture_set_sha256 = 'a'.repeat(64);
  await rejectRecord(forgedFixtures, /P9_BENCHMARK_IDENTITY_MISMATCH/);
});

test('canonical benchmark evidence remains private to audit tooling', async () => {
  const saved = await record(payload(Array(100).fill('complete')));
  for (const [actor, role] of [[PLATFORM, 'anon'], [OWNER, 'authenticated']]) {
    await setActor(db, actor, role);
    await assert.rejects(
      db.query(`SELECT canonical_manifest
        FROM public.phase9_search_variant_benchmark_manifests
        WHERE id='${saved.manifest_id}'`),
      /permission denied/,
    );
  }
});

test('server hashes all canonical evidence deterministically', async () => {
  const base = payload(Array(100).fill('complete'));
  const baseHashes = await serverCanonicalHashes(base);
  for (const mutate of [
    (input) => { input.manifest.fixtures[0].source_text += '-changed'; },
    (input) => { input.manifest.fixtures[0].expected_variant += '-changed'; },
    (input) => {
      input.manifest.fixtures[0].evaluation_obligation = 'exclusion_permitted';
      input.manifest.fixtures[0].authorized_exclusion_category = 'policy_waiver';
    },
    (input) => {
      input.manifest.fixtures.push({
        ...input.manifest.fixtures[0],
        fixture_id: 'zz-extra-fixture',
      });
    },
  ]) {
    const changed = structuredClone(base);
    mutate(changed);
    bindCanonicalBenchmarkHashes(changed);
    const hashes = await serverCanonicalHashes(changed);
    assert.equal(hashes.dataset_identity, changed.manifest.dataset_identity);
    assert.equal(hashes.fixture_set_sha256, changed.manifest.fixture_set_sha256);
    assert.notEqual(hashes.dataset_identity, baseHashes.dataset_identity);
    assert.notEqual(hashes.fixture_set_sha256, baseHashes.fixture_set_sha256);
  }
  const reordered = payload(Array(100).fill('complete'));
  reordered.manifest = Object.fromEntries(
    Object.entries(reordered.manifest).reverse(),
  );
  reordered.manifest.fixtures = reordered.manifest.fixtures.map(
    (fixture) => Object.fromEntries(Object.entries(fixture).reverse()),
  );
  assert.ok(await record(reordered));
  const unsorted = payload(Array(100).fill('complete'));
  unsorted.manifest.fixtures.reverse();
  await rejectRecord(unsorted, /P9_BENCHMARK_IDENTITY_MISMATCH/);
});

test('SQL dataset_version boundary exactly matches the canonical runner', async () => {
  for (const [value, valid] of [
    ['a', false],
    ['v1', true],
    ['v'.repeat(64), true],
    ['v'.repeat(65), false],
    ['v:1', false],
    [' v1', false],
    ['v1 ', false],
  ]) {
    const input = payload(Array(100).fill('complete'));
    input.manifest.dataset_version = value;
    bindCanonicalBenchmarkHashes(input);
    if (valid) assert.ok(await record(input));
    else await rejectRecord(input, /P9_REQUEST_INVALID/);
  }
});

test('persistence rejects malformed, omitted, forced, and inconsistent counts', async () => {
  const malformed = payload(Array(100).fill('complete'));
  malformed.execution.result.per_field = [];
  await rejectRecord(malformed, /P9_BENCHMARK_COUNT_MISMATCH/);
  for (const key of ['failed_item_count', 'invalid_item_count']) {
    const omitted = payload(Array(100).fill('complete'));
    delete omitted.execution.result.aggregate[key];
    await rejectRecord(omitted, /P9_BENCHMARK_RESULT_INVALID/);
  }
  const forced = payload(Array(99).fill('complete'));
  forced.execution.result.eligible_for_review = true;
  forced.execution.result.denial_reason = null;
  await rejectRecord(forced, /P9_BENCHMARK_ELIGIBILITY_MISMATCH/);
  const countMismatch = payload(Array(100).fill('complete'));
  countMismatch.execution.result.aggregate.complete_item_count = 99;
  await rejectRecord(countMismatch, /P9_BENCHMARK_COUNT_MISMATCH/);
  const sampleMismatch = payload(Array(100).fill('complete'));
  sampleMismatch.manifest.sample_count = 101;
  await rejectRecord(sampleMismatch, /P9_BENCHMARK_COUNT_MISMATCH/);
  const arrayResult = payload(Array(100).fill('complete'));
  arrayResult.execution.result = [];
  await rejectRecord(arrayResult, /P9_BENCHMARK_RESULT_INVALID/);
  const unauthorized = payload([...Array(100).fill('complete'), 'excluded']);
  const excludedFixture = unauthorized.manifest.fixtures.find(
    (fixture) => fixture.result_status === 'excluded',
  );
  excludedFixture.evaluation_obligation = 'required';
  excludedFixture.authorized_exclusion_category = null;
  await rejectRecord(unauthorized, /P9_BENCHMARK_RESULT_INVALID/);
});

test('manifest authority rejects exclusion relabelling and wrong categories', async () => {
  const valid = payload([...Array(100).fill('complete'), 'excluded']);
  assert.ok(await record(valid));

  for (const status of ['complete', 'failed', 'invalid']) {
    const relabelled = payload([...Array(100).fill('complete'), status]);
    const item = relabelled.execution.result.items.at(-1);
    item.status = 'excluded';
    item.exact_match = null;
    item.governed_exclusion_category = 'unreadable_spine';
    await rejectRecord(relabelled, /P9_BENCHMARK_ITEM_SET_MISMATCH/);
  }

  const wrongCategory = payload([...Array(100).fill('complete'), 'excluded']);
  wrongCategory.execution.result.items.find(
    (item) => item.status === 'excluded',
  ).governed_exclusion_category = 'policy_waiver';
  await rejectRecord(wrongCategory, /P9_BENCHMARK_ITEM_SET_MISMATCH/);

  const missingFixture = payload(Array(100).fill('complete'));
  missingFixture.manifest.fixtures.pop();
  await rejectRecord(missingFixture, /P9_BENCHMARK_COUNT_MISMATCH/);

  const duplicateFixture = payload(Array(100).fill('complete'));
  duplicateFixture.manifest.fixtures[99].fixture_id =
    duplicateFixture.manifest.fixtures[98].fixture_id;
  await rejectRecord(duplicateFixture, /P9_BENCHMARK_ITEM_SET_MISMATCH/);
});

test('field and scenario metrics must exactly match item evidence', async () => {
  const valid = payload([
    ...Array(100).fill('complete'), 'failed', 'invalid', 'excluded',
  ]);
  assert.ok(await record(valid));

  const mutations = [
    (input) => { input.execution.result.items[0].field = 'publisher'; },
    (input) => { input.execution.result.items[0].scenario = 'invented_case'; },
    (input) => { input.execution.result.per_field.push(
      { ...input.execution.result.per_field[0] },
    ); },
    (input) => { input.execution.result.per_scenario.push({
      ...input.execution.result.per_scenario[0], scenario: 'invented_case',
    }); },
    (input) => { input.execution.result.per_field = []; },
    (input) => { input.execution.result.per_scenario = []; },
  ];
  for (const mutate of mutations) {
    const input = payload(Array(100).fill('complete'));
    mutate(input);
    await rejectRecord(input, /P9_BENCHMARK_(RESULT_INVALID|ITEM_SET_MISMATCH|COUNT_MISMATCH)/);
  }

  for (const key of [
    'total_item_count', 'complete_item_count', 'failed_item_count',
    'invalid_item_count', 'governed_excluded_count', 'exact_match_count',
  ]) {
    for (const group of ['aggregate', 'per_field', 'per_scenario']) {
      const input = payload([
        ...Array(100).fill('complete'), 'failed', 'invalid', 'excluded',
      ]);
      const target = group === 'aggregate'
        ? input.execution.result.aggregate : input.execution.result[group][0];
      target[key] += 1;
      await rejectRecord(input, /P9_BENCHMARK_COUNT_MISMATCH/);
    }
  }
});

test('required execution identities reject empty whitespace and malformed values', async () => {
  const manifestKeys = ['dataset_version', 'language', 'script'];
  const executionKeys = [
    'model_key', 'model_version', 'prompt_version', 'sidecar_schema_version',
    'policy_version', 'runner_version',
  ];
  for (const key of manifestKeys) {
    for (const invalid of ['', '   ', ' invalid identity ']) {
      const input = payload(Array(100).fill('complete'));
      input.manifest[key] = invalid;
      await rejectRecord(input, /P9_REQUEST_INVALID|violates check constraint/);
    }
  }
  for (const key of executionKeys) {
    for (const invalid of ['', '   ', ' invalid identity ']) {
      const input = payload(Array(100).fill('complete'));
      input.execution[key] = invalid;
      input.execution.result[key] = invalid;
      await rejectRecord(input, /P9_REQUEST_INVALID|violates check constraint/);
    }
  }
});

test('required benchmark keys reject missing null and wrong types fail closed', async () => {
  const cases = [
    ['manifest schema', (input) => input.manifest,
      'schema_version', 7],
    ['canonicalization version', (input) => input.manifest,
      'canonicalization_version', 7],
    ['manifest dataset key', (input) => input.manifest,
      'dataset_key', 7],
    ['manifest dataset version', (input) => input.manifest,
      'dataset_version', 7],
    ['manifest dataset identity', (input) => input.manifest,
      'dataset_identity', 7],
    ['manifest language', (input) => input.manifest,
      'language', 7],
    ['manifest script', (input) => input.manifest,
      'script', 7],
    ['manifest sample count', (input) => input.manifest,
      'sample_count', '100'],
    ['manifest fixtures', (input) => input.manifest,
      'fixtures', {}],
    ['manifest fixture hash', (input) => input.manifest,
      'fixture_set_sha256', 7],
    ['fixture obligation', (input) => input.manifest.fixtures[0],
      'evaluation_obligation', 7],
    ['fixture identity', (input) => input.manifest.fixtures[0],
      'fixture_id', 7],
    ['fixture field', (input) => input.manifest.fixtures[0],
      'field', 7],
    ['fixture scenario', (input) => input.manifest.fixtures[0],
      'scenario', 7],
    ['fixture source', (input) => input.manifest.fixtures[0],
      'source_text', 7],
    ['fixture expected variant', (input) => input.manifest.fixtures[0],
      'expected_variant', 7],
    ['fixture captured output', (input) => input.manifest.fixtures[0],
      'captured_output', 7],
    ['fixture outcome', (input) => input.manifest.fixtures[0],
      'result_status', 7],
    ['execution identity', (input) => input.execution,
      'execution_identity', 7],
    ['execution model key', (input) => input.execution,
      'model_key', 7],
    ['execution model version', (input) => input.execution,
      'model_version', 7],
    ['execution prompt version', (input) => input.execution,
      'prompt_version', 7],
    ['execution sidecar schema', (input) => input.execution,
      'sidecar_schema_version', 7],
    ['execution policy version', (input) => input.execution,
      'policy_version', 7],
    ['execution runner version', (input) => input.execution,
      'runner_version', 7],
    ['execution result hash', (input) => input.execution,
      'result_sha256', 7],
    ['execution result', (input) => input.execution,
      'result', []],
    ['result item identity', (input) => input.execution.result.items[0],
      'fixture_id', 7],
    ['result item field', (input) => input.execution.result.items[0],
      'field', 7],
    ['result item scenario', (input) => input.execution.result.items[0],
      'scenario', 7],
    ['result outcome', (input) => input.execution.result.items[0],
      'status', 7],
    ['complete exact match', (input) => input.execution.result.items[0],
      'exact_match', 'true'],
    ['result schema', (input) => input.execution.result,
      'result_schema_version', 7],
    ['result dataset key', (input) => input.execution.result,
      'dataset_key', 7],
    ['result dataset version', (input) => input.execution.result,
      'dataset_version', 7],
    ['result dataset identity', (input) => input.execution.result,
      'dataset_identity', 7],
    ['result language', (input) => input.execution.result,
      'language', 7],
    ['result script', (input) => input.execution.result,
      'script', 7],
    ['result model', (input) => input.execution.result,
      'model_key', 7],
    ['result model version', (input) => input.execution.result,
      'model_version', 7],
    ['result prompt version', (input) => input.execution.result,
      'prompt_version', 7],
    ['result sidecar schema', (input) => input.execution.result,
      'sidecar_schema_version', 7],
    ['result policy version', (input) => input.execution.result,
      'policy_version', 7],
    ['result aggregate', (input) => input.execution.result,
      'aggregate', []],
    ['result field metrics', (input) => input.execution.result,
      'per_field', {}],
    ['result scenario metrics', (input) => input.execution.result,
      'per_scenario', {}],
    ['result items', (input) => input.execution.result,
      'items', {}],
    ['review eligibility', (input) => input.execution.result,
      'eligible_for_review', 'true'],
    ['aggregate count', (input) => input.execution.result.aggregate,
      'complete_item_count', '100'],
    ['field metric key', (input) => input.execution.result.per_field[0],
      'field', 7],
    ['scenario metric key', (input) => input.execution.result.per_scenario[0],
      'scenario', 7],
  ];
  for (const [label, target, key, wrongType] of cases) {
    for (const mode of ['missing', 'null', 'wrong-type']) {
      const input = payload(Array(100).fill('complete'));
      const object = target(input);
      if (mode === 'missing') delete object[key];
      if (mode === 'null') object[key] = null;
      if (mode === 'wrong-type') object[key] = wrongType;
      await assert.rejects(
        record(input),
        /P9_(BENCHMARK_(RESULT_INVALID|ITEM_SET_MISMATCH|COUNT_MISMATCH|IDENTITY_MISMATCH|ELIGIBILITY_MISMATCH)|REQUEST_INVALID)/,
        `${label} ${mode}`,
      );
    }
  }
  for (const key of [
    'total_item_count', 'complete_item_count', 'failed_item_count',
    'invalid_item_count', 'governed_excluded_count', 'exact_match_count',
  ]) {
    for (const target of [
      (input) => input.execution.result.aggregate,
      (input) => input.execution.result.per_field[0],
      (input) => input.execution.result.per_scenario[0],
    ]) {
      for (const invalid of [undefined, null, '100', 100.5, -1]) {
        const input = payload(Array(100).fill('complete'));
        const object = target(input);
        if (invalid === undefined) delete object[key];
        else object[key] = invalid;
        await rejectRecord(
          input,
          /P9_BENCHMARK_(RESULT_INVALID|COUNT_MISMATCH)/,
        );
      }
    }
  }
  for (const invalid of [undefined, null, '100', 100.5, -1, 10_001]) {
    const input = payload(Array(100).fill('complete'));
    if (invalid === undefined) delete input.manifest.sample_count;
    else input.manifest.sample_count = invalid;
    await rejectRecord(input, /P9_BENCHMARK_(RESULT_INVALID|COUNT_MISMATCH)/);
  }
  for (const invalid of [undefined, 'unreadable_spine', 7]) {
    const input = payload(Array(100).fill('complete'));
    const fixture = input.manifest.fixtures[0];
    if (invalid === undefined) delete fixture.authorized_exclusion_category;
    else fixture.authorized_exclusion_category = invalid;
    await rejectRecord(input, /P9_BENCHMARK_RESULT_INVALID/);
  }
  for (const invalid of [undefined, null, '', '   ', 7, 'INVALID']) {
    const input = payload([...Array(100).fill('complete'), 'excluded']);
    const fixture = input.manifest.fixtures.find(
      (row) => row.result_status === 'excluded',
    );
    if (invalid === undefined) delete fixture.authorized_exclusion_category;
    else fixture.authorized_exclusion_category = invalid;
    await rejectRecord(input, /P9_BENCHMARK_RESULT_INVALID/);
  }
  for (const invalid of [undefined, 'unreadable_spine', 7]) {
    const input = payload(Array(100).fill('complete'));
    const item = input.execution.result.items[0];
    if (invalid === undefined) delete item.governed_exclusion_category;
    else item.governed_exclusion_category = invalid;
    await rejectRecord(input, /P9_BENCHMARK_RESULT_INVALID/);
  }
  for (const invalid of [undefined, null, '', '   ', 7, 'INVALID']) {
    const input = payload([...Array(100).fill('complete'), 'excluded']);
    const item = input.execution.result.items.find(
      (row) => row.status === 'excluded',
    );
    if (invalid === undefined) delete item.governed_exclusion_category;
    else item.governed_exclusion_category = invalid;
    await rejectRecord(
      input,
      /P9_BENCHMARK_(RESULT_INVALID|ITEM_SET_MISMATCH)/,
    );
  }
  for (const invalid of [undefined, null, 'true', 1]) {
    const input = payload(Array(100).fill('complete'));
    if (invalid === undefined) delete input.execution.result.eligible_for_review;
    else input.execution.result.eligible_for_review = invalid;
    await rejectRecord(input, /P9_BENCHMARK_ELIGIBILITY_MISMATCH|P9_BENCHMARK_RESULT_INVALID/);
  }
  for (const invalid of [undefined, '', '   ', 7, 'insufficient_dataset']) {
    const input = payload(Array(100).fill('complete'));
    if (invalid === undefined) delete input.execution.result.denial_reason;
    else input.execution.result.denial_reason = invalid;
    await rejectRecord(input, /P9_BENCHMARK_ELIGIBILITY_MISMATCH|P9_BENCHMARK_RESULT_INVALID/);
  }
  for (const invalid of [undefined, null, '', '   ', 7, 'no_qualifying_dataset']) {
    const input = payload(Array(99).fill('complete'));
    if (invalid === undefined) delete input.execution.result.denial_reason;
    else input.execution.result.denial_reason = invalid;
    await rejectRecord(input, /P9_BENCHMARK_ELIGIBILITY_MISMATCH|P9_BENCHMARK_RESULT_INVALID/);
  }
  for (const invalid of [undefined, null, '   ']) {
    const input = payload(Array(100).fill('complete'));
    if (invalid === undefined) {
      delete input.execution.model_key;
    } else {
      input.execution.model_key = invalid;
    }
    await rejectRecord(input, /P9_REQUEST_INVALID/);
  }
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_benchmark_executions`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_benchmark_reviews`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_language_rollouts`), 0);
});

test('persistence rejects duplicate or missing item evidence and accepts exact replay', async () => {
  const duplicate = payload(Array(100).fill('complete'));
  duplicate.execution.result.items[99].fixture_id =
    duplicate.execution.result.items[98].fixture_id;
  await rejectRecord(duplicate, /P9_BENCHMARK_ITEM_SET_MISMATCH/);
  const missing = payload(Array(100).fill('complete'));
  missing.execution.result.items.pop();
  await rejectRecord(missing, /P9_BENCHMARK_COUNT_MISMATCH/);
  const valid = payload(Array(100).fill('complete'));
  const first = await record(valid);
  assert.deepEqual(await record(valid), first);
  valid.execution.result.items[0].exact_match = false;
  await rejectRecord(valid, /P9_BENCHMARK_EXACT_MATCH_MISMATCH/);
});

test('review state rejects pre-terminal, missing, unrelated, and non-approved links', async () => {
  const first = await record(payload(Array(100).fill('complete')));
  const second = await record(payload(Array(100).fill('complete')));
  await assert.rejects(
    review(first.execution_id, 'revoked', hash()), /P9_REVIEW_TRANSITION_INVALID/);
  await assert.rejects(
    review(first.execution_id, 'superseded', hash()), /P9_REVIEW_TRANSITION_INVALID/);
  const rejected = await review(first.execution_id, 'rejected', hash());
  await assert.rejects(
    review(first.execution_id, 'approved', hash()), /P9_REVIEW_TRANSITION_INVALID/);
  await assert.rejects(
    review(first.execution_id, 'revoked', hash(), rejected),
    /P9_REVIEW_TRANSITION_INVALID/);
  const otherApproval = await review(second.execution_id, 'approved', hash());
  await assert.rejects(
    review(first.execution_id, 'revoked', hash(), otherApproval),
    /P9_REVIEW_TRANSITION_INVALID/);
});

test('benchmark review required inputs reject null empty and malformed values', async () => {
  const recorded = await record(payload(Array(100).fill('complete')));
  await setActor(db, PLATFORM, 'authenticated');
  const calls = [
    `NULL,'benchmark_approved',NULL,'${hash()}',NULL`,
    `'approved',NULL,NULL,'${hash()}',NULL`,
    `'approved','',NULL,'${hash()}',NULL`,
    `'approved','   ',NULL,'${hash()}',NULL`,
    `'invalid','benchmark_invalid',NULL,'${hash()}',NULL`,
    `'approved','benchmark_approved',NULL,NULL,NULL`,
    `'approved','benchmark_approved',NULL,'',NULL`,
    `'approved','benchmark_approved',NULL,'bad',NULL`,
    `'approved','benchmark_approved','   ','${hash()}',NULL`,
  ];
  for (const args of calls) {
    await assert.rejects(
      db.query(`SELECT public.phase9_review_search_variant_benchmark(
        '${recorded.execution_id}',${args})`),
      /P9_REQUEST_INVALID/,
    );
  }
});

test('structural eligibility still requires an explicit approved review', async () => {
  const recorded = await record(payload([
    ...Array(100).fill('complete'), 'failed', 'invalid', 'excluded',
  ]));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_benchmark_reviews
    WHERE execution_id='${recorded.execution_id}'`), 0);
  const rejection = await review(recorded.execution_id, 'rejected', hash());
  assert.ok(rejection);
  await assert.rejects(db.query(
    `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,true,true,true,
      '${rejection}','quality_rejected','${hash()}')`),
  /P9_ROLLOUT_EVIDENCE_INVALID/);
  await setActor(db, PLATFORM, 'service_role');
  const approvedExecution = await record(payload([
    ...Array(100).fill('complete'), 'failed',
  ]));
  const approval = await review(approvedExecution.execution_id, 'approved', hash());
  assert.equal((await scalar(db,
    `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,true,true,true,
      '${approval}','quality_approved','${hash()}')`)).replayed, false);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_benchmark_reviews
    WHERE execution_id='${recorded.execution_id}' AND action='approved'`), 0);
});

test('approve then revoke/supersede is linked, replay-fenced, and latest-state authoritative', async () => {
  for (const terminal of ['revoked', 'superseded']) {
    const recorded = await record(payload(Array(100).fill('complete')));
    const request = hash();
    const approval = await review(recorded.execution_id, 'approved', request);
    assert.equal(await review(recorded.execution_id, 'approved', request), approval);
    await assert.rejects(
      review(recorded.execution_id, 'approved', request, null, PLATFORM_2),
      /P9_IDEMPOTENCY_CONFLICT/);
    const terminalReview = await review(recorded.execution_id, terminal, hash(), approval);
    await resetActor(db);
    assert.equal(await scalar(db, `SELECT prior_review_id::text
      FROM public.phase9_search_variant_benchmark_reviews
      WHERE id='${terminalReview}'`), approval);
    assert.equal(await scalar(db,
      `SELECT marketplace_sec.phase9_benchmark_review_is_effective_approval(
        '${approval}')`), false);
  }
});

test('same-transaction ordering and competing approvals fail closed', async () => {
  const recorded = await record(payload(Array(100).fill('complete')));
  await setActor(db, PLATFORM, 'authenticated');
  await db.exec('BEGIN');
  const approval = await review(recorded.execution_id, 'approved', hash());
  await review(recorded.execution_id, 'revoked', hash(), approval);
  await resetActor(db);
  assert.equal(await scalar(db,
    `SELECT marketplace_sec.phase9_benchmark_review_is_effective_approval(
      '${approval}')`), false);
  await db.exec('COMMIT');
  await setActor(db, PLATFORM, 'service_role');
  const competing = await record(payload(Array(100).fill('complete')));
  await assert.rejects(
    Promise.all([
      review(competing.execution_id, 'approved', hash(), null, PLATFORM),
      review(competing.execution_id, 'approved', hash(), null, PLATFORM_2),
    ]), /P9_REVIEW_TRANSITION_INVALID|duplicate key/);
});
