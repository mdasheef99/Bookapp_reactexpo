-- Live migration version/name: 20251231141336 / add_all_google_books_fields
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251231141336
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

ALTER TABLE books 
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS preview_link TEXT,
ADD COLUMN IF NOT EXISTS info_link TEXT;