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

## 22. Slice 4b SDD and read-only Supabase check, 2026-10-21

```text
Date/session: 2026-10-21; slice-4b SDD session (worktree
  phase9-psr-slice4b-sdd-ffa027, branch claude/phase9-psr-slice4b-sdd-ffa027;
  after the Owner reported 4a complete, the branch was moved onto slice 4a's
  local tip 8c1b004 and the doc edits re-applied). No product code.
Supabase MCP, read-only (SELECT and catalog reads only), project verified:
  https://ahntbtktjjmvfosgkmgn.supabase.co.
  (a) phase9_owner_search_variant_review returns stale rows when p_status is
      null, but only rows whose field the card's saved review confirms
      (confirmed IS NOT NULL); it pages the whole store newest first; the
      client reads at most 3 x 100 and throws P9_INTERNAL_ERROR on any id not
      found. Live body is later than M24 (author_position = author_index-1).
  (b) phase9_owner_decide_search_variant is identical to M24 L204-293:
      Owner only (phase9_is_store_owner); replay answered before the version
      check; P9_STALE_VERSION on mismatch; reject refused only from rejected.
  (c) No, not on a card save. The live trigger fires only when
      committed_inventory_id changes or the snapshot has no 'value' (M29
      L90-101); the app saves through _v2, which always writes 'value'. At
      commit it stales changed proposed/active proposals on the added book.
      The SDD's "the save makes proposals stale" and the second rejection
      round were wrong and are removed.
  (d) variant_source_stale: EXISTS a stale proposal for the candidate (M55
      L119-121; live phase9_edition_legacy_review_blockers after the M69
      rename; also phase9_owner_ux_attention). The _v2 save raises
      P9_STATE_CONFLICT while any blocker remains (M62 L120-126).
  Also: every proposal change sets the card's review_ready=false and
  version+1 (trigger phase9_owner_ux_variant_revision, M29 L137-148; found by
  the Argon review, confirmed live). With a chosen edition the server
  requires review script = edition script (M69 L26). Live data: 2 proposals
  (fixtures), 0 stale; 4 of 192 candidates have an observed script; 29 saved
  reviews have a null script.
SDD changes (SDD-1 §6 4b parts; SDD-0 F26, F41 citation, §15 "SDD reviews"):
  stale-wording section rewritten (server facts, admission, one-round
  sequence with two status reads, frozen rejection list and keys, re-save
  from the reread, retry rules, outcome table, wiring); script recompute
  covers title + authors, never null with manual metadata, keeps a chosen
  edition's script; AC4-4, AC4-4b, AC4-7 rewritten; new SQL suite named
  because the variant suites stop at M27/M28.
Reviews (read-only; outputs kept outside the worktree):
  Opus subagent: approve with fixes, 11 findings; all verified and applied
  (#4 reworded: an already-rejected proposal answers P9_STALE_VERSION).
  OpenCode Go gemini-4-argon-contributor: approve with fixes, 7 findings; all
  verified and applied (run 1 aborted on a file outside the worktree; run 2
  had the live facts inline).
Owner decisions (2026-10-21, after discussing scope and the existing Unit 5C
  plan): 4b is reduced to S / med: (1) script recompute, (2) Kannada, Telugu
  and Malayalam in LANGUAGE_OPTIONS, (3) removal of the unused
  resolveExpectedVariants / decideVariant client (ends the 4a D2-5
  exception). Clearing stale search wording is deferred: built before any
  Unit 5C language is switched on (SDD-1 §6, SDD-0 §11, 05c §13 item 6). A
  chosen edition keeps its own script even if null (4b-4). If no script fits,
  the script stays null as today (corrects the earlier "never null" text,
  which could leave a mixed-script card stuck). The large design above and
  its review findings are kept as the starting point for the deferred work.
  Decisions 4b-1, 4b-2, 4b-3, 4b-5 are moot.
Small-4b SDD review (read-only, outputs outside the worktree):
  Sonnet subagent: approve with fixes, 11 findings, all verified and applied.
  Main one (high): the app's script rule is looser than the server's
  phase9_owner_ux_language_script (M29 L783-818; live body identical), so a
  recompute could pick a script the server refuses; the recompute now
  requires both rules, with a SQL parity test. Others: recompute only in
  validateCompactReview after the edition choice; input normalisation and
  the server's tag-subtag rule; exact removal list and architecture-test
  rewrites; AC4-10/11 tests; leftovers from the large design reworded; link
  added in Unit 5C §13.
  OpenCode Go gemini-4-argon-contributor: run 1 stalled with no output and was
  stopped; run 2 was stopped on the Owner's instruction (2026-10-21: "ignore
  argon"). The small-4b text has one independent review (Sonnet).

```

Mutations: none. Nothing staged, committed, pushed or deployed. No database or Storage mutation.

Active work unit: `post_scan_rework_slice4b_script_languages` (SDD only). Exact next authorized action: on the Owner's go, commit these docs on this branch; recheck the brief's line numbers on this branch, then send the 4b Codex brief (`.claude/psr-slice4b/`, red-first) with the SDD-0 §15 medium review pass. The 4b PR follows the slice-4a PR.

## 23. Slice 4b local implementation and verification, 2026-10-21

Date/session: 2026-10-21, Codex coding brief, selected worktree on
`claude/phase9-psr-slice4b-sdd-ffa027`, starting at `39b993a`.

Authorized work unit and scope: `post_scan_rework_slice4b_script_languages`;
Owner approved the small scope and implementation start. SDD-1 §2 D2-3/5/6
and §6 (4b only), AC4-7, AC4-10, AC4-11. Stale wording remains deferred.

Completed: script derivation only during manual compact-review validation,
after the unchanged choice decision; normalized inputs, both coherence rules,
null fallback, saved-script stability, chosen-edition preservation; three shared
language options; removal of variant operations and their unused contracts,
types/constants/error branch/cases. No remaining variant query keys existed.
The production card identity/edit logic and `commit/` files are unchanged.

Files/components/migrations: five production TS files, eight affected Jest
files, two shared test fixtures and one new current-migration PGlite parity
suite. No migration. All paths and every new test/red reason are recorded in
[the slice verification report](../supporting/post-scan-slice4b-verification.md).

Verification actually run: all named tests before product code; initial Jest
34 failed / 164 passed / 198 total, SQL 12 passed / 13 failed / 25 total
(including the parent). Saved-script preservation was strengthened red-first
with a separate 1 failed / 81 name-filtered skipped run. Final full feature
assertions: 67 passed suites / 1 skipped, 831 passed tests / 4 skipped, 0 failed;
serial-process non-exit warning and cleanup follow-up are recorded in the report.
PGlite parity: 25 passed, 0 failed, through current M77. Ordinary TypeScript:
10 diagnostics in untouched Library/Clubs/e2e paths; type-check gate open.
HEAD reproduces the same ten ordinary errors. The no-unused compiler comparison is HEAD 54 / current 54, zero new diagnostics; affected handle proof is 8 suites / 229 tests, exit 0. Final test-only cleanup reruns passed service 8/8 and architecture 9/9. The full feature process exited naturally with code 0; its warning is retained. The report owns raw failures and method details.

Supabase/external mutations: none. No MCP, CLI, database/Storage, migration,
provider or deployment action. Nothing staged, committed, pushed or branched;
pre-existing untracked `.claude/` is preserved. No Python tests were run.

Decisions/deviations/risks: no SDD behavior or acceptance change, and no new
product decision. Two old picker null-script expectations and three stale-choice
assertions were updated to the approved recompute behavior, preserving their
notes and choice checks. The type-check environment and full-run process warning
remain explicitly visible; no successful TypeScript build or live acceptance is
claimed. Medium/pre-merge reviews and browser checks were not part of this
bounded coding execution and are not claimed complete.

Tracker/source-doc updates: ACTIVE, DOC-13, SESSION-START, phase tracker,
implementation tracker, this evidence, requirements traceability and the relevant
codebase maps. The approved SDD text is unchanged. Validator and final whitespace
results are recorded in the verification report.

Active work unit: `post_scan_rework_slice4b_script_languages`. Exact next
authorized action: the orchestrating session reviews the uncommitted 4b diff
under SDD-0 §15's medium review pass. The type-check gate needs a dependency
repair and rerun; Git publication and all external actions remain unauthorized.

## 24. Slice 4b review, browser check and type check, 2026-10-21

```text
Branch claude/phase9-psr-slice4b-sdd-ffa027, base 39b993a, implementation
uncommitted (Codex gpt-6.1-sol xhigh; tracker 38 §23).
Medium review pass (SDD-0 §15), read-only, outputs in .claude/psr-slice4b-review/
(not committed):
  OpenCode Go models refused: "An active OpenCode Go subscription is required".
  Owner chose the free OpenCode models.
  opencode/deepseek-v4.1-flash-free (max): no blocking or correctness defect;
    ran the affected suites (229/229); could not write its report in plan
    mode, so its findings were taken from its session summary.
  opencode/minimax-m3.1-flash-free: run 1 ended on a misspelled path
    (auto-rejected); run 2 stalled; no report.
  GPT-6 Luna via Codex (xhigh, read-only; Owner request): approve, no findings.
  Haiku 5.5 (Owner request): approve with fixes; medium finding that the
    server [:alpha:] denominator is locale-defined and could count digits.
    Disproved live (read-only SELECT, project ahntbtktjjmvfosgkmgn):
    datctype en_US.UTF-8; '٠' '५' '೫' '5' anusvara and virama are not
    [:alpha:]; phase9_owner_ux_language_script accepts kn/Knda, hi/Deva,
    te/Telu, ml/Mlym, ta/Taml pure-script titles and hi/Deva with Arabic-Indic
    digits; rejects mixed 'ಕನ್ನಡ Book ಕುವೆಂಪು' for Knda and Latn. The server
    denominator is never larger than \p{Alphabetic} for these inputs, so the
    app mirror is the stricter rule. Low items: forced save before Add for an
    old null-script card is intended (SDD-1 §6); SQL parity checks only the
    accept direction; one test title names Kannada but covers all three.
  No code correction.
Tests (Haiku run, report only): Jest 7 failed / 824 passed, every failure
  "Exceeded timeout of 5000 ms" under machine load (two reviewers running);
  batchReviewCard.test.tsx alone 58/58; PGlite parity 25/25; git diff --check
  clean. npx tsc --noEmit: 10 TS2307/TS7006 errors with the shared install;
  after npm ci in this worktree (package-lock unchanged) exit 0, zero errors.
Browser check (Haiku, built-in browser, Owner signed in, scan 8eb9b18a):
  card language chooser lists English, French, German, Spanish, Hindi, Urdu,
  Tamil, Kannada, Telugu, Malayalam; searching "Kannada" shows only Kannada.
  Added through the app, read-only readback of owner_review_snapshot:
    9cc79d91 'गोदान' / 'प्रेमचंद', hi, script Deva, manual, committed
    98441e59 'ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು' / 'ಕುವೆಂಪು', kn, script Knda, manual, committed
    70e992d4 'ಕನ್ನಡ Book' / 'ಕುವೆಂಪು', en, script null, manual, committed
    42012546 'Only Doing It for Sixty Years' / 'Test Author', en, Latn, committed
  Not run in the browser: chosen edition (the panel lists editions only after
  Search Books) and leave guard (the web scan page has no back control);
  covered by "keeps the edition's script and choice" and "a recomputed script
  is not an edit". One card (Hatha Yoga Book 5) kept an unsaved price edit.
Database writes: the four app Adds above (dev data). Orchestrator SQL was
  read-only. No migration, Storage, Edge or deploy change.
Found for Unit 5C (corrected below): 05c SDD §2 still says no generation,
  activation or search-projection runtime exists; the code has Gemini
  romanization in the scan prompt, proposal persistence in the vision worker
  and active-variant search (M20-M23); activation stays gated (0 rollouts
  live). Deployed phase9-owner-ingestion is version 17; whether it includes
  romanization was not checked.
SDD-1 AC4-10 chooser reference corrected to LanguageChooserPanel.tsx L18.
SDD corrections (Owner, 2026-10-21): 05c §2 runtime status rewritten from the
  findings above (header status line too); 05c §10 and §13 item 7 record the
  Owner's decision that fuzzy, language-filtered search in the store view and
  the marketplace is planned with the marketplace search work; SDD-0 §11
  regional-books bullet points to it. No behaviour change in Phase 9.
```

Active work unit: `post_scan_rework_slice4b_script_languages`. Exact next authorized action: on the Owner's go, commit the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), push the branch and open the 4b PR after the slice-4a PR.

## 25. Slice 4a pre-merge review and fix, 2026-10-22

```text
Target: PR #27 tip 8c1b004 (base 4a1daea = origin/main). Earlier pre-merge
review (DeepSeek, 2026-10-21) stalled without a report; fixes 3 and 4 landed
after it started. Reviews here, read-only in the 4a worktree, outputs in
.claude/psr-4a-premerge/ (not committed):
  OpenCode Go deepseek-v4.1-flash (max), product code: approve with fixes.
    Medium: MissedBookScreen run() awaited client.invalidateQueries before the
    unclear message (L130-134), before success (L164), and sessionQuery.refetch
    before the conflict message (L176). TanStack Query pauses refetches while
    offline on react-native-web, so finally never ran: inFlight stuck, no
    message, leave dialog Stay only. Confirmed in code. Low: dead re-export
    sourceBadgeLabel (BatchReviewCard.tsx L35). Low UX: Add shows no spinner
    during the post-RPC busy window (not changed).
  OpenCode Go muse-spark-1.3 (xhigh), tests: approve with fixes; five test
    gaps, no product defect (product checked: Retry disabled when
    !gate.canMutate, MissedBookScreen L256).
  minimax-m3.1-flash-free: no report (temp-folder write auto-rejected).
Fix (OpenCode DeepSeek, build agent, on the 4b branch, brief FIX-BRIEF.md):
  outcome published first, refresh best-effort with caught rejection; conflict
  shows the refusal at once and replaces it only if the background re-check
  fails. Red: 4 failed / 42 passed (the three never-settling-refresh tests and
  the updated success timing). Green: 4 suites, 146 passed, 0 failed; tsc exit 0.
  Tests added: offline Retry disabled with Leave available; unclear again after
  Retry with an identical third attempt; store and account switch; exact
  "Add book"/"Add a book" labels; six more removed names in unit6fArchitecture.
  Dead re-export removed.
Second review (OpenCode Go muse-spark-1.3 xhigh, read-only, fix diff only):
  request changes, one medium: the conflict re-check ran in the background
  with only scope guards, so a late error could overwrite the outcome of a
  newer submit on the same screen. Confirmed in code. Fixed (OpenCode
  DeepSeek, FIX2-BRIEF.md): a run-generation ref gates both re-check
  callbacks; stray awaits on the now-synchronous reportUnclear dropped.
  Red: new test "keeps the newer outcome when a late conflict re-check
  reports an error" failed (second refusal replaced by the verify message).
  Green: OwnerCorrectionScreens 47/47. Not changed: Muse's minor note on
  toBe(original) (Retry really reuses the same command object).
Final checks, 2026-10-22: full src/features/imageInventory Jest 841 passed,
  4 skipped, 3 failed, all "Exceeded timeout of 5000 ms" under load
  (ownerEditionPickerMounted, ownerEditionPickerSheetStates,
  CaptureWorkflowNavigation); those three suites alone with -w 1: 49/49
  passed. npx tsc --noEmit exit 0. git diff --check clean.
```

Active work unit: `post_scan_rework_slice4b_script_languages`. Exact next authorized action: commit 4a's fix, the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), rebase onto origin/main, re-run a key suite, and push to main; then start slice 5 from the kickstart prompt.

## 26. Slice 5 SDD written, reviewed and approved; reorder recorded, 2026-10-22

```text
Date/session: 2026-10-22, orchestrating Claude session (slice 5 design).
Authorized work unit and scope: Owner asked for the slice 5 SDD (5a and 5b in one
  file), its review, and on approval to record the reorder and prepare the 5a
  Codex brief. Docs only.
Completed: work-units/post-scan-rework/01a-slice5-typed-isbn-sdd.md written from
  three read-only Haiku code maps, the author's own code checks and read-only
  Supabase MCP queries. Reviewed twice: Sonnet subagent (approve_with_fixes,
  F1-F12) and OpenCode Go DeepSeek v4.1 Flash max (rework, F14-F22); author
  finding F13 (worker decoder refuses hand-added cards). All 22 findings
  verified in code or live and applied (SDD §17). OpenCode Go Argon failed
  four times at the provider ("Upstream request failed: Endpoint is
  unavailable"). Owner approved the SDD with D5-1 to D5-6 as recommended.
Files/components/migrations: 01a-slice5-typed-isbn-sdd.md (new); SDD-0 §7.1
  row 5 and §7.2a reorder note; SDD-1 status note and §7 superseded banner.
  No code. No migration file (M78 is designed only).
Verification actually run: read-only SQL on ahntbtktjjmvfosgkmgn (migration
  history through M77; provider registry; normalized language/ISBN helpers;
  ISBN-only key text; service_role privileges; edition jobs by card type);
  live Open Library HTTP (/isbn 302, search.json?isbn= shape for two works,
  /books headers). Phase 9 validator and git diff --check: see §27 or the
  closing handoff.
Supabase/external mutations: none. Read-only SELECTs and public HTTP GETs only.
Decisions/deviations/risks: D5-1 slice 5 built after 4b and before Stage 2
  (slices 11, 13); D5-2 saving an ISBN drops a chosen edition; D5-3 new stage
  name `edition`; D5-4 5b keeps title required, optional ISBN; D5-5 ISBN shown
  in the sheet only; D5-6 5b has no migration and accepts a book added without
  its ISBN when the Owner leaves instead of retrying. Found: Search Books never
  worked for hand-added cards (worker decoder, B3a); fixed by 5a. Slices 11 and
  13 pass 2 must account for owner_isbn13 and the identity change.
Tracker/source-doc updates: this entry; TRACKER.md and DOC-13 handoffs.
Next authorized action and gate: write the 5a Codex brief and have it reviewed
  (Argon, else DeepSeek). Sending it needs the Owner's approval to create the
  M78 migration file, and a new branch for 5a from origin/main.
```

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: review the 5a Codex brief; then, on the Owner's approval of migration-file creation, cut the 5a branch from origin/main and send the brief.

## 27. Slice 5a built, reviewed in two rounds and verified locally, 2026-10-23

```text
Date/session: 2026-10-22/23, orchestrating Claude session; Codex gpt-6.1-sol
  (xhigh) wrote the code in worktree phase9-psr-slice5a-typed-isbn on branch
  claude/phase9-psr-slice5a-typed-isbn (cut from dcb2178 = origin/main 5946e68
  plus the slice 5 SDD commit).
Authorized work unit and scope: Owner approved creating the M78 migration file
  (local only, not applied), committing the slice 5 docs, cutting the 5a branch
  and sending the reviewed brief; later both review-fix rounds, the 978/979
  clarification, Haiku's independent test run, docs and a local commit (no push).
Completed: SDD 01a §1-§14 (5a). M78 file
  20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql. Worker ISBN
  mode (search -> edition chosen by ISBN match -> /books/OL...M.json as stage
  `edition` -> authors); decoder accepts edition contexts without input and
  observation ids. Edge action `set_candidate_isbn` with its own RPC route and
  exact v1/v2 header forwarding. App ISBN box, "Search by ISBN", "Search by
  title instead", ISBN-mode retry, pending record per press (review save alone
  -> set -> re-read -> exactly one request), per-code recovery (SDD §9).
Brief review: Sonnet (15 findings) and OpenCode DeepSeek (18); all verified
  and applied before sending (Argon unavailable at the provider).
Code review round 1: author traced review (clean apart from one Low note); GLM
  5.3 Flash (A clean; B one hardening note; C 2 Low), MiniMax 3.1 Flash (A 1
  Low; C 4), Muse Spark 1.3 (B clean), DeepSeek (A and B clean; C incomplete).
  Six confirmed fixes: stale title-mode retry hidden in ISBN mode; version-
  conflict recovery; ISBN keyboard; discovery/readiness cache refresh; worker
  ISBN mode from query strategy; parity test corrected, plus a real M78 case.
Code review round 2: Codex gpt-6-luna read-only on the whole slice (1 Low),
  GLM (2), Haiku (4), Muse (1, rejected: the iOS numbers-and-punctuation
  keyboard can switch to letters). Five confirmed fixes: "card changed" errors
  map to reload; async retry; app rejects ISBN-13 outside 978/979 (Owner-
  approved SDD §8 clarification); every refusal ends "Close the sheet"; ISBN-
  mode retry replaces the title "Search Books" button.
Deviations: test edit by the orchestrator in phase9EditionExplicitMatching
  L93 (the unknown-header case uses edition-reasons-v3 because v2 is now
  supported). Open Library fixtures are synthetic provider-shaped JSON, not
  captured responses. The app ISBN helper deliberately differs from the shared
  one on the 978/979 prefix (test pins it).
Files/components/migrations: M78 (new, not applied); worker metadataJobContext,
  openLibrary adapter and transport; shared and app ownerEditionPicker
  contracts; ownerEditionPickerGateway, ingestion, ownerUxRequests; app
  service, commands, transport, queries, new ownerEditionPickerIsbnMutation,
  review/isbn.ts, review/isbnSearchRecovery.ts, CandidateEditionIsbnSearch,
  CandidateEditionPicker; new and extended tests (DB, Postgres, worker, Edge,
  app).
Verification actually run:
  Codex (final): focused app Jest 65/65; full Jest 2,225 passed, 2 timeouts in
  untouched files that pass alone; tsc 0 errors outside src/features/books/
  export; worker build clean; M78 PGlite 28/28; structural metadata 15/15;
  git diff --check clean.
  Orchestrator: real-Postgres runner -IncludeEditionPicker 19/19 including two
  ISBN lock races (Codex's sandbox cannot run initdb, error 87); edited
  regression suite plus M78 suite 75/75; the 3 phase9MetadataFoundation
  failures reproduced on the base without 5a code (pre-existing).
  Haiku independent run (no new failures): tsc only the 8 known books/export
  errors; Jest 2,227 passed, 4 skipped, 0 failed; worker build clean;
  test:phase9:db 843/846 (the 3 known phase9MetadataFoundation failures);
  structural metadata 15/15; Postgres -IncludeEditionPicker all PASS markers;
  git diff --check clean.
Supabase/external mutations: none. No migration applied, no deploy, no
  provider call (fixtures only).
Known pre-existing: 3 phase9MetadataFoundation failures; tsc errors in
  src/features/books/export from missing packages in the shared node_modules.
Next authorized action and gate: Owner approval to (1) preflight and apply M78
  to ahntbtktjjmvfosgkmgn, (2) deploy the metadata worker, (3) deploy the
  owner-ingestion Edge function, in that order; then the in-app check (AC5a-1,
  AC5a-16c), sync with origin/main and the 5a PR. 5b follows 5a.
```

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, preflight and apply M78 to `ahntbtktjjmvfosgkmgn`, deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c).

## 28. M78 dedicated review, fix and live application, 2026-10-23

**Why.** M78's earlier review relied on reviewers since dropped from the lineup (MiniMax, DeepSeek), so the Owner asked for a dedicated migration review before applying it.

**Review.** Same brief for Muse Spark 1.3, GLM 5.3 Flash, Haiku and Codex gpt-6-luna. The Owner cancelled GLM and Luna mid-run; Muse and Haiku completed.
- Confirmed, Medium (Haiku; Muse saw only the missing test): `phase9_set_candidate_isbn_v1` revoked EXECUTE only from PUBLIC and anon. The live default ACL for functions `postgres` creates in `public` is `{postgres=X, anon=X, authenticated=X, service_role=X}` (read-only query, 2026-10-23), so `service_role` would keep EXECUTE, contrary to SDD §5.5.
- Confirmed test gaps (Muse, Low): no 13-digit non-978/979 value at the command; no `(1,'editions')` completion in ISBN mode; no race between two ISBN presses.
- Rejected (Muse): "two presses with the same expected version both pass the version fence". `phase9_edition_assert_owner_candidate` locks the candidate row before the version check, so the second press waits and then fails with `P9_CANDIDATE_VERSION_CONFLICT`. The new race test proves it.

**Fix (Codex gpt-6.1-sol, red-first).** M78 L463 now revokes from PUBLIC, anon, authenticated and service_role before granting `authenticated`, as M70 does. Tests: the harness reproduces the live default ACL, and the readback asserts `service_role` and PUBLIC are refused (red 28/1, green 29/0); command rejects `9770306406158`; ISBN-mode `editions` completion succeeds; two concurrent different-ISBN presses accept exactly one, with version +1 and no deadlock. Verification: PGlite M78 suite 29/29; `npm run test:phase9:db` 844 passed with the 3 known `phase9MetadataFoundation` failures; real-Postgres runner `-IncludeEditionPicker` 20/20 (`EDITION_PICKER_REAL_POSTGRES_ACCEPTANCE_PASS`, `POSTGRES_TEARDOWN_PASS`); `git diff --check` clean.

**Preflight (Haiku, read-only, project `ahntbtktjjmvfosgkmgn` re-verified).**
- M78 absent; none of the objects it creates exist; every object it replaces, drops or alters exists with the expected signature.
- No drift: the whitespace-stripped md5 of each of the seven live bodies equals the latest earlier local migration.
- No `phase9_metadata_provider_calls` row violates the widened stage check. Row counts: 192 candidates, 183 provider calls, 7 edition states. No locks or long transactions.
- `phase9_replay` refuses a NULL actor through the NOT NULL `actor_or_service` column.
- Flag, resolved: the newest live migration is `20261022160000_library_reading_history`, absent from this branch. It is on origin/main and creates only the library reading tables, so it does not interact with M78.

**Application.** The Owner approved applying. Supabase MCP `apply_migration` returned `declined` twice, with no prompt shown, including after the Owner said they would approve it. The likely cause is the server's confirmation request for destructive statements (M78 drops and re-creates a constraint and a trigger), which this client cannot display. The Owner ran the file in the Supabase SQL editor: "Success. No rows returned". There is no `supabase_migrations.schema_migrations` row for M78.

**Readback (read-only, SDD §5.8).**
- `owner_isbn13`: text, nullable, no default. The check is `owner_isbn13 IS NULL OR owner_isbn13 ~ '^97[89][0-9]{10}$'`. 0 non-null rows.
- `phase9_edition_http_stage` now allows `(1,'editions')` and `(1,'edition')`.
- The trigger is `BEFORE UPDATE OF … review_disposition, owner_isbn13`.
- The command is SECURITY DEFINER, owned by `postgres`, with `search_path=""`. EXECUTE: anon false, PUBLIC false, service_role false, authenticated true.
- Both new helpers refuse anon, authenticated and service_role.
- All replaced functions are owned by `postgres` with `search_path=""`. SECURITY DEFINER is kept everywhere except `phase9_edition_option_eligible`, which is not SECURITY DEFINER in the file either.
- The whitespace-stripped md5 of all ten function bodies equals the local file.

**State.** M78 is APPLIED_VERIFIED. There was no data change. The metadata worker and the owner-ingestion Edge function are not deployed yet; until they are, the app does not send the v2 header and nothing calls the new command. The fix and docs were committed afterwards as `0f4fbd1` (§29).

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, commit the M78 fix and docs on the 5a branch, deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c).

## 29. Slice 5b start: branch, Owner decisions and docs reconciliation, 2026-10-23

**Correction to §28.** The M78 fix and the docs recorded in §28 as uncommitted were committed on the 5a branch as `0f4fbd1` (after `1d4f80e`). Nothing is pushed.

**Owner decision (2026-10-23).** Build slice 5b before deploying anything. After 5b: deploy the metadata worker, then the owner-ingestion Edge function, then one in-app check covering 5a and 5b together (AC5a-1, AC5a-16c and the 5b checks). No build with an ISBN box reaches real users before that check.

**Branch.** `claude/phase9-psr-slice5b-add-isbn`, cut from the 5a tip `0f4fbd1` because 5b needs 5a's code. It has its own worktree (`.claude/worktrees/phase9-psr-slice5b-add-isbn`), so the 5a branch keeps its checkout while its PR is pending. `node_modules` is a junction to the 4b worktree's install (the same one the 5a worktree uses); no `npm ci`. C: had 8.0 GB free. The first `git worktree add` failed with "Could not reset index file"; it left only the branch, and a retry with `core.longpaths=true` succeeded.

**Owner answers to the 5b session summary.** Recorded as a dated note in SDD 01a §15; none changes 5b's scope:
- D5-4 was approved on 2026-10-22, so §15's "pending Owner confirmation" is settled.
- The pending record also freezes the search request's key and command ID: one press, one record, four steps.
- The search request is built from re-read edition choices, as in 5a. Reason found in code: `acceptEditionChoices` (`ownerEditionPickerCache.ts` L12–44) checks the read against the card's known versions and refuses stale or regressing generations before the request is built; the 5a brief required building it from the re-read, "not from the set response". The Owner's rule was to reuse 5a's chain if the re-read exists for freshness.
- With an ISBN, the Owner stays on Add a book after the last step, with "Book added. Open Find or change edition to choose its edition." and a button to leave.
- The leave dialog says the book is added without its ISBN while the ISBN steps are unfinished.
- Retry labels: "Retry same addition", "Retry ISBN save", "Retry search".

**Codebase map.** Read `CODEBASE_MAP/README.md` ("When to update"). 5b adds no route, service, screen, Edge function or backend path: the add stays a direct RPC (03 L28) and the ISBN steps use the existing edition-picker Edge actions. No map change is needed.

**Docs reconciled.** `ACTIVE.md`'s handoff log gained the three missing entries (slice 5 SDD, 5a built, M78 applied) and this one; DOC-13 and the phase tracker got this handoff.

Supabase/external mutations: none. No code changed.

### Existing edition-selection flow, browser check, 2026-10-23

Haiku drove the Browser pane on the 5b app code with M78 live (Edge v17 and the
worker still pre-5a). First run (Darwin card): no editions listed. Read-only
evidence: the worker's lookup for that card ended `no_match` (a genuine
provider result), and the choices RPC returned 400 only during the ~20 s after
the cards were created, then 200. Not a 5b regression (5b has no migration,
Edge or worker change). Second run (The Origin of Species card, lookup
`ambiguous`): Find or change edition -> Search Books -> "4 selectable editions
in 10 results" -> Select edition on the Standard Ebooks 2019 option ->
"Edition saved."; the card then showed "Standard Ebooks · 2019". Read-only
SELECT after: candidate `version` 1->2 and `metadata_revision` 4->5. Passed.
Not verified: the 400 on `phase9_store_metadata_cache` (worker, 7 calls) has no
baseline from before M78; console 409/403/503 responses were not attributed to
URLs. Writes: through the app only (dev data).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: build slice 5b next (branch from 5a tip `0f4fbd1`); after 5b, deploy the metadata worker then the owner-ingestion Edge function, then run the in-app check for 5a and 5b together (AC5a-1, AC5a-16c, 5b checks).

## 30. Slice 5b built, reviewed and verified locally; partial browser check passed, 2026-10-23

```text
Date/session: 2026-10-23, orchestrating Claude session; Codex gpt-6.1-sol (xhigh)
  wrote the code in worktree phase9-psr-slice5b-add-isbn on branch
  claude/phase9-psr-slice5b-add-isbn (cut from the 5a tip 0f4fbd1).
Authorized work unit and scope: Owner (2026-10-23) asked to complete the 5b
  implementation to the plan, using judgment and reporting after the browser
  test. No migration, Edge, worker, database, deploy, stage, commit or push.
Brief review: Muse Spark 1.3 on the Codex brief: REWORK, 13 findings, all
  verified in code and applied (strict form schema would reject every submit;
  navigation race with the auto-navigate effect; inputs re-enabling after
  success; a wrong claim of mine about acceptEditionChoices; refusal-table
  gaps; test gaps).
Completed (SDD 01a §15, AC5b-1..8): optional ISBN box in "Add a book" (active
  scans only); five steps per press (add -> read card -> set ISBN -> re-read
  edition choices -> one edition search; the add is step 1 and the three ISBN steps follow), one in-memory record per press with
  frozen add, set and lookup commands; messages and retry buttons per the
  Owner note; the Owner stays on the screen after an ISBN add ("Back to
  review"); no-ISBN path unchanged. New: queries/ownerMissedBookIsbnFlow.ts.
  Changed: MissedBookScreen, missedBookForm, isbn.ts (shared error text),
  ownerEditionPickerCommands (parameter widened), CandidateEditionIsbnSearch
  (constant), ownerCorrectionQueries (non-blocking cache helper), tests.
Code review round 1 (read-only, against the SDD and brief): Muse, GLM,
  Codex gpt-6-luna: approve with fixes (GLM approve); Codex gpt-6.1-sol:
  rework. Ten findings confirmed in code and fixed in ONE Codex round,
  red-first: (High) the ISBN path awaited cache invalidations and could stay
  busy offline; (Med) a failed session refetch replaced the form and removed
  Retry and Back to review; (Med) a failed post-add card read left the review
  list unrefreshed; (Med) a confirmed search could be offered for replay when
  local cache acceptance threw; (Low) a mismatching set response looped on
  Retry; (Low) P9_STATE_CONFLICT on the set was always worded "scan closed";
  (Low) an empty assertive node; plus refusal, session-switch and cache-proof
  tests. Rejected: GLM's note on the "Retry ISBN save" label (intentional).
Decisions and deviations (orchestrator judgment, Owner delegated):
  (1) No Retry after a version-conflict response (SDD 01a §15.4 listed
  "version" under Retry; resending the same version fails again). Network and
  internal failures still retry with the frozen command (AC5b-6).
  (2) A P9_STATE_CONFLICT on the ISBN save now reads "Book added, but the
  ISBN wasn't saved. This book can't be changed now."; it becomes the SDD text
  "Book added. This scan is closed, so the ISBN can't be saved." only after a
  session refetch reports the scan closed. The conflict can also mean the card
  was committed or removed (SDD §5.5).
  (3) The ISBN path caches the card without awaiting invalidations (the
  add-only path keeps its old awaited helper unchanged).
  (4) The Owner stays on Add a book after an ISBN add (Owner answer 4).
Verification actually run:
  Codex final: Jest src/features/imageInventory 971 passed, 4 skipped, 0 failed;
  tsc only the 8 known src/features/books/export errors; git diff --check clean.
  Haiku independent run: tsc the same 8; Jest 2,287 passed, 4 skipped, 1 failed
  (a 5 s timeout in phase9_deployment_runtime_scaffolding, an untouched file;
  the suite passed 18/18 alone); git diff --check clean; test:phase9:db 727 of
  735 with 8 failures = the 3 known phase9MetadataFoundation failures plus 5
  files that failed only because this new worktree had no .phase9-dist build.
  After npm run build:phase9:metadata-worker those 5 files pass 117/117
  (orchestrator re-run).
Browser check (Haiku, web, real backend, Owner signed in at localhost:8091,
  partial because the server-side ISBN action is not deployed): PASS.
  Setup: Metro does not follow a node_modules junction, so the worktree has a
  real copy (500 MB); the first sign-in attempt stopped at the login page (new
  port, separate storage) until the Owner signed in.
  1. Closed scan 8eb9b18a: heading "Add a book", Title/Authors/Language, NO ISBN
     box (AC5b-8).
  2. Active scan 60a99c91 (created by pressing Start scanning with a shelf
     location; Haiku wrongly reported no session was made, read-only SQL showed
     it): labels "ISBN (optional)", textbox ISBN, hint text (AC5b-5). Bad check
     digit 9780140449130: "Check the ISBN; the last digit doesn't match" and
     Add book disabled (AC5b-3). Valid 9780140449136: error gone, Add enabled.
  3. Add with the ISBN: the screen stayed and showed "Book added, but the ISBN
     wasn't saved. Open Find or change edition to enter it." with Leave and no
     Retry (the deployed Edge answered 400 to the unknown set_candidate_isbn
     action, a refusal); all fields read-only; no leave dialog on Leave; the
     session screen listed the book (AC5b-4, AC5b-7).
  4. Plain add "Haiku 5b plain": navigated by itself to the session screen and
     listed (AC5b-2).
  Read-only SQL afterwards: two hand-added cards (needs_review, version 1,
  owner_isbn13 null), exactly one per press, no duplicates.
  Not covered (needs the deployed worker and Edge): the ISBN save and ISBN
  search against the real server (AC5b-1, AC5b-6 live), the Retry ISBN save
  path, and the success text with Back to review.
  Observation, not changed by 5b: hand-added cards show "Finding edition…" on
  the session screen although no automatic lookup runs for them (SDD 01a B18).
  Stale 404 console errors in the pane come from the failed junction load.
  Writes: three dev rows through the app (the active scan and two cards).
Supabase/external mutations: only through the app during the browser check
  (one active dev scan with two hand-added cards); the orchestrator ran
  read-only SELECTs only.
Known pre-existing: 3 phase9MetadataFoundation failures; 8 books/export tsc
  errors; occasional load timeouts.
Residual risk: the ISBN path through the real server (set_candidate_isbn and
  the ISBN search) has only run against mocks; it is covered by the combined
  5a+5b in-app check after the worker and Edge deploys.
```

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: on the Owner's approval, commit 5b (src and docs only); after that deploy the metadata worker, then the owner-ingestion Edge function, then run the combined 5a+5b in-app check (AC5a-1, AC5a-16c, AC5b-1, AC5b-4, AC5b-6).

## 31. Whole-feature review of slices 5a + 5b and its fixes, 2026-10-23

```text
Scope: database (M78 SQL and tests), Edge and worker (TypeScript), app (5a sheet,
  5b Add a book), cross-component contract, deploy safety and docs. Diffs against
  1d4f80e~1 in psrwhole-review/ (local only, never committed).
Reviewers: Codex gpt-6.1-sol (database, Edge/worker, app, cross-component), Muse
  Spark 1.3 and GLM 5.3 Flash free (all four pieces). Codex gpt-6-luna was started
  first and cut off by the Codex usage limit; Muse replaced it on the Owner's word.
Results: database - no defects (sol: 29/29 ISBN tests and 108/108 related, zero
  failed; Muse approve; GLM pass). Edge/worker - no defects (sol approve; GLM
  approve-with-fixes, deploy-order note only). App - sol REWORK (4 Mediums), Muse and
  GLM approve-with-fixes (Lows). Cross-component - sol REWORK (1 High, 3 Mediums,
  1 Low), Muse and GLM approve-with-fixes.
Confirmed in code and fixed (uncommitted):
  F1 (High) 5a edition sheet awaited cache invalidations after the re-read and in
     the error path, and the review-save sync awaited them too; offline a paused
     refetch never settles, so the search was never sent and Close stayed disabled.
     Now fire-and-forget (queries/ownerEditionPickerIsbnMutation.ts; new non-blocking
     cacheCandidateReviewSuccess in ownerUxReviewQueries.ts; the old function is
     unchanged for other callers). Three tests (success, refused set, unsaved edits)
     stall every invalidation; they failed first ("lookup expected 1, received 0")
     and pass.
  F2 (Medium) the re-read after an ISBN set was not bound to the set receipt, so
     another device changing or clearing the ISBN made the search run on the other
     value and 5b reported success. New choicesFollowIsbnSet (ownerEditionPickerCache.ts)
     requires the same ISBN (null for title mode) and non-regressed candidateVersion,
     metadataRevision and requestGeneration; 5a stops with the existing changed-book
     refresh state, 5b with "Book added. The ISBN was saved, but this book changed
     before the search could start. Open Find or change edition to search." and no
     Retry. Tests for another ISBN and no ISBN failed first; a benign higher
     generation with the same ISBN still searches. Existing fixtures that returned an
     unrelated generation or no ISBN after a set were corrected.
  F3 (Low, Muse) 5b re-read mismatch after a confirmed save no longer says "the ISBN
     wasn't saved" (ISBN_READ_MISMATCH vs new ISBN_SET_MISMATCH).
  F4 (Low, Muse) a refused ISBN save now refreshes the candidate and review lists.
Rejected after checking: GLM "no SQL tests for M78" (a 398-line integration test
  exists); Muse "cache-acceptance test passes for the wrong reason" (it makes the
  real acceptance throw); Muse "v2 header Medium" (guess; the browser check showed
  the existing flow works against Edge v17); the 17-character ISBN limit (set by
  the SDD); the 9790 prefix and the migration-comment items (harmless; applied file
  not edited).
Residual, not fixed: lost-response wording says "wasn't saved" when the reply was
  lost (Owner copy decision); no request timeout on the Add screen (Owner decision);
  add and card read are not abortable (pre-existing); Open Library embedded-editions
  assumption (test with a many-edition ISBN in the combined check).
Deploy finding: the Render worker deploys the head of main only; origin/main has
  neither 5a nor 5b. Publication to main is a prerequisite and needs the Owner's
  explicit authorization (SDD 01a section 10 checklist).
Coding: F1 and F2 by the orchestrator (Codex hit its usage limit again during the
  fix round; the Owner allowed it); F3 and F4 by Muse; all red-first.
Verification run: Jest src/features/imageInventory 982 passed, 4 skipped (71 of 72
  suites passed, 1 suite skipped); tsc --noEmit only the 8 known books/export errors;
  git diff --check clean. Not re-run: database suites, worker tests, browser check.
  Fix-delta re-review (Muse Spark 1.3 and GLM 5.3 Flash free; Codex sol was blocked
  by its usage limit until 9:07 PM and the Owner replaced it with Muse): GLM approve
  (two Lows: a duplicated set-mismatch test in OwnerCorrectionScreens.test.tsx, and
  the two different search-not-started messages, both intended). Muse approve with
  fixes: its Medium (5a does not check the set response scope) was rejected after
  checking, because ownerUxTransport.ts L212-214 already turns a set_candidate_isbn
  response with a different session or candidate into P9_INTERNAL_ERROR before the
  mutation sees it; its other points confirmed the refactor leaves the other callers
  of synchronizeCandidateReviewSuccess unchanged, no unhandled rejection, original
  error still rethrown, no false mismatch on retry, and that the changed fixtures
  are not weakened. No further code change was made. Remaining Low: delete one of the
  two duplicate set-mismatch tests.
Database/storage/deploy mutations: none. Nothing committed, staged or pushed.
```

## 32. Publication, deployment, M79/M80 and combined browser check, 2026-10-23

```text
Publication: branch claude/phase9-psr-slice5b-add-isbn, commits ebfeab2 (src) and abb6a65 (docs),
  one CI fix 779b420 (test race: the ISBN field renders before the saved choices load, so the
  retry tests now wait for the button). PR #28 merged to main as e615893 by the Owner in the
  GitHub UI; `gh pr merge` was blocked by the auto-mode classifier ("Merge Without Review").
  CI: app-validation failed only on the 3 bookDetailsPalette date-format tests, which also fail
  on main; container-smoke and snyk passed.
Render worker: phase9-metadata-worker (srv-d9sqfdvqj5pc73dc66fg), manual deploy from main by a
  Haiku subagent at the Owner's request: dep-dbdmmh6q1p3s739505eg, commit e615893, build ok,
  Live after 2m08s. Runtime logs showed only invocation_denied 404 invalid_route lines (health
  probes).
Edge function: `supabase functions deploy phase9-owner-ingestion --project-ref ahntbtktjjmvfosgkmgn
  --use-api` from the PR head (functions identical to main): version 18, ACTIVE, verify_jwt true,
  OPTIONS 200, unauthenticated POST 401, set_candidate_isbn and edition-reasons-v2 present.
Combined browser check (Haiku, dev app, localhost:8091): typed ISBN worked end to end on the server
  (jobs resolved in about 40-45 s; Open Library returned the exact edition) but cards stayed on
  "Finding edition..." and the sheet stayed locked. Root cause (database): phase9_owner_ux_metadata_state
  returns 'pending' unless the latest lookup outcome is in a fixed list; the ISBN lookup records
  'accepted_metadata_match', which the function only honoured through an already selected snapshot.
  Manually added cards (input_id NULL) never get a metadata job and so read 'pending' forever.
M79 (20261023000079_marketplace_phase9_isbn_match_metadata_state.sql): APPLIED_VERIFIED on
  ahntbtktjjmvfosgkmgn via the Supabase MCP execute_sql on the Owner's explicit instruction,
  after the Owner's own SQL-editor run did not take effect (function body unchanged on readback).
  Reviewed by Argon (Medium: stale match after an ISBN change) and Codex sol (Medium: A->B->A;
  Low: test creates a lookup; Low: LATERAL may not run once).
M80 (20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql): preflight showed
  the live body was M79; applied the same way; readback: prosecdef true, provolatile s,
  search_path "", ACL {postgres=X/postgres}, new body present. Reviewed by Argon (Medium: same-ISBN
  search running again; Low: manual-card test did not exercise the job guard) and free GLM
  (Medium: job status list - the live CHECK allows open, in_progress, retry_scheduled, resolved,
  resolved_noop, cancelled, dead_letter, so the three in-flight statuses are complete; Lows: scanned
  card with a dead automatic job stays pending; commit safety read statically). Argon was dropped
  from later reviews on the Owner's word.
Database tests: phase9OwnerIsbnEditionLookup.integration.test.mjs 36/36 (M79: completed match
  ambiguous, scanned card with no lookup/job pending, ISBN change pending, selection selected;
  M80: A->B->A pending, manual card ambiguous with a running job pending, same-ISBN re-run
  pending). The full Phase 9 DB suite was started once for regressions but its other files do
  not load M79/M80 and its result was not recorded.
Live browser after M80: The Hobbit - typed ISBN in Add a book, then Select edition saved and the
  card showed "Mariner Books - 1966 - 9780547928227"; The Origin of Species - "No edition chosen";
  Haiku plain add - usable sheet, typed ISBN 9780451529060 returned The Origin Of Species
  (Signet Classics) with Select edition enabled (not clicked); 12 ingestion calls all 200.
Findings not fixed: console CORS preflight/403/500/503 noise unattributed; review list renders
  6 cards first (FlatList initialNumToRender=6, not a defect); lost-response wording and Add-screen
  timeouts (Owner decisions); AC5a-14c provider-call order not inspected; the combined check did
  not cover a many-edition ISBN, a bad ISBN inside the sheet, or Remove/Add after selection.
Database mutations: M79 and M80 (function body only). Nothing committed for M79/M80/docs yet.
```

## 33. Whole-slice PR-style review and fixes (2026-10-24)

```text
Review: slices 5a + 5b + M78-M80, four pieces (database; Edge and worker; app; contract, rollout and docs), each
  read by Muse, free GLM and Codex gpt-6-luna (read-only). 12 reports. Verdicts: approve-with-fixes or rework; no
  tenant-isolation, privilege, SSRF or injection defect found.
Confirmed and fixed (Codex gpt-6.1-sol xhigh, red-first): F1 card label "No edition chosen yet" (was "Multiple
  possible matches"); F2 5b retry uses isbnSearchRecovery; F3 closed scan after ISBN save gets a truthful message;
  F4 set-response ISBN echo checked in 5a and 5b; F5 "No book was found" only with zero rows; F6 "Searching by ISBN"
  only while pending; F7 ISBN input maxLength 24; F8 Open Library adapter refuses ISBN strategy without a parsed
  ISBN before any call; F9 gateway test for a wrong check digit; F10 pending receipt shown in the choices cache.
Docs: SDD 01a status brought up to date; validator allowlist for M78 no longer depends on a transient status.
Verification run: Jest (src/features/imageInventory + the two ISBN edge suites) 1,058 passed / 4 skipped / 0 failed;
  tsc: only the 8 known books/export errors; git diff --check clean; validate-phase9-continuity PASS;
  phase9OwnerIsbnEditionLookup.integration 36/36; full test:phase9:db 851 passed / 3 failed: the three failures are in
  phase9MetadataFoundation.integration.test.mjs (fixture inserts canonical_works without the NOT NULL primary_title
  from migration 20260628000003; not touched by M78-M80; not caused by this slice).
Not fixed, Owner decisions: (1) scanned card with no lookup whose automatic job is dead_letter/resolved stays
  "pending" (needs M81; predates this slice); (2) valid ISBN whose edition is missing from Open Library's embedded
  editions list reads "No book was found" (needs a bounded fallback, worker redeploy); (3) M78-M80 have no
  schema_migrations rows (repair step is a live write); (4) worker has no overall per-job deadline (accepted risk);
  (5) live paths still untested: many-edition ISBN, wrong ISBN in the sheet, Add after selection.
Database mutations in this step: none. Nothing staged, committed, pushed or deployed.
Follow-ups recorded (none blocks the PR; Owner direction 2026-10-24: ship, treat these as optional):
  A. Migration history repair: DONE 2026-10-24 on the Owner's explicit instruction. The CLI could not be used (this worktree
     is not linked), so the same effect was written with the Supabase MCP: project ahntbtktjjmvfosgkmgn (verified by
     get_project_url); before: 74 phase9 rows against 77 local phase9 files; inserted versions 20261022000078,
     20261023000079, 20261023000080 (local file versions, names as in the files, ON CONFLICT DO NOTHING, 3 rows returned).
     Only supabase_migrations.schema_migrations changed; no schema or data change. Note: earlier migrations applied with
     apply_migration carry apply-time versions, not the local file versions, so history and file names already differ
     for those; this repair does not change that.
  B. Many-edition ISBN (the only item that can affect real users). Owner decision 2026-10-24: run this live check in the NEXT slice (slice 6) browser check, not now. Run the live check with a work that has many
     editions (e.g. a popular title's paperback ISBN). Only if "No book was found" appears for a valid ISBN, design a
     bounded fallback (worker change plus redeploy).
  C. Scanned card whose automatic job died before any lookup stays "pending" (predates slice 5; not seen in use):
     only if it appears in real use, M81 mapping that case to a recoverable state (Owner approval and review first).
  D. Worker has no overall per-job deadline (a slow Open Library can hold the worker for minutes): accepted risk.
```

## 34. Provider-neutral SDD amendment review

Date/session: 2026-10-24. Owner's `psrslice5-review/sdd-neutral-fix-brief.md`:
consolidate Codex findings 1–7 and Sonnet S1–S8, verify locally, correct only
SDD-0/SDD-2 and append this entry. Repository reads only; no fresh live-state
or ACL claim. Duplicates are grouped below; no substantive gap was rejected.

| Finding IDs (duplicates grouped) | Verification and resolution |
|---|---|
| Codex 1 / S1 | Confirmed eligibility gap; S1's seed attribution adjusted: M01 copies existing source providers, M73 seeds Open Library, SDD-0 F34 records both storage flags true. D35 and slice 6 now use an explicit Open Library allow-list plus existing policy checks through slice 7; slice 8 adds a separate reviewed shared capability. New-column-in-slice-6 alternative recorded and not selected; no column change or non-ISBN identity added to slice 6. Q18 names permanent/public reuse permission. |
| Codex 2 / S2 / S4 (workflow) | Confirmed; historical/live wording adjusted to repository evidence. M73's eight provider-list functions now have a named current-definition inventory (M78 supersedes context/completion), plus M68 physical registration and M73/M78 call/fallback/finalization and URL validators. Slice 8 covers lists, role/predecessor pairing, own-record validation and completion/accounting branches; reviewed provider validators may still need SQL. IMMUTABLE shape vs STABLE policy and worker instanceof routing are explicit. AC8-9 proves register/reserve/complete/persist/recover/read/select and negative fences, cross-references AC8-2; ordering, D32 traceability and mandatory migration/split wording corrected. |
| Codex 3 / S4 (identity) / S6 | Confirmed identity/constraint gaps; S6's key-pattern suggestion adjusted to the stricter current metadata contract (M15 SQL also permits dots). P3 ISBN/work uniqueness and DOC-3 §4.2 support explicit convergence/no-ISBN/translation cases. Slice 7 adds non-null tuple keys, canonical FKs, XOR/kind checks, bounded IDs and cascade deletion. AC7-2b tests namespaces and duplicate-target rejection below production admission; AC8-9 repeats full admitted convergence. Q20/AC7-2c recommend atomic conflict skip with successful unmatched Add, never silent merge/reassignment. |
| Codex 4 | Confirmed: Open Library adapter reads a work key but normalizer/MetadataEdition carry no work ID; M73 rejects unknown metadata keys. Slice 7 now scopes a versioned neutral companion payload, worker/RPC/SQL validation, lineage and old-worker/immutable-snapshot tests (AC7-2d), with code pointers. |
| Codex 5 / S8 (cover) | Confirmed: P3 has canonical cover_url and M65 catalogue snapshots read it. Slice 7 retains the coherent permitted canonical URL projection; cover ID/URL derivation stays with source normalized facts. AC7-9 proves another store reuses that cover without a call; expiry/public reuse gated by Q17/Q18 and AC7-10. |
| Codex 6 / S8 (references) | Confirmed: SDD-0 approved baseline separated from amendment; §9 matching/data-model references, slice 8 migration row, generic provider edition-ID wording and 7a/new-table/RLS/grants scope synchronized. DOC-3 §§5.1/5.2/14/17 named as later implementation amendments; DOC-3 remains untouched. |
| Codex 7 / S8 (questions) | Confirmed: source-row provenance is record-level, not per-field; provider/adapter_key/expires_at are source fields, not canonical fields. Q15–Q19 each name AC coverage or deferred/no AC. Overwrite/bulk refresh/per-store choice stay deferred; expiry-dependent providers cannot be enabled without canonical/public enforcement. |
| S3 | Adjusted: public canonical RLS and M01's explicit registry revocations are locally verified; current live default grants were not re-queried. Regardless of defaults, slice 7 now requires explicit revocations, SELECT-only grants/RLS, restricted helper execution and actual anon/authenticated DML/TRUNCATE denials (AC7-8); no direct service-role table writes. Anonymous read choice is recommended only, in Q21. |
| S5 | Confirmed by P3/M01: adapter_key is nullable and UNIQUE(provider, provider_book_id) remains. New writes populate both provider fields with the registry key; source-row key distinguished from provider-ID identity key. |
| S7 | Confirmed by P3 SELECT policies: hidden flag and source/retention note on canonical_editions are public. Slice 7 explicitly documents visibility and excludes private/store content; hidden is lookup suppression, not row secrecy. |

Completed/files: SDD-0 status, D35, §7.1, §9, §10 and §14; SDD-2 slices 6–8,
ACs/tests and traceability; this append-only evidence section. Source authority:
Owner amendment/brief, PSR-D32–D40, R04–R10, DOC-3 §§4.2/5.1/5.2/14/17.
Verification actually run: Phase 9 continuity validator PASS (106 Markdown
files; 195 requirement definitions, zero duplicates/missing traceability);
`git diff --check` PASS. Runtime/Python/database/browser tests not run (docs only).
Size assessment: SDD-0 remains the cohesive decision/overview authority and
SDD-2 the slices 6–9 design; size advisories do not justify fragmenting either.
Supabase/external mutations: none; no code/migration edits or service calls.
Decisions/risks: Q20 conflict fallback and Q21 authenticated-only ID reads are
new recommended defaults awaiting Owner confirmation; Q15–Q19 retain their
stated gates/deferrals. No second provider, expiry engine or overwrite policy
is enabled. No global phase/handoff change; other dirty documents preserved.
Next authorized action and gate: Owner review of the corrected amendment and
open defaults before affected pass-2 approval; slice 6 remains planning-only.
Nothing staged, committed, pushed, deployed or applied.

**Whole review resolution (2026-10-25):** Verified whole-review issues 1–5
against `compactReviewDraft.ts`, M69's saved-choice gate, `MetadataEdition`,
the Open Library normalizer, M73/M78 completion/validation, worker bootstrap
and SDD-5's current checks; all confirmed. Corrected SDD-0 status/D35/§10/§14
and SDD-2 slices 6–8/traceability: unmatched manual title edit; Q20 identity
conflicts versus same-ISBN convergence, with concurrent/replayed lookup options
and exactly-once accounting; bounded OCLC/LCCN companion transport/persistence
and old-worker null compatibility; required activation/rollback matrix; AC6-0,
D43 → AC8-8 → planned fixture, and the stale AC15-9 wording. Owner decisions
applied: Q15 development data may be reset/rebuilt only on separate approval
(adjusting the review's interim-preservation proposal), second-provider overwrite
policy deferred; Q18 details deferred to the Owner while Open Library alone,
second-provider admission gate retained; Q20 first row stays/no merge, unmatched
Add or per-edition lookup skip without retry; Q21 authenticated/server reads
only, removed from open questions. Authority: Owner's resolve brief, SDD-0
§§4/6/14, DOC-3 §§4.2/5.1/5.2/14/17. Continuity validator PASS (106 Markdown
files, 195 definitions, zero duplicates/missing traces); `git diff --check`
PASS. No runtime tests, code/migration edits, reset, database/Storage/service
calls or external mutation; other dirty files preserved. Both SDDs remain
cohesive despite size advisories. No new Owner decision requested. Next
authorized action: Owner review of this corrected draft before slice 6 pass-2
approval; implementation remains unapproved. Nothing staged, committed,
pushed, deployed or applied.

## 35. Slice 6 pass-2 detailed design (2026-10-25)

Date/session: 2026-10-25. Owner brief: documentation only, selected worktree on
claude/phase9-psr-slice6-catalogue-link at d09e8fd. The provider-neutral amendment
is committed as d09e8fd, cherry-picked from facf1c7 (Owner-supplied provenance);
the previous handoff's uncommitted-at-0de13ed statement was stale. Slice 5 remains
closed; no product implementation or migration creation was authorized.

Completed scope: new [02a slice-6 design](../work-units/post-scan-rework/02a-slice6-catalogue-link-sdd.md)
with verified code map, private helper/ACL/lock contract, retained chosen lineage,
ISBN/work normalization, Open Library registry admission, complete new-row field
mapping, no-update proposal, all-or-nothing conflict skip, replay/concurrency,
trigger/public-reader effects, incumbent provenance and privilege analysis,
AC6-0 through AC6-19 red-first fixtures/expected red reasons, native-runner plan,
proposed M81/readback/rollback, implementation-time docs and eight Owner questions.
Sources: PSR-D34/D35/D37/D40, R01/R04/R05/R06/R09/R10; SDD-0 F5/F9/F17/F34/F46,
Q15-Q21 and section 15; SDD-2 slices 6-7; DOC-3 sections 4.2/5.1/5.2/14/17.

Database evidence: only supplied .claude/psr-slice6/db-evidence.md, cited as
**live snapshot 2026-10-25**; no fresh connection/project read. Latest local Add
definition is M69. Its LF prosrc length 8972 / MD5
f38185ddd742cd0fbb249db1a903738e exactly matches the snapshot; raw CRLF differs.
The Hobbit's exact live work-key bytes, canonical optional facts and source-row
provenance cannot be verified from that snapshot. The June 29 Phase 3 smoke
record uses the same ISBN but does not establish canonical-row origin. The
generated work-constraint name is derived locally, pending live-name readback.
Grant origins/default-privilege history are unproved; reported privileges are
effective regardless of origin. No unsupported live values are asserted.

Decisions/deviations: no new product decision. OQ1 normalization/legacy keys;
OQ2 blocklist timing/contents; OQ3 saved canonical-ID exception versus AC6-4;
OQ4 incumbent no-update/new stamps; OQ5 Q15 reset; OQ6 unknown-source Hobbit;
OQ7 canonical-table grant revocation timing; OQ8 unexpected database failures.
Each has recommendations and option costs in 02a section 14. Q20/Q21 remain
decided; no second provider, reset, overwrite policy or hidden-column behavior
is enabled. No backfill is explicit in SDD-2, including the 32 existing rows.

Migration plan only: Phase 9 M81, PROPOSED / NOT_CREATED / NOT_APPLIED. The
optional pending-card correction in section 33 C is henceforth M-next, number
unassigned until commissioned; its historical “M81” label is not a reservation.
No migration file, ledger application row, database/Storage/service mutation,
provider call, runtime deploy, reset or data cleanup occurred.

Documentation: SDD-2 slice 6 received only a draft-status/pointer paragraph;
**no AC wording was changed**, including the unresolved AC6-4 wording. The four
current top entries in ACTIVE.md, DOC-13, TRACKER.md and SESSION-START.md are
identical and correct the amendment commit state. README routing and supporting
traceability were updated because SESSION-START section 6 requires handoff and
acceptance traceability; DOC-3, code maps, data dictionary and database audit are
unchanged, with implementation-time updates explicitly listed in 02a section 13.
Size assessment: 02a is one cohesive transactional-operation design; existing
history documents remain cohesive. No content pruned to meet a line threshold.

Review: one read-only Codex builder check under the brainstorming skill found
no material unanswered implementation question beyond OQ1-OQ8; retained lineage,
M69 replay/transaction boundary, constraints, admission and test pointers were
checked locally. This is not Owner approval or the external SDD review gate.

Verification actually run: Phase 9 continuity validator PASS (107 Markdown
files; 62 required phase files; 195 requirement definitions; 0 duplicate
definitions; 0 missing traceability). Requirement-regression probes, document
size policy, WU1/WU2 and repository diff checks PASS; size notices are advisory.
git diff --check PASS. All 60 local Markdown links in 02a resolve; numbered
source pointers checked against their local lines, and all four top entries
are identical. No runtime, Python, database, Jest, browser or native lock tests
were run; no packages installed. The final closeout checks cover the completed
documentation diff, including the lock-order clarification.

Active work unit: post-scan rework slice 6, pass-2 design drafted for review.
Exact next authorized action: review 02a and resolve OQ1-OQ8 before Owner
design/build approval and separate migration-file creation/application decisions.
Uncommitted changes are documentation only; the supplied .claude/ material is
preserved untracked. Nothing staged, committed, pushed, deployed or applied.

**Revision 1 — 2026-10-25 (Owner update; documentation only).** The Owner now
approves Q15 shared-catalogue reset **in principle; execution gated on the table
list and a separate approval**. Reset remains **PROPOSED / NOT_RUN /
NEEDS_OWNER_APPROVAL**, before M81 application. 02a §9.1 lists canonical_works
and canonical_editions as the only proved shared-only clear targets, with exact
excluded tables/reasons, every incoming FK/count, no-FK/JSON references,
preconditions, proposed SELECTs, export/recovery and first-Add behavior. The
2026-10-25 addendum supplies three populated NO ACTION blockers (one candidate,
one lookup, one immutable snapshot) to the same edition. Recommended option A
retains that edition, clears other editions/all works and accepts NULL work_id;
it is a **partial reset**, requiring explicit Owner acceptance before it can
satisfy the M81 precondition. No Phase 9 rows/JSON/images or store inventory may
be cleared. No snapshot-trigger bypass or TRUNCATE ... CASCADE is proposed.

The addendum's final “no NO ACTION work referrer” sentence is qualified by its
own proposal-FK row and local M18 L50–51: no currently populated blocker is
reported, not no constraint. Local M07 L12–23 proves public_listing_projection
is a view over marketplace_book_listings; it has no independent FK/rows, and
base-listing SET NULL is reflected by subsequent view reads. Its live relkind/
definition must be reverified. JSON reference counts were not supplied and are
explicitly NOT_SCANNED, never zero; a fresh recursive audit is a reset precondition.

Owner-required disappearance tolerance is specified in 02a §§3.1/4/7/10–12:
M69 L150–153 can carry a stale edition ID to the inventory FK; selected mode
L162–165 explicitly refuses a missing edition, and M69 L28–36/M65 L175–189 can
refuse even earlier through eligibility. The proposed Add-local gate adjustment
preserves review/scope/version checks; the private helper checks existence and
locks work KEY SHARE then edition SHARE in the same transaction, falls back to
admitted OL identity find/create or NULL links, and never returns a dangling ID.
AC6-20–23 name saved-ID disappearance, selection-to-Add deletion, NULL work and
replay fixtures/expected red reasons. Synthetic dangling-snapshot fixtures are
distinguished from real FK-permitted deletion races; inventory FKs remain on.
Replayed Add returns the original inventory ID without re-evaluating linkage.

Current question numbering supersedes only the initial-pass enumeration above:
**OQ1** normalization rule only; **OQ2** blocklist timing/contents; **OQ3** surviving
saved-ID and NULL-work policy (“just links” only while the row exists); **OQ4**
no-update/stamps; **OQ5** decided reset/table-list/execution gate, outside the
open list; **OQ6** write-grant revocation timing; **OQ7** unexpected
DB errors. The former incumbent-source question is removed, with
one live-incumbent/M81 sequencing precondition in 02a §9.1. Open questions are
OQ1–OQ4/OQ6–OQ7; no old work-key compatibility choice remains. Earlier section 35
paragraphs are immutable dated design evidence, not current questions/authority.

Exact revision scope: 02a design; **SDD-2 slice 6 status paragraph only**, with
no approved AC rewrite; this dated append to section 35; identical current top
entries in ACTIVE.md, DOC-13, TRACKER.md and SESSION-START.md. Other dirty files,
including initial-pass README/traceability and supplied .claude/ evidence, are
preserved. No code map/runtime/schema/test/SQL/migration/config file was changed;
DOC-3 implementation-time updates remain deferred. M81 is still **PROPOSED /
NOT_CREATED / NOT_APPLIED**; only Add writes catalogue rows after M81 in slice 6.
02a remains cohesive as one Add/reset-precondition contract; its length retains
the required audit, immutable-history boundary and acceptance evidence.

Verification for revision 1: Phase 9 continuity validator PASS (107 Markdown
files, 62 required phase files); repository/WU1/WU2 diff checks and document-size
policy PASS (size notices advisory). git diff --check PASS; staging index empty.
All 70 local design links resolve within existing files/line bounds; all four
current top handoffs are identical. Current-revision wording grep finds only
the single intended incumbent precondition, with OQ6 now the privilege question;
initial-pass section 35 history is retained as dated evidence. README and
traceability need no validator repair and are untouched in revision 1. No
runtime/Python/database/browser/native tests or network/database calls run.
No export/backup, reset, database/Storage/provider mutation, install, deploy,
staging, commit or push occurred. Exact next authorized action: Owner review of
02a revision 1, particularly reset table list approval and partial option A;
resolve OQ1–OQ4/OQ6–OQ7 before design/build approval. Actual reset execution and
migration-file creation/application each remain separately gated.

**Revision 2 (2026-10-25, orchestrator at the Owner's instruction).** Owner decisions applied to 02a: no catalogue reset in slice 6 (the revision-1 reset plan was removed; section 9.1 is a short note); Add tolerates a disappeared saved catalogue ID (kept); D37 blocklist deferred to slice 7 (OQ2); OQ1, OQ3, OQ4 and OQ7 take the recommended defaults; OQ6 included: M81 revokes INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on canonical_works and canonical_editions from anon and authenticated (AC6-24 added), conditional on a writer audit. Writer audit (read-only): repository search of supabase/migrations, supabase/functions, src, app, workers, scripts and e2e found no writer to the two tables outside test fixtures; a live search of all function bodies in pg_proc for those write statements returned no function; no non-internal triggers and no write RLS policy exist on the tables; two pg_default_acl rows exist for public tables. The stop-and-ask condition did not trigger. Further read-only live facts used for the dropped reset analysis: three NO ACTION references to the single existing edition (candidate 15ed7f7f-7aaa-4fe5-9ad0-54d4043afdca, created 2026-08-10, with one lookup and one immutable snapshot, no inventory created from it, no enrichment attempts or provider calls). OQ numbering kept (OQ5 dropped, former OQ8 is OQ7). Trim: 02a went from 1,151 to about 980 lines; the only removals were the reset plan (old section 9.1) and superseded OQ wording; the pre-trim copy is .claude/psr-slice6/02a-baseline-pre-trim.md (untracked). Wording needed in SDD-0/SDD-2 is listed in 02a section 13, not yet made. Verification run after the edits: Phase 9 continuity validator PASS (107 Markdown files, 62 required files); git diff --check PASS (repository and WU1/WU2). Not run: tests, builds, database writes. Database access: read-only SELECT on ahntbtktjjmvfosgkmgn (project verified by get_project_url); no write, reset, migration or deploy. Nothing staged, committed or pushed.

**Revision 3 (2026-10-25, Argon review).** Reviewer: OpenCode Argon (opencode-go/gemini-4-argon, plan agent, read-only, run at the Owner's request; a first run failed on argument order, a second stopped after reading, and the resumed session returned the report in .claude/psr-slice6/out-argon-review.md). Verdict: approve with fixes, seven findings. Orchestrator verification against the repository: F1 confirmed (phase6_baseline.sql L47-L69, L85-86, L247-251 versus Phase 3 L5-34 and L147-157; harness loads it at databaseHarness.mjs L53 and run-phase9-bookstore-first-postgres.ps1 L209); F2 fixture facts confirmed (unit7aFixture.mjs L113-117, editionPickerFixture.mjs L140-141), live Hobbit key unread; F3 confirmed (M69 L162-183 branches on the snapshot's canonical_edition_id) and the design was ambiguous; F4 confirmed (M73 L202 stores phase9_edition_current_snapshot, a fixed-key projection), forward-looking for slice 6; F5 first part confirmed as under-specified (M69 L26-37, L52-64), the query-identity sub-claim not verified and recorded as a point to confirm; F6 accepted as wording; F7 confirmed by search. All applied to 02a (pre-fix copy: .claude/psr-slice6/02a-pre-argon-fixes.md, untracked); AC6-25 to AC6-28 added. Not independently verified: Argon's statement that every existing test fixture writes the canonical tables as postgres after resetActor. No database access in this step; no mutation; nothing staged, committed or pushed.

**Cross-slice consistency review and design approval (2026-10-25).** Reviewers: OpenCode Muse (opencode-go/muse-spark-1.3-contributor; slices 7 and 13, SDD-4) and free GLM (opencode/glm-5.3-flash-free; slices 8, 9, 10), plan agent, read-only, run at the Owner's request (briefs and reports in .claude/psr-slice6/, untracked: xslice-brief-common.md, xslice-brief-A-muse.md, xslice-brief-B-glm.md, out-muse-consistency.md, out-glm-consistency.md). Both reported 'consistent with wording fixes' and no contradiction. Orchestrator verification: SDD-2 slice 8 does not name marketplace_sec.phase9_catalogue_link_for_add_v1 and assigns the allow-list replacement (L421) to neither 8a nor 8b (L459-460) - confirmed by search; AC7-8 (SDD-2:351-354) names only the provider-ID table - already a pending item in 02a section 13; SDD-4:125 wording ambiguity confirmed. Reviewer severity labels (every finding 'CONFIRMED', one 'High') were not adopted wholesale: several items are open design questions of slice 7 and slice 8 pass 2, not slice 6 defects. Result: 02a section 6.1 (provider-specific points slice 8 must generalize) added and the other wording fixes queued in 02a section 13; SDD-0, SDD-2 and SDD-4 were not edited. The Owner approved 02a (revision 3 plus section 6.1) as the slice 6 design in chat on 2026-10-25; this is design approval only. Validator and git diff --check PASS; no database access, no mutation; nothing staged, committed or pushed beyond the earlier local commit d09e8fd.

**Red-first tests and fixtures (2026-10-25, build authority limited to tests).** Written by Codex gpt-6.1-sol (workspace-write) from .claude/psr-slice6/codex-brief-tests-6.md after a read-only Muse review of the brief (8 findings, all applied) and one fix round (codex-brief-tests-6-fix1.md). Files: supabase/tests/phase9/catalogueLinkFixture.mjs (302+ lines; aligns the phase6 baseline per 02a 7.1 inside the fixture only; applies M81 only if the file exists), phase9CatalogueLink.integration.test.mjs (78 tests, AC6-0 to AC6-28 except AC6-19), phase9CatalogueLinkConcurrency.postgres.mjs, supabase/migrations/__tests__/marketplacePhase9CatalogueLink.test.ts (14 tests); edited run-phase9-bookstore-first-postgres.ps1 (additive; M79/M80/M81 applied to an isolated clone so existing native suites keep their M78 tail; execution unverified). Verification run by Haiku with M81 absent (logs .claude/psr-slice6/run-db3.log, run-guard3.log; reports out-red-run.md, out-red-run2.md, out-red-run3.md): run 1 exposed a fixture regex bug (digits in table names; 47 tests never reached the feature) fixed by the orchestrator in one character; run 2 had 13 setup crashes (P9_REQUEST_INVALID, 42P08, P9_EDITION_AUTOMATIC_PAYLOAD_DENIED), all diagnosed by Codex as fixture or test mistakes (case-insensitive duplicate authors rejected by M29; untyped parameter; explicit-picker lineage rejecting the stale snapshot setup) and fixed; run 3: DB 78 tests, 0 pass, 78 fail, all by assertion (26 no persisted canonical work, 34 M81 helper must exist, 12 eligible Add must succeed on stale targets, 3 missing expected rejection, 2 edition-only link retained, 1 anon INSERT on canonical_works), 0 crashes; GUARD 14 tests, 9 fail by assertion on the absent M81 file/helper/REVOKE/BEGIN, 5 pass (LF-normalized SHA-256 of M69, M70, M78, M79, M80). Expected-green negatives are paired with a helper-existence assertion and report their own diagnostic first. Native run added below. Not run: the existing Phase 9 DB regressions and architecture guards, any test with M81 present. No database access, no M81 file, no SQL or app change, nothing staged, committed or pushed (files untracked).

**Native-PostgreSQL red run (2026-10-25, M81 absent).** Haiku ran supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1 -IncludeEditionPicker -IncludeOpenLibrary -Port 5450 (runner creates a disposable cluster in a temp directory on 127.0.0.1; never the shared Supabase project; reports .claude/psr-slice6/out-native-red1.md and out-native-red2.md, logs run-native1.log and run-native2.log). Preflight: initdb, pg_ctl, psql from the scoop PostgreSQL install; port 5450 free. Both runs: cluster created and torn down (POSTGRES_TEARDOWN_PASS), no leftover process, listener or temp directory; M79 and M80 applied cleanly to the catalogue clone with ON_ERROR_STOP, M81 skipped as absent; existing edition-picker native 20/20, Open Library native 12/12 and U8B SQL acceptance PASS, so the additive runner edit did not break them. Run 1: catalogue-link concurrency suite 0/25, 24 by assertion (mostly 'M81 private helper must exist'), 1 crash (AC6-12 crossed ISBN, true: phase9_candidate_edition_state_check1 violated because the test wrote the ISBN-13 into the saved choice as a JSON number); Codex fixed it (serialized ISBN object, explicit disagreeing pair 0306406152 / 9780804429573, documented postgres bypass, per-case cleanup; brief codex-brief-tests-6-fix2.md). Run 2: 0/25, all 25 by assertion, 0 crashes; the runner then exits 1 with 'Catalogue-link native PostgreSQL acceptance failed', which is the expected red state. Not verified: that the 25 cases pass once M81 exists (no M81), lock-wait evidence quality (needs the helper), and the remaining Phase 9 DB regressions. No remote database access; nothing staged, committed or pushed.

**Green-state verification and first reviews (2026-10-25, M81 present, not applied).** M81 file created locally as supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql (508 lines) by Codex gpt-6.1-sol from a Muse-reviewed brief on the Owner's authorization; Add-body base M69 (no replacement in M70-M80), LF-normalized body length 8972, md5 f38185ddd742cd0fbb249db1a903738e, six intended Add edits only; STATUS PROPOSED, NOT APPLIED, Supabase untouched, nothing staged, committed or pushed. First green run: GUARD 26/26 (incl. Unit6gFoundation), five regression suites 13/32/36/32/20 pass, three architecture guards 17/17, DB 31/78: 46 `column reference "a" is ambiguous` (helper record variable `a` vs column alias `author(a)`; fixed by renaming the alias to `au` in 8 places, Owner-authorized) plus 1 P9_STATE_CONFLICT (AC6-6 OL). After the rename DB 76/78; the last two were wrong test assumptions, NOT M81 defects (both fail identically on a scratch M69-without-M81 copy per Haiku, plus an independent Muse code trace): AC6-16 "expired" expired candidate.expires_at which Add never reads (only the M54 session fence is enforced; the test now expires the session and expects P9_STATE_CONFLICT), and AC6-6 OL where the identity change resets review_ready via the M69 trigger (the test now performs a second unchanged save before Add); both test-only edits, Owner-authorized. Final: DB 78/78, GUARD marketplacePhase9CatalogueLink 14/14, native runner (disposable 127.0.0.1:5450 cluster, torn down; never the shared project) exit 0 with concurrency 25/25, picker 20/20, Open Library 12/12, U8B pass (earlier alias-bug native run: 4/25); reports .claude/psr-slice6/out-green-run1.md, out-green-run3.md, out-native-green1.md, out-native-green2.md, out-m69-two-fails.md. Read-only reviews: Muse on the helper, free GLM on the Add-body diff vs M69 and the ACL/revocation tail; no High or Medium, exactly the six intended Add edits; Muse's two Lows checked against the code and savepoint semantics are NOT defects (a disagreeing surviving edition already returns NULL/NULL; subtransaction-rolled-back locks are released, so the "releases its locks" comment is correct); GLM Lows not adopted (no helper row-count assertion; manual Adds pay scoped helper reads, design-conformant); slice-7 note: the revocation covers the current tables only, re-apply if recreated (no ALTER DEFAULT PRIVILEGES backstop by design). Pending: Owner-asked read-only reviews by Codex Sol and Luna (not yet run), a read-only live-schema audit via Supabase MCP after re-verifying ahntbtktjjmvfosgkmgn, docs follow-ups. Not done / not authorized: applying M81, browser check incl. many-edition ISBN, SDD-0/SDD-2/SDD-4 wording edits (02a section 13), commit and push, the optional schema performance audit. Database/storage mutations: none.

**Final M81 local state: green, reviewed, not applied (2026-10-25).** M81 supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql is 517 lines, local only, NOT_APPLIED; Supabase untouched. Fix 2 (Codex Sol Medium, Owner-accepted): the helper treats the one predictable oversized-key condition (SQLSTATE 54000 program_limit_exceeded, message starting 'index row size', index one of the four catalogue key indexes) as a catalogue skip (helper writes rolled back, NULL/NULL, Add succeeds unlinked); every other error still propagates; AC6-29 (maximum-size authors) added and mutation-proved not vacuous (gate removed: 'index row size 5256 exceeds btree version 4 maximum 2704 for index canonical_works_title_normalized_primary_authors_key'). Fix 3 (Owner decision): the canonical-table revoke now includes MAINTAIN (PGlite 0.5.4 is PostgreSQL 18.3, the native runner is PostgreSQL 18.4, so both support it). Final local verification (after fix2 and fix3): DB 79/79, GUARD 26/26 (14 slice-6), five existing regression suites 13/32/36/32/20, architecture guards 17/17, MaintainAcl 2/2, SensitiveTableAcl 2/2, native PostgreSQL runner exit 0 (catalogue-link concurrency 25/25, edition picker 20/20, Open Library 12/12, U8B SQL acceptance pass; disposable local cluster 127.0.0.1:5450, torn down, no leftovers, never the shared Supabase project). Reviews, all read-only, no High finding: Muse on the helper reported two Lows, both refuted by the orchestrator (a surviving disagreeing saved edition already returns NULL/NULL; subtransaction-rolled-back row locks are released, so the 'releases its locks' comment is correct); free GLM on the Add body diff vs M69 and the ACL tail (B-glm2 report) confirmed exactly the six intended edits with no High/Medium and three Lows (no helper row-count assertion, not adopted; canonical-revocation default-privileges backstop note, recorded for slice 7; manual-mode Adds pay the helper's scoped reads, design-conformant); Codex Sol Part A reported two Mediums (oversized-key failure, fixed as fix 2; legacy-key race where a rare interleaving skips a link but never makes a wrong link or fails an Add, recorded as a known limitation for slice 7), Sol Part B reported no new finding; Luna Part A reported no finding, Luna Part B reported no High, Medium or Low finding. Read-only live preflight on project ahntbtktjjmvfosgkmgn (verified; SELECT/catalog/advisor reads only): live migrations 79 and 80 applied, nothing named 81; live Add function md5 f38185ddd742cd0fbb249db1a903738e length 8972 (matches the M69 base); helper absent; both canonical tables, constraints and indexes present with the expected names; one canonical work and one edition live; (R1) the single live work 'The Hobbit' has primary_authors in raw case (['J.R.R. Tolkien']), so a different Hobbit edition could create a duplicate work because the helper compares normalized keys - Owner accepted this as a known limitation for slice 7 (no data change now); (R2) MAINTAIN still granted to anon/authenticated - fixed in fix 3 above. Known limitations recorded (02a and here): (1) legacy raw-case canonical works can lead to a duplicate work and, in a rare race, a skipped link (slice 7, no data change); (2) the canonical revoke covers the current tables only: re-apply it if those tables are ever recreated (no ALTER DEFAULT PRIVILEGES backstop by design); (3) helper result has no row-count assertion (not adopted); (4) manual-mode Adds pay the helper's scoped reads (design-conformant). Not done / not authorized: applying M81 to Supabase (needs a fresh project re-verification and the Owner's separate explicit approval; then apply in one transaction and run the 02a section 11 read-back); browser check incl. the many-edition ISBN case; the queued SDD-0/2/4 wording edits (02a section 13); commit and push; optional schema performance audit. Exact next authorized action: The Owner reviews this final state and decides whether to give the separate approval to re-verify the Supabase project and apply M81 (nothing is applied). No other action is authorized. Database/storage mutations this session: none. Nothing staged, committed or pushed.

**Application and read-back (2026-10-25, M81 applied).** The Owner separately approved application ("re-verify project ahntbtktjjmvfosgkmgn read-only, apply M81 in one transaction, then run the 02a section 11 read-back and record it."). Project re-verified via MCP get_project_url (https://ahntbtktjjmvfosgkmgn.supabase.co); read-only pre-state: live migrations 79 and 80, no 81, Add md5 f38185ddd742cd0fbb249db1a903738e length 8972, helper absent, canonical_works 1, canonical_editions 1, store_inventory 32, linked (canonical_edition_id not null) 0, anon/authenticated held INSERT (and MAINTAIN) on both canonical tables, all 16 called functions present. Owner-approved apply_migration `marketplace_phase9_catalogue_link_at_add` applied the local M81 file as written in one transaction ({"success":true}); live version 20261025171647 (local filename 20261025000081_... maps to it; timestamp equality never assumed; the file header comment stays PROPOSED by design). Read-back PASS: helper (owner postgres, SECURITY DEFINER, VOLATILE, search_path "", proacl postgres=X; EXECUTE postgres only; prosrc length 21038 md5 69bd9b40c54a119a61e2782f19c55afb == local LF body) and Add (owner postgres, SECURITY DEFINER, VOLATILE, search_path "", proacl postgres+authenticated; EXECUTE authenticated, not anon; length 11538 md5 9fe42381cf406d81018417dfc541217a == local LF body); no PUBLIC ACL entries, exactly one function of each name; canonical tables anon+authenticated SELECT-only, the two SELECT policies/constraints/triggers unchanged; counts identical (works 1, editions 1, inventory 32, linked 0 - the 32 is the inventory row count). Database mutations: M81 applied (DDL only: new private helper, Add replacement, canonical-table write revocation incl. MAINTAIN); no data written, no Add/helper executed; no Edge Function, worker or app deployment. Not done: browser check, commit/push, SDD-0/2/4 edits, slice 7 items (legacy raw-case works, blocklist, race limitation), optional schema performance audit. Nothing staged, committed or pushed.

**Browser proof and findings (2026-10-26).** Owner-authorized dev browser test on dev project ahntbtktjjmvfosgkmgn (M81 live version 20261025171647; M81 applied). Browser proof PASS: new scan session f5c2a7e9-fe79-4c57-818c-7336ada3cbcf (shelf M81-BROWSER); "Add a book" with title "Crime and Punishment (Penguin Classics)", author "Fiódor Dostoievski", ISBN 9780140449136 returned accepted_metadata_match, the saved ISBN result was chosen via "Select edition", the card showed the Open Library cover and "Penguin Classics · 2003 · 9780140449136", price 250 and condition Good set, one Add closed the session ("All detected books were added"). Counts before Add: canonical_works 1, canonical_editions 1, store_inventory 37, linked 0; after: 2, 2, 38, 1. New inventory row 4ee1f236-deca-469d-85e8-faf936744b4c links canonical_work_id f511bca1-3372-4293-a92e-55b2eeb2bc19 and canonical_edition_id 9557e93f-1397-4a00-9b33-9099ebde7516 (isbn_10 0140449132, isbn_13 9780140449136, cover https://covers.openlibrary.org/b/id/9411862-M.jpg, metadata_verified_at set, version 'psr-catalogue-isbn-v1'; work title_normalized "crime and punishment (penguin classics)", primary_authors ["fiódor dostoievski"]; inventory ids equal the canonical ids; snapshot edition-selection-v1:170121df-2a3e-4756-b886-c1fdfbc423ab:metadata-r3; private draft). The Hobbit work/edition rows are unchanged (verified false, selection version null). Not run in the browser: reuse and the manual-card case (covered by the 79 DB and 25 native tests); the many-edition ISBN case not run. FINDING 1 (pre-existing, slice-5 picker/M78 area, not M81): the edition choice is silently dropped for ISBN-searched cards because trigger marketplace_sec.phase9_edition_identity_change exempts "the controlled Select edition result" only on an unchanged-row comparison including NEW.state and NEW.review_disposition, which a card's first review save always changes (needs_review to ready, null to reviewed); with a typed owner_isbn13 and differing review title/authors it NULLs owner_isbn13, clears the edition state and resets metadataChoice to manual. Receipts for cards 1, 2, 7 of session cde4c240-7c63-41de-a16a-511d5bed1ea1 show EP_ISBN_V1 to EP_LOOKUP_V1 to EP_SELECT_V1 then two U6C01 saves returning metadataChoice manual, then U7AC01 (owner_isbn13 NULL afterwards; card 7 held 9780140449136 before Add; card 5 with no typed ISBN kept its option); the slice-1 re-save then re-saves the manual review, so Add succeeds unlinked. Read, not reproduced in isolation; workaround for the proof was a title-equals-edition-title card. Earlier failed Adds from that session (cards 1, 2, 7 manual and unlinked; card 5 Google, unlinked by design) are explained; leftovers e529ab3f-36cf-483f-af94-8af9f9e52e47 (card 5), 7644c8af-6bbe-4da5-b74b-e269c2a22908 (card 1), 7fc05506-ef5c-411f-b963-a6053c090d9c (card 3, Haiku mistake), c9a7628b-4080-454c-9b00-8be84b61e409 (card 2), 4085cd91-954b-4087-8578-63ed6f502a63 (card 7), all private drafts; session closed via the app (9 uncommitted books kept read-only; earlier closed session 60a99c91-3949-43fe-8d2b-c085de88489d). Fix proposal M82 (trigger exemption compares only observed title/authors/language, ISBN clue, publisher clue and owner_isbn13, plus DB tests) NOT created, NOT authorized. FINDING 2 (expected slices 1-6 state, not M81 defects): automatic scan lookup is Google Books only (Open Library automatic match is slice 8, saved first-lookup results slice 9, neither built); 3 of 15 matched (cards 5, 12, 13), only card 5's match had a cover, the rest no_match (7), ambiguous (4), material_conflict (1), hence "No cover" placeholders (SDD-0 D22/D29); the sheet shows no alternatives until explicit Search Books/ISBN search (Picker 13.2), and card 6's 7 saved results were all identity_conflict_selection_disabled. Covers display once an edition is chosen. Slices 8/9 pull-forward is the Owner's product decision. Database mutations this session: no DDL, migration or manual SQL writes; dev test data written through the app only (candidates, inventory rows, edition-state rows, idempotency receipts, two scan sessions, one canonical work and edition via the M81 helper). Nothing else staged, committed, pushed or deployed.

**Slice 7 pass-2 design draft (2026-10-26).** Codex gpt-6.1-sol (xhigh) drafted work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md (14 sections, documentation only; brief .claude/psr-slice6/codex-brief-design-7.md, untracked) and the matching handoff entries and SDD-2 slice 7 status pointer; it hit its usage limit before its final report and validator run. Orchestrator completeness check: all brief sections present, no unfinished markers. Owner reaffirmed provider neutrality (D32/D35) in chat; the orchestrator then moved Open Library specifics out of the generic rules: section 1 neutrality rule, registry column shared_source_note for attribution text, raw retention and revalidation read from the registry row, one admission function (phase9_catalogue_shared_admitted_v1, the only new SQL holding the D35 open_library allow-list, replaced by slice 8a), one registry-keyed provider validator (phase9_catalogue_provider_ids_valid_v1), neutral coverRef, and new AC7-21 (static and synthetic-second-provider proof). Verification: git diff --check on 02b clean; Phase 9 continuity validator FAILS only with PHASE9_MIGRATION_SET_INVALID because local M82 exists and the allowlist ends at M81 (expected; the M82 step adds it). Not done: independent review of 02b, Owner answers to OQ1-OQ8, design approval. M83 PROPOSED / NOT_CREATED / NOT_APPLIED. No database access or mutation; nothing staged, committed or pushed.

**Slice 7 design review and Owner answers (2026-10-26).** Orchestrator full read of 02b plus pointer spot-checks (adapter, metadata contract, M81 L120-160, Phase 3 source table, M01 L34-48, M15 grammar): all confirmed. Fixes made in 02b: removed an unrelated leftover paragraph; M81 inline provider checks (adapter key, OL cover regex) assigned to the admission function and provider validator; source rows set provider and adapter_key to the registry key (M01 already dropped the provider-name CHECK); neutral wording for growth model, confidence value and OQ7; new neutrality check renumbered AC7-21 (AC7-11 already existed). Open review observations for the Owner: the shared cache is the heaviest and riskiest part; the slice exceeds one session. Owner answers in chat: OQ1 leave it; OQ2 whole-record skip, list built with zero entries and Owner adds entries later; OQ3 current explicit predicate until slice 9, translations join only via provider work ID; OQ4 extend existing cache; OQ5 scan-text-only public scope; OQ6-OQ8 recommendations accepted ("go with your recommendation for the rest"): every new selection counts, stats server-read-only, provider-ID stamp psr-catalogue-provider-id-v1, split 7a/7b before build. Recorded in 02b section 14. Not done: independent review, design approval, split map. No database access; nothing staged, committed or pushed.

**M82 applied (2026-10-26).** Owner instruction: "get Haiku to do pre-flight, just apply the migrations" (earlier: write M82, review by GLM and Muse, preflight by Haiku, apply). Reviews: Muse no finding; GLM run hung with no output and was restarted (report pending, will be recorded). Haiku read-only preflight READY: project URL verified, latest live migration 20261025171647, M82 absent, live function md5 5935896660ad58e19c049a7f86915f13 length 4906 (M78 body), trigger as expected, 0 active sessions on image_extraction_candidates, local file shape correct. Orchestrator re-verified project ahntbtktjjmvfosgkmgn via get_project_url immediately before applying; apply_migration marketplace_phase9_edition_choice_survives_first_save applied the local file as written in one transaction ({"success":true}); live version 20261025220839 (local filename 20261026000082_... maps to it). Read-back PASS: exactly one function, owner postgres, SECURITY DEFINER, proconfig search_path="", proacl {postgres=X/postgres}, anon/authenticated/service_role EXECUTE false, prosrc md5 8bdf7924d9f95ced4533a9ed4e81394b length 5033 equal to the local LF body, trigger phase9_edition_identity_change definition unchanged. Database mutation: function replacement only; no data written. Validator allowlist gained an M82 clause. Not done: browser re-check with a differing-title ISBN card; commit/push.

**M82 browser re-check PASS (2026-10-26).** Owner instruction: "run the browser re-check: an ISBN card whose title differs from the edition, select edition, save, Add, and confirm the edition and catalogue link survive." Built-in browser, Expo web localhost:8091, project ahntbtktjjmvfosgkmgn. New scan session 78f427c3-794d-450a-b2de-452b7c4e203c (location "M82 recheck", no photo); Add a book: title "Pride & Prejudice", author Jane Austen, ISBN 9780141439518 (candidate 1e3d0f5f-b623-4b1f-b6a6-b886944c9207, owner_isbn13 set). Automatic ISBN lookup finished; picker showed one Open Library edition "Pride and Prejudice" (Penguin Books 2003); Select edition (EP_SELECT_V1); review snapshot still NULL before Add (the incident shape); price 100 and condition Good via presets; Add to inventory: receipts EP_SELECT_V1, U6C01 (first review save), U7AC01 (Add), U6GC03. After: candidate committed/reviewed, owner_isbn13 still 9780141439518, metadataChoice edition_option with the same selectionId, review title "Pride and Prejudice"; inventory 41c79cca-56c7-4fb7-8ebd-8bbc36da8fab linked to new canonical edition 7edcb18f-b347-453e-a8cb-9212dee9c073 (work 41947a8d-15ff-47a1-9a97-82da1714e772, metadata_selection_version psr-catalogue-isbn-v1). Counts: canonical_works 2->3, canonical_editions 2->3, linked inventory 1->2. Before M82 this exact flow dropped the ISBN and edition (finding 1). Data written: one test scan session, one candidate, one private inventory draft, one catalogue work and edition (normal app flow). Nothing staged, committed or pushed.

**Slice 7 design: independent review and fixes (2026-10-26).** Owner asked for Muse, GLM, Codex Sol and Luna to review 02b (brief .claude/psr-slice6/review-02b-brief.md, untracked; split focus: Muse sections 1-6, GLM 7-10, Luna 11-14 plus provider neutrality, Sol whole document against code). Results: Muse 2 Medium + 2 Low (OQ7 stamp missing from normative text; advisory-lock key under-specified; constraint/index names; compact ISBN form undefined); Codex Sol 4 Medium + 1 Low (M78 provider-specific URL/accounting checks lacked a neutral home; cache-key versions had no authoritative SQL source; existing local automatic completion had no searched-count hook; public cache scope wider than Owner OQ5; cache-attempt uniqueness scope wrong vs M67), all section 2 pointers correct; Luna 3 Medium (OQ5 duplicate of Sol; section 12 ignored the OQ8 7a/7b split; AC7-21 synthetic provider blocked by production admission); free GLM timed out (30 min) with no report, third GLM hang today. No High finding; no tenant leak, privilege widening or Owner-decision conflict beyond those listed. The Owner asked Codex Sol to fix them: round 1 (9 findings, brief codex-brief-02b-fix1.md) and round 2 (Luna 2 + orchestrator: lock key used pgcrypto extensions.digest, replaced by built-in pg_catalog.sha256), all verified against the cited code and none rejected; orchestrator reviewed both diffs. 02b now 1,304 lines (LF): provider validator owns M78 OL/Google URL and accounting checks; cache versions from the worker validated against recorded lookup values (new routing_policy_version column); M15 local completion gets the searched-count/effect hook; public scope scan-text only; per-lookup attempt sequence; OQ7 stamps in normative text; shared lock-key function phase9_catalogue_identity_lock_key_v1 with one exact sha256 expression; compact ISBN form = M81 form; section 12 assigns every object/package to 7a or 7b, 7a works without any 7b object; admission hand-off lets AC7-21 test a synthetic provider directly as postgres on a disposable DB without production widening; new AC7-22 to AC7-27. Continuity validator PASS. Not done: Owner design approval, SDD-0/SDD-2 split map and migration numbers. No database access; nothing applied.

**M82 GLM review closed (2026-10-26):** not obtained: free GLM hung three times; covered by Muse (no finding), two Haiku preflights (READY) and the browser re-check PASS

## 36. Slice 7a start: design approval, split map and numbering, 2026-10-26

**Authorized work unit and scope.** Owner 2026-10-26 authorized recording the approved 02b Slice 7 design, the 7a/7b split, migration numbering and the build handoff. Active work unit: `post_scan_rework_slice7a_build`. This step is documentation only in the selected worktree `phase9-psr-slice5b-add-isbn`; branch verified as `claude/phase9-psr-slice7a-lean-catalogue-identity`, HEAD `87db21c68a154c175631b6b43180a3a3ce2068b4`. Existing untracked `.claude/` preserved. No branch switch.

**Owner decisions (approval round, chat; Owner 2026-10-26).**

| # | Decision |
|---|---|
| 1 | 02b approved as Slice 7 design; 7a build and local migration-file creation authorized (Owner chose "Yes, create it", steps up to review). Supabase application requires separate Owner approval. 7b is not authorized. |
| 2 | R12: own branch `claude/phase9-psr-slice7a-lean-catalogue-identity` off `87db21c`, in worktree `phase9-psr-slice5b-add-isbn`. |
| 3 | Override SDD-0 §15's agent list for 7a only: code Codex `gpt-6.1-sol` xhigh; read-only reviews OpenCode Muse (`opencode-go/muse-spark-1.3-contributor`), free GLM (`opencode/glm-5.3-flash-free`, with timeout), DeepSeek (`opencode/deepseek-v4.1-flash-free`), Codex Luna (`gpt-6-luna`, read-only) and Codex Sol read-only; Haiku runs preflights/tests. SDD-0 §15 unchanged. **§15 wording update proposed, pending Owner approval**. |
| 4 | OQ2 follow-up: `marketplace_sec.phase9_catalogue_isbn_blocklist`, private versioned table, created empty; STABLE ISBN reader. Postgres-only privileged operator SQL writes under separate authority, no client/service_role write grant. Future identity checks only; no changes to existing links/rows/snapshots. 02b records the IMMUTABLE→STABLE deviation because entries are added later as data. |
| 5 | 7a `phase9_catalogue_provider_ids_valid_v1` facts mode only; every nonnull p_completion returns valid=false. 7b forward-replaces the same signature for M78 routing/receipt/logical-outcome accounting. `phase9_catalogue_valid_companion_v1` belongs to 7b; AC7-21 static homes split by artifact. |
| 6 | Closed by Owner 2026-10-26: unused direct operator path, no live function/trigger or repo writer, zero source rows. 7a revokes INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN from PUBLIC/anon/authenticated/service_role; service_role SELECT only. Replace sole `metadata sources platform write` ALL policy with SELECT-only `metadata sources platform read` for authenticated USING `marketplace_sec.is_platform_operator()`; preserve operator/service reads and non-operator/anon no-row behavior. Postgres-owned shared core writes; operator SQL corrections require separate authority. AC7-28. |
| 7 | M82 GLM closure: "not obtained: free GLM hung three times; covered by Muse (no finding), two Haiku preflights (READY) and the browser re-check PASS". Section 35 history is retained; its dated closure is appended above. |
| 8 | If no real Open Library edition without ISBN can be selected through the app, report to Owner, prove the provider-ID link in DB and native tests, and browser-check ISBN path plus chosen/added counts. This is the later proof plan; browser check requires separate approval. |

**Facts supplied by the orchestrator (verified read-only, 2026-10-26; no network/database access in this step).**

- Supabase MCP get_project_url = https://ahntbtktjjmvfosgkmgn.supabase.co. list_migrations latest: `20261025171647` (`marketplace_phase9_catalogue_link_at_add`, M81) and `20261025220839` (`marketplace_phase9_edition_choice_survives_first_save`, M82); nothing later.
- No local or remote branch contains migration 83 or higher. 7a = **M83**, proposed local `supabase/migrations/20261026000083_marketplace_phase9_lean_catalogue_identity.sql`: **PROPOSED / NOT_CREATED / NOT_APPLIED**. 7b: one migration, number undecided; begins only after 7a is applied and verified and separately authorized.
- Commit `87db21c` ("feat(phase9): slice 6 catalogue link (M81), M82 edition-choice fix, slice 7 design") records the completed slice-6/M82 artifacts and Slice 7 design locally on `claude/phase9-psr-slice6-catalogue-link`; nothing pushed. Earlier top handoffs predate it. Local read-only Git checks confirm HEAD and both branches contain that commit.
- No database or storage mutation in this step. These dated supplied facts do not replace the fresh read-only build preflight.

**Read-only preflight follow-up (2026-10-26).** The dated [slice 7a audit](../supporting/database-current-vs-target.md#2026-10-26-slice-7a-read-only-preflight) summarizes `.claude/psr-slice7a/preflight-1.md` (Haiku, read-only): exact project check, last three migrations, works/editions/sources/linked-inventory counts 3/3/0/2, registry flags, live function fingerprints, constraints/indexes/policies/grants, Hobbit references, no duplicate stored work keys and no live/repo source writer. The orchestrator independently corroborated source policy/grants and canonical readers the same day. M67 `phase9_edition_local_match` is the one picker-local/automatic-local discovery reader; 7a filters it, while M15's completion re-check/hook stays 7b. M15 live owner/secdef were not reported and remain a read-only preflight gap. This records supplied evidence only; no network/database access or mutation in this follow-up.

**Completed / documents changed.** 02b header/intro and §§1/4–6/8–14 record approval, M83, blocklist/STABLE deviation, facts-only validator, companion ownership, source audit stop gate, per-artifact AC7-21, the acceptance subsets and the dated supplied/preflight distinction. OQ4 cache-design approval is recorded while its 7b build remains unauthorized. Every §11 AC was checked against the proposed split: mixed Add/local checks stay in 7a and completion/cache/transport portions in 7b; no disagreement found. Searched stays 0 in 7a. SDD-0 §7.1 now has 7a/7b rows and slice 8 depends on 7b; SDD-2 Slice 7 records the decided split, registry `shared_source_note`, AC7-21 and AC7-11–AC7-27 reference while preserving existing approved AC text. This tracker appends M82 GLM closure and this entry. Identical new top handoffs added to ACTIVE.md, DOC-13, TRACKER.md and SESSION-START.md.

**Step 1b documentation follow-up (2026-10-26).** Source-write decision recorded in 02b §§4.2/9/12/14 and the data dictionary: deliberately revoke the unused direct path, preserve reads with the SELECT-only policy replacement, and add 7a AC7-28 in 02b §11/§12 and SDD-2 Slice 7's detailed-AC list. Correct M67 discovery-reader ownership in 02b §§5/11–13; M32 structural wrappers remain, M15 re-check/hook stays 7b, and selected/saved choices remain visible. Correct the DeepSeek reviewer to `opencode/deepseek-v4.1-flash-free` in 02b §12/§14, this section and the four byte-identical top handoffs. Append the dated preflight audit and pointer above. Existing required content, SDD-0 §15 and historical entries are preserved. No SQL/code/tests/scripts edited; M83 remains PROPOSED / NOT_CREATED / NOT_APPLIED.

**Step 1 verification / conflicts (record retained).** Documentation checks PASS: exactly eight permitted Markdown files changed; branch/HEAD unchanged and index empty; all eight UTF-8/LF with no trailing whitespace; four new handoffs byte-identical with their earlier bodies preserved; tracker history preserved; SDD-0 §15 and all 15 existing parent AC blocks unchanged; all 32 §11 AC identifiers covered in the §12 subset; exact M82 closure appended in §35 and §15 proposal confined to this tracker; M83 file absent. `git diff --check` PASS. No tests run. Seven listed files were actually CRLF at entry despite the brief's LF note; all edited files are saved as LF. The supplied Mindmap active SDD/worklog/development-approach paths are absent in this BookConnect checkout; the current explicit brief and Phase 9 authority apply. The continuity validator was not run in this documentation-only/no-scripts step. No SQL/code/tests/scripts changed. No database or storage mutation; no tests run; nothing staged, committed or pushed.

**Step 1b verification (2026-10-26).** Phase 9 continuity validator PASS (108 Markdown files, 62 required files); `git diff --check` PASS. Content/hash checks PASS: only nine brief-named Markdown files changed during this follow-up; outside-scope tracked diff unchanged; four top handoffs byte-identical with earlier bodies preserved; tracker §§1–35, SDD-0 and existing parent AC blocks preserved; all 33 detailed §11 AC identifiers covered in §12; no old DeepSeek model ID in edited docs; M83 absent; branch/HEAD/index unchanged, index empty. All nine files are UTF-8/LF with no trailing whitespace; data dictionary and audit working copies were normalized from CRLF to LF. Size advisories are non-blocking: the existing owning SDD/tracker/dictionary remain cohesive and the requested dated audit is appended without pruning or an artificial split. Remaining evidence gap: M15 live owner/secdef not supplied; no inference or live re-query. No application/security/Python tests run; no SQL/code/tests/scripts edited; no network/database/Storage access or mutation. Existing step-1 edits and untracked `.claude/` preserved. Ten tracked documents remain modified in aggregate (including the pre-existing SDD-0 edit); nothing staged, committed, pushed, deployed or applied.

**Exact next authorized action and gate.** Source-write decision recorded; next authorized action = 7a package 1 red-first tests (02b §12). The supplied 2026-10-26 read-only preflight is recorded; then local M83 creation (authorized, after red proof and a fresh read-only preflight), green and read-only reviews under the routing above. Application, browser check and commit each need separate Owner approval. Database/storage mutation authority: none (read-only MCP only). 7b remains unauthorized; no deployment, reset, backfill or second-provider admission. No current-step network/database access or external mutation.

**M83 browser check PASS (2026-10-27).** Owner instruction: "run the M83 read-back and then the validators", then "ok proceed" with Haiku driving the built-in browser (Owner signed in; Expo web localhost:8091 from the slice 7a worktree; project ahntbtktjjmvfosgkmgn, M83 live version 20261026223715). Database snapshots by the orchestrator (read-only SQL) before and after each case; before: canonical_works 3, canonical_editions 3, book_metadata_sources 0, canonical_provider_ids 0, stats tables empty, choice effects 0, store_inventory 39, linked 2.
- Case A (new ISBN): session d120863f-9221-401e-9124-588db2201386, Add a book "The Great Gatsby" / F. Scott Fitzgerald / 9780743273565, Open Library edition Scribner 2004 selected (EP_SELECT_V1), price 100, Good, Add. New work ce8fead8-b244-4a02-94fa-66639c9e83db and edition 0b42095d-64b3-4c53-8f5a-03e50f72e952 (psr-catalogue-isbn-v1, normalizer p9-bibliographic-normalizer-v1, source_retention_note = the registry note); one book_metadata_sources row (open_library / OL23109860M, psr-catalogue-facts-v1, raw_payload {}, workExternalId null, expires_at fetched + 1 day); one canonical_provider_ids edition row; edition stats chosen 1 / added 1; choice effect counted; inventory 351809a2-51bf-4c1b-81dc-de3f81fe537d linked. PASS.
- Case B (same ISBN again): session 843d85ef-d024-4cdf-adc9-d244f6e502e5, same book and edition. Reused edition 0b42095d (no new work, edition, source or provider-ID row); stats chosen 2 / added 2; second choice effect counted once; inventory linked. PASS.
- Case C (manual card, no edition): same session, "M83 Manual Check". Inventory unlinked (manual-review-v1-metadata-r1); catalogue counts unchanged. PASS.
- Case E (Owner's shelf scan): session 88e952c0-d97b-4e65-a1a8-801f5e79c430 card "Individuals" (P. F. Strawson; automatic lookup no_match). Explicit Search Books returned 10 eligible Open Library editions; Routledge 1990, ISBN 9780415051859 selected; Add. New edition 1c238c52-0455-48ff-bb90-5c96f8472cd0 (psr-catalogue-isbn-v1), second source and provider-ID rows, stats chosen 1 / added 1, inventory linked. PASS.
- Case D (Owner's scan, card "Thinking, Fast and Slow", automatic Google Books accepted_metadata_match, no ISBN visible on the spine): not addable. NOT AN M83 DEFECT. Cause traced: the review save phase9_update_candidate_review_v2 raises P9_STATE_CONFLICT at line 51 (edge 409; client shows "This book is no longer eligible. Review the latest saved details.") because phase9_owner_ux_review_blockers adds metadata_choice_missing: phase9_edition_saved_choice_valid (M69, 20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql) confirms an automatic 'selected' suggestion only when the candidate's observed ISBN clue equals the suggestion's ISBN ("Title/author confirmations alone never confirm a medium automatic/local suggestion"). Reproduced by the orchestrator in the browser and by a read-only SQL evaluation of the same function on the candidate (choice_valid false, legacy blockers empty). The card stays in review, review never saved. UX finding: the client shows the generic eligibility text instead of the blocker's "Confirm a current edition or enter manual metadata." The Owner's workaround is Find or change edition. Google non-admission at Add (02b §5) therefore remains covered by the DB tests only, not the browser.
After: canonical_works 5, canonical_editions 5, book_metadata_sources 2, canonical_provider_ids 2, edition stats 2 rows, work stats 0, choice effects 3 (all counted), store_inventory 43, linked 5. Other observations (not M83): automatic edition lookup sat at "Finding edition…" until an explicit search; a transient "saved review changed" prompt on two Adds cleared without input; price/condition edits reset on page reload; the first one-card session auto-closed after its Add. Data written: test sessions, candidates, four private inventory drafts and the catalogue rows above, through the app only; no SQL writes, no other migration. Nothing staged, committed or pushed.
- Case D follow-up (2026-10-27): the Owner pressed "Confirm current suggestion" (edition state selection 263dd66f-a1c8-4ff6-bd51-ac0d95191b5b, selected_source current_suggestion, 06:23 UTC); the card still showed the earlier "no longer eligible" text and no server request or error followed, i.e. the client kept its earlier refusal until a page reload (finding, client-side). After a reload Haiku set price 100 / Good and Add succeeded: inventory f6b33293-8bbb-4eb2-8197-6d6435ebfbc1 (edition-selection-v1:263dd66f…:metadata-r5) is UNLINKED, editions still 5, sources still 2, edition stats rows still 2; a fourth choice effect exists and is not counted. This is the 02b §5/§7.2 Google Books non-admission path, now observed in the browser: PASS. UX findings for a follow-up: the card shows an unconfirmed automatic suggestion as Ready without offering "Confirm current suggestion"; the refusal text hides metadata_choice_missing; the refusal persists until reload; price/condition edits are lost on reload.
- Client message correction (2026-10-27, Owner: "is it small, if yes then do it yourself please"; written by the orchestrator, not Codex): `AddCandidateToInventoryAction.tsx` now names the cause. A save-stage P9_STATE_CONFLICT on a never-saved automatic ('selected') card says "Confirm the suggested edition first: open Find or change edition and tap Confirm current suggestion."; a claim-stage refusal (no request sent, stale card authority) says "This book changed after your edits. Reload the page, check it, and press Add again."; all other refusals keep the generic text. Two Jest cases added in `postScanUiCorrections.test.tsx`. Verification: `npx jest src/features/imageInventory` 997 passed / 1 failed / 4 skipped; the failure is a 5 s timeout in `unit6gMountedRouteIntegration.test.tsx` (6.3 s while Expo was running), which passes 4/4 with `--testTimeout=30000`. `tsc --noEmit` reports no errors in the changed files (exit 2 from errors elsewhere). Not browser-verified: the refusal can't be reproduced without a new unconfirmed scan card. Not changed (needs the normal slice process): Confirm on the card itself, the stale authority after Confirm, edits lost on reload.
- Message browser check attempt (2026-10-27, Haiku): session 2bc82a94-0d56-4456-a73a-fd938c0a3d0a, Add a book "Thinking, Fast and Slow" / Daniel Kahneman, no ISBN. A typed card gets no automatic suggestion ("No edition chosen" for 2 minutes), so the refusal could not be reproduced; the card was added as a manual, unlinked private draft and the session closed itself. New messages remain browser-unverified; reproducing needs a photo-scanned card with an automatic match and no spine ISBN.

**2026-10-27 - 7a review fix round (client) and M83 trace verdicts.** Codex gpt-6.1-sol xhigh implemented; Codex gpt-6.1-terra xhigh read-only reviewed; orchestrator verified. Files: `src/features/imageInventory/components/AddCandidateToInventoryAction.tsx`, `src/features/imageInventory/components/BatchReviewCard.tsx`, `src/features/imageInventory/commit/useInventoryCommitCoordinator.ts`, `src/features/imageInventory/__tests__/postScanUiCorrections.test.tsx`, `supabase/tests/phase9/phase9LeanCatalogueReview3.integration.test.mjs`, `supabase/tests/phase9/phase9LeanCatalogueReview5.integration.test.mjs`.
- Behaviour: a `no_longer_eligible` Add refusal is stored with the authority (candidateVersion, metadataRevision, reviewVersion) actually checked at the failing stage, including the post-save authority when the same Add saved first. It is cleared only when a newer authority for that candidate appears in the query cache (for example after the Owner taps "Confirm current suggestion"), so Add re-enables without a page reload and unsaved price/condition edits are kept. `succeeded`, `still_pending` and `failed_retryable` outcomes are unchanged.
- Guidance: the "confirm the suggestion" guidance shows only for a save-stage `P9_STATE_CONFLICT` when the card's current, scoped edition choices show an automatic current suggestion not confirmed by the Owner. Text: "Check the latest details. If this is the suggested edition, open Find or change edition and tap Confirm current suggestion." Other refusals keep the generic text. The claim-stage text no longer says to reload: "This book changed after your edits. Check the latest details and press Add again."
- Tests: Review3 supplied-companion case relabelled as 7a refusal; Review5 no-hint case gained a positive control (the target resolves with a provider record, then NULL without it; an always-NULL helper fails); new hook and mounted BatchReviewCard tests for refusal to confirm to Add re-enabled with edits preserved and sent (service responses mocked), post-save refusal retention, and conditional guidance with and without evidence.
- Reviews: Terra round 1 on the first Sol diff: 3 Medium findings (refusal cleared by its own save, guidance lost although choices were available, recovery test not mounted); all fixed in Sol round 2. Terra found the claim-stage dead end not reachable through the batch card path.
- Verification run by the orchestrator (2026-10-27): Jest 4 suites (postScanUiCorrections, useInventoryCommitCoordinator, batchReviewCard, inventoryCommitCoordinator) 163/163 passed; PGlite Review3 + Review5 22/22 passed; Phase 9 continuity validator PASS. Sol reports red-first failures before each fix and TypeScript 8 errors in files outside this change (pre-existing, not touched).
- Not browser-verified.
- M83 trace verdicts (Codex gpt-6.1-terra max, read-only): 1 confirmed, 4 latent, 0 rejected; all carried to 7b. (1) No-hint Select counts an option whose normalizer version differs from the lookup/attempt; Add rejects the lineage — LATENT (not reachable via current production paths); impact: chosen count; fix size M. (2) Admission is read without FOR SHARE in `phase9_catalogue_choice_target_v1`; an operator/service-role provider policy change concurrent with an Owner Select can let chosen count after revocation — CONFIRMED (reachable only with a concurrent manual registry change; no app code writes the registry); impact: chosen count only, inventory unlinked, no tenant exposure; fix size S (use the locked source-policy builder for no-hint Select admission). (3) Saved-ID Add ignores an existing conflicting provider-work tuple when title/authors match — LATENT (needs a postgres/seeded or retained combined snapshot); impact: could link to the wrong canonical work; fix size M. (4) Select checks the canonical display cover against the scoped provider's cover rules — LATENT; impact: chosen count late or missing; fix size S. (5) Select requires an existing provider-work tuple that Add could create — LATENT; impact: chosen count late or missing; fix size S.
- Owner decision 2026-10-27: carry all five to 7b (fix red-first before or with 7b); no separate M84 now. M84 is not authorized.
- Status: active work unit `post_scan_rework_slice7a_closeout`; commits 621b6d1 (slice 7a, M83) plus the fix-round commit made on the Owner's instruction after this update (hash not recorded); not pushed. Database/storage mutations in the fix round: none.

## 37. 2026-10-27 - Confirm-then-Add browser check (fix round 6e4924d): PARTIAL

**Browser run.** Run by Claude Haiku in the built-in browser; Owner signed in; dev app on localhost:8091 from the worktree; no page reload during the run. Session 4ad4f6c0-9dcf-4bba-bf08-634c2df172b5 (8 cards; the list renders lazily, so cards 7–8 only mount after scrolling).

**Card.** Card 8 "The Complete Father Brown" (G. K. Chesterton), candidate 95b406c5-0450-45a7-8ef5-e28f93e1ab5a, automatic Google Books suggestion (`accepted_metadata_match`), unconfirmed. The other seven cards were no_match or ambiguous.

**Steps.**

- PASS: price set to ₹150 (custom) and condition Good; Add refused with "Check the latest details. If this is the suggested edition, open Find or change edition and tap Confirm current suggestion."; Add disabled.
- PASS: after "Confirm current suggestion", without reload the refusal text was gone, Add was enabled, ₹150 / Good were kept.
- FAIL (UI only): pressing Add again showed "Adding", then the draft-conflict prompt "The saved review changed while compact edits were open. Choose which draft to continue with." ("Use latest saved review" / "Reapply compact edits"); "Added to Inventory" never appeared. Neither button was pressed.

**Server truth** (read-only SQL, project ahntbtktjjmvfosgkmgn): candidate state committed, commit_outcome committed_private, review_version 1, metadata_revision 5, saved review priceMinor 15000 / good; store_inventory row 0be74daa-9744-4e33-8cfc-52460ed2c8ef created 2026-10-27 09:51:01 UTC, canonical_edition_id NULL (expected: Google Books is not shared-admitted, 02b §5/§7.2). store_inventory total 46.

**Also observed.** All 8 Add buttons disabled right after the refusal (not yet explained); console showed 409/403/503 responses, CORS blocks on phase9-owner-ingestion, ERR_FAILED / ERR_CONNECTION_CLOSED and an auth refresh "Failed to fetch", not tied to steps.

**Follow-up** (Owner 2026-10-27): Codex Sol diagnoses and fixes the conflict prompt red-first; Codex Terra reviews read-only. Not fixed at the time of this entry.

**Database/storage mutations.** None by the agents; the Owner's scan and the one Add created dev data through the app.

## 38. 2026-10-27 - Add draft-conflict fix (7a closeout) and browser check: PASS

**Cause (pre-existing in 621b6d1, reachable after 6e4924d made refusal → Confirm → Add recoverable).** The batch card treated the Add's own first review Save as an external change while compact edits were open and raised "The saved review changed while compact edits were open. Choose which draft to continue with." Separately, the "Added to Inventory" receipt sat behind the allowed-actions gate, which a committed card no longer has.

**Fix (Codex gpt-6.1-sol xhigh, three rounds; Codex gpt-6.1-terra xhigh read-only reviews: round 1 FINDINGS (1 High, 3 Medium), round 2 FINDINGS (1 Medium, 1 Low), round 3 PASS).**

- The card adopts only the authority acknowledged by this command's own Save/commit response, never by review equality or success alone; any intervening authority still raises the conflict prompt.
- Before commit, the coordinator revalidates every submitted review field (not just edition identity) and the acknowledged Save versions; an intervening change refuses the commit instead of committing another device's review.
- Save-authority adoption runs in screen-owned state, so bulk retry works for cards scrolled offscreen (virtualized list).
- Commit outcomes are scoped to the Owner/session; the receipt checks candidate and session.
- The success receipt renders before the allowed-actions gate.
- The Unit 6F architecture boundary is kept (no inventory-commit references from the picker side); a route-composition test mock was updated, assertions unchanged.

**Files.** Under `src/features/imageInventory/`: commit (`inventoryCommitCoordinator.ts`, `inventoryCommitPolicy.ts`, `inventoryCommitTypes.ts`, `useInventoryCommitCoordinator.ts`, new `useScopedCommitState.ts`), components (`AddCandidateToInventoryAction.tsx`, `BatchReviewCard.tsx`, `PostScanInventoryActions.tsx`), `queries/ownerCandidateAuthority.ts`, `screens/CaptureProgressScreens.tsx`; tests: new `CaptureProgressCommitAuthority.test.tsx`, `commitScope.test.tsx`, `compactCommitAuthority.test.tsx`, plus updated postScanUiCorrections, batchReviewCard, inventoryCommitCoordinator, useInventoryCommitCoordinator, AddCandidateToInventoryAction, CaptureProgressScreens, ownerEditionPickerCache and unit6gMountedRouteComposition suites.

**Verification (run by the orchestrator).** `jest src/features/imageInventory --testTimeout=30000`: 74 suites passed, 1 skipped; 1,074 tests passed, 4 skipped, 0 failed. Implementer reports red-first failures for each fix. TypeScript: 8 pre-existing errors in `src/features/books/export/`, none in imageInventory.

**Browser check (2026-10-27, Claude Haiku, built-in browser, Owner signed in, session 4ad4f6c0-9dcf-4bba-bf08-634c2df172b5): PASS for the draft-conflict fix.**

- BOOK 3 "Bleak House" (Dickens), no provider match, never-saved review: price ₹175 (custom) and condition Good set as compact edits ("Edited · saved when added", "Ready"); Add pressed: "Adding" ~8 s, then the card left the review list; header went from "1 Added" to "2 Added". No draft-conflict prompt; not stuck.
- After a page reload: header "8 Detected / 6 In review / 0 Ready / 6 Need review / 2 Added"; BOOK 3 no longer in the review list.
- Server truth (read-only SQL, project ahntbtktjjmvfosgkmgn): candidate committed, commit_outcome committed_private, review_version 1, saved priceMinor 17500, good, quantity 1; store_inventory row 2128a9f5-c30f-4e49-80f3-8294d738a723 created 2026-10-27 11:38:10 UTC, canonical_edition_id NULL (no edition chosen); store_inventory total 47.
- Not re-checked in the browser this run: the refusal → Confirm current suggestion hint (no unconfirmed automatic suggestion left in this scan; it passed in the earlier PARTIAL run and in mounted tests).
- Observed, not caused by this change: the "Added to Inventory" text was not seen because the committed card leaves the review list after the batch reread; the edition search ("Search Books") stayed on "Searching books…" and BOOK 2 showed "Finding edition…" while the browser console showed CORS preflight failures and 403/503 responses for the `phase9-owner-ingestion` edge function from localhost:8091 (the same errors appeared in the earlier run before this fix). Follow-up: investigate the edge-function CORS/503 errors separately.

**Database/storage mutations.** None by agents; dev data via the app (one Add).

**Status.** The 7a closeout fix is done and browser-checked; commit and push of branch `claude/phase9-psr-slice7a-lean-catalogue-identity` are made on the Owner's instruction (hash not recorded in the docs). Active work unit: post_scan_rework_slice7a_closeout. Exact next authorized action: Owner decides on merging the 7a branch into main (needed before 7b worker deploys/browser checks); separately, investigate the phase9-owner-ingestion CORS/503 errors seen from localhost. 7b runs in its own session/worktree (`.claude/worktrees/p9-7b`, branch `claude/phase9-psr-slice7b-lean-catalogue-writes`).
## 39. Slice 7b start: split, SDD amendment, read-only preflight, 2026-10-27, package 4 red-first tests, packages 5-7

**Authorized work unit and scope.** Owner 2026-10-27 ("go, split 7b") authorized the Slice 7b start in its own worktree `.claude/worktrees/p9-7b`, branch `claude/phase9-psr-slice7b-lean-catalogue-writes`, cut from commit `6e4924d` (the 7a branch `claude/phase9-psr-slice7a-lean-catalogue-identity`). Nothing is merged or pushed. Active work unit: `post_scan_rework_slice7b1_package5_m84_sql_awaiting_owner_approval`. Package 4 (02b section 12 row 4: red-first tests only) is complete on 2026-10-27; the slice-start part of this entry is kept as history and the package-4 evidence is appended below. The 7a branch, its uncommitted client fix (Add draft-conflict prompt) and the 7a merge to `main` belong to the 7a session.

**Worktree creation note.** The first attempt with the longer folder name failed on a tracked docs/user evidence file name (Windows path limit); the half-made folder was removed and the worktree was created at `.claude/worktrees/p9-7b`; the branch name was kept.

**Earlier reading list completed from `6e4924d`.** ACTIVE, DOC-13, SESSION-START and TRACKER top stanzas, tracker 38 section 36 and the 7a browser/fix-round entries, SDD-0 sections 7.1 and 15, SDD-2 Slice 7, 02b in full, the M83 migration functions link_for_add_v1, choice_target_v1 and legacy_select_candidate and the scan sites of the normalized work key.

**Owner decisions (2026-10-27, split).** 7b is split by semantic responsibility into **7b-1 = M84** (private companions, completion v2, durable receipts, searched counts, the five carried M83 trace fixes of 02b section 13.3, and an expression index for the normalized title/author probes on canonical_works) and **7b-2 = M85** (the shared edition-list cache, with its own review and its own apply approval). 7b-2 requires 7b-1 applied and verified. Proposed local files: `supabase/migrations/20261027000084_marketplace_phase9_catalogue_companions_completion.sql` (M84) and `supabase/migrations/20261027000085_marketplace_phase9_shared_edition_cache.sql` (M85). Both are PROPOSED / NOT_CREATED / NOT_APPLIED. Numbers 84 and 85 were verified free on 2026-10-27: latest live migration is 20261026223715 (M83) and no local or remote-tracking ref has a migration numbered 84 or higher. Both must be re-verified immediately before creating either file.

**SDD amendment approved by the Owner on 2026-10-27.** 02b (status and migration rows, section 10 order and deploy dependency, new AC7-29 to AC7-34 in section 11, section 12 package table now rows 4-11 with a 7b-1/7b-2 split of the acceptance subset and the 7b-2 object list, new section 13.4, Owner decisions 10-14 in section 14, two conflict-register rows), SDD-0 section 7.1 (7b-1 and 7b-2 rows; slice 8 now depends on 7b-2) and SDD-2 Slice 7 (status paragraph and AC pointer). New acceptance: AC7-29 Select/Add lineage parity (Owner confirmed full parity with the lineage predicate in M83 lines 943-953 is the intended reading), AC7-30 registry lock on no-hint Select admission (the confirmed trace item), AC7-31 saved-ID Add provider-work conflict, AC7-32 cover rules only for provider-sourced metadata, AC7-33 Select does not require a work tuple that Add could create, AC7-34 the probe index (ISBN probes already have unique indexes and get none). The lookup-effects table's cache columns stay in M84 as nullable columns written only by M85 (Owner decision 2026-10-27).

**How the five carried items map onto M83 (all line numbers refer to `supabase/migrations/20261026000083_marketplace_phase9_lean_catalogue_identity.sql`).** Item 1 lineage: Add checks adapter key/version, attempt and lookup normalizer and the registry policy version at lines 935-953, the no-hint Select path in choice_target_v1 checks none of them. Item 2: choice_target_v1 reads admission through phase9_catalogue_shared_admitted_v1 without a registry lock at lines 655-656, whereas phase9_catalogue_source_policy_v1 locks the registry row FOR SHARE. Item 3: the saved-ID branch of link_for_add_v1 (lines 796-919) checks edition tuples, ISBNs and sources (lines 877-888) but not an existing provider-work tuple that targets another work. Item 4: choice_target_v1 passes the metadata coverReference to phase9_catalogue_provider_ids_valid_v1 for every path (lines 659-661), including hinted canonical projections. Item 5: choice_target_v1 requires an existing provider-work tuple (lines 733-735) that Add could create. The three scan sites of the normalized work key that the probe index must match are at lines 397, 553 and 891 of the same file.

**Read-only preflight (2026-10-27, Supabase MCP, project ahntbtktjjmvfosgkmgn, https://ahntbtktjjmvfosgkmgn.supabase.co, PostgreSQL 17.6; SELECT/catalog/list_migrations only, nothing written).** Recorded in supporting/database-current-vs-target.md under "2026-10-27 slice 7b read-only preflight". Headlines: no 7b object exists live (no completion v2, reuse, companion or cache function); function fingerprints recorded for every function 7b-1/7b-2 will replace; no index exists on the normalized title/author expressions; live lookups 244 all completed; cache entries 33, all store_private Google Books rows, none public; works 5, editions 5, sources 2, provider IDs 2, edition stats 2 rows, choice effects 5 (3 counted, 2 pending), blocklist 0. Not collected: deployed worker versions beyond the lookup version columns, scan-origin observation provenance, physical-call and reservation tables (7b-2 start), any provider licence investigation.

**Routing (02b section 12 and 14 decision 13).** Code by Codex gpt-6.1-terra at maximum reasoning, workspace-write, one Codex session per package, resumed for fix rounds; read-only reviews by Codex gpt-6.1-sol xhigh, Codex gpt-6-luna xhigh and OpenCode Muse (Terra never reviews its own code); Haiku runs tests and browser checks (the Owner signs in); Muse writes docs from a factual brief; the orchestrator writes SDD amendments.

**Deploy dependency (decision 14).** The Render metadata worker deploys only from `main`, so browser checks that need worker code (companions, completion v2, the cache) wait until 7a is merged to `main` and deployed by the 7a session. Database-side checks (the five carried fixes, Select/Add chosen and added counts, the probe index) need no worker deploy.

**Completed / documents changed.** Identical new top stanzas added to ACTIVE.md, DOC-13, TRACKER.md and SESSION-START.md above the existing 7a stanza (7a stanza and everything below it preserved); this tracker appends this entry as section 37 after section 36.

**Authority and verification.** Documentation-only for the slice-start part (`git diff --check` clean at the time; Phase 9 continuity validator PASS in this worktree, PHASE9_CONTINUITY_CHECK=PASS, 108 Markdown files, 62 required files, after copying two untracked evidence files that earlier docs link to, `.claude/psr-slice6/db-evidence.md` and `.claude/psr-slice7a/preflight-1.md`, from the 7a worktree into this one at the same paths where they stay untracked). Package-4 verification (orchestrator-checked, 2026-10-27; Haiku ran the PGlite and Jest commands and the orchestrator ran the native runner; counts from the raw output files): existing 12 Lean PGlite files 273 pass / 0 fail; CatalogueLink 79 pass / 0 fail; new PGlite suites 23 pass / 107 red (Companion 1/24, Completion 4/35, Searched 2/9, CarriedFixes 13/13, Accounting 3/26); Jest 36 pass / 33 red (companion 1/12, transport 1/7, recovery 3/3, GUARD file 31/11). Native runner with `-IncludeOpenLibrary`: pre-existing suites 20/20, 12/12, 25/25 pass; lean-catalogue native 26 tests, 17 pass, 9 red, teardown PASS. The reds are feature assertions; the baseline controls are green. Database/storage mutation: none. The only database access was read-only; the native tests ran on disposable local PostgreSQL clusters that were torn down (POSTGRES_TEARDOWN_PASS). Nothing is staged, committed, pushed, deployed or applied.

**Exact next authorized action and gate.** Report to the Owner and wait. Package 5 (write M84 SQL, 02b section 12 row 5) needs the Owner's separate creation permission; before creating the file, re-verify project `ahntbtktjjmvfosgkmgn` and that migration numbers 84 and 85 are still free through Supabase MCP. Applying M84, any worker deploy (after 7a is on `main`), commit, push and merge each need a separate Owner approval. The 7a merge and client fix remain with the 7a session. Database/storage mutation authority: none. The only database access was read-only; the native tests ran on disposable local PostgreSQL clusters that were torn down (POSTGRES_TEARDOWN_PASS). Nothing is staged, committed, pushed, deployed or applied.

**Package 4 scope (02b section 12 row 4: red-first tests only).** Complete on 2026-10-27. No production SQL, no migration file, no docs-of-behavior change. M84 and M85 are still PROPOSED / NOT_CREATED / NOT_APPLIED.

**Package 4 test files (all in the p9-7b worktree, all uncommitted and untracked or modified, nothing staged).** `supabase/tests/phase9/phase9LeanCatalogueCarriedFixes.integration.test.mjs`, `supabase/tests/phase9/phase9LeanCatalogueCompanion.integration.test.mjs`, `supabase/tests/phase9/phase9LeanCatalogueCompletion.integration.test.mjs`, `supabase/tests/phase9/phase9LeanCatalogueSearched.integration.test.mjs`, `supabase/tests/phase9/phase9LeanCatalogueAccounting.integration.test.mjs` (new, split from Completion), `leanCatalogueCompletionFixture.mjs` (new), `leanCatalogueFixture.mjs` (additive `m84` option and `requireM84`), `phase9LeanCatalogueConcurrency.postgres.mjs` (native cases for AC7-30, AC7-31, AC7-18, AC7-22), `run-phase9-bookstore-first-postgres.ps1` (additive: legacy native suites stay on an M83-only clone; when an M84 file exists a second clone gets M84 for the M84 group; with no M84 file behavior is unchanged), `supabase/migrations/__tests__/marketplacePhase9LeanCatalogue.test.ts` (M84 describe in the GUARD), edge tests `supabase/functions/__tests__/phase9_catalogue_write_companion.test.ts`, `supabase/functions/__tests__/phase9_catalogue_write_transport.test.ts`, `supabase/functions/__tests__/phase9_catalogue_write_recovery.test.ts` and `fixtures/phase9/catalogueWrite.ts`.

**Package 4 authors.** Codex gpt-6.1-terra (maximum reasoning) wrote the first version; its resumed run was cut off once by the Codex usage limit (reset 9:07 PM) and finished in a second resume with a narrower brief. Fix rounds were done by Codex gpt-6.1-sol (xhigh), at the Owner's request that Sol fixes the complicated findings (02b decision 13 had said Terra resumed for fix rounds; the Owner's instruction of 2026-10-27 takes precedence).

**Package 4 reviews (read-only, 2026-10-27).** OpenCode Muse `VERDICT: PASS`; Codex Sol `VERDICT: FINDINGS` (1 High, 8 Medium, 1 Low); Codex Luna `VERDICT: FINDINGS` (8 Medium). No reviewer found a test that is red for a wrong reason. Findings were gaps of the kind "a broken M84 could still pass", plus: the native runner would have applied M84 to the legacy native fixtures (High), non-UUID bindings in the edge fixture, and an over-constraining helper-level policy-version assertion.

**Package 4 fix round 1 (Sol).** All 10 Sol findings fixed.

**Package 4 fix round 2 (Sol, "confirm first, then fix").** Of Luna's 8 findings, L1 to L6 confirmed and fixed (L2 and L3 reproduced with disposable mutation probes that were not left in the repo), L7 already fixed by round 1, L8 NOT confirmed because 02b section 5, section 7.1 step 4 and AC7-21(b) require synthetic-provider proofs below production admission and production completion must deny shared writes for such a provider; the orchestrator verified that in the SDD (lines about 454 and 1101).

**Package 4 decision recorded.** The M73 gate `phase9_edition_source_policy` (M73 lines 90-102) runs before `choice_target_v1` in Select and already refuses disabled, storage-revoked and policy-version-mismatched providers. Those cases are green baseline controls, not reds. The helper-level policy-version red was demoted to a public-Select control after Luna's finding.

**Package 4 native reds detail.** The 9 native reds: AC7-30 no-hint Select takes no registry lock (2), AC7-31 saved-ID Add keeps a foreign work (1), and 6 tests that need the absent v2 completion function; one baseline (committed revocation pre-empted by the M73 gate) is green.

**Not proved yet.** The green paths, ACLs, real concurrency of completion and the forward replacements need M84; the new two-clone native runner path (M83 clone for legacy, M84 clone for the M84 group) runs for real only once an M84 file exists, so legacy native fixtures' compatibility with M84 is a risk until then; the saved-ID disappeared-fallback branch is not observable in the harness (accepted).

**Spec-silent contracts used by the tests (to be confirmed when M84 is written).** The index name `canonical_works_normalized_probe_idx` (02b says "proposed"), error codes `P9_STATE_CONFLICT` and `42501` in some refusal checks, and the lookup-effects/companion table and function names listed in 02b section 12; the TypeScript contract module path is fixed by 02b but exported parser names are not.

**This documentation update.** The four top stanzas (ACTIVE.md, DOC-13, TRACKER.md, SESSION-START.md) were rewritten to the package-4-complete heading with the package-4 summary and the package-5-awaiting-approval gate, kept byte-identical to each other; the 7a stanza and everything below it in each file is untouched. This section 39 keeps its slice-start facts and appends the package-4 evidence above; no section 38 was added.

**Status (2026-10-28, 7b-1 applied).** M84 is APPLIED to the dev database as live version `20261028125102` (2026-10-28; read-back below). M85 (7b-2, shared edition-list cache, packages 8-11) is NOT started (PROPOSED / NOT_CREATED / NOT_APPLIED); it needs 7b-1 verified plus its own creation and apply approvals. Slice 7a (M83, live as version `20261026223715`) code is on branch `claude/phase9-psr-slice7a-lean-catalogue-identity` (`6e4924d`), not merged or pushed; another session owns its client fix, merge and deploy. Nothing is staged, committed, pushed, merged or deployed; the working tree is uncommitted. No Storage mutation. The only database mutation is the M84 apply recorded below.

**M84 file and contents.** File `supabase/migrations/20261027000084_marketplace_phase9_catalogue_companions_completion.sql`. Contents: private tables `phase9_catalogue_companions` and `phase9_catalogue_lookup_effects` (nullable cache columns reserved for M85); companion validator; completion v2 (service-only; v1 delegates to v2); M73 recovery replacement; M15 local-completion hook replacement; forward replacement of the M32 private structural-local wrapper; Select/Add companion handling; searched counts; five carried M83 fixes (AC7-29..33) and the probe index `canonical_works_normalized_probe_idx` (AC7-34).

**Authors and routing deviation.** Codex gpt-6.1-sol (xhigh) wrote M84 (package 5), package 6 (worker TypeScript) and all fix rounds except round A, at the Owner's instruction of 2026-10-28 that Sol writes 7b packages; this deviates from 02b decision 13 (which named Terra); the Owner's instruction takes precedence. Package 7 (this closeout) by OpenCode Muse; test runs by Claude Haiku.

**Package 6 files and edge tests.** Under `supabase/functions/_shared/imageInventory/`: new `contracts/catalogueWrite.ts`, new `metadata/openLibrary/catalogueWrite.ts`; changed `metadata/contracts.ts`, `metadata/openLibrary/adapter.ts`, `runtime/metadataEditionOptions.ts`, `runtime/metadataEditionOptionsBoundary.ts`, `runtime/metadataEditionOptionsRpc.ts`. New edge tests `supabase/functions/__tests__/phase9_catalogue_write_fetched_at.test.ts` (19 cases) and `phase9_catalogue_write_recovery_outage.test.ts` (8 cases).

**Fix rounds A-F.** Round A (Muse): Select companion fix and completion v2 session-lock order (see `psr7b-review/out-muse-fix-m84-a.md`). Round B (Sol; see `psr7b-review/out-sol-b2.md` and `psr7b-review/out-sol-b3.md`): P1 native test inspect fix, local-hook setup fix, P2 deadlock fix (forward-replaced M32 wrapper takes the session lock first; M15 hook takes the session lock first and inserts the lookup before `choice_target`). Round C (Sol; see `psr7b-review/out-sol-c.md`): `marketplace_sec.phase9_catalogue_lock_owner_scope_v1(uuid)` taken after state locks in Select, Add and the M15 hook (owner review-scope cross-session cycle found by DeepSeek); worker timestamps compared as bigint microseconds via `fetchedAtMicros` (Luna). Round D (Sol; see `psr7b-review/out-sol-d.md`): Terra T1 (recovery outage mitigated), T2 (stranded job fixed, narrowed to earlier-claim evidence), T3 (second microsecond instance on the legacy path). Round E (Sol; see `psr7b-review/out-sol-e.md`): native Round C test setup corrected (closed session 1 and active session 2 of one owner and store; the `image_extraction_sessions_one_active_initiator` index defined in `20260722000002_marketplace_phase9_extraction_persistence.sql:30` forbids two active sessions) and a validated `-OnlyGroup` parameter added to `run-phase9-bookstore-first-postgres.ps1`. Round F (Sol; see `psr7b-review/out-sol-f.md`): final-review finding R1, Select now refuses a companion/source work disagreement exactly as the resolver does (two parity tests added; CarriedFixes 28 -> 30).

**Reviews (read-only except where noted) with verdicts.** M84 SQL reviewed by Muse, Sol and Luna (see their `psr7b-review/out-*.md` files; SQL detail also in `psr7b-review/out-sol-m84-sql.txt`); DeepSeek `opencode-go/deepseek-v4.1-flash` `VERDICT: FINDINGS` (review-scope cycle); GLM `opencode-go/glm-5.3-flash` `VERDICT: PASS`; package 6: Muse `VERDICT: PASS`, Luna `VERDICT: FINDINGS` (1 Medium, microsecond timestamps; see `psr7b-review/out-luna-pkg6.txt`), Terra (Codex) `VERDICT: FINDINGS` (T1, T2, T3; see `psr7b-review/out-terra-pkg6.txt`); package 6 detail in `psr7b-review/out-sol-pkg6.md`; final whole-slice review by Sol (read-only, xhigh; see `psr7b-review/out-sol-final.txt`): no blocker, one should-fix (R1), fixed in round F. Every confirmed finding was fixed; Muse's package 6 PASS did not catch Terra's three findings.

**Final verification actually run.** PGlite: 12 existing Lean files 273/273, CatalogueLink 79/79, Companion 25/25, Completion 39/39, Searched 11/11, CarriedFixes 30/30 (after round F; 28/28 in the earlier full run), Accounting 29/29; Jest: catalogue-write companion 13/13, transport 8/8, recovery 6/6, GUARD `marketplacePhase9LeanCatalogue.test.ts` 49/49 (round F: Sol's own run, 486 PGlite + 49 GUARD, 0 failures; the full Haiku run before round F showed the same suites green with CarriedFixes 28). Worker round D: Sol's own run, full `supabase/functions` suite 1,386/1,386 and `tsc` clean (not repeated by Haiku). Native Postgres (Haiku, full run before round F): edition-picker, open-library, bookstore-first, catalogue-link, lean-catalogue-identity, lean-catalogue-completion (10 pass / 17 skipped) and lean-catalogue-local-hook (3 pass / 0 fail, no deadlock) PASS; edition-first-save FAIL 0/11 for an environment reason only (`Cannot find package 'pg'` in this worktree; unrelated to M84; those 11 tests were not executed here). After round F only the native completion group was re-run: lean-catalogue-completion PASS again (10 pass / 0 fail / 17 skipped, teardown clean, runner exit 0).

**Not verified.** AC7-8 and AC7-28 effective role privileges/RLS, AC7-13 and AC7-17 real response-loss/outage/rollback, AC7-18 and AC7-22 runtime waits beyond the native groups above, AC7-34 planner use of the index, and every M85 acceptance item (AC7-6, 7, 9, 15, 16, 24, 26, 27 and the cache parts of others): they need execution on a real database after apply or belong to 7b-2.

**Environment notes.** `pg` is missing in the p9-7b worktree (no `node_modules`); `core.autocrlf=true` causes the CRLF-sensitive edition-first-save T8 case to fail; Jest media tests need a temporary copy of `magick.wasm` from the main checkout `node_modules/@imagemagick/magick-wasm/dist/magick.wasm` (removed afterwards); the continuity validator is blocked by PowerShell execution policy on this machine; Codex sandboxes cannot run the native runner (initdb), so Haiku or the orchestrator runs it.

**Deviations to record.** (1) The M32 private structural-local wrapper is replaced in M84 although 02b's function list does not include it (Owner approved the coordinated patch). (2) Sol authored M84 and the fix rounds instead of Terra (above).

**Spec-silent choices to record.** Helper names `companion_for_choice_v1`, `count_search_v1`, `plan_keys_v1`, `phase9_catalogue_lock_owner_scope_v1`; error codes `P9_EDITION_ROWS_INVALID`, `P9_STATE_CONFLICT`, `P9_IDEMPOTENCY_MISMATCH`, `P9_CATALOGUE_COMPANIONS_INVALID`; the completion digest uses `jsonb::text` so companion-array order affects the digest; probe index name `canonical_works_normalized_probe_idx`; worker exports `CATALOGUE_WRITE_VERSION`, `CatalogueWriteCompanion`, `parseCatalogueWriteCompanion`, `parseCatalogueCompanions`, `serializeCatalogueCompanions`, `isCatalogueScalar`, `fetchedAtMicros`, `EditionOptionsCompletionUncertainError`.

**Residual-risk table.**

| ID | Risk | Status |
|---|---|---|
| R-a | Terra T1: the recovery attempt budget is not database-owned; an attempt-neutral deferral is not specified by 02b and needs a later SQL/RPC claim policy | Mitigated in the worker only |
| R-b | Completion v2 takes the registry SHARE lock before new private receipt/companion INSERTs | Recorded as a risk |
| R-c | Add flushes edition stats before work stats in the pending case | Recorded as a risk |
| R-d | The M32 wrapper replacement (deviation) | Owner approved the coordinated patch |
| R-e | The items listed under "Not verified" above | Need a real database after apply or belong to 7b-2 |

**Exact next authorized action and gate (the Owner decides).** Commit/push/merge the 7b-1 work; deploy the worker after 7a is on `main`; run a live smoke/verification of the not-yet-verified items (a new brief and the Owner's approval for any test data); start 7b-2 (M85) only after 7b-1 is verified plus its own creation and apply approvals; decide whether the recovery-budget gap (R-a) needs a database follow-up. Until then: Active work unit "7b-1 applied, waiting for Owner decisions"; Database/storage mutation authority: none beyond the M84 apply recorded here.

**This documentation update (2026-10-28, packages 5-7).** The five files changed are `docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md`, `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`, `docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/SESSION-START.md`, `docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/TRACKER.md`, and `docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md` (this file, section 37 extended; no section 38 added).

**M84 applied (2026-10-28).** M84 applied on 2026-10-28 to Supabase project `ahntbtktjjmvfosgkmgn` (https://ahntbtktjjmvfosgkmgn.supabase.co) on the Owner's explicit request ("get haiku to do [the preflight] and later apply the migrations"). Local file `supabase/migrations/20261027000084_marketplace_phase9_catalogue_companions_completion.sql` (1789 lines, 131354 bytes). Live version `20261028125102`, live name `marketplace_phase9_catalogue_companions_completion` (the local and live version strings differ, as for M83 whose live version is `20261026223715`). Applied with the Supabase MCP `apply_migration` in one call by a Claude Sonnet subagent that copied the SQL from the file. Read-only preflight (Claude Haiku, same day): CLEAN. Project URL matched; latest live migration was `20261026223715` (M83); no version at or above the M84 version and no name containing `catalogue_companions`; the two new tables, the probe index and the seven new functions were absent; all ten replaced functions existed with identity arguments matching the file (owner `postgres`, `search_path=""`); no non-idle sessions and no ungranted locks; roles anon, authenticated, postgres and service_role present. Not covered by the preflight: return types of replaced functions and the existence of the two index helper functions (a mismatch would have failed the apply and rolled it back as a unit). Result: `{"success":true}`. Readback (execute_sql, read-only): the stored migration text in `supabase_migrations.schema_migrations` has length 131354 and md5 `253b224c9e7270590751aa435a43ef9f`, equal to the md5 of the local file (the transcription was faithful; SHA-256 of the local file: not recorded). New tables `marketplace_sec.phase9_catalogue_companions` and `marketplace_sec.phase9_catalogue_lookup_effects`: owner postgres, row level security enabled, not forced, no policies, ACL only postgres. New functions in `marketplace_sec`: `phase9_catalogue_valid_companion_v1`, `phase9_catalogue_companion_for_choice_v1`, `phase9_catalogue_count_search_v1`, `phase9_catalogue_lock_owner_scope_v1`, `phase9_catalogue_plan_keys_v1` (all postgres-only ACL, `search_path=""`) and `phase9_complete_candidate_edition_options_v2` (ACL postgres and service_role only); `public.phase9_complete_candidate_edition_options_v2` (ACL postgres and service_role only, exactly one overload in each schema); `public.phase9_add_candidate_to_inventory_v1` keeps EXECUTE for `authenticated`. Index `canonical_works_normalized_probe_idx` on `public.canonical_works` is valid and ready. Why not the Supabase CLI: it is installed (v2.20.12) and logged in, but `supabase db push --linked --dry-run` refused because the remote migration history contains versions that have no local file (earlier migrations were applied through the connector with their own timestamps); repairing that history would rewrite the migration table, so it was not done. The link command created `supabase/.temp` in the worktree, which was removed afterwards (it is gitignored). No other database write. Not yet verified after the apply: AC7-8 and AC7-28 effective role privileges and RLS operations through real roles, AC7-13 and AC7-17 real response-loss/outage/rollback behavior, AC7-34 planner use of the index, a live smoke of completion v2 and Add through the worker, and every M85 item (M85 stays PROPOSED / NOT_CREATED / NOT_APPLIED). Nothing deployed: the worker has not been deployed, and the worker deploy still waits for slice 7a to reach `main`. Nothing committed, pushed or merged; the working tree is uncommitted. Compatibility note (02b section 10, already recorded): completion v1 delegates to v2, so workers deployed before this change keep working against the new database. Next authorized action (the Owner decides): commit/push/merge the 7b-1 work; deploy the worker after 7a is on `main`; run a live smoke/verification of the not-yet-verified items (a new brief and the Owner's approval for any test data); start 7b-2 (M85) only after 7b-1 is verified plus its own creation and apply approvals; decide whether the recovery-budget gap (R-a) needs a database follow-up. Active work unit: "7b-1 applied, waiting for Owner decisions". Database/storage mutation authority: none beyond the M84 apply recorded here. Migration ledger: local file `supabase/migrations/20261027000084_marketplace_phase9_catalogue_companions_completion.sql` (1789 lines, 131354 bytes) | live version `20261028125102` (`marketplace_phase9_catalogue_companions_completion`) | project `ahntbtktjjmvfosgkmgn` re-verified via preflight/apply/readback | effects: two new private tables, seven new functions, ten replaced functions, one probe index, v1-delegates-to-v2 compatibility | verification: result `{"success":true}`, readback length 131354 and md5 `253b224c9e7270590751aa435a43ef9f` equal to the local file.
