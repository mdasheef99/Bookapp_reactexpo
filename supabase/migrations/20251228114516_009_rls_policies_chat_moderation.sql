-- Live migration version/name: 20251228114516 / 009_rls_policies_chat_moderation
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114516
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

ALTER TABLE club_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view club messages" ON club_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_messages.club_id AND user_id = auth.uid())
  );
CREATE POLICY "Members can send messages" ON club_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_messages.club_id AND user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Members can edit their own messages" ON club_messages
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view reactions" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_messages cm
      JOIN club_members cmem ON cmem.club_id = cm.club_id
      WHERE cm.id = message_id AND cmem.user_id = auth.uid()
    )
  );
CREATE POLICY "Members can add reactions" ON message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can remove their own reactions" ON message_reactions
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE club_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view club events" ON club_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_events.club_id AND user_id = auth.uid())
  );
CREATE POLICY "Leads and moderators can create events" ON club_events
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_events.club_id AND user_id = auth.uid() AND role IN ('lead', 'moderator'))
  );
CREATE POLICY "Creators can update their own events" ON club_events
  FOR UPDATE USING (auth.uid() = created_by);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view event RSVPs" ON event_rsvps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_events ce
      JOIN club_members cm ON cm.club_id = ce.club_id
      WHERE ce.id = event_id AND cm.user_id = auth.uid()
    )
  );
CREATE POLICY "Members can RSVP to club events" ON event_rsvps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can update their own RSVP" ON event_rsvps
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE club_member_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view actions affecting them" ON club_member_actions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Club leads can create actions" ON club_member_actions
  FOR INSERT WITH CHECK (
    auth.uid() = performed_by AND
    EXISTS (SELECT 1 FROM club_members WHERE club_id = club_member_actions.club_id AND user_id = auth.uid() AND role = 'lead')
  );

ALTER TABLE club_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can file complaints" ON club_complaints
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view their own complaints" ON club_complaints
  FOR SELECT USING (auth.uid() = reporter_id);