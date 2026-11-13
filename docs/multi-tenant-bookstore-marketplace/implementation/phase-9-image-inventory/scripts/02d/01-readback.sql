-- 02d Unit 3 / ACP-9 readback matrix. STRICTLY READ-ONLY: SELECT only.
-- Safe on dev at any moment; never calls an application function and never writes.
-- Operator: edit the cutoff literal below (default '-infinity' = all time).
-- Expected at the three runbook moments:
--   baseline (M99): R1 helper overloads absent; completion hook false; choices
--     queryLanguage false; M101 request function exists (M75) but its three M101
--     markers false. R2 on dev: OL automatic on, Google off. R3 old receipts are
--     skipped/not_installed; no saved events. R4 is 0 only at quiescence.
--   after apply (M100+M101): R1 every check true. R2 unchanged. R3 saved events
--     appear for retained OL lists; skips keep their reasons.
--   after ACP-9 flag rollback (8c 06-rollback.sql): R1 stays true (SQL installed);
--     R2 OL automatic off (role/order null) with explicit search unchanged and
--     Google still off; R3 no new saved events after the edited cutoff and new
--     local completions are skipped. R4 zero is diagnostic only, never a drain or
--     code-rollback authorization; the full drain is 8c 06-rollback.sql:21+.
WITH cutoff(at) AS (VALUES ('-infinity'::timestamptz)),
checks AS (
 SELECT 'R1.helper_overloads' AS "check",
  jsonb_build_object(
   'without_registry', to_regprocedure('marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer)') IS NOT NULL,
   'with_registry', to_regprocedure('marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer,public.phase9_provider_registry)') IS NOT NULL
  ) AS value,
  'M99: false/false; after M100 and after the ACP-9 flag rollback: true/true (M100:8, M100:105).' AS expected_note
 UNION ALL
 SELECT 'R1.completion_calls_hook',
  to_jsonb(coalesce((SELECT position('phase9_prefill_automatic_editions_v1' in p.prosrc)>0
   FROM pg_proc p WHERE p.oid=to_regprocedure('marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb)')),false)),
  'false at M99; true after M100 and after flag rollback (hook call M100:481).'
 UNION ALL
 SELECT 'R1.choices_emit_query_language',
  to_jsonb(coalesce((SELECT position('queryLanguage' in p.prosrc)>0
   FROM pg_proc p WHERE p.oid=to_regprocedure('marketplace_sec.phase9_edition_legacy_choices(public.image_extraction_candidates)')),false)),
  'false at M99; true after M100 and after flag rollback (M100:548).'
 UNION ALL
 SELECT 'R1.m101_search_while_fresh',
  (SELECT jsonb_build_object(
   'installed', to_regprocedure('public.phase9_request_candidate_edition_options_v1(uuid,uuid,integer,text,uuid)') IS NOT NULL,
   'if_not_pending', coalesce((SELECT p.prosrc ~ 'IF\s+NOT\s+pending\s+THEN'
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.phase9_request_candidate_edition_options_v1(uuid,uuid,integer,text,uuid)')),false),
   'version_increment', coalesce((SELECT p.prosrc ~ 'options_version\s*=\s*options_version\s*\+\s*1'
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.phase9_request_candidate_edition_options_v1(uuid,uuid,integer,text,uuid)')),false),
   'nowait', coalesce((SELECT p.prosrc ~ 'FOR\s+UPDATE\s+NOWAIT'
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.phase9_request_candidate_edition_options_v1(uuid,uuid,integer,text,uuid)')),false)
  )),
  'M99: installed=true (M75) but all three markers false; after M101 all true (M101:31, M101:44, M101:48); stays true after flag rollback.'
 UNION ALL
 SELECT 'R2.'||v.adapter_key,
  CASE WHEN r.adapter_key IS NULL THEN 'null'::jsonb ELSE jsonb_build_object(
   'enabled', r.enabled,
   'automatic_lookup_allowed', r.automatic_lookup_allowed,
   'automatic_role', r.automatic_role,
   'automatic_order', r.automatic_order,
   'explicit_search_allowed', r.explicit_search_allowed) END,
  CASE v.adapter_key
   WHEN 'open_library' THEN 'baseline/after apply: automatic on (role=primary, order=1), explicit on. After ACP-9 flag rollback: automatic=false, role/order null, explicit unchanged, enabled unchanged.'
   ELSE 'Google stays off at every moment: enabled=false, automatic=false, role/order null, explicit=false (OD-3).'
  END
 FROM (VALUES ('open_library'),('google_books')) v(adapter_key)
 LEFT JOIN public.phase9_provider_registry r ON r.adapter_key=v.adapter_key
 UNION ALL
 SELECT 'R3.receipts_by_prefill',
  coalesce((SELECT jsonb_agg(jsonb_build_object('status',s.status,'reason',s.reason,'count',s.n)
    ORDER BY s.status,s.reason)
   FROM (SELECT coalesce(e.receipt#>>'{prefill,status}','<none>') AS status,
     e.receipt#>>'{prefill,reason}' AS reason, count(*) AS n
    FROM marketplace_sec.phase9_automatic_completion_effects e CROSS JOIN cutoff c
    WHERE e.completed_at>=c.at
    GROUP BY 1,2) s),'[]'::jsonb),
  'Receipt prefill status/reason since cutoff (effects M92:1197; completed_at M92:1214). Baseline: skipped/not_installed only; after apply: saved; after rollback: new skipped/no_retention and no new saved.'
 UNION ALL
 SELECT 'R3.saved_list_events',
  to_jsonb((SELECT count(*) FROM marketplace_sec.phase9_automatic_completion_effects e CROSS JOIN cutoff c
   WHERE e.completed_at>=c.at AND e.receipt#>>'{prefill,status}'='saved')),
  'Saved-list EVENTS since cutoff, including saved empty lists. This is not a count of current rows.'
 UNION ALL
 SELECT 'R3.current_retained_state',
  (SELECT jsonb_build_object(
   'state_rows', count(*),
   'rows_with_saved_options', count(*) FILTER (WHERE jsonb_array_length(options)>0),
   'rows_bound_to_request', count(*) FILTER (WHERE request_id IS NOT NULL))
   FROM public.phase9_candidate_edition_state),
  'Current retained edition state (M65:91). It is mutable and does not establish historical saves.'
 UNION ALL
 SELECT 'R4.in_flight_automatic_jobs',
  to_jsonb((SELECT count(*) FROM public.image_extraction_jobs j
   WHERE j.job_kind='metadata_enrich'
    AND j.status IN ('open','in_progress','retry_scheduled')
    AND j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1')),
  'candidate metadata_enrich jobs open/in_progress/retry_scheduled with non-owner operation_version (NULL included). Diagnostic only: zero is not a drain or code-rollback authorization; full drain is 8c 06-rollback.sql:21+.'
 UNION ALL
 SELECT 'R4.admission_gate',
  coalesce((SELECT to_jsonb(g) FROM marketplace_sec.phase9_external_admission_gate g WHERE g.singleton),'null'::jsonb),
  'Current 8c gate. Zero in-flight jobs does not replace the 8c drain; 06 pauses the gate and turns OL automatic off (06:100-102).'
)
SELECT "check", value, expected_note FROM checks;
