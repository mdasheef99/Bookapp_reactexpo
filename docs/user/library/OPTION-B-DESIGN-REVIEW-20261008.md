# Option B: critical design review

Date: 2026-10-08. Scope: after opening a book; shelves and book entry excluded.
Reviewer: primary agent, fresh critical pass; no independent subagent was spawned.

## Verdict

Keep the notes-first structure. Do not approve the whole set as implementation-ready yet. The board has the intended 14 screens plus index, but inventory completeness is not workflow completeness. A targeted refinement is needed; another complete redesign is not justified.

Retain book-context creation, optional category before composition, Write/Scan branches, editable OCR, optional page reference, explicit saving, separate read/edit modes and distinct empty/error states. Cloud OCR and standalone passages remain deferred. Five approved categories remain fixed.

## Evidence and limits

Fresh rendered DOM readback inspected all 15 titles and screen content. Offscreen artboards lazy-load; panning loaded B08/B09/B13/B14 and index content. B04 was visually inspected at focused scale: its 390 × 1349 frame puts input choices after five vertically stacked category choices and substantial supporting copy. Screens remain static; no routes, native camera/OCR, save transactions, TalkBack, contrast measurements or large-text behavior were tested. Current source still exposes a combined NoteEditor and closes through closeEditor; this review does not establish implementation parity.

Current screen lookup: [navigation contract](./OPTION-B-NAVIGATION-CONTRACT.md). Previous cleanup evidence is distinct from this usability review. No board changes were made during this review; panning/selection only.

## Prioritized findings

| Priority | Evidence / affected screens | Reader consequence | Recommended correction | Confidence / effort |
|---|---|---|---|---|
| High | Index says Back/Cancel returns to the exact caller “Book Details or Notes”; B07 has Back, Cancel and Scan again; B09 has Back/Cancel. Contract does not enumerate every return. | A reader or implementer cannot infer whether Back steps through capture, returns to options, exits creation, or discards edits. | Define each Back, Cancel, hardware Back, modal dismissal and successful-save return explicitly. Preserve creation origin separately from previous step. | High, small design/spec effort. |
| High | B12 shows an old Add note background with header Save and uses Discard note; B11 always shows Add note although it covers creation, OCR and saved editing. | Editing a saved note could look like deleting the saved note; recovery can return to the wrong editor. | Use contextual overlays on the originating editor. Distinguish Discard unsaved note from Discard changes, explicitly preserving the saved record when editing. Keep behavior pending approval. | High, small–medium. |
| High | Edited-rescan warning exists, but cancellation/failure preservation is undecided. Uncertain save is mentioned only as a gate in index. | Corrected text can be lost, or retry can duplicate a note after a timeout. | Recommend retaining the previous text until a successful replacement scan is accepted. Specify save-result reconciliation before retry. These are proposals, not approved product behavior. | High, medium implementation dependency. |
| Medium | B04 frame is 1349px high; input methods follow five stacked category rows and verbose cards. | The two central creation choices may require scrolling before the reader even starts writing or scanning. | Compact optional category selection and shorten copy so Write note and Scan text are discoverable together on a representative phone. Verify at normal size and large text. Do not drop approved categories. | High, small. |
| Medium | B05 says Reflection, B09 says Marginalia reflection / Reflective entry; B03 includes Chapter IV; other screens say Literary Parlor, Active Marginalia and “specific leaf.” | Quote, Action and Question feel treated as reflections; unsupported source metadata and vocabulary obscure the reader's task. | Use neutral Note / Note text, plain Page number helper and title/author context. Show chapter only when actual source data supports it. Keep the visual warmth without decorative interface terminology. | High, small. |
| Medium | B02 contains a tune icon; B08 contains bookmark iconography; B06 has a light-assistance control. Their behavior is not defined by the contract. | Visual controls can imply features or preferences absent from the implementation scope. | Specify supported action/state/label for each interactive control, or remove it. Do not infer favoriting or flash support from an icon. | Medium, small. |
| Medium | B06 includes normal intake and camera-unavailable treatment; B07 is success review. General recognition failure, processing/cancellation and picker dismissal lack explicit transition treatment. | Readers can be left unsure whether scanning is still running or what is retained after abandoning input. | Define inline processing and technical-error states, cancel behavior and permission recovery. Reuse existing frames; separate full-screen artboards are unnecessary unless layout differs substantially. | High for missing specification; medium implementation dependency. |
| Medium | B01 shows status, ownership, condition, lending availability, review stars and removal. Fourteen-frame set mainly covers notes. | The entire after-book-entry experience is not specified just because the note journey is represented. | Inventory every retained B01 control and its existing behavior. Define inline management editing, mutation feedback and removal confirmation/impact before implementing B01. Preserve existing authorized behavior; do not invent lending or review rules. | High, medium audit/spec effort. |

## Screen-by-screen assessment

| Target | Keep | Remaining review/refinement |
|---|---|---|
| B01 Book Details | Book context, Add note, Notes; secondary management grouping. | Management actions and destructive removal need behavioral mapping; confirm collapsed default and real metadata. |
| B02 Notes collection | Read-mode card entry, Add note, category filtering concept. | Define tune action; filtered empty state and selected-filter semantics; restore filter/scroll after returning. Zero-count filters may be muted or omitted without changing categories. |
| B03 Empty Notes | One Add note action and distinct valid-empty state. | Remove unsupported Chapter IV and decorative context labels; keep loading/error distinct. |
| B04 Category/input | Five approved options, optional Skip, Write and Scan. | Compact layout; show no preselection; clarify whether input can be chosen directly without tapping Skip. |
| B05 Manual editor | Blank text, carried category, optional page, explicit Save. | Neutral text label; define blank/whitespace validation, pending-save behavior, keyboard and Back/Cancel. |
| B06 Scan | Capture, Choose photo, manual fallback. | Separate conditional fallback from active viewfinder; define picker/camera cancel, processing/error and light control. |
| B07 OCR review | Editable text, optional page, carried category, rescan guard. | Explicit return routes, edited-text preservation, pending-save handling; avoid repeatedly labeling output a passage. |
| B08 Read note | Read then Edit, Copy, return to Notes. | Specify bookmark control or omit; copied feedback conditional on success; no-category/no-page and long-note layouts. |
| B09 Edit note | Saved content, category change/None, Save changes. | Neutral labels; validation, failure and dirty-exit preserve original record. None requires storage verification later. |
| B10 Load error | Retry; never pretend a failed fetch is an empty collection. | Avoid implying every failure is offline; pending/repeated Retry and successful return need specification. |
| B11 Save failure | Retained current text, one Retry, Keep editing. | Contextual create/edit/OCR heading; definite-failure only; recover normal Save action when editing resumes. |
| B12 Unsaved exit | Clear pending marker; Keep editing concept. | Match current editor, contextual discard label and exact destination; hardware Back/backdrop accessibility. Requires product decision. |
| B13 No text | Useful ordered recovery choices with carried category/book. | Define preservation after a failed rescan and clean return destinations; not a substitute for technical OCR failure. |
| B14 Incomplete text | Warn honestly; acceptance returns to editing, never autosaves. | Specify acknowledgement reset after another scan and save gating; focus/large-text dialog needs prototype. |
| Index | Exact IDs, deferred boundaries and major branches. | Replace blanket Back/Cancel rule with explicit routes; add contextual recovery and transient-state references. |

## Proposed navigation clarification for the next revision

This table is a recommendation for owner review, not a change to approved behavior.

| State | Recommended return |
|---|---|
| B04 Back | Original entry: B01 or Notes collection. |
| B05 clean Back | B04 with choice retained; Cancel exits to original entry. Dirty exit follows approved guard. |
| B06 Back / picker dismissal | B04 for initial intake; return to previous B07 with text intact for an abandoned rescan. |
| B07 Back | Define deliberately; recommended return to capture while retaining current text. Cancel exits creation only after appropriate dirty-state handling. |
| B08 Back | Existing-note entry returns to its filtered/scrolled collection; newly saved note goes to updated Notes. |
| B09 Back / Cancel | B08; if dirty, proposed Discard changes restores the unchanged saved note. |
| Recovery overlay dismissal | Originating screen with its exact text/category/page/context intact. |

## Approval and implementation gates

1. Retain the structural direction; refine chooser density and plain language.
2. Resolve return semantics, contextual discard, rescan preservation and uncertain-save handling.
3. Update existing frames/index in place; no new historical variants. Represent transient states inline.
4. Check all retained Book Details controls against current source. Notes scope cannot silently erase management behavior.
5. Build a connected prototype to test manual creation, scan correction, canceled rescan, edit discard and save failure. Check long text, omitted metadata, large fonts and screen-reader focus. Static screenshots cannot pass these gates.
6. Obtain design approval and a separately bounded implementation authorization. No schema/migration authority follows from that approval.

Next exact scoped unit: `library_option_b_targeted_design_corrections`. The immediate next step is owner assessment of this review and recommended behaviors, then an in-place refinement under the existing design scope. Do not begin application implementation.

Verification: live board DOM/content and B04 visual inspection; read-only source checks. No app/device tests, database/storage mutations, migrations, Git publication or deployment. Documentation remains uncommitted.
