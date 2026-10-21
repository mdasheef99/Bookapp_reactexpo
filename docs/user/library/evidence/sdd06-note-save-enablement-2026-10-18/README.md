# Manual-note saving enabled — connected acceptance

Date: 2026-10-18 (Asia/Calcutta).
Work unit: `library_sdd06_note_saving_enabled_connected_verified`.
Status: all four source capabilities enabled; signed-in web create/reload/edit/delete and bounded connected adapter checks PASS. Full native/release acceptance is separate and remains open.

## Authority and scope

Owner instructed: “now why dont you enable the note saving process then?? what is the issue”. This resumes the earlier stop after migration application and authorizes the necessary bounded synthetic-note verification, cleanup and local source enablement. No new migration, account creation, unrelated record edit, Storage/provider change, commit, push or deployment. Marketplace Phase9 Unit7C/M46 routing is unchanged. Starting checkout: codex/library-cover-shelf, HEAD `8bce62e610406fc7a56bff29c65c74d3d16b4c4f`; existing mixed changes preserved.

Fresh MCP get_project verified ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo / ACTIVE_HEALTHY. The reviewed correction remains live as `20261017083830`; the preceding same-day safety recheck confirmed its stored SQL MD5/bytes and installed metadata protections. No correction was replayed or changed.

## Connected adapter acceptance before default enablement

The authenticated existing browser session was used without extracting or exporting its credentials. Temporary development route [archived probe source](./acceptance-probe.tsx.txt) called the actual production save/delete adapters with explicit isolated true gates, plus real Supabase SDK requests. Default source gates were still false during this probe. No transport mock replaced Supabase. The route was removed afterward and is absent from the final app/export.

Target: already-owned Clean Code entry `893c885c-ca7c-4cdc-bf82-3e880e9061fb`. Initial note list was empty. Run `e7454248-5014-4627-a61b-47055d57466b`. All note content was synthetic and visibly labelled ZZ_TEST NOTE_SAVE_20261018. Browser AX readback and inline screenshot showed:

- PASS create/read round trips: quote, reflect, distill, apply, question and SQL null. Version 1 and server metadata returned; supplied positive page/omitted page retained.
- PASS two concurrent real PostgREST edits of version 1: exactly one accepted and one conflict, version 2, unchanged creation date.
- PASS stale compared replacement yields zero rows; current version replacement succeeds once to version 3.
- PASS legacy-compatible update advances to version 4, clears marker, preserves creation date and overrides its supplied old updated_at.
- PASS attempts to update created_at, version or identity rejected. Invalid category, page zero, all-whitespace and 501 FEFF-separated words rejected.
- PASS forged-owner and unowned/nonexistent-parent insertions rejected. Actual anonymous PostgREST read/edit/delete denied.
- PASS duplicate stable-create UUID leaves exactly one row; read-only reconciliation confirms that exact existing submission.
- PASS actual committed write followed by injected response loss at the adapter boundary: real coordinator confirmed through a GET and dispatched exactly one write. This is an explicit post-commit application-boundary injection, not a physical network-disconnect test.
- PASS absent, mismatched and deleted outcomes remain unconfirmed; owned deletion succeeds.
- PASS cleanup: zero run notes; original zero target-book note identities preserved.

Seven successful synthetic rows were created by this probe and all removed. Forged/invalid/duplicate attempts did not add records. No existing user note or review was edited.

## Live SQL-role authorization probe

Within one BEGIN/ROLLBACK on the verified shared project, SET LOCAL ROLE authenticated and scoped request claims tested one synthetic owner note. Owner insert/read/delete succeeded; a different actor claim could not read/update/delete it, and spoofed-owner insertion raised insufficient_privilege. All effects rolled back. This is live PostgreSQL role/RLS proof, not a second independently signed-in Auth account. No account was provisioned or impersonated through Auth.

## Default source change and normal UI verification

Enabled ownedBookWrites, stableCreateReconciliation, optionalFiveCategories and serverManagedEditVersion together in manualNotesGateway.ts. Database RLS, column grants, constraints and version predicates remain enforced. Both create/edit and the existing gated delete adapter are enabled. No unconditional edit fallback, auth bypass or new persistence system was added.

On the fresh localhost:8083 Metro app, through normal production screens:

1. Book Details -> Add note -> Question -> Write note, blank editor.
2. Save labelled synthetic body with page 18 -> confirmed saved reader.
3. Reload -> exact body, Question and page 18 remain.
4. Edit -> change body, choose No category and clear page -> Save changes -> reader.
5. Reload -> edited body remains; category/page omitted. MCP readback of only this synthetic record confirmed tag=null, page_number=null, version=2, operation marker present and expected body equality=true.
6. Delete confirmation -> Keep note -> reopen confirmation -> Delete -> empty collection; reload remains empty.

Synthetic UI note ID: `d11fbf07-7a6d-41be-9568-63a8eb183090`; label ZZ_TEST NOTE_SAVE_UI_20261018. One row created, edited and deleted. A final metadata/count readback confirms zero notes on the target book and zero explicit synthetic IDs; correction ledger version unchanged. One initial count-only readback query had an extra parenthesis; it failed without effects and was corrected.

Total committed test-note creation: eight rows across adapter and normal UI checks, all deleted by exact run IDs. Separate SQL-role probe was rolled back. No business data outside these created test notes changed.

## Regression evidence and limits

New default-capability assertion failed before enablement (four false values vs expected true), then passed after the source change. Existing fail-before-dispatch tests now instantiate explicitly closed capability adapters; mounted held-save/delete tests remain. The default delete test proves owned-book dispatch with enabled source capabilities.

- Focused notes/capture tests: **15 suites, 182/182 PASS**, [full output](./jest.txt).
- Initial five-suite transition check: **86/86 PASS**.
- Disposable PostgreSQL: **34/34 PASS**, exit 0 after checked temporary cluster cleanup, [remaining streamed output](./postgres-tests.txt). This file starts with test 2 because test 1 streamed in the initial tool response; the full TAP summary and exit were observed. It includes historical defect reproduction separately from forward-correction acceptance. Sandbox child-process EPERM required a reviewed retry outside the sandbox; no database URL input or shared connection was used.
- Scoped Library TypeScript: PASS, [output](./typescript.txt) (empty successful output).
- Final web export: PASS, [output](./web-export.txt), `.tmp/sdd06-save-enabled-20261018`, entry `entry-bcb205393c9062fa3611d6102c664855.js`. Temporary acceptance route absent; [closeout facts](./closeout.json) record source/export hashes, four true gates, empty index, unchanged migration sources and twelve verified receipt pointers.
- Phase9 continuity: PASS, 195 requirement definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown/55 required files; [output](./continuity.txt). New receipt-relative links and all twelve owning-document receipt pointers resolve; git diff --check PASS ([output](./whitespace.txt), existing CRLF notices only).

No fresh full-repository Jest/TypeScript, physical Android/iOS, camera/picker, TalkBack, hardware Back or complete SDD06-07 release acceptance is claimed. Actual cross-account session switching is covered by existing local regressions, not two fresh Auth logins here. Existing W01 web Alert.alert feedback debt and other separately recorded Library issues remain. Native crop/OCR receipts retain only their previous scope. No durable drafts, cloud OCR, new standalone passages or numbering were added.

## Handoff

Saving is enabled in local source and the running 8083 development app; nothing was deployed. Metro remains running and the browser is handed off on Clean Code Book Details, with zero notes after cleanup and Add note ready. Existing default closed-gate statements in older receipts describe historical checkpoints. Current SDD/tracker overlays point here. Temporary acceptance route is removed; archived source remains evidence only. Changes are uncommitted alongside pre-existing work; nothing staged or pushed. Next action: use the enabled local notes journey; full native/release verification remains a separate pending unit. No further shared mutation or publication is part of this completed enablement task.
