-- M75: exhausted edition-search recovery. Owner authorized 2026-10-17 ("mark failed, allow retry").
-- Pipeline §10; picker SDD §§4.3/5/9 and the 2026-10-17 amendment; Master MAS-17; tracker 37 §§24/67.
-- Forward-only: M65-M74 and M76 stay unchanged. Filename keeps the reserved M75 number but is dated
-- after M76 so file order matches application order (proposed 20261013 name superseded).
-- An edition-options job whose attempts are spent and that no worker can claim (attempt_count >=
-- max_attempts and no live lease) reads as failed instead of pending forever. Only the initiating
-- Owner's explicit Search Books command closes it (dead_letter) and starts at most one fresh request
-- through the existing ownership, generation, query and idempotency checks. Reads stay read-only.
-- Selections, selling details, lookups, attempts, provider calls and usage records are preserved;
-- attempt counts are never reset, stale lease tokens stay invalid, and no HTTP is sent from SQL.
-- Rollback: forward-restore the M73/M66 bodies; closed jobs remain closed (no destructive rollback).
BEGIN;

CREATE FUNCTION marketplace_sec.phase9_edition_job_exhausted(p_job public.image_extraction_jobs)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(p_job.operation_version='p9-owner-edition-options-v1'
  AND p_job.status IN('open','in_progress','retry_scheduled')
  AND p_job.attempt_count>=p_job.max_attempts
  AND (p_job.status<>'in_progress' OR p_job.lease_expires_at IS NULL
   OR p_job.lease_expires_at<=transaction_timestamp()),false)
$$;

-- Same body as M73 except that an exhausted request reads as failed.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_legacy_choices(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; rows jsonb:='[]'; selection jsonb; m jsonb; status text:='idle';
 fresh boolean:=false; query_ok boolean;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id
  AND store_id=p_candidate.store_id AND session_id=p_candidate.session_id;
 query_ok:=s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate);
 fresh:=coalesce(query_ok AND s.options_expires_at>transaction_timestamp() AND marketplace_sec.phase9_edition_source_policy(s),false);
 IF fresh THEN SELECT coalesce(jsonb_agg(jsonb_set(r,'{metadata}',CASE WHEN r->'metadata'='null'
  THEN 'null'::jsonb ELSE marketplace_sec.phase9_edition_snapshot(r->'metadata') END) ORDER BY ordinal),'[]')
  INTO rows FROM jsonb_array_elements(s.options) WITH ORDINALITY x(r,ordinal); END IF;
 IF query_ok AND s.selection_id IS NOT NULL THEN
  selection:=jsonb_build_object('selectionId',s.selection_id,'source',s.selected_source,'optionId',
   CASE WHEN s.selected_source='edition_option' THEN s.selected_source_id ELSE NULL END,
   'snapshot',marketplace_sec.phase9_edition_snapshot(s.selected_option_snapshot));
 ELSE
  m:=marketplace_sec.phase9_edition_current_snapshot(p_candidate);
  IF m IS NOT NULL THEN selection:=jsonb_build_object('selectionId',p_candidate.selected_metadata_snapshot_id,
   'source','current_suggestion','optionId',NULL,'snapshot',m); END IF;
 END IF;
 IF s.request_id IS NOT NULL AND query_ok THEN
  SELECT CASE WHEN marketplace_sec.phase9_edition_job_exhausted(j) THEN 'failed'
   WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
   WHEN j.status IN('resolved','resolved_noop') AND fresh THEN 'ready' ELSE 'failed' END INTO status
   FROM public.image_extraction_jobs j WHERE id=s.request_id;
 END IF;
 RETURN jsonb_build_object('sessionId',p_candidate.session_id,'candidateId',p_candidate.id,
  'requestGeneration',coalesce(s.request_generation,0),'optionsVersion',coalesce(s.options_version,0),
  'optionsExpiresAt',CASE WHEN fresh THEN s.options_expires_at ELSE NULL END,'rows',rows,'selection',selection,
  'lookupStatus',coalesce(status,'idle'),'candidateVersion',p_candidate.version,
  'metadataRevision',p_candidate.metadata_revision,'reviewVersion',p_candidate.review_version);
END$$;

-- Same body as M73 except that an exhausted request reads as failed.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_lookup_receipt(p_candidate public.image_extraction_candidates,p_prior jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; operation uuid; status text; available boolean; same boolean;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id;
 operation:=coalesce((p_prior->>'operationId')::uuid,s.request_id);
 same:=coalesce(operation=s.request_id,false);
 SELECT CASE WHEN marketplace_sec.phase9_edition_job_exhausted(j) THEN 'failed'
  WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
  WHEN j.status IN('resolved','resolved_noop') THEN 'ready' ELSE 'failed' END INTO status
 FROM public.image_extraction_jobs j WHERE id=operation AND store_id=p_candidate.store_id AND entity_id=p_candidate.id;
 available:=coalesce(same AND s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate)
  AND s.options_expires_at>transaction_timestamp() AND status='ready' AND marketplace_sec.phase9_edition_source_policy(s),false);
 RETURN jsonb_build_object('operationId',operation,'status',coalesce(status,'failed'),
  'requestGeneration',CASE WHEN same THEN s.request_generation ELSE coalesce((p_prior->>'requestGeneration')::integer,0) END,
  'optionsVersion',CASE WHEN same THEN s.options_version ELSE coalesce((p_prior->>'optionsVersion')::integer,0) END,
  'available',available);
END$$;

-- Same body as the live M66 command except that the Owner's explicit search first closes an
-- exhausted current request; a live or reclaimable request still counts as pending.
CREATE OR REPLACE FUNCTION public.phase9_request_candidate_edition_options_v1(p_session_id uuid,p_candidate_id uuid,
 p_expected_request_generation integer,p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 fingerprint text; replay jsonb; response jsonb; q text; pending boolean; fresh boolean; job uuid;
 current_job public.image_extraction_jobs;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id,p_candidate_id);
 IF NOT coalesce(p_expected_request_generation>=0 AND p_idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'
  AND p_command_id IS NOT NULL,false) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 fingerprint:=encode(extensions.digest(jsonb_build_array(p_session_id,p_candidate_id,
  p_expected_request_generation,p_command_id)::text,'sha256'),'hex');
 replay:=marketplace_sec.phase9_replay(auth.uid()::text,'EP_LOOKUP_V1',p_idempotency_key,fingerprint);
 IF replay IS NOT NULL THEN RETURN marketplace_sec.phase9_edition_lookup_receipt(c,replay); END IF;
 q:=marketplace_sec.phase9_edition_query_identity(c);
 IF char_length(q) NOT BETWEEN 1 AND 2048 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity)
 VALUES(c.id,c.session_id,c.store_id,q) ON CONFLICT(candidate_id) DO NOTHING;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF s.request_generation<>p_expected_request_generation OR s.query_identity<>q THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
 -- Workers lock the job before the state row. Peek without a lock and lock the job only when it
 -- looks exhausted (unclaimable, so no worker holds it), then re-check under the lock.
 IF s.request_id IS NOT NULL THEN
  SELECT * INTO current_job FROM public.image_extraction_jobs WHERE id=s.request_id
   AND store_id=c.store_id AND entity_type='candidate' AND entity_id=c.id;
  IF current_job.id IS NOT NULL AND marketplace_sec.phase9_edition_job_exhausted(current_job) THEN
   SELECT * INTO current_job FROM public.image_extraction_jobs WHERE id=current_job.id FOR UPDATE;
  END IF;
  -- A closed job with still-fresh options starts nothing new, as for any other failed request.
  IF current_job.id IS NOT NULL AND marketplace_sec.phase9_edition_job_exhausted(current_job) THEN
   UPDATE public.image_extraction_jobs SET status='dead_letter',lease_owner=NULL,lease_token_hash=NULL,
    lease_expires_at=NULL,last_safe_error_code='P9_METADATA_ATTEMPTS_EXHAUSTED',last_safe_error_category='metadata',
    completed_at=transaction_timestamp(),dead_lettered_at=transaction_timestamp(),updated_at=transaction_timestamp()
    WHERE id=current_job.id;
  END IF;
 END IF;
 pending:=EXISTS(SELECT 1 FROM public.image_extraction_jobs j WHERE j.id=s.request_id
  AND j.status IN('open','in_progress','retry_scheduled'));
 fresh:=coalesce(s.options_expires_at>transaction_timestamp(),false);
 IF NOT pending AND NOT fresh THEN
  job:=gen_random_uuid();
  INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
  VALUES(job,c.store_id,'candidate',c.id,'metadata_enrich','edition-options:'||job::text,'p9-owner-edition-options-v1');
  UPDATE public.phase9_candidate_edition_state SET request_id=job,options='[]',source_lookup_id=NULL,
   source_attempt_id=NULL,source_fetched_at=NULL,options_expires_at=NULL,updated_at=transaction_timestamp()
   WHERE candidate_id=c.id;
 END IF;
 response:=marketplace_sec.phase9_edition_lookup_receipt(c);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_LOOKUP_V1',p_idempotency_key,response,'edition_lookup_only');
 RETURN response;
END$$;

-- The new private helper is postgres-only, matching the existing private edition helpers.
ALTER FUNCTION marketplace_sec.phase9_edition_job_exhausted(public.image_extraction_jobs) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_job_exhausted(public.image_extraction_jobs)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
