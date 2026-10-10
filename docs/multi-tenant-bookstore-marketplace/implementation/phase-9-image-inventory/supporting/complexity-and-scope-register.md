# Phase 9 Complexity and Scope Register

## 2026-10-08 - Task 6 client review checkpoint and confirmation gap

Task 6 separates existing Owner transport, batch read/keys and bounded commit
execution into cohesive modules to keep edited production source files below 350 lines.
One shared card lifecycle and one existing command-slot registry serve the
picker and Save/Add. Corresponding counters and actual confirmed server receipts
provide cache authority; no new client authority state machine, persistence,
provider adapter, UI, queue, database field or migration is added.

Supporting helpers each have one stable responsibility: transport, command DTO
creation using captureIds, scoped keys, cache/version guards or coherent draft
adoption. The new gap proposal is independently reviewable and does not split an
applied migration. Long existing evidence documents remain cohesive chronological
records; size is advisory, and required source/security/acceptance evidence is
preserved. [Checkpoint](../trackers/02-implementation-and-verification.md#2026-10-08---task-6-client-review-checkpoint-and-confirmation-gap).
Task 6 is incomplete pending the strict read-discriminant correction. Earlier entries are historical.


## 2026-10-08 - Task 5 independent-review correction

The bounded Task 5 correction uses one shared private projection resolver rather than duplicating scoped choice checks. Only M69 and its existing SQL test change as product/test artifacts. M69 remains 350 lines; the test remains below 350. No client/UI, new migration, service or later-task implementation.

[Correction evidence](../trackers/02-implementation-and-verification.md#2026-10-08---task-5-independent-review-correction). Locally verified; independent correction review is pending. Tasks 6-8 remain unstarted and M65-M69 remain NOT_APPLIED. Earlier checkpoints are historical.

## 2026-10-08 - Edition-picker Task 5 local completion

Task 5 reuses the original Add signature/receipt, review checks, candidate versions, inventory trigger and minute dispatcher. One cohesive forward local M69 contains narrow private delegates, coherent materialization and lifecycle clearing; its shared due predicate keeps clearing and backlog/failure reporting aligned. No table, column, new queue/service/cron, client/UI flow, provider call or merge/canonical behavior is added. New fixture/integration sources and M69 stay within 350 lines; the migration is one reviewable, authorized forward unit.

Historical cohesive documents retain their chronology and authority; line count is advisory under AGENTS/SESSION-START. This update keeps evidence in the existing verification tracker rather than creating arbitrary parts. [Actual proof](../trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-5-local-completion) records 30 focused/194 combined SQL and the remaining Task 6-8/live gates. M65-M69 remain NOT_APPLIED.

## 2026-10-08 - Task 4 bounded replay evidence

Task 4's review corrections add one nullable <=1024-byte receipt to the existing private card state, three private SQL validation helpers and narrow completion error classification. The receipt is the latest claim's hashed identity and original failure arguments, enabling response-loss replay after lease release or before a provider lookup exists. It contains no options/provider payload/plaintext token/status mirror and creates no history table, generic counter or worker queue. Existing job/request/claim authority remains mandatory. M65-M67 are byte-preserved; the single authorized local M68 is revised and NOT_APPLIED.

The correction integration suite and modified runtime/test sources remain below the source-size guideline. The existing cohesive forward SQL migration and historical verification log remain larger; semantic cohesion and reviewable responsibility take precedence over line targets. No Add/UI/provider/review-redesign scope is added. [Correction proof](../trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-4-review-corrections). Task 4 awaits correction review; Tasks 5-8 remain unstarted.
## 2026-10-07 - Edition-picker Task 2 review corrections

The Owner-authorized corrections restore picker §4.1 / DOC-3 §5.1 / DOC-4 §8: local reuse validates the complete Owner-safe metadata, a unique coherent exact text match remains a medium suggestion requiring confirmation, and ambiguous matches remain unresolved. M65/M67 are revised locally only; M65–M67 are NOT_APPLIED. The existing gateway, jobs, private-state permissions, selling fields and Add fence remain in force. No product scope or new migration was added.

Current authority, corrected handoff and verification are recorded in [the implementation evidence](../trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections) and DOC-13/TRACKER. Earlier checkpoints are historical.

## 2026-10-07 - Edition-picker Task 2 local completion

Task 2 is locally complete: private per-card state, controlled read/search/select, version/expiry/ownership guards, coherent local ISBN resolution, lookup-scoped attempt history, and explicit-operation admission. Task 1 remains complete. The Owner's “ok proceed” authorized local M65–M67 creation and disposable tests; these files exist locally and are NOT_APPLIED. No live database/Storage write, deployment, staging, commit, or push occurred.

Fresh proof: 34 disposable-database tests PASS; 4 affected Owner Jest suites / 303 tests PASS; strict Owner ingestion graph type check PASS. Real independent-connection races, provider-retention permission, worker execution/completion, Add/cleanup integration, client/UI/browser and rollout proof remain Tasks 3–8. No full-feature acceptance is claimed.

Current work unit: Task 2 checkpoint review. Exact next authorized action: review the Task 2 diff/evidence; the next implementation slice is Task 3 Google result envelope after Owner authorization. Sources: picker SDD §§4.3/5–6/8–9/11; Master MAS-02/03/07/12/17. Earlier dated checkpoints below are historical.

Task 2 retains one private relation and the existing job/replay/version infrastructure. It adds no shared alternative cache, copied bundles, background lookup, generic status/revision, manual edition-number control or new cleanup service. M65/M66/M67 split state, commands and operation fences by responsibility; all new source files stay below 350 lines. Migration-set checking was extracted into a cohesive 180-line helper before adding the forward allowlist; the pre-existing phase-wide validator remains a 1091-line orchestrator, with broad unrelated restructuring deferred. Real concurrency proof stays Task 8; Add/cleanup admission stays Task 5. Existing long phase status/audit/ledger documents were assessed as cohesive chronological/registry responsibilities; no pruning or equal-sized split is justified solely by line count.


## 2026-10-07 - Edition-picker Task 2 gateway/preflight checkpoint

Task 1 remains locally complete. Task 2 code/read-only preflight is now authorized: the strict authenticated Owner gateway and HTTP routing pass 303 affected Jest tests and a strict server type check. Database storage/commands are not implemented; local M65–M67 migration-file creation is awaiting the separate Owner approval required by AGENTS. No SQL/database/Storage/deployment/Git publication occurred. Tasks 3–8 remain pending. Current authority/status comes from DOC-13 and TRACKER; earlier checkpoints below are historical.

## 2026-10-07 - Edition-picker Task 1 contract checkpoint

The Owner authorized Task 1 on 2026-10-07. Contracts/fixtures and narrow compatibility are locally complete; Tasks 2–8 and database changes remain unstarted/unapproved. Source behavior remains picker SDD §§5–7/9/13.2. Current next action is Task 1 diff review; [implementation evidence](../trackers/02-implementation-and-verification.md) supersedes earlier planning-only status below.


## 2026-10-06 - Owner edition picker complexity boundary

Latest Owner display clarification EP-D14: each edition option in the metadata sheet shows its own cover image from its safe URL, title, all authors, and publication date; publisher, ISBN, and language are secondary details. Selection saves the coherent chosen metadata independently and follows the usual inventory Add flow, leaving one chosen cover on the scan card. This supersedes earlier text-only option rows. Owner chose relevance order with returned order preserved and Google attribution/book links. Picker §13.2 now defines Search Books wording and bounded unavailable/ineligible rows; EP-D11/13 scope cuts remain in force.

Latest Owner scope: alternatives are obtained and saved only after an explicit Owner lookup (EP-D13); automatic scan/cache/coalesced paths keep winner/outcome-only persistence and never copy alternatives. New manual edition-number editing before and after Add, numeric overrides, and Store View edition-edit extensions are deferred (EP-D11).

[SDD](../work-units/owner-edition-picker-sdd.md) §§4-8 uses a single on-demand acquisition path for all unfinished cards. Reuse the Google adapter, existing worker pool, per-card pending/fresh deduplication, version guards, idempotent Add, and lifecycle scheduler. Independently requested cards may each require one Google query; there is no cross-card alternatives cache or copying.

Essential remaining complexity: independent expiring options/current selection cannot replace the existing unique automatic snapshot; explicit jobs must support eligible ready/needs-review cards; repeated lookup attempts, stale replies, selection/Add races, cover provenance, and cleanup require proof. No mirrored request_status, option_set_id, selection_revision, or generic row version is added.

Deferred: new manual edition-number editing before/after Add and override materialization; automatic alternatives capture/propagation; Open Library, review redesign, catalogue deletion, automatic pagination, local catalogue browser, new worker service, cross-card explicit coalescing, canonical promotion, and production rollout. Provider display §13.2 now preserves relevance order with safe result envelopes/links and separate eligibility. These cuts remove draft requirements, not existing winner-only optimizations.


> **Current local PostgreSQL verification checkpoint (2026-09-12; supersedes the prior correction-only gate):** F-01 remains retracted; F-02 and F-03 remain corrected locally. Focused Jest passed 4 suites/181 tests, including the 3 lifecycle tests, and the in-memory PGlite fixture passed 5/5. The Owner-authorized disposable PostgreSQL 18.4 harness then ran at `127.0.0.1:55461` with data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912` and PID-scoped database `bookconnect_u8b_22652`. It applied the disposable baseline and M01–M60, passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` using independent connections, and passed the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` regression. Teardown was verified: the database/cluster directory is absent, the port has no listener, and no matching postgres process remains. M52–M59 are unchanged; M60 remains local and was not remotely applied. No remote database/Storage or application data was touched; no deployment, dispatch change, development-data deletion, staging, commit, or push occurred. Connected Edge/Storage verification remains unrun. Prior screen act/open-handle warnings remain historical unresolved evidence and did not affect these database checks. Next: review this local PostgreSQL proof and separately authorize connected Edge/Storage verification. No product behavior or inventory duplicate policy changed.


**Last updated:** 2026-09-13
**Implementation checkpoint:** Unit 6H duplicate-confirmation implementation is
locally corrected on the current feature branch; M60 was subsequently applied
during the authorized development rollout. M61 and M62 are also live once; the
bounded M62 detail-projection/Google conflict-evidence correction is now
database/function-live. The four structural-suite test debts are corrected and
structural regression is 14/14. Connected M62/worker/client verification
remains the rollout gate. The accepted
best-effort sidecar persistence interval remains a bounded availability risk,
not an identity or public-projection risk.

## Unit 6H review complexity and residual scope

M60 is a forward migration spanning canonical uniqueness, pending
confirmation state, private service-only resolution, Storage proof, lifecycle
locks, cleanup/dispatch eligibility, and completion compatibility. The review
kept M52–M59 unchanged and found no confirmed authorization, tenant-isolation,
Close-bypass, or lock-order defect. F-01 was retracted after proving M58's nested
constraint handling. F-02's RPC routing and F-03's local mutation lifecycle are
corrected with focused local coverage. Disposable independent-connection
PostgreSQL proof now passes. The remaining scope is connected Edge/Storage proof;
remote rollout remains a separate authorization.

## Unit 6G complexity assessment

The proposed Unit 6G feature is bounded medium-high work, not a rewrite. Most
business validation and the atomic commit already exist. Complexity is
concentrated in one versioned session/card projection, one new durable candidate
disposition, lossless compact-form state, and partial-success orchestration.

| Concern | Containment decision | Complexity effect |
| --- | --- | --- |
| Repeated setup entry | Required location plus optional nullable defaults; no last-used/preset system | Small additive session schema and form |
| Fifteen full detail forms/N+1 | One strict aggregate capped at 15; observed/metadata/blocker/attention DTOs reuse existing bounds; metadata detail only when sheet opens | Predictable payload/render/privacy cost |
| Save versus commit safety | Reuse strict review Save and M39 sequentially | No duplicate validation or second commit path |
| Add all/concurrent controls | One shared command slot per candidate; client coordinator runs independent commands at concurrency three, skips/reports Busy, and preserves partial success | No queue, duplicate commit, batch SQL transaction/RPC, or rollback protocol |
| Metadata identity choice | Reuse existing `selected|manual`; Use detected details is exact manual/null-selection and M39 manual provenance | No new enum, rematcher, canonical mutation, or second commit path |
| Unwanted real candidate | One disposition, v3 Close count, candidate-lock/commit fence, no delete cascade/Undo | Lifecycle/RPC/audit/grant migration is material but bounded |
| Close compatibility | New v3 Close/readiness summary; v2 strict shape unchanged | One forward contract instead of widening existing clients |
| Post-commit reconciliation | One shared Store View list invalidation after success | No Unit 7C schema/command change |
| UI maintainability | New small modules; do not grow the existing ~340-line screens/runtime | Keeps form, card, coordinator, and server authority separate |

## Complexity outcome

The workflow is substantial but bounded. It is not an autonomous agent: deterministic code owns every transition, provider call, retry, authorization check, and write. The AI component has one narrow task—extract observed book identity clues into a strict schema. This containment removes the largest avoidable complexity and security multipliers.

## Complexity reductions adopted

| Area | Potential complexity | Containment decision | Result |
| --- | --- | --- | --- |
| Capture | Covers, shelves, mixed orientations, arbitrary book count | Spine stack only; maximum 15; reject/rescan above cap | bounded image contract |
| Languages | Detection quality and mixed fields | Auto-detect fields with optional hints; no per-spine model switching; reversible language gates | mixed-script support without routing fleet |
| Vision failover | Per-book ensemble/model voting | One primary and at most one whole-image fallback | bounded cost/latency |
| Metadata | Parallel ensemble and field-level merging | Local first, then sequential primary/secondary; select one coherent edition | predictable provenance |
| Variants | Full multilingual catalogue localization | Optional sidecar; one primary Roman form, up to two alternatives, separate inactive translation; field reconciliation and store scope | search value without global authority or UI translation |
| Duplicates | Image matching, auto-merge, cross-store reconciliation | Same-store advisory warning; deterministic identity/variant rules; explicit owner choice | low irreversible-risk surface |
| Repeated spines | Attempt to infer physical identity | One visible spine remains one candidate | owner controls quantity/rows |
| Sessions | Pause/resume/save/discard/branching state machine | Start, upload one current image, optionally remove then replace it before candidate lineage, and Close with summary; invisible persistence only | simple mental model |
| Review | Full metadata form for every item | Defaults, required-field highlighting, collapsed optional details, partial commits | low data-entry burden |
| Conditions | Damage embedded as condition ladder | Five standard conditions plus separate damage disclosure | clearer customer semantics |
| Photos | Reuse any image everywhere | Purpose-specific scan/public/request classes | clearer access and retention |
| Marketplace | DB merge of duplicate stock rows | Group visually/query-time by edition and store | no destructive ownership merge |
| Customer photos | New order state machine | Orthogonal item photo state plus existing customer-decision gate | reuses Phase 6 seam |

## High-benefit, low-complexity inclusions

- capture framing guide and blur/glare/resolution gate;
- exact-image hash replay/double-charge prevention;
- strict versioned model/provider schemas;
- local canonical lookup and provider cache/negative cache;
- ISBN checksum normalization and deterministic ISBN-10 to ISBN-13 conversion;
- numbered detected-spine overlay;
- add-missed/remove-false controls;
- highlight only fields needing attention;
- marketplace preview before commit;
- idempotent per-candidate partial success;
- automatic short internal SKU/reference on commit;
- listing-quality/freshness status reuse;
- public count definitions and exact-quantity privacy;
- field-correction/fallback/cost/cleanup telemetry;
- model, prompt, adapter, schema, and provider versioning;
- lifecycle worker alerts and deletion evidence;
- repeated requested-photo failure review;
- provider-independent recorded metadata fixtures and one adapter conformance suite;
- versioned capability declarations and provider-independent lookup identity;
- provider/version cache isolation and bounded query-coalescing identity;
- availability-versus-quality scorecards and bounded Owner correction deltas;
- graceful-shutdown and fixed multi-replica verification contracts;
- at-most-one accepted transition with detectable/reconcilable duplicate provider spend.

## Necessary complexity that remains

| Area | Why it cannot be removed | Containment |
| --- | --- | --- |
| Persistent async jobs | Model/provider calls outlive mobile requests and must recover | one proven Postgres job pattern, leases, bounded retries, idempotency |
| Canonical vs store truth | Shared search needs reuse without allowing stores to corrupt global data | nullable match, immutable selected snapshot, controlled rematch |
| Public/private projection | Customer search must never read private inventory | explicit safe projection and eligibility gate |
| Inventory concurrency | Duplicate choice and quantity increments can race with other scans/holds | row/transaction lock plus idempotent controlled command |
| Media promotion | Public damaged photos need sanitization while scan/request media stay private | staging -> validate/re-encode -> purpose-specific promotion |
| Lifecycle deletion | Scale makes manual cleanup unreliable; disputes can override deletion | policy fields, idempotent worker, holds, tombstone evidence, alerts |
| Customer photo acceptance | Store must honor a customer-specific copy request before confirmation | item substate and existing customer-decision path |
| Multilingual search | Original text and English discovery must coexist without identity corruption | source-bearing alias table and approved alias projection |
| Unit 5C live-schema delta | M01 predates field-level proposal provenance/lifecycle/scope | M18-M21 preserve proposal/replay/reconciliation/lifecycle history; immutable M22/M23 add exact-store/source/eligible-target active-only materialization/search with forward-corrected legacy rank and source reconciliation | Unit 5C-4 is complete without customer display or global authority; Unit 5C-5/5C-6 isolate exceptional Owner decisions and evidence-bound fail-closed rollout from visual UI |

## Deferred or separate work

- per-spine model switching, language-specific worker fleets, and forced
  single-language orchestration;
- model-per-spine dynamic routing;
- shelf-batch/high-volume extraction above 15;
- image-based duplicate detection;
- full canonical merge/refresh administration;
- copy-level serialized inventory for every book;
- automatic split-one-copy command (separate future unit if operational need proves it);
- full supplier, lot, consignment, tax-cost, promotion, and discount engines;
- customer-visible store reliability score;
- advanced search service outside Postgres;
- manager/staff permissions and simultaneous scanning;
- full app translation/localization;
- price-on-request behavior;
- payment/provider/pickup/settlement flows;
- selection or enablement of a secondary metadata provider or vision fallback provider;
- bounded autoscaling until fixed multi-replica activation evidence passes;
- Kubernetes or another mandated hosting platform;
- predictive autoscaling, multi-region workers, and per-language worker fleets;
- more than two metadata providers, provider-specific infrastructure per store, dynamic cost auctions, machine-learned routing, and automatic provider promotion;
- weighted/advanced fairness beyond simple per-store admission;
- a general provider-routing platform or distributed cache without pilot evidence.

## Scale containment

The minimum durable seam is horizontally safe durable claims, leases, attempts, fencing, idempotency, graceful shutdown, connection-budget admission, queue observability, simple fairness, and provider-spend reconciliation. Media sanitation, vision analysis, and metadata enrichment may scale independently. Replica counts, thresholds, cooldowns, connection-pool sizes, concurrency values, cost ceilings, and per-store active-job limits are operational configuration. This readiness does not authorize scheduling, autoscaling, new infrastructure, or deployment changes.

## Residual risks to carry into implementation

- Real Indian-language spine quality may differ significantly by script, font, lighting, and model. A consented multilingual pilot fixture set is mandatory before broad claims.
- Provider coverage for Indian-language/older editions may be poor; manual unmatched inventory must remain a first-class success path.
- Transliteration/translation aliases can be wrong or offensive. Provenance, owner correction, bounded count, and search-only use reduce impact.
- Public cover URLs can break or track clients. Provider host validation/proxy strategy and placeholder behavior must be tested.
- Storage deletion and CDN/signed URL caching are not instantaneous. Private URL TTL must be short and object deletion is the revocation mechanism when necessary.
- Existing global advisor findings remain outside this phase and must not be mistaken for resolved security.
- Request-photo retention depends on later transaction/dispute lifecycle; 180 days is a product baseline subject to legal review.
