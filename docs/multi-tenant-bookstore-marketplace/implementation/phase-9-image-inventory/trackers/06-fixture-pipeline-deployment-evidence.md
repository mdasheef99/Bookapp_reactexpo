# Phase 9 Fixture-Pipeline Deployment Evidence

**Status:** `deployed_and_live_verified`
**Evidence date:** 2026-07-27
**Supabase project:** `ahntbtktjjmvfosgkmgn`
**Render runtime SHA:** `96991a99a8e24146db709653ebc287b8c2404430`
**Fixture tag:** `phase9-fixture-1785118826806`
**Fixture session:** `5533a082-5f11-4511-8cae-17b005c55d4f`

## Authorized scope

The bounded deployment unit covered the Owner-ingestion Edge Function, separate
media-sanitation and fixture-vision Render services, synthetic fixture-path
verification, the M13 PostgREST boundary correction, and documentation closeout.
It did not configure or call a real model or metadata provider, schedule a worker,
autoscale a service, enrich metadata, change mobile UI, commit inventory, publish
a listing, or implement Library behavior.

## Integrated corrections

- `3910268` made the deployment validator LF/CRLF-safe with focused coverage.
- `346c973` and `32f5572` corrected the committed Edge import-map/import-resolution
  path before the Owner deployment.
- `74f522b` added forward M13 with 13 minimum public `SECURITY INVOKER` wrappers.
- `96991a9` preserved the exact bounded Node request byte range. The new regression
  failed with HTTP 400 before the fix and passed afterward; both worker builds and
  repository TypeScript passed.

M13 uses no `SECURITY DEFINER` wrapper. Live proof showed `service_role` already had
schema usage and exact execute grants on the authoritative `marketplace_sec`
functions. Every public wrapper is owned by `postgres`, pins an empty
`search_path`, contains one fully qualified static delegated call, performs no
dynamic SQL or table access, revokes `PUBLIC`/`anon`/`authenticated`, and grants
execute only to `service_role`. The private schema remains unavailable through
PostgREST (`PGRST106`), and the post-DDL security advisor named none of the wrappers.

## Live deployment inventory

| Component | Non-secret live identity | Source |
| --- | --- | --- |
| Owner ingestion | `phase9-owner-ingestion`; Edge id `f8aec89f-ae2a-431a-8a97-5775a2405b90`; version 1; `ACTIVE`; JWT verification enabled | deployed from `32f557280fdf0a4c2a919e1f783c77ef8632caad` |
| Media sanitation | `phase9-media-sanitation`; `https://phase9-media-sanitation.onrender.com`; service `srv-d9jbmgf41pts73cecfl0`; deploy `dep-d9jcrit8nd3s73b6qsq0` | `96991a99a8e24146db709653ebc287b8c2404430` |
| Fixture vision | `phase9-fixture-vision`; `https://phase9-fixture-vision.onrender.com`; service `srv-d9jbsjf41pts73cejqag`; deploy `dep-d9jcs8vaqgkc73ba4p70` | `96991a99a8e24146db709653ebc287b8c2404430` |

Both Render services remain separate free-plan Docker web services in Singapore.
Their Docker context is `.`, Dockerfiles are the committed worker-specific files,
health path is `/health`, instance count is one, and automatic deploys/previews are
off. No build argument consumes a secret. Runtime binds the Render-provided port on
the allowlisted host. Fixture vision remains configured only for `one_book`.

## Runtime verification

For both Render services, the final deployment is `live` at the exact SHA,
the committed entrypoint emitted `service_started`, `/health` returned 200/alive,
`/ready` returned 200/ready, and unauthenticated `/run` returned 403. Readiness
claimed no job and changed no database or Storage count. Media startup loaded the
committed ImageMagick WASM before binding the service.

The corrected media `/run` claimed one job with `batchSize: 1`, persisted the
immutable source snapshot, sanitized to WebP, resolved the media job, and queued
vision. The deployed `one_book` vision `/run` then claimed job
`7de1e13b-bb83-42a2-a2d9-088726ac5d32` and persisted result
`e45ff41a-8d8b-41ef-b57b-35047c464cf1` as `accepted` with one observation and one
candidate. Provider/model evidence is `recorded_fixture`/`fixture_multimodal`.

Render logs expose only service/event/status, `batchSize`, aggregate claimed count,
allowlisted outcome, and duration. They expose no credential, authorization header,
payload, row/store/session/input identifier, Storage path, or private filesystem
path.

## Fixture evidence

The remaining cases ran in fresh bounded processes from the same final SHA. Each
process used the committed vision environment loader, composition, HTTP handler,
claim/context RPCs, lease fencing, persistence/failure path, `batchSize: 1`, and
the authorized live development project, then terminated. No extra Render service
or deployment was created and no M12 evidence row was inserted directly.

| Fixture case | Vision job | Persisted verification |
| --- | --- | --- |
| `repeated_books` | `49cb849d-1ebc-4270-bbe8-6aac075ce0a1` | resolved; detected 2; two candidate observations and two candidate rows preserved |
| `no_books` | `e08e2bf4-49d2-4fac-965a-7ab045720c50` | `resolved_noop`; `no_books`; zero observations/candidates |
| `over_15` | `1c81dbb2-5853-456b-a54f-fd0707a61854` | resolved; detected 16; `over_visible_book_limit`; zero observations/candidates |
| `mixed_language` | `7c0c2e98-a0c5-47ec-89e5-f317db92d7eb` | one candidate plus one language mismatch and one unknown-language observation |
| `all_language_mismatch` | `789dfc93-b3e3-4a61-88fb-c2c8048f0c5c` | `resolved_noop`; mismatch/unknown evidence retained; zero candidates |
| `identity_insufficient` | `b0c9ebfd-0f88-46f3-a345-31b28266a364` | one candidate plus one identity-insufficient observation retained |
| `retryable_failure` | `473a3e4e-f81d-4e70-8b00-92249e93a82f` | `P9_VISION_ANALYZER_TIMEOUT`; retry scheduled; no result/observation/candidate row |
| `schema_invalid` | `929ba030-9882-4183-9fed-7d20e05a7051` | resolved permanently with `P9_VISION_SCHEMA_INVALID`; no evidence/candidate row |

Owner completion replay returned the same input/job/state. Exactly one M12 result
exists per successful input/schema. The due retryable job was normally claimed for
fencing verification: wrong attempt and wrong lease token were denied, then the
correct claim was released only through `phase9_fail_vision_job`. Anonymous and
authenticated claim attempts returned 401 and 403. M13 wrapper invocation with
`service_role` succeeded, proving the invoker boundary is sufficient.

## Counts and retained deviations

Before the fixture run, commerce counts were five inventory rows, five listing rows,
and five published listings; fixture inputs/jobs/results/candidates and relevant
Storage objects were zero. After verification:

- commerce remains 5 inventory / 5 listings / 5 published listings;
- the tagged session contains 10 inputs, 19 jobs, 7 immutable analysis results,
  and 5 accepted candidate rows;
- tagged Storage contains 10 staging objects and 23 private snapshot/sanitized
  objects;
- there was no inventory, listing, publication, canonical-metadata, or public-media
  effect.

One early operator fixture reused identical pixels and therefore reached the normal
retry path when the existing `(store_id, sha256, orchestration_version)` uniqueness
constraint rejected duplicate sanitized input. It remains tagged as input
`c0de7a28-7e2a-4393-99af-eb51c83c02f1` / media job
`a44df58e-d28c-499f-90aa-202b4e4abbb2`; it was never converted into vision evidence.
A PowerShell interpolation mistake also caused one safe idempotency mismatch; the
database rejected it before a second capability/input effect. Both are retained,
not rewritten or directly repaired.

## Future implementation decisions

The future real vision model is Gemini 3.5 Flash with stable model id
`gemini-3.5-flash`. The initial future metadata provider is Google Books API.
Metadata-provider expansion remains deferred. These are handoff decisions only:
this work unit implemented, configured, and called neither provider.

## Closeout gate

The fixture deployment unit is complete. The local Codex
`SUPABASE_SERVICE_ROLE_KEY` can be removed after this closeout. The next work must
receive separate authorization; it must not infer authority for Gemini/Google Books
integration, scheduling, autoscaling, metadata enrichment, mobile UI, inventory
commit, publication, or Library work.
