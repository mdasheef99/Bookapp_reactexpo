# PHASE-5: Consumer Discovery

**Status:** `not_started`
**Last updated:** 2026-06-30
**Phase goal:** Add a consumer marketplace section for bookstore listings inside the current app.

---

## Required Reading

- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-16: Pilot and Unit Economics](../DOC-16-pilot-and-unit-economics.md)

---

## Scope

- Consumer marketplace entry point.
- Search by title, author, ISBN.
- Book result grouping across stores.
- Store availability cards.
- Public store pages.
- Policy/seller disclosure display.
- Lightweight unavailable-search capture for pilot learning.
- Single-store cart replacement warning if cart skeleton is introduced here.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Marketplace route/section | `not_started` | Existing consumer app section, not separate app. |
| Search service/query | `not_started` | Reads public listing projection only. |
| Book result grouping | `not_started` | Canonical edition/work grouping. |
| Store availability cards | `not_started` | Price, condition, pickup/delivery, confirmation message. |
| Public store page | `not_started` | Store info, hours, policies, active listings. |
| Consumer disclosures | `not_started` | Seller/store, policy, support/grievance, confirmation-before-payment. |
| Lightweight demand capture | `not_started` | Capture unavailable searches without building full alerts dashboard. |
| Single-store cart guardrail | `not_started` | If cart is introduced before Phase 6. |
| Tests | `not_started` | Public/private data and hidden suspended stores. |

---

## Verification Log

No verification run yet.

Phase 5 planning readiness note, 2026-06-30:

- Phase 4 Store Owner Console is locally complete and can supply active owner inventory/listing management.
- Phase 3 public listing projection exists and trigger smoke passed, but anonymous public-read smoke remains blocked by the RLS helper execute-permission issue recorded in `DOC-13` and `CODEBASE_INTELLIGENCE/08-marketplace-phase-3-readiness.md`.
- Consumer discovery must use public projections such as `marketplace_book_listings`, not raw `store_inventory` or P2P `listings`.

---

## Acceptance Criteria

- [ ] Customer can search marketplace books by title, author, and ISBN.
- [ ] Search groups copies of the same book across bookstores.
- [ ] Customer sees price, condition, pickup, delivery, and confirmation requirement.
- [ ] Suspended/unverified stores are hidden.
- [ ] Private inventory fields are not exposed.
- [ ] Customer sees required marketplace disclosures before checkout/payment.
- [ ] Unavailable searches can be captured for pilot learning without exposing customer identity to stores by default.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 3 public listing projection must exist.
- Phase 3 anonymous public listing RLS remediation must be resolved before Phase 5 can be smoke-tested as a public/anonymous consumer surface.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not implement payment in this phase.

Recommended implementation shape:

1. Resolve Phase 3 anonymous public-read RLS and rerun public listing smoke.
2. Build search/listing discovery against public projections only.
3. Add grouped book results, store availability cards, and public store pages.
4. Add disclosure copy and single-store cart replacement guardrail only if a cart skeleton is introduced.
5. Keep order request submission, payment, fulfillment, delivery, and settlement out of Phase 5.
