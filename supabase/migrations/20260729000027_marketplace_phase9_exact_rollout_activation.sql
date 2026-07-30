-- Phase 9 M27: fail-closed exact-evidence enforcement at the Unit 5C-3 seam.
BEGIN;
CREATE TABLE public.phase9_search_variant_language_rollouts (
  language text NOT NULL CHECK (language~'^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  script text NOT NULL CHECK (script~'^[A-Z][a-z]{3}$'), policy_version text NOT NULL,
  vision_enabled boolean NOT NULL DEFAULT false, romanization_enabled boolean NOT NULL DEFAULT false,
  automatic_activation_enabled boolean NOT NULL DEFAULT false,
  approved_review_id uuid REFERENCES public.phase9_search_variant_benchmark_reviews(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version>0), updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(language,script),
  CHECK (NOT automatic_activation_enabled OR (vision_enabled AND romanization_enabled)),
  CHECK (NOT (vision_enabled OR romanization_enabled
    OR automatic_activation_enabled) OR approved_review_id IS NOT NULL));
CREATE TABLE public.phase9_search_variant_rollout_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), language text NOT NULL, script text NOT NULL,
  actor_user_id uuid NOT NULL, previous_version integer NOT NULL, resulting_version integer NOT NULL,
  previous_capabilities jsonb NOT NULL, resulting_capabilities jsonb NOT NULL,
  reason text NOT NULL, request_identity text NOT NULL UNIQUE,
  previous_policy_version text, resulting_policy_version text NOT NULL,
  previous_review_id uuid REFERENCES public.phase9_search_variant_benchmark_reviews(id) ON DELETE RESTRICT,
  resulting_review_id uuid REFERENCES public.phase9_search_variant_benchmark_reviews(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT transaction_timestamp(), CHECK (resulting_version=previous_version+1));
DO $do$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'phase9_search_variant_language_rollouts','phase9_search_variant_rollout_audit']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I OWNER TO postgres',v_table);
    EXECUTE format('REVOKE ALL PRIVILEGES ON public.%I FROM PUBLIC,anon,authenticated,service_role',v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role',v_table);
  END LOOP;
END
$do$;
CREATE TRIGGER phase9_variant_rollout_audit_immutable BEFORE UPDATE OR DELETE ON public.phase9_search_variant_rollout_audit
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_variant_audit_immutable();
CREATE FUNCTION public.phase9_set_search_variant_language_rollout(
  p_language text,p_script text,p_policy_version text,p_expected_version integer,p_vision boolean,p_romanization boolean,
  p_automatic boolean,p_approved_review_id uuid,p_reason text,p_request_identity text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_actor uuid:=auth.uid();v_old public.phase9_search_variant_language_rollouts;
  v_audit public.phase9_search_variant_rollout_audit;
BEGIN
  IF auth.role()<>'authenticated'
    OR NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF p_request_identity!~'^[0-9a-f]{64}$' OR p_reason!~'^[a-z][a-z0-9_]{2,63}$'
    OR p_expected_version<1 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws('|','language-rollout',lower(p_language),p_script),0));
  SELECT * INTO v_audit FROM public.phase9_search_variant_rollout_audit
  WHERE request_identity=p_request_identity;
  IF v_audit.id IS NOT NULL THEN
    IF v_audit.actor_user_id<>v_actor
      OR v_audit.language<>lower(p_language) OR v_audit.script<>p_script
      OR v_audit.previous_version<>p_expected_version OR v_audit.resulting_policy_version<>p_policy_version
      OR v_audit.resulting_review_id IS DISTINCT FROM p_approved_review_id OR v_audit.reason<>p_reason
      OR v_audit.resulting_capabilities<>jsonb_build_object(
        'vision',p_vision,'romanization',p_romanization,'automatic',p_automatic) THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object('language',lower(p_language),'script',p_script,
      'version',v_audit.resulting_version,'replayed',true);
  END IF;
  SELECT * INTO v_old FROM public.phase9_search_variant_language_rollouts
  WHERE language=lower(p_language) AND script=p_script FOR UPDATE;
  IF coalesce(v_old.version,1)<>p_expected_version THEN
    RAISE EXCEPTION 'P9_STALE_VERSION';
  END IF;
  IF (p_vision OR p_romanization OR p_automatic) AND NOT EXISTS(
    SELECT 1 FROM public.phase9_search_variant_benchmark_reviews review
    JOIN public.phase9_search_variant_benchmark_executions execution ON execution.id=review.execution_id
    JOIN public.phase9_search_variant_benchmark_manifests manifest ON manifest.id=execution.manifest_id
    WHERE review.id=p_approved_review_id
      AND marketplace_sec.phase9_benchmark_review_is_effective_approval(review.id)
      AND manifest.language=lower(p_language) AND manifest.script=p_script
      AND execution.policy_version=p_policy_version
  ) THEN
    RAISE EXCEPTION 'P9_ROLLOUT_EVIDENCE_INVALID';
  END IF;
  INSERT INTO public.phase9_search_variant_language_rollouts(
    language,script,policy_version,vision_enabled,romanization_enabled,
    automatic_activation_enabled,approved_review_id,version,updated_by)
  VALUES(lower(p_language),p_script,p_policy_version,p_vision,p_romanization,
    p_automatic,p_approved_review_id,p_expected_version+1,v_actor)
  ON CONFLICT(language,script) DO UPDATE SET
    policy_version=excluded.policy_version,vision_enabled=excluded.vision_enabled,
    romanization_enabled=excluded.romanization_enabled,
    automatic_activation_enabled=excluded.automatic_activation_enabled,
    approved_review_id=excluded.approved_review_id,version=excluded.version,updated_by=excluded.updated_by,
    updated_at=transaction_timestamp();
  INSERT INTO public.phase9_search_variant_rollout_audit(
    language,script,actor_user_id,previous_version,resulting_version,
    previous_capabilities,resulting_capabilities,reason,request_identity,
    previous_policy_version,resulting_policy_version,previous_review_id,resulting_review_id)
  VALUES(lower(p_language),p_script,v_actor,p_expected_version,p_expected_version+1,
    jsonb_build_object(
      'vision',coalesce(v_old.vision_enabled,false),'romanization',coalesce(v_old.romanization_enabled,false),
      'automatic',coalesce(v_old.automatic_activation_enabled,false)),
    jsonb_build_object('vision',p_vision,'romanization',p_romanization,'automatic',p_automatic),
    p_reason,p_request_identity,v_old.policy_version,p_policy_version,
    v_old.approved_review_id,p_approved_review_id);
  RETURN jsonb_build_object('language',lower(p_language),'script',p_script,
    'version',p_expected_version+1,'replayed',false);
END
$function$;
CREATE FUNCTION public.phase9_search_variant_automatic_activation_allowed(
  p_proposal_id uuid,p_source_language text,p_source_script text,p_target_type text,
  p_model_key text,p_model_version text,p_prompt_version text,p_schema_version text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
SELECT auth.role()='service_role' AND count(*)=1
FROM public.phase9_search_variant_language_rollouts rollout
JOIN public.phase9_search_variant_benchmark_reviews review ON review.id=rollout.approved_review_id
JOIN public.phase9_search_variant_benchmark_executions execution ON execution.id=review.execution_id
JOIN public.phase9_search_variant_benchmark_manifests manifest ON manifest.id=execution.manifest_id
JOIN public.phase9_search_variant_proposals proposal ON proposal.id=p_proposal_id
WHERE rollout.language=lower(p_source_language) AND rollout.script=p_source_script
  AND rollout.automatic_activation_enabled
  AND marketplace_sec.phase9_benchmark_review_is_effective_approval(review.id)
  AND manifest.language=rollout.language AND manifest.script=rollout.script
  AND execution.policy_version=rollout.policy_version
  AND execution.model_key=p_model_key AND execution.model_version=p_model_version
  AND execution.prompt_version=p_prompt_version AND execution.sidecar_schema_version=p_schema_version
  AND proposal.source_language=lower(p_source_language) AND proposal.source_script=p_source_script
  AND proposal.target_type=p_target_type AND proposal.model_key=p_model_key
  AND proposal.model_version=p_model_version AND proposal.prompt_version=p_prompt_version
  AND proposal.proposal_schema_version=p_schema_version
$function$;
CREATE FUNCTION marketplace_sec.phase9_variant_activation_denial_reason(p_proposal_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v public.phase9_search_variant_proposals;c public.image_extraction_candidates;outcome text;
BEGIN
  SELECT * INTO v FROM public.phase9_search_variant_proposals WHERE id=p_proposal_id;
  IF v.id IS NULL OR v.status<>'proposed' THEN
    RETURN 'lifecycle_not_proposed';
  END IF;
  SELECT * INTO c FROM public.image_extraction_candidates
  WHERE id=v.candidate_id AND store_id=v.store_id;
  outcome:=marketplace_sec.phase9_variant_reconciliation_outcome(c,v);
  IF outcome<>'equivalent' THEN
    RETURN 'reconciliation_'||outcome;
  END IF;
  IF v.variant_type<>'primary_roman' THEN
    RETURN 'manual_review_required';
  END IF;
  IF v.variant_script<>'Latn' THEN
    RETURN 'variant_script_ineligible';
  END IF;
  IF v.source_script='Latn' THEN
    RETURN 'source_script_ineligible';
  END IF;
  IF marketplace_sec.phase9_variant_compare_key(v.variant_text)
    =marketplace_sec.phase9_variant_compare_key(v.source_text) THEN
    RETURN 'trivial_variant';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.phase9_search_variant_language_rollouts r
    WHERE r.language=lower(v.source_language) AND r.script=v.source_script) THEN
    RETURN 'rollout_not_configured';
  END IF;
  IF EXISTS(SELECT 1 FROM public.phase9_search_variant_language_rollouts r
    WHERE r.language=lower(v.source_language) AND r.script=v.source_script
      AND NOT r.automatic_activation_enabled) THEN
    RETURN 'automatic_activation_disabled';
  END IF;
  IF EXISTS(SELECT 1 FROM public.phase9_search_variant_language_rollouts r
    JOIN public.phase9_search_variant_benchmark_reviews review ON review.id=r.approved_review_id
    JOIN public.phase9_search_variant_benchmark_executions e ON e.id=review.execution_id
    JOIN public.phase9_search_variant_benchmark_manifests m ON m.id=e.manifest_id
    WHERE r.language=lower(v.source_language) AND r.script=v.source_script
      AND r.automatic_activation_enabled
      AND marketplace_sec.phase9_benchmark_review_is_effective_approval(review.id)
      AND m.language=r.language AND m.script=r.script
      AND e.policy_version=r.policy_version
      AND e.model_key=v.model_key AND e.model_version=v.model_version
      AND e.prompt_version=v.prompt_version AND e.sidecar_schema_version=v.proposal_schema_version) THEN
    RETURN NULL;
  END IF;
  RETURN 'rollout_evidence_invalid';
END
$function$;
CREATE OR REPLACE FUNCTION public.phase9_owner_search_variant_review(
  p_store_id uuid,p_status text DEFAULT NULL,p_target_type text DEFAULT NULL,p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_proposal_id uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS TABLE(
  proposal_id uuid,concurrency_version integer,target_type text,author_position smallint,
  confirmed_source_text text,proposed_text text,variant_type text,source_language text,source_script text,
  variant_language text,variant_script text,lifecycle_status text,generation_source text,provider_key text,
  model_key text,model_version text,prompt_version text,schema_version text,
  automatic_activation_denial_reason text,stale_conflict_reason text,created_at timestamptz,allowed_actions text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
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
  SELECT p.id,p.lifecycle_version,p.target_type,p.author_index,confirmed->>'text',
    p.variant_text,p.variant_type,p.source_language,p.source_script,p.variant_language,
    p.variant_script,p.status,p.generation_source,p.provider_key,p.model_key,p.model_version,
    p.prompt_version,p.proposal_schema_version,
    marketplace_sec.phase9_variant_activation_denial_reason(p.id),
    CASE WHEN p.status='stale' THEN p.lifecycle_reason
      WHEN outcome IN ('conflicting','materially_changed','invalid_source_reference')
      THEN outcome ELSE NULL END,
    p.created_at,
	    CASE WHEN p.status IN ('proposed','stale') AND outcome='equivalent'
      THEN ARRAY['approve','reject','replace','leave_unresolved']::text[]
      WHEN p.status IN ('proposed','stale') THEN ARRAY['reject','replace','leave_unresolved']::text[]
      WHEN p.status='active' THEN ARRAY['reject','replace','leave_unresolved']::text[]
      ELSE ARRAY['leave_unresolved']::text[] END
  FROM public.phase9_search_variant_proposals p
  JOIN public.image_extraction_candidates c ON c.id=p.candidate_id AND c.store_id=p.store_id
  CROSS JOIN LATERAL(SELECT marketplace_sec.phase9_confirmed_variant_source(c,p)) source(confirmed)
  CROSS JOIN LATERAL(SELECT marketplace_sec.phase9_variant_reconciliation_outcome(c,p)) reconciliation(outcome)
  WHERE p.store_id=p_store_id
    AND (p_status IS NULL OR p.status=p_status)
    AND (p_target_type IS NULL OR p.target_type=p_target_type)
    AND (p_cursor_created_at IS NULL OR (p.created_at,p.id)<(p_cursor_created_at,p_cursor_proposal_id))
    AND confirmed IS NOT NULL
  ORDER BY p.created_at DESC,p.id DESC LIMIT p_limit;
END
$function$;
CREATE FUNCTION public.phase9_platform_search_variant_rollout_state()
RETURNS TABLE(
  language text,script text,policy_version text,vision_enabled boolean,romanization_enabled boolean,
  automatic_activation_enabled boolean,version integer,approved_review_id uuid,dataset_key text,
  dataset_version text,execution_identity text,review_status text,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
BEGIN
  IF auth.role()<>'authenticated'
    OR NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT r.language,r.script,r.policy_version,r.vision_enabled,r.romanization_enabled,
    r.automatic_activation_enabled,r.version,r.approved_review_id,m.dataset_key,m.dataset_version,
    e.execution_identity,effective.action,r.updated_at
  FROM public.phase9_search_variant_language_rollouts r
  LEFT JOIN public.phase9_search_variant_benchmark_reviews approved ON approved.id=r.approved_review_id
  LEFT JOIN public.phase9_search_variant_benchmark_executions e ON e.id=approved.execution_id
  LEFT JOIN public.phase9_search_variant_benchmark_manifests m ON m.id=e.manifest_id
  LEFT JOIN LATERAL(
    SELECT review.action FROM public.phase9_search_variant_benchmark_reviews review
    WHERE review.execution_id=e.id ORDER BY review.review_order DESC,review.id DESC LIMIT 1
  ) effective ON true
  ORDER BY r.language,r.script;
END
$function$;
CREATE OR REPLACE FUNCTION public.phase9_reconcile_search_variants(
  p_store_id uuid,p_candidate_id uuid,
  p_allowed_proposal_ids uuid[] DEFAULT '{}'::uuid[],p_policy_key text DEFAULT 'deny_all_v1')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_candidate public.image_extraction_candidates;v_proposal public.phase9_search_variant_proposals;
  v_outcome text;v_activated integer:=0;v_staled integer:=0;
BEGIN
  IF auth.role()<>'service_role' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
  WHERE id=p_candidate_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.store_id<>p_store_id THEN
    RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED';
  END IF;
  IF p_policy_key NOT IN ('deny_all_v1','exact_approved_rollout_v1') THEN
    RAISE EXCEPTION 'P9_SEARCH_VARIANT_POLICY_INVALID';
  END IF;
  FOR v_proposal IN
    SELECT * FROM public.phase9_search_variant_proposals
    WHERE candidate_id=p_candidate_id AND store_id=p_store_id
    ORDER BY source_field,variant_type,id FOR UPDATE
  LOOP
    v_outcome:=marketplace_sec.phase9_variant_reconciliation_outcome(
      v_candidate,v_proposal);
    IF v_proposal.status IN ('proposed','active')
      AND (v_outcome IN ('materially_changed','conflicting','invalid_source_reference')
        OR (v_proposal.status='active' AND v_outcome='not_confirmed')) THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='stale',search_eligible=false,lifecycle_reason=v_outcome,
        stale_at=transaction_timestamp(),lifecycle_version=lifecycle_version+1,
        updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status IN ('proposed','active');
      v_staled:=v_staled+1;
    ELSIF v_proposal.status='proposed' AND v_outcome='equivalent'
      AND v_proposal.variant_type='primary_roman'
      AND v_proposal.variant_script='Latn' AND v_proposal.source_script<>'Latn'
      AND p_policy_key='exact_approved_rollout_v1'
      AND public.phase9_search_variant_automatic_activation_allowed(
        v_proposal.id,v_proposal.source_language,v_proposal.source_script,
        v_proposal.target_type,v_proposal.model_key,v_proposal.model_version,
        v_proposal.prompt_version,v_proposal.proposal_schema_version)
      AND marketplace_sec.phase9_variant_compare_key(v_proposal.variant_text)
        <>marketplace_sec.phase9_variant_compare_key(v_proposal.source_text)
      AND NOT EXISTS(
        SELECT 1 FROM public.phase9_search_variant_proposals active
        WHERE active.id<>v_proposal.id AND active.candidate_id=v_proposal.candidate_id
          AND active.source_field=v_proposal.source_field
          AND active.status='active' AND active.search_eligible)
    THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='active',search_eligible=true,approval_method='automatic_policy',
        lifecycle_reason=p_policy_key,activated_at=transaction_timestamp(),
        lifecycle_version=lifecycle_version+1,
        updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status='proposed';
      v_activated:=v_activated+1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('candidate_id',p_candidate_id,
    'activated_count',v_activated,'stale_count',v_staled,'policy_key',p_policy_key);
END
$function$;
ALTER FUNCTION public.phase9_set_search_variant_language_rollout(
  text,text,text,integer,boolean,boolean,boolean,uuid,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_search_variant_automatic_activation_allowed(
  uuid,text,text,text,text,text,text,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_variant_activation_denial_reason(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_search_variant_review(uuid,text,text,timestamptz,uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_platform_search_variant_rollout_state() OWNER TO postgres;
ALTER FUNCTION public.phase9_reconcile_search_variants(uuid,uuid,uuid[],text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_variant_activation_denial_reason(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_set_search_variant_language_rollout(
  text,text,text,integer,boolean,boolean,boolean,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_search_variant_automatic_activation_allowed(
  uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_platform_search_variant_rollout_state()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_reconcile_search_variants(
  uuid,uuid,uuid[],text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_set_search_variant_language_rollout(
  text,text,text,integer,boolean,boolean,boolean,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_platform_search_variant_rollout_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_search_variant_automatic_activation_allowed(
  uuid,text,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_reconcile_search_variants(uuid,uuid,uuid[],text) TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN
  ON public.phase9_search_variant_language_rollouts,public.phase9_search_variant_rollout_audit FROM service_role;
COMMIT;
