# DOC-4: Image-to-LLM Inventory Workflow

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
**Status:** Approved Phase 9 planning source; corrected WU0 approved
**Depends On:** DOC-1, DOC-2, DOC-3
**Owns:** Image capture, model extraction, metadata enrichment, owner review, duplicate choice, inventory commit, quota/cost, recovery, and scan retention.

---

## 1. Purpose

This document defines BookConnect's AI-assisted bookstore inventory ingestion workflow. A Store Owner photographs a same-language stack of book spines, BookConnect extracts and enriches candidates through provider-agnostic adapters, and the owner reviews price, quantity, condition, location, damage, and publication before any inventory write.

This is a deterministic, human-in-the-loop pipeline—not an autonomous agent. The vision model has no database, storage, metadata-provider, or tool authority.

Detailed implementation planning lives in [`implementation/phase-9-image-inventory/`](./implementation/phase-9-image-inventory/README.md).

---

## 2. Locked workflow

```text
Owner starts simple session and selects defaults/language
  -> captures or uploads one same-language image (maximum 15 spines)
  -> private server boundary validates, re-encodes, strips EXIF, quality-checks
  -> primary vision adapter extracts title/author/optional ISBN clue
  -> at most one whole-image fallback for technical/schema/broad failure
  -> local canonical lookup, then configured primary/secondary metadata adapters
  -> selected coherent metadata and up to three generated English aliases are staged; bounded official/verified aliases may coexist
  -> same-store advisory duplicate check
  -> owner reviews/corrects required fields
  -> each candidate independently creates/increments private inventory
  -> eligible reviewed candidates project publicly
  -> owner closes session and sees summary
  -> lifecycle worker deletes scan/raw/staged data by policy
```

---

## 3. Capture contract

Phase 9 first slice is `spine_stack`.

- Camera capture and gallery/manual upload are both supported.
- One image contains 1-15 visible book spines.
- More than 15 detected spines causes reject/rescan; do not silently truncate.
- Multiple images may be processed in one session.
- One visible spine is one candidate; repeated spines remain repeated.
- A framing guide and blur/glare/resolution/decodability check should reject poor images before model cost.
- Exact image hash may prevent replay/double charging but is never duplicate-book evidence.

`single_cover` may be added later as a compatible capture input but is not the first Phase 9 slice. High-volume `shelf_batch` is deferred.

---

## 4. Language behavior

- Owner selects one language for an image/batch; English is the default.
- If another language is selected, the adapter receives that language/script context.
- Mixed-language automatic routing is excluded.
- Candidates inconsistent with the selected language are skipped/reported rather than sent through per-spine model selection.
- Original-script title/author remain authoritative.
- Each automated generation operation proposes at most three English search aliases after metadata selection: transliteration, translation, and common spelling/recognized title. Additional provider-recognized official or Owner/platform-verified aliases may be retained within configured abuse/storage limits.
- Author names are transliterated, not semantically translated.
- Aliases are search-only and never canonical/duplicate evidence.
- The adapter/schema supports additional languages later without changing identity rules or translating the whole app UI.

---

## 5. Simple session

User-visible controls are Start session and Close session with summary. There is no pause/save/discard state.

Before Start, preselect:

- language;
- base condition;
- shelf/location;
- quantity 1;
- Save private or Publish after review.

First-session publication defaults private; a prior explicit preference may be reused. Server persistence recovers from backgrounding/network/app closure. The initiating Owner may mutate/resume the session during the Owner-only pilot; support intervention is separately authorized and audited. Close succeeds only after every submitted input is ready, failed, or skipped. A short internal `closing` transition seals new inputs and finalizes the summary, but Close while processing leaves the session active with an actionable message. Logout clears local cached state.

---

## 6. Vision adapter

The model receives only:

- sanitized image;
- selected language/script;
- maximum candidate count 15;
- strict task/schema version;
- opaque correlation ID.

It does not receive store/customer PII, shelf location, database IDs, credentials, signed URLs, or tools.

Expected output:

- ordered candidate index/optional bounding box;
- observed original-script title;
- observed original-script author(s);
- optional visible ISBN clue;
- selected/detected language/script;
- bounded confidence/warnings;
- image outcome such as accepted, empty, wrong language, over cap, or quality failure.

All output is untrusted, length/count/schema validated, and rendered as plain text. Model-provided commands, URLs, paths, SQL, or active markup are rejected.

---

## 7. Primary and fallback

- Vision providers are adapters selected by configuration.
- Use one primary and at most one whole-image fallback.
- Fallback is allowed for transient technical failure, invalid schema, or broadly unusable output.
- Do not invoke fallback per candidate.
- Do not invoke fallback for valid empty/no-book, over-cap, wrong selected language, invalid upload, or policy denial.
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
- duplicate action when warned;
- private/publish action.

Extended bibliographic/acquisition fields are collapsed. Owner may add a missed candidate, remove a false candidate, correct metadata/aliases, and preview the future marketplace card.

Conditions are New, Like New, Very Good, Good, and Acceptable, with an accessible explanation for all except New. Damage is separate. A sellable damaged copy requires a public note, damage types, and 1-3 approved actual-copy photos; an unsafe/incomplete/unreadable copy remains private.

---

## 10. Duplicate choice

Duplicate detection is same-store, advisory, and recomputed during commit.

Recommend quantity increment only for the same validated edition/ISBN, language, format, condition, and price with no copy-specific damage, notes, collectible distinction, or approved public actual-copy/damage photo. Private customer-request photos are later request-scoped evidence and never affect duplicate identity. Otherwise recommend a separate row. No ISBN + strong original title/author/language match is an explicit owner decision, not an auto-merge. Aliases and image/photo similarity are excluded.

Different stores always remain separate inventory/offers.

---

## 11. Controlled candidate commit

Every candidate commit:

- re-authorizes authenticated Owner and server-derived `store_id`;
- validates candidate/expected version and review fields;
- recomputes duplicates under a transaction/row lock;
- performs explicit create, quantity increment, manual match, separate row, or skip;
- preserves `quantity_total = available + reserved + sold + removed` and active holds;
- writes bounded audit/event evidence and idempotent outcome;
- updates/retracts eligible public projection;
- never lets one candidate failure block other candidates.

A valid private inventory commit survives public-projection failure. The result is `committed_publication_failed`; inventory remains private, and an idempotent publication-retry command may create the projection without creating or incrementing inventory again.

Mobile does not insert model output directly. Post-push price, quantity, condition, damage, location, notes, photos, and visibility remain editable through controlled commands; store edits do not mutate shared canonical truth.

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

`store_id` is the tenant discriminator. The exact current-vs-target audit and field dictionary are in the Phase 9 supporting set. No migration exists yet.

---

## 15. Acceptance criteria

| ID | Criterion |
| --- | --- |
| IMG-01 | Only an active authorized Owner can start/operate a session for the server-derived store. |
| IMG-02 | Camera/gallery same-language spine images process 1-15 candidates. |
| IMG-03 | More than 15 rejects/rescans and never truncates. |
| IMG-04 | One primary and at most one whole-image fallback use a strict schema and no tools. |
| IMG-05 | Local-first, primary/secondary metadata enrichment is provider-agnostic and coherent. |
| IMG-06 | Original-script data remains authoritative; automated generation proposes at most three English aliases while bounded official/verified aliases remain provenance-bearing and search-only. |
| IMG-07 | Owner review confirms required inventory fields before every create/increment. |
| IMG-08 | Duplicate warnings are advisory, explicit, same-store, concurrency-safe, and contain no image comparison. |
| IMG-09 | Each candidate commit is atomic/idempotent and preserves Phase 6 quantities/holds. |
| IMG-10 | Failed candidates do not block successful candidates. |
| IMG-11 | Five conditions, separate damage, and required damaged-copy evidence are enforced. |
| IMG-12 | Store-scoped quota/cost/replay/fallback telemetry and manual fallback work. |
| IMG-13 | Session recovery and Start/Close summary work without complex visible states. |
| IMG-14 | Scan/raw/staged data follows private access and retention/deletion rules. |
| IMG-15 | No Phase 7/8 payment/paid-order/pickup/refund/ledger/settlement behavior is introduced. |
| IMG-16 | Only the initiating Owner mutates/resumes a pilot session; terminal-input Close uses an internal race-safe finalization state. |
| IMG-17 | Publication failure preserves one private inventory effect and retries only publication idempotently. |
| IMG-18 | Provider field reuse rights are enforced separately from provenance. |
| IMG-19 | Private customer-request photos never affect duplicate identity or quantity compatibility. |

---

## 16. Deferred

- high-volume shelf batch;
- mixed-language/per-spine routing;
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
