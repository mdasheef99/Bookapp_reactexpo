# Phase 9 Unit 6E False/Missed-Variant Correction Evidence

**Status:** `complete_merge_handoff`
**Date:** 2026-08-01
**Feature commit:** `76e14186f39914a1492cadb44e4c0e190df70605`
**Correction checkpoint:** `8bceab260a953b4d832fd55f34f58db12fa009b1`
**Correction tree:** `8a70bbb3b102ecda22f2904f20952852849567f1`
**Work unit:** Phase 9 Unit 6E only
**Next eligible unit:** Unit 6F, separately authorized
**Database mutation authority:** M30 only, applied exactly once after exact-project preflight

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
| Focused Unit 6E/affected Unit 6B/auth/access Jest command | 12 suites, 95/95 tests passed |
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

## 7. External-state, limitations, and next gate

- Supabase M30 is the sole external mutation authorized and applied in this
  session; no Storage, provider, deployment, inventory, listing, publication,
  or commerce mutation occurred.
- The supplied account lacks Active Store Owner membership. Positive Owner-only
  false/missed-variant UI mutation, native camera/device behavior, and live
  Owner-write smoke remain unclaimed; deterministic tests and read-only RPC
  denial cover the available evidence.
- Human visual spot-check selection, native-device smoke, production deployment,
  and provider/live-call verification remain deferred.
- Unit 6F requires a separate user authorization. Unit 7, additional migrations,
  deployment, inventory/publication, and commerce remain gated.

## 8. Closeout handoff

The single evidence/finalization commit contains this receipt, the Phase 9
current-state updates, the DOC-13 handoff, the implementation ledger entry, and
the continuity-validator routing update. The exact final Git branch/push/merge
state is reported with the session's final verdict; no claim of merge or push is
made by this tracker until Git confirms it.
