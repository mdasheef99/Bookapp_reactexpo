# Phase 9 Master Tracker

**Planning status:** `unit7a_create_only_contract_frozen`
**Implementation status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`
**Unit 6 closure scope:** automatic/functional pipeline PASS; native Unit 6F validation debt deferred `NOT_RUN`/`UNRESOLVED`, not PASS
**Last updated:** 2026-08-12
**Current milestone:** Unit 7A M39 is live and post-apply verified with zero business effect; the one authorized Owner Edge deployment attempt failed before activation on an extensionless transitive import
**Active work unit:** `unit7a_owner_edge_import_resolution_correction_requires_separate_authorization`
**Environment:** Development application with a shared remote Supabase development project; this is not a production deployment and has no external production app consumers. The exact Supabase project is **`Bookconnect_reactexpo`** (project ref **`ahntbtktjjmvfosgkmgn`**, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`, `ap-southeast-2`). In this tracker, “live” means readback against that development project. “Legacy consumer” means a stale repository-internal screen/service path, not a deployed customer application that must remain backward-compatible.
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** exact-project M39 preflight, genuine PostgreSQL 17 independent-connection contention, one controlled M39 application, and immediate function/ACL/M05/zero-business-effect readback all passed. Detailed evidence is in [tracker 29](./trackers/29-unit7a-create-only-commit-evidence.md).
**Next authorized action:** none. Obtain separate authorization for a reviewed source-only correction to the extensionless `../contracts/registers` import in `domain/validation.ts`, then separately authorize one new deployment attempt. Live Add-to-Inventory/exact replay remains blocked and was not run.
**Migration note:** M29 is live once as `20260730162700 marketplace_phase9_owner_safe_contracts`; M30 is live exactly once as `20260801093048 marketplace_phase9_unit6e_review_corrections`; M31-M37 are live at their recorded versions; M38 is live exactly once as `20260810130638 marketplace_phase9_metadata_retry_correction`; reviewed M39 is live exactly once as `20260812003419 marketplace_phase9_create_only_inventory_commit` with no retry and zero migration-created business effects.
**Scope boundary:** This session implements only Unit 7A create-only commit, server-held reviewed quantity, one-to-one provenance, false-only skip semantics, private inventory, and the Unit 6 duplicate-contract transition. Unit 7B publication, Unit 7C editing, and every live/external action remain excluded.
**Implementation authority:** the owner's 2026-08-12 Unit 7A session authorized local tests, production code, one forward migration file, local/ephemeral database execution, and documentation. It did not authorize Supabase/Storage mutation, deployment, provider calls, inventory/listing/publication effects, or Git staging/commit/push.
**Migration creation/application authority:** M39 creation, preflight, real PostgreSQL contention proof, controlled application, and post-apply readback are complete. No further migration or database/data mutation is authorized; only the traced Unit 7A Owner Edge deployment is authorized before a separately gated live proof.
**Current gate:** `UNIT_6_AUTOMATIC_PIPELINE_PASS_NATIVE_VALIDATION_DEBT_DEFERRED`; M38 automatic proof passed media, vision/Gemini, metadata, and Owner-review handoff with no inventory/listing effects. Native camera/gallery parity, recovery/reconnect, 15-card representative-device performance, offline/reconnect, accessibility/large text, and low-end Android resource/performance remain `NOT_RUN`/`UNRESOLVED`, not PASS. Deployment and any fresh post-deployment Android proof remain separately gated; the secondary deployed-Edge `P9_SINGLE_IMAGE_LIMIT` mapping drift is unchanged.
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current Unit 7A implementation authority — 2026-08-12

The Owner has frozen a create-only commit model. Every explicit commit of an
eligible reviewed candidate creates exactly one new private inventory row from
the current server-held review; no duplicate lookup, merge, increment, manual
match, or “keep separate” branch exists in Unit 7A. The new row initializes
`total_quantity=available_quantity=q` and all other buckets to zero. Historical
Unit 6 duplicate controls are superseded for this path and must become
non-actionable/non-blocking before enablement. The normative authority is
[Unit 7A create-only inventory commit](./work-units/07a-create-only-inventory-commit-sdd.md).
The reviewed implementation and forward M39 migration are complete. M39 is
live exactly once as `20260812003419`; post-apply source/ACL/M05 and zero-
business-effect readback passed. Owner Edge deployment is the active authorized
gate; authenticated live mutation proof remains separate. M09/global historical quantity
strengthening is not a Unit 7A prerequisite.

## Current Unit 6 closure authority — 2026-08-12

The automatic/functional Unit 6 pipeline is **PASS**: M38 automatic proof
completed media, vision/Gemini, metadata, and Owner-review handoff, with no
inventory/listing effects. The detailed native Unit 6F evidence remains
deferred `NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery
physical-device parity, native recovery/reconnect, 15-card representative-device
performance, offline/reconnect, accessibility/large text, and low-end Android
resource/performance. The project owner accepts this deferred native-validation
risk and authorizes Unit 7 to begin. This current overlay supersedes older
Unit 6 sequencing statements that made the native debt a Unit 7 blocker; it
does not change Unit 6 SDD requirements or acceptance criteria, and Unit 7 has
not started in this documentation-only reconciliation.

> **Historical 2026-08-11 sequencing note (superseded):** **Next authorized action:** bounded independent review of the multilingual vision-response resilience correction; deployment requires separate authorization, followed by exactly one fresh Android image proof after deployment. Unit 7 remains unauthorized. That was the dated checkpoint; the current 2026-08-12 authority overlay above supersedes that sequencing decision.

## 2026-08-09 authorized web-proof stop

The actual Expo web application was started and the authenticated Owner path
was followed through Profile, Store Owner Console, and Inventory. Inventory
successfully loaded its read boundary and exposed `Resume scan` for an older
capture containing six processing images and one review item. Opening that
existing flow was read-only inspection; it was not used for this proof and no
image was added. Exact-project Supabase MCP baseline readback recorded four
sessions total (three active/closing), 18 inputs, 27 jobs (eight pending), 13
candidates, and zero metadata jobs, attempts, provider calls, lookups, or cache
entries. The shared queue cannot be attributed to a new image without touching
unrelated work. The process-only Google Books variable is also absent. The
proof therefore stopped before a fresh session/upload, as required by the
authorization. The browser is left at `/inventory` for handoff.

## Current handoff

The approved Phase 9 workflow requires validated vision output to pass through
local-canonical-first metadata enrichment before Owner review becomes
actionable. Repository evidence proves the component foundations but does not
yet prove the production handoffs or a complete upload-to-enriched-review run.
The read-only vertical integration audit and architecture freeze identified the
missing structural seam. Native Unit 6F and WU1/WU2 runtime evidence remain
open as deferred validation debt. Unit 7 remains not started but is
owner-authorized under the current closure authority above.

The 2026-08-07 authorized structural implementation closes that seam locally:
vision persistence and metadata-job creation share one PostgreSQL transaction;
the fenced worker context, provider-neutral runtime, immutable terminal outcome,
SAME-candidate transition, and Owner DTO are proven. M32 is not applied, no
provider was called, and the operational gates remain open.

The subsequent targeted correction pass closed the independent review findings
without changing the frozen architecture. M32 now owns canonical SQL/runtime
identity parity, strict vision-only enqueue provenance, cache-entry validation,
claim/candidate-version fences at every worker completion seam, stale physical
call rejection, and truthful degraded Owner state. Focused SQL/runtime tests are
green. Repository-wide TypeScript remains unverified because the root command
fails on existing `.ts` import-extension configuration, and bounded Owner React
Query suites timed out without assertions. Independent rereview is required
before any migration preflight or application decision. A final correction-only
implementation on 2026-08-07 added the validated-ISBN strategy invariant,
ISBN-10/13 local parity, physical-result recovery, storage-denial separation,
production coalescing lookup, malformed-result fail-closed handling, and full
M32 wrapper ACL enumeration. The final bounded correction adds authoritative
physical-finalization fencing, exact complete provider parsing, and a fenced
physical-call reconciliation RPC that preserves committed outcomes and records
unconfirmed egress as `outcome_unknown`. Focused Jest is 97/97, structural
worker/PGlite is 14/14, metadata foundation is 13/13, and vision/M32 PGlite is
40/40.

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
The Unit 6F evidence gate remains open because representative native evidence
was not run; the debt is preserved and is not marked PASS. Unit 7 sequencing is
owner-authorized under the current closure authority above.

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

### 2026-08-07 final bounded structural-metadata correction pass

- Completed only H1-H3 and E1-E3/F1. Physical finalization now revalidates the
  accepted vision lineage; provider outcomes require one exact complete,
  identity-coherent normalized edition; and failed/lost physical-finalization
  responses reconcile committed evidence or persist `outcome_unknown`.
- SQL-backed worker evidence proves known-retryable replay with one physical
  call, independently committed sibling success, invalid-ISBN bibliographic
  fallback, and zero positive retention under storage denial. E1-E3/F1 exposed
  no production defect and therefore changed tests only.
- Final current verification: focused identity/provider/gateway/composition/
  worker Jest 97/97; structural worker/PGlite 14/14; metadata foundation 13/13;
  vision/M32 40/40; metadata-worker TypeScript build passed. The continuity and
  final diff-hygiene results are recorded in tracker 02.
- All 14 public M32 worker wrappers deny PUBLIC/anon/authenticated and grant
  only `service_role`; the new reconciliation wrapper has fixed empty
  `search_path`, schema-qualified references, and server-derived lineage.
- No Supabase/Storage read or mutation, M32 application, provider call,
  deployment, scheduler, commerce effect, Unit 7 work, stage, commit, push, or
  merge occurred. M32 remains repository-only and unapplied.
- Next authorized action: independent approval rereview of the frozen bounded
  diff. Exact-project read-only preflight and M32 application remain separately
  gated.

### 2026-08-08 latest M32 narrow-correction closure

- H1 disposition is `RESOLVED_BY_PROOF`: the approved Owner review transition
  rejects a `processing` candidate and leaves its version unchanged. Physical
  work remains fenced by the authoritative claim attempt, worker, token, lease,
  candidate state, and accepted vision lineage, so M32 needs no candidate-version
  column or runtime parameter on the physical-call row.
- H2 is resolved by one shared `requiredIsoTimestamp` boundary used by vision,
  metadata edition/result, and automated-alias parsing. Direct regressions reject
  date-only, timezone-less, and malformed values and accept `Z` and explicit
  offsets.
- H3 direct regressions cover repeated identical reconciliation, registered-call
  survival across reclaim, idempotent reuse of a known finalized completion, and
  rejection of an old worker's post-reclaim overwrite without physical, logical,
  candidate, job, or snapshot mutation.
- Verification actually run: focused Jest 7 suites/97 tests; structural PGlite
  14/14; metadata foundation PGlite 13/13; vision/M32 PGlite 40/40. The
  metadata-worker TypeScript build, Phase 9 continuity validator, and repository
  diff hygiene passed.
- The oversized production gateway LOW is intentionally deferred: its stateful
  lookup, physical-call, and completion sequencing has no extraction boundary
  that avoids new callback/state indirection in this narrow pass.
- M32 remains repository-only and unapplied. No Supabase/Storage access,
  provider call, deployment, scheduler/dispatch, secondary-provider selection,
  inventory/publication effect, Unit 7 work, stage, commit, push, or merge
  occurred.

### 2026-08-08 independent narrow correction-only rereview

- A fresh context-isolated, read-only reviewer examined only the H1/H2/H3
  corrections and gateway-size disposition and returned `APPROVED`.
- The reviewer confirmed H1 is resolved by the existing authority proof, H2
  uses one strict shared timestamp boundary, H3 has direct reconciliation,
  reclaim, idempotency, and stale-worker regressions, and the gateway LOW is
  appropriately deferred for this correction pass.
- The reviewer made no edits and performed no external or Git mutation. M32
  remains repository-only and unapplied.
- Next authorized action: final approval rereview of the frozen narrow diff;
  exact-project preflight and M32 application remain separately gated.

### 2026-08-08 controlled live metadata proof — blocked before provider egress

- Authorized scope: exact-project preflight, minimum Google Books registry configuration,
  local metadata-worker readiness/auth/empty-queue smoke, and one fresh post-M32
  candidate only if the real worker/provider prerequisites were available. No
  historical candidate, manual metadata job, M33, scheduler, inventory, listing,
  publication, Unit 7, Git, or `docs/codemap/` action was authorized.
- Exact-project readback: `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` is
  `ACTIVE_HEALTHY`; M32 is live exactly once as
  `20260808020404 marketplace_phase9_structural_metadata_integration`. Six
  historical M32-eligible candidates remain untouched; metadata jobs remain zero.
- Live configuration mutation: inserted exactly one `google_books` / `metadata`
  registry row for adapter `1.0.0`, enabled/matching/storage allowed, 86,400-second
  revalidation, policy 1. Public display and image caching remain disabled.
- Blocker: the checked-out runtime has no `PHASE9_GOOGLE_BOOKS_API_KEY`, and its
  configured `SUPABASE_SERVICE_ROLE_KEY` resolves to a different Supabase host than
  the verified development project. The worker therefore could not safely connect
  to the target project in real-provider mode. No candidate, session, input, metadata
  job, lookup, attempt, physical provider call, snapshot, or Owner readback was created.
- Readback: metadata jobs/attempts/lookups/cache/snapshots/usage reservations/provider
  calls are all zero; inventory/listings are unchanged at 5/5; inventory media links,
  moderation flags, committed candidates, metadata schedulers, and Phase 9 scheduler
  rows are zero. The five existing cron jobs are unrelated club/notification/commerce
  jobs. Supabase also reports the pre-existing RLS-disabled advisor finding for
  `spatial_ref_sys`, `marketplace_event_schema_registry`, and
  `marketplace_notification_type_registry`; it was not changed.
- Verification actually run: exact-project Supabase MCP readback, provider-row
  readback, cron/function/trigger/ACL checks, metadata-worker TypeScript build PASS,
  `git diff --check` PASS, and the Phase 9 continuity validator PASS after the
  documentation and validator-status update.
- Next authorized action and gate: configure the exact target-project service
  credential and Google Books credential through the approved secret mechanism, then
  rerun the bounded proof. Do not create a candidate until that gate passes.

### 2026-08-08 Phase 0 credential inventory rerun - blocked before test data

- The source-defined real path requires `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PHASE9_GEMINI_API_KEY`,
  `PHASE9_GEMINI_MODEL_ID`, `PHASE9_GEMINI_TIMEOUT_MS`,
  `PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
  `PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. Gemini is the `google_gemini`
  adapter using configuration-driven `gemini-3.5-flash-lite`; Google Books is
  the `google_books` adapter version `1.0.0` and requires its API key in real
  mode.
- Credential inventory without secret values: the process has a Supabase URL
  and service-role value, but the URL host is
  `nxjnoqjxzkipeghhfxee.supabase.co`, not the approved
  `ahntbtktjjmvfosgkmgn.supabase.co`; all six `PHASE9_GEMINI_*`/real
  `PHASE9_GOOGLE_BOOKS_*` runtime names are absent. No approved environment
  file defines any of those Phase 9 names.
- Exact-project read-only MCP verification still identifies
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as `ACTIVE_HEALTHY`, with
  M32 exactly once and one existing approved Google Books registry row. Counts
  remain metadata jobs `0`, historical M32-eligible candidates `6`, inventory
  `5`, and listings `5`.
- The mandatory Phase 0 gate therefore stopped before vision/metadata worker
  startup, upload, Gemini egress, Google Books egress, candidate creation, or
  Owner readback. No remote mutation occurred in this rerun; the existing
  registry row was reused for readback only.
- Verdict for this credential-inventory run: `LIVE_METADATA_BLOCKED_MISSING_CREDENTIALS`.
  The Supabase target/credential mismatch is an additional `BLOCKER`.
- Next authorized action: configure the exact target-project service URL/key and
  all required real Gemini/Google Books variables through the approved secret
  mechanism, verify them without printing values, then rerun the same bounded
  one-candidate proof.
### 2026-08-09 authorized stale-state cleanup and Owner web proof stop

- The user authorized a development-only cleanup of stale Phase 9 processing
  state while preserving inventory, listings, stores/users, canonical books,
  and unrelated data. Nine remaining objects in `image-extraction-inputs` were
  removed. Three active/closing sessions were closed, 17 inputs were
  terminalized, eight pending media/vision jobs were cancelled, 13 stale
  uncommitted candidates were either deleted or expired at the immutable-audit
  boundary, 20 upload capabilities were removed, and 10 scoped media rows were
  marked deleted. Immutable vision evidence, append-only variant decisions,
  and their required audit rows were retained.
- Post-cleanup readback was `0` active/closing sessions, `0` stale pending
  media/vision jobs, and Owner Inventory displayed `Review books (0)`. No
  inventory, listing/publication, store/user, canonical-book, migration,
  scheduler, Unit 7, deployment, or Git publication effect occurred.
- The real Expo web Owner flow accepted
  `C:\Users\user\Pictures\Books\testimage.jpeg` and created fresh session
  `204b9115-cf8b-4344-a771-042fdfdfd9f1`, one uploaded input, and one open
  `media_validate_sanitize` job. The proof stopped there because the invoking
  process has neither `PHASE9_MEDIA_WORKER_URL` nor
  `PHASE9_MEDIA_WORKER_INGRESS_TOKEN`; vision and metadata invoker variables
  are also absent. No unauthenticated bypass or Render configuration change was
  attempted, and Gemini/Google Books were not called.
- Exact next authorized action: supply the existing worker URLs and matching
  ingress tokens process-locally, then resume by invoking only the fresh media
  job. A Google Books key must also be supplied process-locally before the
  metadata stage; the previously authorized key is no longer available.
- Follow-up evidence: Render readback located the existing
  `phase9-media-sanitation` service at
  `https://phase9-media-sanitation.onrender.com` and confirmed its existing
  `PHASE9_MEDIA_WORKER_INGRESS_TOKEN` configuration without exposing the value.
  The token and URL were passed only to the existing invoker process. The
  bounded invocation returned HTTP 200, claimed one job, and reported `queued`.
  Database readback shows the media job `resolved` after one attempt, the input
  `queued` with media/sha256 lineage present, and one fresh `vision_extract` job
  `open`; unrelated pending media jobs remain zero.
- Vision follow-up located the existing `phase9-fixture-vision` Render service
  and used its existing ingress token process-locally without printing or
  persisting it. Exact isolation was one fresh open vision job, zero unrelated
  open vision jobs, and zero pre-existing fresh candidates. Two bounded claims
  both returned HTTP 200 / `retry_scheduled`; the job is at attempt 2 of 5 with
  safe error `P9_VISION_ANALYZER_UNAVAILABLE`. No provider-attempt or usage row
  exists, proving Gemini egress did not occur.
- Live function readback identifies the integration defect: applied
  `marketplace_sec.phase9_complete_media_validation` creates `vision_extract`
  but does not create a `phase9_usage_reservations` row, while applied
  `marketplace_sec.phase9_register_vision_provider_attempt` requires that row.
  The proof stopped rather than exhaust retries or fabricate the missing
  reservation. Owner UI displays `Image 1 · Trying again`, `Books found: 0`.
  Exact next authorized action: implement and apply the forward-only reservation
  creation correction with focused media-to-vision tests, then resume this same
  job/session. This requires separate migration authority.

### 2026-08-09 local M33 vision-reservation correction

- Authorized local scope completed: red tests preceded
  `20260809000033_marketplace_phase9_vision_reservation_correction.sql`.
  M33 adds one postgres-private reservation helper, replaces only the
  service-only media finalizer, and creates or validates the policy-1 vision
  reservation before the media job can resolve.
- The guarded data repair selects only structurally valid, unleased
  `open|retry_scheduled` vision jobs with approved linked WebP media and no
  reservation. It excludes terminal history, uses no generated job IDs, and
  preserves attempt/error lineage; the live preflight found exactly one such
  vision job, the fresh proof job at attempt `2/5`.
- Regression evidence: M33 static 3/3; M33 integration 5/5 including full-M32
  application compatibility, private-helper ACLs, M14 registration, conflict
  rollback, and terminal exclusion; combined ingestion/vision/provider/M33
  PGlite 61/61. The pre-existing M14 fixture digest was corrected from a fake
  two-MD5 construction to the harness's authoritative SHA-256.
- M33 was not applied. No Supabase/Storage/provider/worker/UI/product mutation,
  duplicate-input cleanup, stage, commit, push, deployment, scheduler, Unit 7,
  inventory, listing, or publication action occurred.
- Exact next authorized action: independently review the M33 local diff and
  evidence, then separately authorize exact-project application/readback.
  After a successful apply, cancel the duplicate open media input through the
  existing lifecycle boundary and invoke only the original fresh vision job.

### 2026-08-09 M33 required-review corrections

- The independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS`: the repair
  admitted malformed nonterminal history on closed sessions or media owned by a
  different same-store initiator, and the shared migration harness skipped M31
  while claiming a complete M32 tail.
- Red-first regressions failed on both findings. M33 now requires an active
  session and `media_assets.uploaded_by = image_extraction_sessions.created_by`
  in both helper and repair. Tests directly exclude closed-session,
  wrong-initiator, terminal, and duplicate media-job fixtures while preserving
  attempt count, next-attempt time, and safe error history.
- `databaseHarness.mjs` now orders M31 before M32/M33. Final verification:
  M33 static 3/3, focused static 39/39, M33 integration 5/5, combined focused
  PGlite 61/61, and database foundation/catalog 17/17.
- No Supabase/Storage/provider/worker/deployment, migration application,
  duplicate-input cleanup, inventory/publication, scheduler, Unit 7, stage,
  commit, or push action occurred. M33 remains local-only and unapplied.
- Exact next authorized action: independent correction-only rereview, followed
  by separately authorized exact-project application/readback.

### 2026-08-09 compact Gemini multilingual/language-hint correction

- Gemini output is reduced to compact visual identity plus optional compact
  multilingual enrichment, with no more than five authors. BookConnect attaches
  provenance and maps usable variants to the existing M18/M19 contract.
- Enrichment is non-fatal and author ordinals are unique within the actual
  returned author list. Original-script text remains canonical; Romanization and
  optional English title translation remain separate proposals.
- Selected session language is now a hint in TypeScript and local forward M34.
  Current-tree PGlite through M32/M33/M34 passed 59/59 and proves unchanged M32
  metadata-job creation for a differently detected valid book.
- Focused target Jest 46 tests and vision-worker TypeScript passed. No provider,
  Render, job, Supabase, inventory/publication, stage, commit, or push action
  occurred. M34 remains local and unapplied.
- Exact next action: independent review of [tracker 27](./trackers/27-compact-gemini-multilingual-language-hint-evidence.md); provider-only proof, deployment, M34 application, and attempt 5 remain gated.

### 2026-08-09 compact Gemini required diagnostics correction

- The independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS` because
  bounded provider request IDs and error codes were shape-checked but not
  compared with the worker's configured privileged values.
- Red-first evidence failed one analyzer assertion with 21 existing assertions
  green and one egress assertion with 5 existing assertions green: configured
  secrets appeared in failure-log identifiers and successful attempt persistence.
- The sanitizer now receives the existing privileged-value list and nulls a
- bounded provider request ID or error code containing a configured secret in
  both failure diagnostics and successful attempt finalization.
  Safe status, category, request ID, and error-code diagnostics remain available.
- Final verification: analyzer Jest 22/22; complete focused correction Jest
  47/47; vision-worker TypeScript build passed.
- No Supabase, provider, Render, worker/job, migration application,
  inventory/publication, stage, commit, or push action occurred. M34 remains
  local and unapplied; the preserved attempt-5 action was not invoked.
- Exact next authorized action: independent correction-only rereview of the
  compact Gemini/M34 scope and this diagnostics fix.

### 2026-08-09 corrected-production provider-proof stop

- Exact source: reviewed commit `dc19107ef9fc1252f85626614147de2562f15559`
  at local `HEAD`; branch is one commit ahead of upstream and was not pushed.
- Exact-project read-only preflight reconfirmed `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` as `ACTIVE_HEALTHY`. M31, M32, and M33 are recorded in
  order, with M33 exactly once as `20260809023834`; M34 is absent and unapplied.
- The replacement Gemini key was merged into only the existing Render vision
  service. Render does not offer save-only behavior through the update path and
  automatically restarted once. Deploy `dep-d9s3mtqjobas73ehntdg` became live
  at the prior source SHA `83cf61ae93b263d6a31a5cda67da2be91cdb97fb`.
- The production sanitizer regenerated the existing 1600x1600 WebP byte-for-byte
  at SHA-256 `5a9c18ea392cb63bbf3c2e58a9d91482bca4e9e8f32b576063cba5a0d5c41e39`.
  The exact committed full prompt/schema/decoder request used the configured
  `gemini-3.5-flash-lite` model and failed before decode with HTTP 400,
  `INVALID_ARGUMENT`, and safe provider category `malformed_request`.
- Bounded isolation kept the same key, model, image, prompt, and request shape.
  Omitting only the optional `multilingual_search_enrichment` schema subtree
  returned HTTP 200. Replacing nullable `anyOf` nodes with documented type-array
  nullability left the full schema at HTTP 400. The concrete failing component
  is therefore the multilingual response-schema subtree/combined nesting
  complexity, not the image, core `vision` schema, prompt, model, or null form.
- Stop-rule effects: no Supabase job claim/mutation, M34 application, Git push,
  corrected deployment, attempt-5 invocation, candidate/metadata work, Owner UI
  continuation, inventory/publication, scheduler, or Unit 7 action occurred.
- Exact next authorized action: make the smallest compatibility correction to
  the multilingual provider response schema and rerun this same provider-only
  request. Do not resume M34/deploy/job execution until the full request decodes.

### 2026-08-09 flattened observation correction

- The user replaced the separate multilingual provider subtree with one flat
  observation contract: original identity plus nullable title Romanization,
  nullable English title translation, and positionally aligned nullable author
  Romanizations. BookConnect derives script/provenance/source-field identities
  and maps usable values into the unchanged M18/M19 envelope server-side.
- Red-first evidence: the two focused suites failed 10 assertions against the
  old decoder before production changes. Final focused analyzer, egress,
  variant-runtime, vision-policy, and deployment-runtime Jest is 59/59; the
  vision-worker TypeScript build passes.
- The exact provider-only rerun was not executed because the external-action
  boundary requires explicit approval to send the sanitized contents of
  `C:\Users\user\Pictures\Books\testimage.jpeg` to Google Gemini. One such
  request was approved and attempted with the flattened production
  schema/decoder/mapper. Gemini returned HTTP 400; the safe category was
  `malformed_request` with message `provider rejected the request shape` and no
  safe provider error code or request ID. The analyzer mapped this to
  `P9_VISION_ANALYZER_UNAVAILABLE` before production decode.
  No workaround was attempted. M34, Git, Render, Supabase, jobs, metadata,
  Owner UI, inventory/publication, scheduler, and Unit 7 remain untouched.
- That approved retry is exhausted. Exact next authorized action: obtain fresh
  approval only if another sanitized-image probe is needed to isolate the schema
  component; downstream execution remains blocked until HTTP 200 plus decode.

### 2026-08-09 schema-free JSON-mode correction and proof

- Red-first: the focused analyzer test failed because the production request still
  contained `responseJsonSchema`.
- Completed: removed the provider-side response schema entirely. Gemini now
  receives only JSON MIME mode, the sanitized WebP, and the compact flat prompt;
  the existing BookConnect decoder remains the authoritative validation boundary.
- Verification: exact-path focused Jest 59/59 and vision-worker TypeScript PASS.
  A broader Jest invocation also discovered the unrelated `.wt/g3` worktree and
  reported one failure from that worktree's different deployment state; the five
  authoritative root paths are green.
- Approved provider result: Gemini accepted the request and returned JSON. There
  was no HTTP 400/provider-shape rejection. Production decoding then returned
  `P9_VISION_SCHEMA_INVALID`, proving the remaining blocker is local response
  normalization, not provider request compatibility.
- No Supabase, Storage, job, Render, Git, metadata, Owner UI,
  inventory/publication, scheduler, or Unit 7 mutation occurred. The temporary
  proof script was removed.
- Next gate: one explicitly approved bounded retry that captures the returned JSON
  without secrets, followed by only the decoder normalization supported by that
  evidence. Downstream execution remains blocked until production decode passes.

### 2026-08-09 bounded JSON capture and decoder normalization

- The approved bounded capture reached Gemini and returned the simple `vision`
  object with eight observations. The exact decoder mismatches were
  `image_outcome: "success"` and one unreadable observation with
  `detected_language: null`; all other requested flat fields were present.
- Red-first analyzer Jest reproduced `P9_VISION_SCHEMA_INVALID`. Production now
  normalizes only `success` to canonical `analyzed` and null detected language to
  canonical `und`, then applies the unchanged strict decoder and M18/M19 mapper.
- Verification: exact-path focused Jest 60/60; vision-worker TypeScript PASS.
- A final real-image proof was not run: the approval boundary rejected the
  additional image transmission as separate from the capture call. No workaround
  was attempted. The temporary capture script was removed.
- No Supabase, Storage, job, Render, Git, metadata, Owner UI,
  inventory/publication, scheduler, or Unit 7 mutation occurred.
- Next gate: explicit approval for one final sanitized-image provider request;
  downstream execution remains blocked until production decode succeeds.
### 2026-08-10 — preserved real-image pipeline and Owner UI proof

- Exact project: `ahntbtktjjmvfosgkmgn`; M34 applied once as live version
  `20260809182407 marketplace_phase9_vision_language_hint_correction`.
- Vision: preserved job `8bf664bb-5afa-41f7-ad2c-d86d9b2de2e8` resolved at
  attempt 5 with `accepted_with_language_skips`; input is `ready`, result
  `eafc9bf3-5373-4ec4-bd7b-d6dfa9b3b017` contains 8 observations and produced
  7 candidates. The eighth observation was retained as an unknown-language
  non-candidate.
- Metadata: the seven resulting M32 jobs were claimed once and resolved to
  `P9_METADATA_NO_MATCH`, placing every candidate in `needs_review`. The
  previously supplied Google Books key is present and valid (HTTP 200). Root
  cause was the adapter's `projection=lite`, whose live response omits required
  `language`; `projection=full` decodes live results (8/10 for the bounded Black
  Swan check). Correction commit `e4f2b34` is pushed on
  `codex/phase9-gemini-json-deploy`; focused Jest 26/26 and metadata-worker
  TypeScript build pass.
- Owner UI: Profile -> Store Owner Console -> Inventory reports
  `2 images · 7 need attention`; `/inventory/reviews` renders all seven books;
  the Black Swan detail preserves original title, author, and `en`, exposes the
  manual-details fallback, and defaults to Save private.
- Integrity/scope: immutable terminal metadata snapshots were not bypassed,
  deleted, or overwritten. No review save, inventory/listing/publication,
  scheduler, commerce, or Unit 7 action occurred. No additional Render deploy
  followed the user's no-deploy instruction.
- Exact next authorized action: Owner manual review of these seven candidates
  only. Any automatic replay of terminal metadata evidence requires a separately
  designed and authorized recovery path; do not enter Unit 7 or publication.

### 2026-08-10 — remove uploaded image local implementation boundary

- User-authorized scope is limited to an Owner-controlled Remove image action;
  automatic dispatch, Unit 7, and publication remain out of scope.
- Red-first mobile and Edge coverage now defines a strict `remove_scan_input`
  command using session/input identity, expected input version, idempotency key,
  and command ID. The canonical response is an input transitioned to `skipped`
  with updated input/session/presentation versions.
- Implemented locally: confirmation UI, identity-fenced mutation/cache refresh,
  strict mobile/Edge request and response contracts, service adapter, and exact
  `phase9_remove_scan_input_v1` RPC routing. Focused Jest is 187/187 green and
  TypeScript passes with the repository's Deno import-path option enabled.
- In-app Browser proof on session `f1fc2f59-2cec-4666-a9ee-86ff62723ca4`
  confirmed both image cards expose Remove image and Image 2 opens the bounded
  confirmation. The confirmation was cancelled; no removal request was sent.
- No database/storage mutation, migration creation/application, Edge deployment,
  worker invocation, Git stage/commit/push, or live image removal occurred.
- Exact next authorized action: obtain explicit permission to create one forward
  migration file implementing `phase9_remove_scan_input_v1` plus database tests.
  Creating the file does not authorize applying it to Supabase.

### 2026-08-10 — one-current-image correction and safe removal M35

- User product decision: retain **Remove image**, remove append-style **Add
  another image**, and offer one replacement only after the current image is
  removed. This supersedes only the multiple-image portion of P9-D04.
- Client boundary: Preview refuses a second authorization when a current input
  exists. Progress retains Remove image only when `acceptedCandidateCount=0`,
  hides append UI, and exposes Choose replacement image only when no current
  input remains.
- Database boundary: local forward M35 adds the authenticated, server-derived,
  versioned `phase9_remove_scan_input_v1`; both upload issuance and completion
  enforce one current input. Removal rejects any candidate lineage, cancels only
  exact media/vision jobs, marks the input `skipped/P9_OWNER_REMOVED`, preserves
  historical session counts, and schedules hold-aware cleanup without deleting
  Storage objects, candidates, inventory, or listings.
- Verification: M35 structural Jest 6/6; isolated PGlite migration/behavior 3/3,
  including legacy two-capability state, replacement after removal, and atomic
  rollback when a candidate exists; capture preview 18/18; progress/remove 9/9;
  cache identity 2/2; service/Edge regressions 186/186; repository TypeScript
  PASS; Phase 9 continuity PASS with 195 definitions, zero duplicate/missing
  traceability, 68 Markdown files, 53 required files, and diff check PASS.
- Read-only in-app Browser verification on the legacy live session showed three
  existing processing image cards, each retaining Remove image, with no Add
  another image control. Image 1 opened the updated exact-input cancellation and
  cleanup confirmation; Cancel was pressed and no removal request was sent.
- External state: Supabase project and M34 tail were read-only reverified. M35
  was not applied; no Edge deploy, live removal, Storage write/delete, worker
  call, Git stage/commit/push, inventory, listing, publication, or Unit 7 action.
- Exact next authorized action: review M35 and explicitly authorize its
  exact-project application. Edge deployment and live removal remain separately
  authorized actions.

### 2026-08-10 — automatic worker wake dispatcher local review package

- Local M36, dispatcher/runtime tests, metadata deployment preparation, and
  required continuity records are implemented but unapplied.
- Red-first and full regression evidence: focused pre-correction Jest 22/22,
  dispatcher PGlite 24/24, Phase 9 Jest 693/693, Phase 9 PGlite 236/236 before
  review corrections, and all
  three worker build/entrypoint smokes passed.
- Independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS`; all findings
  were corrected with due-stage isolation for media/vision/metadata, two-row
  single-wake proof, measured timeout justification, scaled delayed `/run`
  coverage, and accurate composed idempotency evidence. Corrected focused gates
  pass at Jest 23/23 and dispatcher PGlite 28/28; corrected full gates pass at
  Phase 9 Jest 694/694 and Phase 9 PGlite 240/240.
- Continuity passes with 195 requirement definitions, zero duplicate/missing
  mappings, 69 Markdown files, and 53 required files. Repository diff check
  passes and generated `.pyc` count is 0.
- No live/external mutation occurred. M36 is unapplied, live migration tail is
  M35, the existing claimable media job is untouched, and live Phase 9
  Cron/Vault/metadata-service state is unchanged.
- Rollout conclusion: the deployed media and vision services remain ordinary
  authenticated `/run`-compatible with the optional dispatch-ID header, but
  predate dispatch-ID receipt logging. Redeploy both before final live
  correlation proof; this is observability-only and requires no claim-RPC or
  provider behavior redesign. Metadata service creation remains separate.
- Exact next authorized action: review and explicitly authorize or reject a
  separate deployment/external-mutation unit. Application, secrets, service
  deployment/redeployment, cron activation, live worker proof, live image
  removal, duplicate replay, Unit 7, inventory/publication, stage, commit, and
  push remain prohibited.

### 2026-08-10 — metadata retry/provider-attempt correction

- Exact-project read-only verification confirmed M32-M37 live exactly once,
  with M37 as the migration tail. Applied migrations remain immutable.
- Red-first SQL-backed evidence reproduced the defect: after Google Books
  returned a retryable result, the next job claim replayed that finalized
  physical call and advanced toward dead-letter without fresh provider egress.
- Local forward M38 exposes the selected physical call's originating claim
  attempt through service-only metadata context v2. Retryable finalized evidence
  is reused only within the same claim; a later claim registers a fresh physical
  call. Terminal and non-retryable reconciliation remains replay-safe.
- Exact Google Books HTTP 503-to-200 evidence proves two fetches, physical-call
  claim attempts `[1, 2]`, `attempt_count=2`, one resolved ready snapshot, and no
  dead-letter or attempts-exhausted event. Same-claim and later second/third
  claim guards are covered separately.
- Verification: focused metadata Jest 148/148; structural metadata PGlite 14/14;
  full Phase 9 PGlite 242/242; metadata build, entrypoint smoke, deployment
  runtime validation, continuity, diff hygiene, secret/artifact hygiene, and
  generated `.pyc` checks pass. Independent correction-only verdict: `APPROVED`.
- External effects: none. M38 was not applied; no deployment, provider/job
  invocation, retry/requeue, Vault/Cron, Storage, media, vision, query-policy,
  duplicate-replay, Unit 7, inventory, listing, or product-publication state
  changed.
- Git publication: correction commit `8c55fea` was pushed to
  `origin/codex/phase9-metadata-retry-correction`; `docs/codemap/` remained
  untracked and untouched.
- Exact next authorized action: open a separately authorized operational session
  if M38 application and metadata-only redeployment are desired. Neither is
  authorized by this closeout.

### 2026-08-10 — M38 rollout and final Unit 6 proof

- Publication: `origin/main` was fast-forwarded without force or conflict from
  `211217b` to exact approved SHA `a138baa7d3bbc086da019bc052a5ae31d0e15882`.
- Database: exact project `ahntbtktjjmvfosgkmgn` was healthy; preflight found
  M32-M37 exactly once, M38 absent, the dispatcher active, zero claimable work,
  zero active metadata leases, and baseline counts of 6 sessions, 26 inputs,
  57 jobs, 25 candidates, 5 inventory rows, and 5 listings. Exact M38 was then
  applied once as `20260810130638 marketplace_phase9_metadata_retry_correction`.
  Post-apply readback proved fixed empty `search_path`, postgres ownership,
  service-role-only execution, active dispatcher, zero created/claimed jobs,
  and unchanged row counts.
- Deployment: only `phase9-metadata-worker` was deployed, exactly once, as
  Render deploy `dep-d9ssq2v10e5c73ahp18g` from the approved SHA. Health and
  readiness returned 200 and auto-deploy remained off. Media and vision were
  not redeployed.
- Final proof: after closing the prior terminal Owner session through its normal
  non-committing UI, one SHA-new 3,269,293-byte PNG was uploaded through the
  authenticated Owner UI into session `1bd67cb3-3cc4-4b0e-8b6b-11e9fff9d64a`.
  Automatic media and vision/Gemini each resolved on claim 1; six observations,
  six candidates, and six metadata jobs were created. All six metadata jobs
  resolved automatically on claim 1: five physical Google Books calls and one
  safe cache completion, with two coherent matches and three safe ambiguous
  provider outcomes. No retryable provider result occurred naturally.
- Owner result: the real session screen showed one processed image, six books,
  `Continue to book review`, and six `Needs attention` cards. No candidate was
  opened, reviewed, committed, or published.
- Non-interference: final inventory/listing counts remained 5/5; the historical
  metadata dead-letter job `206ffc83-de84-4cbf-835a-a2d3fb56eb79` retained its
  pre-session `2026-08-10T11:33:01.16159Z` terminal timestamp. Manual `/run`,
  manual claims, SQL repair/reset, operator retries, duplicate replay, media or
  vision redeploy, and Unit 7 actions were all zero.
- Closure verdict: `PASS`. Unit 6 is complete. The prior representative low-end
  Android evidence was not rerun; the user's explicit final-proof acceptance
  instruction makes this successful bounded live proof the Unit 6 closure gate.
- Exact next authorized action: none. Any Unit 7 work requires a new explicit
  authorization and a new bounded session.

### 2026-08-11 — multilingual vision-response resilience correction

- User-supplied physical evidence: native FileSystem signed upload succeeded,
  exactly one Storage object and input were created, sanitation completed, and
  vision job `20734f70-dd4c-4f68-87d5-aa837cb32b7d` failed terminally as
  `P9_VISION_SCHEMA_INVALID`. Removed input
  `a1c8e286-07f2-40c5-9bbd-2fed49c5148d` remains `skipped/P9_OWNER_REMOVED`.
- Red-first implementation: 16-100 reported observations become complete-image
  `too_many_books`; values beyond 100 fail; bounded unknown human language
  labels become `und` without modifying Unicode title/authors; optional
  enrichment remains independently rejectable; schema logs contain only a
  sanitized code-owned path and closed category.
- Strictness retained: unknown top/vision/in-cap observation keys, active core
  content, non-string languages, invalid identity, malformed ordinals, and raw
  payload overflow fail closed. No observation truncation or malformed-core
  salvage occurs.
- Verification: red suite failed 5/21 before production changes; final
  resilience 21/21; analyzer/captured payload plus resilience 46/46; focused
  worker/extraction/multilingual/security/Unit 6 polling 120/120; Image Inventory
  39 suites and 294/294; repository TypeScript with the documented import flag
  and vision-worker build pass. The unflagged TypeScript command produced only
  the repository's known TS5097 import-extension configuration errors.
- External effects in this correction session: none. No migration, database or
  Storage write, deployment, live provider call, removed-input retry, inventory,
  listing, publication, Unit 7, stage, commit, push, or PR action occurred.
- Exact next action: bounded independent review; after approval, separately
  authorize deployment, then exactly one fresh Android image proof.

### 2026-08-12 — Unit 7A create-only planning reconciliation

- Frozen behavior: each explicitly committed eligible reviewed candidate creates
  exactly one new private inventory row from the current server-held review.
- Removed from the Unit 7A contract: duplicate lookup/advice/action, target-row
  selection, merge, existing-row increment, manual match, and keep-separate.
- Quantity: the reviewed `q >= 1` initializes total/available to `q` and
  reserved/sold/removed to zero. Unit 7C owns later quantity changes; M09/global
  historical validation is not a Unit 7A prerequisite.
- Unit 6 transition: historical duplicate UI/DTO requirements are superseded
  for Unit 7A and must be non-actionable/non-blocking before enablement.
- Migration verdict: a forward create-only command migration is required; the
  existing applied M05 command is not safe to connect. No migration was created
  or applied.
- Effects and verification: documentation changes only; no Unit 7A tests were
  created or executed, and no production code, database/Storage, deployment,
  provider, inventory, listing, publication, stage, commit, push, or PR action
  occurred. Exact next gate: separately authorize the load-bearing red tests.

### 2026-08-12 — Unit 7A create-only local implementation

- Authorized work unit and scope: local Unit 7A red-first database/Edge/mobile
  implementation, forward migration-file creation, ephemeral database tests,
  verification, and required documentation. Live migration application,
  deployment, Supabase/Storage writes, Unit 7B/7C, and Git publication were
  excluded.
- Completed: new authenticated create-only command, server-held review and
  metadata authority, candidate/review/metadata revision fences, exact replay,
  changed-replay and concurrency protection, one-to-one provenance, private
  inventory-only creation, duplicate non-interference, strict Edge/mobile
  contracts, online-only non-optimistic UI action, ambiguous retry, and exact
  cache invalidation. The legacy M05 callable is retained but its execute grant
  is revoked for all API/service roles.
- Files/components/migrations: local M39
  `20260812000039_marketplace_phase9_create_only_inventory_commit.sql`, the
  Unit 7A PGlite fixture/suite, Owner ingestion contracts/runtime tests, mobile
  candidate contracts/service/query/form/screens/tests, and
  [tracker 29](./trackers/29-unit7a-create-only-commit-evidence.md). The frozen
  Unit 7A SDD was not edited.
- Verification actually run: clean red baseline 13/13 failed before M39; final
  Unit 7A PGlite 13/13 passed; Phase 9 Edge/mobile/migration regression 42
  suites and 479/479 tests passed; TypeScript with the repository's documented
  `--allowImportingTsExtensions` flag passed. Final continuity and diff/security
  hygiene are recorded in tracker 29 after closeout execution.
- Supabase/external mutations: none. Fresh read-only preflight verified
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` healthy with live history
  ending at M38. M39 was run only in the repository's ephemeral PGlite harness
  and remains unapplied. No Storage, queue, provider, inventory, listing,
  publication, deployment, stage, commit, push, or PR action occurred.
- Decisions/deviations/risks: no SDD conflict or behavior deviation found.
  Unit 6F native debt remains unchanged. Live ACL/function readback and an
  authenticated Owner smoke remain operational gates after any future approved
  M39 application/Edge deployment.
- Tracker/source-doc updates: ACTIVE, DOC-13, Phase 9 stable handoff, README,
  SESSION-START, master/implementation trackers, migration ledger,
  current-vs-target audit, data dictionary, traceability, and tracker 29.
- Next authorized action and gate: review the complete local Unit 7A diff. M39
  application, Edge deployment, authenticated live smoke, staging, commit, and
  push require separate explicit authorization.
