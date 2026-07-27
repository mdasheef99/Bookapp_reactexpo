# Phase 9 Unit 4B: Gemini Vision Adapter Handoff

**Status:** `implemented_locally_needs_independent_review`
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

## Persistence and external state

The existing Unit 4 job, analysis result, observation, candidate, and lineage
persistence seams are reused unchanged. Existing `phase9_usage_reservations`
remains the cost reservation boundary; Unit 4B adds adapter-level normalized usage
and injected cost evidence without a table, migration, RPC, or hard-coded price.

No Gemini call, API-key request/configuration, Supabase/database/Storage mutation,
migration creation/application, deployment, Render change, scheduling, autoscaling,
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

## Independent-review focus

Review only Unit 4B: provider request/schema compatibility, opaque-media resolution,
error/retry mapping, usage/cost evidence, configuration fail-closed behavior,
credential/log boundaries, official dependency footprint, and unchanged fixture
behavior. Do not configure or call Gemini, select a fallback, create/apply a
migration, deploy, schedule/autoscale, begin Unit 5, or change product/mobile
behavior.

## Next authorized action

One independent review of this Unit 4B branch only. No merge is authorized by this
handoff.
