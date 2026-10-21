BEGIN;
-- Cleanup 2 orphan test notes that block FK (SOT: orphan_notes=2)
DELETE FROM public.reading_notes
WHERE user_book_id NOT IN (SELECT id FROM public.user_books);

-- Add FK with cascade to prevent future orphans when a book is removed
ALTER TABLE public.reading_notes
  ADD CONSTRAINT reading_notes_user_book_id_fkey
  FOREIGN KEY (user_book_id) REFERENCES public.user_books(id) ON DELETE CASCADE;

-- Add sensible checks for notes content and page_number (hardening)
ALTER TABLE public.reading_notes
  ADD CONSTRAINT reading_notes_content_not_empty CHECK (btrim(content) <> ''),
  ADD CONSTRAINT reading_notes_page_number_positive CHECK (page_number IS NULL OR page_number > 0);

COMMIT;
