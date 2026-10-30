# 07 — Checkouts and the Shared Database

**Last checked:** 2026-10-30, against the code and the documents it cites.

Use the single checkout with a plain branch per slice; create no new git
worktrees. Source: [Owner decision OD-2026-10-30-5](../docs/multi-tenant-bookstore-marketplace/DECISIONS.md#log).
Branches and any retained historical checkouts share the development Supabase
project. This file records practice, not current checkout names or live state.

## Before you start

```powershell
git rev-parse --show-toplevel        # which checkout am I in?
git branch --show-current            # which branch?
git status --short                   # what is uncommitted here?
git worktree list                    # retained historical checkouts, if any
```

- **Scope:** edit only the user's selected checkout; preserve unrelated changes and use only task-specific authorization (AGENTS "Mandatory session start" and "Authorization boundaries").
- **Handoff:** read DOC-13, `implementation/ACTIVE.md` and its routed evidence in the selected checkout; branch-local documents can differ.
- **Historical worktrees:** `.opencode/workspace-split.md` and AGENTS.md's dated checkout sections describe the older setup. The Owner decision above owns checkout practice; AGENTS still owns session, authority and shared-project rules.

## One shared database

Project identity and client wiring: [03](./03-backend.md#supabase-client).
One development database serves the branches. That means:

- **The live database can be ahead of your branch.** Migrations applied from
  another branch appear in live history even if their files are not in your
  checkout yet.
- **Your branch can be ahead of the live database.** A migration file existing
  locally is not evidence that it was applied.
- **Migration numbers can be taken on other branches.** M-numbers are per
  phase, so always say which phase. Before choosing the next M-number for a
  phase, check local files, available branch history and MCP live history.
  Unmerged branches can reserve numbers; gaps or out-of-order application are
  not proof that a migration is missing.
- **Never replay** another branch's applied migrations, and never apply a
  migration without its own explicit authorization (see AGENTS.md).
- **Apply through Supabase MCP.** Local sequence-style filenames and live apply-time versions differ; use the owning migration ledger's mapping (03 "Migrations"). Never edit an applied migration; corrections are forward-only (05 "Process rules").

Check live state read-only through Supabase MCP (`list_migrations`,
`list_tables`, `list_edge_functions`, read-only SQL) before any database plan,
and again before any application.

## Deployed runtimes are shared too

Edge Functions and the deployed workers serve every branch. A client change
on one branch may need a matching Edge Function or worker deployment, and
deploying from one branch affects everyone testing against the development
project. Deployments need explicit authorization and are recorded in the
owning tracker.
