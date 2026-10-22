-- SDD-09 Unit 1: reading history (docs/user/library/SDD-09-reading-history.md §4.1, §4.2).
-- Owner-approved design 2026-10-22. Adds four owner-only tables, a recording trigger on
-- user_books (so every status writer, including the clubs RPC, is recorded), two RPCs and a
-- one-time back-fill. user_books columns, constraints, policies and status values are unchanged.
-- Known limit: a writer that changes only user_books.completed_at (not reading_status) is not
-- recorded; read dates are corrected through the Unit 2 edit sheet.
-- Invariant: every writer of user_book_reads locks the user_books row first (trigger and RPCs);
-- read_number allocation relies on it.

-- Fail fast instead of queueing app writes behind this migration on the shared project.
SET LOCAL lock_timeout = '5s';

-- 1. One row per read ------------------------------------------------------------------------
CREATE TABLE public.user_book_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_number integer NOT NULL CHECK (read_number > 0),
  outcome text NOT NULL CHECK (outcome IN ('reading','finished','did_not_finish')),
  started_at timestamptz,
  ended_at timestamptz,
  started_on date,
  ended_on date,
  start_unknown boolean NOT NULL DEFAULT false,
  end_unknown boolean NOT NULL DEFAULT false,
  total_pages integer CHECK (total_pages > 0),
  counts_in_stats boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_book_reads_book_owner_fkey FOREIGN KEY (user_book_id, user_id)
    REFERENCES public.user_books(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT user_book_reads_id_owner_key UNIQUE (id, user_id),
  CONSTRAINT user_book_reads_number_key UNIQUE (user_book_id, read_number),
  CONSTRAINT user_book_reads_open_has_no_end
    CHECK (outcome <> 'reading' OR (ended_at IS NULL AND ended_on IS NULL AND NOT end_unknown)),
  CONSTRAINT user_book_reads_instant_order
    CHECK (started_at IS NULL OR ended_at IS NULL OR started_at <= ended_at),
  CONSTRAINT user_book_reads_day_order
    CHECK (started_on IS NULL OR ended_on IS NULL OR started_on <= ended_on)
);
-- An "open read" is outcome = 'reading'; at most one per book.
CREATE UNIQUE INDEX user_book_reads_one_open ON public.user_book_reads (user_book_id) WHERE outcome = 'reading';
CREATE INDEX user_book_reads_user_idx ON public.user_book_reads (user_id);

-- 2. Progress entries (append-only) ----------------------------------------------------------
CREATE TABLE public.user_book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  read_id uuid NOT NULL,
  user_id uuid NOT NULL,
  page integer CHECK (page >= 0),
  percent smallint CHECK (percent BETWEEN 0 AND 100),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_book_progress_one_value CHECK ((page IS NULL) <> (percent IS NULL)),
  CONSTRAINT user_book_progress_read_owner_fkey FOREIGN KEY (read_id, user_id)
    REFERENCES public.user_book_reads(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE
);
CREATE INDEX user_book_progress_read_idx ON public.user_book_progress (read_id, recorded_at);
CREATE INDEX user_book_progress_user_idx ON public.user_book_progress (user_id);

-- 3. Yearly goal ------------------------------------------------------------------------------
CREATE TABLE public.user_reading_goals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  target_books smallint NOT NULL CHECK (target_books BETWEEN 1 AND 999),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year)
);

-- 4. Per-user settings (next read) ------------------------------------------------------------
CREATE TABLE public.user_reading_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  next_read_user_book_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reading_settings_next_read_fkey FOREIGN KEY (next_read_user_book_id, user_id)
    REFERENCES public.user_books(id, user_id) ON UPDATE RESTRICT ON DELETE SET NULL (next_read_user_book_id)
);
CREATE INDEX user_reading_settings_next_read_idx ON public.user_reading_settings (next_read_user_book_id);

-- 5. Row maintenance triggers ------------------------------------------------------------------
CREATE FUNCTION public.library_touch_reading_row()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $touch$
BEGIN
  NEW.updated_at := pg_catalog.statement_timestamp();
  RETURN NEW;
END
$touch$;

CREATE FUNCTION public.library_guard_read()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $guard$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.user_book_id IS DISTINCT FROM OLD.user_book_id
    OR NEW.read_number IS DISTINCT FROM OLD.read_number
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'LIBRARY_READ_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  -- Picked days may not be in the future (one day of slack for time zones ahead of UTC).
  IF NEW.started_on > current_date + 1 OR NEW.ended_on > current_date + 1 THEN
    RAISE EXCEPTION 'LIBRARY_READ_DATE_IN_FUTURE' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := pg_catalog.statement_timestamp();
  RETURN NEW;
END
$guard$;

CREATE TRIGGER user_book_reads_guard BEFORE UPDATE ON public.user_book_reads
  FOR EACH ROW EXECUTE FUNCTION public.library_guard_read();
CREATE TRIGGER user_reading_goals_touch BEFORE UPDATE ON public.user_reading_goals
  FOR EACH ROW EXECUTE FUNCTION public.library_touch_reading_row();
CREATE TRIGGER user_reading_settings_touch BEFORE UPDATE ON public.user_reading_settings
  FOR EACH ROW EXECUTE FUNCTION public.library_touch_reading_row();

-- 6. Back-fill existing statuses (SDD-09 §4.2, D09-03) -----------------------------------------
INSERT INTO public.user_book_reads (user_book_id, user_id, read_number, outcome, started_at, ended_at, total_pages)
SELECT ub.id, ub.user_id, 1,
       CASE ub.reading_status WHEN 'reading' THEN 'reading' ELSE 'finished' END,
       NULL,
       -- LEAST ignores NULL, so an unknown finish date must be kept unknown explicitly.
       CASE WHEN ub.reading_status = 'completed' AND ub.completed_at IS NOT NULL THEN LEAST(ub.completed_at, now()) END,
       CASE WHEN b.page_count > 0 THEN b.page_count END
FROM public.user_books ub
LEFT JOIN public.books b ON b.id = ub.book_id
WHERE ub.user_id IS NOT NULL AND ub.reading_status IN ('reading','completed');

-- 7. Recording trigger on user_books (SDD-09 §4.2) ---------------------------------------------
-- Records only; never reopens or deletes a read by itself (D09-05).
CREATE FUNCTION public.library_record_reading_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $record$
DECLARE
  v_new text := COALESCE(NEW.reading_status, 'want_to_read');
  v_old text;
  v_open public.user_book_reads%ROWTYPE;
  v_latest public.user_book_reads%ROWTYPE;
  v_end timestamptz;
  v_pages integer;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_old := COALESCE(OLD.reading_status, 'want_to_read');
    IF v_old = v_new THEN
      RETURN NULL;
    END IF;
  ELSIF v_new = 'want_to_read' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_open FROM public.user_book_reads
    WHERE user_book_id = NEW.id AND outcome = 'reading' FOR UPDATE;
  SELECT * INTO v_latest FROM public.user_book_reads
    WHERE user_book_id = NEW.id ORDER BY read_number DESC LIMIT 1 FOR UPDATE;

  -- End time per event: a finish uses completed_at only when this statement set it (or on
  -- insert), otherwise now(); never later than now(); unknown stays null on insert.
  IF TG_OP = 'INSERT' THEN
    v_end := NEW.completed_at;
  ELSIF NEW.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    v_end := NEW.completed_at;
  ELSE
    v_end := now();
  END IF;
  IF v_end IS NOT NULL THEN
    v_end := LEAST(v_end, now());
  END IF;

  IF v_new = 'reading' THEN
    IF v_open.id IS NULL THEN
      SELECT CASE WHEN b.page_count > 0 THEN b.page_count END INTO v_pages
        FROM public.books b WHERE b.id = NEW.book_id;
      INSERT INTO public.user_book_reads
        (user_book_id, user_id, read_number, outcome, started_at, total_pages, counts_in_stats)
      VALUES (NEW.id, NEW.user_id, COALESCE(v_latest.read_number, 0) + 1, 'reading', now(),
              v_pages, COALESCE(v_latest.counts_in_stats, true));
    END IF;
  ELSIF v_new = 'completed' THEN
    IF v_open.id IS NOT NULL THEN
      UPDATE public.user_book_reads
        SET outcome = 'finished', ended_at = GREATEST(started_at, v_end), ended_on = NULL, end_unknown = false
        WHERE id = v_open.id;
    ELSIF v_latest.id IS NULL THEN
      SELECT CASE WHEN b.page_count > 0 THEN b.page_count END INTO v_pages
        FROM public.books b WHERE b.id = NEW.book_id;
      INSERT INTO public.user_book_reads
        (user_book_id, user_id, read_number, outcome, ended_at, total_pages)
      VALUES (NEW.id, NEW.user_id, 1, 'finished', v_end, v_pages);
    ELSIF v_latest.outcome = 'did_not_finish' THEN
      UPDATE public.user_book_reads
        SET outcome = 'finished', ended_at = GREATEST(started_at, v_end), ended_on = NULL, end_unknown = false
        WHERE id = v_latest.id;
    END IF; -- latest already finished: a status restore, nothing to record
  ELSIF v_open.id IS NOT NULL THEN
    -- reading -> want_to_read: the read stops (D09-04)
    UPDATE public.user_book_reads
      SET outcome = 'did_not_finish', ended_at = GREATEST(started_at, now()), ended_on = NULL, end_unknown = false
      WHERE id = v_open.id;
  END IF;

  IF v_new IN ('reading','completed') THEN
    UPDATE public.user_reading_settings SET next_read_user_book_id = NULL
      WHERE user_id = NEW.user_id AND next_read_user_book_id = NEW.id;
  END IF;
  RETURN NULL;
END
$record$;

CREATE TRIGGER user_books_record_reading_history
  AFTER INSERT OR UPDATE OF reading_status ON public.user_books
  FOR EACH ROW EXECUTE FUNCTION public.library_record_reading_history();

-- 8. RPCs -------------------------------------------------------------------------------------
-- "Read again" / "Start reading" on a finished book: always a new read.
CREATE FUNCTION public.library_start_reread(p_user_book_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $reread$
DECLARE
  v_uid uuid := auth.uid();
  v_book public.user_books%ROWTYPE;
  v_latest public.user_book_reads%ROWTYPE;
  v_pages integer;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LIBRARY_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- Lock the book row first so this serializes with any status writer.
  SELECT * INTO v_book FROM public.user_books WHERE id = p_user_book_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LIBRARY_BOOK_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_book.reading_status = 'reading' OR EXISTS (SELECT 1 FROM public.user_book_reads WHERE user_book_id = p_user_book_id AND outcome = 'reading') THEN
    RAISE EXCEPTION 'LIBRARY_READ_ALREADY_OPEN' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_latest FROM public.user_book_reads
    WHERE user_book_id = p_user_book_id ORDER BY read_number DESC LIMIT 1;
  SELECT CASE WHEN b.page_count > 0 THEN b.page_count END INTO v_pages
    FROM public.books b WHERE b.id = v_book.book_id;
  INSERT INTO public.user_book_reads
    (user_book_id, user_id, read_number, outcome, started_at, total_pages, counts_in_stats)
  VALUES (p_user_book_id, v_uid, COALESCE(v_latest.read_number, 0) + 1, 'reading', now(),
          v_pages, COALESCE(v_latest.counts_in_stats, true))
  RETURNING id INTO v_id;
  -- The trigger now sees the open read and records nothing more.
  UPDATE public.user_books SET reading_status = 'reading', updated_at = now() WHERE id = p_user_book_id;
  RETURN v_id;
END
$reread$;

-- "Not finished yet": reopen the latest finished or stopped read by hand (D09-05).
CREATE FUNCTION public.library_reopen_read(p_read_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $reopen$
DECLARE
  v_uid uuid := auth.uid();
  v_book_id uuid;
  v_read public.user_book_reads%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LIBRARY_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT user_book_id INTO v_book_id FROM public.user_book_reads WHERE id = p_read_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LIBRARY_READ_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.user_books WHERE id = v_book_id AND user_id = v_uid FOR UPDATE;
  SELECT * INTO v_read FROM public.user_book_reads WHERE id = p_read_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.user_book_reads WHERE user_book_id = v_book_id AND outcome = 'reading') THEN
    RAISE EXCEPTION 'LIBRARY_READ_ALREADY_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_book_reads WHERE user_book_id = v_book_id AND read_number > v_read.read_number) THEN
    RAISE EXCEPTION 'LIBRARY_READ_NOT_LATEST' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.user_book_reads
    SET outcome = 'reading', ended_at = NULL, ended_on = NULL, end_unknown = false
    WHERE id = p_read_id;
  UPDATE public.user_books SET reading_status = 'reading', updated_at = now() WHERE id = v_book_id;
END
$reopen$;

-- 9. Row-level security -----------------------------------------------------------------------
ALTER TABLE public.user_book_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY library_reads_select_own ON public.user_book_reads
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_reads_update_own ON public.user_book_reads
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- An open read can't be removed, and a Finished book always keeps its latest read.
-- The "latest read" check reads user_book_reads itself, so it lives in a definer helper
-- (a policy that queries its own table recurses). The helper answers only for the caller's books.
CREATE FUNCTION public.library_read_is_kept(p_user_book_id uuid, p_read_number integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $kept$
  SELECT EXISTS (SELECT 1 FROM public.user_books b
                 WHERE b.id = p_user_book_id AND b.user_id = (SELECT auth.uid())
                   AND b.reading_status = 'completed')
     AND NOT EXISTS (SELECT 1 FROM public.user_book_reads later
                     WHERE later.user_book_id = p_user_book_id AND later.user_id = (SELECT auth.uid())
                       AND later.read_number > p_read_number)
$kept$;
CREATE POLICY library_reads_delete_own_closed ON public.user_book_reads
  FOR DELETE TO authenticated USING (
    user_id = (SELECT auth.uid())
    AND outcome <> 'reading'
    AND NOT public.library_read_is_kept(user_book_id, read_number));

CREATE POLICY library_progress_select_own ON public.user_book_progress
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY library_progress_insert_open_read ON public.user_book_progress
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_book_reads r
                WHERE r.id = user_book_progress.read_id AND r.user_id = (SELECT auth.uid()) AND r.outcome = 'reading'));
CREATE POLICY library_progress_delete_own ON public.user_book_progress
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY library_goals_own ON public.user_reading_goals
  FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY library_settings_own ON public.user_reading_settings
  FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- 10. Privileges ------------------------------------------------------------------------------
-- Table grants override column revocations, so remove both layers before narrowing.
REVOKE ALL ON public.user_book_reads, public.user_book_progress, public.user_reading_goals, public.user_reading_settings
  FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, user_book_id, user_id, read_number, outcome, started_at, ended_at, started_on, ended_on,
            start_unknown, end_unknown, total_pages, counts_in_stats, created_at, updated_at)
  ON public.user_book_reads FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, read_id, user_id, page, percent, recorded_at) ON public.user_book_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL (user_id, year, target_books, updated_at) ON public.user_reading_goals FROM PUBLIC, anon, authenticated;
REVOKE ALL (user_id, next_read_user_book_id, updated_at) ON public.user_reading_settings FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON public.user_book_reads TO authenticated;
GRANT UPDATE (started_on, ended_on, start_unknown, end_unknown, total_pages, counts_in_stats)
  ON public.user_book_reads TO authenticated;
GRANT SELECT, DELETE ON public.user_book_progress TO authenticated;
GRANT INSERT (read_id, user_id, page, percent) ON public.user_book_progress TO authenticated;
GRANT SELECT, DELETE ON public.user_reading_goals, public.user_reading_settings TO authenticated;
GRANT INSERT (user_id, year, target_books), UPDATE (target_books) ON public.user_reading_goals TO authenticated;
GRANT INSERT (user_id, next_read_user_book_id), UPDATE (next_read_user_book_id)
  ON public.user_reading_settings TO authenticated;

REVOKE ALL ON FUNCTION public.library_touch_reading_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_guard_read() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_record_reading_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_start_reread(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_reopen_read(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_read_is_kept(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_start_reread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_reopen_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_read_is_kept(uuid, integer) TO authenticated; -- needed by the delete policy

-- 11. Postconditions --------------------------------------------------------------------------
DO $postconditions$
DECLARE
  v_expected integer;
  v_actual integer;
BEGIN
  SELECT count(*) INTO v_expected FROM public.user_books
    WHERE user_id IS NOT NULL AND reading_status IN ('reading','completed');
  SELECT count(*) INTO v_actual FROM public.user_book_reads;
  IF v_actual <> v_expected THEN
    RAISE EXCEPTION 'LIBRARY_HISTORY_BACKFILL_MISMATCH expected % got %', v_expected, v_actual;
  END IF;
  IF has_table_privilege('anon', 'public.user_book_reads', 'SELECT')
    OR has_column_privilege('authenticated', 'public.user_book_reads', 'outcome', 'UPDATE')
    OR has_function_privilege('anon', 'public.library_start_reread(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'LIBRARY_HISTORY_PRIVILEGES_TOO_BROAD';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.user_book_reads', 'ended_on', 'UPDATE')
    OR NOT has_function_privilege('authenticated', 'public.library_reopen_read(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.library_read_is_kept(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'LIBRARY_HISTORY_PRIVILEGES_MISSING';
  END IF;
END
$postconditions$;
