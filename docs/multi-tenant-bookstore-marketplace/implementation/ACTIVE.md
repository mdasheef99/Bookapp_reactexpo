# Marketplace current state

Recorded state: 2026-11-01. Slice 8 package 8a-4 empty-ambiguity correction locally tested; no-retention fan-out proof remains open. Nothing applied.
This file is rewritten at session close; dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 8 (Open Library first, replaceable providers), package 8a-4 review corrections; no-retention fan-out source proof remains open**.
- Latest bounded change: automatic fan-out completion rejects an ambiguous
  outcome with no candidates; the focused 8a-4 suites passed **17/17**. The
  existing golden fixture was not regenerated; its freeze test fails on the
  intentionally changed function definition.
  See the [review correction record](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-01---empty-ambiguity-correction-and-no-retention-proof-gap).
- Completed milestone: P1 unbound fan-out selection and P2 wall-clock retention
  expiry were reproduced before production edits, then corrected locally.
  Focused PGlite checks pass: 8a-4 **16/16** and 8a-2 retention **4/4**.
  Actual two-connection advisory-lock tests now pass **2/2** across 8a-2 and
  8a-4, and native selection/compatibility checks pass **7/7**; both disposable
  clusters passed teardown. The earlier S1–S7 native run was
  **193 pass / 0 fail / 18 skip / 19 TODO**, but predates these corrections.
  Before the latest correction, the provisional hash fixture and synthetic
  installation, hash-freeze and guard checks reported **13 pass / 0 fail / 3 TODO**.
  The unchanged no-list Google single-call completion/replay control passes.
  M89/M90/M91 have committed baselines (`746e061`, `f4f6d8c`, `dba657d`),
  with subsequent local M90/M91 corrections and M92 unapplied. Consult Git
  status and history for the current commit state.
  [Correction evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-01---follow-up-p1p2-selection-and-deadline-corrections)
  owns exact proof and limitations.
- Exact next authorized action: **review and specify a source-bound no-retention
  fan-out selection proof across the 8a receipt boundary and planned 8b worker,
  then verify it before enabling no-list fan-out completion**.

## Mutation authority now

- The Owner authorized updating documentation and one local commit of the
  current checkout changes. Preserve the earlier instruction not to regenerate
  the golden fixture; this does not authorize push, deployment or external writes.
- Shared database/migration application: **none**; Storage: **none**; deployment: **none**.
- M89/M90/M91 have committed baselines; corrected M90/M91 and M92 remain
  unapplied. Git status and history own their local commit state.
  Disposable PGlite migrations/fixtures were used for verification only. Apply is
  authorized after each migration completes its review cycle, with a Haiku
  preflight (re-verify `ahntbtktjjmvfosgkmgn`, read-only live registry check)
  and an ordered apply starting with M89. It does not cover push or deploy.
- No push, deployment or application to shared services is authorized.

## Last recorded live state

These are recorded development-project results, not a fresh operational readback.

- Latest applied migration: **M88**, live version **`20261029151325`**, project
  **`ahntbtktjjmvfosgkmgn`** (recorded, not freshly verified). M89–M92 are
  **not applied**;
  [ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-10-31-slice-8-package-8a-4-file-not-applied).
- Registry: `google_books` and `open_library` enabled, policy_version 1; Google
  public_display=false, raw_retention=604800; Open Library public_display=true,
  attribution=true, raw_retention=0; no automatic-lookup, role or order columns yet.
- Physical calls are all finalized; the live CHECK keeps
  `claim_attempt_number BETWEEN 1 AND 5`. Three stale `reserved` usage
  reservations from August 2026 remain; the 02c-1 drain must handle them.
- Functions: no phase9 function has PUBLIC execute; 12 have anon execute, all
  public search/detail helpers, as expected.
- Deployed worker: recorded `phase9-metadata-worker` deploy `dep-dbhmr07b9u1s73f8qjpg`.
- Latest relevant recorded commit on `main`: closeout `0d240ef`;
  [publication evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).

## Open items, blockers and residual risks

- The current fan-out finalizer stores no selected bytes, while 02c §4.3 requires
  source-bound selection and 02d requires no-retention prefill to preserve valid
  suggestions. Removing the no-list refusal would reintroduce the unbound
  selection defect. The receipt/worker proof contract remains unresolved; no
  8b behavior or new interface was invented in this correction.
- The existing provider golden-freeze test fails because the M92 automatic
  completion function changed and the fixture was intentionally not regenerated.
- Applying any 8a migration needs the per-migration review cycle plus a Haiku
  preflight (re-verify `ahntbtktjjmvfosgkmgn`, read-only live registry check),
  ordered starting with M89. Pushing and deploying are not authorized.
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
  `(edition_call_sequence, edition_call_stage) = (0, NULL)`; adding the
  constraint would fail if such a row exists. Terra verdict: M89, M90 and M91
  remain gated for application until the correction review and preflight complete. Live
  data was not inspected. The pre-apply read-only live check must look for rows
  matching the first and third cases. Fix owner: paid DeepSeek, confirmed by a
  PGlite probe against the old baseline first, then re-reviewed.
- M92's earlier S1–S7 native provider checks passed with verified cleanup. The
  follow-up P1/P2 defects were reproduced and corrected; the 71-definition SHA256
  fixture was refreshed as provisional and must not be treated as review approval.
  The full historical PGlite command was stopped
  during unrelated bookstore cases and is not claimed complete. The builder also edited
  `phase9ProviderSynthetic.integration.test.mjs` and
  `provider-replacement-synthetic-install.sql`; reviewers are checking that no
  assertion was weakened.
  [Exact proof and limits](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-4-automatic-transaction-file-only).
  Earlier named-model review and native status records are historical; this
  correction does not claim a completed Terra rerun. The historical CRLF
  byte-guard failure remains unchanged.
- Owner decisions 2026-10-31 and 2026-11-01: paid DeepSeek (with Muse) replaces
  Sol for review-driven fixes and corrections, to save Codex credits; Sol
  writes only the main migration of each package. Terra reviews stay for 8a-2,
  8a-3, 8a-4 and the whole 8a layer because Terra found real defects the
  cheaper reviews missed. Placeholders are allowed for the Open Library contact
  email and for quota/pacing numbers only where a package needs one; for oversized
  or unsafe input (OQ8-7) the orchestrator decides a simple truncation when that
  package is briefed.
- Owner-open items left: the contact email (placeholder), OQ8-3 numbers (placeholder
  only where needed), OQ8-7 input policy (orchestrator decides simple truncation at
  that package).
- Not collected in the preflight: deployed worker config, instance count and
  pacing settings; needed before the protection package and 8c.
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
  stale failures from its August-stopped harness. The continuity validator fails
  with `PHASE9_MIGRATION_SET_INVALID` (allowlist stops at M83). `.phase9-dist`
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
