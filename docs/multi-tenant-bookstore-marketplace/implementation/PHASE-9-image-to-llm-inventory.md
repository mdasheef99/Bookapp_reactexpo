# PHASE-9: Image-to-LLM Inventory Handoff

**Status:** `unit6f_open_wu2_locally_complete_core_pipeline_integration_unproven`
**Planning set:** `approved_baseline`
**Implementation:** M01-M08/M10-M30 plus WU1 are live at their recorded levels; WU2 is locally complete; Unit 6F remains open; real Gemini inference, production metadata enrichment, and the complete upload-to-review path remain unproven; Unit 7 is gated
**Last updated:** 2026-08-07

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
- [Unit 5C Lite governing target decision](./phase-9-image-inventory/work-units/05c-lite-multilingual-search-variants-sdd.md)
- [Unit 5C-2 persistence evidence](./phase-9-image-inventory/trackers/14-unit5c2-variant-persistence-evidence.md)

## Locked phase direction

- The implemented runtime still uses a selected language for each `spine_stack`.
  The approved Unit 5C Lite target instead auto-detects language/script per title
  and author field, with optional language hints. The maximum remains 15
  books/image; reject/rescan above 15.
- Camera and gallery/manual upload; multiple images per simple Start/Close session.
- The implemented runtime still defaults to English and permits another selected
  language before upload. That method is superseded as target authority by Unit
  5C Lite; mixed-language stacks and per-field language/script are approved
  target behavior, not current implementation.
- Model/provider adapters with one primary and bounded fallback; model has no tools/data authority.
- Local canonical lookup then configured metadata providers remain the metadata
  path. The former target rule requiring up to three automated English aliases
  is superseded. Unit 5C Lite instead permits an optional analysis-associated
  `search_variant_proposals_v1` sidecar with bounded provisional Roman variants,
  keeps deterministic search keys separate from linguistic variants, preserves
  original-language title and author as primary values, confirms those fields
  independently, and activates variants only through field-specific,
  store-scoped reconciliation. Unit 5C-1 supplies the provider-neutral sidecar
  contract/fixture validation, and Unit 5C-2 persists validated proposals
  privately as proposed/non-searchable through M18. Runtime generation,
  reconciliation/activation, search, and UI remain unimplemented.
- Mandatory owner review, advisory same-store duplicates, no image comparison/auto-merge, independent idempotent candidate commits.
- Five public conditions plus separate damage; damaged sellable copies require note and 1-3 approved public photos.
- Bookstore-first marketplace results and complete public store catalogue.
- Customer-requested current-copy photos are mandatory before requested-item confirmation/payment readiness.
- Store Owner post-commit edits remain available through controlled commands.
- Phase 9 remains independent of deferred Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement behavior.

## Current evidence

- Supabase project re-verified during fixture deployment: `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`.
- `store_id` is canonical: 37 public-schema columns; zero `tenant_id`.
- M01-M08/M10-M19 are live exactly once; M09 is absent. Exact versions and
  readback evidence are maintained in the implementation tracker and
  current-versus-target audit.
- M13 uses only minimum postgres-owned, empty-`search_path` `SECURITY INVOKER` wrappers; the private schema remains unexposed and client roles remain denied.
- Owner ingestion is active with JWT verification. `phase9-media-sanitation` and `phase9-fixture-vision` are separate free-plan Render services at `96991a9`, with auto deploy off.
- Deployed `one_book` and eight fresh-process fixture cases passed normal claim/fencing/persistence/failure paths. Inventory/listing/published counts remained 5/5/5.
- The original provider decision selected Gemini 3.5 Flash (`gemini-3.5-flash`) and initial Google Books API metadata. At that checkpoint no real provider was configured or called. The reconciled generic architecture supports one metadata primary and zero or one separately evaluated secondary; no secondary/fallback provider is selected or enabled.
- The founder subsequently superseded only the initial vision model ID to
  configuration-driven `gemini-3.5-flash-lite`; the earlier decision remains
  historical. The local adapter has mocked evidence only, the fixture adapter
  remains available, and no optional vision fallback is selected or enabled.

## Next gate

Unit 5C-1 and Unit 5C-2 are merged; the former Unit 5C Batch 1 handoff is
historical. The current authorized action is a read-only vertical integration
audit under the existing Unit 4B/5A/5B authority. It must determine the actual
production handoffs and gaps between upload/media processing, Gemini vision,
metadata enrichment, candidate persistence, and Owner review. It authorizes no
code, migration, provider call, deployment, scheduler, database/Storage
mutation, inventory/publication behavior, or Unit 7 work. Unit 6F and Unit 7
remain open and gated respectively.

Every material session must use the Phase 9 update matrix, append its evidence to the correct tracker, leave one exact next authorized action, and pass the continuity validator before handoff.
