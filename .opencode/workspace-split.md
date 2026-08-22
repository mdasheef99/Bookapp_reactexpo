# Workspace split rules — LIBRARY side (loaded via ../opencode.json)

This checkout: `C:\Users\LEGION\Desktop\Bookconnect4_library` @ `feat/library-shelf-motion`.
Owner: **library feature only**.

## Sibling tree
`C:\Users\LEGION\Desktop\Bookconnect4_expo` @ `feat/clubs-ui-overhaul` belongs to a live
clubs session. NEVER edit, stage, or commit clubs-owned paths:
- `docs/user/clubs/*`
- `app/(tabs)/clubs/*`, `src/features/clubs/*`
- clubs-related marketplace paths outside this branch's scope

## Library-only paths (this session's scope)
`docs/user/library/*`, `app/(tabs)/library/*`, `src/components/library/*`,
`src/components/notes/*`, `src/features/books/*`, `supabase/migrations/*library*`,
`supabase/functions/ocr-fallback`, `assets/sounds`, `e2e/library-vault-smoke.spec.ts`,
`flows/`, `serve19006.js`.

## Ports
Clubs 8081 (defaults). Library uses **8083+** when running simultaneously
(`npx expo start --port 8083`).

## Shared backend
Both trees connect to the same Supabase project `ahntbtktjjmvfosgkmgn`. Before any
migration, check BOTH trackers:
- `docs/user/library/TRACKER.md`
- clubs tracker on the sibling tree (read-only peek is fine)

## Stash warning
`stash@{0}` ("library WIP before clubs branch") is a backup of restored tracked edits.
Do not pop or drop it until this branch's next commit lands; afterwards it is safe to drop.
