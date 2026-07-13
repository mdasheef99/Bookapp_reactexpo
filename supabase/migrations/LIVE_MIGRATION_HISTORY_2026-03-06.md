# Live Migration History (Source of Truth)

Canonical source: live Supabase project `ahntbtktjjmvfosgkmgn` on `2026-03-06`.

Last reconciled: `2026-06-19` after Phase 1 marketplace foundation rollout + post-deployment audit.

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
| `20260605123242` | `clubs_moderation_cleanup_and_policy_notes` | Applied live on 2026-06-05 from local `20260529143000_clubs_moderation_cleanup_and_policy_notes.sql`; creates `cleanup_expired_club_member_actions()` and documents the `club_public_details` contract |
| `20260605123337` | `club_moderation_author_lifecycle_rpc` | Applied live on 2026-06-05 from local `20260529154500_club_moderation_author_lifecycle_rpc.sql`; creates moderation/admin-transfer RPCs and `club_admin_transfer_requests` |
| `20260605123430` | `club_downgrade_grace_period` | Applied live on 2026-06-05 from local `20260529170000_club_downgrade_grace_period.sql`; creates `club_downgrade_grace_events`, `process_club_downgrade_grace_period(...)`, enables `pg_cron`, and schedules downgrade grace processing |
| `20260605123630` | `harden_clubs_maintenance_rpc_execute_grants` | Live-only rollout hardening on 2026-06-05; restricts maintenance RPC execution to `service_role`/owner |
| `20260605123747` | `schedule_expired_club_member_actions_cleanup` | Live-only rollout follow-up on 2026-06-05; schedules `cleanup-expired-club-member-actions` after `pg_cron` became available |
| `20260619060411` | `marketplace_foundation_schema` | Applied 2026-06-19 via Supabase MCP. Creates 27 marketplace domain tables + FK indexes (Part A of split foundation). |
| `20260619060437` | `marketplace_foundation_helpers` | Applied 2026-06-19 via Supabase MCP. Creates `marketplace_sec` private schema, 3 SECURITY DEFINER helper functions, and `trg_sync_public_store_profile` trigger (Part B). |
| `20260619060527` | `marketplace_foundation_rls` | Applied 2026-06-19 via Supabase MCP. Enables RLS on all 27 tables and creates all policies (Part C). |
| `20260619060547` | `marketplace_foundation_storage` | Applied 2026-06-19 via Supabase MCP. Creates 5 marketplace storage buckets and 4 path-scoped object policies (Part D). |
| (post-audit) | `marketplace_notifications_fk_indexes` | Applied 2026-06-19 via Supabase MCP. Follow-up: adds `idx_notifications_user` and `idx_notifications_store` on `marketplace_notifications` — missing FK indexes identified in post-deployment audit (SEC-04). |

## Important notes

- The live database is the only canonical migration source of truth.
- Older documentation that mentions a 5-migration plan is historical only.
- `manual_migration_lead_to_admin.sql` is a legacy reference and is **not** part of the live applied migration sequence.
- Exact historical SQL for the first 11 migrations has not been safely recovered from live metadata alone; do not invent replacement SQL without an explicit backfill plan.
- The 2026-06-05 live rollout also deployed Edge Function `handle-club-downgrade-grace-period` with `verify_jwt: true` and verified active `pg_cron` jobs `cleanup-expired-club-member-actions` and `club-downgrade-grace-period`.
