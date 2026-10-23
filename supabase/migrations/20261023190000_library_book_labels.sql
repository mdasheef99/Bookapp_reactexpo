-- SDD-11 Unit E: labels for books (docs/user/library/SDD-11-organising.md §4.1, §4.3).
-- Owner approved the DESIGN direction 2026-10-23; this file is DRAFTED, NOT APPLIED. Applying it to the
-- shared Supabase project needs a separate owner approval and a fresh project / latest-migration /
-- clubs-and-marketplace tracker check first.
-- Adds two owner-only tables: user_library_labels (named labels, max 25 per person, unique per person
-- ignoring case) and user_book_labels (which book has which label). No existing table is changed.
-- The cap triggers support READ COMMITTED transactions only (they raise 55000 otherwise): the advisory lock
-- cannot refresh a REPEATABLE READ snapshot, so the count could be stale. This is an addition to the SDD text.
-- Same-owner rule is enforced with composite foreign keys only (the pattern user_book_reads uses), so a
-- PostgREST embed has exactly one path and a row can only link a book and a label of the same user.

-- Fail fast instead of queueing app writes behind this migration on the shared project.
SET LOCAL lock_timeout = '5s';

-- 1. Labels -------------------------------------------------------------------------------------
CREATE TABLE public.user_library_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One definition of a valid name: trimmed, 1-24 code points (the app counts [...name].length).
  CONSTRAINT user_library_labels_name_check CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 24),
  CONSTRAINT user_library_labels_id_owner_key UNIQUE (id, user_id)
);
-- The database decides what "the same name" means: unique per person ignoring case (23505 on a clash).
CREATE UNIQUE INDEX user_library_labels_user_name_key ON public.user_library_labels (user_id, lower(name));

-- 2. Book <-> label links -------------------------------------------------------------------------
-- Only the composite foreign keys below: no single-column user_book_id / label_id keys (embed ambiguity).
CREATE TABLE public.user_book_labels (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_book_id uuid NOT NULL,
  label_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_book_id, label_id),
  CONSTRAINT user_book_labels_book_owner_fkey FOREIGN KEY (user_book_id, user_id)
    REFERENCES public.user_books(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT user_book_labels_label_owner_fkey FOREIGN KEY (label_id, user_id)
    REFERENCES public.user_library_labels(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE
);
CREATE INDEX user_book_labels_label_idx ON public.user_book_labels (label_id);
CREATE INDEX user_book_labels_user_idx ON public.user_book_labels (user_id);

-- 3. Trigger functions ----------------------------------------------------------------------------
-- Every function is SET search_path = '' and has EXECUTE revoked from PUBLIC, anon and authenticated
-- (the project's default privileges grant EXECUTE on new functions to anon and authenticated).

-- 25-label cap. The advisory lock is taken BEFORE the count so two concurrent first inserts by the same
-- user serialise (a row lock locks nothing when the user has no labels yet). SECURITY DEFINER so the
-- count sees every row of that user regardless of RLS. Pattern: 20260822234500_clubs_b02_creation_cap_race_fix.sql.
CREATE FUNCTION public.library_label_cap_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $cap$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'library_label_user_required' USING ERRCODE = '23502';
  END IF;
  -- The advisory lock serialises writers but cannot refresh a REPEATABLE READ / SERIALIZABLE snapshot, so the
  -- count could be stale there and the cap exceeded. Fail closed: only READ COMMITTED (the PostgREST default) is supported.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'library_label_isolation_unsupported' USING ERRCODE = '55000';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('library-label-cap:' || NEW.user_id::text, 0));
  IF (SELECT pg_catalog.count(*) FROM public.user_library_labels l WHERE l.user_id = NEW.user_id) >= 25 THEN
    RAISE EXCEPTION 'library_label_limit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$cap$;

-- Entity table guard: server-owned timestamps; id, user_id and created_at never change.
CREATE FUNCTION public.library_label_row_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $row$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := pg_catalog.statement_timestamp();
    NEW.updated_at := pg_catalog.statement_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'library_label_immutable' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := pg_catalog.statement_timestamp();
  END IF;
  RETURN NEW;
END
$row$;

-- Link table guard: created_at is server-owned; a link is never updated (no UPDATE grant either).
CREATE FUNCTION public.library_label_link_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $link$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := pg_catalog.statement_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'library_label_link_immutable' USING ERRCODE = '23514';
END
$link$;

-- Trigger names sort so the cap guard runs before the row guard.
CREATE TRIGGER user_library_labels_a_cap BEFORE INSERT ON public.user_library_labels
  FOR EACH ROW EXECUTE FUNCTION public.library_label_cap_guard();
CREATE TRIGGER user_library_labels_b_guard BEFORE INSERT OR UPDATE ON public.user_library_labels
  FOR EACH ROW EXECUTE FUNCTION public.library_label_row_guard();
CREATE TRIGGER user_book_labels_guard BEFORE INSERT OR UPDATE ON public.user_book_labels
  FOR EACH ROW EXECUTE FUNCTION public.library_label_link_guard();

-- 4. Row level security -----------------------------------------------------------------------------
ALTER TABLE public.user_library_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_book_labels ENABLE ROW LEVEL SECURITY;

-- (SELECT auth.uid()) form, not bare auth.uid(): avoids the auth_rls_initplan advisor finding.
CREATE POLICY library_labels_select_own ON public.user_library_labels
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_labels_insert_own ON public.user_library_labels
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_labels_update_own ON public.user_library_labels
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_labels_delete_own ON public.user_library_labels
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY library_book_labels_select_own ON public.user_book_labels
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_book_labels_insert_own ON public.user_book_labels
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_book_labels_delete_own ON public.user_book_labels
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- 5. Privileges ---------------------------------------------------------------------------------------
-- Table grants override column revocations, so remove both layers before narrowing. anon gets nothing.
REVOKE ALL ON public.user_library_labels, public.user_book_labels FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, user_id, name, created_at, updated_at) ON public.user_library_labels FROM PUBLIC, anon, authenticated;
REVOKE ALL (user_id, user_book_id, label_id, created_at) ON public.user_book_labels FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON public.user_library_labels TO authenticated;
GRANT INSERT (name), UPDATE (name) ON public.user_library_labels TO authenticated;
GRANT SELECT, DELETE ON public.user_book_labels TO authenticated;
GRANT INSERT (user_book_id, label_id) ON public.user_book_labels TO authenticated;

REVOKE ALL ON FUNCTION public.library_label_cap_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_label_row_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_label_link_guard() FROM PUBLIC, anon, authenticated;

-- 6. Postconditions -----------------------------------------------------------------------------------
DO $postconditions$
DECLARE
  v_table text;
  v_function text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['public.user_library_labels', 'public.user_book_labels'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = v_table::regclass) THEN
      RAISE EXCEPTION 'LIBRARY_LABELS_RLS_OFF %', v_table;
    END IF;
    IF has_table_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_table_privilege('public', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,REFERENCES')
      OR has_any_column_privilege('public', v_table, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'LIBRARY_LABELS_ANON_PRIVILEGES %', v_table;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.user_library_labels', 'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated', 'public.user_book_labels', 'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_column_privilege('authenticated', 'public.user_library_labels', 'user_id', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_library_labels', 'id', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_library_labels', 'created_at', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_library_labels', 'updated_at', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_book_labels', 'user_id', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_book_labels', 'created_at', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_book_labels', 'user_book_id', 'UPDATE')
    OR has_column_privilege('authenticated', 'public.user_book_labels', 'label_id', 'UPDATE') THEN
    RAISE EXCEPTION 'LIBRARY_LABELS_PRIVILEGES_TOO_BROAD';
  END IF;
  -- A comma list is true when ANY privilege is held, so the required ones are checked one by one.
  IF NOT has_table_privilege('authenticated', 'public.user_library_labels', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.user_library_labels', 'DELETE')
    OR NOT has_table_privilege('authenticated', 'public.user_book_labels', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.user_book_labels', 'DELETE')
    OR NOT has_column_privilege('authenticated', 'public.user_library_labels', 'name', 'INSERT')
    OR NOT has_column_privilege('authenticated', 'public.user_library_labels', 'name', 'UPDATE')
    OR NOT has_column_privilege('authenticated', 'public.user_book_labels', 'user_book_id', 'INSERT')
    OR NOT has_column_privilege('authenticated', 'public.user_book_labels', 'label_id', 'INSERT') THEN
    RAISE EXCEPTION 'LIBRARY_LABELS_PRIVILEGES_MISSING';
  END IF;
  FOREACH v_function IN ARRAY ARRAY['public.library_label_cap_guard()', 'public.library_label_row_guard()', 'public.library_label_link_guard()'] LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('authenticated', v_function, 'EXECUTE')
      OR has_function_privilege('public', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'LIBRARY_LABELS_FUNCTION_EXECUTE_TOO_BROAD %', v_function;
    END IF;
  END LOOP;
END
$postconditions$;
