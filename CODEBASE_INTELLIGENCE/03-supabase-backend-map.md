# 03 - Supabase Backend Map

## Client

Primary client file:

- `src/lib/supabase.ts`

Configuration:

- uses `EXPO_PUBLIC_SUPABASE_URL`
- uses `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- persists auth in MMKV via `src/lib/mmkv.ts`
- `autoRefreshToken: true`
- `persistSession: true`
- `detectSessionInUrl: false`
- uses a local auth lock wrapper

In dev auth bypass, placeholder Supabase values allow static/web UI rendering without public env vars.

## Test Mock

Primary mock:

- `src/lib/__mocks__/supabase.ts`

It provides mocked:

- `auth`
- `from`
- `rpc`
- `functions.invoke`
- `channel`

Use this as the starting point for Jest tests around services and hooks that call Supabase.

## Migrations

Migration folder:

- `supabase/migrations/`

Important recent marketplace migrations:

- `supabase/migrations/20260619000001_marketplace_foundation_schema.sql`
- `supabase/migrations/20260619000002_marketplace_foundation_helpers.sql`
- `supabase/migrations/20260619000003_marketplace_foundation_rls.sql`
- `supabase/migrations/20260619000004_marketplace_foundation_storage.sql`
- `supabase/migrations/20260619000005_marketplace_notifications_fk_indexes.sql`
- `supabase/migrations/20260627000001_marketplace_phase2_onboarding_hardening.sql`
- `supabase/migrations/20260628000001_marketplace_phase2b_application_metadata.sql`
- `supabase/migrations/20260628000002_marketplace_phase2c_review_metadata.sql`
- `supabase/migrations/20260628000003_marketplace_phase3_inventory_canonical_listings.sql` - Phase 3 canonical metadata, private inventory, public listing projection, RLS, and projection trigger. Applied live as `20260628181842 marketplace_phase3_inventory_canonical_listings`.
- `supabase/migrations/20260713000001_marketplace_phase3_public_listing_policy_split.sql` - local least-privilege remediation that separates anonymous public reads from authenticated owner/operator access without granting `anon` access to private helpers. Not live-applied.

Important hardening examples:

- `supabase/migrations/20260522230352_harden_exchange_rpc_actor_auth.sql`
- `supabase/migrations/20260522225437_cleanup_exchange_rpc_security.sql`
- `supabase/migrations/20260524043322_harden_profile_account_security.sql`
- `supabase/migrations/20260606103926_harden_notifications_advisor_findings.sql`

## Edge Functions

Function folder:

- `supabase/functions/`

Known functions include:

- `store-application` - Phase 2B service-role store application/document metadata actions; JWT required live.
- `store-review` - Phase 2C service-role platform review actions; JWT required live and caller must have `platform_admin` or `store_reviewer` in `platform_user_roles`.
- `send-notification`
- `wishlist-notify`
- `check-membership-limits`
- `complete-transaction`
- `transfer-credits`
- `handle-club-downgrade-grace-period`
- `commerce-scheduler` - Phase 6 development scheduler (version 5). It accepts only the configured custom scheduler secret, acquires the single scheduler lease, claims bounded task batches, and dispatches workers.
- `commerce-task-worker` - Phase 6 development worker (version 2). It requires service-role authorization; the scheduler explicitly forwards its server-side service-role bearer token for internal dispatch.

Historical architecture docs mention payment and delivery functions. Verify actual folder contents and live deployment before relying on those names.

## Storage

Current and marketplace-relevant buckets observed in live Supabase checks:

- `seller-verification-docs` - private seller verification documents.
- `storefront-assets` - public storefront assets.
- `inventory-photos` - public inventory photos.
- `listing-photos` - public P2P listing photos.
- `image-extraction-inputs` - private image extraction inputs.
- `order-dispute-evidence` - private dispute evidence.
- `profile-avatars` - public profile avatars.
- `club-banners` - public club banners.

Marketplace docs may contain an older typo, `store_verification-docs`; live bucket name is `seller-verification-docs`.

## Live Truth Rules

- Docs can be stale. Confirm live DB state through Supabase MCP before security-sensitive or migration work.
- `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md` is the marketplace status handoff.
- As of 2026-06-28, live migrations include `20260628102752 marketplace_phase2c_review_metadata`.
- As of 2026-06-28, live Edge Functions include `store-application` version 1 and `store-review` version 1, both with `verify_jwt=true`.
- Phase 2C authenticated platform-review smoke is pending/skipped until a platform-role test user is intentionally provided.
- As of 2026-06-29, Phase 3 migration `20260628181842 marketplace_phase3_inventory_canonical_listings` is live and verified. Trigger projection smoke passed, but anonymous public-read smoke is blocked because `marketplace_book_listings` public RLS references `marketplace_sec` helper functions that `anon` cannot execute.
- As of 2026-07-17, the Phase 6 development rollout has `commerce-scheduler` v5 and `commerce-task-worker` v2 active. Cron job 5 invokes the scheduler every minute; its first scheduled empty-queue run succeeded. Synthetic tagged dispatch, retry, and dead-letter paths passed. Real timed commerce-command verification remains pending; do not treat this development rollout as production readiness.
- The superseded anonymous helper-grant draft was not retained. The local policy-split migration preserves private helper grants and still requires explicit approval before any live application.
- Supabase advisory at pack creation time reported `public.spatial_ref_sys` has RLS disabled. Do not auto-fix without deciding policies and impact.

## Security Patterns To Preserve

- Client app uses anon key only.
- Service-role operations belong in trusted Edge Functions or backend-controlled transitions.
- Marketplace RLS should use explicit store tenant boundaries.
- Avoid broad `SECURITY DEFINER` and broad storage listing patterns from older parts of the DB.
