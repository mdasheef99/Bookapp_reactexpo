-- Live migration version/name: 20251228114444 / 008_rls_policies_venues_clubs
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114444
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

ALTER TABLE book_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clubs are viewable by everyone" ON book_clubs
  FOR SELECT USING (true);
CREATE POLICY "Club leads can update their clubs" ON book_clubs
  FOR UPDATE USING (auth.uid() = lead_id);
CREATE POLICY "Authenticated users can create clubs" ON book_clubs
  FOR INSERT WITH CHECK (auth.uid() = lead_id);

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view club members" ON club_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = club_members.club_id AND cm.user_id = auth.uid())
  );
CREATE POLICY "Club leads can manage members" ON club_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = club_members.club_id AND cm.user_id = auth.uid() AND cm.role = 'lead')
  );

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venues are viewable by everyone" ON venues
  FOR SELECT USING (verification_status = 'approved' OR auth.uid() = owner_user_id);
CREATE POLICY "Owners can manage their venues" ON venues
  FOR ALL USING (auth.uid() = owner_user_id);

ALTER TABLE club_join_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applications are viewable by applicant and club leads" ON club_join_applications
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_join_applications.club_id AND user_id = auth.uid() AND role = 'lead')
  );
CREATE POLICY "Users can apply to clubs" ON club_join_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Club leads can review applications" ON club_join_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_join_applications.club_id AND user_id = auth.uid() AND role = 'lead')
  );

ALTER TABLE club_join_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Join questions are viewable with clubs" ON club_join_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM book_clubs WHERE id = club_id)
  );
CREATE POLICY "Club leads can manage join questions" ON club_join_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_join_questions.club_id AND user_id = auth.uid() AND role = 'lead')
  );

ALTER TABLE club_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club venues are viewable by members" ON club_venues
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_venues.club_id AND user_id = auth.uid())
  );
CREATE POLICY "Club leads can manage club venues" ON club_venues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_venues.club_id AND user_id = auth.uid() AND role = 'lead')
  );

ALTER TABLE book_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view nominations" ON book_nominations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = book_nominations.club_id AND user_id = auth.uid())
  );
CREATE POLICY "Members can nominate books" ON book_nominations
  FOR INSERT WITH CHECK (auth.uid() = nominated_by);

ALTER TABLE book_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view votes" ON book_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM book_nominations bn
      JOIN club_members cm ON cm.club_id = bn.club_id
      WHERE bn.id = nomination_id AND cm.user_id = auth.uid()
    )
  );
CREATE POLICY "Members can vote" ON book_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);