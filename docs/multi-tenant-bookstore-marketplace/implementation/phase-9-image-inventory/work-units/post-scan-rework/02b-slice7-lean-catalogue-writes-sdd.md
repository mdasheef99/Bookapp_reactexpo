# Post-Scan Rework — Slice 7 Lean Catalogue Writes, Stats and Shared Cache

| | |
|---|---|
| **Status** | Pass-2 detailed design, revision 1, 2026-10-26. **DRAFT FOR REVIEW / NOT APPROVED FOR BUILD**. Owner answers OQ1–OQ8 are fixed in §14, including the 7a/7b split; design review/approval and the SDD-0/SDD-2 split-map update remain pending. |
| **Parent** | [SDD-2, Slice 7](./02-catalogue-and-matching-sdd.md#slice-7--lean-catalogue-writes-stats-and-shared-cache), under [SDD-0](./00-overview-sdd.md). Pattern and inherited Add contract: [02a](./02a-slice6-catalogue-link-sdd.md), especially §§3–7, 9, 12–14. |
| **Authority** | PSR-D33–D40; R01/R04–R10/R12; Q15–Q21; DOC-3 §§4.2/5.1/5.2/14/17. SDD-0 §15 controls tests, review and separate permissions. |
| **Baseline** | Selected worktree `phase9-psr-slice5b-add-isbn`, branch `claude/phase9-psr-slice6-catalogue-link`. Existing uncommitted M81/M82 artifacts and documentation are preserved. No implementation is performed by this document. |
| **Database evidence** | Supplied [read-only snapshot, 2026-10-25](../../../../../../.claude/psr-slice6/db-evidence.md#L1); [tracker 38, M81 read-back, 2026-10-25](../../trackers/38-post-scan-rework-evidence.md#L1804); [browser evidence, 2026-10-26](../../trackers/38-post-scan-rework-evidence.md#L1806); 02a. These are dated observations, not fresh live verification. |
| **Migration** | Phase 9 **7a and 7b: PROPOSED / NOT_CREATED / NOT_APPLIED**. Migration numbers/filenames are decided with the SDD-0/SDD-2 split-map update; no number is reserved and no creation/application decision is made. M81 is applied as live version **20261025171647**. M82 is reserved for the separate `phase9_edition_identity_change` first-save fix, local file `20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql`; its review/application are outside this task. |
| **Size / risk** | Large / high for implementation: shared identity, completion replay, cache lineage and privileges. §12 assigns each package to the Owner's accepted 7a/7b split (§14 OQ8); the split map must be updated before build. |

This document specifies the settled behavior and a concrete proposed implementation,
and isolates the choices the sources do not settle. **Do not implement an OQ-dependent
branch until its answer is recorded here.** Once those answers and the live preflight
are recorded, the contracts below supply the inputs for red tests, SQL and worker
briefs. Design approval, build authority, migration-file creation, application,
deployment and publication remain separate. No reset, backfill or second provider is
authorized. No database/network access or tests were performed for this draft.

## Contents

1. Goal, inherited decisions and scope
2. Verified code/evidence map
3. Companion contract and transport
4. Proposed data model
5. Functions and security boundary
6. Identity, transactions and locks
7. Write timing, completion and counters
8. Shared cache and second-store behavior
9. Security and grants matrix
10. Compatibility, rollout and rollback
11. Acceptance checks and red-first proof
12. Build packages and review gates
13. Implementation-time documentation and live preflight
14. Owner questions and conflict register

## 1. Goal, inherited decisions and scope

Keep admitted Open Library facts once so another store can reuse them, including
editions without ISBN; record popularity independently of canonical facts; preserve
private Add and complete edition-option results when catalogue identity conflicts
(D33–D40, Q20). No Owner edit or ownership association enters shared data (R04).

**Settled, not questions:**

- M81's Add remains the outer transaction. Extend its private helper, retaining
  `marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)` and its one-row
  coherent-ID-pair/NULL-pair result. Factor a shared identity routine beneath it;
  completion calls that same routine, not an independent identity algorithm.
- Retain M81's exact normalized work key: `btrim(phase9_metadata_normalized_text(t))`
  for title and each author; authors sorted with `COLLATE "C"`, duplicates retained.
  Compare incumbents after normalization, never rewrite their stored keys.
- Insert with **targetless `ON CONFLICT DO NOTHING`**, then re-select in a separate
  statement. Expected real conflicts raise **P9C01 inside a subtransaction**, then
  return a skip after rollback. Never normally return after an intermediate write.
- Incumbent works/editions are never updated, enriched, merged, reassigned or
  repaired. New ISBN-based rows retain `metadata_selection_version='psr-catalogue-isbn-v1'`;
  provider-ID-only new rows use `metadata_selection_version='psr-catalogue-provider-id-v1'`
  (Owner OQ7). Both use `metadata_verified_at=provider fetchedAt`.
- Preserve M81's narrowly recognized oversized-btree-key skip: SQLSTATE 54000,
  message starting `index row size`, and one of its four named catalogue indexes.
  Unexpected database errors propagate; they are not successful catalogue skips.
- Retain the Open Library allow-list and all registry/version/retention/own-cover
  checks. Slice 8a owns replacement by `shared_catalogue_allowed` (02a §6.1).
- **Provider neutrality (Owner 2026-10-26, D32/D35).** Everything M83 and the
  worker add is keyed by `adapter_key`; Open Library is data, not code shape:
  1. The D35 allow-list lives in **one** function,
     `marketplace_sec.phase9_catalogue_shared_admitted_v1` (§5). It is the only
     new SQL that names `open_library`; Slice 8a replaces its body alone.
  2. Provider-specific rules (external-ID grammar, work-reference grammar,
     cover-reference derivation, book/cover URL host) sit in one registry-keyed,
     server-owned validator per provider (SDD-2 Slice 8 "Validation and
     accounting"): a SQL `CASE p_adapter_key` dispatch in
     `phase9_catalogue_provider_ids_valid_v1` (§5) and the adapter's own module in
     the worker. An unknown key is refused, never treated as Open Library.
  3. Public attribution/provenance text, raw retention and revalidation come
     from the provider's registry row (`shared_source_note`, §4.2;
     `raw_retention_seconds`; `revalidation_seconds`), never from a literal.
  4. Tables, the companion contract, cache payload, counters and identity core
     contain no provider-specific column or field name. Each adapter produces
     its own companion; the generic contract carries only provider-neutral keys.
  5. AC7-21 (§11) enforces 1–4 statically and with a synthetic second provider.
- M81's surviving saved-ID path, disappeared-ID fallback, sparse-field hydration,
  manual path and replay-before-helper ordering remain. Manual Adds continue to
  pay the helper's scoped reads; no unapproved optimization bypasses authority.
- D37's blocklist belongs to **Slice 7**, per the Owner's 2026-10-25 decision.
  The set of actual entries and blocked-value fallback are OQ2, not invented here.

**Included:** provider-ID list; OCLC/LCCN companion; hidden/source-note/key-version
columns; source rows; lookup-time catalogue write boundary; work/edition counters;
provenance-safe shared cache; private receipts needed for replay and delayed Add.
**Excluded:** relaxed automatic matcher activation, automatic Open Library routing,
Google disablement, new provider admission, model/categories changes, publication,
stock updates, catalogue reset, historical link/counter backfill, admin UI, fuzzy
reconciliation and refresh/expiry engines. Slices 8/9 remain gated by D38.

Trace: [SDD-0 decisions L197–204](./00-overview-sdd.md#L197),
[rules L257–268](./00-overview-sdd.md#L257),
[Q15–Q21 L603–616](./00-overview-sdd.md#L603),
[process L618](./00-overview-sdd.md#L618); SDD-2 Slice 7 **Write timing**, **Sources
and covers**, **Shared cache**; [02a normalization L366](./02a-slice6-catalogue-link-sdd.md#L366).

## 2. Verified code/evidence map

Paths and starting lines below were inspected locally on 2026-10-26. **NEW** names
in later sections are proposed artifacts and are not claims that those files or
objects exist. Migration shorthand means the exact file in this table.

| Ref | Verified pointer and hand-off |
|---|---|
| C01 | [Worker entry, L94](../../../../../../workers/phase9-metadata-worker/index.ts#L94), route call L144; [bootstrap L50](../../../../../../workers/phase9-metadata-worker/bootstrap.ts#L50), [edition route L8](../../../../../../workers/phase9-metadata-worker/editionProviderRoute.ts#L8). Context/claim becomes a provider request and `executeEditionOptionsLookup`; no automatic OL adapter exists. |
| C02 | [OL adapter L16](../../../../../../supabase/functions/_shared/imageInventory/metadata/openLibrary/adapter.ts#L16): automatic `lookup()` throws. Explicit adapter L19, validated `/works/OL…W` key L48–51, edition JSON L58–73, authors L90–100, normalization L102–104. The work key is currently dropped. |
| C03 | [OL normalizer L55](../../../../../../supabase/functions/_shared/imageInventory/metadata/openLibrary/normalizer.ts#L55): own edition facts; `/books/` stripped to `OL…M` L73; decode L116; ordered rows L135. OCLC/LCCN/work references do not currently survive. [Transport L18](../../../../../../supabase/functions/_shared/imageInventory/metadata/openLibrary/transport.ts#L18) owns approved hosts/paths/budgets; no extra request is needed. |
| C04 | [Metadata contract L18](../../../../../../supabase/functions/_shared/imageInventory/contracts/metadata.ts#L18): strict known keys; `MetadataEdition` L32, adapter regex L119, unknown-key rejection L152. [Stored row L150](../../../../../../supabase/functions/_shared/imageInventory/contracts/ownerEditionPicker.ts#L150) and projection L158. Companion must remain outside both JSON shapes. |
| C05 | [Options worker L121](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptions.ts#L121): exact row keys/lineage; completion L138, lost-response recovery L145. [Boundary L23](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsBoundary.ts#L23) carries fences plus rows; [RPC L43](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc.ts#L43) maps the existing completion arguments. |
| C06 | [Snapshot builder L28](../../../../../../supabase/functions/_shared/imageInventory/metadata/snapshot.ts#L28), `createSelectedMetadataSnapshot` L61: coherent single attempt L70, provider edition provenance L95. [Gateway selection L289](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataProductionGateway.ts#L289) calls `phase9_select_structural_metadata_snapshot`; [terminal persistence L3](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataTerminalPersistence.ts#L3) separately writes best-effort automatic cache/representative cover after terminalization. Neither supplies a transactional options catalogue writer. |
| C07 | [M73 validator L12](../../../../../../supabase/migrations/20261011000073_marketplace_phase9_open_library_edition_options.sql#L12): unknown metadata keys refused L22–23; row shape L65; source policy L90; actual selection body L166–233. M73 remains applied and immutable. |
| C08 | [M68 normalized validator L15](../../../../../../supabase/migrations/20261007000068_marketplace_phase9_edition_picker_worker_completion.sql#L15); completion fence L60, receipt L103, public completion wrapper L284. Automatic-payload guard L495–524 forbids explicit snapshots/cache reuse. Do not remove that protection wholesale. |
| C09 | [M78 current completion L282](../../../../../../supabase/migrations/20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql#L282): claim/candidate fence L290, lookup/attempt locks L300–303, policy L318, row lineage/eligibility L322–350, replay L351, physical receipts L357–380, options/attempt/reservation/lookup/job L389–402. Keep ISBN `edition` stage support. M78, not M73, is the replacement baseline. |
| C10 | [M81 helper L11](../../../../../../supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql#L11): scoped sources L27–54, saved ID L60–115, admitted OL L124–154, ISBN/key L157–170, inserts/re-select L179–200, locks L202–248, skip handlers L250–322, ACL L327. [Add L333](../../../../../../supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql#L333): replay L359, helper L412, receipt L499, ACL L505, canonical revoke L511. |
| C11 | [P3 tables L5](../../../../../../supabase/migrations/20260628000003_marketplace_phase3_inventory_canonical_listings.sql#L5): works, editions L16, source table L36, public canonical policies L154. [M01 registry L4](../../../../../../supabase/migrations/20260722000001_marketplace_phase9_catalogue_metadata_expand.sql#L4); source expansion L34; registry ACL L147. |
| C12 | [M15 cache L65](../../../../../../supabase/migrations/20260728000015_marketplace_phase9_metadata_foundation.sql#L65), attempts L98, immutable selected snapshots L142/177, cache writer L759. Positive cache requires an accepted attempt and identical payload L788–797. SQL adapter grammar L268/L510 permits dots; the worker grammar does not. |
| C13 | [M32 cache read L424](../../../../../../supabase/migrations/20260807000032_marketplace_phase9_structural_metadata_integration.sql#L424), reuse completion L575, leader snapshot dependency L632. [Gateway L86](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataProductionGateway.ts#L86) calls them. They implement automatic selected-result reuse, not explicit alternative lists. |
| C14 | [Gateway parameters L60](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataGatewayContext.ts#L60): existing key L67, always private L90. [Provider-cache identity L95](../../../../../../supabase/functions/_shared/imageInventory/metadata/queryIdentity.ts#L95) omits privacy/store. [Cache contract L3](../../../../../../supabase/functions/_shared/imageInventory/metadata/cache.ts#L3) defines public/private modes and expiry. |
| C15 | [M65 snapshots L166](../../../../../../supabase/migrations/20261007000065_marketplace_phase9_edition_picker_state.sql#L166): canonical cover_url is projected into coverReference; current snapshot L175. [M67 local matcher L10](../../../../../../supabase/migrations/20261007000067_marketplace_phase9_edition_picker_operation_fences.sql#L10) has no hidden filter. |
| C16 | [M70 public selection L25](../../../../../../supabase/migrations/20261008000070_marketplace_phase9_edition_picker_confirmation.sql#L25) wraps M73's private selection. EP_SELECT_V1 replay M73 L184, state lock L191, new selection ID L210, receipt L231. [M05 replay L25](../../../../../../supabase/migrations/20260722000005_marketplace_phase9_controlled_inventory_commands.sql#L25) serializes receipt reservation/fingerprint. |
| C17 | [M17 ACL L5](../../../../../../supabase/migrations/20260728000017_marketplace_phase9_maintain_acl_correction.sql#L5): sensitive tables, including cache, service SELECT only and no MAINTAIN. [M32 original observation fence L285](../../../../../../supabase/migrations/20260807000032_marketplace_phase9_structural_metadata_integration.sql#L285); [M12 observations L69](../../../../../../supabase/migrations/20260726000012_marketplace_phase9_vision_analysis_runtime.sql#L69). [M78 query identity L11](../../../../../../supabase/migrations/20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql#L11) may substitute confirmed Owner text. |
| C18 | [ISBN SQL L37](../../../../../../supabase/migrations/20260807000032_marketplace_phase9_structural_metadata_integration.sql#L37), [worker ISBN L1](../../../../../../supabase/functions/_shared/imageInventory/domain/isbn.ts#L1). M81 adds its local 978/979 guard; do not silently change all callers. |
| C19 | [Catalogue fixture L1](../../../../../../supabase/tests/phase9/catalogueLinkFixture.mjs#L1), [79-test suite L1](../../../../../../supabase/tests/phase9/phase9CatalogueLink.integration.test.mjs#L1), [native catalogue races L1](../../../../../../supabase/tests/phase9/phase9CatalogueLinkConcurrency.postgres.mjs#L1). 02a §7.1 explains essential Phase 3 schema alignment. |
| C20 | [Native runner L1](../../../../../../supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1#L1), isolated catalogue clone L264; [package commands L19](../../../../../../package.json#L19). Current local runner includes M82; that is local code evidence, not evidence of application. |
| C21 | [DOC-3 translations L374](../../../../DOC-3-canonical-books-metadata-inventory.md#L374), match strength L390, coherent provider rule L401, data model §14, deferred merge L965. These source rules and the Owner's amendment govern the OQ3 interpretation; current code alone does not decide it. |
| E01 | [Snapshot L9](../../../../../../.claude/psr-slice6/db-evidence.md#L9), dated 2026-10-25: canonical schema, registry L16, old grants L22, old Add hash L28, data L36, NO ACTION references L59–61. Grant commentary L24 and “next 81” L43 are superseded by later M81 evidence. |
| E02 | [Tracker 38 L1804](../../trackers/38-post-scan-rework-evidence.md#L1804), dated 2026-10-25: helper/Add owner postgres, VOLATILE, SECURITY DEFINER, empty search_path; MD5 `69bd9b40c54a119a61e2782f19c55afb` / `9fe42381cf406d81018417dfc541217a`; helper postgres-only; Add authenticated; canonical clients SELECT-only; no DML during application. |
| E03 | [Tracker 38 L1806](../../trackers/38-post-scan-rework-evidence.md#L1806), dated 2026-10-26: one OL Add, works 1→2, editions 1→2, linked inventory 0→1; new edition stamp `psr-catalogue-isbn-v1`. Not proof of reuse/manual/many-edition browser cases. |

The legacy Hobbit has `title_normalized='the hobbit'` and raw-case authors
`["J.R.R. Tolkien"]` (tracker 38 L1802, 2026-10-25). Its provenance is unknown.
Another ISBN can create a second normalized-key work; a rare interleaving skips
a link, never creates a wrong link or fails Add (02a §13, tracker 38 L1802).
OQ1 carries both limitations; no data repair/reset is implied.

## 3. Companion contract and transport (D35/D37, R06/R09)

### 3.1 Shape and extraction

Introduce **NEW** `contracts/catalogueWrite.ts`, a strict sibling contract, version
`psr-catalogue-write-v1`. Keep `MetadataEdition`, stored option-row keys, M73's
validator and immutable selected snapshot bytes unchanged. The adapter returns an
internal envelope `{ rows, catalogueCompanions }`; project only `rows` into the
existing completion/UI contract. A legacy adapter's missing companions means `[]`.

Each new worker emits exactly these keys (nullable fields use JSON null). For
compatibility, absence of workExternalId, oclc or lccn is normalized to null before
validation/digest; all binding/version keys remain required. Unknown keys are
refused. A present malformed scalar is refused by the companion validator;
malformed original provider arrays have already become null in extraction.

| Field | Bound/check and source |
|---|---|
| version | Literal `psr-catalogue-write-v1`. |
| optionId | UUID of the corresponding stored row; never used in shared rows. |
| adapterKey, adapterVersion, normalizerVersion | Exactly the metadata/attempt/registry values; key regex `^[a-z][a-z0-9_-]{1,63}$`. Nonblank version strings, maximum 128 characters each, matching existing validated versions. |
| lookupId, attemptId | UUIDs equal metadata correlationId/attemptId and the outer scoped completion. |
| providerRecordId | Equals metadata providerRecordId; generic 1–256 safe trimmed characters, then the adapter's own grammar via the provider validator (§1, §5); the `open_library` entry is `^OL[1-9][0-9]*M$`. No URL/path prefix in stored external IDs. |
| workExternalId | Nullable 1–256 safe trimmed characters, then the adapter's work grammar via the provider validator; the `open_library` entry is `^OL[1-9][0-9]*W$`, stripped from the same validated search work key. A direct edition result may supply its own unambiguous validated work reference; conflicting/multiple work references yield null, not a guessed group. No extra HTTP call. |
| fetchedAt | Same timestamp instant as the coherent metadata and completion sourceFetchedAt; not transaction time. |
| oclc, lccn | Nullable scalars from **that edition JSON**, using extraction rules below. Never derive from a work, another edition or ISBN. |

At most ten companions, at most one per optionId; serialized UTF-8 size at most
32 KiB. Match by option UUID **and** provider record ID, not array position alone.
No companion for an unavailable/null-metadata row. Reject duplicate companion
bindings, unknown keys, forged IDs/versions/fetchedAt or scope mismatch before
catalogue effects; preserve normal stale-request refusal before payload validation.
Absent companion is compatible; a malformed supplied envelope is not omission.

For `oclc_numbers`/`lccn`: accept only arrays of at most 16 strings, each trimmed
length 1–64. Any non-string, oversize item/array, control (U+0000–001F/007F–009F),
active content or malformed item makes **that field null**, not the option invalid.
OCLC accepts ASCII `[0-9]+`; LCCN accepts `[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*`.
Deduplicate exact trimmed strings; exactly one distinct valid string survives.
Do not coerce numeric JSON, remove meaningful zeroes, case-fold LCCN or select
the first of several values. Worker and SQL scalar validation must agree.

The SQL side validates envelope shape, length, scalar safety and bindings. It
cannot re-read discarded raw OL JSON; extraction correctness is proved with
recorded fixtures from adapter input through persisted facts (AC7-2f).

### 3.2 Hop-by-hop persistence

| Hop | Required payload and trust boundary |
|---|---|
| Adapter → normalizer (today only the OL adapter) | Each adapter builds its own companion through the shared companion type; no generic module branches on provider name. For OL: pass validated search work key alongside the edition objects already fetched; normalizer extracts edition ID, work reference, OCLC/LCCN while preserving existing author allocation, positions and HTTP budgets (C02/C03). |
| Normalizer → options worker | `{rows,catalogueCompanions}`; validate existing rows exactly as today, then the companion separately. Metadata remains full coherent provider JSON without new keys. |
| Worker → boundary/RPC | `EditionOptionsCompletionInput` gains optional `catalogueCompanions`; new workers call v2 (§5). No raw provider JSON, model text or Owner-review values in this field. |
| RPC → completion | Same current claim/store/session/request-generation/query fence and provider-call receipts as M78; bind every companion to validated `p_rows` before storing. Write immutable private companion records and the completion effect receipt in the same transaction. |
| Later Select/Add | Resolve the **chosen** option or full immutable current-suggestion payload; read the matching private companion by original lookup/attempt/providerRecordId plus metadata digest. Cleanup/new searches must not substitute the newest lookup or erase chosen provenance. |
| Shared writer | Receives validated bibliographic facts and scalar provider references only. Strip option/lookup/attempt/candidate/store/request IDs. Persist provider-ID rows/source facts without private lineage. |

For future automatic OL (Slice 8), the adapter's single accepted result must carry
the same companion beside `createSelectedMetadataSnapshot`; the terminal gateway
will call the corresponding completion boundary **before** finalizing that lookup.
Slice 7 neither adds an automatic OL implementation nor relabels a Google result.
OQ3 gates how lookup-time relaxed admission is exercised before Slices 8/9.

## 4. Proposed data model

All names in this section are proposed SQL objects for 7a or 7b, assigned in §12.
Before review, the
build brief must explicitly name every new or replacement constraint/index in
§§4.1–4.5, including PKs, FKs, CHECKs, UNIQUEs and partial indexes. No store identifiers
occur in shared tables; private effect/companion tables are separate (D36/R04).

### 4.1 `public.canonical_provider_ids`

| Column | Definition |
|---|---|
| adapter_key | `text NOT NULL`, FK `phase9_provider_registry(adapter_key) ON DELETE NO ACTION`; worker-compatible regex above. |
| id_kind | `text NOT NULL CHECK IN ('edition','work')`. |
| external_id | `text NOT NULL`, 1–256 characters, equals trimmed value, no controls, markup delimiters `< >`, backslash or URL scheme; the provider's own grammar is checked by writers through `phase9_catalogue_provider_ids_valid_v1`. Generic storage does not assume any provider. |
| canonical_edition_id | Nullable UUID FK canonical_editions `ON DELETE CASCADE`. |
| canonical_work_id | Nullable UUID FK canonical_works `ON DELETE CASCADE`. |
| created_at | `timestamptz NOT NULL DEFAULT transaction_timestamp()`. |

Primary key `(adapter_key,id_kind,external_id)` is the required tuple uniqueness;
exactly-one-target XOR CHECK and kind/target CHECK are both required. Partial
btree indexes on each nonnull canonical target support reverse references/cascade.
No provider columns on canonical works/editions. Alias external IDs can share a
target; one tuple cannot identify two targets. No `SET NULL` target action. RLS
enabled; authenticated SELECT policy `USING(true)`, necessary service SELECT;
no anon SELECT and no direct writes for any API role, including service_role.
Adapter registry FK alone does not prove metadata kind/admission; writers check it.

### 4.2 Canonical additions and sources

Add nullable `oclc text`, `lccn text` (same scalar checks); `hidden boolean NOT NULL
DEFAULT false`; `source_retention_note text NULL` (1–1024 safe characters when set);
`normalizer_version text NULL` (1–128). Add `normalizer_version text NULL` to works
to stamp that work's key too (D37 “version stored with each key”). Existing rows
receive no fabricated provenance/version. The false hidden default preserves
existing visibility; it is not a record-quality endorsement.

New rows use one provider's original facts and M81's existing column mapping.
New editions with an admitted ISBN use `metadata_selection_version='psr-catalogue-isbn-v1'`;
provider-ID-only new editions use `metadata_selection_version='psr-catalogue-provider-id-v1'`.
Both use `metadata_verified_at=provider fetchedAt` (Owner OQ7); no incumbent is restamped.
New work/edition key-version = validated provider normalizerVersion. The public
note is copied from the provider's registry row: add nullable
`phase9_provider_registry.shared_source_note text` (1–1024 safe characters when
set; no grant change). A row with a null note is not admitted to shared writes.
7a sets it for `open_library` only, proposed text
`Open Library; normalized bibliographic facts retained for shared public reuse; attribution: Open Library; no raw response or image file retained.`
A later provider gets its own note with its Q18 approval, without code change.
No private licence comment, URL containing a store token or Owner content.
Owner OQ7 accepts this note/stamp rule; Q18's wider licence details remain Owner-deferred.
No new UPDATE to incumbents fills any nullable column. Hidden flag administration
is privileged operator SQL under separate authority; no client control is added.

`book_metadata_sources` retains its existing PK/`UNIQUE(provider,provider_book_id)`
and edition FK `SET NULL`. New row: explicit UUID; `source_book_id=NULL`;
both `provider` and `adapter_key` = the registry key (M01 dropped the old
provider-name CHECK and added the registry FK on `adapter_key`, [M01 L34–48](../../../../../../supabase/migrations/20260722000001_marketplace_phase9_catalogue_metadata_expand.sql#L34));
`provider_book_id=edition external ID`;
adapter/schema versions and reuse_policy_version from validated lineage;
`fetched_at=provider fetchedAt`; `request_status='completed'`;
confidence/match_strength/match_rationale NULL (no popularity-as-truth);
`raw_payload='{}'`, `raw_delete_after=fetched_at+registry.raw_retention_seconds`
(0 for OL today; `raw_payload` stays `'{}'` for every provider).
`expires_at=fetched_at+registry.revalidation_seconds` when nonnull. This deadline
governs source/cache reuse, **not** expiration of admitted permanent canonical facts.

`normalized_payload` is a strict `psr-catalogue-facts-v1` object: version;
adapterKey/adapterVersion/schemaVersion/normalizerVersion; providerRecordId;
workExternalId; fetchedAt; title/subtitle/authors/publisher/publishedDate/language/
script/ISBNs/pages/categories/description/editionStatement/volume/format/series;
oclc/lccn; coverRef and derived own-edition coverReference; sourceRetentionNote.
No contract/query/selection UUIDs, private match evidence or raw response. coverRef
is the provider's own cover identifier as derived by its validator from the same
validated cover URL, or null; for `open_library` it is the positive decimal cover
ID from that OL cover URL.
Compare an existing source's target and identity; never reassign it or overwrite
canonical facts. Proposed source behavior is first-row/no refresh, OQ7. Exact
replay inserts nothing; expired source refresh stays deferred with Q17.

### 4.3 Shared counters

- `public.canonical_work_stats`: `canonical_work_id uuid PRIMARY KEY REFERENCES
  canonical_works ON DELETE CASCADE`, `times_searched bigint NOT NULL DEFAULT 0
  CHECK >=0`, `updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()`.
- `public.canonical_edition_stats`: `canonical_edition_id uuid PRIMARY KEY REFERENCES
  canonical_editions ON DELETE CASCADE`, `times_chosen bigint NOT NULL DEFAULT 0
  CHECK >=0`, `times_added bigint NOT NULL DEFAULT 0 CHECK >=0`, same updated_at.

Use atomic upsert `count=count+delta`, never read-modify-write in TypeScript.
No store/user/candidate/inventory/selection/lookup IDs, quantities, money or
category counters. Count one Add action, not q copies. Counts may order/tie-break
only where that slice's ranking contract permits; Slice 7 does not alter the
automatic matcher or infer verification. Reader permissions are OQ6; proposed
server SELECT only, RLS with no client policy. No historical count reconstruction.

### 4.4 Private lineage and effect receipts

All three new tables live in `marketplace_sec`, RLS enabled, no API table grants.
7a creates choice effects; 7b creates companions and lookup effects (§12).
Only owning postgres routines read/write them. No PostgREST exposure is added.

| Table | Columns/constraints and purpose |
|---|---|
| `phase9_catalogue_companions` | `id uuid PRIMARY KEY`; lookup/attempt FKs `ON DELETE CASCADE`; candidate_id, store_id, session_id nonnull FKs (existing owned targets, NO ACTION); provider_record_id text 1–256; option_id nullable UUID (automatic result has none); payload_version; metadata_digest text CHECK 64 lowercase hex; companion jsonb strict §3; created_at. Partial UNIQUE `(lookup_id,attempt_id,option_id)` for nonnull option; partial UNIQUE `(lookup_id,attempt_id,provider_record_id)` for null option. Scope validation proves all IDs belong together. Index lookup/attempt/providerRecordId/metadata_digest for chosen-source resolution; option mode additionally matches saved option UUID. Repeated external IDs in different original option positions remain valid options; each carries its own companion. No UPDATE; compare identical payload on replay. Retain chosen records through option cleanup; deletion lifecycle belongs to Slice 18. |
| `phase9_catalogue_lookup_effects` | PK `lookup_id` FK lookups CASCADE; candidate_id/store_id/session_id nonnull scoped FKs; request_generation int >=0; completion_digest hex64; canonical_results jsonb ordered optionId→resolved pair/skip (local completion records its one pair with optionId=NULL); searched_work_id nullable FK works SET NULL; search_counted boolean NOT NULL default false; cache_entry_id nullable cache FK SET NULL; cache_payload_digest nullable hex64; completion_response jsonb; completed_at. No CHECK couples search_counted to the nullable FK: attribution routine requires a resolved work on its false→true transition; target deletion may later leave true/NULL. Never reset that marker or count again. Written/locked in completion; serves replay, deferred Q4 attribution and cache provenance. |
| `phase9_catalogue_choice_effects` | `selection_id uuid PRIMARY KEY`, scoped candidate_id/store_id/session_id nonnull FKs NO ACTION; lookup_id/attempt_id nullable FKs SET NULL; option_id nullable UUID; metadata_digest hex64 nonnull; counted boolean NOT NULL default false; canonical_edition_id nullable FK SET NULL; created_at/completed_at timestamps (completed_at null while pending). Insert only for new post-7a successful Select, after its confirmation gate. Same selection replay cannot insert twice. Private row records a pending choice when no catalogue target exists; only its exact selected metadata/lineage may later resolve it. No migration reconstructs old selections. |

Digest definition: SHA-256 of PostgreSQL `jsonb::text` for the exact validated
metadata/envelope, computed **by SQL**; workers do not assert cross-language JSON
serialization equivalence. A completion digest includes ordered rows, companions,
source time, request/query identity and contract version, excluding lease secrets.
Keep original accepted payload digest/receipt durable even if ordinary options
cleanup has removed the temporary list. No effect row is a shared usage log.

### 4.5 Cache schema (conditional OQ4 design)

Recommendation: extend existing `phase9_metadata_cache_entries`, not a new shared
cache. Add `payload_kind text NOT NULL DEFAULT 'selected_snapshot_v1' CHECK IN
('selected_snapshot_v1','edition_options_v1')`, `bibliographic_payload jsonb NULL`,
`payload_digest text NULL CHECK hex64`, `routing_policy_version text NULL` (1–128
nonblank characters when set). New kind requires routing_policy_version; legacy
kind leaves it NULL. Other version columns already exist (M15 L70–76); keep them,
the current index and legacy rows. Version authority and equality checks are §8.1.

Replace the positive-snapshot CHECK with a tagged union: legacy kind retains
**all** current outcome/snapshot rules and has null new payload/digest; new kind
has `outcome='positive'`, `normalized_snapshot=NULL`, nonnull strict bibliographic
payload/digest, `source_attempt_id=NULL`, `provider_record_id=NULL`, and valid
source_fetched_at/deadline. Empty/nonpositive options caching is not introduced;
ordinary legacy negative/ambiguous behavior stays. New kind supports both scopes;
public requires store_id NULL, private requires server-resolved store_id.
Retain service SELECT-only, RLS, no client read/write. Index is the existing global
provider-cache unique key plus expiry index; new key namespace in §8 prevents collisions.

A new-kind row has **no private provenance pointer**. A private lookup-effects
receipt authorizes publication and binds cache content; a future consumer records
its own private cache receipt. Legacy rows/pointers are not rewritten or promoted.
OQ4 asks approval for the explicit guard/reuse extension; this is not silently
claiming the existing positive-cache RPC accepts options.

The conditional cache design also requires a forward change to M15's two lookup
CHECKs ([mode and shape, L16/L48](../../../../../../supabase/migrations/20260728000015_marketplace_phase9_metadata_foundation.sql#L16)):
retain local/external branches byte-for-byte in meaning; add `cache_hit` with all
external version/cache-identity fields required, leader_lookup_id and
reuse_source_attempt_id NULL, and only the receiving logical attempt allowed as
outcome_source_attempt_id. Private scope remains mandatory for explicit lookup
rows, even when the cache entry itself is public. No provider-spend event is
created by adding an execution mode. Capture actual constraint names read-only
before generating DROP/ADD statements; do not guess live generated names.

## 5. Proposed functions and call inventory

All new private functions: owner postgres, fully qualified SQL, explicit empty
search_path, no dynamic SQL or caller-selected object names. Mutators are VOLATILE
SECURITY DEFINER; pure shape functions IMMUTABLE without definer privilege;
policy readers STABLE SECURITY DEFINER. Revoke ALL function privileges from
PUBLIC/anon/authenticated/service_role on private functions. Public service RPCs
are SECURITY INVOKER wrappers, empty search_path, EXECUTE service_role only;
their private entry functions also grant service_role EXECUTE and check
`auth.role()='service_role'` plus the full claim fence. No authenticated catalogue
writer RPC. Signature lists below are complete, not overload proposals.

| Proposed function | Signature/result, caller and responsibility |
|---|---|
| `marketplace_sec.phase9_catalogue_valid_companion_v1` | `(p_companion jsonb,p_metadata jsonb,p_option_id uuid) RETURNS boolean`; IMMUTABLE pure shape/binding check; core completion calls. Scope/registry checks remain outside. |
| `marketplace_sec.phase9_catalogue_valid_cache_v1` | `(p_payload jsonb) RETURNS boolean`; IMMUTABLE strict version/keys/row/bounds/own-cover validation for the new cache-kind CHECK and reuse. No relation reads; admission remains in the scoped caller. |
| `marketplace_sec.phase9_catalogue_cache_receipt_guard` | `() RETURNS trigger`; VOLATILE SECURITY DEFINER empty search_path, postgres only; new DEFERRABLE INITIALLY DEFERRED constraint trigger on inserted/changed cache-hit lookups. At commit require a same-store/candidate/job/generation completed effect receipt, matching digest/cache provenance and logical attempt, with zero reservation/physical calls. The BEFORE guard checks row shape; deferred proof avoids requiring an FK-dependent effect before its lookup exists. External/local rows retain existing behavior. |
| `marketplace_sec.phase9_catalogue_isbn_v1` | `(p_isbn10 text,p_isbn13 text) RETURNS TABLE(isbn10 text,isbn13 text,admitted boolean)`; IMMUTABLE, M81 checks plus versioned blocklist OQ2. All catalogue identity consumers call it; no client execution. |
| `marketplace_sec.phase9_catalogue_identity_lock_key_v1` | `(p_kind text,p_key jsonb) RETURNS bigint`; IMMUTABLE pure shape function, postgres only. Shared by Add (7a) and completion/cache (7b); validates canonical identity tuples and computes exactly §6.2's signed advisory key. No caller duplicates lock-key derivation. |
| `marketplace_sec.phase9_catalogue_resolve_v1` | `(p_metadata jsonb,p_companion jsonb,p_source_policy jsonb) RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)`; VOLATILE definer, postgres only. p_source_policy carries the already-evaluated sharedAdmitted decision, built by a trusted caller after the registry SHARE lock (§5 admission hand-off); never a service/user payload. Generic identity/write core consumes that decision below production admission, allowing direct postgres synthetic-provider tests without rerunning the allow-list. False means NULL/NULL with no writes. Contains no provider name. Owns §6 subtransaction; exactly one pair/NULL pair. |
| `marketplace_sec.phase9_catalogue_shared_admitted_v1` | `(p_adapter_key text) RETURNS boolean`; STABLE definer postgres only; caller holds the registry SHARE lock. True only when the registry row is an enabled metadata provider passing the existing matching/storage/public-display/version/retention checks, has a nonnull `shared_source_note`, **and** the key is in D35's temporary allow-list (`open_library`). The only new SQL naming a provider for admission; Slice 8a replaces the allow-list clause with `shared_catalogue_allowed`. Every production Add/completion/cache-publication/cache-reuse entry point calls it and passes its decision to the private generic identity/cache helpers; those helpers do not rerun the allow-list. |
| `marketplace_sec.phase9_catalogue_provider_ids_valid_v1` | `(p_adapter_key text,p_record_id text,p_work_id text,p_book_url text,p_cover_url text,p_completion jsonb) RETURNS TABLE(valid boolean,cover_ref text,logical_outcome text)`; IMMUTABLE. One registry-keyed `CASE p_adapter_key` dispatch owns provider ID/work grammar, book/cover URL checks and completion receipt/routing/accounting shape below. Unknown key refuses. Adding a provider adds one reviewed branch (SDD-2 Slice 8); no generic function changes. |
| `marketplace_sec.phase9_catalogue_link_for_add_v1` | Existing `(p_candidate_id uuid,p_session_id uuid,p_store_id uuid)` signature/result unchanged. Replace body forward, preserve M81 scope/saved-ID/hydration contract; 7a passes a null companion without reading any 7b object; 7b adds chosen private-companion resolution. Check `phase9_catalogue_shared_admitted_v1`, call shared core. M81's inline provider checks ([L125–127, L144](../../../../../../supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql#L125): metadata and attempt `adapter_key='open_library'`, OL cover-URL regex) move out of the body: the key checks into the admission function, the cover regex into the provider validator. The replacement body keeps the metadata/attempt adapter-key equality, generically. No network/queue/stats inside its conflict subtransaction. |
| `marketplace_sec.phase9_catalogue_increment_v1` | `(p_work_id uuid,p_edition_id uuid,p_searched integer,p_chosen integer,p_added integer) RETURNS void`; VOLATILE definer postgres only. Each delta 0/1; searched requires work, chosen/added require coherent edition/work. Upserts stats in work-then-edition order, called only inside fenced completion/Select/Add. |
| `marketplace_sec.phase9_catalogue_count_choice_v1` | `(p_candidate_id uuid,p_selection_id uuid,p_metadata_digest text,p_work_id uuid,p_edition_id uuid) RETURNS void`; VOLATILE definer postgres only. Caller already holds the scoped private choice-effect row lock before shared locks. Verify exact current selection/digest and coherent target; if uncounted, increment chosen and mark counted in the same transaction. Called by Select or Add; absent pre-7a effect means no historical count. |
| `marketplace_sec.phase9_catalogue_query_scope_v1` | `(p_candidate_id uuid,p_lookup_id uuid) RETURNS text`; STABLE definer postgres only. Returns `public_bibliographic` only on server-proven scan-text query origin; otherwise store_private (§8/Owner OQ5). |
| `marketplace_sec.phase9_catalogue_store_cache_v1` | `(p_lookup_id uuid,p_source_policy jsonb) RETURNS uuid`; VOLATILE definer postgres only, called after successful fenced completion's effect row exists. Consumes its trusted caller's already-evaluated admission decision (§5 admission hand-off); false returns NULL before publication. Constructs safe payload/key from persisted facts; cannot accept arbitrary worker cache JSON. Null result means no eligible cache publication. |
| `marketplace_sec.phase9_complete_candidate_edition_options_v2` and `public.phase9_complete_candidate_edition_options_v2` | Exact signature below; private definer/public invoker service-only. Preserve M78 completion before adding §7 hooks; v1 remains callable and enters same core with null companions. |
| `marketplace_sec.phase9_reuse_candidate_edition_cache_v1` and `public.phase9_reuse_candidate_edition_cache_v1` | `(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_cache_versions jsonb) RETURNS jsonb`; private definer/public invoker service-only. Accepts the strict worker-version object in §8.1; SQL validates it against persisted versions/current registry policy and derives key/scope itself; returns `{status:'miss'}` or the existing completion receipt. Evaluates production admission under the registry SHARE lock, then calls the postgres-only generic cache-reuse core below. No admission decision is accepted from service arguments; no HTTP or usage reservation. |
| `marketplace_sec.phase9_catalogue_reuse_cache_core_v1` | `(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_cache_versions jsonb,p_source_policy jsonb) RETURNS jsonb`; VOLATILE definer, postgres only. Implements §8's cache-only completion with the entry point's already-evaluated admission decision; false returns `{status:'miss'}`. Retains all claim/scope, registry/version/retention, payload and private-receipt checks; never reruns the allow-list. Only the service entry enforces auth.role(); API roles cannot call this core. |

**Admission hand-off (D35, AC7-21).** Only trusted postgres callers build
p_source_policy, binding adapter/version/retention values from the locked registry
row and sharedAdmitted from `phase9_catalogue_shared_admitted_v1`. Production Add,
completion, cache publication and cache reuse cannot accept that decision from a
worker, RPC argument or cache payload. The generic resolver, cache writer and
cache-reuse core consume it while retaining every other validation/fence; they do
not call the production allow-list themselves. On a disposable test database only,
AC7-21(b) calls these helpers directly as postgres with a fixture-built admitted
policy for a synthetic provider. The fixture changes no generic function, grant
or production allow-list. Separate production-entry assertions prove denial: no
production widening.

**Provider validation modes (R07/R09, C09).** Facts mode has p_completion=NULL
and a nonnull record ID; validate ID/work/cover and any supplied book URL. Every
available completion/cache row must supply its book URL; Add may omit that URL
because its immutable source was already validated. Accounting-only mode has all
four fact/URL arguments NULL and a nonnull p_completion; reject any other mode.
The completion builds this strict object from locked persisted routing/receipt
rows and already validated p_rows; workers cannot assert receipts/routing:
providerRole, primaryAdapterKey, predecessorOutcome (only after proving
the actual predecessor relation), queryKind, rows, terminalReceipt, receipts. Each
receipt contains callSequence, callStage, status, egressStarted, retryable,
normalizedOutcome, logicalOutcome, normalizedCandidate and matchEvidence;
terminalReceipt is M78's selected latest finalized/nonretryable receipt, and
receipts contains all calls for that logical attempt/claim, ordered by created_at/id.
The validator reads no relations.

| M78 provider-specific checks | New home and retained strength |
|---|---|
| L303–317 primary/secondary provider combinations and predecessor outcome allow-list | Same validator's provider branch validates the routing shape. The generic caller still proves attempt/lookup/predecessor IDs, versions and disposition against locked rows. No provider-key allow-list remains inline in completion. |
| L332–347 record grammar, own book URL and cover URL | Facts mode: retain Google's ID/query-parameter binding and cover checks; OL requires exact `https://openlibrary.org/books/` + edition ID and its existing own-cover grammar. Work grammar/coverRef extraction remain in the same provider branch. |
| L361–385 provider-specific logical-outcome and physical-call rules | Accounting mode: retain OL's 1–6 sequenced calls, finalized/nonretryable/egress/empty evidence and null normalized-candidate requirements, search sequence 0, editions sequence 1 when rows exist (single `edition` only for an ISBN query), and only the existing author-stage failure exceptions at sequences 2–5. Derive OL's logical outcome from validated rows exactly as M78. Other providers retain their current terminal-outcome validation, including material_conflict. Return that logical_outcome to the generic caller. |

The caller retains every generic fence, registry/storage/version check, receipt
scope/claim lock, reservation check and row eligibility check. Both v1 and v2
require accounting-mode success for new external completion, including zero rows;
cache/local paths use their separate zero-egress proof and cannot invoke an
external-completion exception. AC7-21/23 enforce this single provider-rule home.

The v2 completion signature is:

```text
(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_lookup_id uuid,p_attempt_id uuid,
 p_source_fetched_at timestamptz,p_options_expires_at timestamptz,
 p_storage_permission_verified boolean,p_rows jsonb,p_catalogue_companions jsonb)
RETURNS jsonb
```

Avoid default-argument overload ambiguity: v1 keeps its sixteen arguments; v2 has
the seventeen above. Both call a single private completion implementation (v2's
body); v1 passes SQL NULL. Replay of a completed v1 call after worker upgrade must
return its original saved receipt, not add companions/effects retrospectively.

**Existing forward replacements, same signatures/ACLs:** M81 Add (added-count
hook only, preserving all its other behavior); M73 private selection (chosen and
possibly deferred searched-count hook); M78 private v1 completion (delegate);
M68 `phase9_edition_guard_automatic_payload()` (narrow cache-kind/cache-hit exception);
M73 `phase9_edition_source_policy(phase9_candidate_edition_state)` (accept validated
cache-only lineage); M67 local matcher and M32 automatic local catalogue queries
(hidden/blocklist filter); **M15** private `phase9_complete_local_metadata_match`
(the existing M32 structural wrapper delegates to it, M32 L174–192), with its
unchanged signature below and the searched-count/effect hook in §7.2. Legacy cache
readers/writer must explicitly require
`payload_kind='selected_snapshot_v1'`. Cache-only registration is inside the new
reuse RPC, never a loosening of generic structural registration or attempt APIs.

The M15 local-completion replacement keeps owner/ACLs and this exact signature:

```text
marketplace_sec.phase9_complete_local_metadata_match(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_query_identity text,p_lookup_strategy text,p_lookup_contract_version text,
 p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
 p_schema_version text,p_canonical_edition_id uuid,p_snapshot_version text,
 p_selection_policy_version text,p_match_evidence jsonb) RETURNS jsonb
```

Its existing M32 private/public structural wrappers remain unchanged; there is no
worker-side count call. Preserve M15's validated replay return before the new hook.

Also forward-replace **M73** private
`phase9_recover_candidate_edition_options_v1(p_job_id uuid,p_worker text,
p_lease_token text,p_attempt_count integer,p_candidate_id uuid,p_store_id uuid,
p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text)
RETURNS jsonb`; public M68 wrapper/signature/ACL remain. Current body is
[M73 L362](../../../../../../supabase/migrations/20261011000073_marketplace_phase9_open_library_edition_options.sql#L362).
Run the existing full scope/lifecycle fence first; changed request/query/generation,
removed candidate or nonmutable session returns stale_rejected, no old result.
For the same completed request, read its scoped effects receipt independently of
temporary source pointers. Return saved receipt with status replayed even if its
option list has expired/been cleaned; this proves completion only and **never**
restores options or extends expiry. Current read/Select still hides expired lists.
For a lookup completed before 7b without effects, retain the exact legacy recovery rules. OQ4
explicitly includes approval of this durable-receipt extension. Completed v2
re-entry uses this receipt/digest before attempting catalogue effects.

Automatic OL completion is not a second unimplemented public RPC here: Slice 8
must extend its terminal-persistence input to call this same private identity core
and effects logic in its automatic completion transaction. No automatic worker
call to the Add helper, and no out-of-transaction post-completion catalogue call.

## 6. Identity, conflict rollback and lock order (Q16/Q20)

### 6.1 Resolution algorithm

Validate metadata/companion/admission before writes; helper-local ISBN validation
precedes **any** ISBN probe, including local/cache paths. A malformed/disagreeing
supplied ISBN pair still causes a complete catalogue skip as M81 does. Handling
a valid but blocklisted ISBN with a provider tuple is OQ2; no weakening is assumed.

**Compact validated ISBN form (M81 L157–177, D35/D37).** For each supplied ISBN,
use `pg_catalog.upper(pg_catalog.regexp_replace(value,'[[:space:]-]+','','g'))`.
ISBN-10 must match `^[0-9]{9}[0-9X]$` and pass the unchanged
`phase9_metadata_normalized_isbn13` checksum/conversion; supplied ISBN-13 must
match `^97[89][0-9]{10}$` and pass that same routine. If both are supplied their
converted ISBN-13 values must agree; otherwise skip the whole catalogue record.
The ISBN-13 probe/stored value is `coalesce(compact_supplied_isbn13,converted_isbn10)`;
the ISBN-10 probe/stored value is the compact supplied ISBN-10 (no reverse inference).
Both absent permit provider-tuple identity. Add/lookup/local/cache identity probes,
blocklist checks and advisory ISBN keys all use these same forms; no raw/spaced
ISBN probe is permitted. §5's ISBN helper implements this once, with OQ2's rule.

Within one per-edition BEGIN/EXCEPTION subtransaction:

1. Probe compact validated ISBN-13 and supplied valid ISBN-10 separately, then
   provider edition tuple; gather all hits. ISBN-13 is first identity; absent
   ISBN permits tuple identity. ISBN-10 is a consistency/collision check, not an
   independent weak merge key. OCLC/LCCN are facts only, never identity keys.
2. More than one edition target, a populated conflicting ISBN, incompatible
   edition title/authors, absent work, provider work tuple targeting a different
   work, or existing source pointing elsewhere => P9C01. Optional missing facts
   are not conflicts and are not filled. Consistent same-ISBN providers can add
   separate ID/source rows to the one incumbent without updating its facts.
3. Resolve prospective work from an incumbent edition, provider work tuple or
   exact normalized work key, in that order. A normalized key already identifying
   a **different** work is a real conflict. Translation grouping with one provider
   work ID and different keys is the OQ3 interpretation below: recommendation is
   reuse the provider's work target when the translation's own key has no competing
   row; do not require its title to equal the work's original title. Never merge
   two existing works. Same ISBN still requires coherent edition title/authors.
4. If no edition exists, find/create the work by M81's exact normalized key or
   the validated provider work reference; then insert the edition with explicit
   UUID and targetless ON CONFLICT DO NOTHING. New rows alone get §4 facts/stamps:
   ISBN-based editions use `metadata_selection_version='psr-catalogue-isbn-v1'`;
   provider-ID-only editions use `metadata_selection_version='psr-catalogue-provider-id-v1'`.
   Both retain `metadata_verified_at=provider fetchedAt`; never restamp incumbents.
5. Re-select all edition keys and prospective provider/work keys in separate
   statements after uniqueness waits. Lock and revalidate targets before returning.
   Consistent concurrency returns the winning persisted IDs, not proposed UUIDs.
   If the winning edition belongs to a different work, roll back this attempt's
   provisional work before any fallback; no orphan work is left.
6. Insert edition/work ID rows and one source row, targetless conflict/no-update,
   then re-select/recheck each tuple/source target. Conflicting existing tuple or
   source => P9C01, rolling back **work, edition, both ID kinds and source rows**.
   Missing companion work ID is valid: create only edition tuple/source if safe.
7. Return the complete pair; on P9C01 return NULL/NULL **outside** the failed
   subtransaction. No option removal, provider retry or partial count. Existing
   M81 oversized-key and recognized uniqueness recovery retain their narrow scope;
   unexpected unique/permission/connection/programming errors propagate.

OQ3's grouping answer must also cover M81's **saved-ID** branch, not just new
inserts. Today [M81 L88–91](../../../../../../supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql#L88)
requires work title/authors to equal the edition's key. Conditional recommendation:
retain edition title/authors/ISBN/snapshot coherence and surviving work/edition
locks, but permit different work-title keys only when a source row for this exact
edition/providerRecordId contains workExternalId and that provider-work tuple
resolves to the edition's existing work. This is source-backed grouping, not a
fuzzy comparison. Missing/legacy source proof retains M81's strict comparison.
Use the same proof in generic ISBN incumbent reuse and saved canonical snapshot
reuse; add a local/current-suggestion translated-edition Add fixture. No ordinary
M81 saved-ID/no-update/disappearance behavior changes without that OQ3 answer.

If a tuple insert loses to a committed same-target writer, reuse it. If it loses
to a different target, skip atomically. ID tuple text equality across different
adapter keys or kinds is valid. Without ISBN, two providers' editions stay separate
(Q16); no title-only or fuzzy edition merge. Different ISBNs under the same safe
work give different editions, not a conflict. No source arrival reassigns a tuple.

**Legacy-key race:** preserve safe skip until OQ1 is resolved. A bounded read-only
re-resolution after rollback could improve linking, but it must re-prove every
work/edition/tuple identity and acquire locks in the same order; no retry loop or
normalizing UPDATE is authorized. Test the exact skipped-link case as a known
limitation, never label it successful convergence. New normalized keys without
legacy ambiguity must converge.

### 6.2 Lock graph and multi-option completion

Existing scoped outer locks stay in their purpose-specific order: Add retains
replay→session→candidate→edition state; worker retains its existing claim/session/
candidate/state fence (C08/C09), then lookup→attempt→physical-call/reservation
rows in current order. Take all required private bookkeeping locks **before**
shared catalogue locks. Add only reads old lookup/attempt lineage; it must not
lock those worker-owned rows in reverse order.

In Select/Add, lock the current private choice-effect row (and its lookup-effects
row when first searched attribution is pending) before entering the shared phase;
the counter helper must not discover/take those private locks after catalogue
resolution. Every caller follows the same candidate→state→lookup-effects→choice-
effects ordering; no cross-candidate choice scan or background reconciliation.

Shared phase: admitted registry rows sorted adapter key FOR SHARE; work targets
sorted UUID FOR KEY SHARE; editions sorted UUID FOR SHARE; tuple/source uniqueness
and rechecks; stats work UUIDs then edition UUIDs; cache key last. No private job,
candidate, session or another store lock is acquired after a shared target lock.
Definer calls must not lazily take an edition-state lock after catalogue writes.

For a bounded multi-edition batch, build the full key set first. Acquire
transaction-scoped advisory locks on **identity keys only**, deduplicated and sorted
by signed 64-bit key, before row/insertion locks. Both Add (7a) and completion/cache
(7b), including trusted saved-ID paths, must call the one private IMMUTABLE function
`marketplace_sec.phase9_catalogue_identity_lock_key_v1(p_kind text,p_key jsonb)`.
It accepts only these canonical JSON arrays; malformed/noncanonical input refuses:

| p_kind | p_key normalization and tuple |
|---|---|
| work | `[titleKey,authorKeys]`; title/each author use M81's `btrim(phase9_metadata_normalized_text(value))`, authors sorted `COLLATE "C"`, duplicates retained. |
| isbn13 / isbn10 | `[compactValidatedValue]`, exactly §6.1; omit an absent key. |
| provider | `[adapter_key,id_kind,external_id]`; exact validated registry key/kind/trimmed provider ID, no extra case-folding. |

For each validated p_kind/p_key pair the function uses **exactly** this expression:

```sql
('x' || pg_catalog.substr(pg_catalog.encode(pg_catalog.sha256(
  pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    'psr-catalogue-v1', p_kind, p_key)::text, 'UTF8')), 'hex'), 1, 16)
)::bit(64)::bigint
```

`pg_catalog.sha256(bytea)` is built in since PostgreSQL 11; no extension is needed
(PGlite and the native runner use PostgreSQL 18). The first eight digest bytes are
read in big-endian order; bit(64)→bigint supplies
the signed two's-complement value, including when the high bit is set. Callers pass
these sorted keys to `pg_catalog.pg_advisory_xact_lock`; they must not duplicate
the expression or use a TypeScript hash. Collisions serialize extra work but never
grant identity. The shared protocol prevents reverse option orders from deadlocking
on two work insertions. This extends M81's single-book locks mechanically, not a
global/table lock. Recheck all target identities after acquiring locks (AC7-22).

Shared work candidates discovered only after a probe are included before row
locks; on an unexpected changed mapping roll back that edition and skip safely,
do not acquire a smaller advisory key while holding a larger one. Freeze a stable
batch plan, then execute each edition's subtransaction in identity-key order;
persist/display the original option order. Native tests must prove this graph,
including batch vs Add and reverse-order batches. Admin identity/key mutation is
outside the normal writer protocol; no silent reassignment is supported.

## 7. Write timing, completion and stats (D36/D39, R01/R07/R08)

### 7.1 Lookup completion transaction

Use M78's current body, not a historical M73 completion. Sequence:

1. Current claim/request/query/session/candidate fences and strict rows/lineage,
   retention/policy checks remain. Preserve stale-rejected outcomes and all row
   eligibility/order; no catalogue helper runs for a refused completion.
2. Completed lookup/recovery receipt returns **before** new writes/counts/cache.
   New completion compares companion-inclusive digest for v2 replay; incompatible
   replay is idempotency mismatch. Existing completed v1 lookup uses its old receipt.
3. Prove physical GET accounting and reservation exactly as M78 does, including
   all author-stage failures and ISBN single-edition stage. Catalogue conflict
   does not relabel a physical call, accepted options or lookup summary.
4. Persist valid companions privately. Evaluate only editions whose provider
   passes `phase9_catalogue_shared_admitted_v1` (today OL only) and that pass
   the owned match predicate (OQ3); per-edition core returns a pair or skip.
   Save outcomes in private lookup-effects receipt. Zero writes for nonadmitted
   Google/manual data; helper-level second-provider tests stay below admission.
5. Save **all N** bounded options, original order and eligibility. M passing
   match minus C identity conflicts produces M−C catalogue resolutions; conflicts
   change no option, create no retry and leave no partial shared rows. Save normal
   options-derived summary/receipt and increment options_version once.
6. Apply searched count only when a unique chosen/auto-selected work is known
   and successfully resolved. No count to every work among M results. OQ6 records
   recommended deferred first-choice attribution for explicit multi-work options.
   Chosen/added counts are zero at completion, even on accepted ISBN result.
7. Publish eligible scoped cache payload via private helper; finish attempt,
   consume existing reservation, lookup/job and completion receipt in the **same
   transaction**. Preserve actual spend even when every catalogue write skips.
   Unexpected failure rolls back DB completion atomically; existing durable HTTP
   receipts allow fenced recovery without repeating provider egress.

No worker call after the completion transaction “fills in” shared data. A lost
response returns the persisted receipt with the same options version; no second
provider call, source insert, statistic, usage charge or cache publication.

**Bounded growth model (D39/Q3):** let L be completed eligible admitted-provider lookups (today OL), M_i ≤10
the admitted positions in lookup i, C_i their real conflicts, and E_i identities
already present or repeated within that batch. New editions are at most
`sum(max(0,M_i-C_i-E_i))`, never more than `10L`; new works are at most new distinct
safe normalized/provider-work groups, bounded by that edition count. Source rows
are bounded by distinct admitted `(provider,edition ID)` tuples, edition-ID rows
by distinct tuples, work-ID rows by distinct admitted work references. The six/four
fixture yields at most four editions/four sources and at most four works, fewer
when they share a work or already exist. Replays add zero. This is an upper-bound
measurement, not a fabricated traffic forecast: actual L/day, distinct-hit ratio,
source/cache sizes and retention rates are missing read-only inputs (§13.2).
Keep D39; measured unexpected growth returns to the Owner, never silently switches
to Add-only writes.

### 7.2 Select and Add

| Event | Proposed count placement and replay behavior |
|---|---|
| Successful explicit Select | After ordinary confirmation/identity checks, create its private choice-effect with SQL metadata digest and resolve target **read-only**, using known completion results or exact tuple/ISBN coherence. Increment chosen/mark counted for that target before EP_SELECT_V1 finish. No target/conflict => keep a pending effect, no count or catalogue creation; a later Add of that same current selection can flush it. Fresh-key same-choice/reselection semantics are OQ6. |
| Explicit lookup's first resolved choice | Under its private lookup-effects row lock, if search_counted=false, set searched_work_id and increment searched once; retain marker through later selections. This is the recommended OQ6 answer, not assumed authority. No scan/selection identity enters stats. |
| Automatic accepted/local/cache result | Increment searched at its fenced completion for its one resolved work. M32's structural local wrapper reaches the forward-replaced M15 local completion (§5); its hook is below. Future automatic OL uses Slice 8's transaction; cache/local-only completion counts search, not provider spend. |
| New Add with coherent linked pair | After inventory INSERT succeeds, flush the current post-7a pending chosen effect if its exact digest/lineage matches the helper-resolved pair, then increment added by 1 before finish_replay. Thus a post-7a Select followed by first catalogue creation at Add gives chosen +1 and added +1. Already counted choice gives only added +1; no link gives neither. Use only helper-returned IDs, never multiply by quantity. Outer failure rolls back inventory, catalogue and counters/effect markers. Old selections without a pending receipt are not backfilled. |
| Replayed Select/Add/completion | Receipt returns before catalogue/count changes. A new-key Add for an already committed candidate remains refused. No backfill on replay, including Select/Add receipts created before 7a and completion receipts created before 7b. |

**Existing automatic/local completion hook (Owner OQ6, M32 L188 → M15 L457–484).**
In the new M15 body, after the existing scope/claim/replay checks, keep its lookup,
snapshot and candidate writes. Before job resolution/return, resolve the selected
canonical edition's surviving coherent work under §6.2's locks and the same
hidden/ISBN/blocklist filters. In this same transaction insert a scoped
`phase9_catalogue_lookup_effects` row keyed by the **new** local lookup: candidate/
store/session from the fenced candidate/job; request_generation=0 for this path
without an explicit picker request; completion_digest over the validated local
inputs/snapshot/target; canonical_results records the local pair with optionId=NULL;
cache fields NULL; completion_response is the unchanged M15 response. With a resolved
work, increment searched once and set searched_work_id/search_counted=true atomically;
otherwise leave NULL/false. No provider attempt, reservation, chosen/added count or
new canonical fact is created. Any failure rolls back lookup/snapshot/count/effect
and job completion together. Exact replay returns the old response before this hook;
local lookups completed before 7b get no effect or historical count (AC7-25).

Stats do not lock canonical rows to update counts; identity/FK locks already held
may protect targets. Serialize aggregate upserts in canonical UUID order after
catalogue resolution. Two stores adding the same edition produce +2 added and
two inventory rows; replay of each produces +0. No rebuild by scanning private
inventory, no “most stores chose category,” no verification stamp from popularity.

## 8. Shared cache, query privacy and second-store behavior

### 8.1 Scope and key (D33/D39/D40, R04)

Cache sharing requires **both** a safe query origin and a safe payload. A hash of
Owner text is still private. `owner_isbn13`, hand-added cards, confirmed/edited
Owner title/authors/language/publisher clues remain private even when their text
equals a provider title (F43). Do not infer origin from string similarity.

Recommended OQ5 proof: derive an original query from the scoped immutable vision
observation/result/input chain (C17), using the current normalizer and the exact
fields actually sent. Require no Owner-derived component and a match to the
registered query identity. Only that proven scan-text query may use public scope
(Owner OQ5). Provider-facts-only queries have no scan-origin exemption. Unknown
provenance, missing observation, or old-worker registration => private. This conservative
rule may share fewer entries; it does not rewrite search input to make it shareable.

New-kind key: SHA-256 of SQL-normalized JSON tuple
`["psr-edition-cache-v1",scope,privateStoreOrNull,queryIdentity,adapterKey,
adapterVersion,capabilityVersion,normalizerVersion,schemaVersion,
routingPolicyVersion,cachePolicyVersion,reusePolicyVersion,companionVersion]`.
Use fixed prefix `psr-edition-cache-v1:` plus hex digest as provider_cache_identity.
SQL derives scope/store and recomputes key; TypeScript parity fixture proves the
canonical tuple, without assuming JS object serialization equals jsonb text.
**Authoritative versions (C14/M15 L20–32, Owner OQ4).** The server-only worker
supplies p_cache_versions from the same `MetadataGatewayConfiguration` used by
`metadataLookupParameters` (C14 L60–93). It is a strict object with exactly
adapterKey, adapterVersion, capabilityVersion, normalizerVersion, schemaVersion,
routingPolicyVersion, cachePolicyVersion, reusePolicyVersion and companionVersion;
version values are nonblank strings within their existing lookup/contract bounds.
companionVersion must be `psr-catalogue-write-v1`. SQL validates the adapter
key/adapterVersion and reusePolicyVersion against the locked current metadata
registry row; that registry has no capability/schema/routing/cache-policy columns
and is not their source.

On publication, SQL takes the other versions from the original persisted lookup
(and companion contract), checks its attempt/metadata versions agree, and stores
the existing cache version columns plus §4.5's routing_policy_version. It derives
the key only from these recorded values, query identity and server-proven scope.
On reuse, SQL requires exact equality of every worker tuple component to those
recorded cache values/companion version, rechecks current registry policy and
recomputes the key; missing/mismatched recorded versions mean miss, never guessed
current defaults or promotion of a legacy row. The receiving lookup records that
same validated tuple. Same-request completed replay/recovery returns its saved
receipt before new key derivation; upgrades do not re-key, recount or reinterpret
completed lookups. New-request version changes miss the old key (AC7-24).

Legacy key algorithm/rows are left private and untouched. Query identity keeps
author order; it does not borrow sorted catalogue authors as a new search rule.

### 8.2 Typed safe payload and write/reuse protocol (conditional OQ4)

`bibliographic_payload` has exactly version `psr-edition-cache-v1`, an ordered
`rows` array (at most ten), and sourceFetchedAt. Each row contains exactly ordinal,
eligibility, googleBooksUrl, providerRecordId, metadata, companion. (`googleBooksUrl`
is the existing M73 option-row key name used for every provider's own book URL;
it is kept for row-shape parity, not as a provider choice. Slice 8a may rename it
with the row contract.) For unavailable rows, URL/providerRecordId/metadata/
companion are null; retain the original ordinal.
Other rows use the provider's own validated book URL, the matching edition ID, and the strict coherent
metadata fields **except correlationId/attemptId/matchRationale/confidence**;
companion contains only version/workExternalId/oclc/lccn. No option UUID, canonical/store/
candidate/lookup/attempt/request IDs or Owner text. Strip rather than cache the
worker envelope. Bound full payload as current rows, maximum 2,621,440 bytes;
apply the stricter companion bounds separately. Include all valid private source
options, including an edition whose catalogue step conflicted; a cache hit does
not promote such an edition or discard options to conceal the conflict.

Writer is `phase9_catalogue_store_cache_v1(lookup_id,source_policy)` inside
completion. Its production caller holds the registry SHARE lock, evaluates
`phase9_catalogue_shared_admitted_v1` and passes that bound admission decision;
the generic writer consumes it without rerunning the allow-list (§5). It still
checks the private effect/rows/companion digest and all current registry/version/
retention rules before forming public/private payload and key. TTL = least(original options deadline,
sourceFetchedAt + registry revalidation_seconds, any applicable source deadline),
never now+TTL on reuse. No image download. Refuse expired/publicly unpermitted
data. Same-key concurrent write uses insert/no-update then compares digest;
live valid incumbent wins, no freshness bump on replay. An expired/invalidated
entry can be replaced by one newly completed lookup under the cache-row lock;
no canonical fact refresh is implied. Retention/policy denial is a miss/skip,
not permission to bypass with another provider.

Before reserving provider usage, the new worker recovers its request, then calls
the cache-reuse RPC. Its production service entry evaluates admission under the
registry SHARE lock and passes the bound decision to postgres-only
`phase9_catalogue_reuse_cache_core_v1`; the core retains every scope/claim/payload/
receipt check and consumes the decision without calling the allow-list. Only the
disposable postgres test in AC7-21(b) supplies a synthetic admitted policy directly
to the generic writer/reuse core; production entry points still deny it, with no
production widening. A miss continues the existing provider path unchanged. A hit:

1. Re-proves the current request fence and server scope/key; reads a tentative
   cache payload/digest **without a row lock** and checks versions and the trusted
   entry point's bound admission decision against the same locked registry row.
   Plan identity locks from this immutable copy. Acquire the shared locks in §6.2;
   only then lock/recheck the cache row as the last shared lock. A changed digest,
   invalidation, or deadline at/before clock_timestamp() raises internal P9C02,
   rolls back the whole cache-reuse subtransaction (private lookup/attempt/options,
   catalogue/stats/effects), and returns miss. No earlier cache SHARE lock may be
   retained while acquiring catalogue locks. Hidden canonical targets are filtered
   at reuse, and an empty usable set means miss. A publisher follows the same
   catalogue→stats→cache order; native proof crosses refresh/reuse expiry.
2. Creates a **new private cache-hit lookup and logical attempt**, with fresh UUIDs,
   `execution_mode='cache_hit'`, `cache_status='positive_hit'`, source fetched time,
   normal adapter/version/normalizer identity, no usage reservation, no provider
   request ID, no raw/normalized provider payload and **zero physical-call rows**.
   This is a logical reuse record, never a fabricated HTTP receipt. M67 L3–8 scopes
   attempt_sequence uniqueness to `(lookup_id,adapter_key,attempt_sequence)` when
   lookup_id is nonnull; candidate/adapter uniqueness applies only to legacy NULL-
   lookup attempts. Each cache hit has a fresh lookup and its one primary logical
   attempt uses sequence 1 (within the existing 1–10 bound); prior candidate hits
   do not consume a candidate-wide sequence budget. Same-request replay reuses the
   receipt/attempt; lookup-role and provider_attempt_identity uniqueness remain.
3. Allocates fresh private option UUIDs; restores full metadata's correlationId
   and attemptId from these **receiving** private records. Companion binds to those
   IDs. For available rows recompute `matchRationale` as `exact_validated_isbn`
   only on the receiving exact validated ISBN match, otherwise
   `confirmation_required_text_evidence`; set confidence=0 (the current OL
   normalizer's value; a later provider uses its own normalizer's rule). Do not copy query-derived rationale from another store.
   Unavailable rows retain null metadata/URL/companion with new option UUIDs.
   Source factual time/ISBN/cover/provider IDs remain unchanged. A private
   effect receipt binds cache ID/digest, request generation and rebuilt options.
4. Validates reconstructed metadata with the existing strict M73/M68 validators;
   re-evaluates current eligibility with the existing predicate (no new matcher).
   Saves normal options/receipt, resolves job once, and optionally resolves catalogue
   identities with §6. Catalogue conflict still leaves valid options and normal
   outcome. No automatic selected snapshot or Owner confirmation is manufactured.
5. Replay/recovery returns the same receipt and option IDs. Old source-attempt
   private IDs never cross stores. Source policy admits this branch only with its
   matching private cache receipt and current policy, not just a worker boolean.

Full receiving-row mapping (no fake provider execution): lookup id/candidate/store/
job/query come from the current fenced request; all adapter/capability/schema/
normalizer/routing/cache/reuse versions and namespace equal the cache identity;
lookup strategy/contract from the current validated query/worker contract;
claim worker/attempt/token **hash** from this claim; privacy_scope=store_private;
leader/reuse_source_attempt/canonical_edition_id=NULL; outcome_source_attempt_id
is the new receiving attempt; completion time is transaction time. The attempt
uses this candidate/store/lookup, adapter identity, primary role, fresh
provider_attempt_identity, attempt_sequence=1 scoped to its new lookup, query_kind/identity
from that query, normalized_request_clues='{}', status=completed,
cache_status=positive_hit, disposition=rejected, normalized_payload/raw_payload/
provider_request_id/usage_reservation_id/predecessor/duplicate-spend IDs=NULL,
calculated_cost_units=0, pricing evidence/policy NULL; provider_record_id and
match_strength NULL, reuse_policy_version from registry, fetched factual time
remains in rows, delete_after=options deadline. Summary is the M78 options rule:
eligible exact-ISBN row→accepted_metadata_match; other eligible row→ambiguous;
none→no_match. Attempt normalized_outcome is respectively coherent_match,
ambiguous_match or no_acceptable_match. Set lookup outcome to that summary;
save source_lookup/source_attempt, source time, deadline and options_version once
on state, finish job resolved and store the unchanged receipt shape. No usage-
counter/reservation mutation occurs. Reuse refuses any existing unresolved external
lookup for this request; it must be recovered, not silently replaced by cache.

M68's guard gains **only** two checked exceptions: new-kind cache row written
through this boundary with no source_attempt_id; explicit cache-hit lookup with
matching private receipt. Explicit automatic selected snapshots and nonnull
normalized_payload remain forbidden. Existing external completion still requires
physical egress receipts. Legacy automatic cache commands ignore new-kind entries.
The lookup's mandatory private receipt is checked at commit by the deferred guard
above; a client boolean or SECURITY DEFINER execution alone is not that proof.

For second store B, a public-query hit yields its own options and private lineage
with zero provider GETs/reservation/spend; a private-query entry from A cannot
match B's key or scope. Canonical reuse also remains available independently:
M65 builds its snapshot from canonical_editions including the **same stored
cover_url**, no provider request or other source's cover. Null cover is the normal
placeholder. OQ4 must decide explicit cache policy changes and their ownership
relative to Slice 8's catalogue-options source-policy work (SDD-2 F42).

## 9. Security, ACLs and tenant isolation

RLS is a backstop; the postgres definer bypasses it. Every private read joins the
server-resolved candidate/store/session and current request/claim lineage. A
service-supplied store UUID is compared to the job's store, never authoritative.
No cache hit returns another store's receipt, attempt, candidate or ownership.

| Object | PUBLIC / anon | authenticated | service_role | postgres routines |
|---|---|---|---|---|
| canonical works/editions | Existing canonical SELECT remains for anon; PUBLIC ACL is not broadened | SELECT only | Preserve audited existing privileges; no new grant from 7a/7b | Shared core inserts new rows only; privileged hidden administration separate |
| canonical_provider_ids | No privileges/policy | SELECT + RLS USING(true) | SELECT only; BYPASSRLS is not a table grant | Insert via private core only |
| work/edition stats | None (proposed OQ6) | None (proposed OQ6) | SELECT only | Increment helper only |
| book_metadata_sources | No new reader; revoke direct writes after audit | No direct writes; retain only audited permitted reads | Proposed SELECT only; current write callers must be audited before revoke | Private core inserts; no unrestricted service writer |
| cache entries | No privileges | No privileges | SELECT only, including no MAINTAIN/TRUNCATE | Existing legacy writer or new private typed writer only |
| private companions/effects | No privileges/schema exposure | None | No table privileges | Scoped routines only |
| new shape/identity/Add-helper/stats/cache helpers | No EXECUTE | None | None | Owning postgres only |
| new public completion/reuse wrappers + private service entries | No EXECUTE | None | EXECUTE only, full service+claim fence | Controlled calls |
| existing Add/Select RPCs | No EXECUTE | Existing EXECUTE only | No new EXECUTE | Keep owner/search_path/signatures |

For each new table REVOKE ALL from PUBLIC, anon, authenticated, service_role
**before** targeted SELECT grants; includes INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
TRIGGER/**MAINTAIN**. Test effective grants as well as RLS. Q21 permits authenticated
provider-ID reads, not anonymous reads. Canonical new columns are public under
existing table SELECT; hidden suppresses discovery, not direct row access.

M81 already revoked canonical client writes including MAINTAIN. Reassert those
revocations in the forward artifact without broadening PUBLIC/service grants.
They cover current relations only: any recreation must repeat the revoke and
reader policies. No global ALTER DEFAULT PRIVILEGES change is introduced.
Audit source writers/policies before narrowing source grants; an undiscovered
legitimate direct writer is a stop-and-report implementation finding, not licence
to break it. No broad SECURITY DEFINER catch-all, unqualified object resolution,
user-controlled SQL, service DML shortcut or function overload retaining PUBLIC
EXECUTE. `has_function_privilege`, `has_table_privilege`, aclexplode and actual
role-switched operations are required (AC7-8); never destructive probes live.

## 10. Rollout, rollback and compatibility (R06/R09/R10)

**DB before worker.** Only after Owner answers/review, build/creation permission,
red/green/native proof, read-only preflight and separate application permission:

1. Verify M81 definition hashes/ACLs and independently record M82's actual status;
   neither 7a nor 7b carries M82's trigger fix. Complete the accepted split map
   and decide migration numbers with SDD-0/SDD-2; recheck availability then.
2. Apply only the separately approved 7a transaction and read back its schema/
   ACL/functions/constraints. Prove provider-ID Add, Select/Add counters, legacy
   workers and replay work with all 7b objects absent. Then, under separate 7b
   authority, apply/read back its completion/transport/cache transaction and v1
   compatibility before worker deployment. Each transaction is independently
   reviewable/testable; neither backfills source/ID/stats rows or resets the
   catalogue. Applying SQL deploys no worker.
3. Existing workers keep v1 completion/row shapes. Null companion means no work
   reference/OCLC/LCCN on new rows; valid legacy edition ID in metadata still
   permits tuple identity. Old saved choice/snapshot bytes remain valid. Existing
   completed lookups/replays never receive new effects or historical counts.
4. Deploy the compatible worker separately: companions, v2 completion and scoped
   cache-reuse call. Do not fall back to v1 after an ambiguous v2 timeout: recover
   its receipt first. An absent v2 RPC during a prohibited worker-first rollout
   fails safe; do not make a fresh provider call to compensate. Deployment order
   is verified with compatibility fixtures, not assumed optional feature probing.
5. In-flight external jobs at 7b application retain claim, receipts, policy version
   and reservation. Their first valid post-7b completion may write once;
   already completed jobs return original receipt. A stale claim writes nothing.
   Cache-hit jobs use their separate proof and zero-spend path, never M78's egress
   exception for ordinary external attempts.
6. Verify two stores/shared and private origins, selected/add/manual paths,
   hidden filtering, receipt recovery, no Google shared rows and unchanged
   automatic Google routing. Automatic OL/relaxed matching remain later gates.

**Rollback:** separately approved compatible-worker rollback first, preserving v1
and additive DB schema. In-flight v2/cache jobs drain or finish by fenced recovery
before disabling their runtime path; keep support for durable cache-hit selections
and Add after worker rollback. A forward DB correction may stop future publication
or linking but retains the private receipt readers for existing choices. Do not
restore M69 or remove 7a's choice receipts or 7b's saved-choice/cache lineage while
references survive.
Keep canonical write revocations and provider-ID grants. Retain catalogue/source/
ID/stats rows and inventory links; no unlink/reset/down migration or raw deletion.
Hiding a bad row affects future lookup only; existing links/snapshots survive.
Bad publicly retained facts may require separately approved remediation; runtime
rollback does not erase them. Expiry-requiring providers stay disabled (Q17/Q18).

## 11. Acceptance checks and red-first proof

All test names below marked NEW are proposed under existing test directories.
No test is written/run by this design. Fixtures supply deterministic provider JSON
and actual SQL role/lineage; no network, model calls or fake application-level
convergence. `catalogueLinkFixture` alignment from 02a §7.1 is required: real FK
actions, named ISBN constraints, timestamps, RLS/policies/default broad grants.
Do not claim security from a bare Phase 6 baseline lacking those objects.

Proposed fixtures: **NEW** `supabase/tests/phase9/leanCatalogueFixture.mjs` (wraps
existing catalogue fixture, independently applies authorized 7a and then 7b;
7a-only mode installs no 7b object, and each absent slice supports its own red
tests); **NEW** `supabase/functions/__tests__/fixtures/phase9/catalogueWrite.ts`
(recorded six-edition OL JSON, four qualifying, original work key, positive OCLC/
LCCN, own cover, translation and malformed variants). Seed the synthetic second provider only in the disposable database for direct
postgres calls below admission (§5/AC7-21); production entry points still deny it.

| AC / authority | Given / When / Then | Test file (NEW unless stated), fixture, expected red before owning 7a/7b artifact or worker |
|---|---|---|
| AC7-1 D35/D39 | Six returned OL editions, four pass the owned predicate; completion writes/reuses four editions and their works with one source each, all six options unchanged. | `supabase/tests/phase9/phase9LeanCatalogueCompletion.integration.test.mjs`; six-edition fixture; red: no completion writer/source rows. OQ3 gates predicate fixture. |
| AC7-2 D35/Q16 | ISBN absent, valid provider edition tuple; two stores resolve one edition/tuple and reuse it. | `supabase/tests/phase9/phase9LeanCatalogueIdentity.integration.test.mjs`; no-ISBN fixture; red: M81 returns null, table absent. |
| AC7-2b D35/Q15/Q16 | Privileged core receives two synthetic metadata providers with same ISBN; one edition/two ID/source rows, immutable canonical facts; no ISBN gives separate editions; same ID text across provider/kind allowed. | Identity suite; privileged second-provider fixture; red: core/provider-ID table absent. Full service command must still reject the synthetic provider. |
| AC7-2c Q20 | ISBN A vs tuple B, inconsistent title/work, crossed ISBNs, or competing work target; Add succeeds unmatched, no partial work/edition/ID/source; distinct ISBNs on safe work succeed. | Identity suite + native suite below; collision fixtures and before/after row hashes; red: provider collision handling absent. Translation distinction gated OQ3. |
| AC7-2d R06/R09 | Valid companion survives every hop; forged lineage, unknown keys, >256 ID, wrong kind/two targets/FK failure refused; target deletion cascades IDs only; old worker omits companion successfully. | Identity suite; `supabase/functions/__tests__/phase9_catalogue_write_companion.test.ts`; bound/unbound fixture; red: no companion/table/transport. |
| AC7-2e Q20/D36/D39 | N options, M qualifying, C real conflicts; complete N options with original order/eligibility and normal accounting/outcome, M−C catalogue targets, no retry; concurrent completion/replay unchanged. | Completion suite + `supabase/tests/phase9/phase9LeanCatalogueConcurrency.postgres.mjs`; forced conflict and lost-response fixtures; red: no effect receipt/writes. Assert options_version, calls, reservation, spend and each count independently. |
| AC7-2f D35/R06/R09 | Own edition has OCLC/LCCN; normalizer→companion→SQL stores exact valid values in source/new edition; malformed/multiple become null without losing option; old worker doesn't clear existing values. | Companion edge suite + identity suite; positive edition JSON and malformed bounds; red: fields discarded before migration, columns absent. |
| AC7-3 D37 | Placeholder/reused/blocked ISBN and bad pair appear at Add/lookup/local/cache; blocked ISBN never identifies a record; fallback only per OQ2. | Identity + cache suites; Owner-approved list/version plus checksum-valid fixture; red: no blocklist. A fake unapproved production entry is not a test solution. |
| AC7-4 D36/R01 | Successful chosen linked edition/Add, concurrent stores and lost responses; +1 chosen/+1 added per approved semantic event, replay +0. | `supabase/tests/phase9/phase9LeanCatalogueStats.integration.test.mjs`; Select/Add receipts; red: stats tables/hooks absent. OQ6 covers fresh-key reselection. |
| AC7-5 D36/R04 | Inspect stats schema/data/ACL; no store/user/inventory/query/receipt identity; quantity q still +1 added; popularity never stamps verified. | Stats suite; schema/privacy fixture; red: missing table; explicit column/data scans prevent vacuous absence pass. |
| AC7-6 D37 | Hide an edition after publication to cache/local matching; future lookups/cache ignore it, old inventory IDs/selected bytes remain. | `supabase/tests/phase9/phase9LeanCatalogueCache.integration.test.mjs`; hidden fixture; red: hidden column/filter absent. Direct canonical SELECT remains possible by design. |
| AC7-7 D33/R04 | A safely shared search then B's same query; zero GETs, own private IDs/receipt, same bibliographic choices. Private A search cannot hit in B. | Cache suite + `supabase/functions/__tests__/phase9_catalogue_cache_scope.test.ts`; two stores, identical edits and original scan variants; red: hardcoded private scope/no typed reuse. OQ4/5 gates activation. |
| AC7-8 D35/R04/R07/Q21 | SET ROLE anon/auth/service, actual effective ACL/RLS; provider IDs auth SELECT yes/anon no, all direct writes denied incl TRUNCATE/MAINTAIN; no private helper EXECUTE; canonical clients remain SELECT-only. | `supabase/tests/phase9/phase9LeanCatalogueSecurity.integration.test.mjs`; schema-aligned real role fixture; red: new table/functions missing. Destructive denial probes only disposable DB. |
| AC7-9 D29/D33/R05 | A stores admitted own OL cover; B local/cache snapshot has same URL without HTTP; missing cover stays null/placeholder, no alternate/Google cover. | Cache suite + existing `phase9_open_library_edition_options.test.ts`; own-cover fixture; red: no lookup-time canonical source/cache write (existing M65 cover projection already passes). |
| AC7-10 D35/R05/Q17/Q18 | Storage-only, disabled/version-mismatched, Google/manual, or unapproved expiry-requiring second provider; no shared admission. OL's current authorized path remains eligible. | Identity/security suites; registry matrix; red assertion first checks new admission core exists, then negative effects. Never widen production for synthetic positive core fixture. |
| AC7-11 R06/R09 | Byte-compare snapshots/options metadata before/after companion support, v1/v2 null cases and cleanup/new lookup; chosen original companion remains bound. | Completion + companion edge suites; immutable saved snapshot fixture; red: no durable companion reader; don't change M73 allowlist. |
| AC7-12 D36/Q4 | Multi-work/unselected/selected/automatic/cache-hit lookups; exactly one searched attribution only for approved resolved work, none for unselected/conflicting targets. | Stats suite; private effect marker and parallel Select fixture; red: no marker/count; conditional OQ6 semantics explicitly named. |
| AC7-13 R01/R06 | v2 response lost or competing completion; recover original digest/receipt, no writes/options/count/spend repeats; v1 completed before migration isn't retrofitted. | Completion + edge recovery suites; committed-then-timeout fixture; red: no companion-aware receipt/recovery. |
| AC7-14 Q20/R10 | Known oversized-key case skips all shared writes but completes Add/options; unrelated 54000 and unknown unique constraints propagate and roll back outer attempt. | Identity/completion suites; AC6-29 maximum authors plus injected unrelated constraint; red: new write paths absent. Existing 79-test suite must remain green. |
| AC7-15 R04/R09 | Inject Owner text/private IDs/raw response/forged scope into shared candidate payload; SQL refuses publication; safe public payload contains none. | Cache/security suites + cache-scope edge suite; provenance and active-content fixture; red: no strict safe projection/scope proof. |
| AC7-16 R06/R07 | cache_hit logical reuse has zero HTTP/reservation/cost; ordinary external lookup without finalized egress is refused; explicit automatic snapshot write remains refused. | Cache/security suites; cache-only and missing-receipt fixture; red: reuse RPC absent; legacy guard negatives must remain green. |
| AC7-17 R06 | 7a alone + old worker with no 7b objects; then 7a+7b DB + old worker; new worker after 7b DB; in-flight reserved/registered/egress/finalized/completed-lost-response; worker rollback with chosen cache option; all terminal/accounted exactly once. | Completion/cache suites + existing RPC/recovery edge suites; rollout matrix fixtures; red: v2/reuse API absent. |
| AC7-18 Q20/R01 | Two stores reverse batch order, batch vs Add, same-ISBN commit/rollback, no-ISBN tuple race, work tuple/source collision; actual waits then coherent convergence or atomic skip. | Native concurrency suite; two independent connections and pg_locks/pg_stat_activity barrier; red: owning 7a/7b functions/lock protocol absent. |
| AC7-19 D37/Q15/Owner OQ7 | New canonical/source/version/note values are safe and coherent: ISBN-based new editions stamp `psr-catalogue-isbn-v1`, provider-ID-only new editions stamp `psr-catalogue-provider-id-v1`, both use provider fetchedAt; existing M81/Hobbit row hashes unchanged; no refresh/reset/backfill. | Identity suite; both new-row identity modes, legacy raw-case incumbent, sparse M81 and source fixtures; red: provider-ID stamp/additive columns/source writer absent. |
| AC7-20 R07 | Catalog helper/core return exactly one pair/NULL pair; kind/coherence/role failures cannot leak or create work-only/inventory FK. | Security/identity suites; direct postgres and denied API calls; red: generic core absent. Do not silently alter M81's accepted lack of row-count assertion in the outer Add. |
| AC7-21 D32/D35 provider neutrality | (a) Static: across 7a/7b SQL artifacts the literal `open_library` occurs only inside `phase9_catalogue_shared_admitted_v1`'s allow-list, the `open_library` branch of `phase9_catalogue_provider_ids_valid_v1` (ID/work grammar, book/cover URLs, routing/predecessor shape, receipt stages/budgets/failure exceptions and logical-outcome derivation) and the `shared_source_note` registry update; this is the exhaustive list of allowed new SQL homes. No provider-specific branch remains in v1/v2 completion, Add, identity or cache functions; no new table/column/JSON key names a provider. In the worker, no generic catalogue/companion/cache module imports an OL module or tests `adapterKey==='open_library'`. (b) Dynamic: on a disposable test database only, postgres seeds a synthetic provider's registry row/test-only validator branch and calls the generic resolver, increment helper, cache writer and cache-reuse core directly with a fixture-built admitted p_source_policy. Provider-ID rows, counters, publication and reuse run with zero generic-function changes and all other fences/checks intact. Separately assert the unchanged admission function returns false and production Add/completion/cache entry points deny shared writes/publication/reuse for that provider, with zero shared/count/cache effects; no production widening, allow-list replacement, grant change or worker-supplied admission flag. (c) Source note, raw retention and revalidation come from the registry row: changing the OL row's note changes the next new source's note. | GUARD `supabase/migrations/__tests__/marketplacePhase9LeanCatalogue.test.ts` (static scan of 7a/7b and worker paths) + identity suite with synthetic provider fixture; red: owning 7a/7b helpers and admission function absent. |
| AC7-22 Q20/R07 lock parity | Add (7a) and completion/cache (7b) produce identical signed keys for the same normalized work/ISBN/provider tuples through `phase9_catalogue_identity_lock_key_v1` using built-in `pg_catalog.sha256(bytea)` with no extension dependency; reordered/case/spacing work inputs normalize identically, author duplicates remain significant, high-bit hashes produce the same negative bigint and locks are acquired in sorted deduplicated order. | Identity + native concurrency suites and GUARD; fixed SQL tuple/hash fixtures, saved-ID/batch-vs-Add paths; red: shared function absent. Static guard rejects a second caller-local identity hash expression. |
| AC7-23 R07/R09 provider validation | M78's valid Google/OL rows and receipts still pass the registry-keyed validator; wrong book/cover binding, missing search/edition receipt, unfinalized/retryable call or missing egress, bad author stage/outcome/sequence or forged routing fails; valid ISBN single-edition stage and existing bounded author failures pass. Empty options still require external accounting; catalogue conflicts preserve outcome/spend. | Completion/security suites + GUARD; M78-equivalent positive/negative recorded receipt fixtures through v1/v2, facts-only Add/cache and synthetic-provider branch; red: extended validator absent. |
| AC7-24 D33/R06 cache versions | Publish from recorded lookup versions, then reuse with the same worker tuple/current registry: hit with the same receiving versions. Change each capability/schema/routing/cache-policy/adapter/normalizer/reuse/companion version independently: miss (malformed/unsupported contract refuses); completed same-request replay returns its original receipt/counts regardless of later worker config. | Cache + cache-scope edge suites; persisted original-version matrix, legacy NULL routing row and config-upgrade fixture; red: RPC version input/routing column/equality checks absent. |
| AC7-25 D36/Owner OQ6 local searched count | Automatic local match through the existing M32 wrapper creates one M15 lookup/snapshot, one private effect and searched +1 for its resolved work, chosen/added +0 and spend/reservations/attempts +0; lost-response replay adds zero; local replay completed before 7b creates no marker/count. Failed outer completion rolls everything back. | Stats + existing local-match suites; actual structural wrapper call, server-scoped local receipt and rollback fixture; red: M15 count/effect hook absent. |
| AC7-26 R04/Owner OQ5 scan-only scope | Immutable scan-text origin plus matching query identity can be public; provider-facts-only, typed/edited/confirmed/equal-looking or unknown-origin queries stay private and cannot supply a cross-store cache hit. | Cache + cache-scope edge suites; scan/provider-only/Owner provenance matrix; red: provider-origin public branch remains. |
| AC7-27 R06 cache attempt scope | More than ten distinct completed cache-hit requests on one candidate/adapter use fresh lookups, each with one sequence-1 primary attempt and zero provider spend; same-request replay adds no attempt. Same-lookup sequence/role duplicates still fail; legacy NULL-lookup uniqueness is unchanged. | Cache suite; repeated-generation fixture with M67 partial indexes and identity/role constraints; red: reuse RPC absent; assert no candidate-wide capacity failure. |

Keep these **existing** suites green at implementation time; reported historical
counts are tracker evidence, not results rerun here:

- Catalogue link 79 checks: `supabase/tests/phase9/phase9CatalogueLink.integration.test.mjs`;
  native `phase9CatalogueLinkConcurrency.postgres.mjs`; GUARD
  `supabase/migrations/__tests__/marketplacePhase9CatalogueLink.test.ts` and
  `marketplacePhase9Unit6gFoundation.test.ts` (tracker 38: GUARD 26/26 combined).
- `phase9EditionPickerState.integration.test.mjs`, `phase9EditionPickerLocalMatch.integration.test.mjs`,
  `phase9EditionPickerFences.integration.test.mjs`, `phase9EditionPickerConfirmation.integration.test.mjs`,
  `phase9EditionPickerCommit.integration.test.mjs`,
  `phase9OpenLibraryEditionOptions.integration.test.mjs`, Owner-ISBN and M82
  first-save suites, `phase9Unit7aCreateOnlyCommit.integration.test.mjs`.
- ACL guards `marketplacePhase9MaintainAclCorrection.test.ts` and
  `marketplacePhase9SensitiveTableAclCorrection.test.ts`; architecture
  `privacyArchitecture`, `unit6fArchitecture`, `ownerInventoryReadArchitecture`,
  `ownerCorrectionArchitecture` in `src/features/imageInventory/__tests__`.
- Edge tests in `supabase/functions/__tests__`: `phase9_metadata_edition_options_worker`,
  `phase9_metadata_edition_options_rpc`, `phase9_metadata_edition_options_recovery`,
  `phase9_open_library_worker`, `phase9_open_library_edition_options`,
  `phase9_open_library_author_isolation`, `phase9_owner_isbn_worker`,
  `phase9_metadata_resolution_cache`, `phase9_metadata_production_gateway`,
  `phase9_metadata_production_composition` (each `.test.ts`).

**Native PostgreSQL is required.** PGlite/sequential Promise.all cannot prove
uniqueness waiting, advisory lock order, commit/rollback and no deadlock. Extend
the current isolated catalogue clone with separately authorized 7a and 7b modes
and the new native suite, preserving existing M78 native targets and M82 tests
(C20). Run 7a-only Add/identity/security/lock proof with every 7b object absent,
then the 7b completion/cache races on the proven 7a baseline. Future command:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1 -IncludeOpenLibrary
```

Use its existing disposable local PostgreSQL tools, never the shared Supabase
project. Record port/cluster cleanup and wait evidence. Each slice's first run
before its own artifact exists must fail feature assertions rather than fixture
setup; an absent-migration guard
alone is not the full red proof. Relevant future commands include `npm.cmd run
test:phase9:db`, targeted Jest/edge suites and metadata worker build/typecheck;
none is run in this documentation task.

**Parent AC wording refinements proposed here, not silently approved:** AC7-2c
distinguishes differing translation keys from two competing existing work targets;
AC7-3 needs approved list/fallback; AC7-4/5 need precise count attribution/readers;
AC7-7 needs typed cache/provenance/reuse proof; AC7-8 includes canonical-table
revocations already in M81, MAINTAIN and service denial; AC7-1/2e need the owned
match activation boundary. AC7-11–27 add missing compatibility/security/native
proof without relaxing existing AC7-1–10. Parent approved AC text is preserved.

## 12. Build packages, size and review points

No package is authorized now. SDD-0 §15 assigns product code and tests to Codex
`gpt-6.1-sol` (xhigh) from verified strict briefs; orchestrator reviews all diffs.
This is a risky SQL/identity/replay slice and needs the full review loop, not a
routine documentation-only approval presented as permission to build.

| Order | Slice | Proposed package / size | Red proof and review stop |
|---|---|---|---|
| 0 | 7a | Accepted OQ1–OQ8, split-map update and fresh read-only preflight / small | Record the accepted 7a/7b boundary in SDD-0/SDD-2 and decide migration numbering there before any build brief. Verify M82 status and record separate authority; no number reserved here. |
| 1 | 7a | SQL identity/Add/Select/stats/ACL/native tests only / medium | Meaningful feature assertions fail before the 7a artifact exists; schema fidelity checked. Fixture excludes every 7b object and worker change. Record red reasons before production SQL; creation needs separate permission. |
| 2 | 7a | Identity/model/Add/security SQL / large | Schema→pure validators/admission/lock key→identity core→Add/Select choice+added hooks→hidden/blocklist readers→grants in one transaction. Review M81 body diff, identity/locks and security separately. No 7b relation/function reference, M78 completion change or edit to applied M81/M82. |
| 3 | 7a | Independent integration/native/security closeout / medium | Prove legacy and no-ISBN Add, source/ID writes, chosen/added counts and replay with all 7b objects absent. Run relevant regression/ACL/native proof and record exact residuals/docs. Application/read-back need separate permission; 7a requires no worker deploy. |
| 4 | 7b | Completion/cache SQL and companion/transport fixture tests only / medium | On proven 7a, meaningful 7b assertions fail before its artifact/worker exists. Red extraction/binding/bounds/v1/recovery/cache/privacy/zero-spend tests; review every field from original edition JSON, no new HTTP. |
| 5 | 7b | Completion/lineage/cache SQL / large | Separate creation permission. Add companions/lookup effects, completion/local searched hooks and deferred first-choice attribution, v1/v2 recovery, typed cache writer/reuse core, guards/source-policy/legacy readers. Extend Add/Select only for 7b lineage/searched attribution. Review M78-equivalent validation and all claim/receipt/ACL paths; retain the working 7a core. |
| 6 | 7b | Companion contract/extraction and worker transport/v2 completion/recovery / medium | Red tests from package 4 first, then implementation in cohesive modules about 300–350 lines. Preserve old-worker/null-companion compatibility and no retry after uncertain completion. |
| 7 | 7b | Typed query-scope/cache-reuse worker path / large | Cache/security/zero-spend red tests first; SQL boundary reviewed before activation. Pair source-policy/guard review with receiving worker; apply fixed OQ4/OQ5, no app DTO change. |
| 8 | 7b | Independent integration/native/security closeout / medium | Prove completion/transport/cache as a working addition to completed 7a, including two-store privacy, exact counts, recovery, v1 compatibility and cross-path races. Record docs/validator/residuals. Separate application/read-back, worker deploy and browser-check permissions follow. |

Owner OQ8 has decided the split: **7a identity/model/Add/security**, then
**7b completion/transport/cache**. 7a is independently working and testable on
M81/M82 without any 7b object or worker change; 7b is a separately proved working
increment on completed 7a. No 7a SQL body may conditionally query an absent 7b
relation/function. In 7a, Add passes NULL companion, uses existing scoped metadata/
attempt lineage, and resolves through the shared core; Select resolves targets
read-only from tuple/ISBN coherence and its own choice effect. Chosen/added counts
work; searched remains zero until 7b's completion/first-choice hooks exist. 7b
forward-replaces the affected Add/Select bodies to add companion/lookup-effect
reads, pending searched attribution and cache-source support; it preserves 7a's
identity/counter/replay behavior.

| §4–§5 object / replacement | Owning slice and dependency rule |
|---|---|
| §4.1 provider-ID table; §4.2 canonical/registry columns and source rows; §4.3 stats | 7a, including constraints/indexes/RLS/ACL; no new companion needed to write from admitted existing metadata. |
| §4.4 `phase9_catalogue_choice_effects` | 7a; its lookup/attempt FKs target existing tables, never 7b lookup effects. |
| §4.4 `phase9_catalogue_companions`, `phase9_catalogue_lookup_effects`; §4.5 cache/lookup alterations | 7b only. |
| `phase9_catalogue_isbn_v1`, `phase9_catalogue_identity_lock_key_v1`, `phase9_catalogue_shared_admitted_v1`, `phase9_catalogue_provider_ids_valid_v1`, `phase9_catalogue_valid_companion_v1`, `phase9_catalogue_resolve_v1` | 7a; Add needs the lock-key and provider validator now. Pure companion/facts/accounting validation has no 7b relation dependency; absent companion is NULL. 7b reuses these functions. |
| `phase9_catalogue_increment_v1`, `phase9_catalogue_count_choice_v1`; M81 Add/helper and M73 Select replacements; M67/M32 hidden/blocklist read filters | 7a for choice/added and existing-source identity. 7b adds only its companion/cache/lookup-effect and searched-attribution hooks to Add/helper/Select. |
| `phase9_catalogue_valid_cache_v1`, `phase9_catalogue_cache_receipt_guard`, `phase9_catalogue_query_scope_v1`, `phase9_catalogue_store_cache_v1`, `phase9_catalogue_reuse_cache_core_v1` | 7b; cache helpers consume the trusted admission hand-off (§5). |
| Private/public v2 completion/reuse entries; M78 v1 delegate; M73 recovery; M15 local-completion count/effect hook; M68 automatic-payload guard; M73 cache-source policy; legacy cache readers/writer discrimination | 7b; existing production definitions remain in place throughout 7a. |

Migration numbering for 7a/7b is decided when SDD-0/SDD-2's map is updated; no
number is reserved here. The fixed §1 provider-neutrality rule's `M83` label is
the original Slice 7 proposal, not a number reservation; its rule applies across
both artifacts. Each slice needs its own red-first proof and separate build/
creation/application authority. Review SQL by semantic sections; do not split an
applied migration to satisfy line counts. Stop after the authorized package and
its proof; no broad cleanup or later matcher implementation.

## 13. Implementation-time documents and live facts

### 13.1 Documentation update matrix

At implementation, follow [CODEBASE_MAP update table L62](../../../../../../CODEBASE_MAP/README.md#L62)
and SESSION-START §6/§8. This draft changes no described runtime/source-spec
folder and needs no map edit; only the brief's allowed documentation is changed.

- DOC-3 **§4.2**: exact provider-work grouping/translation interpretation after
  OQ3; **§5.1**: ISBN-first/provider-tuple/no fuzzy merge; **§5.2**: coherent
  promotion, no Google/manual shared writes, lookup/Add timing, cache/counters;
  **§14**: tables/columns/ACL/public note/source deadlines; **§17**: exact bounded
  identity does not authorize automated merge/reassignment. Preserve its explicit
  search/HTTP-budget/confirmation rules. Source edits ship with implementation.
- SDD-0 D37, slice map and Q4/OQ decisions; SDD-2 Slice 7 final status/AC wording
  and the accepted 7a/7b split map before build; Slice 8a's SQL inventory must name all new generic
  core/admission/cache readers and M81 helper/Add (02a §6.1). Slice 9 owns relaxed
  predicate/benchmark activation. No matching rule is originated in a tracker.
- `supporting/data-dictionary.md`: provider IDs/key version, source payload,
  work/edition stats (no ownership), cache union/private receipts, actual public
  canonical columns and hidden semantics. Correct old private annotations for
  metadata_verified_at/metadata_selection_version (02a §8).
- `supporting/database-current-vs-target.md`: dated live preflight, defaults,
  constraints/policies/ACLs/dependencies, local/live migration mapping and no reset.
  `supporting/requirements-traceability.md`: all AC7-x→test/fixture, OQ resolution,
  negative security and native evidence; `trackers/02-implementation-and-verification.md`:
  red/green, migration ledger, security matrix, rollout/read-back and deviations.
- Tracker 38 append evidence; ACTIVE/DOC-13/TRACKER/SESSION-START identical current
  handoff; phase README only at actual implementation routing change.
- CODEBASE_MAP **03-backend.md** for new worker/RPC/cache/definer path;
  **05-marketplace-rules.md** when DOC-3 changes; **06-testing.md** for new runner,
  harness list and guards. **04-features.md** only if its described module path
  changes; **08-glossary.md** if a repeated new term needs definition. No status,
  live count, machine path, branch or secret in map files. 01/02/07/09 only when
  their README triggers apply, not automatically for a new SDD in an existing folder.
- Migration allowlist update is owned by its authorized migration step: M82's
  separate step must add M82; each 7a/7b step may add only its own approved file
  after numbering is decided with the split map.
  No validator edit is authorized by this documentation task.

### 13.2 Live facts to collect (read-only) before build

The 2026-10-25 snapshot and 2026-10-25/26 M81 records are the only DB facts used.
Do not infer current live state from local migration files. Collect through fresh
read-only MCP only when separately authorized for the build/preflight session:

- Exact project identity; migration history M81 mapping and separately recorded
  M82 application/version/read-back; availability of both migration numbers only
  when the SDD-0/SDD-2 split map decides them, across active branches/history.
- Current M81 helper/Add bodies/hashes/security/ACL/overloads; M78 completion,
  M73 Select/source policy, cache/guard bodies and every function to replace.
- Canonical/source/registry/cache/attempt/lookup/receipt tables: defaults, all
  constraints/index names/collations/limits, FKs/delete actions, triggers, grants,
  RLS policies, MAINTAIN privileges, PUBLIC/default/inherited privileges. Source
  writers and actual attempt_sequence limits; no assumption that local defaults
  establish live ACLs. Fresh counts are observations, not a reset prerequisite.
- Legacy Hobbit key/edition/linked dependency identities and any additional
  normalized-key collisions; source provenance only if actually recorded, never
  guessed. Read-only evidence sufficient to choose OQ1; no reset/DML.
- Deployed worker capability/schema/normalizer/routing/cache-policy/companion versions
  and matching recorded lookup/cache version columns, including whether routing
  is persisted yet; no assumed live registry columns or configuration values.
- Cache population/scopes/current TTL/version/size, original scan query provenance
  retained in immutable observations, in-flight lookup/attempt/reservation/physical
  receipts, and cleanup retention that must preserve selected companions.
- Current OL permissions/versions/revalidation/raw retention/attribution; prove
  new public facts remain within D35, no expiry-requiring second provider. No
  provider HTTP/licence investigation is performed by this task.

## 14. Owner questions and conflicts

This is the single numbered Owner-question list. Recommendations/costs are design
proposals; no choice below was made by the author. Settled Q15/Q18/Q20/Q21 are not
reopened. A build brief must name the recorded answer wherever conditional.

**Owner answers (chat, 2026-10-26).** These are decisions; they replace the
recommendations below where they differ (they do not).

| OQ | Answer |
|---|---|
| OQ1 | Leave it: keep no-update incumbents and the safe skip; no data change. |
| OQ2 | Blocked ISBN ⇒ whole-record catalogue skip (Add still succeeds unlinked). Build the versioned list and check now with **zero entries**; the Owner adds real entries later as data. Deliberate start-empty, recorded against D37's "short list" wording; no invented entries. |
| OQ3 | Lookup writes use the current explicit-search predicate until Slice 9. Translations join a work only via the provider's own work ID with no competing row. |
| OQ4 | Extend the existing cache table (§4.5/§8 tagged kind, zero-egress reuse path). |
| OQ5 | Public scope only for searches proven to come from scan text; anything Owner-typed, edited or confirmed stays private. |
| OQ6 | Recommendation accepted (Owner: "go with your recommendation for the rest"): every new committed selection counts once; one added per linked Add; searched once per completed lookup on its sole/first-resolved work; stats server-read-only. |
| OQ7 | Recommendation accepted: provider-ID-only rows stamp `psr-catalogue-provider-id-v1`; M81's ISBN stamp unchanged; registry `shared_source_note`; first source row kept, no refresh. |
| OQ8 | Recommendation accepted: split before build — 7a identity/model/Add/security, 7b completion/transport/cache — each working on its own with red-first proof. Migration numbers and SDD-0/SDD-2 map changes are decided at the split, not here. |

Design status after answers: decisions recorded; independent review and design
approval still pending; no build, migration creation or application authorized.

1. **OQ1 — Legacy raw-case work and skipped-link race.** Recommend retain the
   no-update incumbent/accepted safe skip in this slice, with explicit native
   regression evidence. Cost: a different Hobbit ISBN can still duplicate its
   work and rare Adds can remain unlinked. Alternative: separately design a
   read-only normalized incumbent resolver plus bounded post-rollback re-resolution;
   cost: ambiguity/locking tests and a new work-resolution policy, but fewer
   duplicates/skips. Alternative: separately approved targeted key migration or
   reset/rebuild; cost: FK/immutable-reference/dependency remediation and data
   mutation authority. **No data change/reset is approved.**
2. **OQ2 — D37 actual blocklist and fallback.** Recommend an Owner-reviewed,
   versioned small set of explicit placeholder/known-reused ISBN-13 values, enforced
   by the shared SQL identity/local/cache boundary (ISBN-10 converted first), with
   blocked identities causing catalogue skip for the whole record initially.
   Cost: some valid provider-ID options stay private/unlinked. Alternative: strip
   blocked ISBNs and retain tuple-only canonical identity; cost: explicit policy
   for canonical/source ISBN projection and reused-ISBN safety tests. Empty list
   or heuristic repeated-digit detection alone does not satisfy D37; Owner must
   supply/approve actual entries/reasons, not authorize invented reused ISBNs.
3. **OQ3 — Lookup predicate activation and translation interpretation.** Recommend
   build the fenced D39 writer against the currently approved explicit predicate
   until Slice 9's benchmark-approved relaxed predicate replaces it, without
   enabling automatic OL. For translation grouping recommend provider-work ID
   wins when its translated normalized key has no competing row; conflicting
   existing work targets still skip. Cost: explicit admission/subset is an Owner
   clarification of AC7-1, plus translation tests. Alternative: hold lookup-time
   activation for Slice 9 but finish/test the boundary now; cost: D39/Slice 7 is
   operationally partial, requiring approved scope/AC change. Treat every different
   translation key as conflict instead; cost: loses DOC-3 §4.2 grouping. Do not
   silently choose one interpretation or implement relaxed matching here.
4. **OQ4 — Explicit shared cache architecture/source-policy ownership.** Recommend
   §4.5/§8's tagged extension of the existing public_bibliographic cache and a
   dedicated fenced zero-egress reuse path, preserving automatic snapshot guards.
   Cost: cache CHECK/legacy-reader discrimination, logical cache attempt and
   source-policy/guard changes; Slice 8's F42 inventory must reflect ownership.
   Alternative: separate typed options-cache table with the same privacy mode;
   cost: duplicate schema/expiry/security paths and amendment of D33's existing
   cache reuse direction. Alternative: canonical local reuse only until Slice 8;
   cost: incomplete AC7-7/explicit-options cache scope; needs explicit deferral.
5. **OQ5 — Positive evidence for public query origin.** Recommend §8's conservative
   immutable-scan origin proof; any Owner-derived or unknown component
   stays private, including equal-looking confirmed text and typed ISBNs. Cost:
   fewer cache hits and context/provenance checks. Alternative: permit confirmed
   but unchanged scan values after exact lineage comparison; cost: define whether
   confirmation changes origin and add codepoint/normalization tests. Never publish
   a newly Owner-typed key or merely its hash under either answer (R04).
6. **OQ6 — D36 count semantics/readers.** Recommend one count per newly committed
   selection command (fresh-key reselection counts again), one added per linked
   Add, one searched per completed logical lookup on its sole accepted work or
   first later resolved choice, private one-time marker; stats server-read-only.
   Cost: delayed/no searched count for unselected options, and reselections can
   weight popularity. Alternative: count only a changed choice/candidate-edition
   once; cost: additional private dedupe state and explicit reselection contract.
   Alternative: count only completion-time auto-selected searches; cost: explicit
   searches never contribute, narrowing Q4. Public/authenticated stats reads cost
   an explicit disclosure/grant decision; keeping reads server-only needs no UI.
7. **OQ7 — Provenance note/stamp and source refresh.** Recommend new provider-ID-only
   rows stamp `psr-catalogue-provider-id-v1`, keep ISBN rows' M81 stamp unchanged,
   use the registry `shared_source_note` (§4.2; OL text proposed there) and first source row retained without refresh. Cost:
   stale source deadlines/facts persist and expired cache may need a new provider
   lookup; canonical permitted permanent facts remain. Alternative: one new
   all-writes policy stamp and source-row refresh; cost: changes M81 expectations,
   needs refresh/concurrency/retention semantics and conflicts with deferred Q17.
   Canonical incumbents remain immutable under every option; second-provider
   overwrite/licensing/reset policy stays deferred with Q15/Q18.
8. **OQ8 — Scope/session split before build.** Accepted in the Owner answers
   table: 7a identity/model/Add/security first, 7b completion/transport/cache
   second, each independently working with red-first proof (§12). The split is
   decided; SDD-0/SDD-2 map updates and migration numbering/authority remain to be
   recorded before build. No migration number is reserved here.

**Conflict register (evidence, not new product decisions):**

| Sources | Conflict/gap and disposition |
|---|---|
| SDD-0 D39/Q3; SDD-2 AC7-1; current OL adapter C02; Slices 8/9 | Lookup writes demand a relaxed predicate unavailable in the current automatic route. OQ3 gates activation; no automatic matcher invented. |
| SDD-0 D32/D35; SDD-2 Slices 7–8; this draft before 2026-10-26 | The first draft wrote OL's ID grammar, cover ID, attribution text and raw retention into generic rules. Owner reaffirmed provider neutrality (2026-10-26): §1 rule, §4.2 registry `shared_source_note`, §5 admission/validator functions and AC7-21 now confine OL to registry data, one admission allow-list and one validator branch. SDD-2 Slice 7 gains AC7-21 and the new registry column when this design is approved. |
| SDD-2 work grouping and AC7-2c; DOC-3 §4.2; M81 equality checks | Translated work title may differ without two competing targets; literal M81 work-title equality would reject grouping. OQ3 distinguishes that from genuine conflicting IDs. |
| D33/F18/F35 versus M68 guard/M78 attempt semantics/M15 positive cache | Public mode exists, explicit options reuse does not. OQ4's new typed boundary is required; changing scope literal alone is incorrect. |
| R04/D40/F43 versus current key builder/context | Owner-confirmed text enters query identity and key lacks scope/store. OQ5 plus new key namespace, no promotion of old rows. |
| D36/Q4 versus Select/completion code | No shared stats today; replay alone does not decide reselections, unselected multi-work attribution or reader grants. OQ6. |
| D37 versus M81, registry/source rows | No blocklist contents approved; key/note columns absent. OQ2/OQ7; canonical hidden is new, not an existing registry flag. |
| DOC-3 §§5.1/5.2/14/17 versus Owner D35/D39/Q20 | Old provider-ID-as-trace/picker-not-promoting wording is superseded only within the approved amendment; implementation-time source edits are listed in §13. No fuzzy merge or provider-as-universal-ID claim. |
| 02a OQ4 versus new no-ISBN write path | M81 fixes fetchedAt/ISBN stamp, not provider-ID stamp/source refresh. OQ7; no retroactive canonical UPDATE. |
| SDD-0 one-session guardrail versus SDD-2 optional 7a/7b | Owner OQ8 accepted the 7a/7b split; §12 assigns objects/packages. Update SDD-0/SDD-2's map and decide migration numbers before build; this design grants no migration creation authority or number reservation. |
| E01 old grants/counts/history versus E02/E03 and this brief | Dated snapshot comments are historical. M81 read-back and one browser proof supersede them; M82 is separate and its actual live status is a preflight fact, not guessed from its local file. |

All BookConnect pointers in §2 were checked locally (orchestrator spot-check
2026-10-26: C02, C04 L119, C10 L120–160, C11 L36/L34, C12 L268/L510 confirmed); proposed NEW paths are labeled, and live-only facts are
explicitly deferred to §13.2. This document stays cohesive around Slice 7's one
identity/completion/cache boundary despite its length; splitting authority merely
to hit a line target would make review and handoff less reliable.
