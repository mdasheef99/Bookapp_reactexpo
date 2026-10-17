# Library capture design approval packet

Status: design proposal only; implementation is not authorized by this packet.

## Book-informed review

The user authorized a targeted follow-up in the existing GPT-6 Astra / Light conversation. The complete response, including section references, screen contracts and five reader-test tasks, is in [ASTRA-AREA-REVIEW.txt](./ASTRA-AREA-REVIEW.txt). It is external critique, not product authority.

| Reference and relevant area | Application here |
| --- | --- |
| The Design of Everyday Things: conceptual models, signifiers, feedback, constraints and error recovery | Distinguish note/passage operations; show exact save preview; disclose incomplete extraction and replacement; distinguish confirmed from uncertain saves. |
| Don't Make Me Think, Revisited: scanning, navigation, mobile usability and usability testing | Contextual Capture passage action; one Notes/Passages hub; clear labels and Back destinations; five task-based reader tests. |
| About Face: goal-directed design, scenarios, posture and excise | Start with keeping a passage or writing a thought; avoid unnecessary crop and late destination choices. |
| Designing Interfaces, third edition: navigation, actions, input and mobile patterns | Full-screen review, progressive disclosure, optional preparation, recoverable forms and deliberate discard. |
| Refactoring UI: Starting from Scratch, Hierarchy Is Everything, Layout and Spacing, Designing Text, Working with Color, Finishing Touches | Design the feature flow first; clear action hierarchy; consistent spacing; readable text; color-independent validation; useful empty states. |

Primary reference pages inspected: [Norman](https://jnd.org/preface-design-of-everyday-things-revised-edition/), [Krug](https://sensible.com/dont-make-me-think/), [Designing Interfaces publisher](https://www.oreilly.com/library/view/designing-interfaces-3rd/9781492051954/), [Refactoring UI](https://www.refactoringui.com/). No page numbers or quotations are claimed here.

## Proposed structure

Book Details → Capture source → optional Prepare photo → Review passage → confirmed Saved passage. Paste bypasses image preparation and OCR. Notes and Passages are views of one book-level hub; Add note enters a separate note operation. Home filters, Shelf and catalogue Search remain existing integration points.

Stitch project: [BookConnect Passage Capture Prototype](https://stitch.withgoogle.com/projects/3746960756569246722?pli=1). Created separately to preserve older projects. Balanced model picker showed Gemini 3.8 Flash. Six core canvas designs, source sheet, note editor, replacement confirmation and recovery-state gallery were generated. Multiple targeted refinements corrected unsupported model inventions. The final DOM evidence and screenshot are in this folder. Cross-screen wiring and native behavior are not verified; generated summaries do not establish completion or accessibility compliance.

### Contracts that control implementation, regardless of generated decoration

- Notes: Quote/Reflect/Distill/Apply, at most 500 words, optional page. Scan into nonempty writing requires an explicit insertion/replacement decision.
- Passages: at most 800 words AND 4,000 characters, required positive integer page. One passage per book/page currently; show existing/proposed text before replacement. No replacement history promise.
- Review: editable exact save preview; available-text toggle; selection plus edit/paste fallback; temporary photo comparison for photo sources only. No silent shortening. No cloud controls.
- Overflow: first 20,000 Unicode code points may omit text. Explicit partial acceptance, reset on editing, never bypassing destination limits.
- Uncertain save: preserve candidate, show Save not confirmed and check saved passages; no blind duplicate-safe retry promise.
- Photos and unsaved text are session-only for this prototype. U3 durable recovery remains an undecided proposal, not implemented or removed from the approved plan.
- Sample: A Quiet Practice, Mira Vale; passage page24, 21 words /108 characters; reflection9words. All fictional.

## Approval and verification boundaries

Request user approval of contextual placement, shared hub, toggle review, visual direction and explicit replacement interaction before implementation. U3 inclusion/deferral and insertion/replacement into nonempty notes require a separate explicit decision. Live character semantics, save reconciliation and native selection need verification rather than preference approval.

Android verification of the latest overflow/save-confirmation corrections remains NOT_RUN in this design session. Earlier offline ML Kit sample proof and 66-test correction evidence remain historical and bounded. No camera-to-save, TalkBack, keyboard/large-font or physical-device acceptance is claimed by these designs.

Marketplace Phase9 completed Unit7C/M46 and global DOC13/ACTIVE status unchanged. No application code, dependency, database/Storage/provider mutation, migration, stage, commit, push or deployment in this session. Authorized external actions: Astra follow-up prompts and a separate Stitch project with refinement prompts. Local evidence/tracker edits remain uncommitted.

## 2026-10-07 — Approved five-category notes direction

User approved Quote, Thought, Takeaway, Action and Question. Shared app labels now map quote/reflect/distill/apply to Quote/Thought/Takeaway/Action; stored values and default reflect (Thought) preserved. Writing prompts remain optional. Exact-project Supabase MCP verified Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY; metadata-only readback confirmed reading_notes_tag_check allows only the original four. Question remains designed/pending storage enablement, never silently mapped to reflect or exposed as savable yet. No note contents read or database writes. Concrete migration creation/application/compatibility/verification plan: docs/user/library/NOTE-CATEGORY-ROLLOUT.md. No migration created/applied. Topic tags and answered/done states remain later proposals. Full capture UI approval and Android correction acceptance remain pending independently.

Active scoped unit library_note_labels_complete_question_schema_pending. Exact next action: obtain explicit authorization to create and verify the narrow question constraint-expansion migration plan; application requires separate approval. Marketplace Phase9 Unit7C/M46 and DOC13/ACTIVE unchanged. Existing mixed changes preserved; no stage/commit/push/deploy, database/Storage/provider mutation. Stitch category refinement requested under user-approved design scope; completion evidence recorded at closeout.
