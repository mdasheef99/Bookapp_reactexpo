BEGIN;

-- 02d Unit 1b: explicit search refreshes saved choices (02d SDD sections 4, 7, 8).
CREATE OR REPLACE FUNCTION public.phase9_request_candidate_edition_options_v1(p_session_id uuid,p_candidate_id uuid,
 p_expected_request_generation integer,p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 fingerprint text; replay jsonb; response jsonb; q text; pending boolean; job uuid;
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
 -- looks exhausted, then re-check under the nonblocking lock.
 IF s.request_id IS NOT NULL THEN
  SELECT * INTO current_job FROM public.image_extraction_jobs WHERE id=s.request_id
   AND store_id=c.store_id AND entity_type='candidate' AND entity_id=c.id;
  IF current_job.id IS NOT NULL AND marketplace_sec.phase9_edition_job_exhausted(current_job) THEN
   BEGIN
    SELECT * INTO current_job FROM public.image_extraction_jobs WHERE id=current_job.id FOR UPDATE NOWAIT;
   EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'P9_STATE_CONFLICT';
   END;
  END IF;
  IF current_job.id IS NOT NULL AND marketplace_sec.phase9_edition_job_exhausted(current_job) THEN
   UPDATE public.image_extraction_jobs SET status='dead_letter',lease_owner=NULL,lease_token_hash=NULL,
    lease_expires_at=NULL,last_safe_error_code='P9_METADATA_ATTEMPTS_EXHAUSTED',last_safe_error_category='metadata',
    completed_at=transaction_timestamp(),dead_lettered_at=transaction_timestamp(),updated_at=transaction_timestamp()
    WHERE id=current_job.id;
  END IF;
 END IF;
 pending:=EXISTS(SELECT 1 FROM public.image_extraction_jobs j WHERE j.id=s.request_id
  AND j.status IN('open','in_progress','retry_scheduled'));
 IF NOT pending THEN
  job:=gen_random_uuid();
  INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
  VALUES(job,c.store_id,'candidate',c.id,'metadata_enrich','edition-options:'||job::text,'p9-owner-edition-options-v1');
  UPDATE public.phase9_candidate_edition_state SET request_id=job,options_version=options_version+1,options='[]',source_lookup_id=NULL,
   source_attempt_id=NULL,source_fetched_at=NULL,options_expires_at=NULL,updated_at=transaction_timestamp()
   WHERE candidate_id=c.id;
 END IF;
 response:=marketplace_sec.phase9_edition_lookup_receipt(c);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_LOOKUP_V1',p_idempotency_key,response,'edition_lookup_only');
 RETURN response;
END$$;

COMMIT;
