# Codebase Intelligence Pack

**Created:** 2026-06-24
**Purpose:** Preserve the high-value codebase orientation that Augment/codebase-retrieval provided, so future sessions can work effectively even if that MCP is unavailable.

## Start Here

Before making codebase decisions, read this folder first. Treat it as the durable map of how the current app is organized, which existing pieces are reusable, and which boundaries must be protected.

Recommended order:

1. `01-system-map.md` - app shell, routing, providers, and navigation.
2. `02-auth-session-map.md` - login, OTP, session persistence, redirects, and auth risks.
3. `03-supabase-backend-map.md` - Supabase client, migrations, Edge Functions, storage, mocks, and live-truth caveats.
4. `04-feature-inventory.md` - current feature ownership and reusable patterns.
5. `05-marketplace-phase-2-readiness.md` - Store Owner onboarding status, review/setup surfaces, and remaining Phase 2C smoke gate.
6. `08-marketplace-phase-3-readiness.md` - manual inventory, canonical book/listing boundary, and next files to inspect.
7. `09-marketplace-phase-4-5-readiness.md` - Store Owner console completion state and Phase 5 consumer discovery starting points.
8. `10-marketplace-phase-6-and-9-readiness.md` - completed Phase 6 commerce boundary, deferred Phases 7/8, and the active Phase 9 planning seam.
9. `06-testing-verification-map.md` - Jest, Playwright, commands, mocks, and focused test patterns.
10. `07-augment-query-log.md` - the targeted Augment questions used to create and refresh this pack.

## How To Use This Pack

- Use it before broad codebase exploration.
- Use exact file paths here as starting points, then verify current code before editing.
- If Augment/codebase-retrieval is still available, use it to refresh or deepen sections before major feature work.
- If Augment is no longer available, use this pack with `rg`, docs, and local file reads.
- Update this folder whenever a feature changes ownership, routing, Supabase contracts, or testing patterns.

## Scope

This is not a full source dump. The repo itself is the source dump. This folder captures semantic orientation:

- where concepts live
- what files usually change together
- what existing patterns are safe to reuse
- what old patterns are forbidden or risky
- which docs are live truth versus historical context

## Important Current Status

- Current app is an Expo Router app with `(auth)` and `(tabs)` route groups.
- Current consumer tabs are Library, Exchange, Clubs, and Profile.
- Store Owner route group exists at `app/(store-owner)` with gate, onboarding, status, setup, dashboard, inventory, storefront, and subscription routes.
- Phase 1 marketplace foundation, Phase 2A hardening, Phase 2B application metadata, and Phase 2C review metadata migrations are present locally and applied live.
- Phase 2 Store Onboarding and Verification is implemented/deployed through Phase 2C, with authenticated platform-review smoke intentionally skipped/pending.
- Phase 3 Inventory, Canonical Books, and Listings is implemented and live. The least-privilege anonymous/authenticated policy split and the Phase 5 projection correction are live; public discovery smoke passed.
- Phase 4 Store Owner Console is locally complete and its controlled profile/setup hardening is deployed.
- Phase 5 Consumer Discovery is complete and accepted. Public title/author/ISBN/store/profile/detail/grouping/offer flows and private-boundary denials passed live verification.
- Phase 6 Order Request and Confirmation is complete through provider-independent `payment_ready`; all M01-M39 migrations are applied in development. Comprehensive browser E2E, responsive/accessibility review, browser-created persisted-effect review, and real timed commerce-command E2E are deferred.
- `commerce-scheduler` v5 and `commerce-task-worker` v3 are active in development; cron job 5 runs every minute and recent queried runs succeeded.
- Phases 7 Payment/Ledger and 8 Pickup Fulfillment are deferred by product decision. Their DOC-14/DOC-15 guards remain authoritative.
- Phase 9 Image-to-LLM Inventory is the active planning milestone. Start with `single_cover`, mandatory Owner review, controlled server-side inventory writes, quota/cost/privacy controls, and manual fallback.
- P2P exchange tables/services are not bookstore commerce primitives.

## Maintenance Rule

When a session changes architecture, routes, Supabase contracts, tests, or marketplace implementation status, update the relevant file in this folder before finishing.
