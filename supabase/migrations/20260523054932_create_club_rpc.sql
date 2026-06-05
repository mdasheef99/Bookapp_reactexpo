BEGIN;

CREATE OR REPLACE FUNCTION public.create_club(
  p_name text,
  p_description text DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_club_type text DEFAULT 'public',
  p_access_level text DEFAULT 'all',
  p_meeting_type text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL,
  p_current_book_id uuid DEFAULT NULL,
  p_max_members integer DEFAULT NULL,
  p_author_id uuid DEFAULT NULL
)
RETURNS public.book_clubs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(p_name);
  normalized_club_type text := COALESCE(NULLIF(btrim(p_club_type), ''), 'public');
  normalized_access_level text := COALESCE(NULLIF(btrim(p_access_level), ''), 'all');
  normalized_meeting_type text := NULLIF(btrim(p_meeting_type), '');
  created_club public.book_clubs%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create a club';
  END IF;

  IF p_admin_id IS NULL OR p_admin_id IS DISTINCT FROM current_user_id THEN
    RAISE EXCEPTION 'Club admin must match the authenticated user';
  END IF;

  IF normalized_name IS NULL OR char_length(normalized_name) < 3 THEN
    RAISE EXCEPTION 'Club name must be at least 3 characters';
  END IF;

  IF normalized_club_type NOT IN ('public', 'approval', 'invite_only', 'author_club') THEN
    RAISE EXCEPTION 'Invalid club type';
  END IF;

  IF normalized_access_level NOT IN ('all', 'pro', 'pro_plus') THEN
    RAISE EXCEPTION 'Invalid club access level';
  END IF;

  IF normalized_meeting_type IS NOT NULL
     AND normalized_meeting_type NOT IN ('online_only', 'venue_based', 'hybrid') THEN
    RAISE EXCEPTION 'Invalid club meeting type';
  END IF;

  IF p_max_members IS NOT NULL AND p_max_members < 2 THEN
    RAISE EXCEPTION 'Club member limit must be at least 2';
  END IF;

  IF normalized_club_type = 'author_club' AND p_author_id IS NULL THEN
    RAISE EXCEPTION 'author_club requires author_id';
  END IF;

  INSERT INTO public.book_clubs (
    name,
    description,
    cover_url,
    club_type,
    access_level,
    meeting_type,
    admin_id,
    current_book_id,
    max_members,
    author_id
  )
  VALUES (
    normalized_name,
    NULLIF(btrim(p_description), ''),
    NULLIF(btrim(p_cover_url), ''),
    normalized_club_type,
    normalized_access_level,
    normalized_meeting_type,
    p_admin_id,
    p_current_book_id,
    p_max_members,
    CASE WHEN normalized_club_type = 'author_club' THEN p_author_id ELSE NULL END
  )
  RETURNING * INTO created_club;

  INSERT INTO public.club_members (
    club_id,
    user_id,
    role,
    status
  )
  VALUES (
    created_club.id,
    p_admin_id,
    'admin',
    'active'
  );

  RETURN created_club;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_club(text, text, text, text, text, text, uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_club(text, text, text, text, text, text, uuid, uuid, integer, uuid) TO authenticated, service_role;

COMMIT;
