import {
  buildBenchmarkPersistenceInput,
  benchmarkDatasetIdentity,
  benchmarkFixtureSetIdentity,
  benchmarkResultIdentity,
  parseBenchmarkManifest,
  runSearchVariantBenchmark,
} from '../_shared/imageInventory/searchVariants/benchmark';
import {
  createDatabaseAutomaticActivationPolicy,
} from '../_shared/imageInventory/searchVariants/rolloutPolicy';

const manifest = {
  schema_version: 'p9-search-variant-benchmark-manifest-v1',
  dataset_key: 'kannada-spines',
  dataset_version: '2026-07-29',
  language: 'kn',
  script: 'Knda',
  fixtures: [{
    fixture_id: 'kn-title-001',
    field: 'title',
    scenario: 'clean_single_spine',
    source_text: 'ಗೋದಾನ',
    expected_variant: 'Godaan',
    captured_output: 'Godaan',
    result_status: 'complete',
    evaluation_obligation: 'required',
    authorized_exclusion_category: null,
  }],
};
const fixtures = (
  count: number,
  finalStatus: 'complete' | 'failed' | 'invalid' | 'excluded' = 'complete',
) => Array.from(
  { length: count },
  (_, index) => ({
    ...manifest.fixtures[0],
    fixture_id: `kn-title-${String(index + 1).padStart(3, '0')}`,
    result_status: index === count - 1 ? finalStatus : 'complete',
    evaluation_obligation: index === count - 1 && finalStatus === 'excluded'
      ? 'exclusion_permitted' : 'required',
    authorized_exclusion_category:
      index === count - 1 && finalStatus === 'excluded' ? 'unreadable_spine' : null,
    captured_output: index === count - 1 && finalStatus !== 'complete'
      ? null : 'Godaan',
  }),
);
const identity = {
  executionIdentity: 'd'.repeat(64),
  datasetIdentity: 'b'.repeat(64),
  fixtureSetSha256: 'c'.repeat(64),
  modelKey: 'fixture_multimodal',
  modelVersion: '2026-07-26',
  promptVersion: 'fixture-prompt-v2',
  sidecarSchemaVersion: 'search_variant_proposals_v1',
  policyVersion: 'fixture-policy-v1',
  runnerVersion: 'runner-v1',
  resultSha256: 'e'.repeat(64),
};

describe('Phase 9 Unit 5C-6 benchmark and rollout contracts', () => {
  it('validates a versioned manifest and hashes canonical fixture content', async () => {
    const parsed = parseBenchmarkManifest(manifest);
    expect(parsed.schemaVersion).toBe('p9-search-variant-benchmark-manifest-v1');
    await expect(benchmarkDatasetIdentity(parsed)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(benchmarkFixtureSetIdentity(parsed)).resolves
      .toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['a', false],
    ['v1', true],
    ['v'.repeat(64), true],
    ['v'.repeat(65), false],
    ['v:1', false],
    [' v1', false],
    ['v1 ', false],
  ])('enforces dataset_version parity for %s', (datasetVersion, valid) => {
    const input = { ...manifest, dataset_version: datasetVersion };
    if (valid) expect(parseBenchmarkManifest(input).datasetVersion).toBe(datasetVersion);
    else expect(() => parseBenchmarkManifest(input)).toThrow('dataset_version');
  });

  it('hashes canonical fixture evidence in deterministic fixture-id order', async () => {
    const input = {
      ...manifest,
      fixtures: [
        { ...manifest.fixtures[0], fixture_id: 'kn-title-002' },
        { ...manifest.fixtures[0], fixture_id: 'kn-title-001' },
      ],
    };
    const reversed = { ...input, fixtures: [...input.fixtures].reverse() };
    const first = parseBenchmarkManifest(input);
    const second = parseBenchmarkManifest(reversed);
    await expect(benchmarkDatasetIdentity(first))
      .resolves.toBe(await benchmarkDatasetIdentity(second));
    await expect(benchmarkFixtureSetIdentity(first))
      .resolves.toBe(await benchmarkFixtureSetIdentity(second));

    for (const key of [
      'source_text', 'expected_variant', 'captured_output',
      'evaluation_obligation', 'authorized_exclusion_category',
    ] as const) {
      const changed = structuredClone(input) as any;
      if (key === 'evaluation_obligation'
        || key === 'authorized_exclusion_category') {
        changed.fixtures[0].evaluation_obligation = 'exclusion_permitted';
        changed.fixtures[0].authorized_exclusion_category = 'unreadable_spine';
      } else {
        changed.fixtures[0][key] = `${changed.fixtures[0][key]}-changed`;
      }
      await expect(benchmarkDatasetIdentity(parseBenchmarkManifest(changed)))
        .resolves.not.toBe(await benchmarkDatasetIdentity(first));
    }
  });

  it('produces reproducible per-language, field and scenario metrics', () => {
    const first = runSearchVariantBenchmark(manifest, identity);
    const second = runSearchVariantBenchmark(manifest, identity);
    expect(first).toEqual(second);
    expect(first.per_field).toEqual([expect.objectContaining({
      field: 'title',
      total_item_count: 1,
      complete_item_count: 1,
      exact_match_count: 1,
    })]);
    expect(first.per_scenario).toEqual([expect.objectContaining({
      scenario: 'clean_single_spine',
      total_item_count: 1,
    })]);
    expect(first.aggregate).toEqual({
      total_item_count: 1,
      complete_item_count: 1,
      failed_item_count: 0,
      invalid_item_count: 0,
      governed_excluded_count: 0,
      exact_match_count: 1,
    });
  });

  it.each([
    ['Godaan', 'godaan', true],
    ['Go-daan', 'go daan', true],
    ['  Go   daan  ', 'go daan', true],
    ['Ｇｏｄａａｎ', 'godaan', true],
    ['Godaan', 'Godan', false],
  ])('uses the versioned exact-match rule for %s and %s', (
    capturedOutput,
    expectedVariant,
    expected,
  ) => {
    const input = {
      ...manifest,
      fixtures: [{
        ...manifest.fixtures[0],
        captured_output: capturedOutput,
        expected_variant: expectedVariant,
      }],
    };
    expect(runSearchVariantBenchmark(input, identity).items[0].exact_match)
      .toBe(expected);
  });

  it('hashes the canonical trusted result deterministically', async () => {
    const parsed = parseBenchmarkManifest({
      ...manifest,
      fixtures: fixtures(100),
    });
    const result = runSearchVariantBenchmark({
      ...manifest,
      fixtures: fixtures(100),
    }, identity);
    const first = await benchmarkResultIdentity(parsed, result, identity);
    const reordered = {
      ...result,
      items: [...result.items].reverse(),
    };
    await expect(benchmarkResultIdentity(parsed, reordered, identity))
      .resolves.toBe(first);
    const changedManifest = parseBenchmarkManifest({
      ...manifest,
      fixtures: fixtures(100).map((fixture, index) => index === 0
        ? { ...fixture, captured_output: 'different' } : fixture),
    });
    const changedResult = runSearchVariantBenchmark({
      ...manifest,
      fixtures: fixtures(100).map((fixture, index) => index === 0
        ? { ...fixture, captured_output: 'different' } : fixture),
    }, identity);
    await expect(benchmarkResultIdentity(
      changedManifest, changedResult, identity,
    )).resolves.not.toBe(first);
  });

  it('reports no qualifying dataset instead of fabricating evidence', () => {
    expect(runSearchVariantBenchmark({
      ...manifest,
      fixtures: [],
    }, identity)).toMatchObject({
      aggregate: { total_item_count: 0 },
      eligible_for_review: false,
      denial_reason: 'no_qualifying_dataset',
    });
  });

  it('uses 100 complete valid items as the structural eligibility boundary', () => {
    expect(runSearchVariantBenchmark(
      { ...manifest, fixtures: fixtures(99) }, identity,
    ))
      .toMatchObject({
        eligible_for_review: false,
        denial_reason: 'insufficient_dataset',
      });
    expect(runSearchVariantBenchmark(
      { ...manifest, fixtures: fixtures(100) }, identity,
    ))
      .toMatchObject({ eligible_for_review: true, denial_reason: null });
    expect(runSearchVariantBenchmark({
      ...manifest,
      fixtures: fixtures(101, 'failed'),
    }, identity)).toMatchObject({
      aggregate: {
        total_item_count: 101,
        complete_item_count: 100,
        failed_item_count: 1,
      },
      eligible_for_review: true,
      denial_reason: null,
    });
  });

  it('keeps failed, invalid and excluded results visible', () => {
    const result = runSearchVariantBenchmark({
      ...manifest,
      fixtures: [
        ...fixtures(100),
        ...['failed', 'invalid', 'excluded'].map((result_status, index) => ({
          ...manifest.fixtures[0],
          fixture_id: `kn-other-${index}`,
          result_status,
          captured_output: null,
          evaluation_obligation: result_status === 'excluded'
            ? 'exclusion_permitted' : 'required',
          authorized_exclusion_category:
            result_status === 'excluded' ? 'unreadable_spine' : null,
        })),
      ],
    }, identity);
    expect(result.aggregate).toMatchObject({
      complete_item_count: 100,
      failed_item_count: 1,
      invalid_item_count: 1,
      governed_excluded_count: 1,
    });
    expect(result.items.filter((item) => item.status !== 'complete')
      .map((item) => item.status))
      .toEqual(['failed', 'invalid', 'excluded']);
    expect(result.eligible_for_review).toBe(true);
  });

  it('rejects duplicated fixture identities and inconsistent outcomes', () => {
    expect(() => parseBenchmarkManifest({
      ...manifest,
      fixtures: [manifest.fixtures[0], manifest.fixtures[0]],
    })).toThrow('duplicate fixture_id');
    expect(() => parseBenchmarkManifest({
      ...manifest,
      fixtures: [{
        ...manifest.fixtures[0],
        result_status: 'complete',
        captured_output: null,
      }],
    })).toThrow('captured_output');
    expect(() => parseBenchmarkManifest({
      ...manifest,
      fixtures: [{
        ...manifest.fixtures[0],
        result_status: 'excluded',
        captured_output: null,
        evaluation_obligation: 'required',
        authorized_exclusion_category: null,
      }],
    })).toThrow('authorized exclusion');
  });

  it('persists manifest-authoritative fixture obligations and exclusions', () => {
    const governed = {
      ...manifest,
      fixtures: fixtures(101, 'excluded'),
    };
    const parsed = parseBenchmarkManifest(governed);
    const result = runSearchVariantBenchmark(governed, identity);
    const persistence = buildBenchmarkPersistenceInput(parsed, result, identity);
    expect(persistence.manifest.fixtures).toHaveLength(101);
    expect(persistence.manifest.fixtures.at(-1)).toEqual({
      fixture_id: 'kn-title-101',
      field: 'title',
      scenario: 'clean_single_spine',
      source_text: manifest.fixtures[0].source_text,
      expected_variant: 'Godaan',
      captured_output: null,
      result_status: 'excluded',
      evaluation_obligation: 'exclusion_permitted',
      authorized_exclusion_category: 'unreadable_spine',
    });
    expect(result.items.at(-1)).toMatchObject({
      status: 'excluded',
      governed_exclusion_category: 'unreadable_spine',
    });
    expect(result.eligible_for_review).toBe(true);
  });

  it.each([
    ['complete expectation', 'complete'],
    ['failed result', 'failed'],
    ['invalid result', 'invalid'],
  ] as const)('rejects %s relabelled as governed exclusion', (_, originalStatus) => {
    const input = {
      ...manifest,
      fixtures: fixtures(101, originalStatus),
    };
    const parsed = parseBenchmarkManifest(input);
    const result = runSearchVariantBenchmark(input, identity);
    const altered = structuredClone(result);
    altered.items[100].status = 'excluded';
    altered.items[100].governed_exclusion_category = 'unreadable_spine';
    expect(() => buildBenchmarkPersistenceInput(parsed, altered, identity))
      .toThrow('benchmark item mismatch');
  });

  it('rejects a wrong or unauthorized governed exclusion category', () => {
    const input = { ...manifest, fixtures: fixtures(101, 'excluded') };
    const parsed = parseBenchmarkManifest(input);
    const result = structuredClone(runSearchVariantBenchmark(input, identity));
    result.items[100].governed_exclusion_category = 'policy_waiver';
    expect(() => buildBenchmarkPersistenceInput(parsed, result, identity))
      .toThrow('benchmark item mismatch');

    expect(() => parseBenchmarkManifest({
      ...manifest,
      fixtures: [{
        ...manifest.fixtures[0],
        result_status: 'excluded',
        captured_output: null,
        evaluation_obligation: 'required',
        authorized_exclusion_category: null,
      }],
    })).toThrow('authorized exclusion');
  });

  it('rejects missing, duplicate, and fabricated item/group evidence', () => {
    const input = { ...manifest, fixtures: fixtures(100) };
    const parsed = parseBenchmarkManifest(input);
    const result = runSearchVariantBenchmark(input, identity);
    for (const mutate of [
      (candidate: any) => candidate.items.pop(),
      (candidate: any) => { candidate.items[99].fixture_id = candidate.items[98].fixture_id; },
      (candidate: any) => { candidate.items[0].field = 'publisher'; },
      (candidate: any) => { candidate.items[0].scenario = 'fabricated_scenario'; },
      (candidate: any) => candidate.per_field.push({ ...candidate.per_field[0] }),
      (candidate: any) => candidate.per_scenario.push({
        ...candidate.per_scenario[0], scenario: 'fabricated_scenario',
      }),
      (candidate: any) => candidate.per_field.pop(),
      (candidate: any) => candidate.per_scenario.pop(),
    ]) {
      const altered = structuredClone(result) as any;
      mutate(altered);
      expect(() => buildBenchmarkPersistenceInput(parsed, altered, identity))
        .toThrow(/benchmark (item|metric) mismatch/);
    }
  });

  it('rejects every incorrect item-derived metric count', () => {
    const input = {
      ...manifest,
      fixtures: [
        ...fixtures(100),
        ...(['failed', 'invalid', 'excluded'] as const).map((status, index) => ({
          ...fixtures(1, status)[0],
          fixture_id: `kn-metric-${index}`,
        })),
      ],
    };
    const parsed = parseBenchmarkManifest(input);
    const result = runSearchVariantBenchmark(input, identity);
    for (const key of [
      'total_item_count', 'complete_item_count', 'failed_item_count',
      'invalid_item_count', 'governed_excluded_count', 'exact_match_count',
    ] as const) {
      for (const target of ['aggregate', 'per_field', 'per_scenario'] as const) {
        const altered = structuredClone(result) as any;
        const metrics = target === 'aggregate' ? altered.aggregate : altered[target][0];
        metrics[key] += 1;
        expect(() => buildBenchmarkPersistenceInput(parsed, altered, identity))
          .toThrow('benchmark metric mismatch');
      }
    }
  });

  it('uses one explicit adapter for the structurally identical persistence result', () => {
    const result = runSearchVariantBenchmark({
      ...manifest,
      fixtures: fixtures(100),
    }, identity);
    const persistence = buildBenchmarkPersistenceInput(
      parseBenchmarkManifest({ ...manifest, fixtures: fixtures(100) }),
      result,
      identity,
    );
    expect(persistence.manifest.fixtures).toHaveLength(100);
    expect(persistence.manifest.fixtures[0]).toEqual(expect.objectContaining({
      source_text: manifest.fixtures[0].source_text,
      expected_variant: manifest.fixtures[0].expected_variant,
      captured_output: manifest.fixtures[0].captured_output,
    }));
    expect(persistence.manifest.sample_count).toBe(100);
    expect(persistence.execution.result).toBe(result);
    expect(persistence.execution.result.aggregate.complete_item_count).toBe(100);
    expect(persistence.execution.eligible_for_review).toBeUndefined();
  });

  it.each([
    'executionIdentity', 'datasetIdentity', 'fixtureSetSha256', 'modelKey',
    'modelVersion', 'promptVersion', 'sidecarSchemaVersion', 'policyVersion',
    'runnerVersion', 'resultSha256',
  ] as const)('rejects empty, whitespace, and malformed %s identities', (key) => {
    const input = { ...manifest, fixtures: fixtures(100) };
    const parsed = parseBenchmarkManifest(input);
    const result = runSearchVariantBenchmark(input, identity);
    for (const invalid of ['', '   ', ' invalid identity ']) {
      expect(() => buildBenchmarkPersistenceInput(
        parsed, result, { ...identity, [key]: invalid },
      )).toThrow(/identity|version|key|sha256/);
    }
  });

  it.each([
    ['missing', (row: any) => { delete row.evaluation_obligation; }],
    ['null', (row: any) => { row.evaluation_obligation = null; }],
    ['wrong-type', (row: any) => { row.evaluation_obligation = 7; }],
  ])('rejects %s fixture evaluation obligations', (_, mutate) => {
    const input = structuredClone(manifest) as any;
    mutate(input.fixtures[0]);
    expect(() => parseBenchmarkManifest(input)).toThrow('evaluation_obligation');
  });

  it('rejects missing, null, wrong-type, empty, and whitespace result evidence', () => {
    const input = { ...manifest, fixtures: fixtures(100) };
    const parsed = parseBenchmarkManifest(input);
    const valid = runSearchVariantBenchmark(input, identity);
    const mutations = [
      (result: any) => { delete result.result_schema_version; },
      (result: any) => { result.result_schema_version = null; },
      (result: any) => { result.result_schema_version = ''; },
      (result: any) => { delete result.model_key; },
      (result: any) => { result.model_key = null; },
      (result: any) => { result.model_key = '   '; },
      (result: any) => { delete result.items[0].status; },
      (result: any) => { result.items[0].status = null; },
      (result: any) => { delete result.items[0].exact_match; },
      (result: any) => { result.items[0].exact_match = null; },
      (result: any) => { result.items[0].exact_match = 'true'; },
      (result: any) => { delete result.aggregate.complete_item_count; },
      (result: any) => { result.aggregate.complete_item_count = null; },
      (result: any) => { delete result.per_field[0].field; },
      (result: any) => { result.per_field[0].field = null; },
      (result: any) => { delete result.per_scenario[0].scenario; },
      (result: any) => { result.per_scenario[0].scenario = null; },
      (result: any) => { delete result.eligible_for_review; },
      (result: any) => { result.eligible_for_review = null; },
      (result: any) => { result.eligible_for_review = 'true'; },
      (result: any) => { result.eligible_for_review = false; },
      (result: any) => { delete result.denial_reason; },
      (result: any) => { result.denial_reason = ''; },
      (result: any) => { result.denial_reason = '   '; },
      (result: any) => { result.denial_reason = 'insufficient_dataset'; },
    ];
    for (const mutate of mutations) {
      const altered = structuredClone(valid) as any;
      mutate(altered);
      expect(() => buildBenchmarkPersistenceInput(parsed, altered, identity))
        .toThrow(/benchmark (identity|item|metric|result) mismatch/);
    }
  });

  it('requires the exact derived denial representation for ineligible evidence', () => {
    const input = { ...manifest, fixtures: fixtures(99) };
    const parsed = parseBenchmarkManifest(input);
    const valid = runSearchVariantBenchmark(input, identity);
    for (const invalid of [undefined, null, '', '   ', 7, 'no_qualifying_dataset']) {
      const altered = structuredClone(valid) as any;
      if (invalid === undefined) delete altered.denial_reason;
      else altered.denial_reason = invalid;
      expect(() => buildBenchmarkPersistenceInput(parsed, altered, identity))
        .toThrow('benchmark result mismatch');
    }
  });

  it('delegates automatic activation to the exact-tuple database boundary', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    const policy = createDatabaseAutomaticActivationPolicy({ rpc });
    await expect(policy.allows({
      proposalId: '79000000-0000-0000-0000-000000000051',
      sourceLanguage: 'kn',
      sourceScript: 'Knda',
      targetType: 'title',
      modelKey: 'gemini-3.5-flash-lite',
      modelVersion: 'gemini-3.5-flash-lite',
      promptVersion: 'gemini-spine-v1',
      schemaVersion: 'search_variant_proposals_v1',
    })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'phase9_search_variant_automatic_activation_allowed',
      expect.objectContaining({
        p_source_language: 'kn',
        p_source_script: 'Knda',
        p_target_type: 'title',
      }),
    );
  });
});
