# Library build and review process

Short on purpose. Added 2026-10-24 after SDD-10. Each rule must earn its place: if a step does not catch anything in 3 rounds, remove it (and when adding a step, remove or merge one).

## The three active rules

1. **Automatic checks for repeat mistakes** (run by the tools, not by remembering).
   - Lint/test rule: no empty assertions such as `expect(true).toBe(true)`.
   - Check: tests must not depend on the real date; pin the clock or use dates relative to now.
   - Status: **to be built** (a builder task after the SDD-10 branch is merged; owner approval of the code change is covered by the normal unit flow).
2. **Whole-branch review before every merge.** After the last unit and before asking the owner to merge: run the full test suite (`npx jest --ci`, not only the library paths), then an outside read-only review of the full branch diff (`git diff origin/main...HEAD`), verify each finding against the code, fix the real ones with tests that fail without the fix, run a confirmation review, and record it in the tracker. Tell the owner which commits were and were not reviewed.
3. **States list in each unit brief** (about ten lines, written before coding): loading, failed, empty, mid-gesture or mid-save, large text (200%), reduced motion, the user changing during use. For each: the expected behaviour. Add one line for anything the unit shares with existing code (cache, gesture guard, layout budget) so shared parts are named up front.

## Parked experiments (not rules yet)

- One lens per reviewer (spec conformance and test value; state, races and accessibility). Tried first on the SDD-10 fix review (2026-10-24). Keep only if lens reviews find things a broad prompt does not.
- A small log of each reviewer's findings that survived checking. Keep only if it changes a decision.
- Failing tests first for risky parts (gestures, caches, dates only).

## Standing practice (already in use)

`tsc`, lint, and tests on every unit; every review fix has a test that fails without the fix; independent outside review per unit; no review finding is trusted until checked against the code.
