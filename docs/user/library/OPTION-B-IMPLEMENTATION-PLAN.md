# Option B: step-by-step design and implementation plan

**Current authority — 2026-10-09:** [SDD-06 revision 0.4](./SDD-06-after-book-entry-ui.md) governs behavior and page/state contracts. The six bounded decisions and four clarifications are recorded for planning. Stitch and this file are reference/history only. Current authorization is documentation only; implementation belongs to a new explicitly instructed session. Older policy/prototype-first statements below are superseded. Technical gates and later numbering/OCR release-scope decisions remain explicit.

Date: 2026-10-09. Authority: user’s latest direction plus previously approved scope.
Scope starts after opening a book. Shelf, book-entry, global navigation, standalone passage saving, and cloud OCR are out of scope.

## Current implementation SDD

[SDD-06 — After-book-entry UI](./SDD-06-after-book-entry-ui.md) is the current page-by-page implementation proposal requested by the owner. It adds source-backed gaps, shared route/session architecture, executable state contracts, acceptance requirements and bounded implementation units. This older stepwise plan remains design history/supporting context; where implementation recommendations differ, review SDD-06 and the explicit decisions before coding. No implementation or database approval is inferred.

**2026-10-09 focused-review reconciliation:** SDD-06 revision 0.2 now owns the decision/provenance ledger, compact category control, exact B05/B07/B09 scan return contexts, capture-work exit protection, bounded uncertain-save proposal, legacy/cloud preservation rules and connected family prototype plan. Its units are SDD06-01–SDD06-07, avoiding the separate OCR U0–U6 roadmap. The next design deliverable is one connected manual journey, then the OCR extension; not another full screen set. The remainder of this file is historical/supporting direction where those recommendations differ. No current artboard correction or implementation is claimed by the document revision.

## Current correction-pass status

The screen-by-screen acceptance ledger in OPTION-B-REVIEW-20261009.md supersedes previous completion claims. Existing B01–B16 were inspected and corrected against the route contract. The retained corrected index is node 1d460d8d09844e6c98ac1e493c2ad938; older index/copy removed after verification. Final inventory is 16 product screens plus one index. Static flow is specified; routes remain unlinked and prototype/device acceptance is pending. Application implementation remains unauthorized. Gallery sheets show mutually exclusive create/edit or initial/replacement cases; they are reference states, not additional sequential app pages. Numbering examples remain proposals outside the reader screens until policy/storage decisions are approved.

## Goal

Provide a clear, connected way to create, categorize, scan, save, read, find, and edit notes for one selected book. A new note starts empty. A saved note displays only after explicit save. OCR text is editable but may be saved immediately when it is correct. Categories remain visible during composition so the note is saved under the selected category.

## Agreed boundaries

- The five approved categories remain **Quote, Thought, Takeaway, Action, Question**. Show them before input and keep category selection available in the composition/review screen. The reader may change the selection until Save note. “Skip category” stays available under the approved optional-category decision. B04 begins with no category assigned; when Skip is chosen, B05/B07 may show the explicit **No category** state.
- A scan fills the new note’s editable text field; it never creates a standalone passage. Scanning must preserve the current category. It must not silently choose Quote.
- Page number is optional. Do not display a numeric word or character limit in this design pass.
- A photo can be captured or chosen, cropped/rotated, and then recognized. OCR uses the selected crop. The reader can reset the crop. Treat the image as temporary; retained note content is text. Do not make unverified engine, upload, or deletion claims in reader-facing copy.
- Cloud OCR is deferred. On-device engine/platform acceptance is a separate technical gate. A design does not prove those capabilities.
- No note number is assigned to an unsaved draft. Number only after a successful save. Numbering is a display identifier, not a replacement for the note’s record ID.
- Question may appear in the design, but saving it requires storage/schema support. Do not silently map it to another category or claim the current database supports it.
- These are design targets. Application implementation, migrations, and database writes require their own explicit scope/authorization.

## Ordered work units

### 1. Lock the record lifecycle and route map

Write down the path and return destination for each entry point before editing screens:

`Book Details → Add note → category or Skip → Write note OR Scan text → compose/review → Save note → Read note → Notes collection`.

Also map entry from an empty or populated Notes collection. Preserve the selected book and the exact Notes filter/list position when returning. Back, Cancel, device Back, modal dismissal, successful save, and failure retry each need an explicit destination. Do not use one blanket “return to caller” rule where it conflicts with stepping back through capture/review.

**Exit check:** every primary action and Back/Cancel action on B01–B16 has one defined destination and preserves the needed book, category, text, page, crop, and list context.

### 2. Make “Add note” a truly blank new-note flow

Keep B04 as the first step after Add note. Make all five category choices and Skip visible before input selection. No category is silently preselected. Then offer Write note and Scan text.

Revise B05 so it opens with an empty note body, not sample or previously saved content. Use the selected category as the initial value and keep a compact category control visible during composition so the reader can change it before saving. When Skip is chosen, show “No category” and permit category selection later in the same unsaved composition. Page remains optional. “Save note” stays the explicit commit action.

Existing saved text belongs in B08 Read note and B09 Edit note. OCR output belongs in B07 only after recognition. Label those screens unmistakably.

**Exit check:** B05 starts empty; category can be changed before save; the category visible at save is the category sent with the new note.

### 3. Add an image crop and rotation step

Extend the OCR branch after camera capture or Choose photo:

`B06 Scan a page → B15 Crop page → Recognize text → B07 Review recognized text`.

B15 presents the chosen image with a movable/resizable crop boundary, Rotate, Reset, Cancel/Back, and a clear Recognize text action. Exclude facing pages, fingers, and surrounding material by cropping to the selected text. OCR input must be the selected crop, not the uncropped original. Preserve the selected book/category. Keep the original capture available temporarily for Reset/recrop during this capture; do not save the photo as a note.

**Exit check:** crop can be adjusted, rotated, reset, canceled, and submitted; the destination review state corresponds to that exact crop. Confirm small-image and orientation behavior in prototype/device tests later.

### 4. Make recognition review optional work, not a forced editing chore

B07 opens with the recognized result in an editable field, the current category selector, optional page, and two clear choices: edit the text, or Save note if it is already correct. Recognition never saves automatically. Category changes before saving remain effective. Save leads to B08 only after confirmed success.

When extraction is incomplete, B14 explains that text may be missing and offers Keep editing / Use incomplete text. Both return to editable B07; neither saves. Scan again after the reader edited text requires confirmation. Keep prior text until a replacement scan succeeds; cancel/failure preserves it. B13 handles no text recognized. Add a distinct recoverable technical processing-failure treatment rather than presenting every error as “no text recognized.”

**Exit check:** recognized text is editable; immediate explicit save is available; edited text/category/page survive every canceled or failed recovery route.

### 5. Package numbering as a decision, not an approved rule

Example labels under consideration are Quote Q1, Thought TH1, Takeaway TK1, Action A1, and Question QS1. These are examples only. The approved boundary is that an unsaved note has no saved identifier. Do not present any prefix, numbering scope, reassignment rule, or reuse rule as settled until the owner decides.

The decision package must leave each item open and state the storage consequence:

| Decision | Options still to assess | Current status |
|---|---|---|
| Scope | Per book, per category within a book, or global | Unresolved |
| No category | No identifier, a neutral sequence, or another explicit treatment | Unresolved; never invent a prefix |
| Category cleared | Retain a stable identifier, retire it, or use another policy | Unresolved |
| Category reassigned | Retain the identifier or allocate a destination identifier and retire the old one | Unresolved |
| Text-only edit | Retain the saved identifier or another rule | Candidate is retain; not owner-approved |
| Delete and reuse | Retire forever, recycle, or recalculate positions | Unresolved |
| Concurrent saves | Atomic sequence allocation and uniqueness behavior | Storage/API gate |
| Retry | Idempotent retry for one logical save | Storage/API gate |

Keep labels off blank B05 and unsaved B07. Saved examples may show a candidate label only when the screen explicitly identifies it as illustrative. Do not claim current database support. Local client types currently support four non-null categories and expose no sequence field; this is not a fresh live-schema audit. Question persistence and durable numbering remain implementation gates.

### 6. Complete and align existing collection/detail/error screens

- B02 retains the five category filters and Add note; local `notesService` orders newest first, and `notes.tsx` has a filtered-empty branch. The unsupported tune/sort control was removed from the candidate. Preserve filter/list position on return as a route requirement; static screens do not verify that behavior.
- B03 remains a true empty collection with one Add note path.
- B08 is a read-only saved note with book/category/number/page metadata, then Edit and a proposed Copy action. Local source inspection found no note-copy implementation; do not describe Copy as existing behavior. No note-favorite/bookmark behavior was found.
- B09 edits an existing saved note, retains the original record until a successful update, and allows category reassignment with the agreed numbering rule.
- B10 distinguishes load failure from empty. B11 distinguishes definite save failure from uncertain outcome and identifies whether the action was create or edit.
- B12 unsaved-exit behavior remains a product decision. Its discard wording must distinguish abandoning a new note from discarding changes to an existing note.
- B01 management controls (status, ownership, condition, rating, removal) must be inventoried against existing behavior. Specify confirmation and feedback without extending the task into a shelf redesign.

### 7. Verify the recovery/state matrix

For each case record trigger, visible feedback, retained values, retry action, and return destination:

| Case | Required behavior |
|---|---|
| Empty/whitespace note | Keep Save disabled or explain validation; never create an empty record. |
| Optional page blank / invalid | Blank is allowed; invalid input is explained inline and never silently coerced. Do not invent a numeric range; first verify the existing product/code contract. |
| Camera denied/unavailable | Choose photo or Write note; avoid a dead-end. |
| Photo picker canceled | Return to the prior note/capture state with category/text/page intact. |
| Unsupported/invalid/oversized image | Explain the problem, allow another image or manual writing; preserve any prior valid text. |
| Crop cancel/reset/rotate | Preserve source capture until user discards it; reset restores the uncropped image. |
| Recognition loading/cancel/failure | Show progress, allow safe cancellation, retain prior text and context; do not confuse processing error with no text. |
| No text / incomplete text | Use B13/B14; keep category and selected crop; partial acceptance never commits. |
| Rescan after edits | Confirm replacement; cancellation or failed replacement restores the old recognized text and edits. |
| Explicit Save / repeated tap | Disable while pending; one logical request and one number. |
| Definite save failure | Keep text/category/page in the current session and give one truthful retry. |
| Uncertain save result | Reconcile whether the first write succeeded before retry; avoid duplicate records/numbers. |
| Edit-save failure / dirty exit | Keep stored version intact; distinguish Keep editing from discard changes. |
| Category filter returns no records | Show filtered-empty state and a route back to all categories; do not show the whole-book empty state. |
| Delete note / remove book | Confirm destructive scope, explain consequences, then refresh counts/filters. Any number retirement/reuse follows the separately approved numbering policy; that policy is still unresolved. |
| Long text / large type / screen reader | Text remains readable and selectable; controls have labels and logical focus; modal actions remain reachable. |
| Account switch / sign-out | Cancel in-flight OCR/save and do not expose another account’s draft or photo. |

### 8. Refine the existing Stitch canvas in place

The verified target is the existing 16 numbered product artboards B01–B16 plus one current flow/index artboard. Refine those exact nodes only. Do not regenerate a complete screen set, create routine variants as new artboards, or remove historical designs. A new full artboard is justified only if a materially different state cannot be represented clearly in an existing frame; explain the need before creating one.

The index must agree with the current route and recovery contract, show the manual and OCR branches, distinguish initial from replacement OCR, preserve B12 as decision-pending, mark numbering and storage as proposals/gates, and state that the frames are static with unlinked routes.

**Canvas acceptance:** exactly one intended target per B01–B16 and one current index; every screen has one exact role; no unsaved ID or saved-text content in the blank editor; each edge case maps to a screen, inline state, or explicit prototype/storage gate.

### 9. Review, prototype, then separately authorize app implementation

Inspect each changed frame at readable scale and read back labels/fields. Check the entire index against this plan. Obtain owner approval of the design and the remaining product/storage choices. Prototype the crop gesture, OCR progress, edited rescan, immediate save, numbering assignment, edit/category change, and return navigation. Then plan application work in units. Treat Question and durable numbering as schema/API gates. Cloud OCR remains deferred. No migration creation/application, code change, or deployment is authorized by this design plan alone.

## Decisions and gates to preserve

1. **Approved:** category is optional and the B04 Skip/No category choice remains. Do not make category mandatory without a new explicit owner decision.
2. **Proposed, unresolved:** prefix conventions and numbering scope; example prefixes do not approve per-book, per-category, or global allocation.
3. **Unresolved:** behavior when clearing or changing a category, editing text, deleting a note, reusing a number, and handling concurrent saves.
4. **Storage gate:** Question and durable numbering require current schema/API verification. Do not infer live support from local code or design.
5. **Decision pending:** B12 unsaved exit. Candidate new-note and saved-edit wording may be shown as separate variants, but the product policy is not approved.
6. **Prototype/technical gates:** uncertain-save reconciliation, image/picker lifecycle, OCR cancellation/retry capability, keyboard/safe-area behavior, crop gestures, accessibility, and route restoration require evidence before being claimed.

## Application implementation sequence — after design approval

This is the engineering order for a later, separately authorized implementation. The Stitch board remains a static reference and does not authorize code, migrations, or database writes.

1. **Audit current routes and storage read-only.** Trace Book Details → note collection/editor routes, the note model/API, category validation, current save/update behavior, and OCR service. Record what already exists before changing it. Confirm whether Question and durable per-book/category numbering are supported.
2. **Resolve behavior and storage gates.** Skip/No category is already approved and remains optional. Decide numbering prefixes/scope and category-change rules, B12 unsaved-exit behavior, and how an uncertain save is reconciled. If Question or numbering needs schema/API changes, prepare those as a separately reviewed migration proposal; do not apply it without explicit authorization.
3. **Implement the manual note path first.** Book Details → B04 category/input choice → blank B05 editor → explicit save → B08 and B02 only after success. Keep page optional, category visible/changeable before saving, and preserve the entered values on a definite failure.
4. **Implement image intake and crop.** Support camera and photo-library entry, permission/unavailable fallback, cancellation, rotation, crop adjustment/reset, and use only the chosen crop for recognition. Keep the selected book/category and any prior valid text when a replacement capture is canceled or fails.
5. **Implement OCR review and recovery.** Show a progress/cancel state, place recognition into editable B07, allow saving immediately when correct, and never auto-save. Keep distinct no-text (B13), incomplete text (B14), and technical processing error (B16) outcomes. An edited rescan must not discard the current text unless a replacement succeeds.
6. **Implement saved-note reading, collection, and edits.** Populate B02, B08, B09, and the B01 preview from persisted records. Show category and any identifier only after confirmed save. Preserve source context and list position. Apply only the numbering policy the owner has approved; text-only edits and category changes still have unresolved identity rules.
7. **Consider numbering only after a product decision and safe persistence.** Proposed identifiers are not a requirement yet. If approved, allocate one identifier per successful logical save, atomically and idempotently; prevent duplicate labels on retries, settle deletion/reuse behavior, and never allocate a label to an unsaved draft. Do not ship proposed labels until backend/API support and concurrent-save behavior are verified.
8. **Verify the full state matrix on Android.** Test manual and OCR creation, crop/rotation, immediate save, edit, camera denial/cancel, no text, incomplete text, processing failure, definite and uncertain save results, repeated taps, category persistence, numbering, Back/Cancel, large text, and TalkBack. Record device/build and actual results; static screenshots are not runtime evidence.

**Implementation exit check:** every state transition in this plan is either implemented and verified or explicitly deferred with a truthful user-facing fallback. No cloud OCR, standalone passage creation, or shelf redesign enters this workstream.

## Current unit and next action

Current unit: `library_option_b_design_refinement_complete_owner_review_pending`. The controlled Stitch refinement covers the existing 16 numbered targets plus one index and is recorded in the 2026-10-09 review ledger. B05, B07 and B15 have been reflowed in place to 390 × 844; the inventory remains unchanged. B12, numbering policy, Question persistence, uncertain-save reconciliation and runtime behavior remain unresolved or gated. This is not application implementation approval. Exact next action: the owner reviews the final visual evidence and decides whether to approve the candidate or request changes; app implementation requires a separate explicit scope/authorization.

Verification must distinguish Stitch readback/static visual inspection from source audit, prototype behavior, device behavior, and live database evidence.

Verification: Stitch rendered-DOM/readback confirms B01–B16 and the current index content; the prior stale index was removed after the replacement was verified. No app tests, runtime changes, database/storage writes, migration, stage, commit, push, or deployment are part of this design unit.
