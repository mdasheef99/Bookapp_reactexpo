BEGIN;

-- Forward-only correction: project M61 representative-cover provenance through
-- the standalone Owner detail and review-save response without changing the
-- selected edition snapshot, inventory semantics, or public discovery.

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_with_representative_cover(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_selection_id uuid; v_candidate_id uuid; v_cover jsonb;
BEGIN
  v_selection_id:=NULLIF(p_detail#>>'{metadata,selectionId}','')::uuid;
  v_candidate_id:=NULLIF(p_detail->>'candidateId','')::uuid;
  IF p_detail#>>'{metadata,state}'='selected'
    AND v_selection_id IS NOT NULL
    AND v_candidate_id IS NOT NULL
    AND coalesce(p_detail#>>'{metadata,snapshot,coverReference}','')=''
  THEN
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,
      'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,
      'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_cover
    FROM public.phase9_selected_metadata_snapshots s
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
      AND r.source_candidate_id=s.candidate_id
      AND r.source_store_id=s.store_id
    WHERE s.id=v_selection_id AND s.candidate_id=v_candidate_id;
  END IF;
  RETURN jsonb_set(p_detail,'{metadata,representativeCover}',
    coalesce(v_cover,'null'::jsonb),true);
END$$;

CREATE OR REPLACE FUNCTION public.phase9_owner_candidate_detail_v2(
  p_session_id uuid,p_candidate_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_payload jsonb; v_versions jsonb; v_allowed jsonb; v_response jsonb;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  v_payload:=marketplace_sec.phase9_owner_ux_with_representative_cover(
    marketplace_sec.phase9_owner_ux_candidate_detail(v_session,v_candidate));
  SELECT coalesce(jsonb_agg(jsonb_build_object('proposalId',p.id,
    'version',p.lifecycle_version,'allowedActions',jsonb_build_array(
      'approve','reject','replace')) ORDER BY p.id),'[]'::jsonb)
    INTO v_versions FROM public.phase9_search_variant_proposals p
    WHERE p.candidate_id=v_candidate.id AND p.status IN ('proposed','stale');
  v_allowed:=CASE WHEN v_candidate.state IN ('committed','commit_in_progress')
      OR v_candidate.review_disposition='skipped_false_detection'
    THEN jsonb_build_array('view_readiness')
    ELSE jsonb_build_array('save_review','mark_false',
      CASE WHEN jsonb_array_length(v_versions)>0 THEN 'open_variant_review' ELSE 'add_missed' END,
      'view_readiness') END;
  IF marketplace_sec.phase9_unit7a_commit_eligible(v_candidate) THEN
    v_allowed:=v_allowed||'"add_to_inventory"'::jsonb;
  END IF;
  v_response:=v_payload||jsonb_build_object('variantSummary',jsonb_build_object(
    'unresolvedCount',jsonb_array_length(v_versions),'proposalVersions',v_versions),
    'allowedActions',v_allowed);
  IF NOT marketplace_sec.phase9_owner_ux_session_mutable(v_session) THEN
    RETURN marketplace_sec.phase9_owner_ux_read_only_candidate_detail(v_response);
  END IF;
  RETURN v_response;
END$$;

CREATE OR REPLACE FUNCTION public.phase9_update_candidate_review_v2(
  p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,
  p_expected_metadata_revision integer,p_review jsonb,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_fingerprint text; v_replay jsonb; v_response jsonb; v_choice jsonb; v_blockers jsonb;
  v_review jsonb:=p_review||jsonb_build_object('duplicateIntent',NULL);
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF p_expected_candidate_version<1 OR p_expected_metadata_revision<1
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR NOT marketplace_sec.phase9_owner_ux_valid_review(v_review)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,p_candidate_id,
    p_expected_candidate_version,p_expected_metadata_revision,v_review::text,p_command_id),
    'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U6C01',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN
    v_replay:=marketplace_sec.phase9_owner_ux_with_representative_cover(v_replay);
    v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
    IF marketplace_sec.phase9_owner_ux_session_mutable(v_session) THEN
      RETURN v_replay;
    END IF;
    RETURN marketplace_sec.phase9_owner_ux_read_only_candidate_detail(v_replay);
  END IF;
  v_session:=marketplace_sec.phase9_owner_ux_lock_active_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.store_id IS DISTINCT FROM v_session.store_id
    THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF v_candidate.metadata_revision<>p_expected_metadata_revision
    THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF v_candidate.version<>p_expected_candidate_version
    THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
  IF v_candidate.state NOT IN ('ready','needs_review','possible_duplicate')
    OR v_candidate.review_disposition='skipped_false_detection'
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_choice:=v_review->'metadataChoice';
  IF v_choice->>'mode'='selected' AND NOT EXISTS(
    SELECT 1 FROM public.phase9_selected_metadata_snapshots s
    WHERE s.id=(v_choice->>'selectionId')::uuid AND s.candidate_id=v_candidate.id
      AND s.store_id=v_candidate.store_id AND s.id=v_candidate.selected_metadata_snapshot_id)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_candidate.owner_review_snapshot:=jsonb_build_object('value',v_review,
    'confirmed_title',jsonb_build_object('value',v_review->>'originalTitle'),
    'confirmed_authors',coalesce(v_review->'authors','[]'::jsonb));
  v_candidate.review_disposition:='reviewed'; v_candidate.review_ready:=true;
  v_candidate.state:='ready';
  v_blockers:=marketplace_sec.phase9_owner_ux_review_blockers(v_candidate);
  IF jsonb_array_length(v_blockers)>0 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.image_extraction_candidates SET
    owner_review_snapshot=v_candidate.owner_review_snapshot,
    review_disposition='reviewed',review_ready=true,
    review_version=coalesce(review_version,0)+1,state='ready',version=version+1,
    updated_at=transaction_timestamp()
    WHERE id=v_candidate.id RETURNING * INTO v_candidate;
  v_response:=public.phase9_owner_candidate_detail_v2(p_session_id,p_candidate_id);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U6C01',
    p_idempotency_key,v_response,'review_saved_no_unit7_effect');
  RETURN v_response;
END$$;

ALTER FUNCTION marketplace_sec.phase9_owner_ux_with_representative_cover(jsonb)
  OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_update_candidate_review_v2(
  uuid,uuid,integer,integer,jsonb,text,uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_with_representative_cover(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid)
  FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.phase9_update_candidate_review_v2(
  uuid,uuid,integer,integer,jsonb,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_update_candidate_review_v2(
  uuid,uuid,integer,integer,jsonb,text,uuid) TO authenticated;

COMMIT;
