-- Phase 9 M05: named Owner queries/commands, idempotent commits, and projection retry.
BEGIN;
CREATE FUNCTION marketplace_sec.phase9_is_store_owner(p_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.store_administrators sa JOIN public.stores s ON s.id=sa.store_id
  WHERE sa.store_id=p_store_id AND sa.user_id=auth.uid() AND sa.role='owner' AND sa.status='active'
    AND s.status='active' AND s.setup_status='complete' AND s.selling_status='allowed') $$;
CREATE FUNCTION marketplace_sec.phase9_owner_store(p_store_hint uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'P9_AUTH_REQUIRED'; END IF;
  SELECT sa.store_id INTO v_store FROM public.store_administrators sa JOIN public.stores s ON s.id=sa.store_id
  WHERE sa.user_id=auth.uid() AND sa.role='owner' AND sa.status='active' AND s.status='active'
    AND s.setup_status='complete' AND s.selling_status='allowed' AND (p_store_hint IS NULL OR sa.store_id=p_store_hint)
  ORDER BY sa.store_id LIMIT 1;
  IF v_store IS NULL THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF; RETURN v_store;
END$$;
CREATE FUNCTION marketplace_sec.phase9_assert_session_owner(p_session_id uuid)
RETURNS public.image_extraction_sessions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions;
BEGIN SELECT * INTO v FROM public.image_extraction_sessions WHERE id=p_session_id;
  IF v.id IS NULL OR v.created_by IS DISTINCT FROM auth.uid() OR NOT marketplace_sec.phase9_is_store_owner(v.store_id)
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF; RETURN v; END$$;
CREATE FUNCTION marketplace_sec.phase9_replay(p_actor text,p_operation text,p_key text,p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.phase9_idempotency_keys; v_inserted uuid;
BEGIN INSERT INTO public.phase9_idempotency_keys(actor_or_service,operation,idempotency_key,request_fingerprint)
  VALUES(p_actor,p_operation,p_key,p_fingerprint)
  ON CONFLICT(actor_or_service,operation,idempotency_key) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.phase9_idempotency_keys WHERE actor_or_service=p_actor
    AND operation=p_operation AND idempotency_key=p_key FOR UPDATE;
  IF v.request_fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  IF v.status='completed' THEN RETURN v.canonical_response; END IF; RAISE EXCEPTION 'P9_STATE_CONFLICT'; END$$;
CREATE FUNCTION marketplace_sec.phase9_finish_replay(p_actor text,p_operation text,p_key text,p_response jsonb,p_effect text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ UPDATE public.phase9_idempotency_keys
 SET status='completed',canonical_response=p_response,surviving_effect=p_effect,updated_at=transaction_timestamp()
 WHERE actor_or_service=p_actor AND operation=p_operation AND idempotency_key=p_key $$;
CREATE FUNCTION public.phase9_start_session(p_store_hint uuid,p_language text,p_script text,p_condition text,
  p_location text,p_quantity integer,p_publication text,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_actor uuid:=auth.uid(); v_id uuid; v_replay jsonb;
BEGIN v_store:=marketplace_sec.phase9_owner_store(p_store_hint);
  IF p_language !~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})*$' OR p_condition NOT IN
    ('new','like_new','very_good','good','acceptable') OR coalesce(char_length(p_location),0)<1
    OR p_quantity NOT BETWEEN 1 AND 1000 OR p_publication NOT IN ('private','publish')
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_replay:=marketplace_sec.phase9_replay(v_actor::text,'C01',p_idempotency_key,
    concat_ws('|',v_store,p_language,p_script,p_condition,p_location,p_quantity,p_publication));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'session_id')::uuid; END IF;
  INSERT INTO public.image_extraction_sessions(store_id,created_by,selected_language,selected_script,
    default_condition,default_location,default_quantity,default_publication)
  VALUES(v_store,v_actor,p_language,p_script,p_condition,p_location,p_quantity,p_publication) RETURNING id INTO v_id;
  PERFORM marketplace_sec.phase9_finish_replay(v_actor::text,'C01',p_idempotency_key,
    jsonb_build_object('session_id',v_id),'session_created');
  INSERT INTO public.marketplace_events(store_id,event_type,entity_type,entity_id,actor_user_id,payload)
  VALUES(v_store,'session.started','image_extraction_session',v_id,v_actor,jsonb_build_object('command_id',p_command_id));
  RETURN v_id; END$$;
CREATE FUNCTION public.phase9_owner_session_summary(p_session_id uuid)
RETURNS TABLE(id uuid,store_id uuid,selected_language text,status text,version integer,input_count integer,
  candidate_count integer,committed_count integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; BEGIN v:=marketplace_sec.phase9_assert_session_owner(p_session_id);
  RETURN QUERY SELECT v.id,v.store_id,v.selected_language,v.status,v.version,v.input_count,v.candidate_count,v.committed_count; END$$;
CREATE FUNCTION public.phase9_owner_session_candidates(p_session_id uuid)
RETURNS TABLE(id uuid,candidate_index smallint,observed_title text,state text,version integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM marketplace_sec.phase9_assert_session_owner(p_session_id); RETURN QUERY SELECT c.id,
  c.candidate_index,c.observed_title,c.state,c.version FROM public.image_extraction_candidates c
  WHERE c.session_id=p_session_id ORDER BY c.candidate_index,c.id; END$$;
CREATE FUNCTION public.phase9_authorize_upload(p_entity_id uuid,p_purpose text,p_bucket text,p_path text,
  p_envelope_sha256 text,p_ordinal integer,p_expires_at timestamptz,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; v_id uuid; v_actor uuid:=auth.uid(); v_replay jsonb;
BEGIN IF p_purpose<>'scan_input' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v:=marketplace_sec.phase9_assert_session_owner(p_entity_id);
  IF v.status<>'active' OR p_bucket<>'marketplace-media-staging' OR
    p_path NOT LIKE v.store_id::text||'/scan_input/'||v.id::text||'/%' OR p_ordinal NOT BETWEEN 1 AND 15
    OR p_expires_at<=transaction_timestamp() THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_replay:=marketplace_sec.phase9_replay(v_actor::text,'C02',p_idempotency_key,
    concat_ws('|',p_entity_id,p_purpose,p_bucket,p_path,p_envelope_sha256,p_ordinal));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'capability_id')::uuid; END IF;
  INSERT INTO public.phase9_upload_capabilities(store_id,issued_to_user_id,initiating_owner_user_id,purpose,
    bound_entity_type,bound_entity_id,bound_session_id,bound_ordinal,bucket_id,object_path,envelope_sha256,
    nonce_hash,expires_at) VALUES(v.store_id,v_actor,v.created_by,p_purpose,'session',v.id,v.id,p_ordinal,
    p_bucket,p_path,p_envelope_sha256,p_idempotency_key,p_expires_at) RETURNING id INTO v_id;
  PERFORM marketplace_sec.phase9_finish_replay(v_actor::text,'C02',p_idempotency_key,
    jsonb_build_object('capability_id',v_id),'capability_issued'); RETURN v_id; END$$;
CREATE FUNCTION marketplace_sec.phase9_consume_upload_capability(p_capability_id uuid,p_purpose text,p_entity_id uuid,
  p_bucket text,p_path text,p_envelope_sha256 text,p_media_asset_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.phase9_upload_capabilities;
BEGIN SELECT * INTO v FROM public.phase9_upload_capabilities WHERE id=p_capability_id FOR UPDATE;
  IF v.id IS NULL OR v.issued_to_user_id<>auth.uid() OR v.status<>'issued' OR v.expires_at<=transaction_timestamp()
    OR v.purpose<>p_purpose OR v.bound_entity_id<>p_entity_id OR v.bucket_id<>p_bucket OR v.object_path<>p_path
    OR v.envelope_sha256<>p_envelope_sha256 OR NOT marketplace_sec.phase9_is_store_owner(v.store_id)
    OR NOT EXISTS(SELECT 1 FROM public.media_assets m WHERE m.id=p_media_asset_id AND m.store_id=v.store_id
      AND m.purpose=p_purpose AND m.bucket_id=p_bucket AND m.object_path=p_path AND m.sha256=p_envelope_sha256)
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  UPDATE public.phase9_upload_capabilities SET status='consumed',consumed_at=transaction_timestamp(),
    consumed_media_asset_id=p_media_asset_id,version=version+1,updated_at=transaction_timestamp() WHERE id=p_capability_id;
  RETURN p_media_asset_id; END$$;
CREATE FUNCTION public.phase9_accept_scan_input(p_session_id uuid,p_capability_id uuid,p_media_asset_id uuid,
  p_source_kind text,p_orchestration_version text,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap public.phase9_upload_capabilities; v_media public.media_assets; v_input uuid; v_job uuid; v_replay jsonb;
BEGIN PERFORM marketplace_sec.phase9_assert_session_owner(p_session_id);
  IF p_source_kind NOT IN ('camera','gallery') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C03',p_idempotency_key,
    concat_ws('|',p_session_id,p_capability_id,p_media_asset_id,p_source_kind,p_orchestration_version));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'input_id')::uuid; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id;
  SELECT * INTO v_media FROM public.media_assets WHERE id=p_media_asset_id;
  PERFORM marketplace_sec.phase9_consume_upload_capability(p_capability_id,'scan_input',p_session_id,
    v_cap.bucket_id,v_cap.object_path,v_cap.envelope_sha256,p_media_asset_id);
  INSERT INTO public.image_extraction_inputs(session_id,store_id,media_asset_id,source_kind,state,sha256,
    orchestration_version) VALUES(p_session_id,v_cap.store_id,p_media_asset_id,p_source_kind,'queued',
    v_media.sha256,p_orchestration_version) RETURNING id INTO v_input;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES(v_cap.store_id,'input',v_input,'vision_extract','vision:'||v_input::text,p_orchestration_version)
    RETURNING id INTO v_job;
  INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,operation,
    idempotency_identity,reserved_cost_units) VALUES(v_cap.store_id,v_job,'vision',1,'extract',p_idempotency_key,1);
  UPDATE public.image_extraction_sessions SET input_count=input_count+1,updated_at=transaction_timestamp()
    WHERE id=p_session_id;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C03',p_idempotency_key,
    jsonb_build_object('input_id',v_input,'job_id',v_job),'input_job_cost_created'); RETURN v_input;
END$$;
CREATE FUNCTION public.phase9_close_session(p_session_id uuid,p_expected_version integer,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; v_replay jsonb; BEGIN v:=marketplace_sec.phase9_assert_session_owner(p_session_id);
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C04',p_idempotency_key,concat_ws('|',p_session_id,p_expected_version)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'session_id')::uuid; END IF;
  IF v.status<>'active' OR v.version<>p_expected_version OR EXISTS(SELECT 1 FROM public.image_extraction_inputs
    WHERE session_id=p_session_id AND state NOT IN ('ready','failed','skipped')) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.image_extraction_sessions SET status='closed',closed_at=transaction_timestamp(),version=version+1,
    updated_at=transaction_timestamp() WHERE id=p_session_id; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C04',p_idempotency_key,jsonb_build_object('session_id',p_session_id),'session_closed'); RETURN p_session_id; END$$;
CREATE FUNCTION public.phase9_add_manual_candidate(p_session_id uuid,p_title text,p_authors text[],p_language text,
  p_idempotency_key text,p_command_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; v_id uuid; v_index smallint; v_replay jsonb;
BEGIN v:=marketplace_sec.phase9_assert_session_owner(p_session_id);
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C06',p_idempotency_key,concat_ws('|',p_session_id,p_title,p_authors,p_language)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'candidate_id')::uuid; END IF;
  IF v.status NOT IN ('active','closed') OR coalesce(char_length(p_title),0)<1 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT coalesce(max(candidate_index),0)+1 INTO v_index FROM public.image_extraction_candidates WHERE session_id=p_session_id;
  IF v_index>15 THEN RAISE EXCEPTION 'P9_LIMIT_EXCEEDED'; END IF;
  INSERT INTO public.image_extraction_candidates(session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,selected_snapshot) VALUES(p_session_id,v.store_id,v_index,p_title,p_authors,p_language,
    'needs_review','{}') RETURNING id INTO v_id;
  UPDATE public.image_extraction_sessions SET candidate_count=candidate_count+1 WHERE id=p_session_id; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C06',p_idempotency_key,jsonb_build_object('candidate_id',v_id),'manual_candidate_created'); RETURN v_id; END$$;
CREATE FUNCTION public.phase9_update_candidate_review(p_candidate_id uuid,p_expected_version integer,p_snapshot jsonb,
  p_idempotency_key text,p_command_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session uuid; v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C05',p_idempotency_key,concat_ws('|',p_candidate_id,p_expected_version,p_snapshot)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'candidate_id')::uuid; END IF; SELECT session_id INTO v_session FROM public.image_extraction_candidates WHERE id=p_candidate_id;
  PERFORM marketplace_sec.phase9_assert_session_owner(v_session); UPDATE public.image_extraction_candidates
  SET owner_review_snapshot=p_snapshot,review_disposition='reviewed',state='ready',version=version+1,
    updated_at=transaction_timestamp() WHERE id=p_candidate_id AND version=p_expected_version
    AND state IN ('ready','needs_review','possible_duplicate');
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C05',p_idempotency_key,jsonb_build_object('candidate_id',p_candidate_id),'candidate_reviewed'); RETURN p_candidate_id; END$$;
CREATE FUNCTION public.phase9_skip_candidate(p_candidate_id uuid,p_expected_version integer,p_reason text,
  p_idempotency_key text,p_command_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session uuid; v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C07',p_idempotency_key,concat_ws('|',p_candidate_id,p_expected_version,p_reason)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'candidate_id')::uuid; END IF; SELECT session_id INTO v_session FROM public.image_extraction_candidates WHERE id=p_candidate_id;
  PERFORM marketplace_sec.phase9_assert_session_owner(v_session); UPDATE public.image_extraction_candidates
  SET review_disposition='skipped_false_detection',selected_snapshot=jsonb_set(selected_snapshot,'{skip_reason}',to_jsonb(p_reason)),
    version=version+1,updated_at=transaction_timestamp() WHERE id=p_candidate_id AND version=p_expected_version
    AND state IN ('ready','needs_review','possible_duplicate');
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C07',p_idempotency_key,jsonb_build_object('candidate_id',p_candidate_id),'candidate_skipped'); RETURN p_candidate_id; END$$;
CREATE FUNCTION marketplace_sec.phase9_project_inventory(p_inventory_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; v_listing uuid;
BEGIN SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id FOR UPDATE;
  IF v.id IS NULL OR NOT v.is_sellable OR v.selling_price_minor<=0 OR v.quantity_available<=0 OR (v.has_damage AND
    (coalesce(char_length(v.damage_notes),0)=0 OR (SELECT count(*) FROM public.inventory_media_links
      WHERE inventory_id=v.id AND approval_status='approved') NOT BETWEEN 1 AND 3)) THEN RAISE EXCEPTION 'P9_PUBLICATION_FAILED'; END IF;
  UPDATE public.store_inventory SET visibility_status='published',publication_status='publication_pending',
    publication_intent_version=publication_intent_version+1 WHERE id=v.id;
  SELECT id INTO v_listing FROM public.marketplace_book_listings WHERE inventory_id=v.id;
  IF v_listing IS NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_FAILED'; END IF;
  UPDATE public.store_inventory SET publication_status='published' WHERE id=v.id; RETURN v_listing; END$$;
CREATE FUNCTION public.phase9_commit_candidate(p_candidate_id uuid,p_expected_version integer,p_action text,
  p_target_inventory_id uuid,p_quantity integer,p_price_paise integer,p_condition text,p_has_damage boolean,
  p_damage_types text[],p_damage_note text,p_sellable boolean,p_idempotency_key text,p_command_id uuid)
RETURNS TABLE(inventory_id uuid,listing_id uuid,outcome text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_c public.image_extraction_candidates; v_s public.image_extraction_sessions; v_inventory uuid; v_outcome text;
  v_operation text; v_replay jsonb;
BEGIN v_operation:=CASE p_action WHEN 'create_private' THEN 'C08' WHEN 'increment_match' THEN 'C09'
    WHEN 'create_separate' THEN 'C10' END;
  IF v_operation IS NULL THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,v_operation,p_idempotency_key,
    concat_ws('|',p_candidate_id,p_expected_version,p_action,p_target_inventory_id,p_quantity,p_price_paise,
      p_condition,p_has_damage,p_damage_types,p_damage_note,p_sellable));
  IF v_replay IS NOT NULL THEN RETURN QUERY SELECT (v_replay->>'inventory_id')::uuid,
    (v_replay->>'listing_id')::uuid,v_replay->>'outcome'; RETURN; END IF;
  SELECT * INTO v_c FROM public.image_extraction_candidates WHERE id=p_candidate_id FOR UPDATE;
  v_s:=marketplace_sec.phase9_assert_session_owner(v_c.session_id);
  IF v_c.state='committed' THEN IF v_c.commit_idempotency_key=p_idempotency_key THEN RETURN QUERY
    SELECT v_c.committed_inventory_id,v_c.committed_listing_id,v_c.commit_outcome; RETURN; END IF;
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_c.version<>p_expected_version OR v_c.state<>'ready'
    OR v_c.review_disposition IS DISTINCT FROM 'reviewed' OR p_quantity<1
    OR p_price_paise<0 OR p_condition NOT IN ('new','like_new','very_good','good','acceptable') OR (p_has_damage AND
    (coalesce(array_length(p_damage_types,1),0)<1 OR coalesce(char_length(p_damage_note),0)<1))
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_action='increment_match' THEN UPDATE public.store_inventory SET quantity_total=quantity_total+p_quantity,
    quantity_available=quantity_available+p_quantity,version=version+1 WHERE id=p_target_inventory_id
    AND store_id=v_s.store_id AND condition=p_condition AND selling_price_minor=p_price_paise AND NOT has_damage AND NOT p_has_damage
    RETURNING id INTO v_inventory; IF v_inventory IS NULL THEN RAISE EXCEPTION 'P9_DUPLICATE_TARGET_CHANGED'; END IF;
    v_outcome:='quantity_incremented';
  ELSIF p_action IN ('create_private','create_separate') THEN INSERT INTO public.store_inventory(id,store_id,title,authors,
    language,condition,selling_price_minor,shelf_location,quantity_total,quantity_available,has_damage,damage_types,damage_notes,
    is_sellable,created_from_candidate_id,visibility_status,publication_status,created_by) VALUES(gen_random_uuid(),v_s.store_id,
    v_c.observed_title,v_c.observed_authors,v_c.observed_language,p_condition,p_price_paise,v_s.default_location,p_quantity,
    p_quantity,p_has_damage,p_damage_types,nullif(p_damage_note,''),p_sellable,v_c.id,'draft','private',auth.uid()) RETURNING id INTO v_inventory;
    v_outcome:=CASE WHEN p_action='create_separate' THEN 'created_separate' ELSE 'committed_private' END;
  ELSE RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  UPDATE public.image_extraction_candidates SET state='committed',committed_inventory_id=v_inventory,
    commit_idempotency_key=p_idempotency_key,commit_outcome=v_outcome,version=version+1 WHERE id=v_c.id;
  UPDATE public.image_extraction_sessions SET committed_count=committed_count+1 WHERE id=v_s.id;
  INSERT INTO public.marketplace_audit_logs(store_id,action,entity_type,entity_id,actor_user_id,details)
  VALUES(v_s.store_id,'phase9.candidate_commit','store_inventory',v_inventory,auth.uid(),
    jsonb_build_object('candidate_id',v_c.id,'action',p_action,'command_id',p_command_id));
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,v_operation,p_idempotency_key,
    jsonb_build_object('inventory_id',v_inventory,'listing_id',NULL,'outcome',v_outcome),'private_commit');
  RETURN QUERY SELECT v_inventory,NULL::uuid,v_outcome; END$$;
CREATE FUNCTION public.phase9_request_publication(p_inventory_id uuid,p_expected_version integer,p_idempotency_key text,p_command_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_replay jsonb; v_outcome text; v_store uuid; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C11',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_version)); IF v_replay IS NOT NULL THEN RETURN v_replay->>'outcome'; END IF; IF NOT EXISTS(SELECT 1 FROM public.store_inventory i WHERE i.id=p_inventory_id AND i.version=p_expected_version
  AND marketplace_sec.phase9_is_store_owner(i.store_id)) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  BEGIN PERFORM marketplace_sec.phase9_project_inventory(p_inventory_id); v_outcome:='published'; EXCEPTION WHEN OTHERS THEN
  UPDATE public.store_inventory SET publication_status='publication_failed' WHERE id=p_inventory_id RETURNING store_id INTO v_store;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES(v_store,'store_inventory',p_inventory_id,'publication_retry',
      'publication-retry:'||p_inventory_id::text||':'||p_expected_version::text,p_expected_version::text)
    ON CONFLICT(dedupe_key) DO NOTHING;
  v_outcome:='committed_publication_failed'; END; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C11',p_idempotency_key,jsonb_build_object('outcome',v_outcome),'projection_only'); RETURN v_outcome; END$$;
CREATE FUNCTION public.phase9_retry_publication(p_inventory_id uuid,p_expected_intent_version integer,
  p_idempotency_key text,p_command_id uuid,p_worker text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; v_job public.image_extraction_jobs; v_replay jsonb; v_actor text:=coalesce(auth.uid()::text,'worker:'||p_worker);
BEGIN v_replay:=marketplace_sec.phase9_replay(v_actor,'C12',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_intent_version,p_worker)); IF v_replay IS NOT NULL THEN RETURN v_replay->>'outcome'; END IF; SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id FOR UPDATE;
  IF v.id IS NULL OR v.publication_intent_version<>p_expected_intent_version THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF auth.role()='service_role' THEN SELECT * INTO v_job FROM public.image_extraction_jobs
    WHERE entity_id=p_inventory_id AND job_kind='publication_retry' AND status='in_progress'
      AND store_id=v.store_id AND entity_type='store_inventory'
      AND operation_version=p_expected_intent_version::text
      AND lease_owner=p_worker AND lease_expires_at>transaction_timestamp() FOR UPDATE;
    IF v_job.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  ELSIF NOT marketplace_sec.phase9_is_store_owner(v.store_id) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  PERFORM marketplace_sec.phase9_project_inventory(p_inventory_id);
  IF v_job.id IS NOT NULL THEN UPDATE public.image_extraction_jobs SET status='resolved',
    completed_at=transaction_timestamp(),lease_owner=NULL,lease_expires_at=NULL,updated_at=transaction_timestamp()
    WHERE id=v_job.id; END IF;
  PERFORM marketplace_sec.phase9_finish_replay(v_actor,'C12',p_idempotency_key,jsonb_build_object('outcome','published'),'projection_only'); RETURN 'published'; END$$;
CREATE FUNCTION public.phase9_mark_candidate_needs_review(p_candidate_id uuid,p_expected_version integer,p_reason text,
  p_idempotency_key text,p_command_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session uuid; v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C13',p_idempotency_key,concat_ws('|',p_candidate_id,p_expected_version,p_reason)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'candidate_id')::uuid; END IF; SELECT session_id INTO v_session FROM public.image_extraction_candidates WHERE id=p_candidate_id;
  PERFORM marketplace_sec.phase9_assert_session_owner(v_session); UPDATE public.image_extraction_candidates
  SET state='needs_review',selected_snapshot=jsonb_set(selected_snapshot,'{needs_review_reason}',to_jsonb(p_reason)),
    version=version+1 WHERE id=p_candidate_id AND version=p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C13',p_idempotency_key,jsonb_build_object('candidate_id',p_candidate_id),'needs_review_marked'); RETURN p_candidate_id; END$$;
CREATE FUNCTION public.phase9_authorize_public_copy_upload(p_inventory_id uuid,p_role text,p_ordinal integer,
  p_bucket text,p_path text,p_envelope_sha256 text,p_expires_at timestamptz,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; v_id uuid; v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C20',p_idempotency_key,concat_ws('|',p_inventory_id,p_role,p_ordinal,p_bucket,p_path,p_envelope_sha256,p_expires_at)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'capability_id')::uuid; END IF; SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id) OR p_bucket<>'marketplace-media-staging'
    OR p_path NOT LIKE v.store_id::text||'/public_copy/'||v.id::text||'/%' OR p_ordinal NOT BETWEEN 1 AND 3
    OR p_role NOT IN ('damage','actual_copy','primary_fallback') THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  INSERT INTO public.phase9_upload_capabilities(store_id,issued_to_user_id,initiating_owner_user_id,purpose,
    bound_entity_type,bound_entity_id,bound_ordinal,bucket_id,object_path,envelope_sha256,nonce_hash,expires_at)
  VALUES(v.store_id,auth.uid(),auth.uid(),'public_copy','inventory',v.id,p_ordinal,p_bucket,p_path,
    p_envelope_sha256,p_idempotency_key,p_expires_at) RETURNING id INTO v_id; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C20',p_idempotency_key,jsonb_build_object('capability_id',v_id),'capability_issued'); RETURN v_id; END$$;
CREATE FUNCTION public.phase9_submit_public_copy_media(p_inventory_id uuid,p_capability_id uuid,p_media_asset_id uuid,
  p_role text,p_order smallint,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.phase9_upload_capabilities; v_link uuid; v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C21',p_idempotency_key,concat_ws('|',p_inventory_id,p_capability_id,p_media_asset_id,p_role,p_order)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'media_link_id')::uuid; END IF; SELECT * INTO v FROM public.phase9_upload_capabilities WHERE id=p_capability_id;
  PERFORM marketplace_sec.phase9_consume_upload_capability(p_capability_id,'public_copy',p_inventory_id,v.bucket_id,v.object_path,
    v.envelope_sha256,p_media_asset_id); INSERT INTO public.inventory_media_links(store_id,inventory_id,media_asset_id,role,
    public_order,approval_status,approved_by,approved_at) VALUES(v.store_id,p_inventory_id,p_media_asset_id,p_role,p_order,
    'approved',auth.uid(),transaction_timestamp()) RETURNING id INTO v_link; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C21',p_idempotency_key,jsonb_build_object('media_link_id',v_link),'public_media_linked'); RETURN v_link; END$$;
CREATE FUNCTION public.phase9_adjust_inventory_quantity(p_inventory_id uuid,p_expected_version integer,p_delta integer,
  p_idempotency_key text,p_command_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C23',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_version,p_delta)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'inventory_id')::uuid; END IF; UPDATE public.store_inventory SET quantity_total=quantity_total+p_delta,quantity_available=quantity_available+p_delta,
  version=version+1 WHERE id=p_inventory_id AND version=p_expected_version AND marketplace_sec.phase9_is_store_owner(store_id)
  AND quantity_available+p_delta>=0; IF NOT FOUND THEN RAISE EXCEPTION 'P9_QUANTITY_INVARIANT_FAILED'; END IF;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C23',p_idempotency_key,jsonb_build_object('inventory_id',p_inventory_id),'quantity_adjusted'); RETURN p_inventory_id; END$$;
CREATE FUNCTION public.phase9_owner_inventory(p_inventory_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; BEGIN SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN jsonb_build_object('id',v.id,'store_id',v.store_id,'title',v.title,'condition',v.condition,
    'quantity_total',v.quantity_total,'quantity_available',v.quantity_available,'publication_status',v.publication_status,'version',v.version); END$$;
CREATE FUNCTION public.phase9_publication_status(p_inventory_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; BEGIN SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN jsonb_build_object('inventory_id',v.id,'status',v.publication_status,
    'intent_version',v.publication_intent_version,'version',v.version); END$$;
CREATE FUNCTION public.phase9_needs_review(p_store_hint uuid DEFAULT NULL)
RETURNS TABLE(id uuid,observed_title text,state text,version integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,c.observed_title,c.state,c.version FROM public.image_extraction_candidates c
 WHERE c.store_id=marketplace_sec.phase9_owner_store(p_store_hint) AND c.state='needs_review'
 ORDER BY c.updated_at,c.id $$;
CREATE FUNCTION public.phase9_candidate_detail(p_candidate_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_candidates; BEGIN SELECT * INTO v FROM public.image_extraction_candidates WHERE id=p_candidate_id;
 PERFORM marketplace_sec.phase9_assert_session_owner(v.session_id); RETURN jsonb_build_object('id',v.id,'title',v.observed_title,
 'authors',v.observed_authors,'language',v.observed_language,'state',v.state,'version',v.version); END$$;
CREATE FUNCTION public.phase9_edit_inventory_metadata(p_inventory_id uuid,p_expected_version integer,p_title text,
 p_authors text[],p_language text,p_idempotency_key text,p_command_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C22',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_version,p_title,p_authors,p_language)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'inventory_id')::uuid; END IF; UPDATE public.store_inventory SET title=p_title,authors=p_authors,language=p_language,version=version+1,
 updated_at=transaction_timestamp() WHERE id=p_inventory_id AND version=p_expected_version
 AND marketplace_sec.phase9_is_store_owner(store_id); IF NOT FOUND THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C22',p_idempotency_key,jsonb_build_object('inventory_id',p_inventory_id),'metadata_edited'); RETURN p_inventory_id; END$$;
CREATE FUNCTION public.phase9_edit_inventory_commercial(p_inventory_id uuid,p_expected_version integer,p_price_paise integer,
 p_location text,p_idempotency_key text,p_command_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C24',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_version,p_price_paise,p_location)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'inventory_id')::uuid; END IF; UPDATE public.store_inventory SET selling_price_minor=p_price_paise,shelf_location=p_location,version=version+1,
 updated_at=transaction_timestamp() WHERE id=p_inventory_id AND version=p_expected_version
 AND p_price_paise>=0 AND marketplace_sec.phase9_is_store_owner(store_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C24',p_idempotency_key,jsonb_build_object('inventory_id',p_inventory_id),'commercial_edited'); RETURN p_inventory_id; END$$;
CREATE FUNCTION public.phase9_edit_inventory_condition_damage(p_inventory_id uuid,p_expected_version integer,p_condition text,
 p_has_damage boolean,p_damage_types text[],p_damage_note text,p_sellable boolean,p_idempotency_key text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_replay jsonb; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C25',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_version,p_condition,p_has_damage,p_damage_types,p_damage_note,p_sellable)); IF v_replay IS NOT NULL THEN RETURN (v_replay->>'inventory_id')::uuid; END IF; IF p_condition NOT IN ('new','like_new','very_good','good','acceptable') OR (p_has_damage AND
 (coalesce(array_length(p_damage_types,1),0)<1 OR coalesce(char_length(p_damage_note),0)<1))
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF; UPDATE public.store_inventory SET condition=p_condition,
 has_damage=p_has_damage,damage_types=p_damage_types,damage_notes=nullif(p_damage_note,''),is_sellable=p_sellable,
 version=version+1,updated_at=transaction_timestamp() WHERE id=p_inventory_id AND version=p_expected_version
 AND marketplace_sec.phase9_is_store_owner(store_id); IF NOT FOUND THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C25',p_idempotency_key,jsonb_build_object('inventory_id',p_inventory_id),'condition_damage_edited'); RETURN p_inventory_id; END$$;
CREATE FUNCTION public.phase9_set_publication_state(p_inventory_id uuid,p_expected_version integer,p_intent text,
 p_idempotency_key text,p_command_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_replay jsonb; v_outcome text; BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C26',p_idempotency_key,concat_ws('|',p_inventory_id,p_expected_version,p_intent)); IF v_replay IS NOT NULL THEN RETURN v_replay->>'outcome'; END IF; IF p_intent='publish' THEN v_outcome:=public.phase9_request_publication(p_inventory_id,p_expected_version,
 p_idempotency_key,p_command_id); ELSIF p_intent IN ('private','pause') THEN UPDATE public.store_inventory
 SET visibility_status='draft',publication_status='private',version=version+1 WHERE id=p_inventory_id
 AND version=p_expected_version AND marketplace_sec.phase9_is_store_owner(store_id); IF NOT FOUND THEN
 RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF; v_outcome:='private'; ELSE RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF; PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C26',p_idempotency_key,jsonb_build_object('outcome',v_outcome),'publication_state_changed'); RETURN v_outcome; END$$;
DO $$DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'phase9_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',f.signature); END LOOP; END$$;
DO $$DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='marketplace_sec' AND p.proname LIKE 'phase9_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature); END LOOP; END$$;
REVOKE ALL ON public.store_inventory,public.marketplace_book_listings FROM authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.store_inventory,public.marketplace_book_listings TO service_role;
COMMIT;
