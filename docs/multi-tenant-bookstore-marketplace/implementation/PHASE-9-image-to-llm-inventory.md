# PHASE-9: Image-to-LLM Inventory Handoff

**Status:** `m11_m12_live_verified_services_undeployed`
**Planning set:** `approved_baseline`
**Implementation:** M01-M08/M10/M11/M12 live-verified; Unit 4A integrated; services undeployed
**Last updated:** 2026-07-27

This stable phase handoff points to the detailed planning set:

- [Active-phase router](./ACTIVE.md)
- [Mandatory development-session start](./phase-9-image-inventory/SESSION-START.md)
- [Phase 9 README and reading order](./phase-9-image-inventory/README.md)
- [Master tracker](./phase-9-image-inventory/TRACKER.md)
- [Master SDD](./phase-9-image-inventory/00-phase-9-master-sdd.md)
- [Live database/storage current-vs-target audit](./phase-9-image-inventory/supporting/database-current-vs-target.md)
- [Data dictionary](./phase-9-image-inventory/supporting/data-dictionary.md)
- [Implementation/verification tracker](./phase-9-image-inventory/trackers/02-implementation-and-verification.md)
- [Work Unit 0 contracts/threat/migration plan](./phase-9-image-inventory/work-units/00-contracts-threat-migration-plan.md)

## Locked phase direction

- Same-language `spine_stack` is first, maximum 15 books/image; reject/rescan above 15.
- Camera and gallery/manual upload; multiple images per simple Start/Close session.
- English default; owner selects another language before upload; mixed-language/per-spine routing excluded.
- Model/provider adapters with one primary and bounded fallback; model has no tools/data authority.
- Local canonical lookup then configured metadata providers; description and rich edition metadata; up to three automated English alias proposals plus bounded official/Owner-verified aliases.
- Mandatory owner review, advisory same-store duplicates, no image comparison/auto-merge, independent idempotent candidate commits.
- Five public conditions plus separate damage; damaged sellable copies require note and 1-3 approved public photos.
- Bookstore-first marketplace results and complete public store catalogue.
- Customer-requested current-copy photos are mandatory before requested-item confirmation/payment readiness.
- Store Owner post-commit edits remain available through controlled commands.
- Phase 9 remains independent of deferred Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement behavior.

## Current evidence

- Supabase project re-verified at M11/M12 closeout: `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`.
- `store_id` is canonical: 37 public-schema columns; zero `tenant_id`.
- M01-M08/M10/M11/M12 are live exactly once. M11 is `20260726182238`; M12 is `20260726182539`; M09 is absent.
- M11/M12 live verification confirmed hardened service-only RPCs, immutable analysis evidence, unchanged inventory/listings/events at 5/5/14, and zero objects in both relevant private buckets.
- Unit 4A deployment scaffolding is integrated. Owner ingestion, sanitation-worker, and fixture vision-worker services remain undeployed; no service secrets or real provider credentials are configured.
- The documentation-only live-application closeout is integrated on `main` at `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`.

## Next gate

M11/M12 live application is complete. The next eligible work unit requires separate authorization for ordered Owner-ingestion, sanitation-worker, and fixture-vision-worker deployment, infrastructure/service secret configuration, and live fixture-path verification. M09, real providers, metadata, UI, inventory/publication, lifecycle work, and any further migration remain separately gated.

Every material session must use the Phase 9 update matrix, append its evidence to the correct tracker, leave one exact next authorized action, and pass the continuity validator before handoff.
