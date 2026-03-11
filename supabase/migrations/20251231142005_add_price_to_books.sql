-- Live migration version/name: 20251231142005 / add_price_to_books
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251231142005
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

ALTER TABLE books
ADD COLUMN IF NOT EXISTS retail_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS buy_link TEXT;