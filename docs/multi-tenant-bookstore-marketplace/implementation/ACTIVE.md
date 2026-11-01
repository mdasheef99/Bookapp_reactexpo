# Marketplace current state

Recorded state: 2026-11-02. Slice 8 package 8a-5: the whole-8a read-only review
of M89..M93 as one ordered apply ran, its confirmed blocker findings
(LEGACY-LIVE-1/2) were fixed in M93, a read-only live preflight and Haiku
preflight checks passed, and the 2026-11-02 final regression is recorded with
M93 at 1,513 lines (sha256 `80d496a173c9…`). Nothing applied, committed,
pushed or deployed. This file is rewritten at session close; dated evidence
belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 8, package 8a-5 whole-8a review, fixes, preflight and final regression closeout**.
- Completed milestone: the whole-8a read-only review of M89..M93 as one ordered
  apply ran and closed. Reviewers: Terra/max (763 s), paid DeepSeek max angle A
  "APPLY-ORDER" (about 25 min), paid DeepSeek max angle B "LEGACY-LIVE" (about
  31 min), Muse inventory (319 s, clean: every function sets `search_path`,
  new grants service_role only, no signature mismatches). Terra's verdict
  before the fixes: "ACCEPT M89..M93 for ordered apply: no". Findings and
  outcome ([whole-8a record](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression)):
  WHOLE-1 (NULL `operation_version` historical automatic job fails a
  non-legacy OL v2 route, M91:113/137/213/261; latent until 8c; live count 0;
  needs a null-safe flag in a later slice plus a drain); WHOLE-2/ORDER-2 (M90
  replacement cache CHECK possibly stricter than M84 for Google book URLs with
  whitespace or backslash; reviewers disagreed; 0 offending live rows; no
  edit); ORDER-1 (M89 gate kind `metadata`/adapter_version `1.0.0`; live both
  pass, count 2); ORDER-3 (M91 stage CHECK accepts half-null pairs, inherited
  from M78; live none — 172 call rows are (NULL,NULL); left unchanged);
  LEGACY-LIVE-1 and LEGACY-LIVE-2 confirmed real and FIXED in M93;
  LEGACY-LIVE-3 (existing public Google selected_snapshot cache row would
  raise on the old worker's cache read; live count 0) added to the pre-launch
  Google data purge checklist item.
- M93 after the fixes: LEGACY-LIVE-1 scopes the legacy bypass in
  `phase9_assert_queue_grant_v1` and the run lookup in
  `phase9_provider_run_grant_v1` to the incoming/current claim tuple, so a run
  from an earlier claim no longer turns an 8a-4 re-claim into a v2 claim;
  LEGACY-LIVE-2 raises `P9_PROVIDER_RUN_NOT_ADMITTED` before capacity when
  `protection_policy` is NOT NULL with no hold or running current-claim run
  (NULL policy unchanged). A paid DeepSeek max changed-hunk review accepted
  both ("ACCEPT changed hunks: yes"). Behaviour change: a policy-protected
  legacy caller that relied on unadmitted free-capacity calls now gets
  `P9_PROVIDER_RUN_NOT_ADMITTED`. Two Low test-evidence notes stay open, not
  blockers (recorded in tracker 39). Golden
  `provider-replacement-generic-8a5-sha256.json` recomputed by Haiku after
  proving 101 unchanged entries reproduce; 103 of 103 match.
- Final regression (2026-11-02; M93 sha256 `80d496a173c9f6fe…`, full hash above,
  1,513 lines, golden 103/103): PGlite 8a-5 **283 pass /
  0 fail**; PGlite 8a-4 **278 pass / 0 fail**; Capacity file PGlite **20
  tests, 16 pass / 0 fail, 4 skipped**; native Postgres 8a-5
  (provider-replacement group): **319 tests, 288 pass / 0 fail / 12 skipped /
  19 todo, teardown pass, NATIVE_GROUP provider-replacement PASS**. The
  native-only Capacity test (round capacity, clock after the store lock) was
  rewritten three times (routing, then a bind-parameter-count slip) and now
  passes; it also catches a reverted post-lock clock refresh (T1 addressed).
  Native fairness **AC8-6 NOT natively proven** (gated on OQ8-3); no explicit
  40P01 assertion.
- Read-only whole-8a live preflight (project `ahntbtktjjmvfosgkmgn`, latest
  migration M88 `20261029151325`): registry both `metadata`/`1.0.0`; 0
  candidate or cache rows failing live validators; 0 legacy-v1 rows; 0
  stage-pair violations; 0 open jobs with NULL `operation_version`; 0
  non-finalized provider calls; 0 public Google selected_snapshot rows;
  admission tables absent (expected); three stale August reservations (two on
  dead_letter jobs, one vision reservation on a cancelled job); one
  `metadata_enrich` candidate job `in_progress`, attempt_count 5, lease
  expired 2026-10-12 (operation_version `p9-owner-edition-options-v1`) —
  to-check before apply (max_attempts and drainability); no PUBLIC execute on
  any phase9 function; anon execute exactly the 12 known helpers; the live
  registry has no `protection_policy` column (confirm which migration adds it
  before apply). No database writes.
- M89 committed (`746e061`); M90 (`f4f6d8c`) and M91 (`dba657d`) corrected in
  `1a834fb`; M92 added in `1a834fb`; M90 and M91 untouched by the whole-8a
  round (committed, unapplied); `fbd74e1` restored verification checks. M93
  (`20261101000093`, 1,513 lines, sha256
  `80d496a173c9f6fe30f42d3714c0c787488ced2669024be18d2090c9bea34c5e`) is
  untracked/uncommitted and never applied. Latest applied migration is still
  M88 (`20261029151325`); nothing applied, pushed or deployed in this work.
- Exact next authorized action: **the regression and the final whole-8a review are done
  (native 8a-5 319/288 pass/0 fail); after checking stuck job 4ffe137d, ordered apply of M89..M93 under the Owner's
  standing apply permission** (see slice8-owner delegations in the existing
  docs), recording each in the migration ledger; then 8b worker.

## Mutation authority now

- The Owner authorized this documentation update only: no code, no migrations,
  no git writes, no Supabase writes. The whole-8a review round was read-only
  plus local M93/test/fixture edits by its earlier authorized cycle.
- Shared database/migration application: **none**; Storage: **none**;
  deployment: **none**.
- M89 is committed (`746e061`); M90/M91 corrections and M92 are committed in
  `1a834fb`; `fbd74e1` restored verification checks; M90/M91 untouched
  (committed, unapplied). M93 is untracked/uncommitted and never applied.
  Any application remains subject to the Owner's commit go-ahead, ordered
  application starting with M89 under the Owner's standing apply permission
  (slice8-owner delegations), and the migration-ledger recording per apply.
- No push, deployment or application to shared services is authorized.

## Last recorded live state

These are recorded development-project review results, not a fresh operational
readback.

- Latest applied migration: **M88**, live version **`20261029151325`**, project
  **`ahntbtktjjmvfosgkmgn`** (re-verified read-only in the 2026-11-02
  whole-8a preflight). M89–M93 are **not applied**; the whole-8a preflight
  findings are listed under Current work and detailed in
  [tracker 39](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression);
  [ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-11-01-slice-8-package-8a-5-file-not-applied).
- Registry: `google_books` and `open_library` enabled, policy_version 1; Google
  public_display=false, raw_retention=604800; Open Library public_display=true,
  attribution=true, raw_retention=0 (2026-10-31 record). The 2026-11-02
  preflight re-checked live: both rows pass M89's kind `metadata` /
  adapter_version `1.0.0` gate (count 2); no `protection_policy` column live
  (confirm which migration adds it before apply).
- Physical calls: all finalized with
  `claim_attempt_number BETWEEN 1 AND 5`; the whole-8a preflight found 0
  non-finalized provider calls and 172 call rows with (NULL,NULL) stage pairs,
  which the M91 replacement CHECK leaves unchanged. Three stale August
  reservations remain (two on dead_letter jobs, one vision reservation on a
  cancelled job); one `metadata_enrich` candidate job is `in_progress`,
  attempt_count 5, lease expired 2026-10-12 — to-check before apply. The 02c-1
  drain must handle the reservations.
- Functions: no phase9 function has PUBLIC execute; 12 have anon execute, all
  public search/detail helpers — confirmed again 2026-11-02.
- Deployed worker: recorded `phase9-metadata-worker` deploy `dep-dbhmr07b9u1s73f8qjpg`.
- Latest relevant recorded commit on `main`: closeout `0d240ef`;
  [publication evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).

## Open items, blockers and residual risks

- Nothing from the whole-8a round is applied or committed. Before any apply:
  confirm which migration adds the live registry's `protection_policy` column;
  check the `metadata_enrich` candidate job's max_attempts and whether it
  drains; and run the ordered apply preflight starting at M89.
- Native fairness AC8-6 remains NOT natively proven (gated on unset OQ8-3);
  no explicit 40P01 assertion. Two Low test-evidence notes stay open, not
  blockers: Capacity test 181-202 would not catch a reverted post-lock clock
  refresh; QueueReview test 143-152 passes for a different reason than its
  name ([tracker 39](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression)).
- WHOLE-1 stays open as a later-slice item: a NULL `operation_version`
  historical automatic job can fail a non-legacy OL v2 route (latent until 8c);
  needs a null-safe flag in a later slice plus a drain. LEGACY-LIVE-3 items:
  add to the pre-launch Google data purge checklist the inventory and purge of
  Google-sourced data (owner item below).
- The operating numbers stay unconfigured. Actual worker pacing/circuit state,
  cooldown recheck/HTTP recovery and one-instance rollout enforcement remain
  8b/rollout proof; SQL tests do not establish those behaviors. Shared-db pacing
  is deliberately unsupported and rejected by the new boundaries.
- The SDD does not explicitly assign a no-retention fan-out proof to 8a-4.
  Whether that future worker scenario needs support is a design question, not
  a confirmed 8a-4 requirement or gate. The current no-list guard remains;
  removing it without a source proof would reintroduce the unbound-selection defect.
- The original historical files `.claude/psr-slice6/db-evidence.md` and
  `.claude/psr-slice7a/preflight-1.md` are absent from this checkout. Dated
  tracked summaries are linked, but do not replace the originals or establish
  fresh live state. The continuity validator passes with this limitation noted.
- Applying any 8a migration needs the per-migration review cycle (now closed
  for 8a via the whole-8a round) plus a preflight before each apply
  (re-verify `ahntbtktjjmvfosgkmgn`, read-only live registry check), ordered
  starting with M89. Pushing and deploying are not authorized.
- Reviews of M90: Muse (no issues); paid DeepSeek (1 Low, overlong Open Library
  id lost the 256-character bound, confirmed with a probe and fixed); Terra
  read-only (2 Medium, both resolved; detail in the tracker entry). Terra noted
  M90 is not repeatable if applied twice (plain CREATE FUNCTION); M84 and M89
  follow the same pattern, so no change.
- Terra 8a-3 review (read-only, Owner-requested, 754 s) found three Medium
  compatibility defects that Muse and paid DeepSeek had missed. Corrections
  were already present in the dirty M90/M91 files when this S1–S7 session
  started; their prior independent closure is not claimed here. (1) M90:525: the
  `phase9_catalogue_valid_cache_v1` replacement tightens an existing CHECK; an
  Open Library cache row valid under M85 with `normalizerVersion="legacy-v1"`
  would fail on a later UPDATE. (2) M90:390: the stricter row validator runs
  before the M86 completion-replay branch; replaying a previously accepted
  option whose book URL names a different valid Open Library edition raises
  `P9_EDITION_ROWS_INVALID`. (3) M91:31: the replacement stage CHECK rejects
  half-null pairs that M78 accepted through SQL UNKNOWN, e.g.
  `(edition_call_sequence, edition_call_stage) = (0, NULL)`; the whole-8a
  live preflight found none (all 172 call rows are (NULL,NULL)), so the
  constraint was left unchanged. Terra's live-data questions are now answered
  by the read-only whole-8a preflight (no legacy-v1 rows, no offending cache
  rows).
- M92's earlier S1–S7 native provider checks passed with verified cleanup. The
  follow-up P1/P2 defects were reproduced and corrected; the 71-definition SHA256
  fixture is refreshed as provisional and must not be treated as review approval.
  The full historical PGlite command was stopped
  during unrelated bookstore cases and is not claimed complete. The builder also edited
  `phase9ProviderSynthetic.integration.test.mjs` and
  `provider-replacement-synthetic-install.sql`; reviewers are checking that no
  assertion was weakened.
  [Exact proof and limits](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-4-automatic-transaction-file-only)
  owns exact proof and limitations. Earlier named-model review and native
  status records are historical; this correction does not claim a completed
  Terra rerun. The historical CRLF byte-guard failure remains unchanged.
- Owner decisions 2026-10-31 and 2026-11-01: paid DeepSeek (with Muse) replaces
  Sol for review-driven fixes and corrections, to save Codex credits; Sol
  writes only the main migration of each package. Terra reviews stay for 8a-2,
  8a-3, 8a-4 and the whole 8a layer (whole-8a round completed 2026-11-02).
  Placeholders are allowed for the Open Library contact
  email and for quota/pacing numbers only where a package needs one; for oversized
  or unsafe input (OQ8-7) the orchestrator decides a simple truncation when that
  package is briefed.
- Owner-open items left: the contact email (placeholder), OQ8-3 operating
  numbers (unset), OQ8-7 input policy (orchestrator decides simple truncation
  at that package), Q4-2 retry-floor bound (needs a Owner number), and the
  pre-launch checklist item to inventory and purge Google-sourced data.
- Read-only Render readback found one configured metadata-worker instance.
  Runtime pacing/singleton enforcement and configuration values remain unverified;
  [evidence and limits](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#read-only-operational-evidence).
- New 02c interface clarifications stand as pending review, not approved:
  the service-only read `public.phase9_provider_configuration_v1()`, 8a-2
  ownership of the resolver Google veto, and the paused-gate refusal
  `P9_EXTERNAL_ADMISSION_PAUSED`.
- Deferred, unproved package 1 TODOs with owners: real v2 cover mode (8b/8c),
  orphan or unknown-egress restart recovery (8b), retention/profile and synthetic
  proofs beyond the bounded S1–S7 cases (8a-2..4), prefill negatives (02d),
  provider-facts-only origin (OQ8-11). The updated P1/P2 hash fixture is
  provisional; correction review and full 8a acceptance remain separately gated.
- Pre-existing local issues, not slice 8: `core.autocrlf=true` CRLF checkout breaks
  raw-byte migration checks (Jest M84 hash, M86 guard); an LF `.gitattributes`
  rule for `supabase/migrations/*.sql` is authorized as one small separate commit. `phase9MetadataFoundation.integration.test.mjs` has 3
  stale failures from its August-stopped harness. The continuity validator now
  passes with the historical evidence limitation described above. `.phase9-dist`
  must be built before some phase9 suites run.
- Earlier accepted slice 7b-2 limits carry over: AC7-21(b) UNPROVEN, the
  provider-facts-only privacy case UNPROVEN, unproved in-flight/selected-option
  rollback and live Google/expiry/M88-guard cases; [closeout evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29).
- Representative low-end Android Unit 6F validation remains deferred, not PASS; [owning evidence](phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md).

## Ordered reading list

1. Read this file after [AGENTS.md](../../../AGENTS.md).
2. Read [SESSION-START.md](phase-9-image-inventory/SESSION-START.md) for protocol, rules and the update matrix.
3. Read [DOC-13](../DOC-13-implementation-tracker.md) for cross-phase status and global blockers.
4. Use [TRACKER.md](phase-9-image-inventory/TRACKER.md) to locate evidence relevant to the authorized task.
5. Read the [master SDD](phase-9-image-inventory/00-phase-9-master-sdd.md) and only the domain/supporting material routed by SESSION-START.
6. Read the [implementation/verification tracker](phase-9-image-inventory/trackers/02-implementation-and-verification.md) when implementation is authorized.

## Historical records

- [History index and source provenance](history/README.md).
- [Former ACTIVE handoffs](history/ACTIVE-history-to-2026-10-29.md).
- [Former DOC-13 Phase 9 narrative](history/DOC-13-phase9-history-to-2026-10-29.md).
- [Former session-start handoffs](history/phase9-SESSION-START-history-to-2026-10-29.md).
- [Former master-tracker status copies](history/phase9-TRACKER-history-to-2026-10-29.md).

Read archives only for historical decisions, approvals, discrepancies or evidence;
their dated next actions do not grant current authority.
