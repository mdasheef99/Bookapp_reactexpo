-- Allow club admins to set the current book directly from an existing nomination
-- without waiting for the voting window to close.

CREATE OR REPLACE FUNCTION public.set_club_current_book_from_nomination(
  p_nomination_id uuid
)
RETURNS public.book_clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  nomination_record public.book_nominations%ROWTYPE;
  updated_club public.book_clubs%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO nomination_record
  FROM public.book_nominations
  WHERE id = p_nomination_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nomination not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = nomination_record.club_id
      AND bc.admin_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Only the club admin can set the current book';
  END IF;

  IF nomination_record.status NOT IN ('active', 'selected') THEN
    RAISE EXCEPTION 'Only active nominations can become the current book';
  END IF;

  DELETE FROM public.book_nominations existing_selected
  WHERE existing_selected.club_id = nomination_record.club_id
    AND existing_selected.book_id = nomination_record.book_id
    AND existing_selected.status = 'selected'
    AND existing_selected.id <> nomination_record.id;

  UPDATE public.book_nominations
  SET status = 'selected'
  WHERE id = nomination_record.id;

  UPDATE public.book_clubs
  SET current_book_id = nomination_record.book_id,
      updated_at = now()
  WHERE id = nomination_record.club_id
  RETURNING * INTO updated_club;

  RETURN updated_club;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_club_current_book_from_nomination(uuid) TO authenticated, service_role;
