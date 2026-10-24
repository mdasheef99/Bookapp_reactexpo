# 09 — Docs Map

**Last checked:** 2026-10-18, against the code and the documents it cites.

Where the project's documents live and which ones are authoritative.

## Authority order (from AGENTS.md)

For marketplace **behaviour**: the user's current decision → DOC-0…DOC-16 →
the active phase master SDD → the owning domain SDD → supporting documents.

For **status**: DOC-13 → `implementation/ACTIVE.md` → the active phase
`TRACKER.md` → detailed trackers.

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
| DOC-13 | Implementation tracker: **global status**, newest entries at the top |
| DOC-14 | Commerce state machines |
| DOC-15 | Finance, tax and settlement |
| DOC-16 | Pilot and unit economics |

`implementation/`:

- `ACTIVE.md` — where a session starts.
- `PHASE-N-*.md` — per-phase plans and records (Phases 0–12).
- `PHASE-6-order-request-confirmation-SDD.md` and `PHASE-6-verification-and-traceability.md` — the Phase 6 design and its evidence.
- `phase-9-image-inventory/` — the Phase 9 folder (check `ACTIVE.md` for which phase is active):
  - `SESSION-START.md` (start protocol), `TRACKER.md` (current state and next action), `README.md`;
  - `00`–`06` SDDs (master, data/metadata, extraction pipeline, Owner review/commit, media security, marketplace display, customer photo requests);
  - `work-units/` — per-unit SDDs and plans (06g batch review, 06h duplicates, 07a commit, 07b publication, 07c Store View, 08 bookstore-first, owner edition picker, …);
  - `trackers/` — numbered evidence logs;
  - `supporting/` — data dictionary, current-vs-target database audit, requirements traceability, scope register;
  - `scripts/` — documentation validators.
- `archive/` — superseded material.

## `docs/user/clubs/` — Clubs

Clubs has its own `TRACKER.md` (current handoff), `DECISIONS.md`,
`PAGE-REFINEMENT-PROCESS.md`, `SDD-01-ui-overhaul.md` and review records.

## `docs/user/library/` — Library

- [Library roadmap](../docs/user/library/LIBRARY-ROADMAP.md) — Library tracks;
  [Library tracker](../docs/user/library/TRACKER.md) — work records and handoff.
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
