-- M80 (post-scan rework slice 5a follow-up, 2026-10-23). Replaces the M79 body of the card metadata state.
-- (1) Current match: the finished exact-ISBN match counts only while the edition state still records that
--     lookup as its source for the card's CURRENT query identity (M69 clears the source on an identity change),
--     so ISBN A -> B -> A before the new search registers reads 'pending' again, not the old A result.
-- (2) Manually added cards ("Add a book", no scan input) never get an automatic metadata job, so they read
--     'pending' forever and the edition sheet stayed locked. With no lookup row and no running metadata job
--     nothing is in progress: report 'ambiguous' (the existing "no edition chosen yet" state, whose sheet
--     lets the Owner search by title or ISBN). A running job keeps the card 'pending'. Scanned cards
--     (with an input) with no lookup yet stay 'pending' because their automatic job is still to come.
-- Both rules require that no metadata job is open, in progress or scheduled for retry for the card, and the
-- ISBN match must also be the card's newest lookup row, so a same-ISBN search running again reads 'pending'.
-- Only the wrapper from M69/M79 changes. CREATE OR REPLACE keeps signature, owner and ACLs.
-- No table, column, grant or data change.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(p_candidate_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
  WHEN (marketplace_sec.phase9_edition_projection_selection(c)).selection_id IS NOT NULL THEN 'selected'
  WHEN legacy.state='pending'
    AND NOT EXISTS (SELECT 1 FROM public.image_extraction_jobs j WHERE j.entity_type='candidate' AND j.entity_id=c.id
      AND j.store_id=c.store_id AND j.status IN('open','in_progress','retry_scheduled'))
    AND (
    EXISTS (SELECT 1 FROM public.phase9_candidate_edition_state s
      JOIN public.phase9_metadata_lookups ml ON ml.id=s.source_lookup_id AND ml.candidate_id=c.id AND ml.store_id=c.store_id
      WHERE s.candidate_id=c.id AND s.store_id=c.store_id AND s.session_id=c.session_id
        AND s.query_identity=marketplace_sec.phase9_edition_query_identity(c)
        AND ml.normalized_outcome='accepted_metadata_match'
        AND NOT EXISTS (SELECT 1 FROM public.phase9_metadata_lookups newer WHERE newer.candidate_id=c.id
          AND (newer.created_at,newer.id)>(ml.created_at,ml.id)))
    OR (c.input_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.phase9_metadata_lookups ml WHERE ml.candidate_id=c.id AND ml.store_id=c.store_id))
  ) THEN 'ambiguous'
  ELSE legacy.state END
 FROM public.image_extraction_candidates c
 CROSS JOIN LATERAL (SELECT marketplace_sec.phase9_edition_legacy_metadata_state(c.id) AS state) legacy
 WHERE c.id=p_candidate_id
$$;
