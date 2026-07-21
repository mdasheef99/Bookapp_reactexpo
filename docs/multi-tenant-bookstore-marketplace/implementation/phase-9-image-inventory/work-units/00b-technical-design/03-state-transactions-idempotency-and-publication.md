# WU0B State, Transaction, Idempotency, and Publication Design

**Status:** `independently_approved`
**Rule:** external calls never participate in database transactions

## 1. Authoritative persisted-state mapping

The Master SDD §6 is the sole persisted vocabulary for Phase 9 extraction sessions, inputs and candidates. UI labels, job outcomes and domain groupings below never create a second persisted vocabulary.

| Area | Persisted database values | Domain grouping / derived UI or terminal outcome |
| --- | --- | --- |
| Session | `active`, `closing`, `closed`, `expired` | UI “in progress”=`active`; “finishing”=`closing`; terminal=`closed|expired` |
| Image input | `uploaded`, `validating`, `queued`, `processing`, `ready`, `failed`, `skipped` | `no_books` and wrong-language are bounded outcome codes on terminal `skipped`; invalid/quality/provider exhaustion are outcome codes on terminal `failed`; never persisted as states |
| Candidate | `processing`, `ready`, `needs_review`, `possible_duplicate`, `failed`, `commit_in_progress`, `committed` | enrichment/review are groupings over these values; Owner-reviewed is snapshot/version evidence, not state; `committed_publication_failed` is the commit response/publication outcome on persisted `committed` candidate |
| Extraction job | No exact Phase 9 persisted values approved by the Master/Extraction SDD | `queued/claimed/retryable/terminal/dead-letter` are job-domain groupings only; exact values are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN` |
| Enrichment | Uses candidate persisted values above | processing=`processing`; manual/needs review=`needs_review`; coherent result=`ready`; duplicate advice=`possible_duplicate`; terminal failure=`failed` |
| Review/commit | Uses candidate persisted values above | review snapshot does not change vocabulary; atomic commit uses `ready|needs_review|possible_duplicate→commit_in_progress→committed|failed` |
| Publication | Candidate remains `committed`; inventory/projection records carry separately versioned intent/outcome | `private|publish|pause` are intent values; `pending|published|failed|retracted` are design outcome groupings pending audit, not claimed Master persisted states |
| Request photo | Owning Photo SDD values: `none`, `requested`, `uploading`, `provided`, `accepted`, `declined`, `unfulfilled`, `expired` | Owner confirmation and active-soft-hold are separate request/proposal facts; `provided` alone is not customer-acceptable |
| Media | Purpose values `scan_input`, `public_copy`, `customer_request`; exact lifecycle state values not fixed by an approved SDD | validation/sanitized/linked/rejected/deletion are domain groupings; exact persisted values are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN` |
| Holds | Phase 6 `hold_type='soft'|'firm'`; persisted status is `active`, `released`, or `converted_to_sale` | Expiry is an operation/outcome that releases an active hold; it is not a persisted hold status. Soft means awaiting customer decision; firm means accepted/payment window; neither is payment/order/sale |

## 2. Authoritative transition matrix

| Source persisted state | Command | Target persisted state | Actor; preconditions | Replay / invalid transition | Event | Transaction owner |
| --- | --- | --- | --- | --- | --- | --- |
| absent | C01 | session `active` | initiating Owner; eligible store/no conflicting policy | canonical session / `P9_STATE_CONFLICT` | `session.started` | future session-create RPC |
| session `active` | C04 | `closing→closed` atomically | initiator; every input terminal | recorded summary / `P9_STATE_CONFLICT` while nonterminal | `session.close_requested`, `session.closed` | future close RPC |
| session `active` | approved system expiry | `expired` | system policy; terminal-input/inactivity/retention guards | recorded expiry / conflict if state changed | `session.expired` | future lifecycle RPC |
| absent | C03 | input `uploaded` | initiator; capability/media/session verified | existing input/job / mismatch conflict | `input.accepted` | future accept-input RPC |
| input `uploaded` | media-validation worker | `validating` | claimed job and matching version | canonical claim/result / stale worker denied | `input.validation_started` | future input-state RPC |
| input `validating` | validation success | `queued` | sanitized image and policy pass | canonical result / invalid transition | `input.queued` | future input-state RPC |
| input `validating` | rejection | `failed|skipped` | bounded failure/outcome mapping | canonical terminal / terminal conflict | `input.failed|skipped` | future input-state RPC |
| input `queued` | vision claim | `processing` | claimed extraction job | canonical claim / stale lease denied | `input.processing` | future claim/state RPC |
| input `processing` | terminal extraction | `ready|failed|skipped` | strict validated output; `no_books` maps `skipped` | canonical terminal / terminal conflict | `input.ready|failed|skipped` | future input-state RPC |
| absent | normalized candidate creation | candidate `processing` | validated input result; ordinal under cap | existing ordinal / fingerprint conflict | `candidate.processing` | future candidate-create RPC |
| candidate `processing` | enrichment/duplicate policy | `ready|needs_review|possible_duplicate|failed` | strict local/provider evidence; Owner review still required | canonical result / version conflict | `candidate.ready|needs_review|possible_duplicate|failed` | future candidate-state RPC |
| candidate `ready|needs_review|possible_duplicate` | C05/C13 | same approved candidate state | initiator; expected version; review/reason snapshot | recorded snapshot / `P9_CANDIDATE_VERSION_CONFLICT` | `candidate.review_updated|needs_review` | future review RPC |
| candidate `ready|needs_review|possible_duplicate` | C08-C10 | `commit_in_progress→committed|failed` | complete Owner review; duplicate/quantity locks | canonical commit / version or duplicate conflict | `candidate.committed_private|commit_failed` | future commit RPC |
| photo `none` | C14 | `requested` | owning customer; unpaid eligible item | canonical request / state conflict | `photos.requested` | future photo-request RPC |
| photo `requested|uploading` | C15/C16 | `uploading` | owning-store Owner; purpose-bound media | canonical capability/supply / version conflict | `photos.upload_authorized|supplied` | future photo command RPC |
| photo `uploading` | C27 | `provided` or remains `uploading` on failure | claimed worker; all supplied media valid for success | canonical job / stale lease denied | `photos.media_validated|validation_failed` | future media-result RPC |
| photo `provided` | C28+C30 | photo stays `provided`; request→`awaiting_customer_decision`; soft hold active | owning-store Owner; current qty/price/terms; available stock | canonical proposal / stale/quantity/policy conflict | `photos.owner_confirmed`, `photos.soft_hold_created|refreshed` | existing-compatible Phase 6 Owner-confirmation RPC |
| photo `provided` + active soft hold | C17 | `accepted`; request may→`payment_ready`; soft→firm | owning customer; current proposal/version/unexpired hold/all guards | canonical acceptance / stale/hold/state conflict | `photos.accepted` | existing Phase 6 customer-accept RPC |
| photo `provided` + proposal | C18 | `declined`; soft hold released | owning customer; current version | canonical decline / stale conflict | `photos.declined` | existing Phase 6 decline/recalc RPC |
| photo nonterminal | C19 | `unfulfilled`; soft hold released | owning-store Owner; bounded reason | canonical unfulfilled / terminal conflict | `photos.unfulfilled` | existing-compatible Phase 6 unavailable RPC |
| photo `provided` + expired soft hold | C29 | `expired`; hold released | claimed expiry task; expiry reached/version current | canonical expiry / state changed no-op | `photos.hold_expired`, `photos.expired` | existing Phase 6 expiry RPC |

Every transition uses expected version and idempotency. Values outside the approved persisted lists fail document validation and, later, database CHECK/enum validation.

## 3. Transaction boundaries

| Boundary | Atomic contents | Deliberately outside transaction | Locks / conflict predicate |
| --- | --- | --- | --- |
| Start/close session | session/default snapshot or closing+summary+closed | uploads/providers/jobs execution | active-session uniqueness; session expected version |
| Accept input | capability consumption, input link, job/cost reservation identity | object validation bytes already complete; worker/provider call | capability/session/input identity |
| Candidate review/skip/manual | one candidate snapshot/state and audit/event | provider enrichment | candidate/session expected version |
| Private create | locked duplicate recomputation, private inventory create, quantity buckets, candidate link, audit/event | publication/projection | candidate + compatible inventory identity locks |
| Increment match | locked target/candidate, total+available increment, candidate link, audit/event | publication | candidate and inventory expected versions; active holds considered |
| Separate create | advisory snapshot verification, new private inventory, candidate link | publication | candidate expected version and duplicate identity lock |
| Publication intent/result | intent record; separate safe projection upsert/retract and outcome | no provider/model/media processing | inventory+intent/projection versions; unique inventory projection |
| Post-commit edit | named store fields, version, audit/event; safe projection refresh/retract where inseparable | rematch/provider work queued separately | inventory and relevant hold/projection locks |
| Request photo supply/validation | C16 pending links/job identity; C27 validation result and `provided` only after all media pass | upload transfer and image processing | photo/media/job/request versions and lease |
| Request photo Owner confirmation | C28 current quantity/price/terms plus C30 soft hold and `awaiting_customer_decision` atomically | no media/provider work | request, item, inventory and existing holds; Phase 6 global lock order |
| Request photo customer decision/expiry | C17/C18/C19/C29 use existing Phase 6 accept/decline/unavailable/expiry seams; promote or release holds atomically | no payment-provider/paid-order work | request/item/inventory/hold/task versions and Phase 6 locks |
| Job claim/finish | claim batch or one terminal/retry result and cost/usage outcome | provider/storage call | `FOR UPDATE SKIP LOCKED`, lease owner/expiry, attempt version |
| Lifecycle delete | recheck links/holds, state/evidence update | object deletion occurs between prepare/finalize transactions | media version, link existence, legal/dispute/security holds |

## 4. Optimistic concurrency and idempotency

Every stateful command carries the aggregate’s expected integer version. SQL design must update under `id = target AND version = expected`, increment exactly once, and distinguish not-found from authorization without leaking existence. Multi-aggregate commands lock in a documented global order: request/session, candidate, inventory, active holds, projection/intent, audit/idempotency. The exact order must be validated against live constraints before database design.

The idempotency record design contains actor/service identity, operation, key, canonical request fingerprint, target IDs, status `in_progress|completed|failed_terminal`, canonical response/error, surviving-effect classification, and timestamps/expiry policy. Same key+fingerprint returns the canonical outcome without repeating external cost or mutation. Same key+different fingerprint returns `P9_IDEMPOTENCY_MISMATCH`. A retryable external failure reuses the original key and attempt lineage; a new business decision uses a new command ID/key.

## 5. Quantity and duplicate rules

The invariant is always:

`quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed`

C09 increments only total and available by the same positive bounded quantity. C23 may perform only a closed, approved bucket transfer preserving equality and existing active holds. It cannot reduce reserved below live holds or convert sold/removed back without a separately approved correction command. The current `NOT VALID` constraint, existing row compliance, trigger/function interactions and exact column names are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

Duplicate advice is same-store, advisory, and recomputed under lock from stable bibliographic/edition/format/condition compatibility. Scan images and private request photos never contribute. `create_private`, `increment_match`, and `create_separate` are closed discriminated actions; the server rejects a stale target/advice snapshot and never auto-merges.

## 6. Private commit and publication

Private inventory commit is authoritative and completes before publication. It requires complete Owner review and produces a private inventory identity even when projection later fails. Publication reauthorizes current store membership, approved metadata/media, condition/damage disclosure, sellability, quantity eligibility and public-store eligibility.

If projection fails after private commit, the canonical command result is `committed_publication_failed`, mapped through `P9_PUBLICATION_FAILED` HTTP 202 with `private_inventory_committed`. The response exposes inventory ID, current private state, publication status/error code and retry availability—not a false published result or internal error. C12 retries only the projection using the original publication identity and `mayWriteInventory=false`; tests must prove it cannot create/increment inventory.

Pause/private intent retracts only the public projection. Retraction failure is recorded truthfully and retried without corrupting private inventory. The exact projection trigger/function compatibility and unique identity are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 7. Controlled post-commit editing

| Action | Mutable scope | Required secondary effect | Forbidden effect |
| --- | --- | --- | --- |
| C22 metadata | store snapshot bibliographic fields only | rematch, duplicate re-evaluation, eligibility/reprojection intent | shared canonical mutation or provider field stitching |
| C23 quantity | approved bucket transfer | lock holds and preserve equality | direct exact-public quantity exposure |
| C24 commercial details | price, shelf/location, classified public/internal notes | refresh projection only for public fields | shelf/internal note in public DTO/event |
| C25 condition/damage/media | vocabulary, disclosure, sellability, approved public links | atomically retract/block newly ineligible listing | request/scan media link or silent disclosure removal |
| C26 publication state | private/publish/pause intent | C11/C12 projection semantics | quantity or inventory identity mutation |

## 8. Failure-surviving-effect classes

`none` means the transaction rolled back. `capability_issued` means only a short-lived capability exists. `private_media_staged` means sanitized unlinked private media may await cleanup. `private_inventory_committed` means inventory exists privately while publication failed. `phase6_request_recalculated` means only the named pre-payment request/hold recalculation committed. Every error catalogue entry and canonical response declares exactly one class; generic 500 responses may not conceal a known surviving effect.
