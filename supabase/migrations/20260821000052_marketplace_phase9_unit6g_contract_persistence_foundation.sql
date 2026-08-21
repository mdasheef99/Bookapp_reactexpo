-- Phase 9 M52: Unit 6G Group 1 contract and persistence foundation.
-- Forward-only. M39-M51 and the strict v2 response shapes remain immutable.
BEGIN;

ALTER TABLE public.image_extraction_sessions
  ALTER COLUMN default_condition DROP NOT NULL,
  ADD COLUMN default_price_minor integer,
  ADD COLUMN batch_label text;

ALTER TABLE public.image_extraction_sessions
  ADD CONSTRAINT image_extraction_sessions_default_price_minor_check
    CHECK (default_price_minor IS NULL OR default_price_minor BETWEEN 0 AND 2147483647),
  ADD CONSTRAINT image_extraction_sessions_batch_label_check
    CHECK (batch_label IS NULL OR (
      char_length(batch_label) BETWEEN 1 AND 80
      AND batch_label=btrim(batch_label)
      AND batch_label=normalize(batch_label,NFC)
      AND batch_label !~ '[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]'
    ));

ALTER TABLE public.image_extraction_candidates
  DROP CONSTRAINT image_extraction_candidates_review_disposition_check,
  ADD CONSTRAINT image_extraction_candidates_review_disposition_check
    CHECK (review_disposition IS NULL OR review_disposition IN (
      'reviewed','skipped_false_detection','owner_removed_from_scan'
    ));

CREATE FUNCTION marketplace_sec.phase9_unit6g_candidate_active(
  p_candidate public.image_extraction_candidates
) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_candidate.review_disposition IS DISTINCT FROM 'skipped_false_detection'
    AND p_candidate.review_disposition IS DISTINCT FROM 'owner_removed_from_scan'
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_needs_review(
  p_candidate public.image_extraction_candidates,
  p_session public.image_extraction_sessions,
  p_as_of timestamptz DEFAULT transaction_timestamp()
) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT p_session.created_by=auth.uid()
    AND p_session.status IN ('active','closing','closed')
    AND p_candidate.expires_at>p_as_of
    AND marketplace_sec.phase9_unit6g_candidate_active(p_candidate)
    AND (
      p_candidate.state IN ('needs_review','possible_duplicate','failed')
      OR (p_candidate.state='ready' AND
        (p_candidate.review_disposition IS NULL OR NOT p_candidate.review_ready))
    )
$$;

CREATE FUNCTION marketplace_sec.phase9_unit6g_removal_fence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.review_disposition='owner_removed_from_scan'
    AND NEW.review_disposition IS DISTINCT FROM OLD.review_disposition
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER phase9_unit6g_removal_fence
BEFORE UPDATE OF review_disposition ON public.image_extraction_candidates
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_unit6g_removal_fence();

-- Preserve the applied v2 Close function byte-for-byte. Nullable Unit 6G
-- sessions may close only through v3, which marks its transaction explicitly.
CREATE FUNCTION marketplace_sec.phase9_unit6g_nullable_close_fence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'closed' AND NEW.status='closed'
    AND OLD.default_condition IS NULL
    AND current_setting('app.phase9_close_contract',true) IS DISTINCT FROM 'v3'
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER phase9_unit6g_nullable_close_fence
BEFORE UPDATE OF status ON public.image_extraction_sessions
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_unit6g_nullable_close_fence();

CREATE FUNCTION marketplace_sec.phase9_unit6g_defaults(
  p_session public.image_extraction_sessions
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'languageHint',p_session.selected_language,
    'condition',p_session.default_condition,
    'location',p_session.default_location,
    'priceMinor',p_session.default_price_minor,
    'quantity',1,
    'publication',p_session.default_publication,
    'script',p_session.selected_script
  )
$$;

CREATE FUNCTION marketplace_sec.phase9_unit6g_close_summary(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_owner_ux_close_summary(p_session_id)
    || jsonb_build_object('ownerRemovedCandidates',(
      SELECT count(*) FROM public.image_extraction_candidates c
      WHERE c.session_id=p_session_id
        AND c.review_disposition='owner_removed_from_scan'
    ))
$$;

CREATE FUNCTION public.phase9_start_session_v2(
  p_language_hint text,p_condition text,p_location text,p_price_minor integer,
  p_publication text,p_batch_label text,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_actor uuid:=auth.uid(); v_session public.image_extraction_sessions;
  v_fingerprint text; v_replay jsonb; v_label text; v_location text;
BEGIN
  v_store:=marketplace_sec.phase9_owner_store(NULL);
  v_label:=CASE WHEN p_batch_label IS NULL OR btrim(p_batch_label)='' THEN NULL
    ELSE normalize(btrim(p_batch_label),NFC) END;
  v_location:=normalize(btrim(p_location),NFC);
  IF p_language_hint !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    OR (p_condition IS NOT NULL AND p_condition NOT IN
      ('new','like_new','very_good','good','acceptable'))
    OR char_length(v_location) NOT BETWEEN 1 AND 120
    OR v_location ~ '[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]'
    OR (p_price_minor IS NOT NULL AND p_price_minor NOT BETWEEN 0 AND 2147483647)
    OR p_publication NOT IN ('private','publish')
    OR (v_label IS NOT NULL AND (char_length(v_label)>80
      OR v_label ~ '[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]'))
    OR p_command_id IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',v_store,p_language_hint,
    coalesce(p_condition,'<null>'),v_location,coalesce(p_price_minor::text,'<null>'),
    p_publication,coalesce(v_label,'<null>'),p_command_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(v_actor::text,'U6GC01',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO public.image_extraction_sessions(
    store_id,created_by,selected_language,selected_script,default_condition,
    default_location,default_price_minor,default_quantity,default_publication,batch_label
  ) VALUES(v_store,v_actor,p_language_hint,NULL,p_condition,v_location,p_price_minor,1,
    p_publication,v_label) RETURNING * INTO v_session;
  v_replay:=jsonb_build_object(
    'sessionId',v_session.id,'sessionVersion',v_session.version,
    'defaults',marketplace_sec.phase9_unit6g_defaults(v_session),
    'batchLabel',v_session.batch_label);
  PERFORM marketplace_sec.phase9_finish_replay(v_actor::text,'U6GC01',
    p_idempotency_key,v_replay,'unit6g_session_created');
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,source,command_id,payload
  ) VALUES(v_store,'session.started','image_extraction_session',v_session.id,v_actor,
    'store_owner_app',p_command_id,jsonb_build_object(
      'commandId',p_command_id,'conditionSet',p_condition IS NOT NULL,
      'priceSet',p_price_minor IS NOT NULL,'batchLabelSet',v_label IS NOT NULL));
  RETURN v_replay;
END$$;

CREATE FUNCTION public.phase9_owner_session_summary_v3(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; v_terminal boolean; v_close text;
BEGIN
  v:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  v_terminal:=NOT EXISTS(SELECT 1 FROM public.image_extraction_inputs i
    WHERE i.session_id=v.id AND i.state NOT IN ('ready','failed','skipped'));
  v_close:=CASE WHEN v.status='closed' THEN 'closed' WHEN v.status='expired' THEN 'expired'
    WHEN v.status='active' AND v_terminal THEN 'closeable' ELSE 'not_closeable' END;
  RETURN jsonb_build_object(
    'sessionId',v.id,'status',v.status,'sessionVersion',v.version,
    'startedAt',v.started_at,'updatedAt',v.updated_at,'closedAt',v.closed_at,
    'expiresAt',v.expires_at,'defaults',marketplace_sec.phase9_unit6g_defaults(v),
    'batchLabel',v.batch_label,
    'closeSummary',marketplace_sec.phase9_unit6g_close_summary(v.id),
    'allInputsTerminal',v_terminal,'closeState',v_close,
    'presentationRevision',v.presentation_revision);
END$$;

CREATE FUNCTION marketplace_sec.phase9_unit6g_field_sources(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates,
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_review jsonb:=p_detail#>'{review,value}'; v_selected boolean;
BEGIN
  v_selected:=p_detail#>>'{metadata,state}'='selected';
  RETURN jsonb_build_object(
    'cover',CASE WHEN p_detail#>>'{metadata,snapshot,coverReference}' IS NOT NULL
      THEN 'matched' ELSE 'missing' END,
    'title',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN v_selected AND v_review->>'originalTitle'=p_detail#>>'{metadata,snapshot,title}'
          THEN 'matched'
        WHEN v_review->>'originalTitle'=p_candidate.observed_title THEN 'detected'
        ELSE 'custom' END
      WHEN v_selected THEN 'matched'
      WHEN p_candidate.observed_title IS NOT NULL THEN 'detected' ELSE 'missing' END,
    'authors',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN v_selected AND v_review->'authors'=p_detail#>'{metadata,snapshot,authors}'
          THEN 'matched'
        WHEN v_review->'authors'=to_jsonb(p_candidate.observed_authors) THEN 'detected'
        ELSE 'custom' END
      WHEN v_selected THEN 'matched'
      WHEN cardinality(p_candidate.observed_authors)>0 THEN 'detected' ELSE 'missing' END,
    'language',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN v_selected AND v_review->>'originalLanguage'=p_detail#>>'{metadata,snapshot,language}'
          THEN 'matched'
        WHEN v_review->>'originalLanguage'=p_candidate.observed_language THEN 'detected'
        WHEN v_review->>'originalLanguage'=p_session.selected_language THEN 'default'
        ELSE 'custom' END
      WHEN v_selected THEN 'matched'
      WHEN p_candidate.observed_language IS NOT NULL THEN 'detected'
      WHEN p_session.selected_language IS NOT NULL THEN 'default' ELSE 'missing' END,
    'condition',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN p_session.default_condition IS NOT NULL
          AND v_review->>'baseCondition'=p_session.default_condition THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_condition IS NOT NULL THEN 'default' ELSE 'missing' END,
    'price',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN p_session.default_price_minor IS NOT NULL
          AND (v_review->>'priceMinor')::integer=p_session.default_price_minor THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_price_minor IS NOT NULL THEN 'default' ELSE 'missing' END,
    'quantity',CASE WHEN v_review IS NOT NULL AND (v_review->>'quantity')::integer<>1
      THEN 'custom' ELSE 'default' END,
    'location',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN v_review->>'shelfLocation'=p_session.default_location THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_location IS NOT NULL THEN 'default' ELSE 'missing' END,
    'publication',CASE WHEN v_review IS NOT NULL THEN CASE
        WHEN v_review->>'publicationIntent'=p_session.default_publication THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_publication IS NOT NULL THEN 'default' ELSE 'missing' END,
    'damage',CASE WHEN v_review IS NOT NULL AND (v_review#>>'{damageDisclosure,hasDamage}')::boolean
      THEN 'custom' ELSE 'default' END);
END$$;

CREATE FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_detail jsonb; v_metadata jsonb; v_actions jsonb;
BEGIN
  v_detail:=marketplace_sec.phase9_owner_ux_candidate_detail(p_session,p_candidate);
  v_metadata:=CASE WHEN v_detail#>>'{metadata,state}'='selected' THEN
    jsonb_build_object(
      'title',v_detail#>'{metadata,snapshot,title}',
      'authors',v_detail#>'{metadata,snapshot,authors}',
      'language',v_detail#>'{metadata,snapshot,language}',
      'coverReference',v_detail#>'{metadata,snapshot,coverReference}')
    ELSE NULL END;
  v_actions:=jsonb_build_array('view_metadata','remove_from_scan','view_readiness');
  IF p_candidate.state IN ('ready','needs_review','possible_duplicate') THEN
    v_actions:=v_actions||'"save_review"'::jsonb;
  END IF;
  IF p_candidate.review_ready AND p_candidate.review_disposition='reviewed'
    AND p_candidate.state='ready' THEN
    v_actions:=v_actions||'"add_to_inventory"'::jsonb;
  END IF;
  RETURN jsonb_build_object(
    'sessionId',p_session.id,'candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'ordinal',p_candidate.candidate_index,'candidateState',p_candidate.state,
    'candidateVersion',p_candidate.version,
    'metadataState',v_detail#>'{metadata,state}',
    'metadataRevision',p_candidate.metadata_revision,
    'reviewVersion',p_candidate.review_version,
    'reviewDisposition',p_candidate.review_disposition,
    'observed',v_detail->'observed','metadataSummary',v_metadata,
    'review',v_detail#>'{review,value}',
    'fieldSources',marketplace_sec.phase9_unit6g_field_sources(p_session,p_candidate,v_detail),
    'attentionCodes',v_detail->'attentionCodes',
    'blockers',v_detail#>'{readiness,blockers}',
    'reviewReady',p_candidate.review_ready,'allowedActions',v_actions,
    'updatedAt',p_candidate.updated_at);
END$$;

CREATE FUNCTION public.phase9_owner_batch_review_v1(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_counts jsonb; v_items jsonb;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT jsonb_build_object(
    'detected',count(*),
    'processing',count(*) FILTER(WHERE marketplace_sec.phase9_unit6g_candidate_active(c)
      AND c.state='processing'),
    'needsAttention',count(*) FILTER(WHERE marketplace_sec.phase9_unit6g_candidate_active(c)
      AND c.state NOT IN ('processing','commit_in_progress','committed') AND NOT c.review_ready),
    'reviewReadySaved',count(*) FILTER(WHERE marketplace_sec.phase9_unit6g_candidate_active(c)
      AND c.review_ready AND c.state='ready'),
    'committed',count(*) FILTER(WHERE c.state='committed'),
    'ownerRemoved',count(*) FILTER(WHERE c.review_disposition='owner_removed_from_scan'),
    'falseDetections',count(*) FILTER(WHERE c.review_disposition='skipped_false_detection'))
  INTO v_counts FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id;
  SELECT coalesce(jsonb_agg(marketplace_sec.phase9_unit6g_batch_card(v_session,c)
    ORDER BY c.candidate_index,c.id),'[]'::jsonb) INTO v_items
  FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id
    AND marketplace_sec.phase9_unit6g_candidate_active(c)
    AND c.state<>'committed';
  RETURN jsonb_build_object(
    'sessionId',v_session.id,'status',v_session.status,
    'sessionVersion',v_session.version,
    'presentationRevision',v_session.presentation_revision,
    'defaults',marketplace_sec.phase9_unit6g_defaults(v_session),
    'batchLabel',v_session.batch_label,'counts',v_counts,'items',v_items,
    'updatedAt',v_session.updated_at);
END$$;

CREATE FUNCTION public.phase9_owner_remove_candidate_v1(
  p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_fingerprint text; v_replay jsonb; v_response jsonb; v_old text;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id FOR UPDATE;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF p_expected_candidate_version<1 OR p_command_id IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,p_candidate_id,
    p_expected_candidate_version,p_command_id),'sha256'),'hex');
  -- phase9_replay raises P9_IDEMPOTENCY_MISMATCH for a changed fingerprint.
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U6GC02',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
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
  SELECT * INTO v_session FROM public.image_extraction_sessions s WHERE s.id=p_session_id;
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

CREATE FUNCTION marketplace_sec.phase9_owner_ux_readiness_v3(
  p_session public.image_extraction_sessions
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_terminal boolean; v_counts jsonb; v_next uuid; v_close text; v_allowed boolean;
BEGIN
  v_terminal:=NOT EXISTS(SELECT 1 FROM public.image_extraction_inputs i
    WHERE i.session_id=p_session.id AND i.state NOT IN ('ready','failed','skipped'));
  WITH candidate_blockers AS (
    SELECT b->>'code' code,c.id,c.candidate_index
    FROM public.image_extraction_candidates c
    CROSS JOIN LATERAL jsonb_array_elements(
      marketplace_sec.phase9_owner_ux_review_blockers(c)) b
    WHERE c.session_id=p_session.id
      AND marketplace_sec.phase9_unit6g_candidate_active(c)
      AND c.state NOT IN ('commit_in_progress','committed')
  ), all_codes(code) AS (VALUES
    ('input_processing'),('candidate_processing'),('candidate_failed'),('review_missing'),
    ('title_unconfirmed'),('author_confirmation_incomplete'),('language_missing'),
    ('metadata_choice_missing'),('quantity_invalid'),('price_invalid'),('condition_missing'),
    ('damage_answer_missing'),('damage_details_missing'),('location_missing'),
    ('publication_intent_missing'),('duplicate_intent_missing'),('variant_source_stale')
  )
  SELECT jsonb_object_agg(a.code,
    CASE WHEN a.code='input_processing' THEN
      (SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session.id
        AND i.state NOT IN ('ready','failed','skipped'))
    ELSE (SELECT count(*) FROM candidate_blockers b WHERE b.code=a.code) END)
  INTO v_counts FROM all_codes a;
  SELECT c.id INTO v_next FROM public.image_extraction_candidates c
  WHERE c.session_id=p_session.id
    AND marketplace_sec.phase9_unit6g_candidate_active(c)
    AND c.state NOT IN ('commit_in_progress','committed')
    AND jsonb_array_length(marketplace_sec.phase9_owner_ux_review_blockers(c))>0
  ORDER BY c.candidate_index,c.id LIMIT 1;
  v_close:=CASE WHEN p_session.status='closed' THEN 'closed'
    WHEN p_session.status='expired' THEN 'expired'
    WHEN p_session.status='active' AND v_terminal THEN 'closeable' ELSE 'not_closeable' END;
  v_allowed:=p_session.status='active' AND v_terminal;
  RETURN jsonb_build_object(
    'sessionId',p_session.id,'sessionStatus',p_session.status,
    'sessionVersion',p_session.version,'allInputsTerminal',v_terminal,
    'closeSummary',marketplace_sec.phase9_unit6g_close_summary(p_session.id),
    'blockerCounts',v_counts,'nextBlockingCandidateId',v_next,
    'closeState',v_close,'closeAllowed',v_allowed,
    'presentationRevision',p_session.presentation_revision);
END$$;

CREATE FUNCTION public.phase9_close_session_v3(
  p_session_id uuid,p_expected_session_version integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_fingerprint text;
  v_replay jsonb; v_response jsonb;
BEGIN
  PERFORM marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_session FROM public.image_extraction_sessions s
    WHERE s.id=p_session_id FOR UPDATE;
  IF p_expected_session_version<1 OR p_command_id IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,
    p_expected_session_version,p_command_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U6GC03',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF v_session.status<>'active' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_session.version<>p_expected_session_version
    THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.image_extraction_inputs i
    WHERE i.session_id=p_session_id AND i.state NOT IN ('ready','failed','skipped'))
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  PERFORM set_config('app.phase9_close_contract','v3',true);
  UPDATE public.image_extraction_sessions SET
    status='closed',closed_at=transaction_timestamp(),version=version+1,
    presentation_revision=presentation_revision+1,updated_at=transaction_timestamp()
  WHERE id=p_session_id RETURNING * INTO v_session;
  SELECT * INTO v_session FROM public.image_extraction_sessions s WHERE s.id=p_session_id;
  v_response:=marketplace_sec.phase9_owner_ux_readiness_v3(v_session);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U6GC03',
    p_idempotency_key,v_response,'session_closed_no_unit7_effect');
  RETURN v_response;
END$$;

INSERT INTO public.marketplace_event_schema_registry(
  event_type,schema_version,entity_type,is_transition,privacy_classification
) VALUES('phase9.candidate.owner_removed_from_scan',1,
  'image_extraction_candidate',true,'internal')
ON CONFLICT(event_type,schema_version) DO NOTHING;

ALTER FUNCTION marketplace_sec.phase9_unit6g_candidate_active(
  public.image_extraction_candidates) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_removal_fence() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_nullable_close_fence() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_defaults(
  public.image_extraction_sessions) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_close_summary(uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_field_sources(
  public.image_extraction_sessions,public.image_extraction_candidates,jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_readiness_v3(
  public.image_extraction_sessions) OWNER TO postgres;
ALTER FUNCTION public.phase9_start_session_v2(
  text,text,text,integer,text,text,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_session_summary_v3(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_batch_review_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_remove_candidate_v1(
  uuid,uuid,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_close_session_v3(uuid,integer,text,uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_candidate_active(
  public.image_extraction_candidates) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_removal_fence()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_nullable_close_fence()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_defaults(
  public.image_extraction_sessions) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_close_summary(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_field_sources(
  public.image_extraction_sessions,public.image_extraction_candidates,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_readiness_v3(
  public.image_extraction_sessions) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.phase9_start_session_v2(
  text,text,text,integer,text,text,text,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.phase9_owner_session_summary_v3(uuid)
  FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.phase9_owner_batch_review_v1(uuid)
  FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.phase9_owner_remove_candidate_v1(
  uuid,uuid,integer,text,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.phase9_close_session_v3(uuid,integer,text,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_start_session_v2(
  text,text,text,integer,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_session_summary_v3(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_batch_review_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_remove_candidate_v1(
  uuid,uuid,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_close_session_v3(
  uuid,integer,text,uuid) TO authenticated;

COMMIT;
