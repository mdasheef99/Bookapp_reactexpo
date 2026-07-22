# Phase 9 Implementation and Verification Tracker

**Status:** `package1_independently_approved`
**Last updated:** 2026-07-22
**Use:** only after the Phase 9 planning set is approved
**Active work unit:** `package1_independently_approved`

This tracker is intentionally separate from planning decisions. It will hold implementation evidence and can grow without turning the master tracker into a worklog.

WU0B uses five distinct markers: `definition_complete_needs_review`, `definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`, `implementation_complete_needs_review`, and `independently_approved`. This unit is at the fifth marker after a separate review; approval grants no database/runtime authority.

## Work units

| Unit | Scope | Status | Required gate |
| --- | --- | --- | --- |
| 0 | [Contract fixtures, threat tests, migration plan, rollback/forward-correction plan](../work-units/00-contracts-threat-migration-plan.md) | `approved` | Corrections incorporated; no implementation/migration authorization |
| 0A | Server contracts, deterministic helpers, validation/error/provider/query/grant registers, fixtures, and red contract/security tests | `approved_complete` | independently reviewed 2026-07-19; no SQL/live writes; focused 4 suites/41 tests and all function 9 suites/53 tests pass |
| 0B | [Backend/API technical design](../work-units/00b-backend-api-technical-design-plan.md): seven routed artifacts covering command/query/DTO/actor/boundary inventories, state/transaction/idempotency/worker/telemetry matrices, exact later file allowlists, and red-test mapping | `independently_approved` | original and bounded correction verdicts `approved` 2026-07-22; consolidated Risk-Based Phase 9 SDD analysis next; no Supabase query, migration, endpoint, provider/storage/UI/runtime change or external mutation |
| 1 | [Package 1 live audit](../work-units/01-package1-live-audit.md) and [database design](../work-units/01-package1-database-design.md): metadata, aliases, condition/damage, pipeline/media/request-photo persistence, RLS/grants/functions/indexes/storage, and migration grouping | `independently_approved` | exact correction-only verdict `approved`; separately authorize red tests and migration-file creation |
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
- [ ] Only the initiating Owner mutates/resumes a pilot session; Phase 9 has no support takeover or cross-store private-data scope, and recovery is Owner retry, claimed-worker recovery, or reconciliation.
- [ ] Canonical tables cannot be mutated by Store Owner commands.
- [ ] RLS/grants and function `search_path`/EXECUTE are verified live.
- [ ] Grant matrix proves API-exposed tables have RLS and raw attempts/jobs/usage/cost/lifecycle structures plus private helpers are not directly callable by client roles.
- [ ] Authenticated clients cannot directly SELECT private Phase 9 base tables; named Q/RPC or positive-allowlist views are the only read surfaces, and worker/service grants are tested separately.
- [ ] Upload capabilities are persisted, server-derived, actor/purpose/entity/path bound, expiring, revocable/failable and atomically single-use for C02/C03, C15/C16 and C20/C21.
- [ ] Cost reservations enforce exactly one `(store_id, job_id, cost_kind, policy_version)` row under retries and concurrent inserts.
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
- [ ] Projection failure leaves candidate `committed`, publication `publication_failed`, and returns command/API outcome `committed_publication_failed`; idempotent retry cannot repeat inventory effects.
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

### 2026-07-22 — Package 1 six-finding correction

- Date/session: 2026-07-22 Package 1 review correction
- Authorized work unit and scope: correct only the six required audit/design findings and related status/validator expectations; no new Supabase query unless needed, migration/runtime file, or external mutation
- Completed: executable condition compatibility/backfill/final-CHECK order; persisted single-use upload capability relation and C01-C07/C20-C21 boundary coverage; named-only private reads and separate worker/service grants; exact cost-reservation uniqueness; first-possible deferred-FK additions; eight additive groups plus separately reviewed M09 quantity-validation gate
- Files/components/migrations: Package 1 documentation, required current-vs-target/status records, and continuity validator only; no migration or runtime file
- Verification actually run: continuity validator and `git diff --check` at correction closeout; no second live audit required
- Supabase/external mutations: none
- Decisions/deviations/risks: no settled SDD decision reopened; `damage` remains separate data; existing advisor backlog remains non-blocking unless a Phase 9 change copies/worsens it
- Next authorized action and gate: one correction-only review limited to these six findings; red tests, migration creation, M09/live application and runtime remain separately gated
- Independent review verdict: exact `approved`; all six findings fully covered; validator preservation verified; reviewer made no edits and performed no Supabase query/mutation
- Next authorized action and gate after approval: await separate authorization for failing tests or migration-file creation; M09/live application and runtime remain independently gated

### 2026-07-22 — Package 1 read-only database/storage audit

- Date/session: 2026-07-22 Package 1 database foundation audit
- Authorized work unit and scope: exact-project read-only Supabase audit and proposed database/migration design only; no migration creation/application or runtime/storage mutation
- Completed: current-state evidence, current-to-target matrix, exact proposed schema/RLS/function/index/storage changes, eight-group safe order, failing migration/RLS/security plan, and blocker classification
- Files/components/migrations: two Package 1 documentation artifacts plus required current-vs-target/continuity/tracker updates; no migration or runtime file
- Verification actually run: Supabase project/table/catalog/policy/grant/function/trigger/storage/migration/advisor queries; continuity validator, link/size/diff checks at closeout
- Supabase/external mutations: none; all SQL was SELECT/catalog readback and all Supabase MCP operations were read-only
- Decisions/deviations/risks: no settled SDD decision reopened; dedicated Phase 9 job table proposed while reusing Phase 6 claim mechanics; quantity validation stays a separate forward gate
- Tracker/source-doc updates: Package 1 audit/design, database-current-vs-target, master/implementation trackers, ACTIVE.md, DOC-13
- Next authorized action and gate: review Package 1 design and separately authorize failing tests or migration-file creation; live application remains independently gated

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

### 2026-07-20 — Work Unit 0B semantic-review corrections

- Date/session: 2026-07-20 bounded response to independent verdict `rejected_needs_redesign`
- Authorized work unit and scope: correct only request-photo confirmation/soft holds, persisted-state vocabulary, per-operation boundary/traceability, and red-test acceptance/unit ownership
- Original findings: customer acceptance incorrectly followed media provision without Owner quantity/price confirmation and soft hold; input/candidate states diverged from Master SDD §6; operations lacked exact primary boundaries and SDD/WU0A traces; red tests lacked acceptance IDs and future units
- Completed: added C27 media-validation, C28 Owner-confirmation, C29 hold-expiry and internal C30 soft-hold operations; acceptance now requires a current proposal and active hold; mapped exact Master/photo/Phase 6 persisted states and transitions; assigned C01–C30/Q01–Q11 boundaries/traces/units; expanded every red row with setup, denial/effect, observability, layer and owner; hardened semantic validator checks
- Files/components/migrations: WU0B router/artifacts, Phase 9 TRACKER, this tracker, DOC-13 and continuity validator only; no runtime/test/migration/config/generated file
- Verification actually run: pre-review continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); C01–C30/Q01–Q11 boundary/trace coverage and 50 owned red rows pass; six in-memory Owner-confirmation, hold-order, command-boundary, query-trace, red-owner and persisted-state negative probes pass; 12-file documentation/validator scope, links, size limits, prohibited paths and `git diff --check` pass; focused reviewer verdict pending
- Supabase/external mutations: none; Stage 2 remains blocked until focused reviewer approval
- Decisions/deviations/risks: exact live RPC/schema compatibility remains `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`; no SDD change was required because the governing sources were consistent
- Next authorized action and gate: focused independent review of the four corrected findings only; do not start Supabase audit unless verdict is `approved`

### 2026-07-20 — Work Unit 0B focused-review state-vocabulary corrections

- Date/session: 2026-07-20 bounded response to focused verdict `approved_with_required_corrections`
- Authorized work unit and scope: correct the three remaining persisted-state vocabulary conflicts and direct-contradiction validator coverage only
- Completed: request-photo initial state is `none`; `skipped_false_detection` is a review disposition while the candidate retains a Master §6 state; Phase 6 hold statuses are `active`, `released`, and `converted_to_sale`, with expiry modeled as release; the validator rejects all three former contradictory forms and requires the exact hold marker
- Files/components/migrations: existing WU0B documentation/validator correction set only; no runtime/test/migration/config/generated file
- Verification actually run: continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); three new in-memory contradiction probes PASS; `git diff --check` and the 12-file documentation/validator scope pass
- Supabase/external mutations: none; Stage 2 remains blocked until the new context-isolated reviewer returns exactly `approved`
- Decisions/deviations/risks: no SDD change was required; the owning SDDs already fixed the correct values
- Next authorized action and gate: new context-isolated review of the corrected WU0B design; do not start Supabase audit unless verdict is exactly `approved`

### 2026-07-22 — Work Unit 0B actor-dispatch and semantic-validator corrections

- Date/session: 2026-07-22 bounded response to isolated verdict `approved_with_required_corrections`
- Authorized work unit and scope: resolve only C12/Q11 multi-actor primary-boundary ambiguity and artifact-wide semantic state-contradiction coverage
- Completed: added primary boundary `AE` for a shared authenticated dispatcher with closed caller-specific authorization/projection branches; C12 separates same-store Owner from claimed worker authority and results; Q11 separates customer from owning-store Owner projections; validator requires exactly one primary boundary, checks both branch contracts, scans all seven artifacts against closed state vocabularies and rejects semantic contradiction variants
- Files/components/migrations: existing 12-file WU0B documentation/validator correction set only; no runtime/test/migration/config/generated file
- Verification actually run: semantic negative probes for `unrequested`, candidate terminal `skipped_false_detection`, and expired hold status PASS; C12/Q11 shared-boundary probes PASS; continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); `git diff --check`, exact 12-file allowlist, prohibited-path scan and ≤350-line artifact/validator limits PASS (validator 349 lines)
- Supabase/external mutations: none; Stage 2 remains blocked until the final context-isolated reviewer returns exactly `approved`
- Decisions/deviations/risks: shared AE dispatch preserves one operation identity while making caller authorization explicit; no SDD or WU0A behavior changed
- Next authorized action and gate: final context-isolated review of the complete corrected WU0B diff; do not commit, push or start Supabase unless verdict is exactly `approved`

### 2026-07-22 — Work Unit 0B exact C12 ownership and semantic-closure corrections

- Date/session: 2026-07-22 bounded response to the next isolated verdict `approved_with_required_corrections`
- Authorized work unit and scope: name one exact shared C12 implementation boundary and reject lifecycle/workflow/terminal/persisted-as/transition/arrow state contradictions
- Completed: proposed `supabase/functions/image-inventory-publication-retry/index.ts` is the sole C12 boundary, both valid callers route to one projection-only service, Owner/worker endpoints may not duplicate C12, Q11 stays request-photo-owned; state validation now parses the reviewer’s broader semantic forms across all seven artifacts
- Files/components/migrations: existing 12-file WU0B documentation/validator correction set only; no runtime/test/migration/config/generated file
- Verification actually run: generated 105-case state matrix across five domains/twenty-one claim forms plus two special state/disposition probes and two C12 ownership/duplication probes PASS; continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); validator remains ≤350 lines and `git diff --check` passes
- Supabase/external mutations: none; Stage 2 remains blocked until another context-isolated reviewer returns exactly `approved`
- Decisions/deviations/risks: dedicated C12 endpoint removes implementation ownership ambiguity without splitting the approved operation ID; valid request-photo `expired` remains distinct from released hold status
- Next authorized action and gate: another context-isolated review of the complete corrected WU0B diff; do not commit, push or start Supabase unless verdict is exactly `approved`

### 2026-07-22 — Work Unit 0B final independent approval

- Date/session: 2026-07-22 final context-isolated review and documentation-only approval closeout
- Authorized work unit and scope: record the existing exact verdict `approved`, update the required 13-file handoff set, validate once, commit and push
- Completed: WU0B transitioned separately from implementation-complete to independently-approved
- Files/components/migrations: WU0B documentation, Phase 9 status/handoff documents and continuity validator only; no runtime/test/migration/config/dependency/generated file
- Verification actually run: final continuity validator and `git diff --check`; commit/push evidence reported after success
- Supabase/external mutations: none; no database, Storage, provider, deployment or live application action occurred
- Decisions/deviations/risks: exact live database facts remain `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`; independent approval grants no migration or runtime authority
- Tracker/source-doc updates: WU0B router/artifacts, Phase 9 README/TRACKER, this implementation tracker, DOC-13 and continuity validator
- Next authorized action and gate: consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, migration and runtime remain unauthorized

### 2026-07-22 — WU0A/WU0B bounded contract correction

- Date/session: 2026-07-22 bounded SDD/contract correction and fresh correction-only review
- Authorized work unit and scope: reconcile alias vocabulary, price boundaries, publication outcome versus persisted state, complete stable-error mappings, exclude interactive support intervention, and add the nine named contract/design verification cases only
- Completed: canonical alias kinds/sources/statuses now round-trip with `common_spelling` and lifecycle-only supersession; private zero price and positive publication gates are separate; candidate/publication/API outcome vocabularies are closed; every C01–C30/Q01–Q11 error maps to registered metadata-complete `P9_*` codes; support takeover/cross-store private access is excluded; later runtime/release test ownership remains deferred
- Files/components/migrations: Phase 9 SDD/supporting/WU0/WU0B/tracker documents plus existing WU0A shared contract/domain files, fixtures, and tests; no migration, callable endpoint, product/mobile runtime, dependency, generated file, or Supabase artifact
- Verification actually run: focused WU0A Jest PASS 4 suites/45 tests; `npx.cmd tsc --noEmit` PASS; continuity validator PASS with 107 semantic cases, two C12 probes, 30 Markdown/link files, 25 required files, size checks, and embedded `git diff --check`; final standalone `git diff --check` PASS; fresh correction-only reviewer verdict `approved`
- Supabase/external mutations: no Supabase access/query/mutation, migration creation/application, Storage/provider call, deployment, or runtime action; Git commit/push evidence is reported after success
- Decisions/deviations/risks: P9-D39/P9-D40 corrected and P9-D44–P9-D46 added; no live-schema claim was made; interactive support tooling requires future separate design and authorization
- Tracker/source-doc updates: Master/Data/Extraction/Review/Media SDDs, data dictionary, traceability, WU0/WU0B artifacts, planning and implementation trackers, Phase 9 README/TRACKER, and DOC-13
- Next authorized action and gate: consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, database/migration design, migration creation/testing/application, and runtime remain unauthorized

When implementation is authorized, append one entry per material development session using the exact closeout shape in [SESSION-START](../SESSION-START.md): authorized unit/scope, completed work, files/components/migrations, verification actually run, external mutations, decisions/deviations/risks, documentation updates, and next authorized action/gate. Never rewrite an older evidence entry to make a later result look contemporaneous.
