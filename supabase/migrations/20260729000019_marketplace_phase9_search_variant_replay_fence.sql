-- Phase 9 M19: forward correction for accepted search-variant sidecar replay.
-- M18 remains immutable. This migration requires its verified zero-row baseline.
BEGIN;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM public.phase9_search_variant_proposals) THEN
    RAISE EXCEPTION 'P9_M19_REQUIRES_EMPTY_PROPOSAL_BASELINE';
  END IF;
END
$block$;

CREATE TABLE public.phase9_search_variant_proposal_sets (
  analysis_result_id uuid PRIMARY KEY
    REFERENCES public.image_analysis_results(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  vision_job_id uuid NOT NULL UNIQUE
    REFERENCES public.image_extraction_jobs(id),
  proposal_set_sha256 text NOT NULL
    CHECK (proposal_set_sha256 ~ '^[0-9a-f]{64}$'),
  proposal_count integer NOT NULL
    CHECK (proposal_count BETWEEN 0 AND 1200),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

ALTER TABLE public.phase9_search_variant_proposal_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_search_variant_proposal_sets OWNER TO postgres;
REVOKE ALL PRIVILEGES ON TABLE public.phase9_search_variant_proposal_sets
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.phase9_search_variant_proposal_sets TO service_role;

ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) RENAME TO phase9_persist_vision_analysis_with_variants_m18;

REVOKE ALL ON FUNCTION
  marketplace_sec.phase9_persist_vision_analysis_with_variants_m18(
    uuid,text,text,integer,jsonb,jsonb
  ) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_result jsonb,p_variants jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_summary jsonb;
  v_analysis public.image_analysis_results;
  v_set public.phase9_search_variant_proposal_sets;
  v_proposal_set_sha256 text;
  v_proposal_count integer;
BEGIN
  v_proposal_set_sha256:=encode(
    extensions.digest(coalesce(p_variants,'null'::jsonb)::text,'sha256'),
    'hex'
  );
  v_summary:=
    marketplace_sec.phase9_persist_vision_analysis_with_variants_m18(
      p_job_id,p_worker,p_lease_token,p_attempt_count,p_result,p_variants
    );
  IF v_summary->>'variant_persistence_status' IS DISTINCT FROM 'accepted' THEN
    RETURN v_summary;
  END IF;

  SELECT * INTO v_analysis
  FROM public.image_analysis_results
  WHERE vision_job_id=p_job_id
    AND analysis_schema_version='p9-vision-v2';
  IF v_analysis.id IS NULL THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  v_proposal_count:=jsonb_array_length(p_variants->'proposals');

  INSERT INTO public.phase9_search_variant_proposal_sets(
    analysis_result_id,store_id,vision_job_id,proposal_set_sha256,
    proposal_count
  ) VALUES (
    v_analysis.id,v_analysis.store_id,p_job_id,v_proposal_set_sha256,
    v_proposal_count
  )
  ON CONFLICT (analysis_result_id) DO NOTHING;

  SELECT * INTO v_set
  FROM public.phase9_search_variant_proposal_sets
  WHERE analysis_result_id=v_analysis.id
  FOR UPDATE;
  IF v_set.store_id IS DISTINCT FROM v_analysis.store_id
    OR v_set.vision_job_id IS DISTINCT FROM p_job_id
    OR v_set.proposal_set_sha256 IS DISTINCT FROM v_proposal_set_sha256
    OR v_set.proposal_count IS DISTINCT FROM v_proposal_count THEN
    RAISE EXCEPTION 'P9_SEARCH_VARIANT_REPLAY_CONFLICT';
  END IF;
  RETURN v_summary;
END
$function$;

ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants_m18(
  uuid,text,text,integer,jsonb,jsonb
) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  marketplace_sec.phase9_persist_vision_analysis_with_variants(
    uuid,text,text,integer,jsonb,jsonb
  ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
  marketplace_sec.phase9_persist_vision_analysis_with_variants(
    uuid,text,text,integer,jsonb,jsonb
  ) TO service_role;

COMMIT;
