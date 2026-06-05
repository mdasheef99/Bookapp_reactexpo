BEGIN;

ALTER TABLE public.club_invitations
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS club_invitations_invitee_unread_idx
  ON public.club_invitations (invitee_user_id, status, read_at)
  WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.revoke_club_invitation(
  p_invitation_id uuid
)
RETURNS public.club_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  invitation_record public.club_invitations%ROWTYPE;
  updated_invitation public.club_invitations%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO invitation_record
  FROM public.club_invitations
  WHERE id = p_invitation_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = invitation_record.club_id
      AND (
        bc.admin_id = current_user_id
        OR EXISTS (
          SELECT 1
          FROM public.club_members cm
          WHERE cm.club_id = invitation_record.club_id
            AND cm.user_id = current_user_id
            AND cm.role IN ('admin', 'moderator')
            AND cm.status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Only moderators or admins can revoke invitations';
  END IF;

  UPDATE public.club_invitations
  SET status = 'revoked',
      responded_at = now()
  WHERE id = invitation_record.id
  RETURNING * INTO updated_invitation;

  RETURN updated_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_invitation_read(
  p_invitation_id uuid
)
RETURNS public.club_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  updated_invitation public.club_invitations%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.club_invitations
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_invitation_id
    AND invitee_user_id = current_user_id
  RETURNING * INTO updated_invitation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  RETURN updated_invitation;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_club_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_invitation_read(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.revoke_club_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_invitation_read(uuid) TO authenticated, service_role;

COMMIT;
