# Phase 9 Implementation and Verification Tracker

**Status:** `wu0b_implementation_complete_needs_independent_review`
**Last updated:** 2026-07-20
**Use:** only after the Phase 9 planning set is approved
**Active work unit:** `0b_implementation_complete_needs_independent_review`

This tracker is intentionally separate from planning decisions. It will hold implementation evidence and can grow without turning the master tracker into a worklog.

WU0B uses five distinct markers: `definition_complete_needs_review`, `definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`, `implementation_complete_needs_review`, and `independently_approved`. This unit is at the fourth marker; completion does not imply independent approval or any database/runtime authority.

## Work units

| Unit | Scope | Status | Required gate |
| --- | --- | --- | --- |
| 0 | [Contract fixtures, threat tests, migration plan, rollback/forward-correction plan](../work-units/00-contracts-threat-migration-plan.md) | `approved` | Corrections incorporated; no implementation/migration authorization |
| 0A | Server contracts, deterministic helpers, validation/error/provider/query/grant registers, fixtures, and red contract/security tests | `approved_complete` | independently reviewed 2026-07-19; no SQL/live writes; focused 4 suites/41 tests and all function 9 suites/53 tests pass |
| 0B | [Backend/API technical design](../work-units/00b-backend-api-technical-design-plan.md): seven routed artifacts covering command/query/DTO/actor/boundary inventories, state/transaction/idempotency/worker/telemetry matrices, exact later file allowlists, and red-test mapping | `implementation_complete_needs_review` | documentation-only design completed 2026-07-20; independent review next; no Supabase query, migration, endpoint, provider/storage/UI/runtime change or external mutation |
| 1 | Data dictionary migration: metadata fields, aliases, condition/damage, media registry | `not_started` | fresh Supabase audit + migration review |
| 2 | Extraction session/input/candidate/enrichment/job tables, RLS, indexes, retention fields | `not_started` | Unit 1 verified |
| 3 | Private media staging, server upload authorization, validation/re-encode/promotion boundary | `not_started` | storage policy/security review |
| 4 | Vision adapter contract, primary/fallback orchestration, strict output validation | `not_started` | recorded fixtures; no live model in CI |
| 5 | Canonical-first metadata adapter/cache, ISBN validation, provider selection, aliases | `not_started` | provider fixtures and cost tests |
| 6 | Owner session/defaults/capture/review UI with accessibility and recovery | `not_started` | Units 2–5 verified |
| 7 | Controlled per-candidate commit, advisory duplicates, idempotency, projection changes | `not_started` | quantity/hold concurrency tests |
| 8 | Marketplace bookstore-first search, multilingual aliases, counts, full store catalogue | `not_started` | public/private projection tests |
| 9 | Damaged-book public media and mandatory customer photo-request extension | `not_started` | DOC-6/14 seam tests; no payment implementation |
| 10 | Lifecycle worker, deletion evidence, orphan cleanup, alerts, retention holds | `not_started` | lifecycle failure/replay tests |
| 11 | Pilot fixtures, security/regression/E2E/accessibility/cost verification and handoff | `not_started` | all prior units complete |

## Migration ledger

No Phase 9 migrations exist. Every future entry must record:

| Local filename | Live version/name | Project verified | Applied by | Rollback/forward fix | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| _none_ | _none_ | _n/a_ | _n/a_ | _n/a_ | _n/a_ | `not_started` |

Rules:

- Re-run Supabase `get_project` immediately before creating a live migration plan and again immediately before applying it.
- Use `apply_migration` for DDL; never use raw `execute_sql` for DDL.
- Never hard-code generated fixture IDs into data migrations.
- Prefer forward corrective migrations after application; do not rewrite live history.
- Record all bucket, policy, function, grant, trigger, constraint, index, and data-backfill effects.

## Required verification matrix

### Database and tenancy

- [ ] Every store-owned Phase 9 row has `store_id`.
- [ ] Store A cannot read, write, sign, promote, commit, or delete Store B data/media.
- [ ] Client-supplied `store_id` never establishes authority.
- [ ] Only the initiating Owner mutates/resumes a pilot session; support intervention is separately authorized/audited.
- [ ] Canonical tables cannot be mutated by Store Owner commands.
- [ ] RLS/grants and function `search_path`/EXECUTE are verified live.
- [ ] Grant matrix proves API-exposed tables have RLS and raw attempts/jobs/usage/cost/lifecycle structures plus private helpers are not directly callable by client roles.
- [ ] Inventory equality and active-hold semantics survive increment/new-row/partial failure races.
- [ ] Duplicate check and commit are concurrency-safe and idempotent.

### AI/provider contracts

- [ ] Prompt-injection text embedded in an image cannot cause tools, URLs, queries, or writes.
- [ ] Model output is rejected unless it satisfies the versioned schema and limits.
- [ ] Central validation matrix and API error catalogue generate/trace every contract limit and safe error behavior.
- [ ] A valid empty/no-book result does not trigger expensive retry loops.
- [ ] Primary failure triggers at most one allowed vision fallback.
- [ ] Metadata provider fallback is sequential and field conflicts are visible in provenance.
- [ ] Provider storage/display/cache/attribution/expiry permissions are enforced independently of provenance.
- [ ] ISBN checksums/conversion, title/author normalization, and alias rules have deterministic fixtures.
- [ ] CI uses recorded model/provider fixtures; no exact natural-language output assertion.

### Media and privacy

- [ ] MIME header, signature, decode, dimensions, byte/pixel limits, random path, re-encode, and EXIF/GPS stripping pass.
- [ ] Scan images and request photos cannot be retrieved through a public URL.
- [ ] Only approved sanitized derivatives become public inventory media.
- [ ] Signed request-photo URLs are short-lived and authorized against the final request item/customer/store.
- [ ] Deletion jobs are idempotent, observable, legal/dispute-hold aware, and leave tombstone evidence without retaining the image.
- [ ] Raw images/payloads never enter application logs, Sentry, analytics, notifications, or audit metadata.

### Owner UX and accessibility

- [ ] Start/Close-only session behavior works across foreground/background/logout/network loss.
- [ ] Camera and gallery uploads support one selected language and enforce the 15-spine cap.
- [ ] Minimal review fields, defaults, add-missed/remove-false, duplicate warning, condition explanations, and preview are keyboard/screen-reader accessible.
- [ ] A failed candidate does not block successful candidate commits.
- [ ] Projection failure retains one private `committed_publication_failed` inventory effect and idempotent retry cannot repeat it.
- [ ] Session summary accurately reports committed/private/published/needs-review/failed/skipped counts.

### Marketplace and customer photos

- [ ] Search returns each eligible matching bookstore once and all eligible stores across pagination.
- [ ] Versioned store-group cursor/ranking contract survives ties, context changes, multiple offers, and page boundaries.
- [ ] Storefront shows the complete active public catalogue and distinct title count.
- [ ] Original-script and approved alias searches return the same eligible listing without changing displayed identity.
- [ ] Exact inventory quantity, shelf, cost, raw payload, private notes, and request photos never appear publicly.
- [ ] Requested photo item cannot reach `payment_ready` without provided and accepted current-copy photos.
- [ ] Request-photo evidence never affects duplicate identity, quantity compatibility, or row separation.
- [ ] Store inability to provide requested photos marks the item unfulfilled/unavailable and releases eligible holds.

### Operational readiness

- [ ] Metrics cover extraction quality, owner corrections, fallback, latency, cost, quota, cleanup backlog, and repeated request-photo failures.
- [ ] Alerts cover stuck jobs, cleanup failures, unexpected fallback/cost spikes, and cross-tenant denials.
- [ ] Model/provider/prompt/schema versions support rollback and incident correlation.
- [ ] Feature flag, store allowlist, locality gate, and kill switch are verified.
- [ ] No Phase 7/8 payment, paid-order, pickup, refund, ledger, or settlement behavior is introduced.

## Append-only implementation log

No product implementation activity recorded.

### 2026-07-19 — Work Unit 0 planning checkpoint

- Date/session: 2026-07-19 Work Unit 0 planning
- Authorized work unit and scope: WU0 planning only; documentation commit authorized; no product code or migration creation/application
- Completed: approved baseline committed as `f9f6890`; versioned contracts, fixture matrix, threat tests, migration sequence, forward-correction rules, and pre-migration gates planned
- Files/components/migrations: documentation only; no migration file, app/function code, bucket, policy, or live data change
- Verification actually run: fresh exact-project read-only Supabase audit; continuity validator PASS (22 Markdown files, 17 required phase files); local links/350-line limit PASS; `git diff --check` PASS
- Supabase/external mutations: none
- Decisions/deviations/risks: no new product behavior; pre-existing RLS/public-bucket/privileged-function/password findings remain separate review gates
- Tracker/source-doc updates: WU0 plan, Phase 9 tracker, implementation tracker, handoff/router references, DOC-13, audit refresh, validator
- Next authorized action and gate: user review of WU0 plan; implementation, migration-file creation, and migration application remain unauthorized

### 2026-07-19 — Work Unit 0 correction and approval checkpoint

- Date/session: 2026-07-19 WU0 required-corrections incorporation
- Authorized work unit and scope: authoritative documentation corrections and commit only
- Completed: alias, validation/error, publication failure, request-photo duplicate, session ownership/Close, privilege, quantity, marketplace query, provider reuse, security-test, and migration-sequence corrections
- Files/components/migrations: documentation only; no migration, contract code, endpoint, app, bucket, policy, provider, or live data change
- Verification actually run: continuity validator PASS (22 Markdown files, 17 required phase files); local links/350-line limit PASS; 134 Phase 9 acceptance IDs unique; `git diff --check` PASS; no product/function/migration/app file changed
- Supabase/external mutations: none
- Decisions/deviations/risks: terminal-input Close retained; quantity validation stays a separately reviewed production gate; WU0 approved without authorizing WU0A
- Tracker/source-doc updates: root source specs, all affected Phase 9 SDDs/supporting records, trackers, handoffs, and validator
- Next authorized action and gate: none; await explicit authorization for named WU0A contract/test scope, with migrations still separately gated

### 2026-07-19 — Work Unit 0A contract/test foundation

- Date/session: 2026-07-19 WU0A implementation
- Authorized work unit and scope: server-owned versioned contracts, pure deterministic helpers, central validation/error/provider-reuse/marketplace-query/grant registers, sanitized fixtures, and contract/security tests only; explicitly no migrations, Supabase/storage/provider/product-write/live-application changes
- Completed: strict vision/metadata/alias parsers; contract/version limits; ISBN, BCP 47, fallback, initiator-only session/Close, duplicate advice, quantity, publication-idempotency, marketplace cursor, provider-reuse, error, grant-design, and future red-gate foundations
- Files/components/migrations: `supabase/functions/_shared/imageInventory/`, four `phase9_*.test.ts` suites, and synthetic fixtures under `supabase/functions/__tests__/fixtures/phase9/`; no migration file
- Verification actually run: focused Jest 4 suites/24 tests passed after one red-first HTTPS-cover correction; all nine Edge Function test files passed 9 suites/36 tests; strict standalone TypeScript check passed; continuity validator and final diff checks recorded at session close. An intermediate directory-targeted Jest command incorrectly collected three fixture modules as empty suites; the explicit `*.test.ts` run passed.
- Supabase/external mutations: none; no Supabase read was necessary because WU0A contains no database/storage decision or operation; no network/provider call
- Decisions/deviations/risks: future production gates remain explicitly `red` in a typed register while the WU0A package itself stays green; cover URI-shaped values require HTTPS and no URL credentials; concrete provider-host allowlisting remains adapter configuration in its later unit
- Tracker/source-doc updates: Phase 9 master tracker, master SDD implementation marker, README, implementation tracker, and DOC-13
- Next authorized action and gate: none; await WU0A review and explicit authorization for one named later unit; migration creation and application remain separately unauthorized

### 2026-07-19 — Work Unit 0A independent review and approval

- Date/session: 2026-07-19 independent WU0A review/correction/approval
- Authorized work unit and scope: independently inspect, narrowly correct, verify, stage, and commit WU0A only; no SQL, endpoint, provider, product UI/write, deployment, push, merge, or Supabase/storage mutation
- Completed: classified every changed file; corrected central-limit consumption, provider-host allowlisting, server-built vision request/default language, common envelopes, retained alias provenance, active-content validation, terminal Close transitions, publication retry non-write contract, grant controls, marketplace grouping/query semantics, DTO/telemetry exclusions, and adversarial/no-match fixtures/tests
- Files/components/migrations: WU0A shared server contracts/domain helpers, four Phase 9 test suites, synthetic fixtures, package README, authoritative Phase 9 trackers/status docs, and continuity validator; no migration file
- Verification actually run: focused Jest 4 suites/41 tests passed; all nine Edge Function suites/53 tests passed; strict standalone TypeScript passed; secret/capability/network scan found only synthetic negative fixtures, denial assertions, and historical documentation terms; continuity/link/Markdown validator and final Git checks recorded after status update/commit
- Supabase/external mutations: none; project authority remains documented as `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`); no provider/network/storage call or deployment
- Decisions/deviations/risks: review outcome `approved_with_required_corrections`, corrected to final `approved`; configured provider hosts remain per-adapter policy data; future runtime/database gates remain typed red and unimplemented
- Tracker/source-doc updates: master tracker, implementation tracker, Master SDD implementation marker, Phase 9 README, package README, DOC-13, and continuity validator
- Next authorized action and gate: none; WU0B backend/API technical design is next eligible but requires separate explicit authorization; migration creation/application remain unauthorized

### 2026-07-19 — Work Unit 0B definition correction

- Date/session: 2026-07-19 planning-only WU0B definition correction
- Authorized work unit and scope: create the dedicated WU0B planning document and update only the named continuity/status documents; no runtime/test/migration/external work
- Completed: normalized the repository-to-Phase-9 startup chain; routed WU0 → WU0A → WU0B → Unit 1; defined command/query, actor/auth, transport/service/repository, DTO/privacy, state/transaction/idempotency, worker/provider, marketplace, telemetry/rate-limit, red-test, acceptance, non-goal, file-allowlist, and later-gate requirements
- Files/components/migrations: documentation allowlist only; no migration, endpoint, function, app, fixture, dependency, generated file, bucket, policy, provider, or live data change
- Verification actually run: continuity validator PASS (23 Markdown files, 18 required phase files); `git diff --check`, Markdown links, Phase 9 document size, WU0B routing, single-next-action, eight-file allowlist, and prohibited-path checks passed
- Supabase/external mutations: none; no live database fact was uncertain for this planning-only correction
- Decisions/deviations/risks: no product behavior changed; WU0A remains authoritative; WU0B plan existence is not implementation or approval
- Tracker/source-doc updates: WU0B definition, SESSION-START, master/detailed trackers, Phase 9 README, DOC-13, and the planning-approval checklist clarification
- Next authorized action and gate: independent review of the committed WU0B definition and updated continuity validator only; WU0B implementation and migration creation/application remain unauthorized

### 2026-07-20 — Work Unit 0B independent-review corrections

- Date/session: 2026-07-20 documentation-only correction after independent WU0B definition review
- Authorized work unit and scope: correct the five reported documentation/validator findings only; no runtime/test/migration/external implementation
- Completed: routed ACTIVE.md to WU0B; added separate scan, request-photo, and public-copy capability commands plus controlled post-commit edit commands; made marketplace listing matching service-internal and public pagination store-grouped; separated `implementation_complete_needs_review` from `independently_approved`; anchored current markers and added contradiction/order/gate/coverage checks to the validator
- Files/components/migrations: Phase 9 documentation and continuity validator only; no endpoint, repository, worker, adapter, migration, function, bucket/policy, provider, UI, dependency, fixture, generated file, or live data change
- Verification actually run: continuity validator PASS (23 Markdown files, 18 required phase files); five in-memory negative mutation probes PASS; Markdown links, 350-line limit, WU0 → WU0A → WU0B → Unit 1 routing, single-next-action, six-file correction allowlist, prohibited paths, and `git diff --check` PASS
- Supabase/external mutations: none; no live database fact was needed for this documentation-only correction
- Decisions/deviations/risks: no product behavior changed; corrections make existing SDD requirements and authorization gates explicit; independent re-review remains required
- Tracker/source-doc updates: ACTIVE.md, WU0B definition, continuity validator, master tracker, implementation tracker, and DOC-13
- Next authorized action and gate: independent re-review of the corrected WU0B definition and continuity validator only; WU0B implementation and migration creation/application remain unauthorized

### 2026-07-20 — Work Unit 0B corrected-definition independent approval

- Date/session: 2026-07-20 independent re-review of corrected WU0B definition and continuity validator
- Authorized work unit and scope: read-only re-review, then record the verdict and commit/push only if no findings remained; no runtime, migration, Supabase/Storage, provider, or UI work
- Completed: reviewed the complete correction diff; added the missing definition-approved/intermediate authorization marker; final verdict `approved`
- Files/components/migrations: documentation and continuity validator only; no runtime component, migration, endpoint, bucket/policy, dependency, fixture, generated file, or external mutation
- Verification actually run: continuity validator PASS (`MARKDOWN_FILES_CHECKED=23`, `REQUIRED_PHASE_FILES=18`); five in-memory negative probes PASS; `git diff --check`, eight-file allowlist, prohibited runtime/migration paths, WU0→WU0A→WU0B→Unit 1 order, and single-next-action checks PASS
- Supabase/provider/storage/runtime mutations: none; the user separately authorized the documentation commit and Git push, which are reported at handoff after success
- Decisions/deviations/risks: corrected WU0B definition is approved; WU0B technical-design implementation remains unauthorized and must receive a separate explicit authorization
- Tracker/source-doc updates: WU0B definition, Phase 9 README/master/planning/implementation trackers, DOC-13, ACTIVE.md routing, and continuity validator
- Next authorized action and gate: request separate authorization for bounded WU0B technical-design implementation only; migration creation/application remain unauthorized

### 2026-07-20 — Work Unit 0B documentation-only technical-design completion

- Date/session: 2026-07-20 bounded WU0B artifact implementation
- Authorized work unit and scope: seven cohesive technical-design artifacts, authority/router alignment, status/continuity updates and validator hardening only
- Completed: C01–C26 and Q01–Q11 catalogue; DTO/error/rate design; actor/tenant/privacy/grant matrices; state/transaction/idempotency/publication design; job/provider/media/lifecycle design; marketplace/request-photo design; red tests, audit questions, future exact proposed file map and handoff
- Files/components/migrations: seven new Markdown artifacts plus authorized WU0B router, Phase 9 README/session/master/implementation trackers, DOC-13 and continuity validator; no component, test, migration or generated file
- Verification actually run: continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); five in-memory missing-route/command/category, premature-approval and later-authority negative probes PASS; 14-file authorized allowlist, Markdown links, ≤350-line artifact/router limits, C01–C26/Q01–Q11 coverage, exactly one next action, audit markers, no placeholders, prohibited-path absence and `git diff --check` PASS
- Supabase/external mutations: no Supabase query or mutation, provider call, Storage change, deployment, push or merge during this work unit
- Decisions/deviations/risks: detailed artifacts resolve the approved single-document size conflict; database-dependent facts remain `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`; prior authorized main merge/push occurred before this work unit
- Tracker/source-doc updates: WU0B authority/router, seven-artifact set, SESSION-START, Phase 9 README/TRACKER, this implementation tracker, DOC-13 and validator
- Next authorized action and gate: authorize an independent review of the completed WU0B technical-design artifacts only; Supabase audit, database/migration design, migration creation/testing/application and runtime remain unauthorized

When implementation is authorized, append one entry per material development session using the exact closeout shape in [SESSION-START](../SESSION-START.md): authorized unit/scope, completed work, files/components/migrations, verification actually run, external mutations, decisions/deviations/risks, documentation updates, and next authorized action/gate. Never rewrite an older evidence entry to make a later result look contemporaneous.
