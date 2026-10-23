# Post-Scan Rework — Slice 5 Typed ISBN (5a edition sheet, 5b "Add a book")

| | |
|---|---|
| **Status** | Draft, full design for 5a and 5b (2026-10-22). **Approved by the Owner 2026-10-22, with D5-1 to D5-6 as recommended.** Reviewed twice (Sonnet, then DeepSeek; Argon unavailable both times), all verified findings applied (§17). **5a implemented locally 2026-10-23** (branch `claude/phase9-psr-slice5a-typed-isbn`; two code-review rounds; one Owner-approved §8 clarification; evidence in tracker 38 §27). **M78 applied to the development project 2026-10-23** (SQL editor, no `schema_migrations` row; tracker 38 §28). **5b implemented locally 2026-10-23** (branch `claude/phase9-psr-slice5b-add-isbn`, uncommitted; tracker 38 §29-§31). The worker and the Edge function are **not deployed** and the combined in-app acceptance check (AC5a-1, AC5a-16c, AC5b-1, AC5b-4, AC5b-6) has **not run**. |
| **Build** | Two parts from this one SDD: 5a, then 5b; one branch and PR each (SDD-1 §8, PSR-R12). |
| **Parent** | [SDD-1 §7](./01-review-screen-sdd.md) (design direction) under [SDD-0](./00-overview-sdd.md) |
| **Decisions** | PSR-D06, PSR-D07, PSR-D10, PSR-D13; rules PSR-R06, R07, R09, R10, R14 |
| **Size / risk** | 5a: L / high (one migration; database, Owner API, worker, app). 5b: S–M / med (app only, no migration). |
| **Review** | Complex SDD (state machine, identity fences, multi-request flow): Opus and OpenCode Go Argon, read-only (SDD-0 §15). |

This document turns SDD-1 §7 into a design that can be built. It owns slice 5
(both parts). Sections 1–14 are 5a; section 15 is 5b. When it is approved, SDD-1
§7 is reduced to a pointer here. It does not change any other slice.

## Contents

1. Goal and Owner experience
2. Order and authority
3. Verified baseline (2026-10-21)
4. Design summary
5. Database (migration M78)
6. Worker
7. Owner API (Edge)
8. App
9. Failure and recovery
10. Compatibility and rollout
11. Acceptance checks
12. Tests written first, by layer
13. Done means
14. Open decisions for the Owner
15. Slice 5b — optional ISBN in "Add a book"
16. Corrections to SDD-1 §7 citations
17. Review record

## 1. Goal and Owner experience

The Owner can type the ISBN printed on a book to get that exact edition (PSR-D06).

**5a, the edition sheet.** On a card, the Owner presses **Find or change edition**.
The sheet now shows, above Search Books:

- a text box labelled **ISBN** with the hint "On the back cover, above or below the
  barcode";
- a button **Search by ISBN**.

The Owner types 10 or 13 digits (spaces and hyphens allowed, `X` allowed as the
last character of an ISBN-10) and presses Search by ISBN.

- A bad check digit is reported at once, under the box, and nothing is sent
  (AC5a-2).
- Otherwise the app saves the ISBN on the card, starts a lookup by that ISBN only,
  and lists the result. The exact edition shows with its cover; the Owner chooses
  it like any other edition, and the card is filled (AC5a-1).
- If nothing is found, the sheet says "No book was found for ISBN 978…" and the
  card keeps its title and author (AC5a-3).
- While an ISBN is saved, the sheet shows "Searching by ISBN 978…" and a
  **Search by title instead** button that clears it (AC5a-12).

Search Books by title and author is unchanged when no ISBN is saved.

## 2. Order and authority

- SDD-0 §7.2a places slice 5 in Stage 3, after slices 11 and 13. Building it
  first is an Owner reorder decision. It must be recorded in SDD-0 §7.2a and
  DOC-13 before 5a code starts (§14 D5-1).
- Slice 5 depends on slices 2 and 4. 4a (PR #27) and 4b (uncommitted) must be
  green, recorded and approved first (SDD-0 §7.3 guardrail 3).
- Approval of this SDD does not authorize code. The migration needs three
  separate approvals: create the file, apply it, and deploy.
- 5a is risky (SQL, server contracts, identity fences), so it uses the full
  two-round review loop (SDD-0 §15).

## 3. Verified baseline (2026-10-21)

Read in the code on branch `claude/phase9-psr-slice4b-sdd-ffa027` and, read
only, on project `ahntbtktjjmvfosgkmgn` (Supabase MCP). Live migration history
matches the repository through M77 (`20261017083206`).

| # | Fact | Source |
|---|---|---|
| B1 | Every edition check uses one SQL function, `marketplace_sec.phase9_edition_query_identity(candidate)`: request (M75 L94–99), completion fence (M68 L81–83), lookup and attempt registration (M68 L306, L329), usage and call registration (M68 L352, L386), cleanup (M73 L162), choices (M73 L110, L146), select (M71 L31; M73 L190), commit (M69 L23, L68), trigger (M69 L325). | migrations |
| B2 | The identity is an 8-item JSON array: `[lookupVersion, normalizerVersion, mode, isbn13, title, authors, language, publisherClues]`. Mode is `isbn` only when title and authors are both empty (M55 L9–30; worker `queryIdentity.ts` L57–60). | M55, worker |
| B3 | The edition job context (`marketplace_sec.phase9_edition_worker_context`, latest body M73 L236–285; it supersedes M67 and adds the provider list for both providers and `currentLookupAdapterKey`/`currentAttemptAdapterKey`, which `editionProviderRoute.ts` L11 uses) sends the worker `title`, `authors`, `isbnClue = observed_isbn_clue`, `publisherClue`, `inputId`, `observationId` and `language = identity[6]`. The worker rebuilds the identity from these and throws `P9_METADATA_QUERY_IDENTITY_MISMATCH` if it differs (`metadataGatewayContext.ts` L98–111). | M73, worker |
| B3a | The worker's context decoder requires a non-empty `title`, `inputId` and `observationId` (`metadataText`, `metadataJobContext.ts` L90–92, L151–153); any empty or null value throws `P9_METADATA_CONTEXT_INVALID`. A hand-added card has a null `input_id` and `analysis_observation_id` (M5 L145–146), so its edition search fails in the worker today. Live (2026-10-22): all 11 edition jobs ever run were for scanned cards. | worker, M5, live SQL |
| B4 | The Open Library adapter already searches `search.json?isbn=` when the title is empty (`openLibrary/adapter.ts` L39–41). It then reads the first 10 editions of the work (`limit=10`, L53–56). An edition outside those 10 is never found (F29). | worker |
| B5 | The transport allows only `search.json`, `/works/OL…W/editions.json` and `/authors/OL…A.json`, and refuses redirects (`transport.ts` L18–22, L42). `/isbn/{isbn}` answers 302 to `/books/OL…M` (checked 2026-10-21). | worker, live HTTP |
| B6 | `search.json?isbn=9780140449136&fields=key,author_key,editions,editions.key` returns the work and the matching edition key `/books/OL7355481M` in one call with no redirect (checked 2026-10-21). `/isbn/…` resolved to a different duplicate record (`OL23140636M`), so the search result is the one to trust. | live HTTP |
| B7 | Provider-call stages are checked in SQL: sequence 0 `search`, 1 `editions`, 2–5 `author:OL…A`, in the register function (M74 L136–143) and in the table check `phase9_edition_http_stage` (M73 L509–515). Completion requires a sequence-1 `editions` call whenever rows are returned (M74 L93–106). | M73, M74 |
| B8 | The worker sends Open Library only when its policy allows; Google is used only when `optionsRetentionConfigured` (`editionProviderRoute.ts`). Both providers are `enabled` and `matching_allowed` live; the Google ISBN path already queries `isbn:` when the title is empty (`googleBooks/request.ts` L17–23). | worker, live |
| B9 | Language: `phase9_edition_option_eligible` already lets an exact ISBN pass when the query language is `und`, but only by comparing the record's `isbn13` (M76 L83–94). The worker allows `exactIsbn && und` (`explicitEditionTitle.ts` L98). | M76, worker |
| B10 | With an empty title and no authors, `phase9_edition_identity_compatible` accepts a record only on an exact ISBN match (M65 L147–165). | M65 |
| B11 | The trigger `phase9_edition_identity_change` (M67 L317–319, body M69 L307–335) fires on review and observed-field updates. Its first branch keeps a coherent edition choice; otherwise a change of identity resets the edition state, bumps `metadata_revision`, clears `review_ready` and sets `metadataChoice` to manual. | M67, M69 |
| B12 | Template for an Owner command: `phase9_update_candidate_review_v2` (M62 L73–135): lock the session with `phase9_owner_ux_lock_active_session` (owner, store owner, mutable), lock the candidate `FOR UPDATE`, require `candidate.store_id = session.store_id`, check versions, replay through `phase9_idempotency_keys`, `version = version + 1`. | M62, M54 |
| B13 | Live helpers: `phase9_metadata_normalized_language('und') = 'und'`; `phase9_metadata_normalized_isbn13` accepts ISBN-10 and ISBN-13 and is immutable. The ISBN-only key renders as `["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "isbn", "978…", "", [], "und", []]`. | live SQL |
| B14 | The app has no ISBN validator; the shared one is `supabase/functions/_shared/imageInventory/domain/isbn.ts` (`normalizeIsbnClue`, ISBN-10 to 13). | app, worker |
| B15 | Edition requests reach SQL through Edge `ownerEditionPickerGateway.ts` (L51–68). Choices responses are built by `marketplace_sec.phase9_edition_choices` (latest M76 L133–160; also returned by select, M73 L222) and decoded strictly by older apps. The existing extra field (reasons) is included only when `x-client-info` **equals** `bookconnect/edition-reasons-v1` (M76 L140–141); Edge forwards the header only on that exact value (gateway L9–12); the app sends one value per call (`ownerUxTransport.ts` L199). | Edge, app, M76 |
| B15a | After every edition action except the request, the gateway requires the response to carry `candidateId` and `sessionId` equal to the request's (gateway L84–93), else `P9_INTERNAL_ERROR`. Actions are recognized by `isOwnerEditionPickerAction` (L19–23). | Edge |
| B15b | `phase9_edition_assert_owner_candidate` (M65 L190–202) already locks the session (owner, store owner, mutable) and the candidate, checks the store, the states `ready`/`needs_review`/`possible_duplicate`, not committed, not expired and not removed. | M65 |
| B15c | A new card's `owner_review_snapshot` is null until its first review save (M2 L143; M5 insert), which creates `{value:{originalTitle,…}}` (M62 L120–122). | M2, M5, M62 |
| B15d | `service_role` may update the candidates table but may not execute `phase9_metadata_normalized_isbn13` (live, 2026-10-22). | live SQL |

## 4. Design summary

1. **Store the ISBN on the card.** New nullable column `owner_isbn13` on
   `image_extraction_candidates`. It sits beside the observed fields and never
   overwrites them (SDD-1 §7).
2. **One identity rule.** While `owner_isbn13` is set, the edition identity is the
   ISBN-only key in B13: mode `isbn`, empty title and authors, language `und`, no
   publisher clue. It is built in `phase9_edition_query_identity` only (B1), so
   every fence follows it. The automatic-match identity
   (`phase9_metadata_candidate_query_identity`) is **not** changed.
3. **The worker needs no new identity code, but its decoder must change.** The
   edition job context sends empty title and authors, `isbnClue = owner_isbn13`
   and language `und`; the worker's existing builder then produces the same key
   (B2, B3, B13). The decoder must accept an empty title, and a null input and
   observation ID, for edition jobs (B3a). The second part also fixes Search
   Books on hand-added cards, which 5b depends on.
4. **Language falls out of the existing rule.** Language `und` plus an exact ISBN
   already passes in SQL and in the worker (B9). M78 widens the SQL check to an
   ISBN-10-only record too.
5. **Exact edition fetch.** In ISBN mode, Open Library reads the matching edition
   key from `search.json` and then fetches `/books/OL…M.json` as a new stage
   `edition` at sequence 1, instead of the 10-edition page. No redirect is
   followed (B5, B6).
6. **Owner command.** `phase9_set_candidate_isbn_v1` sets or clears the ISBN,
   with the B12 template. The app then calls the existing edition request.
7. **Who clears it.** Choosing an edition keeps it. An Owner edit of the title or
   authors clears it (SDD-1 §7). Clearing goes back to title search.

## 5. Database (migration M78)

Proposed file: `supabase/migrations/2026MMDD000078_marketplace_phase9_owner_isbn_edition_lookup.sql`.
Forward only. Additive. One migration (PSR-R12). Owner of every new function:
`postgres`; `SET search_path=''`.

### 5.1 Column

```sql
ALTER TABLE public.image_extraction_candidates
  ADD COLUMN owner_isbn13 text NULL
  CONSTRAINT phase9_candidate_owner_isbn13_shape
  CHECK (owner_isbn13 IS NULL OR owner_isbn13 ~ '^97[89][0-9]{10}$');
```

The check constraint tests the shape only. The check digit is tested in the
command (§5.5), which runs as `postgres`. A check that called
`phase9_metadata_normalized_isbn13` would fail any direct `service_role` write,
because `service_role` cannot execute it (B15d). No backfill: every existing row
is null. Column RLS is inherited; no grant changes.

### 5.2 Identity

`CREATE OR REPLACE marketplace_sec.phase9_edition_query_identity`: the existing body
with one new first statement after the state read:

```sql
IF c.owner_isbn13 IS NOT NULL THEN
  RETURN jsonb_build_array('p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    'isbn', c.owner_isbn13, '', '[]'::jsonb, 'und', '[]'::jsonb)::text;
END IF;
```

Because it returns before the coherent-choice branch, choosing an edition cannot
change an ISBN-mode identity. Choosing writes the edition's title, authors and
language into the review (M73 L218–229); none of them is part of this key.

### 5.3 Edition job context

`CREATE OR REPLACE marketplace_sec.phase9_edition_worker_context`, starting from its
**latest** body (M73 L236–285, not M67). When `c.owner_isbn13 IS NOT NULL`, send
`title = ''`, `authors = []`, `isbnClue = c.owner_isbn13`, `publisherClue = NULL`.
Language already comes from `identity[6]` (`und`). The new body differs from M73
only in those lines; a test compares the two bodies (AC5a-15). The provider list
and the `current*AdapterKey` fields must survive. The automatic-match context
(M32/M38) is untouched.

### 5.4 Trigger

`CREATE OR REPLACE marketplace_sec.phase9_edition_identity_change`, and recreate the
trigger with `owner_isbn13` added to its `UPDATE OF` list (DROP and CREATE in the
same migration).

New rule, placed **before** the "no edition state" early return:

```sql
-- An Owner edit of the title or authors ends an ISBN search (SDD-1 §7, AC5a-10).
IF OLD.owner_isbn13 IS NOT NULL AND NEW.owner_isbn13 IS NOT DISTINCT FROM OLD.owner_isbn13
 AND NOT <coherent edition choice, as in the existing first branch>
 AND (marketplace_sec.phase9_edition_effective_title(NEW)
       IS DISTINCT FROM marketplace_sec.phase9_edition_effective_title(OLD)
   OR marketplace_sec.phase9_edition_effective_authors(NEW)
       IS DISTINCT FROM marketplace_sec.phase9_edition_effective_authors(OLD))
THEN NEW.owner_isbn13 := NULL; END IF;
```

- New private helpers (`IMMUTABLE`, owner `postgres`, no grants):
  `phase9_edition_effective_title(c)` and `phase9_edition_effective_authors(c)`
  return the **review-or-observed** values: the review's `originalTitle` when
  its title confirmation is true, else `observed_title`; the review's `authors`
  when every author is confirmed, else `observed_authors` (the rule in M73
  L256–262). They deliberately leave out the job context's `edition_option`
  override (M73 L264–265), because the clear rule must see what the Owner
  saved, and a chosen edition is already excluded by the coherent-choice
  condition. They are for this rule only (DeepSeek F18). Each is compared
  after `phase9_metadata_normalized_text`, so case and spacing alone never
  clear the ISBN. A saved Owner edit is always visible to them, because a
  review save requires the title and every author to be confirmed
  (`ownerUxReviewSchema.ts` L65–68).
- Comparing effective values, not the raw snapshot, matters: a new card's
  snapshot is null until its first save (B15c). A raw comparison would see
  null → title and clear the ISBN on a save that changed nothing.
- The coherent-choice condition is the existing one (M69 L314–320), with
  `owner_isbn13` added to both `ROW(...)` comparisons. Choosing an edition is
  therefore never mistaken for an Owner edit.
- A save that rewrites the same title and authors (the first save, slice 1
  re-save, Add) does not clear it.
- `owner_isbn13` is **not** added to the observed-field `ROW` in the branch that
  picks the raw identity. A change of `owner_isbn13` falls to the `ELSE` branch
  and compares `phase9_edition_query_identity(OLD)` with `(NEW)`.
- **Any change of `owner_isbn13` forces the reset**, even when the two keys look
  equal, and the key written into the reset state is computed **after** the
  edition choice is dropped:
  1. If `OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13`, first set
     `NEW.owner_review_snapshot` `metadataChoice` to manual (as the existing
     reset does).
  2. Then compute `new_query := phase9_edition_query_identity(NEW)`. With the
     choice now manual, its coherent-choice branch cannot apply, so the result
     is the true post-change key (the ISBN key, or the title key after a
     clear).
  3. Reset the edition state with that key, bump `metadata_revision` and set
     `review_ready=false`, exactly as for an identity change.

  Why: when the Owner clears an ISBN that equals the card's scanned ISBN clue,
  an edition was chosen and the scanned publisher clue is null, the
  coherent-choice branch (M65 L131–136) returns the stored ISBN key for NEW too.
  Writing that key would leave the state on the ISBN key while every later
  check computes the title key, so the next request would fail with
  `P9_VERSION_CONFLICT` and the worker would refuse the job (M75 L99; M67 L51)
  (DeepSeek F14). The test issues the next request and asserts it succeeds
  (AC5a-16).
- **Observed-field branch.** When `NEW.owner_isbn13 IS NOT NULL`, the branch that
  reacts to an observed-field change uses `phase9_edition_query_identity` for
  OLD and NEW instead of the raw identity, so the state never gets a title key
  while the card is in ISBN mode. Nothing updates observed fields on a
  reviewable card today, so this is defensive (DeepSeek F17).
- The reset starts a new request generation and supersedes any running lookup
  (M72).
- A language edit does not clear the ISBN (SDD-1 §7 names title and authors only).

### 5.5 Owner command

```text
public.phase9_set_candidate_isbn_v1(
  p_session_id uuid, p_candidate_id uuid, p_command_id uuid, p_idempotency_key text,
  p_expected_candidate_version integer, p_isbn13 text)  -- null clears
RETURNS jsonb  -- {sessionId, candidateId, candidateVersion, metadataRevision,
               --  requestGeneration, ownerIsbn13}
SECURITY DEFINER; EXECUTE granted to authenticated only.
```

The response carries `sessionId` and `candidateId` because the gateway checks
them on every edition action except the request (B15a).

In order:

1. Input checks, as every sibling command: `p_command_id IS NOT NULL`;
   `p_idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'`; `p_isbn13 IS NULL` or
   `p_isbn13 ~ '^97[89][0-9]{10}$'` with
   `phase9_metadata_normalized_isbn13(p_isbn13) = p_isbn13` (check digit). Any
   failure is `P9_REQUEST_INVALID`. The app converts ISBN-10 before sending.
2. Replay: `phase9_replay(auth.uid(), 'EP_ISBN_V1', p_idempotency_key, fingerprint)`
   with a SHA-256 fingerprint of session, candidate, expected version and ISBN.
   An exact replay returns the stored result. A different request with the same
   key raises `P9_IDEMPOTENCY_MISMATCH`. A client retry must therefore resend
   the same expected version it used first (§8, §15.3).
3. `c := phase9_edition_assert_owner_candidate(p_session_id, p_candidate_id)`
   (B15b). It locks the session, then the candidate, derives `store_id` from the
   session, and refuses committed, expired, removed or non-reviewable cards
   (`ready`, `needs_review` — the state of a hand-added card — and
   `possible_duplicate`) with `P9_STATE_CONFLICT`, an unknown card with
   `P9_NOT_FOUND` and a non-owner with `P9_OWNER_NOT_AUTHORIZED`. The lock order
   (session, candidate, then edition state) is the same as the request and
   select commands.
4. `P9_CANDIDATE_VERSION_CONFLICT` if `version <> p_expected_candidate_version`.
5. If the value is unchanged: finish the replay and return the current values
   with no write.
6. Ensure the edition-state row exists, inserted with the card's current
   (pre-ISBN) identity as the request RPC does (M75 L96), then
   `UPDATE … SET owner_isbn13 = p_isbn13, version = version + 1,
   updated_at = transaction_timestamp()`, as sibling commands do. The trigger
   then resets the edition state to the new key and bumps `metadata_revision`
   (§5.4).
7. Finish the replay; return the ids, the new versions and `requestGeneration`.

The app then calls the existing `phase9_request_candidate_edition_options_v1` with
the returned `requestGeneration`. Its identity check (M75 L94–99) now reads the
ISBN key, so it needs no change.

### 5.6 Language eligibility

`CREATE OR REPLACE marketplace_sec.phase9_edition_option_eligible` (M76 L83–94): the
`und` exact-ISBN exception also accepts a record whose `isbn10`, converted, equals
the query ISBN:

```sql
IF original->>6='und' AND original->>3 IS NOT NULL
 AND original->>3 IN (marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn13'),
                      marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn10'))
THEN q:=jsonb_set(q,'{6}',p_metadata->'language'); END IF;
```

This is the one ISBN-only language rule for SQL and the worker (SDD-1 §7): an exact
ISBN is eligible in any language. B10 already restricts an ISBN-mode search to
exact matches, so this cannot admit a different book.

The ISBN-10 widening is **defensive**: today the worker always derives `isbn13`
from a valid `isbn10` (`domain/isbn.ts` `validateIsbnPair`; `openLibrary/normalizer.ts`
L62), so an ISBN-10-only row does not reach SQL. Its test uses a hand-built
fixture. The display-only `phase9_edition_rejection_reason` keeps comparing
`isbn13` only; it never changes eligibility.

### 5.7 Provider-call stages

- The register function (M74 L136–143) accepts a new pair, sequence 1 and stage
  `edition`, only when the lookup's identity mode is `isbn`
  (`identity::jsonb->>2 = 'isbn'`). That mode rule can live only in the register
  function.
- The table check `phase9_edition_http_stage` (M73 L509–515) is widened to allow
  `(1,'edition')`, with `DROP CONSTRAINT` and `ADD CONSTRAINT` in the same
  migration; existing rows satisfy it.
- Completion (M74 L93–106): when rows are returned, sequence 1 may be `editions`
  or, in ISBN mode, `edition`.
- No other stage, count or budget changes: the most GETs per job stays 6.

### 5.8 Readback after application

Column and check exist; the function bodies match the file; the trigger
`UPDATE OF` list includes `owner_isbn13`; `anon` cannot execute the new RPC,
`authenticated` can; the two new helpers have no grants; zero rows have
`owner_isbn13` set. Recorded in the migration ledger.

Functions M78 replaces or adds, and nothing else:

| Function | Change |
|---|---|
| `phase9_edition_query_identity` | ISBN-only key first (§5.2) |
| `phase9_edition_worker_context` | ISBN-mode fields, from the M73 body (§5.3) |
| `phase9_edition_identity_change` + trigger | clear rule, forced reset, `UPDATE OF` (§5.4) |
| `phase9_edition_effective_title`, `phase9_edition_effective_authors` | new private helpers (§5.4) |
| `phase9_set_candidate_isbn_v1` | new command (§5.5) |
| `phase9_edition_option_eligible` | ISBN-10 in the `und` exception (§5.6) |
| `phase9_register_edition_options_provider_call_v1` (private), `phase9_complete_candidate_edition_options_v1` (private), constraint `phase9_edition_http_stage` | `edition` stage (§5.7) |
| `phase9_edition_choices` | `ownerIsbn13` behind the v2 capability (§7) |

## 6. Worker

- **Context decoder** (`runtime/metadataJobContext.ts`): for
  `purpose === 'edition_options'` only, accept `title === ''` and a null
  `inputId` and `observationId` (B3a). The automatic-match purpose keeps the
  strict rules. `fresh()` in `metadataEditionProviderCalls.ts` uses the same
  decoder and needs no other change. This also makes Search Books work for
  hand-added cards (AC5a-17).
- **Identity:** no change. With the context in §5.3, `requestFromMetadataContext`
  builds the B13 key (strategy `isbn` because the title and authors are empty).
- **Open Library adapter, ISBN mode** (`query.normalizedTitle === ''` and
  `normalizedIsbn13` set):
  1. `search.json?isbn=…&limit=1&fields=key,author_key,editions,editions.key,editions.isbn`
     (stage `search`, sequence 0).
  2. Choose the `editions.docs[]` entry whose key matches
     `^/books/OL[1-9][0-9]*M$` **and** one of whose `isbn` values normalizes to
     the query ISBN-13. Never take an entry by position. If there is none, the
     outcome is `no_acceptable_match` (DeepSeek F15). Live, 2026-10-22: for
     `9780140449136` and for `9780261102217` (*The Hobbit*, a work with many
     editions), `editions.docs` held only the edition carrying that ISBN; the
     ISBN match keeps this safe if the search ever returns more.
  3. `GET /books/OL…M.json` (stage `edition`, sequence 1). Its body has the same
     shape as one `editions.json` entry, so the existing normalizer maps it to one
     row at ordinal 0.
  4. Authors as today (sequences 2–5, at most 4).
- **Transport:** the allowlist gains `^/books/OL[1-9][0-9]*M\.json$` only.
  `redirect:'error'` stays; nothing new needs a redirect (B6). Every GET keeps the
  existing fence, spacing (1 s), accounting, response-size cap and the
  retention-header check (`boundOptionsRetentionEvidence`, adapter L33). Live,
  2026-10-22: `/books/OL7355481M.json` answered 200 with `application/json` and
  no `no-store`/`no-cache`, the same headers as `editions.json`.
- **Google:** no change. Its ISBN query already exists (B8). It is used only where
  options retention is configured.
- **Effect on scanned cards with only an ISBN clue:** they already search by ISBN;
  they now get the exact edition instead of the first 10 of the work. This is
  intended (PSR-D06).

## 7. Owner API (Edge)

- `ownerEditionPicker.ts` (app and shared copies): new action
  `set_candidate_isbn` with `{contractVersion, sessionId, candidateId, commandId,
  idempotencyKey, expectedCandidateVersion, isbn13: string|null}`, strict, ISBN as
  `^97[89][0-9]{10}$` or null; response schema for §5.5, including `sessionId` and
  `candidateId`.
- **Registrations** (every place an edition action is listed):
  `isOwnerEditionPickerAction` (gateway L19–23); the Edge request dispatch
  (`contracts/ingestion.ts` L98–103 and `ownerUxRequests.ts`); the gateway RPC
  switch (L51–68), routing to `phase9_set_candidate_isbn_v1` with the existing
  safe-error mapping; the app's request decode (`ownerUxRequestContracts.ts`),
  response action union (`ownerUxContracts.ts` L181), transport error set
  (`ownerUxTransport.ts` per-action errors, L64–66 and L174–180) and the
  edition cross-check (L211–213). The post-check (B15a) stays as it is; the
  response satisfies it.
- **Capability for `ownerIsbn13`** (decided here, not in the brief): a new
  `X-Client-Info` value `bookconnect/edition-reasons-v2`, a superset of v1
  meaning "reasons and owner ISBN".
  - `phase9_edition_choices`: reasons are included when the header is v1 **or**
    v2; `ownerIsbn13` is added only for v2.
  - Edge `editionPickerRpcHeaders` forwards the header when it is exactly v1 or
    exactly v2.
  - The new app sends v2 on **both** the choices read and the select command
    (today `selectEdition` sends no capability, `ownerEditionPickerService.ts`
    L22–25, and the cache merge after a select keeps only rows and expiry,
    `ownerEditionPickerCache.ts` L45–49, so `ownerIsbn13` would otherwise drop
    until the next read; DeepSeek F20). An older app sends v1 and gets exactly
    what it gets today, so its strict decoder keeps passing (PSR-R06). A test
    proves a v1-only client still gets reasons and no `ownerIsbn13` (AC5a-18).
  - The existing gateway test lists `bookconnect/edition-reasons-v2` as
    unsupported (`phase9_edition_picker_gateway.test.ts` L181); it is updated in
    the same change.
  - App and shared choices schemas gain `ownerIsbn13` as optional (string or
    null) so one schema decodes both shapes.
  - A single new value avoids parsing a list of tokens in SQL and Edge.

## 8. App

- **ISBN helper:** `src/features/imageInventory/review/isbn.ts`, a copy of the
  shared `normalizeIsbnClue` rules (strip spaces and hyphens; ISBN-10 with `X`;
  convert to ISBN-13; check digit). A parity test runs both on the same table.
  **Clarification (Owner, 2026-10-23):** the ISBN box also rejects a 13-digit
  value that does not start with 978 or 979, with the same "Check the ISBN"
  message, before any command. This matches the column check (§5.1), the
  command's input check (§5.5) and the wire schema (§7). The shared
  `normalizeIsbnClue` used by the automatic scan path is unchanged.
- **Sheet** (`CandidateEditionPicker.tsx`, above Search Books):
  - `TextInput` with `accessibilityLabel="ISBN"`, hint text, `keyboardType`
    suited to digits and `X`, max 17 characters.
  - **Search by ISBN**: validates; on error shows "Check the ISBN; the last digit
    doesn't match" with `accessibilityLiveRegion="assertive"` and sends nothing.
  - On success: if the card has unsaved title or author edits, save them first
    with the **review save alone** (`ownerUxService.updateCandidateReview`), not
    the existing save-then-search mutation, which would also start a title
    search (`ownerEditionPickerQueries.ts` L168–170; DeepSeek F16). Then
    `set_candidate_isbn`, then re-read choices, then exactly one
    `request_candidate_edition_options` with the new generation. A failed
    request after a successful set leaves the ISBN saved and shows Retry search,
    as the existing identity flow does. A test asserts one request, after the
    set.
  - While `ownerIsbn13` is set: "Searching by ISBN 978…" and **Search by title
    instead** (sets null, then the normal Search Books).
  - No result in ISBN mode: "No book was found for ISBN 978…".
- **Card:** no new field. The edition line shows the chosen edition as today.
- **Queries:** a new mutation in `ownerEditionPickerQueries.ts` following
  `identityMutation`. Each press creates one pending record: `commandId`,
  idempotency key, the ISBN and the **expected version read once**. A retry of
  that press resends the same record, so the server replays it instead of
  raising `P9_IDEMPOTENCY_MISMATCH` after the version has moved (§5.5 step 2).
  Choices are refetched after success.

## 9. Failure and recovery

| Case | Server | Screen | Owner's next step |
|---|---|---|---|
| Bad check digit | Nothing sent | Error under the box | Correct the digits |
| Card changed elsewhere | `P9_CANDIDATE_VERSION_CONFLICT` | "This book changed; we reloaded it." | Press Search by ISBN again |
| Card added or removed | `P9_STATE_CONFLICT` | "This book can't be changed now." (slice 4a wording) | Close the sheet |
| Set succeeds, request fails | ISBN saved; no job | Retry search | Retry search |
| Lookup finds nothing | `no_acceptable_match` | "No book was found for ISBN …" | Search by title instead, or check the ISBN |
| Provider error or rate limit | Existing failure receipt (M75 recovery) | Existing retry message | Retry search |
| Owner edits title while ISBN set | Trigger clears ISBN, resets choice | Edition line returns to manual | Search Books, or type the ISBN again |
| Lookup still running when ISBN changes | New generation; old job superseded (M72) | Pending state for the new search | Wait |
| Network loss mid-set | Replay with the same key returns the stored result | Retry | Retry; no double write |

## 10. Compatibility and rollout

- Deploy order: M78, then the worker, then Edge, then the app; each with its own
  approval. **The worker must be live before any app can save an ISBN.**
- Old app with new server: never calls the new action; sends the v1 capability
  and never receives `ownerIsbn13`; every existing card has a null ISBN, so
  identities, fences and matching are unchanged (AC5a-9, AC5a-18).
- Old worker with M78: an ISBN card's context has an empty title, which the old
  decoder rejects (B3a). Its edition job fails closed with
  `P9_EDITION_CONTEXT_INVALID` (`metadataJobContext.ts` L198–203); no wrong data is written. This cannot happen in
  the deploy order above, because no app can save an ISBN before the new worker
  is live. Cards without an ISBN are unaffected.
- New worker before M78: not allowed by the deploy order; the `edition` stage would
  be refused by SQL and the lookup would fail closed. The relaxed decoder alone is
  harmless on the old database.
- Rollback before release: the app can ship without the box; the column and
  functions stay (applied migrations are never edited, PSR-R06).
- **Rollback after release (whole-feature review, 2026-10-23).** Removing the box
  from the app does not remove saved ISBNs or outstanding jobs. Rolling the Edge
  function back to v17 strips the v2 capability and refuses `set_candidate_isbn`;
  choices then omit `ownerIsbn13`, so an existing ISBN card is shown in title mode
  and the Owner cannot see or clear the ISBN, although SQL still searches by it.
  Rolling the worker back leaves ISBN jobs (empty title) and hand-added jobs (null
  lineage ids) that the old decoder rejects; they fail closed and are retried
  until their attempts are exhausted. Before any rollback after release: stop new
  ISBN presses (ship the app without the box first), then list candidates with a
  non-null `owner_isbn13` and outstanding edition jobs, and decide per case; do not
  roll the worker back while ISBN jobs are pending. A compatible older build must
  keep the worker context decoder (`edition_options` purpose) and the Edge
  read/set/clear contract.
- **Deploy checklist (added 2026-10-23).**
  1. The Render metadata worker builds the configured branch `main` only (auto-deploy
     off; the deploy tool cannot pin a commit; tracker 36). The reviewed 5a + 5b
     source must therefore be on `origin/main` first. That needs an explicitly
     authorized push and merge; nothing has been pushed. After deploying, read the
     deployed commit back and confirm it contains the relaxed decoder and the ISBN
     adapter before deploying the Edge function. `/health` alone is not proof.
  2. Worker build is the existing Dockerfile (`npm ci`, then
     `npm run build:phase9:metadata-worker`). Keep its configuration unchanged:
     `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PHASE9_METADATA_WORKER_ID`,
     `PHASE9_METADATA_WORKER_INGRESS_TOKEN`, host, port, concurrency 1, provider
     mode, Google API key, timeout and response-size limits. No ISBN-specific
     secret is added.
  3. Deploy only `phase9-owner-ingestion` to project `ahntbtktjjmvfosgkmgn` with
     `verify_jwt=true` and its configured import map (documented command:
     `supabase functions deploy --project-ref ahntbtktjjmvfosgkmgn --use-api`, name
     the function, never `--no-verify-jwt`). Keep `SUPABASE_URL`,
     `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Read back: ACTIVE new
     version, `verify_jwt` true, OPTIONS 200, unauthenticated POST 401.
  4. M78 was applied through the SQL editor and has no `schema_migrations` row;
     do not re-apply it, and do not treat the missing row as a missing migration.
     The M78 file header still says "File creation only, no live application"; the
     file is not edited because it is applied, and this section is the correction.
  5. Then the combined in-app check. Use at least one ISBN whose work has many
     editions (the Open Library lookup relies on the matching edition being
     embedded in the search response), and assert the provider-call sequence
     `search`, `edition`, then author calls (AC5a-14c).

## 11. Acceptance checks

Given / When / Then; each cites its decision. AC numbers extend SDD-1 §7.

- **AC5a-1** (D06, D10): Given a valid ISBN for a book in Open Library, when the
  Owner presses Search by ISBN, then the exact edition is listed with its cover,
  and choosing it fills the card.
- **AC5a-2** (R07, R09): Given a bad check digit, then the app reports it before
  any request, and the server also rejects a bad ISBN with `P9_REQUEST_INVALID`.
- **AC5a-3** (R10): Given no result, then the sheet says so and the card's title
  and author are unchanged.
- **AC5a-4** (D06): Given an ISBN-10 (including `X`), then the ISBN-13 is saved.
- **AC5a-6** (R14): The box has a label; its error is announced (assertive live
  region); the button has an accessible name.
- **AC5a-7** (D06): Given a correct ISBN on a card whose scanned title is wrong,
  then the exact edition is eligible. Given a foreign-language edition on an
  English-scanned card, it is still eligible (§5.6), including a record with only
  an ISBN-10.
- **AC5a-8** (D06): Given an edition outside the first 10 of its work, then it is
  found (the `/books` fetch).
- **AC5a-9** (R06): Given an older app and cards with no ISBN, then the
  six-argument `phase9_add_manual_candidate`, edition requests without an ISBN,
  and choices responses are unchanged.
- **AC5a-10** (D07): Given a saved ISBN, when the Owner edits the title or authors
  and saves, then the ISBN and any chosen edition are cleared. When the Owner
  chooses an edition, the ISBN is kept. When the same title is re-saved (Add),
  the ISBN is kept.
- **AC5a-11**: Given an ISBN-only query, then the worker and SQL identities are
  equal, the completion fence accepts the result, and cleanup keeps the options.
- **AC5a-12** (D06): Given a saved ISBN, when the Owner presses Search by title
  instead, then the ISBN is cleared and the next search uses the title and author.
- **AC5a-13** (tenant): Given another store's candidate, a different Owner, a
  closed session, or a committed card, then the command is refused and nothing
  changes.
- **AC5a-14** (replay): Given the same command twice, then one write and the same
  result; given the same key with a different ISBN, `P9_IDEMPOTENCY_MISMATCH`.
  Given a **new** key with an unchanged ISBN and a stale version,
  `P9_CANDIDATE_VERSION_CONFLICT` and no write. (The same key with a moved
  version is a different request and gets `P9_IDEMPOTENCY_MISMATCH`, because
  replay runs before the version check, as in M62 L92–110.)
- **AC5a-15** (compatibility): The new `phase9_edition_worker_context` differs
  from the M73 body only in the ISBN-mode title, authors, ISBN clue and
  publisher clue; the provider list and `current*AdapterKey` fields are
  unchanged.
- **AC5a-16** (D06): Given a scanned ISBN clue equal to the Owner's ISBN, a null
  scanned publisher clue and a chosen edition, when the Owner presses Search by
  title instead, then the edition state is reset to the title key, and the next
  `request_candidate_edition_options` **succeeds** and runs by title and author.
- **AC5a-16b** (D06): Given the sheet has unsaved title edits, when the Owner
  presses Search by ISBN, then exactly one edition request is sent, after the
  ISBN is saved.
- **AC5a-16c** (D06): Given an ISBN search whose results contain more than one
  edition, then only the edition carrying that ISBN is fetched.
- **AC5a-17** (D13): Given a hand-added card (no input or observation), when the
  Owner presses Search Books or Search by ISBN, then the worker accepts the job
  and returns options.
- **AC5a-18** (R06): Given a client that sends the v1 capability, then choices
  include reasons and no `ownerIsbn13`; given v2, both; given none, neither.
- **AC5a-19** (D07): Given a saved ISBN on a card with no review snapshot yet,
  when its first review save keeps the same title and authors, then the ISBN is
  kept.
- **AC5a-20** (D06): Given a scanned card whose only clue is an ISBN, then its
  edition search returns the exact edition, not the first ten of the work.
- **AC5a-21**: Given an Open Library edition record with more than one language,
  then it shows as unavailable (the normalizer refuses it) and nothing breaks.
- **AC5a-22** (Edge): Given a successful `set_candidate_isbn`, then the gateway
  post-check passes (ids present) and the app receives the result.

AC5-5 ("only an ISBN in Add a book") is replaced by AC5b-1 to AC5b-6 (§15.5);
ISBN-only cards are not built (§15.7).

## 12. Tests written first, by layer

- **Database (PGlite, `npm run test:phase9:db`; Postgres harness for locks):**
  column check; identity in ISBN mode equals the B13 key; trigger: set, clear,
  choose keeps, title edit clears, same-title save keeps, first save on a null
  snapshot keeps, language edit keeps, clear with an equal scanned clue resets;
  RPC input checks, tenant, state, version, replay and mismatch, ids in the
  response; eligibility with ISBN-13 only and a hand-built ISBN-10-only fixture,
  foreign language; stage `edition` accepted only in ISBN mode; completion
  accepts `edition` at sequence 1; worker context body equal to M73 except the
  ISBN lines; choices with no, v1 and v2 capability; all M65–M77 regression
  suites.
- **Server (`supabase/functions/__tests__`):** extend
  `phase9_metadata_isbn_identity.test.ts` and
  `supabase/tests/phase9/phase9StructuralMetadataWorker.integration.test.mjs`
  (identity parity) with the ISBN-only key; adapter ISBN-mode sequence
  `[0 search, 1 edition, 2 author…]`; transport accepts `/books/OL…M.json` and
  still refuses `/isbn/…` and redirects; no-edition-key gives
  `no_acceptable_match`; a multi-language edition record is refused; context
  decoder accepts an empty title and null input/observation for edition jobs
  and still refuses them for automatic jobs; Edge contract, registrations,
  gateway post-check and header forwarding (v1, v2, other) for the new action
  and field.
- **App (Jest):** ISBN helper parity with the shared table; sheet: label, error
  announced, nothing sent on a bad digit, set-then-request order, save edits first,
  Retry search after a failed request, retry resends the same key and version,
  Search by title instead, no-result text; the app sends the v2 capability;
  older choices response without `ownerIsbn13` still decodes.
- **In-app check (Haiku, scripted, SDD-0 §15):** one card with a wrong title and a
  known ISBN; one ISBN-10 with `X`; one bad digit; one edition known to be outside
  the first 10. Cards chosen and checked read only before code is written.

## 13. Done means

SDD-0 §7.3 item 6, plus: migration readback recorded in the ledger; Edge and
worker deployed and read back under their own approvals; tracker 38, the phase
tracker and DOC-13 updated; `CODEBASE_MAP/` updated for the new action and column.

## 14. Open decisions for the Owner

| ID | Question | Recommendation |
|---|---|---|
| D5-1 | Build slice 5 before slices 11 and 13 (SDD-0 §7.2a)? | Yes, if the typed ISBN is wanted now; record it in SDD-0 §7.2a and DOC-13. 5a does not touch Add or session close. |
| D5-2 | Saving an ISBN drops an edition already chosen on that card (the identity changes). Accept? | Accept. The Owner is asking for a different search; the card's title and author stay. |
| D5-3 | New stage name `edition` (honest accounting, widens one table check) or reuse `editions` (no check change)? | `edition`. |
| D5-4 | 5b scope: an ISBN-only card, or title required with an optional ISBN? | Title required, optional ISBN (§15). §15 is written on this recommendation. |
| D5-5 | Show the saved ISBN on the card itself? | No, sheet only, to keep slice 2's decluttered card. |
| D5-6 | 5b: accept a rare "book added, ISBN not saved" outcome (no migration), or add `phase9_add_manual_candidate_v2` to do both in one step (one migration)? | Accept it; the sheet recovers it (§15.4). |

## 15. Slice 5b — optional ISBN in "Add a book"

Built after 5a is merged, on its own branch and PR. Scope follows the
recommendation in D5-4 and is **pending Owner confirmation**.

> **Note, 2026-10-23 (Owner).** Status: the Owner approved D5-4 (title required,
> optional ISBN) on 2026-10-22 with D5-1 to D5-6, so the scope above is
> confirmed. Order: 5b is branched from the 5a tip (`0f4fbd1`,
> `claude/phase9-psr-slice5b-add-isbn`) instead of waiting for the 5a merge. The
> worker and Edge are deployed after 5b is built, then one in-app check covers
> 5a and 5b together; no build with an ISBN box reaches real users before it.
> Clarifications to §15.3–§15.4 (no new behaviour beyond these):
>
> - The pending record (§15.3 item 3) also freezes the search request's key and
>   command ID. One press of Add is one record covering all four steps.
> - The search request (§15.3 step 2.4) is built the way 5a's sheet builds it
>   (§8): after the ISBN save, re-read the edition choices and build the request
>   from them, not from the save response. The re-read checks the card and its
>   versions against what the app already holds and records them, so a stale
>   generation is never sent.
> - With an ISBN, after the last step the Owner stays on Add a book, which shows
>   "Book added. Open Find or change edition to choose its edition." and a
>   button to leave. No message is carried to another screen. Without an ISBN,
>   the screen leaves as today (AC5b-2).
> - When the book is added but the ISBN steps have not finished, the leave
>   dialog says the book is added but without its ISBN, instead of "may already
>   have been added".
> - Retry labels: "Retry same addition" (the add), "Retry ISBN save" (the ISBN
>   step), "Retry search" (the search request, as in 5a's sheet).

> **Evidence, 2026-10-23.** 5b is built and reviewed locally; see [tracker 38 §30](../../trackers/38-post-scan-rework-evidence.md#30-slice-5b-built-reviewed-and-verified-locally-partial-browser-check-passed-2026-10-23). Deviations from this section, decided under the Owner's delegation: (1) no Retry after a version-conflict response (§15.4 listed "version" under Retry); (2) a `P9_STATE_CONFLICT` on the ISBN save reads "Book added, but the ISBN wasn't saved. This book can't be changed now." and becomes the §15.4 text "This scan is closed…" only when a session refetch reports the scan closed, because the code can also mean the card was committed or removed (§5.5).

### 15.1 Goal and Owner experience

"Add a book" (`screens/MissedBookScreen.tsx`) gains an optional **ISBN** box under
Title and Authors. Title stays required. When an ISBN is given, the new book's
edition search runs by that ISBN, so the Owner opens Find or change edition and
picks the exact edition (PSR-D13, D06).

### 15.2 Verified baseline

| # | Fact | Source |
|---|---|---|
| B16 | `phase9_add_manual_candidate(p_session_id, p_title, p_authors, p_language, p_idempotency_key, p_command_id)` inserts a card in state `needs_review` with observed title, authors and language, no ISBN clue; it allows sessions `active` or `closed`; it refuses an empty title with `P9_STATE_CONFLICT` (M5 L137–146). | M5 |
| B17 | The app calls it directly through `authenticatedRpc`, not through Edge (`ownerCorrectionService.ts` L101–115), then reads the card (`MissedBookScreen.tsx` L155). | app |
| B18 | A hand-added card gets **no** automatic lookup: the enqueue trigger fires only for scanned cards with a vision observation (M32 L100–139). The explicit edition search is its only lookup. | M32 |
| B19 | The form validates title 1–512, authors 1–256 each (max 20, unique) and language (`review/missedBookForm.ts`). | app |

### 15.3 Design (no migration)

1. The form gains `isbn` (optional). Empty means no ISBN. Otherwise the 5a helper
   validates it and converts ISBN-10 to ISBN-13; a bad check digit blocks the
   submit with the same message as the sheet and sends nothing. The box is
   hidden when the session is closed (B16 allows adding to a closed session, but
   the ISBN command needs an active one).
2. Submit, in order:
   1. `phase9_add_manual_candidate` as today (unchanged, six arguments, PSR-R06);
   2. read the card (as today) to get its `version`;
   3. if an ISBN was given: `set_candidate_isbn` (5a command) with that version;
   4. then `request_candidate_edition_options` with the returned
      `requestGeneration`, so the ISBN search starts at once.
3. **One pending record per press of Add**, kept until every step has finished:
   the add's key and command ID, and, once read, the card's ID and version with
   the ISBN step's key and command ID. Retry resends the same record from the
   first unfinished step, so the add and the ISBN save each replay instead of
   repeating, and the ISBN step never fails with `P9_IDEMPOTENCY_MISMATCH`
   because the version moved. The record lives in memory, like today's add key:
   an app restart or a second device loses it, and a later Add would create a
   second card, exactly as today (DeepSeek F21; not changed by 5b). The form's
   fingerprint (`missedBookFingerprint`) includes the ISBN so dirty and success
   tracking stay correct.
4. **Success is marked only after the last step.** Today the screen leaves as
   soon as the add succeeds (`committedFingerprint` and `router.replace`,
   `MissedBookScreen.tsx` L77–123), which would hide any later failure. With an
   ISBN, the screen stays until the ISBN steps finish or fail; a failure keeps
   the screen with Retry (§15.4).
5. Nothing is chosen automatically. The confirmation reads "Book added. Open Find
   or change edition to choose its edition." when an ISBN was given.
6. No database or Edge change beyond 5a. 5b relies on 5a's worker change for
   hand-added cards (B3a, AC5a-17). No decoder changes: the card always has a
   title.

### 15.4 Failure and recovery

| Case | Result | Screen | Owner's next step |
|---|---|---|---|
| Bad check digit | Nothing sent | Error under the ISBN box | Correct it or clear it |
| Add fails | No card | Existing Add a book error | Retry |
| Add succeeds, ISBN save fails (network, version) | Card exists without ISBN | "Book added, but the ISBN wasn't saved." with Retry | Retry (resends the pending record), or leave and type it in Find or change edition |
| ISBN saved, search request fails | ISBN saved, no job | "Book added. The ISBN search didn't start." with Retry | Retry, or Search by ISBN in the sheet |
| Session closed while the screen is open (after the add) | `P9_STATE_CONFLICT` on the ISBN step | "Book added. This scan is closed, so the ISBN can't be saved." | Nothing more in that session; the book stays added |

A book added without its ISBN is still possible when the Owner leaves instead of
retrying; the sheet can always recover it. A one-transaction
`phase9_add_manual_candidate_v2` would remove that case but costs a migration; it
is not proposed (§14 D5-6).

### 15.5 Acceptance checks

- **AC5b-1** (D13): Given a title and a valid ISBN, when the Owner adds the book,
  then the card exists with that title, its saved ISBN is the ISBN-13, and an
  ISBN search has started.
- **AC5b-2** (D13, R06): Given no ISBN, then Add a book behaves exactly as today.
- **AC5b-3** (R07, R09): Given a bad check digit, then nothing is sent.
- **AC5b-4** (R10): Given the ISBN save or the search request fails after the
  add, then the book stays added once and the screen says what to do next.
- **AC5b-5** (R14): The ISBN box has a label and its error is announced.
- **AC5b-6** (replay): Retry after a network loss never creates a second card or
  a second ISBN write, and the ISBN step replays even after the card's version
  has moved.
- **AC5b-7** (R10): Given an ISBN, the screen does not leave until the ISBN steps
  have finished; a failure keeps the screen with its message and Retry.
- **AC5b-8**: Given a closed session, the ISBN box is not shown.

### 15.6 Tests written first

App Jest only (5b adds no server code): form validation with and without ISBN,
the three-step order and its stop points, the pending record (keys, command IDs
and version) resent on retry from the first unfinished step, the screen staying
until the last step, each failure message, the box hidden for a closed session,
accessibility. In-app check: one manual book with an ISBN (its search returns
options, which also proves AC5a-17 live), one without.

### 15.7 Not in 5b

ISBN-only cards with no title (AC5-5 as written in SDD-1). An empty observed title
breaks the app's and Edge's strict decoders and older apps. Deferred unless the
Owner asks for it as its own design.

## 16. Corrections to SDD-1 §7 citations

Found while mapping (2026-10-21); to be applied to SDD-1 §7 when it becomes a
pointer:

- M73 L510–515 is the table check for stages; the stage check is in M74 L136–143.
- M74 L142–143 belongs to the register function; the completion gate is M74
  L93–106.
- M5 L140 is the start of `phase9_add_manual_candidate`, not a lock template; the
  template is M62 L102–106 with the session lock helper in M54.
- M29 L832–833 does not hold the Add title rule; the manual-add title check is M5
  L142 (raw length, `P9_STATE_CONFLICT`).
- `supabase/functions/_shared/contracts/ownerBatchReviewResponses.ts` is at
  `supabase/functions/_shared/imageInventory/contracts/ownerBatchReviewResponses.ts`
  (title L44).
- The transport allowlist is at `transport.ts` L18–22 and `redirect:'error'` at L42.
- The edition job context is `phase9_edition_worker_context`, latest body M73
  L236–285 (not M67 L58–106).
- The stage table check is `phase9_edition_http_stage`, M73 L509–515.

## 17. Review record

| Date | Reviewer | Verdict | Outcome |
|---|---|---|---|
| 2026-10-22 | OpenCode Go Argon (`gemini-4-argon-contributor`, max, read-only) | none | Two runs failed at the provider: "Upstream request failed: Endpoint is unavailable." No review produced. |
| 2026-10-22 | Sonnet subagent (read-only) | approve_with_fixes | 12 findings; all verified in the code by the author; all applied (F9 as a defensive note). |
| 2026-10-22 | Author check during verification | — | F13 added: the worker decoder rejects hand-added cards' null input and observation IDs (B3a); fixed in §6, AC5a-17. |
| 2026-10-22 | OpenCode Go Argon, round 2 | none | Failed again at the provider ("Endpoint is unavailable"). |
| 2026-10-22 | OpenCode Go DeepSeek v4.1 Flash (max, read-only), round 2 | rework | Confirmed F1–F13 applied correctly, except F7. 9 new findings F14–F22, all verified by the author in the code and live; all applied. |

Round 2 applied: F14 forced reset computes the new key after dropping the edition
choice (§5.4, AC5a-16); F15 edition chosen by ISBN match, not position (§6,
AC5a-16c); F16 review save alone before the ISBN set, one request (§8,
AC5a-16b); F17 ISBN mode in the observed-field branch (§5.4); F18 helpers
defined as review-or-observed, without the edition override (§5.4); F19
AC5a-14 wording, `updated_at`, `replayed` dropped (§5.5, §11); F20 v2 sent on
read and select, gateway test updated (§7); F21 in-memory limitation and
fingerprint (§15.3); F22 citations and the edition context error code (B3, B5,
B15, B17, §5.3, §10, §16). Live checks for DeepSeek's unverified items: `/books`
headers allow retention; ISBN search returned only the matching edition for two
works (§6).

Applied findings: F1 worker decoder and deploy order (§4, §6, §10); F2 context base
M73 (§5.3, AC5a-15); F3 v2 capability and `phase9_edition_choices` (§7, §5.8,
AC5a-18); F4 effective-value comparison (§5.4, AC5a-19); F5 ids in the response
and registrations (§5.5, §7, AC5a-22); F6 5b pending record, success after the
last step, closed session (§15.3–§15.5); F7 forced reset (§5.4, AC5a-16); F8
shape-only check (§5.1); F9 defensive label (§5.6); F10 citations (B7, §5.7, §16);
F11 shared guard and input checks (§5.5); F12 extra checks (AC5a-14, 20, 21).

Implementation review, 2026-10-23: round-2 code review (Haiku) found that the
app helper accepted 13-digit values outside 978/979, which the column, command
and wire schema refuse. The Owner approved the §8 clarification: the app's ISBN
box rejects them with the "Check the ISBN" message. No other design change.
