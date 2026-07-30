-- Phase 9 Unit 6A: Owner-safe recovery, review, readiness, and Close contracts.
-- Forward-only additive migration. Creation does not authorize live application.
BEGIN;

ALTER TABLE public.image_extraction_sessions
  ADD COLUMN session_scope_version integer NOT NULL DEFAULT 1 CHECK (session_scope_version>0),
  ADD COLUMN presentation_revision integer NOT NULL DEFAULT 1 CHECK (presentation_revision>0);
ALTER TABLE public.image_extraction_candidates
  ADD COLUMN metadata_revision integer NOT NULL DEFAULT 1 CHECK (metadata_revision>0),
  ADD COLUMN review_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN review_version integer,
  ADD COLUMN duplicate_advice jsonb,
  ADD COLUMN duplicate_advice_version integer;

CREATE TABLE public.phase9_owner_review_scopes (
  actor_user_id uuid PRIMARY KEY,
  review_scope_version bigint NOT NULL DEFAULT 1 CHECK (review_scope_version>0),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE public.phase9_owner_ux_cursor_keys (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  signing_secret text NOT NULL CHECK (char_length(signing_secret)>=32),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
INSERT INTO public.phase9_owner_ux_cursor_keys(singleton,signing_secret)
VALUES(true,gen_random_uuid()::text||gen_random_uuid()::text);

ALTER TABLE public.phase9_owner_review_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_owner_ux_cursor_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_owner_review_scopes OWNER TO postgres;
ALTER TABLE public.phase9_owner_ux_cursor_keys OWNER TO postgres;
REVOKE ALL ON public.phase9_owner_review_scopes,public.phase9_owner_ux_cursor_keys
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_bump_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session uuid; v_actor uuid;
BEGIN
  IF TG_TABLE_NAME='image_extraction_sessions' THEN
    v_session:=coalesce(NEW.id,OLD.id);
    v_actor:=coalesce(NEW.created_by,OLD.created_by);
  ELSE
    v_session:=coalesce(NEW.session_id,OLD.session_id);
    SELECT s.created_by INTO v_actor FROM public.image_extraction_sessions s
      WHERE s.id=v_session;
    UPDATE public.image_extraction_sessions
      SET session_scope_version=session_scope_version+1,
          presentation_revision=presentation_revision+1,
          updated_at=transaction_timestamp()
      WHERE id=v_session;
  END IF;
  IF v_actor IS NOT NULL THEN
    INSERT INTO public.phase9_owner_review_scopes(actor_user_id,review_scope_version)
      VALUES(v_actor,2)
    ON CONFLICT(actor_user_id) DO UPDATE
      SET review_scope_version=public.phase9_owner_review_scopes.review_scope_version+1,
          updated_at=transaction_timestamp();
  END IF;
  RETURN coalesce(NEW,OLD);
END$$;
CREATE TRIGGER phase9_owner_ux_session_scope
  AFTER INSERT OR UPDATE OR DELETE ON public.image_extraction_sessions
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_bump_scope();
CREATE TRIGGER phase9_owner_ux_input_scope
  AFTER INSERT OR UPDATE OR DELETE ON public.image_extraction_inputs
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_bump_scope();
CREATE TRIGGER phase9_owner_ux_candidate_scope
  AFTER INSERT OR UPDATE OR DELETE ON public.image_extraction_candidates
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_bump_scope();

-- Serialize input creation with Close. If input creation wins the session lock,
-- Close sees the new nonterminal input; if Close wins, the insert is rejected.
CREATE FUNCTION marketplace_sec.phase9_owner_ux_input_session_fence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text;
BEGIN
  SELECT s.status INTO v_status
  FROM public.image_extraction_sessions s
  WHERE s.id=NEW.session_id
  FOR UPDATE;
  IF v_status IS NULL OR v_status<>'active' THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER phase9_owner_ux_input_session_fence
  BEFORE INSERT ON public.image_extraction_inputs
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_input_session_fence();

-- Unit 6 review snapshots are staging-only. Preserve the legacy variant refresh
-- for non-Unit-6 snapshots and commits, but prove Unit 7 variant effects absent.
DROP TRIGGER phase9_candidate_variant_refresh ON public.image_extraction_candidates;
CREATE TRIGGER phase9_candidate_variant_refresh
  AFTER UPDATE OF owner_review_snapshot,committed_inventory_id
  ON public.image_extraction_candidates
  FOR EACH ROW
  WHEN (
    OLD.committed_inventory_id IS DISTINCT FROM NEW.committed_inventory_id
    OR NOT (coalesce(NEW.owner_review_snapshot,'{}'::jsonb) ? 'value')
  )
  EXECUTE FUNCTION marketplace_sec.phase9_candidate_variant_refresh();

CREATE FUNCTION marketplace_sec.phase9_owner_ux_metadata_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.selected_metadata_snapshot_id IS DISTINCT FROM OLD.selected_metadata_snapshot_id THEN
    NEW.metadata_revision:=OLD.metadata_revision+1;
    NEW.review_ready:=false;
  END IF;
  IF NEW.duplicate_advice IS DISTINCT FROM OLD.duplicate_advice
    OR NEW.duplicate_advice_version IS DISTINCT FROM OLD.duplicate_advice_version
  THEN
    NEW.review_ready:=false;
    NEW.version:=greatest(NEW.version,OLD.version+1);
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER phase9_owner_ux_metadata_revision
  BEFORE UPDATE OF selected_metadata_snapshot_id,duplicate_advice,duplicate_advice_version
  ON public.image_extraction_candidates
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_metadata_revision();

CREATE FUNCTION marketplace_sec.phase9_owner_ux_lookup_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate uuid:=coalesce(NEW.candidate_id,OLD.candidate_id);
BEGIN
  UPDATE public.image_extraction_candidates
  SET metadata_revision=metadata_revision+1,review_ready=false,
      updated_at=transaction_timestamp()
  WHERE id=v_candidate;
  RETURN coalesce(NEW,OLD);
END$$;
CREATE TRIGGER phase9_owner_ux_lookup_revision
  AFTER INSERT OR UPDATE OR DELETE ON public.phase9_metadata_lookups
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_lookup_revision();

CREATE FUNCTION marketplace_sec.phase9_owner_ux_variant_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate uuid:=coalesce(NEW.candidate_id,OLD.candidate_id);
BEGIN
  UPDATE public.image_extraction_candidates
  SET review_ready=false,version=version+1,updated_at=transaction_timestamp()
  WHERE id=v_candidate;
  RETURN coalesce(NEW,OLD);
END$$;
CREATE TRIGGER phase9_owner_ux_variant_revision
  AFTER INSERT OR UPDATE OR DELETE ON public.phase9_search_variant_proposals
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_owner_ux_variant_revision();

CREATE FUNCTION marketplace_sec.phase9_owner_ux_assert_owner()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'P9_AUTH_REQUIRED'; END IF;
  SELECT sa.store_id INTO v_store
  FROM public.store_administrators sa JOIN public.stores s ON s.id=sa.store_id
  WHERE sa.user_id=auth.uid() AND sa.role='owner' AND sa.status='active'
    AND s.status='active' AND s.setup_status='complete' AND s.selling_status='allowed'
  ORDER BY sa.store_id LIMIT 1;
  IF v_store IS NULL THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN v_store;
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_assert_session(p_session_id uuid)
RETURNS public.image_extraction_sessions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions;
BEGIN
  PERFORM marketplace_sec.phase9_owner_ux_assert_owner();
  SELECT * INTO v FROM public.image_extraction_sessions s WHERE s.id=p_session_id;
  IF v.id IS NULL OR v.created_by IS DISTINCT FROM auth.uid()
    OR NOT marketplace_sec.phase9_is_store_owner(v.store_id)
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN v;
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_cursor(p_payload jsonb)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT replace(encode(convert_to(p_payload::text,'UTF8'),'base64'),E'\n','')
    ||'.'||encode(extensions.digest(
      p_payload::text||(SELECT k.signing_secret FROM public.phase9_owner_ux_cursor_keys k
        WHERE k.singleton),'sha256'),'hex')
$$;
CREATE FUNCTION marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_payload jsonb; v_encoded text; v_signature text; v_expected text;
BEGIN
  IF p_cursor IS NULL OR position('.' in p_cursor)<2 THEN
    RAISE EXCEPTION 'P9_CURSOR_INVALID';
  END IF;
  v_encoded:=split_part(p_cursor,'.',1);
  v_signature:=split_part(p_cursor,'.',2);
  BEGIN
    v_payload:=convert_from(decode(v_encoded,'base64'),'UTF8')::jsonb;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'P9_CURSOR_INVALID';
  END;
  v_expected:=encode(extensions.digest(
    v_payload::text||(SELECT k.signing_secret FROM public.phase9_owner_ux_cursor_keys k
      WHERE k.singleton),'sha256'),'hex');
  IF v_signature<>v_expected OR split_part(p_cursor,'.',3)<>'' THEN
    RAISE EXCEPTION 'P9_CURSOR_INVALID';
  END IF;
  RETURN v_payload;
END$$;

-- NeedsReviewMembershipV1 is the single queue/discovery membership predicate.
CREATE FUNCTION marketplace_sec.phase9_owner_ux_needs_review(
  p_candidate public.image_extraction_candidates,
  p_session public.image_extraction_sessions,
  p_as_of timestamptz DEFAULT transaction_timestamp()
) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT p_session.created_by=auth.uid()
    AND p_session.status IN ('active','closing','closed')
    AND p_candidate.expires_at>p_as_of
    AND p_candidate.review_disposition IS DISTINCT FROM 'skipped_false_detection'
    AND (
      p_candidate.state IN ('needs_review','possible_duplicate','failed')
      OR (p_candidate.state='ready' AND
        (p_candidate.review_disposition IS NULL OR NOT p_candidate.review_ready))
    )
$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_close_summary(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'imagesSubmitted',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id),
    'imagesProcessed',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='ready'),
    'imagesFailed',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='failed'),
    'imagesSkipped',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='skipped'),
    'candidatesDetected',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id),
    'candidatesReviewReady',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.review_ready),
    'candidatesNeedsReview',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id
      AND c.review_disposition IS DISTINCT FROM 'skipped_false_detection' AND NOT c.review_ready),
    'candidatesFailed',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.state='failed'),
    'falseDetections',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.review_disposition='skipped_false_detection'),
    'manualMissedCandidates',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.input_id IS NULL),
    'committedInventoryItems',(SELECT count(*) FROM public.image_extraction_candidates c
      WHERE c.session_id=p_session_id AND c.state='committed'
        AND c.committed_inventory_id IS NOT NULL),
    'quantitiesAddedToExisting',(SELECT count(*) FROM public.image_extraction_candidates c
      WHERE c.session_id=p_session_id AND c.state='committed'
        AND c.commit_outcome='quantity_incremented'),
    'privateItems',(SELECT count(*) FROM public.image_extraction_candidates c
      JOIN public.store_inventory inventory ON inventory.id=c.committed_inventory_id
      WHERE c.session_id=p_session_id AND c.state='committed'
        AND inventory.publication_status IN ('private','publication_pending','publication_failed')),
    'publishedItems',(SELECT count(*) FROM public.image_extraction_candidates c
      JOIN public.store_inventory inventory ON inventory.id=c.committed_inventory_id
      WHERE c.session_id=p_session_id AND c.state='committed'
        AND inventory.publication_status='published'),
    'languageSkips',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='skipped' AND i.quality_reason='P9_VISION_LANGUAGE_MISMATCH'),
    'candidateCapSkips',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='skipped' AND i.quality_reason='P9_VISION_CANDIDATE_CAP'),
    'qualitySkips',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='failed' AND i.quality_reason='P9_VISION_QUALITY_REJECTED')
  )
$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(p_candidate_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN c.owner_review_snapshot#>>'{value,metadataChoice,mode}'='manual' THEN 'manual'
    WHEN c.selected_metadata_snapshot_id IS NOT NULL THEN 'selected'
    WHEN l.normalized_outcome='manual_metadata_required' THEN 'manual'
    WHEN l.normalized_outcome='no_match' THEN 'no_match'
    WHEN l.normalized_outcome IN ('ambiguous','material_conflict') THEN 'ambiguous'
    WHEN l.normalized_outcome='technical_failure' THEN 'temporarily_unavailable'
    WHEN l.normalized_outcome IN ('policy_denied','cost_quota_denied') THEN 'failed'
    ELSE 'pending' END
  FROM public.image_extraction_candidates c
  LEFT JOIN LATERAL (SELECT ml.normalized_outcome FROM public.phase9_metadata_lookups ml
    WHERE ml.candidate_id=c.id ORDER BY ml.created_at DESC,ml.id DESC LIMIT 1) l ON true
  WHERE c.id=p_candidate_id
$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_attention(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb:='[]'::jsonb; r jsonb:=p_candidate.owner_review_snapshot->'value';
  v_metadata text;
BEGIN
  v_metadata:=marketplace_sec.phase9_owner_ux_metadata_state(p_candidate.id);
  IF p_candidate.state='processing' THEN v:=v||'"input_processing"'::jsonb; END IF;
  IF p_candidate.state='failed' THEN v:=v||'"candidate_failed"'::jsonb; END IF;
  IF v_metadata='pending' THEN v:=v||'"metadata_pending"'::jsonb; END IF;
  IF v_metadata='manual' THEN v:=v||'"metadata_manual_required"'::jsonb; END IF;
  IF r IS NOT NULL AND coalesce((r#>>'{originalFieldConfirmation,title}')::boolean,false)=false
    THEN v:=v||'"title_confirmation_required"'::jsonb; END IF;
  IF r IS NOT NULL AND EXISTS(SELECT 1
    FROM jsonb_array_elements(coalesce(r#>'{originalFieldConfirmation,authors}','[]')) x
    WHERE x<>'true'::jsonb)
    THEN v:=v||'"author_confirmation_required"'::jsonb; END IF;
  IF r IS NOT NULL AND coalesce(r->>'originalLanguage','')=''
    THEN v:=v||'"language_required"'::jsonb; END IF;
  IF p_candidate.duplicate_advice IS NOT NULL
    AND coalesce(p_candidate.duplicate_advice->>'state','none')<>'none'
    AND (r->'duplicateIntent' IS NULL OR r->'duplicateIntent'='null'::jsonb)
    THEN v:=v||'"duplicate_choice_required"'::jsonb; END IF;
  IF r IS NOT NULL AND coalesce((r#>>'{damageDisclosure,hasDamage}')::boolean,false)
    AND (jsonb_array_length(coalesce(r#>'{damageDisclosure,damageTypes}','[]'))=0
      OR coalesce(r#>>'{damageDisclosure,damageNote}','')='')
    THEN v:=v||'"damage_details_required"'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM public.phase9_search_variant_proposals p
    WHERE p.candidate_id=p_candidate.id AND p.status='stale')
    THEN v:=v||'"variant_source_stale"'::jsonb; END IF;
  IF p_candidate.review_ready THEN v:=v||'"review_ready"'::jsonb; END IF;
  IF v='[]'::jsonb AND NOT p_candidate.review_ready
    THEN v:=v||'"field_validation_required"'::jsonb; END IF;
  RETURN v;
END
$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_candidate_summary(
  p_candidate public.image_extraction_candidates,
  p_session public.image_extraction_sessions
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'sessionId',p_session.id,'sessionStartedAt',p_session.started_at,
    'sessionExpiresAt',p_session.expires_at,'sessionStatus',p_session.status,
    'candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'ordinal',p_candidate.candidate_index,'title',coalesce(p_candidate.observed_title,'Untitled'),
    'authors',to_jsonb(p_candidate.observed_authors),
    'language',coalesce(p_candidate.observed_language,p_session.selected_language),
    'candidateState',p_candidate.state,'candidateVersion',p_candidate.version,
    'metadataState',marketplace_sec.phase9_owner_ux_metadata_state(p_candidate.id),
    'reviewDisposition',p_candidate.review_disposition,
    'attentionCodes',marketplace_sec.phase9_owner_ux_attention(p_candidate),
    'reviewReady',p_candidate.review_ready,'updatedAt',p_candidate.updated_at)
$$;

CREATE FUNCTION public.phase9_owner_discover_session_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_active jsonb; v_scope bigint;
BEGIN
  v_store:=marketplace_sec.phase9_owner_ux_assert_owner();
  SELECT coalesce((SELECT s.review_scope_version FROM public.phase9_owner_review_scopes s
    WHERE s.actor_user_id=auth.uid()),1) INTO v_scope
  FROM (VALUES(1)) seed(value);
  SELECT jsonb_build_object(
    'sessionId',x.id,'status',x.status,'sessionVersion',x.version,
    'startedAt',x.started_at,'updatedAt',x.updated_at,
    'inputCount',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=x.id),
    'candidateCount',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=x.id),
    'attentionCount',(SELECT count(*) FROM public.image_extraction_candidates c
      WHERE c.session_id=x.id
        AND marketplace_sec.phase9_owner_ux_needs_review(c,x,transaction_timestamp())))
  INTO v_active FROM public.image_extraction_sessions x
  WHERE x.store_id=v_store AND x.created_by=auth.uid()
    AND x.status IN ('active','closing') AND x.expires_at>transaction_timestamp()
  ORDER BY x.updated_at DESC,x.id DESC LIMIT 1;
  RETURN jsonb_build_object(
    'activeSession',v_active,
    'needsReviewCount',(SELECT count(*) FROM public.image_extraction_candidates c
      JOIN public.image_extraction_sessions s ON s.id=c.session_id
      WHERE marketplace_sec.phase9_owner_ux_needs_review(c,s,transaction_timestamp())),
    'reviewScopeVersion',v_scope);
END$$;

CREATE FUNCTION public.phase9_owner_session_summary_v2(p_session_id uuid)
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
    'expiresAt',v.expires_at,
    'defaults',jsonb_build_object('language',v.selected_language,'script',v.selected_script,
      'condition',v.default_condition,'location',v.default_location,
      'quantity',v.default_quantity,'publication',v.default_publication),
    'closeSummary',marketplace_sec.phase9_owner_ux_close_summary(v.id),
    'allInputsTerminal',v_terminal,'closeState',v_close,
    'presentationRevision',v.presentation_revision);
END$$;

CREATE FUNCTION public.phase9_owner_session_inputs_v1(
  p_session_id uuid,p_page_size integer DEFAULT 20,p_cursor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; v_payload jsonb; v_after_at timestamptz;
  v_after_id uuid; v_rows jsonb; v_has_more boolean; v_next text;
BEGIN
  v:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  IF p_page_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_payload:=marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor);
      IF v_payload->>'kind'<>'inputs' OR (v_payload->>'actor')::uuid<>auth.uid()
        OR (v_payload->>'session')::uuid<>p_session_id
        OR (v_payload->>'size')::integer<>p_page_size
        OR (v_payload->>'revision')::integer<>v.presentation_revision
        OR v_payload->>'contract'<>'phase9-owner-ux-v1'
      THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      v_after_at:=(v_payload->>'at')::timestamptz; v_after_id:=(v_payload->>'id')::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  END IF;
  WITH ranked AS (
    SELECT i.*,row_number() OVER(ORDER BY i.created_at,i.id)::integer ordinal,
      (SELECT j.status FROM public.image_extraction_jobs j
       WHERE j.entity_type='input' AND j.entity_id=i.id
       ORDER BY j.created_at DESC,j.id DESC LIMIT 1) job_status,
      (SELECT count(*)::integer FROM public.image_extraction_candidates c
       WHERE c.input_id=i.id) accepted_count
    FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id
  ), page AS (
    SELECT * FROM ranked WHERE p_cursor IS NULL OR (created_at,id)>(v_after_at,v_after_id)
    ORDER BY created_at,id LIMIT p_page_size+1
  ), sliced AS (SELECT * FROM page ORDER BY created_at,id LIMIT p_page_size)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'inputId',id,'ordinal',ordinal,'sourceKind',source_kind,'inputState',state,
      'inputVersion',version,
      'presentationState',CASE WHEN state IN ('uploaded','validating','queued') THEN 'checking_image'
        WHEN state='processing' THEN 'finding_books' WHEN state='ready' THEN 'ready'
        ELSE 'needs_attention' END,
      'safeCode',CASE WHEN state='failed' THEN validation_error_code ELSE NULL END,
      'retryState',CASE WHEN job_status='retry_scheduled' THEN 'server_retrying'
        WHEN state='failed' THEN 'new_upload_required' ELSE 'none' END,
      'terminal',state IN ('ready','failed','skipped'),
      'polling',state IN ('uploaded','validating','queued','processing'),
      'detectedCandidateCount',detected_candidate_count,
      'acceptedCandidateCount',accepted_count,'createdAt',created_at,'updatedAt',updated_at)
      ORDER BY created_at,id),'[]'::jsonb),
    (SELECT count(*)>p_page_size FROM page),
    (SELECT marketplace_sec.phase9_owner_ux_cursor(jsonb_build_object(
      'kind','inputs','actor',auth.uid(),'session',p_session_id,'size',p_page_size,
      'revision',v.presentation_revision,'contract','phase9-owner-ux-v1',
      'at',created_at,'id',id)) FROM sliced ORDER BY created_at DESC,id DESC LIMIT 1)
  INTO v_rows,v_has_more,v_next FROM sliced;
  IF NOT v_has_more THEN v_next:=NULL; END IF;
  RETURN jsonb_build_object('items',v_rows,'pageInfo',jsonb_build_object(
    'nextCursor',v_next,'hasMore',v_has_more),
    'sessionVersion',v.version,'presentationRevision',v.presentation_revision);
END$$;

CREATE FUNCTION public.phase9_owner_candidates_page_v2(
  p_scope text,p_session_id uuid DEFAULT NULL,p_attention text DEFAULT 'all',
  p_page_size integer DEFAULT 20,p_cursor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_session public.image_extraction_sessions; v_scope_version bigint;
  v_payload jsonb; v_after_index integer; v_after_at timestamptz; v_after_id uuid;
  v_rows jsonb; v_has_more boolean; v_next text; v_session_version integer;
  v_as_of timestamptz:=transaction_timestamp();
BEGIN
  v_store:=marketplace_sec.phase9_owner_ux_assert_owner();
  IF p_scope NOT IN ('session','needs_review') OR p_page_size NOT BETWEEN 1 AND 50
    OR p_attention NOT IN ('all','needs_attention','review_ready')
    OR (p_scope='session') IS DISTINCT FROM (p_session_id IS NOT NULL)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_scope='session' THEN
    v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
    v_scope_version:=v_session.session_scope_version; v_session_version:=v_session.version;
  ELSE
    SELECT coalesce((SELECT r.review_scope_version FROM public.phase9_owner_review_scopes r
      WHERE r.actor_user_id=auth.uid()),1) INTO v_scope_version;
    v_session_version:=NULL;
  END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_payload:=marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor);
      IF v_payload->>'kind'<>'candidates' OR (v_payload->>'actor')::uuid<>auth.uid()
        OR v_payload->>'scope'<>p_scope OR coalesce(v_payload->>'session','')<>coalesce(p_session_id::text,'')
        OR v_payload->>'attention'<>p_attention OR (v_payload->>'size')::integer<>p_page_size
        OR (v_payload->>'revision')::bigint<>v_scope_version
        OR (p_scope='needs_review' AND (v_payload->>'asOf') IS NULL)
        OR v_payload->>'contract'<>'phase9-owner-ux-v1'
      THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      v_after_id:=(v_payload->>'id')::uuid;
      IF p_scope='session' THEN v_after_index:=(v_payload->>'position')::integer;
      ELSE
        v_after_at:=(v_payload->>'position')::timestamptz;
        v_as_of:=(v_payload->>'asOf')::timestamptz;
      END IF;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  ELSIF p_scope='needs_review' AND p_attention NOT IN ('all','needs_attention') THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  WITH eligible AS (
    SELECT c.*,s.started_at,s.expires_at session_expires_at,s.status session_status,
      s.id sid,s.session_scope_version
    FROM public.image_extraction_candidates c JOIN public.image_extraction_sessions s ON s.id=c.session_id
    WHERE s.store_id=v_store AND s.created_by=auth.uid()
      AND ((p_scope='session' AND s.id=p_session_id
        AND s.status IN ('active','closing','closed')
        AND (p_attention='all' OR (p_attention='review_ready' AND c.review_ready)
          OR (p_attention='needs_attention' AND NOT c.review_ready)))
       OR (p_scope='needs_review' AND marketplace_sec.phase9_owner_ux_needs_review(c,s,v_as_of)))
      AND (p_cursor IS NULL OR
        (p_scope='session' AND (c.candidate_index,c.id)>(v_after_index,v_after_id))
        OR (p_scope='needs_review' AND (c.updated_at,c.id)<(v_after_at,v_after_id)))
  ), page AS (
    SELECT * FROM eligible ORDER BY
      CASE WHEN p_scope='session' THEN candidate_index END ASC,
      CASE WHEN p_scope='needs_review' THEN updated_at END DESC,
      CASE WHEN p_scope='session' THEN id END ASC,
      CASE WHEN p_scope='needs_review' THEN id END DESC LIMIT p_page_size+1
  ), sliced AS (
    SELECT * FROM page ORDER BY
      CASE WHEN p_scope='session' THEN candidate_index END ASC,
      CASE WHEN p_scope='needs_review' THEN updated_at END DESC,
      CASE WHEN p_scope='session' THEN id END ASC,
      CASE WHEN p_scope='needs_review' THEN id END DESC LIMIT p_page_size
  )
  SELECT coalesce(jsonb_agg(marketplace_sec.phase9_owner_ux_candidate_summary(
      (SELECT c FROM public.image_extraction_candidates c WHERE c.id=s.id),
      (SELECT x FROM public.image_extraction_sessions x WHERE x.id=s.sid))
      ORDER BY CASE WHEN p_scope='session' THEN candidate_index END ASC,
        CASE WHEN p_scope='needs_review' THEN updated_at END DESC,
        CASE WHEN p_scope='session' THEN id END ASC,
        CASE WHEN p_scope='needs_review' THEN id END DESC),'[]'::jsonb),
    (SELECT count(*)>p_page_size FROM page),
    (SELECT marketplace_sec.phase9_owner_ux_cursor(jsonb_build_object(
      'kind','candidates','actor',auth.uid(),'scope',p_scope,'session',p_session_id,
      'attention',p_attention,'size',p_page_size,'revision',v_scope_version,
      'contract','phase9-owner-ux-v1','asOf',
        CASE WHEN p_scope='needs_review' THEN v_as_of::text ELSE NULL END,'position',
        CASE WHEN p_scope='session' THEN candidate_index::text ELSE updated_at::text END,'id',id))
      FROM sliced ORDER BY
        CASE WHEN p_scope='session' THEN candidate_index END DESC,
        CASE WHEN p_scope='needs_review' THEN updated_at END ASC,
        CASE WHEN p_scope='session' THEN id END DESC,
        CASE WHEN p_scope='needs_review' THEN id END ASC LIMIT 1)
  INTO v_rows,v_has_more,v_next FROM sliced s;
  IF NOT v_has_more THEN v_next:=NULL; END IF;
  RETURN jsonb_build_object('items',v_rows,'pageInfo',jsonb_build_object(
    'nextCursor',v_next,'hasMore',v_has_more),'scopeVersion',v_scope_version,
    'sessionVersion',v_session_version);
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb:=p_candidate.owner_review_snapshot->'value'; v jsonb:='[]'::jsonb;
  d jsonb; advice_state text;
BEGIN
  IF p_candidate.state='processing' THEN v:=v||jsonb_build_array(jsonb_build_object(
    'code','candidate_processing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'field',NULL,'safeMessage','Book analysis is still running.')); END IF;
  IF p_candidate.state='failed' THEN v:=v||jsonb_build_array(jsonb_build_object(
    'code','candidate_failed','candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'field',NULL,'safeMessage','Book analysis needs attention.')); END IF;
  IF r IS NULL THEN
    v:=v||jsonb_build_array(jsonb_build_object('code','review_missing',
      'candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field',NULL,
      'safeMessage','Review this book.'));
    RETURN v;
  END IF;
  IF coalesce((r#>>'{originalFieldConfirmation,title}')::boolean,false)=false
    THEN v:=v||jsonb_build_array(jsonb_build_object('code','title_unconfirmed','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','originalTitle','safeMessage','Confirm the title.')); END IF;
  IF jsonb_array_length(coalesce(r->'authors','[]')) <>
      jsonb_array_length(coalesce(r#>'{originalFieldConfirmation,authors}','[]'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(r#>'{originalFieldConfirmation,authors}','[]')) x WHERE x<>'true'::jsonb)
    THEN v:=v||jsonb_build_array(jsonb_build_object('code','author_confirmation_incomplete','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','authors','safeMessage','Confirm every author.')); END IF;
  IF coalesce(r->>'originalLanguage','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','language_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','originalLanguage','safeMessage','Choose a language.')); END IF;
  IF r->'metadataChoice' IS NULL OR r->'metadataChoice'='null'::jsonb THEN v:=v||jsonb_build_array(jsonb_build_object('code','metadata_choice_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','metadataChoice','safeMessage','Choose metadata.')); END IF;
  IF coalesce((r->>'quantity')::integer,0)<1 THEN v:=v||jsonb_build_array(jsonb_build_object('code','quantity_invalid','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','quantity','safeMessage','Enter a valid quantity.')); END IF;
  IF coalesce((r->>'priceMinor')::integer,-1)<0 OR (r->>'publicationIntent'='publish' AND coalesce((r->>'priceMinor')::integer,0)=0) THEN v:=v||jsonb_build_array(jsonb_build_object('code','price_invalid','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','priceMinor','safeMessage','Enter a valid price.')); END IF;
  IF coalesce(r->>'baseCondition','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','condition_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','baseCondition','safeMessage','Choose a condition.')); END IF;
  d:=r->'damageDisclosure';
  IF d IS NULL OR d='null'::jsonb THEN
    v:=v||jsonb_build_array(jsonb_build_object('code','damage_answer_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','damageDisclosure','safeMessage','Answer the damage question.'));
    v:=v||jsonb_build_array(jsonb_build_object('code','damage_details_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','damageDisclosure','safeMessage','Complete damage details.'));
  ELSIF coalesce((d->>'hasDamage')::boolean,false) AND
    (jsonb_array_length(coalesce(d->'damageTypes','[]'))=0 OR coalesce(d->>'damageNote','')='')
  THEN v:=v||jsonb_build_array(jsonb_build_object('code','damage_details_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','damageDisclosure','safeMessage','Complete damage details.')); END IF;
  IF coalesce(r->>'shelfLocation','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','location_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','shelfLocation','safeMessage','Enter a shelf location.')); END IF;
  IF coalesce(r->>'publicationIntent','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','publication_intent_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','publicationIntent','safeMessage','Choose a publication intent.')); END IF;
  advice_state:=p_candidate.duplicate_advice->>'state';
  IF advice_state IS NOT NULL AND advice_state<>'none' AND (r->'duplicateIntent' IS NULL OR r->'duplicateIntent'='null'::jsonb)
  THEN v:=v||jsonb_build_array(jsonb_build_object('code','duplicate_intent_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','duplicateIntent','safeMessage','Choose how to handle the possible duplicate.')); END IF;
  IF EXISTS(SELECT 1 FROM public.phase9_search_variant_proposals p
    WHERE p.candidate_id=p_candidate.id AND p.status='stale')
  THEN v:=v||jsonb_build_array(jsonb_build_object('code','variant_source_stale','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field',NULL,'safeMessage','Review changed search wording.')); END IF;
  RETURN v;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN v||jsonb_build_array(jsonb_build_object('code','quantity_invalid',
    'candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','quantity',
    'safeMessage','Enter valid review values.'));
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_candidate_detail(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_snapshot public.phase9_selected_metadata_snapshots; v_edition public.canonical_editions;
  v_state text; v_metadata jsonb; v_advice jsonb; v_blockers jsonb; v_versions jsonb;
  v_allowed jsonb;
BEGIN
  v_state:=marketplace_sec.phase9_owner_ux_metadata_state(p_candidate.id);
  IF v_state='selected' AND p_candidate.selected_metadata_snapshot_id IS NOT NULL THEN
    SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots x
      WHERE x.id=p_candidate.selected_metadata_snapshot_id AND x.candidate_id=p_candidate.id;
    IF v_snapshot.canonical_edition_id IS NOT NULL THEN
      SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_snapshot.canonical_edition_id;
      v_metadata:=jsonb_build_object(
        'title',v_edition.title,'authors',to_jsonb(v_edition.authors),
        'language',v_edition.language,'subtitle',v_edition.subtitle,'description',NULL,
        'isbn10',v_edition.isbn_10,'isbn13',v_edition.isbn_13,
        'publisher',v_edition.publisher,'publishedDate',v_edition.published_date,
        'script',NULL,'editionStatement',NULL,'series',NULL,'volume',NULL,
        'format',NULL,'pageCount',v_edition.page_count,
        'categories',to_jsonb(v_edition.categories),'coverReference',v_edition.cover_url);
    ELSE
      v_metadata:=jsonb_build_object(
        'title',v_snapshot.coherent_edition->>'title',
        'authors',coalesce(v_snapshot.coherent_edition->'authors','[]'::jsonb),
        'language',v_snapshot.coherent_edition->>'language',
        'subtitle',v_snapshot.coherent_edition->'subtitle',
        'description',v_snapshot.coherent_edition->'description',
        'isbn10',coalesce(v_snapshot.coherent_edition->'isbn10',v_snapshot.coherent_edition->'isbn_10'),
        'isbn13',coalesce(v_snapshot.coherent_edition->'isbn13',v_snapshot.coherent_edition->'isbn_13'),
        'publisher',v_snapshot.coherent_edition->'publisher',
        'publishedDate',coalesce(v_snapshot.coherent_edition->'publishedDate',v_snapshot.coherent_edition->'published_date'),
        'script',v_snapshot.coherent_edition->'script',
        'editionStatement',v_snapshot.coherent_edition->'editionStatement',
        'series',v_snapshot.coherent_edition->'series','volume',v_snapshot.coherent_edition->'volume',
        'format',v_snapshot.coherent_edition->'format',
        'pageCount',coalesce(v_snapshot.coherent_edition->'pageCount',v_snapshot.coherent_edition->'page_count'),
        'categories',coalesce(v_snapshot.coherent_edition->'categories','[]'::jsonb),
        'coverReference',coalesce(v_snapshot.coherent_edition->'coverReference',v_snapshot.coherent_edition->'cover_url'));
    END IF;
  END IF;
  v_advice:=coalesce(p_candidate.duplicate_advice,jsonb_build_object(
    'state','none','targetInventoryId',NULL,'matchReason',NULL,'compatibility',NULL,
    'display',NULL,'allowedIntents','[]'::jsonb));
  SELECT coalesce(jsonb_agg(b||jsonb_build_object('inputId',NULL)),'[]'::jsonb)
    INTO v_blockers
  FROM jsonb_array_elements(marketplace_sec.phase9_owner_ux_review_blockers(p_candidate)) b;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'proposalId',p.id,'version',p.lifecycle_version,
    'allowedActions',jsonb_build_array('approve','reject','replace')) ORDER BY p.id),'[]'::jsonb)
    INTO v_versions FROM public.phase9_search_variant_proposals p
    WHERE p.candidate_id=p_candidate.id AND p.status='proposed';
  v_allowed:=CASE WHEN p_candidate.state IN ('committed','commit_in_progress')
      OR p_candidate.review_disposition='skipped_false_detection'
    THEN jsonb_build_array('view_readiness')
    ELSE jsonb_build_array('save_review','mark_false',
      CASE WHEN jsonb_array_length(v_versions)>0 THEN 'open_variant_review' ELSE 'add_missed' END,
      'view_readiness') END;
  RETURN jsonb_build_object(
    'sessionId',p_session.id,'candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'ordinal',p_candidate.candidate_index,'candidateState',p_candidate.state,
    'candidateVersion',p_candidate.version,
    'observed',jsonb_build_object('title',coalesce(p_candidate.observed_title,'Untitled'),
      'authors',to_jsonb(p_candidate.observed_authors),
      'language',coalesce(p_candidate.observed_language,p_session.selected_language),
      'script',p_candidate.observed_script),
    'metadata',jsonb_build_object('state',v_state,'revision',p_candidate.metadata_revision,
      'selectionVersion',CASE WHEN v_snapshot.id IS NULL THEN NULL ELSE 1 END,
      'selectionId',v_snapshot.id,'canonicalEditionId',v_snapshot.canonical_edition_id,
      'snapshot',v_metadata),
    'review',jsonb_build_object('value',p_candidate.owner_review_snapshot->'value',
      'reviewVersion',p_candidate.review_version),
    'duplicateAdvice',jsonb_build_object('state',coalesce(v_advice->>'state','none'),
      'version',p_candidate.duplicate_advice_version,
      'targetInventoryId',v_advice->'targetInventoryId','matchReason',v_advice->'matchReason',
      'compatibility',v_advice->'compatibility','display',v_advice->'display',
      'allowedIntents',coalesce(v_advice->'allowedIntents','[]'::jsonb)),
    'variantSummary',jsonb_build_object('unresolvedCount',jsonb_array_length(v_versions),
      'proposalVersions',v_versions),
    'attentionCodes',marketplace_sec.phase9_owner_ux_attention(p_candidate),
    'readiness',jsonb_build_object('reviewReady',p_candidate.review_ready,
      'blockers',v_blockers,'derivedFromCandidateVersion',p_candidate.version,
      'derivedFromMetadataRevision',p_candidate.metadata_revision,
      'derivedFromDuplicateAdviceVersion',p_candidate.duplicate_advice_version),
    'allowedActions',v_allowed,'updatedAt',p_candidate.updated_at);
END$$;

CREATE FUNCTION public.phase9_owner_candidate_detail_v2(p_session_id uuid,p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  RETURN marketplace_sec.phase9_owner_ux_candidate_detail(v_session,v_candidate);
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_readiness(p_session public.image_extraction_sessions)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
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
      AND c.review_disposition IS DISTINCT FROM 'skipped_false_detection'
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
      AND c.review_disposition IS DISTINCT FROM 'skipped_false_detection'
      AND c.state NOT IN ('commit_in_progress','committed')
      AND jsonb_array_length(marketplace_sec.phase9_owner_ux_review_blockers(c))>0
    ORDER BY c.candidate_index,c.id LIMIT 1;
  v_close:=CASE WHEN p_session.status='closed' THEN 'closed'
    WHEN p_session.status='expired' THEN 'expired'
    WHEN p_session.status='active' AND v_terminal THEN 'closeable' ELSE 'not_closeable' END;
  v_allowed:=p_session.status='active' AND v_terminal;
  RETURN jsonb_build_object('sessionId',p_session.id,'sessionStatus',p_session.status,
    'sessionVersion',p_session.version,'allInputsTerminal',v_terminal,
    'closeSummary',marketplace_sec.phase9_owner_ux_close_summary(p_session.id),
    'blockerCounts',v_counts,'nextBlockingCandidateId',v_next,
    'closeState',v_close,'closeAllowed',v_allowed,
    'presentationRevision',p_session.presentation_revision);
END$$;

CREATE FUNCTION public.phase9_owner_session_readiness_v1(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions;
BEGIN
  v:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  RETURN marketplace_sec.phase9_owner_ux_readiness(v);
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_safe_text(
  p_value jsonb,p_min integer,p_max integer,p_nullable boolean
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v text;
BEGIN
  IF p_value IS NULL THEN RETURN false; END IF;
  IF p_value='null'::jsonb THEN RETURN p_nullable; END IF;
  IF jsonb_typeof(p_value)<>'string' THEN RETURN false; END IF;
  v:=p_value#>>'{}';
  RETURN char_length(v) BETWEEN p_min AND p_max
    AND v=btrim(v)
    AND v=normalize(v)
    AND v !~ '[[:cntrl:]]'
    AND v !~ U&'[\202A-\202E\2066-\2069]'
    AND v !~ '[[:space:]]{2,}'
    AND v !~* '(https?://|file://|javascript:|data:text/html)'
    AND v !~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'
    AND v !~ '\[[^]]+\]\([^)]*\)'
    AND v !~* '(^|[[:space:]])(\.\.?[/\\]|[A-Za-z]:\\|\\\\[^[:space:]\\]+\\[^[:space:]\\]+|/([^/[:space:]]+/)+[^/[:space:]]+)'
    AND v !~* '\m(SELECT[[:space:]].+[[:space:]]FROM|INSERT[[:space:]]+INTO|UPDATE[[:space:]].+[[:space:]]SET|DELETE[[:space:]]+FROM|DROP[[:space:]]+(TABLE|SCHEMA|DATABASE)|ALTER[[:space:]]+(TABLE|SCHEMA)|TRUNCATE[[:space:]]+TABLE)\M'
    AND v !~* '\m(curl|wget|powershell|cmd\.exe|bash|sh)[[:space:]]+[-/]'
    AND v !~* '\mrm[[:space:]]+-rf\M';
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_canonical_language(p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v text; v_parts text[]; v_canonical text; v_part text; i integer;
BEGIN
  IF jsonb_typeof(p_value)<>'string' THEN RETURN false; END IF;
  v:=p_value#>>'{}';
  IF char_length(v) NOT BETWEEN 2 AND 35 OR v<>btrim(v) OR v<>normalize(v)
    OR v !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
  THEN RETURN false; END IF;
  v_parts:=string_to_array(v,'-');
  v_canonical:=lower(v_parts[1]);
  IF cardinality(v_parts)>1 THEN
    FOR i IN 2..cardinality(v_parts) LOOP
      v_part:=v_parts[i];
      v_canonical:=v_canonical||'-'||CASE
        WHEN char_length(v_part)=4 AND v_part~'^[A-Za-z]+$'
          THEN upper(left(v_part,1))||lower(substr(v_part,2))
        WHEN (char_length(v_part)=2 AND v_part~'^[A-Za-z]+$')
          OR v_part~'^[0-9]{3}$' THEN upper(v_part)
        ELSE lower(v_part) END;
    END LOOP;
  END IF;
  RETURN v=v_canonical;
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_language_script(
  p_language text,p_script text,p_text text
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_base text:=split_part(p_language,'-',1); v_expected text;
  v_explicit text; v_letters text; v_matching text; v_part text;
BEGIN
  IF p_script IS NULL THEN RETURN true; END IF;
  IF p_script NOT IN ('Latn','Knda','Taml','Telu','Mlym','Deva','Arab','Mtei')
    THEN RETURN false; END IF;
  FOREACH v_part IN ARRAY string_to_array(p_language,'-') LOOP
    IF v_part~'^[A-Z][a-z]{3}$' THEN v_explicit:=v_part; EXIT; END IF;
  END LOOP;
  IF v_explicit IS NOT NULL AND v_explicit<>p_script THEN RETURN false; END IF;
  v_expected:=CASE v_base WHEN 'en' THEN 'Latn' WHEN 'kn' THEN 'Knda'
    WHEN 'ta' THEN 'Taml' WHEN 'te' THEN 'Telu' WHEN 'ml' THEN 'Mlym'
    WHEN 'hi' THEN 'Deva' WHEN 'ur' THEN 'Arab' WHEN 'mni' THEN 'Mtei' END;
  IF v_expected IS NOT NULL AND p_script NOT IN (v_expected,'Latn') THEN RETURN false; END IF;
  -- PostgreSQL deployments use a Unicode-aware locale for [:alpha:], while
  -- PGlite's test locale does not. Reject representative unsupported alphabetic
  -- blocks explicitly so both authorities fence mixed-script payloads.
  IF p_text~U&'[\0370-\052F\0590-\05FF\0E00-\0EFF\2E80-\A4CF\AC00-\D7AF]'
    THEN RETURN false; END IF;
  -- Count every Unicode alphabetic character in the denominator. Restricting
  -- this to supported blocks would silently discard foreign-script letters.
  v_letters:=regexp_replace(p_text,'[^[:alpha:]]','','g');
  v_matching:=CASE p_script
    WHEN 'Latn' THEN regexp_replace(p_text,U&'[^A-Za-z\00C0-\024F]','','g')
    WHEN 'Arab' THEN regexp_replace(p_text,U&'[^\0600-\06FF]','','g')
    WHEN 'Deva' THEN regexp_replace(p_text,U&'[^\0900-\097F]','','g')
    WHEN 'Taml' THEN regexp_replace(p_text,U&'[^\0B80-\0BFF]','','g')
    WHEN 'Telu' THEN regexp_replace(p_text,U&'[^\0C00-\0C7F]','','g')
    WHEN 'Knda' THEN regexp_replace(p_text,U&'[^\0C80-\0CFF]','','g')
    WHEN 'Mlym' THEN regexp_replace(p_text,U&'[^\0D00-\0D7F]','','g')
    WHEN 'Mtei' THEN regexp_replace(p_text,U&'[^\ABC0-\ABFF]','','g') END;
  RETURN char_length(v_letters)>0
    AND char_length(v_matching)::numeric/char_length(v_letters)>=0.6;
END$$;

CREATE FUNCTION marketplace_sec.phase9_owner_ux_valid_review(p_review jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_keys text[]; v_authors jsonb; v_confirmations jsonb; v_damage jsonb;
  v_choice jsonb; v_duplicate jsonb;
BEGIN
  IF jsonb_typeof(p_review)<>'object' THEN RETURN false; END IF;
  SELECT array_agg(k ORDER BY k) INTO v_keys FROM jsonb_object_keys(p_review) k;
  IF v_keys IS DISTINCT FROM ARRAY[
    'authors','baseCondition','candidateDisposition','damageDisclosure','duplicateIntent',
    'metadataChoice','notes','originalFieldConfirmation','originalLanguage','originalTitle',
    'priceMinor','publicationIntent','quantity','script','shelfLocation'] THEN RETURN false; END IF;
  IF NOT marketplace_sec.phase9_owner_ux_safe_text(p_review->'originalTitle',1,512,false)
    OR NOT marketplace_sec.phase9_owner_ux_canonical_language(p_review->'originalLanguage')
    OR (p_review->'script'<>'null'::jsonb AND
      (jsonb_typeof(p_review->'script')<>'string' OR p_review->>'script' !~ '^[A-Z][a-z]{3}$'))
    OR jsonb_typeof(p_review->'baseCondition')<>'string'
    OR p_review->>'baseCondition' NOT IN ('new','like_new','very_good','good','acceptable')
    OR jsonb_typeof(p_review->'candidateDisposition')<>'string'
    OR p_review->>'candidateDisposition'<>'reviewed'
    OR jsonb_typeof(p_review->'publicationIntent')<>'string'
    OR p_review->>'publicationIntent' NOT IN ('private','publish')
    OR jsonb_typeof(p_review->'quantity')<>'number'
    OR jsonb_typeof(p_review->'priceMinor')<>'number'
    OR (p_review->>'quantity')::numeric<>trunc((p_review->>'quantity')::numeric)
    OR (p_review->>'priceMinor')::numeric<>trunc((p_review->>'priceMinor')::numeric)
    OR (p_review->>'quantity')::numeric NOT BETWEEN 1 AND 10000
    OR (p_review->>'priceMinor')::numeric NOT BETWEEN 0 AND 2147483647
    OR (p_review->>'publicationIntent'='publish' AND (p_review->>'priceMinor')::numeric=0)
    OR NOT marketplace_sec.phase9_owner_ux_safe_text(p_review->'shelfLocation',1,120,false)
    OR NOT marketplace_sec.phase9_owner_ux_language_script(
      p_review->>'originalLanguage',p_review->>'script',
      concat_ws(' ',p_review->>'originalTitle',
        (SELECT string_agg(a,' ') FROM jsonb_array_elements_text(p_review->'authors') a)))
  THEN RETURN false; END IF;
  v_authors:=p_review->'authors'; v_confirmations:=p_review#>'{originalFieldConfirmation,authors}';
  IF jsonb_typeof(v_authors)<>'array' OR jsonb_array_length(v_authors)>20
    OR jsonb_typeof(p_review->'originalFieldConfirmation')<>'object'
    OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_review->'originalFieldConfirmation') k)
      IS DISTINCT FROM ARRAY['authors','title']
    OR jsonb_typeof(p_review#>'{originalFieldConfirmation,title}')<>'boolean'
    OR coalesce((p_review#>>'{originalFieldConfirmation,title}')::boolean,false)=false
    OR jsonb_typeof(v_confirmations)<>'array'
    OR jsonb_array_length(v_authors)<>jsonb_array_length(v_confirmations)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_authors) a
      WHERE NOT marketplace_sec.phase9_owner_ux_safe_text(a,1,256,false))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_confirmations) a
      WHERE jsonb_typeof(a)<>'boolean' OR a<>'true'::jsonb)
    OR (SELECT count(*) FROM jsonb_array_elements_text(v_authors))
      <>(SELECT count(DISTINCT lower(a)) FROM jsonb_array_elements_text(v_authors) a)
  THEN RETURN false; END IF;
  v_choice:=p_review->'metadataChoice';
  IF jsonb_typeof(v_choice)<>'object'
    OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_choice) k)
      IS DISTINCT FROM ARRAY['mode','selectionId']
    OR jsonb_typeof(v_choice->'mode')<>'string'
    OR v_choice->>'mode' NOT IN ('manual','selected')
    OR (v_choice->>'mode'='manual' AND v_choice->'selectionId'<>'null'::jsonb)
    OR (v_choice->>'mode'='selected' AND
      (jsonb_typeof(v_choice->'selectionId')<>'string'
        OR (v_choice->>'selectionId')::uuid IS NULL))
  THEN RETURN false; END IF;
  v_damage:=p_review->'damageDisclosure';
  IF jsonb_typeof(v_damage)<>'object'
    OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_damage) k)
      IS DISTINCT FROM ARRAY['completeReadableSafe','damageNote','damageTypes','hasDamage','isSellable']
    OR jsonb_typeof(v_damage->'hasDamage')<>'boolean'
    OR jsonb_typeof(v_damage->'isSellable')<>'boolean'
    OR jsonb_typeof(v_damage->'completeReadableSafe')<>'boolean'
    OR jsonb_typeof(v_damage->'damageTypes')<>'array'
    OR jsonb_array_length(v_damage->'damageTypes')>9
    OR NOT marketplace_sec.phase9_owner_ux_safe_text(v_damage->'damageNote',1,1000,true)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_damage->'damageTypes') x
      WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' NOT IN ('cover','binding','pages','water','staining','writing',
        'missing_parts','mould_or_contamination','other'))
    OR (SELECT count(*) FROM jsonb_array_elements_text(v_damage->'damageTypes'))
      <>(SELECT count(DISTINCT x) FROM jsonb_array_elements_text(v_damage->'damageTypes') x)
    OR ((v_damage->>'hasDamage')::boolean AND
      (jsonb_array_length(v_damage->'damageTypes')=0 OR coalesce(char_length(btrim(v_damage->>'damageNote')),0)=0))
    OR (NOT (v_damage->>'hasDamage')::boolean AND
      (jsonb_array_length(v_damage->'damageTypes')>0 OR v_damage->'damageNote'<>'null'::jsonb))
    OR ((v_damage->>'isSellable')::boolean AND NOT (v_damage->>'completeReadableSafe')::boolean)
    OR ((NOT (v_damage->>'isSellable')::boolean OR NOT (v_damage->>'completeReadableSafe')::boolean)
      AND p_review->>'publicationIntent'<>'private')
  THEN RETURN false; END IF;
  IF jsonb_typeof(p_review->'notes')<>'object'
    OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_review->'notes') k)
      IS DISTINCT FROM ARRAY['internalNote','publicNote']
    OR NOT marketplace_sec.phase9_owner_ux_safe_text(p_review#>'{notes,publicNote}',1,1000,true)
    OR NOT marketplace_sec.phase9_owner_ux_safe_text(p_review#>'{notes,internalNote}',1,1000,true)
  THEN RETURN false; END IF;
  v_duplicate:=p_review->'duplicateIntent';
  IF v_duplicate IS NOT NULL AND v_duplicate<>'null'::jsonb THEN
    IF jsonb_typeof(v_duplicate)<>'object'
      OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_duplicate) k)
        IS DISTINCT FROM ARRAY['action','adviceVersion','targetInventoryId']
      OR v_duplicate->>'action' NOT IN ('increment_quantity','create_separate','manual_match')
      OR jsonb_typeof(v_duplicate->'adviceVersion')<>'number'
      OR (v_duplicate->>'adviceVersion')::numeric<>trunc((v_duplicate->>'adviceVersion')::numeric)
      OR (v_duplicate->>'adviceVersion')::numeric NOT BETWEEN 1 AND 2147483647
      OR (v_duplicate->>'action' IN ('increment_quantity','manual_match')
        AND (jsonb_typeof(v_duplicate->'targetInventoryId')<>'string'
          OR (v_duplicate->>'targetInventoryId')::uuid IS NULL))
      OR (v_duplicate->>'action'='create_separate'
        AND v_duplicate->'targetInventoryId'<>'null'::jsonb)
    THEN RETURN false; END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE FUNCTION public.phase9_update_candidate_review_v2(
  p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,
  p_expected_metadata_revision integer,p_review jsonb,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_fingerprint text; v_replay jsonb; v_response jsonb; v_choice jsonb; v_duplicate jsonb;
  v_blockers jsonb;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id FOR UPDATE;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF p_expected_candidate_version<1 OR p_expected_metadata_revision<1
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR NOT marketplace_sec.phase9_owner_ux_valid_review(p_review)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,p_candidate_id,
    p_expected_candidate_version,p_expected_metadata_revision,p_review::text,p_command_id),'sha256'),'hex');
  -- phase9_replay raises P9_IDEMPOTENCY_MISMATCH for the same key with changed request.
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U6C01',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF v_candidate.metadata_revision<>p_expected_metadata_revision THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF v_candidate.version<>p_expected_candidate_version THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
  IF v_candidate.state NOT IN ('ready','needs_review','possible_duplicate')
    OR v_candidate.review_disposition='skipped_false_detection'
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_choice:=p_review->'metadataChoice';
  IF v_choice->>'mode'='selected' AND NOT EXISTS(
    SELECT 1 FROM public.phase9_selected_metadata_snapshots s
    WHERE s.id=(v_choice->>'selectionId')::uuid AND s.candidate_id=v_candidate.id
      AND s.store_id=v_candidate.store_id
      AND s.id=v_candidate.selected_metadata_snapshot_id)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_duplicate:=p_review->'duplicateIntent';
  IF v_candidate.duplicate_advice IS NOT NULL
    AND coalesce(v_candidate.duplicate_advice->>'state','none')<>'none'
    AND (v_duplicate IS NULL OR v_duplicate='null'::jsonb)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_duplicate IS NOT NULL AND v_duplicate<>'null'::jsonb AND (
    (v_duplicate->>'adviceVersion')::integer IS DISTINCT FROM v_candidate.duplicate_advice_version
    OR NOT (coalesce(v_candidate.duplicate_advice->'allowedIntents','[]'::jsonb)
      ? (v_duplicate->>'action'))
    OR (v_duplicate->>'action' IN ('increment_quantity','manual_match')
      AND (v_duplicate->>'targetInventoryId')::uuid IS DISTINCT FROM
        (v_candidate.duplicate_advice->>'targetInventoryId')::uuid)
  ) THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  v_candidate.owner_review_snapshot:=jsonb_build_object(
    'value',p_review,
    'confirmed_title',jsonb_build_object('value',p_review->>'originalTitle'),
    'confirmed_authors',coalesce(p_review->'authors','[]'::jsonb));
  v_candidate.review_disposition:='reviewed';
  v_candidate.review_ready:=true;
  v_candidate.state:='ready';
  v_blockers:=marketplace_sec.phase9_owner_ux_review_blockers(v_candidate);
  IF jsonb_array_length(v_blockers)>0 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.image_extraction_candidates SET
    owner_review_snapshot=jsonb_build_object('value',p_review,
      'confirmed_title',jsonb_build_object('value',p_review->>'originalTitle'),
      'confirmed_authors',coalesce(p_review->'authors','[]'::jsonb)),
    review_disposition='reviewed',review_ready=true,
    review_version=coalesce(review_version,0)+1,state='ready',version=version+1,
    updated_at=transaction_timestamp()
    WHERE id=v_candidate.id RETURNING * INTO v_candidate;
  SELECT * INTO v_session FROM public.image_extraction_sessions s WHERE s.id=p_session_id;
  v_response:=marketplace_sec.phase9_owner_ux_candidate_detail(v_session,v_candidate);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U6C01',
    p_idempotency_key,v_response,'review_saved_no_unit7_effect');
  RETURN v_response;
END$$;

CREATE FUNCTION public.phase9_close_session_v2(
  p_session_id uuid,p_expected_session_version integer,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_fingerprint text;
  v_replay jsonb; v_response jsonb;
BEGIN
  PERFORM marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_session FROM public.image_extraction_sessions s
    WHERE s.id=p_session_id FOR UPDATE;
  IF p_expected_session_version<1 OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,
    p_expected_session_version,p_command_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U6C02',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF v_session.status<>'active' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_session.version<>p_expected_session_version THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id
    AND i.state NOT IN ('ready','failed','skipped')) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.image_extraction_sessions SET status='closed',closed_at=transaction_timestamp(),
    version=version+1,presentation_revision=presentation_revision+1,
    updated_at=transaction_timestamp() WHERE id=p_session_id RETURNING * INTO v_session;
  -- Trigger effects are part of the same snapshot, so refetch the canonical version.
  SELECT * INTO v_session FROM public.image_extraction_sessions s WHERE s.id=p_session_id;
  v_response:=marketplace_sec.phase9_owner_ux_readiness(v_session);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U6C02',
    p_idempotency_key,v_response,'session_closed_no_unit7_effect');
  RETURN v_response;
END$$;

ALTER FUNCTION public.phase9_owner_discover_session_v1() OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_session_summary_v2(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_candidates_page_v2(text,uuid,text,integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_update_candidate_review_v2(uuid,uuid,integer,integer,jsonb,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_session_readiness_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_close_session_v2(uuid,integer,text,uuid) OWNER TO postgres;

-- Internal helpers are never part of the authenticated contract surface. PostgreSQL
-- grants EXECUTE to PUBLIC by default, so revoke every helper explicitly, including
-- the inherited idempotency helpers used by the Unit 6A mutation wrappers.
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_bump_scope() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_input_session_fence() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_metadata_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_lookup_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_variant_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_assert_owner() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_assert_session(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_cursor(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_cursor_payload(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_needs_review(public.image_extraction_candidates,public.image_extraction_sessions,timestamp with time zone) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_close_summary(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_attention(public.image_extraction_candidates) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_candidate_summary(public.image_extraction_candidates,public.image_extraction_sessions) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(public.image_extraction_candidates) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_candidate_detail(public.image_extraction_sessions,public.image_extraction_candidates) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_readiness(public.image_extraction_sessions) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_safe_text(jsonb,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_canonical_language(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_language_script(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_valid_review(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_replay(text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finish_replay(text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.phase9_owner_discover_session_v1() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_owner_session_summary_v2(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_owner_candidates_page_v2(text,uuid,text,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_update_candidate_review_v2(uuid,uuid,integer,integer,jsonb,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_owner_session_readiness_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase9_close_session_v2(uuid,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase9_owner_discover_session_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_session_summary_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_candidates_page_v2(text,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_update_candidate_review_v2(uuid,uuid,integer,integer,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_session_readiness_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_close_session_v2(uuid,integer,text,uuid) TO authenticated;

COMMIT;
