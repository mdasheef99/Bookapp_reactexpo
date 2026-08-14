# Phase 9 Implementation and Verification Tracker
**Status:** `unit7c_wu3_store_view_management_locally_complete`; **last updated:** 2026-08-14
**Unit 6 closure scope:** automatic/functional pipeline PASS; native Unit 6F validation debt deferred `NOT_RUN`/`UNRESOLVED`, not PASS.
**Active work unit:** `unit7c_wu3_store_view_management_locally_complete`. The uncommitted WU3 Save/stock/Unit 7B command-reuse vertical is locally complete; M43/M44 remain unapplied. Unit 7B remains live-verified and integrated into `main` at `53edbddc9c5417b34cb169599e8282b162e183b3`.

### 2026-08-14 — Unit 7C WU3 Store View management vertical

- Authorized scope: branch from exact WU2 commit `db7d118651eed4f5fca4a9109b4c091e391df5e9`;
  consume unchanged M43 Save/stock through strict Owner Edge/client commands;
  reuse Unit 7B publication/retry services/hooks; add bounded Store View edit,
  stock, lifecycle controls, focused tests, local checks, and intercepted browser
  smoke. Migration changes/application, connected writes, deployment, media,
  history expansion, cutover, commit, and push were excluded.
- RED/GREEN: missing management modules and controls failed first. Final Store
  View/Edge coverage is 12 suites/63 tests; Unit 7C migration contract coverage
  is 2 suites/10 tests; selected Unit 7B/WU2/routing/worker/legacy Inventory
  regression is 102 passed with 4 pre-existing skips. TypeScript and Deno pass.
  Expo web export and the intercepted Save/stock/lifecycle/retry smoke pass 1/1.
- Implementation: `phase9-store-view-management-v1` maps Save only to M43 details
  and stock only to M43 stock-v2; strict schemas reject caller store/listing
  authority, forbidden edit fields, raw rows, and malformed responses. Client
  mutations generate fresh command identities, never retry, invalidate detail/
  list state, refetch on stale conflicts, and require explicit Owner retry.
  The detail UI exposes the frozen edit fields, Owner-only distinctions, stock
  bucket context, duplicate-submit fencing, and server-capability actions while
  reusing Unit 7B publication commands unchanged.
- Verification boundary: the fully intercepted browser flow proves client/UI/
  Edge-envelope behavior, not PostgreSQL mutation semantics. Existing WU1/WU2A
  disposable PostgreSQL evidence remains authoritative. Local Edge→DB is
  `NOT_RUN_ENVIRONMENT` because no repository-supported local Edge→M43/M44
  environment exists; no external workaround was used.
- External/Git state: no Supabase/Storage/business-row mutation, migration
  application, deployment, stage, commit, or push. M39–M44 are unchanged and no
  M45 exists. `docs/codemap/` remains untouched. Next action: obtain separate
  authorization to commit this exact WU3 vertical.

### 2026-08-14 — Unit 7C WU2 controlled Store View read vertical

- Authorized scope: consume unchanged M43/M44 through the existing Owner Edge
  router, strict TypeScript contracts/services/query hooks, hidden list/detail
  routes, read-only UI, focused tests, local/disposable verification, and web
  smoke. WU3 mutations/media, final navigation cutover, connected application,
  deployment, commit, and push were excluded.
- Implemented `read_store_view_page` and `read_store_view_detail` with no client
  store authority, strict curated DTOs, server filter/cursor forwarding,
  `inventoryId` cache/routing identity, six-filter list/pagination states, and
  Owner-distinguished private detail values. Publication failure remains its
  own effective state under Needs Attention; Out of Stock is not relabeled.
- Verification: initial missing-module RED; focused WU2 6 suites/31 tests;
  combined Owner Edge/committed-list/route regression 13 suites/274 tests;
  TypeScript PASS; Deno Edge graph PASS; Expo web export PASS; intercepted Edge
  browser list→detail smoke 1/1 PASS. The combined Jest runner printed the full
  green summary but retained an open test handle and was stopped afterward;
  focused WU2 Jest exits normally. Local Edge→DB is `NOT_RUN_ENVIRONMENT`
  because Docker/local Supabase is unavailable; GitHub-hosted Docker would
  require prohibited publication/workflow authority, and an MCP branch would
  require a separately approved paid external mutation.
- M39–M44 are unchanged and no M45 exists. No connected Supabase/Storage
  mutation, deployment, stage, commit, or push occurred. Read-only Supabase MCP
  reconfirmed exact project `ahntbtktjjmvfosgkmgn` healthy with M42 as the
  remote tail.
  `docs/codemap/` remains untouched. Next action requires separate authorization
  to commit this exact WU2 vertical; do not begin WU3.

### 2026-08-14 — Unit 7C WU2A filtered Store View page correction

- Authorized scope: red-first filtered-pagination tests, exactly one forward
  migration after immutable M43, disposable PostgreSQL proof, focused WU1/M43
  regressions, and required continuity updates. Edge/client/UI, connected
  migration application, deployment, commit, and push were excluded.
- Completed: M44 adds authenticated-only `phase9_store_view_page_v2(integer,
  text,text)`. It reuses M43's item helper, filters the `needs_attention` bucket
  by `attentionState = action_required` and the other named buckets by
  `effectiveState` before `(updated_at DESC,id DESC)` keyset pagination, and
  rejects cursors whose contract version, actor, store, or filter differs. Allowed
  filters are all/private/live/paused/needs_attention/out_of_stock.
- RED: 0/3 on a valid M43 database because page v2 was absent; a secondary
  targeted RED reproduced cross-store same-filter cursor acceptance before
  actor/store binding. The affected WU2A integration is 3/3, the M44 migration
  suite is 5/5, and the M43 WU1 regression is 15/15. Exact disposable M01–M44
  replay passed; existing WU1 vertical returned
  `UNIT_7C_REAL_POSTGRES_VERTICAL_PASS`; WU2A real proof returned
  `UNIT_7C_WU2A_REAL_POSTGRES_FILTER_PASS` for page sizes 1/2/3, all six filters,
  mixed ordinary/publication-failed `needs_attention` traversal, cursor mismatch,
  invalid filter, two-store isolation/non-enumeration, ACLs, and unchanged
  page-v1/detail-v1 reads.
- Exact-project read-only verification: `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` is healthy and remote history still ends at M42. No
  connected database/Storage mutation, deployment, application work, stage,
  commit, or push occurred. M39–M43 are byte-unchanged.
- Next authorized action: obtain separate authorization to commit this exact
  proven correction. A fresh WU2 application session, M43/M44 application, and
  all external actions remain separately gated.

### 2026-08-14 — Unit 7C Work Unit 1 local database contract

- Authorized scope: bounded WU1 RED tests, one forward migration candidate,
  minimal fixtures, local/disposable PostgreSQL apply and vertical proof, and
  required handoff documentation. Connected application/deployment, media,
  Edge/mobile/UI, stage, commit, push, and unrelated cleanup were prohibited.
- Implemented M43 Store View page/detail RPCs, exact-versioned/idempotent atomic
  Save, stock adjustment v2 with hold/bucket preservation, zero-stock public
  availability reconciliation, append-only safe public revisions, and reuse of
  the existing Unit 7B publication and listing-sync paths.
- RED: 0/11 expected failures, all attributable to absent pre-M43 WU1 contracts.
  GREEN: Unit 7C integration 15/15; migration Jest 5/5; focused Unit 7A/7B
  regression 40/40; exact final M01–M43 disposable PostgreSQL vertical proof
  returned `UNIT_7C_REAL_POSTGRES_VERTICAL_PASS`.
- PostgreSQL readback: nine affected functions are postgres-owned,
  `SECURITY DEFINER`, and fixed to empty `search_path`; public Owner RPCs are
  authenticated/service executable and anonymous denied; private helpers are
  denied to API roles. The revision table is postgres-owned, RLS-enabled, and
  has no authenticated/service update. Listing `authors_text` remains generated,
  `id`/`published_at` remain default-owned, and exactly one sync trigger exists.
- Read-only MCP reconfirmed exact project `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` healthy and the relevant live seam; M42 remains the
  remote migration tail. No Supabase/Storage or other external mutation occurred.
- Full media list/reorder/remove/replace remains deferred. Exact next action:
  obtain explicit authorization for the dedicated media-management work unit in
  Unit 7C §§8 and 15.7; M43 application remains separately unauthorized.

### 2026-08-14 — Unit 7C normative design completion

- Authorized work unit and scope: documentation/design only; create the bounded
  normative Unit 7C SDD from the final frozen contract reconciliation.
- Completed: Owner IA, stable identity/authority, Store View page/detail reads,
  atomic Save, separate stock/media commands, Unit 7B lifecycle reuse,
  attention/capabilities, metadata authority, public revisions, UI cutover,
  forward database delta, acceptance A–H, and implementation order.
- Files/components/migrations: Unit 7C SDD and required documentation continuity
  records only; no production component or migration file changed.
- Verification actually run: Phase 9 continuity validator, Markdown link check,
  SDD structure/line count check, `git diff --check`, and final status/diff review.
- Supabase/external mutations: none; no project query, database/Storage write,
  deployment, provider call, live verification, stage, commit, or push.
- Decisions/deviations/risks: one 293-line SDD was sufficient; no blocker or
  contradiction. M39–M42 stay immutable. Native Unit 6F debt remains unrelated.
- Next authorized action and gate: explicit approval for Unit 7C forward
  database-contract/red-test implementation; migration creation/application,
  deployment, and live verification remain later separate gates.

### 2026-08-14 — Unit 7B live-rollout closeout

- M42 (`20260814013536 marketplace_phase9_generated_authors_projection`) was
  applied exactly once on the verified target. It removes the generated
  `authors_text` assignment from the listing-sync trigger; the database-owned
  projection remains authoritative.
- `The Birth of Tragedy` completed Publish -> anonymous discovery with exactly
  one listing -> Pause/removal -> Republish with exactly one listing.
- A controlled transient projection failure produced one `publication_failed`
  state and one retry job; the worker resolved it. A stale-intent retry was
  fenced with `P9_STATE_CONFLICT`.
- Final connected readback preserved inventory identity and quantity, showed
  `published` inventory/publication state, one active listing, and zero
  outstanding publication retries.
- The existing development entitlement `active_listing_limit` was explicitly
  tagged `unit7b_dev_rollout`; its value is now `10`, changed from temporary
  value `1`. Other ready rows pass the authoritative eligibility derivation;
  `Café du Livre` remains blocked by `price` because its price is zero.
- Commit `9f3e646` was merged into `main` at merge commit
  `53edbddc9c5417b34cb169599e8282b162e183b3`. Exact next action: obtain
  explicit authorization for the next Phase 9 scope. No Unit 7C action or
  additional live migration/business-row mutation was performed.

### Historical 2026-08-14 — pre-M42 generated-column blocker

- Render deploy `dep-d9v6gss9v7es73f1d7e0`: `live`; health `alive`;
  readiness `ready`; Vault URL/token present.
- Selected live row: `461fa328-d95b-4573-965a-1eaa4be61ba1`, eligible,
  ready, draft/private, zero baseline listings.
- Owner UI -> Edge v7 -> PostgreSQL failed with `cannot insert a non-DEFAULT
  value into column "authors_text"`.
- `authors_text` is generated from `public_authors`; M40's listing-sync INSERT
  and conflict-update explicitly assign it.
- Rollback readback: draft/private, inventory/publication-intent versions `1/1`,
  listings `0`, publication retries `0`.
- No M42, migration edit, direct row repair, Unit 7C action, or main merge.

### 2026-08-13 — Unit 7B runtime rollout checkpoint

- Supabase `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` read back
  `ACTIVE_HEALTHY`; `phase9-owner-ingestion` Edge version 7 is ACTIVE.
- The deployed function source readback includes the checked-in transitive
  dependency tree and publication actions. The dashboard exposed no Git SHA or
  deployment UUID; the source was loaded from branch HEAD
  `c3c2726f4ec1455aa7f8cc2f16d206a9021d3649`.
- Render workspace enumeration found only metadata, vision, and media
  services. No publication-worker service was identified or created.
- The authorized Render creation request was rejected before mutation because
  it would transmit the Supabase `service_role` credential and a new worker
  ingress token to a public service. No Render service, environment variable,
  or deploy was created; sensitive credential egress needs separate approval.
- No database, Storage, or business-row mutation occurred in this checkpoint.
- Exact next action: explicit authorization to provision or identify the
  approved Render publication worker, then deploy and verify health/readiness;
  live business testing remains separately authorized.

### 2026-08-14 — New-session continuation handoff

- No additional remote mutation occurred after the 2026-08-13 runtime
  checkpoint. The Render API listing still shows only the existing metadata,
  fixture-vision, and media-sanitation services; the browser dashboard check
  was at login.
- The supported Render creation request was rejected before mutation because it
  would transmit the Supabase `service_role` credential and a new worker
  ingress token to a public service. No Render service, environment variable,
  or deploy was created.
- The current process carried a foreign `SUPABASE_URL` host while the available
  service-role JWT identified `ahntbtktjjmvfosgkmgn`. User and machine
  environment scopes were unset, and the project `.env` remains target-correct.
  New runtime commands must explicitly use the target URL and must not print
  the key.
- Exact next action: use the authenticated Render dashboard to provision or
  identify `phase9-publication-worker`, configure secrets without exposing
  them, deploy the checked-in worker, and capture service/deployment,
  health/readiness, and ingress-fence evidence. Stop before the live business
  test and obtain separate explicit authorization for it.

Historical continuity markers (status and migration ledger are immutable):
**Status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`;
**Active work unit:** `unit7a_owner_edge_import_resolution_correction_requires_separate_authorization`;
M24-M30 live identifiers `20260730022442`, `20260730022524`,
`20260730022559`, `20260730022636`, `20260730022713`, and
`20260801093048 marketplace_phase9_unit6e_review_corrections` remain recorded
below and unchanged.

### 2026-08-12 - New scan review save and UI proof stop

- The user authorized saving new candidate
  `5b8a7220-d460-40fc-ad5c-330c84d69903` through the authenticated Owner UI
  with private intent, quantity `1`, and invented price `250000` paise.
- Exact-project readback confirms the review save succeeded: candidate state
  `ready`, disposition `reviewed`, `review_ready=true`, review version `1`,
  metadata revision `4`, and no committed inventory ID.
- The scan summary exposed “Ready for next step,” but the candidate-detail
  route failed on initial load and exact retry. Add to Inventory was never
  exposed, so Unit 7A commit/replay was not attempted.
- Read-only final state remains inventory `5`, committed total `0`, Unit 7A
  idempotency/audit/event `0/0/0`, inventory-media links `0`, and five private
  inventory rows. Verdict: `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`.

### 2026-08-12 - Fresh image upload observation

- User-started session `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one
  image through the Owner flow. The media-validation job retried once, then
  final read-only readback showed input state `skipped`,
  `quality_reason=P9_OWNER_REMOVED`, job status `cancelled`, and attempt
  count `2/5`.
- The session has zero candidates and zero commits. No Unit 7A inventory
  command was issued. The removed input remains excluded from further proof
  unless a new explicit target decision authorizes a new upload.

Historical pre-correction active work unit marker preserved for continuity:
`unit7a_owner_edge_import_resolution_correction_requires_separate_authorization`.
Historical status marker: **Status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`.

### 2026-08-12 - Fresh image completed with two review-needed candidates

- The same session later accepted a second image and completed media/vision
  processing successfully. It now reports two candidates: `Individuals` by
  `P. F. Strawson` and `Thinking, Fast and Slow` by Daniel Kahneman.
- Exact-project readback shows both candidates `state=ready` with
  `review_ready=false`, and the session has two inputs, two candidates, and
  zero commits. The first review screen loads matched metadata but price and
  Owner confirmations are still required. No review or inventory write was
  made for these fresh candidates.

### 2026-08-12 - Fresh candidate saved; inventory step unavailable

- Candidate `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved
  privately through the Owner UI with quantity `1` and price `250000` paise.
- Exact-project readback confirms `state=ready`, `reviewed`,
  `review_ready=true`, review version `1`, and no committed inventory ID.
- The scan summary exposed “Ready for next step,” but candidate detail failed
  on initial load and exact retry. Add to Inventory was never exposed; final
  inventory remains `5`, committed total `0`, and Unit 7A counters remain
  `0/0/0`.

### 2026-08-12 - Unit 7A corrected deployment and controlled live-proof stop

- User-authorized scope was limited to one authenticated Owner UI commit and an
  exact same-command replay; no code, migration, manual RPC, Unit 7B/7C, or
  unrelated deployment action was taken.
- Read-only exact-project preflight confirmed M39 exactly once, the expected
  Unit 7A ACL/M05 revocation, and baseline inventory/listing `5/5`, candidates
  `18 ready/36 needs_review/1 failed`, committed total `0`, Unit 7A
  idempotency/audit/event `0/0/0`, and inventory-media links `0`.
- `phase9-owner-ingestion` version 4 is ACTIVE with deployment ID
  `f8aec89f-ae2a-431a-8a97-5775a2405b90`; deployment attempts are `1/1`.
- The real authenticated Owner Browser path selected existing eligible reviewed
  candidate `d61d2193-4674-49d1-ae09-aed120dfe261` (`q=1`, candidate state
  `ready`, `reviewed`, `review_ready=true`). Candidate detail failed twice;
  Add to Inventory was never exposed, so the primary commit and exact replay
  were not run.
- Final read-only readback showed no business effect: candidate remained
  `ready`, inventory/listings remained `5/5`, committed total remained `0`,
  Unit 7A idempotency/audit/event remained `0/0/0`, and inventory-media links
  remained `0`.
- Verdict: `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`.
- Next authorized action: restore the authenticated Owner candidate-detail/Add-
  to-Inventory UI path, then resume only the one commit followed by exact
  same-command replay. Manual RPC and additional deployment remain excluded.

### 2026-08-12 — Unit 7A controlled Owner Edge deployment attempt

- Exact scope: only `phase9-owner-ingestion`; media, vision/Gemini, metadata,
  publication, and Unit 7B/7C functions were not deployed.
- Predeployment verification: runtime matched reviewed SHA `e2437f18`; focused
  Owner UX, ingestion runtime, and security suites passed 182/182.
- Deployment result: `FAILED_BEFORE_ACTIVATION`, count 1/1, no retry. Supabase
  bundling could not resolve extensionless import `../contracts/registers` from
  `_shared/imageInventory/domain/validation.ts`.
- Readback: prior `phase9-owner-ingestion` id
  `f8aec89f-ae2a-431a-8a97-5775a2405b90`, version 3, remains ACTIVE with
  `verify_jwt=true`. No new version activated.
- Zero-effect evidence: pre/post inventory/listings 5/5, publication
  `{private:5}`, media links/public media 0/0, candidates
  `{ready:18,needs_review:36,failed:1}`, committed total 0, and Unit 7A
  idempotency/audit/event counts 0/0/0.
- Next gate: separately authorize a reviewed source-only import-resolution
  correction and, after review, a new deployment attempt. Live Add to Inventory
  and exact replay remain `NOT_RUN` and blocked.
**Preserved authorization sequence:** `definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`; neither status by itself authorizes migration application or external mutation.
## Work units
| Unit | Scope | Status | Required gate |
| --- | --- | --- | --- |
| 0 | [Contract fixtures, threat tests, migration plan, rollback/forward-correction plan](../work-units/00-contracts-threat-migration-plan.md) | `approved` | Corrections incorporated; no implementation/migration authorization |
| 0A | Server contracts, deterministic helpers, validation/error/provider/query/grant registers, fixtures, and red contract/security tests | `approved_complete` | independently reviewed 2026-07-19; no SQL/live writes; focused 4 suites/41 tests and all function 9 suites/53 tests pass |
| 0B | [Backend/API technical design](../work-units/00b-backend-api-technical-design-plan.md): seven routed artifacts covering command/query/DTO/actor/boundary inventories, state/transaction/idempotency/worker/telemetry matrices, exact later file allowlists, and red-test mapping | `independently_approved` | original and bounded correction verdicts `approved` 2026-07-22; consolidated Risk-Based Phase 9 SDD analysis next; no Supabase query, migration, endpoint, provider/storage/UI/runtime change or external mutation |
| 1 | [Package 1 live audit](../work-units/01-package1-live-audit.md) and [database design](../work-units/01-package1-database-design.md): metadata, aliases, condition/damage, pipeline/media/request-photo persistence, RLS/grants/functions/indexes/storage, and migration grouping | `m01_m08_m10_live_verified` | M01-M08 plus forward M10 live once; exact discovery/request/internal/private boundaries and advisor correction pass |
| 2 | Extraction session/input/candidate/enrichment/job tables, RLS, indexes, retention fields | `m02_live_verified` | M02 live through M10; Unit 4 needs forward evidence/lease delta |
| 3 | Private media staging, server upload authorization, validation/re-encode/promotion boundary | `deployed_and_live_verified` | M11 live as `20260726182238`; Owner Edge and separate media service verified |
| 4 | [Fixture vision-analysis runtime](../work-units/04-fixture-vision-analysis-runtime-design.md): `p9-vision-v2`, analyzer, job orchestration, immutable evidence/candidates | `fixture_deployed_and_live_verified` | M12 live as `20260726182539`; all nine fixture cases verified; no real provider |
| 4A | [Deployment-runtime scaffolding](../work-units/04a-deployment-runtime-scaffolding-sdd.md): executable sanitation/fixture-vision hosts, strict environment, builds/containers, invocation and validation | [`deployed_and_live_fixture_verified`](./06-fixture-pipeline-deployment-evidence.md) | separate free Render services live at `96991a9`; M13 invoker boundary live |
| 4B | [Gemini vision adapter](../work-units/04b-gemini-vision-adapter-handoff.md) for configured `gemini-3.5-flash-lite`; optional whole-image fallback remains unselected/disabled | `m14_live_verified_provider_deferred` | M14 live once; server-only Render configuration and startup deployment are recorded, but no authenticated `/run`, real Gemini inference, independent public health receipt, Storage mutation, or fallback selection is proven |
| 5A | [Metadata foundation](../work-units/05a-metadata-foundation-handoff.md): provider-neutral local-first routing/cache/coalescing, ISBN validation, coherent selection, and attempt/cost lineage | `m17_live_acl_verified` | M17 live once; four sensitive tables are service SELECT-only with RPC-only mutation |
| 5B/5C | Google Books primary adapter / [Unit 5C Lite multilingual variants](../work-units/05c-lite-multilingual-search-variants-sdd.md) | [`5B merged_fixture_verified_provider_deferred`](./11-unit5b-implementation-evidence.md) / [`5C-5/5C-6 merged and live`](./17-unit5c5-6-owner-rollout-backend-evidence.md) | M18-M28 live once; M29 was absent at Unit 5C closeout and is now live through Unit 6A; no language enabled |
| 6 | [Owner capture/review/recovery UX](../work-units/06-owner-capture-review-recovery-ux-sdd.md), split 6A-6F | `complete_live_verified` | Automatic/functional Unit 6 pipeline is PASS: M38 rollout plus one real authenticated Owner upload proved automatic media, vision/Gemini, metadata, and Owner Needs Review with no inventory/listing effects. Native Unit 6F gates remain deferred `NOT_RUN`/`UNRESOLVED` validation debt, not PASS; the project owner accepts the risk and authorizes Unit 7. |
| WU1 | [Controlled Owner-inventory read boundary](../work-units/owner-inventory-read-boundary-wu1-sdd.md) | [`applied_readback_complete_runtime_deferred`](./25-owner-inventory-read-boundary-wu1-evidence.md) | Exact development migration applied once; post-application security/object readback and anonymous denial pass; positive Owner runtime and client/UI/legacy-caller changes remain gated |
| WU2 | [Read-only Owner inventory client integration](../work-units/owner-inventory-read-client-wu2-sdd.md) | [`locally_complete_authenticated_runtime_deferred`](./26-owner-inventory-read-client-wu2-evidence.md) | Owner `/inventory` uses the canonical page RPC with strict DTO validation, isolated cache/pagination, exact filters, and read-only states; dashboard, writes, deployment, authenticated runtime, and Unit 7 remain gated |
| Wake dispatcher | [Automatic worker wake dispatcher](../work-units/automatic-worker-wake-dispatcher-sdd.md) | `live_active_verified` | M36 is live exactly once; its cron is active and automatically completed the final Unit 6 media, vision, and metadata path without manual invocation |
| 7A | [Create-only per-candidate private inventory commit](../work-units/07a-create-only-inventory-commit-sdd.md), server-held review snapshot, exact replay/concurrency, one-to-one provenance, and Unit 6 duplicate-contract transition | [`edge_deployment_blocked_by_source_routing_mismatch`](./29-unit7a-create-only-commit-evidence.md) | M39 application/readback pass; the one Owner Edge deployment attempt failed before activation on an extensionless import; no retry, source repair, or business effect |
| 7B | [Safe publication/projection after private inventory creation](../work-units/07b-publication-sdd.md) | `live_verified_main_integrated` | closed at merge `53edbddc9c5417b34cb169599e8282b162e183b3`; lifecycle contracts are reused unchanged by Unit 7C |
| 7C | [Owner Store View and post-commit inventory management](../work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md) | `wu2_store_view_read_locally_complete` | local M43/M44 plus WU2 Edge/client/query/list/detail read vertical pass; both migrations are unapplied; obtain separate WU2 commit authorization next |

Historical Unit 7B local correction matrix (2026-08-12; superseded by the live
closeout above): expanded disposable Unit 7B is
22/22; focused backend is 32/32; focused mobile/read/discovery is 80/80; the
compatible TypeScript check, four worker builds, entrypoint smoke, and
deployment validator pass. The gate rerun additionally passes Unit 7A 13/13,
dispatcher 29/29, prior worker runtime 31/31, and M39 byte-for-byte integrity.
Real PostgreSQL concurrency is `BLOCKED_ENVIRONMENT` before SQL because both
fresh `initdb` and installed-cluster `pg_ctl` fail on the sandbox restricted
token. Docker smoke is `BLOCKED_ENVIRONMENT/P9_DOCKER_UNAVAILABLE`. Deno check
is `BLOCKED_ENVIRONMENT/DENO_COMMAND_NOT_FOUND`; the authorized Scoop install
failed on sandbox write/network credentials. Broad PGlite reproduces 276/277
with the unchanged metadata fixture. Repository Jest passes all 2012 real tests
across 242 suites and fails only six pre-existing empty collectors; its former
load-sensitive timeout did not recur. Any older M40 row claiming unavailable
gates passed is superseded by this correction.
| 8 | Marketplace bookstore-first search, multilingual aliases, counts, full store catalogue | `not_started` | public/private projection tests |
| 9 | Damaged-book public media and mandatory customer photo-request extension | `not_started` | DOC-6/14 seam tests; no payment implementation |
| 10 | Lifecycle worker, deletion evidence, orphan cleanup, alerts, retention holds | `not_started` | lifecycle failure/replay tests |
| 11 | Pilot fixtures, security/regression/E2E/accessibility/cost verification and handoff | `not_started` | all prior units complete |
## Current Unit 6 closure authority — 2026-08-12

The automatic/functional Unit 6 pipeline is **PASS**: M38 automatic proof
completed media, vision/Gemini, metadata, and Owner-review handoff, with no
inventory/listing effects. Native Unit 6F evidence remains deferred
`NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery physical-device
parity, native recovery/reconnect, 15-card representative-device performance,
offline/reconnect, accessibility/large text, and low-end Android
resource/performance. AC36 and AC39 remain the mapped native acceptance
criteria; neither criterion is changed or treated as satisfied by automatic
pipeline evidence. The project owner accepts the deferred native-validation
risk and authorizes Unit 7 to begin. This current authority supersedes older
sequencing statements in dated entries below that made the native debt a Unit
7 blocker; it does not change the Unit 6 SDD, acceptance criteria, or evidence
classification.

## Migration ledger
Exact-project preflight passed on `ahntbtktjjmvfosgkmgn`. M01-M08/M10 applied in order after the reviewed M06 owner-safe correction. M09 remains the separate live-data preflight and constraint-validation gate.
| Local filename | Live version/name | Project verified | Applied by | Rollback/forward fix | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `20260722000001_marketplace_phase9_catalogue_metadata_expand.sql` | `20260722090236 marketplace_phase9_catalogue_metadata_expand` | MCP exact project 2026-07-22 | authorized live application | additive/forward correction | history/schema/RLS/grants/data readback | `live_verified` |
| `20260722000002_marketplace_phase9_extraction_persistence.sql` | `20260722090256 marketplace_phase9_extraction_persistence` | MCP exact project 2026-07-22 | authorized live application | additive/forward-disable providers | tables/FKs/jobs/capabilities/RLS readback | `live_verified` |
| `20260722000003_marketplace_phase9_media_registry.sql` | `20260722090321 marketplace_phase9_media_registry` | MCP exact project 2026-07-22 | authorized live application | additive/forward correction | media tables/FKs/privacy/RLS readback | `live_verified` |
| `20260722000004_marketplace_phase9_condition_damage_transition.sql` | `20260722090341 marketplace_phase9_condition_damage_transition` | MCP exact project 2026-07-22 | authorized live application | compatibility/backfill/final check | five inventory/five listing rows remain `good`; final checks live | `live_verified` |
| `20260722000005_marketplace_phase9_controlled_inventory_commands.sql` | `20260722090407 marketplace_phase9_controlled_inventory_commands` | MCP exact project 2026-07-22 | authorized live application | revoke/forward-disable boundary | 24 named public RPCs; zero anon execute; internal authenticated execute zero | `live_verified` |
| `20260722000006_marketplace_phase9_storage_boundaries.sql` | `20260722095443 marketplace_phase9_storage_boundaries` | MCP exact project 2026-07-22 | authorized live continuation | reviewed owner-safe correction before first successful apply | four bucket boundaries; zero direct Phase 9 client policies; unrelated branches preserved | `live_verified` |
| `20260722000007_marketplace_phase9_public_projection_search.sql` | `20260722095545 marketplace_phase9_public_projection_search` | MCP exact project 2026-07-22 | authorized live continuation | safe projection plus forward M10 | 24 allowlisted/zero private columns; three indexes; pinned/named functions; grants/view corrected by M10 | `live_verified_with_m10` |
| `20260722000008_marketplace_phase9_request_photo_seam.sql` | `20260722095729 marketplace_phase9_request_photo_seam` | MCP exact project 2026-07-22 | authorized live continuation | forward M10 repairs only grant regression | tables/FK/trigger/RLS/worker/hold/expiry verified; request grants preserved by M10 | `live_verified_with_m10` |
| `20260722000010_marketplace_phase9_public_boundary_security_correction.sql` | `20260722125256 marketplace_phase9_public_boundary_security_correction` | MCP exact project 2026-07-22 | authorized bounded live correction | forward-only; M01-M08 immutable | exact three anon RPCs; invoker-safe 24-field view; zero direct view/private access; advisor error gone | `live_verified` |
| `20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql` | `20260726182238 marketplace_phase9_ingestion_runtime_foundation` | MCP exact project 2026-07-26 | authorized M11/M12 live application | forward-only; revoked legacy authenticated path RPCs | 20 columns, 11 constraints, unique capability index, 12 hardened service-only functions, unchanged 5/5/14 inventory/listing/event counts and zero Storage objects; security 172 after M11 | `live_verified` |
| `20260726000012_marketplace_phase9_vision_analysis_runtime.sql` | `20260726182539 marketplace_phase9_vision_analysis_runtime` | MCP exact project 2026-07-26 | authorized M11/M12 live application | forward-only after M11; initial truncated transport submission failed atomically and was absent before lossless retry | RLS/private immutable tables, eight lineage/reconciliation columns, exact uniqueness/constraints/triggers/index, four hardened service-only RPCs, unchanged data/Storage; security 174 with only two expected INFO notices | `live_verified` |
| `20260727000013_marketplace_phase9_service_rpc_wrappers.sql` | `20260727025046 marketplace_phase9_service_rpc_wrappers` | MCP exact project 2026-07-27 | authorized M13 boundary correction | forward-only; private functions/schema unchanged | 13 postgres-owned, empty-search-path `SECURITY INVOKER` wrappers; service-role only; anon/auth denied; private schema still `PGRST106` | `live_verified` |
| `20260727000014_marketplace_phase9_vision_provider_attempts.sql` | `20260727183546 marketplace_phase9_vision_provider_attempts` | MCP exact project 2026-07-28 | authorized M14-only application | forward-only additive; no Storage/provider/deployment effect | dedicated empty 34-column attempt table, approved constraints/five indexes, retry-stable spend identity, semantic pricing allowlist, exact service-only RPC signatures, zero client grants; PGlite 67/67 and fixture regression 23/23 | `live_verified` |
| `20260728000015_marketplace_phase9_metadata_foundation.sql` | `20260727222159 marketplace_phase9_metadata_foundation` | MCP exact project 2026-07-28 | authorized exact-file M15 application | forward-only additive after M14; grant correction required; never reuse M09 | complete 60,915-byte checked-in file applied once; schema/RPC/client-denial/invariant checks pass; live default privileges left direct service-role DML on all three new tables; focused 7/7, metadata PGlite 10/10, full Phase 9 PGlite 77/77 | [`live_security_correction_required`](./08-m15-application-evidence.md) |
| `20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql` | `20260727231217 marketplace_phase9_sensitive_table_acl_correction` | MCP exact project 2026-07-28 | authorized M16 application | forward-only four-table ACL correction; M17 needed for PG17 MAINTAIN; never reuse M09 | six named privileges denied, SELECT/RPC/RLS/client boundaries pass; raw ACL `service_role=rm/postgres` exposes MAINTAIN; post-apply focused 5/5 | [`live_pg17_maintain_correction_required`](./09-m16-acl-correction-evidence.md) |
| `20260728000017_marketplace_phase9_maintain_acl_correction.sql` | `20260727233457 marketplace_phase9_maintain_acl_correction` | MCP exact project 2026-07-28 | authorized M17 application | forward-only exact four-table ACL correction; never reuse M09 | PG17.6 raw ACL `service_role=r/postgres`; SELECT only, clients denied, RLS/owner and 13 RPCs unchanged; focused 25/25 | [`live_verified`](./10-m17-acl-correction-evidence.md) |
| `20260729000018_marketplace_phase9_search_variant_proposals.sql` | `20260729004216 marketplace_phase9_search_variant_proposals` | MCP exact project 2026-07-29 | authorized Unit 5C-2 M18 application | forward-only private companion table/RPC boundary; M01 aliases unchanged; never reuse M09 | PG17.6 table/check/FK/index/timestamp/RLS/ACL/function readback; service SELECT-only and no MAINTAIN; rollback-only accepted/replay/mismatch/scope smoke; zero residue; focused Jest 142/142 and PGlite 73/73 before final rerun | [`merged_main_b398034`](./14-unit5c2-variant-persistence-evidence.md) |
| `20260729000019_marketplace_phase9_search_variant_replay_fence.sql` | `20260729020008 marketplace_phase9_search_variant_replay_fence` | MCP exact project 2026-07-29 | one authorized bounded Unit 5C-2 correction | forward-only immutable accepted-envelope fingerprint; M18 unchanged; renamed M18 helper private to replacement definer | red reproduced changed-replay append; green structural 12/12 and PGlite 9/9; PG17.6 RLS/ACL/search-path/no-MAINTAIN readback; rollback-only exact/changed replay smoke; zero residue | [`merged_main_b398034`](./14-unit5c2-variant-persistence-evidence.md) |
| `20260729000020_marketplace_phase9_variant_runtime_search.sql` | `20260729054842 marketplace_phase9_variant_runtime_search` | MCP exact project 2026-07-29 | authorized Unit 5C-3 migration application before scope narrowing | immutable applied migration; temporarily combined Unit 5C-3 reconciliation/lifecycle with Unit 5C-4 materialization/search; corrected forward by M21, never edited/reverted/deleted | database integration and lifecycle verification completed; final live interpretation requires M21 | [`merged_main_f09301b`](./15-unit5c3-runtime-reconciliation-evidence.md) |
| `20260729000021_marketplace_phase9_defer_active_variant_search.sql` | `20260729060238 marketplace_phase9_defer_active_variant_search` | MCP exact project 2026-07-29 | authorized Unit 5C-3 scope correction | forward-only removal of public search RPC, alias materializer, target linkage, and trigger/search effects; preserves M18-M20 history | final affected Jest 7 suites/101; DB 12/12; TypeScript with allow-importing-TS-extensions; rollback-only lifecycle smoke, zero residue, live proposal/proposal-set/alias counts zero | [`merged_main_f09301b`](./15-unit5c3-runtime-reconciliation-evidence.md) |
| `20260729000022_marketplace_phase9_active_variant_search.sql` | `20260729075459 marketplace_phase9_active_variant_search` | MCP exact project 2026-07-29 | authorized Unit 5C-4 application after exact-tree approval | immutable active-only store-scoped title/author alias materialization, target linkage, retraction, and fail-closed search foundation; corrected forward by M23 | PGlite 35/35, Jest 53/53, scoped TypeScript/continuity/secret/pyc checks, rollback-only smoke, zero residue | [`merged_main_d092f08`](./16-unit5c4-active-variant-search-evidence.md) |
| `20260729000023_marketplace_phase9_active_variant_search_correction.sql` | `20260729082153 marketplace_phase9_active_variant_search_correction` | MCP exact project 2026-07-29 | authorized bounded Unit 5C-4 forward correction | preserves M22; restores legacy approved-alias rank and strengthens source-field/source-text reconciliation at protected materialization | live schema/RLS/ACL/search-path/no-MAINTAIN readback; same final affected verification and zero-residue smoke | [`merged_main_d092f08`](./16-unit5c4-active-variant-search-evidence.md) |
| `20260729000024` through `20260729000028` Unit 5C-5/5C-6 migrations | `20260730022442`, `20260730022524`, `20260730022559`, `20260730022636`, `20260730022713`, exactly once | MCP exact project 2026-07-30 | exact tree `66db5be7` dual-approved | strict Owner decisions; candidate-first replacement; canonical benchmark/review evidence; exact rollout; platform evidence reads; M29 absent at this historical gate and now live through Unit 6A | Jest 140/140; PGlite 53/53; real concurrency/security/evidence/rollout smoke; zero residue | [`backend_complete_live_verified`](./17-unit5c5-6-owner-rollout-backend-evidence.md) |
| `20260801000030_marketplace_phase9_unit6e_review_corrections.sql` | `20260801093048 marketplace_phase9_unit6e_review_corrections` | MCP exact project 2026-08-01; `ahntbtktjjmvfosgkmgn` | authorized after exact M29 preflight; applied exactly once via Supabase MCP | additive `CREATE OR REPLACE FUNCTION` compatibility correction only; no table, trigger, index, data, Storage, provider, deployment, inventory, publication, or commerce effect | post-apply migration history has no later entry; function owners/ACLs/security/search_path unchanged; read-only fixture/helper/RPC checks recorded in [tracker 23](./23-unit6e-review-corrections-evidence.md) | [`live_verified`](./23-unit6e-review-corrections-evidence.md) |
| `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql` | `20260803221216 marketplace_phase9_owner_inventory_read_boundary` | MCP exact project 2026-08-04; `ahntbtktjjmvfosgkmgn` | attached user request after WU1 review/preflight; applied once via Supabase MCP | forward-only new list RPC plus one owner-page index; stable detail RPC/RLS/table grants/triggers untouched | preflight M30 tail; post-apply exact signature/security/owner/search_path/ACL/index/detail/RLS/trigger readback; anonymous REST denial; positive Owner JWT runtime deferred | [`applied_readback_runtime_deferred`](./25-owner-inventory-read-boundary-wu1-evidence.md) |
| `20260807000032_marketplace_phase9_structural_metadata_integration.sql` | `20260808020404 marketplace_phase9_structural_metadata_integration` | MCP exact project 2026-08-08; `ahntbtktjjmvfosgkmgn` | prior explicit M32 application authorization; verified in this proof, not applied by this session | forward-only trigger/table/RPC additions plus Owner metadata-state helper replacement; no applied migration edited | exact-project migration/schema/trigger/RPC/ACL readback passed; provider registry configured; live proof blocked before provider egress by missing target credentials | `live_schema_verified_provider_runtime_blocked` |
| `20260809000033_marketplace_phase9_vision_reservation_correction.sql` | `20260809023834 marketplace_phase9_vision_reservation_correction` | MCP exact project 2026-08-09/10; `ahntbtktjjmvfosgkmgn` | prior authorized application; read-only verified in this session | forward-only private helper plus media-finalizer replacement | migration history readback plus recorded correction evidence | `live_verified` |
| `20260809000034_marketplace_phase9_vision_language_hint_correction.sql` | `20260809182407 marketplace_phase9_vision_language_hint_correction` | MCP exact project 2026-08-10; `ahntbtktjjmvfosgkmgn` | prior authorized application; read-only verified in this session | forward replacement of selected-language rejection and author validation | migration history and function/schema evidence from completed real-image proof | [`live_verified`](./27-compact-gemini-multilingual-language-hint-evidence.md) |
| `20260810000035_marketplace_phase9_single_image_removal.sql` | `20260809223135` | MCP exact project 2026-08-10; `ahntbtktjjmvfosgkmgn` | application and three exact removals authorized; Edge deployment separately authorized | forward constraint/function replacements; logical removal, dual single-input guards, current-input read filtering; no physical Storage delete or candidate/inventory/listing mutation | structural Jest 6/6; isolated M01-M35 PGlite 3/3; live function/migration readback; 3/3 inputs removed; 3/3 jobs cancelled; Owner Edge v3 four-file exact match | `live_verified` |
| `20260810000036_marketplace_phase9_worker_wake_dispatcher.sql` | `20260810105448 marketplace_phase9_worker_wake_dispatcher` | MCP exact project 2026-08-10; `ahntbtktjjmvfosgkmgn` | prior authorized application; read-only verified in this session | forward-only private helper/observability/dispatcher plus one named cron created inactive; Vault configuration, Render services, job rows, Storage, inventory, and publication unchanged | live migration history readback plus prior red-first structural/runtime Jest 23/23, dispatcher PGlite 28/28, full Phase 9 Jest 694/694, full Phase 9 PGlite 240/240, and worker build/entrypoint smokes | `live_inactive` |
| `20260810000037_marketplace_phase9_owner_discovery_scope_correction.sql` | `20260810105517 marketplace_phase9_owner_discovery_scope_correction` | MCP exact project 2026-08-10; `ahntbtktjjmvfosgkmgn` | prior authorized application; read-only verified in this session | `CREATE OR REPLACE FUNCTION` only; scopes `needsReviewCount` to authenticated actor plus server-resolved active store while preserving immutable M35 source and existing authenticated-only ACL | live migration history readback plus prior focused M35/M37/Edge/mobile Jest 5 suites/189, isolated M35-to-M37 PGlite 4/4, and full M35-to-M37 Phase 9 DB replay 241/241 | `live_verified` |
| `20260810000038_marketplace_phase9_metadata_retry_correction.sql` | `20260810130638 marketplace_phase9_metadata_retry_correction` | exact project `ahntbtktjjmvfosgkmgn` verified healthy immediately before application and read back after | user-authorized M38-only operational application | private context-v2 helper plus service-only public wrapper replacement; exposes only selected physical-call claim attempt; M32-M37 unchanged | history once; empty `search_path`; postgres owner; service-role-only execute; dispatcher stayed active; zero apply-created/claimed jobs; unchanged baseline counts; prior metadata Jest 148/148, exact HTTP 503-to-200 regression, full PGlite 242/242, build/entrypoint/deployment validation and independent `APPROVED` review | `live_verified` |
| `20260812000039_marketplace_phase9_create_only_inventory_commit.sql` | `20260812003419 marketplace_phase9_create_only_inventory_commit` | exact target `ahntbtktjjmvfosgkmgn`; migration history read back once | authorized M39 application; immutable | forward-only private eligibility/helper replacements plus authenticated-only create command; no M09/global validation | one private Owner commit plus exact replay; one inventory row; zero replay effects; M39 byte-unchanged | [`live_verified`](./29-unit7a-create-only-commit-evidence.md) |
| `20260812000040_marketplace_phase9_safe_publication.sql` | `20260813000040 marketplace_phase9_safe_publication` | exact target `ahntbtktjjmvfosgkmgn`; migration history read back once | authorized M40 application; immutable | shared rollout eligibility using latest subscription row, moderation preservation, safe grouped discovery, targeted public-media retraction, post-lease worker replay, and Unit 7B scope | correction matrix 6/6; focused migration assertions 4/4; Owner-publication/discovery/worker 20/20; cross-layer proof 4/4; M39 byte-unchanged | `live_verified` |
| `20260813000041_marketplace_phase9_unit7a_quality_handoff.sql` | `20260813070104 marketplace_phase9_unit7a_quality_handoff` | exact target `ahntbtktjjmvfosgkmgn`; migration history read back once | authorized M41 application; immutable | deterministic candidate-derived quality handoff only; no manual repair and no public-state change | exactly three provenance-qualified development rows changed `missing_metadata` → `ready`; all remained draft/private; triggers read back | `live_verified` |
| `20260814000042_marketplace_phase9_generated_authors_projection.sql` | `20260814013536 marketplace_phase9_generated_authors_projection` | exact target `ahntbtktjjmvfosgkmgn`; project `ACTIVE_HEALTHY`; migration history read back once | authorized forward-only M42 application; immutable | replaces the listing-sync trigger body so generated `marketplace_book_listings.authors_text` is omitted from INSERT/UPDATE assignments; M39/M40/M41 unchanged | migration history exactly once; live function readback; Publish/Pause/Republish, transient retry, stale-intent fencing, and final connected-state proof passed | `live_verified` |
| `20260814000043_marketplace_phase9_unit7c_inventory_management.sql` | not applied | exact target `ahntbtktjjmvfosgkmgn` read-only verified healthy; M42 remains remote tail | local WU1 creation only; connected application not authorized | forward Store View reads, atomic Save, stock v2, revision ledger, and Unit 7B lifecycle/projection integration; M39–M42 unchanged | expected RED 0/11; Unit 7C 15/15; static 5/5; Unit 7A/7B 40/40; exact M01–M43 disposable PostgreSQL vertical/readback PASS | `local_candidate_verified_unapplied` |
| `20260814000044_marketplace_phase9_store_view_filter_contract.sql` | not applied | exact target `ahntbtktjjmvfosgkmgn` read-only verified healthy; M42 remains remote tail | bounded WU2A local correction only; connected application not authorized | page v2 authoritative filters before keyset pagination (`needs_attention` uses action-required attention; other named states use effective state) with actor/store/filter-bound cursor; M39–M43 unchanged | WU2A integration 3/3; M44 static 5/5; M43 WU1 regression 15/15; exact M01–M44 replay, WU1 vertical, and WU2A real PostgreSQL proof PASS | `local_candidate_verified_unapplied` |
Rules: re-verify the project before planning and applying; use `apply_migration`, never raw DDL or generated fixture IDs.
- Use forward corrections; record every schema, grant, Storage, data, and verification effect.
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
- [ ] Unit 7A create-only commit is concurrency-safe and idempotent; duplicate advice/history is non-actionable and cannot block or redirect it.
### AI/provider contracts
- [ ] Prompt-injection text embedded in an image cannot cause tools, URLs, queries, or writes.
- [ ] Model output is rejected unless it satisfies the versioned schema and limits.
- [ ] Central validation matrix and API error catalogue generate/trace every contract limit and safe error behavior.
- [ ] A valid empty/no-book result does not trigger expensive retry loops.
- [ ] Primary failure triggers at most one allowed vision fallback.
- [ ] Metadata provider fallback is sequential and field conflicts are visible in provenance.
- [ ] Provider-independent fixtures prove configured primary/optional-secondary bounded routing, closed fallback policy, capabilities, query/cache/attempt/cost lineage, single accepted completion, duplicate-spend reconciliation, and manual degradation.
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
- [ ] Camera/gallery enforce the 15-spine cap; language-hint behavior never
  rejects or overwrites detected identity and remains regression-covered.
- [ ] Minimal review fields, defaults, add-missed/remove-false, non-actionable legacy duplicate history, condition explanations, and preview are keyboard/screen-reader accessible.
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
- [ ] No Phase 7/8 payment, paid-order, pickup, refund, ledger, or settlement behavior is introduced; fixed multi-replica tests cover claims/fencing, shutdown, provider retries, spend reconciliation, connection safety, fairness, stage-specific scaling, queue observability, and throughput before autoscaling can be enabled.

## Append-only implementation log

### 2026-08-14 — Unit 7B live closeout and main-authorization handoff

- Authorized scope: document the already completed M42 correction, live Unit 7B
  proof, and the temporary development entitlement adjustment; no Unit 7C or
  main merge.
- Completed: M42 is live exactly once; the generated-author projection is now
  database-owned; Publish -> Discover -> Pause -> Republish, controlled
  transient retry, stale-intent fencing, and final connected readback passed.
- Files/components: current Phase 9 router/status/session/tracker/evidence,
  data dictionary/current-vs-target audit, continuity validator, and the M42
  migration ledger entry. The existing M42 SQL/test files remain uncommitted.
- Verification actually run: exact project `ahntbtktjjmvfosgkmgn` read back
  `ACTIVE_HEALTHY`; migration history contains M39/M40/M41/M42 exactly once;
  live entitlement readback shows `active_listing_limit=10` from
  `unit7b_dev_rollout`; authoritative eligibility passes for ready rows except
  `Café du Livre` (`price`); selected-row readback shows `published`, one
  active listing, unchanged quantity/identity, and zero outstanding retries.
  Prior focused integration/Jest proof counts remain recorded above.
- Supabase/external mutations: M42 was applied before this documentation
  closeout; the existing entitlement row was changed from `1` to `10` at the
  user's request. No new migration, Storage mutation, deployment, Unit 7C
  action, or main merge occurred in this documentation closeout.
- Decision/deviation: `1` was a temporary `unit7b_dev_rollout` constraint;
  development is now configured for ten active listings. The UI's generic
  eligibility feedback remains a future polish item, not a live publication
  pipeline blocker.
- Next authorized action and gate: review the exact branch diff and obtain
  explicit main-integration authorization; commit/merge only after that
  authorization, preserving unrelated working-tree changes.

### 2026-07-27 — provider and scale SDD reconciliation
- Documentation-only reconciliation updated source/SDD requirements, target/evidence support, routing, and review gates; historical WU0/Unit 4/4A and the migration ledger remain unchanged, with no Supabase/external mutation.
- Real Gemini design is prospective Unit 4B, Unit 5 remains Metadata/aliases, advanced routing/autoscaling is deferred, and the next action is independent documentation review only; closeout verification is recorded in the branch handoff.
### 2026-07-26 — M11/M12 live application and verification
- Exact application, rollback, readback, advisor, mutation, and authorization evidence is recorded in [05-m11-m12-live-application-evidence.md](./05-m11-m12-live-application-evidence.md). 2026-07-27 follow-up: `main`/`origin/main` closed at `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`; routed documentation reconciliation and continuity/diff-hygiene checks passed, with no deployment, secret, Storage object, provider, or operational-data mutation afterward.
### 2026-07-23 — ingestion-runtime foundation corrected for dedicated-worker review

- Scope/evidence: local M11 plus Owner Edge intake, dedicated worker entrypoint/shared contracts/real pinned sanitizer implement only Owner intake through one vision-job queue; excluded scope and M09 are absent. The correction pass persists immutable completion responses and source hashes, creates service-only immutable source snapshots, fences every worker transition with opaque claim token plus attempt, retries Storage transport failures, recovers ambiguous post-upload completion failures without duplicate media/vision effects, enforces strong distinct ingress secrets, normalizes privacy-key denial, rejects multi-frame PNG/WebP, and keeps the 64 MP ImageMagick working allowance subordinate to the 16 MP source ceiling. Final commands: focused Jest 9 suites/74 tests; `npm run test:phase9:db` 26/26; repository and dedicated-worker TypeScript passed. A read-only review of the current unstaged candidate confirmed the security/runtime guarantees, found three stale M06 Storage rows, and after their correction found no remaining merge blocker with recommendation `READY_FOR_INDEPENDENT_REVIEW`.
- Benchmark/closeout: Node 22.13/Windows x64, three iterations each at 8/12/16 MP had median 11,767/11,397/14,269 ms and ending RSS 169/191/225 MB; all produced correct metadata-free WebP with stable hashes. WASM/package are 14,593,449/15,435,239 bytes. This is dedicated-worker sizing evidence only; representative-camera deployment load testing remains required. Final continuity passed 33 Markdown files/27 required files and `git diff --check` passed. No migration was applied, no service deployed, no Supabase/Storage data mutated, and nothing was staged, committed, pushed, or merged. Await separate user authorization to stage and commit; M11 application and deployment remain separately unauthorized.

### 2026-07-22 — Owner-safe M06 continuation and M10 live acceptance

- Evidence/correction/application: `storage.objects` ownership/RLS and all 19 policy branches matched; reviewed M06 correction `e07efa1` removed only the redundant owner-only statement before M06-M08 applied. M08 then revoked the three M07 anonymous discovery grants. M10 red contracts failed 3/3 absent, then passed 3/3; isolated database/security passed 20/20, migrations 27 suites/209 tests, Edge/security 9 suites/57 tests, TypeScript, continuity, and whitespace. Independent verdict was `approved`; commit `31253ad` was pushed before M10 applied as `20260722125256`.
- Live acceptance/gates: M01-M08/M10 are recorded once. Exactly the three discovery RPCs allow anon; no other Phase 9 RPC does; eight request-photo RPCs remain authenticated-only; eight internal helpers remain service-only; private client table grants are zero. The 24-field projection is barrier/invoker-safe with no direct role access, and `security_definer_view` findings are zero. Security advisors are 174 (`INFO 46/WARN 127/ERROR 1`) versus 172 before M10; the three intentional public query RPC WARNs replace the resolved view ERROR, while the remaining ERROR is legacy `public.spatial_ref_sys` RLS. Performance remains 350 (`INFO 199/WARN 151`). M09 is absent, quantity CHECK is `NOT VALID` with zero violations, and auth/providers/mobile/Edge/runtime were untouched.

### 2026-07-22 — Package 1 live application stopped at M06

- Authorized scope: merge approved `69edd90` to `main`; create `phase9-db-live-application`; exact-project preflight; apply only M01-M08 in order; verify and record; no M09/auth/runtime work
- Repository: clean fast-forward `main` from `a398adb` to `69edd90`, pushed; live-application branch created from updated `main`
- Preflight: project `ahntbtktjjmvfosgkmgn` was `ACTIVE_HEALTHY`; history ended at Phase 6 M39; no M01-M08 collisions; referenced schema/functions/extensions and Storage branches matched; five inventory/five listings were `good`; damaged/invalid/quantity violations were zero; quantity equality remained `NOT VALID`
- Applied: M01-M05 succeeded and are recorded once in order as versions `20260722090236`, `20260722090256`, `20260722090321`, `20260722090341`, and `20260722090407`
- Blocker: M06 failed with PostgreSQL `42501 must be owner of table objects` because `storage.objects` is owned by `supabase_storage_admin`; the approved migration includes `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`
- Stop/rollback evidence: M06 has no migration-history row; its transaction rolled back; both new buckets are absent and all four mixed legacy Storage policies retain their preflight branches; M07-M08 were not attempted
- Partial verification: M01-M03 tables/FKs and private RLS/grants are live; M04 final condition checks are live; M05 has 24 named public Phase 9 RPCs with zero anonymous execution and zero authenticated execution on internal helpers; quantity violations remain zero and the equality CHECK remains unvalidated
- Repository validation after the stop: isolated Phase 9 database tests 19/19; migration regressions 26 suites/206 tests; focused Edge Function/security suites 9 suites/57 tests; `npx tsc --noEmit` passed; Phase 9 continuity and `git diff --check` passed
- Advisor comparison: security `121 -> 158` and performance `314 -> 343`; no new ERROR and no new performance WARN. Added Phase 9 notices are 13 intentional service-only RLS/no-policy INFO entries, 24 named authenticated `SECURITY DEFINER` RPC WARN entries, and FK/unused-index INFO entries. Legacy findings remain separately classified.
- Required response: do not edit applied history or silently alter M06. A separately reviewed owner-safe M06 forward/application response is required before M06 retry or M07-M08 application.
- Auth deferral: no auth code changed. A new session and separate branch must complete auth state ownership, one root-owned subscription, centralized transitions/logout, secure token persistence, production-safe development bypasses, and removal of auth-to-marketplace dependency before Phase 9 mobile/private-ingestion runtime integration.
- M09/runtime: M09 was neither created nor applied; providers, Edge/runtime endpoints, mobile UI, and auth implementation were untouched

### 2026-07-22 — Package 1 M01-M08 local implementation

- Authorized scope: red-first migration harness, approved M01-M08, isolated/local execution, focused review, commit/push; no connected-project mutation and no M09/runtime work
- Red evidence: initial focused migration contract run failed 17/17 because all eight approved files were absent
- Green evidence: static migration contracts 12/12; isolated Phase 6-to-M01-M08 execution and database/security behavior 19/19; all migration regressions 26 suites/206 tests; actual Edge Function suites 9/9 and 57/57 tests
- Other validation: `npx tsc --noEmit`, Phase 9 continuity (32 Markdown files/27 required phase files), and `git diff --check` pass
- Harness: `supabase/tests/phase9/phase6_baseline.sql`, `databaseHarness.mjs`, `phase9Database.integration.test.mjs`, and `phase9RequestExpiry.integration.test.mjs` using embedded PGlite; the fixture is an executable Phase 9-relevant snapshot, while the repository ledger check preserves the complete ordered Phase 6 M01-M39 chain
- Coverage: ordered schema/FKs, aliases/providers, capabilities, private grants/named boundaries, cross-store/initiator denial, claim/lease/retry/dead-letter, concurrent cost uniqueness, commit/publication separation, condition/damage, quantity buckets with the existing NOT VALID constraint untouched, media/Storage, store grouping, and request-photo persistence
- Exact-project verification: strictly read-only schema/status evidence reconciled live Phase 6 column and hold-contract names with the fixture and M01-M08 after review exposed a fidelity risk
- Supabase/external mutations: none; the connected project was queried read-only and was not mutated
- Legacy advisor evidence: RLS remains disabled on `public.spatial_ref_sys`, `public.marketplace_event_schema_registry`, and `public.marketplace_notification_type_registry`; this pre-existing backlog is not a Phase 9 M01-M08 blocker and was not remediated here
- Independent review: initial focused verdict required corrections; correction-only follow-ups ended with exact verdict `approved`. No reviewer edits or Supabase access occurred.
- Review corrections: atomic C03; exact Owner and private/worker boundaries; race-safe command fingerprints; claimed store/entity/intent-bound C12/C27/C29; reviewed-only commit; single-media validation; truthful pending/provided progression; soft-hold refresh/accept/expiry; policy-preserving Storage changes; stable cursors; and alias store consistency
- Remaining gate: exact-project M01-M08 live preflight/application requires separate authorization and fresh readback; M09 remains a distinct, separately reviewed live-data gate

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
### 2026-07-27/28 — Unit 4B provider-attempt persistence correction and M14 application
- Authorized scope/completion/evidence: correction-only M14 plus claim-aware Gemini closes durable provider-attempt/reservation/usage/injected-pricing/cost/duplicate-spend lineage and performs full claim/media validation immediately before download and again before Gemini egress. Red failures proved the TOCTOU, claim-dependent spend hash, permissive pricing, and stale migration-set expectation. Stable logical spend identity excludes claim attempt while unique provider-attempt, claim, worker, and lease lineage remain separate; TypeScript and SQL share a bounded semantic pricing allowlist. On 2026-07-28 exact-project preflight confirmed M14 absent, M01-M08/M10-M13 once, M09 absent, and all dependencies; unchanged M14 applied as live version `20260727183546`. Readback proved the empty service-only relation, approved constraints/indexes/signatures/grants/RLS, intact M12/M13 fixture seams, PGlite 67/67, and fixture regression 23/23. No Storage/provider/credential/deployment/product mutation occurred. Gemini deployment/live verification, M09, Unit 5, and broader scope remain unauthorized.
### 2026-07-28 — Unit 5B merge documentation closeout
- Documentation-only closeout followed the independently approved Unit 5B merge `47f23a89a4df9ae8ece85842eb3020c3f17636bc`; only status/routing/handoff/evidence/validator documents changed. Continuity/Markdown links passed (`47`/`34`), traceability was `183` definitions with zero duplicates/missing, and no source/test/migration/credential/provider/deployment/Supabase/Storage/product mutation occurred. Google Books remained fixture/mock-only, M09 absent, and Unit 5C required separate authorization.
### 2026-07-29 — Unit 5C-2 store-scoped variant persistence foundation
- M18 is live once as `20260729004216`; M19 is live once as `20260729020008` and fences changed accepted envelopes. Schema/ACL/RPC plus proposed-only/exact-replay/changed-replay/mismatch/store-scope/rollback-cleanup smoke passed. Final corrected focused Jest passed 15/15, six-suite PGlite passed 74/74, scoped TypeScript passed, and continuity passed 195 definitions/zero duplicates/zero missing; full TypeScript timed out. The exact tree was independently approved, committed/pushed as `b3980349d9d446fbf1820ef869f6664953d9a599`, and fast-forward merged to `main`; M18/M19 are the only Unit 5C-2 database mutations and aliases/product data remain unchanged. Full evidence and the Batch 1 authorization gate are in [tracker 14](./14-unit5c2-variant-persistence-evidence.md).
### 2026-07-29 — Unit 5C-3 runtime generation, reconciliation, and lifecycle
- Optional same-call Gemini companion generation, independent fail-closed validation, M18/M19 persistence, confirmed-title/individual-author reconciliation, narrow normalization, material-change classification, default-deny activation, and trusted proposed/active/stale transitions are merged at `f09301b76fb14714f942a98f0ceffa5d5a0c3178`. Deep self-review corrected exact-confirmation removal, JavaScript/SQL symbol normalization, zero-based author indexing, and oversized/rejected fallback coverage. M20 (`20260729054842`) remains immutable applied history; M21 (`20260729060238`) forward-removed its temporary Unit 5C-4 search/materialization effects. Final affected Jest passed 7 suites/101 tests, database integration 12/12, TypeScript with `--allowImportingTsExtensions`, diff/secret/pyc checks, and rollback-only lifecycle smoke with zero residue; live proposal/proposal-set/alias counts were zero. Exact tree `eabe1040b4dbe89cf5163754fd719a11673a8682` received independent verdict `APPROVED`. Full evidence and Unit 5C-4 routing are in [tracker 15](./15-unit5c3-runtime-reconciliation-evidence.md).
### 2026-07-29 — Unit 5C-4 active variant search closeout
- Documentation-only closeout: recorded commit `d092f08`, approved tree `db8ea75`, immutable live M22/M23, implementation verification/security evidence, exclusions, zero external mutation, and the combined Unit 5C-5/5C-6 backend handoff. Full evidence is in [tracker 16](./16-unit5c4-active-variant-search-evidence.md); after this closeout merges, proceed red-first and independently approve the exact staged tree before applying new migrations.
### 2026-07-30 — Unit 5C-5/5C-6 backend closeout
- Exact tree `66db5be740940a8c882bb7ea312817f4c33bb2db` received dual `APPROVED`, M24-M28 applied once to `ahntbtktjjmvfosgkmgn`, and implementation commit `4b667fc6674d606a8f88e2a4ee933d79bf332f53` preserves that tree. Jest 140/140, PGlite 53/53, scoped TypeScript, continuity 195/0/0, security/evidence/rollout checks, and real candidate-first two-connection concurrency passed; all synthetic residue counts are zero. M18-M23 stayed unchanged, M29 is absent, no language/capability is enabled, visual UI remains deferred, and no inventory/publication/commerce behavior was added. Next gate: push and obtain merge authorization; Unit 6 Owner UX remains separately authorized.

### 2026-07-30 — Unit 6 Owner UX design-authority closeout

- Date/session: 2026-07-30 bounded Unit 6 design correction, dual independent review, approval, and continuity closeout
- Authorized work unit and scope: two Unit 6 design documents, documentation-size policy/validator correction, exact-tree reviews, continuity/evidence, Git integration only; no Unit 6 implementation
- Completed: eight exact Owner-safe target contracts; initiator-only queue/session authority; strict review-field and state-presentation matrices; 40 unique acceptance criteria mapped to independent Units 6A-6F; final status `approved_design_authority`
- Files/components/migrations: documentation, continuity validator, and tracker 18 only; no application/Edge/service/hook/component/Supabase-type/application-test/runtime-migration file changed
- Verification actually run: Unit 6 structure PASS (35 sections, 8 operations, 40/40 unique/mapped AC, 6 subunits); continuity PASS (195 definitions, 0 duplicates, 0 missing traceability); 107 semantic negative cases and C12 probes PASS; documentation-size regression PASS; links, scope, and `git diff --check` PASS
- Independent reviews: backend/security final zero blocker/high/medium/low and no implementation-time contract invention; product/UX/recovery/accessibility final zero blocker/high/medium/low and no critical-flow ambiguity
- Supabase/external mutations: none; M24-M28 were already live exactly once before this session; no language is benchmarked, approved, or enabled; no runtime migration or deployment occurred
- Decisions/deviations/risks: line count is advisory; the cohesive main SDD remains authoritative and the supporting matrix owns dense independently reviewable contract/state/acceptance/subunit material; Unit 7 remains separately gated
- Tracker/source-doc updates: ACTIVE, DOC-13, SESSION-START, Phase 9 TRACKER, this tracker, and [tracker 18](./18-unit6-owner-ux-design-evidence.md)
- 2026-07-30 Unit 6A local implementation: contracts/M29 are local and unapplied; Jest 173/173, PGlite 32/32, relevant regressions 50/50, scoped TypeScript, and three deterministic PostgreSQL concurrency passes are recorded in [tracker 19](./19-unit6a-owner-safe-backend-evidence.md). Closure review only is next.
- Next authorized action and gate: **Phase 9 Unit 6A — Owner-safe backend contract foundation** only, red-first in a new implementation session; migration creation/application and deployment require separate authority

### 2026-07-30 — Unit 6B route, query, identity, and cache foundation

- Date/session: 2026-07-30 bounded Unit 6B frontend implementation, combined review, correction, verification, and closeout
- Authorized work unit and scope: T1 frontend/UI foundation only; nested Inventory routes, five Unit 6A read adapters, strict response/request validation, query keys/defaults, user/store identity coordination, access guards, and private-cache cleanup
- Completed: feature commit `9ef9eb3`; all Unit 6B routes are registered and guarded, malformed dynamic parameters fail safely behind the authorization boundary, no mutation/offline queue exists, and the legacy Inventory hub remains visible while discovery is wired
- Verification actually run: 13 existing Jest suites/85 tests pass (12 suites/77 tests in the broad command plus the corrected existing logout path at 1 suite/8 tests); TypeScript passes with `--allowImportingTsExtensions`; bounded Expo web smoke passed for hub, reviews, scan, valid candidate, and malformed-session routes with zero browser console warnings/errors
- Review: the one authorized combined reviewer returned three high and two medium findings; the one authorized correction batch added exact operation-scoped contract/error handling, route-independent serialized identity cleanup, guarded malformed routes, strict unknown-parameter rejection, and hub discovery wiring
- Human spot check: `not_yet_selected_for_human_spot_check`
- Supabase/external mutations: none; no migration, database/storage write, deployment, provider call, or external-service mutation occurred
- Decisions/deviations/risks: no lint script or ESLint configuration exists; authenticated browser logout/store-transition smoke was unavailable without eligible Owner credentials and is covered by deterministic auth/identity/cache tests; Unit 6C-6F and Unit 7 behavior was not introduced
- Tracker/source-doc updates: ACTIVE, DOC-13, SESSION-START, Phase 9 TRACKER, this tracker, and [tracker 20](./20-unit6b-route-query-cache-evidence.md)
- Next authorized action and gate: after the bounded evidence commit and fast-forward merge, **Phase 9 Unit 6C — capture, preview, progress, and recovery UX** only; migration, Supabase/Storage mutation, deployment, Units 6D-6F, and Unit 7 require separate authority

### 2026-07-31 — Unit 6C capture, upload, progress, and recovery UX

- Date/session: 2026-07-30/31 bounded Unit 6C frontend implementation, two-slice review, one original correction batch, one explicitly authorized narrow registration-replay correction, verification, browser smoke, and closeout
- Authorized work unit and scope: Unit 6C only; AC06, AC07, AC10-AC14, AC16, and AC28 capture/setup/preview/upload/progress/recovery behavior under the approved Unit 6 SDD and contract matrix
- Completed: implementation commit `b87469d` and evidence commit `092562d` are fast-forward merged on `main`; Inventory Start/Resume, scan workflow context, fixed-default setup, camera/gallery intake, local validation, cancellable signed transport, explicit byte-versus-registration state, same-command registration replay, bounded capability reuse/renewal, progress polling, recovery states, terminal handoff, and repeatable identity cleanup
- Verification actually run: original corrected Unit 6C plus affected Unit 6B/auth set 111/111; final narrow affected/regression command 9 suites/56 tests; TypeScript with `--allowImportingTsExtensions`; exact Inventory route 1/1; Expo config resolution; `git diff --check`; bounded Expo web compiled 2,216 modules with zero console errors
- Review: combined product/technical and narrow sensitive-slice review informed the original correction; sensitive closure `CLOSED`; product closure reported one new critical ambiguous-registration replay defect; work paused until explicit authorization; one narrow correction followed by the permitted diff-only closure returned `CLOSED`
- Browser/native limits: supplied local login succeeded but had no Active Store Owner membership; authorization-first privacy passed for hub/setup/preview/progress/malformed routes; native camera/gallery, real upload, Owner-only state progression, and browser logout completion were not claimed; deterministic suites cover those transitions
- Human spot check: `not_yet_selected_for_human_spot_check`
- Supabase/external mutations: none; no migration, database/Storage write, live upload, deployment, provider call, backend mutation, inventory/publication, commerce, Unit 6D-6F, or Unit 7 behavior
- Decisions/deviations/risks: requested Luna-medium reviewer was unavailable in the selectable runtime, so the existing in-app browser mechanism performed the bounded smoke; existing framework/config warnings were unrelated to Unit 6C; no lint configuration exists
- Tracker/source-doc updates: ACTIVE, DOC-13, Phase 9 README/SESSION-START/TRACKER, this implementation tracker, and [tracker 21](./21-unit6c-capture-upload-recovery-evidence.md)
- Next authorized action and gate: obtain separate authorization before beginning Phase 9 Unit 6D; migrations, Supabase/Storage mutation, deployment, Units 6E-6F, and Unit 7 remain separately gated

### 2026-07-31 — Unit 6D Owner candidate review and strict editing

- Date/session: 2026-07-31 resumed bounded Unit 6D implementation, retained-cache correction, focused verification, final narrow closure, browser smoke, and closeout
- Authorized work unit and scope: Unit 6D only; Owner candidate list/review, strict edits, condition/damage/sellability policy, stale/offline/conflict behavior, dirty navigation, and identity cleanup under the approved Unit 6 SDD and contract matrix
- Completed: implementation commit `c363b60`; strict typed query/mutation contracts, candidate pagination/review surfaces, deterministic form normalization/validation, evidence display, authoritative refresh checks, conflict recovery, explicit unsafe/unsellable/private mould/contamination mapping, and keyed identity scope
- Verification actually run: correction red tests failed for the intended retained-cache authority gap; corrected candidate suite 14/14; focused Unit 6D/affected Unit 6B/auth set 11 suites/98 tests; TypeScript with `--allowImportingTsExtensions`; `git diff --check`; bounded Expo web compiled 2,224 modules with zero browser console errors
- Review: original product/technical and sensitive-slice reviews drove one correction batch; retained TanStack cached data on failed refetch then required one explicitly authorized narrow correction; the final diff-only sensitive closure returned `CLOSED` with all four questions closed and no blocker/high finding
- Browser/native limits: supplied development identity had no Active Store Owner membership; authorization-first privacy passed for list, valid detail, malformed detail, and inventory routes; strict form/save/conflict/logout states were not claimed from browser interaction and remain deterministic-test evidence
- Human spot check: `not_yet_selected_for_human_spot_check`
- Supabase/external mutations: none; no migration, database/Storage write, deployment, provider call, backend mutation, inventory commit/publication, commerce, Unit 6E-6F, or Unit 7 behavior
- Decisions/deviations/risks: full repository Jest was not rerun after its earlier timeout and is not claimed; focused verification is authoritative for this bounded resume; UTF-16/code-point length parity remains an upstream contract discrepancy and no new behavior was originated
- Tracker/source-doc updates: ACTIVE, DOC-13, Phase 9 README/SESSION-START/TRACKER, this implementation tracker, continuity validator, and [tracker 22](./22-unit6d-candidate-review-evidence.md)
- Next authorized action and gate: obtain separate authorization before beginning Phase 9 Unit 6E; migrations, Supabase/Storage mutation, deployment, Unit 6F, and Unit 7 remain separately gated

### 2026-08-01 — Unit 6E false/missed-variant correction finalization

- Date/session: 2026-08-01 bounded Unit 6E finalization after successful diff-only closure
- Authorized work unit and scope: Unit 6E false/missed-variant corrections only; M30 exact application, narrow remote readback, bounded authenticated browser smoke, evidence/continuity closeout, and Git merge gate under the approved Unit 6 SDD, contract matrix, Owner review SDD, media/security SDD, and tracker 18
- Completed: correction checkpoint `8bceab260a953b4d832fd55f34f58db12fa009b1` was frozen and uncontaminated; M30 `20260801000030_marketplace_phase9_unit6e_review_corrections.sql` was applied exactly once after exact-project M29 preflight; remote function definitions preserve owners, ACLs, `SECURITY DEFINER`/invoker posture, and blank `search_path`; U6Q05 proposal IDs/versions, stale `open_variant_review`, and zero-based author positions are present in the checked-in correction; no broad review was reopened
- Verification actually run: focused Unit 6E/affected Unit 6B/auth/access command 12 suites/95 tests; remote-backed integration 3/3; TypeScript `--noEmit --allowImportingTsExtensions`; continuity `REQUIREMENT_DEFINITIONS=195`, duplicate/missing traceability `0/0`, regression probes PASS, required files PASS; `git diff --check`, cached diff check, and `.pyc` count `0`
- Remote/browser evidence: exact project `ahntbtktjjmvfosgkmgn` remained `ACTIVE_HEALTHY`; M30 appeared once as `20260801093048` with no later migration; read-only candidate/proposal counts and helper/RPC checks passed, including expected `P9_OWNER_NOT_AUTHORIZED`; the supplied local test account authenticated through `/library`, `/profile`, `/status`, and `/inventory`, where the Store Owner application remained under review and private scan data was withheld; no Unit 6E mutation was attempted
- Decisions/deviations/risks: browser console showed pre-existing/framework warnings plus an invalid-refresh-token recovery error and no Unit 6E action; the account lacked Active Store Owner membership, so Owner false/missed-variant mutation UI, native device behavior, and positive owner-write smoke remain unclaimed; no Storage/provider/deployment/inventory/publication/commerce behavior was introduced
- Tracker/source-doc updates: ACTIVE, DOC-13, Phase 9 README/SESSION-START/TRACKER, this implementation tracker, continuity validator, and [tracker 23](./23-unit6e-review-corrections-evidence.md)
- Next authorized action and gate: obtain separate authorization before beginning Phase 9 Unit 6F; do not begin Unit 7, apply another migration, deploy, or mutate inventory/publication/commerce

### 2026-08-02 — Unit 6F browser verification and native-gate handoff

- Date/session: 2026-08-02 bounded authenticated browser verification and quality-gate closeout
- Authorized work unit and scope: Unit 6F readiness/offline/privacy/accessibility/telemetry/Unit 7 noninterference verification; exact-project preflight; disposable Review Save and Close probes; evidence and continuity updates. No product-code, migration, deployment, provider, Storage, inventory, listing, publication, or commerce change was authorized or made.
- Completed: local Expo web reached the Owner inventory/session routes; normal Review Save persisted one canonical version; the stale transition completed before navigation without stale synchronization; confirmation dialog safeguards and exact `Confirming…` were observed; one Close produced a closed session with retained staged candidates and zero committed items; narrow 360×800 Summary reflow was observed. Detailed live/readback evidence is [tracker 24](./24-unit6f-readiness-quality-gates-evidence.md).
- Files/components/migrations: documentation/evidence only; no migration created or applied; implementation under test was `bdb85b6` → `237393b` → `a0d55b5`.
- Verification actually run: Unit 6D–6F/image-inventory/auth/privacy/Unit 7 focused Jest 22 suites/155 tests passed; auth/owner/identity/access Jest 15 suites/114 tests passed; app auth/Store Owner route tests 5 suites/11 tests passed via `--runTestsByPath`; TypeScript passed; continuity passed with 195 definitions, zero duplicate/missing traceability, 48 required phase files before this evidence addition; `.pyc` count `0`; native/device gate not run.
- Supabase/external mutations: exact project `ahntbtktjjmvfosgkmgn` and expected Owner/store were verified read-only. Two disposable `U6C01` Save probes and one `U6C02` Close were authorized and read back; target store inventory/listings remained `0/0`, all candidates remained uncommitted, and no migration, Storage, provider, deployment, publication, or commerce mutation occurred. Pre-existing RLS-disabled advisor tables were not remediated.
- Decisions/deviations/risks: verdict is `USER_ACTION_REQUIRED_NATIVE_EVIDENCE` because Unit 6 SDD §§24, 28, and 34 and matrix U6-AC36/U6-AC39 require representative low-end Android evidence. Live offline/reconnect request-count behavior, native accessibility/large-text, and native performance remain unclaimed. The Owner operation lifecycle-composition risk and no-consolidation decision gate are recorded in the Phase 9 tracker and tracker 24; Unit 7 remains gated.
- Tracker/source-doc updates: [tracker 24](./24-unit6f-readiness-quality-gates-evidence.md), Phase 9 TRACKER, README, SESSION-START, ACTIVE, DOC-13, this implementation tracker, and the continuity validator routing/status checks.
- Next authorized action and gate: obtain representative low-end Android evidence for camera/gallery/recovery, 15-card responsiveness, offline/reconnect, accessibility/large-text, and performance; then rerun the final quality/continuity/merge review. Do not merge Unit 6F, begin Unit 7, apply another migration, deploy, or mutate inventory/publication/commerce before that gate.

### 2026-08-03 â€” Local web runtime, route-warning correction, and ACL explanation

- Date/session: 2026-08-03 bounded local web build/runtime verification and
  independent Store Owner route-warning correction
- Authorized work unit and scope: user-requested app build check, explanation
  of the observed `store_inventory` permission error, and correction of the
  Expo Router `orders` warning; no database or Phase 9 migration work
- Completed: changed `Tabs.Screen name="orders"` to the concrete
  `orders/index` route and added a regression assertion. The authenticated
  Codex in-app browser reached `/library`, `/dashboard`, and `/inventory`.
- Files/components: `app/(store-owner)/_layout.tsx`, its route test, and
  read-only documentation/evidence updates; no migration or external service
  write
- Verification actually run: route test 3/3; `npm.cmd run export:web` passed
  with 2,245 modules; authenticated browser console had no errors. The export
  and browser emitted only existing framework/style/notifications/Sentry/build
  warnings.
- Supabase/external mutations: exact project read-only ACL/function checks
  only; no database, Storage, migration, deployment, inventory, listing,
  publication, or commerce mutation
- Decision/deviation/risk: direct legacy `.from('store_inventory')` calls
  remain incompatible with the live authenticated table ACL; the hook hides
  the read failure. Do not grant broad table access. A separately authorized
  controlled service-boundary remediation is still required. The next Phase 9
  action remains representative SDK54 Android evidence.

### 2026-08-02 — Expo Go SDK54 runtime compatibility remediation

- Date/session: 2026-08-02 bounded runtime diagnosis and Expo Go compatibility fix after the supplied Android call stack
- Authorized work unit and scope: restore the SDK54 mobile prerequisite without changing Unit 6F product behavior, acceptance criteria, schema, migration, deployment, or native-gate authority
- Completed: confirmed the device client was Expo Go SDK56 while the project is SDK54; removed the Expo Go-incompatible `react-native-mmkv@4.1.0`/NitroModules dependency; replaced the Supabase/auth storage adapter with the already-installed AsyncStorage boundary; made the pending-logout marker check asynchronous; restarted Metro with a clean cache and explicit LAN host
- Files/components/migrations: `src/lib/storage.ts`, `src/lib/mmkv.ts` removed, `src/lib/supabase.ts`, `src/features/auth/services/authStorage.ts`, `src/application/auth/authBootstrap.ts`, affected auth/Supabase tests, `package.json`, and `package-lock.json`; no migration created or applied
- Verification actually run: Expo Doctor `18/18`; TypeScript `npx.cmd tsc --noEmit --allowImportingTsExtensions`; focused auth/storage/Supabase Jest `3 suites, 16/16`; Android bundle HTTP `200` with no `react-native-mmkv` reference; `git diff --check`
- Supabase/external mutations: none; no database, Storage, provider, deployment, inventory, listing, publication, commerce, or migration mutation occurred
- Decisions/deviations/risks: SDK54 remains authoritative for this project; stock SDK56 Expo Go remains incompatible, so the native gate is still unclaimed until the SDK54 client is installed and the required representative Android evidence is run
- Tracker/source-doc updates: [tracker 24](./24-unit6f-readiness-quality-gates-evidence.md) and this implementation tracker
- Next authorized action and gate: install Expo Go SDK54 on the Android device, reopen `exp://192.168.31.183:8083`, then obtain the representative low-end Android Unit 6F evidence; do not merge Unit 6F, begin Unit 7, apply another migration, or deploy before that gate

### 2026-08-03 — WU1 controlled Owner-inventory read boundary

- Authorized scope: user-authorized WU1 only; documentation/addendum, red tests,
  unapplied forward migration draft, and local/static validation. WU1 is
  explicitly sequenced before the Unit 6F native gate.
- Completed: added the [WU1 contract addendum](../work-units/owner-inventory-read-boundary-wu1-sdd.md), preserved the stable `phase9_owner_inventory(uuid)` detail RPC, specified the separate signed/keyset list RPC, and created only `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`.
- Verification actually run: red-first static contract suite failed before the
  WU1 files existed; after the draft was created, the focused Jest suite passed
  6/6 and the local PGlite parse/readback test passed 1/1. `git diff --check`
  and the Phase 9 continuity validator remain part of closeout.
- Supabase evidence/mutations: exact development project
  `ahntbtktjjmvfosgkmgn` was re-verified read-only; live migration history still
  ends at M30. No migration was applied and no database, Storage, deployment,
  route, screen, hook, service, Edge, dashboard, inventory, listing, or
  publication behavior was changed.
- Decision: `phase9_owner_inventory(uuid)` remains intact; list behavior is a
  separate RPC with server-derived store scope, page-size bounds, exact DTO
  allowlists, filters, signed context-bound cursor, and
  `(updated_at DESC, id DESC)` keyset ordering. The next action requires a
  separate review/approval before applying the draft; Unit 6F native evidence
  remains after this WU1 gate.

### 2026-08-04 — WU1 post-review correction pass

- Authorized scope: correct only the reviewed WU1 boundary findings in the local
  addendum, unapplied migration draft, regression tests, continuity validator,
  and evidence/traceability documents. No client, UI, legacy-caller, write-path,
  live database, or external-service change was authorized.
- Completed: explicit NULL page-size rejection; outer safe mapping of unexpected
  SQL failures to `P9_INTERNAL_ERROR`; explicit ordering-horizon/asOf semantics
  that do not claim a repeatable database snapshot; and WU1 artifact/invariant
  checks in the continuity validator.
- Verification actually run: correction red-first run reproduced 3 failures;
  focused WU1 Jest passed 9/9; PGlite parse/readback passed 1/1; continuity
  passed with 65 Markdown files and 51 required phase files; final
  `git diff --check` passed.
- Supabase/external mutations: none. The exact development project remains
  read-only for this correction; M30 is still the live migration tail and WU1
  remains unapplied.
- Decision/deviation: full cross-page state consistency would require a
  separate write-boundary/version decision; WU1 does not add a trigger or alter
  quantity/publication commands. Independent review is required before any
  application approval.

### 2026-08-04 — WU1 correction closure: cursor errors, local behavior, and continuity gate

- Date/session: 2026-08-04 bounded follow-up correction after independent WU1 review
- Authorized work unit and scope: WU1 only — narrow cursor exception handling, local executable behavior coverage, `asOf`/`id` contract wording, continuity test/boundary enforcement, and separated diff reporting. No client, UI, legacy-caller, write-path, live database, or external-service change was authorized.
- Completed: helper failures now reach the outer `P9_INTERNAL_ERROR` mapping; only invalid timestamp/UUID decoding is converted to `P9_CURSOR_INVALID`; the WU1 PGlite test covers equal-timestamp keyset pagination, filters, empty results, invalid page size/cursor, Owner/anonymous scope, and unexpected helper failure; the validator requires both WU1 test harnesses, explicit no-application/no-client/no-write boundary receipts, the stable-detail/direct-table/policy boundary, and separate WU1/repository diff signals; the SDD now consistently defines `asOf` as an ordering horizon and uses `id` for the tie-breaker.
- Files/components/migrations: WU1 addendum, WU1 evidence, continuity validator, unapplied `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`, focused static Jest test, and local PGlite integration test. The stable detail RPC and all client/write paths remain unchanged.
- Verification actually run: correction red runs reproduced the intended static and runtime failures; focused Jest `marketplacePhase9OwnerInventoryReadBoundary.test.ts` **10/10**; PGlite `phase9OwnerInventoryReadBoundary.integration.test.mjs` **3/3**; continuity `WU1_DIFF_CHECK=PASS`, `REPOSITORY_DIFF_CHECK=PASS`, `PHASE9_CONTINUITY_CHECK=PASS`, `MARKDOWN_FILES_CHECKED=65`, `REQUIRED_PHASE_FILES=51`; no Python tests were run.
- Supabase/external mutations: none. No new live Supabase readback was required for this local-only correction; the recorded exact development project remains at M30 and WU1 remains unapplied.
- Decisions/deviations/risks: the PGlite harness required local-only compatibility columns for live inventory fields absent from its compact Phase 6 baseline; this is test-fixture setup, not a migration change. Remote JWT/RLS, exact-project ACL, positive Owner read, concurrency, and post-application runtime verification remain unclaimed.
- Tracker/source-doc updates: Phase 9 TRACKER, WU1 SDD, WU1 evidence, continuity validator, and this implementation tracker.
- Next authorized action and gate: obtain independent review of the corrected WU1 draft and runtime-test plan; then perform exact-project read-only preflight and obtain separate migration-application approval. Do not apply the draft in this handoff.

### 2026-08-04 — WU1 exact-project application and readback

- Date/session: 2026-08-04 bounded WU1 application, post-application readback,
  anonymous denial check, and evidence closeout.
- Authorized work unit and scope: WU1 only against development project
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`; no production, client,
  dashboard, legacy-caller, write-path, Storage, provider, or fixture mutation.
- Completed: exact local migration `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`
  applied exactly once through Supabase MCP; live version
  `20260803221216 marketplace_phase9_owner_inventory_read_boundary`.
- Verification actually run: preflight confirmed healthy exact project, M30
  tail, absent WU1 objects, stable detail RPC, table schema/constraints/
  indexes/RLS/policies/ACL, cursor/Owner helpers, and projection trigger.
  Post-readback confirmed the exact eight-argument `jsonb` RPC, `STABLE
  SECURITY DEFINER`, postgres owner, empty `search_path`, narrow ACLs, exact
  `(store_id, updated_at DESC, id DESC)` index, unchanged detail RPC, and
  unchanged table/trigger boundaries. Anonymous REST returned HTTP 401.
  Focused Jest 10/10, PGlite 3/3, continuity, and diff checks passed before
  application.
- Supabase/external mutations: one approved migration application only; no
  rows, users, fixtures, listings, publications, Storage objects, providers,
  deployments, or other external services were mutated. Regular index creation
  completed successfully.
- Decisions/deviations/risks: pre-existing anonymous table-DML ACL entries
  remain outside WU1; RLS has no anonymous policies and WU1 did not alter that
  drift. Positive Owner/cross-store/inactive-owner/filter/cursor-context/live-
  DTO/authenticated-table runtime remains deferred because no approved Owner
  JWT or active Owner browser session was available.
- Tracker/source-doc updates: WU1 SDD/evidence, Phase 9 TRACKER, README,
  SESSION-START, ACTIVE, DOC-13, current-vs-target audit, continuity validator,
  and this implementation tracker.
- Next authorized action and gate: obtain an approved Owner JWT for the
  deferred runtime matrix, then resume representative low-end Android Unit 6F
  evidence; do not cut over legacy callers, begin Unit 7, or apply another
  migration without separate authorization.

### 2026-08-04 — WU2 read-only Owner inventory client integration

- Scope: WU2 only. The active Owner `/inventory` route, canonical read service,
  strict decoder, infinite-query cache/pagination layer, exact filter/search
  UI, tests, and continuity documentation. No dashboard, write, Unit 7,
  deployment, migration, or stale-code deletion was authorized.
- Implemented: the route reaches `OwnerInventoryReadScreen`,
  `useOwnerInventoryRead`, and `phase9_owner_inventory_page_v1`; no client
  store authority is sent. Exact response keys/types/enums are validated,
  cursors remain opaque, filter/search changes and refresh restart page one,
  IDs are de-duplicated first-seen, and cache keys isolate identity, store,
  contract, and filters.
- UI states: initial loading, successful empty, unauthorized, invalid
  request/cursor, unavailable/internal, refresh failure, and partial next-page
  failure are distinct while already loaded rows remain visible.
- Verification actually run: red-first WU2 tests failed before implementation;
  after correction-review closure focused Jest **4 suites/50 tests**
  passed; related image-inventory, legacy regression, and route Jest **39
  suites/303 tests** passed; `npx.cmd tsc
  --noEmit --allowImportingTsExtensions` passed. Jest printed its known
  post-run open-handle warning; the broad run also printed pre-existing
  CandidateReview `act(...)` warnings.
- Supabase/external mutations: none. Read-only exact-project verification
  confirmed WU1 function signature/defaults, security/owner/search path,
  grants, detail RPC, and owner-page index. No database/storage row, migration,
  Edge Function, provider, deployment, commit, push, or staging action occurred.
- Evidence: [WU2 addendum](../work-units/owner-inventory-read-client-wu2-sdd.md)
  and [tracker 26](./26-owner-inventory-read-client-wu2-evidence.md).
- Next authorized action and gate: obtain an approved development Owner session
  for the deferred WU1/WU2 runtime matrix, then resume representative low-end
  Android Unit 6F evidence. Dashboard remediation and Unit 7 remain gated.

### 2026-08-04 — WU2 independent-review corrections

- Review verdict: `changes_requested` for permissive timestamp/version
  decoding, destructive failed refresh, and conflated error/operation states;
  one P3 architecture-test hardening note was non-blocking.
- Red-first evidence: three suites failed with eight assertions before the
  correction. Added cases reject date-only/non-ISO-offset timestamps and zero
  versions, preserve loaded rows on failed first-page refresh, and distinguish
  request, cursor, unavailable, internal/malformed, refresh, and next-page UI.
- Implementation: shared offset-aware timestamp schema plus positive version;
  separately cancellable first-page refresh cache swapped only on success;
  destructive reset retained only for invalid-cursor recovery; category- and
  operation-specific safe copy/actions.
- Verification: focused WU2 **4 suites/45 tests**, related regressions **39
  suites/298 tests**, and TypeScript passed. Jest's known post-run lifecycle
  warning and pre-existing CandidateReview `act(...)` warnings remain.
- Mutations/scope: no Supabase/database/Storage, migration, deployment,
  dashboard, write-path, Unit 7, staging, commit, or push action. Authenticated
  Owner runtime remains deferred; P3 architecture hardening remains optional.

### 2026-08-04 — WU2 second correction-review closure

- Findings: failed refresh could recommit cached first-page data and drop later
  pages; post-await cache swap lacked an explicit current-scope fence;
  unauthorized initial/partial errors offered retry; refresh error after an
  empty success rendered contradictory empty and error states.
- Red-first evidence: query/screen suites failed with four assertions. The
  stale-identity test already passed through observer cancellation, so the
  production correction adds a defense-in-depth scope/request-generation fence.
- Corrected: only explicit successful current-generation refreshes atomically
  replace pages; filter/identity/unmount/newer refresh fences stale completion;
  unauthorized states omit actions; refresh error excludes successful empty.
- Verification: focused **4 suites/50 tests**, related **39 suites/303 tests**,
  TypeScript, continuity, and diff hygiene passed. Known Jest lifecycle and
  CandidateReview warnings remain; no external or database mutation occurred.

### 2026-08-04 — WU2 focused correction-review closure

- Remaining finding: the header Refresh button bypassed the unauthorized card's
  no-action boundary in both initial and partial states.
- Red/green: two assertions failed before correction; screen 15/15, focused
  4 suites/50 tests, related 39 suites/303 tests, and TypeScript passed after.
- Correction/scope: header refresh is omitted for unauthorized category only;
  no transport, cache, route, write, database, dashboard, Unit 7, deployment,
  staging, commit, or push behavior changed.

### 2026-08-04 — CAP-01/CAP-02 capture-to-Preview handoff correction

- Authorized work unit and scope: local capture selection handoff only; no
  upload/registration/process/session close, migration, dashboard, WU2,
  transport, or Unit 7 change.
- Root cause and correction: Preview's unmount cleanup cleared provider-held
  media during the real Stack/access-boundary transition. Cleanup now cancels
  local upload work without clearing selection; explicit successful upload and
  reselect paths still clear it.
- Files/components: `CaptureScreens.tsx`, `CaptureScreens.test.tsx`, and the
  real-provider/navigation regression `CaptureWorkflowNavigation.test.tsx`.
- Verification actually run: red-first lifecycle reproduction; focused
  capture/provider/navigation **9 suites/46 tests**; TypeScript
  `npx.cmd tsc --noEmit --allowImportingTsExtensions`; `git diff --check`;
  `.pyc` count `0`; local browser Preview/Back/reselect/Choose another/picker
  cancel with zero browser errors.
- Supabase/external mutation note: browser reaching Preview used the existing
  `start_session` handoff and created one disposable session
  (`97925897-56dd-47dc-bf33-24ae4fdf2f10`), left open because the requested
  stop point was Preview. Upload was not pressed, and no registration,
  processing, save, close, migration, Storage, inventory, listing, deployment,
  staging, commit, or push occurred.
- Limits: web evidence only; no native claim. Existing Unit 6F Android gate
  and WU1/WU2 authenticated runtime gate remain unchanged.

### 2026-08-04 — post-registration Preview flash correction

- Authorized scope: bounded successful upload-to-progress handoff timing only.
- Root cause: clearing the provider selection while Preview remained mounted
  exposed the unavailable-media branch during successful registration; even
  after moving clear after `router.replace`, Expo Router queues that replace
  and can still render Preview once before dispatch.
- Correction: preserve the invalidations, mark successful navigation intent,
  recheck generation/identity/authority, and clear provider media only from
  Preview cleanup after the destination route unmounts. No transport,
  registration contract, session, database, Storage, dashboard, WU2, Unit 7,
  or native behavior was broadened.
- Verification: red/green real-provider/router render-history test; focused
  capture/provider/navigation 9 suites/48 tests; TypeScript; `git diff --check`;
  `.pyc` count 0. Browser/native rerun for this timing correction remains
  unclaimed.

### 2026-08-05 — Android 11 observation and browser follow-up

- User-reported context: Android 11; large-text use is reported accessible and
  the native camera is reported connected. No device model, font-scale value,
  performance trace, offline/reconnect receipt, or screen-by-screen evidence
  was supplied, so this is not a native-gate pass.
- Code trace: capture setup checks and requests camera/gallery permission before
  opening the OS source; permanent denial exposes settings guidance; the Expo
  image-picker configuration blocks microphone permission.
- Browser follow-up: authenticated Owner read/filter/search/review/Resume,
  sanitized fixture upload, disposable Review Save, logout/re-authentication,
  and unavailable-session Retry completed with zero browser errors. The tested
  disposable session remained active with four images processing, so Close was
  unavailable. Separate cross-store/inactive-Owner fixtures were unavailable.
- Scope/mutations: this documentation checkpoint changed no product code,
  database, migration, Storage, deployment, commit, push, or Unit 7 behavior.
- Decision/deviation: record large text as user-confirmed observation, but keep
  the formal Unit 6F native gate and WU1/WU2 denial matrix deferred. The
  dropdown UX request remains a later non-gating improvement.
- Tracker/source-doc updates: tracker 24 and the Phase 9 master tracker are
  updated with the same evidence classification; global status remains
  `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`.
- Next authorized action and gate: obtain the missing representative Android
  evidence required by the Unit 6 SDD, then rerun continuity/quality review
  before closing Unit 6F or starting Unit 7.

### 2026-08-05 — 15-card and Gemini fixture clarification

- Code trace: the image-inventory UI consumes decoded Owner candidate DTOs and
  does not invoke Gemini directly. Gemini/provider configuration, deployment,
  and live-call verification remain separately deferred.
- The fifteen-candidate UI requirement is covered without Gemini by deterministic
  `ownerUxTestFixtures.ts` DTOs. `CandidateReviewScreens.test.tsx` renders
  fifteen ordered candidates with an independent partial failure, while
  `CaptureProgressScreens.test.tsx` covers the over-fifteen safeguard.
- Verification actually run: the two focused suites passed **20/20 tests**;
  existing `act(...)` warnings were non-failing. No product code, provider,
  database, Storage, migration, deployment, commit, or push mutation occurred.
- Decision/limitation: the fixture-backed UI/contract check is complete, but it
  does not claim live Gemini output, a fifteen-card browser session, or native
  device responsiveness/memory. Unit 6F remains open under
  `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`.
- Next authorized action and gate: obtain representative Android evidence for
  camera/gallery/recovery, fifteen fixture-backed cards, three sequential
  captures, offline/reconnect, accessibility/large text, performance, and the
  CAP/post-registration reruns; then complete the deferred WU1/WU2 runtime
  cases when approved fixtures exist. Do not start Unit 7 before those gates.

### 2026-08-05 — Unit 4B Gemini Render configuration/startup check

- Authorized scope: server-only Gemini environment activation for the existing
  Render vision worker. No mobile credential, repository secret, database,
  Storage, inventory, publication, or migration behavior was changed.
- Deployment: `phase9-fixture-vision` was manually deployed from remote `main`
  commit `7eaf921efcaefccab4d0189dc26779796f164ed4` after confirming the live
  `96991a9` image did not contain the Gemini adapter. Final deployment
  `dep-d9pdei9t0dsc73ddgbh0` is live; logs show `service_started` and Render's
  successful live status. An initial env-inconsistent attempt failed at startup
  and was corrected before the final deployment.
- Configuration: masked `PHASE9_GEMINI_API_KEY` is present;
  `PHASE9_VISION_ANALYZER_MODE=gemini`, model `gemini-3.5-flash-lite`, and
  timeout `30000` are set; `PHASE9_VISION_FIXTURE_CASE` is removed. The agent
  did not read or log the secret value.
- Verification actually run: deployment/build/startup evidence was read from
  Render. The in-app browser blocked direct public health navigation and the
  local PowerShell/curl probes could not complete TLS, so no independent HTTP
  `/health`/`/ready` receipt is claimed here. Render's live deployment health
  gate passed. No authenticated `/run` or real provider inference was run.
- Next authorized action and gate: revoke/replace the exposed key, then use one
  approved sanitized-media job for a controlled authenticated `/run` provider
  call, verifying M14 attempt registration, egress fences, strict decoding,
  usage/cost lineage, and zero commerce effects. Unit 6F/WU1/WU2 gates remain
  unchanged.

### 2026-08-07 — structural metadata integration implementation

- Authorized scope: vision candidate → durable metadata job → fenced metadata
  worker → provider-neutral routing → immutable outcome → SAME candidate → Owner
  readback. Automatic dispatch, secondary-provider implementation, Unit 7,
  deployment, provider calls, and Supabase application were excluded.
- Completed: local forward M32; atomic one/15-candidate fan-out and enqueue
  rollback; minimum fenced context; usage/failure and physical-provider-call
  RPCs; logical-attempt versus physical-call lineage; replay-safe accepted and
  degraded completion; truthful Owner state; authenticated manual worker; and
  a generic adapter boundary with Google Books contained behind it.
- Verification: central compiled-worker/PGlite seam 1/1; vision/M32 31/31;
  metadata foundation/replay/reclaim 12/12; focused metadata Jest 7 suites/73;
  focused vision Jest 2 suites/29; Owner/WU1/security PGlite 39/39;
  standalone metadata-worker and repository-wide TypeScript; Phase 9 continuity
  validator and `git diff --check`. Isolated Owner inventory architecture and
  service Jest passed 2 suites/23 tests. The grouped Owner inventory command
  timed out twice without output, and the isolated React Query suite also timed
  out before results; those UI/query suites are not claimed as passed. Their
  client files were unchanged by this slice.
- Supabase/external mutations: none. M32 was not applied; no Storage, provider,
  deployment, scheduler, inventory, listing, publication, stage, commit, or push.
- Decision: conceptual failures map only to existing M15 outcomes; no candidate
  or job state was invented. Next is independent review and exact-project
  read-only preflight. Applying M32 requires separate explicit authorization.

### 2026-08-07 — independent-review targeted correction pass

- Corrected semantic identity parity (ISBN, Unicode, language, clues and
  canonical serialization), removed key overwrite, and separated semantic from
  provider-cache identity.
- Corrected durable order to logical attempt/snapshot/candidate/job completion
  before best-effort cache write; mapped adapter outcomes to M15 canonical
  outcomes; resumed terminal logical attempts before egress.
- Added server-derived structural wrappers for lookup/attempt/finalization,
  candidate-version failure fencing, exact vision/result/observation lineage,
  valid M15 cache-entry reuse, explicit physical-call uncertainty and stale
  finalization, and complete service-only ACLs.
- Strengthened trigger negatives, rollback, 15-way fan-out, response-loss,
  reclaim, TOCTOU, cache-hit, ACL, SAME-candidate and zero-commerce tests.
- Current verification: structural seam 2/2; vision/M32 40/40; metadata
  foundation 13/13; focused identity/worker/gateway/composition 40/40;
  deterministic provider/cache 23/23; Owner WU1/WU2 database regressions
  32/32; metadata-worker build passed; continuity validator and diff hygiene
  passed. Root TypeScript failed with TS5097 import-extension configuration.
  Three bounded Owner React Query suites timed out without assertions.
- External mutations: none. M32 remains repository-only and unapplied. No
  Supabase/Storage access, provider call, deploy, automatic dispatch, commerce
  mutation, Unit 7 work, stage, commit, push, merge, reset, or rebase occurred.
- Next authorized action: independent correction-only rereview. Migration
  preflight/application remain separately gated.

### 2026-08-07 — correction-only implementation follow-up

- Red-first evidence reproduced invalid-ISBN strategy divergence, accepted
  payload finalization under storage denial, and malformed provider-result
  acceptance. The corrected focused Jest set passes 46/46.
- M32/runtime now derive ISBN strategy only from a valid normalized ISBN; SQL
  local lookup normalizes ISBN-10/13, NFKC text and BCP47 language; trigger
  provenance joins input/session/store; physical calls retain the minimum
  permitted provider-neutral result for logical response-loss recovery; and
  storage denial records no candidate payload while terminalizing the logical
  attempt/job as `policy_denied`.
- Production gateway coalescing now queries an exact completed
  provider-cache namespace and materializes a zero-charge follower through the
  existing M15 lineage boundary. Secondary eligibility remains metadata only;
  no secondary adapter is selected or invoked.
- Verification actually run: metadata-worker build PASS; structural compiled
  worker/PGlite 8/8 including SQL-backed storage denial, Owner failed-state,
  and physical-commit/logical-response-loss recovery with one provider call;
  SQL-backed cache-write failure and production zero-charge follower
  coalescing; metadata foundation + vision PGlite 53/53; focused Jest 54/54,
  including malformed-job/sibling terminalization isolation. The
  continuity validator PASS (`PHASE9_CONTINUITY_CHECK=PASS`, 67 Markdown files,
  53 required files) and repository diff hygiene PASS.
- External/database mutations: none. M32 remains local and unapplied by
  repository evidence; no remote status assertion, Supabase/Storage/provider,
  deployment, scheduler, inventory/publication, Git stage/commit/push/merge, or
  Unit 7 action occurred.
- Next authorized action: independent correction-only rereview. Exact-project
  preflight and M32 application remain separately gated.

### 2026-08-07 — Luna max correction-only rereview remediation

- The first independent Luna max rereview returned targeted rejection on eight
  bounded defects: storage-denied response-loss recovery, concurrent-miss
  reservation, ISBN precedence, authoritative-result fencing, provider-result
  validation, finalized retryable duplicate egress, sibling failure isolation,
  and invalid-ISBN strategy handling.
- Red-first cases were added before the bounded production corrections. M32 now
  retains the normalized logical result beside physical evidence, reserves one
  in-flight leader under an atomic lock, durably records deferred followers,
  prioritizes exact validated ISBN over title equivalence, and requires an
  accepted authoritative vision result. Runtime validation rejects unknown,
  incomplete, or retry-incoherent provider values; finalized retryable calls
  schedule the existing job without another egress; worker failure reporting
  cannot suppress later claimed siblings.
- Verification actually run after correction: metadata-worker TypeScript build
  PASS; focused metadata Jest 4 suites/54 tests PASS; structural worker/PGlite
  8/8 PASS; metadata foundation plus vision PGlite 53/53 PASS.
- External/database mutations: none. M32 remains local and unapplied; no remote
  readback, Supabase/Storage/provider call, deployment, scheduler, inventory or
  publication mutation, Unit 7 work, Git stage, commit, push, or merge occurred.
- Next authorized action: fresh independent Luna max correction-only closure
  review. Exact-project preflight and M32 application remain separately gated.

### 2026-08-07 — final bounded H1-H3 and E1-E3/F1 correction closure

- Authorized work unit and scope: final repository-only correction pass for H1
  authoritative-result fencing, H2 strict provider parsing, H3 physical-call
  finalization transport loss, and E1-E3/F1 evidence gaps. No new medium/low
  hardening or architectural mechanism was authorized or implemented.
- Completed: physical finalization reuses the full structural authority check;
  normalized provider output is parsed/sanitized against exact top-level and
  complete edition schemas with request/attempt/adapter coherence; and the new
  fenced reconciliation RPC preserves a committed finalization or converts an
  active unconfirmed registered call to payload-free `outcome_unknown`.
- Evidence-only closure: E1 finalized-retryable replay, E2 durable sibling
  isolation, E3 invalid-ISBN worker fallback, and F1 storage-denied retention
  all passed through worker/gateway + PGlite without production corrections.
- Verification actually run: focused Jest 5 suites/75 tests PASS; structural
  metadata worker/PGlite 12/12 PASS; metadata foundation/PGlite 13/13 PASS;
  vision/M32 PGlite 40/40 PASS; metadata-worker TypeScript build PASS. H1, H3,
  E1-E3, F1, malformed-provider, and exhaustive 14-RPC ACL assertions are
  contained in those green suites. Phase 9 continuity PASS (195 requirement
  definitions, zero duplicates, zero missing traceability, 67 Markdown files,
  53 required files) and `git diff --check` PASS.
- Reproducible correction-scope LOC against frozen checkpoint HEAD
  `0c705d421644be3fd27f580abb4ef6080adb8b5c`: production +2,218/-52
  (net +2,166), tests +1,324/-41 (net +1,283). This includes the pre-existing
  uncommitted structural slice in untracked M32/runtime/test files because the
  frozen worktree had no separate VCS boundary for session-only line counting.
- Supabase/external mutations: none. M32 remains repository-only and unapplied;
  no exact-project query, database/Storage write, provider call, deployment,
  scheduler, inventory/publication, Unit 7, stage, commit, push, or merge.
- Decisions/deviations/risks: root TS5097 remains a baseline configuration
  issue and Owner React Query remains timed out/unrelated by dependency trace;
  neither was rerun or debugged. No additional review agent was launched.
- Tracker/source-doc updates: ACTIVE, SESSION-START, master tracker, DOC-13,
  data dictionary, current-vs-target, traceability, and this log now route the
  frozen pass to independent approval rereview.
- Next authorized action and gate: independent approval rereview only. A later
  exact-project read-only preflight requires separate authorization; M32
  application and every external mutation remain unauthorized.

### 2026-08-08 — latest independent-M32-rereview correction pass

- Authorized scope: repository-only correction of H1 candidate-version fencing,
  H2 strict timestamps, H3 reconciliation coverage, and assessment of the
  oversized metadata production gateway. M32 could be edited because it remains
  unapplied; no follow-up migration was created.
- H1 `RESOLVED_BY_PROOF`: the approved Owner review function rejects the
  competing transition while the candidate is `processing`, leaving candidate
  version and state unchanged. The existing claim attempt, worker, token, lease,
  candidate state, and accepted vision lineage are the physical authority fence;
  no M32 physical-call schema/runtime mapping change was required.
- H2 resolved: `requiredIsoTimestamp` centralizes the pre-existing vision
  timestamp contract and is used by vision, metadata edition, metadata adapter
  result, and automated-alias boundaries. Tests reject date-only, no-offset, and
  malformed timestamps while accepting `Z` and explicit offsets.
- H3 resolved by direct regression evidence without production reconciliation
  changes: repeated identical reconciliation, a registered physical call across
  reclaim, idempotent reuse of known finalized evidence, and post-reclaim stale
  finalization rejection with no newer physical/logical/candidate/job/snapshot
  overwrite.
- Gateway-size LOW intentionally deferred. The class coordinates stateful
  lookup, physical-call, and completion sequencing; a correction-pass split
  would add callback/state indirection without a behavior-owning module boundary.
- Verification actually run so far: focused provider/identity/gateway/worker
  Jest 7 suites/97 tests PASS; structural metadata PGlite 14/14 PASS; metadata
  foundation PGlite 13/13 PASS; vision/M32 PGlite 40/40 PASS. Metadata-worker
  TypeScript build PASS; Phase 9 continuity PASS (195 requirement definitions,
  zero duplicates, zero missing traceability, 67 Markdown files, 53 required
  files); `git diff --check` PASS.
- External/database mutations: none. M32 remains repository-only and unapplied;
  no Supabase/Storage/provider access, deployment, scheduler/dispatch,
  secondary-provider selection, inventory/publication effect, Unit 7, stage,
  commit, push, merge, reset, or rebase occurred.
- Independent narrow correction-only rereview: a fresh context-isolated,
  read-only reviewer returned `APPROVED` after reviewing only H1/H2/H3 and the
  gateway-size disposition. No edits or external/Git mutation occurred.
- Next authorized action: final approval rereview of the frozen narrow diff.
  Exact-project preflight and M32 application remain separately gated.

### 2026-08-08 — controlled live metadata proof

- Date/session: 2026-08-08 bounded exact-project Phase 9 metadata-runtime proof.
- Authorized work unit and scope: verify the development project, inspect the
  checked-out Google Books adapter/worker, configure one minimum provider row,
  smoke the local worker without provider egress, and create one fresh candidate
  only after the real-provider prerequisites passed. Historical candidates,
  manually-created metadata jobs, M33, scheduler/automatic dispatch, inventory,
  listings, publication, Unit 7, Git operations, and `docs/codemap/` were excluded.
- Completed: exact-project readback confirmed `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`, M32 live exactly once as
  `20260808020404`. Exactly one `google_books` metadata registry row was inserted
  with adapter `1.0.0`, enabled/matching/storage allowed, 86,400-second
  revalidation, policy 1, and public display/image cache disabled.
- Files/components/migrations: no source or migration file changed. The checked-out
  metadata worker, environment loader, Google Books adapter, M32 migration, and
  relevant Phase 9 SDD/supporting documents were inspected. Metadata-worker
  TypeScript build passed.
- Verification actually run: Supabase MCP project/migration/table readback;
  M32 trigger/function/ACL/RLS readback; cron-command inspection; provider-row
  readback; zero-effect pipeline/isolation counts; and local credential-presence
  checks without printing secret values. The local worker smoke could not start
  safely because its service credential targets a different Supabase host and the
  Google Books credential is missing. No fresh candidate was created.
- Supabase/external mutations: one provider-registry row only. No candidate,
  session/input, metadata job/lookup/attempt/provider-call/snapshot/cache/usage
  row, Storage object, provider request, deployment, scheduler, inventory,
  listing, publication, or Unit 7 mutation occurred. No migration was applied by
  this session, and no Git stage/commit/push/reset/rebase/stash occurred.
- Decisions/deviations/risks: verdict is
  `LIVE_METADATA_RUNTIME_BLOCKED_BEFORE_PROVIDER_EGRESS`. `GOOGLE_BOOKS_CREDENTIAL`
  is missing. A service credential exists locally but is for a different Supabase
  host, so it is not authoritative for `ahntbtktjjmvfosgkmgn`. The pre-existing
  Supabase RLS-disabled advisor finding for `spatial_ref_sys`,
  `marketplace_event_schema_registry`, and `marketplace_notification_type_registry`
  was observed and intentionally not changed.
- Tracker/source-doc updates: ACTIVE, SESSION-START, DOC-13, the Phase 9 master
  tracker, this implementation tracker, and the current-vs-target audit record
  the live M32/registry state and credential blocker. `docs/codemap/` was not
  inspected or modified.
- Next authorized action and gate: configure the exact target-project service
  credential and Google Books credential through the approved secret mechanism,
  verify them without printing values, then rerun this one-candidate proof. Do not
  create a candidate before the real worker can safely connect.

### 2026-08-08 - Phase 0 credential inventory rerun

- Authorized scope: inspect the source-defined Supabase, Gemini, and Google
  Books runtime variables; verify the exact project and existing registry row
  read-only; stop before any test data if a credential/configuration is absent.
- Source readback: Gemini uses `google_gemini` with configuration-driven
  `gemini-3.5-flash-lite`, `PHASE9_GEMINI_API_KEY`,
  `PHASE9_GEMINI_MODEL_ID`, and `PHASE9_GEMINI_TIMEOUT_MS`. Google Books uses
  `google_books` adapter `1.0.0` and requires
  `PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
  `PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES` in real mode.
- Runtime inventory: none of those Phase 9 Gemini/Google Books names are
  process-, user-, machine-, or checked-in-env-file-readable. The process
  Supabase URL is `nxjnoqjxzkipeghhfxee.supabase.co` and therefore does not
  target `ahntbtktjjmvfosgkmgn`; the process service credential was not used
  against the approved project.
- Verification: exact-project `get_project`, migration-history readback, and
  read-only registry/count query passed. M32 remains exactly once; the existing
  Google Books row remains exactly one; metadata jobs `0`, historical eligible
  candidates `6`, inventory/listings `5/5`.
- Supabase/external mutations: none in this rerun. No worker started, no image
  or candidate was created, no provider request occurred, and no migration,
  scheduler, inventory, publication, Unit 7, or Git operation occurred.
- Verdict: `LIVE_METADATA_BLOCKED_MISSING_CREDENTIALS`; target-project runtime
  mismatch is separately recorded as a `BLOCKER`. Next action is to configure
  the exact target service URL/key and all source-defined real-provider
  variables through the approved secret mechanism, then rerun the same proof.

### 2026-08-09 - metadata runtime safety and adapter-smoke preflight

- Authorized scope: exact approved-project startup guard, focused fail-closed
  tests, metadata peer-token resolution, metadata support in the existing manual
  invoker, process-only local secret procedure, and exactly one adapter-only
  Google Books request. Full candidate/worker/database proof remains excluded.
- Implementation: the shared URL parser now requires HTTPS and exact hostname
  `ahntbtktjjmvfosgkmgn.supabase.co`, with no userinfo, port, path, query, or
  fragment. Metadata has no peer worker and rejects the peer-hash variable;
  media/vision retain their mutual peer-distinctness checks. The manual invoker
  accepts `metadata`, maps only its URL/token variables, and preserves the exact
  bounded claim body, timeout, response limit, and safe summary.
- Verification actually run: metadata environment Jest 7/7 PASS; combined
  environment/runtime/invoker/adapter/composition/gateway/worker Jest 6 suites,
  84/84 PASS; metadata-worker TypeScript build PASS; fresh Supabase read-only
  project/migration verification PASS with M32 exactly once; Phase 9 continuity
  PASS with 195 requirement definitions, zero duplicates/missing traceability,
  67 Markdown files, and 53 required files.
- Provider smoke: the first harness failed to parse before HTTP egress, so it
  consumed no call. The corrected temporary non-secret harness made exactly one
  adapter request for repository fixture ISBN `9780306406157`: HTTP 200,
  credential accepted, response bounds passed, decoder passed, and a valid
  provider-neutral `no_acceptable_match` result was produced. The harness was
  removed. No secret was added to repository files, `.env`, snapshots, or output.
- External/database effects: one Google Books HTTP request only. No privileged worker, candidate, metadata job,
  attempt, provider-call record, snapshot, database/Storage write, Render/Gemini
  change, deployment, scheduler, inventory/publication, Unit 7, stage, commit, or
  push occurred. The inherited foreign Supabase URL was not used by a worker.
- Service-role recheck: sanitized local JWT inspection showed role
  `service_role`, exact project ref `ahntbtktjjmvfosgkmgn`, and no expiry; a
  bounded authenticated read of `phase9_metadata_provider_calls` on the approved
  host returned HTTP 200 with an empty JSON array. This proves the inherited key
  is valid for the target project; the configuration defect is only the inherited
  `SUPABASE_URL`. The read caused no database or Storage mutation.
- Exact next authorized action: obtain separate authorization for
  `CONTROLLED_ONE_CANDIDATE_METADATA_VERTICAL_PROOF`, override `SUPABASE_URL`
  process-locally with the exact approved origin, revoke the chat-exposed Google
  Books key, and inject a fresh provider key for the authorized testing window.

### 2026-08-09 — authorized Expo web proof stopped before upload

- Authorized scope: use the real Expo web Owner UI, resolve the supplied
  `testimage.jpeg`, and run one fresh multi-candidate capture only when the
  exact project, queue isolation, Google Books secret, and existing Render
  configuration were ready. No inventory/publication, scheduler, migration,
  deployment, or Git action was authorized.
- Web navigation: the legitimate authenticated path Profile → Store Owner
  Console → Inventory loaded successfully. Inventory showed an existing active
  capture with six processing images and one review item. Its `Resume scan`
  flow was inspected only; the supplied image was not added to that old session.
- Exact-project baseline: Supabase MCP reconfirmed `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`, and M32 exactly once. Read-only
  counts were sessions `4` total / `3` active-or-closing, inputs `18`, jobs
  `27` / `8` pending, candidates `13`, and metadata jobs/attempts/provider
  calls/lookups/cache entries all `0`.
- Stop conditions: the shared worker queue could not be isolated to a fresh
  image without risking unrelated pending work; the process had no
  `PHASE9_GOOGLE_BOOKS_API_KEY`; and the web UI's existing active session would
  have mixed historical data with the new proof. Therefore no new session,
  upload, Storage object, media/vision invocation, Gemini call, metadata worker
  invocation, Google Books call, candidate, metadata job, or provider record
  was created.
- External/Git effects: no Supabase/Storage write, provider egress, Render or
  Gemini configuration change, scheduler/dispatch, inventory/publication
  mutation, migration, stage, commit, push, or deployment occurred. The local
  Expo server remains running and the browser is on `/inventory`.
- Exact next action: inject a fresh Google Books secret through the approved
  process-only mechanism and obtain an isolated queue/worker window, or
  explicitly authorize safe cleanup of the old active capture. Do not process
  the existing pending queue or add the supplied image to the old session.
### 2026-08-09 controlled cleanup / real Owner upload evidence

- External cleanup readback: active/closing sessions `0`; pending/open,
  in-progress, or retry-scheduled media/vision jobs `0`; Owner review count `0`.
- Storage: nine stale input objects removed; ten scoped media records marked
  deleted. Immutable results/observations and append-only decision evidence were
  retained with required audit rows.
- Browser: Profile/Owner Inventory -> Start scan -> Choose from gallery ->
  `testimage.jpeg` -> Upload image succeeded. The new session contains one
  uploaded input and one open media-validation job.
- Runtime stop: `PHASE9_MEDIA_WORKER_URL` and
  `PHASE9_MEDIA_WORKER_INGRESS_TOKEN` are absent from the invoking process.
  No worker claim, provider call, candidate, M32 metadata job, inventory/listing
  mutation, migration, deployment, scheduler, Unit 7, stage, commit, or push
  followed.
- Authorized follow-up used the existing Render service URL and existing masked
  ingress-token value process-locally. Invoker result: HTTP `200`, claimed `1`,
  outcome `queued`. Readback: media job `resolved`, attempt count `1`, fresh
  input `queued` with media asset and SHA-256, one downstream vision job `open`,
  and zero unrelated pending media jobs. The token was neither printed nor
  persisted.
- Vision evidence: existing Render vision URL/token used process-locally;
  invocations 2, both HTTP `200`, claimed `1`, outcome `retry_scheduled`.
  Current job attempt `2/5`, error `P9_VISION_ANALYZER_UNAVAILABLE`; provider
  attempts `0`, usage reservations `0`, candidates `0`, M32 metadata jobs `0`.
  Live SQL function inspection confirms media completion creates the vision job
  but not its required usage reservation. Gemini/Google Books calls `0`. Owner
  UI: `Trying again`, `Books found: 0`. No manual reservation, retry exhaustion,
  migration, deployment, scheduler, Unit 7, inventory/listing mutation, stage,
  commit, or push occurred.

### 2026-08-09 M33 local implementation log

- Authority: create the forward-only M33 migration file, implement the durable
  correction systematically, add red tests first, and verify locally. Live
  application and proof continuation were not authorized.
- Files/components: M33; new static and PGlite cross-seam tests; the existing
  M14 provider-attempt fixture digest; required Phase 9 handoff, pipeline,
  security, database, and dictionary records.
- Behavior: a postgres-private helper validates the job/input/session/media
  graph, creates one policy-1 vision reservation under the existing unique
  constraint, re-reads exact lineage, and fails closed. Media completion calls
  it before resolving. The migration repair selects no terminal or leased job,
  uses no generated IDs, and preserves attempt/error state.
- Verification actually run: red static 0/3 and integration 0/3 before M33;
  M33 static 3/3; M33 integration 5/5; M14 provider suite 10/10 after correcting
  its stale fake digest; combined ingestion/vision/provider/M33 PGlite 61/61;
  shared migration catalog through M33 and database foundation 17/17; focused
  M11/M12/M13/M14/M33 static suites 42/42. The stale M13 scanner was corrected
  to recognize the runtime's bounded conditional RPC branches without changing
  runtime or wrapper behavior.
- External state: none. M33 remains unapplied; the fresh job remains attempt
  `2/5`, and the duplicate open media input remains untouched.
- Next gate: independent local review, then separate authorization to reverify
  `ahntbtktjjmvfosgkmgn`, apply M33, and perform exact schema/data/ACL readback.

### 2026-08-09 M33 required-review correction log

- Authority: implement only the two required independent-review corrections;
  no live application or proof continuation.
- Red evidence: the new static predicates failed 2/3; the migration catalog
  failed because M31 was absent; and the malformed-history integration case
  received an unintended reservation before production correction.
- Completed: active-session plus initiating-Owner media binding in helper and
  repair; direct malformed/terminal/duplicate-media exclusions; preservation
  assertions for attempt, next-attempt, and safe-error state; anon helper ACL;
  rollback assertion for upload-capability consumption; M31 inserted into the
  canonical PGlite migration order.
- Verification: M33 static 3/3; focused static 39/39; M33 integration 5/5;
  combined ingestion/vision/provider/M33 PGlite 61/61; database foundation and
  migration catalog 17/17.
- External state: none. M33 is unapplied; no Supabase/Storage/provider/worker,
  deployment, duplicate cleanup, inventory/publication, Unit 7, stage, commit,
  or push action occurred.
- Next gate: independent correction-only rereview, then separately authorized
  exact-project application and readback.

### 2026-08-09 compact Gemini multilingual/language-hint correction

- Authority: implement the frozen compact provider contract, non-fatal compact
  multilingual enrichment, five-author maximum, and selected-language-as-hint
  behavior; add a forward migration only because the applied persistence function
  also enforces the old rejection.
- Completed: provider schema/prompt/decoder cleanup; server-owned canonical
  provenance reconstruction; strict enrichment ordinal mapping; TypeScript policy
  correction; local forward M34 after M33; focused contract and database tests.
- Verification: focused target Jest 46 tests (the main command also discovered the
  isolated worktree and reported the same tests twice as 92/92); vision-worker
  TypeScript passed; current M32/M33/M34 PGlite vision plus variants 59/59; isolated
  baseline PGlite 45/45.
- External state: none. M34 was not applied; no provider, Render, job, Supabase,
  inventory/publication, stage, commit, or push action occurred.
- Next gate: independent review of the exact local correction. Provider-only smoke,
  deployment, M34 application, and attempt 5 remain separately authorized actions.

### 2026-08-09 compact Gemini required diagnostics correction

- Authority: implement only the independent review's required privileged-value
  filtering for bounded Gemini failure identifiers and its regression evidence.
- Red evidence: 1/22 analyzer and 1/6 egress assertions failed; configured
  secrets appeared in failure `providerRequestId`/`providerErrorCode` fields and
  a successful provider response ID reached attempt finalization.
- Completed: the failure sanitizer receives the existing privileged-value list
  and nulls either bounded identifier when it contains a configured secret;
  successful response IDs use the same filter before attempt finalization.
- Verification: corrected analyzer Jest 22/22; complete focused correction Jest
  47/47; vision-worker TypeScript build passed.
- External state: none. M34 remains unapplied; no provider, Render, job, Supabase,
  inventory/publication, stage, commit, or push action occurred, and attempt 5
  was not invoked.
- Next gate: independent correction-only rereview of the compact Gemini/M34 and
  diagnostics scope.

### 2026-08-09 corrected-production provider-proof stop

- Authority: install the replacement Gemini key on the existing vision service,
  run the exact reviewed provider-only request without a Supabase claim, and
  stop before M34 or downstream execution on any provider error.
- Source and input: local unpushed `dc19107ef9fc1252f85626614147de2562f15559`;
  production sanitation reproduced the live input's 1600x1600 WebP and exact
  SHA-256 before egress.
- Provider verification: full production prompt/schema/decoder request returned
  HTTP 400 `INVALID_ARGUMENT`, safe category `malformed_request`. Same image,
  prompt, configured model, and core `vision` schema returned HTTP 200 when only
  the optional multilingual schema subtree was omitted. A full-schema probe with
  type-array nullability still returned HTTP 400, isolating the blocker to the
  multilingual subtree/combined nesting complexity.
- Supabase evidence: read-only project verification passed for
  `ahntbtktjjmvfosgkmgn`; M31/M32/M33 are present in order, M33 is recorded once
  as `20260809023834`, and M34 is absent. The preserved vision job remains
  `retry_scheduled` at attempt `4/5` and was not claimed.
- External state: the key update caused one automatic Render restart, now live at
  prior SHA `83cf61ae93b263d6a31a5cda67da2be91cdb97fb`. No database/Storage mutation,
  Git push, corrected deploy, job invocation, candidate/metadata action, Owner UI
  continuation, inventory/publication, scheduler, or Unit 7 action occurred.
- Next gate: smallest multilingual provider-schema compatibility correction and
  rerun of the exact provider-only request; downstream execution stays blocked
  until HTTP 200 plus production decode.

### 2026-08-09 flattened Gemini observation correction

- Authority: the user's explicit simplification replaces the rejected separate
  multilingual subtree with flat per-observation Romanization/translation fields.
- Red evidence: the focused analyzer/variant suites failed 10 assertions before
  production changes because the old decoder rejected the new flat response.
- Completed: one `vision` provider schema; nullable title Romanization and English
  title translation; at-most-five positionally aligned nullable author
  Romanizations; server-side source-script inference and unchanged M18/M19 mapping.
- Verification: five focused Jest suites 59/59; vision-worker TypeScript PASS.
- External state: the explicitly approved retry used the flattened production
  schema/decoder/mapper and sanitized local test image. Gemini returned HTTP 400
  with safe category `malformed_request` and message `provider rejected the
  request shape`; no HTTP-200 production decode was obtained. The analyzer mapped
  it to `P9_VISION_ANALYZER_UNAVAILABLE`. No M34, Git, Render, Supabase/job,
  metadata, Owner UI, inventory/publication, scheduler, or Unit 7 action occurred.
- That retry approval is exhausted. Next gate: fresh approval for another
  sanitized-image probe only if needed to isolate the rejected schema component;
  downstream execution remains blocked until HTTP 200 plus decode.

### 2026-08-09 schema-free JSON-mode correction and provider proof

- Authority: simplify the provider format and retry the same sanitized image.
- Red-first: focused analyzer Jest failed because `responseJsonSchema` was still
  present in the production request.
- Completed: removed the provider schema; retained JSON MIME mode, the compact
  flat prompt, strict local decoding, and unchanged server-owned M18/M19 mapping.
- Verification: exact-path focused Jest 59/59; vision-worker TypeScript PASS.
- Provider proof: Gemini accepted the request and returned JSON. The prior HTTP
  400 `malformed_request` did not recur. Production decoding rejected the JSON as
  `P9_VISION_SCHEMA_INVALID`, so the remaining blocker is local normalization.
- External state: one approved provider call only. No Supabase, Storage, job,
  Render, Git, metadata, Owner UI, inventory/publication, scheduler, or Unit 7
  mutation occurred; the temporary proof script was removed.
- Next gate: explicit approval for one bounded returned-JSON capture, then the
  smallest evidence-backed decoder normalization before any downstream action.

### 2026-08-09 bounded capture and decoder normalization

- Provider evidence: one approved capture returned eight observations. The exact
  strict-decoder mismatches were `image_outcome: "success"` and one null
  `detected_language`; the remaining flat fields matched the requested format.
- Red-first: analyzer Jest reproduced `P9_VISION_SCHEMA_INVALID` with those two
  values before production changes.
- Completed: normalize only `success` to `analyzed` and null detected language to
  `und`, then continue through the unchanged strict decoder and M18/M19 mapper.
- Verification: exact-path focused Jest 60/60; vision-worker TypeScript PASS.
- Final provider proof was not run because its additional image transmission was
  separately rejected by the approval boundary. No workaround was attempted.
- External state: capture call only. No Supabase, Storage, job, Render, Git,
  metadata, Owner UI, inventory/publication, scheduler, or Unit 7 mutation.
- Next gate: explicit approval for one final sanitized-image provider request;
  downstream execution remains blocked until production decode succeeds.
### 2026-08-10 — real-image vision, metadata, and Owner review verification

- External/database effects: M34 applied once to exact project
  `ahntbtktjjmvfosgkmgn`; preserved vision job resolved; 8 observations and 7
  candidates persisted; seven metadata jobs were claimed once and resolved into
  immutable manual-review snapshots. No Storage cleanup, inventory, listing,
  publication, scheduler, commerce, or Unit 7 mutation occurred.
- Runtime evidence: Gemini accepted and persisted the corrected production
  result. Google Books credential fingerprint was validated without disclosure
  (HTTP 200). Seven production metadata calls completed, but live evidence
  isolated a request defect: `projection=lite` returned records without
  `language`, so strict decoding produced zero editions. Switching only to
  `projection=full` yielded 10 records, 8 valid decoded editions, and a safe
  ambiguous-edition result for The Black Swan.
- Code/Git evidence: request projection correction plus regression assertion,
  focused adapter Jest 26/26, metadata-worker TypeScript build PASS; commit
  `e4f2b34` pushed to `codex/phase9-gemini-json-deploy`. Existing terminal live
  evidence was not destructively replayed.
- UI evidence: authenticated Profile -> Store Owner Console -> Inventory shows
  seven needing attention; all seven candidate cards and the Black Swan detail
  load. No form submission or publication choice was made.
- Next gate: manual Owner review only. Automatic terminal-metadata recovery is
  outside this proof and needs separate design/authorization.

### 2026-08-10 — single-image and safe input-removal implementation

- Authorized scope: keep Owner Remove image, prohibit additional current images,
  allow a replacement only after successful pre-candidate removal, and create
  the forward migration file without applying it.
- Completed: client append removal and direct-preview guard; candidate-count UI
  eligibility; strict request/response/Edge routing; identity-fenced mutation;
  M35 logical removal, exact-job cancellation, hold-aware cleanup schedule,
  current-input filtering, and issuance/registration single-input guards.
- Verification actually run: red focused screen tests; M35 structural Jest 6/6;
  isolated M01-M35 PGlite integration 3/3; capture preview 18/18;
  progress/remove 9/9; cache identity 2/2; service/Edge regressions 186/186;
  repository TypeScript PASS; Phase 9 continuity PASS (195 definitions, zero
  duplicate/missing traceability, 68 Markdown files, 53 required files) with
  repository diff check PASS.
- Supabase/external mutations: exact project and migration history read-only
  verified. No M35 application, Edge deploy, live removal, Storage mutation,
  worker call, provider call, inventory/listing/publication, stage/commit/push.
- Browser verification: the legacy session rendered three existing image cards
  with Remove image and no append control; the updated Image 1 confirmation was
  opened and cancelled without sending the mutation.
- Decisions/deviations/risks: P9-D70 supersedes P9-D04 only for multi-image
  sessions. Existing legacy sessions are not rewritten. Candidate-bearing inputs
  fail removal atomically. Physical private-media deletion remains Unit 10
  lifecycle work; M35 schedules deletion and respects holds.
- Next authorized action and gate: review and explicitly authorize exact-project
  M35 application. Edge deployment and live verification remain separate gates.

### 2026-08-10 — M35 live application, exact removals, and Owner Edge v3

- Authorization: the user explicitly authorized M35 application and removal of
  the three exact legacy images, then separately authorized deployment of the
  Remove image Edge Function update.
- Database result: verified project `ahntbtktjjmvfosgkmgn` records M35 once as
  `20260809223135 marketplace_phase9_single_image_removal`; the new RPC exists.
- Exact removal result: inputs `747577a0-261e-4d62-9c83-58f77be3b8f3`,
  `2e732da3-9d08-4bfc-b95c-b98c357174a5`, and
  `20cc5ef1-29fd-4594-9c19-d28841b889e5` are `skipped` with
  `P9_OWNER_REMOVED`, versions `4/2/2`, and 24-hour `delete_after` timestamps.
  Their three exact jobs are `cancelled` with `P9_OWNER_REMOVED`; candidate
  count is zero; the session advanced to version 4/presentation revision 9.
- Non-interference: store inventory and listings remain zero. The three private
  staging objects remain present for lifecycle cleanup; no physical object was
  deleted and no unrelated row was mutated.
- Edge result: `phase9-owner-ingestion` v3 is `ACTIVE`, `verify_jwt=true`, and
  deployed readback matches the four reviewed request/response/routing/RPC files
  exactly; the other 15 deployed bundle files were preserved from v2.
- Browser/readback: after deployment the scan route rendered one `Checking
  image` card with `Remove image`. Database readback proved this is a new input
  `ef965790-1695-429b-82b7-2c386bc0ae27`, registered after the three removals;
  it was not clicked or mutated.
- External/Git statement: M35, the three logical removals/job cancellations,
  and Owner Edge v3 are the only authorized external mutations. No provider,
  inventory, listing, publication, physical Storage, stage, commit, or push
  occurred.
- Next authorized action: observe the new input without mutation. Any removal
  of that input, worker invocation, or further live mutation requires a new
  explicit decision.

### 2026-08-10 — automatic worker wake dispatcher local review package

- Authorized scope: red-first local implementation of one private claimability
  helper, inactive Cron/`pg_net`/Vault-backed dispatcher migration, bounded
  observability, safe dispatch-ID receipt logging, metadata deployment
  preparation, tests, and correction-only independent review.
- Implementation: local unapplied M36 preserves the three claim RPCs and job
  rows, dispatches at most one matching `/run` request per stage/minute, creates
  its cron inactive, reads only six fixed Vault names, uses an explicit
  120-second timeout, and retains secret-free observations for seven days;
  the Authorization header is transiently held only by pg_net's private
  request queue, outside the M36 observation relation and application logs.
- Red-first evidence: the first focused run failed because M36 and receipt
  logging were absent. Green implementation then passed focused structural and
  runtime Jest 22/22 and dispatcher PGlite 24/24; full Phase 9 Jest passed
  693/693 and full Phase 9 PGlite passed 236/236 before review corrections. All three worker builds and
  authenticated health/readiness/entrypoint smokes passed.
- Independent review: `APPROVED_WITH_REQUIRED_CORRECTIONS`. The corrections add
  due-vision and due-metadata stage isolation, multiple-due-row single-request
  proof, measured timeout reasoning plus scaled delayed `/run` coverage, and an
  accurate lease-suppression claim composed with existing provider-idempotency
  regressions. Corrected focused gates pass: dispatcher PGlite 28/28 and focused
  structural/runtime Jest 23/23; corrected full gates pass at Phase 9 Jest
  694/694 and Phase 9 PGlite 240/240.
- Closeout gates: continuity PASS with 195 requirement definitions, zero
  duplicate/missing mappings, 69 Markdown files, and 53 required files;
  repository `git diff --check` PASS; generated `.pyc` count 0.
- Security review: fixed empty `search_path`; postgres ownership; no
  PUBLIC/anon/authenticated/service-role access; no user/store authority; no
  provider/service-role credential names; no secret, URL, body, content, or
  error persistence in Phase 9 application observations/logs (pg_net's private
  request queue transiently carries the bearer header as required for delivery);
  bounded retention and response classification only.
- External/database effects: none. Live tail remains M35; one claimable media
  job remains untouched; no Phase 9 live cron, Phase 9 Vault configuration, or
  metadata Render service exists. Nothing was applied, configured, deployed,
  enabled, invoked, removed, staged, committed, or pushed.
- Rollout conclusion: the deployed media and vision services remain ordinary
  authenticated `/run`-compatible with the optional dispatch-ID header, but
  predate dispatch-ID receipt logging. Redeploy both before final live
  correlation proof; this is observability-only and requires no claim-RPC or
  provider behavior redesign. Metadata service creation remains separate.
- Exact next authorized action: review and explicitly authorize or reject a
  separate deployment/external-mutation unit. Duplicate replay remains a later
  separate work unit only after fresh automatic-path proof.

### 2026-08-10 — Unit 6 pre-main integration reconciliation

- Authorized scope: classify the complete branch and dirty tree, package only
  current-required source, run complete local gates and independent review,
  integrate from fresh `origin/main`, and normally publish one exact candidate.
- Classification: current-required source is enumerated in
  [tracker 28](./28-pre-main-integration-reconciliation.md). `.wt/`, generated
  `docs/codemap/`, Store Owner Orders commit `2f32231`, the unrelated Phase 4
  hunk in `0c705d4`, and superseded Gemini revisions are excluded.
- Bounded package commits: `ce5f787` structural metadata/M32 worker and runtime;
  `3e16973` M33 source/evidence; `b76cf05` M35/Unit 6 source/evidence.
- Verification so far: metadata focused Jest 150/150 and structural PGlite
  14/14; M33 structural/PGlite 18/18; M35/Unit 6 changed-scope Jest 216/216 and
  M01-M35 PGlite 3/3; metadata and repository canonical TypeScript checks pass;
  bounded diff and secret scans pass. Timed-out aggregate commands are not
  counted as evidence.
- External effects: none. Read-only state remains M35 as the live Supabase tail,
  media Render at `96991a9`, vision Render at `388d8bf`, no metadata service,
  and M36 absent live.
- Next authorized action: finish documentation validation and full local gates,
  obtain independent approval, assemble the clean candidate, and verify exact
  ancestry/content. The later explicit user instruction requires readiness
  reporting and a stop before any push.
- Full local gate result: Phase 9 Jest 54 suites/694 tests; complete
  image-inventory client Jest 39 suites/287 tests; Phase 9 PGlite 240/240; all
  three worker builds and entrypoint smoke; deployment validator; canonical
  repository TypeScript; continuity; diff, tracked-artifact, secret, and `.pyc`
  checks all PASS. Docker is not installed, so container smoke is unavailable
  and not claimed. Candidate-review tests emitted known React `act(...)`
  warnings without failures. The secret scan allowlisted only two invalid-length
  test tokens and one angle-bracket README placeholder; blocking count is zero.
- Current gate: independent complete-delta review before clean integration.
- Isolated candidate assembly: fresh `origin/main` `388d8bf` plus proven
  `projection=full` checkpoint `6b31025` and merge checkpoint `8e327d7`.
  Exact dispatcher commit `51c51f4` is an ancestor. Gemini conflicts were
  resolved to main; the migration harness combines M34/M35/M36; Store Owner
  Orders and the unrelated Phase 4 file are unchanged from main.
- Git ancestry caveat: preserving exact `51c51f4` necessarily retains
  historical ancestors `2f32231`, `dc19107`, and `df63801`; their tree effects
  are explicitly neutralized and the ancestry is disclosed in tracker 28.
- Next gate: complete candidate rerun and independent final approval, followed
  by a fresh `origin/main` comparison and readiness report; any push requires a
  new explicit user instruction.

### 2026-08-10 — isolated candidate review corrections

- Initial independent verdict: `CHANGES_REQUIRED` for normative Gemini wording,
  Owner discovery active-store/actor count scope, Edge transport of the two new M35 errors,
  and bounded mobile handling of those errors.
- Red-first corrections now use local forward M37 to scope `needsReviewCount`
  to the authenticated actor and active server-derived store while leaving the
  already-live M35 file byte-identical to its assembled source; preserve both errors as safe nonretryable 409
  envelopes; expose bounded replacement/removal guidance; and align normative
  documentation with the existing current main-line Gemini normalization.
- The prior complete candidate gate passed Phase 9 function/runtime and
  migration Jest 55 suites/701 tests and image-inventory client Jest 39
  suites/289 tests. Final M35/M37 plus affected Edge/mobile focused Jest passes
  5 suites/189 tests; isolated M35→M37 PGlite passes 4/4; and full
  M35→M36→M37 Phase 9 DB replay passes 241/241 after the migration-list
  assertion's expected red/green update. Worker sources are unchanged from the
  candidate where all three builds/entrypoints passed. Docker is unavailable
  and container smoke is not claimed.
- External effects: none. M36/M37 remain unapplied and no Supabase, Vault, Cron,
  Render, worker/provider, Storage, live-image, duplicate-replay, Unit 7,
  inventory, listing, or publication mutation occurred.
- Exact next action: independent correction-only re-review, then fresh-main
  ancestry/content verification and readiness reporting; stop before push and
  await a new explicit user instruction.

### 2026-08-10 — bounded metadata retry correction

- Authority: create and verify one forward-only correction, obtain independent
  review, and optionally commit/push the bounded branch; no external mutation.
- Completed: M38 metadata context v2 and later-claim retry logic, red-first
  contracts, exact Google Books HTTP 503-to-200 SQL-backed regression, migration
  replay wiring, continuity records, and independent `APPROVED` re-review.
- Verification: metadata Jest 148/148; structural metadata PGlite 14/14; full
  Phase 9 PGlite 242/242; metadata build, entrypoint smoke, deployment validator,
  continuity validator, diff hygiene, secret/artifact scan, and `.pyc` count pass.
- External/database effects: Git-only publication of correction commit `8c55fea`
  to `origin/codex/phase9-metadata-retry-correction`. The exact project was read
  only; M38 remains unapplied; the failed live job was not retried, requeued, or
  otherwise mutated.
- Decisions/deviations: the minimum forward schema change is required because
  M32's public context omitted the physical-call claim attempt. M32-M37 remain
  byte-unchanged. No media, vision, dispatcher, Vault/Cron, Owner UI, query
  policy, duplicate-replay, or Unit 7 behavior changed.
- Next: open a separately authorized operational session if M38 application and
  metadata redeployment are desired. Neither is authorized by this closeout.

### 2026-08-10 — M38 rollout and Unit 6 closure

- Authorized work unit and scope: publish exact approved correction to `main`,
  apply M38 only, redeploy metadata exactly once, and upload one SHA-new image
  through the real Owner UI for automatic closure proof.
- Completed: `main` fast-forwarded to immutable `a138baa7d3bbc086da019bc052a5ae31d0e15882`;
  M38 applied once as `20260810130638`; metadata deploy
  `dep-d9ssq2v10e5c73ahp18g` became live from that SHA; one Owner image produced
  six vision candidates and six automatically resolved metadata jobs; the UI
  exposed six Needs-attention review cards.
- Verification actually run: exact-project migration/function/ACL/search-path,
  cron, claimable-work, row-count, inventory/listing, and historical-dead-letter
  readbacks; all six worker `/health` and `/ready` checks; Render service/deploy
  readback; real Owner UI upload and passive UI observation. No new broad local
  test suite was run; the approved correction retains its recorded 148/148 Jest
  and 242/242 PGlite evidence.
- Supabase/external mutations: one `main` fast-forward push; exact M38 apply;
  exactly one metadata deployment; prior terminal Owner session closed through
  its non-committing UI; one new session and one new image upload. Automatic
  effects were one media job, one vision job, six candidates, six metadata jobs,
  six lookups, five physical provider calls, five attempts, and two new safe
  cache entries. Inventory/listings stayed 5/5. Media/vision deployments were 0.
- Decisions/deviations/risks: no natural retryable Google Books 5xx occurred,
  so the approved 503-to-200 regression remains the retry-specific proof. The
  user's explicit final-proof instruction accepts this live automatic proof as
  Unit 6 closure without rerunning the prior low-end Android gate.
- Tracker/source-doc updates: Phase 9 tracker/router/session start/README,
  DOC-13, current-vs-target audit, migration ledger, and this log.
- Next authorized action and gate at that 2026-08-10 checkpoint: none. Unit 7
  remained not started and required a new explicit authorization; duplicate
  replay was not tested. Current sequencing is superseded by the 2026-08-12
  authority reconciliation below.

### 2026-08-11 — Android signed-upload transport correction

- Authorized scope: investigate, then implement only the narrow local mobile
  upload correction; no native live upload or external mutation.
- Completed: replaced the React Native `Blob`/`FormData` signed-PUT body with
  raw `ArrayBuffer` bytes and explicit `content-type`,
  `cache-control: max-age=0`, and `x-upsert: false` headers. Existing
  authorization, size validation, progress, cancellation, registration, and
  retry behavior are unchanged.
- Verification actually run: red regression failed on the old Blob path;
  corrected transport 2/2; focused capture/upload 26/26; Image Inventory 39
  suites and 290/290 tests reported passing (the known Jest open handle retained
  the otherwise completed runner); repository TypeScript passed.
- Documentation verification: Phase 9 continuity and repository diff checks
  passed; only existing document-size advisories and line-ending warnings were
  emitted.
- External state: none. No native upload, Supabase/Storage/database mutation,
  migration, deployment, provider call, staging, commit, push, or publication.
- Next authorized action: none. Post-fix native proof and Unit 7 each require
  separate explicit authorization.

### 2026-08-11 — authorized Android runtime investigation

- Authorized scope: one bounded Expo Go upload proof and read-only correlation
  through exact-project Edge, Postgres, and Storage logs; no deployment,
  migration, repair, inventory/listing mutation, or Unit 7 work.
- Live result: three short-lived upload capability rows were issued during the
  investigation. Corrected Android raw-byte requests reached signed Storage
  PUT and returned HTTP 400; no Storage object, registered input, or job was
  created.
- Secondary result: after development reload cleared the in-memory capability,
  reauthorization while the prior capability remained unexpired reached Owner
  Edge at 19:33:10 UTC. Postgres raised `P9_SINGLE_IMAGE_LIMIT`, while deployed
  Edge v3 returned generic HTTP 500. The device therefore showed 0% and `The
  request could not be completed.` This request never reached Storage.
- Privacy/cleanup: signed URLs and tokens were redacted; the temporary
  development-only console diagnostic was removed. No private image body was
  persisted in documentation or logs by this investigation.
- Next authorized action: none. A further Android transport correction, Owner
  Edge deployment, additional live upload, or Unit 7 work requires explicit
  authorization.

### 2026-08-11 — native FileSystem signed-upload replacement

- Authorized scope: implement the bounded native transport replacement and
  verify it locally; preserve web and exclude backend, migration, deployment,
  Storage-policy, worker, provider, inventory/listing, and Unit 7 changes.
- Red-first evidence: the new transport suite failed 6/6 against the retained
  React Native XHR implementation. It proved native transport selection, exact
  file body/MIME/header contract, size integrity, cancellation, 2xx-only
  success, bounded non-2xx diagnostics, and web FormData preservation.
- Implementation: added direct SDK-compatible `expo-file-system` `~19.0.23`.
  Android/iOS now preflight the URI size and use native `UploadTask` with
  `BINARY_CONTENT`, signed `PUT`, `content-type`, `cache-control: max-age=0`,
  `x-upsert: false`, foreground cancellation semantics, and real byte progress.
  Web again uses the previously proven Blob/FormData browser XHR path.
- Verification actually run: transport 6/6; focused capture/upload 37/37;
  repository TypeScript PASS; final Image Inventory 39 suites and 294/294 PASS.
  One first full-scope attempt exposed a virtual-mock isolation defect and was
  not a product failure; removing the incorrect virtual marker made the
  affected pair 10/10 before the final full pass. The known Jest open handle
  remained after each completed result and the idle runner was stopped.
- External state: none. No Android live upload, Supabase/Storage/database
  mutation, migration, Edge/service deployment, provider/worker call, Git
  stage/commit/push, inventory/listing/publication, or Unit 7 action occurred.
- Gate recorded at that checkpoint: one fresh Android Owner upload through
  normal UI state, requiring signed Storage `2xx`, exactly one object, and
  successful input registration. The later user-supplied proof passed this gate;
  the `P9_SINGLE_IMAGE_LIMIT` deployment drift remains separate.

### 2026-08-11 — multilingual vision-response resilience correction

- Authorized scope: local TypeScript compatibility/diagnostic correction,
  deterministic fixtures, focused/full verification, and required Phase 9
  documentation only. No migration, remote mutation, deployment, provider call,
  Git publication, removed-input retry, or Unit 7 action was authorized.
- Runtime handoff supplied by the user: FileSystem upload succeeded through one
  Storage object, registration, and sanitation. Input
  `a1c8e286-07f2-40c5-9bbd-2fed49c5148d` and vision job
  `20734f70-dd4c-4f68-87d5-aa837cb32b7d` then ended at deterministic
  `P9_VISION_SCHEMA_INVALID`; the input was later removed and remains untouched.
- Red-first evidence: 5/21 resilience assertions failed before production
  changes on the three intended gaps. Final resilience is 21/21.
- Implementation: provider-boundary compatibility normalizes bounded 16-100
  count/array evidence to canonical `too_many_books` with zero observations,
  rejects larger responses, retains strict in-cap structure, preserves original
  Unicode, degrades only bounded plain unknown language labels to `und`, keeps
  optional enrichment non-fatal, and emits only sanitized closed schema
  diagnostics.
- Files/components: `geminiResponseDecoder.ts`, new
  `geminiSchemaDiagnostics.ts`, `geminiAnalyzerGuards.ts`,
  `geminiSpineImageAnalyzer.ts`, new resilience Jest fixtures, Pipeline/Security
  SDDs, traceability, ACTIVE/session/README handoff, DOC-13, Phase 9 master and
  implementation trackers, Unit 6C evidence, and the continuity validator.
- Verification actually run: analyzer/captured payload plus resilience 3 suites
  and 46/46; worker/orchestration, vision contracts/policy, multilingual,
  security, and Unit 6 polling 10 suites and 120/120; Image Inventory 39 suites
  and 294/294 reported passing before the known idle Jest handle was stopped;
  repository TypeScript passed with `--allowImportingTsExtensions`; vision-worker
  build passed; Phase 9 continuity passed with 195 requirement definitions,
  zero duplicate/missing mappings, 70 Markdown files, 53 required files, and
  repository diff check PASS. The unflagged TypeScript command reported only
  the repository's known TS5097 import-extension configuration errors.
- External state: none in this correction session. No database/Storage write,
  migration creation/application, Edge/service deployment, Gemini retransmission,
  job replay, removed-input revival, inventory/listing/publication effect, stage,
  commit, push, or PR occurred.
- Exact next gate at that 2026-08-11 checkpoint: bounded independent review;
  deployment required a new explicit authorization, followed by exactly one
  fresh Android image proof. Unit 7 stayed unauthorized at that checkpoint;
  current sequencing is superseded by the 2026-08-12 authority reconciliation
  below.

### 2026-08-12 — Unit 6 closure authority reconciliation

- Automatic/functional Unit 6 pipeline: **PASS**. M38 automatic proof completed
  media, vision/Gemini, metadata, and Owner-review handoff; no inventory/listing
  side effects occurred.
- Native Unit 6F evidence remains `NOT_RUN`/`UNRESOLVED` deferred validation
  debt, not PASS: camera/gallery physical-device parity, native recovery/
  reconnect, 15-card representative-device performance, offline/reconnect,
  accessibility/large text, and low-end Android resource/performance. AC36 and
  AC39 remain mapped acceptance criteria and are not changed or satisfied by
  automatic pipeline evidence.
- Authority: the project owner accepts the deferred native-validation risk and
  authorizes Unit 7 to begin. This supersedes older dated sequencing statements
  that made the native debt a Unit 7 blocker, for current routing only; it does
  not change the Unit 6 SDD, acceptance criteria, or evidence classification.
- This reconciliation changed documentation only. No application code,
  migration, test, Supabase/Storage state, deployment, runtime, provider,
  inventory, listing, or publication state was changed.

### 2026-08-12 — Unit 7A create-only SDD freeze

- The normative Unit 7A SDD now specifies one explicit eligible candidate
  commit to one newly created private inventory row using only the current
  server-held saved review and current candidate/review/metadata revisions.
- The load-bearing red-test contract covers saved-review authority, exact
  quantity initialization, tenancy/non-enumeration, version fences, create-only
  cardinality, replay, changed replay, same-candidate concurrency, rollback,
  canonical immutability, private-media isolation, and durable provenance.
- Forward migration is assessed as required because the applied M05 boundary
  accepts caller business/duplicate fields and lacks current review/metadata
  fencing. M09/global quantity validation is not required by Unit 7A.
- Verification this session is documentation-only. No Unit 7A test was created
  or executed; no production/migration file, database/Storage state, deployment,
  provider call, inventory/listing/publication effect, stage, commit, push, or
  PR occurred. Next gate: separately authorize load-bearing red tests.

### 2026-08-12 — Unit 7A local implementation closeout

- Scope: implemented only the frozen Unit 7A create-only command across the
  database, Owner Edge boundary, and mobile review path. Unit 7B publication,
  Unit 7C editing, live application/deployment, and external data creation were
  excluded.
- Database: local M39 adds the current-revision-fenced, server-authoritative,
  authenticated create command; initializes balanced quantity buckets; writes
  inventory, candidate/session, audit, event, and idempotency effects atomically;
  and revokes the unsafe M05 callable instead of deleting legacy objects.
- Client: the review path no longer exposes or requires duplicate intent. Add
  to inventory is online-only, non-optimistic, identity/route fenced, supports
  exact ambiguous retry, refreshes on version conflict, and invalidates the
  exact private read surfaces after canonical success.
- Verification: the dedicated suite was red 13/13 before M39 and green 13/13
  after implementation. Phase 9 Edge/mobile/migration regression passed 42
  suites and 479/479 tests. TypeScript passed with
  `--allowImportingTsExtensions`; unflagged output remained limited to known
  TS5097 Deno import-extension configuration errors.
- Security: local tests prove cross-store/actor denial, non-enumerating failures,
  current revision fences, exact replay, changed replay, same-candidate
  contention, rollback on forced audit failure, immutable canonical data,
  private inventory/media behavior, and reciprocal provenance. Live ACL/RLS
  readback is deliberately pending because M39 is unapplied.
- External state: fresh read-only MCP preflight only. No migration application,
  database/Storage/queue/provider mutation, deployment, inventory/listing/
  publication effect, stage, commit, push, or PR occurred.
- Detailed evidence and the exact next gate are in
  [tracker 29](./29-unit7a-create-only-commit-evidence.md).

## Unit 7A live proof PASS - 2026-08-12

- Live proof complete: one Owner UI commit plus exact same-command replay,
  with zero replay effects. Detailed evidence is in
  [tracker 29](./29-unit7a-create-only-commit-evidence.md).
- Implementation status: `unit7a_live_proof_pass`.
- Next gate: Unit 7B publication, separately gated.

## Unit 7B Sol Light correction closure - 2026-08-13

- Findings 001–006: `CLOSED`; factual evidence finding 008: `CLOSED`.
- Unit 7B disposable 27/27; actual database-to-Edge-runtime-to-decoder-to-
  query/UI 4/4; focused Jest 25/25; Unit 7A plus dispatcher 42/42.
- Real PostgreSQL M01–M40 upgrade and active-listing/RT05/RT07/RT12/Owner-
  reauthorization concurrency: PASS. Deno, TypeScript, four builds,
  entrypoint smoke, and deployment-runtime validation: PASS.
- Full PGlite: 281/282 on unchanged metadata fixture. Broad Jest: 2010 real
  tests pass; only six unchanged empty collectors fail.
- Docker container smoke: `NOT_RUN/BLOCKED_ENVIRONMENT` because the installed
  engine is unresponsive. M39 is unchanged; M40 is not applied. No connected
  mutation, deployment, live proof, Unit 7C, or main integration occurred.
- Exact next action: actual Luna xhigh full independent review. Review remains
  `NOT APPROVED`; do not begin connected exact-project preflight.

## Unit 7B bounded subscription-order follow-up - 2026-08-13

- The new `CORR-001 latest subscription status overrides stale allowed history`
  case was red before the correction and green afterward.
- The shared M40 eligibility primitive now orders subscription rows by
  `updated_at DESC, id DESC`, so the latest `cancelled` or `restricted` row
  cannot be bypassed by older allowed history.
- Correction matrix: **6/6**; focused migration assertions: **4/4**;
  Owner-publication, discovery, and worker suites: **20/20**.
- No connected state, migration application, deployment, or live proof occurred.
  The correction commit is integrated on the feature branch. The exact-SHA
  release gate is the next authorized action.
