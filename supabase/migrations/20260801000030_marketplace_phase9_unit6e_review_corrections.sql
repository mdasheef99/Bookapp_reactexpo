BEGIN;

-- Phase 9 Unit 6E: accept both the original canonical confirmation envelope and
-- the Unit 6D/U6C01 review envelope. Existing grants and ownership are preserved.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_confirmed_variant_source(
  p_candidate public.image_extraction_candidates,
  p_proposal public.phase9_search_variant_proposals
) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=''
AS $function$
DECLARE
  v_value jsonb;
  v_review jsonb;
  v_confirmed boolean:=false;
  v_text text;
BEGIN
  IF p_candidate.owner_review_snapshot IS NULL
    OR jsonb_typeof(p_candidate.owner_review_snapshot)<>'object' THEN
    RETURN NULL;
  END IF;
  IF p_proposal.target_type='title' THEN
    v_value:=p_candidate.owner_review_snapshot->'confirmed_title';
  ELSIF jsonb_typeof(p_candidate.owner_review_snapshot->'confirmed_authors')='array' THEN
    SELECT entry INTO v_value
    FROM jsonb_array_elements(p_candidate.owner_review_snapshot->'confirmed_authors') entry
    WHERE jsonb_typeof(entry)='object'
      AND jsonb_typeof(entry->'index')='number'
      AND (entry->>'index')::integer=p_proposal.author_index
    LIMIT 1;
  END IF;
  IF jsonb_typeof(v_value)='object'
    AND v_value->>'confirmed'='true'
    AND jsonb_typeof(v_value->'text')='string'
    AND jsonb_typeof(v_value->'language')='string'
    AND jsonb_typeof(v_value->'script')='string'
    AND coalesce(char_length(trim(v_value->>'text')),0)>0 THEN
    RETURN v_value;
  END IF;

  v_review:=p_candidate.owner_review_snapshot->'value';
  IF jsonb_typeof(v_review)<>'object' THEN RETURN NULL; END IF;
  IF p_proposal.target_type='title' THEN
    v_confirmed:=v_review->'originalFieldConfirmation'->'title'='true'::jsonb;
    v_text:=v_review->>'originalTitle';
  ELSIF p_proposal.target_type='author'
    AND p_proposal.author_index BETWEEN 1 AND 20
    AND jsonb_typeof(v_review->'authors')='array'
    AND jsonb_typeof(v_review->'originalFieldConfirmation'->'authors')='array'
    AND jsonb_array_length(v_review->'authors')>=p_proposal.author_index
    AND jsonb_array_length(v_review->'originalFieldConfirmation'->'authors')>=p_proposal.author_index THEN
    v_confirmed:=v_review->'originalFieldConfirmation'->'authors'
      ->(p_proposal.author_index-1)='true'::jsonb;
    v_text:=v_review->'authors'->>(p_proposal.author_index-1);
  END IF;
  IF NOT v_confirmed OR coalesce(char_length(trim(v_text)),0)<1
    OR jsonb_typeof(v_review->'originalLanguage')<>'string'
    OR jsonb_typeof(v_review->'script')<>'string' THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'confirmed',true,'text',v_text,
    'language',v_review->>'originalLanguage','script',v_review->>'script');
END
$function$;

-- M24 exposes the mobile contract's zero-based author position while retaining
-- the database proposal's one-based author_index internally.
CREATE OR REPLACE FUNCTION public.phase9_owner_search_variant_review(
  p_store_id uuid,
  p_status text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_proposal_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
) RETURNS TABLE(
  proposal_id uuid,concurrency_version integer,target_type text,
  author_position smallint,confirmed_source_text text,proposed_text text,
  variant_type text,source_language text,source_script text,
  variant_language text,variant_script text,lifecycle_status text,
  generation_source text,provider_key text,model_key text,model_version text,
  prompt_version text,schema_version text,
  automatic_activation_denial_reason text,stale_conflict_reason text,
  created_at timestamptz,allowed_actions text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NOT marketplace_sec.phase9_owner_variant_authorized(p_store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100
    OR (p_status IS NOT NULL AND p_status NOT IN ('proposed','active','rejected','stale'))
    OR (p_target_type IS NOT NULL AND p_target_type NOT IN ('title','author'))
    OR ((p_cursor_created_at IS NULL)<>(p_cursor_proposal_id IS NULL)) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  RETURN QUERY
  SELECT p.id,p.lifecycle_version,p.target_type,
    CASE WHEN p.target_type='author' THEN (p.author_index-1)::smallint ELSE NULL END,
    confirmed->>'text',p.variant_text,p.variant_type,p.source_language,
    p.source_script,p.variant_language,p.variant_script,p.status,
    p.generation_source,p.provider_key,p.model_key,p.model_version,
    p.prompt_version,p.proposal_schema_version,
    CASE WHEN p.status<>'proposed' THEN 'lifecycle_not_proposed'
      WHEN p.variant_type<>'primary_roman' THEN 'manual_review_required'
      ELSE 'rollout_not_approved' END,
    CASE WHEN p.status='stale' THEN p.lifecycle_reason
      WHEN outcome IN ('conflicting','materially_changed','invalid_source_reference')
        THEN outcome ELSE NULL END,
    p.created_at,
    CASE
      WHEN p.status IN ('proposed','stale') AND outcome='equivalent'
        THEN ARRAY['approve','reject','replace','leave_unresolved']::text[]
      WHEN p.status IN ('proposed','stale')
        THEN ARRAY['reject','replace','leave_unresolved']::text[]
      WHEN p.status='active'
        THEN ARRAY['reject','replace','leave_unresolved']::text[]
      ELSE ARRAY['leave_unresolved']::text[] END
  FROM public.phase9_search_variant_proposals p
  JOIN public.image_extraction_candidates c
    ON c.id=p.candidate_id AND c.store_id=p.store_id
  CROSS JOIN LATERAL (
    SELECT marketplace_sec.phase9_confirmed_variant_source(c,p)
  ) source(confirmed)
  CROSS JOIN LATERAL (
    SELECT marketplace_sec.phase9_variant_reconciliation_outcome(c,p)
  ) reconciliation(outcome)
  WHERE p.store_id=p_store_id
    AND (p_status IS NULL OR p.status=p_status)
    AND (p_target_type IS NULL OR p.target_type=p_target_type)
    AND (p_cursor_created_at IS NULL
      OR (p.created_at,p.id)<(p_cursor_created_at,p_cursor_proposal_id))
    AND confirmed IS NOT NULL
  ORDER BY p.created_at DESC,p.id DESC LIMIT p_limit;
END
$function$;

-- U6Q05 must expose stale proposal identities as the canonical M24 recovery entry.
CREATE OR REPLACE FUNCTION public.phase9_owner_candidate_detail_v2(
  p_session_id uuid,p_candidate_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions;
  v_candidate public.image_extraction_candidates; v_payload jsonb; v_versions jsonb;
  v_allowed jsonb;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  v_payload:=marketplace_sec.phase9_owner_ux_candidate_detail(v_session,v_candidate);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'proposalId',p.id,'version',p.lifecycle_version,
    'allowedActions',jsonb_build_array('approve','reject','replace')) ORDER BY p.id),'[]'::jsonb)
    INTO v_versions FROM public.phase9_search_variant_proposals p
    WHERE p.candidate_id=v_candidate.id AND p.status IN ('proposed','stale');
  v_allowed:=CASE WHEN v_candidate.state IN ('committed','commit_in_progress')
      OR v_candidate.review_disposition='skipped_false_detection'
    THEN jsonb_build_array('view_readiness')
    ELSE jsonb_build_array('save_review','mark_false',
      CASE WHEN jsonb_array_length(v_versions)>0 THEN 'open_variant_review' ELSE 'add_missed' END,
      'view_readiness') END;
  RETURN v_payload||jsonb_build_object(
    'variantSummary',jsonb_build_object(
      'unresolvedCount',jsonb_array_length(v_versions),'proposalVersions',v_versions),
    'allowedActions',v_allowed);
END$$;

COMMIT;
