-- ============================================================
-- CLUBS REMEDIATION — BACKEND-02 migration (DRAFT, requires approval)
-- Club creation-cap enforcement TOCTOU race fix
-- Project: ahntbtktjjmvfosgkmgn · Branch: feat/clubs-ui-overhaul
--
-- LIVE EVIDENCE (2026-08-22, Supabase MCP read-only):
--   enforce_book_club_entitlement() is a zero-arg SECURITY DEFINER
--   trigger function (BEFORE INSERT/UPDATE/DELETE on book_clubs via
--   trigger_enforce_book_club_entitlement, tgtype 23).
--   The cap check is a non-locking SELECT COUNT(*) + comparison.
--   No FOR UPDATE / advisory lock / isolation control anywhere in the
--   path → two concurrent inserts by the same admin can both pass the
--   check and exceed the tier cap (pro=5, pro_plus=15).
--
-- FIX: take a transaction-scoped advisory lock keyed on the admin's
-- user id BEFORE counting. Concurrent creations by the same admin
-- serialize on the lock; different admins never contend (lock key is
-- per-admin). Advisory xact locks auto-release at COMMIT/ROLLBACK —
-- no state leak. Everything else in the function stays verbatim.
--
-- Concurrency semantics:
--   - INSERT racing INSERT: second blocks on lock until first commits,
--     then counts the committed row → correctly rejected at cap.
--   - UPDATE path (archive/unarchive/access changes): same key serializes
--     against creations by the same admin — also correct, since an
--     unarchive changes the count the next creation will see.
--   - Deadlock risk: none — single lock acquired once, before any other
--     lock in this trigger; ordering conflicts with other code paths
--     that might take advisory locks on the same key do not exist today
--     (verified: no pg_advisory* usage anywhere in live functions).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_book_club_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  admin_tier text;
  active_club_count integer;
  max_allowed integer;
BEGIN
  IF NEW.admin_id IS NULL THEN
    RAISE EXCEPTION 'Club admin is required';
  END IF;

  IF COALESCE(NEW.is_archived, FALSE) = FALSE THEN
    -- BACKEND-02: serialize cap accounting per admin. Must be taken
    -- BEFORE the count so a concurrent insert/update by the same admin
    -- waits until the in-flight one commits and its row is visible.
PERFORM pg_advisory_xact_lock(hashtextextended('club-cap:' || NEW.admin_id::text, 0));

    admin_tier := public.get_user_membership_tier(NEW.admin_id);

    IF public.membership_tier_rank(admin_tier) < public.membership_tier_rank('pro') THEN
      RAISE EXCEPTION 'Only Pro or Pro+ users can create or own clubs';
    END IF;

    IF NOT public.user_meets_access_level(NEW.admin_id, COALESCE(NEW.access_level, 'all')) THEN
      RAISE EXCEPTION 'Club admin membership tier must satisfy the club access level';
    END IF;

    SELECT COUNT(*)
    INTO active_club_count
    FROM public.book_clubs bc
    WHERE bc.admin_id = NEW.admin_id
      AND COALESCE(bc.is_archived, FALSE) = FALSE
      AND (TG_OP = 'INSERT' OR bc.id <> NEW.id);

    active_club_count := active_club_count + 1;
    max_allowed := CASE admin_tier
      WHEN 'pro' THEN 5
      WHEN 'pro_plus' THEN 15
      ELSE 0
    END;

    IF active_club_count > max_allowed THEN
      RAISE EXCEPTION 'Membership tier club creation limit reached';
    END IF;

    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = NEW.id
        AND cm.status IN ('active', 'muted')
        AND NOT public.user_meets_access_level(cm.user_id, COALESCE(NEW.access_level, 'all'))
    ) THEN
      RAISE EXCEPTION 'Cannot change club access level while active members do not satisfy the new access level';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

-- ============================================================
-- POST-APPLY READBACK CHECKLIST:
-- [ ] prosrc contains pg_advisory_xact_lock; length grew vs prior body
-- [ ] prosecdef still true, search_path=public preserved
-- [ ] Identity args still zero-arg (trigger-compatible)
-- [ ] Sanity: normal create flow unchanged for non-racing users
-- L4 CONCURRENCY TEST (L01 scope, to be authored):
--   Two parallel create_club calls at exact cap → exactly one succeeds,
--   one raises 'Membership tier club creation limit reached'.
-- ============================================================
