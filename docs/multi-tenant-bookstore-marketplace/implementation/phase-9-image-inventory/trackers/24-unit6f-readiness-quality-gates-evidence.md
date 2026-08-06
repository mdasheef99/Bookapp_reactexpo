# Phase 9 Unit 6F Readiness and Quality-Gate Evidence

**Verdict:** `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`
**Status:** `unit6f_browser_verified_native_gate_pending`
**Date/session:** 2026-08-02 bounded authenticated browser verification and
quality-gate closeout
**Branch:** `codex/phase9-unit6f-readiness-quality-gates`
**Expected HEAD:** `b564fbd`
**Implementation commits under test:** `bdb85b6`, `237393b`, `a0d55b5`, `b564fbd`

This record is the authoritative Unit 6F evidence for this session. It records
the authorized browser/readback work and the exact reason the Unit 6 merge gate
did not close. It does not change the Unit 6 SDD, acceptance criteria, schema,
or runtime behavior.

## 1. Authority, scope, and stop condition

The evidence is evaluated against the approved Unit 6 SDD §§19–24, 28, and
34–35 and the contract matrix §3 rows U6-AC29–U6-AC40. The relevant hard gate is
the SDD §24 requirement for measured pilot evidence on a representative
low-end Android device; §34 also requires camera/gallery/recovery, 15-card,
offline, accessibility, and Android gates before Unit 6 is complete. The matrix
maps the native requirement to U6-AC36 and U6-AC39. Browser evidence and
deterministic tests cannot be promoted to native-device evidence.

Authorized scope was limited to exact-project read-only preflight, a local Expo
web run, bounded browser verification, reusable disposable fixture reads, two
Review Save attempts, one Close, documentation, and local quality gates. No
code, migration, schema, deployment, provider, Storage, inventory, listing,
publication, or commerce change was made by this session.

## 2. Preflight and fixture

| Field | Verified value |
| --- | --- |
| Supabase project | `ahntbtktjjmvfosgkmgn`, `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, `ap-southeast-2` |
| Owner/store authority | Owner `7dfa8584-6b0f-43b4-a17b-abf5858c3b60`; store `2a12639f-e011-4985-b4b0-f48f5033a701`; active `owner` membership; store selling allowed |
| Disposable session | `9e6e0000-0000-4000-8000-000000000001`; `phase9-unit6e-smoke-fixture-v1`; one input, five candidates |
| Review probe candidate | `d96f6879-0439-4bb9-b0f7-aa8c81d1b8ef`, a manually added disposable missed-book candidate; no committed inventory/listing |
| Browser runtime | Local Expo web at `http://localhost:8081`; authenticated Store Owner route reached through `/inventory` and nested session routes |
| Database mutation authority | Exactly two Review Save probes and exactly one Close were authorized; no migration or schema authority was granted |

The live readback also reconfirmed the pre-existing Supabase advisory that RLS
is disabled on `public.spatial_ref_sys`,
`public.marketplace_event_schema_registry`, and
`public.marketplace_notification_type_registry`. This session did not apply
the advisory SQL or otherwise remediate those tables.

## 3. Browser receipt

### 3.1 Review Save and stale-scope fencing

- The normal Save flow filled the required review fields and submitted exactly
  once. The UI entered a pending state, showed server-confirmed `Review saved`,
  performed no visible retry, and reload returned the canonical saved note.
- Read-only readback showed the probe candidate advance from `needs_review`
  version 1 with no review to `ready`, candidate version 2, review version 1,
  `review_ready=true`, `review_disposition=reviewed`, and no committed IDs.
- A second Save changed only the disposable note, submitted exactly once, and
  immediately navigated to candidate `...0022`. The old request completed before
  the transition: the old candidate advanced to version 3/review version 2,
  while the new candidate remained unchanged by the old response. This is
  classified `COMPLETED_BEFORE_TRANSITION`; stale-result synchronization was
  not observed live because the response won the race. Transport abortion is
  `VERIFIED_BY_DETERMINISTIC_TEST_ONLY` because this browser surface exposed no
  controlled latency, network interception, or offline toggle.
- The operation ledger contains exactly two completed `U6C01` entries for this
  session's two Save probes, at `2026-08-02 13:15:58.239186+00` and
  `2026-08-02 13:17:31.338741+00`. No browser retry was observed.

### 3.2 Close, confirmation, and exact copy

- The live Summary showed one submitted/processed input, five detected
  candidates, three ready, two needing review, one failed, one missed, and zero
  committed/private/published items before Close.
- Dialog smoke showed the confirmation title and the no-commit/no-delete/no-
  discard description. Immediate keyboard attempts did not confirm; Escape
  dismissed the dialog without a mutation. The final action was one deliberate
  click on `Close session`.
- During the request, the dialog displayed `Confirming…` with U+2026 (`U+2026`)
  rather than three periods or mojibake. Cancel and Confirm were disabled while
  the request was pending.
- The UI then showed `Session state: closed`, `Session closed`, and that staged
  candidates were kept with no inventory committed. Reload preserved the closed
  state. The operation ledger contains exactly one completed `U6C02` at
  `2026-08-02 13:21:27.336559+00`.

### 3.3 Responsive, privacy, and diagnostics boundaries

- At a 360×800 viewport, the closed Summary retained its labels, attention
  section, and review-next action without horizontal clipping; vertical scroll
  remained available. Browser text-zoom was not claimed because this tool did
  not expose a reliable text-size control.
- No route, log, or browser diagnostic exposed a token, signed capability, raw
  media URI, or private payload. Observed diagnostics were pre-existing style
  deprecations, the web notification support notice, disabled development
  Sentry, an `orders` nested-route warning, and no browser console error or
  unhandled promise rejection attributable to the flow.
- Live offline/reconnect behavior, exact reconnect request counts, and native
  accessibility/performance were not simulated: the available browser surface
  had no network interception/offline control and no attached Android device.
  The corresponding behavior remains deterministic-test evidence only.

## 4. Supabase postcondition and noninterference readback

The closed fixture now reads: session `closed`, version 2, one input, five
candidates, zero committed items, `closed_at=2026-08-02 13:21:27.336559+00`,
session scope version 15, and presentation revision 16. All five candidates are
retained; every `committed_inventory_id` and `committed_listing_id` is null.
The review probe is `ready`, version 3, review version 2, and reviewed.

| Read-only postcondition | Result |
| --- | ---: |
| Target `store_inventory` rows | 0 |
| Target `marketplace_book_listings` rows | 0 |
| All pre-existing `listings` rows | 1 |
| All pre-existing `transactions` rows | 1 |
| All pre-existing `storage.objects` rows | 35 |

No `marketplace_events` row or inventory/publication/commerce side effect was
created by the Unit 6F probes. The ledger is the authoritative count for the
two `U6C01` Save probes and one `U6C02` Close.

## 5. Automated verification actually run

| Check | Result |
| --- | --- |
| Unit 6D–6F/image-inventory/auth/privacy/Unit 7 noninterference focused Jest | 22 suites, 155/155 tests passed; Jest reported existing React `act(...)` warnings and an open-handle warning after completion, so the test process was terminated after the successful result |
| Auth/owner/identity/access focused Jest | 15 suites, 114/114 tests passed |
| App auth and Store Owner route tests via `--runTestsByPath` | 5 suites, 11/11 tests passed |
| TypeScript | `npx.cmd tsc --noEmit --allowImportingTsExtensions` passed |
| Phase 9 continuity validator | `REQUIREMENT_DEFINITIONS=195`; duplicates `0`; missing traceability `0`; regression probes PASS; `PHASE9_CONTINUITY_CHECK=PASS`; 48 required phase files |
| Diff hygiene and generated residue | `git diff --check` and `.pyc` count `0` |
| Native/device gate | **Not run; mandatory evidence remains outstanding** |

The focused deterministic suites cover offline gating, review query fencing,
operation idempotency, close/replay behavior, privacy, telemetry, accessibility
contracts, route identity, and Unit 7 noninterference. They do not substitute
for the SDD-mandated representative low-end Android measurement.

## 6. Architectural risk and merge decision

### Owner operation lifecycle composition

**Recorded:** 2026-08-02. **Traceability:** Unit 6 SDD §§19–21, 28, and 34–35;
correction commits `237393b` and `a0d55b5`.

**Observation:** the feature currently composes three layers: the domain
operation hook owns the semantic idempotency key and canonical mutation;
`useOwnerUxOfflineGate` owns current identity/version authority and blocks
offline or stale actions; the screen owns mounted-scope and in-flight fencing.
The correction pass explicitly relies on those boundaries for Save cancellation,
generation-aware reconnect authority, CandidateReview reconnect deduplication,
and the exact pending confirmation state.

**Decision gate:** keep the layers composed for this closeout. Do not introduce
a lifecycle-consolidation refactor in Unit 6F or Unit 7. Any future
consolidation must first preserve the operation key, canonical-version gate,
mounted-scope generation, reconnect coalescing, pending UI, and no-Unit-7-effect
invariants under independent tests.

**Acceptance condition:** a future architecture change is acceptable only when
those invariants have an explicit owner, red-first tests, and fresh browser plus
native evidence. This entry records a risk and decision gate; it does not
authorize implementation.

### Merge disposition

The browser and read-only live gates passed within scope, but Unit 6F is not
complete under SDD §34 because the mandatory native-device evidence is absent.
The feature branch remains unmerged and no documentation commit was created in
this session. The exact next action is to obtain a representative low-end
Android run covering the outstanding camera/gallery/recovery, 15-card,
offline/reconnect, accessibility/large-text, and performance gates, then rerun
the final continuity/quality/merge review. Unit 7 remains gated.

## 7. Expo Go SDK54 runtime remediation

**Recorded:** 2026-08-02. This is a mobile-runtime prerequisite for the
native gate; it does not change Unit 6 behavior, acceptance criteria, schema,
or the native evidence requirement in Unit 6 SDD §§24, 28, and 34–35.

- The supplied device log identified two independent runtime blockers: the
  installed Expo Go client was SDK56 while this project is SDK54, and
  `react-native-mmkv@4.1.0` attempted to load the native `NitroModules`
  TurboModule, which is not present in the stock Expo Go binary.
- The project remains SDK54. The MMKV-only Supabase/auth storage boundary was
  replaced with the already-installed AsyncStorage package; the pending
  logout marker is now awaited asynchronously. MMKV and its NitroModules
  dependency were removed. No product, database, Storage, provider,
  inventory, listing, publication, or commerce behavior was changed.
- Verification: Expo Doctor `18/18`; TypeScript
  `npx.cmd tsc --noEmit --allowImportingTsExtensions`; focused auth/storage/
  Supabase tests `3 suites, 16/16`; cleaned Android Metro bundle HTTP `200`,
  `4,753,035` bytes, and no `react-native-mmkv` reference.
- A fresh LAN Metro server is running at `exp://192.168.31.183:8083` with a
  cleared cache. The device must use the SDK54 Expo Go build before the
  native gate can be claimed; the currently installed SDK56 client remains
  incompatible with this project.
- Supabase and external mutations: none. The exact next action is to install
  Expo Go SDK54 on the Android device, reopen the fresh LAN URL, and then run
  the representative low-end Android evidence required by the existing Unit
  6F gate. No merge or Unit 7 authorization is implied.

## 8. Native UUID remediation checkpoint

**Recorded:** 2026-08-02. This bounded correction addresses the native scan
startup crash only. It does not investigate `store_inventory`, alter database
access, change Unit 6 behavior, or change the native evidence requirement.

- Added the SDK54-compatible `expo-crypto` dependency and changed
  `createCaptureUuid()` to use the native-safe `Crypto.randomUUID()` API.
- Added `createCaptureAttempt()` and made setup, authorization, and registration
  identities lazy and stable across rerenders in the capture setup and preview
  screens.
- Added regression coverage for missing browser-global crypto, UUID shape,
  semantic-key composition, and setup/preview identity stability.
- Focused capture verification passed 2 suites / 17 tests; the full image-
  inventory suite passed 33 suites / 223 tests; TypeScript passed with
  `npx.cmd tsc --noEmit --allowImportingTsExtensions`; `git diff --check`
  passed. Jest retained the existing act/open-handle warnings documented above.
- `adb devices` listed no Android device or emulator in this environment, so
  the mandatory native gate was not run and Unit 6F remains incomplete.
- No Supabase, Storage, migration, deployment, or external mutation occurred.
  The exact next action remains to run the representative SDK54 Android gate
  on an available device, then complete the final quality/continuity review.

## 9. 2026-08-03 local web runtime and route-warning checkpoint

- Authorized work unit and scope: user-requested local Expo build/runtime
  check, explanation of the `store_inventory` permission symptom, and the
  independent Store Owner Orders route-warning correction. No Unit 6F
  acceptance behavior, migration, deployment, or live write was authorized.
- Completed: `Tabs.Screen` now registers the concrete `orders/index` route
  declared by `app/(store-owner)/orders/index.tsx`; the route regression
  assertion passes. The production web export passed after bundling 2,245
  modules. The Codex in-app browser authenticated with the supplied
  development OTP and rendered `/library`, `/dashboard`, and `/inventory`.
- Verification actually run: route test 3/3; web export passed; browser
  console had no errors. Observed warnings were the existing web
  `expo-notifications` listener limitation, missing Sentry DSN, deprecated
  `shadow*`/`pointerEvents` styles, and build-tool warnings.
- Live read-only evidence: exact project `ahntbtktjjmvfosgkmgn` remained
  `ACTIVE_HEALTHY`; `store_inventory` RLS is enabled, authenticated table
  SELECT/INSERT/UPDATE are false, owner policies remain present, and the
  controlled authenticated inventory RPCs are available. The legacy service
  still calls the table directly and `useStoreInventory` suppresses its list
  error, explaining why the browser route can render without showing 42501.
- Supabase/external mutations: none. No database, Storage, migration,
  deployment, inventory, listing, publication, or commerce mutation occurred.
- Decision and residual risk: do not grant broad authenticated table access.
  A separately scoped service-boundary remediation is still required for the
  legacy dashboard/inventory services. The Unit 6F native gate remains
  `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`.

## 10. 2026-08-04 CAP-01/CAP-02 capture-to-Preview handoff correction

- Authorized scope: bounded local capture selection handoff only. No session
  status, filters, accessibility navigation, candidate review, warnings,
  dashboard, WU2 transport, or Unit 7 behavior was changed.
- Confirmed root cause: Preview cleanup called `workflow.clear()` on every
  Preview unmount. The real scan Stack/access-boundary lifecycle can
  transiently unmount Preview while the current Owner identity re-coordinates,
  so the provider-held selection was cleared before Preview stabilized.
  Provider placement, route params, and picker URI/file lifetime were not the
  cause.
- Correction: Preview cleanup still cancels local upload work but no longer
  clears provider selection. Explicit successful registration and
  “Choose another image” retain their existing clear behavior; provider
  teardown/identity cancellation still releases workflow memory.
- Red/green verification: the real Expo Router `Stack` + provider + Preview
  lifecycle test failed before the correction and passed after it. Focused
  capture/provider/navigation verification passed **9 suites/46 tests**;
  canonical TypeScript passed; `git diff --check` passed; `.pyc` count was 0.
- Browser verification: local Expo web with the sanitized
  `assets/icon.png` fixture rendered Preview with `Selected spine photo`;
  Back returned to setup; reselect returned to Preview; Choose another image
  returned to setup; canceling the gallery picker left setup unchanged; and
  browser error logs were empty. Reaching Preview created one disposable
  session through the existing `start_session` path
  (`97925897-56dd-47dc-bf33-24ae4fdf2f10`), which remains open because the
  requested stop point was Preview. Upload was not pressed, so no upload,
  registration, processing, save, close, migration, Storage, inventory,
  listing, deployment, staging, commit, or push operation occurred.
- Limits and handoff: this is web evidence only; no native camera/gallery or
  physical-device behavior is claimed. The Unit 6F native gate remains
  `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`.

## 11. 2026-08-04 post-registration Preview flash correction

- Confirmed defect: after successful registration, Preview cleared
  `workflow.selected` before awaiting three query invalidations and routing to
  the server-progress screen. The genuine unavailable-media branch therefore
  rendered briefly during a successful handoff.
- Correction: the existing invalidation/navigation sequence remains, but the
  Preview marks a successful handoff before `router.replace(...)` and clears
  provider media only from the Preview unmount that follows the destination
  route. A generation/identity/authority guard after invalidation prevents a
  stale completion from replacing a route after Back or identity cleanup.
- Red/green evidence: the real provider/Expo Router test recorded a transient
  `/preview:empty` render with the old immediate-clear sequence and passes with
  destination navigation plus unmount cleanup. The mocked success, unmount,
  reselect, cancellation, and recovery tests also pass: focused capture
  verification **9 suites/48 tests**; TypeScript, `git diff --check`, and `.pyc`
  hygiene passed. Browser/native rerun for this post-registration fix remains
  unclaimed.
- Scope/mutations: no database, Storage, upload, registration, processing,
  migration, deployment, commit, push, or staging action occurred for this
  correction.

## 12. 2026-08-05 follow-up: Android 11 user report and browser runtime receipt

- User-reported device context: Android 11. The user reports that large-text
  use is accessible and that the native camera connects. This is recorded as a
  user observation only; no device model, font-scale setting, screen-by-screen
  receipt, or performance/offline trace was supplied.
- Code/permission trace: `CaptureScreens.tsx` checks camera or media-library
  permission, requests it when the OS allows another prompt, and exposes device
  settings guidance after permanent denial. `app.json` configures the camera
  and photo permission copy and blocks microphone permission. A prompt is not
  expected when the OS permission is already granted.
- Follow-up browser evidence: the authenticated development Owner read path,
  filters/search, review navigation, Resume scan, sanitized local fixture
  upload, disposable Review Save, logout/re-authentication, and unavailable
  session Retry were exercised with zero browser errors. The disposable upload
  session remained active with four inputs still processing, so Close was not
  available on that session. Cross-store and inactive/non-Owner denial cases
  were not run because separate approved fixtures were unavailable.
- Evidence classification: the large-text observation is user-confirmed but is
  not promoted to U6-AC33/U6-AC34/U6-AC36/U6-AC37/U6-AC39 native evidence.
  Camera/gallery/recovery, 15-card responsiveness, offline/reconnect,
  screen-reader/large-text, performance, and CAP/post-registration native
  reruns remain unclaimed under SDD §§24, 28, and 34.
- Verdict unchanged: `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`. This checkpoint
  does not close Unit 6F, change Unit 7 authorization, or authorize a merge.

## 13. 2026-08-05 15-card and Gemini fixture clarification

- Code tracing confirms that the image-inventory UI consumes decoded Owner
  candidate DTOs; it does not call Gemini directly. Gemini/provider
  configuration, deployment, and live-call verification remain separate
  deferred provider work.
- The Unit 6 fifteen-candidate requirement is therefore testable without a
  live Gemini response. `ownerUxTestFixtures.ts` supplies deterministic
  candidate DTOs; `CandidateReviewScreens.test.tsx` renders fifteen ordered
  candidates with an independent partial failure, and
  `CaptureProgressScreens.test.tsx` covers the over-fifteen safeguard. The
  candidate list uses `FlatList` virtualization and stable keys.
- Verification actually run:
  `npm.cmd test -- --runInBand src/features/imageInventory/__tests__/CandidateReviewScreens.test.tsx src/features/imageInventory/__tests__/CaptureProgressScreens.test.tsx`
  passed **2 suites/20 tests**. Existing React `act(...)` warnings were
  non-failing; no provider call or external mutation occurred.
- This closes the local fixture-backed UI/contract check only. It does not
  claim a live Gemini/provider result, a fifteen-card browser session, or
  native device responsiveness/memory performance.
- Remaining closeout items are representative Android Unit 6F evidence
  (camera/gallery permission and recovery, fifteen fixture-backed cards,
  three sequential captures, offline/reconnect, accessibility/large text,
  performance, and CAP/post-registration reruns) plus the separately deferred
  WU1/WU2 runtime cases requiring approved cross-store/inactive-Owner/runtime
  fixtures. Unit 7 remains gated.

## 14. 2026-08-06 Unit 6F checkpoint commit

- The coherent post-`a0d55b5` Unit 6F checkpoint was committed as
  `b564fbd` (`fix(phase9): record Unit 6F native runtime checkpoint`). It
  contains only the reviewed SDK54/native runtime remediation, AsyncStorage
  auth-storage boundary, `expo-crypto` capture identity correction, Preview
  lifecycle correction, and their focused tests. Later WU2 Owner-read changes,
  Store Owner route-warning work, and unrelated dirty-worktree changes were
  intentionally excluded.
- Verification after the checkpoint contents were prepared: the focused
  Unit 6F/native-remediation run passed **6 suites/38 tests**; TypeScript
  (`npx.cmd tsc --noEmit --allowImportingTsExtensions`) passed; the Phase 9
  continuity validator passed with **210 requirements**, zero duplicate
  definitions, zero missing traceability, **71** Markdown files checked and
  **55** required Phase 9 files; staged diff hygiene passed; `.pyc` count was
  **0**. The validator emitted only the existing non-blocking document-size
  advisories.
- No database, migration, Storage, provider, deployment, scheduler, secret,
  inventory, listing, publication, commerce, or disposable-data mutation was
  performed. The checkpoint does not close Unit 6F: the representative
  low-end Android evidence remains mandatory and outstanding, and Unit 7
  remains explicitly gated.
