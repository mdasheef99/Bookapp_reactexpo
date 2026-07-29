-- Phase 9 M21: forward correction after Batch 1 was narrowed to Unit 5C-3.
-- Preserve reconciliation/activation while deferring alias materialization and search.
BEGIN;

DROP FUNCTION public.phase9_active_variant_listing_ids(text);

DROP TRIGGER phase9_candidate_variant_refresh
ON public.image_extraction_candidates;

CREATE OR REPLACE FUNCTION public.phase9_reconcile_search_variants(
  p_store_id uuid,
  p_candidate_id uuid,
  p_allowed_proposal_ids uuid[] DEFAULT '{}'::uuid[],
  p_policy_key text DEFAULT 'deny_all_v1'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_candidate public.image_extraction_candidates;
  v_proposal public.phase9_search_variant_proposals;
  v_outcome text;
  v_activated integer:=0;
  v_staled integer:=0;
BEGIN
  IF auth.role()<>'service_role' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
  WHERE id=p_candidate_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.store_id<>p_store_id THEN
    RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED';
  END IF;
  IF coalesce(char_length(p_policy_key),0)<1
    OR char_length(p_policy_key)>64
    OR p_policy_key !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'P9_SEARCH_VARIANT_POLICY_INVALID';
  END IF;

  FOR v_proposal IN
    SELECT * FROM public.phase9_search_variant_proposals
    WHERE candidate_id=p_candidate_id AND store_id=p_store_id
    ORDER BY source_field,variant_type,id FOR UPDATE
  LOOP
    v_outcome:=marketplace_sec.phase9_variant_reconciliation_outcome(
      v_candidate,v_proposal
    );
    IF v_proposal.status IN ('proposed','active')
      AND (
        v_outcome IN (
          'materially_changed','conflicting','invalid_source_reference'
        )
        OR (v_proposal.status='active' AND v_outcome='not_confirmed')
      ) THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='stale',search_eligible=false,
        lifecycle_reason=v_outcome,stale_at=transaction_timestamp(),
        updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status IN ('proposed','active');
      v_staled:=v_staled+1;
    ELSIF v_proposal.status='proposed'
      AND v_outcome='equivalent'
      AND v_proposal.variant_type='primary_roman'
      AND v_proposal.variant_script='Latn'
      AND v_proposal.source_script<>'Latn'
      AND v_proposal.id=ANY(coalesce(p_allowed_proposal_ids,'{}'::uuid[]))
      AND p_policy_key<>'deny_all_v1'
      AND marketplace_sec.phase9_variant_compare_key(v_proposal.variant_text)
        <>marketplace_sec.phase9_variant_compare_key(v_proposal.source_text)
      AND NOT EXISTS(
        SELECT 1 FROM public.phase9_search_variant_proposals active
        WHERE active.id<>v_proposal.id
          AND active.candidate_id=v_proposal.candidate_id
          AND active.source_field=v_proposal.source_field
          AND active.status='active' AND active.search_eligible
      ) THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='active',search_eligible=true,
        approval_method='automatic_policy',lifecycle_reason=p_policy_key,
        activated_at=transaction_timestamp(),updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status='proposed';
      v_activated:=v_activated+1;
    ELSIF v_proposal.status='stale'
      AND v_proposal.id=ANY(coalesce(p_allowed_proposal_ids,'{}'::uuid[])) THEN
      NULL;
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'candidate_id',p_candidate_id,'activated_count',v_activated,
    'stale_count',v_staled,'policy_key',p_policy_key
  );
END
$function$;

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
      NEW,v_proposal
    );
    IF v_outcome IN (
      'materially_changed','conflicting','invalid_source_reference'
    ) OR (v_proposal.status='active' AND v_outcome='not_confirmed') THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='stale',search_eligible=false,
        lifecycle_reason=v_outcome,stale_at=transaction_timestamp(),
        updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status IN ('proposed','active');
    END IF;
  END LOOP;
  RETURN NEW;
END
$function$;

CREATE TRIGGER phase9_candidate_variant_refresh
AFTER UPDATE OF owner_review_snapshot
ON public.image_extraction_candidates
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_candidate_variant_refresh();

DROP FUNCTION marketplace_sec.phase9_materialize_search_variant(uuid);

ALTER TABLE public.phase9_search_variant_proposals
  DROP CONSTRAINT phase9_search_variant_store_target_coherence,
  ADD CONSTRAINT phase9_search_variant_private_foundation_check CHECK (
    inventory_id IS NULL AND listing_id IS NULL
    AND canonical_work_id IS NULL AND canonical_edition_id IS NULL
  );

ALTER TABLE public.book_search_aliases
  DROP CONSTRAINT book_search_aliases_approval_coherence,
  ADD CONSTRAINT book_search_aliases_approval_coherence CHECK (
    (approval_status='approved' AND approved_at IS NOT NULL
      AND approved_by IS NOT NULL)
    OR approval_status<>'approved'
  );

COMMIT;
