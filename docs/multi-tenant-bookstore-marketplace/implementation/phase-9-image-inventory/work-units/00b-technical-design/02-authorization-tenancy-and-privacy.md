# WU0B Authorization, Tenancy, Privacy, and Observability Design

**Status:** `independently_approved`
**Database facts:** `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`

## 1. Authorization sequence

Every user boundary performs this order: verify gateway JWT; resolve authenticated user; strict-parse the request; load the target entity through the service boundary; derive final `store_id`; verify current membership/role and entity ownership; apply initiating-Owner/customer/public policy; compare expected version; then call a named transaction. A supplied `store_id`, storage path, actor ID, role, workflow state, or capability claim is never authority.

Worker boundaries require a gateway-verified service-role JWT, a claimed job ID, matching lease owner, unexpired lease, allowed job kind/purpose/store, and attempt state. Service authority is one action, not ambient user authority. RLS and revoked grants are backstops; privileged helpers use pinned `search_path`, schema-qualified references, and no client EXECUTE.

## 2. Actor and tenancy matrix

| Actor | Authorized design scope | Mandatory derivation | Explicit denials / evidence |
| --- | --- | --- | --- |
| Initiating Owner | C01–C10, C13 and Q01–Q04 for their pilot session; later same-store inventory commands | user → current store administration → target session `initiated_by` → store | Other Owner session, forged store, raw attempts/jobs/cost; Store A/B and two-Owner same-store denial |
| Same-store non-initiating Owner | C11–C12, C20–C26, Q03/Q05/Q06 when current store policy permits | user → current store administration → target inventory/store | Active session resume/mutation/close; silent takeover; support powers |
| Other-store Owner | None for target store/session/media/request | target entity store differs from membership | All read/write/sign/link/delete; forged-ID and cross-purpose denials |
| Owning request customer | C14, C17, C18 and customer Q11 for their request items | user → request customer → request item → store | Other customer/request, direct paths, Owner projection, exact private inventory |
| Owning-store Owner | C15, C16, C19, C28 and Owner Q11 | user → store administration → request item/store/inventory and current proposal | Other store/request/customer content; request-photo reuse as listing media; customer acceptance; direct hold mutation |
| Public/anonymous | Q08–Q10 only | eligible safe public projections, never private base tables | Sessions, inventory buckets, request/media/job/telemetry data |
| Worker/service | One claimed job/action; C12 publication retry, C27 media validation, C29 hold expiry; C30 only inside C28 transaction | service JWT → claimed job or internal definer call → kind/entity/store/purpose/lease | Client bearer, arbitrary operation/table, cross-purpose action, unclaimed work, ambient C30 execution |
| Platform support | No ambient WU0B scope | Future explicit support command and audited entitlement | Finance/reviewer/media/database administration; no implied bypass |

C12 exists only at `supabase/functions/image-inventory-publication-retry/index.ts`: the boundary classifies exactly one Owner or claimed-worker principal, derives store scope from inventory/job ownership, selects caller-specific grant/result rules, and calls one projection-only service with caller-kind+identity replay scope. Owner and worker boundaries must not duplicate C12. Q11 remains owned by the request-photo boundary, which selects exactly one customer or Owner projection.

## 3. Capability matrix

| Capability | Issuer and subject | Binding | Consume rule | Forbidden crossing |
| --- | --- | --- | --- | --- |
| Scan upload | C02; initiating Owner | actor, store, session, input ordinal, `scan_input`, envelope hash, expiry, nonce | C03 once after sanitization/media verification and version match | public-copy or request-photo link/promotion |
| Public-copy upload | C20; same-store Owner | actor, store, candidate/inventory, role/ordinal, `public_copy`, envelope, expiry, nonce | C21 once after approved derivative validation | scan/request media; publication without eligibility |
| Request-photo upload | C15; owning-store Owner | actor, store, request item, sequence 1–3, `customer_request`, envelope, expiry, nonce | C16 once after newly captured private media validation | listing/public media; other customer/request |
| Customer viewing | dedicated Q11 response | customer, request item, media ID, read-only purpose, short expiry | authorized fetch only; never persisted in normal DTO | store/customer enumeration or reusable URL |

Capabilities are opaque, short-lived, single-purpose, single-entity, single-store, actor-bound, revocable, and safe only after final authorization. Tokens and resolved paths never enter logs, events, normal DTOs, or database audit details.

## 4. Grant design target

| Resource class | `anon` | `authenticated` | service role | Backstop |
| --- | --- | --- | --- | --- |
| Public marketplace safe projections/queries | SELECT/EXECUTE only where explicitly public | same | controlled read/write | RLS plus positive projection |
| Owner/customer commands and safe reads | none | EXECUTE named boundary only | controlled | command authorization plus RLS |
| Sessions, inputs, candidates, private inventory/media/request state | none | no direct table write/read | named repository operations | RLS on API-exposed tables |
| Attempts, raw payloads, jobs, usage, cost, lifecycle | none | none | narrow repository/worker operations | service-only grants and RLS where exposed |
| Privileged helpers | none | none | named functions | non-public schema where practical, pinned path, revoked default EXECUTE |

Exact objects, current grants, policy expressions, helper exposure, connection role behavior, and storage policies are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 5. Projection and privacy matrix

| Data class | Owner | Customer | Public | Worker/internal |
| --- | --- | --- | --- | --- |
| Reviewed metadata/provenance summary | Own store/session; bounded | only approved request item display | approved authoritative display fields | IDs and normalized contract fields |
| Quantity | authorized private buckets | no exact quantity | availability band only | required bucket values for named command |
| Condition/damage | own store | approved request item | approved disclosure | normalized values/reasons |
| Media | approved role IDs and dedicated capability | own request evidence through capability | approved public-copy derivative only | internal IDs, validation summary, purpose |
| Jobs/provider/model | actionable state/code only | none | none | attempts, versions, bounded outcome; raw payload separately restricted |
| Store operations | own shelf/internal note where authorized | none | approved store profile only | named action fields only |
| Customer data | request linkage only where operationally required | own request | none | opaque customer/request IDs only |

All external DTOs are positive allowlists and recursively reject unknown keys. Raw model/provider payloads, prompts, costs, credentials, storage paths, worker leases, and service-role material are internal and excluded even from Owner responses.

## 6. Event and telemetry positive allowlist

Allowed fields are: correlation/command/job/entity/store/actor opaque IDs subject to access policy; operation/job kind; contract/schema/adapter/policy/query/ranking version; previous/new state; canonical outcome/error code; attempt number; duration; cache/fallback flag; bounded candidate/count/correction/reason category; cost units without monetary/vendor-secret detail; media byte/dimension/MIME validation summary; retention/deletion/hold status.

Events are append-only design records and use the same or narrower list. Audit details name authorization decision, entity/version, action and bounded reason—not request bodies. Metrics use low-cardinality operation/outcome/version labels; IDs belong in secured traces/audit only, not metric labels.

## 7. Forbidden-field matrix

| Forbidden category | Examples | Enforced at |
| --- | --- | --- |
| Media/content | image/base64 bytes, shelf imagery, EXIF/GPS, unrestricted title/description/private notes | DTO schemas, event builders, log lint/runtime assertions |
| Provider/model | raw request/response, prompts, tool calls, vendor credentials, unbounded text | adapter normalization and separate restricted persistence |
| Capability/security | signed URL/token, storage path, authorization header, service key, lease secret | response specialization, redaction, forbidden-key recursion |
| Customer PII | phone, address, unrelated profile/request data | actor-specific projections and repository selection |
| Private commerce/inventory | exact public quantity, acquisition cost, shelf location, internal notes, hold details | public projection/query contract |
| Authority injection | client store/actor/role/state/retry/path/command/idempotency from provider | strict request/adapter parsers and server derivation |

## 8. Required denial cases

The red suite must cover Store A→B and B→A for every session/input/candidate/inventory/media/job/request operation; two same-store Owners against initiating-Owner session authority; Customer A→B request access; forged target/store IDs; wrong media purpose/entity/sequence; expired/replayed capability; user token at worker boundary; service token without claim; direct table writes; unauthorized helper execution; `search_path` poisoning; RLS behavior through pooled/reused connections; and public/private recursive DTO leakage.
