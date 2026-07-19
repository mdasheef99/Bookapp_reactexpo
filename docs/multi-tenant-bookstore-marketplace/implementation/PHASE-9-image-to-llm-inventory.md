# PHASE-9: Image-to-LLM Inventory Handoff

**Status:** `planning_approved`
**Planning set:** `approved_baseline`
**Implementation:** `not_started`
**Last updated:** 2026-07-19

This stable phase handoff points to the detailed planning set:

- [Active-phase router](./ACTIVE.md)
- [Mandatory development-session start](./phase-9-image-inventory/SESSION-START.md)
- [Phase 9 README and reading order](./phase-9-image-inventory/README.md)
- [Master tracker](./phase-9-image-inventory/TRACKER.md)
- [Master SDD](./phase-9-image-inventory/00-phase-9-master-sdd.md)
- [Live database/storage current-vs-target audit](./phase-9-image-inventory/supporting/database-current-vs-target.md)
- [Data dictionary](./phase-9-image-inventory/supporting/data-dictionary.md)
- [Implementation/verification tracker](./phase-9-image-inventory/trackers/02-implementation-and-verification.md)

## Locked phase direction

- Same-language `spine_stack` is first, maximum 15 books/image; reject/rescan above 15.
- Camera and gallery/manual upload; multiple images per simple Start/Close session.
- English default; owner selects another language before upload; mixed-language/per-spine routing excluded.
- Model/provider adapters with one primary and bounded fallback; model has no tools/data authority.
- Local canonical lookup then configured metadata providers; description and rich edition metadata; up to three approved English search aliases.
- Mandatory owner review, advisory same-store duplicates, no image comparison/auto-merge, independent idempotent candidate commits.
- Five public conditions plus separate damage; damaged sellable copies require note and 1-3 approved public photos.
- Bookstore-first marketplace results and complete public store catalogue.
- Customer-requested current-copy photos are mandatory before requested-item confirmation/payment readiness.
- Store Owner post-commit edits remain available through controlled commands.
- Phase 9 remains independent of deferred Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement behavior.

## Current evidence

- Supabase project re-verified 2026-07-19: `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`.
- `store_id` is canonical: 37 public-schema columns; zero `tenant_id`.
- Core canonical/inventory/listing tables exist; Phase 9 extraction/enrichment/media/request-photo tables do not.
- No Phase 9 migration, function, bucket/policy, code, or data mutation has occurred.

## Next gate

The planning baseline was approved on 2026-07-19. The active action is to create the TDD/security/migration-design plan for Work Unit 0 only. Creating migration files and applying them to Supabase remain unauthorized separate actions and require fresh exact-project/schema/storage verification.

Every material session must use the Phase 9 update matrix, append its evidence to the correct tracker, leave one exact next authorized action, and pass the continuity validator before handoff.
