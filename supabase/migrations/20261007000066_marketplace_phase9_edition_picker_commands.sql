-- Owner edition-picker SDD §§5–6/8–9: controlled commands; no provider or inventory effect.
BEGIN;
CREATE FUNCTION marketplace_sec.phase9_edition_lookup_receipt(p_candidate public.image_extraction_candidates,p_prior jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; operation uuid; status text; available boolean; same boolean;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id;
 operation:=coalesce((p_prior->>'operationId')::uuid,s.request_id);
 same:=coalesce(operation=s.request_id,false);
 SELECT CASE WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
  WHEN j.status IN('resolved','resolved_noop') THEN 'ready' ELSE 'failed' END INTO status
 FROM public.image_extraction_jobs j WHERE id=operation AND store_id=p_candidate.store_id AND entity_id=p_candidate.id;
 available:=coalesce(same AND s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate)
  AND s.options_expires_at>transaction_timestamp() AND status='ready' AND EXISTS(
   SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key='google_books'
    AND r.enabled AND r.matching_allowed AND r.storage_allowed),false);
 RETURN jsonb_build_object('operationId',operation,'status',coalesce(status,'failed'),
  'requestGeneration',CASE WHEN same THEN s.request_generation ELSE coalesce((p_prior->>'requestGeneration')::integer,0) END,
  'optionsVersion',CASE WHEN same THEN s.options_version ELSE coalesce((p_prior->>'optionsVersion')::integer,0) END,
  'available',available);
END$$;
CREATE FUNCTION public.phase9_owner_candidate_edition_choices_v1(p_session_id uuid,p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id,p_candidate_id);
 RETURN marketplace_sec.phase9_edition_choices(c);
END$$;
CREATE FUNCTION public.phase9_request_candidate_edition_options_v1(
 p_session_id uuid,p_candidate_id uuid,p_expected_request_generation integer,p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 fingerprint text; replay jsonb; response jsonb; q text; pending boolean; fresh boolean; job uuid;
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
CREATE FUNCTION public.phase9_select_candidate_edition_v1(
 p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,p_expected_metadata_revision integer,
 p_expected_review_version integer,p_source text,p_options_version integer,p_option_id uuid,p_selection_id uuid,
 p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state; r jsonb; m jsonb;
 selected uuid; source_id uuid; fingerprint text; replay jsonb; response jsonb; q text; review jsonb;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id,p_candidate_id);
 IF NOT coalesce(p_expected_candidate_version>0 AND p_expected_metadata_revision>0
  AND (p_expected_review_version IS NULL OR p_expected_review_version>0)
  AND p_idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$' AND p_command_id IS NOT NULL
  AND ((p_source='edition_option' AND p_options_version>0 AND p_option_id IS NOT NULL AND p_selection_id IS NULL)
   OR (p_source='current_suggestion' AND p_selection_id IS NOT NULL AND p_options_version IS NULL AND p_option_id IS NULL)),false)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 fingerprint:=encode(extensions.digest(jsonb_build_array(p_session_id,p_candidate_id,p_expected_candidate_version,
  p_expected_metadata_revision,p_expected_review_version,p_source,p_options_version,p_option_id,
  p_selection_id,p_command_id)::text,'sha256'),'hex');
 replay:=marketplace_sec.phase9_replay(auth.uid()::text,'EP_SELECT_V1',p_idempotency_key,fingerprint);
 -- Receipts retain only the chosen snapshot/versions. Options are always retrieved through the current read.
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF c.metadata_revision<>p_expected_metadata_revision OR c.review_version IS DISTINCT FROM p_expected_review_version
  THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
 IF c.version<>p_expected_candidate_version THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
 q:=marketplace_sec.phase9_edition_query_identity(c);
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF p_source='edition_option' THEN
  IF s.options_version IS DISTINCT FROM p_options_version THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF s.query_identity IS DISTINCT FROM q OR s.options_expires_at IS NULL
   OR s.options_expires_at<=transaction_timestamp() OR NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry pr WHERE pr.adapter_key='google_books'
     AND pr.enabled AND pr.matching_allowed AND pr.storage_allowed)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT x INTO r FROM jsonb_array_elements(s.options) x WHERE x->>'optionId'=p_option_id::text;
  IF r IS NULL OR r->>'eligibility'<>'eligible' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  m:=r->'metadata'; source_id:=p_option_id;
 ELSE
  IF c.selected_metadata_snapshot_id IS DISTINCT FROM p_selection_id THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  m:=marketplace_sec.phase9_edition_current_snapshot(c); source_id:=p_selection_id;
 END IF;
 IF m IS NULL OR NOT marketplace_sec.phase9_edition_identity_compatible(m,q) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 selected:=gen_random_uuid();
 INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity,
  selection_id,selected_source,selected_source_id,selected_option_snapshot,selected_at,selected_by)
 VALUES(c.id,c.session_id,c.store_id,q,selected,p_source,source_id,m,transaction_timestamp(),auth.uid())
 ON CONFLICT(candidate_id) DO UPDATE SET selection_id=excluded.selection_id,
  selected_source=excluded.selected_source,selected_source_id=excluded.selected_source_id,
  selected_option_snapshot=excluded.selected_option_snapshot,selected_at=excluded.selected_at,
  selected_by=excluded.selected_by,updated_at=transaction_timestamp();
 review:=c.owner_review_snapshot;
 IF jsonb_typeof(review->'value')='object' THEN
  review:=jsonb_set(review,'{value}',(review->'value')||jsonb_build_object(
   'originalTitle',m->'title','authors',m->'authors','originalLanguage',m->'language','script',m->'script',
   'metadataChoice',jsonb_build_object('mode','edition_option','selectionId',selected),
   'originalFieldConfirmation',jsonb_build_object('title',true,'authors',
    (SELECT jsonb_agg(true) FROM jsonb_array_elements(m->'authors')))));
  review:=review||jsonb_build_object('confirmed_title',jsonb_build_object('value',m->'title'),'confirmed_authors',m->'authors');
 END IF;
 UPDATE public.image_extraction_candidates SET owner_review_snapshot=review,metadata_revision=metadata_revision+1,
  review_version=CASE WHEN review_version IS NULL THEN NULL ELSE review_version+1 END,version=version+1,
  review_ready=false,updated_at=transaction_timestamp() WHERE id=c.id RETURNING * INTO c;
 response:=marketplace_sec.phase9_edition_choices(c);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_SELECT_V1',p_idempotency_key,
  response||jsonb_build_object('rows','[]'::jsonb,'optionsExpiresAt',NULL),'edition_selected_no_inventory_effect');
 RETURN response;
END$$;
ALTER FUNCTION marketplace_sec.phase9_edition_lookup_receipt(public.image_extraction_candidates,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_lookup_receipt(public.image_extraction_candidates,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
DO $$DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN('phase9_owner_candidate_edition_choices_v1',
   'phase9_request_candidate_edition_options_v1','phase9_select_candidate_edition_v1')
 LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END LOOP;
END$$;
COMMIT;
