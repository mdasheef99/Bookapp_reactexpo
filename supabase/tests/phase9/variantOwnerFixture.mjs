import {
  createPhase9Database,
  resetActor,
  scalar,
  setActor,
} from './databaseHarness.mjs';
import { createHash } from 'node:crypto';

export const STORE = '72000000-0000-0000-0000-000000000071';
export const OTHER_STORE = '72000000-0000-0000-0000-000000000072';
export const OWNER = '71000000-0000-0000-0000-000000000071';
export const PLATFORM = '71000000-0000-0000-0000-000000000079';
export const PLATFORM_2 = '71000000-0000-0000-0000-000000000080';
export const TITLE = 'à²—à³‹à²¦à²¾à²¨';

const SESSION = '73000000-0000-0000-0000-000000000071';
const INPUT = '74000000-0000-0000-0000-000000000071';
const MEDIA = '75000000-0000-0000-0000-000000000071';
const JOB = '76000000-0000-0000-0000-000000000071';
const CORRELATION = '77000000-0000-4000-8000-000000000071';
const WORKER = 'vision-worker-0000000071';
const CANONICALIZATION_VERSION =
  'p9-search-variant-benchmark-canonical-v1';
const RESULT_CANONICALIZATION_VERSION =
  'p9-search-variant-benchmark-result-canonical-v1';
const json = (value) => JSON.stringify(value).replaceAll("'", "''");

const jsonbKeyOrder = (left, right) => Buffer.byteLength(left)
  - Buffer.byteLength(right) || (left < right ? -1 : left > right ? 1 : 0);
function canonicalJsonb(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonb).join(', ')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort(jsonbKeyOrder).map(
      (key) => `${JSON.stringify(key)}: ${canonicalJsonb(value[key])}`,
    ).join(', ')}}`;
  }
  return JSON.stringify(value);
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function bindCanonicalBenchmarkHashes(input) {
  const canonicalManifest = {
    schema_version: input.manifest.schema_version,
    dataset_key: input.manifest.dataset_key,
    dataset_version: input.manifest.dataset_version,
    language: input.manifest.language,
    script: input.manifest.script,
    fixtures: input.manifest.fixtures,
  };
  input.manifest.dataset_identity = sha256(canonicalJsonb([
    CANONICALIZATION_VERSION,
    canonicalManifest,
  ]));
  input.manifest.fixture_set_sha256 = sha256(canonicalJsonb([
    CANONICALIZATION_VERSION,
    input.manifest.fixtures,
  ]));
  input.execution.result.dataset_identity = input.manifest.dataset_identity;
  input.execution.result.dataset_version = input.manifest.dataset_version;
  const fixtures = new Map(input.manifest.fixtures.map(
    (fixture) => [fixture.fixture_id, fixture],
  ));
  const trustedResult = {
    execution_identity: input.execution.execution_identity,
    runner_version: input.execution.runner_version,
    result_schema_version: input.execution.result.result_schema_version,
    dataset_key: input.execution.result.dataset_key,
    dataset_version: input.execution.result.dataset_version,
    dataset_identity: input.execution.result.dataset_identity,
    language: input.execution.result.language,
    script: input.execution.result.script,
    model_key: input.execution.result.model_key,
    model_version: input.execution.result.model_version,
    prompt_version: input.execution.result.prompt_version,
    sidecar_schema_version: input.execution.result.sidecar_schema_version,
    policy_version: input.execution.result.policy_version,
    aggregate: input.execution.result.aggregate,
    per_field: [...input.execution.result.per_field].sort(
      (left, right) => left.field < right.field ? -1 : left.field > right.field ? 1 : 0,
    ),
    per_scenario: [...input.execution.result.per_scenario].sort(
      (left, right) => left.scenario < right.scenario
        ? -1 : left.scenario > right.scenario ? 1 : 0,
    ),
    items: [...input.execution.result.items]
      .sort((left, right) => left.fixture_id < right.fixture_id
        ? -1 : left.fixture_id > right.fixture_id ? 1 : 0)
      .map((item) => ({
        ...item,
        captured_output: fixtures.get(item.fixture_id).captured_output,
      })),
    eligible_for_review: input.execution.result.eligible_for_review,
    denial_reason: input.execution.result.denial_reason,
  };
  input.execution.result_sha256 = sha256(canonicalJsonb([
    RESULT_CANONICALIZATION_VERSION,
    trustedResult,
  ]));
  return input;
}

export function createCanonicalBenchmarkPayload(statuses, nonce = 1) {
  const hash = (offset) => (nonce * 10 + offset).toString(16).padStart(64, '0');
  const fixtures = statuses.map((status, index) => ({
    fixture_id: `kn-title-${index + 1}`,
    field: 'title',
    scenario: 'clean_single_spine',
    source_text: `source-${index + 1}`,
    expected_variant: `expected-${index + 1}`,
    captured_output: status === 'complete' ? `expected-${index + 1}` : null,
    result_status: status,
    evaluation_obligation: status === 'excluded'
      ? 'exclusion_permitted' : 'required',
    authorized_exclusion_category:
      status === 'excluded' ? 'unreadable_spine' : null,
  })).sort((left, right) => left.fixture_id < right.fixture_id
    ? -1 : left.fixture_id > right.fixture_id ? 1 : 0);
  const aggregate = {
    total_item_count: statuses.length,
    complete_item_count: statuses.filter((value) => value === 'complete').length,
    failed_item_count: statuses.filter((value) => value === 'failed').length,
    invalid_item_count: statuses.filter((value) => value === 'invalid').length,
    governed_excluded_count:
      statuses.filter((value) => value === 'excluded').length,
    exact_match_count: statuses.filter((value) => value === 'complete').length,
  };
  const eligible = aggregate.complete_item_count >= 100;
  const denial = aggregate.total_item_count === 0 ? 'no_qualifying_dataset'
    : aggregate.complete_item_count < 100 ? 'insufficient_dataset' : null;
  const result = {
    result_schema_version: 'p9-search-variant-benchmark-result-v1',
    dataset_key: 'kn-spines', dataset_version: `v${nonce}`,
    dataset_identity: '', language: 'kn', script: 'Knda',
    model_key: 'fixture_multimodal', model_version: '2026-07-26',
    prompt_version: 'fixture-prompt-v2',
    sidecar_schema_version: 'search_variant_proposals_v1',
    policy_version: 'fixture-policy-v1', aggregate,
    per_field: statuses.length === 0 ? [] : [{ field: 'title', ...aggregate }],
    per_scenario: statuses.length === 0
      ? [] : [{ scenario: 'clean_single_spine', ...aggregate }],
    items: fixtures.map((fixture, index) => ({
      fixture_id: fixture.fixture_id,
      field: fixture.field,
      scenario: fixture.scenario,
      status: fixture.result_status,
      governed_exclusion_category:
        fixture.result_status === 'excluded' ? 'unreadable_spine' : null,
      exact_match: fixture.result_status === 'complete' ? true : null,
    })),
    eligible_for_review: eligible, denial_reason: denial,
  };
  const canonicalManifest = {
    schema_version: 'p9-search-variant-benchmark-manifest-v1',
    dataset_key: result.dataset_key,
    dataset_version: result.dataset_version,
    language: 'kn',
    script: 'Knda',
    fixtures,
  };
  const input = {
    manifest: {
      ...canonicalManifest,
      canonicalization_version: CANONICALIZATION_VERSION,
      dataset_identity: '',
      sample_count: statuses.length,
      fixture_set_sha256: '',
    },
    execution: {
      execution_identity: hash(3), model_key: result.model_key,
      model_version: result.model_version, prompt_version: result.prompt_version,
      sidecar_schema_version: result.sidecar_schema_version,
      policy_version: result.policy_version, runner_version: 'runner-v1',
      result_sha256: hash(4), result,
    },
  };
  return bindCanonicalBenchmarkHashes(input);
}

const vision = {
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'fixture-prompt-v2',
  adapter_key: 'fixture_adapter',
  adapter_version: '1.0.0',
  job_reference: `job_${CORRELATION.replaceAll('-', '')}`,
  attempt_number: 1,
  correlation_id: CORRELATION,
  expected_language: 'kn',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  received_at: '2026-07-29T00:00:01.000Z',
  image_outcome: 'analyzed',
  detected_visible_book_count: 1,
  observations: [{
    ordinal: 1, title_guess: TITLE, author_guesses: [], publisher_clue: null,
    isbn_clue: null, detected_language: 'kn', confidence: 0.9,
    geometry: null, warning_codes: [],
  }],
  warning_codes: [],
};
const variants = {
  contract_version: 'p9-contract-v1',
  proposal_schema_version: 'search_variant_proposals_v1',
  analysis_reference: CORRELATION,
  generation_source: 'recorded_fixture',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  prompt_version: 'fixture-prompt-v2',
  proposals: [{
    source_field: 'observation:1:title', target_type: 'title',
    author_index: null, source_text: TITLE, source_language: 'kn',
    source_script: 'Knda', source_normalized: TITLE, variant_text: 'Godaan',
    variant_language: 'kn-Latn', variant_script: 'Latn',
    variant_type: 'primary_roman', variant_normalized: 'godaan',
  }],
};

export async function createVariantOwnerDatabase(throughMigration) {
  const db = await createPhase9Database({ throughMigration });
  await db.exec(`INSERT INTO public.stores(id,display_name)
    VALUES('${STORE}','Store A'),('${OTHER_STORE}','Store B');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active')`);
  return db;
}

export async function resetVariantOwnerFixture(db) {
  await resetActor(db);
  await db.exec(`TRUNCATE public.phase9_search_variant_rollout_audit,
    public.phase9_search_variant_language_rollouts,
    public.phase9_search_variant_benchmark_reviews,
    public.phase9_search_variant_benchmark_executions,
    public.phase9_search_variant_benchmark_manifests,
    public.phase9_search_variant_decisions,
    public.phase9_search_variant_alias_links,public.book_search_aliases,
    public.phase9_search_variant_proposal_sets,
    public.phase9_search_variant_proposals,public.image_analysis_observations,
    public.image_analysis_results,public.image_extraction_candidates,
    public.image_extraction_jobs,public.image_extraction_inputs,
    public.media_assets,public.image_extraction_sessions CASCADE`);
  await setActor(db, OWNER, 'service_role');
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,
     orchestration_version,prompt_version)
    VALUES('${SESSION}','${STORE}','${OWNER}','kn','good','A1',
      'phase9-v1','fixture-prompt-v2');
    INSERT INTO public.media_assets
    (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
     detected_mime,bytes,width,height,validation_version,validated_at,
     reencode_version,exif_strip_version,session_id,retention_class,lifecycle_status)
    VALUES('${MEDIA}','${STORE}','${OWNER}','scan_input','private_scan',
      'image-extraction-inputs','${STORE}/scan_input/${SESSION}/${INPUT}/a.webp',
      '${'a'.repeat(64)}','image/webp',32,1,1,'phase9-media-v1',
      transaction_timestamp(),'fixture','fixture','${SESSION}',
      'phase9-private-scan','linked');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT}','${SESSION}','${STORE}','${MEDIA}','camera','queued',
      '${'a'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,
     correlation_id)
    VALUES('${JOB}','${STORE}','input','${INPUT}','vision_extract',
      'vision:${INPUT}','phase9-v1','${CORRELATION}')`);
  const claim = (await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows[0];
  await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB}','${WORKER}','${claim.lease_token}',${claim.attempt_count})`);
  await scalar(db, `SELECT public.phase9_persist_vision_analysis_with_variants(
    '${JOB}','${WORKER}','${claim.lease_token}',${claim.attempt_count},
    '${json(vision)}'::jsonb,'${json(variants)}'::jsonb)`);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: TITLE, language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
}
