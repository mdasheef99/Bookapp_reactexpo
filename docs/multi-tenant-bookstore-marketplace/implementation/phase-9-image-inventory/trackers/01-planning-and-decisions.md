# Phase 9 Planning and Decision Tracker

**Status:** `approved_baseline`
**Last updated:** 2026-07-27
**Purpose:** retain detailed product decisions, audit evidence, reconciliations, and deferred choices without inflating the master tracker

## Decision register

| ID | Decision | Status |
| --- | --- | --- |
| P9-D01 | Phase 9 first capture mode is `spine_stack`, maximum 15 books per image. | locked |
| P9-D02 | More than 15 detected spines causes reject/rescan; the system never silently truncates the image. | locked |
| P9-D03 | Camera and gallery/manual upload are both supported. | locked |
| P9-D04 | A session has only Start and Close, may contain multiple images, and ends with a summary. No user-visible pause/save/discard state. | locked |
| P9-D05 | Close is available only when each submitted input is terminal (`ready`, `failed`, or explicitly skipped). Leaving the app keeps the server session active. | locked by design delegation |
| P9-D06 | Session defaults cover condition, shelf/location, publication preference, language, and quantity=1. First-session publication default is private; a prior explicit preference may be reused. | locked by design delegation |
| P9-D07 | Owner-only pilot. Manager/staff concurrent scanning is deferred. | locked by design delegation |
| P9-D08 | One selected language per image/batch; English default. Non-selected-language candidates are skipped and reported. | locked |
| P9-D09 | Mixed-language detection/routing and automatic per-spine model switching are excluded. | locked |
| P9-D10 | Original-script title/author are authoritative. Each automated operation proposes at most three English aliases; bounded provider-recognized or Owner/platform-verified aliases may coexist. All remain search-only and provenance-bearing. | locked; amended 2026-07-19 |
| P9-D11 | Author names are transliterated, not translated. Alias text never determines identity or duplication. | locked |
| P9-D12 | Vision and metadata providers are adapters with configured primary/fallback choices. | locked |
| P9-D13 | At most one whole-image vision fallback occurs, only for technical, schema, or broadly unusable output. No per-candidate vision fallback. | locked by design delegation |
| P9-D14 | Metadata lookup uses local canonical data first, then primary/secondary providers sequentially. A coherent selected edition is stored; conflicting provider fields are not silently stitched. | locked by design delegation |
| P9-D15 | Visible image ISBN is a lookup clue only. Stored ISBN-10/13 values come from validated metadata or an owner-verified manual value. | locked |
| P9-D16 | Metadata includes description, identifiers, publisher/date, language, edition, volume, format/binding, pages, categories, cover, and provenance. | locked |
| P9-D17 | No background canonical metadata refresh in the first release. Selected metadata is frozen until a controlled rematch/correction. | locked by design delegation |
| P9-D18 | Uncertain/manual inventory may remain unmatched with `canonical_edition_id = null`; it cannot create shared canonical truth. | locked by design delegation |
| P9-D19 | Duplicate detection is advisory, same-store only, and excludes image/photo similarity. It never auto-merges. | locked |
| P9-D20 | Quantity increment is recommended only for the same validated edition, language, format, condition, and price with no copy-specific damage, notes, or approved public actual-copy/damage photos. Private customer-request photos never affect duplicate identity. | locked; clarified 2026-07-19 |
| P9-D21 | Shelf/location alone does not require a separate row, but the owner may keep it separate after warning. | locked |
| P9-D22 | Public conditions are `new`, `like_new`, `very_good`, `good`, `acceptable`; all except New have an accessible explanation marker. | locked |
| P9-D23 | Damage is a separate disclosure, not a base condition. Sellable damaged copies require public notes and 1–3 actual-copy photos; unsafe/unreadable copies remain private. | locked |
| P9-D24 | Owner review is mandatory. One candidate can fail without blocking the others; each commit is idempotent and atomic. | locked |
| P9-D25 | Owner may add a missed spine candidate and remove a false detection before commit. | locked |
| P9-D26 | Owner edits after commit are controlled store commands. Store-specific corrections do not overwrite shared canonical metadata. | locked |
| P9-D27 | Publication is a session preference, but only eligible candidates project publicly. Unmatched or incomplete inventory can remain private. | locked |
| P9-D28 | Marketplace home/search is bookstore-first. Every eligible matching store appears once, then opens its complete active catalogue. | locked |
| P9-D29 | Exact physical quantity stays private. Public counts distinguish bookstores, offers, and titles. | locked |
| P9-D30 | Metadata cover is the primary search-card image; approved actual-copy image may be fallback; otherwise use a placeholder. | locked |
| P9-D31 | Customer-requested current-copy photos are item-level, newly captured after the request, 1–3 images, and mandatory before confirmation/payment readiness. | locked |
| P9-D32 | If the store cannot supply requested photos, that item is unfulfilled/unavailable for the request. Repeated failures can pause/review the listing. | locked |
| P9-D33 | Scan input, public copy/damage media, and private request media have separate access and retention semantics. | locked |
| P9-D34 | Scan input deletes within 24 hours after session close; raw model/provider payload defaults to 7 days; unresolved normalized candidates default to 30 days. | locked by design delegation |
| P9-D35 | Completed request photos default to 180-day retention; unpaid/rejected/cancelled request photos default to 30 days; dispute/legal holds override deletion. | locked by design delegation; legal review gate |
| P9-D36 | Additional numerical quotas/timeouts/retry values remain policy-configurable. Hard safety envelopes are 15 books/image and 3 public/request photos. | locked |
| P9-D37 | Optional acquisition type, acquisition cost, cost-basis method, and printed MRP are collapsed private fields, not required review fields. | locked by design delegation |
| P9-D38 | Phase 9 does not implement payment, paid orders, pickup, refunds, ledger, settlement, translation UI, promotions, or image-based duplicate matching. | locked |
| P9-D39 | A valid inventory commit survives public-projection failure: candidate state remains `committed`, publication status becomes `publication_failed`, and `committed_publication_failed` is command/API outcome only. Publication retry is idempotent and cannot repeat inventory effects. | corrected 2026-07-22 |
| P9-D40 | Interactive support takeover and cross-store private-data access are excluded from Phase 9. Recovery uses initiating-Owner retry, lease-scoped worker recovery, and deterministic reconciliation; future support tooling requires separate design and authorization. | corrected 2026-07-22 |
| P9-D41 | Close remains available only after inputs are terminal; internal `closing` seals inputs/finalizes summary and is not an early-close workflow. | locked 2026-07-19 |
| P9-D42 | Provider provenance and field reuse rights are separate; storage/display/cache/attribution/expiry are adapter policy, not mobile discretion. | locked 2026-07-19 |
| P9-D43 | WU0 owns central validation, API error, grant, provider-policy, and bookstore-first query contract registers before migration design. | locked 2026-07-19 |
| P9-D44 | Canonical alias vocabulary is kinds `transliteration`, `translation`, `common_spelling`, `recognized_title`; sources `automated`, `provider_official`, `owner_verified`, `platform_verified`; approval statuses `proposed`, `approved`, `rejected`. `superseded` is a lifecycle/audit reason that resolves the persisted status to `rejected`, not a persisted approval status. | locked 2026-07-22 |
| P9-D45 | Private inventory accepts integer `price_paise >= 0`; publication requires integer `price_paise > 0`; negative, fractional, and unsafe integers fail closed. | locked 2026-07-22 |
| P9-D46 | The WU0A stable-error register is authoritative for C01–C30 and Q01–Q11; every operation maps only to registered `P9_*` codes carrying HTTP status, retryability, safe message, severity, surviving effects, and idempotency-key reuse semantics. | locked 2026-07-22 |
| P9-D47 | `p9-vision-v2` separates provider-normalized multimodal observations from application-owned product policy; provider-specific fields never escape the adapter. | locked 2026-07-26 |
| P9-D48 | Detected count over 15 is represented with zero observations and rejects the complete image; mixed-language/`und` observations remain immutable evidence but do not become candidates. | locked 2026-07-26 |
| P9-D49 | Any structural observation/envelope defect rejects the whole result; structurally valid identity-insufficient observations may be retained without a candidate. | locked 2026-07-26 |
| P9-D50 | Repeated visible copies remain separate by ordinal. Vision evidence, metadata selection, and Owner edits are separate persisted layers. | locked 2026-07-26 |
| P9-D51 | One token/attempt-fenced transaction owns analysis evidence, accepted candidates, input terminal state, and job completion; exact completion replay uses canonical hash plus completing-claim fingerprint. | locked 2026-07-26 |
| P9-D52 | Unit 4 uses forward M12 after M11: two immutable analysis tables, candidate lineage/publisher clue, widened detected count, and four service-only vision RPCs. | implemented and live-verified 2026-07-26 |
| P9-D53 | Unit 4 is fixture-only and has no fallback, metadata, inventory, publication, UI, migration-application, deployment, or real-provider authority. | locked 2026-07-26 |
| P9-D54 | The future real vision model is Gemini 3.5 Flash with stable model id `gemini-3.5-flash`; this is a handoff decision and grants no current integration/configuration/call authority. | future implementation decision 2026-07-27 |
| P9-D55 | The initial future metadata provider is Google Books API; provider policy, credentials, adapter implementation, and calls remain separately gated. | future implementation decision 2026-07-27 |
| P9-D56 | Metadata-provider expansion beyond the initial Google Books API integration remains deferred. | future implementation decision 2026-07-27 |
| P9-D57 | Superseding P9-D56 prospectively: the architecture supports exactly one configured primary and zero or one configured secondary metadata adapter, while secondary selection, enablement, credentials, and calls remain deferred and separately approved. | founder-approved provider reconciliation 2026-07-27 |
| P9-D58 | Metadata routing is local-first and permits at most one primary plus one allowlisted sequential secondary external attempt; an acceptable coherent primary result ends routing. | founder-approved provider reconciliation 2026-07-27 |
| P9-D59 | No provider is canonical authority; accepted metadata is one coherent single-provider snapshot or reviewed manual data, with no cross-provider field stitching and manual degradation under complete outage. | founder-approved provider reconciliation 2026-07-27 |
| P9-D60 | Gemini 3.5 Flash (`gemini-3.5-flash`) remains the initial future vision model, with one optional whole-image fallback seam; the fallback provider remains unselected/disabled and real-Gemini design is separate from Unit 5 Metadata/aliases. | founder-approved provider reconciliation 2026-07-27 |
| P9-D61 | Worker correctness must support multiple replicas through durable claims, leases, attempts, idempotency, fencing, graceful shutdown, spend reconciliation, capacity admission, connection budgets, observability, and simple store fairness; no hosting platform is prescribed. | founder-approved scale reconciliation 2026-07-27 |
| P9-D62 | Deployment capacity progresses from one replica to fixed multiple replicas and only then to bounded autoscaling after the explicit evidence gate; autoscaling, scheduling, thresholds, and deployment changes remain unauthorized. | founder-approved scale reconciliation 2026-07-27 |
| P9-D63 | Superseding P9-D34 prospectively, raw provider/model payload persistence is disabled by default. Separately approved, purpose-bound diagnostic capture has a maximum seven-day deletion deadline; normalized provenance/evidence is the ordinary path. Provider/model credentials cannot enter mobile, Git, documentation, build arguments, logs, telemetry, errors, or model context. | F1-F3 correction 2026-07-27 |
| P9-D64 | Superseding only the model-ID portion of P9-D54/P9-D60, the initial primary vision model is configuration-driven `gemini-3.5-flash-lite`. The earlier Gemini decisions remain historical; the optional whole-image fallback remains unselected and disabled. | founder decision 2026-07-27 |

## Source reconciliation

All listed corrections were applied to the root specification suite on 2026-07-19 and were included in the final terminology/link validation.

| Source | Required correction |
| --- | --- |
| DOC-0 | Replace book-first discovery example with bookstore-first search/storefront behavior. |
| DOC-1 | Separate media classes, server-mediated upload/promotion, purpose-specific retention, model-output zero trust, and request-photo privacy. |
| DOC-3 | Add metadata description/richer edition fields, multilingual aliases, five conditions, separate damage, advisory duplicate matrix, and mandatory request-photo behavior. |
| DOC-4 | Make 15-spine same-language batch the first slice; simplify sessions; add adapters/fallback, aliases, quality gate, persistence, precise retention, and no auto-merge. |
| DOC-5 | Make home/search bookstore-first; define store/offer/title counts, full store catalogue, multilingual search, and cover/detail fields. |
| DOC-6 | Make requested photos mandatory, not optional, and block payment readiness until accepted/provided. |
| DOC-8 | Add minimal batch defaults/review UX, condition explanations, damage workflow, post-push edits, and required requested-photo response. |
| DOC-13 | Replace `single_cover` next step with this SDD set and 15-spine first slice. |
| DOC-14 | Add orthogonal item photo-request gate to the existing `awaiting_customer_decision` path without adding a parallel order-request state machine. |
| implementation/README | Refresh active milestone from pre-Phase-6 handoff to Phase 9 planning. |
| Phase 9 root tracker | Point to this folder and replace the old shallow implementation-unit list. |

## Live evidence snapshot

Audit performed read-only on 2026-07-19 after `get_project` verification.

- Project `ahntbtktjjmvfosgkmgn`, `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, Postgres 17.6.1.
- Public schema contains 37 `store_id` columns and zero `tenant_id` columns.
- `canonical_works`, `canonical_editions`, `book_metadata_sources`, `store_inventory`, and `marketplace_book_listings` exist with RLS.
- Phase 9 extraction/enrichment tables do not exist.
- `canonical_editions` lacks description, edition statement, volume, and format/binding.
- Inventory/listing lacks language, description, aliases, structured damage, and typed media relationships.
- Metadata provider constraint is hard-coded to Google Books, Open Library, ISBN provider, and manual.
- Conditions are hard-coded to `new`, `like_new`, `good`, `fair`, `damaged`.
- Five live inventory rows and five live public projections exist; all have condition `good`.
- The listing projection is unique on `inventory_id`; the trigger copies only its explicit current fields.
- Inventory quantity equality exists as a `NOT VALID` constraint and must be preserved by all Phase 9 commands.
- `image-extraction-inputs` is private/10 MB/JPEG-PNG-WebP.
- `inventory-photos` is public/5 MB and currently permits direct owner writes through shared policies.
- `order-dispute-evidence` is private/10 MB but is not request-scoped and is unsuitable as the only customer-photo boundary.
- Legacy public `listing-photos` uses user-ID path ownership and a broad SELECT policy; Supabase advisor flags bucket enumeration.
- Supabase advisor snapshot also contains existing global warnings for public-schema privileged functions and leaked-password protection. Those require separate remediation/intent review; they are not evidence that Phase 9 may use the same pattern.

## Review checklist

- [x] Explicit decisions from the discussion captured.
- [x] Delegated design choices resolved and marked.
- [x] Database terminology re-verified through Supabase MCP.
- [x] Existing schema, constraints, policies, trigger, buckets, and relevant advisor findings re-audited.
- [x] Complexity containment recorded.
- [x] Security/privacy architecture drafted.
- [x] Marketplace and customer-photo seams included.
- [x] Root specifications, local links, acceptance IDs, and locked terminology cross-checked.
- [x] Repository entrypoint, active router, Phase 9 session protocol, update matrix, and continuity validator created.
- [x] User/design approval (2026-07-19).
- [x] WU0 contracts/threat/migration-design plan approval (2026-07-19).
- [x] WU0A contract/test foundation independent approval (2026-07-19).
- [x] WU0B backend/API technical-design definition independent approval (2026-07-20 after corrections).
- [ ] Overall Phase 9 implementation-sequence approval; WU0/WU0A completion and WU0B definition do not grant it.
- [ ] Migration creation authorization.
- [ ] Supabase application authorization and exact-project re-verification.

## Append-only planning log

### 2026-07-27 — Unit 4B Gemini adapter

- Authorized scope: local red-first Gemini adapter implementation behind the
  existing provider-neutral vision seam.
- Decision history: P9-D64 narrowly supersedes only the model ID in P9-D54/P9-D60;
  those earlier entries remain unchanged.
- External mutations: none; no provider call, credential configuration,
  Supabase/Storage/database mutation, migration, deployment, scheduling, or
  autoscaling action.
- Status/gate: local implementation awaits one independent Unit 4B review; the
  optional vision fallback remains unselected/disabled and Unit 5 remains gated.

### 2026-07-27 — provider and scale architecture SDD reconciliation

- Authorized scope: documentation-only reconciliation from the approved provider change-impact audit.
- Completed: provider neutrality, bounded primary/secondary routing, coherent selection, cache/lineage/capability/cost/quality requirements, manual degradation, and horizontal/autoscaling-readiness requirements were reconciled prospectively.
- Historical handling: P9-D34 and P9-D54–P9-D56 remain unchanged as decision history; P9-D57–P9-D63 supersede or clarify them prospectively.
- External mutations: none; no provider call, credential, Supabase/Storage/Render/deployment/scheduling/autoscaling action.
- Status/gate: `needs_independent_review`; next action is an independent documentation review only.

### 2026-07-19 — continuity system

- Added repository `AGENTS.md` as the mandatory new-session contract.
- Added `implementation/ACTIVE.md` as the single active-phase router.
- Added Phase 9 `SESSION-START.md` with work-unit reading, Supabase, document-update, and closeout rules.
- Added a read-only continuity validator for required files, routing markers, local links, Phase 9 document size, and `git diff --check`.
- No product behavior, application code, migration, Supabase object, provider configuration, or data was changed.
- Next authorized action was user/design review of the planning package.

### 2026-07-19 — planning baseline approved

- User explicitly approved the Phase 9 planning baseline and authorized the Work Unit 0 plan.
- Product implementation, migration-file creation, and Supabase application remain unauthorized.
- Active work unit moved to `0_plan_authorized`.
- Next output is the reviewed contracts/threat/migration-design plan, not code or DDL.

### 2026-07-19 — Work Unit 0 plan completed

- Completed the planning-only Work Unit 0 contract, recorded-fixture, threat-test, migration-sequence, and forward-correction blueprint.
- Re-verified the exact development Supabase project and refreshed tables, constraints, data counts, projection trigger, buckets, policies, migrations, and advisor evidence read-only.
- No new product decision was introduced; unresolved model/provider/quota/bucket/retention values remain explicit implementation-time configuration or legal gates.
- No product code, migration file, provider call, Supabase object, storage object, or data was changed.
- Next authorized action is user review of the WU0 plan. Implementation and both migration permissions remain ungranted.

### 2026-07-19 — Work Unit 0 approved with corrections incorporated

- User accepted the review recommendation and authorized the documentation correction/commit only.
- Amended alias limits, request-photo duplicate exclusion, publication-failure survival, initiator-only session authority, provider reuse rights, central validation/error/grant/query registers, privilege requirements, quantity-validation wording, security tests, and eight logical migration groups.
- Retained terminal-input-only Close behavior; internal `closing` is race-safe finalization, not an early-close UI state.
- WU0 is approved. Contract/test implementation, migration-file creation, migration application, live provider calls, storage changes, and product code remain separately unauthorized.

### 2026-07-26 — Work Unit 4 fixture vision-analysis SDD readiness

- Reconciled the clean branch at `0a8e57a` and corrected the durable handoff from “uncommitted ingestion candidate” to committed local M11/runtime, still unapplied and undeployed.
- Re-verified exact project `ahntbtktjjmvfosgkmgn` read-only: M01-M08/M10 are live, M11/ingestion functions are absent, generic live jobs are worker-ID-fenced, private extraction tables remain client-inaccessible, and no ingestion/vision function is deployed.
- Finalized `p9-vision-v2`, count/language/repeated-position decisions, exact token/attempt job transitions, one persistence/replay transaction, minimum forward M12, stable errors, privacy boundaries, and 31 red-first cases.
- No production/test/migration file, provider call, Supabase/Storage mutation, deployment, stage, commit, or push occurred.
- Exact next gate: separate authorization for red-first local Unit 4 implementation including forward M12 creation/testing, with live application and all external/provider effects still prohibited.
