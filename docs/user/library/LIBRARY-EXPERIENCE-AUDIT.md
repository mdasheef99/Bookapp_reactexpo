# Library Experience Audit — After Opening a Book

**Audit date:** 2026-10-07 (Asia/Calcutta)
**Status:** Source audit, independent Luna review, and GPT-6 Astra Medium critique complete. Running-app/device, current live-schema, and accessibility evidence remain incomplete. This is a planning result, not an approved redesign specification.
**Scope start:** A selected book is already open on Book Details.
**Scope:** Book Details and connected in-book reviews, notes, capture/OCR, saved passages, and optional note review.
**Explicit exclusions:** Shelf, List, QuickLook, catalogue Search, and the act of opening a book. Do not audit, redesign, or change those surfaces. Record only the minimum route/back context needed to return from an in-book surface.
**Repository evidence:** C:/Users/LEGION/Desktop/Bookconnect4_library, branch codex/library-cover-shelf, HEAD 1b743a1, inspected working tree dirty. Findings reflect current working-tree source, including pre-existing uncommitted changes; this is not a clean-commit review.
**Change boundary:** This audit changed documentation only. It did not change application source, tests, database, storage, migrations, Stitch, or external services.
**Assignment and scope authority:** [Library Experience Handoff](./LIBRARY-EXPERIENCE-HANDOFF.md).
**Status authority:** [Library Tracker](./TRACKER.md).

## 1. Executive status

The current OCR entry point is inside the **New Note** modal opened from **Book Details → My Notes → Add a note**. The same editor then offers two different saves: **Save** creates a personal note; **Save to Vault** creates a saved-page record and requires a page number. Book Details also shows a separate **Saved Pages** excerpt list. There is no dedicated Capture Passage action or full saved-passage reading route in the inspected source.

The most consequential source findings are:

1. Saving a passage at an already-used page number appears to overwrite the existing record: the editor calls an upsert on the book/page conflict key without checking for an existing page or asking the reader. This is source-derived, not a fresh live-device/database reproduction.
2. A saved-page card displays a short excerpt and offers deletion, but no open/read action. Tapping a note card immediately enters edit mode. Both make later reading and safe management harder.
3. Cancel, backdrop, or Android Back closes the note/OCR modal directly. No unsaved-change confirmation or durable draft recovery is present in the inspected code.
4. The user's explicit cloud deferral conflicts with a visible **Retry with cloud** action. The action asks for consent and then calls the cloud service. Deployed endpoint/provider state was not checked in this audit.
5. The approved category set remains **Quote, Thought, Takeaway, Action, Question**. The current selector and TypeScript model contain only four stored categories; Question needs separately authorized schema support before savable UI is enabled. Quote is approved and must remain.
6. Current focused tests pass, but are mocked/unit tests. Historical Android evidence proves a bounded offline ML Kit service call on one sign image, not the end-to-end camera → review → save → retrieve experience.

**Recommended structure to evaluate:** Keep concise book actions on Book Details, including direct **Capture passage** and **Add note** actions, and add one per-book **Notes & passages** destination for browsing. Keep passages and notes visibly distinct. This is a proposal, not accepted design.

**Planning-stage completion:** Source inventory, current flow map, content model, findings, decision recommendations, requirements traceability, evidence limits, platform/state matrix, structured layout comparison, Luna review, and Astra critique are recorded here and in the linked review receipts. Structural decisions, connected Stitch design, implementation, and full native acceptance are pending. Astra reviewed the supplied packet and images but did not independently inspect the repository, tests, or live schema.

## 2. Evidence record

Evidence IDs are stable anchors. Source line numbers refer to the inspected dirty working tree at HEAD 1b743a1; line numbers may move. “High source confidence” means code clearly contains the described behavior, not that runtime or remote service behavior was freshly verified.

| Evidence ID | Type | Claim supported | Artifact / exact location | Date and environment | Revision | Confidence and limitation |
|---|---|---|---|---|---|---|
| LIB-EXP-E001 | source | Book Details queries, order, conditional actions, note preview, saved-pages placement, local navigation | app/(tabs)/library/[bookId].tsx, BookDetailScreen, approx. lines 49–99, 153–190, 212–228, 260–526 | 2026-10-07; local source inspection | codex/library-cover-shelf, HEAD 1b743a1, dirty tree | High for source; no fresh app screenshot/runtime verification |
| LIB-EXP-E002 | source | Per-book note list, filters, loading/empty UI, route/back behavior, card actions | app/(tabs)/library/notes.tsx, approx. lines 23–220; src/components/notes/NoteCard.tsx; TagSelector.tsx | 2026-10-07; local source inspection | Same | High for source; accessibility/runtime not measured |
| LIB-EXP-E003 | source | OCR is in shared note editor; camera/local recognition, languages, overflow, cloud consent, close/save handlers, two save paths | src/components/notes/NoteEditor.tsx, approx. lines 45–106, 125–260, 279–470; src/features/books/services/ocrService.ts, lines 1–100 | 2026-10-07; local source inspection | Same | High for source; no current camera/device flow run |
| LIB-EXP-E004 | source | Notes are separate from saved pages; current tags; page upsert conflict behavior and local schema key | src/features/books/services/notesService.ts, lines 4–53; src/features/books/services/userBookPagesService.ts, lines 21–96; supabase/migrations/20260820064258_library_user_book_pages_vault.sql, lines 5–18 | 2026-10-07; local source inspection | Same | High for local source/contract; migration is not proof of live schema |
| LIB-EXP-E005 | source | Saved-page preview displays excerpt and delete; no full-text read action | src/components/library/VaultPagesList.tsx, lines 13–68 | 2026-10-07; local source inspection | Same | High for source path; native rendering not freshly inspected |
| LIB-EXP-E006 | source | Book details joins user_books to catalogue book; public reviews and book removal service path | src/features/books/services/booksService.ts, approx. lines 767–855 | 2026-10-07; local source inspection | Same | High for source; remote RLS/cascade unverified |
| LIB-EXP-E007 | test | Four focused suites passed: editor OCR, note service, saved-page service, OCR service | npx jest --runInBand --runTestsByPath src/components/notes/__tests__/NoteEditor.ocr.test.tsx src/features/books/services/__tests__/notesService.test.ts src/features/books/services/__tests__/userBookPagesService.test.ts src/features/books/services/__tests__/ocrService.test.ts; **4 suites, 44 tests passed** | 2026-10-07; local mocked Jest | Same dirty tree | Covered logic only; no live DB, camera, cloud provider, or full UI journey |
| LIB-EXP-E008 | runtime | Historical Android offline ML Kit smoke used one public road-sign JPEG; three calls returned text in 2664 ms cold, 1052/1044 ms warm | docs/user/library/ocr-evidence-20261006/README.md, Android offline native proof section and linked raw results | 2026-10-06; Android 16/API 36 x86_64 emulator, airplane mode, Metro asset tunnel | Historical build in evidence file | Bounded service/module smoke only; not book-page benchmark, physical-device result, or capture-to-save flow. OCR hallucinated graphic text and merged “TURN OFF” |
| LIB-EXP-E009 | runtime, historical metadata record | Prior recorded read-only query showed reading_notes_tag_check allowed four stored categories, not Question | docs/user/library/NOTE-CATEGORY-ROLLOUT.md, lines 17–30 | Recorded 2026-10-07; project named there | Prior metadata read, not queried here | Historical evidence only; live schema not re-verified |
| LIB-EXP-E010 | source | Swipe/card review remains a proposal; session-only outcomes and native interaction checks pending | docs/user/library/NOTE-REVIEW-DESIGN.md, especially lines 1–38 and dated status | 2026-10-07; local design record | Same | Proposal only; no implemented route/runtime behavior established |
| LIB-EXP-E011 | external critique | Prior Astra visual critique used five small images, not a complete current-app audit | docs/user/library/design-review-20261007/ASTRA-INDEPENDENT-REVIEW-USER-SUPPLIED.txt and DESIGN-HANDOFF.md | 2026-10-07; prior packet | External design artifact | Advisory, not source/runtime proof and not a critique of this completed audit |
| LIB-EXP-E012 | test | A Playwright vault smoke test exists but was not run during this audit | e2e/library-vault-smoke.spec.ts | 2026-10-07; source inspection | Same | Test existence only; no pass claimed |
| LIB-EXP-E013 | external critique | Independent Luna review found the source claims substantially accurate and identified missing platform/scenario coverage and a weakly structured A/B comparison | [Independent Luna review receipt](./LIBRARY-EXPERIENCE-LUNA-REVIEW-20261007.md) | 2026-10-07; separate read-only agent review | Same dirty working tree | Advisory; no database/runtime/browser verification or file edits by reviewer |
| LIB-EXP-E014 | external critique | GPT-6 Astra Medium reviewed the supplied audit packet and five images, corrected earlier recommendations, compared structures, added implementation risks, and ranked design references | [Astra review receipt](./LIBRARY-EXPERIENCE-ASTRA-REVIEW-20261007.md); existing “Design review recommendations” chat | 2026-10-07; user-authorized review | Same | Advisory; reviewer did not inspect repository files, tests, or live schema; no new runtime evidence |

## 3. Current-state inventory

Every row starts with the book already open. Shelf and book-entry behavior are intentionally absent.

| Screen/action ID | Reader purpose and current content | Actions / visibility | Destination and return | Loading, empty, or error behavior | Persistence and evidence |
|---|---|---|---|---|---|
| BD-01 Book identity | Cover, title, author; route bookId is passed as a user-book ID and joined to catalogue data | Back button | Back uses navigateBackOrFallback with Library fallback; destination is not assessed or changed | Spinner while loading; error and missing row both show “Book not found” with Go Back; no retry in this branch | E001, E006; no runtime route check |
| BD-02 Reading and ownership | Reading status, ownership; condition only for owned/lent-out; lending switch only for owned | Status, ownership, condition, lending are editable | Remains on Book Details | Mutations invalidate library/book queries but do not define onError feedback in this screen | E001, E006; remote outcome untested |
| BD-03 Personal review/privacy | Rating, “Your Review” text, public/private setting | Rating saves through mutation; review saves on blur; privacy switch updates local state and submits | Remains on Book Details | Review has success/error alerts; privacy has error alert but no visible local rollback; failure outcome needs runtime test | Review is on user-book record, distinct from notes; E001, E006 |
| BD-04 Community reviews | Public review cards for catalogue book | Read-only list | Remains on Book Details | Loading, unavailable, and no-review states are rendered | Separate from personal review/notes; cache refresh after local change is not clearly invalidated; E001, E006 |
| BD-05 My Notes preview | Count and newest three notes | View All only if count > 0; Add a note always opens shared editor | View All pushes per-book notes route; Add opens modal | Data defaults to []; no explicit preview loading/error branch, so failure can look empty | reading_notes, newest-first service order; E001, E004 |
| BD-06 Saved Pages preview | Separate section with page cards and excerpt | Delete with confirmation; no Capture or open/read action | No full detail route from card | Loading and empty states; query error is not distinct and may look empty | user_book_pages stores full_text, but this UI does not render it; E001, E004, E005 |
| BD-07 Remove from Library | Destructive action at end of details | Confirmation then removal | Invalidates library data and returns via back helper | Delete failure alert | Local service deletes user_books; current live cascade/preservation of notes/pages is unknown; E001, E006 |
| NT-01 Per-book notes list | Notes newest first with category filters/counts | Filter, refresh, add; card tap edits; long-press exposes edit/delete | Back replaces route with Book Details using userBookId | Loading and empty/filter-empty states; query failure lacks distinct retry/error state in inspected path | reading_notes; no read-only detail route found; E002, E004 |
| NT-02 Note editor modal | Shared create/edit editor: category, text, optional page, word count and OCR; book context | Save note; Scan Page; Save to Vault when user/book context and page are valid | Closes to caller | Note/vault errors alert and retain editor text; no unsaved-exit confirmation. Expo Go limitation is reported after camera flow returns | E003 |
| PV-01 Saved-page card | Page number and three-line excerpt | Delete confirmation only | No detail/edit/copy action | Loading/empty; error not distinct | Full text exists in record contract but has no UI read action; E005 |
| RV-01 Optional note review | No app route found; separate proposal exists | Swipe/buttons/undo are design proposals | No current destination/back behavior | No app state to inspect | Not implemented in inspected source; E010 |

**Book Details source order:** hero → status/ownership and conditional lending/condition → rating/review/privacy → metadata → Community Reviews → My Notes → Saved Pages → Remove from Library. This records source order, not a decision to retain it.

## 4. Current and proposed in-book navigation

### Current flow (source-backed)

- Book Details → My Notes → Add a note → New Note modal.
- Scan Page → camera permission → camera capture → image preparation → local OCR attempt → text appears in the same editable note field.
- Save creates a reading_notes personal note (default category Thought; OCR success changes it to Quote).
- Save to Vault creates a user_book_pages passage and requires a positive page number.
- View All appears only when notes exist → per-book notes list. Tapping a card enters edit mode; long-press opens edit/delete choices.
- Saved Pages preview → excerpt card → Delete confirmation. No full-text route.
- Retry with cloud appears after image preparation and calls cloud recognition after consent. This conflicts with explicit cloud deferral; this audit does not authorize the cloud action.
- Cancel, backdrop and Android Back close the editor directly; no durable draft in the inspected source.
- Review cards/swipes are not wired into the app.

### Proposed flow (not current implementation)

- Keep selected-book context on Book Details and offer distinct direct actions: **Capture passage** and **Add note**.
- Add a per-book **Notes & passages** collection with separate Notes and Passages views, useful empty/error states and a stable retrieval destination. Keep direct creation actions on Book Details.
- Capture input chooser targets: Take photo, Choose photo, Paste text. Current source only has camera; optional crop/rotate is a design question.
- Review lets the reader edit text, set the required page for a saved passage, understand partial OCR and see where Save will put the content. Check same-page conflicts before saving and present an approved safe choice.
- Saved passage opens full text with book/page attribution and explicit edit/copy/delete actions.
- Note opens in read mode first, with explicit Edit/Delete. Notes and passages remain separate records; a shared book/page is not proof of a passage-note link.
- Optional review remains later and opt-in. Compare button-led session and swipe shortcuts with normal reading; retain accessible buttons/undo if approved.
- Cloud OCR stays deferred unless the user changes that boundary.

## 5. Content and capability model

| Entity/capability | Current source behavior | Runtime/test evidence | Planning implication |
|---|---|---|---|
| User’s book entry | Book Details route ID resolves to a user_books row joined to books; parent context for notes/pages | E001/E006; live schema not checked | Preserve selected-book context in every in-book route |
| Personal note | ReadingNote: user, user-book, content, tag, optional page, timestamps. TypeScript tags: quote/reflect/distill/apply | E002/E004; mocked service tests | Reader-authored record, separate from page vault |
| Saved passage/page | UserBookPage: user, user-book, positive page number, excerpt, full text, word count, timestamps. Local migration has unique user-book/page key; service upserts on it | E004/E005; service test; no live DB run | One record per numeric page key in local contract; multiple excerpts/non-numeric locations require a separate decision |
| Book review | Rating, text and privacy are on user-book record | E001/E006 | Keep separate from notes and saved passages |
| Community reviews | Public reviews fetched by catalogue book ID through service/RPC path | E001/E006 | Community content, not personal notes |
| OCR result | On-device ML Kit returns bounded review text and overflow; editor allows correction; text may go to note or vault save | E003/E007; historical service smoke E008 | OCR assists, reader verifies |
| OCR image | Camera asset and optional base64 held during modal flow for local/cloud-retry paths | E003 | Product intends retained text; actual temp/cache cleanup timing is unknown |
| Question category | User-approved, absent from current type/selector/config; prior recorded metadata read allowed four values | E002/E004/E009 | Do not expose savable Question before separately authorized schema support and round-trip verification |
| Note-review outcome | No app route/record found; proposal keeps outcomes in session | E010 | Do not imply durable review, reminders, spaced repetition, Action completion or answered Questions |

**Unknown:** No current database schema/data was read. Live RLS, foreign-key cascade behavior, function deployment and remote uniqueness constraints remain unverified. A local migration is not live-service proof.

## 6. Reader journeys and state coverage

| Journey | Scenario from open Book Details | Current outcome/recovery | Evidence | Status / exact gap |
|---|---|---|---|---|
| J01 | Change status, ownership, lending or condition | Mutation and query invalidation; no explicit failure feedback in these paths | E001, E006 | Inject failure in app and define rollback/feedback |
| J02 | Save public/private review | Text autosaves on blur; privacy submits immediately; error alert but no visible rollback | E001, E006 | Force failure and verify persisted/visible value |
| J03 | Add a Thought or other note | Save writes note and closes; error retains text and alerts | E001–E004, E007 | Mock tests pass; no fresh native interaction |
| J04 | Camera permission denied | Settings guidance; capture should not proceed | E003 | Device permission test not run |
| J05 | Scan in Expo Go | Camera permission/capture precede unavailable native ML Kit notice | E003, E008 | Source confirmed; preflight should happen before capture |
| J06 | Successful scan | Local text replaces editor content; category becomes Quote; reader may correct | E003, E007, E008 | Only bounded service smoke; camera-to-editor not freshly tested |
| J07 | Scan non-English language | UI shows EN/HI/KN/ML; local evidence supports English Latin; unsupported script can fail | E003, E008 | Do not claim local multilingual support |
| J08 | OCR exceeds review bound | Missing text disclosed; explicit partial acceptance required; saves blocked until acceptance; edits invalidate it | E003, E007 | Mocked regression passes; fresh Android confirmation check pending |
| J09 | Save a new page | Positive page required; limits checked; upsert; modal closes and query invalidates | E003, E004, E007 | Mock service only; no live round-trip |
| J10 | Save to an existing page | No lookup/Replace/Keep prompt; upsert uses user-book/page key | E003, E004 | Source gap; reproduce only with authorized test account |
| J11 | Exit after typing/capture | Cancel/backdrop/Android Back close directly; no durable recovery in component | E003 | Test platform behavior and decide immediate guard vs durable U3 |
| J12 | Find/read saved passage | Excerpt shown; no action opens full text | E001, E005 | Prototype retrieval/source attribution |
| J13 | Find/read note | Card tap edits; long-press menu has edit/delete | E002 | Test semantics; design explicit read/edit |
| J14 | Empty list or query failure | Empty state can mask query error; preview defaults to empty | E001, E002 | Failure not reproduced; distinguish loading/empty/error/retry |
| J15 | Remove book | Confirmation, delete user_books, return; related content consequences depend on FK | E001, E006 | Live cascade and confirmation copy unverified |
| J16 | Revisit notes by card review | No app route; proposal only | E010 | User decision and reader tests before implementation |

### Platform and scenario evidence matrix

Status meanings: **source-checked** means code/design record was inspected only; **historical runtime** means a dated earlier test covers a narrow case; **not run** means no execution evidence was gathered in this audit; **unknown** means behavior depends on a live service/configuration not verified here.

| Platform or scenario | Current evidence | Status | Exact next verification |
|---|---|---|---|
| Android development build, local OCR service | One historical Android 16/API 36 x86_64 offline sign-image smoke; cold/warm timings and recognition errors are in E008 | historical runtime, narrow | Capture a printed book page in the editor; correct, save, close, reopen and retrieve |
| Android camera-to-vault journey | Camera/editor source inspected; no fresh user-facing journey ran | not run | Test permission grant/denial, camera cancel, OCR, partial confirmation, page save, same-page conflict and retrieval |
| Expo Go | Native OCR unavailable gate is source-checked after photo capture | source-checked; fresh runtime not run | Verify message and move capability preflight before photo capture |
| iOS | No current OCR/editor flow evidence gathered | not run | Build/run the in-book journey on an approved iOS development build |
| Web | No current OCR/editor flow evidence gathered in this audit | not run | Verify rendered controls and truthful native-module unavailable state in web |
| English OCR | Historical runtime covers one graphic road sign, not a book page | historical runtime, weak accuracy coverage | Test clean/difficult printed pages and reader correction burden |
| Hindi, Kannada, Malayalam OCR | UI selector exposes HI/KN/ML; source/prior evidence do not establish local support | source-checked limitation; language acceptance not run | Hide or explain unverified choices while cloud is deferred; test only after approved local support exists |
| Account change or capture cancellation while OCR is pending | Source has abort/current-actor guards | source-checked only | Switch account/close during native operation and verify stale results/images are discarded |
| App background, restart, draft recovery | No durable draft implementation found in inspected editor | source-checked absence; lifecycle runtime not run | Test background/kill/restart and decide whether U3 recovery is in scope |
| Offline/reconnect and save failure | Local OCR has historical offline service evidence; note/page mutations have mocked tests and error handlers | partial historical/source evidence; UI/runtime not run | Verify app-level offline save error, retained text, retry and query refresh on device |
| OCR overflow and long text | 20,000-character partial-text gate has mocked regression coverage | mocked test only | Confirm banner, explicit acceptance, edit invalidation and scroll/selection on Android |
| Large text, assistive technology and reduced motion | No measured contrast, TalkBack, VoiceOver, keyboard focus, or reduced-motion run | not run | Run accessibility checks on proposed screens and a representative native device |
| Same-page overwrite and book removal effects | Local upsert/migration/service inspected; current remote uniqueness and FK cascade not read | source-checked locally; live behavior unknown | Verify with authorized live metadata and isolated test data before stating data-loss consequences |
| Cloud OCR endpoint/provider | UI/service path exists but user deferred cloud; deployed endpoint/quota/provider state not checked | deferred; deployment unknown | Keep disabled. Revisit only after explicit authorization and separate service/security review |

## 7. Prioritized findings

Effort is relative: **S** localized change; **M** multiple UI/service/test changes; **L** route/data/native/platform or policy work. Confidence is about source evidence, not runtime reproduction.

| Finding ID | Priority / class | Evidence and reader consequence | Recommendation | Confidence / effort |
|---|---|---|---|---|
| LIB-EXP-F001 | P1, placement | OCR is hidden in My Notes → Add a note and Save to Vault shares that editor (E001, E003); readers may not know where to save a passage or which record they are creating | Direct Capture passage and Add note actions on Book Details; one collection for later browsing | High source; M |
| LIB-EXP-F002 | P1, data loss | Same-page save upserts on conflict key without preflight or Replace/Keep prompt (E003, E004); a second capture can replace text | Check page first, preserve original unless replacement is deliberately confirmed, handle race and test. Live behavior not reproduced | High source; M |
| LIB-EXP-F003 | P1, retrieval | Page card offers excerpt and Delete, not full-text read (E005) | Add passage reader with book/page attribution and explicit edit/copy/delete | High source; M |
| LIB-EXP-F004 | P1, work loss | Modal close does not ask about dirty text; no durable draft is written (E003) | Add immediate Save/Discard/Continue guard. Evaluate U3 restart recovery separately for privacy/storage cost; do not silently remove U3 | High source; S for exit guard, L for durable drafts |
| LIB-EXP-F005 | P1, cloud boundary | Retry with cloud renders and invokes cloud after consent (E003), despite explicit deferral; deployed state unknown | Hide/disable cloud path while deferred; verify endpoint before future re-enable | High source; M |
| LIB-EXP-F006 | P1, category gate | Approved five labels, but source type/config/selector expose four; Question blocked by recorded schema gate (E002, E004, E009) | Keep Quote/Thought/Takeaway/Action; enable Question only after separately authorized schema path and round trip | High local UI, historical schema; M plus separate approval |
| LIB-EXP-F007 | P1, record semantics | Quote description says passages/excerpts; editor label becomes Passage; OCR defaults to Quote while Vault is separate (E003, E004) | Keep approved Quote. Clarify that Quote is a note category and Save passage creates a different record | High source; S–M |
| LIB-EXP-F008 | P1, trust | Note/page collections can render errors as empty/default data (E001, E002, E005) | Distinguish loading, empty, error/retry and populated states | High source; S–M |
| LIB-EXP-F009 | P1, privacy | Privacy switch changes local state before save; error alert but no visible rollback (E001) | Show pending and confirmed state; restore prior value on error; test offline | High source; S |
| LIB-EXP-F010 | P1, deletion | Service deletes user-book row; effects on notes/pages depend on live FK not checked (E001, E006) | Verify current FK effect, then state consequences in confirmation | Medium; M plus authorized metadata check |
| LIB-EXP-F011 | P2, read/edit | Note tap opens editor; card truncates at six lines; no read view (E002) | Normal tap reads; explicit Edit/Delete, including visible accessible controls | High source; M |
| LIB-EXP-F012 | P2, OCR expectation | UI shows EN/HI/KN/ML although local proof is English Latin; Expo Go check happens after camera capture (E003, E008) | Preflight before camera; label only verified languages; cloud stays off | High source; S–M |
| LIB-EXP-F013 | P2, category language | Some counts/filter empty copy use raw stored values such as reflect/distill/apply (E002, E004) | Use shared display labels; preserve stored IDs | High source; S |
| LIB-EXP-F014 | P2, save feedback | Successful vault save closes without clear success confirmation (E003) | Confirm save and give predictable next destination | High source; S |
| LIB-EXP-F015 | P2, detail reliability | Missing record and load error both say “Book not found”; status/ownership/condition/lending lack explicit error handlers (E001) | Distinguish failure from absence, offer retry and rollback/report mutation failures | High source; M |
| LIB-EXP-F016 | P3, review complexity | Swipe proposal only; no app implementation or usability evidence (E010) | Normal list/read remains baseline; test button-led session first and swipe only as optional shortcut if useful/accessibility holds | High source absence; M–L after decision |

## 8. Book Details structural alternatives

### Option A — Enhanced embedded previews

Keep broad Book Details and inline My Notes/Saved Pages previews. Add direct Capture passage and Add note controls, explicit collection states, and a way to open full content.

**Benefits:** Recent material stays visible; fewer steps for a small collection; incremental changes.
**Costs:** Longer detail page; collections stay separated; previews compete with review, ownership and metadata as material grows. View All currently disappears when there are no notes, and saved pages have no full-view path.

### Option B — Book overview plus per-book Notes & passages

Keep Book Details focused on book identity and established actions. Add direct Capture passage/Add note actions and a concise Notes & passages entry with counts. The collection has distinct Notes and Passages views and read surfaces.

**Benefits:** Predictable retrieval destination; scales to empty/large collections; makes record distinction visible; reduces repeated long previews.
**Costs:** Browsing adds one step; requires route and state handling; direct creation must remain obvious.

### Low-fidelity task comparison

These are proposed interaction structures, not finished screens. “Step” counts mean major actions after Book Details is already open; they do not include scrolling or system-camera controls.

| Reader task | Option A — embedded previews | Option B — collection hub | Tradeoff |
|---|---|---|---|
| Capture a passage | One direct Capture passage action, then capture/review | Same one direct action, then capture/review | Equal when both preserve the direct shortcut |
| Add a personal note | One direct Add note action, then editor | Same one direct action, then editor | Equal when both preserve the direct shortcut |
| Glance at recent material | Inline preview is visible on Book Details | Open Notes & passages, then choose Notes or Passages | A is faster for a small collection; B keeps details shorter |
| Read a full note or passage | Open relevant preview, then read surface; a long preview may require View all | Open hub, choose record type, open item | B adds a type-selection step; A may require scrolling a long detail page |
| Find a specific item in a large collection | More preview content lengthens Book Details; an all-items route is still needed | Browse/filter in the purpose-built collection | B scales better; A can retain a small recent preview as a supplement |
| Reach an empty collection | Empty text appears in the related inline section | Persistent Notes & passages entry remains available with separate empty states | B is easier to find if its entry remains visible and labeled |
| Understand type and source | Separate inline sections may help, but shared editor/save wording can blur types | Separate Notes and Passages views can make the distinction explicit | B gives clearer information architecture; wording still needs testing |

**Low-fidelity structure sketches**

- **Option A:** Book Details → [Capture passage] [Add note] → inline recent Notes + inline Saved Pages → tap item → read surface; add View all for each collection.
- **Option B:** Book Details → [Capture passage] [Add note] [Notes & passages, with counts] → collection → [Notes] [Passages] → item → read surface.

### Recommendation (proposed, not approved)

Prefer **Option B with direct creation shortcuts**. It gives saved thinking a coherent per-book home while preserving direct access to the two creation tasks. Revisit a small recent-item preview only if uncoached testing shows it improves retrieval without making Book Details too long.

Open tests: Can readers distinguish Save as Quote note from Save passage? Find the collection when empty? Retrieve full text and identify page? Does compact Book Details still support ownership/review/status tasks?

## 9. Requirements and verification traceability

| Requirement ID | Reader benefit | Current evidence | Proposed target | Dependency | Verification | Status |
|---|---|---|---|---|---|---|
| LIB-EXP-R001 | Preserve selected-book context | E001/E006 | Every in-book route carries user-book ID and returns to correct caller | Route design | Navigate into/out of every route | proposed |
| LIB-EXP-R002 | Know where to start capturing | E001/E003 | Direct Capture passage, separate from Add note | D01/D02 | Uncoached capture task | proposed |
| LIB-EXP-R003 | Preserve reader intent | E003/E007 | Editable OCR review and explicit note/passage destination | Capture design | Correct text and choose intended record | partly implemented |
| LIB-EXP-R004 | Never silently lose same-page content | E003/E004 | Existing-page detection and safe conflict choice | Service/concurrency design | Save twice to one page; verify original remains until confirmed | source gap |
| LIB-EXP-R005 | Retrieve full passage/source | E005 | Full-text reader with book/page attribution | New route | Find/read saved page, state source | missing capability |
| LIB-EXP-R006 | Read without accidental edit | E002 | Read surface and explicit Edit/Delete | Route/component | Open short/long note and use visible actions | source gap |
| LIB-EXP-R007 | Protect in-progress capture | E003 | Dirty-exit guard; separate durable U3 decision | Privacy/storage/product decision | Cancel, backdrop, Android Back, restart | source gap; decision open |
| LIB-EXP-R008 | Distinguish failure from empty | E001/E002/E005 | Loading, empty, error/retry and populated states | Query UI | Force offline/query failure | source gap |
| LIB-EXP-R009 | Consistent approved categories | E002/E004/E009 | Fixed five labels; Question writes only after schema support | Separate schema gate | Create/edit/filter and round-trip Question after enablement | labels approved; capability gated |
| LIB-EXP-R010 | Distinguish Quote from Passage | E003/E004 | Separate wording/destination; no silent duplication | D03/D05 | Reader explains difference and save destination | proposed |
| LIB-EXP-R011 | Respect cloud deferral | E003 | No cloud recognition while deferred | User decision | UI check plus assert no endpoint call | explicitly deferred |
| LIB-EXP-R012 | Honest OCR boundaries | E003/E007/E008 | Partial text disclosed; unsupported languages accurately stated | Native runtime | Overflow/language/platform cases on Android | partial; device acceptance pending |
| LIB-EXP-R013 | Trust review privacy | E001/E006 | Persisted state confirmed or rolled back with clear feedback | Mutation handling | Force save failure/offline | source gap |
| LIB-EXP-R014 | Understand removal consequence | E001/E006 | Confirmation reflects verified note/page impact | Live schema check | Read FK effects, then isolated test | unknown |
| LIB-EXP-R015 | Make review worthwhile and accessible | E010 | Ordinary navigation remains; if approved, buttons/undo/reduced motion and tested gestures | Product decision | Compare button/swipe with readers and TalkBack | not implemented |

## 10. Decision register

Category set and scope are fixed user decisions. Other entries are recommendations awaiting explicit user choice.

| Decision | Question / evidence | Recommendation and tradeoff | Status |
|---|---|---|---|
| D01 | Book Details balance of identity, reading controls, reviews and saved thinking; F001/F015 | Keep direct actions, simplify route to saved collection, retain ownership/review capability | proposed |
| D02 | Inline preview or dedicated collection? §8 | Option B plus direct Capture passage/Add note | needs user decision |
| D03 | Quote vs saved Passage; separate records E003/E004 | Keep Quote unchanged; clarify context and destination | fixed boundary; wording proposal |
| D04 | Category presentation; source supports four, approved set has five | Preserve all five labels; Question writes wait for separately authorized schema path | labels approved; implementation gated |
| D05 | Is a note linked to a specific saved passage? Current data only shares book/page context | Do not imply link unless relation is designed and implemented | open only if linked UX proposed |
| D06 | Should note tap read or edit? Current tap edits | Read first; explicit Edit/Delete | proposed |
| D07 | Capture flow? Camera only found; editor has two saves | Separate Capture from Add note; editable review, clear destination; gallery/paste remain target decisions | proposed |
| D08 | Should review use swipe? Proposal only | Keep optional; compare button-led interaction first | needs user decision |
| D09 | What does draft recovery mean? No dirty guard/persisted draft found | Immediate unsaved-exit guard first; restart/account-safe U3 recovery is separate privacy/storage choice | needs user decision |
| D10 | Retrieval scope? Shelf/catalogue search excluded | Per-book retrieval first; in-book/global saved-text search/export stays separately scoped U4 | proposed |
| D11 | One passage/page or multiple/non-numeric locations? Local numeric page key | Keep current bound initially; collect pain before changing data | needs user decision if expanded |
| D12 | Placement of status, ownership, reviews, privacy, removal | Preserve all actions; improve feedback without changing excluded surfaces | proposed |

### Fixed carry-forward decisions

- Start after a book is open on Book Details. Shelf, List, QuickLook, catalogue Search and book-opening are excluded.
- Quote, Thought, Takeaway, Action and Question are approved. Quote must not be removed, renamed, remapped or repurposed.
- Notes and passages stay separate records.
- Cloud OCR is deferred; do not enable or expose it in this work.
- Do not cancel U3 silently. Decide immediate unsaved-exit protection separately from restart recovery.
- Planning approval does not authorize implementation, migration creation/application, deployment or Git publication.

## 11. Design-principle review readiness and Astra brief

This is a source-grounded first pass and has received a separate read-only Luna/max review (E013); it is not a completed book-by-book/Astra review. The previous Astra image critique (E011) is useful context but cannot establish source behavior or complete flow coverage. Send the prepared brief only when the user authorizes that review stage. The Luna reviewer found the audit substantially accurate and recommended an explicit platform/scenario matrix plus a clearer task-by-task alternative comparison; both were added above.

Candidate lenses:

- Don Norman, *The Design of Everyday Things*: record meaning, visible actions, feedback and recovery; F002/F004/F007/F008/F014.
- Steve Krug, *Don’t Make Me Think, Revisited*: labels, findability and reduced steps; F001/F003/F008.
- Alan Cooper and co-authors, *About Face*: reader goals, task priority and unnecessary effort; Book Details hierarchy/capture placement.
- Jenifer Tidwell and co-authors, *Designing Interfaces*: collection/form/navigation patterns; Option A/B and the proposed hub.
- Jeff Johnson, *Designing with the Mind in Mind*: reading, attention and cognitive load; reading/editing separation and OCR correction.

Astra may substitute a better book only when it changes a concrete decision. Verify exact section titles before citing, avoid invented quotes/page numbers, and treat principles as lenses rather than compliance proof.

**Prepared review brief (historical; superseded by the submitted evidence packet):**

On 2026-10-07 the user authorized the Astra review. The complete source audit context, Luna findings, prior image critique, scope boundaries, and book-selection request were sent as a pasted-text attachment in the existing “Design review recommendations” chat, with GPT-6 Astra at Medium. Astra's summarized response is recorded in [the Astra review receipt](./LIBRARY-EXPERIENCE-ASTRA-REVIEW-20261007.md). The prompt below was prepared earlier and was not sent verbatim.

> Act as an independent product and interaction design reviewer for BookConnect Library. Review docs/user/library/LIBRARY-EXPERIENCE-AUDIT.md and its linked handoff/evidence. Scope begins with a selected book already open on Book Details; do not review or redesign Shelf, List, QuickLook, catalogue Search or book entry. Separate current implementation and evidence limitations from proposals. The user fixed categories as Quote, Thought, Takeaway, Action and Question; Quote stays and remains distinct from saved Passage. Cloud OCR is deferred. Do not silently cancel U3 or assume Question writes are supported. Challenge whether the audit missed important Book Details responsibilities, whether Option A/B follows reader goals, whether source findings have sufficient evidence, and whether a per-book Notes & passages collection justifies its route/complexity. Select the most useful three to five references or suggest concrete replacements. For each principle, cite a verifiable topic/section, link a finding/evidence ID, classify follows/partly follows/contradicts/unknown, explain reader impact and change, and state tradeoffs. Separate decisions answerable from source from those needing prototype, current schema verification or user choice. Recommend the ordered next design step. Critique only; do not generate screens or implementation.

This prompt has not been sent. No Stitch design was generated during this audit.

## 12. Approval readiness, evidence gaps, and ordered next steps

### Ready for owner review

- Current OCR placement and actual Book Details route have source citations.
- Note/passage distinction, same-page upsert path, missing full-passage reader, unsaved-close behavior, category gate, cloud-deferral mismatch and error-state gaps are recorded with limits.
- Option A and B are compared; Option B is only a recommendation.
- Category boundary, U3 caution, cloud deferral and shelf/search exclusions are preserved.

### Not ready as an implementation specification

1. No fresh Android camera → OCR review → correction → save → reopen → retrieve run.
2. No current live schema check; historical metadata and local migrations are not present-service proof.
3. Same-page replacement is inferred from local upsert code, not reproduced with an authorized test account.
4. Temporary image cleanup, delete cascades, deployed OCR endpoint and RLS are unknown.
5. TalkBack, large text, keyboard focus, measured contrast and reduced motion were not run.
6. No current app screenshot set or Stitch change was made.
7. Luna/max and Astra reviews are complete, but neither supplies fresh runtime or live-schema evidence. Astra's review limits and additional findings are recorded in the linked receipt.

### Ordered work plan

| Step | Work | Why now | Relative effort / gate |
|---|---|---|---|
| 1 | Owner reviews the source audit and Astra receipt; selects Option A/B and whether a recent preview earns its space | Structure determines route and Stitch scope | Product decision; pending |
| 2 | Resolve high-impact behavior boundaries: Quote/Passage explanation, OCR insertion/replacement in an existing note, read/edit, save destination, same-page conflict, uncertain save, removal consequences, and immediate exit guard versus U3 | Prevent designs from implying unapproved or unsafe behavior | Product/data decisions; some require later authorized verification |
| 3 | Confirm design gates for Question storage, target inputs/platform/language claims, cloud exclusion, and whether card review merits a button-led experiment | Keep design honest to current capabilities and user decisions | Product decision; cloud remains deferred |
| 4 | After owner decisions, create connected in-book Stitch screens for Book Details, capture, review/save, collection, note read/edit, passage detail, and failure/empty/long-text states | Validate the whole structure in context | Design stage; user approval required; shelf excluded |
| 5 | User approves connected design and remaining tradeoffs | Design approval precedes implementation | Explicit approval |
| 6 | Implement bounded route/UI/service changes, starting with conflict protection, retrieval, unsaved-exit safety and truthful states; Question schema has its own gate | Highest trust benefits first | Medium–large; migration requires separate authority |
| 7 | Focused tests, Android journey, accessibility and representative-device checks; update trackers | Establish actual acceptance | Device/runtime gate |

**Relative size:** Audit/planning evidence is complete. Connected Stitch design is medium. Full target implementation is medium-to-large due to routes, safe conflict handling, retrieval, error/recovery states, category/schema sequencing and native acceptance. OCR service has bounded historical offline proof; the user-facing OCR journey is not accepted end-to-end.

## 13. Screenshot and Stitch manifest

| Evidence ID | Filename | Screen/state | Source | Date/revision | Claim and limitation |
|---|---|---|---|---|---|
| — | No screenshots captured for this source audit | — | — | 2026-10-07 | Findings derive from code/tests and dated historical evidence. Existing Stitch images are design references, not current app behavior proof. |

Later app screenshots belong under docs/user/library/library-experience-audit-evidence/ at full resolution and must map each file to evidence ID/state/device/build. Stitch exports belong with their design packet and a separate screen/state/revision manifest.

## 14. Dated updates

- **2026-10-07 comparative Stitch authorization:** The user authorized two new projects for Option A and Option B before choosing either structure. See [comparison packet](./LIBRARY-EXPERIENCE-STITCH-COMPARISON.md) for scope, exact prompts and evidence. This supersedes the older requirement to select one option before any design generation; no structure or implementation is approved. Source findings remain unchanged. Cross-artboard wiring, native acceptance and live schema are not established by the designs.

- **2026-10-07 Astra review follow-up:** The user authorized and received the GPT-6 Astra Medium critique. The submitted packet included the complete audit context, Luna findings, prior image critique, scope/decision boundaries, and book-selection request. Astra did not independently inspect repository files, tests, or live schema. Its recommendations and added risks are captured in [the Astra review receipt](./LIBRARY-EXPERIENCE-ASTRA-REVIEW-20261007.md). No app, database, storage, migration, or Stitch changes were made. The owner decision on structure and behavior boundaries is now the next action.

- **2026-10-07:** Replaced empty scaffold with a source-backed after-book-entry audit, stable finding/requirement/evidence IDs, current/proposed maps, journey/state matrix, platform/scenario matrix, structured two-option comparison, decision register, evidence limits and an unsent Astra brief. A separate Luna/max read-only review found the source claims substantially accurate and identified the two documentation gaps now addressed; see E013. Focused mocked run recorded as 4 suites / 44 tests passed. No app, database, storage, migration, browser/Stitch, deployment or Git publication change was made by this audit. Current live schema and native capture-to-save remain unverified.
