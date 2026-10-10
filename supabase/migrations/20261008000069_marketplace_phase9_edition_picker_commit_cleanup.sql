-- Task 5: picker §§5-8/9; Unit 7A §§5-11; MAS-02/03/05/06/07/15/17.
BEGIN;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_valid_review(jsonb)
 RENAME TO phase9_edition_legacy_valid_review;
CREATE FUNCTION marketplace_sec.phase9_owner_ux_valid_review(p_review jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT marketplace_sec.phase9_edition_legacy_valid_review(CASE
  WHEN p_review#>>'{metadataChoice,mode}'='edition_option'
  THEN jsonb_set(p_review,'{metadataChoice,mode}','"selected"'::jsonb) ELSE p_review END)
$$;
CREATE FUNCTION marketplace_sec.phase9_edition_saved_choice_valid(
 p_candidate public.image_extraction_candidates,p_review jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; m jsonb; isbn text;
BEGIN
 IF p_review#>>'{metadataChoice,mode}'='manual' THEN
  RETURN p_review#>'{metadataChoice,selectionId}'='null'::jsonb; END IF;
 IF p_review#>>'{metadataChoice,mode}'='edition_option' THEN
  SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id
   AND store_id=p_candidate.store_id AND session_id=p_candidate.session_id;
  m:=s.selected_option_snapshot;
  RETURN coalesce(s.selection_id::text=p_review#>>'{metadataChoice,selectionId}'
   AND s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate)
   AND marketplace_sec.phase9_edition_valid_metadata(m)
   AND p_review->'originalTitle'=m->'title' AND p_review->'authors'=m->'authors'
   AND p_review->'originalLanguage'=m->'language' AND p_review->'script'=m->'script',false);
 END IF;
 IF p_review#>>'{metadataChoice,mode}'<>'selected' OR NOT EXISTS(
  SELECT 1 FROM public.phase9_selected_metadata_snapshots x WHERE x.candidate_id=p_candidate.id
   AND x.store_id=p_candidate.store_id AND x.id=p_candidate.selected_metadata_snapshot_id
   AND x.id::text=p_review#>>'{metadataChoice,selectionId}') THEN RETURN false; END IF;
 -- Title/author confirmations alone never confirm a medium automatic/local suggestion.
 m:=marketplace_sec.phase9_edition_current_snapshot(p_candidate);
 isbn:=marketplace_sec.phase9_metadata_normalized_isbn13(p_candidate.observed_isbn_clue);
 RETURN coalesce(isbn IS NOT NULL AND (isbn=marketplace_sec.phase9_metadata_normalized_isbn13(m->>'isbn13')
  OR isbn=marketplace_sec.phase9_metadata_normalized_isbn13(m->>'isbn10')),false);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END$$;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(public.image_extraction_candidates)
 RENAME TO phase9_edition_legacy_review_blockers;
CREATE FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE blockers jsonb:=marketplace_sec.phase9_edition_legacy_review_blockers(p_candidate);
BEGIN
 IF p_candidate.owner_review_snapshot->'value' IS NOT NULL AND NOT
  marketplace_sec.phase9_edition_saved_choice_valid(p_candidate,p_candidate.owner_review_snapshot->'value') THEN
  blockers:=blockers||jsonb_build_array(jsonb_build_object('code','metadata_choice_missing',
   'candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','metadataChoice',
   'safeMessage','Confirm a current edition or enter manual metadata.')); END IF;
 RETURN blockers;
END$$;
ALTER FUNCTION marketplace_sec.phase9_unit7a_commit_eligible(public.image_extraction_candidates)
 RENAME TO phase9_edition_legacy_commit_eligible;
CREATE FUNCTION marketplace_sec.phase9_unit7a_commit_eligible(p_candidate public.image_extraction_candidates)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates:=p_candidate; r jsonb:=c.owner_review_snapshot->'value';
BEGIN
 IF NOT marketplace_sec.phase9_edition_saved_choice_valid(c,r) THEN RETURN false; END IF;
 IF r#>>'{metadataChoice,mode}'='edition_option' THEN
  c.owner_review_snapshot:=jsonb_set(c.owner_review_snapshot,'{value,metadataChoice}',
   jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
 RETURN marketplace_sec.phase9_edition_legacy_commit_eligible(c);
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_projection_selection(p_candidate public.image_extraction_candidates)
RETURNS public.phase9_candidate_edition_state LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s FROM public.phase9_candidate_edition_state s WHERE s.candidate_id=p_candidate.id AND s.store_id=p_candidate.store_id
  AND s.session_id=p_candidate.session_id AND s.selection_id IS NOT NULL
  AND s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate) AND marketplace_sec.phase9_edition_valid_metadata(s.selected_option_snapshot)
  AND (p_candidate.owner_review_snapshot->'value' IS NULL OR (p_candidate.owner_review_snapshot#>>'{value,metadataChoice,mode}'='edition_option'
    AND marketplace_sec.phase9_edition_saved_choice_valid(p_candidate,p_candidate.owner_review_snapshot->'value')))
$$;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(uuid) RENAME TO phase9_edition_legacy_metadata_state;
CREATE FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(p_candidate_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN (marketplace_sec.phase9_edition_projection_selection(c)).selection_id IS NOT NULL THEN 'selected'
  ELSE marketplace_sec.phase9_edition_legacy_metadata_state(c.id) END
 FROM public.image_extraction_candidates c WHERE c.id=p_candidate_id
$$;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_candidate_detail(public.image_extraction_sessions,public.image_extraction_candidates) RENAME TO phase9_edition_legacy_candidate_detail;
CREATE FUNCTION marketplace_sec.phase9_owner_ux_candidate_detail(p_session public.image_extraction_sessions,p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE detail jsonb; s public.phase9_candidate_edition_state:=marketplace_sec.phase9_edition_projection_selection(p_candidate); BEGIN
 detail:=marketplace_sec.phase9_edition_legacy_candidate_detail(p_session,p_candidate);
 IF s.selection_id IS NOT NULL THEN
  detail:=jsonb_set(detail,'{metadata}',(detail->'metadata')||jsonb_build_object(
   'state','selected','selectionId',s.selection_id,'selectionVersion',1,'snapshot',
   marketplace_sec.phase9_edition_snapshot(s.selected_option_snapshot),'representativeCover',NULL,
   'canonicalEditionId',(SELECT x.canonical_edition_id FROM public.phase9_selected_metadata_snapshots x
    WHERE s.selected_source='current_suggestion' AND x.id=s.selected_source_id AND x.candidate_id=p_candidate.id)));
 END IF;
 RETURN detail;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_clear_options(p_candidate_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.phase9_candidate_edition_state SET options='[]',source_lookup_id=NULL,source_attempt_id=NULL,
  source_fetched_at=NULL,options_expires_at=NULL,request_id=NULL,updated_at=transaction_timestamp()
 WHERE candidate_id=p_candidate_id AND (options_expires_at IS NOT NULL OR options<>'[]' OR request_id IS NOT NULL)
$$;
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
  v_quantity integer; v_selected public.phase9_candidate_edition_state; m jsonb;
BEGIN
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
  IF v_choice->>'mode'='edition_option' THEN
    SELECT * INTO v_selected FROM public.phase9_candidate_edition_state
      WHERE candidate_id=v_candidate.id AND store_id=v_candidate.store_id FOR UPDATE;
    m:=v_selected.selected_option_snapshot;
    v_metadata_version:='edition-selection-v1:'||v_selected.selection_id::text||':metadata-r'||p_expected_metadata_revision;
    v_isbn10:=m->>'isbn10'; v_isbn13:=m->>'isbn13'; v_publisher:=m->>'publisher';
    v_published:=m->>'publishedDate'; v_cover:=m->>'coverReference'; v_description:=m->>'description';
    v_edition_statement:=m->>'editionStatement'; v_volume:=m->>'volume'; v_format:=m->>'format';
    IF v_selected.selected_source='current_suggestion' THEN
      SELECT canonical_edition_id INTO v_canonical_edition FROM public.phase9_selected_metadata_snapshots
        WHERE id=v_selected.selected_source_id AND candidate_id=v_candidate.id AND store_id=v_candidate.store_id;
      SELECT work_id INTO v_canonical_work FROM public.canonical_editions WHERE id=v_canonical_edition;
    END IF;
  ELSIF v_choice->>'mode'='selected' THEN
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
  PERFORM marketplace_sec.phase9_edition_clear_options(v_candidate.id);
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
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_set_inventory_representative_cover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cover jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.representative_cover IS DISTINCT FROM OLD.representative_cover
      OR NEW.created_from_candidate_id IS DISTINCT FROM OLD.created_from_candidate_id
      OR NEW.entry_method IS DISTINCT FROM OLD.entry_method
    THEN RAISE EXCEPTION 'P9_METADATA_REPRESENTATIVE_COVER_IMMUTABLE'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.representative_cover IS NOT NULL THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF NEW.entry_method='image_extraction' AND NEW.created_from_candidate_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_cover
    FROM public.image_extraction_candidates c
    JOIN public.phase9_selected_metadata_snapshots s
      ON s.id=c.selected_metadata_snapshot_id AND s.candidate_id=c.id AND s.store_id=c.store_id
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
    WHERE c.id=NEW.created_from_candidate_id AND c.store_id=NEW.store_id
      AND c.owner_review_snapshot#>>'{value,metadataChoice,mode}'='selected'
      AND c.owner_review_snapshot#>>'{value,metadataChoice,selectionId}'=s.id::text
      AND coalesce(s.coherent_edition->>'coverReference','')='';
    NEW.representative_cover:=v_cover;
  END IF;
  RETURN NEW;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_options_due(c public.image_extraction_candidates)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phase9_candidate_edition_state s
  JOIN public.image_extraction_sessions session ON session.id=c.session_id
  WHERE s.candidate_id=c.id AND s.options_expires_at IS NOT NULL
   AND (s.options_expires_at<=transaction_timestamp() OR c.expires_at<=transaction_timestamp()
    OR session.expires_at<=transaction_timestamp() OR c.state='committed'
    OR c.review_disposition IN('owner_removed_from_scan','skipped_false_detection')
    OR s.query_identity IS DISTINCT FROM marketplace_sec.phase9_edition_query_identity(c)
    OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key='google_books'
     AND r.enabled AND r.matching_allowed AND r.storage_allowed)))
$$;
CREATE FUNCTION marketplace_sec.phase9_edition_cleanup_due(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; cleared integer:=0; remaining integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 FOR c IN SELECT candidate.id FROM public.image_extraction_candidates candidate
  WHERE marketplace_sec.phase9_edition_options_due(candidate)
  ORDER BY candidate.id LIMIT p_limit FOR UPDATE OF candidate SKIP LOCKED
 LOOP
  PERFORM marketplace_sec.phase9_edition_clear_options(c.id); cleared:=cleared+1;
 END LOOP;
 SELECT count(*)::integer INTO remaining FROM public.image_extraction_candidates candidate
  WHERE marketplace_sec.phase9_edition_options_due(candidate);
 RETURN jsonb_build_object('cleared',cleared,'remaining',remaining,'failed',0);
END$$;
ALTER FUNCTION marketplace_sec.dispatch_phase9_worker_wakes() RENAME TO phase9_edition_legacy_dispatch;
CREATE FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cleanup jsonb;
BEGIN
 BEGIN cleanup:=marketplace_sec.phase9_edition_cleanup_due();
 EXCEPTION WHEN OTHERS THEN
  cleanup:=jsonb_build_object('cleared',0,'failed',1,'remaining',
   (SELECT count(*)::integer FROM public.image_extraction_candidates candidate
    WHERE marketplace_sec.phase9_edition_options_due(candidate)));
 END;
 RETURN marketplace_sec.phase9_edition_legacy_dispatch()||jsonb_build_object('editionOptionsCleanup',cleanup);
END$$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_query text; new_query text; s public.phase9_candidate_edition_state; r jsonb:=NEW.owner_review_snapshot->'value';
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=NEW.id;
 IF s.candidate_id IS NULL THEN RETURN NEW; END IF;
 -- The controlled select command saved this exact coherent choice before updating the review.
 IF r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,
   NEW.observed_publisher_clue,NEW.state,NEW.review_disposition) IS NOT DISTINCT FROM
   ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,
    OLD.observed_publisher_clue,OLD.state,OLD.review_disposition) THEN RETURN NEW; END IF;
 IF ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,NEW.observed_publisher_clue)
  IS DISTINCT FROM ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,OLD.observed_publisher_clue) THEN
  old_query:=marketplace_sec.phase9_metadata_candidate_query_identity(OLD);
  new_query:=marketplace_sec.phase9_metadata_candidate_query_identity(NEW);
 ELSE old_query:=marketplace_sec.phase9_edition_query_identity(OLD);
  new_query:=marketplace_sec.phase9_edition_query_identity(NEW); END IF;
 IF old_query IS DISTINCT FROM new_query OR NEW.review_disposition IN('owner_removed_from_scan','skipped_false_detection') THEN
  UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1,request_id=NULL,
   query_identity=new_query,options='[]',source_lookup_id=NULL,source_attempt_id=NULL,source_fetched_at=NULL,
   options_expires_at=NULL,selection_id=NULL,selected_source=NULL,selected_source_id=NULL,
   selected_option_snapshot=NULL,selected_at=NULL,selected_by=NULL,updated_at=transaction_timestamp() WHERE candidate_id=NEW.id;
  IF old_query IS DISTINCT FROM new_query THEN
   NEW.metadata_revision:=greatest(NEW.metadata_revision,OLD.metadata_revision+1); NEW.review_ready:=false;
   IF jsonb_typeof(NEW.owner_review_snapshot->'value')='object' THEN
    NEW.owner_review_snapshot:=jsonb_set(NEW.owner_review_snapshot,'{value,metadataChoice}',
     jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
  END IF;
 END IF;
 RETURN NEW;
END$$;
DO $$DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND (p.proname LIKE 'phase9_edition_%' OR p.proname IN(
   'phase9_owner_ux_valid_review','phase9_owner_ux_review_blockers','phase9_unit7a_commit_eligible',
   'phase9_owner_ux_candidate_detail','phase9_owner_ux_metadata_state','phase9_set_inventory_representative_cover','dispatch_phase9_worker_wakes'))
 LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature); END LOOP;
END$$;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_unit7a_commit_eligible(public.image_extraction_candidates) TO service_role;
COMMIT;