# SDD 02: Extraction and Metadata Enrichment Pipeline

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Implementation checkpoint (2026-07-27):** the pre-model ingestion slice and fixture-backed Unit 4 runtime are deployed and live-verified. M11 `20260726182238`, M12 `20260726182539`, and M13 `20260727025046` are live with fencing, canonical hashing/validation, database-owned retryability, typed RPC transport, path rejection, relationship reconciliation, and minimum invoker wrappers. All nine recorded fixture cases passed; no real multimodal or metadata provider integration exists.

## 1. Decision

Use a persistent, asynchronous, provider-agnostic pipeline for same-language spine images. One primary multimodal vision adapter and at most one whole-image fallback extract observed identity clues. Deterministic code then performs local canonical lookup and sequential metadata-provider enrichment. The mobile request does not wait synchronously for the complete pipeline.

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
2. Capture/upload one or more images.
3. Review/commit candidates as results arrive.
4. Close session and see summary.

There is no pause/save/discard command. Server persistence provides recovery when the app backgrounds, disconnects, or closes. Logout clears local cached workflow state but does not delete authoritative server state. During the Owner-only pilot, only the initiating Owner may mutate or resume the session. Phase 9 has no interactive support takeover; recovery is limited to initiating-Owner retry, claimed-worker recovery, and reconciliation. Future support tooling requires separate design and authorization.

Session defaults:

- selected language: English initially;
- condition;
- shelf/location;
- quantity: 1;
- publication preference: previous explicit preference, otherwise private on first session.

## 3. Capture contract

- Camera and gallery/manual upload are equal supported sources.
- Owner selects one language before upload. English is default.
- Image should show 1–15 visible spines from that selected language.
- If the model/quality service sees more than 15 spines, reject and ask for a smaller photo. Do not retain only the first 15.
- Mixed-language processing is not attempted. Candidates inconsistent with the selected language are skipped/reported; English default means only English candidates are retained unless another language was selected.
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
- session-selected canonical BCP 47 expected language;
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

The exact `p9-vision-v2` request/result coherence, field bounds, provenance, and unsupported-field policy are normative in the Unit 4 design. Provider-specific payloads remain inside the adapter. The application revalidates the adapter result as untrusted data.

## 6. Fallback policy

Invoke the configured fallback at most once for the whole image when the primary has:

- timeout/network/provider unavailability after bounded transient handling;
- output that cannot satisfy the schema;
- broadly unusable result inconsistent with the selected language/task.

Do not fallback per candidate. Do not fallback for valid empty/no-book, selected-language mismatch, over-cap, invalid upload, policy denial, or an owner-disliked but valid result. Manual correction remains available.

Fallback result goes through the same validator. Store adapter/model/prompt/schema version and error class, never secret configuration.

## 7. Candidate normalization

Deterministic normalization:

- trim/collapse whitespace and normalize Unicode without destroying original script;
- normalize author lists separately;
- normalize visible ISBN clue but mark it unvalidated;
- preserve the detected count and reject the complete image beyond 15 rather than clamp or truncate it;
- assign stable candidate indices and persist optional geometry;
- reject strings with unsafe control/bidi patterns from direct UI rendering or normalize/display safely with script-aware rules.

Structurally malformed output fails as one permanent contract result; individual malformed observations are never salvaged. Structurally valid mixed-language observations remain immutable evidence, but only usable observations matching the expected primary language become candidates. `und` is skipped. If all observations mismatch or are unknown, the input is a successful zero-candidate language-mismatch result. Repeated identical observations at different ordinals remain separate.

## 8. Metadata enrichment

For every usable candidate:

1. Validate/checksum the ISBN clue if present.
2. Search local canonical editions by validated ISBN.
3. Otherwise search local original title + authors + language, exact before fuzzy.
4. If no acceptable coherent local match, call the configured primary metadata adapter.
5. If technical failure/no acceptable coherent match meets fallback policy, call the secondary adapter.
6. Rank exact identifiers before normalized text; reject contradictory language/edition evidence.
7. Persist attempts/provenance and select one coherent edition snapshot.
8. Generate/select at most three English aliases per automated operation after metadata selection; bounded provider-recognized or Owner/platform-verified aliases may coexist.
9. Mark ready or needs-review. Provider failure can still produce a manually completable candidate.

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
| Wrong selected language | Skip/report selected-language mismatch; do not auto-route. |
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
- primary timeout, fallback success/failure, valid-empty no-fallback;
- provider exact/fuzzy/conflict/no-match/cache/negative-cache/circuit-breaker;
- ISBN checksum/conversion;
- replay/idempotency/concurrent worker lease/crash recovery;
- quota reservation and manual fallback;
- no raw media/payload/log leakage.

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
| EXT-04 | One selected language is enforced; English defaults; new languages are adapter/config additions. |
| EXT-05 | Mixed-language/per-spine model routing is absent. |
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
| EXT-20 | Mixed-language and `und` observations are explicitly skipped without changing the selected language; all-mismatch is a successful zero-candidate result. |
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
