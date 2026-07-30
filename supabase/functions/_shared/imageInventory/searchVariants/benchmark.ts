import {
  asRecord,
  assertKnownKeys,
  canonicalBcp47,
  requiredString,
} from '../domain/validation';
import { sha256Hex } from '../media/sourceIdentity';
import { normalizeVariantComparisonText } from './reconciliation';

const MANIFEST_VERSION = 'p9-search-variant-benchmark-manifest-v1';
const RESULT_VERSION = 'p9-search-variant-benchmark-result-v1';
const CANONICALIZATION_VERSION = 'p9-search-variant-benchmark-canonical-v1';
const RESULT_CANONICALIZATION_VERSION =
  'p9-search-variant-benchmark-result-canonical-v1';
const MINIMUM_REVIEW_SAMPLE_COUNT = 100;
const RESULT_STATUSES = ['complete', 'failed', 'invalid', 'excluded'] as const;
type ResultStatus = typeof RESULT_STATUSES[number];

const MANIFEST_KEYS = [
  'schema_version', 'dataset_key', 'dataset_version', 'language', 'script',
  'fixtures',
] as const;
const FIXTURE_KEYS = [
  'fixture_id', 'field', 'scenario', 'source_text', 'expected_variant',
  'captured_output', 'result_status', 'evaluation_obligation',
  'authorized_exclusion_category',
] as const;
const EVALUATION_OBLIGATIONS = ['required', 'exclusion_permitted'] as const;
type EvaluationObligation = typeof EVALUATION_OBLIGATIONS[number];

type Fixture = Readonly<{
  fixtureId: string;
  field: 'title' | 'author';
  scenario: string;
  sourceText: string;
  expectedVariant: string;
  capturedOutput: string | null;
  resultStatus: ResultStatus;
  evaluationObligation: EvaluationObligation;
  authorizedExclusionCategory: string | null;
}>;
export type BenchmarkManifest = Readonly<{
  schemaVersion: typeof MANIFEST_VERSION;
  datasetKey: string;
  datasetVersion: string;
  language: string;
  script: string;
  fixtures: readonly Fixture[];
}>;
type Counts = Readonly<{
  total_item_count: number;
  complete_item_count: number;
  failed_item_count: number;
  invalid_item_count: number;
  governed_excluded_count: number;
  exact_match_count: number;
}>;
export type BenchmarkResult = Readonly<{
  result_schema_version: typeof RESULT_VERSION;
  dataset_key: string;
  dataset_version: string;
  dataset_identity: string;
  language: string;
  script: string;
  model_key: string;
  model_version: string;
  prompt_version: string;
  sidecar_schema_version: string;
  policy_version: string;
  aggregate: Counts;
  per_field: readonly (Counts & { field: 'title' | 'author' })[];
  per_scenario: readonly (Counts & { scenario: string })[];
  items: readonly Readonly<{
    fixture_id: string;
    field: 'title' | 'author';
    scenario: string;
    status: ResultStatus;
    governed_exclusion_category: string | null;
    exact_match: boolean | null;
  }>[];
  eligible_for_review: boolean;
  denial_reason: string | null;
}>;
export type BenchmarkExecutionIdentity = Readonly<{
  executionIdentity: string;
  datasetIdentity: string;
  fixtureSetSha256: string;
  modelKey: string;
  modelVersion: string;
  promptVersion: string;
  sidecarSchemaVersion: string;
  policyVersion: string;
  runnerVersion: string;
  resultSha256: string;
}>;

export function parseBenchmarkManifest(value: unknown): BenchmarkManifest {
  const input = asRecord(value, 'benchmark_manifest');
  assertKnownKeys(input, MANIFEST_KEYS, 'benchmark_manifest');
  if (input.schema_version !== MANIFEST_VERSION) throw new Error('schema_version');
  if (!Array.isArray(input.fixtures) || input.fixtures.length > 10_000) {
    throw new Error('fixtures');
  }
  const identifiers = new Set<string>();
  const fixtures = input.fixtures.map((value, index) => {
    const row = asRecord(value, `fixtures[${index}]`);
    assertKnownKeys(row, FIXTURE_KEYS, `fixtures[${index}]`);
    if (row.field !== 'title' && row.field !== 'author') throw new Error('field');
    if (!RESULT_STATUSES.includes(row.result_status as ResultStatus)) {
      throw new Error('result_status');
    }
    const resultStatus = row.result_status as ResultStatus;
    if (!EVALUATION_OBLIGATIONS.includes(
      row.evaluation_obligation as EvaluationObligation,
    )) {
      throw new Error('evaluation_obligation');
    }
    const evaluationObligation =
      row.evaluation_obligation as EvaluationObligation;
    const authorizedExclusionCategory =
      row.authorized_exclusion_category === null
        ? null
        : requiredString(
          row.authorized_exclusion_category,
          'authorized_exclusion_category',
          64,
          { activeContent: false, pattern: /^[a-z][a-z0-9_]{2,63}$/u },
        );
    if ((evaluationObligation === 'exclusion_permitted')
      !== (authorizedExclusionCategory !== null)
      || (resultStatus === 'excluded'
        && evaluationObligation !== 'exclusion_permitted')) {
      throw new Error('authorized exclusion');
    }
    const fixtureId = requiredString(row.fixture_id, 'fixture_id', 64, {
      activeContent: false, pattern: /^[a-z0-9][a-z0-9._-]+$/u,
    });
    if (identifiers.has(fixtureId)) throw new Error('duplicate fixture_id');
    identifiers.add(fixtureId);
    const capturedOutput = row.captured_output === null
      ? null : requiredString(row.captured_output, 'captured_output', 256);
    if ((resultStatus === 'complete') !== (capturedOutput !== null)) {
      throw new Error('captured_output');
    }
    return {
      fixtureId,
      field: row.field,
      scenario: requiredString(row.scenario, 'scenario', 64, {
        activeContent: false, pattern: /^[a-z][a-z0-9_]+$/u,
      }),
      sourceText: requiredString(row.source_text, 'source_text', 512),
      expectedVariant: requiredString(row.expected_variant, 'expected_variant', 256),
      capturedOutput,
      resultStatus,
      evaluationObligation,
      authorizedExclusionCategory,
    };
  });
  if (typeof input.dataset_version !== 'string'
    || input.dataset_version !== input.dataset_version.trim()) {
    throw new Error('dataset_version');
  }
  return {
    schemaVersion: MANIFEST_VERSION,
    datasetKey: requiredString(input.dataset_key, 'dataset_key', 64, {
      activeContent: false, pattern: /^[a-z][a-z0-9._-]+$/u,
    }),
    datasetVersion: requiredString(input.dataset_version, 'dataset_version', 64, {
      activeContent: false, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]+$/u,
    }),
    language: canonicalBcp47(input.language, 'language'),
    script: requiredString(input.script, 'script', 4, {
      activeContent: false, pattern: /^[A-Z][a-z]{3}$/u,
    }),
    fixtures: Object.freeze(fixtures.sort(
      (left, right) => left.fixtureId < right.fixtureId
        ? -1 : left.fixtureId > right.fixtureId ? 1 : 0,
    )),
  };
}

function sortedFixtures(manifest: BenchmarkManifest): readonly Fixture[] {
  return [...manifest.fixtures].sort(
    (left, right) => left.fixtureId < right.fixtureId
      ? -1 : left.fixtureId > right.fixtureId ? 1 : 0,
  );
}

function canonicalFixture(row: Fixture): Readonly<Record<string, unknown>> {
  return {
    fixture_id: row.fixtureId,
    field: row.field,
    scenario: row.scenario,
    source_text: row.sourceText,
    expected_variant: row.expectedVariant,
    captured_output: row.capturedOutput,
    result_status: row.resultStatus,
    evaluation_obligation: row.evaluationObligation,
    authorized_exclusion_category: row.authorizedExclusionCategory,
  };
}

function jsonbKeyOrder(left: string, right: string): number {
  const length = new TextEncoder().encode(left).length
    - new TextEncoder().encode(right).length;
  return length || (left < right ? -1 : left > right ? 1 : 0);
}

function canonicalJsonb(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonb).join(', ')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort(jsonbKeyOrder).map(
      (key) => `${JSON.stringify(key)}: ${canonicalJsonb(record[key])}`,
    ).join(', ')}}`;
  }
  return JSON.stringify(value);
}

function canonicalFixtures(manifest: BenchmarkManifest): readonly unknown[] {
  return sortedFixtures(manifest).map(canonicalFixture);
}

function canonicalManifest(manifest: BenchmarkManifest): string {
  return canonicalJsonb([
    CANONICALIZATION_VERSION,
    {
      schema_version: manifest.schemaVersion,
      dataset_key: manifest.datasetKey,
      dataset_version: manifest.datasetVersion,
      language: manifest.language,
      script: manifest.script,
      fixtures: canonicalFixtures(manifest),
    },
  ]);
}

export function benchmarkDatasetIdentity(
  manifest: BenchmarkManifest,
): Promise<string> {
  return sha256Hex(canonicalManifest(manifest));
}

export function benchmarkFixtureSetIdentity(
  manifest: BenchmarkManifest,
): Promise<string> {
  return sha256Hex(canonicalJsonb([
    CANONICALIZATION_VERSION,
    canonicalFixtures(manifest),
  ]));
}

function canonicalTrustedResult(
  manifest: BenchmarkManifest,
  result: BenchmarkResult,
  identity: BenchmarkExecutionIdentity,
): Readonly<Record<string, unknown>> {
  const fixturesById = new Map(
    manifest.fixtures.map((fixture) => [fixture.fixtureId, fixture]),
  );
  const items = [...result.items]
    .sort((left, right) => left.fixture_id < right.fixture_id
      ? -1 : left.fixture_id > right.fixture_id ? 1 : 0)
    .map((item) => {
      const fixture = fixturesById.get(item.fixture_id)!;
      return {
        fixture_id: item.fixture_id,
        field: item.field,
        scenario: item.scenario,
        status: item.status,
        captured_output: fixture.capturedOutput,
        governed_exclusion_category: item.governed_exclusion_category,
        exact_match: item.status === 'complete'
          ? normalizeVariantComparisonText(fixture.capturedOutput!)
            === normalizeVariantComparisonText(fixture.expectedVariant)
          : null,
      };
    });
  return {
    execution_identity: identity.executionIdentity,
    runner_version: identity.runnerVersion,
    result_schema_version: result.result_schema_version,
    dataset_key: result.dataset_key,
    dataset_version: result.dataset_version,
    dataset_identity: result.dataset_identity,
    language: result.language,
    script: result.script,
    model_key: result.model_key,
    model_version: result.model_version,
    prompt_version: result.prompt_version,
    sidecar_schema_version: result.sidecar_schema_version,
    policy_version: result.policy_version,
    aggregate: result.aggregate,
    per_field: [...result.per_field].sort(
      (left, right) => left.field < right.field ? -1 : left.field > right.field ? 1 : 0,
    ),
    per_scenario: [...result.per_scenario].sort(
      (left, right) => left.scenario < right.scenario
        ? -1 : left.scenario > right.scenario ? 1 : 0,
    ),
    items,
    eligible_for_review: result.eligible_for_review,
    denial_reason: result.denial_reason,
  };
}

export function benchmarkResultIdentity(
  manifest: BenchmarkManifest,
  result: BenchmarkResult,
  identity: BenchmarkExecutionIdentity,
): Promise<string> {
  assertPersistenceEvidence(manifest, result);
  return sha256Hex(canonicalJsonb([
    RESULT_CANONICALIZATION_VERSION,
    canonicalTrustedResult(manifest, result, identity),
  ]));
}

function counts(rows: readonly Fixture[]): Counts {
  return {
    total_item_count: rows.length,
    complete_item_count: rows.filter((row) => row.resultStatus === 'complete').length,
    failed_item_count: rows.filter((row) => row.resultStatus === 'failed').length,
    invalid_item_count: rows.filter((row) => row.resultStatus === 'invalid').length,
    governed_excluded_count:
      rows.filter((row) => row.resultStatus === 'excluded').length,
    exact_match_count: rows.filter((row) => row.resultStatus === 'complete'
      && normalizeVariantComparisonText(row.capturedOutput!)
        === normalizeVariantComparisonText(row.expectedVariant)).length,
  };
}

function groupedCounts<K extends 'field' | 'scenario'>(
  fixtures: readonly Fixture[],
  key: K,
): readonly (Counts & Record<K, string>)[] {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const value = key === 'field' ? fixture.field : fixture.scenario;
    groups.set(value, [...(groups.get(value) ?? []), fixture]);
  }
  return Object.freeze([...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([value, rows]) => ({ [key]: value, ...counts(rows) }))
  ) as readonly (Counts & Record<K, string>)[];
}

export function runSearchVariantBenchmark(
  value: unknown,
  identity: BenchmarkExecutionIdentity,
): BenchmarkResult {
  const manifest = parseBenchmarkManifest(value);
  const aggregate = counts(manifest.fixtures);
  const denialReason = aggregate.total_item_count === 0
    ? 'no_qualifying_dataset'
    : aggregate.complete_item_count < MINIMUM_REVIEW_SAMPLE_COUNT
      ? 'insufficient_dataset' : null;
  return Object.freeze({
    result_schema_version: RESULT_VERSION,
    dataset_key: manifest.datasetKey,
    dataset_version: manifest.datasetVersion,
    dataset_identity: identity.datasetIdentity,
    language: manifest.language,
    script: manifest.script,
    model_key: identity.modelKey,
    model_version: identity.modelVersion,
    prompt_version: identity.promptVersion,
    sidecar_schema_version: identity.sidecarSchemaVersion,
    policy_version: identity.policyVersion,
    aggregate: Object.freeze(aggregate),
    per_field: groupedCounts(manifest.fixtures, 'field'),
    per_scenario: groupedCounts(manifest.fixtures, 'scenario'),
    items: Object.freeze(manifest.fixtures.map((row) => Object.freeze({
      fixture_id: row.fixtureId,
      field: row.field,
      scenario: row.scenario,
      status: row.resultStatus,
      governed_exclusion_category: row.resultStatus === 'excluded'
        ? row.authorizedExclusionCategory : null,
      exact_match: row.resultStatus === 'complete'
        ? normalizeVariantComparisonText(row.capturedOutput!)
          === normalizeVariantComparisonText(row.expectedVariant)
        : null,
    }))),
    eligible_for_review:
      aggregate.complete_item_count >= MINIMUM_REVIEW_SAMPLE_COUNT,
    denial_reason: denialReason,
  });
}

export function buildBenchmarkPersistenceInput(
  manifest: BenchmarkManifest,
  result: BenchmarkResult,
  identity: BenchmarkExecutionIdentity,
) {
  assertExecutionIdentity(identity);
  assertPersistenceEvidence(manifest, result);
  if (result.dataset_identity !== identity.datasetIdentity
    || result.model_key !== identity.modelKey
    || result.model_version !== identity.modelVersion
    || result.prompt_version !== identity.promptVersion
    || result.sidecar_schema_version !== identity.sidecarSchemaVersion
    || result.policy_version !== identity.policyVersion) {
    throw new Error('benchmark identity mismatch');
  }
  return Object.freeze({
    manifest: Object.freeze({
      schema_version: manifest.schemaVersion,
      canonicalization_version: CANONICALIZATION_VERSION,
      dataset_key: manifest.datasetKey,
      dataset_version: manifest.datasetVersion,
      dataset_identity: identity.datasetIdentity,
      language: manifest.language,
      script: manifest.script,
      sample_count: manifest.fixtures.length,
      fixtures: Object.freeze(manifest.fixtures.map((row) => Object.freeze({
        fixture_id: row.fixtureId,
        field: row.field,
        scenario: row.scenario,
        source_text: row.sourceText,
        expected_variant: row.expectedVariant,
        captured_output: row.capturedOutput,
        result_status: row.resultStatus,
        evaluation_obligation: row.evaluationObligation,
        authorized_exclusion_category: row.authorizedExclusionCategory,
      }))),
      fixture_set_sha256: identity.fixtureSetSha256,
    }),
    execution: Object.freeze({
      execution_identity: identity.executionIdentity,
      model_key: identity.modelKey,
      model_version: identity.modelVersion,
      prompt_version: identity.promptVersion,
      sidecar_schema_version: identity.sidecarSchemaVersion,
      policy_version: identity.policyVersion,
      runner_version: identity.runnerVersion,
      result_sha256: identity.resultSha256,
      result,
    }),
  });
}

const EXACT_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function exactIdentity(
  value: unknown,
  field: string,
  pattern: RegExp = EXACT_IDENTIFIER,
): string {
  if (typeof value !== 'string' || value !== value.trim()
    || !pattern.test(value)) {
    throw new Error(`${field} identity`);
  }
  return value;
}

function assertExecutionIdentity(identity: BenchmarkExecutionIdentity): void {
  exactIdentity(identity.executionIdentity, 'execution_identity', SHA256);
  exactIdentity(identity.datasetIdentity, 'dataset_identity', SHA256);
  exactIdentity(identity.fixtureSetSha256, 'fixture_set_sha256', SHA256);
  exactIdentity(identity.modelKey, 'model_key');
  exactIdentity(identity.modelVersion, 'model_version');
  exactIdentity(identity.promptVersion, 'prompt_version');
  exactIdentity(
    identity.sidecarSchemaVersion,
    'sidecar_schema_version',
    /^search_variant_proposals_v1$/u,
  );
  exactIdentity(identity.policyVersion, 'policy_version');
  exactIdentity(identity.runnerVersion, 'runner_version');
  exactIdentity(identity.resultSha256, 'result_sha256', SHA256);
}

type ResultItem = BenchmarkResult['items'][number];
type GroupMetric = Counts & { field?: string; scenario?: string };

function itemCounts(rows: readonly ResultItem[]): Counts {
  return {
    total_item_count: rows.length,
    complete_item_count: rows.filter((row) => row.status === 'complete').length,
    failed_item_count: rows.filter((row) => row.status === 'failed').length,
    invalid_item_count: rows.filter((row) => row.status === 'invalid').length,
    governed_excluded_count:
      rows.filter((row) => row.status === 'excluded').length,
    exact_match_count: rows.filter((row) => row.exact_match === true).length,
  };
}

function assertCounts(actual: Counts, claimed: Counts): void {
  for (const key of [
    'total_item_count', 'complete_item_count', 'failed_item_count',
    'invalid_item_count', 'governed_excluded_count', 'exact_match_count',
  ] as const) {
    if (actual[key] !== claimed[key]) throw new Error('benchmark metric mismatch');
  }
}

function assertGroups(
  items: readonly ResultItem[],
  groups: readonly GroupMetric[],
  key: 'field' | 'scenario',
): void {
  const represented = new Map<string, ResultItem[]>();
  for (const item of items) {
    const value = item[key];
    represented.set(value, [...(represented.get(value) ?? []), item]);
  }
  const supplied = new Set<string>();
  for (const group of groups) {
    const value = group[key];
    if (typeof value !== 'string' || supplied.has(value)
      || !represented.has(value)) {
      throw new Error('benchmark metric mismatch');
    }
    supplied.add(value);
    assertCounts(itemCounts(represented.get(value)!), group);
  }
  if (supplied.size !== represented.size) throw new Error('benchmark metric mismatch');
}

function assertPersistenceEvidence(
  manifest: BenchmarkManifest,
  result: BenchmarkResult,
): void {
  if (result.result_schema_version !== RESULT_VERSION
    || result.dataset_key !== manifest.datasetKey
    || result.dataset_version !== manifest.datasetVersion
    || result.language !== manifest.language
    || result.script !== manifest.script) {
    throw new Error('benchmark result mismatch');
  }
  exactIdentity(manifest.datasetVersion, 'dataset_version');
  exactIdentity(manifest.language, 'language', /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u);
  exactIdentity(manifest.script, 'script', /^[A-Z][a-z]{3}$/u);
  if (result.items.length !== manifest.fixtures.length) {
    throw new Error('benchmark item mismatch');
  }
  const fixtures = new Map(manifest.fixtures.map((fixture) => [
    fixture.fixtureId, fixture,
  ]));
  const seen = new Set<string>();
  for (const item of result.items) {
    const fixture = fixtures.get(item.fixture_id);
    const expectedExactMatch = fixture?.resultStatus === 'complete'
      ? normalizeVariantComparisonText(fixture.capturedOutput!)
        === normalizeVariantComparisonText(fixture.expectedVariant)
      : null;
    const expectedCategory = fixture?.resultStatus === 'excluded'
      ? fixture.authorizedExclusionCategory : null;
    if (!fixture || seen.has(item.fixture_id)
      || item.field !== fixture.field || item.scenario !== fixture.scenario
      || item.status !== fixture.resultStatus
      || item.governed_exclusion_category !== expectedCategory
      || item.exact_match !== expectedExactMatch) {
      throw new Error('benchmark item mismatch');
    }
    seen.add(item.fixture_id);
  }
  const derivedCounts = itemCounts(result.items);
  assertCounts(derivedCounts, result.aggregate);
  assertGroups(result.items, result.per_field, 'field');
  assertGroups(result.items, result.per_scenario, 'scenario');
  const derivedDenialReason = derivedCounts.total_item_count === 0
    ? 'no_qualifying_dataset'
    : derivedCounts.complete_item_count < MINIMUM_REVIEW_SAMPLE_COUNT
      ? 'insufficient_dataset' : null;
  if (result.eligible_for_review
      !== (derivedCounts.complete_item_count >= MINIMUM_REVIEW_SAMPLE_COUNT)
    || result.denial_reason !== derivedDenialReason) {
    throw new Error('benchmark result mismatch');
  }
}
