# Astra Review — Library Experience After Book Details

**Date:** 2026-10-07
**Reviewer:** GPT-6 Astra, Medium reasoning, in the existing “Design review recommendations” chat
**Review mode:** Independent critique of the supplied audit packet and five images; no repository or live-service access
**Status:** Advisory. Structural and implementation decisions remain with the product owner.
**Primary record:** [Library Experience Audit](./LIBRARY-EXPERIENCE-AUDIT.md)
**Independent source review:** [Luna review receipt](./LIBRARY-EXPERIENCE-LUNA-REVIEW-20261007.md)

## Outcome

Astra recommends **Option B provisionally**: keep Book Details as the selected book’s overview, provide direct **Capture passage** and **Add note** actions, and use a per-book Notes & passages destination for later retrieval. A small recent-material preview may supplement that route if it proves useful. Creation should not require opening the collection first. This is a recommendation for owner review, not approval to design or implement it.

Prioritize reliable reading, saving, retrieval, and recovery before investing in note-card review. Keep ordinary list and full-note reading as the baseline. If review has a demonstrated reader benefit, test button-led session decisions first; defer swiping. Preserve the approved Quote, Thought, Takeaway, Action, and Question categories. Question writes remain gated, cloud OCR remains deferred, and U3 remains pending.

## Review limits

The user supplied the audit, Luna receipt, and previous visual critique in a pasted-text attachment. Astra said it reinspected the five original images in this chat and read the supplied packet. Astra did **not** independently inspect the repository, canonical audit files, test output, or live schema. It did not add runtime, accessibility, or database evidence. Its assessment of source behavior therefore remains a critique of reported findings, not a second code audit. The small image exports still limit judgments about fine details; no screenshot proves actual contrast, touch targets, focus order, screen-reader behavior, animation, or performance.

## Corrections to the earlier image critique

1. **Withdraw the suggestion to remove Quote.** Quote is a fixed, approved note category. Clarify Quote note versus saved Passage instead.
2. Keep this work strictly after Book Details. Library-wide search and book-entry surfaces remain out of scope; U4 is separately scoped.
3. Treat the apparent **4,400** character counter in the small OCR image as a verification item, not a primary blocker. The supplied 4,000-character contract is clear; check the original-resolution design before changing it.
4. Do not call review-card variant 2 functionally better because an Undo icon appears. Its label, availability, accessibility, and restoration behavior are unproved.
5. The images show **Use photo** and **Save passage**, but do not establish discoverable capture placement on Book Details.

## Proposed in-book structure

- Capture: Book Details → Capture passage → input choice → photo preparation only where relevant → editable text and page review → explicit same-page decision if needed → confirmed saved-passage detail.
- Note creation: Book Details → Add note → note editor → Save note → readable saved note.
- OCR inside an existing note: note editor → capture/recognition → explicit review of insertion or replacement → return to the same note → Save note. Do not silently replace nonempty text or a reader’s category choice.
- Retrieval: Book Details → Notes & passages → relevant collection → full item, with return restoring collection context.
- Revisit: ordinary list/read navigation first; optional session review only after separate approval and evidence.

Take photo, Choose photo, and Paste text remain target inputs; only camera capture is established by the supplied source audit. Paste should bypass photo preparation, but still obey passage limits and page validation. Preserve selected-book context throughout. Keep status, ownership, review/privacy, and removal responsibilities discoverable if Book Details becomes more concise. Putting personal-material access before extended metadata/community content is a prioritization hypothesis, not a reason to remove established book tasks.

### Quote note versus saved passage

- A **Quote note** is a note record categorized Quote. It can include an excerpt and personal commentary; it follows note behavior, including a 500-word limit and optional page.
- A **saved passage** is a separate record with a required positive numeric page, both passage limits, and same-page conflict behavior.
- A **book review** and its public/private setting are separate from both.

Do not describe every Quote note as the reader’s own words. Make the record type and any commentary clear. OCR inside a note must not create a passage; saving a passage must not silently create a Quote note. “Add note on this page” can describe book/page association, but do not imply a persistent passage-note link unless one is designed and implemented.

## Option A / Option B reassessment

Astra favors **B with direct creation shortcuts**, with a small recent preview only if testing supports it.

| Task or condition | Option A: embedded previews | Option B: overview plus collection |
| --- | --- | --- |
| Capture / add note | Direct shortcuts, low effort | Same direct shortcuts; no inherent disadvantage |
| Glance at recent material | Strong; already visible | Weaker without a small preview |
| Find older material | May require scrolling, View all, then browsing | More predictable collection entry, with added navigation |
| Empty collection | Works if entry and actions remain visible | Strong if the collection entry remains visible at zero items |
| Large collection | Can work if previews stay bounded and full lists exist; risks fragmentation | Better place for browsing and type-specific controls; adds routes/state |
| Note/passage distinction | Separate inline sections can help | Separate views help, but readers may choose the wrong view |
| Delivery cost | More incremental | More routing and state restoration |

Two audit claims need softening: A does not inherently scale poorly if previews are bounded and full lists exist; its main risk is fragmentation/discoverability. B is not inherently faster for retrieval: the hub/type/item steps can cost more than opening a recent preview. Separate records do not require separate navigation. Test whether readers remember the record type or the material. Astra’s starting hypothesis is one collection with distinguishable Notes and Passages views, without another type-selection interstitial. A remains credible if recent-item use dominates and B adds no retrieval benefit.

## Additional risks and questions Astra identified

| Area | Astra’s critique | Evidence still needed |
| --- | --- | --- |
| Same-page replacement (F002) | An existence check followed by an unconditional upsert still has a race window. Specify preservation and concurrency behavior, not only a confirmation dialog. | Source review, authorized constraint verification, and race/failure testing; remote behavior remains unknown. |
| OCR inside a note (J06) | OCR reportedly replaces current editor text and switches category to Quote. A nonempty note or deliberate category selection could be lost; repeated scans also need defined behavior. | Confirm source paths, decide insert/replace behavior, then prototype/device-test. |
| Privacy update (F009) | Rolling back the old toggle value on every error is insufficient: the server may persist while the response fails. Distinguish a definite rejection from an uncertain outcome and reconcile uncertainty. | Mutation-path review and failure/reconnect/readback tests. |
| Draft recovery (F004/U3) | A dirty-exit guard protects deliberate exits only; it does not cover process death, background eviction, or account changes. Keep U3 pending and decide its privacy/storage behavior separately. | Review close paths and test lifecycle; owner decision for durable recovery. |
| Cloud deferral (F005) | Consent does not override the user’s explicit deferral. Remove the cloud route from the proposed flow and ensure automatic fallback cannot bypass the decision. | Inspect OCR entry/fallback paths. Do not enable cloud or investigate deployment to justify exposing it. |
| Book removal (F010) | “Remove from Library” may understate deletion of related notes/passages. Do not promise preservation or deletion consequences before verifying them. | Separately authorized live schema/RLS/FK review and owner decision on preservation. |
| Retrieval (F003/F011) | Full text stored without a reading route does not meet the save-for-later goal. Read-first should be the baseline, with explicit Edit. | Route/source review and connected retrieval prototype. |
| Question (F006) | Category approval does not prove a writable storage path. Never map Question to another tag or claim save success before round-trip verification. | Separately authorized storage work and fresh create/read/update verification. |
| Empty/error handling (F008/F015) | Failed queries must not become counts of zero. Preserve confirmed prior content where appropriate and identify a failed refresh separately. | Source review and injected query/mutation failures. |
| OCR capability (F012) | One English sign test neither proves reliable printed-book OCR nor proves other languages impossible. Separate configured capability from measured accuracy; preflight before requesting capture. | Build/config review and representative printed-page/language testing. |
| Partial extraction | Preserve the 20,000-code-point acceptance gate; edits invalidate acceptance, and note/passages have separate save limits. | Source/boundary review plus native long-text test. |
| Save feedback (F014) | A toast alone is inadequate. Show the saved record and distinguish saving, confirmed success, definite failure, and uncertain outcome. | Save/retry/reopen tests, repeated taps, and reconnect behavior. |
| Book review/privacy sequencing | Review text autosaves on blur while visibility submits separately. Determine what happens if navigation or visibility changes during a pending text save, and what content becomes public. | Source review and failure testing. |
| Derived passage fields | Editing full text must keep excerpt and word count consistent. This is an inspection target, not a diagnosed bug. | Inspect update path and add tests if confirmed relevant. |
| Privacy scope | The book-review toggle must not imply it controls notes/passages. Do not call notes private without verifying access behavior. | Confirm copy boundaries and authorized access/schema evidence. |

## Image observations retained with limits

- **Image 1, active review card:** repeated navigation/context, faint secondary content, quote-like Thought styling, and overlapping “Set aside” / “Review again” concepts. Quotation marks may be intentional; the visual treatment still does little to establish authorship. No gesture behavior is proved.
- **Image 2, review variant:** similar hierarchy and an apparent Undo control. The explanatory disclaimer shows the semantics need testing; it does not prove failure. Give Undo a clear accessible name and visible availability.
- **Image 3, OCR review:** multiple text representations and Compare photo might help select an excerpt from a long recognition result. Do not remove them just for visual simplicity; test that purpose and make editing obvious. Verify the counter from original-resolution evidence.
- **Image 4, photo preparation:** overlay labels obscure source text; the image cannot establish whether visible text is OCR output or the photographed page. Explain control effects and keep overlays clear of text.
- **Image 5, saved passage:** passage prominence and book context are strong; Add note is prominent; Edit/Copy/Delete are similarly weighted. Delete may be secondary, but a menu is only a recommendation. Replace unverified photo-retention guarantees with verified behavior.

## Review sessions, accessibility, and motion

Baseline: normal list and full-note reading. If readers demonstrate value in session sorting, test button-led review as an experiment before swipe. “Reviewed this session” and “Read again this session” can share a temporary model; “Set aside” is less specific. Verify readers understand Actions are not completed, Questions are not answered, session progress is not durable, Undo restores both card and decision, long text can be read/selected, and returning from a full note restores position. Demonstrate value beyond Next/Previous without making readers classify every note.

Keep book identity and action locations stable. Animate only changes that explain movement between preparation, editing, saved reading, or session decisions. Interrupted gestures must not commit; repeated input must not duplicate saves or advance multiple cards. Reduced motion should preserve the same information without large card movement. Test real printed books, long and maximum-length text, narrow layouts, enlarged text, TalkBack, keyboard/focus behavior where supported, permissions, account changes during OCR, and background/foreground transitions with readers who have visual and motor access needs. The images cannot certify accessibility or smoothness.

## Astra’s ranked book shortlist

Astra stated it checked these section names against author/publisher material but did not read unavailable full chapters. The links below are the sources Astra cited; this receipt does not independently re-verify those contents.

1. **Don Norman, _The Design of Everyday Things_, revised edition** — “Conceptual Models”; “Designing for Error.” Apply to F002/F004/F007: destination ambiguity, replacement without a choice, and unguarded exit make outcomes hard to predict or recover from. Decide record meanings and loss behavior before polishing. [Author’s contents](https://jnd.org/books/the-design-of-everyday-things-revised-and-expanded-edition/)
2. **Jenifer Tidwell, Charles Brewer, Aynne Valencia, _Designing Interfaces_, 3rd ed.** — “Organizing the Content: Information Architecture and Application Structure.” Apply to D01/D02/D06 and A/B: separate creating, browsing, and reading responsibilities without assuming each needs another navigation step. [Publisher contents](https://www.oreilly.com/library/view/designing-interfaces-3rd/9781492051954/)
3. **Regine M. Gilbert, _Inclusive Design for a Digital World_, 2nd ed.** — “Assistive Technologies and Inclusive Experiences”; “Inclusive Design Research.” Apply to capture alternatives, crop controls, long-text editing, and review gestures; include excluded readers early. [Springer contents](https://link.springer.com/book/10.1007/979-8-8688-1820-2)
4. **Steve Krug, _Don’t Make Me Think, Revisited_, 3rd ed.** — “Street signs and Breadcrumbs”; “Usability testing on 10 cents a day.” Apply to route comprehension and uncoached A/B testing. Fewer taps help only when readers understand where they lead. [Publisher contents](https://www.informit.com/store/dont-make-me-think-revisited-a-common-sense-approach-9780321965516)
5. **Adam Wathan and Steve Schoger, _Refactoring UI_** — “Balance weight and contrast”; “Establish a spacing and sizing system”; “Don’t overlook empty states.” Apply after structural choices to weak metadata, competing controls, and F008. Visual quiet must not hide useful state. [Official book site](https://www.refactoringui.com/)

Tidwell and Gilbert take priority over Val Head for this iteration because information architecture and inclusive task completion are unresolved. Val Head becomes more useful if review motion is retained; Cooper and Johnson remain relevant but overlap with the goal/model/cognitive-effort issues already covered.

## Approval readiness and next step

- The audit is a suitable planning baseline when kept explicitly separate from live/runtime acceptance.
- Option B is ready for owner selection and comparative prototyping, not approval by evidence alone.
- Direct creation actions, full reading, distinct destinations, and honest recovery are strong requirements to carry into a later design.
- The palette and text-centered presentation are provisional pending native-size/accessibility verification.
- Cloud retry is outside the experience while deferred. Swipe/card review is not ready for approval. Question saving, removal consequences, and private-access claims require appropriate storage/schema evidence. Capture reliability and motion require a working build/device tests. U3 remains pending.

Before connected design, Astra asks the owner to decide: (1) Option A or B and whether a recent preview earns its space; (2) Quote/Passage copy and OCR behavior inside existing notes; (3) read-first behavior and post-save destination; (4) replacement, uncertain save, removal, and immediate guard versus U3; (5) Question storage gate, target inputs/platform/language claims, and cloud exclusion; (6) whether note-review sessions deserve an experiment. Multiple passages per page, broader source locations, passage-note links, and U4 remain separate decisions.

**Exact next authorized action:** owner reviews this critique and selects the structural direction and behavior boundaries. Connected Stitch design remains pending; no application, database, migration, or Stitch changes were made by this review. The supplied prompt and Astra response remain in the open ChatGPT conversation; this file is a summarized review receipt, not a verbatim transcript.
