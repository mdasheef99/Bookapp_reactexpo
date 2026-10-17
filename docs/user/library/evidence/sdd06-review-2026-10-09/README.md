# SDD-06 focused review reconciliation evidence — 2026-10-09

This receipt preserves the inputs and bounded checks behind SDD-06 revision 0.2. It is evidence, not product-decision authority or implementation acceptance.

## Inputs preserved verbatim

| File | Origin | SHA-256 |
|---|---|---|
| [behavioral-review.txt](./behavioral-review.txt) | Owner attachment ed91c1c7-6219-4e03-9443-630df5438473 | 2DB778213B0D13AF77422A01771DBD3B6B29C25E7DD598366569F6377EF73DB6 |
| [visual-review.txt](./visual-review.txt) | Owner attachment 49dcf3d6-2d8f-4ccc-a5eb-8db2bf896f14 | 0F40C86DD890D8CFEB0EDA60654A46F1C41279452C6034B75AB4DE110E0D659C |
| [owner-controlled-refinement-task.txt](./owner-controlled-refinement-task.txt) | Earlier owner-pasted executable task, attachment 74a4c3c2-9ade-49cd-87f3-226df2b8bdd8 | 475816631C8240F22095776AEB676D41C02385726428D50F4B393E2C3E2A64AF |

The third input explicitly retains optional categories with Skip/No category and defers cloud OCR/standalone passage creation. Those decisions are not reopened merely because a later reviewer lacked that context. It also keeps B12 policy and numbering unresolved. Latest owner request asks for analysis and a consistent plan; it does not authorize app coding, fresh Stitch generation or database writes.

## Bounded local inspection

Branch codex/library-cover-shelf; repository C:/Users/LEGION/Desktop/Bookconnect4_library. Existing mixed changes were preserved. Read SDD-06, current Option B references/Library tracker, the category rollout, relevant SDD-02/03 scope, and the mandatory marketplace continuity chain.

Inspected notesService.ts, NoteEditor.tsx, ocrService.ts, VaultPagesList.tsx and Book Details. Findings: four non-null client categories; direct insert/update returning records; 500-word prechecks; no stable create-operation ID in current API; reachable cloud retry and cloud-directed error copy; immediate recognition of original capture URI; Saved Pages exposes excerpts and confirmed deletion, not a full reader. This is a targeted preflight, not a new whole-app audit.

## Fresh Supabase read-only receipt

Supabase MCP get_project verified:

- Project Bookconnect_reactexpo, ref ahntbtktjjmvfosgkmgn.
- Status ACTIVE_HEALTHY; region ap-southeast-2.
- Host db.ahntbtktjjmvfosgkmgn.supabase.co; PostgreSQL 17.6.1.063.

Three execute_sql calls used SELECT only: catalog columns/constraints/indexes/policies/triggers/named routines; security/function/owner metadata; synthetic word-limit inputs. No private note content, users or book records were fetched. No migration history, Storage or business records were changed. This is not a full database/security audit.

| Observed reading_notes metadata | Result / interpretation |
|---|---|
| tag | text NOT NULL; check permits quote, reflect, distill, apply only; Question and null currently rejected |
| page_number | nullable integer; check page_number IS NULL OR page_number > 0 |
| id | UUID NOT NULL default gen_random_uuid(), primary key; existing schema may support a stable create ID but current client does not implement that strategy |
| content | text NOT NULL; btrim(content) nonempty check; check_note_word_limit(content) check |
| created_at / updated_at | nullable timestamptz, default now(); no verified versioned edit command |
| Sequence / triggers | No sequence/display-number column; no non-internal reading_notes triggers |
| RLS | Enabled; owner predicates auth.uid() = user_id; user_books SELECT uses its own user_id predicate |
| Foreign keys | user_book_id -> user_books.id and user_id -> auth.users.id, both cascade on parent deletion; this alone does not enforce that the selected book belongs to the note owner |
| Privileges | anon/authenticated have broad table privileges including TRUNCATE; require a scoped privilege/owner-binding security preflight and denial evidence before release |
| Named routine inspection | Only check_note_word_limit matched the bounded reading_note/check_note_word_limit search; current inspected client uses direct REST writes, not a reconciliation command |

Synthetic probe executed:

```sql
SELECT
  public.check_note_word_limit(repeat('w ',500)) AS accepts_500_words,
  public.check_note_word_limit(repeat('w ',501)) AS accepts_501_words,
  public.check_note_word_limit(E'one\ntwo\tthree') AS accepts_mixed_whitespace;
```

Returned true, false, true respectively. This proves that bounded function behavior; no actual create/edit or RLS-denial test was run. Question/No category enablement, safe uncertain-create/edit reconciliation, actor/book owner binding and privilege acceptance remain technical gates. No migration plan is approved or applied by this receipt.

The Supabase skill was read for this preflight. Its changelog Markdown fetch returned unsupported content type; no Supabase SDK/API/schema implementation was attempted or inferred from current documentation.

## Evidence boundaries and reconciliation

The behavioral review supplies justified concerns about scope provenance, roadmap naming, legacy/cloud access, save uncertainty, capture work, replacement origins, partial acceptance and stack behavior. The visual review supplies page-family/hierarchy recommendations and identifies insufficient current visual evidence. Revision 0.2 resolves those as a planning contract; proposed policy/refinement choices remain identified as proposals.

All B01–B16 identifiers are preserved. No browser/Stitch inspection or mutation, screenshot generation, prototype interaction, application/native test, persistence write, migration, Storage mutation, deployment or Git publication was performed in this revision. Earlier static screenshot inventories remain historical observations. Documentation validation is recorded in Library TRACKER after actual execution.
