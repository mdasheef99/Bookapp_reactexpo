-- ============================================================
-- CLUBS REMEDIATION — TYPE-03 / TYPE-03-d migration (DRAFT, requires approval)
-- Closed DB-enforced reaction emoji set (decision: 11 canonical emojis)
-- Project: ahntbtktjjmvfosgkmgn · Branch: feat/clubs-ui-overhaul
--
-- LIVE EVIDENCE (2026-08-22, Supabase MCP read-only):
--   club_discussion_reactions.emoji: text, NOT NULL, only a non-blank
--   CHECK exists — any string is accepted today. TS union allows 5,
--   UI picker offers 11, DB unconstrained (the three-way drift).
--   Live data: 7 distinct values, of which 2 are mojibake rows
--   (double-encoded UTF-8): 'ðŸ‘' = corrupted 👍 (U+1F44D),
--   'ðŸ˜‚' = corrupted 😂 (U+1F602). One row each.
--   message_reactions (chat feature) also has free-text emoji but is
--   OUT OF SCOPE here (different feature; empty table anyway).
--
-- PLAN:
--   1. Repair the 2 mojibake rows to their true emoji.
--   2. Add CHECK constraint enforcing exactly the canonical 11:
--      👍 U+1F44D · 👎 U+1F44E · ❤️ U+2764 U+FE0F · 🔥 U+1F525
--      👏 U+1F44F · 😂 U+1F602 · 😍 U+1F60D · 😮 U+1F62E
--      😢 U+1F622 · 🤔 U+1F914 · 📚 U+1F4DA
--      (matches REACTION_OPTIONS in ClubDiscussionThreadScreen.tsx)
--   3. NOT VALID? No — table is tiny (few rows) and we repaired first;
--      validate immediately so the contract holds from now on.
--   Scope note: message_reactions intentionally untouched (chat domain).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Data repair — mojibake rows.
--    APPLICATION NOTE (2026-08-23): direct UPDATE with literal mojibake
--    failed on unique constraint reply_user_emoji_unique — each mojibake
--    row duplicated a canonical row by the same user on the same reply.
--    Resolution per user approval: deleted the 2 mojibake rows by exact
--    id (no reaction data lost). Constraint then applied cleanly.
--    The statements below are kept as the original draft form; the live
--    application used byte-hex targeting + the two id deletes recorded
--    in the tracker ledger.
-- ------------------------------------------------------------
UPDATE public.club_discussion_reactions
SET emoji = '👍'
WHERE emoji = 'ðŸ‘';

UPDATE public.club_discussion_reactions
SET emoji = '😂'
WHERE emoji = 'ðŸ˜‚';

-- ------------------------------------------------------------
-- 2) Enforce the closed set
-- ------------------------------------------------------------
ALTER TABLE public.club_discussion_reactions DROP CONSTRAINT IF EXISTS club_discussion_reactions_emoji_canonical;

ALTER TABLE public.club_discussion_reactions
ADD CONSTRAINT club_discussion_reactions_emoji_canonical
CHECK (
  emoji IN (
    '👍', -- U+1F44D thumbs up
    '👎', -- U+1F44E thumbs down
    '❤️', -- U+2764 U+FE0F heart
    '🔥', -- U+1F525 fire
    '👏', -- U+1F44F clap
    '😂', -- U+1F602 joy
    '😍', -- U+1F60D heart-eyes
    '😮', -- U+1F62E open mouth
    '😢', -- U+1F622 crying
    '🤔', -- U+1F914 thinking
    '📚'  -- U+1F4DA books
  )
);

COMMIT;

-- ============================================================
-- POST-APPLY READBACK CHECKLIST:
-- [ ] SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid='public.club_discussion_reactions'::regclass AND contype='c';
--     → emoji_canonical present with the 11-value IN list
-- [ ] SELECT DISTINCT emoji FROM club_discussion_reactions;
--     → no mojibake values remain; all within canonical set
-- [ ] Negative test: INSERT with 'x' → check violation
-- CLIENT ALIGNMENT (separate commit, TYPE-01..02 territory):
-- [ ] TS union ClubDiscussionReactionEmoji widened 5 → same 11 as DB/UI
-- ============================================================
