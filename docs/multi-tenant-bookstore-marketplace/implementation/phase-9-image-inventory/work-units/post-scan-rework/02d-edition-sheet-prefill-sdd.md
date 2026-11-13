# Post-Scan Rework — Automatic Results in the Edition Sheet

| | |
|---|---|
| **Status** | **Pass-3 design refresh, 2026-11-12 (revision c). Units 1a and 1b BUILT and committed locally (`7600805`, `f10e431`; M100+M101 not applied); Units 2, 3 not built.** Written by the orchestrator after slice 8b/8c shipped. Migration application and deployment each need separate Owner approval. |
| **Parent** | [SDD-0 §4 PSR-D30](./00-overview-sdd.md#e-matching-and-lookup); [SDD-2 Slices 8–9](./02-catalogue-and-matching-sdd.md#slice-8--open-library-first-clues-google-off); [02c](./02c-slice8-open-library-first-sdd.md) §§4.3/5/7. |
| **Authority** | [OD-2026-10-30-4](../../../../DECISIONS.md#log) (ship after 8b, before slice 9; keep the search button); [OD-2026-10-31-5](../../../../DECISIONS.md#log) (language grouping); [OD-2026-11-12-1..3](../../../../DECISIONS.md#log) (this pass). D07/D10/D30/D35/D39/D40, R04/R06–R10; master §3 MAS-02/03/13–16; DOC-3 §5.2. |
| **Baseline** | Branch `phase9/02d-prefill` (after `c10832d`): 8b worker and 8c switch built, migrations through M99 in the tree; dev's automatic provider is Open Library, Google is off. Code read 2026-11-12 by the orchestrator. No live readback. |
| **Migration** | Unit 1a: M100 `20261112000100_marketplace_phase9_02d_prefill_save.sql` (local, not applied). Unit 1b: M101 `20261112000101_marketplace_phase9_02d_search_while_fresh.sql` (local, not applied). |
| **Size / risk** | Medium / high: receipt replay, expiry, client cache authority. No relaxed matcher or tie pick (slice 9). |
| **Review** | Pass 2 (2026-10-30): Terra round 3. Pass 3: Sonnet (FIX_NEEDED, applied in revision a); MiniMax M3.1 Flash and paid DeepSeek (both FIX_NEEDED, confirmed findings applied in revision b); Sol (FIX_NEEDED, 5 findings confirmed in code and applied in revision c: state-row insert, skip precedence, idle on invalidation, `queryLanguage` rollout, ACP-4 reachable cases). |

**Design** below means proposed, not implemented. `Mnn` is the file
`supabase/migrations/*0000nn_*.sql`; `I/` is `supabase/functions/_shared/imageInventory/`.
SQL citations are CURRENT definitions (`node scripts/phase9-sql-facts.js <name>`).

## 1. Goal and scope

When the automatic lookup has fetched a bounded edition list (≤10 rows) for a
card, save that list to the card's edition state in the same transaction that
completes the automatic lookup. Opening the edition sheet then shows it with no
new provider request. **Search Books**, **Search with saved title** and **Retry
search** stay as explicit searches against the current saved identity or typed
ISBN (D30, OD-2026-10-30-4; 01 SDD §4; 01a §§5/8–10). Saving rows never confirms
or selects an edition for the Owner and never changes Add rules.

Order: 8a → 8b → 8c (built) → **this unit** → stuck-processing-card fix (ACTIVE.md
row 11, Owner 2026-11-12) → slice 9. Slice 9 keeps relaxed automatic eligibility
and full D28 tie selection; D30 sheet persistence and AC9-4/5 belong here.

## 2. Current code (verified 2026-11-12)

| Evidence | Current behavior |
|---|---|
| M67:263–274 (structural assert, used by M94:49–51 and M93) | The automatic job can be claimed and completed only while the candidate is `processing`. |
| M65:198; M29:954; M99:144–146 | Owner search/select/ISBN, review save and the choices read need `ready`/`needs_review`/`possible_duplicate`. **These sets do not overlap: the Owner cannot act on a card while its automatic lookup runs.** |
| M93:1381–1384 | The automatic completion moves the card from `processing` to `ready` or `needs_review`. |
| M65:91–122; M68:7; M90:474–478; M90:390 | `phase9_candidate_edition_state`: private candidate/session/store, request ID/generation/query identity, options/version, source lookup/attempt/time/deadline, independent selection (`selection_id` M65:98); `failure_receipt` (M68:7). Options CHECK M90:474–478 via `phase9_edition_valid_rows_check_v1` (M90:468): exact keys, 0-based contiguous ordinals, unique UUIDs, ≤10, non-null URL for eligible/ineligible rows, null metadata and URL for unavailable rows (validators M90:390, legacy M90:437). FK `(request_id,candidate_id,store_id)` M65:102. No API table privileges (M65:122). |
| M85:180–200 `phase9_edition_source_policy` | Read shows fresh rows only if query/deadline/source policy agree. Branches on `execution_mode` + `adapter_key`; accepts `google_books` and `open_library` lookups; no explicit-search capability check. |
| M92:903 `phase9_complete_candidate_edition_options_v2`; session lock M92:925–926 | Explicit completion: saves source and options, advances `options_version` (M92:1111). |
| `I/runtime/metadataProductionGateway.ts:71` → `metadataAutomaticExecution.ts:77` | Automatic routing (8b). |
| M93:1028 private `phase9_complete_automatic_metadata_v1` (public INVOKER wrapper M92:1879); recovery M92:1422 | Lock order session `FOR KEY SHARE` → job `FOR UPDATE` → candidate (structural assert) → edition state `FOR UPDATE` (M93:1072–1095). Fence: stale lease/session/candidate/identity (M93:1080–1094) or changed generation/captured request (M93:1096–1098) → `stale_rejected`, zero writes. The digest hashes the whole command (M93:1062–1064), so it covers rows, companions and retention. Hook comment M93:1376; receipt hard-codes `prefill:{skipped,not_installed}` (M93:1389; M92:1822 is the superseded M92 completion body, not recovery; recovery M92:1422–1463 returns the stored receipt). Effect row records `request_generation`, `captured_request_id`. |
| M78:170–172 trigger, body M82:5–60 | `BEFORE UPDATE OF … state, review_disposition, owner_isbn13` on candidates: resets the edition state (generation+1, rows cleared, selection cleared) when the edition identity, ISBN or removal disposition changes. A `state`-only change keeps the identity. |
| `I/runtime/metadataAutomaticCompletion.ts:14–32,96–107` | Worker sends `result` v2 with `rows`, `catalogueCompanions`, `retention`. Receipt schema allows only `prefill:{skipped,not_installed}`; `decodeAutomaticReceipt` binds only lookupId/selectedOptionId/outcome. |
| M75:80 `phase9_request_candidate_edition_options_v1` (fresh short-circuit :116–126; exhausted-job peek and lock :102–107); read M75:24–60 wrapped by M78 | Explicit request creates a job only when neither pending nor fresh; clears rows but does **not** advance `options_version`. Read: exhausted explicit job → `failed` (`phase9_edition_job_exhausted`, M75:14); resolved + fresh → `ready`; else `failed`; no request → `idle`. |
| `queries/ownerEditionPickerCache.ts:36–44,73–77` | Client cache: an `idle`/`pending` read at the same generation+version is treated as regressing and the previous choices are kept; accepting a pending receipt keeps old rows and expiry. |
| `components/CandidateEditionPicker.tsx:60–61,71–74,99`; `queries/ownerEditionPickerQueries.ts:75–77,202–210` | Rows render when choices are fresh; Search Books renders when `(identityChanged || !fresh) && !pending`; lookup mutation and `pendingLookup` return `EditionLookupReceipt`. |
| `contracts/ownerEditionPicker.ts:65–104` (server and client) | Row keys optionId/ordinal/googleBooksUrl/eligibility/metadata, optional wire `rejectionReason` (:69, computed at read M78:427–435). Choices DTO has no query language. |
| `EditionOptionList.tsx:40,60`; `review/editionSelectionRecovery.ts:4–27` | 5/10 slicing, language as text, no groups; conflict copy incl. `editionLookupRecovery` (:19–27). |

## 3. Design — prefill inside the automatic completion (Unit 1)

A new private helper `marketplace_sec.phase9_prefill_automatic_editions_v1` is
called from M93's automatic completion **after** the candidate UPDATE at
M93:1381–1384, so the identity trigger (M78:170) has already run for that
UPDATE and cannot reset the just-saved list. Postgres-only: no client RPC, no
separate transaction, no best-effort write after terminal.

**What can overlap (no Owner command can, see §2).** While the card is
`processing`, only these can change: session close/expiry, card expiry (both
already `stale_rejected` by the fence, M93:1080–1094) and Owner removal, which
is allowed while `processing` (M54:306–313). Commit, search, edit, ISBN and
select cannot run until the completion has moved the card to
`ready`/`needs_review` (M67:268, M65:198, M29:954–956). The helper still keeps
defensive checks; it must never be the only guard.

| Field | Rule |
|---|---|
| State row | An untouched card usually has **no** edition-state row (the fence reads it with `coalesce`, M93:1095–1096). If absent, the helper inserts it (`INSERT … ON CONFLICT (candidate_id) DO NOTHING`, then `SELECT … FOR UPDATE` and re-check the fence values); a conflicting concurrent insert → skip `superseded`. Inserted values: `request_generation` = captured generation (0), `options_version` 1. An existing row is updated, never replaced. |
| candidate/session/store | From the locked rows; all supplied IDs compared. RLS is a backstop. |
| `query_identity` | Write the **fetched** identity (the locked lookup's `query_identity`). Require it to equal `phase9_edition_query_identity(c)` at write time (M78:10; equal for an untouched processing card); otherwise skip `identity_mismatch`. |
| `request_generation` | Equal to the captured generation; never incremented by prefill. |
| `request_id` | The real automatic job ID (FK M65:102). Only when the locked state has `request_id` NULL; any other non-null value → skip `superseded`. |
| `options` | Original ≤10 positions, ordinals = index, unique UUIDs, explicit sheet eligibility; unavailable rows keep UUID/ordinal with null metadata/URL. Pre-validate with `phase9_edition_valid_rows` (M90:390) and the CHECK contract (§2), so a bad list never reaches a raw constraint error. Malformed rows are already rejected at the completion entry (`phase9_auto_result_valid_v1`, M92:1299 via M93:1048) as `P9_AUTO_COMMAND_INVALID`; keep that, do not weaken it. No dedupe, filter or re-sort. |
| `options_version` | +1 for a newly saved list. |
| Source lineage | Original lookup/attempt, adapter/version/normalizer, microsecond-equal `fetchedAt`; companions bound to option UUID/record/digest. Nothing from another store. |
| `source_fetched_at`, `options_expires_at` | Source time; deadline = least(verified provider deadline, source time + 24 h, current registry/source deadline). No renewal. |
| Selection | Never set or changed by prefill. |
| Counts/spend/catalogue | Same transaction and effects as today; prefill adds no searched/selected/added/spend effect. |

**Helper skip rules (the automatic result still commits).** Checked in this
order; the first match is the receipt reason:

| # | Reason | When |
|---|---|---|
| 1 | `not_reviewable` | Card removed (`review_disposition` removed/skipped) or committed. |
| 2 | `selected` | The edition state already has the Owner's `selection_id` (M65:98). **Never** the automatic result's own `selectedOptionId`: a winning result is still saved. |
| 3 | `superseded` | The locked state has a non-null `request_id`, or the state-row insert conflicted. |
| 4 | `identity_mismatch` | Fetched identity differs from `phase9_edition_query_identity(c)`. |
| 5 | `no_retention` | No external adapter list in the result (local catalogue, cache, coalesced; M93:1137–1143 creates these without an adapter), or no verified retention evidence for the list (registry storage flag alone is not evidence). |
| 6 | `source_not_allowed` | An external adapter list whose adapter is not `open_library`; `google_books` is never saved, even if re-enabled. |
| 7 | `empty_unproven` | Empty list without truthful source/deadline proof. |

A skip never overwrites rows or a selection.

**As built (1a):** rule 5 means *absent* evidence (no external list, missing fetched/deadline, or registry storage off); rule 7 means evidence present but untruthful (Owner ruling during the 1a plan). The helper uses the registry row the completion already validated (no second registry read), so a registry change committed during the completion cannot roll back the automatic result (review finding F1, fix round 1). The eight-argument helper signature stays as a private defensive wrapper.

**Helper result** (inside the AutoReceipt `prefill` field):
`{status:'saved',requestId,requestGeneration,optionsVersion,optionsExpiresAt}`
or `{status:'skipped',reason:<one of the table above>}`. The receipt carries no
rows; the rows and UUIDs live in the edition state and a read returns them.
Receipts written before install keep `not_installed` and replay unchanged.

**Receipt widening sites (all in Unit 1a):** SQL M93:1389 (recovery replays the stored receipt unchanged); zod
`metadataAutomaticCompletion.ts:22,31–32`; `decodeAutomaticReceipt` (:96–107)
binds a `saved` prefill's `requestId` to `fence.jobId` and its generation to
`fence.requestGeneration`; tests and fixtures
`phase9_metadata_automatic_boundary_u5.test.ts:81`,
`phase9_metadata_production_composition.test.ts:448`,
`phase9_metadata_provider_retry.test.ts:71`, `__tests__/support/automaticB1.ts:37`,
`__tests__/support/automaticWorker.ts:81`,
`supabase/tests/phase9/phase9ProviderRollout.integration.test.mjs:185`.

**Errors:** malformed rows → existing entry rejection `P9_AUTO_COMMAND_INVALID`; binding or lineage mismatch → `P9_AUTO_SOURCE_INVALID`; full rollback. No new error code. **No new
`lock_timeout` on the automatic completion:** a timeout would abort the whole
automatic result, and the worker does not retry it (it maps a known conflict to
`stale_claim`). The completion keeps today's lock behavior.

**Source policy:** M85:180–200 may already accept a saved Open Library automatic
list. Unit 1's plan run writes a red test that a saved list reads as fresh and
changes the policy only if that test fails, keeping
enabled/matching/storage/version/current-policy/expiry checks. 02c §4.2's
database Google veto still covers companion, catalogue and cache sub-operations;
shared-cache publication stays primary-source only.

### 3.1 Source variants

| Automatic outcome | Sheet |
|---|---|
| Open Library list + verified retention | Saved, even if ambiguous/no winner; explicit eligibility rules apply. |
| Google, or no retention evidence | Skipped (`source_not_allowed` / `no_retention`); automatic/manual outcome unchanged. |
| Local catalogue, selected-snapshot cache, coalesced result | Current suggestion only; skipped `no_retention`; no invented list. |
| Full edition-list cache (automatic reuse) | Deferred (OQ8-10); explicit cache reuse unchanged (M87). |
| Empty list | Saved empty only with truthful source/deadline proof; else `empty_unproven`. |

## 4. Design — explicit search still searches (Unit 1 SQL, Unit 2 app)

- Forward-replace M75:80 so **Search Books** creates one explicit request even
  while a saved automatic list is fresh. Same signature, `EP_LOOKUP_V1`
  fingerprint and replay. An exact retry returns the original request; a pending
  same-identity request stays pending (no duplicate job).
- At request creation advance `options_version` once and clear
  rows/source/deadline. Completion advances it again. Keep the confirmed selection.
- Keep M75's exhausted-job rule from pass 2 in full: the Owner path locks state
  before job, workers lock job before state, so M75 peeks without a lock and
  locks the job only when it looks exhausted (M75:102–107). The replacement takes
  that lock `FOR UPDATE NOWAIT` **after** the state lock, re-checks the exhausted
  predicate under the lock (lease expiry alone is not enough), and on
  lock-not-available rolls back with `P9_STATE_CONFLICT` with no replay record, job
  or options change (the replay record is written last, M75:128, so the key stays usable).
- Draft edits, **Search with saved title** and the typed-ISBN state machine (01a)
  are unchanged. Retry search uses its frozen command and key.
- No pagination and no provider call from the choices read.

**As built (1b):** M101 forward-replaces `public.phase9_request_candidate_edition_options_v1` (latest definition from M75 `20261017000075`) with three changes: a fresh saved list no longer suppresses Search Books (the gate is `IF NOT pending`); starting a request advances `options_version` once and keeps every selection column; the exhausted-job lock is `FOR UPDATE NOWAIT`, and a held lock raises `P9_STATE_CONFLICT`, rolling back the replay reservation. Same signature, owner, grants, `SECURITY DEFINER` and `search_path`; no new error code. Carried to Unit 2: `P9_STATE_CONFLICT` now also means "an exhausted search is locked by the cleanup sweep; retry" alongside the existing in-flight idempotency-key meaning, so §6's single shared Owner message may need wording.

| Refresh step | Behavior |
|---|---|
| Fresh saved list at G/V → Search Books | Request R at G/V+1, rows empty, pending receipt. No increment on replay/dedupe. |
| App accepts pending (Unit 2) | The client **clears rows and expiry** when it accepts the higher-version pending receipt (today `ownerEditionPickerCache.ts:73–77` keeps them), so no old row can be selected during the search; 3 s polling resumes. The lookup mutation and `pendingLookup` return **EditionChoices**, not `EditionLookupReceipt`; wire DTO unchanged. |
| Completion | G/V+2 ready (or failed/empty). A delayed V+1 receipt never replaces V+2 choices. |
| Read failure / authority change | Valid cached choices meeting the version bound may show; else existing retryable error. A newer generation needs refresh. |

## 5. Owner read, privacy and stale handling

**Sheet status (OD-2026-11-12-1).** The automatic job is never shown as the
sheet's pending request. In practice the sheet cannot be opened while the
automatic lookup runs (the card is `processing`, §2). If the worker crashes after
a provider call the card stays `processing` and its sheet stays unavailable;
OD-2026-11-12-1 does not cover that case. It is fixed by the follow-on
stuck-processing-card unit (ACTIVE.md row 11), not here.

Read change (Unit 1): when `request_id` is an automatic job (operation version
not `p9-owner-edition-options-v1`) and no fresh list remains, report `idle`, not
`failed`. Resulting `lookupStatus`, keeping M75's exhausted branch:

| State | lookupStatus |
|---|---|
| Explicit job exhausted (`phase9_edition_job_exhausted`) | failed |
| Explicit job open/in_progress/retry_scheduled, not exhausted | pending |
| Fresh list (explicit or saved prefill) | ready |
| Explicit terminal without usable list | failed |
| Automatic job bound, list expired; or no request | idle |

Client (Unit 2): accept an `idle` read at the same generation/version that
replaces a cached `ready` (today `ownerEditionPickerCache.ts:36–44` keeps the
old `ready`). This covers expiry **and** invalidation before expiry: provider
disabled or policy revoked makes the source policy false (M85:189) and the read
`idle` at unchanged generation/version. The sheet then shows the normal empty
sheet with Search Books. An `idle` read over a cached `pending` stays rejected.

Privacy inherits 02b §§3/6–10/14 without widening: scan-only origin proof for
public keys; Owner-typed/confirmed/provider-only queries stay private; no new
public read of edition state or effects. A saved list feeds the typed cache only
after the same publication proofs as explicit lists; M88:34–50 requires
`state.request_id = lookup.job_id`, which the real job binding keeps.

| Event | Result |
|---|---|
| Title/author/ISBN change (card ready) | Identity trigger clears the list; Search Books uses the new identity. |
| List past its deadline (≤24 h) or provider disabled | No stale rows; chosen edition kept; sheet idle with Search Books. |
| Card removed, committed or expired; session closed | Read raises `P9_STATE_CONFLICT` (M99:140–146); sheet cannot change. |
| Cache invalidated after prefill | Saved list usable until its own deadline (02b §8.3). |
| App loses the choices read | Retry the read only; no lookup. |
| Completion response lost | Same claim recovers the stored receipt (M92:1422); no refetch, version, count or spend duplication. |

## 6. App (Unit 2)

- Show Search Books when a fresh list is shown (gate at `CandidateEditionPicker.tsx:99`);
  keep pending, command-slot and ISBN guards and Retry search. Opening the sheet
  only reads choices.
- §4 pending acceptance clears rows and expiry; EditionChoices return; §5 idle acceptance.
- **Language groups (OD-2026-11-12-2, OD-2026-10-31-5).** The reference language
  is the language element of the state's `query_identity` (index 6; `und` =
  unknown), added to the choices read and DTO as `queryLanguage` (nullable; `und`
  → null). Both choices schemas are `.strict()` (server
  `I/contracts/ownerEditionPicker.ts:92–98`, client `:90–96`) and the gateway turns a
  response mismatch into `P9_INTERNAL_ERROR` (`ownerEditionPickerGateway.ts:84–100`),
  so Unit 1 adds `queryLanguage` as **optional nullable** to both schemas, and the
  rollout order is: Owner API, worker and an app build with the widened client
  parser first, migration apply after (§8). Rows whose language matches come first, then **Other languages**,
  original order inside each group. With `queryLanguage` null, no grouping. Option
  IDs, eligibility and commands unchanged; Show all and accessibility kept; no
  selectable row hidden in a collapsed group.
- Conflict wording "These choices may have changed. Review the latest choices and
  try again." in client `editionSelectionRecovery.ts` (incl. `editionLookupRecovery`
  :19–27), `api/ownerUxTransport.ts:54` and the sheet override
  (`CandidateEditionPicker.tsx:71–74`). The server message `I/contracts/ownerUxErrors.ts:22`
  is shared by every `P9_STATE_CONFLICT`; change it only if the plan run shows the
  wording fits all its users. Test end to end: SQL error → gateway → HTTP envelope
  → client parser → refresh.
- Display the optional `rejectionReason` as today.

## 7. Acceptance checks (red first)

Pass 2's rule stays: build every test state through valid commands; a forced
state never proves reachability.

| AC | Given / when / then | Proof |
|---|---|---|
| ACP-1 | Retainable Open Library list completes, with and without an automatic winner, on a card with **no** prior edition-state row and on one with a row; opening the sheet shows the rows with zero new request. | SQL/worker test + app read-only-open test; red: baseline never saves rows. |
| ACP-2 | Saved rows keep original positions/UUIDs/eligibility and satisfy the CHECK; malformed, duplicate, over-10 or bad URL → `P9_AUTO_COMMAND_INVALID` (existing entry check); bad lineage → `P9_AUTO_SOURCE_INVALID`; full rollback. | Server/client zod and SQL tests; explicit-cache filtering stays a green control. |
| ACP-3 | Saved list → Search Books → V+1 pending (rows cleared in the client) → V+2 ready; delayed V+1 receipt never wins. | Real QueryClient test with receipt cache empty, older and newer; red: fresh short-circuit, kept rows, receipt return. |
| ACP-4 | Reachable overlaps during a running lookup (OD-2026-11-12-3): session closed/expired, card removed (M54:306–313). Completion is `stale_rejected` or prefill skipped `not_reviewable`; nothing shown on a removed card. Commit is unreachable while `processing` and is covered in ACP-13. | **Native two-connection test**, both arrival orders, real commands. Plus a SQL assertion that Owner search/select/ISBN are refused while `processing`. |
| ACP-5 | Before install every completion stores `not_installed`; after install a no-list/local completion stores `no_retention`; old receipts replay unchanged; replay keeps the stored receipt and the state keeps the UUIDs; expired replay restores no rows. | Worker recovery test before/after install. |
| ACP-6 | Saved lists follow private/scan-only publication rules; automatic full-list reuse stays out. | Publication/privacy assertions plus existing two-store cache controls. |
| ACP-7 | Google or no retention → skipped, automatic suggestion still commits; disabled/expired/outage keep manual, selected and Add behavior; provider disabled before the deadline → `idle` in SQL and the app cache drops the rows. | Positive skip tests per reason incl. skip precedence; stale zero-write; expiry; disable. |
| ACP-8 | Language groups use `queryLanguage`; unknown → no groups; row identity, eligibility and discovery kept. | Jest list/sheet tests incl. selected row beyond 5. |
| ACP-9 | Rollback: OL automatic flags off → no new saved lists; old receipts replay; explicit search keeps working. | Readback matrix in the rollout script. |
| ACP-10 | API roles cannot write edition state/effects or call the helper; wrong store/claim/session writes nothing. | Effective ACL checks after install; `undefined_function` never counts as red. |
| ACP-11 | Search Books vs Select vs exhausted-job lock on a ready card, both orders. | Fenced success or `P9_STATE_CONFLICT` with §6 wording; NOWAIT path leaves no replay; no HTTP retry. |
| ACP-12 | Saved list expires; explicit job exhausted. | Expired → `idle` in SQL **and** in the app cache; exhausted explicit → `failed` (M75 regression control). |
| ACP-13 | Defensive skips: Owner selection present, identity differs, state has another request, card committed. | SQL tests calling the completion on states built through valid commands where reachable; otherwise helper-level tests marked as defensive. |

## 8. Build units

| Unit | Scope | Gate |
|---|---|---|
| 1a. Save and read (DB + worker) | Migration M100: helper after M93:1384, state-row insert, receipt widening (§3 sites, decode binding), source policy only if needed, read change (§5) incl. `queryLanguage`; optional nullable `queryLanguage` in server and client choices schemas. ACP-1 (SQL/worker), 2, 4, 5, 6, 7 (SQL), 10, 12 (SQL expiry and exhausted control), 13. | Plan run READY; red first; `node scripts/verify-phase9.js`; different-model review; separate create/apply approvals. |
| 1b. Search Books while fresh (DB) | Migration M101: M75 request change (search while fresh, version advance, NOWAIT rule). ACP-3 (SQL), 11; explicit-search control for ACP-9. | Same gates; built after 1a is committed. 1a is not released alone. |
| 2. App | Search Books gate, pending acceptance clears rows, idle acceptance (expiry and invalidation), EditionChoices return, `queryLanguage` groups, conflict wording; ACP-1 (app open), 3, 7, 8, 12 (app). | Same flow; built and tested locally after Units 1a and 1b are committed (Owner 2026-11-13); nothing deployed or applied in this unit. |
| 3. Live check | Rollout order: Owner API (widened schema), worker (receipt decode) and an app build with the widened client parser → apply M100 and M101 → Unit 2 app; readback before/after apply; Haiku in-app test on dev; ACP-9 proven locally (runbook below). | Each deploy/apply separately approved. |

**Unit 3 rollout runbook** (pre-deploy reviews 2026-11-13: Luna, GLM, MiniMax ×2). Every step needs its own Owner approval; stop on any failed check.

1. Merge the branch into `main`. The media worker tsconfig carries the same
   `__tests__`/`*.test.ts` exclude as metadata and vision; this fixes the known media
   compile failure (8c class), not every possible build issue. Build and test the final
   merge commit locally, record its commit and tree, then push.
2. Run the readback (`scripts/02d/01-readback.sql`, SELECT-only) on dev as the
   **baseline**.
3. Deploy the Owner API (`phase9-owner-ingestion`, Supabase CLI) and the metadata
   worker (Render) from the pushed merge commit. Confirm that the deployed commit is
   the merge commit, that the worker logs `service_started`, and that automatic jobs
   still complete on M99. Both are compatible with M99: `queryLanguage` is optional,
   and the M99 `not_installed` receipt still decodes.
4. Start the Unit 2 app build (local web export of the merge commit) and close or
   reload every older app session. An app older than 1a rejects `queryLanguage`
   (`P9_INTERNAL_ERROR`); an app older than Unit 2 keeps invalidated rows.
5. With exact-project verification and a separate approval for each, apply M100, then
   M101 straight after it. Between the two, Search Books on a fresh list starts
   nothing (M75). If M101 fails, keep the compatible code and M100, block release,
   and approve a forward repair. Run the readback **after apply**.
6. Haiku live test on dev (ACP-1, 3, 8, 12).

**ACP-9 (Owner 2026-11-14 scope: local proof).** The flag rollback is proven on a
disposable local Postgres with the real 8c `06-rollback.sql` (full drain, gate paused,
Open Library automatic off): no new saved lists after the cut-off, a new completion
records `skipped`, and stored receipts replay unchanged. It is **not** run on dev in
this unit. 06 pauses the admission gate; the existing 03/04/05 assume other baselines,
so a live rollback-and-restore needs its own reviewed procedure. That procedure is
recorded as a residual.

**Rollback rule:** after M100, the only rollback is ACP-9's flag rollback, and that
needs its own reviewed restoration procedure. Never roll the worker or the Owner API
back alone, and never drop M100/M101. The pre-02d worker rejects `saved` and new
`skipped` receipts and would report every automatic completion as manual. The pre-1a
Owner API rejects `queryLanguage`. Keep the compatible worker and Owner API deployed
throughout. Flags off plus zero in-flight jobs does not make a pre-02d worker
compatible: stored receipts persist, and later local completions still emit new
receipt kinds. Any code rollback needs a separately reviewed compatibility plan.

Docs on implementation: this SDD, data dictionary, current-vs-target, migration
ledger, verification tracker, CODEBASE_MAP rows whose paths change.

## 9. Owner decisions, open questions, residual risks

| Decision | Effect |
|---|---|
| OD-2026-10-31-5 (OQ-P1) | Language grouping ships here. |
| [OD-2026-11-12-1](../../../../DECISIONS.md#log) | No special "searching" state on the sheet for the automatic job (§5). Its stated reason was a stuck job; revision b found that a stuck job leaves the card `processing` and unreadable, which the follow-on unit fixes. |
| [OD-2026-11-12-2](../../../../DECISIONS.md#log) | Language grouping in this unit (§6). |
| [OD-2026-11-12-3](../../../../DECISIONS.md#log) | One two-connection race test (ACP-4), now on the overlaps that are reachable; legacy deadlock proof dropped. |
| Owner 2026-11-12 | Stuck-processing-card fix (row 11) is a separate unit right after this one. |

**Open (decide in the Unit 1 plan run, from code):**
- Q-3: whether the source policy needs a change for saved Open Library lists (§3).
- (Q-5 resolved, revision c: Owner removal is allowed while `processing`,
  M54:306–313, so ACP-4's removal case is reachable.)

**Residual risks:**
- Legacy path deadlock: direct `phase9_register_metadata_attempt` (M95:52, lookup
  lock :63) against Owner Select inserting choice-effect FKs was not proved
  cycle-free. A deadlock (SQLSTATE 40P01) is not mapped to `P9_STATE_CONFLICT`
  anywhere (`ownerUxErrors.ts:16–29`, client, worker): the Owner would see an
  unexpected error and the transaction rolls back, with no lost data.
- Stuck `processing` cards (row 11): not fixed here; next unit.
- **Rollback:** under separate authority pause/drain, set OL
  `automatic_lookup_allowed=false` and `automatic_role`/`automatic_order` null via
  the existing manifest, read back. The SQL hook stays installed; new completions
  record a skip; saved receipts replay unchanged; explicit search keeps working;
  Google stays off.
