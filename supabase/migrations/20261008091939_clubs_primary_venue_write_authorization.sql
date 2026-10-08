-- Forward correction approved by owner on 2026-10-08.
-- Exact project: Bookconnect_reactexpo (ahntbtktjjmvfosgkmgn).
-- Tightens primary INSERT/UPDATE eligibility; ordinary Add/Remove remain unchanged.
-- Preserves the applied 20261007144356 artifact. No business-data DML.
BEGIN;
LOCK TABLE public.club_venues IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.club_venues'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Venue-link row security is disabled; re-audit before proceeding' USING ERRCODE = '55000';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.club_venues'::regclass) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policy
       WHERE polrelid = 'public.club_venues'::regclass
         AND polname = 'Admins can manage club venues' AND polcmd = '*'
         AND polpermissive AND polroles = ARRAY[0::oid]
         AND polwithcheck IS NULL
         AND pg_catalog.pg_get_expr(polqual, polrelid) =
           E'(EXISTS ( SELECT 1\n   FROM book_clubs\n  WHERE ((book_clubs.id = club_venues.club_id) AND (book_clubs.admin_id = auth.uid()))))'
     ) OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policy
       WHERE polrelid = 'public.club_venues'::regclass
         AND polname = 'Members can view club venues' AND polcmd = 'r'
         AND polpermissive AND polroles = ARRAY[0::oid]
         AND polwithcheck IS NULL
         AND pg_catalog.pg_get_expr(polqual, polrelid) =
           E'(EXISTS ( SELECT 1\n   FROM club_members\n  WHERE ((club_members.club_id = club_venues.club_id) AND (club_members.user_id = auth.uid()))))'
     ) THEN
    RAISE EXCEPTION 'Venue-link policy drift; re-audit before proceeding' USING ERRCODE = '55000';
  END IF;
END;
$preflight$;
DROP POLICY "Admins can manage club venues" ON public.club_venues;
CREATE POLICY "Owners can read club venues" ON public.club_venues
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid())
  );
CREATE POLICY "Owners can add club venues" ON public.club_venues
  FOR INSERT TO public WITH CHECK (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid()
        AND (NOT coalesce(club_venues.is_primary, false) OR (
          NOT coalesce(bc.is_archived, false)
          AND public.can_user_hold_club_role(auth.uid(), bc.id, 'admin')
        )))
  );
CREATE POLICY "Owners can remove club venues" ON public.club_venues
  FOR DELETE TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid())
  );
CREATE POLICY "Eligible owners can update club venues" ON public.club_venues
  FOR UPDATE TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid()
        AND NOT coalesce(bc.is_archived, false)
        AND public.can_user_hold_club_role(auth.uid(), bc.id, 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid()
        AND NOT coalesce(bc.is_archived, false)
        AND public.can_user_hold_club_role(auth.uid(), bc.id, 'admin'))
  );
COMMIT;
