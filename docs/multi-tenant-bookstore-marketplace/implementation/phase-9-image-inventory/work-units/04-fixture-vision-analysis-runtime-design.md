# Work Unit 4: Fixture-Backed Vision-Analysis Runtime Design

**Status:** `final_corrections_verified_git_integration_authorized`
**Date:** 2026-07-26
**Authority:** accepted Unit 4 specification and local implementation boundary; no migration application, deployment, real-provider, metadata, UI, inventory/publication, or Git publication authority
**Depends on:** M01-M08/M10 live; committed local M11 must be applied before local M12; SDD 00 MAS-01-MAS-12; SDD 02 EXT-02-EXT-10; SDD 04 MED-06-MED-10/MED-17-MED-22

## 1. Scope and exclusions

This unit owns only the deterministic local path:

`sanitized private image -> claim vision_extract -> authoritative context -> fixture analyzer -> canonical validation -> count/language policy -> immutable analysis evidence + review candidates -> terminal job result`.

Included:

- platform-owned `SpineImageAnalyzer` abstraction and `FixtureSpineImageAnalyzer`;
- one fixture provider selection plus one disabled/configuration slot for a future real adapter;
- canonical request/result validation and shared adapter contract tests;
- vision-specific worker claim/context/persist/fail orchestration;
- deterministic count, language, repeated-copy, and malformed-result policy;
- immutable analysis/observation evidence and candidate creation;
- attempt-token fencing, retry classification, transactional completion, and replay.

Excluded:

- Gemini, OpenAI, or any real multimodal call and automatic provider fallback;
- metadata APIs, local/provider metadata matching, ranking, aliases, or canonical creation;
- Owner/mobile UI, review edits, duplicate resolution, inventory writes, or publication;
- M11/M12 application, service deployment, Supabase/Storage mutation, or production credentials.

The analyzer performs multimodal image analysis, not a traditional OCR pipeline. It has no tools or authority.

## 2. Verified current state

### Live project, 2026-07-26 read-only

- Project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`) is `ACTIVE_HEALTHY`, `ap-southeast-2`, PostgreSQL 17.6.1.
- M01-M08/M10 are the live Phase 9 tail; M11 is absent.
- Live jobs use `open|in_progress|retry_scheduled|resolved|resolved_noop|cancelled|dead_letter`, attempts `0..5`, and a five-minute lease.
- Live `claim_phase9_jobs(integer,text,boolean)` and `fail_phase9_job(uuid,text,text,text)` are service-only but fence by worker ID and lease expiry, not attempt token.
- Live candidate uniqueness is `(input_id,candidate_index)`. Candidate evidence lacks publisher clue, vision job/schema lineage, and immutable original analysis snapshot.
- Live extraction session/input/job/candidate base tables have no `anon`/`authenticated` grants; `service_role` has table access. The two generic job functions deny `anon` and `authenticated` and allow `service_role`.
- No Phase 9 ingestion or vision-analysis Edge Function is deployed.

### Committed local M11

- `0a8e57a` contains M11, Owner intake, and the media-validation worker; M11 remains unapplied and services remain undeployed.
- M11 adds `lease_token_hash` and token/attempt-fenced claim, context, revalidate, snapshot-bind, complete, and fail functions only for `media_validate_sanitize`.
- Successful media completion links one sanitized private media asset and queues exactly one deduplicated `vision_extract` job.
- M11 supplies no vision claim/context/persist/fail/complete functions and no immutable vision-result persistence.

### Existing contract

`contracts/vision.ts` already rejects unknown keys, active content, unsafe ISBN clues, malformed BCP 47, oversized payloads/strings/arrays, invalid confidence/geometry, duplicate/missing ordinals, and more than 15 returned candidates. It lacks detected-visible count, publisher clue, complete provider/model/prompt/pipeline provenance, mixed-language retention, and the over-limit count-with-zero-observations representation. The future implementation therefore introduces schema `p9-vision-v2`; it does not silently reinterpret `p9-vision-v1`.

## 3. Canonical analyzer boundary

Application interface:

```ts
interface SpineImageAnalyzer {
  analyze(request: SpineAnalysisRequest): Promise<SpineAnalysisResult>;
}
```

The runtime still deep-validates the returned value as untrusted data. Provider adapters translate provider payloads inside the adapter; provider-specific fields never cross this interface.

### Request: `SpineAnalysisRequest`

All fields are required:

| Field | Rule |
| --- | --- |
| `contract_version` | exact `p9-contract-v1` |
| `schema_version` | exact `p9-vision-v2` |
| `pipeline_version`, `prompt_version` | allowlisted identifier, 1-64 characters |
| `adapter_key`, `adapter_version` | allowlisted identifier, 2-64 characters |
| `job_reference` | opaque application reference, 16-128 characters; no store/session/input/path meaning |
| `attempt_number` | integer `1..5` |
| `correlation_id` | opaque UUID or bounded opaque ID, maximum 128 characters |
| `requested_at` | ISO-8601 UTC timestamp |
| `expected_language` | canonical BCP 47 tag selected by the session |
| `max_visible_books` | literal `15` |
| `sanitized_media_reference` | opaque `media_` reference, maximum 128 characters; never URL/path/capability |

Forbidden request fields include store/session/input/user IDs, bucket/object path, signed URL, token, credential, shelf/defaults, retry/fallback policy, database command, metadata query, and tools.

### Result: `SpineAnalysisResult`

Required envelope fields:

- request identity echoes: contract/schema/pipeline/prompt/adapter versions, job reference, attempt, correlation ID, expected language;
- sanitized provenance: `provider_key`, `model_key`, `model_version`, each allowlisted and bounded to 64 characters;
- `received_at`;
- `image_outcome`: `analyzed`, `no_books`, `too_many_books`, or `quality_rejected`;
- `detected_visible_book_count`: integer `0..100`, except nullable only for `quality_rejected`;
- ordered `observations`;
- closed `warning_codes`, maximum 8.

Provider request IDs, raw responses, safety traces, token counts, URLs, arbitrary metadata, and provider-specific error objects are not canonical fields.

### Observation

| Field | Rule |
| --- | --- |
| `ordinal` | integer, unique, contiguous, ordered from 1 |
| `title_guess` | nullable plain text, 1-512 characters when present |
| `author_guesses` | 0-20 plain-text entries, each 1-256 characters |
| `publisher_clue` | nullable plain text, maximum 256 characters |
| `isbn_clue` | nullable, maximum 32 characters, ISBN-clue character allowlist only |
| `detected_language` | canonical BCP 47 or literal `und`; never inferred from expected language |
| `confidence` | finite normalized number `0..1`; no percentage or field authority |
| `geometry` | nullable `{x,y,width,height,rotation}`; normalized `0..1`, positive size, in-bounds, rotation `-180..180` |
| `warning_codes` | maximum 4 closed codes; no provider prose |

Every object rejects unknown keys recursively. Complete canonical JSON is at most 262,144 UTF-8 bytes. Strings reject controls, bidi overrides/isolates, URLs, paths, HTML, Markdown links, SQL, and command/tool-shaped content.

Envelope coherence:

- `no_books`: count `0`, zero observations;
- `too_many_books`: count `16..100`, zero observations;
- `analyzed`: count `1..15`, observation length equals count, ordinals `1..count`;
- `quality_rejected`: count null or `0..15`, zero observations.

## 4. Deterministic product policy

The adapter reports observations; application code owns all decisions.

| Canonical result | Authoritative outcome | Candidate effect | Input/job effect |
| --- | --- | --- | --- |
| `no_books`, count 0 | `no_books` | zero | input `skipped`; job `resolved_noop` |
| `analyzed`, count 1-15, all usable expected-language | `accepted` | one per observation | input `ready`; job `resolved` |
| count 15 | `accepted` | exactly 15 | same |
| `too_many_books`, count >15 | `over_visible_book_limit` | zero; never truncate | input `failed`; job `resolved` |
| mixed language, at least one usable expected-language observation | `accepted_with_language_skips` | candidates only for expected-language observations | input `ready`; skipped ordinals retained in evidence |
| every observation language mismatches or is `und` | `language_mismatch` | zero | input `skipped`; job `resolved_noop` |
| `quality_rejected` | `quality_rejected` | zero | input `failed`; job `resolved` |

Language matching compares canonical primary language subtags. Script/region differences remain evidence and can route a candidate to later Owner review, but the expected language is never changed. `und` is explicitly skipped and reported.

Repeated identical observations at different ordinals create separate evidence and separate candidates. No title/ISBN deduplication occurs here.

A structurally valid observation with no title is `identity_insufficient`: retain immutable observation evidence but create no candidate. Missing optional author/publisher/ISBN/geometry is valid. Any structural violation—unknown key/enum, invalid type/length/confidence/geometry, count mismatch, missing/duplicate ordinal, active content, or envelope incoherence—rejects the whole provider result. No partial salvage occurs from a structurally malformed result.

## 5. Vision-job state and lease design

Existing job states remain unchanged.

| From | Operation | To | Input |
| --- | --- | --- | --- |
| `open|retry_scheduled` due, or expired `in_progress` | `claim_phase9_vision_jobs` | `in_progress`; attempt increments; fresh token hash/lease | unchanged |
| `in_progress` | exact-token context | unchanged | `queued -> processing`, or remains `processing` on replay/reclaim |
| `in_progress` | authoritative accepted result | `resolved` | `ready` |
| `in_progress` | successful zero-candidate result | `resolved_noop` | `skipped` |
| `in_progress` | permanent product/contract result | `resolved` | `failed` |
| `in_progress` | retryable failure, attempts remain | `retry_scheduled` | remains `processing` |
| `in_progress` | retryable failure at attempt 5 | `dead_letter` | `failed` |

Every context, persistence, fail, and completion path validates service role, job ID, `job_kind='vision_extract'`, entity/store relationship, attempt number, opaque token hash, lease owner, and unexpired lease under row lock.

- Same worker ID reclaiming receives a new attempt and token; old calls fail.
- Stale/expired workers make no writes.
- A crash before persistence leaves no analysis/candidate effect; expiry permits reclaim.
- Provider timeout/unavailability is retryable and writes no partial result.
- A rejected RPC promise or approved analyzer/database availability failure is retryable. Media unavailability and invalid/missing authoritative relationships are permanent.
- After the exact current job-row claim is proven, an invalid/missing input/session/media relationship resolves only that job with `P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED`. It records the completing claim fingerprint, clears the active lease, returns one bounded replayable result, and never mutates an unverified related row. A stale or conflicting claim has no effect.
- A database transaction failure rolls back result, observations, candidates, input, and job together; lease expiry or typed retry schedules recovery.
- Duplicate delivery cannot re-claim a resolved job.

## 6. Transaction and idempotency

`phase9_persist_vision_analysis` is the sole authoritative success/product-result transaction:

1. lock and validate the exact job claim;
2. derive input, session, store, expected language, and sanitized media relationship from database state;
3. validate request identity and canonical result hash against context;
4. insert one immutable image-level result;
5. insert all immutable observations, including language/identity skips;
6. insert candidates only for usable expected-language observations;
7. update input count/outcome/state and session candidate count;
8. set job terminal status, safe code, completion timestamp, and clear active lease fields;
9. return a bounded canonical completion summary.

The transaction commits only after every required insert/update succeeds. It performs no metadata, inventory, listing, event-content, or Storage write.

Exact uniqueness:

- analysis result: `UNIQUE(vision_job_id, analysis_schema_version)`;
- observation: `UNIQUE(analysis_result_id, observation_ordinal)`;
- model candidate: `UNIQUE(vision_job_id, candidate_index, analysis_schema_version)` plus `UNIQUE(analysis_observation_id)`.

The existing `(input_id,candidate_index)` remains a compatible stricter guard for the current one-job-per-input pipeline.

The database canonicalizes the accepted result as PostgreSQL normalized `jsonb::text`, enforces the 262,144-byte ceiling with `octet_length(convert_to(p_result::text,'UTF8'))`, and computes `canonical_result_sha256` from those same UTF-8 canonical bytes inside the persistence transaction. The caller supplies no hash. A repeat persist call after commit/response loss recomputes the incoming hash and returns the stored completion only when job/schema/hash/attempt/worker/token all match. Any mismatch returns `P9_VISION_PERSISTENCE_CONFLICT`; prior attempts cannot replay a later result. Raw lease tokens are never stored.

Zero-candidate outcomes have an analysis-result row and no observation/candidate rows where the canonical result has no observations. Mixed/all-mismatch results retain observation evidence even when candidate count is zero.

## 7. Minimum forward migration plan

Future local M12, ordered after unapplied M11:

1. widen `image_extraction_inputs.detected_candidate_count` to permit recorded `0..100`; the product cap remains deterministic at 15;
2. create service-only, RLS-enabled `image_analysis_results` with store/session/input/job FKs, authoritative outcome/counts, versions/provenance, bounded canonical snapshot/hash, completing claim fingerprint, safe error, and timestamps;
3. create service-only, RLS-enabled `image_analysis_observations` with result/store/input scope, ordinal, disposition, normalized clue columns, geometry/confidence/warnings, bounded immutable observation snapshot, and optional candidate link;
4. add candidate `vision_job_id`, `analysis_observation_id`, `analysis_schema_version`, and `observed_publisher_clue`; add exact uniqueness/FKs without changing manual-candidate behavior;
5. add nullable exact-claim reconciliation fingerprint/summary fields to jobs without adding a job state, plus the claim index specialized to `job_kind='vision_extract'`;
6. create `claim_phase9_vision_jobs`, `phase9_vision_job_context`, `phase9_persist_vision_analysis`, and `phase9_fail_vision_job` plus non-client validation/reconciliation helpers in `marketplace_sec`, all pinned-path with privileged transitions `SECURITY DEFINER`;
7. revoke all new table/function privileges from `PUBLIC`, `anon`, and `authenticated`; grant only named function execution to `service_role`;
8. add immutability guards denying update/delete of analysis evidence outside an explicitly future lifecycle-redaction migration.

No raw provider-response table, migration rewrite, metadata table change, inventory/listing change, bucket/policy change, or live application belongs to M12.

## 8. Error and retry catalogue

| Code | Class | Terminal behavior |
| --- | --- | --- |
| `P9_VISION_NO_BOOKS` | successful zero candidate | `resolved_noop`, input `skipped` |
| `P9_VISION_LANGUAGE_MISMATCH` | successful zero candidate | `resolved_noop`, input `skipped` |
| `P9_VISION_OVER_LIMIT` | permanent product | `resolved`, input `failed`, zero candidates |
| `P9_VISION_QUALITY_REJECTED` | permanent product | `resolved`, input `failed` |
| `P9_VISION_SCHEMA_INVALID` | permanent contract | bounded failure evidence; `resolved`, input `failed` |
| `P9_VISION_ANALYZER_TIMEOUT` | retryable infrastructure | retry/dead-letter at attempt 5 |
| `P9_VISION_ANALYZER_UNAVAILABLE` | retryable infrastructure | retry/dead-letter at attempt 5 |
| `P9_VISION_MEDIA_UNAVAILABLE` | permanent media | `resolved`; no retry |
| `P9_VISION_DATABASE_RETRYABLE` | retryable infrastructure | transaction rollback then retry/reclaim |
| `P9_VISION_INTERNAL_PERMANENT` | unknown resolved database/domain integrity | bounded permanent resolution; no raw detail and no retry |
| `P9_VISION_STALE_ATTEMPT` | lease conflict | no effect; worker drops delivery |
| `P9_VISION_PERSISTENCE_CONFLICT` | permanent integrity/idempotency | no overwrite; reconciliation alert |
| `P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED` | permanent relationship/security integrity | exact-claim job-only `resolved`; no related-row effect; exact replay only |
| `P9_OWNER_NOT_AUTHORIZED` | security | no effect |
| `P9_STATE_CONFLICT` | wrong job/state/security boundary | no effect |

Runtime RPC classification uses exact equality against this closed safe-code set; it never substring-matches or returns raw database text. `P9_STATE_CONFLICT` becomes `stale_attempt`, authorization becomes `security_rejected`, relationship rejection/reconciliation becomes `relationship_reconciliation_required`, schema invalid invokes one database-owned permanent fail transition, and persistence conflict becomes `persistence_reconciliation_required` without a fail call. Rejected RPC promises alone become `P9_VISION_DATABASE_RETRYABLE`; unknown resolved database/domain errors become bounded `P9_VISION_INTERNAL_PERMANENT`. A fail-RPC transport error remains `database_retryable`, never `stale_attempt`. The fail RPC accepts no retryability flag: PostgreSQL derives retry/dead-letter behavior only for the closed transient analyzer/database catalogue; schema, media, relationship, security, and internal-permanent outcomes cannot schedule retry.

Permanent outcomes never invoke provider fallback or repeat automatically. This fixture unit implements no fallback.

## 9. Security and privacy

- Worker authentication is service-only; client roles cannot claim, read context, persist, fail, or replay.
- Database context derives store/session/input/media/language; worker/analyzer input cannot supply authority.
- The media resolver alone maps the opaque sanitized-media reference to private bytes. The analyzer receives only the request in section 3.
- Analysis tables are private/service-only and carry `store_id`; all FKs and transaction predicates require one store.
- Canonical snapshots use positive allowlists and bounded closed warning codes. Unknown/provider-specific fields fail.
- Logs/metrics/audits allow only operation, outcome, safe code, attempt, duration, counts, and version keys. IDs are secured traces, not metric labels.
- Never log/persist raw image, base64, provider request/response, full prompt, signed URL, bucket/object/storage path, capability, token, lease token, credentials, EXIF/GPS, arbitrary provider metadata, or unrestricted title/author/publisher/ISBN text.
- Owner/client DTOs expose only later named safe projections; this unit adds none.
- Tests prove Store A cannot use a Store B job/media/input and that no inventory/listing row changes.

## 10. Red-first TDD matrix

| ID | Level | Fixture/setup and action | Expected result | Proves |
| --- | --- | --- | --- | --- |
| V4-C01 | contract | zero-book fixture -> parse | valid count 0/empty observations | EXT-02/10 |
| V4-C02 | contract | one-book and 15-book fixtures | valid ordered observations | MAS-01 |
| V4-C03 | contract | count 16, zero observations | valid canonical `too_many_books` for policy rejection | EXT-03 |
| V4-C04 | contract | count/length mismatch, unsupported outcome/key | whole result rejected | MAS-02 |
| V4-C05 | contract | missing/duplicate/noncontiguous ordinals | whole result rejected | EXT-10 |
| V4-C06 | contract | NaN/out-of-range confidence or geometry | whole result rejected | MED-08 |
| V4-C07 | contract | URL/path/tool/command/provider metadata fields | whole result rejected; no raw echo | MED-08/09 |
| V4-A01 | analyzer shared contract | fixture analyzer valid/timeout/malformed cases | same canonical boundary for configured analyzer | EXT-07 |
| V4-P01 | unit | zero books -> evaluate | no candidates; `no_books` | EXT-02 |
| V4-P02 | unit | 16 -> evaluate | whole image rejected; zero candidates | EXT-03 |
| V4-P03 | unit | repeated identical clues at ordinals 1/2 | two accepted proposals | DAT-16 |
| V4-P04 | unit | expected `en`, observations `en`,`hi`,`und` | one candidate, two retained skips | EXT-04/05 |
| V4-P05 | unit | all mismatching/`und` | zero candidates; language mismatch | EXT-04 |
| V4-P06 | unit | structurally valid null-title plus valid title | null-title retained as insufficient; valid candidate persists | bounded partial usability |
| V4-W01 | worker | wrong job type -> context/persist/fail | security/state rejection; no effect | MED-21 |
| V4-W02 | PGlite | same worker reclaims expired lease | new attempt/token; old token rejected everywhere | lease fencing |
| V4-W03 | PGlite | stale lease after provider returns | no result/candidate/job mutation | stale-worker safety |
| V4-W04 | worker/PGlite | analyzer timeout | retry scheduled; no partial evidence/candidate | retry classification |
| V4-W05 | worker/PGlite | approved transient analyzer/database availability failure | retry/dead-letter by attempts | recovery |
| V4-D01 | PGlite | valid result persistence | result+observations+candidates+input+job commit together | transaction |
| V4-D02 | PGlite fault injection | fail after analysis/before candidate insert | complete rollback; job not resolved | atomicity |
| V4-D03 | PGlite | persist succeeds, response lost, same payload/token retried | stored canonical completion; no duplicates | ambiguous response |
| V4-D04 | PGlite | duplicate execution/concurrent persist | one result/ordinal/candidate set | uniqueness |
| V4-D05 | PGlite | same ordinal but changed payload/hash | `P9_VISION_PERSISTENCE_CONFLICT`; original unchanged | immutable idempotency |
| V4-D06 | PGlite | no-books/all-mismatch/over-limit | result persisted; zero candidates; exact input/job terminal states | zero-candidate authority |
| V4-S01 | migration/static | inspect grants and pinned definitions | client execute/table access absent; service named RPC only | MED-21 |
| V4-S02 | PGlite | Store A claim with Store B input/media relationship | exact-claim job-only reconciliation; no unverified-row effect | MAS-03 |
| V4-S03 | contract/runtime | recursively scan DTO/log/audit payloads | forbidden keys/content absent | MED-09 |
| V4-S04 | PGlite | snapshot row update/delete attempt | immutable evidence unchanged | provenance |
| V4-N01 | PGlite | compare inventory/listing/events before/after all outcomes | zero inventory/publication effects | MAS-05/07 |
| V4-Q01 | static | no metadata-provider imports/calls in Unit 4 files | check fails on metadata boundary crossing | scope |

Implementation verification also runs focused vision/analyzer/worker Jest, Phase 9 PGlite, repository TypeScript, strict worker TypeScript, continuity validation, privacy scans, and `git diff --check`. No test may call a real provider.

## 11. Gap register and readiness

| Gap | Resolution |
| --- | --- |
| vision jobs lack token/attempt RPCs | future M12 functions reuse M11 fencing |
| no immutable image/observation evidence | two service-only analysis tables |
| candidate lacks publisher/job/schema lineage | bounded candidate additions and FKs |
| existing v1 contract rejects mixed language and lacks count/provenance | explicit breaking `p9-vision-v2` |
| input count cannot record >15 | widen storage bound; deterministic cap unchanged |
| ambiguous completion response | completion claim fingerprint + canonical hash replay |
| old docs call committed M11 uncommitted | tracker/status reconciliation in this design session |

No unresolved product or architecture decision blocks implementation. Provider selection, live model policy, fallback, deployment sizing, and M11/M12 application remain later independent gates.

**Implementation gate:** red-first local Work Unit 4 implementation and M12 creation were authorized and completed on 2026-07-26. Two correction-only reviews returned bounded findings; all findings are now corrected with 132/132 Phase 9 Jest, 57/57 Phase 9 PGlite, repository TypeScript, strict worker TypeScript, continuity, and diff hygiene passing. Final Git integration of this exact candidate is authorized in this session. Migration application, deployment, real provider/metadata calls, inventory/publication effects, and Supabase/Storage mutation remain prohibited.
