# Post-Scan Rework — SDD-2 Catalogue and Matching (slices 6–9)

**Status:** `pass_1_outline_approved` (2026-10-19). Provider-neutral amendment
to slices 6–8 drafted 2026-10-24 on Owner direction; whole-review corrections
and the Owner's 2026-10-25 decisions are recorded in tracker 38 §34 and
SDD-0 §14. The approved 10-19 baseline is distinct from this draft amendment;
remaining pass-2 questions retain their stated gates. Pass 2 is written
immediately before slice 6 starts; no implementation is authorized here.
**Overview and decisions:** [SDD-0](./00-overview-sdd.md)

## Context

Finding the right edition is today a Google-only automatic step with strict
rules (SDD-0 F13, F34). Open Library serves only the Owner's explicit search
(F36). Nothing writes the catalogue tables (F5, F17), so every store pays for
the same lookups again, and an edition picked in the sheet is added with no
catalogue link (F5). This area builds a lean shared catalogue on the existing
tables, links every Add to it, makes Open Library the automatic provider with
Google switched off, and relaxes automatic matching once a benchmark proves it
does not pick wrong editions.

Decisions served: PSR-D25 to D40. Rules: PSR-R04 (no store data in shared
rows), R05 (no Google data in the catalogue), R06 (compatible rollout), R09
(provider output untrusted; Open Library etiquette), R10 (manual paths
survive provider failure; MAS-16).

**Design input:** design study 1 (Muse Spark 1.3 xhigh, 2026-10-19) and a
read-only code map; their verified conclusions are summarized in SDD-0 §10 and
below. Pass 2 re-verifies every pointer.

**Order and reasoning:** slice 6 (link at Add, ISBN identity only, no new
columns) → slice 7 (provider-ID list, columns, catalogue writes, stats, cache) →
slice 8 (Open Library automatic provider, clues, Google off) → slice 9
(relaxed match, tie pick, saved results) behind the benchmark.

---

## Slice 6 — Catalogue link at Add

**Pass-2 status (2026-10-25, revision 3):** detailed design drafted for review in
[02a - Slice 6 Catalogue Link at Add](./02a-slice6-catalogue-link-sdd.md). The Owner
decided its open questions on 2026-10-25 (02a section 14): no catalogue reset in
slice 6, blocklist deferred to slice 7, canonical-table write revocation in M81, and
Add tolerating a disappeared saved catalogue ID (AC6-20 to AC6-28). A read-only Argon review was applied. The SDD-2 wording
these decisions change (slice 7 blocklist, AC7-8 scope, slice 6 migration line, OQ3
clarification) is listed in 02a section 13 and not yet edited here. No build or migration approval. The ACs below
retain their approved wording; 02a section 10 refines the test contracts and
section 14 records the existing-ID/AC6-4 decision (OQ3).

**Goal:** every added book points at its catalogue edition when one can be
identified (D34).

**Scope:**
- Inside `phase9_add_candidate_to_inventory_v1` (the current Add; slice 13
  keeps the same helper), after the eligibility check and before the inventory
  insert, call a new `SECURITY DEFINER` helper that finds or creates the
  catalogue work and edition for the chosen edition and returns their IDs.
- Identity: normalized, checksum-valid ISBN-13 (ISBN-10 converted). If the
  chosen edition has both and they disagree, no link. Without an ISBN, no link
  in this slice (the provider-ID list and provider edition-ID identity arrive in slice 7).
- **Only `open_library` choices may create shared rows in this slice** (D35,
  R05). This explicit allow-list also requires the existing registry row's
  metadata kind, enabled/matching/storage/public-display permissions and
  current version checks. `storage_allowed` alone is not shared-catalogue
  permission: it is already true for Google as well (SDD-0 F34). A choice
  whose snapshot already carries a valid catalogue ID just links; Google and
  manual choices never create. Slice 7 retains this allow-list; slice 8
  replaces it with a distinct reviewed shared-catalogue capability (Q18).
  Adding that column now is the rejected alternative: it broadens slice 6's
  schema scope without being needed for its Open Library-only behaviour.
- Shared rows take bibliographic facts from the provider snapshot only, never
  from the Owner's review (D40, R04).
- Concurrency: `INSERT … ON CONFLICT DO NOTHING` on the existing unique keys
  (`isbn_13`; works `title_normalized, primary_authors`), then re-select, so two
  stores adding the same edition at once converge on one row and both inventory
  rows link to it (Q20). A uniqueness race alone is not an identity conflict.
  If the re-selected row has a conflicting work/title identity, or ISBN-10
  and ISBN-13 resolve to different rows, keep the first row, create no second
  conflicting row and perform no merge; Add succeeds without a catalogue link.
- Immutable snapshots are never updated (F9); the link is written only on the
  new inventory row.
- Work identity: author names in the work key are normalized (trimmed,
  lower-cased, sorted) before find-or-create, so author order or case
  cannot split one book into two works (SDD-0 F46).
**Not in scope:** stats, source rows, new columns (slice 7).

**Depends on:** none (built after SDD-1 by order).
**Migration:** one — new helper plus `CREATE OR REPLACE` of the Add function
(M69 body + the call). No column change, no backfill; old app and worker keep
working (R06).
**Amends:** DOC-3 §5.1 matching description, §5.2 picker sentence ("does not
promote canonical truth") and §17 ("automated canonical merge without
review"). Slice 6 permits only exact validated ISBN-13 identity; provider
edition-ID identity and the §14 provider-ID data model arrive in slice 7.

**Acceptance checks:**
- AC6-0: Given the same book added with authors in a different order or
  case, then both inventory rows link to one catalogue work (F46).
- AC6-1: Given an Open Library edition with a valid ISBN chosen in the sheet,
  when the book is added, then a catalogue work and edition exist and the
  inventory row links both (D34, D35).
- AC6-2: Given a second store adds the same ISBN, then it links to the same
  catalogue edition and no new edition row is created (D35).
- AC6-3: Given two stores add it at the same moment, then exactly one edition
  row exists and both inventory rows link to it; the concurrent writes are
  not an identity conflict (D35, Q20).
- AC6-4: Given a Google-sourced or manual choice, then no catalogue row is
  created and the Add succeeds with no link, even if Google's registry row
  has `storage_allowed=true` (D35, R05, R10).
- AC6-5: Given ISBN-10 and ISBN-13 that disagree, then no link and the Add
  succeeds (D37).
- AC6-6: Given a pre-existing catalogue row and the Owner edits the chosen
  edition's title, then the choice becomes manual under slice 2's identity
  rules. The unmatched manual Add creates no catalogue row or link, leaves
  the pre-existing row unchanged and saves the edited title on the store's
  inventory row (AC6-4, D40, R04).
- AC6-7: Given a replayed Add, then the original inventory ID is returned and
  nothing new is created (R01).

**Tests first:** Database (`supabase/tests/phase9/`, new catalogue-link suite)
for AC6-0 to AC6-7; existing commit suites stay green
(`phase9Unit7aCreateOnlyCommit`, `phase9EditionPickerCommit`).
**Size / risk:** M / med.

---

## Slice 7 — Lean catalogue writes, stats and shared cache

**Pass-2 status (Owner 2026-10-26):** [02b - Slice 7 Lean Catalogue Writes](./02b-slice7-lean-catalogue-writes-sdd.md) approved as the Slice 7 design; split decided as 7a (M83, local `supabase/migrations/20261026000083_marketplace_phase9_lean_catalogue_identity.sql`, PROPOSED / NOT_CREATED / NOT_APPLIED) and 7b (one migration, number undecided). 7a build and local migration creation authorized; application requires separate Owner approval. 7b is not authorized. M82's separate first-save fix is applied as live version 20261025220839.
02b §11 records the approved detailed AC wording refinements: AC7-1/2e activation, AC7-2c translation conflicts, AC7-3 blocklist in Slice 7, AC7-4/5 count semantics/readers, AC7-7 typed shared cache, AC7-8 canonical revocation already in M81 plus MAINTAIN/service denials; additional **AC7-11–AC7-28**, including provider neutrality AC7-21 and 7a source-write denial/preserved reads AC7-28 (Owner 2026-10-26, decision 6 closed). Approved AC text below is preserved; Owner answers and approval-round decisions are in 02b §14, object ownership and acceptance subsets in §12.

**Goal:** Open Library editions found by any store are kept, so the next store
needs no call (D33, D39); usage counts guide ordering (D36).

**Scope:**
- **Provider-ID list (PSR-D35, amended 2026-10-24):** one new table, one row per
  provider ID: `canonical_edition_id` or `canonical_work_id` (exactly one set),
  `adapter_key` (non-null FK to `phase9_provider_registry`), `id_kind`
  (non-null, `edition` or `work`; other kinds later), `external_id` (non-null,
  safe nonblank text, 1–256 characters), `created_at` (non-null); unique on
  (`adapter_key`, `id_kind`, `external_id`); indexes on both links. Canonical
  target FKs use `ON DELETE CASCADE`; require
  `CHECK ((canonical_edition_id IS NOT NULL) <> (canonical_work_id IS NOT NULL))`
  and kind/link coherence (`edition` requires the edition link, `work` the
  work link). `SET NULL` would orphan an ID and violate these checks. Validate
  adapter-key format against the current metadata contract
  (`^[a-z][a-z0-9_-]{1,63}$`); M15's SQL accepts a wider dotted namespace, so
  pass 2 must preserve worker/SQL parity rather than assume dotted keys work.
  Open Library's edition and work IDs are the first rows. No provider-specific
  columns are added to canonical works/editions; new providers add rows, not
  columns. Multiple source IDs/redirect aliases may target one canonical row;
  one complete tuple cannot target two. No store column (D35, R04).
- **Write/read boundary:** enable RLS on the new table; revoke ALL from
  PUBLIC, anon, authenticated and service_role, then grant SELECT only to
  approved readers. Owner decision Q21 (2026-10-25): authenticated SELECT
  policy and necessary server SELECT only, no anon grant/policy. No direct
  INSERT/UPDATE/DELETE/TRUNCATE grants, including to service_role. Writes use
  the private `SECURITY DEFINER` helper with empty search_path; revoke direct
  EXECUTE from PUBLIC/anon/authenticated/service_role and invoke it only
  through the scoped Add/worker commands. Definer status alone is insufficient;
  preserve the outer commands' tenant, claim and lineage fences (R04, R07).
- **Identity convergence:** valid ISBN-13 first, else the namespaced provider
  edition-ID tuple. Same ISBN from two providers means one edition with two
  ID rows; without ISBN each provider's edition remains separate (Q16).
  Identical ID text under different providers or kinds is valid. A tuple
  targeting a second record is refused by the unique constraint. **Decided
  conflict rule (Q20, Owner 2026-10-25):** concurrent writes for the same ISBN-13
  with consistent edition identity converge, including both inventory links
  (AC6-3). Real conflicts mean identifiers disagree: the ISBN-13's existing
  edition has a different work or title, a provider ID targets another record,
  or ISBN-10 and ISBN-13 point to different rows. Different ISBNs alone are
  never a conflict; they may identify two editions of one work. Keep the first
  row, create no second conflicting row and skip that edition's catalogue
  sub-operation atomically (work, edition, IDs and source rows), with no partial
  writes. At Add, this means a successful unmatched, store-private Add.
  This includes translations grouped by a provider work ID despite different
  title/author work keys (DOC-3 §4.2). No silent merge/reassignment or fuzzy
  work reconciliation. Lookup-time behaviour is specified under Write timing.
- **Identifier transport:** carry validated provider edition/work references
  from the adapter to the catalogue helper through a provider-neutral,
  versioned catalogue-write companion payload, bound to the edition and its
  lookup/attempt/provider lineage. The current adapter obtains a work key but
  drops it before normalization; `MetadataEdition` has only `providerRecordId`,
  and M73 rejects unknown metadata keys. Pass 2 defines the companion schema,
  worker/RPC transport and SQL validation together; do not add unrecognized
  snapshot keys or rewrite immutable snapshots. Missing work references remain
  valid for older workers (R06, R09; AC7-2d).
  Extract edition-level `oclc_numbers` and `lccn` from the same Open Library
  edition JSON already fetched by the adapter, through the normalizer into
  nullable provider-neutral `oclc`/`lccn` companion fields. No extra request or
  cross-edition/work inference. Bound each input array to at most 16 strings
  and each trimmed value to 1–64 characters; reject controls/active content,
  require decimal digits for OCLC and a bounded alphanumeric LCCN with only
  spaces/hyphens as separators. Do not coerce numbers or guess missing digits.
  Deduplicate identical trimmed values; populate the column only for one
  distinct valid value. Missing, malformed, oversize or multiple distinct
  values yield null for that field without dropping the edition option.
  Companion scalar bounds/shape have matching worker/SQL checks; bind the
  fields to the same edition/lookup/attempt/provider as its work references,
  and persist them in
  the source's normalized facts and the coherent canonical edition's columns
  only after admission/identity checks. They are facts, not new merge keys.
  An absent companion or fields from an older worker mean null on new rows,
  never clearing existing populated facts; reject unknown
  companion keys, without adding keys to M73's immutable metadata snapshot
  contract. Pass 2 names the companion version, RPC and matching SQL validators
  together; positive extraction-to-storage fixtures are required (AC7-2f).
- Additive columns on `canonical_editions`: OCLC and LCCN (provider-independent),
  hidden flag, one source-and-retention note, normalizer version. These columns
  are publicly readable under the existing anon/authenticated SELECT policies
  (P3 L154–157): hidden suppresses search, not direct row access. Keep the note
  bibliographic/policy-only, with no private licensing notes or store data
  (D37, R04); changing public canonical access is outside this amendment.
- **Provider-neutral attribution (Owner 2026-10-26; 02b §§4.2/11, AC7-21):**
  add nullable `phase9_provider_registry.shared_source_note text` (1–1024 safe
  characters when set; no grant change). Copy new source-and-retention notes
  from the admitted provider's registry row, never a generic-code literal;
  a null note is not admitted. 7a sets the Open Library registry note only;
  later providers require their own Q18 approval and row. Raw retention and
  revalidation remain registry-derived. The exact provider-neutral SQL/worker
  boundaries and synthetic-provider proof are in 02b §11 AC7-21.
- **Sources and covers:** one `book_metadata_sources` row per provider record,
  using slice 6's Open Library allow-list until slice 8. New rows set both
  legacy `provider` and nullable-schema `adapter_key` to the same registry key,
  and set non-null `provider_book_id` to the edition ID. Existing
  `UNIQUE(provider, provider_book_id)` remains the source-row key; the new
  provider-ID tuple is the identity key. Store slim normalized facts only
  (Open Library raw retention is 0), with record-level source provenance and
  `expires_at` on the source row, not on canonical works/editions. Retain one
  coherent source's canonical facts; no field stitching or overwrite policy
  is introduced (Q15). Existing development catalogue data may be reset or
  rebuilt only with separate Owner approval; this edit authorizes no reset.
  Ordinary writes retain Q20's first-row rule while second-provider overwrite
  policy stays deferred. Cover IDs stay in the source's normalized payload;
  derive its permitted URL there and retain existing
  `canonical_editions.cover_url` as the coherent, publicly reusable projection.
  M65's catalogue snapshot reads that column, so cache hits keep their cover
  without another call (AC7-9, AC8-1). No image-file persistence is implied.
  Q18's licensing/retention details are deferred to the Owner while Open Library
  is the only provider; no second provider enters shared storage before the
  Owner records its permanent/public reuse, cover, attribution and retention
  permission. Existing Open Library policy checks remain in force. Do not
  enable a source requiring expiry until every canonical reuse/display path
  enforces it or withdraws its facts/covers (Q17, AC7-10). Source deadlines do
  not automatically hide canonical projections; bulk refresh stays deferred.
- Stats table(s) with no store column: times searched (work), times chosen and
  times added (edition), incremented without locking catalogue rows (D36).
- ISBN check digit and a small blocklist (placeholder and known-reused ISBNs)
  before any identity use (D37).
- **Write timing (D39):** editions that pass the relaxed title-and-author match
  are written when the Open Library lookup completes; "chosen" counts on
  selection; "added" counts on Add. Design study 1 argued for writing only at
  Add; pass 2 measures expected growth and keeps D39 unless it finds a
  technical blocker (SDD-0 §14 Q3), in which case it returns to the Owner.
  A Q20 identity conflict skips only that edition's catalogue sub-operation;
  it never discards or changes its otherwise valid edition option or the other
  options. Save the complete bounded option list with its original order and
  eligibility, show all options to the Owner, resolve the job/lookup using the
  normal option-derived outcome and consume/account the existing reservation
  and physical calls exactly once. No retry or new provider request is caused
  by the conflict. Catalogue stats attach only to successfully resolved
  catalogue targets (times searched per Q4); no count is assigned to an
  unrelated incumbent, and lookup completion changes no chosen/added count.
  Completion replay/lost-response recovery returns the saved result without
  repeating writes, option-version increments, counts or usage accounting.
- Hidden records are excluded from lookups but existing links stay.
- Shared cache: the worker writes `public_bibliographic` cache entries (no
  store) only when both the query key and the payload are provider or scan
  facts. A query built from Owner-confirmed text (F43) stays in the
  store-private cache, so no Owner edit reaches a shared key (D40, R04).
  Tests compare keys and payloads across two stores (F18, F35).
- Slice 6's helper extends to provider edition-ID identity (Open Library
  first), work references and source rows, with the conflict fallback above.
**Not in scope:** per-field provenance, change log, fuzzy (`pg_trgm`) search
(SDD-0 §5); admin tooling beyond the hidden flag.

**Depends on:** slice 6.
**Migration (Owner 2026-10-26, OQ8):** decided split, **one migration per slice
(R12)**. 7a = M83, proposed local
`supabase/migrations/20261026000083_marketplace_phase9_lean_catalogue_identity.sql`
(PROPOSED / NOT_CREATED / NOT_APPLIED): provider-ID list, FKs/checks/indexes,
RLS/grants, canonical/registry columns, empty private blocklist/STABLE ISBN
reader, stats, Add/Select/identity helpers and source direct-write audit/revoke.
7b = one migration, number decided at 7b start after 7a is applied and verified:
lookup-time writes, identifier transport including OCLC/LCCN, accounting-mode
provider validation, companion validation and shared cache. 02b §12 owns the
exact object/acceptance split; searched stays 0 in 7a. 7a build/local creation
are authorized; application is separate and 7b is not authorized.
**Amends:** DOC-3 §§5.1 (provider-ID matching), 5.2 (coherent source and picker
promotion), 14 (canonical/source/provider-ID data model) and 17 (exact identity
only). Source-spec edits ship with implementation; this docs-only amendment
does not edit DOC-3 or authorize that implementation.
**Code pointers:** the new provider-ID list table and helper;
`metadata/openLibrary/adapter.ts` (work key), `normalizer.ts` (IDs, cover),
`contracts/metadata.ts`, catalogue-write companion contract/RPC validation
(new), M73 `phase9_edition_valid_metadata` (strict existing snapshot keys),
M65 `phase9_edition_canonical_snapshot` / `phase9_edition_current_snapshot`,
`runtime/metadataEditionOptions.ts`, `runtime/metadataTerminalPersistence.ts`,
`runtime/metadataProductionGateway.ts` (cache scope), `phase9_store_metadata_cache`
(M15), `phase9_edition_local_match` (M67), `domain/isbn.ts`.

**Acceptance checks:**
- AC7-1: Given a lookup returns 6 Open Library editions of which 4 pass the
  relaxed match, then 4 editions (and their work) are in the catalogue with one
  source row each (D35, D39).
- AC7-2: Given an edition without ISBN but with a provider edition ID,
  then it is stored once and a second store reuses it (D35).
- AC7-2b: Given two provider fixtures (second registry row inserted with
  `provider_kind='metadata'`, as M73 does), exercise the private generic
  identity/source-write helper as its privileged test owner, below the
  production admission check. When both report the same validated ISBN-13,
  then one edition has separate provider-ID/source rows and existing canonical
  facts are preserved. Without
  ISBN they create separate editions (Q16). Identical external-ID text under
  different providers or kinds is allowed; the same complete
  (`adapter_key`, `id_kind`, `external_id`) tuple targeting another record is
  refused by its unique constraint. This helper-level fixture neither bypasses
  nor widens the production Open Library admission check; AC8-9 proves full
  synthetic-provider admission/convergence after slice 8 (D35, Q15).
- AC7-2c: Given ISBN points to edition A but the provider tuple points to B,
  an ISBN-13 already belongs to an edition with a different work/title,
  ISBN-10 and ISBN-13 resolve to different rows, or a provider work ID conflicts
  with the normalized work key (including a translated edition), then the
  first row stays: no second conflicting row, merge, overwrite or reassignment.
  The conflicting catalogue writes/links are skipped atomically and Add
  succeeds unmatched, including concurrent conflicts and replay. Different
  ISBNs alone permit separate editions under one work; consistent same-ISBN
  writes converge as in AC6-3 (D35, Q20, R01, R10).
- AC7-2d: Given an adapter's validated edition/work references, then they
  reach the helper with unchanged provider/lookup/attempt binding and create
  kind-correct ID rows. Invalid/oversize IDs, null keys, wrong target kind,
  two/no targets, nonexistent FKs or mismatched lineage are refused; deleting
  a target cascades only its ID rows. An old worker with no work reference
  still works and immutable snapshot bytes stay unchanged (D35, R06, R09).
- AC7-2e: Given lookup completion with N valid options, M passing the relaxed
  match and C real Q20 conflicts among them, then all N options are saved and
  shown in the same order/eligibility; only the M−C nonconflicting editions
  are written or reused. Each conflicting edition has no partial work/edition/
  ID/source write, no second conflicting row and no change to the first row.
  The job resolves with the normal option-derived outcome, the existing usage
  reservation is consumed and physical calls accounted once, and no retry is
  scheduled. Times searched follows Q4 for resolved catalogue targets only;
  chosen/added counts stay unchanged. Prove concurrent completion for a real
  conflict and for consistent same-ISBN convergence, then replay/lost-response
  recovery: the same options/receipt return, with no extra provider call,
  write, options-version increment, count or accounting effect (D35, D36, D39,
  Q20, R01, R10).
- AC7-2f: Given a recorded positive Open Library edition fixture with
  `oclc_numbers` and `lccn`, then the normalizer, companion contract, worker/RPC
  and SQL preserve the validated values and edition/lookup/attempt/provider
  binding into its source facts and canonical `oclc`/`lccn` columns. Missing,
  malformed, oversize or conflicting values become null without losing the
  option; forged lineage/unknown companion keys are refused. An older worker
  omitting the companion or fields completes with null columns on new rows,
  preserves populated existing facts and leaves immutable snapshot bytes
  unchanged; replay creates no new write (D35, R06, R09).
- AC7-3: Given a placeholder or blocklisted ISBN, then it is never used as an
  identity (D37).
- AC7-4: Given an Owner picks and adds an edition, then its chosen and added
  counts each increase by one, once, even on replay (D36, R01).
- AC7-5: Given the stats tables, then they contain no store, user or
  inventory identifier (D36, R04).
- AC7-6: Given a record marked hidden, then lookups ignore it and existing
  inventory links remain (D37).
- AC7-7: Given store A cached a bibliographic search, then store B's same
  search uses it without a provider call; a store-private entry never crosses
  stores (D33, R04).
- AC7-8: Given anon and authenticated roles, then direct
  INSERT/UPDATE/DELETE/TRUNCATE on the provider-ID table and direct helper
  execution are denied. Under decided Q21 authenticated may
  SELECT, anon may not; required server reads work and service_role has no
  direct table writes. Exercise actual grants/RLS, not just policy text
  (D35, R04, R07).
- AC7-9: Given store A populated an approved Open Library edition with its
  own cover, then store B's catalogue hit exposes the same permitted cover
  through the canonical snapshot with zero provider calls; no cover gives the
  placeholder, never a different source's cover (D29, D33, R05).
- AC7-10: Given storage permission alone, a proposed second provider without
  the Owner's recorded permanent/public reuse, cover, attribution and retention
  permission (Q18), or an expiry-requiring source without verified
  canonical/display enforcement, then shared-catalogue admission is denied;
  Google and manual choices remain excluded. Temporary snapshot retention is
  not permission to populate publicly readable canonical rows. Q18's deferred
  details do not block the Open Library-only path under D35 and its existing
  policy checks (D35, R05, Q18).
- AC7-21: Provider neutrality: enforce the exhaustive per-artifact allowed
  `open_library` homes, registry-derived attribution/retention/revalidation,
  generic schema/worker rules, synthetic-provider core proof and unchanged
  production admission denial specified in **02b §11 AC7-21** (D32, D35).
  02b §12 assigns its 7a/7b acceptance portions; AC7-11–AC7-28 are defined in
  02b §11 without deleting or relaxing the approved AC text above.

**Tests first:** Database — catalogue writes, identity collisions/convergence,
FK/check/cascade and role-denial cases, source keys/provenance, canonical
cover reuse, policy admission, blocklist, stats, hidden, cache scope;
concurrent/replayed lookup conflicts, complete options and exactly-once usage
accounting (AC7-2e); positive OCLC/LCCN persistence and null compatibility
(AC7-2f). Server — identifier companion transport and SQL parity, positive
Open Library OCLC/LCCN fixtures, malformed/bounded fields, old-worker
compatibility, normalizer IDs, cache-scope choice (faked HTTP).
**Size / risk:** L / med.

---

## Slice 8 — Open Library first, clues, Google off

**Goal:** the automatic lookup goes catalogue → Open Library and uses the ISBN
and publisher Gemini already reads (D25, D27).

**Scope:**
- Automatic order: catalogue (local match on ISBN, a provider edition ID or exact
  normalized title, authors and language; hidden excluded) → Open Library →
  nothing (D25). Today Open Library has no automatic adapter (F34); this slice
  adds an automatic Open Library lookup that returns a ranked outcome through
  the existing provider-neutral contract (D32, MAS-13).
- Google switched off for automatic and explicit use through the registry
  switch (no code removal); Google cover fallback and representative Google
  cover inactive (D29, P9-D86).
- ISBN clue: checksum-valid → direct ISBN lookup first (D27). Verify the
  reported identity-strategy mismatch with a test first (F37).
- Publisher clue compared with each edition's publisher (normalized) for the
  tie order (D27, D28).
- Covers: Open Library cover by cover ID; otherwise placeholder (D29, D22).
- Genres: the Open Library adapter normalizes the work's subjects into
  `categories` (today always empty, SDD-0 F40), so slice 15 has provider
  genres to store and map.
- Option cleanup: if the catalogue step saves edition options, the
  edition source policy must accept that source, or the lists are cleared
  at once (F42).
- Protection (D31): request spacing and retry with backoff on 429/5xx; a
  per-store search cap; per-provider switches; both providers down → no
  edition and one automatic retry. Identify with a User-Agent that includes a
  contact email (F16). Pacing across worker instances (SDD-0 §14 Q5).
- Times searched counted per completed lookup on the chosen work (§14 Q4).
- **Registry capabilities instead of provider-name eligibility lists (Owner
  2026-10-24, D32/D35):** add separate default-false explicit-search,
  automatic-lookup and `shared_catalogue_allowed` capabilities. Shared use also
  requires existing registry enabled/metadata-kind/matching/storage/public-display/
  version checks and applicable retention; any additional provider also needs
  Q18's Owner-recorded permission before shared admission. Open Library uses
  D35's existing authorization while Q18's details remain deferred;
  it is separate from permission for a temporary private lookup. Keep shared
  use false for Google and exclude manual choices (R05). Replace slices 6–7's
  shared-create allow-list only here, after parity/negative tests.
- **Forward SQL scope:** pass 2 inventories the current definitions, not
  every superseded occurrence in applied M73/M74. The eight functions with
  provider lists are `phase9_edition_valid_metadata`,
  `phase9_edition_source_policy`, `phase9_edition_worker_context`,
  `phase9_register_structural_metadata_lookup`,
  `phase9_register_structural_metadata_attempt`, `phase9_reserve_metadata_usage`,
  `phase9_recover_candidate_edition_options_v1` and
  `phase9_complete_candidate_edition_options_v1` (M73; context/completion now
  replaced by M78). Cover all four areas: eligibility lists; primary/secondary
  role and predecessor pairing; own-record ID/book-link/cover validation; and
  provider-specific completion/physical-call branching. Also audit
  `phase9_edition_valid_rows` (M73 URL rules),
  `phase9_register_metadata_provider_call` (M68 Google-only registration),
  `phase9_register_edition_options_provider_call_v1` (M78 Open Library-only),
  `phase9_finish_edition_primary_for_fallback_v1` and
  `phase9_finalize_edition_options_provider_call_v1` (M73), plus wrappers and
  automatic-purpose dispatch. Existing bounded routing and no fallback on
  policy/quota/auth denial remain (DOC-3 §5.2).
- **Validation and accounting:** a capability never replaces own-record,
  approved-host, lineage, retention or physical-egress proof. Separate generic
  workflow/policy checks from registry-keyed, reviewed server-owned provider
  validation contracts for identifiers, book/cover URLs and receipt shape.
  Provider-specific validators remain code and may need forward SQL when a
  new provider uses a new format; no promise that enabling a flag alone makes
  an arbitrary adapter usable. No untrusted registry value may select arbitrary
  SQL. Keep pure shape checks IMMUTABLE; registry policy reads live in a
  STABLE boundary, with caller volatility audited (M73's metadata/row validators
  are currently IMMUTABLE). Replace `instanceof OpenLibraryEditionOptionsAdapter`
  routing/accounting in `runtime/metadataEditionOptions.ts` with the declared
  provider contract; preserve per-request receipts, budgets and recovery.
**Not in scope:** relaxed rules and tie pick for the automatic path (slice 9);
paid providers.

**Depends on:** slice 7.
**Migration:** required — registry capabilities and forward replacements for
the functions/policy and validation boundaries above, including completion
and physical-call paths (F34). Applied migrations stay unchanged (R06). If
this exceeds one session/migration, pass 2 splits before building into 8a
(registry and SQL generalization/validation/accounting) and 8b (Open Library
automatic adapter/order, clues and protection; no further migration expected).
Each resulting slice has at most one migration and must work independently
(SDD-0 §7.3); revise the map before approval if that split needs more SQL.

**Required pass-2 activation and rollback plan (R06, D25):** pass 2 must name
the compatible worker revisions, forward migration, registry values and
readback checks for every stage below before approval. This is a required
deliverable even if 8a and 8b ship separately; it is no deployment or service
mutation authority.

1. Capture the existing registry/worker and in-flight lookup state. New
   registry rows keep all three capabilities default false. In the forward
   migration, explicitly seed the existing Google row with explicit/automatic
   capabilities true and shared false, and the existing Open Library row with
   explicit true, automatic false and shared true under D35. This preserves
   their current routes during transition, subject to every existing enabled,
   version, retention and reuse check; it grants no new Google retention or
   shared permission. Other rows stay false. Preserve old RPC signatures and
   omitted-field handling so the current Google-primary worker still works
   between migration and worker deployment. If 8a ships alone, it stays in
   this compatible state until 8b is ready.
2. Deploy and verify the capability-aware worker in that transition state
   before switching routes. Stop admitting new external lookups for the
   switch, drain already authorized Google/Open Library attempts and recover
   committed completions before their policy is disabled. Account finalized
   physical calls and reservations once; an expired or lost claim follows
   existing fenced recovery, never duplicate egress. If an in-flight attempt
   cannot drain, the plan must prove a terminal safe/manual outcome with its
   existing spend retained before proceeding. Do not strand a lookup or spend
   reservation across the switch.
3. With no old worker claiming new jobs, disable Google in the registry and
   set its explicit/automatic capabilities false (shared remains false);
   enable Open Library automatic capability while retaining its explicit/shared
   values and all policy checks. Verify catalogue → Open Library automatic
   order, explicit search and zero Google egress, then resume admission.
   Existing chosen snapshots/inventory links remain intact; unselected lists
   from a disabled source may clear under the existing source policy (F42).
4. Roll back runtime through a separately approved deployment only after
   pausing admission and draining/recovering the new worker's attempts with
   the same accounting fences. Keep the additive schema, catalogue rows,
   inventory links and chosen snapshots. Prefer a compatible worker revision;
   if returning to the current Google-primary worker after Google is off,
   keep Google disabled and do not claim automatic Open Library support.
   Automatic provider misses degrade safely to no edition/manual Add; the
   still-permitted explicit Open Library route works. Do not re-enable Google
   as a rollback shortcut; that requires its own Owner decision (R05).

| Compatibility case | Required result / pass-2 proof |
|---|---|
| Existing registry rows, selections and inventory | Assert the explicit seed values above and default-false behaviour for any other/new row. Preserve canonical/inventory IDs and chosen snapshot bytes; saved-choice Add still works. Only unselected disabled/expired options follow normal cleanup. |
| Migration before new worker (including 8a alone) | The current worker's Google automatic and Open Library explicit routes retain their prior policy eligibility, old RPC/omitted companion calls work, Google shared writes remain denied and no route fails solely because new columns default false. |
| In-flight lookup at migration or activation | Exercise reserved, registered, egress-started, finalized and committed-with-lost-response cases. Drain or fenced recovery reaches a terminal options/manual result with actual spend/reservation accounting once, no duplicate call and no stranded job; completed options stay recoverable under permitted source policy. |
| Worker rollback after Google is switched off | Against the migrated database, both the compatible rollback revision and the old Google-primary worker make zero Google calls. The old worker offers safe no-edition/manual automatic outcomes and permitted explicit Open Library search; saved choices/Add and recovery survive without schema rollback or silently re-enabling Google. |

**Code pointers:** `workers/phase9-metadata-worker/bootstrap.ts`, `index.ts`,
`editionProviderRoute.ts`; `runtime/metadataGatewayContext.ts`,
`runtime/metadataProductionComposition.ts`, `runtime/metadataProductionGateway.ts`;
`metadata/openLibrary/adapter.ts`, `transport.ts`, `normalizer.ts`;
`metadata/googleBooks/ranking.ts`; `phase9_metadata_job_context` (M32/M38);
`phase9_provider_registry`; the SQL inventory above;
`runtime/metadataEditionOptions.ts`, provider contracts and physical-call ports.

**Acceptance checks:**
- AC8-1: Given a book already in the catalogue, then no provider call is made
  and the card shows the catalogue edition (D25, D33).
- AC8-2: Given a new book, then exactly one Open Library lookup runs (within
  its request budget) and no Google request is made (D25, R05). Given a faked
  second adapter and its validation contract prepared as in AC8-9, then the
  automatic path uses it with no change to canonical/candidate storage, review
  or Add (D32).
- AC8-3: Given a valid ISBN clue, then the ISBN lookup runs first and its
  edition is selected when it matches (D27).
- AC8-4: Given two equal editions and a publisher clue matching one, then that
  one ranks first (D27, D28).
- AC8-5: Given Open Library returns 429 then succeeds, then the lookup
  succeeds after backoff; given both providers are down, then the card has no
  edition, retries once, and manual search still works (D31, R10).
- AC8-6: Given the per-store search cap is reached, then lookups for that store
  pause with a clear reason and other stores are unaffected (D31).
- AC8-7: Given an edition with no Open Library cover, then the card shows the
  placeholder and no Google cover; the scan photo is never used (D22, D29).
- AC8-8: Given an Open Library work with subjects, then the normalized
  edition carries them as categories (F40, D43).
- AC8-9: Given a synthetic metadata provider with its own non-Google/non-OL
  edition ID and approved book/cover hosts, first install its test adapter,
  route and reviewed provider validation/receipt contract (provider-specific
  SQL may be needed). Freeze the generic workflow functions, insert/enable
  its registry row with the appropriate capabilities and verified policy,
  then register the explicit lookup, reserve usage, register attempts and
  physical calls, complete and persist a valid edition, recover after a lost
  completion response, read it and select it. Assert success without a new
  provider-name eligibility list, generic workflow function change or storage
  schema change; AC8-2 repeats the automatic route. Separately exercise an
  allowed primary/secondary pairing and reject an invalid pairing, disabled
  or capability-denied provider, wrong tenant/claim, invalid lineage,
  mismatched record ID/URL/cover and denied/expired retention. Shared creation
  for this additional-provider fixture requires `shared_catalogue_allowed`
  and a test-only recorded Q18 approval; Google
  remains denied even with `storage_allowed=true`. Repeat AC7-2b's ISBN
  convergence and no-ISBN separation through this full admitted path.
  All existing authority,
  receipt and bounded-routing checks survive (D32, D35, R04, R05, R07, R09).
- AC8-10: Given the pass-2 activation/rollback sequence and compatibility
  matrix above, then fixture-backed database/worker tests prove every row for
  old and new workers, including existing-row seed values, current selections,
  migration before worker, in-flight/lost-response completion and a rollback
  after Google is off. No capability default silently breaks the running
  route, no duplicate physical call/accounting occurs, no job stays stranded,
  and rollback makes no Google call or implicit Google reactivation. If split,
  8a passes its migration/old-worker cases before it ships; 8b passes switch
  and rollback cases before activation (D25, D32, R05, R06).

**Tests first:** Server — Open Library automatic adapter, order, clues, retry,
switches and recorded subjects → categories fixture (AC8-8; faked HTTP, no
live calls). Database — local match with hidden rows,
registry capabilities, full synthetic-provider cycle and negative fences
(AC8-9), shape/policy volatility separation and contract parity; database/worker
compatibility matrix, in-flight recovery and rollback fixtures (AC8-10).
Worker build.
**Size / risk:** L / med. Main risk: Open Library quality and rate limits;
deploying the worker is a separate Owner approval.

---

## Slice 9 — Relaxed automatic match, tie pick, saved results

**Goal:** more books get the right edition automatically, and the sheet opens
with choices already there (D26, D28, D30).

**Scope:**
- The automatic path uses the explicit-search rules (DOC-3 §5.2.1 rules 1–9;
  `explicitEditionTitle.ts` and the SQL mirror M76/M77) (D26).
- Clear match → select it with its cover. Tie → select the best by: same
  language → publisher matches the clue → times chosen → has cover → has ISBN →
  provider order. No match → nothing (D28).
- The first lookup's results (up to 10) are saved as the card's edition
  options, language matches first and others under "Other languages"; opening
  the sheet shows them with no new request; "Search again" re-runs with the
  card's current title and author (D30). Saved options follow the existing
  24-hour option expiry; an expired list falls back to a fresh search.
- **Benchmark gate (D38):** the saved real spine readings ([`data/benchmark-spine-readings-2026-10-18.json`](./data/benchmark-spine-readings-2026-10-18.json), 85 entries), with saved provider
  fixtures, are run through the automatic path; the slice is switched on only
  when wrong-edition picks stay at or below a threshold the Owner approves in
  pass 2 (match rate is reported but is not the gate). The benchmark runs
  offline from fixtures.
**Not in scope:** fuzzy search; next page.

**Depends on:** slice 8.
**Migration:** maybe (the SQL eligibility mirror must accept the automatic
path's rows; saving automatic results into `phase9_candidate_edition_state`).
**Code pointers:** `metadata/explicitEditionTitle.ts`,
`metadata/googleBooks/ranking.ts` (replaced or generalized),
`runtime/metadataEditionOptions.ts`, `phase9_edition_option_eligible` (M76/M77),
`phase9_candidate_edition_state` (M65), the saved spine readings (copied into a
test fixture with recorded provider responses in pass 2).

**Acceptance checks:**
- AC9-1: Given the benchmark, then wrong-edition picks are at or below the
  approved threshold before the switch is turned on (D38).
- AC9-2: Given a tie, then the selected edition follows the tie order exactly
  (D28).
- AC9-3: Given no edition in the card's language, then only editions the
  existing language rule allows (unknown language after a full text match,
  `explicitEditionLanguageMatches`) can be picked by the tie order; editions
  in a different known language never pass (D26) and are only listed under
  "Other languages" for display (D28, D30).
- AC9-4: Given a completed automatic lookup, when the Owner opens the sheet,
  then the saved results show without a new request (D30).
- AC9-5: Given the Owner changed the title, when they press Search again, then
  a new search runs with the new title and the old list is gone (D07, D30).
- AC9-6: Given worker and SQL rules, then they agree on every benchmark and
  parity case (R07).

**Tests first:** Server — tie order, language grouping, benchmark harness.
Database — eligibility parity, saved options. Jest — sheet shows saved
options.
**Size / risk:** M / med.

---

## Traceability (pass 1)

| Decision | Slice | Acceptance checks |
|---|---|---|
| PSR-D25 | 8 | AC8-1, AC8-2, AC8-10 (planned: activation/rollback matrix fixtures) |
| PSR-D26 | 9 | AC9-6 |
| PSR-D27 | 8 | AC8-3, AC8-4 |
| PSR-D28 | 8, 9 | AC8-4, AC9-2, AC9-3 |
| PSR-D22 | 8 | AC8-7 |
| PSR-D29 | 7, 8 | AC7-9, AC8-7 |
| PSR-D30 | 9 | AC9-3 to AC9-5 |
| PSR-D31 | 8 | AC8-5, AC8-6 |
| PSR-D32 | 8 | AC8-2, AC8-9 (full synthetic-provider cycle), AC8-10 |
| PSR-D33 | 7, 8 | AC7-7, AC7-9, AC8-1 |
| PSR-D34 | 6 | AC6-1 |
| PSR-D35 | 6, 7, 8 | AC6-1 to AC6-4, AC7-1, AC7-2/2b/2c/2d/2e/2f, AC7-8, AC7-10, AC8-9 |
| PSR-D36 | 7 | AC7-4, AC7-5, AC7-2e |
| PSR-D37 | 6, 7 | AC6-5, AC7-3, AC7-6 |
| PSR-D38 | 9 | AC9-1 |
| PSR-D39 | 7 | AC7-1, AC7-2e |
| PSR-D40 | 6, 7 | AC6-6, AC7-2b/2c, AC7-7 |
| PSR-D43 | 8 | AC8-8 (planned server test: recorded Open Library work-subjects fixture normalizes to categories) |
