BEGIN;

-- SDD-03: user_book_pages private vault (800 char excerpt / 4000 char full_text / 800 word cap)
-- Inherits private ownership from SDD-02 reading_notes: RLS auth.uid()=user_id, FK CASCADE, orphan 0 invariant
CREATE TABLE IF NOT EXISTS public.user_book_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_book_id uuid NOT NULL REFERENCES public.user_books(id) ON DELETE CASCADE,
    page_number integer NOT NULL CHECK (page_number > 0),
    content_excerpt text NOT NULL CHECK (char_length(content_excerpt) <= 800),
    full_text text NOT NULL CHECK (char_length(full_text) <= 4000),
    word_count integer NOT NULL CHECK (word_count >= 0 AND word_count <= 800),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_book_pages_unique_page UNIQUE (user_book_id, page_number),
    CONSTRAINT user_book_pages_excerpt_not_empty CHECK (btrim(content_excerpt) <> ''),
    CONSTRAINT user_book_pages_full_not_empty CHECK (btrim(full_text) <> '')
);

CREATE INDEX IF NOT EXISTS idx_user_book_pages_user_id ON public.user_book_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_book_pages_user_book_id ON public.user_book_pages(user_book_id);
CREATE INDEX IF NOT EXISTS idx_user_book_pages_book_page ON public.user_book_pages(user_book_id, page_number);

ALTER TABLE public.user_book_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pages" ON public.user_book_pages;
CREATE POLICY "Users can view own pages" ON public.user_book_pages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pages" ON public.user_book_pages;
CREATE POLICY "Users can insert own pages" ON public.user_book_pages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pages" ON public.user_book_pages;
CREATE POLICY "Users can update own pages" ON public.user_book_pages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pages" ON public.user_book_pages;
CREATE POLICY "Users can delete own pages" ON public.user_book_pages FOR DELETE USING (auth.uid() = user_id);

-- RPC: note 500w cap (SOT: notesService.createNote must stay <=500 words)
CREATE OR REPLACE FUNCTION public.check_note_word_limit(p_content text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_length(regexp_split_to_array(btrim(COALESCE(p_content,'')), '\s+'), 1), 0) <= 500
$$;

-- RPC: vault full_text word cap (800 margin over 500w OCR)
CREATE OR REPLACE FUNCTION public.check_page_word_limit(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_length(regexp_split_to_array(btrim(COALESCE(p_text,'')), '\s+'), 1), 0) <= 800
$$;

GRANT EXECUTE ON FUNCTION public.check_note_word_limit(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_page_word_limit(text) TO authenticated, anon;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_user_book_pages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_book_pages_updated_at ON public.user_book_pages;
CREATE TRIGGER trg_user_book_pages_updated_at
  BEFORE UPDATE ON public.user_book_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_user_book_pages_updated_at();

COMMIT;
