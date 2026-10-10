-- Owner-authorized M71 local correction; picker §§4.1/6-7, DOC-3 §5.1.
-- M65-M70 are APPLIED and byte-preserved. This artifact is NOT_APPLIED.
-- Replace the actual M70 delegate, preserving wrapper, locks, versions and receipts.
-- Rollback requires a separately authorized forward restoration of the M66 delegate
-- body at its M70 private signature; never rewrite historical migrations or data.
BEGIN;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(
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
 -- Explicit options use the same validated eligibility rule as M68 completion.
 -- Automatic/current suggestions retain their strict compatibility boundary.
 IF m IS NULL OR NOT (CASE WHEN p_source='edition_option'
  THEN marketplace_sec.phase9_edition_option_eligible(m,q)
  ELSE marketplace_sec.phase9_edition_identity_compatible(m,q) END)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
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
ALTER FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
