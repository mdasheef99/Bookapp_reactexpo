-- M57. Approved Unit 6G correction §4.2; Master SDD §3 MAS-03/MAS-17; Security §12 MED-19.
BEGIN;
CREATE TABLE marketplace_sec.phase9_media_output_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id),
 job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id), attempt_count integer NOT NULL CHECK(attempt_count>0),
 worker text NOT NULL, claim_hash text NOT NULL, output_kind text NOT NULL CHECK(output_kind IN ('snapshot','sanitized')),
 bucket_id text NOT NULL, object_path text NOT NULL, context jsonb NOT NULL,
 policy_version text NOT NULL DEFAULT 'phase9-media-v1',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','delete_reserved')),
 cleanup_status text NOT NULL DEFAULT 'waiting' CHECK(cleanup_status IN ('waiting','leased','recheck','manual_reconciliation')),
 cleanup_attempt_count integer NOT NULL DEFAULT 0, cleanup_failures integer NOT NULL DEFAULT 0,
 cleanup_worker text, cleanup_token_hash text, cleanup_expires_at timestamptz,
 next_cleanup_at timestamptz NOT NULL DEFAULT transaction_timestamp(), last_cleanup_outcome text,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(), updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(job_id,attempt_count,output_kind)
);
CREATE INDEX phase9_media_output_path ON marketplace_sec.phase9_media_output_intents(bucket_id,object_path);
CREATE INDEX phase9_media_output_cleanup_due ON marketplace_sec.phase9_media_output_intents(next_cleanup_at) WHERE state<>'accepted';
ALTER TABLE marketplace_sec.phase9_media_output_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_sec.phase9_media_output_intents FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_lock_media_claim(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer)
RETURNS public.image_extraction_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
 OR p_lease_token IS NULL OR p_lease_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.job_kind IS DISTINCT FROM 'media_validate_sanitize' OR j.status IS DISTINCT FROM 'in_progress'
 OR j.lease_owner IS DISTINCT FROM p_worker OR j.attempt_count IS DISTINCT FROM p_attempt_count
 OR j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp()
 OR j.lease_token_hash IS DISTINCT FROM encode(extensions.digest(p_lease_token,'sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN j;
END$$;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_lock_media_claim(uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.phase9_prepare_media_validation_outputs(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c jsonb; k text; r marketplace_sec.phase9_media_output_intents;
BEGIN
 j:=marketplace_sec.phase9_lock_media_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 c:=public.phase9_media_validation_context_v2(p_job_id,p_worker,p_lease_token,p_attempt_count);
 IF c->>'source_object_identity' IS NULL OR c->>'source_sha256' IS NULL OR c->>'snapshot_path' IS NULL
 OR c->>'target_path' IS NULL THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
 FOREACH k IN ARRAY ARRAY['snapshot','sanitized'] LOOP
  INSERT INTO marketplace_sec.phase9_media_output_intents(store_id,job_id,attempt_count,worker,claim_hash,output_kind,bucket_id,object_path,context,state)
  VALUES(j.store_id,j.id,j.attempt_count,p_worker,j.lease_token_hash,k,
   c->>(CASE WHEN k='snapshot' THEN 'snapshot_bucket' ELSE 'target_bucket' END),
   c->>(CASE WHEN k='snapshot' THEN 'snapshot_path' ELSE 'target_path' END),c,
   CASE WHEN k='snapshot' AND c->>'source_snapshot_path' IS NOT NULL THEN 'accepted' ELSE 'pending' END)
  ON CONFLICT(job_id,attempt_count,output_kind) DO NOTHING;
  SELECT * INTO r FROM marketplace_sec.phase9_media_output_intents WHERE job_id=j.id AND attempt_count=j.attempt_count AND output_kind=k FOR UPDATE;
  IF r.claim_hash IS DISTINCT FROM j.lease_token_hash OR r.worker IS DISTINCT FROM p_worker OR r.state='delete_reserved'
  OR r.object_path IS DISTINCT FROM c->>(CASE WHEN k='snapshot' THEN 'snapshot_path' ELSE 'target_path' END)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 END LOOP;
 RETURN c||jsonb_build_object('output_intent_version',1);
END$$;
REVOKE ALL ON FUNCTION public.phase9_prepare_media_validation_outputs(uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_prepare_media_validation_outputs(uuid,text,text,integer) TO service_role;

-- A registered asset is always protected, even deleted/held/failed registry rows.
-- Insert/path changes lock the same durable intents used by deletion reservation.
CREATE FUNCTION marketplace_sec.phase9_guard_output_path() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r marketplace_sec.phase9_media_output_intents; b text; p text;
BEGIN
 IF TG_TABLE_NAME='media_assets' THEN b:=NEW.bucket_id; p:=NEW.object_path;
 ELSIF TG_TABLE_NAME='image_extraction_inputs' THEN b:=NEW.source_snapshot_bucket; p:=NEW.source_snapshot_path;
 ELSE b:='image-extraction-inputs'; p:=NEW.completion_canonical_response->>'snapshot_path'; END IF;
 FOR r IN SELECT * FROM marketplace_sec.phase9_media_output_intents WHERE bucket_id=b AND object_path=p ORDER BY id FOR UPDATE LOOP
  IF r.state='delete_reserved' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 END LOOP;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_guard_output_path() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER phase9_media_output_asset_fence BEFORE INSERT OR UPDATE OF bucket_id,object_path ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_guard_output_path();
CREATE TRIGGER phase9_media_output_snapshot_fence BEFORE INSERT OR UPDATE OF source_snapshot_bucket,source_snapshot_path ON public.image_extraction_inputs
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_guard_output_path();
CREATE TRIGGER phase9_media_output_capability_fence BEFORE INSERT OR UPDATE OF completion_canonical_response ON public.phase9_upload_capabilities
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_guard_output_path();
ALTER FUNCTION marketplace_sec.phase9_lock_media_claim(uuid,text,text,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_prepare_media_validation_outputs(uuid,text,text,integer) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_guard_output_path() OWNER TO postgres;
COMMIT;
