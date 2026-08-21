# Phase 9 Unit 8 SDD: Bookstore-First Customer Marketplace

**Status:** normative design frozen; precision-amended 2026-08-20; bounded U8B
corrective scope locally complete; independent re-review and operational gates
pending
**Authority:** the user's 2026-08-17 Unit 8 freeze decision; DOC-0, DOC-3,
DOC-5; Phase 9 master SDD; Marketplace SDD 05; Unit 5C Lite; Unit 7A; Unit
7B; Unit 7C; and the independently approved WU0B Q07-Q10 design.
**Specializes:** the broad Marketplace SDD for the implemented post-5C/7A/7B/7C
architecture. It does not reopen those units.
**Security prerequisite:** M47/M48 legacy Marketplace RPC remediation is
satisfied. The two projection-row legacy RPCs remain customer-inaccessible.
**Implementation authority:** the explicit bounded U8B user authorization
covered only the repository correction and disposable acceptance tests recorded
below. It did not authorize live Supabase mutation, Vault provisioning,
migration-history reconciliation, M49 application, deployment, or U8C.

## 1. Status and authority

This is the authoritative implementation contract for Phase 9 Unit 8. Upstream
documents continue to own product intent and their established domains; this
SDD resolves their Unit 8 consequences into one buildable customer-Marketplace
boundary. Where older client behavior differs, this SDD defines the target.

The previously identified local/live migration-history mismatch is parked. It
does not block this design freeze, but it must be safely reconciled before any
future Unit 8 migration is applied. This task does not investigate or repair it.

### Bounded U8B corrective evidence (2026-08-20)

The smallest authorized corrective scope changed only three behaviors required
by the frozen §§10–12, 18–20 contract: provider/canonical cover provenance is
read from the authoritative inventory source, approved public actual-copy media
is the only fallback, Q08 cursors bind to a deterministic fingerprint of the
effective relevant publication-policy rows, and malformed decrypted cursor
fields map to `P9_CURSOR_INVALID`. The U8B integration suite is `63/63` green;
the disposable real-PostgreSQL acceptance runner passes with
`U8B_REAL_POSTGRES_ACCEPTANCE_PASS`. M49 was applied only to disposable local
databases and remains unapplied to Supabase. U8C was not started.

## 2. Scope and architecture

The frozen flow is:

```text
private store_inventory
  -> Unit 7B controlled safe publication
  -> safe public Marketplace boundary
  -> Q07 internal matching
  -> currently eligible matching public offers
  -> GROUP BY bookstore
  -> deterministic bookstore ranking
  -> store-group cursor pagination
  -> bookstore-first customer DTO/UI
```

Unit 8 reads customer-safe publications and profiles. It does not rebuild
inventory creation or identity, publication lifecycle or eligibility, metadata
extraction, vision, media approval, variant generation, Owner Store View, stock
mutation, payment/order behavior, or Unit 9 request-photo behavior.

## 3. Existing-to-target reconciliation

The current primary client path is approximately:

```text
phase9_public_listing_search_v2
  -> book-oriented safe listing rows
  -> client-side title/author fallback grouping
  -> client-side slicing
  -> separate public-store-profile name loading
```

The current storefront similarly performs a bounded listing fetch and uses the
fetched array length rather than a formal complete-catalogue title count. These
paths are safe with respect to `inventory_id`, but they are not the final Unit 8
query, grouping, count, or pagination contract.

The target moves Q07 matching, bookstore grouping, counts, ranking, and
pagination to the server. Q09 becomes a complete server-paginated public-title-
group catalogue. Q10 gains a forward allowlisted public-media gallery contract.
The current v2 JSON functions remain the safe compatibility path until a
separately authorized and verified cutover.

DOC-5's direct store-name/location discovery may remain a distinct safe public-
profile mode. It does not claim a matched offer, `offer_count`, or `matchContext`
and must not be mixed into Q08 book-match counts without a separately versioned
union contract.

The current client fallback `normalized title + normalized authors` is legacy
behavior to remove. It may be used as an ordering/search representation, never
as Unit 8 title identity.

## 4. Identity model

| Identity | Frozen meaning | Customer exposure |
| --- | --- | --- |
| `inventoryId` | Permanent private Owner-management identity from Unit 7A/7C. Stable across private, live, paused, attention, and out-of-stock states. | Never in Q08-Q10 DTOs, cursors, contexts, URLs, analytics, or errors. |
| `listingId` | Customer-safe identity for one currently published offer. Appropriate for current detail/cart seams. Retraction/republish may produce a different value. | Public only while the current publication is eligible. It never becomes the Owner identity. |
| internal `store_id` | Server-side grouping/authorization relation. | A public store identifier may be returned only through the approved public-store-profile boundary; private `stores` fields are never a fallback. |
| title-group identity | Server-resolved public grouping identity for Q08 match context and Q09 page units. | Opaque context or a separately proven safe public group ID only; raw internal grouping keys stay internal by default. |

Title/group identity precedence is exact and fail-safe:

1. authoritative canonical edition identity, when present;
2. validated ISBN identity, when present;
3. otherwise the individual `listingId` (listing-scoped identity).

Normalized title plus author never establishes identity. Nullable-canonical
Owner-confirmed listings are never fuzzy-merged. Linguistic aliases never
establish canonical, edition, duplicate, offer, or group identity. Matching and
identity are separate. When identity evidence is insufficient, false splits are
preferred to false merges.

## 5. Offer and count semantics

| Concept | Normative definition |
| --- | --- |
| Inventory row | Private physical/operational `store_inventory` record. |
| Quantity | Private stock buckets and exact counts. Quantity never multiplies public offers. |
| Offer | One distinct, currently qualifying public listing/publication with its own `listingId`, price, condition, and disclosure. |
| `offer_count` | Distinct qualifying offers for the matched title group within one bookstore; never `SUM(quantity)`. |
| `bookstore_count` | Distinct eligible bookstore groups matching the complete bound Q08 search context. |
| `title_count` | Distinct eligible Q09 public title groups in the complete selected storefront. |

Counts are server-derived under the same eligibility and context as their page.
They are not page-array lengths and must not be conflated with one another.

## 6. Publication versus discovery boundary

Unit 7B owns creation and safe projection of a listing. Unit 7C owns later stock,
content, media, and lifecycle transitions. Unit 8 is read-only with respect to
those domains and rechecks current public eligibility on every Q08-Q10 request.

An offer is discoverable only when the safe publication is current, active,
sellable, positively priced, has available stock, passes condition/damage/media
and moderation policy, and belongs to a discoverable store. Retained listing or
publication history is evidence, not current discoverability. Unit 8 never
infers eligibility from the mere existence of a listing row or `listingId`.

## 7. Q07 internal matching contract

Q07 is an internal stage invoked inside Q08. It is not a customer RPC, route,
independently paginated API, or client cache contract. Its **logical candidate
set** is the current safe public Marketplace publication set. It never exposes
private inventory or turns protected inventory into a customer-readable search
API.

Logical public candidacy and secured implementation access are distinct. A
protected internal PostgreSQL implementation may join private/protected
relations when necessary to prove already-authorized eligibility,
listing/inventory relationships, canonical relationships, store-scoped variant
association, or another existing internal relationship. Such joins run only
inside the hardened server boundary with least-privilege grants and pinned
resolution. They cannot expand the logical candidate set beyond currently
eligible public publications.

Q07 may match authorized public candidates using:

- validated ISBN;
- authoritative original title and author;
- original script and public language;
- active, search-eligible, store-scoped Unit 5C title/author variants;
- strong original-field relevance and bounded fuzzy behavior already allowed by
  Marketplace authority.

Its internal result may carry listing/store/group references, bounded match
score, match class, and safe reason needed by Q08. It must not expose a public
raw-match endpoint or make alias text an identity. Nullable-canonical Owner-
confirmed publications remain candidates under their ordinary public gates.
No private field from an internal join may enter Q08/Q09/Q10 output, cursor,
`matchContext`, error, telemetry, analytics, cache key, log, or client-visible
response.

## 8. Q08 bookstore-first search contract

Q08 is the primary customer Marketplace search boundary. Its operation order is
normative:

```text
validate and bind query/filter/context
  -> Q07 internal matching
  -> apply current safe public eligibility
  -> group qualifying matches by store
  -> resolve matched-title and offer summary per store
  -> deterministic rank
  -> paginate store groups
  -> positive-allowlist customer DTO
```

**Group before pagination.** A raw listing page must never be sliced and then
grouped. Each bookstore appears at most once in one stable Q08 traversal.

Conceptual response:

```text
PublicStoreGroupPage {
  contractVersion
  bookstoreCount
  items[] {
    store { publicStoreId, displayName, logo, locality, city, state,
            pickup, delivery, conditionalLocationSignal }
    matchedBook { matchContext, originalTitle, authors, language, publicIsbn,
                  cover, optionalApprovedRomanDisplay, boundedMatchKind }
    offerSummary {
      offerCount, lowestPriceMinor, currency,
      conditionSummary { best, worst, distinct[] }
      damageSummary { hasUndamagedOffers, hasDamagedOffers }
      fulfillmentSummary { pickupOfferCount, deliveryOfferCount }
      availabilityBand, confirmationBeforePayment
    }
  }
  pageInfo { nextCursor }
}
```

Every store field comes from the safe public-store-profile boundary. Exact stock
and all private identities are absent. `boundedMatchKind` may distinguish, for
example, ISBN/original/active-variant relevance without returning alias
provenance, scores, normalized keys, or ranking internals.

If one store has multiple matching title groups, Q08 selects the card's matched
group deterministically by the highest Q07 match tuple and final stable internal
group tie-breaker. `offerCount`, price, condition, damage, cover, and issued
`matchContext` describe that selected group only. Other matching and nonmatching
eligible titles remain available through the complete Q09 storefront.

### Q08 offer-summary aggregation

Q08 uses one aggregate model; it never combines a scalar price from one offer
with a condition or damage claim presented as though it described that same
offer:

- `offerCount` is the number of distinct currently qualifying `listingId`
  values in the selected matched title group.
- `lowestPriceMinor` is the minimum qualifying public price. Initial Unit 8
  compares only the configured Marketplace currency (`INR`); currency is
  returned explicitly.
- Conditions use the frozen public order `new`, `like_new`, `very_good`, `good`,
  `acceptable`. `conditionSummary.best` and `.worst` are the minimum/maximum
  rank present, and `.distinct[]` is the unique set in that order. The UI labels
  this as an aggregate range/set, never as the lowest-price offer's condition.
- `damageSummary` reports whether the qualifying set contains at least one
  undamaged and/or damaged offer. Offer-specific damage types/notes remain Q10
  data and are not blended into the card.
- `pickupOfferCount` and `deliveryOfferCount` count qualifying offers supporting
  each mode. These are aggregate availability statements; displaying both does
  not claim one offer supports both.
- `availabilityBand` is the best bounded band represented in the qualifying set,
  using `available`, then `low_stock`, then `confirmation_required`; the card
  remains subject to confirmation-before-payment messaging.
- An approved canonical/provider cover is title-level. If it is absent, choose
  one deterministic representative offer by
  `(price ASC, condition-rank ASC, hasDamage ASC, listingId ASC)` and use only
  that offer's approved primary public actual-copy media. If it has none, use
  the placeholder; do not borrow another offer's image. Actual-copy presentation
  must not imply that it depicts every offer.

### Q08 zero-result seam

A completed current Q08 request with no eligible store groups returns a bounded
empty page with `bookstoreCount=0`, no cursor, and no internal match detail. The
existing safe unavailable-search seam (`record_marketplace_unavailable_search`
or its reviewed equivalent) remains compatible and must not be silently lost.
Only the current non-stale request may record the approved bounded query
telemetry. It contains no private identity, internal group/match key, ranking
tuple, protected-join detail, or expanded sensitive search data. This preserves
the seam only; Unit 8 does not implement Unit 9 requests or alert workflows.

## 9. Q08 deterministic ranking

### Q07 match classes

Q07 assigns the best applicable class using the versioned Unit 8 normalization
policy. Lower rank is better:

| Rank | Class | Exact v1 rule |
| --- | --- | --- |
| 0 | `canonical_edition_exact` | A server-resolved authoritative edition context equals the listing edition. No raw client-supplied canonical ID is trusted. |
| 1 | `isbn_exact` | A syntactically validated normalized ISBN-10/13 equals a validated public listing ISBN. |
| 2 | `original_title_author_exact` | The normalized query exactly equals an allowed deterministic title+author or author+title composition from authoritative originals. |
| 3 | `original_title_exact` | The normalized query exactly equals authoritative original title. |
| 4 | `original_author_exact` | The normalized query exactly equals one authoritative original author. |
| 5 | `active_title_variant_exact` | Exact normalized match to an active/search-eligible title variant for this store/listing. |
| 6 | `active_author_variant_exact` | Exact normalized match to an active/search-eligible author variant for this store/listing. |
| 7 | `original_terms_all` | Every normalized query term matches the versioned simple-token representation of authoritative original title/author fields. |
| 8 | `active_variant_terms_all` | Every normalized query term matches an active store-scoped variant representation for the same listing. |

`canonical_edition_exact` is reserved and unreachable in text-query v1. The v1
request has no authoritative server-resolved edition context, and raw
client-supplied canonical identifiers are never trusted. A later contract must
add and authenticate that context before rank 0 can be emitted.

Initial Unit 8 does **not** ship typo/edit-distance/trigram fuzzy matching. The
existing broad authority for bounded fuzzy relevance is deferred until a
separately versioned threshold, language evidence, query-plan proof, and cursor
contract are approved. Substring, similarity, provider score, or unversioned
full-text rank cannot silently create another class. This avoids nondeterministic
or language-unsafe ranking invention while retaining exact and all-term search.

### Exact store ranking tuple

For each store, Q08 first selects its matched title group by that group's best
match-class rank, then the same aggregate tie-breakers below, then the stable
internal title-group tie-breaker. Store groups are ordered lexicographically by:

```text
(
  matchClassRank ASC,
  bestAvailabilityRank ASC,
  offerCount DESC,
  localityRank ASC,
  fulfillmentRank ASC,
  lowestPriceMinor ASC,
  bestConditionRank ASC,
  publicStoreId ASC
)
```

The components are exact:

- `bestAvailabilityRank`: `available=0`, `low_stock=1`,
  `confirmation_required=2`, computed across qualifying offers. `unavailable`
  is ineligible, not a rank.
- `offerCount`: the selected title group's distinct qualifying offer count.
- `localityRank`: with explicitly bound context, exact locality `0`, same city
  `1`, same state `2`, other/unknown `3`, using only normalized safe public
  profile values. Without context every store receives `0`. No GPS/distance is
  introduced.
- `fulfillmentRank`: v1 pickup/delivery selections are hard eligibility filters.
  A surviving store receives `0`; an incompatible store is excluded. With no
  filter every store receives `0`. Soft fulfillment preference is deferred.
- `lowestPriceMinor`: the aggregate minimum in configured currency.
- `bestConditionRank`: `new=0`, `like_new=1`, `very_good=2`, `good=3`,
  `acceptable=4`, taking the best qualifying offer.
- `publicStoreId`: final stable ascending customer-safe tie-breaker sourced from
  the safe public-store-profile boundary.

Inventory freshness, wall-clock store-open state, distance, reliability,
popularity, sponsorship, and dynamic confirmation/cancellation rates are not v1
rank inputs. The public freshness/confirmation signal may still display where
allowed, but a time-decaying or insufficiently authoritative value cannot move
rows during a cursor traversal. Adding any deferred signal requires a new
ranking version and cursor contract.

## 10. Q08 cursor and pagination

Q08 uses opaque deterministic keyset pagination over store groups. The
integrity-protected cursor binds at least:

- contract and ranking versions;
- normalized query fingerprint;
- active filters;
- locale and optional locality/location ranking context;
- page size;
- relevant projection/policy version;
- the last complete stable ranking tuple; and
- final stable public store-ID tie-breaker.

Malformed/tampered, stale, query-mismatched, filter-mismatched, location-
mismatched, page-size-mismatched, ranking-version, projection/policy-version,
or contract-version cursors fail closed with the established bounded
`P9_CURSOR_INVALID` semantics. A rejected cursor never silently restarts at page
one and never reveals its signed payload or ranking internals.

Here, **opaque** means the customer cannot read or derive INTERNAL ONLY token
content. Signing/HMAC supplies integrity and authenticity, not confidentiality.
**Signing alone is insufficient when the serialized payload contains INTERNAL
ONLY information.** If a cursor serializes the raw ranking tuple, canonical or
grouping key, internal store key, private ID, or any other INTERNAL ONLY field,
it must also provide confidentiality. Valid alternatives are an opaque
server-side reference or a self-contained token containing only independently
customer-safe fields. This SDD does not freeze the token technology.

### Q08 live-data consistency

Q08 does not promise a database snapshot across independent RPC/HTTP requests.
Its no-skip/no-duplicate guarantee applies while the bound eligible store set
and all rank-affecting values remain unchanged. Contract, ranking, normalization,
or projection/policy version changes invalidate the cursor. Those versions do
not imply that ordinary price, condition, offer, publication, or safe-profile
row changes are detected.

Concurrent live changes may therefore alter a later page, including moving,
adding, or removing a group, and may cause a skip or duplicate relative to the
earlier traversal. The client may defensively deduplicate by public store ID but
must not treat that as snapshot continuity. Current ineligibility always wins:
an unavailable/retracted result disappears and cannot remain addressable or
purchasable merely to preserve pagination. No new global revision/epoch or
snapshot subsystem is authorized; a future stronger model requires evidence and
a separately versioned contract.

## 11. Q08-to-Q09 match context

Q08 issues a bounded opaque, versioned `matchContext` so this path preserves
what the customer searched for:

```text
book search -> bookstore card -> complete Q09 storefront
            -> matched public title group pinned/highlighted
```

The context binds the issuing contract/policy version, selected public store,
resolved title group, and expiry/freshness data needed for safe validation. It
contains no `inventoryId`, raw title text, linguistic alias, ranking score, or
reusable private/internal identity. It does not require canonical identity.

The same opacity rule as Q08 applies. If the resolved title-group key or another
INTERNAL ONLY value is serialized, confidentiality and integrity are both
required; signing/base64 encoding alone is insufficient. An opaque server-side
reference or independently customer-safe self-contained payload is also valid.

`matchContext` controls presentation only and never authorizes a listing, store,
cart, or private read. On an initial Q09 request without a page cursor:

- valid store + valid context: return the highlighted group under §12;
- valid store + malformed, stale, tampered, or wrong-store context: return the
  ordinary accessible storefront with no highlight and, optionally, one bounded
  “searched title no longer available” presentation; never reveal the internal
  validation reason;
- invalid/ineligible store: return the ordinary non-enumerating public
  unavailable/not-found result.

A tampered context gains no authority and discloses no token or grouping detail.
When a Q09 cursor is present, §12's context binding controls: a highlighted-mode
cursor cannot silently degrade into normal mode. The safe recovery is a fresh
cursorless Browse All request.

## 12. Q09 complete customer storefront

Q09 is distinct from Owner Store View. Its page unit is a **public title group**,
not a raw listing row:

```text
PublicStorefrontCatalogue {
  contractVersion
  storeProfile
  titleCount
  highlightedTitleGroup?  // separate from ordinary page stream
  titleGroups[] {
    safeTitlePresentation
    offers[] { listingId, public price/condition/damage/availability/fulfillment }
  }
  pageInfo { nextCursor }
}
```

Q09 returns the complete eligible catalogue across a stable cursor traversal.
`titleCount` is the server-derived total number of currently eligible title
groups, including a valid highlighted group exactly once. All offers for one
title group are nested under that group and are not arbitrarily split by raw-
offer page boundaries; independently addressable offers retain `listingId`.

### Highlighted title behavior

With valid cursorless `matchContext`, `highlightedTitleGroup` is emitted at most
once, only in the first response. It is separate from `titleGroups[]`, does not
consume a normal page slot, and is excluded from the ordinary cursor stream for
the entire highlighted traversal. It cannot reappear at its natural sort
position. `titleCount` still includes it once.

The ordinary stream uses a versioned lexicographic ordering tuple:

```text
(normalizedOriginalTitle ASC,
 normalizedPrimaryAuthor ASC,
 internalTitleGroupTieBreaker ASC)
```

Normalization here is an ordering representation, never group identity. Offers
within a group order by `(price ASC, condition-rank ASC, listingId ASC)`. Clear
Search removes `matchContext`, discards any highlighted-mode cursor, and starts
a fresh ordinary full-catalogue traversal in which the formerly highlighted
group appears once at its natural position.

### Q09 cursor contract

Q09 uses an opaque integrity-protected keyset cursor bound to:

- Q09 contract version;
- selected public store identity;
- catalogue ordering/normalization version;
- relevant projection/policy version;
- page size;
- highlighted-mode boolean and the identity fingerprint of `matchContext` when
  present;
- last complete title-group ordering tuple; and
- final deterministic internal title-group tie-breaker.

Malformed/tampered cursors, a different store or page size, changed ordering/
normalization or projection/policy version, incompatible contract version, or
adding/removing/changing `matchContext` fail closed with `P9_CURSOR_INVALID`.
A highlighted-mode cursor never silently becomes an ordinary cursor or vice
versa. The cursor follows §§10/11 confidentiality rules: if it serializes the
internal title-group tie-breaker or another INTERNAL ONLY value, signing alone
is insufficient.

Q09 has the same bounded live-data consistency model as Q08: no cross-request
snapshot is promised. Stable-set traversal is deterministic; concurrent title,
offer, price, condition, publication, or profile changes may alter later pages.
Newly ineligible content disappears immediately. A context becoming invalid
during a highlighted traversal invalidates that traversal cursor; the storefront
remains accessible through a fresh cursorless Browse All request.

## 13. Q10 public listing/detail contract

Q10 accepts a current `listingId`, reauthorizes current public eligibility, and
returns only allowlisted customer information:

- listing/public identity and safe public store profile;
- authoritative original title, authors, language, and permitted validated ISBN;
- approved bibliographic description/edition/volume/format fields;
- cover plus approved public actual-copy/damage gallery;
- public price/currency, condition, damage disclosure, and availability band;
- pickup/delivery, return policy, confirmation-before-payment messaging; and
- the existing compatible cart affordance.

A stale, paused, zero-stock, retracted, blocked, failed, or otherwise ineligible
`listingId` is not customer-addressable. It receives the same bounded public
unavailable/not-found behavior without revealing which eligibility check failed.

## 14. Multilingual and alias rules

Confirmed original metadata remains primary in Q07-Q10. Deterministic normalized
keys are implementation representations, not linguistic aliases. Only active,
search-eligible, store-scoped Unit 5C variants can match. Store A's variant never
activates or improves Store B. Inactive, rejected, stale, or experimental
variants do not match.

An alias match may cause Q08 to return the store, but display remains the
authoritative original title/author; an approved Roman form may be secondary.
Aliases establish neither canonical identity nor title grouping. Unit 8 enables
no language, benchmark, generation, activation, or rollout policy.

## 15. Public media contract

Current safe v2 listing DTOs provide cover and public-media count but not the
required gallery. Q10 therefore requires a forward allowlisted public-media
DTO/function. No customer code reads media tables or Storage objects directly.

Only Unit 7B/7C-approved, sanitized public-copy media may enter the DTO. The
display fallback is:

```text
approved provider/canonical cover
  -> approved public actual-copy media
  -> placeholder
```

Approved public damage evidence may appear when policy requires it. Private
scan media, request-photo media, staged/failed/raw media, object paths, bucket
enumeration, and persistent signed URLs are prohibited. Unit 8 requires no
Storage-policy redesign and does not adopt legacy unused public buckets.

## 16. Availability matrix

| State | Search | Q09 storefront | Q10 detail | Cart/order eligible |
| --- | --- | --- | --- | --- |
| live + available stock + all public gates pass | Yes | Yes | Yes | Yes, under existing downstream confirmation rules |
| post-live zero stock/unavailable, history retained by 7C | No | No | No | No |
| paused | No | No | No | No |
| private/retracted | No | No | No | No |
| publication failed, blocked, unsellable, invalid, or moderation-ineligible | No | No | No | No |

Retained history does not imply customer visibility. A stale `listingId`, cursor,
cache entry, or match context cannot bypass current availability.

## 17. Public DTO and privacy matrix

| Classification | Fields/examples |
| --- | --- |
| PUBLIC | current `listingId`; safe public store ID/profile; original title/authors/language; permitted validated ISBN/bibliographic fields; public price/currency; condition/damage disclosure; availability band; fulfillment; approved cover/gallery; return and confirmation messaging; formal counts. |
| CONDITIONAL PUBLIC | approved Roman secondary display; consented/context-bound locality or distance signal; approved damage evidence; provider-rights-compatible description; bounded freshness/confirmation signal. |
| INTERNAL ONLY | raw `store_id` grouping use; canonical/title-group keys by default; normalized search keys/documents; alias provenance/status; Q07 scores/reasons; ranking tuples/components; cursor/context payloads and signatures; projection/moderation policy internals. |
| PRIVATE OWNER DATA | `inventoryId`; exact total/available/reserved/sold/removed quantity; shelf/bin/location; acquisition cost/source; internal notes; Owner-only history/revisions beyond safe snapshots. |

Also prohibited in every customer response, cursor, context, error, event, log,
and analytics payload: worker/job state, extraction/vision state, raw provider or
model payload, private media and object paths, moderation/risk internals, seller
documents, payout data, credentials, capabilities, and SQL/internal errors.

## 18. Security invariants

1. Q08-Q10 expose only positive-allowlisted safe public DTOs/functions. Their
   hardened server implementation may perform only the secured internal joins
   permitted by §7; customers receive no direct relation access and no private
   inventory, raw listing/media-table, or private `stores` field.
2. Q07 is internal and not granted to `PUBLIC`, `anon`, or ordinary customer
   `authenticated` callers.
3. Every Q08/Q09 profile is resolved through `public_store_profiles` or an
   equally reviewed safe public-store-profile boundary.
4. Customer decoders recursively reject forbidden/private fields, especially
   `inventory_id`/`inventoryId`.
5. Current eligibility is checked at search, storefront, detail, and cart seams;
   possession of an identifier/context is never authorization.
6. Cache keys bind contract/ranking/projection policy and query context; private
   Owner/customer data never enters a shared public cache.
7. Cross-store aliases, contexts, listings, and cursor tampering fail closed.

Completed prerequisite: legacy
`phase9_storefront_catalogue(uuid,integer,jsonb)` and
`phase9_listing_detail(uuid)` return the unsafe projection-row shape but have no
`PUBLIC`, `anon`, or `authenticated` `EXECUTE`; trusted `service_role` access is
retained. Current `phase9_public_listing_search_v2` and
`phase9_public_listing_detail_v2` remain customer-callable allowlisted JSON and
do not expose `inventory_id`. Unit 8 must not restore a customer legacy path.

## 19. Error and failure semantics

- Invalid Q08/Q09 cursor: fail closed with `P9_CURSOR_INVALID`; no silent reset.
- On a cursorless request to a valid store, invalid/wrong-store/stale/tampered
  `matchContext` degrades to the ordinary storefront with no highlight and no
  internal reason. With a highlighted-mode cursor it invalidates that traversal;
  recovery is a fresh cursorless Browse All request. It never grants authority.
- Ineligible or unknown store/listing/group: non-enumerating public unavailable
  or not-found result; no policy reason or historical state leak.
- Projection/policy/ranking/ordering version change during traversal: reject the
  stale cursor and require a fresh traversal. Ordinary live row changes follow
  §§10/12's explicitly weaker no-snapshot model.
- Q07 or repository failure: Q08 returns the established bounded public service
  failure; no partial raw matches or ungrouped fallback page.
- Safe profile/media resolution failure: omit only an explicitly optional field
  when the contract permits; otherwise fail the affected result safely. Never
  fall back to private tables, paths, or fields.
- Unknown response fields or forbidden identities: customer decoder rejects the
  contract rather than rendering them.

Any new stable public error code requires the normal contract-register review;
this SDD does not silently invent one.

## 20. Acceptance and proof matrix

| Area | Eventual proof required |
| --- | --- |
| Search | ISBN, original title, author, and original-script queries match; active Store A alias matches only Store A; inactive/rejected/stale alias does not match; nullable-canonical eligible listing remains discoverable. |
| Grouping | Each bookstore appears once; multiple qualifying listings produce exact distinct `offer_count`; quantity does not multiply offers; inventory rows are not merged; title/author/fuzzy text never merges identity; grouping demonstrably precedes pagination. |
| Offer truth | `lowestPriceMinor`, condition range/set, damage booleans, fulfillment counts, and best availability are independently verified over the same qualifying offer set; no scalar condition/damage claim is borrowed from another offer; actual-copy fallback uses only the deterministic representative offer. |
| Q08 pagination | With an unchanged eligible/rank set, multi-page traversal has no skipped/duplicate stores and tied ranking follows the exact tuple; query/filter/location/page-size/version cursor mismatches and tampering fail closed. Concurrent live changes are tested against the documented no-snapshot behavior. |
| Counts | `bookstore_count`, per-store/per-title `offer_count`, and Q09 `title_count` match independent eligible-set calculations; none equals private quantity or a page-array length by accident. |
| Q09 storefront | Stable traversal returns every eligible public title group; pagination is by group; offers remain nested/addressable; the separate highlighted group appears once, consumes no ordinary slot, is excluded from that cursor stream, and remains included once in `titleCount`; Clear Search starts ordinary pagination. |
| Availability | Live+stock is searchable/addressable; post-live zero stock remains retained operationally but is absent from Q08-Q10/cart; paused/private/failed/blocked/unsellable states are absent; stale IDs cannot bypass. |
| Media | Provider cover first; approved actual-copy fallback/gallery; placeholder when none; approved damage evidence only; every publicly eligible link has a unique non-null `public_order` in `1..3`; Q10 orders by `public_order,id` and returns at most three; private/unapproved scan/request/raw/path data cannot leak. |
| Privacy | Recursive DTO/cursor/context/error checks prove no `inventoryId`, exact stock buckets, shelf/acquisition/internal notes, worker/extraction/moderation internals, private media, or object paths. Direct private table/view and legacy-RPC customer calls remain denied. |
| Store profile | Every Q08/Q09/Q10 store field is traceable to the safe public profile boundary; no private `stores` fallback. |
| Navigation | Search -> one bookstore card with matched context -> complete storefront with highlighted group -> independently addressable Q10 offer/detail -> existing cart/order-request seams remain compatible. |
| Concurrency/freshness | Contract/policy/order version changes invalidate cursors; ordinary live rank/set changes do not claim snapshot continuity; newly unavailable content disappears immediately and cannot remain detail/cart eligible. |
| Compatibility | Existing safe v2 search/detail remains green until cutover; legacy unsafe RPCs stay customer-denied; no private table/view grant broadens. |

Proof must include deterministic unit/contract tests, disposable real-PostgreSQL
query/security tests, explicit `anon` and customer-authenticated denial/allow
checks, client integration/navigation tests, and a separately authorized
connected closure. Fixtures must not mutate shared business data unless that
future proof is explicitly authorized.

### U8C-2 client/mobile acceptance

- A slower request A cannot overwrite newer request B; query identity/generation
  fencing or cancellation makes the latest bound request authoritative.
- Search input is bounded and debounced under the project standard; an aborted
  or stale request cannot render results or emit no-result telemetry.
- Loading, bounded empty/no-result, error, and retry states are explicit and do
  not reuse stale results as though current.
- Strict client schemas reject malformed DTOs, unknown fields, and every
  forbidden/private field. The UI never renders unknown response properties.
- Provider cover, deterministic approved actual-copy fallback, gallery, and
  placeholder behavior match §§8/15.
- Bookstore-first results, storefront highlight/Clear Search, detail, and back
  navigation preserve the correct query/store/context state; returning from
  detail cannot resurrect a stale search response.
- Narrow mobile layouts remain usable; actionable controls meet current project
  touch-target and accessibility-label requirements; larger text/Dynamic Type
  does not hide identity, offer, disclosure, navigation, or retry controls.
- Existing single-store cart/order-request compatibility remains unchanged; the
  client cannot use a stale `listingId` to bypass current Q10/cart eligibility.

## 21. Explicit non-goals

Unit 8 excludes inventory commit/dedup redesign; Owner inventory management;
publication/retraction redesign; metadata or vision pipeline changes; variant
proposal generation or language rollout; stock mutation; payments, settlement,
commission/payouts, promotion, sponsored ranking, customer reliability scores,
map-first/GPS-required discovery, full order-lifecycle redesign, and Unit 9
request-photo workflow. It creates no new canonical truth or business table by
default.

## 22. Implementation work-unit handoff

The current implementation hypothesis is forward-versioned Q07/Q08/Q09/Q10
functions/contracts plus strict safe DTOs. No new business table/data model is
currently justified. Add indexes only when exact query-plan evidence identifies
a need. Do not mutate the safe v2 contracts in place merely to reuse names.

Before database design or any Unit 8 migration application, a separately
authorized session must reverify the exact project and current objects, and the
parked local/live migration-history mismatch must be reconciled safely. Migration
creation and application remain separate authorities.

Frozen later split, requiring separate authorization for each gate:

- **U8B — bookstore-first discovery backend:** Q07/Q08, safe public eligibility,
  exact match classes, grouping, counts, aggregate offer summary, ranking, Q08
  cursor/confidentiality, safe DTO, and backend/security contract tests.
- **U8C-1 — storefront/detail backend:** Q09 title-group catalogue and cursor,
  separate highlighted-title behavior, `matchContext`, Q10 detail, allowlisted
  public-media DTO, and backend/security tests.
- **U8C-2 — customer Marketplace integration:** strict schemas/types,
  bookstore-first results, storefront state, highlight/Clear Search,
  detail/gallery, existing cart/order-request compatibility, and mobile,
  accessibility, request-race, navigation tests.
- **U8D — adversarial and connected proof:** privacy, aliases, identity/counts,
  pagination, availability, media, navigation, grants, and connected closure.

### Final load-bearing ambiguity challenge

The precision review found no additional unresolved technical contract ambiguity
that would materially change privacy, identity/cardinality, offer truthfulness,
grouping/counts, cursor behavior, store-scoped aliases, Q08-to-Q09 navigation,
or the U8B/U8C backend boundary.

**NONE.**

The original design freeze ended before U8B. The bounded U8B corrective scope is
locally complete and pending independent re-review; migration-history
reconciliation, dedicated Q08 Vault provisioning, live Supabase verification,
M49 application, and U8C remain separately authorized gates.
