-- M59. Approved Unit 6G correction §4.2; Security §12 MED-19; Pipeline §10.
-- Permanent fences plus scheduled tombstone rechecks provide eventual convergence
-- after the last late upload. Finite grace cannot prove that no late writer exists.
BEGIN;
CREATE FUNCTION public.claim_phase9_media_output_cleanup_jobs(p_batch_size integer,p_worker text)
RETURNS TABLE(intent_id uuid,bucket_id text,object_path text,lease_token text,attempt_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r marketplace_sec.phase9_media_output_intents; token text; n integer:=0; protected boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
 OR p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 -- Every authority path takes job then intent locks. Never wait on another worker.
 FOR j IN SELECT jobs.* FROM public.image_extraction_jobs jobs WHERE EXISTS(
  SELECT 1 FROM marketplace_sec.phase9_media_output_intents x WHERE x.job_id=jobs.id AND x.state<>'accepted'
   AND x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
   AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())
   AND (x.state='delete_reserved' OR jobs.status<>'in_progress' OR jobs.attempt_count<>x.attempt_count
     OR jobs.lease_token_hash IS DISTINCT FROM x.claim_hash OR jobs.lease_expires_at<=transaction_timestamp()))
  ORDER BY jobs.id FOR UPDATE SKIP LOCKED
 LOOP
  FOR r IN SELECT x.* FROM marketplace_sec.phase9_media_output_intents x WHERE x.job_id=j.id AND x.state<>'accepted'
   AND x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
   AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())
   AND (x.state='delete_reserved' OR j.status<>'in_progress' OR j.attempt_count<>x.attempt_count
     OR j.lease_token_hash IS DISTINCT FROM x.claim_hash OR j.lease_expires_at<=transaction_timestamp())
   ORDER BY x.id FOR UPDATE SKIP LOCKED
  LOOP
   -- Any registered row or bound snapshot is protective, regardless of lifecycle.
   SELECT EXISTS(SELECT 1 FROM public.media_assets m WHERE m.bucket_id=r.bucket_id AND m.object_path=r.object_path)
    OR EXISTS(SELECT 1 FROM public.image_extraction_inputs i WHERE i.source_snapshot_bucket=r.bucket_id AND i.source_snapshot_path=r.object_path)
    OR (r.bucket_id='image-extraction-inputs' AND EXISTS(SELECT 1 FROM public.phase9_upload_capabilities c WHERE c.completion_canonical_response->>'snapshot_path'=r.object_path)) INTO protected;
   IF protected THEN
    UPDATE marketplace_sec.phase9_media_output_intents SET state=CASE WHEN state='delete_reserved' THEN state ELSE 'accepted' END,
     cleanup_status=CASE WHEN state='delete_reserved' THEN 'manual_reconciliation' ELSE cleanup_status END,updated_at=transaction_timestamp() WHERE id=r.id;
    CONTINUE;
   END IF;
   IF r.cleanup_status='leased' THEN r.cleanup_failures:=r.cleanup_failures+1; END IF;
   IF r.cleanup_failures>=5 THEN
    UPDATE marketplace_sec.phase9_media_output_intents SET cleanup_status='manual_reconciliation',cleanup_failures=r.cleanup_failures,
     last_cleanup_outcome='acknowledgment_unknown',updated_at=transaction_timestamp() WHERE id=r.id;
    CONTINUE;
   END IF;
   token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   UPDATE marketplace_sec.phase9_media_output_intents SET state='delete_reserved',cleanup_status='leased',
    cleanup_attempt_count=cleanup_attempt_count+1,cleanup_failures=r.cleanup_failures,cleanup_worker=p_worker,
    cleanup_token_hash=encode(extensions.digest(token,'sha256'),'hex'),cleanup_expires_at=transaction_timestamp()+interval '2 minutes',
    updated_at=transaction_timestamp() WHERE id=r.id RETURNING cleanup_attempt_count INTO attempt_count;
   intent_id:=r.id; bucket_id:=r.bucket_id; object_path:=r.object_path; lease_token:=token; RETURN NEXT;
   n:=n+1; IF n>=p_batch_size THEN RETURN; END IF;
  END LOOP;
 END LOOP;
END$$;
CREATE FUNCTION public.phase9_finish_media_output_cleanup(p_intent_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_outcome text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r marketplace_sec.phase9_media_output_intents; job uuid; failures integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
 OR p_lease_token IS NULL OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_outcome IS NULL
 OR p_outcome NOT IN ('deleted','missing','retryable_error') THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT job_id INTO job FROM marketplace_sec.phase9_media_output_intents WHERE id=p_intent_id;
 PERFORM 1 FROM public.image_extraction_jobs WHERE id=job FOR UPDATE;
 SELECT * INTO r FROM marketplace_sec.phase9_media_output_intents WHERE id=p_intent_id FOR UPDATE;
 IF r.id IS NULL OR r.state<>'delete_reserved' OR r.cleanup_worker IS DISTINCT FROM p_worker
 OR r.cleanup_token_hash IS DISTINCT FROM encode(extensions.digest(p_lease_token,'sha256'),'hex')
 OR r.cleanup_attempt_count IS DISTINCT FROM p_attempt_count THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF r.cleanup_status<>'leased' THEN
  IF r.last_cleanup_outcome IS DISTINCT FROM p_outcome THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN r.cleanup_status;
 END IF;
 IF r.cleanup_expires_at IS NULL OR r.cleanup_expires_at<=transaction_timestamp() THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 failures:=CASE WHEN p_outcome='retryable_error' THEN r.cleanup_failures+1 ELSE 0 END;
 UPDATE marketplace_sec.phase9_media_output_intents SET cleanup_failures=failures,
  cleanup_status=CASE WHEN failures>=5 THEN 'manual_reconciliation' ELSE 'recheck' END,
  next_cleanup_at=transaction_timestamp()+CASE WHEN p_outcome='retryable_error' THEN interval '2 minutes'*power(2,failures-1) ELSE interval '1 day' END,
  last_cleanup_outcome=p_outcome,cleanup_expires_at=NULL,updated_at=transaction_timestamp() WHERE id=r.id;
 RETURN CASE WHEN failures>=5 THEN 'manual_reconciliation' ELSE 'recheck' END;
END$$;
REVOKE ALL ON FUNCTION public.claim_phase9_media_output_cleanup_jobs(integer,text),public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_phase9_media_output_cleanup_jobs(integer,text),public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.has_claimable_phase9_work(p_job_kind text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_job_kind NOT IN ('media_validate_sanitize','vision_extract','metadata_enrich','publication_retry') THEN RAISE EXCEPTION 'P9_DISPATCH_KIND_INVALID'; END IF;
 RETURN EXISTS(SELECT 1 FROM public.image_extraction_jobs j WHERE j.job_kind=p_job_kind AND j.status IN ('open','retry_scheduled','in_progress')
  AND j.next_attempt_at<=transaction_timestamp() AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp()) AND j.attempt_count<j.max_attempts)
 OR (p_job_kind='media_validate_sanitize' AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_media_output_intents x JOIN public.image_extraction_jobs j ON j.id=x.job_id
  WHERE x.state<>'accepted' AND x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
  AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())
  AND (x.state='delete_reserved' OR j.status<>'in_progress' OR j.attempt_count<>x.attempt_count
    OR j.lease_token_hash IS DISTINCT FROM x.claim_hash OR j.lease_expires_at<=transaction_timestamp())));
END$$;
CREATE FUNCTION public.phase9_media_output_cleanup_health() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT jsonb_build_object('manual_reconciliation',count(*) FILTER(WHERE x.cleanup_status='manual_reconciliation'),
  'due_count',count(*) FILTER(WHERE x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
    AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())),
  'oldest_due_seconds',coalesce(max(greatest(0,extract(epoch FROM transaction_timestamp()-x.next_cleanup_at)))
    FILTER(WHERE x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()),0)) INTO result
 FROM marketplace_sec.phase9_media_output_intents x JOIN public.image_extraction_jobs j ON j.id=x.job_id
 WHERE x.state<>'accepted' AND (x.state='delete_reserved' OR j.status<>'in_progress' OR j.attempt_count<>x.attempt_count
   OR j.lease_token_hash IS DISTINCT FROM x.claim_hash OR j.lease_expires_at<=transaction_timestamp());
 RETURN result;
END$$;
REVOKE ALL ON FUNCTION public.phase9_media_output_cleanup_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_media_output_cleanup_health() TO service_role;

ALTER FUNCTION public.claim_phase9_media_output_cleanup_jobs(integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.has_claimable_phase9_work(text) OWNER TO postgres;
ALTER FUNCTION public.phase9_media_output_cleanup_health() OWNER TO postgres;
COMMIT;
