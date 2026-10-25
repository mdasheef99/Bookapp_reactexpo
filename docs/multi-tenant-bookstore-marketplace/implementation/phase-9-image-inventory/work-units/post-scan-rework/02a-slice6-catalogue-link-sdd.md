# Post-Scan Rework — Slice 6 Catalogue Link at Add

| | |
|---|---|
| **Status** | Pass-2 design, revision 3 (trimmed; Argon review fixes applied), 2026-10-25; **DESIGN APPROVED BY THE OWNER 2026-10-25 (revision 3 plus section 6.1) / NOT APPROVED FOR BUILD**. The catalogue reset is not part of slice 6 (§9.1). M81 applied to Supabase on 2026-10-25 (supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql, 517 lines; APPLIED_LIVE as live version 20261025171647); no other implementation. |
| **Parent** | [SDD-2, slice 6](./02-catalogue-and-matching-sdd.md#slice-6--catalogue-link-at-add), under [SDD-0](./00-overview-sdd.md). |
| **Authority** | PSR-D34/D35/D37/D40; PSR-R01/R04/R05/R06/R09/R10; Q15–Q21. SDD-0 §§2/7.3/15 require review and separate Owner approvals. |
| **Baseline** | Local branch claude/phase9-psr-slice6-catalogue-link, HEAD d09e8fd, the committed amendment cherry-picked from facf1c7 (Owner brief); no publication in this session. Slice 5 closed at 0de13ed. |
| **Database evidence** | Only [live snapshot 2026-10-25](../../../../../../.claude/psr-slice6/db-evidence.md#L1). No fresh connection or project verification was performed here. |
| **Migration** | Phase 9 **M81: APPLIED_LIVE** (file created locally 2026-10-25; applied 2026-10-25 as live version 20261025171647; the file's header comment still says "PROPOSED, not applied" - stale by design, an applied migration file must not be edited). One forward migration: private helper, Add replacement and canonical-table write revocation (OQ6, decided). No reset precondition. |
| **Size / risk** | M / medium; cross-store identity, shared public facts and real uniqueness races require native PostgreSQL proof. |

This is the implementation specification for the approved direction. The Owner
decided its open choices on 2026-10-25 (§14); the answers are applied below and
nothing in §§3–13 awaits an OQ answer. An engineer can derive the red tests and
migration from the contracts below. No product, test, SQL or config file is
changed by this design. The supplied snapshot substitutes for the normal live
preflight only for this documentation task; it does not authorize application.

**Owner decisions, 2026-10-25 (revision 2):** (1) no catalogue reset in slice 6
(§9.1 is a short note; a reset stays possible later and needs its own design and
approval); (2) Add succeeds when a saved catalogue target disappears (§§3.1, 4,
7, 10); (3) the D37 blocklist moves to slice 7 (OQ2); (4) OQ1, OQ3, OQ4 and OQ7
take the recommended defaults; (5) canonical-table write revocation is in M81
(OQ6) because the writer audit in §9.2 found no writer using anon or
authenticated. §14 lists them. None authorizes implementation.

## Contents

1. Goal, boundary and authority
2. Verified code and evidence map
3. Saved selection and helper inputs
4. Private helper contract and locks
5. Identity and normalization
6. Provider admission
7. Writes, conflicts, concurrency and replay
8. Triggers, readers and immediate user effects
9. Existing catalogue rows, reset note and privilege finding
10. Acceptance checks and red-first tests
11. Proposed migration and readback
12. Rollout, rollback and risks
13. Documentation at implementation time
14. Owner decisions and conflicts

## 1. Goal, boundary and authority

After an eligible Add, the new private inventory row links to an existing or
new canonical edition/work when the chosen, server-held edition can safely be
identified. New shared rows use only admitted Open Library facts and validated
ISBN identity. A catalogue refusal leaves Add successful and unmatched (D34/D35,
Q20, R10). Required selling review, tenant checks and the Add receipt remain.

Scope is the private helper and a replacement of M69's Add body, retaining its
signature, response and all other effects. The helper runs after eligibility and
before the inventory INSERT, inside the same transaction. Slice 13 will reuse
this boundary; it is not built now. The alternatives already settled by SDD-2
are a client/worker write (rejected: wrong transactional boundary), or adding the
shared-catalogue capability now (rejected: slice 8 owns that column). No new
approach or product decision is selected here.

**Not in scope:** stats/counters; source-row writes; provider-ID list or identity
without ISBN; new columns/tables/indexes; hidden flag/source note/normalizer-version
columns; lookup-completion writes; cache changes; provider routing or Google
disablement; automatic matching/benchmark; category/label features; publishing at
Add; any catalogue reset (§9.1 note); blocklist (slice 7); backfill. SDD-2 slice 6 explicitly says “no backfill” (L85), so the
32 existing inventory rows remain unlinked. This is unambiguous, not an inferred
exception. A replay of an old Add also performs no backfill.

Sources: [SDD-0 D34–D40, L198](./00-overview-sdd.md#L198),
[rules, L251](./00-overview-sdd.md#L251),
[Q15–Q21, L603](./00-overview-sdd.md#L603),
[process, L618](./00-overview-sdd.md#L618);
[SDD-2 scope/migration, L49](./02-catalogue-and-matching-sdd.md#L49).

## 2. Verified code and evidence map

All paths below were opened or matched locally. Line references refer to this
design's baseline; **NEW** paths in §10 are proposed files, not existing proof.
M-number shorthand elsewhere in this document refers to these exact files.

| Ref | Verified pointer and significance |
|---|---|
| C01 | [M69 Add, L99](../../../../../../supabase/migrations/20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql#L99): latest local definition of public.phase9_add_candidate_to_inventory_v1, through L234. Earlier replacements are M54 L151 and original M39 L220. No later migration replaces Add. |
| C02 | [M69 saved-choice gate, L11](../../../../../../supabase/migrations/20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql#L11): manual/selected/edition_option coherence. L54 commit eligibility wraps the original [M39 eligibility, L113](../../../../../../supabase/migrations/20260812000039_marketplace_phase9_create_only_inventory_commit.sql#L113). |
| C03 | [M69 Add guards/replay, L113](../../../../../../supabase/migrations/20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql#L113): fingerprint/replay L121–126; active-session and candidate locks L127–136; eligibility L137–138. Snapshot branches L142–187; inventory columns L188–205; cleanup, audit/event and receipt L207–233. |
| C04 | [M54 session lock, L12](../../../../../../supabase/migrations/20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql#L12): scoped initiating Owner, store ownership, mutable session, FOR UPDATE. |
| C05 | [M73 option selection, L166](../../../../../../supabase/migrations/20261011000073_marketplace_phase9_open_library_edition_options.sql#L166): options L192–199, current suggestion L200–202, chosen JSON copied to state L211–217, review fields L218–229. [M70, L47](../../../../../../supabase/migrations/20261008000070_marketplace_phase9_edition_picker_confirmation.sql#L47) owns private-helper ACL pattern. |
| C06 | [M73 metadata validator, L12](../../../../../../supabase/migrations/20261011000073_marketplace_phase9_open_library_edition_options.sql#L12): bounded known keys, authors/categories/language, cover URL. Source policy L90 joins attempt/lookup/registry. No policy version, work reference or canonical ID is a permitted metadata key. |
| C07 | [MetadataEdition, L32](../../../../../../supabase/functions/_shared/imageInventory/contracts/metadata.ts#L32): full normalized provider payload. [Worker persistence, L128](../../../../../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptions.ts#L128) checks adapter/correlation/attempt/fetchedAt and completes L138–141. |
| C08 | [Open Library adapter, L48](../../../../../../supabase/functions/_shared/imageInventory/metadata/openLibrary/adapter.ts#L48): validates work key; L102–104 passes only context plus rows to normalizer. [Normalizer, L72](../../../../../../supabase/functions/_shared/imageInventory/metadata/openLibrary/normalizer.ts#L72) extracts edition ID/facts/own cover; L126–132 adds provenance, empty categories and null description/series/volume. Work ID is not transported. |
| C09 | [M65 canonical/current snapshots, L166](../../../../../../supabase/migrations/20261007000065_marketplace_phase9_edition_picker_state.sql#L166): canonical cover_url enters catalogue snapshots; L179–185 resolves the separate canonical ID. [M15 snapshot table, L142](../../../../../../supabase/migrations/20260728000015_marketplace_phase9_metadata_foundation.sql#L142) holds canonical_edition_id, lookup/attempt links and selection_policy_version; mutation rejection starts L177. |
| C10 | [P3 canonical schema, L5](../../../../../../supabase/migrations/20260628000003_marketplace_phase3_inventory_canonical_listings.sql#L5): work key L13, ISBN constraints L32–33; public SELECT policies L154–157. [M01 columns/registry, L4](../../../../../../supabase/migrations/20260722000001_marketplace_phase9_catalogue_metadata_expand.sql#L4): registry columns, edition additions L26–32. |
| C11 | [SQL text/ISBN normalizers, M32 L5](../../../../../../supabase/migrations/20260807000032_marketplace_phase9_structural_metadata_integration.sql#L5), ISBN L37–66; [worker text identity, L22](../../../../../../supabase/functions/_shared/imageInventory/metadata/queryIdentity.ts#L22); [shared worker ISBN, L1](../../../../../../supabase/functions/_shared/imageInventory/domain/isbn.ts#L1); [app ISBN, L1](../../../../../../src/features/imageInventory/review/isbn.ts#L1). |
| C12 | [App client, L104](../../../../../../src/features/imageInventory/api/ownerUxService.ts#L104) and [commit coordinator, L77](../../../../../../src/features/imageInventory/commit/useInventoryCommitCoordinator.ts#L77) call unchanged Add action. [Edge route, L31](../../../../../../supabase/functions/_shared/imageInventory/runtime/ownerUxRpcRoutes.ts#L31) maps its seven arguments; [dispatch, L225](../../../../../../supabase/functions/_shared/imageInventory/runtime/ownerIngestion.ts#L225) uses userClient.rpc and parses the existing response. |
| C13 | [Commit suite, L13](../../../../../../supabase/tests/phase9/phase9EditionPickerCommit.integration.test.mjs#L13); [commit fixture, L12](../../../../../../supabase/tests/phase9/editionPickerCommitFixture.mjs#L12); [Unit 7A caller, L156](../../../../../../supabase/tests/phase9/unit7aFixture.mjs#L156); [Edge caller test, L166](../../../../../../supabase/functions/__tests__/phase9_edition_picker_gateway.test.ts#L166). |
| C14 | [M69 representative-cover trigger body, L235](../../../../../../supabase/migrations/20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql#L235); [M61 trigger registration, L184](../../../../../../supabase/migrations/20260913000061_marketplace_phase9_representative_edition_cover.sql#L184). |
| C15 | [M41 quality/handoff/refresh, L5](../../../../../../supabase/migrations/20260813000041_marketplace_phase9_unit7a_quality_handoff.sql#L5): BEFORE INSERT L41, BEFORE UPDATE L60, listing-sync trigger L66. [M45 listing-sync body, L26](../../../../../../supabase/migrations/20260815000045_marketplace_phase9_unit7c_media_history.sql#L26): private gate L40, own inventory cover L65, canonical IDs L82/L98. |
| C16 | [M67 local catalogue match, L10](../../../../../../supabase/migrations/20261007000067_marketplace_phase9_edition_picker_operation_fences.sql#L10); [M49 marketplace grouping, L89](../../../../../../supabase/migrations/20260818000049_marketplace_phase9_bookstore_first_discovery.sql#L89); [M50 storefront catalogue, L228](../../../../../../supabase/migrations/20260820000050_marketplace_phase9_storefront_detail.sql#L228), inventory provider-cover reads L187/L412. |
| C17 | [Client discovery grouping, L43](../../../../../../src/features/marketplace/services/discoveryHelpers.ts#L43); [store listing grouping, L102](../../../../../../src/features/stores/services/storeInventoryService.ts#L102); [Owner canonical ID schema, L88](../../../../../../src/features/imageInventory/contracts/ownerUxCandidateSchemas.ts#L88). |
| C18 | [M78–M80 SQL-suite stack, L12](../../../../../../supabase/tests/phase9/phase9OwnerIsbnEditionLookup.integration.test.mjs#L12); [M78 private/public ACL, L459](../../../../../../supabase/migrations/20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql#L459); [native runner migration list, L108](../../../../../../supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1#L108), actual test invocation L241–250; [M78 native races, L48](../../../../../../supabase/tests/phase9/phase9EditionPickerConcurrency.postgres.mjs#L48). |
| C19 | [Open Library SQL fixture pattern, L24](../../../../../../supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs#L24); [native Open Library fixture, L17](../../../../../../supabase/tests/phase9/openLibraryPostgresFixture.mjs#L17), chosen card L59; [race API, L5](../../../../../../supabase/tests/phase9/phase9OpenLibraryConcurrency.postgres.mjs#L5). |
| C20 | [M52 structural guard, L40](../../../../../../supabase/migrations/__tests__/marketplacePhase9Unit6gFoundation.test.ts#L40) checks immutable M52 only; it does not prohibit a new forward Add replacement. [Dictionary metadata fields, L317](../../supporting/data-dictionary.md#L317). |
| C21 | [Phase 3 smoke record, L52](../../../PHASE-3-inventory-canonical-listings.md#L52): historical inventory/listing smoke evidence; it is not reset authority. |
| C22 | [Snapshot facts, L9](../../../../../../.claude/psr-slice6/db-evidence.md#L9): tables/triggers/registry; grants L22; Add hash L28; existing data L36; migration history L42. |
| C23 | [Live snapshot 2026-10-25, addendum L49](../../../../../../.claude/psr-slice6/db-evidence.md#L49): incoming canonical FKs/delete actions/counts, three blocking references, no-FK projection, JSON not scanned, no view/rule dependency. Only this addendum supplies reset reference counts. |

**Add body comparison:** extracted all characters between Add's two $$ body
delimiters (including its final END), retaining body newlines, with CRLF converted to
LF: length **8972**, MD5 **f38185ddd742cd0fbb249db1a903738e**. This exactly matches
live snapshot 2026-10-25 L29. Raw CRLF checkout text is length 9103, MD5
5edbedcff8cd53f249deb73be5afc342; that is a line-ending difference, not a different
function. Compare prosrc, not pg_get_functiondef formatting or the whole file.

## 3. Saved selection and helper inputs

M69's eligibility is not a provider-admission check. The outer Add first proves
Owner/store/session, versions, current review and saved choice (C02–C04). Keep
those checks and refusal codes, with the narrowly scoped disappearance handling
in §3.1. An otherwise ineligible Add must never
call the catalogue writer or create shared rows.

| Saved mode | Existing authoritative facts and catalogue reference |
|---|---|
| edition_option | Lock phase9_candidate_edition_state for this candidate/store/session. Read selected_option_snapshot, selection_id, selected_source and selected_source_id. These were saved by the controlled select command, not submitted as Add metadata. |
| edition_option + current_suggestion | selected_option_snapshot is a **reduced display projection** (M73 L202 stores phase9_edition_current_snapshot(c), built by phase9_edition_snapshot from a fixed key list; M65 L3–7, L175–189), without adapterKey, correlationId, attemptId, fetchedAt or providerRecordId, so it cannot pass phase9_edition_valid_normalized_metadata. The writer reads the full provider payload (coherent_edition, lookup_id, selected_attempt_id) from the separately scoped phase9_selected_metadata_snapshots row selected_source_id, after proving that, when no surviving canonical edition backs the snapshot, phase9_edition_snapshot(coherent_edition) equals selected_option_snapshot. A missing row, mismatch or missing lineage means no catalogue creation. The canonical ID, if any, is on the same row, as M69 L150–153 does today. For slice 6 this path creates rows only if an automatic suggestion came from an admitted provider (Open Library becomes automatic in slice 8); Google and other suggestions never create. |
| selected | Read the immutable snapshot identified by both review.metadataChoice.selectionId and candidate.selected_metadata_snapshot_id with candidate/store filters. canonical_edition_id is a column there. If absent, coherent_edition is the provider fact source. |
| manual | No catalogue creation; retain M69 manual inventory behavior. An Owner identity edit becomes manual through existing slice-2 rules and M69 saved-choice validation (AC6-6). |

The full chosen JSON has adapterKey (the provider key), adapterVersion,
normalizerVersion, contractVersion, schemaVersion, providerRecordId (Open Library
edition ID), correlationId (lookup UUID), attemptId (attempt UUID), fetchedAt,
ISBNs, title/subtitle/authors, publisher/date, language/script, description,
editionStatement/series/volume/format, pageCount/categories and coverReference
(C06–C08). It has **no provider field named provider, adapter_key, policyVersion,
Open Library work key, canonical edition ID or canonical work ID**. Those must
not be invented or added to immutable JSON. The app's projected snapshot omits
worker provenance; it is not a writer input.

Registry policy version comes from the retained lookup's reuse_policy_version;
adapter identity/version from its attempt and the chosen JSON. Resolve by JSON
correlationId/attemptId after validating UUIDs, not exclusively by the state's
source_lookup_id/source_attempt_id: options cleanup clears those source pointers
while preserving the selected snapshot (M69 L93–98). A later search can replace
them. Bind the resolved attempt to that lookup, candidate and store; bind lookup
to the same candidate/store/session's job and query identity. Do not substitute
the newest lookup for the selected one. Open Library fallback may have a Google
primary lookup: use the **selected attempt's** adapter, not lookup.adapter_key
as the provider assertion (C19 L25–38).

The helper receives **only three UUIDs** from the locked outer Add:
v_candidate.id, v_session.id, v_session.store_id. It rereads the scoped candidate
and its chosen selection itself. No client-provided store, JSON, catalogue ID,
title, authors, cover or policy assertion is accepted. No store-owned value is
copied into a shared row. Missing or unprovable provider lineage skips catalogue
creation; it does not invalidate a choice already accepted by Add's saved gate.

### 3.1 Saved catalogue target disappeared (Owner requirement, revision 1)

**Current M69 behavior (C01/C03):** after eligibility at L137–138,
edition_option/current_suggestion reads snapshot.canonical_edition_id at
L150–153 and selects work_id without checking that the edition was found. A
missing edition can leave the old edition UUID set and a NULL work; INSERT at
L188–205 then violates store_inventory's edition FK (P3 L53–54). In selected
mode L156–165 reads the scoped snapshot, copies its ID, and explicitly raises
P9_STATE_CONFLICT if the edition is absent. Neither branch locks that edition.
The coherent_edition fallback L173–182 runs only when the saved ID was NULL.
Candidate.canonical_edition_id is not independently resolved by this Add body.

There is also an **earlier gate dependency**: M69 L28–36 calls
phase9_edition_current_snapshot, whose [M65 L175–189](../../../../../../supabase/migrations/20261007000065_marketplace_phase9_edition_picker_state.sql#L175)
rereads the canonical edition and returns NULL when identity cannot be proved.
Thus a selected-mode stale pointer may fail eligibility before L165. A helper
called only after that unchanged gate would not satisfy this requirement.

**Required M81 Add-local adjustment:** under the existing session/candidate locks,
lock the chosen edition state and establish the same server-held selection ID,
snapshot/candidate/store binding, saved review/version and identity confirmations.
For an otherwise valid saved selection whose target alone is absent/SET NULL,
evaluate ordinary review/selling eligibility on a transaction-local candidate
copy with metadataChoice={mode:manual,selectionId:null}; never persist that copy.
This reuses the pattern at M69 L59–62. It still runs M69's ordinary eligibility,
including the [M55 L129–149](../../../../../../supabase/migrations/20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql#L129)
state/review/blocker/nonempty-author checks. It is allowed only after proving
the saved choice independently of its catalogue row: same saved selection and
scope, coherent chosen JSON when held, and confirmed saved review identity.
A missing selection/snapshot, invalid chosen JSON, changed review identity,
unconfirmed field or stale version still refuses Add. The local-copy fallback
additionally re-proves every selected-branch condition other than the canonical
row's existence, as enforced through phase9_edition_current_snapshot (M65
L175–189) and the saved-choice gate (M69 L26–37): the manual_outcome is one of
accepted_metadata_match or local_canonical_match; a non-null normalized
observed_isbn_clue equals an ISBN of coherent_edition when it is held;
phase9_edition_identity_compatible holds when coherent_edition is held; and
the selection ID equals both candidate.selected_metadata_snapshot_id and
review.metadataChoice.selectionId. Any failure keeps the ordinary refusal
(P9_STATE_CONFLICT): a card with no ISBN clue whose target vanished still
refuses. The implementation reads the exact condition list from those lines. No general conversion of
invalid choices to manual and no global eligibility/projection-helper change.
The initial absence probe is only for this gate; if the ordinary gate fails,
recheck scoped target absence under the same transaction before permitting the
local-copy eligibility path. The helper performs the authoritative existence/
lock check. Present-ID disagreement follows OQ3/Q20 (§7.2).

Move canonical dereferencing out of M69's branch into the helper; call it after
eligibility and scoped selection resolution, before canonical-derived inventory
field hydration and INSERT. Remove L165's missing-edition exception and the
unvalidated ID carry at L151–153. Initialize both link variables to NULL. A
missing/null hint is **no link**, never a state error or a dangling inventory FK.
For an eligible Open Library choice, continue through §6 and §7.2 identity
find/create from the retained provider payload; otherwise Add succeeds with
NULL links. Missing provider payload/lineage does not manufacture provider facts.
In selected mode use coherent_edition's existing L173–182 mapping when there is
no surviving edition; if that payload is NULL (possible for a local match,
M15 L163–165), keep nullable metadata NULL and the saved reviewed title/authors/
language/selling values. edition_option retains its chosen JSON fields unchanged.
If a target survives, the existing canonical-field hydration remains under the
helper-held locks. Do not fetch another provider or edit any stored snapshot.

Treat canonical_edition_id/canonical_work_id hints on the scoped candidate,
saved snapshot or edition state/JSON by the same rule; only a hint bound to the
chosen selection may be considered, never a new client assertion or a different
candidate link. Current schemas have no separate canonical-work hint on the
candidate/state and no ID in the validated option payload (C06, C09);
this rule does not add JSON keys or relax those validators. Resolve work from
the **surviving edition.work_id**, not an old work hint. A missing/null work
means no complete link; never return a work-only ID or a dangling work UUID.
For eligible OL, attempt normal identity resolution, which may still skip an
orphan incumbent under the no-update rule. Otherwise both IDs stay NULL.
OQ3's “just links” therefore means **links only if the row still exists**;
disappearance tolerance is decided, as is the OQ3 default: surviving saved IDs
keep their trusted link without new shared writes, and a NULL-work incumbent
gets no link.

This is deterministic acceptance for a catalogue disappearance, not a promise
to swallow all database errors (OQ7). Replay returns the original inventory ID
before these checks and is **not re-evaluated**, even if catalogue rows vanished.

## 4. Private helper contract and locks

Proposed SQL contract (new function; no RPC/Edge route):

    marketplace_sec.phase9_catalogue_link_for_add_v1(
      p_candidate_id uuid, p_session_id uuid, p_store_id uuid
    ) RETURNS TABLE(canonical_work_id uuid, canonical_edition_id uuid)
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''

Owner postgres. Fully qualify relations, helpers and extension calls. Return
**exactly one row**: coherent IDs on success; both NULL on a catalogue skip.
An already linked edition with a nullable work is the decided OQ3
case (no link, no repair); do not silently repair it. Never return a work-only result or intermediate
new IDs after a conflict. No public diagnostic/reason field is added to Add.

Explicitly REVOKE ALL ON FUNCTION with its full UUID signature FROM PUBLIC,
anon, authenticated, service_role, including default-granted execution. Grant
no execution back to those roles. postgres, owning both Add and the helper,
already has implicit execution; no extra role grant is needed (M70/M78 pattern,
C05/C18). A service worker does not call this helper in slice 6. No new public
schema function or schema USAGE grant. Tests must check actual has_function_privilege
and invocation denial, including PUBLIC inheritance and recreated default ACLs.

**Lock order:** preserve M69 replay reservation first, then active session
FOR UPDATE, candidate FOR UPDATE, chosen edition state FOR UPDATE. Helper runs
only after these outer locks, acquires the same scoped state lock if necessary,
then (for provider identity resolution) its admitted registry row FOR SHARE,
work key/row, edition key/rows, then
returns; outer Add inserts inventory and invokes existing triggers. Shared work
rows that will become FK targets use FOR KEY SHARE; edition rows use FOR SHARE
to prevent work_id changing/being SET NULL before the inventory INSERT. If two edition
rows match alternate identifiers, read them in UUID order before refusing.
Do not lock another store, session, candidate, lookup job or attempt. Lineage
reads are scoped SELECTs, not reverse-order worker locks. Never acquire a
candidate/session lock after taking a shared catalogue lock.

Initial ISBN/canonical-ID probes are unlocked SELECTs used only to discover a
prospective target. Before returning a reused target, lock its work first, then
the matching edition rows in UUID order, and recheck work_id, identifiers and
identity. For a disappeared edition/work, release the saved-reference attempt's
locks via its subtransaction, discard both hinted IDs, then fall through once to
provider identity resolution if §6 permits; otherwise return NULL/NULL. Do not
chase a new work after locking its edition. Thus the probe order does not invert work-before-edition
locks. New inserts follow the same order. A NULL-work incumbent is OQ3, not
permission to create a work while holding an edition lock.

The new call is after eligibility/scoped selection resolution and before any
canonical field hydration, still before M69 L188 (§3.1). It fills only
v_canonical_work/v_canonical_edition. Move existing ID
resolution into this one helper so a skip cannot accidentally retain a stale ID
from M69's earlier branch. Keep all existing inventory bibliographic assignments,
v_metadata_version, review/selling fields, INSERT column list and response bytes,
with only the missing-target metadata fallback specified in §3.1.
OQ3 (decided) settles the existing-ID exception: keep a trusted saved ID only while its rows still exist.

**Hydration source rule.** Link IDs and field copy are decoupled. (a) The
inventory row's canonical_work_id/canonical_edition_id come **only** from the
helper's returned pair. (b) In selected mode the bibliographic fields (M69
L162–183) come from the canonical_editions row iff the snapshot's own
canonical_edition_id is non-null and that row still exists, under the helper's
locks, as today; otherwise from coherent_edition's L173–182 mapping, **even when
the helper linked an incumbent found by ISBN**, so a sparse incumbent (NULL
publisher, date or cover) never overwrites the chosen snapshot's values with
NULL. (c) A surviving snapshot edition whose work_id is NULL still supplies the
fields (it exists and is the chosen one) while both link IDs stay NULL; never
write a work-only or edition-only link. (d) If coherent_edition is NULL (local
match), nullable metadata stays NULL and the saved reviewed title, authors,
language and selling values apply. (e) edition_option keeps its chosen JSON
fields unchanged.

The unchanged inventory INSERT column list (C03, M69 L188–195) is:

    id, store_id, canonical_work_id, canonical_edition_id, title, authors,
    isbn_10, isbn_13, publisher, published_date, cover_url, language, description,
    edition_statement, volume, format, condition, has_damage, damage_notes,
    damage_types, is_sellable, quantity_total, quantity_available,
    quantity_reserved, quantity_sold, quantity_removed, selling_price_minor,
    shelf_location, internal_notes, public_notes, visibility_status,
    publication_status, extraction_session_id, entry_method,
    created_from_candidate_id, created_by, metadata_snapshot_version

In particular, slice 6 adds no inventory categories/page-count column or copied
catalogue stamp. The inventory's existing private metadata_snapshot_version
continues to identify its chosen review; the shared version field is distinct.

No commit, autonomous transaction, HTTP or job enqueue occurs inside the helper.
If the later inventory INSERT/trigger fails, new work/edition rows roll back with
the outer Add. A catalogue skip still reaches the ordinary private Add receipt.

## 5. Identity and normalization

### 5.1 ISBN admission

Use the existing M32 checksum/conversion helper inside the catalogue helper;
do not change its global behavior or the worker/app normalizers in this slice.
Add a **catalogue-local 978/979 prefix guard**, matching the app ISBN box and
M78's Owner-ISBN constraint (C11; M78 L180–183). Worker/shared SQL checksum
helpers currently accept other checksum-valid EAN-13 prefixes; this is a verified
parity difference, not evidence that such values are ISBNs.

- Compact whitespace and hyphens; uppercase a terminal ISBN-10 X. Reject other
  characters, wrong lengths and a supplied malformed value; do not salvage one
  supplied bad identifier by ignoring it and trusting the other (shared
  validateIsbnPair already refuses malformed/disagreeing pairs, C11 L76).
- ISBN-13: exactly 13 ASCII digits, starts 978 or 979; weights 1,3 alternating
  over the first twelve digits. Last digit equals (10 − sum mod 10) mod 10.
- ISBN-10: nine digits plus digit/X; weighted sum using weights 10..1 is
  divisible by 11. Convert by prefixing 978 to the first nine digits, then
  computing the ISBN-13 check digit. Keep the compact validated ISBN-10 too.
- If both are supplied, the converted ISBN-10 must equal compact ISBN-13.
  Otherwise return NULL/NULL without work or edition effects (AC6-5, Q20).
- ISBN-10 only creates/searches by its converted ISBN-13, as well as isbn_10.
  ISBN-13 only does not invent ISBN-10; in particular no 979-to-10 conversion.
- Neither ISBN means no creation/link by provider ID in slice 6. A separately
  saved valid canonical reference is governed by OQ3, not by JSON ID guessing.

Examples for fixtures: 0306406152 → 9780306406157;
054792822X → 9780547928227; 080442957X → 9780804429573;
9791090636071 is a valid 979 fixture; 9780306406158 is checksum-invalid;
4006381333931 is checksum-valid EAN-13 but outside 978/979.

PSR-D37's small placeholder/reused-ISBN blocklist has no approved contents in
these sources. The Owner moved it to slice 7 (OQ2, 2026-10-25; SDD-2 AC7-3).
Slice 6 enforces only the checksum, the 978/979 prefix and ISBN-10/13
disagreement rules; checksum-valid placeholder or reused ISBNs are an accepted
residual risk until slice 7. No invented list, hidden column or
normalizer-version column is added to M81.

### 5.2 One work-key rule (OQ1, decided)

F46 requires trimmed/lower-cased/sorted author keys. No production writer of
title_normalized exists today; only synthetic fixtures set it (C10/C13).
Use one helper-local rule for both new keys and identity comparisons (OQ1,
decided) rather than silently choosing among text normalizers:

    text_key(t) = btrim(marketplace_sec.phase9_metadata_normalized_text(t))
    title_normalized = text_key(provider_snapshot.title)
    primary_authors = ARRAY(normalize each provider author with text_key,
                            ORDER BY normalized value COLLATE "C")

M32 supplies NFKC, whitespace-run collapse and lower-case; final btrim removes
edge spaces left when tabs were collapsed after its original btrim. Retain
punctuation, accents and leading articles; do not use the looser search-key
function, M77 English title matcher, aliases or fuzzy matching. Retain duplicate
normalized author entries (OQ1, decided); deduplication is not specified
by F46. Require nonempty resulting title and every author.
Work primary_title remains the provider's validated display title, while
primary_authors is the normalized key array. Edition authors retain display
case/order. Language does not enter the existing unique work key.

Worker normalizeBibliographicText uses NFKC/trim/whitespace/lowercase but preserves
author order in query identity (C11). This design does **not** change query/cache
identities to sorted authors. SQL is the authoritative catalogue key algorithm;
Unicode/collation parity fixtures cover tabs, multiple spaces, full-width Latin,
accents and original scripts. No assertion of universal SQL/JS locale parity.

For synthetic input “Example Title” / “B. Author”, the key is
('example title', ARRAY['b. author']). The live catalogue holds one pre-existing work row (§9.1) whose stored key was
not read: an ISBN hit on its edition links only after normalized title, authors
and work agree, otherwise the Add succeeds unlinked. A normal ISBN hit still
precedes work creation and never causes a key rewrite.

**Comparing existing rows.** Existing works may hold display-cased keys: the
repository fixtures store `primary_authors` such as ARRAY['Canonical Author']
([unit7aFixture.mjs L113–117](../../../../../../supabase/tests/phase9/unit7aFixture.mjs#L113),
[editionPickerFixture.mjs L140–141](../../../../../../supabase/tests/phase9/editionPickerFixture.mjs#L140)),
and the live Hobbit work's key was not read. Steps 1 and 3 of §7.2 therefore
compare an **existing** work with the proposed identity only after applying text_key
and the COLLATE "C" author sort to its stored title_normalized (primary_title as
fallback) and primary_authors; they never compare the raw stored array with the
normalized key. New works always store the normalized key (step 4 compares raw
only because it targets the unique key). A work matched through normalization is
an incumbent: reused without updating, its stored key never rewritten. When no
edition is found by ISBN, step 4 may create a work whose normalized key differs
from a legacy display-cased row; that is accepted, with no merge (DOC-3 §17).

## 6. Provider admission

The following is for **creation or new ISBN-based reuse**, not an unapproved
reinterpretation of existing canonical-ID links (OQ3). Failure of any check
returns NULL/NULL and leaves Add's provider/manual inventory facts unchanged.
An expired alternatives list is not itself a failure: the durable chosen JSON
survives expiry. Do not revalidate option TTL by discarding a saved selection.

| Column/evidence | Required comparison |
|---|---|
| chosen JSON adapterKey; attempt.adapter_key | Both equal open_library. Never infer a provider from URL, ISBN or Google storage permission. Missing lineage cannot authorize creation. |
| attempt/lookup scope | JSON attemptId = attempt.id, JSON correlationId = lookup.id, attempt.lookup_id = lookup.id; candidate_id/store_id on both match the scoped candidate. lookup.job_id belongs to this candidate/store and lookup.query_identity matches the selected choice's query identity. |
| registry.adapter_key | Equals chosen/attempt adapter key; row must exist. |
| provider_kind | Exactly metadata, not vision/alias. |
| enabled, matching_allowed, storage_allowed, public_display_allowed | Every flag true at Add. No single flag implies the others. |
| adapter_version | Registry = attempt.adapter_version = JSON adapterVersion; do not hard-code 1.0.0 as a future permanent version. |
| policy_version | Registry.policy_version::text = selected lookup.reuse_policy_version. It is **not** JSON normalizerVersion, snapshot.selection_policy_version or the host-policy label. |
| normalizer/schema/shape | Require marketplace_sec.phase9_edition_valid_normalized_metadata on the full provider payload named in §3 (never the reduced current_suggestion projection), defined in [M68 L15](../../../../../../supabase/migrations/20261007000068_marketplace_phase9_edition_picker_worker_completion.sql#L15), which calls M73's full provider validator and requires contractVersion=p9-contract-v1/schemaVersion=p9-metadata-v1. JSON normalizerVersion must equal attempt.normalizer_version and lookup.normalizer_version, currently p9-bibliographic-normalizer-v1 (C08 L129); no missing/mismatched version is silently defaulted. Do not use the app's reduced snapshot. |
| revalidation_seconds/raw_retention_seconds | Existing lookup/selection admission already applies policy/retention. Require retained lineage and existing source-policy version checks, but do not interpret temporary option deadlines as expiry of permanent canonical rows (Q17/Q18). No raw response or source row is stored in slice 6. |
| image_cache_allowed | Not a gate for storing the permitted own-edition cover URL; no image bytes are downloaded/persisted. |
| attribution_required | Does not imply storage/display permission. Preserve its policy meaning and carry attribution/source-note implementation to slice 7 under Q18's stated Open Library deferral; never record store-private licensing notes. |

Query identity: the selected lookup's query_identity is compared with the chosen
state's query_identity in edition_option mode; in selected mode, where no
phase9_candidate_edition_state row need exist, the implementation must confirm
against M73/M78 which identity the automatic lookup carried
(phase9_metadata_candidate_query_identity of the candidate) and compare that. A
mismatch skips creation; it never fails Add.

Snapshot values are observations, not constants: live snapshot 2026-10-25 L18
reports Open Library metadata / enabled=true / matching=true / storage=true /
public_display=true / adapter_version=1.0.0 / policy_version=1, revalidation 86400,
raw retention 0, image caching false, attribution true. Google L17 has storage
true but public display false and fails the explicit provider allow-list
independently. A version or policy mismatch skips shared writes and links; it
does not rewrite snapshot versions, retry the lookup or make Add fail.

Cover must be NULL or the same edition's validated
https://covers.openlibrary.org/b/id/<positive-integer>-M.jpg. Generic M73 shape
allows Google URLs too; the catalogue admission must enforce the Open Library
own-cover shape. Never use representative_cover, a Google cover, another option,
the work's cover or an Owner URL. Malformed/misbound source facts skip the entire
catalogue step rather than stitch a replacement into a partial shared record.

There is no registry hidden flag now (C10/C22). Test absent/disabled or
non-admitted registry rows now; hidden canonical editions belong to slice 7.
Do not refer to a nonexistent book_metadata_providers table.

### 6.1 Provider-specific points slice 8 must generalize

Informational hand-off recorded after the 2026-10-25 cross-slice consistency
review (Muse and free GLM, read-only). It changes no slice 6 behavior and edits no
other SDD. Slice 6 is provider-neutral in its data (ISBN-13 identity, no provider
column, no provider-ID list) but keeps these Open Library specifics, which slice 8
(SDD-2 L412-421, L459-463) must name and replace or keep deliberately:

| Point in slice 6 | What slice 8 must do |
|---|---|
| **Allow-list**: the `open_library` literal in the §6 adapterKey row, inside the helper that M81 creates. | Replace it with the reviewed `shared_catalogue_allowed` registry capability (D35, Q18; default false; false for Google; not a licence grant) only in slice 8, after parity and negative tests. Slice 8's forward-SQL inventory must name the helper and the M81 `phase9_add_candidate_to_inventory_v1` body, which SDD-2 does not name today. Shared creation exists only in that helper, so a second provider cannot pass AC8-9 until it is replaced. |
| **Adapter key**: JSON adapterKey, attempt.adapter_key and registry.adapter_key must all equal the literal. | After replacement, require the three to equal each other and the registry row, plus the capability. Never infer a provider from URL or ISBN. |
| **Cover shape**: NULL or the same edition's `covers.openlibrary.org/b/id/<n>-M.jpg`; a hard-coded Open Library rule above the generic M73 shape check. | Decide per provider under the reviewed validation contract; name this rule in slice 8's audit list. A provider with no admitted cover rule stores NULL cover; it never skips or fails Add. |
| **Registry checks**: flags and versions are read by column name, never constants (§6 table). | Keep reads by name; the capability column is additive. Storage or display permission alone never authorizes shared creation. adapter_version and policy_version stay per-registry values. |
| **Validators the helper calls**: `phase9_edition_valid_normalized_metadata` (M68) and M73's provider validator, plus the selected-lookup query-identity comparison (§6, to confirm at implementation). | If slice 8 replaces them, the helper's calls must stay valid for the existing provider. Add them to the replacement inventory. |
| **Lineage after cleanup**: the helper binds by retained JSON correlationId/attemptId and the preserved selected snapshot (§3, AC6-18). | Add a compatibility row that this binding and the preserved selection snapshot are unchanged by slice 8's replacements for old and new workers. |
| **Migration ownership**: SDD-2 assigns the allow-list replacement to neither 8a nor 8b. | 8a's migration owns it (registry and SQL generalization); 8b adds no admission path of its own. Slice 8 tests rerun the slice 6 helper ACs under the capability and add a synthetic provider with storage_allowed=true and capability=false that writes nothing. |
| **Test fixture**: the §7.1 baseline alignment. | Slice 8 and 9 fixtures inherit it and do not re-add canonical write grants. |

## 7. Writes, conflicts, concurrency and replay

### 7.1 Field mapping

Only a **new**, admitted, coherent record is populated. Existing work and edition
rows are never updated, even to add a missing cover, ISBN, language or timestamp
(Q20 first-row rule; explicit no-update policy, OQ4 decided).

| Target | New-row source |
|---|---|
| canonical_works.id | UUID supplied explicitly by the helper (gen_random_uuid()), as M69 L196 does for store_inventory; the helper must not rely on a column default (see test-schema fidelity below). |
| title_normalized, primary_authors | Provider-only key rule in §5.2 (OQ1, decided). |
| primary_title, language | Chosen provider JSON title/language, never review.originalTitle/originalLanguage. |
| canonical_editions.id, work_id | UUID supplied explicitly by the helper; resolved canonical work ID. Always coherent with returned work ID. |
| isbn_13, isbn_10 | Validated compact/conversion results in §5.1; absent ISBN-10 stays NULL. |
| title, subtitle, authors | Same provider JSON title/subtitle/authors; display form kept for editions. |
| publisher, published_date, language | JSON publisher/publishedDate/language. Keep bounded provider date text; no invented parse/year. Keep valid und rather than an Owner hint. |
| description, edition_statement, volume, format, page_count, categories | JSON description/editionStatement/volume/format/pageCount/categories. Nullable values stay NULL, categories remain the provider array (currently [] from the OL normalizer). No Gemini/store category. |
| cover_url | Same admitted own-edition coverReference or NULL. No cover download. |
| metadata_verified_at | **OQ4 (decided):** validated JSON fetchedAt, a provider-freshness timestamp, not an Owner verification/popularity score. Never transaction time disguised as provider freshness. |
| metadata_selection_version | **OQ4 (decided):** constant psr-catalogue-isbn-v1, identifying this deterministic selection policy. Never a candidate/lookup/selection/store UUID or M69's edition-selection-v1:<selection-id> inventory token. |
| created_at, updated_at | Not written by the helper: live and P3 columns default to now(); no UPDATE trigger exists on canonical tables in the snapshot. phase6_baseline.sql has no such columns, so the helper must not name them. |

**Test-schema fidelity.** Both the in-memory harness (databaseHarness.mjs L53) and
the native runner (run-phase9-bookstore-first-postgres.ps1 L209) load
[phase6_baseline.sql](../../../../../../supabase/tests/phase9/phase6_baseline.sql),
not Phase 3. For canonical_works, canonical_editions and the store_inventory
canonical foreign keys it differs from the live schema (P3 L5–34, L147–157):
no UUID defaults (L47, L55); no created_at/updated_at; work_id and the inventory
canonical FKs default to NO ACTION instead of ON DELETE SET NULL; the ISBN unique
constraints are unnamed (generated *_key names, not canonical_editions_isbn_10_unique
or canonical_editions_isbn_13_unique); and RLS, the SELECT policies and the
anon/authenticated grants are absent. The new catalogueLinkFixture.mjs must,
after loading the baseline and before applying M81, align those objects with
P3 and the live snapshot (SET NULL actions, the named constraints, timestamps,
RLS with SELECT policies, and the broad default grants so AC6-24's denial is
meaningful), and say so. The full existing Phase 9 database suite must stay
green with the alignment in place; if it does not, narrow the alignment to the
catalogue-link suites. Tests that depend on SET NULL (AC6-21 to AC6-23),
constraint names (AC6-12) or grants (AC6-24) are invalid without it.

Never store review JSON, title/author corrections, price, condition/damage,
shelf/notes, labels, store/user/candidate/inventory/lookup/attempt IDs, request
IDs, source-photo data, confidence/popularity, representative cover or raw
provider payload in shared rows. providerRecordId and work references are not
shoehorned into columns; slice 7 owns provider-ID/source transport and provenance.
series/script have no canonical target here. R04/D40 apply even to text that
looks bibliographic but originated from an Owner edit.

### 7.2 Find/create and atomic conflict handling

The following algorithm is within a PL/pgSQL BEGIN/EXCEPTION subtransaction.
Returning normally after writing a work and discovering a conflict would leave
an orphan work: **raise the internal conflict signal before catching it**.

1. Resolve saved canonical reference if present under the OQ3 answer. Validate
   that edition exists, its work/ISBN/title identity is coherent and the reference
   came from the scoped server snapshot. Link only; never create/update from an
   ID alone, and never trust a client-supplied UUID. If edition/work disappeared
   or the hint is NULL, discard it and continue to step 2 only for admitted OL;
   otherwise return NULL/NULL and let Add succeed (§3.1). Hold the work KEY SHARE
   and edition SHARE locks until outer commit, so deletion after this check
   cannot invalidate store_inventory's FKs. A concurrent delete that finishes
   first produces the same absent-target fallback after the lock recheck.
2. Otherwise validate source/registry/ISBN and normalized work identity. Look up
   edition by compact isbn_13 and, when supplied, compact isbn_10 using separate
   indexed equality probes. Read both; never LIMIT 1 over an OR and arbitrarily
   choose. No result is distinct from two different matching rows.
3. Existing consistent edition: compare normalized edition title/authors and
   its associated work against the proposed identity; compare an
   identifier only when it is populated on both the incumbent and the proposed
   side (an incumbent isbn_10 of NULL is not a mismatch; any populated incumbent
   isbn_10 must convert to the proposed isbn_13). Missing optional publisher/date/cover is not a conflict and is not
   filled. Return its actual work_id and edition ID; do not insert a new work.
   Two identifier hits with different IDs, a different populated ISBN-13,
   different work/title identity or missing coherent work is a catalogue skip.
   A NULL-work incumbent gets no link (OQ3, decided); no automatic repair/update is introduced.
4. No edition hit: INSERT work with ON CONFLICT DO NOTHING (no update); re-SELECT
   by both title_normalized and the full normalized primary_authors array. Verify
   identity and lock the returned work FOR KEY SHARE. Use the C collation only
   for author ordering, not a new unique index or schema collation migration.
5. INSERT edition with ON CONFLICT DO NOTHING **without a conflict target**, so
   either existing ISBN unique constraint is respected. Never handle only isbn_13
   while leaving an isbn_10 violation able to abort Add. Re-SELECT both ISBN
   keys in a separate statement, verify one coherent edition/work, then return
   the incumbent IDs. The re-SELECT locks the matching edition row(s) FOR SHARE in
   UUID order (§4) and raises P9C01 (rolling back this attempt's work insert) on
   zero rows, more than one row, a NULL work or an identity mismatch; it never
   returns NULL/NULL normally after step 4 wrote a work. A just-lost uniqueness race with consistent facts links
   the winner. Never return an unpersisted proposed UUID.
6. Any real identity conflict raises internal SQLSTATE P9C01; the exception
   handler rolls back **all** this helper attempt's shared writes and returns
   NULL/NULL. Catch unique_violation defensively too: GET STACKED DIAGNOSTICS
   CONSTRAINT_NAME; for the three known identity constraints, leave the failed
   subtransaction first, re-select under a fresh READ COMMITTED statement and
   resolve a consistent incumbent or return NULL/NULL. No second work/edition
   insert in the exception handler; no partial writes/links. Unrecognized unique
   constraints and unrelated programming/infrastructure errors are not silently
   relabelled as identity conflicts (OQ7).

Constraint names: canonical_editions_isbn_13_unique,
canonical_editions_isbn_10_unique (explicit P3 L32–33), and expected generated
canonical_works_title_normalized_primary_authors_key (P3 L13). The last name is
derived from local DDL, not included in the supplied live constraint-name
readback; verify it before application. Targetless ON CONFLICT handles all
three independently of naming, while the defensive exception branch must use
verified names. Random UUID primary-key collisions are not identity conflicts.

The helper never updates a conflicting row, reassigns its work, hides an edition
option or retries a provider call. A work-key race alone is not an edition
conflict. Two different ISBN-13s with identical normalized title/author key
create **one work and two editions**, with both inventory rows linked to that
work. Same ISBN-13 with consistent identity creates one edition for both stores.
Different titles/authors for one ISBN keep the first edition; the losing Add
is private and unmatched with no losing work left behind (Q20).

Native proof must hold the first transaction open, demonstrate the contender
actually waits at the shared unique key, then release it and assert convergence.
Test both commit and rollback of the first writer, crossed ISBN-10/13 conflicts,
different ISBNs sharing a work and reversed title/author key conflicts. Ordinary
READ COMMITTED, one-book helper calls and work-before-edition ordering suffice;
no advisory global lock, table lock, retry loop, catalogue UPDATE or network.

### 7.3 Replay and surviving effects

M69 checks U7AC01 replay at L124–126 **before** eligibility/locks/helper. Keep
that ordering, fingerprint, finish_replay and response fields unchanged. Same
key/fingerprint returns the original inventory ID without another catalogue
call, timestamp change, shared row, audit/event, count or inventory effect.
This includes replay after provider disablement, a change in catalogue facts,
saved-target deletion or SET NULL. The original inventory ID is returned and
the catalogue step is not re-evaluated; later FK SET NULL is not repaired by replay.
A prior unmatched Add stays unmatched on replay. Different key for an already
committed card must still be refused by the existing state/version fences.

On a new Add catalogue skip, preserve the chosen snapshot, private ISBN/cover
and bibliographic fields, selling fields, draft/private statuses and successful
receipt. Only canonical IDs are NULL. On outer Add failure everything rolls
back, including helper inserts and replay reservation. Expired options cleanup
and late completion must not mutate the chosen snapshot or committed inventory.

## 8. Triggers, readers and immediate user effects

| Existing path | Effect of new IDs / cover |
|---|---|
| representative-cover BEFORE INSERT/UPDATE (C14) | Reads same-store candidate, selected immutable snapshot and representative-cover relation; no canonical-ID/cover read. Retains immutability guard. The alternate Google representative cover stays private and never enters canonical cover_url. |
| quality handoff BEFORE INSERT (C15 M41 L31) | Uses inventory title/language/price/condition/sellability/damage and eligible damage photos, not canonical IDs. A link does not certify quality or make price valid. |
| quality projection refresh BEFORE UPDATE (C15 M41 L47) | Reacts to listing_quality_status downgrade, not canonical links. No new UPDATE is done in slice 6. |
| listing sync AFTER INSERT/selected UPDATE columns (C15) | Copies canonical IDs, inventory title/authors and inventory cover. For Add's draft/private row, exits through the private gate and creates no public listing. It does not read canonical facts/cover as a fallback. Canonical-ID-only UPDATE is not in its UPDATE OF list; this is another reason no backfill/relink is included. |
| catalogue suggestion (C09/C16) | Existing local match can now find rows created at Add; M65's canonical snapshot exposes title, authors, ISBNs, publisher/date, language, pages/categories and canonical cover_url. No separate cache entry or new app contract is required. Automatic routing remains its existing configuration. |
| public marketplace/grouping (C16/C17) | Listing group identity prefers canonical edition ID, then valid ISBN. After separately authorized publication, future linked offers can group by canonical ID. Existing 32 unlinked rows remain; mixed old/new groups may temporarily split. Do not alter grouping or backfill to conceal this. |
| storefront catalogue/detail (C16 M50) | Reads gated listing/inventory provider cover/public media, not canonical tables for a cover fallback. A later published linked inventory row carries its existing own provider cover and copied IDs. No public stock/location/private facts become visible just because a canonical row exists. |
| app (C12/C17) | Add result contract contains inventory ID/outcome, not new canonical IDs. Existing catalogue/current-suggestion reads and public discovery accept nullable IDs. No new UI, cache version or parser key is introduced. |

**Immediate public effect:** canonical tables already allow anon/authenticated
SELECT with USING true. A new canonical row and its provider bibliographic facts,
cover URL and metadata columns are directly readable immediately, even though
the inventory row is private. No link to the store/user/copy is stored there.
The public-display registry gate is therefore required at write time; it cannot
be postponed until publication. D35/Q18 authorize this for admitted Open Library
facts. The surviving existing-ID exception is the decided OQ3 default. No new public display permission or privacy policy is
chosen by this document.

The dictionary's “Public: no” for metadata_verified_at/metadata_selection_version
(C20) conflicts with public table SELECT, which exposes those columns; no column
secrecy is established by the supplied snapshot. The decided OQ4 constant/timestamp must
contain no store provenance. Correct that documentation at implementation time;
do not add column grants or change public canonical access without authority.

## 9. Existing catalogue rows, reset note and privilege finding

### 9.1 Existing catalogue rows and reset note

**Owner decision (2026-10-25): no catalogue reset in slice 6.** An earlier
revision proposed a shared-catalogue reset; the Owner dropped it because the
design handles the existing rows. Nothing was run. A reset stays possible later
but needs its own design, table list and Owner approval; it is not a
precondition of M81, and no approval to execute one exists.

**Facts** (live snapshot 2026-10-25, C22–C23; the repository does not prove
their origin): `canonical_works` holds 1 row and `canonical_editions` holds 1 row
(The Hobbit, ISBN-13 9780547928227, created 2026-06-29, before Open Library was
enabled; provenance unknown, never described as Open Library- or Google-sourced).
No inventory row links to either. The edition is referenced by three Phase 9
rows through NO ACTION foreign keys (candidate 15ed7f7f-7aaa-4fe5-9ad0-54d4043afdca,
one phase9_metadata_lookups row and one immutable
phase9_selected_metadata_snapshots row), so it cannot be deleted without
touching Phase 9 session data. That is why a reset was not pursued.

**Behaviour in slice 6:** the row is an incumbent. An Open Library Add whose
ISBN-13 matches it links to it without updating it, only when normalized title,
authors and work agree (§6, §7.2, OQ3, OQ4); otherwise the Add succeeds
unlinked (Q20). Nothing else in slice 6 depends on whether the row exists. The
saved-ID tolerance (§3.1) covers any later deletion of a referenced row.

### 9.2 Privilege finding

**Grants:** live snapshot 2026-10-25 L22–24 reports anon/authenticated have
INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER as well as SELECT on both
canonical tables. Local P3 enables RLS with only SELECT policies (C10), and no
later local migration explicitly revokes canonical-table write grants. The
repository does not prove which live ALTER DEFAULT PRIVILEGES or installation
step originated the grants. They may originate in platform defaults, but are
**real effective privileges**, not an ignorable information-schema artifact.
RLS blocks ordinary row DML without policies; TRUNCATE is not covered by RLS.
Do not execute destructive privilege probes against the live project.

The helper's postgres ownership bypasses canonical RLS intentionally and also
could bypass private RLS; therefore private-table reads must always include the
resolved candidate/store/session, and only Add may invoke it. No helper SELECT
returns another store's inventory or source lineage. Shared reads see only
bibliographic canonical rows, never ownership lists. Cross-store convergence is
permitted; cross-store private reads/writes are not (MAS-03, R04). Revoking the
helper ACL does not fix table TRUNCATE.

**Decision (OQ6, Owner 2026-10-25): M81 revokes the canonical-table write
privileges**, after the writer audit below. SDD-2 AC7-8 names the provider-ID
table and helper only; its wording must be extended to the canonical tables when
SDD-2 is next edited (§13). Tracker 38 §34's broader hardening intent is met here.

**Writer audit (Owner condition; read-only; 2026-10-25).**

- Repository: searched supabase/migrations, supabase/functions, src, app,
  workers, scripts and e2e for INSERT INTO, UPDATE, DELETE FROM and TRUNCATE on
  canonical_works/canonical_editions (case-insensitive; migrations also searched
  across line breaks) and for client table calls `.from('canonical_…')`. Result:
  **no writer** in any migration, Edge function, worker, script or app code; the
  two table names do not appear at all in src, app, supabase/functions, workers,
  scripts or e2e outside tests. Only test fixtures write them: editionPickerCommitFixture.mjs,
  editionPickerFixture.mjs, unit7aFixture.mjs and the phase9BookstoreFirstDiscovery,
  phase9EditionPickerFences, phase9EditionPickerLocalMatch, phase9MetadataFoundation,
  phase9OwnerUxMutations, phase9OwnerUxReadModels, phase9StructuralMetadataWorker and
  phase9Unit6gFoundation integration tests (all under supabase/tests/phase9/).
- Live (read-only SELECTs, project ahntbtktjjmvfosgkmgn): a search of every
  function body in pg_proc for those write statements returned **no function**;
  the two tables have no non-internal triggers and no write RLS policy (SELECT
  only). Two pg_default_acl rows exist for public tables, consistent with the
  grants being platform defaults; not changed here.
- Conclusion: no legitimate writer uses anon, authenticated or any other
  client role, so the revocation cannot break a shipped path. **The Owner's
  stop-and-ask condition was not triggered.** Writers outside the repository and
  the live function bodies (SQL editor, dashboard, ad hoc scripts, MCP) are not
  visible to this audit; they would run as postgres or service roles. If one is
  found, stop and ask the Owner.
- Unverified: whether the test fixtures above run their canonical writes as a
  table-owner or superuser role. AC6-24 requires the full Phase 9 database suite
  to pass with the revocation applied.

**Revocation contract (M81 step 4):** REVOKE INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES and TRIGGER on canonical_works and canonical_editions FROM anon and
authenticated. SELECT and both SELECT policies stay. postgres and service_role
grants stay unchanged (no current writer; slice 7's rule against direct
service-role table writes governs later). No ALTER DEFAULT PRIVILEGES, no
policy change. Readback: has_table_privilege for each role and privilege.

## 10. Acceptance checks and red-first tests

**Files below marked NEW do not exist and are not created in this session.**
Use the existing stack rather than a mock writer. Proposed fixture module NEW
supabase/tests/phase9/catalogueLinkFixture.mjs builds createCommitDatabase
(C13), applies the same M70–M80 suffix/order as C18, then optionally M81.
Extract/reuse the OL operation/result/physical-receipt pattern in C19; the existing
PGlite olCall helper is local to its suite, so it is not an importable export.
Use actual request/register/complete/select/save/Add commands for positive paths.

Fixture labels: **OL** = coherent selected OL100M with complete bound lookup/
attempt and own cover; **G** = unchanged Google chosenCard; **MAN** = reviewed
manual seed; **CAN** = separately saved current canonical snapshot; **A/B** =
different Owners/stores/sessions. Supply synthetic ISBN/title/author facts, never
provider HTTP. For malformed metadata not selectable through completion, insert
the minimal bounded legacy selected-state fixture as postgres, documenting the
bypass, then call the real Owner Add; invalid shape that fails the existing gate
is an Add-refusal test, not a catalogue-skip test. Keep JSON bytes before/after.

Test destinations: **DB** = NEW
supabase/tests/phase9/phase9CatalogueLink.integration.test.mjs;
**PG** = NEW supabase/tests/phase9/phase9CatalogueLinkConcurrency.postgres.mjs;
**GUARD** = NEW
supabase/migrations/__tests__/marketplacePhase9CatalogueLink.test.ts.
Each row states Given / When / Then and the expected baseline red reason. Where
the current behavior already satisfies a negative outcome, pair it with positive
helper-contract coverage; do not fabricate a failing baseline claim.

| Check / authority | Given / When / Then; file, fixture; expected RED before M81 |
|---|---|
| AC6-0 / F46 | Given A/B OL books with normalized-equivalent author case/order and distinct valid ISBNs, when both Add, then one work, two editions, matching work links. DB/PG; OL reordered authors. RED: picker Adds create no shared work/link. OQ1 fixes exact key bytes. |
| AC6-1 / D34/D35 | Given OL with valid ISBN, when eligible Add, then work/edition and both inventory links exist; every §7.1 field equals the coherent provider fixture and no private marker is present. DB; OL plus sentinel notes/price. RED: NULL links/no canonical insertion. |
| AC6-2 / D35 | Given A added OL and B has a consistent same-ISBN choice, when B Add, then same edition/work and unchanged incumbent bytes, one edition total. DB; OL A/B, optional facts different. RED: no new resolved catalogue links. |
| AC6-3 / Q20 | Given independent A/B OL choices of same ISBN/work, when held transactions race then commit, then one work/edition and two inventory links; rollback winner variant lets contender insert. PG; OL A/B. RED: helper absent/current NULL IDs, no shared-key waiting. |
| AC6-4 / R05/R10 | Given G or MAN, when Add, then no shared write and Add remains successful/unmatched even with Google storage=true (also test display=true to prove allow-list). DB; G/MAN. Baseline no-write already green; GUARD/helper admission contract RED absent. Existing canonical-ID exception is OQ3. |
| AC6-5 / D37/Q20 | Given checksum-valid 10/13 identifying different editions, when Add accepts a legacy chosen state, then no link/partial work and Add succeeds. DB; OL malformed pair. Existing picker may reject such a choice earlier; distinguish that case. Helper identity test RED: function absent; unmatched outcome alone already green. |
| AC6-6 / D40 | Given CAN/OL and an Owner identity title edit, when normal review save switches it to manual then Add, then edited private title, no canonical write/link, incumbent bytes unchanged. DB; CAN plus edit. Existing safety is a regression, not a new failing behavior; helper exclusion contract initially absent. |
| AC6-7 / R01 | Given successful linked or unmatched Add, when replay same key/command, then identical inventory ID/receipt and no shared/inventory/audit/event/count/timestamp change. DB/PG; OL/G/MAN, retained command SQL. Linked fixture is RED until AC6-1 works; unmatched replay already green. Different-key committed-card refusal remains green. |
| AC6-8 / D35/D37 | Given ISBN-10 only (including X), when OL Add, then converted ISBN-13 and compact ISBN-10 stored and linked; no invented ISBN-10 for a 979-only input. DB; §5.1 vectors. RED: no shared insertion/link. |
| AC6-9 / R09 | Given invalid checksum or checksum-valid non-978/979 EAN, when catalogue admission runs, then NULL IDs/no shared writes and accepted private Add survives. DB; legacy bounded chosen JSON, §5.1 vectors. Helper function/prefix assertions RED absent; no-link outcome alone already green. |
| AC6-10 / D35/Q18 | Given chosen OL then remove/disable registry row or change kind/matching/storage/display independently, when Add, then no shared write/link; original private Add still works. DB; OL chosen before policy change. Missing-row test must respect registry FKs: helper fixture may use unresolvable adapter/lineage rather than delete referenced live-like rows. Baseline no-link green; admission helper assertions RED absent. |
| AC6-11 / R06/R09 | Given selected OL and registry adapter_version or policy_version changes, or chosen attempt binding is wrong/missing, when Add, then shared step skips without retry/version rewrite/private fact loss. DB; OL plus registry/lineage variants and a fallback lookup whose primary was Google. Helper RED absent; positive bound-fallback link RED. |
| AC6-12 / Q20 | Given incumbent ISBN points to different normalized work/title, two ISBN probes point to different editions, or ISBN-10 incumbent has another ISBN-13, when Add/race, then first rows unchanged, loser has NULL IDs, Add succeeds and no extra work remains. DB/PG; conflicting OL A/B; force unique-violation fallback as privileged test setup for each named constraint. RED helper absent; no orphan/skip alone must not be misreported as failing pre-M81. |
| AC6-13 / Q20 | Given two distinct valid ISBN-13s with one work key, when concurrent Add, then one work/two editions/two successful linked inventory rows, no deadlock or mistaken conflict. PG; OL A/B. RED: no catalogue links/work. |
| AC6-14 / D35; Owner revision 1 | Given a scoped saved canonical ID, when Add, then link only a still-existing coherent edition/work, without modifying it; a misbound ID cannot select another row, and an absent ID follows §3.1 rather than failing. DB; CAN and current_suggestion. Existing surviving canonical path already green; helper resolution/selected-choice scope RED absent. Surviving-ID admission is OQ3; disappeared-ID behavior is decided, covered below. |
| AC6-15 / R04 | Given anon/authenticated/service_role, when attempting direct helper execution then denied; postgres-owned Add can call it. DB/GUARD; hostile default function ACL reproduced as C18 does. RED: helper does not exist (assert existence first, so missing is not a false authorization pass). Direct canonical-table privilege denial is AC6-24. |
| AC6-16 / R01/R04 | Given wrong Owner/store/session, removed/expired/committed card, stale review/version or unsatisfied selling data, when Add, then existing refusal and zero shared/inventory effects; later inventory failure rolls back new catalogue rows too. DB; scoped OL plus existing refusal fixtures. Guards already green; catalogue atomicity case RED until positive writer exists. |
| AC6-17 / R05/R09 | Given OL own cover/null cover and categories/language, when Add, then exact provider-only mapping, no Google/representative/Owner cover; an OL-key Google URL is not admitted. DB; OL plus private sentinels, G, null cover. RED new mapping absent; existing exclusions remain regression checks. |
| AC6-18 / R06 | Given selected OL whose alternatives expired/cleaned or a newer lookup replaced source pointers, when Add, then retained chosen lineage resolves and no extra provider call/worker operation is required. DB; OL cleanup/new request. RED: no shared link now; chosen private durability must remain green. |
| AC6-19 / D37 | Blocklist deferred to slice 7 (OQ2, Owner 2026-10-25): no slice-6 acceptance check. Slice 6 asserts only checksum, 978/979 prefix and ISBN-10/13 disagreement rejection (AC6-5 and the §5.1 fixtures); the checksum-valid placeholder/reused ISBN residual risk is recorded in §12. SDD-2 AC7-3 owns the blocklist. |
| AC6-20 / Owner revision 1, R10 | Given a reviewed saved selection carrying a now-absent edition/work ID before Add, when Add, then it succeeds: admitted OL creates/finds a valid pair from retained facts; otherwise NULL links; no stale UUID reaches inventory INSERT. DB; STALE-CAN (selected and current_suggestion), STALE-OL with full bound provider payload, and scoped candidate hint variant. RED: M69 selected-mode gate/explicit L165 refusal or current_suggestion FK failure; OL fallback/helper absent. If an existing negative fixture is already unlinked, assert successful fallback plus absence of the stale target, not a fictitious red. |
| AC6-21 / Owner revision 1, R01/R06 | Given a valid selection saved while targets exist, when deletion completes after selection and before Add, then §3.1 fallback succeeds without changing selection/review/JSON. Include work deletion with ON DELETE SET NULL and edition disappearance; never write a dangling FK. DB/PG; STALE-CAN/OL, serialized deleter/Add connections. RED: no disappearance-safe resolution/OL fallback in M69 (selected path may fail earlier at the gate). Deletion after helper locks must wait until Add commits; deletion winning before locks must be observed as absent. |
| AC6-22 / Owner revision 1, OQ3 | Given an edition with work_id=NULL, or a work hint deleted while the edition remains, when Add, then it succeeds without a dangling work ID. OQ3 (decided) result: both inventory IDs NULL, no work-only/edition-only link and no repair; OL find/create encounters the orphan and skips it. DB/PG; ORPHAN-CAN and OL same ISBN. RED: M69 reuses edition-only IDs, and has no helper work-existence/lock contract. Success alone is already green; the link policy is the decided OQ3 default. Inventory bibliographic fields still hydrate from the surviving edition (§4 hydration rule). |
| AC6-23 / Owner revision 1, R01 | Given one successful stale-target Add (linked OL fallback and non-admitted unmatched variants), when same key/command replays after deletion or recreation of catalogue rows, then the original inventory ID/receipt returns with no new evaluation, rows, audit or counter effects. DB/PG; retain original STALE-CAN/OL command and immutable JSON digest. RED: establishing the first stale-target selected-mode Add/fallback fails before M81; the M69 replay short-circuit itself is a green regression. |
| AC6-24 / R04, OQ6 | Given anon and authenticated, when each attempts INSERT, UPDATE, DELETE or TRUNCATE on canonical_works or canonical_editions, then permission is denied; SELECT still works for both; the private helper still creates rows through Add (owner postgres); and the full existing Phase 9 database suite stays green with the revocation applied. DB/PG; disposable database with Supabase-style role grants reproduced (as C18 does for function ACLs); has_table_privilege readback. RED: the broad grants exist before M81, reproduced by the fixture because phase6_baseline.sql has none (§7.1 test-schema fidelity). |
| AC6-25 / M69 hydration, §4 | Given a selected-mode OL choice whose snapshot has no canonical_edition_id and whose ISBN hits a sparse incumbent (NULL publisher, date and cover), when Add, then the inventory links the incumbent's IDs while publisher, date and cover come from coherent_edition, not NULL. DB/PG; fixture with a sparse incumbent. RED: helper and hydration rule absent. |
| AC6-26 / M69 L26–37, §3.1 | Given a selected-mode card whose canonical target vanished and whose observed_isbn_clue is NULL (or manual_outcome outside the accepted list, or identity incompatible), when Add, then it refuses with P9_STATE_CONFLICT as today; with the clue present and matching it succeeds. DB; STALE-CAN variants. RED: the fallback gate does not exist before M81. |
| AC6-27 / M73 L202, §3 | Given edition_option with source current_suggestion backed by an admitted-provider snapshot row with no surviving canonical ID, when Add, then creation uses that row's coherent_edition (not the reduced selected_option_snapshot); a Google-backed or mismatching snapshot creates nothing and Add succeeds unlinked. DB; fixture needs an admitted-provider automatic lookup. RED: helper absent; reduced-projection path must not be treated as a full payload. |
| AC6-28 / OQ1, §5.2 | Given an incumbent work with display-cased primary_authors (ARRAY['Canonical Author']) and an OL choice on the ISBN of its edition, when Add, then it links the incumbent and its stored key is unchanged; two differently cased author orders of one book still resolve to one work (AC6-0). DB; unit7aFixture-style canonical row. RED: no normalization-at-compare helper. |

**Disappearance fixture honesty:** present NO ACTION FKs prevent deleting a
referenced edition normally; do not claim a live-reachable deletion sequence
where one is blocked. STALE-CAN is an isolated disposable database fixture that
permits the incoming canonical reference at construction only and seeds the
snapshot once, already stale, without disabling its immutability trigger.
Keep **store_inventory's canonical FKs enabled** for every Add assertion. A
fixture with valid FKs uses a chosen non-FK hint for an actual delete, or deletes
the referenced work (edition.work_id becomes NULL). Document precisely which
case is synthetic versus an actual two-connection delete race; restore fixture
isolation between cases. No snapshot-trigger bypass, live session edit or reset
procedure is implied by this test setup. Include a delete winning before the
initial eligibility probe, between that probe and eligibility (recheck absence
and use the §3.1 local-copy path), and between eligibility and helper locking.
Present work/edition locks must demonstrably prevent the final FK race.

**Required green regressions:** phase9Unit7aCreateOnlyCommit.integration.test.mjs,
phase9EditionPickerCommit.integration.test.mjs, and the M78–M80 suite
phase9OwnerIsbnEditionLookup.integration.test.mjs (C18), plus
phase9OpenLibraryEditionOptions.integration.test.mjs and
phase9EditionPickerConfirmation.integration.test.mjs. Existing G fixtures with
NULL links must stay G, not be converted to OL to make tests pass. Keep existing
native picker/Open Library overlap suites. Run architecture guards
src/features/imageInventory/__tests__/privacyArchitecture.test.ts,
unit6fArchitecture.test.ts, ownerInventoryReadArchitecture.test.ts and
supabase/migrations/__tests__/marketplacePhase9Unit6gFoundation.test.ts.
The new GUARD verifies M81 functions/security/no schema change and unchanged
M69/M70/M78–M80 files; do not loosen the M52 guard to admit unrelated changes.

**Red-first order after approval:** fixture/current stack, positive link and
identity/ACL red tests, then M81, then focused SQL negatives/replay, then native
overlaps and existing guards/regressions. No test was run for this design task.
Known historical full-DB failures are recorded in tracker 38 §33 L1561–1563;
do not claim a clean full gate from those historical counts.

**Native runner is required**, as for M78 (C18); PGlite sequential tests do not
prove lock waits. At implementation, extend the existing opt-in native runner
with M79/M80/M81 in order after its current M78 tail and invocation of the NEW PG
file under IncludeOpenLibrary (no new default DB/service target). Reuse
editionPickerPostgresConnections race/owner/service APIs and Open Library
fixtures; retain unrelated M09/M63/M64 exclusions. The current runner has no M81
support: this extension is part of future test work, not already available proof.

Commands **for future authorized implementation, not executed here**:

    node --test supabase/tests/phase9/phase9CatalogueLink.integration.test.mjs
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1 -IncludeEditionPicker -IncludeOpenLibrary -Port 5450
    npm.cmd test -- --runInBand --runTestsByPath supabase/migrations/__tests__/marketplacePhase9CatalogueLink.test.ts supabase/migrations/__tests__/marketplacePhase9Unit6gFoundation.test.ts

Native PostgreSQL needs local initdb/pg_ctl/psql; runner creates a disposable
cluster/database, never the shared project. Prove actual wait (pg_locks/session
wait evidence), counts/IDs/snapshot immutability and teardown, not Promise.all
timing alone. Run broader npm.cmd run test:phase9:db only under implementation
authority; use the existing build prerequisite if its compiled-worker suites run.

## 11. Proposed migration and readback

**Number:** M81, the next free Phase 9 sequence in live snapshot 2026-10-25 L42–43.
Tracker 38 §33 follow-up C's optional “M81” is an unbuilt pending-card correction,
not a reservation. Refer to it henceforth as **optional scanned-no-lookup state
correction, M-next (number unassigned)**; allocate its actual next free number
only if the Owner later commissions it. Do not rename any existing migration.

Filename (created locally 2026-10-25):
supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql
(14 digits: YYYYMMDD + 000081). On 2026-10-25 the candidate filename would be
20261025000081_marketplace_phase9_catalogue_link_at_add.sql; recheck exact history
and ordering at future preflight. Overall Library migration timestamps are not
Phase 9 M-numbers and must not be mistaken for a collision or a missing M81.

One transaction's proposed statements:

1. BEGIN; create the one private helper with local normalization/identity logic
   and nested exception block. Do not change existing shared normalizer bodies.
2. ALTER FUNCTION helper OWNER TO postgres; explicit four-role REVOKE ALL.
3. CREATE OR REPLACE public.phase9_add_candidate_to_inventory_v1 with unchanged
   seven-argument signature/return/security/search_path and M69 body plus the
   helper call/centralized link resolution. Preserve its authenticated-only ACL;
   explicitly revoke PUBLIC/anon/authenticated/service_role then grant only
   authenticated if restating ACL, following M78. No new execution grant on helper.
4. **Included (OQ6 decided):** explicit canonical-table write revocation (§9.2), preserving
   existing required SELECT. No broad global ALTER DEFAULT PRIVILEGES, no SELECT
   policy change, no table recreation. Verify service-role requirements too.
5. COMMIT. No INSERT/UPDATE/DELETE data statement outside function bodies, no
   migration-time execution of Add/helper and no backfill/reset.

Proposed ledger row for the implementation verification tracker/migration ledger:

| Migration | Local filename | Live version | Project verification | Effects | Readback | State |
|---|---|---|---|---|---|---|
| Phase 9 M81 | 20261025000081_marketplace_phase9_catalogue_link_at_add.sql (517 lines, created locally 2026-10-25; applied as written - the file's header comment still says PROPOSED, not applied, stale by design since an applied migration file must not be edited) | 20261025171647 | re-verified 2026-10-25 via MCP get_project_url immediately before application (https://ahntbtktjjmvfosgkmgn.supabase.co); pre-state: live 79+80, no 81, Add md5 f38185ddd742cd0fbb249db1a903738e length 8972, helper absent | private helper with oversized-key skip (fix 2) and §3.1 disappearance-safe gate/hydration; Add replacement; canonical-table write revocation including MAINTAIN (fix 3, OQ6) | PASS: helper owner postgres/SECURITY DEFINER/VOLATILE/search_path ""/proacl postgres=X, EXECUTE postgres only, prosrc length 21038 md5 69bd9b40c54a119a61e2782f19c55afb == local LF body; Add owner postgres/SECURITY DEFINER/VOLATILE/search_path ""/proacl postgres+authenticated, EXECUTE authenticated (not anon), length 11538 md5 9fe42381cf406d81018417dfc541217a == local LF body; no PUBLIC ACLs; exactly one of each; canonical tables anon+authenticated SELECT-only, policies/constraints/triggers unchanged; counts identical (works 1, editions 1, inventory 32, linked 0 - the 32 is the inventory row count; rows with canonical_edition_id are 0 before and after) | **APPLIED_LIVE** |

Readback queries (run read-only after application on 2026-10-25 - all PASS; kept for re-verification):

    SELECT p.oid::regprocedure, r.rolname AS owner, p.prosecdef, p.provolatile,
           p.proconfig, p.proacl, length(p.prosrc), md5(p.prosrc)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_roles r ON r.oid=p.proowner
    WHERE (n.nspname='public' AND p.proname='phase9_add_candidate_to_inventory_v1')
       OR (n.nspname='marketplace_sec' AND p.proname='phase9_catalogue_link_for_add_v1');

    SELECT role_name,
      has_function_privilege(role_name,
        'marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)', 'EXECUTE')
    FROM (VALUES ('anon'),('authenticated'),('service_role'),('postgres')) v(role_name);

    SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name IN ('canonical_works','canonical_editions');
    SELECT conrelid::regclass,conname,pg_get_constraintdef(oid)
    FROM pg_constraint WHERE conrelid IN ('public.canonical_works'::regclass,
                                         'public.canonical_editions'::regclass);
    SELECT id,title_normalized,primary_title,primary_authors,language
    FROM public.canonical_works;
    SELECT id,work_id,isbn_10,isbn_13,title,authors,cover_url,created_at,
           metadata_verified_at,metadata_selection_version
    FROM public.canonical_editions;

Also read Add's has_function_privilege for all roles (authenticated true,
anon/service_role false), pg_get_functiondef for both functions, SELECT policies,
all four store_inventory triggers and any unchanged helper ACLs; inspect explicit
PUBLIC ACL entries with aclexplode as PUBLIC is not a login role. Verify proconfig
contains empty search_path, owner postgres, helper/add VOLATILE and no unexpected
overloads. Compare installed prosrc MD5/length to the **new local LF bodies**;
their hashes cannot be supplied before M81 exists. Archive old M69 hash from §2
for rollback. Record history mapping/version; never assume file timestamp equals
live migration version. Count canonical/inventory rows before/after application:
DDL alone must leave counts and 32 existing inventory links unchanged. A later
separately approved browser Add naturally changes counts and is distinct evidence.

## 12. Rollout, rollback and risks

**Rollout:** the §14 decisions are recorded; complete design review/Owner approval under SDD-0 §15,
then obtain separate build and migration-creation authority. Reverify project,
affected schema/ACL/definitions from fresh read-only evidence; run red-first
disposable tests and native races. Obtain separate application approval; only then apply M81 and
read back §11. No Edge, worker or app change/deployment is required for this
bounded slice: unchanged C12 arguments/response, existing full chosen JSON and
lineage (C07/C19), only database linking before the unchanged INSERT. Old and new
apps/workers continue to send/read the same contracts (R06). If evidence shows
missing lineage, skip safely and report coverage; do not silently widen worker
scope to backfill provenance. Slice 7 owns new companion transport.

After separate browser-check authorization, use Owner-signed-in app: choose an
Open Library edition, save selling review, Add once, inspect its private inventory
and canonical IDs read-only, then retry receipt. Include a Google/manual case,
synthetic incumbent no-update and stale-target cases, null cover and tracker 38 §33 follow-up B's live
many-edition ISBN check. If that check fails, design its bounded fallback under
new authority; it is not permission for a worker edit/deploy here. Do not publish
inventory as a side effect of testing catalogue links.

**Rollback:** separately approved forward CREATE OR REPLACE restoring the exact
previous M69 Add body (hash/length in §2), keeping its ACL/security/search_path.
That also removes §3.1 disappearance tolerance: stale selected IDs can again
fail the gate or INSERT. Assess saved references before authorizing this rollback;
prefer a bounded forward correction if that would reintroduce the reported failure.
The unused helper can remain inaccessible; no down migration, data delete or
automatic unlink. Already created work/edition rows and inventory FK links stay;
canonical facts remain publicly readable and future catalogue lookups may reuse
them. Normal valid OL rows/links are useful, not harmful solely because linking
is disabled. A discovered bad ISBN/licensing/privacy fact can remain harmful
after code rollback: isolate future writes and seek targeted Owner-approved
remediation; rollback is not a reset or data-cleanup authorization. Retain the OQ6
revocations during rollback, never restore TRUNCATE exposure
merely to reproduce old ACLs.

Residual risks/deferred work: Unicode/collation differences; checksum-valid
reused ISBNs until the slice-7 blocklist; service_role keeps its table
privileges (slice 7 governs direct service writes); the pre-existing Hobbit
incumbent of unknown provenance (§9.1); no persisted source-note/normalizer-version columns
until slice 7; mixed linked/unlinked public grouping; unexpected DB failures
(OQ7); worker F8 guard redeploy remains
Owner-gated. No provider-ID reconciliation, overwrite/refresh engine, second
provider, hidden-record lookup rule or no-ISBN catalogue write is claimed.

## 13. Documentation at implementation time

Follow [SESSION-START update matrix, L1630](../../SESSION-START.md#L1630) and
[CODEBASE_MAP update table, L62](../../../../../../CODEBASE_MAP/README.md#L62).
This docs-only pass changes neither source behavior nor installed schema.
Implementation must update:

- DOC-3 **§§5.1, 5.2 and 17** with slice 6's exact ISBN linking/promotion and
  manual/Google exclusions (SDD-0 §9; SDD-2 amendment note). Do not prematurely
  apply slice 7's §14 provider-ID model. DOC-3 is intentionally unchanged now.
- SDD-0/SDD-2 wording made necessary by the 2026-10-25 decisions (§14): D37 and
  SDD-2 slice 7 AC7-3 state that the blocklist lands in slice 7 (OQ2); SDD-2
  slice 6 migration line adds the canonical-table write revocation (OQ6) and AC7-8
  is extended from the provider-ID table to canonical_works/canonical_editions;
  SDD-2 AC6-4/scope text carries the OQ3 clarification (“just links” only while
  the row exists). Made when SDD-2 is next edited, with the Owner's approval, not
  silently.
- **Queued cross-slice wording fixes** from the 2026-10-25 Muse/GLM consistency
  review (read-only; none applied; each needs the Owner's approval when its
  document is next edited; no contradiction was found):
  - SDD-2 slice 8: apply §6.1 (name the helper, the M81 Add body and the M68/M73
    validators in the forward-SQL inventory; allow-list replacement owned by 8a;
    name the Open Library cover rule; lineage compatibility row; tests inherit the
    §7.1 baseline alignment).
  - SDD-2 slice 7: state the lock order of the lookup-completion writer against §4;
    which `metadata_selection_version` stamp provider-ID rows get (OQ4 covers ISBN
    Adds only); whether completion shares slice 6's identity, conflict and
    no-update routine or is a separate contract; where the blocklist is enforced
    for both writers; test plan cites the §7.1 alignment; migration wording "one"
    versus the 7a/7b split.
  - SDD-4 slice 13: line 125 "Edition cleared between edit and Add" means the
    owner cleared the choice, not a vanished catalogue row (§3.1); restate that
    replay returns the original receipt without re-evaluating the catalogue and
    that a NULL/NULL link is a normal outcome; the Add migration is sequenced after
    M81; test plan cites the §7.1 alignment.
  - SDD-0 slice table: row 6 migration line adds the canonical-write revocation;
    row 8 decisions add D35 and Q18; row 6 adds D37/Q20 where relevant.
  - Hygiene: tracker 38 §33 lines 1565 and 1582 "needs M81" get a pointer to the
    "M-next" rename in §34; `.claude/psr-slice6/db-evidence.md` L24 is superseded
    by OQ6 (historical snapshot commentary, untracked file).
- This SDD, SDD-2 slice-6 status/ACs, tracker 38 and
  trackers/02-implementation-and-verification.md: exact red/green, migration
  ledger, native locks, readback, decisions, deviations and rollout/rollback.
- supporting/data-dictionary.md: canonical writer/key/field provenance, actual
  public column visibility and no store identifiers; supporting/database-current-vs-target.md:
  fresh schema/constraint names/hash/ACL evidence and M81 local/live mapping.
- supporting/requirements-traceability.md: AC6-0–AC6-28 to actual tests/fixtures,
  conditional cases resolved, regression/native/browser evidence. Security
  verification matrix in the implementation tracker: actual role denials,
  cross-store fences and the OQ6 revocation (AC6-24); no destructive live probes.
- ACTIVE.md, DOC-13, TRACKER.md and SESSION-START.md identical current handoff;
  phase README routing. No milestone completion from code existence alone.
- CODEBASE_MAP/03-backend.md for the private writer/security boundary;
  05-marketplace-rules.md when DOC-3 cited rules change; 06-testing.md for native
  runner/harness changes. 04-features.md only if implementation changes its
  described path/module; 01/02/07 stay unless their update triggers occur.
No status, live counts, branch or secrets in the map. No map edit is required
for a draft that adds no runtime path or new docs folder/source specification.

**Known limitations / review outcome (2026-10-25, documentation only; no design change).** M81 (517 lines, APPLIED_LIVE as live version 20261025171647 on 2026-10-25) is green locally (DB 79/79 including AC6-29, GUARD 26/26, regressions 13/32/36/32/20, architecture 17/17, MaintainAcl 2/2, SensitiveTableAcl 2/2, native runner exit 0) and reviewed read-only by Muse, free GLM, Codex Sol and Luna with no High finding: Sol's oversized-key Medium fixed (fix 2, AC6-29, mutation-proved not vacuous); Sol's legacy-key race (a skipped link in a rare interleaving, never a wrong link or a failed Add) recorded for slice 7; Muse's two Lows refuted by the orchestrator; GLM Lows not adopted. Read-only live preflight on ahntbtktjjmvfosgkmgn: R1 raw-case live Hobbit authors accepted as a slice-7 limitation (no data change now), R2 MAINTAIN grant fixed as fix 3. Known limitations: (1) legacy raw-case works can lead to a duplicate work and, in a rare race, a skipped link (slice 7, no data change); (2) the canonical revoke covers the current tables only: re-apply it if those tables are ever recreated (no ALTER DEFAULT PRIVILEGES backstop by design); (3) helper result has no row-count assertion (not adopted); (4) manual-mode Adds pay the helper's scoped reads (design-conformant). Browser proof done 2026-10-26 (one Open Library case, Owner-authorized dev browser test; M81 applied as live version 20261025171647): one Add linked a new work and edition and the inventory ids equal the canonical ids. Reuse and manual-card browser cases not run (covered by the 79 DB and 25 native tests); the many-edition ISBN case not run. The pre-existing slice-5 picker/M78 edition-reset trigger finding is outside slice 6 and affects whether ISBN-searched cards reach the link (fix proposal M82 not created, not authorized). Not done / not authorized: the queued SDD-0/2/4 wording edits above; commit and push; optional schema performance audit.

## 14. Owner decisions and conflicts

This section records the Owner's 2026-10-25 answers to the questions of revision
1. Numbering is kept so earlier citations stay valid: OQ5 (the catalogue reset) is
no longer part of slice 6 (§9.1) and the former OQ8 is OQ7. Recommendations were
adopted as written unless a decision below says otherwise. Q15's second-provider
overwrite policy and Q18's licensing details keep their existing deferrals.

1. **OQ1 — Work normalization rule. Decided: recommended default.** The single
   NFKC/whitespace/lowercase, punctuation-preserving rule in §5.2, C-sorted authors
   with duplicates retained; an ISBN incumbent is linked only after normalized
   title, authors and work agree. Cost: deterministic Unicode/collation fixtures.
   A punctuation-stripping or deduplicating key changes identity and may collapse
   distinct works.
2. **OQ2 — D37 blocklist timing. Decided: defer to slice 7** (SDD-2 AC7-3), not the
   recommended default of implementing a small list in M81. Cost: a checksum-valid
   placeholder or reused ISBN can create a shared row during slice 6; checksum and
   prefix checks alone do not prevent it. No list contents were approved. SDD-0 D37
   and SDD-2 slice 7 must say the blocklist lands there (§13).
3. **OQ3 — Existing canonical ID versus AC6-4. Decided: recommended default.**
   “Just links” means only while the row still exists; absent or SET NULL targets
   never fail Add, and admitted Open Library may find/create (§3.1). Existing
   trusted canonical-ID reuse is preserved without new shared writes; AC6-4's
   no-link rule applies to unmatched Google/manual choices; a manual title edit
   still loses its choice and link; a NULL-work incumbent gets no link (no new
   work, no repair). Cost: a narrow AC clarification and tests, including
   missing/null work.
4. **OQ4 — Immutable incumbents and metadata stamps. Decided: recommended
   default.** Never update existing work/edition rows; new rows get
   metadata_verified_at = provider fetchedAt and metadata_selection_version =
   psr-catalogue-isbn-v1, with no store or selection IDs. Cost: stale or missing
   incumbent facts persist until a later policy; the timestamp means provider
   freshness, not human verification.
5. **(OQ5 — catalogue reset: dropped from slice 6.)** See §9.1. Q15 is unchanged:
   any reset needs its own design and approval.
6. **OQ6 — Canonical write-grant revocation. Decided: include in M81,** conditional
   on the writer audit, which passed (§9.2; had a writer used anon or
   authenticated, work would have stopped for the Owner). Cost: more migration and
   ACL tests (AC6-24); SDD-2 AC7-8 must be extended from the provider-ID table to
   the canonical tables. No live grant mutation is authorized by this decision.
7. **OQ7 — Unexpected catalogue failures. Decided: recommended default.** Catch and
   roll back expected identity/validation skips only; unexpected database errors
   propagate and fail that Add atomically, so the ordinary retry applies. Cost: a
   rare infrastructure error may fail an Add attempt. No broad exception handler
   around the outer Add.

**Conflict register:** DOC-3 §§5.1/5.2/17 still describe suggest-only/
picker-not-promoting/deferred canonical merge (DOC-3 L390/L430/L965),
intentionally superseded for this scope by Owner decisions and the named
amendment, not silently edited here. DOC-3 §4.2 permits translated editions under
a work but no provider work ID reaches slice 6; different normalized title/author
keys are not silently reconciled. C11's shared ISBN helper lacks the app's prefix
guard; the helper-local guard resolves this slice without changing old
clients/workers. C20's metadata-column privacy annotation conflicts with actual
public SELECT and needs correction in the implementation dictionary/audit.
SDD-2 slice 6 says “one migration: new helper plus CREATE OR REPLACE of Add, no
column change”; the revocation (OQ6) adds an ACL change to M81, and OQ2 moves the
blocklist to slice 7 — both need SDD-2/SDD-0 wording updates (§13). None of these
is permission to change approved behavior in this documentation session.

**Remaining gates:** the Owner approved this design on 2026-10-25 (revision 3 plus
section 6.1; the read-only Argon and Muse/GLM reviews are recorded in tracker 38
section 35); design approval is not build authority. Still required: build authority (red-first tests and fixtures first). Migration-file creation and migration application are done: M81 is **APPLIED_LIVE** (file created locally 2026-10-25, 517 lines; applied 2026-10-25 as live version 20261025171647; the file's local header comment is stale by design). This document is cohesive around one transactional Add operation;
its length preserves field, identity, privilege and red-test contracts rather
than splitting authority by line count.
