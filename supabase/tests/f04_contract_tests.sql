-- CLUB-WU-F04 L4 contract tests (runs AFTER fixture + F04 migration).
-- Every failing assertion raises; script exit code reflects pass/fail via ON_ERROR_STOP.
\set ON_ERROR_STOP on

-- ============ CASE 1: none → A (topic) ============
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$
DECLARE r record;
BEGIN
    SELECT * INTO r FROM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '❤️');
    IF (SELECT count(*) FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111') <> 1 THEN
        RAISE EXCEPTION 'CASE1 FAIL: expected exactly 1 row';
    END IF;
    IF r.emoji <> '❤️' THEN RAISE EXCEPTION 'CASE1 FAIL: wrong emoji'; END IF;
END $$;

-- ============ CASE 2: A → A idempotent, created_at preserved ============
DO $$
DECLARE r1 timestamptz; r2 timestamptz;
BEGIN
    SELECT created_at INTO r1 FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111';
    PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '❤️');
    SELECT created_at INTO r2 FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111';
    IF r1 <> r2 THEN RAISE EXCEPTION 'CASE2 FAIL: created_at changed on idempotent set'; END IF;
    IF (SELECT count(*) FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111') <> 1 THEN
        RAISE EXCEPTION 'CASE2 FAIL: duplicate rows after idempotent set';
    END IF;
END $$;

-- ============ CASE 3: A → B replacement (❤️ → 😂) ============
DO $$
DECLARE r record;
BEGIN
    SELECT * INTO r FROM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '😂');
    IF r.emoji <> '😂' THEN RAISE EXCEPTION 'CASE3 FAIL: emoji not replaced'; END IF;
    IF (SELECT count(*) FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111') <> 1 THEN
        RAISE EXCEPTION 'CASE3 FAIL: A+B coexistence';
    END IF;
    IF (SELECT count(*) FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111' AND emoji='❤️') <> 0 THEN
        RAISE EXCEPTION 'CASE3 FAIL: old ❤️ still present';
    END IF;
END $$;

-- ============ CASE 4: remove → zero rows ============
DO $$
BEGIN
    PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000002'::uuid, NULL, '🔥');
    DELETE FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000002'::uuid AND user_id='11111111-1111-4111-8111-111111111111' AND emoji='🔥';
    IF (SELECT count(*) FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000002'::uuid AND user_id='11111111-1111-4111-8111-111111111111') <> 0 THEN
        RAISE EXCEPTION 'CASE4 FAIL: rows remain after removal';
    END IF;
END $$;

-- ============ CASE 5: direct A+B INSERT structurally rejected by invariant ============
DO $$
BEGIN
    BEGIN
        -- user2 already has no reaction on topic1 here; create one then force a second distinct emoji directly
        INSERT INTO club_discussion_reactions (topic_id, reply_id, user_id, emoji)
        VALUES ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, NULL, '22222222-2222-4222-8222-222222222222'::uuid, '👍');
        -- second insert with a different emoji must violate topic_user_unique
        BEGIN
            INSERT INTO club_discussion_reactions (topic_id, reply_id, user_id, emoji)
            VALUES ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, NULL, '22222222-2222-4222-8222-222222222222'::uuid, '📚');
            RAISE EXCEPTION 'CASE5 FAIL: A+B coexistence accepted by invariant!';
        EXCEPTION WHEN unique_violation THEN
            NULL; -- expected
        END;
    END;
END $$;

-- ============ CASE 6: same user different topics independent ============
DO $$
BEGIN
    PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '👏');
    PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000002'::uuid, NULL, '👏');
    IF (SELECT count(*) FROM club_discussion_reactions WHERE user_id='11111111-1111-4111-8111-111111111111' AND emoji='👏' AND reply_id IS NULL) <> 2 THEN
        RAISE EXCEPTION 'CASE6 FAIL: cross-topic independence broken';
    END IF;
END $$;

-- ============ CASE 7: different users same topic independent ============
DO $$
BEGIN
    PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '📚'); -- actor still user1
    SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
    PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '📚'); -- user2
    IF (SELECT count(DISTINCT user_id) FROM club_discussion_reactions WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND emoji='📚') <> 2 THEN
        RAISE EXCEPTION 'CASE7 FAIL: per-user independence broken';
    END IF;
END $$;

-- ============ CASES 8–10: REPLY symmetry ============
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$
DECLARE n integer;
BEGIN
    PERFORM set_club_discussion_reaction(NULL, 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, '❤️');
    PERFORM set_club_discussion_reaction(NULL, 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, '😂'); -- replace
    SELECT count(*) INTO n FROM club_discussion_reactions WHERE reply_id='bbbbbbbb-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111';
    IF n <> 1 THEN RAISE EXCEPTION 'REPLY FAIL: % rows after replacement, expected 1', n; END IF;
    IF (SELECT emoji FROM club_discussion_reactions WHERE reply_id='bbbbbbbb-0000-4000-8000-000000000001'::uuid AND user_id='11111111-1111-4111-8111-111111111111') <> '😂' THEN
        RAISE EXCEPTION 'REPLY FAIL: wrong surviving emoji';
    END IF;
    -- direct duplicate attempt must hit invariant
    BEGIN
        INSERT INTO club_discussion_reactions (topic_id, reply_id, user_id, emoji)
        VALUES (NULL, 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, '🔥');
        RAISE EXCEPTION 'REPLY FAIL: A+B accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
END $$;

-- ============ CASE 11: invalid emoji denied through RPC (TYPE-03) ============
DO $$
BEGIN
    BEGIN
        PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, 'x');
        RAISE EXCEPTION 'DOMAIN FAIL: invalid emoji accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;

-- ============ CASE 12: both/neither target input denied ============
DO $$
BEGIN
    BEGIN
        PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, '👍');
        RAISE EXCEPTION 'SHAPE FAIL: dual-target accepted';
    EXCEPTION WHEN cardinality_violation THEN NULL;
    WHEN others THEN
        IF SQLERRM NOT LIKE 'Exactly one of%' THEN RAISE EXCEPTION 'SHAPE FAIL: unexpected error: %', SQLERRM; END IF;
    END;
    BEGIN
        PERFORM set_club_discussion_reaction(NULL, NULL, '👍');
        RAISE EXCEPTION 'SHAPE FAIL: null-target accepted';
    EXCEPTION WHEN cardinality_violation THEN NULL;
    WHEN others THEN
        IF SQLERRM NOT LIKE 'Exactly one of%' THEN RAISE EXCEPTION 'SHAPE FAIL: unexpected error: %', SQLERRM; END IF;
    END;
END $$;

-- ============ CASE 13: unauthenticated denied ============
DO $$
BEGIN
    SELECT set_config('request.jwt.claim.sub', '', false);
    BEGIN
        PERFORM set_club_discussion_reaction('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '👍');
        RAISE EXCEPTION 'AUTH FAIL: unauthenticated accepted';
    EXCEPTION WHEN insufficient_privilege OR INSUFFICIENT_PRIVILEGE THEN NULL;
    WHEN others THEN
        IF SQLERRM NOT LIKE 'Authentication required%' THEN RAISE EXCEPTION 'AUTH FAIL: unexpected error: %', SQLERRM; END IF;
    END;
END $$;

-- ============ CASE 14: data-repair determinism (seeded dupes) ============
DO $$
DECLARE winner text; cnt integer;
BEGIN
    -- Seed duplicates for user2/topic2 (fresh target): 👍(older), ❤️(newest), 🔥(middle)
    INSERT INTO club_discussion_reactions (topic_id, reply_id, user_id, emoji, created_at) VALUES
        ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '22222222-2222-4222-8222-222222222222'::uuid, '👍', now() - interval '3 days'),
        ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '22222222-2222-4222-8222-222222222222'::uuid, '❤️', now() - interval '1 hour'),
        ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, NULL, '22222222-2222-4222-8222-222222222222'::uuid, '🔥', now() - interval '2 days');
    -- Run the exact repair CTE from the migration
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY topic_id, user_id ORDER BY created_at DESC, id DESC) rn
        FROM club_discussion_reactions WHERE topic_id IS NOT NULL
    ), losers AS (SELECT id FROM ranked WHERE rn > 1)
    DELETE FROM club_discussion_reactions WHERE id IN (SELECT id FROM losers);
    SELECT emoji, count(*) INTO winner, cnt FROM club_discussion_reactions
    WHERE topic_id='aaaaaaaa-0000-4000-8000-000000000001'::uuid AND user_id='22222222-2222-4222-8222-222222222222'
    GROUP BY emoji;
    IF cnt <> 1 OR winner <> '❤️' THEN
        RAISE EXCEPTION 'REPAIR FAIL: survivor=% count=% (expected ❤️ x1)', winner, cnt;
    END IF;
END $$;

\echo 'ALL_L4_CONTRACT_CASES_PASSED'
