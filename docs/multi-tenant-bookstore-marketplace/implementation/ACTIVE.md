# Active Marketplace Phase Router

**Last updated:** 2026-07-29
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** [Unit 5C-4](./phase-9-image-inventory/trackers/16-unit5c4-active-variant-search-evidence.md) is independently approved at tree `db8ea75ed2904e8c381eec814f96804198d16b1e` and fast-forward merged at `d092f081d95b8c551bfcadcfd58fe8c98c77dfb2`. M22 is live as `20260729075459` and immutable forward correction M23 is live as `20260729082153` on development project `ahntbtktjjmvfosgkmgn`. The next active implementation batch combines Unit 5C-5 exceptional Owner variant-decision backend authority and Unit 5C-6 benchmark/per-language rollout-control infrastructure in one backend session and branch after this closeout merges. It exposes UI-ready contracts but includes no visual UI, assumes no qualifying benchmark evidence, keeps rollout fail closed by default, and requires exact-tree independent review before applying new migrations.
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
