-- ============================================================
-- CLUBS REMEDIATION — Wave 2 migration (DRAFT, not yet applied)
-- Covers: BACKEND-03 (resolved_by pin) · BACKEND-04 (cancelled_by pin)
--         HIER-02/HIER-03/P04 (issue_club_member_action guards)
--         BACKEND-05 / PRODUCT-05 (invitation expiry)
-- Project: ahntbtktjjmvfosgkmgn · Branch: feat/clubs-ui-overhaul
-- Forward-only. One ledger window. Requires explicit user approval
-- before any application to live.
-- Live evidence gathered 2026-08-22 via Supabase MCP (read-only);
-- full function bodies verified byte-accurate before rewrite.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) BACKEND-03 — club_complaints.resolved_by server-pinned
--    Evidence: resolved_by uuid NULL, no default, NO trigger on table;
--    client update path (clubsComplaintsService.resolveClubComplaint)
--    never sends resolved_by; UPDATE policy authorizes managers but
--    nothing pins attribution. Mirror of the existing
--    enforce_club_discussion_report_state pattern.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_club_complaint_resolution_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'dismissed') THEN
    -- Server-pin to the caller regardless of any client-supplied value.
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  ELSE
    -- Non-closing states clear attribution.
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_club_complaint_resolution ON public.club_complaints;
CREATE TRIGGER trg_enforce_club_complaint_resolution
BEFORE UPDATE ON public.club_complaints
FOR EACH ROW EXECUTE FUNCTION public.enforce_club_complaint_resolution_state();

-- ------------------------------------------------------------
-- 2) BACKEND-04 — club_events.cancelled_by server-pinned
--    Evidence: client cancelClubEvent() sends cancelledBy in the UPDATE
--    payload; live UPDATE policy ("Admins or event creators can update
--    club events") authorizes but does not pin; notification trigger
--    route_club_event_notification only COALESCEs for recipient routing.
--    Fix: BEFORE UPDATE trigger forces cancelled_by := auth.uid() on the
--    scheduled→cancelled transition and stamps cancelled_at.
--    Client change (separate commit): stop sending cancelled_by from
--    clubsEventsService.cancelClubEvent — column becomes server-owned.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pin_club_event_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_by := auth.uid();
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pin_club_event_cancellation ON public.club_events;
CREATE TRIGGER trg_pin_club_event_cancellation
BEFORE UPDATE ON public.club_events
FOR EACH ROW EXECUTE FUNCTION public.pin_club_event_cancellation();

-- NOTE on RLS with_check compatibility: the existing event UPDATE policy
-- requires actor be admin-or-creator via can_manage_club_event / role
-- helpers. Pinning cancelled_by does not alter who may cancel; it only
-- guarantees attribution truthfulness. No policy change required.

-- ------------------------------------------------------------
-- 3) HIER-02 + HIER-03/PRODUCT-HIER-P04 — issue_club_member_action
--    Live body verified (prosrc_len 1780). Two guards inserted after
--    the admin-exclusion check:
--      (a) HIER-02: target must be an ACTIVE member of THIS club
--      (b) P04/HIER-03: reject self-targeting outright
--    Everything else preserved verbatim (duration validation,
--    action insert incl. performed_by := auth.uid(), status flip).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_club_member_action(
  p_club_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_reason text,
  p_duration_hours integer
)
RETURNS public.club_member_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_record public.club_member_actions;
  expires_value timestamptz := NULL;
  next_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action_type NOT IN ('warned', 'muted', 'banned') THEN
    RAISE EXCEPTION 'Unsupported moderation action';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A moderation reason is required';
  END IF;

  IF NOT public.is_active_eligible_club_manager(auth.uid(), p_club_id) THEN
    RAISE EXCEPTION 'Only eligible club managers can moderate members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = p_user_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Club admins cannot be moderated through this action';
  END IF;

  -- HIER-02: target must currently be an active member of this club.
  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Target user is not an active member of this club';
  END IF;

  -- PRODUCT-HIER-P04 / HIER-03: self-moderation prohibited.
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'Self-moderation is not permitted';
  END IF;

  IF p_action_type = 'muted' AND p_duration_hours IS NOT NULL THEN
    IF p_duration_hours < 1 THEN
      RAISE EXCEPTION 'Mute duration must be at least one hour';
    END IF;
    expires_value := now() + make_interval(hours => p_duration_hours);
  END IF;

  INSERT INTO public.club_member_actions (
    club_id,
    user_id,
    action_type,
    reason,
    duration_hours,
    expires_at,
    performed_by
  )
  VALUES (
    p_club_id,
    p_user_id,
    p_action_type,
    BTRIM(p_reason),
    p_duration_hours,
    expires_value,
    auth.uid()
  )
  RETURNING * INTO action_record;

  next_status := CASE p_action_type
    WHEN 'muted' THEN 'muted'
    WHEN 'banned' THEN 'banned'
    ELSE NULL
  END;

  IF next_status IS NOT NULL THEN
    UPDATE public.club_members
    SET status = next_status
    WHERE club_id = p_club_id
      AND user_id = p_user_id
      AND role <> 'admin';
  END IF;

  RETURN action_record;
END;
$$;

-- Signature-compat check note: original identity args were
-- (p_club_id uuid, p_user_id uuid, p_action_type text, p_reason text,
--  p_duration_hours integer). If the live signature has no DEFAULT on
-- p_duration_hours, drop the DEFAULT here to match exactly. Verify at
-- application time against pg_get_function_identity_arguments.

-- ------------------------------------------------------------
-- 4) BACKEND-05 / PRODUCT-05 — invitation expiry (decision A: 14 days)
--    Live evidence: club_invitations has NO expires_at column;
--    accept_club_invitation (prosrc_len 1867) never checks expiry.
--    Per DECISIONS.md: synchronous RPC gate is authoritative; cron
--    relabeling is presentation-only.
-- ------------------------------------------------------------
ALTER TABLE public.club_invitations
  ADD COLUMN expires_at timestamptz;

-- Backfill legacy pending invitations: fair transition window.
UPDATE public.club_invitations
SET expires_at = now() + interval '14 days'
WHERE status = 'pending';

-- Default for future invitations issued after this migration.
ALTER TABLE public.club_invitations
  ALTER COLUMN expires_at SET DEFAULT now() + interval '14 days';

CREATE OR REPLACE FUNCTION public.accept_club_invitation(
  p_invitation_id uuid
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  invitation_record public.club_invitations%ROWTYPE;
  created_membership public.club_members%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO invitation_record
  FROM public.club_invitations
  WHERE id = p_invitation_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found';
  END IF;

  -- PRODUCT-05: expiry enforced synchronously inside acceptance.
  IF invitation_record.expires_at IS NOT NULL
     AND invitation_record.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  IF invitation_record.invitee_user_id <> current_user_id THEN
    RAISE EXCEPTION 'You can only accept invitations addressed to you';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = invitation_record.club_id
      AND COALESCE(bc.is_archived, FALSE) = TRUE
  ) THEN
    RAISE EXCEPTION 'Archived clubs cannot accept new members';
  END IF;

  IF NOT public.user_meets_club_access_level(current_user_id, invitation_record.club_id) THEN
    RAISE EXCEPTION 'Your membership tier does not satisfy this club access level';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = invitation_record.club_id
      AND cm.user_id = current_user_id
      AND cm.status = 'banned'
  ) THEN
    RAISE EXCEPTION 'Banned users cannot accept club invitations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = invitation_record.club_id
      AND cm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'User already has a membership record for this club';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (invitation_record.club_id, current_user_id, 'member', 'active')
  RETURNING * INTO created_membership;

  UPDATE public.club_invitations
  SET status = 'accepted',
      responded_at = now()
  WHERE id = invitation_record.id;

  RETURN created_membership;
END;
$$;

COMMIT;

-- ============================================================
-- APPLICATION CHECKLIST (before supabase push):
-- [ ] User approval recorded in tracker ledger
-- [ ] Both worktree trackers checked (shared project rule)
-- [ ] pg_get_function_identity_arguments diff vs signatures above
-- [ ] Return-type verification: accept_club_invitation RETURNS
--     public.club_members confirmed from procontext
-- [ ] Post-apply readback: prosrc lengths + new trigger presence +
--     expires_at column/default + backfill count
-- ============================================================
