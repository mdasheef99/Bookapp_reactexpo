-- 02c §7 / 02c-1 §2. OPERATOR TEMPLATE ONLY; never run by a migration.
-- Use a separately authorized postgres operator connection. Any error rolls back this entire script.
-- Review the immutable 8b artifact, complete manifests, baseline disposition and single-worker evidence first.
-- Cohort, budget, expiry and smoke execution require separate approval. This script grants no such approval.
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
 IF g.mode<>'paused' THEN RAISE EXCEPTION 'P9_8C_GATE_PRECONDITION: singleton=true mode=%',g.mode; END IF;
 IF strpos('__SMOKE_JOB_IDS__','__')>0 OR strpos('__SMOKE_EXPIRES_AT__','__')>0
 THEN RAISE EXCEPTION 'P9_8C_PLACEHOLDER_REQUIRED: approved smoke cohort/expiry'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key='google_books' AND NOT r.enabled
 AND NOT r.automatic_lookup_allowed AND r.automatic_role IS NULL AND r.automatic_order IS NULL
 AND NOT r.explicit_search_allowed AND r.explicit_role IS NULL AND r.explicit_order IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key='open_library' AND r.enabled
 AND r.adapter_version='2.0.0' AND r.accepted_adapter_versions=ARRAY['1.0.0','2.0.0']
 AND r.explicit_search_allowed AND r.explicit_role='primary' AND r.explicit_order=1
 AND r.automatic_lookup_allowed AND r.automatic_role='primary' AND r.automatic_order=1 AND r.protection_policy IS NOT NULL)
 THEN RAISE EXCEPTION 'P9_8C_MANIFEST: google_books,open_library'; END IF;
 settings:='__SMOKE_JOB_IDS__'::jsonb;
 IF jsonb_typeof(settings)<>'array' THEN RAISE EXCEPTION 'P9_8C_SMOKE: cohort must be UUID array'; END IF;
 SELECT array_agg(x::uuid) INTO cohort FROM jsonb_array_elements_text(settings) x;
 deadline:='__SMOKE_EXPIRES_AT__'::timestamptz;
 IF coalesce(cardinality(cohort),0) NOT BETWEEN 1 AND 20 OR array_position(cohort,NULL::uuid) IS NOT NULL
  OR (SELECT count(DISTINCT id) FROM unnest(cohort) id)<>cardinality(cohort)
  OR NOT isfinite(deadline) OR deadline<=clock_timestamp()
  OR EXISTS(SELECT 1 FROM unnest(cohort) c(job_id) WHERE NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs j WHERE j.id=c.job_id AND j.job_kind='metadata_enrich'))
 THEN RAISE EXCEPTION 'P9_8C_SMOKE: invalid cohort=% expiry=%',cohort,deadline; END IF;
 UPDATE marketplace_sec.phase9_external_admission_gate SET mode='smoke',epoch=epoch+1,smoke_job_ids=cohort,expires_at=deadline WHERE singleton;
 SELECT jsonb_agg(to_jsonb(r) ORDER BY adapter_key) INTO after_rows FROM public.phase9_provider_registry r
  WHERE adapter_key IN('google_books','open_library');
 SELECT * INTO g FROM marketplace_sec.phase9_external_admission_gate WHERE singleton;
 RAISE NOTICE '8c after gate=% registry=%',to_jsonb(g),after_rows;
END
$operator$;
COMMIT;
