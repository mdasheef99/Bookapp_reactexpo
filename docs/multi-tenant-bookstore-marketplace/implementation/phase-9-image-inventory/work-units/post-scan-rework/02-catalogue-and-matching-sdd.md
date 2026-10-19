# Post-Scan Rework — SDD-2 Catalogue and Matching (slices 6–9)

**Status:** `pass_1_outline_approved` (2026-10-19). Owner approved the SDD set with the §14 defaults on 2026-10-19. Pass 2 is written immediately
before slice 6 starts.
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
columns) → slice 7 (new columns, catalogue writes, stats, shared cache) →
slice 8 (Open Library automatic provider, clues, Google off) → slice 9
(relaxed match, tie pick, saved results) behind the benchmark.

---

## Slice 6 — Catalogue link at Add

**Goal:** every added book points at its catalogue edition when one can be
identified (D34).

**Scope:**
- Inside `phase9_add_candidate_to_inventory_v1` (the current Add; slice 13
  keeps the same helper), after the eligibility check and before the inventory
  insert, call a new `SECURITY DEFINER` helper that finds or creates the
  catalogue work and edition for the chosen edition and returns their IDs.
- Identity: normalized, checksum-valid ISBN-13 (ISBN-10 converted). If the
  chosen edition has both and they disagree, no link. Without an ISBN, no link
  in this slice (the Open Library edition-ID column arrives in slice 7).
- **Only Open Library-sourced choices may create shared rows** (D35, R05);
  a choice whose snapshot already carries a catalogue ID just links; Google and
  manual choices never create.
- Shared rows take bibliographic facts from the provider snapshot only, never
  from the Owner's review (D40, R04).
- Concurrency: `INSERT … ON CONFLICT DO NOTHING` on the existing unique keys
  (`isbn_13`; works `title_normalized, primary_authors`), then re-select, so two
  stores adding the same edition at once converge on one row.
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
**Amends:** DOC-3 §5.2 picker sentence ("does not promote canonical truth")
and §17 ("automated canonical merge without review" — allowed only on exact
ISBN-13 / Open Library edition ID).

**Acceptance checks:**
- AC6-0: Given the same book added with authors in a different order or
  case, then both inventory rows link to one catalogue work (F46).
- AC6-1: Given an Open Library edition with a valid ISBN chosen in the sheet,
  when the book is added, then a catalogue work and edition exist and the
  inventory row links both (D34, D35).
- AC6-2: Given a second store adds the same ISBN, then it links to the same
  catalogue edition and no new edition row is created (D35).
- AC6-3: Given two stores add it at the same moment, then exactly one edition
  row exists (D35).
- AC6-4: Given a Google-sourced or manual choice, then no catalogue row is
  created and the Add succeeds with no link (D35, R05, R10).
- AC6-5: Given ISBN-10 and ISBN-13 that disagree, then no link and the Add
  succeeds (D37).
- AC6-6: Given the Owner edited the title, then the catalogue row has the
  provider's title and the inventory row has the Owner's (D40, R04).
- AC6-7: Given a replayed Add, then the original inventory ID is returned and
  nothing new is created (R01).

**Tests first:** Database (`supabase/tests/phase9/`, new catalogue-link suite)
for AC6-1 to AC6-7; existing commit suites stay green
(`phase9Unit7aCreateOnlyCommit`, `phase9EditionPickerCommit`).
**Size / risk:** M / med.

---

## Slice 7 — Lean catalogue writes, stats and shared cache

**Goal:** Open Library editions found by any store are kept, so the next store
needs no call (D33, D39); usage counts guide ordering (D36).

**Scope:**
- Additive columns: on `canonical_editions` — Open Library edition ID (unique),
  Open Library work ID, Open Library cover ID, OCLC and LCCN, hidden flag,
  one source-and-retention note, normalizer version; on `canonical_works` —
  Open Library work ID (unique) and author IDs. Existing columns are reused
  for bibliographic facts and `categories`.
- One `book_metadata_sources` row per provider record (`open_library`, edition
  ID), slim normalized payload only (Open Library raw retention is 0), with
  `expires_at` / retention note.
- Stats table(s) with no store column: times searched (work), times chosen and
  times added (edition), incremented without locking catalogue rows (D36).
- ISBN check digit and a small blocklist (placeholder and known-reused ISBNs)
  before any identity use (D37).
- **Write timing (D39):** editions that pass the relaxed title-and-author match
  are written when the Open Library lookup completes; "chosen" counts on
  selection; "added" counts on Add. Design study 1 argued for writing only at
  Add; pass 2 measures expected growth and keeps D39 unless it finds a
  technical blocker (SDD-0 §14 Q3), in which case it returns to the Owner.
- Hidden records are excluded from lookups but existing links stay.
- Shared cache: the worker writes `public_bibliographic` cache entries (no
  store) only when both the query key and the payload are provider or scan
  facts. A query built from Owner-confirmed text (F43) stays in the
  store-private cache, so no Owner edit reaches a shared key (D40, R04).
  Tests compare keys and payloads across two stores (F18, F35).
- Slice 6's helper extends to Open Library edition-ID identity and source rows.
**Not in scope:** per-field provenance, change log, fuzzy (`pg_trgm`) search
(SDD-0 §5); admin tooling beyond the hidden flag.

**Depends on:** slice 6.
**Migration:** one. Pass 2 may split into 7a (columns, stats, link by Open
Library ID) and 7b (lookup-time writes and shared cache) if one session is not
enough.
**Code pointers:** `metadata/openLibrary/normalizer.ts` (IDs, cover),
`runtime/metadataEditionOptions.ts`, `runtime/metadataTerminalPersistence.ts`,
`runtime/metadataProductionGateway.ts` (cache scope), `phase9_store_metadata_cache`
(M15), `phase9_edition_local_match` (M67), `domain/isbn.ts`.

**Acceptance checks:**
- AC7-1: Given a lookup returns 6 Open Library editions of which 4 pass the
  relaxed match, then 4 editions (and their work) are in the catalogue with one
  source row each (D35, D39).
- AC7-2: Given an edition without ISBN but with an Open Library edition ID,
  then it is stored once and a second store reuses it (D35).
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

**Tests first:** Database — catalogue writes, ON CONFLICT convergence,
blocklist, stats, hidden, cache scope. Server — normalizer IDs, cache-scope
choice (faked HTTP).
**Size / risk:** L / med.

---

## Slice 8 — Open Library first, clues, Google off

**Goal:** the automatic lookup goes catalogue → Open Library and uses the ISBN
and publisher Gemini already reads (D25, D27).

**Scope:**
- Automatic order: catalogue (local match on ISBN, Open Library ID or exact
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
**Not in scope:** relaxed rules and tie pick for the automatic path (slice 9);
paid providers.

**Depends on:** slice 7.
**Migration:** maybe (registry rows and any Google-specific SQL predicate
still in the edition-completion function, F34). Pass 2 may split into 8a
(Open Library automatic adapter and order) and 8b (clues and protection).
**Code pointers:** `workers/phase9-metadata-worker/bootstrap.ts`, `index.ts`,
`editionProviderRoute.ts`; `runtime/metadataGatewayContext.ts`,
`runtime/metadataProductionComposition.ts`, `runtime/metadataProductionGateway.ts`;
`metadata/openLibrary/adapter.ts`, `transport.ts`, `normalizer.ts`;
`metadata/googleBooks/ranking.ts`; `phase9_metadata_job_context` (M32/M38);
`phase9_provider_registry`.

**Acceptance checks:**
- AC8-1: Given a book already in the catalogue, then no provider call is made
  and the card shows the catalogue edition (D25, D33).
- AC8-2: Given a new book, then exactly one Open Library lookup runs (within
  its request budget) and no Google request is made (D25, R05). Given a faked
  second adapter registered and enabled in the registry instead, then the
  automatic path uses it with no change to storage, review or Add (D32).
- AC8-3: Given a valid ISBN clue, then the ISBN lookup runs first and its
  edition is selected when it matches (D27).
- AC8-4: Given two equal editions and a publisher clue matching one, then that
  one ranks first (D27, D28).
- AC8-5: Given Open Library returns 429 then succeeds, then the lookup
  succeeds after backoff; given both providers are down, then the card has no
  edition, retries once, and manual search still works (D31, R10).
- AC8-6: Given the per-store search cap is reached, then lookups for that store
  pause with a clear reason and other stores are unaffected (D31).
- AC8-8: Given an Open Library work with subjects, then the normalized
  edition carries them as categories (F40, D43).
- AC8-7: Given an edition with no Open Library cover, then the card shows the
  placeholder and no Google cover; the scan photo is never used (D22, D29).

**Tests first:** Server — Open Library automatic adapter, order, clues, retry,
switches (faked HTTP; no live calls). Database — local match with hidden rows,
registry switch. Worker build.
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
| PSR-D25 | 8 | AC8-1, AC8-2 |
| PSR-D26 | 9 | AC9-6 |
| PSR-D27 | 8 | AC8-3, AC8-4 |
| PSR-D28 | 8, 9 | AC8-4, AC9-2, AC9-3 |
| PSR-D22 | 8 | AC8-7 |
| PSR-D29 | 8 | AC8-7 |
| PSR-D30 | 9 | AC9-3 to AC9-5 |
| PSR-D31 | 8 | AC8-5, AC8-6 |
| PSR-D32 | 8 | AC8-2 (faked second adapter) |
| PSR-D33 | 7, 8 | AC7-7, AC8-1 |
| PSR-D34 | 6 | AC6-1 |
| PSR-D35 | 6, 7 | AC6-1 to AC6-4, AC7-1, AC7-2 |
| PSR-D36 | 7 | AC7-4, AC7-5 |
| PSR-D37 | 6, 7 | AC6-5, AC7-3, AC7-6 |
| PSR-D38 | 9 | AC9-1 |
| PSR-D39 | 7 | AC7-1 |
| PSR-D40 | 6 | AC6-6 |
