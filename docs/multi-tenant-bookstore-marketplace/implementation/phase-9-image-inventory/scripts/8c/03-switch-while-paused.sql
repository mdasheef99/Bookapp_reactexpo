-- 02c §7 / 02c-1 §2. OPERATOR TEMPLATE ONLY; never run by a migration.
-- Use a separately authorized postgres operator connection. Any error rolls back this entire script.
-- Review the immutable 8b artifact, complete manifests, baseline disposition and single-worker evidence first.
-- Reviewed expected hash: encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) ORDER BY adapter_key),'[]')::text,'sha256'),'hex')
-- over the full google_books/open_library rows, using the same connection settings as this script.

BEGIN;
DO $operator$
DECLARE g marketplace_sec.phase9_external_admission_gate; obligations jsonb; captured_obligations jsonb; before_rows jsonb; after_rows jsonb;
 policy jsonb; settings jsonb; cohort uuid[]; deadline timestamptz; item text;
BEGIN
 SELECT * INTO g FROM marketplace_sec.phase9_external_admission_gate WHERE singleton FOR UPDATE;
 IF g.singleton IS DISTINCT FROM true THEN RAISE EXCEPTION 'P9_8C_GATE_MISSING: singleton=true'; END IF;
 SELECT jsonb_agg(to_jsonb(r) ORDER BY adapter_key) INTO before_rows FROM public.phase9_provider_registry r
  WHERE adapter_key IN('google_books','open_library');
 RAISE NOTICE '8c before gate=% registry=%',to_jsonb(g),before_rows;
 IF g.mode<>'paused' THEN RAISE EXCEPTION 'P9_8C_GATE_PRECONDITION: singleton=true mode=%',g.mode; END IF;
 settings:='{"storeWindowSeconds":"__STORE_WINDOW_SECONDS__","storeMaxGets":"__STORE_MAX_GETS__","backoffBaseMs":"__BACKOFF_BASE_MS__","backoffMaxMs":"__BACKOFF_MAX_MS__","breakerFailures":"__BREAKER_FAILURES__","breakerWindowSeconds":"__BREAKER_WINDOW_SECONDS__","breakerCooldownMs":"__BREAKER_COOLDOWN_MS__","contactId":"__CONTACT_ID__"}'::jsonb;
 IF strpos(settings::text,'__')>0 THEN RAISE EXCEPTION 'P9_8C_PLACEHOLDER_REQUIRED: protection policy'; END IF;
 IF strpos('__EXPECTED_BEFORE_MANIFEST_SHA256__','__')>0
 THEN RAISE EXCEPTION 'P9_8C_PLACEHOLDER_REQUIRED: expected full before-manifest SHA256'; END IF;
 
 -- 02c-1 §2: job-root report; aggregate each child independently, retaining zero-child jobs.
 WITH roots AS (
  SELECT j.id FROM public.image_extraction_jobs j WHERE j.job_kind='metadata_enrich' AND (
   j.status IN('open','in_progress','retry_scheduled')
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.job_id=j.id AND (
    l.completed_at IS NULL OR l.store_id IS DISTINCT FROM j.store_id OR l.candidate_id IS DISTINCT FROM j.entity_id
    OR EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a WHERE a.lookup_id=l.id
     AND (a.disposition='unresolved' OR a.store_id IS DISTINCT FROM l.store_id OR a.candidate_id IS DISTINCT FROM l.candidate_id)))))
  -- Any reserved reservation blocks by design, regardless of age or job kind.
  UNION SELECT job_id FROM public.phase9_usage_reservations WHERE status='reserved'
  UNION SELECT job_id FROM public.phase9_metadata_provider_calls WHERE status IN('registered','outcome_unknown')
   OR (edition_call_sequence IS NOT NULL AND edition_egress_started IS NULL)
  -- 02c-1 §2 steps 3/5, D2/D7/D8: old grants and proven-unsent calls need a settled purpose fence.
  UNION SELECT pc.job_id FROM public.phase9_metadata_provider_calls pc
   WHERE (pc.grant_epoch<g.epoch OR (pc.status='stale_rejected' AND pc.edition_egress_started=false))
    AND NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs done
     JOIN public.metadata_enrichment_attempts a ON a.id=pc.logical_attempt_id
     JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id AND l.job_id=done.id
     WHERE done.id=pc.job_id AND done.status IN('resolved','resolved_noop','dead_letter')
      AND done.lease_owner IS NULL AND done.lease_token_hash IS NULL AND done.lease_expires_at IS NULL
      AND l.completed_at IS NOT NULL AND a.disposition IN('accepted','rejected','failed')
      AND a.store_id=pc.store_id AND a.candidate_id=pc.candidate_id
      AND l.store_id=pc.store_id AND l.candidate_id=pc.candidate_id)
  UNION SELECT job_id FROM marketplace_sec.phase9_automatic_provider_runs WHERE status IN('queued','running','unknown')
  UNION SELECT job_id FROM marketplace_sec.phase9_metadata_admissions WHERE slots_remaining>0
  UNION SELECT pc.job_id FROM public.phase9_metadata_provider_calls pc
   LEFT JOIN public.metadata_enrichment_attempts a ON a.id=pc.logical_attempt_id
   LEFT JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
   LEFT JOIN public.image_extraction_jobs j ON j.id=pc.job_id
   WHERE a.id IS NULL OR l.id IS NULL OR j.id IS NULL OR l.job_id IS DISTINCT FROM pc.job_id
    OR pc.store_id IS DISTINCT FROM j.store_id OR pc.candidate_id IS DISTINCT FROM j.entity_id
    OR a.store_id IS DISTINCT FROM pc.store_id OR a.candidate_id IS DISTINCT FROM pc.candidate_id
 ), deferred AS (
  SELECT j.id FROM public.image_extraction_jobs j
  WHERE j.job_kind='metadata_enrich' AND j.status='retry_scheduled'
   AND j.lease_owner IS NULL AND j.lease_token_hash IS NULL AND j.lease_expires_at IS NULL
   AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_job_admission_wait w
    WHERE w.job_id=j.id AND w.blocked_epoch=g.epoch)
   AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.job_id=j.id)
   AND NOT EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id)
   AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id)
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a WHERE a.job_id=j.id AND a.slots_remaining>0)
   -- M93:391-400 neutral queued shape and identity; M93:312 persists f without its secret token.
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r
    LEFT JOIN marketplace_sec.phase9_metadata_admissions a ON a.job_id=r.job_id
    WHERE r.job_id=j.id AND (r.round<>0 OR r.status<>'queued' OR r.retry_allowed OR r.no_egress_recheck
     OR r.lookup_id IS NOT NULL OR r.primary_attempt_id IS NOT NULL OR a.fence IS NULL
     OR r.query_identity_hash IS DISTINCT FROM encode(extensions.digest(a.fence->>'queryIdentity','sha256'),'hex')
     OR r.candidate_version IS DISTINCT FROM (a.fence->>'candidateVersion')::integer
     OR r.captured_request_id IS DISTINCT FROM (a.fence->>'capturedRequestId')::uuid
     OR r.request_generation IS DISTINCT FROM (a.fence->>'requestGeneration')::integer))
 ), captured AS (
  SELECT id,id NOT IN(SELECT id FROM deferred) AS blocking FROM roots
  UNION SELECT pc.job_id,false FROM public.phase9_metadata_provider_calls pc
   WHERE pc.grant_epoch<g.epoch AND NOT EXISTS(SELECT 1 FROM roots WHERE roots.id=pc.job_id)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'jobId',roots.id,'blocking',roots.blocking,'jobKind',j.job_kind,'status',j.status,'attempt',j.attempt_count,'maxAttempts',j.max_attempts,
  'leaseExpiresAt',j.lease_expires_at,
  'lookups',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'completedAt',l.completed_at) ORDER BY l.id),'[]')
   FROM public.phase9_metadata_lookups l WHERE l.job_id=roots.id),
  'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'lookupId',a.lookup_id,'disposition',a.disposition) ORDER BY a.id),'[]')
   FROM public.metadata_enrichment_attempts a JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id WHERE l.job_id=roots.id),
  'reservations',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id),'[]') FROM public.phase9_usage_reservations u WHERE u.job_id=roots.id),
  'calls',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',pc.id,'status',pc.status,'attemptId',pc.logical_attempt_id,
   'claimAttempt',pc.claim_attempt_number,'grantEpoch',pc.grant_epoch,'sequence',pc.edition_call_sequence,'egressStarted',pc.edition_egress_started) ORDER BY pc.id),'[]')
   FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=roots.id),
  'runs',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.adapter_key,r.round),'[]') FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=roots.id),
  'admissions',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM marketplace_sec.phase9_metadata_admissions a WHERE a.job_id=roots.id)
 ) ORDER BY roots.id),'[]') INTO captured_obligations FROM captured roots LEFT JOIN public.image_extraction_jobs j ON j.id=roots.id;
 RAISE NOTICE '8c obligation snapshot: %',captured_obligations;
 SELECT coalesce(jsonb_agg(entry.body),'[]') INTO obligations
 FROM jsonb_array_elements(captured_obligations) AS entry(body) WHERE (entry.body->>'blocking')::boolean;
 IF obligations<>'[]'::jsonb THEN RAISE EXCEPTION 'P9_8C_DRAIN_BLOCKED: %',obligations; END IF;

 -- M89: serialize before sorted tuple locks, matching the registry statement trigger.
 PERFORM pg_advisory_xact_lock(90891001);
 PERFORM 1 FROM public.phase9_provider_registry WHERE adapter_key IN('google_books','open_library') ORDER BY adapter_key FOR UPDATE;
 -- Re-read every column AFTER the sorted locks; never hash the earlier unlocked notice.
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY adapter_key),'[]') INTO before_rows
  FROM public.phase9_provider_registry r WHERE adapter_key IN('google_books','open_library');
 IF encode(extensions.digest(before_rows::text,'sha256'),'hex') IS DISTINCT FROM '__EXPECTED_BEFORE_MANIFEST_SHA256__'
 THEN RAISE EXCEPTION 'P9_8C_MANIFEST_HASH: google_books/open_library actual=%',
  encode(extensions.digest(before_rows::text,'sha256'),'hex'); END IF;
 IF (SELECT count(*) FROM public.phase9_provider_registry WHERE provider_kind='metadata' AND enabled
  AND adapter_version='1.0.0' AND protection_policy IS NULL AND adapter_key IN('google_books','open_library'))<>2
 OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry WHERE adapter_key='google_books'
  AND automatic_lookup_allowed AND automatic_role='primary' AND automatic_order=1
  AND NOT explicit_search_allowed AND explicit_role IS NULL AND explicit_order IS NULL AND NOT shared_catalogue_allowed)
 OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry WHERE adapter_key='open_library'
  AND NOT automatic_lookup_allowed AND automatic_role IS NULL AND automatic_order IS NULL
  AND explicit_search_allowed AND explicit_role='primary' AND explicit_order=1 AND shared_catalogue_allowed
  AND accepted_adapter_versions=ARRAY['1.0.0']
  AND version_contracts->'1.0.0'=marketplace_sec.phase9_provider_validation_contract_v1('open_library','1.0.0'))
 THEN RAISE EXCEPTION 'P9_8C_MANIFEST: expected google_books/open_library transition rows; actual=%',before_rows; END IF;
 policy:=jsonb_build_object('version','p9-protection-v1','mode','single_instance','minIntervalMs',1000,'halfOpenMax',1,
  'contactId',settings->>'contactId');
 FOREACH item IN ARRAY ARRAY['storeWindowSeconds','storeMaxGets','backoffBaseMs','backoffMaxMs',
  'breakerFailures','breakerWindowSeconds','breakerCooldownMs'] LOOP
  IF settings->>item !~ '^[1-9][0-9]*$' OR (settings->>item)::numeric>2147483647
  THEN RAISE EXCEPTION 'P9_8C_POLICY: invalid %',item; END IF;
  policy:=policy||jsonb_build_object(item,(settings->>item)::integer);
 END LOOP;
 UPDATE public.phase9_provider_registry SET enabled=false,automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL,
  explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL,shared_catalogue_allowed=false WHERE adapter_key='google_books';
 UPDATE public.phase9_provider_registry SET adapter_version='2.0.0',accepted_adapter_versions=ARRAY['1.0.0','2.0.0'],
  version_contracts=jsonb_build_object('1.0.0',marketplace_sec.phase9_provider_validation_contract_v1('open_library','1.0.0'),
   '2.0.0',marketplace_sec.phase9_provider_validation_contract_v1('open_library','2.0.0')),
  validation_contract='open-library-v2',host_policy_version='open-library-hosts-v1',
  automatic_lookup_allowed=true,automatic_role='primary',automatic_order=1,protection_policy=policy WHERE adapter_key='open_library';
 PERFORM marketplace_sec.phase9_provider_configuration_assert_v1();
 SELECT jsonb_agg(to_jsonb(r) ORDER BY adapter_key) INTO after_rows FROM public.phase9_provider_registry r
  WHERE adapter_key IN('google_books','open_library');
 SELECT * INTO g FROM marketplace_sec.phase9_external_admission_gate WHERE singleton;
 RAISE NOTICE '8c after gate=% registry=%',to_jsonb(g),after_rows;
END
$operator$;
COMMIT;
