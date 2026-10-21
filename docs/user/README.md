# User Docs

**Router for consumer Library -> Exchange -> Clubs -> Profile**

Worktrees: clubs lives on `feat/clubs-ui-overhaul` in `Bookconnect4_expo`, library now lands on `main` via short branches from `main`, and the `Bookconnect4_library` worktree is historical — each session edits only its own tree.

- `library/` - [Library tracker](./library/TRACKER.md) owns current Library status and next action; SDD-01–06 are done or superseded; SDD-07 ([link](./library/SDD-07-book-section-ui-overhaul.md)) Flows A–D are merged to `main`
- `clubs/` - `SDD-01-ui-overhaul` audit complete docs-only on `feat/clubs-ui-overhaul`, baseline Jest 18 suites/190 tests, P1-P5 phases pending approval, `TRACKER.md` SOT

`CODEBASE_MAP/` is orientation only; update it as its README describes. `docs/multi-tenant-bookstore-marketplace` is marketplace SOT, not user.
- `library/UI-UX-INVENTORY.md` - current feature/route map and Stitch design handoff; distinguish implemented behavior from sample data and proposed work before adding screens
- `library/INTERACTION-MAP.md` - route-by-route control inventory showing what each current button/selectable control does, where it leads, and which controls/states are currently no-op or missing
- [Library tracker](./library/TRACKER.md) owns the current Library work unit, verification limits, commit checkpoints, and exact next action.
- [SDD-05: Library Reading Room](./library/SDD-05-library-reading-room.md) owns the vertical Shelf design, shared Arrange architecture in section 20 and first implementation in section 21. The vertical baseline is committed as `809e18e` plus `60ac8dd`; the current Arrange checkpoint is included in the scoped local commit containing this handoff, with verification owned by the tracker.
- [Horizontal Shelf implementation contract](./library/HORIZONTAL-SHELF-IMPLEMENTATION.md) owns the selected Stitch reference, pile grouping, and independent tier scrolling. Read its section 8 and SDD-05 sections 20–21 before horizontal work: reuse existing book order and draft/Undo/Save/Cancel code; implement dragging separately for each layout.

**Shelf session reading order:** Library tracker -> UI/UX inventory -> interaction map -> SDD-05 sections 19–21 -> Horizontal Shelf contract for any horizontal work. These are Library-specific documents; repository `AGENTS.md` and the active marketplace continuity protocol remain the overall session entry.

