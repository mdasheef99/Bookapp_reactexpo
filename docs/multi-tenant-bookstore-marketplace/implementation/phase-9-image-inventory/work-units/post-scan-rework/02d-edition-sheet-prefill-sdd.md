# Post-Scan Rework — Automatic Results in the Edition Sheet

| | |
|---|---|
| **Status** | **Pass-2 design draft, 2026-10-30; NOT IMPLEMENTED.** Documentation authorized; build, migration creation/application and deployment remain separate. |
| **Parent** | [SDD-0 §4 PSR-D30](./00-overview-sdd.md#e-matching-and-lookup); [SDD-2 Slices 8–9](./02-catalogue-and-matching-sdd.md#slice-8--open-library-first-clues-google-off); [02c](./02c-slice8-open-library-first-sdd.md) §§4.3/5/7. |
| **Authority** | [OD-2026-10-30-4](../../../../DECISIONS.md#log): ship after 8b, before slice 9; retain the existing explicit search button. D07/D10/D30/D35/D39/D40, R04/R06–R10; master §3 MAS-02/03/13–16; DOC-3 §5.2. |
| **Baseline** | Local `phase9/slice8-providers` at `c93e628`, checked 2026-10-30; 02c §2 records inspected code/SQL. No live readback or operational test performed. |
| **Migration** | One proposed forward migration for prefill/source-policy/read/request integration; filename/number unassigned. No SQL created or edited. Split before build if responsibility/size evidence requires it. |
| **Size / risk** | Medium–large / high: automatic-versus-explicit races, request identity, expiry and receipt reuse. No relaxed matcher or tie-pick activation. |
| **Review** | Complex SDD; Terra round-3 findings addressed as design corrections/questions. Required SDD-0 §15 review/build/native proof remains open; no approval is inferred. |

**Design** below means proposed, not implemented. Path/migration aliases are
defined in [02c §2.1](./02c-slice8-open-library-first-sdd.md#21-sql-evidence-keys).
All current-behavior citations use repository-relative `file:line` or those aliases.

## 1. Goal and scope

**Design:** reuse the automatic lookup's already fetched ≤10 edition rows when
the Owner opens the sheet, with no new provider request merely for opening it.
Keep **Search Books** and failure **Retry search** as explicit searches against
the current saved identity/typed ISBN (D30, OD-4; 01 SDD §4; 01a §§5/8–10).
Saving rows does not confirm/select an edition for the Owner or change Add rules.

Recommended order: 8a → 8b → **this unit** → 8c → slice 9. OD-4 requires only
verified 8b → this unit → slice 9; **8c does not require this unit** (02c §7).
Prefill deployment depends on verified 8b/retention and may precede 8c; OL automatic
activation depends on 8c. If 8c ships first, this unit later accepts valid OL v2
rows through the same versioned source contract. This can ship while
Google is still automatic-primary; prefill skips any automatic source without
independently verified option-retention permission. OL automatic activation stays
8c's decision. Slice 9 keeps relaxed automatic eligibility/full D28 tie selection;
D30 sheet persistence and parent AC9-4/5 move here (OD-4).

## 2. Verified baseline and two integration gaps

| Evidence | Current behavior, inspected 2026-10-30 |
|---|---|
| M65:91–122 | `phase9_candidate_edition_state` holds private candidate/session/store, request ID/generation/query, options/version/source lookup/attempt/time/deadline and independent saved selection; ≤10 rows and ≤24h deadline; no API table privileges. |
| M75:29–55; M85:180–200 | Read projects fresh rows only if query/deadline/source policy agree, selection independently retained; source policy has external Google/OL and privately proved cache branches. |
| M86:251–405; `I/runtime/metadataEditionOptionsRpc.ts:73–94` | Explicit completion validates rows/companions/receipts, saves source/options and slim completion effect, accounts/resolves transactionally; uncertain completion recovers, not refetches. |
| `I/runtime/metadataProductionComposition.ts:232–304`; `metadataProductionGateway.ts:268–309` | Automatic path returns candidates/one selected result, persists selection or manual result; it does not write edition-state alternatives. 02c §4.3 proposes the new automatic transaction. |
| `I/contracts/ownerEditionPicker.ts:65–104,150–166` | Stored row keys are optionId/ordinal/googleBooksUrl/eligibility/metadata; DTO projects safe metadata, unique IDs, contiguous ordinals and expiry/version. |
| `src/features/imageInventory/components/CandidateEditionPicker.tsx:37–54,78–91,101–135` | Fresh rows display without a search; draft identity changes hide rows; timer handles expiry. **Search Books is only rendered when not fresh**, Retry search has separate error flow. |
| M75:116–125 | Request creates a new explicit job only when neither pending nor fresh. New request changes `request_id`, not generation; identity reset owns generation (01a §5.4). |
| `src/features/imageInventory/queries/ownerEditionPickerCache.ts:31–43,65–77`; `ownerEditionPickerQueries.ts:33,202–215` | Same-generation/version pending reads/receipts can be rejected behind ready/failed choices; polling runs only for accepted pending choices. Button/server changes alone do not fix refresh authority. |

Thus “no app changes” cannot satisfy fresh-prefill **and** a usable explicit
refresh: both button visibility and the server's fresh short-circuit need the
bounded proposed changes in §§4/6. Neither requires a new stored row/metadata DTO.

## 3. Design — atomic automatic prefill

Extend 02c's automatic completion transaction; do not issue explicit completion
against a fabricated edition-options job. Proposed private helper
`phase9_prefill_automatic_editions_v1` is postgres-only, called inside the fenced
automatic completion; no client RPC and no post-terminal best-effort write.

| State field / proof | Proposed write and refusal rule |
|---|---|
| candidate/session/store | Resolve from the claimed job and locked candidate/session; compare all supplied IDs. RLS is backstop, never authority. |
| `query_identity` | Preserve the registered automatic query, require equality to current `phase9_edition_query_identity(candidate)` after the automatic snapshot transition. Do not rewrite identity to the returned edition's title/authors or use an Owner's newer edits. |
| `request_generation` | Bind the current generation (0 on a new untouched card); do not increment to simulate an Owner command. Identity/ISBN changes still increment/reset normally. |
| `request_id` | Bind the real automatic job ID for this prefill; M65:102 FK already scopes it to candidate/store. Private completion receipt records automatic purpose and the captured request/generation. No fake explicit job. |
| `options` | External prefill stores original <=10 positions, contiguous ordinals/unique UUIDs, explicit sheet eligibility/metadata; unavailable positions null metadata/URL. No dedupe/filter/re-sort. Existing explicit cache reuse independently retains M87:87-116 filtering/recomputed eligibility/compact receiving ordinals; automatic full-list reuse is deferred (OQ8-10). |
| Eligibility | Current explicit predicate for **selectable sheet rows**, as 02b §14 OQ3; strict automatic winner remains 02c's separate decision. A sheet-eligible row is not automatically selected. |
| `options_version` | Increment once for this successful new completion; replay/recovery returns original version/UUIDs without another increment. Include ordered rows/companions/identity/source/deadline in SQL completion digest. |
| Source lineage | Original automatic lookup/attempt, exact adapter/version/normalizer, metadata correlationId=lookup, attemptId=attempt, microsecond-equal fetchedAt; companions bind original option UUID/provider record/digest. No source or other-store private IDs copied from a cache. |
| `source_fetched_at`, `options_expires_at` | Source factual time and least(verified provider/header deadline, source time+24h, current registry/source deadline). Existing controlled worker verifies response headers; SQL re-proves scope/lineage/current permission/deadline bounds (02c section 5.1), not remote-header authenticity. No cached-author source proof or now+TTL renewal. |
| Selection fields | Preserve confirmed choice bytes/IDs/actor/time. No worker sets selected_by, confirms a current suggestion or counts chosen. Automatic suggestion keeps existing confirmation behavior. |
| Catalogue/counts/cache | Same completion/effect transaction, same 02b identity/receipt/count semantics. Prefill adds no second searched/selected/added/spend effect. Catalogue conflict preserves every valid option. |

Lock order is specified in §3.2: M86:206–218 takes session KEY SHARE **before**
M68:71's job lock; M15:238 supplies the claim assertion's job lock inside that prefix.

**Race design:** capture generation and preexisting request identity before
egress; atomically compare at
completion. Prefill is eligible only with no Owner explicit request/choice/ISBN
or identity change since capture (or exact replay of this same automatic result).
An existing explicit request, changed generation/query, selected/committed/removed
card or expired/nonmutable session makes the **prefill sub-operation skip**, never
overwrite explicit rows/selection or resurrect a card. Automatic terminal handling
still follows its own valid claim fence; a stale automatic completion writes nothing.

No blind UPSERT replaces a request ID. Recheck under state lock after competing
explicit request/Select. A newer explicit request wins independent of response
arrival order. A lookup that cannot commit valid automatic completion does not
leave prefill, catalogue, count or usage half-written. Recovery returns persisted
slim receipt/digest first, without extending expired alternatives (02b §§7/10).

### 3.1 Source variants and permission

| Automatic outcome | Proposed sheet behavior |
|---|---|
| External bounded options + verified retention | Prefill original rows, even if automatic rank is ambiguous/no acceptable winner; all explicit eligibility checks still apply. |
| Google without verified option-retention evidence | Skip prefill, keep normal automatic/manual outcome. Registry storage flag is insufficient; installing this unit never creates a Google verifier or shared permission (02c §2.2/§3.3). |
| Full edition-list cache | Existing explicit search may reuse it unchanged; automatic full-list consumption/prefill is deferred (OQ8-10). No SQL automatic ranker or new cache command. |
| Local canonical or legacy selected-snapshot cache/coalesced result without a full list | Keep the current suggestion; no alternatives are invented and no provider request occurs on sheet open. Do not copy another store's receipt/option IDs into a new list. |
| Empty list | May record a valid completed empty options result only with truthful source/deadline proof; no chosen snapshot invented. Without permission/lineage leave alternatives absent and explicit/manual actions available. |

Forward source-policy/read functions must recognize the proved automatic external
lineage by **purpose capability**, per 02c §4.2. Do not require
explicit-search capability for an automatic source's legitimate retained list,
and do not bypass enabled/matching/storage/version/current-policy/expiry checks.
If a selected-only source cannot meet the list contract, leave its choice alone.
This unit does not fabricate physical receipts for local results.

### 3.2 Helper, lock and completion contracts (design)

| Private helper / exact signature | Result / refusal |
|---|---|
| `phase9_prefill_automatic_editions_v1(p_fence jsonb,p_lookup_id uuid,p_attempt_id uuid,p_rows jsonb,p_companions jsonb,p_retention jsonb,p_selected_option_id uuid)` | AutoFence/rows/retention from 02c §§4.3/5.1, called only inside valid automatic completion with all private locks below already held. Returns `{status:'saved',requestId:uuid,requestGeneration:int,optionsVersion:positiveInt,optionsExpiresAt:timestamp}` or `{status:'skipped',reason:'no_retention'\|'superseded'\|'expired'\|'selected'\|'not_mutable'}`. No separate terminal transaction. |
| Failure/replay | Malformed/binding mismatch → `P9_EDITION_ROWS_INVALID`/`P9_AUTO_SOURCE_INVALID`, full rollback. Contention → `P9_STATE_CONFLICT`, retry same completion/recovery only. Valid skip commits the independent automatic result. Wholly stale AutoFence returns `{status:'stale_rejected'}` with zero writes. Receipt/digest replay returns original PrefillResult, never refreshes expired alternatives. |
| Recovery | `phase9_recover_automatic_metadata_v1(AutoFence)` returns 02c AutoReceipt including saved/skipped prefill. Validate completed claim/digest and receipt before current lease; expired list remains absent in subsequent read. No rows in receipt and no provider retry on uncertain completion. |

| Step → path | Table / lock mode | Function and constraint (design unless evidence noted) |
|---|---|---|
| 0 worker scope hint | Job/candidate/session IDs read without locks | Hint only to find session; all identity/authority rechecked below. Earlier claim RPC committed before HTTP; no row lock crosses HTTP. |
| 1 worker | `image_extraction_sessions FOR KEY SHARE` | NEW automatic completion outer wrapper matches existing explicit M86:206–207; no prior job lock in this transaction. |
| 2 worker | `image_extraction_jobs FOR UPDATE` | `phase9_assert_metadata_claim` M15:238, then automatic-purpose fence (do not use explicit-only M68:74 fence). Claim/lease/version revalidated. |
| 3 worker | `image_extraction_candidates FOR UPDATE` | Automatic candidate fence after job; same relative order as explicit M68:76 / M67:42. |
| 4 worker | `phase9_candidate_edition_state FOR UPDATE` | Create absent state under already locked candidate, then lock; helper inherits **session + job + candidate + state**, not job alone. Existing explicit M68:80 matches. |
| 5 worker | Lookup/attempt FOR UPDATE; physical calls in (created_at,id) order FOR UPDATE; reservation FOR UPDATE | M86:215-218/301-302/329-331; physical locks precede receipt SELECT. No author-proof/evidence-table locks in this build. |
| 6 all writers | Private lookup/choice/completion effects, then sorted registry rows `FOR SHARE` | 02b §6.2; prepare effect locks before catalogue. Automatic effect table belongs to 02c. |
| 7 all writers | Sorted identity advisory keys → work `FOR KEY SHARE` → edition `FOR SHARE` → source/ID uniqueness → stats work/edition UUID order → cache last | 02b §6.2; no new private session/job/candidate/state/effect lock after shared phase. |
| Owner request/Select prefix | Session `FOR UPDATE` → candidate `FOR UPDATE` → edition state `FOR UPDATE` → private effects | Existing M54:19–22, M65:194–196, M75:87–98, M84:909–927. Active worker job is not locked by Owner path. |
| Owner exhausted-job exception | Job `FOR UPDATE NOWAIT` after state, then exhausted predicate recheck | Forward-replace M75:106; catch lock_not_available and return `P9_STATE_CONFLICT` via rollback, no replay/job/options mutation. Never wait on the reverse state→job edge. Lease expiry alone is insufficient. |

NEW completion/request wrappers set transaction-local `lock_timeout='2s'`;
native transactions set `statement_timeout='10s'` **before** the RPC. Translate
known lock-not-available/lock-timeout rollback to existing `P9_STATE_CONFLICT`,
never a new busy code. Worker recovers then retries that SQL transaction at most
once under the same current claim, no HTTP. Owner follows existing **refresh**
recovery: reconcile choices, review latest state, then issue a new deliberate
command; known rollback has no replay effect. Uncertain transport still retries
the exact frozen command/key. No busy-specific enum/header/old-client rollout.

| End-to-end contention path (P2/P3 design) | Existing contract / required proof |
|---|---|
| Server/client | `I/runtime/ownerEditionPickerGateway.ts:31-40` already allows P9_STATE_CONFLICT; `I/contracts/ownerUxErrors.ts:22` maps HTTP 409/retryable. Client enum/operation sets permit it (`src/features/imageInventory/api/ownerUxTransport.ts:14-28,54,64-67`). Older clients get the same known code. |
| Owner behavior | `review/editionSelectionRecovery.ts:8-15` returns refresh, not exact uncertain retry; `ownerEditionPickerQueries.ts:213` clears lastLookup. **P3 design wording:** "These choices may have changed. Review the latest choices and try again." Apply to server `I/contracts/ownerUxErrors.ts:22` and client recovery `review/editionSelectionRecovery.ts:4-5`; align client registry `api/ownerUxTransport.ts:54` and sheet refresh override `components/CandidateEditionPicker.tsx:73-75`. Older clients keep old wording with the same known code/refresh behavior. No same-command Owner retry promise for known contention rollback. |
| Test | Through real SQL error -> gateway -> HTTP envelope -> client parser -> refresh/reconcile. No P9_INTERNAL_ERROR remapping, hidden provider retry or lost selection; test request and Select, old client fixtures and current client. |

SKIP LOCKED is queue-only. Session-first plus the exhausted-job NOWAIT exception
removes the new completion/request reverse wait; it does **not** prove all legacy
paths globally cycle-free. Required additional ACP-11/partial-8a proof:

- Native connections/barriers exercise direct legacy `phase9_register_metadata_attempt`
  holding lookup FOR UPDATE (M73:706-708), then attempt INSERT's candidate FK
  KEY SHARE (M02:164-168), versus Owner Select holding candidate and inserting
  choice-effect lookup/attempt FKs (M83:71-87; M84:979-986).
- Generate current/old choices and claims through valid commands; test both arrival
  orders. Either complete the same-row interleaving without 40P01, or prove/assert
  that a Select-able same lookup implies terminal job and rejects registration
  before its FK wait (M15:749-756; M86:393-405). Include every callable legacy
  snapshot/cache path; do not use invalid forced states as proof of reachability.
- Record actual lookup/candidate/job IDs and wait edges. If a valid cycle occurs,
  stop 8a rollout and review a forward lock-order correction; no global no-deadlock
  claim or old-worker compatibility acceptance until this test passes.

### 3.3 Existing cache boundaries; proposed deferral

**OQ8-10 recommendation: defer automatic full-list reuse.** Existing M87:22-25
uses the explicit fence and :110-124 computes explicit eligibility/ISBN summary,
not the TypeScript automatic rank (`I/metadata/googleBooks/ranking.ts:10-30`).
No new automatic cache RPC, CacheProof, SQL ranker or parity engine is built.
Automatic local catalogue and existing selected-snapshot cache/coalescing stay
on their existing paths. Existing explicit typed-cache reuse remains unchanged,
including source slots, filtering/fresh IDs/compact receiving ordinals and expiry.
Only a newly fetched, independently retainable automatic list feeds prefill;
local/selected-only hits show their current suggestion with no invented list.
A future reuse design requires separate Owner approval and cross-language/source
proof; it is not needed for ACP-1/6 or an OL-only 8c.

### 3.4 State to Owner DTO mapping (design)

Actual row/choices schemas are `I/contracts/ownerEditionPicker.ts:65–104` and
paired client `src/features/imageInventory/contracts/ownerEditionPicker.ts:64–103`.
They require **rows>0 ⇒ version>0 and deadline**, not the converse; empty expired/
pending lists may retain a positive version. Do not introduce an invented iff rule.

| State/proof → DTO field and validator | Failure / projection |
|---|---|
| candidate/session IDs → `candidateId/sessionId`; generation/version → nonnegative safe integers | Wrong scope `P9_AUTO_SOURCE_INVALID`; invalid DTO `P9_EDITION_PREFILL_DTO_INVALID`. |
| `options[i]` -> `projectStoredEditionRow` -> `editionRowSchema`; ordinal=i, unique UUIDs, <=10 | Reject duplicate/overbound/noncontiguous prefill with P9_EDITION_ROWS_INVALID. Existing explicit receiving-cache compaction remains its own regression control, not new automatic behavior. |
| Non-null metadata → safe `ownerMetadataSnapshotSchema` + non-null validated `googleBooksUrl`; unavailable ⇔ metadata null | Unavailable positions retain UUID/ordinal, null URL/metadata; lineage/confidence/raw fields excluded. Invalid binding/URL refuses completion, not arbitrary client widening. |
| Source lookup/attempt/fetchedAt + companion digest → private verification only | UUID correlation/attempt and microsecond fetched equality checked before write; no private proof fields exposed. Mismatch `P9_AUTO_SOURCE_INVALID`. |
| `options_expires_at` → `optionsExpiresAt`, fresh rows only if query/source policy valid | Expired/disabled/stale source projects `rows:[]`, deadline null; chosen selection retained. `editionChoicesSchema` validates positive version/deadline only when rows exist. |
| selected fields → selection discriminated union | Owner-confirmation bytes/IDs preserved; current suggestion optionId=null on wire even when private automatic receipt binds selectedOptionId. Invalid selection projection fails DTO validation. |
| job status/source capability → `lookupStatus` | Current automatic request: open/in_progress/retry_scheduled=pending; resolved/resolved_noop + fresh retained list=ready; terminal no usable list=failed; no request=idle. Stale/disabled list never reported available; explicit fresh/pending follows its current request_id. Version fences below govern replacement. |
| Outer candidate version/revisions/owner ISBN → existing DTO fields | Real state values, no invented increments for rendering. Zod rejection is `P9_EDITION_PREFILL_DTO_INVALID`, never a fallback GET. |

## 4. Design — explicit search coexists and still searches

- A **new explicit Search Books** command creates one explicit request even with
  fresh automatic results. Forward-replace M75's fresh short-circuit; keep same
  signature/`EP_LOOKUP_V1` fingerprint/replay (existing private idempotency namespace
  for edition lookup, M75:90–93/128). Exact retry returns original request;
  an already pending same-identity request remains pending, with no duplicate job.
- Preserve identity generation; allocate request ID and **advance options_version
  once at request creation**, atomically clear rows/source/deadline. Completion
  advances it once again for its new list. This monotonic authority marker fits
  the existing DTO (empty lists may have positive version, §3.4). Keep confirmed selection.
  Late automatic prefill cannot overwrite this request, even after it fails.
- Draft edits use existing save-identity-then-search command slot; incomplete
  drafts retain **Search with saved title**. Typed ISBN retains the 01a state
  machine: set/clear→read current generation→one explicit request; no hidden
  title search while setting ISBN, no automatic lookup overwrites owner_isbn13.
- Explicit failure retains current choice and any alternatives that the existing
  failure contract still permits. Retry search uses its frozen command/idempotency
  record; no new key merely because a response was lost (01a §§8–10).
- No pagination, no next page and no provider call from the choices read.

This request change also makes an intentional new press refresh a fresh explicit
list; it does not replay old completed commands into new searches. Do not change
selling fields, Add idempotency, selection confirmation or candidate state names.

| Refresh authority transition (design; P2/P3) | Required client/server behavior |
|---|---|
| Ready automatic at generation G/version V → new explicit | SQL creates request R at G/V+1, options empty/expiry null, pending receipt `{operationId:R,status:'pending',requestGeneration:G,optionsVersion:V+1,available:false}`. No increment on exact replay or already-pending dedupe. |
| QueryClient accepts pending | Higher-version receipt clears choices rows/expiry and sets pending. Reconciled G/V+1 read works even if receipt lost; existing 3s polling resumes. P3 internal lookup mutation and pendingLookup promise now return **EditionChoices**, not a possibly stale EditionLookupReceipt; wire command/receipt DTO stays unchanged. |
| Completion | G/V+2 ready (or failure/current authority/empty rows). After accepting/rejecting delayed V+1 receipt, return reconciled or validated cached **EditionChoices** only: same scope/generation G, optionsVersion at least the highest incoming/accepted receipt and choices authority, existing non-regressing candidate/revision checks. Empty receipt cache or older/same-authority populated cache never prevents returning V+2 choices; no old receipt return. |
| Read failure / actual authority change | If reconciliation fails, valid cached choices meeting that authority bound may return. Otherwise surface existing retryable read/transport failure and preserve frozen command; empty receipt cache alone is not authorityChanged. A genuinely newer generation/scope requires refresh; normal completion's advancing candidate/revision is allowed, regressing values are not. |
| Concurrent identity/device change | Existing candidate/revision/generation fences still dominate. No local request UUID alone overrides server versions; delayed old selection/read cannot restore cleared rows. Test actual QueryClient cache and mutation reconciliation, not only hook stubs. |

## 5. Design — privacy, cache and stale handling

Inherit 02b §§3/6–10/14, **without** broadening scope: scan-only origin proof for
public query keys; Owner-typed/confirmed/provider-only/unknown-origin queries stay
private even when text equals public facts. Shared payload strips query/private
IDs, confidence/rationale and raw responses; companions remain private outside
their safe cache projection. No new public read of edition state or effects.

Automatic prefill may feed the existing typed cache only after same-source,
primary-only publication, permission, companion/digest/versions and scope proof.
M88:34–50 currently requires state.request_id=lookup.job_id; the real automatic
job binding above preserves that relation. Forward guard/source-policy changes
must support the new purpose without weakening explicit automatic-payload denials.
Keep original source time, primary restriction, post-lock deadline recheck,
hidden/blocklist rules and receiving-store zero-egress receipts (02c §§4/8).
02c §4.2's database Google veto also applies to companion/catalogue sub-operations,
all public cache and edition-list cache in either scope, and new Add links even
with every registry permission true; independently permitted private choices stay.

| Event | Server / screen / next action |
|---|---|
| Query/generation/typed ISBN changes | Existing identity reset clears old list; unsaved draft hides it. Search Books or ISBN search uses new identity. |
| List/source expires or provider disabled | Read returns no stale alternatives; chosen snapshot kept; show existing missing/expired message and explicit search/manual path (M75:29–43; picker:101–114). |
| Cache invalidated after prefill | Keep accepted 02b §8.3 behavior: saved list usable until its own deadline; invalidation is not emergency recall. No silent freshness extension. |
| App loses choices read | Retry choices only; no lookup; current sheet error path retained (picker:95–97). |
| Completion response lost | Same claim recovers saved receipt; no refetch/version/count/spend duplication; expired recovery never restores list. |

## 6. Design — app change kept small

No stored row, selection or command DTO change for OL/Google prefill; §3.4 proves
the mapping. Proposed app changes: show the existing explicit action when fresh,
and implement §4's QueryClient version advance/clear/poll acceptance. Retain the
command slot/pending/ISBN guards and Retry search; opening only reads choices.
Button visibility alone is insufficient (§2). Third-host DTO adaptation is 02c §3.3.

D30 language display: store original ordinals; propose a presentation-only
matching-language section followed by **Other languages**, stable original order
within each group, without changing option IDs/eligibility/selection commands.
Unknown language follows the existing eligibility rule, never becomes known.
Current `EditionOptionList.tsx:21–42` slices original positions and has no language
groups, so this is an explicit small UI proposal, subject to OQ-P1; retain Show
all/discovery accessibility and no selectable rows hidden by collapsed groups.
The one-time third-provider presentation gap belongs to 02c, not this unit.

## 7. Acceptance checks and red-first proof

NEW tests are proposals; no product tests are written/run by this document.

| AC / authority | Given / When / Then | Meaningful red-first proof |
|---|---|---|
| ACP-1 D30/OD-4 | Retainable automatic list completes; opening sheet shows original bounded rows with zero new request/GET. | NEW `T/phase9_automatic_prefill.test.ts` + `P/phase9AutomaticPrefill.integration.test.mjs`; red baseline never writes alternatives. Jest read-only-open assertion. Owns moved AC9-4. |
| ACP-2 R07/R09 | External prefill preserves original positions/UUIDs/eligibility and section 3.4 DTO binding; existing explicit-cache projection stays unchanged. | Real server/client Zod, SQL/worker ten-row/null/microsecond/digest tests; malformed/duplicate/overbound/schema/URL/lineage refused. Red new prefill, explicit-cache filtering remains green control. |
| ACP-3 D30/OD-4 | Fresh prefill -> G/V+1 pending -> G/V+2 complete; new internal mutation returns canonical EditionChoices even when delayed V+1 receipt loses. | Actual QueryClient + mutation/reconcile test with receipt cache **empty, older populated, newer populated**; return reconciled V+2 or later valid authority (e.g. V+3), correct rows/status/polling, never an old receipt. Empty receipt cache alone cannot raise authorityChanged; genuinely changed generation requires refresh. Also read failure/frozen retry/pending dedupe. Red baseline cache-empty throw, stale return and fresh-search no-op. |
| ACP-4 D07/R06 | Owner changes title/authors/ISBN or starts explicit request; late automatic response never replaces it; first unchanged save preserves valid choice. | Native two-connection race suite, generation/request/selection digest assertions; red missing prefill compare-and-set; retain M82/01a regressions. Owns moved AC9-5. |
| ACP-5 R06/02b section 10 | Lost response replays original UUIDs/version/effects; precommit failure atomic; expired replay restores no rows. **8b-only absent hook always not_installed; installed hook no-retention always no_retention**. | Native/worker recovery test before/after hook installation, including old receipt replay after install; never rewrite its reason or duplicate spend. Red missing versioned automatic receipt/hook integration. |
| ACP-6 D35/D40/R04 | Newly fetched automatic retained lists obey private/scan-only publication rules; existing explicit cache can reuse permitted payloads with fresh receiving lineage/zero GET/spend/original deadline. Automatic full-list reuse stays out. | New automatic publication/source-purpose privacy assertions plus existing real two-store explicit-cache/ACL/expiry controls. Red new automatic publication contract; provider-only case remains UNPROVEN under OQ8-11, no duplicate unknown fixture. |
| ACP-7 MAS-02/10/16 | No retention skips prefill but valid automatic suggestion still commits; disabled/expired list/outage preserves manual/selected/Add behavior. | Positive Google automatic **no-retention** completion/recovery, retained ambiguous-list/no-winner, zero-egress manual, skipped prefill and wholly stale zero-write cases; expired/disabled/cleanup negatives. Registry storage flag never grants retention. |
| ACP-8 D30 | Language display groups preserve row identity/eligibility and discovery; no frontend matching/auto-confirmation. | Jest list/sheet tests with known/unknown/different languages and selected result >5; red missing groups. Conditional OQ-P1 placement. |
| ACP-9 R06/OD-3 | With 02d installed: DB before old/new worker, 8b rollback after prefill; pause/drain, recorded 8b artifact + rollback manifest disables OL automatic permission/role/order; SQL hook stays installed. Google stays off if 8c already switched. | Extend AC8-10 before/after-8c matrix: readback, zero new OL automatic lists, new no-list completion skipped/no_retention, original saved/skipped receipt replay unchanged; fresh/expired/v1-v2/selected/explicit/cache/ISBN remain policy-coherent. No old Google-primary rollback target. Red new source-policy/receipt behavior missing. |
| ACP-10 R07/R04 | API roles cannot write edition state/effects or invoke private helper; wrong store/claim/session mutates nothing. | Feature red: valid retained automatic completion should persist bounded options/source binding, but baseline saves none. Existing denial cases are green regression controls. Once installed, verify helper's actual effective ACL/RLS, role operations and wrong-scope/claim/session zero writes. `undefined_function` or a missing table never counts as behavioral red. |
| ACP-11 R06/02b section 6.2 | Prefill/request/Select both arrival orders, exhausted lease/job lock, **and direct legacy lookup-candidate/choice-FK interleaving** (section 3.2). | Native barriers/pg_locks/pg_stat_activity, 2s lock/10s statement limits; successful fenced result or P9_STATE_CONFLICT refresh/stale; no 40P01/no HTTP retry. Assert §3.2 neutral wording in server envelope/client registry/recovery/rendered sheet for both known contention rollback and changed authority; old clients retain code/refresh handling. Prove same-row invariant or stop partial 8a for reviewed correction; no global cycle-free claim from new-worker tests alone. |

## 8. Build packages and documentation

| Package | Scope / size-risk | Review stop |
|---|---|---|
| P0 | Verify 8b contract/receipt/versions, source state and language decision / S | Fresh read-only preflight under separate authority; no guessed migration number. |
| P1 | Worker/SQL/app/native red tests / M-high | Observe feature failures before code/SQL; races use independent connections. |
| P2 | Proposed one migration: prefill/helper/hook recovery, lock/source-policy/read mapping, monotonic refresh version / L-high | OQ8-5 rule amendment first; known contention uses existing P9_STATE_CONFLICT. No automatic cache command/ranker/proof tables. 300-500 soft target; >~800 stop/re-scope; separate creation/application gates. |
| P3 | External automatic-list transport, canonical-choices mutation return/refresh authority, paired DTO and sheet/list UI, §3.2 neutral server/client conflict messages / M-L | Actual RPC-to-client conflict/wording/old-client and QueryClient race proofs; no new error code, author cache or automatic full-list reuse. No slice-9 matcher. |
| P4 | Independent review, focused SQL/worker/Jest/native/ACL/build, rollback/expiry proof / M-high | Validator + diff check; separate deploy after DB; allowed read-only sheet smoke, explicit search writes require approved script. |

Implementation updates: this SDD and 02c/SDD-2 traceability; DOC-3 §5.2 and review
SDD for automatic list/explicit-refresh contract; data dictionary/current-vs-target/
migration ledger for actual SQL; verification tracker/38 for actual proof; map
03/04/06 only when their described paths/tests change. Orchestrator owns ACTIVE,
DOC-13 and tracker closeout under consolidated routing (02c §11.2). This task
changes these SDDs, the 02c activation appendix and approved pointers/map row;
no status files or DECISIONS links need edits in this correction.

## 9. Owner questions and rollout gates

| Owner decision | Recommendation and effect |
|---|---|
| OQ-P1: D30 language grouping now or with slice 9 display work? | Include presentation-only grouping here with the small search-button change, preserving stored order/eligibility. Deferring grouping requires Owner-recorded partial D30 acceptance; do not silently reorder data. |
| 02c OQ8-4 benchmark/activation | Prefill deploys after verified 8b/retention, independently of 8c; only OL automatic activation waits for 8c operational gates. No duplicate threshold decision here. |

No new decision is needed on write timing/counts/privacy: 02b §14 OQ3/OQ5/OQ6
already binds them. No source resets, refresh engine, new provider licensing or
invented permission. Before build collect read-only source/version/ACL/state/
in-flight evidence routed by 02c §11.1. **Prefill rollback:** under separate authority,
pause/drain, deploy recorded compatible 8b artifact and use the existing rollback
manifest to set OL `automatic_lookup_allowed=false`, `automatic_role`/`automatic_order`
null; read back before safe routes resume. Keep independently permitted explicit
search; Google stays disabled after 8c (before 8c, retain the staged no-retention
Google contract). The additive SQL hook remains installed; no separate disable control.
Configuration change itself creates no AutoReceipt. New no-list/manual automatic
completions use normal AutoReceipt with `prefill:{status:'skipped',reason:'no_retention'}`;
original saved/skipped receipts replay unchanged. Retain confirmed choices and
policy-aware reads: existing alternatives follow current permission/expiry, never
relabelled as a fresh explicit fetch. No new retained OL automatic list is fetched.
