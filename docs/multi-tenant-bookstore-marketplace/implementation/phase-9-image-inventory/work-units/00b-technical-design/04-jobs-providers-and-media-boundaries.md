# WU0B Jobs, Providers, Cost, Media, and Lifecycle Design

**Status:** `implementation_complete_needs_review`
**Provider/storage authority:** none

## 1. Persistent job contract

Each job payload contains only job/aggregate/media/provider-policy IDs, store/purpose scope, contract/schema/prompt/adapter/policy versions, expected aggregate version, and correlation identity. It contains no image bytes, signed URL, credential, customer PII, raw prompt/provider response, or client authority. The claimant obtains any short-lived internal object access only after claim and reauthorization.

| Job kind | Stable identity and prerequisite | Success / retry / permanent outcome | State and Close awareness |
| --- | --- | --- | --- |
| `media_validate_sanitize` | media ID+content hash+policy version; accepted staged object | sanitized derivative+validation summary / transient storage / invalid or unsafe media | input cannot advance to extraction until success; rejection terminal |
| `vision_extract` | input ID+content hash+vision policy; sanitized scan | candidates or terminal `no_books` / one allowed whole-image fallback / schema-invalid or quality rejection | session may close only after input terminal; no work accepted after closing |
| `metadata_enrich` | candidate+coherent lookup key+policy | selected coherent snapshot / next sequential adapter / bounded no-match | no-match keeps store-local/manual candidate reviewable |
| `alias_propose` | reviewed coherent snapshot+language+policy | max three automated proposals / retry transient / invalid proposals discarded | cannot alter identity or block manual review/commit |
| `publication_retry` | publication intent identity+inventory version | published/retracted / transient retry / permanent failed status | `mayWriteInventory=false`; reauthorize eligibility each attempt |
| `retention_delete` | media/entity+retention policy+eligibility version | non-content deletion evidence / transient object failure / hold or relink cancels eligibility | recheck links and legal/dispute/security holds immediately before delete |
| `orphan_reconcile` | scan partition+policy version | classified linked/staged/orphan / retry scan / ambiguous item quarantined | classification precedes delete; never bypass hold |
| `request_photo_lifecycle` | request item+photo version+policy | approved expiry/reminder/cleanup state / transient retry / state changed no-op | cannot accept/decline, alter payment, or use another request/store |

Exact table/queue/function names and compatibility with current Phase 6 tasks are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 2. Claim, lease, retry, and crash recovery

The future claimant uses Postgres `SELECT … FOR UPDATE SKIP LOCKED` only, claims a bounded batch ordered by eligibility time and stable ID, increments attempt, writes opaque lease owner and expiry, and commits before dispatch. A worker must present service-role authorization plus matching job/lease/kind. Completion/retry updates predicate on job ID, lease owner, attempt and nonexpired claim; stale workers cannot finish.

Attempt limit is five unless a later approved configuration is stricter. Transient failures include network timeout, provider 429/5xx, temporary storage failure and lease loss before external side effect. Permanent failures include strict-schema rejection, unsafe media, unsupported/invalid content, authorization/purpose mismatch, invalid configuration and exhausted attempts. Backoff is bounded with jitter and persisted `next_attempt_at`; exact intervals are a later configuration decision.

A crashed worker leaves an expiring claim. Reclaim uses the same task identity and external attempt/idempotency identity, inspects any recorded provider/cost outcome, and never repeats a known charge or state transition. Dead-letter records codes, versions and attempt counts only, then exposes a bounded Owner/support outcome through a separate projection.

## 3. Cost reservation and fallback

Before a cost-bearing call, a transaction reauthorizes store/job eligibility and creates or reuses a reservation keyed by `(store, job, cost_kind, policy_version)`. The adapter records attempt start/outcome/usage against that identity. Replay/cache hit cannot reserve or charge twice. Store, language, provider and global kill switches are evaluated before reservation.

Vision permits primary plus at most one whole-image fallback only for configured technical/schema/broadly-unusable outcomes. Valid `no_books`, wrong-language policy outcome, candidate-limit rejection and deterministic validation failure do not loop. Metadata is local canonical first, then configured adapters sequentially; one coherent edition snapshot is selected without field stitching. Alias generation follows coherent metadata and cannot set identity.

Concrete vendors, models, costs, quotas, circuit thresholds, timeouts and credentials are later configuration/legal gates. CI and initial runtime slices remain recorded-fixture backed.

## 4. Adapter interfaces

| Adapter | Input | Normalized output | Forbidden authority |
| --- | --- | --- | --- |
| Vision | sanitized internal media reference, selected BCP 47 language, `spine_stack`, cap 15, contract/prompt/adapter IDs, correlation/attempt | closed outcome plus ≤15 ordered bounded candidates or terminal no-books/rejection | store/actor/state/retry/path/command/tool/credentials |
| Metadata | normalized original title/authors, selected language, checksum-valid optional ISBN clue, contract/policy IDs | zero or more coherent edition candidates with field provenance and reuse policy | database writes, canonical identity decision, mixed-edition field stitching |
| Alias | selected coherent snapshot, original language/script, bounded policy | ≤3 automated typed proposals with provenance/confidence | authoritative display/identity/duplicate decision |
| Media processor | staged object internal reference and declared envelope/purpose | validation summary, sanitized derivative identity/hash/dimensions/MIME | public promotion, entity authorization, reusable URL |

All adapters strictly reject unknown keys and translate vendor failures into closed internal outcomes. Raw payload retention/access is separately restricted and never enters ordinary DTOs, events or logs.

## 5. Media validation and capability boundaries

Validation checks declared/actual MIME, magic/header/signature, decode success, bytes, dimensions, pixels/decompression ratio, malformed/polyglot content and supported format; it re-encodes to an approved format and strips EXIF/GPS. Exact byte/pixel/dimension limits and codecs require later configuration and storage audit, but may not be unbounded.

| Purpose | Actor/entity | Visibility and retention | Promotion/link rules |
| --- | --- | --- | --- |
| `scan_input` | initiating Owner/session/input | private processing; shortest policy-compatible retention | never public; candidate metadata is derived, not a media promotion |
| `public_copy` | same-store Owner/candidate or inventory | private until approved, then approved derivative may be public | role/order bounded; condition/damage/publication eligibility required |
| `customer_request` | owning-store Owner/request item/customer | private request evidence; customer-specific capability | never public/listing/duplicate identity; 1–3 newly captured images |

Objects use opaque server-generated identities and purpose-separated path namespaces/buckets as selected later. Clients never choose authoritative paths. Exact buckets, policies and existing-object compatibility are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 6. Cleanup, orphan reconciliation, and holds

Retention eligibility is computed from purpose, last required link, workflow terminal time, configured policy and any legal/dispute/security hold. Delete uses prepare→external object deletion→finalize evidence. Prepare rechecks references/holds and creates one deletion identity; missing objects count as idempotent success; finalize stores object/media ID, policy/version, outcome/code and timestamps without content/path.

Orphan reconciliation enumerates only through service authority, classifies registered-linked, registered-staged, object-without-registry and registry-without-object, and quarantines ambiguity. It cannot delete until the normal hold-aware retention command authorizes the exact object. Cleanup racing a new link loses through version/link recheck and leaves the object.

## 7. Observability and red evidence

Metrics include queued/claimed/retried/dead counts by job kind/outcome/version, lease expiry, provider latency/outcome, fallback/cache flags, cost units, media validation categories, retention holds and deletion results. They exclude IDs from metric labels and all forbidden content. Required tests cover double claim, stale completion, lease expiry/reclaim, crash after external success, cost replay, fallback cap, provider no-match, Close awareness, cleanup-versus-link/hold, missing-object replay, wrong-purpose capability and service-token denial.
