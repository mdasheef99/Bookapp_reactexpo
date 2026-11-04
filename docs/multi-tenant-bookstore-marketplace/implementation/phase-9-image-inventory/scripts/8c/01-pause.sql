-- 02c §7 / 02c-1 §2. OPERATOR TEMPLATE ONLY; never run by a migration.
-- Use a separately authorized postgres operator connection. Any error rolls back this entire script.
-- Review the immutable 8b artifact, complete manifests, baseline disposition and single-worker evidence first.

BEGIN;
DO $operator$
DECLARE g marketplace_sec.phase9_external_admission_gate; obligations jsonb; before_rows jsonb; after_rows jsonb;
 policy jsonb; settings jsonb; cohort uuid[]; deadline timestamptz; item text;
BEGIN
 SELECT * INTO g FROM marketplace_sec.phase9_external_admission_gate WHERE singleton FOR UPDATE;
 IF g.singleton IS DISTINCT FROM true THEN RAISE EXCEPTION 'P9_8C_GATE_MISSING: singleton=true'; END IF;
 SELECT jsonb_agg(to_jsonb(r) ORDER BY adapter_key) INTO before_rows FROM public.phase9_provider_registry r
  WHERE adapter_key IN('google_books','open_library');
 RAISE NOTICE '8c before gate=% registry=%',to_jsonb(g),before_rows;
 UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=epoch+1,
 smoke_job_ids=ARRAY[]::uuid[],expires_at=NULL WHERE singleton;
 SELECT jsonb_agg(to_jsonb(r) ORDER BY adapter_key) INTO after_rows FROM public.phase9_provider_registry r
  WHERE adapter_key IN('google_books','open_library');
 SELECT * INTO g FROM marketplace_sec.phase9_external_admission_gate WHERE singleton;
 RAISE NOTICE '8c after gate=% registry=%',to_jsonb(g),after_rows;
END
$operator$;
COMMIT;
