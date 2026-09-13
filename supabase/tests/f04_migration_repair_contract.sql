-- ============================================================================
-- CLUB-WU-L01-A · F04 migration-boundary repair contract — POST-MIGRATION
-- assertions. Runs AFTER f04_fixture.sql, f04_pre_migration_duplicate_seed.sql,
-- and the ACTUAL repository migration
-- 20260824100000_clubs_f04_reaction_single_reaction_invariant.sql.
--
-- Asserts what THE MIGRATION ITSELF did to the seeded legacy duplicate group
-- (actor 33333333-3333-4333-8333-333333333333 on topic aaaaaaaa-…-0003):
--   1. deterministically deleted the duplicate losers;
--   2. retained the expected newest winner (created_at DESC ordering);
--   3. preserved the winner's values (emoji, created_at, ids untouched);
--   4. left exactly one reaction for that actor/target;
--   5. created both partial UNIQUE indexes and enforces them immediately.
-- This file contains NO repair SQL: every observed effect is attributable to
-- the migration under test.
-- ============================================================================
\set ON_ERROR_STOP on

DO $$
DECLARE
    n integer;
    emoj text;
    cat timestamptz;
    rid uuid;
    v_unique boolean;
    v_partial boolean;
BEGIN
    -- ---- 1+4: exactly one reaction survives for the seeded actor/target ----
    SELECT count(*) INTO n
    FROM club_discussion_reactions
    WHERE topic_id = 'aaaaaaaa-0000-4000-8000-000000000003'::uuid
      AND user_id  = '33333333-3333-4333-8333-333333333333'::uuid;
    IF n <> 1 THEN
        RAISE EXCEPTION 'REPAIR FAIL: expected exactly 1 surviving row after migration repair, found %', n;
    END IF;

    SELECT emoji, created_at, id INTO emoj, cat, rid
    FROM club_discussion_reactions
    WHERE topic_id = 'aaaaaaaa-0000-4000-8000-000000000003'::uuid
      AND user_id  = '33333333-3333-4333-8333-333333333333'::uuid;

    -- ---- 2: the newest row won (❤️ @ 2026-08-26T12:00:00Z) ----
    IF emoj IS DISTINCT FROM '❤️' THEN
        RAISE EXCEPTION 'REPAIR FAIL: survivor=% (expected ❤️ newest-wins)', emoj;
    END IF;
    IF rid IS DISTINCT FROM 'cccccccc-0000-4000-8000-000000000002'::uuid THEN
        RAISE EXCEPTION 'REPAIR FAIL: survivor id=% (expected cccccc…0002)', rid;
    END IF;

    -- ---- 3: winner's values preserved unmodified by the migration ----
    IF cat IS DISTINCT FROM '2026-08-26T12:00:00+00:00'::timestamptz THEN
        RAISE EXCEPTION 'REPAIR FAIL: winner created_at mutated (% expected 2026-08-26T12:00:00Z)', cat;
    END IF;

    -- ---- 1: losers deterministically deleted by exact id ----
    IF EXISTS (
        SELECT 1 FROM club_discussion_reactions
        WHERE id IN ('cccccccc-0000-4000-8000-000000000001'::uuid,
                     'cccccccc-0000-4000-8000-000000000003'::uuid)
    ) THEN
        RAISE EXCEPTION 'REPAIR FAIL: duplicate loser rows survived the migration';
    END IF;

    -- ---- 5a: both partial UNIQUE indexes exist and are enforcing ----
    SELECT i.indisunique, i.indpred IS NOT NULL INTO v_unique, v_partial
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = tc.relnamespace
    WHERE ic.relname = 'club_discussion_reactions_topic_user_unique'
      AND tc.relname = 'club_discussion_reactions'
      AND ns.nspname = 'public';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVARIANT FAIL: club_discussion_reactions_topic_user_unique was not created';
    END IF;
    IF NOT v_unique OR NOT v_partial THEN
        RAISE EXCEPTION 'INVARIANT FAIL: topic index not UNIQUE-partial (unique=% partial=%)', v_unique, v_partial;
    END IF;

    SELECT i.indisunique, i.indpred IS NOT NULL INTO v_unique, v_partial
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = tc.relnamespace
    WHERE ic.relname = 'club_discussion_reactions_reply_user_unique'
      AND tc.relname = 'club_discussion_reactions'
      AND ns.nspname = 'public';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVARIANT FAIL: club_discussion_reactions_reply_user_unique was not created';
    END IF;
    IF NOT v_unique OR NOT v_partial THEN
        RAISE EXCEPTION 'INVARIANT FAIL: reply index not UNIQUE-partial (unique=% partial=%)', v_unique, v_partial;
    END IF;

    -- ---- 5b: the new invariant bites immediately (post-migration state) ----
    BEGIN
        INSERT INTO club_discussion_reactions (topic_id, reply_id, user_id, emoji)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, NULL,
                '33333333-3333-4333-8333-333333333333'::uuid, '📚');
        RAISE EXCEPTION 'INVARIANT FAIL: post-migration duplicate INSERT accepted by the database';
    EXCEPTION WHEN unique_violation THEN
        NULL; -- expected: actor/target uniqueness enforced from migration onward
    END;
END $$;

\echo 'F04_MIGRATION_REPAIR_CONTRACT_PASSED'
