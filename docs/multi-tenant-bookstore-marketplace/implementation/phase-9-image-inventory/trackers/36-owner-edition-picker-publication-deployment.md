# Owner edition-picker publication and development backend rollout

## 2026-10-10 - Owner-authorized feature publication and development backend rollout

Phase 9 / Unit 6G remains active; Tasks 1-8 retain their recorded local approval and verification boundaries. The Owner explicitly authorized committing this edition-picker work, a GPT-6 Luna review at max before pushing, bounded corrections of confirmed findings followed by correction review, publication to GitHub main after approval, and compatible development backend rollout.

The separate Desktop Unit 6I checkout remains outside this publication. All nine baseline commits are already in main at 6e8848e82b47538f67962f0e34238d0017707711. The feature must integrate that current main without dropping its later work. M65-M71 source bytes remain immutable; their recorded shared application is not permission to reapply migrations.

Current work unit: local publication preflight and pre-push review. Exact next action: commit the feature snapshot, integrate current main, then perform the requested read-only subagent review and verification before publication. Runtime rollout follows approval/publication; new provider-result retention remains disabled until independently verified permission is available. No feature publication, deployment, or new shared database mutation is claimed at this checkpoint.

See the publication/deployment evidence below for fresh checks, review findings, corrections, exact commits and service readback. Earlier dated handoffs retain historical provenance.

## Scope and authority

Authority is the Owner's explicit 2026-10-10 request. Product behavior remains picker SDD sections 3-11 and 13.2, Master MAS-02/03/05/07/15/17/18, and the existing Unit 6G/7A contracts. This record concerns publication and operational verification, not new product requirements.

Starting feature root: C:/Users/user/.codex/worktrees/edition-picker-research/Bookconnect. Branch codex/edition-picker; HEAD ee3a8c79429ca401d468861f2861721082ba955e. Starting dirty scope: 75 modified and 87 untracked files, zero staged (162 paths). Starting Desktop root is codex/unit6i-owner-review-saved-books at the same HEAD; its 229 expanded dirty paths are separately hash-snapshotted and must remain unchanged.

Read-only preflight verified Supabase Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY. Existing Render phase9-metadata-worker is srv-d9sqfdvqj5pc73dc66fg, repository Bookapp_reactexpo, branch main, Dockerfile workers/phase9-metadata-worker/Dockerfile, one instance and automatic deployment off. Shared function/registry/migration readback will be refreshed before deployment.

## Pre-commit checks

Metadata-worker build and structural integration: 14/14 PASS, normal exit 0. Phase 9 continuity and whitespace checks PASS, normal exit 0; document-size and LF/CRLF advisories remain nonblocking. Whole client TypeScript (--noEmit --allowImportingTsExtensions) PASS, normal exit 0. No new Jest/native race/provider/browser proof is claimed here. Full merged-tree verification is required before main publication.

## Ordered remaining work

1. Commit the exact feature scope locally; integrate current main and preserve both histories.
2. GPT-6 Luna at max performs an independent read-only pre-push review. Confirm findings from source and regressions; apply only bounded justified corrections; have the same requested model review corrections.
3. Run full merged-tree Jest and required SQL/build/TypeScript/continuity gates; publish the approved branch/main without force.
4. Deploy the compatible existing Supabase Edge function and Render metadata worker from the reviewed source. Verify code identity, authentication and non-mutating health/read paths.
5. Exercise the existing development UI and operational paths within the provider-permission gate. Unknown provider retention permission remains fail-closed; no registry flag or cache header substitutes for it.

## Evidence and closeout

Review, correction, publication and backend outcomes are appended here when actually observed. Current checkpoint is not full operational acceptance. No Supabase migration, Storage/business-data mutation, deployment or provider call occurred in this preflight; registry/retention flags remain unchanged.

## 2026-10-10 - Merged verification and Owner deployment hold

Phase 9 / Unit 6G remains active. Feature snapshot f2e8a4886e71cd12670582f919f9e418bf1db190 and merge 4fdcaf8b2642a1a6311c3713e332277bd5257d96 are committed locally; current main 6e8848e82b47538f67962f0e34238d0017707711 is an ancestor. No edition-picker push is claimed. The Owner now explicitly requires stopping before Render deployment and reporting verification and free-plan constraints. This supersedes the earlier immediate Render rollout step. No deployment, plan change, provider permission or shared migration application is authorized by this status entry.

The full merged Jest run found three stale test-integration boundaries and two unrelated club timeouts. Isolated unchanged rerun: 67 PASS / 15 FAIL; both club suites passed. The bounded correction changes three test files only: progress mocks its new edition-read hook, the architecture guard recognizes two extracted controlled Add/Remove modules, and the WU1 validator assertion follows the reached migration helper. The seven-suite correction gate including real compact/full picker mounts passes 97/97; whole TypeScript and metadata-worker build/14 structural checks pass. The requested GPT-6 Luna/max review and final full merged Jest run remain pending. A possible stale explicit-job invalidation issue is under investigation, not yet an accepted finding.

Desktop preservation audit: all 229 snapshotted source files and expanded status entries match; its branch/HEAD remain unchanged. The feature now has its own ordinary node_modules directory. The former junction was removed without deleting its target; ignored Desktop dependencies were restored from its unchanged lockfile. No Desktop source/package/lock/migration edit is included.

Exact next authorized action: finish the independent pre-push review and fresh merged verification, confirm and narrowly correct any actionable finding, then have the requested reviewer inspect corrections before publication. Render deployment is held for Owner review. M65–M71 remain applied and immutable; provider-result retention remains fail-closed.


## Verified free-plan readback and limits, 2026-10-10

Existing metadata service srv-d9sqfdvqj5pc73dc66fg is a free Render web service, one instance, main branch, autoDeploy off. The browser-open srv-d9jbmgf41pts73cecfl0 is phase9-media-sanitation, a different existing free service; it is not the metadata deployment target. Browser read-only billing view: Hobby workspace, no payment card, 5.05/750 free hours, 0/500 included pipeline minutes, 0 MB/5 GB bandwidth, four services, $0 accrued/projected for October. These values are observed usage, not a reservation or guarantee.

[Render official free limits](https://render.com/docs/free): idle spin-down after 15 minutes without inbound traffic, about one minute to spin up, 750 hours shared per workspace/calendar month, ephemeral filesystem, one instance, no free shell/one-off jobs/persistent disk. No new keep-alive, scale-up, paid service or plan change is introduced. Cold-start, expiry/reclaim and bounded dispatch must be verified before operational acceptance.

[Supabase official runtime limits](https://supabase.com/docs/guides/functions/limits): 256 MB memory, Free 150-second worker lifetime, 2-second CPU budget per request excluding async I/O, 150-second request idle timeout, 100 functions on Free, 5 MB server-bundled or 20 MB locally bundled function size. [Invocation quota](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations): Free 500,000 monthly organization invocations; non-OPTIONS calls count regardless of status. Owner API/dispatch are Edge Functions; three active metadata jobs and fifteen per invocation run on Render and are application limits.

Supabase browser confirmed organization quasarsq / xxbqwluvomrrxeohydis Free plan, one project Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, current-billing-cycle cards: egress 0.06/5 GB; database 286/500 MB; one/50,000 MAU; file storage 0.02/1 GB; log ingestion 0.24/1 GB; log queries 0.70/100 GB. Fresh organization usage view (billing period 30 September–31 October 2026): 14,628/500,000 Edge invocations (3%), zero overage; dashboard reports no Free quota exceeded. Values may lag by one hour. No quota, billing, secret or runtime configuration was changed.

## 2026-10-10 - Final merged verification and independent queue finding

Final full merged Jest PASS, exit 0: 337 suites, 3,293 passed tests, four existing pending tests, zero failures. Whole TypeScript and metadata-worker build/14 structural checks PASS; continuity and whitespace checks PASS. The reviewer independently approves the three test-only integration corrections.

GPT-6 Luna/max aggregate verdict: CHANGES_REQUIRED for one P2 lifecycle defect. A controlled identity edit clears request_id and increments request_generation, but the old explicit job remains open. Its real claims and generic failure RPC fail P9_STATE_CONFLICT; after five claims it remains in_progress without completed/dead-letter evidence. The author independently reproduced all five failures in a disposable M65–M71 stack. This is bounded to five claims, with no perpetual wakeups, no stale-result acceptance, and no blockage of a new lookup. Fresh shared read-only audit shows only 165 resolved and two dead-letter automatic jobs; no explicit edition job is present.

Authority: picker §§4.3/5/9, Master §8/MAS-17 and Pipeline §10 require durable fencing and bounded terminal/retry outcomes. Proposed bounded correction uses a forward M72 and existing service-only failure RPC: valid claim plus a demonstrably superseded per-card request gives a terminal resolved_noop with safe evidence; mismatched/reclaimed claims and current requests reject. Worker stale-result handling requests only this terminal cleanup, without converting a current deterministic failure into a retry. Existing automatic failure behavior, current selection/selling values, physical-call lineage, billing evidence, and M65–M71 bytes remain unchanged. No trigger acquires a new job lock from an Owner candidate transaction.

The new disposable regression suite is phase9EditionOptionsSuperseded.integration.test.mjs. It covers real claim/identity edit/replay, final-attempt in-flight fencing, a newer request, mismatched claims, and unchanged current/selling-only requests. M72 is PROPOSED / NOT_CREATED / NOT_APPLIED pending the repository's separate local-file authorization; shared application and Render deployment are not authorized by this proposal. Exact next action: obtain M72 local creation approval, prove semantic RED/GREEN for the bounded correction, then GPT-6 Luna/max correction review before any feature push. Render remains held. No shared DB, Storage, provider or deployment change occurred.

Semantic RED command: node --test supabase/tests/phase9/phase9EditionOptionsSuperseded.integration.test.mjs, normal exit 1: four expected P9_STATE_CONFLICT failures and one existing current/selling-only request protection PASS. No missing file/function/import failure is used as RED. Log: %TEMP%/bookconnect-edition-superseded-red-20261010.log. The forward file does not exist.
