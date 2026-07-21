# Phase 9 Metadata and Inventory Data Dictionary

**Status:** target design; exact SQL types/names require migration review
**Last updated:** 2026-07-19

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
| `id`, `store_id`, `created_by` | Tenant/initiating-actor identity; during the pilot only this Owner mutates/resumes. Support intervention is separately authorized/audited. |
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
| count fields | detected count; reject if greater than 15. |
| version/attempt fields | orchestration attempt and selected vision adapter. |
| lifecycle | created/processed/delete-after/deleted. |

### `image_extraction_candidates`

| Field | Rule |
| --- | --- |
| scope/position | session/input/store, stable candidate index, optional bounding box. |
| observed identity | original-script title, authors, visible ISBN clue, language/script. |
| confidence | extraction confidence only; never canonical authority. |
| normalized selection | selected metadata snapshot, canonical match nullable, metadata source/attempt. |
| aliases | related through `book_search_aliases`; automated proposal maximum three, with bounded additional official/verified rows. |
| review fields | owner edits/defaults, add/remove action, duplicate choice, publication choice. |
| status | `processing`, `ready`, `needs_review`, `possible_duplicate`, `commit_in_progress`, `committed`, `failed`. A projection failure leaves this value `committed`, sets inventory publication status to `publication_failed`, and returns API outcome `committed_publication_failed`. |
| commit linkage | committed inventory/listing IDs and idempotency identity. |
| retention | unresolved candidate expiry; committed normalized evidence may reduce to audit-safe provenance. |

### `metadata_enrichment_attempts`

| Field | Rule |
| --- | --- |
| candidate/provider | Adapter key, provider request ID, sequence, query type. |
| request inputs | normalized ISBN/title/author/language, not arbitrary raw prompt. |
| result | status, provider book ID, match strength/rationale, latency, cache hit. |
| versions | adapter/schema/normalizer version. |
| payload lifecycle | raw payload private/delete-after; normalized selected snapshot retained by policy. |
| field reuse policy | Per normalized field: matching-only/storage/display/cache/attribution/expiry rights. |

### `image_extraction_jobs` (or shared job table extension)

Persistent async work with bounded attempts, lease/claim timestamps, idempotency key, job kind, status, error class/code, next attempt, and dead-letter/escalation. The implementation should reuse the proven Postgres job pattern where compatible rather than create an unrelated queue.

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
