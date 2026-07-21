# SDD 03: Owner Review, Duplicate Choice, and Inventory Commit

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

## 1. Decision

Make owner review the only gateway from staged AI/provider output into store inventory. Keep the screen compact through session defaults, progressive disclosure, and attention markers. Commit each candidate independently through a controlled, versioned, idempotent server command that preserves Phase 6 quantity buckets and safe public projection.

## 2. User experience principles

- Optimize for owners who may be uncomfortable with English or complex forms; use short labels, familiar icons, numeric inputs, examples, and minimal required text.
- Do not introduce application translation in Phase 9. Original book text is displayed faithfully; inventory actions remain the existing app language.
- Show only the fields needed to make the item sellable. Put bibliographic detail in an expandable section.
- Apply selected defaults automatically and visibly.
- Highlight only low-confidence, missing, conflicting, duplicate, damage, or publication-blocking fields.
- Preserve one visible spine as one review card, including repeated spines.
- Never require all candidates to succeed together.

## 3. Session setup and defaults

At Start session:

- selected language: English by default;
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
- original title;
- authors;
- language;
- quantity;
- selling price;
- base condition with explanation marker;
- shelf/location;
- damage yes/no;
- duplicate warning when applicable;
- publication choice inherited from session;
- Add to inventory action.

Expandable details contain description, ISBN-10/13, publisher/date, edition, volume, format, pages, categories, aliases, public/internal notes, acquisition fields, and provenance summary. Raw model/provider payload is never shown to the ordinary Owner UI.

## 5. Candidate correction

Owner may:

- edit title/authors/language and bibliographic snapshot;
- select/correct metadata match;
- keep unmatched/manual metadata;
- add a missed book candidate;
- remove a false detection;
- correct proposed aliases or omit them;
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

## 7. Duplicate warning experience

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
- explicit duplicate action when warned;
- explicit damage/sellability answer.

Required before public projection:

- private commit requirements;
- author or explicit bounded unknown-author marker;
- positive selling price and available quantity;
- store active/approved/setup-complete/selling-allowed;
- applicable subscription/entitlement/allowlist;
- listing quality ready and moderation not blocked;
- sellable item;
- damage note/types and 1–3 approved photos when damaged;
- valid public media/cover/placeholder policy;
- no unresolved canonical/metadata conflict designated as publication-blocking.

An unmatched manual edition may publish if its store-owned metadata is sufficiently complete and reviewed; it does not require pollution of the canonical catalogue.

## 9. Controlled command contract

Conceptual input:

```text
commit_candidate(
  candidate_id,
  expected_candidate_version,
  owner_review_snapshot,
  duplicate_action,
  expected_duplicate_target_version nullable,
  publication_action,
  idempotency_key,
  command_id
)
```

The server:

1. Derives `auth.uid()` and resolves active Owner capability/store.
2. Loads candidate and verifies the final `store_id`; ignores client authority claims.
3. Validates state/version, reviewed snapshot, aliases, damage/media, and publication eligibility.
4. Recomputes same-store duplicate evidence under an identity/row transaction lock.
5. Performs `create_new`, `increment_quantity`, `manual_match`, or `skip`.
6. Writes bounded audit/event evidence and candidate outcome.
7. Commits the private inventory outcome and records the requested publication intent.
8. Creates/updates/retracts the safe public projection as required; projection failure records a retryable private outcome without repeating inventory effects.
9. Returns canonical inventory/listing/session summary; retries return the recorded result.

The model/provider cannot invoke this command.

## 10. Quantity and concurrency

### Create new

- initialize `quantity_total = quantity_available = reviewed quantity`;
- reserved/sold/removed start at zero;
- preserve equality with the existing Phase 6 bucket model.

### Increment existing

- lock the target inventory row;
- recheck store, edition/ISBN, language, format, condition, price, and absence of copy-specific variants;
- add reviewed quantity to both total and available;
- do not change reserved/sold/removed;
- fail with a refreshable conflict if compatibility or target version changed.

The existing quantity equality is currently `NOT VALID`; Phase 9 must preserve it regardless of validation timing. No direct client quantity update is used for a scan commit.

## 11. Partial success and errors

- A single candidate error leaves other candidates usable.
- Error messages are stable codes plus short owner text: authorization, stale review, duplicate changed, required field, media missing, unsellable, publication blocked, quota/policy, or retryable server failure.
- A failed public projection cannot be reported as published and does not roll back a valid private inventory commit. The candidate remains persisted as `committed`, publication becomes `publication_failed`, and the API returns command outcome `committed_publication_failed`; record an audit event and retryable publication intent. The publication-retry command reauthorizes current eligibility and is idempotent against the original commit, so it cannot create or increment inventory again.
- A failed request may safely retry using the same idempotency identity.
- Needs-review candidates remain outside inventory after Close and expire by policy.

The canonical API error catalogue separates adapter outcomes from domain/API failures. Every `P9_*` API error records stable code, HTTP status, retryability, safe Owner message, log severity, whether a database effect survived, and whether retry must reuse the same idempotency key. Required initial codes cover unauthorized Owner, inactive session, candidate version conflict, changed duplicate target, unapproved media, quantity invariant failure, and publication failure.

## 12. Session close summary

Close is accepted only when all submitted inputs are terminal. Summary shows:

- images processed/failed/skipped;
- candidates detected;
- committed inventory items;
- quantities added to existing rows;
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
- compatible/incompatible/fuzzy duplicate actions;
- create/increment concurrency and idempotent retry;
- active hold/bucket preservation;
- candidate partial success and projection failure;
- post-commit edit/rematch/retraction;
- background/refetch/close summary/Needs review;
- cross-tenant and stale-version denial;
- keyboard/screen-reader/large-text/responsive behavior.

## 16. Acceptance criteria

| ID | Criterion |
| --- | --- |
| REV-01 | Owner review is mandatory before every inventory create/increment. |
| REV-02 | Title, language, quantity, price, condition, location, damage, duplicate, and publication requirements are validated server-side. |
| REV-03 | Optional metadata is collapsed but editable. |
| REV-04 | One candidate failure does not block other commits. |
| REV-05 | Every commit is atomic/idempotent and returns its recorded result on retry. |
| REV-06 | Session defaults reduce repeated entry and remain visible/overridable. |
| REV-07 | Repeated spines stay separate candidates until explicit owner action. |
| REV-08 | Five conditions and accessible explanations are available. |
| REV-09 | Damaged publication requires note/types/1–3 approved photos. |
| REV-10 | Damaged/copy-specific candidates cannot increment a generic quantity row. |
| REV-11 | Unsellable items remain private and cannot project. |
| REV-12 | Add-missed and remove-false work without rerunning the image. |
| REV-13 | Create/increment preserves Phase 6 quantity/hold invariants under concurrency. |
| REV-14 | Session close summary is authoritative and never silently commits/discards. |
| REV-15 | Post-push store fields remain editable through controlled commands. |
| REV-16 | Store edits cannot mutate canonical truth. |
| REV-17 | ISBN/edition edits rematch and re-evaluate duplicates/public projection. |
| REV-18 | Projection failure returns one private `committed_publication_failed` outcome and idempotent publication retry cannot repeat inventory effects. |
| REV-19 | Stable API errors distinguish retryability, safe Owner text, surviving effects, and idempotency reuse. |
