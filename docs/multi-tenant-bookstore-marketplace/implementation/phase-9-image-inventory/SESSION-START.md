# Phase 9 Development-Session Start and Handoff Protocol

**Status:** active continuity protocol
**Last updated:** 2026-08-21
**Applies to:** AI/human development sessions, not bookstore inventory-capture sessions

This is the deterministic resume procedure for Phase 9. A new session should recover the current state from files and verified systems, never from chat memory alone.

The one startup chain is repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → this `SESSION-START.md` → Phase 9 `TRACKER.md`. `AGENTS.md` is always the first entrypoint; this file refines the Phase 9 portion of that repository-level sequence.

## Current 2026-08-21 Unit 8 closure overlay

Unit 8 is repository-complete and ready for closure. M49-M51 remain
repository-only and unapplied. The final media invariant requires each publicly
eligible link to occupy a unique non-null `public_order` in `1..3`; Q10 returns
at most three in `public_order,id` order, and the client enforces the same
contract. `canonical_edition_exact` is reserved/unreachable in text-query v1.
Four logical local commits were prepared. No push/merge, migration-history
repair, Vault provisioning, live application, or deployment is authorized by
this handoff.

## Prior 2026-08-20 Unit 8 design-freeze overlay

Current phase: Phase 9 — Image-Assisted Inventory.
Planning/implementation status: Unit 7C M46 correction, the resumed connected
canary, and the bounded legacy Marketplace RPC security correction are PASS;
the authoritative Unit 8 Marketplace SDD is frozen and the smallest authorized
U8B corrective scope is locally complete, operationally pending independent
review.
WU1 through WU5 remain locally complete; M43/M44/M45 are applied exactly once,
M46 is applied exactly once as `20260816150126`, M47 is applied exactly once
as `20260817073341`, and M48 is applied exactly once as `20260817075825`,
and exact source HEAD `5cfc08ebbe8b20a94cbf6d0616d894a840bc8882` remains
deployed only as Owner Edge version 8 with JWT verification enabled. The
proven M46 correction is committed at
`f4a9e858396474dcd08123eb976a47b019ef26f8`. Unit 7B remains live-verified and
integrated into `main` at `53edbddc9c5417b34cb169599e8282b162e183b3`. Unit 6F
native validation remains deferred `NOT_RUN`/`UNRESOLVED`, not PASS.
Last completed milestone: the bounded U8B correction after the M47/M48
customer-boundary prerequisite: provenance-qualified cover fallback, effective
policy cursor binding, bounded malformed-cursor errors, full U8B tests, and a
disposable real-PostgreSQL acceptance path. M49 remains unapplied live. The
earlier M48 trusted-role compatibility correction after the M47
RED/GREEN correction, exact disposable M01→M46 proof, one live M46
application/readback, authenticated private-only Save reproof, and the bounded
stale/stock/publication/media/history/browser canary.
The final canary preserved the customer projection and ended at inventory
version `6`, publication intent version `4`, four revisions, nine audit/events,
one approved public media link, and stable listing identity.
Active work unit: `unit8_u8b_independent_rereview_pending`.
The authorized branch publication and merge are complete at merge commit
`2be793e6212b1b485737c5045d701c99169490e4`. Next exact action: independent
U8B re-review/closure. Migration-history reconciliation, dedicated Q08 Vault
provisioning, live Supabase verification, M49 application, and U8C remain
separately authorized work.
Blockers/gates: Playwright CLI remains `NOT_RUN_ENVIRONMENT`; full repository
TypeScript has an unchanged WU4 E2E typing error; production rollout, payments,
Phases 7/8, M09, and unrelated Unit 6F native validation remain separately
gated. The connected Unit 7C canary matrix is complete for this bounded proof.
Unrelated worktree changes must be preserved.
Supabase mutation authority for this handoff: none. M47/M48 remain the live tail;
M49 is repository-only and was exercised only in disposable databases. No
migration-history repair, Vault provisioning, M49 application, second deployment,
direct SQL repair, historical-row rewrite, U8C implementation, or further
connected mutation is authorized by this document.
Connected side effects: the earlier M46 reproof preserved the historical false
revision; the resumed canary ended at inventory version `6`, publication-intent
version `4`, published/active/low-stock, quantity `1/1/0/0/0`, one stable
listing, four revisions, nine audit/events, one approved public media link, and
two relevant media assets. No Edge redeploy occurred.

Exact live target: Supabase project `Bookconnect_reactexpo`, ref
`ahntbtktjjmvfosgkmgn`, host `https://ahntbtktjjmvfosgkmgn.supabase.co`,
`ACTIVE_HEALTHY`, region `ap-southeast-2`. The checked-out branch is
`main` containing merge commit `2be793e6212b1b485737c5045d701c99169490e4`; preserve unrelated
untracked `.zcode/` and `docs/codemap/` changes.

M39 (`20260812003419`), M40 (`20260813000040`), M41 (`20260813070104`), and
M42 (`20260814013536 marketplace_phase9_generated_authors_projection`) are
live exactly once and immutable. M41 changed exactly three
provenance-qualified candidate-derived development rows from
`missing_metadata` to `ready`; all remained draft/private. M42 removes the
listing-sync assignment to generated `marketplace_book_listings.authors_text`
and leaves the generated column database-owned.

M43 (`20260814000043_marketplace_phase9_unit7c_inventory_management.sql`) is
applied live as `20260816122822`. It adds WU1 Store View reads, atomic Save,
stock v2, safe public revisions, and the Unit 7B lifecycle/projection
integration. The exact M43 disposable PostgreSQL vertical passed, and live
readback shows the revision table with RLS enabled and zero rows.

M44 (`20260814000044_marketplace_phase9_store_view_filter_contract.sql`) is
applied live as `20260816122901`. It adds authenticated page v2 with
actor/store/filter-bound cursors; it uses
`attentionState = action_required` for `needs_attention` and `effectiveState`
for the other named state filters. The corrected WU2A integration is 3/3,
M44 migration Jest is 5/5, M43 regression is 15/15, and exact M01–M44 plus both
real PostgreSQL verticals pass. M39–M44 remain byte-immutable.

M45 (`20260815000045_marketplace_phase9_unit7c_media_history.sql`) is applied
live as `20260816122929`. It adds bounded media/history authorization and
read/reorder/remove/replace functions, exact replacement targets, and the
allowlisted Owner history read. The exact M45 media/history vertical passed
12/12 locally; final live readback shows the expected public functions and
media capability columns. M46 is live exactly once as
`20260816150126 marketplace_phase9_unit7c_private_save_revision_correction`.
Its focused correction and connected private-only Save reproof passed; no
business-row repair, Storage mutation, or Edge redeploy occurred.
M47 (`20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql`)
is applied exactly once as `20260817073341`. It revokes all non-owner execution
on the obsolete projection-row catalogue/detail RPCs; the safe v2 JSON RPCs,
business rows, Storage, and Edge deployments are unchanged.

M48 (`20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql`)
is applied exactly once as `20260817075825`. It precisely reasserts customer-role
denial with `REVOKE EXECUTE` and restores only trusted `service_role` execution.
No repository, SQL-function, or live Edge Function caller was found; the grant
is retained as a narrow compatibility allowance. Explicit anon/authenticated
calls fail with `42501`, service-role detail execution succeeds, and both safe
v2 JSON functions remain callable without `inventory_id`.

### Live Unit 7B proof and current development configuration

- `The Birth of Tragedy` completed Publish -> anonymous discovery with exactly
  one listing -> Pause/removal -> Republish with exactly one listing.
- A controlled transient projection failure produced one `publication_failed`
  state and one retry job; the worker resolved it. A stale-intent retry was
  fenced with `P9_STATE_CONFLICT`.
- Final connected readback preserved inventory identity and quantity, showed
  `published` inventory/publication state, one active listing for the selected
  row, and zero outstanding publication retries.
- The existing live `active_listing_limit` row is explicitly tagged
  `unit7b_dev_rollout`; its value is now `10` (previously the temporary value
  `1`). The authoritative derivation passes for the other ready rows;
  `Café du Livre` remains blocked by `price` because its price is zero.
- Main integration is complete at merge commit
  `53edbddc9c5417b34cb169599e8282b162e183b3`. No Unit 7C action or additional
  live migration/business-row mutation was performed.

## Historical 2026-08-14 pre-M42 resume overlay (superseded)

Resume only the Phase 9 Unit 7B runtime rollout. The exact development target is
Supabase project `Bookconnect_reactexpo`, ref `ahntbtktjjmvfosgkmgn`, host
`https://ahntbtktjjmvfosgkmgn.supabase.co`, status `ACTIVE_HEALTHY`, region
`ap-southeast-2`. The checked-out branch is
`codex/phase9-unit7b-publication` at HEAD
`c3c2726f4ec1455aa7f8cc2f16d206a9021d3649`. Preserve unrelated untracked
`docs/codemap/` changes.

M39 (`20260812003419`) and M40 (`20260813000040`) are live exactly once and
immutable. M41 (`20260813070104 marketplace_phase9_unit7a_quality_handoff`)
was applied exactly once on the verified target. Its deterministic handoff
changed exactly three provenance-qualified candidate-derived development rows
from `missing_metadata` to `ready`; all three remained draft/private. No manual
row repair was used.

### Latest runtime overlay — generated-column blocker

This subsection supersedes the older missing-worker wording below. Render
service `phase9-publication-worker` / `srv-d9v6gsc9v7es73f1d6o0` is live from
exact commit `c3c2726f4ec1455aa7f8cc2f16d206a9021d3649`; deploy
`dep-d9v6gss9v7es73f1d7e0` is live, auto-deploy is off, and readback returned
`/health=alive` and `/ready=ready`. Supabase Vault contains the worker URL and
matching ingress token.

The authorized live business test stopped at the first normal Owner UI Publish
for eligible private inventory `461fa328-d95b-4573-965a-1eaa4be61ba1`.
Owner Edge v7 returned HTTP 500, and PostgreSQL logged `cannot insert a
non-DEFAULT value into column "authors_text"`. Live schema proves
`marketplace_book_listings.authors_text` is generated from `public_authors`,
while M40's listing-sync function explicitly inserts and updates it. The
transaction rolled back: the row remains draft/private with zero listings and
zero publication retries. The explicit no-M42 instruction remains in force;
stop and request authorization before any forward-only database correction.

`phase9-owner-ingestion` Edge version **7** is ACTIVE with JWT verification
enabled. The dashboard readback contains the complete checked-in transitive
source closure and the publication action tree. The dashboard exposed neither a
deployment UUID nor a Git SHA; the source was loaded from the branch HEAD above.
No other Edge Function changed, and no database, Storage, or business-row
mutation occurred during that deployment checkpoint.

Render workspace `tea-d9j67irtqb8s739ritc0` was enumerated through the available
authenticated API listing. It contains only `phase9-metadata-worker`,
`phase9-fixture-vision`, and `phase9-media-sanitation`; no
`phase9-publication-worker` exists. The browser dashboard check was at login.
The attempted supported creation request was rejected before mutation because
it would transmit the Supabase `service_role` credential and a new worker
ingress token to a public Render service. Therefore no Render service,
environment variable, or deploy was created.

The live business test **Publish → Discover → Pause → Republish** is
`NOT_RUN/BLOCKED_RUNTIME`; there are no live business-test effects to report.
The next session must use the authenticated Render dashboard to provision or
identify the approved publication worker, configure secrets without printing
them, deploy it, and capture health/readiness evidence. Stop before the live
business test and obtain separate explicit authorization for that test.

The current Codex process had a foreign `SUPABASE_URL` host while the available
service-role JWT identified the target ref. This was process-only; user/machine
environment scopes were unset and the project `.env` already contains the target
application URL. Explicitly set the target URL for new runtime commands and do
not print or paste any secret. Do not reapply M39/M40/M41, create M42, perform
direct SQL as live proof, repair rows manually, start Unit 7C, deploy unrelated
services, or merge to `main`.

Historical corrected-tree handoff (superseded by the live rollout closeout above):
the approved Sol Light findings 001–006 are locally `CLOSED`, and finding 008
has been updated factually. Corrected Unit 7B disposable tests pass 27/27; the
actual database-to-Owner-Edge-runtime-to-client-decoder-to-query/UI gate passes
4/4; real PostgreSQL M01–M40 upgrade and active-limit/RT05/RT07/RT12/Owner-
reauthorization concurrency pass; and Deno, TypeScript, four worker builds,
entrypoint smoke, and deployment-runtime validation pass. Full Phase 9 PGlite
is 281/282 on the unchanged metadata-foundation fixture. Broad Jest passes
2010 real tests and fails only the six unchanged empty collectors. Docker
container smoke is `NOT_RUN/BLOCKED_ENVIRONMENT` because the installed engine
is unresponsive. M39 remains Git blob
`1154054240042863083aa2aa32c67bc18e46f71d`; M40 is unapplied. Review remains
`NOT APPROVED`; the exact next action is actual Luna xhigh full independent
review. Connected preflight/application, deployment, live proof, Unit 7C, and
main integration remain unauthorized.

Historical pre-correction operational closure: M29-M39 are live exactly once; exact-project
history ends at `20260812003419 marketplace_phase9_create_only_inventory_commit`.
Unit 7B independent review remains `NOT APPROVED`; local remediation is
implemented for seven merge blockers covering the public-copy media pipeline,
committed-transient worker handling, incomplete §19 subcases, media-driven
projection refresh/retraction, under-lock retry reauthorization, failed-state
cancellation UI, and overstated documentation. The expanded disposable suite
passes 22/22. The focused backend, Unit 7A, prior worker-kind/runtime,
TypeScript, four worker builds, entrypoint, deployment-runtime, and focused
mobile assertion gates also pass. Under the Owner's 2026-08-12 sequencing
decision, the scoped review-candidate branch is committed and pushed for Luna
xhigh review. Real-PostgreSQL
concurrency, Docker container smoke, and the Deno Edge graph remain `NOT_RUN`,
are deferred rather than skipped, and are all `REQUIRED_BEFORE_LIVE` on the
final post-correction SHA before the Stage J exact-SHA release gate. The
unrelated full PGlite result remains 276/277 on the unchanged
metadata-foundation fixture, while repository Jest passes all 2012 real tests
and fails only six pre-existing empty fixture/support collectors. Forward M40 is
unapplied. Exact-project preflight/application, Edge/worker deployment,
and all live Unit 7B proofs remain `NOT_RUN` and unauthorized. See
[tracker 30](./trackers/30-unit7b-safe-publication-evidence.md).
The user's 2026-08-10 decision retains Remove image and replaces append-style
multi-image capture with one current image plus one replacement after explicit
pre-candidate removal. M35 is live, the three authorized legacy inputs were
logically removed, and Owner Edge v3 is the historical single-image checkpoint.
Unit 7A's corrected Owner Edge is now version 5 ACTIVE and its completed live
proof is recorded below. One new input was registered after removal and must not
be removed or otherwise mutated without a new explicit target decision.

Current routed handoff: Unit 6's automatic/functional pipeline is **PASS**.
Approved `main` SHA `a138baa7d3bbc086da019bc052a5ae31d0e15882` contains the
reviewed M38/runtime correction. M38 is live once; metadata was deployed once
from that SHA; and one authenticated Owner upload automatically completed
media, vision/Gemini, six metadata jobs, and the Needs Review UI. There were
zero manual runs, claims, repairs, or operator retries; inventory/listings
stayed 5/5 and the historical dead-letter job was untouched. Unit 7A is now
locally implemented as described below. Native Unit 6F validation remains
deferred `NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery
physical-device parity, native recovery/reconnect, 15-card representative-device
performance, offline/reconnect, accessibility/large text, and low-end Android
resource/performance. The project owner accepts this deferred validation risk
and authorizes Unit 7 to begin in a new bounded session.

Current active implementation handoff: Unit 7A is frozen and implemented
as a create-only private inventory commit. Read
[the Unit 7A SDD](./work-units/07a-create-only-inventory-commit-sdd.md) before
any red-test or implementation work. One eligible reviewed candidate creates
one new row from the server-held saved review; duplicate lookup/merge/increment/
manual-match/keep-separate behavior is excluded, and publication is Unit 7B.
The Unit 6 duplicate UI/DTO path is superseded for Unit 7A and is now
non-actionable/non-blocking. The reviewed implementation SHA is
`e2437f18e9489b1e03c27858342b44737522d4e8`; dedicated PGlite is 13/13,
Phase 9 Edge/mobile/migration regression is 479/479, and TypeScript passes with
the documented import flag. Exact-project preflight plus real independent-
connection PostgreSQL contention passed. M39 is live exactly once as
`20260812003419 marketplace_phase9_create_only_inventory_commit`; post-apply
function/ACL/M05 readback passed and migration application created no business
effect. Read [tracker 29](./trackers/29-unit7a-create-only-commit-evidence.md).
The post-M39 checkpoint is committed and pushed. `phase9-owner-ingestion` is
version 5 ACTIVE with the `add_to_inventory` member in the `allowedActions`
enum in `ownerUxResponses.ts`; this resolved the
`OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` that blocked candidate
detail. At 04:41 UTC, the authenticated Owner committed candidate
`f6266e3a-e920-4fa0-a993-c02c739f5108` from session
`166a20cb-c919-4e06-8e4a-1cd53e4ef393`, creating inventory
`5f5a2bc9-d702-4aeb-af55-2a9df6c16478`. At approximately 05:00 UTC, the exact
original command replay returned the canonical recorded result and created no
new effects. `UNIT_7A_LIVE_PROOF` is PASS and the
`UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY` gate is CLEARED. No further
Unit 7A runtime action is authorized. Unit 7B publication, Unit 7C post-commit
edits, manual RPC fallback, and merge to `main` remain separately gated.

Latest controlled-proof update: the first commit readback shows
`created_from_candidate_id=f6266e3a-e920-4fa0-a993-c02c739f5108`,
`entry_method=image_extraction`, `visibility_status=draft`,
`publication_status=private`, `selling_price_minor=250000`, and quantities
`1/1/0/0/0`; candidate outcome is `committed_private` and session
`committed_count=1`. The exact replay used the original idempotency key and
command with expected versions `2/1/4`, returned inventory version `1` and
candidate version `3`, and read back one completed idempotency row, one audit
log, and one event. Replay side effects were zero. `Thinking, Fast and Slow`
remains uncommitted (`review_ready=false`) and is outside this proof.

Current local correction: user-supplied 2026-08-11 physical Android evidence
proves the Expo FileSystem `UploadTask` replacement reached signed Storage
`2xx`, created exactly one object, registered input
`a1c8e286-07f2-40c5-9bbd-2fed49c5148d`, and completed media sanitation. Vision
job `20734f70-dd4c-4f68-87d5-aa837cb32b7d` then received parseable Gemini JSON
and failed permanently as `P9_VISION_SCHEMA_INVALID`; the removed/skipped input
must not be revived. The bounded local decoder correction now converts 16-100
reported observations into complete-image `too_many_books`, degrades only safe
bounded unknown human language labels to `und`, preserves original Unicode,
isolates malformed optional enrichment, and logs only closed content-free schema
diagnostics. Resilience is 21/21, existing analyzer/captured payload plus
resilience is 46/46, focused worker/extraction/multilingual/security/Unit 6
polling is 120/120, Image Inventory is 39 suites and 294/294, and repository
TypeScript plus the vision-worker build pass. Exact next action is bounded
review; deployment and one fresh post-deployment Android image proof require
separate authorization. The native Unit 6F debt remains tracked and is not a
Unit 7 blocker under the owner-authorized sequencing decision.

Current routed handoff: Unit 6A is merged/live-verified through M29, Unit 6B is
merged at `9ef9eb3` with [tracker 20](./trackers/20-unit6b-route-query-cache-evidence.md),
and Unit 6C is merged through `092562d`. Unit 6D — Owner
candidate review and strict editing — remains implemented at `c363b60` with
[tracker 22](./trackers/22-unit6d-candidate-review-evidence.md). Unit 6E
false/missed-variant corrections are finalized at correction checkpoint
`8bceab260a953b4d832fd55f34f58db12fa009b1`; [tracker 23](./trackers/23-unit6e-review-corrections-evidence.md)
owns the exact diff-only closure, M30 application, remote readback, bounded
browser-smoke receipt, and handoff. M30 is live exactly once as
`20260801093048 marketplace_phase9_unit6e_review_corrections`; no other
migration, Supabase/Storage, deployment, provider, inventory, publication, or
commerce mutation occurred. Unit 6F browser/readback verification and local
quality gates are recorded in [tracker 24](./trackers/24-unit6f-readiness-quality-gates-evidence.md);
the representative low-end Android Unit 6F evidence remains outstanding as
deferred validation debt; it is not marked PASS and is not a Unit 7 blocker
under the current owner-authorized sequencing decision.

WU1 and WU2 remain complete at their recorded levels. M32 is now live exactly
once as `20260808020404 marketplace_phase9_structural_metadata_integration` on
the verified development project. The controlled live proof configured one
Google Books registry row and stopped before candidate creation because the
approved local environment lacks the exact target-project service credential,
the Gemini live configuration, and the required Google Books credential. The latest local H1/H2/H3
evidence remains green: focused Jest is 97/97, structural PGlite is 14/14,
metadata foundation is 13/13, and vision/M32 PGlite is 40/40:
vision candidate creation and metadata-job creation share one PostgreSQL
transaction, the worker loads and mutates the same candidate through claim-token
fencing, provider HTTP work occurs outside database transactions, and replay-safe
terminal outcomes use the existing M15 contract. Google Books remains the only
implemented provider adapter; no automatic dispatch was added. No fresh session,
input, candidate, metadata job, provider call, or Owner readback was created in
the blocked live proof. The next authorized action is to configure the exact
target-project service credential and Google Books credential through the approved
secret mechanism, then rerun the bounded proof. Unit 6F native evidence and the
remaining runtime gates stay open.

The 2026-08-09 bounded metadata-runtime safety unit is locally implemented:
shared worker startup accepts only the exact approved Supabase HTTPS origin;
metadata has no peer worker and no longer accepts the media/vision peer hash;
media/vision peer distinctness remains mandatory; and the existing manual
invoker supports `metadata` with the same bounded body, timeout, and safe output.
Secrets remain process-only. Focused Jest is 84/84 and the metadata worker build
passes. Exactly one process-only Google Books adapter request returned HTTP 200;
the credential was accepted, the response stayed within bounds, and the decoder
produced a valid provider-neutral `no_acceptable_match` result. No privileged
worker, candidate, database mutation, provider persistence, Render/Gemini change,
or deployment occurred. The next gate is separate authorization for
`CONTROLLED_ONE_CANDIDATE_METADATA_VERTICAL_PROOF` plus safe process-only
injection of a fresh process-only Google Books key after revocation of the
chat-exposed temporary key. A 2026-08-09 recheck proved the inherited service-role
key belongs to and is accepted by the exact project; the inherited `SUPABASE_URL`
alone is foreign and must be overridden before worker startup.

## 1. Canonical status source

After entering through repository `AGENTS.md`, the active router, DOC-13, and this protocol, read [TRACKER.md](./TRACKER.md) and extract these fields:

- planning status;
- implementation status;
- current milestone;
- active work unit;
- last completed unit/evidence;
- next authorized action;
- blockers and external/migration authority.

DOC-13 must agree on the active phase. `implementation/ACTIVE.md` must route here. If either conflicts, documentation reconciliation is the only safe task until the conflict is resolved.

## 2. Mandatory startup sequence

1. Run `git branch --show-current`, `git rev-parse --show-toplevel`, and `git status --short`.
2. Read repository [`AGENTS.md`](../../../../AGENTS.md).
3. Read [`implementation/ACTIVE.md`](../ACTIVE.md).
4. Read [DOC-13](../../DOC-13-implementation-tracker.md).
5. Read this `SESSION-START.md`, then [TRACKER.md](./TRACKER.md).
6. Read [the master SDD](./00-phase-9-master-sdd.md), especially invariants, work-unit order, and continuity contract.
7. Read [the implementation tracker](./trackers/02-implementation-and-verification.md) to learn whether a work unit is authorized and what evidence already exists.
8. Use the work-unit routing table below to read only the relevant domain SDDs and supporting files.
9. Inspect current code/migrations/tests in the affected area. Planned target tables are not evidence that they exist.
10. For database/storage uncertainty, use Supabase MCP and verify the exact project before relying on results.
11. Give the user the resume brief below before editing or acting.

## 3. Required resume brief

Every new session begins with a concise statement containing:

```text
Current phase:
Planning/implementation status:
Last completed milestone:
Active work unit:
Next authorized action:
Blockers/gates:
Supabase mutation authority for this session:
Files expected to change:
```

Do not describe an action as authorized merely because it is listed as a future work unit.

## 4. Work-unit reading router

| Work unit | Required design reading | Required supporting reading |
| --- | --- | --- |
| Planning/review | Master SDD and all changed domain SDDs | decisions tracker, traceability, complexity register |
| 0 Contracts/threat/migration plan | 00 Master; 01 Data; 02 Pipeline; 04 Security | data dictionary, current-vs-target audit, traceability |
| 0A Contracts/tests (only if authorized) | 00 Master; 01 Data; 02 Pipeline; 03 Review; 04 Security; 05 Marketplace | approved WU0 plan, data dictionary, traceability, implementation tracker |
| 0B Backend/API technical design or review (only if authorized) | 00 Master; 01 Data; 02 Pipeline; 03 Review; 04 Security; 05 Marketplace; 06 Photo Request | [WU0B authority/router](./work-units/00b-backend-api-technical-design-plan.md), all seven linked `00b-technical-design/` artifacts, approved WU0 plan, both detailed trackers, data dictionary, current-vs-target audit, traceability, complexity register, WU0A package README/registers/red gates, and inspected boundary source listed by the router |
| 1 Data/metadata migration | 01 Data; 03 Review; 05 Marketplace | data dictionary, current-vs-target audit, migration ledger |
| 2 Session/job schema | 02 Pipeline; 03 Review; 04 Security | data dictionary, current-vs-target audit |
| 3 Media boundary | 04 Security; 02 Pipeline; 03 Review | data dictionary, live storage audit, DOC-1 |
| 4 Vision adapter | 02 Pipeline; 04 Security | [Unit 4 fixture vision-analysis design](./work-units/04-fixture-vision-analysis-runtime-design.md), current vision contracts, exact-project schema/grant evidence |
| 4A Deployment-runtime scaffolding | 02 Pipeline; 04 Security | [Unit 4A deployment-runtime SDD](./work-units/04a-deployment-runtime-scaffolding-sdd.md), [Unit 4A evidence](./trackers/04-deployment-runtime-scaffolding-evidence.md), Unit 3/4 evidence, current worker/Owner entrypoints and deployment configuration |
| Service deployment/live fixture verification | 02 Pipeline; 04 Security | [Unit 4A deployment-runtime SDD](./work-units/04a-deployment-runtime-scaffolding-sdd.md), [M11/M12 live-application evidence](./trackers/05-m11-m12-live-application-evidence.md), current-vs-target audit, migration ledger, current worker/Owner entrypoints, environment loaders, container/deployment validators, hosting configuration, and fresh exact-project service/function readback |
| 5 Metadata/aliases | 01 Data; 02 Pipeline; 03 Review; 04 Security; 05 Marketplace | Unit 5A/5B handoffs/evidence, [Unit 5C Lite](./work-units/05c-lite-multilingual-search-variants-sdd.md), data dictionary, current-vs-target audit, requirements traceability, complexity register, provider audit/fixtures |
| 6 Owner UX | [Unit 6 SDD](./work-units/06-owner-capture-review-recovery-ux-sdd.md); [contract matrix](./work-units/06-owner-capture-review-recovery-contract-matrix.md); 03 Review; 02 Pipeline | [tracker 18](./trackers/18-unit6-owner-ux-design-evidence.md), DOC-8, accessibility/verification matrix |
| WU1/WU2 Owner inventory read boundary/client | [WU1](./work-units/owner-inventory-read-boundary-wu1-sdd.md); [WU2](./work-units/owner-inventory-read-client-wu2-sdd.md); 00 Master; 03 Review | [tracker 25](./trackers/25-owner-inventory-read-boundary-wu1-evidence.md), [tracker 26](./trackers/26-owner-inventory-read-client-wu2-evidence.md), DOC-8 §5, current-vs-target audit, requirements traceability |
| 7A Create-only private inventory commit | [Unit 7A SDD](./work-units/07a-create-only-inventory-commit-sdd.md); 00 Master; 01 Data; 03 Review | Unit 6 SDD/contract transition, DOC-3/4/8, quantity/hold invariants, current-vs-target audit, traceability |
| 7B Publication/projection | 03 Review; 05 Marketplace | private/public projection and current trigger audit; separately authorized after 7A |
| 7C Owner Store View/post-commit management | [Unit 7C SDD](./work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md); [Unit 7B SDD](./work-units/07b-publication-sdd.md); 00 Master; 01 Data; 03 Review; 04 Security; 05 Marketplace | DOC-3/4/5/8; Unit 7A; current trigger/RPC/media code and migrations; current-vs-target audit; traceability; implementation tracker |
| 8 Marketplace | [Unit 8 bookstore-first SDD](./work-units/08-marketplace-bookstore-first-sdd.md); 05 Marketplace; 01 Data | DOC-0, DOC-3, DOC-5, Unit 5C, Units 7A/7B/7C, WU0B Q07-Q10, public/private tests |
| 9 Damage/request photos | 04 Security; 06 Photo Request; 03 Review | DOC-1, DOC-6, DOC-14, retention matrix |
| 10 Lifecycle worker | 04 Security; 02 Pipeline | retention/deletion fields and ops checks |
| 11 Pilot verification | all seven SDDs | traceability, full verification tracker, rollout gates |

## 5. Supabase/database gate

Before migration planning or any database/storage work:

1. Use Supabase MCP to verify project identity. The last read-only evidence is recorded in [database-current-vs-target.md](./supporting/database-current-vs-target.md), but it must not be assumed current.
2. Re-query affected tables, constraints, indexes, policies, grants, functions, triggers, buckets, storage policies, migrations, and advisor findings.
3. Update the current-vs-target audit when fresh evidence changes the plan.
4. Distinguish three permissions in the tracker: migration plan, migration-file creation, and live application.
5. Use the migration ledger for every created/applied migration. DDL application requires exact-project readback and separate authorization.

## 6. Documentation update matrix

| Change made or discovered | Documents that must be updated in the same session |
| --- | --- |
| Product decision or scope | owning root DOC; owning domain SDD; planning decision tracker; requirements traceability; master SDD if cross-domain |
| Architecture/workflow/state | owning root DOC; master/domain SDD; traceability; implementation tracker; DOC-14 for commerce state changes |
| Schema/field/constraint/index | 01 Data or owning SDD; data dictionary; current-vs-target audit; migration ledger; implementation verification |
| RLS/grant/function/trigger/storage | 04 Security or owning SDD; current-vs-target audit; security verification matrix; migration ledger |
| Model/provider contract | 02 Pipeline; 04 Security where relevant; fixture/schema record; implementation log |
| Owner review/inventory behavior | DOC-3/DOC-4/DOC-8 as applicable; 03 Review; traceability; tests/evidence |
| Marketplace behavior | DOC-0/DOC-3/DOC-5; 05 Marketplace; traceability; public/private verification |
| Customer photo behavior | DOC-1/DOC-6/DOC-14; 04 Security; 06 Photo Request; traceability |
| Code/test completion | implementation tracker work-unit row, verification checklist, append-only log; master tracker milestone |
| Migration created/applied | migration ledger; implementation log; current-vs-target audit; master tracker; DOC-13 if milestone/risk changed |
| New decision/deviation/blocker | decision tracker or implementation log; owning SDD; master tracker; DOC-13 when globally material |
| Work-unit transition within Phase 9 | phase tracker; implementation tracker; DOC-13; Phase 9 README when routing/handoff changes |
| Active phase transition | phase tracker; implementation tracker; DOC-13; ACTIVE.md; repository AGENTS pointer; README/handoff files |

Updating only a tracker is insufficient when behavior, security, schema, or acceptance criteria changed.

## 7. During-session rules

- Work on one authorized work unit at a time unless the approved plan explicitly groups inseparable changes.
- Start deterministic behavior with failing tests/fixtures; model output uses schemas and recorded fixtures, not exact prose assertions.
- Preserve Phase 6 quantity/hold and controlled-write boundaries.
- Keep Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement behavior out of Phase 9.
- Do not infer migrations/tables/functions from target documentation; inspect local and live evidence.
- Record deviations immediately instead of waiting for session close.
- Keep the master tracker concise; detailed evidence belongs in its routed tracker.

## 8. Mandatory closeout transaction

Before ending a session with material work:

1. Update the active work-unit status and append the implementation/planning log entry.
2. Record exact files/components/migrations affected.
3. Record tests and security checks actually run, with counts/results where available.
4. Record Supabase project verification and every external mutation, or explicitly record none.
5. Update all documents required by the matrix above.
6. Set the tracker to one exact next authorized action and identify any blocker/approval needed.
7. Run [the continuity validator](./scripts/validate-phase9-continuity.ps1) and applicable code/test commands. On Windows systems with local script execution disabled, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1"` from the repository root.
8. Run `git status --short` and `git diff --check`.
9. Tell the user what remains uncommitted and whether anything was staged, committed, pushed, deployed, or applied.

Implementation log entries use this shape:

```text
Date/session:
Authorized work unit and scope:
Completed:
Files/components/migrations:
Verification actually run:
Supabase/external mutations:
Decisions/deviations/risks:
Tracker/source-doc updates:
Next authorized action and gate:
```

## 9. Drift prevention

- One status fact has one owner: DOC-13 globally, TRACKER.md locally, implementation tracker for evidence.
- README and ACTIVE.md route; they do not replace trackers.
- SDDs own intended behavior; they do not claim implementation completion.
- Current-vs-target audit distinguishes observed live state from proposed state.
- Chat summaries are not copied into docs without checking the authoritative files and live evidence.
- Old generic root kickstart files are not Phase 9 status sources.
