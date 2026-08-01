# Phase 9 Unit 6E False/Missed-Variant Correction Evidence

**Status:** `verified_fixture_awaiting_final_commit`
**Date:** 2026-08-01
**Feature commit:** `76e14186f39914a1492cadb44e4c0e190df70605`
**Correction checkpoint:** `8bceab260a953b4d832fd55f34f58db12fa009b1`
**Correction tree:** `8a70bbb3b102ecda22f2904f20952852849567f1`
**Work unit:** Phase 9 Unit 6E only
**Next eligible unit:** Unit 6F, separately authorized
**Database mutation authority:** M30 plus one explicitly authorized direct eligibility update for the disposable development fixture

## 1. Authority and bounded scope

This receipt closes the Unit 6E finalization authorized after the successful
diff-only closure under:

- [Unit 6 Owner Capture, Review, and Recovery UX SDD](../work-units/06-owner-capture-review-recovery-ux-sdd.md);
- [Unit 6 contract matrix](../work-units/06-owner-capture-review-recovery-contract-matrix.md);
- [Owner review and commit SDD](../03-owner-review-inventory-commit-sdd.md);
- [media, security, and privacy SDD](../04-media-security-privacy-sdd.md);
- [Unit 6 design evidence](./18-unit6-owner-ux-design-evidence.md).

The frozen correction range is `76e14186f39914a1492cadb44e4c0e190df70605`
through `8bceab260a953b4d832fd55f34f58db12fa009b1`, with base
`45e3ac4034e9d3d405886ec596702aff4b39f9d8` and the expected tree
`8a70bbb3b102ecda22f2904f20952852849567f1`. The prior diff-only closure
already returned `CLOSED` for F-01, F-02, L-F1, and L-F2. This receipt records
application/readback and continuity evidence only; it does not reopen that
review or broaden the Unit 6E scope.

No Unit 6F/7 work, Storage mutation, provider call, deployment, real inventory
commit, public listing publication, or commerce behavior is included.

## 2. Delivered correction receipt

The frozen correction range preserves the narrow Unit 6E false/missed-variant
contract and its identity/privacy boundary:

- the confirmed-source helper accepts the historical canonical envelope and the
  U6C01 `value` envelope, including the zero-based author-position fallback;
- the Owner search-variant review RPC returns proposal IDs, concurrency versions,
  zero-based author positions, confirmed text, lifecycle fields, and the
  contract-allowed actions for proposed/stale/rejected/equivalent cases;
- unresolved proposed/stale variants expose `open_variant_review` through the
  candidate-detail read surface while terminal candidates remain fail-closed;
- Owner correction screens, queries, mutation contracts, and identity scoping
  remain private and typed; no analytic fields or private media URLs are added
  to the student/public boundary.

## 3. Supabase preflight and M30 application

The exact development project was re-verified read-only before application:

| Field | Verified value |
| --- | --- |
| Project ID/ref | `ahntbtktjjmvfosgkmgn` |
| Name | `Bookconnect_reactexpo` |
| Region | `ap-southeast-2` |
| Status | `ACTIVE_HEALTHY` |
| Postgres | `17.6.1.063` |
| Last migration before M30 | `20260730162700 marketplace_phase9_owner_safe_contracts` (M29) |
| Later Phase 9 migration before apply | none |

Pre-apply function readback matched the checked-in M29 baseline for the three
affected functions: expected owner, ACL, `SECURITY DEFINER` posture, and blank
`search_path` were preserved. The checked-in file
`supabase/migrations/20260801000030_marketplace_phase9_unit6e_review_corrections.sql`
contains only the three authorized `CREATE OR REPLACE FUNCTION` statements.
It was submitted unchanged through Supabase MCP and applied once; the apply
result was `success: true`. No other migration or SQL write was issued.

## 4. Remote verification

Post-apply migration history contains exactly one new row:

`20260801093048 marketplace_phase9_unit6e_review_corrections`

There is no later migration. Post-apply function metadata retains the expected
owners, ACLs, `SECURITY DEFINER`/invoker posture, and blank `search_path`.

Read-only fixture and boundary checks returned:

| Relation/check | Receipt |
| --- | --- |
| `image_extraction_sessions` / `inputs` / `candidates` | `2 / 11 / 6` rows; candidates remain `processing`, `review_ready=false`, with no review disposition |
| `phase9_search_variant_proposal_sets` / `proposals` / `decisions` | `1 / 2 / 0` rows; fixture proposals are `stale` and `rejected` with lifecycle versions present |
| `phase9_owner_review_scopes` / `phase9_owner_ux_cursor_keys` | `0 / 1` rows |
| `phase9_search_variant_alias_links` | `0` rows |
| `store_inventory` / `phase9_public_listing_projection` | `5 / 5` existing rows; no new inventory/listing write |
| Authorized Owner review RPC without membership | expected `P9_OWNER_NOT_AUTHORIZED` |
| Confirmed-source helper on fixture proposals | `owner_review_snapshot` present and confirmed source resolved for both fixture rows |

The checks were read-only and produced no data, Storage, inventory, listing,
publication, provider, or commerce mutation.

## 5. Automated verification actually run

| Check | Result |
| --- | --- |
| Focused Unit 6E/affected Unit 6B/auth/access Jest command | 12 suites, 98/98 tests passed in final bounded rerun |
| Remote-backed Unit 6E integration test | 3/3 passed |
| TypeScript | `npx.cmd tsc --noEmit --allowImportingTsExtensions` passed |
| Phase 9 continuity validator | `REQUIREMENT_DEFINITIONS=195`; duplicates `0`; missing traceability `0`; regression probes PASS; `PHASE9_CONTINUITY_CHECK=PASS` |
| Continuity file inventory | `MARKDOWN_FILES_CHECKED=62`; required phase files pass (including this tracker) |
| Diff hygiene | `git diff --check` and cached diff check passed |
| Generated Python residue | `.pyc` count `0` |

The focused Jest command covered the Unit 6E correction/architecture/service/
workflow/screen/query contracts plus candidate review, form, mutation/service,
access-boundary, and identity-sensitive regressions. No unrun full-suite or
native-device result is represented as passing.

## 6. Bounded authenticated browser receipt

Expo web was started locally at `http://localhost:8081` after the sandboxed
launch required the approved elevated retry. The user supplied local
development login/verification credentials; they were used only in the local
browser and are not recorded here.

The authenticated browser reached `/library`, `/profile`, and the Store Owner
entry at `/status`. The account displayed **Application under review**. Opening
`/inventory` displayed **Inventory unavailable** and the explicit message that
Active Store Owner access is required and private scan data was not shown.
No false/missed-variant action, review decision, save, upload, inventory write,
or publication action was attempted.

Observed console output was limited to framework/configuration conditions:

- deprecated `boxShadow`/`pointerEvents` style warnings;
- unsupported web notification-token listener warning;
- disabled-development Sentry warning;
- an `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` during
  startup before OTP recovery;
- a layout warning for an `orders` child route.

These observations are recorded as limitations, not as Unit 6E functional
failures or passes.

## 7. Development reviewer fixture bootstrap

This addendum records the separately authorized development-only reviewer
bootstrap. No store-review or store-profile workflow mutation has been made.

| Field | Before | After |
| --- | --- | --- |
| Reviewer UUID | `a15e05a0-ca47-426d-a983-1fee826cde8b` exists; no platform role | one active `store_reviewer` row (`2fbe3e1f-f887-40e1-bd1b-5f954538d593`), `granted_by` NULL |
| Reviewer login identifier | Supabase reports `test@example.com`; the supplied UUID was designated as the development reviewer | unchanged |
| Reviewer Store Owner memberships | one pre-existing owner membership for separate smoke-test store `68b0c1c9-7f70-4388-bd87-298df3a2ded4`; no new membership authorized | unchanged; no membership created or altered |
| Target Owner membership | `7dfa8584-6b0f-43b4-a17b-abf5858c3b60`, target store, `owner/active` | unchanged |
| Target store | `pending_verification`, verification `pending`, setup `incomplete`, selling `not_allowed` | unchanged at reviewer-bootstrap time; direct activation is recorded in §10 |
| Target request | `3e8a9cc1-1162-466f-8d1f-967b174f3fcd`, `submitted` | unchanged |
| Target inventory/listing | `0 / 0` | `0 / 0` |

The reviewer-bootstrap mutation was the exact `platform_user_roles` insert
through Supabase MCP. A later, separately authorized direct fixture activation
is recorded in §10; no `platform_admin` role, membership, RLS/grant/function/
schema/migration, inventory, listing, publication, commerce, Storage, or other
user/store record was changed. The reviewer role is intentionally retained as
a reusable development fixture per the authorization.

The production `store-review` and `store-profile` workflows remain separately
unverified. The direct fixture activation was explicitly authorized only to
permit Owner-session verification; it is not production workflow evidence.

## 8. External-state, limitations, and next gate

- Supabase M30 and the exact-store direct eligibility update are the only
  external database mutations recorded here; no Storage, provider, deployment,
  inventory, listing, publication, or commerce mutation occurred.
- The target Owner now has an active eligible store, but the target store has
  no disposable image-extraction session, input, candidate, or media fixture.
  Positive false/missed/variant UI mutation paths therefore remain unclaimed;
  the bounded browser check stops at the eligible inventory entry and records
  those paths as unavailable rather than fabricating coverage.
- Human visual spot-check selection, native-device smoke, production deployment,
  and provider/live-call verification remain deferred.
- Unit 6F requires a separate user authorization. Unit 7, additional migrations,
  deployment, inventory/publication, and commerce remain gated.

## 9. Closeout handoff

The single evidence/finalization commit contains this receipt, the Phase 9
current-state updates, the DOC-13 handoff, the implementation ledger entry, and
the continuity-validator routing update. The exact final Git branch/push/merge
state is reported with the session's final verdict; no claim of merge or push is
made by this tracker until Git confirms it.

## 10. Explicit direct fixture activation and Owner verification

The user explicitly authorized bypassing `store-review` and `store-profile` for
this disposable development fixture only. The connected project was
`ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`). The target was restricted to
Owner `7dfa8584-6b0f-43b4-a17b-abf5858c3b60` and store
`2a12639f-e011-4985-b4b0-f48f5033a701` (`books`). The pre-mutation readback
confirmed one `owner/active` membership and one target store row.

The current schema and guard readback confirmed that the canonical eligibility
columns are `public.stores.status`, `verification_status`, `setup_status`, and
`selling_status`. The live `marketplace_sec.phase9_is_store_owner`,
`phase9_owner_store`, `phase9_owner_ux_assert_owner`, and
`phase9_owner_variant_authorized` definitions require an authenticated active
Owner membership and `status='active'`, `setup_status='complete'`, and
`selling_status='allowed'` (with the variant guard delegating to the same
owner check). `verification_status='approved'` is also the required canonical
verified state.

| Field | Before | After |
| --- | --- | --- |
| `stores.status` | `pending_verification` | `active` |
| `stores.verification_status` | `pending` | `approved` |
| `stores.setup_status` | `incomplete` | `complete` |
| `stores.selling_status` | `not_allowed` | `allowed` |

The sole direct SQL mutation was:

```sql
update public.stores
set status='active', verification_status='approved', setup_status='complete', selling_status='allowed'
where id='2a12639f-e011-4985-b4b0-f48f5033a701'
returning id, status, verification_status, setup_status, selling_status;
```

Supabase MCP returned exactly one affected row with the intended after state.
Post-mutation readback returned `eligibility_fields_ok=true`, one target
`owner/active` membership, one target store row, `store_inventory=0`, and
`marketplace_book_listings=0`. Target-scoped
`image_extraction_sessions`, inputs, candidates, and `media_assets` counts are
all zero. No role, membership, other store, inventory, listing, publication,
commerce, or Storage row was created or changed.

The authenticated Owner browser session was refreshed at `/storefront` and
showed the target store `books`. Navigating to `/inventory` succeeded after
the direct activation. Retrying scan readiness changed the prior error state
to the normal `Capture or choose a shelf photo.` state; `Start scan` remained
disabled because no disposable photo/session fixture exists. This is the live
evidence that the Phase 9 Owner guard accepts the exact Owner/store pair.

Bounded Unit 6E browser coverage was truthfully limited as follows:

- AC24 false-candidate gating: unavailable; no target-store candidate fixture.
- AC25 missed-book flow: unavailable; no disposable session/input/candidate and
  no photo was supplied or uploaded.
- AC26 variant decision flow: unavailable; no candidate-linked proposal fixture.
- AC27 stale recovery: unavailable; no stale proposal/session fixture.

No false, reject, replace, leave-unresolved, missed-book, upload, inventory,
listing, or publication action was submitted. Browser console output contained
only the existing React DevTools notice, deprecated `shadow*` and
`pointerEvents` style warnings, web notification-token support warning,
development Sentry-disabled warning, and the existing `orders` child-route
layout warning; no browser error was observed during the eligible Owner flow.

The reviewer workflow was not exercised. This direct activation verifies
Unit 6E Owner eligibility and the available live entry surface only; the
production `store-review` and `store-profile` workflows remain separately
unverified.
