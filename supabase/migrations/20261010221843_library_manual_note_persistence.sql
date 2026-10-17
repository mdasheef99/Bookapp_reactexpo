-- SDD-06 manual notes: category storage, server revision metadata and owned-book writes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

LOCK TABLE public.user_books, public.reading_notes IN ACCESS EXCLUSIVE MODE;

DO $preconditions$
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_REQUIRES_POSTGRES_17_OR_LATER';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='public.reading_notes'::regclass
      AND attname IN ('version','last_operation_id') AND NOT attisdropped
  ) OR pg_catalog.to_regprocedure('public.library_manage_note_revision()') IS NOT NULL THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_REQUIRES_UNMIGRATED_BASELINE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='public.reading_notes'::regclass AND attname='tag'
      AND attnotnull AND atttypid='text'::regtype AND NOT attisdropped
  ) OR (
    SELECT count(*) FROM pg_catalog.pg_constraint
    WHERE conrelid='public.reading_notes'::regclass
  ) <> 7 OR pg_catalog.to_regprocedure('public.check_note_word_limit(text)') IS NULL THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_BASELINE_CONSTRAINTS_CHANGED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('reading_notes_pkey','PRIMARY KEY (id)'),
      ('reading_notes_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
      ('reading_notes_user_book_id_fkey','FOREIGN KEY (user_book_id) REFERENCES user_books(id) ON DELETE CASCADE'),
      ('reading_notes_tag_check',$$CHECK ((tag = ANY (ARRAY['quote'::text, 'reflect'::text, 'distill'::text, 'apply'::text])))$$),
      ('reading_notes_content_not_empty',$$CHECK ((btrim(content) <> ''::text))$$),
      ('reading_notes_page_number_positive','CHECK (((page_number IS NULL) OR (page_number > 0)))'),
      ('reading_notes_500w_check','CHECK (check_note_word_limit(content))')
    ) expected(name,definition)
    LEFT JOIN pg_catalog.pg_constraint actual
      ON actual.conrelid='public.reading_notes'::regclass AND actual.conname=expected.name
    WHERE actual.oid IS NULL OR NOT actual.convalidated
      OR pg_catalog.pg_get_constraintdef(actual.oid) IS DISTINCT FROM expected.definition
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_BASELINE_CONSTRAINTS_CHANGED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE p.oid=pg_catalog.to_regprocedure('public.check_note_word_limit(text)')
      AND p.prokind='f' AND l.lanname='sql'
      AND p.prorettype='boolean'::regtype AND NOT p.proretset
      AND p.pronargs=1 AND p.pronargdefaults=0 AND p.provariadic=0
      AND p.proargnames IS NOT DISTINCT FROM ARRAY['p_content']
      AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
      AND p.provolatile='i' AND p.proparallel='u'
      AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
      AND p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=public']
      AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      AND pg_catalog.btrim(p.prosrc,E' \t\r\n') =
        $$SELECT COALESCE(array_length(regexp_split_to_array(btrim(COALESCE(p_content,'')), '\s+'), 1), 0) <= 500$$
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_BASELINE_WORD_HELPER_CHANGED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='public.reading_notes'::regclass AND NOT tgisinternal
  ) OR (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid='public.reading_notes'::regclass) <> 4
  OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.reading_notes'::regclass)
  OR (SELECT count(*) FROM pg_catalog.pg_policy
    WHERE polrelid='public.reading_notes'::regclass AND polpermissive
      AND polname IN ('Users can view own notes','Users can insert own notes',
        'Users can update own notes','Users can delete own notes')) <> 4 THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_BASELINE_SECURITY_CHANGED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('Users can view own notes','r','(auth.uid() = user_id)',NULL),
      ('Users can insert own notes','a',NULL,'(auth.uid() = user_id)'),
      ('Users can update own notes','w','(auth.uid() = user_id)',NULL),
      ('Users can delete own notes','d','(auth.uid() = user_id)',NULL)
    ) expected(name,command,using_expression,check_expression)
    LEFT JOIN pg_catalog.pg_policy actual
      ON actual.polrelid='public.reading_notes'::regclass AND actual.polname=expected.name
    WHERE actual.oid IS NULL OR NOT actual.polpermissive
      OR actual.polcmd::text IS DISTINCT FROM expected.command
      OR actual.polroles IS DISTINCT FROM ARRAY[0::oid]
      OR pg_catalog.pg_get_expr(actual.polqual,actual.polrelid) IS DISTINCT FROM expected.using_expression
      OR pg_catalog.pg_get_expr(actual.polwithcheck,actual.polrelid) IS DISTINCT FROM expected.check_expression
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_BASELINE_SECURITY_CHANGED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reading_notes n LEFT JOIN public.user_books b ON b.id=n.user_book_id
    WHERE b.id IS NULL OR n.user_id IS DISTINCT FROM b.user_id
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_OWNER_PRECONDITION' USING ERRCODE='23514';
  END IF;
END
$preconditions$;

ALTER TABLE public.reading_notes
  ALTER COLUMN tag DROP NOT NULL,
  DROP CONSTRAINT reading_notes_tag_check,
  ADD CONSTRAINT reading_notes_tag_check
    CHECK (tag IS NULL OR tag IN ('quote','reflect','distill','apply','question')),
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN last_operation_id uuid,
  ADD CONSTRAINT reading_notes_version_positive CHECK (version > 0);

ALTER TABLE public.user_books
  ADD CONSTRAINT user_books_id_owner_key UNIQUE(id,user_id);
ALTER TABLE public.reading_notes
  ADD CONSTRAINT reading_notes_book_owner_fkey
    FOREIGN KEY(user_book_id,user_id) REFERENCES public.user_books(id,user_id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE FUNCTION public.library_manage_note_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $revision$
DECLARE
  v_expected record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    NEW.last_operation_id := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
    IF NEW.last_operation_id IS NOT DISTINCT FROM OLD.last_operation_id THEN
      NEW.last_operation_id := NULL;
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.user_book_id IS DISTINCT FROM OLD.user_book_id THEN
      RAISE EXCEPTION 'LIBRARY_NOTES_IDENTITY_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END
$revision$;

CREATE TRIGGER reading_notes_manage_revision
  BEFORE INSERT OR UPDATE ON public.reading_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.library_manage_note_revision();

DROP POLICY IF EXISTS "Users can view own notes" ON public.reading_notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.reading_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.reading_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.reading_notes;

CREATE POLICY "Users can view own notes" ON public.reading_notes
  FOR SELECT USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id = reading_notes.user_book_id AND b.user_id = auth.uid()));
CREATE POLICY "Users can insert own notes" ON public.reading_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id = reading_notes.user_book_id AND b.user_id = auth.uid()));
CREATE POLICY "Users can update own notes" ON public.reading_notes
  FOR UPDATE USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id = reading_notes.user_book_id AND b.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id = reading_notes.user_book_id AND b.user_id = auth.uid()));
CREATE POLICY "Users can delete own notes" ON public.reading_notes
  FOR DELETE USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id = reading_notes.user_book_id AND b.user_id = auth.uid()));

REVOKE ALL ON public.reading_notes FROM anon;
REVOKE ALL ON public.reading_notes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_notes TO authenticated;

DO $guards$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.proname='library_manage_note_revision' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_REVISION_MUST_BE_SECURITY_INVOKER';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.reading_notes'::regclass AND attname IN ('version','last_operation_id') AND NOT attisdropped
  ) = false THEN
    RAISE EXCEPTION 'LIBRARY_NOTES_COLUMNS_MISSING';
  END IF;
END
$guards$;

COMMIT;