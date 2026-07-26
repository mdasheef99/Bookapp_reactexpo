# Phase 9 Requirements Traceability

**Last updated:** 2026-07-26

| Requirement | Owning SDD | Primary acceptance IDs |
| --- | --- | --- |
| Same-language spine stack, maximum 15, camera/gallery | 02 Extraction | EXT-01–EXT-05 |
| Simple Start/Close session and summary | 02 Extraction; 03 Review | EXT-06; REV-01 |
| Model-agnostic primary/fallback vision | 02 Extraction; Unit 4 design | EXT-07–EXT-10; EXT-19 |
| Vision count/language/repeated-position policy | 00 Master; 01 Data; 02 Extraction; Unit 4 design | MAS-01/02; DAT-26/27; EXT-19–EXT-21 |
| Attempt-token-fenced vision persistence and replay | 02 Extraction; 04 Media; Unit 4 design | EXT-22/23; MED-23 |
| Immutable analysis evidence separate from metadata/Owner edits | 01 Data; 02 Extraction; 04 Media; Unit 4 design | DAT-26/27; EXT-24; MED-24 |
| Fixture vision runtime has zero metadata/inventory/publication effect | 00 Master; 02 Extraction; Unit 4 design | MAS-05/07; MAS-AC11; EXT-25 |
| Provider-agnostic local/primary/secondary metadata | 01 Data; 02 Extraction | DAT-05–DAT-09; EXT-11 |
| Title/author priority; visible ISBN only as clue | 02 Extraction; 01 Data | EXT-12; DAT-03 |
| Description, ISBN-10/13, rich metadata, cover | 01 Data | DAT-01–DAT-04 |
| Original language; up to three automated English alias proposals plus bounded official/verified aliases | 01 Data; 05 Marketplace | DAT-10–DAT-14; MKT-05 |
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
| Owner review and partial per-candidate commit | 03 Review | REV-01–REV-14 |
| Owner post-push edits | 03 Review | REV-15–REV-17 |
| Bookstore-first marketplace and complete store catalogue | 05 Marketplace | MKT-01–MKT-04 |
| Search/display metadata and cover/placeholder | 05 Marketplace | MKT-05–MKT-10 |
| Distinct store/offer/title counts; exact quantity private | 05 Marketplace | MKT-11–MKT-13 |
| Requested current-copy photo is mandatory | 06 Photo request | PHO-01–PHO-08 |
| Maximum three request photos and lifecycle deletion | 06 Photo request; 04 Media | PHO-03; PHO-09–PHO-12; MED-12 |
| Multi-tenant `store_id` safety | 00 Master; 04 Media; all data SDDs | MAS-03; MED-01–MED-05 |
| Private scan/raw payloads and retention | 04 Media; 02 Extraction | MED-06–MED-10; EXT-15 |
| Security across model, provider, upload, storage, logs, recovery | 04 Media | MED-01–MED-20 |
| Provider field reuse rights separate from provenance | 02 Extraction; 04 Media | EXT-18; MED-22 |
| Private commit survives publication failure with idempotent retry | 00 Master; 03 Review | MAS-11; REV-18 |
| Candidate remains `committed`; publication failure is a separate status/outcome | 00 Master; 03 Review | MAS-11; REV-18 |
| Initiating Owner owns session resume/mutation in pilot | 00 Master; 02 Extraction | MAS-12; EXT-06 |
| Interactive support takeover excluded; worker/reconciliation recovery only | 00 Master; 02 Extraction; 04 Media | MAS-12; MAS-AC09; EXT-06; MED-04/MED-19 |
| Versioned bookstore-first query/cursor/count contract | 05 Marketplace | MKT-14 |
| Quota/retry policy model-agnostic and configurable | 02 Extraction | EXT-13–EXT-17 |
| Phase 7/8 independence | 00 Master; 06 Photo request | MAS-09; PHO-13 |

## Local ingestion-runtime and Unit 4 trace (2026-07-26)

Server-generated upload paths, content-hashed canonical completion, immutable service-only source snapshots, opaque token-and-attempt validation leases, sanitized private linking, and one vision-job identity trace to 02 Extraction EXT-01 through EXT-06 and 04 Media MED-01 through MED-10. M11 and the ingestion runtime are committed at `0a8e57a` but remain unapplied/undeployed. Sanitation is owned by the dedicated service-authenticated worker; Owner Edge hashes completion bytes but never decodes or sanitizes media. Animated/multi-frame PNG/WebP is rejected, and ImageMagick's 64 MP internal working allowance remains subordinate to the 16 MP source ceiling.

The [Unit 4 design](../work-units/04-fixture-vision-analysis-runtime-design.md) traces `p9-vision-v2`, count/language/repeated-position policy, exact lease fencing, transactional evidence/candidate persistence, forward M12 schema/grants, privacy allowlists, stable errors, and the red-first matrix to MAS-01/02/05/07, MAS-AC11, DAT-16/26/27, EXT-02-10/19-25, and MED-08/09/21/23/24. The final corrected contract/analyzer/policy/worker/M12 implementation supplies executable evidence: Phase 9 Jest 132/132 and PGlite 57/57, including authoritative job-row claim validation, stale-safe job-only relationship reconciliation, database-owned retryability and canonical hashing/recursive validation, rejected-promise and permanent-error transport, path-shaped evidence rejection, exact UTF-8 byte boundaries, and explicit no-metadata/no-inventory/no-publication checks. No provider call or external mutation occurred.

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

- automatic mixed-language spine routing;
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
