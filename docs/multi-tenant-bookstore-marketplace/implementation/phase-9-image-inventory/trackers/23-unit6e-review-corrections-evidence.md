# Phase 9 Unit 6E False/Missed-Variant Correction Evidence

**Status:** `live_smoke_complete`
**Date:** 2026-08-01
**Feature commit:** `76e14186f39914a1492cadb44e4c0e190df70605`
**Correction checkpoint:** `8bceab260a953b4d832fd55f34f58db12fa009b1`
**Correction tree:** `8a70bbb3b102ecda22f2904f20952852849567f1`
**Work unit:** Phase 9 Unit 6E only
**Next eligible unit:** Unit 6F, separately authorized
**Database mutation authority:** M30 plus one explicitly authorized direct eligibility update and one explicitly authorized disposable Unit 6E fixture for the development store

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

- Supabase M30, the exact-store direct eligibility update, and the explicitly
  authorized §11 fixture transaction are the only external database mutations
  recorded here; no Storage object, provider, deployment, inventory, listing,
  publication, or commerce mutation occurred.
- The target Owner now has an active eligible store. The later authorized
  disposable Unit 6E fixture creation and its browser-deployment blocker are
  recorded in §11; the earlier no-fixture browser limitation remains historical
  evidence for the pre-fixture state.
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
At the time of this activation readback (before the later §11 fixture),
`eligibility_fields_ok=true` was returned with one target
`owner/active` membership, one target store row, `store_inventory=0`, and
`marketplace_book_listings=0`. Target-scoped
`image_extraction_sessions`, inputs, candidates, and `media_assets` counts are
all zero at that time. No role, membership, other store, inventory, listing, publication,
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

## 11. Explicit disposable Unit 6E fixture and browser blocker

The user explicitly authorized one disposable development-only fixture for the
exact target Owner/store so that AC24–AC27 could be exercised. Before insertion,
the connected project was re-read as `ahntbtktjjmvfosgkmgn`
(`Bookconnect_reactexpo`, `ACTIVE_HEALTHY`); the exact active Owner membership
was `7dfa8584-6b0f-43b4-a17b-abf5858c3b60` and the exact store was
`2a12639f-e011-4985-b4b0-f48f5033a701`. The target had zero sessions, inputs,
candidates, media, proposals, inventory, and listings, and all planned IDs were
collision-free. No other user or store was in scope.

The single fixture transaction used only the existing Phase 9 tables and the
existing owner-review functions. It created no Storage object and made no
inventory, listing, publication, commerce, provider, role, membership, schema,
RLS, or store-eligibility mutation.

| Fixture record | UUID / state | Purpose |
| --- | --- | --- |
| Session | `9e6e0000-0000-4000-8000-000000000001`, `active`, `phase9-unit6e-smoke-fixture-v1` | Exact Owner/store session, one input, below candidate cap |
| Synthetic media metadata | `9e6e0000-0000-4000-8000-000000000010`, `scan_input`/`private_scan` | One 1×1 metadata row required by the live `ready`-input constraint; no Storage object (`storage.objects` count `0`) |
| Input / synthetic job / analysis | `9e6e0000-0000-4000-8000-000000000002` / `9e6e0000-0000-4000-8000-000000000003` / `9e6e0000-0000-4000-8000-000000000004` | Ready input, resolved fixture vision lineage, `p9-vision-v2` analysis |
| Observations | `9e6e0000-0000-4000-8000-000000000011`–`9e6e0000-0000-4000-8000-000000000014` | Four deterministic candidate observations |
| Candidate A | `9e6e0000-0000-4000-8000-000000000020`, `ready`, `review_ready=true` | False-candidate path; detail allowed `mark_false` |
| Candidate B | `9e6e0000-0000-4000-8000-000000000021`, `failed`, `review_ready=false` | Unsupported path; blockers `candidate_failed` and `review_missing` |
| Candidate C | `9e6e0000-0000-4000-8000-000000000022`, `ready`, `review_ready=true` | Proposed variant path; linked proposal resolves original `Café du Livre` in `fr`/`Latn` |
| Candidate D | `9e6e0000-0000-4000-8000-000000000023`, `ready`, `review_ready=false` | Stale recovery path; blocker `variant_source_stale` |
| Proposal C / D | `9e6e0000-0000-4000-8000-000000000030` (`proposed`) / `9e6e0000-0000-4000-8000-000000000031` (`stale`, version `2`) | Candidate-linked U6Q05/M24 projections; both `search_eligible=false` |

Candidates A/C/D were prepared through the existing
`phase9_update_candidate_review_v2` workflow with the production review
contract. D was then moved to the authorized stale-only fixture state with
`lifecycle_reason='source_changed'`; no approve/reject/replace/activation
decision was issued. Post-insertion readback confirmed one active Owner
membership, all records tied to the exact target Owner/store, the Owner guard
accepted the store, C/D proposal IDs were visible through
`phase9_owner_search_variant_review`, and inventory/listings remained `0 / 0`.

The authenticated browser retained the target Owner/store surface, but the
bounded smoke could not reach the fixture screens. Direct live RPC readback
works, while the deployed `phase9-owner-ingestion` Edge Function is version `1`
and its deployed request contract accepts only `phase9-v1`; the current app
sends `phase9-owner-ux-v1`. The normal `/inventory`, scan-session, and candidate
routes therefore returned HTTP `400` from that deployed function. No browser
mutation was submitted: no false decision, no missed-book C06 candidate, no
variant decision, and no navigation-side data change. The only console output
remained the previously recorded framework/configuration warnings.

Accordingly AC24, AC25, AC26, and AC27 remain **blocked by the stale deployed
Edge Function**, not by fixture eligibility or database linkage. No deployment
or production-code change was authorized in this step. The exact browser
verification can resume after the existing `phase9-owner-ingestion` deployment
is advanced to the current Owner-UX contract.

The continuity validator passed (`REQUIREMENT_DEFINITIONS=195`, duplicate and
traceability counts `0`, regression probes PASS, `PHASE9_CONTINUITY_CHECK=PASS`)
and `git diff --check` passed for this documentation-only update. The bounded
Unit 6E Jest/integration/TypeScript commands were not rerun because no
production or test code changed and the authenticated browser smoke could not
reach its first fixture screen.

## 12. Authorized development deployment and live smoke receipt

The deployment authorization was limited to the existing checked-in
`phase9-owner-ingestion` function in the development project. Read-only
preflight confirmed HEAD/source commit `e0668b6ffe5c52bbfa653547e4e1917649ed15de`,
an `ACTIVE_HEALTHY` project `ahntbtktjjmvfosgkmgn` named
`Bookconnect_reactexpo`, and no worktree change outside this tracker. The
checked-in function accepts `phase9-owner-ux-v1`, authenticates the request
before resolving the exact Owner RPCs, returns the safe Owner-UX error
envelope, enforces the privacy-field filter, and has no inventory, listing,
publication, or commerce write path. The deployed version-1 function was
confirmed to be the older `phase9-v1` contract. Existing active runtime
configuration was sufficient; no secret value was read or changed.

Connector/deployment receipts:

1. The initial Supabase MCP bundle containing all 63 checked-in shared files
   was rejected before deployment because the bundler could not resolve the
   existing extensionless `contracts/registers` import.
2. The established CLI command
   `supabase functions deploy phase9-owner-ingestion --project-ref
   ahntbtktjjmvfosgkmgn --use-api --output json` uploaded the source but was
   rejected by the project API with HTTP `403` (insufficient privileges); the
   live function remained version `1`.
3. The authorized Supabase MCP deployment then uploaded only the 21 reachable
   checked-in dependencies (including identical virtual extensionless aliases
   required by the existing imports), with entrypoint
   `phase9-owner-ingestion/index.ts`, import map
   `phase9-owner-ingestion/deno.json`, and `verify_jwt=true`. It returned
   function ID `f8aec89f-ae2a-431a-8a97-5775a2405b90`, version `2`, status
   `ACTIVE`, and SHA-256
   `1832618d0ac0b16a11f27fd4795aec6eb05f76279c3b4fd1027d729c5f5d7849`.
   No repository source, migration, test, validator, schema, or secret was
   edited by the deployment.

Post-deployment readback retained `verify_jwt=true` and the current
`phase9-owner-ux-v1` parser/response routes, including authenticated Owner
resolution, session/candidate reads, U6Q05 candidate detail, privacy filtering,
and safe error mapping. Edge-function logs recorded only version-2
`OPTIONS 200` and `POST 200` requests during the smoke. Unauthenticated and
malformed-JWT requests carrying an unsupported contract returned safe JSON
`401` responses (`UNAUTHORIZED_NO_AUTH_HEADER` and
`UNAUTHORIZED_INVALID_JWT_FORMAT`); no raw exception was exposed.

The exact Owner/store fixture was then exercised at
`/inventory/scan/9e6e0000-0000-4000-8000-000000000001`:

- **AC24:** Candidate A exposed `Mark false`. The web `Alert.alert` confirmation
  did not materialize as an accessible browser dialog, so no destructive
  confirmation was submitted; returning to the session left A unchanged.
  Candidate B was explicitly read-only with its save controls disabled and no
  false action or C07 candidate exposed. The cancellation/no-write behavior is
  also covered by the focused OwnerCorrectionScreens test below.
- **AC25:** The missed-book form rejected `not-a-language` with the inline
  BCP-47 error and disabled submit. With only title, one author, and `en`, it
  created exactly one manual candidate
  `d96f6879-0439-4bb9-b0f7-aa8c81d1b8ef`, navigated to its review route, and
  returned without a dirty-navigation warning or duplicate. The session then
  showed five books; no inventory, listing, publication, commerce, or Storage
  row was created.
- **AC26:** Candidate C exposed only proposal
  `9e6e0000-0000-4000-8000-000000000030` with its original/suggested wording
  and approve/reject/replace/leave-unresolved actions. `Leave unresolved`
  closed the sheet without a decision; no approve, reject, or replace action
  was submitted and the canonical candidate remained unchanged.
- **AC27:** Candidate D reached proposal
  `9e6e0000-0000-4000-8000-000000000031` (stale, lifecycle version `2`). The
  replacement editor was opened and a local draft
  `Unit6E Local Replacement Draft` was entered. No save, approve, reject, or
  replacement decision was submitted. The live sheet exposed no latest/reapply
  controls until a stale-conflict refresh, so those controls were not
  fabricated or invoked; the unsaved draft remained visible in the sheet.

The final read-only audit returned one active Owner membership for
`7dfa8584-6b0f-43b4-a17b-abf5858c3b60` and the exact store/session linkage,
session `candidate_count=5`, exactly one `input_id IS NULL` manual candidate,
zero false dispositions, zero variant decisions, zero committed inventory or
listing references, and zero matching Storage objects. Proposal C remained
`proposed` version `1`; proposal D remained `stale` version `2`; the original
four fixture candidates retained their prepared baseline states. No duplicate
membership or out-of-scope user/store record was created or changed.

Final bounded verification after the smoke:

| Check | Result |
| --- | --- |
| Focused Unit 6E/affected Owner Jest set | 12 suites / 94 tests passed |
| Variant decision sheet regression | 1 suite / 8 tests passed |
| Remote-backed Unit 6E integration | 3/3 passed |
| TypeScript | `npx.cmd tsc --noEmit --allowImportingTsExtensions` passed |
| Continuity validator | `REQUIREMENT_DEFINITIONS=195`, semantic matrix 107 cases PASS, exact-owner/no-duplication probes PASS, `PHASE9_CONTINUITY_CHECK=PASS` |
| Diff hygiene | `git diff --check` passed |

Browser console output remained limited to existing development/framework
warnings (React DevTools, deprecated `shadow*`/`pointerEvents`, web
notification support, disabled Sentry, and the `orders` child-route warning);
no runtime error was observed. This section supersedes the stale-deployment
blocker above. The only remaining work is the documentation-only commit and
push of this tracker; Unit 6F remains separately authorized.
