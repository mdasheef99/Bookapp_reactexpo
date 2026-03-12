BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_book_reviews(p_book_id uuid)
RETURNS TABLE (
  user_book_id uuid,
  book_id uuid,
  rating integer,
  review text,
  created_at timestamptz,
  author_user_id uuid,
  author_display_name text,
  author_username text,
  author_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ub.id AS user_book_id,
    ub.book_id,
    ub.rating,
    ub.review,
    ub.created_at,
    up.user_id AS author_user_id,
    up.display_name AS author_display_name,
    up.username AS author_username,
    up.avatar_url AS author_avatar_url
  FROM public.user_books ub
  INNER JOIN public.user_profiles up
    ON up.user_id = ub.user_id
  WHERE ub.book_id = p_book_id
    AND COALESCE(ub.review_is_public, FALSE) = TRUE
    AND NULLIF(BTRIM(ub.review), '') IS NOT NULL
    AND (
      auth.uid() IS NULL
      OR ub.user_id IS DISTINCT FROM auth.uid()
    )
  ORDER BY ub.created_at DESC, ub.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_book_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_book_reviews(uuid) TO authenticated, service_role;

COMMIT;