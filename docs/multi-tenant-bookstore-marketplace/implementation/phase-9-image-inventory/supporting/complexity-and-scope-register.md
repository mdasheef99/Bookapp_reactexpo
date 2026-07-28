# Phase 9 Complexity and Scope Register

**Last updated:** 2026-07-29

## Complexity outcome

The workflow is substantial but bounded. It is not an autonomous agent: deterministic code owns every transition, provider call, retry, authorization check, and write. The AI component has one narrow task—extract observed book identity clues into a strict schema. This containment removes the largest avoidable complexity and security multipliers.

## Complexity reductions adopted

| Area | Potential complexity | Containment decision | Result |
| --- | --- | --- | --- |
| Capture | Covers, shelves, mixed orientations, arbitrary book count | Spine stack only; maximum 15; reject/rescan above cap | bounded image contract |
| Languages | Detection quality and mixed fields | Auto-detect fields with optional hints; no per-spine model switching; reversible language gates | mixed-script support without routing fleet |
| Vision failover | Per-book ensemble/model voting | One primary and at most one whole-image fallback | bounded cost/latency |
| Metadata | Parallel ensemble and field-level merging | Local first, then sequential primary/secondary; select one coherent edition | predictable provenance |
| Variants | Full multilingual catalogue localization | Optional sidecar; one primary Roman form, up to two alternatives, separate inactive translation; field reconciliation and store scope | search value without global authority or UI translation |
| Duplicates | Image matching, auto-merge, cross-store reconciliation | Same-store advisory warning; deterministic identity/variant rules; explicit owner choice | low irreversible-risk surface |
| Repeated spines | Attempt to infer physical identity | One visible spine remains one candidate | owner controls quantity/rows |
| Sessions | Pause/resume/save/discard/branching state machine | Start, add images, Close with summary; invisible persistence only | simple mental model |
| Review | Full metadata form for every item | Defaults, required-field highlighting, collapsed optional details, partial commits | low data-entry burden |
| Conditions | Damage embedded as condition ladder | Five standard conditions plus separate damage disclosure | clearer customer semantics |
| Photos | Reuse any image everywhere | Purpose-specific scan/public/request classes | clearer access and retention |
| Marketplace | DB merge of duplicate stock rows | Group visually/query-time by edition and store | no destructive ownership merge |
| Customer photos | New order state machine | Orthogonal item photo state plus existing customer-decision gate | reuses Phase 6 seam |

## High-benefit, low-complexity inclusions

- capture framing guide and blur/glare/resolution gate;
- exact-image hash replay/double-charge prevention;
- strict versioned model/provider schemas;
- local canonical lookup and provider cache/negative cache;
- ISBN checksum normalization and deterministic ISBN-10 to ISBN-13 conversion;
- numbered detected-spine overlay;
- add-missed/remove-false controls;
- highlight only fields needing attention;
- marketplace preview before commit;
- idempotent per-candidate partial success;
- automatic short internal SKU/reference on commit;
- listing-quality/freshness status reuse;
- public count definitions and exact-quantity privacy;
- field-correction/fallback/cost/cleanup telemetry;
- model, prompt, adapter, schema, and provider versioning;
- lifecycle worker alerts and deletion evidence;
- repeated requested-photo failure review;
- provider-independent recorded metadata fixtures and one adapter conformance suite;
- versioned capability declarations and provider-independent lookup identity;
- provider/version cache isolation and bounded query-coalescing identity;
- availability-versus-quality scorecards and bounded Owner correction deltas;
- graceful-shutdown and fixed multi-replica verification contracts;
- at-most-one accepted transition with detectable/reconcilable duplicate provider spend.

## Necessary complexity that remains

| Area | Why it cannot be removed | Containment |
| --- | --- | --- |
| Persistent async jobs | Model/provider calls outlive mobile requests and must recover | one proven Postgres job pattern, leases, bounded retries, idempotency |
| Canonical vs store truth | Shared search needs reuse without allowing stores to corrupt global data | nullable match, immutable selected snapshot, controlled rematch |
| Public/private projection | Customer search must never read private inventory | explicit safe projection and eligibility gate |
| Inventory concurrency | Duplicate choice and quantity increments can race with other scans/holds | row/transaction lock plus idempotent controlled command |
| Media promotion | Public damaged photos need sanitization while scan/request media stay private | staging -> validate/re-encode -> purpose-specific promotion |
| Lifecycle deletion | Scale makes manual cleanup unreliable; disputes can override deletion | policy fields, idempotent worker, holds, tombstone evidence, alerts |
| Customer photo acceptance | Store must honor a customer-specific copy request before confirmation | item substate and existing customer-decision path |
| Multilingual search | Original text and English discovery must coexist without identity corruption | source-bearing alias table and approved alias projection |
| Unit 5C live-schema delta | M01 predates field-level target/lifecycle/scope | preserve live table; design a separately authorized forward mapping/migration | no false implementation claim |

## Deferred or separate work

- per-spine model switching, language-specific worker fleets, and forced
  single-language orchestration;
- model-per-spine dynamic routing;
- shelf-batch/high-volume extraction above 15;
- image-based duplicate detection;
- full canonical merge/refresh administration;
- copy-level serialized inventory for every book;
- automatic split-one-copy command (separate future unit if operational need proves it);
- full supplier, lot, consignment, tax-cost, promotion, and discount engines;
- customer-visible store reliability score;
- advanced search service outside Postgres;
- manager/staff permissions and simultaneous scanning;
- full app translation/localization;
- price-on-request behavior;
- payment/provider/pickup/settlement flows;
- selection or enablement of a secondary metadata provider or vision fallback provider;
- bounded autoscaling until fixed multi-replica activation evidence passes;
- Kubernetes or another mandated hosting platform;
- predictive autoscaling, multi-region workers, and per-language worker fleets;
- more than two metadata providers, provider-specific infrastructure per store, dynamic cost auctions, machine-learned routing, and automatic provider promotion;
- weighted/advanced fairness beyond simple per-store admission;
- a general provider-routing platform or distributed cache without pilot evidence.

## Scale containment

The minimum durable seam is horizontally safe durable claims, leases, attempts, fencing, idempotency, graceful shutdown, connection-budget admission, queue observability, simple fairness, and provider-spend reconciliation. Media sanitation, vision analysis, and metadata enrichment may scale independently. Replica counts, thresholds, cooldowns, connection-pool sizes, concurrency values, cost ceilings, and per-store active-job limits are operational configuration. This readiness does not authorize scheduling, autoscaling, new infrastructure, or deployment changes.

## Residual risks to carry into implementation

- Real Indian-language spine quality may differ significantly by script, font, lighting, and model. A consented multilingual pilot fixture set is mandatory before broad claims.
- Provider coverage for Indian-language/older editions may be poor; manual unmatched inventory must remain a first-class success path.
- Transliteration/translation aliases can be wrong or offensive. Provenance, owner correction, bounded count, and search-only use reduce impact.
- Public cover URLs can break or track clients. Provider host validation/proxy strategy and placeholder behavior must be tested.
- Storage deletion and CDN/signed URL caching are not instantaneous. Private URL TTL must be short and object deletion is the revocation mechanism when necessary.
- Existing global advisor findings remain outside this phase and must not be mistaken for resolved security.
- Request-photo retention depends on later transaction/dispute lifecycle; 180 days is a product baseline subject to legal review.
