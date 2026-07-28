# SDD 01: Data, Canonical Catalogue, Metadata, Aliases, and Duplicates

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Implementation checkpoint (2026-07-29):** `book_search_aliases` exists from
live M01 with its limited target/source/status schema and zero recorded rows at
the last audit. Unit 5C Lite is approved target design only; its field authority,
sidecar, lifecycle, and store-scope delta is not implemented.

## 1. Decision

Extend the existing edition-first canonical catalogue without making uncertain scans global truth. Store a coherent selected metadata snapshot on inventory, retain provider provenance privately, keep the canonical link nullable, and add source-bearing search aliases. Use advisory duplicate detection with explicit owner choice; never use image similarity or automatic merge.

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

## 8. Advisory duplicate matrix

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
| DAT-18 | Compatible copies can increment quantity atomically and idempotently. |
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
