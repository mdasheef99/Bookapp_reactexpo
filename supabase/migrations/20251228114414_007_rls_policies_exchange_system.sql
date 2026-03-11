-- Live migration version/name: 20251228114414 / 007_rls_policies_exchange_system
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114414
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view active listings" ON listings
  FOR SELECT USING (status = 'active' OR auth.uid() = owner_id);
CREATE POLICY "Users can create their own listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own listings" ON listings
  FOR UPDATE USING (auth.uid() = owner_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = lender_id OR auth.uid() = borrower_id);
CREATE POLICY "Borrowers can request transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = borrower_id);
CREATE POLICY "Participants can update transaction status" ON transactions
  FOR UPDATE USING (auth.uid() = lender_id OR auth.uid() = borrower_id);

ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own addresses" ON user_addresses
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE transaction_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ratings involving them" ON transaction_ratings
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can rate completed transactions they participated in" ON transaction_ratings
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);