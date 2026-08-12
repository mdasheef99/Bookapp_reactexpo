# Unit 7B Safe Publication — Local Implementation Evidence

**Status:** `corrected_review_candidate_ready_luna_review_pending`
**Date:** 2026-08-13
**Authority:** frozen [Unit 7B SDD](../work-units/07b-publication-sdd.md)

## Current Sol Light correction verdict

The prior independent review returned `NOT APPROVED`; Luna xhigh has not yet
reviewed the candidate. The approved Sol Light correction matrix is now
implemented locally. Findings 001–006 are `CLOSED`, and factual evidence
finding 008 is updated after functional verification. This is review-candidate
readiness, not review approval or live-release approval.

## Historical independent review verdict

The first independent review returned `NOT APPROVED`. The prior local pass
counts below are historical baseline evidence only; they do not establish Unit
7B completion. Seven merge blockers remain: end-to-end public-copy media;
committed-transient worker lifecycle; missing material §19 subcases; safe
media-driven projection refresh/retraction; under-lock Owner retry
reauthorization; failed-publication cancellation/resurrection fencing; and
truthful completion documentation.

## Implementation scope under remediation

- Forward-only M40 reconciles dual-version state commands, transient-only
  retries, intent-keyed jobs, token-fenced claims, pause/private retraction,
  one authoritative listing-sync trigger, safe public DTO/RPCs, Owner inventory
  page v2, closed-session summary semantics, public-media constraints, bounded
  audit/events, and dispatcher support.
- `phase9-owner-ingestion` exposes the strict publication allowlist and maps
  deterministic correction failures separately from committed transient
  projection failure.
- Mobile uses real response decoding, the controlled Owner page, publication
  status/actions/filtering, retry/corrective UX, a public-media management
  entrypoint, and no optimistic publication state.
- `phase9-publication-worker` claims only `publication_retry`, carries the
  server lease token/attempt/intent fence, and applies bounded retry,
  cancellation, and dead-letter classification.
- Legacy publish/pause callers delegate to the controlled Unit 7B boundary;
  consumer discovery uses only the safe v2 RPCs/DTO.

## Historical verification already run

- Frozen SDD §19 has exactly **20 numbered tests**, but the review found
  material subcases missing; completion is not claimed. Working mapping:
  [07b-red-test-traceability.md](../work-units/07b-red-test-traceability.md).
- Focused migration/Edge/worker/client/UI/discovery: **11 suites, 89/89**.
- Unit 7A plus dispatcher database non-regression: **42/42**.
- Earlier draft claim (superseded): disposable PostgreSQL upgrade/concurrency
  was reported as passed. This session could not reproduce it because `psql`
  and Docker are unavailable; the gate is `NOT_RUN` for this handoff.
- TypeScript with `--allowImportingTsExtensions`: PASS.
- Earlier draft claim (superseded): Deno check passed. Deno is unavailable in
  this session, so this gate is `NOT_RUN` for the remediation handoff.
- Deployment-runtime validator: media, vision, metadata, and publication worker
  builds/entrypoint smokes PASS. Docker container smoke is `NOT_RUN` because
  Docker is unavailable.
- Repository `git diff --check`: PASS.

The repository-wide Jest run reported 239 passing suites and 2006 passing
tests, plus six pre-existing support/fixture files collected as empty test
suites and two load-sensitive failures that both passed in focused reruns. They
are recorded as unrelated repository-harness debt, not suppressed.

## External state and remaining gates

M40 was not preflighted against or applied to the connected project. No Edge or
worker was deployed, no Storage/database business data changed, and no live
Owner publication/discovery/race proof ran. Exact-project preflight,
application, deployment, live proofs, Unit 7C, and main integration remain
`NOT_RUN` and require new authority.

## Next action

Obtain Luna xhigh review of the committed and pushed scoped Unit 7B candidate.
Review remains `NOT APPROVED` until Luna passes. Stop before exact-project
preflight or any live mutation.

## 2026-08-12 remediation verification update

All seven reported implementation, coverage, and documentation remediations
are now present. The expanded disposable Unit 7B suite passes **22/22**: all 20
numbered SDD rows plus committed-transient database and actual production-worker
lease-release cases. Focused backend/migration suites pass **32/32**, focused
mobile/read/discovery suites pass **80/80**, the compatible TypeScript no-emit
check passes, all four worker builds pass, the entrypoint smoke passes, and the
deployment-runtime validator passes.

The full local acceptance gate is not green. Full Phase 9 PGlite is **276/277**
because a closed metadata-foundation fixture inserts null
`canonical_works.primary_title`; isolation reproduces **12/13** with the same
SQLSTATE `23502`. The fixture has no diff from base `f8839c2` and was last
changed by pre-Unit-7B commit `ce5f7874`, so it remains outside Unit 7B.
Repository Jest now passes all **2012/2012 real tests across 242 suites**; the
former broad-run timeout did not recur. The command still fails because the
same six pre-existing fixture/support modules are collected as empty suites,
and Jest reports the known non-exiting handle after its summary. Neither debt
was suppressed or excluded. The six collectors are
`fixtures/phase9/visionFixtures.ts`, `searchVariantFixtures.ts`,
`metadataFixtures.ts`, `googleBooksResponses.ts`, `aliasFixtures.ts`, and
`support/phase9MetadataComposition.ts` under
`supabase/functions/__tests__/`.

## 2026-08-12 host-gate rerun

- Tool confirmation: explicit Scoop `psql` reports PostgreSQL **18.4**.
- Real PostgreSQL: `BLOCKED_ENVIRONMENT` before Unit 7B SQL. Fresh `initdb`
  failed with `could not create restricted token: error code 87`; the existing
  Scoop PostgreSQL 18 cluster is present but `pg_ctl` fails with the same token
  error. No service/listener was available, so the RT05/RT07/RT12/under-lock
  authorization concurrency script could not execute.
- Docker container smoke: `BLOCKED_ENVIRONMENT`; the authoritative command
  `npm run smoke:phase9:worker-containers` returned
  `P9_DOCKER_UNAVAILABLE`. Docker was absent from the sandbox PATH, common
  install locations, app catalogue, processes, and WSL.
- Deno Edge graph: `BLOCKED_ENVIRONMENT`; `deno` is absent. The authorized
  `scoop install deno` attempt failed on sandbox-denied writes and unavailable
  release credentials, so
  `deno check --config supabase/functions/phase9-owner-ingestion/deno.json
  supabase/functions/phase9-owner-ingestion/index.ts` could not run.
- Green executable matrix: Unit 7B disposable **22/22**; focused backend/media
  **32/32**; Unit 7A **13/13**; dispatcher worker-kind **29/29**; prior worker
  runtime **31/31**; focused mobile/read/discovery assertions **80/80**;
  TypeScript with `--allowImportingTsExtensions`; media, vision, metadata, and
  publication builds; entrypoint smoke; deployment-runtime validator.
- M39 byte identity: local, `main`, and base `f8839c2` all resolve to Git blob
  `1154054240042863083aa2aa32c67bc18e46f71d`.
- External effects before candidate publication: none. M40 remains unapplied;
  connected Supabase, Storage, deployment, and live proof are all zero.

## 2026-08-12 Owner deferral decision

The Owner authorizes the scoped Unit 7B review candidate to be committed and
pushed now for Luna xhigh review. Real-PostgreSQL concurrency, Docker container
smoke, and the Deno Edge graph remain `NOT_RUN`; none is PASS. They are deferred,
not skipped, and all three are `REQUIRED_BEFORE_LIVE` on the final
post-correction SHA before the Stage J exact-SHA release gate. Review remains
`NOT APPROVED` until Luna passes.

## 2026-08-13 Sol Light correction closure

| Finding | Status | Corrected evidence |
|---|---|---|
| 001 rollout/publication/discovery eligibility | `CLOSED` | One server-owned primitive covers store lifecycle, established subscription statuses, entitlement, pilot locality, marketplace enablement, and allowlist; discovery fails closed after eligibility loss; store-row serialization protects active-listing admission. |
| 002 platform moderation authority | `CLOSED` | Conflict refresh preserves retained moderation; pending, blocked, prohibited, and unresolved flags deny republish without mutation; resolved platform authority permits publish. |
| 003 discovery regression | `CLOSED` | Exact ISBN-10/13 and the established active-variant helper are retained; server selects complete groups before limiting; deterministic group ordering and storefront cardinality prevent client-side pre-group truncation. Existing M07 cursor/variant database regressions remain green in the full Phase 9 run. |
| 004 media eligibility-loss refresh/retraction | `CLOSED` | Selection and targeted link/asset refresh share the complete public-media predicate; critical asset changes and link move/removal retract stale primary/damage projection. |
| 005 exact successful worker replay | `CLOSED` | Immutable binding plus exact canonical replay precede active-lease checks; only new effects require the live token/expiry/intent fence. Exact post-lease replay is canonical with zero second effect. |
| 006 real cross-layer proof | `CLOSED` | Disposable M40 database results flow through production Owner Edge request/runtime/error mapping, captured transport, real client decoder/query invalidation, and rendered Owner controls; network transport alone is mocked. |
| 008 factual documentation | `CLOSED` | Counts, host-gate outcomes, review state, and next action are corrected in the minimum continuity/evidence set. |

Final corrected-tree verification:

- Unit 7B disposable database: **27/27**; actual database→Edge runtime→decoder→
  query/UI: **4/4**.
- Focused migration/Edge/worker/discovery/media Jest: **25/25**; Unit 7A plus
  dispatcher disposable regression: **42/42**.
- Real PostgreSQL 18.4 disposable M01–M40 upgrade: **PASS**. Concurrency passes
  active-listing admission, RT05, RT07, RT12, and under-lock Owner
  reauthorization; the disposable database is dropped afterward.
- Full Phase 9 PGlite: **281/282**. The only failure remains the unchanged
  metadata-foundation fixture inserting null `canonical_works.primary_title`.
- Repository Jest: **2010 real tests passed** across 241 passing suites; the
  command fails only the same six unchanged empty fixture/support collectors.
  The separately invoked four-test cross-layer suite passes.
- TypeScript no-emit, Deno Owner Edge graph, four worker builds, worker
  entrypoint smoke, and deployment-runtime validator: **PASS**.
- Docker publication-worker/container smoke: **NOT_RUN/BLOCKED_ENVIRONMENT**.
  Docker Desktop and its CLI are installed, but the engine is unresponsive;
  no PASS is inferred.
- M39 is unchanged as Git blob
  `1154054240042863083aa2aa32c67bc18e46f71d`; no M01–M39 file is in the
  correction diff. M40 remains unapplied. Connected Supabase/Storage, deploy,
  live proof, Unit 7C, and main remain untouched.

Exact next authorized action: actual Luna xhigh full independent review of the
verified Unit-7A-integrated base through the corrected candidate SHA. Review is
still `NOT APPROVED`; do not begin exact-project preflight.
