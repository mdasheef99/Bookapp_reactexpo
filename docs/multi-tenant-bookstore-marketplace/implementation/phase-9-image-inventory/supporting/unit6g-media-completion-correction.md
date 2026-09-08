# Unit 6G media completion correction — local containment and SQL handoff

Date: 2026-09-08. Status: SQL/cleanup implementation integrated onto the current
`origin/main` baseline, independently reviewed, and applied live as M57–M59
with exact-project readback complete; Git publication and runtime deployment
remain gated.

## 1. Authority and scope

The user authorized systematic local corrections following the independent review.
This covers worker/test changes, read-only database lineage investigation, and a
reviewable database/cleanup design. The subsequent explicit approval authorizes
verification of the M52–M56 baseline and forward migration-file creation/local
implementation and tests under [the execution plan](./unit6g-media-correction-plan.md).
The later explicit authorization for ordered M57–M59 application is complete.
Runtime deployment, live Storage/job mutation, dead-letter resets, and Git
publication are not authorized. Unit 9 remains design-only and outside this
correction.

Requirements trace to Master SDD §3 MAS-03/MAS-08/MAS-17, §8, §9; Pipeline SDD §4
image replay and §10 durable orchestration; Security SDD §6/§7/§12 and MED-19.
The user's explicit review requirements add exact command replay, distinct new
input/session/Owner provenance, policy-compatible reuse and no orphan outputs.

## 2. Local worker correction

The first bullets below record the pre-M57 containment checkpoint. The local
implementation checkpoint in §6 supersedes its pending-cleanup statements.

- Read existing output via Storage `info()`, not `list()` custom metadata.
  `info()` returns custom fields in `metadata`, with top-level `size` and
  `contentType` after SDK camel-casing. Hash downloaded bytes independently.
- Missing/unauthorized/incompatible/corrupt objects fail closed. Temporary
  metadata/read errors retain transient handling; upload never enables upsert.
- SQLSTATE 23505 remains non-retryable. The unchanged failure RPC only accepts
  `P9_MEDIA_OBJECT_CHANGED`; this is explicitly a temporary compatibility code,
  with bounded worker reason `completion_uniqueness_conflict`. It is not a new
  definition of changed-image semantics or a deployable final duplicate contract.
- Unclassified HTTP 409 and approval/authorization/idempotency conflicts report
  `reconciliation_required`; they do not authorize deletion or changed-image
  persistence. Only an explicit `P9_STATE_CONFLICT` establishes stale-lease output.
- Failure-RPC errors/throws report `failure_persistence_unknown`, retaining only
  bounded diagnostics. Source paths, constraint text and transport details stay out
  of worker output.
- Remove direct Storage deletion based on the local upload flag. `cleanupRequired`
  records that an output may exist; it is NOT a durable cleanup queue or a guarantee
  that the object is unreferenced. Completion/failure uncertainty requires readback.

This is containment only: unclassified conflicts leave the claim for subsequent
lease handling; automatic claim retries can still occur. No full reconciliation
consumer exists yet. It would be unsafe to deploy this as the final correction.

Source: `supabase/functions/_shared/imageInventory/runtime/mediaValidationWorker.ts`
and `mediaValidationErrors.ts`. Tests: duplicate completion, recovery, ingestion
Edge/contracts, and shared realistic metadata test helper.

## 3. Database evidence and lineage

Exact read-only project: Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn,
ACTIVE_HEALTHY, PostgreSQL 17.6.1.063, ap-southeast-2.

Local untracked `20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql`
and live `20260822025712` differ only in surrounding whitespace after CR removal:
the trimmed strings match exactly (629 local / 628 live lines). LF-normalized
untrimmed MD5 is local `20d77b89289d32e2bfd399e9082e3ec5`, live
`7e2d8d3e9dad43c6fc2ad6729f13104d`. This establishes statement-content equivalence,
not tracked source provenance, migration-history repair, or permission to replay it.
Neither file nor migration history was changed.

Later Phase 9 live history:

| Version | Name suffix | Affected area from statement inspection |
| --- | --- | --- |
| 20260828081324 | unit6g_field_authority_correction | metadata summary, field sources, batch card |
| 20260829142337 | unit6g_session_lifecycle_fence | mutable-session/locking, detail/review/Add/remove, batch card |
| 20260830084323 | unit6g_metadata_add_authority_correction | query identity, metadata summary, review/commit eligibility, batch card |
| 20260830175651 | metadata_throughput | worker wake dispatcher |

M52 alone is not the current live baseline. Read-only Git-history lookup subsequently
found the exact later source files; each matches its live statement after CR removal
and trimming outer whitespace:

| Local source suffix | Verified source commit | Live version |
| --- | --- | --- |
| 20260827000053 unit6g_field_authority_correction | 831649d0351e6cae90107cbeba495eb90425095c | 20260828081324 |
| 20260829000054 unit6g_session_lifecycle_fence | 4d891d8ba8872d41702c3b4fa691739639075979 | 20260829142337 |
| 20260830000055 unit6g_metadata_add_authority_correction | 404aee0387f476e2f985f1b2f3d8c6be3dac2d9e | 20260830084323 |
| 20260830000056 metadata_throughput | 84dac6316891608f00a6745e05894dcd5a194889 | 20260830175651 |

All paths are under `supabase/migrations` with the `marketplace_phase9` prefix and
`.sql` extension. M52–M56 were already tracked in verified `origin/main` commit
`573182267ddd79e08b0abfb348b5afd9fb0dc571`; the integrated worktree did not
restore or copy them. Read-only live history confirms M52–M56 are applied once at
the versions above. No migration history was repaired. The reproducible source
mapping is concrete and the disposable M01–M56 baseline is verified.
The observed scan completion is M33-derived; public-copy completion uses M40 v2.
Neither provides canonical committed-command replay. No media correction was applied.

## 4. Concrete forward-correction design for approval

### 4.1 Completion receipts and reuse

Keep store/hash/orchestration uniqueness and reject cross-input duplicates. Do not
redirect to old input/candidates or merge/create inventory. New provenance stays new.

Persist the canonical completion result and request fingerprint atomically with
successful completion. Bind it to job, worker, completing attempt, hashed token,
source identity/hash, snapshot and target identity, sanitized hash/bytes/dimensions,
purpose and policy/derivation versions. Never persist the raw token. An exact replay
returns the receipt even after the original lease was cleared; changed payload or
another claim is rejected. A new claim must not acquire the old claim's authority.

The authoritative existing-asset branch must verify store, Owner, purpose/privacy,
session/source derivation, expected validation/re-encode/EXIF and retention policy,
deleted/held status and object integrity evidence. Storage bytes remain worker-verified;
the database validates the entire relationship and compatible policy before linkage.

Use a dedicated bounded duplicate-rejection code and safe Owner message in the
forward contract. Catch only the exact sanitized-input uniqueness constraint inside
a rollback subtransaction, then persist the terminal rejection and cleanup intent
under the still-authoritative claim. Other uniqueness/authority errors retain their
distinct meaning. Specify attempt-5 terminal semantics explicitly; existing SQL
dead-letters even a non-retryable attempt-5 failure and must not be silently relabeled.

### 4.2 Durable output intent and fenced cleanup

Before Storage upload, persist a server-derived per-job/attempt output intent with
store, purpose, bucket/path, expected policy and claim lineage. Existing
`media_lifecycle_attempts` requires a media-asset FK, so it cannot alone represent an
upload whose completion transaction rolled back. The forward design needs a durable
output-intent relation (exact schema/name only after migration-creation authorization).

Completion and cleanup serialize on that intent. Once cleanup reserves deletion,
completion must reject linkage; an accepted/linked output is never cleanup-eligible.
Before deletion, check live references and holds under the same authoritative fence.
Record Storage error results as well as thrown failures; retry with bounded backoff,
alert on age/backlog, and record already-missing objects as successful deletion.
Retain enough intent history to reconcile lost upload/remove responses and expired
claims, including all earlier attempt paths. A status response flag is not sufficient.

A separate durable cleanup consumer must use the existing PostgreSQL SKIP LOCKED
pattern and service-only authorization. No Redis/Celery or client-side cleanup authority.
Cross-domain public-copy compatibility must be tested because this worker is shared.

### 4.3 Required acceptance proof

Run actual PostgreSQL connections with synchronized competing completions and
completion-versus-cleanup/hold races. Assert one accepted asset/input/vision reservation,
exact event/audit counts, no losing candidate/inventory effect, distinct provenance,
cross-store denial and preserved historical dead letters. PGlite proves transactions
but not pooled/concurrent connections. Current tests explicitly label that limitation.

Replay and incompatible-policy tests now execute against the local M57–M59
correction as required assertions. The focused SQL correction suite is 14/14 and
the corrected duplicate-completion suite is 7/7; real PostgreSQL separate-connection
tests cover duplicate completion, cleanup/completion and hold/reference races,
cross-store isolation, and historical dead-letter immutability.

## 5. Verification and handoff

The initial paragraphs below are the pre-M57 handoff record; §6 is the current
implementation and verification status.

Metadata RED: realistic Storage fixture caused exact-object reuse to fail (1 failed,
12 passed). Recovery RED: 8 expected failures, 16 passing tests. Independent review
identified top-level PostgREST HTTP status as an additional regression to cover.
Final focused verification: 4 suites / 46 Jest tests passed; media-worker noEmit
TypeScript check passed. Disposable DB: 11 passed plus two executing TODO failures
for pending SQL replay/policy acceptance. The top-level status regression failed
before correction; bounded independent rereview has no outstanding findings.
Continuity reaches the unchanged migration-set failure after requirement checks
pass (195 definitions; zero duplicates/missing traces). Full DB and connected E2
were not rerun during this correction. See the implementation log for commands.

The prior read-only review ran the full DB suite: 394/397. Three unchanged metadata
fixtures fail because of missing primary_title and expired 2026-08-28 cache dates.
Do not describe that earlier run as a post-correction full-suite run.

The pre-application correction session covered the existing M52–M56 source set
and new local M57–M59 files. It performed no migration application, deployment,
Storage/job mutation, provider call, stage, commit, or push.

Independent review found no actionable findings and returned PASS for local
review. Its own extra Jest invocation was blocked before startup by Windows
sandbox `EPERM`, so no additional pass is claimed. A later explicitly
authorized operation applied M57–M59 separately and in order as live versions
`20260908073203`, `20260908073308`, and `20260908073425`; exact-project
post-apply readback passed. Focused worker/Owner/runtime Jest suites pass
262/262 on the updated baseline and the worker TypeScript check passes. Owner
review of the live proof is next; runtime deployment, scheduling, connected E2,
commit, and push remain separate gates. Connected E2 must use a fresh
disposable session.

## 6. Origin-main integration checkpoint — 2026-09-08

The user subsequently authorized local migration-source integration and forward
SQL creation. The correction was transferred into the isolated
`codex/phase9-unit6g-media-correction-integrated` worktree at verified
`origin/main` commit `573182267ddd79e08b0abfb348b5afd9fb0dc571`.
M52–M56 came from that baseline and were not restored. M57–M59 are now live as
`20260908073203`, `20260908073308`, and `20260908073425`; they add per-attempt snapshot/output
intents, canonical completion receipts, strict policy/lineage checks, exact
duplicate rejection, permanent cleanup fences, bounded retry/recheck state,
service-only cleanup claims, and bounded cleanup-health counters. The cleanup
worker deletes only SQL-issued exact paths; it treats missing objects as success,
records returned or thrown Storage errors, and preserves uncertain acknowledgments
for SQL lease recovery. Late service-role uploads remain an eventual-convergence
risk because Storage writes are external to the SQL transaction; the permanent
tombstone and recurring recheck are therefore required and deployment remains
gated on operational scheduling.

Verification: M01–M56 disposable PostgreSQL replay plus existing U8B/U8C acceptance
passed; real PostgreSQL separate-connection completion/duplicate, cleanup, hold,
cross-store and historical-dead-letter races passed; the focused correction
suites are 21/21 (14 SQL-correction cases and 7 corrected-duplicate cases) with
no TODO tests. The
prior stale-worktree full Phase 9 database run completed 410/413; it is historical
evidence only. The updated-baseline broad invocation completed 429/433, with all
M57–M59 cases passing. Three independently reproduced failures are stale
metadata-foundation fixtures (required `primary_title` and expired 2026-08-28
data), while the fourth raw-invocation failure is a missing prerequisite
`.phase9-dist` metadata-worker build artifact. Focused worker/Owner/runtime Jest
suites passed 262/262 on the updated baseline. The HTTP runtime now
includes bounded cleanup-health counters in the operational completion event, and
the worker TypeScript check passes. That local verification checkpoint made no
live migration, database/Storage/business mutation, deployment, provider call,
stage, commit, or push. The later authorized M57–M59 application changed only
schema/functions/triggers and migration history; no business row, Storage
object, job, or deployment changed.

Next exact action: Owner review of the M57–M59 live application proof. Runtime
deployment, cleanup scheduling, connected business-data tests, commit, and push
remain separate decisions.
