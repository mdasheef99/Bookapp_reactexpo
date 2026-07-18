# 07 - Augment Query Log

This file records the focused Augment/codebase-retrieval prompts used to create the intelligence pack. If Augment access is still available, rerun or adapt these prompts to refresh the pack.

## Query 1 - High-Level Orientation

Prompt:

```text
Map the current BookConnect Expo codebase at a high level for future knowledge preservation. Identify major app architecture areas, routing, authentication/session handling, Supabase integration, feature modules, tests, documentation, and marketplace/store development touchpoints. Return file paths and concise descriptions; do not modify anything.
```

Useful findings:

- app uses Expo Router with root auth guard in `app/_layout.tsx`
- auth flow lives under `app/(auth)`
- signed-in consumer flow lives under `app/(tabs)`
- profile is the future signed-in Store Owner entry point
- Supabase client is `src/lib/supabase.ts`
- auth session hook is `src/features/auth/hooks/useAuth.ts`
- marketplace docs live under `docs/multi-tenant-bookstore-marketplace`

## Query 2 - App Architecture And Navigation

Prompt:

```text
For a durable codebase intelligence pack, map the Expo Router app architecture and startup/navigation flow. Identify root layouts, auth redirects, route groups, tab structure, key providers, styling/theme/background setup, and any dev bypass behavior. Include exact file paths and concise notes.
```

Useful findings:

- `app/_layout.tsx` wraps Sentry, gesture handler, safe area, React Query, atmospheric background, and auth routing
- `app/index.tsx` redirects authenticated users to library and guests to login
- `app/(tabs)/_layout.tsx` defines Library, Exchange, Clubs, Profile tabs plus hidden routes
- `EXPO_PUBLIC_DEV_SKIP_AUTH=true` affects routing and must not validate authorization

## Query 3 - Supabase Integration

Prompt:

```text
For a durable codebase intelligence pack, map Supabase integration in this repo. Identify the Supabase client, auth service, feature services/hooks that query Supabase, storage upload patterns, Edge Functions, migrations, generated/manual types if any, test mocks, and known RLS/security caveats. Include exact file paths and concise notes.
```

Useful findings:

- `src/lib/supabase.ts` creates the client with MMKV auth persistence
- `src/lib/__mocks__/supabase.ts` is the core Jest mock
- recent marketplace migrations are present under `supabase/migrations/2026061900000*.sql`
- historical docs mention functions that must be verified against actual folders/live deployment
- live-truth docs and Supabase checks matter for RLS/security

## Query 4 - Feature Modules

Prompt:

```text
For a durable codebase intelligence pack, map the major feature modules and reusable patterns. Cover library/books, exchange/P2P, clubs, venues, notifications, profile/account, addresses/credits. Identify screens, services, hooks, key tests, and what each feature owns. Include exact file paths and concise notes.
```

Useful findings:

- library owns `books`, `user_books`, search/manual entry, notes
- exchange owns P2P listings/transactions/credits and must not become bookstore commerce
- clubs provides the strongest example of complex feature decomposition
- notifications have reusable service/hook/function patterns
- profile is the correct existing signed-in account entry point

## Query 5 - Tests And Marketplace Phase 2

Prompt:

```text
For a durable codebase intelligence pack, map tests and marketplace Phase 2 readiness. Identify Jest/config/test helpers, common test commands, representative tests for auth/clubs/exchange/Supabase services, marketplace Phase 2 entry points, documents to read before Store Owner onboarding, reusable code patterns, and forbidden reuse boundaries. Include exact file paths and concise notes.
```

Useful findings:

- Jest uses `jest-expo` and `jest.setup.ts`
- `--runInBand` and `--runTestsByPath` are useful for focused runs
- marketplace Phase 2 should start from Login/Profile entry points and auth redirect handling
- Store Owner onboarding must not reuse P2P commerce tables or states
- document upload should target the private `seller-verification-docs` bucket

## Refresh Guidance

Before major work, ask Augment:

```text
What has changed since CODEBASE_INTELLIGENCE was created for [area]? Identify files whose current code differs from the assumptions in the pack and summarize what should be updated.
```

## Phase 3 Refresh Prompt

This prompt is historical; Phase 3 is implemented and live.

Before starting Phase 3, ask codebase-retrieval:

```text
Refresh BookConnect marketplace Phase 3 context. Locate current Store Owner routes/screens/services/hooks/tests, Phase 2 Edge Functions and auth helpers, existing book/library metadata services, P2P exchange listing code that must not be reused directly, Supabase migration/RLS test patterns, and any existing inventory/listing/table references. Summarize exact file paths, reusable patterns, and forbidden reuse boundaries for implementing manual store inventory and public marketplace listing projection.

## Phase 9 Refresh Prompt

Before implementing Phase 9, ask codebase retrieval or perform the equivalent targeted `rg` audit:

```text
Refresh BookConnect Phase 9 image-to-LLM inventory context from the completed Phase 6 baseline.
Locate the Store Owner inventory routes/screens/components/services, controlled inventory mutation
boundary, quantity bucket and active-hold invariants, canonical edition/source matching, public
listing projection, private storage patterns, quota/usage counters, logout/session cleanup,
Edge Function authorization patterns, reconciliation/observability hooks, and relevant tests.
Identify exact files to reuse, files near the 300-350 line limit, prohibited direct table writes,
and every boundary that prevents OCR/LLM output from publishing without Owner review. Treat
Phases 7 and 8 as deferred and exclude payment, paid-order, pickup, ledger, refund, and settlement.
```
```
