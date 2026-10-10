# SDD 01: Data, Canonical Catalogue, Metadata, Aliases, and Duplicates

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

## 2026-10-08 - Task 6 confirmation read projection

Picker §§5-7 / EP-AC11/19 reuse existing private selection_id, selected_at and
selected_by; there is no new persisted field. The Owner selection DTO now
requires confirmedByOwner in both sources. M70 derives it through M69's valid
store/session/card/query-current projection; an automatic suggestion is false.
Strong legacy selected mode remains independent of Owner-confirmed status.

Read projection and selection replay change no stored receipt, selected snapshot,
review, inventory or version counter. [Dictionary](supporting/data-dictionary.md#2026-10-08---task-6-confirmation-read-contract)
and [migration/compatibility ledger](supporting/database-current-vs-target.md#2026-10-08---task-6-m70-local-confirmation-correction)
own exact fields, verified live absence, coordinated contracts and rollback
boundaries. M65-M69 are unchanged; M65-M70 remain NOT_APPLIED.

## 2026-10-08 - Edition-picker Task 5 local completion

Picker §§5-8 and Unit 7A §§5-11 now resolve edition_option through the scoped private state selection_id at the existing metadata revision. The saved title/all authors/language/script must match the coherent snapshot; the public Save boundary admits no metadata blob. Provider ISBNs, publisher/date, description, cover, edition statement, volume and format materialize from that one selected snapshot. Controlled current-suggestion selection preserves eligible original canonical references; a provider option has nullable canonical references. Existing manual/original selected modes retain their contract, with text-only automatic/local suggestions requiring controlled confirmation or manual entry.

M69 uses the existing table only: clearing resets options, source lookup/attempt/fetch/deadline and pending request identity, preserving selection_id/selected_option_snapshot/selected_source/selected_source_id/selected_at/selected_by. Inventory lineage and a version containing the saved selection ID/metadata revision remain durable. No table/column/index/RLS change, catalogue promotion, shared merge/increment or option history is added. [Task 5 evidence](trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-5-local-completion) proves private row/selling-field fidelity, canonical compatibility and two same-book cards in one store/session. M65-M69 remain NOT_APPLIED; earlier checkpoints are historical.

## 2026-10-08 - Task 4 normalized completion and failure replay corrections

Under picker §§4.1-4.3/5/9 and Master MAS-02/17, M68 now validates the pinned normalized metadata contract on every non-null eligible/ineligible row before suitability. Bounds match TypeScript UTF-16 lengths; versions, timezone-bearing fetchedAt and checksummed/coherent ISBN10/13 fields are required. An exact validated ISBN may satisfy eligibility when the supplied query language is und, while contradictory supplied clues remain rejected.

M68 adds one nullable private failure_receipt JSONB (object <=1024 bytes) to phase9_candidate_edition_state. It records only the latest failure's claim/request identity hashes and bounded arguments, enabling exact replay after lease release without a provider lookup. Existing job status is authoritative. Direct client access, selected metadata/selling authority and alternative storage policy are unchanged. This supersedes the earlier no-new-column description. M65-M67 are unchanged; M65-M68 are NOT_APPLIED. [Correction evidence](trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-4-review-corrections) and [dictionary](supporting/data-dictionary.md#2026-10-08---task-4-private-failure-receipt) own exact fields/proof. Task 4 awaits correction review; Tasks 5-8 remain unstarted.
## 2026-10-07 - Task 4 private result completion

Picker §§4.3/5/8-9 is implemented locally by M68 using the existing M65 state, lookup/attempt/reservation/provider-call tables and job authority. Completion increments options_version once, stores bounded options and original source/deadline provenance, and atomically resolves the explicit operation. Recovery/failure return slim receipts. Selection, candidate metadata/review authority and selling fields remain preserved. No new table/column, canonical promotion, automatic options cache or cross-card copy is added.

Fresh proof: 34 completion/security plus 6 worker-to-SQL and 14 automatic structural cases PASS. M65-M67 are unchanged; M65-M68 are NOT_APPLIED. [Migration ledger](supporting/database-current-vs-target.md#2026-10-07---task-4-m68-local-migration-readback) and [verification](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-4-local-completion) distinguish disposable readback from live application. Task 4 is pending review; Tasks 5-8 remain unstarted. Earlier checkpoints are historical.

## 2026-10-07 - Edition-picker Task 2 review corrections

The Owner-authorized corrections restore picker §4.1 / DOC-3 §5.1 / DOC-4 §8: local reuse validates the complete Owner-safe metadata, a unique coherent exact text match remains a medium suggestion requiring confirmation, and ambiguous matches remain unresolved. M65/M67 are revised locally only; M65–M67 are NOT_APPLIED. The existing gateway, jobs, private-state permissions, selling fields and Add fence remain in force. No product scope or new migration was added.

Current authority, corrected handoff and verification are recorded in [the implementation evidence](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections) and DOC-13/TRACKER. Earlier checkpoints are historical.

## 2026-10-07 - Edition-picker Task 2 local completion

Task 2 is locally complete: private per-card state, controlled read/search/select, version/expiry/ownership guards, coherent local ISBN resolution, lookup-scoped attempt history, and explicit-operation admission. Task 1 remains complete. The Owner's “ok proceed” authorized local M65–M67 creation and disposable tests; these files exist locally and are NOT_APPLIED. No live database/Storage write, deployment, staging, commit, or push occurred.

Fresh proof: 34 disposable-database tests PASS; 4 affected Owner Jest suites / 303 tests PASS; strict Owner ingestion graph type check PASS. Real independent-connection races, provider-retention permission, worker execution/completion, Add/cleanup integration, client/UI/browser and rollout proof remain Tasks 3–8. No full-feature acceptance is claimed.

Current work unit: Task 2 checkpoint review. Exact next authorized action: review the Task 2 diff/evidence; the next implementation slice is Task 3 Google result envelope after Owner authorization. Sources: picker SDD §§4.3/5–6/8–9/11; Master MAS-02/03/07/12/17. Earlier dated checkpoints below are historical.


## 2026-10-07 - Edition-picker Task 2 gateway/preflight checkpoint

Task 1 remains locally complete. Task 2 code/read-only preflight is now authorized: the strict authenticated Owner gateway and HTTP routing pass 303 affected Jest tests and a strict server type check. Database storage/commands are not implemented; local M65–M67 migration-file creation is awaiting the separate Owner approval required by AGENTS. No SQL/database/Storage/deployment/Git publication occurred. Tasks 3–8 remain pending. Current authority/status comes from DOC-13 and TRACKER; earlier checkpoints below are historical.

## 2026-10-07 - Edition-picker Task 1 contract checkpoint

The Owner authorized Task 1 on 2026-10-07. Contracts/fixtures and narrow compatibility are locally complete; Tasks 2–8 and database changes remain unstarted/unapproved. Source behavior remains picker SDD §§5–7/9/13.2. Current next action is Task 1 diff review; [implementation evidence](trackers/02-implementation-and-verification.md) supersedes earlier planning-only status below.


## 2026-10-06 - Owner edition picker draft extension

Latest Owner display clarification EP-D14: each edition option in the metadata sheet shows its own cover image from its safe URL, title, all authors, and publication date; publisher, ISBN, and language are secondary details. Selection saves the coherent chosen metadata independently and follows the usual inventory Add flow, leaving one chosen cover on the scan card. This supersedes earlier text-only option rows. Owner chose relevance order with returned order preserved and Google attribution/book links. Picker §13.2 now defines Search Books wording and bounded unavailable/ineligible rows; EP-D11/13 scope cuts remain in force.

Latest Owner scope: alternatives are obtained and saved only after an explicit Owner lookup (EP-D13); automatic scan/cache/coalesced paths keep winner/outcome-only persistence and never copy alternatives. New manual edition-number editing before and after Add, numeric overrides, and Store View edition-edit extensions are deferred (EP-D11).

The [edition-picker SDD](./work-units/owner-edition-picker-sdd.md) consolidates EP-D01..EP-D14 and extends this domain's §§2-5; existing automatic snapshots remain distinct from the current Owner choice.

Keep one card and one chosen cover, five initial rows/Show all up to ten, an explicit lookup for local/cache/older unfinished cards, independent per-card storage, a 24-hour product retention maximum from source fetch, and cleanup after confirmed Add. Preserve chosen metadata and selling details. Provider edition statements remain coherent source metadata; no new manual number field is introduced.

Per-record strong/medium identity rules remain under picker §4.1. Picker §§5/6 keeps expiring results separate from selected provenance, using existing metadata authority versions and coherent provider edition statements. No canonical overwrite or number-specific schema extension.

Status: design_ready_pending_owner_approval. The relevance-order decision resolves provider display §13.2; written-SDD and execution-plan approval still precede implementation. Historical implemented behavior below remains baseline evidence; no runtime or migration implementation is added.


**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Unit 7/8 closure checkpoint (repository-only 2026-08-21):** M51 preserves
nullable ordering for non-public media state but requires every link satisfying
the shared public-media eligibility predicate to occupy a unique `public_order`
in `1..3`. Its preflight rejects incompatible existing state; no live migration
or data rewrite was performed.

**Unit 7A override (2026-08-12):** the duplicate-choice and existing-row
increment design below is **DEFERRED / LEGACY** for scanned-candidate commit.
Unit 7A creates exactly one new private inventory row per explicitly committed
eligible reviewed candidate and performs no duplicate lookup, target selection,
merge, increment, manual match, or keep-separate choice. The controlling design
is [Unit 7A create-only inventory commit](./work-units/07a-create-only-inventory-commit-sdd.md).

**Implementation checkpoint (2026-07-29):** `book_search_aliases` exists from
live M01 with its limited target/source/status schema and zero recorded rows at
the M18 audit. Unit 5C-2 adds a separate private
`phase9_search_variant_proposals` relation with exact
analysis/candidate/observation/field/author linkage, deterministic identity,
provenance, and proposed/non-searchable defaults. M18 is live once as
`20260729004216`; M19 fingerprints the first accepted envelope and is live
once as `20260729020008`; M01 remains unchanged. Activation, stale propagation, and
active-only alias/search projection remain unimplemented.

## 1. Decision

Extend the existing edition-first canonical catalogue without making uncertain scans global truth. Store a coherent selected metadata snapshot on inventory, retain provider provenance privately, keep the canonical link nullable, and add source-bearing search aliases. Unit 7A uses create-only scanned-candidate commits; the older advisory duplicate-choice model is retained only as deferred/legacy guidance outside 7A.

## 2. Identity hierarchy

Identity evidence, strongest first:

1. Validated ISBN-13 exact match.
2. Validated ISBN-10 normalized/converted and consistent with an edition.
3. Stable provider edition ID plus coherent title/author/language/format evidence.
4. Exact normalized original title + authors + language + edition clues.
5. Fuzzy title/author evidence as a suggestion only.

Visible ISBN from the spine image is a lookup clue, not a stored authoritative ISBN. Aliases, cover images, and descriptions never establish identity.

Different-language editions remain different editions even if the underlying work is shared. Same edition at different stores creates separate offers. Store inventory ownership is never merged across stores.

## 3. Canonical creation and pollution control

- Local canonical lookup happens before external providers.
- Reuse an existing canonical edition when strong validated evidence matches.
- Create a new canonical edition only through a controlled service when validated ISBN/provider evidence meets the match contract.
- Uncertain/manual entries commit successfully with `canonical_edition_id = null` and store-owned metadata.
- A Store Owner can correct the store snapshot but cannot overwrite a shared canonical work/edition.
- Changing a store ISBN triggers a controlled rematch; it does not directly edit the canonical record.
- No automatic background canonical refresh occurs in the first release. A later refresh must be versioned, previewed, and separately approved.

## 4. Metadata contract

Selected metadata supports:

- original title and optional subtitle;
- original author names;
- ISBN-10 and ISBN-13, both when validated/available;
- description;
- publisher and published date;
- language/script;
- edition statement, volume, format/binding;
- page count and categories;
- canonical/provider cover URL;
- provider/record ID, fetch time, match strength/rationale, adapter/schema/normalizer version.

The bounded P9-D86 fallback is separate from this selected-edition contract:
when the selected edition has no cover, a compatible alternate cover already in
the same provider response may be retained as Owner-private
`representative_edition` provenance. It does not alter the selected snapshot,
canonical/public `cover_url`, identity evidence, or provider request count.
Provider volume/order evidence participates in conflict detection. Opaque series
membership is not converted into a human series name; either record carrying
unresolved series evidence suppresses fallback.

The selector chooses one coherent edition response. A secondary provider may corroborate or replace an insufficient/failed primary result, but fields from conflicting editions are not silently combined. Raw/normalized provider evidence remains private and time-bounded according to SDD 04.

Vision evidence is not a metadata selection. The image-level canonical analysis result and each ordered observation are immutable private evidence. A review candidate copies only normalized observed clues and links back to one observation; `selected_snapshot` remains owned by later coherent metadata selection, and `owner_review_snapshot` remains owned by later Owner edits. Model/provider confidence, publisher/ISBN clues, or image evidence never establish canonical identity.

## 5. ISBN rules

- Strip spaces/hyphens and normalize casing.
- Validate checksum before strong matching or canonical write.
- Deterministically convert valid ISBN-10 to ISBN-13 when possible and store both if the metadata relationship is valid.
- Reject malformed values as identity evidence; retain the visible clue only in private candidate evidence until owner correction.
- ISBN uniqueness conflicts stop canonical creation and route to review; they do not overwrite an existing edition.

## 6. Multilingual authoritative data and search variants

The earlier post-metadata English-alias method is superseded by
[Unit 5C Lite](./work-units/05c-lite-multilingual-search-variants-sdd.md).

- Confirmed original-language title and author remain primary and displayed.
- Title and author source confirmation is independent.
- Each source field retains BCP 47 language and ISO 15924 script.
- An optional vision-associated sidecar may propose one primary Roman form,
  zero to two alternatives, and one separately inactive translation candidate.
- All model proposals begin provisional and non-searchable.
- Deterministic normalization/search keys are not linguistic variants.
- Already-Latin source text does not receive a duplicate Romanization.
- Each linguistic variant retains target, exact source field/text, language,
  script, source/version provenance, status, scope, and approval evidence.
- A material source change makes dependent variants stale and non-searchable.
- Only active store-scoped variants enter search. Variant hits return confirmed
  original values; no variant determines identity, uniqueness, or duplicates.
- Global canonical promotion is deferred to catalogue governance.

The live M01 table still uses canonical/inventory targets, kinds
`transliteration|translation|common_spelling|recognized_title`, sources
`automated|provider_official|owner_verified|platform_verified`, and statuses
`proposed|approved|rejected`. Later Unit 5C implementation must map or migrate
that representation explicitly; this SDD does not claim the target is live.

## 7. Condition and damage

Public base condition values:

| Value | Meaning |
| --- | --- |
| `new` | Unused/store-new copy. |
| `like_new` | Appears nearly new; no meaningful marks/damage. |
| `very_good` | Light wear; clean, complete, fully readable. |
| `good` | Noticeable normal wear or limited marks; complete/readable. |
| `acceptable` | Heavy wear/marks but complete, safe, and readable. |

All except New display a concise accessible explanation marker in owner and marketplace UI.

Damage is orthogonal:

- `has_damage=false`: base condition is sufficient.
- `has_damage=true`, sellable: owner selects damage types, writes a public damage note, sets a fair selling price, and attaches 1–3 approved actual-copy photos. It remains a separate inventory row.
- unsellable: missing essential pages, unreadable, severe mould/contamination, unsafe damage, or disabling water damage. It may remain private for internal record but cannot project publicly.

There is no promotion/discount engine in Phase 9. The owner enters the lower selling price. MRP/cost are optional private/collapsed fields.

## 8. Deferred/legacy advisory duplicate matrix

A duplicate warning is same-store only. One visible spine remains one candidate, including repeated spines in the same/other images.

| Existing vs candidate | Recommendation |
| --- | --- |
| Same validated edition/ISBN, language, format, base condition, price; no damage/copy note/approved public actual-copy or damage photo | Offer `increment_quantity` first. |
| Same edition but different condition, price, language, format, edition/volume | Create separate row. |
| Any copy-specific damage, annotation, signature, collectible note, or approved public actual-copy/damage photo | Create separate row. |
| No ISBN, strong original title/author/language match | Warn; owner chooses separate or manually matches. No automatic increment. |
| Only fuzzy title or alias match | Do not call it a duplicate; show optional possible-match review. |
| Different store | Never inventory-merge; group only as public offers under the same edition. |

Shelf/location alone does not force a separate row. The owner may still choose `keep_separate` after the warning.

Image bytes, hashes, crops, covers, and visual similarity are excluded from duplicate identity. The image SHA-256 is used only to prevent exact upload replay/double charging, not to merge books.

Private customer-request photos are request-scoped evidence created after inventory identity. They never influence duplicate matching, compatibility, quantity increment, or row separation.

## 9. Concurrency and commit evidence

- UI duplicate results are advisory snapshots.
- The controlled commit command recomputes the duplicate set under a transaction-scoped identity lock and expected candidate version.
- `increment_quantity` locks the target inventory row and increments total/available without rewriting reserved/sold/removed buckets.
- If target compatibility changed after review, return a conflict and refresh options.
- `keep_separate` records the warned candidate IDs/reason/owner action for audit but does not store unbounded snapshots.
- Candidate/action idempotency prevents double commit across retries.

## 10. Search and projection

Public search indexes:

- original title/subtitle/authors;
- valid ISBN-10/13;
- publisher/categories where useful;
- language;
- approved aliases.

The public listing stores/derives only safe search material. Raw provider payloads, model confidence, rejected aliases, shelf, costs, and duplicate evidence remain private.

## 11. Migration notes

Current live conditions are `new`, `like_new`, `good`, `fair`, `damaged`; all current rows are `good` as of 2026-07-19. Migration design must still re-query at application time.

- Add new condition constraints in a forward-compatible sequence.
- Map `fair -> acceptable` deterministically.
- Do not map `damaged` directly to one base condition; require adjudication using condition/note/photo state.
- Add `very_good` and damage fields before switching writers.
- Update both inventory and public projection constraints/types together.
- Extend the projection writer and all app types/tests; avoid a period where public conditions are rejected.
- Preserve `canonical_edition_id` nullable and avoid weakening ISBN uniqueness without evidence.
- Replace the hard-coded provider CHECK with registry/config-backed adapter keys.

## 12. Acceptance criteria

### Provider architecture reconciliation

- A versioned provider-independent query identity is derived from normalized bibliographic clues and contains no secret, raw image, PII, or store authority.
- Metadata cache entries are isolated by lookup-contract, normalizer, adapter, adapter version, capability, and reuse-policy versions; positive, negative, and ambiguous outcomes have explicit expiry/invalidation.
- Every external attempt records logical lookup, candidate/store scope, primary/secondary role, sequence, adapter/capability/schema/normalizer versions, routing-policy version, triggering and normalized outcomes, cache/coalescing status, latency, cost-reservation lineage, and accepted/rejected disposition.
- Provider-specific fields stop at the adapter/private provenance boundary. Candidate snapshots, canonical identity, Owner review, duplicate logic, inventory, projection, and marketplace contracts remain provider-neutral.
- Owner corrections are recorded as bounded field-category deltas against the selected normalized snapshot for quality evaluation, without unrestricted provider payload telemetry.
- Shared lookup reuse is permitted only for provider-independent non-sensitive clues under compatible adapter/version, privacy, licensing, and policy scope.

| ID | Criterion |
| --- | --- |
| DAT-01 | Selected metadata supports description and all agreed edition/display fields. |
| DAT-02 | Both validated ISBNs are stored when available; one may remain null. |
| DAT-03 | Visible ISBN is never persisted as authoritative without validation/owner verification. |
| DAT-04 | Provider provenance and versions identify the selected coherent edition. |
| DAT-05 | Local canonical lookup precedes external provider calls. |
| DAT-06 | Primary/secondary provider conflicts do not silently stitch editions. |
| DAT-07 | Uncertain inventory can commit with a null canonical link. |
| DAT-08 | Store correction cannot mutate shared canonical truth. |
| DAT-09 | No automatic canonical refresh runs in the first release. |
| DAT-10 | Confirmed original-language title/author and per-field language/script remain primary through display. |
| DAT-11 | The optional sidecar returns bounded field-targeted provisional Roman forms and a separately inactive translation candidate; zero proposals is valid. |
| DAT-12 | Title and author confirmation/reconciliation is independent; already-Latin fields do not receive duplicate Romanization. |
| DAT-13 | Variant source, field, language, script, provenance, lifecycle, scope, and approval are retained; only active store-scoped variants search. |
| DAT-14 | Deterministic keys are not variants; no variant influences identity or duplicate decisions. |
| DAT-15 | Language capabilities are benchmarked and reversible without changing identity authority. |
| DAT-16 | Duplicate detection is same-store and advisory. |
| DAT-17 | Image similarity is absent from duplicate logic. |
| DAT-18 | Deferred/legacy outside Unit 7A: a separately authorized workflow may increment compatible existing inventory atomically and idempotently; Unit 7A always creates a new row. |
| DAT-19 | Copy-specific variants create separate rows. |
| DAT-20 | Different stores remain separate offers. |
| DAT-21 | Five public base conditions and accessible explanations are implemented. |
| DAT-22 | Damage is stored separately from base condition. |
| DAT-23 | Sellable damaged copies require note and 1–3 approved photos. |
| DAT-24 | Unsellable damaged copies cannot publish. |
| DAT-25 | Lower price works without a promotion/discount engine. |
| DAT-26 | Immutable vision evidence, later metadata selection, and later Owner edits remain separate persisted layers. |
| DAT-27 | Every model-created candidate traces to one job/schema/observation identity; repeated positions remain distinct and model clues never establish canonical identity. |
| DAT-28 | Equivalent normalized clues produce a versioned provider-independent query identity. |
| DAT-29 | Cache entries are isolated and invalidated by contract, normalizer, adapter/version, capability, and reuse-policy namespace. |
| DAT-30 | Every metadata attempt retains role, sequence, routing/capability versions, normalized outcome, cache/coalescing state, and cost lineage. |
| DAT-31 | Provider-specific fields cannot escape private provenance into downstream domain or public contracts. |
| DAT-32 | Owner correction deltas support provider-quality evaluation without raw-payload telemetry. |
| DAT-33 | No external provider is canonical authority; accepted metadata is one coherent provider snapshot or reviewed manual data. |

## 13. Deferred

- automatic global canonical merge/refresh;
- alias languages beyond the pilot rollout;
- global canonical variant promotion and moderation;
- full bibliographic authority control;
- automatic collectible/signed-edition valuation;
- image similarity;
- supplier/consignment/promotion engines.
