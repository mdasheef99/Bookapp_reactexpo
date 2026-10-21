# Retained review field/session corrections — 2026-10-16

**Owner-authorized bounded corrections implemented and locally verified.** This resolves the two-review findings concerning implicit failed-field retries, lost newer typing, inherited busy feedback, account transitions and false affected-row confirmation. Full Library release acceptance remains open.

Worktree `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`, existing mixed changes preserved. Library work unit `library_sdd06_review_field_and_session_corrections_locally_verified`. The owner explicitly confirmed the proposed correction after the [two-review reconciliation](../sdd06-two-review-triage-2026-10-16/README.md). SDD-06 revision 0.23/D06-17 records that failure policy. Marketplace remains Phase 9 at completed Unit7C/M46; DOC-13/ACTIVE/global handoff and database-mutation authority unchanged.

## Final behavior and owning code

- [Book Details](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx>): text blur sends only review text, rating sends only rating, visibility sends only its explicit value. All actions share the serial actor/book/authenticated-generation queue. Successful earlier changes remain intact because later actions do not resubmit other fields. Failed fields are not silently retried by unrelated actions. Rapid visibility toggles use the latest queued explicit visibility intent.
- Failed text remains editable and visibly **unsaved**. A reopened screen restores the latest pending text. Every input event advances a local edit revision, so A→submit B→type A cannot be overwritten by B's response. Confirmations clean only the matching edit revision or an inherited submission that has not been edited locally.
- Shared queue state supplies busy feedback across reopening. Rating, text and visibility can queue further explicit actions consistently. Rating/privacy displays remain the last confirmed server values.
- [bookReviewService](<C:/Users/LEGION/Desktop/Bookconnect4_library/src/features/books/services/bookReviewService.ts>): validates exactly one allowed field, filters the update by book-entry ID and actor ID, requests the affected row and validates its identity/types. Error-free zero-row/mismatched responses cannot become confirmed cache values. Cache adoption uses returned server fields.
- Queued work carries an authenticated identity generation. Logout/switch/A→logout→A invalidate old work; same-actor token refresh does not. Dispatch checks current identity, pins that actor's current token on the individual request, subscribes an AbortController to identity loss, and checks identity again after the response. Book Details checks again before and after query cancellation; stale work cannot update cache, alert, or refetch a later session.

The original F02 hierarchy/retained actions and F03 named minimum-48dp Back remain. No OCR/crop, note-save gates, migration, global auth coordinator or legacy booksService implementation changed. The new service has one stable responsibility: actor-bound retained-review field updates and their confirmations.

Aborting cannot undo a request already accepted by the server. These client guards prevent wrong-session credentials/stale local adoption; they do not provide server transaction cancellation or cross-device concurrency protection. No durable draft/restart recovery was introduced.

## Verification actually executed

| Check | Fresh result |
|---|---|
| Behavioral RED against unchanged application | **17 failed / 2 passed**, 19 tests, exit 1, 14.686s |
| Initial implementation, same scenario set | **19/19 PASS**, exit 0, 8.363s |
| Final affected-area verification | **6 suites / 116 tests PASS**, exit 0, 30.048s |
| Scoped TypeScript, now including current app correction tests | **PASS**, exit 0 |
| Fresh single-worker Expo web export | **PASS**, exit 0; [bundle identity](./build-identity.json) |
| Full TypeScript | **FAIL**, exit 2, same 37 diagnostic headers as prior FR01 receipt; no added/removed diagnostic header |

The initial scoped compile caught SDK builder method ordering: `abortSignal` must precede `single` to preserve the installed builder's static API. This was corrected without a cast; the final scoped compile and affected tests ran afterward. Logs include existing deprecation/Clipboard and deliberate legacy service error-path console output; no warning-free claim.

Final suites: current Book Details **27**, mounted ManualNoteJourney **21**, unchanged legacy booksService **45**, note navigation **6**, manual-note delete gates **7**, manual-note gateway **10**. Main correction tests execute the actual component, real QueryClient, real auth store/identity-generation subscription, real new service and installed Supabase JS/PostgREST SDK. Only HTTP and unrelated native/feature surfaces are simulated.

Coverage includes one-field HTTP bodies; private success/failure followed by queued text after reopening; rejected text followed by privacy/rating without implicit retry; A→B→A newer typing; multiple waiting text submissions; rapid explicit visibility across reopening; same-screen rating queueing and inherited busy feedback; queued actor switch/logout/return; pinned tokens/abort; same-actor token refresh; identity loss while cache cancellation awaits; null/wrong-book/wrong-owner affected rows; independent book state; and invalid patch rejection. The HTTP double deliberately can finish after abort, proving stale results are still fenced.

The previous 17 correction tests assumed full review payloads. Their underlying F01/FR01/F02/F03 scenarios were migrated to the approved field-patch contract and expanded to 27 current cases, rather than keeping assertions requiring the rejected coupling. The RED version includes a temporary legacy boundary so the unchanged component's full payloads could fail behaviorally; that bridge was removed from the final tests. [Archived RED test source](./red-tests.tsx.txt) and [RED results](./red.json) preserve that proof. The mounted journey's single retained-review assertion now checks an explicit visibility-only patch. Scoped TS adds the current app test file; no exclusions were widened.

[Final results](./focused.json), [focused output](./focused.log), [RED log](./red.log), [scoped compiler output](./tsc-scoped.log), [full compiler output](./tsc-full.log), [export log](./export.log), [source hashes](./source-hashes.json).

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath 'app/(tabs)/library/__tests__/book-details-corrections.test.tsx' src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/services/__tests__/booksService.test.ts src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx --json --outputFile=.tmp/sdd06-review-fields-20261016/focused.json
node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/expo/bin/cli export --platform web --max-workers 1 --output-dir .tmp/sdd06-review-fields-20261016/web
```

Full compiler failures remain historical archived NoteCrop evidence, Store View E2E typing, and Supabase `.ts` extension imports. Whole Jest was not rerun for this bounded pass; prior collector/stale-fixture/Marketplace failures remain open in the [earlier correction receipt](../sdd06-f01-f03-corrections-2026-10-16/README.md). No whole-repository-green claim. Browser/native/physical-device/TalkBack/live Auth/PostgREST acceptance were not executed. The export used no dotenv, dummy localhost backend and development configuration; no server was launched.

## Read-only database and SDK evidence

Fresh MCP get_project reverified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. A SELECT-only catalog query read existing `public.user_books` fields and SELECT/UPDATE policies. [Recorded metadata](./schema-readback.json): id UUID NOT NULL; user_id UUID, rating integer, review text and review_is_public boolean nullable; RLS enabled; own-row SELECT USING and UPDATE USING/WITH CHECK use `auth.uid() = user_id`, roles PUBLIC. No grants, effective-role denial or business-row audit was performed. No migration or schema adjustment was needed or created.

Official [update documentation](https://supabase.com/docs/reference/javascript/update) and [per-request header documentation](https://supabase.com/docs/reference/javascript/using-modifiers-setheader), plus installed SDK source, informed the owner-filtered returning-row and pinned-header implementation. The changelog fetch was unavailable through the available fetch routes; no claim was made that a changelog scan succeeded. Installed `fetchWithAuth` preserves an explicitly supplied Authorization header; the synthetic SDK tests verify the actual outgoing header and abort signal. No credentials are stored in query mutation variables or evidence; tokens in test code are synthetic fixtures.

## Closeout and exact next action

Next action: independent review of this bounded field/session correction, its 27 current SDK-backed cases and failure-policy traceability. F04–F06 and full native/release acceptance remain open. Manual note persistence stays **ON HOLD**, all four MANUAL_NOTE_WRITE_GATES false. R20 retained book-review writes are separate from those reading-note gates.

Changed application/config scope: Book Details, new bookReviewService, current Book Details correction tests, one mounted journey assertion/mock, and scoped TS inclusion of the app tests. Owning SDD/decision ledger/traceability, Library tracker/interaction inventory, Phase 9 separate-Library tracker/log and read-only data audit/dictionary were updated. Original receipts remain historical. No dependencies, auth coordinator, existing migration or note gateway changed.

All changes are local/uncommitted alongside preserved user changes. Nothing staged, committed, pushed, deployed or applied. Database/Storage/provider mutations: none; MCP reads only.

Final [continuity validation](./continuity.log) PASS: 195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown files. Relative links across the current receipt/SDD/Library tracker/interaction inventory resolve. All seven recorded source/config hashes match. `git diff --check` PASS with existing LF/CRLF advisories; staged diff empty, exit 0. Gate source readback confirms all four flags false. Active Library and Phase 9 trackers re-read with the exact independent-review next action. No browser, emulator or background server started in this correction pass. Cohesive documentation responsibilities and historical receipts were preserved rather than pruned for advisory line counts.
