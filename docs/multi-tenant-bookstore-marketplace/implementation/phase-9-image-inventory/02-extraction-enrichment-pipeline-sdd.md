# SDD 02: Extraction and Metadata Enrichment Pipeline

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

## 1. Decision

Use a persistent, asynchronous, provider-agnostic pipeline for same-language spine images. One primary multimodal vision adapter and at most one whole-image fallback extract observed identity clues. Deterministic code then performs local canonical lookup and sequential metadata-provider enrichment. The mobile request does not wait synchronously for the complete pipeline.

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

Exact image replay returns the existing input/job result when safe; it does not create duplicate cost or infer duplicate books.

## 5. Vision adapter contract

### Input

- sanitized image bytes/reference;
- selected BCP 47 language and optional script;
- maximum candidates = 15;
- extraction schema version and task instruction;
- opaque request/correlation identifier;
- no store name, customer data, shelf location, database IDs, signed URLs, credentials, or tools.

### Output

Strict versioned JSON:

- `schema_version`;
- `image_result`: accepted/empty/wrong_language/too_many/quality_failure;
- ordered candidates with index;
- observed original-script title;
- observed original-script authors;
- optional visible ISBN clue;
- selected/detected language/script;
- confidence per identity field or candidate;
- optional bounded bounding box/position;
- bounded warnings.

Unknown values are null, not invented placeholders. The model cannot return executable instructions, URLs, SQL, Markdown/HTML, provider queries, or database actions. All strings are length/Unicode/control-character validated and rendered as plain text.

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
- clamp candidate count and reject any schema output beyond 15 rather than silently ignore it;
- assign stable candidate indices and persist optional geometry;
- reject strings with unsafe control/bidi patterns from direct UI rendering or normalize/display safely with script-aware rules.

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
- Raw vision/provider payload: default delete after 7 days.
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
