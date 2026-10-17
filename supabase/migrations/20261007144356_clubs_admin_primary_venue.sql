-- Prepared from verified live Clubs state, 2026-10-07. NOT APPLIED.
-- Supersedes only the primary RPC in the pending July Clubs/Exchange file.
-- Does not deploy that file's Exchange changes or repair the shared ledger.
-- Direct table-write permissions intentionally retain the observed live model.
BEGIN;

LOCK TABLE public.club_venues IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.club_venues
    WHERE is_primary IS TRUE
    GROUP BY club_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple primary venues exist; audit and resolve before applying'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.club_venues'::regclass
      AND polname NOT IN (
        'Club venues are viewable by members', 'Club leads can manage club venues',
        'Members can view club venues', 'Admins can manage club venues'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected venue-link policies; re-audit before applying'
      USING ERRCODE = '55000';
  END IF;
  -- A fresh replay has the exact two 008-era names; the audited live schema
  -- has the exact two current names. Reject missing, duplicated, or mixed
  -- policy families instead of silently repairing unreviewed drift.
  IF (
    SELECT count(*) FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.club_venues'::regclass
      AND polname IN (
        'Club venues are viewable by members', 'Members can view club venues',
        'Club leads can manage club venues', 'Admins can manage club venues'
      )
  ) <> 2 OR (
    SELECT count(*) FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.club_venues'::regclass
      AND polname IN ('Club venues are viewable by members', 'Members can view club venues')
      AND polcmd = 'r'
  ) <> 1 OR (
    SELECT count(*) FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.club_venues'::regclass
      AND polname IN ('Club leads can manage club venues', 'Admins can manage club venues')
      AND polcmd = '*'
  ) <> 1 THEN
    RAISE EXCEPTION 'Expected one recognized SELECT and one recognized ALL venue-link policy; re-audit before applying'
      USING ERRCODE = '55000';
  END IF;
  -- Accept either the exact pair from the historical replay or the exact pair
  -- observed live. Do not combine a historical read policy with the live write
  -- policy (or vice versa), since that mixed state has not been audited.
  IF (
    EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.club_venues'::regclass
        AND polname = 'Club venues are viewable by members'
    ) AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.club_venues'::regclass
        AND polname = 'Admins can manage club venues'
    )
  ) OR (
    EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.club_venues'::regclass
        AND polname = 'Members can view club venues'
    ) AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.club_venues'::regclass
        AND polname = 'Club leads can manage club venues'
    )
  ) THEN
    RAISE EXCEPTION 'Mixed historical/current venue-link policy families; re-audit before applying'
      USING ERRCODE = '55000';
  END IF;
  -- Compare exact PostgreSQL 17 catalog output: do not normalize literal case
  -- or whitespace. Deparser/environment drift must fail closed for re-audit.
  -- Names alone are not enough to establish that the live predicates still
  -- match the state this forward migration was prepared against.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.club_venues'::regclass
      AND p.polname = 'Club venues are viewable by members'
      AND NOT (
        p.polpermissive AND p.polcmd = 'r' AND p.polroles = ARRAY[0::oid]
        AND p.polqual IS NOT NULL
        AND p.polwithcheck IS NULL
        AND pg_catalog.pg_get_expr(p.polqual, p.polrelid) =
          E'(EXISTS ( SELECT 1\n   FROM club_members\n  WHERE ((club_members.club_id = club_venues.club_id) AND (club_members.user_id = auth.uid()))))'
      )
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.club_venues'::regclass
      AND p.polname = 'Club leads can manage club venues'
      AND NOT (
        p.polpermissive AND p.polcmd = '*' AND p.polroles = ARRAY[0::oid]
        AND p.polqual IS NOT NULL
        AND p.polwithcheck IS NULL
        AND pg_catalog.pg_get_expr(p.polqual, p.polrelid) =
          E'(EXISTS ( SELECT 1\n   FROM club_members\n  WHERE ((club_members.club_id = club_venues.club_id) AND (club_members.user_id = auth.uid()) AND (club_members.role = ''lead''::text))))'
      )
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.club_venues'::regclass
      AND p.polname = 'Members can view club venues'
      AND NOT (
        p.polpermissive AND p.polcmd = 'r' AND p.polroles = ARRAY[0::oid]
        AND p.polqual IS NOT NULL
        AND p.polwithcheck IS NULL
        AND pg_catalog.pg_get_expr(p.polqual, p.polrelid) =
          E'(EXISTS ( SELECT 1\n   FROM club_members\n  WHERE ((club_members.club_id = club_venues.club_id) AND (club_members.user_id = auth.uid()))))'
      )
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.club_venues'::regclass
      AND p.polname = 'Admins can manage club venues'
      AND NOT (
        p.polpermissive AND p.polcmd = '*' AND p.polroles = ARRAY[0::oid]
        AND p.polqual IS NOT NULL
        AND p.polwithcheck IS NULL
        AND pg_catalog.pg_get_expr(p.polqual, p.polrelid) =
          E'(EXISTS ( SELECT 1\n   FROM book_clubs\n  WHERE ((book_clubs.id = club_venues.club_id) AND (book_clubs.admin_id = auth.uid()))))'
      )
  ) THEN
    RAISE EXCEPTION 'Current venue-link policy differs from the audited live predicate; re-audit before applying'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

CREATE UNIQUE INDEX club_venues_one_primary_per_club
  ON public.club_venues (club_id) WHERE is_primary IS TRUE;

-- Canonicalize known historical policy names to the CURRENT live predicates.
-- This preserves live permissions and fixes the old lead-role replay branch.
DROP POLICY IF EXISTS "Club venues are viewable by members" ON public.club_venues;
DROP POLICY IF EXISTS "Club leads can manage club venues" ON public.club_venues;
DROP POLICY IF EXISTS "Members can view club venues" ON public.club_venues;
DROP POLICY IF EXISTS "Admins can manage club venues" ON public.club_venues;
ALTER TABLE public.club_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view club venues" ON public.club_venues
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.club_members
      WHERE club_members.club_id = club_venues.club_id AND club_members.user_id = auth.uid())
  );
CREATE POLICY "Admins can manage club venues" ON public.club_venues
  FOR ALL TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs
      WHERE book_clubs.id = club_venues.club_id AND book_clubs.admin_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.set_primary_club_venue(
  p_club_id uuid,
  p_venue_id uuid
)
RETURNS public.club_venues
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.club_venues;
BEGIN
  IF v_actor IS NULL OR p_club_id IS NULL OR p_venue_id IS NULL
     OR NOT public.can_user_hold_club_role(v_actor, p_club_id, 'admin') THEN
    RAISE EXCEPTION 'Only an eligible club administrator can choose the primary venue'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize participating RPCs without needing UPDATE on book_clubs,
  -- which the verified live authenticated role does not have.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_club_id::text, 61007074621)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.book_clubs bc
    WHERE bc.id = p_club_id AND bc.admin_id = v_actor
      AND NOT coalesce(bc.is_archived, false)
      AND public.can_user_hold_club_role(v_actor, p_club_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'This club is unavailable for primary venue changes'
      USING ERRCODE = '42501';
  END IF;

  SELECT cv.* INTO v_target FROM public.club_venues cv
  WHERE cv.club_id = p_club_id AND cv.venue_id = p_venue_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose a venue already linked to this club'
      USING ERRCODE = '23503';
  END IF;

  -- Clear before setting: a partial unique index checks each row immediately.
  UPDATE public.club_venues SET is_primary = false
  WHERE club_id = p_club_id AND venue_id <> p_venue_id AND is_primary IS TRUE;
  UPDATE public.club_venues SET is_primary = true
  WHERE club_id = p_club_id AND venue_id = p_venue_id
  RETURNING * INTO v_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to save the primary venue'
      USING ERRCODE = '42501';
  END IF;
  -- Final authorization checkpoint follows every potentially blocking link write.
  -- READ COMMITTED observes revocations committed during either row-lock wait.
  -- Rejection rolls back both flag updates. This does not coordinate revocations
  -- after this checkpoint or stronger-isolation snapshots with entitlement writers.
  IF NOT EXISTS (
    SELECT 1 FROM public.book_clubs bc
    WHERE bc.id = p_club_id AND bc.admin_id = v_actor
      AND NOT coalesce(bc.is_archived, false)
      AND public.can_user_hold_club_role(v_actor, p_club_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'This club is unavailable for primary venue changes'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_target;
END;
$function$;

-- CREATE OR REPLACE can inherit the old RPC's ACLs; reset them explicitly.
REVOKE ALL ON FUNCTION public.set_primary_club_venue(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_primary_club_venue(uuid, uuid)
  TO authenticated;
COMMENT ON FUNCTION public.set_primary_club_venue(uuid, uuid) IS
  'Eligible administrator-only primary selection. Invoker RLS applies; existing events and direct table permissions are unchanged.';

COMMIT;
