# Phase 9 Master Tracker

**Planning status:** `unit6_owner_ux_approved_design_authority`
**Implementation status:** `wu2_owner_inventory_client_locally_complete_runtime_deferred`
**Last updated:** 2026-08-07
**Current milestone:** WU2 Owner inventory read client locally complete; Unit 6F remains open; the production Gemini-to-metadata-to-review path requires a read-only vertical integration audit before further implementation
**Active work unit:** `phase9_core_pipeline_vertical_integration_audit`
**Environment:** Development application with a shared remote Supabase development project; this is not a production deployment and has no external production app consumers. The exact Supabase project is **`Bookconnect_reactexpo`** (project ref **`ahntbtktjjmvfosgkmgn`**, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`, `ap-southeast-2`). In this tracker, “live” means readback against that development project. “Legacy consumer” means a stale repository-internal screen/service path, not a deployed customer application that must remain backward-compatible.
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** WU2 locally cut over the read-only Owner `/inventory` route to `phase9_owner_inventory_page_v1`; [tracker 26](./trackers/26-owner-inventory-read-client-wu2-evidence.md) records the focused and regression evidence. The Store Owner route registration correction is also local. Unit 6F remains open.
**Next authorized action:** run a read-only vertical integration audit under existing Unit 4B/5A/5B authority
**Migration note:** M29 is live once as `20260730162700 marketplace_phase9_owner_safe_contracts`; M30 is live exactly once as `20260801093048 marketplace_phase9_unit6e_review_corrections`; WU1 is live exactly once as `20260803221216 marketplace_phase9_owner_inventory_read_boundary`; post-application readback and anonymous RPC denial passed
**Scope boundary:** WU2 remains read-only. The audit must trace upload, media, Gemini/vision, metadata enrichment, candidate readiness, and Unit 6 consumption without implementing, deploying, invoking providers, mutating the database, or starting Unit 7.
**Implementation authority:** Read-only repository and exact-project verification only. Any code, migration, provider call, deployment, scheduler, database/Storage mutation, inventory/publication behavior, or Unit 7 work requires a separately reviewed plan and explicit authorization.
**Migration creation/application authority:** WU1 file creation and the one authorized application are complete; M18-M30 remain immutable live history; no other migration or database mutation is authorized
**Current gate:** `CORE_PIPELINE_INTEGRATION_UNPROVEN`; real Gemini inference, production metadata-job creation/execution, enriched-candidate persistence/readback, representative Android evidence, and the remaining WU1/WU2 runtime matrix are unproven. Unit 7 remains gated.
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

The approved Phase 9 workflow requires validated vision output to pass through
local-canonical-first metadata enrichment before Owner review becomes
actionable. Repository evidence proves the component foundations but does not
yet prove the production handoffs or a complete upload-to-enriched-review run.
The next action is therefore a read-only vertical integration audit. Unit 6F,
WU1/WU2 runtime evidence, and Unit 7 remain open gates.

The current remediation context is development-only: there is no production rollout or external consumer compatibility requirement. The active problem is incomplete migration inside the development codebase from the Phase 4 direct-table owner console to the Phase 9 controlled owner boundary. The development Supabase project remains a real remote database, so authenticated/RLS/RPC behavior must still be verified against the exact project before any database mutation; this does not make the application a production environment.

The user explicitly re-sequenced WU1 ahead of the Unit 6F native gate. WU1
covered the [contract addendum](./work-units/owner-inventory-read-boundary-wu1-sdd.md),
red tests, exact-project preflight, and application of
`20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`. The
stable `phase9_owner_inventory(uuid)` detail RPC remains intact. The focused
static suite (10/10), local PGlite behavior/readback suite (3/3), continuity
validator, exact-project preflight, post-application readback, and anonymous
RPC denial passed. Positive Owner JWT runtime remains deferred because no
approved Owner credential was available; the native Unit 6F gate remains after
that runtime gate.

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Phase 9 M01-M08/M10-M14 are live exactly once and M09 remains absent. M13 exposes only minimum `SECURITY INVOKER` public wrappers for the authoritative private service RPCs; M14 adds service-only provider-attempt lineage and final egress validation. Owner ingestion is active with JWT verification; `phase9-media-sanitation` and `phase9-fixture-vision` are separate free-plan Render services at `96991a9`.

The [Unit 4 design](./work-units/04-fixture-vision-analysis-runtime-design.md) and [Unit 4A deployment runtime](./work-units/04a-deployment-runtime-scaffolding-sdd.md) are now live-verified through the [fixture deployment evidence](./trackers/06-fixture-pipeline-deployment-evidence.md). The deployed `one_book` path and eight fresh-process operator cases used recorded fixtures only, `batchSize: 1`, normal claim/fencing/persistence/failure paths, and produced zero inventory/listing/publication effects. Unit 5B now implements the initial Google Books adapter behind provider-neutral contracts, but it remains fixture/mock verified only: no credential, live call, deployment, or registry mutation occurred.

[Unit 5C Lite](./work-units/05c-lite-multilingual-search-variants-sdd.md)
is the approved target specification. Unit 5C-1 supplies its optional
versioned provider-neutral sidecar contract, strict field/language/script
validation, deterministic comparison/deduplication, and a safe companion
decoder. Unit 5C-2 adds private `phase9_search_variant_proposals` persistence,
token/attempt-fenced write and store-bounded read RPCs, and proposed-only,
non-searchable lifecycle defaults. M18 is live once as `20260729004216`;
M19 is live once as `20260729020008` and rejects changed accepted sidecar
replays through one immutable analysis-scoped fingerprint.
Unit 5C-3 adds the optional multilingual companion to the existing single
Gemini call while isolating strict canonical `p9-vision-v2` output from
independently validated sidecar failure. Accepted companions persist through
M18/M19 and reconcile title and each author independently against confirmed
Owner snapshots using narrow deterministic normalization, material-change
classification, default-deny activation, and trusted proposed/active/stale
transitions. M21 removes M20's temporary 5C-4 public search/materialization
effects. Unit 5C-4 then reintroduces the independently reviewed active-only,
store-scoped materialization and search boundary through immutable M22/M23.
It preserves exact source-field authority, original/ISBN/legacy search,
listing eligibility, and public display identity while retracting stale or
inactive search effect fail closed.
Unit 5C-5/5C-6 backend is independently approved and live through M24-M28:
strict Owner-only review/correction, candidate-first replacement locking,
canonical private benchmark evidence, platform review/evidence reads, and
exact approved rollout controls. No language is benchmarked or approved and
no capability is enabled.

Unit 6A is merged on `main` and live-verified through M29. Unit 6B is merged at
`9ef9eb3`, and Unit 6C is merged through `092562d`. Unit 6D remains implemented
at `c363b60`. Unit 6E false/missed-variant corrections are finalized at
`8bceab260a953b4d832fd55f34f58db12fa009b1`; M30 is live exactly once and its
remote helper/RPC definitions, read-only fixture checks, and fail-closed owner
authorization boundary are recorded in [tracker 23](./trackers/23-unit6e-review-corrections-evidence.md).
Unit 6F browser verification, live disposable Save/Close readback, and local
quality gates are recorded in [tracker 24](./trackers/24-unit6f-readiness-quality-gates-evidence.md).
The Unit 6F completion gate remains open because representative low-end Android
evidence was not run; Unit 7 remains separately gated.

The provider/scale reconciliation keeps real Gemini provider-contract design as a separately gated prospective Unit 4B and keeps Unit 5 authoritatively named `Metadata/aliases`. The generic architecture supports one metadata primary and at most one disabled-until-approved secondary, horizontal correctness, and a fixed-multi-replica activation gate; it does not authorize provider calls, deployment changes, scheduling, or autoscaling. The bounded F1–F3 correction removes the deferred-secondary contradiction, makes media/vision/metadata capacity signals explicit, and disables raw provider/model payload persistence by default while retaining the independent-review gate.

The founder subsequently authorized Unit 4B and superseded only the initial primary
vision model ID to configuration-driven `gemini-3.5-flash-lite`; the earlier
`gemini-3.5-flash` handoff remains historical. Unit 4B is merged and M14 is
live-verified. The fixture adapter remains available, and no optional vision
fallback is selected or enabled.

The founder then authorized only the review corrections. Local M14 now adds
service-only vision-provider attempts and bounded register/validate/finalize/
associate/mark RPCs. Gemini registers an attempt, revalidates immediately before
private download, and revalidates again immediately before provider egress. Stable
logical spend identity is claim-retry independent, while each registered call has
a unique provider-attempt identity. Pricing evidence is a semantically validated
positive allowlist in TypeScript and SQL. M14 is live once as `20260727183546`;
no provider was configured, deployed, or called.

Auth hardening WU1/WU2 is locally complete and independently approved on `codex/auth-hardening-core`: production bypass policy is centralized and fail-closed; Zustand owns canonical session/status; one root bootstrap owns subscription/restoration; identity replacement remains blocked through cleanup failure and explicit retry; and current-device logout persists a non-secret deletion-intent guard until SDK or exact-key fallback removal succeeds. Auth no longer directly imports marketplace. Secure token persistence, Android backup, authoritative profile routing, OTP UX, native/offline testing, and remote EAS verification remain separately gated before Phase 9 mobile/private-ingestion runtime integration.

Repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → `SESSION-START.md` → this tracker is the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

The exact development project was re-verified read-only at M11/M12 closeout:

| Field | Verified value |
| --- | --- |
| Project ID | `ahntbtktjjmvfosgkmgn` |
| Name | `Bookconnect_reactexpo` |
| Region | `ap-southeast-2` |
| Status | `ACTIVE_HEALTHY` |
| Postgres | 17.6.1 |
| Tenant discriminator | `store_id` (37 public-schema columns; zero `tenant_id`) |

## Tracker routing

- Product/planning decisions, source reconciliation, and live audit: [01-planning-and-decisions.md](./trackers/01-planning-and-decisions.md)
- Future implementation units, migrations, verification, rollout, and evidence: [02-implementation-and-verification.md](./trackers/02-implementation-and-verification.md)

## Planning deliverables

| Deliverable | Status |
| --- | --- |
| Root source-spec reconciliation | `complete` |
| Master SDD | `approved_baseline` |
| Data/canonical/metadata SDD | `approved_baseline` |
| Extraction/enrichment SDD | `approved_baseline` |
| Owner review/commit SDD | `approved_baseline` |
| Media/security/privacy SDD | `approved_baseline` |
| Marketplace display SDD | `approved_baseline` |
| Customer photo-request SDD | `approved_baseline` |
| Data dictionary | `approved_baseline` |
| Live database/storage current-vs-target audit | `package1_refresh_complete_read_only_2026-07-22` |
| Requirements traceability | `approved_baseline` |
| Complexity/scope register | `approved_baseline` |
| Cross-document link, acceptance-ID, and terminology validation | `complete` |
| Repository/active-phase/session routing | `complete` |
| Documentation update and closeout protocol | `complete` |
| Automated continuity validator | `complete` |
| User/design approval | `complete_2026-07-19` |
| Work Unit 0 plan | [`approved_2026-07-19`](./work-units/00-contracts-threat-migration-plan.md) |
| Work Unit 0A contracts/tests | `approved_2026-07-19` |
| Work Unit 0B technical design | [`independently_approved`](./work-units/00b-backend-api-technical-design-plan.md) |
| Work Unit 4 fixture vision-analysis runtime | [`integrated_main_e9ba2d9`](./work-units/04-fixture-vision-analysis-runtime-design.md) |
| Work Unit 4A deployment-runtime scaffolding | [`deployed_and_live_fixture_verified`](./trackers/06-fixture-pipeline-deployment-evidence.md) |
| Work Unit 4B Gemini vision adapter | [`m14_live_verified_provider_deferred`](./work-units/04b-gemini-vision-adapter-handoff.md) |
| Unit 5C Lite target SDD | [`merged_at_b44277a`](./work-units/05c-lite-multilingual-search-variants-sdd.md); Units 5C-1 through 5C-6 are merged/live at their recorded levels; M24-M28 live exactly once and no language enabled |
| Unit 6 Owner UX design authority | [`unit6e_finalized`](./work-units/06-owner-capture-review-recovery-ux-sdd.md); [contract matrix](./work-units/06-owner-capture-review-recovery-contract-matrix.md); [Unit 6A evidence](./trackers/19-unit6a-owner-safe-backend-evidence.md); [Unit 6B evidence](./trackers/20-unit6b-route-query-cache-evidence.md); [Unit 6C evidence](./trackers/21-unit6c-capture-upload-recovery-evidence.md); [Unit 6D evidence](./trackers/22-unit6d-candidate-review-evidence.md); [Unit 6E evidence](./trackers/23-unit6e-review-corrections-evidence.md); Unit 6F separately gated; split 6A-6F |
| Provider and scale architecture SDD reconciliation | `stale_marker_superseded_by_unit4b_m14_m17_unit5a_review_evidence_2026-07-28` |

## Blocking gate before further implementation

WU0A, WU0B, Package 1, Unit 4, Unit 4A, Unit 4B, Unit 5A, Unit 5B, and Unit
5C-1 through Unit 5C-6 backend have component, fixture, migration, or live
evidence at their recorded levels. Those records do not prove a production
Gemini-to-metadata-to-review integration.
M01-M08/M10-M28, the Owner ingestion boundary, and both separate fixture
workers are live-verified; M09 remains absent. Unit 5C-4 is merged at
`d092f08`; Unit 5C-5/5C-6 and Unit 6A are merged on `main`. Unit 6B is merged
at `9ef9eb3`; Unit 6C is merged through `092562d`; Unit 6D is implemented at
`c363b60`; Unit 6E is finalized with M30 live exactly once. Unit 6F requires
separate authorization. Customer display changes,
customer display changes, inventory/publication, commerce, provider fallback,
and global alias authority remain separately gated.

Before further implementation, a read-only vertical audit must identify the
exact missing production transitions, callers, worker runtime, database
boundaries, candidate-state gates, provider configuration, and Unit 6 DTO
consumption. The audit may not originate new product requirements or authorize
deployment, provider calls, migrations, external mutation, or Unit 7.

## Risk summary

| Risk | Current containment |
| --- | --- |
| Cross-tenant write/read | Server derives `store_id`; RLS is backstop; every privileged boundary needs Store A-to-Store B denial tests. |
| Multimodal prompt injection | Model receives no tools; output is untrusted and schema-validated; deterministic code owns all calls and writes. |
| Accidental publication | Mandatory owner review; first-session publication default is private; listing eligibility is server-controlled. |
| Canonical catalogue pollution | Uncertain/manual entries remain store-local with nullable canonical link. |
| Duplicate over-merge | Advisory warning only; no image comparison and no automatic merge. |
| Public/private media leakage | Separate scan, public-copy, and request-photo classes; server-mediated promotion; private request delivery. |
| Cost/retry explosion | Image hash replay protection, one whole-image fallback maximum, sequential metadata providers, policy quotas. |
| Stale inventory | Confirmation-before-payment remains; `last_verified_at` and repeated request-photo failures feed listing review. |
| Lifecycle/storage growth | Purpose-specific retention, deletion jobs, orphan detection, legal/dispute holds, deletion evidence. |
| Existing global Supabase warnings | Recorded as pre-existing; Phase 9 cannot copy broad public listing or ambient `SECURITY DEFINER` patterns. |
| Dedicated sanitizer worker | Local feasibility passed at 8/12/16 MP; provision and load-test a non-Edge worker with the recorded CPU/memory envelope before deployment. |

### Unit 6F architectural risk: Owner operation lifecycle composition

Recorded 2026-08-02 under Unit 6 SDD §§19–21, 28, and 34–35 and correction
commits `237393b`/`a0d55b5`. The feature composes domain operation hooks (semantic
idempotency and canonical mutation), `useOwnerUxOfflineGate` (identity/version
authority and offline blocking), and screen-level mounted-scope/in-flight
fencing. The correction pass depends on those boundaries for Save cancellation,
generation-aware reconnect authority, CandidateReview reconnect deduplication,
and the exact pending confirmation state.

Keep these layers composed for the current closeout; do not introduce lifecycle
consolidation in Unit 6F or Unit 7. A future consolidation must preserve the
operation key, canonical-version gate, mounted-scope generation, reconnect
coalescing, pending UI, and zero-Unit-7-effect invariants with red-first tests
and fresh browser/native evidence. This is a risk/decision gate only and does
not authorize implementation.

### Unit 6F native UUID remediation checkpoint

Recorded 2026-08-02 under Unit 6 SDD §§8–9, 13–14, 19–24, and 34–35. The
native scan startup crash caused by browser-global `crypto` was corrected with
the SDK54-compatible `expo-crypto` API; capture attempt identities are now
lazy and render-stable. Focused capture tests passed 17/17, the full
image-inventory suite passed 223/223, TypeScript and diff hygiene passed, and
no Supabase/Storage/migration/external mutation occurred. No Android device or
emulator was visible to `adb`, so the native completion gate remains open and
the next action is the representative SDK54 Android evidence in tracker 24.

### 2026-08-03 web runtime and route-warning checkpoint

The Store Owner tab warning was corrected by registering the concrete
`orders/index` route declared by the filesystem; the route regression test
passed. `npm.cmd run export:web` passed after bundling 2,245 modules. The
authenticated Codex in-app browser reached `/library`, `/dashboard`, and
`/inventory` with no browser console errors; existing style, notifications,
Sentry, and build-tool warnings remain. The live exact-project read-only ACL
check confirmed that `store_inventory` has RLS enabled but no authenticated
table SELECT/INSERT/UPDATE privilege, while owner policies and controlled
inventory RPCs remain present. Legacy Store Owner services still use direct
`store_inventory` reads/writes, and the inventory hook swallows the read error;
this boundary remediation is not included in the route fix. No Supabase,
Storage, migration, deployment, inventory, listing, or publication mutation
occurred. This historical checkpoint was superseded by the explicit WU1
re-sequencing above; the current next action is separate review/approval of the
unapplied WU1 draft, followed by representative SDK54 Android evidence. Unit 7
and live migration application remain gated.

### 2026-08-04 WU1 post-review correction checkpoint

- Authorized work unit and scope: local correction of the WU1 contract, unapplied
  SQL draft, red tests, continuity validator, and evidence documentation only.
- Completed: explicit NULL page-size rejection; safe `P9_INTERNAL_ERROR`
  normalization; `asOf` clarified as an ordering horizon rather than a full
  repeatable snapshot; WU1 addendum/evidence artifacts made continuity-gated.
- Preserved: existing quantity/publication write paths, stable detail RPC,
  routes, screens, hooks, services, dashboard, live grants/policies, and all
  external state.
- Verification: correction red run reproduced 3 failures; focused green Jest
  passed 9/9; PGlite passed 1/1; continuity passed with 65 Markdown files and
  51 required phase files; final diff hygiene passed.
- Supabase/external mutations: none; migration `20260803000031` remains local
  and unapplied, with live history ending at M30.
- Next authorized action: independent review of the corrected draft and runtime
  application-test plan; separate application approval is still required.

### 2026-08-04 WU1 application and post-application readback checkpoint

- Authorized work unit and scope: WU1 only; exact-project development
  application, readback, and non-mutating runtime checks. No client, UI,
  legacy-caller, write-path, dashboard, Storage, provider, or production change.
- Completed: migration `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`
  applied exactly once through Supabase MCP as live version
  `20260803221216 marketplace_phase9_owner_inventory_read_boundary`.
- Verification: new eight-argument `jsonb` RPC and exact owner-page index are
  present; `STABLE SECURITY DEFINER`, postgres owner, empty `search_path`, and
  narrow ACLs read back; stable detail RPC, RLS/policies, table ACL, existing
  indexes/constraints, and projection trigger/function are unchanged.
- Runtime: anonymous REST execution was denied with HTTP 401. Positive Owner,
  cross-store, inactive-Owner, all-filter, cursor-context, live-DTO, and
  authenticated table-SELECT checks remain deferred for lack of an approved
  Owner JWT; no fixtures or users were created.
- Risk/operations: the regular index creation completed successfully. A
  pre-existing anonymous table-DML ACL remains outside WU1; RLS has no anon
  policies and WU1 did not alter that drift.
- Next authorized action and gate: obtain the approved Owner credential for the
  deferred runtime matrix, then resume representative low-end Android Unit 6F
  evidence. Unit 7 and legacy-caller cutover remain gated.

## Next action gate

Unit 5A supplies strict ISBN normalization, versioned provider-neutral
lookup/contracts, local-canonical-first planning, cache and identical-query reuse
identity, bounded routing primitives, metadata attempt/cost lineage, and immutable
selected-snapshot/manual-review persistence. M15 is live once. M16 removed six
direct mutation privileges inherited through Supabase defaults, and M17 removed
PostgreSQL 17 MAINTAIN from those three tables plus M14
`vision_provider_attempts`. Exact-project readback now proves
`service_role=r/postgres`, RLS, postgres ownership, client denial, and the 13
hardened RPC boundaries on all four tables.

Unit 5B is complete at the merged fixture/mock-verified level recorded in
[tracker 11](./trackers/11-unit5b-implementation-evidence.md). Matching, reuse,
and storage are independently enforced, and only `coherent_match` is a positive
reusable outcome. Unit 5B created or applied no migration; M09 remains absent.
Unit 5C-5/5C-6 backend is live-verified through M28 at approved tree
`66db5be740940a8c882bb7ea312817f4c33bb2db` and implementation commit
`4b667fc6674d606a8f88e2a4ee933d79bf332f53`; it is merged on `main`.
Unit 6A is merged and live-verified through M29. Unit 6B is merged at `9ef9eb3`,
Unit 6C is merged through `092562d`, and Unit 6D is implemented at `c363b60`.
Unit 6E is finalized at `8bceab260a953b4d832fd55f34f58db12fa009b1` with M30
live exactly once; evidence is in [tracker 23](./trackers/23-unit6e-review-corrections-evidence.md).
Phase 9 Unit 6F has browser/readback evidence but remains blocked on the native
gate recorded in tracker 24. WU1 is live once with readback complete, and WU2
has locally cut over the read-only Owner `/inventory` route; authenticated
runtime remains deferred. Do not start dashboard remediation, Unit 7, another
migration, or deployment without separate authority.
Keep M09 absent and do not commit inventory/listings, publish, add commerce, add
provider fallback, or create global alias authority.

### 2026-08-04 WU2 read-only Owner inventory client checkpoint

- Authorized scope: Owner `/inventory` read path only; canonical WU1 list RPC,
  strict DTO validation, exact filters/search, pagination, cache isolation,
  read-only states, tests, and continuity records.
- Completed path: `/inventory` → `InventoryFoundationScreens` →
  `OwnerInventoryReadScreen` → `useOwnerInventoryRead` →
  `phase9_owner_inventory_page_v1`. The route graph no longer reaches the
  legacy direct-table inventory service.
- Verification after correction-review closure: focused WU2 Jest 4 suites/50
  tests; related regressions 39 suites/303 tests; TypeScript passed
  with `--allowImportingTsExtensions`.
  Jest retained its known post-run open-handle warning and pre-existing
  CandidateReview `act(...)` warnings in the broad run.
- Mutations: no migration or Supabase/Storage row, Edge Function, provider,
  deployment, inventory/publication write, commit, push, or staging action.
- Gate: authenticated Owner runtime is deferred because no approved session
  was available. Dashboard remediation, stale-code deletion, Unit 6F native
  completion, and Unit 7 remain separately gated.
- Next authorized action: obtain an approved development Owner session for the
  deferred WU1/WU2 runtime matrix; then resume Unit 6F Android evidence.

### 2026-08-04 WU2 independent-review correction checkpoint

- Red-first reproduction: 3 suites failed with 8 failing assertions covering
  strict timestamp/version rejection, refresh row preservation, and truthful
  error/operation presentation.
- Corrected: offset-aware ISO timestamps and positive versions fail closed;
  refresh preserves loaded pages until a separate first-page request succeeds;
  invalid cursor still resets; invalid request, cursor, unavailable,
  internal/malformed response, refresh, and next-page recovery are distinct.
- Verification: focused 4 suites/45 tests, related 39 suites/298 tests, and
  TypeScript passed. Existing Jest lifecycle and CandidateReview `act(...)`
  warnings remain separately recorded.
- Scope: no database, Storage, deployment, dashboard, write path, Unit 7,
  staging, commit, or push action occurred. Authenticated runtime remains the
  next authorized gate; the P3 architecture-test hardening note is non-blocking.

### 2026-08-04 WU2 second correction-review checkpoint

- Review verdict: `changes_requested` for cached refresh data recommit,
  missing explicit scope-generation fence, unauthorized retry controls, and
  refresh-error/successful-empty overlap.
- Red evidence: 2 suites failed with 4 assertions; the stale identity removal
  diagnostic already passed through query cancellation but received an
  explicit independent generation fence.
- Corrected: refresh commits only explicit success from the current request
  generation/scope; cached failure preserves every loaded page; late identity,
  filter, unmount, or concurrent-refresh completion cannot write; unauthorized
  initial/partial states expose no retry; refresh errors suppress empty success.
- Verification: focused 4 suites/50 tests, related 39 suites/303 tests,
  TypeScript, continuity, and WU1/WU2/repository diff checks passed. Existing
  Jest lifecycle and CandidateReview warnings remain.
- Scope remains read-only with no database/external mutation, dashboard,
  Unit 7, staging, commit, or push. Authenticated Owner runtime remains deferred.

### 2026-08-04 WU2 focused correction-review closure

- Final finding: unauthorized initial/partial cards had no action, but the
  global header Refresh control remained reachable.
- Red/green evidence: two screen assertions failed before the correction;
  afterward the screen suite passed 15/15, focused WU2 passed 4 suites/50, and
  related regressions passed 39 suites/303.
- Correction: all screen-level refresh/retry controls are absent while the
  active error category is unauthorized; authorized states retain refresh.
- TypeScript and continuity/diff gates passed. No database, external, dashboard,
  Unit 7, staging, commit, or push action occurred.

### 2026-08-04 CAP-01/CAP-02 capture-to-Preview handoff correction

- Confirmed Preview cleanup was clearing the provider selection during a
  transient access-boundary/route lifecycle unmount; provider placement and
  media URI lifetime were sound.
- Removed only that implicit cleanup; explicit reselect, successful
  registration, cancellation, and unavailable-media recovery remain bounded.
- Real Expo Router/provider lifecycle regression passed after red-first
  reproduction; focused capture verification passed 9 suites/46 tests,
  TypeScript and diff hygiene passed, and `.pyc` count is 0.
- Browser web evidence passed with a sanitized local fixture through Preview,
  Back, reselect, Choose another image, and picker cancel. The existing
  start-session handoff created one disposable session
  (`97925897-56dd-47dc-bf33-24ae4fdf2f10`), left open because verification
  stopped at Preview; upload/register/process/save/close were not invoked.
  Native verification remains unclaimed.
- Next authorized action remains the existing WU1/WU2 authenticated runtime
  evidence, followed by representative low-end Android Unit 6F evidence.

### 2026-08-04 post-registration Preview flash correction

- The successful upload handoff now marks navigation intent and clears
  provider-held media only when Preview unmounts for the destination route,
  eliminating the queued-router unavailable-media flash. A post-invalidation
  generation/identity/authority guard preserves Back and identity cleanup.
- Red/green lifecycle, ordering, and stale-completion coverage passed; focused
  capture tests passed 9 suites/48, TypeScript and diff hygiene passed. This
  small correction has no database, upload, migration, deployment, commit,
  push, or staging mutation. Browser and native rerun for this
  post-registration timing fix remain unclaimed.

### 2026-08-05 Android 11 observation and browser follow-up

- The user reports Android 11, accessible large-text use, and a connected
  native camera. This is a user observation without a device model,
  font-scale/screen receipt, performance trace, or offline/reconnect evidence;
  it does not satisfy the representative native gate by itself.
- Browser follow-up covered the authenticated Owner read path, filters/search,
  review navigation, Resume scan, sanitized fixture upload, disposable Review
  Save, logout/re-authentication, and unavailable-session Retry with zero
  browser errors. The disposable session remained active with four images
  processing, so Close was not available on that session. Cross-store and
  inactive/non-Owner denial fixtures remain deferred.
- Large-text is recorded as a user-confirmed observation; dropdown UX is a
  later non-gating improvement. Unit 6F remains open under SDD §§24, 28, and
  34, and Unit 7 remains separately gated.
- Next authorized action: obtain the missing representative Android evidence
  required by the Unit 6 SDD, then rerun continuity/quality review before any
  Unit 6F closeout or Unit 7 authorization.

### 2026-08-05 15-card and Gemini fixture clarification

- The UI consumes decoded Owner candidate DTOs and does not call Gemini
  directly. The fifteen-candidate check is covered with deterministic
  `ownerUxTestFixtures.ts` data: fifteen ordered candidates plus an independent
  partial failure, and an over-fifteen safeguard.
- Focused verification passed **2 suites/20 tests** for
  `CandidateReviewScreens` and `CaptureProgressScreens`. This is a local
  fixture-backed UI/contract result, not live provider or native performance
  evidence.
- Unit 6F remains `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`. Pending closeout is
  representative Android evidence (including the fixture-backed fifteen-card
  run, sequential-capture memory, offline/reconnect, accessibility/large text,
  performance, and CAP/post-registration reruns), followed by the deferred
  WU1/WU2 runtime cases when approved cross-store/inactive-Owner/runtime
  fixtures exist. Unit 7 remains separately gated.

### 2026-08-05 Unit 4B Gemini configuration/startup deployment addendum

- Separately authorized scope: configure the dedicated Render vision worker for
  a temporary Gemini startup check. This did not change the active WU2 work unit
  or authorize mobile Gemini access, inventory/publication behavior, a migration,
  or a new database/Storage fixture.
- Render evidence: `phase9-fixture-vision` service
  `srv-d9jbsjf41pts73cejqag` is live at commit `7eaf921efcaefccab4d0189dc26779796f164ed4`,
  deployment `dep-d9pdei9t0dsc73ddgbh0`. The deployed logs emitted
  `service_started` for `phase9-vision-analysis-worker` and Render reported the
  service live. The prior deployment attempt failed because the Gemini key was
  present while fixture mode was still the default; the configuration was
  corrected before the live deployment.
- Render environment evidence: masked `PHASE9_GEMINI_API_KEY` is present;
  `PHASE9_VISION_ANALYZER_MODE=gemini`,
  `PHASE9_GEMINI_MODEL_ID=gemini-3.5-flash-lite`, and
  `PHASE9_GEMINI_TIMEOUT_MS=30000` are present; fixture-only
  `PHASE9_VISION_FIXTURE_CASE` is absent. The key value was never read or
  recorded by the agent.
- Verification boundary: startup/live deployment passed, but no authenticated
  `/run` request or real Gemini inference was performed. A real provider call
  still requires an approved disposable job with sanitized private media and
  must record M14 attempt/usage/cost evidence. No Supabase, Storage, migration,
  inventory, listing, publication, staging, commit, or push mutation occurred.
- Next authorized action: revoke the exposed temporary key and enter a fresh key
  directly in Render; only then run the separately approved controlled provider
  call and record the result.

### 2026-08-05 Gemini processing-path investigation

- Investigation scope: read-only follow-up after a sanitized image was uploaded
  through the local Owner capture flow. No code, database, Storage, Render,
  secret, deployment, worker invocation, provider call, commit, or push change
  was made in this investigation.
- Observed path: the upload completed registration and the session showed the
  image in a processing/checking state. The Owner upload path registers the
  media job but does not call the Render worker `/run` endpoint. The deployed
  vision worker has startup evidence, but no accepted/completed invocation for
  this upload was observed, and no Gemini inference or persisted candidate names
  were verified.
- Finding: the Gemini key/configuration is not itself a trigger. The observed
  evidence stopped at queued processing, but that observation alone did not
  establish the complete cause. Subsequent repository tracing also found the
  production vision-to-metadata job handoff, runnable metadata worker, and
  enriched-candidate readback unproven. No new follow-on product work unit is
  authorized; the current next action is the read-only vertical integration
  audit under existing Unit 4B/5A/5B authority.
- Verification boundary: no provider-attempt, usage/cost, or candidate output
  may be claimed from this investigation. The existing key-rotation and
  controlled-provider-call gate remains unchanged.
