-- WU-TC04 · clubs book-workflow write boundary + concurrency fix
-- ============================================================
-- LIVE-APPLIED under ledger version 20260912200746 on
-- project ahntbtktjjmvfosgkmgn. Previously drafted locally under the
-- older timestamp/stem; executable SQL below is unchanged.
--
-- Confirmed defects fixed (exactly four, bounded scope):
--   BWF-04 concurrent duplicate nomination 23505
--   BWF-01 direct vote INSERT bypass
--   BWF-02 direct nomination INSERT bypass (incl. status='selected')
--   BWF-03 direct book_clubs.current_book_id UPDATE bypass
--
-- Explicitly deferred (NOT fixed here): archived-club workflow,
-- dual-finalize last-writer-wins, vote DELETE semantics, banned/left
-- own-vote removal, muted-member semantics, transfer_club_admin legacy
-- path, generic TRUNCATE cleanup, unrelated RLS hardening, app-type
-- cleanup for unused current_book_id.
--
-- Forward-only. No historical migration edited.
-- No TRUNCATE hardening. No trigger bypass flags. No new RPC for
-- general club updates.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- A. nominate_club_book — concurrent-duplicate recovery
-- ----------------------------------------------------------------
-- Preserved exactly: signature, defaults, return type
-- (public.book_nominations), language (plpgsql), SECURITY DEFINER,
-- search_path=public, owner behavior (CREATE OR REPLACE preserves
-- owner), volatility (default VOLATILE, unchanged), EXECUTE ACL
-- (re-asserted below), authentication/membership errors, book
-- resolution (p_book_id lookup + Google Books upsert), sequential
-- duplicate semantics (SELECT ACTIVE first, zero-write return), and
-- notification behavior (single AFTER INSERT per new row; loser
-- INSERTs zero rows so fires zero notifications).
--
-- Only intentional change: conflict-safe INSERT + bounded recovery.
-- Unique invariant used (targeted, NOT bare ON CONFLICT DO NOTHING):
--   UNIQUE (club_id, book_id, status)
--   → ON CONFLICT (club_id, book_id, status) DO NOTHING
-- Loser never overwrites nominated_by / voting_ends_at (first-writer
-- wins, matching sequential duplicate behavior). No ON CONFLICT
-- DO UPDATE (would perform a write the old sequential contract did
-- not perform).
--
-- Recovery algorithm (bounded loop, max 5 attempts):
--   1. SELECT ACTIVE (club_id, book_id). If found → return (zero-write).
--   2. Attempt targeted conflict-safe INSERT ... ON CONFLICT
--      (club_id, book_id, status) DO NOTHING RETURNING *.
--      If a row returns → we won → return it (single notification).
--   3. Else we conflicted → loop to step 1 and re-evaluate.
--
-- Post-conflict disappearance handling:
--   Race T1 inserts ACTIVE, T2 conflicts, T1 commits, T3 transitions
--   ACTIVE → SELECTED (finalize / set_club_current_book_from_nomination),
--   then T2 recovers. A single fallback SELECT would find no ACTIVE
--   and (in naive implementations) return NULL or raise. Here T2 loops:
--   second SELECT misses ACTIVE, second INSERT creates a fresh ACTIVE
--   row (different status value, no conflict with SELECTED) and returns
--   it. Final state is coherent with legal sequential ordering
--   (nominate → select → nominate = 1 SELECTED + 1 ACTIVE).
--
-- Why a bound exists: each iteration is read-only unless it wins the
-- race; losers only re-read. Normal 2-caller duplicate needs ≤2
-- iterations (miss → conflict → hit). Disappearance edge needs ≤3
-- (miss → conflict → miss-after-select → insert). Bound 5 gives
-- headroom for spurious contention while preventing infinite livelock
-- under pathological scheduling.
--
-- What exhaustion means: after 5 iterations no ACTIVE row was found
-- and no INSERT won (continuous contention). The function raises a
-- retryable P0001 with no write performed by this call.
--
-- Why exhaustion cannot corrupt state: the loop performs at most one
-- INSERT that can succeed (the winner); all other iterations are
-- SELECTs or conflicted no-op INSERTs (zero rows, zero notifications).
-- Exhaustion raises BEFORE returning any row, inside the caller's
-- transaction, so the caller persists nothing from this call. A retry
-- re-executes the same safe evaluation. No partial nomination, no
-- duplicate ACTIVE, no swallowed SELECTED transition.
-- ----------------------------------------------------------------
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
  attempt integer := 0;
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

  -- Bounded conflict-recovery loop (see header comment for rationale).
  LOOP
    attempt := attempt + 1;

    SELECT * INTO existing_nomination
    FROM public.book_nominations
    WHERE club_id = p_club_id
      AND book_id = nomination_book.id
      AND status = 'active'
    LIMIT 1;

    IF FOUND THEN
      RETURN existing_nomination;
    END IF;

    IF attempt > 5 THEN
      RAISE EXCEPTION 'Could not resolve concurrent nomination, please retry';
    END IF;

    created_nomination := NULL;

    INSERT INTO public.book_nominations (club_id, book_id, nominated_by, status, voting_ends_at)
    VALUES (p_club_id, nomination_book.id, current_user_id, 'active', p_voting_ends_at)
    ON CONFLICT (club_id, book_id, status) DO NOTHING
    RETURNING * INTO created_nomination;

    IF created_nomination.id IS NOT NULL THEN
      RETURN created_nomination;
    END IF;

    -- Conflict: another transaction won the ACTIVE row, or the ACTIVE
    -- row disappeared (ACTIVE → SELECTED) between our SELECT and
    -- INSERT. Loop and re-evaluate; do not return NULL.
  END LOOP;
END;
$$;

-- Re-assert EXECUTE ACL (identity preserved; anon/PUBLIC stay revoked).
REVOKE EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) TO authenticated, service_role;

-- ----------------------------------------------------------------
-- B. book_votes INSERT becomes RPC-only
-- ----------------------------------------------------------------
-- Drop the direct-INSERT RLS policy. Keep SELECT + DELETE-own-vote.
-- Do NOT alter update_vote_count trigger. cast/remove RPCs unchanged.
DROP POLICY IF EXISTS "Members can vote" ON public.book_votes;

-- Revoke direct INSERT from ordinary client roles + PUBLIC (blocks
-- inheritance path). Preserve backend/owner capability explicitly.
REVOKE INSERT ON public.book_votes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_votes TO service_role;

-- ----------------------------------------------------------------
-- C. book_nominations INSERT becomes RPC-only
-- ----------------------------------------------------------------
-- Drop the direct-INSERT RLS policy. Keep SELECT + default-deny
-- UPDATE/DELETE. nominate RPC execution for authenticated preserved
-- (see section A grants). Notification trigger unchanged.
DROP POLICY IF EXISTS "Members can nominate books" ON public.book_nominations;

REVOKE INSERT ON public.book_nominations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_nominations TO service_role;

-- ----------------------------------------------------------------
-- D. book_clubs.current_book_id column boundary
-- ----------------------------------------------------------------
-- Goal: ordinary authenticated direct UPDATE of current_book_id →
-- DENIED (42501), while legitimate admin direct UPDATEs of every
-- other current column (description, name, cover_url, max_members,
-- access_level, meeting_type, club_type, archive fields, updated_at,
-- etc.) keep working subject to existing RLS
-- ("Admins can update their clubs" unchanged).
--
-- Procedure: revoke table-wide UPDATE from ordinary client roles
-- (+ PUBLIC/anon so no table-wide path defeats the column grant),
-- then re-grant column-level UPDATE on every CURRENT book_clubs
-- column EXCEPT current_book_id, derived dynamically from
-- information_schema so the boundary tracks the live shape. No
-- opportunistic redesign: every column except current_book_id keeps
-- its prior updateability; the ONLY intentional privilege semantic
-- difference is current_book_id.
--
-- The two selection RPCs (finalize_club_book_nomination,
-- set_club_current_book_from_nomination) are SECURITY DEFINER /
-- owner-executed and bypass client column grants, so they keep
-- writing current_book_id. No trigger bypass flags. No new RPC.
-- ----------------------------------------------------------------
REVOKE UPDATE ON public.book_clubs FROM PUBLIC, anon, authenticated;

-- Preserve backend capability explicitly (owner postgres always retains
-- via ownership; service_role needs an explicit table-wide grant).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_clubs TO service_role;

DO $$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO col_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'book_clubs'
    AND column_name <> 'current_book_id';

  IF col_list IS NULL OR col_list = '' THEN
    RAISE EXCEPTION 'TC04: no grantable book_clubs columns found';
  END IF;

  EXECUTE format('GRANT UPDATE (%s) ON public.book_clubs TO authenticated', col_list);
END
$$;

-- Existing RLS policy deliberately unchanged (row control stays):
--   "Admins can update their clubs" USING/WITH CHECK
--   (public.can_user_hold_club_role(auth.uid(), id, 'admin')).
-- RLS still decides WHICH rows an admin may touch; column grants
-- decide WHICH columns a direct UPDATE may write.

-- ----------------------------------------------------------------
-- E. NO TRUNCATE HARDENING (explicitly out of TC04 scope)
-- ----------------------------------------------------------------
-- Intentionally no REVOKE TRUNCATE / generic privilege cleanup here.

COMMIT;
