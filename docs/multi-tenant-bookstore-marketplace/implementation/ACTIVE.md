# Active Marketplace Phase Router

**Last updated:** 2026-08-10
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** [Phase 9 Automatic Worker Wake Dispatcher](./phase-9-image-inventory/work-units/automatic-worker-wake-dispatcher-sdd.md) has a red-first local implementation and completed correction-only independent review. M36 is local/unapplied and creates one inactive cron; private claimability parity, Vault-only configuration, bounded secret-free observability, dispatch correlation, timeout evidence, and metadata-service deployment preparation are locally verified. The live project still has one claimable media job, no Phase 9 cron, no Phase 9 Vault secrets, deployed media SHA `96991a9` and vision SHA `388d8bf`, and no metadata Render service. Migration application, Vault/Cron/Render mutation, live image removal, worker invocation, final live proof, Git stage/commit/push, duplicate replay, Unit 7, inventory, and publication are prohibited.
- **2026-08-09 controlled web-proof stop:** the real Expo web path reached Profile → Store Owner Console → Inventory under the authenticated Owner session. Inventory exposed an older active capture with 6 processing images and 1 review item; exact-project read-only baseline was 4 sessions total, 3 active/closing, 18 inputs, 27 jobs, 8 pending jobs, 13 candidates, and zero metadata jobs/attempts/provider calls/lookups/cache entries. The shared queue could not be isolated to a new image, and the process had no Google Books credential, so no fresh session or upload was started. The browser is left on `/inventory`.
- **2026-08-09 M33 local correction:** the later fresh proof reached sanitized media but exposed a missing vision reservation before Gemini. Forward-only M33 is locally implemented and unapplied with private-helper, atomic rollback, M14 registration, terminal/malformed-history exclusion, and complete M31/M32-tail compatibility evidence; combined focused PGlite is 61/61. The independent review's two required corrections are locally complete; correction-only rereview and separate exact-project application/readback are next. The original vision job remains attempt `4/5`; a later duplicate open media input is untouched.
- **2026-08-09 compact Gemini correction:** compact multilingual output, five-author bounds, non-fatal enrichment, language-as-hint behavior, and local forward M34 are complete. The independent review's privileged-diagnostics correction now filters failure-log identifiers and successful provider response IDs before attempt persistence; red-first evidence, focused Jest 47/47, and vision-worker TypeScript are green. M34 remains unapplied; independent correction-only rereview is next. Provider proof, deployment, migration application, and attempt 5 remain separately gated.
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
