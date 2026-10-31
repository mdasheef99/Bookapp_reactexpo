# Marketplace current state

Recorded state: 2026-10-31. Slice 8 package 8a-1 file complete (local only) on branch `phase9/slice8-providers`.
This file is rewritten at session close; dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 8 (Open Library first, replaceable providers), package 8a-1 complete (file only, not applied)**.
- Completed milestone: slice 8 package 8a-1 provider-registry capability and policy
  migration, committed as `746e061` on branch `phase9/slice8-providers`
  (earlier branch commits: `d25217b` slice 8 SDDs, `7a2ef73` Owner answers
  OQ8-5/9/10, `3c064da` package 1 red-first tests); nothing is pushed;
  [evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-1-registry-capability-and-policy-file-complete-not-applied).
- Exact next authorized action: **package 8a-2 (resolver Google veto, facts/row
  validators, source-policy v2 and the admission capability check), built by Sol
  after the Codex usage limit resets (7:05 AM)**. Creating the file needs
  separate Owner approval. Its mention here does not authorize creation.

## Mutation authority now

- This task authorizes Markdown documentation edits only.
- Database/migration application: **none**; Storage: **none**; deployment: **none**.
- Migration M89 exists as a local file only; it has not been applied. Nothing is
  deployed and nothing is pushed. No Supabase, Render, stage, commit, push, or
  branch switch is authorized by this task. Applying M89 needs separate Owner
  approval and a fresh project re-verification of `ahntbtktjjmvfosgkmgn`.

## Last recorded live state

These are recorded development-project results, not a fresh operational readback.

- Project: **`ahntbtktjjmvfosgkmgn`**; live ledger ends at **M88**, live version
  **`20261029151325`**; M89 is a local file only and is **not applied**;
  [ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-10-31-slice-8-package-8a-1-file-complete-not-applied).
- Registry: `google_books` and `open_library` enabled, policy_version 1; Google
  public_display=false, raw_retention=604800; Open Library public_display=true,
  attribution=true, raw_retention=0; no automatic-lookup, role or order columns yet.
- Physical calls are all finalized; the live CHECK keeps
  `claim_attempt_number BETWEEN 1 AND 5`. Three stale `reserved` usage
  reservations from August 2026 remain; the 02c-1 drain must handle them.
- Functions: no phase9 function has PUBLIC execute; 12 have anon execute, all
  public search/detail helpers, as expected.
- Prior `main` state is unchanged: worker deploy `dep-dbhmr07b9u1s73f8qjpg` and
  closeout commit `0d240ef`;
  [publication evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).

## Open items, blockers and residual risks

- Package 8a-2 file creation waits for separate Owner approval; applying any 8a
  migration waits for another approval plus a fresh project re-verification.
- Process decision (Owner, 2026-10-31): no per-package Terra review for 8a-1.
  One Terra review covers the whole database layer (8a-1 to 8a-5) before anything
  is applied to Supabase. Before any apply, a read-only check of the live
  registry rows is required.
- Package 8a-1 test gate: the `AC8-9a [8a-2]` test is gated to the 8a-2 object
  (`phase9_catalogue_source_policy_v2`); the manifest lists M89 under `8a-1`.
  With the 8a-1 prefix, PGlite shows 230 tests (147 pass, 16 fail, 48 skipped,
  19 TODO) and native Postgres shows 220 tests (142 pass, 16 fail, 43 skipped,
  19 TODO). The 16 failures are the reds that 8a-2 and later packages own (same
  messages as the M88 baseline); no `[8a-1]` test fails. The M88 baseline is
  unchanged in behaviour (one pass-count difference, 68 vs 67, is unexplained
  and noted).
- Owner questions still open: OQ8-1, -2, -3, -4, -6, -7, -8, -11 and OQ-P1.
- Not collected in the preflight: deployed worker config, instance count and
  pacing settings; needed before the protection package and 8c.
- New 02c interface clarifications stand as pending review, not approved:
  the service-only read `public.phase9_provider_configuration_v1()`, 8a-2
  ownership of the resolver Google veto, and the paused-gate refusal
  `P9_EXTERNAL_ADMISSION_PAUSED`.
- Deferred, unproved package 1 TODOs with owners: real v2 cover mode (8b/8c),
  orphan or unknown-egress restart recovery (8b), retention/profile and synthetic
  proofs (8a-2..4), the post-generalization frozen golden (8a-4), prefill
  negatives (02d), provider-facts-only origin (OQ8-11).
- Pre-existing local issues, not slice 8: `core.autocrlf=true` CRLF checkout breaks
  raw-byte migration checks (Jest M84 hash, M86 guard); LF `.gitattributes`
  proposed and deferred. `phase9MetadataFoundation.integration.test.mjs` has 3
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
