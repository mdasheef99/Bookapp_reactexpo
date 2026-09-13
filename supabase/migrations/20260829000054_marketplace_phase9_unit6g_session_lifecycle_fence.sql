BEGIN;

-- Unit 6G requires closed, closing and expired sessions to remain readable while
-- every new Owner mutation is fenced to one active, unexpired session snapshot.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_session_mutable(
  p_session public.image_extraction_sessions
) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT p_session.status='active'
    AND p_session.expires_at>transaction_timestamp()
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_lock_active_session(
  p_session_id uuid
) RETURNS public.image_extraction_sessions
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions;
BEGIN
  PERFORM marketplace_sec.phase9_owner_ux_assert_owner();
  SELECT * INTO v_session
  FROM public.image_extraction_sessions s
  WHERE s.id=p_session_id
  FOR UPDATE;
  IF v_session.id IS NULL OR v_session.created_by IS DISTINCT FROM auth.uid()
    OR NOT marketplace_sec.phase9_is_store_owner(v_session.store_id)
  THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF NOT marketplace_sec.phase9_owner_ux_session_mutable(v_session) THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  RETURN v_session;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_read_only_candidate_detail(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_result jsonb; v_versions jsonb;
BEGIN
  v_result:=jsonb_set(p_detail,'{allowedActions}',jsonb_build_array('view_readiness'),true);
  IF jsonb_typeof(v_result#>'{variantSummary,proposalVersions}')='array' THEN
    SELECT coalesce(jsonb_agg(
      jsonb_set(e.item,'{allowedActions}','[]'::jsonb,true) ORDER BY e.ordinality
    ),'[]'::jsonb)
    INTO v_versions
    FROM jsonb_array_elements(v_result#>'{variantSummary,proposalVersions}')
      WITH ORDINALITY AS e(item,ordinality);
    v_result:=jsonb_set(v_result,'{variantSummary,proposalVersions}',v_versions,true);
  END IF;
  RETURN v_result;
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
  v_payload:=marketplace_sec.phase9_owner_ux_candidate_detail(v_session,v_candidate);
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

CREATE OR REPLACE FUNCTION public.phase9_add_candidate_to_inventory_v1(
  p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,
  p_expected_review_version integer,p_expected_metadata_revision integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_review jsonb; v_choice jsonb; v_damage jsonb; v_notes jsonb;
  v_snapshot public.phase9_selected_metadata_snapshots; v_edition public.canonical_editions;
  v_replay jsonb; v_response jsonb; v_fingerprint text; v_inventory uuid;
  v_canonical_work uuid; v_canonical_edition uuid; v_metadata_version text;
  v_isbn10 text; v_isbn13 text; v_publisher text; v_published text; v_cover text;
  v_description text; v_edition_statement text; v_volume text; v_format text;
  v_quantity integer;
BEGIN
  -- Authorization and relationship resolution precede every idempotency write.
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id AND c.store_id=v_session.store_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF p_expected_candidate_version<1 OR p_expected_review_version<1
    OR p_expected_metadata_revision<1 OR p_command_id IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,p_candidate_id,
    p_expected_candidate_version,p_expected_review_version,p_expected_metadata_revision,
    p_command_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7AC01',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  v_session:=marketplace_sec.phase9_owner_ux_lock_active_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.store_id IS DISTINCT FROM v_session.store_id
    THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF v_candidate.version<>p_expected_candidate_version
    THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
  IF v_candidate.review_version IS DISTINCT FROM p_expected_review_version
    OR v_candidate.metadata_revision<>p_expected_metadata_revision
    THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF NOT marketplace_sec.phase9_unit7a_commit_eligible(v_candidate)
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  v_review:=v_candidate.owner_review_snapshot->'value';
  v_choice:=v_review->'metadataChoice'; v_damage:=v_review->'damageDisclosure';
  v_notes:=v_review->'notes'; v_quantity:=(v_review->>'quantity')::integer;
  IF v_choice->>'mode'='selected' THEN
    SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots s
      WHERE s.id=(v_choice->>'selectionId')::uuid
        AND s.id=v_candidate.selected_metadata_snapshot_id
        AND s.candidate_id=v_candidate.id AND s.store_id=v_candidate.store_id;
    IF v_snapshot.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    v_metadata_version:=v_snapshot.snapshot_version;
    v_canonical_edition:=v_snapshot.canonical_edition_id;
    IF v_canonical_edition IS NOT NULL THEN
      SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_canonical_edition;
      IF v_edition.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
      v_canonical_work:=v_edition.work_id; v_isbn10:=v_edition.isbn_10;
      v_isbn13:=v_edition.isbn_13; v_publisher:=v_edition.publisher;
      v_published:=v_edition.published_date; v_cover:=v_edition.cover_url;
      v_description:=v_edition.description;
      v_edition_statement:=v_edition.edition_statement;
      v_volume:=v_edition.volume; v_format:=v_edition.format;
    ELSE
      v_isbn10:=coalesce(v_snapshot.coherent_edition->>'isbn10',v_snapshot.coherent_edition->>'isbn_10');
      v_isbn13:=coalesce(v_snapshot.coherent_edition->>'isbn13',v_snapshot.coherent_edition->>'isbn_13');
      v_publisher:=v_snapshot.coherent_edition->>'publisher';
      v_published:=coalesce(v_snapshot.coherent_edition->>'publishedDate',
        v_snapshot.coherent_edition->>'published_date');
      v_cover:=coalesce(v_snapshot.coherent_edition->>'coverReference',
        v_snapshot.coherent_edition->>'cover_url');
      v_description:=v_snapshot.coherent_edition->>'description';
      v_edition_statement:=v_snapshot.coherent_edition->>'editionStatement';
      v_volume:=v_snapshot.coherent_edition->>'volume'; v_format:=v_snapshot.coherent_edition->>'format';
    END IF;
  ELSE
    v_metadata_version:=concat('manual-review-v',p_expected_review_version,
      '-metadata-r',p_expected_metadata_revision);
  END IF;

  INSERT INTO public.store_inventory(
    id,store_id,canonical_work_id,canonical_edition_id,title,authors,isbn_10,isbn_13,
    publisher,published_date,cover_url,language,description,edition_statement,volume,format,
    condition,has_damage,damage_notes,damage_types,is_sellable,
    quantity_total,quantity_available,quantity_reserved,quantity_sold,quantity_removed,
    selling_price_minor,shelf_location,internal_notes,public_notes,visibility_status,
    publication_status,extraction_session_id,entry_method,created_from_candidate_id,
    created_by,metadata_snapshot_version)
  VALUES(gen_random_uuid(),v_session.store_id,v_canonical_work,v_canonical_edition,
    v_review->>'originalTitle',ARRAY(SELECT jsonb_array_elements_text(v_review->'authors')),
    v_isbn10,v_isbn13,v_publisher,v_published,v_cover,v_review->>'originalLanguage',
    v_description,v_edition_statement,v_volume,v_format,v_review->>'baseCondition',
    (v_damage->>'hasDamage')::boolean,
    NULLIF(v_damage->>'damageNote',''),ARRAY(SELECT jsonb_array_elements_text(v_damage->'damageTypes')),
    (v_damage->>'isSellable')::boolean,v_quantity,v_quantity,0,0,0,
    (v_review->>'priceMinor')::integer,v_review->>'shelfLocation',
    NULLIF(v_notes->>'internalNote',''),NULLIF(v_notes->>'publicNote',''),'draft','private',
    v_session.id,'image_extraction',v_candidate.id,auth.uid(),v_metadata_version)
  RETURNING id INTO v_inventory;

  UPDATE public.image_extraction_candidates SET state='committed',
    committed_inventory_id=v_inventory,committed_listing_id=NULL,
    commit_idempotency_key=p_idempotency_key,commit_outcome='committed_private',
    publication_decision=v_review->>'publicationIntent',version=version+1,
    updated_at=transaction_timestamp()
    WHERE id=v_candidate.id RETURNING * INTO v_candidate;
  UPDATE public.image_extraction_sessions SET committed_count=committed_count+1,
    updated_at=transaction_timestamp() WHERE id=v_session.id;
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details)
  VALUES(v_session.store_id,'phase9.candidate_commit','store_inventory',v_inventory,auth.uid(),
    jsonb_build_object('candidateId',v_candidate.id,'sessionId',v_session.id,
      'candidateVersion',v_candidate.version,'reviewVersion',p_expected_review_version,
      'metadataRevision',p_expected_metadata_revision,'commandId',p_command_id,
      'outcome','committed_private','publicationIntent',v_review->>'publicationIntent'));
  INSERT INTO public.marketplace_events(event_type,entity_type,entity_id,store_id,
    actor_user_id,payload)
  VALUES('inventory.created_from_candidate','store_inventory',v_inventory,v_session.store_id,
    auth.uid(),jsonb_build_object('candidateId',v_candidate.id,'sessionId',v_session.id,
      'commandId',p_command_id,'outcome','committed_private'));
  v_response:=jsonb_build_object('sessionId',v_session.id,'candidateId',v_candidate.id,
    'candidateVersion',v_candidate.version,'inventoryId',v_inventory,
    'inventoryVersion',1,'outcome','committed_private');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7AC01',
    p_idempotency_key,v_response,'private_inventory_created');
  RETURN v_response;
END$$;

CREATE OR REPLACE FUNCTION public.phase9_owner_remove_candidate_v1(
  p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_fingerprint text; v_replay jsonb; v_response jsonb; v_old text;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF p_expected_candidate_version IS NULL OR p_expected_candidate_version<1
    OR p_command_id IS NULL OR p_idempotency_key IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,p_candidate_id,
    p_expected_candidate_version,p_command_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U6GC02',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  v_session:=marketplace_sec.phase9_owner_ux_lock_active_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.store_id IS DISTINCT FROM v_session.store_id
    THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF v_candidate.version<>p_expected_candidate_version
    THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
  IF v_candidate.state NOT IN ('processing','ready','needs_review','possible_duplicate','failed')
    OR v_candidate.review_disposition IN ('skipped_false_detection','owner_removed_from_scan')
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_old:=v_candidate.review_disposition;
  UPDATE public.image_extraction_candidates SET
    review_disposition='owner_removed_from_scan',review_ready=false,
    version=version+1,updated_at=transaction_timestamp()
  WHERE id=v_candidate.id RETURNING * INTO v_candidate;
  SELECT * INTO v_session FROM public.image_extraction_sessions s
    WHERE s.id=p_session_id;
  v_response:=jsonb_build_object(
    'sessionId',v_session.id,'candidateId',v_candidate.id,
    'candidateVersion',v_candidate.version,'sessionVersion',v_session.version,
    'presentationRevision',v_session.presentation_revision,
    'reviewDisposition','owner_removed_from_scan','removedAt',v_candidate.updated_at);
  INSERT INTO public.marketplace_audit_logs(
    store_id,actor_user_id,action,entity_type,entity_id,details
  ) VALUES(v_session.store_id,auth.uid(),'phase9.candidate.owner_removed_from_scan',
    'image_extraction_candidate',v_candidate.id,jsonb_build_object(
      'candidateId',v_candidate.id,'sessionId',v_session.id,
      'oldDisposition',v_old,'newDisposition','owner_removed_from_scan',
      'expectedCandidateVersion',p_expected_candidate_version,
      'candidateVersion',v_candidate.version,'sessionVersion',v_session.version,
      'commandId',p_command_id,'idempotencyKey',p_idempotency_key));
  INSERT INTO public.marketplace_events(
    event_type,entity_type,entity_id,store_id,actor_user_id,actor_role,source,
    idempotency_key,command_id,privacy_classification,payload
  ) VALUES('phase9.candidate.owner_removed_from_scan','image_extraction_candidate',
    v_candidate.id,v_session.store_id,auth.uid(),'owner','store_owner_app',
    auth.uid()::text||':unit6g-remove:'||p_idempotency_key,p_command_id,'internal',
    jsonb_build_object(
      'candidateId',v_candidate.id,'sessionId',v_session.id,
      'oldDisposition',v_old,'newDisposition','owner_removed_from_scan',
      'expectedCandidateVersion',p_expected_candidate_version,
      'candidateVersion',v_candidate.version,'sessionVersion',v_session.version,
      'commandId',p_command_id));
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U6GC02',
    p_idempotency_key,v_response,'candidate_owner_removed_from_scan');
  RETURN v_response;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_detail jsonb;
  v_summary jsonb;
  v_sources jsonb;
  v_actions jsonb;
BEGIN
  v_detail:=marketplace_sec.phase9_owner_ux_candidate_detail(p_session,p_candidate);
  v_sources:=marketplace_sec.phase9_unit6g_field_sources(
    p_session,p_candidate,v_detail);
  v_summary:=marketplace_sec.phase9_unit6g_metadata_summary(v_detail);
  IF marketplace_sec.phase9_owner_ux_session_mutable(p_session) THEN
    v_actions:=jsonb_build_array('view_metadata','remove_from_scan','view_readiness');
    IF p_candidate.state IN ('ready','needs_review','possible_duplicate') THEN
      v_actions:=v_actions||'"save_review"'::jsonb;
    END IF;
    IF p_candidate.review_ready AND p_candidate.review_disposition='reviewed'
      AND p_candidate.state='ready' THEN
      v_actions:=v_actions||'"add_to_inventory"'::jsonb;
    END IF;
  ELSE
    v_actions:=jsonb_build_array('view_metadata','view_readiness');
  END IF;
  RETURN jsonb_build_object(
    'sessionId',p_session.id,'candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'ordinal',p_candidate.candidate_index,'candidateState',p_candidate.state,
    'candidateVersion',p_candidate.version,
    'metadataState',v_detail#>'{metadata,state}',
    'metadataRevision',p_candidate.metadata_revision,
    'reviewVersion',p_candidate.review_version,
    'reviewDisposition',p_candidate.review_disposition,
    'observed',v_detail->'observed','metadataSummary',v_summary,
    'review',v_detail#>'{review,value}',
    'fieldSources',v_sources,
    'attentionCodes',v_detail->'attentionCodes',
    'blockers',v_detail#>'{readiness,blockers}',
    'reviewReady',p_candidate.review_ready,'allowedActions',v_actions,
    'updatedAt',p_candidate.updated_at);
END$$;

ALTER FUNCTION marketplace_sec.phase9_owner_ux_session_mutable(
  public.image_extraction_sessions) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_lock_active_session(uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_read_only_candidate_detail(jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_update_candidate_review_v2(
  uuid,uuid,integer,integer,jsonb,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_add_candidate_to_inventory_v1(
  uuid,uuid,integer,integer,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_remove_candidate_v1(
  uuid,uuid,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_session_mutable(
  public.image_extraction_sessions) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_lock_active_session(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_read_only_candidate_detail(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_update_candidate_review_v2(
  uuid,uuid,integer,integer,jsonb,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_add_candidate_to_inventory_v1(
  uuid,uuid,integer,integer,integer,text,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.phase9_owner_remove_candidate_v1(
  uuid,uuid,integer,text,uuid) FROM PUBLIC,anon,service_role;

GRANT EXECUTE ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_update_candidate_review_v2(
  uuid,uuid,integer,integer,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_add_candidate_to_inventory_v1(
  uuid,uuid,integer,integer,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_remove_candidate_v1(
  uuid,uuid,integer,text,uuid) TO authenticated;

COMMIT;
