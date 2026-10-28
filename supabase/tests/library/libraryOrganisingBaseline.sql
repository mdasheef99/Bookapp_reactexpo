-- Projected pre-migration catalog for SDD-11 Units E and F, from the 2026-10-23 read-only MCP checks of
-- project ahntbtktjjmvfosgkmgn (Postgres 17.6; latest live migration 20261022160000). Synthetic data only.
-- Mirrors Supabase's default table and function grants so the migrations' REVOKEs are really tested.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.books (id uuid PRIMARY KEY, page_count integer);
-- Live shape: user_id is NULLABLE; (id, user_id) is unique (user_books_id_owner_key).
CREATE TABLE public.user_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid REFERENCES public.books(id),
  reading_status text DEFAULT 'want_to_read',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_books_user_id_book_id_key UNIQUE (user_id, book_id),
  CONSTRAINT user_books_id_owner_key UNIQUE (id, user_id)
);
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own books" ON public.user_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add books to their library" ON public.user_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their books" ON public.user_books FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their books" ON public.user_books FOR DELETE USING (auth.uid() = user_id);
GRANT ALL ON public.user_books, public.books TO anon, authenticated, service_role;

-- Live reading_notes (2026-10-23): PK(id) only, NO unique (id, user_id) yet; both book FKs; owned-book policies;
-- column-limited grants (library_manual_note_privilege_revision_correction).
CREATE TABLE public.reading_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_book_id uuid NOT NULL REFERENCES public.user_books(id) ON DELETE CASCADE,
  content text NOT NULL,
  tag text,
  page_number integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  last_operation_id uuid,
  CONSTRAINT reading_notes_book_owner_fkey FOREIGN KEY (user_book_id, user_id)
    REFERENCES public.user_books(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT reading_notes_tag_check CHECK (tag IS NULL OR tag = ANY (ARRAY['quote','reflect','distill','apply','question']))
);
ALTER TABLE public.reading_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_note_select_owned_book ON public.reading_notes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_note_insert_owned_book ON public.reading_notes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_note_update_owned_book ON public.reading_notes FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_note_delete_owned_book ON public.reading_notes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.reading_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.reading_notes TO authenticated;
GRANT INSERT (id, user_id, user_book_id, content, tag, page_number) ON public.reading_notes TO authenticated;
GRANT UPDATE (content, tag, page_number, last_operation_id, updated_at) ON public.reading_notes TO authenticated;
GRANT ALL ON public.reading_notes TO service_role;

-- Existing revision trigger, present before organising migrations.
CREATE OR REPLACE FUNCTION public.library_manage_note_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $revision$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    NEW.last_operation_id := NULL;
    NEW.created_at := pg_catalog.statement_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.user_book_id IS DISTINCT FROM OLD.user_book_id THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
    END IF;
    NEW.version := OLD.version + 1;
    NEW.created_at := OLD.created_at;
    IF NEW.last_operation_id IS NOT DISTINCT FROM OLD.last_operation_id THEN
      NEW.last_operation_id := NULL;
    END IF;
  END IF;
  NEW.updated_at := pg_catalog.statement_timestamp();
  RETURN NEW;
END
$revision$;
-- The existing trigger keeps its identity/binding. Direct invocation is unnecessary.
REVOKE ALL ON FUNCTION public.library_manage_note_revision() FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER reading_notes_manage_revision BEFORE INSERT OR UPDATE
ON public.reading_notes FOR EACH ROW EXECUTE FUNCTION public.library_manage_note_revision();
