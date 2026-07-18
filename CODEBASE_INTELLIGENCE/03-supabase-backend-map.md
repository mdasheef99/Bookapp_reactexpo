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
- `supabase/migrations/20260713000001_marketplace_phase3_public_listing_policy_split.sql` - live least-privilege split for anonymous public reads versus authenticated owner/operator access.
- `supabase/migrations/20260715000002_marketplace_phase5_discovery_hardening.sql` and `20260715000003_marketplace_phase5_public_policy_projection_fix.sql` - live discovery/privacy/locality hardening and public projection correction.
- `supabase/migrations/20260716000001_marketplace_phase6_order_request_core.sql` through `20260716000039_marketplace_phase6_emergency_resume_zero_fix.sql` - Phase 6 carts, requests, snapshots, holds, safe reads, commands, deadlines, events, tasks, scheduler, reconciliation, observations, UI projections, and forward-only corrections. All M01-M39 are applied in development.

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
- `commerce-task-worker` - Phase 6 development worker (live version 3 as of 2026-07-18). It requires service-role authorization; the scheduler explicitly forwards its server-side service-role bearer token for internal dispatch.

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
- As of 2026-07-18, live Edge Functions include `store-application` v3, `store-review` v3, and `store-profile` v3 with `verify_jwt=true`.
- Phase 2C authenticated platform-review smoke is pending/skipped until a platform-role test user is intentionally provided.
- Phase 3 public listing policy split and Phase 5 projection correction are live; anonymous/authenticated discovery and private-boundary smokes passed.
- Phase 6 is complete through provider-independent `payment_ready`. All M01-M39 migrations are live in development.
- As of 2026-07-18, `commerce-scheduler` v5 and `commerce-task-worker` v3 are active. Cron job 5 invokes the scheduler every minute and its latest queried runs succeeded. Comprehensive browser and real timed commerce-command E2E remain deferred; this is not production readiness.
- Authoritative Phase 6 tables have RLS enabled. The event-schema and notification-type registries have no RLS but direct grant inspection shows service-role-only access; do not change this from the generic advisor alone.
- `store_inventory_quantity_balance` has zero current violations but remains `NOT VALID`; validate it with a forward migration before production readiness.
- Supabase also reports standard `public.spatial_ref_sys` no-RLS and existing project-wide advisor items. Do not auto-fix without scoped policy and impact review.

## Security Patterns To Preserve

- Client app uses anon key only.
- Service-role operations belong in trusted Edge Functions or backend-controlled transitions.
- Marketplace RLS should use explicit store tenant boundaries.
- Avoid broad `SECURITY DEFINER` and broad storage listing patterns from older parts of the DB.
