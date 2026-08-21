# SDD 03: Owner Review and Inventory Commit

**Unit 5C-5 backend checkpoint (2026-07-30):** the live backend defines the
exceptional field-specific Owner variant read/decision contract with exact
versioning, immutable audit, correction provenance, and no inventory commit or
visual UI. M24/M25 are live after exact-tree approval and two-connection
candidate-refresh/replacement verification; candidate-first then
proposal-second is the canonical lock order.

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Unit 7A normative override (2026-08-12):** the Owner froze scanned-candidate
commit as create-only. Every explicitly committed reviewed candidate creates one
new private inventory row using the locked server-held review. Duplicate advice,
target selection, increment, manual match, and keep-separate semantics are
**SUPERSEDED FOR UNIT 7A**. The focused normative implementation contract is
[Unit 7A create-only inventory commit](./work-units/07a-create-only-inventory-commit-sdd.md).

**Unit 7A implementation checkpoint (2026-08-12):** the frozen contract is
locally implemented and review-pending through unapplied M39, the authenticated
Owner Edge command, and the online/non-optimistic mobile action. Dedicated
PGlite is 13/13 and the Phase 9 Edge/mobile/migration regression is 479/479.
This checkpoint changes no behavior or acceptance criterion in the frozen Unit
7A SDD. M39 application, deployment, authenticated live smoke, and Unit 7B/7C
remain separately gated. See [tracker 29](./trackers/29-unit7a-create-only-commit-evidence.md).

**Unit 6G specialization (2026-08-21):** the Owner-directed design is now
approved for Group 1 contract/persistence implementation. The
[Unit 6G](./work-units/06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md)
keeps this SDD's strict review and create-only authority while replacing the
long-form primary path with one compact session page. Per-card Add and Add all
ready books explicitly Save each displayed review before independently invoking
M39. It also proposes nullable condition/price defaults, a session-only batch
label, and `owner_removed_from_scan`. Group 1 M52 is a local-only migration
candidate; M39 application/deployment, Groups 2–4, and live mutation remain
separately gated.

## 1. Decision

Make Owner review the only gateway from staged AI/provider output into store
inventory. Unit 7A commits each candidate independently through a controlled,
versioned, idempotent create-only command and ends with one new private inventory
row. Unit 7B separately owns safe public projection.

## 2. User experience principles

- Optimize for owners who may be uncomfortable with English or complex forms; use short labels, familiar icons, numeric inputs, examples, and minimal required text.
- Do not introduce application translation in Phase 9. Original book text is displayed faithfully; inventory actions remain the existing app language.
- Show only the fields needed to make the item sellable. Put bibliographic detail in an expandable section.
- Apply selected defaults automatically and visibly.
- Highlight only low-confidence, missing, conflicting, damage, or publication-blocking fields. Legacy duplicate warnings are not actionable in Unit 7A.
- Preserve one visible spine as one review card, including repeated spines.
- Never require all candidates to succeed together.

## 3. Session setup and defaults

At Start session:

- current runtime selected language: English by default;
- approved Unit 5C Lite target: auto-detect, with any language control treated
  as an optional hint;
- default condition;
- default shelf/location;
- default quantity: 1;
- publication preference:
  - first session: Save private;
  - later: reuse the last explicit choice where policy allows.

The owner can change a candidate value without changing other candidates. A deliberate “apply to remaining” action may update uncommitted candidates, but must not rewrite already committed inventory.

## 4. Review screen

Each candidate card contains:

- candidate/spine number and optional image highlight;
- provider cover or placeholder;
- confirmed original title;
- confirmed original authors when available;
- per-field language/script and optional overall primary language;
- quantity;
- selling price;
- base condition with explanation marker;
- shelf/location;
- damage yes/no;
- no actionable duplicate warning or choice on the Unit 7A path;
- publication choice inherited from session;
- Add to inventory action.

Expandable details contain description, ISBN-10/13, publisher/date, edition, volume, format, pages, categories, aliases, public/internal notes, acquisition fields, and provenance summary. Raw model/provider payload is never shown to the ordinary Owner UI.

## 5. Candidate correction

Owner may:

- edit and confirm title and each author independently, including field
  language/script;
- select/correct metadata match;
- keep unmatched/manual metadata;
- add a missed book candidate;
- remove a false detection;
- approve/reject eligible linguistic variants by exact source field, or omit
  them; deterministic search keys are not shown as alias approvals;
- choose condition, price, quantity, location, damage, and notes;
- attach deliberate public actual-copy/damage photos;
- select private or publish-after-review.

Adding a missed candidate creates a staged manual candidate linked to the session/input; it does not call the vision model again. Removing a false candidate records `skipped_false_detection` and prevents commit.

## 6. Condition and damage UI

Base condition choices:

- New;
- Like New;
- Very Good;
- Good;
- Acceptable.

Like New, Very Good, Good, and Acceptable include a tap/hover/focus explanation. The explanation is accessible to screen readers and does not rely only on color.

If Damage = Yes:

- require one or more controlled damage types;
- require a concise public damage note;
- require 1–3 deliberate actual-copy photos before publication;
- require owner confirmation that the copy is complete, readable, and safe;
- recommend a separate inventory row and do not offer quantity increment.

If the owner reports an unsellable condition, force private/blocked listing quality. The system may retain a private record but must not project it publicly.

## 7. Legacy duplicate-warning experience

This section records the pre-Unit-7A review design. Its actions are
**DEFERRED / LEGACY** and have no create-only commit effect. Before the Unit 7A
client action is enabled, the minimum required Unit 6 contract/UI correction is
to stop requiring or presenting these choices as actionable commit inputs.

The warning explains why a possible same-store match was found and offers only valid actions:

- Increase existing quantity;
- Keep as a separate item;
- Choose another existing edition/item;
- Skip this candidate.

Quantity increment is preselected only when the deterministic compatibility matrix in SDD 01 passes. Otherwise Keep separate is recommended. A fuzzy title-only or alias-only result is labelled “possible match,” not “duplicate.”

The owner can inspect title, authors, ISBN, language, format, condition, price, location, damage/photo/notes indicators, and available quantity without seeing reserved/customer/order details.

Image comparison is absent.

## 8. Validation and publication eligibility

Required before private inventory commit:

- non-empty title;
- language;
- quantity greater than zero;
- integer `price_paise >= 0` for private inventory (`price_paise > 0` required to publish); negative, fractional, and unsafe integer values are rejected;
- valid base condition;
- shelf/location according to store policy;
- explicit damage/sellability answer.

Required before public projection:

- private commit requirements;
- author when known; author absence does not block anonymous, institutional,
  edited, dictionary, religious, school-guide, or spine-incomplete works;
- positive selling price and available quantity;
- store active/approved/setup-complete/selling-allowed;
- applicable subscription/entitlement/allowlist;
- listing quality ready and moderation not blocked;
- sellable item;
- damage note/types and 1–3 approved photos when damaged;
- valid public media/cover/placeholder policy;
- no unresolved canonical/metadata conflict designated as publication-blocking.

An unmatched manual edition may publish if its Owner-confirmed original title,
accepted language, positive selling price, availability, and other existing
eligibility gates pass. Its canonical link may remain null and missing metadata
does not create shared catalogue truth. Price-on-request is excluded.

## 9. Controlled command contract

Normative Unit 7A conceptual input:

```text
add_candidate_to_inventory(
  session_id,
  candidate_id,
  expected_candidate_version,
  expected_review_version,
  expected_metadata_revision,
  idempotency_key,
  command_id
)
```

The server:

1. Derives `auth.uid()` and resolves active Owner capability/store through the
   persisted candidate/session relationship.
2. Locks the candidate and validates candidate, review, and metadata versions.
3. Loads all business fields from the authoritative saved review/current
   selected-or-manual metadata state; the command does not resubmit them.
4. Creates exactly one new private inventory row and never targets existing inventory.
5. Initializes total/available from reviewed quantity and reserved/sold/removed to zero.
6. Writes reciprocal candidate/inventory provenance, session accounting,
   bounded audit/event evidence, candidate `committed` outcome, and canonical replay result.
7. Retains publication intent for Unit 7B without creating a listing.
8. Returns the canonical candidate/inventory response; retries return the recorded result.

The model/provider cannot invoke this command.

## 10. Quantity and concurrency

### Create new

- initialize `quantity_total = quantity_available = reviewed quantity`;
- reserved/sold/removed start at zero;
- preserve equality with the existing Phase 6 bucket model.

There is no increment-existing path or target-inventory concurrency in Unit 7A.
Post-commit quantity adjustment belongs to Unit 7C. Unit 7A guarantees equality
for every row it creates; global validation/repair of the historical constraint
remains the separately gated M09 scope.

## 11. Partial success and errors

- A single candidate error leaves other candidates usable.
- Error messages are stable codes plus short Owner text: authorization,
  ineligible candidate, stale candidate/review/metadata, invalid saved review,
  idempotency mismatch, or retryable internal transaction failure.
- Unit 7A has no public projection outcome. Publication failure/retry belongs to Unit 7B.
- A failed request may safely retry using the same idempotency identity.
- Needs-review candidates remain outside inventory after Close and expire by policy.

The canonical API error catalogue separates adapter outcomes from domain/API failures. Every `P9_*` API error records stable code, HTTP status, retryability, safe Owner message, log severity, whether a database effect survived, and whether retry must reuse the same idempotency key. Unit 7A codes cover unauthorized Owner, inactive session, candidate/review/metadata revision conflict, invalid reviewed quantity, already-handled candidate, idempotency mismatch, and retryable internal transaction failure. Duplicate-target and publication failures are legacy/later-unit concerns, not Unit 7A outcomes.

## 12. Session close summary

Close is accepted only when all submitted inputs are terminal. Summary shows:

- images processed/failed/skipped;
- candidates detected;
- committed inventory items;
- quantities added to existing rows (always zero for Unit 7A; legacy summary field only);
- published items;
- private items;
- needs-review/uncommitted items;
- false/missed/manual candidates;
- language/cap/quality skips.

Closing does not silently commit or discard candidates. Uncommitted staged candidates follow the 30-day policy and may be reached from a simple Needs review list outside the closed-session summary.

## 13. Post-commit editing

Store Owner can later change store-owned fields through controlled commands:

- title/author/metadata snapshot;
- price and quantity;
- base condition and damage disclosure;
- shelf/location;
- public/internal notes;
- actual-copy photos;
- private/published/paused state.

Rules:

- Store edits never mutate shared canonical records.
- ISBN/edition identity changes trigger rematch and duplicate re-evaluation.
- Quantity updates preserve active holds and bucket equality; a simple `quantity_total = quantity_available` rewrite is forbidden once other buckets are nonzero.
- Damage/photo removal retracts or pauses an ineligible damaged listing.
- All public changes update the safe projection and audit trail.

## 14. Accessibility and low-language-complexity checks

- Icons always have text/accessibility labels.
- Condition/damage explanations work with tap, hover, focus, and screen reader.
- Error text identifies the exact field and resolution.
- Price uses locale-aware INR display but integer paise storage.
- ISBN and quantities use appropriate keyboards and validation.
- Focus order follows spine order; status is not communicated only by color.
- Review cards remain usable at narrow phone widths and large text sizes.

## 15. Tests

- defaults and per-candidate override/apply-to-remaining;
- 15 ordered cards, repeated spines, add missed/remove false;
- all condition explanations and damage gates;
- no duplicate action rendered, required, sent, or applied;
- create-only concurrency and idempotent retry;
- exact new-row quantity initialization and no existing-row mutation;
- candidate partial success; publication/projection failure belongs to Unit 7B;
- post-commit edit/rematch/retraction;
- background/refetch/close summary/Needs review;
- cross-tenant and stale-version denial;
- keyboard/screen-reader/large-text/responsive behavior.

## 16. Acceptance criteria

| ID | Criterion |
| --- | --- |
| REV-01 | Owner review and explicit Add to Inventory are mandatory before every create-only scanned-candidate commit. |
| REV-02 | Confirmed original title, accepted language, quantity, price, condition, location, damage, and publication intent are validated from locked server-held review state. |
| REV-03 | Optional metadata is collapsed but editable. |
| REV-04 | One candidate failure does not block other commits. |
| REV-05 | Every commit is atomic/idempotent and returns its recorded result on retry. |
| REV-06 | Session defaults reduce repeated entry and remain visible/overridable. |
| REV-07 | Repeated spines stay separate candidates and every successful commit creates a separate inventory row. |
| REV-08 | Five conditions and accessible explanations are available. |
| REV-09 | Damaged publication requires note/types/1–3 approved photos. |
| REV-10 | Unit 7A never increments an existing inventory row. |
| REV-11 | Unsellable items remain private and cannot project. |
| REV-12 | Add-missed and remove-false work without rerunning the image. |
| REV-13 | Create initializes exact quantity equality; post-commit quantity lifecycle is Unit 7C. |
| REV-14 | Session close summary is authoritative and never silently commits/discards. |
| REV-15 | Post-push store fields remain editable through controlled commands. |
| REV-16 | Store edits cannot mutate canonical truth. |
| REV-17 | Post-commit ISBN/edition rematching and projection re-evaluation belong to Unit 7C. |
| REV-18 | Unit 7A ends private; Unit 7B publication retry cannot repeat the inventory effect. |
| REV-19 | Stable API errors distinguish retryability, safe Owner text, surviving effects, and idempotency reuse. |
| REV-20 | Complete provider outage, ambiguity, breaker-open state, or exhausted external capacity leaves the candidate available for manual reviewed inventory. |
| REV-21 | Owner review exposes provider-neutral provenance/attention signals and records bounded correction categories without raw provider payloads. |
| REV-22 | Title and author confirmation/variant activation is independent; candidate approval cannot activate unrelated fields. |
| REV-23 | Owner-confirmed unmatched records may publish with a null canonical link when existing positive-price and eligibility gates pass; author may be absent. |
