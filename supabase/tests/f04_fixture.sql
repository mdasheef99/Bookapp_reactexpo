-- CLUB-WU-F04 test fixture: minimal schema needed to replay the reaction model
-- (migration 018's reaction table + TYPE-03 checks) and the F04 migration on a
-- disposable Postgres 17 instance. NOT a full repo replay — full-chain replay is
-- recorded as a follow-up obligation for L01/WU-L04 harness work.
-- Fixture mirrors live definitions verified during the FUNC-04 confirmation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Minimal auth shim: auth.uid() from a GUC, like Supabase.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE club_discussion_topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id uuid,
    author_user_id uuid,
    title text NOT NULL DEFAULT 'fixture topic',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE club_discussion_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id uuid REFERENCES club_discussion_topics(id) ON DELETE CASCADE,
    author_user_id uuid,
    body text NOT NULL DEFAULT 'fixture reply',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- auth.users shim so the reaction FK works (created before reactions table).
CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Reaction table exactly as migration 018 defines it (live-verified).
CREATE TABLE club_discussion_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id uuid REFERENCES club_discussion_topics(id) ON DELETE CASCADE,
    reply_id uuid REFERENCES club_discussion_replies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    emoji text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT club_discussion_reactions_target_check CHECK (
        ((topic_id IS NOT NULL)::integer + (reply_id IS NOT NULL)::integer) = 1
    ),
    CONSTRAINT club_discussion_reactions_emoji_present CHECK (NULLIF(btrim(emoji), ''::text) IS NOT NULL),
    CONSTRAINT club_discussion_reactions_topic_user_emoji_unique UNIQUE (topic_id, user_id, emoji),
    CONSTRAINT club_discussion_reactions_reply_user_emoji_unique UNIQUE (reply_id, user_id, emoji)
);
ALTER TABLE club_discussion_reactions
    ADD CONSTRAINT club_discussion_reactions_emoji_canonical
    CHECK (emoji = ANY (ARRAY['👍','👎','❤️','🔥','👏','😂','😍','😮','😢','🤔','📚']));

CREATE INDEX idx_club_discussion_reactions_topic ON club_discussion_reactions (topic_id) WHERE (topic_id IS NOT NULL);
CREATE INDEX idx_club_discussion_reactions_reply ON club_discussion_reactions (reply_id) WHERE (reply_id IS NOT NULL);

-- auth.users shim so FK works.
-- (moved earlier in file — see above)

-- Seed fixture actors/targets (valid UUID literals).
INSERT INTO auth.users (id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO club_discussion_topics (id) VALUES ('aaaaaaaa-0000-4000-8000-000000000001'), ('aaaaaaaa-0000-4000-8000-000000000002');
INSERT INTO club_discussion_replies (id, topic_id) VALUES ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001');
