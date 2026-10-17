# BookConnect Shelf Interaction Flow

**Status:** Draft for user review  
**Date:** 2026-09-30  
**Artifact:** Separate Stitch project, `BookConnect — Shelf Interaction Flow`

## Intent and success

Create a small interactive mobile prototype that tests the main Shelf task: a reader browses a personal shelf, opens a book, changes its reading state or adds a note, and returns to the same place on the shelf. Keep the existing Stitch project as the visual reference and leave it unchanged.

Success means a viewer can complete that loop in Stitch's Play preview without relying on a hidden gesture, understand the book's current state, and return without losing their place.

## Options considered

1. **Add flow screens to the current Stitch project.** Fastest reuse, but adds more material to an already busy reference canvas and risks disturbing the source project.
2. **Create a parallel Stitch project and bring over the shelf screen and design rules.** Keeps the reference intact, gives the interaction exploration a clean canvas, and supports Stitch's linked-screen Play workflow. **Recommended and selected.**
3. **Export the screen code and prototype in the repository first.** Gives more control over code-level behavior, but moves the work away from Stitch's visual iteration and Play flow before the interaction has been settled.

Transfer the selected screen as a visual reference and reuse its `DESIGN.md` design rules if available. If Stitch does not offer direct cross-project screen duplication, recreate the starting screen from that reference rather than altering the source project.

## Visual direction

- Preserve the selected shelf's warm parchment, natural wood, and tactile book-spine treatment.
- Keep the shelf as the visual anchor while making search, book actions, and navigation easy to find.
- Use the current BookConnect visual language; do not switch to the unrelated dark/obsidian direction.
- Use sample content clearly as prototype data. Prefer a real title already present in the app, such as *Dune*, and avoid carrying over the mock counts (12 notes / 148 wishlist) or the unrelated Atomic Habits 65% reading state.

## Screens and interactions

### 1. Shelf home

Show the bookshelf, a clear page title, the available shelf/search controls, and labeled primary navigation. Keep book spines individually selectable; tapping a spine opens that book. Tapping remains the primary interaction, with any pull-out animation serving as feedback rather than a required gesture.

### 2. Book preview

Show the selected book's title, author, and known status with a clear **View details** action and a clear close/back action. Do not invent progress or ownership data; use an explicitly marked prototype state where the real value is unknown.

### 3. Book details

Provide the reading-state controls already used by BookConnect (Want to Read, Reading, Completed), a visible current selection, and an **Add note** action. Selecting a status updates the prototype state and gives brief, readable confirmation.

### 4. Note editor and return states

Open a compact note editor from Book Details with a note field, optional page number, and a clear **Save note** action. Saving gives confirmation and returns to Book Details. Returning to Shelf restores the prior scroll position and selected book context.

### Connected path

`Shelf → Book preview → Book details → status update or Add note → saved confirmation → Book details → Shelf`

Use Stitch's screen connections to link the controls and validate the path in Play. Keep the note flow as a branch from Book Details; do not build unrelated app sections into this prototype.

## Accessibility and motion

- Give navigation and icon-only controls readable labels and a visible selected state.
- Make the whole book target easy to tap; do not make long press the only way to open a title.
- Keep text legible against the parchment and wood surfaces and show reading progress as text as well as a visual bar when present.
- Keep motion brief and non-blocking; preserve a usable interaction when motion is reduced or unavailable.

## Boundaries and handoff

- This is a Stitch interaction prototype, not a production implementation.
- Do not connect it to Supabase, modify app data, or claim its placeholder state is live data.
- Do not change the existing Stitch source project.
- After the flow is approved in Play, export the generated front-end code only as a starting point for a separate app integration step.

## Review checklist

- The parallel project is separate from the source project.
- The visual treatment remains recognizably aligned with the selected warm shelf screen.
- A tap opens the correct book preview; **View details**, status changes, note save, and back navigation each work in Play.
- Confirmation is visible, and returning to Shelf preserves the user's place.
- Placeholder data is identifiable and does not repeat the inconsistent source mock counts.
- No backend, database, or repository product-code changes are included in the Stitch prototype.
