# Library experience: requirements and next-session handoff

Date: updated 2026-10-08 (Asia/Calcutta)
Status: Option B notes-first design and continuity record; app implementation is for a later separately authorized session.
Active scoped unit: `library_option_b_clean_canvas_verified_owner_review_pending`.
Current authorized scope: the user authorized Option B refinement and removal of unwanted designs to provide a clean next-session implementation reference. The current source is [OPTION-B-NAVIGATION-CONTRACT.md](./OPTION-B-NAVIGATION-CONTRACT.md), including exact B01–B14 visible titles and observed canvas node IDs. The board now contains 14 mobile targets plus one flow/index; 18 obsolete nodes were removed through recoverable Stitch UI actions. Final rendered-DOM/accessibility readback verified the exact 15-node keep set and the focused corrections. Exact next action: owner reviews the clean indexed candidate and pending behavior decisions before separately authorizing implementation. No application implementation, schema change, deployment or Git publication is authorized by this design unit. Shelf/List/QuickLook/Search and book entry remain excluded. The older comparative assignment below is historical; Option B is the current working direction.

## 1. Read this first

BookConnect is an Expo / React Native reading app with Library, Exchange, Marketplace, Clubs and Profile areas. The user considers Library a main feature. The shelf has already received substantial design and implementation work and is outside this assignment. Begin with a selected book already open on Book Details. Study the connected in-book experience: book information/actions, capture, notes, saved material and revisiting it.

Do not begin by generating more isolated OCR screens. First establish the actual current experience, the reader's tasks, the content relationships, and the proposed navigation after Book Details is open. Shelf, List, QuickLook, catalogue Search and book-entry surfaces are explicitly out of scope: do not audit, redesign, edit, or generate them. Treat the existing shelf as a fixed, unchanged boundary and, only at the later Stitch stage, a read-only visual reference. Record only the minimum existing route/back behavior needed to know how the selected book context is retained when leaving Book Details; do not assess or change the destination screen.

The user requested this document so a new session can resume without reconstructing the conversation. They intend to use Luna at max reasoning for the planning task, then Astra for critical review and a focused book/principle selection, then Stitch for connected screens. No agent or separate chat was started by the author of this handoff.

### Authority and scope

- This assignment initially authorized documentation/planning; the later explicit user instruction authorizes separate Option A/B Stitch design projects and refinements. It does not authorize app implementation, migration creation/application, deployment, Git publication or unrelated external messages.
- The user's current scope is the experience after a book has been opened. Shelf/List/QuickLook/Search and the act of entering the book are not part of this audit or redesign.
- The user has approved the five note categories Quote, Thought, Takeaway, Action and Question. Keep this category set fixed; do not reopen removal, renaming, or replacement of Quote. Quote notes remain a distinct record type from saved passages. Category-selection interaction can be evaluated without changing the approved set. Question writes remain unavailable until storage support is explicitly authorized and implemented.
- Existing OCR plan U0–U6 remains in its owning SDD. This redesign does not silently cancel U3 draft recovery, U4 search/export, U5 resurfacing, or their acceptance criteria.
- Cloud OCR remains explicitly deferred. Do not enable it to complete a design demonstration.
- External reviews and generated screens are evidence/proposals, not product authority or proof of implementation.

## 2. Workspace and session entry

Observed checkout: `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf` on 2026-10-07. Recheck both at session start; the root AGENTS.md contains older branch names. Do not switch branches to match historical text.

The worktree already contains many modified/untracked Library app, test, configuration, documentation and migration files. Preserve them. This handoff session made documentation changes only. The sibling Clubs worktree is outside this task; Library development ports are 8083+, while historical web evidence used 19006. Inspect running services before choosing a port.

Mandatory startup:

1. Read root AGENTS.md, resolve worktree/branch and inspect `git status --short`.
2. Read marketplace ACTIVE.md, DOC-13 and routed Phase 9 SESSION-START/TRACKER. Follow their relevant reading and closeout requirements.
3. Read this document and Library TRACKER.md, distinguishing current handoff overlays from older dated checkpoints.
4. Read the Library evidence and source entrypoints below.
5. State current scope, completed evidence, remaining gates and intended file changes before edits.

Marketplace routing still identifies Phase 9, with Unit 7C/M46 connected canary complete and integrated. It is separate from this Library planning assignment. Do not advance marketplace phases or reinterpret old marketplace next-action sections as Library authorization. The newest global overlays agree on that checkpoint; historical sections describe earlier states.

No database/Storage authority is granted here. If later planning requires a fresh schema audit, follow the Supabase skill and use MCP to verify the exact project before metadata reads. The recorded project ref is `ahntbtktjjmvfosgkmgn`; historical metadata is not a current live verification. Migration planning, file creation and application are separate boundaries. Check both worktree trackers before any later migration.

### Ordered Library reading list

| Document | Why it matters |
| --- | --- |
| [TRACKER.md](./TRACKER.md) | Latest scoped handoff, historical verification, pending gates |
| [OPTION-B-NAVIGATION-CONTRACT.md](./OPTION-B-NAVIGATION-CONTRACT.md) | Current cleaned canvas titles, node IDs, journeys, pending decisions and cleanup evidence; read before historical A/B material |
| [INTERACTION-MAP.md](./INTERACTION-MAP.md) | Existing routes, controls, overlays and behavior; revalidate dated observations |
| [UI-UX-INVENTORY.md](./UI-UX-INVENTORY.md) | Current/proposed screen inventory and earlier visual findings |
| [SDD-05-library-reading-room.md](./SDD-05-library-reading-room.md) | Read only if needed later to match the established visual language; do not audit or revise shelf behavior |
| [SDD-02-notes.md](./SDD-02-notes.md) | Notes domain and intended behavior |
| [SDD-03-ocr-vault.md](./SDD-03-ocr-vault.md) | OCR contracts, U0–U6 plan and later correction overlays |
| [OCR-U0-PREFLIGHT.md](./OCR-U0-PREFLIGHT.md) | Source/capability reconciliation |
| [NOTE-CATEGORY-ROLLOUT.md](./NOTE-CATEGORY-ROLLOUT.md) | Approved labels, stored values, Question rollout boundary |
| [NOTE-REVIEW-DESIGN.md](./NOTE-REVIEW-DESIGN.md) | Optional review proposal, gestures and native acceptance needs |
| [Astra review receipt](./LIBRARY-EXPERIENCE-ASTRA-REVIEW-20261007.md) | Critique of the completed source audit and image evidence; book shortlist and added risks |
| [Earlier design packet](./design-review-20261007/DESIGN-HANDOFF.md) | Existing capture concepts and unresolved approvals |
| [Latest user-supplied Astra critique](./design-review-20261007/ASTRA-INDEPENDENT-REVIEW-USER-SUPPLIED.txt) | Full critique of five individual images; copied verbatim from the user's attachment |

Use these documents together. Some early paragraphs still use Reflect/Distill/Apply or describe obsolete automatic fallback/truncation behavior; later correction overlays and current source supersede those descriptions. Record contradictions instead of silently choosing a convenient version.

For INTERACTION-MAP and UI-UX-INVENTORY, use only entries that describe Book Details or a connected in-book route. Skip shelf/List/QuickLook/Search-only screens and findings. SDD-05 is optional later visual context, not a required shelf audit.

## 3. Conversation history that affects the assignment

1. The user investigated OCR implementation, ML Kit size/efficiency and a hybrid local/cloud plan. The scope expanded into reliable capture, recovery, search/export and resurfacing.
2. U0 was completed; U1 received local fixes and bounded Android offline evidence. Full native acceptance remains incomplete. The user explicitly deferred cloud work.
3. Review corrections separated development build identity from release profiles and made incomplete OCR output require explicit acceptance before saving. These fixes have historical automated verification, not full fresh device-flow acceptance.
4. The user asked where OCR belongs and how the wider Library should be redesigned. Early Stitch work concentrated on capture, notes and saved passages.
5. The user approved Quote, Thought, Takeaway, Action and Question as a category direction. Four existing labels were updated locally; Question still requires storage enablement.
6. The user requested optional Tinder-like note revisiting alongside ordinary views. A session-only review design was generated; neither swipes nor review outcomes are implemented/accepted merely because frames exist.
7. Astra reviewed five individual screen images and recommended clearer record boundaries, simpler capture, complete recovery states and testing cards before committing to swipes.
8. Scope is now explicit: begin with Book Details already open for a selected book. The shelf, List, QuickLook, catalogue Search and book-entry journey are fixed, out-of-scope context; no design or implementation changes to them.
9. Current sequence: source audit → independent Luna/max review → GPT-6 Astra Medium critique and book/principle selection are complete. Next: owner resolves structure and behavior decisions → connected Stitch screens → user design approval → separately authorized implementation and device validation.

## 4. Current baseline and evidence limits

This session performed a bounded source/document inspection, not a complete running-app audit. Treat the table as a starting inventory. Source existence is not runtime acceptance.

| Area | Known baseline | Remaining evidence/task |
| --- | --- | --- |
| Book Details | Starting screen for this assignment: one long scroll containing cover/title/author, status, ownership, conditional lending/condition, rating/review, metadata, community reviews, My Notes, Saved Pages and removal | Audit ordering and all actions; do not replace it with an imagined tabbed app. Shelf and entry surfaces are outside scope |
| Review/privacy | Source has autosave-on-blur review and Public Review/Private Note toggle | Private review is a separate concept from reading notes; clarify language and actual visibility consequences |
| Personal notes | Per-book route; recent-note preview on Book Details; editor used from both | Audit filters, reading versus editing, errors, empty states, navigation and destructive controls |
| OCR placement | Source integrates NoteEditor and separate vault save behavior | Proposed standalone Capture passage is a target, not the current complete flow |
| Saved passages | VaultPagesList embedded in Book Details; historical map records excerpt/delete with no full detail route | Verify current source/runtime before claiming new detail/edit routes exist |
| Categories | `quote`, `reflect`, `distill`, `apply`; display Quote, Thought, Takeaway, Action | `question` is not in current NoteTag union; historical constraint audit records four allowed values; do not expose unsupported writes |
| OCR U0 | Completed according to owning tracker | Reuse preflight; do not restart without evidence of changed dependencies |
| OCR U1 | Partial; local extraction/cancellation/overflow fixes and bounded English Android emulator smoke recorded | Full camera/editor/save flow, latest correction device acceptance, physical-device performance and other platform/script coverage remain pending |
| OCR U2 | Pending complete capture/review/detail flow | New design must map back to U2 rather than create an unrelated duplicate implementation plan |
| OCR U3 | Pending draft recovery/lifecycle | User previously questioned necessity; do not mark deferred/removed without a recorded decision |
| OCR U4–U6 | Pending search/export, quiet resurfacing, final quality/release gates | Preserve as roadmap and cross-reference; decide sequencing explicitly |
| Swipe review | Stitch concepts and proposal only | Test purpose, semantics, long content, Undo, exit and gesture alternatives |
| Release identity | Dynamic config fixes recorded | Approved Android release package still needed for release profiles; no new release identity invented |

### Source entrypoints for Luna

- `app/(tabs)/library/[bookId].tsx` and in-book notes routes such as `notes.tsx`. Inspect route registration/back helpers only as narrowly needed to confirm how this in-book flow exits; do not inspect or audit shelf/List/Search screens or their interactions.
- `src/components/library/LibraryAppearance.ts`, `LibraryTypography.tsx`, `VaultPagesList.tsx` and the status/ownership/condition/rating/removal controls rendered inside Book Details. Do not inspect or change shelf/List/QuickLook components for this assignment.
- `src/components/notes/NoteEditor.tsx`, NoteCard and related note components. Confirm which exported components are actually rendered by routes.
- `src/features/books/services/notesService.ts`, `userBookPagesService.ts`, `ocrService.ts`, and `src/features/books/utils/ocrWordCap.ts`.
- Relevant hooks, query keys, back-navigation helpers and tests discovered from these imports.
- Local migrations are historical source evidence only. Do not infer live constraints or deletion behavior without a fresh authorized metadata audit.

Do not assume an ebook reader, Resume reading route, reading timer, percentage progress or page-progress mutation exists. Current inspection proves a reading-status selector; investigate other capabilities before putting them into Book Details as available actions.

### Carry-forward capture constraints

- Notes: 500-word limit; page is optional under the documented contract.
- Passages: page required; both 800 words and 4,000 characters must pass.
- Extraction review boundary: 20,000 Unicode code points, distinct from note/passage save limits. Do not call this a 500-word truncation.
- Partial text needs explicit acceptance; acceptance does not waive save limits. Edits invalidate prior acceptance under the corrected implementation.
- Planned conflict target: a same-book/page collision should present Replace passage or Keep original; no version history is promised. Current source inspection contradicts that target: the editor calls `userBookPagesService.upsertPage` without first checking for an existing page or asking the reader. The service upserts on `user_book_id,page_number`, so the source path appears to replace the existing row. This was not reproduced against the current live database/runtime. Treat it as a high-priority source finding, not as already implemented behavior. Multiple passages per page remains a separate proposal.
- OCR invoked inside a note must not silently create a separate passage.
- Retained product content is intended to be text. Verify actual temporary-photo cleanup timing before making privacy guarantees.
- Camera, gallery and paste are target input paths; optional crop/rotation and complete passage selection belong to unfinished capture scope. Do not claim all are accepted today.
- No universal OCR accuracy, latency, package-size or smoothness claim follows from one emulator fixture.

## 5. Product goals and design boundaries

Starting from Book Details for an already selected book, readers should understand that book's context, preserve a passage, express a thought, retrieve saved material and revisit it later without losing source attribution or work.

The in-book experience should be calm, readable and consistent with the Library's established visual language. Calm must still have readable metadata, visible actions and clear state changes. Smooth means responsive input, preserved context, predictable navigation and recoverable actions as well as purposeful animation.

The planning scope includes Book Details and every existing function located there, not only OCR. Account for rating/review privacy, community reviews, ownership, lending, condition and removal. Relocating these must not silently delete functionality or accidentally expose private writing. Audit their Library-facing entry points without redesigning Exchange, Marketplace, Clubs or Profile.

The existing shelf, List, QuickLook, catalogue Search and the transition that opens a book are fixed integration boundaries. Do not include their screens or interactions in the audit, redesign, Stitch output or implementation. At most, note the current back/exit destination and selected-book identifier so the in-book flow can return to its caller without losing context. Do not alter shelf visuals, layout, filters, ordering, gestures, routes or behavior.

## 6. Proposals to evaluate, not silently adopt

| ID | Question | Candidate direction and decision evidence |
| --- | --- | --- |
| D01 | Book Details hierarchy | Prioritize book identity/context and saved material; compare against reading status, reviews and ownership tasks using real content |
| D02 | Collection placement | Compare embedded saved-material preview + View all against a dedicated collection entry; preserve direct Capture/Add note access in both |
| D03 | Quote and Passage distinction | The approved Quote note category stays in the category set and remains distinct from saved Passage records. Evaluate how the UI can make their purposes/source attribution clear. Do not propose removing, renaming, remapping or repurposing Quote; do not change existing stored records. |
| D04 | Category selection | Evaluate how the approved five categories are presented and selected, including whether Thought remains the default. Keep every note within the approved category set; changing category membership or adding uncategorized notes is not part of this assignment. |
| D05 | Note/source association | Distinguish book/page association from explicit passage linking. Do not say “about this passage” unless the relationship is supported |
| D06 | Read versus edit | Decide whether note tap reads or immediately edits; provide discoverable edit/delete actions without mandatory long press |
| D07 | Capture review | One obvious editable passage, page input and save feedback; compare optional source-image view/selection without competing default previews |
| D08 | Review mode | Compare Next/Previous reading with button-led session decisions and optional swipe shortcuts; establish reader benefit before implementation |
| D09 | Draft recovery | Explain immediate unsaved-exit protection versus durable restart recovery, privacy/account cleanup and storage costs; retain U3 until a decision changes it |
| D10 | Retrieval | Establish per-book browsing first; assess global saved-text search/export against U4, not catalogue search |
| D11 | Passage location | Multiple excerpts/page and nonnumeric ebook locations are separate product/data decisions; document pain and cost without changing current constraints |
| D12 | Broader detail actions | Place status/ownership/lending/condition/reviews/removal deliberately; retain privacy and destructive-action semantics |

For every decision record: current behavior, user goal, options, preferred option, tradeoff, source evidence, affected screens/data, unresolved question and approval status. General agreement to the approach does not close all D01–D12.

## 7. Latest Astra critique: interpretation and limitations

Full user-supplied text is preserved in the linked evidence file. The completed new conversation is https://chatgpt.com/c/6ac637d7-0194-83ee-a079-3f173e74b3cf . It used GPT-6 Astra Medium according to the preceding browser verification; this document does not freshly verify the picker.

The five images represented two active review-card variants, OCR review, photo preparation and saved-passage detail. Reported native dimensions were only 168×373, 248×542, 185×372, 172×368 and 215×368 pixels. They did not prove complete Book Details placement, collection/editor/recovery designs or cross-screen wiring.

Strong leads: distinguish source text from personal writing; simplify OCR editing; clarify review-session vocabulary; make secondary text readable; reduce destructive-action prominence; use truthful saving/privacy copy; include failure states and native testing.

Qualify these findings:

- The apparent 4,400-character label is resolution-limited and must be checked in the original screen. It is not a confirmed application defect.
- Missing evidence of a state is not proof the state is absent in code.
- Deferring swipes is an external recommendation. The user's card-review idea remains worth prototyping; compare behavior rather than discard it automatically.
- Removing or renaming Quote conflicts with the user's approved category set and is out of scope. How the approved categories are selected in the editor may be reviewed without changing that set.
- Warm colors and text-focused presentation received provisional support; this is not final user approval or measured accessibility acceptance.
- The previous assistant adapted the review prompt instead of sending it verbatim. If the user later approves exact prompt text, transmit that exact text; call out any necessary adjustment before replacing it.

Do not reopen the earlier Astra conversation `6ac5ebd8-c3a8-83ec-b08e-8055e6004aa7` to retrieve context; the user explicitly objected. Use saved evidence and the intended new review destination. Verify the destination before any authorized future send.

## 7A. Astra review of the completed source audit — 2026-10-07

The user authorized a detailed source-context review in the already-open “Design review recommendations” conversation, which contained the five images and earlier visual critique. The target model was verified as GPT-6 Astra at Medium. The submitted pasted-text packet included the audit findings, evidence classes, Luna review, fixed scope/decisions, OCR limits and roadmap gates, prior image observations, and a request to select the most useful books/sections. Astra returned a detailed critique; its summarized findings and cited book sources are in [the Astra review receipt](./LIBRARY-EXPERIENCE-ASTRA-REVIEW-20261007.md).

Astra recommended Option B provisionally with direct creation shortcuts and an optional recent preview; ordinary note reading remains the baseline and swipe review is deferred. It withdrew its earlier suggestion to remove Quote, identified race and uncertain-save concerns, and added questions about OCR replacing existing note text, review/privacy save sequencing, derived passage fields, and privacy scope. It favored Norman, Tidwell, Gilbert, Krug, and Refactoring UI for this iteration. This remains advisory: Astra read the supplied packet and reinspected the five images but did not inspect the repository, canonical audit files, test output, or live schema. No Stitch, app, database, migration, or release action was taken.

## 8. Luna/max assignment and required deliverables

Produce an evidence-backed planning package, not application code or new Stitch designs. Reuse existing inventory documents and update them where appropriate; avoid creating redundant sources of truth.

### A. Current-state audit

Starting at Book Details with a selected book already open, inventory its sections, connected in-book routes, overlays and actions, including hidden/conditional controls. Trace actual imports/handlers and inspect a running app read-only where available. Record runtime blockers rather than manufacturing evidence. Do not save/delete personal content just to demonstrate a control. Do not audit shelf/List/QuickLook/Search or how the book was opened.

Use columns: screen/action ID; entry; reader purpose; displayed data and source; primary/secondary/destructive actions; visibility condition; destination; Back/close behavior; loading/empty/error handling; persistence; evidence file/line or screenshot; confidence; gap.

Explicitly trace status/ownership/review changes, autosave behavior, note versus passage saves, book removal consequences, route parameters, query refresh and failure feedback. Distinguish personal notes, private book reviews and community/public reviews.

### Durable result location and evidence rules

Keep this handoff as the assignment/scope document. Put Luna's findings in one separate canonical result document: `docs/user/library/LIBRARY-EXPERIENCE-AUDIT.md`. Do not put findings only in chat or overwrite the handoff with results. Organize that audit using sections A–H below; clearly label current behavior, proposed behavior, decisions and open questions so future sessions can tell them apart. Add a dated status and the inspected branch/commit or dirty-worktree context at the top.

Give each material finding and requirement a stable ID (`LIB-EXP-F###` and `LIB-EXP-R###`); give evidence artifacts stable IDs (`LIB-EXP-E###`). For every finding, link the exact supporting evidence and record its type (source, test, runtime, screenshot or external critique), when/environment it was gathered, confidence, and limits. For code, include file and symbol/line plus the inspected revision; for device evidence, include device/build/input and observed result. Mark missing evidence as unknown or not run, never as a pass. Keep current and target maps separate.

Use a decision register with status `proposed`, `needs user decision`, `approved`, `rejected`, or `deferred`; record the deciding authority, date, rationale, tradeoff and affected requirements. Only the user's explicit decision makes a proposal approved. Preserve external critique as attributed input, not product authority. Keep raw existing critique files in place and link to them instead of copying their text into multiple documents.

Store new app/runtime screenshots under `docs/user/library/library-experience-audit-evidence/` only when they directly substantiate an observation. Use a manifest mapping evidence ID → filename → screen/state → device/build/date → claim supported. Keep images full-resolution and do not crop away context needed to judge a control. Later Stitch exports belong with the relevant design packet and use a separate screen/state/revision manifest; link that packet from the audit. Update `TRACKER.md` with the audit's status and exact next action after the deliverable exists. Keep supporting files separate only when a stable, independently reviewable responsibility becomes too large for the canonical audit.

### B. Current and proposed navigation maps

Provide separate maps so target screens cannot be mistaken for existing routes. Begin at the already-open Book Details screen and map only its connected in-book experience: per-book collection, note read/edit, capture/source preparation/review, saved passage and optional review mode. Label overlays versus pushed screens and include cancel/back paths. Exclude shelf/List/QuickLook/Search and the act of opening a book.

For every in-scope return path specify what should be retained: selected book, collection filter/position, unsaved text and review-card/session state. Record only the existing caller/back destination needed for a correct exit; shelf view/filter/position and shelf behavior are out of scope. Verify current behavior separately from target requirements.

### C. Content and capability model

Describe user-book identity versus catalogue-book identity, reading status, ownership, rating/review visibility, notes, passages, page references, categories and any proposed session state. Use source-backed relationships; mark live schema unverified where needed.

Include a capability matrix for Android development build, Expo Go, web and iOS: implemented/source-visible, historically tested, unsupported, pending or unknown. Do not transfer Android acceptance to other platforms.

### D. Reader journeys and scenario coverage

Trace journeys with the book already open: change reading status; capture; correct and save; add personal note; retrieve; revisit; edit/delete; manage ownership/review/privacy; exit Book Details. Each journey needs trigger, prerequisites, steps, success signal, failure recovery and return context. Do not test or redesign the shelf-entry journey.

Use newly added/want-to-read, reading and completed books; ownership variants where controls change; zero/few/many notes and passages; missing cover/metadata; long titles/authors; long and multilingual content; slow/unavailable network; account change and app background/restart. Do not imply durable recovery is implemented merely because restart is a test scenario.

### E. Screen/state matrix

For each applicable screen cover: initial loading, populated, empty, filtered-empty, failed fetch/retry, stale/missing book, editing/keyboard, saving, success, failure/uncertain save, duplicate input, cancel/back and destructive confirmation.

Capture adds denied/unavailable input, canceled picker, orientation/crop, no text, partial text, over-limit, invalid/missing page, same-page conflict and stale async result. Review adds zero notes, long note, undo, canceled gesture, separate second pass, exit and changed/deleted content.

Accessibility includes large text, narrow layout, readable contrast tokens, touch targets, focus/announcements, button alternatives, reduced motion and vertical scrolling/text selection. Use N/A with a reason instead of multiplying irrelevant state mockups.

### F. Two Book Details structural alternatives

Option A: useful saved-material preview embedded in Book Details, with Capture passage/Add note and View all.

Option B: compact Book Details with a clear dedicated Notes & passages collection entry and direct creation actions.

Show low-fidelity structure in the planning document; no polished Stitch generation yet. Both alternatives must account for all current detail capabilities. Compare steps, discoverability, reading space, empty/large collections, navigation and implementation implications. Recommend one with evidence and unresolved test questions.

### G. Requirement and decision traceability

Assign stable IDs such as LIB-EXP-001. Each requirement needs reader benefit, current evidence, proposed target, affected screen/state, owning existing SDD or proposed destination, dependencies, verification method and decision status. Reference OCR-P requirements/U0–U6 instead of silently replacing them.

Classify work as design correction, existing implementation defect, missing capability, research question or future enhancement. Distinguish verified defects from low-resolution observations. Estimate relative effort and dependencies; do not give precise delivery dates without code/runtime evidence.

### H. Review-ready closeout

Summarize completed audit scope, gaps/blockers, D01–D12 recommendations, screenshot coverage and exact next action. Provide a self-contained Astra review brief, but do not send it without the user's instruction for that review stage. Update Library tracker and required continuity logs; run documentation validation and link/diff checks. Preserve existing code edits and clearly state tests not run.

## 9. Astra review and book-selection brief

After Luna's package is ready, ask Astra to challenge its completeness, reader goals, navigation, privacy/record distinctions, complexity and evidence quality. Ask it to identify missing capabilities accidentally omitted from Book Details and assumptions falsely treated as implementation facts.

The aim is to select the most useful principles for actual decisions, not to produce a long reading list. Candidate lenses:

| Candidate | Decisions it may improve |
| --- | --- |
| Don Norman — The Design of Everyday Things | Record meanings, signifiers, feedback, error recovery |
| Steve Krug — Don't Make Me Think, Revisited | Findability, labels, navigation, uncoached usability tasks |
| Alan Cooper and co-authors — About Face | Reader goals, task priorities, unnecessary steps, Book Details hierarchy |
| Jenifer Tidwell and co-authors — Designing Interfaces | Collection/forms/navigation patterns and progressive disclosure |
| Adam Wathan and Steve Schoger — Refactoring UI | Typography, action hierarchy, spacing and readable secondary information |
| Jeff Johnson — Designing with the Mind in Mind | Reading, attention and memory demands |
| Val Head — Designing Interface Animation | Continuity, interruption, gesture feedback and motion alternatives |
| Regine M. Gilbert — Inclusive Design for a Digital World | Inclusive process and accessibility needs |

Astra should select roughly 3–5 useful references, rank them by this project's gaps, and explain any substitution. For each selected principle require: source/topic, specific evidence, follows/partly follows/contradicts/unknown, reader impact, concrete recommendation and tradeoff. Verify exact chapter names before citing; no invented quotes/page numbers or claims to have read unavailable books. Use current platform/accessibility documentation for measurable implementation requirements; books are not compliance tests.

Required critique output: major decisions; prioritized findings with evidence/confidence/effort; comparison of the two structures; book/principle audit; missed states; approval readiness; uncoached tests; essential versus later work; ordered revision plan. Recommendations remain proposals until reconciled and approved.

## 10. Stitch stage after structural review

Known capture/review project: https://stitch.withgoogle.com/projects/3746960756569246722?pli=1 . Existing Library visual language is documented in UI-UX-INVENTORY and INTERACTION-MAP (project 2331124625547392526); consult those as read-only references only if needed. Do not inspect, revise or regenerate shelf screens. Verify projects/screens in the current UI; do not assume an ambient tab is the intended destination.

Preserve existing designs. Create clearly named revisions and use the established Library visual language as a read-only reference, not a generic literary theme. Do not edit or regenerate shelf screens. Verify the current model picker and report its exact visible choice. Earlier notes record Balanced/Gemini 3.8 Flash, but that is dated evidence, not a claim about the latest model now.

Expected connected screen set: Book Details, Notes & passages collection, input chooser, optional photo preparation, editable OCR review/page/save, saved-passage detail, note read/editor, review alternatives and associated recovery states. These are experience surfaces, not a mandate for a separate route for each state.

Use one consistent sample book and logically matching page/count/content data. Mark samples as such. Include empty and substantial collections and long text. Avoid invented progress, search, linkage, recovery, privacy guarantees or category support. Distinguish generated visual examples from real app data.

Export individual screens at native/full design resolution, with a manifest mapping image name → screen ID → state → revision. Check that text remains readable at intended phone size. Include an overview map as extra context, never as a substitute for readable screens. Verify every claimed clickable transition; record decorative/nonfunctional controls. Model summaries are not wiring evidence.

Present the connected design, decision tradeoffs and unresolved implementation implications for user approval before application changes. An approved visual direction does not prove native performance, data safety or accessibility.

## 11. Verification and acceptance plan

Five uncoached in-scope tasks, all starting with the selected book already open on Book Details: capture a paragraph from page 24; correct an OCR error and save; add a personal reaction without changing the author's words; retrieve saved material and identify its source; revisit notes, undo a decision and open a long note. Add targeted status/ownership/review-privacy and removal scenarios so the broader Book Details audit is complete. Do not score shelf discovery or entry.

Observe wrong turns, hesitation, assistance, source/record confusion, editing discoverability, save certainty and return-position loss. Compare Next/Previous with session decisions using reflection/retrieval value rather than swipe throughput. Test conflict/partial-output variants without coaching the expected answer.

Native acceptance later needs real camera/gallery-to-save, corrected overflow confirmation, selection near the end of long text, keyboard, back/cancel, TalkBack, enlarged text, reduced motion, offline/reconnect, rapid repeated input and representative-device response/frame measurements. Record device/build/input and actual results. No snapshot can establish smoothness or compliance.

Luna planning is complete only when maps agree with the inventory; existing functions are accounted for; each journey has success/failure/return behavior; record distinctions and category/storage gates are explicit; two alternatives are compared; requirements map to evidence/tests; unknowns have exact checks; and the Astra brief is self-contained. Missing runtime access can be documented as a blocker, not converted to PASS.

## 12. Original Luna assignment (primary audit recorded; independent review completed)

> Use Luna at max reasoning. Read AGENTS.md and the required session chain, then docs/user/library/LIBRARY-EXPERIENCE-HANDOFF.md and its ordered Library sources. Scope starts with a selected book already open on Book Details and covers only Book Details plus its connected notes, passage/OCR, saved-material and optional review flows. The shelf, List, QuickLook, catalogue Search, opening a book, and their screens/interactions are explicitly out of scope: do not audit, redesign, edit, or generate them. Record only the minimal existing back destination/book context needed to exit correctly. Perform section 8: audit actual in-scope routes and behavior, ownership/status/reviews, notes, passages, OCR, retrieval and optional review. Reconcile the current state with prior designs and the user-supplied Astra critique. Produce `docs/user/library/LIBRARY-EXPERIENCE-AUDIT.md` as the canonical results document with separate in-scope current/proposed maps, a content/capability model, journey/state matrix, two low-fidelity Book Details alternatives, a decision register and traceable requirements with verification and dependencies. Assign stable IDs to findings, requirements and evidence; link claims to source/runtime/test/screenshot evidence with date, environment, revision, confidence and limits. Keep the approved five categories fixed: Quote, Thought, Takeaway, Action and Question. Quote is distinct from saved Passage; do not remove, rename, remap or repurpose it. Preserve shelf work and all unrelated changes. Distinguish source evidence, runtime evidence, historical tests, approved decisions and proposals. Do not silently remove U3, expose unsupported Question writes, enable cloud OCR, invent reading-progress capabilities, or claim native acceptance. Prepare a self-contained Astra critique/book-selection brief for the user to review; do not send it or generate Stitch screens during this planning task. No app implementation, migrations, database/Storage writes, deployment or Git publication. Update the relevant documentation trackers, validate the handoff and report exact remaining gates. The following stages are Astra review, decision resolution, connected in-book Stitch design, user approval, and separately authorized implementation.

### Current next-session instruction

> Read AGENTS.md and the required session chain, then read this handoff, `docs/user/library/LIBRARY-EXPERIENCE-AUDIT.md`, and linked evidence. The source audit is populated and has a separate Luna/max critique; do not claim Luna authored the audit or rerun it unnecessarily. Keep scope at an already-open Book Details screen and connected in-book flows. Preserve the approved categories, Quote distinction, cloud deferral, U3 decision boundary, and explicit shelf/search exclusions. Review the audit with the owner. Send the prepared Astra brief only if the user authorizes that stage. Reconcile open decisions before connected Stitch design. Do not implement, access/write the database, create/apply migrations, deploy, or publish Git without separate authority.

## 13. Handoff-session verification receipt

Bounded source/doc inspection completed; latest user-supplied critique preserved verbatim (source/copy SHA256 match). All relative handoff links resolve. Phase 9 continuity validation passed: 195 definitions, zero duplicates/missing traceability, 76 phase Markdown files, regression probes PASS. Repository diff check passed; staged diff was empty. No browser navigation, external messages, Stitch edits, app code edits, native/app tests, database/Storage access, migrations or deployments in this handoff session. Historical test counts are not new results. Documentation remains uncommitted; no stage/commit/push occurred. The tracker closeout records scope and remaining gates.

Historical next action, superseded by the current audit update: run the Luna/max source audit. The audit deliverables now live in LIBRARY-EXPERIENCE-AUDIT.md; this session did not use a separate Luna/max reviewer. Current action is owner review, then Astra only if authorized.
