-- Phase 9 M24: exceptional store-scoped Owner variant decisions.
-- Forward-only after immutable M18-M23. No inventory/listing/publication writes.
BEGIN;

ALTER TABLE public.phase9_search_variant_proposals
  ADD COLUMN lifecycle_version integer NOT NULL DEFAULT 1
    CHECK (lifecycle_version > 0),
  ADD COLUMN source_proposal_id uuid
    REFERENCES public.phase9_search_variant_proposals(id) ON DELETE RESTRICT,
  ADD COLUMN created_by uuid;

ALTER TABLE public.phase9_search_variant_proposals
  DROP CONSTRAINT phase9_search_variant_proposals_generation_source_check,
  ADD CONSTRAINT phase9_search_variant_proposals_generation_source_check CHECK (
    generation_source IN ('vision_model','recorded_fixture','owner_correction')
  ),
  DROP CONSTRAINT phase9_search_variant_lifecycle_coherence,
  ADD CONSTRAINT phase9_search_variant_lifecycle_coherence CHECK (
    (status='proposed' AND NOT search_eligible AND approval_method IS NULL
      AND lifecycle_reason IS NULL AND lifecycle_actor_id IS NULL
      AND activated_at IS NULL AND rejected_at IS NULL AND stale_at IS NULL)
    OR
    (status='active' AND search_eligible
      AND approval_method IN ('automatic_policy','owner_approved')
      AND lifecycle_reason IS NOT NULL AND activated_at IS NOT NULL
      AND rejected_at IS NULL AND stale_at IS NULL
      AND (approval_method='automatic_policy'
        OR lifecycle_actor_id IS NOT NULL))
    OR
    (status='rejected' AND NOT search_eligible AND rejected_at IS NOT NULL
      AND stale_at IS NULL)
    OR
    (status='stale' AND NOT search_eligible AND lifecycle_reason IS NOT NULL
      AND stale_at IS NOT NULL AND rejected_at IS NULL)
  ),
  ADD CONSTRAINT phase9_search_variant_owner_origin_check CHECK (
    (generation_source='owner_correction' AND source_proposal_id IS NOT NULL
      AND created_by IS NOT NULL
      AND (status<>'active' OR approval_method='owner_approved'))
    OR generation_source<>'owner_correction'
  );

-- M22 created this candidate-driven lifecycle seam before lifecycle_version
-- existed. Replace it here so every implicit stale transition is fenced.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_candidate_variant_refresh()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_proposal public.phase9_search_variant_proposals;
  v_outcome text;
BEGIN
  FOR v_proposal IN SELECT * FROM public.phase9_search_variant_proposals
    WHERE candidate_id=NEW.id AND store_id=NEW.store_id
      AND status IN ('proposed','active') FOR UPDATE
  LOOP
    v_outcome:=marketplace_sec.phase9_variant_reconciliation_outcome(
      NEW,v_proposal);
    IF v_outcome IN (
      'materially_changed','conflicting','invalid_source_reference'
    ) OR (v_proposal.status='active' AND v_outcome='not_confirmed') THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='stale',search_eligible=false,lifecycle_reason=v_outcome,
        stale_at=transaction_timestamp(),
        lifecycle_version=lifecycle_version+1,
        updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status IN ('proposed','active');
    ELSIF NEW.committed_inventory_id IS NOT NULL
      AND v_proposal.status='active' AND v_proposal.search_eligible THEN
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
    END IF;
  END LOOP;
  RETURN NEW;
END
$function$;

CREATE TABLE public.phase9_search_variant_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL
    REFERENCES public.phase9_search_variant_proposals(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','reject','replace')),
  reason text NOT NULL CHECK (reason ~ '^[a-z][a-z0-9_]{2,63}$'),
  note text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 500),
  previous_lifecycle text NOT NULL
    CHECK (previous_lifecycle IN ('proposed','active','rejected','stale')),
  resulting_lifecycle text NOT NULL
    CHECK (resulting_lifecycle IN ('active','rejected')),
  expected_version integer NOT NULL CHECK (expected_version > 0),
  resulting_version integer NOT NULL
    CHECK (resulting_version=expected_version+1),
  source_proposal_id uuid
    REFERENCES public.phase9_search_variant_proposals(id) ON DELETE RESTRICT,
  replacement_proposal_id uuid
    REFERENCES public.phase9_search_variant_proposals(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL
    CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(store_id,actor_user_id,idempotency_key),
  UNIQUE(proposal_id,id)
);
CREATE INDEX phase9_variant_decisions_proposal_idx
  ON public.phase9_search_variant_decisions(proposal_id,decided_at DESC,id DESC);

ALTER TABLE public.phase9_search_variant_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_search_variant_decisions OWNER TO postgres;
REVOKE ALL PRIVILEGES ON public.phase9_search_variant_decisions
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.phase9_search_variant_decisions TO service_role;

CREATE FUNCTION marketplace_sec.phase9_variant_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
  RAISE EXCEPTION 'P9_APPEND_ONLY_VIOLATION';
END
$function$;
CREATE TRIGGER phase9_variant_decisions_immutable
BEFORE UPDATE OR DELETE ON public.phase9_search_variant_decisions
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_variant_audit_immutable();

CREATE FUNCTION marketplace_sec.phase9_owner_variant_authorized(p_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='authenticated' AND auth.uid() IS NOT NULL
    AND marketplace_sec.phase9_is_store_owner(p_store_id)
$function$;

CREATE FUNCTION public.phase9_owner_search_variant_review(
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
    OR (p_status IS NOT NULL
      AND p_status NOT IN ('proposed','active','rejected','stale'))
    OR (p_target_type IS NOT NULL
      AND p_target_type NOT IN ('title','author'))
    OR ((p_cursor_created_at IS NULL)<>(p_cursor_proposal_id IS NULL)) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  RETURN QUERY
  SELECT p.id,p.lifecycle_version,p.target_type,p.author_index,
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

CREATE FUNCTION public.phase9_owner_decide_search_variant(
  p_store_id uuid,p_proposal_id uuid,p_expected_version integer,
  p_action text,p_reason text,p_note text,p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_proposal public.phase9_search_variant_proposals;
  v_candidate public.image_extraction_candidates;
  v_existing public.phase9_search_variant_decisions;
  v_fingerprint text;
  v_previous text;
  v_result text;
  v_decision uuid;
BEGIN
  IF NOT marketplace_sec.phase9_owner_variant_authorized(p_store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF p_action NOT IN ('approve','reject') OR p_expected_version<1
    OR p_reason !~ '^[a-z][a-z0-9_]{2,63}$'
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR (p_note IS NOT NULL AND char_length(trim(p_note)) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(
    concat_ws('|',p_store_id,p_proposal_id,p_expected_version,p_action,
      p_reason,coalesce(trim(p_note),''),p_idempotency_key),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws('|',p_store_id,v_actor,p_idempotency_key),0));
  SELECT * INTO v_existing FROM public.phase9_search_variant_decisions
  WHERE store_id=p_store_id AND actor_user_id=v_actor
    AND idempotency_key=p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object('decision_id',v_existing.id,
      'proposal_id',v_existing.proposal_id,'status',v_existing.resulting_lifecycle,
      'version',v_existing.resulting_version,'replayed',true);
  END IF;
  SELECT * INTO v_proposal FROM public.phase9_search_variant_proposals
  WHERE id=p_proposal_id;
  IF v_proposal.id IS NULL OR v_proposal.store_id<>p_store_id THEN
    RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED';
  END IF;
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
  WHERE id=v_proposal.candidate_id AND store_id=p_store_id FOR SHARE;
  SELECT * INTO v_proposal FROM public.phase9_search_variant_proposals
  WHERE id=p_proposal_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_proposal.candidate_id<>v_candidate.id THEN
    RAISE EXCEPTION 'P9_VARIANT_SOURCE_MISMATCH';
  END IF;
  IF v_proposal.lifecycle_version<>p_expected_version THEN
    RAISE EXCEPTION 'P9_STALE_VERSION';
  END IF;
  v_previous:=v_proposal.status;
  IF p_action='approve' THEN
    IF v_proposal.status NOT IN ('proposed','stale') THEN
      RAISE EXCEPTION 'P9_STATE_CONFLICT';
    END IF;
    IF marketplace_sec.phase9_variant_reconciliation_outcome(v_candidate,v_proposal)
      <>'equivalent' THEN RAISE EXCEPTION 'P9_VARIANT_SOURCE_MISMATCH'; END IF;
    v_result:='active';
    UPDATE public.phase9_search_variant_proposals
    SET status='active',search_eligible=true,approval_method='owner_approved',
      lifecycle_reason=p_reason,lifecycle_actor_id=v_actor,
      activated_at=transaction_timestamp(),rejected_at=NULL,stale_at=NULL,
      lifecycle_version=lifecycle_version+1,updated_at=transaction_timestamp()
    WHERE id=v_proposal.id;
  ELSE
    IF v_proposal.status='rejected' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    v_result:='rejected';
    UPDATE public.phase9_search_variant_proposals
    SET status='rejected',search_eligible=false,approval_method=NULL,
      lifecycle_reason=p_reason,lifecycle_actor_id=v_actor,
      activated_at=NULL,rejected_at=transaction_timestamp(),stale_at=NULL,
      lifecycle_version=lifecycle_version+1,updated_at=transaction_timestamp()
    WHERE id=v_proposal.id;
  END IF;
  INSERT INTO public.phase9_search_variant_decisions(
    proposal_id,store_id,actor_user_id,action,reason,note,
    previous_lifecycle,resulting_lifecycle,expected_version,resulting_version,
    idempotency_key,request_fingerprint
  ) VALUES(v_proposal.id,p_store_id,v_actor,p_action,p_reason,nullif(trim(p_note),''),
    v_previous,v_result,p_expected_version,p_expected_version+1,
    p_idempotency_key,v_fingerprint) RETURNING id INTO v_decision;
  RETURN jsonb_build_object('decision_id',v_decision,'proposal_id',v_proposal.id,
    'status',v_result,'version',p_expected_version+1,'replayed',false);
END
$function$;

ALTER FUNCTION marketplace_sec.phase9_variant_audit_immutable() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_variant_authorized(uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_candidate_variant_refresh()
  OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_search_variant_review(
  uuid,text,text,timestamptz,uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_decide_search_variant(
  uuid,uuid,integer,text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_variant_audit_immutable(),
  marketplace_sec.phase9_owner_variant_authorized(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_owner_search_variant_review(
  uuid,text,text,timestamptz,uuid,integer),
  public.phase9_owner_decide_search_variant(
    uuid,uuid,integer,text,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_owner_search_variant_review(
  uuid,text,text,timestamptz,uuid,integer),
  public.phase9_owner_decide_search_variant(
    uuid,uuid,integer,text,text,text,text)
  TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN
  ON public.phase9_search_variant_decisions FROM service_role;

COMMIT;
