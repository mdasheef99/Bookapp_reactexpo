-- Phase 9 M02: extraction, idempotency, capabilities, jobs, and cost persistence.
BEGIN;

CREATE TABLE public.image_extraction_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closing','closed','expired')),
  selected_language text NOT NULL CHECK (char_length(selected_language) BETWEEN 2 AND 35),
  selected_script text,
  default_condition text NOT NULL,
  default_location text NOT NULL,
  default_quantity integer NOT NULL DEFAULT 1 CHECK (default_quantity BETWEEN 1 AND 1000),
  default_publication text NOT NULL DEFAULT 'private' CHECK (default_publication IN ('private','publish')),
  input_count integer NOT NULL DEFAULT 0 CHECK (input_count>=0),
  candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count>=0),
  committed_count integer NOT NULL DEFAULT 0 CHECK (committed_count>=0),
  quota_policy_version integer NOT NULL DEFAULT 1,
  orchestration_version text NOT NULL DEFAULT 'phase9-v1',
  prompt_version text,
  model_version text,
  provider_policy_version integer NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  closed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT transaction_timestamp()+interval '30 days',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE UNIQUE INDEX image_extraction_sessions_one_active_initiator
  ON public.image_extraction_sessions(store_id,created_by) WHERE status IN ('active','closing');
CREATE INDEX image_extraction_sessions_recovery_idx
  ON public.image_extraction_sessions(store_id,created_by,status,updated_at DESC);

CREATE TABLE public.image_extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  job_kind text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN
    ('open','in_progress','retry_scheduled','resolved','resolved_noop','cancelled','dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  lease_owner text,
  lease_expires_at timestamptz,
  dedupe_key text NOT NULL UNIQUE,
  adapter_key text,
  adapter_version text,
  operation_version text,
  last_safe_error_code text,
  last_safe_error_category text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  completed_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE INDEX image_extraction_jobs_claim_idx
  ON public.image_extraction_jobs(status,next_attempt_at,lease_expires_at)
  WHERE status IN ('open','retry_scheduled','in_progress');

CREATE TABLE public.phase9_upload_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  issued_to_user_id uuid NOT NULL,
  initiating_owner_user_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('scan_input','customer_request','public_copy')),
  bound_entity_type text NOT NULL,
  bound_entity_id uuid NOT NULL,
  bound_session_id uuid REFERENCES public.image_extraction_sessions(id),
  bound_ordinal smallint NOT NULL CHECK (bound_ordinal BETWEEN 1 AND 15),
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  envelope_sha256 text NOT NULL,
  nonce_hash text NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','consumed','revoked','failed','expired')),
  issued_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  consumed_media_asset_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(bucket_id,object_path),
  UNIQUE(store_id,nonce_hash),
  CONSTRAINT phase9_upload_capability_state_coherence CHECK (
    (status='issued' AND consumed_at IS NULL AND revoked_at IS NULL AND failed_at IS NULL)
    OR (status='consumed' AND consumed_at IS NOT NULL)
    OR (status='revoked' AND revoked_at IS NOT NULL)
    OR (status='failed' AND failed_at IS NOT NULL)
    OR status='expired'
  )
);
CREATE INDEX phase9_upload_capability_expiry_idx
  ON public.phase9_upload_capabilities(status,expires_at) WHERE status='issued';

CREATE TABLE public.image_extraction_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  media_asset_id uuid,
  source_kind text NOT NULL CHECK (source_kind IN ('camera','gallery')),
  state text NOT NULL DEFAULT 'uploaded' CHECK (state IN
    ('uploaded','validating','queued','processing','ready','failed','skipped')),
  sha256 text NOT NULL,
  quality_result text,
  quality_reason text,
  detected_candidate_count integer CHECK (detected_candidate_count BETWEEN 0 AND 15),
  adapter_version text,
  orchestration_version text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  processed_at timestamptz,
  delete_after timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(store_id,sha256,orchestration_version)
);
CREATE INDEX image_extraction_inputs_session_state_idx
  ON public.image_extraction_inputs(session_id,state,created_at);

CREATE TABLE public.image_extraction_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
  input_id uuid REFERENCES public.image_extraction_inputs(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  candidate_index smallint NOT NULL CHECK (candidate_index BETWEEN 1 AND 15),
  geometry jsonb,
  observed_title text NOT NULL,
  observed_authors text[] NOT NULL DEFAULT '{}',
  observed_isbn_clue text,
  observed_language text NOT NULL,
  observed_script text,
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  selected_snapshot jsonb NOT NULL DEFAULT '{}',
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  metadata_attempt_id uuid,
  owner_review_snapshot jsonb,
  review_disposition text CHECK (review_disposition IS NULL OR review_disposition IN
    ('reviewed','skipped_false_detection')),
  duplicate_action text,
  publication_decision text,
  state text NOT NULL DEFAULT 'processing' CHECK (state IN
    ('processing','ready','needs_review','possible_duplicate','failed','commit_in_progress','committed')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  committed_inventory_id uuid REFERENCES public.store_inventory(id),
  committed_listing_id uuid REFERENCES public.marketplace_book_listings(id),
  commit_idempotency_key text,
  commit_outcome text,
  expires_at timestamptz NOT NULL DEFAULT transaction_timestamp()+interval '30 days',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(input_id,candidate_index),
  UNIQUE(committed_inventory_id)
);
CREATE INDEX image_extraction_candidates_session_state_idx
  ON public.image_extraction_candidates(session_id,state,candidate_index);

CREATE TABLE public.metadata_enrichment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  adapter_key text NOT NULL REFERENCES public.phase9_provider_registry(adapter_key),
  attempt_sequence smallint NOT NULL CHECK (attempt_sequence BETWEEN 1 AND 10),
  query_kind text NOT NULL,
  normalized_request_clues jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL,
  provider_record_id text,
  match_strength numeric CHECK (match_strength IS NULL OR match_strength BETWEEN 0 AND 1),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms>=0),
  cache_status text,
  adapter_version text NOT NULL,
  schema_version text NOT NULL,
  normalizer_version text NOT NULL,
  reuse_policy_version integer NOT NULL,
  raw_payload jsonb,
  normalized_payload jsonb,
  delete_after timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(candidate_id,adapter_key,attempt_sequence)
);
ALTER TABLE public.image_extraction_candidates ADD CONSTRAINT candidate_metadata_attempt_fk
  FOREIGN KEY(metadata_attempt_id) REFERENCES public.metadata_enrichment_attempts(id);
ALTER TABLE public.store_inventory ADD CONSTRAINT store_inventory_created_from_candidate_fk
  FOREIGN KEY(created_from_candidate_id) REFERENCES public.image_extraction_candidates(id);

CREATE TABLE public.phase9_usage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  cost_kind text NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version>0),
  operation text NOT NULL,
  adapter_key text,
  adapter_version text,
  idempotency_identity text NOT NULL,
  reserved_cost_units numeric NOT NULL CHECK (reserved_cost_units>=0),
  actual_cost_units numeric CHECK (actual_cost_units IS NULL OR actual_cost_units>=0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT phase9_usage_reservation_unique UNIQUE(store_id,job_id,cost_kind,policy_version)
);
CREATE INDEX phase9_usage_reservations_status_idx
  ON public.phase9_usage_reservations(store_id,status,created_at);

CREATE TABLE public.phase9_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_or_service text NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  request_fingerprint text NOT NULL,
  target_ids jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','failed_terminal')),
  canonical_response jsonb,
  error_code text,
  surviving_effect text NOT NULL DEFAULT 'none',
  expires_at timestamptz NOT NULL DEFAULT transaction_timestamp()+interval '30 days',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(actor_or_service,operation,idempotency_key)
);

GRANT USAGE ON SCHEMA marketplace_sec TO service_role;

CREATE FUNCTION marketplace_sec.claim_phase9_jobs(
  p_batch_size integer DEFAULT 50,p_worker text DEFAULT NULL,p_include_not_due boolean DEFAULT false
) RETURNS SETOF public.image_extraction_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF p_batch_size<1 OR p_batch_size>100 OR coalesce(char_length(p_worker),0)<1 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  RETURN QUERY WITH claimed AS (
    SELECT j.id FROM public.image_extraction_jobs j
    WHERE j.status IN ('open','retry_scheduled','in_progress')
      AND (p_include_not_due OR j.next_attempt_at<=transaction_timestamp())
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts
    ORDER BY j.next_attempt_at,j.id FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ) UPDATE public.image_extraction_jobs j SET status='in_progress',lease_owner=p_worker,
      lease_expires_at=transaction_timestamp()+interval '5 minutes',attempt_count=j.attempt_count+1,
      updated_at=transaction_timestamp()
    FROM claimed WHERE j.id=claimed.id RETURNING j.*;
END$$;
CREATE FUNCTION marketplace_sec.fail_phase9_job(
  p_job_id uuid,p_worker text,p_category text,p_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.lease_expires_at<=transaction_timestamp() THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_status:=CASE WHEN v_job.attempt_count>=v_job.max_attempts THEN 'dead_letter' ELSE 'retry_scheduled' END;
  UPDATE public.image_extraction_jobs SET status=v_status,lease_owner=NULL,lease_expires_at=NULL,
    next_attempt_at=transaction_timestamp()+CASE attempt_count WHEN 1 THEN interval '30 seconds'
      WHEN 2 THEN interval '2 minutes' WHEN 3 THEN interval '10 minutes'
      WHEN 4 THEN interval '30 minutes' ELSE interval '2 hours' END,
    last_safe_error_category=p_category,last_safe_error_code=p_code,
    dead_lettered_at=CASE WHEN v_status='dead_letter' THEN transaction_timestamp() END,
    updated_at=transaction_timestamp() WHERE id=p_job_id;
  RETURN v_status;
END$$;

CREATE FUNCTION marketplace_sec.expire_phase9_upload_capabilities()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  UPDATE public.phase9_upload_capabilities SET status='expired',updated_at=transaction_timestamp()
    WHERE status='issued' AND expires_at<=transaction_timestamp();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END$$;

DO $$DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY[
 'image_extraction_sessions','image_extraction_jobs','phase9_upload_capabilities',
 'image_extraction_inputs','image_extraction_candidates','metadata_enrichment_attempts',
 'phase9_usage_reservations','phase9_idempotency_keys'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
END LOOP; END$$;
REVOKE ALL ON FUNCTION marketplace_sec.claim_phase9_jobs(integer,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.fail_phase9_job(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.expire_phase9_upload_capabilities() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase9_jobs(integer,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.fail_phase9_job(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.expire_phase9_upload_capabilities() TO service_role;

COMMIT;
