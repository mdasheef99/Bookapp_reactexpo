# SDD-03: Library OCR 500w → Note + Saved Pages Vault

**2026-10-09 UI-plan separation:** [SDD-06 revision 0.2](./SDD-06-after-book-entry-ui.md) owns the proposed notes-first after-book-entry UI, with units SDD06-01–SDD06-07. It reuses only relevant capture/crop/review contracts here; OCR U0–U6 meanings/statuses remain unchanged. OCR U3 still means durable unfinished-capture recovery and is pending. Standalone passage creation/cloud remain deferred in the current UI scope; no reachable legacy retry or error copy may override cloud deferral when that UI is implemented. Existing Saved Pages access is preserved, and broader hybrid/search/export/resurfacing/recovery acceptance is not completed by the UI plan.

**Status:** vault database live; OCR UI/services partially implemented; bounded Android offline native smoke verified, full native/cloud acceptance pending. Expanded product plan approved for documentation on 2026-10-05; further units and deployment remain separately authorized.
**Current plan authority:** section 10 supersedes conflicting historical targets below. Sections 1–9 preserve the August baseline and dated evidence, not current completion or migration authority. Correct live hardening version is `20260820071215`.
**U0 checkpoint (2026-10-06):** integration/contract preflight complete; [U0 report](./OCR-U0-PREFLIGHT.md) owns pinned 1.5.2 API/model evidence and selected response, quota and draft-storage designs. Installed package is now present; its default export/object result mismatch is proven by a stub-native wrapper diagnostic. U1 local corrections are now recorded in section 11; U1 runtime acceptance and U2–U6 remain pending. Bounded Android English offline service/module execution is now verified in section 11; broader native acceptance and cloud execution remain pending.
**Date:** 2026-08-20 (updated 2026-08-20 hardening + OCR wiring)
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo` @ `main` `15243d8` `C:/Users/LEGION/Desktop/Bookconnect4_expo`
**Git base:** `15243d8` + `SDD-01-hardening 20260820033938/20260820034004 live orphan 0, cache filters|startIndex|maxResults:14` + `SDD-02-notes 64 lines reading_notes 2 FK CASCADE NOTE_TAG_CONFIG 4`
**Scope:** `user_book_pages` private vault + `OCR 500w -> NoteEditor` hybrid ML Kit, reusing `app/(tabs)/library/[bookId].tsx:48` notes preview, `src/features/books/services/notesService.ts:52`, `src/components/notes/NoteEditor.tsx:30` — no marketplace, no `CODEBASE_INTELLIGENCE` write

## 1. Decision
Add **Saved Pages vault** (`user_book_pages 800/4k`) private per `user_book_id` and **OCR 500w cap → Note** that reuses existing `NoteEditor tag + page_number` flow. Hybrid: ML Kit Text Recognition v2 on-device `en 12MB` primary; Cloud Vision fallback for `hi | kn | ml` (Hindi/Kannada/Malayalam). Enforce word caps client + RPC/DB. Docs only now; migration next session.

## 2. SOT Evidence (live re-verified)

**Counts:** `user_books 11 | reading_notes 2 | books 14` `orphan 0` (`SELECT COUNT(*) LEFT JOIN reading_notes.user_book_id NOT IN user_books`); `reading_notes` RLS 4 `auth.uid()=user_id`, constraints `FK user_book_id->user_books ON DELETE CASCADE:9`, `btrim(content)<>''`, `page_number>0`, `tag 4` — vault inherits same private ownership model.

**Reuse points:**
- `notesService.ts:84 createNote(userId,userBookId,content,tag,pageNumber?)` trims, `110 updateNote` sets `updated_at ISO`, `52 getNotesForBook order created_at DESC`
- `[bookId].tsx:104 saveNoteMutation` branch `editingNote ? updateNote : createNote` + `invalidateQueries ['notes',bookId]`; preview `slice(0,3):101`
- `NoteEditor.tsx:30` modal `content/tag/pageNumber` `TagSelector:143` `placeholder per tag` `pageInput number-pad maxLength 5:204` `canSave !trimmed:80` — OCR will prefill `content` + `pageNumber` + default `tag=quote`, user still picks `quote|reflect|distill|apply` before save

**Verification pre-SDD-03:** `npx jest --runInBand --testPathPattern "notesService|booksService"` **48 passed** (12 notes + 36 books), `npx tsc --noEmit --skipLibCheck | Select-String library|notes 0` Library clean (global fails only `e2e/store-view:29` + `imageInventory TS5097`).

## 3. New Table `public.user_book_pages` (live `20260820064258` + hardening `20260821100001`)

```sql
id uuid PK DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
user_book_id uuid NOT NULL REFERENCES public.user_books(id) ON DELETE CASCADE,
page_number int NOT NULL CHECK (page_number > 0),
content_excerpt text NOT NULL CHECK (char_length(content_excerpt) <= 800),
full_text text NOT NULL CHECK (char_length(full_text) <= 4000),
word_count int NOT NULL CHECK (word_count >=0 AND word_count <=800) + CHECK word_count = wc(full_text) + CHECK check_page_word_limit(full_text),
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now(),
UNIQUE (user_book_id, page_number)
-- indexes: user_id, user_book_id, (user_book_id, page_number) live
-- RLS 4: SELECT/INSERT/UPDATE/DELETE USING/WITH CHECK (auth.uid()=user_id) live
-- CHECK 500w reading_notes.check_note_word_limit(content) live
-- TRIGGER enforce_user_book_pages_owner live: user_id must = user_books.owner
-- no anon, no marketplace, private vault only
```

*Applied locally as `supabase/migrations/20260820064258_library_user_book_pages_vault.sql` (renamed from `20260821000001` to match live ledger) + `supabase/migrations/20260821100001_library_word_limit_hardening.sql`.*

*Limits:* `content_excerpt 800 chars` ≈ first page preview / card; `full_text 4000 chars` ≈ ~500-600 words hard DB cap; `word_count` computed client `split(/\s+/).filter(Boolean).length` + re-checked RPC `array_length(regexp_split_to_array(btrim(full_text),'\s+'),1)`.

## 4. OCR 500w → Note

**Hybrid:**
- Primary: `@react-native-ml-kit/text-recognition` on-device Latin `en` (~12MB model, offline, no network, no bucket). Language hint `en`.
- Fallback: `supabase/functions/ocr-fallback` (Cloud Vision `TEXT_DETECTION`, `hi|kn|ml` hint) only when on-device confidence low or script detected outside Latin. No `inventory-photos` bucket reuse; image stays in memory or `expo-file-system` cache, not persisted unless user saves to vault.

**Flow `[bookId] -> OCR`:**
1. Camera `expo-image-picker` -> ML Kit `recognize(imagePath)` -> `rawText`
2. Client cap: `words = rawText.trim().split(/\s+/).slice(0,500).join(' ')` — if >500, truncate + toast `Truncated to 500 words`; if empty -> error
3. Prefill `NoteEditor` `content=words`, `pageNumber` (user entered or ML Kit block `page` heuristic), `tag default quote` — user can retag before save
4. `NoteEditor onSave` -> `notesService.createNote(...500w content...)` existing RLS/FK `btrim(content)<>''`; note path enforces `word_count_500` via client + RPC `check_note_word_limit(p_content text) RETURNS boolean` `CHECKS word_count <=500` before insert
5. Optional `Save to Vault` button in editor: `upsert user_book_pages(user_book_id,page_number,full_text=words,content_excerpt=words.slice(0,800),word_count)` `ON CONFLICT (user_book_id,page_number) DO UPDATE` — same `800/4k` limits, owner RLS

**Word limits enforcement:** client pre-cap 500w (note) / 800w-equivalent 4000 chars (vault) + RPC `check_*` re-validates server side; DB `CHECK`s are final hard stop. No client-only trust.

## 5. Contracts + Invariants

1. Vault private `auth.uid()=user_id` all CRUD; FK `ON DELETE CASCADE` both `user_id` and `user_book_id` — deleting `user_books` cascades vault + notes, orphan 0.
2. `UNIQUE (user_book_id,page_number)` prevents duplicate page saves; upsert is idempotent.
3. OCR text never auto-saves — user must tap `Save` in `NoteEditor`; truncated text is visible before save.
4. On-device `en` first, cloud only for `hi|kn|ml` fallback — cost/privacy minimal; 12MB model lazy-download or bundled.
5. No marketplace touch: no `store_inventory`, no `marketplace_book_listings`, no commerce RPC.

## 6. Verification (reconciled 2026-08-20)

- `user_book_pages` live `20260820064258` 5 indexes, 4 RLS `auth.uid()=user_id`, FK CASCADE, `UNIQUE`, `CHECK 800/4000`, `CHECK word_count_match`, `TRIGGER ownership`, `vault_count 0 vault_orphan 0 orphan 0`
- `reading_notes_500w_check` live — `INSERT repeat('w ',501) → 23514 reading_notes_500w_check`, `vault 801w → user_book_pages_800w_check`, forged `word_count 0 → word_count_match`, `owner mismatch → vault owner mismatch`
- RPC `check_note_word_limit 500 true/501 false`, `check_page_word_limit 800 true/801 false`
- `@react-native-ml-kit/text-recognition ^1.5.0` in `package.json` + `app.json` plugin, `supabase/functions/ocr-fallback/index.ts` `verify_jwt` Cloud Vision fallback
- `NoteEditor` wiring `languageHint hi|kn|ml` picker + `getPagesForBook` vault browse + `wasTruncated` banner (see §4)
- `npx jest notesService|booksService 48 passed` + `72/72` full, `tsc Library 0` (`36` pre-existing `e2e+imageInventory` only)

## 7. Out of Scope (now in scope via 20260821100001)

`user_book_pages` + word-limit hardening + OCR package/fallback implemented; remaining out: shelf `getHighResCoverUrl:112`, `viewMode`, `useTheme`, marketplace, `CODEBASE_INTELLIGENCE` write.

## 8. Deferred Native Build (2026-08-20)

`@react-native-ml-kit/text-recognition` is installed `package.json:60` `app.json:29` but `Expo Go` `host.exp.exponent` `BookConnect_Pixel5_API36` cannot load native `12MB` - `ocrService.ts:29` `ON_DEVICE_UNAVAILABLE` falls to `supabase/functions/ocr-fallback` `404` not yet deployed for `hi|kn|ml`. `Scan Page` works only in `Dev Client` `npx expo run:android` / `eas build --profile development`. Defer `ocr-fallback` deploy + Dev Build test to next session.

**2026-08-21 review corrections:** `NoteEditor` gates Scan in Expo Go via `Constants.appOwnership/StoreClient` + Alert guidance (manual paste still works); all OCR/vault failures now Alert instead of `console.error`; camera capture is downscaled `expo-image-manipulator ~14.0.8` `resize 1600w JPEG q0.6` before cloud base64; `inferIndicScriptHint` sends detected Devanagari/Kannada/Malayalam script as cloud `languageHints` when an `en` scan returns non-Latin; over-limit vault text is trimmed client-side at word boundaries by `capToVaultLimits` (800 words AND 4000 chars, surrogate-safe) with a user notice instead of a rejected save — DB CHECKs remain the hard stop.

## 9. Next

`SDD-04 Shelf Stitch + viewMode + 3 themes daylight/golden/midnight + Reading zones bento`.

## 2026-10-05 — Read-only Library OCR status investigation

User requested investigation, not implementation/deployment. Exact Supabase MCP project readback: Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY. Live migration history confirms vault 20260820064258 and hardening 20260820071215 (the old SDD-03 20260821100001 label is stale). user_book_pages has RLS enabled, four owner-scoped CRUD policies, ownership/update triggers, unique book/page, cascade FKs, excerpt/full-text/word-count constraints; reading_notes retains its word-limit check. No business content was read or mutated. Deployed Edge function listing contains no ocr-fallback.

Local NoteEditor wires camera capture, language selection, compressed JPEG/base64, OCR prefill, explicit note/vault save, alerts and Expo Go gate. OCR service implements on-device-first plus cloud fallback, 500-word note cap; vault service fits 800 words/4000 characters. ML Kit is declared in package.json but absent from this checkout's node_modules. app.json has no ML Kit plugin entry despite the historical SDD claim; this discrepancy needs native-build validation, not an assumed plugin fix. Cloud source returns empty success without GOOGLE_VISION_API_KEY; the handler checks Authorization presence and relies on deployment JWT validation. No explicit ocr-fallback config section exists locally. Cloud truncation metadata is not preserved by the client wrapper; empty on-device recognition does not trigger fallback. These are source-review findings, not reproduced device failures.

Fresh explicit-path Jest: 4 suites / 33 tests PASS (ocrService, ocrWordCap, userBookPagesService, libraryUserBookPagesVault). OCR/provider tests use mocks; migration suite is a source contract, not a live write test. Initial pattern invocation selected unrelated suites and was interrupted; only the explicit-path result is scoped evidence. Real camera/native OCR, cloud provider inference and authenticated scan-to-save remain NOT_RUN. Prior browser vault smoke is fixture-backed.

Assessment: database vault live; UI/service scaffolding implemented locally; end-to-end OCR incomplete. Exact next OCR action: bounded native dependency/API and fallback review before separately authorized development-build/provider/deployment verification. Current Library feature work unit and marketplace authorization remain unchanged. No code/dependency/migration edit, database/Storage/provider mutation, stage, commit, push or deployment occurred. Existing mixed changes preserved; this audit appends documentation only. Marketplace live Edge listing reports owner-ingestion v14 rather than historical router v8; no marketplace implementation or reconciliation is attempted in this Library investigation.

## 10. Expanded capture and reading-memory plan (2026-10-05)

### 10.1 Authority, purpose and current baseline

The user approved adding all seven proposed improvements to this plan: passage selection, gallery import, crop/rotation, unfinished-capture recovery, personal capture search, passage resurfacing, and attributed export. This is documentation approval only. No application implementation, package installation, migration creation/application, provider call, deployment or Git publication is authorized by this update. AI summaries, flashcards, semantic search and notifications are future candidates, not included implementation units.

Purpose: capture a passage accurately, preserve the reader's own interpretation, find it later, and revisit it without requiring another scan. Reuse private Quote/Reflect/Distill/Apply notes and the per-book text vault. Catalogue Search remains separate from searching personal captures. The vault stores text, not photographs or complete books; describe it as saved passages/page text in new UI. Do not imply an original-page archive.

Baseline: live vault and hardening migrations are 20260820064258 and 20260820071215; native/cloud end-to-end OCR remains unverified. The 2026-10-05 audit above owns fresh readback and 33 mocked/source-contract tests. Planned requirements below are all PENDING, regardless of baseline code existence. Do not treat historical app.json plugin, 12MB, native installation or deployment claims as verified.

### 10.2 Reader flow

Book detail or per-book Notes -> Capture text -> Camera / Choose photo / Paste -> crop/rotate photo -> Extract on device where supported -> review full bounded extraction -> select/edit passage -> optional entered page number and note category -> Save note or Save passage. A visible Retry with cloud action explains image upload and requires explicit consent. Saved passage detail provides full saved text, source book/page, edit/delete, copy/export, and open-book actions. Unsaved recovery is a separate local draft, never a saved note or queued server write.

Home gains a quiet From your reading card and a separate Search my captures entry after their units pass. Search results and resurfaced cards open the exact note/page record and its source book. No new app-level tab is introduced. Reader-facing labels omit model size, provider internals and build commands; unavailable scanning offers gallery/paste or a useful capability message.

### 10.3 Requirements and acceptance traceability

| ID | Planned behavior | Acceptance evidence required |
| --- | --- | --- |
| OCR-P01 | Hybrid local-first extraction for supported scripts; cloud is explicit for unsupported scripts, empty output, local failure or reader-requested retry. Hindi local recognition is optional only after wrapper/model validation; Kannada/Malayalam use cloud. | Real English local/offline capture; unsupported-script routing; no image transmission before consent; cloud refusal preserves draft; model-unavailable and empty-output fixtures. |
| OCR-P02 | Camera, gallery and paste enter the same review flow. Request only necessary permissions; cancel/deny leaves existing editor text intact. New capture replacing typed text requires confirmation. | Camera/gallery denial/cancel, invalid image, replacement Cancel/Confirm, web/native capability states. |
| OCR-P03 | Crop and rotate with original retained temporarily for Reset; extraction uses the chosen crop. Downscale without enlarging small images; retain enough detail for dense print. Evaluate Android ML Kit Document Scanner against a cross-platform crop approach before selecting an integration. | Rotation/crop/reset, facing-page exclusion, small/large images, orientation metadata, representative low-end-device memory. No scanner SDK chosen from documentation alone. |
| OCR-P04 | Review the full extraction up to a bounded 20,000 Unicode-code-point review limit; disclose overflow and offer recrop or partial review. Select/edit text with accessible text controls; paragraph shortcuts only when reliable structure exists. Never silently select only the first 500 words. | Wanted passage near page end remains selectable; over-limit review notice; selection/edit/count, Unicode Indic text, keyboard/screen-reader operation. |
| OCR-P05 | Separate save previews enforce note <=500 whitespace-delimited words; vault <=800 words AND existing 4000-character DB limit, excerpt <=800 characters. Over-limit content needs reader editing/selection; optional Fit to limit requires an explicit action and visible preview. | 500/501 and 800/801 boundaries, 4000-character boundary, Unicode/surrogate safety, preserved original draft, DB rejection retains text. Match existing DB length semantics before implementation. |
| OCR-P06 | Source book identity comes from the owned Library entry. Page number is optional for notes and required/positive for vault. Never guess a citation page; detected suggestions need confirmation. Tag defaults to Quote for scans and remains editable. | Unknown page labeled not supplied; invalid page rejected; exact user_book_id binding; category edits retained. |
| OCR-P07 | Same book/page vault save asks before replacing an existing passage, showing old/new previews. No duplicate saves from repeated taps; note and vault are separate explicit saves with separate outcomes. | Replacement Cancel/Confirm; repeated taps; network uncertainty/refetch before retry; one save succeeds while the other fails without losing draft. Concurrent overwrite protection requires schema/API review. |
| OCR-P08 | Recover one bounded device-local draft per account/book, including selected text, bounded extracted text, category, page and source type; explain device-only recovery. Retain across editor close/app restart and failed save, offer Resume/Discard, expire after 7 days, clear after successful save or explicit discard. No photo/base64 persisted for recovery. | Restart/resume, failed storage/save, expiry, discard, logout/account switch isolation, removed-book cleanup; never auto-save recovered text to server. |
| OCR-P09 | Private Search my captures spans saved notes and vault text across owned books, with optional book/category/source filters, matched snippet and book/page attribution. Case-insensitive literal text first; preserve accents/scripts, no transliteration or semantic inference. | Matches outside first loaded page; pagination, empty/no-match/error, deletion refresh, Hindi/Kannada/Malayalam strings, cross-account denial; downloaded subset explicitly labeled if offline. |
| OCR-P10 | From your reading resurfaces one saved Quote/Reflect at a time, with source attribution and Open/Another/Revisit later/Hide controls. Distill/Apply expansion can follow review. No generated quotation, interpretation or notification. | Empty/single/many-item collections, deterministic rotation, exact record opening, edited/deleted record refresh, stable daily selection, hidden state, reduced motion and accessibility. |
| OCR-P11 | Copy attributed text and export a reader-selected set as UTF-8 plain text or Markdown. Include saved words, available book title/author, entered page and category; distinguish reflection from quotation. No automatic public sharing or fabricated bibliographic fields. | Preview, single/batch selection, missing author/page, Unicode/newlines, canceled share/file save, failed clipboard, excluded private/unselected records. |
| OCR-P12 | Preserve original extracted wording apart from explicitly applied whitespace cleanup/editing; no automatic AI rewriting. Cloud failure, timeout, offline and cancellation preserve prior valid text; ignore late responses after a new capture or account change. | Retry/cancel races, logout mid-request, capture A/B race, transport/provider errors, original text fidelity. |
| OCR-P13 | Cloud backend uses DOCUMENT_TEXT_DETECTION with validated input/language, actual authenticated-user verification, bounded request/response, timeout, rate/cost controls and content-free diagnostics. Missing configuration fails clearly; no empty-success stub in release. | Auth/no-auth/invalid-JWT, payload limits, malformed/provider-error response, quota/timeout, missing key, logs contain no text/images/secrets. |

### 10.4 Search, draft and resurfacing decisions

Search scope is saved content only; unsaved drafts are excluded. A bounded paginated all-owned-record search is required, not client filtering of an arbitrary first page. At implementation preflight compare existing REST capabilities with a private search RPC. Any new RPC/index/migration is a separately reviewed proposal with exact-project verification and both worktree trackers checked. Search highlights must render text safely. Offline search uses only deliberately cached records and discloses incomplete coverage; no promise of full offline vault replication.

Draft persistence is a convenience, not secure archival storage or cross-device sync. Use an account-scoped storage abstraction; do not claim encryption for AsyncStorage. Native storage protection and web local-storage exposure need an explicit implementation review. If suitable storage is unavailable, preserve in-session text and disclose that restart recovery is unavailable. Bound and version payloads, reject malformed drafts, clear account content on logout, never restore another user's draft. Book removal must invalidate associated draft/cache/history.

Resurfacing v1 is device-local and quiet: exclude hidden records and records snoozed for 7 days; choose the least-recently-shown eligible record, tie-break by saved timestamp and ID; keep it stable for the local calendar day until Another or a content change. Record displayed IDs/times only; cap history at 200 IDs, with older entries eligible again. Avoid repeats within 7 days when alternatives exist; with one item, permit repeating and never fabricate another. A global Hide from your reading preference disables the card; preferences are account-scoped/device-only, cleared on logout. No push notification, streak, AI embedding, provider inference or background polling is required. Do not label global usage metrics as measured retention benefit.

Export is explicit outbound disclosure chosen by the reader. Preview exact selected text and attribution before invoking OS share/file save. Source identity must follow the owned entry's available edition record; never invent publisher/date/ISBN. Generic text export is not a formal citation generator. Do not automatically export original images or unselected reflections.

### 10.5 Privacy, retention and resource boundaries

Camera/gallery originals and crops remain in bounded session/cache files and are cleaned on completion/cancel where app-owned; never delete the user's gallery original. Crop is the image sent to cloud after consent. No image bucket or original-photo archival feature is added; vault Save persists selected text only. Review output is capped at 20,000 code points; initial implementation target is <=2 MiB decoded cloud image, <=1 MiB provider response and <=100 KiB serialized draft, validated before transmission/persistence. Never silently destroy current text to satisfy a bound. These targets need representative page/device verification and may be revised with documented evidence.

Cloud target: one user-triggered request at a time, 30-second timeout, no automatic retry/billable duplicate on failure; explicit retry after actionable error. Initial abuse-control target: 10 cloud scans/minute and 100/day per authenticated user, with a project-level usage/budget ceiling and a disabled-cloud switch. Quota exhaustion preserves local/paste functionality. Server-enforced quota storage and atomic concurrency design must be selected in U0; limits are planned, not live. Never expose Google credentials to the app. Validate content length/decoded bytes, supported language, provider application-level errors and cancellation lineage; sanitize errors and avoid text/image/secret logging.

SDK estimates are not installed RAM or measured application size. Google documents Android bundled ~4 MB per script/architecture, unbundled ~260 KB app increase plus downloaded model; iOS ~38 MB per script SDK. Select bundled/unbundled only after checking wrapper support and availability behavior; record real release download/install delta, first-use delay, warmed latency and peak memory. English does not require adding every script. Image quality is part of the benchmark, not an assumed cloud accuracy advantage.

### 10.6 Ordered implementation units and release gates

| Unit | Bounded deliverable | Exit gate |
| --- | --- | --- |
| U0 | Reconcile native wrapper/API/dependencies, capability matrix, response contract, cloud consent/auth/quota design, storage abstraction and schema needs. | Reviewed source-vs-target matrix; exact next local unit; no assumed native plugin fix; migrations/deployment separately authorized. |
| U1 | Complete reliable hybrid extraction, explicit cloud retry, document OCR contract and preserved bounded full review text. | Focused behavior/security tests; approved development build; real English offline and hi/kn/ml cloud evidence when deployment/provider calls are authorized. |
| U2 | Camera/gallery/paste, crop/rotation, passage selection, correct save previews and full saved-passage detail/edit/overwrite flow. | Real selection near page end, limits/overwrite/error recovery, permission/cancel/accessible input checks. |
| U3 | Device-local unfinished-capture recovery and lifecycle cleanup. | Restart/expiry/account isolation/storage failure/removal tests and native/web inspection. |
| U4 | Personal capture search and attributed single/batch export. | Whole-owned-corpus pagination/security proof, multilingual matching, export preview/selection/cancel/Unicode checks. |
| U5 | Quiet From your reading resurfacing using existing saved records. | Rotation/snooze/hide/delete/account isolation tests, truthful empty states, Home integration and native accessibility. |
| U6 | Final representative-device quality/resource review and release handoff. | Acceptance matrix with actual evidence, residual risks, rollout/disable path and no NOT_RUN converted to PASS. |

Build each unit without advancing marketplace phases or changing Shelf arrangement/catalogue behavior. Original plan sequencing began with U0; the current authorized checkpoint and exact next action are recorded in section 11 and Library TRACKER. Existing native/deployment blockers remain. Do not bundle a schema change into UI work. Reuse existing vault/notes permissions; future search or concurrency changes need their own live read-only preflight and ledger.

Benchmark a consented fixed set of at least 5 printed-page images per target language (English/Hindi/Kannada/Malayalam), including clean and difficult lighting, small print, skew/facing-page cases. Include mixed script and a passage beyond word 500. Compare local/cloud only where both support the script, against manually transcribed ground truth: character/word error rate, lost/extra lines, reader correction effort, cold/warm median and p95 latency, provider cost, download/install delta, peak memory. Report device/network/image conditions. Accuracy/latency release thresholds must be set after the baseline and before U6 sign-off; do not claim a universal accuracy percentage. Run representative low-end Android offline/reconnect, denied permissions, cancel/back, account switch, large text and screen-reader checks. Web and iOS get explicit supported/unsupported matrices; Android evidence cannot sign them off.

### 10.7 Sources and plan verification

- [Android ML Kit OCR size, scripts and image guidance](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [iOS ML Kit OCR](https://developers.google.com/ml-kit/vision/text-recognition/v2/ios)
- [Android document scanner capabilities](https://developers.google.com/ml-kit/vision/doc-scanner)
- [Cloud document OCR](https://docs.cloud.google.com/vision/docs/ocr) and [languages](https://docs.cloud.google.com/vision/docs/languages)
- [Cloud Vision pricing](https://cloud.google.com/vision/pricing): first 1,000 units/month free, then $1.50/1,000 in the next tier as checked 2026-10-05; backend costs additional. Recheck before provisioning. Resurfacing's high-value/low-effort ranking is a product hypothesis, not measured retention evidence.

Traceability: OCR-P01–13 own planned acceptance; this section owns behavior; UI-UX-INVENTORY and INTERACTION-MAP route only to planned flows. Library TRACKER owns execution status; Phase 9 scoped log records documentation continuity without marketplace advancement. This plan remains cohesive: capture, recovery and later reuse share the same private-record lifecycle; no line-count split is needed.

## 11. U1 local correction checkpoint — 2026-10-06

User authorized local corrections and image testing. Implemented behavior supersedes the historical automatic fallback/capped extraction descriptions above: English Latin local recognition uses ML Kit 1.5.2 default export/object result, bounded 20,000-code-point review, safe errors/deadlines and stale-result cancellation. hi/kn/ml do not silently use Latin locally; explicit per-image cloud retry is required. Editor changes/close/account changes invalidate pending capture work. Cloud retry replaces editor text only after confirmed upload and successful current-capture response. Over-500-word notes are rejected without silently slicing; oversized vault input is not enabled for save. Passage selection and complete vault overwrite review remain U2.

Cloud contract version 1 contains requestId/imageBase64/languageHint and responds with provider/reviewText/reviewOverflow. Backend verifies the bearer identity and reserves durable quota before DOCUMENT_TEXT_DETECTION egress. No adapter is provisioned in the entrypoint: cloud remains disabled. Credential, quota migration and deployment are separate authorization boundaries.

Traceability: OCR-P01–13 remain the acceptance authority. U1 local behavior tests pass (59 total across six OCR/vault suites), but native/provider acceptance is pending. Google sample input validation passes; actual recognition was not executed because the booted emulator has Expo Go only. [Evidence and exact next action](./ocr-evidence-20261006/README.md). U0 is complete, U1 partially complete, U2–U6 pending. No schema/Storage/provider mutation or marketplace advancement.

### Android offline native checkpoint — 2026-10-06

OCR-P01/P12 U1 bounded module/service smoke PASS on Android16/API36/x86_64 emulator with new architecture enabled. Development-client build/installation succeeds; actual offline Google sample recognizes main sign with graphic noise ZNNZ and merged TURNOFF (2664/1052/1044ms). [Recorded output and limits](./ocr-evidence-20261006/README.md). Earlier native NOT_RUN evidence is superseded only for this exact English service/module fixture. Printed pages, camera/editor saves, physical hardware/iOS/other scripts and cloud acceptance remain pending. No automatic correction or universal accuracy/latency claim. Development package com.bookconnect.library.dev does not approve production identity; all five wrapper scripts still bundled. U1 remains partial, U2–U6 pending; quota migration design needs separate review. No new product behavior beyond the previously authorized U1 contracts.


## 2026-10-06 — Authorized OCR review fixes R1/R2

Scoped unit `library_ocr_u1_two_review_fixes_verified_cloud_deferred`. R1: static development package removed from app.json; app.config.js resolves local/development to com.bookconnect.library.dev. EAS_BUILD_PROFILE takes precedence over EXPO_PUBLIC_APP_ENV. Preview/production require BOOKCONNECT_ANDROID_RELEASE_PACKAGE, validate identifier format and reject the development identity; unknown profiles fail closed. No approved release identity is invented. These profile configuration gates also apply when resolving config for other platforms; approving/providing the release Android identity is required before release-profile preparation. Development resolution remains the identity of the prior native smoke.

R2: reviewOverflow is independent of note/vault length limits. Banner truthfully discloses first 20,000 Unicode code points (characters), missing text, and smaller recapture. Both save controls and handlers block until Use partial OCR text -> explicit confirmation. Confirmation never autosaves, editing requires fresh acceptance, stale confirmation callbacks are ignored after edit/close/account/book/unmount/new extraction. Existing note 500-word and vault 800-word/4,000-character limits remain. Regression RED: two new editor cases failed and six previous cases passed before source changes. R3 already-aborted cloud request remains OPEN/DEFERRED by explicit user direction; cloud handler/service unchanged in this correction and current cloud entrypoint remains disabled.

Exact next authorized action: report R1/R2 correction evidence. U1 remains partial; full camera-to-save/native device matrix and U2–U6 pending. Marketplace Phase9 Unit7C/M46 and DOC13/ACTIVE unchanged. No database/Storage/provider call or write, migration, dependency change, native rebuild, staging, commit, push or deployment. Existing mixed changes preserved; all changes uncommitted.


R1/R2 verification: seven exact-path Jest suites /66 tests PASS. Actual @expo/config readback: development resolves com.bookconnect.library.dev; preview/production reject absent release identity and resolve com.example.approvedfixture only when explicitly supplied for the test (fixture is not an approved product identity). Root TypeScript:36 pre-existing E2E/Phase9 diagnostics, zero OCR/NoteEditor diagnostics. Phase9 continuity PASS (195 definitions, zero duplicate/missing traceability,76 Markdown files); git diff --check PASS and staged diff empty. Long established logs remain cohesive dated evidence; size notices are advisory. Fresh native rebuild/camera-to-save and live cloud/provider testing NOT_RUN. No database/Storage or external mutation. Web export result recorded separately below when complete.

Fresh correction web export PASS (2,342 modules; 5.48 MB entry), temporary BookConnect-ocr-review-corrections-web output; existing app preview not replaced. Native rebuild and rendered-device review of these two changes NOT_RUN. Final active unit/next action unchanged: report the completed R1/R2 fixes; R3 explicitly deferred, U1 partial. Nothing staged, committed, pushed, deployed or applied.
