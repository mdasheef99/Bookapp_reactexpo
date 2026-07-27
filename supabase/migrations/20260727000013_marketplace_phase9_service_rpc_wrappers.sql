-- Phase 9 M13: minimum public PostgREST boundary for service-only M11/M12 RPCs.
-- SECURITY INVOKER is sufficient because service_role already has USAGE on
-- marketplace_sec and exact EXECUTE grants on every delegated function.
BEGIN;

CREATE FUNCTION public.phase9_issue_scan_upload(
  p_actor uuid,p_session_id uuid,p_source_kind text,p_declared_mime text,
  p_declared_bytes bigint,p_ordinal integer,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_issue_scan_upload(
    p_actor,p_session_id,p_source_kind,p_declared_mime,p_declared_bytes,p_ordinal,
    p_idempotency_key,p_command_id
  )
$wrapper$;
ALTER FUNCTION public.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid)
  TO service_role;

CREATE FUNCTION public.phase9_scan_upload_context(
  p_actor uuid,p_capability_id uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_scan_upload_context(p_actor,p_capability_id)
$wrapper$;
ALTER FUNCTION public.phase9_scan_upload_context(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_scan_upload_context(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_scan_upload_context(uuid,uuid) TO service_role;

CREATE FUNCTION public.phase9_register_scan_upload_completion(
  p_actor uuid,p_capability_id uuid,p_source_kind text,p_bucket text,p_path text,
  p_object_identity text,p_source_sha256 text,p_observed_mime text,
  p_observed_bytes bigint,p_orchestration_version text,p_idempotency_key text,
  p_command_id uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_register_scan_upload_completion(
    p_actor,p_capability_id,p_source_kind,p_bucket,p_path,p_object_identity,
    p_source_sha256,p_observed_mime,p_observed_bytes,p_orchestration_version,
    p_idempotency_key,p_command_id
  )
$wrapper$;
ALTER FUNCTION public.phase9_register_scan_upload_completion(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_register_scan_upload_completion(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_register_scan_upload_completion(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid
) TO service_role;

CREATE FUNCTION public.claim_phase9_media_validation_jobs(
  p_batch_size integer,p_worker text
) RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.claim_phase9_media_validation_jobs(p_batch_size,p_worker)
$wrapper$;
ALTER FUNCTION public.claim_phase9_media_validation_jobs(integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_phase9_media_validation_jobs(integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_phase9_media_validation_jobs(integer,text)
  TO service_role;

CREATE FUNCTION public.phase9_media_validation_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_media_validation_context(
    p_job_id,p_worker,p_lease_token,p_attempt_count
  )
$wrapper$;
ALTER FUNCTION public.phase9_media_validation_context(uuid,text,text,integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_media_validation_context(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_media_validation_context(uuid,text,text,integer)
  TO service_role;

CREATE FUNCTION public.phase9_revalidate_media_validation_lease(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_source_identity text,p_source_sha256 text
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_revalidate_media_validation_lease(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256
  )
$wrapper$;
ALTER FUNCTION public.phase9_revalidate_media_validation_lease(uuid,text,text,integer,text,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_revalidate_media_validation_lease(uuid,text,text,integer,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_revalidate_media_validation_lease(uuid,text,text,integer,text,text)
  TO service_role;

CREATE FUNCTION public.phase9_bind_media_validation_snapshot(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_snapshot_path text,p_snapshot_sha256 text,p_snapshot_bytes bigint,
  p_snapshot_mime text
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_bind_media_validation_snapshot(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_snapshot_path,
    p_snapshot_sha256,p_snapshot_bytes,p_snapshot_mime
  )
$wrapper$;
ALTER FUNCTION public.phase9_bind_media_validation_snapshot(
  uuid,text,text,integer,text,text,bigint,text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_bind_media_validation_snapshot(
  uuid,text,text,integer,text,text,bigint,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_bind_media_validation_snapshot(
  uuid,text,text,integer,text,text,bigint,text
) TO service_role;

CREATE FUNCTION public.phase9_complete_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_source_identity text,p_source_sha256 text,p_snapshot_path text,
  p_target_path text,p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_complete_media_validation(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,
    p_source_sha256,p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height
  )
$wrapper$;
ALTER FUNCTION public.phase9_complete_media_validation(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_complete_media_validation(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_complete_media_validation(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) TO service_role;

CREATE FUNCTION public.phase9_fail_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_retryable boolean,p_safe_error_code text
) RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_fail_media_validation(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_retryable,p_safe_error_code
  )
$wrapper$;
ALTER FUNCTION public.phase9_fail_media_validation(uuid,text,text,integer,boolean,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_fail_media_validation(uuid,text,text,integer,boolean,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_fail_media_validation(uuid,text,text,integer,boolean,text)
  TO service_role;

CREATE FUNCTION public.claim_phase9_vision_jobs(
  p_batch_size integer,p_worker text
) RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(p_batch_size,p_worker)
$wrapper$;
ALTER FUNCTION public.claim_phase9_vision_jobs(integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_phase9_vision_jobs(integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_phase9_vision_jobs(integer,text)
  TO service_role;

CREATE FUNCTION public.phase9_vision_job_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_vision_job_context(
    p_job_id,p_worker,p_lease_token,p_attempt_count
  )
$wrapper$;
ALTER FUNCTION public.phase9_vision_job_context(uuid,text,text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_vision_job_context(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_vision_job_context(uuid,text,text,integer)
  TO service_role;

CREATE FUNCTION public.phase9_persist_vision_analysis(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_result jsonb
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_persist_vision_analysis(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_result
  )
$wrapper$;
ALTER FUNCTION public.phase9_persist_vision_analysis(uuid,text,text,integer,jsonb)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_persist_vision_analysis(uuid,text,text,integer,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_persist_vision_analysis(uuid,text,text,integer,jsonb)
  TO service_role;

CREATE FUNCTION public.phase9_fail_vision_job(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_safe_error_code text
) RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $wrapper$
  SELECT * FROM marketplace_sec.phase9_fail_vision_job(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_safe_error_code
  )
$wrapper$;
ALTER FUNCTION public.phase9_fail_vision_job(uuid,text,text,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_fail_vision_job(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_fail_vision_job(uuid,text,text,integer,text)
  TO service_role;

COMMIT;
