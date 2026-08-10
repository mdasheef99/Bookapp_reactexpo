BEGIN;

-- Phase 9 Unit 6 contract matrix: discovery counts are actor/store scoped.
-- Forward correction only: M35 is already live and remains immutable.
CREATE OR REPLACE FUNCTION public.phase9_owner_discover_session_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_store uuid; v_active jsonb; v_scope bigint;
BEGIN
  v_store:=marketplace_sec.phase9_owner_ux_assert_owner();
  SELECT coalesce((SELECT s.review_scope_version FROM public.phase9_owner_review_scopes s
    WHERE s.actor_user_id=auth.uid()),1) INTO v_scope
  FROM (VALUES(1)) seed(value);
  SELECT jsonb_build_object(
    'sessionId',x.id,'status',x.status,'sessionVersion',x.version,
    'startedAt',x.started_at,'updatedAt',x.updated_at,
    'inputCount',(SELECT count(*) FROM public.image_extraction_inputs i
      WHERE i.session_id=x.id AND i.quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'),
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
      WHERE s.store_id=v_store AND s.created_by=auth.uid()
        AND marketplace_sec.phase9_owner_ux_needs_review(c,s,transaction_timestamp())),
    'reviewScopeVersion',v_scope);
END;
$$;

ALTER FUNCTION public.phase9_owner_discover_session_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_owner_discover_session_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase9_owner_discover_session_v1() TO authenticated;

COMMIT;
