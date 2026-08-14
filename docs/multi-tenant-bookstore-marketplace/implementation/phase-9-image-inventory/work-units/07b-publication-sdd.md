# Unit 7B SDD: Safe Public Projection and Publication

**Status:** normative design frozen 2026-08-12; review candidate implemented; Luna review `NOT APPROVED`
**Authority:** Owner decisions 2026-08-12 (all 12 review findings resolved); DOC-3, DOC-4, DOC-5, DOC-8; Phase 9 master SDD; SDD 03; SDD 05
**Implementation authority:** M40/M41/M42 are live exactly once on the verified development target; Owner Edge v7 and the publication worker are live; the connected Unit 7B completion proof is recorded in tracker 30. The scoped implementation is integrated into `main` at merge commit `53edbddc9c5417b34cb169599e8282b162e183b3`; any further Unit 7B or Unit 7C change remains separately authorized.
**Migration authority:** M40, M41, and M42 are immutable live history; no new migration is authorized by this SDD.

## 1. Purpose and scope

Unit 7B owns the transition of a committed private `store_inventory` row to a
publicly searchable, orderable marketplace listing. Unit 7A created exactly one
private row with `visibility_status='draft'` and `publication_status='private'`;
Unit 7B makes that row publicly visible when and only when the Owner requests
publication and every eligibility gate passes. Unit 7C owns every post-commit
inventory edit, including edits that refresh or retract a published projection.

Unit 7B includes the controlled Edge/mobile publication commands, the
authenticated database boundary, publication eligibility, the safe public
projection through **one authoritative writer path**, approved public media
(actual-copy and damage evidence), publication state transitions, idempotent
retry of *transient* projection failures only, a token-fenced retry worker, the
controlled Owner inventory read boundary extension, and the retirement of the
legacy uncontrolled publication path.

Unit 7B never writes, targets, or increments inventory quantity. It never
creates a second inventory row, never mutates shared canonical metadata, and
never exposes private operational fields.

**Unit 7B completion definition (normative):**

```text
REAL private inventory
→ Owner Publish
→ anonymous discovery sees ONE listing
→ Owner Pause
→ anonymous discovery no longer sees it
→ stale leased retry cannot resurrect it
→ Owner republishes
→ anonymous discovery sees exactly ONE listing

PLUS

deterministic eligibility failure
→ NO retry job

PLUS

forced transient projection failure
→ one publication_failed state
→ one retry job
→ worker retry
→ exactly one published listing
→ inventory quantity/identity unchanged
```

Anything short of this is implementation progress, not Unit 7B completion.

## 2. Publication eligibility and authoritative state

An inventory row is publication-eligible only when all of the following remain
true while the row is locked:

- the row exists and belongs to a store whose active Owner is authorized;
- the store is `active`, approved, setup-complete, selling-allowed, and
  eligible under pilot locality/feature and subscription policy;
- `selling_price_minor > 0` (positive price; price-on-request is excluded);
- `quantity_available > 0`;
- `is_sellable = true` (unsafe, incomplete, unreadable, or contaminated copies
  are not publishable);
- base `condition` is one of the five approved values and the row carries a
  valid damage disclosure: when `has_damage=true`, a non-empty public damage
  note and damage types are required, and between 1 and 3 **approved media
  links with `role='damage'`** must exist (an `actual_copy` or
  `primary_fallback` link does **not** satisfy damage evidence);
- confirmed original title and accepted language satisfy public requirements
  (author is optional; anonymous, institutional, edited, dictionary, religious,
  school-guide, and spine-incomplete works may publish without author);
- the row's canonical metadata linkage is either valid or null — an unmatched
  or manually reviewed edition remains a legal publication path (INV-15); and
- the listing projection's quality gate is `ready` and no publication-blocking
  moderation/metadata conflict is unresolved.

The locked server-held inventory row is the sole authority for the public
projection. Observed vision identity, provider payloads, and request-body
values are not projection authority. The candidate's retained
`publication_decision` (`'private'` or `'publish'`) is provenance only; the
Owner's explicit post-commit publication command is the only trigger.

**Eligibility versus transient failure (normative split):** the conditions
above are deterministic, Owner-correctable eligibility gates. A row failing any
of them is reported as a non-retryable, Owner-correctable failure (§7, §15) —
it never enters `publication_failed` and never enqueues a retry job. Only a
transient projection/infrastructure failure after a valid eligibility pass is
reported as `publication_failed` with exactly one retry job.

## 3. Publication input contract

The normative commands:

```text
set_publication_state(
  inventoryId,
  expectedInventoryVersion,
  expectedPublicationIntentVersion,
  intent,            -- 'publish' | 'private' | 'pause'
  idempotencyKey,
  commandId
)

retry_publication(
  inventoryId,
  expectedIntentVersion,
  jobId,             -- service path only
  leaseToken,        -- service path only
  attemptNumber,     -- service path only
  worker,
  idempotencyKey,
  commandId
)

authorize_public_copy_upload(
  inventoryId, role, ordinal,   -- role: 'damage'|'actual_copy'|'primary_fallback'
  bucket, path, envelopeSha256, expiresAt,
  idempotencyKey, commandId
)

submit_public_copy_media(
  inventoryId, capabilityId, mediaAssetId, role, publicOrder,
  idempotencyKey, commandId
)

read_publication_status(inventoryId)
```

Exact transport casing follows the existing Owner Edge/mobile convention
(`phase9-owner-ingestion`). Requests carry no caller-authoritative `storeId`
and no inventory business content. Unknown fields fail closed.

**Dual version contract (normative):** every Owner publication command carries
`expectedInventoryVersion` **and** `expectedPublicationIntentVersion`.
`inventory.version` protects inventory-content concurrency;
`publication_intent_version` protects publication-lifecycle concurrency. Both
are verified under the row lock (§5).

**Request fingerprints** include actor, operation, idempotency key, `commandId`,
inventory ID, both expected versions, and intent.

## 4. Authorization and tenancy

The Edge boundary requires an authenticated user and forwards an ordinary user
authorization context to a narrowly granted authenticated RPC. The normative
authorization/replay order:

1. authenticate the actor;
2. resolve the inventory row through `inventoryId`, derive the store from the
   persisted row, and authorize using the non-enumerating Owner boundary;
3. require an active Owner membership and an active, setup-complete,
   selling-allowed store, plus subscription/entitlement eligibility; and
4. only after successful authorization, check or establish the authorized
   idempotency identity and request fingerprint.

If an authorized completed exact replay exists, the RPC returns its canonical
result before applying current eligibility checks. Otherwise the RPC locks the
inventory row, **reauthorizes and revalidates persisted store/eligibility
relationships and both expected versions under the lock**, then validates
eligibility (§2) before continuing.

The service-role retry path requires a leased `publication_retry` job bound to
that worker with a valid lease token; it may not create or increment inventory
and is governed by the same projection gate.

Unauthorized, cross-store, and inaccessible identifiers use the established
non-enumerating denial/not-found boundary and create no idempotency, listing,
projection, media, audit, or event effect. Clients retain no direct
private-table mutation grant.

**Invariant:** no durable idempotency artifact may be created for an
unauthorized, inaccessible, mismatched-session, or cross-store request.

## 5. Atomic transaction and version model

One database transaction is the Unit 7B business boundary for a
publish/retry/retract command:

1. establish or confirm the authorized in-progress idempotency identity and
   request fingerprint (including `commandId`);
2. lock the inventory row;
3. reauthorize and revalidate persisted store/eligibility relationships under
   the lock;
4. verify `inventory.version` and `publication_intent_version` against the
   expected values under the lock (TOCTOU-safe);
5. validate eligibility (§2) — a deterministic gate failure is a
   non-retryable, Owner-correctable error (category A, §15);
6. for an accepted new publication decision (`publish`, `private`, or
   `pause`): **advance `publication_intent_version` exactly once**, then apply
   the requested transition;
7. for `publish`: run the projection gate, set
   `visibility_status='published'`, let the authoritative sync trigger create
   or refresh exactly one `marketplace_book_listings` row, and set
   `publication_status='published'` (§11 — no separate listing writer);
8. for `private`/`pause`: apply the distinct state semantics (§12), retract or
   block the projection per §11, **atomically cancel/obsolete every
   outstanding `publication_retry` job for this inventory row**, and record
   the outcome;
9. on recognized transient projection failure only (category B, §15): set
   `publication_status='publication_failed'`, enqueue exactly one
   `publication_retry` job (dedupe `publication_retry:<inventoryId>:<intentVersion>`),
   and return `committed_publication_failed` — the private inventory row is
   never touched;
10. record exactly one Unit 7B business audit row and one business event for a
    successful state command (§10); and
11. complete the idempotency row with the canonical response.

**Version semantics (normative):**

```text
inventory.version                = inventory/business-content concurrency
publication_intent_version       = publication lifecycle concurrency
```

- A worker retry is bound to intent version N, locks the current inventory,
  requires `publication_intent_version = N`, then **re-evaluates CURRENT
  inventory eligibility** and publishes current authoritative state — a
  legitimate later price/quantity change does not cause publication of stale
  contents.
- Pause/private advances the intent version (e.g. N+1), so a worker waking
  with job N is STALE and cannot publish — this kills the pause-republish race.
- The forward migration must reconcile the current C11/C12/C26 implementation,
  which checks the expected inventory version pre-lock (not under lock), stores
  the inventory edit version in retry jobs, and does not advance intent version
  on pause/private (§18).

External work (media processing, provider lookups) is deliberately outside the
transaction (WU0B §3).

## 6. Public media

### Damage evidence

Only the following counts toward the required 1–3 damage images:

```text
role = damage
approval_status = approved
sanitization passed
```

An `actual_copy` or `primary_fallback` photo never satisfies damage evidence.

### Primary fallback

Freeze:

```text
0 or 1 primary_fallback per inventory
```

Enforced structurally with a partial/appropriate uniqueness constraint (the
current M03 schema has no role-based uniqueness — `UNIQUE(inventory_id,
media_asset_id)` and `UNIQUE(inventory_id, public_order)` only — so the forward
migration must add it; §18).

Display resolution:

```text
1. canonical/provider cover
2. approved sanitized primary_fallback
3. placeholder
```

An Owner may select an approved `actual_copy` image to become the primary
fallback through an atomic controlled operation. Damage images never
automatically become covers. The forward migration must define sanitized
derivative requirements, promotion destination, public URL resolution,
retraction/revocation, and failure behavior.

## 7. Availability and quantity privacy

Exact physical quantity and reserved/sold/removed buckets remain private.
Public availability uses a friendly band:

```text
available             store has available stock
low_stock             available but quantity is low
confirmation_required store must confirm before payment
unavailable           not sellable / not displayed
```

A published listing must satisfy `quantity_available > 0` at projection time;
exact bucket values are never exposed. Confirmation-before-payment remains a
standing consumer disclosure (DOC-5 §5, §12).

## 8. Idempotency, replay, and retry identity

**Retry identity (normative — the obsolete commit-coupled model is removed):**

```text
publication retry logical identity = inventory_id + publication_intent_version
durable job dedupe key             = publication_retry:<inventoryId>:<publicationIntentVersion>
```

`commandId` and the idempotency key remain request identities for Owner
commands; they are not the fundamental lifecycle identity.

- Same key and same logical command returns the recorded canonical response and
  creates no second listing, projection, media, counter, audit, or event
  effect.
- Same key with a materially changed command fails with
  `P9_IDEMPOTENCY_MISMATCH` — this code must be present in the C11/C12/C26
  operation catalogues (currently omitted; forward correction).
- A retry after the database committed but the response was lost returns the
  recorded result.
- A `published` row cannot be re-published under a new key as a fresh publish;
  the caller receives the existing canonical result only for a valid replay,
  otherwise a non-mutating state/idempotency conflict.

Retry is permitted for transient projection/infrastructure failures only —
never for deterministic eligibility failures (master SDD §8: automated retry
only for transient failures, not policy denial or deterministic rejection).

## 9. Concurrency

The inventory row is the primary business-contention target; the projection row
is derived and never independently contended.

- A stale inventory version or intent version fails before any projection
  write with a refreshable conflict (both re-checked under the row lock).
- Two concurrent publish attempts serialize on the row lock; exactly one wins.
- Retraction and publish serialize on the same row lock.
- A retry worker and an Owner retry cannot both mutate: the worker path
  requires the leased job + matching lease token; the Owner path requires
  current intent version.
- **Pause/private versus leased retry (normative):** `private`/`pause` advances
  `publication_intent_version` and atomically cancels every outstanding
  `publication_retry` job, so a previously leased retry can never republish
  after retraction. This race has a dedicated red test.

## 10. Audit and event ownership

Freeze:

```text
one logical successful publication state command
→ one Unit 7B audit record
→ one Unit 7B business event
```

- Exact replay: +0 audit, +0 event.
- The sync trigger is infrastructure; it does not generate a second semantic
  "book published" event for the same command.
- Retry-worker job lifecycle evidence is operational evidence, separate from
  the business publication event.
- The C26 wrapper delegating publish to C11 does not duplicate C11's effect.

## 11. Projection materialization, retraction, and the single writer path

**One authoritative writer path (normative):**

```text
C11 / C12 / C26
→ controlled publication/state function
→ store_inventory publication transition
→ existing Phase-3-origin sync trigger (M37-corrected implementation)
→ marketplace_book_listings
```

**There must not be another independent listing writer introduced by Unit 7B.**
C11/C12 must not separately upsert `marketplace_book_listings`. The forward
migration replaces/corrects the existing trigger function body and listing
schema mapping as needed — and designates the live trigger (Phase 3 origin,
M37-corrected `public.sync_marketplace_listing_from_inventory()`) as the single
authoritative writer, retiring or explicitly retaining the unused
`marketplace_sec` function.

Every successful publish produces exactly one listing row per `inventory_id`
(`UNIQUE(inventory_id)` preserved). Materialization uses current store-owned
state: public title/authors/language/description/edition/volume/format,
validated ISBNs, condition, `has_damage` + public damage notes/types,
`selling_price_minor`, availability band, `primary_public_media_id`,
`public_media_count` (0–3), `last_inventory_verified_bucket`,
`search_document`, listing/moderation/quality status and timestamps per the
reconciled public contract.

**Retraction (normative):**

- `pause` → `visibility_status='paused'`, listing `status='paused'`,
  `availability='unavailable'`; not discoverable/orderable.
- `private` → `visibility_status='draft'`, projection retracted; if historical
  order/request evidence requires retaining the physical listing row (M37),
  retain it as a non-public historical/tombstone representation.
- Both disappear from consumer discovery; both invalidate old retries.

The projection is a copy/derivation, not a view over the raw row. It never
contains shelf/location, acquisition cost, internal notes, exact quantity,
metadata confidence internals, extraction payloads, duplicate evidence, scan
media, request-photo IDs, or moderation/risk internals (DOC-3 §7, §14; DISC-06).

### Public projection DTO contract (normative — carried-forward decision)

Freeze one safe consumer DTO. The safe projection/RPC maps persisted fields to
this normative public contract; existing physical DB column names do not need
cosmetic renaming:

```text
listingId
storeId
title
authors
language
description
editionStatement
volume
format
isbn10 / isbn13          -- when validated
condition
hasDamage
publicDamageNote
damageTypes
priceMinor
currency
availabilityStatus
coverUrl
publicMediaCount
fulfillmentOptions
status
moderationStatus
qualityStatus
friendlyInventoryFreshnessSignal   -- not the exact private timestamp
```

**Never exposed in the public DTO:**

```text
exact available quantity
reserved / sold / removed quantities
shelf/location
acquisition cost
internal notes
metadata/model confidence
raw provider/model payloads
scan/request media
duplicate evidence/history
private moderation/risk internals
```

The DTO is versioned with the projection/search contract; any field addition or
semantic change requires a separately approved public-contract version
(MKT-15).

## 12. Publication states

- `private`: inventory exists, not public. Unit 7A ends here.
- `publication_pending`: set transiently inside the projection transaction.
- `published`: projection exists, publicly searchable/orderable. This is the
  only state in consumer discovery, mapped to consumer listing status `active`.
- `publication_failed`: transient projection failure after a valid eligibility
  pass; private inventory committed, projection failed; exactly one retry job;
  API outcome `committed_publication_failed` → `P9_PUBLICATION_FAILED` (HTTP
  202, `survivingEffect=private_inventory_committed`,
  `reuseIdempotencyKey=true`).
- **`pause` and `private` are distinct (normative):**

```text
pause   → visibility_status='paused',  publication_status='private'
private → visibility_status='draft',   publication_status='private'
```

Both have `publication_status='private'`, both invalidate old retries, both
disappear from discovery — but `paused` retains the Owner's pause intent in
`visibility_status` and the listing row (`status='paused'`,
`availability='unavailable'`), while `private` fully retracts the projection
(evidence tombstones excepted).

## 13. Public boundary, privacy, and legacy write-path retirement

- Consumer search reads the safe projection view/RPCs only; direct
  `store_inventory`/base-table access is service-role-only.
- The projection view keeps `security_barrier=true` and `security_invoker=true`;
  the three discovery RPCs are the anonymous/authenticated boundary (M10
  pattern — explicit enumerated grants, no broad loops).
- **Legacy write-path retirement (normative):** the pre-Phase-9 manual Owner
  inventory path (`storeInventoryService.publishInventoryItem`/
  `pauseInventoryItem`, and `InventoryItem` publish/pause controls) performs
  direct `store_inventory.visibility_status` updates without C11/C26, versions,
  idempotency, `publication_status`, audit, or events. M05 revoked direct
  authenticated table mutation. These calls must be retired or rewired to the
  controlled commands; a direct-write denial regression test is required. The
  routed Phase 9 inventory screen is read-only and passes no publication
  callbacks.
- **Controlled Owner read boundary (normative):** the Owner UI for Unit 7B
  reads through a forward version of the controlled Owner inventory page RPC
  (`phase9_owner_inventory_page_v2`), never direct table reads. The v2 contract
  exposes at least:

```text
publicationStatus
publicationIntentVersion
visibilityStatus
publicationRetryable
publicationFailureReason    -- bounded Owner-safe enum/message
publicListingStatus         -- if useful
```

  and supports filtering on `publication_failed`, `published`, `private`,
  `paused`. The Owner inventory UI migrates to v2; v1's return contract is not
  mutated.
- Public responses never contain: shelf/location, acquisition cost, internal
  notes, exact quantity, metadata confidence, extraction payloads, duplicate
  resolution history, private request-photo IDs, or moderation/risk internals.
- Public media storage uses policies that do not allow broad bucket listing;
  only approved sanitized public derivatives are promoted.

## 14. Edge, mobile, and retry-worker contract

Unit 7B adds the following positive-allowlist Owner actions to
`phase9-owner-ingestion`:

```text
set_publication_state      -> C26 (publish | private | pause)
retry_publication          -> C12 (Owner path; service path via retry worker)
authorize_public_copy      -> C20 (media upload capability)
submit_public_copy_media   -> C21 (media link, roles damage/actual_copy/primary_fallback)
read_publication_status    -> phase9_publication_status read
```

Each action is online-only, non-optimistic, and not queued offline. The Owner
UI must expose: publication control per inventory row (publish, pause, private),
publication-status display, a retry affordance for `publication_failed`
(inventory-list row action and/or status banner), and the public-copy upload
flow. `publication_failed` is added to the inventory listing-status filter set
(DOC-8 §5). The legacy Phase 4 publish/pause service and screen are retired or
rewired (§13).

### Retry UX contract (normative — carried-forward decision)

Publication controls belong to **inventory**, not scan candidates:

- The inventory row/card shows publication status.
- `publication_failed` shows: a failure badge/status, an Owner-safe failure
  reason, and an inline **Retry publication** action.
- Inventory detail may additionally show a failure banner.
- `publication_failed` is added to the Owner inventory publication-status
  filter.
- **No separate retry screen is created for Unit 7B.**
- Owner-correctable 4xx eligibility failures are **not** presented as "retry
  publication" failures — the UI tells the Owner what must be corrected (e.g.
  set a positive price, add approved damage photos).
- Only the transient `publication_failed` state receives **Retry publication**.

**Retry worker (dedicated `phase9-publication-worker`, token-fenced):**

- `claim_phase9_publication_jobs()` returns:

```text
job_id
lease_token
lease_expires_at
inventory_id
publication_intent_version
attempt_number
```

- C12 (service path) verifies under lock: `job.status='in_progress'`, matching
  job ID, lease token match, lease not expired, `job_kind='publication_retry'`,
  `operation_version = current publication_intent_version`, and worker/attempt
  match. Any failure → no projection mutation.
- Resolve/reschedule/cancel/dead-letter atomically clears the lease/token.
- The M36 worker-wake dispatcher allowlist is extended with
  `publication_retry` (plus wake config, secrets, and deployment contract).
- Bounded backoff/retry classification and max-attempts dead-letter/escalation
  follow the master SDD reliability rules.

## 15. Failure contract

**Eligibility-to-error matrix (normative):**

| Failure | Retry job? | Publication state |
| --- | --- | --- |
| Unauthorized / cross-store | No | unchanged |
| Stale version (inventory or intent) | No | unchanged |
| Price invalid/missing | No | unchanged/private |
| Quantity unavailable | No | unchanged/private |
| Unsellable | No | unchanged/private |
| Missing metadata required for publication | No | unchanged/private |
| Missing/unapproved damage media | No | unchanged/private |
| Store/subscription policy blocked | No | unchanged/private |
| Idempotency mismatch | No | unchanged |
| **Transient projection/runtime failure** | **Yes** | `publication_failed` |
| Unexpected transaction/database failure | No committed retry unless explicitly converted safely | rollback |

**Normative rule: nothing the Owner must correct themselves generates an
automatic retry job.**

Use the existing error registry wherever a matching code exists; add a bounded
publication-ineligible code with safe reason values or map every gate to an
existing registered code, and include all required codes in the C11/C12/C26
catalogues and Edge mappings.

**Three failure categories (normative):**

- **A — Deterministic rejection** (e.g. price = 0): 4xx, no listing, no
  transition to `publication_failed`, no retry job.
- **B — Recognized transient projection failure** (after eligibility passed):
  the controlled function atomically records `publication_status =
  publication_failed`, exactly one retry job, canonical
  `committed_publication_failed` result, and guarantees no live public
  projection survives.
- **C — Unexpected transaction failure** (e.g. audit write fails): rollback
  everything. No half-published state, no false success, no orphan completed
  idempotency result.

**Rollback semantics (normative):** distinguish (1) rollback of the failed
listing/projection subtransaction; (2) unchanged inventory business fields
(price, quantity); (3) committed publication intent/status, retry job, replay
result, audit, and event bookkeeping for category B; (4) full rollback only for
category C.

## 16. Security and privacy

- Tenancy and active Owner authority fail closed in the database boundary.
- Controlled RPCs derive store scope, fixed `search_path`, explicit
  ownership/grants, no direct authenticated base-table mutation dependency.
- RLS remains a backstop; Edge/service credentials do not replace user-context
  Owner authorization.
- The server-held inventory row is the only business-field authority.
- Canonical data is read/reference-only.
- Scan media remains private; only approved sanitized actual-copy/damage
  derivatives become public; no-broad-listing storage policy.
- Direct authenticated mutation of `store_inventory` publication fields is
  denied and regression-tested.
- Audit/event/idempotency data is bounded and secret/media/payload-free.

## 17. Non-goals

Unit 7B excludes: customer commerce, payment, holds, order confirmation
(Phase 6+), post-commit inventory edits (Unit 7C), metadata rematching,
duplicate resolution, publication of unsafe copies, price-on-request, exact
public quantity, sponsored ranking, public reliability scores, dedicated
external search engine, work-level canonical grouping, restoration of direct
public base-table reads, rewriting closed scan-session summaries (§13), and
continuation of the legacy uncontrolled Phase 4 publish/pause path.

## 18. Forward-migration assessment

Verdict: **MIGRATION_REQUIRED** (forward corrections only; never rewrite
applied history). After exact-project read-only preflight, the forward
migration must:

1. **Failure-taxonomy correction:** C11 distinguishes deterministic eligibility
   failures (non-retryable, Owner-correctable 4xx, no retry job) from
   transient projection failures (`publication_failed`, HTTP 202, one retry
   job) — the current catch-all converts every exception to
   `committed_publication_failed`.
2. **Dual version contract:** add `expectedPublicationIntentVersion` to
   publish/private/pause; re-check both versions under lock; advance intent
   version exactly once per accepted decision, including a publish whose
   projection later fails transiently; bind retry identity/dedupe/operation
   version/C12/cancellation to the resulting intent version.
3. **Retraction fence:** C26 `private`/`pause` advances intent version and
   atomically cancels outstanding `publication_retry` jobs.
4. **Audit/event evidence:** C11/C12/C26 emit exactly one business audit + one
   business event per successful state command; replay +0/+0.
5. **Fingerprint completeness:** request fingerprints include `commandId`.
6. **Error-catalogue reconciliation:** add `P9_IDEMPOTENCY_MISMATCH` and any
   missing media/state codes to the C11/C12/C26 catalogues; add the
   eligibility-to-error matrix codes.
7. **Single writer path:** reconcile the Phase 3 trigger + M37-corrected
   `public.sync_marketplace_listing_from_inventory()` as the live authority;
   extend/replace that trigger body and listing mapping; retire or explicitly
   retain the unused `marketplace_sec` function; ensure C11/C12 do not upsert
   listings directly; keep failure observable (no silent divergence).
8. **`primary_public_media_id` population:** populate from approved
   `primary_fallback` media; add the 0-or-1 per-inventory uniqueness; define
   sanitization/promotion/URL-resolution/retraction behavior.
9. **Damage-evidence role scoping:** only `role='damage'` approved media counts
   toward the damage gate (current gate counts any approved media).
10. **Legacy path retirement:** retire/rewire `storeInventoryService`
    publish/pause and legacy screen; add direct-write denial test.
11. **Controlled read boundary:** add `phase9_owner_inventory_page_v2` exposing
    publication status/intent/failure state and `publication_failed` filtering;
    migrate the Owner UI; define list/detail/summary cache invalidation after
    C11/C12/C26.
12. **Closed-session summary fix:** freeze scan-session summaries at
    session-close semantics (M29 currently joins current inventory publication
    state — later publish/pause must not change historical `privateItems` /
    `publishedItems`); add invalidation/refetch rules.
13. **Worker fencing + wake:** add `claim_phase9_publication_jobs` (job ID,
    lease token, expiry, inventory, intent version, attempt) and C12 lease-token
    validation; add `publication_retry` to the M36 dispatcher allowlist.
14. Preserve `UNIQUE(inventory_id)` cardinality, Phase 6 order-evidence
    retraction behavior, and all existing denial tests.

## 19. Load-bearing red-test contract

The red-first implementation gate is specification-only at freeze:

1. **Eligibility authority:** projection matches the locked inventory row; the
   command cannot submit substitute public fields.
2. **Positive-price/sellability gate:** `price<=0`, `quantity_available<=0`, or
   `is_sellable=false` fails as deterministic, non-retryable,
   Owner-correctable — no projection write, no retry job.
3. **Damage-evidence gate:** `has_damage=true` without a non-empty public
   damage note and 1–3 approved `role='damage'` links fails; `actual_copy`
   media does not satisfy damage evidence; no retry job.
4. **Tenancy/non-enumeration:** unauthenticated, inactive-Owner, cross-store,
   inaccessible attempts create no observable business/idempotency effect.
5. **Dual version fence under lock:** stale inventory or intent version is
   rejected before any projection write, both re-checked under the row lock;
   identical inventory versions with competing intent versions are
   distinguished.
6. **One-projection cardinality:** one publish creates/refreshes exactly one
   listing row for the inventory.
7. **Exact replay:** same command/key after response loss returns the same
   canonical IDs/outcome with one projection/counter/audit/event effect.
8. **Changed replay / idempotency mismatch:** same key with changed
   identity/version (`commandId`, versions, intent) is rejected with
   `P9_IDEMPOTENCY_MISMATCH`; no additional effect.
9. **Retry non-mutation:** C12 retry (Owner and worker paths) proves
   `mayWriteInventory=false` — no inventory create/increment, no second
   listing, no quantity change.
10. **Transient-only retry:** deterministic eligibility failure never enqueues
    a retry job; a transient projection failure enqueues exactly one job keyed
    on publication intent version.
11. **Retraction and evidence preservation:** `pause` sets visibility `paused`
    + listing paused/unavailable; `private` sets `draft` and retracts (M37
    paused/blocked/out_of_stock behavior fully asserted); both disappear from
    consumer search; inventory untouched.
12. **Pause-versus-leased-retry race:** a leased retry cannot republish after
    `private`/`pause`; intent-version advance + job cancellation fence holds.
13. **Public-boundary privacy:** projection/discovery RPCs never return exact
    quantity, shelf/location, cost, internal notes, scan/request media, or
    moderation/risk internals.
14. **Unmatched/manual publication:** a reviewed unmatched edition with
    positive price and valid condition publishes without canonical linkage.
15. **Retry worker lifecycle:** claim (job ID, lease token, expiry, intent
    version, attempt), C12 token-fenced invocation, cross-kind claim isolation,
    expired-token rejection, stale same-worker attempt rejection,
    transient-vs-deterministic classification, backoff, max-attempt
    dead-letter/escalation, wake scheduling, changed-intent cancellation —
    each tested; dedupe key prevents duplicate retries.
16. **Legacy write-path denial:** authenticated client cannot directly mutate
    `store_inventory` publication fields; publication only through controlled
    commands.
17. **Public media contract:** `primary_public_media_id` population,
    0-or-1 cardinality, fallback ordering (canonical → actual-copy →
    placeholder), sanitization/promotion, safe URL resolution,
    no-broad-listing storage policy, damage-role-only evidence.
18. **Closed-session summary freeze:** later publish/pause/retry does not
    change historical `privateItems`/`publishedItems`; summary invalidation/
    refetch behaves per contract.
19. **Controlled read boundary v2:** `phase9_owner_inventory_page_v2` exposes
    publication status/intent/failure state and filters
    `publication_failed|published|private|paused`; v1 contract unchanged.
20. **Audit/event ownership:** one successful state command → one audit + one
    event; exact replay +0/+0; sync trigger emits no duplicate business event.

No customer-commerce, post-commit-edit, or canonical-mutation test belongs to
Unit 7B.

## 20. Acceptance criteria

| ID | Criterion |
| --- | --- |
| U7B-AC01 | Only an authenticated authorized Owner can publish, pause, retract, or retry in the server-derived store. |
| U7B-AC02 | The locked inventory row is the only authority for the public projection. |
| U7B-AC03 | Each successful publish produces exactly one listing row per inventory row; no second row or inventory write. |
| U7B-AC04 | Deterministic eligibility failures (price, quantity, sellability, damage evidence) are Owner-correctable and never enqueue retry. |
| U7B-AC05 | Transient projection failure sets `publication_failed`, enqueues exactly one retry job, and never repeats the inventory effect; `P9_PUBLICATION_FAILED` → HTTP 202, retryable, surviving private inventory, same-key reuse. |
| U7B-AC06 | Same-command replay is canonical; changed replay fails with `P9_IDEMPOTENCY_MISMATCH`; response loss cannot duplicate listings. |
| U7B-AC07 | Exact quantity, shelf/location, cost, internal notes, and scan/request media never appear in public responses. |
| U7B-AC08 | Manual/unmatched reviewed metadata can publish without canonical mutation. |
| U7B-AC09 | Pause (visibility `paused`) and private (visibility `draft`) are distinct; both disappear from discovery, both fence outstanding retries, evidence tombstones preserved. |
| U7B-AC10 | The retry worker consumes `publication_retry` jobs with lease-token fencing, classifies transient vs deterministic failure, and cannot create or increment inventory. |
| U7B-AC11 | Public media follows the frozen rules: damage-role-only evidence, 0-or-1 `primary_fallback`, approved fallback order, sanitized promotion, safe URL resolution. |
| U7B-AC12 | The legacy Phase 4 direct publish/pause path is retired/rewired and direct authenticated publication writes are denied. |
| U7B-AC13 | Closed scan-session summaries are frozen at session-close semantics; later publication changes do not rewrite history. |
| U7B-AC14 | The Owner UI reads through `phase9_owner_inventory_page_v2` with publication status/intent/failure state and the full filter set. |

**Unit 7B passes when** the completion definition in §1 is demonstrated live:
Owner publish → anonymous discovery sees one listing → pause removes it →
stale leased retry cannot resurrect it → republish shows exactly one listing;
deterministic failure creates no retry job; forced transient failure creates
one `publication_failed`, one retry job, worker retry, exactly one published
listing, and unchanged inventory quantity/identity.

## 21. Frozen decisions (2026-08-12)

All twelve round-2 review findings are resolved as normative contract in this
document:

1. **Dual version model** — §3, §5: `inventory.version` + `publication_intent_version`, both verified under lock, intent advanced per decision.
2. **Retry identity** — §8: `inventory_id + publication_intent_version`; dedupe `publication_retry:<inventoryId>:<intentVersion>`; commitId removed.
3. **Worker fencing** — §14: `claim_phase9_publication_jobs` + lease token; C12 validates exact lease; M36 allowlist extended.
4. **Controlled read boundary** — §13: `phase9_owner_inventory_page_v2` with publication state + filters; no direct reads.
5. **Closed-session summary** — §13, §18, AC13: frozen at session-close; M29 corrected; later publication does not rewrite history.
6. **Public media** — §6: damage-role-only evidence; 0-or-1 `primary_fallback`; frozen fallback order; migration required.
7. **Eligibility/error matrix** — §15: full matrix; nothing Owner-correctable enqueues a retry.
8. **Rollback semantics** — §15: three categories (deterministic rejection, recognized transient, unexpected); bookkeeping vs business fields separated.
9. **Pause vs private** — §12: genuinely distinct (`paused` vs `draft` visibility), both private publication, both fence retries.
10. **Audit/event ownership** — §10: one command → one audit + one event; replay +0/+0; trigger is infrastructure.
11. **Projection writer** — §11: one authoritative writer path only (controlled command → state transition → existing sync trigger → listing); no independent writer.
12. **DOC-4 authority** — resolved (authority line above includes DOC-4).
13. **Public projection DTO contract** — §11: one normative consumer DTO with the
    exact exposed/never-exposed field lists; physical column names need no
    cosmetic rename; the safe projection/RPC maps persisted fields to the DTO.
14. **Retry UX** — §14: publication controls belong to inventory (not scan
    candidates); `publication_failed` shows a badge, Owner-safe reason, and
    inline **Retry publication**; optional detail banner; no separate retry
    screen; Owner-correctable 4xx failures are shown as corrections, not retry;
    only transient `publication_failed` receives Retry.

**Freeze gate:** the status line above marks this document frozen. Implementation
red tests, migration creation/application, deployment, and any live mutation
each require separate explicit authorization.
