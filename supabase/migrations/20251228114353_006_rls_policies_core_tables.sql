-- Live migration version/name: 20251228114353 / 006_rls_policies_core_tables
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114353
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

-- Core RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON user_profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own books" ON user_books
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add books to their library" ON user_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own books" ON user_books
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE credit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own credit events" ON credit_events
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE user_credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own credit balance" ON user_credit_balances
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);