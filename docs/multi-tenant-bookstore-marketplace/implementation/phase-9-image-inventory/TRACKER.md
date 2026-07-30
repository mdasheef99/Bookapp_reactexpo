# Phase 9 Master Tracker

**Planning status:** `unit6_owner_ux_approved_design_authority`
**Implementation status:** `unit6c_locally_complete_merge_pending`
**Last updated:** 2026-07-31
**Current milestone:** Unit 6 Owner Capture, Review, and Recovery UX implementation routing
**Active work unit:** `unit6c_closeout_unit6d_separately_gated`
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** Unit 6C capture, preview, progress, upload/registration retry, and recovery UX at implementation commit `b87469d`; evidence is [tracker 21](./trackers/21-unit6c-capture-upload-recovery-evidence.md)
**Next authorized action:** complete the bounded Unit 6C evidence commit and authorized fast-forward merge; Unit 6D then requires separate authorization
**Migration note:** M29 is live once as `20260730162700 marketplace_phase9_owner_safe_contracts`; authenticated Owner RPC smoke passed and mutable/operational residue is zero
**Scope boundary:** Phase 9 Unit 6C closeout only; Unit 6D is separately gated, and Units 6E-6F and Unit 7 remain gated
**Implementation authority:** Unit 6C closeout only under the approved [Unit 6 SDD](./work-units/06-owner-capture-review-recovery-ux-sdd.md) and [contract matrix](./work-units/06-owner-capture-review-recovery-contract-matrix.md); no later unit is authorized by this handoff
**Migration creation/application authority:** M18-M28 are immutable live history and M29 is live once as `20260730162700`; no further migration is authorized by this closeout
**Current gate:** bounded Unit 6C evidence commit and fast-forward merge only; no migration, deployment, Unit 6D-6F, or Unit 7 work is authorized
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

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
feature commit `9ef9eb3`. Unit 6C is locally complete at implementation commit
`b87469d`: Owner Start/Resume discovery, explicit capture setup, camera/gallery
intake, preview, cancellable signed transport, byte-versus-registration retry,
progress polling, recovery, terminal handoff, and identity cleanup are covered
by strict adapters and deterministic tests. Unit 6D requires separate
authorization; Units 6E-6F and Unit 7 remain separately gated.

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
| Unit 6 Owner UX design authority | [`unit6c_locally_complete`](./work-units/06-owner-capture-review-recovery-ux-sdd.md); [contract matrix](./work-units/06-owner-capture-review-recovery-contract-matrix.md); [Unit 6A evidence](./trackers/19-unit6a-owner-safe-backend-evidence.md); [Unit 6B evidence](./trackers/20-unit6b-route-query-cache-evidence.md); [Unit 6C evidence](./trackers/21-unit6c-capture-upload-recovery-evidence.md); Unit 6D separately gated; split 6A-6F |
| Provider and scale architecture SDD reconciliation | `stale_marker_superseded_by_unit4b_m14_m17_unit5a_review_evidence_2026-07-28` |

## Blocking gate before further implementation

WU0A, WU0B, Package 1, Unit 4, Unit 4A, Unit 4B, Unit 5A, Unit 5B, and Unit
5C-1 through Unit 5C-6 backend are complete at their recorded levels.
M01-M08/M10-M28, the Owner ingestion boundary, and both separate fixture
workers are live-verified; M09 remains absent. Unit 5C-4 is merged at
`d092f08`; Unit 5C-5/5C-6 and Unit 6A are merged on `main`. Unit 6B is merged
at `9ef9eb3`; Unit 6C is locally complete at `b87469d`. Unit 6D requires
separate authorization. Customer display changes,
customer display changes, inventory/publication, commerce, provider fallback,
and global alias authority remain separately gated.

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
Unit 6A is merged and live-verified through M29. Unit 6B is merged at feature
commit `9ef9eb3`. Unit 6C is locally complete at implementation commit
`b87469d` with evidence in
[tracker 21](./trackers/21-unit6c-capture-upload-recovery-evidence.md). Complete
the authorized evidence commit and fast-forward merge. Phase 9 Unit 6D then
requires separate authorization. Do not start Units 6D-6F or Unit 7, and do
not create/apply a migration or deploy without
the separate authority required by AGENTS.md. Keep M09 absent and do not commit
inventory/listings, publish, add commerce, add provider fallback, or create
global alias authority.
