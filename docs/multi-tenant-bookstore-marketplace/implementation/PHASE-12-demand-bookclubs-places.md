# PHASE-12: Demand, Bookclubs, and Places

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Add the growth loop after the core marketplace commerce loop works.

---

## Required Reading

- [DOC-11: Demand Signals, Bookclubs, and Places](../DOC-11-demand-signals-bookclubs-places.md)
- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)

---

## Scope

- Unavailable search capture.
- Customer alerts.
- Alert matching.
- Store demand dashboard.
- Store-specific sourcing requests.
- Request dedupe/rate limiting/moderation.
- Store bookclub hosting interest.
- Lightweight book-friendly places surface.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Demand signal capture | `not_started` | Search with no/low results. |
| Customer alerts | `not_started` | User-owned and removable. |
| Alert matching | `not_started` | Strong matches first. |
| Store demand dashboard | `not_started` | Aggregated only. |
| Store sourcing requests | `not_started` | Explicit customer request. |
| Request abuse prevention | `not_started` | Dedupe, rate limit, moderation. |
| Bookclub hosting interest | `not_started` | Lightweight setting only. |
| Book-friendly places | `not_started` | Store/place associations. |
| Tests | `not_started` | Privacy thresholds and abuse controls. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Unavailable searches create demand signals.
- [ ] Customer can create alerts for wanted books.
- [ ] New matching listing can trigger alert.
- [ ] Store sees aggregated demand without customer identity leakage.
- [ ] Customer can send store-specific sourcing request.
- [ ] Requests are rate-limited, deduplicated, and moderated.
- [ ] Store can mark bookclub/place hosting interest.
- [ ] Full bookclub management remains separate.
- [ ] `DOC-13` is updated.

---

## Blockers

- Core marketplace discovery and event foundations should exist.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

This phase should not expose cross-store competitive analytics or individual passive customer demand.
