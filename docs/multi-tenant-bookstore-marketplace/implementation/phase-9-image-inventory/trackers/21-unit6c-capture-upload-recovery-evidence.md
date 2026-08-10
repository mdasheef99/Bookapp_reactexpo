# Phase 9 Unit 6C Capture, Upload, Progress, and Recovery Evidence

**Status:** `merged_on_main_with_2026_08_11_local_transport_correction`
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

## 2026-08-11 Android signed-upload transport correction

A read-only investigation of the failed mobile attempt proved capability and
signed-URL issuance succeeded, while repeated Android PUTs returned HTTP 400
before any Storage object or registered input existed. The local client used a
React Native `Blob` wrapped in `FormData` for the signed PUT. The narrow
red-first correction now reads the same selected URI as an `ArrayBuffer`,
retains the declared byte-length check, and sends those bytes directly with
`content-type`, `cache-control: max-age=0`, and `x-upsert: false`.

Verification actually run:

- red regression: the new raw-byte assertion failed because `arrayBuffer()` was
  never called by the old implementation;
- corrected transport suite: 2/2 passed;
- focused capture/upload suites: 4 suites, 26/26 passed;
- full Image Inventory Jest scope: 39 suites, 290/290 reported passing; the
  existing Jest open handle remained after completion and the idle runner was
  stopped;
- repository TypeScript: passed with no diagnostics.
- Phase 9 continuity validator: passed, including repository diff check; only
  existing document-size advisories and line-ending warnings were emitted.

The change does not alter signed capability issuance, upload progress,
cancellation, retry/registration semantics, backend behavior, or any Unit 7
boundary.

## 2026-08-11 authorized Android runtime investigation

The user separately authorized one bounded native upload proof and performed
the retry in Expo Go. Exact-project evidence recorded three short-lived upload
capabilities across the investigation and no registered input or stored object.
The corrected Android raw-byte transport reached Storage, but every observed
`okhttp/4.12.0` signed PUT returned HTTP 400. Capability issuance and Edge auth
succeeded before those PUTs, so the remaining primary defect is isolated to
the React Native-to-Storage request body/boundary rather than local file read,
authentication, capability issuance, registration, or downstream processing.

A later retry occurred after a development reload had cleared the in-memory
capability while the prior capability was still unexpired. The live database
correctly raised `P9_SINGLE_IMAGE_LIMIT`; deployed Edge version 3 surfaced that
known domain error as generic HTTP 500, producing the changed 0% message
`The request could not be completed.` This is a secondary live deployment
drift/error-mapping observation and did not exercise the Storage PUT.

External effects were limited to the authorized capability rows and rejected
requests. No object, input, job, inventory/listing/publication effect,
migration, deployment, provider call, staging, commit, or push occurred. The
temporary development-only console diagnostic was removed after correlation.

## 2026-08-11 native FileSystem transport replacement

The user authorized the smallest supported native transport correction after
the two XHR-backed Android bodies both reached Storage and returned HTTP 400.
The browser transport is restored to its previously proven Blob/FormData XHR
contract. Android and iOS no longer instantiate React Native XHR for signed
upload; they use Expo FileSystem `UploadTask` with the original local URI and
`BINARY_CONTENT`.

The native preflight rejects a missing/changed file before transmission. The
signed PUT carries the declared MIME, `cache-control: max-age=0`, and
`x-upsert: false`; progress comes from native bytes sent/expected; cancellation
calls the native task once; only 2xx permits registration continuation. Typed
non-2xx evidence retains platform, stage, status, MIME, expected byte size, and
an allowlisted/redacted bounded Storage message without retaining the signed
URL or token.

Verification actually run:

- red-first transport suite: 6/6 failed against the XHR implementation;
- corrected transport suite: 6/6 passed;
- focused capture/upload suites: 4 suites, 37/37 passed;
- repository TypeScript: passed with no diagnostics;
- final Image Inventory scope: 39 suites, 294/294 passed;
- the known Jest open handle remained after completed results and the idle
  runner was stopped; no open-handle audit was started.

At this local checkpoint no live Android proof, database/Storage/backend
mutation, migration, Edge or worker deployment, provider call,
inventory/listing/publication action, Git stage/commit/push, or Unit 7 work had
occurred. The then-pending Android gate was later passed as recorded below.

## 2026-08-11 user-supplied physical FileSystem proof and downstream handoff

The later physical Android run closed that pending transport gate. The native
signed PUT succeeded, exactly one Storage object was created, input
`a1c8e286-07f2-40c5-9bbd-2fed49c5148d` registered successfully, and media
sanitation completed. The worker then reached Gemini and vision job
`20734f70-dd4c-4f68-87d5-aa837cb32b7d` failed terminally with
`P9_VISION_SCHEMA_INVALID`. Provider evidence retained only configured model,
prompt/schema versions, normalized outcome, token count, and sanitized media
shape; no raw model payload was persisted or logged.

The Owner later removed the input. It remains `skipped/P9_OWNER_REMOVED` and is
not eligible for retry or revival. This evidence closes the native transport
blocker and moves the active correction downstream to the Gemini response
decoder. The prior browser path remains unchanged. Edge error-mapping drift,
deployment, another provider call, and Unit 7 remain separate gates.
