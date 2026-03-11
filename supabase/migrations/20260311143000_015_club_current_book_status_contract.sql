-- Clubs current-book status + analytics contract
-- Scope-limited bridge between a club's current_book_id and app-level user_books.reading_status.

CREATE OR REPLACE FUNCTION public.get_club_current_book_status_overview(
  p_club_id uuid
)
RETURNS TABLE (
  current_book_id uuid,
  member_reading_status text,
  to_start_count integer,
  reading_count integer,
  completed_count integer,
  active_member_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  club_record public.book_clubs%ROWTYPE;
  effective_member_status text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO club_record
  FROM public.book_clubs
  WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = current_user_id
      AND cm.status IN ('active', 'muted')
  ) THEN
    RAISE EXCEPTION 'Only club members can view current-book progress';
  END IF;

  IF club_record.current_book_id IS NULL THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::text,
      0::integer,
      0::integer,
      0::integer,
      0::integer;
    RETURN;
  END IF;

  SELECT COALESCE(ub.reading_status, 'want_to_read')
  INTO effective_member_status
  FROM public.user_books ub
  WHERE ub.user_id = current_user_id
    AND ub.book_id = club_record.current_book_id
  LIMIT 1;

  effective_member_status := COALESCE(effective_member_status, 'want_to_read');

  RETURN QUERY
  WITH active_members AS (
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.status = 'active'
  )
  SELECT
    club_record.current_book_id,
    effective_member_status,
    COUNT(*) FILTER (WHERE COALESCE(ub.reading_status, 'want_to_read') = 'want_to_read')::integer,
    COUNT(*) FILTER (WHERE COALESCE(ub.reading_status, 'want_to_read') = 'reading')::integer,
    COUNT(*) FILTER (WHERE COALESCE(ub.reading_status, 'want_to_read') = 'completed')::integer,
    COUNT(*)::integer
  FROM active_members am
  LEFT JOIN public.user_books ub
    ON ub.user_id = am.user_id
   AND ub.book_id = club_record.current_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_club_current_book_reading_status(
  p_club_id uuid,
  p_status text
)
RETURNS TABLE (
  current_book_id uuid,
  member_reading_status text,
  to_start_count integer,
  reading_count integer,
  completed_count integer,
  active_member_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  club_record public.book_clubs%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_status NOT IN ('want_to_read', 'reading', 'completed') THEN
    RAISE EXCEPTION 'Reading status must be want_to_read, reading, or completed';
  END IF;

  SELECT * INTO club_record
  FROM public.book_clubs
  WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = current_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active club members can update current-book reading status';
  END IF;

  IF club_record.current_book_id IS NULL THEN
    RAISE EXCEPTION 'This club has no current book selected';
  END IF;

  INSERT INTO public.user_books (
    user_id,
    book_id,
    reading_status,
    completed_at
  )
  VALUES (
    current_user_id,
    club_record.current_book_id,
    p_status,
    CASE WHEN p_status = 'completed' THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, book_id)
  DO UPDATE SET
    reading_status = EXCLUDED.reading_status,
    completed_at = CASE WHEN EXCLUDED.reading_status = 'completed' THEN now() ELSE NULL END,
    updated_at = now();

  RETURN QUERY
  SELECT *
  FROM public.get_club_current_book_status_overview(p_club_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_current_book_status_overview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_club_current_book_reading_status(uuid, text) TO authenticated, service_role;