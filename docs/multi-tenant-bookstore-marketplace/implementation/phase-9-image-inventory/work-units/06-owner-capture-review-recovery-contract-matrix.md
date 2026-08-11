# Phase 9 Unit 6 Contract, Screen, Acceptance, and Subunit Matrix

**Status:** approved supporting authority for
[Unit 6 SDD](./06-owner-capture-review-recovery-ux-sdd.md)

**Date:** 2026-07-30

> **Unit 7A transition (2026-08-12):** every `duplicateAdvice`,
> `duplicateIntent`, `duplicate_choice_required`, and duplicate allowed-action
> definition in this historical Unit 6 matrix is **SUPERSEDED FOR UNIT 7A**.
> Before Unit 7A enablement, those values must be non-actionable and
> non-blocking; no duplicate choice is sent to or interpreted by commit.

This file contains only the four matrix types permitted by the Unit 6 design
brief. Source paths are repository-relative.

Path shorthand: `ownerIngestion.ts` is
`supabase/functions/_shared/imageInventory/runtime/ownerIngestion.ts`; M05 is
`supabase/migrations/20260722000005_marketplace_phase9_controlled_inventory_commands.sql`;
M11/M13 are the ingestion foundation/service-wrapper migrations; and M24/M25 are
the Owner variant decision/correction migrations.

## 1. Backend contract matrix

Classification meanings: **ready** = callable as-is; **adapter** = implemented
backend needs a strict mobile adapter; **gap** = security/product contract is
insufficient; **U7** = deliberately deferred to Unit 7.

| Owner action | Current symbol and source | Inputs / outputs | Authorization, lifecycle, replay | Evidence and classification |
| --- | --- | --- | --- | --- |
| Create session | `executeOwnerIngestion(start_session)` → `public.phase9_start_session`; `ownerIngestion.ts`, M05 | strict Edge request; defaults; returns `sessionId` only | JWT; server-resolved active Owner/store; idempotent C01; creates `active` v1 | Edge/runtime and `phase9Database` tests; **adapter** |
| Resume/discover | `phase9_owner_session_summary(sessionId)`; M05 | known ID → ID/store/language/status/version/basic counts | initiating Owner; read-only | cross-owner denial tested; no discovery/list → **gap** |
| Authorize upload | `executeOwnerIngestion(authorize_scan_upload)` → `phase9_issue_scan_upload`; M11/M13/M35 | session/source/MIME/bytes/ordinal/idempotency → capability, signed URL/token, expiry | JWT then service RPC rechecks actor/session; one-time path; no-store; `P9_SINGLE_IMAGE_LIMIT` is a bounded 409 until current-image removal | Edge and ingestion integration tests; **adapter** |
| Register media | `executeOwnerIngestion(complete_scan_upload)` → context/object checks → `phase9_register_scan_upload_completion`; M11/M13/M35 | capability/source/idempotency → input/job/state | object identity/hash/size/MIME rechecked; canonical replay; queues sanitation; concurrent second-current-image completion returns bounded `P9_SINGLE_IMAGE_LIMIT` | changed-object/replay tests; **adapter** |
| Remove current image | `executeOwnerIngestion(remove_scan_input)` → `phase9_remove_scan_input_v1`; M35 | session/input/expected input version/idempotency/command → skipped input plus session/presentation versions | server-resolved Owner/session; candidate lineage fails atomically as bounded `P9_INPUT_HAS_CANDIDATES`; no physical delete | Edge, mobile-service, structural, and PGlite tests; **adapter + RPC** |
| Start processing | registration creates `media_validate`; sanitation completion creates/advances vision work; M11/M12 workers | no Owner command; input/job IDs returned | service-only claims/leases/tokens, retry fencing | worker/runtime/PGlite/live fixture evidence; **ready through registration** |
| Read session status | `phase9_owner_session_summary`; M05 | basic counts/status/version only | initiating Owner; private RPC | minimal query test; lacks terminality/readiness/input stages → **gap** |
| Read sanitation/analysis | no Owner-safe input/job projection; raw tables service-only under M02 | required: per-input presentation stage, safe error, retry/terminal flags, versions | must derive initiating Owner and hide raw jobs/evidence | worker data exists but no Owner DTO → **gap** |
| Read candidates | `phase9_owner_session_candidates`; M05 | ID/ordinal/observed title/state/version | initiating Owner; ordered | minimal DB test only; no paging/detail/attention → **gap** |
| Read candidate detail | `phase9_candidate_detail`; M05 | ID → observed title/authors/language/state/version | initiating Owner via session | no selected/review snapshot, readiness, duplicate evidence → **gap** |
| Read metadata state | service-only M15 lookup/attempt relations; candidate has selected snapshot FK | required: closed match/manual/outage state and safe provenance | Owner must never read raw attempts/payloads/cost | Unit 5A tests prove backend persistence, not Owner projection → **gap** |
| Read selected snapshot | `phase9_selected_metadata_snapshots` behind hardened RPC-only mutation; M15–M17 | immutable normalized snapshot exists | service SELECT only; no authenticated table access | Unit 5A/M17 ACL evidence; safe Owner projection absent → **gap** |
| Retry failure | worker `phase9_fail_*` schedules transient retries; new upload path handles changed input | automatic retry status or new capability/input | worker-owned attempt policy; Owner must not forge retryability | worker retry tests; UI status needs gap DTO; **adapter after progress gap** |
| Remove false detection | `phase9_skip_candidate`; M05 | candidate/version/bounded reason/idempotency/command → candidate ID | initiating Owner; reviewable state; exact version; replay | PGlite skip/version evidence; **adapter** |
| Add missed candidate | `phase9_add_manual_candidate`; M05 | session/title/authors/language/idempotency/command → candidate ID | initiating Owner; reviewable active/closed; cap; no model/provider job | manual/commit integration evidence; output/detail is minimal → **adapter + detail gap** |
| Edit candidate draft | `phase9_update_candidate_review`; M05 | candidate/version/**arbitrary jsonb**/idempotency/command → candidate ID | initiating Owner; allowed state/version; replay | version behavior exists; WU0B requires strict DTO, current body does not → **gap** |
| Read variant proposals | `phase9_owner_search_variant_review`; M24; `parseOwnerVariantReviewPage` | store/status/field/author/cursor/limit → UI-safe proposal page + allowed actions | strict active Owner only; field/source/version scoped | Jest plus PGlite cross-role/store tests; **adapter** |
| Approve/reject variant | `phase9_owner_decide_search_variant`; M24; `buildOwnerVariantDecisionCommand` | store/proposal/expected version/action/reason/note/idempotency → canonical decision | Owner-only; candidate/proposal locks; exact replay; immutable audit | stale/idempotency/role/concurrency tests; **adapter** |
| Replace variant | `phase9_owner_replace_search_variant`; M25 | source/version/new text/lang/script/type/reason/note/idempotency → replacement IDs/version | Owner-only; candidate-first lock; validates source/equivalence/duplicates | replacement chain and two-connection evidence; **adapter** |
| Handle conflict | registered `P9_CANDIDATE_VERSION_CONFLICT`, `P9_VERSION_CONFLICT`, `P9_STALE_VERSION`, `P9_STATE_CONFLICT` | code + refetch canonical resource | no blind replay after semantic change | registers/variant tests; rich refetch DTO missing → **adapter + detail gap** |
| Close session | `phase9_close_session`; M05 | session/expected version/idempotency/command → session ID | initiating Owner; all inputs terminal; closes without commit/discard | close-state design and DB contract; canonical summary response is too small → **gap** |
| Unit 7A create-only commit | legacy `phase9_commit_candidate`; M05 | current inputs/results are not safe to connect because they accept caller business data and duplicate actions | exact auth/version/idempotency/locks required | **U7A gap**; forward replacement required by the Unit 7A SDD |

Future backend work must extend the Owner Edge/controlled RPC layer with strict
decoders and red cross-tenant tests. Direct authenticated reads of M02/M12/M15
tables are forbidden.

### 1.1 Target contract common rules

All eight target operations use Edge `phase9-owner-ingestion`, strict action
decoders, and `contractVersion='phase9-owner-ux-v1'`. The Edge boundary forwards
only typed RPC arguments and returns `{contractVersion, data}` or the existing
safe `P9_*` error envelope. Every RPC derives `auth.uid()`, resolves the target
session, requires active Owner/store eligibility, and requires
`session.created_by=auth.uid()`. A missing session and a session owned by any
other actor both return `P9_OWNER_NOT_AUTHORIZED`; they never reveal existence.
This specializes Q01-Q04/C04-C05 from
`work-units/00b-technical-design/01-command-query-and-dto-catalogue.md` to the
initiator-only pilot rule and preserves the M02 `created_by` authority.

Read requests reject idempotency and command fields. Mutation requests require
an idempotency key of 16-128 allowed characters and UUID `commandId`, matching
`supabase/functions/_shared/imageInventory/contracts/registers.ts` and
`contracts/ingestion.ts`. Read responses include the resource version used to
derive every readiness/presentation result. Pages use an opaque,
server-authenticated cursor bound to actor, session, scope, filters, ordering,
page size, and contract version. Default page size is 20; maximum is 50, reusing
`PHASE9_LIMITS.marketplacePageSize`. Ordering is immutable within a page chain:
inputs by `(created_at,id)`, session candidates by `(candidate_index,id)`, and
needs-review candidates by `(updated_at DESC,id DESC)`. A changed context,
malformed cursor, or page-size change returns `P9_CURSOR_INVALID`; a cursor is
nullable only when there is no next page.

Common safe errors are `P9_AUTH_REQUIRED` (401),
`P9_OWNER_NOT_AUTHORIZED` (403), `P9_REQUEST_INVALID` (400),
`P9_CURSOR_INVALID` (400), `P9_NOT_FOUND` (404),
`P9_STATE_CONFLICT` (409), `P9_VERSION_CONFLICT` (409),
`P9_CANDIDATE_VERSION_CONFLICT` (409),
`P9_IDEMPOTENCY_MISMATCH` (409), and `P9_INTERNAL_ERROR` (500), with retry and
safe-copy semantics from `contracts/registers.ts`. Operations narrow this list
below. No result contains raw jobs, provider/model payloads, evidence rows,
confidence/geometry, scan bucket/path/URL, signed capability, hash, cost,
attempt/lease/retry token, prompt, or private correlation.

`NeedsReviewMembershipV1` is shared by U6Q01 count and U6Q04 queue. It includes
only candidates whose session was initiated by the caller, whose session is
`active|closing|closed` (never `expired`), whose candidate retention has not
expired, whose disposition is not `skipped_false_detection`, and which satisfy
one of: state `needs_review|possible_duplicate|failed`; or state `ready` with
no current `reviewed` disposition or `reviewReady=false`. It excludes
`processing|commit_in_progress|committed`, every current `reviewReady=true`
candidate, and every expired/false candidate. Closed-session candidates remain
eligible until candidate retention expires.

U6Q04 uses a monotonic initiator-scoped `reviewScopeVersion` maintained by the
forward 6A migration on any queue membership/order change and any session
candidate addition. The first page returns that version; every cursor binds it.
A later page against a changed version returns `P9_CURSOR_INVALID` and the
client restarts at page one. This is the meaning of immutable page chain; it
does not claim a long-lived database snapshot. U6Q01 returns the same version
beside `needsReviewCount`, so discovery count and first-page membership can be
tested for parity.

### 1.2 Target operation registry

| ID / stable Edge action / stable RPC | Purpose and actor | Strict request (R=required, N=nullable) | Canonical response (all R unless marked N) | Version, paging, idempotency, stale/replay | Errors, privacy, migration, representative red tests |
| --- | --- | --- | --- | --- | --- |
| **U6Q01** `discover_scan_session` / `phase9_owner_discover_session_v1` | Discover the caller's one `active|closing` session plus their review count inside the same server-resolved active store. Authenticated eligible initiating Owner only. | `contractVersion`; no store/user/session hint and no cursor. | `activeSession: OwnerSessionLocator|null`; `needsReviewCount:int 0..MAX_SAFE`; `reviewScopeVersion:int>0`. Locator = `sessionId`, `status:active|closing`, `sessionVersion`, `startedAt`, `updatedAt`, `inputCount`, `candidateCount`, `attentionCount`. | Read-only; no key/replay effect. Unique M02 `(store_id,created_by)` active index makes 0/1 deterministic. Count uses `NeedsReviewMembershipV1` plus resolved `store_id`/initiator predicates; any changed result replaces cache. Local unapplied M37 forward-corrects the count while immutable live M35 remains unchanged. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_INTERNAL_ERROR`; no other store or Owner's count/ID. **Migration: yes**, new RPC plus review-scope revision. Red: 0/1 result; count/first-page parity; multi-store active-store isolation; same-store noninitiator/cross-store/staff/manager/support denied; client `storeId` unknown key; closing returned; two active rows fail invariant. |
| **U6Q02** `read_scan_session` / `phase9_owner_session_summary_v2` | Return the canonical safe session/default/count/close envelope. Initiating Owner only. | `contractVersion`, `sessionId:uuid`. | `OwnerSessionSummary`: IDs/status/version/timestamps; `defaults`; `closeSummary`; `allInputsTerminal:boolean`; `closeState:not_closeable|closeable|closed|expired`; `presentationRevision:int>0`. Exact fields are §1.3. | Read-only. `sessionVersion` is the expected Close version. A later version invalidates the whole result; client refetches. No cursor. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_INTERNAL_ERROR`; no provider/policy version internals. **Migration: yes**, new versioned RPC because M05 return row is insufficient. Red: exact keys/enums/nulls; each session state; noninitiator denial; no raw version/provenance columns; every close-summary category reconciles to scoped rows/Unit 7 outcomes. |
| **U6Q03** `list_scan_inputs` / `phase9_owner_session_inputs_v1` | Return safe per-image progress without exposing jobs/evidence. Initiating Owner only. | `contractVersion`, `sessionId`, `pageSize?:int 1..50`, `cursor?:string|null`. | `items: OwnerInputProgress[]`; `pageInfo:{nextCursor:string|null,hasMore:boolean}`; `sessionVersion`; `presentationRevision`. Each item is §1.3. | Read-only. Cursor binding/order per §1.1. Input versions are item-local; session version is observation context. Poll only while any item `polling=true`. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_CURSOR_INVALID|P9_INTERNAL_ERROR`; safe errors only, no job IDs/attempts/tokens. **Migration: yes**, new RPC over private relations. Red: all input/job combinations map deterministically; pagination no skip/duplicate; cursor tamper/context swap; same-store noninitiator denied; forbidden-key scan. |
| **U6Q04** `list_scan_candidates` / `phase9_owner_candidates_page_v2` | Return bounded cards for one session or the caller's own cross-session needs-review queue. | `contractVersion`; `scope:session|needs_review`; `sessionId:uuid` R for `session`, forbidden for `needs_review`; `attention?:all|needs_attention|review_ready` (`needs_review` scope permits only `all|needs_attention`); `pageSize?`; `cursor?`. | `items: OwnerCandidateSummary[]`; `pageInfo`; `scopeVersion:int>0` (equals initiator `reviewScopeVersion` for queue; session candidate-scope revision for session); `sessionVersion:int|null` (R value for session, N for queue). Summary fields are §1.3. | Read-only; per-scope order/cursor §1.1. Queue uses `NeedsReviewMembershipV1`; its cursor requires current `reviewScopeVersion`, otherwise `P9_CURSOR_INVALID`. Item `candidateVersion` controls detail/update. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_CURSOR_INVALID|P9_INTERNAL_ERROR`; no other initiator or duplicate target private fields. **Migration: yes**, replace minimal M05 list and same-store M05 `phase9_needs_review` semantics. Red: every membership state/session/disposition/expiry branch; count/page parity; initiator filtering; order/page stability; mutation-between-pages invalidation; card strict keys. |
| **U6Q05** `read_scan_candidate` / `phase9_owner_candidate_detail_v2` | Return one strict edit/readiness envelope. Initiating Owner only. | `contractVersion`, `sessionId`, `candidateId`; both must relate. | `OwnerCandidateDetail`: IDs/ordinal/state/version; `observed`; `metadata`; `review`; `duplicateAdvice`; `variantSummary`; `attentionCodes`; `readiness`; `allowedActions`; exact fields/enums §1.3 and §2.3. | Read-only. Authorize the session first, then look up the candidate only through that session. Random, absent, foreign-session, and session/candidate-mismatch IDs return the same `P9_NOT_FOUND` status/code/body after session authorization. Independent candidate/metadata/duplicate/proposal revisions stale pending edits. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_NOT_FOUND|P9_INTERNAL_ERROR`; no evidence/confidence/provider/cost/raw duplicate rationale. **Migration: yes**, new RPC. Red: equality of absent/mismatch/foreign candidate responses; every nullable branch; manual/no-match/outage; forbidden-key scan; noninitiator denial; committed/false read-only actions. |
| **U6C01** `update_candidate_review` / `phase9_update_candidate_review_v2` | Validate and persist only the strict Unit 6 review snapshot, returning canonical detail. Initiating Owner only; states `ready|needs_review|possible_duplicate`. | `contractVersion`, `sessionId`, `candidateId`, `expectedCandidateVersion:int>0`, `expectedMetadataRevision:int>0`, `review:OwnerCandidateReviewInput`, `idempotencyKey`, `commandId`. Unknown keys rejected; fields §2.3. | Full `OwnerCandidateDetail` after write, including incremented `candidateVersion`, unchanged/current `metadataRevision`, canonical normalized review, `candidateState=ready`, `reviewReady=true`, allowed actions. | Exact request/key replay returns recorded detail. Changed fingerprint=`P9_IDEMPOTENCY_MISMATCH`. Candidate mismatch=`P9_CANDIDATE_VERSION_CONFLICT`; metadata mismatch=`P9_VERSION_CONFLICT`; no write. Reapply uses both refreshed revisions and a new key. Successful validation requires no review blocker: `ready` stays ready; `needs_review|possible_duplicate` atomically becomes `ready` after required metadata/confirmation/duplicate choices resolve. Pending backend work disables Save. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_STATE_CONFLICT|P9_CANDIDATE_VERSION_CONFLICT|P9_VERSION_CONFLICT|P9_IDEMPOTENCY_MISMATCH|P9_INTERNAL_ERROR`; no inventory/variant/public write. **Migration: yes**, forward replacement for arbitrary M05 JSONB. Red: strict fields; all three source-state transitions; unresolved blocker rejection; selected→changed/selected→manual/manual→selected metadata races; exact/changed replay; two-writer stale; initiator denial; no Unit 7 effect. |
| **U6Q06** `read_scan_readiness` / `phase9_owner_session_readiness_v1` | Return authoritative terminality, review readiness, blockers, and current Close state without inventory effects. Initiating Owner only. | `contractVersion`, `sessionId`. | `OwnerSessionReadiness`: `sessionId`, `sessionStatus`, `sessionVersion`, `allInputsTerminal`, `closeSummary`, `blockerCounts` keyed by `ReadinessBlocker.code`, `nextBlockingCandidateId:uuid|null`, `closeState`, `closeAllowed:boolean`, `presentationRevision`. | Read-only. Derived in one database snapshot. Any session/candidate/input version change invalidates the result. Detailed blockers and ready candidates remain paginated through U6Q04/U6Q05; readiness never returns an unbounded ID array. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_INTERNAL_ERROR`; no commit eligibility promise or duplicate evidence. **Migration: yes**, new RPC. Red: each blocker/zero-candidate summary; every close-summary category including pre-Unit-7 zeros; nonterminal Close blocker; review-ready versus U7 eligibility; noninitiator denial; one-snapshot consistency. |
| **U6C02** `close_scan_session` / `phase9_close_session_v2` | Close a terminal session and return the canonical readiness/close envelope; create no inventory effect. Initiating Owner only. | `contractVersion`, `sessionId`, `expectedSessionVersion:int>0`, `idempotencyKey`, `commandId`. | `OwnerSessionReadiness` with `sessionStatus=closed`, incremented `sessionVersion`, `closeState=closed`, `closeAllowed=false`; canonical `closeSummary` and blocker counts preserved. | Same canonical request/key returns the exact recorded response. Same key/different request fails mismatch. Stale version=`P9_VERSION_CONFLICT`; nonterminal input=`P9_STATE_CONFLICT`; both write nothing. Closed exact replay succeeds; a new key against closed state conflicts. | `P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED|P9_REQUEST_INVALID|P9_STATE_CONFLICT|P9_VERSION_CONFLICT|P9_IDEMPOTENCY_MISMATCH|P9_INTERNAL_ERROR`; zero inventory/listing/projection/commit changes. **Migration: yes**, forward RPC; never edit M05. Red: every nonterminal input; terminal ready/failed/skipped close; exact close-summary keys/counts; exact replay; stale concurrent close; closed new key; initiator denial; inventory byte-equivalence. |

### 1.3 Target response DTO field catalogue

| DTO | Exact fields, required/nullability, and enums |
| --- | --- |
| `OwnerSessionSummary` | `sessionId`, `status:active|closing|closed|expired`, `sessionVersion:int>0`, `startedAt`, `updatedAt`, `closedAt:null|timestamp`, `expiresAt`, `defaults:{language:string,script:string|null,condition:new|like_new|very_good|good|acceptable,location:string,quantity:int 1..1000,publication:private|publish}`, `closeSummary:OwnerCloseSummaryCounts`, `allInputsTerminal`, `closeState:not_closeable|closeable|closed|expired`, `presentationRevision`. `storeId` and `createdBy` are intentionally absent. |
| `OwnerInputProgress` | `inputId`, `ordinal:int>=1`, `sourceKind:camera|gallery`, `inputState:uploaded|validating|queued|processing|ready|failed|skipped`, `inputVersion:int>0`, `presentationState:checking_image|finding_books|ready|needs_attention`, `safeCode:Phase9ErrorCode|null`, `retryState:none|server_retrying|new_upload_required`, `terminal:boolean`, `polling:boolean`, `detectedCandidateCount:int 0..15|null`, `acceptedCandidateCount:int 0..15|null`, `createdAt`, `updatedAt`. Uploading is local-only and never returned. |
| `OwnerCandidateSummary` | `sessionId`, `sessionStartedAt`, `sessionExpiresAt`, `sessionStatus:active|closing|closed`, `candidateId`, `inputId:uuid|null` (null manual), `ordinal:int 1..15`, `title:string`, `authors:string[]`, `language:string`, `candidateState:processing|ready|needs_review|possible_duplicate|failed|commit_in_progress|committed`, `candidateVersion`, `metadataState:pending|selected|manual|no_match|ambiguous|temporarily_unavailable|failed`, `reviewDisposition:reviewed|skipped_false_detection|null`, `attentionCodes:AttentionCode[]`, `reviewReady:boolean`, `updatedAt`. Expired sessions never enter the queue. |
| `OwnerCandidateDetail` root | `sessionId`, `candidateId`, `inputId:uuid|null`, `ordinal:int 1..15`, `candidateState` as summary enum, `candidateVersion:int>0`, `observed`, `metadata`, `review`, `duplicateAdvice`, `variantSummary`, `attentionCodes`, `readiness`, `allowedActions`, `updatedAt`. Every key is required; only explicitly nested nullable values may be null. |
| `OwnerCandidateDetail.observed` | `title`, `authors`, `language`, `script:null|string` with the §2.3 title/author/language/script types and bounds; normalized safe clues only. No confidence, geometry, ISBN clue from image, or analysis lineage. |
| `OwnerCandidateDetail.metadata` | `state` as summary enum; `revision:int>0` for every state; `selectionVersion:int>0|null`; `selectionId:uuid|null`; `canonicalEditionId:uuid|null`; `snapshot:OwnerMetadataSnapshot|null`. Snapshot/selection fields are required only for `selected` and null for `manual|no_match|ambiguous|temporarily_unavailable|failed`; `revision` still changes when those states change. No provider/attempt/cache/cost fields. |
| `OwnerMetadataSnapshot` | Required `title` 1..512, `authors` 1..20 each 1..256, `language` BCP 47 2..35. Nullable `subtitle` 1..512, `description` 1..5,000, validated `isbn10|isbn13` 10..32, `publisher` 1..256, `publishedDate` 1..32, `script` 1..16, `editionStatement` 1..256, `series` 1..256, `volume` 1..64, `format` 1..128, `pageCount` 1..100,000, `categories` 0..20 each 1..128, and allowlisted HTTPS `coverReference` 1..512. Bounds and normalization are exactly the provider-neutral values in `contracts/registers.ts` and `contracts/metadata.ts`; adapter/provider IDs, rationale, confidence, correlation, attempt, fetch time, and reuse/cost lineage are omitted. |
| `OwnerCandidateDetail.review` | `value:OwnerCandidateReview|null`; `reviewVersion:int>0|null`; null means never saved. The value follows §2.3 exactly and includes no arbitrary extension object. |
| `OwnerCandidateDetail.duplicateAdvice` | `state:none|possible_match|compatible_match|changed`; `version:int>0|null`; `targetInventoryId:uuid|null`; `matchReason:exact_validated_edition|exact_original_title_author_language|strong_original_match|fuzzy_possible_match|null`; `compatibility:{sameLanguage,sameFormat,sameCondition,samePrice,noCopySpecificDamageOrNote}:boolean` keys when advice exists; bounded `display:{title,authors,isbn10:null|string,isbn13:null|string,language,format,condition,priceMinor,availableQuantity:int>=0,hasDamage,hasApprovedPublicCopyPhoto,hasCopySpecificNote,location}` only when advice exists; `allowedIntents:(increment_quantity|create_separate|manual_match)[]`. This explains the warning without raw evidence/confidence/customer/order/reserved quantities. |
| `OwnerCandidateDetail.variantSummary` | `unresolvedCount:int>=0`, `proposalVersions:{proposalId,version,allowedActions:(approve|reject|replace)[]}[]`; no model/prompt/evidence. Existing M24/M25 detail remains separately fetched only when the sheet opens. |
| `OwnerCandidateDetail.readiness` | `reviewReady:boolean`; `blockers:ReadinessBlocker[]`; `derivedFromCandidateVersion:int>0`; `derivedFromMetadataRevision:int>0`; `derivedFromDuplicateAdviceVersion:int|null`. |
| `OwnerCandidateDetail.allowedActions` | subset of `save_review|mark_false|open_variant_review|add_missed|view_readiness`; returned by server and presentation-only. No commit/publication action exists. |
| `OwnerCloseSummaryCounts` | Required non-negative integers: `imagesSubmitted`, `imagesProcessed`, `imagesFailed`, `imagesSkipped`, `candidatesDetected`, `candidatesReviewReady`, `candidatesNeedsReview`, `candidatesFailed`, `falseDetections`, `manualMissedCandidates`, `committedInventoryItems`, `quantitiesAddedToExisting`, `privateItems`, `publishedItems`, `languageSkips`, `candidateCapSkips`, `qualitySkips`. Before Unit 7 effects, the four inventory/publication/quantity values are zero; later reads report actual bounded outcomes without granting Unit 6 mutation authority. |
| `OwnerSessionReadiness` | `sessionId`, `sessionStatus:active|closing|closed|expired`, `sessionVersion:int>0`, `allInputsTerminal:boolean`, `closeSummary:OwnerCloseSummaryCounts`, `blockerCounts` containing every `ReadinessBlocker.code` with non-negative integer value, `nextBlockingCandidateId:uuid|null`, `closeState:not_closeable|closeable|closed|expired`, `closeAllowed:boolean`, `presentationRevision:int>0`. It is a Unit 6 review/Close result, not commit eligibility. |
| `AttentionCode` | `input_processing|metadata_pending|metadata_manual_required|title_confirmation_required|author_confirmation_required|language_required|duplicate_choice_required|damage_details_required|field_validation_required|variant_source_stale|candidate_failed|review_ready`. Codes are server-derived current hints, never persisted candidate state. `review_saved` is intentionally absent because it is a one-shot local success announcement. |
| `ReadinessBlocker` | `code:input_processing|candidate_processing|candidate_failed|review_missing|title_unconfirmed|author_confirmation_incomplete|language_missing|metadata_choice_missing|quantity_invalid|price_invalid|condition_missing|damage_answer_missing|damage_details_missing|location_missing|publication_intent_missing|duplicate_intent_missing|variant_source_stale`; `candidateId:uuid|null`; `inputId:uuid|null`; `field:string|null`; `safeMessage:string`. Exactly one entity ID may be non-null. |

### 1.4 Mutation and privacy invariants

`U6C01` may atomically update only the candidate's strict review snapshot,
review disposition `reviewed`, candidate state from
`needs_review|possible_duplicate` to `ready` (or `ready` to `ready`) after all
strict blockers resolve, candidate/version timestamps, the initiator review
scope revision, and bounded audit/event evidence. It never writes metadata or
duplicate evidence. `U6C02` may update only session status/version/close
timestamps and idempotency/audit evidence. Neither may create/update inventory, listing,
canonical edition, public projection, alias/variant lifecycle, media links,
quantity, publication, or Unit 7 command state. Database functions remain
`SECURITY DEFINER` with empty `search_path`, fully qualified relations, explicit
client EXECUTE grants only on the Owner RPC, and private-table RLS/grants as
backstops. The forward migration and Edge decoder/tests belong to 6A; creation
or application requires separate implementation and database authority.

## 2. Screen and state matrices

### 2.1 Completeness coverage

| Topic | Product authority | Backend support | Frontend support | Unit 6 decision | Gap |
| --- | --- | --- | --- | --- | --- |
| Session entry | MAS-12; EXT-06; CON-12 | create + minimal known-ID read | Inventory tab only | hub Start/Resume/Needs review | recovery query |
| Camera/gallery | MAS-01; EXT-02 | source kind accepted | Image Picker | equal OS sources | adapter/routes |
| Preview/guidance | EXT-02/03; MED-06 | server authoritative | none | local preview + concise tips | components |
| Upload/progress | EXT-01; MED-01/13 | secure issue/register | no progress transport | XHR upload; server state after register | adapter |
| Sanitation | EXT-02; MED-06 | durable worker | none | input timeline + safe reason | Owner input read |
| Analysis progress | EXT-06; MAS-17 | durable job/vision | none | poll safe aggregate | Owner input read |
| Failure/retry | Master §8; Pipeline §12 | retry/fail codes | generic errors | transient auto; immutable new upload | progress DTO |
| Recovery/resume | MAS-12; EXT-06 | persistence/known-ID read | none | initiator active + review queue | recovery query |
| Candidate list | REV-04/07/14 | minimal list | none | virtualized attention cards | rich page |
| Metadata state | REV-03/20/21 | service-only lineage | none | bounded match/provenance | Owner DTO |
| Original title/authors | MAS-04/18; REV-22 | candidate/review data | generic forms | independent confirmation | rich detail/update |
| Field editing | REV-02/05 | arbitrary JSON update | none | explicit Save + exact version | strict DTO |
| False detection | REV-12 | skip RPC | none | confirm then disposition | adapter |
| Missed book | REV-12 | manual-candidate RPC | manual UI pattern | staged; no model rerun | adapter/detail |
| Duplicate warning | DAT-16–20; REV-07 | commit recompute only | simplistic legacy | advisory evidence/action intent | safe DTO |
| Condition/quantity | DAT-21–25; REV-02 | review target | legacy conflicts | five base conditions; damage separate | DTO/components |
| Private/public intent | MAS-07; REV-02 | defaults/review target | manual status only | stage intent; first private | strict DTO |
| Variants | MAS-18; REV-22 | complete Owner RPCs | none | exceptional field modal | adapter |
| Stale conflict | REV-19; Unit 5C-5 | versions/errors | generic copy | preserve/refetch/compare/resubmit | UX/detail |
| Offline | EXT-06 | server persists | NetInfo/banner | no upload/mutation queue | integration |
| Accessibility/performance | REV-08; REV §14 | n/a | partial | screen-reader/large-text/virtualization gates | tests/components |
| Analytics | Master §10; MED-09 | server metrics | Sentry only | bounded content-free UI events | adapter |
| Privacy | MAS-07/08; MED-09 | typed private media | general scrubber | no URI/bytes/URL/text persistence/log | allowlist |
| Unit 7 handoff | MAS-05/06/11; REV-01 | commit exists/excluded | none | readiness envelope only | U7 consumes |

### 2.2 Screen definitions

| Screen/modal | Definition | Calls and local state | Loading/empty/errors/offline/conflict | Accessibility and exit guard |
| --- | --- | --- | --- | --- |
| Inventory hub `/inventory` | **Purpose:** existing inventory plus scan entry/recovery. **Entry:** active Owner. **Display:** store, Start/Resume, needs-review count. **Edit:** none. **Primary:** Scan/Resume. **Secondary:** manual/reviews/current inventory. | Recovery summary + review queue; local expansion only. | Skeleton; no session/no reviews is normal; retry query; terminal auth routes gate; offline shows cached state and disables Start. | Heading/focus order, labelled status/actions; no unsaved guard. |
| Session setup `/inventory/scan` | **Purpose:** choose visible defaults. **Entry:** no active session, otherwise redirect Resume. **Display/edit:** language (current English), condition, shelf, quantity 1, private/public intent. **Primary:** Start. **Secondary:** Back/manual. | `start_session`; local strict form and pending idempotency key. | Submit spinner; missing defaults field errors; quota keeps manual enabled; offline disabled; active-session conflict refetches/redirects. | Label every control; condition explanations; large-text single column; dirty exit guard. |
| OS source picker | **Purpose:** camera/gallery choice. **Entry:** active session. **Display/edit:** system media permission/source. **Primary:** capture/select. **Secondary:** cancel/settings. | Image Picker; local permission state only; no backend until preview confirms. | Permission pending/denied; canceled is normal; offline choice disabled because upload cannot proceed. | Native labels; explanatory permission copy; cancel returns unchanged. |
| Preview `/inventory/scan/preview` | **Purpose:** verify one image and guidance. **Entry:** local picker asset + active server session. **Display:** bounded URI preview, source, size/type, frame/glare/count tips. **Edit:** Retake/Choose another. **Primary:** Upload. | authorize → XHR upload → complete; local URI/progress/capability held adapter-local. | Preparing/upload progress; no asset empty redirects; transport retry while valid; invalid/expired requests new capability; offline preserves mounted screen memory but disables upload. Process death before successful registration is explicitly non-resumable: recovery shows “That upload was not registered. Select the image again.” Server retention/orphan reconciliation owns unused staged object/capability cleanup; never the client. | Image description “selected spine photo,” progress role/live milestone, labelled Retake/Upload; guard before leaving active upload. Kill after authorization, mid-byte, and after bytes/before registration tests prove no discoverable input, bounded copy, and no duplicate registration. |
| Session progress/review `/inventory/scan/[sessionId]` | **Purpose:** authoritative input timeline + ordered candidates. **Entry:** initiating Owner. **Display:** counts, input stage/safe reason, candidate cards. **Edit:** none inline except card expansion. **Primary:** open next attention candidate. **Secondary:** choose replacement only after explicit removal, add missed book, or view summary. | Session detail + paged candidates; visible polling; local filters/expansion. | Skeleton; zero inputs prompts capture; partial failures local; terminal auth/expired to hub; offline cached/read-only; session-version conflict refetches. | Virtualized order, text+icon status, milestone announcements throttled; guard only for active upload child. |
| Reviews `/inventory/reviews` | **Purpose:** bounded cross-session needs-review queue for sessions initiated by this Owner. **Entry:** active Owner policy. **Display:** title/ordinal/status and friendly session age/expiry cue derived from `sessionStartedAt/sessionExpiresAt`, attention. **Edit:** filters only. **Primary:** open candidate. **Secondary:** back to hub. | U6Q04 `needs_review`; local filter/cursor. | Skeleton/empty “Nothing to review”; retry; offline cached/read-only; changed `reviewScopeVersion` restarts page one with stable focus. | List semantics, stable focus after pagination, accessible empty/expiry state; no dirty guard. |
| Candidate detail `/inventory/scan/[sessionId]/candidate/[candidateId]` | **Purpose:** confirm original fields and edit staged review. **Entry:** reviewable candidate. **Display:** source fields, safe metadata state, attention, advisory duplicate reason/compatibility and bounded inspection facts. **Edit:** title/authors/lang/script, match/manual, quantity/price/condition/location/notes/private-public, duplicate intent, and complete damage disclosure: Damage yes/no; conditional type checklist, public note, sellable, and complete/readable/safe confirmation. **Primary:** Save review. **Secondary:** false detection, variant sheet, back. | rich detail + strict review update; local form/candidate+metadata+duplicate base revisions/idempotency key. | Skeleton; metadata empty permits manual; field errors focus first exact field; Damage Yes reveals and requires conditional fields; unsellable forces private with consequence text; terminal false/committed/expired read-only/redirect; offline unsaved memory only; stale comparison/Reapply flow. | Field labels/errors/hints, logical focus, condition and damage explanations on tap/focus/screen reader, grouped checklist, announced conditional reveal/private consequence, no color-only attention, large-text reflow; dirty exit guard. |
| Missed book `/inventory/scan/[sessionId]/missed` | **Purpose:** add staged missed book. **Entry:** reviewable session. **Display/edit:** required original title/language, authors optional. **Primary:** Add candidate. **Secondary:** Cancel. | `phase9_add_manual_candidate`, then rich detail refetch; local form/key. | Submit; empty title validation; cap/session terminal; offline disabled; session conflict refetches. | Required labels, text keyboards, error focus; dirty exit guard. |
| Variant decision sheet | **Purpose:** exceptional field-specific decision. **Entry:** selected allowed proposal. **Display:** confirmed source, proposal, language/script, policy reason. **Edit:** action; replacement text/type when chosen; bounded note. **Primary:** Approve/Reject/Replace. **Secondary:** Leave unresolved. | M24/M25 RPCs; local action/form/version/key. | Loading proposal; no proposals hides entry; safe error; offline disabled; stale comparison/refetch, never force approval. | Announce field/author position and action state; modal focus trap/restore; replacement dirty guard. |
| Readiness summary `/inventory/scan/[sessionId]/summary` | **Purpose:** show terminal inputs and canonical close breakdown; close without committing. **Entry:** session known. **Display:** images submitted/processed/failed/skipped; candidates detected/ready/needs-review/failed; false and missed/manual counts; language/cap/quality skips; committed/quantity-added/private/published counts (zero before Unit 7 effects); blockers. **Edit:** none. **Primary:** Review next blocker or Unit 7 handoff when later enabled. **Secondary:** Close session/back. | U6Q06; U6C02 only after terminal inputs; no commit import. | Skeleton; all-zero summary says “No images or books yet”; zero categories remain labelled in expanded breakdown; nonterminal Close returns processing message; offline disabled; version conflict refetches. | Structured headings/counts, not color-only, close consequence text; concise summary first with expandable complete breakdown; no silent discard and explicit confirmation. |

### 2.3 Strict review-field constraints

The table is the complete `OwnerCandidateReviewInput` schema. Unknown keys,
control/bidi override characters, active content, paths, operational URLs, HTML,
Markdown links, scripts/commands, and SQL-like text are rejected using
`contracts/registers.ts` and `domain/validation.ts`. Text normalization is trim
plus Unicode NFC while preserving original script/case; empty optional text
normalizes to null. Client validation is guidance only; the RPC is authoritative.
`U7=yes` means Unit 7 must refetch and revalidate, not that Unit 6 may commit.

| Field | Exact type / required-null meaning / enum and bounds | Normalization and authoritative cross-field rule | `review_ready` / mutable in U6 / U7 |
| --- | --- | --- | --- |
| `originalTitle` | R string, 1..512 Unicode code points. Never null. | trim+NFC; plain text. Must correspond to independently confirmed title source; Owner edit does not mutate evidence/canonical truth. Bound from `PHASE9_LIMITS.titleChars`. | Required / yes / yes |
| `authors` | R array, 0..20 entries; each string 1..256. Empty means genuinely unknown/not visible, not omitted validation. | trim+NFC each; preserve order; reject empty/duplicate-after-normalization entries. Bounds reuse `authorCount/authorChars`; author absence is permitted by Owner Review §8/REV-23. | Array decision required; every present author confirmed / yes / yes |
| `originalLanguage` | R BCP 47 string, 2..35. | `canonicalBcp47`; current English is a session default only. Per-field detection/Owner confirmation remains authoritative. | Required / yes / yes |
| `script` | R key with value ISO 15924 Titlecase string of exactly 4 ASCII letters or null. Null means not safely determined; it does not mean Latin. | Server validates language/script/text coherence using `searchVariantScripts.ts` when present. | Not alone a blocker when null; invalid coherence blocks / yes / yes |
| `metadataChoice` | R object `{mode:selected|manual, selectionId:uuid|null}`. `selected` requires ID; `manual` requires null. Read-only resolution state is `pending|selected|manual|no_match|ambiguous|temporarily_unavailable|failed`. | Server verifies the selected immutable snapshot belongs to candidate/current selection version. Manual keeps canonical link nullable and never stitches provider fields. | Required; pending choice blocks / yes / yes |
| `quantity` | R safe integer 1..10,000. | No coercion/fraction; canonical `PHASE9_LIMITS.quantity`. This is staged intent only and changes no quantity bucket. | Required / yes / yes |
| `priceMinor` | R safe integer 0..2,147,483,647 paise. | No decimal/string coercion. `0` is valid only for private intent; `publish` requires `>0`. Bound from `PHASE9_LIMITS.moneyMinor`. | Required; cross-field violation blocks / yes / yes |
| `baseCondition` | R enum `new|like_new|very_good|good|acceptable`. | Exact Phase 9 vocabulary from Data SDD §7/M04; `fair` and `damaged` are rejected. Damage is separate. | Required / yes / yes |
| `damageDisclosure` | R object `{hasDamage:boolean, damageTypes:DamageType[], damageNote:string|null, isSellable:boolean, completeReadableSafe:boolean}`. `DamageType` bounded default: `cover|binding|pages|water|staining|writing|missing_parts|mould_or_contamination|other`; 0..9 unique values. Note null or 1..1,000. | `hasDamage=false` requires empty types/null note. `hasDamage=true` requires >=1 type and note. `isSellable=true` requires `completeReadableSafe=true`; missing essential pages, unreadable, severe mould/contamination, unsafe damage, or disabling water damage forces false/private. Type enum is a Unit 6 bounded default because current schema is controlled-but-unenumerated; changing it requires design review, not coder choice. | Answer/details required; Unit 6 readiness does not claim damage-photo eligibility / yes / yes, including 1-3 approved photos for public |
| `shelfLocation` | R string, 1..120. | trim+NFC plain text. `120` is the bounded Unit 6 default because current M02 requires non-empty but defines no max. Owner-private; never public/telemetry. | Required / yes / yes |
| `notes` | R object `{publicNote:string|null,internalNote:string|null}`; each null or 1..1,000. | trim+NFC. Public note is safe display content; internal note remains Owner-private. Neither substitutes for required damage note. Bounds are Unit 6 defaults. | Optional content, object required / yes / yes for classification/visibility |
| `publicationIntent` | R enum `private|publish`. | Exact M02/M05 vocabulary. First-session UI defaults private; server validates current eligibility only in Unit 7. | Required / yes / yes |
| `duplicateIntent` | **Legacy/deferred for Unit 7A.** The nullable historical object may remain decodable for wire compatibility, but Unit 7A requires no duplicate choice and exposes no `increment_quantity`, `create_separate`, or `manual_match` control. | Before Unit 7A client enablement, duplicate advice must no longer block review readiness or Save, and the client must not show actionable duplicate choices. Any future duplicate workflow requires separate authority. | Not required for Unit 7A / no Unit 7A blocker / no commit effect |
| `originalFieldConfirmation` | R object `{title:boolean,authors:boolean[]}`; authors length exactly equals `authors`. | Title must be true; every present author position must be true. Confirmation is exact-field scoped and cannot activate a different source/variant. | Required / yes / yes |
| `candidateDisposition` | R enum `reviewed|skipped_false_detection`. | Review update accepts only `reviewed`. False action uses C07 and `skipped_false_detection`; it cannot be submitted inside a review update or treated as candidate state. | `reviewed` required for review readiness; false is terminal/non-ready / yes through separate commands / yes |

### 2.4 Persisted-to-presentation state mapping

Rows are evaluated top-to-bottom within their domain; the most specific matching
row wins. `Close block` refers only to the input-terminal Close rule. `Ready
block` refers to candidate `review_ready`, not Unit 7 commit eligibility. Local
`uploading` exists only between signed transport start and successful
registration and never appears in an RPC/database value.

| Domain / source persisted state or derived condition | Presentation code and label | Terminal / poll | Allowed Owner actions | Retry owner | Close block / Ready block | Accessibility announcement |
| --- | --- | --- | --- | --- | --- | --- |
| Local authorized upload not registered | `uploading` / “Uploading image” | no / byte progress | Cancel when safe; retry same bytes while capability valid | client transport | yes (not yet a server input) / n/a | Announce start, 25% milestones, complete/failure; not every byte |
| Session `active`, no pending Close | `session_active` / “Scan in progress” | no / while visible work | Choose the first image only when none exists; add missed, review, summary | none | derived from inputs / derived | Announce on first render only |
| Session `closing` | `session_closing` / “Finishing session” | no / yes | View only | server | yes until closed / derived | Announce once when entered |
| Session `closed` | `session_closed` / “Session closed” | yes / no | Review surviving staged candidates, summary | none | no / derived | Announce once |
| Session `expired` | `session_expired` / “Session unavailable” | yes / no | Return to Inventory | none | no / yes | Immediate assertive announcement, then focus hub action |
| Input `uploaded|validating`, or sanitation job `open|in_progress` | `checking_image` / “Checking image” | no / yes | Leave, view status | server worker | yes / n/a | Announce once per transition |
| Input `queued|processing` with vision job `open|in_progress` | `finding_books` / “Finding books” | no / yes | Leave; remove only if candidate count remains zero | server worker | yes / n/a | Announce once per transition |
| Job `retry_scheduled` and input nonterminal | `retrying` / “Trying again” | no / yes | Leave, view status | server worker | yes / n/a | Announce first retry and material delay only |
| Input `ready` | `input_ready` / “Image processed” | yes / no | Review candidates; remove only if candidate count is zero | none | no / n/a | Polite completion announcement |
| Input `skipped` with `P9_OWNER_REMOVED` | absent from current-input page / removal confirmation | yes / no | Choose one replacement, add missed | Owner chooses new upload | no / n/a | Announce removal and replacement action once |
| Input `failed` with terminal safe code/job `dead_letter|cancelled` | `input_failed` / “Image needs attention” | yes / no | Explicitly remove if candidate count is zero, then choose replacement; add missed | Owner, new upload/key | no / n/a | Assertive once; focus replacement guidance |
| Candidate `processing` or metadata `pending` | `candidate_processing` / “Preparing book details” | no / yes | View card only | server worker | no / yes | Announce only if focused card changes |
| Candidate `ready|needs_review|possible_duplicate` with returned `readiness.reviewReady=true`, no blockers, and current saved review | `review_ready` / “Ready for next step” | yes / no | View/edit, readiness summary | none | no / no | Polite after Save; include candidate ordinal |
| Candidate `ready`, local save response just applied | `review_saved` / “Review saved” | transient UI / no | Continue/reopen | none | no / recompute from response | Polite once; never persisted |
| Candidate `needs_review|possible_duplicate`, or any readiness blocker, unless the prior authoritative ready row matches | `needs_attention` / “Needs attention” | state-dependent / only if backend work pending | Open detail, Save, mark false, variant when allowed | Owner for fields; server for pending metadata | no / yes | Announce blocker count, not every poll |
| Candidate `failed` | `candidate_failed` / “Book could not be prepared” | yes / no | Mark false or add missed replacement when allowed | Owner deliberate action | no / yes | Assertive on opened card |
| Candidate `commit_in_progress|committed` | `candidate_read_only` / “Handled in inventory” | terminal for U6 / no | View only | Unit 7/outside U6 | no / yes for U6 handoff | Announce read-only reason |
| Metadata `selected` | `metadata_matched` / “Book details matched” | yes / no | Inspect or choose manual | none | no / depends on confirmations | Polite only when focused |
| Metadata `manual|no_match|ambiguous|temporarily_unavailable|failed` | `metadata_manual` / “Review details manually” | terminal for U6 / no automatic poll after terminal state | Edit manual fields, Save | Owner; server recovery may later refresh but cannot overwrite | no / choice missing until selected/manual | Announce manual path is available |
| Variant proposal `proposed` with allowed actions | `variant_available` / “Optional search wording to review” | no / no | Approve, reject, replace, leave unresolved | Owner | no / no unless exact source stale | Announce only when sheet opens |
| Variant `active|rejected|stale` | `variant_resolved` / “Variant reviewed” or “Source changed” | yes / no | View; stale may review replacement | Owner for new proposal only | no / stale source yes | Announce action result or stale conflict once |
| All inputs terminal, session active, any candidate blocker | `closeable_not_ready` / “Session can close; books still need review” | derived / no | Review blocker, Close | Owner | no / yes | Summary heading announces both facts |
| All inputs terminal and at least one current review-ready candidate | `closeable_ready` / “Session ready to close” | derived / no | Close, review candidates | Owner | no / no for ready subset | Polite summary once |

## 3. Acceptance criteria matrix

| ID | Verifiable criterion | Subunit |
| --- | --- | --- |
| U6-AC01 | `/inventory` remains the Store Owner tab root after conversion to a nested Stack. | 6B |
| U6-AC02 | Every nested route re-enters the Owner gate and rejects unauthorized deep links. | 6B |
| U6-AC03 | Active-session and needs-review entry points use server recovery evidence, not local route memory. | 6A |
| U6-AC04 | Only an active Owner may enter; staff, manager, revoked, unauthenticated, and other-store actors are denied. | 6A |
| U6-AC05 | Only the initiating Owner reads/mutates/resumes/closes a pilot session. | 6A |
| U6-AC06 | Start saves visible defaults and exact replay returns the same session. | 6C |
| U6-AC07 | Leaving/backgrounding creates no pause state and server processing continues. | 6C |
| U6-AC08 | Close while an input is nonterminal leaves the session active and shows bounded guidance. | 6F |
| U6-AC09 | Close never commits or discards an uncommitted candidate. | 6F |
| U6-AC10 | Camera and gallery are equal supported sources with permission/cancel handling. | 6C |
| U6-AC11 | Preview gives framing/glare/count guidance; server over-15 rejection renders terminal recapture/manual guidance while the server remains authoritative. | 6C |
| U6-AC12 | Upload shows byte progress without logging/persisting its URI, bytes, URL, or token. | 6C |
| U6-AC13 | Capability expiry/object change obtains new authorization; successful registration replay does not duplicate input/job. | 6C |
| U6-AC14 | Foreground/reconnect/app relaunch recovers active session, input stages, and candidates from server state. | 6C |
| U6-AC15 | Logout/account replacement clears all private query/local workflow data but does not delete server state. | 6B |
| U6-AC16 | Missing/expired/unauthorized recovery returns safely to the hub without leaking existence. | 6C |
| U6-AC17 | Zero, one, fifteen, repeated-spine, and partial candidate outcomes render correctly. | 6D |
| U6-AC18 | Candidate cards preserve server ordinal and virtualize without rendering all expanded metadata. | 6D |
| U6-AC19 | Rich candidate detail exposes bounded selected metadata/attention/readiness and no raw evidence/payload. | 6A |
| U6-AC20 | Metadata outage/no match leaves manual reviewed inventory preparation available. | 6D |
| U6-AC21 | Original title and each author confirmation/edit are independent and exact-field scoped. | 6D |
| U6-AC22 | Strict review validation covers quantity, integer minor-unit price, five base conditions, location, damage, and private/public intent. | 6A |
| U6-AC23 | A saved review replaces local draft with returned canonical candidate/metadata revisions; candidate stale conflict preserves edits, refetches, compares, and requires explicit reapply; unsaved exit is guarded. | 6D |
| U6-AC24 | False detection records only the disposition and does not delete/commit inventory. | 6E |
| U6-AC25 | Missed book creates one staged manual candidate without a vision/provider rerun. | 6E |
| U6-AC26 | Variant review exposes only backend `allowed_actions` and supports unresolved, approve, reject, and valid replacement. | 6E |
| U6-AC27 | Proposal stale conflict preserves the local decision/replacement, refetches, compares, and requires explicit reapply without overriding source linkage. | 6E |
| U6-AC28 | Transient worker retry is displayed as server-owned; terminal image retry creates a deliberate new upload. | 6C |
| U6-AC29 | Candidate-review Save reuses its key only for the same canonical request; changed fields/revisions use a new key, and validation/stale errors are not blindly retried. | 6D |
| U6-AC30 | Offline mode is explicitly read-only, keeps only mounted form memory, queues no mutation, and refetches before re-enable. | 6F |
| U6-AC31 | Scan URI/bytes/hash, signed capabilities, raw text/payloads, and PII never enter persistence, logs, analytics, or route params. | 6F |
| U6-AC32 | Scan media never appears as public preview, cover, duplicate signal, or customer-request media. | 6F |
| U6-AC33 | All actions/status/errors work with screen reader, 44×44 targets, logical focus, text alternatives, and non-color cues. | 6F |
| U6-AC34 | Candidate/edit screens reflow at narrow widths and large text without clipped controls or forced two-column fields. | 6F |
| U6-AC35 | Condition explanations work on tap/focus/screen reader and use the exact Phase 9 vocabulary. | 6D |
| U6-AC36 | Fifteen candidates remain responsive with virtualized cards and bounded visible polling on representative low-end Android. | 6F |
| U6-AC37 | Three sequential captures do not retain unbounded image bytes/previews or create a foreground/reconnect fetch storm. | 6F |
| U6-AC38 | UI telemetry uses the named allowlist and contains no bibliographic/media/signed-capability content. | 6F |
| U6-AC39 | Unit, component, route, Edge/RPC, cross-tenant, recovery, native accessibility/performance, and privacy tests pass with recorded evidence. | 6F |
| U6-AC40 | Unit 6 contains no commit/publication adapter, call, optimistic effect, inventory mutation, or public projection; readiness alone is handed to Unit 7. | 6F |

## 4. Subunit dependency map

Each row is one implementation and merge boundary. “Expected areas” are
forecasts, not authority to change files outside that row.

| Unit | Exact scope and exclusions | Expected files/areas; contracts produced/consumed; state owner | Red tests and mapped AC | Migration/deployment; dependency, complexity, review and merge boundary |
| --- | --- | --- | --- | --- |
| **6A — Owner-safe backend contract foundation** | Produce U6Q01-U6Q06/U6C01-U6C02 exactly as §§1.1-1.4, strict review schema, initiator-only discovery/queue/detail/mutations/Close, pagination and canonical responses. Excludes routes, React Query, picker/upload UI, inventory effects, language rollout, and Unit 7. | Expected: one new forward migration after fresh authority, Owner Edge action decoder/adapter, shared DTO/validation/error registers, database/Edge tests, generated Supabase types only if migration later authorized. Produces all eight contracts plus monotonic review-scope/metadata revisions and exact close summary; database owns auth, persisted states, versions, replay, readiness. | Red first: strict keys/enums/bounds/cross-fields, every queue predicate branch/count-page parity/cursor invalidation, metadata/candidate stale races, exact post-save state transitions, close-summary reconciliation, exact/changed replay, cross-role/store/noninitiator, non-enumeration/privacy, close noninterference. Owns AC03-05,19,22. | Migration **expected but not authorized here**; deploy **separately authorized after migration review**. Depends M02/M05/M11-M28. Complexity **high/security-critical**. Independent backend/security exact-tree review. One merge containing only contract/migration/Edge/types/tests; no frontend navigation. |
| **6B — Inventory route, query, identity, and cache foundation** | Convert Inventory leaf to nested Stack, add route shells, strict mobile decoders/query keys for 6A responses, Owner-gate re-entry, identity-scoped cache clearing and deep-link denial. Excludes capture transport, business forms, backend migration, and all mutations except no-op query wiring. | Expected: `app/(store-owner)/inventory/**`, `src/features/imageInventory/{api,contracts,queries,identity,navigation}/**`, route/query tests. Consumes U6Q01/U6Q02/U6Q04/U6Q05/U6Q06. TanStack owns decoded cache keyed by auth user/store/session/contract; route params own opaque IDs; identity transition clears cache. | Red first: tab URL preservation, every deep link gate, unknown response keys, query-key isolation, logout/account/store switch clearing, cached-other-user denial. Owns AC01-02,15. | No migration/deploy. Depends approved/deployed 6A contracts; complexity **medium-high**. Independent navigation/identity/privacy review. One frontend-foundation merge; no capture/review UI. |
| **6C — Session entry, capture, upload, progress, and recovery** | Setup defaults, start/replay, OS camera/gallery, preview/guidance, signed upload byte progress/registration, safe input timeline, visibility polling, relaunch/foreground/reconnect discovery, transient/server and terminal/new-upload recovery. Excludes candidate editing and Close. | Expected: scan setup/preview/session routes; `CaptureGuidance`, `UploadProgress`, `InputTimeline`, recovery hub card; upload adapter/reducer/hooks and tests. Consumes existing C01-C03 plus U6Q01-U6Q03/U6Q04 summaries. Server owns session/input/job truth and orphan cleanup; reducer owns URI/progress/pending semantic key only; no durable draft. | Red first: permissions/cancel, exact start/register replay, URI/token privacy, capability expiry/object change, kill at authorization/mid-transfer/bytes-before-registration with non-resumable copy and no phantom input, background/relaunch/reconnect, polling, all safe states, 0/over-15/partial failure. Owns AC06-07,10-14,16,28. | No new migration beyond 6A; Owner Edge/mobile deployment only under separate implementation rollout. Depends 6A-6B. Complexity **high/transport-recovery**. Independent capture/security/native review. One merge; no candidate form. |
| **6D — Candidate review and strict field editing** | Historical implemented Unit 6 review surface. Its duplicate controls/requirements are **SUPERSEDED FOR UNIT 7A** and must be removed from the actionable review path before Unit 7A enablement; all other reviewed-field, explicit Save, and stale compare/reapply behavior remains. Excludes false/missed/variant decisions, Close, and commit/publication. | Current candidate route/forms remain the baseline; Unit 7A transition work hides duplicate panels/actions, makes legacy duplicate fields non-blocking, and preserves current candidate/review/metadata revisions. | Red first for the transition: duplicate advice cannot block Save/readiness, no duplicate action is rendered or sent, and all non-duplicate review validation remains unchanged. Historical Unit 6 evidence remains valid for its implemented checkpoint. | No deployment authorized here. Unit 7A transition change is part of the separately authorized red-first client/contract work. |
| **6E — False/missed candidates and variant decisions** | Confirm/record false disposition, create one staged missed manual candidate, M24/M25 field-specific approve/reject/replace/unresolved sheet, and proposal/source stale comparison. Excludes candidate-review Save conflict (6D), provider rerun, language benchmark/enablement, alias/admin UI, duplicate mutation, and commit. | Expected: missed route, false-confirm dialog, `VariantDecisionSheet`, action adapters/hooks/reducers/tests. Consumes existing C06/C07, U6Q05 refresh, and the three existing Owner variant RPCs. Server owns candidate/proposal/version/audit; modal reducers own only unsaved choice/replacement/key. | Red first: cap/session/state/version/replay, false non-delete/noncommit, missed no vision/metadata provider call, all M24/M25 actions/allowed-actions, same-store noninitiator denial, candidate-first lock/concurrency, stale source/reapply. Owns AC24-27. | No migration expected unless 6A detail projection needs a reviewed additive link; any such migration is separately scoped/authorized. Depends 6D. Complexity **medium-high/lifecycle**. Independent lifecycle/concurrency review. One merge. |
| **6F — Readiness, offline, privacy, accessibility, performance, telemetry, and Unit 7 handoff** | Readiness/canonical Close summary and review queue polish; offline read-only/refetch gate; allowlisted telemetry/privacy scans; complete loading/empty/error/a11y/large-text/low-end Android gates; exact readiness envelope handoff. Excludes any Unit 7 call, inventory/publication effect, runtime migration, or language rollout. | Expected: reviews/summary routes, readiness/offline/error components, telemetry allowlist, architecture/privacy/native/E2E tests, evidence docs. Consumes U6Q01/U6Q04/U6Q06/U6C02 and all prior UI. Server owns close/readiness/summary; network state gates actions; no offline queue/persistence. | Red first: every §2.4 mapping, all close-summary labels/zero categories/reconciliation, nonterminal/terminal Close and replay, offline mutation denial/refetch-before-enable, privacy scans, screen reader/focus/44x44/non-color/large text, 15-card/three-capture/fetch storm, no commit imports/calls. Owns AC08-09,30-34,36-40. | No migration/deploy except separately approved client release. Depends 6A-6E. Complexity **high verification**. Independent whole-Unit acceptance/noninterference review. Final Unit 6 merge boundary; Unit 7 remains a new authorization gate. |

Dependency order is `6A → 6B → 6C → 6D → 6E → 6F`. Each subunit receives
its own red/green evidence and exact-tree review before merge. Backend contract
migration work cannot be bundled with frontend navigation merely because 6B
consumes 6A.
