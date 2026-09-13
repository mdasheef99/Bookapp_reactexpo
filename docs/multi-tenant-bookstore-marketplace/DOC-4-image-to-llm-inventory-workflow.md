# DOC-4: Image-to-LLM Inventory Workflow

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
**Status:** Approved Phase 9 planning source; corrected WU0 approved
**Depends On:** DOC-1, DOC-2, DOC-3
**Owns:** Image capture, model extraction, metadata enrichment, owner review, create-only scanned-candidate inventory commit, quota/cost, recovery, and scan retention.

---

## 1. Purpose

This document defines BookConnect's AI-assisted bookstore inventory ingestion
workflow. A Store Owner photographs a stack of at most 15 book spines,
BookConnect extracts and enriches candidates through provider-agnostic adapters,
and the owner reviews price, quantity, condition, location, damage, and
publication before any inventory write.

This is a deterministic, human-in-the-loop pipeline—not an autonomous agent. The vision model has no database, storage, metadata-provider, or tool authority.

Detailed implementation planning lives in [`implementation/phase-9-image-inventory/`](./implementation/phase-9-image-inventory/README.md).

---

## 2. Locked workflow

```text
Owner starts simple session and selects defaults; language hint is optional
  -> captures or uploads one image (maximum 15 spines)
  -> private server boundary validates, re-encodes, strips EXIF, quality-checks
  -> primary vision adapter extracts original title/author and field language/script
  -> compact optional Romanization/translation fields are validated independently
  -> at most one whole-image fallback for technical/schema/broad failure
  -> local canonical lookup, then configured primary/secondary metadata adapters
  -> coherent metadata or Owner-confirmed unmatched data confirms source fields
  -> Unit 5C validates/reconciles variants; only active store-scoped forms search
  -> owner reviews/corrects required fields
  -> explicit Add to Inventory creates one new private row per candidate
  -> publication is a separate Unit 7B operation
  -> owner closes session and sees summary
  -> lifecycle worker deletes scan/raw/staged data by policy
```

---

## 3. Capture contract

Phase 9 first slice is `spine_stack`.

- Camera capture and gallery/manual upload are both supported.
- One image contains 1-15 visible book spines.
- More than 15 detected spines causes reject/rescan; do not silently truncate.
- A session has one current image. The Owner may explicitly remove it only
  before it has candidate lineage, then choose one replacement image.
- Removal is logical and cancels only that input's active processing. It never
  cascades into candidates, inventory, or listings; private media deletion stays
  hold-aware lifecycle work.
- One visible spine is one candidate; repeated spines remain repeated.
- A framing guide and blur/glare/resolution/decodability check should reject poor images before model cost.
- Exact image hash may prevent replay/double charging but is never duplicate-book evidence.

`single_cover` may be added later as a compatible capture input but is not the first Phase 9 slice. High-volume `shelf_batch` is deferred.

---

## 4. Language behavior

The current runtime treats the session-selected language as a non-authoritative
hint. It retains mixed-language observations, maps provider null language to
canonical `und`, and creates candidates for titled observations whose detected
language is not `und`.

The governing Unit 5C behavior is:

- auto-detection is the default; scan/store language values are optional hints;
- hints never force every spine or field into one language;
- title and each author retain independent BCP 47 language and ISO 15924 script;
- confirmed original-language title/author remain primary;
- title and author confirmation and variant activation are independent;
- `p9-vision-v2` remains the strict persisted result while compact optional
  Romanization/translation fields map into the existing private proposal model;
- deterministic search keys are not linguistic variants;
- only active store-scoped variants search, never define identity/duplicates;
- transliteration, plain Roman search spelling, and translation remain distinct;
- no application translation, new language-settings UI, or per-spine model
  switching is authorized here.

---

## 5. Simple session

User-visible controls are Start session and Close session with summary. There is no pause/save/discard state.

Before Start, preselect:

- optional language hint;
- base condition;
- shelf/location;
- quantity 1;
- Save private or Publish after review.

First-session publication defaults private; a prior explicit preference may be reused. Server persistence recovers from backgrounding/network/app closure. The initiating Owner may mutate/resume the session during the Owner-only pilot; support intervention is separately authorized and audited. Close succeeds only after every submitted input is ready, failed, or skipped. A short internal `closing` transition seals new inputs and finalizes the summary, but Close while processing leaves the session active with an actionable message. Logout clears local cached state.

The proposed Unit 6G specialization makes location required; preselects English
as a non-authoritative language hint; makes condition and selling-price defaults
optional; fixes quantity at 1 before scan; uses fixed INR/whole-rupee UI over
integer minor-unit storage; and adds an optional durable session-only batch
label. Currency, paise, and script are not setup controls. Remember-last-used
settings and named presets remain deferred.

---

## 6. Vision adapter

The model receives only:

- sanitized image;
- optional language hint;
- maximum candidate count 15;
- strict task/schema version;
- opaque correlation ID.

It does not receive store/customer PII, shelf location, database IDs, credentials, signed URLs, or tools.

Expected output:

- ordered candidate index;
- observed original-language title;
- up to five observed original-language author guesses;
- optional visible ISBN clue;
- detected candidate language;
- optional compact title Romanization, English title translation, and
  positionally aligned author Romanizations;
- bounded confidence;
- image outcome such as analyzed, empty, over cap, or quality failure.

Gemini receives JSON MIME mode and the flat compact prompt, not a provider-side
response schema. BookConnect performs strict local decoding, adds canonical
provenance plus null geometry/closed warnings, and maps usable enrichment into
the existing M18/M19 persistence contract.

All output is untrusted, length/count/schema validated, and rendered as plain text. Model-provided commands, URLs, paths, SQL, or active markup are rejected.

---

## 7. Primary and fallback

- Vision providers are adapters selected by configuration.
- Use one primary and at most one whole-image fallback.
- Fallback is allowed for transient technical failure, invalid schema, or broadly unusable output.
- Do not invoke fallback per candidate.
- Do not invoke fallback for valid empty/no-book, over-cap, invalid upload,
  policy denial, or missing/invalid optional enrichment.
- Manual correction remains the final fallback.

Model/provider/prompt/schema versions, latency, error class, fallback, and cost units are observable without storing raw content in telemetry.

---

## 8. Metadata enrichment

Metadata routing is deterministic and provider-neutral. Local canonical/cache resolution runs first. Exactly one primary and zero or one secondary metadata adapter are configuration-driven; one logical lookup permits at most one external attempt in each role, sequentially. A coherent acceptable primary result prevents secondary invocation. Secondary eligibility is based on a closed normalized outcome allowlist, not provider prose. No provider is canonical authority and fields from different provider editions are never stitched.

Each attempt preserves provider-independent query identity, role, sequence, adapter/capability/schema/normalizer versions, routing-policy version, normalized outcome, cache status, latency, cost-reservation lineage, and accepted/rejected disposition. Provider/version cache namespaces prevent results from silently crossing adapter or normalization changes. Equivalent non-sensitive bibliographic lookups may be coalesced only when privacy, licensing, adapter/version, and policy scope match.

Provider failure, open circuits, exhausted external-call capacity, or both-provider ambiguity leaves the candidate available for Owner/manual review. Manual entry is not an external-provider fallback call and remains available under global/provider kill switches.

### 8.1 Horizontally safe execution

Worker correctness does not depend on process-local authority. Durable queues, database leases, attempt numbers, idempotency, and fencing remain authoritative when multiple replicas claim work. Scaling cannot alter authorization, candidate, canonical, inventory, publication, or retry semantics.

A terminating worker stops claiming new work and completes, renews, or safely releases active leases. Stale completion is rejected. Exactly-once external API invocation is not promised: provider request identity, attempt identity, reservation lineage, and accepted completion must instead support at-most-one accepted state transition and detection/reconciliation of duplicate external spend.

Admission is bounded by stage/provider concurrency, provider quota, database connection budget, and store/provider/global cost ceilings. Exhaustion leaves work durably queued or retry-scheduled without retry storms; an open provider circuit cannot create scale-up traffic. Claim batch size and process concurrency are configurable, and maximum replicas must respect connection-pool capacity.

Media sanitation, vision analysis, and metadata enrichment may scale independently because their limiting resources differ. Automatic scaling remains disabled until fixed multi-replica verification proves simultaneous claims, fencing, graceful shutdown, timeout/retry behavior, cost reconciliation, connection safety, per-store fairness, and meaningful throughput improvement. Replica limits, thresholds, cooldowns, connection sizes, concurrency values, cost ceilings, and per-store active-job limits are operational configuration, not product constants.

Lookup order:

1. Validate visible ISBN clue when present.
2. Local canonical ISBN match.
3. Local exact original title + author + language match.
4. Configured primary metadata adapter.
5. Configured secondary adapter if policy permits.
6. Manual/unmatched owner completion.

Metadata includes:

- title/subtitle/authors/description;
- validated ISBN-10 and ISBN-13;
- publisher/date/language;
- edition/volume/format/binding;
- page count/categories/cover;
- provider ID, match strength/rationale, source and adapter/schema version.

Select one coherent edition response; do not silently stitch conflicting provider editions. Raw/normalized provider attempts are private and retained only by policy. Provider normalization separately records whether each field is matching-only, storable, publicly displayable, image-cacheable, attribution-bearing, or expiry/revalidation-bound. Provider names and retry/quota values remain configuration, not UI/schema assumptions.

---

## 9. Owner review

Mandatory minimal fields:

- title;
- author(s) or bounded unknown marker;
- language;
- quantity;
- selling price;
- base condition;
- shelf/location;
- damage yes/no;
- private/publish action.

Extended bibliographic/acquisition fields are collapsed. Owner may add a missed candidate, remove a false candidate, correct metadata/aliases, and preview the future marketplace card.

The proposed Unit 6G review surface is one bounded session page with at most 15
compact cards. Every card shows the final review values, source/default markers,
a bounded metadata sheet, general Remove, and Add. Notes and Choose another
match are absent from this UI. Per-card Add and Add all ready books explicitly
confirm the displayed values, perform strict canonical Save, and only then call
the existing independent Unit 7A commit. Bulk partial success is expected; no
automatic or session-atomic commit is introduced.

Conditions are New, Like New, Very Good, Good, and Acceptable, with an accessible explanation for all except New. Damage is separate. A sellable damaged copy requires a public note, damage types, and 1-3 approved actual-copy photos; an unsafe/incomplete/unreadable copy remains private.

---

## 10. Create-only scanned-candidate identity

**2026-08-12 Owner decision:** Unit 7A contains no duplicate lookup, choice,
target, compatibility check, merge, manual match, keep-separate action, or
existing-inventory increment. Every successfully reviewed candidate explicitly
committed by the Owner creates one new private inventory row. Repeated candidates
for the same title, edition, or ISBN remain separate inventory identities.

Existing Unit 6 duplicate-choice DTO/UI values and older database machinery are
**SUPERSEDED FOR UNIT 7A** and deferred/legacy. They must not be presented as
actionable 7A choices or silently ignored by the future commit boundary.

Different stores always remain separate inventory/offers.

---

## 11. Controlled candidate commit

Every candidate commit:

- re-authorizes authenticated Owner and server-derived `store_id`;
- validates candidate, saved review, and metadata versions under a candidate lock;
- loads all business fields, including reviewed quantity, from the authoritative
  server-held saved review;
- creates exactly one new private inventory row and never targets an existing row;
- initializes total/available to reviewed quantity and reserved/sold/removed to zero;
- preserves `quantity_total = available + reserved + sold + removed`;
- writes bounded audit/event evidence and idempotent outcome;
- records durable one-candidate-to-one-inventory provenance;
- never lets one candidate failure block other candidates.

Unit 7A creates private inventory only. Unit 7B separately owns publication,
public projection/media, and idempotent publication failure/retry.

Mobile does not insert model output directly. Post-push price, quantity, condition, damage, location, notes, photos, and visibility remain editable through controlled commands; store edits do not mutate shared canonical truth.

One deliberate top-level Owner action may orchestrate several candidate commits
only when each candidate independently passes the same saved-review, version,
readiness, authorization, transaction, and idempotency gates. Publication intent
is provenance only at this boundary; every Unit 7A result remains private.

---

## 12. Quota, cost, and persistent work

- Quota belongs to `store_id`.
- Check before external-cost work.
- Exact replay/cache does not double-charge.
- Use persistent leased jobs with bounded retries, backoff/jitter, typed failures, dead-letter/escalation, and crash recovery.
- Use positive/negative metadata cache and provider circuit breakers.
- Platform can disable provider, language, store, or all extraction.
- Manual entry remains available when extraction is disabled or exhausted.
- Numerical quotas/timeouts/retry counts are policy-configurable; fixed product caps are 15 books/image and one vision fallback.

---

## 13. Privacy and retention

- Scan images are private and never public listing/request photos.
- Validate signature/decode/limits, re-encode, and strip EXIF/GPS before model egress.
- Raw images/payloads/prompts/signed URLs do not enter logs, Sentry, analytics, events, or notifications.
- Vendor DPA/no-training-use/cross-border review is required before production.
- Failed/unattached upload: 24 hours.
- Scan image: delete within 24 hours after session close.
- Raw model/provider payload persistence: disabled by default. Separately approved,
  purpose-bound diagnostic capture must be deleted within 7 days; normalized
  provenance/evidence is the ordinary retained path.
- Unresolved normalized candidate: 30 days.
- Lifecycle deletion, holds, orphan cleanup, and deletion evidence are server-owned.

Detailed rules: [Phase 9 SDD 04](./implementation/phase-9-image-inventory/04-media-security-privacy-sdd.md).

---

## 14. Data model implications

Required concepts:

- extraction sessions, inputs, candidates, jobs, and metadata attempts;
- source/version-bearing search aliases;
- richer canonical/store/listing metadata;
- five base conditions plus structured damage;
- typed media assets and inventory/request links;
- commit idempotency/version/audit/provenance;
- lifecycle/retention/hold/deletion fields.

`store_id` is the tenant discriminator. The exact current-vs-target audit and
field dictionary are in the Phase 9 supporting set. M01-M35 are applied at their
recorded live versions; M36 remains local and unapplied.

---

## 15. Acceptance criteria

| ID | Criterion |
| --- | --- |
| IMG-01 | Only an active authorized Owner can start/operate a session for the server-derived store. |
| IMG-02 | Camera/gallery spine images process 1–15 candidates; language hints never reject or force detected identity fields. |
| IMG-03 | More than 15 rejects/rescans and never truncates. |
| IMG-04 | One primary and at most one whole-image fallback use a strict schema and no tools. |
| IMG-05 | Local-first, primary/secondary metadata enrichment is provider-agnostic and coherent. |
| IMG-06 | Confirmed original-language fields remain primary; compact optional enrichment is bounded, field-reconciled, store-scoped, provenance-bearing, and active-only for search. |
| IMG-07 | Owner review confirms required inventory fields before every create-only scanned-candidate commit. |
| IMG-08 | Unit 7A performs no duplicate lookup, merge, target selection, manual match, or existing-row increment. |
| IMG-09 | Each candidate commit is atomic/idempotent and preserves Phase 6 quantities/holds. |
| IMG-10 | Failed candidates do not block successful candidates. |
| IMG-11 | Five conditions, separate damage, and required damaged-copy evidence are enforced. |
| IMG-12 | Store-scoped quota/cost/replay/fallback telemetry and manual fallback work. |
| IMG-13 | Session recovery and Start/Close summary work without complex visible states. |
| IMG-14 | Scan/raw/staged data follows private access and retention/deletion rules. |
| IMG-15 | No Phase 7/8 payment/paid-order/pickup/refund/ledger/settlement behavior is introduced. |
| IMG-16 | Only the initiating Owner mutates/resumes a pilot session; terminal-input Close uses an internal race-safe finalization state. |
| IMG-17 | Unit 7A ends with one private inventory effect; Unit 7B retries only publication idempotently. |
| IMG-18 | Provider field reuse rights are enforced separately from provenance. |
| IMG-19 | Private customer-request photos and scan media never become public listing media through Unit 7A. |
| IMG-20 | Pre-scan location is required; optional condition/price and session-only batch label reduce repeated entry without changing detected identity or inventory authority. |
| IMG-21 | One bounded page presents all candidate review values compactly and keeps full metadata on demand rather than mounting expanded forms. |
| IMG-22 | Per-card and bulk Add always persist and revalidate each candidate before its independent create-only commit; partial success cannot become an atomic or automatic batch effect. |
| IMG-23 | General Owner removal is persisted separately from false detection/input removal and cannot delete evidence, inventory, listings, or audit history. |

---

## 16. Deferred

- high-volume shelf batch;
- per-spine model routing;
- image similarity duplicates;
- auto-publish without owner review;
- manager/staff concurrent scanning;
- continuous canonical refresh;
- app-wide translation;
- promotion/discount engine.

---

## 17. Related documents

- [DOC-1](./DOC-1-identity-security-compliance.md)
- [DOC-3](./DOC-3-canonical-books-metadata-inventory.md)
- [DOC-5](./DOC-5-consumer-marketplace-discovery.md)
- [DOC-8](./DOC-8-store-owner-console.md)
- [Phase 9 planning set](./implementation/phase-9-image-inventory/README.md)
