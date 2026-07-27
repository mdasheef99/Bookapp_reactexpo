# PHASE-9: Image-to-LLM Inventory Handoff

**Status:** `unit4b_gemini_adapter_needs_independent_review`
**Planning set:** `approved_baseline`
**Implementation:** Unit 4B local-only; M01-M08/M10-M13 and the fixture pipeline remain live-verified
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
- [Fixture-pipeline deployment evidence](./phase-9-image-inventory/trackers/06-fixture-pipeline-deployment-evidence.md)
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

- Supabase project re-verified during fixture deployment: `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`.
- `store_id` is canonical: 37 public-schema columns; zero `tenant_id`.
- M01-M08/M10-M13 are live exactly once. M11 is `20260726182238`; M12 is `20260726182539`; M13 is `20260727025046`; M09 is absent.
- M13 uses only minimum postgres-owned, empty-`search_path` `SECURITY INVOKER` wrappers; the private schema remains unexposed and client roles remain denied.
- Owner ingestion is active with JWT verification. `phase9-media-sanitation` and `phase9-fixture-vision` are separate free-plan Render services at `96991a9`, with auto deploy off.
- Deployed `one_book` and eight fresh-process fixture cases passed normal claim/fencing/persistence/failure paths. Inventory/listing/published counts remained 5/5/5.
- Future decisions select Gemini 3.5 Flash (`gemini-3.5-flash`) and initial Google Books API metadata. The reconciled generic architecture supports one metadata primary and zero or one separately evaluated secondary; no secondary/fallback provider is selected or enabled and no real provider was configured or called.
- The founder subsequently superseded only the initial vision model ID to
  configuration-driven `gemini-3.5-flash-lite`; the earlier decision remains
  historical. The local adapter has mocked evidence only, the fixture adapter
  remains available, and no optional vision fallback is selected or enabled.

## Next gate

The fixture-pipeline deployment remains complete. Unit 4B is locally implemented,
and one independent Unit 4B review is the only next authorized action. Unit 5
remains Metadata/aliases. M09, provider configuration/calls, deployment,
scheduling/autoscaling, metadata runtime, UI, inventory/publication, lifecycle
work, Library behavior, and any further migration remain separately gated.

Every material session must use the Phase 9 update matrix, append its evidence to the correct tracker, leave one exact next authorized action, and pass the continuity validator before handoff.
