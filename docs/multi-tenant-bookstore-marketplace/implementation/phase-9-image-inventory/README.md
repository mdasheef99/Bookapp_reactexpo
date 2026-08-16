# Phase 9 Image-Assisted Inventory Planning Set

**Status:** `unit7c_wu5_committed_m43_m44_m45_applied_review_pending`
**Historical Unit 7B status marker:** **Status:** `unit7b_main_integrated_next_scope_authorization`
**Last updated:** 2026-08-16
**Current handoff:** Unit 7C's normative Owner Store View/post-commit inventory
management SDD remains frozen; WU1, WU2A, WU2, WU3, WU4, and WU5 are locally
complete. WU5 exposes Store View as a primary Owner destination, keeps Inventory
as intake/review/recovery context, and routes successful Add handoff by returned
`inventoryId`. Unit 7B remains live-verified and integrated into `main` at merge commit
`53edbddc9c5417b34cb169599e8282b162e183b3`.
M39 through M45 are now live exactly once on the verified development project;
M43/M44/M45 read back as `20260816122822`, `20260816122901`, and
`20260816122929`. Owner Edge v7 and the Render publication worker remain
live/ready; the connected Unit 7B proof is recorded. The M43–M45 disposable
Unit 7C integration proof is 30/30, fresh focused Jest is 10 suites/67 tests,
the continuity validator passes, and Expo web export passes. The Playwright CLI
remains `NOT_RUN_ENVIRONMENT`; the full repository TypeScript check still has
the unchanged WU4 E2E typing error. No deployment, push, Edge change, or
business-row mutation occurred. No M46 exists. Integrated Unit 7C review and
connected Edge→DB verification remain separately gated.
**Historical implementation status (superseded):** Unit 6's automatic/functional pipeline is **PASS**.
M01-M08/M10-M38 are live-verified at their recorded levels; approved `main` SHA
`a138baa7d3bbc086da019bc052a5ae31d0e15882` is published and deployed to
metadata; one authenticated Owner upload completed the full automatic path to
Needs Review without inventory/listing effects. Native Unit 6F validation
remains deferred `NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery
physical-device parity, native recovery/reconnect, 15-card representative-device
performance, offline/reconnect, accessibility/large text, and low-end Android
resource/performance. The project owner accepts that deferred risk and
authorizes Unit 7 to begin.
Historical pre-live Unit 7A checkpoint: the design was frozen as create-only: one eligible reviewed
candidate creates one new private inventory row from the current server-held
review; no duplicate lookup/merge/increment/manual-match/keep-separate behavior
exists in 7A, and publication is Unit 7B. Local M39, Edge, and mobile
implementation are complete and review-pending with dedicated PGlite 13/13,
Phase 9 Edge/mobile/migration regression 479/479, and TypeScript green under the
documented import flag. M39 remains unapplied; deployment, live smoke, and Git
publication require separate authorization.
Unit 6B is merged at `9ef9eb3`; Unit 6D is implemented at `c363b60`; their
recorded evidence remains authoritative beneath this final closure checkpoint.
**Supabase mutation status:** M01-M08/M10-M45 are live once at their recorded
versions on `ahntbtktjjmvfosgkmgn`; M09 remains absent. M43/M44/M45 are live as
`20260816122822`, `20260816122901`, and `20260816122929`. M42 remains the
forward-only generated-author projection correction. Unit 7B deployment and
live proof are complete; commit `9f3e646` is integrated into `main` at merge
commit `53edbddc9c5417b34cb169599e8282b162e183b3`; WU5 is committed locally as
`380f2b3`. No deployment, push, Edge change, or business-row mutation occurred
in the WU5/migration session.
**Database checkpoint:** the exact project is `ACTIVE_HEALTHY`; M39–M45 are live
exactly once, the selected listing remains published with one active public
projection and zero outstanding publication retries, and the new publication
revision table is empty. The development `active_listing_limit` is 10 from
source `unit7b_dev_rollout`.
M30 was applied exactly once as `20260801093048 marketplace_phase9_unit6e_review_corrections`.

This folder is the implementation-planning source for Phase 9. It turns the product decisions in DOC-1, DOC-3, DOC-4, DOC-5, DOC-6, DOC-8, DOC-13, and DOC-14 into a reviewable set of software design documents (SDDs). It does not authorize implementation by itself.

Historical Unit 7A handoff: M32-M38 are live
and immutable at their recorded versions; M39 exists only locally. The Unit 7A
command's exact replay and duplicate non-interference are covered by the local
13-case database suite. Native Unit 6F evidence remains deferred
`NOT_RUN`/`UNRESOLVED` debt and is not marked PASS. Review of the complete local
diff is next; operational application/deployment remains separately gated.

Historical post-closure handoff: the local multilingual vision-response
resilience correction. User-supplied Android evidence closes the FileSystem
transport proof and moves the evidence issue to strict Gemini decoding. The
local correction is green and review-pending; deployment and a fresh
post-deployment Android proof remain separately authorized. The native Unit 6F
debt is preserved below and no longer blocks Unit 7 under the owner-authorized
sequencing decision.

WU1 and WU2 remain complete at their recorded levels. M32 closes the
structural metadata seam with transaction-atomic candidate/job creation,
same-candidate fenced worker processing, a provider-neutral Google Books path,
and replay-safe terminal persistence using approved states. M38 and the final
automatic live proof close the later-claim retry and Unit 6 automatic/functional
operational gates; they do not constitute native-device evidence for the
deferred Unit 6F validation debt.

Every new development session starts at repository `AGENTS.md`, then follows `implementation/ACTIVE.md` → DOC-13 → [SESSION-START.md](./SESSION-START.md) → [TRACKER.md](./TRACKER.md). `SESSION-START.md` defines the Phase 9 resume brief, work-unit reading router, Supabase gate, documentation update matrix, and mandatory closeout transaction. Unit 7A local implementation evidence is in [tracker 29](./trackers/29-unit7a-create-only-commit-evidence.md).

## Authority and reading order

When documents conflict, use this order:

1. Product decisions explicitly recorded in the root marketplace specifications.
2. [Master SDD](./00-phase-9-master-sdd.md) for Phase 9 boundaries and cross-domain invariants.
3. The owning domain SDD for detailed behavior.
4. Supporting registers and trackers for evidence, status, and implementation handoff.

After the repository entrypoint, read in this order:

1. Repository `AGENTS.md`
2. [Active marketplace router](../ACTIVE.md)
3. [DOC-13](../../DOC-13-implementation-tracker.md)
4. [Development-session protocol](./SESSION-START.md)
5. [Master tracker](./TRACKER.md)
6. [Master SDD](./00-phase-9-master-sdd.md)
7. The relevant domain/supporting documents routed for the active work unit
8. [Implementation and verification tracker](./trackers/02-implementation-and-verification.md)
9. The current Package 1 evidence: [live audit](./work-units/01-package1-live-audit.md) and [proposed database design](./work-units/01-package1-database-design.md); WU0B remains the owning technical-design router

## SDD set

| Document | Owns |
| --- | --- |
| [00 Master](./00-phase-9-master-sdd.md) | Scope, invariants, architecture, work-unit order, shared acceptance gates. |
| [01 Data and metadata](./01-data-canonical-metadata-sdd.md) | Canonical identity, metadata, aliases, condition/damage, duplicate rules, schema direction. |
| [02 Extraction pipeline](./02-extraction-enrichment-pipeline-sdd.md) | Sessions, capture, language, vision adapters, provider adapters, retry, quota, recovery. |
| [03 Owner review and commit](./03-owner-review-inventory-commit-sdd.md) | Minimal owner UI, review, defaults, duplicates, atomic commits, edits, publish/private behavior. |
| [04 Media, security, and privacy](./04-media-security-privacy-sdd.md) | Trust boundaries, buckets, upload validation, access, retention, deletion, incident and recovery controls. |
| [05 Marketplace discovery](./05-marketplace-discovery-display-sdd.md) | Bookstore-first discovery, multilingual search, store catalogue, counts, cover/detail display. |
| [06 Customer photo request](./06-customer-photo-request-extension-sdd.md) | Item-level current-copy photo requests, mandatory fulfillment gate, private evidence, Phase 6 seam. |
| [WU1 Owner-inventory read boundary](./work-units/owner-inventory-read-boundary-wu1-sdd.md) | Separate stable detail/list read contract, signed deterministic cursor, exact DTO/filter allowlists, Owner authorization, and the applied forward migration; positive Owner runtime remains deferred. |
| [WU2 Owner-inventory read client](./work-units/owner-inventory-read-client-wu2-sdd.md) | Read-only `/inventory` cutover to the WU1 list RPC, strict DTO validation, opaque pagination, cache isolation, exact filters, and error/empty/partial states; authenticated runtime remains deferred. |
| [Unit 7A create-only commit](./work-units/07a-create-only-inventory-commit-sdd.md) | One reviewed candidate to one new private inventory row, server-held review/revision authority, quantity buckets, replay/concurrency, one-to-one provenance, false-only skip semantics, Unit 6 duplicate-contract transition, and migration verdict. |
| [Unit 7B safe publication](./work-units/07b-publication-sdd.md) | Existing publish/pause/private/retry lifecycle, public eligibility/projection, approved media, retry worker, and live completion contract. |
| [Unit 7C Owner Store View](./work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md) | Stable post-commit Owner identity, Store View IA and reads, atomic Save, separate stock/media operations, Unit 7B lifecycle reuse, public revisions, UI cutover, database delta, and acceptance A–H. |

## Supporting set

| Document | Purpose |
| --- | --- |
| [Data dictionary](./supporting/data-dictionary.md) | Field ownership, source, visibility, edit authority, retention, and target storage. |
| [Database current vs target](./supporting/database-current-vs-target.md) | Live read-only evidence and the migration delta that must be designed later. |
| [Requirements traceability](./supporting/requirements-traceability.md) | Decision-to-SDD and acceptance mapping. |
| [Complexity and scope register](./supporting/complexity-and-scope-register.md) | Included containment choices, residual complexity, exclusions, and asymmetric benefits. |
| [Work Unit 0 plan](./work-units/00-contracts-threat-migration-plan.md) | Versioned contract shapes, fixtures, threat tests, migration sequence, correction strategy, and stop gates. |
| [Work Unit 0B technical design](./work-units/00b-backend-api-technical-design-plan.md) | Router for seven completed backend/API design artifacts covering commands, queries, DTOs, authorization, state, jobs, media, marketplace, request photos, red tests, exact later file allowlists, and independent gates. |
| [Unit 4 fixture vision-analysis runtime](./work-units/04-fixture-vision-analysis-runtime-design.md) | Locally complete `p9-vision-v2`, fixture analyzer, product policy, dedicated worker, token/attempt state machine, forward M12 persistence/RPCs, privacy, and red-first evidence. |
| [Unit 5C Lite multilingual variants](./work-units/05c-lite-multilingual-search-variants-sdd.md) | Approved target design; Units 5C-1/2/3/4 implement the sidecar contract, private persistence/replay fence, optional same-call generation, reconciliation/lifecycle, and active store-scoped alias materialization/search. Combined Unit 5C-5/5C-6 backend remains next; visual UI/display remains deferred. |
| [Unit 5C-3 runtime and reconciliation evidence](./trackers/15-unit5c3-runtime-reconciliation-evidence.md) | Merged implementation, immutable M18-M21 history, deep-review corrections, live verification, exclusions, and Unit 5C-4 handoff. |
| [Unit 5C-4 active variant search evidence](./trackers/16-unit5c4-active-variant-search-evidence.md) | Merged implementation, immutable M22/M23 history, active-only store-scoped search, security/verification evidence, exclusions, and combined Unit 5C-5/5C-6 handoff. |
| [Unit 4A deployment-runtime scaffolding](./work-units/04a-deployment-runtime-scaffolding-sdd.md) | Provider-neutral sanitation/fixture-vision service hosts, strict environment loading, dynamic fixtures, safe observability, manual invocation, deterministic builds/containers, and deployment validation. |
| [Fixture-pipeline deployment evidence](./trackers/06-fixture-pipeline-deployment-evidence.md) | M13 invoker boundary, Owner/Render identities, exact SHA/deployments, nine live fixtures, fencing/security/log/privacy and zero-commerce evidence. |

## Continuity tools

| Document/tool | Purpose |
| --- | --- |
| [Active router](../ACTIVE.md) | Points every marketplace session to the currently authorized phase. |
| [SESSION-START](./SESSION-START.md) | Resume brief, work-unit reading, Supabase gate, update matrix, and closeout transaction. |
| [Continuity validator](./scripts/validate-phase9-continuity.ps1) | Read-only required-file, routing, marker, local-link, size, and clean-diff validation. |

## Tracker split

The local tracking set intentionally has three files:

- [TRACKER.md](./TRACKER.md): concise current status and handoff.
- [Unit 5B evidence](./trackers/11-unit5b-implementation-evidence.md) and
  [Google Books audit](./work-units/05b-google-books-provider-audit.md):
  merged fixture/mock-verified adapter evidence and provider-specific authority.
- [Unit 6C evidence](./trackers/21-unit6c-capture-upload-recovery-evidence.md):
  capture, upload/registration retry, progress, recovery, review, test, browser,
  privacy, and external-state receipt.
- [Unit 6D evidence](./trackers/22-unit6d-candidate-review-evidence.md):
  candidate review/editing, refresh authority, conflict recovery, review,
  focused test, browser, privacy, and external-state receipt.
- [Unit 6E evidence](./trackers/23-unit6e-review-corrections-evidence.md):
  false/missed-variant correction closure, M30 readback, bounded remote
  verification, authenticated browser limitation, tests, and final handoff.
- [Unit 6F evidence](./trackers/24-unit6f-readiness-quality-gates-evidence.md):
  bounded browser/readback verification, local quality gates, architectural
  risk, and the outstanding representative low-end Android gate.
- [WU1 evidence](./trackers/25-owner-inventory-read-boundary-wu1-evidence.md):
  re-sequencing, exact-project preflight/application/readback, red-first contract
  tests, local behavior, anonymous denial, and the deferred Owner runtime gate.
- [WU2 evidence](./trackers/26-owner-inventory-read-client-wu2-evidence.md):
  active-route cutover, strict client contract, pagination/cache behavior,
  read-only UI states, focused/regression tests, and deferred runtime evidence.
- [Planning and decisions](./trackers/01-planning-and-decisions.md): decision register, source reconciliation, audit evidence, and planning review.
- [Implementation and verification](./trackers/02-implementation-and-verification.md): future work units, migration ledger, tests, rollout, and operational evidence.

The root [DOC-13 tracker](../../DOC-13-implementation-tracker.md) remains the only global phase tracker. These files do not replace it.

The routing/status separation is intentional: [`../ACTIVE.md`](../ACTIVE.md) routes to the active phase, DOC-13 owns global status, and this folder's `TRACKER.md` owns the Phase 9 current milestone/next action. Do not duplicate detailed status into SDDs.

## Locked Phase 9 product decisions

- One image contains at most 15 visible book spines. Current runtime requires
  selected language; approved target auto-detects with optional hints.
- Capture supports camera and gallery/manual upload with one current image per
  simple Start/Close session. An explicit pre-candidate removal enables one
  replacement; append-style multi-image capture is not allowed.
- Current runtime defaults the required batch language to English. Unit 5C Lite
  target instead auto-detects per field, accepts optional hints, and still
  excludes per-spine model switching.
- The deterministic application orchestrates the workflow. The vision model extracts only; it has no database, storage, metadata-provider, or tool authority.
- Vision and metadata integrations are adapter-based with one configured primary and one configured fallback.
- Confirmed original-language title and author are primary. Unit 5C Lite uses
  independent field confirmation, bounded provisional Roman forms, deterministic
  key separation, and active store-scoped search authority.
- Metadata stores description, ISBN-10 and ISBN-13 when available, publisher, date, language, edition, volume, format, pages, categories, cover, and provenance.
- Owner review is mandatory before each candidate enters inventory. Store defaults reduce repeated entry.
- Duplicates are advisory, same-store only, and never auto-merged. Image similarity is excluded.
- Public conditions are New, Like New, Very Good, Good, and Acceptable. Damage is a separate disclosure.
- Damaged but sellable books require a public note and one to three actual-copy photos. Unsellable copies remain private.
- Marketplace discovery is bookstore-first. A matching search returns every eligible store carrying the book; selecting a store opens its complete active public catalogue.
- Customer-requested current-copy photos are mandatory for that request. Without them, the item cannot be confirmed/payment-ready.
- Phase 9 remains independent of deferred Phase 7 payment and Phase 8 pickup implementation.

## Planning and implementation gates

The planning baseline, WU0A/WU0B, corrected Package 1 design, Units through 5C-6, and Unit 6A-6E are integrated at their recorded checkpoints. M01-M08/M10-M38, Owner ingestion, and both separate fixture workers are live-verified; M09 remains absent. Unit 6E's correction-only M30 is additive and was applied exactly once after exact-project preflight. The M38 automatic proof closes the functional upload-to-Owner-review path without inventory/listing effects. Unit 6F browser/readback and local fixture-backed checks remain recorded, but native camera/gallery parity, recovery/reconnect, 15-card representative-device performance, offline/reconnect, accessibility/large text, and low-end Android resource/performance evidence remain deferred `NOT_RUN`/`UNRESOLVED` debt and are not PASS. Customer display, inventory/publication, commerce, Google Books Roman-query fallback, and global alias authority remain separately gated; Unit 7 is owner-authorized under the current authority overlay. Preserve these controls:

- the seven SDDs agree on states, identifiers, retention, and public/private boundaries;
- the data dictionary and current-vs-target audit are reviewed;
- every database/storage uncertainty is rechecked against the exact Supabase project through Supabase MCP;
- migration order, rollback/forward-correction plan, RLS/grants, storage policies, and cross-tenant tests are written;
- model/provider contracts have fixtures and strict schemas;
- security, privacy, cost, and lifecycle acceptance criteria have owners;
- the root tracker and local master tracker both identify the same active work unit.
- [the continuity validator](./scripts/validate-phase9-continuity.ps1) passes before handoff.
