# Agent workflow for builder units

How a slice is split, briefed, built and checked when cheaper models build
and the orchestrator briefs, checks, decides and commits. This file is
process only. It gives no status, no product behaviour and no authority:
those stay with [ACTIVE.md](ACTIVE.md), the SDDs and the Owner.

Adopted 2026-11-10 (Owner: "I leave it to you, make the corrections").

## Durable rules

These hold whichever models are in use.

1. **One command decides.** `node scripts/verify-phase9.js` must pass before
   every local commit; add `--full` before any push or deploy. It builds the
   workers with the same commands the Dockerfiles run, typechecks, runs the
   Phase 9 Jest suites and the migration-set check. A model's "tests pass"
   is not evidence; this command's output is.
2. **Tests are the contract for the hard rules.** For the two or three
   hardest rules of a unit, tests are written first, from the unit's table
   of states or receipts, and reviewed before any production code. They must
   fail first for the stated reason.
3. **Real path early.** The first unit of a slice gets one thin end-to-end
   path working against real SQL (the PGlite or native harness). Every later
   unit keeps it green. A test fake must refuse whatever the real database
   refuses; a permissive fake is a defect.
4. **Contract table before splitting.** Before a slice is cut into units,
   the orchestrator writes one table: producer unit, consumer unit, what
   crosses the boundary, and the rule at that boundary. Every boundary has
   an owner unit.
5. **One rule per unit.** A unit carries one hard invariant. Unrelated
   fixes go in their own unit.
6. **Facts come from the source.** Function signatures, argument names and
   return shapes are quoted from the latest migration that defines them,
   never from memory or an older brief. `node scripts/phase9-sql-facts.js
   <function name>` prints them (latest definition, header, raised codes,
   grants in that file); paste its output into the brief's Facts section.
7. **Independent review, findings as tests.** A different model reviews
   than built. A finding above Minor is a failing test or an exact input
   and wrong output; opinions without one are dropped.
8. **Every review finding becomes a test** before it is fixed.
9. **Add one step, retire one.** A new check replaces an older one. The
   prose rule it covers leaves the brief.

## Unit flow

| Step | Who | Output | Gate |
| --- | --- | --- | --- |
| 1. Contract table (once per slice) | Orchestrator | Boundary table | Owner sees product questions |
| 2. Brief | Orchestrator | One clean brief, corrections merged in place | Brief review for builder briefs only |
| 3. Plan run, read-only | Builder | Plan file (template below) | No deduction left that reading could close |
| 4. Tests first | Builder, same session | Failing tests for the hard rules | Orchestrator reads the tests; red run matches the plan's prediction |
| 5. Build | Builder, same session | Code plus build report | `verify-phase9.js` passes |
| 6. Review | Different model | Findings as failing tests | At most two fix rounds, each in a fresh session |
| 7. Decide and commit | Orchestrator | Local commit | Core diff read; verify output attached |

Small read-only briefs (browser checks, lookups, readbacks) skip steps 1,
3, 4 and the brief review.

## Plan file template

The first part is what the orchestrator reads. Keep it to about 150 lines.

```text
PLAN <unit>                         (read-only run; no file changed)

1. Table of states or receipts      every input the code must handle -> required outcome,
                                    each row with its SDD or SQL citation (file:line)
2. Planned changes                  per file: what changes and why
3. Tests                            name | function it calls | mutation it catches |
                                    predicted failure message before the code exists
4. Boundaries                       what this unit consumes and produces; which other
                                    unit owns each neighbour
5. Deductions                       each unknown | what would close it | closed by reading? |
                                    left for the Owner or for a real run
6. Open questions                   product questions only
7. Verdict                          READY TO BUILD only if section 5 has no row that
                                    reading could close; otherwise NOT READY and why

APPENDIX (checked mechanically, not read in full)
A. Files read in full, with line counts
B. Current behaviour, with citations
C. Commands, in order
```

## Brief skeleton

```text
<ROLE> (<read-only | build>). Repo <single path>; touch no other folder.
Forbidden: <edits outside scope, git writes, database, network, deploy>.

Goal and why                      2-4 lines
Authority                         SDD sections and migrations; the source wins over this brief
Facts                             signatures and return shapes quoted from the latest migration
The hard rule                     stated once, plus the table of states it must satisfy
Start here                        files to read in full first
Tests                             which tests come first; add only at the end of a describe
When stuck                        list a question; never invent a design
Report                            saved to <path>; verdict line; evidence; what was not run
```

Review briefs end with a fixed report shape: a verdict line, findings with
severity, `file:line` and the failing test or exact input, and one
`COVERED:` line per question asked.

## Model-specific notes

Confidence percentages, citation spot-checks and wording tuned to one
model's habits are kept in the orchestrator's working notes, not here.
They change when the models change; the rules above do not.
