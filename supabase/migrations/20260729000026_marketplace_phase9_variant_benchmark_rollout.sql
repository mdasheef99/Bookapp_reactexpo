BEGIN; -- Phase 9 M26: benchmark evidence, legal review state, and rollout controls.
CREATE TABLE public.phase9_search_variant_benchmark_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dataset_key text NOT NULL CHECK (dataset_key~'^[a-z][a-z0-9._-]{1,63}$'),
  dataset_version text NOT NULL CHECK (dataset_version~'^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$'),
  dataset_identity text NOT NULL UNIQUE CHECK (dataset_identity~'^[0-9a-f]{64}$'),
  manifest_schema_version text NOT NULL CHECK (manifest_schema_version='p9-search-variant-benchmark-manifest-v1'),
  language text NOT NULL CHECK (language~'^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'), script text NOT NULL CHECK (script~'^[A-Z][a-z]{3}$'),
  sample_count integer NOT NULL CHECK (sample_count>=0),
  fixture_set_sha256 text NOT NULL CHECK (fixture_set_sha256~'^[0-9a-f]{64}$'),
  canonicalization_version text NOT NULL CHECK (canonicalization_version='p9-search-variant-benchmark-canonical-v1'),
  canonical_manifest jsonb NOT NULL CHECK (jsonb_typeof(canonical_manifest)='object'
    AND octet_length(convert_to(canonical_manifest::text,'UTF8'))<=16777216),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(), UNIQUE(dataset_key,dataset_version));
CREATE TABLE public.phase9_search_variant_benchmark_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_identity text NOT NULL UNIQUE CHECK (execution_identity~'^[0-9a-f]{64}$'),
  manifest_id uuid NOT NULL REFERENCES public.phase9_search_variant_benchmark_manifests(id) ON DELETE RESTRICT,
  model_key text NOT NULL CHECK (model_key~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  model_version text NOT NULL CHECK (model_version~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  prompt_version text NOT NULL CHECK (prompt_version~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  sidecar_schema_version text NOT NULL CHECK (sidecar_schema_version='search_variant_proposals_v1'),
  policy_version text NOT NULL CHECK (policy_version~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  runner_version text NOT NULL CHECK (runner_version~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  result_sha256 text NOT NULL CHECK (result_sha256~'^[0-9a-f]{64}$'),
  result_canonicalization_version text NOT NULL CHECK (
    result_canonicalization_version='p9-search-variant-benchmark-result-canonical-v1'),
  metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics)='object' AND octet_length(convert_to(metrics::text,'UTF8'))<=1048576),
  eligible_for_review boolean NOT NULL, denial_reason text, executed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((eligible_for_review AND denial_reason IS NULL) OR (NOT eligible_for_review AND denial_reason IS NOT NULL)));
CREATE TABLE public.phase9_search_variant_benchmark_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.phase9_search_variant_benchmark_executions(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('approved','rejected','revoked','superseded')), actor_user_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason~'^[a-z][a-z0-9_]{2,63}$'), note text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 500),
  prior_review_id uuid REFERENCES public.phase9_search_variant_benchmark_reviews(id) ON DELETE RESTRICT,
  request_identity text NOT NULL UNIQUE CHECK (request_identity~'^[0-9a-f]{64}$'),
  review_order bigint GENERATED ALWAYS AS IDENTITY UNIQUE, reviewed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((action IN ('approved','rejected') AND prior_review_id IS NULL)
    OR (action IN ('revoked','superseded') AND prior_review_id IS NOT NULL)));
CREATE UNIQUE INDEX phase9_variant_one_approval_idx
  ON public.phase9_search_variant_benchmark_reviews(execution_id)
  WHERE action='approved';
DO $do$
DECLARE v_table text;
BEGIN
FOREACH v_table IN ARRAY ARRAY[
  'phase9_search_variant_benchmark_manifests','phase9_search_variant_benchmark_executions',
  'phase9_search_variant_benchmark_reviews']
LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
  EXECUTE format('ALTER TABLE public.%I OWNER TO postgres',v_table);
  EXECUTE format('REVOKE ALL PRIVILEGES ON public.%I FROM PUBLIC,anon,authenticated,service_role',v_table);
  EXECUTE format('GRANT SELECT ON public.%I TO service_role',v_table);
  EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON public.%I '
    ||'FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_variant_audit_immutable()',v_table,v_table);
END LOOP;
END
$do$;
CREATE FUNCTION marketplace_sec.phase9_benchmark_metric(p_items jsonb,p_dimension text DEFAULT NULL,p_value text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $function$
SELECT (CASE WHEN p_dimension IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(p_dimension,p_value) END)||jsonb_build_object(
  'total_item_count',count(*),'complete_item_count',count(*) FILTER(WHERE i->>'status'='complete'),
  'failed_item_count',count(*) FILTER(WHERE i->>'status'='failed'),'invalid_item_count',count(*) FILTER(WHERE i->>'status'='invalid'),
  'governed_excluded_count',count(*) FILTER(WHERE i->>'status'='excluded'),
  'exact_match_count',count(*) FILTER(WHERE i->>'exact_match'='true'))
FROM jsonb_array_elements(p_items) i
WHERE p_dimension IS NULL OR i->>p_dimension=p_value
$function$;
CREATE FUNCTION marketplace_sec.phase9_json_string_matches(p_object jsonb,p_key text,p_pattern text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $function$
SELECT coalesce(jsonb_typeof(p_object->p_key)='string' AND p_object->>p_key~p_pattern,false)
$function$;
CREATE FUNCTION marketplace_sec.phase9_validate_benchmark_result(p_manifest jsonb,p_execution jsonb)
RETURNS TABLE(sample_count integer,eligible boolean,denial_reason text) LANGUAGE plpgsql STABLE SET search_path='' AS $function$
DECLARE r jsonb:=p_execution->'result';a jsonb:=r->'aggregate';g jsonb;dimension text;
  groups jsonb;total_count integer;complete_count integer;
BEGIN
  IF jsonb_typeof(p_manifest->'fixtures') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_manifest->'sample_count') IS DISTINCT FROM 'number'
    OR NOT coalesce(p_manifest->>'sample_count'~'^(0|[1-9][0-9]{0,3}|10000)$',false)
    OR jsonb_typeof(r) IS DISTINCT FROM 'object'
    OR jsonb_typeof(a) IS DISTINCT FROM 'object'
    OR jsonb_typeof(r->'items') IS DISTINCT FROM 'array'
    OR jsonb_typeof(r->'per_field') IS DISTINCT FROM 'array'
    OR jsonb_typeof(r->'per_scenario') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_manifest->'fixtures')>10000 THEN
    RAISE EXCEPTION 'P9_BENCHMARK_RESULT_INVALID';
  END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_manifest->'fixtures') f
    WHERE jsonb_typeof(f) IS DISTINCT FROM 'object'
      OR NOT marketplace_sec.phase9_json_string_matches(f,'fixture_id','^[a-z0-9][a-z0-9._-]{1,63}$')
      OR NOT marketplace_sec.phase9_json_string_matches(f,'field','^(title|author)$')
      OR NOT marketplace_sec.phase9_json_string_matches(f,'scenario','^[a-z][a-z0-9_]{1,63}$')
      OR EXISTS(SELECT 1 FROM (VALUES
        ('source_text',1,512,true),('expected_variant',1,256,true),
        ('captured_output',1,256,f->>'result_status'='complete')
      ) spec(key,min_length,max_length,is_required)
      WHERE is_required AND (jsonb_typeof(f->key) IS DISTINCT FROM 'string'
        OR char_length(btrim(f->>key)) NOT BETWEEN min_length AND max_length))
      OR NOT marketplace_sec.phase9_json_string_matches(f,'result_status','^(complete|failed|invalid|excluded)$')
      OR NOT marketplace_sec.phase9_json_string_matches(f,'evaluation_obligation','^(required|exclusion_permitted)$')
      OR NOT f ? 'authorized_exclusion_category'
      OR (f->>'result_status'<>'complete'
        AND f->'captured_output' IS DISTINCT FROM 'null'::jsonb)
      OR (f->>'evaluation_obligation'='required'
        AND f->'authorized_exclusion_category' IS DISTINCT FROM 'null'::jsonb)
      OR (f->>'evaluation_obligation'='exclusion_permitted' AND NOT
        marketplace_sec.phase9_json_string_matches(f,'authorized_exclusion_category','^[a-z][a-z0-9_]{2,63}$'))
      OR (f->>'result_status'='excluded'
        AND f->>'evaluation_obligation' IS DISTINCT FROM 'exclusion_permitted')
  ) THEN
    RAISE EXCEPTION 'P9_BENCHMARK_RESULT_INVALID';
  END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(r->'items') i
    WHERE jsonb_typeof(i) IS DISTINCT FROM 'object'
      OR NOT i ?& ARRAY['fixture_id','field','scenario','status','exact_match','governed_exclusion_category']
      OR NOT marketplace_sec.phase9_json_string_matches(i,'fixture_id','^[a-z0-9][a-z0-9._-]{1,63}$')
      OR NOT marketplace_sec.phase9_json_string_matches(i,'field','^(title|author)$')
      OR NOT marketplace_sec.phase9_json_string_matches(i,'scenario','^[a-z][a-z0-9_]{1,63}$')
      OR NOT marketplace_sec.phase9_json_string_matches(i,'status','^(complete|failed|invalid|excluded)$')
      OR (i->>'status'='complete' AND jsonb_typeof(i->'exact_match') IS DISTINCT FROM 'boolean')
      OR (i->>'status'<>'complete' AND i->'exact_match' IS DISTINCT FROM 'null'::jsonb)
      OR (i->>'status'='excluded' AND NOT
        marketplace_sec.phase9_json_string_matches(i,'governed_exclusion_category','^[a-z][a-z0-9_]{2,63}$'))
      OR (i->>'status'<>'excluded' AND i->'governed_exclusion_category'<>'null'::jsonb)
  ) THEN
    RAISE EXCEPTION 'P9_BENCHMARK_RESULT_INVALID';
  END IF;
  total_count:=jsonb_array_length(r->'items');
  IF (p_manifest->>'sample_count')::integer<>total_count
    OR jsonb_array_length(p_manifest->'fixtures')<>total_count THEN
    RAISE EXCEPTION 'P9_BENCHMARK_COUNT_MISMATCH';
  END IF;
  IF (SELECT count(DISTINCT f->>'fixture_id') FROM jsonb_array_elements(p_manifest->'fixtures') f)<>total_count
    OR (SELECT count(DISTINCT i->>'fixture_id') FROM jsonb_array_elements(r->'items') i)<>total_count
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest->'fixtures') f
      FULL JOIN jsonb_array_elements(r->'items') i ON i->>'fixture_id'=f->>'fixture_id'
      WHERE f IS NULL OR i IS NULL
        OR i->>'field' IS DISTINCT FROM f->>'field'
        OR i->>'scenario' IS DISTINCT FROM f->>'scenario'
        OR i->>'status' IS DISTINCT FROM f->>'result_status'
        OR (i->>'status'='excluded' AND (f->>'evaluation_obligation' IS DISTINCT FROM 'exclusion_permitted'
          OR i->>'governed_exclusion_category' IS DISTINCT FROM f->>'authorized_exclusion_category'))
    ) THEN
    RAISE EXCEPTION 'P9_BENCHMARK_ITEM_SET_MISMATCH';
  END IF;
  -- p9-search-variant-benchmark-result-canonical-v1 uses the same
  -- NFKC/lowercase/punctuation/whitespace comparison as the TS runner.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest->'fixtures') f
    JOIN jsonb_array_elements(r->'items') i ON i->>'fixture_id'=f->>'fixture_id'
    WHERE i->'exact_match' IS DISTINCT FROM CASE
      WHEN f->>'result_status'='complete' THEN to_jsonb(
        marketplace_sec.phase9_variant_compare_key(f->>'captured_output')
          =marketplace_sec.phase9_variant_compare_key(f->>'expected_variant'))
      ELSE 'null'::jsonb END
  ) THEN
    RAISE EXCEPTION 'P9_BENCHMARK_EXACT_MATCH_MISMATCH';
  END IF;
  IF NOT a ?& ARRAY['total_item_count','complete_item_count','failed_item_count',
      'invalid_item_count','governed_excluded_count','exact_match_count'] THEN
    RAISE EXCEPTION 'P9_BENCHMARK_RESULT_INVALID';
  END IF;
  IF a<>marketplace_sec.phase9_benchmark_metric(r->'items') THEN
    RAISE EXCEPTION 'P9_BENCHMARK_COUNT_MISMATCH';
  END IF;
  FOREACH dimension IN ARRAY ARRAY['field','scenario'] LOOP
    groups:=r->('per_'||dimension);
    IF jsonb_array_length(groups)<>(SELECT count(DISTINCT i->>dimension) FROM jsonb_array_elements(r->'items') i)
      OR (SELECT count(DISTINCT group_row->>dimension)
        FROM jsonb_array_elements(groups) group_row)
      <>jsonb_array_length(groups) THEN
      RAISE EXCEPTION 'P9_BENCHMARK_COUNT_MISMATCH';
    END IF;
    FOR g IN SELECT value FROM jsonb_array_elements(groups) LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'items') i WHERE i->>dimension=g->>dimension)
        OR g<>marketplace_sec.phase9_benchmark_metric(
        r->'items',dimension,g->>dimension) THEN
        RAISE EXCEPTION 'P9_BENCHMARK_COUNT_MISMATCH';
      END IF;
    END LOOP;
  END LOOP;
  IF p_manifest->'fixtures' IS DISTINCT FROM (SELECT coalesce(
      jsonb_agg(f ORDER BY f->>'fixture_id'),'[]'::jsonb)
      FROM jsonb_array_elements(p_manifest->'fixtures') f)
    OR NOT r ?& ARRAY['result_schema_version','dataset_key','dataset_version','dataset_identity',
      'language','script','model_key','model_version','prompt_version','sidecar_schema_version','policy_version']
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['result_schema_version','dataset_key','dataset_version','dataset_identity',
      'language','script','model_key','model_version','prompt_version','sidecar_schema_version','policy_version']) key
      WHERE jsonb_typeof(r->key) IS DISTINCT FROM 'string')
    OR r->>'result_schema_version' IS DISTINCT FROM 'p9-search-variant-benchmark-result-v1'
    OR r->>'dataset_key' IS DISTINCT FROM p_manifest->>'dataset_key'
    OR r->>'dataset_version' IS DISTINCT FROM p_manifest->>'dataset_version'
    OR r->>'dataset_identity' IS DISTINCT FROM p_manifest->>'dataset_identity'
    OR r->>'language' IS DISTINCT FROM p_manifest->>'language'
    OR r->>'script' IS DISTINCT FROM p_manifest->>'script'
    OR r->>'model_key' IS DISTINCT FROM p_execution->>'model_key'
    OR r->>'model_version' IS DISTINCT FROM p_execution->>'model_version'
    OR r->>'prompt_version' IS DISTINCT FROM p_execution->>'prompt_version'
    OR r->>'sidecar_schema_version' IS DISTINCT FROM p_execution->>'sidecar_schema_version'
    OR r->>'policy_version' IS DISTINCT FROM p_execution->>'policy_version' THEN
    RAISE EXCEPTION 'P9_BENCHMARK_IDENTITY_MISMATCH';
  END IF;
  complete_count:=(a->>'complete_item_count')::integer;
eligible:=complete_count>=100;
denial_reason:=CASE WHEN total_count=0 THEN 'no_qualifying_dataset' WHEN complete_count<100 THEN 'insufficient_dataset' ELSE NULL END;
  IF NOT r ?& ARRAY['eligible_for_review','denial_reason']
    OR jsonb_typeof(r->'eligible_for_review') IS DISTINCT FROM 'boolean'
    OR r->'eligible_for_review' IS DISTINCT FROM to_jsonb(eligible)
    OR r->'denial_reason' IS DISTINCT FROM (CASE
      WHEN denial_reason IS NULL THEN 'null'::jsonb
      ELSE to_jsonb(denial_reason)
    END) THEN
    RAISE EXCEPTION 'P9_BENCHMARK_ELIGIBILITY_MISMATCH';
  END IF;
  sample_count:=total_count;
  RETURN NEXT;
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_trusted_benchmark_result(
  p_manifest jsonb,p_execution jsonb,p_eligible boolean,p_denial_reason text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $function$
DECLARE
  r jsonb:=p_execution->'result';
  v_items jsonb;
  v_aggregate jsonb;
  v_fields jsonb;
  v_scenarios jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'fixture_id',f->>'fixture_id',
    'field',f->>'field',
    'scenario',f->>'scenario',
    'status',i->>'status',
    'captured_output',f->'captured_output',
    'governed_exclusion_category',i->'governed_exclusion_category',
    'exact_match',CASE WHEN f->>'result_status'='complete' THEN to_jsonb(
      marketplace_sec.phase9_variant_compare_key(f->>'captured_output')
        =marketplace_sec.phase9_variant_compare_key(f->>'expected_variant'))
      ELSE 'null'::jsonb END
  ) ORDER BY convert_to(f->>'fixture_id','UTF8')),'[]'::jsonb)
  INTO v_items
  FROM jsonb_array_elements(p_manifest->'fixtures') f
  JOIN jsonb_array_elements(r->'items') i
    ON i->>'fixture_id'=f->>'fixture_id';

  v_aggregate:=marketplace_sec.phase9_benchmark_metric(v_items);
  SELECT coalesce(jsonb_agg(metric ORDER BY convert_to(metric->>'field','UTF8')),
    '[]'::jsonb) INTO v_fields
  FROM (
    SELECT marketplace_sec.phase9_benchmark_metric(v_items,'field',value) metric
    FROM (SELECT DISTINCT item->>'field' value
      FROM jsonb_array_elements(v_items) item) dimensions
  ) field_metrics;
  SELECT coalesce(jsonb_agg(metric ORDER BY convert_to(metric->>'scenario','UTF8')),
    '[]'::jsonb) INTO v_scenarios
  FROM (
    SELECT marketplace_sec.phase9_benchmark_metric(
      v_items,'scenario',value) metric
    FROM (SELECT DISTINCT item->>'scenario' value
      FROM jsonb_array_elements(v_items) item) dimensions
  ) scenario_metrics;

  RETURN jsonb_build_object(
    'execution_identity',p_execution->>'execution_identity',
    'runner_version',p_execution->>'runner_version',
    'result_schema_version',r->>'result_schema_version',
    'dataset_key',r->>'dataset_key',
    'dataset_version',r->>'dataset_version',
    'dataset_identity',r->>'dataset_identity',
    'language',r->>'language',
    'script',r->>'script',
    'model_key',r->>'model_key',
    'model_version',r->>'model_version',
    'prompt_version',r->>'prompt_version',
    'sidecar_schema_version',r->>'sidecar_schema_version',
    'policy_version',r->>'policy_version',
    'aggregate',v_aggregate,
    'per_field',v_fields,
    'per_scenario',v_scenarios,
    'items',v_items,
    'eligible_for_review',p_eligible,
    'denial_reason',CASE WHEN p_denial_reason IS NULL
      THEN 'null'::jsonb ELSE to_jsonb(p_denial_reason) END);
END
$function$;
CREATE FUNCTION public.phase9_record_search_variant_benchmark(p_manifest jsonb,p_execution jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_canonical jsonb;
  v_manifest uuid;
  v_execution uuid;
  v_dataset_identity text;
  v_fixture_set_sha256 text;
  v_count integer;
  v_eligible boolean;
  v_denial text;
  v_trusted_result jsonb;
  v_result_sha256 text;
  v_result_canonicalization_version text
    :='p9-search-variant-benchmark-result-canonical-v1';
BEGIN
  IF auth.role()<>'service_role' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF jsonb_typeof(p_manifest) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_execution) IS DISTINCT FROM 'object'
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'schema_version',
      '^p9-search-variant-benchmark-manifest-v1$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'canonicalization_version',
      '^p9-search-variant-benchmark-canonical-v1$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'dataset_key','^[a-z][a-z0-9._-]{1,63}$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'dataset_version','^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'dataset_identity','^[0-9a-f]{64}$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'language','^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'script','^[A-Z][a-z]{3}$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_manifest,'fixture_set_sha256','^[0-9a-f]{64}$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_execution,'execution_identity','^[0-9a-f]{64}$')
    OR EXISTS(SELECT 1 FROM unnest(ARRAY[
      'model_key','model_version','prompt_version','policy_version','runner_version']) key
      WHERE NOT marketplace_sec.phase9_json_string_matches(
        p_execution,key,'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'))
    OR NOT marketplace_sec.phase9_json_string_matches(p_execution,'sidecar_schema_version','^search_variant_proposals_v1$')
    OR NOT marketplace_sec.phase9_json_string_matches(p_execution,'result_sha256','^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
SELECT sample_count,eligible,denial_reason INTO v_count,v_eligible,v_denial
  FROM marketplace_sec.phase9_validate_benchmark_result(p_manifest,p_execution);
v_canonical:=p_manifest-ARRAY[
  'canonicalization_version','sample_count','dataset_identity','fixture_set_sha256'];
v_dataset_identity:=encode(extensions.digest(jsonb_build_array(
  p_manifest->>'canonicalization_version',v_canonical)::text,'sha256'),'hex');
v_fixture_set_sha256:=encode(extensions.digest(jsonb_build_array(
  p_manifest->>'canonicalization_version',v_canonical->'fixtures')::text,'sha256'),'hex');
IF ROW(p_manifest->>'dataset_identity',p_manifest->>'fixture_set_sha256')
  IS DISTINCT FROM ROW(v_dataset_identity,v_fixture_set_sha256) THEN
  RAISE EXCEPTION 'P9_BENCHMARK_IDENTITY_MISMATCH';
END IF;
v_trusted_result:=marketplace_sec.phase9_trusted_benchmark_result(
  p_manifest,p_execution,v_eligible,v_denial);
v_result_sha256:=encode(extensions.digest(jsonb_build_array(
  v_result_canonicalization_version,v_trusted_result)::text,'sha256'),'hex');
IF p_execution->>'result_sha256' IS DISTINCT FROM v_result_sha256 THEN
  RAISE EXCEPTION 'P9_BENCHMARK_RESULT_IDENTITY_MISMATCH';
END IF;
INSERT INTO public.phase9_search_variant_benchmark_manifests(
  dataset_key,dataset_version,dataset_identity,manifest_schema_version,language,
  script,sample_count,fixture_set_sha256,canonicalization_version,canonical_manifest)
VALUES(p_manifest->>'dataset_key',p_manifest->>'dataset_version',v_dataset_identity,
  p_manifest->>'schema_version',lower(p_manifest->>'language'),p_manifest->>'script',
  v_count,v_fixture_set_sha256,p_manifest->>'canonicalization_version',v_canonical)
ON CONFLICT(dataset_identity) DO NOTHING;
SELECT id INTO v_manifest FROM public.phase9_search_variant_benchmark_manifests
WHERE dataset_identity=v_dataset_identity AND dataset_key=p_manifest->>'dataset_key'
  AND dataset_version=p_manifest->>'dataset_version' AND language=lower(p_manifest->>'language')
  AND script=p_manifest->>'script' AND sample_count=v_count
  AND fixture_set_sha256=v_fixture_set_sha256 AND canonical_manifest=v_canonical;
IF v_manifest IS NULL THEN
  RAISE EXCEPTION 'P9_IDEMPOTENCY_CONFLICT';
END IF;
INSERT INTO public.phase9_search_variant_benchmark_executions(execution_identity,manifest_id,model_key,model_version,prompt_version,
  sidecar_schema_version,policy_version,runner_version,result_sha256,
  result_canonicalization_version,metrics,eligible_for_review,denial_reason)
VALUES(p_execution->>'execution_identity',v_manifest,p_execution->>'model_key',p_execution->>'model_version',p_execution->>'prompt_version',
  p_execution->>'sidecar_schema_version',p_execution->>'policy_version',
  p_execution->>'runner_version',v_result_sha256,
  v_result_canonicalization_version,v_trusted_result,v_eligible,v_denial)
ON CONFLICT(execution_identity) DO NOTHING RETURNING id INTO v_execution;
IF v_execution IS NULL THEN
  SELECT id INTO v_execution FROM public.phase9_search_variant_benchmark_executions
  WHERE execution_identity=p_execution->>'execution_identity' AND manifest_id=v_manifest AND model_key=p_execution->>'model_key'
    AND model_version=p_execution->>'model_version' AND prompt_version=p_execution->>'prompt_version'
    AND sidecar_schema_version=p_execution->>'sidecar_schema_version' AND policy_version=p_execution->>'policy_version'
    AND runner_version=p_execution->>'runner_version'
    AND result_sha256=v_result_sha256
    AND result_canonicalization_version=v_result_canonicalization_version
    AND metrics=v_trusted_result AND eligible_for_review=v_eligible
    AND denial_reason IS NOT DISTINCT FROM v_denial;
END IF;
IF v_execution IS NULL THEN
  RAISE EXCEPTION 'P9_IDEMPOTENCY_CONFLICT';
END IF;
RETURN jsonb_build_object('manifest_id',v_manifest,'execution_id',v_execution);
END
$function$;
CREATE FUNCTION public.phase9_review_search_variant_benchmark(
  p_execution_id uuid,p_action text,p_reason text,p_note text,p_request_identity text,p_prior_review_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_actor uuid:=auth.uid();v_execution public.phase9_search_variant_benchmark_executions;
  v_current public.phase9_search_variant_benchmark_reviews;v_replay public.phase9_search_variant_benchmark_reviews;v_id uuid;
BEGIN
IF auth.role()<>'authenticated'
  OR NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) THEN
  RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
END IF;
IF p_action IS NULL OR p_action NOT IN ('approved','rejected','revoked','superseded')
  OR p_reason IS NULL OR p_reason!~'^[a-z][a-z0-9_]{2,63}$'
  OR p_request_identity IS NULL OR p_request_identity!~'^[0-9a-f]{64}$'
  OR (p_note IS NOT NULL AND char_length(trim(p_note)) NOT BETWEEN 1 AND 500) THEN
  RAISE EXCEPTION 'P9_REQUEST_INVALID';
END IF;
PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  concat_ws('|','benchmark-execution-review',p_execution_id::text),0));
SELECT * INTO v_execution FROM public.phase9_search_variant_benchmark_executions WHERE id=p_execution_id FOR UPDATE;
IF v_execution.id IS NULL THEN
  RAISE EXCEPTION 'P9_REQUEST_INVALID';
END IF;
SELECT * INTO v_replay FROM public.phase9_search_variant_benchmark_reviews WHERE request_identity=p_request_identity;
IF v_replay.id IS NOT NULL THEN
  IF ROW(v_replay.execution_id,v_replay.actor_user_id,v_replay.action,
      v_replay.reason,v_replay.note,v_replay.prior_review_id)
    IS DISTINCT FROM ROW(p_execution_id,v_actor,p_action,p_reason,
      nullif(trim(p_note),''),p_prior_review_id) THEN
    RAISE EXCEPTION 'P9_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN v_replay.id;
END IF;
SELECT * INTO v_current FROM public.phase9_search_variant_benchmark_reviews WHERE execution_id=p_execution_id
  ORDER BY review_order DESC,id DESC LIMIT 1;
IF (p_action IN ('approved','rejected') AND (v_current.id IS NOT NULL
    OR p_prior_review_id IS NOT NULL
    OR (p_action='approved' AND NOT v_execution.eligible_for_review)))
  OR (p_action IN ('revoked','superseded') AND (v_current.id IS NULL
    OR v_current.action<>'approved'
    OR p_prior_review_id IS DISTINCT FROM v_current.id)) THEN
  RAISE EXCEPTION 'P9_REVIEW_TRANSITION_INVALID';
END IF;
INSERT INTO public.phase9_search_variant_benchmark_reviews(
  execution_id,action,actor_user_id,reason,note,prior_review_id,request_identity)
VALUES(p_execution_id,p_action,v_actor,p_reason,nullif(trim(p_note),''),p_prior_review_id,p_request_identity)
RETURNING id INTO v_id;
RETURN v_id;
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_benchmark_review_is_effective_approval(p_review_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
SELECT coalesce((SELECT review.action='approved' AND execution.eligible_for_review AND review.id=(
  SELECT latest.id FROM public.phase9_search_variant_benchmark_reviews latest WHERE latest.execution_id=review.execution_id
  ORDER BY latest.review_order DESC,latest.id DESC LIMIT 1)
FROM public.phase9_search_variant_benchmark_reviews review JOIN public.phase9_search_variant_benchmark_executions execution
  ON execution.id=review.execution_id WHERE review.id=p_review_id),false) $function$;
ALTER FUNCTION marketplace_sec.phase9_validate_benchmark_result(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_trusted_benchmark_result(
  jsonb,jsonb,boolean,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_benchmark_metric(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_json_string_matches(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_benchmark_review_is_effective_approval(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_record_search_variant_benchmark(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_review_search_variant_benchmark(uuid,text,text,text,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_validate_benchmark_result(jsonb,jsonb),
  marketplace_sec.phase9_trusted_benchmark_result(jsonb,jsonb,boolean,text),
  marketplace_sec.phase9_benchmark_metric(jsonb,text,text),
  marketplace_sec.phase9_json_string_matches(jsonb,text,text),
  marketplace_sec.phase9_benchmark_review_is_effective_approval(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_record_search_variant_benchmark(jsonb,jsonb),
  public.phase9_review_search_variant_benchmark(uuid,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_record_search_variant_benchmark(jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_review_search_variant_benchmark(uuid,text,text,text,text,uuid) TO authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.phase9_search_variant_benchmark_manifests,
  public.phase9_search_variant_benchmark_executions,public.phase9_search_variant_benchmark_reviews FROM service_role;
COMMIT;
