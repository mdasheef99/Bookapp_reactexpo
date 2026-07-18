# Agent Instructions

Read this folder before relying on memory about the codebase.

## Required Workflow For Future Sessions

1. Read `CODEBASE_INTELLIGENCE/README.md`.
2. Read the specific intelligence map for the area being touched.
3. Read the linked source files and live docs before editing.
4. If `codebase-retrieval` is available, use it to refresh the area map.
5. If `codebase-retrieval` is unavailable, use this folder plus `rg --files`, `rg`, and targeted file reads.
6. Update this folder when the codebase shape changes.
7. Treat `DOC-13` plus live Supabase readback as status authority; readiness files with older phase dates are historical unless their current-status section says otherwise.

## Use This Pack For

- "Where does this feature live?"
- "What can we reuse?"
- "Which files should I inspect first?"
- "What should not be reused for marketplace work?"
- "What tests should I run?"
- "Which docs are historical and which are live handoff?"

## Do Not Treat This Pack As

- a replacement for reading the current source files
- proof that a live Supabase project still matches the docs
- a complete reference of every function or file
- permission to reuse P2P commerce flows for bookstore marketplace work

## Marketplace Rule

For bookstore marketplace work, start with:

1. `CODEBASE_INTELLIGENCE/05-marketplace-phase-2-readiness.md`
2. `CODEBASE_INTELLIGENCE/08-marketplace-phase-3-readiness.md` when starting inventory/listing work
3. `CODEBASE_INTELLIGENCE/09-marketplace-phase-4-5-readiness.md`
4. `CODEBASE_INTELLIGENCE/10-marketplace-phase-6-and-9-readiness.md` for current work
5. `docs/multi-tenant-bookstore-marketplace/README.md`
6. `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`
7. the active phase tracker under `docs/multi-tenant-bookstore-marketplace/implementation/`

Phase 2C note:

- `store-review` is deployed with JWT verification, but authenticated platform-review smoke is pending/skipped unless a platform-role test user is explicitly approved.
- Do not grant live `platform_user_roles` casually just to satisfy smoke coverage.

Current sequencing note:

- Phase 6 is complete with comprehensive browser E2E explicitly deferred.
- Phases 7 and 8 are deferred and must not leak into Phase 9.
- Phase 9 is planning-authorized and must preserve Phase 6 quantity buckets, active holds, controlled writes, reconciliation, and tenant boundaries.
