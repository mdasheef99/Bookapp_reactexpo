-- Clubs book workflow contract
-- Narrow scope for the current Clubs feature slice:
-- 1) all club members can nominate books
-- 2) all club members can vote on active nominations
-- 3) only the club admin finalizes a nomination into current_book_id

ALTER TABLE public.book_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view nominations" ON public.book_nominations;
CREATE POLICY "Members can view nominations"
ON public.book_nominations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = book_nominations.club_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can nominate books" ON public.book_nominations;
CREATE POLICY "Members can nominate books"
ON public.book_nominations
FOR INSERT
WITH CHECK (
  auth.uid() = nominated_by
  AND EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = book_nominations.club_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can view votes" ON public.book_votes;
CREATE POLICY "Members can view votes"
ON public.book_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.book_nominations bn
    JOIN public.club_members cm ON cm.club_id = bn.club_id
    WHERE bn.id = book_votes.nomination_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can vote" ON public.book_votes;
CREATE POLICY "Members can vote"
ON public.book_votes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.book_nominations bn
    JOIN public.club_members cm ON cm.club_id = bn.club_id
    WHERE bn.id = book_votes.nomination_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can delete their vote" ON public.book_votes;
CREATE POLICY "Members can delete their vote"
ON public.book_votes
FOR DELETE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.nominate_club_book(
  p_club_id uuid,
  p_book_id uuid DEFAULT NULL,
  p_google_books_id text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_authors text[] DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_voting_ends_at timestamptz DEFAULT NULL
)
RETURNS public.book_nominations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  nomination_book public.books%ROWTYPE;
  existing_nomination public.book_nominations%ROWTYPE;
  created_nomination public.book_nominations%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = current_user_id
      AND cm.status IN ('active', 'muted')
  ) THEN
    RAISE EXCEPTION 'Only active club members can nominate books';
  END IF;

  IF p_book_id IS NOT NULL THEN
    SELECT * INTO nomination_book
    FROM public.books
    WHERE id = p_book_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Book not found';
    END IF;
  ELSE
    IF NULLIF(btrim(COALESCE(p_google_books_id, '')), '') IS NULL THEN
      RAISE EXCEPTION 'google_books_id is required when p_book_id is not provided';
    END IF;

    IF NULLIF(btrim(COALESCE(p_title, '')), '') IS NULL THEN
      RAISE EXCEPTION 'title is required when p_book_id is not provided';
    END IF;

    INSERT INTO public.books (google_books_id, title, authors, cover_url)
    VALUES (btrim(p_google_books_id), btrim(p_title), p_authors, NULLIF(btrim(COALESCE(p_cover_url, '')), ''))
    ON CONFLICT (google_books_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      authors = COALESCE(EXCLUDED.authors, public.books.authors),
      cover_url = COALESCE(EXCLUDED.cover_url, public.books.cover_url)
    RETURNING * INTO nomination_book;
  END IF;

  SELECT * INTO existing_nomination
  FROM public.book_nominations
  WHERE club_id = p_club_id
    AND book_id = nomination_book.id
    AND status = 'active'
  LIMIT 1;

  IF FOUND THEN
    RETURN existing_nomination;
  END IF;

  INSERT INTO public.book_nominations (club_id, book_id, nominated_by, status, voting_ends_at)
  VALUES (p_club_id, nomination_book.id, current_user_id, 'active', p_voting_ends_at)
  RETURNING * INTO created_nomination;

  RETURN created_nomination;
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_club_book_vote(
  p_nomination_id uuid
)
RETURNS public.book_votes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  nomination_record public.book_nominations%ROWTYPE;
  created_vote public.book_votes%ROWTYPE;
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

  IF nomination_record.status <> 'active' THEN
    RAISE EXCEPTION 'Only active nominations can be voted on';
  END IF;

  IF nomination_record.voting_ends_at IS NOT NULL AND nomination_record.voting_ends_at <= now() THEN
    RAISE EXCEPTION 'Voting has already closed for this nomination';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = nomination_record.club_id
      AND cm.user_id = current_user_id
      AND cm.status IN ('active', 'muted')
  ) THEN
    RAISE EXCEPTION 'Only active club members can vote';
  END IF;

  INSERT INTO public.book_votes (nomination_id, user_id)
  VALUES (p_nomination_id, current_user_id)
  ON CONFLICT (nomination_id, user_id) DO NOTHING
  RETURNING * INTO created_vote;

  IF created_vote.nomination_id IS NULL THEN
    SELECT * INTO created_vote
    FROM public.book_votes
    WHERE nomination_id = p_nomination_id
      AND user_id = current_user_id;
  END IF;

  RETURN created_vote;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_club_book_vote(
  p_nomination_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.book_votes
  WHERE nomination_id = p_nomination_id
    AND user_id = current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_club_book_nomination(
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
    RAISE EXCEPTION 'Only the club admin can finalize the current book';
  END IF;

  IF nomination_record.voting_ends_at IS NOT NULL AND nomination_record.voting_ends_at > now() THEN
    RAISE EXCEPTION 'Voting is still open for this nomination';
  END IF;

  IF nomination_record.status NOT IN ('active', 'selected') THEN
    RAISE EXCEPTION 'Only active nominations can be finalized';
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

GRANT EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_club_book_vote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_club_book_vote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_club_book_nomination(uuid) TO authenticated, service_role;