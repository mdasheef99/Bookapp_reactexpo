# 08 — Glossary

**Last checked:** 2026-10-18, against the code and the documents it cites.

Terms used throughout the code and docs, in plain language.

## People and roles

| Term | Meaning |
| --- | --- |
| **Owner / Store Owner** | A bookstore owner using the Store Owner console (`app/(store-owner)/`). In process docs, "the Owner" also means the project owner who grants authorizations. |
| **Customer / consumer** | A shopper using the Marketplace tab. |
| **Platform reviewer / admin** | Staff holding `platform_admin` or `store_reviewer` in `platform_user_roles`. |

## Planning and process

| Term | Meaning |
| --- | --- |
| **DOC-0 … DOC-16** | The root marketplace specifications. Highest authority after the user. See 09. |
| **Phase N** | A stage of the marketplace build (DOC-12 §5). DOC-13 has each phase's current status. |
| **SDD** | Software design document. Phase 9 uses a master SDD, domain SDDs and work-unit SDDs; Phase 6 has one normative SDD. |
| **Work unit / Unit** (e.g. Unit 6G, Unit 7C) | A numbered slice of a phase with its own SDD and evidence. In Phase 9: Units 0–1 = contracts and database design, Units 4–5 = vision and metadata foundations, Unit 6 = Owner capture/review, Unit 7 = commit, publication and Store View, Unit 8 = bookstore-first marketplace display. SDDs are in `phase-9-image-inventory/work-units/`. |
| **Task / Package** | Smaller steps inside a work unit. |
| **TRACKER / tracker NN** | Status and evidence logs. The phase `TRACKER.md` holds the current next action; numbered trackers in `trackers/` hold detailed evidence. |
| **ACTIVE.md** | The router saying where a new session starts. |
| **Authorization gate** | A stop point that needs explicit user approval (implement, create migration, apply migration, deploy, publish). |
| **Red-first** | Write a failing test before the fix. |
| **MAS-NN** | A Phase 9 design invariant in the master SDD §3. |

## Database

| Term | Meaning |
| --- | --- |
| **M-number (e.g. M39)** | A migration's sequence number, taken from its file name. M-numbers are **per phase** (Phase 6 M01–M39 and Phase 9 M01 onward both exist), so say "Phase 9 M39". Do not infer its live version from the file name (see 03). |
| **Migration ledger** | The record of each migration's file name, live version and verification. |
| **RLS** | Postgres row-level security. |
| **Projection** | A derived, purpose-specific read model exposing only allowed fields (customer, Owner or support views; `marketplace_book_listings` is the public one built from `store_inventory`). |
| **Capability** | A server-checked permission for a store action, derived from role + entitlement. |
| **Fence / lease / attempt** | Mechanisms that stop stale requests or workers from writing: a job lease names who may finish a job, and an attempt number rejects late replies. |
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
| **Spine / candidate** | A book detected on an image; each becomes a candidate to review. Up to 15 per image. |
| **Vision** | AI reading of spines (Gemini), output format `p9-vision-v2`. |
| **Metadata lookup** | Finding the book's details: Google Books automatically; Open Library only for explicit Owner edition searches. |
| **Edition picker** | Owner UI to choose the exact edition of a candidate from looked-up options. |
| **Search variants** | Alternative spellings/scripts (e.g. romanised titles) used only for searching. |
| **Batch review** | Reviewing many candidates on compact cards. |
| **Add to Inventory / commit** | The explicit Owner action turning a reviewed candidate into one private inventory row. |
| **Publication** | Making committed stock visible in the marketplace. |
| **Store View** | Owner screens for managing committed stock (Unit 7C). |
| **Owner API** | The `phase9-owner-ingestion` Edge Function. |
| **Workers** | Separate Node services for media, vision, metadata and publication jobs (03). |
| **Fixture mode** | Recorded fake AI responses used in tests and safe deployments. |
