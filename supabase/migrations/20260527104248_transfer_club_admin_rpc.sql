CREATE OR REPLACE FUNCTION public.transfer_club_admin(
  p_club_id uuid,
  p_new_admin_user_id uuid
)
RETURNS public.book_clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  club_record public.book_clubs%ROWTYPE;
  successor_member public.club_members%ROWTYPE;
  updated_club public.book_clubs%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_club_id IS NULL OR p_new_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Club and successor are required';
  END IF;

  SELECT *
  INTO club_record
  FROM public.book_clubs
  WHERE id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF club_record.admin_id IS DISTINCT FROM current_user_id THEN
    RAISE EXCEPTION 'Only the current club admin can transfer ownership';
  END IF;

  IF COALESCE(club_record.club_type, '') = 'author_club' THEN
    RAISE EXCEPTION 'Author club admin transfer is not supported in this version';
  END IF;

  IF p_new_admin_user_id = current_user_id THEN
    RAISE EXCEPTION 'Choose a different successor';
  END IF;

  SELECT *
  INTO successor_member
  FROM public.club_members
  WHERE club_id = p_club_id
    AND user_id = p_new_admin_user_id
    AND status IN ('active', 'muted')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Successor must be an active club member';
  END IF;

  IF NOT public.user_meets_access_level(p_new_admin_user_id, COALESCE(club_record.access_level, 'all')) THEN
    RAISE EXCEPTION 'Successor membership tier must satisfy the club access level';
  END IF;

  IF public.membership_tier_rank(public.get_user_membership_tier(p_new_admin_user_id)) < public.membership_tier_rank('pro') THEN
    RAISE EXCEPTION 'Only Pro or Pro+ users can become club admin';
  END IF;

  UPDATE public.book_clubs
  SET admin_id = p_new_admin_user_id,
      updated_at = now()
  WHERE id = p_club_id
  RETURNING * INTO updated_club;

  UPDATE public.club_members
  SET role = 'member'
  WHERE club_id = p_club_id
    AND user_id = current_user_id
    AND role = 'admin';

  UPDATE public.club_members
  SET role = 'admin',
      status = 'active'
  WHERE club_id = p_club_id
    AND user_id = p_new_admin_user_id;

  RETURN updated_club;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_club_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_club_admin(uuid, uuid) TO authenticated, service_role;
