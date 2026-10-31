# Marketplace current state

Recorded state: 2026-10-31. Slice 8 package 8a-3 file complete (local only, pending review) on branch `phase9/slice8-providers`.
This file is rewritten at session close; dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 8 (Open Library first, replaceable providers), package 8a-3 file complete, pending independent review; not applied**.
- Completed milestone: local M91 route/physical-accounting file (501 lines),
  registered under `8a-3`; M89 (`746e061`) and M90 (`f4f6d8c`) are already
  committed and unchanged. M91 and its continuity records are uncommitted;
  [evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-3-routephysical-accounting-file-only).
- Exact next authorized action: **independent review of the local M91 file**
  through the prescribed paid DeepSeek/Muse cycle. Terra reviews the whole 8a
  layer after 8a-5. No reviewer result is claimed here. Later migration creation,
  application and deployment remain separately gated; the orchestrator owns commits.

## Mutation authority now

- This task authorized local M91 file creation, prefix registration and required
  continuity records only; no Supabase or network access and no git writes.
- Database/migration application: **none**; Storage: **none**; deployment: **none**.
- M89/M90 are committed local files; M91 is uncommitted. None has been applied.
  This task grants no application authority. Any future apply must follow its
  separate approval/review and exact-project preflight, ordered from M89.
  Nothing was staged, committed, pushed, deployed or applied in this session.

## Last recorded live state

These are recorded development-project results, not a fresh operational readback.

- Latest applied migration: **M88**, live version **`20261029151325`**, project
  **`ahntbtktjjmvfosgkmgn`** (recorded, not freshly verified). M89–M91 are
  **not applied**;
  [ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-10-31-slice-8-package-8a-3-file-not-applied).
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

- Applying any 8a migration needs the per-migration review cycle plus a Haiku
  preflight (re-verify `ahntbtktjjmvfosgkmgn`, read-only live registry check),
  ordered starting with M89. Pushing and deploying are not authorized.
- Reviews of M90: Muse (no issues); paid DeepSeek (1 Low, overlong Open Library
  id lost the 256-character bound, confirmed with a probe and fixed); Terra
  read-only (2 Medium, both resolved; detail in the tracker entry). Terra noted
  M90 is not repeatable if applied twice (plain CREATE FUNCTION); M84 and M89
  follow the same pattern, so no change.
- M91 PGlite proof and all four prefix counts are in the owning evidence entry.
  All executable `[8a-3]` checks pass; seven later-package reds remain, with
  messages unchanged from the 8a-2 baseline. Manifest registration activates one
  partial-prefix control in every older prefix (+1 pass / -1 skip). Native
  Postgres, lock/FK races and independent review were not run in this session.
  Historical suites: 231 pass / one pre-existing CRLF byte-guard failure.
- Owner decisions 2026-10-31: placeholders are allowed for the Open Library contact
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
  proofs (8a-2..4), the post-generalization frozen golden (8a-4), prefill
  negatives (02d), provider-facts-only origin (OQ8-11).
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
