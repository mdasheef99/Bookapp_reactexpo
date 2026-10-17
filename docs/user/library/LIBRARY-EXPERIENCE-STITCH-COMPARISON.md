# Library Experience — Option A/B Stitch Comparison

**Date:** 2026-10-07
**Scope:** Design proposals after an already-open Book Details screen. Shelf, Library list, QuickLook, catalogue search and book entry are excluded.
**Authority:** User authorized separate new Stitch projects for both alternatives, following the [audit](./LIBRARY-EXPERIENCE-AUDIT.md) and [Astra critique](./LIBRARY-EXPERIENCE-ASTRA-REVIEW-20261007.md). This does not select a structure or authorize application/schema implementation.

## Latest Option B cleanup — 2026-10-08

The user authorized refinement and removal of unwanted designs for a clean next-session reference. The current board has exactly **14 B01–B14 target screens plus one flow/index**. Eighteen obsolete nodes were removed through Stitch's UI with selection/absence verification and an Undo recovery action. Each target now has a visible stable B ID and title. Use [OPTION-B-NAVIGATION-CONTRACT.md](./OPTION-B-NAVIGATION-CONTRACT.md) for the exact keep set and observed node IDs. OCR feeds editable note content in this notes-first design; standalone passage saving and cloud OCR remain deferred. Final rendered-DOM/accessibility readback verified the corrections and exact 15-node keep set. Frame positions remain unchanged because canvas dragging failed; numbered titles and the index provide navigation. Owner review remains pending. Application implementation remains for a later separately authorized session. The nine-screen snapshot and A/B comparison below are historical, not current inventory or lookup instructions.

## Historical nine-screen Option B snapshot — 2026-10-08

The owner manually removed the earlier surplus Option B screens. The project currently contains **9 active artboards** in one Stitch project: five core screens (Book Details, populated Notes, empty Notes, Add note, Read note), one Edit note variant, and three condition states (Notes load error, unsaved-exit confirmation, definite note-save failure). The former 23-state count below describes the earlier generated comparison and is not the current canvas inventory.

The latest refinement removed invented cloud/sync and durable-draft claims from the recovery screens. The definite save-failure artboard still shows both a top “Retry save” and an inline “Retry”, with the bottom “Save note” action present; this duplicate action hierarchy needs owner review. The error state offers Retry and Back to Book details. The unsaved-exit dialog offers Keep editing and a destructive discard action. The five approved note categories remain Quote, Thought, Takeaway, Action and Question. Page number is optional; no character/word limit is displayed. Passage capture/OCR and the separate passage feature are deferred from this notes-first design pass. These screens are static designs, not connected flows or app implementation; Book Details is the starting point, and Shelf, List, QuickLook, catalogue Search and opening a book are out of scope.

The Add note artboard was refined in place: its duplicate header Save control was removed, leaving one bottom Save note action that is disabled while the composer is blank. The optional page helper remains and no limit is displayed. The separate Edit note artboard now covers the existing `isEditing` mode with saved text, category and optional page prefilled and one Save changes action. Its unsupported “Saved draft” status, unrelated sample quotation and empty reference card were removed.

Source-backed gaps that these designs represent but do not implement: `NoteEditor.closeEditor()` currently closes without an unsaved-change guard, and the Notes query does not render a distinct load-error state. A blank-note or invalid optional-page condition can remain inline; collection loading and save-in-progress should be transient UI states rather than extra full artboards. A category-filtered empty view is optional if category filters remain. An uncertain save result is not specified until retry/idempotency behavior is decided.

Condition coverage assessment: the empty and populated collections are represented; load failure, dirty-exit confirmation and definite save failure each have separate state artboards. No other full-screen condition is essential for owner review. A category-filtered empty result can be an inline message with a route back to All; blank input/page validation belong in the composer; loading and saving can remain transient. The app source does not yet implement the load-error or dirty-exit treatments shown here. An uncertain save outcome still needs a retry/idempotency decision before a truthful treatment can be specified; if the app can encounter an ambiguous timeout, define reconciliation/idempotency behavior before adding a separate screen.

The prior A/B comparison content below is retained as historical evidence from 2026-10-07. Its old screen counts and passage/OCR constraints are not the current Option B design specification. Exact next action: owner reviews the current nine Option B artboards, with particular attention to the save-failure action hierarchy and rendered discard-button spacing, and approves or requests changes before implementation.

## Projects and evidence

- [Option A — Embedded](https://stitch.withgoogle.com/projects/15742741459056702532): new browser tab 6. Stitch initially named it BookConnect Embedded Prototype.
- [Option B — Collection](https://stitch.withgoogle.com/projects/12974171775283639004): new browser tab 7.
- Exact submitted briefs: [A](./design-review-20261007/option-ab/option-a-initial-prompt.txt), [B](./design-review-20261007/option-ab/option-b-initial-prompt.txt).
- UI model selector inspected: Balanced = Gemini 3.8 Flash; Speed = Gemini 3.5 Flash-Lite. Both briefs use Balanced. This is observed selector wording, not an independently verified backend model or claim about the newest model globally.

## Fair comparison contract

Both alternatives share typography, palette, spacing, sample content, direct Capture passage/Add note actions, full read-first surfaces, note editor and passage capture/recovery behavior. Use original sample book A Quiet Practice by Mira Vale, one Thought note and one passage on page 24. Keep five approved categories, including Quote and Question. Do not invent metrics, extra navigation, private-access guarantees, durable drafts or passage-note links.

Option A places bounded recent Notes and Saved passages previews directly on Book Details and provides separate complete lists. Option B has no recent preview in its main candidate: Book Details links to one Notes & passages collection with immediately visible tabs, not a type-selection interstitial. A recent preview in B remains a later testable proposal.

## Design passes

1. Structure: upper/lower Book Details views (one scrollable page), complete notes and passage collections, read-note and saved-passage surfaces. Preserve management, lending/condition, rating/review visibility, metadata, community reviews and removal access.
2. Creation: note editor, capture-source sheet, photo preparation, passage review, and OCR insertion/replacement review inside an existing note. Same layout/behavior in both projects; return paths fit each structure.
3. States: empty/error collections; permissions/no-text/cancel; extraction boundary acceptance; missing-page/length validation; same-page replacement; dirty exit; saving, definite failure and uncertain outcome; narrow/large-text layout.
4. Inspect and compare: actual generated screens and visible interactions, with missing wiring/runtime/accessibility evidence explicitly recorded. Then owner review before implementation.

## Provisional behavior for design

- Notes have optional positive page and 500-word maximum. Passages require a positive integer page and both 800-word/4,000-character limits.
- Paste bypasses photo preparation. On-device OCR only; cloud remains deferred.
- Extraction boundary is 20,000 Unicode code points; incomplete text needs explicit acceptance and edits invalidate that acceptance.
- OCR inside a nonempty note requires explicit insertion/replacement choice; preserves its category and creates no passage. This is a design proposal requiring implementation approval.
- Same-page replacement shows original/new content and explicit Keep original/Replace passage. No version history promised.
- Question writes, removal consequences, verified privacy and restart-durable U3 drafts remain implementation/schema gates, not capabilities established by a prototype.
- Swipe review is deferred from this comparison; normal lists and full reading come first.

## Comparison tasks

Find Capture passage; create and correct a passage; add a Thought; retrieve a note and passage; locate an empty collection; reach ownership/review controls; recover from a conflict or uncertain save. Compare successful comprehension, scrolling, route cost and recovery rather than thumbnail attractiveness.

## Verification and handoff

Both projects contain the 21 planned baseline screen/state designs plus separate reader-facing saving, definite-failure, and uncertain-outcome states. Final count is 23 active design states in each project. Option A also retains one obsolete combined diagnostic gallery on its canvas; it is not part of the current proposal and Stitch did not expose a supported way to remove or rename it. The current A20 and B20 previews are the simple uncertain-save states; A22/B22 show an in-progress save, and A23/B23 show a definite failure.

Actual saved revisions were inspected through individual previews and rendered iframe text, not solely model summaries. Final Book Details previews A01 and B01 show the sample-book disclosure and readable direct Capture passage/Add note actions; A22’s preview shows an indeterminate Saving passage state with the duplicate-submit action disabled. B20’s uncertain-save preview was separately verified after replacing its diagnostic dashboard. Earlier iframe views could show stale revisions until the project was refreshed. Initial generated claims about accuracy, privacy, cache durability, archival preservation, invented metadata/progress and developer diagnostics were explicitly corrected. This is a design review packet, not implementation acceptance.

Static screens cannot establish native OCR, TalkBack, touch targets, contrast measurements, large-text behavior, animation performance, backend save safety or database acceptance. No database/Storage/migration mutation is authorized by this design work.

### Individual Book Details evidence

- [A Book Details preview](https://stitch.withgoogle.com/preview/15742741459056702532?node-id=095eb8c8df394de38383571390d64d7f), [screenshot](./design-review-20261007/option-ab/option-a-book-details.jpg).
- [B Book Details preview](https://stitch.withgoogle.com/preview/12974171775283639004?node-id=a3f419885fa54df985300d6a8b5a3f2f), [screenshot](./design-review-20261007/option-ab/option-b-book-details.jpg).
- [A Saving passage preview](https://stitch.withgoogle.com/preview/15742741459056702532?node-id=a1aae49283f645349a2d0175463bb559), [screenshot](./design-review-20261007/option-ab/option-a-saving-state.jpg).
- The previews retain each project's visual treatment within shared palette/type constraints; hero layout differs. They are comparative proposals, not a controlled usability-test result.

### Prototype limitations

Stitch reported cross-artboard hotspots are not natively connected in these outputs. Existing HTML links/history actions and local controls do not prove working route transitions. Both projects are collections of designed screens; connected flow, back-position restoration and interaction acceptance remain unverified. Multi-state recovery artboards also require checking how individual variants are presented before implementation. The narrow/large-text design is an illustration, not an executed native accessibility check.

## Next review

Owner compares the Book Details placement and retrieval structure using the tasks above, selects A/B or a specific hybrid, and resolves proposed replacement/insertion/uncertain-save/removal boundaries. Application implementation, Question storage enablement, native OCR acceptance, durable U3 recovery and swipe review remain separate gates. No structure is approved solely by generation.
