# WU0B State, Transaction, Idempotency, and Publication Design

**Status:** `implementation_complete_needs_review`
**Rule:** external calls never participate in database transactions

## 1. State ownership

| Aggregate | States / transition owner | Stale, replay and terminal behavior |
| --- | --- | --- |
| Session | initiating Owner: create, `active→closing→closed`; system: `active→expired` only under approved inactivity/terminal-input policy | Close with nonterminal inputs leaves `active`; successful closing rejects new input; expected version required; replay returns recorded summary; closed/expired terminal |
| Input | Owner submits accepted input; worker moves queued/processing to terminal `completed|no_books|rejected|failed` | duplicate content/idempotency returns existing input/job; stale session cannot accept; terminal outcome immutable except audited forward correction |
| Candidate | worker creates staged candidate; initiating Owner moves `detected|needs_review→reviewed→committed_private` or `skipped_false_detection`; manual candidate begins staged | stale version returns conflict; one commit action per candidate; Close leaves uncommitted candidates `needs_review`; committed/skipped terminal for session workflow |
| Publication | Owner intent `private|publish|pause`; projection result `pending→published|failed|retracted`; worker may retry failed/pending | retry reuses publication identity and cannot mutate inventory; failure records truthful private surviving effect |
| Request photo | customer `not_requested→requested`; Owner `requested→uploading→provided|unfulfilled`; customer `provided→accepted|declined`; expiry/system paths only if approved | item/request expected version; replay canonical; upload does not equal provided; terminal customer decision cannot be overwritten |
| Job | `queued→claimed→succeeded|retry_wait|dead_letter`; expired lease permits controlled reclaim | task identity unique; claim owner+expiry required to finish; max attempts; completed/dead terminal |
| Media | `registered→validating→sanitized→linked|rejected`; lifecycle `eligible_for_delete→deleted` with hold blocks | purpose immutable; cross-purpose link rejected; deletion idempotent and leaves non-content evidence |

Exact database enum/check representation is `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 2. Transaction boundaries

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
| Request photo | photo substate/link/decision plus named existing Phase 6 recalculation/release seam | upload transfer and image processing | request/item version and existing Phase 6 command locks |
| Job claim/finish | claim batch or one terminal/retry result and cost/usage outcome | provider/storage call | `FOR UPDATE SKIP LOCKED`, lease owner/expiry, attempt version |
| Lifecycle delete | recheck links/holds, state/evidence update | object deletion occurs between prepare/finalize transactions | media version, link existence, legal/dispute/security holds |

## 3. Optimistic concurrency and idempotency

Every stateful command carries the aggregate’s expected integer version. SQL design must update under `id = target AND version = expected`, increment exactly once, and distinguish not-found from authorization without leaking existence. Multi-aggregate commands lock in a documented global order: request/session, candidate, inventory, active holds, projection/intent, audit/idempotency. The exact order must be validated against live constraints before database design.

The idempotency record design contains actor/service identity, operation, key, canonical request fingerprint, target IDs, status `in_progress|completed|failed_terminal`, canonical response/error, surviving-effect classification, and timestamps/expiry policy. Same key+fingerprint returns the canonical outcome without repeating external cost or mutation. Same key+different fingerprint returns `P9_IDEMPOTENCY_MISMATCH`. A retryable external failure reuses the original key and attempt lineage; a new business decision uses a new command ID/key.

## 4. Quantity and duplicate rules

The invariant is always:

`quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed`

C09 increments only total and available by the same positive bounded quantity. C23 may perform only a closed, approved bucket transfer preserving equality and existing active holds. It cannot reduce reserved below live holds or convert sold/removed back without a separately approved correction command. The current `NOT VALID` constraint, existing row compliance, trigger/function interactions and exact column names are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

Duplicate advice is same-store, advisory, and recomputed under lock from stable bibliographic/edition/format/condition compatibility. Scan images and private request photos never contribute. `create_private`, `increment_match`, and `create_separate` are closed discriminated actions; the server rejects a stale target/advice snapshot and never auto-merges.

## 5. Private commit and publication

Private inventory commit is authoritative and completes before publication. It requires complete Owner review and produces a private inventory identity even when projection later fails. Publication reauthorizes current store membership, approved metadata/media, condition/damage disclosure, sellability, quantity eligibility and public-store eligibility.

If projection fails after private commit, the canonical command result is `committed_publication_failed`, mapped through `P9_PUBLICATION_FAILED` HTTP 202 with `private_inventory_committed`. The response exposes inventory ID, current private state, publication status/error code and retry availability—not a false published result or internal error. C12 retries only the projection using the original publication identity and `mayWriteInventory=false`; tests must prove it cannot create/increment inventory.

Pause/private intent retracts only the public projection. Retraction failure is recorded truthfully and retried without corrupting private inventory. The exact projection trigger/function compatibility and unique identity are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 6. Controlled post-commit editing

| Action | Mutable scope | Required secondary effect | Forbidden effect |
| --- | --- | --- | --- |
| C22 metadata | store snapshot bibliographic fields only | rematch, duplicate re-evaluation, eligibility/reprojection intent | shared canonical mutation or provider field stitching |
| C23 quantity | approved bucket transfer | lock holds and preserve equality | direct exact-public quantity exposure |
| C24 commercial details | price, shelf/location, classified public/internal notes | refresh projection only for public fields | shelf/internal note in public DTO/event |
| C25 condition/damage/media | vocabulary, disclosure, sellability, approved public links | atomically retract/block newly ineligible listing | request/scan media link or silent disclosure removal |
| C26 publication state | private/publish/pause intent | C11/C12 projection semantics | quantity or inventory identity mutation |

## 7. Failure-surviving-effect classes

`none` means the transaction rolled back. `capability_issued` means only a short-lived capability exists. `private_media_staged` means sanitized unlinked private media may await cleanup. `private_inventory_committed` means inventory exists privately while publication failed. `phase6_request_recalculated` means only the named pre-payment request/hold recalculation committed. Every error catalogue entry and canonical response declares exactly one class; generic 500 responses may not conceal a known surviving effect.
