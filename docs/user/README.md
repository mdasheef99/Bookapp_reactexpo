# User Docs

**Router for consumer Library -> Exchange -> Clubs -> Profile**

- `library/UI-UX-INVENTORY.md` - current feature/route map and Stitch design handoff; distinguish implemented behavior from sample data and proposed work before adding screens
- `library/INTERACTION-MAP.md` - route-by-route control inventory showing what each current button/selectable control does, where it leads, and which controls/states are currently no-op or missing
- `library/` - `SDD-01-hardening` live 20260820, `SDD-02-notes` docs, `SDD-03-ocr-vault` live vault `user_book_pages` 800/4000 `20260820064258`+`20260821100001` OCR hybrid `en` deferred native, `TRACKER.md` SOT `ahntbtktjjmvfosgkmgn`
- [Library tracker](./library/TRACKER.md) owns the current Library work unit, verification limits, commit checkpoints, and exact next action.
- [SDD-05: Library Reading Room](./library/SDD-05-library-reading-room.md) owns the vertical Shelf design, shared Arrange architecture in section 20 and first implementation in section 21. The vertical baseline is committed as `809e18e` plus `60ac8dd`; the current Arrange checkpoint is included in the scoped local commit containing this handoff, with verification owned by the tracker.
- [Horizontal Shelf implementation contract](./library/HORIZONTAL-SHELF-IMPLEMENTATION.md) owns the selected Stitch reference, pile grouping, and independent tier scrolling. Read its section 8 and SDD-05 sections 20–21 before horizontal work: reuse existing book order and draft/Undo/Save/Cancel code; implement dragging separately for each layout.

**Shelf session reading order:** Library tracker -> UI/UX inventory -> interaction map -> SDD-05 sections 19–21 -> Horizontal Shelf contract for any horizontal work. These are Library-specific documents; repository `AGENTS.md` and the active marketplace continuity protocol remain the overall session entry.

Note: clubs docs (`clubs/`) live on `feat/clubs-ui-overhaul`; this tree is library-only via git worktree.
