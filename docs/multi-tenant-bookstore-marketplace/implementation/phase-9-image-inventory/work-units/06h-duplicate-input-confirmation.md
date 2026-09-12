# Unit 6H — Duplicate Input Confirmation

> **2026-09-12 bounded correction closeout:** Exact project/source readback
> proved active `phase9-owner-ingestion` v10 carried the older pre-`selectionId`
> decoder. Commit `6d05370` corrects the safe error mapping and both isolated
> Jest cleanup defects. Focused verification passes 7 suites/233 tests with
> `--detectOpenHandles`, without the former `act(...)` or non-exit warning;
> TypeScript and deployment-runtime validation pass. The Owner Edge function
> alone was deployed to `ahntbtktjjmvfosgkmgn` as active v11 with JWT
> verification and hash
> `0af2f2ebde6019d5f10923141b279ae3a78a5ca0f5eeac6630b990030caddf55`.
> The same authenticated duplicate-Proceed session now renders both normal
> review cards. No Render, M60/migration, database/Storage, dispatch, inventory,
> existing-data deletion, or reprocessing occurred. Next: complete the remaining
> connected Unit 6H regression matrix under connected-test authorization.

> **Historical pre-correction connected diagnostic checkpoint (2026-09-12):** M60 was subsequently applied once to development under the preceding rollout authorization. Live duplicate Proceed completed against the new upload: exactly one new vision job and two candidates were created, no older analysis/session was reused, and inventory remained unchanged. The remaining blocker is the deployed `phase9-owner-ingestion` batch-review response-contract drift: Edge returns HTTP 400 `P9_REQUEST_INVALID` while the same authenticated PostgREST RPC returns HTTP 200 with valid cards containing `metadataSummary.selectionId`. The checked-in Edge decoder accepts that optional field, but exact deployed source/version readback remains pending. No code, tests, migration SQL, deployment, dispatch, M60 action, data deletion, or inventory write occurred during this diagnostic. Exact next action: under rollout authorization, read back or deploy the matching Owner Edge bundle and repeat the Edge/RPC/UI proof.


**Status:** duplicate Proceed through normal review live-verified after Owner Edge v11 reconciliation; remaining connected regression matrix pending
**Branch/baseline:** `codex/phase9-duplicate-confirmation` from `8340647`
**Authority:** product decision recorded for this unit; Phase 9 master SDD §3 (MAS-08, MAS-17), pipeline SDD §§6–10, media security SDD §§6–7 and §12, Owner review SDD §§6–9.

## 2026-09-12 — Gemini optional-ISBN boundary correction

The connected test exposed a separate pre-metadata defect: Gemini returned a malformed
optional `isbn_clue`, and the local response decoder rejected the entire vision result
before a candidate or Books API job could be created. The decoder now converts
malformed/non-string/overlong optional ISBN clues to `null`, while retaining valid
labelled ISBNs and leaving title/author/language extraction and the existing metadata
query identity unchanged. This correction does not change duplicate confirmation,
inventory duplicate handling, M52–M60, or the Books API adapter contract.

Focused local verification: Gemini/analyzer 2 suites/48 tests passed; metadata identity,
gateway, Google Books adapter, and metadata worker 4 suites/49 tests passed; TypeScript
validation and `git diff --check` passed. No connected retry has been run after this
local correction; deployment and connected Edge/Storage verification remain gated.

## Settled flows

- Normal input: validation links that upload's sanitized private media, queues one `vision_extract` job, creates new candidates, enters normal review, and requires explicit Add to Inventory.
- Duplicate / Proceed: validation records the new input as `awaiting_duplicate_confirmation`. Proceed verifies the exact pending sanitized object at the Edge boundary, links that object as private scan media for the new session, queues one vision job for the new input, and then uses the unchanged candidate/review/Add flow. No old analysis, candidates, session, or media link is substituted.
- Duplicate / Cancel: the input becomes skipped with `P9_DUPLICATE_CANCELLED`; no vision job is created and the unlinked sanitized output becomes cleanup-eligible.
- Dismiss: backdrop, system Back, accessibility escape, and “Not now” change only local dialog visibility. “Review duplicate” remains visible.
- Expiry: confirmation expiry equals the existing session expiry. Cleanup first expires the confirmation and input atomically, then may lease the unlinked object. Close and generic Remove cannot turn a pending duplicate terminal; explicit Cancel is required.

## Database and concurrency design

M60 is a forward migration. M52–M59 are unchanged. It adds `duplicate_of_input_id`, a private confirmation table, the pending input state, and a canonical-only partial unique index on `(store_id, sha256, orchestration_version) WHERE duplicate_of_input_id IS NULL`. A database trigger locks and verifies that every duplicate points to a canonical row with the same store, sanitized hash, and orchestration version.

Lifecycle lock order is: media job → sanitized output intent → input rows in UUID order (new and canonical) → session → confirmation → capability/media side effects. Existing M58 validated completion remains the validation authority; M60 translates only newly created duplicate receipts. Historical `duplicate_rejected` receipts and failed inputs are not backfilled and replay unchanged.

Owner resolution has two service-role-only database calls behind the authenticated Edge function. The read-only preflight peeks for a completed canonical idempotency response before Storage is touched; only the resolver claims a new key. A fresh Proceed lists the exact private object, verifies envelope, downloads and hashes it, lists it again to fence replacement, then calls the service-only resolver with the observed proof. Authenticated SQL roles have no execute grant on either function.

Cleanup claim, cleanup finish, dispatch eligibility, and cleanup health all recognize pending confirmation protection. The output intent remains pending, but its cleanup deadline is the session expiry. Cancel or expiry releases it; Proceed marks it accepted. Lease fencing and retry/dead-letter behavior are unchanged, and duplicate detection itself resolves the media job without retry.

## Coordinated development deployment procedure (historical plan; M60 is now live)

1. Confirm the exact development project ref and read migration history; require M52–M59 once and M60 absent.
2. Pause only the Phase 9 media/vision dispatchers for the short coordinated window; do not pause unrelated jobs.
3. Apply M60 once and read back its checksum, partial index predicate, ACLs, triggers, and function definitions.
4. Deploy `phase9-owner-ingestion` with the direct contract update, then the media worker/runtime and app bundle from the same reviewed commit.
5. Resume Phase 9 dispatch and verify cleanup health, pending-confirmation count, and no unexpected dead letters.
6. Run one normal upload, one duplicate Cancel, one duplicate Proceed through candidate review without Add, exact command replay, cross-tenant denial, and expiry/cleanup proof. Inspect that each Proceed uses a distinct input/session/private media row and exactly one vision job.
7. Rollback policy: stop new Phase 9 dispatch and app rollout, preserve all records and objects, and diagnose forward. Do not roll back M60 or replay M52–M59.

No development-data cleanup is part of this unit.

## Bounded correction closeout — 2026-09-12

- F-01 `[RETRACTED]`: M58 already catches the legacy constraint identity raised
  by the relationship trigger. M60 receives the resulting duplicate receipt and
  translates it into `confirmation_required`; the strengthened fixture proves
  resolved attempt 1 plus exact canonical replay without a dead-letter path.
- F-02 `[CORRECTED LOCALLY]`: M60 adds two postgres-owned, empty-search-path,
  service-role-only public `SECURITY INVOKER` delegates. Edge's default-schema
  RPC calls now reach the private implementations without exposing the private
  schema or granting `authenticated` callers a bypass.
- F-03 `[CORRECTED LOCALLY]`: the client mutation now mirrors the removal hook's
  local session/controller lifecycle, aborts on session change or unmount, checks
  the response session, and suppresses stale query invalidation. A focused test
  covers those lifecycle boundaries.

Correction verification passed 4 Jest suites/181 tests, including the focused
lifecycle suite's 3 tests, the 5/5 duplicate-confirmation fixture scenarios,
and TypeScript validation.
The screen suite retains the existing `VirtualizedList` `act(...)` warning. A
2026-09-12 isolation rerun showed it only in `CaptureProgressScreens.test.tsx`,
from React Native's deferred `VirtualizedList._updateCellsToRender` timer; that
suite still exited normally. The non-exiting process was independently isolated
to the older `unit6gMountedRouteIntegration.test.tsx`: 4/4 assertions passed,
`--detectOpenHandles` named no handle, and `--forceExit` was required. The Unit
6H dialog/lifecycle and non-UI contract groups exited normally.
At the initial correction closeout the real PostgreSQL harness was not yet
authorized; that historical gate is superseded by the run below. M60 remains
unapplied remotely, and no deployment, remote database/Storage mutation, live
dispatch, application-data mutation, or development-data deletion occurred.

The subsequently authorized disposable PostgreSQL 18.4 run used
`127.0.0.1:55461`, data directory
`C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912`,
and PID-scoped database `bookconnect_u8b_22652`. It applied the baseline and
M01–M60, then passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS`
and the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS`. The concurrency proof used
independent `psql` connections and verified one canonical winner, one pending
duplicate loser, Proceed/cleanup/replay fencing, exact replay, one vision job,
and one new-session media asset. Teardown left the data directory absent, port
55461 without a listener, and zero matching postgres processes. The next gate is
review of this proof and separate authorization for connected Edge/Storage
verification.

## 2026-09-12 — Optional-ISBN correction deployment

After local verification, the reviewed correction commit
`428a8c17362d7a2c478c83b328ca8237b78bc79f` was deployed only to the existing
Render `phase9-fixture-vision` service (`srv-d9jbsjf41pts73cejqag`) as
`dep-daih7ioae00c73egmcug`. Render reported `live`; `/health` returned 200
`{"status":"alive"}`, `/ready` returned 200 `{"status":"ready"}`, and an
unauthenticated `/run` request returned 403 `{"error":"forbidden"}` without a
job claim. The prior worker deployment `af90ef5` was deactivated.

This was a correction-only worker deployment. No Edge/client deployment, M60
application, migration, dispatch change, database/Storage mutation, or
application-data mutation occurred. A full authenticated image → Gemini →
metadata/Books API test remains unrun because this environment has no approved
Owner session or worker ingress token available for a controlled invocation.
The exact next action is to run that fresh authenticated connected test and read
back one candidate/metadata path; it requires the approved Owner test session,
but no further code or migration change.
