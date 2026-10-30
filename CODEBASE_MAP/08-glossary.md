# 08 — Glossary

**Last checked:** 2026-10-24, against the code and the documents it cites.

Terms used throughout the code and docs, in plain language.

## People and roles

| Term | Meaning |
| --- | --- |
| **Store Owner** | A bookstore owner using the Store Owner console (`app/(store-owner)/`). |
| **Owner (process docs)** | The project owner who makes product decisions and grants task authorization; see [DECISIONS.md](../docs/multi-tenant-bookstore-marketplace/DECISIONS.md). |
| **Customer / consumer** | A shopper using the Marketplace tab. |
| **Platform reviewer / admin** | Staff holding `platform_admin` or `store_reviewer` in `platform_user_roles`. |

## Planning and process

| Term | Meaning |
| --- | --- |
| **DOC-0 … DOC-16** | The root marketplace specifications. Highest authority after the user. See 09. |
| **Phase N** | A stage of the marketplace build (DOC-12 §5). DOC-13 has each phase's current status. |
| **SDD** | Software design document. Phase 9 uses a master SDD, domain SDDs and work-unit SDDs; Phase 6 has one normative SDD. |
| **Work unit / Unit** | A scoped area of a phase with its own design and evidence; Phase 9 SDDs live in `implementation/phase-9-image-inventory/work-units/`. See 09. |
| **Slice** | A small, separately built and tested change inside a work unit; post-scan slice numbers are distinct from the original Unit numbers (Rework SDD-0 §§3, 7). |
| **Task / Package** | Smaller steps inside a work unit. |
| **TRACKER / tracker NN** | Local decisions and implementation evidence; numbered logs in `trackers/` hold dated proof. Current work and next action belong to ACTIVE.md. |
| **ACTIVE.md** | Short current-state router for work unit, next authorized action, gates and mutation authority; dated handoffs live in `implementation/history/`. |
| **Authorization gate** | A stop point that needs explicit user approval (implement, create migration, apply migration, deploy, publish). |
| **Red-first** | Write a test and observe it fail before changing deterministic behavior (Phase 9 SESSION-START §7). |
| **MAS-NN** | A Phase 9 design invariant in the master SDD §3. |

## Database

| Term | Meaning |
| --- | --- |
| **M-number (e.g. M39)** | A migration's sequence number, taken from its file name. M-numbers are **per phase** (Phase 6 M01–M39 and Phase 9 M01 onward both exist), so say "Phase 9 M39". Do not infer its live version from the file name (see 03). |
| **Migration ledger** | The record of each migration's file name, live version and verification. |
| **RLS** | Postgres row-level security. |
| **Projection** | A derived, purpose-specific read model exposing only allowed fields (customer, Owner or support views; `marketplace_book_listings` is the public one built from `store_inventory`). |
| **Capability** | A server-checked permission for a store action, derived from role + entitlement. |
| **Fence / lease** | Authority checks that reject stale writes; a job lease and claim-attempt number identify the worker allowed to complete. |
| **PGlite** | Postgres compiled to WASM, used for fast in-memory DB tests. |

## Phase 6 commerce

| Term | Meaning |
| --- | --- |
| **Order request** | An unpaid request to buy from one store, which the store accepts, partly accepts or rejects. |
| **Soft / firm hold** | Temporary reservations of stock while a request is open. |
| **Quantity buckets** | `available`, `reserved`, `sold`, `removed`, which must sum to `total` (the database check is `NOT VALID` for older rows; see 05). |
| **`payment_ready`** | The final Phase 6 state: the request is agreed and ready for payment. Payment itself belongs to Phase 7. |
| **Scheduler / task worker** | The Edge Functions that run deadlines and background commerce tasks. |

## Phase 9 image inventory

| Term | Meaning |
| --- | --- |
| **Scan session** | One Owner sitting of photographing shelves. |
| **Input** | One uploaded image in a session. |
| **Spine / candidate** | Vision reads book spines; accepted observations become candidates to review, with up to 15 per image. An Owner can also add a candidate manually. |
| **Vision** | AI reading of spines (Gemini), output format `p9-vision-v2`. |
| **Lookup** | One logical metadata-resolution request, recorded in `phase9_metadata_lookups`; automatic and explicit-search paths are mapped in 03. |
| **Provider attempt** | A provider's logical attempt within a lookup (`metadata_enrichment_attempts`), distinct from a worker job's claim-attempt counter. |
| **Physical call** | An accounted HTTP request to a provider (`phase9_metadata_provider_calls`); a logical attempt may need several GETs. Cache reuse makes none. |
| **Reservation (metadata)** | Durable usage/cost capacity held before provider egress (`phase9_usage_reservations`), distinct from commerce stock holds. |
| **Provider registry** | `phase9_provider_registry`: provider identity, enablement, permissions and retention policy; adapter installation still lives in code (03). |
| **Adapter** | Provider-specific transport/normalization behind `metadata/providerAdapter.ts`'s common contract. |
| **Query identity** | Normalized title, authors, language, ISBN and clues forming the lookup key (`metadata/queryIdentity.ts`); it is not a catalogue work key. |
| **Edition options** | Saved, expiring alternatives for a candidate; reading them does not start a lookup or confirm a choice. |
| **Edition picker** | Owner UI to choose the exact edition of a candidate from looked-up options. |
| **Catalogue companion** | Separate validated provider identifiers bound to an option and its lineage; transported beside metadata for SQL catalogue writes (`contracts/catalogueWrite.ts`). |
| **Lean shared catalogue** | Admitted provider facts in shared work/edition/source/ID tables, with separate popularity statistics; Owner edits remain private (05). |
| **Edition-list cache** | Scoped, expiring bibliographic option lists in `phase9_metadata_cache_entries`; distinct from the automatic selected-result cache (03). |
| **Reuse** | Serving a saved result without provider egress; edition-list reuse creates receiving-store private lineage while preserving source factual time (Rework 02b §8). |
| **Search variants** | Alternative spellings/scripts (e.g. romanised titles) used only for searching. |
| **Batch review** | Reviewing many candidates on compact cards. |
| **Add to Inventory / commit** | The explicit Owner action turning a reviewed candidate into one private inventory row. |
| **Publication** | Making committed stock visible in the marketplace. |
| **Store View** | Owner screens for managing committed stock (Unit 7C). |
| **Owner API** | The `phase9-owner-ingestion` Edge Function. |
| **Workers** | Separate Node services for media, vision, metadata and publication jobs (03). |
| **Fixture mode** | Recorded fake AI responses used in tests and fixture deployments. |
