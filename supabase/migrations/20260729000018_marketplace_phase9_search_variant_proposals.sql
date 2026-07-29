-- Phase 9 M18: private store-scoped search-variant proposal persistence.
-- Forward-only and additive. This file is not authorization to apply it.
BEGIN;

CREATE TABLE public.phase9_search_variant_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_identity text NOT NULL UNIQUE
    CHECK (proposal_identity ~ '^[0-9a-f]{64}$'),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  analysis_result_id uuid NOT NULL REFERENCES public.image_analysis_results(id),
  vision_job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  observation_id uuid NOT NULL REFERENCES public.image_analysis_observations(id),
  source_field text NOT NULL CHECK (
    source_field ~ '^observation:([1-9]|1[0-5]):(title|author:([1-9]|1[0-9]|20))$'
  ),
  target_type text NOT NULL CHECK (target_type IN ('title','author')),
  author_index smallint CHECK (author_index BETWEEN 1 AND 20),
  source_text text NOT NULL CHECK (char_length(source_text) BETWEEN 1 AND 512),
  source_language text NOT NULL CHECK (char_length(source_language) BETWEEN 2 AND 35),
  source_script text NOT NULL CHECK (source_script ~ '^[A-Z][a-z]{3}$'),
  source_normalized text NOT NULL CHECK (char_length(source_normalized) BETWEEN 1 AND 512),
  variant_text text NOT NULL CHECK (char_length(variant_text) BETWEEN 1 AND 256),
  variant_normalized text NOT NULL CHECK (char_length(variant_normalized) BETWEEN 1 AND 300),
  variant_language text NOT NULL CHECK (char_length(variant_language) BETWEEN 2 AND 35),
  variant_script text NOT NULL CHECK (variant_script='Latn'),
  variant_type text NOT NULL CHECK (
    variant_type IN ('primary_roman','roman_alternative','translation_candidate')
  ),
  proposal_schema_version text NOT NULL
    CHECK (proposal_schema_version='search_variant_proposals_v1'),
  contract_version text NOT NULL CHECK (contract_version='p9-contract-v1'),
  generation_source text NOT NULL
    CHECK (generation_source IN ('vision_model','recorded_fixture')),
  provider_key text NOT NULL,
  model_key text NOT NULL,
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','active','rejected','stale')),
  search_eligible boolean NOT NULL DEFAULT false CHECK (NOT search_eligible),
  approval_method text,
  lifecycle_reason text,
  lifecycle_actor_id uuid,
  activated_at timestamptz,
  rejected_at timestamptz,
  stale_at timestamptz,
  inventory_id uuid REFERENCES public.store_inventory(id),
  listing_id uuid REFERENCES public.marketplace_book_listings(id),
  canonical_work_id uuid REFERENCES public.canonical_works(id),
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT phase9_search_variant_target_author_check CHECK (
    (target_type='title' AND author_index IS NULL)
    OR (target_type='author' AND author_index IS NOT NULL)
  ),
  CONSTRAINT phase9_search_variant_initial_lifecycle_check CHECK (
    (status='proposed' AND approval_method IS NULL AND lifecycle_reason IS NULL
      AND lifecycle_actor_id IS NULL AND activated_at IS NULL
      AND rejected_at IS NULL AND stale_at IS NULL AND NOT search_eligible)
    OR status<>'proposed'
  ),
  CONSTRAINT phase9_search_variant_private_foundation_check CHECK (
    inventory_id IS NULL AND listing_id IS NULL
    AND canonical_work_id IS NULL AND canonical_edition_id IS NULL
  )
);

CREATE INDEX phase9_search_variant_candidate_status_idx
  ON public.phase9_search_variant_proposals(store_id,candidate_id,status);
CREATE INDEX phase9_search_variant_observation_field_idx
  ON public.phase9_search_variant_proposals(store_id,observation_id,source_field,status);
CREATE INDEX phase9_search_variant_analysis_idx
  ON public.phase9_search_variant_proposals(store_id,analysis_result_id,status);

ALTER TABLE public.phase9_search_variant_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_search_variant_proposals OWNER TO postgres;
REVOKE ALL PRIVILEGES ON TABLE public.phase9_search_variant_proposals
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.phase9_search_variant_proposals TO service_role;

CREATE FUNCTION marketplace_sec.phase9_search_variant_rejected(
  p_summary jsonb,p_reason text
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=''
AS $function$
  SELECT p_summary || jsonb_build_object(
    'variant_persistence_status','rejected',
    'variant_persistence_reason',p_reason,
    'proposal_count',0,
    'proposal_ids','[]'::jsonb
  )
$function$;

CREATE FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_result jsonb,p_variants jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_summary jsonb;
  v_analysis public.image_analysis_results;
  v_job public.image_extraction_jobs;
  v_row jsonb;
  v_observation public.image_analysis_observations;
  v_candidate public.image_extraction_candidates;
  v_source_field text;
  v_target text;
  v_author_index integer;
  v_observation_ordinal integer;
  v_source_text text;
  v_identity text;
  v_identities text[]:='{}';
  v_count integer;
  v_ids jsonb;
BEGIN
  -- M12 owns the authoritative active claim, relationship, schema and replay fence.
  v_summary:=marketplace_sec.phase9_persist_vision_analysis(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_result
  );
  IF p_variants IS NULL OR jsonb_typeof(p_variants)<>'object'
    OR octet_length(convert_to(p_variants::text,'UTF8'))>65536
    OR (SELECT count(*) FROM jsonb_object_keys(p_variants))<>9
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_variants) k
      WHERE k<>ALL(ARRAY[
        'contract_version','proposal_schema_version','analysis_reference',
        'generation_source','provider_key','model_key','model_version',
        'prompt_version','proposals'
      ])
    )
    OR p_variants->>'contract_version' IS DISTINCT FROM 'p9-contract-v1'
    OR p_variants->>'proposal_schema_version'
      IS DISTINCT FROM 'search_variant_proposals_v1'
    OR p_variants->>'generation_source' NOT IN ('vision_model','recorded_fixture')
    OR p_variants->>'provider_key' !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_variants->>'model_key' !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_variants->>'model_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_variants->>'prompt_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR jsonb_typeof(p_variants->'proposals')<>'array'
    OR jsonb_array_length(p_variants->'proposals')>1200 THEN
    RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'schema_invalid');
  END IF;

  SELECT * INTO v_analysis FROM public.image_analysis_results
    WHERE vision_job_id=p_job_id AND analysis_schema_version='p9-vision-v2';
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  IF v_analysis.id IS NULL OR v_job.id IS NULL
    OR v_analysis.store_id IS DISTINCT FROM v_job.store_id
    OR p_variants->>'analysis_reference' IS DISTINCT FROM v_job.correlation_id::text
    OR p_variants->>'provider_key' IS DISTINCT FROM v_analysis.provider_key
    OR p_variants->>'model_key' IS DISTINCT FROM v_analysis.model_key
    OR p_variants->>'model_version' IS DISTINCT FROM v_analysis.model_version
    OR p_variants->>'prompt_version' IS DISTINCT FROM v_analysis.prompt_version THEN
    RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'provenance_mismatch');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_variants->'proposals') entry
    GROUP BY entry->>'source_field',entry->>'variant_script',
      entry->>'variant_normalized'
    HAVING count(*)>1
  ) THEN
    RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'duplicate_proposal');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_variants->'proposals') entry
    GROUP BY entry->>'source_field'
    HAVING count(*)>4
      OR count(*) FILTER (WHERE entry->>'variant_type'='primary_roman')>1
      OR count(*) FILTER (WHERE entry->>'variant_type'='roman_alternative')>2
      OR count(*) FILTER (WHERE entry->>'variant_type'='translation_candidate')>1
  ) THEN
    RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'proposal_limit');
  END IF;

  -- Validate the complete envelope before inserting any proposal rows.
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_variants->'proposals') LOOP
    IF jsonb_typeof(v_row)<>'object'
      OR (SELECT count(*) FROM jsonb_object_keys(v_row))<>12
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_row) k
        WHERE k<>ALL(ARRAY[
          'source_field','target_type','author_index','source_text',
          'source_language','source_script','source_normalized','variant_text',
          'variant_language','variant_script','variant_type',
          'variant_normalized'
        ])
      )
      OR v_row->>'target_type' NOT IN ('title','author')
      OR v_row->>'variant_type' NOT IN
        ('primary_roman','roman_alternative','translation_candidate')
      OR v_row->>'variant_script' IS DISTINCT FROM 'Latn'
      OR v_row->>'source_script' NOT IN
        ('Latn','Knda','Taml','Telu','Mlym','Deva','Arab','Mtei')
      OR v_row->>'source_language' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
      OR v_row->>'variant_language' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
      OR NOT marketplace_sec.phase9_vision_safe_text(v_row->>'source_text',512)
      OR NOT marketplace_sec.phase9_vision_safe_text(v_row->>'variant_text',256)
      OR NOT marketplace_sec.phase9_vision_safe_text(v_row->>'source_normalized',512)
      OR NOT marketplace_sec.phase9_vision_safe_text(v_row->>'variant_normalized',300)
      OR (v_row->>'source_script'=v_row->>'variant_script'
        AND v_row->>'source_normalized'=v_row->>'variant_normalized')
      OR (v_row->>'variant_type'='translation_candidate'
        AND split_part(v_row->>'variant_language','-',1)<>'en') THEN
      RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'schema_invalid');
    END IF;
    v_source_field:=v_row->>'source_field';
    v_target:=v_row->>'target_type';
    IF v_source_field ~ '^observation:([1-9]|1[0-5]):title$' THEN
      v_observation_ordinal:=split_part(v_source_field,':',2)::integer;
      v_author_index:=NULL;
      IF v_target<>'title' OR v_row->'author_index'<>'null'::jsonb THEN
        RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'source_mismatch');
      END IF;
    ELSIF v_source_field
      ~ '^observation:([1-9]|1[0-5]):author:([1-9]|1[0-9]|20)$' THEN
      v_observation_ordinal:=split_part(v_source_field,':',2)::integer;
      v_author_index:=split_part(v_source_field,':',4)::integer;
      IF v_target<>'author' OR jsonb_typeof(v_row->'author_index')<>'number'
        OR (v_row->>'author_index')::integer<>v_author_index THEN
        RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'source_mismatch');
      END IF;
    ELSE
      RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'source_mismatch');
    END IF;
    SELECT * INTO v_observation FROM public.image_analysis_observations
      WHERE analysis_result_id=v_analysis.id
        AND observation_ordinal=v_observation_ordinal;
    SELECT * INTO v_candidate FROM public.image_extraction_candidates
      WHERE analysis_observation_id=v_observation.id
        AND vision_job_id=p_job_id
        AND store_id=v_analysis.store_id;
    IF v_observation.id IS NULL OR v_candidate.id IS NULL
      OR v_observation.store_id IS DISTINCT FROM v_analysis.store_id
      OR v_observation.disposition IS DISTINCT FROM 'candidate' THEN
      RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'ownership_mismatch');
    END IF;
    v_source_text:=CASE WHEN v_target='title' THEN v_observation.observed_title
      ELSE v_observation.observed_authors[v_author_index] END;
    IF v_source_text IS DISTINCT FROM v_row->>'source_text' THEN
      RETURN marketplace_sec.phase9_search_variant_rejected(v_summary,'source_mismatch');
    END IF;
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_variants->'proposals') LOOP
    v_source_field:=v_row->>'source_field';
    v_target:=v_row->>'target_type';
    v_observation_ordinal:=split_part(v_source_field,':',2)::integer;
    v_author_index:=CASE WHEN v_target='author'
      THEN split_part(v_source_field,':',4)::integer ELSE NULL END;
    SELECT * INTO v_observation FROM public.image_analysis_observations
      WHERE analysis_result_id=v_analysis.id
        AND observation_ordinal=v_observation_ordinal;
    SELECT * INTO v_candidate FROM public.image_extraction_candidates
      WHERE analysis_observation_id=v_observation.id
        AND vision_job_id=p_job_id
        AND store_id=v_analysis.store_id;
    v_identity:=encode(extensions.digest(
      jsonb_build_array(
        v_analysis.store_id,v_analysis.id,v_candidate.id,v_observation.id,
        v_source_field,v_row->>'variant_normalized',v_row->>'variant_script',
        v_row->>'variant_type',p_variants->>'proposal_schema_version'
      )::text,'sha256'
    ),'hex');
    INSERT INTO public.phase9_search_variant_proposals(
      proposal_identity,store_id,analysis_result_id,vision_job_id,candidate_id,
      observation_id,source_field,target_type,author_index,source_text,
      source_language,source_script,source_normalized,variant_text,
      variant_normalized,variant_language,variant_script,variant_type,
      proposal_schema_version,contract_version,generation_source,provider_key,
      model_key,model_version,prompt_version,status,search_eligible
    ) VALUES (
      v_identity,v_analysis.store_id,v_analysis.id,p_job_id,v_candidate.id,
      v_observation.id,v_source_field,v_target,v_author_index,
      v_row->>'source_text',v_row->>'source_language',v_row->>'source_script',
      v_row->>'source_normalized',v_row->>'variant_text',
      v_row->>'variant_normalized',v_row->>'variant_language',
      v_row->>'variant_script',v_row->>'variant_type',
      p_variants->>'proposal_schema_version',p_variants->>'contract_version',
      p_variants->>'generation_source',p_variants->>'provider_key',
      p_variants->>'model_key',p_variants->>'model_version',
      p_variants->>'prompt_version','proposed',false
    )
    ON CONFLICT (proposal_identity) DO NOTHING;
    v_identities:=array_append(v_identities,v_identity);
  END LOOP;
  SELECT count(*)::integer,coalesce(jsonb_agg(id ORDER BY proposal_identity),'[]'::jsonb)
    INTO v_count,v_ids
    FROM public.phase9_search_variant_proposals
    WHERE proposal_identity=ANY(v_identities);
  RETURN v_summary || jsonb_build_object(
    'variant_persistence_status','accepted',
    'proposal_count',coalesce(v_count,0),
    'proposal_ids',coalesce(v_ids,'[]'::jsonb)
  );
END
$function$;

CREATE FUNCTION marketplace_sec.phase9_read_search_variant_proposals(
  p_store_id uuid,p_analysis_result_id uuid DEFAULT NULL,
  p_candidate_id uuid DEFAULT NULL,p_observation_id uuid DEFAULT NULL,
  p_source_field text DEFAULT NULL,p_status text DEFAULT NULL
) RETURNS SETOF public.phase9_search_variant_proposals
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_store_id IS NULL
    OR (p_analysis_result_id IS NULL AND p_candidate_id IS NULL
      AND p_observation_id IS NULL)
    OR (p_status IS NOT NULL
      AND p_status NOT IN ('proposed','active','rejected','stale')) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  RETURN QUERY
    SELECT p.* FROM public.phase9_search_variant_proposals p
    WHERE p.store_id=p_store_id
      AND (p_analysis_result_id IS NULL
        OR p.analysis_result_id=p_analysis_result_id)
      AND (p_candidate_id IS NULL OR p.candidate_id=p_candidate_id)
      AND (p_observation_id IS NULL OR p.observation_id=p_observation_id)
      AND (p_source_field IS NULL OR p.source_field=p_source_field)
      AND (p_status IS NULL OR p.status=p_status)
    ORDER BY p.observation_id,p.source_field,p.proposal_identity;
END
$function$;

CREATE FUNCTION public.phase9_persist_vision_analysis_with_variants(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_result jsonb,p_variants jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $wrapper$
  SELECT marketplace_sec.phase9_persist_vision_analysis_with_variants(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_result,p_variants
  )
$wrapper$;

CREATE FUNCTION public.phase9_read_search_variant_proposals(
  p_store_id uuid,p_analysis_result_id uuid DEFAULT NULL,
  p_candidate_id uuid DEFAULT NULL,p_observation_id uuid DEFAULT NULL,
  p_source_field text DEFAULT NULL,p_status text DEFAULT NULL
) RETURNS SETOF public.phase9_search_variant_proposals
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_read_search_variant_proposals(
    p_store_id,p_analysis_result_id,p_candidate_id,p_observation_id,
    p_source_field,p_status
  )
$wrapper$;

ALTER FUNCTION marketplace_sec.phase9_search_variant_rejected(jsonb,text)
  OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_read_search_variant_proposals(
  uuid,uuid,uuid,uuid,text,text
) OWNER TO postgres;
ALTER FUNCTION public.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) OWNER TO postgres;
ALTER FUNCTION public.phase9_read_search_variant_proposals(
  uuid,uuid,uuid,uuid,text,text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_search_variant_rejected(jsonb,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_read_search_variant_proposals(
  uuid,uuid,uuid,uuid,text,text
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_read_search_variant_proposals(
  uuid,uuid,uuid,uuid,text,text
) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_read_search_variant_proposals(
  uuid,uuid,uuid,uuid,text,text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_persist_vision_analysis_with_variants(
  uuid,text,text,integer,jsonb,jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_read_search_variant_proposals(
  uuid,uuid,uuid,uuid,text,text
) TO service_role;

COMMIT;
