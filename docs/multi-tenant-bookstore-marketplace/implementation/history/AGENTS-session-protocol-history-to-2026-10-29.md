# Preserved history: AGENTS.md

Source file: `AGENTS.md`

Source commit: `5face78`

Moved on 2026-10-30. Literal Markdown blocks preserve the original text and order.
Use the relocated link index below; link text inside literal blocks is historical.
This archive does not grant current authority.

<!-- original-lines: 48-54 -->
````markdown
1. Resolve the repository/worktree root, current branch, and `git status --short`. Preserve unrelated user changes.
2. Read [the marketplace active-phase router](./docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md).
3. Read [DOC-13](./docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md) for global status, blockers, and the authoritative active phase.
4. Follow the ordered reading list in the active-phase router and its session-start document.
5. Read [`CODEBASE_MAP/README.md`](./CODEBASE_MAP/README.md) and follow its reading order for the area you are touching. The map is orientation only: it never gives status, next actions or product rules.
6. Inspect the relevant current code and migrations before assuming the documented target is already implemented.
7. State the current phase, completed milestone, active work unit, next authorized action, blockers, and database-mutation authority back to the user before acting.
````

<!-- original-lines: 70-73 -->
````markdown
1. DOC-13 is the global status authority.
2. `implementation/ACTIVE.md` is the routing authority.
3. The active phase `TRACKER.md` is the local current-state/next-action authority.
4. Detailed phase trackers contain decision and implementation evidence.
````

<!-- original-lines: 104-109 -->
````markdown
- update the local phase tracker for any work performed;
- update DOC-13 when phase/milestone/status/risk/blocker/next action changes;
- update the owning SDD and traceability when behavior or acceptance changes;
- update the data dictionary/current-vs-target audit for schema/storage decisions;
- update the implementation verification tracker with code, tests, migrations, rollout, or operational evidence;
- update `ACTIVE.md`, DOC-13, the phase tracker, and this file's current pointer together when the active phase changes.
````

<!-- original-lines: 134-142 -->
````markdown
1. Re-read the active tracker and record the exact completed scope.
2. Record verification actually run; never imply an unrun test passed.
3. Record database/storage mutations or explicitly state none.
4. Record new decisions, deviations, blockers, and residual risk in their owning documents.
5. If the change altered anything `CODEBASE_MAP/` describes (see the "When to update" table in its README), update the matching map file in the same change, following that README's "Keeping this folder accurate". Never add status to the map.
6. Set one exact next authorized action and active work unit; do not leave vague “continue implementation” text.
7. Update DOC-13 if the global handoff changed.
8. Run the active phase documentation validator and relevant code/security tests.
9. Report uncommitted changes and whether anything was staged, committed, pushed, deployed, or applied.
````

## Relocated link index

Literal source links above keep their original spelling. These links resolve
from this archive and follow moved headings.

- [Source link 1](<../ACTIVE.md>)
- [Source link 2](<../../DOC-13-implementation-tracker.md>)
- [Source link 3](<../../../../CODEBASE_MAP/README.md>)
