## 2026-10-11 - M72 applied; backend activation preflight

Phase 9 / Unit 6G remains feature_published_runtime_pending. Under the Owner's current step-by-step backend authorization, M72 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as live version 20261010200655. Its archived SQL equals the reviewed file and its original SHA-256 is preserved. M65-M71 source bytes and existing Phase 9 function definitions/ACLs are unchanged.

Rollout order is M72, compatible Render metadata worker, then the Owner Edge API. The old worker's claim RPC has no edition-operation filter and its decoder cannot handle edition_options contexts, so the new API must not enqueue those jobs until the new worker is healthy. No edition jobs exist at this checkpoint. Owner API remains ACTIVE v14; metadata runtime remains bb91428048ca9028c5592cbbc52c982bd6843946. The Owner's explicit stop before Render deployment remains in force.

A fresh ordinary Deno check exposed extensionless imports newly reached by the API. The bounded local correction adds seven .ts suffixes in contracts/metadata.ts and contracts/providerReuse.ts, naming the same existing targets without changing metadata, ranking, cover, authorization or retention behavior. Fresh verification passed Deno check --no-lock, two existing Jest suites / 49 tests, worker build plus 14 structural tests, and whole TypeScript. Correction review/publication is pending; earlier feature approval and successful CI remain separate evidence.

Exact next action: complete the requested read-only GPT-6 Luna/max correction review and publish only if approved, then report the prepared deployment checkpoint for the Owner's Render decision. Provider-result retention remains disabled without verified permission; registry flags and cache headers are not authorization. No Edge or Render runtime deployment, provider request, inventory/Auth/Storage/configuration/billing change occurred. [Exact application, rollout, artifacts and verification evidence](trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records below are historical.

# SDD 02: Extraction and Metadata Enrichment Pipeline

## 2026-10-11 - Bounded superseded explicit-job terminal correction

Pipeline §10, picker §§4.3/5/9 and MAS-17 require the old request to end durably without publishing stale results. Review of 905b1f9 found that catch-only cleanup missed normally returned stale results. The corrected worker now uses the same claim-fenced service-only terminalizer on both paths. A current request or unavailable cleanup keeps prior stale/failure handling; unrelated automatic jobs retain the generic failure path. No provider call, automatic ranking/cache or physical accounting change is introduced.

M72 is Owner-authorized CREATED_LOCAL / NOT_APPLIED with its original hash; M65–M71 are immutable/applied. Eleven runnable-worker cases pass within six suites / 124 tests; eight M72 disposable cases pass within the 104-case neighboring SQL gate. Whole TypeScript and build/14 structural checks pass. The new real-worker regression proves fifth-attempt returned-stale cleanup with one recorded provider request and no saved stale options. GPT-6 Luna/max independently APPROVED the correction and aggregate; reviewed source de97beda6e4253cdb14369bf29bb6c6ff3429a24 is published to main and codex/edition-picker. [Tracker 36](trackers/36-owner-edition-picker-publication-deployment.md) records RED/GREEN and publication provenance. Deploy this worker correction only after M72 live application/readback and compatible-runtime preflight; Render rollout is on the Owner's hold.

## 2026-10-09 - Task 8 independent approval and M65-M70 applied

Phase 9 / completed Unit 6G baseline. Task 8's bounded LOCAL checkpoint is
independently APPROVED; all eight tasks have local implementation/verification
evidence. [Review provenance](trackers/33-owner-edition-picker-task8-local-verification.md)
preserves earlier approval provenance and the unavailable historical 152-path
audit baseline.

**Status:** `task8_independently_approved_m65_m70_applied_runtime_pending`.
The Owner authorized steps 1-3: approval documentation, live preflight and the
six unchanged migrations. All M65-M70 are now APPLIED / catalog-verified on
Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn. [Application ledger](trackers/34-owner-edition-picker-m65-m70-application.md)
records six live versions, exact source/archive hashes, function/ACL/RLS/index/
trigger readback, unchanged business counts, recovery and advisor deltas.

No Edge/worker/client deployment, registry/configuration change, provider call,
browser test, data deletion, staging, commit or push occurred. New alternatives
retention remains disabled/unverified; existing automatic provider flags remain
unchanged. Runtime/provider/browser/operational rollout gates stay pending.

Exact next action: Owner review/authorization for compatible development
Edge/worker/client rollout and provider-gated browser verification (step 4).
Earlier dated entries below retain their historical NOT_APPLIED status and
review provenance; this latest entry owns current application status.

## 2026-10-08 - Edition-picker Task 5 local completion

Picker §§7-8 reuses marketplace_sec.dispatch_phase9_worker_wakes and its existing active minute cron command. M69 delegates ordinary worker dispatch to the unchanged prior function and first clears at most 50 due card sets (private testable limit 1..100), with candidate locks and SKIP LOCKED. A single private due predicate covers option/candidate/session expiry, removal/false-detection, commit, query invalidation and provider eligibility loss. Cleared/remaining/failed report the actual due backlog. A failed batch rolls back in a subtransaction, retains payloads, reports failure and is retried on the next ordinary tick.

No new service/job kind/cron installation or provider call is added. Successful Add clears its own alternatives in the inventory transaction and fences later completion via existing candidate/request authority. Original fetch/provider deadlines, chosen snapshots and selling fields are retained independently; old receipts expose no alternatives. [Task 5 evidence](trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-5-local-completion) records scheduler injection/retry and existing completion/worker regressions. Only local M69 is created; M65-M68 bytes are unchanged and M65-M69 are NOT_APPLIED. Real concurrent connections and live scheduling/enablement remain later gates.

## 2026-10-08 - Task 4 completion contract and replay corrections

Picker §§4.1-4.3/5/9 and Master MAS-02/17 govern the three reproduced Task 4 review defects. SQL now accepts the same compatible exact-ISBN/und case as the shared adapter and independently validates every non-null normalized option. The concrete completion RPC forwards only P9_EDITION_ROWS_INVALID as a safe deterministic rejection. After trying committed-receipt recovery, the worker treats it as nonretryable schema_invalid; unknown transport/persistence failures retain existing retry behavior. One physical response remains one accounted request.

Failure transitions now atomically persist a bounded private claim receipt; identical retries after response loss return the existing result without new backoff, timestamps, provider calls or candidate changes. Current request/generation/query, Owner/session/card and worker/hashed-token/attempt remain mandatory; reclaimed claims and different failure arguments reject. Failure receipts cannot authorize successful options completion. Scheduling remains fifteen jobs/three active/immediate refill; automatic winner/cache behavior is preserved. Fresh 264 Jest, 77 completion/worker SQL, 14 structural and 48 existing picker cases plus strict types/build pass. [Detailed proof](trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-4-review-corrections). M65-M68 remain NOT_APPLIED, production retention remains disabled, correction review is pending and Tasks 5-8 remain unstarted. Earlier checkpoints are historical.
## 2026-10-07 - Edition-picker Task 4 local completion

Under picker §§4.1-4.3/5/8-9 and Master MAS-02/03/12/17, the explicitly requested edition_options worker now completes through local M68 and its typed service RPC port. The fifteen-job/three-active pool and automatic winner/cache behavior remain intact. Bounded private own-card results are atomically persisted before readiness; slim replay/recovery avoids another provider request after committed response loss. Selection, selling details and existing authority versions are preserved. Production installs no retention verifier.

Task 4 is task4_locally_verified_pending_review; Tasks 5-8 remain unstarted. Fresh proof: 259 Jest tests, strict graph/bootstrap types, required build/14 structural DB cases and 40 completion/worker DB cases PASS. M65-M67 hashes are unchanged; M65-M68 remain NOT_APPLIED. Independent review returned no verdict at the usage limit. Next action is Task 4 review; no live mutation or Git publication occurred. Earlier checkpoints are historical.

[Detailed Task 4 evidence](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-4-local-completion) records scope, commands and limits.

## 2026-10-07 - Edition-picker Task 4 runtime checkpoint

Local runtime/test scope is implemented; durable Task 4 completion remains incomplete pending separately authorized forward SQL. The worker now decodes the existing v2 automatic/edition_options context, routes explicit Google options jobs around local/cache/coalesced winner-only shortcuts, validates the bounded Task 3 response, preserves physical-call accounting, and reports available only after the typed controlled completion port confirms it. Production installs neither that port nor a retention verifier; explicit requests are not enabled.

Fresh evidence: Task 4 worker/recovery plus affected worker/gateway/composition and provider/automatic regressions pass 9 suites / 237 tests; strict types pass; the required structural metadata worker build and 14 disposable database cases pass. Tests use recorded responses and an in-memory port model; these results do not establish durable SQL, grants/RLS, real races or live permission.

Read [Task 4 implementation evidence](./trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-4-runtime-checkpoint) and the [reviewable SQL proposal](./work-units/owner-edition-picker-task4-sql-proposal.md). The fresh read-only Supabase check verifies live M62, with no controlled options completion/failure operations. M65-M67 remain local and NOT_APPLIED. Next action is separate Owner authorization of one forward local migration and disposable SQL tests. Tasks 5-8 remain unstarted; no migration file was created/edited/applied and no live/external mutation or Git publication occurred.


## 2026-10-07 - Edition-picker Task 3 review corrections

This correction restores picker §4.1 / DOC-3 §5.1 and this SDD §§8–9/13–14. Count every safely decoded row with the observed ISBN before eligibility filtering. Strong ISBN certainty requires one material identity and eligibility of all such rows. A disabled conflicting title/author/language sibling downgrades the compatible row to confirmation-required evidence and the adapter to ambiguous_match. Identical duplicate records remain separate options and can retain strong evidence; unrelated ISBNs do not weaken it. Structured-volume authority continues to derive only from strong evidence. No adapter, automatic winner/cache, worker or persistence behavior is added.

Retention restores picker §8 / Security §8: Date/Age are validated when either max-age or Expires supplies a lifetime. Without max-age, Expires-minus-Date is reduced by observed age; missing Date uses receipt time conservatively, and invalid/exhausted evidence denies retention. With max-age present, its age-adjusted lifetime remains authoritative and Expires keeps its absolute ceiling. All deadlines remain bounded by independently verified permission and original fetch + 24 hours. Headers never grant rights; production installs no verifier.

The supplied Task 3 review remains CHANGES_REQUIRED pending independent correction review. New regressions first produced 9 failures / 6 passing controls; the final four-suite command passed 136/136, with strict types and worker build PASS. M65–M67 remain unchanged/NOT_APPLIED; Task 4 remains pending separate Owner authorization. [Correction evidence](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-review-corrections) supersedes the earlier unqualified lifetime summary; earlier checkpoints remain historical.

## 2026-10-07 - Edition-picker Task 3 provider contract

Picker §§3/4.1/5/13.2 now has a local explicit-operation adapter result using the existing StoredEditionRow and OptionsRetentionEvidence. A shared request path preserves Google configuration, credentials, relevance parameters, response bounds, timeout/cancellation and normalized failures. The explicit decoder receives original items before automatic filtering and preserves duplicate IDs/ordinals, unavailable positions and safe-but-ineligible records. It uses the existing per-item decoder with the shared twenty-author schema bound; the automatic default and winner/ranker/cache remain unchanged. BOOK printType supplies no binding/edition number, and each row owns its own safe metadata/cover/link.

Eligibility uses the existing normalized ISBN/title/all-supplied-authors/primary-language rules. Internal ISBN contradiction becomes unavailable; conflicting text/identity remains disabled; different valid ISBNs may be alternatives. A coherent exact-ISBN record can supply structured-volume conflict evidence. Query publisher/year/free-text clues never manufacture volume authority. Text-only and conflicting same-ISBN records require confirmation; response order/date cannot promote their certainty. This result never selects or persists an Owner choice.

The server verifier sees only fetchedAt and allowlisted Cache-Control/Expires/Date/Age evidence. Without independently verified provider permission/deadline, retention is denied. Actual headers can only shorten that deadline, bounded by original server UTC fetch + 24 hours; cache prohibitions and malformed/stale lifetimes deny storage. No verifier is installed in production. [Actual proof](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-local-completion): 98 required Jest cases, 23 provider-contract cases, strict types/build PASS. Task 4 completion/persistence/accounting remains unimplemented and separately authorized. No migration or provider call occurred; earlier checkpoints are historical.

## 2026-10-07 - Edition-picker Task 2 review corrections

The Owner-authorized corrections restore picker §4.1 / DOC-3 §5.1 / DOC-4 §8: local reuse validates the complete Owner-safe metadata, a unique coherent exact text match remains a medium suggestion requiring confirmation, and ambiguous matches remain unresolved. M65/M67 are revised locally only; M65–M67 are NOT_APPLIED. The existing gateway, jobs, private-state permissions, selling fields and Add fence remain in force. No product scope or new migration was added.

Current authority, corrected handoff and verification are recorded in [the implementation evidence](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections) and DOC-13/TRACKER. Earlier checkpoints are historical.

## 2026-10-07 - Edition-picker Task 2 local completion

Task 2 is locally complete: private per-card state, controlled read/search/select, version/expiry/ownership guards, coherent local ISBN resolution, lookup-scoped attempt history, and explicit-operation admission. Task 1 remains complete. The Owner's “ok proceed” authorized local M65–M67 creation and disposable tests; these files exist locally and are NOT_APPLIED. No live database/Storage write, deployment, staging, commit, or push occurred.

Fresh proof: 34 disposable-database tests PASS; 4 affected Owner Jest suites / 303 tests PASS; strict Owner ingestion graph type check PASS. Real independent-connection races, provider-retention permission, worker execution/completion, Add/cleanup integration, client/UI/browser and rollout proof remain Tasks 3–8. No full-feature acceptance is claimed.

Current work unit: Task 2 checkpoint review. Exact next authorized action: review the Task 2 diff/evidence; the next implementation slice is Task 3 Google result envelope after Owner authorization. Sources: picker SDD §§4.3/5–6/8–9/11; Master MAS-02/03/07/12/17. Earlier dated checkpoints below are historical.

Task 2 fixed p9-owner-edition-options-v1 job purpose admits eligible unfinished cards through existing service claims without resetting them to processing. It excludes explicit lookup rows from automatic review-revision invalidation and uses lookup-scoped logical attempt uniqueness while preserving provider identity/role and legacy history. Automatic winner-only cache/snapshot payloads and invocation budget fifteen/three active stay unchanged. Google decoding, egress/accounting and fenced bounded completion remain Tasks 3/4; this checkpoint adds no automatic alternatives or worker execution path.


## 2026-10-07 - Edition-picker Task 2 gateway/preflight checkpoint

Task 1 remains locally complete. Task 2 code/read-only preflight is now authorized: the strict authenticated Owner gateway and HTTP routing pass 303 affected Jest tests and a strict server type check. Database storage/commands are not implemented; local M65–M67 migration-file creation is awaiting the separate Owner approval required by AGENTS. No SQL/database/Storage/deployment/Git publication occurred. Tasks 3–8 remain pending. Current authority/status comes from DOC-13 and TRACKER; earlier checkpoints below are historical.

## 2026-10-07 - Edition-picker Task 1 contract checkpoint

The Owner authorized Task 1 on 2026-10-07. Contracts/fixtures and narrow compatibility are locally complete; Tasks 2–8 and database changes remain unstarted/unapproved. Source behavior remains picker SDD §§5–7/9/13.2. Current next action is Task 1 diff review; [implementation evidence](trackers/02-implementation-and-verification.md) supersedes earlier planning-only status below.


## 2026-10-06 - Owner edition picker draft extension

Latest Owner display clarification EP-D14: each edition option in the metadata sheet shows its own cover image from its safe URL, title, all authors, and publication date; publisher, ISBN, and language are secondary details. Selection saves the coherent chosen metadata independently and follows the usual inventory Add flow, leaving one chosen cover on the scan card. This supersedes earlier text-only option rows. Owner chose relevance order with returned order preserved and Google attribution/book links. Picker §13.2 now defines Search Books wording and bounded unavailable/ineligible rows; EP-D11/13 scope cuts remain in force.

Latest Owner scope: alternatives are obtained and saved only after an explicit Owner lookup (EP-D13); automatic scan/cache/coalesced paths keep winner/outcome-only persistence and never copy alternatives. New manual edition-number editing before and after Add, numeric overrides, and Store View edition-edit extensions are deferred (EP-D11).

The [edition-picker SDD](./work-units/owner-edition-picker-sdd.md) consolidates EP-D01..EP-D14 and extends this domain's §§8-13; retain three active jobs and a fifteen-job invocation budget.

Keep one card and one chosen cover, five initial rows/Show all up to ten, an explicit lookup for local/cache/older unfinished cards, independent per-card storage, a 24-hour product retention maximum from source fetch, and cleanup after confirmed Add. Preserve chosen metadata and selling details. Provider edition statements remain coherent source metadata; no new manual number field is introduced.

Only explicit edition_options completion saves bounded alternatives. Reuse operation-aware context, lookup-scoped attempts, leases, physical-call retry/billing fencing, and per-card request deduplication. Automatic local/cache/coalesced winner-only paths never propagate alternatives.

Status: design_ready_pending_owner_approval. The relevance-order decision resolves provider display §13.2; written-SDD and execution-plan approval still precede implementation. Historical implemented behavior below remains baseline evidence; no runtime or migration implementation is added.


Readiness clarification (picker §§4.3/5/13.2): preserve provider-attempt identity uniqueness alongside lookup-role uniqueness. Explicit results need original ordinal, safe Google Books links, separate eligibility, and allowlisted cache/deadline evidence; the automatic filtered/winner-only decoder is unchanged.

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Implementation checkpoint (2026-07-27):** the pre-model ingestion slice and fixture-backed Unit 4 runtime are deployed and live-verified. M11 `20260726182238`, M12 `20260726182539`, and M13 `20260727025046` are live with fencing, canonical hashing/validation, database-owned retryability, typed RPC transport, path rejection, relationship reconciliation, and minimum invoker wrappers. All nine recorded fixture cases passed; no real multimodal or metadata provider integration exists.

**Unit 4B persistence correction (local, unapplied):** forward-only M14 adds one
service-only vision-provider-attempt row per external call, reservation and
duplicate-spend linkage, bounded usage/injected pricing evidence, and explicit
accepted/stale/failed/unknown dispositions. Register/finalize/associate/mark RPCs
do not alter `p9-vision-v2` or permit metadata/inventory/publication writes.

**Metadata retry correction (live once 2026-08-10):** forward-only M38
adds metadata job context v2 with the latest physical provider call's originating
claim attempt. A finalized retryable result is reconciled without new egress only
inside that same claim attempt; a later job claim registers a fresh physical call
and retries the provider. Finalized terminal/non-retryable evidence remains
replay-safe, preserving accepted-state and cost/idempotency recovery. One final
automatic Owner proof completed six metadata jobs on claim 1 with no natural
retryable result and reached six Needs Review cards.

**Google Books matching/display quality correction (local 2026-08-30):** the
provider request now uses normalized title and first author when available,
even when a validated ISBN clue exists. Ranking first requires coherent exact
normalized title plus author overlap; validated ISBN, compatible base language,
and edition clues are secondary tie-break evidence only. Cover decoding checks
the documented image-size family from largest to smallest and skips an unsafe
or malformed larger URL without suppressing a later allowlisted Google Books
URL. No migration, provider call, or deployment is part of this local change.

**Representative-edition cover correction (M61/M62 live; runtime rollout gated,
2026-09-13):** The provider adapter may select one cover from the same already-returned
candidate set when the selected coherent edition has no cover, requiring exact
normalized title/full author-set/base-language compatibility and no conflicting
subtitle/series/volume. The fallback carries separate source/policy provenance,
is Owner-private, and never changes the selected edition or public cover. Google
Books volume/order evidence is decoded; opaque series membership is not treated
as a series name and instead suppresses fallback. M62 only aligns standalone
Owner detail/save projection with M61 batch projection.

**Bounded metadata-throughput correction (local 2026-08-30, rollout
gated):** one metadata worker invocation may accept a run budget of at most 15
jobs while generic worker contracts remain capped at 10. The worker holds at
most three active jobs, initially claims only three, and refills one available
slot at a time until the run budget is exhausted or the queue is empty. Each
book keeps its own provider request, lease/fence, retry/dead-letter decision,
and outcome; no unrelated books are combined into one Google Books request.
Results remain in claim order even when provider calls finish out of order, and
persisted job state remains authoritative. M56 is a forward dispatcher-only
migration candidate that sends `batchSize=15` only for `metadata_enrich` and
preserves batch size one for media, vision, and publication retry. The existing
once-per-minute schedule, 120-second dispatcher timeout, five-minute metadata
lease, claim-RPC maximum 10, retry/dead-letter policy, and autoscaling state are
unchanged. Worker deployment and live timeout/quota canary must precede any M56
application; neither action is authorized or performed by this checkpoint.

## 1. Decision

Use a persistent, asynchronous, provider-agnostic pipeline for spine images.
One primary multimodal vision adapter and at most one whole-image fallback
extract observed identity clues. Deterministic code then performs local
canonical lookup and sequential metadata-provider enrichment. The mobile
request does not wait synchronously for the complete pipeline.

The current runtime uses strict `p9-vision-v2` with session language as a
non-authoritative hint. Gemini returns a compact flat JSON object; BookConnect
locally validates it and maps usable optional enrichment into the existing M18/
M19 private proposal relation. Invalid enrichment cannot invalidate valid vision
evidence.

Future implementation decisions select Gemini 3.5 Flash (`gemini-3.5-flash`) for
vision and Google Books API as the initial metadata provider. The provider-neutral
primary/optional-secondary metadata seam is required, while secondary-provider
selection, enablement, credentials, configuration, and calls remain deferred and
separately gated.

**Narrow superseding founder decision (2026-07-27):** the initial primary vision
model ID is `gemini-3.5-flash-lite`, selected through server configuration. The
earlier `gemini-3.5-flash` decision above remains preserved as historical evidence.
No optional vision fallback model is selected or enabled.

## 2. Session experience

The user-visible session has only:

1. Start session.
2. Capture/upload one current image. Before candidate lineage exists, the Owner
   may explicitly remove it and choose one replacement; append-style additional
   images are not allowed.
3. Review/commit candidates as results arrive.
4. Close session and see summary.

There is no pause/save/discard command. Server persistence provides recovery when the app backgrounds, disconnects, or closes. Logout clears local cached workflow state but does not delete authoritative server state. During the Owner-only pilot, only the initiating Owner may mutate or resume the session. Phase 9 has no interactive support takeover; recovery is limited to initiating-Owner retry, claimed-worker recovery, and reconciliation. Future support tooling requires separate design and authorization.

Session defaults:

- optional language hint with auto-detection authoritative;
- condition;
- shelf/location;
- quantity: 1;
- publication preference: previous explicit preference, otherwise private on first session.

## 3. Capture contract

- Camera and gallery/manual upload are equal supported sources.
- The runtime accepts 1–15 visible spines and treats selected language as a hint.
- If the model/quality service sees more than 15 spines, reject and ask for a smaller photo. Do not retain only the first 15.
- Current runtime skips/reports mismatched observations. Approved target detects
  language/script per field without per-spine model switching.
- A framing guide, lighting prompt, and sample good/bad image reduce failure before upload.

## 4. Upload and quality gate

The server issues a scoped upload authorization and owns the final media asset/path. Before any model call:

1. Verify authenticated Owner/store capability and policy/quota.
2. Validate extension allowlist as a convenience, then detected MIME and file signature.
3. Decode with byte, dimension, and pixel limits to resist malformed/decompression inputs.
4. Re-encode to an approved image format and strip EXIF/GPS/metadata.
5. Compute SHA-256 over the sanitized image and check store-scoped replay policy.
6. Evaluate decodability, resolution, blur, glare, framing, and likely spine count.
7. Reject policy/quality/cap failures with a short actionable reason and no model cost.

The approved local candidate envelope is 10 MiB, 8,192 pixels per dimension, and 16,000,000 decoded pixels. Images over any bound fail with a stable media error and are never silently resized. Animated or multi-frame PNG/WebP inputs fail with `P9_MEDIA_MULTIFRAME_UNSUPPORTED`. ImageMagick's 64 MP `area` resource allowance is only an internal working/cache bound; it does not raise the product ceiling, which is checked before decode when headers permit and again after decode. Authoritative decode, orientation normalization, metadata stripping, WebP re-encode, and sanitized hashing run only in the dedicated claimed worker, not the Owner Edge request handler.

Exact image replay returns the existing input/job result when safe; it does not create duplicate cost or infer duplicate books.

## 5. Vision adapter contract

### Input

- opaque sanitized-media reference;
- optional canonical language hint and optional store common-language context,
  neither authoritative;
- literal maximum visible books = 15;
- opaque job, attempt, and correlation identities;
- contract, analysis-schema, pipeline, prompt, adapter, and adapter-version identifiers;
- no store/session/input/user authority, customer data, shelf/defaults, path/URL/capability, credentials, provider policy, database command, metadata query, or tools.

### Output

Strict versioned JSON:

- complete request/version identity and sanitized provider/model provenance;
- `image_outcome`: `analyzed`, `no_books`, `too_many_books`, or `quality_rejected`;
- detected visible-book count, including an explicit count over 15 with zero returned observations;
- ordered observations with unique contiguous ordinals;
- nullable title guess; bounded author guesses; optional publisher and visible ISBN clues;
- detected BCP 47 language or explicit `und`;
- finite normalized confidence;
- optional normalized in-bounds geometry;
- closed bounded warning codes.

Unknown values are null, not invented placeholders. The model cannot return executable instructions, URLs, SQL, Markdown/HTML, provider queries, or database actions. All strings are length/Unicode/control-character validated and rendered as plain text.

Gemini returns one compact `vision` object. Each observation contains ordinal,
nullable original title, no more than five original authors, nullable
publisher/ISBN clues, detected language, confidence, nullable title
Romanization, nullable English title translation, and an `author_romanizations`
array aligned positionally one-to-one with `author_guesses` (using null when no
Romanization is available). There is no separate provider enrichment subtree.

Geometry, warning codes, server provenance/contract/model/schema/prompt echoes,
source-text/source-field duplication, the former sidecar envelope, and oversized
author arrays are not provider output. BookConnect infers/validates source script,
supplies canonical provenance and source-field identity, adds null geometry/closed
warnings, and maps usable flattened enrichment to M18/M19. Missing, empty, or
unusable enrichment is non-fatal. The canonical `p9-vision-v2` persistence
contract remains authoritative after normalization.

## 6. Fallback policy

Invoke the configured fallback at most once for the whole image when the primary has:

- timeout/network/provider unavailability after bounded transient handling;
- output that cannot satisfy the schema;
- broadly unusable result inconsistent with the selected language/task.

Do not fallback per candidate. Do not fallback for valid empty/no-book, over-cap,
invalid upload, policy denial, missing optional enrichment, or an owner-disliked
but valid result. Manual correction remains available.

Fallback result goes through the same validator. Store adapter/model/prompt/schema version and error class, never secret configuration.

## 7. Candidate normalization

Deterministic normalization:

- trim/collapse whitespace and normalize Unicode without destroying original script;
- normalize author lists separately;
- normalize visible ISBN clue but mark it unvalidated;
- preserve the detected count and reject the complete image beyond 15 rather than clamp or truncate it;
- assign stable candidate indices and persist optional geometry;
- reject strings with unsafe control/bidi patterns from direct UI rendering or normalize/display safely with script-aware rules.

Structurally malformed output fails as one permanent contract result; individual
malformed observations are never salvaged. The corrected runtime retains mixed/
unknown-language observations as immutable evidence and treats selected language
as a non-authoritative hint; any titled observation with detected language other
than `und` becomes a candidate. Repeated identical
observations at different ordinals remain separate.

## 8. Metadata enrichment

For every usable candidate:

1. Validate/checksum the ISBN clue if present.
2. Search local canonical editions by validated ISBN.
3. Otherwise search local original title + authors + language, exact before fuzzy.
4. If no acceptable coherent local match, call the configured primary metadata adapter.
5. If technical failure/no acceptable coherent match meets fallback policy, call the secondary adapter.
6. For Google Books, require coherent normalized title and author evidence
   first; use validated ISBN, compatible language, and edition clues only to
   break ties between those coherent candidates. An ISBN that points to a
   title/author-conflicting volume is not accepted.
7. Persist attempts/provenance and select one coherent edition snapshot.
8. Reconcile optional bounded provisional variants against independently
   confirmed title/author source fields; deterministic keys remain separate.
9. Activate only eligible store-scoped variants under language/benchmark policy.
10. Mark ready or needs-review. Provider failure can still produce an
    Owner-confirmed, nullable-canonical candidate.

Metadata provider requests contain only normalized bibliographic clues, not the scan image or store/customer context.

## 9. Provider/cache contract

Each adapter supports:

- stable adapter key/version;
- lookup by ISBN and bibliographic text;
- normalized response schema;
- timeout/cancellation;
- typed error classification;
- usage/cost metadata where provided;
- field-level reuse policy: matching-only, storage allowed, public display allowed, image caching allowed, attribution required, and expiry/revalidation required;
- raw response retention policy;
- rate-limit/circuit-breaker signals.

The Gemini vision adapter requests `application/json` without a provider-side
response schema. The prompt defines the single flat `vision` shape, while the
BookConnect decoder remains the authoritative strict contract boundary. This
avoids provider-specific structured-schema rejection without weakening local
validation, provenance construction, or raw-response retention policy.
Before strict validation, the decoder applies a bounded Gemini JSON-mode
compatibility layer. Provider `image_outcome: "success"` becomes canonical
`analyzed`; safe `ISBN`/`ISBN-10`/`ISBN-13` labels are stripped from otherwise
valid identifier clues; and an in-cap analyzed visible-book count is reconciled
to the accepted observation count. A bounded provider count or observation
array of 16-100 books becomes canonical `too_many_books` with the validated
defensive count and zero observations. This is complete-image rejection: no
observation is truncated, persisted, or offered to optional enrichment. Counts
or arrays above 100, unknown response/vision structure, and malformed in-cap
observations remain deterministic schema failures.

Null or missing detected language becomes `und`; known human-readable language
names become their existing BCP 47 mappings; and valid BCP 47-shaped tags keep
strict canonical handling. An unrecognized, bounded, plain human-language label
degrades to `und` without changing original Unicode title/author content. A
non-string, empty, over-bound, control/bidi-bearing, active-content, or otherwise
malformed language value remains a schema failure. Optional Romanization or
translation is still validated independently; its rejection cannot invalidate
valid core extraction. Schema-failure logs may contain only a code-owned,
sanitized field path and one closed category (`unknown_keys`, `type`, `bounds`,
`format`, `active_content`, `coherence`, `identity`, or `other`), never the raw
payload, rejected value, generated key name, or bibliographic text.

Use positive and negative caches keyed by normalized provider-independent query plus adapter/schema version. Cache expiry is policy-configured. A circuit breaker suppresses repeated calls to a failing provider while leaving manual/local paths available.

## 10. Persistent jobs and recovery

External work runs as leased persistent jobs. Required properties:

- stable idempotency identity per input/stage;
- status, attempt, lease owner/expiry, next attempt, error class/code;
- retry only safe transient categories;
- dead-letter/escalation after configured maximum;
- cancellation/close awareness;
- recovery after worker crash without duplicate model/provider spend;
- per-candidate partial progress;
- bounded raw response and error detail.

The implementation should reuse the repository's proven Postgres job/worker patterns if their authorization/privacy semantics fit. Phase 9 must not reuse Phase 6 commerce event vocabulary or create payment effects.

## 11. Quota and cost

- Quota belongs to `store_id`, not only user.
- Check entitlement/quota before external-cost work and atomically reserve/count usage by policy.
- Exact replay/cache hits do not double charge.
- Failed provider calls record operational cost units when applicable.
- Display remaining quota and near-limit warnings without exposing provider pricing internals.
- Platform can disable a provider, language, store, or all extraction.
- Manual inventory remains available when quota/extraction is disabled.
- Numerical monthly/session/rate/timeouts are configurable. Fixed product safety limits are 15 books/image and one vision fallback.

## 12. Failure behavior

| Failure | Result |
| --- | --- |
| Invalid/malicious/over-size/over-pixel file | Reject before model call; delete/quarantine staging by policy. |
| Blur/glare/low resolution | Actionable rescan message; no candidate commit. |
| More than 15 spines | Reject/rescan; never truncate. |
| Hint differs from detected language | Retain the detected-language evidence and usable candidate; do not force the hint. |
| Vision primary technical/schema failure | One allowed fallback. |
| Both vision adapters fail | Input failed; other inputs continue; owner may retry/new upload. |
| Metadata provider unavailable | Secondary if allowed; then manual/needs-review. |
| No metadata match | Keep observed title/author as unmatched needs-review candidate. |
| Network/app closure | Server job continues; UI refetches authoritative state. |
| Quota exhausted | Block new cost work; preserve existing results; manual entry works. |
| Session close during processing | Return nonterminal summary/retry instruction; session stays active. |

The internal transition is `active -> closing -> closed`. `closing` begins only after all submitted inputs are terminal, rejects new inputs, and atomically finalizes the summary. It is not a user-visible pause or early-close workflow; uncommitted candidates remain `needs_review` and are never silently committed or deleted.

## 13. Retention

- Sanitized scan input: delete within 24 hours after session close; failed/unattached staging within 24 hours.
- Raw vision/provider payload persistence: disabled by default. A separately approved,
  purpose-bound diagnostic capture must delete within 7 days; normalized
  provenance/evidence is the ordinary retained path.
- Unresolved normalized candidate: default expire/delete after 30 days unless a reviewed owner workflow extends it.
- Committed candidate: retain only normalized provenance/audit fields necessary to explain the commit; remove raw payload/image link by policy.
- Logout clears local cache; server retention is authoritative.

SDD 04 owns holds, deletion evidence, exceptions, and signed access.

## 14. Tests and fixtures

- recorded contract fixtures for English and each pilot language/script;
- 1, 15, and >15 spine images;
- blur/glare/rotation/low-resolution/empty/wrong-language/mixed-language cases;
- multimodal prompt-injection text embedded in spines/background;
- malformed/extra/oversized schema output;
- 16-100 observation/count normalization to complete-image over-cap rejection,
  greater-than-100 defensive rejection, bounded unknown language labels, and
  closed privacy-safe schema diagnostics;
- primary timeout, fallback success/failure, valid-empty no-fallback;
- provider exact/fuzzy/conflict/no-match/cache/negative-cache/circuit-breaker;
- ISBN checksum/conversion;
- replay/idempotency/concurrent worker lease/crash recovery;
- quota reservation and manual fallback;
- no raw media/payload/log leakage.
- field-level mixed-language/script fixtures, already-Latin suppression,
  independent title/author confirmation, stale-source reconciliation, optional
  sidecar failure isolation, and store-scope denial;

CI uses recorded fixtures and validates schemas/behavior, never exact generative prose.

## 15. Acceptance criteria

### Provider routing and scale-readiness requirements

- Exactly one metadata primary and zero or one secondary are selected by versioned configuration. A logical lookup makes at most one attempt per role, sequentially.
- Secondary-eligible normalized outcomes are `no_acceptable_match`, `ambiguous_match`, `material_conflict`, `schema_invalid`, `malformed_response`, `timeout`, `rate_limited`, `provider_unavailable`, and `circuit_breaker_open`. An acceptable coherent primary result, local/cache hit, invalid query, policy denial, exhausted cost ceiling, or provider authentication/configuration failure is secondary-ineligible.
- Each adapter exposes a versioned capability declaration for supported query forms, identifiers, languages, output/reuse behavior, and normalized outcomes. Common recorded fixtures and conformance tests apply independently of provider names.
- Provider, fallback-role, rollout-scope, and global kill switches stop new calls but preserve manual entry. Per-provider breakers permit only separately configured probe traffic while open.
- External API calls are not promised exactly once. Durable request/attempt/reservation lineage permits at-most-one accepted state transition and detects/reconciles duplicate spend after timeout, lease expiry, or termination.
- Workers are horizontally compatible and stateless for correctness. Graceful shutdown stops claims and completes, renews, or safely releases active work; stale completion remains fenced.
- Capacity admission includes provider concurrency/quota, store/provider/global cost ceilings, and database connection budget. Exhaustion queues or retry-schedules work without storms.
- One store cannot permanently starve another eligible store; initial per-store admission limits are sufficient, while weighted scheduling is deferred.
- Media sanitation, vision analysis, and metadata enrichment have independent capacity signals and may use separate deployment/scaling policies: media is governed by CPU, memory, dimensions, decoding, and re-encoding; vision by provider/model concurrency, quota, network latency, and cost; metadata by local/cache hit rate, request coalescing, provider limits, and database access.
- Autoscaling remains disabled until fixed multi-replica evidence proves safe claiming/fencing, shutdown, provider timeout/retry, cost reconciliation, connection safety, fairness, and meaningful throughput improvement.
- Operational metrics cover queued count/oldest age by stage, claim latency, active leases, retry backlog, dead letters, duration, provider rate limiting/concurrency, per-store concentration, and startup/readiness duration.

| ID | Criterion |
| --- | --- |
| EXT-01 | Camera and gallery uploads use the same secure server pipeline. |
| EXT-02 | Accepted input contains no more than 15 candidates. |
| EXT-03 | More than 15 triggers reject/rescan, not truncation. |
| EXT-04 | Current runtime enforces selected language; approved target auto-detects per field and treats language inputs as optional hints. |
| EXT-05 | Per-spine model switching remains absent; mixed-language field detection does not require separate model routing. |
| EXT-06 | Start/Close-only session recovers for the initiating Owner across background/network/app closure and ends with an accurate terminal-input summary. |
| EXT-07 | Vision provider is hidden behind a versioned adapter. |
| EXT-08 | One whole-image fallback maximum is enforced. |
| EXT-09 | The model has no tools or data authority. |
| EXT-10 | All output satisfies strict schema/length/count validation before persistence. |
| EXT-11 | Metadata lookup is local-first, then sequential configured providers with cache/circuit breaker. |
| EXT-12 | Title/author are preferred; image ISBN remains an optional clue. |
| EXT-13 | Quota is store-scoped and checked before external cost. |
| EXT-14 | Replay/cache cannot double-charge. |
| EXT-15 | Scan/raw/candidate retention follows the agreed lifecycle. |
| EXT-16 | Manual entry works while extraction/provider/quota is unavailable. |
| EXT-17 | Metrics identify adapter version, outcome, latency, fallback, cache, and cost without raw content leakage. |
| EXT-18 | Provider provenance and field-level storage/display/cache/attribution/expiry rights are independently enforced. |
| EXT-19 | `p9-vision-v2` records detected count, ordered observations, normalized confidence/geometry, publisher/ISBN clues, and sanitized provenance while rejecting unknown/provider-specific fields. |
| EXT-20 | Current runtime preserves and skips mixed/`und` observations as documented; target runtime retains field-level language/script without allowing hints to force classification. |
| EXT-21 | Repeated identical books at separate ordinals produce separate immutable observations and separate candidates. |
| EXT-22 | One token/attempt-fenced transaction persists authoritative analysis evidence and candidates before completing the job; replay cannot duplicate effects. |
| EXT-23 | Stale attempts, including the same worker ID after reclaim, cannot read context, persist, fail, complete, or replay another attempt. |
| EXT-24 | Image result, per-observation evidence, metadata selection, and Owner edits remain separate persisted layers. |
| EXT-25 | Fixture-backed analysis creates no metadata-provider, canonical, inventory, listing, publication, or Storage effect. |
| EXT-26 | Exactly one primary and zero or one secondary are configuration-driven, sequential, and bounded to two external attempts. |
| EXT-27 | A closed normalized outcome policy deterministically permits or denies secondary invocation. |
| EXT-28 | Every adapter supplies a versioned capability declaration and passes common provider-independent fixtures/conformance tests. |
| EXT-29 | Provider, role, rollout, and global breakers/kill switches preserve manual degradation. |
| EXT-30 | Durable lineage permits at-most-one accepted transition and duplicate-spend detection without promising exactly-once provider calls. |
| EXT-31 | Multiple stateless replicas claim safely through authoritative leases, attempts, idempotency, and fencing. |
| EXT-32 | Graceful shutdown stops claims and safely completes, renews, or releases work; stale completion is rejected. |
| EXT-33 | Capacity admission and database connection budgets leave work durable without retry storms. |
| EXT-34 | Store fairness prevents permanent starvation; advanced weighted scheduling remains deferred. |
| EXT-35 | Media, vision, and metadata stages expose their distinct capacity signals and can scale independently without changing domain semantics. |
| EXT-36 | Autoscaling stays disabled until the fixed multi-replica activation evidence gate passes. |
| EXT-37 | Queue, lease, retry, provider-capacity, fairness, and worker-readiness metrics are bounded and operationally available. |
| EXT-38 | Provider availability, schema validity, match quality, correction rate, language/edition cohort, latency, and cost are scored separately. |
| EXT-39 | Provider promotion/demotion requires conformance, licensing/privacy review, authorized shadow evidence, rollback configuration, scorecard review, and explicit approval. |
| EXT-40 | `search_variant_proposals_v1` is optional, independently validated, and cannot invalidate a valid `p9-vision-v2` result. |
| EXT-41 | Unit 5C performs no untracked provider call; any Roman-query fallback remains a separately authorized Unit 5B extension. |

## 17.1 2026-08-09 M33 implementation alignment

The local, unapplied M33 correction implements existing EXT-13, EXT-14, EXT-22,
and EXT-30 without changing their product semantics. Sanitized-media completion
cannot resolve until the downstream vision job has exactly one validated
policy-1 reservation in the same transaction. Conflicting replay lineage rolls
the entire completion back. Its one-time repair is restricted to valid,
unleased, nonterminal jobs in active sessions whose sanitized media belongs to
the initiating Owner, and preserves their attempts, scheduling, and safe errors.
