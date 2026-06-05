# PHASE-3: Inventory, Canonical Books, and Listings

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Build manual inventory and public listing projection before image-to-LLM automation.

---

## Required Reading

- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)

---

## Scope

- Canonical book/edition foundation.
- Metadata source records.
- Manual inventory entry.
- Duplicate detection.
- Public listing projection.
- Listing moderation and quality status.
- Private/public inventory field separation.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Canonical work/edition model | `not_started` | Minimum viable model acceptable. |
| Metadata source records | `not_started` | Google Books/Open Library payloads private. |
| Store inventory model | `not_started` | Store-owned private inventory. |
| Manual inventory entry | `not_started` | Proves data model before LLM. |
| Duplicate detection | `not_started` | ISBN/provider/title-author. |
| Public listing projection | `not_started` | Consumer boundary. |
| Listing quality status | `not_started` | Price, condition, metadata, photos. |
| Moderation/risk flags | `not_started` | Anti-piracy/counterfeit/prohibited handling. |
| Tests | `not_started` | Public/private data boundary and grouping. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Store Owner can create inventory without publishing it.
- [ ] Store Owner can publish only inventory with required public fields.
- [ ] Consumer search reads public listing projection only.
- [ ] Private inventory fields are not exposed in public listing responses.
- [ ] Same ISBN across stores groups under one consumer book result.
- [ ] Blocked/suspended/prohibited listings are excluded from consumer discovery.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 1 and Phase 2 must be sufficiently complete for active store access.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Manual inventory must be stable before Phase 9 image-to-LLM work begins.
