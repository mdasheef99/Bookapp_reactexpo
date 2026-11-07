# 09 — Docs Map

**Last checked:** 2026-10-30, against the code and the documents it cites.

Where the project's documents live and which ones are authoritative.

## Authority order (from AGENTS.md)

For marketplace **behaviour**: the user's current decision → DOC-0…DOC-16 →
the active phase master SDD → the owning domain SDD → supporting documents.

For **status**: DOC-13 owns cross-phase/global status; `implementation/ACTIVE.md`
owns current work, next action and gates; the active phase `TRACKER.md` and
detailed trackers own local decisions and dated evidence.

This folder (`CODEBASE_MAP/`) sits below all of these.

## `docs/multi-tenant-bookstore-marketplace/` — the marketplace

Root specifications:

| Doc | Subject |
| --- | --- |
| DOC-0 | Product architecture |
| DOC-1 | Identity, security and compliance (roles, tenancy, RLS principles, storage security) |
| DOC-2 | Store onboarding, verification and subscriptions |
| DOC-3 | Canonical books, metadata and inventory |
| DOC-4 | Image-to-LLM inventory workflow |
| DOC-5 | Consumer marketplace and discovery |
| DOC-6 | Cart, order request and payment |
| DOC-7 | Fulfillment and delivery |
| DOC-8 | Store Owner console |
| DOC-9 | Platform operations and admin |
| DOC-10 | Notifications, events and realtime |
| DOC-11 | Demand signals, bookclubs and places |
| DOC-12 | Build strategy and phase sequence (phases, separation rules) |
| DOC-13 | Implementation tracker: **cross-phase/global status**, phase table and global blockers; current phase detail links to ACTIVE.md |
| DOC-14 | Commerce state machines |
| DOC-15 | Finance, tax and settlement |
| DOC-16 | Pilot and unit economics |

`implementation/`:

- `ACTIVE.md` — short current-state file, rewritten at session close; current work, next action, mutation authority and live-state references.
- [history/](../docs/multi-tenant-bookstore-marketplace/implementation/history/README.md) — source-attributed superseded handoffs and prior session protocols; read for historical evidence, not current authority.
- `PHASE-N-*.md` — per-phase plans and records (Phases 0–12).
- `PHASE-6-order-request-confirmation-SDD.md` and `PHASE-6-verification-and-traceability.md` — the Phase 6 design and its evidence.
- `phase-9-image-inventory/` — the Phase 9 folder (check `ACTIVE.md` for which phase is active):
  - `SESSION-START.md` (protocol, reading order, update matrix and rules), `TRACKER.md` (local decisions and implementation evidence; current state links to ACTIVE.md), `README.md`;
  - `00`–`06` SDDs (master, data/metadata, extraction pipeline, Owner review/commit, media security, marketplace display, customer photo requests);
  - `work-units/` — per-unit SDDs and plans (06g batch review, 06h duplicates, 07a commit, 07b publication, [07c Store View](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md), 08 bookstore-first, owner edition picker, …); `post-scan-rework/` holds its overview/decision register and domain SDDs;
  - `trackers/` — numbered evidence logs;
  - `supporting/` — data dictionary, current-vs-target database audit, requirements traceability, scope register;
  - `scripts/` — documentation validators.
- `archive/` — superseded material.

- **Owner decisions:** [DECISIONS.md](../docs/multi-tenant-bookstore-marketplace/DECISIONS.md) — index of explicit decisions, linked to owning SDDs/trackers; no current status.

### Post-scan rework SDDs

Under `implementation/phase-9-image-inventory/work-units/post-scan-rework/`:

| Document | Owns |
| --- | --- |
| [00 Overview](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md) | Decision register, glossary, cross-slice rules and build order |
| [01 Review screen](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/01-review-screen-sdd.md) | Cards, edition sheet, simplified Add a book and typed ISBN |
| [01a Typed ISBN](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/01a-slice5-typed-isbn-sdd.md) | Detailed typed-ISBN search in the edition sheet and Add a book |
| [02 Catalogue and matching](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02-catalogue-and-matching-sdd.md) | Catalogue/matching design, provider order and saved-result direction |
| [02a Catalogue link at Add](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02a-slice6-catalogue-link-sdd.md) | Detailed Add linkage, identity, provider admission and conflict behavior |
| [02b Lean catalogue writes](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md) | Companions, completion, statistics, cache scope/reuse and receipts |
| [02c Open Library first](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02c-slice8-open-library-first-sdd.md) | Provider replacement, database generalization, compatible worker, clues, protection and switch/rollback design |
| [02c-1 Activation appendix](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02c-1-slice8-switch-runbook-and-benchmark.md) | Benchmark labels/equivalence/denominators, grant closure, drain classification, bounded smoke and rollback detail under 02c; the operator SQL for these steps is `phase-9-image-inventory/scripts/8c/01..06` |
| [02d Edition-sheet prefill](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/02d-edition-sheet-prefill-sdd.md) | Automatic-result persistence, explicit refresh, identity races, retention and sheet behavior |
| [03 Session lifecycle](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/03-session-lifecycle-sdd.md) | Removal, server close, daily limits and deletion design |
| [04 Add and publish](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/04-add-and-publish-sdd.md) | Single Add receipt and pre-scan publication choice |
| [05 Classification](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/05-classification-sdd.md) | Category and private-label design |

These are design owners; use ACTIVE.md and its routed evidence for implementation
and authorization. Overview §2 routes detailed reading.

## `docs/user/clubs/` — Clubs

Clubs has its own `TRACKER.md` (current handoff), `DECISIONS.md`,
`PAGE-REFINEMENT-PROCESS.md`, `SDD-01-ui-overhaul.md` and review records.

## `docs/user/library/` — Library

- [Library roadmap](../docs/user/library/LIBRARY-ROADMAP.md) — Library tracks;
  [Library tracker](../docs/user/library/TRACKER.md) — work records and handoff.
- [SDD-07 — Book section UI](../docs/user/library/SDD-07-book-section-ui-overhaul.md),
  [SDD-08 — Export and share](../docs/user/library/SDD-08-export-and-share.md) and
  [SDD-09 — Reading history](../docs/user/library/SDD-09-reading-history.md) —
  Library screens, portable exports, reading dates, progress, goals and statistics.
- [SDD-10 — Notes retrieval](../docs/user/library/SDD-10-notes-retrieval.md) —
  per-book note search, swipe browsing, On this day and the Saved Pages UI removal.
- [SDD-11 — Notes and books organising](../docs/user/library/SDD-11-organising.md)
  — book labels and note collections.
- [Library build and review process](../docs/user/library/REVIEW-PROCESS.md) —
  unit briefs, whole-branch reviews and review-check guidance.

## Other `docs/` folders

| Folder | Contents | Treat as |
| --- | --- | --- |
| `docs/architecture/` | Database, Edge Function and integration overviews; `architecture_react_expo.md` | Background; inventories are historical |
| `docs/development/PROJECT_AGENT_RULES.md` | Coding conventions (Sentry usage, environments, shared UI components, styling rules) | Current guidance |
| `docs/features/` | Older feature specs (Clubs, Library search, Notifications, P2P, Venues) | Background for those features |
| `docs/deployment/` | Migration guide, map and reconciliation | Check dates before relying on them |
| `docs/design/` | UI/UX redesign proposals (e.g. Clubs) | Background for those areas |
| `docs/audits/`, `docs/archive/`, `docs/strategic-planning/` | Dated audits and plans | Historical |
| `docs/linear-setup/`, `docs/superpowers/` | Ticket-import and planning artefacts | Historical |

## Superseded at the repository root

`DEVELOPMENT_SESSION_KICKSTART.md`, `KICKSTART_README.md`,
`KICKSTART_EXTENDED_GUIDE.md`, `SESSION_CHECKLIST.md` and
`DATABASE_SCHEMA_SUMMARY.md` describe an older workflow and schema. Do not use
them for status or sequencing.
