BEGIN;

-- SDD-03 Finding 2: DB-enforce 500w notes + 800w vault + word_count truth
-- Finding 4: vault ownership matches user_books.owner + Finding 6: no schema change for truncation (UI only)

-- 1) reading_notes 500w hard CHECK via RPC helper (immutable, search_path public)
-- Existing data: 2 notes are short (<500w) so safe to validate.
ALTER TABLE public.reading_notes
  ADD CONSTRAINT reading_notes_500w_check CHECK (public.check_note_word_limit(content));

-- 2) user_book_pages: enforce full_text 800w + word_count truth
-- word_count must equal actual word count of full_text and <=800
ALTER TABLE public.user_book_pages
  ADD CONSTRAINT user_book_pages_800w_check CHECK (public.check_page_word_limit(full_text)),
  ADD CONSTRAINT user_book_pages_word_count_match CHECK (
    word_count = COALESCE(array_length(regexp_split_to_array(btrim(full_text), '\s+'), 1), 0)
  );

-- Also enforce content_excerpt is prefix of full_text (or at least within) - already 800 char check, add sane check
-- (optional, keep simple)

-- 3) vault ownership: user_id must equal owner of user_book_id
CREATE OR REPLACE FUNCTION public.enforce_user_book_pages_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  book_owner uuid;
BEGIN
  SELECT user_id INTO book_owner FROM public.user_books WHERE id = NEW.user_book_id;
  IF book_owner IS NULL THEN
    RAISE EXCEPTION 'user_book_id % not found', NEW.user_book_id;
  END IF;
  IF NEW.user_id <> book_owner THEN
    RAISE EXCEPTION 'vault owner mismatch: user_book_pages.user_id % <> user_books.user_id %', NEW.user_id, book_owner;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_book_pages_owner ON public.user_book_pages;
CREATE TRIGGER trg_enforce_user_book_pages_owner
  BEFORE INSERT OR UPDATE OF user_id, user_book_id ON public.user_book_pages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_book_pages_owner();

-- 4) Ensure RPC helpers are immutable and grant (already granted but re-assert)
GRANT EXECUTE ON FUNCTION public.check_note_word_limit(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_page_word_limit(text) TO authenticated, anon;

COMMIT;
