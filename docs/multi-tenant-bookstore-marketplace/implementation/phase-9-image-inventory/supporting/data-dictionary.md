# Phase 9 Metadata and Inventory Data Dictionary

**Status:** approved target; M01-M08/M10-M14 live exactly once; M09 absent
**Last updated:** 2026-07-28

M01-M08/M10-M14 are live-verified. M11 provides bounded ingestion/media leases; M12 implements immutable evidence, lineage, reconciliation, and private service RPCs; M13 adds only minimum postgres-owned `SECURITY INVOKER` public delegates for PostgREST, executable solely by `service_role`. M14 adds dedicated service-only vision-provider attempts and is live once as `20260727183546`. Owner/media/fixture-vision services remain deployed. M09 quantity validation remains a separate live-data gate.

The dictionary distinguishes canonical truth, store-owned snapshots, public projections, staged AI output, and media/evidence. A field must not be added to several layers merely because it is convenient; each copy needs a named owner and synchronization rule.

## Conventions

- `store_id` is the tenant key.
- IDs are UUIDs unless an existing table requires otherwise.
- Money is integer minor units (paise).
- Language uses normalized BCP 47 tags; script uses ISO 15924 where useful.
- Provider/model/prompt/schema values are stable adapter/version identifiers, not secrets.
- Raw images and raw payloads are private and time-bounded.
- Original-script values are authoritative; aliases are search-only.

## Contract registers required before schema implementation

- Central validation matrix: field/type/nullability/min/max/normalization/rejected content/visibility/unknown-key policy.
- Canonical API error catalogue: stable `P9_*` code, HTTP status, retryability, safe message, log severity, surviving effect, and idempotency-key reuse.
- Provider reuse policy: matching-only, storage, public display, image caching, attribution, and expiry/revalidation rights independently of provenance.
- Bookstore-first query contract: match/store-group identity, count semantics, safe fields, alias-match context, cursor/ranking/tie-breaker, and privacy exclusions.
- Database grant matrix: table/function/role exposure, with raw operational structures service-only.

## Existing canonical edition additions

| Field | Owner/source | Nullable | Public | Edit authority | Use |
| --- | --- | --- | --- | --- | --- |
| `description` | selected metadata source | yes | yes | platform/provider rematch | detail display/search snippet; plain text only |
| `edition_statement` | selected metadata source | yes | yes | platform/provider rematch | distinguish editions |
| `volume` | selected metadata source | yes | yes | platform/provider rematch | edition detail/search |
| `format` | selected metadata source | yes | yes | platform/provider rematch | paperback/hardcover/etc.; duplicate comparison |
| `metadata_verified_at` | deterministic selector | yes | no | service | provenance/freshness |
| `metadata_selection_version` | selector | yes | no | service | replay/debug |

Existing `title`, `subtitle`, `authors`, `isbn_10`, `isbn_13`, `publisher`, `published_date`, `language`, `cover_url`, `page_count`, and `categories` remain. Both ISBN values are stored when the selected validated metadata provides them; otherwise one may remain null.

## `book_search_aliases` (proposed)

| Field | Purpose and rule |
| --- | --- |
| `id` | Stable alias ID. |
| `store_id` nullable | Required only for inventory-local alias; null for canonical alias. |
| `canonical_edition_id` nullable | Canonical target. |
| `inventory_id` nullable | Unmatched/store-local target. |
| target CHECK | Exactly one of canonical edition or inventory is non-null. If inventory target, `store_id` is required and must match inventory. |
| `alias_text` | Search value; never displayed as authoritative title by default. |
| `alias_normalized` | Deterministic normalized value for index/deduplication. |
| `alias_language` | Normally `en` for Phase 9 English search aliases. |
| `alias_script` | Normally `Latn`; preserved for future expansion. |
| `alias_type` | `transliteration`, `translation`, `common_spelling`, or `recognized_title`. `common_title` is not accepted. |
| `source_type` | `automated`, `provider_official`, `owner_verified`, or `platform_verified`. |
| `source_ref` | Provider/model/attempt reference without secret/payload. |
| `confidence` nullable | Source confidence; never identity evidence. |
| `approval_status` | `proposed`, `approved`, or `rejected`. Only approved aliases are public-search eligible. `superseded` is a lifecycle/audit reason that transitions the replaced row to `rejected`; it is not persisted as an approval status. |
| `created_by` nullable | Actor when human-created/approved. |
| timestamps | Creation/update/approval. |

Each automated generation operation proposes at most three English aliases. Additional provider-recognized official or Owner/platform-verified aliases may remain active within configured abuse, quality, and storage limits. The controlled command enforces source-specific limits and approval; the client is never trusted.

## `store_inventory` additions

| Field | Source | Public via projection | Required to publish | Notes |
| --- | --- | --- | --- | --- |
| `language` | selected metadata/owner | yes | yes | Original edition language. |
| `description` | metadata snapshot/owner override | yes | no | Store override does not alter canonical edition. |
| `edition_statement` | metadata snapshot/owner | yes | no | Affects duplicate comparison when no validated ISBN. |
| `volume` | metadata snapshot/owner | yes | no | Affects duplicate comparison. |
| `format` | metadata snapshot/owner | yes | no | Affects duplicate comparison. |
| `condition` | owner | yes | yes | `new`, `like_new`, `very_good`, `good`, `acceptable`. |
| `has_damage` | owner | yes | yes | Separate from base condition. |
| `damage_notes` | owner | yes when damaged | when damaged | Plain public disclosure. |
| `damage_types` | owner | yes when damaged | when damaged | Controlled list plus optional bounded note. |
| `is_sellable` | controlled validation | yes as eligibility only | yes | False for unsafe/incomplete/unreadable copies. |
| `last_verified_at` | owner confirmation/system | no exact timestamp initially | no | Inventory freshness/ranking/review. |
| `acquisition_type` | owner | no | no | Optional: purchase, trade-in, donation, consignment, other. |
| `cost_basis_method` | owner | no | no | Optional accounting hint; not tax logic. |
| `printed_mrp_minor` | owner/metadata | optional public display later | no | Not a discount engine. |
| `metadata_snapshot_version` | commit service | no | yes internally | Trace selected normalized data. |
| `created_from_candidate_id` | commit service | no | no | One candidate commits at most once. |
| `publication_status` | controlled projection service | safe projection only | no | `private`, `publication_pending`, `published`, or `publication_failed`; failure never repeats inventory effects. `committed_publication_failed` is an API outcome, not this persisted status. |
| `publication_intent_version` | controlled projection service | no | no | Idempotent retry/version lineage for the requested public projection. |

Existing quantity buckets remain authoritative. `photos text[]` is deprecated only after typed media links are backfilled and all readers migrate.

## `marketplace_book_listings` additions

| Field | Public behavior |
| --- | --- |
| `language` | Card/detail/filter/search. |
| `public_description` | Book detail; plain text, bounded length. |
| `edition_statement`, `volume`, `format` | Detail and edition differentiation. |
| `has_damage`, `public_damage_notes`, `damage_types` | Damage badge and disclosure. |
| `primary_public_media_id` nullable | Approved actual-copy fallback when canonical cover absent. |
| `public_media_count` | Bounded 0–3; no storage path enumeration. |
| `last_inventory_verified_bucket` | Optional friendly freshness signal, not exact private timestamp. |
| `search_document` or equivalent | Derived from original title/authors/ISBN/language plus approved aliases. |

Public projection never contains shelf location, acquisition data, exact quantity, raw paths/payloads, duplicate evidence, model confidence, or private request-photo IDs.

## Extraction/session structures

### `image_extraction_sessions`

| Field | Rule |
| --- | --- |
| `id`, `store_id`, `created_by` | Tenant/initiating-actor identity; during the pilot only this Owner mutates/resumes. Interactive support intervention is excluded. |
| `status` | `active`, `closing`, `closed`, `expired`; `closing` begins only after inputs are terminal, rejects new inputs, and finalizes summary. No user-visible pause/early-close state. |
| `selected_language`, `selected_script` | One batch language; English default. |
| default fields | condition, shelf/location, quantity=1, publication preference. |
| summary counters | input/candidate/ready/review/committed/private/published/skipped/failed counts. |
| policy/version fields | quota policy, orchestration schema, prompt/model/provider selection versions. |
| lifecycle timestamps | started, close requested, closed, expires. |

### `image_extraction_inputs`

| Field | Rule |
| --- | --- |
| IDs/scope | session, store, media asset. |
| `source_kind` | `camera` or `gallery`. |
| `status` | `uploaded`, `validating`, `queued`, `processing`, `ready`, `failed`, `skipped`. |
| `sha256` | Exact-image replay/cost protection inside store/policy scope. |
| quality fields | blur/glare/resolution/decodability result and owner-facing reason. |
| count fields | detected visible-book count `0..100`; deterministic policy rejects the complete image above 15. |
| version/attempt fields | orchestration attempt and selected vision adapter. |
| lifecycle | created/processed/delete-after/deleted. |

### `image_analysis_results` (live M12; service-only)

| Field | Rule |
| --- | --- |
| scope | store/session/input/vision-job FKs derived by the persistence RPC. |
| uniqueness | one authoritative row per `(vision_job_id, analysis_schema_version)`. |
| result | authoritative outcome, detected/accepted/skipped counts, bounded canonical `p9-vision-v2` snapshot, and database-computed SHA-256 over UTF-8 PostgreSQL normalized `jsonb::text`. |
| provenance | contract/pipeline/prompt/adapter/provider/model/schema versions and opaque correlation identity; never provider-specific payload. |
| completing claim | attempt, worker, and lease-token hash for exact ambiguous-response replay; raw token absent. |
| lifecycle | immutable private evidence; created/completed timestamps and later explicit lifecycle-redaction policy only. |

### `image_analysis_observations` (live M12; service-only)

| Field | Rule |
| --- | --- |
| scope/position | result/store/input, stable ordinal, unique `(analysis_result_id,observation_ordinal)`. |
| disposition | `candidate`, `language_mismatch`, `unknown_language`, or `identity_insufficient`. |
| immutable clues | title/authors/publisher/ISBN, detected language, confidence, normalized geometry, closed warning codes. |
| evidence | bounded canonical observation snapshot only; no raw provider response, prompt, URL/path/token, or arbitrary metadata. |
| candidate link | nullable one-to-one link for accepted observations; skipped evidence has no candidate. |

### `vision_provider_attempts` (live M14; service-only)

| Field | Rule |
| --- | --- |
| call/claim identity | Unique provider-attempt UUID plus job, correlation, claim attempt, worker, and lease-token hash; raw lease token absent. |
| reservation/spend | Required vision usage-reservation FK and deterministic logical spend identity independent of claim attempt; multiple provider-attempt rows with one spend identity remain visible for duplicate reconciliation. |
| provider lineage | Primary/approved-fallback role, provider, adapter/model, prompt, and schema versions. Unit 4B configures primary only. |
| response lineage | Optional bounded provider request ID; start/completion timestamps and normalized outcome. |
| usage/cost | Five bounded token counters, calculated cost units, and injected pricing input restricted to ISO currency, bounded safe identifiers, and finite non-negative bounded unit costs; unknown keys are rejected and no provider price is hard-coded. |
| disposition | `registered`, `response_received`, `accepted`, `stale_rejected`, `failed`, or `outcome_unknown`; only one accepted attempt per job. |
| accepted result | Nullable analysis-result FK required exactly for `accepted`; association verifies the completing attempt/worker/token hash. |
| forbidden data | No prompt, image/base64, Storage credential, provider response, bibliographic payload, or arbitrary raw metadata. |

### `image_extraction_candidates`

| Field | Rule |
| --- | --- |
| scope/position | session/input/store, vision job/schema/analysis-observation lineage, stable candidate index, optional bounding box. |
| observed identity | original-script title, authors, publisher clue, visible ISBN clue, language/script. |
| confidence | extraction confidence only; never canonical authority. |
| immutable evidence | owned by linked analysis observation; it is not stored in `selected_snapshot` or `owner_review_snapshot`. |
| normalized selection | later selected metadata snapshot, canonical match nullable, metadata source/attempt. |
| aliases | related through `book_search_aliases`; automated proposal maximum three, with bounded additional official/verified rows. |
| review fields | owner edits/defaults, add/remove action, duplicate choice, publication choice. |
| status | `processing`, `ready`, `needs_review`, `possible_duplicate`, `commit_in_progress`, `committed`, `failed`. A projection failure leaves this value `committed`, sets inventory publication status to `publication_failed`, and returns API outcome `committed_publication_failed`. |
| commit linkage | committed inventory/listing IDs and idempotency identity. |
| retention | unresolved candidate expiry; committed normalized evidence may reduce to audit-safe provenance. |

### `metadata_enrichment_attempts`

| Field | Rule |
| --- | --- |
| candidate/provider | Adapter key, provider request ID, primary/secondary role, attempt sequence, query type. |
| lookup identity | Versioned provider-independent normalized-query identity; no secret, raw image, PII, or store authority. |
| request inputs | normalized ISBN/title/author/language, not arbitrary raw prompt. |
| result | Closed normalized outcome, provider book ID, match strength/rationale, latency, cache/coalescing state, accepted/rejected disposition. |
| versions | adapter/schema/normalizer/capability/routing-policy/reuse-policy versions. |
| fallback lineage | Predecessor attempt and normalized triggering outcome when role is secondary. |
| spend lineage | Provider request identity, usage/cost reservation, accepted completion, and reconciliation status; does not promise exactly-once external invocation. |
| payload lifecycle | raw payload private/delete-after; normalized selected snapshot retained by policy. |
| field reuse policy | Per normalized field: matching-only/storage/display/cache/attribution/expiry rights. |

Unit 5A resolves the target placement locally: M15 uses a separate lookup/coalescing
relation, a provider-versioned cache relation, extensions on the metadata-specific
attempt relation, and a separate immutable selected-snapshot relation. Lookup rows
distinguish provider-independent `local` completion from `external` execution; the
local mode keeps provider/cache/policy fields null and persists the canonical
edition plus immutable snapshot with zero provider attempt or reservation. They
keep cache-policy version distinct from cache namespace and bind reuse-policy
version to the provider registry. Selected snapshots retain a separate terminal
outcome-source attempt so negative/ambiguous cache records preserve exact adapter
provenance without misrepresenting that attempt as an accepted selection.
`storage_allowed=false` prevents retained normalized payload, selected snapshots,
and positive cache entries. M15 is live once as `20260727222159`; these structures
are live, while the intended read-only direct service-role boundary remains blocked
on the forward ACL correction recorded in the current-vs-target audit.

### Provider registry and routing target

Each adapter has a versioned capability declaration covering query forms, identifiers, languages, normalized outcomes, cover behavior, and reuse-policy dependencies. Role/order, enabled state, breaker/kill-switch policy, cache namespace, rate/concurrency policy, and promotion state are configuration or policy references, never credentials. Exactly one primary and zero or one secondary may be configured for an enabled metadata rollout scope.

### `image_extraction_jobs`

Persistent async work uses existing states `open`, `in_progress`, `retry_scheduled`, `resolved`, `resolved_noop`, `cancelled`, and `dead_letter`, with attempts `0..5`, due/lease timestamps, dedupe identity, adapter/operation versions, safe errors, and correlation ID. M11 adds the token hash; local M12 reuses it through vision-specific claim/context/persist/fail functions without creating another queue. M12 also adds nullable vision-reconciliation attempt/worker/token-hash/summary fields. They are populated only when an exactly fenced current claim discovers an invalid authoritative relationship, and constrain that job to terminal `resolved` with `P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED`; no unverified related row changes.

Later metadata execution reuses this durable claim/lease/fencing pattern unless separately approved evidence requires another seam. Claim batch size, process concurrency, per-store admission, and database connection budget are bounded configuration. Termination stops new claims and completes, renews, or safely releases active leases; stale completion remains rejected.

## Media structures

### `media_assets`

| Field | Rule |
| --- | --- |
| `id`, `store_id`, `uploaded_by` | Tenant and actor. |
| `purpose` | `scan_input`, `public_copy`, `customer_request`, `dispute_evidence`. |
| `privacy_class` | `private_processing`, `public_approved`, `private_request`, `restricted_evidence`. |
| bucket/path | Server-generated path. Never taken as client authority. |
| integrity | SHA-256, detected MIME, bytes, width/height, decode/re-encode status. |
| sanitization | EXIF stripped timestamp/version; sanitized derivative link. |
| lifecycle | status, retention class, delete-after, deleted-at, hold reason nullable. |
| provenance | source asset, uploader, request/session, policy version. |

### Link tables

- `inventory_media_links`: inventory, media, role (`damage`, `actual_copy`, `primary_fallback`), public order, approval.
- `order_request_photo_requests`: request item, store/customer, status, requested/provided/accepted/unfulfilled timestamps, version.
- `order_request_media_links`: request-photo record, media, sequence 1–3, captured-after-request proof.

## Audit and telemetry

Audit records identify actor, store, entity, command, outcome, idempotency, and bounded structured metadata. They never contain image bytes, raw payloads, full prompts, provider credentials, shelf images, or signed URLs.

Telemetry includes adapter/model/provider version, duration, outcome/error class, fallback, cache hit, token/image cost units, correction categories, candidate counts, and cleanup backlog. User-entered titles may be hashed or sampled only under an approved privacy policy; raw images are never analytics payloads.

Provider scorecards separate availability, schema validity, coherent-match quality, Owner correction deltas, language/edition cohort, latency, and cost. Queue telemetry additionally covers queued count and oldest age by stage, claim latency, active leases, retry backlog, dead letters, provider rate limiting/concurrency, per-store concentration, and worker startup/readiness duration.
