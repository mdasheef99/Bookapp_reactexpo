# SDD 01: Data, Canonical Catalogue, Metadata, Aliases, and Duplicates

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Implementation checkpoint (2026-07-26):** M01-M08/M10 are live-verified. Committed local M11 remains unapplied/undeployed. The fixture-backed vision-analysis design adds only private immutable analysis evidence and candidate lineage; metadata selection, canonical identity, aliases, inventory, and publication remain separate later stages.

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

## 6. Multilingual authoritative data and aliases

- Original-script title/author from selected metadata or owner correction is authoritative and displayed.
- One automated alias-generation operation proposes at most three English/Latin-script aliases:
  - transliteration;
  - English translation;
  - common spelling;
  - recognized English title.
- Authors are transliterated, not semantically translated.
- The relational target may retain additional provider-recognized official or Owner/platform-verified aliases within configured abuse, quality, and storage limits. Model-generated aliases require schema validation, source/version, confidence, and owner/platform correction capability.
- Alias creation happens after metadata selection so it cannot distort canonical lookup.
- Only `approved` aliases enter public search. Alias hits return the original authoritative title.
- Canonical alias kinds are `transliteration`, `translation`, `common_spelling`, and `recognized_title`. Canonical sources are `automated`, `provider_official`, `owner_verified`, and `platform_verified`; approval status is only `proposed`, `approved`, or `rejected`.
- `superseded` is a bounded lifecycle/audit reason, not a persisted approval status. Superseding an alias transitions the replaced row to `rejected` and removes it from search eligibility while retaining bounded audit evidence.
- Alias text is never duplicate evidence, canonical uniqueness evidence, or automatic display replacement.
- The schema supports future alias languages/scripts without adding columns or changing identity rules.

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
| DAT-10 | Original-script title/author remain authoritative. |
| DAT-11 | Each automated operation proposes at most three English aliases; additional official/Owner-verified aliases are bounded, provenance-bearing rows. |
| DAT-12 | Author aliases transliterate rather than translate names. |
| DAT-13 | Alias provenance/status is stored and only approved aliases enter search. |
| DAT-14 | Aliases never influence identity or duplicate decisions. |
| DAT-15 | New languages/scripts can be added without schema identity changes. |
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

## 13. Deferred

- automatic global canonical merge/refresh;
- alias languages beyond the pilot rollout;
- full bibliographic authority control;
- automatic collectible/signed-edition valuation;
- image similarity;
- supplier/consignment/promotion engines.
