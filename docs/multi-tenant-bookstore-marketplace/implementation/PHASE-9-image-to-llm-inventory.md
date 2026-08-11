# PHASE-9: Image-to-LLM Inventory Handoff

**Status:** `unit7a_create_only_design_frozen`
**Planning set:** `unit7a_ready_for_separately_authorized_red_tests`
**Implementation:** M01-M38 are live at their recorded levels; the automatic/functional Unit 6 upload-to-Owner-review path is PASS with no inventory/listing effects. Unit 7A is frozen as one eligible candidate to one new private inventory row from server-held review state, with no duplicate branch and Unit 7B publication separate. No Unit 7A test, runtime, or migration has been implemented. Native Unit 6F validation remains deferred accepted debt, not PASS.
**Last updated:** 2026-08-12

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
- [Unit 7A create-only commit SDD](./phase-9-image-inventory/work-units/07a-create-only-inventory-commit-sdd.md)

## Locked phase direction

- The current runtime treats the selected session language as a non-authoritative
  hint. Gemini returns detected language per observation; usable original Unicode
  title/author fields remain primary. The maximum remains 15 books/image;
  reject/rescan above 15.
- Camera and gallery/manual upload with one current image per simple Start/Close
  session. Before candidate lineage exists, the Owner may explicitly remove the
  current image and choose one replacement; append-style additional images are
  not allowed.
- The current compact Gemini contract returns original identity plus optional
  title Romanization, optional English title translation, and positionally
  aligned optional author Romanizations. Optional enrichment is non-fatal and
  does not replace original-script identity.
- Model/provider adapters with one primary and bounded fallback; model has no tools/data authority.
- Local canonical lookup then configured metadata providers remain the metadata
  path. The former giant nested provider sidecar is superseded. BookConnect maps
  usable compact enrichment into the existing M18/M19 private proposal envelope,
  keeps deterministic search keys separate from linguistic variants, preserves
  original-language title and author as primary values, confirms those fields
  independently, and activates variants only through field-specific,
  store-scoped reconciliation.
- Mandatory Owner review and explicit independent idempotent candidate commits.
  Unit 7A creates one new private inventory row per eligible candidate and has
  no duplicate lookup/choice, merge, existing-row increment, manual match, or
  keep-separate action. Historical duplicate behavior is deferred/legacy.
- Five public conditions plus separate damage; damaged sellable copies require note and 1-3 approved public photos.
- Bookstore-first marketplace results and complete public store catalogue.
- Customer-requested current-copy photos are mandatory before requested-item confirmation/payment readiness.
- Store Owner post-commit edits remain available through controlled commands.
- Phase 9 remains independent of deferred Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement behavior.

## Current evidence

- Supabase project re-verified during fixture deployment: `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`.
- `store_id` is canonical: 37 public-schema columns; zero `tenant_id`.
- M01-M08/M10-M35 are live exactly once; M09 and M36 are absent. Exact versions and
  readback evidence are maintained in the implementation tracker and
  current-versus-target audit.
- M13 uses only minimum postgres-owned, empty-`search_path` `SECURITY INVOKER` wrappers; the private schema remains unexposed and client roles remain denied.
- Owner ingestion is active with JWT verification. `phase9-media-sanitation` is
  live at `96991a9`; `phase9-fixture-vision` is live at `388d8bf`; both are
  configured from `main` with auto deploy off. No metadata Render service exists.
- Deployed `one_book` and eight fresh-process fixture cases passed normal claim/fencing/persistence/failure paths. Inventory/listing/published counts remained 5/5/5.
- The original provider decision selected Gemini 3.5 Flash (`gemini-3.5-flash`) and initial Google Books API metadata. At that checkpoint no real provider was configured or called. The reconciled generic architecture supports one metadata primary and zero or one separately evaluated secondary; no secondary/fallback provider is selected or enabled.
- The founder subsequently superseded only the initial vision model ID to
  configuration-driven `gemini-3.5-flash-lite`; the earlier decision remains
  historical. Real Gemini and Google Books execution are proven through Owner
  review. No optional vision fallback is selected or enabled.

## Next gate

The automatic/functional Unit 6 pipeline is **PASS** through Owner Needs Review;
automatic media, vision/Gemini, metadata, and Owner-review handoff completed
without inventory/listing effects. Native Unit 6F validation remains deferred
`NOT_RUN`/`UNRESOLVED` debt and is not promoted to PASS. The project owner
accepts that deferred native-validation risk and authorizes Unit 7 to begin in a
new bounded session. This authority supersedes older Unit 6 sequencing language
that made the native debt a Unit 7 blocker; it does not change any Unit 6 SDD or
acceptance criterion, and deployment/provider/database/Storage actions remain
separately gated.

Every material session must use the Phase 9 update matrix, append its evidence to the correct tracker, leave one exact next authorized action, and pass the continuity validator before handoff.
