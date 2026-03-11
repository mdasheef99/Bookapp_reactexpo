CREATE OR REPLACE FUNCTION public.can_view_club_members(
  p_club_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = p_club_id
      AND bc.admin_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status IN ('active', 'muted')
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_club_members(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_club_members(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can view club members" ON public.club_members;
CREATE POLICY "Members can view club members"
ON public.club_members
FOR SELECT
USING (
  public.can_view_club_members(club_members.club_id, auth.uid())
);