# WU0B Red Tests, Acceptance, Audit Questions, and Handoff

**Status:** `independently_approved`
**Original WU0B independent review:** `approved` 2026-07-22
**Bounded correction review:** `approved` 2026-07-22

## 1. Red-test mapping

These tests are future failing evidence before their production unit. WU0B creates no test files.

| Red-test ID | Protected requirement / owning SDD ID | Operations; boundary; test layer | Setup → hostile/invalid action | Expected status/error; database effect | Event/telemetry expectation | Unit |
| --- | --- | --- | --- | --- | --- | --- |
| RT-FORGED-01 | server-derived tenancy; MAS-03, MAS-AC04 | all private C/Q; OE/CE; Edge integration | Store A actor + Store B/forged `store_id` → target B | 403 `P9_OWNER_NOT_AUTHORIZED`; none | bounded denial code, no target content | U2/U3/U7/U9 |
| RT-TENANT-01 | cross-store isolation; MAS-AC04, MED-02/16 | C/Q private; RPC/RLS; database/RLS | pooled Store A connection → read/write B | denial/no rows; none | audit denial only | U2/U3/U7/U9 |
| RT-DIRECT-01 | no direct authoritative writes; MED-21 | future tables; database; database/RLS | authenticated role → INSERT/UPDATE table | permission/RLS denial; none | no domain event | U1/U2 |
| RT-RPC-01 | least-privilege functions; MED-21 | C30/future RPCs; RPC; database/RLS | client role → internal/service function | permission denial; none | no domain event | U1/U9 |
| RT-INIT-01 | initiator-only session; MAS-12, MAS-AC09 | C01/C04,Q01; OE; Edge integration | same-store noninitiator → resume/close/read initiator-only scope | 403 `P9_OWNER_NOT_AUTHORIZED`; none | bounded denial | U2 |
| RT-CLOSE-01 | terminal-input Close; EXT-06, REV-14 | C04; OE→RPC; database/integration | session active with nonterminal input → Close | 409 `P9_STATE_CONFLICT`; session stays `active` | close-rejected code only | U2 |
| RT-STATE-01 | exact input states; Master §6, EXT-02/06 | C03/input worker; RPC; contract/database | closed session or invalid source → accept/advance input | 409 state conflict; no transition | bounded state/error | U2 |
| RT-STATE-02 | manual candidate bounded; REV-12 | C06; OE→RPC; contract/integration | over cap/invalid session → add missed | 409/422; no candidate | rejection category only | U7 |
| RT-STATE-03 | false-detection disposition; REV-12/14 | C07; OE→RPC; database | stale/committed candidate → record skip disposition | 409 version/state; unchanged | bounded conflict | U7 |
| RT-STATE-04 | needs-review integrity; REV-14 | C13; OE→RPC; database | stale candidate → mark review | 409 version; unchanged | bounded conflict | U7 |
| RT-OUTCOME-01 | candidate/publication/outcome separation; MAS-11, REV-18 | C08–C12,Q06; contract/database | projection fails after private commit → attempt to persist `committed_publication_failed` as candidate/publication state | candidate `committed`, publication `publication_failed`, API outcome `committed_publication_failed`; invalid state rejected | one bounded publication-failed event | U1/U7 |
| RT-ALIAS-01 | canonical search-only aliases; DAT-11/13/14 | alias parser/storage contract; contract/database | round-trip every kind/source/status; submit `common_title`, legacy source, or persisted `superseded` status | canonical values round-trip; legacy/unknown values rejected; supersession records rejected+audit reason | provenance/status only, never alias text | U1/U5 |
| RT-PRICE-01 | private/public price boundary; REV-02/05 | C08,C10,C11,C24,C26; contract/database | save private at zero; publish zero; submit negative/fractional/unsafe integer | zero private succeeds; publish zero and invalid integers fail without public effect | bounded validation/publication code | U1/U7 |
| RT-ERROR-01 | exact stable errors; REV-19 | C01–C30,Q01–Q11; contract/unit | remove operation mapping, use unknown code, or omit required error metadata | contract fails; every operation error resolves to one registered `P9_*` definition | code/operation only | U1 |
| RT-INPUT-CAP-01 | reject more than 15 without truncation; MAS-01, EXT-02/03 | C03/input worker; contract/integration | submit/parse 16 visible candidates | entire input rejected; no candidate rows, truncation, or external-cost replay | observed count and bounded rejection only | U2/U4 |
| RT-LANGUAGE-01 | one selected language; EXT-04/05 | C01,C03/input worker; contract/integration | accepted output contains mismatched/mixed language candidates | selected-language policy rejects/skips as specified; no auto-route or fallback loop | language policy/version and bounded outcome only | U2/U4 |
| RT-REVIEW-01 | mandatory Owner review/model cannot bypass; MAS-02/05, REV-01 | C05,C08-C10; OE/RPC; contract/integration | provider/model output without Owner snapshot → commit | 409/422; no inventory | validation denial, no raw output | U7 |
| RT-COMMIT-01 | one atomic idempotent commit; MAS-06, REV-05 | C08/C09; RPC; database/concurrency | replay same candidate/key concurrently | canonical one result; one inventory effect | one commit event | U7 |
| RT-COMMIT-02 | explicit separate copy; DAT-16/19 | C10; RPC; database | stale duplicate advice → separate commit | 409 duplicate/version; none | bounded conflict | U7 |
| RT-QTY-01 | create/increment quantity equality; DAT-18, REV-13 | C09; RPC; database/concurrency | two increments/hold race | one serialized valid result; invariant always true | private bucket deltas only | U7 |
| RT-QTY-02 | controlled quantity edits; REV-13/15 | C23; RPC; database | reduce below active holds | 409 quantity invariant; unchanged | critical bounded code | U7 |
| RT-PUB-01 | truthful private/public separation; MAS-07/11, REV-18 | C11,Q06; OE/RPC; integration | projection failure after private commit | HTTP 202 `P9_PUBLICATION_FAILED`; one private inventory | failed publication event, no raw error | U7 |
| RT-PUB-02 | one owned retry boundary cannot mutate inventory; MAS-11, REV-18 | C12; dedicated AE→shared service→RPC; boundary/database | invoke exact C12 endpoint with Owner JWT, correctly claimed worker JWT, mixed credentials, unclaimed worker; prove Owner/worker endpoints reject C12; attempt mutation | each valid actor reaches one projection-only service; mixed/unclaimed/wrong endpoint denied; caller-scoped replay; inventory/quantity unchanged | caller kind plus bounded retry outcome only | U7 |
| RT-PUB-03 | pause/private retract only; REV-15/18 | C26; OE→RPC; database | pause published listing | projection retracted; inventory unchanged | intent/retracted event | U7 |
| RT-EDIT-01 | store edit cannot mutate canonical; DAT-08, REV-16/17 | C22; OE/RPC; database | metadata edit targeting canonical row | denial; canonical unchanged | correction category only | U7 |
| RT-EDIT-02 | private fields stay private; REV-15, MKT-09/12 | C24; OE/RPC; contract/integration | shelf/internal note in public projection | schema failure; no leak/projection update | forbidden-field signal only | U7/U8 |
| RT-EDIT-03 | damage/media eligibility; DAT-23/24, REV-09/11 | C25; OE/RPC; database | publish unsellable/unapproved media | 422; listing absent/retracted | eligibility code only | U7 |
| RT-MODEL-01 | untrusted model evidence; MAS-02, EXT-09/10 | vision adapter/candidate flow; IE/WH; contract/unit | output includes command/path/authority → parse | strict rejection; no state/inventory | schema category, no raw payload | U4 |
| RT-PROVIDER-01 | bounded fallback/coherent metadata; EXT-08/11, DAT-06 | provider jobs; WH; contract/unit | primary valid empty or conflicting editions → fallback/stitch | no invalid fallback/stitch; no DB write | adapter outcome/version only | U4/U5 |
| RT-COST-01 | no duplicate cost; EXT-13/14 | provider job/cost RPC; WH/RPC; worker/concurrency | two workers reserve same cost identity | one reservation/charge | one cost-unit outcome | U4/U5 |
| RT-MEDIA-01 | scan capability purpose; MED-01/13 | C02/C03; OE; storage/media | expired/wrong entity capability → submit | 403/422; no link/job | denial/validation summary only | U3 |
| RT-MEDIA-02 | request upload purpose; PHO-02, MED-12/16 | C15/C16; OE; storage/media | scan/public media ID → request supply | 422 `P9_MEDIA_NOT_APPROVED`; no request link | bounded purpose denial | U9 |
| RT-MEDIA-03 | public-copy purpose; MED-11/15 | C20; OE; storage/media | request photo → public capability/link | denial; no public object/link | bounded denial | U3 |
| RT-MEDIA-04 | approved derivative only; MED-14/15 | C21; OE/RPC; storage/media | unsanitized derivative → public link | 422; no projection/link | MIME/validation category only | U3 |
| RT-MEDIA-05 | claimed validation result; MED-14/19, PHO-03 | C27; WH/RPC; worker/storage | stale lease or invalid media → complete provided | 403/422/409; photo remains `uploading` | job outcome only | U9 |
| RT-PHOTO-01 | item-specific request; PHO-01 | C14; CE/RPC; integration | other customer/ineligible item → request | 403/409; no request | denial code only | U9 |
| RT-PHOTO-02 | validated 1–3 media; PHO-02/03 | C16/C27; OE/WH; storage/media | 0,4,old,wrong-purpose images → provide | 422; not `provided` | validation counts only | U9 |
| RT-PHOTO-DUP-01 | request media not duplicate evidence; PHO-14, DAT-17 | C08-C10,C16; RPC; contract/database | attach matching request photo → recompute duplicate | duplicate result unchanged | no image similarity telemetry | U7/U9 |
| RT-PHOTO-CONFIRM-01 | Owner confirmation before acceptance; PHO-04/08, DOC-6 §4.1 | C28; OE→Phase6 RPC; integration | `provided` media but no Owner qty/price confirmation → customer projection | no actionable proposal; no hold | no customer-ready event | U9 |
| RT-PHOTO-CONFIRM-02 | current price/quantity; PHO-04/08, DOC-6 §6 | C28/C30; OE/RPC; database/concurrency | stock consumed or price/qty changes → confirm/accept old proposal | 409 stale/quantity; old hold replaced/released atomically | proposal version/change only | U9 |
| RT-PHOTO-HOLD-01 | soft hold at Owner confirmation; PHO-04/08, DOC-6 §6.2 | C30; RPC; database | valid confirmation → create/refresh | active bounded soft hold and awaiting decision atomically | hold-created/refreshed | U9 |
| RT-PHOTO-HOLD-02 | hold expiry release; PHO-07/08/11, DOC-6 §6 | C29; WH/RPC; worker/database | expiry task at/after deadline | hold released, proposal/photo expired/recalculated | expiry/release only | U9 |
| RT-PHOTO-HOLD-03 | internal hold RPC not client callable; MED-21, PHO-08 | C30; RPC; database/RLS | authenticated client → execute C30 | permission denial; none | no domain event | U9 |
| RT-PHOTO-ACCEPT-01 | no acceptance before confirmation; PHO-04/05 | C17; CE/RPC; integration | photo `provided` without Owner proposal → accept | 409 state/hold required; unchanged | bounded denial | U9 |
| RT-PHOTO-ACCEPT-02 | active hold required/current; PHO-05/08, DOC-6 §6 | C17; CE/RPC; database | expired/missing/stale soft hold → accept | 409 hold/version; no firm hold/payment-ready | bounded denial | U9 |
| RT-PHOTO-DECLINE-01 | decline releases/recalculates; PHO-07/08 | C18; CE/RPC; database | current proposal → decline twice | canonical decline; soft hold released once | one declined/recalc event | U9 |
| RT-PHOTO-UNFULFILLED-01 | no proceed without evidence; PHO-06/07 | C19; OE/RPC; database | Owner cannot confirm → unfulfilled | item excluded; hold released/recalculated | bounded reason | U9 |
| RT-PHOTO-TENANT-01 | private customer/store media; PHO-09/10, MED-03/16 | Q11,C14-C19; AE/CE/OE/RLS; integration | Q11 customer and Owner paths each fetch own projection; mixed credentials or Customer A/Store A → B photo | exact actor DTO for valid path; 403/no rows for mixed/cross-scope; none | caller kind/denial only, no media metadata | U9 |
| RT-PRIVACY-01 | safe public projection; MAS-07, MKT-08/12 | Q08-Q10; PE/projection; contract/integration | inject/private fields in DTO | schema rejection/no leak | forbidden-field category | U8 |
| RT-MARKET-01 | raw matching internal; MKT-02/14 | Q07; MQ; Edge integration | client invokes raw match/paginates listings | 403/not exposed; none | denial only | U8 |
| RT-MARKET-02 | stores grouped before page; MKT-02/14 | Q08; PE/query; database/integration | tied multi-offer stores across pages | every eligible store once | page counts/version only | U8 |
| RT-MARKET-03 | context-bound cursor/counts; MKT-11/14 | Q08; PE/query; contract/integration | tampered/context-mismatched cursor | 400 `P9_CURSOR_INVALID`; none | cursor-error category | U8 |
| RT-MARKET-04 | complete storefront; MKT-03/04 | Q09; PE/projection; integration | selected store after match → catalogue | complete active catalogue, pinned context optional | counts only | U8 |
| RT-WORKER-01 | claim/lease authority; EXT-13/14, MED-19 | C27/C29/jobs; WH/RPC; worker/concurrency | double claim/stale worker finish | one claim/result; stale denied | attempt/lease outcome only | U4/U9/U10 |
| RT-LIFECYCLE-01 | hold-aware cleanup; MAS-AC07, MED-10/19 | lifecycle jobs; WH/RPC; worker/storage | legal hold or relink races deletion | no delete; evidence/hold preserved | lifecycle outcome only | U10 |
| RT-WORKER-02 | bounded retry/dead-letter recovery; EXT-13/14, MED-19 | all Phase 9 jobs; WH/RPC; worker/reconciliation | transient failures exhaust five attempts; crash after external success; retry permanent failure | no duplicate cost/effect; bounded dead-letter outcome; reconciliation/Owner-safe projection available; no support takeover | attempt/error/version/dead-letter counts only | U4/U5/U9/U10 |
| RT-SUPPORT-01 | interactive support excluded; MAS-12, MAS-AC09, MED-04/19 | all C/Q and recovery paths; boundary/security | support/finance/reviewer principal attempts takeover, arbitrary claim, or cross-store private read | 403/no rows; no state/data effect; initiating-Owner/worker/reconciliation paths remain available | bounded denial only, no target content | U2/U4/U10/U11 |
| RT-SCOPE-01 | no Phase 7/8 behavior; MAS-09, MAS-AC08, PHO-13 | all WU0B/future diff; validator/E2E | introduce payment-provider/paid-order/ledger/pickup code | scope check fails; no allowed DB effect | no Phase 7/8 event | U11 |

## 2. Operation coverage

The catalogue contains 30 commands (C01–C30) and 11 queries (Q01–Q11), with 58 detailed red-test rows. Every command identifies actor/trust boundary, strict request DTO, server-derived authority, preconditions, transaction, expected version, idempotency, surviving effect, stable error/HTTP mapping, events, telemetry/forbidden data, rate class and red references. Every query identifies actor/boundary, authority, projection, ordering/cursor/version/cache, failure effects, errors, rate and red references. The per-operation boundary table assigns exactly one primary boundary, governing SDD/WU0A references, red IDs and implementation unit. Common envelope rules are normative and must not be bypassed by a transport-specific shortcut.

## 3. Acceptance checklist

- [x] Seven cohesive artifacts exist and remain within 350 lines.
- [x] C01–C30 and Q01–Q11 are complete and use closed DTO/error/rate catalogues.
- [x] Actor, initiating-Owner, same/cross-store, customer and worker authority are explicit.
- [x] Server-derived `store_id`, RLS/grant backstops, capability purposes and denial evidence are explicit.
- [x] External projections, events and telemetry use positive allowlists with forbidden-field enforcement.
- [x] State, transaction, version, idempotency, quantity and failure-surviving-effect semantics are explicit.
- [x] Private commit and non-mutating publication retry are separate.
- [x] Job claim/lease/retry/cost/crash/lifecycle and provider/media interfaces are explicit.
- [x] Q07 internal matching and Q08 store-grouped pagination/cursor/count semantics are separate.
- [x] Customer request-photo flow uses only the existing Phase 6 pre-payment seam and excludes Phase 7/8.
- [x] Exact proposed future file paths are named without wildcard authority.
- [x] Database-dependent facts are marked `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.
- [x] No runtime, test, migration, provider, storage, UI, dependency, generated or Supabase change is part of WU0B.

## 4. Independent-review gate

This artifact set held `implementation_complete_needs_review` until a separate context-isolated review checked all artifacts against the approved WU0B definition, WU0A registers, Phase 9 SDD acceptance criteria and inspected repository boundaries; recorded exact verdict `approved`; and verified every required correction. It is now `independently_approved`; completion and independent approval remained separate transitions.

The independent reviewer must specifically challenge: command/query completeness; server-derived authority; same-store initiator rules; error catalogue extensions; surviving-effect truthfulness; quantity/hold races; publication retry non-mutation; worker lease/cost replay; media purpose crossing; public grouping/cursor counts; Phase 6 photo seam; proposed later file allowlists; and all database-audit markers.

## 5. Questions deferred to the fresh live audit

All are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`:

1. Exact project identity/health and live migration versions after this documentation unit.
2. Current inventory/listing/request/task columns, types, constraints, indexes, row counts and condition/provider values.
3. Quantity equality constraint validation state and any violating/adjudication rows.
4. Current RLS policies and direct grants for affected tables/functions through actual API/pool roles.
5. Function definitions, volatility/security mode, pinned search paths, EXECUTE grants and trigger dependencies.
6. Listing projection trigger/function fields, unique inventory identity and compatibility sequencing.
7. Current Phase 6 request-item/hold/recalculation command names, versions, locks and allowed pre-payment transitions.
8. Current job claim/lease/task schema and whether reuse or isolation is safer for Phase 9.
9. Storage buckets, object policies, legacy public listing exposure, purpose separation and existing object counts.
10. Advisor findings before/after scope classification, including pre-existing notices.
11. Query/index plans for initiator resume, duplicate advice, jobs, aliases, store grouping/cursor ranking, publication retry and lifecycle cleanup.
12. Exact migration filenames/order after evidence; proposed names in artifact 00 are not creation authority.

## 6. Unresolved non-database configuration gates

Concrete providers/models, vendor terms, supported-language rollout, prompt/model versions, quotas, timeouts, capability TTL, byte/pixel limits, circuit thresholds, retention/legal policy and pilot accuracy thresholds remain later configuration/legal/operations decisions. Locked bounds remain: 15 candidates, one vision fallback, 1–3 request/public-copy photos and WU0A validation limits.

Mobile accessibility, Android/iOS camera/gallery device evidence, poor-network/background behavior, and operational launch drills remain assigned to later runtime Unit 6 and pilot/release Unit 11. This documentation/contract correction does not claim or perform those runtime/release checks.

## 7. Handoff

Outcome: `wu0b_independently_approved`.

No database, migration, runtime or external authority follows from these artifacts. The only next action is: **Perform the consolidated Risk-Based Phase 9 SDD analysis in a new session.**
