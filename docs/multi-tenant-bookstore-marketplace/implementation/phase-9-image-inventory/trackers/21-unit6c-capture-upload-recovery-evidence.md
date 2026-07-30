# Phase 9 Unit 6C Capture, Upload, Progress, and Recovery Evidence

**Status:** `merged_on_main`
**Date:** 2026-07-31
**Implementation commit:** `b87469d`
**Authorized scope:** Unit 6C only

## Delivered scope

Unit 6C implements the Owner capture path traced to the Unit 6 SDD and contract
matrix acceptance criteria AC06, AC07, AC10-AC14, AC16, and AC28:

- authoritative Inventory Start/Resume discovery and a scan-scoped workflow
  provider;
- camera/gallery setup with all fixed defaults visible before the explicit
  Start action;
- local object validation, bounded media preparation, capability-scoped signed
  upload transport, progress, cancellation, and registration;
- explicit byte-transport versus registration state, including direct replay
  of an ambiguous registration command without uploading the bytes again;
- bounded retries that reuse an unexpired capability, obtain fresh authority
  after expiry or object replacement, and ignore late completion after
  cancellation or identity cleanup;
- session progress polling, loading/error/offline presentation, terminal
  handoff, route recovery, and privacy-safe cache/query identity;
- repeatable logout/user/store-transition cleanup for capture work and private
  query state.

The runtime boundaries are separated across `captureService`, `uploadTransport`,
capture state/identity/cancellation, `CaptureWorkflowContext`, capture/progress
screens, existing Owner-safe query adapters, guarded routes, and the Inventory
hub. `expo-image-picker` configuration is declared in `app.json`; native picker
behavior was not claimed from web verification.

## Red-first and verification receipt

The initial correction-complete Unit 6C and affected Unit 6B/auth command passed
111/111 tests. The user then authorized one narrow additional correction after
the product/technical closure found an ambiguous-registration replay defect.
The final focused correction/regression command passed 9 suites/56 tests:

- `CaptureScreens.test.tsx`
- `captureState.test.ts`
- `captureService.test.ts`
- `uploadTransport.test.ts`
- `captureCancellation.test.ts`
- `ownerUxQueries.test.ts`
- `inventoryIdentity.test.ts`
- `sessionCoordinator.test.ts`
- `logout.test.ts`

Repository TypeScript passed with
`tsc --noEmit --pretty false --allowImportingTsExtensions`. The exact Inventory
route test passed 1/1, Expo config resolution passed, and `git diff --check`
reported no errors. No lint script or ESLint configuration exists.

The registration tests prove:

- byte upload succeeds once before registration begins;
- one and repeated ambiguous registration failures replay the same registration
  command and idempotency key while byte-upload count remains one;
- failed byte transport retries bytes only while the capability remains valid;
- expired authority or changed local object receives fresh authorization and
  identity;
- cancellation and identity cleanup ignore late registration completion.

## Review and correction history

One authorized combined product/technical review and one narrow
security/privacy/cancellation review examined the original candidate. The one
authorized correction batch made identity cleanup subscriptions repeatable,
guarded picker completion against stale identity, fenced fetch/XHR cancellation
and the registration commit point, scoped keys per capability, kept signed
transport secrets adapter-local, completed recovery states, and exposed the
full fixed setup defaults before Start.

The sensitive-slice closure returned `CLOSED`. The product closure then reported
one new critical observation: an ambiguous registration result repeated the
byte upload. Work stopped until the user explicitly authorized one narrow
correction. That correction introduced explicit transport/registration states
and direct same-command registration replay. The permitted diff-only closure
returned `CLOSED`; no further blocker or high-severity finding remains.

## Bounded Expo web smoke

The local Expo web bundle compiled 2,216 modules. The in-app browser verified:

- `/inventory`;
- `/inventory/scan`;
- `/inventory/scan/setup`;
- `/inventory/scan/preview`;
- `/inventory/scan/progress`;
- malformed `/inventory/scan/not-a-real-session`;
- the supplied local phone/OTP login path.

Before and after login, the account had no Active Store Owner membership, so
every private route preserved authorization-first non-enumeration and displayed
no private scan data. The Owner-only Start/Resume, setup, preview, progress,
recovery, registration-retry, and identity-transition states therefore remain
covered by deterministic component/service tests rather than fabricated
browser claims. Native camera/gallery selection and real upload were not
exercised. Browser errors were zero. Repeated warnings were existing
framework/configuration warnings for web shadow/pointer styles,
`expo-notifications`, disabled development Sentry, and an unrelated missing
`orders` nested route; no Unit 6C-specific warning appeared.

The requested Luna-medium browser reviewer was not selectable in the available
agent runtime. The existing in-app browser mechanism was used directly, without
probing replacement reviewers. The temporary Expo server and logs were removed.

## External state, privacy, and scope

- Human spot check: `not_yet_selected_for_human_spot_check`.
- Database, Supabase, and Storage mutations: none.
- Migration creation/application: none.
- Backend/service/provider/deployment changes or live uploads: none.
- Unit 6D-6F, Unit 7, inventory commit, publication, and commerce behavior:
  not introduced.
- M29 remains immutable live history applied exactly once as
  `20260730162700 marketplace_phase9_owner_safe_contracts`.
- No secret, signed URL, bearer token, local file URI, or private scan payload
  is persisted in query keys, serialized workflow state, or logs.

## Handoff

Unit 6C is merged on `main` through evidence commit `092562d`. The exact next
eligible action is separate authorization for Phase 9 Unit 6D only. Units
6E-6F, Unit 7, migrations, Supabase/Storage writes,
deployment, and live backend verification remain separately gated.
