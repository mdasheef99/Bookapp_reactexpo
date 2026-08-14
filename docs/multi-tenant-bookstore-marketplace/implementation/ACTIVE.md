# Active Marketplace Phase Router

**Last updated:** 2026-08-14
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Latest runtime state:** M41 was accepted and M42 is applied exactly once. Owner Edge v7 and the Render publication worker remain live/ready; Unit 7B live proof is PASS and merged into `main` at `53edbddc9c5417b34cb169599e8282b162e183b3`. Unit 7C WU2A is locally complete on `codex/unit7c-wu2a-store-view-filter-contract`; local M43/M44 candidates are not applied to Supabase.
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** WU2A forward-only M44 corrects Store View page pagination with authoritative server-side filters and actor/store/filter-bound cursors; `needs_attention` uses `attentionState = action_required` while publication-failed cards retain their distinct returned state. Exact M01–M44 and focused WU1/WU2A proofs pass. The exact next action is separate authorization to commit this correction. Do not apply M43/M44, mutate Supabase/Storage, deploy, live-verify, or begin Edge/client/UI work without separate authorization.
- **2026-08-14 Unit 7B closeout:** The real private row `The Birth of Tragedy` completed Publish → anonymous discovery (exactly one listing) → Pause (removed from discovery) → Republish (exactly one listing). The controlled transient fault produced one `publication_failed`/retry job; the worker resolved it, and the stale-intent retry was fenced with `P9_STATE_CONFLICT`. Final connected readback preserved quantity/identity and showed one active listing with zero outstanding publication retries. The development `active_listing_limit` entitlement was then raised from the temporary `unit7b_dev_rollout` value `1` to `10`; authoritative eligibility now passes for the other ready rows, while `Café du Livre` remains blocked by its zero price.
- **2026-08-14 Unit 7B main integration:** Commit `9f3e646` was merged into `main` at merge commit `53edbddc9c5417b34cb169599e8282b162e183b3`. No additional migration, live business-row mutation, or Unit 7C action was performed as part of the merge.
- **Historical 2026-08-12 pre-correction checkpoint:** The sole authorized `phase9-owner-ingestion` deployment attempt failed before activation because the bundler could not resolve `../contracts/registers` without `.ts`; at that checkpoint version 3 remains ACTIVE and controlled live Add-to-Inventory/exact replay was blocked. The corrected version 4 deployment and current UI-availability gate are recorded above.
- **Latest 2026-08-12 controlled-proof update:** Edge version 5 resolved the `OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` that had hidden Add to Inventory. At 04:41 UTC the authenticated Owner committed `Individuals` from candidate `f6266e3a-e920-4fa0-a993-c02c739f5108`; at approximately 05:00 UTC the exact original command replay returned the canonical recorded result for inventory `5f5a2bc9-d702-4aeb-af55-2a9df6c16478`. Readback verified one inventory row, `committed_count=1`, one completed idempotency row, one audit log, and one event, with zero new replay effects. `UNIT_7A_LIVE_PROOF` is PASS and the UI-availability gate is CLEARED. `Thinking, Fast and Slow` remains uncommitted (`review_ready=false`) and is outside the proof.
- **Latest 2026-08-12 fresh-image observation:** user-started session `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one image, but media validation retried and the input is now server-readback `skipped` with `P9_OWNER_REMOVED`; its job is cancelled at attempt `2/5` and the session has zero candidates. The input must not be revived without a new explicit target decision.
- **Latest fresh-processing continuation:** the same user-started session later accepted a second image and completed successfully. It produced two candidates, `Individuals` and `Thinking, Fast and Slow`; both are server-readback `state=ready` with `review_ready=false`. The first review screen loads matched metadata but requires a price and Owner confirmations, so no new review or inventory write has been made.
- **Latest fresh review action:** candidate `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved privately with quantity `1` and price `250000` paise; server readback is `ready`/`reviewed`/`review_ready=true`. Its next-step detail failed twice, so Add to Inventory was unavailable; inventory remains `5` and Unit 7A commit counters remain zero.
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
