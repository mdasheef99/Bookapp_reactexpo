# Active Marketplace Phase Router

**Last updated:** 2026-08-04
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** The [Unit 6 SDD](./phase-9-image-inventory/work-units/06-owner-capture-review-recovery-ux-sdd.md), [design evidence](./phase-9-image-inventory/trackers/18-unit6-owner-ux-design-evidence.md), and contract matrix remain authoritative. Unit 6A is merged/live-verified through M29, Unit 6B is merged at `9ef9eb3` with [tracker 20](./phase-9-image-inventory/trackers/20-unit6b-route-query-cache-evidence.md), and Unit 6C is merged through `092562d`. Unit 6D remains implemented at `c363b60` with [tracker 22](./phase-9-image-inventory/trackers/22-unit6d-candidate-review-evidence.md). Phase 9 Unit 6E false/missed-variant corrections are finalized at correction checkpoint `8bceab260a953b4d832fd55f34f58db12fa009b1`; [tracker 23](./phase-9-image-inventory/trackers/23-unit6e-review-corrections-evidence.md) owns the exact diff-only closure, M30 application, remote readback, bounded browser receipt, and handoff. M30 is live exactly once as `20260801093048 marketplace_phase9_unit6e_review_corrections`. WU1 is applied exactly once as `20260803221216 marketplace_phase9_owner_inventory_read_boundary`, with [addendum](./phase-9-image-inventory/work-units/owner-inventory-read-boundary-wu1-sdd.md) and [tracker 25](./phase-9-image-inventory/trackers/25-owner-inventory-read-boundary-wu1-evidence.md) recording the post-application readback and deferred Owner runtime gate. Unit 6F is the next eligible work after that credentialed runtime gate; its browser/readback verification and local quality gates are recorded in [tracker 24](./phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md), but representative low-end Android evidence remains required before Unit 6 completion/merge. Unit 7 remains separately gated.
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
