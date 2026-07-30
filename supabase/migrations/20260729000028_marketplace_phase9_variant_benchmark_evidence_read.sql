BEGIN; -- Phase 9 M28: bounded platform benchmark-evidence reads only.

CREATE INDEX phase9_variant_benchmark_executions_manifest_idx
  ON public.phase9_search_variant_benchmark_executions(manifest_id,id);
CREATE INDEX phase9_variant_benchmark_reviews_execution_order_idx
  ON public.phase9_search_variant_benchmark_reviews(
    execution_id,review_order DESC,id DESC);

CREATE FUNCTION public.phase9_platform_search_variant_benchmark_summary(
  p_execution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_summary jsonb;
BEGIN
  IF auth.role()<>'service_role' AND (
    auth.role()<>'authenticated'
    OR NOT marketplace_sec.has_platform_role(ARRAY['platform_admin'])
  ) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;

  SELECT jsonb_build_object(
    'execution_id',e.id,
    'execution_identity',e.execution_identity,
    'dataset_key',m.dataset_key,
    'dataset_version',m.dataset_version,
    'dataset_identity',m.dataset_identity,
    'language',m.language,
    'script',m.script,
    'model_key',e.model_key,
    'model_version',e.model_version,
    'prompt_version',e.prompt_version,
    'sidecar_schema_version',e.sidecar_schema_version,
    'policy_version',e.policy_version,
    'runner_version',e.runner_version,
    'manifest_schema_version',m.manifest_schema_version,
    'manifest_canonicalization_version',m.canonicalization_version,
    'result_canonicalization_version',e.result_canonicalization_version,
    'manifest_sha256',m.dataset_identity,
    'fixture_set_sha256',m.fixture_set_sha256,
    'result_sha256',e.result_sha256,
    'sample_count',m.sample_count,
    'aggregate',e.metrics->'aggregate',
    'per_field',e.metrics->'per_field',
    'per_scenario',e.metrics->'per_scenario',
    'eligible_for_review',e.eligible_for_review,
    'denial_reason',CASE WHEN e.denial_reason IS NULL
      THEN 'null'::jsonb ELSE to_jsonb(e.denial_reason) END,
    'latest_review',CASE WHEN latest.id IS NULL THEN 'null'::jsonb
      ELSE jsonb_build_object(
        'review_id',latest.id,
        'action',latest.action,
        'reason',latest.reason,
        'prior_review_id',latest.prior_review_id,
        'reviewed_at',latest.reviewed_at)
      END,
    'rollout_identity',jsonb_build_object(
      'language',m.language,
      'script',m.script,
      'model_key',e.model_key,
      'model_version',e.model_version,
      'prompt_version',e.prompt_version,
      'sidecar_schema_version',e.sidecar_schema_version,
      'dataset_key',m.dataset_key,
      'dataset_version',m.dataset_version,
      'policy_version',e.policy_version,
      'execution_identity',e.execution_identity)
  ) INTO v_summary
  FROM public.phase9_search_variant_benchmark_executions e
  JOIN public.phase9_search_variant_benchmark_manifests m
    ON m.id=e.manifest_id
  LEFT JOIN LATERAL(
    SELECT review.*
    FROM public.phase9_search_variant_benchmark_reviews review
    WHERE review.execution_id=e.id
    ORDER BY review.review_order DESC,review.id DESC
    LIMIT 1
  ) latest ON true
  WHERE e.id=p_execution_id;

  IF v_summary IS NULL THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  RETURN v_summary;
END
$function$;

CREATE FUNCTION public.phase9_platform_search_variant_benchmark_evidence(
  p_execution_id uuid,
  p_after_fixture_id text DEFAULT NULL,
  p_limit integer DEFAULT 100)
RETURNS TABLE(
  fixture_id text,
  source_text text,
  expected_variant text,
  captured_output text,
  field text,
  scenario text,
  expected_outcome text,
  evaluation_obligation text,
  exclusion_permitted boolean,
  permitted_exclusion_category text,
  actual_outcome text,
  exact_match boolean,
  governed_exclusion_category text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.role()<>'service_role' AND (
    auth.role()<>'authenticated'
    OR NOT marketplace_sec.has_platform_role(ARRAY['platform_admin'])
  ) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100
    OR (p_after_fixture_id IS NOT NULL
      AND p_after_fixture_id!~'^[a-z0-9][a-z0-9._-]{1,63}$') THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.phase9_search_variant_benchmark_executions
    WHERE id=p_execution_id
  ) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;

  RETURN QUERY
  SELECT fixture->>'fixture_id',
    fixture->>'source_text',
    fixture->>'expected_variant',
    fixture->>'captured_output',
    fixture->>'field',
    fixture->>'scenario',
    fixture->>'result_status',
    fixture->>'evaluation_obligation',
    fixture->>'evaluation_obligation'='exclusion_permitted',
    fixture->>'authorized_exclusion_category',
    item->>'status',
    CASE WHEN item->'exact_match'='null'::jsonb
      THEN NULL ELSE (item->>'exact_match')::boolean END,
    item->>'governed_exclusion_category'
  FROM public.phase9_search_variant_benchmark_executions e
  JOIN public.phase9_search_variant_benchmark_manifests m
    ON m.id=e.manifest_id
  CROSS JOIN LATERAL jsonb_array_elements(
    m.canonical_manifest->'fixtures') fixture
  JOIN LATERAL jsonb_array_elements(e.metrics->'items') item
    ON item->>'fixture_id'=fixture->>'fixture_id'
  WHERE e.id=p_execution_id
    AND (p_after_fixture_id IS NULL
      OR fixture->>'fixture_id'>p_after_fixture_id)
  ORDER BY fixture->>'fixture_id'
  LIMIT p_limit;
END
$function$;

ALTER FUNCTION public.phase9_platform_search_variant_benchmark_summary(uuid)
  OWNER TO postgres;
ALTER FUNCTION public.phase9_platform_search_variant_benchmark_evidence(
  uuid,text,integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.phase9_platform_search_variant_benchmark_summary(uuid),
  public.phase9_platform_search_variant_benchmark_evidence(uuid,text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  public.phase9_platform_search_variant_benchmark_summary(uuid),
  public.phase9_platform_search_variant_benchmark_evidence(uuid,text,integer)
  TO authenticated,service_role;

COMMIT;
