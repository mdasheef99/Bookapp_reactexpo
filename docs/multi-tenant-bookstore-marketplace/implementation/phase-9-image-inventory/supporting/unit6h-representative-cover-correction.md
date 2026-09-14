# Unit 6H Follow-up — Representative-Edition Cover Correction

**Date:** 2026-09-13
**Branch / HEAD reviewed:** `codex/phase9-duplicate-confirmation` / `30c9658`
**Status:** M61/M62 and Owner Edge v12 live-verified at the database/function layer; local test/config/documentation correction is verified but uncommitted; matching worker/client rollout and connected proof pending authorization
**Scope:** cover presentation only; duplicate confirmation, selected-edition identity, inventory duplicate handling, and public discovery remain unchanged

## Decision and boundary

When the one selected coherent Google Books edition has no cover, BookConnect may
reuse one cover from another edition already present in that same provider
response only when normalized title, the complete author set, and base language
match and subtitle/series/volume do not conflict. The selected edition remains
unchanged. The fallback is labelled `representative_edition` with its own source
record and policy version; it is never represented as the selected edition's
`coverReference`.

Google Books exposes usable volume/order evidence but may expose series only as
an opaque identifier. The correction decodes the usable volume value, does not
mislabel an opaque ID as a human series name, and fails closed by suppressing a
fallback when either the selected or cover-source record carries unresolved
series evidence.

This correction makes no second Books API call, performs no cross-provider
stitching, changes no title/author/ISBN/publisher/date/edition field, and does not
backfill historical rows. A selected edition's exact cover always takes priority.

The representative cover is Owner-private review data. Explicit Add to Inventory
may copy it into the separate private `store_inventory.representative_cover`
field. `store_inventory.cover_url`, canonical metadata, and the public listing
projection remain unchanged, so publication cannot silently advertise the
representative image as an exact-edition cover.

## Local implementation

- The Google Books adapter deterministically selects a compatible fallback from
  its already-decoded candidates. Provider-neutral validation recomputes the
  selection and rejects forged or conflicting representative-cover payloads.
  Google volume/order evidence is decoded; unresolved series membership blocks
  fallback rather than being guessed.
- The metadata worker persists accepted fallback provenance through a new
  service-role-only public delegate to a private immutable sidecar.
- Owner batch contracts expose the labelled fallback only when the exact selected
  cover is null. Forward-only M62 aligns standalone detail, fresh review-save,
  completed replay, and read-only replay with that projection. The new response
  member is optional during rollout but strictly validated when present, avoiding
  an Edge/database deployment-order outage. The compact card and metadata sheet
  label it `Representative edition`.
- The Add-to-Inventory trigger copies the sidecar into the separate private
  inventory field only at the existing explicit commit boundary. Caller-supplied
  or later-mutated representative-cover JSON is rejected.

## M61 migration ledger entry

| Item | Local evidence | Remote state |
| --- | --- | --- |
| File | `20260913000061_marketplace_phase9_representative_edition_cover.sql` | applied once as `20260913111342 marketplace_phase9_representative_edition_cover` |
| SHA-256 | `A2A8F9191E29C9813DEBC4E35EA8170F00538288079FFA2E7014621A4D90D463` | no remote readback |
| Private persistence | immutable, RLS-enabled `marketplace_sec.phase9_metadata_representative_covers`; no direct API/service table grant | table/RLS/immutable trigger verified; zero rows |
| Write boundary | postgres-owned private function plus public `SECURITY INVOKER` delegate; execute only for `service_role` | delegate verified; service execute true, anon/authenticated false |
| Inventory | nullable checked `store_inventory.representative_cover`; database-owned insert copy and immutable thereafter | column/copy trigger verified; zero non-null rows |
| Owner projection | representative cover and `fieldSources.cover=representative` only when exact selected cover is absent | Owner Edge v12 active; deployed contract matches local source |
| Public projection | unchanged | unchanged; connected row proof pending |

M52–M60 were not edited. M60 remains live as remote version `20260912072815`.
M61 was applied once to the verified development project as remote version
`20260913111342`; no historical migration was edited or replayed.

## M62 migration ledger entry

| Item | Local evidence | Remote state |
| --- | --- | --- |
| File | `20260913000062_marketplace_phase9_representative_cover_detail_projection.sql` | applied once as `20260913162154 marketplace_phase9_representative_cover_detail_projection` |
| SHA-256 | `E8CAAC179363D1E709F071BBF81436B7ED4B24968E0979ADA7A402C8C435066F` | artifact hash matched before application; remote history/readback identifies version `20260913162154` |
| Private helper | postgres-owned `SECURITY DEFINER`, empty search path, execute revoked from PUBLIC/anon/authenticated/service_role | present; helper ACL readback denies API roles |
| Owner RPCs | replaces only detail and review-save response projection; authenticated execute retained, anon/service denied | remote version `20260913162154`; authenticated entrypoint readback passed |
| Data/schema effect | no table/column/index/trigger/data/backfill/public/Storage change | sidecar and representative-cover inventory counts remain zero |

M52–M61 were not edited by M62. M62 was applied once after exact-project and
artifact-hash preflight; no worker/client deployment, Storage/business-row
mutation, or Git publication occurred. Matching runtime deployment and
connected proof remain separately gated.

## Verification actually run

- 2026-09-14 full-Jest corrective follow-up: Jest discovery was restricted to
  conventional test/spec filenames, removing seven helper/fixture collectors;
  stale mounted-route/M13-wrapper and CRLF-sensitive SQL fixtures were aligned
  with current source; and retained TanStack query/mutation GC timers were
  eliminated through explicit test-instance teardown. The reporter's exact
  command passes 5 suites/48 tests. Image-inventory passes 61 suites/494 tests
  with one suite/four tests skipped. The complete run passes 303 suites/2,479
  tests with one suite/four tests skipped (304 suites/2,483 tests total) and
  exits normally without the earlier non-exit warning. A separate
  `--detectOpenHandles --silent` run has the same totals and no persistent
  open-handle, force-exit, or one-second non-exit warning. TypeScript and
  `git diff --check` pass. The normal full run still emits React `act(...)`
  warnings in existing VirtualizedList/timer, CandidateReview state,
  search/query, and subscription-query paths, plus the NetInfo dynamic-import
  fallback warning and Node `DEP0040`; these remain unresolved test/tooling
  hygiene warnings. No production source, migration SQL, external state,
  deployment, or Git publication changed; the rollout/connected-proof gate is
  unchanged.
- Initial red run failed because the helper, contract fields, UI rendering, and
  M61 did not yet exist.
- Fresh `npx.cmd tsc --noEmit`: PASS.
- Fresh `npm.cmd run build:phase9:metadata-worker`: PASS. The first sandboxed
  invocation failed before compilation with Windows `EPERM` on
  `C:\Users\user`; the approved local rerun outside that sandbox passed.
- Focused Google Books/provider/composition/UI/migration Jest: 7 suites,
  132/132 tests PASS.
- Metadata worker/gateway/identity/provider Jest with `--detectOpenHandles`:
  5 suites, 72/72 tests PASS.
- Affected Owner contract/card Jest with `--detectOpenHandles`: 2 suites,
  55/55 tests PASS.
- Fresh complete affected Jest: 8 suites, 310/310 tests PASS, including Google
  decoding/series suppression, provider validation, Owner batch/detail contracts,
  metadata sheet rendering, worker composition, and M61/M62 SQL structure.
- Disposable PGlite M52–M62 integration: 2/2 PASS, covering service-only/RLS
  boundaries, private M62 helper denial, authenticated-only Owner RPCs, standalone
  detail/save equivalence, labelled batch projection, explicit Add copy, no public
  listing, and immutability.
- Existing Unit 6G foundation/session-lifecycle and Unit 7A create-only commit
  integration cases in the combined database run: 45/45 PASS.
- Full structural metadata integration using the M47/M48 and M52–M62 local chain:
  14/14 PASS, including the real worker batch → runtime gateway → service-only
  public delegate → private sidecar → authenticated Owner-detail path.
- Dedicated M54/M55 lifecycle/identity control: 7/7 PASS.
- Phase 9 continuity/documentation validator: PASS with 195 definitions, zero
  duplicate definitions, zero missing traceability, repository diff check PASS,
  and only advisory document-size notices.
- Rollout preflight/readback: exact project `ahntbtktjjmvfosgkmgn` healthy;
  M60, M61, and M62 present once in order. M62 readback verified the
  postgres-owned private helper, authenticated-only Owner detail/save entrypoints,
  denied helper execution for API roles, and zero sidecar/inventory
  representative-cover rows. No table/data/Storage mutation was performed by
  M62.
- Owner Edge v12: ACTIVE, JWT verification enabled, deployed hash
  `ad75a08f3624f543f904cf2bf6833bcca132dfc1727e5868d52022365aacea14`;
  the deployed M61 response-contract file matches local source.
- Fresh rollout checks: TypeScript PASS; metadata-worker build PASS;
  deployment-runtime validator PASS; M61 contract Jest 3/3 PASS; M62
  migration contract Jest 4/4 PASS. Connected no-cover review/Add proof was not
  run because the matching runtime has not been deployed.

The focused affected Jest runs emitted no React `act(...)`, open-handle, or
force-exit warning. The later normal full run did emit React `act(...)`
warnings from existing VirtualizedList/timer, CandidateReview state-update,
search/query, and subscription-query paths. It also emitted the NetInfo warning
that its dynamic-import callback was unavailable under this Jest invocation and
it fell back to assuming connected, plus Node `DEP0040` from Expo's
`whatwg-url-without-unicode` loading deprecated built-in `punycode`. The
independent `--detectOpenHandles --silent` run exited normally with no
persistent-handle or force-exit warning. The evidence supports a remaining test
harness/dependency warning set, not a representative-cover implementation
failure; the warnings are not suppressed or claimed resolved by passing
assertions.

The broader structural-metadata integration file initially finished 10/14 and
exposed four test defects/debts. They were investigated individually before the
bounded test-only correction:

1. At `phase9StructuralMetadataWorker.integration.test.mjs:262`, the vector
   expects `bibliographic` for valid ISBN `9780306406157` when title/authors are
   also present, while the database path returns `isbn`. The fixture setup at
   lines 91-96 stops at M35 plus M37/M38, so it does not load M55's later
   identity correction at `20260830000055...:9`; the mismatch is a stale fixture,
   not evidence that the current M55/runtime rule disagrees.
2. That failed assertion prevents its later cleanup; the next fixture's
   candidate-index-15 setup at `phase9StructuralMetadataWorker.integration.test.mjs:688`
   then raises the reported duplicate-key error. Running the setup test plus
   this reclaim test without the failing identity test passes 2/2, confirming
   this is a cleanup cascade rather than an independent implementation failure.
3. The concurrent coalescing assertion at
   `phase9StructuralMetadataWorker.integration.test.mjs:494` observes
   `claimed: 1`, confirming the single-leader guarantee, but expected the stale
   `manual_metadata_required` result instead of `retry_scheduled`. The current gateway explicitly
   completes a pending follower as retryable at
   `metadataProductionGateway.ts:112-114`, and the database completion path
   schedules retry for retryable provider failures.
4. The provider-503 assertion at
   `phase9StructuralMetadataWorker.integration.test.mjs:877` expects manual
   completion even though M38/current worker semantics schedule retry for a
   retryable provider failure. The isolated setup-plus-test run reproduces this
   single stale expectation, with actual `retry_scheduled`.

The earlier bounded test-debt correction changed only
`phase9StructuralMetadataWorker.integration.test.mjs`: its identity-row removal
runs from `finally`, and retry assertions match `retry_scheduled`. This follow-up
then extended that same fixture to load the M47/M48 and complete M52–M62 chain
and prove the actual representative-cover gateway path. Fresh structural 14/14,
M55 7/7, and representative-cover 2/2 runs pass. They emitted no `act(...)`,
open-handle, or force-exit warning.

## Residual risk and next action

Representative-cover persistence is deliberately best-effort after accepted
metadata terminalization so a cosmetic fallback cannot block metadata selection
or explicit inventory commit. A worker crash or sidecar-RPC failure in that
narrow interval can leave the existing placeholder for that candidate; there is
no backfill or second provider call. This is a known bounded availability risk,
not an identity or public-data integrity risk.

The exact live M61 SQL bytes/checksum remain unavailable from the connected
readback. Migration history and schema/grant/trigger behavior identify the live
version, but this remains an explicit evidence limitation rather than an exact
remote-artifact checksum claim. The unrelated existing
`marketplace_sec.phase9_worker_wake_dispatches` RLS hardening note is also left
out of this bounded correction.

The exact next action, using the previously granted development rollout/Git
authority, is to commit and push the verified local test/config/documentation
correction on `codex/phase9-duplicate-confirmation`, deploy the tolerant Owner
Edge contract and matching metadata worker/client, then run one connected
no-cover scan through standalone detail, review-save, explicit Add, and
public-projection readback. The Render worker is Git-backed at commit
`573182267ddd79e08b0abfb348b5afd9fb0dc571`; the matching runtime remains
uncommitted on the current branch.

Historical external mutations were limited to the already-recorded M61 schema
application and Owner Edge v12 deployment. In the representative-cover rollout,
M62 was the sole new remote migration mutation: it changed only the recorded
PostgreSQL function definitions/ACLs. In this 2026-09-14 verification and
documentation follow-up there was no Supabase data/Storage/provider/dispatch or
application-data mutation or deletion, and no Render deployment. The feature
baseline `30c9658` is already present on the remote branch; the current
test/config/documentation correction remains uncommitted and unstaged.
