# Phase 9 Package 1: Proposed Database, RLS, Function, Index, and Storage Design

**Status:** `independently_approved`
**Date:** 2026-07-22
**Authority:** approved Phase 9 SDDs, WU0A contracts/tests, WU0/WU0B design, and fresh live audit
**DDL status:** proposal only; no migration file created or applied

## 1. Design rules

- Use `store_id uuid` for every store-owned row and derive it server-side (MAS-03, MED-01).
- Keep canonical truth global; aliases are search-only; uncertain inventory may retain null canonical links (DAT-01–DAT-14).
- Keep private commit and public projection separate (MAS-07/11, REV-18).
- Preserve Phase 6 quantity buckets/holds and the provider-independent `payment_ready` ceiling (REV-13, PHO-04–PHO-13).
- Use blank pinned `search_path`, schema-qualified references, revoked `PUBLIC` function EXECUTE, and explicit role grants (MED-20/21).

## 2. Exact proposed schema

The following names were collision-checked against the live project.

### M01 catalogue, registry, aliases, and additive snapshots

`phase9_provider_registry`: `adapter_key text PK`, `provider_kind text CHECK (vision|metadata|alias)`, `adapter_version text`, `enabled boolean`, `matching_allowed boolean`, `storage_allowed boolean`, `public_display_allowed boolean`, `image_cache_allowed boolean`, `attribution_required boolean`, `revalidation_seconds integer null`, `raw_retention_seconds integer`, `policy_version integer`, `created_at/updated_at timestamptz`. Service-only.

`canonical_editions` additions: `description text`, `edition_statement text`, `volume text`, `format text`, `metadata_verified_at timestamptz`, `metadata_selection_version text`.

`book_metadata_sources` additions: `adapter_key text FK phase9_provider_registry`, `adapter_version text`, `schema_version text`, `request_status text`, `match_strength numeric`, `match_rationale text`, `reuse_policy_version integer`, `expires_at timestamptz`, `raw_delete_after timestamptz`. Drop the provider CHECK only after `provider -> adapter_key` backfill/reconciliation; retain legacy `provider` during compatibility.

`book_search_aliases`: `id uuid PK`, `store_id uuid null FK stores`, `canonical_edition_id uuid null FK canonical_editions`, `inventory_id uuid null FK store_inventory`, `alias_text text`, `alias_normalized text`, `alias_language text`, `alias_script text null`, `alias_type text CHECK (transliteration|translation|common_spelling|recognized_title)`, `source_type text CHECK (automated|provider_official|owner_verified|platform_verified)`, `source_ref text`, `confidence numeric null CHECK 0..1`, `approval_status text CHECK (proposed|approved|rejected)`, `created_by uuid null`, `approved_by uuid null`, `approved_at timestamptz null`, `rejection_reason text null`, `created_at/updated_at timestamptz`. CHECK exactly one target; inventory target requires matching non-null `store_id`; canonical target requires null `store_id`.

`store_inventory` additions: `language text`, `description text`, `edition_statement text`, `volume text`, `format text`, `has_damage boolean default false`, `damage_notes text`, `damage_types text[] default '{}'`, `is_sellable boolean default true`, `last_verified_at timestamptz`, `acquisition_type text`, `cost_basis_method text`, `printed_mrp_minor integer`, `metadata_snapshot_version text`, `created_from_candidate_id uuid`, `publication_status text CHECK (private|publication_pending|published|publication_failed) default private`, `publication_intent_version integer default 1`, `version integer default 1`. Keep `photos` during compatibility.

`marketplace_book_listings` additions: `language text`, `public_description text`, `edition_statement text`, `volume text`, `format text`, `has_damage boolean default false`, `public_damage_notes text`, `damage_types text[] default '{}'`, `primary_public_media_id uuid null`, `public_media_count smallint default 0 CHECK 0..3`, `last_inventory_verified_bucket text`, `search_document tsvector`.

### M02 extraction and operational persistence

`image_extraction_sessions`: IDs/scope (`id`, `store_id`, `created_by`); status `active|closing|closed|expired`; selected language/script; defaults for condition/location/quantity/publication; summary counters; quota/orchestration/prompt/model/provider versions; `version`; start/close/expiry timestamps. Unique partial index allows only policy-permitted active initiating-Owner session scope.

`image_extraction_inputs`: `id`, `session_id`, `store_id`, `media_asset_id`, `source_kind camera|gallery`, exact input states from Master §6, SHA-256, quality result/reason, detected candidate count, adapter/orchestration version, `version`, processed/delete/deleted timestamps. Unique replay key on `(store_id, sha256, orchestration_version)` where reusable.

`image_extraction_candidates`: `id`, session/input/store links, stable candidate index, optional bounded geometry JSONB, observed title/authors/ISBN clue/language/script/confidence, selected snapshot JSONB, nullable canonical link and deferred `metadata_attempt_id`, Owner review snapshot JSONB, duplicate/publication decisions, exact candidate status from Master §6, `version`, committed inventory/listing IDs, commit idempotency identity, expiry timestamps. Unique `(input_id, candidate_index)` and unique non-null committed inventory linkage. Create candidates before attempts; add the candidate-to-attempt FK later in M02 after attempts exist.

`metadata_enrichment_attempts`: `candidate_id FK image_extraction_candidates` plus store/adapter links; sequence/query kind; normalized request clues; status/provider record/match/latency/cache; adapter/schema/normalizer/reuse versions; bounded raw/normalized payload; delete/expiry timestamps. Service-only. After creating this relation, add `image_extraction_candidates.metadata_attempt_id -> metadata_enrichment_attempts(id)` in M02.

`image_extraction_jobs`: `id`, `store_id`, entity type/id, job kind, `status open|in_progress|retry_scheduled|resolved|resolved_noop|cancelled|dead_letter`, `attempt_count default 0`, `max_attempts default 5 CHECK 1..5`, `next_attempt_at`, `lease_owner`, `lease_expires_at`, `dedupe_key`, adapter/operation versions, last safe error code/category, correlation ID, completed/dead-letter timestamps. Dedicated table; reuse Phase 6 claim mechanics without commerce request provenance/vocabulary.

`phase9_upload_capabilities`: `id uuid PK`, server-derived `store_id uuid NOT NULL FK stores`, `issued_to_user_id uuid NOT NULL`, `initiating_owner_user_id uuid NOT NULL`, `purpose text CHECK (scan_input|customer_request|public_copy)`, `bound_entity_type text`, `bound_entity_id uuid`, `bound_session_id uuid null FK image_extraction_sessions`, `bound_ordinal smallint`, `bucket_id text`, `object_path text`, `envelope_sha256 text`, `nonce_hash text`, `status text CHECK (issued|consumed|revoked|failed|expired)`, `issued_at`, `expires_at`, `consumed_at`, `revoked_at`, `failed_at`, `failure_code`, `consumed_media_asset_id uuid null`, `version`, `created_at/updated_at`. Unique `(bucket_id, object_path)` and `(store_id, nonce_hash)`; CHECK timestamp/state coherence. The issuing command derives store and actor from the target relation and current Owner membership, fixes purpose/entity/path/envelope, and stores only a nonce hash. Consumption locks the row, verifies actor/store/purpose/entity/path/envelope/expiry/status, transitions `issued -> consumed` atomically with the accepting/linking transaction, and denies every replay. Revocation or terminal validation/upload failure records `revoked|failed`; expiry is explicit and cleanup is idempotent. Service-only base table.

`phase9_usage_reservations`: `id`, `store_id`, `job_id FK image_extraction_jobs`, `cost_kind`, `policy_version`, operation/adapter/version, idempotency identity, reserved/actual cost units, status `reserved|consumed|released`, timestamps; unique constraint `(store_id, job_id, cost_kind, policy_version)`. Service-only; reservation insertion uses the unique key as the concurrency/idempotency arbiter.

`phase9_idempotency_keys`: actor/service identity, operation, key, request fingerprint, target IDs, `status in_progress|completed|failed_terminal`, canonical response/error, surviving-effect classification, expiry/timestamps; unique `(actor_or_service, operation, idempotency_key)`. Service-only.

### M03 typed media registry

`media_assets`: `id`, `store_id`, `uploaded_by`, `purpose scan_input|public_copy|customer_request|dispute_evidence`, matching privacy class, bucket/path, SHA-256, detected MIME, bytes, width/height, validation/re-encode/EXIF versions and timestamps, `source_media_asset_id` self-FK, `session_id FK image_extraction_sessions`, deferred `request_photo_request_id`, retention class, lifecycle status, delete-after/deleted-at, hold type/reason/authority/timestamps, `version`, created/updated timestamps. Unique `(bucket_id, object_path)` and purpose/privacy CHECK. Add `request_photo_request_id -> order_request_photo_requests(id)` only in M08.

`inventory_media_links`: `id`, `store_id`, `inventory_id`, `media_asset_id`, role `damage|actual_copy|primary_fallback`, public order 1–3, approval status/actor/time, created_at. Unique inventory/media and unique public order per inventory; FK/trigger guard matching store and public-copy purpose.

`media_lifecycle_attempts`: asset/store, attempt/lease, action, safe outcome/error, object result, correlation/timestamps. Service-only append-only evidence.

### M04 condition and damage transition

Execute one compatibility-first transaction after a fresh value-count preflight:

1. Stop on every `damaged` row until its base condition is explicitly adjudicated and its damage is preserved in `has_damage`, `damage_types`, `damage_notes` and, where required, damage media. `damage` is never a condition value in the target.
2. Replace the legacy inventory and listing condition CHECKs with temporary compatibility CHECKs accepting the union `new|like_new|very_good|good|fair|acceptable|damaged`; install them before writing `acceptable`.
3. Replace or update `sync_marketplace_listing_from_inventory()` and every trigger/helper that validates or copies the legacy vocabulary so `acceptable` and `very_good` are accepted and damage remains separate.
4. Backfill compatible `fair -> acceptable`, set coherent non-damage defaults, and resynchronize affected listings. Recheck counts and inventory/listing agreement.
5. Install final `NOT VALID` inventory/listing CHECKs accepting exactly `new|like_new|very_good|good|acceptable`; validate them; then remove the temporary compatibility CHECKs before commit. Compatibility readers remain through the writer switch, but no final constraint accepts `fair` or `damaged`.

### M05 controlled inventory/publication functions

Private `marketplace_sec` helpers: authorize Owner/initiator; lock/recompute duplicate identity; assert quantity equality/active holds; validate damage/media; persist idempotency; emit bounded event/audit; project/retract listing. Trigger-only helpers have EXECUTE revoked from `PUBLIC`, `anon`, and `authenticated`.

Public callable command RPCs map to WU0B C01-C13 and C20-C26. C01 creates an initiator-owned session; C02 issues the persisted `scan_input` capability; C03 consumes it atomically while linking accepted input and reserving job/cost identity; C04-C07 own close/review/manual/skip transitions; C08-C13 own review/commit/publication commands; C20 issues and C21 consumes/links an approved `public_copy` capability; C22-C26 own post-commit commands. Each is `SECURITY DEFINER`, blank `search_path`, authenticated-only, derives actor/store, and delegates to private helpers. The C12 publication retry supports Owner or correctly claimed worker dispatch through one boundary and has no inventory write path.

Extend/replace `sync_marketplace_listing_from_inventory` atomically in M04 so legacy manual writes remain compatible during transition, then switch final Phase 9 writes to the explicit projection function. M05 does not validate `store_inventory_quantity_balance`; validation belongs only to separately reviewed M09 after a fresh violation preflight and separate live-application authorization.

### M06 Storage boundary

- Create `marketplace-media-staging`: private, 10 MiB baseline, JPEG/PNG/WebP; no broad listing; one-time server-authorized uploads only.
- Retain/harden `image-extraction-inputs`: private sanitized scan assets; server/claimed-worker read/write; no Owner/customer direct listing.
- Retain/harden `inventory-photos`: public approved sanitized derivatives, 5 MiB, no `storage.objects` broad SELECT listing and no direct Owner final-byte mutation.
- Create `order-request-photos`: private, 5 MiB baseline, JPEG/PNG/WebP; request-item/customer/store capabilities only.
- Keep `order-dispute-evidence` separate. Do not use legacy `listing-photos` for Phase 9.
- Server-generated path: `<store_id>/<purpose>/<entity_id>/<media_id>.<ext>`; database purpose/entity is authoritative.
- Storage policies accept only a server-issued, persisted M02 capability whose exact bucket/path/purpose/entity/envelope is still `issued`; no authenticated direct object INSERT/UPDATE/DELETE or listing grant exists. C02 and C20 issue capabilities through M05 named RPCs; C03 and C21 consume them through M05 named RPCs. M08 adds C15 issuance plus C16 consumption for `customer_request` after the request relation exists.

### M07 public projection and search

Projection writes only the positive allowlist. Approved aliases feed a versioned search document. Add controlled Q07 internal match and Q08–Q10 public/storefront query functions; group by `store_id` before pagination and bind cursors to query/filter/ranking versions and final `store_id` tie-breaker.

### M08 request-photo seam

`order_request_photo_requests`: `id`, `store_id`, `order_request_id`, `order_request_item_id`, `customer_user_id`, `requested_count CHECK 1..3`, exact SDD 06 state, instructions/reason, `version`, request/provided/accepted/declined/unfulfilled/expired timestamps, confirmation proposal version/price/quantity/terms snapshot, policy version. Unique active request per request item.

`order_request_media_links`: `id`, `store_id`, `photo_request_id`, `media_asset_id`, `sequence CHECK 1..3`, provided_at; unique request/sequence and asset; purpose/store/request-time guards.

Functions map WU0B C14-C19 and C27-C30. C15 derives the request/store and issuing Owner then persists the single-use `customer_request` capability; C16 atomically consumes it while creating the private media link. Owner confirmation locks request item/inventory, snapshots current quantity/price/terms, and atomically creates/refreshes the existing Phase 6 soft hold. Acceptance requires current proposal plus active unexpired hold. No Phase 7/8 effects are added.

## 3. RLS and grant matrix

| Class | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- |
| Canonical/public projection | positive-allowlist view or named query only | positive-allowlist view or named query only | required maintenance |
| Owner private projections | none | named Q01-Q06/Q11 RPCs or dedicated positive-allowlist views only; no private base-table access | required |
| Sessions/candidates/aliases/media links/capabilities | none | no direct base-table SELECT or DML; named C/Q boundaries only | required |
| Jobs/attempts/usage/idempotency/lifecycle/raw payload | none | none | required |
| Request photos | none | bounded actor-specific Q11/capability only; no raw path/table enumeration | required |
| Private helpers/triggers | no EXECUTE | no EXECUTE | named minimum EXECUTE |

All new tables enable RLS before grants. Revoke all `anon`/`authenticated` privileges on private Phase 9 base tables, sequences and internal functions; do not add authenticated direct-read policies. Grant only EXECUTE on the named C/Q functions and SELECT on specifically named positive-allowlist public views. Worker/service access is separately granted only to the claim/attempt/provider/media-lifecycle and transaction functions it requires; possession of `service_role` without a valid claim does not authorize worker effects. Policies and functions derive entity/store relationships server-side; no boundary trusts a submitted store/path. Public views/query DTOs expose only canonical/listing/storefront allowlists and recursively exclude private inventory quantities/costs/notes, actor/customer IDs, raw payloads, capabilities, object paths/hashes, job/attempt state and validation internals.

## 4. Required indexes

- Add live advisor-backed FK indexes: `canonical_editions(work_id)`, metadata-source canonical/source links, inventory canonical/source links, listing canonical/locality links, and request-item canonical/listing links where Package 1 queries use them.
- Alias: GIN trigram/FTS on approved normalized alias plus target/store partial indexes.
- Sessions: initiator recovery `(store_id, created_by, status, updated_at desc)`.
- Inputs/candidates: session/status ordering and replay keys.
- Jobs: claim `(status, next_attempt_at, lease_expires_at)` partial on claimable states; unique dedupe key.
- Media/capabilities: `(store_id,purpose,lifecycle_status,delete_after)`, object uniqueness, link/entity ordering; capability expiry/status cleanup plus unique `(store_id,nonce_hash)` and `(bucket_id,object_path)`.
- Usage: unique `(store_id,job_id,cost_kind,policy_version)` plus status/expiry operational index.
- Publication: partial `(publication_status, updated_at)` for pending/failed.
- Marketplace: eligibility/store/rank key plus generated `search_document` GIN; validate query plans with representative multi-store fixtures before final names/order.
- Request photos: request/item/customer/store/state and expiry indexes; media request/sequence uniqueness.

## 5. Safe migration order and recommended grouping

Use eight forward-only additive Phase 9 groups, preserving the approved WU0 grouping. Assign actual timestamps only when migration-file creation is separately authorized. The existing quantity CHECK validation is not folded into these groups: it is a separately reviewed ninth migration/gate.

1. `YYYYMMDD000001_marketplace_phase9_catalogue_metadata_expand.sql` — M01. Do not add `store_inventory.created_from_candidate_id` or `marketplace_book_listings.primary_public_media_id` FKs yet.
2. `YYYYMMDD000002_marketplace_phase9_extraction_persistence.sql` — M02. Create sessions, jobs and upload capabilities, then inputs and candidates without the forward media/attempt FKs; create metadata attempts with their candidate FK; then add `image_extraction_candidates.metadata_attempt_id -> metadata_enrichment_attempts(id)`. Create usage reservations after jobs. Add `store_inventory.created_from_candidate_id -> image_extraction_candidates(id)` here after candidates exist. Capability request-photo binding remains typed by entity/id until M08.
3. `YYYYMMDD000003_marketplace_phase9_media_registry.sql` — M03. Add `image_extraction_inputs.media_asset_id -> media_assets(id)`, `marketplace_book_listings.primary_public_media_id -> media_assets(id)`, and `phase9_upload_capabilities.consumed_media_asset_id -> media_assets(id)` here. Do not add media-to-request-photo FKs yet.
4. `YYYYMMDD000004_marketplace_phase9_condition_damage_transition.sql` — M04.
5. `YYYYMMDD000005_marketplace_phase9_controlled_inventory_commands.sql` — M05; includes C01-C13/C20-C26 boundaries and capability issue/consume helpers, but no quantity CHECK validation.
6. `YYYYMMDD000006_marketplace_phase9_storage_boundaries.sql` — M06.
7. `YYYYMMDD000007_marketplace_phase9_public_projection_search.sql` — M07.
8. `YYYYMMDD000008_marketplace_phase9_request_photo_seam.sql` — M08. Add `media_assets.request_photo_request_id -> order_request_photo_requests(id)` and a conditional `phase9_upload_capabilities.bound_entity_id -> order_request_photo_requests(id)` integrity trigger for `purpose=customer_request` (a polymorphic column cannot use a conditional declarative FK); add all request/media-link FKs here because both sides now exist; add C14-C19/C27-C30 including C15/C16 capability boundaries.

Separately reviewed gate, not one of the eight additive Phase 9 groups:

9. `YYYYMMDD000009_marketplace_phase9_validate_inventory_quantity_balance.sql` — M09. Before application, re-verify the exact project and run a locking/operationally safe preflight query that must return zero rows violating `quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed` and zero negative buckets. Abort without validation on any violation. Apply only under separate live-application authorization, then `VALIDATE CONSTRAINT store_inventory_quantity_balance` and read back `convalidated = true`; no other Phase 9 DDL belongs in M09.

Within every file: expand first; backfill/adjudicate; verify counts/invariants; validate constraints; switch writers/readers/policies; contract only after compatibility evidence. Every FK is created only in the group named above after both relations exist. Never rewrite applied migration history.
