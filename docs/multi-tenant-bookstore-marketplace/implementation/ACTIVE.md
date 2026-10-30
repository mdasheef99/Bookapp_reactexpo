# Marketplace current state

Recorded state: 2026-10-29. Documentation consolidated 2026-10-30 from `5face78`.
This file is rewritten at session close; dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 7b-2 live and smoked; closeout published**.
- Completed milestone: slice 7b-2 migrations, worker cache reuse, Open Library
  lookup and same-store reuse smoke, whole-slice review, and test-infrastructure
  fixes; [tracker 38 section 49](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).
- Exact next authorized action: **the Owner chooses the next work unit (slice 8)**.
  Read its scope in the [post-scan-rework SDDs](phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md)
  before starting; its mention here does not authorize implementation.

## Mutation authority now

- This consolidation authorizes local documentation and continuity-validator edits only.
- Database/migration application: **none**; Storage: **none**; deployment: **none**.
- No network, Supabase, Render, stage, commit, push, or branch switch is authorized
  by this task. Prior approvals and actions remain historical evidence in
  [tracker 38 sections 48-49](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#48-m88-applied-to-supabase-2026-10-29).

## Last recorded live state

These are recorded development-project results, not a fresh operational readback.

- Latest applied migration: **M88**, local file
  [20261029000088_marketplace_phase9_catalogue_cache_hardening.sql](../../../supabase/migrations/20261029000088_marketplace_phase9_catalogue_cache_hardening.sql),
  live version **`20261029151325`**; [application/readback](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#48-m88-applied-to-supabase-2026-10-29).
- Deployed worker: **`phase9-metadata-worker`**, deploy **`dep-dbhmr07b9u1s73f8qjpg`**,
  from **`3fdc0c4`** on `main`, live about 16:02 UTC 2026-10-29, `/health` 200;
  [deployment and smoke](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).
- Latest relevant recorded commit on `main`: **`0d240ef`**, closeout docs and three
  test-infrastructure files; no worker change or redeploy was needed; [publication evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).
- No Expo/app release was made in that closeout; [recorded boundary](history/ACTIVE-history-to-2026-10-29.md#2026-10-29---slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes).

## Open items, blockers and residual risks

- Next-slice gate: the Owner must choose the next work unit; [handoff evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).
- AC7-21(b) synthetic-provider admission remains UNPROVEN; [Owner disposition](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29).
- The provider-facts-only privacy case remains UNPROVEN; [Owner disposition](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29).
- The in-flight/selected-option rollback matrix was not proved by the lookup/reuse smoke; [section 46](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#46-slice-7b-2-package-11-independent-closeout-review-2026-10-29).
- Live Google Books, expiry/invalidation, M88 guard firing and response-field comparison remain unproved; [smoke limits](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).
- Accepted items 3-6, 8, 10, 11 and 14 retain policy, hide-race, attempt-budget and fallback-reuse limits; [Owner decisions](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29).
- Worker TypeScript names remain spec-silent; confirmation status is recorded in [sections 45-46](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#45-slice-7b-2-package-10-worker-cache-reuse-path-reviews-and-verification-2026-10-29).
- Accepted Low SQL/test residuals and receipts/effects cleanup debt remain; [section 47](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29).
- Representative low-end Android Unit 6F validation remains deferred, not PASS; [owning evidence](phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md).
- The last closeout did not run the docs validator or the whole test:phase9:db suite; [section 49](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).

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
