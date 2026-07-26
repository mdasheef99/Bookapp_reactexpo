# Phase 9 Unit 4A Deployment-Runtime Scaffolding Evidence

**Status:** `integrated_local_and_cloud_verified`
**Date/session:** 2026-07-26
**Branch/baseline:** `codex/phase9-deployment-runtime-scaffolding` from `e9ba2d9be93e54c43e6b55a86eb5a168fe30b5ed`

**Current supersession (2026-07-27):** this file preserves Unit 4A's historical scaffolding evidence. M11/M12 were subsequently applied and live-verified; all three services remain undeployed. Current application evidence is in [05-m11-m12-live-application-evidence.md](./05-m11-m12-live-application-evidence.md).

## Authorized scope

Implement local-only SDD and red-first deployment scaffolding for the existing Owner ingestion boundary, sanitation worker, and fixture vision worker. M11/M12 application, deployment, secret configuration, Supabase/Storage mutation, real multimodal or metadata providers, lifecycle/scheduler work, Library UI work, and Git staging/integration remained prohibited.

## Completed

- Added provider-neutral executable Node HTTP services with non-mutating `/health`, local-only `/ready`, authenticated worker `/run`, a 16 KiB body ceiling, concurrency fixed at one, graceful shutdown, and bounded structured events.
- Added strict positive-allowlist environment loaders. Required values are validated without logging them, worker ingress tokens must be strong and distinct from the service-role key, and the peer worker token is supplied only as a SHA-256 fingerprint.
- Added deployment fixture selection for `one_book`, `repeated_books`, `no_books`, `over_15`, `mixed_language`, `all_language_mismatch`, `identity_insufficient`, `schema_invalid`, and `retryable_failure`. Selection is process configuration only; request/tenant/path input cannot select a fixture, and request identity is rebound from authoritative runtime context.
- Added strict per-worker TypeScript builds and pinned Node 22.13.0 multi-stage containers. The media image copies the pinned ImageMagick WASM into its runtime image.
- Added a bounded manual invoker with an explicit abort timeout and sanitized output.
- Added the local Owner Edge Function declaration with JWT verification enabled and a deterministic static deployment validator.
- Added no provider credentials, provider imports, metadata boundary, inventory/publication mutation, lifecycle/scheduler service, or Library UI change.

## Independent-review corrections

- Replaced broad Docker context copying with a deny-by-default `.dockerignore` and narrow worker/shared-module copies. The context excludes `.env*`, Git data, host dependencies, generated output, local agent state, keys, and secret-shaped files.
- Moved constant-time bearer admission ahead of body reading and slot acquisition while retaining handler authentication. Added a fixed 10-second production read deadline and bounded test override.
- Replaced sleep-based shutdown evidence with explicit handler-entry/release synchronization and response-delivery assertion.
- Replaced static-only deployment claims with strict builds plus real compiled-entrypoint health/readiness/authentication smoke. Added a minimal-permission GitHub Actions container gate that uses synthetic configuration, builds and starts both images, checks media WASM, and pushes no image.
- Replaced identity-only fixture iteration with a per-case semantic matrix and added bounded manual-invoker response streaming.

## Verification actually run

- Red checkpoint: the focused deployment suite failed because the runtime modules and artifacts did not yet exist.
- Focused deployment scaffolding: 18/18 tests passed.
- Relevant ingestion/vision worker verification: 10 suites/97 tests passed.
- Explicit Phase 9 Jest verification: 17 suites/150 tests passed.
- Phase 9 PGlite database verification: 57/57 passed.
- Repository `npx.cmd tsc --noEmit`: passed.
- `npm run build:phase9:media-worker`: passed.
- `npm run build:phase9:vision-worker`: passed.
- `npm run validate:phase9:deployment-runtime`: passed.

Correction-focused verification passed two suites/21 tests. The corrected executable
validator builds both workers and starts both compiled entrypoints successfully.

## Correction final local gate

- Complete explicit Phase 9 Jest: 14 suites/131 tests passed, including the focused correction and existing media/vision boundaries.
- Phase 9 PGlite: 57/57 passed.
- Repository TypeScript: passed.
- Strict sanitation-worker and vision-worker builds: passed.
- Executable deployment validator: passed both strict rebuilds and both real compiled-entrypoint health/readiness/authentication smokes.
- Continuity: 37 Markdown files/31 required files passed.
- `git diff --check`, generated-artifact scan, `.pyc` zero check, Docker/private-context exclusions, and scoped credential-pattern scan passed.
- GitHub repository access was connected with admin/push permission and Actions run/job/step/log inspection.
- GitHub Actions workflow `Phase 9 worker container smoke`, run `30213789057`, job `89824341371`, passed on pushed candidate `1d39bc887202662c66386b0488c1dfdfe2498646`.
- The workflow used only `contents: read`, generated synthetic configuration, and no repository secrets. Both Linux images built and started, strict TypeScript builds passed inside the images, the sanitation image contained `/app/runtime/magick.wasm`, health/readiness/unauthorized probes passed, and no image was pushed.

## Environment and privacy evidence

The exact environment contract and secret classification are recorded in [the Unit 4A SDD](../work-units/04a-deployment-runtime-scaffolding-sdd.md). Health/readiness do not invoke worker RPCs. Runtime and invoker output is limited to service/status/category/timing and aggregate claim/outcome counts; it excludes row IDs, store/session/input/media identifiers, Storage paths, tokens, request bodies, raw RPC errors, SQL detail, and fixture observations.

Fixture-mode evidence is retained canonical evidence written through the same M12 path; it is not disposable seed data and cannot bypass the migration. Live cleanup and retention enforcement belong to the deferred lifecycle unit.

## External state and limitations

During Unit 4A, no migration was applied, service deployed, secret configured, provider called, or Supabase/Storage state mutated. M11/M12 were then committed but unapplied, and all three services were undeployed. Hosting selection, representative-camera resource validation, live health/readiness/log validation, ingress scheduling, lifecycle cleanup, and real provider integration remain later separately authorized gates.

## Historical next authorized action

At Unit 4A closeout there was no further authority within that unit; the recorded next gate was separate authorization for live preflight, migration application, deployment, or later work. That historical gate prohibited migrations, deployment, secrets, Supabase/Storage mutation, provider calls, Library UI changes, and another work unit.
