# Workspace split rules (clubs desk)

This folder is the worktree for `feat/clubs-ui-overhaul` and owns ONLY the clubs feature.

- A sibling worktree `C:\Users\LEGION\Desktop\Bookconnect4_library`
  @ `feat/library-shelf-motion` owns the library feature (another live session works there).
- Never touch its paths: `docs/user/library/*`, `app/(tabs)/library/*`,
  `src/components/library/*`, `src/components/notes/*`, `src/features/books/*`,
  `supabase/migrations/*library*`, `supabase/functions/ocr-fallback`,
  `assets/sounds`, `e2e/library-vault-smoke.spec.ts`, `flows/`, `serve19006.js`.
- Both trees share Supabase project `ahntbtktjjmvfosgkmgn` — do not apply migrations
  without checking the library tracker for conflicts.
- Dev-server ports: this desk uses 8081 defaults; the library session uses 8083+ when simultaneous.
- Stay on `feat/clubs-ui-overhaul`; do not run `git checkout`/`git switch`.
- `stash@{0}` holds the library tracked-edit backup — leave it alone; never pop or drop.
