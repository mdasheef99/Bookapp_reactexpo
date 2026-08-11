# Unit 7A SDD: Create-Only Scanned-Candidate Inventory Commit

**Status:** normative design frozen 2026-08-12; implementation not started
**Authority:** Owner decision 2026-08-12; DOC-3, DOC-4, DOC-8; Phase 9 master SDD; SDD 03
**Implementation authority:** none; red-test specification is the next separately authorized step
**Migration authority:** planning conclusion only; no migration file creation or application authorized

## 1. Purpose and scope

Unit 7A owns one atomic transition from an eligible, Owner-reviewed scanned
candidate to one newly created private `store_inventory` row. The Owner must
explicitly press **Add to Inventory** for each candidate. No model, worker,
session close, or batch action may commit inventory automatically.

Unit 7A includes the controlled Edge/mobile command, authenticated database
boundary, candidate/review/version fencing, authoritative saved-review loading,
create-new materialization, quantity initialization, one-to-one provenance,
candidate terminalization, audit/event evidence, idempotency, response-loss
replay, and canonical response.

Unit 7B owns publication eligibility, public projection, public media, and
publication failure/retry. Unit 7C owns every post-commit inventory edit.

## 2. Eligible candidate and authoritative state

A candidate is commit-eligible only when all of the following remain true while
the candidate row is locked:

- it belongs to the supplied session and the server-derived Owner store;
- `state='ready'`, `review_disposition='reviewed'`, and `review_ready=true`;
- its candidate version, review version, and metadata revision equal the
  command's expected values;
- the saved `owner_review_snapshot.value` passes the current strict Owner-review
  contract and contains confirmed title and every confirmed author;
- metadata choice is either the current candidate-owned selected metadata
  snapshot or valid reviewed manual/unmatched metadata;
- reviewed quantity `q` is an integer `>= 1` within the existing bounded review
  contract; and
- current strict-review blockers and stale source evidence remain resolved;
  an Owner-confirmed unsellable copy remains valid for private inventory and
  cannot be coerced into publication.

The locked server-held saved review is the sole authority for inventory business
fields. Observed vision identity and request-body values are not commit
authority. The saved `publicationIntent` is retained as candidate/commit
provenance for Unit 7B, but Unit 7A does not act on it.

Duplicate advice and `duplicateIntent`, where present in legacy Unit 6 data, are
**SUPERSEDED FOR UNIT 7A**. They neither authorize nor block the create-only
commit. Before the 7A client action is enabled, the candidate review contract/UI
must stop presenting duplicate choices as actionable 7A inputs and must not
require `duplicateIntent` to save an otherwise valid review. Existing columns
and historical values remain untouched.

## 3. Commit input contract

The normative command is conceptually:

```text
add_candidate_to_inventory(
  sessionId,
  candidateId,
  expectedCandidateVersion,
  expectedReviewVersion,
  expectedMetadataRevision,
  idempotencyKey,
  commandId
)
```

Exact transport casing follows the existing Owner Edge/mobile convention. The
request carries no caller-authoritative `storeId` and no title, authors,
language, metadata fields, price, quantity, condition, damage, shelf/location,
notes, sellability, publication action, duplicate action, or target inventory.
Unknown fields fail closed.

## 4. Authorization and tenancy

The Edge boundary requires an authenticated user and forwards an ordinary user
authorization context to a narrowly granted authenticated RPC. The normative
authorization/replay order is:

1. authenticate the actor;
2. resolve the candidate through `candidateId` and `sessionId`, derive
   `candidate -> session -> store` from persisted relations, and authorize using
   the non-enumerating Owner boundary;
3. require the session's initiating Owner where the current pilot contract
   requires initiator-only mutation;
4. authorize an active Owner membership and an active, setup-complete,
   selling-allowed store; and
5. only after successful authorization, check or establish the authorized
   idempotency identity and request fingerprint.

If an authorized completed exact replay exists, the RPC returns its canonical
result before applying current `ready`-state eligibility checks. This preserves
response-loss recovery for a candidate that correctly became `committed` in the
original transaction. Otherwise the RPC locks the candidate, reauthorizes and
revalidates the persisted candidate/session/store relationships under lock,
then validates current candidate, review, and metadata revisions before
continuing the create-only transaction. Any caller store hint is absent and
non-authoritative.

Unauthorized, cross-store, mismatched-session, and inaccessible identifiers use
the established non-enumerating Owner denial/not-found boundary and create no
idempotency, inventory, candidate, audit, or event effect. Clients retain no
direct private-table mutation grant.

**Invariant:** no durable idempotency artifact may be created for an
unauthorized, inaccessible, mismatched-session, or cross-store request.
Implementation may arrange existing authorization/idempotency helpers
differently internally only if this ordering and its observable effects hold.

## 5. Atomic transaction

After authentication, initial relationship resolution, authorization, and the
authorized completed-replay check in §4, one database transaction is the Unit
7A first-commit business boundary:

1. establish or confirm the authorized in-progress idempotency identity and
   request fingerprint;
2. lock the candidate;
3. reauthorize and revalidate persisted candidate/session/store relationships
   under lock;
4. validate candidate, review, and metadata versions and first-commit
   eligibility;
5. load and validate the authoritative saved review and current selected/manual
   metadata state;
6. create exactly one new private inventory row;
7. initialize all quantity buckets from reviewed `q`;
8. record candidate-to-inventory and inventory-to-candidate provenance;
9. set the candidate to `committed` and record the bounded commit outcome;
10. update the session committed count exactly once;
11. append bounded audit/event evidence; and
12. complete the idempotency row with the canonical response.

Any failure before transaction commit rolls back every listed effect. No
inventory row, provenance, candidate transition, session count, audit/event, or
completed replay result may survive partially. Authorization failure before the
transaction leaves no durable idempotency artifact. A completed authorized
exact replay follows §4 and is not rejected merely because the original commit
already changed the candidate from `ready` to `committed`.

## 6. Create-new inventory materialization

Every successful command creates one new inventory identity:

```text
reviewed candidate C -> newly created private inventory row I
```

The command never searches for, targets, locks, merges into, or increments an
existing inventory row. Repeated candidates for the same title, edition, or ISBN
create separate inventory rows.

Materialization uses the current reviewed store-owned state:

- confirmed title, confirmed authors, original language, and applicable script;
- current selected coherent metadata fields and canonical/source references when
  selected, including validated ISBN/publisher/date/description/edition/volume/
  format/cover fields that the inventory schema and provider rights permit;
- reviewed manual/unmatched identity when no canonical edition is selected;
- price, base condition, structured damage, sellability, shelf/location,
  public/internal notes, and reviewed quantity;
- `entry_method='image_extraction'`, session/candidate origin, actor, current
  metadata snapshot/version lineage, and retained publication intent; and
- private visibility/publication state with no listing ID or public-media link.

Materially different copies are separate candidates/inventory rows. Reviewed
`q > 1` is the Owner's assertion that the copies within this one new row are
interchangeable under its reviewed edition/identity, condition, damage, price,
and other materially copy-specific attributes.

## 7. Quantity

For reviewed quantity `q >= 1`, the new row is initialized exactly as:

```text
quantity_total     = q
quantity_available = q
quantity_reserved  = 0
quantity_sold      = 0
quantity_removed   = 0
```

Every 7A-created row must therefore satisfy:

```text
quantity_total = quantity_available + quantity_reserved
               + quantity_sold + quantity_removed
```

Unit 7A guarantees equality through its create values and transaction tests.
It does not strengthen, validate, or repair the global historical database
constraint. The previously deferred M09/global validation remains a separate
scope requiring a fresh read-only violation preflight and separate authority;
no historical repair is inferred by this SDD.

Post-commit quantity adjustment is Unit 7C and cannot reuse this command.

## 8. Idempotency and response-loss replay

The actor, operation, idempotency key, command identity, session/candidate IDs,
and expected versions form a stable request fingerprint.

- Same key and same logical command returns the recorded canonical response and
  creates no second inventory, provenance, counter, audit, or event effect.
- Same key with a materially changed command fails with the established
  idempotency-mismatch error.
- A retry after the database committed but the response was lost returns the
  recorded inventory/candidate result.
- A committed candidate cannot be committed under a new key; the caller receives
  the existing canonical committed result only when the command is the valid
  replay, otherwise a non-mutating state/idempotency conflict.

## 9. Concurrency

The candidate row is the only business-contention target. Unit 7A has no target
inventory concurrency.

- A stale candidate version, review version, or metadata revision fails before
  inventory creation with a refreshable conflict.
- Two concurrent first commits of the same candidate serialize on the candidate
  lock. Exactly one creates the inventory row and commits the candidate.
- A matching in-flight/repeated command resolves through replay after the winner
  completes; a different command/key receives a non-mutating conflict.

## 10. Provenance

The committed candidate stores its inventory ID and immutable bounded commit
outcome. The inventory row stores `created_from_candidate_id` plus available
session, actor, entry-method, metadata-snapshot/version, and canonical/source
references. It must remain possible to answer: **which reviewed candidate
created this inventory row?**

The existing uniqueness of `image_extraction_candidates.committed_inventory_id`
is compatible with and protects the create-only one-candidate/one-inventory
model. It must not be removed for Unit 7A. After commit, the inventory row is the
editable operational record; the candidate is historical ingestion provenance.

## 11. Store-owned versus canonical data

Owner-confirmed and selected fields materialized on `store_inventory` are the
store's inventory snapshot. Canonical work/edition IDs and metadata source IDs
are nullable references and provenance, not write authority. Unit 7A never
inserts, updates, merges, or corrects shared canonical works/editions. Manual or
unmatched reviewed metadata remains a valid private-inventory path.

## 12. Candidate states

- Successful first commit: eligible `ready` candidate becomes `committed` with
  one inventory ID.
- Stale/conflicting command: candidate remains unchanged and no inventory exists.
- Transaction failure: candidate and every transaction effect remain unchanged.
- Idempotent replay: returns the recorded committed result without a new state
  transition.
- Genuine vision false detection: the existing
  `review_disposition='skipped_false_detection'` correction remains unchanged
  and cannot commit.
- Valid reviewed candidate not added by the Owner: remains uncommitted. Unit 7A
  adds no general skipped state or disposition.

Unit 7A does not introduce or require a durable `commit_in_progress` candidate
state. The default contract is a candidate-row lock plus one atomic
`ready -> committed` transition and idempotent replay. A durable intermediate
state may be proposed only if implementation evidence demonstrates that the
transaction, candidate lock, and replay model cannot satisfy the frozen
contract without it; that evidence must be reviewed before adding state-machine
complexity. Transaction-local implementation details must not become a durable
candidate state or client-recovery prerequisite.

## 13. Private inventory and publication boundary

Unit 7A always ends with `visibility_status='draft'` and
`publication_status='private'`. It creates no marketplace listing, publication
job/retry, public projection, or public media. A reviewed publish intent is only
retained for Unit 7B. Inventory success never depends on later publication.

Each separately created inventory row may later have its own listing identity.
A later Unit 7C quantity increase retains that row/listing identity.

## 14. Edge and mobile contract

Future implementation adds one positive-allowlist Owner action:

```text
Add to Inventory
-> strict mobile request decoder
-> authenticated phase9-owner Edge action
-> controlled create-only RPC
-> canonical candidate/inventory response
-> identity-fenced candidate, readiness, discovery, and inventory refetch
```

The action is online-only, non-optimistic, and not queued offline. The UI must
disable duplicate-action controls for 7A rather than collect values that the
commit ignores. This SDD does not implement the route, hook, screen, or RPC.

## 15. Failure contract

The client-useful failure classes are deliberately small:

| Class | Behavior |
| --- | --- |
| unauthorized/not found | non-enumerating; no effect |
| candidate not eligible/state conflict | refresh current candidate; no effect |
| stale candidate/review/metadata | refreshable version conflict; no effect |
| idempotency mismatch | terminal for that key; no new effect |
| invalid authoritative review/quantity | fail closed; candidate remains uncommitted |
| internal transaction failure | retryable only under the canonical error registry; atomic rollback |

Responses never expose private scan paths/media, raw provider/model payloads,
cross-store IDs, SQL errors, or canonical/private internals outside the approved
Owner DTO.

## 16. Security and privacy

- Tenancy and active Owner authority fail closed in the database boundary.
- The controlled RPC derives store scope and has fixed `search_path`, explicit
  ownership/grants, and no direct authenticated base-table mutation dependency.
- RLS remains a backstop; Edge/service credentials do not replace user-context
  Owner authorization.
- The server-held saved review is the only business-field authority.
- Canonical data is read/reference-only for this command.
- Scan media remains `private_scan`; no scan media or path is copied into public
  listing/media fields.
- Audit/event/idempotency data is bounded and secret/media/payload-free.

## 17. Non-goals

Unit 7A excludes duplicate advice/resolution, automatic merging, target inventory
selection or increment, `manual_match`, keep-separate decisions, fuzzy/alias
merge evidence, publication, publication retry, public media, post-commit
quantity/price/location/condition/damage/notes edits, metadata rematching, media
lifecycle editing, customer commerce, deferred Unit 6F native validation,
automatic AI commit, bulk/session-level atomic commit, and restoration of legacy
direct-table inventory writes.

## 18. Forward-migration assessment

Verdict: **MIGRATION_REQUIRED**.

The applied M05 `phase9_commit_candidate` contract is not safe to connect: it
accepts caller-authoritative business fields and action/target inventory values,
uses observed identity instead of the current saved review/metadata state, and
does not fence current review/metadata revisions. A forward migration must add
or replace it with the create-only command, exact grants/ownership/search path,
current review materialization, quantity initialization, provenance, candidate
outcome, and canonical replay contract.

No duplicate producer, target-version fence, compatibility function,
many-candidate provenance relation, removal of
`UNIQUE(committed_inventory_id)`, or global quantity-constraint strengthening is
required by 7A. Migration creation and application require separate authority
and exact-project read-only preflight.

## 19. Load-bearing red-test contract

The red-first implementation gate is specification-only at SDD freeze:

1. **Saved-review authority:** inventory matches the locked saved review/current
   selected-or-manual metadata; the command cannot submit substitute business
   fields.
2. **Quantity initialization:** reviewed `q` creates exact buckets
   `(total,available,reserved,sold,removed)=(q,q,0,0,0)` and equality holds.
3. **Tenancy/non-enumeration:** unauthenticated, inactive-Owner, mismatched
   session, and cross-store attempts create no observable business/idempotency
   effect.
4. **Version fence:** stale candidate, review, or metadata revision is rejected
   before inventory creation.
5. **Create-only cardinality:** one successful candidate commit creates exactly
   one new private inventory row and never updates an existing row.
6. **Exact replay:** same command/key after response loss returns the same
   canonical IDs/outcome with one inventory/counter/audit/event effect.
7. **Changed replay:** same key with any changed control identity/version is
   rejected with no additional effect.
8. **Same-candidate race:** two concurrent first commits create exactly one row;
   matching replay resolves canonically and the competing distinct command does
   not mutate.
9. **Atomic rollback:** a forced downstream provenance/audit/event failure leaves
   no inventory, candidate transition, session increment, completed replay, or
   partial audit/event.
10. **Canonical immutability:** selected and manual commits create store-owned
    inventory without inserting/updating shared canonical records.
11. **Private-media boundary:** commit cannot copy/link private scan media into a
    listing or public-media relation and creates no listing.
12. **Durable provenance:** successful response and readback prove reciprocal
    one-candidate/one-inventory linkage and candidate `committed` state.
13. **Legacy duplicate state is non-blocking and non-authoritative:** an
    otherwise valid current reviewed candidate commits without
    `duplicateIntent`; legacy duplicate advice/intent cannot block or redirect
    create-only commit, mutate existing inventory, or become command input. The
    Unit 6-to-7A readiness/UI contract neither requires these values nor
    presents them as actionable Unit 7A choices.

No duplicate-target, compatibility, merge, or existing-inventory concurrency
test belongs to Unit 7A.

## 20. Acceptance criteria

| ID | Criterion |
| --- | --- |
| U7A-AC01 | Only an authenticated authorized Owner can explicitly commit an eligible candidate in the server-derived store. |
| U7A-AC02 | The locked saved review/current metadata state is the only authority for materialized inventory fields. |
| U7A-AC03 | Each successful candidate creates exactly one new private inventory row; no existing row is targeted or incremented. |
| U7A-AC04 | Reviewed `q` initializes exact quantity buckets and satisfies equality. |
| U7A-AC05 | Candidate, inventory, session accounting, provenance, audit/event, and replay result are one atomic effect. |
| U7A-AC06 | Same-command replay is canonical and changed replay fails; response loss cannot duplicate inventory. |
| U7A-AC07 | Two concurrent commits of one candidate produce one inventory effect. |
| U7A-AC08 | Manual/unmatched reviewed metadata can create private inventory without canonical mutation. |
| U7A-AC09 | False-detection correction remains distinct; valid uncommitted candidates gain no general skipped state. |
| U7A-AC10 | Unit 7A creates no listing, publication retry, public media, commerce, or post-commit edit effect. |
