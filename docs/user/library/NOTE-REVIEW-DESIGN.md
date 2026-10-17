# Optional note review mode — design proposal

2026-10-07: user requested a Tinder-like swipe option in addition to individual note viewing, reasons for each direction, a Stitch design and a smoothness/principles assessment. This authorizes design, not application implementation or persistence changes.

## Purpose and gesture meanings

One note at a time makes revisiting saved writing easier. The default list remains useful for finding/editing a particular note; Review is a separate user-started mode in the per-book Notes view. Five categories: Quote, Thought, Takeaway, Action, Question. Category filters define the review set before starting. No swipe categories on saved passages.

| Direction | Label | Meaning | Why |
| --- | --- | --- | --- |
| Left | Review again | Set aside for this session | Reader wants more thought/time, has an unresolved question, or wants another look. |
| Right | Reviewed | Considered for this session | Reader has read/reflected sufficiently to move forward now. |

Outcomes do not delete, archive, like, favorite, certify knowledge, answer a Question or complete an Action. Category-specific resolution requires an explicit separate future action. Review metadata is session-only in this proposal; no scheduling, reminders, durable drafts or server fields. Restarting begins a new session.

First pass shows each selected note once. Completion offers a user-started set-aside pass; do not immediately requeue left swipes forever. Ending with unresolved cards is allowed. Undo restores the exact previous card and reverses its session outcome, including counters. Session counts are based on actual loaded records; prototype sample counts explicitly labeled Sample.

## Screens and interactions

NR01 Notes hub entry, NR02 active card, NR03 left-drag intent/cancel, NR04 reviewed outcome/Undo, NR05 end-of-pass summary, NR06 full-note reading, NR07 narrow/large-text/reduced-motion. Stitch project3746960756569246722, separate named designs preserving capture screens.

Visible Review again and Reviewed buttons match swipe behavior. Swipe handle/edge keeps vertical text scrolling and native selection independent. Long text offers full note; return retains queue and position. No forced swipe to finish reading. Editing uses existing editor with unsaved handling; deletion remains outside review gestures with existing confirmation.

One readable card with at most one next-card peek. No auto-advance timer, streaks, confetti, match vocabulary or swipe audio. Short first-use instruction; outcomes signaled in words as well as direction/color. Optional committed-action haptic remains a candidate, not verified.

## Smoothness contract — requires native acceptance

- Card follows drag directly; canceled drag settles without committing. Distinguish horizontal intent from vertical scrolling, use hysteresis and one commit per gesture.
- Candidate settle duration200–280ms with restrained translation/tilt; these are prototype tokens, not performance evidence. Inputs remain responsive; isolate repeated commits without a long blocking animation.
- Reduced motion removes flying/tilting transforms, using immediate replacement or short fade. All actions, Undo and full-note navigation remain available by buttons and assistive technology.
- Avoid full-deck rerenders and synchronous work while dragging; pre-load only necessary next card without reading excessive note collections. Stable note IDs and loaded-record snapshot define session order; reconcile missing/changed notes explicitly.
- Native checks: long500-word note, vertical scrolling/text selection, accidental drag cancel, rapid input/Undo, large text320width, keyboard/editor return, TalkBack, reduced motion and frame timings on representative Android including a slower device. No60fps/120fps claim from static designs.

## Book/principle assessment

| Lens | Concrete application | Evidence / current limit |
| --- | --- | --- |
| Norman: signifiers, feedback, error recovery | Labels/buttons, intent preview, clear session outcomes, Undo | Required by prototype; gesture/runtime acceptance pending. |
| Krug: visible navigation and usability testing | Review entry remains alongside List; clear Back/Exit; reader task test | Existing notes are individual cards; review is proposed only. |
| Cooper: goals and excise | Revisit writing with one decision at a time; no forced management task | Session-only design minimizes new schema/workflow. |
| Designing Interfaces: mobile actions and progressive disclosure | Full-note view and optional editor; list retains retrieval function | Native long-text/gesture conflict still requires proof. |
| Refactoring UI: hierarchy, spacing, readable type | Book/category context secondary to text; two labeled actions; consistent palette | Visual direction present; measured contrast/large-text QA pending. |
| Val Head, Designing Interface Animation | Purposeful continuity, interruptible feedback, motion alternatives | Existing Shelf code uses useReducedMotion; no new note-review implementation. |

Primary references: [Designing Interface Animation publisher](https://rosenfeldmedia.com/books/designing-interface-animation/), [Refactoring UI](https://refactoringui.com/), [Krug](https://sensible.com/dont-make-me-think/), [W3C gesture alternatives](https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures). Proposed application is our design judgment, not a quoted book requirement.

Current source evidence: NoteCard offers tap-to-edit and long-press Edit/Delete confirmation; no review deck. HorizontalBookVolume uses150ms feedback and useReducedMotion; LibraryHorizontalShelf guards animated scrolling with reduced motion. These are partial local principles, not whole-Library smoothness acceptance. Prior Stitch outputs required correction of invented features; model prose is not verification.

## Model and authority

Live Stitch picker verified this session: Speed = Gemini3.5Flash-Lite, Balanced = Gemini3.8Flash. Balanced selected; Gemini3.8Flash is the newer available model in this picker. No claim about unlisted models or globally latest Google model.

User approval needed for gesture semantics/structure before implementing review mode. Question database migration remains independently pending explicit creation approval. No application edits, migration, database/Storage/provider write, deployment or Git publication authorized by this design. Marketplace Phase9 Unit7C/M46 unchanged.

## 2026-10-07 — Swipe review design handoff

Stitch generated seven NR01–NR07 designs and a reader-facing polish refinement; selected active card/neighboring states visually inspected. Removed engineering dashboards/reject colors and requested plain session wording; final model summary and screenshot saved in design-review-20261007/stitch-note-review.txt and stitch-note-review.jpg. Motion/performance/accessibility and cross-frame wiring remain NOT_RUN; summaries are not proof. Proposed left Review again/right Reviewed, button alternatives, Undo, expanded reading, manual set-aside pass and reduced-motion variant are awaiting user approval. Exact next action: user review/approve gesture semantics and screens before any implementation; Question schema creation gate remains independent.

Active scoped unit library_note_review_design_approval_pending. Phase9 continuity PASS (195 definitions, zero duplicate/missing traceability;76 Markdown files), git diff --check PASS, staged diff empty. No application tests rerun for documentation/browser design. No new app/dependencies/migration, database/Storage/provider write, commit/push/deployment. Existing mixed edits preserved; design docs/evidence uncommitted. Current logs remain cohesive dated evidence with advisory size notices. Global marketplace Phase9 Unit7C/M46 and DOC13/ACTIVE unchanged.
