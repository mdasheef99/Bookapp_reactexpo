# Marketplace current state

Recorded state: 2026-10-31. Slice 8 package 8a-2 file complete (local only) on branch `phase9/slice8-providers`.
This file is rewritten at session close; dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 8 (Open Library first, replaceable providers), package 8a-2 complete (file only, not applied)**.
- Completed milestone: slice 8 package 8a-2 provider-validation migration (M90,
  889 lines), created as a local file only; not applied and not committed at the
  time of writing (the orchestrator commits it after this docs pass); earlier
  branch commits: `d25217b` slice 8 SDDs, `7a2ef73` Owner answers OQ8-5/9/10,
  `3c064da` package 1 red-first tests, `746e061` 8a-1 migration; nothing is pushed;
  [evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-2-provider-validation-file-complete-not-applied).
- Exact next authorized action: **package 8a-3, in which Sol builds the main
  migration; reviews and fixes then go to paid DeepSeek and Muse; Terra reviews
  the whole 8a layer after 8a-5**. Creating the file needs separate Owner
  approval. Its mention here does not authorize creation. The LF `.gitattributes`
  rule for `supabase/migrations/*.sql` goes as one small separate commit.

## Mutation authority now

- This task authorizes Markdown documentation edits only.
- Database/migration application: **none**; Storage: **none**; deployment: **none**.
- Migration M89 and M90 exist as local files only; they have not been applied. Nothing is
  deployed and nothing is pushed. No Supabase, Render, stage, commit, push, or
  branch switch is authorized by this task. The Owner authorized applying slice 8
  migrations after the usual review cycle for each migration, with a Haiku preflight
  (re-verify the project, read-only live registry check) and an ordered apply
  starting with M89. This authorization does not cover pushing or deploying.
  Nothing has been applied yet.

## Last recorded live state

These are recorded development-project results, not a fresh operational readback.

- Project: **`ahntbtktjjmvfosgkmgn`**; live ledger ends at **M88**, live version
  **`20261029151325`**; M89 and M90 are local files only and are **not applied**;
  [ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-10-31-slice-8-package-8a-2-file-complete-not-applied).
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

- Applying any 8a migration needs the per-migration review cycle plus a Haiku
  preflight (re-verify `ahntbtktjjmvfosgkmgn`, read-only live registry check),
  ordered starting with M89. Pushing and deploying are not authorized.
- Reviews of M90: Muse (no issues); paid DeepSeek (1 Low, overlong Open Library
  id lost the 256-character bound, confirmed with a probe and fixed); Terra
  read-only (2 Medium, both resolved; detail in the tracker entry). Terra noted
  M90 is not repeatable if applied twice (plain CREATE FUNCTION); M84 and M89
  follow the same pattern, so no change.
- Package 8a-2 test evidence: with the 8a-2 prefix, PGlite shows 230 tests
  (160 pass, 7 fail, 44 skipped, 19 TODO) and native Postgres shows 220 tests
  (155 pass, 7 fail, 39 skipped, 19 TODO). The 7 failures are the expected reds:
  five belong to 8a-4 and two tagged `[8a-2/4]` need a change to the existing
  `phase9_catalogue_store_cache_v1` (M88; its existing-cache early return precedes
  the Google veto), so they stay red until 8a-4. The 8a-1 prefix (148 pass /
  16 fail) and the M88 prefix (69 pass / 16 fail) are unchanged. Historical phase9
  suites show 199/199 and harness guards 6/6 (Sol run).
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
