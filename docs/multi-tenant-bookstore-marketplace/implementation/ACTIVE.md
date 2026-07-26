# Active Marketplace Phase Router

**Last updated:** 2026-07-26
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** [Unit 4A deployment-runtime scaffolding](./phase-9-image-inventory/work-units/04a-deployment-runtime-scaffolding-sdd.md); Unit 4 is integrated on `main` at `e9ba2d9`, all five Unit 4A review corrections and the synthetic GitHub Actions container gate are verified and Unit 4A is integrated, M01-M08/M10 are live-verified, and M11/M12 remain unapplied/undeployed
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
