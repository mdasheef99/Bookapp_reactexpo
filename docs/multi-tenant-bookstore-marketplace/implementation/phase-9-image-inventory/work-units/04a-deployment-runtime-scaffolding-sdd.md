# Work Unit 4A: Deployment-Runtime Scaffolding

**Status:** `integrated_local_and_cloud_verified`
**Date:** 2026-07-26
**Authority:** local SDD+TDD scaffolding only; no migration application, deployment,
secret configuration, Supabase/Storage mutation, provider call, scheduler, lifecycle
worker, Git publication, or Library-branch change
**Depends on:** committed Unit 3 ingestion runtime/M11 and Unit 4 fixture vision
runtime/M12 at repository checkpoint `e9ba2d9`

**Current deployment state (2026-07-27):** M11/M12 are live-verified; Owner ingestion,
sanitation worker, and fixture vision worker remain undeployed. No service secret or
real multimodal/metadata provider credential is configured.

## 1. Trace and scope

This work unit makes the existing dedicated sanitation and fixture-vision handlers
executable without changing their job, media, analysis, candidate, or database
behavior. It traces to master SDD MAS-01/02/05/09/10 and MAS-AC11, extraction SDD
EXT-02 through EXT-10 and EXT-19 through EXT-25, media SDD MED-06 through MED-10
and MED-17 through MED-24, and Unit 4 §§5, 8, 9, and 10.

Included:

- provider-neutral Node HTTP servers and deterministic builds;
- strict environment loaders;
- health/readiness, one-request concurrency, bounded bodies, and shutdown;
- privacy-allowlisted operational logs;
- request-bound deployment fixtures;
- an authenticated manual invoker;
- Owner Edge Function local deployment configuration;
- retained-fixture evidence policy and deployment validation.

Excluded:

- M11/M12 application or any live deployment/configuration;
- real vision or metadata adapters and their credentials;
- automatic scheduling, lifecycle deletion, and staging cleanup;
- inventory, listing, publication, mobile, or Library UI behavior.

## 2. Runtime architecture

Both services expose:

- `GET /health`: process-liveness only, always non-mutating;
- `GET /ready`: validates only completed startup composition and local dependency
availability; it never calls an RPC, claims a job, reads tenant data, or accesses
Storage;
- `POST /run`: existing bearer-authenticated worker handler;
- every other route: bounded `404`.

The shared runtime reads at most 16,384 request bytes and permits exactly one active
processing request per instance. Constant-time bearer admission occurs before body
reading and before the processing slot is acquired; the existing handler repeats
authentication as defence in depth. An authenticated concurrent request returns
`409 worker_busy`. An authenticated body must complete within the fixed 10-second
read deadline. The request body cannot select the database lease owner; the
configured stable worker ID remains authoritative.

`SIGINT` and `SIGTERM` stop acceptance, wait for the active request, close idle
connections, and then finish. Health does not imply readiness. Readiness does not
imply database or Storage health.

## 3. Exact startup environment

Unknown `PHASE9_*` or `SUPABASE_*` names fail startup. Host platform variables
outside those namespaces are ignored.

| Name | Services | Secret | Rule |
| --- | --- | --- | --- |
| `SUPABASE_URL` | both | no | exact HTTPS project origin |
| `SUPABASE_SERVICE_ROLE_KEY` | both | yes | server secret store only |
| `PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256` | both | no; integrity-sensitive | lowercase SHA-256 of the other worker token; must differ from the current token hash |
| `PHASE9_WORKER_HOST` | both | no | explicit hostname/address |
| `PHASE9_WORKER_PORT` | both | no | integer `1..65535` |
| `PHASE9_WORKER_CONCURRENCY` | both | no | literal `1` in this work unit |
| `PHASE9_MEDIA_WORKER_ID` | sanitation | no | stable 16–128 allowlisted characters |
| `PHASE9_MEDIA_WORKER_INGRESS_TOKEN` | sanitation | yes | 32–256 strong characters; distinct from service role and peer |
| `PHASE9_MEDIA_WORKER_MAGICK_WASM_PATH` | sanitation | no | readable pinned WASM file |
| `PHASE9_VISION_WORKER_ID` | vision | no | stable 16–128 allowlisted characters |
| `PHASE9_VISION_WORKER_INGRESS_TOKEN` | vision | yes | 32–256 strong characters; distinct from service role and peer |
| `PHASE9_VISION_FIXTURE_CASE` | vision | no | one exact case from §6 |

The peer fingerprint proves cross-worker secret distinctness without placing the
other worker's raw secret on the host. No Gemini, OpenAI, Google Books, Open
Library, or other provider variable exists.

Manual invocation additionally reads:

| Name | Secret | Rule |
| --- | --- | --- |
| `PHASE9_MEDIA_WORKER_URL` | no | media service base URL |
| `PHASE9_VISION_WORKER_URL` | no | vision service base URL |
| the selected worker ingress token above | yes | sent only as bearer authorization |
| `PHASE9_WORKER_BATCH_SIZE` | no | optional `1..10`, default `1` |
| `PHASE9_WORKER_INVOKE_TIMEOUT_MS` | no | optional `100..300000`, default `30000` |

## 4. Builds and start commands

The root lockfile and `npm ci` own deterministic dependency installation.

Sanitation:

```text
npm run build:phase9:media-worker
npm run start:phase9:media-worker
```

Vision:

```text
npm run build:phase9:vision-worker
npm run start:phase9:vision-worker
```

Provider-neutral Dockerfiles use Node `22.13.0-bookworm-slim`, `npm ci`, the same
TypeScript builds, and runtime-only dependencies. The sanitation image copies
`@imagemagick/magick-wasm/dist/magick.wasm` to `/app/runtime/magick.wasm`.
A deny-by-default root `.dockerignore` excludes `.env*`, Git data, host
`node_modules`, build output, local agent state, keys, and secret-shaped files.
Dockerfiles copy only package manifests, the selected worker/shared runtime, and
the shared image-inventory modules. A minimal-permission GitHub Actions pull-request
gate builds and starts both images using generated synthetic configuration, checks
health/readiness/authentication and the media WASM, and never logs into or pushes to
a registry. No hosting provider, region, replica count, ingress product, or live
secret is selected here.

## 5. Safe operational logging

Allowed fields are event name, service name, HTTP/readiness status, requested batch
size, claimed count, closed outcome category, duration, and denial category.
Allowed events are service start/stop, readiness, invocation accepted/denied, and
invocation completed.

Logs never inspect or emit:

- service-role or ingress tokens, authorization headers, signed URLs, or capabilities;
- bucket/object/Storage paths, raw image bytes, EXIF/GPS, or base64;
- job/store/session/input IDs;
- title, author, publisher, ISBN, or arbitrary fixture observations;
- fixture payloads, prompts, raw provider output, or raw RPC/database errors.

## 6. Deployment fixture registry

`PHASE9_VISION_FIXTURE_CASE` selects one process-wide allowlisted case:

`one_book`, `repeated_books`, `no_books`, `over_15`, `mixed_language`,
`all_language_mismatch`, `identity_insufficient`, `schema_invalid`, or
`retryable_failure`.

Tenant data, media references, Storage paths, and request bodies cannot select a
case. For each claim, the analyzer binds job reference, correlation ID, attempt,
sanitized-media reference, expected language, and all version identity from the
authoritative request. Only bounded synthetic observation content comes from the
selected template. Schema-invalid and retryable cases produce the existing stable
schema and timeout errors.

## 7. Manual invocation

`npm run invoke:phase9:worker -- media` or `-- vision` calls only `/run`, uses the
matching worker token, defaults to a one-job batch, enforces an abort timeout, and
prints only service, HTTP status, claimed count, and closed outcomes. It is an
operator-invoked local/admin utility, not a scheduler.

## 8. Owner Edge Function

`supabase/config.toml` contains an enabled `phase9-owner-ingestion` stanza with
`verify_jwt=true` and the existing entrypoint. This is local deploy configuration;
the function remains undeployed.

## 9. Fixture evidence and lifecycle

Initial live-smoke analysis evidence is retained, canonical, and clearly tagged as
fixture evidence. It is not disposable and must not be described as cleaned up.
M12 immutability is never bypassed. Staging-object cleanup, full lifecycle cleanup,
automatic scheduling, retention expiry, and deletion evidence remain later
authorized work units.

## 10. Acceptance and stop gates

Executable tests must prove malformed/missing environment rejection, secret
separation, non-mutating health/readiness, bearer denial, body/concurrency bounds,
pre-authentication slot protection, read deadlines, deterministic graceful
shutdown, log privacy, dynamic fixture identity, distinct semantics for every
allowed fixture, invalid selection denial, invoker timeout/response
bounding/sanitization, actual built entrypoints, actual container build/start,
deterministic start artifacts, deployment validation, and Owner JWT configuration.

Stop before live application when any verification fails, a provider credential or
automatic scheduler appears, M11/M12 or Supabase/Storage changes, evidence cleanup
is claimed, or the Library branch changes.
