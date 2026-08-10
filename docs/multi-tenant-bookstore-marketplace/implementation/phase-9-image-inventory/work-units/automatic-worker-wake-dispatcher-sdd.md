# Phase 9 Automatic Worker Wake Dispatcher

**Status:** `local_implementation_reviewed_corrections_applied`
**Authorized:** 2026-08-10
**Live activation:** prohibited until separate deployment/external-mutation approval
**Owning authority:** the user's 2026-08-10 narrow work-unit decision; Phase 9
master SDD §§8–10; pipeline SDD §§10, 14–15; security SDD §§9, 13, 15

## 1. Narrow decision

Due Phase 9 media, vision, and metadata jobs must wake the existing
request-driven workers automatically. The dispatcher does not replace or alter
worker claims. Each existing claim RPC remains the sole owner of
`FOR UPDATE SKIP LOCKED`, leasing, attempt increments, claim tokens, and
fencing.

The required fresh-image path is:

`Owner upload -> media wake/claim -> vision wake/claim -> Gemini -> candidates
-> M32 metadata jobs -> metadata wake/claim -> Google Books -> Owner review`.

No operator `/run` call is allowed in the eventual live acceptance journey.

## 2. Authorized local scope

- one postgres-private, read-only claimability helper covering only
  `media_validate_sanitize`, `vision_extract`, and `metadata_enrich`;
- one postgres-private dispatcher using Supabase Cron and `pg_net`;
- at most one authenticated HTTP `POST /run` wake per stage per cron tick;
- a configuration-owned initial cadence of 60 seconds, created inactive;
- Vault lookup of only the three worker URLs and three ingress tokens;
- an explicit bounded `timeout_milliseconds`, justified by measured/recorded
  service wake and worker/provider ceilings;
- bounded secret-free correlation from cron tick to `pg_net` request ID,
  response/timeout, Render receipt, and normal database claim transition;
- metadata Render deployment preparation because no metadata service currently
  exists;
- red-first migration/security/PGlite/runtime/regression tests and deployment
  validation.

The dispatcher may mutate only its bounded private dispatch-observability data.
It must not mutate Phase 9 job, session, input, candidate, reservation, provider,
inventory, listing, or publication state.

## 3. Claimability parity contract

All three currently effective claim RPCs use the same eligibility predicate:

1. exact job kind;
2. status in `open|retry_scheduled|in_progress`;
3. `next_attempt_at <= transaction_timestamp()`;
4. a non-`in_progress` row, or an `in_progress` row whose lease has expired;
5. `attempt_count < max_attempts`.

The helper answers only whether one such row exists. It never locks, claims,
leases, increments, resets, completes, inserts, or updates a job. Parity tests
must cover an open due job, due retry, future retry, active lease, expired lease,
maximum attempts, and all three kinds. Any discovered predicate difference is a
stop condition; claim RPC refactoring is outside this unit.

## 4. Security and configuration boundary

- Functions and observability relations are outside `public`, owned by
  `postgres`, use fixed safe search paths, revoke `PUBLIC`, `anon`,
  `authenticated`, and `service_role`, and accept no store/user identity.
- Vault secret values are read only inside the dispatcher. They are passed only
  as the authenticated header to `pg_net`, whose private request queue may
  transiently retain that header until delivery; M36 never returns the values,
  writes them to durable Phase 9 observations, logs them, or places them in
  error text.
- Allowed Vault values are only media/vision/metadata worker URL and matching
  ingress token. Gemini, Google Books, and Supabase service-role credentials are
  forbidden.
- Worker URLs must be HTTPS origins with the fixed `/run` path supplied by the
  dispatcher. Tokens are sent only as the existing bearer authorization header.
- Missing/invalid configuration and HTTP/network failure are bounded outcomes;
  they do not abort future cron ticks.
- Duplicate wakes are harmless because workers still perform normal bounded
  claims, and a per-tick/stage uniqueness fence permits at most one dispatched
  request.

### 4.1 Initial timeout evidence

Read-only health measurements on 2026-08-10 observed representative free-tier
cold wakes of 23,423 ms for media and 22,598 ms for vision. The deployed vision
configuration records a 30,000 ms Gemini provider timeout. The initial
`pg_net` timeout is therefore 120,000 ms: the 23,423 ms measured maximum plus
the 30,000 ms provider ceiling plus a bounded 45,000 ms claim, Storage,
processing, and response margin remains below the timeout with 21,577 ms of
headroom. The timeout is also exactly two 60-second scheduler cadences, so it
is finite and operationally legible. Metadata has no deployed service or cold
wake measurement yet; its deployment review must confirm this provisional
budget before cron activation.

Executable coverage checks that arithmetic and exercises a proportionally
scaled delayed authenticated `/run` through the real HTTP service. Dispatcher
timeout reconciliation separately proves that an already accepted active
lease suppresses the next tick. Existing full Phase 9 database regressions
prove finalized physical metadata work is reconstructed without a second
provider call and exact vision completion replay is duplicate-free; the
dispatcher does not replace those claim, lease, or idempotency fences.

## 5. Inactive rollout boundary

The forward migration may create the private objects and one named Phase 9 cron
job, but the cron job must be inactive when the migration transaction commits.
The current claimable media job must remain untouched during local work.

Separate approval is required to apply the migration, create Vault secrets,
create the metadata Render service, redeploy media/vision, remove the current
image, enable cron, invoke a worker, push Git, or execute the final live proof.

The currently deployed media and vision services remain compatible with the
ordinary authenticated `/run` contract and the optional dispatch-ID header,
but predate dispatch-ID receipt logging. Both services therefore require
redeployment before the final cron-to-request-to-Render correlation proof;
this is an observability-only rollout conclusion and does not require a claim
RPC or provider behavior change. Metadata service creation remains separately
required.

Activation order is fixed: services ready; current image removed through the
real Owner UI; unintended claimable work ruled out; one cron enabled; empty tick
verified; one genuinely new image uploaded; then no manual intervention.

## 6. Red-first acceptance matrix

Local tests must prove:

1. due media, vision, and metadata work each wake only their matching stage;
2. empty queues, future retries, active leases, and max-attempt rows do not wake;
3. expired leases wake and each stage emits at most one request per tick;
4. duplicate wakes are harmless and timeout/network failure cannot stop later
   ticks or create duplicate accepted provider work;
5. Vault values never appear in returned rows, durable Phase 9 observability,
   errors, or logs (the private transient `pg_net` request queue is an
   infrastructure boundary and is not returned or queried by M36);
6. the helper and each current claim RPC have predicate parity;
7. dispatcher execution leaves all Phase 9 job rows byte-for-byte unchanged;
8. media completion through vision candidates and M32 metadata-job creation
   remains intact;
9. cron is present but inactive and client/service roles cannot execute private
   helpers or read private observability;
10. metadata worker source builds and its existing authenticated `/run` -> claim
    -> Google Books -> fenced persistence architecture remains unchanged.

## 7. Explicit exclusions and later work

This unit does not change duplicate-image replay, Gemini or Google Books
contracts, M18/M19/M32/M33/M34/M35 semantics, Owner review, Unit 7, inventory,
listing/publication, queue infrastructure, or persistent Render polling.
Historical multiple-image evidence remains preserved; current normative sources
use the one-current-image contract.

After a fresh automatic live PASS, duplicate-image replay correction remains a
separate authorized work unit and gate before Phase 9 ingestion can be called
complete.
