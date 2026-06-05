# DOC-4: Image-to-LLM Inventory Workflow

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.1
**Date:** 2026-05-19
**Status:** Planning draft
**Depends On:** DOC-1, DOC-2, DOC-3
**Owns:** Image capture, LLM book extraction, metadata enrichment, owner review, duplicate resolution, inventory publishing, quota accounting, and workflow recovery.

---

## 1. Purpose

This document defines the inventory digitization workflow for bookstores.

The workflow is not traditional OCR-only scanning. Store owners capture images of book covers, spine stacks, or shelves. Images are sent to a multimodal LLM for visual analysis. The extracted book names and candidate metadata are then enriched through book metadata providers such as Google Books, Open Library, or future ISBN/catalog APIs. The store owner reviews and confirms price, quantity, condition, and location before any item enters inventory.

---

## 2. Workflow Summary

```text
Owner starts extraction session
  -> selects mode and default inventory fields
  -> captures/upload images
  -> images are sent to LLM extraction
  -> extracted candidates are enriched through book APIs
  -> duplicate checks run against store inventory
  -> owner reviews candidates
  -> owner enters price, quantity, condition, shelf/location
  -> owner resolves duplicates/low-confidence items
  -> confirmed items are added to private inventory
  -> eligible items are published as marketplace listings
```

---

## 3. Capture Modes

| Mode | Purpose | Notes |
|---|---|---|
| `single_cover` | One book cover/front image. | Highest confidence. |
| `spine_stack` | Multiple visible book spines in one image. | Must cap candidate count. |
| `shelf_batch` | Shelf/stack photo with many books. | Post-MVP or limited MVP if quality is acceptable. |
| `manual_upload` | Upload image from gallery. | Useful for stores with existing photos. |

MVP should prioritize `single_cover` and `spine_stack`.

---

## 4. Session Configuration

Before capture, owner chooses:

- inventory mode: `new_books` or `used_books`
- default condition: `new`, `like_new`, `good`, `fair`, `damaged`
- default shelf/location
- default quantity per detected book
- publish behavior: `save_as_draft` or `publish_after_review`

Required fields before starting:

- `store_id` from Store Owner context
- authenticated `user_id`
- default shelf/location
- selected mode

---

## 5. LLM Extraction

### 5.1 LLM Responsibility

The LLM extracts candidate book information from images:

- visible title
- visible author
- edition clues
- publisher clues
- language clues
- visible ISBN if present
- confidence score
- bounding/crop reference if supported

The LLM should not be treated as a source of canonical truth. It is an extraction engine.

### 5.2 Candidate Limits

Candidate limits prevent accidental over-processing and quota abuse.

Recommended limits:

| Mode | Max Candidates Per Image |
|---|---|
| `single_cover` | 1 |
| `spine_stack` | 15 |
| `shelf_batch` | 25, post-MVP only |

Excess candidates should be dropped or moved to manual review with a clear owner message.

### 5.3 Confidence Rules

Suggested confidence categories:

| Confidence | Behavior |
|---|---|
| `high` | Candidate can proceed to metadata enrichment. |
| `medium` | Candidate proceeds but is flagged for review. |
| `low` | Candidate requires owner correction before enrichment/publish. |

Low-confidence threshold can start around `0.75`, but final threshold should be tuned after real bookstore image testing.

---

## 6. Metadata Enrichment

The extracted candidate is sent to metadata providers in the order defined by DOC-3.

Provider lookup inputs:

- ISBN if extracted
- title
- author
- publisher if visible
- language if visible

Provider outputs:

- canonical title/subtitle
- authors
- ISBN-10/ISBN-13
- cover image
- publisher
- published date
- page count
- categories
- language
- retail price if available
- provider IDs
- raw provider payload

Provider data must be stored as metadata source records. It should not blindly overwrite owner-entered or canonical data when confidence is weak.

---

## 7. Owner Review

Before adding to inventory, each candidate must be reviewed by the owner.

Required owner-confirmed fields:

- title
- author(s)
- condition
- selling price
- quantity
- shelf/location

Optional fields:

- public condition notes
- internal notes
- condition photos
- acquisition cost
- category override
- public visibility

No candidate should be published directly to the marketplace without owner review in MVP.

---

## 8. Duplicate Resolution

Duplicate detection runs before inventory insertion.

Signals:

- same ISBN-13 in same store
- same ISBN-10 normalized to ISBN-13
- same provider ID in same store
- title + author normalized match
- same extraction session candidate repeated across images

Resolution options:

| Option | Behavior |
|---|---|
| `increment_quantity` | Add quantity to existing inventory row. |
| `create_condition_variant` | Create separate row for different condition/price. |
| `keep_separate` | Keep as separate item when edition/condition differs. |
| `skip_candidate` | Do not add to inventory. |
| `manual_match` | Owner selects the correct existing item/canonical edition. |

For same ISBN and same condition, the UI should recommend quantity increment. For ambiguous title/author matches without ISBN, owner confirmation is required.

---

## 9. Inventory Publishing

Confirmed books enter `store_inventory`.

Publishing rules:

- `save_as_draft` keeps inventory private.
- `publish_after_review` creates or updates a `marketplace_book_listings` projection if required fields are valid.
- `damaged` condition requires public condition notes and preferably photos.
- low-confidence metadata should not publish until owner confirms.
- blocked/prohibited books must not publish.

Required fields for public listing:

- title
- author or explicit unknown-author marker
- condition
- selling price
- available quantity greater than zero
- store active
- subscription/entitlement permits active listing

---

## 10. Session Persistence and Recovery

The workflow should survive app backgrounding and accidental closure.

Allowed local persistence:

- active extraction session ID
- candidate list without customer PII
- owner review progress
- confirmed-but-not-yet-synced inventory candidates
- current workflow step
- timestamp

Recommended storage:

- MMKV for mobile workflow recovery
- server session record for authoritative status

Retention:

- active sessions expire after 24 hours unless server policy changes
- completed sessions should clear local workflow state
- logout must clear all local workflow state

---

## 11. Workflow State Machine

Recommended states:

| State | Meaning |
|---|---|
| `setup` | Owner configures scan/session defaults. |
| `capture` | Owner captures or uploads images. |
| `extracting` | LLM extraction in progress. |
| `enriching` | Metadata provider enrichment in progress. |
| `review` | Owner reviews candidates. |
| `resolve_duplicates` | Owner resolves duplicate/conflict cases. |
| `price_and_quantity` | Owner confirms price, quantity, condition, location. |
| `publish` | Inventory/listing write in progress. |
| `complete` | Session summary shown. |
| `abandoned` | Session abandoned/expired. |
| `failed` | Recoverable or terminal failure. |

Backward navigation should be allowed only where it does not corrupt server state. Publishing should be treated as a commit step.

---

## 12. Quota and Cost Accounting

Quota checks occur before external-cost actions.

Counted usage:

- image extraction request
- LLM image analysis call
- metadata provider API calls
- repeated retries after owner confirmation

Quota behavior:

- show remaining monthly extraction quota before session start
- warn when quota is near limit
- block new extraction if quota is exhausted
- allow manual inventory entry even when image extraction quota is exhausted
- log failed external calls for cost visibility

Quota usage should belong to the store, not just the user, because multiple future staff accounts may act on one store.

Cost observability should be captured from day one:

- external LLM calls per session
- metadata provider calls per confirmed book
- failed call count
- duplicate candidates per session
- confirmed books per session
- estimated cost per confirmed inventory item

Abuse prevention:

- store-level monthly quota
- per-session candidate caps
- per-image retry caps
- platform ability to temporarily disable image extraction for a store
- manual entry remains available when image extraction is disabled or exhausted

---

## 13. Failure Handling

| Failure | Behavior |
|---|---|
| LLM request fails | Show retry; do not create inventory. |
| Metadata provider fails | Allow owner to manually complete candidate. |
| Candidate count exceeds cap | Keep capped candidates; warn owner. |
| Low confidence | Require owner correction. |
| Duplicate conflict | Route to duplicate resolution. |
| Network loss | Preserve local session; retry sync when online. |
| Server session expired | Clear local state after warning; start new session. |
| Quota exceeded | Block extraction and show upgrade/quota message. |

---

## 14. Data Model

```text
image_extraction_sessions
  id
  store_id
  user_id
  mode
  default_condition
  default_location
  default_quantity
  status
  candidate_count
  confirmed_count
  skipped_count
  llm_call_count
  metadata_call_count
  started_at
  completed_at
  expires_at
  created_at
  updated_at

image_extraction_inputs
  id
  session_id
  store_id
  storage_path
  capture_mode
  status
  created_at

image_extraction_candidates
  id
  session_id
  store_id
  input_id
  extracted_title
  extracted_authors
  extracted_isbn
  llm_confidence
  enrichment_status
  matched_canonical_edition_id
  duplicate_status
  owner_action
  owner_price_inr
  owner_quantity
  owner_condition
  owner_location
  created_inventory_id
  created_listing_id
  raw_llm_payload private
  created_at
  updated_at

metadata_enrichment_attempts
  id
  candidate_id
  provider
  query
  status
  matched_provider_id
  confidence
  raw_payload private
  created_at
```

---

## 15. Security and Privacy

- Extraction images are private by default.
- Raw LLM and provider payloads are private.
- Store shelf/location is private.
- Customer PII is not involved in this workflow.
- Images should be deleted or archived according to retention policy after processing.
- LLM provider calls must not include unnecessary store/customer data.
- Store ID must come from Store Owner context and server validation.
- Raw LLM/provider payloads should be retained only as long as needed for debugging, dispute/evidence, cost audit, and model-quality review.
- Uploaded extraction images must not be reused for model training or marketing unless explicit platform policy and consent allow it.
- Failed or abusive sessions should create platform-visible risk/cost events.

---

## 16. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| IMG-01 | Owner can start an image extraction session only for their own active store. |
| IMG-02 | Owner can process single-cover and spine-stack images. |
| IMG-03 | Candidate count is capped by mode. |
| IMG-04 | Low-confidence candidates require owner review. |
| IMG-05 | Owner must confirm price, quantity, condition, and location before inventory write. |
| IMG-06 | Duplicate candidates can increment quantity or create variants. |
| IMG-07 | Quota is checked before external-cost processing. |
| IMG-08 | Logout clears local extraction workflow state. |
| IMG-09 | Manual entry remains available when image quota is exhausted. |

---

## 17. Deferred Items

- fully automated publish without owner review
- shelf-batch extraction at high volume
- payment authorization for extraction overages
- customer-facing photo request workflow
- multi-staff simultaneous scanning
- provider ensemble ranking beyond Google Books/Open Library

---

## 18. Related Documents

- [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](./DOC-3-canonical-books-metadata-inventory.md)
- [DOC-5: Consumer Marketplace and Discovery](./DOC-5-consumer-marketplace-discovery.md)
- [DOC-8: Store Owner Console](./DOC-8-store-owner-console.md)
