# Phase 9 Unit 4B: Gemini Vision Adapter Handoff

**Status:** `persistence_correction_ready_for_independent_review`
**Date/session:** 2026-07-27
**Branch/baseline:** `codex/phase9-unit4b-gemini-adapter` from
`510627d94f49eb6ed32c4c7e545488c269ffa98b`

## Authority and decision history

The founder authorized Unit 4B local implementation and narrowly superseded only
the initial primary vision model ID from `gemini-3.5-flash` to configuration-driven
`gemini-3.5-flash-lite`. P9-D54/P9-D60 remain historical; P9-D64 records the
supersession. The optional whole-image fallback seam remains unselected and
disabled.

## Completed scope

- Added the official `@google/genai` server dependency and a Gemini adapter behind
  the existing provider-neutral `SpineImageAnalyzer` interface.
- Mapped sanitized WebP/JPEG/PNG bytes to Gemini inline image input with no tools,
  one candidate, a bounded timeout, JSON response MIME, and a strict supported
  JSON Schema subset.
- Normalized provider JSON into unchanged `p9-vision-v2`; application-owned
  count/language/over-limit policy and downstream persistence remain unchanged.
- Classified timeout, rate limit, provider error, malformed response,
  schema-invalid output, and media-resolution failure into bounded existing worker
  safe codes.
- Preserved contract/schema/pipeline/prompt/adapter/provider/model lineage.
- Extracted bounded token usage and exposed injected, versioned cost-unit evidence.
  No provider pricing is embedded; absent or invalid policy calculation records
  null cost evidence.
- Added server-only fixture/Gemini configuration selection. Fixture mode remains
  the default compatibility path. Gemini mode requires a valid key, model ID, and
  timeout. No fallback configuration exists.
- Added a server-side resolver that verifies the opaque media reference against the
  current claimed job/media relationship before downloading private sanitized
  bytes. Storage paths never enter the analyzer request/result/log boundary.
- Restricted logs/errors to provider/model, bounded outcome/classification, and
  duration; credentials, authorization, image/base64, prompt, raw response,
  bibliographic content, Storage path, and provider detail are excluded.
- Added forward-only local M14 with a dedicated service-only
  `vision_provider_attempts` relation and five bounded RPC contracts. One row is
  registered before Gemini egress, records claim/reservation/provider/version
  identity, finalizes bounded token and injected pricing/cost evidence, links the
  accepted result, or remains explicitly stale, failed, or outcome-unknown.
- Replaced direct pre-download table lookups with an RPC-issued media
  authorization. After registration, claim-bound validation checks job/reference/
  correlation, owner/token/attempt/expiry, and store/session/input/sanitized-media
  purpose/status immediately before private download, then repeats the complete
  check immediately before Gemini `generateContent`.
  A rejected validation marks the registered attempt `stale_rejected`; it is not
  mislabeled as an unknown provider outcome because no external call occurred.

## Persistence and external state

The existing Unit 4 job, analysis result, observation, candidate, reservation, and
completion seams remain authoritative. Local M14 adds only provider-call attempt
lineage; it does not change `p9-vision-v2`, metadata, inventory, or publication.
Each provider-attempt UUID is unique. A separate deterministic logical spend
identity hashes the job/correlation/provider and adapter/model/prompt/schema
lineage, but not claim-attempt/lease/retry identity, so retries remain detectable
without collapsing actual calls. Claim attempt, worker, and lease-token hash remain
separate lineage. Reservation actual-cost reconciliation sums all finalized calls.
No provider pricing is hard-coded.

Pricing evidence uses the same positive allowlist in TypeScript and M14:
three-letter uppercase currency, bounded safe `input_basis` and version identifiers,
and exact numeric, finite, non-negative unit costs capped at 1,000,000. The object
is capped at seven known fields and 1,024 serialized bytes; unknown fields, URLs,
arbitrary strings, wrong JSON types, unsafe characters, and out-of-range values are
rejected.

M14 was created and tested locally but was not applied. No Gemini call, API-key
request/configuration, Supabase/database/Storage mutation, deployment, Render
change, scheduling, autoscaling,
metadata/alias work, mobile UI, inventory commit, publication, or Library work
occurred.

## Red-first and verification evidence

- Red checkpoint: focused tests failed because the Gemini adapter module and
  configuration path did not exist.
- Focused implementation checkpoint: Gemini/configuration/fixture suites passed
  3 suites / 27 tests.
- Strict vision-worker TypeScript build passed after correcting the official SDK
  structural client boundary.
- Final affected Unit 4 regression passed 8 suites / 89 tests.
- Strict vision-worker TypeScript build passed. Changed-scope compiler lint with
  `noUnusedLocals` and `noUnusedParameters` passed.
- Repository TypeScript passed with `--allowImportingTsExtensions`, matching the
  worker/shared Deno import contract. The unmodified root command alone reports
  the baseline `contracts/ingestion.ts` explicit `.ts` import because root
  `tsconfig.json` does not enable that setting.
- Continuity, diff hygiene, scoped secret scan, and final Git-state evidence are
  recorded at closeout.
- Correction red checkpoints failed on missing `analyzeClaim` and missing M14.
  Focused correction tests cover registration ordering, zero egress on a rejected
  claim, all claim/media bindings, durable usage/cost, duplicate spend,
  accepted-versus-stale completion, and interrupted/unknown outcomes.
- Final affected Unit 4/4B verification passed 11 Jest suites / 117 tests and
  three PGlite vision suites / 38 tests. Strict changed-scope TypeScript/lint,
  continuity, diff hygiene, and scoped secret scanning passed.
- Final four-finding correction verification passed 11 affected Jest suites /
  118 tests and the complete Phase 9 PGlite migration/RPC suite, 67/67 tests;
  the final expanded M14 pricing matrix also passed 10/10 focused tests.
  Strict vision-worker and repository TypeScript checks and executable
  deployment-runtime validation passed. Continuity/link validation, diff hygiene,
  and scoped secret scanning are the closeout gates.

## Independent-review focus

Review only the Unit 4B correction: M14 table/RPC/grant bounds, final egress claim
validation, accepted/stale/unknown attempt transitions, duplicate-spend
reconciliation, provider request/usage/cost lineage, opaque-media resolution,
error/retry mapping, configuration fail-closed behavior,
credential/log boundaries, official dependency footprint, and unchanged fixture
behavior. Do not configure or call Gemini, select a fallback, apply M14 or another
migration, deploy, schedule/autoscale, begin Unit 5, or change product/mobile
behavior.

## Next authorized action

One correction-only independent review of this Unit 4B branch. M14 application and
merge remain unauthorized.
