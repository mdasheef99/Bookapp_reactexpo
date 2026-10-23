-- SDD-11 Unit F: note collections (docs/user/library/SDD-11-organising.md §4.2, §4.3).
-- Owner approved the DESIGN direction 2026-10-23; this file is DRAFTED, NOT APPLIED. Applying it to the
-- shared Supabase project needs a separate owner approval and a fresh project / latest-migration /
-- clubs-and-marketplace tracker check first.
--
-- !! OWNER REVIEW FLAG — CHANGE TO AN EXISTING LIBRARY TABLE !!
-- Section 1 adds a NEW unique constraint UNIQUE (id, user_id) to public.reading_notes. It has none today
-- (id is already its primary key, so no existing row can violate it and no data changes). It is needed so
-- user_note_collection_items can reference a note together with its owner (composite foreign key, the
-- same-owner pattern user_book_reads uses). Building the index briefly takes a lock on reading_notes
-- (10 rows at the 2026-10-23 live check); lock_timeout below makes the migration fail fast instead of
-- queueing app writes behind it. Nothing else on reading_notes (columns, policies, grants, triggers) changes.
--
-- Lock note: ALTER TABLE ... ADD CONSTRAINT takes ACCESS EXCLUSIVE on reading_notes until this transaction commits;
-- lock_timeout bounds only the wait to acquire it. The whole file is one transaction (all or nothing).
-- The cap trigger supports READ COMMITTED transactions only (55000 otherwise): the advisory lock cannot refresh a
-- REPEATABLE READ snapshot, so the count could be stale. This is an addition to the SDD text.
--
-- Adds two owner-only tables: user_note_collections (named groups, max 25 per person, unique per person
-- ignoring case) and user_note_collection_items (which note is in which collection).

-- Fail fast instead of queueing app writes behind this migration on the shared project.
SET LOCAL lock_timeout = '5s';

-- 1. Owner key on reading_notes (the one change to an existing table) ---------------------------------
ALTER TABLE public.reading_notes ADD CONSTRAINT reading_notes_id_owner_key UNIQUE (id, user_id);

-- 2. Collections -------------------------------------------------------------------------------------
CREATE TABLE public.user_note_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One definition of a valid name: trimmed, 1-40 code points (the app counts [...name].length).
  CONSTRAINT user_note_collections_name_check CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 40),
  CONSTRAINT user_note_collections_id_owner_key UNIQUE (id, user_id)
);
-- The database decides what "the same name" means: unique per person ignoring case (23505 on a clash).
CREATE UNIQUE INDEX user_note_collections_user_name_key ON public.user_note_collections (user_id, lower(name));

-- 3. Collection items -----------------------------------------------------------------------------------
-- Only the composite foreign keys below: no single-column collection_id / note_id keys (embed ambiguity).
CREATE TABLE public.user_note_collection_items (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  collection_id uuid NOT NULL,
  note_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, note_id),
  CONSTRAINT user_note_collection_items_collection_owner_fkey FOREIGN KEY (collection_id, user_id)
    REFERENCES public.user_note_collections(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT user_note_collection_items_note_owner_fkey FOREIGN KEY (note_id, user_id)
    REFERENCES public.reading_notes(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE
);
CREATE INDEX user_note_collection_items_note_idx ON public.user_note_collection_items (note_id);
CREATE INDEX user_note_collection_items_user_idx ON public.user_note_collection_items (user_id);

-- 4. Trigger functions ----------------------------------------------------------------------------------
-- Every function is SET search_path = '' and has EXECUTE revoked from PUBLIC, anon and authenticated
-- (the project's default privileges grant EXECUTE on new functions to anon and authenticated).

-- 25-collection cap. The advisory lock is taken BEFORE the count so two concurrent first inserts by the
-- same user serialise (a row lock locks nothing when the user has no collections yet). SECURITY DEFINER so
-- the count sees every row of that user regardless of RLS. Pattern: 20260822234500_clubs_b02_creation_cap_race_fix.sql.
CREATE FUNCTION public.library_collection_cap_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $cap$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'library_collection_user_required' USING ERRCODE = '23502';
  END IF;
  -- The advisory lock serialises writers but cannot refresh a REPEATABLE READ / SERIALIZABLE snapshot, so the
  -- count could be stale there and the cap exceeded. Fail closed: only READ COMMITTED (the PostgREST default) is supported.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'library_collection_isolation_unsupported' USING ERRCODE = '55000';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('library-collection-cap:' || NEW.user_id::text, 0));
  IF (SELECT pg_catalog.count(*) FROM public.user_note_collections c WHERE c.user_id = NEW.user_id) >= 25 THEN
    RAISE EXCEPTION 'library_collection_limit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$cap$;

-- Entity table guard: server-owned timestamps; id, user_id and created_at never change.
CREATE FUNCTION public.library_collection_row_guard()
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
      RAISE EXCEPTION 'library_collection_immutable' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := pg_catalog.statement_timestamp();
  END IF;
  RETURN NEW;
END
$row$;

-- Link table guard: added_at is server-owned; an item is never updated (no UPDATE grant either).
CREATE FUNCTION public.library_collection_item_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $item$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.added_at := pg_catalog.statement_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'library_collection_item_immutable' USING ERRCODE = '23514';
END
$item$;

-- Trigger names sort so the cap guard runs before the row guard.
CREATE TRIGGER user_note_collections_a_cap BEFORE INSERT ON public.user_note_collections
  FOR EACH ROW EXECUTE FUNCTION public.library_collection_cap_guard();
CREATE TRIGGER user_note_collections_b_guard BEFORE INSERT OR UPDATE ON public.user_note_collections
  FOR EACH ROW EXECUTE FUNCTION public.library_collection_row_guard();
CREATE TRIGGER user_note_collection_items_guard BEFORE INSERT OR UPDATE ON public.user_note_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.library_collection_item_guard();

-- 5. Row level security -------------------------------------------------------------------------------------
ALTER TABLE public.user_note_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_note_collection_items ENABLE ROW LEVEL SECURITY;

-- (SELECT auth.uid()) form, not bare auth.uid(): avoids the auth_rls_initplan advisor finding.
CREATE POLICY library_collections_select_own ON public.user_note_collections
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_collections_insert_own ON public.user_note_collections
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_collections_update_own ON public.user_note_collections
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_collections_delete_own ON public.user_note_collections
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY library_collection_items_select_own ON public.user_note_collection_items
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_collection_items_insert_own ON public.user_note_collection_items
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_collection_items_delete_own ON public.user_note_collection_items
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- 6. Privileges ----------------------------------------------------------------------------------------------
-- Table grants override column revocations, so remove both layers before narrowing. anon gets nothing.
REVOKE ALL ON public.user_note_collections, public.user_note_collection_items FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, user_id, name, created_at, updated_at) ON public.user_note_collections FROM PUBLIC, anon, authenticated;
REVOKE ALL (user_id, collection_id, note_id, added_at) ON public.user_note_collection_items FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON public.user_note_collections TO authenticated;
GRANT INSERT (name), UPDATE (name) ON public.user_note_collections TO authenticated;
GRANT SELECT, DELETE ON public.user_note_collection_items TO authenticated;
GRANT INSERT (collection_id, note_id) ON public.user_note_collection_items TO authenticated;

REVOKE ALL ON FUNCTION public.library_collection_cap_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_collection_row_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_collection_item_guard() FROM PUBLIC, anon, authenticated;

-- 7. Postconditions ------------------------------------------------------------------------------------------
DO $postconditions$
DECLARE
  v_table text;
  v_function text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.reading_notes'::regclass AND conname = 'reading_notes_id_owner_key' AND contype = 'u') THEN
    RAISE EXCEPTION 'LIBRARY_COLLECTIONS_NOTE_OWNER_KEY_MISSING';
  END IF;
  FOREACH v_table IN ARRAY ARRAY['public.user_note_collections', 'public.user_note_collection_items'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = v_table::regclass) THEN
      RAISE EXCEPTION 'LIBRARY_COLLECTIONS_RLS_OFF %', v_table;
    END IF;
    IF has_table_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_table_privilege('public', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,REFERENCES')
      OR has_any_column_privilege('public', v_table, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'LIBRARY_COLLECTIONS_ANON_PRIVILEGES %', v_table;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.user_note_collections', 'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated', 'public.user_note_collection_items', 'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_column_privilege('authenticated', 'public.user_note_collections', 'user_id', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collections', 'id', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collections', 'created_at', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collections', 'updated_at', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collection_items', 'user_id', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collection_items', 'added_at', 'INSERT,UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collection_items', 'collection_id', 'UPDATE')
    OR has_column_privilege('authenticated', 'public.user_note_collection_items', 'note_id', 'UPDATE') THEN
    RAISE EXCEPTION 'LIBRARY_COLLECTIONS_PRIVILEGES_TOO_BROAD';
  END IF;
  -- A comma list is true when ANY privilege is held, so the required ones are checked one by one.
  IF NOT has_table_privilege('authenticated', 'public.user_note_collections', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.user_note_collections', 'DELETE')
    OR NOT has_table_privilege('authenticated', 'public.user_note_collection_items', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.user_note_collection_items', 'DELETE')
    OR NOT has_column_privilege('authenticated', 'public.user_note_collections', 'name', 'INSERT')
    OR NOT has_column_privilege('authenticated', 'public.user_note_collections', 'name', 'UPDATE')
    OR NOT has_column_privilege('authenticated', 'public.user_note_collection_items', 'collection_id', 'INSERT')
    OR NOT has_column_privilege('authenticated', 'public.user_note_collection_items', 'note_id', 'INSERT') THEN
    RAISE EXCEPTION 'LIBRARY_COLLECTIONS_PRIVILEGES_MISSING';
  END IF;
  FOREACH v_function IN ARRAY ARRAY['public.library_collection_cap_guard()', 'public.library_collection_row_guard()', 'public.library_collection_item_guard()'] LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('authenticated', v_function, 'EXECUTE')
      OR has_function_privilege('public', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'LIBRARY_COLLECTIONS_FUNCTION_EXECUTE_TOO_BROAD %', v_function;
    END IF;
  END LOOP;
END
$postconditions$;
