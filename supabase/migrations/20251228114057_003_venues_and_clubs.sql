-- Live migration version/name: 20251228114057 / 003_venues_and_clubs
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114057
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  venue_type TEXT NOT NULL CHECK (venue_type IN (
    'cafe', 'library', 'coworking', 'bookstore', 'other'
  )),
  cover_url TEXT,
  photos TEXT[],
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  location GEOGRAPHY(POINT),
  operating_hours JSONB,
  amenities TEXT[],
  max_capacity INTEGER,
  booking_required BOOLEAN DEFAULT false,
  owner_user_id UUID REFERENCES auth.users(id),
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'approved', 'rejected', 'suspended'
  )),
  is_exchange_partner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_status ON venues(verification_status);
CREATE INDEX idx_venues_location_gist ON venues USING gist(location);

-- Book Clubs
CREATE TABLE book_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  club_type TEXT NOT NULL CHECK (club_type IN ('public', 'approval', 'invite_only')),
  access_level TEXT DEFAULT 'all' CHECK (access_level IN ('all', 'pro', 'pro_plus')),
  current_book_id UUID REFERENCES books(id),
  lead_id UUID REFERENCES auth.users(id),
  member_count INTEGER DEFAULT 0,
  max_members INTEGER,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clubs_type ON book_clubs(club_type);
CREATE INDEX idx_clubs_active ON book_clubs(is_archived) WHERE is_archived = false;

-- Club join questions
CREATE TABLE club_join_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL,
  CHECK (order_index >= 0)
);

CREATE INDEX idx_join_questions_club ON club_join_questions(club_id, order_index);

-- Join applications
CREATE TABLE club_join_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  answers JSONB NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_applications_pending ON club_join_applications(club_id, status) 
WHERE status = 'pending';

-- Club members
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'lead')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'muted', 'banned')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_members_club ON club_members(club_id);
CREATE INDEX idx_members_user ON club_members(user_id);

-- Trigger to update member_count
CREATE OR REPLACE FUNCTION update_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE book_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE book_clubs SET member_count = member_count - 1 WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_member_count
AFTER INSERT OR DELETE ON club_members
FOR EACH ROW EXECUTE FUNCTION update_member_count();

-- Club ↔ Venue association
CREATE TABLE club_venues (
  club_id UUID REFERENCES book_clubs(id),
  venue_id UUID REFERENCES venues(id),
  is_primary BOOLEAN DEFAULT false,
  PRIMARY KEY (club_id, venue_id)
);

-- Book nominations & voting
CREATE TABLE book_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  book_id UUID REFERENCES books(id),
  nominated_by UUID REFERENCES auth.users(id),
  vote_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'selected', 'rejected')),
  voting_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, book_id, status)
);

CREATE TABLE book_votes (
  nomination_id UUID REFERENCES book_nominations(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (nomination_id, user_id)
);

CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE book_nominations 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.nomination_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE book_nominations 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.nomination_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_vote_count
AFTER INSERT OR DELETE ON book_votes
FOR EACH ROW EXECUTE FUNCTION update_vote_count();