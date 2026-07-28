# Phase 9 Image-Assisted Inventory Planning Set

**Status:** `fixture_pipeline_deployed_and_live_verified`
**Last updated:** 2026-07-28
**Implementation status:** M01-M08/M10-M17 are live-verified; separate free-plan media/fixture-vision services remain deployed; Unit 5B is independently approved and merged at `47f23a8` with Google Books fixture/mock verified only; Unit 5C is separately gated
**Supabase mutation status:** M01-M08/M10-M17 are live once on `ahntbtktjjmvfosgkmgn`; M09 is absent; Unit 5B created no migration and caused no Supabase/Storage mutation
**Database checkpoint:** M01-M08 and forward migrations M10-M17 are live-verified.

This folder is the implementation-planning source for Phase 9. It turns the product decisions in DOC-1, DOC-3, DOC-4, DOC-5, DOC-6, DOC-8, DOC-13, and DOC-14 into a reviewable set of software design documents (SDDs). It does not authorize implementation by itself.

Every new development session starts at repository `AGENTS.md`, then follows `implementation/ACTIVE.md` → DOC-13 → [SESSION-START.md](./SESSION-START.md) → [TRACKER.md](./TRACKER.md). `SESSION-START.md` defines the Phase 9 resume brief, work-unit reading router, Supabase gate, documentation update matrix, and mandatory closeout transaction.

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
- [Planning and decisions](./trackers/01-planning-and-decisions.md): decision register, source reconciliation, audit evidence, and planning review.
- [Implementation and verification](./trackers/02-implementation-and-verification.md): future work units, migration ledger, tests, rollout, and operational evidence.

The root [DOC-13 tracker](../../DOC-13-implementation-tracker.md) remains the only global phase tracker. These files do not replace it.

The routing/status separation is intentional: [`../ACTIVE.md`](../ACTIVE.md) routes to the active phase, DOC-13 owns global status, and this folder's `TRACKER.md` owns the Phase 9 current milestone/next action. Do not duplicate detailed status into SDDs.

## Locked Phase 9 product decisions

- One image contains a same-language stack of at most 15 visible book spines.
- Capture supports camera and gallery/manual upload; multiple images may be processed in one simple Start/Close session.
- English is the default batch language. Another language must be selected before upload. Mixed-language automation is excluded.
- The deterministic application orchestrates the workflow. The vision model extracts only; it has no database, storage, metadata-provider, or tool authority.
- Vision and metadata integrations are adapter-based with one configured primary and one configured fallback.
- Original-script title and author are authoritative. Each automated operation proposes at most three English aliases; bounded provider-recognized or Owner/platform-verified aliases may coexist with source/provenance.
- Metadata stores description, ISBN-10 and ISBN-13 when available, publisher, date, language, edition, volume, format, pages, categories, cover, and provenance.
- Owner review is mandatory before each candidate enters inventory. Store defaults reduce repeated entry.
- Duplicates are advisory, same-store only, and never auto-merged. Image similarity is excluded.
- Public conditions are New, Like New, Very Good, Good, and Acceptable. Damage is a separate disclosure.
- Damaged but sellable books require a public note and one to three actual-copy photos. Unsellable copies remain private.
- Marketplace discovery is bookstore-first. A matching search returns every eligible store carrying the book; selecting a store opens its complete active public catalogue.
- Customer-requested current-copy photos are mandatory for that request. Without them, the item cannot be confirmed/payment-ready.
- Phase 9 remains independent of deferred Phase 7 payment and Phase 8 pickup implementation.

## Planning and implementation gates

The planning baseline, WU0A/WU0B, corrected Package 1 design, and Unit 4/4A implementation are integrated at their recorded checkpoints. M01-M08/M10-M14, Owner ingestion, and both separate fixture workers are live-verified at the identities in tracker 06. Unit 4B uses configuration-driven `gemini-3.5-flash-lite`; M14 is live once as `20260727183546`. The earlier `gemini-3.5-flash` decision remains historical. The fixture adapter remains available, no optional vision fallback is selected/enabled, and no real provider credential is configured or call made. Unit 5, M09, Gemini deployment/provider calls, scheduling/autoscaling, metadata runtime, UI, inventory/publication, Library, and later units remain separately gated. Preserve these controls:

- the seven SDDs agree on states, identifiers, retention, and public/private boundaries;
- the data dictionary and current-vs-target audit are reviewed;
- every database/storage uncertainty is rechecked against the exact Supabase project through Supabase MCP;
- migration order, rollback/forward-correction plan, RLS/grants, storage policies, and cross-tenant tests are written;
- model/provider contracts have fixtures and strict schemas;
- security, privacy, cost, and lifecycle acceptance criteria have owners;
- the root tracker and local master tracker both identify the same active work unit.
- [the continuity validator](./scripts/validate-phase9-continuity.ps1) passes before handoff.
