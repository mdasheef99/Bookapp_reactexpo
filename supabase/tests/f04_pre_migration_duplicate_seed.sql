-- ============================================================================
-- CLUB-WU-L01-A · F04 migration-boundary repair proof — PRE-MIGRATION seed.
--
-- Seeds a deterministic LEGACY duplicate reaction set that is LEGAL under the
-- pre-F04 schema (emoji-inclusive uniqueness: (topic_id,user_id,emoji)) but
-- ILLEGAL under the post-F04 actor/target invariant installed by migration
-- 20260824100000_clubs_f04_reaction_single_reaction_invariant.sql.
--
-- MUST run AFTER f04_fixture.sql and BEFORE the actual F04 migration, so the
-- migration's own Step-1 repair CTE observes these rows across the migration
-- boundary. The repair behavior under test is the ACTUAL migration file —
-- no repair SQL is duplicated anywhere in the proof.
--
-- Fixture design (repair ordering is created_at DESC, then id DESC):
--   dedicated actor  33333333-3333-4333-8333-333333333333
--   dedicated topic  aaaaaaaa-0000-4000-8000-000000000003
--   row L1 cccccccc-…-0001 👍 created_at '2026-08-23T10:00:00Z' (oldest)
--   row W  cccccccc-…-0002 ❤️ created_at '2026-08-26T12:00:00Z' (NEWEST → survivor)
--   row L2 cccccccc-…-0003 🔥 created_at '2026-08-24T10:00:00Z' (middle)
-- created_at values are DISTINCT and mutually exclusive with the id ordering
-- (L2 has the greatest id but not the newest created_at), so the survivor is
-- deterministic under created_at DESC alone AND proves created_at takes
-- precedence over the id tie-break. The tie-break itself is intentionally NOT
-- exercised here (bounded main boundary proof; distinct timestamps).
-- Isolation: this actor/topic pair is referenced by nothing else in the F04
-- suite (post-migration contracts use users 1111/2222 on topics 001/002),
-- so no seeded state can leak into CASE 1–13 or the concurrency probe.
-- ============================================================================
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('33333333-3333-4333-8333-333333333333');

INSERT INTO club_discussion_topics (id) VALUES ('aaaaaaaa-0000-4000-8000-000000000003');

INSERT INTO club_discussion_reactions (id, topic_id, reply_id, user_id, emoji, created_at) VALUES
    ('cccccccc-0000-4000-8000-000000000001'::uuid,
     'aaaaaaaa-0000-4000-8000-000000000003'::uuid, NULL,
     '33333333-3333-4333-8333-333333333333'::uuid, '👍', '2026-08-23T10:00:00+00:00'::timestamptz),
    ('cccccccc-0000-4000-8000-000000000002'::uuid,
     'aaaaaaaa-0000-4000-8000-000000000003'::uuid, NULL,
     '33333333-3333-4333-8333-333333333333'::uuid, '❤️', '2026-08-26T12:00:00+00:00'::timestamptz),
    ('cccccccc-0000-4000-8000-000000000003'::uuid,
     'aaaaaaaa-0000-4000-8000-000000000003'::uuid, NULL,
     '33333333-3333-4333-8333-333333333333'::uuid, '🔥', '2026-08-24T10:00:00+00:00'::timestamptz);

-- Sanity: exactly 3 legacy rows seeded for the group, all legal pre-migration.
DO $$
DECLARE n integer;
BEGIN
    SELECT count(*) INTO n FROM club_discussion_reactions
    WHERE topic_id = 'aaaaaaaa-0000-4000-8000-000000000003'::uuid
      AND user_id  = '33333333-3333-4333-8333-333333333333'::uuid;
    IF n <> 3 THEN
        RAISE EXCEPTION 'PRE-SEED FAIL: expected 3 legacy duplicate rows, found %', n;
    END IF;
END $$;

\echo 'F04_PRE_MIGRATION_DUPLICATE_SEED_PASSED'
