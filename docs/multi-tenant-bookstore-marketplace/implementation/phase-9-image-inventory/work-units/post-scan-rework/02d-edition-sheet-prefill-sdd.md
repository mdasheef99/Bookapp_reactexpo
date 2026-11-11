# Post-Scan Rework — Automatic Results in the Edition Sheet

| | |
|---|---|
| **Status** | **Pass-3 design refresh, 2026-11-12; NOT IMPLEMENTED.** Rewritten by the orchestrator after slice 8b/8c shipped. Build, migration creation/application and deployment each need separate Owner approval. |
| **Parent** | [SDD-0 §4 PSR-D30](./00-overview-sdd.md#e-matching-and-lookup); [SDD-2 Slices 8–9](./02-catalogue-and-matching-sdd.md#slice-8--open-library-first-clues-google-off); [02c](./02c-slice8-open-library-first-sdd.md) §§4.3/5/7. |
| **Authority** | [OD-2026-10-30-4](../../../../DECISIONS.md#log) (ship after 8b, before slice 9; keep the search button); [OD-2026-10-31-5](../../../../DECISIONS.md#log) (language grouping); [OD-2026-11-12-1..3](../../../../DECISIONS.md#log) (this pass). D07/D10/D30/D35/D39/D40, R04/R06–R10; master §3 MAS-02/03/13–16; DOC-3 §5.2. |
| **Baseline** | Branch `phase9/02d-prefill` at `c10832d`: 8b worker and 8c switch built, migrations through M99 in the tree; dev's automatic provider is Open Library, Google is off. Code read 2026-11-12 by the orchestrator, with a model-verified gap list and a Sonnet review of this pass. No live readback. |
| **Migration** | One forward migration (Unit 1). Number unassigned. |
| **Size / risk** | Medium–large / high: automatic-versus-Owner races, request identity, expiry, receipt replay. No relaxed matcher or tie pick (slice 9). |
| **Review** | Pass 2 (2026-10-30) had Terra round-3 corrections. Pass 3 reviewed by Sonnet 2026-11-12 (FIX_NEEDED: fence-versus-skip contradiction, expired-list status, ISBN identity, three lost pass-2 rules, NOWAIT; all applied). |

**Design** below means proposed, not implemented. Migration aliases: `Mnn` is the
file `supabase/migrations/*0000nn_*.sql`; `I/` is `supabase/functions/_shared/imageInventory/`.
SQL citations are the CURRENT definitions (`node scripts/phase9-sql-facts.js <name>`).

## 1. Goal and scope

When the automatic lookup has already fetched a bounded edition list (≤10 rows)
for a card, save that list to the card's edition state in the same transaction
that completes the automatic lookup. Opening the edition sheet then shows it with
no new provider request. **Search Books**, **Search with saved title** and
**Retry search** stay as explicit searches against the current saved identity or
typed ISBN (D30, OD-2026-10-30-4; 01 SDD §4; 01a §§5/8–10). Saving rows never
confirms or selects an edition for the Owner and never changes Add rules.

Order: 8a → 8b → 8c (all built) → **this unit** → slice 9. Slice 9 keeps relaxed
automatic eligibility and full D28 tie selection; D30 sheet persistence and parent
AC9-4/5 belong here (OD-2026-10-30-4).

## 2. Current code (verified 2026-11-12)

| Evidence | Current behavior |
|---|---|
| M65:91–122; M68:7; M90:474–478 | `phase9_candidate_edition_state`: private candidate/session/store, request ID/generation/query identity, options/version, source lookup/attempt/fetched time/deadline, independent saved selection; `failure_receipt` (M68:7); options CHECK replaced at M90:474–478; ≤10 rows, ≤24 h deadline; no API table privileges (REVOKE M65:122). FK `(request_id,candidate_id,store_id)` at M65:102. |
| M85:180 `phase9_edition_source_policy` | Read shows fresh rows only if query/deadline/source policy agree. Branches only on `execution_mode` + `adapter_key`; no automatic purpose branch. |
| M92:903 `phase9_complete_candidate_edition_options_v2`; session lock M92:925–926 | Explicit completion: validates rows/companions/receipts, saves source and options, advances `options_version` (M92:1111). |
| `I/runtime/metadataProductionGateway.ts:71` → `metadataAutomaticExecution.ts:77` | Automatic routing (8b). |
| M93:1028 `phase9_complete_automatic_metadata_v1` (wrapper M93:1072–1074); recovery M92:1422 | Automatic completion already exists. Lock order session `FOR KEY SHARE` → job `FOR UPDATE` → candidate (structural assert) → edition state `FOR UPDATE`. Fence compares `phase9_metadata_candidate_query_identity(c)` (M55:9). Its effect row already records `request_generation` and `captured_request_id`. At M93:1376 the comment reads "02d alone owns alternatives publication"; the receipt hard-codes `prefill:{status:'skipped',reason:'not_installed'}` (M93:1389; M92:1822). |
| `I/runtime/metadataAutomaticCompletion.ts:14–25` | Worker already sends `result` v2 with `rows`, `catalogueCompanions`, `retention`. Receipt schema allows only `prefill:{skipped, not_installed}` (:22, :31–32); tests pin it (`phase9_metadata_automatic_boundary_u5.test.ts:81`, production composition test :448). |
| M94:6 `phase9_automatic_edition_fence_v1` (locks M94:33–46) | Worker loads the fence before HTTP; it locks session/job/candidate inside its own short transaction. No row lock crosses HTTP. |
| M75:80 `phase9_request_candidate_edition_options_v1` (body :116–126) | Explicit request creates a job only when neither pending nor fresh (fresh short-circuit). Clears rows/source/deadline; does **not** advance `options_version`. Raises `P9_REQUEST_INVALID`, `P9_VERSION_CONFLICT`. |
| M99:135 `phase9_owner_candidate_edition_choices_v1` (guard :140–146) | Owner read raises `P9_STATE_CONFLICT` for a removed, committed or expired card or a non-mutable session. |
| `I/contracts/ownerEditionPicker.ts:65–104` and client copy | Stored row keys: optionId/ordinal/googleBooksUrl/eligibility/metadata. Wire row adds optional `rejectionReason` (:69), computed at read (M78:427–435). |
| `src/features/imageInventory/components/CandidateEditionPicker.tsx:99` | Search Books renders when `(identityChanged || !fresh) && !pending`: hidden while a fresh list shows. |
| `ownerEditionPickerQueries.ts:75–77,202–210` | Lookup mutation and `pendingLookup` return `EditionLookupReceipt`. |
| `EditionOptionList.tsx:40,60` | Shows first 5/10 rows; language is plain text; no groups. |
| `review/editionSelectionRecovery.ts:4–27` | Conflict copy; Search Books uses `editionLookupRecovery` (:19–27). |

## 3. Design — prefill inside the automatic completion (Unit 1)

A new private helper `marketplace_sec.phase9_prefill_automatic_editions_v1` is
called from M93's automatic completion at the M93:1376 hook, after the existing
locks are held (session → job → candidate → edition state). Postgres-only: no
client RPC, no separate transaction, no best-effort write after terminal.

| Field | Rule |
|---|---|
| candidate/session/store | From the locked rows; all supplied IDs compared. RLS is a backstop, not authority. |
| `query_identity` | The fence already proves `phase9_metadata_candidate_query_identity(c)` equals the registered automatic query. Write `phase9_edition_query_identity(c)` of the same locked candidate, so the Owner read's own check (M75/M78) agrees. Never rewrite identity from the returned edition or from newer Owner edits. |
| `request_generation` | Must equal the generation captured in the effect row; never incremented by prefill. |
| `request_id` | Bind the real automatic job ID (FK M65:102 scopes it). No fake explicit job. |
| `options` | Original ≤10 positions, contiguous ordinals, unique UUIDs, explicit sheet eligibility; unavailable positions keep UUID/ordinal with null metadata/URL. No dedupe, filter or re-sort. |
| `options_version` | +1 for a new saved list; replay returns the original version and UUIDs. |
| Source lineage | Original lookup/attempt, adapter/version/normalizer, microsecond-equal `fetchedAt`; companions bound to option UUID/record/digest. Nothing copied from another store. |
| `source_fetched_at`, `options_expires_at` | Source time; deadline = least(verified provider deadline, source time + 24 h, current registry/source deadline). No renewal. |
| Selection | Never set or changed by prefill. A sheet-eligible row is not selected. |
| Counts/spend/catalogue | Same transaction and effects as today's completion; prefill adds no searched/selected/added/spend effect. |

**Owner race (existing fence, unchanged):** if the Owner searched, edited
title/author/ISBN, the card expired or the session closed since capture, the
existing fence returns `stale_rejected` with **zero writes**: no prefill and no
automatic result (generation/captured request M93:1096–1098; identity/expiry
M93:1089–1094). The Owner's work always wins. The helper is only reached after
that fence passed.

**Helper skip rules (the automatic result still commits):** a selection exists
(`selected`); no verified retention (`no_retention`); empty or missing list
without truthful source/deadline proof (`empty_unproven`); `owner_isbn13` is set
or `phase9_edition_query_identity(c)` differs from the identity the list was
fetched for (`identity_mismatch`: an ISBN set before the job was claimed is
already inside the captured generation, so the fence does not catch it). A skip
never overwrites explicit rows or a selection.

**Helper duties kept from pass 2:** create the edition-state row when absent
(M93:1095 only selects it) under the candidate lock already held; take no new
private session/job/candidate/state lock after the shared phase (02b §6.2 order);
the completion digest covers ordered rows, companions, identity, source and
deadline (confirm in the plan run whether the existing command digest already does).

**Helper result:** `{status:'saved',requestId,requestGeneration,optionsVersion,optionsExpiresAt}`
or `{status:'skipped',reason:'no_retention'|'selected'|'empty_unproven'|'identity_mismatch'}`.
The AutoReceipt `prefill` field widens to these (SQL M92:1822/M93:1389 and zod
`metadataAutomaticCompletion.ts:22,31–32`; update the two pinning tests).
Receipts written before this unit keep `not_installed` and replay unchanged.

**Errors:** malformed rows or binding mismatch → existing `P9_EDITION_ROWS_INVALID`
/ `P9_AUTO_SOURCE_INVALID`, full rollback. No new error code (pass 2's
`P9_EDITION_PREFILL_DTO_INVALID` is dropped). Contention → `P9_STATE_CONFLICT`.

**Source policy:** `phase9_edition_source_policy` (M85:180–200) has no
explicit-search capability check and may already accept an automatic OL list.
The Unit 1 plan run decides from code: write a red test that a saved automatic
list reads as fresh; change the policy only if that test fails, keeping
enabled/matching/storage/version/current-policy/expiry checks. Google lists are
never saved (Google off; a registry storage flag is not retention evidence), and
02c §4.2's database Google veto still covers companion, catalogue and cache
sub-operations. Shared-cache publication stays primary-source only.

**Timeouts:** the new and changed wrappers set transaction-local
`lock_timeout='2s'`; native transactions set `statement_timeout='10s'`. Neither
exists today. Lock timeout maps to existing `P9_STATE_CONFLICT`. The worker retries
the SQL once under the same claim, no HTTP.

### 3.1 Source variants

| Automatic outcome | Sheet |
|---|---|
| External list + verified retention (Open Library) | Saved, even if ambiguous/no winner; explicit eligibility rules apply. |
| No retention evidence | Skipped `no_retention`; automatic/manual outcome unchanged. |
| Local catalogue, selected-snapshot cache, coalesced result | Current suggestion only; no invented list. |
| Full edition-list cache (automatic reuse) | Deferred (OQ8-10); explicit cache reuse unchanged (M87). |
| Empty list | Saved empty only with truthful source/deadline proof; else skipped. |

## 4. Design — explicit search still searches (Unit 1 SQL, Unit 2 app)

- Forward-replace M75:80 so **Search Books** creates one explicit request even
  while an automatic list is fresh. Same signature, `EP_LOOKUP_V1` fingerprint and
  replay. An exact retry returns the original request; a pending same-identity
  request stays pending (no duplicate job).
- At request creation advance `options_version` once and clear rows/source/deadline
  (today it clears but does not advance). Completion advances it again. Keep the
  confirmed selection. A late automatic completion cannot overwrite this request
  (the captured request ID differs → fence `stale_rejected`, zero writes).
- Keep M75's lock order: the Owner path locks state before job, workers lock job
  before state, so M75 peeks without a lock and locks the job only when it looks
  exhausted (M75:99–101). The forward replacement keeps that and takes the
  exhausted-job lock `FOR UPDATE NOWAIT`, mapping lock-not-available to
  `P9_STATE_CONFLICT` (pass 2 rule, restored).
- Draft edits, **Search with saved title** and the typed-ISBN state machine (01a)
  are unchanged. Retry search uses its frozen command and idempotency key.
- No pagination and no provider call from the choices read.

| Refresh step | Behavior |
|---|---|
| Fresh automatic list at G/V → Search Books | Request R at G/V+1, rows empty, pending receipt. No increment on replay/dedupe. |
| App accepts pending | Higher version clears rows and sets pending; 3 s polling resumes. The lookup mutation and `pendingLookup` return **EditionChoices**, not `EditionLookupReceipt` (`ownerEditionPickerQueries.ts:75–77,202–210`); wire DTO unchanged. |
| Completion | G/V+2 ready (or failed/empty). A delayed V+1 receipt never replaces V+2 choices. |
| Read failure / authority change | Valid cached choices meeting the version bound may show; else existing retryable error. A newer generation needs refresh. |

## 5. Owner read, privacy and stale handling

**Sheet status (OD-2026-11-12-1):** the automatic job is never reported as the
sheet's pending request. Before a saved prefill the sheet is `idle`: empty, with
Search Books. This already holds today, because the automatic job is bound to the
state only by prefill. Reason: a worker crash after a provider call can leave the
automatic job in progress forever (ACTIVE.md row 11); the sheet must never wait on it.

After prefill binds the automatic job as `request_id`, today's read (M75:24–60,
wrapped by M78) would report `failed` once the list expires. Unit 1 changes the
read: when `request_id` is an automatic job (not operation version
`p9-owner-edition-options-v1`) and no fresh list remains, report `idle`.
Resulting `lookupStatus`: explicit open/in_progress/retry_scheduled = pending;
fresh list (explicit or saved prefill) = ready; explicit terminal without usable
list = failed; otherwise idle.

Privacy inherits 02b §§3/6–10/14 without widening: scan-only origin proof for
public keys; Owner-typed/confirmed/provider-only queries stay private; no new
public read of edition state or effects. Automatic prefill may feed the typed cache
only after the same publication proofs as explicit lists; M88:34–50 requires
`state.request_id = lookup.job_id`, which the real job binding keeps.

| Event | Result |
|---|---|
| Title/author/ISBN change | Identity reset clears the list; Search Books uses the new identity. |
| List older than its deadline (≤24 h) or provider disabled | No stale rows; chosen edition kept; search button shown. |
| Card removed, committed or expired; session closed | Read raises `P9_STATE_CONFLICT` (M99:140–146); sheet cannot change. |
| Cache invalidated after prefill | Saved list usable until its own deadline (02b §8.3). |
| App loses the choices read | Retry the read only; no lookup. |
| Completion response lost | Same claim recovers the saved receipt (M92:1422); no refetch, version, count or spend duplication. |

## 6. App (Unit 2)

- Show Search Books when a fresh list is shown (change the gate at
  `CandidateEditionPicker.tsx:99`); keep pending, command-slot and ISBN guards and
  Retry search. Opening the sheet only reads choices.
- §4 version advance/clear/poll acceptance and the EditionChoices return.
- **Language groups (OD-2026-11-12-2, OD-2026-10-31-5):** matching-language rows
  first, then **Other languages**, original order inside each group. Option IDs,
  eligibility and commands unchanged; unknown language follows the existing
  eligibility rule; Show all and accessibility kept; no selectable row hidden in a
  collapsed group.
- Conflict wording "These choices may have changed. Review the latest choices and
  try again." in client `editionSelectionRecovery.ts` (including
  `editionLookupRecovery` :19–27), `api/ownerUxTransport.ts:54` and the sheet
  override at `CandidateEditionPicker.tsx:71–74`. The server message at
  `I/contracts/ownerUxErrors.ts:22` is shared by every `P9_STATE_CONFLICT`; change
  it only if the plan run shows the neutral wording fits all its users. Same code,
  refresh behavior; older clients keep the old wording. Test the path end to end:
  SQL error → gateway → HTTP envelope → client parser → refresh.
- Display the optional `rejectionReason` as today; no new row field.

## 7. Acceptance checks (red first)

| AC | Given / when / then | Proof |
|---|---|---|
| ACP-1 | Retainable automatic list completes; opening the sheet shows the rows with zero new request. | New SQL/worker test + app read-only-open test; red: baseline never saves rows. |
| ACP-2 | Saved rows keep original positions/UUIDs/eligibility; malformed, duplicate, over-10, bad URL or lineage refused. | Server/client zod and SQL tests; explicit-cache filtering stays a green control. |
| ACP-3 | Fresh list → Search Books → V+1 pending → V+2 ready; delayed V+1 receipt never wins. | Real QueryClient test with receipt cache empty, older and newer; red: today's fresh short-circuit and receipt return. |
| ACP-4 | Owner searches or edits identity while the automatic lookup runs; the late automatic completion is `stale_rejected` with zero writes; Owner's request and selection stay. | **Native two-connection race test, both arrival orders** (OD-2026-11-12-3); generation/request/selection assertions. |
| ACP-5 | Lost response replays original version/UUIDs/effects; pre-install receipts replay `not_installed`; expired replay restores no rows. | Worker recovery test before/after install. |
| ACP-6 | Automatic lists follow private/scan-only publication rules; automatic full-list reuse stays out. | Publication/privacy assertions plus existing two-store cache controls. |
| ACP-7 | No retention → skipped, automatic suggestion still commits; disabled/expired/outage keep manual, selected and Add behavior. | Positive no-retention, ambiguous-list, stale zero-write, expiry tests. |
| ACP-8 | Language groups keep row identity, eligibility and discovery. | Jest list/sheet tests: known/unknown/other languages, selected row beyond 5. |
| ACP-9 | Rollback: OL automatic flags off → no new saved lists; old receipts replay unchanged; explicit search keeps working. | Readback matrix in the rollout script. |
| ACP-10 | API roles cannot write edition state/effects or call the helper; wrong store/claim/session writes nothing. | Effective ACL checks after install; `undefined_function` never counts as red. |
| ACP-11 | Prefill vs Search Books vs Select, both orders, 2 s/10 s limits. | Result is a fenced success or `P9_STATE_CONFLICT` with the §6 wording; no 40P01, no HTTP retry. |
| ACP-12 | Automatic job stuck in progress (no saved list); saved automatic list expired. | Stuck: sheet idle with Search Books (green regression control today). Expired: idle, not failed (red until the §5 read change). |
| ACP-13 | ISBN set before the automatic job was claimed. | Helper skips `identity_mismatch`; no title-search list shown under an ISBN identity. Red: no helper. |

## 8. Build units

| Unit | Scope | Gate |
|---|---|---|
| 1. Database + worker | One migration: helper at the M93 hook, receipt widening (SQL + zod + two pinned tests), source policy only if Q-3 needs it, M75 request change (search while fresh, version advance, NOWAIT), read change (§5 expired → idle), timeouts; ACP-1/2/4/5/6/7/9/10/11/12/13. | Plan run READY; red first; `node scripts/verify-phase9.js`; different-model review; separate create/apply approvals. |
| 2. App | Search Books gate, EditionChoices return and version acceptance, language groups, conflict wording; ACP-3/8/12. | Same flow; runs after Unit 1 is applied on dev. |
| 3. Live check | Haiku in-app test on dev; worker redeploy only if Unit 1 changes worker code. | Each deploy/apply separately approved. |

Docs on implementation: this SDD, data dictionary, current-vs-target, migration
ledger, verification tracker, CODEBASE_MAP rows whose paths change.

## 9. Owner decisions, open questions, residual risks

| Decision | Effect |
|---|---|
| OD-2026-10-31-5 (OQ-P1) | Language grouping ships here. |
| [OD-2026-11-12-1](../../../../DECISIONS.md#log) | Automatic job never shown as pending; sheet idle with Search Books until a list is saved (§5). |
| [OD-2026-11-12-2](../../../../DECISIONS.md#log) | Keep language grouping in this unit (§6). |
| [OD-2026-11-12-3](../../../../DECISIONS.md#log) | Keep the ACP-4 two-connection race test; drop the legacy lookup/choice-FK deadlock proof (pass 2 §3.2) to a residual risk. |

**Open (decide in the Unit 1 plan run, from code):**
- Q-1: the fence checks `phase9_metadata_candidate_query_identity(c)` (M55:9);
  the sheet read checks `phase9_edition_query_identity(c)` (M78:10, ISBN-aware
  M78:16–19). Prefill writes the latter and skips `identity_mismatch` when they
  describe different searches (§3). Confirm from code that a title-only card
  gives a saved list the read accepts.
- Q-3: whether the source policy needs the automatic purpose branch (§3).
- Q-4: whether the existing completion digest already covers rows/companions.
- Q-2: live registry `automatic_*` flags were not read; read back before rollout
  (runbook 02c-1 §2 step 8).

**Residual risks:**
- Legacy path deadlock: direct `phase9_register_metadata_attempt` (M95:52, lookup
  lock :63) against Owner Select inserting choice-effect FKs was not proved
  cycle-free. A deadlock would surface as `P9_STATE_CONFLICT` ("try again"), not
  lost data.
- Stuck automatic jobs (ACTIVE.md row 11) are not fixed here; the sheet stays usable.
- **Rollback:** under separate authority pause/drain, set OL
  `automatic_lookup_allowed=false` and `automatic_role`/`automatic_order` null via
  the existing manifest, read back. The SQL hook stays installed; new automatic
  completions record `skipped/no_retention`; saved receipts replay unchanged;
  explicit search keeps working; Google stays off.
