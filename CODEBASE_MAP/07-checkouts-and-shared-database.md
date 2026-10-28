# 07 — Checkouts and the Shared Database

**Last checked:** 2026-10-24, against the code and the documents it cites.

Work on BookConnect happens in several git checkouts (worktrees) at once,
usually one per feature stream, and on more than one machine. All of them talk
to **one** development Supabase project. This file explains the consequences.
It deliberately lists no branch names, paths or commit hashes, because they
change weekly. Find the current ones with the commands below.

## Before you start

```powershell
git rev-parse --show-toplevel        # which checkout am I in?
git branch --show-current            # which branch?
git status --short                   # what is uncommitted here?
git worktree list                    # what other checkouts exist?
git fetch origin; git log -1 origin/main   # what is the latest main?
```

- Work only in the checkout the user chose. Never edit, stage or commit files
  belonging to another checkout's feature.
- Each branch carries its own copy of the docs. A tracker in one checkout can be
  older or newer than the same tracker on `main` or in another checkout. Read the
  handoff (DOC-13, `ACTIVE.md`, the phase tracker) **in the checkout you are
  working in**, and compare with `origin/main` if they disagree.
- Use only authorization that covers the selected checkout and task.
- `.opencode/workspace-split.md` describes an older two-checkout setup;
  its paths, branches and stash rules are history. The checkout
  and branch names in AGENTS.md's dated sections are historical too, but AGENTS.md
  keeps the rules: edit only the checkout the user chose, keep features isolated,
  use separate dev ports when sessions run at once, and coordinate on the shared
  project. The rest of AGENTS.md (session start, authority, authorization) binds
  every checkout.

## One shared database

Project `ahntbtktjjmvfosgkmgn` is shared by every checkout. That means:

- **The live database can be ahead of your branch.** Migrations applied from
  another branch appear in live history even if their files are not in your
  checkout yet (for example, Library migrations applied before their branch
  merged).
- **Your branch can be ahead of the live database.** A migration file existing
  locally is not evidence that it was applied.
- **Migration numbers can be taken on other branches.** M-numbers are per
  phase, so always say which phase. Before choosing the next M-number for a
  phase, check the highest number on `origin/main`, in other active
  checkouts and in live history. Numbers can also be skipped (an unmerged branch
  may hold a number that `main` never received) or applied out of order.
- **Never replay** another branch's applied migrations, and never apply a
  migration without its own explicit authorization (see AGENTS.md).

Check live state read-only through Supabase MCP (`list_migrations`,
`list_tables`, `list_edge_functions`, read-only SQL) before any database plan,
and again before any application.

## Deployed runtimes are shared too

Edge Functions and the deployed workers serve every checkout. A client change
on one branch may need a matching Edge Function or worker deployment, and
deploying from one branch affects everyone testing against the development
project. Deployments need explicit authorization and are recorded in the
owning tracker.
