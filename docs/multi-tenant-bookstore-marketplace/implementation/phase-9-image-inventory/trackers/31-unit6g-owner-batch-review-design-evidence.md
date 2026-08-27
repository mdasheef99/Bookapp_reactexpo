# Phase 9 Unit 6G Owner Batch Review Design Evidence

**Status:** `unit6g_fa_001_ready_for_independent_review`
**Date:** 2026-08-27
**Branch:** `codex/phase9-unit6g-recomposition`
**Worktree:** `C:\Users\user\Documents\augment-projects\Bookconnect_expo\.worktrees\phase9-unit6g-recomposition`
**Current evidence:** §11 supersedes older “next action” statements without
rewriting or deleting their historical record. M52 remains live as
`20260822025712` with its recorded connected proofs.

> **HISTORICAL SCOPE BANNER — §§1–9:** Sections 1 through 9 preserve evidence
> recorded during the 2026-08-21 Group 1 design, implementation, and correction
> passes. Their phrases “current boundary,” “current implementation,” “M52
> remains unapplied,” structural counts, and “exact next action” are current
> only at those dated historical checkpoints and are not present authority.
> Section 11 is the current 2026-08-27 correction status and next action.

## 1. Authorization and boundary

The user explicitly approved continuing on the existing branch/worktree and
authorized only Unit 6G Group 1 contract and persistence foundation. This
includes red-first tests, local server/mobile contracts/runtime dispatch, and
creation of the forward M52 migration candidate. It does not authorize
applying M52, deploying, publishing Git history, or implementing Groups 2–4.

Not authorized or performed:

- M52 migration application or any Supabase/Storage/business-row mutation;
- Edge/mobile/worker deployment, provider/network operation;
- staging, commit, push, PR, or merge; or
- Unit 6G Groups 2–4 (UI, card composition, Add/Add-all orchestration, Store
  View/cache work), Unit 6F native evidence, Unit 7C redesign, or Unit 8 reopening.

Performed within Group 1:

- strict server/mobile contract and runtime source changes;
- red-first contract, migration-structure, and persistence integration tests;
- creation of `20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql`;
- read-only exact-project Supabase preflight before implementation; and
- local test/TypeScript verification recorded below.

No external state was mutated.

Historical design-gate notes later in this file are retained as evidence of the
prior review pass; the authorization above was current at that historical
checkpoint.

## 2. Starting state

- Original workspace: `main` at `c5e97141...`, aligned with `origin/main`.
- Original workspace had unrelated untracked `.zcode/`, `append_tests.py`,
  `docs/codemap/`, and `fix2.py`; they were not changed or copied into scope.
- Isolated worktree/branch was created specifically for Unit 6G and is being
  reused for the Owner-approved Group 1 implementation.
- Phase 9 Unit 8 was already live-verified and integrated into pushed `main` at
  release commit `4c1d98d`.
- M39–M51 remain live and byte-immutable at their recorded versions.
- Unit 6 automatic/functional closure remains PASS; native Unit 6F remains
  deferred `NOT_RUN`/`UNRESOLVED` and is not reopened by Unit 6G.

## 3. Authority reviewed

- repository `AGENTS.md`, ACTIVE, DOC-13, Phase 9 SESSION-START/TRACKER/README;
- DOC-3, DOC-4, DOC-8;
- Phase 9 Master, Pipeline, Owner Review, Unit 6 SDD/matrix, Unit 7A, Unit 7C;
- planning decisions, implementation tracker, data dictionary,
  current-vs-target audit, traceability, and complexity register;
- current capture/list/review/card/form/query/contract/Store View code; and
- M02, M05, M29, M35, M39, and M43 migration seams.

## 4. Verified implementation findings current at the historical checkpoint

| Finding | Evidence/consequence |
| --- | --- |
| Start is not the desired defaults form | Current Edge request accepts language/script/condition; runtime hardcodes location=`default`, quantity=1, publication=private. |
| Durable price and batch label are absent | M02 session fields contain neither; a forward session schema delta is required if resume must preserve them. |
| Optional condition is not currently representable | `default_condition` is non-null; a versioned compatibility path is required. |
| Compact inline cards need a new projection | Candidate summary lacks cover/review/source/blocker/action data; full detail per card would create unnecessary N+1 reads. |
| Strict Save is reusable | `phase9_update_candidate_review_v2` already validates and returns canonical candidate/review/metadata versions. |
| Commit is reusable | Live M39 loads the server-held review and performs one atomic create-only private commit with exact quantity initialization. |
| General removal is not representable | Candidate disposition CHECK has only reviewed/false; input removal and false detection have different semantics. |
| Unit 7C schema is compatible | All business values map to existing inventory fields/commands; batch label intentionally does not. |
| Store View can be stale after commit | Existing candidate success synchronization does not invalidate `storeViewKeys.all`. |

## 5. Design output

- [Unit 6G SDD](../work-units/06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md)
- [Unit 6G contract matrix](../work-units/06g-owner-scan-defaults-batch-review-contract-matrix.md)
- P9-D81–P9-D85 in the planning decision tracker
- proposal overlays in DOC-3/DOC-4/DOC-8, Master, and Owner Review SDD
- Unit 6G traceability, data dictionary, current-to-target, and complexity entry
- active Phase 9 routing/status/next-action reconciliation

At that historical pre-recomposition checkpoint, the SDD contained 27 sections
and 24 acceptance criteria. The matrix fixed the
pre-scan controls/presets, compact-card fields, bounded aggregate DTO, removal
command, save/commit coordinator, cache effects, state mapping, migration delta,
and implementation split.

## 6. Principal resolved decisions

1. Location is required. English is the initial optional hint. Condition and
   selling-price defaults may be unset. Quantity is fixed at 1 pre-scan.
2. Currency is fixed INR; UI is whole rupees over existing minor-unit storage.
3. Batch label is optional, durable across resume, session-only, and has no
   readiness/inventory/public effect.
4. Cards show every final field compactly. Source badges emphasize exceptions;
   metadata detail is fetched only when opened.
5. Notes are hidden but existing notes are losslessly preserved.
6. Add and Add all are explicit review actions. They Save first, adopt canonical
   versions, require server readiness/capability, then call M39.
7. Add all is client orchestration with concurrency three and partial success,
   not a batch RPC, background job, or session transaction.
8. General removal persists `owner_removed_from_scan`, is distinct from false
   detection/input removal/inventory deletion, cascades nothing, and has no Undo.
9. Unit 7A remains private/create-only and Unit 7C remains the post-commit owner.
10. Close is versioned as `close_scan_session_v3` / `phase9_close_session_v3`;
    it returns strict readiness with safe-integer `ownerRemovedCandidates`, while v2
    Close remains unchanged.
11. `Use detected details` reuses the existing `manual` metadata mode with null
    selection, so selected canonical/cover/provider fields are not committed;
    incomplete observed identity requires manual editing.
12. Internal `matched` and `detected` sources both display as Detected; Default,
    Custom, and Missing have one canonical mapping across every card field.
13. One shared command slot arbitrates Add-all, internal Save/Add, and Remove;
    Add all skips/reports Busy cards and never queues them.
14. Aggregate, observed, selected-metadata, blocker, attention, review, count,
    action, and Close DTOs are strict, bounded, and raw-payload-free.

## 7. Migration and complexity verdict

- Full target: category 4 because candidate disposition changes lifecycle,
  predicates, readiness, counts, audit, and controlled commands.
- Session price/batch label/nullable condition: category 3 additive/
  compatibility component.
- Card projection and orchestration: category 2 API/application work.
- Unit 7C table migration: not required.
- Currency, pre-scan quantity 1, M39, `store_inventory`, Unit 7C commands, and
  Store View cache invalidation: no migration required.
- Overall implementation: bounded medium-high, not a rewrite.

Applied migrations must not be edited. Fresh exact-project read-only preflight,
red tests, migration design, migration-file creation, application, deployment,
and connected proof remain separately authorized gates.

## 8. Verification record

Verification is completed at closeout and must be recorded exactly; unrun gates
must remain unclaimed.

| Check | Result |
| --- | --- |
| New SDD/matrix structural review | HISTORICAL PASS for the pre-recomposition structure: 27 SDD sections, 24 unique acceptance rows, exact pre/post/server/removal/coordinator matrices present |
| Local Markdown links | PASS through continuity validator (`MARKDOWN_FILES_CHECKED=82`) |
| Phase 9 continuity validator | PASS: `REQUIREMENT_DEFINITIONS=195`, duplicates/missing `0/0`, `REQUIRED_PHASE_FILES=59`, regression probes PASS |
| Repository tracked diff check | PASS through direct `git diff --check` and continuity validator; line-ending notices are warnings only |
| Product tests/TypeScript | not run; no product source changed |
| Supabase/database/Storage | not accessed or mutated for this task |

The validator reports both the Unit 6G SDD and contract matrix above the
500-line advisory. Cohesion was reviewed: the SDD remains one normative
workflow spanning setup, card review, save/commit/removal state, security,
acceptance, and implementation gates, while the separate matrix owns exact
field/DTO/state tables. Splitting either document now would fragment authority
and duplicate cross-references, so both are intentionally retained under the
repository's advisory-only size policy.

### 8.1 Owner-review documentation correction pass — historical design gate

The Owner explicitly authorized documentation-only correction of five findings
at this earlier design checkpoint. The later Group 1 authorization and evidence
are recorded in §8.2.

| Finding | Correction evidence |
| --- | --- |
| Close-response versioning | SDD §§16–19 and matrix §4.6 define `close_scan_session_v3` / `phase9_close_session_v3`, strict `OwnerSessionReadinessV3`/`CloseSummaryV3`, safe-integer `ownerRemovedCandidates`, and unchanged v2 Close. |
| Use detected details | SDD §§10/18 and matrix §3.2 define exact existing `manual`/null-selection transition, selected canonical/cover/provider non-authority, M39 manual provenance, and incomplete-identity fallback. |
| Source indicators | SDD §§7/9 and matrix §§3/4.5 define `matched|detected`→Detected, `default`→Default, `custom`→Custom, `missing`→Missing for every displayed field. |
| Concurrent card commands | SDD §§11–15 and matrix §6 define one shared slot, Busy skip/report/no queue, max-three bulk work, duplicate suppression, and removal/commit lock ordering. |
| Strict nested DTOs | SDD §§16/20 and matrix §4.4 define exact safe-text/array/enum/null/URL/count/privacy bounds tied to current schemas. |

The migration audit now explicitly separates required forward session/lifecycle/
RPC/grant work from application-only currency, quantity, M39, inventory, Unit
7C, and Store View invalidation work. At that checkpoint the status was
`sdd_draft_complete_owner_review_pending`; it is superseded by the Group 1
implementation status in §8.2.

### 8.2 Group 1 implementation closeout — 2026-08-21

The Owner-approved Group 1 implementation was performed on the branch named
above. Red-first results were recorded before production changes: the initial
contract/migration run failed because the new modules and M52 file did not yet
exist. The completed local gates are:

| Check | Result |
| --- | --- |
| Focused new Jest contracts | PASS: 3 suites, 38/38 |
| Expanded contract/M29 Owner UX Jest regression | PASS: 5 suites, 215/215 |
| New M52 PGlite persistence integration | PASS: 11/11 after bounded review correction |
| Expanded Phase 9 PGlite regression (M39/Owner UX/Unit 7A) | PASS: 54/54 |
| TypeScript | PASS: `npx.cmd tsc --noEmit` |
| Migration application/deployment/connected mutation | NOT RUN by authorization; M52 remains local-only |

The M52 candidate adds only the Group 1 persistence seams: nullable/resumable
session defaults, irreversible `owner_removed_from_scan`, v3 summary/readiness/
Close, bounded batch review/removal RPCs, event/audit registration, and narrow
authenticated grants. M39's private create-only `q/q/0/0/0` contract and Unit
7C tables/commands remain unchanged. The PGlite fixture had to add the canonical
event registry/new event columns because the compact local Phase 9 baseline
predates those live seams; the production migration targets the verified live
canonical schema.

Read-only Supabase preflight confirmed project `Bookconnect_reactexpo`
(`ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`,
`ap-southeast-2`), live tail M51 `20260821061213`, nullable-condition rows all
currently non-null, and no existing M52 fields/disposition. The preflight also
reported the preexisting advisory that RLS is disabled on
`public.spatial_ref_sys`, `public.marketplace_event_schema_registry`, and
`public.marketplace_notification_type_registry`; it was not changed.

### 8.3 Independent-verification correction pass — 2026-08-21

Three independent audits (two external Codex reviews plus one repository
review) confirmed the Group 1 foundation and surfaced four bounded defects.
The Owner authorized the bounded correction pass; all fixes are inside the
still-unapplied M52, its tests, and documentation. No applied migration,
v2 response shape, live project, Git publication, or Group 2–4 scope changed.

| Defect | Correction |
| --- | --- |
| v3 close summary double-counted a removed candidate in `candidatesNeedsReview` | `phase9_unit6g_close_summary` now overrides that key with an active-only count; removed candidates appear exactly once, in `ownerRemovedCandidates`. |
| NULL fail-open validation: a null idempotency key or expected version bypassed format/range checks and version fences via PL/pgSQL three-valued logic on direct authenticated RPC calls | All three command RPCs explicitly reject null `p_idempotency_key` and null expected versions with `P9_REQUEST_INVALID`. |
| Session-level counters were DTO-bounded at 15 while legacy multi-image sessions legitimately exceed 15 (one live session holds 13 candidates), so v3 reads of such sessions would fail decode | `counts`, `blockerCounts`, and all `CloseSummaryV3` fields widened in both Edge and mobile contracts; card ordinals and item arrays stay capped at 15; aggregate items query additionally bounds input to 15 server-side. Iteration two replaced the interim `0..999` cap with non-negative JSON-safe integers; SQL emits plain counts, every realistic count decodes exactly, and any value above 2^53-1 fails closed at the decoder. |
| Legacy session-scope candidate page would hand old clients the new `owner_removed_from_scan` disposition and fail their strict decode (`CaptureProgressScreens` exposure) | M52 forward-replaces `phase9_owner_candidates_page_v2` with one added predicate excluding removed candidates from the session scope; signature/grants/cursor semantics unchanged; decision recorded in the contract matrix. |

Documentation alignment: SDD §7 emission table corrected (quantity/damage
never emit `missing`; cover never emits `detected`); §16 counter bounds
corrected; §17 gained the legacy-v2 failure contract and rollout-constraint
paragraph; contract matrix gained the six recorded correction decisions.

Verification actually run in this pass: focused new Jest suites 3/3
(42/42 tests), expanded Owner UX/capture regression suites 7/7 (212/212),
Unit 6G PGlite integration 13/13 including new G1-12/G1-13 red-test coverage
for the page filter and NULL rejection, `npx.cmd tsc --noEmit` clean. Red-first
evidence: the pre-correction integration file contained no
`candidatesNeedsReview` assertion and no NULL-key/version rejection (audit-
confirmed absence); G1-13 failed against the pre-correction RPCs during
development before the guards landed. M52 remains unapplied; no database,
Storage, deployment, provider, or Git-publication action occurred.

### 8.4 Rereview iteration two — 2026-08-21

Two completed external correction-only rereviews returned FAIL with the same
two findings (a third PASS was withdrawn as interrupted); both confirmed C1/C4
effective, the exact 12-file scope, and all code gates green. The Owner
approved a second bounded iteration:

1. Start RPC NULL guards: `p_language_hint`, `p_location`, and
   `p_publication` are explicitly rejected with `P9_REQUEST_INVALID`. All
   three are required inputs in the normalized v2 start contract (non-nullable
   schemas; SDD §5 location required without fallback; language/publication
   always submitted by the UI), so rejection rather than normalization is
   correct. This closes the reviews' residual fail-open finding even though
   the underlying columns are NOT NULL (fail-closed constraint abort).
2. Counter bound: interim `0..999` replaced by non-negative JSON-safe
   integers in `ownerBatchCount` (Edge) and `boundedCount` (mobile). SQL
   emits plain `count(*)` totals; any count within the safe-integer range
   decodes exactly, and a hypothetical count above 2^53-1 fails closed at
   the decoder rather than silently losing precision. Database counts are
   never clamped.
3. Encoding repair of the correction pass's own damage (PS 5.1 rewrite): UTF-8
   BOM removed from this tracker set's matrix and DOC-13, and 43 double-encoded
   characters in the matrix restored to — “ ” → ₹ via exact code-point
   replacement. No file was discarded; content edits were preserved.

Structural test now also pins the three start-input guards; G1-13 gained three
NULL-start rejections; both contract suites reject an unsafe integer instead
of a large-but-safe one. SDD §16 and the matrix notation updated to
NonNegativeSafeInteger semantics.

## 9. Residual risks and next action

- The nullable-condition transition and legacy v2 behavior need exact-project
  compatibility/readback proof before M52 application.
- Worker/removal races require candidate-lock/disposition-fence proof.
- The compact aggregate must prove bounded payload and no hidden notes/private
  data reaches rendering/telemetry.
- Add all interruption/idempotency and Store View invalidation need dedicated
  tests before implementation approval.
- Representative low-end Android evidence is required for the new page even
  though older Unit 6F debt remains separate.

**Exact next authorized action:** independent correction-only rereview of the
corrected M52 (double-count override, NULL guards, page filter, count bounds)
and the direct four-finding regressions. Do not apply M52, deploy,
stage/commit/push, or begin Groups 2–4 without separate authorization.

### 9.1 Bounded review-correction evidence

The user authorized correction of the four independent-review findings and
nothing else. Red-first results were migration structure 7/9 and Unit 6G
PGlite 8/11. The correction:

1. removes the prohibited v2 Close replacement and uses a separate
   transaction-marked nullable-session trigger;
2. proves the existing candidate presentation trigger advances removal
   authority exactly once, without a duplicate update;
3. derives saved field sources independently against matched, detected, and
   session-default values; and
4. rejects null command IDs in all three new command RPCs.

Final focused Jest is 38/38 and Unit 6G PGlite is 11/11. M52 remains unapplied;
no database/Storage, deployment, provider, Git publication, Groups 2–4, M39,
or Unit 7C action occurred. The exact next action is correction-only rereview.

## 10. 2026-08-24 — Unit 6G predecessor-inheritance recomposition

This dated section is the current superseding evidence. All earlier design,
Group 1, review/correction, implementation, and “next action” records above are
preserved as historical truth, including the old Group 1 review/correction
evidence.

- **OBSERVED by predecessor audit/source inspection:** historical commit
  `e7ed166` changed the mounted session presentation from the proven Unit 6
  lifecycle/progress controller to a candidate-oriented batch-review
  controller. Historical 6G-D work then began on top of that old C line. This
  established the route/controller composition defect; the old C/D work is
  evidence, not implementation authority for the clean recomposition.
- **OBSERVED by live verification:** the deployed Owner Edge and client
  contract versions did not match. The repository evidence does not prove that
  the exact mounted candidate-processing failure described above was executed
  live. The controller defect is therefore not attributed to live verification.
- Core Unit 6G product direction remains valid. Unit 6 is the authoritative
  lifecycle backbone; Unit 6G composes defaults, compact candidate review,
  general candidate removal, and explicit private commit behavior onto it.
- Unit 6G-A is retained. Unit 6G-B and exact M52 source/application/readback are
  retained. The batch aggregate remains candidate/review authority and is not
  input-processing authority.
- The current post-M52 foundation is live exactly once as
  `20260822025712 marketplace_phase9_unit6g_contract_persistence_foundation`.
  It includes durable nullable price/batch fields, nullable condition with the
  v2 fence, `owner_removed_from_scan`, Start v2, session/readiness/Close v3,
  batch-review/removal seams, safe-integer lifetime counters, and the retained
  paged session-candidate RPC with Owner-removed rows excluded. NEW 6G-C is
  composition/client work over that foundation; M52 is not reopened.
- The exact clean pre-C baseline is
  `714607fdbac827cd38ca2a145efbaf2b8b9f31ad` on
  `codex/phase9-unit6g-recomposition`.
- Prior 6G-C commit `e7ed166` is historical, superseded implementation. The
  prior dirty 6G-D implementation is frozen reference only. Neither is part of
  the new authoritative implementation line.
- New 6G-C/6G-D implementation authority comes only from the revised SDD and
  matrix after Owner checkpoint disposition of this recomposed authority
  (independent final review COMPLETE, verdict PASS_WITH_P3) plus separate
  explicit Owner authorization. No new
  6G-C implementation has begun.
- The 2026-08-24 recomposition used the completed predecessor audit as
  **Owner-supplied review evidence**. No repository artifact containing that
  completed audit was found, so no repository path is claimed. To remove that
  dependency, the revised SDD and matrix now each contain the full 40-row
  ledger. Exact disposition arithmetic: `INHERITED_UNCHANGED=30`,
  `SUPERSEDED_BY_6G=7`, `DEFERRED_WITH_EXPLICIT_OWNER=3`,
  `INTENTIONALLY_REMOVED=0`, `NOT_APPLICABLE=0`, total `40`. The superseded
  criteria are U6-AC06, U6-AC17, U6-AC18, U6-AC21, U6-AC23, U6-AC29, and
  U6-AC40. The deferred criteria are U6-AC36, U6-AC37, and U6-AC39.
- NEW 6G-C is the recomposed pre-commit experience. It must retain or delegate
  Unit 6 lifecycle ownership intact, present ONE current input, preserve
  zero-input recovery and stable Start replay, combine Unit 6 progress with
  Unit 6G compact review, keep deep correction reachable, cut session/
  readiness/Close UI consistently to v3, and integrate new query roots into
  identity cleanup immediately.
- NEW 6G-D alone owns per-card Save → Add, exact-N Add-all with at most three
  concurrent candidate chains, command-slot arbitration, unchanged M39 private
  commit, partial reconciliation, canonical cache synchronization, and Store
  View handoff.
- Mounted production-route predecessor regression is mandatory. Isolated old
  Unit 6 tests or isolated new Unit 6G tests cannot close composition.
- The mounted gate now has two executable branches rather than one impossible
  combined lifecycle: Scenario A covers successful candidate arrival through
  enrichment/recovery/full correction/v3 Close; Scenario B covers terminal
  pre-lineage input failure through deliberate replacement and resumed
  processing. Zero-input Resume, ambiguous Start, identity cleanup, stale
  Reapply, false detection, variants, and missed book remain separate tests.
- **Owner single-image clarification:** supported NEW Unit 6G intentionally has
  exactly one current image/input and a 0..15 current-scan candidate/card set.
  It has no image accumulation, append-image action, multi-image workflow, or
  normal-scan pagination. NEW 6G-C does not change Unit 6 candidate-limit
  semantics.
- Historical multi-input sessions with more than 15 active candidates are
  unsupported compatibility data. NEW 6G-C does not add pagination for them;
  they must fail closed rather than silently truncate into a seemingly complete
  supported session. Hidden candidates are never inferred reviewed/handled,
  and v3 readiness/Close remains server-authoritative. The former requirement
  for complete `>15` client traversal before approval is superseded.
- **Inherited over-limit authority:** 1..15 detected books continue through
  existing Unit 6 processing normally. More than 15 detected books preserves
  the existing `P9_VISION_OVER_LIMIT` input failure, creates zero candidates,
  presents bounded failure guidance, and keeps Unit 6 replacement/recovery
  reachable so a replacement image with 1..15 books can continue normally.
  No first/best/top 15 is retained, no retained-15 selection rule is needed,
  and `candidateCapSkips` is not reinterpreted.
- Any future candidate-limit UX optimization such as “process 15 and skip the
  remainder” is explicitly deferred to a separate later work unit and product/
  design decision. It is not a NEW 6G-C prerequisite or scope item.
- All Unit 6G session/readiness/Close client surfaces use v3; the nullable-v2
  fence remains compatibility protection only.
- 6G-E cannot declare live client verification PASS until the exact reviewed
  Owner Edge bundle is deployed/read back with all five Unit 6G actions.
- This recomposition pass changes only the Unit 6G SDD, matrix, and this
  historical evidence tracker. It does not update broader Phase 9 routers or
  status trackers before Owner review.
- Current recomposed structure: the revised SDD defines U6G-AC01 through
  U6G-AC34 and contains the complete 40-row Unit 6 predecessor ledger. The old
  27-section/24-acceptance count in §§5/8 is historical pre-recomposition
  evidence, not current validation.
- No product code, SQL/M52, Edge/mobile runtime, migration, database/Storage,
  deployment, external service, business data, stage, commit, push, merge, or
  PR mutation occurred. The frozen old C/D worktree and original main workspace
  were not mutated.
- Documentation verification after this bounded correction pass:
  - Phase 9 continuity validator with semantic negative probes: PASS;
  - requirement definitions `195`, duplicates `0`, missing traceability `0`;
  - requirement validator regression/boundary probes PASS
    (`REQUIREMENT_VALIDATOR_REGRESSION_PROBES=PASS`);
  - predecessor-ledger equality PASS in both authorities: 40 rows with exact
    `30/7/3/0/0` arithmetic and exact superseded/deferred sets;
  - U6G acceptance structure PASS: 34 unique rows, contiguous
    `U6G-AC01..U6G-AC34`; single-image semantic probes and three-file UTF-8 BOM
    scan PASS;
  - Markdown files checked `82`, required Phase 9 files `59`;
  - repository `git diff --check`: PASS;
  - document-size results are advisory only under repository policy; the
    corrected SDD/matrix/tracker are 1148/892/438 lines and remain cohesive
    owning authorities; they were not pruned or mechanically split.

**Current next action:** Owner checkpoint disposition of the corrected three-document
single-image authority and unchanged Unit 6 over-limit behavior (its independent
final review is COMPLETE, verdict PASS_WITH_P3). Stop before NEW 6G-C (which additionally
requires separate explicit Owner authorization and remains composition-only/pre-commit),
migration work, deployment, Git publication, or broader Phase 9 routing/status reconciliation.

## 11. 2026-08-27 — U6G-FA-001 partial selected-metadata correction

The Owner authorized the minimal representation/projection correction identified
by the prior bounded RED checkpoint. The correction does not add a DTO version,
expand candidate detail, or alter lifecycle/commit behavior.

- RED-first focused verification produced 8 expected failures / 45 passes.
- M53 adds an internal safe-summary helper and replaces the internal source and
  batch-card projection helpers. Each unusable selected title, authors,
  language, or cover member projects as null; the canonical selected snapshot
  remains unchanged and existing `fieldSources` chooses the per-field fallback.
- Mirrored Edge/mobile strict DTOs accept those nullable compact members, and
  compact draft derivation treats null as absent.
- Focused contract/M53 structure Jest is 53/53; Unit 6G PGlite is 25/25;
  compact draft/card/mounted-route assertions are 53/53, with the command
  manually terminated after completion because of the existing Jest open
  handle; full image-inventory Jest is 56 suites / 454 passed / 4 skipped;
  `tsc --noEmit`, the Phase 9 continuity validator, and `git diff --check` pass.
- M52/M39, Unit 6 lifecycle, public RPC signatures, tables, business rows, and
  connected state are unchanged. M53 remains unapplied. Nothing was staged,
  committed, pushed, merged, deployed, or applied.

**Current next action:** independent review of this minimal correction. M53
application and Edge/client deployment require separate Owner authorization.
