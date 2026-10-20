# SDD-06 manual-note local implementation receipt

**Latest technical handoff:** [local persistence candidate and Luna/max review](../sdd06-persistence-local-2026-10-10/README.md) are complete within the authorized local scope; three migration-guard defects are independently confirmed fixed. Migration/adapter/category regressions do not constitute shared-project/native acceptance; production save gates remain false. Exact next action is owner authorization for the reviewed exact-project application/readback unit. The dated implementation/cache/browser checkpoints below remain historical evidence.

Date: 2026-10-10 (Asia/Calcutta)
Work unit: `library_sdd06_manual_cache_corrections_complete_persistence_gated`
Behavior authority: SDD-06 revision 0.4 baseline plus the owner's explicit pending-entry, conflict-choice and navigation clarifications; implementation receipt incorporated in revision 0.5 and correction evidence in revision 0.6.

Current bounded cache correction: the owner independently reproduced both additional findings and accepted one local correction pass. Confirmed deletion now clears all retained readers, cancels stale record reads and prevents old/late confirmations from restoring deleted data. Confirmation cache effects apply once per QueryClient/account lifetime and cannot replace an already observed equal/newer record version, including composer refresh. Four permanent mounted regressions cover the reported defects, remounts and late-response ordering; the original two regressions failed before implementation. Cold-test timing was traced to lazy React Native UI exports; suite initialization preloads them without raising timeouts or changing test order. Exact no-cache eight-suite Jest passes 104/104; scoped TypeScript passes. SDD revision 0.8 and [CORRECTIONS.md](./CORRECTIONS.md) own current evidence. Earlier 99/100-test and web-export checkpoints below remain historical. All write gates remain false, with database/security/native acceptance pending; no external mutation or publication occurred.

Current bounded correction evidence: [CORRECTIONS.md](./CORRECTIONS.md) records the owner's review authorization, five initially source-inferred/probed findings, local RED reproductions, corrections and repeatable GREEN evidence. It narrows the original component-only claims below: actual QueryClient and StackRouter reducer state are now tested, with service/OS effects still simulated. No native or database acceptance is inferred.

Previous repeated-re-entry follow-up: independent rereview reproduced the 99-test checkpoint but left finding 2 partly open. The owner authorized a mounted regression and narrow fix: each edit attempt now retains the resolved original reader context in account-scoped memory through retry/remount. The regression failed on the competing reader key before implementation, then passed; current aggregate is 100/100 across the same eight suites and scoped Library TypeScript passes. SDD revision 0.7 and CORRECTIONS.md record this correction without changing the revision 0.4 behavior baseline. The 99-test/web-export checkpoints below remain historical, not fresh build/native/database proof. Interaction Map current rows are reconciled and legacy editor behavior explicitly labeled historical. Manual write gates stay false; no database or external mutation/publication occurred.

## Authority and scope

The owner explicitly instructed this conversation to proceed with implementation after approving three slices and these adjustments: evidence-led preflight; visual/accessibility checks during each slice; provisional complexity until capabilities are verified; finish/review manual notes before OCR. This authorizes local SDD06-02–04 source/tests/continuity work. It does not authorize migration-file creation, application, database test writes, Storage/provider mutations, deployment or Git publication.

The owner subsequently accepted the local review as sufficient for reproducing/fixing its five findings and closing missing behavioral coverage, with saving gated throughout. That bounded correction pass is locally complete; this is not an OCR/design/migration authorization.

Repository: `C:/Users/LEGION/Desktop/Bookconnect4_library`; branch `codex/library-cover-shelf`. Existing mixed changes were preserved. Marketplace Phase 9 remains `unit7c_resumed_connected_canary_pass_main_integrated`, completed Unit7C/M46; DOC-13/ACTIVE/global handoff unchanged. No sibling worktree changes.

## Local implementation

- B01 Add note opens B04; preview cards open a saved reader. Notes access remains visible even when empty. Preview loading/failure does not pretend there are zero notes. Book-management controls and existing Saved Pages browse/delete remain in place.
- B02/B03/B10 use actor/book-scoped reads, six filters (All plus five categories), total saved count, distinct empty/filter-empty/error states, retained collection navigation, and pending-submission entries.
- B04 starts with no category. Write is immediately available; Skip explicitly clears classification. Scan is visibly unavailable in this manual slice and is not wired to legacy OCR/cloud/Vault creation.
- B05/B09 share a blank/manual or once-initialized/edit form with compact category Change, optional positive whole page validation, intact over-limit text and a keyboard-aware save footer.
- B08 reads a saved record, renders neutral selectable body text, omits absent metadata, exposes Edit/Copy and preserves confirmed note deletion. Clipboard feedback reports confirmation/failure; no added attribution or metadata.
- B11 is inline and preserves values. B12 guards note/edit exits with safe Keep editing defaults; navigation removal is intercepted. Retained Back to options does not discard fields.
- Save operation state is account-scoped memory with immutable payload/identity, duplicate protection for the same operation/note, independent new notes, proposed 15-second uncertain transition and one automatic bounded 10-second read. Check status never redispatches. Account changes clear memory and prevent former-account completion from updating current UI. Process loss has no replay or draft-recovery promise.
- A pending entry in the selected book's Notes opens the retained submission. Pending payloads remain readable/selectable even if a fresh book/status read fails. Known pending edits block only another write to that same note.
- Conflict UI preserves the draft, shows saved comparison, provides Keep editing, protected Use saved version, and confirmed Replace against precisely the compared version. A failed fresh read for Use saved version preserves changes. Ordinary writes never fall back to ID-only updates.
- Confirmed create replaces the composer with one reader and then returns to Notes (All for Book Details creation). Confirmed edit returns to its existing reader, preserving origin/position; this is not a global restriction on normal reader browsing. Route parameters contain identifiers only; origin context is in account-scoped memory.

Primary source: [contract](../../../../../src/features/books/notes/manualNoteContract.ts), [save coordinator](../../../../../src/features/books/notes/noteSaveCoordinator.ts), [gated gateway](../../../../../src/features/books/notes/manualNotesGateway.ts), [query hooks](../../../../../src/features/books/notes/useManualNotes.ts), [navigation](../../../../../src/features/books/notes/noteNavigation.ts), [shared UI](../../../../../src/components/notes/ManualNoteUi.tsx), [composer](../../../../../app/%28tabs%29/library/note-compose.tsx), [reader](../../../../../app/%28tabs%29/library/note.tsx), [collection](../../../../../app/%28tabs%29/library/notes.tsx), selected Book Details integration and scoped stack registrations. Existing NoteEditor/OCR implementation was preserved, not extended.

## Initial implementation read-only database evidence — 2026-10-10

Supabase MCP verified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. Catalog SELECT only; no user/book/note contents read, and no database/Storage writes.

This evidence belongs to the initial preflight; no fresh live read was performed during the correction pass.

| Capability | Observed current state | Consequence |
|---|---|---|
| Category | tag NOT NULL; check permits quote/reflect/distill/apply | Question/null writes require storage enablement; never remap |
| Page/content | Nullable positive integer page; nonempty/500-word checks | Reuse existing limits; strict client validation still required |
| Create identity | UUID primary key | Client-allocated stable UUID/recheck is a candidate; persistence/duplicate proof pending |
| Edit version | No version or operation marker columns; no non-internal note triggers | Server-managed version and reconciliation mechanism are not verified |
| Ownership | Note policies predicate on auth.uid() = user_id; book FK alone does not bind both owners | Own-book/foreign-book enforcement and denial evidence remain release gates |
| Privileges | anon/authenticated report TRUNCATE privilege | Scoped privilege correction/denial evidence required; no exploit/denial proof claimed |

All manual create/update write gates remain false in `MANUAL_NOTE_WRITE_GATES`. Save currently fails before dispatch with text retained; there is no mock-success adapter in the product. Existing authenticated saved-note reads/deletion remain exposed. This is a local implementation with persistence gates, not SDD06-04 acceptance or a complete manual-note release.

## Minimum proposed backend work — separate authorization

1. Permit null and `question` in note classification; keep four legacy stored values unchanged.
2. Establish a server-maintained monotonic record version advanced on every update, including legacy writers. The local candidate uses an atomic version-filtered update; a controlled command is an alternative if preflight shows it is necessary. Never rely on client timestamps or check-then-unconditional-update.
3. Verify uncertain edit reconciliation. The local candidate uses an operation marker plus exactly the expected next version; matching content/ID alone cannot confirm an edit. If a later write prevents reconstruction, report unknown rather than overwrite or replay. No durable draft or new receipt table has been authorized.
4. Enforce the actor's ownership of the referenced book at the database boundary for relevant reads/writes, and restrict unintended bulk privileges. Preserve legacy note/page/content/FK semantics.
5. Prove authorized create/read/update, Question/null compatibility, duplicate/uncertain handling, both racing edits, foreign-book/account denial and bulk privilege denial before enabling any gates. Creation of migration files, live application and test-record writes are separate approvals.

No SQL migration file was created. The schema/operation-marker design is a technical candidate, not an approved live contract. Complexity remains provisional: UI/session scaffolding is bounded; reliable backend versioning, reconciliation and security proof may increase the work.

## Historical verification and acceptance limits (before repeated-re-entry follow-up)

| Check | Evidence type | Result |
|---|---|---|
| Validation/operation/account/race reducer, adapter gates and connected/regression suites | Jest; simulated service/catalog fixtures | PASS; current aggregate 99/99 across eight suites; original implementation aggregate was 70/70 |
| Entry/category/manual/read/edit/return interactions | Mounted composer/reader/collection/Book Details tests; real StackRouter reducer with simulated router effects | PASS locally, including Save/Leave race and pending preview-edit return; no persistence/native-stack proof |
| Thought filter with new Question; total versus visible notes | Real QueryClient invalidation/refetch and mounted collection, simulated save/list transport | PASS; total 1 -> 2, Thought retained, new Question hidden until All; real database/scroll restoration pending |
| Initialized editor refresh failure; Saved Pages initial/refresh error and confirmed deletion; private-review label | Mounted components and actual QueryClient, mocked services | PASS; text/category/page retained, distinct read-error/empty feedback, expected deletion/privacy arguments; full management/device acceptance remains pending |
| Pending entry/readability during failed status reads | Component/coordinator fixtures | PASS; server outcome/restart reconciliation pending |
| Existing notes, OCR editor and Saved Pages service regressions | Existing focused Jest suites | PASS; device regression pending |
| Library source/type boundary | `tsc -p tsconfig.library-notes.json` | PASS |
| Whole repository TypeScript | `tsc --noEmit` | FAIL outside changed Library paths: WU4 E2E typing and Deno-style .ts imports; no global PASS claim |
| Expo web export | Actual Metro bundle, single worker | PASS; initial multi-worker attempt hit sandbox spawn EPERM, single-worker retry succeeded |
| Final source bundle | `expo export --platform web --max-workers 1` after review/retry-context corrections | PASS; 2,350 modules, 5.51 MB entry bundle; temporary output only |
| Headless browser availability for visual fixture review | Isolated Edge launch preflight | NOT_RUN; sandbox returned spawn EPERM before a browser could open; no visual acceptance claimed |
| Palette contrast calculations | WCAG relative-luminance calculation on intended opaque colors | Light text/action/error examples 6.14–16.68:1; dark 8.92–13.38:1; input border vs card 3.30:1 light / 5.21:1 dark after correction. This is source-palette evidence, not measured native rendering acceptance |
| Continuity/traceability | Phase9 validator after correction records; scoped Library links and page inventory | PASS; 195 definitions, zero duplicates/missing traceability, 76 Markdown files; local links valid, B01–B16 retained; size notices remain advisories |
| Working tree/index | `git diff --check`, cached names, branch/status | PASS; no whitespace error or staged path; existing mixed local changes preserved |
| Real create/read/update and atomic/race/denial proof | Persistence/security | NOT_RUN; no test-write authorization |
| Android keyboard/TalkBack/large text, measured layout/contrast, real stack/position and clipboard | Device/accessibility | NOT_RUN; component semantics, 48dp controls, dynamic text, keyboard avoidance, contrast-conscious shared palette and no-motion routes are implemented, not accepted from mocks |
| B06/B15/B07/B13/B14/B16 and cloud/durable recovery/swipe | Deferred slice/scope | NOT_RUN; not integrated or claimed complete |

Tests intentionally target transitions/adapters and user flows rather than snapshots/styles. Simulated conflict responses prove draft/UI behavior only, not atomic database writes. Existing notes persistence tests remain mocks. No database capability was marked PASS from catalog existence.

Current focused commands: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath` for ManualNoteJourney, noteNavigation, ManualNoteFlow, manualNotes, manualNotesGateway, notesService, NoteEditor.ocr and userBookPagesService; `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --pretty false`. Jest completed 99/99 and the Library compiler exited 0. The final run emitted the existing Node punycode and core Clipboard deprecations, with no VirtualizedList act warning after the list test waits were corrected. The whole-repository compiler was run during the initial implementation and failed in the stated outside-scope paths; it was not rerun during this bounded correction and is not claimed PASS.

Current final web output: `C:/Users/LEGION/AppData/Local/Temp/bookconnect-sdd06-corrections-final-web-558349330e4144938088ccd504c531d0`. It was not served or published. Note-reader edit exits use one return control; category-choice Back restores the editor before chooser navigation. Default/error text contrast and border correction remain initial source-palette evidence; the correction pass did not add a rendered visual acceptance claim. Native keyboard/large-text/focus/real-stack and actual rendered visual checks remain pending and must be collected before manual acceptance.

## Next action

Current handoff: the refreshed 8083 Chromium browser correction remains its recorded checkpoint; see CORRECTIONS.md. The subsequent authorized migration/adapter preparation is complete in the [local candidate receipt](../sdd06-persistence-local-2026-10-10/README.md). Exact next action: review this exact candidate/evidence before separately authorized exact-project application/readback. Shared-project test writes and enablement remain separate. All four write gates stay false; native acceptance is pending. Do not start OCR until manual completion evidence and review.

No migration, database/Storage/provider mutation, dependency install, native rebuild, Stitch/browser change, staging, commit, push or deployment occurred. All source/document changes remain local and uncommitted. Web output was temporary, outside the repository; no server or preview route was added.

### Browser history correction (2026-10-10)

- Active source: `src/features/books/notes/composerBrowserHistory.ts`, imported at app startup; integrated in `app/(tabs)/library/note-compose.tsx`; web dialog focus restoration in `src/components/notes/ManualNoteUi.tsx`.
- Behavioral browser regression: `e2e/library-manual-note-browser-history.spec.ts`; run with `playwright.manual-note-history.config.ts` against the exported temporary local bundle on port 8084. Exact commands/results and scope: [correction receipt](./CORRECTIONS.md).
- Dispatcher races: `src/features/books/notes/__tests__/composerBrowserHistory.test.ts`.
- App-start listener stays dormant without a focused dirty/pending-save composer. Edge/Navigation API verified; unsupported APIs, real browser zoom, native, database security and persistence acceptance remain pending. Gates closed.
