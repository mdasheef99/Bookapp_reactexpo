-- ============================================================
-- CLUBS WU-TC03 · Admin-transfer acceptance repair (forward fix)
-- Project: ahntbtktjjmvfosgkmgn · Branch: feat/clubs-ui-overhaul
-- ============================================================
--
-- DEFECT (proven in WU-TC03 context gate against live defs, project
-- ahntbtktjjmvfosgkmgn):
--   public.accept_club_admin_transfer_request demoted the existing
--   club_members role='admin' row BEFORE flipping book_clubs.admin_id.
--   The BEFORE trigger enforce_single_club_admin_membership requires the
--   current book_clubs.admin_id user's membership to remain role='admin',
--   status='active', so the demote raised
--   'Primary club owner membership must remain active admin' on EVERY
--   invariant-satisfying club: valid successors could never accept a
--   normal transfer. The only theoretical success path (admin_id IS NULL)
--   does not occur (live invariant audit: 0 violations).
--
-- FIX (forward bug fix, NOT historical reconciliation):
--   1. accept: all guards moved/completed BEFORE any write, then the
--      REQUIRED write order — flip book_clubs.admin_id first (protected by
--      enforce_book_club_entitlement incl. cap + advisory lock), then
--      demote old admin membership, then upsert successor as admin/active,
--      then mark the request accepted. New accept-time revalidation:
--      club exists, admin unchanged since request (admin_id =
--      requested_by), club not archived, successor != current admin,
--      successor membership still active/muted, tier >= pro, club
--      access_level met, author-club verified-author rule re-checked.
--   2. request: add archived-club guard, self-transfer guard, and club
--      access_level eligibility check. Existing admin authorization,
--      author-club rule, membership rule, tier rule, cancel-pending +
--      7-day expiry behavior unchanged.
--   3. Drop the direct-table INSERT policy "Admins can create transfer
--      requests" so request creation is RPC-only (the app already uses
--      the RPC exclusively; SELECT policy preserved; no UPDATE/DELETE
--      policies exist or are added).
--
-- CONTRACT PRESERVATION (WU-TC03):
--   * Identity (uuid / uuid->book_clubs, uuid->book_clubs), parameter
--     names, defaults, return types unchanged; LANGUAGE plpgsql,
--     SECURITY DEFINER, SET search_path = public, volatility, owner
--     behavior unchanged.
--   * EXECUTE contract re-stated: PUBLIC/anon revoked, authenticated +
--     service_role granted (CREATE OR REPLACE preserves existing ACL/owner
--     for the same identity; re-stated per house style).
--   * No table rewrite, no data migration, no new index, no cron, no Edge.
--   * Deferred (NOT fixed here, per approved decision): expired rows
--     remaining status='pending', partial unique index for one pending
--     request per club, club row lock during request, repo-only
--     transfer_club_admin, notification behavior, app error mapping.
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_club_admin_transfer(
  p_club_id uuid,
  p_new_admin_user_id uuid
)
RETURNS public.club_admin_transfer_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  club_record public.book_clubs;
  request_record public.club_admin_transfer_requests;
BEGIN
  SELECT * INTO club_record
  FROM public.book_clubs
  WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF COALESCE(club_record.is_archived, FALSE) THEN
    RAISE EXCEPTION 'Archived clubs cannot transfer admin ownership';
  END IF;

  IF club_record.admin_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the current admin can request transfer';
  END IF;

  IF p_new_admin_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Choose a different successor';
  END IF;

  IF club_record.club_type = 'author_club' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = club_record.author_id
        AND up.user_id = p_new_admin_user_id
        AND COALESCE(up.is_verified_author, FALSE) = TRUE
    ) THEN
      RAISE EXCEPTION 'Author club transfers require the verified author profile owner';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = p_new_admin_user_id
      AND status IN ('active', 'muted')
  ) THEN
    RAISE EXCEPTION 'New admin must be an active club member';
  END IF;

  IF public.membership_tier_rank(public.get_user_membership_tier(p_new_admin_user_id)) < public.membership_tier_rank('pro') THEN
    RAISE EXCEPTION 'New admin must be a Pro or Pro+ member';
  END IF;

  IF NOT public.user_meets_access_level(p_new_admin_user_id, COALESCE(club_record.access_level, 'all')) THEN
    RAISE EXCEPTION 'Successor membership tier must satisfy the club access level';
  END IF;

  UPDATE public.club_admin_transfer_requests
  SET status = 'cancelled',
      responded_at = now()
  WHERE club_id = p_club_id
    AND status = 'pending';

  INSERT INTO public.club_admin_transfer_requests (club_id, requested_by, proposed_admin_user_id)
  VALUES (p_club_id, auth.uid(), p_new_admin_user_id)
  RETURNING * INTO request_record;

  RETURN request_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_club_admin_transfer_request(
  p_request_id uuid
)
RETURNS public.book_clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.club_admin_transfer_requests;
  club_record public.book_clubs;
BEGIN
  SELECT * INTO request_record
  FROM public.club_admin_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR request_record.status <> 'pending' OR request_record.expires_at <= now() THEN
    RAISE EXCEPTION 'Transfer request is not pending';
  END IF;

  IF request_record.proposed_admin_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the proposed admin can accept this transfer';
  END IF;

  SELECT * INTO club_record
  FROM public.book_clubs
  WHERE id = request_record.club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF club_record.admin_id IS DISTINCT FROM request_record.requested_by THEN
    RAISE EXCEPTION 'Transfer request is no longer valid: club ownership changed';
  END IF;

  IF COALESCE(club_record.is_archived, FALSE) THEN
    RAISE EXCEPTION 'Archived clubs cannot transfer admin ownership';
  END IF;

  IF club_record.admin_id = request_record.proposed_admin_user_id THEN
    RAISE EXCEPTION 'Choose a different successor';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_id = request_record.club_id
      AND user_id = request_record.proposed_admin_user_id
      AND status IN ('active', 'muted')
  ) THEN
    RAISE EXCEPTION 'Successor must be an active club member';
  END IF;

  IF public.membership_tier_rank(public.get_user_membership_tier(request_record.proposed_admin_user_id)) < public.membership_tier_rank('pro') THEN
    RAISE EXCEPTION 'Only Pro or Pro+ users can become club admin';
  END IF;

  IF NOT public.user_meets_access_level(request_record.proposed_admin_user_id, COALESCE(club_record.access_level, 'all')) THEN
    RAISE EXCEPTION 'Successor membership tier must satisfy the club access level';
  END IF;

  IF club_record.club_type = 'author_club' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = club_record.author_id
        AND up.user_id = request_record.proposed_admin_user_id
        AND COALESCE(up.is_verified_author, FALSE) = TRUE
    ) THEN
      RAISE EXCEPTION 'Author club transfers require the verified author profile owner';
    END IF;
  END IF;

  -- WU-TC03 REQUIRED WRITE ORDER: the single-admin membership trigger
  -- (enforce_single_club_admin_membership) forbids demoting the row whose
  -- user_id equals book_clubs.admin_id and forbids granting role='admin'
  -- to a non-owner. Flipping admin_id FIRST satisfies both, and this
  -- UPDATE stays protected by enforce_book_club_entitlement (tier,
--   access level, per-admin cap + advisory lock).
  UPDATE public.book_clubs
  SET admin_id = request_record.proposed_admin_user_id,
      updated_at = now()
  WHERE id = request_record.club_id
  RETURNING * INTO club_record;

  UPDATE public.club_members
  SET role = 'member'
  WHERE club_id = request_record.club_id
    AND role = 'admin';

  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (request_record.club_id, request_record.proposed_admin_user_id, 'admin', 'active')
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET role = 'admin', status = 'active';

  UPDATE public.club_admin_transfer_requests
  SET status = 'accepted',
      responded_at = now()
  WHERE id = p_request_id;

  RETURN club_record;
END;
$$;

-- Policy removal: request creation becomes RPC-only (SELECT policy and the
-- absent UPDATE/DELETE policies are intentionally untouched).
DROP POLICY IF EXISTS "Admins can create transfer requests" ON public.club_admin_transfer_requests;

-- Privilege preservation (re-stated per house style; CREATE OR REPLACE
-- preserves owner/ACL for identical identity, verified empirically in
-- WU-TC01).
REVOKE ALL ON FUNCTION public.request_club_admin_transfer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_club_admin_transfer(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.accept_club_admin_transfer_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_club_admin_transfer_request(uuid) TO authenticated, service_role;
