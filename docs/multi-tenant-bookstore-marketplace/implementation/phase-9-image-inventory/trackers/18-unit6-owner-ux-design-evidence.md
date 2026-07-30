# Phase 9 Unit 6 Owner UX Design Evidence

**Status:** `approved_design_authority`
**Date:** 2026-07-30
**Starting checkpoint:** `main`/`origin/main`
`23c01ac3f5912c963c4441b35dc2232409c1c92a`
**Working branch:** `codex/phase9-unit6-owner-ux-sdd`

## Scope and files

This was a design-authority closeout only. It created the authoritative
[Unit 6 SDD](../work-units/06-owner-capture-review-recovery-ux-sdd.md) and
[contract matrix](../work-units/06-owner-capture-review-recovery-contract-matrix.md),
corrected the repository documentation-size policy in `AGENTS.md`, and changed
the Phase 9 continuity validator from a hard 350-line failure to a cohesion/
semantic-split advisory with regression probes.

The approved design adds:

- eight exact Owner-safe operations for discovery, session, input progress,
  candidate pages/detail, strict review update, readiness, and Close;
- one initiator-only pilot authorization rule for discovery, queue, detail,
  false/missed/review/Close actions;
- strict review-field types, bounds, enums, normalization, readiness ownership,
  Unit 6 mutability, and Unit 7 revalidation;
- deterministic persisted/derived-to-presentation mapping;
- server-authoritative recovery, including a non-resumable pre-registration
  interruption seam;
- 40 unique acceptance criteria mapped once across independently mergeable
  Units 6A-6F.

No implementation code, runtime migration, Supabase type, application test,
deployment, database/Storage/provider operation, or Unit 7 behavior changed.

## Corrections and independent reviews

The first self-review corrected routing references and removed an unbounded
readiness candidate-ID assumption.

Independent Review A (backend contracts/security) initially reported four high
and one medium finding. Corrections added metadata stale fencing; exact
post-review candidate-state transitions; the canonical close breakdown;
`NeedsReviewMembershipV1` plus revision-bound pagination; and non-enumerating
candidate mismatch behavior. Final Review A: zero blocker/high/medium/low and
no backend contract left to implementation-time invention.

Independent Review B (product/UX/recovery/accessibility) initially reported
three high, four medium, and one low finding. Corrections completed damage UX,
Close-summary rendering, safe duplicate inspection, queue timing, the
pre-registration interruption path, subunit acceptance ownership, and
one-shot local `review_saved` semantics. Final Review B: zero
blocker/high/medium/low and no critical flow ambiguity.

## Validation evidence

- Unit 6 structure: 35 SDD sections, eight target operations, 40 acceptance
  criteria, 40 unique IDs, 40 mapped IDs, six subunits.
- Phase 9 requirements: 195 definitions, zero duplicates, zero missing
  traceability.
- Semantic negative matrix: 107 cases plus both exact C12 boundary probes pass.
- Documentation-size regression: cohesive 351-line input accepted; 400-500
  yields cohesion assessment; above 500 yields non-failing split advisory.
- Relative links, required markers, `git diff --check`, documentation-only
  changed-scope scan, and continuity validation pass.
- Final design line counts before continuity closeout: main SDD 425; supporting
  matrix 327.

The main SDD remains the cohesive entry/routing authority. The matrix has one
independent semantic responsibility—dense contracts, screens/states, field
constraints, acceptance, and subunit mapping—so a third document would
fragment review without reducing cognitive load.

## Approval and next gate

Unit 5C-5/5C-6 is merged on `main`; M24-M28 were already applied live exactly
once. No language is benchmarked, approved, or enabled.

Unit 6 implementation has not started. The next authorized work is:

**Phase 9 Unit 6A — Owner-safe backend contract foundation**

Unit 6A must start red-first in a new implementation session. Migration
creation/application and deployment require fresh separate authority. Units
6B-6F follow the approved dependency order, and Unit 7 remains separately
gated.
