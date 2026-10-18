# Codebase Map

**Last checked:** 2026-10-18, against the code and the documents it cites.

This folder is an orientation guide for anyone (human or AI session) starting work
on BookConnect. It answers "where does this live, how does it fit together, what
must I not break, and how do I test it" in about ten minutes of reading, so a new
session does not have to rediscover the codebase from scratch.

It replaces the older `CODEBASE_INTELLIGENCE/` pack. If that folder is still in
your checkout, treat it as superseded: do not use it for status, rules or layout.

## What this folder is not

- **Not a status report.** It never records phase status, test results, function
  versions, commit hashes or "next action". Those change daily and are owned by:
  - [DOC-13](../docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md) — global marketplace status
  - [implementation/ACTIVE.md](../docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md) — where a session starts
  - the active phase `TRACKER.md` named by `ACTIVE.md` (for example the [Phase 9 TRACKER](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/TRACKER.md)) — current work and next action
  - [Clubs TRACKER](../docs/user/clubs/TRACKER.md) — current Clubs work
- **Not a rulebook.** Product rules belong to the source specs. File 05 only
  summarises them and links to the section that owns each one.
- **Not proof of live state.** Check the live Supabase project through Supabase MCP
  before any database decision.
- **Not a substitute for reading the code.** Use the paths here as starting points.

## Reading order

1. [`AGENTS.md`](../AGENTS.md) — mandatory session start and authorization rules.
2. This README, including "Where to start" below.
3. [01 App structure](./01-app-structure.md) — stack, providers, every route.
4. [05 Marketplace rules](./05-marketplace-rules.md) — the boundaries you must not cross.
5. The file for the area you are touching:
   - [02 Auth and session](./02-auth-session.md)
   - [03 Backend: Supabase, Edge Functions, workers](./03-backend.md)
   - [04 Feature modules](./04-features.md)
   - [06 Testing](./06-testing.md) — including architecture guard tests and CI
6. [07 Checkouts and the shared database](./07-checkouts-and-shared-database.md) — before any git or migration work.
7. [08 Glossary](./08-glossary.md) and [09 Docs map](./09-docs-map.md) — whenever a term or document is unfamiliar.

## Where to start for common tasks

| Task | Read first | Code to open | Tests |
| --- | --- | --- | --- |
| Owner scan / review / Add to Inventory (Phase 9) | 05, 04 § Image inventory, Phase 9 SESSION-START | `src/features/imageInventory/`, `app/(store-owner)/inventory/` | `src/features/imageInventory/__tests__/`, `supabase/functions/__tests__/phase9_*`, `supabase/tests/phase9/` |
| Edition picker / metadata lookup | 03 § Workers, 04 § Image inventory | `src/features/imageInventory/api/ownerEditionPicker*.ts`, `supabase/functions/_shared/imageInventory/metadata/`, `workers/phase9-metadata-worker/` | `ownerEditionPicker*.test.ts*`, `phase9_metadata_*`, `phase9_open_library_*` |
| Committed stock, editing, publishing (Store View) | 05, 04 § Store View | `src/features/storeView/`, `app/(store-owner)/store-view/` | `src/features/storeView/__tests__/`, `e2e/store-view-*.spec.ts` |
| Customer marketplace search / store pages | 05 § Public vs private | `src/features/marketplace/`, `app/(tabs)/marketplace/` | `src/features/marketplace/**/__tests__/` |
| Cart, order requests, Owner orders (Phase 6) | 05 § Commerce, DOC-14 | `src/features/marketplace/commerce/`, `supabase/functions/commerce-*` | `src/features/marketplace/commerce/__tests__/`, `supabase/tests/phase6_*` |
| Store onboarding, dashboard, subscription | 04 § Stores | `src/features/stores/`, `app/(store-owner)/` | `src/features/stores/**/__tests__/` |
| Login, logout, account switching | 02 | `src/application/auth/`, `src/features/auth/` | `src/application/auth/__tests__/` |
| Clubs | 04 § Clubs, [Clubs TRACKER](../docs/user/clubs/TRACKER.md) | `src/features/clubs/`, `app/(tabs)/clubs/` | `src/features/clubs/**/__tests__/`, `npm run test:clubs:l4` |
| Library / book search / notes | 04 § Library | `src/features/books/`, `src/components/search/`, `app/(tabs)/library/` | `src/features/books/**/__tests__/` |
| Any migration, RLS, grant or bucket change | 03, 07, AGENTS.md "Database and Supabase rule" | `supabase/migrations/` | `supabase/migrations/__tests__/`, `supabase/tests/` |

## Keeping this folder accurate

Keeping this folder current is part of every change, not a separate job done
only when asked. A session that changes something this folder describes updates
the matching file **in the same commit**.

### When to update

| If your change… | Update |
| --- | --- |
| Adds, removes, renames or moves a route, layout or tab, or changes root providers or redirects | 01 (and "Where to start" above if an entry point moved) |
| Changes sign-in, session restore, account switching or logout, or adds per-user client state (a Zustand store, module cache or AsyncStorage key) | 02 |
| Adds, removes or renames an Edge Function, worker, Storage bucket or Realtime channel; changes JWT or secret checks; or changes which path (table, RPC, Edge Function, Storage) the app uses for an action | 03 |
| Adds, moves or retires a feature module, service, screen or shared hook such as the Owner gate | 04 |
| Changes a marketplace rule or a cited section in a source document | 05 |
| Adds or changes a test command, runner, harness migration list, architecture guard test or CI workflow | 06 |
| Changes checkout, worktree or shared-database practice in `AGENTS.md` | 07 |
| Introduces a term other sessions will meet repeatedly | 08 |
| Adds, moves or retires a source specification, phase folder or `docs/` folder | 09 |

### How to update

1. Change only what your change made wrong or incomplete. Check every new or
   edited sentence against code or documents you opened in this session; never
   write from memory or from a tracker's description of the code.
2. Summarise rules, do not create them. Each rule in 05 cites the section that
   owns it; if this folder and a source disagree, the source wins and this
   folder is corrected.
3. Confirm every link and file path you added resolves.
4. The **Last checked** line at the top of a file records when the *whole file*
   was last re-verified. Update it only when you re-check the whole file, not
   after a one-line edit.
5. If you notice a wrong statement here while doing other work, fix it in the
   same change, or tell the user if it is outside your change's scope.

### Never add

Phase or milestone status, next actions, test results, deployed or live
versions, commit hashes, branch names, machine-specific paths, counts that
change with normal work, live database values, or any secret. Point to DOC-13,
`implementation/ACTIVE.md`, the trackers or Supabase MCP instead.
