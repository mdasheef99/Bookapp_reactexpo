# Phase 9 Unit 6B Route, Query, Identity, and Cache Evidence

**Status:** `locally_complete_merge_pending`
**Date:** 2026-07-30
**Feature commit:** `9ef9eb3`
**Human spot check:** `not_yet_selected_for_human_spot_check`

## Authorized scope

This receipt covers Phase 9 Unit 6B only under the approved Unit 6 SDD and
contract matrix: Store Owner Inventory route structure, the five Unit 6A read
contracts, portable frontend validation, private React Query identity/cache
ownership, and guarded foundation screens. It does not authorize or implement
capture mutations, review mutations, Close, inventory commit, publication,
offline mutation persistence, Unit 7, migrations, deployment, or external
service changes.

## Implemented foundation

- Replaced the flat `/inventory` route with guarded nested Expo Router stacks
  for hub, reviews, scan setup/preview, session, candidate, missed-book, and
  summary destinations.
- Added strict UUID route parsing with unknown-parameter rejection. Invalid
  links remain behind the Owner authorization boundary before showing safe
  route-unavailable copy.
- Added exact `phase9-owner-ux-v1` request/response schemas for U6Q01, U6Q02,
  U6Q04, U6Q05, and U6Q06, including cross-field refinements, safe-text
  normalization, BCP 47 validation, bounded paging, and private-key rejection.
- Added one Edge Function read adapter with local operation-scoped error
  normalization. Transport messages and transport-supplied retryability never
  become trusted UI behavior.
- Added React Query keys containing contract, user, store, session, candidate,
  scope, filters, page size, and cursor as applicable. Defaults are bounded:
  15-second stale time, five-minute garbage collection, and at most one retry
  for locally registered retryable failures.
- Added route-independent serialized identity coordination. User/store/logout/
  eligibility transitions cancel in-flight Unit 6 work before removing the
  complete private query prefix; queries for a new identity stay disabled until
  cleanup finishes.
- Preserved the existing Inventory hub presentation while wiring Owner
  discovery. Later Unit 6 screens are non-mutating foundation states only.

## Red-first tests and review

The implementation was developed with focused contract, service, query,
identity, route-registration, dynamic-route, access-boundary, privacy-
architecture, and auth-coordinator tests.

One combined broad review returned `CHANGES_REQUIRED`:

1. exact contracts and operation-specific error admissibility were incomplete;
2. component-local identity state could miss cleanup across route unmounts;
3. malformed dynamic routes could bypass the Owner guard;
4. route parsers accepted unknown parameters; and
5. the hub did not invoke discovery.

The single authorized correction batch addressed all five findings. No second
review or additional correction batch was performed.

## Verification

- Jest: all 13 existing relevant suites and 85 tests pass. The broad command
  passed 12 suites/77 tests; one supplied logout path was stale, so that command
  reported one missing-path suite. The verified existing logout suite then
  passed 1 suite/8 tests. There was no product-test failure.
- TypeScript: `npx.cmd tsc --noEmit --allowImportingTsExtensions --pretty false`
  passed with zero diagnostics.
- Lint: unavailable; `package.json` defines no lint script and the repository
  has no ESLint configuration.
- Staged runtime hygiene: complete staged diff inspected; `git diff --cached
  --check` passed; no generated artifact was staged; secret-like matches were
  only deliberate forbidden-key validation literals.

## Bounded Expo web smoke

The local Expo web server compiled 2,208 modules. The in-app browser verified:

- `/inventory`;
- `/inventory/reviews`;
- `/inventory/scan`;
- a valid session/candidate route; and
- a malformed session summary route.

The available unauthenticated state consistently showed the Owner access guard
before private content. The malformed route also preserved authorization-first
privacy. Browser console warnings/errors were zero. Eligible authenticated
Owner credentials were unavailable, so logout/store-transition browser smoke
was not fabricated; the deterministic auth, identity, and cache suites cover
those transitions. The local server was stopped and its temporary logs removed.

## External-state and scope receipt

- Database/Supabase mutations: none.
- Storage mutations: none.
- Migrations created/applied: none.
- Deployments/provider calls/external-service mutations: none.
- Staged, committed, pushed, or merged before this receipt: runtime committed
  locally only as `9ef9eb3`; push and merge remain the authorized closeout.
- Human spot check: `not_yet_selected_for_human_spot_check`.

## Next authorized action

After the bounded evidence commit and authorized fast-forward merge/push,
proceed red-first with **Phase 9 Unit 6C — capture, preview, progress, and
recovery UX** only. Units 6D-6F, Unit 7, migrations, Supabase/Storage changes,
and deployment remain separately gated.
