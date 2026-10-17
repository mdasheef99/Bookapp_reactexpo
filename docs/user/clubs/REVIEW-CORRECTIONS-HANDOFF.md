# Clubs aggregate-review corrections handoff

## Current scope

Keep the current Manage application layout. The earlier full redesign was
stopped; a later separately requested mobile Stitch draft is unapproved and
does not authorize implementation. Preserve the corrected 119-control matrix,
existing venue confirmation/reconciliation, event locations after unlink and
indirect account-transition query-cache cleanup.

The two P2 navigation findings are corrected locally and independently
rereviewed. Remaining Web confirmations, URL-state consistency and verification
gaps are tracked in the [current Clubs handoff](./TRACKER.md#current-handoff--2026-10-10-documentation-refresh).
All older tests, browser observations and Supabase readbacks below are dated
evidence; none was rerun for the 2026-10-10 documentation refresh.

Last updated: 2026-10-10 (documentation only). Read AGENTS.md, its active startup chain, the Clubs process and
TRACKER.md before acting. Current code/live readback outrank chat history.

## Current checkpoint

Workspace C:\Users\LEGION\Desktop\Bookconnect4_clubs_v2, branch feat/clubs-v2,
Pre-review HEAD was 7e561a15bca7ba0d64d0ea1b362393429b9e7a7f. User subsequently
authorized local checkpoints: navigation 4e1aa35 and primary corrections with
applied migration evidence 542b90f. Remaining process/review/continuity documents
are checkpointed separately; inspect current Git status/log.
Current local HEAD verified for this refresh:
`07998254726f3d31a6dfb561657744562818fc88`. At refresh start there were 38
modified tracked paths and four untracked entries, nothing staged. Cached
`origin/main` is `2f2f383b14b5818b62682ae5bdd7fa295550ba5b` (five ahead, zero
behind); cached `origin/feat/clubs-v2` is four commits behind this HEAD. The
inspection records a 2026-10-10 main fetch; no new fetch was run in this refresh.
Refresh main again before publication. No commit or push occurred in this pass.
Preserve the unrelated untracked Home screenshot. AGENTS.md's process link and
PAGE-REFINEMENT-PROCESS.md belong together; the tracker has mixed historical edits.

## Corrections and verification

Owner/nonarchive primary-action gating, lost-response reconciliation, external
focused-row removal recovery, misleading no-primary feedback and SQL disabled-RLS
preflight are corrected. Primary selection is optional. Independent GPT-6 Luna
max reviews and narrow rereviews confirmed these by inspection. Two exact-query
readback tests close its mock-fidelity concern. Reviewers did not rerun tests.

Recent evidence: Manage/service 137/137, navigation 107/107, TypeScript, web export,
continuity and diff hygiene pass. Exact migration artifact passes 61/61 on
PostgreSQL 17.6 with verified owned-process/port/tempdir teardown. Desktop and
390x844 previously verified removal dialog, Cancel/Escape focus, Add/back and no
horizontal overflow. No fresh browser check of the final recovery wording or
post-migration primary-selection submission is claimed. Native/connected identity
switch and response-loss proof remain unverified; spoken screen-reader excluded.

## Applied authorization correction

User explicitly approved creation and MCP application. First application was
cancelled and readback confirmed unchanged policies/no ledger row; renewed
approval preceded successful application. Project identity and exact RLS/policy
preflight passed again, name collision zero. Both Clubs and sibling Library
trackers checked; no active Library DDL recorded.

Applied once: 20261008091939 clubs_primary_venue_write_authorization.
Local file: supabase/migrations/20261008091939_clubs_primary_venue_write_authorization.sql.
CLI generated 20261008090403 initially; filename aligned to live MCP version.
SHA256 73FC0C028256B30710E6A11CD1E5E25376C975C0D4408C4DE1C10B964A3A47BD.
Earlier 20261007144356 migration remains byte-for-byte unchanged. Do not reapply.
Five expected policies and RLS read back; UPDATE/primary INSERT eligibility
checks now enforced; ordinary Add/Remove/reads preserved. Functions/ACLs, grants,
indexes, trigger count and venue-link/event-location digests unchanged. Ledger169.
No business DML, Storage mutation or runtime deployment. Full evidence is in
PRIMARY-VENUE-MIGRATION-REVIEW.md and deployment migration reconciliation ledger.

Eligible direct writes still do not participate in the RPC advisory lock. Existing
TRUNCATE grants remain a separate audit; exposed client exploitability unverified.
Malformed wrong-club hook data can display a badge while the handler rejects
success; defensive row filtering is optional residual work. Project-wide security
advisor notices remain, including the unchanged eligibility helper's definer
execute notice. No whole-project security clearance is claimed.

Phase 9 stays Unit 6H, M62 runtime rollout and connected proof pending. Its stale
DOC-13 row was reconciled to recorded current status, not freshly live-read back.
Normal db push and historical migration repair remain frozen. No Phase 9 rollout
authority is granted by this Clubs work.

## Exact next action / new-session prompt

Read the contract/startup chain, Clubs tracker, this handoff and migration review.
Inspect actual Git status/log/diffs and the applied migration ledger/readback.
Active work unit: documentation/continuity refresh; the application layout is
retained. Exact next action after closeout: user selects a bounded Web
confirmation proposal or another named verification scope from the current
Clubs handoff. No application fix is approved by this documentation request.
The aggregate review records resolved P2 findings and historical passing checks;
do not describe them as newly run.

If publication is later requested, first fetch `origin/main`, review the whole
exact candidate and record relevant verification. The current corrections are
uncommitted/unpushed; staging, commit and push require explicit authorization.
Preserve mixed edits and the unrelated screenshot. No migration reapplication,
permission change, business mutation or Phase 9 rollout is authorized. For a
requested independent publication review, use GPT-6 Luna max reasoning.
