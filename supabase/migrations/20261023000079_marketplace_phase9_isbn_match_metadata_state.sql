-- M79 (post-scan rework slice 5a follow-up, 2026-10-23).
-- A finished exact-ISBN lookup (the only edition lookup that can end as a coherent match) records the outcome 'accepted_metadata_match'. The card metadata state
-- function only knew that value through an already selected snapshot, so with no edition chosen yet it
-- fell through to 'pending': the card kept saying "Finding edition..." and the edition sheet stayed locked.
-- With no edition chosen, a finished ISBN match is waiting for the Owner to pick: report 'ambiguous'
-- (the same state the picker already uses for "options listed, none chosen").
-- The rule applies only while that lookup is still the card's current search: the latest lookup row must carry
-- the card's current edition query identity, so changing the ISBN (new identity, new search pending) reads
-- 'pending' again until the new lookup finishes.
-- Only the wrapper from M69 changes. Signature, owner, SECURITY DEFINER, search_path and ACLs are kept
-- by CREATE OR REPLACE. No table, column, grant or data change.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(p_candidate_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
  WHEN (marketplace_sec.phase9_edition_projection_selection(c)).selection_id IS NOT NULL THEN 'selected'
  WHEN legacy.state='pending'
    AND coalesce((SELECT ml.normalized_outcome='accepted_metadata_match'
        AND ml.query_identity=marketplace_sec.phase9_edition_query_identity(c)
      FROM public.phase9_metadata_lookups ml WHERE ml.candidate_id=c.id AND ml.store_id=c.store_id
      ORDER BY ml.created_at DESC,ml.id DESC LIMIT 1),false) THEN 'ambiguous'
  ELSE legacy.state END
 FROM public.image_extraction_candidates c
 CROSS JOIN LATERAL (SELECT marketplace_sec.phase9_edition_legacy_metadata_state(c.id) AS state) legacy
 WHERE c.id=p_candidate_id
$$;
