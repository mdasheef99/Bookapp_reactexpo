CREATE OR REPLACE FUNCTION public.issue_club_member_action(
  p_club_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_reason text,
  p_duration_hours integer DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.issue_club_member_action(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_club_member_action(uuid, uuid, text, text, integer) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.club_admin_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  proposed_admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_club_admin_transfer_requests_club_status
  ON public.club_admin_transfer_requests(club_id, status, created_at DESC);

ALTER TABLE public.club_admin_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers and proposed admins can view transfer requests" ON public.club_admin_transfer_requests;
CREATE POLICY "Managers and proposed admins can view transfer requests"
ON public.club_admin_transfer_requests
FOR SELECT
USING (
  proposed_admin_user_id = auth.uid()
  OR public.is_active_eligible_club_manager(auth.uid(), club_id)
);

DROP POLICY IF EXISTS "Admins can create transfer requests" ON public.club_admin_transfer_requests;
CREATE POLICY "Admins can create transfer requests"
ON public.club_admin_transfer_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_id
      AND bc.admin_id = auth.uid()
  )
);

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

  IF club_record.admin_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the current admin can request transfer';
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

  IF public.membership_tier_rank(public.get_user_membership_tier(p_new_admin_user_id)) < public.membership_tier_rank('pro') THEN
    RAISE EXCEPTION 'New admin must be a Pro or Pro+ member';
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

  UPDATE public.club_members
  SET role = 'member'
  WHERE club_id = request_record.club_id
    AND role = 'admin';

  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (request_record.club_id, request_record.proposed_admin_user_id, 'admin', 'active')
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET role = 'admin', status = 'active';

  UPDATE public.book_clubs
  SET admin_id = request_record.proposed_admin_user_id,
      updated_at = now()
  WHERE id = request_record.club_id
  RETURNING * INTO club_record;

  UPDATE public.club_admin_transfer_requests
  SET status = 'accepted',
      responded_at = now()
  WHERE id = p_request_id;

  RETURN club_record;
END;
$$;

REVOKE ALL ON FUNCTION public.request_club_admin_transfer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_club_admin_transfer(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.accept_club_admin_transfer_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_club_admin_transfer_request(uuid) TO authenticated, service_role;
