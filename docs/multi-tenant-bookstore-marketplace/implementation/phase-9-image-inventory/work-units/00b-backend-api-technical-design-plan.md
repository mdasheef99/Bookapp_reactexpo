# Work Unit 0B: Backend and API Technical-Design Plan

**Definition status:** `definition_independently_approved`
**Date:** 2026-07-19
**Last corrected:** 2026-07-20 after independent-review findings
**Definition review:** `approved` on 2026-07-20 after correction verification
**Authority:** planning document only; WU0B technical-design implementation is not authorized
**Runtime/migration/external authority:** none

## 1. Purpose, authority, and source traceability

WU0B exists to translate the approved Phase 9 behavior and WU0A contracts into an implementation-ready backend/API design before any endpoint, repository, worker, migration, storage boundary, provider integration, or UI is authorized. It traces to Master SDD §§3–9 and 14; Data SDD §§2–10 and 12; Extraction SDD §§2–14; Review SDD §§5–13 and 16; Media/Security SDD §§3, 6–15; Marketplace SDD §§2–14; Photo Request SDD §§3–13; and the approved WU0 plan §§4–10.

WU0A remains authoritative for versioned contracts, deterministic policy, validation/error/provider/query/grant registers, fixtures, and red gates. WU0B may design how future components use those contracts; it may not duplicate, weaken, or replace them. This document defines the future design unit only. Its existence is not WU0B implementation authority and creates no runtime behavior.

## 2. Required reading and inspection for a future WU0B session

Read in the repository startup order: `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → Phase 9 `SESSION-START.md` → Phase 9 `TRACKER.md`. Then read:

1. Phase 9 SDDs 00–06, the approved WU0 plan, both detailed trackers, requirements traceability, data dictionary, current-vs-target audit, and complexity register.
2. `supabase/functions/_shared/imageInventory/README.md`, every WU0A contract/domain file, the Phase 9 fixtures, and all four `phase9_*.test.ts` suites.
3. `supabase/functions/_shared/marketplaceAuth.ts`, `serviceRoleAuthorization.ts`, and the current `store-application`, `store-profile`, `commerce-scheduler`, and `commerce-task-worker` entrypoints as existing boundary patterns, not automatic reuse authority.
4. Relevant Phase 6 request/photo-state source and migration contracts, current inventory/listing services, and current public discovery schemas before naming an interface.
5. Current migrations only as observed local evidence. Any uncertain live database/storage fact requires a fresh exact-project read-only Supabase audit under the separate gate in §18.

## 3. WU0B design deliverables

The implemented WU0B design must contain all of these explicit artifacts:

- command inventory and query inventory;
- actor/authorization and Edge Function-or-RPC boundary matrices;
- internal service/repository boundary map;
- request DTO and response/safe-projection inventories;
- worker/job contract and state-transition matrices;
- transaction-boundary matrix;
- idempotency and optimistic-concurrency matrix;
- canonical error-to-HTTP mapping tied to the WU0A error catalogue;
- event/telemetry positive allowlist and privacy/forbidden-field matrix;
- rate-limit, quota, and abuse-control plan;
- exact file-by-file allowlist for every later implementation unit, with no directory wildcard treated as authority;
- red-test-to-operation-to-acceptance mapping.

Every artifact must identify its owning SDD sections and WU0A contract/register. Unresolved database names, provider choices, quotas, and timeouts stay marked as later gated decisions.

## 4. Common command design record

Every command in §5 must define: actor; trust boundary; versioned input contract; server-side authority derivation; preconditions; transaction boundary; stable idempotency identity; expected-version/optimistic-concurrency rule; surviving effects after failure; stable `P9_*` errors and HTTP mapping; emitted bounded events; permitted telemetry; forbidden data; actor/store/IP rate limit; and an explicit statement that Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement effects are forbidden.

Shared rules:

- JWT identifies the actor; membership/entity lookup derives final `store_id`. A supplied store ID is never authority.
- External model/provider/storage calls occur outside database transactions.
- All writes use a stable command ID and idempotency key; stateful targets also require an expected version.
- Events contain IDs, action, version, outcome, and bounded codes only. Telemetry follows §14.
- Partial failure returns the canonical recorded result and truthfully identifies any surviving effect.

## 5. Complete future command inventory

| ID / future command | Actor, input, authority, and preconditions | Transaction, idempotency/version, and surviving effects | Errors/events, telemetry/rate, and exclusions |
| --- | --- | --- | --- |
| C01 `start_extraction_session` | Verified Owner; defaults/language/policy hints; derive eligible store and initiating Owner; no conflicting active-session policy | Create session + defaults atomically; actor/store/policy idempotency; no effect on denial | Owner/policy/quota errors; `session.started`; IDs/policy only; Owner/store rate; no commerce effect |
| C02 `authorize_image_upload` | Initiating Owner; active session, `scan_input` purpose, source kind, declared file envelope; re-resolve session/store | Persist one short-lived scan-input capability; expected session version; failed issue leaves no upload authority | Auth/state/quota/media errors; `input.upload_authorized`; no URL/token telemetry; store/user/IP rate |
| C03 `submit_accepted_input` | Initiating Owner; upload capability/media ID/hash; verify final media purpose, sanitization and session | Link accepted input and reserve one orchestration identity/cost unit atomically; replay returns existing job | Media/state/replay/quota errors; `input.accepted`; hash prefix/outcome only; no raw image/path |
| C04 `request_session_close` | Initiating Owner; session/expected version; all submitted inputs terminal | `active → closing`, reject new inputs, finalize `closed` summary atomically; unresolved candidates stay Needs Review | Processing/stale/auth errors; `session.close_requested|closed`; counts only; no silent commit/delete |
| C05 `update_candidate_review` | Initiating Owner; candidate/version and WU0A-bounded review DTO; same session/store | Update staged review snapshot only; candidate action idempotency; no inventory effect | Validation/stale/auth errors; `candidate.review_updated`; correction categories only |
| C06 `add_missed_candidate` | Initiating Owner; session/input/version and bounded manual identity | Create staged manual candidate; no vision job; stable session/manual ordinal identity | State/limit/validation errors; `candidate.manual_added`; no provider call |
| C07 `skip_false_candidate` | Initiating Owner; candidate/version/reason code | Mark `skipped_false_detection`; idempotent terminal result; never deletes shared data | State/stale/auth errors; `candidate.skipped`; reason code only |
| C08 `commit_candidate_private` | Initiating Owner; reviewed candidate/version, duplicate action, command/idempotency; mandatory complete Owner review | Atomic private inventory effect, candidate link, bounded audit/event; publication excluded; retry returns recorded result | WU0A errors; `candidate.committed_private`; IDs/outcome only; no provider/model call in transaction |
| C09 `increment_matching_inventory` | Initiating Owner; candidate, compatible target/version, quantity; recompute same-store compatibility | Lock target; increment total+available only; preserve reserved/sold/removed; one candidate action identity | Duplicate/quantity/stale errors; `inventory.quantity_incremented`; bucket deltas private |
| C10 `create_separate_inventory` | Initiating Owner; reviewed candidate/version and explicit separate action | Lock duplicate identity; create distinct private row atomically; request photos ignored as identity | Duplicate/state/quantity errors; `inventory.created_separate`; no image-similarity evidence |
| C11 `request_publication` | Same-store authorized Owner under future post-commit policy; inventory/version/publication intent | Record intent, reauthorize eligibility, run separately from private commit; inventory survives failure | Eligibility/media/publication errors; `publication.requested|published|failed`; no false published response |
| C12 `retry_publication` | Same-store authorized Owner or narrow worker; original commit/intent identity | Reauthorize and retry projection only; `mayWriteInventory=false`; same publication idempotency identity | `P9_PUBLICATION_FAILED` mapping; `publication.retried`; never create/increment inventory |
| C13 `mark_candidate_needs_review` | Initiating Owner; candidate/session version and bounded reason; derive the active session/store | Mark the staged candidate without inventory write; stable candidate action identity and expected versions | Auth/state/expiry errors; `candidate.needs_review`; counts/reason codes only; retrieval is Q03, not this command |
| C14 `request_current_copy_photos` | Request customer; request item/version/count 1–3; derive customer/item/store scope | Create item photo substate atomically with request version; no hold/payment effect by itself | Customer/state/limit errors; `photos.requested`; no customer PII/media URL |
| C15 `authorize_request_photo_upload` | Owning store authorized Owner; photo request/version, sequence 1–3, declared file envelope; derive request item/store and require `requested|uploading` | Persist one short-lived `customer_request` capability; expected photo-request version; failed issue leaves no media link or provided state | Auth/state/media/limit errors; `photos.upload_authorized`; no URL/token telemetry; store/user/IP rate |
| C16 `provide_request_photos` | Owning store authorized Owner; photo request/version and approved request-scoped media IDs | Validate newly captured media, link 1–3, then mark `provided`; upload alone is insufficient | Media/state/cross-purpose errors; `photos.provided`; IDs/count only |
| C17 `accept_request_photos` | Owning request customer; request/version and accepted item IDs | Atomically accept photo evidence, run the existing Phase 6 recalculation/hold seam, and permit `payment_ready` only if every existing guard passes; no provider-payment effect | Customer/stale/missing-media errors; `photos.accepted`; decision/count only |
| C18 `decline_request_photos` | Owning request customer; request/version and declined item IDs | Atomically decline/withdraw items and release or recalculate eligible holds/amounts through existing Phase 6 commands; cannot create a paid order | Customer/stale errors; `photos.declined`; decision/count only |
| C19 `mark_requested_item_unfulfilled` | Owning store authorized Owner; photo request/version/reason code | Mark item unavailable/unfulfilled and invoke existing hold/amount recalculation seam; idempotent | Auth/state/stale errors; `photos.unfulfilled`; bounded reason; no paid-order effect |
| C20 `authorize_public_copy_upload` | Same-store authorized Owner; candidate or inventory/version, `public_copy` purpose, media role, declared file envelope | Persist one short-lived purpose/entity capability; no public link or publication effect until validation/submission succeeds | Auth/state/media/limit errors; `public_media.upload_authorized`; no capability telemetry; store/user/IP rate |
| C21 `submit_public_copy_media` | Same-store authorized Owner; candidate or inventory/version and approved sanitized media IDs | Link bounded media roles/order and approval evidence atomically; re-evaluate damage/publication eligibility; never reuse scan/request media | Media/state/cross-purpose errors; `public_media.submitted`; IDs/count/role only |
| C22 `update_inventory_metadata` | Same-store authorized Owner; inventory/version and WU0A-bounded store snapshot | Update store-owned metadata only; identity edits trigger rematch, duplicate re-evaluation, and projection eligibility without mutating canonical truth | Validation/stale/auth errors; `inventory.metadata_updated`; correction categories only |
| C23 `adjust_inventory_quantity` | Same-store authorized Owner; inventory/version and bounded quantity transfer | Lock inventory/active holds and preserve `total = available + reserved + sold + removed`; stable action identity | Quantity/stale/auth errors; `inventory.quantity_adjusted`; private bucket deltas only |
| C24 `update_inventory_price_location_notes` | Same-store authorized Owner; inventory/version and bounded price, shelf/location, public/internal note changes | Update only store-owned fields atomically and refresh safe projection when public fields change | Validation/stale/auth errors; `inventory.commercial_details_updated`; exclude shelf/internal note from public DTOs, events, and telemetry |
| C25 `update_inventory_condition_damage_media` | Same-store authorized Owner; inventory/version, condition/damage/sellability, and approved public media links | Atomically update disclosure/link state; retract or block a listing that becomes ineligible; request media cannot be linked | Media/validation/stale errors; `inventory.condition_damage_updated`; bounded types/count only |
| C26 `set_inventory_publication_state` | Same-store authorized Owner; inventory/version and private/publish/pause intent | Record intent and reauthorize eligibility; publish through C11/C12 semantics, while private/pause retracts only the public projection | Eligibility/stale/auth errors; `publication.intent_changed|retracted`; never mutate quantity |

The WU0B implementation must decide whether C08–C10 are one externally callable command with internal actions or separate private service operations. It must not multiply public endpoints merely to mirror internal actions. C02, C15, and C20 are deliberately separate capability boundaries because scan, request, and public-copy media have different actor, entity, privacy, and retention rules. C22–C26 may share a transport endpoint only through a closed discriminated action contract; their authorization, transaction, idempotency, concurrency, event, and surviving-effect definitions remain separate.

## 6. Complete future query inventory

| ID / query | Actor and authorization | Safe projection, ordering/counts, exclusions, and cache sensitivity |
| --- | --- | --- |
| Q01 session summary | Initiating Owner; support only through separate audited action | Owner-safe counters/status/version; no payload/path/cost; session-ID stable; private/no shared cache |
| Q02 session candidates | Initiating Owner | Spine order + bounded review state; cursor by ordinal/ID; no raw output/provider internals; private/no shared cache |
| Q03 Needs Review | Same-store authorized Owner for bounded post-close workflow | Candidate-safe cards; stable updated-at/ID cursor; no other-store/session internals; private short cache only |
| Q04 Owner-safe candidate detail | Initiating Owner while session-bound; later same-store policy explicit | Reviewed snapshot, provenance summary, warnings and versions; exclude raw attempts/payloads/leases/cost |
| Q05 Owner inventory detail | Same-store authorized Owner | Store-owned fields and private quantity buckets only where approved; never expose other-store/private request data |
| Q06 publication status | Same-store authorized Owner | Intent/status/error code/version; exclude worker retry/lease/provider details; private short cache |
| Q07 internal marketplace book-match stage | Service-only query stage; never a client-facing listing feed | Resolve eligible edition/listing match identities and scores without a client cursor; output feeds Q08 inside the controlled query boundary and cannot be paginated independently by clients |
| Q08 public marketplace book search/store-grouped results | Public/anonymous or authenticated consumer | One eligible store/group; paginate store groups only with context-bound cursor and final `store_id` tie-break; `bookstore_count`/`offer_count`; no exact quantity or raw listing page |
| Q09 complete storefront catalogue | Public | Complete eligible catalogue, stable title/offer ordering; distinct-edition-group `title_count`; optional pinned match context |
| Q10 listing detail | Public | Approved metadata, price/condition/damage/public media only; no scan/request media, shelf, cost, internal notes |
| Q11 customer request-photo status | Owning customer or owning store through actor-specific projection | Photo state/version and short-lived capability issued separately after final auth; no cross-customer/store data; private/no shared cache |

Alias-match indication is match context only; every public projection displays original authoritative title/author. Cursor context binds normalized query, filters, ranking/query versions, page size, and last stable group identity; malformed or mismatched cursors fail closed.

## 7. Actor and authorization matrix

| Actor | Permitted future scope | Explicit denials |
| --- | --- | --- |
| Initiating Owner | Mutate/resume/close their active pilot session; review/commit its candidates | Another Owner’s session, another store, client-forged store, raw attempts/jobs/cost |
| Same-store non-initiating Owner | No pilot-session mutation/resume; later store inventory/publication and Needs Review access only if the design names a controlled command | Active session mutation, silent takeover, support powers |
| Other-store Owner | None for target store/session/media/request | All read/write/sign/link/delete actions |
| Request customer | Own request-item photo request, status, and accept/decline | Other customers, other requests, storage paths, direct media links |
| Public consumer | Safe marketplace projections only | Private inventory/session/media/request/telemetry data |
| Worker/service | One claimed job/action with server identity and least privilege | User bearer authority, arbitrary table access, cross-purpose operation |
| Platform support | Separately named, action-specific, audited intervention | Ambient finance/reviewer/media/database administration |

Every boundary re-resolves final entity ownership and server-derived `store_id`; RLS is a backstop. WU0B must design Store A/B, Customer A/B, forged-store, wrong-purpose, and unauthorized-function denial evidence.

## 8. Boundary and internal component design

WU0B must map each command/query to either a future Edge Function, controlled RPC, or service-only worker interface and justify the choice. Each public boundary defines JWT mode, actor resolver, request/response schema, grant, rate limit, idempotency, error catalogue entries, and safe logging. It must minimize callable surfaces and forbid direct client writes to authoritative tables.

The internal map must separate: transport/router; auth/capability resolver; DTO parser; orchestration service; domain policy; repository/transaction adapter; provider adapters; job claimant; media capability service; projection writer; event/audit writer; telemetry adapter. Routers cannot contain transaction/domain logic, repositories cannot authorize actors, and adapters cannot choose workflow state.

## 9. State-transition matrix requirements

- Session: `active → closing → closed`; `expired` is system terminal. Only the initiating Owner may request Close during the pilot.
- Close with nonterminal inputs leaves the session `active`. A successful Close rejects new inputs; already accepted terminal work is summarized, while already accepted jobs must have reached terminal input states before `closing` begins.
- Uncommitted candidates remain `needs_review`; Close neither commits nor deletes them. Policy may later auto-close/expire an inactive session only after terminal-input and retention rules, through a versioned system command.
- Input and candidate transitions must enumerate actor/system ownership, expected version, stale/replay result, and terminal behavior.
- Replays return recorded canonical outcomes. Stale commands return stable conflicts and cannot advance state.

## 10. Transaction and publication boundaries

Owner review is mandatory before any create or increment. Duplicate advice is same-store and recomputed under lock; private request photos are excluded from duplicate identity. Create-new and increment compatibility follow Data SDD §8 and Review SDD §§7–10. Quantity always satisfies `total = available + reserved + sold + removed` and increment changes only total+available.

The private inventory commit is the authoritative transaction. Publication is a separate idempotent operation. Projection failure records `committed_publication_failed` (or an independently approved equivalent), keeps inventory private, and returns truthful surviving-effect data. Publication retry reauthorizes eligibility and cannot create or increment inventory. No transaction spans vision, metadata, media, or other external calls.

## 11. Worker and job design requirements

Design job kinds for media validation/sanitization, vision extraction, metadata enrichment, alias proposal, publication retry, retention deletion, orphan reconciliation, and narrowly scoped request-photo lifecycle work. Each defines a bounded payload of internal IDs/version only, stable task identity, store/purpose scope, claim/lease owner and expiry, `FOR UPDATE SKIP LOCKED`-compatible claim semantics after database authorization, double-claim protection, attempt limit, transient/permanent classification, next attempt, one-vision-fallback eligibility, cost reservation identity, terminal/dead-letter outcome, crash recovery, Close awareness, and safe observability.

Cleanup must recheck links and legal/dispute/security holds, treat already-missing objects idempotently, and leave non-content deletion evidence. Orphan reconciliation classifies before deletion and cannot bypass a hold. Workers receive narrow service authority and never general client or model authority.

## 12. Marketplace query design requirements

Book matching and store ranking are separate versioned stages. Results group by eligible `store_id`, return one group per store, paginate store groups rather than pre-paginated listings, and use a stable final store-ID tie-breaker. Selecting a store returns its complete active public catalogue with the searched item pinned/highlighted and removable query context.

`bookstore_count` counts matching eligible stores; `offer_count` counts eligible public offers; `title_count` counts distinct active edition/title groups in the selected storefront. Exact quantities and private inventory fields are excluded. Approved aliases may match search only and never alter canonical/duplicate identity or authoritative display.

## 13. DTO privacy matrix

All external DTOs use positive field allowlists and reject unknown keys. Owner, customer, and public DTOs exclude raw provider payloads, raw model output, prompts, storage paths, provider costs/credentials, service-role data, internal retry state, worker leases, private customer information, and unapproved exact quantities. Signed URLs/tokens may appear only in a dedicated, short-lived capability response after final entity authorization and must never be persisted in normal DTOs.

Owner DTOs may expose bounded reviewed metadata, actionable state/error codes, versions, and authorized private inventory fields. Customer request DTOs expose only their item/photo state and approved evidence. Public DTOs are limited to the WU0A marketplace register plus later independently reviewed additions.

## 14. Event and telemetry positive allowlist

Allowed: opaque entity/store/actor IDs under access policy; command/query/job kind; contract/schema/adapter/policy version; state transition; stable outcome/error code; attempt count; duration; cache/fallback flag; bounded candidate/count/correction category; cost units without price/credential detail; media byte/dimension/MIME validation summary; retention/deletion/hold status.

Forbidden: image/base64 bytes, raw model/provider payload, prompts, signed capability/token, storage path, credentials/service-role material, customer phone/address, shelf imagery, unrestricted title/description/private notes, EXIF/GPS, worker lease secret, or authorization headers. Events/notifications use the same or narrower allowlist.

## 15. Provider, quota, rate-limit, and abuse boundaries

Design interfaces for primary vision plus at most one whole-image fallback, local canonical lookup before sequential metadata providers, alias generation after coherent metadata selection, and provider-field reuse/publication/attribution/cache/expiry policy. Provider output is untrusted and cannot set store, actor, retry, path, command, or state. No credentials/vendor selection/live call belongs to WU0B.

Cost reservation is store-scoped and idempotent; cache/replay cannot double-charge. The design must name per-command actor/store/IP limits, session/input/candidate/photo hard caps, provider circuit breakers, store/language/provider/global kill switches, and manual-entry fallback. Exact numerical quotas/timeouts remain later configuration decisions except locked limits of 15 candidates, one vision fallback, and 1–3 public/request photos.

## 16. Required red-test mapping

| Gate | Required future failing evidence before production implementation |
| --- | --- |
| Tenancy/auth | Cross-store read/write/sign/link/delete; forged `store_id`; initiating-Owner restriction; Customer A/B; unauthorized function/helper/direct table write |
| State/replay | Input after Close; nonterminal Close; stale session/candidate/request version; idempotency replay; duplicate candidate commit |
| Commit/publication | Quantity/hold race; request-photo influence on duplicate identity; publication retry attempting inventory mutation; private commit survival |
| DTO/privacy | Unknown DTO keys; forbidden/private-field leakage; signed capability in telemetry/event/notification; raw provider/model content leakage |
| Database privilege | `search_path` poisoning; ambient EXECUTE; direct authoritative write; RLS/grant mismatch; reused-connection cross-tenant denial |
| Marketplace | Malformed/context-mismatched cursor; duplicate/missing stores across pages; unstable tied ranking; incorrect bookstore/offer/title counts |
| Worker/cost/lifecycle | Double claim/lease expiry; cost-reservation replay race; crash recovery; cleanup-versus-hold race; missing-object deletion replay |
| Scope | Any callable endpoint, migration, provider call, storage/UI/runtime change, or Phase 7/8 behavior introduced by WU0B |

Each row must map to the WU0A `PHASE9_RED_IMPLEMENTATION_GATES`, the applicable SDD acceptance IDs, proposed future test filename, owning later unit, and expected red reason. Red tests precede their production code; CI uses recorded fixtures.

## 17. WU0B implementation write allowlist and non-goals

A separately authorized WU0B technical-design session may modify only this document and the six continuity/status documents named by the authorizing prompt: Phase 9 `SESSION-START.md`, `TRACKER.md`, `README.md`, both detailed trackers when needed, and DOC-13. It may inspect runtime source but may not edit it. Its completed design must provide an exact file-by-file proposed allowlist for each later production unit; that proposal is not authority until separately approved.

WU0B excludes SQL/migrations or application, Supabase schema/data changes, buckets/policies, callable/deployed Edge Functions or RPCs, live providers, credentials/configuration, repositories/services/workers/adapters, image processing, mobile UI, marketplace runtime, customer-photo runtime, generated types, dependencies, and Phase 7/8 implementation.

## 18. Acceptance, exit criteria, and later gates

WU0B may enter `implementation_complete_needs_review` only when every operation has actor/contract/auth/transaction definitions; every external DTO has a safe projection; every write has idempotency and every state change conflict behavior; every privileged boundary has denial evidence; every red gate maps to a test; the exact later file allowlists and boundary matrices are present; no migration or callable production endpoint exists; no Supabase/external mutation occurred; and continuity validation passes.

WU0B may enter `independently_approved` only after a later independent review inspects the completed technical-design artifacts, records an explicit verdict, and confirms that every required correction is incorporated. Implementation completion and independent approval are distinct gates and must never be recorded in one status transition.

Later authorizations remain separate and ordered:

1. WU0B technical-design implementation.
2. Independent WU0B review.
3. Fresh exact-project read-only Supabase schema/security/storage audit.
4. Exact database and migration design.
5. Migration-file creation.
6. Isolated migration testing.
7. Live migration application after another exact-project readback.

Migration-file creation and live application must never share one authorization. The corrected definition is independently approved; the next action requires separate user authorization for bounded WU0B technical-design implementation only. Definition approval does not authorize that implementation or any runtime, migration, Supabase/Storage, provider, or UI work.
