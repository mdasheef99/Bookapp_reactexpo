# Live Migration History (Source of Truth)

Canonical source: live Supabase project `ahntbtktjjmvfosgkmgn` on `2026-03-06`.

## Applied migrations in live database

| Version | Name | Local artifact status |
|---|---|---|
| `20251228083154` | `001_initial_schema` | Recovered locally as `20251228083154_001_initial_schema.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114030` | `002_p2p_exchange_system` | Recovered locally as `20251228114030_002_p2p_exchange_system.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114057` | `003_venues_and_clubs` | Recovered locally as `20251228114057_003_venues_and_clubs.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114118` | `004_chat_and_moderation` | Recovered locally as `20251228114118_004_chat_and_moderation.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114143` | `005_add_missing_user_profile_fields` | Recovered locally as `20251228114143_005_add_missing_user_profile_fields.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114353` | `006_rls_policies_core_tables` | Recovered locally as `20251228114353_006_rls_policies_core_tables.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114414` | `007_rls_policies_exchange_system` | Recovered locally as `20251228114414_007_rls_policies_exchange_system.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114444` | `008_rls_policies_venues_clubs` | Recovered locally as `20251228114444_008_rls_policies_venues_clubs.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251228114516` | `009_rls_policies_chat_moderation` | Recovered locally as `20251228114516_009_rls_policies_chat_moderation.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251231141336` | `add_all_google_books_fields` | Recovered locally as `20251231141336_add_all_google_books_fields.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20251231142005` | `add_price_to_books` | Recovered locally as `20251231142005_add_price_to_books.sql` from live `supabase_migrations.schema_migrations` (exact recovered migration) |
| `20260101105319` | `create_user_wishlist` | Backfilled locally as `20260101105319_create_user_wishlist.sql` |
| `20260212150120` | `create_reading_notes` | Backfilled locally as `20260212150120_create_reading_notes.sql` |

## Important notes

- The live database is the only canonical migration source of truth.
- Older documentation that mentions a 5-migration plan is historical only.
- `manual_migration_lead_to_admin.sql` is a legacy reference and is **not** part of the live applied migration sequence.
- Exact historical SQL for the first 11 migrations has not been safely recovered from live metadata alone; do not invent replacement SQL without an explicit backfill plan.