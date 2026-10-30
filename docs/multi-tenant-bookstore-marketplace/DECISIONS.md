# Owner Decision Log — Marketplace

One place to see what the Owner has decided, with a dated line and a link to
the document that owns the full wording. This file is an **index**, not a new
authority: per `AGENTS.md`, the Owner's explicit decision is the highest
authority, and the owning SDD or tracker records its consequences. If this log
and the owning document disagree, the owning document is corrected from the
Owner's quoted words, and this line is fixed in the same change.

## How to use it

- Add one row when the Owner makes a product, scope, sequencing or authority
  decision in chat. Quote the Owner's words. Link the section that records it,
  or mark it "pending" with the document that must absorb it.
- Do not copy rationale or acceptance checks here; they stay in the owning
  document. Do not record status, test results or next actions here (those
  belong to `implementation/ACTIVE.md` and the trackers).
- When a pending decision is written into its owning document, replace
  "pending" with the link. Never delete a row; mark a reversed decision
  "superseded by <id>".

## Existing decision registers (read these for decisions before 2026-10-30)

| Area | Where the decisions are recorded |
|---|---|
| Phase 9 post-scan rework (PSR-D1 onward) | [SDD-0 §4 Decision register](./implementation/phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md#4-decision-register), [§5 Rejected options](./implementation/phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md#5-rejected-options-do-not-reopen-without-the-owner), [§14.1 Decided amendment questions](./implementation/phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md#141-decided-amendment-questions-owner-2026-10-25) |
| Phase 9 slice 7 (lean catalogue writes) | [02b §14 Owner questions and conflicts](./implementation/phase-9-image-inventory/work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md#14-owner-questions-and-conflicts), [02b §8.3](./implementation/phase-9-image-inventory/work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md#83-whole-slice-review-decisions-owner-2026-10-29-accept--document-no-m88) |
| Phase 9 planning before the rework | [Phase 9 tracker 01 — planning and decisions](./implementation/phase-9-image-inventory/trackers/01-planning-and-decisions.md) |
| Clubs (not marketplace) | [Clubs DECISIONS](../user/clubs/DECISIONS.md) |

## Log

| ID | Date | Decision | Owner's words | Recorded in |
|---|---|---|---|---|
| OD-2026-10-30-1 | 2026-10-30 | Slice 8 must make metadata providers replaceable: switching between installed providers by registry values, adding a new provider through an adapter, its validation rules and a registry row, without changing the rest of the system. Open Library becomes the primary automatic provider, Google Books is switched off (not removed). | "we are at this point changing to a primarily open library from google books … we should be able to add another provider or change providers in the future if we want to" | Pending: slice 8 pass-2 design and [02 SDD slice 8](./implementation/phase-9-image-inventory/work-units/post-scan-rework/02-catalogue-and-matching-sdd.md#slice-8--open-library-first-clues-google-off) |
| OD-2026-10-30-2 | 2026-10-30 | Slice 8 is split into 8a (database generalization: registry capabilities, forward-replaced SQL, per-provider validators), 8b (worker: registry-driven provider list, Open Library automatic adapter, clues, protection; deployed while Google is still primary) and 8c (switch: drain, Google off, Open Library automatic on, smoke). | "split it, if you think 3 parts is required not an issue" | Pending: slice 8 pass-2 design |
| OD-2026-10-30-3 | 2026-10-30 | Drop the AC8-10 compatibility row "old Google-primary worker after Google is switched off"; the 8b worker is the rollback target. Google stays disabled on rollback. | "drop it pl" | Pending: AC8-10 in [02 SDD slice 8](./implementation/phase-9-image-inventory/work-units/post-scan-rework/02-catalogue-and-matching-sdd.md#slice-8--open-library-first-clues-google-off) |
| OD-2026-10-30-4 | 2026-10-30 | Saving the automatic lookup's results to the card's edition sheet (PSR-D30) moves up to right after 8b instead of waiting for slice 9; the existing search button in the edition sheet stays (labelled "Search Books", or "Retry search" after a failure; the SDD calls it "Search again"). | "this is what i suggested right? and also to keep the serach button too which already exists" | Pending: SDD-0 §7.1 slice map and 02 SDD slices 8/9 |
| OD-2026-10-30-5 | 2026-10-30 | Work happens in the single checkout with a plain branch per slice; no new git worktrees. | "this is the reason i changed to a new folder, we shoud create a simple brach here" | Pending: `AGENTS.md` and [CODEBASE_MAP 07](../../CODEBASE_MAP/07-checkouts-and-shared-database.md) |
| OD-2026-10-30-6 | 2026-10-30 | Status documents are consolidated: one short current-state file (`implementation/ACTIVE.md`), the other status files point to it, dated history moves verbatim to `implementation/history/`. | "if you are sure aboout this please get sol to do it" | Pending: branch `docs/status-consolidation` |
| OD-2026-10-30-7 | 2026-10-30 | Keep this decision log as an index at `docs/multi-tenant-bookstore-marketplace/DECISIONS.md`, outside `CODEBASE_MAP/`. | "if you are confident about this then proceed please" | This file |
