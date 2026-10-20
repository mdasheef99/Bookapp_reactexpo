# Option B screen-by-screen review — 2026-10-09

## Current outcome and authority

This is the owner-authorized screen correction pass, superseding earlier completion claims. Scope begins after opening a book. Existing Option B Stitch targets and four owning documents are the only edited artifacts. Shelf/global navigation, cloud OCR, standalone passage creation, application code, dependencies, migrations and database/storage changes remain outside this task.

The design remains a review candidate. Interscreen routes are unlinked; a coherent route contract is not proof of an executable prototype or Android behavior. Category names are approved; numbering, dirty-exit policy and storage support remain decisions/gates.

Project: [Option B](https://stitch.withgoogle.com/projects/12974171775283639004). Exact node IDs: [navigation contract](./OPTION-B-NAVIGATION-CONTRACT.md). Current index: `1d460d8d09844e6c98ac1e493c2ad938`.

## Acceptance ledger

| Screen | Review and correction | Evidence / remaining limit |
|---|---|---|
| B01 Book Details | Plain Back to Library; personal Thought preview without quote marks or TH1; management initially collapsed. | Readback/visual; management expand/collapse exercised in static preview. |
| B02 Notes collection | Removed TH1; named saved-card entry; five category filters plus All; duplicated author/title line corrected. | Visual/readback; filter execution not established by canvas clicks. |
| B03 Empty Notes | Selected book, No notes yet, one Add note; distinct from load failure. | Verified unchanged, actual 390 × 652. |
| B04 Category and input | Five real radio choices initially unselected, Skip category, then Write note/Scan text. Plain category descriptions. | Readback/visual at 390 × 844. Branch links are internal placeholders, not wired screens. |
| B05 Manual editor | Blank text, No category selected with five other radios, optional page, disabled empty Save note. Removed engineering footer; restored Cancel after generation accidentally removed it. | Readback/visual; keyboard/device behavior untested. |
| B06 Camera/photo | Back/Cancel, book/category, Capture page/Choose photo, camera fallback; extra Replace image removed. | Caught actual 390 × 780 footer clipping and corrected spacing. Fallback now fully visible. Requested 844 height is not an independently verified actual bound. |
| B07 OCR review | Editable recognized text, six real radios with Thought selected, optional page, Save note/Scan again, Back/Cancel. Removed engineering copy; rescan dismissal Keep editing. | Actual 390 × 844, radio checked states read back. Conditional rescan exists; snapshot preservation remains runtime gate. |
| B08 Saved reader | Removed provisional identifier and unsupported bookmark; category/page/book/personal text, Edit note, proposed Copy note text, Back to Notes retained. | Visually checked at actual 390 × 884. Copy absent from inspected app source; proposal only. |
| B09 Saved edit | Removed TH1; No category label; six radios, Back/Cancel, editable saved text, optional page, Save changes. | Actual 390 × 844; readback/visual. Persisted-record preservation untested. |
| B10 Load failure | Explicit failure, selected book, Retry and Back to Book details. | Verified unchanged at 390 × 884; does not impersonate empty collection. |
| B11 Save failure | Two rendered contextual examples in same sheet: Add note and Edit note. Matching failure messages, retained text/category/page, Retry/Keep editing, Back/Cancel. Engineering outside phone panels. | Readback/visual, actual 390 × 1934. Definite failure only; uncertain outcome must reconcile first. Both field labels Note text verified in refreshed readback. |
| B12 Unsaved exit | Two vertically stacked proposed dialogs: Discard this note?/Discard note vs Discard changes?/Discard changes. Keep editing in both. Policy pending outside phones. | Readback/visual, actual 390 × 1880. Underlying Save note/Save changes labels verified after refresh. Policy remains owner decision. |
| B13 No recognized text | First-scan and replacement-scan rendered inside same sheet. Replacement omits blank-editor/options exits and has Back to review preserving previous snapshot. | Readback/visual, actual 390 × 1812. Try again contract uses retained crop; availability/device execution untested. |
| B14 Incomplete text | Both actions return to editable review; neither saves. Removed duplicate underlying controls. Generation removed warning title instead of fitting it; title restored in targeted follow-up. | Latest visual shows Some text may be missing plus explanation, sample and both actions. Warning title was visibly restored in final screenshot; layout is compact rather than a full-height phone. |
| B15 Crop | Back/Cancel, source image/crop handles, Rotate/Reset crop/Choose another photo/Recognize text. Removed engineering paragraph and decorative eyebrow; guidance refers to selected text. | Readback/visual at actual 390 × 844. Crop gestures and actual recognition input untested. |
| B16 Processing error | Distinct technical failure; first/replacement cases in same sheet. Capture another photo replaces unverified same-image Retry; replacement Back to review preserves prior text. | Visual at actual 390 × 1895; readable 44% screenshot confirms Capture another photo, Choose another photo and Back to review in replacement. Detailed accessible text was not exposed reliably for this frame; native accessibility remains a gate. |
| Index | Register updated for rendered contextual sheets and category controls. Numbering examples kept as proposal outside phones. Exact return rules and remaining numbering contradictions targeted in final pass. | Rendered content of retained corrected index read back, including numbering proposal and explicit return table; static/unlinked disclaimer remains. Index node changed during duplicate cleanup. |

## Flow and state contract

Manual: selected book → Add note → category or Skip → Write note → blank editor → explicit successful Save note → saved reader.

OCR: selected book → Add note → category or Skip → Scan text → camera/photo → crop/rotate/reset → recognize selected crop → editable text → edit if needed or explicit Save note → saved reader.

OCR never silently chooses Quote or creates a standalone passage. Category is changeable before saving. Page is optional. No numeric limit is shown in this design; omission does not change existing implementation constraints.

Keep creation origin separate from previous step. Back steps through the journey; Cancel exits to the creation origin subject to pending dirty-exit policy. Replacement OCR keeps the whole prior review snapshot until success; cancellation/failure returns it. Picker dismissal is not a new capture. Saved edits preserve the stored record on failure. Save success must be confirmed before opening the saved reader; uncertain outcomes must reconcile before retry.

The [current route tables](./OPTION-B-NAVIGATION-CONTRACT.md) govern exact actions. Historical route tables there are superseded.

## Open gates, not missing implementation approval

- Owner decision on dirty exits/B12; static wording does not approve deletion behavior.
- Desired numbering remains a feature proposal: prefix/scope/no-category/reassignment/deletion/reuse/concurrency/idempotency unresolved. Current reader designs omit provisional IDs.
- Local `NoteTag` supports quote/reflect/distill/apply; Question support and sequences require storage/API audit. No live schema audit performed here.
- Copy note text is proposed; inspected source lacks implementation.
- Working prototype must test all interscreen routes, filtered-empty state, list restoration, validation, pending/repeated save taps, uncertain-save reconciliation, loading/progress/cancel and late-result suppression.
- Android must verify camera permission/picker cancellation, crop/rotation/reset, OCR source scope, replacement preservation, incomplete acknowledgement, keyboard/safe areas, large text, contrast/hit areas and TalkBack. Static pictures prove none of these behaviors.
- No durable drafts, version history, autosave, photo-upload/deletion or recognition-engine claims were approved by this task.

## Verification and closeout

Rendered accessibility readback and canvas screenshots are the design evidence. Generation summaries and requested CSS dimensions are not accepted as sole proof. Gallery sheets contain two mutually exclusive runtime examples; they are not extra numbered screens or pages to show sequentially in the app.

Inventory target is 16 original B01–B16 nodes plus one current index. Stitch unexpectedly generated two unnamed index copies despite in-place instructions. Corrected content was verified on node 1d460d8d09844e6c98ac1e493c2ad938 and that frame was named as the current index. Superseded index 479a85266b434f3c87116dd466de6bc1 and redundant generated copy b964b71fedb54d4cb0a657d36b2eee69 were removed through targeted context-menu Delete with canvas Undo available. An initial deletion targeted the retained copy; it was immediately undone and exact node restoration verified before targeted cleanup. Final DOM inventory confirms all original 16 product IDs plus exactly one corrected index; no product frame removed. Same-node content/heights changed. Separate exported screenshots were not generated in this pass.

Final inventory: 17 nodes, original B01–B16 plus corrected index. Documentation validation results are recorded below. No app tests were run because no app implementation was changed. No stage, commit, push, deployment, migration application or database/storage mutation occurred.



Final next action: owner reviews this static candidate and resolves B12/numbering policy; connected prototype/application work needs separate authorization. Marketplace Phase9 continuity validator passed (195 definitions, zero duplicate/missing requirements, 76 Markdown files). First diff check caught trailing EOF whitespace introduced in TRACKER; corrected before final rerun.
Final verification: git diff --check PASS after EOF correction; all four owning documents have zero trailing-whitespace lines. Post-cleanup browser reload confirms exactly 17 saved nodes: all 16 original product IDs plus corrected index 1d460d8d09844e6c98ac1e493c2ad938. Changes remain uncommitted; unrelated worktree changes preserved.
