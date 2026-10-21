# Phase 9 Tracker 38 — Post-Scan Rework Planning Evidence

This tracker owns evidence for the post-scan rework work unit: the planning
session, its read-only verification, agent outputs, and later per-slice
implementation evidence. Product decisions live in
[SDD-0](../work-units/post-scan-rework/00-overview-sdd.md) (PSR-D01 to
PSR-D47); this file records how they were reached and verified.

## 1. Planning session, 2026-10-17 to 2026-10-19

Owner brief (2026-10-17, pasted): simplify the post-scan review cycle — remove
"View metadata" and keep "Find or change edition", declutter the screen,
remove the separate review step, discard unfinished card details when the
session ends, and keep one source of truth on the card once an edition is
chosen. Follow AGENTS.md; plan before coding; respect authorization
boundaries.

Discussion-only phase, then Owner direction: 18 small slices in 6 SDDs; SDD-0
in full plus outlines of SDD-1 to SDD-5 (pass 1); full detail per area just
before it is built (pass 2); agent review, fixes, Owner approval; red-first
tests in the existing layers. Owner: "I hope you will be the one who will be
writing the STDs, and if you need any further research, you can do it
yourself", "Just ensure quality is top notch", then "You go." That authorizes
the branch and the SDD documents only — no product code, migration,
commit, push or deployment.

Branch: `claude/phase9-post-scan-rework-sdd` from origin/main `8863885`
(worktree `C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect`,
upstream not set). origin/main re-fetched before the handoff entries; still
`8863885`.

## 2. Reconciliation with tracker 37 §71–§73

The phase-level handoffs (TRACKER, ACTIVE, SESSION-START, DOC-13) stopped at
2026-10-17 (Encyclopedia live acceptance). Main already holds, through PRs
#20 and #21, tracker 37 §71 (Ready count aligned with the add-now rule), §72
(Owner API `phase9-owner-ingestion` v17 deployed 2026-10-18; Ready counts
agree in the app) and §73 (Book 4 rejection reasons traced to pre-M77 option
snapshots; not a code bug). The 2026-10-19 handoff entries summarize those
three sections. Still not verified live: Search Books on Book 4 after option
expiry (tracker 37 §73) and M75 exhausted-search recovery. Both are outside
the post-scan rework scope and stay with tracker 37.

## 3. Read-only verification

All database facts in SDD-0 §8 (F1–F37) and the per-SDD "Verified for this
area" lists were read through Supabase MCP `execute_sql` (SELECT only) on
project `ahntbtktjjmvfosgkmgn` (Bookconnect_reactexpo), cross-checked against
local migrations and current code on origin/main `8863885`. Snapshot: 184
applied migrations, latest `20261017083830`; latest Phase 9 migration M77
`20261017083206`; Owner API v17; Render worker on main `f376c26`.

Notable checks: committed-card uniqueness (`committed_inventory_id` UNIQUE;
no unique index on `store_inventory.created_from_candidate_id`); existing
`image_extraction_sessions.default_publication` (private|publish, default
private); one photo per session (`P9_SINGLE_IMAGE_LIMIT`, M35); 15-card cap
(`candidate_index` CHECK 1–15; `phase9_add_manual_candidate` raises
`P9_LIMIT_EXCEEDED`); removal audit is ID-only with a removal fence (M54,
M52); no code writes `expired` or `closing`; no SQL daily quota and
`store_usage_counters` empty; catalogue edition linked only for
`current_suggestion` (M69 L142–154); no production writer of `canonical_*`;
the reviewer-raised ISBN+title identity mismatch was not observed live (F37).

Errors met and corrected during the read-only queries: an ambiguous
`text || "char"` (cast `confdeltype::text`) and wrong column names
(`used_value`, `last_safe_error_code`, jobs linked through `entity_id`). None
affected recorded facts.

## 4. Agent outputs

- Haiku subagents: code maps for review, catalogue, lifecycle and Add paths
  (read-only).
- Round 1 and round 2 plan reviews (2026-10-18; Codex `gpt-6.1-sol` xhigh and
  OpenCode Go Muse Spark 1.3, read-only): summarized in SDD-0 §10; every
  accepted recommendation is an Owner decision in SDD-0 §4.
- Design study 1 (slices 6–7) and design study 2 (slices 13–14) (OpenCode Go
  Muse Spark 1.3, xhigh, read-only, 2026-10-19): summarized in SDD-0 §10. The
  full outputs are working notes, not repository authority. Study 2's proposed new session column
  was replaced by the existing `default_publication` (F7).
- Reviewer claims were checked against live data before adoption; adopted
  changes are recorded in SDD-0 §10 and the slice map (slices 4, 5, 8, 10, 15).

## 5. Files created

- `work-units/post-scan-rework/00-overview-sdd.md` — SDD-0, full.
- `work-units/post-scan-rework/01-review-screen-sdd.md` — slices 1–5; pass 2
  (build detail) written 2026-10-19, §13.
- `work-units/post-scan-rework/02-catalogue-and-matching-sdd.md` — slices 6–9.
- `work-units/post-scan-rework/03-session-lifecycle-sdd.md` — slices 10–12, 18.
- `work-units/post-scan-rework/04-add-and-publish-sdd.md` — slices 13–14.
- `work-units/post-scan-rework/05-classification-sdd.md` — slices 15–16.
- `work-units/post-scan-rework/data/benchmark-spine-readings-2026-10-18.json` —
  85 unique spine readings `{t,a,l}` for the slice 9 benchmark gate (D38),
  preserved from the planning scratch files.
- Decision P9-D89 in [tracker 01](./01-planning-and-decisions.md) and dated
  2026-10-19 entries in TRACKER, ACTIVE, SESSION-START and DOC-13.

## 6. Mutations

None. Database, Storage, Edge Functions, Render and provider registries were
read only. No migration file was created. Nothing was staged, committed or
pushed.

## 7. Verification run at this checkpoint

Documentation only. Phase 9 continuity validator and `git diff --check` —
results recorded in §8 once run. No product code changed, so tsc and Jest
were not required and were not run.

## 8. Validator result

2026-10-19, after the handoff entries: `validate-phase9-continuity.ps1` —
PHASE9_CONTINUITY_CHECK=PASS, REPOSITORY_DIFF_CHECK=PASS, 104 Markdown files,
62 required phase files; size advisories only for pre-existing long files.
`git diff --check` clean; new files have no trailing whitespace; every
relative link in the new files and new entries resolves.

Size assessment: SDD-0 is 570 lines after both review rounds. It stays one
file because it is the single register of decisions, rules, slice map and
verified facts that every slice SDD cites by ID; splitting it would fragment
that authority. The five area SDDs are 150–295 lines and will grow at pass 2.

Re-run after the pass-1 review fixes (same day): PHASE9_CONTINUITY_CHECK=PASS,
REPOSITORY_DIFF_CHECK=PASS; `git diff --check` clean; no trailing whitespace
in new files. CODEBASE_MAP needs no update: no code, route or schema changed.

## 9. Next

Superseded by §13 (the Owner approved the SDD set on 2026-10-19). The
current active work unit and next action are at the end of §13.

## 10. Pass-1 review, 2026-10-19

Reviewer: OpenCode Go `muse-spark-1.3-contributor`, variant xhigh, agent
`plan` (read-only), run in the worktree. Brief: fact accuracy, fresh-session
test, consistency, slice sizing, safety, testability. Output kept as a working
note outside the repository.

Verdict: `approve_with_fixes`. Facts spot-checked: 18 confirmed against
migrations and code (F2, F3, F4, F5, F6, F7, F8, F10, F11, F18, F25, F29,
F30, F31, F33, F34, F36 and code halves of F13, F17, F19, F26); none wrong;
live-only facts marked unverifiable offline (they were read through Supabase
MCP during planning, §3).

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| P1 | major | Changing the `default_publication` default would let sessions from older apps (old "Prepare to publish" meant record only) auto-publish under the new Add. | Column default stays `private`; the new pre-scan marks its sessions and Add publishes only for marked sessions. SDD-0 §9 row, §14 Q12; SDD-4 scope, migration line, AC14-8. |
| P2 | major | Slice 15 Auto-detect needs per-work category counts that slice 7's stats do not hold. | Per-work category count table (no store identity) moved into slice 15b; SDD-5 scope, dependency text, AC15-9; slice map row. |
| P3 | major | PSR-D01 had no slice-level acceptance check. | SDD-3 AC11-6 and traceability row. |
| P4 | minor | PSR-D22 not cited by any check. | AC8-7 cites D22 (scan photo never used); traceability row. |
| P5 | minor | PSR-D32 swap-ability not tested; D14 not marked no-change. | AC8-2 adds a faked second adapter; D14 row says no slice changes it. |
| P6 | minor | Slice 4 migration text cited Q1, which needs none. | "Maybe one (§14 Q9 only; Q1 needs none)". |
| P7 | minor | F28 unproven (which Add variant each caller renders). | Verified: batch card uses the coordinated variant (Store View button only); full correction uses the legacy one. Evidence added to F28 and slice 3. |
| P8 | minor | F27 cited only a code map; the app contract union lists `add_missed`. | Verified the server batch-card grant (M61 L251–258) never grants `add_missed` or `mark_false`; evidence added to F27. |
| P9 | major | AC12-1 had two outcomes. | One outcome (count at completion, overshoot at most 14); alternative recorded as §14 Q11 for pass 2. |
| P10 | nit | Q7 effectively decided. | Q7 states slice 15 is outlined on Auto-detect; Owner approval confirms it. |
| P11 | nit | Undefined terms for a fresh session. | Glossary rows: query identity, edition options, provider registry, rule version, idempotency key / operation code. |
| P12 | nit | Pre-split slices 13 and 15 now. | Kept as expected splits (13a/13b, 15a/15b) decided at pass 2; R12 still holds per part. |
| P13 | nit | Accessibility checks only in slice 2. | Added to slices 4, 5, 10, 12, 14, 15, 16. |

Also applied from my own re-read: SDD-1 lists PSR-D04 among decisions served,
and AC3-1 no longer expects a publish outcome before slice 14. Pass-2 notes
recorded in the SDDs: slice 13 lists every trigger definition (M29; M67
replaced by M69) and keeps the M67 option-clearing behaviour; slice 11 cites
the existing session → candidate lock order and greps `expired`/`closing`
writers; slice 12 uses an `Asia/Kolkata` day boundary; slice 14 tests that an
unexpected publication error cannot undo Add (AC14-9).

A second review by Codex `gpt-6.1-sol` was not run: the first review was
complete on every brief item and its findings were specific and verifiable.
Validator re-run after the fixes: see §8.

## 11. Round-2 review, 2026-10-19

Owner: "run both Codex and OpenCode review Space [Bunny]". Two independent
read-only reviews of the fixed set with the same brief as round 1 plus a
check of P1–P13 and a search for what round 1 missed:

- Codex `gpt-6.1-sol`, reasoning xhigh, sandbox read-only — verdict `rework`
  (11 findings, all major except one minor).
- OpenCode Go `space-bunny`, variant max (its highest), agent `plan` —
  verdict `approve_with_fixes` (14 findings, 2 blockers).

Both confirmed F4–F8, F10–F12, F25, F28–F31, F33, F34, F36 against code.
Outputs kept as working notes outside the repository.

Every claim was re-checked in code before adoption:

| Finding (reviewer) | Check | Outcome |
|---|---|---|
| Price/condition gate makes AC14-2 unreachable (both) | Confirmed: M55 L108–109, M29 L845–848 | F38; SDD-4 slice 13 step 3 and slice 14; Owner question Q13 |
| Open Library genres always empty (Bunny) | Confirmed: `openLibrary/normalizer.ts` L130 | F40; slice 8 normalizes subjects, AC8-8; slice 15 depends on 8 |
| Third readiness trigger (Bunny) | Confirmed: M29 L123–135, M67 L276–286 | F3 corrected to three; SDD-4 lists three; AC13-7 |
| Old app close after auto-close errors (Bunny) | Confirmed: M52 L441–445 | F45; slice 11 migration returns closed readback; AC11-5 rewritten |
| Typed ISBN design incomplete (both) | Confirmed: manual RPC requires title (M5 L137–143); ISBN search via work search (`openLibrary/adapter.ts` L41) | Slice 5 split 5a/5b, exact ISBN record, overload, AC5-7 to AC5-9 |
| Retry must reuse key and command ID (Bunny) | Confirmed: M5 L25–35, M69 L121–123 | F44; reconcile rule rewritten; recovery row |
| Vision completion replay double-counts (Bunny) / overshoot not bounded (Codex) | Logic confirmed (several Owners per store) | Q11 now recommends store-wide reservation; AC12-1, AC12-2, AC12-4 rewritten |
| Consent marker under-specified (Bunny, Codex) | Confirmed: start-session v2 signature (M52 L112) | Q12 rewritten (unmarked default, atomic on insert, old signature callable); AC14-11, AC14-12 |
| Google off wipes all saved options (Bunny R2-9) | **Stale**: M73 replaced the Google-only clause with a per-source policy (L154–164) | Not adopted; residual recorded as F42 (catalogue-sourced options need the policy) |
| Slice 1 re-saves a stale app copy (Bunny) | Partly: the identity trigger resets the choice to `manual`, not null (M69 L332–336), so the named blocker was wrong; the stale-selection risk is real | Slice 1 re-saves the server's stored review; AC1-5 |
| Statement trigger inverts lock order (Bunny) / lock graph incomplete (Codex) | Confirmed: scope trigger M29 L40–50; worker candidate lock M67 L38–42; manual creation unlocked | F39; slice 11 trigger option removed, lock graph mapped, manual creation takes the session lock, AC11-9; size L/high |
| Work dedupe by author array (Bunny) | Confirmed: M3 L9–13 | F46; slice 6 normalization, AC6-0 |
| Slice map cells disagree (Bunny) | Confirmed | Cells for slices 1, 3, 5, 8, 11, 13, 15, 17 corrected |
| Closed review key set (Bunny) | Confirmed: M29 L825–831 | Slice 13 versioned review shape |
| Receipt rebuilt from mutable inventory; closed-session recovery (Codex) | Logic confirmed (publication can change, M40 L773) | Immutable original receipt; committed check before session fence; AC13-8 |
| Category counts vs PSR-D40 (Codex) | Confirmed: D40 lists category among Owner edits | Owner question Q14; slice 15 catalogue tier held; AC15-9 conditional |
| Script stranding after removing the script field (Codex) | Confirmed: `compactReviewDraft.ts` L175–177, `ownerUxValidation.ts` L94–104 | F41; slice 4 recomputes script; AC4-7 |
| D01 not met by manual close or expiry (Codex) | Confirmed: close v3 checks inputs only | Slice 11 "other endings" rule; AC11-7, AC11-8 |
| Tie pick of other-language editions (Codex) | Confirmed: `explicitEditionLanguageMatches` | AC9-3 rewritten to the existing language rule |
| Shared cache keys can carry Owner text (Codex) | Confirmed: M67 L77–82 | F43; provenance-based shared-cache rule |
| F2 overstated; D27 cites F12 (Codex) | Confirmed | F2 says "up to three"; D27 cites F14 |
| Glossary and reference gaps (Bunny) | — | Glossary: Needs details, hidden catalogue record; reference list added to SDD-0 §2 |

Sizing changes: slice 4 M/med; slice 5 L/high split; slice 11 L/high; slice 12
M/med–high; slice 17 M. Not adopted: Codex's broader re-sizing of slices 7–9
and 13–14 beyond what the SDDs already state (they already note splits).

Owner decisions then needed: SDD-0 §14 Q13 and Q14 (taken the same day, §12).

Validator re-run after the round-2 fixes: PHASE9_CONTINUITY_CHECK=PASS (see
§8 for the command); link check of the new files: 0 broken.

## 12. Owner decisions on Q13 and Q14, 2026-10-19

Owner: "make price, condition and quantity as mandatory values that needs to
be inserted before adding to inventory. And pre-scan, price can be zero, but
in post-scan UI cards, price can't be zero."

Recorded as new PSR-D47 (SDD-0 §4 C): a card needs a price above ₹0, a
condition and a quantity of at least 1 before Add; the pre-scan default price
may be blank or ₹0, and cards then show Needs details. PSR-D15 amended:
price and condition are no longer listed as publication blockers. Applied to
slice 2 (app rule, AC2-7) and slice 13 (server rule on the new Add contract,
AC13-9; the old contract keeps today's rule for older apps); slice 14's
ineligibility list and AC14-2 updated; supersession row for P9-D81 added.
Code check: the pre-scan form already allows a blank or ₹0 default
(`scanSetup/scanSetupForm.ts`, priceMinor 0..max or null); today's server
rule allows ₹0 for a private Add (F38), so this tightens validation (R07).

Owner, on category: "Either owner can select it in the pre-scan the
category, or he can select the option as auto-select. Later, then the Gemini
will return the parameter of category based on its analysis."

PSR-D42 amended: Auto-detect means Gemini returns one category per book in
the same photo analysis, told the existing priority order; invalid or
missing gives Other. The catalogue tier (category counts across stores,
which conflicted with PSR-D40) and the provider-genre tier are recorded as
rejected options (SDD-0 §5). Provider genres are still stored privately
(PSR-D43). SDD-5 slice 15 rewritten (15b is now prompt, decoder and storing
the value); AC15-2 to AC15-4 rewritten, AC15-9 removed; slice 15 no longer
depends on slice 7.

## 13. SDD set approved; SDD-1 pass 2 and its code map, 2026-10-19

Owner: "I approve the SDD set with the remaining open-question defaults. Write
SDD-1 pass 2 with its code map."

What this approval covers and does not cover:
- It covers SDD-0 to SDD-5, the decisions PSR-D01 to PSR-D47, the rules
  R01 to R14, and the SDD-0 §14 defaults Q1 to Q12, together with the Owner
  decisions on Q13 and Q14 (§12).
- It does not authorize code, migrations, commits, pushes or deployment.
  Each slice asks separately.
- SDD-0 is marked `approved`.

**Code map.** Three read-only Haiku subagents mapped the code for slices 1–2,
slices 3–4 and slice 5, against the worktree at `8863885`. The author then
re-checked every claim that drives a design choice.

| Claim | Evidence | Used in |
|---|---|---|
| Add saves only when `needsSave`; an unchanged draft then needs `reviewReady` | `commit/inventoryCommitPolicy.ts` L25–50 | Slice 1 forced re-save |
| The coordinator always rereads, then adds with the reread versions | `commit/inventoryCommitCoordinator.ts` L285–313 | Slice 1 |
| Save v2 sets `review_ready=true`, has no unchanged-review shortcut, and raises `P9_STATE_CONFLICT` on blockers | M62 L51–57 | Slice 1 has no loop |
| "Review book" is the fall-through label | `components/batchReviewStatus.ts` L41 | Slice 1 label |
| An `edition_option` choice must equal the edition's title, authors, language and script | M69 L18–26 | Slice 2 identity-edit rule (AC2-10) |
| Inline title and author edits send only that field; the choice is kept | `InlineBatchReviewFields.tsx` L75, L90; `compactReviewDraft.ts` L165–170 | Slice 2 |
| A card without a chosen edition has no choice until "Edit manually" | `compactReviewDraft.ts` L165–170; M55 L106 | Slice 2 manual default |
| The edition snapshot carries publisher, date and both ISBNs; the card summary does not | `ownerUxCandidateSchemas.ts` L63–82; `ownerEditionPicker.ts` L75–84 | Slice 2 edition line |
| The identity form saves, rereads, then searches, with a new key on each submit | `queries/ownerEditionPickerQueries.ts` L121–153, L126 | Slice 2 search |
| The batch screen has no leave guard | `CaptureProgressScreens.tsx` L71–75; `review/useCandidateLeaveGuard.ts` | Slice 2 guard |
| Only the hub, the service and Store View invalidation use the inventory list code | importer search, 2026-10-19 | Slice 3 delete and keep lists |
| The readiness summary is the only manual Close; the app's auto-close needs zero removed cards | `PostScanInventoryActions.tsx` L18; `useCompletedScanAutoClose` | Slice 4 keeps the summary |
| The variant reject accepts `stale` rows | M24 L204–281 | Slice 4 hidden step, no migration (Q9) |
| The app and server script checks accept null; the Add commit does not read the script | `ownerUxReviewSchema.ts` L105; M29 L789; M39; M69 L100–200 | Slice 4 script rule |
| The server's 15-card limit counts removed cards | M5 L143–144 | Slice 4 limit text |
| The edition request has no query input; four places check the query identity | `contracts/ownerEditionPicker.ts` L26–29; M75 L94–99; `metadataGatewayContext.ts` L98–111; M68 L81–83; M73 L154–164 | Slice 5 `owner_isbn13` design |
| Open Library search ignores the ISBN when a title exists and reads 10 editions | `openLibrary/adapter.ts` L41, L53–56 | Slice 5 fetch by ISBN |
| `observed_title` is NOT NULL | M2 L134 | Slice 5b |

**Design changes from pass 1, found by the code map:**
- **Slice 1 stays unchanged.** The forced re-save saves the server's
  reread review.
- **Slice 2 adds AC2-10.** An identity edit turns a chosen edition into a
  manual choice. Without this, the server would refuse the card at Add. This
  closes a gap in the current code.
- **Slice 4, script.** Pass 1 had the app recompute the script; pass 2 clears
  it to null instead. Both validators already accept null, so the result is
  the same and simpler.
- **Slice 4, readiness summary.** It stays until slice 11, so sessions with a
  removed card can still close.
- **Slice 4, stale wording.** It is cleared at Add by rejecting the stale
  proposal through the existing function, so Q9 needs no migration.
- **Slice 5, typed ISBN.** It is stored on the card (`owner_isbn13`) instead
  of on one request, because four places check the query identity. This
  departs from the approved Q2 default, so the Owner must confirm it before
  5a starts.

Mutations: none. Documentation only.

## 14. SDD-1 pass 2 reviews, 2026-10-19

Two read-only reviews of the pass-2 draft:
- OpenCode Go Space Bunny (max): `approve_with_fixes`;
- Codex `gpt-6.1-sol` (xhigh): `rework`.

The author checked every finding in the code. Adopted:
- **Slice 1:**
  - the frozen draft is replaced by the server review
    (`inventoryCommitPolicy.ts` L134–147);
  - the reset caused by Add's own save is handled (M65 L137–145, M69
    L325–336);
  - whole requests are frozen for replay (M62 L89–94);
  - any change the Owner did not see stops Add.
- **Slice 2:**
  - script is part of the identity rule (M69 L22–26);
  - the card rule includes an author (M55 L139–141);
  - old results hide after an identity edit (`CandidateEditionPicker.tsx`
    L87–96).
- **Slice 4:**
  - the script is recomputed, because a null script would switch off the
    server check (M29 L789);
  - stale wording is rejected in up to two rounds (M24 variant refresh);
  - the deletion lists for tests and routes are complete.
- **Slices 3 and 4:** CODEBASE_MAP and the validator lists are updated.
- **Slice 5:** reduced to a design direction with explicit requirements
  (tenant guard, trigger registration, language rule, provider stages,
  decoders).
- **Line numbers:** corrected throughout.

Not adopted: Space Bunny P2-9 (the save-then-search race). The path already
claims the card slot (`useOwnerCardCommand.ts` L40–42).

Slice 1 is resized to M / med in SDD-0. The SDD-0 Q2 row is annotated with
the proposed departure.

Mutations: none.

Superseded by §15.

## 15. Owner approval of SDD-1 pass 2, 2026-10-19

Owner: "I approve SDD-1 pass 2 and the owner_isbn13 direction for slice 5."

- SDD-1 is marked `pass_2_approved`.
- The SDD-0 §14 Q2 row records that the card-stored ISBN (`owner_isbn13`)
  supersedes the request-scoped default.
- Slice 5 still gets its own full design pass, with SQL, when 5a starts
  (SDD-1 §7).
- This approval does not authorize code, migrations, commits, pushes or
  deployment.

Mutations: none.

Active work unit: `post_scan_rework_slice1_add_resave`. Exact next authorized
action: the Owner gives the go-ahead to build slice 1 (SDD-1 §3). That means
a new branch from main, red-first tests in `inventoryCommitCoordinator.test.ts`
and the related suites, then the policy and coordinator changes. Slice 1 has
no migration.

## 16. Build order and roles, 2026-10-19

The Owner chose **core first, then reassess** (SDD-0 §7.2a):
- stage 1: slices 1–4;
- stage 2: slices 11 and 13;
- stage 3: stop, and the Owner decides on the rest.

The Owner also set the roles (SDD-0 §15):
- Codex `gpt-6.1-sol` (xhigh) writes the code;
- the orchestrating session briefs, verifies and reviews;
- test runs are delegated with strict prompts.

The Owner asked whether SDD-1 needed a third review. Decision: no.
- The pass-2 fixes are checked again during slice 1, in three ways: Codex's
  stop-and-report rule, red-first tests, and the PR review.
- The documents were committed for a docs-only PR so that a new session can
  start slice 1 from main.

Active work unit: `post_scan_rework_slice1_add_resave`. Exact next authorized
action: after the docs PR is merged, start a new session for slice 1 (SDD-1
§3) from main, under the roles above. Building the slice needs the Owner's
go-ahead in that session. No migration.

## 17. Slice 1 built: Add re-saves a reset review, 2026-10-19

```text
Date/session: 2026-10-19; slice-1 session started from the planning session.
Authorized work unit and scope: post_scan_rework_slice1_add_resave. Owner: "Go
  ahead: build slice 1 (SDD-1 §3) red-first on a new branch from main, with
  Codex gpt-6.1-sol xhigh writing the code." Branch
  claude/phase9-psr-slice1-add-resave from main 6a41033. No migration.
Completed: SDD-1 §3 steps 1–6 and AC1-1 to AC1-9, written by Codex
  gpt-6.1-sol (xhigh) from a strict brief; every diff line read and the
  retry paths traced by the orchestrating session.
  - Admission: candidateCommitPreparation returns resave 'review_reset' for a
    saved, unedited, not-ready card with no blockers; such a card needs
    save_review (card, bulk and frozen Add all share the rule).
  - Reset before Add: reread first; any difference from the review the Owner
    saw, other than an edition choice turning manual, stops Add with code
    review_changed ("This book changed. Check it and press Add again.").
    Otherwise the draft becomes the server's review and one frozen save runs.
  - Reset caused by Add's own save: after the save, reread; if not ready, no
    blockers, metadata revision went up and the review matches except for a
    manual choice, one more frozen save runs with its own key and command ID
    (minted at freeze), then reread and add.
  - At most one re-save per command; a still-unready reread ends as
    no_longer_eligible and the card is synchronized.
  - D2-2: the save and re-save requests are frozen whole (payload, expected
    versions, key, command ID) in the retry state; a retry resumes at the
    right step and replays the stored request.
  - Label: the fall-through "Review book" is now "Needs details".
Files/components/migrations: src/features/imageInventory/commit/
  inventoryCommitPolicy.ts, inventoryCommitCoordinator.ts,
  inventoryCommitTypes.ts (RetryState moved here; frozen request fields);
  components/batchReviewStatus.ts; components/AddCandidateToInventoryAction.tsx
  (review_changed message only). Tests: __tests__/inventoryCommitCoordinator
  .test.ts (8 named AC tests; savedNoop updated, plus a reset card without
  save_review that still cannot start), postScanUiCorrections.test.tsx (L547
  test rewritten as "shows Ready for a reset saved review that Add will
  re-save"; Needs details and review_changed message tests),
  BatchInventoryCommitControls.test.tsx ("includes a reset saved review in Add
  all"). The L415–425 exact-save replay regression is unchanged. No migration;
  no server code.
Verification actually run:
  - RED (tests first, no product change; Codex run): 5 named suites, 3 failed /
    2 passed; 13 failed / 105 passed tests. Every failure was a behaviour
    assertion (no syntax or type error); the L415 replay regression passed.
  - GREEN, re-run by a Haiku subagent with a strict prompt and checked from its
    raw output by the orchestrator: npx tsc --noEmit exit 0, no output; the 5
    named suites (inventoryCommitCoordinator, postScanUiCorrections,
    BatchInventoryCommitControls, batchReviewCard, useInventoryCommitCoordinator)
    5/5 suites, 118/118 tests; npx jest src/features/imageInventory 75 passed /
    1 skipped suites, 799 passed / 4 skipped tests, 0 failed.
  - In-app check, Expo web dev build on localhost:8081, signed in by the
    Owner; session 7a81bdb6 ("Edition picker live test"); server state read
    only through Supabase MCP on ahntbtktjjmvfosgkmgn:
    - Book 4 (candidate 0729c2c1; saved review with an edition choice,
      review_ready=false, 0 blockers; stuck before this slice): showed Ready.
      One Add press: committed_private, inventory 4a90c2e2, review_version
      4 -> 5 (one re-save), candidate version 5 -> 7. Live AC1-1: pass.
    - Book 7 (candidate ac394157; no saved review): "Edit manually", title
      edited to "Unended Quest: An Intellectual Autobiography", one Add press:
      committed_private, inventory bbf3f48d, manual choice, edited title saved,
      review_version null -> 2, metadata_revision 4 -> 5 (Add's own save, the
      identity reset, then one re-save). Live AC1-7 and the Done-means check:
      pass.
    - Book 3 (candidate 38674cf9; chosen edition, edition_option "False
      Dawn"): title edited, one Add press: "This book is no longer eligible".
      Nothing saved (version 2, review_version null, updated 2026-10-16).
      Postgres log at 10:25:33Z: P9_STATE_CONFLICT. Cause, read from the live
      functions: the inline edit keeps the edition_option choice, so
      phase9_edition_saved_choice_valid fails (the title must equal the
      edition's), phase9_owner_ux_review_blockers adds metadata_choice_missing,
      and save v2 refuses before any write. This is the known gap that slice 2
      AC2-10 closes (SDD-1 §1 "Inline edits keep the chosen edition"); not a
      slice-1 regression, since slice 1 only acts after a save succeeds. The
      card keeps an unsaved local edit only.
Supabase/external mutations: no direct DB/Storage write, migration, Edge,
  Render or deployment by this session. The in-app check, run through the app
  under the Owner's sign-in, added two books to the dev store's private
  inventory (4a90c2e2, bbf3f48d) and saved their reviews. Nothing committed or
  pushed.
Decisions/deviations/risks:
  - Role deviation: the orchestrating session ran the in-app check itself,
    driving the browser and choosing the cards. Under the roles in §16 and
    SDD-0 §15, a Haiku subagent should have run it from a strict script.
    The server-state readings above were made read-only by the orchestrator
    through Supabase MCP. The Owner chose not to re-run it (2026-10-19). From
    slice 2 on, in-app and browser checks are delegated to Haiku, and the
    orchestrator verifies the server state.
  - AC1-3 corrected (SDD-1 §3): Codex stopped and reported that blockers are
    attention items (BatchReviewCard.tsx L208–216), so reviewStatusLabel
    returns "Needs attention" (L38) before the fall-through. Because §3 puts
    every label other than "Review book" out of scope, a blocked card keeps
    "Needs attention" with the blocker text; no re-save is forced and Add
    stays disabled. Verified in code by the orchestrator.
  - Re-saves send the expected versions from the reread that triggered them
    (the server's current ones).
  - The frozen command also keeps the review the Owner saw (ownerSeenDraft).
    After a re-save is frozen, a retry matches either that review or the
    server's review, and skips the base-version check. This covers the case
    where the card still shows the old edition choice after a lost response
    (AC1-8). If versions moved since, the server refuses the replayed request
    as a version conflict, and Add ends as no_longer_eligible (fail-safe).
Tracker/source-doc updates: SDD-1 §3 AC1-3; this section; TRACKER, SESSION-
  START, ACTIVE and DOC-13 handoffs. CODEBASE_MAP unchanged (no module added,
  moved or retired).
Next authorized action and gate: see the handoff entry.

## 18. Slice 1 review loop and process refinement, 2026-10-19

The Owner added a review loop for risky slices. The orchestrator judged
slice 1 risky, because it changes Add's retry and idempotency paths, and ran
the loop before merge.

**Round 1** (read-only; OpenCode Go Space Bunny max, Muse Spark 1.3 xhigh;
both `approve_with_fixes`). The orchestrator checked every finding in code:

| # | Finding | Verdict |
|---|---|---|
| Muse-1 | A refused re-save stayed frozen in `retries`. Because `draftMatchesCommand` skips the base-version check once a re-save is frozen, the next Add replayed the same refused request. | Confirmed, major (the reviewer said minor). Fixed (C1). |
| Muse-2 | No test for a re-save refused with `P9_STATE_CONFLICT`. | Confirmed, minor. Test added (C2). |
| SB-1 | "Press Add again" was shown, but Add was disabled for every `no_longer_eligible` outcome, and outcomes persist until the screen scope changes (`useInventoryCommitCoordinator.ts` L92–97). | Confirmed, major. Fixed (C3). |
| SB-2 | Tighten `draftMatchesCommand` to require versions at or above the re-save's. | Rejected. It breaks the AC1-8 stale-card replay. The underlying risk is closed by C1, with a test. |
| SB-3 | The AC1-7 fixture uses an edition choice, which the live server refuses at the first save (seen on Book 3). | Confirmed, minor. Manual variant added (C4). |

**Corrections** (Codex `gpt-6.1-sol` xhigh, bounded, red-first):
- C1: the `executeClaimed` catch block drops the retry on
  `no_longer_eligible`.
- C3: Add stays enabled for `review_changed` only.
- C2 and C4: tests only.

RED: 2 failed / 68 passed (the C1 and C3 tests). GREEN: 70/70; tsc clean.

**Tests re-run by Haiku** on the corrected code, raw output checked by the
orchestrator:
- `tsc`: clean;
- the 5 named suites: 122/122;
- `src/features/imageInventory`: 75 passed / 1 skipped suites, 803 passed /
  4 skipped tests, 0 failed.

**Round 2** (Space Bunny max, correction diff only): the first run, Space Bunny max, hung with no output for about 1.5 hours and was stopped.
Rerun with Muse Spark 1.3 xhigh, capped at 30 minutes: `approve`, no findings. It confirmed that C1 keeps
every retryable state (still_pending, failed_retryable, bulk retry), that C3 re-enables Add only for
review_changed, and that the new tests fail without the fixes. Loop closed after round 2.

**Browser check:** not re-run after the corrections, by Owner decision
("finish fast"). The fixes are covered by tests that failed first, and the
§17 in-app check covers the happy paths.

**Process refinement.** Approved by the Owner and written into SDD-0 §15:
- the slice order;
- a written trace for each new outcome in the orchestrator's review;
- the review loop for risky slices only, with a stop after round 2;
- Haiku runs browser checks from a script the Owner sees first;
- changes to the SDD, an acceptance check, the planned check or a port go to
  the Owner first.

**Slice 2 planning decisions (Owner, 2026-10-19):**
- Year rule: the edition line's year is the first stand-alone four-digit
  number in `publishedDate`. SDD-1 §4 is corrected; live data has dates like
  "April 1, 1999".
- Haiku's browser script is approved, including adding Book 3.
- The browser check runs on port 8081.
- Test cards, from session 7a81bdb6:
  - Book 3 (38674cf9): edition chosen;
  - Book 5 (a5da3bc6): edition chosen;
  - Book 6 (1f0d763f): no edition.

Mutations: none in this step (no DB/Storage, migration, Edge, Render or
deployment). The Supabase reads were read only.

Active work unit: `post_scan_rework_slice2_declutter`. Exact next authorized action: the Owner merges
PR #24 (slice 1). Slice 2 (SDD-1 §4) starts on the Owner's go-ahead of 2026-10-19 ("Finish fast + start
slice 2"), on a branch from slice 1's tip, under the SDD-0 §15 process. It is a risky slice, so it gets the
review loop. No migration.

## 19. Slice 2 built: declutter the card and the edition sheet; card requirements, 2026-10-20

```text
Date/session: 2026-10-20; slice-2 session started from slice 1's tip.
Authorized work unit and scope: post_scan_rework_slice2_declutter; slice 2
  (SDD-1 §4, AC2-1 to AC2-10) on branch claude/phase9-psr-slice2-declutter from
  1f98804 (slice 1 tip). Nothing committed or pushed yet; the PR #24 (slice 1)
  merge is with the Owner.
Completed (src/features/imageInventory/):
  - Card: one "Find or change edition" button (View metadata removed); the
    edition line under the title (publisher · year · ISBN-13 or ISBN-10; year =
    first stand-alone 4-digit number in publishedDate; "Edition chosen"
    fallback; "Finding edition…"; "No edition chosen"; "No edition chosen —
    title or author changed"); metadata status text and source badges on
    title/author removed; status pill announced politely.
  - Card requirements (D2-1, one rule cardAddRequirementIssues used by the
    badge, Add, Add all and the header count): price missing: "Set a
    whole-rupee selling price."; ₹0: "Enter a price above ₹0." (app-only;
    server unchanged); condition, quantity 1-10,000, author. Label stays
    "Needs attention" (Owner decision; SDD-1 AC2-7 corrected).
  - AC2-10: whenever title, authors, language or script differs from the chosen
    edition's snapshot, the draft's metadataChoice becomes manual; the snapshot
    is trusted only when the loaded choices belong to this card and name the
    same selection. Manual default only after the lookup ends; while pending
    the only attention item is "Finding the edition…".
  - Edition sheet: detected details, "Use detected details", "Edit manually"
    and EditionIdentityFix removed (file and its test deleted); Search Books
    saves the card's edits first (frozen request, D2-2) then searches; definite
    server refusals clear the frozen command and reload, unclear failures
    replay it exactly; one "Retry search" at most.
  - Header: explanation, footnote and "One image · Up to 15 books" chip removed.
  - Leave guard: useUnsavedEditsLeaveGuard (replaces useCandidateLeaveGuard)
    renders OwnerConfirmationDialog on all platforms (Alert.alert is a no-op on
    web) — "Leave without saving?" / "Your card edits are not saved and will be
    discarded." / "Stay" / "Leave and discard"; busy (Add or edition command in
    flight) shows a Stay-only dialog. OwnerConfirmationDialog gained optional
    cancelLabel and optional confirm.
  - Batch review query now also polls (3 s, visible only) while any card's
    metadataState is 'pending'.
Process and evidence:
  1. Codex gpt-6.1-sol xhigh built the slice red-first; the resume run fixed 5
     suites (₹0 fixtures incidental, changed to ₹1).
  2. The orchestrator traced the review and found two problems: the web leave
     guard was a no-op, and save-then-search could loop on a refusal.
  3. Review loop round 1: Muse Spark 1.3 xhigh (17 findings) and Codex
     gpt-6.1-sol read-only (9). C1-C10 were confirmed, 2 rejected and 3
     deferred to the Owner. The brief was checked by the orchestrator
     checklist and Argon (max; 7 verified findings, verdict revise). C7 (two
     copy tweaks) was cancelled as SDD-prescribed copy.
  4. Round-1 corrections: Codex wrote the red tests, then hit a usage limit;
     the Muse fix run hung at OpenCode startup (78 minutes, no work) and Argon
     edited most items then stalled; Codex finished, keeping or correcting
     Argon's edits and writing the C3 query side. GREEN 232/232; the folder run
     gave 845 passed / 4 skipped; tsc clean.
  5. Round 2 (correction diff only), three models at max: MiniMax 3.1 Flash
     (most thorough, both majors), DeepSeek v4.1 Flash (4 real, 0 false) and
     GLM 5.3 Flash (approved; missed the majors). F1-F6 were confirmed.
     DeepSeek wrote the F1-F6 red tests (9 failing), then an OpenCode Go usage
     limit stopped it; Codex wrote the fixes by Owner decision. GREEN 150/150;
     the folder run gave 849 passed / 4 skipped; tsc clean.
  6. Haiku tests: tsc clean; the folder run gave 75 suites passed / 1 skipped,
     849 passed / 4 skipped, 0 failed; 14 named suites 295/296, the one
     timeout (5 s) in ownerEditionPickerMounted "opens/reopens without provider
     search…", which passes in the folder run. Re-run on a quiet machine, the
     file passed twice, 17/17 each run.
  7. Haiku browser check (built-in pane, port 8081, session 7a81bdb6, approved
     script): all 6 steps passed. Step 1 showed the edition lines "New Press ·
     1999 · 9781565845213", "Unwin Hyman · 1989 · 9780044453420" and "No
     edition chosen", with no View metadata and a header without the
     explanation, footnote and chip. Step 2 showed the sheet without detected
     details, Use detected and Edit manually. Step 3, after a title edit, showed
     "No edition chosen — title or author changed" and Ready. Step 4: one press,
     Adding, then added. Step 5: the dialog copy was exact, and Stay kept the
     URL. Step 6: Leave and discard went to /inventory.
  8. Read-only server check (Supabase MCP): Book 3 (38674cf9) was committed,
     commit_outcome committed_private, one inventory item, saved title "False
     Dawn: The Delusions of Global Capitalism", metadataChoice manual, price
     2500. Book 5 (a5da3bc6) was unchanged; the discarded edit was never sent.
  9. Pre-merge review (no PR reviewer, so this stands in for one): the
     orchestrator read the whole slice diff against SDD-1 §4 and found G1 (a
     false "unsaved edits" warning after Add all or Remove). DeepSeek v4.1
     Flash (max, read-only) reviewed F1-F6 (approve; one F4 nit rejected: a
     re-sent save carries the old versions, so the server refuses it), then
     did an independent full review of the whole slice vs 1f98804 (5 findings,
     changes needed). Two were confirmed and fixed by Codex red-first: H1
     (major: the full-review screen's leave dialog was missing on its
     loading/error screens, so Back was blocked with no dialog) and H2 (minor:
     Retry after a later plain search replayed the old identity search). G1:
     RED 2 failed, GREEN 26/26. H1+H2: RED 2 failed, GREEN 21/21. Final run on
     the finished code: tsc clean; folder 75 suites passed / 1 skipped, 853
     passed / 4 skipped, 0 failed. Two earlier DeepSeek runs failed (shell
     commands hung; a crash at step 24) and were rerun without shell access.
  10. Browser re-check after the fixes (Haiku, built-in pane, port 8081; the
     dev server was restarted with --offline after Expo's online version
     check failed; the Owner signed in): A PASS - Book 5 title edit, back:
     "Leave without saving?" / "Your card edits are not saved and will be
     discarded." / "Stay" / "Leave and discard"; Stay kept the URL; Leave and
     discard went to /inventory and the edit was discarded. B PASS - Book 5
     price set to Rs 100, one Add, the card left the list (Added 5 -> 6),
     then leaving showed no dialog. Added: "The concise encyclopaedia of
     Western Philosophy and Philosophers" (9780044453420). Server readback
     was not repeated; the app's Added count is the evidence.
Files/components/migrations: all under src/features/imageInventory/.
  EditionIdentityFix and its test were deleted. No migration and no server
  change.
```

**Review findings.** The orchestrator checked every finding in code before acting.

| Stage | Reviewers | Result |
|---|---|---|
| Orchestrator trace | Orchestrating session | Web leave guard no-op; save-then-search refusal loop |
| Round 1 | Muse Spark 1.3 xhigh; Codex `gpt-6.1-sol` read-only | 17 + 9 findings; C1-C10 confirmed, 2 rejected, 3 deferred to the Owner |
| Round-1 brief check | Orchestrator checklist + Argon (max) | 7 verified findings, verdict revise; C7 cancelled as SDD-prescribed copy |
| Round 2 (correction diff only) | MiniMax 3.1 Flash, DeepSeek v4.1 Flash, GLM 5.3 Flash, all at max | F1-F6 confirmed |

**Deviations.**
- Round 1: Space Bunny failed twice with server errors, so Codex was substituted (deviation).
- Round 1: the Muse fix run hung at OpenCode startup (78 minutes, no work); it was later found to be an OpenCode startup hang, not the model.
- Round 2: the final fix was to be an OpenCode session; the OpenCode Go usage limit stopped DeepSeek, and Codex wrote the fixes by Owner decision (deviation).
- Browser check: two timeouts were slow pages, with tests running in parallel; Haiku stopped as instructed and was resumed by the orchestrator.
- Test run: the single 5 s timeout in `ownerEditionPickerMounted` was a timeout under load, not a code failure; the file then passed twice on a quiet machine, 17/17 each run.

**Deferred to the Owner (not in slice 2).**
- Possible-duplicate cards can still start Add from the card (pre-existing).
- Before edition choices load, the card trusts the summary fallback (pre-existing window; the server refuses safely).
- EditionLine text "title or author changed" also shows for language/script-only changes (SDD-prescribed text).
- MiniMax nits left: the busy dialog copy says "Add in progress" for edition commands; there is no focus restore on Stay.
- The flaky 5 s timeout of the first test in `ownerEditionPickerMounted` under load.
- From the full review: after a "save then search", the card's accepted authority is dropped until the batch refetch lands (pre-existing); a no-op price or condition press counts as an edit for "Edited" and the leave guard (pre-existing); the dialog's switch to the busy copy is not announced (accessibility nit).
- Load-dependent 5 s timeouts also seen once in `unit6gMountedRouteIntegration` (passes alone, 4/4).
- During an edited card's Add, the card briefly showed "The saved review changed while compact edits were open. Choose which draft to continue with." before the Add finished (seen in the re-check; the message comes from card code slice 2 did not change).

Mutations: one inventory commit through the app (Book 3, approved in the browser script). No migrations, no SQL writes, and no Storage, Edge, Render or deployment changes. Supabase MCP was used read-only.

Tracker/source-doc updates: this section; the ACTIVE, DOC-13, SESSION-START and TRACKER handoffs.

Active work unit: `post_scan_rework_slice2_declutter`, until the slice-2 PR merges. Exact next authorized action: the Owner reviews slice 2; on the Owner's request, commit (code, tests and docs; not `.claude/` or `.env.local`), push and open the slice-2 PR. Then slice 3 ("Remove the after-Add buttons and the Inventory tab's duplicate list"). No migration.

## 20. Slice 3 built: remove the after-Add buttons and the Inventory tab's list, 2026-10-20

```text
Date/session: 2026-10-20; same session, right after slice 2's PR #25.
Authorized work unit and scope: post_scan_rework_slice3_inventory_tab; slice 3
  (SDD-1 §5, AC3-1 to AC3-4) on branch claude/phase9-psr-slice3-inventory-tab
  from 68a6cfc (slice 2's tip). Light process (deletion slice, S/low): no
  review loop; pre-merge full review kept.
Completed:
  - After Add: the card shows only "Added to Inventory"; "View in Store View"
    removed.
  - Inventory tab: the scan card alone (Start scan / Resume scan) and the line
    "Added books are in Store View" as an expo-router Link to /store-view
    (44 px target); "Review books (N)", the list, search and load more removed.
  - Deleted: OwnerInventoryReadScreen, InventoryRecoveryCard,
    OwnerInventoryPresentation, useOwnerInventoryRead,
    accumulateOwnerInventoryPages, the unused parts of
    ownerInventoryReadService, and InventoryFilterPanel's ownerRead mode.
    Kept: ownerInventoryReadKeys, OWNER_INVENTORY_CONTRACT_VERSION, the RPC.
  - Tests deleted: OwnerInventoryReadScreen, OwnerInventoryPublication.
    Rewritten: ownerInventoryReadQueries/Service/Architecture, the inventory
    route test, the WU5 e2e spec (list assertions and test 2 removed). New:
    inventoryHubCard.
  - CODEBASE_MAP 03/04 and the validator's WU2 file list updated.
Process and evidence:
  1. Codex hit its usage limit before writing anything; by the Owner's rule
     OpenCode DeepSeek v4.1 Flash (max) coded it in two runs with no shell
     access (it hangs here): phase 1 tests only, phase 2 code only; the
     orchestrator ran every command and deleted the files DeepSeek marked.
     RED: 4 failed for their own reasons (no module errors).
  2. GREEN: tsc clean; image-inventory + store-owner routes: 81 suites passed /
     1 skipped, 820 passed / 4 skipped, 0 failed.
  3. The repo has no ESLint config, so lint could not run; tsc
     --noUnusedLocals on the touched files found only four helper components
     in InventoryFoundationScreens that were already unused before slice 3.
  4. Pre-merge full review: DeepSeek froze at OpenCode startup three times, so
     Codex (gpt-6.1-sol xhigh, read-only; limit reset) reviewed the whole
     slice vs 68a6cfc: K1 the ownerRead filter mode left dead; K2 the Store
     View text link had no href, so Enter did nothing on web. Codex fixed both
     red-first, plus K3 (an unused mock and a 60 s timeout in the new test):
     RED 1 failed, GREEN 2/2, tsc clean.
  5. Final run: tsc clean; image-inventory, stores, storeView and store-owner
     routes: 103 suites passed, 996 passed, 6 timeouts at 5 s while Metro was
     compiling; the two files re-run alone passed 47/47.
  6. Haiku browser check (port 8081; dev server restarted with --clear after a
     stale bundle crashed /inventory): Inventory shows "Scan book spines",
     "Resume scan", the link "Added books are in Store View" (href
     /store-view); no Review books, list, search or Load more. The link opens
     Store View. Book 6 (Charles Peirce) Add: the card left the list (Added 7);
     no "View in Store View" anywhere.
Files/components/migrations: no migration and no server change.
```

Mutations: one inventory commit through the app (Book 6 in session 7a81bdb6, in the approved check). No migrations, no SQL writes, no Storage, Edge, Render or deployment changes.

Deferred: the needs-review queue route (`/inventory/reviews`) no longer has an entry on the Inventory tab (SDD §5 removes the button); its removal or reuse belongs to a later slice.

Active work unit: `post_scan_rework_slice3_inventory_tab`, until the slice-3 PR merges. Exact next authorized action: the Owner merges PR #25 (slice 2), then the slice-3 PR; then slice 4 ("Remove full correction; simplify Add a book", SDD-1 §6) with Codex and the full process. No migration.

## 21. Slice 4a built: remove the full correction screen and finish "Add a book", 2026-10-21

```text
Date/session: 2026-10-21; slice-4a session.
Authorized work unit and scope: post_scan_rework_slice4a_remove_full_correction;
  slice 4a (SDD-1 §6, parts tagged 4a) on branch
  claude/phase9-psr-slice4a-remove-full-correction, cut from origin/main 1268403
  (slices 1–3 merged, PRs #24–#26). origin/main has since moved to 60a6b6c; the
  branch is not yet synced. App only: no migration, no SQL, no Storage, Edge or
  deploy change. Supabase MCP was not used (read-only checks are for 4b).
Completed:
  - Deleted the full-correction routes (inventory/reviews,
    scan/[sessionId]/candidate/[candidateId]), their screens/components, the Mark
    false and replace-variant clients and schemas, the legacy Add variant, the
    full-review draft model (review/reviewForm.ts, applyEditionSelection),
    candidateConflict.ts, ownerCorrectionWorkflow.ts, CandidateCard,
    ReviewFieldControls, CompactReviewEditors, hooks with no remaining caller,
    and the dead imageInventoryKeys.candidates query key with every read and
    invalidation of it and candidatePageFixture.
  - "Add a book" (renamed from "Add missed book"): the 15-book rule reads
    counts.detected >= 15 (the button is disabled with visible scan-full text,
    and disabled without text while the count is not loaded; P9_LIMIT_EXCEEDED
    shows the same text); the language defaults to the session hint through the
    shared chooser panel; the leave guard uses useUnsavedEditsLeaveGuard and
    OwnerConfirmationDialog; the final SDD bullets are Submit, definitive
    refusal, unclear result, retry, success, and scope or identity change
    (fields locked while a kept request exists; retry replays the same
    idempotency key and command ID; unclear results invalidate the batch review;
    one navigation).
  - Card hint text only: "This book can't be changed now." (the condition is
    unchanged, !editable). The readiness summary shows one "Back to review" in
    place of each old "Review next blocker" condition. Notes already saved on a
    review are kept.
Process and evidence:
  1. Codex gpt-6.1-sol xhigh built it red-first: RED 39 failed (38 valid; one
     test waited for a deleted button and was corrected), RED-2 9 failed for
     their own reasons, GREEN 454/454.
  2. Medium review pass: MiniMax 3.1 Flash (10 findings: 7 held, 2 rejected, 1
     deferred) and DeepSeek v4.1 Flash (run 1 blocked by the provider content
     filter; run 2: 7 findings, one new — the limit test did not assert the
     disabled Add button). DeepSeek run 2 had read MiniMax's output from the
     same folder, so independence was compromised; later reviews kept outputs
     outside the worktree.
  3. The SDD-1 "Add a book" leave-guard text was rewritten after two independent
     Sonnet reviews; the first found a blocker: editing fields after an unclear
     result broke the retry and navigation.
  4. Fix round 1 (Codex): F1 busy trap, F2 hint condition restored, F3 silent
     exits, M2 invalidation coverage, N1–N5. Fix 1b (Codex): field lock,
     unclear-dialog copy, one-tick success, batch invalidation on unclear,
     limit-disabled assertion, slow test fixed at the cause (no raised timeout).
  5. Pre-merge review: DeepSeek ended without a report (likely context/step
     limit); MiniMax ran as the fallback: 8 findings, 6 accepted (#1, #3–#7), 2
     rejected (#2: SDD rule plus existing header retry; #8: only one button can
     render). Orchestrator finding P1 (silent lock on a server user mismatch)
     was added.
  6. Fix round 2 by MiniMax (Codex hit its usage limit), in three phases: tests
     only (RED: exactly 3 expected failures), product fix (P1, R1, R5), then R3
     dead-key removal and test updates.
  7. Picker suite timeouts: Codex showed the pre-round code failed the same way;
     the cause was machine contention (an Expo server with --clear running
     alongside Jest). Codex hardened ownerEditionPickerMounted.test.tsx (native
     mock preloading, spy restoration, findBy polling); default timeouts
     unchanged.
Files/components/migrations: 81 files changed versus 1268403 in src/, app/ and
  e2e/ (26 deleted, 55 modified), plus one new file,
  src/features/imageInventory/components/LanguageChooserPanel.tsx; +1208 /
  −5575 lines. No migration and no server change.
Earlier verification (quiet machine, 2026-10-21, before the Back-to-review
  fix): picker suite 16/16 twice; npx jest
  src/features/imageInventory: 67 suites passed / 1 skipped, 775 passed / 4
  skipped, 0 failed; app/(store-owner) routes 7 suites, 9/9; npx tsc --noEmit
  clean; --noUnusedLocals 50 diagnostics repo-wide, none introduced by this
  slice. The folder test count is lower than slice 3's 849 because the deleted
  screens' test files were deleted.
Browser check (2026-10-21, web, real backend, Owner signed in): the Owner's
  image was scanned into a new session 8eb9b18a-2088-49c6-a915-16fc194cd253 (11
  books). A Haiku subagent ran the script, then the orchestrator re-checked
  every failure in the browser.
  - Passed: "Add a book" present and enabled (no "Add missed book"; no "Open
    full correction" anywhere); the form shows heading "Add a book", "Adds one
    book to this scan for you to check.", Title, Authors, Language preset to
    English and "Add book"; the one approved manual book "The Name of the Rose"
    / Umberto Eco was added (Detected 11 → 12; card BOOK 12, language en,
    "Finding edition…"; nothing added to inventory); /inventory/reviews and the
    candidate route show "Unmatched Route"; on the closed session
    7a81bdb6-ed34-40cb-b5a9-cff85402cf48 "Add a book" is disabled (by design).
  - Leave guard on web, with the in-app back link: dialog "Leave without
    adding?" / "This book's details exist only on this screen." / Stay / Leave;
    Stay keeps the typed title; Leave exits and adds nothing (Detected stays 12).
  - Not app bugs: the subagent saw 6 of 11 cards because the list renders cards
    as they scroll into view; its "no leave dialog" came from a full-page reload
    used as Back (that unloads the app).
  - Bug found and fixed (new in 4a): the summary's "Back to review" used
    router.push to the session route, which stacked a second session screen;
    that copy showed "Saved scan progress could not be loaded." and its Retry
    did not clear it. Fix (Codex, red-first: RED 4 failed → GREEN 11/11 in
    ReadinessSummaryScreen.test.tsx):
    router.dismissTo(inventoryRoutes.session(sessionId)) on both buttons
    (expo-router 6.0). Re-checked in the browser: session → summary → "Back to
    review" returns with all cards; summary opened directly → "Back to review"
    opens the session with all cards.
  - Open observations (not fixed, not shown to be caused by 4a): (1) why a
    second mounted session screen fails its session/inputs reads and Retry does
    not re-send them (no longer reachable through "Back to review"); (2) when
    the 11 new cards first rendered, six
    phase9_owner_candidate_edition_choices_v1 calls returned 400 and the edge
    function returned 409 (42 other calls that hour returned 200). Codex's
    investigation of both was cut off by its usage limit.
Final verification after the fix (quiet machine, 2026-10-21): npx tsc --noEmit
  clean; npx jest src/features/imageInventory: 67 suites passed / 1 skipped,
  777 passed / 4 skipped, 0 failed; app/(store-owner) 7 suites, 9/9.
Deviations:
  - MiniMax ran a few read-only shell commands (wc, rg, cat, ls) despite the
    no-shell instruction in fix round 2; no effect on files.
  - The picker-suite timeouts were diagnosed on the pre-round code and fixed at
    the cause; default timeouts were not raised.
  - Codex hit its usage limit twice (fix round 2; the Back-to-review
    investigation).
Deferred items (recorded, not fixed):
  - After P9_STATE_CONFLICT the message asks the Owner to refresh, but the
    screen has no refresh control (MiniMax #9 / DeepSeek #7; pre-existing).
  - Scope or identity change during an add: the kept request is dropped; if that
    add had succeeded, the Owner could add the same book again under a new key
    (accepted for 4a; rare).
  - 4a→4b gap: a card blocked only by variant_source_stale cannot be added and
    shows the generic hint until 4b; 4b must merge before the Owner's next scan.
D2-5 exceptions (kept on purpose):
  - resolveExpectedVariants and decideVariant (approved; used by 4b).
  - list_scan_candidates transport/contract/schema and the OwnerCandidatePage
    type stay (wire contract; the server function stays for older apps); no app
    caller remains.
Process decisions recorded this slice (Owner, 2026-10-21):
  - SDD reviews use Sonnet + OpenCode "Argon"; complex SDDs use Opus instead of
    Sonnet; Argon also reviews complex code.
  - Large review diffs are split between reviewers; a stalled OpenCode session
    may be resumed by ID.
```

Mutations: none by this session beyond the approved app actions in the browser check (one new scan session with 11 books from the Owner's image, and one manual candidate, "The Name of the Rose", added through the app; nothing added to inventory). No migration, SQL or Storage mutation. Nothing deployed.

Active work unit: `post_scan_rework_slice4a_remove_full_correction`. Exact next authorized action: on the Owner's go: commit (code, tests, docs; not `.claude/` or `.env.local`), sync the branch with origin/main `60a6b6c`, Haiku re-runs the final tests, push and open the slice-4a PR. Then slice 4b code. Slice 4b's SDD and its read-only Supabase check were done in a separate session (branch `claude/phase9-psr-slice4b-sdd-ffa027`, uncommitted; recorded there in tracker 38 §22) and wait for the Owner's approval and decisions 4b-1 to 4b-5.
