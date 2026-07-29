# Phase 9 Unit 5C-4 Active Variant Search Evidence

**Status:** `merged_main_d092f08_live_verified`
**Date:** 2026-07-29
**Authority:** Unit 5C-4 active store-scoped alias materialization and search
consumption only
**Live project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)

## Git and independent review

- implementation commit:
  `d092f081d95b8c551bfcadcfd58fe8c98c77dfb2`;
- independently reviewed exact tree:
  `db8ea75ed2904e8c381eec814f96804198d16b1e`;
- independent verdict: `APPROVED`;
- merge mode: fast-forward;
- post-merge `main` and `origin/main`: identical, ahead/behind `0/0`;
- local and remote feature-branch tips matched before merge;
- final implementation worktree: clean.

## Completed behavior

Unit 5C-4 implements:

- consumption only of active Unit 5C-3 proposals;
- exact store and source-field validation;
- association with an existing eligible inventory/listing target, with a
  no-op when no eligible target exists;
- store-scoped title and individual-author alias materialization;
- one-based author-position preservation;
- proposal-to-alias linkage;
- idempotent, concurrency-safe materialization;
- stale/inactive alias retraction;
- fail-closed search validation against current active proposal state;
- Roman title and author search with result deduplication;
- preservation of original title, original author, ISBN, and
  canonical/legacy approved-alias search;
- preservation of existing listing eligibility and public-projection rules;
- no customer display-schema change.

## Immutable forward migration history

| Migration | Live version | Final record |
| --- | --- | --- |
| M22 active variant search | `20260729075459` | Introduced the Unit 5C-4 materialization/search foundation. It remains immutable. |
| M23 active variant search correction | `20260729082153` | Forward-corrected legacy approved-alias rank preservation and stricter source-field/source-text reconciliation at the protected materialization boundary. It remains immutable. |

Independent review found the two bounded defects corrected by M23. M22 was not
edited, reversed, or deleted. Final live schema semantics are M22 plus M23.

## Verification

- PGlite: 35/35 passed;
- Jest: 53/53 passed;
- scoped TypeScript: passed;
- Phase 9 continuity validator: passed;
- scoped secret scan: passed;
- generated `.pyc` count: zero;
- live rollback-only smoke: passed;
- no synthetic proposal, alias, link, inventory, or listing residue remained.

Security and authority verification covered store isolation, exact
proposal/source-field authority, existing inventory/listing association,
active-only search effect, delayed-cleanup fail-closed behavior, no private
proposal exposure, RLS and ACL boundaries, fixed function search paths,
trusted materialization authority, no unintended PostgreSQL 17 `MAINTAIN`
grant, and no application-side unrestricted service-role DML as authorization.

## Explicitly absent

Unit 5C-4 did not implement:

- Owner variant-review backend authority or Owner
  approve/reject/manual-replacement commands;
- Owner review UI;
- customer Roman-secondary display or original-first display redesign;
- benchmark infrastructure or benchmark execution;
- per-language rollout controls or visual platform-admin controls;
- inventory/listing creation, publication, or commerce;
- Roman-query Google Books fallback;
- global/canonical alias authority.

## Post-merge documentation closeout

This bounded closeout updates only Phase 9 status, routing, evidence,
data/audit, traceability, scope, and continuity-control documents. It performs
no Supabase, Storage, provider, deployment, source, migration, test, fixture,
runtime configuration, inventory, listing, publication, commerce, or UI
mutation.

## Next active batch

The next active implementation batch combines:

- Unit 5C-5 — exceptional Owner variant-decision backend authority;
- Unit 5C-6 — benchmark and per-language rollout-control infrastructure.

They begin only after this documentation closeout is merged, in one backend
session and branch. They expose UI-ready backend contracts but include no
Owner, customer, or platform-admin visual UI. Qualifying stored evidence is
not assumed: no live benchmark execution or production-language approval is
required when no qualifying dataset exists, and rollout remains fail closed by
default. Any new migrations require independent review of the exact staged tree
before application.
