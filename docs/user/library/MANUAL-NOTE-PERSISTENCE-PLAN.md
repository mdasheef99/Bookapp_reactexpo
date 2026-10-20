# Manual-note persistence: bounded migration contract

Date: 2026-10-18 availability reconciliation; original contract 2026-10-11
Status: correction 20261017083830 applied; four source capabilities enabled after bounded connected acceptance; full native/release acceptance pending
Work unit: library_sdd06_note_saving_enabled_connected_verified
Behavior authority: [SDD-06](./SDD-06-after-book-entry-ui.md), revision 0.4 baseline with later correction receipts
Evidence: [current application/readback](./evidence/sdd06-forward-correction-application-2026-10-17/README.md); [independent review/local proof](./evidence/sdd06-forward-correction-independent-2026-10-17/README.md); [historical preflight](./evidence/sdd06-persistence-preflight-2026-10-10/README.md)

Current evidence: [2026-10-18 connected acceptance/enablement](./evidence/sdd06-note-save-enablement-2026-10-18/README.md) supersedes the prior application-only stop. Owner requested saving enablement; real adapter and normal web UI create/reload/edit/delete, concurrency, stable create/reconciliation and bounded denials/cleanup passed. Four gates are true. Fresh 34/34 isolated SQL and 182/182 notes/capture tests pass. Full native/release acceptance remains pending. The correction remains applied once as **20261017083830**; no migration was replayed. Subsequent historical authorization/verification sections preserve earlier checkpoints; use this receipt for current availability and limits.

## 1. Scope and authorization

Initial permissions covered preparation/review, followed by one correction application and a stop. On 2026-10-18 the owner resumed the task by requesting saving enablement. Necessary bounded synthetic-note writes/cleanup and local capability enablement are now complete in the current receipt. No unrelated DDL or publication was authorized. The remaining protocol/hold checkpoints retain their historical context; native/full release acceptance is still pending.

Manual notes begin inside an already-open book. Preserve the five approved labels, optional category/page, blank editor, explicit saving, contextual exits, body-only Copy and existing Saved Pages access. This persistence unit changes no OCR/UI scope. Later authorized capture/OCR work is recorded separately in SDD-06; the original proposal's OCR sequencing is historical. Shelves, numbering, cloud, new passages and durable drafts are not added by this contract.

Marketplace Phase 9 Unit7C/M46 routing/global authority remains unchanged. The shared project has later migrations than this checkout's retained marketplace handoff. This is an integration constraint: later application must target freshly verified Library objects only, not replay every pending local migration.

## 2. Pre-correction verified state versus required target (historical baseline)

The target has now been installed by the exact forward correction; use the application receipt above for actual live state. The table records the pre-correction difference that motivated the work.

Fresh 2026-10-11 Supabase MCP planning readback verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063, ap-southeast-2 and unchanged variant `20261010221843`. Both worktree trackers were read. [Actual catalog](./evidence/sdd06-live-session-review-2026-10-11/forward-plan-baseline.json) is the current-state evidence; historical unmigrated-baseline receipts remain separately dated.

| Object / gate | Verified current state | Proposed target |
|---|---|---|
| reading_notes.tag | Nullable; quote/reflect/distill/apply/question or null | Preserve all five identifiers/null |
| page/content | Nullable positive integer page; nonempty content; 500-word CHECK | Preserve all three constraints; no truncation or changed limits |
| reading_notes.version | Integer NOT NULL default 1, positive CHECK; revision trigger increments | Preserve fields/values and server increments |
| last_operation_id | Nullable UUID; current identified-edit marker | Preserve; no durable operation history |
| updated_at / created_at | Invoker trigger sets write times; created_at remains client-writable on UPDATE | Server updated_at; preserve OLD.created_at on UPDATE; deny client metadata writes |
| note/book binding | Validated composite ownership FK, parent key and owned-book PUBLIC policies | Preserve FKs/key; target authenticated policies with complete checks |
| client privileges | anon table access denied; authenticated table-wide CRUD remains | Minimal insert/update columns; preserve SELECT/DELETE/service access; direct revision-function EXECUTE revoked |
| reconciliation | Client stable create UUID and edit-marker checks scaffolded, gates false | Positive canonical-row evidence for exact operation; no uncertain write replay |
| manual acceptance | Local correction/browser evidence only | Real persistence/concurrency/security plus native journey acceptance still required |

Aggregate read-only integrity: 2 notes, 0 missing books, 0 note/book-owner mismatches, 0 null note timestamps. No note content, row IDs or account identities were fetched. These counts are a migration precondition sample, not security or concurrent-write proof. Recheck immediately before later application.

Historical 2026-10-10 synthetic SELECT probes: 500 words accepted; 501 and mixed-whitespace 501 rejected. Blank input is accepted by the helper but independently rejected by nonempty content. Not rerun in this correction; preserve that division.

Historical pre-application UPDATE omitted WITH CHECK, defaulting to USING; it did not establish arbitrary note-user reassignment. Current live policies explicitly check actor/owned book, and the validated composite FK binds ownership. Remaining discrepancies are column/function privileges, policy role targeting and creation-metadata preservation, as specified in the forward plan.

## 3. Smallest proposed schema change

The original reviewed candidate `20261010172118_library_manual_note_persistence.sql` describes the target below but was not applied byte-for-byte; the different live variant already has the fields/FK. Preserve the original file, do not replay its unmigrated-baseline checks, and use the separately authorized forward plan to correct only remaining differences:

1. Drop tag's NOT NULL and replace its four-value CHECK with the five existing storage identifiers. SQL null represents no category. No rewriting old labels or backfilling null to Thought.
2. Add version integer NOT NULL DEFAULT 1 with a positive CHECK. Existing notes start at version 1; this is a concurrency baseline, not a reconstructed revision history.
3. Add last_operation_id UUID NULL, initially null.
4. Add a BEFORE INSERT OR UPDATE trigger and a schema-qualified SECURITY INVOKER trigger function with pinned search_path. Do not grant browser roles direct execution unnecessarily.
5. Add UNIQUE (id, user_id) on user_books and a composite FK from reading_notes(user_book_id, user_id) to user_books(id, user_id), ON DELETE CASCADE / ON UPDATE RESTRICT. Keep existing FKs initially; prove the combined cascades in disposable tests. Add no generic user_books field/default changes.
6. Replace the four notes policies with authenticated policies requiring both actor identity and an owned referenced book; update has explicit USING and WITH CHECK. Preserve RLS enabled.
7. Restrict reading_notes privileges as described below.

Trigger contract:
- INSERT forces version 1, operation marker null and server timestamps; client metadata cannot establish a fake revision.
- Every accepted UPDATE, including an internal legacy service update, sets version = OLD.version + 1 and server updated_at.
- An identified manual edit must supply a fresh operation UUID. If NEW.last_operation_id is unchanged from OLD, clear it: an unmarked legacy update must not retain an old operation's confirmation marker.
- Reject identity changes to id/user_id/user_book_id through the normal notes write boundary. Column grants prevent authenticated attempts; include a trigger invariant if trusted writes must also preserve record identity.
- Fail rather than wrap integer versions at overflow. Generated metadata is not an input to browser INSERT/UPDATE privileges.
- No version history table, durable draft, OCR field or numbering allocator.

Schema migration must fail clearly on unexpected checked catalog/ownership preconditions. Match the fresh word-helper body/execution attributes and effective authenticated/service_role EXECUTE; compare the complete historical policy command/role/permissiveness/USING/WITH CHECK before replacing it. A stricter same-name policy or unavailable helper must not be silently accepted. Do not delete or silently repair incompatible rows or grant helper permissions to resolve drift. If fresh rows violate the composite FK, stop and obtain a separately scoped remediation decision. [Independent review and corrections](./evidence/sdd06-persistence-local-2026-10-10/LUNA-REVIEW.md) record three confirmed guard findings and their regressions.

## 4. Ownership, grants and compatibility

RLS expressions must require user_id = (select auth.uid()) and EXISTS an accessible user_books row with the same id and user_id. Use the existing indexed keys; the composite parent key makes the cross-table ownership invariant transactional, including privileged writes. Do not rely on the client's preliminary book lookup as security.

Authenticated grants proposal:

| Command | Allowed columns / scope |
|---|---|
| SELECT | Note row, filtered by owned-book/actor RLS |
| INSERT | id, user_id, user_book_id, content, tag, page_number; id default still supports the retained internal legacy creator |
| UPDATE | content, tag, page_number, last_operation_id; updated_at allowed only for legacy payload compatibility and overwritten by the trigger |
| DELETE | Owned notes, existing confirmed deletion flow |
| Other | No TRUNCATE, REFERENCES, TRIGGER or MAINTAIN; no UPDATE of identity, version or created_at |

Revoke table-wide INSERT/UPDATE before adding column grants; column revocation alone cannot override a broader table grant. Revoke applicable PUBLIC and anon table/column privileges on this table. Retain intentional service_role access, but no browser service credentials. Verify effective privileges and inherited roles after application, not just SQL text.

TRUNCATE is outside row-level security. Its catalog grant is a privilege defect; no destructive exploit was attempted and this preflight does not claim Data API exposure of a TRUNCATE endpoint. Test SQL-role denial locally, including attempted parent TRUNCATE CASCADE into notes. Broader user_books grants and unrelated shared-table hardening remain separate work unless a denial test reveals a bypass affecting this note contract. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [Supabase column grants](https://supabase.com/docs/guides/database/postgres/column-level-security).

Preserve existing saved notes and Saved Pages. Source inventory:
- manualNoteContract and NoteCard already handle Question/null.
- notesService, retained NoteEditor and TagSelector now support all five/null without relabeling. The retained editor's null configuration crash was reproduced before correction; mounted resubmission and service payload regressions pass.
- Current after-book-entry routes use manual composer/reader. The retained NoteEditor has no production JSX caller found in the bounded app/books/notes search, but remains exported and tested.
- Before new values become writable, verify every retained reader/editor/filter and generated DB type. Adapt or retire unreachable legacy paths deliberately; never relabel Question/null.
- Legacy notesService.updateNote uses ID-only UPDATE and a client timestamp. Database increments invalidate stale manual versions, but this alone does not give legacy ID-only writers conflict protection. No global “all clients are CAS-safe” claim is permitted. Ensure active editing routes all use the versioned manual boundary before release.

## 5. Atomic saving and reconciliation contract

### Create

Use the immutable submission's stable note UUID, actor, book and exact normalized payload. One database INSERT plus the primary key prevents duplicate records for that identity. Do not use upsert to replace an existing note.

An ambiguous error leaves the operation uncertain. Read only the same note/book/account. Confirm only an exact identity/body/category/page match. A UUID collision or mismatched row is not confirmation. A missing row is not proof a timed-out write failed; keep the operation unresolved while the current session has it, with informed Leave. Other notes remain usable.

### Edit and explicit replacement

Use one conditional UPDATE with id, user_id, user_book_id and version = expectedVersion in its predicate; request the returned row. Send exact submitted fields and operation UUID. The server trigger increments once.

A returned row confirms only with exact payload/identity, version = expectedVersion + 1 and matching last_operation_id. An explicit Replace uses the version of the record actually compared. A newer version causes another conflict, preserves the draft and refreshes comparison.

PostgreSQL re-evaluates an UPDATE's predicate after a concurrent writer commits, so the version predicate belongs in the actual write. Two simultaneous writers starting from the same version must yield exactly one accepted edit. A prior read followed by unconditional UPDATE does not satisfy this rule. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

A zero-row response needs one canonical read:
- Exact same operation marker, next version and submitted payload: already-applied operation can be positively confirmed without another UPDATE.
- Accessible differing row: conflict; preserve submitted draft and show comparison.
- Missing/unavailable row: preserve draft with generic unavailable feedback; do not leak ownership.
- Ambiguous transport result: reconcile read-only; do not automatically resubmit or substitute a new operation ID.

The bounded adapter correction now first recognizes an exact already-applied operation and validates returned version/identity/payload/timestamp shape. Mocked transport regressions cover this behavior and late account/aborted responses; they do not establish real PostgREST or remote persistence acceptance.

### Limits of the minimum design

The marker is the current row's last identified edit, not an operation journal. Subsequent edit/deletion can erase positive evidence. In that case an older unknown operation may stay unconfirmed; it must not recreate a deleted note or report definite failure/success without evidence.

Leaving/reopening uses the existing account-scoped in-memory pending entry. Restart loses that receipt/draft; no restart replay or durable recovery is promised. The canonical Notes collection still contains whatever committed. Durable server receipts would be a separate scope decision if later requirements demand confirmation after intervening changes.

The coordinator's bounded status read must honor abort/deadline/account switching even if a future client retries reads. Locally installed supabase-js is 2.89.0; the documented automatic GET/HEAD retry feature begins at 2.102.0 and does not retry writes. This unit upgrades no dependency and does not assume the later behavior exists locally. Verify the installed transport during the implementation tests. [Retry changelog](https://supabase.com/changelog/45071-automatic-postgrest-retries-for-transient-errors).

## 6. Verification before any write gate opens

This matrix remains the release contract. The current exact-applied-variant forward correction passes 34/34 isolated SQL cases, including the confirmed internal-FK-state guard fix. The original sixteen-case candidate, 142-case deletion checkpoint and 222-case client checkpoint remain historical receipts, not real API/native acceptance. SQL-role proof does not open a write gate.

| Gate | Required evidence |
|---|---|
| optionalFiveCategories | Real round trips of all five identifiers and null; correct rendering/filtering/edit persistence; invalid tag rejected |
| serverManagedEditVersion | Two real PostgreSQL connections competing at the same version; one wins; next version returned; stale ordinary and explicit replacement rejected; legacy update invalidates stale expected version |
| stableCreateReconciliation | Stable UUID duplicate attempt creates no second row; injected response loss after commit positively reconciles; before-commit failure stays honest; mismatched/missing/deleted/intervening edit evidence cannot falsely confirm |
| ownedBookWrites | Owner CRUD allowed; anon/foreign actor/foreign book/reparenting/identity spoof denied; parent ownership changes cannot strand notes; dangerous table privileges denied |
| trigger/marker contract | Server overwrites forged versions/timestamps; insertion marker null; fresh edit marker returned; unmarked/no-op legacy update increments and clears stale marker |
| transport/UI integration | Real PostgREST returned-row and zero-row decoding, aborts, account switch, correct draft/conflict/leave behavior; mock tests distinguished from DB proof |
| retained behavior | Existing 500-word/nonempty/page constraints and delete cascades; saved notes/categories and Saved Pages access unaffected |
| catalog preconditions | Unexpected applied ledger/catalog/function/policy/ACL/grant-option/internal-FK-state drift aborts atomically; rejected drift preserves note/parent metadata, internal trigger states and ledger contents. Existing columns/versions/markers are preserved, not added or reset |
| manual acceptance | Connected create/read/edit/delete plus keyboard, Android Back/navigation, TalkBack, large text and visual consistency on a representative device |

The authorized disposable PostgreSQL environment and synthetic fixtures have been used. Shared application/readback is now complete. Later connected test-record writes/cleanup and gate enablement need their own instructions and exact-project reverification.

Keep the four source gates false until matching receipts exist; review them together before shipping full manual saving. A migration readback does not prove race/denial/transport behavior. Current local regression results are in the preparation receipt; historical corrected 8083 browser evidence remains valid only for its recorded scope and was not rerun here.

## 7. Ordered next work and authority gates

1. Completed: owner authorized one Library migration file, disposable verification and necessary bounded local adapter/compatibility corrections; gates remain false and live application/test writes are excluded.
2. Completed: Supabase CLI created the fresh candidate; filename/hash/effects/verification are recorded in the active migration ledger. The upgrade is tested against the relevant catalog projection, not every shared migration or sibling runtime. Already-applied files were not altered; no blanket push occurred.
3. Completed: bounded deletion coverage, forward plan, CLI-generated local forward file and isolated verification; fresh independent review found one P2 FK-state guard gap, parent confirmed it before correction, and the corrected suite passed 34/34. See the current receipt for original/final hashes and limits.
4. Completed: separately authorized application/readback, live **20261017083830**, exact SQL SHA256 match. Do not replay/edit either applied artifact. All four source gates stay closed. Exact next action: **stop per owner instruction**.
5. With separate test-write authority, use account-owned synthetic notes, real returned-row/timeout/conflict/denial evidence and approved cleanup. Gate enablement and native/manual release acceptance remain separately authorized. Capture/OCR has its own existing implementation/evidence; this persistence handoff does not restart or expand it.

Estimated effort: a bounded backend unit plus a transport/compatibility verification unit and native acceptance. Schema changes are small; concurrency, uncertain outcomes and privilege testing are the substantial work. No claim that the first manual slice is finished.

## 8. Reference and handoff notes

The Supabase changelog's new-table exposure change does not automatically repair existing reading_notes grants. This proposal adds no new exposed table and makes grants explicit. No project-wide default-privilege change is proposed. [Supabase exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

Advisor readback contains no reading_notes/user_books-specific security finding, which is not a security PASS. Relevant performance findings: auth function evaluation in all four policies on each table, unused note-tag index, and missing parent book_id FK index. Use initplan-style auth calls in the changed notes policies. Preserve current indexes; unrelated parent indexing/policy optimization is not added to this migration.

Current handoff: [application/readback](./evidence/sdd06-forward-correction-application-2026-10-17/README.md), unit library_sdd06_forward_correction_applied_readback_complete_owner_stop. Exact next action: stop; await a new scoped instruction before any connected tests/cleanup or enablement. Earlier preparation/review/SQL receipts remain historical. Only the reviewed correction was applied, with no business-row DML or Git publication.

