# 03 — Backend: Supabase, Edge Functions and Workers

**Last checked:** 2026-10-18, against the code and the documents it cites.

There is **one** development Supabase project, shared by every checkout and
branch: `ahntbtktjjmvfosgkmgn`. Read 07 before any migration work.

## Supabase client

`src/lib/supabase.ts` creates the only app client:

- uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key only);
- persists the session through `src/lib/storage.ts` (AsyncStorage) under the
  derived key from `authStorage.ts`;
- `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`,
  no-op local lock;
- in dev auth bypass only, placeholder URL/key let the UI render without env vars.

The Jest mock for `@/lib/supabase` is `src/lib/__mocks__/supabase.ts` (auth,
query builder chains, `rpc`, `functions.invoke`, realtime `channel`). Add
missing methods there when a new test needs them.

## How the app talks to the backend

| Pattern | Used by |
| --- | --- |
| Direct table reads through RLS | Older features (library, exchange, clubs, notifications), public marketplace projections, and the Store Owner gate, dashboard, subscription and store profile reads (`src/features/stores/services/`) |
| RPCs (`supabase.rpc`) | Clubs commands, Phase 6 commerce commands and safe reads, public discovery, and one Phase 9 exception: `ownerCorrectionService.ts` (add a manual candidate) |
| Edge Function `phase9-owner-ingestion` | Most Phase 9 Owner actions (scan sessions, review, Add to Inventory, edition picker, publication) and all Store View management, called from `src/features/imageInventory/api/*` and `src/features/storeView/api/*` |
| Direct Storage upload | The client uploads scan images straight to Storage with a signed upload URL issued by the function (`capture/uploadTransport.ts`). On upload completion the function downloads the object once, checks its size and records its SHA-256 hash; the media worker later checks the stored bytes against that hash. |
| Realtime (`supabase.channel`) | Credit balance and credit events (`src/features/credits/services/creditService.ts`) and the commerce notification inbox (`notificationsService.ts`) |
| Edge Functions `store-application`, `store-profile` | Store onboarding and store profile updates. `store-review` (platform review) has no in-app caller; review happens outside the app. |

Inside the Edge Function, `_shared/imageInventory/runtime/ownerIngestion.ts`
dispatches each request. Batch review, Store View and publication requests have
their own branches there; the standard Owner UX actions map to SQL RPCs in
`_shared/imageInventory/runtime/ownerUxRpcRoutes.ts` (for example
`add_candidate_to_inventory` → `phase9_add_candidate_to_inventory_v1`). Start at
`ownerIngestion.ts` to find which RPC, and so which migration, serves an action.

## Edge Functions (`supabase/functions/`)

JWT column: only `send-notification`, `commerce-scheduler`,
`commerce-task-worker` and `phase9-owner-ingestion` are declared in
`supabase/config.toml`; the rest use the platform default (`verify_jwt = true`).
Check the deployed setting with Supabase MCP before relying on it. Handler-level
checks are separate from the gateway setting.

| Function | Purpose | JWT |
| --- | --- | --- |
| `phase9-owner-ingestion` | The Phase 9 "Owner API". Authenticates the user, then `_shared/imageInventory/runtime/ownerIngestion.ts` dispatches each versioned request contract. | required |
| `store-application` | Store application and verification-document metadata (service role behind auth) | default |
| `store-review` | Platform review decisions; caller must hold `platform_admin` or `store_reviewer` in `platform_user_roles` | default |
| `store-profile` | Owner storefront/profile updates | default |
| `commerce-scheduler` | Phase 6 timed-deadline scheduler, invoked by cron with its own secret | **not** JWT (`verify_jwt = false`) |
| `commerce-task-worker` | Phase 6 task execution; service-role authorization | required |
| `send-notification` | Push delivery for legacy (non-marketplace) notifications; commerce notifications are delivered by `commerce-task-worker` | required |
| `wishlist-notify` | Queues wishlist-match notification deliveries (RPC `notify_wishlist_matches`); the handler also requires the `x-cron-secret` header (`WISHLIST_NOTIFY_CRON_SECRET`) | default |
| `check-membership-limits` | Clubs entitlements | default |
| `handle-club-downgrade-grace-period` | Clubs downgrade grace period; the handler requires `x-cron-secret` (`CLUB_DOWNGRADE_CRON_SECRET`) | default |
| `complete-transaction`, `transfer-credits` | P2P exchange (not bookstore commerce) | default |

Shared server code:

- `_shared/marketplaceAuth.ts` — `requireAuthenticatedUser`, `requireStoreAdmin`,
  `requirePlatformRole`, `sanitizeSupabaseError`.
- `_shared/serviceRoleAuthorization.ts` — service-role caller check. Use it only
  behind gateway JWT verification: its fallback decodes the role claim without
  verifying the signature.
- `_shared/imageInventory/` — the Phase 9 server package, also imported by the
  workers. Its own `README.md` is historical (it describes the early pure-contract
  package); start from `runtime/ownerIngestion.ts` and the worker entry points instead.
  - `contracts/` versioned request/response contracts (owner UX, batch review,
    edition picker, publication, Store View, vision, metadata);
  - `domain/` pure policy (ISBN, validation, vision policy);
  - `analysis/` Gemini vision adapter and fixture analyzer;
  - `metadata/` local resolution, Google Books, Open Library, routing, cache;
  - `media/` image processing;
  - `searchVariants/` multilingual search variants;
  - `runtime/` request dispatch, gateways and worker logic.

Deployed versions change often; check them with Supabase MCP, not this file.

## Phase 9 workers (`workers/`)

Long-running jobs (image processing, AI vision, book metadata lookup,
publication retries) do not run in Edge Functions. They run as separate Node
services, each with a `Dockerfile`, `server.ts` (`GET /health`, `GET /ready`,
authenticated `POST /run`) and `bootstrap.ts`. Where each worker is deployed is
recorded in the Phase 9 tracker, not here.

**What wakes them:** a Postgres cron dispatcher (`pg_net`) POSTs `/run` to each
stage that has due jobs. It was added in Phase 9 M36
(`20260810000036_marketplace_phase9_worker_wake_dispatcher.sql`) and extended in
M40 and M56; design in
`docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/automatic-worker-wake-dispatcher-sdd.md`.
`npm run invoke:phase9:worker -- <media|vision|metadata|publication>` is the
manual equivalent; it reads `PHASE9_<SERVICE>_WORKER_URL` and
`PHASE9_<SERVICE>_WORKER_INGRESS_TOKEN` and processes real queued jobs.

| Worker | Job |
| --- | --- |
| `phase9-media-validation-worker` | Validate, re-encode and strip uploaded images (ImageMagick WASM); also runs media-output cleanup (`runtime/mediaOutputCleanup.ts`), which removes abandoned Storage objects |
| `phase9-vision-analysis-worker` | Read book spines from images (Gemini, or recorded fixtures) |
| `phase9-metadata-worker` | Automatic enrichment uses Google Books. Open Library is used only for explicit Owner edition searches (`edition_options` jobs for the edition picker); its adapter rejects automatic lookup |
| `phase9-publication-worker` | Retry public listing publication |
| `phase9-runtime` | Shared environment, HTTP and request-security helpers |

Workers claim database jobs with leases and attempt numbers; that, not process
memory, decides who may write. They use a server-only service-role key plus a
worker-specific ingress secret. Never put those secrets in `.env`, logs or docs.

Build/run: `npm run build:phase9:<media|vision|metadata|publication>-worker`
then `npm run start:phase9:<same>-worker`. Helpers: `npm run invoke:phase9:worker`,
`smoke:phase9:worker-entrypoints`, `smoke:phase9:worker-containers`,
`validate:phase9:deployment-runtime`.

## Migrations (`supabase/migrations/`)

- Files are named `<timestamp>_<name>.sql`. Marketplace files often use a
  sequence-style timestamp (for example `20260812000039_…`), and docs refer to
  them by that sequence as **M39**.
- **M-numbers are per phase.** Phase 6 has M01–M39 (`20260716000001…000039`)
  and Phase 9 has its own M01 onward (Phase 9 M39 is
  `20260812000039_…create_only_inventory_commit.sql`). Always name the phase,
  e.g. "Phase 9 M39".
- **Do not infer the live version from the file name.** Sequence-style files
  (most marketplace migrations) get a different apply-time version when applied;
  other files (for example some Clubs migrations) were named to match their
  applied version. Phase 9 records
  each mapping in the migration ledger of the tracker that applied it, summarised
  in `docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/supporting/database-current-vs-target.md`.
- Applied migrations are never edited. Corrections are new, additive migrations.
- Static tests for migrations live in `supabase/migrations/__tests__/`.
- Library organising SQL files are
  `supabase/migrations/20261023190000_library_book_labels.sql` (label and
  book-label tables) and
  `supabase/migrations/20261023190100_library_note_collections.sql`
  (collection/item tables and the composite owner key on `reading_notes`).
- `LIVE_MIGRATION_HISTORY_2026-03-06.md` is a historical snapshot only.

## Storage buckets

Verify the current list with `select id, public from storage.buckets` through
Supabase MCP.

| Bucket | Access | Use |
| --- | --- | --- |
| `seller-verification-docs` | private | Store verification documents |
| `marketplace-media-staging` | private | Raw Phase 9 Owner uploads (scan and public-copy photos) before media validation |
| `image-extraction-inputs` | private | Server-side copies made during media validation: snapshots of the original scan and public-copy uploads, plus the sanitised scan images the vision worker reads |
| `order-request-photos` | private | Customer current-copy photo requests |
| `order-dispute-evidence` | private | Dispute evidence |
| `inventory-photos` | public | Approved public inventory photos |
| `storefront-assets` | public | Storefront images |
| `listing-photos` | public | P2P exchange listing photos |
| `profile-avatars` | public | User avatars |
| `club-banners` | public | Club banners |

Older docs may say `store_verification-docs`; the real bucket is
`seller-verification-docs`.

## Security patterns to keep

- The app uses the anon key only. Service-role work lives in Edge Functions or workers.
- Store authority comes from server-side lookups (`store_administrators`,
  capability helpers), never from request bodies or route params.
- Marketplace RLS uses explicit store tenant boundaries; avoid broad
  `SECURITY DEFINER` functions and broad storage listing, which exist in older parts of the schema.
- Do not "fix" advisor warnings (for example `spatial_ref_sys` without RLS, or
  service-role-only registries) without a scoped review.
