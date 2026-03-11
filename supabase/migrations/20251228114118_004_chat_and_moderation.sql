-- Live migration version/name: 20251228114118 / 004_chat_and_moderation
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114118
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

-- Club messages
CREATE TABLE club_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  chapter_tag INTEGER,
  has_spoiler BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES auth.users(id),
  deleted_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_club ON club_messages(club_id, created_at DESC);
CREATE INDEX idx_messages_chapter ON club_messages(club_id, chapter_tag);

-- Message reactions
CREATE TABLE message_reactions (
  message_id UUID REFERENCES club_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Club events
CREATE TABLE club_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('online', 'offline')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  venue_id UUID REFERENCES venues(id),
  meeting_link TEXT,
  max_attendees INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_club ON club_events(club_id, start_time);

-- Event RSVPs
CREATE TABLE event_rsvps (
  event_id UUID REFERENCES club_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Reading schedules
CREATE TABLE reading_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  book_id UUID REFERENCES books(id),
  milestones JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedules_club ON reading_schedules(club_id);

-- Member reading progress
CREATE TABLE member_reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES reading_schedules(id),
  user_id UUID REFERENCES auth.users(id),
  chapters_completed INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_id, user_id)
);

-- Moderation actions
CREATE TABLE club_member_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('warned', 'muted', 'banned')),
  reason TEXT NOT NULL,
  duration_hours INTEGER,
  expires_at TIMESTAMPTZ,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_member_actions_user ON club_member_actions(user_id, created_at DESC);

-- Platform-level complaints
CREATE TABLE club_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  reporter_id UUID REFERENCES auth.users(id),
  reported_user_id UUID REFERENCES auth.users(id),
  message_id UUID REFERENCES club_messages(id),
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'spoilers', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES auth.users(id),
  resolution_action TEXT CHECK (resolution_action IN ('warned', 'muted', 'banned', 'no_action')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_complaints_status ON club_complaints(status) WHERE status IN ('pending', 'reviewing');