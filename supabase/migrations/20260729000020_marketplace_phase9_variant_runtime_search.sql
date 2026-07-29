-- Phase 9 M20: trusted variant reconciliation, alias projection, and active-only search.
-- Forward-only and additive after M19. This file does not authorize another provider call.
BEGIN;

ALTER TABLE public.phase9_search_variant_proposals
  DROP CONSTRAINT phase9_search_variant_proposals_search_eligible_check,
  DROP CONSTRAINT phase9_search_variant_initial_lifecycle_check,
  DROP CONSTRAINT phase9_search_variant_private_foundation_check;

ALTER TABLE public.phase9_search_variant_proposals
  ADD CONSTRAINT phase9_search_variant_lifecycle_coherence CHECK (
    (status='proposed' AND NOT search_eligible AND approval_method IS NULL
      AND lifecycle_reason IS NULL AND lifecycle_actor_id IS NULL
      AND activated_at IS NULL AND rejected_at IS NULL AND stale_at IS NULL)
    OR
    (status='active' AND search_eligible AND approval_method='automatic_policy'
      AND lifecycle_reason IS NOT NULL AND activated_at IS NOT NULL
      AND rejected_at IS NULL AND stale_at IS NULL)
    OR
    (status='rejected' AND NOT search_eligible AND rejected_at IS NOT NULL
      AND activated_at IS NULL AND stale_at IS NULL)
    OR
    (status='stale' AND NOT search_eligible AND lifecycle_reason IS NOT NULL
      AND stale_at IS NOT NULL AND rejected_at IS NULL)
  ),
  ADD CONSTRAINT phase9_search_variant_store_target_coherence CHECK (
    canonical_work_id IS NULL AND canonical_edition_id IS NULL
    AND (listing_id IS NULL OR inventory_id IS NOT NULL)
  );

ALTER TABLE public.book_search_aliases
  DROP CONSTRAINT book_search_aliases_approval_coherence;
ALTER TABLE public.book_search_aliases
  ADD CONSTRAINT book_search_aliases_approval_coherence CHECK (
    approval_status<>'approved'
    OR (
      approved_at IS NOT NULL
      AND (approved_by IS NOT NULL OR source_type='automated')
    )
  );

CREATE FUNCTION marketplace_sec.phase9_variant_compare_key(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=''
AS $function$
  SELECT trim(regexp_replace(
    lower(normalize(coalesce(p_text,''),NFKC)),
    '[[:punct:][:space:]]+',' ','g'
  ))
$function$;

CREATE FUNCTION marketplace_sec.phase9_confirmed_variant_source(
  p_candidate public.image_extraction_candidates,
  p_proposal public.phase9_search_variant_proposals
) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=''
AS $function$
DECLARE
  v_value jsonb;
BEGIN
  IF p_candidate.owner_review_snapshot IS NULL
    OR jsonb_typeof(p_candidate.owner_review_snapshot)<>'object' THEN
    RETURN NULL;
  END IF;
  IF p_proposal.target_type='title' THEN
    v_value:=p_candidate.owner_review_snapshot->'confirmed_title';
  ELSIF jsonb_typeof(p_candidate.owner_review_snapshot->'confirmed_authors')='array' THEN
    SELECT entry INTO v_value
    FROM jsonb_array_elements(
      p_candidate.owner_review_snapshot->'confirmed_authors'
    ) entry
    WHERE jsonb_typeof(entry)='object'
      AND jsonb_typeof(entry->'index')='number'
      AND (entry->>'index')::integer=p_proposal.author_index
    LIMIT 1;
  END IF;
  IF jsonb_typeof(v_value)<>'object'
    OR v_value->>'confirmed'<>'true'
    OR jsonb_typeof(v_value->'text')<>'string'
    OR jsonb_typeof(v_value->'language')<>'string'
    OR jsonb_typeof(v_value->'script')<>'string'
    OR coalesce(char_length(trim(v_value->>'text')),0)<1 THEN
    RETURN NULL;
  END IF;
  RETURN v_value;
END
$function$;

CREATE FUNCTION marketplace_sec.phase9_variant_reconciliation_outcome(
  p_candidate public.image_extraction_candidates,
  p_proposal public.phase9_search_variant_proposals
) RETURNS text
LANGUAGE plpgsql STABLE SET search_path=''
AS $function$
DECLARE
  v_confirmed jsonb;
  v_observed text;
BEGIN
  IF p_proposal.candidate_id<>p_candidate.id
    OR p_proposal.store_id<>p_candidate.store_id
    OR p_proposal.observation_id IS DISTINCT FROM
      p_candidate.analysis_observation_id THEN
    RETURN 'invalid_source_reference';
  END IF;
  v_observed:=CASE WHEN p_proposal.target_type='title'
    THEN p_candidate.observed_title
    ELSE p_candidate.observed_authors[p_proposal.author_index] END;
  IF v_observed IS DISTINCT FROM p_proposal.source_text THEN
    RETURN 'invalid_source_reference';
  END IF;
  v_confirmed:=marketplace_sec.phase9_confirmed_variant_source(
    p_candidate,p_proposal
  );
  IF v_confirmed IS NULL THEN RETURN 'not_confirmed'; END IF;
  IF v_confirmed->>'language' IS DISTINCT FROM p_proposal.source_language
    OR v_confirmed->>'script' IS DISTINCT FROM p_proposal.source_script THEN
    RETURN 'conflicting';
  END IF;
  IF marketplace_sec.phase9_variant_compare_key(v_confirmed->>'text')
    =marketplace_sec.phase9_variant_compare_key(p_proposal.source_text) THEN
    RETURN 'equivalent';
  END IF;
  RETURN 'materially_changed';
END
$function$;

CREATE FUNCTION marketplace_sec.phase9_materialize_search_variant(
  p_proposal_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_proposal public.phase9_search_variant_proposals;
  v_candidate public.image_extraction_candidates;
  v_inventory uuid;
  v_listing uuid;
  v_replacement uuid;
BEGIN
  SELECT * INTO v_proposal
  FROM public.phase9_search_variant_proposals
  WHERE id=p_proposal_id FOR UPDATE;
  IF v_proposal.id IS NULL THEN RETURN false; END IF;

  IF v_proposal.status<>'active' OR NOT v_proposal.search_eligible THEN
    SELECT p.id INTO v_replacement
    FROM public.phase9_search_variant_proposals p
    WHERE p.id<>v_proposal.id AND p.store_id=v_proposal.store_id
      AND p.inventory_id=v_proposal.inventory_id
      AND p.variant_normalized=v_proposal.variant_normalized
      AND p.status='active' AND p.search_eligible
    ORDER BY p.activated_at,p.id LIMIT 1;
    IF v_replacement IS NULL THEN
      DELETE FROM public.book_search_aliases
      WHERE source_type='automated'
        AND source_ref=v_proposal.id::text;
    ELSE
      UPDATE public.book_search_aliases
      SET source_ref=v_replacement::text,updated_at=transaction_timestamp()
      WHERE source_type='automated'
        AND source_ref=v_proposal.id::text;
    END IF;
    RETURN false;
  END IF;

  SELECT * INTO v_candidate FROM public.image_extraction_candidates
  WHERE id=v_proposal.candidate_id AND store_id=v_proposal.store_id;
  v_inventory:=v_candidate.committed_inventory_id;
  IF v_inventory IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.store_inventory i
    WHERE i.id=v_inventory AND i.store_id=v_proposal.store_id
  ) THEN RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED'; END IF;
  SELECT id INTO v_listing FROM public.marketplace_book_listings
  WHERE inventory_id=v_inventory AND store_id=v_proposal.store_id LIMIT 1;

  UPDATE public.phase9_search_variant_proposals
  SET inventory_id=v_inventory,listing_id=v_listing,
    updated_at=transaction_timestamp()
  WHERE id=v_proposal.id;

  INSERT INTO public.book_search_aliases(
    store_id,inventory_id,alias_text,alias_normalized,alias_language,
    alias_script,alias_type,source_type,source_ref,approval_status,
    approved_at,approved_by
  ) VALUES(
    v_proposal.store_id,v_inventory,v_proposal.variant_text,
    v_proposal.variant_normalized,v_proposal.variant_language,
    v_proposal.variant_script,'transliteration','automated',
    v_proposal.id::text,'approved',v_proposal.activated_at,NULL
  ) ON CONFLICT DO NOTHING;
  UPDATE public.book_search_aliases a
  SET source_ref=v_proposal.id::text,alias_text=v_proposal.variant_text,
    alias_language=v_proposal.variant_language,
    alias_script=v_proposal.variant_script,
    approval_status='approved',approved_at=v_proposal.activated_at,
    updated_at=transaction_timestamp()
  WHERE a.inventory_id=v_inventory AND a.store_id=v_proposal.store_id
    AND a.alias_normalized=v_proposal.variant_normalized
    AND a.source_type='automated'
    AND (
      a.source_ref=v_proposal.id::text
      OR NOT EXISTS(
        SELECT 1 FROM public.phase9_search_variant_proposals linked
        WHERE linked.id::text=a.source_ref
          AND linked.status='active' AND linked.search_eligible
      )
    );
  RETURN true;
END
$function$;

CREATE FUNCTION public.phase9_reconcile_search_variants(
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
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
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
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
      v_activated:=v_activated+1;
    ELSIF v_proposal.status='stale'
      AND v_proposal.id=ANY(coalesce(p_allowed_proposal_ids,'{}'::uuid[])) THEN
      -- stale -> active is deliberately absent without fresh approval.
      NULL;
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'candidate_id',p_candidate_id,'activated_count',v_activated,
    'stale_count',v_staled,'policy_key',p_policy_key
  );
END
$function$;

CREATE FUNCTION marketplace_sec.phase9_candidate_variant_refresh()
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
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
    ELSIF NEW.committed_inventory_id IS NOT NULL
      AND v_proposal.status='active' AND v_proposal.search_eligible THEN
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
    END IF;
  END LOOP;
  RETURN NEW;
END
$function$;

CREATE TRIGGER phase9_candidate_variant_refresh
AFTER UPDATE OF owner_review_snapshot,committed_inventory_id
ON public.image_extraction_candidates
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_candidate_variant_refresh();

CREATE FUNCTION public.phase9_active_variant_listing_ids(p_query text)
RETURNS TABLE(listing_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT l.id
  FROM public.phase9_public_listing_projection l
  WHERE coalesce(char_length(trim(p_query)),0)>0
    AND char_length(marketplace_sec.phase9_variant_compare_key(p_query))>0
    AND EXISTS(
      SELECT 1 FROM public.book_search_aliases a
      JOIN public.phase9_search_variant_proposals p
        ON p.id::text=a.source_ref
        AND p.status='active' AND p.search_eligible
        AND p.store_id=l.store_id AND p.inventory_id=l.inventory_id
      WHERE a.approval_status='approved'
        AND a.source_type='automated'
        AND a.store_id=l.store_id AND a.inventory_id=l.inventory_id
        AND a.alias_normalized LIKE '%'||
          marketplace_sec.phase9_variant_compare_key(p_query)||'%'
    )
  ORDER BY l.updated_at DESC,l.id
  LIMIT 200
$function$;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_variant_compare_key(text),
  marketplace_sec.phase9_confirmed_variant_source(
    public.image_extraction_candidates,public.phase9_search_variant_proposals
  ),
  marketplace_sec.phase9_variant_reconciliation_outcome(
    public.image_extraction_candidates,public.phase9_search_variant_proposals
  ),
  marketplace_sec.phase9_materialize_search_variant(uuid),
  marketplace_sec.phase9_candidate_variant_refresh()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_reconcile_search_variants(
  uuid,uuid,uuid[],text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_reconcile_search_variants(
  uuid,uuid,uuid[],text
) TO service_role;
REVOKE ALL ON FUNCTION public.phase9_active_variant_listing_ids(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase9_active_variant_listing_ids(text)
  TO anon,authenticated,service_role;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN
  ON public.phase9_search_variant_proposals,public.book_search_aliases
  FROM service_role;
GRANT SELECT ON public.phase9_search_variant_proposals,
  public.book_search_aliases TO service_role;

COMMIT;
