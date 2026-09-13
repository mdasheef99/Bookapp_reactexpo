BEGIN;

-- Unit 6I: retain one separately labelled representative-edition cover when the
-- accepted coherent edition has no cover. The exact-edition metadata snapshot
-- remains unchanged, and no existing rows are backfilled.

CREATE TABLE marketplace_sec.phase9_metadata_representative_covers (
  source_attempt_id uuid PRIMARY KEY
    REFERENCES public.metadata_enrichment_attempts(id),
  source_lookup_id uuid NOT NULL REFERENCES public.phase9_metadata_lookups(id),
  source_candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  source_store_id uuid NOT NULL REFERENCES public.stores(id),
  source_job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  cover_reference text NOT NULL CHECK (
    char_length(cover_reference) BETWEEN 1 AND 512
    AND cover_reference
      ~* '^https://books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?$'),
  adapter_key text NOT NULL CHECK (adapter_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  adapter_version text NOT NULL CHECK (char_length(adapter_version) BETWEEN 1 AND 64),
  source_provider_record_id text NOT NULL CHECK (
    char_length(source_provider_record_id) BETWEEN 1 AND 256),
  source_relation text NOT NULL CHECK (source_relation='representative_edition'),
  selection_policy_version text NOT NULL CHECK (
    selection_policy_version='p9-representative-cover-v1'),
  match_evidence jsonb NOT NULL CHECK (
    match_evidence='["exact_title","exact_author_set","language_compatible"]'::jsonb),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

ALTER TABLE marketplace_sec.phase9_metadata_representative_covers
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_sec.phase9_metadata_representative_covers
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_reject_metadata_representative_cover_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'P9_METADATA_REPRESENTATIVE_COVER_IMMUTABLE';
END$$;
CREATE TRIGGER phase9_metadata_representative_cover_immutable
  BEFORE UPDATE OR DELETE ON marketplace_sec.phase9_metadata_representative_covers
  FOR EACH ROW EXECUTE FUNCTION
    marketplace_sec.phase9_reject_metadata_representative_cover_mutation();

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_store_metadata_representative_cover_v1(
  p_attempt_id uuid,p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_candidate_id uuid,p_candidate_version integer,
  p_cover_reference text,p_source_provider_record_id text,p_source_relation text,
  p_selection_policy_version text,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_candidate public.image_extraction_candidates;
  v_lookup public.phase9_metadata_lookups;
  v_attempt public.metadata_enrichment_attempts;
  v_existing marketplace_sec.phase9_metadata_representative_covers;
BEGIN
  IF p_attempt_id IS NULL OR p_lookup_id IS NULL OR p_candidate_id IS NULL
    OR p_cover_reference !~* '^https://books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?$'
    OR char_length(p_cover_reference) NOT BETWEEN 1 AND 512
    OR char_length(p_source_provider_record_id) NOT BETWEEN 1 AND 256
    OR p_source_relation<>'representative_edition'
    OR p_selection_policy_version<>'p9-representative-cover-v1'
    OR p_match_evidence<>'["exact_title","exact_author_set","language_compatible"]'::jsonb
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  SELECT * INTO v_existing
  FROM marketplace_sec.phase9_metadata_representative_covers r
  WHERE r.source_attempt_id=p_attempt_id;
  IF FOUND THEN
    IF v_existing.cover_reference<>p_cover_reference
      OR v_existing.source_lookup_id<>p_lookup_id
      OR v_existing.source_candidate_id<>p_candidate_id
      OR v_existing.source_job_id<>p_job_id
      OR v_existing.source_provider_record_id<>p_source_provider_record_id
      OR v_existing.source_relation<>p_source_relation
      OR v_existing.selection_policy_version<>p_selection_policy_version
      OR v_existing.match_evidence<>p_match_evidence
    THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
    RETURN jsonb_build_object('source_attempt_id',v_existing.source_attempt_id,
      'status','replayed');
  END IF;

  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.id=p_lookup_id AND l.job_id=p_job_id
      AND l.candidate_id=v_candidate.id AND l.store_id=v_candidate.store_id;
  SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts a
    WHERE a.id=p_attempt_id AND a.lookup_id=p_lookup_id
      AND a.disposition='accepted' AND a.normalized_outcome='accepted_metadata_match';
  IF v_lookup.id IS NULL OR v_attempt.id IS NULL
    OR v_attempt.normalized_payload IS NULL
    OR coalesce(v_attempt.normalized_payload->>'coverReference','')<>''
    OR v_attempt.normalized_payload->>'providerRecordId'=p_source_provider_record_id
    OR v_attempt.adapter_key IS NULL OR v_attempt.adapter_version IS NULL
    OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
      WHERE r.adapter_key=v_attempt.adapter_key
        AND r.adapter_version=v_attempt.adapter_version
        AND r.provider_kind='metadata' AND r.enabled AND r.storage_allowed)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  INSERT INTO marketplace_sec.phase9_metadata_representative_covers(
    source_attempt_id,source_lookup_id,source_candidate_id,source_store_id,source_job_id,
    cover_reference,adapter_key,adapter_version,
    source_provider_record_id,source_relation,selection_policy_version,match_evidence)
  VALUES(p_attempt_id,p_lookup_id,v_candidate.id,v_candidate.store_id,p_job_id,
    p_cover_reference,v_attempt.adapter_key,v_attempt.adapter_version,
    p_source_provider_record_id,p_source_relation,p_selection_policy_version,p_match_evidence)
  ON CONFLICT(source_attempt_id) DO NOTHING;
  SELECT * INTO v_existing
  FROM marketplace_sec.phase9_metadata_representative_covers r
  WHERE r.source_attempt_id=p_attempt_id;
  IF v_existing.cover_reference<>p_cover_reference
    OR v_existing.source_lookup_id<>p_lookup_id
    OR v_existing.source_candidate_id<>p_candidate_id
    OR v_existing.source_job_id<>p_job_id
    OR v_existing.source_provider_record_id<>p_source_provider_record_id
    OR v_existing.source_relation<>p_source_relation
    OR v_existing.selection_policy_version<>p_selection_policy_version
    OR v_existing.match_evidence<>p_match_evidence
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('source_attempt_id',v_existing.source_attempt_id,'status','stored');
END$$;

CREATE OR REPLACE FUNCTION public.phase9_store_metadata_representative_cover_v1(
  p_attempt_id uuid,p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_candidate_id uuid,p_candidate_version integer,
  p_cover_reference text,p_source_provider_record_id text,p_source_relation text,
  p_selection_policy_version text,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_store_metadata_representative_cover_v1(
    p_attempt_id,p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,
    p_candidate_id,p_candidate_version,p_cover_reference,p_source_provider_record_id,
    p_source_relation,p_selection_policy_version,p_match_evidence)
$$;

ALTER TABLE public.store_inventory ADD COLUMN representative_cover jsonb;
ALTER TABLE public.store_inventory ADD CONSTRAINT store_inventory_representative_cover_check
  CHECK (representative_cover IS NULL OR (
    jsonb_typeof(representative_cover)='object'
    AND representative_cover ?& ARRAY['coverReference','sourceRelation','sourceAdapter',
      'sourceAdapterVersion','sourceRecordId','selectionPolicyVersion']
    AND representative_cover-ARRAY['coverReference','sourceRelation','sourceAdapter',
      'sourceAdapterVersion','sourceRecordId','selectionPolicyVersion']='{}'::jsonb
    AND jsonb_typeof(representative_cover->'coverReference')='string'
    AND representative_cover->>'coverReference'
      ~* '^https://books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?$'
    AND representative_cover->>'sourceRelation'='representative_edition'
    AND representative_cover->>'sourceAdapter' ~ '^[a-z][a-z0-9_-]{1,63}$'
    AND char_length(representative_cover->>'sourceAdapterVersion') BETWEEN 1 AND 64
    AND char_length(representative_cover->>'sourceRecordId') BETWEEN 1 AND 256
    AND representative_cover->>'selectionPolicyVersion'='p9-representative-cover-v1'));

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
      AND coalesce(s.coherent_edition->>'coverReference','')='';
    NEW.representative_cover:=v_cover;
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER phase9_store_inventory_representative_cover
  BEFORE INSERT OR UPDATE OF representative_cover,created_from_candidate_id,entry_method
  ON public.store_inventory FOR EACH ROW EXECUTE FUNCTION
    marketplace_sec.phase9_set_inventory_representative_cover();

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_metadata jsonb:=p_detail#>'{metadata,snapshot}';
  v_selected boolean; v_title boolean; v_authors boolean; v_language boolean;
  v_cover boolean; v_selection_id boolean; v_selection uuid; v_representative jsonb;
BEGIN
  v_selected:=p_detail#>>'{metadata,state}'='selected'
    AND jsonb_typeof(v_metadata)='object';
  IF NOT v_selected THEN RETURN NULL; END IF;
  v_title:=marketplace_sec.phase9_owner_ux_safe_text(v_metadata->'title',1,512,false);
  v_authors:=CASE WHEN jsonb_typeof(v_metadata->'authors')='array' THEN
      jsonb_array_length(v_metadata->'authors') BETWEEN 1 AND 20
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_metadata->'authors') author
        WHERE NOT marketplace_sec.phase9_owner_ux_safe_text(author,1,256,false))
      AND (SELECT count(*) FROM jsonb_array_elements(v_metadata->'authors'))
        =(SELECT count(DISTINCT author) FROM jsonb_array_elements(v_metadata->'authors') author)
    ELSE false END;
  v_language:=marketplace_sec.phase9_owner_ux_canonical_language(v_metadata->'language');
  v_cover:=jsonb_typeof(v_metadata->'coverReference')='string'
    AND char_length(v_metadata->>'coverReference') BETWEEN 1 AND 512
    AND v_metadata->>'coverReference'
      ~* '^https://books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?$';
  v_selection_id:=jsonb_typeof(p_detail#>'{metadata,selectionId}')='string'
    AND p_detail#>>'{metadata,selectionId}'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  IF v_selection_id AND NOT v_cover THEN
    v_selection:=(p_detail#>>'{metadata,selectionId}')::uuid;
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_representative
    FROM public.phase9_selected_metadata_snapshots s
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
    WHERE s.id=v_selection;
  END IF;
  RETURN jsonb_build_object(
    'title',CASE WHEN v_title THEN v_metadata->'title' ELSE 'null'::jsonb END,
    'authors',CASE WHEN v_authors THEN v_metadata->'authors' ELSE 'null'::jsonb END,
    'language',CASE WHEN v_language THEN v_metadata->'language' ELSE 'null'::jsonb END,
    'coverReference',CASE WHEN v_cover THEN v_metadata->'coverReference' ELSE 'null'::jsonb END,
    'selectionId',CASE WHEN v_selection_id
      THEN p_detail#>'{metadata,selectionId}' ELSE 'null'::jsonb END,
    'representativeCover',coalesce(v_representative,'null'::jsonb));
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_detail jsonb; v_summary jsonb; v_sources jsonb; v_actions jsonb;
BEGIN
  v_detail:=marketplace_sec.phase9_owner_ux_candidate_detail(p_session,p_candidate);
  v_summary:=marketplace_sec.phase9_unit6g_metadata_summary(v_detail);
  v_sources:=marketplace_sec.phase9_unit6g_field_sources(p_session,p_candidate,v_detail);
  IF jsonb_typeof(v_summary->'representativeCover')='object' THEN
    v_sources:=jsonb_set(v_sources,'{cover}','"representative"'::jsonb);
  END IF;
  IF marketplace_sec.phase9_owner_ux_session_mutable(p_session) THEN
    v_actions:=jsonb_build_array('view_metadata','remove_from_scan','view_readiness');
    IF p_candidate.state IN ('ready','needs_review','possible_duplicate') THEN
      v_actions:=v_actions||'"save_review"'::jsonb;
    END IF;
    IF marketplace_sec.phase9_unit7a_commit_eligible(p_candidate) THEN
      v_actions:=v_actions||'"add_to_inventory"'::jsonb;
    END IF;
  ELSE
    v_actions:=jsonb_build_array('view_metadata','view_readiness');
  END IF;
  RETURN jsonb_build_object(
    'sessionId',p_session.id,'candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'ordinal',p_candidate.candidate_index,'candidateState',p_candidate.state,
    'candidateVersion',p_candidate.version,'metadataState',v_detail#>'{metadata,state}',
    'metadataRevision',p_candidate.metadata_revision,'reviewVersion',p_candidate.review_version,
    'reviewDisposition',p_candidate.review_disposition,'observed',v_detail->'observed',
    'metadataSummary',v_summary,'review',v_detail#>'{review,value}',
    'fieldSources',v_sources,'attentionCodes',v_detail->'attentionCodes',
    'blockers',v_detail#>'{readiness,blockers}','reviewReady',p_candidate.review_ready,
    'allowedActions',v_actions,'updatedAt',p_candidate.updated_at);
END$$;

ALTER FUNCTION marketplace_sec.phase9_reject_metadata_representative_cover_mutation()
  OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_store_metadata_representative_cover_v1(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_store_metadata_representative_cover_v1(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_set_inventory_representative_cover() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_reject_metadata_representative_cover_mutation()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_store_metadata_representative_cover_v1(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_store_metadata_representative_cover_v1(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.phase9_store_metadata_representative_cover_v1(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_store_metadata_representative_cover_v1(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_set_inventory_representative_cover()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates)
  FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
