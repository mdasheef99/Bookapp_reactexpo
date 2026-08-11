# Active Marketplace Phase Router

**Last updated:** 2026-08-12
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** Unit 7A create-only inventory commit is locally complete and review-pending on `codex/phase9-unit7a-create-only-inventory`. Local unapplied M39, the authenticated Edge command, and the mobile action implement one eligible candidate to one new private inventory row from the current server-held saved review; duplicate lookup/merge/increment/manual-match/keep-separate behavior is excluded, and publication is Unit 7B. Dedicated PGlite is 13/13, Phase 9 Edge/mobile/migration regression is 479/479, and TypeScript passes with the documented import flag. No live migration, database/Storage mutation, deployment, inventory/listing/publication effect, or Git publication occurred. The next authorized action is review of the complete local diff; M39 application, Edge deployment, authenticated live smoke, staging/commit/push, Unit 7B, and Unit 7C require separate explicit authorization. Unit 6 automatic/functional PASS and its accepted deferred native validation debt remain unchanged.
- **2026-08-09 controlled web-proof stop:** the real Expo web path reached Profile → Store Owner Console → Inventory under the authenticated Owner session. Inventory exposed an older active capture with 6 processing images and 1 review item; exact-project read-only baseline was 4 sessions total, 3 active/closing, 18 inputs, 27 jobs, 8 pending jobs, 13 candidates, and zero metadata jobs/attempts/provider calls/lookups/cache entries. The shared queue could not be isolated to a new image, and the process had no Google Books credential, so no fresh session or upload was started. The browser is left on `/inventory`.
- **2026-08-09 M33 live correction:** exact-project migration history now records M33 once as `20260809023834 marketplace_phase9_vision_reservation_correction`; the preserved vision job is `retry_scheduled` at attempt `4/5` with its sanitized 1600x1600 WebP lineage intact.
- **2026-08-09 schema-free Gemini JSON correction:** Gemini now receives JSON MIME mode and the user's flat `vision` prompt with no provider response schema; BookConnect keeps strict local validation and server-owned M18/M19 mapping. The live payload evidence supports a narrow compatibility layer: `success` becomes `analyzed`, null language becomes `und`, known language names become BCP 47 tags, safe ISBN labels are stripped, and an analyzed visible-book count is reconciled to the accepted observation count. Five exact-path Jest suites and the later main-line diagnostic protect these mappings. M34, jobs, metadata, Owner UI continuation, inventory, and publication remain separately controlled.
- **2026-08-10 single-image correction:** `unit6c_single_image_safe_remove` remains the completed live operational checkpoint, not the active work unit. Remove image remains; append-style Add another image is removed. M35 is live once as `20260809223135`, the three explicitly targeted legacy inputs were logically removed with their exact jobs cancelled, and Owner Edge `phase9-owner-ingestion` v3 is active with an exact four-file readback match. No candidates, inventory, listings, or physical Storage objects were deleted. One new input was registered after the removals and is observation-only pending a new explicit decision.
- **Global status authority:** [DOC-13](../DOC-13-implementation-tracker.md)

## Required reading order

1. [DOC-13 current status](../DOC-13-implementation-tracker.md)
2. [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
3. [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
4. [Phase 9 master SDD](./phase-9-image-inventory/00-phase-9-master-sdd.md)
5. The domain SDD and supporting documents routed by SESSION-START for the active work unit
6. [Implementation and verification tracker](./phase-9-image-inventory/trackers/02-implementation-and-verification.md) when implementation is authorized

## Route-change transaction

When the active phase changes, update these together in one reviewable change:

1. DOC-13 current status, phase table, handoff, and next action;
2. this router;
3. the outgoing phase tracker with a final closeout/next-phase link;
4. the incoming phase tracker/session-start file;
5. marketplace and implementation README current-handoff sections;
6. the current marketplace pointer in repository `AGENTS.md`.

Do not point this file to an unapproved phase merely because work is proposed. A route change requires an explicit product/roadmap decision recorded in DOC-13.
