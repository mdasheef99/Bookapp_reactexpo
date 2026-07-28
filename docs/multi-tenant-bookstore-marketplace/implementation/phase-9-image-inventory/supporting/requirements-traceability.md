# Phase 9 Requirements Traceability

**Last updated:** 2026-07-29

## Unit 5C Lite target reconciliation (2026-07-29)

Unit 5C Lite is approved design only. Current selected-language runtime,
`p9-vision-v2`, and live M01 `book_search_aliases` remain unchanged until
separately authorized implementation.

| Requirement | Owning SDD | Primary acceptance IDs |
| --- | --- | --- |
| Original title/author preserved as primary with per-field language/script | 00 Master; 01 Data; Unit 5C Lite | MAS-04; MAS-AC16; DAT-10 |
| Auto-detect default; optional hints; no language-forcing | 00 Master; 02 Extraction; Unit 5C Lite | MAS-01; EXT-04/05/20 |
| Optional sidecar isolated from strict current vision result | 00 Master; 02 Extraction; 04 Media; Unit 5C Lite | MAS-19; EXT-40; MED-30 |
| Independent title/author confirmation and activation | 00 Master; 01 Data; 03 Review; Unit 5C Lite | MAS-18; DAT-12; REV-22 |
| Deterministic keys separate from linguistic variants | 01 Data; 05 Marketplace; Unit 5C Lite | DAT-14; MKT-16 |
| Bounded provisional Roman forms; translation separate/inactive | 01 Data; Unit 5C Lite | DAT-11/12 |
| Material source changes make dependent variants stale | 01 Data; Unit 5C Lite | DAT-13 |
| Store-scoped, active-only search authority | 00 Master; 01 Data; 05 Marketplace; Unit 5C Lite | MAS-AC17; DAT-13/14; MKT-05/16 |
| Owner-confirmed nullable-canonical listing under existing publication gates | 01 Data; 03 Review; 05 Marketplace | DAT-07; REV-23; MKT-17 |
| Positive selling price required; price-on-request excluded | 00 Master; 03 Review; 05 Marketplace | MAS-AC18; REV-02/23; MKT-17 |
| Roman-query provider fallback remains a future Unit 5B extension | 02 Extraction; Unit 5C Lite | EXT-41 |
| Private spine image never becomes public media | 04 Media; 05 Marketplace | MED-15/16; MKT-08 |

| Requirement | Owning SDD | Primary acceptance IDs |
| --- | --- | --- |
| Historical current-runtime selected-language capture; Unit 5C target is traced above | 02 Extraction | EXT-01–EXT-05 |
| Simple Start/Close session and summary | 02 Extraction; 03 Review | EXT-06; REV-01 |
| Model-agnostic primary/fallback vision | 02 Extraction; Unit 4 design | EXT-07–EXT-10; EXT-19 |
| Vision count/language/repeated-position policy | 00 Master; 01 Data; 02 Extraction; Unit 4 design | MAS-01/02; DAT-26/27; EXT-19–EXT-21 |
| Attempt-token-fenced vision persistence and replay | 02 Extraction; 04 Media; Unit 4 design | EXT-22/23; MED-23 |
| Immutable analysis evidence separate from metadata/Owner edits | 01 Data; 02 Extraction; 04 Media; Unit 4 design | DAT-26/27; EXT-24; MED-24 |
| Fixture vision runtime has zero metadata/inventory/publication effect | 00 Master; 02 Extraction; Unit 4 design | MAS-05/07; MAS-AC02/03/11; EXT-25 |
| Provider-agnostic local/primary/secondary metadata | 01 Data; 02 Extraction | DAT-05–DAT-09; EXT-11 |
| Replaceable provider-neutral metadata boundary and downstream independence | 00 Master; 01 Data; 02 Extraction; 05 Marketplace | MAS-13; MAS-AC12; DAT-31/33; EXT-28; MKT-15 |
| Exactly one primary, optional secondary, and at most two sequential attempts | 00 Master; 02 Extraction | MAS-14; MAS-AC13; EXT-26/27 |
| Coherent single-provider selection; no provider canonical authority or field stitching | 00 Master; 01 Data | MAS-15; DAT-06/33 |
| Provider-independent query identity and provider/version cache isolation | 01 Data; 02 Extraction | DAT-28/29; EXT-26–28 |
| Attempt role/routing/capability/cache/coalescing/cost lineage | 01 Data; 02 Extraction | DAT-30; EXT-28/30 |
| Complete provider outage preserves manual reviewed inventory | 00 Master; 02 Extraction; 03 Review | MAS-10/16; MAS-AC05; EXT-16/29; REV-20 |
| Provider licensing/publication allowlist, shadow-evaluation gate, and coalescing privacy | 04 Media; 01 Data | MED-22/25/26/27; DAT-31 |
| Availability/quality/correction scorecards and promotion gate | 01 Data; 02 Extraction; 03 Review | DAT-32; EXT-38/39; REV-21 |
| Horizontally safe claims, graceful shutdown, spend reconciliation and capacity admission | 00 Master; 02 Extraction | MAS-17; MAS-AC14/15; EXT-30–37 |
| Raw provider payload disabled by default and credentials excluded from every unsafe surface | 02 Extraction; 04 Media; P9 decisions | EXT-15/17; MED-09/17/18/28/29; P9-D63 |
| Autoscaling disabled until fixed multi-replica evidence | 00 Master; 02 Extraction | MAS-AC14; EXT-36 |
| Title/author priority; visible ISBN only as clue | 02 Extraction; 01 Data | EXT-12; DAT-03 |
| Description, ISBN-10/13, rich metadata, cover | 01 Data | DAT-01–DAT-04 |

### Unit 5A implementation mapping (2026-07-28)

| Requirement | Implementation evidence |
| --- | --- |
| DAT-01–04, DAT-28/29 | strict ISBN helpers; provider-neutral metadata/identity contracts; local-first resolution |
| DAT-30, EXT-26–30 | routing/cache/coalescing modules; M15 lookup, cache, attempt, reservation and pricing lineage |
| MAS-10/16, MAS-AC05, REV-20 | closed manual outcomes and immutable nullable-canonical selected snapshot; no inventory/publication side effect |
| MED-22/25/26/27, DAT-31 | privacy-scoped coalescing/cache namespaces, reuse-policy isolation, service-only RLS/grants, no raw payload input |
| MED-21/23 | M16/M17 explicit four-table service SELECT-only/RPC-mutation boundary; PostgreSQL 17 effective-privilege and RPC-grant regression/live evidence |

M15 is live once as `20260727222159`; this mapping has live schema/function
evidence. M16 is live once as `20260727231217`, and M17 is live once as
`20260727233457`. PostgreSQL 17.6 now verifies SELECT-only service access,
RPC-only mutation, RLS, ownership, and client denial on the four sensitive
tables as recorded in tracker 10.
| Historical alias baseline, superseded for the Unit 5C target by the reconciliation above | 00 Master; 01 Data; 05 Marketplace | MAS-04; DAT-10–DAT-14; MKT-05 |
| Canonical alias kinds/sources/statuses and supersession lifecycle | 01 Data | DAT-11–DAT-14 |
| Additional languages can be added later | 01 Data; 02 Extraction | DAT-15; EXT-04 |
| Advisory duplicates; no image comparison; repeated spines retained | 01 Data; 03 Review | DAT-16–DAT-20; REV-07 |
| Customer-request photos excluded from inventory duplicate identity | 01 Data; 06 Photo request | DAT-16–DAT-20; PHO-14 |
| Quantity/price/location/condition before commit | 03 Review | REV-02–REV-05 |
| Zero-price private inventory; positive-price publication | 03 Review | REV-02; REV-05 |
| Preselected defaults | 03 Review; 02 Extraction | REV-06; EXT-06 |
| Five conditions with explanations | 01 Data; 03 Review | DAT-21; REV-08 |
| Damage separate; discount by price; photos 1–3 | 01 Data; 04 Media | DAT-22–DAT-25; MED-11 |
| Unsellable damaged item remains private | 01 Data; 03 Review | DAT-24; REV-11 |
| Owner review and partial per-candidate commit | 00 Master; 03 Review | MAS-06; REV-01–REV-14 |
| Owner post-push edits | 03 Review | REV-15–REV-17 |
| Bookstore-first marketplace and complete store catalogue | 00 Master; 05 Marketplace | MAS-AC06; MKT-01–MKT-04 |
| Search/display metadata and cover/placeholder | 05 Marketplace | MKT-05–MKT-10 |
| Distinct store/offer/title counts; exact quantity private | 05 Marketplace | MKT-11–MKT-13 |
| Requested current-copy photo is mandatory | 06 Photo request | PHO-01–PHO-08 |
| Maximum three request photos and lifecycle deletion | 00 Master; 06 Photo request; 04 Media | MAS-AC07; PHO-03; PHO-09–PHO-12; MED-12 |
| Multi-tenant `store_id` safety | 00 Master; 04 Media; all data SDDs | MAS-03; MAS-AC04; MED-01–MED-05 |
| Private scan/raw payloads and retention | 04 Media; 02 Extraction | MED-06–MED-10; EXT-15 |
| Security across model, provider, upload, storage, logs, recovery | 00 Master; 04 Media | MAS-AC01; MED-01–MED-20 |
| Provider field reuse rights separate from provenance | 02 Extraction; 04 Media | EXT-18; MED-22 |
| Private commit survives publication failure with idempotent retry | 00 Master; 03 Review | MAS-11; MAS-AC10; REV-18/19 |
| Candidate remains `committed`; publication failure is a separate status/outcome | 00 Master; 03 Review | MAS-11; MAS-AC10; REV-18/19 |
| Initiating Owner owns session resume/mutation in pilot | 00 Master; 02 Extraction | MAS-12; EXT-06 |
| Interactive support takeover excluded; worker/reconciliation recovery only | 00 Master; 02 Extraction; 04 Media | MAS-12; MAS-AC09; EXT-06; MED-04/MED-19 |
| Versioned bookstore-first query/cursor/count contract | 05 Marketplace | MKT-14 |
| Quota/retry policy model-agnostic and configurable | 02 Extraction | EXT-13–EXT-17 |
| Distinct scan, public-copy, and request-photo media classes | 00 Master; 04 Media; 06 Photo request | MAS-08; MED-06–MED-12; PHO-09–PHO-12 |
| Phase 7/8 independence | 00 Master; 06 Photo request | MAS-09; MAS-AC08; PHO-13 |

## Local ingestion-runtime and Unit 4 trace (2026-07-26)

Server-generated upload paths, content-hashed canonical completion, immutable service-only source snapshots, opaque token-and-attempt validation leases, sanitized private linking, and one vision-job identity trace to 02 Extraction EXT-01 through EXT-06 and 04 Media MED-01 through MED-10. M11 is live as `20260726182238`; Owner ingestion and the dedicated media worker are deployed and live-verified. Owner Edge hashes completion bytes but never decodes or sanitizes media. Animated/multi-frame PNG/WebP is rejected, and ImageMagick's 64 MP internal working allowance remains subordinate to the 16 MP source ceiling.

The [Unit 4 design](../work-units/04-fixture-vision-analysis-runtime-design.md) traces `p9-vision-v2`, count/language/repeated-position policy, exact lease fencing, transactional evidence/candidate persistence, M12 schema/grants, privacy allowlists, stable errors, and the red-first matrix to MAS-01/02/05/07, MAS-AC11, DAT-16/26/27, EXT-02-10/19-25, and MED-08/09/21/23/24. The corrected contract/analyzer/policy/worker/M12 implementation and [live deployment evidence](../trackers/06-fixture-pipeline-deployment-evidence.md) cover authoritative claims, relationship reconciliation, retryability, canonical validation, path rejection, every recorded fixture outcome, service-only denial, and zero commerce effects. M12 is live as `20260726182539`, M13 as `20260727025046`, and the fixture worker is deployed; no real provider has been called.

## Root specification mapping

| Root source | Phase 9 responsibility |
| --- | --- |
| DOC-0 | Storefront/product surface and bookstore-first discovery. |
| DOC-1 | Identity, tenant, privacy, media, vendor, and public/private boundaries. |
| DOC-3 | Canonical/edition identity, metadata, inventory, condition/damage, duplicates, listing projection. |
| DOC-4 | Session/capture/model/provider/review/recovery/quota workflow. |
| DOC-5 | Consumer search, store results, catalogue, counts, book detail. |
| DOC-6 | Request-photo gate before payment readiness. |
| DOC-8 | Store Owner capture/review/edit/request-response UX. |
| DOC-13 | Global status and handoff. |
| DOC-14 | Existing request state machine seam and photo acceptance guard. |

## Non-requirements explicitly excluded

- per-spine model switching or automatic model routing by language;
- model tools or model-driven database/provider calls;
- image similarity/cover comparison for duplicate detection;
- automatic duplicate merge;
- automatic publishing without owner review;
- exact physical quantity in public discovery;
- translation of the entire application UI;
- a promotions/coupon engine;
- payment, paid order, pickup, refund, ledger, or settlement implementation;
- manager/staff scanning in the pilot;
- continuous canonical metadata refresh.
- more than two metadata providers or automatic/dynamic provider promotion;
- provider-specific infrastructure per store, machine-learned routing, or dynamic cost auctions;
- Kubernetes, predictive autoscaling, multi-region workers, or per-language worker fleets;
