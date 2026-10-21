Completed FU-6a, FU-6b and FU-6c. [Full per-unit receipt and grep evidence](C:/Users/LEGION/Desktop/Bookconnect4_fu1a/.spec-out/fu6-cleanup/README.md).

- **FU-6a:** Deleted `NoteEditor.tsx`, `NotesList.tsx`, `TagSelector.tsx` and `NoteEditor.ocr.test.tsx`. Edited the notes barrel, `ocrService.test.ts` and `LibraryAppearance.test.ts`. Searches found no live consumers beyond deleted code/re-exports. Moved two helper cases—single-word character overflow and safe provider-error display—before deletion. Other helper coverage was already duplicated. Removed only the obsolete TagSelector radius assertion; kept ManualNoteJourney’s absence assertion unchanged.
- **FU-6b:** Edited `notesService.ts` and its test. Removed the five specified methods, empty service object and 13 method-only cases. Searches found no direct or dynamic consumers. Kept `ReadingNote`, `NoteTag`/`NoteCategory`, `NOTE_TAG_CONFIG` and its unchanged assertions.
- **FU-6c:** Edited only `useManualNotes.ts`, removing three invalidations. Searches proved no `notesCount` query producer; Book Details derives its count from `notes.length`. Save/delete cache tests remain unchanged.

Intentionally kept without application callers: `userBookPagesService.upsertPage` with `capToVaultLimits`, and `ocrService.recognizePageViaCloud`.

| Verification | Before → After |
|---|---|
| Required Jest set | **44 suites / 815 tests → 43 / 792**, all passing |
| OCR service tests | 16 → 18 |
| Word-cap tests | 12 → 12 |
| notesService tests | 14 → 1 |
| ManualNoteJourney | 21 → 21 |
| Scoped TypeScript | **0 errors → 0 errors** |

The scoped tsconfig exists. Continuity validation and `git diff --check` passed. Library tracker and receipt updated.

Nothing remains undone within the requested units. No installs, network, server or Supabase access. Protected files and existing changes were preserved. All changes remain uncommitted; nothing was staged, committed, pushed, deployed or applied.