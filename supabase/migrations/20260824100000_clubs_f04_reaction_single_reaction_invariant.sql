-- ============================================================================
-- CLUB-WU-F04 — Reaction replacement persistence / PRODUCT-12 single-reaction
-- enforcement (Phase 1). REV.2 — independent review correction folded in:
-- RPC rewritten to RETURNS SETOF club_discussion_reactions + RETURNING *
-- (RETURNS TABLE output-column shadowing made the original ON CONFLICT
-- predicate ambiguous at runtime — 42702 — and naive pragma fixes corrupted
-- VALUES binding under target_check).
--
-- Finding: CLUB-FUNC-04. Contract: PRODUCT-12 (one reaction per actor per
-- discussion target; A→B replaces; A+B coexistence prohibited).
--
-- Order of operations (frozen by the CLUB-WU-F04 remediation confirmation):
--   1. deterministic duplicate repair (newest created_at wins, tie-break id DESC)
--   2. post-repair assertion (fail loudly if any violating group survives)
--   3. partial unique indexes enforcing one reaction per actor+target
--   4. set_club_discussion_reaction RPC (SECURITY INVOKER, native partial-index
--      arbiter upsert, RETURNS SETOF club_discussion_reactions)
--
-- NOT done here (Phase 4, separate future migration):
--   dropping club_discussion_reactions_topic_user_emoji_unique /
--   club_discussion_reactions_reply_user_emoji_unique.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: deterministic duplicate repair.
-- Keep rank-1 row per (target, user): newest created_at, then greatest id.
-- Rows belonging to different users/targets are never touched; topic and reply
-- groups are handled independently.
-- ---------------------------------------------------------------------------

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY topic_id, user_id
               ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM club_discussion_reactions
    WHERE topic_id IS NOT NULL
),
losers AS (
    SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM club_discussion_reactions
WHERE id IN (SELECT id FROM losers);

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY reply_id, user_id
               ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM club_discussion_reactions
    WHERE reply_id IS NOT NULL
),
losers AS (
    SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM club_discussion_reactions
WHERE id IN (SELECT id FROM losers);

-- ---------------------------------------------------------------------------
-- Step 2: post-repair assertion. The migration MUST fail if any group still
-- violates PRODUCT-12 after cleanup.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_topic_groups integer;
    v_reply_groups integer;
BEGIN
    SELECT count(*) INTO v_topic_groups FROM (
        SELECT 1 FROM club_discussion_reactions
        WHERE topic_id IS NOT NULL
        GROUP BY topic_id, user_id HAVING count(*) > 1
    ) t;
    SELECT count(*) INTO v_reply_groups FROM (
        SELECT 1 FROM club_discussion_reactions
        WHERE reply_id IS NOT NULL
        GROUP BY reply_id, user_id HAVING count(*) > 1
    ) r;

    IF v_topic_groups > 0 OR v_reply_groups > 0 THEN
        RAISE EXCEPTION 'CLUB-WU-F04 data repair failed: % topic groups, % reply groups still violate single-reaction invariant',
            v_topic_groups, v_reply_groups
            USING ERRCODE = 'P0001';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3: database-enforced one-reaction-per-actor-per-target invariant.
-- Partial unique indexes: nullable dual-target columns mean NULLs never collide
-- within one index; target_check already forbids both being non-null.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS club_discussion_reactions_topic_user_unique
    ON club_discussion_reactions (topic_id, user_id)
    WHERE topic_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS club_discussion_reactions_reply_user_unique
    ON club_discussion_reactions (reply_id, user_id)
    WHERE reply_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 4: atomic replacement RPC.
-- SECURITY INVOKER: existing INSERT/UPDATE RLS policies remain authoritative
-- (auth.uid() = user_id + can_participate_club_discussion). Native partial-index
-- arbiter inference is used because PostgREST's on_conflict cannot express it.
-- created_at is intentionally NOT updated on replacement (first-reaction time).
--
-- REV.2 NOTE: RETURNS SETOF club_discussion_reactions (row type) instead of
-- RETURNS TABLE(...) — TABLE column names become PL/pgSQL variables that
-- shadow/ambiguate ON CONFLICT predicates and RETURNING targets. RETURNING *
-- with the row type avoids the whole class of conflicts. supabase-js returns
-- the identical row object either way, so the client contract is unchanged.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_club_discussion_reaction(
    in_topic_id uuid,
    in_reply_id uuid,
    in_emoji text
)
RETURNS SETOF club_discussion_reactions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
    v_target_count integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    v_target_count :=
        (CASE WHEN in_topic_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN in_reply_id IS NULL THEN 0 ELSE 1 END);
    IF v_target_count <> 1 THEN
        RAISE EXCEPTION 'Exactly one of topic_id or reply_id must be provided.'
            USING ERRCODE = '22023';
    END IF;

    IF in_topic_id IS NOT NULL THEN
        RETURN QUERY
        INSERT INTO club_discussion_reactions AS cdr (topic_id, reply_id, user_id, emoji)
        VALUES (in_topic_id, NULL, auth.uid(), in_emoji)
        ON CONFLICT (topic_id, user_id) WHERE topic_id IS NOT NULL
        DO UPDATE SET emoji = EXCLUDED.emoji
        RETURNING *;
        RETURN;
    END IF;

    RETURN QUERY
    INSERT INTO club_discussion_reactions AS cdr (topic_id, reply_id, user_id, emoji)
    VALUES (NULL, in_reply_id, auth.uid(), in_emoji)
    ON CONFLICT (reply_id, user_id) WHERE reply_id IS NOT NULL
    DO UPDATE SET emoji = EXCLUDED.emoji
    RETURNING *;
END;
$function$;

-- ============================================================================
-- End CLUB-WU-F04 Phase-1 migration rev.2. Old emoji-inclusive unique
-- constraints (…_topic_user_emoji_unique / …_reply_user_emoji_unique)
-- intentionally REMAIN until the Phase-4 compatibility migration.
-- ============================================================================
