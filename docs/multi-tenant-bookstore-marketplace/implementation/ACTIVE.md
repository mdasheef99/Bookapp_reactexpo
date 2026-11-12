# Marketplace current state

Recorded state: 2026-11-13. **Slice 8 is complete on dev** (8a, 8b, 8c;
closed 2026-11-09). **02d Units 1a and 1b are built and committed locally**
(`7600805`, `f10e431`, not pushed); M100+M101 are local files, NOT APPLIED to
any database. This file holds current state only: it is rewritten (not
appended to) at session close, and rotated into `history/` at each slice
close. Dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **02d edition-sheet prefill, Units 1a and 1b BUILT**
  (SDD rev c; Owner 2026-11-12; the existing search button stays,
  OD-2026-10-30-4), on branch `phase9/02d-prefill`. Units 2 and 3 are
  not built.
  Slice 8 closed on dev 2026-11-09 on branch `phase9/slice8-providers`.
- Completed milestone: **slice 8 complete on dev (2026-11-09)**: 8c fix
  round (M99, worker `c64c2fb`, app `0b00441`) deployed, re-tested, stuck
  holds released, drain checks 01/02/05 passed, Muse review CLEAN.
  [Closeout evidence](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-09-fix-round-review-muse-and-slice-8-closeout);
  8b: [tracker 40](phase-9-image-inventory/trackers/40-package8b-worker-evidence.md);
  8a: [tracker 39](phase-9-image-inventory/trackers/39-package8a5-contract-review.md).
  **02d Unit 1a built locally 2026-11-12** (`7600805`, not pushed): M100
  local file (557 lines) + worker decoder, choices schemas and Windows
  verify support; reported verification in the [implementation
  log](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-12---02d-unit-1a-built-locally-m100-local-file-not-applied);
  M100 NOT APPLIED, dev unchanged.
  **02d Unit 1b built locally 2026-11-13** (`f10e431`, not pushed): M101
  local file (57 lines) + new Search-while-fresh suite (19 tests); reported
  verification in the [implementation
  log](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-13---02d-unit-1b-built-locally-m101-local-file-not-applied);
  M101 NOT APPLIED, dev unchanged.
- Exact next authorized action: **none yet — each pending item needs its
  own Owner approval**: Unit 2 app (saved list in the edition sheet,
  `queryLanguage`, error wording); applying M100+M101 to dev (rollout order
  in SDD §8 Unit 3: Owner API + worker + app build with the widened parser
  deployed before M100/M101 apply); Unit 3 live check; the
  pre-existing-failures fix unit (row 24); the stuck-card unit
  (row 11); pushing local commits. **1a and 1b must be released together.**
- Other gated actions, each needing its own Owner approval: the pilot Open
  Library switch (8c operator scripts 01-05 with placeholders; dev is
  already switched); 02d prefill.

## Mutation authority now

- **None standing.** Every push, deployment, migration apply, Storage
  write, schema change and Render change needs its own Owner approval.
- Dev project data may be freely changed in live tests (Owner). Local
  commits are allowed after the diff is read. Do not run `db push`
  (frozen).
- This session (2026-11-13): recorded the Unit 1b build (`f10e431`, local,
  not pushed) in ACTIVE.md, the phase-9 TRACKER, the implementation log and
  the migration ledger; ran the continuity and migration-set validators.
  Markdown docs only. No database reads or writes, no migration applied, no
  Storage, deployment or push.
- Earlier (2026-11-10 to 11-12): recorded the Unit 1a build (`7600805`,
  local, not pushed); SDD pass 3, `verify-phase9.js` /
  `phase9-sql-facts.js` tooling, DECISIONS OD-2026-11-12-1..3, one
  Owner-approved branch push; database read-only SELECTs only
  (row 11 check, `cron.job`).
- Past dated approvals (2026-11-04 to 2026-11-09) are preserved in
  [the archive](history/ACTIVE-history-to-2026-11-09.md) and trackers 40/41;
  they grant nothing now.

## Last recorded live state

Recorded development-project results, not a fresh operational readback.

- Project: **`ahntbtktjjmvfosgkmgn`**.
- Latest applied migration: **M99**, live version **`20261107192440`**
  (applied 2026-11-08). Earlier slice 8 versions: M89 `20261101224556`,
  M90 `20261101224911`, M91 `20261101225107`, M92 `20261101230500` and M93
  `20261101230501` (note-only ledger rows; applied through the dashboard),
  M94 `20261104121322`, M95 `20261104213313`, M96 `20261104213343`, M97
  `20261105161532`, M98 `20261105161642`.
  [Ledger](phase-9-image-inventory/supporting/database-current-vs-target.md).
- Store View lane: live migration `20261108143327`
  `store_view_slice2_page_v3` is applied to dev but not in git.
- External admission gate: open, epoch 8; no `reserved` usage holds
  (2026-11-09 readback).
- Provider: dev is switched to Open Library with a protection policy
  (tracker 41); earlier NULL-policy readbacks are historical.
- Deployed worker: `phase9-metadata-worker` deploy
  `dep-dbob845g1s2s73en12fg` (commit `2584f98`, live 2026-11-08 17:41:31
  UTC). Rollback target: `dep-dblielugekts738gov3g` (`6e0df90`, 8b).
- Latest relevant recorded commit on `main`: `2584f98` (pushed); `main` is
  unchanged. Branch `phase9/02d-prefill` local HEAD `f10e431` (Units 1a+1b,
  not pushed). Nothing pushed on this branch.
  [Push and deploy evidence](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-07-8c-fix-round-m99-worker-admission--rpc-logging-app).

## Open items, blockers and residual risks

One line each; detail lives at the link. Remove a line when it closes.

| # | Item | Owner / detail |
| --- | --- | --- |
| 1 | 02d Units 1a+1b built locally (`7600805`, `f10e431`, not pushed; M100+M101 NOT APPLIED, dev unchanged); SDD rev c; Unit 2/3, M100/M101 apply and pushes each need separate Owner approval; 1a and 1b releasable only together | [02d SDD](phase-9-image-inventory/work-units/post-scan-rework/02d-edition-sheet-prefill-sdd.md) |
| 2 | Pilot Open Library switch | Owner-timed; [tracker 41](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md) |
| 3 | Render free instances failed to start ~2 h on 2026-11-08, no cause found | Watch; [re-test record](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-0809-post-deploy-dev-re-test-explicit-search-books) |
| 4 | Undocumented Render deploy `dep-dbmbe461egvs73btn1dg` (2026-11-05) | Confirm with the Owner |
| 5 | Store View migration `20261108143327` not in git | Store View lane to commit it |
| 6 | Gemini billing (prepay, restore key); the key exposed in chat must be rotated, never recorded | Owner |
| 7 | `wip/state-machines-audit` (`bc5a829`), unreviewed, not Phase 9 | Owner decision |
| 8 | 8c residual risks (pause coverage for NULL-policy/explicit requests, defer-conflict attempt use, one Low M98 test gap, unmapped contactId goes to manual, fair queue unused) | [tracker 41](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#residual-risks) |
| 9 | Fix-round residuals (admission-fake hardening in ~20 older suites, picker/lookup copy) | [tracker 41 fix round](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-07-8c-fix-round-m99-worker-admission--rpc-logging-app) |
| 10 | 8b residual risks (legacy fail path can leave a run row open, breaker refusal terminal, uncertain states go manual, catch-all maps errors to `stale_claim`) | [tracker 40](phase-9-image-inventory/trackers/40-package8b-worker-evidence.md#residual-risks-and-follow-ups) |
| 11 | Final-attempt worker crash: partly closed. The M97 sweep (`phase9_sweep_exhausted_metadata_jobs_v1`) dead-letters the zero-call crash shapes; a crash after a registered/outcome-unknown provider call, a reserved usage or a running run leaves the job in progress forever (code read, 2026-11-12). The dev cron `phase9-worker-wake-dispatcher` that runs the sweep is active live, but M36 created it inactive and no migration enables it (drift). 0 such stuck jobs on dev. The card stays `processing`, so its sheet cannot be opened. | Owner 2026-11-12: separate unit right after 02d; before the pilot |
| 12 | Native fairness AC8-6 not natively proven (gated on OQ8-3); two Low test-evidence notes | [tracker 39](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression) |
| 13 | WHOLE-1: NULL `operation_version` historical automatic job can fail a non-legacy OL v2 route | Later slice: null-safe flag plus drain |
| 14 | Runtime pacing, circuit state, cooldown recheck and one-instance enforcement are not proven by SQL tests | Rollout proof; [tracker 39](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#read-only-operational-evidence) |
| 15 | Owner-open: OQ8-3 operating numbers for the pilot, Q4-2 retry-floor bound, pre-launch inventory and purge of Google-sourced data (LEGACY-LIVE-3) | Owner |
| 16 | 02c interface clarifications pending review (`phase9_provider_configuration_v1()`, resolver Google veto ownership, `P9_EXTERNAL_ADMISSION_PAUSED`) | Not approved |
| 17 | Deferred package 1 TODOs (v2 cover mode, restart recovery, retention/profile proofs, prefill negatives for 02d, OQ8-11); provisional P1/P2 hash fixture | [tracker 02](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-4-automatic-transaction-file-only) |
| 18 | No-retention fan-out proof: design question, not a confirmed requirement | Keep the no-list guard |
| 19 | Local tooling: 3 stale failures in `phase9MetadataFoundation.integration.test.mjs`; `.phase9-dist` must be built before some suites. (The CRLF raw-byte failures are fixed 2026-11-10: migration working copies re-checked out as LF under the existing `.gitattributes` rule, and the M83 expected hash in `marketplacePhase9CacheReuse.test.ts` now equals the committed file. `node scripts/verify-phase9.js` passes.) | Pre-existing, not slice 8 |
| 20 | One scaffolding Jest test failed once under full-suite load (20 ms timing race), passed since | Watch |
| 21 | `.claude/psr-slice6/db-evidence.md` and `.claude/psr-slice7a/preflight-1.md` are absent from this checkout | Tracked summaries only |
| 22 | Slice 7b-2 limits carried (AC7-21(b), provider-facts-only privacy case, rollback and live Google/expiry cases unproven) | [tracker 38 §47](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29) |
| 23 | Low-end Android Unit 6F validation deferred, not PASS | [tracker 24](phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md) |
| 24 | OPEN ITEM, pre-existing (identical at `1a4ef20`, not caused by 1a/1b): 46 database-suite + 17 native provider-replacement failures. Origin: 24 were already recorded on 2026-11-05 (8c-1a/1b full run, 18 in the 8a provider-gate group + 6 others) as "unchanged and untriaged" in [tracker 41 residual risks](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md) but never raised here; the rest most likely came from `4b29935` (8c follow-up, provider contact required; worker SQL fixtures were not given a contact, so runs fall to `manual_metadata_required`), which was verified with Jest only. No full database run was recorded after 2026-11-05 until 2026-11-12, because the verify script's database step did not run on Windows. The 1b idle-machine rerun adds load dependence: the native local-Postgres group and the full Jest run also show statement/5000 ms timeouts that move between runs (17 pre-existing + 7 timeouts in one idle run; 47 failures with 35 timeouts on a busy machine). Needs its own small fix unit | [implementation log](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-13---02d-unit-1b-built-locally-m101-local-file-not-applied) |

Closed or purely historical notes from slice 8 (apply records, review
rounds, the M95 read-model fix, reviewer assignments) are in
[the archive](history/ACTIVE-history-to-2026-11-09.md).

## Ordered reading list

1. Read this file after [AGENTS.md](../../../AGENTS.md).
2. Read [SESSION-START.md](phase-9-image-inventory/SESSION-START.md) for protocol, rules and the update matrix.
3. Read [DOC-13](../DOC-13-implementation-tracker.md) for cross-phase status and global blockers.
4. Use [TRACKER.md](phase-9-image-inventory/TRACKER.md) to locate evidence relevant to the authorized task.
5. Read the [master SDD](phase-9-image-inventory/00-phase-9-master-sdd.md) and only the domain/supporting material routed by SESSION-START.
6. Read the [implementation/verification tracker](phase-9-image-inventory/trackers/02-implementation-and-verification.md) when implementation is authorized.
7. When briefing or building with agents, follow the [agent workflow](AGENT-WORKFLOW.md) (process only, no status).

## Historical records

- [History index and source provenance](history/README.md).
- [ACTIVE, slice 8 (2026-10-30 to 2026-11-09)](history/ACTIVE-history-to-2026-11-09.md).
- [Former ACTIVE handoffs to 2026-10-29](history/ACTIVE-history-to-2026-10-29.md).
- [Former DOC-13 Phase 9 narrative](history/DOC-13-phase9-history-to-2026-10-29.md).
- [Former session-start handoffs](history/phase9-SESSION-START-history-to-2026-10-29.md).
- [Former master-tracker status copies](history/phase9-TRACKER-history-to-2026-10-29.md).

Read archives only for historical decisions, approvals, discrepancies or evidence;
their dated next actions do not grant current authority.
