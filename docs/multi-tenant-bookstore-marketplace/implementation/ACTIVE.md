## 2026-10-17 - Edition-sheet title/author fix saves, then searches (client only)

Phase 9 / Unit 6G remains active. Owner-approved picker §3/EP-D07 amendment: the batch card's edition sheet always offers "Wrong title or author? Fix it". The Owner corrects the title/authors and "Save and search again" first saves the card's full review through the existing update_candidate_review action (the same review Add would save, metadata choice manual, all card edits included), then requests one explicit search for the saved identity. When an edition is chosen the sheet warns that saving clears it; the existing phase9_edition_identity_change trigger performs the reset. This closes the gap where card-only identity edits stayed an unsaved draft, so a search still used the scanned text (for example "Nasrim Nicholas Taleb"). The full-correction screen is unchanged. Also recorded: the metadata-sheet loading flash fix (tracker 37 §61) and an Owner-authorized live check confirming that Search Books and Select edition work against the live database (tracker 37 §62).

No migration and no Supabase schema, Render, Owner API or client deployment. Live data writes, Owner-authorized: one edition search and one edition selection on the False Dawn card only. M77 remains PROPOSED / NOT_CREATED / NOT_APPLIED.

Active work unit: owner_edition_identity_fix_save_then_search. Exact next authorized action: Owner review of the identity fix, then the Owner's choice between investigating the stuck Confessions edition-search job (tracker 37 §62) and the Render metadata-worker deployment. Tracker 37 §§62-63 own the evidence.

## 2026-10-16 - Review corrections committed; worker stricter than live M76; Render held

Phase 9 / Unit 6G remains active. Three independent read-only Haiku reviews of the M76 work were verified in this session. The Owner authorized fixing the worker rules, Open Library ordering, app prompt and SDD wording, with no new migration and no deployment. Worker: accent folding applies only to marks on Latin letters a-z; the single-word surname rule excludes joined initials and comma-form provider names; Open Library author lookups serve known-language identities before unknown-language ones. App: the "Edit title/author" prompt no longer appears when every result is only unavailable or over an Owner-confirmed choice, and its explanation is announced politely. DOC-3 §5.2.1 and picker §4.1/EP-D07/§3/§13.2 wording updated.

Live M76 (20261016153615) is unchanged and is now a deliberate superset of the worker for three edges, so every worker-eligible row still passes completion. A parity migration (M77) is PROPOSED / NOT_CREATED / NOT_APPLIED. No Supabase, Render, Owner API or client deployment occurred.

Active work unit: owner_edition_explicit_matching_review_corrections. Exact next authorized action: Owner review of the corrected branch, then separate decisions on M77 creation and the Render metadata-worker deployment. Tracker 37 §59 owns the findings, dispositions and verification.

## 2026-10-16 - Explicit edition matching committed; M76 applied and verified; Render held

Phase 9 / Unit 6G remains active. The Owner authorized the full plan through migration application and explicitly stopped before the Render metadata-worker deployment and app publication. Approved scope: DOC-3 §5.2.1 / picker §4.1 amendment for explicit Owner edition options only (Latin accent folding, en/en "&" = "and", author full stops and joined initials, single-word surname only with identical title keys, unknown result language after a complete known-language text match); one shared worker helper; forward M76 combining that predicate with the retained opt-in rejection-reason projection; client "Edit title/author" prompt when a fresh set has nothing selectable, a disabled-sheet reason, and the "Find or change edition" trigger label. The earlier 2026-10-13 title, scroll and four-correction local work is included.

Verification: shared 22-case table; Jest 3,491 passed / 0 failed (4 pre-existing skips); new M76 SQL suite 32/32 with M76 and 7 expected RED cases on M65-M74 alone; existing edition/Open Library SQL suites 288/288; structural worker 14/14; root TypeScript and metadata-worker build PASS. Live read-only preflight (ahntbtktjjmvfosgkmgn, PostgreSQL 17.6): latest migration M74 20261012140853; replaced bodies match local M68/M70 md5; new helper names absent; accent folding verified; 0 fresh option sets; one open edition job (the known exhausted closed-scan job).

M76 is APPLIED_VERIFIED as live version 20261016153615 (commit cc5e944, file SHA-256 90a6dfca30064866e8ab9ceb46d0491cdda7460bd8d74abb0d81ace62d53052f); all six function bodies match the committed file, phase9_edition_identity_compatible is unchanged, owner/ACL/volatility/search_path read back as expected. No data, job, selection, inventory or provider mutation.

Active work unit: owner_edition_explicit_matching_m76_applied. Exact next authorized action: Owner decision on the Render metadata-worker deployment of codex/edition-picker (M76 is already live, so the worker may follow). Owner API redeployment for reasons, client publication, M75 and the live Search Books acceptance remain held. Tracker 37 §57 owns scope, evidence and ledger.

## 2026-10-13 - Four picker corrections locally complete; SQL proposals retained

Phase 9 / Unit 6G remains active. All four approved corrections are locally implemented and independently APPROVED: selectable-result discovery/counts, error-specific selection recovery, compatible enum-only disabled reasons, and genuinely supplied edition/format display. Earlier title/scroll patches are preserved. Local verification: 491 Jest tests in 19 suites, 77 disposable SQL cases, root TypeScript and worker compilation PASS; fresh web export and actual read-only browser presentation/scroll proof PASS. This is bounded local completion, not shared release acceptance.

Active work unit: owner_edition_picker_four_corrections_local_complete_sql_proposals_retained. Exact next authorized action: Owner review of the local picker at localhost:8083 and the retained proposals. Detailed reasons still require compatible API/SQL publication; the actual browser verifies legacy fallback. Title and diagnostic SQL remain external PROPOSED / NOT_CREATED / NOT_APPLIED; title migration creation was declined. Current-scan refresh, staging/commit/push, deployment and shared writes remain held. M65-M74 are unchanged; M75 remains deferred. Tracker37 §34 owns exact scope/proof/risks; earlier dated checkpoints are historical.

## 2026-10-13 - Four picker feedback corrections locally authorized

Phase 9 / Unit 6G remains active. Prior title/scroll corrections remain local; the SQL title proposal stays retained and uncreated/unapplied. The Owner explicitly authorized plan-first implementation and clarified all four corrections: selectable-result discovery, selection-error recovery, disabled-choice reasons and supplied edition/format display.

Active work unit: owner_edition_picker_four_corrections_local_authorized. Exact next authorized action: execute the reviewed client-corrections plan red-first, verify current code/API/SQL proposal compatibility and report local proof. Diagnostic SQL remains an external proposal; no migration file, shared mutation, data refresh, staging/commit/push or deployment is authorized. Tracker37 §33 owns context, source boundaries and evidence; all earlier checkpoints are historical.

## 2026-10-13 - Bounded title correction local; SQL proposal retained

Phase 9 / Unit 6G remains active. The Owner approved the reduced explicit-selection scope and asked to collect related changes before another worker release. Local worker code now accepts an exact title or one leading English The difference, with the existing author/language/identifier and own-record guards. Extra rejection messages, cover fallbacks and new OCR functionality are deferred. The earlier local scroll correction is preserved.

Verification: 8 focused/related Jest suites / 199 tests PASS; 19 SQL proposal cases in a disposable full-M74 database PASS; the existing current M74 SQL/compiled-worker gate passed 32 cases; metadata-worker build and root TypeScript PASS. These are local proofs, not new shared/browser acceptance. No formal migration file or shared mutation was made. M75 remains NOT_CREATED / NOT_APPLIED and deferred.

Fresh service/project reads confirm Render metadata worker LIVE at 76348f3, autoDeploy=no, one Free instance; Owner API ACTIVE v16/JWT enabled; exact Supabase project ahntbtktjjmvfosgkmgn. Runtime dependency inspection finds none of the three changed matching files in the Owner API. Release needs the worker and a forward SQL predicate correction; no Owner API deployment is required. A separately approved post-worker refresh is scoped to the current Owner scan, with one currently affected temporary list. Chosen snapshots/selling/inventory/jobs/accounting are preserved; no eligibility relabel or job reset is proposed.

Active work unit: bounded_title_worker_local_sql_proposal_retained. Exact next authorized action: retain the tested SQL proposal and unreleased local worker patch for a later explicit Owner direction; no further migration or rollout work is authorized. The Owner declined local forward-migration and repository SQL regression creation by choosing "Keep the SQL as a proposal". Application, the scoped data operation, Git publication and deployment remain held. See tracker 37 §§30-31 for proof, limits and the retained proposal.

## 2026-10-13 - Extended matching/cover audit; bounded correction proposed

Phase 9 / Unit 6G remains active. The Owner requested a solution and challenged the investigation's completeness. The read-only audit now includes live SQL comparison/URL guards, client/Owner API parsers, all seven automatic snapshots, the original photo, and eleven bounded public API GETs. It confirms the Penguin title-variant rejection and genuine missing own-cover mappings in two sampled records. Matching needs a coordinated worker/SQL correction; no blanket cover-recovery promise is justified.

Proposed next scope: bounded explicit Owner title-variant selection, controlled refresh of affected saved options, clear rejection/discovery UI, and correction of OCR identity through the existing review path. Keep known conflicts blocked and preserve automatic Google behavior, chosen snapshots, selling data, provider order/limits and retention. Existing post-commit Manage Photos handles Owner-supplied imagery when catalogue images are unavailable. Cover URI fallback is optional later work, with multiple validation boundaries; it is not required to unlock the Penguin rows with existing cover IDs.

Exact next authorized action: Owner review of this concrete proposal; implementation/source-spec amendment and any new forward migration/application remain separate decisions. No code/test edit, migration file, shared write, selection/Add, job reset, provider switch, Git publication or deployment occurred. M75 stays deferred. The previous local scroll correction remains uncommitted. [Evidence, proposal and limits](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §29).

## 2026-10-13 - Covers and disabled choices diagnosed read-only

Phase 9 / Unit 6G remains active; the prior two-file scrolling correction stays local and uncommitted. The Owner requested an explanation of missing covers and disabled choices. This read-only investigation is complete: the Black Swan set has ten original positions, one eligible, seven ineligible and two unavailable. Of eight usable records, five have no own-edition cover reference; all three supplied image URLs load. The exact-title guard rejects the Penguin title variants without "The"; unknown language also rejects an otherwise matching row. The first five happen to contain no eligible choice.

This is a data/selection usability limitation under existing picker §§3/4.1/13.14, not an approved rule change. The UI's generic rejection message hides these distinctions. No search, selection, Save, Add, source/test edit, provider flag, database/Storage mutation, migration or deployment occurred. M75 remains deferred and uncreated/unapplied by this session.

Exact next authorized action: Owner review of these findings and direction on whether to amend matching/confirmation, rejection explanations or same-edition cover fallback. No implementation or publication of those changes is inferred. [Exact read-only evidence and limits](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §28). Earlier live Add and local scroll proofs retain their recorded scope.

## 2026-10-13 - Metadata sheet scrolling corrected locally

Current status: `metadata_sheet_scroll_correction_local_verified`. Phase 9 / Unit 6G remains active. The Owner reported that the live scan's metadata sheet could not scroll. A bounded two-file local layout correction restores the existing picker SDD §3 / §10 EP-AC03 interaction; no requirement, acceptance ID or command contract changes.

Before the fix, the 375 × 580 browser sheet clipped a 1600px ScrollView inside a 522px cap; its inner GlassCard content wrapper did not shrink. Ordinary scrolling left scrollTop=0. The main review list scrolled normally after Escape closed the sheet. GlassCard now accepts an optional inner contentStyle, and only CandidateMetadataSheet opts into flexShrink=1 / minHeight=0. Other callers keep their defaults.

Fresh verification: four focused Jest suites / 67 tests PASS; TypeScript no-emit PASS; Expo web export PASS (2690 modules / 69 assets). The rebuilt localhost:8083 preview passed ordinary wheel scrolling: 482px scroll viewport, scrollTop0 -> 580; Show all expanded ten saved positions, and scrolling reached the visible Close metadata button at y508-560. No automatic scrollIntoView was used for this scroll proof. The scan still displays seven detected, six in review, one added.

The earlier live Open Library selection/private Add proof remains valid. This correction is local and uncommitted; the shared runtimes remain at the previously verified source. No Search Books, selection, Save, Add, provider flag, database/Storage/job mutation, migration, staging, commit, push or shared deployment occurred in this check. M75 remains uncreated/unapplied and deferred. Native-device scrolling was not run.

Exact next authorized action: Owner review of the corrected scrolling in the open localhost:8083 scan. Publication of the two-file correction requires a separate instruction. [Cause, source changes and ordinary-scroll evidence](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §27); preceding dated entries retain their historical scope.

## 2026-10-13 - Open Library enabled; fresh-session picker and private Add verified

Current status: `open_library_live_fresh_session_picker_private_add_verified`. Phase 9 / Unit 6G remains active. The Owner's "ok" authorized Open Library activation and one controlled authenticated fresh-session test. The specified testimage.jpeg had been uploaded before, so the app's duplicate guard prompted; the test used Proceed and created independent candidates for this session. The Search Books -> selection -> private Add path passed for one book; six other detected books remain in review. M75 remains PROPOSED / NOT_CREATED / NOT_APPLIED and deferred.

Fresh exact-project preflight matched Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, Render LIVE commit 76348f3 and Owner API ACTIVE v16/JWT enabled. One bounded registry update enabled Open Library at 2026-10-12T22:05:26.434106Z (13 October IST); only enabled/updated_at changed. Google remains enabled. Existing retention, attribution, permission and image-cache flags are preserved; no migration or deployment occurred.

The old scan 93567d47-3874-4576-b3b4-1adb044b552b was closed through the authenticated app at 2026-10-12T22:08:44.023344Z. Live readback: closed/version3, all five candidates retained, all four committed inventory rows present, unchanged candidate states/versions/links. The unfinished card is read-only session history; its exhausted job is still in_progress at 5/5. No job reset or recovery fix was performed.

Exact next authorized action: Owner review of the live proof and direction on the six remaining cards in active session 7a81bdb6-ed34-40cb-b5a9-cff85402cf48; separately decide whether to authorize the proposed M75 exhausted-lookup recovery. The new session remains active, and the existing expired 5/5 job remains untouched. Sources: picker SDD §13.14, DOC-3 §5.2.1, Unit 6G SDD §§14/23 (U6G-AC13/18/20). [Live picker and Add evidence](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §26); earlier headers are historical.
## 2026-10-13 - Owner API v16 verified; exhausted lookup recovery pending

Current status: open_library_owner_api_v16_verified_exhausted_lookup_recovery_pending. Phase 9 / Unit 6G remains active. Render still runs reviewed commit 76348f3; phase9-owner-ingestion is now ACTIVE version 16 with JWT verification enabled. All 35 served runtime files match the reviewed upload; three additional uploaded files were type-only dependencies, as independently checked against the Deno runtime graph.

Fresh API checks: OPTIONS 200, unauthenticated POST 401. The actual authenticated Codex browser loads the scan and reads edition state. The verified frontend export was restarted at localhost:8083, managed session 96852, after the old Metro preview had stopped; the fresh tab uses the tested static bundle and correct project.

The supplied card is blocked by an existing in_progress edition request with attempt_count=max_attempts=5 and an expired lease. Live dispatcher and claim predicates exclude it, while the choices reader reports pending; the UI therefore shows Searching books indefinitely. No job, selection, selling field or provider flag was manually repaired. Open Library stays disabled.

Proposed bounded correction: a new forward M75, leaving M65-M74 unchanged, must expose exhausted expired edition requests as failed and allow an initiating-Owner controlled retry with preserved chosen metadata, selling details and accounting/audit evidence. Exact file is proposed only: 20261013000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql; NOT_CREATED / NOT_APPLIED. Local creation and conditional shared application await the Owner's separate authorization.

Exact next action: obtain that bounded M75 authorization, then reproduce, implement and review the correction before fresh preflight/application and the controlled live edition workflow. No Render or Owner API redeployment is needed for the proposed SQL-only correction. [API deployment and live recovery finding](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 sections 23-24); earlier dated entries are historical.

## 2026-10-12 - Fresh predeployment browser checkpoint; Render held

Phase 9 / Unit 6G remains active and the M74 applied/verified status is unchanged. The requested local browser checkpoint is complete: the exact edition-picker checkout/branch/HEAD were verified, the preview and bundle came from that worktree, and the installed Playwright/Edge harness passed all nine cases (zero failed, zero skipped, exit 0). API responses and persistence in the harness were simulated. One P3 visual finding is recorded in tracker 37 §16; no product source was changed.

The live Codex in-app browser showed the supplied scan route and existing session state. No explicit Search Books, edition-selection, Save, or Add command was sent. No shared Auth, inventory, Storage, provider, migration, or deployment mutation occurred. The preview remains at http://localhost:8083 in managed command session 32257. Exact next action: independent read-only aggregate prepublication review with this browser evidence, then the final Free-plan/configuration preflight. STOP before Render deployment. Detailed evidence and screenshots: trackers/37-owner-edition-picker-open-library-local.md §16.

## 2026-10-12 - M74 applied and verified; Open Library disabled; Render held

Current status: open_library_m74_applied_verified_render_held. Phase 9 / Unit 6G remains active. The Owner explicitly requested completion of M74 preflight/application after the approved bounded correction. That application authority supersedes the earlier local-only gate for M74; publication, provider activation and Render deployment remain held.

Fresh preflight matched the reviewed file and both M73 function bodies/permissions on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; the focused full-M74 SQL/security suite passed 20/20. M74 is APPLIED_VERIFIED as live version 20261012140853. Archived SQL SHA-256 FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 matches the unchanged local file; both installed function bodies match the reviewed definitions.

Only the two private completion/registration functions changed. Their signatures/owners/ACLs/search paths and 17 other checked functions remain intact; provider-call columns/RLS/ACLs/policies, provider flags and observed business/job counts are unchanged. Open Library remains disabled with no unresolved OL attempt. One existing in_progress edition job has an expired lease; it was observed and preserved.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. Compatible client/worker/Owner API rollout, separately authorized provider activation and controlled shared operational acceptance remain pending. STOP before Render deployment. No commit, push, runtime deployment, provider request, Auth/inventory/Storage write or account/configuration change occurred. [Application ledger, exact readback and scope](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§15). Earlier dated checkpoints are historical.

## 2026-10-12 - Author isolation corrected locally; M74 unapplied; Render held

Current status: open_library_author_corrections_local_verified_m74_pending. Phase 9 / Unit 6G remains active. The Owner authorized "Yes, fix both and create local M74". Both aggregate P2 findings were reproduced, corrected and regression-tested; GPT-6 Luna/max approved the bounded correction. This does not replace the aggregate prepublication review.

The adapter validates edition facts before allocating complete own-author sets within the four-author budget. Nonretryable author-content failures leave only dependent rows unavailable; local M74 permits truthful finalized receipts to continue and complete without weakening mandatory-stage, retryable, egress or authority guards. Google ranking/cover and Owner UI behavior are preserved.

M65-M73 remain applied and byte-preserved. M73's archived live SQL matched its reviewed hash in this session's read-only exact-project check; OL remains disabled. M74 is CREATED_LOCAL / NOT_APPLIED. No shared mutation, provider request, browser action, staging, commit, push or deployment occurred in this correction.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. M74 application needs a separate decision and fresh preflight; compatible client/worker/Owner API rollout, provider activation and authenticated operational acceptance remain gates. STOP before Render deployment. [Exact scope, commands, migration ledger and evidence](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§14). Earlier dated checkpoints are historical.

## 2026-10-12 - Browser corrections verified; M73 applied; Render held

Phase 9 / Unit 6G remains active. Status: `open_library_browser_corrected_m73_applied_render_held`. The Owner authorized the bounded corrections and migration application, with an explicit stop before Render deployment.

The Response receiver, bulk-control lifetime and metadata-sheet opacity are corrected. Fresh gates: 25 client suites / 379 tests, eight actual-app browser fixture cases, 25 full-M73 SQL/worker cases, worker build / 14 structural checks and TypeScript PASS. Luna/max approved only the bounded source corrections; no independent test rerun or aggregate publication approval is claimed. No new Save step was introduced.

M73 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as version 20261011224457; archived SQL SHA-256 matches the unchanged reviewed file. Open Library is installed disabled. Existing books/candidates/inventory/provider-call data, provider-call RLS/grants and M65-M72 bytes are preserved. Seven read-only actual-adapter OL GETs returned 200 with minimum start spacing 1005.37 ms; raw bodies and returned metadata were discarded.

Exact next authorized action: report this verified correction/application checkpoint and the remaining rollout prerequisites, then STOP before Render deployment. Compatible client/worker/Owner API publication and rollout, shared provider activation, authenticated shared workflow and operational acceptance remain pending. No Git publication, runtime deployment or provider activation occurred here. [Exact evidence, migration ledger and limits](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§11). Earlier dated checkpoints are historical.

## 2026-10-11 - Native accounting and request spacing verified; browser handoff

Current status: `open_library_native_spacing_locally_verified_browser_pending`. Phase 9 / Unit 6G remains active and Tasks 1-8 retain their earlier bounded approval provenance. M65-M72 remain applied/byte-preserved; M73 remains CREATED_LOCAL / NOT_APPLIED and shared OL activation remains pending.

Native PostgreSQL through M73 passed 28 cases with 18 observed independent-connection lock overlaps and verified disposable teardown. The Owner-authorized scheduler correction holds the shared permit through fresh authority checks until HTTP dispatch; a compiled-factory fixture run spaced all 18 actual fetch invocations at least one second apart across three jobs. The 397-test backend gate passed. These local proofs do not establish deployed provider/browser behavior.

Next authorized action: use the separate predeployment browser inspection prompt in another session, then return its report here for the final Free-plan/configuration preflight. Do not start browser testing in this preparation session. Deployment remains held at the Owner's request; M73 application, shared provider activation, compatible runtime/client rollout, shared security/cleanup/recovery/disablement and publication remain gates. Available-model local correction review does not replace the requested Luna prepublication review, which remains separately pending at its usage limit.

[Detailed scope, evidence and pending gates](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md). Earlier dated checkpoints below are historical.

## 2026-10-11 - Local Open Library edition fallback; rollout gated

Current status: `open_library_fallback_local_review_complete_rollout_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 keep their prior approvals. The Owner authorized explicit-search fallback implementation and "Yes, create local M73". M65-M72 remain applied/byte-preserved; M73 is CREATED_LOCAL / NOT_APPLIED. OL is absent from the shared metadata registry.

Only explicit Owner lookup can use independently permitted Open Library factual editions; automatic Google winner/cache/ranking and representative-cover behavior remain unchanged.

Next authorized action: hand off the verified local correction and detailed independent browser prompt. GPT-6 Luna/max found no remaining bounded blocker and independently passed two focused full-M73 regressions; wider gates remain root evidence. Publication/application/activation/deployment and browser/device verification remain gated; the Owner asked for a separate browser prompt first. [Scope, migration ledger, evidence and gates](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md). Earlier dated entries are historical.

## 2026-10-11 - Provider checks complete; retention decision remains pending

Phase 9 / Unit 6G remains `feature_published_runtimes_deployed_provider_gate_pending`. The Owner explicitly authorized multiple read-only Google Books checks with the existing Render key only in memory and Open Library investigation. This supersedes the earlier pending one-request question. No provider switch, new retention permission, product edit, migration or deployment is inferred from that authorization.

The Owner's latest decision is Google first, Open Library only if required. Six configured-key Google probe invocations produced one title/author HTTP 200 and five HTTP 503 responses across ISBN, title/author and plain-title queries. The inspected failures reported backendFailed / Service temporarily unavailable. Cache-Control, Expires and Age were absent in every observed response. The successful response establishes configured-key access to this endpoint; its body was cancelled. Subsequent in-memory data checks failed before returning usable book content. This does not prove all Render configuration, the worker's network response, any cache lifetime or continued selected-snapshot rights. No key or Google book payload was recorded. These observations warrant a bounded fallback proposal, not an unapproved provider switch.

Independent read-only recheck (2026-10-11): GPT-6 Luna/max found no request-construction defect; the endpoint, search operators, encoding and ten-result parameters match official Google documentation. The six earlier configured-key receipts support intermittent provider-side failures, not a current/global outage. Two fresh root Node HTTP probes without a key returned 429/rateLimitExceeded; these cannot diagnose the configured key or the Owner's project quota. The reviewer attempt failed before HTTP at TLS. Render browser tab control remained unavailable, so no fresh keyed result or successful book-list inspection was obtained. The bounded availability fallback remains reasonable to consider; no provider switch was implemented. Detailed limits and timestamps are recorded in tracker 36.

The Owner's 24-hour retention cap and cleanup after confirmed Add are already approved. The missing production verifier is a separate server implementation/evidence gate, not a missing Owner approval or Google dashboard approval setting. Absence of inspected cache headers alone is not treated as a blanket prohibition on factual metadata use.

Production bootstrap still installs no verifyOptionsRetention callback. Unknown permission therefore denies persistence as policy_denied. Google branding permits ordinary attributed API display; Google API terms §5(e) separately constrain cached/permanent content with stated rights/law exceptions. This audit has not established permission for this approved 24-hour alternatives plus persistent selected-snapshot workflow. More requests or storage_allowed=true cannot create that evidence.

Three read-only Open Library requests returned HTTP 200: one work search, a ten-edition page, and a separate exact-ISBN edition. Its API guidelines encourage caching for human lookup and impose request limits; cover guidance favors direct covers.openlibrary.org image links. Licensing does not assert new database rights and acknowledges possible existing contribution/jurisdiction rights. No blanket CC0 license for every record or cover is claimed. The current picker is Google-specific across SQL, worker, wire links and UI; Open Library remains a proposed scope amendment, not an implemented fallback.

Fresh local verification: two existing provider safeguard suites / 92 tests passed. Source, tests, dependencies and M65-M72 are unchanged. Only twelve existing evidence/handoff documents changed; nothing was staged, committed or pushed in this investigation. No Auth, inventory, database/Storage, configuration, billing or deployment mutation occurred.

Exact next action: present the Google-first findings and obtain separate local migration/implementation authority for the documented Open Library edition fallback if the Owner chooses that correction. Retain Google as the preferred provider; do not change the automatic winner/cache path. Keep the current retention gate closed until the chosen path has acceptable evidence and reviewed compatible code. Browser/device and operational acceptance remain pending.

[Actual provider responses and decision proposal](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Compatible runtimes deployed; provider and operational gates pending

Current status: `feature_published_runtimes_deployed_provider_gate_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 retain their local approval boundaries. The Owner explicitly confirmed the exact two-service deployment after the earlier approval-review rejection. That rejection and earlier deployment holds below are historical; this entry owns the current handoff.

Render `phase9-metadata-worker` is LIVE at `f2d47cb1d015c8b93ded58baff35f125f99ad52c` (deployment `dep-db5b71ajnfac739scpag`). One cached deployment used the existing Free service, one instance, main, and autoDeploy off. GET /health and /ready returned HTTP 200; readiness is process-level evidence, not live provider/database proof. Executable source equals independently approved `47207b7385ee4ae37e01c48b7dba0738abb53389`; their differences are documentation only.

Supabase `phase9-owner-ingestion` is ACTIVE v15 on verified Bookconnect_reactexpo / `ahntbtktjjmvfosgkmgn`, with verify_jwt=true. Deployment followed worker commit/health verification. Prepared source had 38 files; all 35 returned runtime/configuration files match it exactly. Three type-only dependencies are absent from the deployed readback; the emitted runtime graph is complete. CORS OPTIONS passed and an unauthenticated POST was rejected with HTTP 401.

M65-M72 remain applied and byte-preserved; no migration was created or applied in this checkpoint. Read-only preservation counts remain books 45, candidates 173, inventory 21, edition states 0. The only service mutations were the two runtime deployments. Plan, instance count, automatic deployment, secrets, permissions, schedules, Auth, Storage and business data were not edited.

Provider-result retention remains disabled: production has no verified permission callback. Exact next action: investigate the configured Google Books retention permission read-only and establish acceptable evidence before any explicit edition request or result storage. Authenticated Search Books/selection, Save/resume/Add, expiry/cleanup/recovery, browser/device accessibility and controlled operational acceptance remain unverified. Deployment success does not complete those gates. No product tests were repeated for this documentation closeout; the approved source CI remains applicable. [Activation receipt](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Runtime activation blocked by deployment approval review

Phase 9 / Unit 6G remains locally implemented and published; current runtime activation status is feature_published_runtime_activation_approval_blocked. The Owner replied "ok please proceed it then" to the reviewed deployment sequence. Fresh readback confirmed both GitHub refs at f2d47cb1d015c8b93ded58baff35f125f99ad52c; its only differences from independently approved 47207b7 are twelve documents. Executable source and migrations are identical. The earlier successful source CI and independent review remain applicable; no product test was rerun in this checkpoint.

Immediate preflight verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY and M72 version 20261010200655, both expected functions, private service execution=true and public authenticated execution=false. Render target remains phase9-metadata-worker / srv-d9sqfdvqj5pc73dc66fg in workspace tea-d9j67irtqb8s739ritc0, one Free instance, main, autoDeploy off and the existing Dockerfile/health contract. No new migration or data mutation occurred.

One Render trigger_deploy attempt with clearCache=false was REJECTED by automatic approval review; it returned no deployment ID. Its stated reason was that the earlier instruction to stop before deployment requires exact-action confirmation despite the subsequent general proceed reply, and deployment may disrupt the live worker. Do not retry through another interface or bypass this rejection. No Render deployment began and no Owner Edge deployment was attempted. Browser inventory timed out and reset its kernel before any UI access or action.

The corrected Owner API manifest was freshly reverified: all 38 files / 182814 source bytes equal immutable 47207b7, manifest SHA-256 6baf912a93ee21adb2680a06a5ebcf7bc5d1c3d07264fd6cc4234e1fbf565aae, project/function/entrypoint/import-map exact and verify_jwt=true. Render MCP deploys the configured branch head rather than accepting a commit pin, so the proposed actual Render revision is f2d47cb with the same reviewed executable source. Runtime deployment order remains metadata worker, verified commit/health, then Owner API. Provider-result storage remains disabled without verified permission.

Exact next action: obtain the explicit confirmation required by automatic approval review for ONE existing Free Render metadata-worker deployment from main/f2d47cb, preserving cache, plan, instance count, configuration and secrets; after commit/health verification, deploy the verified Owner API to the exact development project with JWT enabled. No API deployment may precede the compatible worker. No provider request, job endpoint, inventory/Auth/Storage/billing/configuration mutation or Git publication occurred in this checkpoint. The authorization block is not a code defect or failed product test. Earlier dated deployment holds and preflight entries retain historical provenance.

[Deployment evidence](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - M72 applied; backend activation preflight

Phase 9 / Unit 6G remains feature_published_runtime_pending. Under the Owner's current step-by-step backend authorization, M72 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as live version 20261010200655. Its archived SQL equals the reviewed file and its original SHA-256 is preserved. M65-M71 source bytes and existing Phase 9 function definitions/ACLs are unchanged.

Rollout order is M72, compatible Render metadata worker, then the Owner Edge API. The old worker's claim RPC has no edition-operation filter and its decoder cannot handle edition_options contexts, so the new API must not enqueue those jobs until the new worker is healthy. No edition jobs exist at this checkpoint. Owner API remains ACTIVE v14; metadata runtime remains bb91428048ca9028c5592cbbc52c982bd6843946. The Owner's explicit stop before Render deployment remains in force.

A fresh ordinary Deno check exposed extensionless imports newly reached by the API. The bounded local correction adds seven .ts suffixes in contracts/metadata.ts and contracts/providerReuse.ts, naming the same existing targets without changing metadata, ranking, cover, authorization or retention behavior. Fresh verification passed Deno check --no-lock, two existing Jest suites / 49 tests, worker build plus 14 structural tests, and whole TypeScript. GPT-6 Luna/max independently APPROVED this bounded correction at 47207b7385ee4ae37e01c48b7dba0738abb53389 and reran the same relevant gates, including emitted CommonJS import checks. The atomic non-force push succeeded and both GitHub main/codex/edition-picker read back at that reviewed source commit. Fresh source CI run 38083807305 completed SUCCESS: full repository test, TypeScript and production web-export steps passed. Fresh CI counts were not independently recounted because log download returned HTTP 403; local 49/49 and structural 14/14 counts are separately verified.

Exact next action: obtain the Owner's final Render decision, then perform one controlled manual deployment of reviewed/published source 47207b7 to the existing Free metadata service; verify its commit and health before deploying the prepared Owner API bundle with verify_jwt=true. The explicit Render hold keeps both runtime deployments unperformed at this checkpoint. Provider-result retention remains disabled without verified permission; registry flags and cache headers are not authorization. No Edge or Render runtime deployment, provider request, inventory/Auth/Storage/configuration/billing change occurred. [Exact application, rollout, artifacts and verification evidence](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records below are historical.

## 2026-10-11 - Edition picker published; development runtime pending

Phase 9 / Unit 6G remains active; current status is feature_published_runtime_pending. GPT-6 Luna/max APPROVED the bounded returned-stale correction and the updated aggregate pre-push feature at de97beda6e4253cdb14369bf29bb6c6ff3429a24. The Owner-authorized atomic non-force push succeeded and remote readback verified both GitHub main and codex/edition-picker at that commit. All seven local edition-picker commits and their earlier main ancestry are included; the separate Desktop Unit 6I work is excluded.

Owner authorized local M72 creation by replying "Yes, create the local M72 correction": 20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql remains CREATED_LOCAL / NOT_APPLIED with its original hash. Independent correction checks passed: 104 SQL tests (eight through M72), six Jest suites / 124 tests, whole TypeScript, worker build/14 structural checks, continuity, syntax and whitespace. Prior CHANGES_REQUIRED findings and their corrections retain their historical provenance. The earlier full merged Jest result of 337 suites / 3,293 tests with four existing pending predates M72. Fresh GitHub validation for reviewed de97bed passed: 337 suites / 3,296 tests, one skipped suite and four skipped tests, TypeScript and production web export. This is fresh CI evidence after M72, distinct from the earlier local full run.

Next checkpoint: report the backend activation preflight for the Owner's decision on shared M72 application and coordinated compatible runtimes. M72 application still requires separate Owner authorization; Render deployment remains on the explicit hold and provider-result retention stays disabled. M65–M71 remain applied/byte-preserved. The Supabase Owner API is still v14 and Render metadata runtime still bb91428. No shared database/Storage/provider/configuration/plan/deployment mutation occurred during Git publication. [Publication, review, migration ledger, warning audit and limits](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records are historical.

## 2026-10-10 - Owner-authorized feature publication and development backend rollout

Phase 9 / Unit 6G remains active; Tasks 1-8 retain their recorded local approval and verification boundaries. The Owner explicitly authorized committing this edition-picker work, a GPT-6 Luna review at max before pushing, bounded corrections of confirmed findings followed by correction review, publication to GitHub main after approval, and compatible development backend rollout.

The separate Desktop Unit 6I checkout remains outside this publication. All nine baseline commits are already in main at 6e8848e82b47538f67962f0e34238d0017707711. The feature must integrate that current main without dropping its later work. M65-M71 source bytes remain immutable; their recorded shared application is not permission to reapply migrations.

Current work unit: local publication preflight and pre-push review. Exact next action: commit the feature snapshot, integrate current main, then perform the requested read-only subagent review and verification before publication. Runtime rollout follows approval/publication; new provider-result retention remains disabled until independently verified permission is available. No feature publication, deployment, or new shared database mutation is claimed at this checkpoint.

See the [publication and deployment record](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md) for fresh checks, review findings, corrections, exact commits and service readback. Earlier dated handoffs retain historical provenance.

## 2026-10-10 - Local UI inspected; backend compatibility blocks edition results

Current status remains edition_picker_m71_applied_runtime_pending. Phase 9 / Unit 6G is active; M65-M71 remain applied and verified on ahntbtktjjmvfosgkmgn. The local scan UI renders from the edition-picker worktree. Change edition opens the metadata sheet, but saved edition choices are unavailable because the deployed phase9-owner-ingestion function is version 14 and lacks the local edition-picker actions. No option rows or Search Books control rendered. [Browser and backend evidence](phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md).

Exact next action: Owner review of the UI result and decision about Git publication and compatible development Edge deployment. Then repeat the edition search, result display, selection, Save/resume, and Add browser checks under existing provider and rollout gates. No publication or deployment occurred during this check.

## 2026-10-10 - M71 applied; local browser inspection next

Current status: edition_picker_m71_applied_runtime_pending.
Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained.
Bounded M71 read-only correction review APPROVED in this chat.
M65-M71 are APPLIED / catalog-verified on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; M71 live version 20261010110835.
Only the private selection delegate changed; wrapper, permissions, other Phase 9 functions and business counts are preserved.
[Preflight, application ledger and verification](phase-9-image-inventory/trackers/02-implementation-and-verification.md).
Codex browser page reading and banner-dismissal clicking now PASS; feature UI/device checks remain unrun.
Next authorized action: inspect the local feature app's compact/full scan UI before Git publication.
Compatible Edge/worker deployment and verified provider retention permission remain pending.
This request applied M71 only. No staging, commit, push, merge, deployment, provider/Storage or business-data mutation.
Earlier dated NOT_APPLIED/review/browser-blocked entries are historical; this entry owns current status.

## 2026-10-10 - Unknown-language selection correction checkpoint

Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained. The Owner
supplied independent UI-correction approval and authorized the bounded backend
unknown-language eligibility correction, local regressions and ONE forward M71.
[Cause, preflight, migration ledger and correction evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md).
M65-M70 remain APPLIED / byte-preserved. M71 is CREATED_LOCAL / NOT_APPLIED.
Active work unit: selection-eligibility correction checkpoint. Exact next action:
read-only correction review after local verification, before separate application.
UI/cover/ranking/retention and selling-field preservation remain unchanged.
Runtime deployment, provider permission, browser/device and rollout gates remain
pending. No live writes, provider/browser action, configuration/deployment or Git
publication occurred. Earlier dated handoffs below retain historical provenance.

## 2026-10-10 - Bounded UI review corrections

Phase 9 / Unit 6G baseline complete; prior Task 8 local approval retained.
The Owner authorized only three bounded UI corrections and mounted regressions:
pending Close/back through reconciliation, current-version detected details,
and a polite empty-result announcement. [Correction evidence](phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md)
records exact scope, RED/GREEN, tests and limits. Cover/ranking and backend contracts
remain unchanged; the unknown-language selection mismatch is a separate backend item.
Active work unit: bounded UI correction review checkpoint. Next authorized action:
independent read-only review of these corrections. Browser/runtime/provider gates
remain pending; no independent correction approval or operational readiness claimed.
No database/Storage/provider/browser/build/server/migration/deployment or Git
publication action occurred. Earlier dated status/evidence below is historical.

# Active Marketplace Phase Router

## 2026-10-09 - Local preview before Git publication

**Status:** `local_web_bundle_verified_browser_runtime_blocked`.
Phase 9 / Unit 6G baseline complete; Task 8 independently APPROVED locally.
M65-M70 remain APPLIED / catalog-verified; no migration was reapplied.
The Owner chose local UI inspection before committing, pushing or deploying.
[Preview/runtime evidence](phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md) records the corrected
worktree-only application bundle (HTTP 200), successful test Auth checks,
and the Codex browser startup failure. No browser interaction PASS is claimed.
Compatible deployed Edge/worker code and provider retention permission remain
pending. Only authorized Auth request/verification calls changed external state;
no inventory, Storage, provider, deployment or Git-publication mutation occurred.

Exact next authorized action: restore Codex browser control and inspect the
local scan UI with the supplied test login before Git publication/deployment.
Earlier dated entries preserve their historical scope and approval provenance.

## 2026-10-09 - Task 8 independent approval and M65-M70 applied

Phase 9 / completed Unit 6G baseline. Task 8's bounded LOCAL checkpoint is
independently APPROVED; all eight tasks have local implementation/verification
evidence. [Review provenance](phase-9-image-inventory/trackers/33-owner-edition-picker-task8-local-verification.md)
preserves earlier approval provenance and the unavailable historical 152-path
audit baseline.

**Status:** `task8_independently_approved_m65_m70_applied_runtime_pending`.
The Owner authorized steps 1-3: approval documentation, live preflight and the
six unchanged migrations. All M65-M70 are now APPLIED / catalog-verified on
Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn. [Application ledger](phase-9-image-inventory/trackers/34-owner-edition-picker-m65-m70-application.md)
records six live versions, exact source/archive hashes, function/ACL/RLS/index/
trigger readback, unchanged business counts, recovery and advisor deltas.

No Edge/worker/client deployment, registry/configuration change, provider call,
browser test, data deletion, staging, commit or push occurred. New alternatives
retention remains disabled/unverified; existing automatic provider flags remain
unchanged. Runtime/provider/browser/operational rollout gates stay pending.

Exact next action: Owner review/authorization for compatible development
Edge/worker/client rollout and provider-gated browser verification (step 4).
Earlier dated entries below retain their historical NOT_APPLIED status and
review provenance; this latest entry owns current application status.

## 2026-10-09 - Task 8 local verification review checkpoint

Phase 9 / completed Unit 6G baseline; Tasks 1-7 locally implemented.
Task 6 and Task 7's bounded corrections retain independent APPROVED provenance.
**Status:** `task8_locally_verified_pending_independent_review`.
**Active work unit:** Task 8 LOCAL verification review checkpoint.
The Owner supplied the previously pending local authorization.
[Task 8 evidence](phase-9-image-inventory/trackers/33-owner-edition-picker-task8-local-verification.md) records 17 native PostgreSQL checks /
11 lock overlaps, exact Task 7 23 suites / 349 tests, provider/worker/contract
13 suites / 365 tests, 187 scoped SQL cases, build / 14 structural cases,
strict types, teardown and the 19-ACTIVE-ID evidence matrix.
Mocked UI requests, fixture SQL and real native locks are labelled separately.

**Exact next authorized action:** independent read-only review of Task 8's
local test, harness and verification-documentation diff. No Task 8 independent
approval or full operational completion is claimed. Remaining browser/device,
configured-provider permission, live migration/runtime, security/cleanup and
lookup/UI disablement/rollback/rollout gates are separately authorized.
M65-M70 remain unchanged / CREATED_LOCAL / NOT_APPLIED to the shared service;
production retention stays disabled. Only disposable local database/cluster
mutations occurred. No shared database/Storage/provider/deployed-worker mutation,
staging, commit, push or deployment occurred. No product requirement changed.
Earlier dated entries below retain their historical scope and review provenance.

## 2026-10-09 - Task 7 correction review approved

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
**Status:** task7_corrections_independently_approved_task8_authorization_pending.
The Owner supplied an independent read-only APPROVED verdict for the bounded
Task 7 corrections: matched-details preserves edition_option/selection reference;
detected-details resets replacement identity confirmations while preserving
selling values and ordinary metadata-only manual switching.

[Independent correction-review evidence](phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md#2026-10-09---task-7-correction-review-approved) records the independently
rerun 23 suites / 349 tests, strict TypeScript, continuity and diff checks.
Save assertions capture outgoing mocked-service requests, not successful server
persistence. Browser/device/provider and independent-connection PostgreSQL
proof remain Task 8 gates.

Exact next action: separate Owner authorization for Task 8 local integrated
acceptance proof and independent-connection PostgreSQL checks. Task 8 is
unstarted. Live migration/runtime/browser/provider enablement and Git
publication remain separately authorized. M65-M70 remain byte-preserved /
NOT_APPLIED; production retention is disabled. This session changes handoff
documentation only; product tests are not rerun. No database/Storage/provider
mutation, staging, commit, push, deployment or application occurred.
Earlier dated entries below retain their historical scope and evidence.

## 2026-10-09 - Task 7 bounded review corrections

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
The independent Task 7 review returned CHANGES_REQUIRED (two P2 findings);
the Owner explicitly authorized these bounded local corrections.
**Status:** task7_corrections_locally_verified_pending_review.
The full-review matched-details control preserves an existing edition_option
choice; detected-details replacement resets title/author confirmations to the
replacement identity, while metadata-only manual switching preserves them.
Existing picker §§6-7 / EP-AC19, Review SDD §5 and Master MAS-18 own the fixes;
no requirement, server authority, schema or acceptance criterion is added.
Fresh recorded Task 7 Jest gate: 23 suites / 349 tests PASS, exit 0.
Exact next authorized action: independent read-only review of the two bounded
corrections and their regression evidence. Correction approval is not claimed.
Task 8 remains unstarted. M65-M70 remain byte-preserved / NOT_APPLIED; production
provider retention stays disabled. No database/Storage/provider mutation,
staging, commit, push, deployment or migration application occurred.
Earlier dated entries below retain their historical evidence.


## 2026-10-09 - Task 7 local UI completion; independent review pending

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
**Status:** `task7_locally_implemented_verified_pending_independent_review`.
**Active work unit:** Task 7 local UI review checkpoint.
The explicit Owner request authorized this implementation in the existing
edition-picker worktree. The real compact card and older/full correction route
now open the existing sheet, preserve current choice/one cover and selling edits,
render original Google Books positions, and use the Task 6 server selection and
existing Save/Add slot. Fresh resume and Add all use the confirmed held choice;
no selling review or server readiness is manufactured by selection/read.

Fresh local code gates: 23 Jest suites / 345 tests PASS, exit 0; TypeScript
`--noEmit --allowImportingTsExtensions` PASS, exit 0. [Exact scope, RED/GREEN,
bounded self-review, continuity/hash closeout and limits](phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md) belong
to Task 7; no independent approval or browser/live/full-feature acceptance is
claimed. Existing DOC-3 §§5.2/6, DOC-4 §§9-11, DOC-8 §5, picker §§3/6-7/13.2,
EP-D02/03/04/07/14 and Unit 6G §§11-14 own the implementation. No new requirement,
server contract, backend/worker behavior or schema is introduced.

**Exact next authorized action:** independent read-only Task 7 review of this
local modified/untracked checkpoint and mounted flow. Task 8 is unstarted.
M65-M70 remain CREATED_LOCAL / NOT_APPLIED and byte-preserved; production provider
retention remains disabled. Database/Storage/provider/browser mutation authority:
none. Nothing was staged, committed, pushed, deployed or applied. Earlier dated
entries below are historical.

## 2026-10-08 - Task 7 explicit local authorization

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
Current status: `task7_authorized_in_progress`. The Owner's explicit Task 7
request supersedes the earlier authorization-pending handoff. Active work unit
and next authorized action: implement metadata-sheet display and interaction
in the existing mounted scan/review flow, under picker SDD §§3/13.2 and
EP-D02/03/04/07/14, with relevant local tests and continuity updates.
M65-M70 checkpoint hashes match; all remain CREATED_LOCAL / NOT_APPLIED.
No backend, worker, server-contract or SQL edits, migration creation/application,
live database/Storage/provider/browser action, deployment or Git publication
are authorized. Task 8 remains pending. Stop after local verification and
bounded self-review, pending independent read-only Task 7 review.
Earlier dated handoffs below are historical.

## 2026-10-08 - Task 6 independent review approved

Phase 9 / completed Unit 6G baseline. Current status:
`task6_independently_approved_task7_authorization_pending`.
The Owner supplied an independent read-only APPROVED review of the final
local Task 6 checkpoint, including M70, strict DTOs, selection replay,
full/compact resume, script preservation and single/bulk Add recovery.

[Independent review evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-independent-review-approved) records the separately
rerun 387 Jest tests, 20 M70 plus 32 historical M69 SQL cases, strict
TypeScript, worker build/14 structural checks, continuity and hash checks.
This handoff session changes documentation only; product tests are not rerun.
M65-M70 remain CREATED_LOCAL / NOT_APPLIED; production retention is disabled.

Exact next action: separate Owner authorization for Task 7, Metadata-sheet
display and interaction. Tasks 7-8 remain pending. This review does not
authorize new implementation, live application, deployment or Git publication.
No database/Storage/provider mutation, staging, commit, push or deployment
occurred. Earlier dated entries below are historical.

## 2026-10-08 - Task 6 confirmation correction local completion

Phase 9 / completed Unit 6G baseline. Current status:
`task6_locally_complete_pending_review`. The Owner authorized completion of the
bounded backend/shared-DTO/client correction and separately authorized local
M70 creation. Task 6's required current-suggestion/no-review resume gap is closed
locally: the server reports confirmedByOwner from valid held choice authority;
full/compact drafts preserve the chosen identity and selling values. Superseded
selection receipts cannot adopt a choice, including when a reread is unavailable.

Fresh gates: 22 Jest suites / 387 tests; 20 full-stack M70 SQL cases plus 32
historical M69 cases; strict TypeScript; worker build and 14 structural cases.
[Correction evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-confirmation-correction-local-completion) records exact scope, provenance and evidence limits.
M65-M69 are unchanged; M65-M70 remain CREATED_LOCAL / NOT_APPLIED.
Production retention remains disabled. No live database/Storage/provider mutation,
staging, commit, push or deployment occurred. Independent approval is not claimed.
Exact next authorized action: review the completed Task 6 correction and local
M70 checkpoint. Tasks 7-8 remain pending separate Owner authorization.
Earlier dated entries below are historical; this entry owns the current handoff.

## 2026-10-08 - Independent Task 6 review and bounded corrections

Phase 9 / completed Unit 6G baseline; status remains
`task6_client_checkpoint_contract_gap`. Independent review confirmed and
locally corrected two P2 client defects: coherent null/different-script resume
and release of the uncertainty guard after authoritative single/bulk Add replay
rejection. Existing DOC-3 §5.2, DOC-4 §11, DOC-8 §5, picker §§6-7 /
EP-AC11/19 and Unit 6G §§11-14 own these corrections; no requirement is added.

[Review and verification evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---independent-task-6-review-and-bounded-client-corrections)
records RED/GREEN and final gate readback. The original checkpoint required
changes; correction acceptance is local only. Overall Task 6 remains INCOMPLETE
because current_suggestion/no-review fresh resume lacks a server confirmation
discriminator. Exact next action: Owner review of the corrected checkpoint and
separate authorization of the bounded server/strict-DTO correction. No migration
creation/edit/application, external mutation, Task 7 UI, Task 8 live/race work
or Git publication occurred. M65-M69 hashes match and remain NOT_APPLIED.
Earlier entries below are historical.


## 2026-10-08 - Task 6 client review checkpoint and confirmation gap

Phase 9 / completed Unit 6G baseline. Current status:
task6_client_checkpoint_contract_gap. Task 6 local client implementation is at
the review checkpoint; **Task 6 is incomplete** because a controlled
current_suggestion saved before the first selling review cannot be distinguished
from an automatic suggestion by the existing read DTO.

The Owner's supplied APPROVED bounded Task 5 correction **self-review** is
accepted handoff evidence; it is not independent approval. Its supplied 32/32
SQL cases, four boundary/security probes and diff check are separate from this
session's client checks. Branch/HEAD and all M65-M69 hashes match that checkpoint.

Authority remains local Task 6 code, tests and documentation only. M65-M69 remain
NOT_APPLIED and byte-preserved. No migration creation/edit/application, live
database/Storage/provider action, environment change, deployment, staging,
commit or push occurred. Tasks 7-8 remain pending separate Owner authorization.

Exact next authorized action: review the Task 6 client diff and the narrow
confirmation-discriminant correction proposal. A backend/strict-DTO correction
requires separate Owner authorization under the current request; do not start
Task 7 or claim full feature acceptance. Earlier checkpoints below are historical.

[Task 6 evidence and limits](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-client-review-checkpoint-and-confirmation-gap).


## 2026-10-08 - Task 6 explicit local authorization

Phase 9 / Unit 6G remains the current phase / completed baseline. Current status:
task6_authorized_in_progress. Active work unit / exact next authorized action:
implement Task 6 client services, versions, selling drafts and shared Save/Add
integration under picker SDD §§3/6-7 and Unit 6G §§11-14; stop at its review
checkpoint. Tasks 7-8 remain pending separate Owner authorization.

The Owner supplied an APPROVED bounded Task 5 correction **self-review** and
accepted it for this handoff; no independent correction approval is claimed.
Supplied verification: 32/32 Task 5 SQL cases, four boundary/security probes and
git diff --check; no actionable findings or changed files. Jest, TypeScript and
worker gates were not rerun by that review. This session verified branch
codex/edition-picker, HEAD ee3a8c79429ca401d468861f2861721082ba955e and M65-M69
against the recorded checkpoint; M69 is
008F9EBB8CDF3288053B10FFCF2A50DB36D96807A0B42787D89339EAE79E0CDE.
The old 23CFDE75 hash is historical. All five remain NOT_APPLIED.

Authority covers local Task 6 code/tests/documentation only. No migration
creation/edit/application, live DB/Storage/provider action, environment change,
deployment, staging, commit or push. Fresh-resume confirmation of a controlled
current_suggestion saved before its first selling review is indistinguishable
in existing DTOs; demonstrate and record that narrow gap without changing
backend contracts. Real connection races remain Task 8.
Earlier checkpoints below are historical.

## 2026-10-08 - Task 5 independent-review correction

- Current phase / completed baseline: Phase 9 / Unit 6G. Current status: task5_correction_locally_verified_pending_review. Active work unit: Task 5 correction-review checkpoint.
- The independent Task 5 review returned CHANGES_REQUIRED (one P2). The Owner authorized the bounded correction. Revised local M69 now projects the valid durable choice before the first review save; missing review still blocks Add. No independent correction approval is claimed.
- Fresh proof: two clean behavioral RED failures; corrected Task 5 32/32 SQL cases and final nearest commit/cover/lifecycle gate 54/54 PASS. New helper security readback passes. Earlier 194 SQL / 406 Jest / TypeScript / worker-build/14 structural evidence belongs to the preceding review, not a fresh correction rerun.
- M69 remains CREATED_LOCAL / NOT_APPLIED; M65-M68 and other historical SQL are byte-preserved. No live DB/Storage/provider action, migration application, environment change, deployment or Git publication. Client/UI and real independent-connection races remain deferred; Tasks 6-8 are unstarted.
- Exact next authorized action: review only the bounded Task 5 correction and its regression evidence. Task 6 and live application require separate authorization. Detailed proof and current hash: [implementation evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-5-independent-review-correction).

Earlier checkpoints below are historical.

## 2026-10-08 - Edition-picker Task 5 local completion

- Current phase / completed baseline: Phase 9 / Unit 6G. Current status: task5_locally_verified_pending_review. Active work unit: Task 5 exact-selection Add and lifecycle cleanup review checkpoint.
- Owner authority: the pasted Task 5 request authorizes Task 5 local backend implementation, tests, documentation and one forward local migration after project/schema/filename preflight. Local M69 is CREATED_LOCAL / NOT_APPLIED. No migration application, deployment or Git publication is authorized.
- Completed: existing versioned Add materializes the saved server selection, preserves selling fields and creates one private row per candidate; effective-choice cover gating, atomic per-card clearing, lost-response replay, readiness/detail/compact projection and bounded cleanup through the existing minute dispatcher.
- Fresh local proof: 194/194 disposable SQL cases (30 new Task 5 + 164 existing compatibility/security cases), seven affected Jest suites / 406 tests, strict affected server/test graph TypeScript, metadata worker build and 14/14 structural cases PASS. Final documentation/diff gate evidence is recorded in the implementation tracker.
- Review provenance: Task 2 corrections retain independent approval; Task 3 retains Owner-accepted self-review; Task 4 retains Owner-requested corrected self-review, with no independent correction approval claimed. Task 5 awaits review. Tasks 6-8 remain unstarted and require separate Owner authorization.
- Database / external state: fresh read-only MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY, live Phase 9 M62 / 20260913162154 and unrelated overall tail clubs_admin_primary_venue / 20261007144356. Picker state/completion are absent live. M65-M68 and all historical SQL bytes are preserved; M65-M69 remain NOT_APPLIED.
- Limitations: SQL sequencing uses disposable PGlite; independent-connection races remain Task 8. Compatible client/UI and controlled enablement remain later tasks. Production still has no independent retention verifier. No live provider/browser/deployed-worker test, database/Storage write, environment change, staging, commit, push or deployment occurred.
- Exact next authorized action: Owner review of the Task 5 diff and recorded local verification evidence. Task 6 implementation needs separate authorization.

Earlier dated checkpoints below are historical.

## 2026-10-08 - Task 4 timestamp correction and self-review

Phase 9 / Unit 6G; status task4_locally_verified_self_review_complete. Owner-requested self-review found a remaining timestamp-validation P2; the Owner then authorized "fix it". M68 now rejects PostgreSQL-only era/ordinal dates and leap-second timestamps on all non-null option rows, while normalized ISO UTC and offset timestamps remain supported.

Fresh local proof: 10 timestamp cases (six rejection regressions, four valid controls); 87 completion/security/worker SQL cases; 264 Jest tests; 14 structural cases; strict graph/bootstrap TypeScript and worker build PASS. SQL proof uses disposable PGlite; real multi-connection races and live retention remain later gates.

Only M68 and its existing correction integration suite changed as production/test files. M65-M67 are byte-preserved; M65-M68 remain NOT_APPLIED. Self-review is complete; independent correction approval is not claimed. Tasks 5-8 remain unstarted. Exact next action: Owner authorization for Task 5, Exact-selection Add and lifecycle cleanup. No live service mutation, migration application, deployment or Git publication.

Earlier checkpoints below are historical.


## 2026-10-08 - Edition-picker Task 4 review corrections

- Current phase / completed baseline: Phase 9 / Unit 6G. Status: task4_locally_verified_pending_review. Active work unit: corrected Task 4 worker/SQL completion checkpoint; Tasks 5-8 remain unstarted.
- Two independent reviews returned CHANGES_REQUIRED, with three unique P2 findings (the language mismatch is shared). All three were reproduced and corrected locally; correction review is still pending. Task 3 remains Owner-accepted self-review, not independently APPROVED; Task 2's correction approval is preserved.
- Corrections: unknown query language permits an otherwise compatible exact validated ISBN; SQL contract rejection reaches the worker as nonretryable schema_invalid after committed-receipt recovery; failure transitions replay from bounded private claim evidence; every non-null option is checked against normalized metadata bounds, versions, timestamp and coherent ISBN identifiers before eligibility.
- M68 adds one nullable private failure_receipt to the existing per-card state. It contains claim/request evidence, hashes and bounded failure arguments, with no metadata, plaintext lease token or authoritative job status. Public signatures, selected metadata and selling authority are unchanged.
- Fresh local proof: 11 Jest suites / 264 tests; 77 completion/security/worker SQL cases (34 existing completion + 7 worker-to-SQL + 36 correction cases); 14 structural SQL cases; 48 existing picker SQL cases; worker build and strict graph/bootstrap TypeScript PASS. Deterministic RED preceded production corrections. No independent-connection race proof is claimed.
- Migration / external authority: the existing authorization covers local Task 4 corrections to M68 and disposable verification. M65-M67 bytes are unchanged; M65-M68 remain NOT_APPLIED. Production still has no retention verifier. No live DB/Storage/provider/browser/deployed-worker mutation, deployment or Git publication occurred.
- Fresh read-only MCP verifies Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY. Latest Phase 9 migration remains M62 / 20260913162154; the overall tail now includes unrelated clubs_admin_primary_venue / 20261007144356. No edition-picker migrations, private state or completion RPC are live.
- Exact next authorized action: independently review the corrected Task 4 diff and regression evidence. Task 5 requires separate Owner authorization after this checkpoint; migration application and rollout remain separately gated.
- Git: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e, exclusive edition-picker-research worktree; 82 changed paths (45 modified / 37 untracked), zero staged. The new path is the legitimate correction integration suite; pre-existing unrelated changes are preserved.

Earlier dated checkpoints describe their historical scope and are superseded for the current handoff.
## 2026-10-07 - Edition-picker Task 4 local completion

- Current phase / completed baseline: Phase 9 / Unit 6G. Current status: task4_locally_verified_pending_review. Task 4 local implementation and required verification are complete; Tasks 5-8 remain unstarted.
- Owner authority: "sure lease proceed" authorized one forward local migration and disposable SQL tests after the reviewed proposal. Task 3 remains Owner-accepted self-review, not independently APPROVED; Task 2's correction approval is preserved.
- Completed: M68 controlled options completion/recovery/failure, purpose-aware egress and physical accounting, private atomic persistence, slim receipts and response-loss recovery. Production installs its typed RPC boundary and still has no retention verifier.
- Fresh proof: 11 scoped Jest suites / 259 tests; strict Task 4 graph and bootstrap types; required metadata build + 14 structural DB cases; 34 completion/security DB cases + 6 worker-to-SQL cases, all PASS.
- Migration / external authority: local M68 is CREATED_LOCAL / NOT_APPLIED; M65-M67 hashes are unchanged / NOT_APPLIED. Supabase MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY, live tail M62 / 20260913162154. No live DB/Storage/provider/browser/deployed-worker action, deployment, staging, commit or push.
- Active work unit / exact next authorized action: review the Task 4 diff and recorded verification at its checkpoint. The requested independent reviewer returned no verdict because its account usage limit was reached; independent approval is pending. Do not begin Task 5 or apply migrations.
- Git: exclusive edition-picker-research worktree, codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e; 81 changed paths (45 modified / 36 untracked), zero staged. Existing unrelated changes are preserved.

Earlier checkpoint entries remain historical. Real independent-connection races, live retention permission, Add/cleanup, client/UI and rollout remain later proof; no full-feature acceptance is claimed.

## 2026-10-07 - Edition-picker Task 4 runtime checkpoint

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Status: task4_runtime_locally_verified_sql_authority_pending. Task 4 is INCOMPLETE: the authorized runtime/tests are verified, but the controlled SQL completion/failure/egress boundary is absent. Tasks 5-8 remain unstarted.
- Owner decision: accepted Task 3 focused self-review and authorized Task 4 without another independent correction review. Task 3 is not independently APPROVED; Task 2's independent correction approval and the historical Task 3 CHANGES_REQUIRED/correction evidence are preserved.
- Active work unit: Task 4 controlled SQL boundary authorization checkpoint.
- Exact next action: Owner review of the concrete Task 4 SQL proposal and separate authorization for one forward local migration file/disposable SQL tests in this worktree; then finish Task 4 only. No migration filename is reserved.
- Completed local scope: v2 automatic/edition_options decoding, explicit winner/cache bypass, Task 3 options invocation, private typed completion/recovery/failure port, result validation, generation/claim/egress fencing, physical accounting, cancellation/retry/replay and fifteen-job/three-active immediate refill. Production installs no completion port or retention verifier and never reports options ready through the legacy automatic path.
- Fresh verification: 9 scoped Jest suites / 237 tests PASS (56 new Task 4 cases); strict Task 4 test/production graph PASS; required structural metadata build + 14 disposable database cases PASS. The existing Node DEP0040 warning remains. Continuity/diff/hashes are recorded in the implementation tracker after final closeout validation.
- SQL/external/Git authority: no migration creation/edit/application, live DB/Storage/provider, browser/deployed worker, deployment, staging, commit or push. M65-M67 remain unchanged / CREATED_LOCAL / NOT_APPLIED.
- Git checkpoint: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e; 73 changed paths (43 modified / 30 untracked), zero staged. Existing unrelated changes are preserved.

Earlier dated entries are historical. Runtime fixtures model the missing SQL port; they do not prove actual durable explicit completion, real races, live retention permission, Add/cleanup, client/UI or rollout.


## 2026-10-07 - Edition-picker Task 4 authorization

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Owner decision: accepts Task 3's focused self-review and authorizes Task 4 without another independent correction review. Task 3 is not independently APPROVED; the historical CHANGES_REQUIRED verdict and local corrections remain recorded.
- Current status: task4_authorized_in_progress; Tasks 1-3 locally implemented; Task 2 correction review independently APPROVED. Tasks 5-8 remain pending.
- Active work unit / next authorized action: Task 4 only, on-demand edition lookup worker execution and controlled completion, under picker SDD §§4.1-4.3/5/9 and the existing execution plan.
- Authority: local Task 4 code/tests/documentation and recorded-fixture/disposable tests only. No migration-file creation/edit, application, live database/Storage mutation, live provider call, deployed worker, browser test, deployment, staging, commit or push.
- Gate found during inspection: M65-M67 contain no controlled options-completion boundary. The public M38 wrapper correctly restores v2 and physical-claim fields over M67; legacy failure/finalization paths still assume automatic processing. Finish independent authorized runtime/test work and present a concrete forward SQL proposal for separate local-file authority. Do not claim durable completion.
- Git: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e; 60 initial changed paths, zero staged. Preserve existing changes. M65-M67 remain CREATED_LOCAL / NOT_APPLIED and unchanged.
- Evidence reuse: the Owner reports unchanged-worktree focused self-review and 136/136 provider/options/automatic tests; prior strict types/build/continuity/diff evidence is historical until rerun here.

Earlier dated entries are historical. Production installs no retention verifier; verified permission and a valid deadline remain mandatory before any retention.

## 2026-10-07 - Edition-picker Task 3 review corrections

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task3_corrections_locally_verified_pending_review. Tasks 1–2 remain locally complete; Task 2's independent correction review remains APPROVED. The supplied Task 3 review is CHANGES_REQUIRED; both P1 findings were confirmed and fixed locally, with independent correction review still pending.
- Active work unit: Task 3 correction-review checkpoint, within the existing provider code/test/documentation scope.
- Completed corrections: safely decoded observed-ISBN conflicts are counted before eligibility filtering; Expires-only freshness applies Date/Age. No new product requirement or later-task implementation.
- Fresh checks: 15 new regression cases reproduced 9 failures and 6 passing controls before production edits. The final four-suite command passed 136/136; strict types and metadata worker build passed.
- Exact next authorized action: independent correction-only review of the Task 3 diff/evidence. Tasks 4–8 remain pending; Task 4 worker execution/completion awaits separate Owner authorization.
- Database authority: no new audit, migration creation/edit/application or database/Storage mutation. M65–M67 remain unchanged, CREATED_LOCAL / NOT_APPLIED.
- Git/external state: codex/edition-picker at ee3a8c7; all work remains uncommitted and unstaged. No live provider/browser request, worker execution, deployment, environment change, commit or push.

Production still installs no retention verifier. Header evidence only bounds independently verified permission; live retention and later integration/rollout proof remain gated. Earlier dated entries are historical.

Detailed evidence: [Task 3 corrections](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-review-corrections).

## 2026-10-07 - Edition-picker Task 3 review checkpoint

Phase 9 remains active; Unit 6G is the completed baseline. Tasks 1–3 are locally complete after the Owner's explicit Task 3 request. Task 2's correction review remains APPROVED; Task 3 has not received independent approval. Read [DOC-13](../DOC-13-implementation-tracker.md), [SESSION-START](phase-9-image-inventory/SESSION-START.md), [TRACKER](phase-9-image-inventory/TRACKER.md), the picker SDD/plan and [Task 3 evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-local-completion).

Next authorized action: review Task 3's local diff/evidence. Task 4 worker execution/completion is the next pending implementation slice and awaits separate Owner authorization. M65–M67 remain local and NOT_APPLIED, with no Task 3 SQL change. All work remains unstaged/uncommitted on codex/edition-picker at ee3a8c7. No external mutation or Git publication occurred. Live provider retention verification, worker/Add/client/UI integration and rollout remain gated. Earlier dated entries are historical.

## 2026-10-07 - Edition-picker Task 2 correction review approved

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: Tasks 1 and 2 locally complete; the supplied independent correction review is APPROVED. Tasks 3–8 remain pending.
- Active work unit: Task 3 authorization checkpoint; Task 3 implementation has not started.
- Review result: all three findings resolved; no new actionable finding or product decision.
- Next action: Owner authorization for Task 3 Google result envelope, safety and eligibility; do not infer implementation authority from the reviewer verdict.
- Database authority: M65–M67 remain CREATED_LOCAL / NOT_APPLIED. This handoff update performs no new database audit or mutation.
- Git/external state: codex/edition-picker at ee3a8c7; all changes remain uncommitted and unstaged. No migration application, deployment, provider/browser request, live DB/Storage write, commit or push.

The reviewer reports 48/48 disposable database cases, six Jest suites / 368 tests and git diff --check PASS. This session records that external evidence without claiming to rerun product tests. Full feature and operational proof remain pending. Earlier dated checkpoints are historical.

Detailed review provenance and limitations: [implementation evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-correction-review-approved).

## 2026-10-07 - Edition-picker Task 2 review corrections

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task2_locally_complete after the authorized review corrections; Task 1 remains complete and Tasks 3–8 remain pending.
- Active work unit: Task 2 review-correction checkpoint.
- Owner authority: “ok then proceed to fix them please,” followed by confirmation of all three findings before fixing.
- Completed: reusable canonical metadata validation, a unique exact text suggestion with confirmation-required evidence, ambiguity rejection, and corrected plan authority/next-action text.
- Exact next authorized action: review the corrected Task 2 diff/evidence; Task 3 Google result envelope remains the next implementation slice after Owner authorization.
- Database authority: M65/M67 revised locally; M66 unchanged; M65–M67 remain CREATED_LOCAL / NOT_APPLIED. Fresh read-only MCP confirms Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn and live M62.
- Git: codex/edition-picker at ee3a8c7; all work uncommitted. No staging, commit, push, deployment, provider/browser request or live DB/Storage mutation.

Detailed review reconciliation and fresh proof are in [the implementation evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections). Earlier checkpoints are historical; they do not supersede this handoff.

## 2026-10-07 - Edition-picker Task 2 local completion

- Current phase: Phase 9, Image-Assisted Inventory.
- Last completed baseline: Unit 6G; edition-picker Tasks 1 and 2 locally complete.
- Current status: task2_locally_complete; six implementation tasks remain.
- Active work unit: Task 2 checkpoint review.
- Owner authority: “Proceed with the next task” authorized Task 2; “ok proceed” approved local M65–M67 creation and disposable tests.
- Completed: strict authenticated gateway, private state and read/search/select commands, ownership/version/expiry guards, independent chosen snapshot, local ISBN ambiguity correction, lookup-scoped history, and explicit-purpose context/revision fencing.
- Exact next authorized action: review Task 2 diff/evidence. Task 3 Google result envelope is the next implementation slice and awaits Owner authorization.
- Database authority: local M65–M67 created/tested only; NOT_APPLIED. Live migration tail remains M62. No live database/Storage writes or deployment.
- Git: codex/edition-picker at ee3a8c7; all changes uncommitted; nothing staged, committed, or pushed. Main Unit 6I and its M63/M64 remain separate.

Fresh verification: 34 disposable-database tests PASS; affected Owner Jest 4 suites / 303 PASS; strict Owner graph type check PASS. Real multi-connection races, live provider/retention, worker completion, exact-selection Add/cleanup, client/UI/browser and rollout proof remain pending. No full-feature acceptance claim. Earlier dated checkpoints below are historical.


## 2026-10-07 - Edition-picker Task 2 gateway/preflight checkpoint

- Current phase: Phase 9, Image-Assisted Inventory.
- Last completed baseline: Unit 6G; edition-picker Task 1 locally complete.
- Current status: task2_partial_gateway_complete; database implementation pending migration-file authority.
- Active work unit: Task 2 per-card state and controlled Owner commands.
- Owner authority: latest “Proceed with the next task” authorizes Task 2 code/tests and read-only preflight. Tasks 3–8 remain unapproved.
- Completed: strict authenticated read/search/select gateway, bounded errors/response identity/source checks, HTTP routing, and exact-project database preflight.
- Next action: obtain the Owner's answer to the pending local M65–M67 creation question; then implement/test Task 2 database state and commands in this same isolated worktree.
- Database/storage mutation, migration application, deployment and Git publication authority: none. Migration-file creation is a separate AGENTS gate; no files created.

Verification: affected Owner Jest 4 suites / 303 tests PASS; strict Owner server graph type check PASS. Gateway RED was 37 failures/1 pass before implementation. Database integration, real PostgreSQL races, provider/browser/live tests NOT_RUN. Task 2 is not complete and no full feature acceptance is claimed. All changes remain uncommitted; nothing staged/committed/pushed/applied/deployed. Earlier dated entries below are historical checkpoints.

## 2026-10-07 - Edition-picker Task 1 contract checkpoint

- Current phase: Phase 9, Image-Assisted Inventory.
- Last completed baseline: Unit 6G; edition-picker Task 1 is locally complete.
- Planning/implementation status: task1_locally_complete; Tasks 2–8 are pending.
- Active work unit: Task 1 contract checkpoint review.
- Owner authority: the 2026-10-07 instruction explicitly authorized this first task; it supersedes the earlier planning-only handoff for this scope.
- Next authorized action: review the Task 1 diff and evidence before authorizing Task 2 (per-card state/preflight).
- Database/migration/deployment/Git-publication authority: none; creation/application of migrations remains separate.

Affected Jest PASS: eight suites / 368 tests. App TypeScript --noEmit PASS; strict Owner-ingestion graph --noEmit PASS. Metadata worker build PASS; final build/continuity closeout recorded below. Initial 111-test run had 20 expected new-contract failures; projection, admission and draft regressions were separately observed RED before fixes. Whole-repository Jest, live provider, database, browser and operational/security scans NOT_RUN.

Scope: Task 1 only: strict server/client read/request/select DTOs, bounded ordered option rows, own-cover/book-link validation, private-to-public metadata projection, synthetic Google/retention examples, edition_option review compatibility and draft ID serialization. Existing selected/manual behavior remains covered. No lookup handler, options storage, migration, database/Storage write, UI, dependency install, provider request, staging/commit/push or deployment.

[Detailed evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md). Final documentation closeout: PASS: final metadata worker build, Phase 9 continuity (87 Markdown files/62 required/195 existing requirement definitions; zero duplicate/missing traceability), git diff --check, and Task 1 closeout (five completed Task 1 steps; seven remaining tasks unchecked; 32 relative links; 34 modified + 8 untracked files = 22 docs/20 TypeScript files; zero staged; all touched source files ≤350 lines; temporary main-checkout writer removed). Earlier entries below are historical planning checkpoints.


## 2026-10-06 - Owner edition picker branch handoff

Latest Owner display clarification EP-D14: each edition option in the metadata sheet shows its own cover image from its safe URL, title, all authors, and publication date; publisher, ISBN, and language are secondary details. Selection saves the coherent chosen metadata independently and follows the usual inventory Add flow, leaving one chosen cover on the scan card. This supersedes earlier text-only option rows. Owner chose relevance order with returned order preserved and Google attribution/book links. Picker §13.2 now defines Search Books wording and bounded unavailable/ineligible rows; EP-D11/13 scope cuts remain in force.

Readiness result: technical corrections and relevance-order display are consolidated; the written SDD awaits Owner approval. Provider retention evidence and migration preflight remain later gates. Documentation verification is recorded in the implementation tracker.

Latest Owner scope reduction: alternatives are acquired/saved only on explicit request (EP-D13); automatic alternatives capture and shared copying are removed. New manual edition-number editing before/after Add is deferred (EP-D11). Nineteen active planned acceptance checks remain; EP-AC17 is reserved. Provider display §13.2 is resolved; written-SDD approval remains pending. No product or migration implementation has started.

This section is the current handoff for codex/edition-picker only, based on
ee3a8c79429ca401d468861f2861721082ba955e. Older handoff paragraphs below are
historical baseline evidence for this branch; the main checkout's separate
Unit 6I work is not included.

- Current phase: Phase 9, Image-Assisted Inventory.
- Planning status: design_ready_pending_owner_approval.
- Last completed milestone: Unit 6G baseline; the SDD is drafted and its two
  independent reviews reconciled; latest Owner scope cuts are consolidated. All revisions are documentation only.
- Active work unit: Owner edition picker implementation-plan drafting.
- Implementation status: not started.
- Next authorized action: Owner review/approval of the finalized SDD and eight-task plan,
  then authorize local implementation starting with Task 1.
- Gates: written-SDD approval; implementation, migration creation/application, provider rollout,
  deployment, and data deletion require separate authority.
- Supabase mutation authority: none. Exact development project readback was
  read-only; no database/Storage writes occurred.
- No staging, commit, push, or deployment occurred.

Read the [edition-picker SDD](./phase-9-image-inventory/work-units/owner-edition-picker-sdd.md), then the normal Phase 9 SESSION-START protocol.

Readiness handoff: current scope/display is consolidated; configured-provider retention evidence and full database preflight remain separate from local recorded-fixture work. No new feature scope was inferred and no product implementation started.

2026-10-07 planning handoff: the Owner requested task decomposition. The draft execution plan contains eight tasks: contracts, controlled per-card state, Google envelope, explicit worker, exact-selection Add/cleanup, client state, metadata-sheet UI, and integrated proof. Plan drafting is authorized; product code, migration files/application, and rollout remain unstarted/unapproved. Next coding task after approval: Task 1. Latest plan-document verification: PASS: eight sequential tasks and all nineteen active acceptance owners; fourteen unique decisions/twenty stable acceptance IDs (EP-AC17 deferred); twelve relative SDD/plan links resolve; Phase 9 continuity PASS (87 Markdown files, 62 required, 195 existing requirement definitions, zero duplicate/missing traceability); git diff --check PASS; scope twenty modified Markdown documents plus untracked SDD/plan, zero staged files. Product/security/browser tests NOT_RUN (documentation only).
## 2026-10-10 - Existing inventory baseline published to GitHub main

The Owner authorized integration of the nine existing commits through `ee3a8c7`
into GitHub `main`. The verified merge `618433fc948e5d86d72d3b49d21079bd536f2d77`
was pushed normally and read back at `refs/heads/main`; its first parent is
`2f2f383b14b5818b62682ae5bdd7fa295550ba5b` and second parent is
`ee3a8c79429ca401d468861f2861721082ba955e`. All nine commit identities and the
newer main history are preserved. This publishes the earlier Unit 6G / Store
View baseline; the edition-picker implementation remains separate and uncommitted.
The Desktop Unit 6I work remains excluded and unchanged.

Merged verification passed 318 Jest suites / 2829 tests, with the existing
one skipped suite / four skipped tests, full no-emit TypeScript, Phase 9
continuity (195 definitions; zero duplicate or missing traces), and whitespace
checks. One stale architecture allowlist was corrected under Unit 6G SDD
sections 8/12/14; no additional production behavior was introduced.
[Exact scope and verification](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-10---existing-inventory-baseline-main-publication).

Phase 9 / Unit 6G remains the active phase/baseline. Existing operational gates
and recorded price-intent / cover-source deviations are retained; this Git
publication is not deployment or live acceptance. No database, Storage,
provider, migration, or manual deployment action occurred. Next action: Owner
decision on committing/publishing the separate edition-picker work.


> **2026-09-28 Git-publication closeout:** Unit 6G code/tests `101e4b6`,
> Store View confirmation `ce2d0c5`, and Phase 9 documentation `9ad1d6e`
> were pushed to `origin/codex/phase9-duplicate-confirmation` and remote HEAD
> was read back as `9ad1d6e481247b4edb8691262cf45500212f59b7`.
> Package files, `.hermes/briefs`, and the line-ending-only test remain local.
> The next action is an Owner decision on the two recorded deviations before
> any deployment or connected proof; no database/Storage authority was added.

> **2026-09-28 Phase 9 / Unit 6G publication handoff:** The Owner authorized
> commit and direct push of the local post-scan and separate Store View work.
> Affected local Jest passed 10 suites/158 tests; TypeScript, Phase 9
> continuity, and `git diff --check` passed. The ₹0 plus `publish`-intent
> validation and missing cover Detected badge remain documented deviations;
> no correction or connected-state claim is implied. The latest recorded
> connected readback is still 2026-09-22. Next action after Git publication:
> Owner decision on those deviations before deployment or connected proof.
> Database, Storage, and deployment mutation remain unauthorized.

> **2026-09-27 Phase 9 / Unit 6G handoff:** The current local focus is owner
> review of the bounded post-scan corrections and this documentation
> reconciliation. Prior implementation reports record A–C in 6 suites/116
> tests and the final buffered-Add guard in 3 targeted suites/77 tests; these
> scopes overlap and are not additive. TypeScript and Phase 9 continuity
> validation were reported passing. The latest recorded connected-session
> readback remains the 2026-09-22 entry in DOC-13 (two private commits, three
> candidates in review); this local work made no connected-state claim. Price
> policy follows DOC-4 §9, Unit 7A §13, and Unit 7B §2; the source badge follows
> DOC-8. The continuity validator and `git diff --check` passed during this
> documentation handoff; TypeScript and Jest were not rerun. Exact next action:
> Owner review of the combined local code/document diff. No database, Storage,
> deployment, staging, commit, or push is authorized by this handoff.

> **Historical connected-proof snapshot (2026-09-15; superseded by the later 2026-09-22 record):** The previously active
> `LIVE-TEST-20260912-REPRO` session was cleaned up through the Owner UI: all 15
> active candidates were removed, the summary confirmed 15 removed and 0
> committed, and the session was closed. The processed image remained because
> accepted candidate lineage still blocks input removal. A fresh session
> `93567d47-3874-4576-b3b4-1adb044b552b` was started with
> `Phase9 proof shelf`; its gallery image registered, uploaded, processed, and
> produced 5 candidates. At that checkpoint the connected review readback showed 5 detected,
> 1 ready after one saved review (`The Birth of Tragedy`, test values ₹0/Good),
> 4 still needing review, and 0 added to inventory. One private scan-image
> object was uploaded by the normal Owner flow; no Storage deletion occurred.
> No migration or manual dispatch mutation was made. At that checkpoint the
> session remained active; its next action was Owner review/correction of the
> remaining four candidates, followed by separately authorized Add actions if
> desired. The later 2026-09-22 record reported two private commits and three
> candidates remaining. Neither snapshot asserts current live state.
> Traceability: Phase 9 Master SDD §6; Extraction/Enrichment SDD §10.

> **Historical pre-session-cleanup runtime rollout / connected-proof checkpoint:** The
> verified development project `Bookconnect_reactexpo`
> (`ahntbtktjjmvfosgkmgn`) had the checked-in `phase9-owner-ingestion`
> bundle active as Edge v14; JWT verification was preserved. The matching
> metadata worker is live on Render deployment `dep-dak2nmjl550s73bqb7jg` at
> reviewed code commit `bb91428048ca9028c5592cbbc52c982bd6843946`, and its
> `/health` and `/ready` endpoints returned 200. The client runtime was run
> locally from the same reviewed code against the verified project. The
> connected Owner UI reached scan preview, but at that checkpoint its active session was the
> existing `LIVE-TEST-20260912-REPRO` session with one processed image and 15
> candidates; the selected gallery image therefore showed `Upload image`
> disabled. No new input registration, duplicate Proceed/Cancel, inventory
> Add, migration, Storage deletion, or dispatch change occurred in this
> attempt. Connected no-cover proof is blocked until an approved clean Owner
> session/store is available or the existing image is explicitly authorized
> for removal. [Render deployment API](https://api-docs.render.com/reference/create-deploy)
> was used only to select the reviewed commit.

> **2026-09-13 representative-cover rollout closeout:** After exact-project
> reverification, M61 SHA-256
> `A2A8F9191E29C9813DEBC4E35EA8170F00538288079FFA2E7014621A4D90D463`
> was applied once to development project `Bookconnect_reactexpo`
> (`ahntbtktjjmvfosgkmgn`) as remote version `20260913111342`. Readback proves
> the private sidecar, JSONB inventory field, RLS, service-only delegate, and
> immutability/copy triggers; `anon`/`authenticated` cannot execute the write
> delegate, and both new-data counts remain zero. Owner Edge v12 is ACTIVE with
> JWT verification, hash
> `ad75a08f3624f543f904cf2bf6833bcca132dfc1727e5868d52022365aacea14`,
> and exact local M61 contract-source readback. The bounded local follow-up now
> decodes Google Books volume evidence, fails closed on unresolved series
> evidence, and adds M62 to project representative-cover provenance through
> standalone Owner detail and review-save responses. M62 was then applied once
> as remote version `20260913162154`. Readback confirms the postgres-owned
> private helper, authenticated-only detail/save entrypoints, M62 delegation,
> and zero sidecar/inventory representative rows. The new response member is
> rollout-tolerant while present values remain strict. Earlier rollout
> verification passed TypeScript, worker build, focused affected Jest 310/310,
> structural 14/14,
> M55 7/7, M52–M62 integration 2/2, migration contract 4/4,
> deployment-runtime validation, and the continuity validator. The current
> bounded local follow-up also passes its focused composition regression (29/29)
> and adds only sanitized M61 sidecar-persistence failure logging with a fixed
> error code plus lookup/attempt IDs; raw exception detail is not logged. It does not
> alter terminalization, selection, retry, public projection, or duplicate
> behavior. The current focused run reproduced the existing VirtualizedList
> `act(...)` warning; the later
> full-run closeout recorded existing React `act(...)`, NetInfo dynamic-import,
> and `DEP0040` warnings, while the independent handle run exited normally. No
> worker/client deployment, connected no-cover proof, dispatch change, or Git
> publication occurred in this step. [Evidence](./phase-9-image-inventory/supporting/unit6h-representative-cover-correction.md).
> Next: deploy the matching tolerant Owner Edge/worker/client runtime under
> explicit rollout authorization, then run the connected no-cover review/Add/
> public-projection proof.

> **2026-09-12 bounded correction closeout:** Exact-project CLI preflight for
> `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) found active
> `phase9-owner-ingestion` v10. Source readback proved v10 carried the older
> batch decoder without optional `metadataSummary.selectionId`. Commit
> `6d05370` adds safe `P9_INTERNAL_ERROR` mapping for batch-response contract
> failures and deterministic cleanup for the two warning suites. Local
> verification passed 7 suites/233 tests with `--detectOpenHandles`, with no
> `act(...)` or non-exit warning; TypeScript and deployment-runtime validation
> passed. The matching Owner Edge bundle was deployed only to the verified
> development project as active v11 (`ezbr_sha256=0af2f2ebde6019d5f10923141b279ae3a78a5ca0f5eeac6630b990030caddf55`,
> JWT verification enabled). The same authenticated session now renders both
> candidate review cards through Edge; no reprocessing or inventory write was
> required. Render, M60, database/Storage, dispatch, and existing development
> data were unchanged. The foreign Supabase values exist only in this parent
> process, not User/Machine environment; all connected commands used the exact
> project ref explicitly. Next action: finish the remaining connected regression
> matrix under connected-test authorization.

> **Historical pre-correction Unit 6H diagnostic checkpoint (2026-09-12):** The
> authorized development proof reached duplicate confirmation and Proceed,
> produced two candidates from the new upload, and added no inventory. The
> authenticated Edge session-summary read returned 200, but the batch-review
> Edge action returned HTTP 400 `P9_REQUEST_INVALID`; the same authenticated
> PostgREST RPC returned 200 with two cards containing `selectionId`. This
> proves a deployed `phase9-owner-ingestion` response-contract/version drift
> after the live metadata projection, not a Gemini or Books API failure. The
> exact deployed source/version is still a readback item; the active Edge v9
> record is the leading explanation, not yet source-level proof. Read-only
> database evidence shows the new input owns exactly one resolved vision job
> and both candidates. `.env.local`, the served Expo bundle, and the endpoint
> use the target project; only the parent PowerShell environment has a stale
> foreign Supabase URL/key, which did not drive this browser bundle. Retry
> reproduces the UI fallback. The next action is an authorized readback or
> matching Edge redeployment, followed by the same connected proof. This
> diagnostic changed no code, tests, migrations, deployment, dispatch, or M60
> state; it created only the authorized development test session/upload/job
> state and deleted no data. M60 was applied before this diagnostic under the
> preceding rollout authorization; no M60 migration action was taken here. The
> following PostgreSQL-only checkpoint is retained as historical pre-connected
> evidence; its local-only rollout wording is not current.

> **Historical local PostgreSQL verification checkpoint (superseded by the connected closeout above) (2026-09-12; supersedes the prior correction-only gate):** F-01 remains retracted; F-02 and F-03 remain corrected locally. Focused Jest passed 4 suites/181 tests, including the 3 lifecycle tests, and the in-memory PGlite fixture passed 5/5. The Owner-authorized disposable PostgreSQL 18.4 harness then ran at `127.0.0.1:55461` with data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912` and PID-scoped database `bookconnect_u8b_22652`. It applied the disposable baseline and M01–M60, passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` using independent connections, and passed the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` regression. Teardown was verified: the database/cluster directory is absent, the port has no listener, and no matching postgres process remains. M52–M59 are unchanged; M60 remains local and was not remotely applied. No remote database/Storage or application data was touched; no deployment, dispatch change, development-data deletion, staging, commit, or push occurred. Connected Edge/Storage verification remains unrun. Prior screen act/open-handle warnings remain historical unresolved evidence and did not affect these database checks. Next: review this local PostgreSQL proof and separately authorize connected Edge/Storage verification. No product behavior or inventory duplicate policy changed.


**Last updated:** 2026-09-28
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Unit 6H development overlay:** Unit 6H duplicate confirmation has completed its bounded correction and disposable independent-connection PostgreSQL verification on `codex/phase9-duplicate-confirmation`; the code correction is `bb91428048ca9028c5592cbbc52c982bd6843946` from baseline `8340647`, with documentation synchronized in the follow-up commit. F-01 was retracted; F-02 and F-03 are corrected. M60 is live once as `20260912072815`; M61 is live once as `20260913111342`; M62 is live once as `20260913162154`. The matching Owner Edge v14 and metadata worker are live, while the local client reached the existing active `LIVE-TEST-20260912-REPRO` scan and could not register a new image because one processed image and 15 candidates already exist. The connected no-cover proof is therefore blocked by the required explicit authorization to remove that existing image or use a clean Owner session/store. [Unit 6H authority and deployment procedure](./phase-9-image-inventory/work-units/06h-duplicate-input-confirmation.md).

## 2026-09-12 Unit 6H review closeout

- Correction checks passed: focused Jest passed **4 suites / 181 tests**, including the three duplicate-resolution lifecycle tests; the local duplicate-confirmation fixture passed **5/5** scenarios; TypeScript validation passed.
- F-01 is retracted: M58 already catches the legacy constraint identity and M60 translates the resulting receipt. F-02 is corrected with service-role-only public delegates to the private functions. F-03 is corrected with local session/controller lifecycle fencing and response-session validation. The disposable PostgreSQL run passed both the independent-connection Unit 6H concurrency marker and the existing U8B regression marker. Connected Edge/Storage verification remains the next rollout gate.
- The focused screen suite still logs the React Native `VirtualizedList` `act(...)` warning. Isolation tied it to the existing `CaptureProgressScreens.test.tsx` FlatList timer path; that suite exited normally. The non-exiting process isolates to the older `unit6gMountedRouteIntegration.test.tsx`: 4/4 assertions pass, `--detectOpenHandles` names no handle, and `--forceExit` is required. Unit 6H dialog/lifecycle and non-UI contract groups exit normally.
- M60 was applied before this connected diagnostic under prior authorization; no M60 migration action occurred during this review. No deployment, remote database/Storage mutation, live dispatch, or development-data deletion occurred during this diagnostic.
- Owner Edge source/version readback, matching v11 deployment, and authenticated batch-review proof now pass. Follow-up is the remaining connected Unit 6H regression matrix.

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Historical Unit 6G correction:** The duplicate-sanitized-hash media-completion
  correction is committed and pushed at
  `ffdb1fc85af625bc98dcfc3af93d5530278144a9` on `origin/main` from the
  integrated branch `codex/phase9-unit6g-media-correction-integrated`.
  M52–M56 were already tracked by that baseline; M57–M59 were applied
  separately and in order as live versions `20260908073203`, `20260908073308`,
  and `20260908073425`, with exact-project readback passing. Render service
  `phase9-media-sanitation` is live from that commit as deployment
  `dep-dafv4ogn74is73bq9lkg`; `/health` and `/ready` both returned 200. The
  requested duplicate-input proof and a unique positive sanitization/vision
  proof both passed at attempt 1. Owner review of the runtime closeout is the
  exact next action; do not revive the historical dead-lettered job.
- **Latest runtime state:** M43-M48 remain live at their recorded versions; Unit 8 is live exactly once as M49 `20260821060156`, M50 `20260821060742`, and M51 `20260821061213`; Unit 6G-B is live exactly once as **M52 `20260822025712 marketplace_phase9_unit6g_contract_persistence_foundation`**; U6G-FA-001 is live exactly once as **M53 `20260828081324 marketplace_phase9_unit6g_field_authority_correction`**; the Owner-authorized lifecycle fence is live exactly once as **M54 `20260829142337 marketplace_phase9_unit6g_session_lifecycle_fence`**; and bounded metadata/Add-authority correction M55 is live exactly once as **`20260830084323 marketplace_phase9_unit6g_metadata_add_authority_correction`**. M54 makes the final Save/Add/Remove RPCs require an active, unexpired, Owner-initiated session while preserving exact completed replay, and reduces closed/closing/expired detail and batch projections to read-only actions. M55 makes bibliographic evidence primary for durable metadata identity, removes the hard Google language filter, retains exact-ISBN fallback for ISBN-only input, keeps empty-author review saves valid while requiring an author for final Add, and gates batch-card Add on full eligibility. Connected proof on an existing closed candidate returned `P9_STATE_CONFLICT` for all three commands with zero durable effects. M54/M55 change function definitions only; they change no business rows, Storage, public signatures, tables, or RLS policies. Edge v9 is the active `phase9-owner-ingestion` version with JWT verification enabled; the matching local client bundle remains undeployed.
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** Unit 8 remains live-verified and integrated into pushed `main` at `4c1d98d`. Unit 6G Group 1/B (contracts, runtime dispatch, M52) remains implemented and M52 is live exactly once as `20260822025712`. On 2026-08-24 the Unit 6G design authority was **recomposed**: the revised [Unit 6G SDD](./phase-9-image-inventory/work-units/06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md), [contract matrix](./phase-9-image-inventory/work-units/06g-owner-scan-defaults-batch-review-contract-matrix.md), and [tracker 31](./phase-9-image-inventory/trackers/31-unit6g-owner-batch-review-design-evidence.md) are the current authority; Unit 6 is the immutable lifecycle backbone. Historical commit `e7ed166`-style old 6G-C and frozen old 6G-D work is superseded evidence, not implementation authority. **Unit 6G-C and NEW 6G-D implementations are COMPLETE and locally checkpointed** (independent reviews COMPLETE; 6G-D final verdict PASS; known deferred P3s: OX-F1/F2 sync-edge notes, N1 module-size, L-F03 attribution precision). M54/M55 are live-verified for the final Save/Add/Remove, detail/batch lifecycle, metadata identity, and Add-authority boundaries. The media-completion correction is now runtime-verified through the deployed worker and connected proofs; the exact next action is Owner review of this closeout. **6G-E Edge/client/native deployment remains separately gated**; no client deployment occurred.
- **Historical bounded metadata-throughput preflight:** Local implementation was completed for a metadata-only 15-job run budget with at most three incrementally claimed active jobs and one independent provider request per book. Later read-only migration history confirms M56 is live once as `20260830175651`; the current gate is the Unit 6G media-completion correction above.
- **2026-08-14 Unit 7B closeout:** The real private row `The Birth of Tragedy` completed Publish → anonymous discovery (exactly one listing) → Pause (removed from discovery) → Republish (exactly one listing). The controlled transient fault produced one `publication_failed`/retry job; the worker resolved it, and the stale-intent retry was fenced with `P9_STATE_CONFLICT`. Final connected readback preserved quantity/identity and showed one active listing with zero outstanding publication retries. The development `active_listing_limit` entitlement was then raised from the temporary `unit7b_dev_rollout` value `1` to `10`; authoritative eligibility now passes for the other ready rows, while `Café du Livre` remains blocked by its zero price.
- **2026-08-14 Unit 7B main integration:** Commit `9f3e646` was merged into `main` at merge commit `53edbddc9c5417b34cb169599e8282b162e183b3`. No additional migration, live business-row mutation, or Unit 7C action was performed as part of the merge.
- **Historical 2026-08-12 pre-correction checkpoint:** The sole authorized `phase9-owner-ingestion` deployment attempt failed before activation because the bundler could not resolve `../contracts/registers` without `.ts`; at that checkpoint version 3 remains ACTIVE and controlled live Add-to-Inventory/exact replay was blocked. The corrected version 4 deployment and current UI-availability gate are recorded above.
- **Latest 2026-08-12 controlled-proof update:** Edge version 5 resolved the `OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` that had hidden Add to Inventory. At 04:41 UTC the authenticated Owner committed `Individuals` from candidate `f6266e3a-e920-4fa0-a993-c02c739f5108`; at approximately 05:00 UTC the exact original command replay returned the canonical recorded result for inventory `5f5a2bc9-d702-4aeb-af55-2a9df6c16478`. Readback verified one inventory row, `committed_count=1`, one completed idempotency row, one audit log, and one event, with zero new replay effects. `UNIT_7A_LIVE_PROOF` is PASS and the UI-availability gate is CLEARED. `Thinking, Fast and Slow` remains uncommitted (`review_ready=false`) and is outside the proof.
- **Latest 2026-08-12 fresh-image observation:** user-started session `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one image, but media validation retried and the input is now server-readback `skipped` with `P9_OWNER_REMOVED`; its job is cancelled at attempt `2/5` and the session has zero candidates. The input must not be revived without a new explicit target decision.
- **Latest fresh-processing continuation:** the same user-started session later accepted a second image and completed successfully. It produced two candidates, `Individuals` and `Thinking, Fast and Slow`; both are server-readback `state=ready` with `review_ready=false`. The first review screen loads matched metadata but requires a price and Owner confirmations, so no new review or inventory write has been made.
- **Latest fresh review action:** candidate `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved privately with quantity `1` and price `250000` paise; server readback is `ready`/`reviewed`/`review_ready=true`. Its next-step detail failed twice, so Add to Inventory was unavailable; inventory remains `5` and Unit 7A commit counters remain zero.
- **2026-08-09 controlled web-proof stop:** the real Expo web path reached Profile → Store Owner Console → Inventory under the authenticated Owner session. Inventory exposed an older active capture with 6 processing images and 1 review item; exact-project read-only baseline was 4 sessions total, 3 active/closing, 18 inputs, 27 jobs, 8 pending jobs, 13 candidates, and zero metadata jobs/attempts/provider calls/lookups/cache entries. The shared queue could not be isolated to a new image, and the process had no Google Books credential, so no fresh session or upload was started. The browser is left on `/inventory`.
- **2026-08-09 M33 live correction:** exact-project migration history now records M33 once as `20260809023834 marketplace_phase9_vision_reservation_correction`; the preserved vision job is `retry_scheduled` at attempt `4/5` with its sanitized 1600x1600 WebP lineage intact.
- **2026-08-09 schema-free Gemini JSON correction:** Gemini now receives JSON MIME mode and the user's flat `vision` prompt with no provider response schema; BookConnect keeps strict local validation and server-owned M18/M19 mapping. The live payload evidence supports a narrow compatibility layer: `success` becomes `analyzed`, null language becomes `und`, known language names become BCP 47 tags, safe ISBN labels are stripped, and an analyzed visible-book count is reconciled to the accepted observation count. Five exact-path Jest suites and the later main-line diagnostic protect these mappings. M34, jobs, metadata, Owner UI continuation, inventory, and publication remain separately controlled.
- **2026-08-10 single-image correction:** `unit6c_single_image_safe_remove` remains the completed live operational checkpoint, not the active work unit. Remove image remains; append-style Add another image is removed. M35 is live once as `20260809223135`, the three explicitly targeted legacy inputs were logically removed with their exact jobs cancelled, and Owner Edge `phase9-owner-ingestion` v3 is active with an exact four-file readback match. No candidates, inventory, listings, or physical Storage objects were deleted. One new input was registered after the removals and is observation-only pending a new explicit decision.
- **Global status authority:** [DOC-13](../DOC-13-implementation-tracker.md)

## Required reading order

1. [DOC-13 current status](../DOC-13-implementation-tracker.md)
2. [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
3. [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
4. [Phase 9 master SDD](./phase-9-image-inventory/00-phase-9-master-sdd.md)
5. The domain SDD and supporting documents routed by SESSION-START for the active work unit
6. [Implementation and verification tracker](./phase-9-image-inventory/trackers/02-implementation-and-verification.md) when implementation is authorized

## Route-change transaction

When the active phase changes, update these together in one reviewable change:

1. DOC-13 current status, phase table, handoff, and next action;
2. this router;
3. the outgoing phase tracker with a final closeout/next-phase link;
4. the incoming phase tracker/session-start file;
5. marketplace and implementation README current-handoff sections;
6. the current marketplace pointer in repository `AGENTS.md`.

Do not point this file to an unapproved phase merely because work is proposed. A route change requires an explicit product/roadmap decision recorded in DOC-13.
