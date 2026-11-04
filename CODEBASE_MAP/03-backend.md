# 03 — Backend: Supabase, Edge Functions and Workers

**Last checked:** 2026-10-24, against the code and the documents it cites.

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
| Realtime (`supabase.channel`) | `credit_balance:<userId>` and `credit_events:<userId>` (`src/features/credits/services/creditService.ts`); `commerce-inbox:<userId>` (`src/features/notifications/services/notificationsService.ts`) |
| Edge Functions `store-application`, `store-profile` | Store onboarding and store profile updates. `store-review` (platform review) has no in-app caller; review happens outside the app. |
| Edge Function `ocr-fallback` | Library page-text recognition through `src/features/books/services/ocrService.ts`, after explicit upload consent; separate from Phase 9 spine analysis |

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
| `send-notification` | Push delivery for legacy (non-marketplace) notifications; optionally checks `x-cron-secret` when `SEND_NOTIFICATION_CRON_SECRET` is configured; commerce notifications are delivered by `commerce-task-worker` | required |
| `ocr-fallback` | Library cloud page OCR; authenticates the user and requires a durable quota adapter. The checked-in entry point supplies none, so valid authenticated requests return `CLOUD_DISABLED`. | default |
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
M40, M56 and M69; M96 makes it first run
`phase9_sweep_exhausted_metadata_jobs_v1`, which dead-letters exhausted
metadata jobs that hold nothing (also callable by service_role); design in
`docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/automatic-worker-wake-dispatcher-sdd.md`.
`npm run invoke:phase9:worker -- <media|vision|metadata|publication>` is the
manual equivalent; it reads `PHASE9_<SERVICE>_WORKER_URL` and
`PHASE9_<SERVICE>_WORKER_INGRESS_TOKEN` and processes real queued jobs.

| Worker | Job |
| --- | --- |
| `phase9-media-validation-worker` | Validate, re-encode and strip uploaded images (ImageMagick WASM); also runs media-output cleanup (`runtime/mediaOutputCleanup.ts`), which removes abandoned Storage objects |
| `phase9-vision-analysis-worker` | Read book spines from images (Gemini, or recorded fixtures) |
| `phase9-metadata-worker` | Automatic enrichment uses Google Books as primary. Open Library 1.0.0 serves explicit Owner edition searches (`edition_options` jobs for the edition picker); Open Library 2.0.0 can also run automatic lookup, but only when its registry row names it automatic primary and carries a protection policy |
| `phase9-publication-worker` | Retry public listing publication |
| `phase9-runtime` | Shared environment, HTTP and request-security helpers |

### Metadata routing and persistence

Paths below are relative to `supabase/functions/_shared/imageInventory/` unless noted.

- **Worker entry:** `workers/phase9-metadata-worker/index.ts` — claims jobs, loads fenced context and dispatches by purpose; `bootstrap.ts` installs adapters, the installed-descriptor manifest (`createInstalledDescriptorManifest`) and the SQL boundary. `getWorkerProtectionState` holds the process-local pacing/breaker state per provider.
- **Provider choice:** `metadata/providerDescriptor.ts` defines provider descriptors, the strict result v2 and `resolveProviderRoute`; `workers/phase9-metadata-worker/editionProviderRoute.ts` applies it from the registry snapshot, installed descriptors and resumed lineage (for automatic jobs, the lineage read from the automatic fence).
- **Adapters:** `metadata/googleBooks/` and `metadata/openLibrary/` — bounded HTTP, decoding and normalization behind the shared contract.
- **Provider HTTP and protection:** `metadata/providerHttp.ts` (`createProviderHttpPort`) registers and fences every fan-out GET; `runtime/providerProtection.ts` supplies the start permit (pacing), the circuit breaker and `isBreakerFailure` (which outcomes count as breaker failures; a 429 never does). Order: permit → breaker → register/fence → GET.
- **Shared contract:** `metadata/providerAdapter.ts` validates provider-neutral outcomes; `routing.ts` defines sequential primary/secondary routing; `queryIdentity.ts` builds normalized query and provider-cache identities.
- **Automatic enrichment:** `runtime/metadataProductionComposition.ts` resolves local first, then hands automatic jobs to `runtime/metadataAutomaticExecution.ts`: recover a saved receipt → cache → SQL prepare (admission and coalescing) → permit/breaker → lookup, reservation and attempt → provider call → SQL run finish (retry decision) → one atomic completion command. Helpers: `metadataAutomaticEditionFence.ts` (fence read and RPC error class), `metadataAutomaticPreparation.ts`, `metadataAutomaticCompletion.ts` (command, receipt, recovery). `metadataProductionGateway.ts` supplies RPCs. `workers/phase9-metadata-worker/legacyAutomaticRetry.ts` reads the original receipt for the single bounded NULL-policy legacy resume.
- **Explicit edition options:** `runtime/metadataEditionOptions.ts` — recover saved completion → try edition-list cache → on miss reserve usage and call the routed provider → complete options. It never selects an edition for the Owner.
- **SQL boundary:** `runtime/metadataEditionOptionsBoundary.ts` defines the worker port; `metadataEditionOptionsRpc.ts` transports recovery, cache reuse, companion-aware completion and failure.
- **Catalogue companions:** `contracts/catalogueWrite.ts` validates separate provider facts; `metadata/openLibrary/catalogueWrite.ts` extracts them beside option rows. SQL completion owns catalogue writes and cache publication.
- **Provider registry:** `public.phase9_provider_registry` — enablement, adapter identity, matching/storage/display permissions, explicit and automatic roles, protection policy (pacing/breaker numbers; NULL keeps the legacy path), retention and source notes; checked by job context and SQL admission. It does not install adapters or replace bootstrap wiring.

| RPC family | Used for |
| --- | --- |
| `phase9_owner_*`, `phase9_update_candidate_review*`, `phase9_add_candidate_to_inventory*` | Authenticated Owner reads, review saves and create-only Add; routed by `runtime/ownerUxRpcRoutes.ts` and `ownerBatchReviewIngestion.ts` |
| `phase9_owner_candidate_edition_choices*`, `phase9_request_candidate_edition_options*`, `phase9_set_candidate_isbn*`, `phase9_select_candidate_edition*` | Read choices, request search, save typed ISBN and confirm selection; `runtime/ownerEditionPickerGateway.ts` |
| `claim_phase9_metadata_jobs`, `phase9_metadata_job_context*`, `phase9_register_*`, `phase9_reserve_metadata_usage`, `phase9_finalize_*` | Worker claims, authority, logical lookups/attempts, reservations and physical-call accounting |
| `phase9_*local_metadata_match`, `phase9_*metadata_cache*`, `phase9_select_structural_metadata_snapshot` | Automatic local/cache reuse and accepted metadata snapshots |
| `phase9_automatic_edition_fence_v1`, `phase9_prepare_automatic_metadata_v1`, `phase9_begin_automatic_provider_run_v1`, `phase9_finish_automatic_provider_run_v1`, `phase9_schedule_automatic_provider_recheck_v1`, `phase9_complete_automatic_metadata_v1`, `phase9_recover_automatic_metadata_v1` | Automatic path: fence read, admission/coalescing, provider-run rounds and retry, atomic completion and receipt recovery (fence and prepare come from migration `20261104000094`) |
| `phase9_sweep_exhausted_metadata_jobs_v1` | Service-only bounded close of exhausted metadata jobs holding no reservation, run, admission or unknown call (M96); also run first by the wake dispatcher |
| `phase9_recover_candidate_edition_options*`, `phase9_reuse_candidate_edition_cache*`, `phase9_complete_candidate_edition_options*`, `phase9_fail_candidate_edition_options*` | Service-only explicit-search recovery, edition-list reuse, atomic completion and failure |
| `marketplace_sec.phase9_catalogue_*`, `marketplace_sec.phase9_edition_*` | Private SQL helpers for admission, identity, Add linkage, selection effects, statistics, cache scope/payload and receipts; reached through controlled RPCs |

- **Shared tables:** `canonical_works`, `canonical_editions`, `book_metadata_sources`, `canonical_provider_ids`, `canonical_work_stats`, `canonical_edition_stats` — facts, provider cross-references and popularity.
- **Private persistence:** `marketplace_sec` holds companions/effect receipts; `phase9_metadata_cache_entries` holds scoped edition lists.
  The automatic SQL boundary exposes service-only
  `phase9_complete_automatic_metadata_v1`
  and `phase9_recover_automatic_metadata_v1`; private automatic receipts bind the
  selected option to its original companion for subsequent Add. A coherent
  fan-out winner requires its exact retained row and companion; single-call
  receipts can bind a selected snapshot without a retained list. Cached selected
  snapshots resolve the companion through the proved leader lineage. Explicit
  completion intersects its deadline with current provider retention and rechecks
  wall-clock expiry after lock waits and before returning. Contract:
  [provider SDD §4.3](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02c-slice8-open-library-first-sdd.md#43-automatic-completion-fairness-and-protection-prerequisites).
- **SQL definitions:** `supabase/migrations/` — catalogue and RPC forward replacements; design in [catalogue SDD §§3–10](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md#3-companion-contract-and-transport-d35d37-r06r09), guardrails in [05](./05-marketplace-rules.md#phase-9-catalogue-and-reuse).

Workers claim database jobs with leases and attempt numbers; that, not process
memory, decides who may write. They use a server-only service-role key plus a
worker-specific ingress secret. Never put those secrets in `.env`, logs or docs.

Build/run: `npm run build:phase9:<media|vision|metadata|publication>-worker`
then `npm run start:phase9:<same>-worker`. Helpers: `npm run invoke:phase9:worker`,
`smoke:phase9:worker-entrypoints`, `smoke:phase9:worker-containers`,
`validate:phase9:deployment-runtime`.

## Migrations (`supabase/migrations/`)

The provider queue/protection boundary uses service-only
`phase9_claim_metadata_jobs_v2`, `phase9_defer_metadata_admission_v1`,
`phase9_begin_automatic_provider_run_v1` / `phase9_finish_automatic_provider_run_v1`,
`phase9_reserve_round_capacity_v1`, `phase9_assert_queue_grant_v1` and
`phase9_provider_run_grant_v1`. Private `phase9_store_admission` holds store tickets/capacity windows,
`phase9_job_admission_wait` holds blocked gate epochs, and
`phase9_automatic_provider_runs` binds the one next-claim retry to its original
lookup/primary attempt. `phase9_metadata_admissions` records v2 claims and whole
round capacity holds before egress; an admissions marker counts only when its
claim tuple matches the job's current claim. The shared read-only helper
`phase9_reserved_store_holds_v1` counts reserved store holds for the slot, wake
and reserve due-time calculations. Explicit reserve/release entries use the
same accounting; breaker-recheck scheduling persists the one unsent allowance.
A physical-call INSERT guard rechecks the full request/claim fence and counts
configured capacity once per new grant. Existing claim entry points
remain separate. Worker pacing and circuit state use the approved single-instance
model. Contract: provider SDD §§4.3–4.4 and switch runbook §2.

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

Older docs may say `store_verification-docs`; the foundation Storage migration
(`20260619000004_marketplace_foundation_storage.sql`) names it
`seller-verification-docs`.

## Security patterns to keep

- The app uses the anon key only. Service-role work lives in Edge Functions or workers.
- Store authority comes from server-side lookups (`store_administrators`,
  capability helpers), never from request bodies or route params.
- Marketplace RLS uses explicit store tenant boundaries; avoid broad
  `SECURITY DEFINER` functions and broad storage listing, which exist in older parts of the schema.
- Do not "fix" advisor warnings (for example `spatial_ref_sys` without RLS, or
  service-role-only registries) without a scoped review.
