# Manual-note persistence safety verification

Date: 2026-10-17 (Asia/Calcutta)
Work unit: `library_sdd06_persistence_safety_verification_complete_correction_held`
Status: approved existing local PostgreSQL harness complete; correction not created or applied; four production write gates false

## Scope and authority

The owner said "ok proceed it in a systematic manner and complete it please" immediately after the explicit request to run the existing disposable PostgreSQL harness. This unit executes that local verification and records the bounded correction requirements from the preceding analysis. It does not infer authorization to create a new migration, resume the held correction, apply DDL to Supabase, write connected test notes, enable gates or publish Git changes.

Checkout: `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`, HEAD `1b743a13328ec30280a524aaeea15e364fc3d6c5`. Existing mixed modified/untracked work was preserved. Marketplace Phase 9 Unit7C/M46 and DOC-13/ACTIVE remain unchanged. The separate Book Details reconciliation review remains outstanding.

## Fresh executable result

[Raw stdout/stderr](./postgres-tests.txt): **17/17 PASS**, exit 0, 30.376 seconds. No tests were added or edited.

- Sixteen cases test the old reviewed local candidate against its projected unmigrated baseline. They exercise role denials, constraints, metadata/marker behavior, concurrency, ownership/cascades and baseline-drift rollback.
- One separate case applies the exact stored SQL snapshot for live version `20261010221843` to an isolated synthetic database and commits an authenticated owner's change to `created_at`. It reproduces the deployed integrity defect. Passing that assertion proves the defect exists, not that it is fixed.
- No case applies a new forward correction; no such file exists in this unit. The sixteen candidate cases therefore do not accept the live variant or the future correction.

Command:

```powershell
$env:LIBRARY_PG_BIN='C:/Users/LEGION/AppData/Local/Temp/bookconnect-primary-venue-tools-20261007/node_modules/@embedded-postgres/windows-x64/native/bin'
$env:LIBRARY_PG_TOOLS_NODE_MODULES='C:/Users/LEGION/AppData/Local/Temp/bookconnect-primary-venue-tools-20261007/node_modules'
node --test supabase/tests/library/manualNotePersistence.postgres.test.mjs
```

The now-explicit owner test approval allowed child-process execution outside the sandbox. The existing harness accepts no remote URL; all connections use a new loopback PostgreSQL 17 cluster and synthetic users/books/notes. Its cleanup checks the resolved temporary directory's parent and `bookconnect-library-notes-pg17-` prefix, stops its server and removes only that directory. The run exited zero after the cleanup hook.

## Read-only live analysis immediately preceding this approval

Supabase MCP reverified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063. Stored live migration `20261010221843 library_manual_note_persistence` still has SQL MD5 `d187c32b7b0846e735d6696adff6a7ed`, matching the immutable [applied-SQL snapshot](../sdd06-live-session-review-2026-10-11/live-migration.json).

Catalog evidence: nullable five-category tag and page; version/operation metadata; nine validated note constraints; enabled owned-book RLS; validated composite ownership FK and parent key; one invoker revision trigger with empty search_path. Authenticated INSERT/UPDATE is table-wide and includes creation metadata; the trigger does not preserve OLD.created_at. Anonymous note-table privileges are absent; authenticated has no bypass-RLS, superuser, role membership or dangerous note-table privileges. PUBLIC policy targeting/direct trigger-function execution are contract-hardening differences, not proof of cross-account access.

An aggregate-only integrity read found two notes, zero missing parents/owner mismatches/null timestamps/invalid versions. No note bodies, identities, accounts or credentials were fetched. Aggregate integrity cannot prove historical timestamp authenticity or live API denials.

SELECT-only generated inputs additionally establish:

| Synthetic input | Existing nonempty CHECK | Existing word helper |
|---|---|---|
| Empty or ordinary spaces | Rejected | Accepted; relies on separate nonempty CHECK |
| Only tabs, newlines, nonbreaking or ideographic spaces | Accepted incorrectly | Accepted |
| 501 words separated by ordinary spaces, newlines, nonbreaking or thin spaces | Nonempty | Rejected correctly |
| 501 words separated by U+FEFF | Nonempty | Accepted incorrectly, while the JavaScript counter treats U+FEFF as whitespace |

These probes evaluated expressions only; no note was inserted or updated. The earlier attempt to include `current_setting('lc_ctype')` failed with 42704; removing that unnecessary diagnostic allowed the SELECT to complete. No locale change was made.

Client validation uses [trim/split whitespace rules](../../../../../src/features/books/utils/ocrWordCap.ts). The complete ECMAScript whitespace set, including U+FEFF, must be reflected in the server validation contract. This does not change the 500-word limit. PostgreSQL CHECKs using a changed function require existing-row revalidation; replacing the function alone does not do that. See [ECMAScript whitespace](https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-white-space) and [PostgreSQL CHECK guidance](https://www.postgresql.org/docs/17/ddl-constraints.html).

## Correction and acceptance still required

The [forward plan](../../MANUAL-NOTE-FORWARD-CORRECTION-PLAN.md) now records the extra validation requirements alongside OLD.created_at preservation, minimal write columns, explicit authenticated policies and unnecessary revision-function EXECUTE removal. Preserve required word-helper execution, legitimate legacy payloads, existing content/identities/categories/pages/versions and ownership constraints. Recheck existing records under repaired validation and stop on incompatibility rather than silently repairing them.

Required future evidence: corrected upgrade from the actual applied variant, allowed/denied privileges, trigger compatibility, complete whitespace and 500/501 boundaries, preservation, drift/lock-timeout rollback, two-connection stale ordinary/replacement races, stable-create response-loss reconciliation, real Auth/PostgREST round trips, account-switch behavior and manual/native acceptance. All four production gates remain false.

Five mocked client suites passed 78/78 in the preceding analysis turn; they were not rerun in this approved harness-only step and do not prove database or transport guarantees.

## Artifact identity and final boundary

| Artifact | SHA-256 |
|---|---|
| Reviewed candidate `20261010172118_library_manual_note_persistence.sql` | `EADD4D8A16D87801735EC59A101A95732A59E64E9902A576000B5CF0AAFB291D` |
| Existing PostgreSQL harness | `7A6C4072504357968D38116BFF47627D484EDC758528E49DA2C4057472B0989D` |
| Production gateway/gates | `B8744B2D73B83278EE125CFAB0F3789EA887EB2F57E98B8AFA07EBDDCAACC37E` |
| Immutable applied-SQL evidence JSON | `43F02DBD5CA3CC38DF45EF4A5B028DC0EC3F3BB9E36626227871668EF146A5CB` |

Application source, tests and both migration artifacts were not edited. No dependency installed, shared Supabase/Storage/provider/account write, stage, commit, push, deploy or application occurred. Only evidence and continuity/planning documentation changed. All four listed hashes were checked again after documentation edits and remain equal.

Closeout: Phase9 continuity PASS, 195 definitions, zero duplicates/missing traceability, regression probes PASS, 76 Markdown/55 required phase files; document-size notices remain advisory. Link scan PASS across eight owning Markdown files and 331 relative links before adding the link below; final receipt/plan rescan PASS, 13 links across two files. Repository whitespace check PASS via the validator and final standalone `git diff --check` exit zero. Index empty; source gates reconfirmed four false. [Raw documentation checks](./documentation-checks.txt) preserve exact output. An optional independent CIM process inventory was denied by the OS; no escalation/retry was attempted for that nonessential check. Cluster cleanup is established by the harness's checked after-hook and successful exit, not by a separate process inventory.

Exact next action: owner reviews the verified defects and expanded bounded plan, then explicitly authorizes creation and isolated verification of one forward-correction migration. Shared application, connected test writes/cleanup, gate enablement and publication remain separate boundaries. Historical CLI absence is not a blocker to the completed existing harness run; future migration preparation must freshly check CLI availability rather than treating the old observation as current.
