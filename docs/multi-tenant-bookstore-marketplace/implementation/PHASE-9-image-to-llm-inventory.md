# PHASE-9: Image-to-LLM Inventory

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Add image-based inventory extraction after manual inventory and listings are stable.

---

## Required Reading

- [DOC-4: Image-to-LLM Inventory Workflow](../DOC-4-image-to-llm-inventory-workflow.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)

---

## Scope

- Capture/upload sessions.
- LLM extraction.
- Metadata enrichment.
- Owner review.
- Duplicate resolution.
- Quota and cost tracking.
- Workflow persistence/recovery.
- Private raw payload and image retention rules.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Extraction session model | `not_started` | Store-scoped. |
| Image upload/capture | `not_started` | Private storage. |
| LLM extraction service | `not_started` | Server-side/provider-safe. |
| Metadata enrichment | `not_started` | Provider source records. |
| Owner review UI | `not_started` | Required before inventory write. |
| Duplicate resolution UI | `not_started` | Increment/variant/skip/manual match. |
| Quota/cost tracking | `not_started` | Store-level. |
| Session recovery | `not_started` | Local state without customer PII. |
| Tests | `not_started` | Candidate caps, quota, owner review requirement. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Owner review is required before inventory write/publish.
- [ ] Candidate caps are enforced by capture mode.
- [ ] Low-confidence candidates require correction.
- [ ] Duplicate candidates can increment quantity or create variants.
- [ ] Quota is checked before external-cost processing.
- [ ] Manual entry still works when image quota is exhausted.
- [ ] Raw images/payloads follow retention/privacy rules.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 3 inventory/listing model must be stable.
- LLM/provider choice may require cost and privacy review.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not let LLM output publish directly without owner review.
