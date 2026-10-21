# Option B notes-first: screen and navigation contract

**Current implementation overlay — 2026-10-10:** SDD-06 revision 0.5 records explicitly authorized local manual implementation. The revision 0.4 behavioral baseline and exact Stitch node inventory remain intact. See [local receipt](./evidence/sdd06-manual-local-2026-10-10/README.md) for actual source/tests and pending persistence/native gates. Historical documentation-only/prototype-first statements below do not override the owner's subsequent implementation instruction; migration application/test writes remain separately unauthorized. No browser/Stitch changes.

**Earlier documentation authority — 2026-10-09:** [SDD-06 revision 0.4](./SDD-06-after-book-entry-ui.md) governs behavior and page/state contracts. The six bounded decisions and four clarifications are recorded for planning. Stitch and this file are reference/history only. Current authorization is documentation only; implementation belongs to a new explicitly instructed session. Older policy/prototype-first statements below are superseded. Technical gates and later numbering/OCR release-scope decisions remain explicit.

**Historical canvas reconciliation status (2026-10-09):** The screen-by-screen correction pass supersedes earlier completion claims. B01–B16 remain the same exact nodes plus one index. B11 now renders both contextual save failures in one 390 × 1934 sheet; B12 renders both proposed exit dialogs in one 390 × 1880 sheet. B13 and B16 now render initial/replacement cases within their existing sheets. B04/B05/B07/B09 expose actual category radios; B05 is blank and B07 editable. B01/B02/B08/B09 omit provisional numbering while the numbering feature policy remains unresolved. B05/B07/B15 engineering copy is removed. See the current review acceptance ledger for actual verification and pending items. The board is static, interscreen routes remain unlinked, and dimensions/control sizes must not be inferred from generation claims. No application implementation or database mutation is authorized.

**Scope:** begins with one book already open on Book Details. Shelf, Library list, QuickLook, search, global navigation, and the act of opening a book are out of scope. The contract is about what happens inside that selected book.

**2026-10-09 review overlay:** [Current review](./OPTION-B-REVIEW-20261009.md) records the controlled refinements and evidence limits. The route table below is the current document authority; the Stitch index is a visual summary and does not prove routes work. B12, no-category numbering, reassignment policy, persistence support and native interaction behavior remain explicitly unresolved.

**Stitch project:** [BookConnect Option B Collection Prototype](https://stitch.withgoogle.com/projects/12974171775283639004). Use the numbered screen IDs and exact titles below, not historical group descriptions. Current flow/index: `B Notes-first v3 — Current flow and screen index`, node `1d460d8d09844e6c98ac1e493c2ad938`. Current screen IDs were read from rendered canvas DOM; screen-specific preview URLs have not been independently opened. No sharing permission was changed.

**Review overlay (2026-10-08):** The cleanup verification establishes inventory, not implementation readiness. See [the critical all-screen review](./OPTION-B-DESIGN-REVIEW-20261008.md): structure retained; targeted navigation/recovery, layout/copy and Book Details management specifications remain. Proposed behaviors there require owner assessment.

**Current stepwise design authority (2026-10-09):** Follow [OPTION-B-IMPLEMENTATION-PLAN.md](./OPTION-B-IMPLEMENTATION-PLAN.md) for the ordered design review and later implementation sequence. Categories remain optional with No category/Skip, appear before input, and can be changed in unsaved B05/B07 composition. Page is optional. B05 opens blank; B07 contains recognized text only after recognition. B15 crop and B16 technical error are present. Any behavior not verified in the rendered screen or current code is marked proposed, unresolved, or a later prototype/storage gate.

## Implementation SDD handoff

See [SDD-06](./SDD-06-after-book-entry-ui.md) for the current owner-requested page-by-page implementation proposal. B IDs describe states, not sixteen separate routes. UI architecture, shared session and save coordinator, crop mapping, and acceptance checks are proposals for review; current route tables remain design evidence. SDD-06 explicitly separates hardware step-Back from session dismissal and recommends snapshot-safe typed-to-scan switching. These proposals do not turn pending B12/storage decisions into approved behavior.

**Revision 0.2 precedence:** SDD-06's decision ledger, transition/exit table and connected-prototype plan supersede executable recommendations below where they conflict. In particular replacement scanning restores B05/B07/B09 according to origin, rather than always B07; later editors use compact category Change controls; recovery is prioritized; uncertain saving has bounded status/leave behavior; create/edit saves have separate stack rules. B01 preserves explicit management and existing Saved Pages access. The exact node inventory below remains the retained mapping. The artwork has not been changed or re-inspected in this documentation revision, so older rendered controls and route tables are evidence of the previous static candidate, not proof that revision 0.2 is visually implemented.

## Design intent and fixed boundaries

- Option B is the current working direction: notes are organized in the context of the selected book. The refined candidate is not yet approved for implementation.
- The approved note categories are Quote, Thought, Takeaway, Action, and Question. Category is optional. Keep Quote distinct from a saved passage. Question writes remain gated by the app's storage support.
- Category is offered before composition and remains visible/changeable in unsaved B05/B07 until save. Skip remains available under the earlier optional-category decision. B09 category-change numbering behavior remains subject to the numbering gate.
- The two note-creation methods are **Write note** and **Scan text**. OCR in this flow supplies editable text to the note; it does not create a standalone passage.
- Page number is optional. Do not add word or character limits to these designs.
- On-device OCR is intended, but the engine/platform have not been verified for this design. Cloud OCR is deferred. Do not claim where processing runs, whether a photo is uploaded, or when it is deleted.
- Nothing is saved until the reader explicitly chooses **Save note**. Do not promise autosave or durable draft recovery.
- These are static design targets. The board says “Review candidate — approval pending; static artboards; routes unlinked.”

## Stable screen IDs

IDs in this document are navigation-contract IDs, not Stitch node IDs. Match them to the exact titles below; keep them stable when screen visuals are refined.

| ID | Exact visible Stitch frame title | Observed canvas node ID | Role |
|---|---|---|---|
| B01 | `B01 — Book Details` | `2fc52a1432ff451da1c32f96c04eecaf` | Selected-book starting point; Add note and Notes. |
| B02 | `B02 — Notes collection` | `d78ac2f45d3d4ca5bf4aeccd80bfd3a1` | Populated collection. |
| B03 | `B03 — Empty Notes` | `3985b81b98ae4f73bac8137d147797d0` | Valid empty collection. |
| B04 | `B04 — Choose category and input` | `25e53a73729d4076a30641186ee6a63e` | Optional category, then Write note / Scan text. |
| B05 | `B05 — Manual Add note editor` | `085fb7c64e814f9180062adf6012fccf` | Blank manual editor. |
| B06 | `B06 — Scan a page` | `5235e0d51b1d4385b6ae52c5621e2462` | Camera/photo intake and camera-unavailable fallback. |
| B07 | `B07 — Review recognized text` | `7f614be3758e47e3b50da731603c8cac` | Editable OCR result and edited-rescan confirmation. |
| B08 | `B08 — Read note` | `d8a0171a6278455f9638791f2cbe0943` | Saved-note reader. |
| B09 | `B09 — Edit note` | `1b9dc93a6471459e9f0a7b8d60b0d948` | Saved-note editing. |
| B10 | `B10 — Notes load error` | `47ac102d74ff4c64b51178c3e735ab13` | Retrieval failure, distinct from empty. |
| B11 | `B11 — Definite note-save failure` | `0a4214cc911a4ac884c07469645605ba` | Known save failure; retain current text. |
| B12 | `B12 — Unsaved exit — DECISION PENDING` | `4d08612fdc7a45ab9d7b45aa552197a7` | Proposed dirty-exit guard; **not approved behavior**. |
| B13 | `B13 — No text recognized` | `3ce3336dd3b64188bac9ae56b66d0427` | No-text recovery choices. |
| B14 | `B14 — Confirm incomplete text` | `d58dfe2af7e645408c6086cc2444cbf1` | Incomplete OCR confirmation over B07. |
| B15 | `B15 — Crop page` | `0f041e36ca6445f3986c0717bafe303e` | Adjust/rotate/reset image framing; OCR uses selected crop only. |
| B16 | `B16 — OCR processing error` | `f3678db6b38d40d3b3bcca85ef222ac7` | Recoverable technical processing failure; no text produced or saved. |

## Current reconciled route contract — 2026-10-09

This section records the earlier reconciled static-design contract and supersedes the older historical tables below. SDD-06 revision 0.2 now owns proposed executable transitions where they differ. Keep creationOrigin separate from previousStep and scan return context; the earlier B07-only replacement assumptions below must not be copied into implementation. Proposed rows are not approved behavior.

### Core approved paths

| From / action | Destination | State carried |
|---|---|---|
| B01 Add note | B04 | Selected book; origin B01. |
| B01 Notes | B02 populated, B03 empty, B10 load failure | Selected book; never map a failed load to empty. |
| B02/B03 Add note | B04 | Book and origin; preserve B02 filter/list position. |
| B02 open note | B08 | Saved record identity and collection context. |
| B04 choose one category or Skip | Stay B04 | Optional category; no default selection. |
| B04 Write note | B05 | Blank editor; book and selected category/No category. Category remains visible and changeable before save. |
| B04 Scan text | B06 | Book, category/No category and creation origin. |
| B05 explicit Save succeeds | B08 | Saved content, category/No category, optional page and book; show identifier only after success. |
| B06 capture/photo selected | B15 | Source image, book/category, and explicit initial-versus-replacement origin. Picker cancellation is not a capture. |
| B15 Recognize text | B07 success; B13 no text; B14 incomplete overlay; B16 technical failure | Use selected crop. None of these outcomes autosaves. |
| B07 explicit Save succeeds | B08 | Editable OCR text, category/No category, optional page and book. A confirmed save is required. |
| B08 Edit | B09 | Saved record identity and original persisted version. |
| B09 Save changes succeeds | B08 | Updated saved record; numbering change rules remain gated. |
| B10 Retry | B02 populated or B03 empty; stay B10 on failure | Re-evaluate data and preserve book/origin. |

### Action, return and recovery rules

| Source/action | Destination and retained state | Status |
|---|---|---|
| B04 Back/Cancel | Return to exact creation origin with book and collection context. | Proposed; verify distinct Back/Cancel behavior. |
| B05 in-app Back | B04; keep current text/category/page in the active in-session flow if returning is supported. | Proposed; do not imply durable draft recovery. |
| B05 Cancel / hardware Back / gesture / backdrop dismissal | Clean editor may return to its exact creation origin. Dirty editor requires the B12 decision; until resolved, do not discard. | B12 policy pending; event behaviors remain separate. |
| B05 blank/invalid save | Stay B05 with field feedback; create no empty record. | Required; copy/layout to specify. |
| B05/B07/B09 save pending or repeated tap | Stay on source screen, show pending feedback, suppress duplicate submission. | Required safety behavior; visual state to specify. |
| B05/B07/B09 definite failure | B11 distinguishes a failed new note/OCR save from a failed saved-note edit. Keep the active text/category/page in the current session; the saved record remains unchanged for an edit failure. | Both contexts are rendered and read back in the same reference sheet; runtime states remain mutually exclusive and untested. |
| B05/B07/B09 uncertain result | Stay in originating editor and reconcile persisted state before any retry; never call a timeout a definite failure. | Required safety rule; persistence support unverified. |
| B06 camera permission denied/unavailable | Stay B06; offer photo choice and Write note. Keep book/category and any B07 replacement snapshot. Do not say capture succeeded. | Required fallback; exact platform behavior requires prototype/device test. |
| B06 photo picker dismissed | Initial capture stays B06; replacement capture returns to B07. Preserve book/category and the prior B07 snapshot. | Proposed; distinct from selecting a photo. |
| B06 in-app Back | Initial capture returns B04; replacement returns B07 with previous text/category/page. | Proposed; runtime verification pending. |
| B06 Cancel / device dismissal | Initial capture returns exact creation origin; replacement returns B07 with previous text/category/page. | Proposed; preserve session values and apply pending dirty-exit policy where relevant. |
| B15 Rotate | Stay B15; update orientation and preserve the user's crop intent. | Required action; interaction/large-text behavior needs prototype. |
| B15 Reset crop | Stay B15; restore full framing of the current source image. | Required action. |
| B15 crop in-app Back | Initial capture returns B06; replacement returns B07 with prior text/category/page. | Proposed; never discard prior B07 snapshot. |
| B15 Cancel / device dismissal | Initial capture returns exact creation origin; replacement returns B07 with prior text/category/page. | Proposed; distinct from stepping Back and subject to pending dirty-exit policy where relevant. |
| B15 Choose another photo; selection succeeds | Stay B15 with the new source and explicit crop framing; recognize only that current crop. | Required action. |
| B15 photo picker dismissed | Stay B15 with current image/crop. | Proposed. |
| B15 Recognize pending / Cancel | Show inline progress and a safe Cancel. On Cancel, remain B15; ignore a late result. Preserve replacement snapshot. | Required behavior; static artboard does not prove the transient state. |
| B07 Back | Return B15 while retaining the editable review snapshot. | Proposed; prototype check. |
| B07 dirty Cancel/device Back/backdrop | B12 only if approved; otherwise remain B07. | B12 pending. |
| B07 Scan again without edits | Start replacement intake at B06 and retain a full B07 snapshot: text, category and optional page. | Required. |
| B07 Scan again after edits | Ask before replacement. Keep editing closes the prompt; Scan again starts B06 while retaining a full snapshot. Cancel/failure restores it. | Required; current B07 concept includes a conditional prompt; native path untested. |
| B14 Keep editing / Use incomplete text | Return B07; both remain editable and do not save. Reset acknowledgement when text/result changes. | Required. |
| B13 initial-scan Try again | B15 with retained image/crop for adjustment; preserve book/category. If unavailable, offer another photo. | Proposed; source retention and route execution need prototype proof. |
| B13 replacement-scan Try again | B15 with retained crop; preserve entire previous B07 snapshot. If unavailable, offer another photo. | Rendered replacement case; route execution remains untested. |
| B13 Choose another photo | On selection, B15 with book/category and origin. If canceled, return to B13; preserve any B07 snapshot. | Proposed. |
| B13 Write note instead | Initial scan → B05 with book/category. In replacement context, hide this action because a prior B07 review exists; return through **Back to review** instead. | Required context distinction; replacement variant is rendered within the same sheet; runtime behavior untested. |
| B13 final return action | Initial scan: **Back to note options** → B04. Replacement scan: **Back to review** → prior B07 snapshot. | Required context distinction; both contextual labels are rendered; routing remains untested. |
| B13 Back to crop | Return to B15 with the same image/crop if it is still available; preserve book/category and any prior B07 snapshot. If the source image is unavailable, remain in B13 and offer Choose another photo. | Current screen exposes this action; image retention is unverified, so the return is proposed. |
| B16 initial-scan Capture another photo | B06 fresh capture; preserve book/category. | Rendered; no unverified same-image retry offered. |
| B16 replacement-scan Capture another photo | B06 fresh capture while preserving prior B07 snapshot. | Rendered; runtime behavior untested. |
| B16 Choose another photo | On selection, B15 with book/category and origin; if canceled remain B16. Preserve the B07 snapshot during replacement. | Proposed. |
| B16 Write note instead | Initial scan → B05 with book/category. In replacement context, hide this action because a prior B07 review exists; return through **Back to review** instead. | Required context distinction; replacement variant is rendered within the same sheet; runtime behavior untested. |
| B16 final return action | Initial scan: **Back to note options** → B04. Replacement scan: **Back to review** → prior B07. | Required context distinction; both contextual labels are rendered; routing remains untested. |
| B16 top Back | Return to B15 with the same source image/crop only while available; otherwise stay in the error and choose another photo. In replacement context, retain the previous B07 snapshot. | Current screen exposes Back; image retention and route behavior are not runtime-verified. |
| B08 Back | Collection if opened there; B01 if opened from book details. Preserve filter/list position. | Proposed; verify prototype. |
| B08 Copy | If retained, stay B08 and report copy success/failure without changing note. | Design proposal; local source scan found no note-copy implementation. |
| B09 clean Back/Cancel | B08, preserving saved record. | Proposed. |
| B09 dirty Back/Cancel | B12 only if approved; Keep editing returns B09, discard returns B08 with old saved version. | B12 pending. |
| B09 invalid save | Stay B09 with feedback; preserve persisted version. | Required; copy/layout to specify. |
| B11 Retry | Retry only a definite failure from the identified originating editor. Reconcile an uncertain result first. | Required safety behavior; duplicate-safe persistence is not verified. |
| B11 Keep editing | For the rendered new-note state, remain in the active editor and focus the entered text. For a saved-note edit state, return to B09 with unsaved edits while the persisted note remains unchanged. | Both contexts rendered; runtime behavior needs prototype verification. |
| B11 top Back | Treat as an attempt to leave a dirty editor; apply B12 only if the owner approves that guard. Until then, do not silently discard the current text/edits. | B12 policy pending; exact route not approved. |
| B12 Keep editing | Exact originating dirty screen, retaining values. | Proposed; policy pending. |
| B12 discard | New note exits to creation origin; saved edit returns B08 and preserves stored note. Use distinct labels. | Pending product decision; not approved. |

Picker dismissal, screen Back, hardware Back, crop Cancel and recognition Cancel are distinct events. Progress, validation and save reconciliation are inline states unless prototype evidence proves a separate layout is necessary. B13/B16 replacement routes are a context variant of the existing screens, not extra numbered artboards. The current artwork renders both contexts in each sheet; it does not prove runtime routing.

## Validation, collection, copy and retained-control contract — 2026-10-09

These are current design/state rules or explicit gates. Static artboards do not prove runtime behavior.

| State or control | Current rule / evidence | Status |
|---|---|---|
| Blank or whitespace note body | B05/B07/B09 remain in the editor, explain what is missing, and create/update no record. | Required design rule; inline copy/state still needs implementation. |
| Optional page | Blank is allowed. Invalid input is explained inline and is never silently coerced. Do not invent a numeric range before source/product review. | Required design rule; exact validation contract remains to verify against implementation. |
| Save pending / repeated tap | Stay on the originating editor, show truthful pending feedback, and suppress duplicate submissions for the same logical save. | Required; native behavior not tested. |
| Definite save failure | B11 retains the active editor values. New note/OCR copy says nothing was added; saved-edit copy says the stored note is unchanged. One Retry and one Keep editing action. | B11 specification read back in its existing frame; retry only applies to a definite failure. |
| Uncertain save outcome | Reconcile against persisted state before retry; do not label a timeout as a definite failure or promise duplicate-safe retry without idempotency evidence. | No approved separate artboard; persistence/API gate. |
| Category-filtered empty result | Keep the selected filter visible, explain there are no matches in that category, and offer a clear way back to All. | Existing app has a filtered-empty branch in app/(tabs)/library/notes.tsx; UI details remain prototype evidence. |
| Collection order | Current notesService query orders by created_at descending (newest first). B02 retains category tabs and Add note; its unsupported tune/sort control was removed. | Source-backed order; no additional sort control. |
| Copy note | If retained in the approved B08 design, report success/failure inline without changing note identity or text. | Design proposal; local source scan found no note-copy implementation, so do not call it existing app behavior. |
| Bookmark/favorite note | No note-favorite behavior was found in the inspected local source. Do not imply a saved bookmark or favorite unless the B08 action is explicitly approved and implemented. | Remove an unsupported visible affordance or mark it pending; not source-supported. |
| B06 camera light | No flash/torch action was found in the inspected source. The current B06 AX readback exposes Capture page, Choose photo and Write note instead, with no light control. | No light action in current B06 readback. |
| B01 book management | Local Book Details code calls existing status, ownership, condition, lending, rating and remove actions through booksService. | Source-backed controls; not a fresh database/security audit. |
| Question category | Keep it visible as an approved design category; local types currently support four non-null values, so persistence is a separate storage gate. | Design approval does not prove storage support. |
## Historical journey contract — superseded

### Entry and collection

| From | Reader action or condition | To | Required context/behavior |
|---|---|---|---|
| B01 | Tap **Add note** | B04 | Keep the selected book ID/context. |
| B01 | Tap **Notes** | B02 or B03 | Show populated or empty state from the actual result; a load failure goes to B10, never B03. |
| B02 | Tap **Add note** | B04 | Preserve the collection as the return destination. |
| B02 | Tap a note | B08 | Open in reading mode; do not silently enter edit mode. |
| B03 | Tap **Add note** | B04 | Preserve the selected book context. |
| B04 | Back/cancel before choosing an input method | The exact caller (B01, B02, or B03) | Preserve book and collection context. |
| B10 | Tap **Retry** | B02 or B03 | Re-evaluate the result; keep the error distinct from a valid empty result. |
| B10 | Tap **Back** | B01 | Return to the same book. |

### Create and save a note

| From | Reader action or condition | To | Required context/behavior |
|---|---|---|---|
| B04 | Select one approved category, or **Skip category** | Stay on B04 | Category is optional and carried into either input branch. |
| B04 | Tap **Write note** | B05 | Carry the category, or an unobtrusive no-category state. Do not repeat category selection in the editor. |
| B04 | Tap **Scan text** | B06 | Carry the category and selected-book context. |
| B05 | Tap **Save note** and save succeeds | B08 | Save only after this explicit action. Show the saved content, category if chosen, optional page, and book context. |
| B05 | Tap **Save note** and a definite failure is returned | B11 | Keep the editor content available in the current flow; do not claim durable recovery. |
| B05 | Leave while content is dirty | B12 only if the owner approves that guard | The guard and its discard semantics remain unapproved. No assumption of restart recovery. |
| B08 | Tap **Edit** | B09 | Preserve the saved note and source context. |
| B09 | Save changes successfully | B08 | Return to the saved-note reading state. |
| B09 | Save changes fails definitively | B11 | Retain current editor content; distinguish definite failure from an uncertain result. |
| B09 | Leave while content is dirty | B12 only if approved | If approved, **Keep editing** returns to B09; **Discard changes** returns to B08. This destructive choice is not currently approved. |
| B11 | Tap **Keep editing** | The originating editor (B05, B07, or B09) | Retain text and optional page in the current session. |
| B11 | Tap **Retry** | Retry from the originating editor | Use only when failure is known. An uncertain network outcome needs a separate reconciliation/idempotency decision before safe retry is promised. The design should show one clear retry action, not duplicate Retry controls. |

After the first successful save, the collection changes from B03 to B02. Returning from B08 to the collection should land in B02 and preserve a useful list position. The exact Back destination for a note opened from a filtered or scrolled collection should remain the caller, with its filter and scroll context preserved.

### OCR branch and recovery

| From | Reader action or condition | To | Required context/behavior |
|---|---|---|---|
| B06 | Capture a page or choose a photo | B15 | Preserve the selected category and book while preparing the image. |
| B06 | Camera unavailable | Stay on B06 with fallback | Offer **Choose photo** and **Write note instead**; do not block note creation. |
| B15 | Adjust crop/rotation and tap **Recognize text** | B07, B13, B14, or B16 | OCR uses only the selected crop; map outcome to editable text, no text, incomplete text, or technical failure. |
| B15 | Cancel, reset, rotate, or choose another photo | B06/B15 | Reset is explicit; cancellation preserves prior note text/category; replacement image is not treated as saved note content. |
| B13 | **Try again** | B06 | Start another capture attempt. |
| B13 | **Choose another photo** | B06 / photo picker | Return to the OCR intake path. |
| B13 | **Write note instead** | B05 | Carry the category and selected-book context. |
| B13 | **Back to note options** | B04 | Preserve the selected category. |
| B07 | Correct recognized text and tap **Save note**; save succeeds | B08 | OCR output is editable note content. Saving never silently creates a passage. |
| B07 | Tap **Save note** and a definite failure is returned | B11 | Keep the corrected text in the current flow. |
| B07 | Extraction is incomplete | B14 overlay on B07 | Clearly say that some text may be missing. |
| B14 | **Keep editing** | B07 | Dismiss the overlay; leave text editable. |
| B14 | **Use incomplete text** | B07 | Accept the visible partial result only for continued editing. Never save automatically. |
| B07 | Tap **Scan again** with no edits | B06 | Proceed to another scan. |
| B07 | Tap **Scan again** after editing recognized text | Confirmation overlay on B07 | Warn that scanning again replaces the edits. **Keep editing** leaves B07 unchanged; **Scan again** proceeds to B06 after the reader confirms. Confirm whether existing edits survive if the new scan is canceled or fails before implementation. |

## Review checklist and unresolved decisions

Before approving this design for implementation, verify these items against the actual board and then in a working prototype:

1. Confirm exactly the 16 labeled target frames above plus the one current flow/index. Do not use superseded group names or the deleted stale index to locate implementation targets.
2. B01 opens the collection or creation path without leaving the selected book; B02 and B03 are real data states, not unrelated routes.
3. The chooser offers the approved five categories plus Skip before composition. Write note and Scan text remain equally discoverable.
4. Manual and OCR input converge only at explicit Save note, then reach B08; a first save changes B03 to B02.
5. OCR no-text, incomplete-text, edited-rescan, camera-unavailable and definite-save-failure recovery preserve the right text/category/book context.
6. Load error cannot masquerade as empty state. Save-failure UI has one unambiguous retry action.
7. B12 unsaved-exit copy/actions, dirty-state scope, and whether U3 means only immediate exit protection or also restart recovery are still product decisions. Do not treat the artboard as approval.
8. Decide how an uncertain save outcome is reconciled before offering a retry that could duplicate or overwrite a note.
9. Use exact visible frame titles and observed canvas IDs. Capture preview links from Stitch if needed; do not construct unverified links or reuse the old B01 link.
10. Test with a prototype for Back/Cancel, category carryover, list-position restoration, large text, TalkBack/focus order, and interrupted scan/save states. Static artboards cannot establish these behaviors.

## Current stepwise refinement evidence — 2026-10-08

Rendered-DOM/readback verified B01–B16 and the current index. The screen register and implementation handoff in the index agree on the manual path (B01→B04→blank B05→explicit save→B08/B02) and OCR path (B04→B06→B15 crop→B07 editable review→explicit save). B13 (no text recognized) and B16 (technical processing failure) are distinct; B14 accepts incomplete text only back into editable review. The index labels all frames as static design references and marks B12 decision-pending. B05 starts blank; B04 offers five categories plus Skip; category remains changeable in unsaved B05/B07; B15 limits recognition to the crop; saved identifiers are only shown after save. Exact current nodes are in the table above. No app/device behavior was changed or tested, and no database/storage mutation, migration, stage, commit, push, or deployment occurred. Earlier cleanup count and screenshot inventory below are historical evidence and are superseded where they conflict with this current 16-screen readback.

Completed design unit: `library_option_b_stepwise_design_spec`. Exact next action: owner reviews the indexed candidate and resolves B12 plus storage/API gates before separately authorizing the implementation sequence in [OPTION-B-IMPLEMENTATION-PLAN.md](./OPTION-B-IMPLEMENTATION-PLAN.md).

## Historical cleanup evidence — 2026-10-08

The user explicitly authorized removing unwanted designs and preparing a clean implementation reference. Rendered canvas DOM identified 33 nodes before cleanup: 32 artboards and one prototype card. Eighteen obsolete nodes were removed through Stitch's UI, each selection verified against its exact node ID before removal and absence checked afterwards. Stitch displayed Deleted and Undo, confirming its normal recovery action. Fourteen mobile target screens and one flow/index remain. All 14 phone-frame titles were manually renamed and read back; no new frames were created by cleanup. Application source, databases, migrations, and deployments were not changed. The last source assessment still found the earlier combined note/OCR/Vault implementation, not this target flow.

Final rendered-DOM and accessibility readback verified all 15 retained titles and their screen content. The index now lists exactly B01–B14 with no obsolete group lookup instructions; it records direct B01 Add note → B04, Notes → populated/empty/error, caller-preserving returns, and the uncertain-save reconciliation gate. B04 has the five categories, Skip, Write note, Scan text and the exact explicit-save reassurance. B02 no longer assigns a page to the collection header. B09 has category clearing via None and no duplicate inner Cancel. B10/B11 have no unrelated bookmark/profile header controls, and B11 has one Retry. B12 displays DECISION PENDING once within the screen. B05 is blank with carried category and optional page; B07 remains editable; B14 has the corresponding recognized-text background and never saves on acceptance. These checks establish static design content, not runtime behavior or accessibility compliance.

Evidence: [current index screenshot](./evidence/option-b-2026-10-08/current-index.jpg). Frame positions remain unchanged. After the user reported dragging worked, it succeeded intermittently, but overlapping tiny headers caused neighboring frames to move. All placement changes were undone; exact position readback verified restoration for all 15 nodes. The content refinements remain. Use numbered outer titles and the index to locate frames; a compact grid was not achieved. See the [final canvas screenshot](./evidence/option-b-2026-10-08/clean-canvas.jpg) and [rendered inventory](./evidence/option-b-2026-10-08/canvas-inventory.json). No project export/backup was confirmed. Browser inspection, not app/device testing, was performed. No database/storage mutation, staging, commit, push or deployment occurred. Documentation and evidence remain uncommitted.

Completed unit: `library_option_b_clean_canvas_verified_owner_review_pending`. Exact next action: owner reviews the clean indexed candidate and resolves B12/uncertain-save behavior before separately authorizing an implementation unit.

Next-session entry: read this document and the current Library tracker, verify the 15-frame keep set, review pending decisions, and obtain explicit implementation scope. Do not infer database support, runtime wiring, device acceptance, or authority to remove existing code limits from a static design without displayed counters.

## Historical evidence and limitations — superseded by cleanup above

The 2026-10-08 Stitch accessibility readback directly verified the current B03–B07 and B13–B14 content and the updated flow/index. Direct visual checks confirmed B03, B05 and B14 against their indexed roles. The index and candidate remain static artboards marked “Review candidate — approval pending; static artboards; routes unlinked.” The current board says the refined group contains seven screens plus the index, but the 14 IDs are implementation targets, not a verified count of all physical or historical artboards. A full-fit canvas pass found 30 generic `Generating Screen...` artboard labels; selecting all 30 showed six items with useful text, including the current B05 and older Add note/chooser concepts, Edit Note, a previous flow/condition board and a legacy OCR prompt. The other 24 exposed dimensions but no accessible headings or screen text. Thus, a complete physical duplicate count is still unverified; no frames were moved or deleted. Some outer canvas captions still read `Generating Screen...`. Generated summaries are not proof of wiring or runtime behavior. No project sharing was enabled. No app code, database, migration, or runtime behavior was changed or tested by this design unit.

**Refinements already made in the current v3 candidate:**

- B04 now starts with no category selected and offers the approved five categories plus Skip. Both Write note and Scan text are presented; the current copy no longer promises category changes in the unsaved editor.
- B06 has an explicitly conditional “If the camera isn’t available” fallback. Its idle state no longer includes the premature “Page excerpt captured” toast. Do not add processing, upload, privacy, or photo-retention claims.
- B07 now has a non-interactive `Category · Thought` badge, neutral `Scanned text` status, editable result, optional page number, explicit Save note, and a rescan confirmation that is conditional on editing the recognized text. It makes no engine/platform or photo-handling claim.
- B13 now has concise “No text recognized” feedback, preserves the book/category context, and orders its recovery actions as Try again, Choose another photo, Write note instead, and Back to note options.
- B03’s visual check confirms the empty state has the book context, a clear “No notes yet” message, brief supporting copy and one Add note action.
- B05 now presents the carried `Category · Thought` as a non-interactive badge, retains the blank writing area, optional page number and explicit Save note boundary, and removes the decorative quote and “Composing in personal folio” footer.
- B14’s visual check confirms the warning and excerpt preview, the Keep editing / Use incomplete text choices, and the explicit no-autosave explanation.
- The flow/index now labels OCR processing as unverified, marks camera failure as “Camera unavailable,” and records the corrected B07 state rather than describing superseded controls/copy.

Older/historical artboards may still contain the obsolete category controls or OCR/privacy claims. Treat those as historical only; map work to the current v3 targets through the flow/index and verify each frame before editing it. These are direct observations of Stitch design content, not findings about current app behavior.

**Historical board inventory boundary:** the preceding observations describe the board before the authorized cleanup. They are retained only as evidence of why cleanup was needed; they are not the current inventory or lookup instructions.
