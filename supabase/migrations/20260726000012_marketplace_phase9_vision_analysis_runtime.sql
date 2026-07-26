-- Phase 9 M12: fixture-backed p9-vision-v2 evidence and exact worker transitions.
-- Forward-only after M11. This migration is intentionally not applied by Unit 4.
BEGIN;

ALTER TABLE public.image_extraction_inputs
  DROP CONSTRAINT image_extraction_inputs_detected_candidate_count_check;
ALTER TABLE public.image_extraction_inputs
  ADD CONSTRAINT image_extraction_inputs_detected_candidate_count_check
  CHECK (detected_candidate_count BETWEEN 0 AND 100);

ALTER TABLE public.image_extraction_jobs
  ADD COLUMN vision_reconciliation_attempt integer,
  ADD COLUMN vision_reconciliation_worker text,
  ADD COLUMN vision_reconciliation_lease_token_hash text,
  ADD COLUMN vision_reconciliation_summary jsonb,
  ADD CONSTRAINT image_extraction_jobs_vision_reconciliation_check CHECK (
    (vision_reconciliation_attempt IS NULL
      AND vision_reconciliation_worker IS NULL
      AND vision_reconciliation_lease_token_hash IS NULL
      AND vision_reconciliation_summary IS NULL)
    OR (
      vision_reconciliation_attempt BETWEEN 1 AND 5
      AND char_length(vision_reconciliation_worker) BETWEEN 16 AND 128
      AND vision_reconciliation_lease_token_hash ~ '^[0-9a-f]{64}$'
      AND vision_reconciliation_summary = jsonb_build_object(
        'outcome','relationship_reconciliation_required',
        'safe_error_code','P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED'
      )
      AND status='resolved'
      AND last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED'
    )
  );

CREATE TABLE public.image_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
  input_id uuid NOT NULL REFERENCES public.image_extraction_inputs(id),
  vision_job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  contract_version text NOT NULL CHECK (contract_version='p9-contract-v1'),
  analysis_schema_version text NOT NULL CHECK (analysis_schema_version='p9-vision-v2'),
  pipeline_version text NOT NULL,
  prompt_version text NOT NULL,
  adapter_key text NOT NULL,
  adapter_version text NOT NULL,
  provider_key text NOT NULL,
  model_key text NOT NULL,
  model_version text NOT NULL,
  image_outcome text NOT NULL CHECK (image_outcome IN
    ('analyzed','no_books','too_many_books','quality_rejected')),
  authoritative_outcome text NOT NULL CHECK (authoritative_outcome IN
    ('accepted','accepted_with_language_skips','no_books','language_mismatch',
     'over_visible_book_limit','quality_rejected')),
  detected_visible_book_count integer CHECK (detected_visible_book_count BETWEEN 0 AND 100),
  accepted_candidate_count integer NOT NULL CHECK (accepted_candidate_count BETWEEN 0 AND 15),
  canonical_result_snapshot jsonb NOT NULL,
  canonical_result_sha256 text NOT NULL CHECK (canonical_result_sha256 ~ '^[0-9a-f]{64}$'),
  completing_attempt integer NOT NULL CHECK (completing_attempt BETWEEN 1 AND 5),
  completing_worker text NOT NULL CHECK (char_length(completing_worker) BETWEEN 16 AND 128),
  completing_lease_token_hash text NOT NULL CHECK (completing_lease_token_hash ~ '^[0-9a-f]{64}$'),
  completion_summary jsonb NOT NULL,
  safe_error_code text,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(vision_job_id,analysis_schema_version),
  UNIQUE(input_id,analysis_schema_version)
);

CREATE TABLE public.image_analysis_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_result_id uuid NOT NULL REFERENCES public.image_analysis_results(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  input_id uuid NOT NULL REFERENCES public.image_extraction_inputs(id),
  observation_ordinal smallint NOT NULL CHECK (observation_ordinal BETWEEN 1 AND 15),
  disposition text NOT NULL CHECK (disposition IN
    ('candidate','language_mismatch','unknown_language','identity_insufficient')),
  observed_title text,
  observed_authors text[] NOT NULL DEFAULT '{}',
  observed_publisher_clue text,
  observed_isbn_clue text,
  observed_language text NOT NULL,
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  geometry jsonb,
  warning_codes text[] NOT NULL DEFAULT '{}',
  observation_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(analysis_result_id,observation_ordinal)
);

ALTER TABLE public.image_extraction_candidates
  ADD COLUMN vision_job_id uuid REFERENCES public.image_extraction_jobs(id),
  ADD COLUMN analysis_observation_id uuid REFERENCES public.image_analysis_observations(id),
  ADD COLUMN analysis_schema_version text,
  ADD COLUMN observed_publisher_clue text,
  ADD CONSTRAINT image_extraction_candidates_analysis_lineage_check CHECK (
    (vision_job_id IS NULL AND analysis_observation_id IS NULL AND analysis_schema_version IS NULL)
    OR (vision_job_id IS NOT NULL AND analysis_observation_id IS NOT NULL
      AND analysis_schema_version='p9-vision-v2')
  ),
  ADD CONSTRAINT image_extraction_candidates_analysis_observation_unique
    UNIQUE(analysis_observation_id),
  ADD CONSTRAINT image_extraction_candidates_vision_identity_unique
    UNIQUE(vision_job_id,candidate_index,analysis_schema_version);

CREATE INDEX image_extraction_jobs_vision_claim_idx
  ON public.image_extraction_jobs(next_attempt_at,lease_expires_at,id)
  WHERE job_kind='vision_extract'
    AND status IN ('open','retry_scheduled','in_progress');

ALTER TABLE public.image_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_analysis_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.image_analysis_results FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.image_analysis_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.image_analysis_results TO service_role;
GRANT SELECT ON TABLE public.image_analysis_observations TO service_role;

CREATE FUNCTION marketplace_sec.phase9_reject_analysis_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'P9_VISION_EVIDENCE_IMMUTABLE';
END$$;
CREATE TRIGGER image_analysis_results_immutable
  BEFORE UPDATE OR DELETE ON public.image_analysis_results
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_reject_analysis_evidence_mutation();
CREATE TRIGGER image_analysis_observations_immutable
  BEFORE UPDATE OR DELETE ON public.image_analysis_observations
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_reject_analysis_evidence_mutation();

CREATE FUNCTION marketplace_sec.phase9_vision_safe_text(p_value text,p_max integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_lower text;
BEGIN
  IF p_value IS NULL OR p_max IS NULL OR btrim(p_value)=''
    OR char_length(p_value)>p_max OR p_value ~ '[[:cntrl:]]' THEN
    RETURN false;
  END IF;
  IF position(chr(8234) in p_value)>0 OR position(chr(8235) in p_value)>0
    OR position(chr(8236) in p_value)>0 OR position(chr(8237) in p_value)>0
    OR position(chr(8238) in p_value)>0 OR position(chr(8294) in p_value)>0
    OR position(chr(8295) in p_value)>0 OR position(chr(8296) in p_value)>0
    OR position(chr(8297) in p_value)>0 THEN
    RETURN false;
  END IF;
  v_lower:=lower(p_value);
  IF v_lower LIKE '%http://%' OR v_lower LIKE '%https://%'
    OR v_lower LIKE '%file://%' OR v_lower LIKE '%javascript:%'
    OR v_lower LIKE '%data:text/html%' OR v_lower ~ '</?[a-z][^>]*>'
    OR p_value ~ '\[[^]]+\]\([^)]*\)'
    OR p_value ~ '(^|[[:space:]])(\.\.?[/\\]|[A-Za-z]:\\|\\\\[^[:space:]\\]+\\[^[:space:]\\]+|/([^/[:space:]]+/)+[^/[:space:]]+)'
    OR v_lower ~ '(^|[[:space:]])(select .+ from|insert into|update .+ set|delete from|drop (table|schema|database)|alter (table|schema)|truncate table)([[:space:]]|$)'
    OR v_lower ~ '(^|[[:space:]])(curl|wget|powershell|cmd\.exe|bash|sh)[[:space:]]+[-/]'
    OR v_lower ~ '(^|[[:space:]])rm[[:space:]]+-rf([[:space:]]|$)'
    OR v_lower ~ '(^|[[:space:]])bearer[[:space:]]+[a-z0-9._~+/-]{16,}'
    OR v_lower ~ '(api[_-]?key|access[_-]?token|lease[_-]?token|secret|password)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}' THEN
    RETURN false;
  END IF;
  RETURN true;
END$$;

CREATE FUNCTION marketplace_sec.phase9_vision_warnings_valid(p_value jsonb,p_max integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array'
    OR jsonb_array_length(p_value)>p_max THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_value) e
    WHERE jsonb_typeof(e.value)<>'string'
      OR e.value#>>'{}' NOT IN (
        'low_contrast','low_confidence','partial_title','partial_author',
        'partial_isbn','partial_publisher','partial_occlusion','glare',
        'perspective_distortion'
      )
  ) THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements_text(p_value))
    IS DISTINCT FROM (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_value)) THEN
    RETURN false;
  END IF;
  RETURN true;
END$$;

CREATE FUNCTION marketplace_sec.phase9_vision_timestamp_valid(p_value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_timestamp timestamptz;
BEGIN
  IF p_value IS NULL OR char_length(p_value)>40
    OR p_value !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RETURN false; END IF;
  v_timestamp:=p_value::timestamptz;
  RETURN v_timestamp NOT IN ('infinity'::timestamptz,'-infinity'::timestamptz);
EXCEPTION WHEN OTHERS THEN RETURN false;
END$$;

CREATE FUNCTION marketplace_sec.phase9_vision_geometry_valid(p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_x numeric; v_y numeric; v_width numeric; v_height numeric; v_rotation numeric;
BEGIN
  IF p_value='null'::jsonb THEN RETURN true; END IF;
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_value))<>5
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_value) k
      WHERE k<>ALL(ARRAY['x','y','width','height','rotation'])
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_each(p_value) e WHERE jsonb_typeof(e.value)<>'number'
    ) THEN RETURN false; END IF;
  v_x:=(p_value->>'x')::numeric; v_y:=(p_value->>'y')::numeric;
  v_width:=(p_value->>'width')::numeric; v_height:=(p_value->>'height')::numeric;
  v_rotation:=(p_value->>'rotation')::numeric;
  RETURN v_x BETWEEN 0 AND 1 AND v_y BETWEEN 0 AND 1
    AND v_width BETWEEN 0.001 AND 1 AND v_height BETWEEN 0.001 AND 1
    AND v_rotation BETWEEN -180 AND 180
    AND v_x+v_width<=1.000001 AND v_y+v_height<=1.000001;
EXCEPTION WHEN OTHERS THEN RETURN false;
END$$;

CREATE FUNCTION marketplace_sec.phase9_finish_vision_relationship_reconciliation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_hash text;
  v_summary jsonb:=jsonb_build_object(
    'outcome','relationship_reconciliation_required',
    'safe_error_code','P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED'
  );
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker IS NULL OR p_lease_token IS NULL OR p_attempt_count IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  v_hash:=encode(extensions.digest(p_lease_token,'sha256'),'hex');
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_job.status='resolved'
    AND v_job.last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED' THEN
    IF v_job.job_kind='vision_extract'
      AND v_job.vision_reconciliation_attempt IS NOT DISTINCT FROM p_attempt_count
      AND v_job.vision_reconciliation_worker IS NOT DISTINCT FROM p_worker
      AND v_job.vision_reconciliation_lease_token_hash IS NOT DISTINCT FROM v_hash THEN
      RETURN v_job.vision_reconciliation_summary;
    END IF;
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  IF v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  UPDATE public.image_extraction_jobs
  SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
    last_safe_error_category='vision_relationship',
    last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED',
    completed_at=transaction_timestamp(),dead_lettered_at=NULL,
    vision_reconciliation_attempt=p_attempt_count,
    vision_reconciliation_worker=p_worker,
    vision_reconciliation_lease_token_hash=v_hash,
    vision_reconciliation_summary=v_summary,
    updated_at=transaction_timestamp()
  WHERE id=p_job_id;
  RETURN v_summary;
END$$;

CREATE FUNCTION marketplace_sec.claim_phase9_vision_jobs(
  p_batch_size integer,p_worker text
) RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_batch_size IS NULL
    OR p_worker IS NULL OR p_batch_size NOT BETWEEN 1 AND 10
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  RETURN QUERY WITH claimed AS (
    SELECT j.id FROM public.image_extraction_jobs j
    WHERE j.job_kind='vision_extract'
      AND j.status IN ('open','retry_scheduled','in_progress')
      AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts
    ORDER BY j.next_attempt_at,j.id FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), tokenized AS MATERIALIZED (
    SELECT c.id,replace(gen_random_uuid()::text,'-','')
      ||replace(gen_random_uuid()::text,'-','') AS token
    FROM claimed c
  ), updated AS (
    UPDATE public.image_extraction_jobs j
    SET status='in_progress',lease_owner=p_worker,
      lease_expires_at=transaction_timestamp()+interval '5 minutes',
      attempt_count=j.attempt_count+1,
      lease_token_hash=encode(extensions.digest(t.token,'sha256'),'hex'),
      updated_at=transaction_timestamp()
    FROM tokenized t WHERE j.id=t.id
    RETURNING j.id,j.attempt_count,t.token
  )
  SELECT u.id,u.attempt_count,u.token FROM updated u;
END$$;

CREATE FUNCTION marketplace_sec.phase9_vision_job_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions;
  v_media public.media_assets;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker IS NULL OR p_lease_token IS NULL OR p_attempt_count IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_job.status='resolved'
    AND v_job.last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED' THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    );
  END IF;
  IF v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
    IF FOUND THEN
      SELECT * INTO v_media FROM public.media_assets WHERE id=v_input.media_asset_id;
    END IF;
  END IF;
  IF v_job.entity_type IS DISTINCT FROM 'input' OR v_input.id IS NULL
    OR v_session.id IS NULL OR v_media.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=v_job.store_id)
    OR v_input.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.store_id IS DISTINCT FROM v_job.store_id
    OR v_media.store_id IS DISTINCT FROM v_job.store_id
    OR v_input.session_id IS DISTINCT FROM v_session.id
    OR v_input.media_asset_id IS DISTINCT FROM v_media.id
    OR v_media.session_id IS DISTINCT FROM v_session.id
    OR v_input.sha256 IS DISTINCT FROM v_media.sha256
    OR v_media.purpose IS DISTINCT FROM 'scan_input'
    OR v_media.privacy_class IS DISTINCT FROM 'private_scan'
    OR v_media.lifecycle_status IS DISTINCT FROM 'linked'
    OR v_media.detected_mime IS DISTINCT FROM 'image/webp'
    OR v_media.validated_at IS NULL OR v_media.reencode_version IS NULL
    OR v_media.exif_strip_version IS NULL
    OR v_input.state NOT IN ('queued','processing') THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    );
  END IF;
  UPDATE public.image_extraction_inputs
  SET state='processing',version=version+1,updated_at=transaction_timestamp()
  WHERE id=v_input.id AND state='queued';
  RETURN jsonb_build_object(
    'contract_version','p9-contract-v1',
    'schema_version','p9-vision-v2',
    'pipeline_version',v_input.orchestration_version,
    'prompt_version',coalesce(v_session.prompt_version,'fixture-prompt-v2'),
    'adapter_key',coalesce(v_job.adapter_key,'fixture_adapter'),
    'adapter_version',coalesce(v_job.adapter_version,'1.0.0'),
    'job_reference','job_'||replace(v_job.correlation_id::text,'-',''),
    'correlation_id',v_job.correlation_id,
    'expected_language',v_session.selected_language,
    'sanitized_media_reference','media_'||substr(
      encode(extensions.digest(v_media.id::text||':'||v_job.id::text,'sha256'),'hex'),1,48)
  );
END$$;

CREATE FUNCTION marketplace_sec.phase9_persist_vision_analysis(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_result jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions;
  v_media public.media_assets;
  v_existing public.image_analysis_results;
  v_result_id uuid;
  v_obs jsonb;
  v_author jsonb;
  v_observation_id uuid;
  v_ordinal integer:=0;
  v_candidate_count integer:=0;
  v_observation_count integer:=0;
  v_language_skip_count integer:=0;
  v_identity_skip_count integer:=0;
  v_disposition text;
  v_authoritative_outcome text;
  v_input_state text;
  v_job_status text;
  v_safe_code text;
  v_summary jsonb;
  v_expected_job_reference text;
  v_detected_count integer;
  v_image_outcome text;
  v_lease_hash text;
  v_result_hash text;
  v_result_bytes integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker IS NULL OR p_lease_token IS NULL OR p_attempt_count IS NULL
    OR p_result IS NULL OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  v_lease_hash:=encode(extensions.digest(p_lease_token,'sha256'),'hex');
  v_result_bytes:=octet_length(convert_to(p_result::text,'UTF8'));
  v_result_hash:=encode(extensions.digest(p_result::text,'sha256'),'hex');
  SELECT * INTO v_existing FROM public.image_analysis_results
  WHERE vision_job_id=p_job_id AND analysis_schema_version='p9-vision-v2';
  IF FOUND THEN
    IF v_existing.canonical_result_sha256 IS NOT DISTINCT FROM v_result_hash
      AND v_existing.completing_attempt IS NOT DISTINCT FROM p_attempt_count
      AND v_existing.completing_worker IS NOT DISTINCT FROM p_worker
      AND v_existing.completing_lease_token_hash IS NOT DISTINCT FROM v_lease_hash THEN
      RETURN v_existing.completion_summary;
    END IF;
    RAISE EXCEPTION 'P9_VISION_PERSISTENCE_CONFLICT';
  END IF;

  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_job.status='resolved'
    AND v_job.last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED' THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    );
  END IF;
  IF v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM v_lease_hash THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id FOR UPDATE;
    IF FOUND THEN
      SELECT * INTO v_media FROM public.media_assets WHERE id=v_input.media_asset_id;
    END IF;
  END IF;
  IF v_job.entity_type IS DISTINCT FROM 'input' OR v_input.id IS NULL
    OR v_session.id IS NULL OR v_media.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=v_job.store_id)
    OR v_input.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.store_id IS DISTINCT FROM v_job.store_id
    OR v_media.store_id IS DISTINCT FROM v_job.store_id
    OR v_input.session_id IS DISTINCT FROM v_session.id
    OR v_input.media_asset_id IS DISTINCT FROM v_media.id
    OR v_media.session_id IS DISTINCT FROM v_session.id
    OR v_input.sha256 IS DISTINCT FROM v_media.sha256
    OR v_media.purpose IS DISTINCT FROM 'scan_input'
    OR v_media.privacy_class IS DISTINCT FROM 'private_scan'
    OR v_media.lifecycle_status IS DISTINCT FROM 'linked'
    OR v_media.detected_mime IS DISTINCT FROM 'image/webp'
    OR v_media.validated_at IS NULL OR v_media.reencode_version IS NULL
    OR v_media.exif_strip_version IS NULL
    OR v_input.state IS DISTINCT FROM 'processing' THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    );
  END IF;
  IF jsonb_typeof(p_result)<>'object' OR v_result_bytes>262144
    OR (SELECT count(*) FROM jsonb_object_keys(p_result))<>18
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_result) k
      WHERE k<>ALL(ARRAY[
        'contract_version','schema_version','pipeline_version','prompt_version',
        'adapter_key','adapter_version','job_reference','attempt_number',
        'correlation_id','expected_language','provider_key','model_key',
        'model_version','received_at','image_outcome',
        'detected_visible_book_count','observations','warning_codes'
      ])
    ) THEN
    RAISE EXCEPTION 'P9_VISION_SCHEMA_INVALID';
  END IF;
  v_expected_job_reference:='job_'||replace(v_job.correlation_id::text,'-','');
  IF EXISTS (
      SELECT 1 FROM jsonb_each(p_result) e
      WHERE e.key<>ALL(ARRAY['attempt_number','detected_visible_book_count',
        'observations','warning_codes'])
        AND jsonb_typeof(e.value)<>'string'
    )
    OR p_result->>'contract_version' IS DISTINCT FROM 'p9-contract-v1'
    OR p_result->>'schema_version' IS DISTINCT FROM 'p9-vision-v2'
    OR p_result->>'pipeline_version' IS DISTINCT FROM v_input.orchestration_version
    OR p_result->>'prompt_version' IS DISTINCT FROM coalesce(v_session.prompt_version,'fixture-prompt-v2')
    OR p_result->>'adapter_key' IS DISTINCT FROM coalesce(v_job.adapter_key,'fixture_adapter')
    OR p_result->>'adapter_version' IS DISTINCT FROM coalesce(v_job.adapter_version,'1.0.0')
    OR p_result->>'job_reference' IS DISTINCT FROM v_expected_job_reference
    OR jsonb_typeof(p_result->'attempt_number')<>'number'
    OR p_result->>'attempt_number' !~ '^[1-5]$'
    OR (p_result->>'attempt_number')::integer IS DISTINCT FROM p_attempt_count
    OR p_result->>'correlation_id' IS DISTINCT FROM v_job.correlation_id::text
    OR p_result->>'expected_language' IS DISTINCT FROM v_session.selected_language
    OR p_result->>'pipeline_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_result->>'prompt_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_result->>'adapter_key' !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_result->>'adapter_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_result->>'job_reference' !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_result->>'correlation_id' !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_result->>'expected_language' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    OR p_result->>'provider_key' !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_result->>'model_key' !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_result->>'model_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR NOT marketplace_sec.phase9_vision_timestamp_valid(p_result->>'received_at')
    OR p_result->>'image_outcome' NOT IN
      ('analyzed','no_books','too_many_books','quality_rejected')
    OR jsonb_typeof(p_result->'observations')<>'array'
    OR NOT marketplace_sec.phase9_vision_warnings_valid(p_result->'warning_codes',8)
    OR (
      jsonb_typeof(p_result->'detected_visible_book_count') NOT IN ('number','null')
    )
    OR (
      jsonb_typeof(p_result->'detected_visible_book_count')='number'
      AND p_result->>'detected_visible_book_count' !~ '^(0|[1-9][0-9]?|100)$'
    ) THEN
    RAISE EXCEPTION 'P9_VISION_SCHEMA_INVALID';
  END IF;
  v_image_outcome:=p_result->>'image_outcome';
  v_detected_count:=CASE WHEN p_result->'detected_visible_book_count'='null'::jsonb
    THEN NULL ELSE (p_result->>'detected_visible_book_count')::integer END;
  v_observation_count:=jsonb_array_length(p_result->'observations');
  IF NOT (
    (v_image_outcome='no_books' AND v_detected_count=0 AND v_observation_count=0)
    OR (v_image_outcome='too_many_books' AND v_detected_count BETWEEN 16 AND 100
      AND v_observation_count=0)
    OR (v_image_outcome='analyzed' AND v_detected_count BETWEEN 1 AND 15
      AND v_observation_count=v_detected_count)
    OR (v_image_outcome='quality_rejected'
      AND (v_detected_count IS NULL OR v_detected_count BETWEEN 0 AND 15)
      AND v_observation_count=0)
  ) THEN RAISE EXCEPTION 'P9_VISION_SCHEMA_INVALID'; END IF;

  FOR v_obs IN SELECT value FROM jsonb_array_elements(p_result->'observations') LOOP
    v_ordinal:=v_ordinal+1;
    IF jsonb_typeof(v_obs)<>'object'
      OR (SELECT count(*) FROM jsonb_object_keys(v_obs))<>9
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_obs) k
        WHERE k<>ALL(ARRAY['ordinal','title_guess','author_guesses','publisher_clue',
          'isbn_clue','detected_language','confidence','geometry','warning_codes'])
      )
      OR jsonb_typeof(v_obs->'ordinal')<>'number'
      OR v_obs->>'ordinal' !~ '^([1-9]|1[0-5])$'
      OR (v_obs->>'ordinal')::integer<>v_ordinal
      OR jsonb_typeof(v_obs->'author_guesses')<>'array'
      OR jsonb_array_length(v_obs->'author_guesses')>20
      OR NOT marketplace_sec.phase9_vision_warnings_valid(v_obs->'warning_codes',4)
      OR jsonb_typeof(v_obs->'confidence')<>'number'
      OR (v_obs->>'confidence')::numeric NOT BETWEEN 0 AND 1
      OR (
        jsonb_typeof(v_obs->'title_guess')<>'null'
        AND (jsonb_typeof(v_obs->'title_guess')<>'string'
          OR NOT marketplace_sec.phase9_vision_safe_text(v_obs->>'title_guess',512))
      )
      OR (
        jsonb_typeof(v_obs->'publisher_clue')<>'null'
        AND (jsonb_typeof(v_obs->'publisher_clue')<>'string'
          OR NOT marketplace_sec.phase9_vision_safe_text(v_obs->>'publisher_clue',256))
      )
      OR (
        jsonb_typeof(v_obs->'isbn_clue')<>'null'
        AND (jsonb_typeof(v_obs->'isbn_clue')<>'string'
          OR NOT marketplace_sec.phase9_vision_safe_text(v_obs->>'isbn_clue',32)
          OR v_obs->>'isbn_clue' !~ '^[0-9Xx -]+$'
          OR v_obs->>'isbn_clue' !~ '[0-9]')
      )
      OR jsonb_typeof(v_obs->'detected_language')<>'string'
      OR v_obs->>'detected_language' !~ '^(und|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$'
      OR NOT marketplace_sec.phase9_vision_geometry_valid(v_obs->'geometry') THEN
      RAISE EXCEPTION 'P9_VISION_SCHEMA_INVALID';
    END IF;
    FOR v_author IN SELECT value FROM jsonb_array_elements(v_obs->'author_guesses') LOOP
      IF jsonb_typeof(v_author)<>'string'
        OR NOT marketplace_sec.phase9_vision_safe_text(v_author#>>'{}',256) THEN
        RAISE EXCEPTION 'P9_VISION_SCHEMA_INVALID';
      END IF;
    END LOOP;
    IF v_obs->>'detected_language'='und'
      OR split_part(lower(v_obs->>'detected_language'),'-',1)
        <>split_part(lower(v_session.selected_language),'-',1) THEN
      v_language_skip_count:=v_language_skip_count+1;
    ELSIF v_obs->'title_guess'='null'::jsonb THEN
      v_identity_skip_count:=v_identity_skip_count+1;
    ELSE
      v_candidate_count:=v_candidate_count+1;
    END IF;
  END LOOP;

  IF v_image_outcome='no_books' THEN
    v_authoritative_outcome:='no_books'; v_input_state:='skipped';
    v_job_status:='resolved_noop'; v_safe_code:='P9_VISION_NO_BOOKS';
  ELSIF v_image_outcome='too_many_books' THEN
    v_authoritative_outcome:='over_visible_book_limit'; v_input_state:='failed';
    v_job_status:='resolved'; v_safe_code:='P9_VISION_OVER_LIMIT';
  ELSIF v_image_outcome='quality_rejected' THEN
    v_authoritative_outcome:='quality_rejected'; v_input_state:='failed';
    v_job_status:='resolved'; v_safe_code:='P9_VISION_QUALITY_REJECTED';
  ELSIF v_language_skip_count=v_observation_count THEN
    v_authoritative_outcome:='language_mismatch'; v_input_state:='skipped';
    v_job_status:='resolved_noop'; v_safe_code:='P9_VISION_LANGUAGE_MISMATCH';
  ELSE
    v_authoritative_outcome:=CASE
      WHEN v_language_skip_count+v_identity_skip_count>0
        THEN 'accepted_with_language_skips' ELSE 'accepted' END;
    v_input_state:=CASE WHEN v_candidate_count>0 THEN 'ready' ELSE 'skipped' END;
    v_job_status:=CASE WHEN v_candidate_count>0 THEN 'resolved' ELSE 'resolved_noop' END;
    v_safe_code:=NULL;
  END IF;
  v_summary:=jsonb_build_object(
    'outcome',v_authoritative_outcome,
    'candidate_count',v_candidate_count,
    'detected_visible_book_count',v_detected_count
  );
  INSERT INTO public.image_analysis_results(
    store_id,session_id,input_id,vision_job_id,contract_version,analysis_schema_version,
    pipeline_version,prompt_version,adapter_key,adapter_version,provider_key,model_key,
    model_version,image_outcome,authoritative_outcome,detected_visible_book_count,
    accepted_candidate_count,canonical_result_snapshot,canonical_result_sha256,
    completing_attempt,completing_worker,completing_lease_token_hash,completion_summary,
    safe_error_code,received_at
  ) VALUES (
    v_job.store_id,v_session.id,v_input.id,v_job.id,'p9-contract-v1','p9-vision-v2',
    p_result->>'pipeline_version',p_result->>'prompt_version',p_result->>'adapter_key',
    p_result->>'adapter_version',p_result->>'provider_key',p_result->>'model_key',
    p_result->>'model_version',v_image_outcome,v_authoritative_outcome,v_detected_count,
    v_candidate_count,p_result,v_result_hash,p_attempt_count,p_worker,
    v_lease_hash,v_summary,v_safe_code,(p_result->>'received_at')::timestamptz
  ) RETURNING id INTO v_result_id;

  v_ordinal:=0; v_candidate_count:=0;
  FOR v_obs IN SELECT value FROM jsonb_array_elements(p_result->'observations') LOOP
    v_ordinal:=v_ordinal+1;
    IF v_obs->>'detected_language'='und' THEN v_disposition:='unknown_language';
    ELSIF split_part(lower(v_obs->>'detected_language'),'-',1)
      <>split_part(lower(v_session.selected_language),'-',1) THEN
      v_disposition:='language_mismatch';
    ELSIF v_obs->'title_guess'='null'::jsonb THEN v_disposition:='identity_insufficient';
    ELSE v_disposition:='candidate'; v_candidate_count:=v_candidate_count+1;
    END IF;
    INSERT INTO public.image_analysis_observations(
      analysis_result_id,store_id,input_id,observation_ordinal,disposition,
      observed_title,observed_authors,observed_publisher_clue,observed_isbn_clue,
      observed_language,confidence,geometry,warning_codes,observation_snapshot
    ) VALUES (
      v_result_id,v_job.store_id,v_input.id,v_ordinal,v_disposition,
      v_obs->>'title_guess',ARRAY(SELECT jsonb_array_elements_text(v_obs->'author_guesses')),
      v_obs->>'publisher_clue',v_obs->>'isbn_clue',v_obs->>'detected_language',
      (v_obs->>'confidence')::numeric,v_obs->'geometry',
      ARRAY(SELECT jsonb_array_elements_text(v_obs->'warning_codes')),v_obs
    ) RETURNING id INTO v_observation_id;
    IF v_disposition='candidate' THEN
      INSERT INTO public.image_extraction_candidates(
        session_id,input_id,store_id,candidate_index,geometry,observed_title,
        observed_authors,observed_isbn_clue,observed_language,confidence,
        selected_snapshot,state,vision_job_id,analysis_observation_id,
        analysis_schema_version,observed_publisher_clue
      ) VALUES (
        v_session.id,v_input.id,v_job.store_id,v_candidate_count,v_obs->'geometry',
        v_obs->>'title_guess',ARRAY(SELECT jsonb_array_elements_text(v_obs->'author_guesses')),
        v_obs->>'isbn_clue',v_obs->>'detected_language',(v_obs->>'confidence')::numeric,
        v_obs,'processing',v_job.id,v_observation_id,'p9-vision-v2',
        v_obs->>'publisher_clue'
      );
    END IF;
  END LOOP;

  UPDATE public.image_extraction_inputs
  SET state=v_input_state,detected_candidate_count=v_detected_count,
    quality_result=v_authoritative_outcome,quality_reason=v_safe_code,
    adapter_version=p_result->>'adapter_version',processed_at=transaction_timestamp(),
    version=version+1,updated_at=transaction_timestamp()
  WHERE id=v_input.id;
  UPDATE public.image_extraction_sessions
  SET candidate_count=candidate_count+v_candidate_count,
    model_version=p_result->>'model_version',
    updated_at=transaction_timestamp()
  WHERE id=v_session.id;
  UPDATE public.image_extraction_jobs
  SET status=v_job_status,lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
    last_safe_error_category=CASE WHEN v_safe_code IS NULL THEN NULL ELSE 'vision_analysis' END,
    last_safe_error_code=v_safe_code,completed_at=transaction_timestamp(),
    updated_at=transaction_timestamp()
  WHERE id=v_job.id;
  RETURN v_summary;
END$$;

CREATE FUNCTION marketplace_sec.phase9_fail_vision_job(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_safe_error_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions;
  v_media public.media_assets;
  v_status text;
  v_retryable boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker IS NULL OR p_lease_token IS NULL OR p_attempt_count IS NULL
    OR p_safe_error_code IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5
    OR p_safe_error_code NOT IN (
      'P9_VISION_SCHEMA_INVALID','P9_VISION_ANALYZER_TIMEOUT',
      'P9_VISION_ANALYZER_UNAVAILABLE','P9_VISION_MEDIA_UNAVAILABLE',
      'P9_VISION_DATABASE_RETRYABLE','P9_VISION_INTERNAL_PERMANENT'
    ) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_retryable:=p_safe_error_code IN (
    'P9_VISION_ANALYZER_TIMEOUT','P9_VISION_ANALYZER_UNAVAILABLE',
    'P9_VISION_DATABASE_RETRYABLE'
  );
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_job.status='resolved'
    AND v_job.last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED' THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    )->>'outcome';
  END IF;
  IF v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
    IF FOUND THEN
      SELECT * INTO v_media FROM public.media_assets WHERE id=v_input.media_asset_id;
    END IF;
  END IF;
  IF v_job.entity_type IS DISTINCT FROM 'input' OR v_input.id IS NULL
    OR v_session.id IS NULL OR v_media.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=v_job.store_id)
    OR v_input.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.store_id IS DISTINCT FROM v_job.store_id
    OR v_media.store_id IS DISTINCT FROM v_job.store_id
    OR v_input.session_id IS DISTINCT FROM v_session.id
    OR v_input.media_asset_id IS DISTINCT FROM v_media.id
    OR v_media.session_id IS DISTINCT FROM v_session.id
    OR v_input.sha256 IS DISTINCT FROM v_media.sha256
    OR v_media.purpose IS DISTINCT FROM 'scan_input'
    OR v_media.privacy_class IS DISTINCT FROM 'private_scan'
    OR v_media.lifecycle_status IS DISTINCT FROM 'linked'
    OR v_media.detected_mime IS DISTINCT FROM 'image/webp'
    OR v_media.validated_at IS NULL OR v_media.reencode_version IS NULL
    OR v_media.exif_strip_version IS NULL
    OR v_input.state NOT IN ('queued','processing') THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    )->>'outcome';
  END IF;
  v_status:=CASE
    WHEN v_retryable AND v_job.attempt_count<v_job.max_attempts THEN 'retry_scheduled'
    WHEN v_retryable AND v_job.attempt_count>=v_job.max_attempts THEN 'dead_letter'
    ELSE 'resolved' END;
  UPDATE public.image_extraction_jobs
  SET status=v_status,lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
    next_attempt_at=transaction_timestamp()+CASE attempt_count
      WHEN 1 THEN interval '30 seconds' WHEN 2 THEN interval '2 minutes'
      WHEN 3 THEN interval '10 minutes' WHEN 4 THEN interval '30 minutes'
      ELSE interval '2 hours' END,
    last_safe_error_category='vision_analysis',last_safe_error_code=p_safe_error_code,
    completed_at=CASE WHEN v_status='resolved' THEN transaction_timestamp() END,
    dead_lettered_at=CASE WHEN v_status='dead_letter' THEN transaction_timestamp() END,
    updated_at=transaction_timestamp()
  WHERE id=v_job.id;
  IF v_status IN ('resolved','dead_letter') THEN
    UPDATE public.image_extraction_inputs
    SET state='failed',quality_result='quality_rejected',
      quality_reason=p_safe_error_code,processed_at=transaction_timestamp(),
      version=version+1,updated_at=transaction_timestamp()
    WHERE id=v_input.id;
  END IF;
  RETURN v_status;
END$$;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_reject_analysis_evidence_mutation()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_vision_safe_text(text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_vision_warnings_valid(jsonb,integer)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_vision_timestamp_valid(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_vision_geometry_valid(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finish_vision_relationship_reconciliation(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.claim_phase9_vision_jobs(integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_vision_job_context(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_persist_vision_analysis(uuid,text,text,integer,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fail_vision_job(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase9_vision_jobs(integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_vision_job_context(uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_persist_vision_analysis(uuid,text,text,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_fail_vision_job(uuid,text,text,integer,text) TO service_role;

COMMIT;
