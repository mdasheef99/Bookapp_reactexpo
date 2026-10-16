## 2026-10-13 - Metadata sheet scrolling corrected locally

Current status: `metadata_sheet_scroll_correction_local_verified`. Phase 9 / Unit 6G remains active. The Owner reported that the live scan's metadata sheet could not scroll. A bounded two-file local layout correction restores the existing picker SDD §3 / §10 EP-AC03 interaction; no requirement, acceptance ID or command contract changes.

Before the fix, the 375 × 580 browser sheet clipped a 1600px ScrollView inside a 522px cap; its inner GlassCard content wrapper did not shrink. Ordinary scrolling left scrollTop=0. The main review list scrolled normally after Escape closed the sheet. GlassCard now accepts an optional inner contentStyle, and only CandidateMetadataSheet opts into flexShrink=1 / minHeight=0. Other callers keep their defaults.

Fresh verification: four focused Jest suites / 67 tests PASS; TypeScript no-emit PASS; Expo web export PASS (2690 modules / 69 assets). The rebuilt localhost:8083 preview passed ordinary wheel scrolling: 482px scroll viewport, scrollTop0 -> 580; Show all expanded ten saved positions, and scrolling reached the visible Close metadata button at y508-560. No automatic scrollIntoView was used for this scroll proof. The scan still displays seven detected, six in review, one added.

The earlier live Open Library selection/private Add proof remains valid. This correction is local and uncommitted; the shared runtimes remain at the previously verified source. No Search Books, selection, Save, Add, provider flag, database/Storage/job mutation, migration, staging, commit, push or shared deployment occurred in this check. M75 remains uncreated/unapplied and deferred. Native-device scrolling was not run.

Exact next authorized action: Owner review of the corrected scrolling in the open localhost:8083 scan. Publication of the two-file correction requires a separate instruction. [Cause, source changes and ordinary-scroll evidence](./37-owner-edition-picker-open-library-local.md) (tracker 37 §27); preceding dated entries retain their historical scope.

## 2026-10-13 - Open Library enabled; fresh-session picker and private Add verified

Current status: `open_library_live_fresh_session_picker_private_add_verified`. Phase 9 / Unit 6G remains active. The Owner's "ok" authorized Open Library activation and one controlled authenticated fresh-session test. The specified testimage.jpeg had been uploaded before, so the app's duplicate guard prompted; the test used Proceed and created independent candidates for this session. The Search Books -> selection -> private Add path passed for one book; six other detected books remain in review. M75 remains PROPOSED / NOT_CREATED / NOT_APPLIED and deferred.

Fresh exact-project preflight matched Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, Render LIVE commit 76348f3 and Owner API ACTIVE v16/JWT enabled. One bounded registry update enabled Open Library at 2026-10-12T22:05:26.434106Z (13 October IST); only enabled/updated_at changed. Google remains enabled. Existing retention, attribution, permission and image-cache flags are preserved; no migration or deployment occurred.

The old scan 93567d47-3874-4576-b3b4-1adb044b552b was closed through the authenticated app at 2026-10-12T22:08:44.023344Z. Live readback: closed/version3, all five candidates retained, all four committed inventory rows present, unchanged candidate states/versions/links. The unfinished card is read-only session history; its exhausted job is still in_progress at 5/5. No job reset or recovery fix was performed.

Exact next authorized action: Owner review of the live proof and direction on the six remaining cards in active session 7a81bdb6-ed34-40cb-b5a9-cff85402cf48; separately decide whether to authorize the proposed M75 exhausted-lookup recovery. The new session remains active, and the existing expired 5/5 job remains untouched. Sources: picker SDD §13.14, DOC-3 §5.2.1, Unit 6G SDD §§14/23 (U6G-AC13/18/20). [Live picker and Add evidence](37-owner-edition-picker-open-library-local.md) (tracker 37 §26); earlier headers are historical.
## 2026-10-13 - Owner API v16 verified; exhausted lookup recovery pending

Current status: open_library_owner_api_v16_verified_exhausted_lookup_recovery_pending. Phase 9 / Unit 6G remains active. Render still runs reviewed commit 76348f3; phase9-owner-ingestion is now ACTIVE version 16 with JWT verification enabled. All 35 served runtime files match the reviewed upload; three additional uploaded files were type-only dependencies, as independently checked against the Deno runtime graph.

Fresh API checks: OPTIONS 200, unauthenticated POST 401. The actual authenticated Codex browser loads the scan and reads edition state. The verified frontend export was restarted at localhost:8083, managed session 96852, after the old Metro preview had stopped; the fresh tab uses the tested static bundle and correct project.

The supplied card is blocked by an existing in_progress edition request with attempt_count=max_attempts=5 and an expired lease. Live dispatcher and claim predicates exclude it, while the choices reader reports pending; the UI therefore shows Searching books indefinitely. No job, selection, selling field or provider flag was manually repaired. Open Library stays disabled.

Proposed bounded correction: a new forward M75, leaving M65-M74 unchanged, must expose exhausted expired edition requests as failed and allow an initiating-Owner controlled retry with preserved chosen metadata, selling details and accounting/audit evidence. Exact file is proposed only: 20261013000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql; NOT_CREATED / NOT_APPLIED. Local creation and conditional shared application await the Owner's separate authorization.

Exact next action: obtain that bounded M75 authorization, then reproduce, implement and review the correction before fresh preflight/application and the controlled live edition workflow. No Render or Owner API redeployment is needed for the proposed SQL-only correction. [API deployment and live recovery finding](37-owner-edition-picker-open-library-local.md) (tracker 37 sections 23-24); earlier dated entries are historical.

## 2026-10-12 - M74 applied and verified; Open Library disabled; Render held

Current status: open_library_m74_applied_verified_render_held. Phase 9 / Unit 6G remains active. The Owner explicitly requested completion of M74 preflight/application after the approved bounded correction. That application authority supersedes the earlier local-only gate for M74; publication, provider activation and Render deployment remain held.

Fresh preflight matched the reviewed file and both M73 function bodies/permissions on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; the focused full-M74 SQL/security suite passed 20/20. M74 is APPLIED_VERIFIED as live version 20261012140853. Archived SQL SHA-256 FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 matches the unchanged local file; both installed function bodies match the reviewed definitions.

Only the two private completion/registration functions changed. Their signatures/owners/ACLs/search paths and 17 other checked functions remain intact; provider-call columns/RLS/ACLs/policies, provider flags and observed business/job counts are unchanged. Open Library remains disabled with no unresolved OL attempt. One existing in_progress edition job has an expired lease; it was observed and preserved.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. Compatible client/worker/Owner API rollout, separately authorized provider activation and controlled shared operational acceptance remain pending. STOP before Render deployment. No commit, push, runtime deployment, provider request, Auth/inventory/Storage write or account/configuration change occurred. [Application ledger, exact readback and scope](#15-m74-preflight-application-and-live-readback-2026-10-12) (§15). Earlier dated checkpoints are historical.

## 2026-10-12 - Author isolation corrected locally; M74 unapplied; Render held

Current status: open_library_author_corrections_local_verified_m74_pending. Phase 9 / Unit 6G remains active. The Owner authorized "Yes, fix both and create local M74". Both aggregate P2 findings were reproduced, corrected and regression-tested; GPT-6 Luna/max approved the bounded correction. This does not replace the aggregate prepublication review.

The adapter validates edition facts before allocating complete own-author sets within the four-author budget. Nonretryable author-content failures leave only dependent rows unavailable; local M74 permits truthful finalized receipts to continue and complete without weakening mandatory-stage, retryable, egress or authority guards. Google ranking/cover and Owner UI behavior are preserved.

M65-M73 remain applied and byte-preserved. M73's archived live SQL matched its reviewed hash in this session's read-only exact-project check; OL remains disabled. M74 is CREATED_LOCAL / NOT_APPLIED. No shared mutation, provider request, browser action, staging, commit, push or deployment occurred in this correction.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. M74 application needs a separate decision and fresh preflight; compatible client/worker/Owner API rollout, provider activation and authenticated operational acceptance remain gates. STOP before Render deployment. [Exact scope, commands, migration ledger and evidence](#14-aggregate-review-corrections-and-local-m74-checkpoint-2026-10-12) (§14). Earlier dated checkpoints are historical.

## 2026-10-12 - Browser corrections verified; M73 applied; Render held

Current status: `open_library_browser_corrected_m73_applied_render_held`. Phase 9 / Unit 6G remains active. The Owner explicitly authorized correcting the browser findings, preflight and migration application, with a stop before Render deployment. Section 5 is the current migration ledger; section 11 owns this checkpoint's scope, verification and remaining gates. Earlier dated sections retain historical evidence and do not supersede this handoff.

No new Save step is introduced: explicit edition selection persists its coherent choice; the existing full-review Save control is exercised only as regression coverage. Eight isolated actual-app browser cases and the 379-test client gate pass. M73 is APPLIED_VERIFIED at version 20261011224457, with OL disabled and archived SQL matching the reviewed hash. Exact next authorized action: report the verified checkpoint and remaining rollout prerequisites, then STOP before Render deployment. Publication, compatible runtime/client rollout, shared provider activation and authenticated operational acceptance remain pending.

# Open Library explicit edition fallback: local implementation and review

## 1. Historical local checkpoint and authority, 2026-10-11

Date: 2026-10-11. Phase 9 / Unit 6G; branch codex/edition-picker, HEAD d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e. Worktree: C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect. The Desktop Unit 6I checkout is excluded.

Status: open_library_native_spacing_locally_verified_browser_pending. Tasks 1-8 keep their prior bounded approvals. The Owner authorized Google-first investigation, then this explicit-search Open Library fallback; "Yes, create local M73" is local-file authority only. The latest instruction requires stopping before browser inspection and providing a separate detailed prompt.

Source authority: DOC-3 §5.2.1; picker §§4-9/13.14; Master tenant/command/provider invariants; SESSION-START §§5-8. No automatic alternatives capture, shared-option copying, new manual edition number, review removal, catalogue reset or public/canonical promotion is introduced.

Next authorized action: use the separate predeployment browser inspection prompt in another session, then return its report here for the final Free-plan/configuration preflight. Do not start browser testing in this preparation session. Deployment remains held at the Owner's request; M73 application, shared provider activation, compatible runtime/client rollout, shared security/cleanup/recovery/disablement and publication remain gates. Available-model local correction review does not replace the requested Luna prepublication review, which remains separately pending at its usage limit.

## 2. Why this correction exists

Historical investigation in tracker 36 observed six configured-key Google invocations: one HTTP 200 and five HTTP 503s. Independent request review found no construction defect; unkeyed 429s do not diagnose the configured project. This is evidence of intermittent availability failures, not a declared global Google outage. Production Google bootstrap still has no verified retention callback for this storage workflow; absent headers alone are not a blanket prohibition on factual metadata use.

Earlier read-only OL search/edition/ISBN probes returned HTTP 200. Its [human-lookup API guidelines](https://openlibrary.org/developers/api) encourage caching and default to 1 request/second; concurrency alone is not throttling. [Search](https://openlibrary.org/dev/docs/api/search) returns works; [edition/Books](https://openlibrary.org/dev/docs/api/books) and [cover](https://openlibrary.org/dev/docs/api/covers) guidance support coherent own-edition facts and direct image URLs. [Licensing](https://openlibrary.org/developers/licensing) does not claim new database rights or blanket CC0 for every contribution/cover. The approved narrow implementation retains basic bibliographic facts and URLs, not descriptive prose, raw bodies or image files.

This local implementation made no actual Google/OL HTTP request. All new provider tests use recorded/synthetic fixture fetchers. Earlier provider observations retain their own timestamps and limitations.

## 3. Implemented route and Owner display

1. Automatic local-first Google matching, cache, winner ranking and representative cover remain the existing path; automatic secondary is still null.
2. Explicit Search Books chooses Google when its registry policy and verified retention implementation make it eligible. Without the verifier before a fresh route, independently enabled/permitted OL can be primary. Actual policy/quota/input/auth/config denial never authorizes secondary bypass.
3. A technical/no-acceptable-result Google attempt can invoke one OL secondary under the same logical usage reservation. Allowlisted technical failures include timeout, unavailability, network failure, malformed/schema-invalid response, unsupported content type and response-size rejection.
4. OL reads search.json (one work key), that validated work's editions.json (up to ten positions) and at most four unique own-edition author records: six GETs maximum per physical claim. No provider-supplied arbitrary URL is followed. Missing author 404 affects only dependent rows; transport/config failures stop the attempt.
5. Preserve duplicate/original positions and OL page order; first five/Show all up to ten. OL order is not advertised as newest or Google relevance. Eligibility is separate from match certainty; safe conflicting-ISBN records suppress strong certainty even if ineligible.
6. Valid rows show own cover/placeholder, title, all authors, supplied date and optional identifying fields. Source attribution/link reflect Google or OL. OpenLibrary exact book and cover URL forms are validated in SQL, server and client, including compact batch summaries.
7. Selection/Save/resume/Add preserve coherent source facts and selling edits. Successful Add clears only this card's alternatives after commit; chosen snapshot survives. Required review/confirmations and existing single/bulk locking remain unchanged.

The wire key googleBooksUrl is retained for existing Google shape, with strict actual-source validation. This is not compatibility with older Google-only clients: publish the supported OL-aware client before activation. Existing Google lookup identity cannot be relabelled on retry; OL-secondary retry resumes OL without repeating Google. An older Google operation without the verifier ends safely; a fresh Search Books action starts new OL-capable lineage.

Google/OL policy versions must remain synchronized for a true secondary under the existing lookup/registry invariant (currently 1). Mismatch fails closed before OL HTTP; no new policy-version mirror/column was added.

## 4. Physical GET accounting, retention and security

The existing worker batch limit 15 and concurrency 3 remain. The bootstrap shares one OL 1 GET/s limiter across active jobs on the existing single instance; no added service/instance/dependency/key/contact address or bulk/background harvesting.

Every GET has its own immutable service receipt, sequence/stage and fresh lease/card/query/generation/policy fence. Registration replay uses the same UUID; uncertainty never sends blind HTTP. Known registration-only cancellation finalizes egress=false, while attempted GETs finalize true on success or error. Search precedes editions, then at most four bounded author stages. Completion rejects unproven egress and wrong lookup/provider lineage. No options/raw payload are copied into audit/cache/physical receipts.

OL alternatives use the approved 24-hour maximum from original fetch, shortened or denied by actual response cache deadlines across the successful GETs. Shared Cache-Control/Date/Age/Expires evaluation remains fail-closed. Selected factual snapshots survive expiry; only temporary alternatives clear. Google permission remains unresolved, without a synthetic production verifier.

New private helpers revoke public/client execution; public worker wrappers are service-role-only. Existing Owner/store/session and Save/Add authority fences remain. Local tests cover anonymous calls, source URL/metadata/ISBN mismatch, revoked policy and stale claims. No new public/customer result exposure.

## 5. Current migration ledger and shared application/readback audit

Current ledger: M73 below remains APPLIED_VERIFIED and disabled. M74 is now APPLIED_VERIFIED / live 20261012140853 under separate Owner authority; §15.3 records application/readback. §14.3 retains the historical local-only creation checkpoint.


| Item | Exact evidence |
| --- | --- |
| Local file | supabase/migrations/20261011000073_marketplace_phase9_open_library_edition_options.sql |
| Status | APPLIED_VERIFIED; Open Library remains disabled |
| SHA-256 | 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82 |
| Application authority/live version | Owner's explicit 2026-10-12 instruction to preflight/apply migrations / 20261011224457 |
| Exact verified project | Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / org xxbqwluvomrrxeohydis / ACTIVE_HEALTHY / PG17.6.1.063 / ap-southeast-2 |
| Latest Phase 9 application | M73, marketplace_phase9_open_library_edition_options, version 20261011224457; M72 remains version 20261010200655 |
| Later unrelated live history | library_manual_note_persistence, version 20261010221843; preserved |
| Affected live objects | Disabled OL registry row, three nullable receipt columns, two unique stage/sequence indexes, bounded stage constraint and service-only RPCs verified |
| Mutations | One reviewed M73 application only; no provider activation, business-data/Storage/Auth write, runtime deployment, secret or billing change |

M73 installs open_library metadata v1.0.0 disabled, policy_version=1; factual matching/storage/display capability, direct-cover attribution, raw_retention_seconds=0, image_cache_allowed=false and revalidation_seconds=86400. Registry flags are not Google permission.

It adds nullable edition_call_sequence (smallint), edition_call_stage (text), edition_egress_started (boolean) to phase9_metadata_provider_calls, bounded shape/unique per-attempt/claim sequence/stage constraints and three service wrappers:
- phase9_register_edition_options_provider_call_v1
- phase9_finalize_edition_options_provider_call_v1
- phase9_finish_edition_primary_for_fallback_v1

Forward definitions extend source policy, coherent normalization, worker context/lineage, completion/recovery/choices/selection and compact summary. M38's public v2 context wrapper and M70 confirmation/replay wrappers stay intact. The base registration adds three technical secondary outcomes only for explicit p9-owner-edition-options-v1 jobs; automatic registration semantics are preserved. The compact summary preserves M61 STABLE SECURITY DEFINER representative-cover derivation, adding only the narrow own OL cover form.

M65-M72 retain their applied source hashes. The continuity validator admits only this exact M73 filename under recorded local Owner authority; other unexpected/duplicate correction files remain rejected. No applied migration was edited.

Rollback/disablement plan (not executed): disable the OL route/registry, halt new OL lookups, preserve chosen store facts/inventory and existing receipts, and use reviewed forward restoration if needed. Do not drop data or return an incompatible old Google-only reader over stored OL choices. These operational procedures require separate authorization/proof.

## 6. Regression and verification evidence

Initial provider constructor/migration red gates were followed by meaningful regressions for missing-author page loss, fresh-fence cancellation, reclaimed retry, lost registration response, wrong primary lineage, unproven egress, missing technical fallback outcomes and OL own-cover compact projection. The latest independent finding reproduced missing Google representativeCover (undefined versus old-alternate; exit 1) before the narrow M61-preservation fix. The final full-M73 suite includes that regression.

| Gate | Result and practical limit |
| --- | --- |
| Full M65-M73 compiled-worker/PGlite suite | 24/24 PASS, normal exit0; actual RPC/selection/Save/Add/replay/cleanup with fixture HTTP; sequential disposable DB, not independent-connection race proof |
| Backend/provider/worker/contracts | 15 suites / 387 tests PASS; recorded/mock provider services, no live requests |
| Exact Task7 UI gate | 23 suites / 354 tests PASS, normal exit0 on unchanged assertion/timeout rerun with --silent; mounted React/mocked services, not browser/live persistence |
| Strict new provider/worker tests | PASS; successful fixture null assertions and Request-compatible fetcher corrected after 8 fixture-only type errors |
| Whole project TypeScript | PASS, normal exit0: node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions |
| Worker strict build / structural SQL | PASS, normal exit0: npm.cmd run test:phase9:structural-metadata; 14/14 historical structural fixture cases, not a full M73 stack |
| Continuity / migration set / syntax / whitespace | Continuity/migration set and validator syntax PASS; new-file whitespace PASS; final tracked diff and Node syntax readback recorded in closeout |

The first correct-worktree UI run had 22 suites/353 tests pass and one existing five-second review:null draft timeout. The unchanged rerun passed all 354; cause is not established. Existing act/VirtualizedList and Node DEP0040 warnings were observed; --silent suppresses console output only, not assertions/timeouts. No --forceExit was used in the final pass.

Verification-process deviation: one UI invocation and accompanying reads lost a stored workdir and accessed Desktop; picker files were ENOENT. That run was stopped/excluded. No source/migration/document edit occurred there; ordinary ignored Jest caches may have been generated. All affected reads/UI were rerun with the literal verified worktree path. An oversized PowerShell documentation command failed before process creation and changed nothing; bounded follow-up writes succeeded.

Current decisive SQL suite: node --experimental-vm-modules --test supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs. Its fixture installs the historical stack through M69, then M70-M73, and runs the freshly compiled worker. Existing historical PGlite suites/build fixtures are not silently treated as full M73 evidence. Earlier Task8 native M65-M70 races retain their provenance; they do not prove M73 stage-registration races.

## 7. Acceptance mapping and review provenance

The 19 existing active IDs stay in the picker; no new product acceptance ID is added. EP-AC17 remains deferred.
- EP-AC01/07/08: unchanged batch15/concurrency3 and automatic winner behavior; bounded accounted explicit GETs, idempotent request/usage and retry provenance.
- EP-AC02/03/04/05: own coherent facts, unavailable/ineligible positions, safe links/covers, original order/duplicates and ISBN certainty independent of dates/cover availability.
- EP-AC06/09/10/11: explicit local/cache/older-card entry, fresh claim/version fences, controlled selection/replay and selling/confirmation preservation.
- EP-AC12: historical provenance is retained; §12 adds fresh native M73 selection/Add, stage/accounting and replay overlaps. Shared/browser rollout proof remains a separate gate.
- EP-AC13/14/15/16: coherent Add and replay/cleanup, chosen state and independent-card retention; new OL full-stack sequential proof and existing retention fixtures are distinguished from live lifecycle proof.
- EP-AC18/19/20: private authority/policy, existing manual/create-only paths and loss/recovery regressions.

GPT-6 Luna/max independently reviewed source and documented rollout/security guards. Root reproduced and fixed confirmed findings before the final read-only pass, which found no remaining blocker in the bounded local correction. The reviewer independently reran exactly two full-M73 integration cases: compiled OL selection/Save-resume/Add-replay/cleanup and Google representative-cover preservation; 2/2 passed, exit 0. The broader gate counts in §6 remain root evidence and were not independently rerun. This review does not approve shared application, activation, rollout, new native races or browser/device acceptance.

## 8. Exact remaining rollout and browser gates

1. Native M73 accounting/races, compiled actual-start spacing and bounded scheduler correction review are locally complete (§12). Run the separate browser inspection in another session first, using observation plus isolated fixtures; do not deploy shared services to manufacture this proof.
2. Return the browser report here, resolve confirmed bounded issues if any, then conduct the final Free-plan/configuration preflight here. That final preflight has not run in this checkpoint.
3. Fresh exact-project M73 schema/active-job/hash/ACL/policy preflight and separate application authority precede applying M73 disabled and verifying readback. Preserve unrelated latest migration/data.
4. Complete the requested publication review/authority and verify the supported OL-aware client plus compatible metadata worker/Owner API. Reconfirm the existing Free Render service and stop for the separate deployment decision; no plan/service/instance increase.
5. Separately authorize OL policy/registry activation under the factual human-lookup scope and synchronized policy versions. No fabricated Google permission callback.
6. Controlled shared Search Books/select/Save/resume/single/bulk Add/expiry/independent cleanup/recovery and disablement/security/rollback remain unrun and require designated approved development data and compatible runtime. Browser fixture persistence, native local SQL and live workflow evidence remain distinct.
7. Browser/device interaction/accessibility and rollout acceptance remain pending. The [independent prompt](../work-units/owner-edition-picker-open-library-browser-inspection-prompt.md) includes actual screenshots/clicks, explicit prerequisites and the required return before final configuration preflight.

No browser/runtime is started or operated by this checkpoint. No shared application, provider activation, Git publication or deployment is authorized by these local proofs.


## 9. Exact reproducible local commands

Run from the absolute edition-picker worktree. Use fixture services only; do not substitute a linked/shared database. The final UI gate ran without a competing compiler/Jest job.

```powershell
$testPaths = @(
'src/features/imageInventory/__tests__/EditionOptionList.test.tsx',
'src/features/imageInventory/__tests__/ownerEditionPickerMounted.test.tsx',
'src/features/imageInventory/__tests__/ownerEditionPickerFullReview.test.tsx',
'src/features/imageInventory/__tests__/ownerEditionPickerSheetStates.test.tsx',
'src/features/imageInventory/__tests__/ownerEditionPickerQueries.test.tsx',
'src/features/imageInventory/__tests__/ownerEditionPickerDrafts.test.ts',
'src/features/imageInventory/__tests__/ownerEditionPickerConfirmation.test.ts',
'src/features/imageInventory/__tests__/ownerEditionPickerCommit.test.ts',
'src/features/imageInventory/__tests__/batchReviewCard.test.tsx',
'src/features/imageInventory/__tests__/CandidateReviewScreens.test.tsx',
'src/features/imageInventory/__tests__/unit6gMountedRouteIntegration.test.tsx',
'src/features/imageInventory/__tests__/unit6gMountedRouteComposition.test.tsx',
'src/features/imageInventory/__tests__/postScanUiCorrections.test.tsx',
'src/features/imageInventory/__tests__/useInventoryCommitCoordinator.test.tsx',
'src/features/imageInventory/__tests__/inventoryCommitCoordinator.test.ts',
'src/features/imageInventory/__tests__/ownerUxReviewQueries.test.tsx',
'src/features/imageInventory/__tests__/inventoryCommitCache.test.ts',
'src/features/imageInventory/__tests__/batchReviewQueriesCleanup.test.tsx',
'src/features/imageInventory/__tests__/ownerEditionPickerCommands.test.ts',
'src/features/imageInventory/__tests__/ownerEditionPickerCache.test.ts',
'src/features/imageInventory/__tests__/ownerEditionPickerContracts.test.ts',
'src/features/imageInventory/__tests__/ownerEditionPickerService.test.ts',
'src/features/imageInventory/__tests__/reviewForm.test.ts'
)
node node_modules/jest/bin/jest.js --runInBand --watch=false --silent --runTestsByPath @testPaths
```

```powershell
$testPaths = @(
'supabase/functions/__tests__/phase9_edition_picker_contracts.test.ts',
'supabase/functions/__tests__/phase9_edition_picker_gateway.test.ts',
'supabase/functions/__tests__/phase9_google_books_edition_options.test.ts',
'supabase/functions/__tests__/phase9_google_books_edition_options_review.test.ts',
'supabase/functions/__tests__/phase9_google_books_adapter.test.ts',
'supabase/functions/__tests__/phase9_metadata_provider_adapter.test.ts',
'supabase/functions/__tests__/phase9_metadata_edition_options_worker.test.ts',
'supabase/functions/__tests__/phase9_metadata_edition_options_recovery.test.ts',
'supabase/functions/__tests__/phase9_metadata_edition_options_rpc.test.ts',
'supabase/functions/__tests__/phase9_metadata_environment.test.ts',
'supabase/functions/__tests__/phase9_metadata_worker.test.ts',
'supabase/functions/__tests__/phase9_metadata_production_gateway.test.ts',
'supabase/functions/__tests__/phase9_metadata_production_composition.test.ts',
'supabase/functions/__tests__/phase9_open_library_edition_options.test.ts',
'supabase/functions/__tests__/phase9_open_library_worker.test.ts'
)
node node_modules/jest/bin/jest.js --runInBand --watch=false --silent --runTestsByPath @testPaths
```

```powershell
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions
npm.cmd run test:phase9:structural-metadata
node --experimental-vm-modules --test supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --lib ES2022,DOM,DOM.Iterable --moduleResolution node --module commonjs --esModuleInterop --allowImportingTsExtensions --types node,jest supabase/functions/__tests__/phase9_open_library_edition_options.test.ts supabase/functions/__tests__/phase9_open_library_worker.test.ts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1
git diff --check
node --check supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs
```

M65-M72 SHA-256s (unchanged applied artifacts):
```text
M65 798A2B2D5722D40044FAD5FB4011FCED1D56F558FE05C3E44F0AA5EAB21EB9A3
M66 788662FA3BC60CD20F98BB350C13B5BA34F38DBC80F0C42AAE0678A71FA13BE7
M67 66654B8C9E35586BFB8A3BA4395DC9F2660F6CD36AB1104247196847849025AC
M68 C591686FA414B76635C55EADA59DC2172B0F885362606654C5886C5B11A85C5A
M69 008F9EBB8CDF3288053B10FFCF2A50DB36D96807A0B42787D89339EAE79E0CDE
M70 CBC63A03BF92A7609B4997B80C7CA3BB36C70D0568613D4D56CA76EDE230AF3C
M71 07D71D643599CA481AFF98415FA23A707D645ED27D5B7C06ADE69AA5A7426786
M72 49C946287085A6C4208FBC1348904DE8FB8A8EA2DBD79AD814186D0C723B39D7
```

## 10. Local closeout checks (2026-10-11)

Fresh final backend gate is 15 suites / 387 tests, normal exit0 after fixture-only typing corrections. Whole no-emit TS and worker strict build passed; structural14 passed at its disclosed historical stack. The unchanged UI rerun passed 23 suites / 354 tests without forceExit. Full-M73 SQL remains 24/24 after the representative-cover correction; no later product/migration edit occurred.

Continuity passed: 195 definitions, zero duplicates/missing traces, 96 Markdown files / 62 required. Exact M73 migration admission and validator syntax passed; new untracked file whitespace passed. Its initial repository diff check found three trailing spaces in newly added status headers; those were removed narrowly. An initial read-only Node syntax launch hit sandbox EPERM before execution and was retried locally. Final diff/syntax result is recorded below.

Documentation cohesion assessment: the existing authoritative SDD/history files remain cohesive in their existing source/status responsibilities; size warnings are advisory. Keep historical review/application provenance and requirements intact. The detailed new fallback evidence lives in this stable tracker rather than being duplicated across long handoff documents; no artificial line-based splitting or pruning.

Independent GPT-6 Luna/max source/doc correction review found no remaining bounded blocker and passed the exact two focused full-M73 cases (2/2, exit 0, 67.8s). The first sandboxed Node attempt failed before discovery; the authorized fixture-only retry passed. This is separate from root's wider verification counts. M73 stays local/unapplied; OL stays absent/disabled live. Prepared browser prompt is an artifact only, with no browser startup/inspection or live workflow mutation.

Final readback: git diff --check, tracked applied-migration preservation, Node SQL-harness syntax and all new-file trailing-whitespace checks passed with exit 0. Continuity/migration set passed with 195 requirement definitions, zero duplicates/missing traceability, 96 Markdown files and 62 required files. Existing document-size and LF/CRLF advisories remain nonblocking. The final closeout reruns the same documentation validator after this receipt.

Git remains codex/edition-picker at d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e: 39 modified / 12 untracked / zero staged. M73 final SHA-256 is 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82; applied M65-M72 are unchanged. No browser access, live provider call, shared database/Storage/Auth/inventory mutation, activation, deployment, staging, commit or push occurred in this local correction. Exact next action is the Owner handoff with the prepared independent browser prompt and preserved separate rollout decisions.

## 11. Fresh predeployment readiness verification (2026-10-11)

Owner scope: ensure the whole feature is working before deployment; continue local verification and use an independent reviewer. Browser hold and separate operational/Git decisions persist. This later session adds memory-only read-only provider diagnostics under the earlier explicit authorization; §2/§10 no-live-call statements describe their historical local implementation checkpoint.

Confirmed allocation defect: six successful OL GETs for Oliver Twist / Charles Dickens / en / no ISBN returned ten original positions but zero selectable rows. Title/language-incompatible earlier rows spent the four author slots before two exact-English editions at ordinals 7/8 could resolve their own George Cruikshank author record. GPT-6 Luna/max independently confirmed the mechanism. Three fixture regressions failed with [] instead of [7,8] before code edits. Prioritize safe plausible identity rows first; all displayed positions/duplicates and strict final suitability/certainty remain unchanged.

The fresh available reviewer additionally confirmed a plausible row needing more than four unique own-author IDs can never decode and can starve independent feasible rows. Its fourth regression failed before the feasibility correction; the duplicate-reference counterexample passed. Prioritization now excludes impossible unique-author counts without treating repeated references as additional GETs. No work-author borrowing, title/language loosening, representative-cover change, raw body retention or migration edit.

Exact current-session source/test scope:
- supabase/functions/_shared/imageInventory/metadata/openLibrary/adapter.ts
- supabase/functions/_shared/imageInventory/metadata/openLibrary/normalizer.ts
- supabase/functions/__tests__/phase9_open_library_edition_options.test.ts
- supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs
- src/features/imageInventory/__tests__/EditionOptionList.test.tsx

A compiled production factory/adapter probe with synthetic enabled policies (not the shared registry) subsequently returned 10 positions: 2 eligible, 4 ineligible and 4 unavailable; all six GETs were HTTP200 and Google HTTP count0. Selectable records were OL46671667M (2022, own authors George Cruikshank / Charles Dickens) and OL54759581M (2017, reversed own-author order). Both own covers are absent: the existing placeholder is correct. This post-priority probe preceded the additional unique-author feasibility check; later final fixtures/build verify that check separately. Cache-Control/Age/Expires were absent and Date present on these six responses; approved narrow OL factual-scope configuration bounded retention, not a fabricated Google verifier. Minimum observed wall-clock request-start gap was 967ms under the configured 1000ms limiter; this is a disclosed diagnostic, not strict native/production timing proof. No raw response/prose/images were retained.

Recovery adjudication: the reviewer raised a missing egress-started response-loss proof, then found no concrete contract violation after checking picker §§4.1/4.3/13.14, Master §8 and Pipeline EXT-30. The added full-M73 compiled-worker test proves an outcome_unknown/egress=true receipt remains immutable, the same non-due operation sends no additional HTTP, and a fresh due claim registers three distinct successful physical receipts with one logical usage reservation. The first uncertain GET plus three retry GETs are all auditable. This is bounded accounted retry, not reuse of an uncertain physical receipt; exactly-once provider calls are not promised. Runtime recovery behavior and M73 are unchanged. Native concurrency/timing and production workflow remain unproved.

Fresh read-only preflight: exact project Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, org xxbqwluvomrrxeohydis, ACTIVE_HEALTHY, Free. M72 live version20261010200655 and later unrelated library_manual_note_persistence20261010221843 remain; M73/OL registry/per-GET columns absent. Edition-state count0 and no nonterminal metadata jobs were observed. Owner ingestion is v15. Existing metadata Render service srv-d9sqfdvqj5pc73dc66fg is Free Docker/one instance/main/autoDeploy=no, latest live commit f2d47cb1d015c8b93ded58baff35f125f99ad52c. Plan identity was verified; actual usage counters were not. No environment key/value read or setting change in this session.

Review provenance: first fresh Luna/max review independently reran pre-correction full-M73 24/24, two OL Jest suites19/19 and whole TypeScript; it confirmed the first budget defect but hit its usage limit during recovery follow-up. Its prior bounded approval does not approve these later edits. The fresh available reviewer is read-only and is not represented as the requested Luna prepublication review. Final corrected gates/verdict and exact next action are recorded below after completion.

### 11.1 Final corrected local verification and independent verdict

Root's final affected backend command in §9 passed 15 suites / 392 tests with normal exit 0 after the unique-author feasibility correction. The final worker build (node node_modules/typescript/bin/tsc -p workers/phase9-metadata-worker/tsconfig.json), whole no-emit TypeScript and strict OL source/test graph passed. The rebuilt full-M65-M73 SQL/compiled-worker command passed all 25 cases, including the new response-loss accounting case. The mounted UI gate in §9 passed 23 suites / 355 tests after the new late-OL-choice test; UI source/tests were unchanged by the later backend-only feasibility check. No forceExit was used.

The structural-metadata build/historical disposable SQL gate passed 14/14 before that final two-line feasibility correction; it is not presented as a new full-M73/native test. The unchanged actual Owner-ingestion Deno graph passed earlier in this readiness session. Scoped gates are not a whole-repository Jest run.

Fresh available-model read-only correction verdict: PASS, no remaining actionable finding in the five-file bounded correction. The reviewer independently passed five author-budget cases (13 skipped), the mounted Show-all/select case (five skipped), and the targeted full-M73 lost-response case (one executed; Node TAP reported zero skipped). These are separately measured focused gates, not independent reruns of root's wider totals. The reviewer inspected final source, strict supplied-clue/ISBN rules, own-record facts and all migration hashes. Its first sandbox Node launch failed before discovery with EPERM; the authorized fixture-only retry passed. It made no edits or external mutations. This local correction review is not the requested Luna prepublication approval.

Focused independent commands, all normal exit 0:
```powershell
node node_modules/jest/bin/jest.js --runInBand --watch=false --runTestsByPath supabase/functions/__tests__/phase9_open_library_edition_options.test.ts --testNamePattern="reserves author GETs|repeated own-author"
node node_modules/jest/bin/jest.js --runInBand --watch=false --runTestsByPath src/features/imageInventory/__tests__/EditionOptionList.test.tsx --testNamePattern="reveals selectable Open Library"
node --experimental-vm-modules --test --test-name-pattern="lost OL HTTP response" supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs
```

Final preservation/readback: M65-M72 hashes match §9 and have no tracked Git diff. M73 SHA-256 remains 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82, CREATED_LOCAL / NOT_APPLIED. Local harness syntax, all 12 new-file trailing-whitespace checks and git diff --check passed. Continuity/migration-set passed with 195 definitions, zero duplicates/missing traces, 96 Markdown files / 62 required files. Existing document-size and LF/CRLF advisories are nonblocking; the authoritative/history documents remain cohesive in their recorded responsibilities. The final documentation receipt is validated again before handoff.

No browser initialization, live Auth/inventory/Storage/database write, shared migration application, registry activation, configuration/secret/billing change, staging, commit, push or deployment occurred. Read-only Supabase/Render identity/state preflight and the explicitly authorized memory-only OL diagnostics are the only external service actions in this later readiness session. Tests used mocked mounted controls, recorded HTTP fixtures, ignored build outputs and disposable PGlite databases.

Git remains codex/edition-picker / d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e, 39 modified / 12 untracked / zero staged; earlier local OL implementation paths are preserved. Current-session production/test edits are the five files listed in §11, with current status/source/evidence updates in the existing documents.

Exact next authorized action: extend/run the existing disposable PostgreSQL harness through unchanged M71-M73 to verify physical-receipt replay, lease/policy fencing, concurrent completion/Add and provider disablement; prove the shared one-GET/second behavior under concurrent jobs. The existing native Task 8 evidence stops at M70 and must not be relabelled as M73 proof. Then obtain the separately held browser/workflow and shared application/activation decisions and verify actual Free-plan usage/configuration. Compatible runtime/client rollout, shared security/cleanup/recovery/disablement, requested Luna prepublication review and deployment approval remain separate gates. Deployment stays held.

## 12. Native accounting, actual-start spacing and browser handoff (2026-10-11)

### 12.1 Authority, scope and status

Current status is open_library_native_spacing_locally_verified_browser_pending. The Owner explicitly authorized native PostgreSQL concurrency/accounting proof and request-spacing checks, required a STOP before browser workflow testing with a separate detailed prompt, and required the final Free-plan/configuration preflight here only AFTER that browser report. The measured spacing defect was separately authorized for a bounded local fix with the reply "Yes, fix it locally and verify". Sources remain DOC-3 §5.2.1, picker §§4.3/6–9/13.14, Master MAS-17 and SESSION-START §§5–8; no acceptance ID or provider/cover/ranking rule was added.

Production change is only the Open Library transport scheduler. Exact source/test/harness scope in this checkpoint:
- supabase/functions/_shared/imageInventory/metadata/openLibrary/transport.ts
- supabase/functions/__tests__/phase9_open_library_edition_options.test.ts
- supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1
- supabase/tests/phase9/openLibraryPostgresFixture.mjs (new)
- supabase/tests/phase9/phase9OpenLibraryConcurrency.postgres.mjs (new)
- supabase/tests/phase9/phase9OpenLibraryRequestSpacing.test.mjs (new)

The existing 19 routing/status/source documents, this evidence tracker and the existing browser-prompt artifact were updated for the current handoff. The owning picker/DOC-3 sections clarify enforcement of the existing 1 GET/s rule. Earlier author-budget correction, UI, worker, migration and unrelated paths were preserved; no CJS helper was created.

Fresh Supabase MCP read-only identity/ledger verification returned Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. M72 live version is 20261010200655; the later unrelated library_manual_note_persistence migration 20261010221843 remains. M73 is absent from the live ledger. This was project/ledger verification, not the deferred final Free-plan/configuration preflight.

### 12.2 Confirmed scheduler defect, RED/GREEN and correction

The previous limiter spaced reserved slots before fresh asynchronous authority/registration checks. Different check delays let three jobs actually invoke fetch closer than one second apart. A deterministic regression with delayed fences [1100,0,0] reproduced a 100ms consecutive-start gap before production edits. Its first dynamic-import attempt failed at VM test setup and is not the RED behavior proof; the corrected static-import run failed on the actual spacing assertion.

The Owner-authorized fix holds a FIFO permit through the existing fresh hooks, stamps monotonic performance.now at synchronous fetch dispatch, then releases immediately. It rechecks elapsed time after timer wake-up. A queued cancellation preserves its predecessor chain; proven-unsent cancellation/error releases once without advancing the egress timestamp. Response completion does not hold the permit. Per-GET claim/policy checks, cancellation and immutable physical egress accounting remain in the existing gateway. No migration, timeout/batch/concurrency configuration or service was added.

The original regression passed after the correction. Four further boundary cases cover queued abort without overtaking an active predecessor, fresh-authority failure release, post-registration known-unsent cancellation/reconciliation and subsequent starts before an earlier response finishes. The focused two-OL-suite gate passed 29/29. The exact wider backend command already listed in §9 passed 15 suites / 397 tests, normal exit 0.

### 12.3 Native M73 proof and cleanup

The existing harness adds an opt-in -IncludeOpenLibrary switch. It implies the existing edition-picker/baseline switches and appends unchanged M71–M73 only in that opt-in path. Default-only and edition-picker-only migration lists are unchanged and were inspected, not separately rerun in this checkpoint. The successful opt-in run used actual M01–M62 + M65–M73, with inherited M09 omission and M63/M64 exclusion disclosed. The unchanged inherited suite still prints its historical M65–M70 base banner; the outer harness and new OL banner state the actual M73 stack.

Successful final command:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1 -IncludeOpenLibrary -Port 5460
```

Final exit 0: inherited edition-picker 17/17, new OL accounting/concurrency 11/11, plus inherited U8B acceptance. There were 18 observed transactionid-lock overlaps, 11 inherited and 7 new OL. Each barrier queried the independent contender session and required the exact holder PID in pg_blocking_pids(contender) before COMMIT:

| Scenario | Holder PID | Contender PID |
| --- | ---: | ---: |
| selections | 26804 | 16728 |
| selection-add | 10652 | 11912 |
| add-selection | 10460 | 6980 |
| queued-lookup-add | 24388 | 24800 |
| commit-first | 24468 | 10308 |
| completion-first | 3304 | 8848 |
| lookup-replay | 12808 | 12476 |
| lookup-tap | 19236 | 5320 |
| select-replay | 22772 | 25076 |
| completion-replay | 3800 | 20740 |
| add-replay | 15860 | 7672 |
| ol-register-replay | 900 | 7888 |
| ol-register-conflict | 25988 | 27260 |
| ol-finalize-replay | 15236 | 5320 |
| ol-unsent-relabel | 25620 | 22624 |
| ol-complete-replay | 18444 | 6660 |
| ol-add-first | 19760 | 22148 |
| ol-completion-first | 11476 | 27112 |

OL cases prove identical registration replay, conflicting physical identities at one sequence, immutable finalization, known-unsent relabelling rejection, one persisted completion/consumed logical reservation, both Add/completion race orders with immutable committed metadata, accounted fresh-claim retry after unknown response, lease/policy denial with saved-choice compatibility, cleanup rollback/exact Add retry, and real Owner/tenant/anon/service-role boundaries. Three successful OL GET stages use separate physical receipts; retries keep earlier immutable receipts and one logical usage reservation.

Two test-setup defects were corrected and disclosed before the successful rerun: the initial fixture requested a claim cap of 15 while the real RPC allows up to 10 per claim call; the next run's refresh inherited a completed attempt ID. The fixture now requests 10 and clears attemptId for a new logical refresh, while intentionally retaining it for a retry of the same request. The first run's 11 OL cases failed before registration; the second run passed 9/11 and failed only the refresh-dependent races. No production/migration fix was needed for those fixture errors.

All three disposable runs verified teardown, including failed runs:
- bookconnect_u8b_11936: zero remaining sessions, database removed, cluster stopped, checked temporary directory removed.
- bookconnect_u8b_17072: same complete teardown.
- final bookconnect_u8b_10744: same complete teardown; POSTGRES_TEARDOWN_PASS and harness exit 0.

The existing teardown checks absolute temporary-root containment and rejects a reparse target before recursive removal. No shared database/Storage was used or mutated. Native tests use actual SQL/roles/independent connections over synthetic local records, not live provider responses.

### 12.4 Compiled factory timing and compatible worker persistence

After the final transport edit, the worker strict build passed:
```powershell
node node_modules/typescript/bin/tsc -p workers/phase9-metadata-worker/tsconfig.json
node --test supabase/tests/phase9/phase9OpenLibraryRequestSpacing.test.mjs
node --experimental-vm-modules --test supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --lib ES2022,DOM,DOM.Iterable --moduleResolution node --module commonjs --esModuleInterop --allowImportingTsExtensions --types node,jest supabase/functions/__tests__/phase9_open_library_edition_options.test.ts supabase/functions/__tests__/phase9_open_library_worker.test.ts
```

Results, each normal exit 0:
- Compiled production factory timing: 1/1; three concurrent jobs, six OL GETs each, 18 actual fetch invocations total, 17 measured gaps, minimum 1000.7654ms, maximum 1093.5612ms, configured default 1000ms, Google GETs 0. Fresh pre-request fixture hooks deliberately had unequal delays. All 18 after-request receipts reported attempted egress and finalized outcomes; each job returned a selectable own-edition row.
- Full-M65–M73 PGlite/compiled-worker suite: 25/25, including OL selection/Save/resume/Add replay/cleanup, Google representative-cover compatibility and accounted lost-response fresh-claim retry.
- Whole project no-emit TypeScript, strict OL source/test graph and final worker build: PASS.

The timing proof uses the actual compiled factory/shared limiter with fixture HTTP and deliberately delayed hooks; its timestamps are local fetch invocation boundaries, not packets on a live network or real DB-hook timing. Native tests separately prove the real SQL fences/accounting. The limiter scope is the one existing worker instance/service factory; these proofs do not justify adding replicas or claiming a distributed rate limit. The unchanged UI's prior 23-suite / 355-test mounted evidence remains historical; no UI test/source change or browser rerun occurred here.

### 12.5 Bounded independent correction review and final integrity

The existing available-model read-only correction reviewer found no actionable scheduler or native-proof source defect. It independently ran the five new scheduler cases: 5 passed / 18 skipped, normal exit 0 without forceExit. It independently checked all three new MJS files, the PowerShell syntax parse, whitespace and migration integrity. The 397-test, 25-SQL, 28-native and 18-dispatch timing results above are root execution evidence, not independent full reruns. This local correction approval does not replace the requested GPT-6 Luna/max prepublication review, which remains separately pending at its usage limit.

Independent focused command:
```powershell
node node_modules/jest/bin/jest.js --runInBand --watch=false --runTestsByPath supabase/functions/__tests__/phase9_open_library_edition_options.test.ts --testNamePattern="spaces actual GET starts|cancels a queued permit|releases an unsent request slot|reconciles post-registration cancellation|releases at HTTP start"
```

All M65–M72 hashes match §9; M73 remains 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82, CREATED_LOCAL / NOT_APPLIED. No migration bytes changed. Final branch/HEAD remain codex/edition-picker / d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e, with 40 modified / 15 untracked / zero staged. The checkpoint began 39 modified / 12 untracked; the native harness and three new proof/support files explain that change. Earlier dirty paths are preserved.

A PowerShell prompt-saving attempt failed at parsing a typographic apostrophe before writing; a literal here-string retry succeeded. Final continuity and its migration-set validation passed, exit 0: 195 definitions, zero duplicates/missing traces, 96 Markdown files / 62 required. Tracked diff and all 15 untracked paths passed whitespace checks; the three new MJS files and modified PowerShell harness passed syntax checks. Existing LF/CRLF and document-size advisories are nonblocking. The final documentation receipt is checked again before handoff. No Python tests ran.

### 12.6 Exact next action and gates

Use the [complete independent browser prompt](../work-units/owner-edition-picker-open-library-browser-inspection-prompt.md) in another session. It separates observation of the existing development app from an isolated, network-intercepted fixture workflow using the actual application routes/components/hooks. It explicitly tests first-five/Show all and eligible late ordinals 7/8, own covers/placeholder, all authors/dates/provider links, compact/full layouts, busy/back locking, selling preservation, selection/Save/resume and Add uncertainty/cleanup scenarios. Fixture browser state is not database persistence; the native proof is separate. Shared M73/runtime/activation absence must not force a deployment to manufacture this predeployment inspection.

No browser was initialized, opened or operated in this preparation checkpoint. No provider HTTP, live Auth/inventory/Storage write, shared migration application, registry activation, configuration/secret/billing change, staging, commit, push or deployment occurred. Only the read-only exact-project/ledger checks described above contacted an external service.

STOP here before browser testing. Return that other session's browser report to this session, then conduct the final Free-plan/configuration preflight here. M73 application/readback, compatible client/metadata worker/Owner API rollout, shared provider activation and authenticated workflow/security/cleanup/recovery/disablement, publication approval and deployment remain separate operational gates. Deployment stays held.

## 11. Browser corrections and M73 application checkpoint, 2026-10-12

### 11.1 Authority, correction scope and review

The latest Owner instruction authorizes proceeding with the proposed local corrections and migration preflight/application, while explicitly requiring a stop before Render deployment. This supersedes the older browser handoff and local-only application boundary for this stage. It does not activate OL or authorize a premature Owner API/Render rollout.

Only four additional source/test paths changed in this correction:
- src/features/imageInventory/api/ownerUxTransport.ts: retain the Response receiver with `.call(context)` when decoding HTTP errors; retain strict, operation-specific error redaction and local retryability/message values.
- src/features/imageInventory/screens/CaptureProgressScreens.tsx: retain bulk controls while bulkPending, preserving the frozen command through in-flight eligibility changes and mixed results.
- src/features/imageInventory/components/CandidateMetadataSheet.tsx: opaque theme background beneath the existing gradient, preserving sheet size, scrolling, focus, command locking and selling edits.
- src/features/imageInventory/__tests__/ownerUxService.test.ts: real-Response success-decoding and malformed-JSON regressions.

Sources: picker §§3/6-7 and EP-AC03/19/20; existing Unit 6G bulk identity/replay and automatic-Close rules. No additional Save step, review removal, automatic alternatives acquisition, edition-number editor, provider ranking or representative-cover change is added.

GPT-6 Luna/max returned APPROVED after independently reading these bounded source diffs, governing docs, theme values, coordinator/control lifetime and existing tests. The reviewer ran no tests or browser checks; this is bounded source approval, not an aggregate Open Library prepublication or deployment approval. The original requested aggregate Luna prepublication gate remains separate.

### 11.2 Fresh verification and actual evidence limits

| Gate | Fresh result / stack |
| --- | --- |
| New real-Response regression before production edits | RED: one failure / 15 passes, correct mechanism reproduced |
| Full affected client gate | 25 suites / 379 tests, normal exit 0 |
| Actual-app browser fixtures | Eight cases, eight passes, zero skipped/flaky, normal exit 0; 4.1 minutes |
| Whole no-emit TypeScript | PASS, exit 0 |
| Worker build + structural metadata | PASS + 14/14; historical structural fixture stack, not all-M73 evidence |
| Open Library SQL/compiled-worker integration | 25/25, full M65-M73 suffix over the existing historical harness, normal exit 0 |
| Read-only actual compiled OL adapter | Seven HTTP 200 GETs; minimum observed fetch-start gap 1005.37 ms |
| M65-M72 local bytes / M73 reviewed bytes | All eight prior hashes match §9; M73 unchanged |

The client gate uses the exact 23-path list in §9 plus ownerUxService.test.ts and BatchInventoryCommitControls.test.tsx. The command is unchanged apart from these two additions:

```powershell
node node_modules/jest/bin/jest.js --runInBand --watch=false --silent --runTestsByPath @clientGatePaths
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions
npm.cmd run test:phase9:structural-metadata
node --experimental-vm-modules --test supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs
```

Browser support and screenshots are outside the repo at C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser. Final command:

```powershell
& 'C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect\node_modules\.bin\playwright.cmd' test --config 'playwright.config.ts' --output 'browser-corrected-final-output'
```

The actual Expo app routes, components, services, hooks and HTTP-error decoder ran. Browser contexts intercepted Auth, Supabase APIs, covers, book-link destinations and WebSockets; unexpected external requests were blocked. All eight final cases recorded zero fixture-contract errors and unexpected external destinations. They cover ordered first-five/Show-all choices, own-cover fallback/metadata, selection/reconciliation Close locking and focus, selling-edit preservation and full Save/resume, explicit suggestion confirmation, detected-author reconfirmation, uncertain Add/exact rejected replay/fresh success and independent cleanup, bulk partial success/exact unresolved-only replay/automatic Close, stale-detail denial, keyboard/book link, 390px compact layout and expiry/empty/pending/failure without automatic provider acquisition. This is actual browser UI with controlled responses, not a deployed end-to-end workflow or physical-device/screen-reader proof.

The successful tail was previously unreachable. The first corrected run exposed two temporary harness omissions: an expected full-Add success control disappears after authoritative committed/read-only refresh, and successful bulk completion calls the existing close_scan_session_v3 endpoint. The fixture now models the actual committed/read-only outcome and strictly decoded Close response. These changes were outside the repo; no product behavior was changed to satisfy the fixtures. Initial production-gate timeouts were disclosed: an existing mounted-route test exceeded five seconds in the first five-suite run; the unchanged wider gate passed normally. No timeout/assertion relaxation or forceExit was used. Sandbox EPERM startup required scoped escalation; an incorrect inventory table name in a read-only preflight was corrected to the inspected store_inventory table before application.

The standalone actual-adapter check made three GETs for Confessions of a Philosopher (four returned/eligible own editions, three covers) and four for Pride and Prejudice (ten original positions, seven complete metadata rows, three eligible, two covers). Both were ambiguous_match, requiring Owner choice. No description, raw provider body, returned book metadata or cover file was recorded/persisted. Only query/status/count/retention-deadline evidence was printed. This verifies the live public provider boundary and shared one-second limiter; it does not prove deployed registry/claim/usage behavior. The earlier native 28-case/18-lock-overlap and concurrent 18-start spacing evidence remains unchanged historical proof, not rerun or relabeled here.

One additional exact-primary-flow browser case passed separately: **1/1**, normal exit0 in28.6seconds, zero fixture errors. Starting with no saved selling review and null price/condition defaults, the Owner chose result3, entered₹125, Good condition and quantity2, then clicked Add without any separate Save control/click. The real client automatically sent one update_candidate_review followed by one add_candidate_to_inventory; the payload preserved edition_option/selectionId and chosen title/authors, price12500, quantity2 and conditiongood. The committed card disappeared, its alternatives cleared and the second card's ten alternatives remained. This supplements the unchanged eight-case gate; nine distinct browser cases passed across two commands, not one nine-case run. The new fixture first failed pre-browser strict provenance validation because null defaults were incorrectly labeled default; correcting only those temporary labels to missing made it coherent. No further product source changed.

```powershell
& 'C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect\node_modules\.bin\playwright.cmd' test --config 'playwright.config.ts' --grep 'compact fresh card' --output 'browser-direct-add-final-output'
```

### 11.3 M73 preflight, application and readback

Immediately before application, Supabase MCP reconfirmed Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / org xxbqwluvomrrxeohydis / ACTIVE_HEALTHY / PG17.6.1.063 / ap-southeast-2. M73, its OL registry row and its three columns were absent; M65-M72 and unrelated library_manual_note_persistence history were present. The file again hashed to 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82. Local full-M73 compatibility/security/worker tests passed before DDL.

One apply_migration call succeeded with name marketplace_phase9_open_library_edition_options. Live version: **20261011224457**. History archives one full SQL statement; server SHA-256 equals the reviewed/local file exactly. The three nullable receipt columns, bounded stage/sequence constraint and both unique indexes are present. All six new public/private worker RPCs are postgres-owned with empty search_path and EXECUTE denied to PUBLIC, anon and authenticated; service_role can execute them. The source-policy helper also denies service_role direct execution. Public wrappers remain SECURITY INVOKER, private worker delegates SECURITY DEFINER.

Open Library is installed **enabled=false**, policy_version=1, matching/storage/display capability true, raw_retention_seconds=0, image_cache_allowed=false, attribution required and revalidation_seconds=86400. Existing Google registry values are unchanged. No activation or fabricated Google retention verifier occurred.

Before/after counts and row digests match for books45, candidates173, inventory21 and provider calls149; receipt digests exclude the three newly nullable columns. Provider-call RLS and table ACLs match. No Auth, inventory/business-data or Storage action occurred. The migration is the only shared-state mutation in this checkpoint. Rollback remains disabled provider/route plus forward restoration if needed, preserving selected facts; no destructive down-migration was run.

### 11.4 Preflight limits and exact stop

Fresh Render readback still shows the existing phase9-metadata-worker / srv-d9sqfdvqj5pc73dc66fg in workspace tea-d9j67irtqb8s739ritc0: one Free instance, main, automatic deploy off, unchanged Dockerfile/health contract and live f2d47cb1d015c8b93ded58baff35f125f99ad52c / dep-db5b71ajnfac739scpag. No deployment, new service, plan/instance change, secret edit or billing action occurred.

The initial fresh usage-page creation attempt timed out before attachment. A later read through the existing Codex browser tab succeeded, without changing settings. Final Supabase readback: org quasarsq / xxbqwluvomrrxeohydis / Bookconnect_reactexpo, Free Plan, cycle30Sep-31Oct2026, explicit no-exceeded-quota banner. Database0.29/0.5GB (58%; project276.17MB), egress0.071/5GB, Storage0.016/1GB and Edge invocations16,578/500,000 (3%). The dashboard reports hourly usage refresh; separate instantaneous SQL pg_database_size is274,500,755bytes /261.78MiB. These are distinct measurement/readback values, not a claimed exact conversion or instantaneous dashboard update.

Render's actual billing page for the same selected workspace reports Hobby plan, Free Instance Hours7.07/750 (742.93 remaining), Pipeline Minutes1/500 (499 remaining), services4/25, bandwidth0MB/5GB and month-to-date/projected charges$0.00. The metadata compute service remains Free, one instance, main and automatic deploy off. No plan, card, quota/spending control, settings or deployment action was submitted. The dashboard also displays planned infrastructure maintenance on2026-10-14 at01:00UTC; recheck status if rollout coincides with it. Current quota headroom permits preparing the existing-service release, but this is not deployment approval or shared operational acceptance.

STOP before Render deployment as the Owner instructed. Compatible client, metadata worker and Owner API publication/rollout, aggregate requested Luna prepublication review, synchronized provider activation, authenticated shared workflow/security/cleanup/recovery/disablement and operational rollout acceptance remain pending. Do not deploy Owner API before the compatible worker merely because M73 is installed. The current OL fallback and bounded corrections remain uncommitted; no staging, commit or push occurred here. The exact next authorized action is to report this verified checkpoint and remaining rollout prerequisites; later deployment requires the Owner's separate decision.

Final repository checks: Phase9 continuity/migration-set PASS, exit0, 195 definitions /zero duplicates or missing traceability, 96 Markdown files /62 required; git diff --check PASS. Existing document-size and LF/CRLF advisories are nonblocking. The long trackers retain dated historical evidence and cohesive current responsibility; this session adds current receipts rather than removing acceptance/security/history to meet a line target. Four additional tracked code/test paths plus17 already-dirty documentation paths changed; earlier dirty scope is preserved. Final checkout is codex/edition-picker /d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e, with44 modified /12 untracked status groups (15 actual files) /zero staged. Only ignored build/test outputs and external browser artifacts were additionally generated; no Python tests ran.


## 14. Aggregate review corrections and local M74 checkpoint, 2026-10-12

### 14.1 Authority, source and reproduced defects

The supplied aggregate review reported two P2 defects: malformed edition facts consumed the four-author budget before rejection, and one malformed author response discarded independent complete editions. Both were independently reproduced with the inspected fixture-only probe at C:\Users\user\AppData\Local\Temp\edition-picker-review-probe.mjs against a freshly built worker. The Owner then explicitly answered "Yes, fix both and create local M74". Authority is bounded local implementation, one local forward migration, regressions and correction review; shared application/publication/deployment is excluded for this correction.

Source mapping: DOC-3 §5.2.1; picker §§4.1/5/8-9/13.14 and EP-AC02/04/07/08/12/18; Master MAS-17; SESSION-START §§5-8. This fixes the existing own-edition coherence, independent-row isolation and truthful receipt requirements. No new product acceptance ID, provider/ranking/cover behavior or Owner workflow is introduced.

Only the edition-picker worktree was used: C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect, branch codex/edition-picker, HEAD d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e. The Desktop Unit 6I checkout was excluded. Starting status was 44 modified / 15 untracked actual files / zero staged; a SHA-256 snapshot of all nonignored files was captured before edits.

### 14.2 Exact bounded source/test/validator scope

1. supabase/functions/_shared/imageInventory/metadata/openLibrary/normalizer.ts: share factual validation between allocation and final decoding. Reject malformed factual field types/bounds, incoherent identifiers and malformed present language references before spending author slots. Missing/empty and valid unmapped language references preserve existing und semantics; own author names remain required.
2. supabase/functions/_shared/imageInventory/metadata/openLibrary/adapter.ts: admit whole unresolved distinct-author sets only when they fit the remaining four-key budget. Retain safe identity prioritization and original displayed positions. Isolate only known nonretryable author-content failures; auth/config/policy/transport/retryable/fence/unknown failures still abort.
3. supabase/functions/__tests__/phase9_open_library_author_isolation.test.ts (new): 26 meaningful allocation, factual/language validation, first/last author-content failure, and auth/rate/provider negative regressions.
4. supabase/functions/__tests__/phase9_open_library_edition_options.test.ts: update the own-author-budget regression to its exact five-request paths after atomic row admission; other six-GET and duplicate-reference cap assertions remain.
5. supabase/migrations/20261012000074_marketplace_phase9_open_library_author_isolation.sql (new): only the two existing private completion and stage-registration functions, with the same signatures, empty search paths, authority and service-only ACLs.
6. supabase/tests/phase9/phase9OpenLibraryAuthorIsolation.integration.test.mjs (new): 20 full-M74 positive/mandatory-stage/denial/retry/unknown-egress/provider-disabled/security cases.
7. supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs: install M74, retain the prior 25 cases and add seven actual compiled-worker-to-SQL cases; 32 total.
8. supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1: IncludeOpenLibrary appends M74; default-only and edition-only paths are preserved.
9. supabase/tests/phase9/phase9OpenLibraryConcurrency.postgres.mjs: full-M74 banner and one real failed-author-finalization versus next-stage registration overlap, with partial completion and immutable accounting.
10. scripts/validate-phase9-migration-set.ps1 under this phase: admit only the exact M74 filename with the recorded Owner creation marker; no wildcard/range exception.

No UI source, worker bootstrap, provider transport/scheduler, automatic Google adapter, canonical data or selling-field change was made in this correction. Current routing/status and owning provider/data/security/traceability records are updated in the existing 20 documentation paths; detailed evidence remains here rather than creating another split tracker. Long dated trackers remain cohesive continuity/history records; no required evidence was removed for size.

### 14.3 Historical local M74 creation ledger and read-only shared audit (application superseded by §15)

| Item | Exact evidence |
| --- | --- |
| Local filename | supabase/migrations/20261012000074_marketplace_phase9_open_library_author_isolation.sql |
| Status / live version | CREATED_LOCAL / NOT_APPLIED; no live version |
| SHA-256 | FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 |
| Creation authority | Owner's explicit 2026-10-12 "Yes, fix both and create local M74" |
| Verified project | Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / org xxbqwluvomrrxeohydis / ACTIVE_HEALTHY / PG17.6.1.063 / ap-southeast-2 |
| Read-only tools | Supabase MCP get_project and execute_sql; no migration/write call |
| Latest related live migration | M73 / 20261011224457; archived SQL hash 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82 matches unchanged local M73 |
| Shared OL state observed | open_library metadata v1.0.0 / policy1 / enabled=false; factual matching/storage capabilities installed |
| Objects replaced locally | marketplace_sec.phase9_complete_candidate_edition_options_v1; marketplace_sec.phase9_register_edition_options_provider_call_v1 |
| Schema/business/registry effects | No tables/columns/indexes/DTOs, data rewrite, registry activation or ACL expansion; public wrappers remain intact |
| Application authority | None in this correction; fresh preflight and separate application decision required |

M74 permits continuation/completion only after an exact author stage at sequence 2-5 with a finalized, known attempted-egress, nonretryable receipt whose outcome is malformed_response, unsupported_content_type or response_too_large; existing no_acceptable_match handling remains. Completion still validates every non-null own-record snapshot and derives the logical result from validated rows. The last author may fail without erasing independent rows. The original failure receipt is not relabelled as success.

Mandatory search/editions content failures, retryable/unknown outcomes, auth/config/policy/availability failure, unknown or proven-unsent egress, stale/reclaimed authority and incompatible lineage remain blocking. Google completion retains its existing final-outcome guard. Claims, ownership, sequence/stage caps, one logical reservation, retention deadlines, selection/Add and replay are preserved.

Applied M65-M73 are immutable and retain their hashes. M74 must be installed with OL disabled before the corrected worker is activated. Older compatible workers remain valid; the new partial-result worker must not be activated over the old M73 guards. Rollback is operational disablement/halt new OL claims followed, if needed, by a separately reviewed forward restoration paired with a compatible worker. Preserve receipts, chosen facts and inventory; no destructive rollback, migration edit or data deletion.

### 14.4 Fresh verification, failures and practical limits

| Gate | Final observed result |
| --- | --- |
| Initial allocation/content TDD | 19 cases: 16 failed / three passed before the responsible fixes |
| SQL continuation TDD against M73 | Six positive author-content cases failed / 12 negative cases passed before M74 |
| Follow-up allocator/language TDD | Four failed / 22 passed before whole-row admission and malformed-present-language fixes |
| Final focused author/adapter/worker Jest | Three suites / 55 tests PASS; normal exit 0 |
| Final backend/provider/worker/contracts Jest | 16 suites / 423 tests PASS; normal exit 0 |
| Full-M74 SQL + actual compiled worker | Two suites / 52 cases PASS; 20 new SQL cases plus upgraded 32-case integration; normal exit 0 |
| Native PostgreSQL IncludeOpenLibrary | 17 inherited edition cases + 12 OL cases = 29 PASS; 19 observed independent-connection lock overlaps; normal exit 0 |
| Final compiled-factory spacing | 1/1 PASS; three jobs / 18 actual fixture fetch starts; minimum gap 1001.7304ms, maximum 1071.3971ms; interval1000ms, Google GETs0 |
| Whole no-emit and strict OL source/test TypeScript | PASS, normal exit 0 |
| Final worker build / structural metadata | PASS + 14/14 historical structural fixture cases; normal exit 0 |

The 52-case gate was rerun after the final adapter/normalizer build. It installs the existing historical commit fixture plus M70-M74, so its full edition suffix is M65-M74; it is sequential PGlite/fixture HTTP, not race or live-provider evidence. Native IncludeOpenLibrary actually installs M01-M62 plus M65-M74, with inherited M09 omission and M63/M64 exclusion. The inherited EP8 module's M65-M70 banner is legacy text; the harness and OL module state the actual M74 stack.

Every observed native overlap checked a transactionid lock and exact holder PID in pg_blocking_pids(contender) before release. The added author-content continuation case observed holder23584 -> contender13516, retained the malformed_response receipt, permitted the next author stage after commit, completed independent coherent rows, and consumed one logical reservation. The other 18 established selection/Add/replay/stage/accounting overlaps retain their native proof; SQL/ACL/claim fences were unchanged after the last two TypeScript allocation/language fixes.

Native teardown verified zero sessions before DROP, absence of bookconnect_u8b_25168, stopped cluster, removed checked temporary directory C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-25168 and POSTGRES_TEARDOWN_PASS. No shared database/Storage/Auth was used or mutated.

The first 52-case rerun passed45/failed7 because new assertions expected providerRecordId on the Owner-safe reader. Those assertions were corrected to its actual safe book link/authors; no production contract was widened. Existing private selected_option_snapshot assertions remain valid. The first wider Jest run after atomic admission passed54/failed1 due to the old six-GET expectation; it now checks the exact five admitted-request paths. No production fix, assertion relaxation or timeout increase was used to mask these fixture issues.

The final spacing proof uses the real compiled factory/shared limiter and deliberately delayed fixture hooks, not live network packets. No actual provider request occurred in this correction. Prior eight-case browser/379-client evidence remains dated historical evidence in §11; those unchanged UI gates, physical devices, shared workflow, deployment and live operational cleanup/security/rollback were not rerun here. No whole-repository Jest or Python tests ran.

### 14.5 Exact reproducible local commands

Use only the absolute edition-picker worktree and local fixture/disposable services.

~~~powershell
$backendGatePaths = @(
'supabase/functions/__tests__/phase9_metadata_edition_options_worker.test.ts',
'supabase/functions/__tests__/phase9_metadata_environment.test.ts',
'supabase/functions/__tests__/phase9_google_books_edition_options.test.ts',
'supabase/functions/__tests__/phase9_metadata_edition_options_recovery.test.ts',
'supabase/functions/__tests__/phase9_edition_picker_gateway.test.ts',
'supabase/functions/__tests__/phase9_open_library_edition_options.test.ts',
'supabase/functions/__tests__/phase9_metadata_worker.test.ts',
'supabase/functions/__tests__/phase9_edition_picker_contracts.test.ts',
'supabase/functions/__tests__/phase9_google_books_edition_options_review.test.ts',
'supabase/functions/__tests__/phase9_metadata_production_gateway.test.ts',
'supabase/functions/__tests__/phase9_google_books_adapter.test.ts',
'supabase/functions/__tests__/phase9_metadata_production_composition.test.ts',
'supabase/functions/__tests__/phase9_metadata_edition_options_rpc.test.ts',
'supabase/functions/__tests__/phase9_metadata_provider_adapter.test.ts',
'supabase/functions/__tests__/phase9_open_library_worker.test.ts',
'supabase/functions/__tests__/phase9_open_library_author_isolation.test.ts'
)
node node_modules/jest/bin/jest.js --runInBand --watch=false --silent --runTestsByPath @backendGatePaths
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --lib ES2022,DOM,DOM.Iterable --moduleResolution node --module commonjs --esModuleInterop --allowImportingTsExtensions --types node,jest supabase/functions/__tests__/phase9_open_library_edition_options.test.ts supabase/functions/__tests__/phase9_open_library_worker.test.ts supabase/functions/__tests__/phase9_open_library_author_isolation.test.ts
npm.cmd run test:phase9:structural-metadata
node --experimental-vm-modules --test supabase/tests/phase9/phase9OpenLibraryEditionOptions.integration.test.mjs supabase/tests/phase9/phase9OpenLibraryAuthorIsolation.integration.test.mjs
node --test supabase/tests/phase9/phase9OpenLibraryRequestSpacing.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1 -Port 5460 -IncludeOpenLibrary
powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1
git diff --check
~~~

Root logs and SHA snapshot are temporary non-repository evidence under C:\Users\user\AppData\Local\Temp\bookconnect-author-isolation-20261012. Final backend, structural, SQL and spacing logs are backend-final.log, structural-final.log, sql-current.log and spacing-current.log; native-final.log records actual overlap/teardown. Root successful commands ended normally without forceExit. Scoped sandbox escalations allowed the authorized worktree writes and disposable checks; no automatic approval rejection or external write occurred.

### 14.6 Correction review provenance and exact next action

The requested subagent was explicitly configured gpt-6-luna with max reasoning. It independently reviewed the bounded source/test/M74 scope, found the related partial-fit and malformed-present-language holes, and later required the stale own-author request-count assertion correction. Root reproduced and fixed these at the responsible layer before the final pass.

Final bounded verdict: APPROVED, no actionable defect. The reviewer independently reran three focused suites / 55 tests and the 20-case M74 SQL suite, both normally passing. It confirmed unchanged M74 and applied M73 hashes and made no edits or external actions. The tool exposed the requested model/effort configuration, not independently inspectable underlying runtime identity. Root's 423-test, 52-SQL, 29-native and final spacing results are separate root evidence, not claimed independent full reruns.

This approval does not replace the independent aggregate Open Library prepublication review or authorize shared application/deployment. The exact next authorized action is that read-only GPT-6 Luna/max aggregate review of the final diff and evidence. Then address any confirmed findings before a separately decided fresh M74 application preflight/readback, supported client and compatible Owner API/worker rollout, controlled activation and authenticated shared acceptance. Keep OL disabled and STOP before Render deployment as requested. Free-plan service/instance limits and the earlier usage warnings remain rollout gates; this correction changes no account plan, service, key, instance count or polling setting.

### 14.7 Final integrity and closeout

The final preservation audit, syntax/continuity/migration-set/whitespace checks and exact dirty-file counts are recorded below after the documentation receipt. No file was staged, committed, pushed or deployed. No shared migration was applied in this correction; M74 remains local/unapplied and M65-M73 remain preserved.

Final root receipt: continuity and migration-set validation PASS, normal exit0; 195 requirement definitions, zero duplicate/missing traceability, 96 Markdown files / 62 required phase files. Tracked diff, all 18 actual untracked files' trailing whitespace, three MJS syntax checks and both modified PowerShell parses PASS. Existing line-ending and cohesive-document-size advisories are nonblocking.

The initial Node syntax attempt was prevented before file parsing by sandbox EPERM; the same scoped read-only checks passed on authorized escalation. Two tool-command composition attempts failed before execution and made no file changes. No rejected approval, external write, Python test or shared/runtime/browser/provider action occurred.

Preservation audit: 1,549 baseline nonignored files snapshotted; 1,522 remain byte-identical. Exactly 27 authorized existing paths changed and three authorized new paths were added, with no missing/unexpected path. This correction's 30 paths comprise 20 documentation records and ten source/test/migration/validator paths. All M65-M73 local hashes match the baseline and recorded checkpoints; M74 retains FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3.

Final checkout: codex/edition-picker / d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e; 44 modified / 18 untracked actual files / zero staged. Existing unrelated dirty work is preserved. No staging, commit, push, deployment, shared migration application, provider activation, Auth/inventory/Storage or configuration/secret/billing mutation occurred in this correction. M74 remains CREATED_LOCAL / NOT_APPLIED; M65-M73 remain applied/preserved and shared OL remains disabled.

Independent documentation/validator closeout: APPROVED, no actionable inconsistency. The same configured GPT-6 Luna/max reviewer checked current overlays, §14, DOC-3 §5.2.1, picker §13.14, owning pipeline/data/security/audit/traceability records and the exact M74 allowlist. It confirmed M73's applied state, M74's local/unapplied state, disabled OL, accurate author-only receipt/security boundaries and the unchanged aggregate-review/application/Render hold gates. It reran no checks in this documentation pass, relied on the recorded root continuity receipt, and made no edits or external actions. This is bounded closeout approval, not aggregate publication or deployment approval.


## 15. M74 preflight application and live readback, 2026-10-12

### 15.1 Current authority and bounded stage

The Owner selected "authorized M74 preflight/application." and explicitly requested completion. This is separate application authority after §14's approved local correction, superseding only the earlier NOT_APPLIED gate. It does not authorize publication, OL activation, browser/provider calls or Render/Owner API deployment. Phase 9 / Unit 6G remains active; current status is open_library_m74_applied_verified_render_held.

The same verified worktree, branch and HEAD were used: C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect; codex/edition-picker; d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e. Source, test, migration and prior dirty work bytes were preserved; only the required 20 documentation records changed in this application stage. Governing requirements remain DOC-3 §5.2.1, picker §§5/9/13.14, Master MAS-17 and SESSION-START §§5-8.

### 15.2 Fresh preflight

Supabase MCP get_project verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / org xxbqwluvomrrxeohydis / ACTIVE_HEALTHY / ap-southeast-2 / PG17.6.1.063 before preparation and again immediately before application.

Read-only execute_sql evidence:
- Latest related live migration was M73 / 20261011224457, with archived SHA-256 2356AF57A05DD015C584C0F888CE9570783EB2C96D63D88D45FF4AFA94738C82 matching the immutable local M73 file. M74 was absent.
- Both target live function bodies matched the actual reviewed M73 baseline after CRLF-to-LF normalization. Signatures, owner postgres, SECURITY DEFINER, empty search_path and service-only EXECUTE were verified. Anonymous/authenticated execution was false.
- Google remained enabled; OL v1.0.0 / policy1 remained disabled, with factual matching/storage flags intact. No unresolved OL attempt and no OL physical call existed.
- Three explicit edition jobs were observed: two resolved and one in_progress. The latter's lease expired at 2026-10-12T00:17:04.710671Z. This stale job was observed/preserved; no recovery, cancellation or state rewrite was performed.
- Before counts: books45, store_inventory21, candidates173, provider_calls149.
- Provider-call columns, RLS, table ACLs and policies plus 19 related function definitions/security metadata were snapshotted for comparison.

Fresh focused disposable command:
~~~powershell
node --experimental-vm-modules --test supabase/tests/phase9/phase9OpenLibraryAuthorIsolation.integration.test.mjs
~~~
Result: 20/20 PASS, normal exit0, before live application. This exercises the full M65-M74 edition suffix on the historical commit fixture, including partial author-content continuation/completion, mandatory-stage/retry/denial/unknown-egress negatives, disabled-provider and service-only boundaries. It does not mutate shared data or replace a shared workflow/race/browser acceptance gate. Wider local §14 gates remain dated evidence and were not repeated.

A local baseline-extraction attempt initially required OR REPLACE and therefore stopped on M73's plain CREATE registration definition; the corrected optional pattern extracted exactly two bodies. A first tool-result parser matched the warning's inline tag and stopped; the bounded JSON-array parser succeeded. Both failures preceded any mutation. An initial read-only multiple-SELECT result exposed only its last result; the preflight was reissued as one JSON evidence object so every check could be inspected.

### 15.3 Current M74 application ledger

| Item | Exact evidence |
| --- | --- |
| Local filename | supabase/migrations/20261012000074_marketplace_phase9_open_library_author_isolation.sql |
| Migration name | marketplace_phase9_open_library_author_isolation |
| Status / live version | APPLIED_VERIFIED / 20261012140853 |
| Project | Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn |
| Application authority | Owner's current explicit request to complete M74 preflight/application |
| Applied SQL SHA-256 | FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 |
| Application tool/result | Supabase MCP apply_migration, exact reviewed file / success=true |
| Application attempts | One; no blind retry |
| Shared mutation | Two private function replacements and unchanged service-only grants, plus migration ledger entry |
| Unperformed actions | No table/data rewrite, provider activation, runtime deployment, browser/provider request, Git publication, Auth/inventory/Storage or account/configuration mutation |

Immediately before the application call, the local file hash was read again and matched. The SQL was loaded directly from the local reviewed file without rewriting/adding statements; its transactional BEGIN/COMMIT and forward-only compatibility/rollback comments remain byte-preserved. M65-M73 files and prior unrelated live migration history were preserved.

### 15.4 Live readback and integrity

Read-only readback at 2026-10-12 19:39:51 IST (14:09:51.433799Z) confirmed:
- M74 is in supabase_migrations.schema_migrations at version 20261012140853. Archived full SQL hash equals the reviewed local file.
- Exactly the two intended private function bodies changed. Their normalized body hashes match the reviewed M74 definitions:
  - phase9_complete_candidate_edition_options_v1: 7F28FFC27FB710F8B8B165B655181478C40EBA490E028E2089ECD4D58A247318.
  - phase9_register_edition_options_provider_call_v1: F9659C4C77245A358C03FCC61AE983C2864A5173A8C5EB10D7BDFCC77936BB85.
- Their signatures, owners, security mode, empty search paths and ACLs are unchanged: service-role EXECUTE retained; anon/authenticated EXECUTE denied.
- All 17 other related functions in the preflight snapshot, including public wrappers, failure/recovery/finalization, existing guards and Owner request, are byte/metadata-identical. This comparison is the enumerated related snapshot, not a claim about every database object.
- Provider-call columns/RLS/table ACLs/policies and Google/OL provider flags are unchanged. OL remains disabled.
- Books45, inventory21, candidates173, provider_calls149; edition job statuses remain two resolved/one expired-lease in_progress. There are still zero OL physical calls. Counts are a bounded before/after observation; the reviewed DDL itself contains no business-data mutation.

No service completion/selection/Add was called against shared records to manufacture live functional proof. Local §14 fixture/native evidence establishes the command behavior; application readback establishes the installed functions/security. Provider activation, deployed end-to-end behavior and operational lifecycle acceptance remain distinct gates.

Rollback/disablement is unchanged and unexecuted: keep OL disabled/halt new OL claims; if restoration is needed, review a forward function restoration paired with a compatible worker. Preserve all receipts, chosen facts and inventory. Never modify an applied migration or destructively drop data.

### 15.5 Handoff and pending gates

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence, preserving bounded correction provenance. M74's application gate is complete; no further M74 creation/application request is pending. Supported client, compatible metadata worker/Owner API, final Free-plan/configuration recheck, separately authorized provider activation, controlled authenticated shared workflow/security/cleanup/recovery/disablement and rollout acceptance remain pending. STOP before Render deployment.

The applied state is synchronized in DOC-13, ACTIVE, Phase 9 TRACKER/SESSION-START/README/master, owning provider/data/security/traceability/audit records and detailed evidence. Earlier local-only creation/review sections are historical. The exact-file migration validator remains valid under the recorded original creation authority; no validator/source/test/migration edit was needed for application.

No staging, commit, push, deployment or business-data/Storage/Auth mutation occurred. The only shared mutation is the one authorized M74 DDL application and its migration ledger. Local status remains 44 modified / 18 untracked actual files / zero staged on the same branch/HEAD. Final documentation validation and migration-hash readback are recorded after this receipt; no new code/browser/worker/provider test is implied.

Final application closeout: Phase 9 continuity/migration-set PASS, normal exit0; 195 definitions, zero duplicate/missing traceability, 96 Markdown files / 62 required. Tracked diff and all 18 untracked files' whitespace PASS. Fresh M65-M74 local hash readback matches every recorded value; migration/source/test bytes were preserved. Branch/HEAD and 44 modified / 18 untracked / zero staged counts are unchanged. Exact next action remains the read-only aggregate prepublication review; OL is disabled and the Render deployment stop remains in force. Only the one authorized M74 shared DDL/ledger application occurred.

## 16. Fresh predeployment browser checkpoint (2026-10-12)

### 16.1 Authority, checkpoint and scope

The Owner explicitly requested this fresh local browser checkpoint from the edition-picker worktree and required a stop before deployment. The scope allowed a local Expo preview, the existing isolated nine-case browser suite, and Phase 9 evidence updates. Shared Auth/inventory/Storage writes, provider activation or requests, migration application, deployment, and Git publication were not authorized.

Verified checkout: C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect; branch codex/edition-picker; HEAD d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e. Full untracked status: 44 modified, 18 untracked actual files, zero staged. Existing work was preserved. The node_modules path was a physical directory at this run, so the ordinary Expo CLI command was used; no Metro/Babel/package/environment file or launcher was changed.

The exact Supabase project was read-only verified through Supabase MCP as Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY. The preview received the verified project URL and enabled legacy anon key through process-scoped environment, development mode, and DEV_SKIP_AUTH=false. No key was put in a source file, shell log, screenshot, or evidence document. Handling deviation: the first masking pass did not parse the MCP response's nested JSON text and the public anon key appeared once in the tool output. No service-role or other privileged key was retrieved.

This work follows SESSION-START §§6/8 and the existing edition-picker browser acceptance in tracker 37 §§11/14/15 and the supplied inspection prompt. It adds no product requirement or acceptance criterion.

### 16.2 Preview and source provenance

Port 8083 had no preview before startup. The exact command from the checkout was:

npm.cmd run web -- --port 8083 --clear

Environment was set only in the launched PowerShell process. The managed command session is 32257 and the final local HTTP health check returned 200 at http://localhost:8083. The sandbox did not expose an owning PID through Get-NetTCPConnection, so no PID is claimed. The preview was left running.

The scan-route HTML returned HTTP 200 and referenced /node_modules/expo-router/entry.bundle. The JavaScript bundle returned HTTP 200 at 15,995,219 characters. It contains CandidateEditionPicker, EditionOptionList, Search Books, confirmedByOwner, and the intended Supabase origin. Its source map contains 2,770 sources; edition-picker worktree source paths are present and Desktop Bookconnect app/src paths are absent. No source/configuration changes were needed. Expo printed dependency patch-version, stale Browserslist, and Tailwind at-rule warnings during the initial build; compilation and browser tests completed.

### 16.3 Actual Codex in-app browser observation

Codex in-app browser opened the supplied scan route. The actual app rendered the existing five-detection session, with one active candidate and detected title/author/language. That candidate showed Metadata failed. Opening Change edition displayed the existing Searching books… state and detected details. The explicit Search Books control was not pressed; no edition selection, Save, or Add command was sent. This was a read-only observation of current session state, not a provider or inventory acceptance test. No Auth/inventory/Storage write occurred.

The page screenshot was reviewed in the tool output. The eight persistent Playwright screenshots are saved in the fresh result directory listed below.

### 16.4 Fresh isolated browser gate

Harness sources were read from:

C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser

The command ran from that artifact directory with the installed checkout runner and a new output directory:

& 'C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect\node_modules\.bin\playwright.cmd' test --config 'playwright.config.ts' --output 'C:\Users\user\.codex\visualizations\2026\10\12\01a130a6-dca6-7472-88b4-b91718ad3056\edition-browser-fresh-20261012-1791819226742-i61knw' --reporter=list

An initial sandboxed runner attempt exited 1 before test discovery with EPERM resolving C:\Users\user. The authorized scoped retry ran the same suite without changing timeouts, assertions, retries, or fixture behavior. Result: nine passed, zero failed, zero skipped, normal exit 0 in 2.1 minutes. The exit code and console log are saved as playwright-exit-code.txt and playwright-console.log in the new result directory. The artifact REPORT.md and prior result directories were preserved.

Fixture installation precedes login and navigation in all nine cases. Auth, Supabase REST/Functions responses, covers, Open Library destinations, and Supabase WebSockets were intercepted; unexpected hosts were aborted. Each case's fixture failure assertions remained empty: no fixture-contract errors or unexpected external requests were recorded. The tests execute the real Expo routes, components, hooks, API clients, and error handling. All API responses, command outcomes, and persistence are synthetic.

Fresh cases passed:
- First five options and Show all ten; order, duplicates, covers/placeholders, full authors, date, publisher, ISBN, and language.
- Selection locks Close/Escape through read reconciliation; selling values survive selection and full review Save/resume.
- Current suggestion confirmation and detected-detail/author reconfirmation.
- Single Add uncertainty, exact replay, authoritative rejection recovery, successful cleanup of only that card's alternatives.
- Bulk partial success, retained retry, unresolved-only replay, successful-card cleanup.
- Stale detected details, keyboard focus, and intercepted provider link.
- 390 × 844 compact layout, scrolling, late option selection, and independent selling edits.
- Fresh-card primary flow: edition and selling details then Add without a separate Save click.
- Pending, empty, failed, and expired results preserve the current choice without automatic provider lookup.

### 16.5 Visual review and actionable finding

All eight screenshots were opened and inspected visually:
- full-first-five.png and full-late-editions.png
- full-selected-resumed.png
- full-add-recovered.png
- bulk-partial-success.png
- compact-narrow-editions.png
- compact-add-without-save.png
- failed-keeps-current-choice.png

P3 visual finding: after a full-review reload/resume, the Change edition trigger appears as an approximately 150-pixel-high outlined box with only its label at the top, leaving a large empty region and pushing review fields down. Reproduced in full-selected-resumed.png. The shared trigger sets flexBasis: 150 in MetadataSheetTrigger.tsx:12; in the full-review column layout that basis controls height. Compact layout remains usable. This is report-only; no product source was changed.

Screenshots:
- C:\Users\user\.codex\visualizations\2026\10\12\01a130a6-dca6-7472-88b4-b91718ad3056\edition-browser-fresh-20261012-1791819226742-i61knw\edition-browser-full-revie-805f1-Save-resume-selling-details\full-selected-resumed.png
- C:\Users\user\.codex\visualizations\2026\10\12\01a130a6-dca6-7472-88b4-b91718ad3056\edition-browser-fresh-20261012-1791819226742-i61knw\edition-browser-compact-na-fb3b2-and-independent-second-card\compact-narrow-editions.png
- C:\Users\user\.codex\visualizations\2026\10\12\01a130a6-dca6-7472-88b4-b91718ad3056\edition-browser-fresh-20261012-1791819226742-i61knw\edition-browser-bulk-Add-p-d0377-nly-the-unresolved-identity\bulk-partial-success.png

### 16.6 Evidence boundaries and handoff

The passing suite is real-browser UI evidence with simulated service responses and persistence. It does not verify deployed Open Library/Google search, live edition selection, Save/resume, single/bulk Add, expiry, cleanup, recovery, screen-reader behavior, or physical-device layout against deployed services. Open Library remains disabled. M74 remains APPLIED_VERIFIED as 20261012140853. Render deployment remains held.

No product source, migration, dependency, package, Metro/Babel setting, credential, Auth account, inventory, Storage object, or provider state was changed. No stage, commit, push, deploy, or migration application occurred. Generated browser evidence lives in the fresh visualization result directory; the preview remains in managed session 32257.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review using this browser report and existing Open Library evidence, then the final Free-plan/configuration preflight. Stop before Render deployment.


## 17. GPT-6 Luna/max aggregate review completed, 2026-10-12

### 17.1 Scope, route and verdict

The Owner selected the pending Luna/max aggregate signoff action. The parent dispatched a fresh isolated read-only reviewer explicitly configured gpt-6-luna / max to inspect the entire current later Open Library working-tree aggregate against HEAD, including untracked source/tests/M73/M74 and relevant original picker dependencies. The completed verdict is CHANGES_REQUIRED for one confirmed native cover-cache P2. No other actionable P1/P2 was found. This completes the requested model-specific aggregate REVIEW; publication readiness remains blocked on its finding, rather than on an unperformed aggregate review.

The configured tool route is evidence of the requested model/effort assignment; underlying runtime identity is not independently exposed. Earlier original-picker publication approval, other-model aggregate findings and bounded M74 correction approval retain their distinct provenance. The prior two P2 author-allocation/isolation defects were corrected and remain approved; this is a new integration issue.

Review checkout: C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect; codex/edition-picker; d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e; 44 modified /18 actual untracked /0 staged. All commands used this exact root; the Desktop checkout was excluded. The reviewer made no source/test/migration/document edit or external action.

### 17.2 Confirmed finding and separate known P3

P2: src/features/imageInventory/components/MetadataCover.tsx:12-14 passes a remote cover URI to Expo Image with no cachePolicy. The installed Expo Image type contract documents the default as disk (node_modules/expo-image/build/Image.types.d.ts:156-169). New OL edition rows use this shared render path. M73's registry seed explicitly denies OL image caching (image_cache_allowed=false at lines7-9). Security SDD §8 says mobile clients cannot widen adapter image-cache rights; picker §13.14 limits OL retention to factual metadata/direct URL, not image files. Therefore the new native OL display path permits disk caching despite that denial.

The parent independently confirmed the exact component, installed SDK default, M73 flag and Security §8 text. This is a native render-policy mismatch, not observed browser-cache persistence, a claim of a live data leak, or a new product requirement. The remedy is explicit enforcement of the OL no-cache restriction at the cover render path while preserving existing Google behavior. A conservative client denial may be used without widening rights or changing applied SQL; any broader DTO/schema proposal must justify its need separately.

Known P3: MetadataSheetTrigger's global flexGrow1/flexBasis150 creates the full-review 150px-high outlined trigger (§16 screenshot/source). It remains uncorrected and separate; the reviewer did not treat it as a blocker for local source-publication readiness. Correcting the layout would preserve the compact row behavior and the existing minimum touch target.

No product correction was made in this read-only review. Both items are handed off for a bounded client correction and focused proof/review; no automatic full-review repetition is needed unless the correction introduces wider integration changes.

### 17.3 Fresh independent gates and limits

| Gate | Actual independent result |
| --- | --- |
| Exact client25-path Jest gate | 25 suites /379 tests PASS, normal exit0, no competing compiler/Jest |
| Exact backend16-path Jest gate | 16 suites /423 tests PASS, normal exit0 |
| Whole no-emit and strict three-file OL TypeScript graph | Both PASS, normal exits0 |
| Worker build and structural metadata | PASS +14/14 structural cases |
| Upgraded full-M74 OL32-case suite +20 author-isolation cases | 52/52 PASS, normal exit0 |
| Compiled factory request spacing | 1/1 PASS;18 starts over3 jobs, min1003.3132ms/max1083.8132ms, zero Google GETs |
| Native PostgreSQL IncludeOpenLibrary | 17 inherited +12 OL =29/29 PASS;19 observed independent-connection overlaps |
| Continuity and migration-set, including direct migration validator | PASS;195 definitions,0duplicates/0missing,96Markdown/62required |
| Tracked/untracked whitespace and syntax | PASS;18 untracked paths, five MJS parses, both modified PS1 parses |
| Reviewer final integrity | 71/71 snapshot files unchanged; all M65-M74 hashes match; same branch/HEAD/status |

The client and initial syntax attempts failed before discovery/parsing with sandbox Node EPERM. Exact scoped retries passed; no test assertion, timeout, retry count or forceExit was changed. Whole TypeScript completed normally after approximately three minutes with no diagnostics. No unrun gate is implied.

Native stack: M01-M62 with inherited M09 omission, plus M65-M74, excluding M63/M64. The reviewer inspected the teardown guard before execution: new temp cluster, no reuse, zero remaining sessions before DROP, database absence verified, cluster shutdown verified, and only a resolved non-reparse bookconnect-u8b-pg- directory beneath the temporary root can be recursively removed. Root also inspected the recorded19 overlaps and final teardown: bookconnect_u8b_10708 removed, cluster stopped, checked C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-10708 removed, POSTGRES_TEARDOWN_PASS.

These are actual disposable SQL/native connection proofs with synthetic records and provider fixtures. The reviewer did not rerun the browser; §16's9/9 actual-browser cases retain simulated API/persistence provenance. Native device/image-cache behavior, live providers, deployed runtime and shared workflow/retention/security/rollback acceptance remain operational gates.

### 17.4 Auditable evidence and preservation

Independent reviewer evidence:
C:\Users\user\AppData\Local\Temp\bookconnect-ol-aggregate-luna-20261012-213806\aggregate-review-evidence.txt

Native command output:
C:\Users\user\AppData\Local\Temp\bookconnect-ol-aggregate-luna-20261012-213806\native-postgres-review.log

Pre-review snapshot:
C:\Users\user\AppData\Local\Temp\bookconnect-ol-aggregate-luna-20261012-213806\before.json

The reviewer and parent both compared the71 protected paths before parent evidence updates: zero changed/missing. Root rechecked44modified/18untracked/0staged and independently read native overlap/teardown output. The parent's subsequent changes are limited to16 already-existing continuity/owning documentation files recording this verdict; source, tests and applied migrations remain byte-preserved. Ordinary ignored build/cache and authorized temporary evidence/disposable DB outputs are distinct from repository edits.

M65-M74 remain applied/byte-preserved; M74 stays live20261012140853 and its local hash remains FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3. No migration application or provider/registry/runtime/configuration/account change was performed. OL stays disabled and Render remains held. Cached local origin/main equals this HEAD (0/0 divergence); no fresh remote fetch/publication was performed by this review.

### 17.5 Current handoff

The aggregate review is complete with its findings recorded. Exact next action: present the confirmed P2 and known P3 with the bounded client correction scope, then carry out the correction's focused verification/review before publication readiness and final Free-plan/configuration preflight. Do not label the earlier aggregate review as still unrun or require a duplicate full gate without new scope/failure evidence.

Only evidence documentation changed after the read-only review. No source/test/migration edit, stage, commit, push, deployment, shared database/Auth/inventory/Storage/provider mutation or plan/secret change occurred. STOP before Render deployment. Final documentation validation and exact preservation are recorded after this receipt.

## 18. Bounded client corrections, selected tests and browser rebuild, 2026-10-12

### 18.1 Scope and RED/GREEN

The Owner requested rebuilding/testing and explicitly limited verification to selected tests followed by rebuild and browser testing. This continues §17's confirmed P2/P3 handoff under Security §8 and picker §§3/13.14. No new requirement, permission, provider policy or schema is introduced.

Exactly three source files changed:
- src/features/imageInventory/components/MetadataCover.tsx: parse the URL hostname and set Expo Image cachePolicy=none for covers.openlibrary.org, including mixed case/default ports. Other providers retain the earlier undefined cache policy; error placeholders remain. The shared boundary covers option rows, held metadata and scan thumbnails.
- src/features/imageInventory/components/MetadataSheetTrigger.tsx: default natural height/minimum48px, with optional ordinary caller styles.
- src/features/imageInventory/components/BatchReviewCard.tsx: retain flexGrow1/flexBasis150 only at both compact-row trigger call sites; full-review columns no longer receive150px height.

Exactly two existing test files changed:
- src/features/imageInventory/__tests__/EditionOptionList.test.tsx: actual image-prop cache denial, Google preservation, mixed case/port, replacement and image-error fallback.
- src/features/imageInventory/__tests__/ownerEditionPickerMounted.test.tsx: actual full trigger sizing/opening and both compact trigger layouts.

Before production edits, two selected suites reproduced four intentional assertion failures: missing OL cachePolicy at the option row/two URL variants and full-review flexBasis150. RED result4failed/14passed/18total, exit1.

~~~powershell
& .\node_modules\.bin\jest.cmd --runInBand --runTestsByPath src/features/imageInventory/__tests__/EditionOptionList.test.tsx src/features/imageInventory/__tests__/ownerEditionPickerMounted.test.tsx
~~~

GREEN command:
~~~powershell
& .\node_modules\.bin\jest.cmd --runInBand --runTestsByPath src/features/imageInventory/__tests__/EditionOptionList.test.tsx src/features/imageInventory/__tests__/ownerEditionPickerMounted.test.tsx src/features/imageInventory/__tests__/ownerEditionPickerSheetStates.test.tsx
~~~

Result3suites/29tests PASS, normal exit0,17.088s. No full Jest, whole/strict TypeScript, worker build, SQL/native PostgreSQL or provider gate was repeated, following the Owner's current scope. Existing Node DEP0040 advisory remained.

RED/GREEN logs and65-file parent baseline:
C:\Users\user\AppData\Local\Temp\bookconnect-client-correction-ebe838973d1644b4a991c6c5e4c5297a\selected-red.log
C:\Users\user\AppData\Local\Temp\bookconnect-client-correction-ebe838973d1644b4a991c6c5e4c5297a\selected-green.log
C:\Users\user\AppData\Local\Temp\bookconnect-client-correction-ebe838973d1644b4a991c6c5e4c5297a\before.json

### 18.2 Rebuild and actual-browser evidence

The correct-worktree localhost8083 preview was reused. Loading its bundle rebuilt the changed development source. The existing public frontend configuration was read only from that already-served local bundle, checked for anon role/project ref and supplied only in the export process environment. No value was printed or put in an env/source/configuration file. No privileged key, Auth bypass or shared-service request was used.

~~~powershell
npm.cmd run export:web -- --output-dir 'C:\Users\user\AppData\Local\Temp\bookconnect-client-correction-ebe838973d1644b4a991c6c5e4c5297a\web-export'
~~~

Web export PASS, normal exit0:2690modules,69assets, one5.81MB JavaScript entry plus CSS; index.html, picker/project/cover-policy markers verified. Existing Browserslist/Tailwind/NO_COLOR/Babel advisories did not block compilation. This build is distinct from a fresh typecheck. Log: C:\Users\user\AppData\Local\Temp\bookconnect-client-correction-ebe838973d1644b4a991c6c5e4c5297a\web-rebuild.log.

A copy of §16's nine-case browser harness was made outside the repository at C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336. The copy adds actual trigger-height assertions before selection and after resume, plus a measurement attachment. Existing timeouts/retries and synthetic service semantics were retained. Compiler/Jest jobs were finished before browser execution.

~~~powershell
& 'C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect\node_modules\.bin\playwright.cmd' test --config 'C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\playwright.config.ts' --output 'C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\browser-output'
~~~

Result9passed/0failed/0skipped/0flaky, exit0,163.444s(2.7m), one worker. Actual Expo routes/components/hooks/clients were exercised, with intercepted provider/Auth/Supabase responses and simulated command persistence. Unexpected hosts/sockets remained blocked. No deployed workflow result is implied.

Cases cover first5/Show all10 and metadata/covers; selection/reconciliation and selling-edit resume; current/detected confirmation; single Add uncertainty/rejection/success; bulk partial-success replay; stale details/focus/provider links;390px compact scrolling/late selection; direct compact details/Add without a separate Save click; empty/pending/failed/expiry.

Measured resumed full trigger:x20/y132/width1400/height48. The prior150px blank area is corrected. Parent visually inspected resumed-full and narrow-compact screenshots.

Report/console/exit:
C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\results.json
C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\browser-console.log
C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\browser-exit-code.txt

Screenshots:
C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\browser-output\edition-browser-full-revie-805f1-Save-resume-selling-details\full-selected-resumed.png
C:\Users\user\.codex\visualizations\2026\10\05\01a10b33-57e0-78c2-be60-8b92f3a6f384\edition-browser-client-correction-1791824373336\browser-output\edition-browser-compact-na-fb3b2-and-independent-second-card\compact-narrow-editions.png

Preview remains running at localhost8083. A request to show the existing live scan route in Codex returned queued; opening a tab is not additional visual verification.

### 18.3 Bounded review, preservation and handoff

GPT-6 Luna/max returned APPROVED for these corrections, with no actionable issue. It compared exactly the five source/test deltas against the65-file baseline and verified M73's cache deny, Security§8 and picker§13.14. This review was read-only/source-based without independent test/build/browser reruns. It resolves the earlier P2 and separate P3; no new aggregate or operational approval is claimed.

Parent rechecked all ten M65-M74 hashes against the original aggregate71-file baseline:zero changed. No migration, worker/provider ranking/representative cover, dependency, preview restart, registry activation or shared database/Auth/inventory/Storage/configuration/billing/deployment change occurred. Sixteen existing owning/routing/evidence documents were updated to supersede the resolved blocker. The long provider tracker remains cohesive rollout/evidence history; no size-only split was made.

Checkout remains codex/edition-picker at d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e;47modified/18actualuntracked/0staged. All work remains uncommitted. Nothing staged, committed, pushed or deployed. OL remains disabled per the prior verified ledger; Render deployment remains held. Native device cache behavior and deployed/live workflow/cleanup/security/rollback remain operational gates.

Exact next authorized action: final read-only Free-plan/configuration preflight and report readiness; STOP before Render deployment. Closeout continuity/whitespace and exact preservation are recorded after this entry.

Final closeout: continuity PASS, exit0,195 definitions/0duplicates/0missing traces,96Markdown/62required. Tracked and all18untracked whitespace PASS. Parent baseline comparison shows exactly5source/test and16documentation changes; all other protected files and all10migration hashes are preserved. Final branch/HEAD and47modified/18untracked/0staged confirmed. No further product test or external action followed. Continuity log: C:\Users\user\AppData\Local\Temp\bookconnect-client-correction-ebe838973d1644b4a991c6c5e4c5297a\closeout-continuity.log.

## 19. Owner-authorized local commit and Free-plan review waiver, 2026-10-12

The Owner requested: proceed with the commit, and explicitly skip the Free-plan preflight. That waiver replaces the current planned quota/billing-plan review only. It does not change worker request limits, provider permissions, project identity or rollout ordering. Configuration verification still means the correct project/environment, compatible worker/API/client settings and safe provider activation order. Render deployment remains held.

Scope is exactly65 reviewed paths:47modified/18untracked before staging; no Desktop checkout changes. The aggregate review and bounded GPT-6 Luna/max correction approval in §§17-18 remain applicable. Fresh precommit integrity compares the original aggregate snapshot and permits only the five already-reviewed client source/test corrections; all other reviewed source and ten applied migration bytes remain preserved. No product test/build/browser/native/provider gate is rerun for a documentation/Git checkpoint. §18 records actual selected29/29, web export exit0 and browser9/9 fixture evidence, with operational limits intact.

Local commit subject: feat(inventory): add Open Library edition lookup. The exact path list and hash manifest are saved in C:\Users\user\AppData\Local\Temp\bookconnect-ol-commit-2c8b7670aee544b1b4d9cbe4b67752cf. Only this manifest may be staged; no universal add, sibling worktree, ignored output, environment file or secret is included. The commit receipt will be recorded after Git confirms success. No push, deployment, migration/provider activation or shared-service mutation belongs to this step.

Commit receipt: feature d04a333206efac257cd55b2bfd224d1cf57d236d was created successfully on codex/edition-picker, parent d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e, exactly65verified paths,5416insertions/63deletions,18previouslyuntracked paths included. Git confirmed zero staged/modified/untracked paths immediately afterward. Scope excludes the Desktop checkout and ignored outputs. The first stage attempt had a Windows argument-tokenization error, stopped before staging or commit, and succeeded after quoting the pathspec argument; no approval restriction was bypassed.

This follow-up records the actual feature SHA and the Owner's Free-plan-review waiver in16 existing routing/owning/evidence documents. It introduces no source/test/dependency/migration change. Precommit continuity PASS,195definitions/0duplicate/0missing; exact scope and staged whitespace PASS. No product tests/builds/browser/provider/native gates were repeated. No remote fetch/push, merge, rollout, database/Auth/inventory/Storage/configuration/billing mutation occurred. Runtime deployment remains held; existing shared application/disabled-provider status is unchanged. Next: reconcile current remote main and publish the reviewed checkpoint under existing authorization; configuration compatibility remains required before activation, with Free-plan review skipped.

Receipt closeout: continuity PASS, exit0; exact16-document scope verified. The following documentation-only commit preserves the entire feature source tree. Git log/status provide its final receipt. No product verification or external action followed.

## 20. Read-only configuration and compiled live-provider proof, 2026-10-13

The Owner asked whether the work can be pushed and later redeployed, and whether meaningful predeployment proof remains. The parent completed targeted configuration and live-adapter checks before publication. This follows the existing rollout and provider contract; no product decision/schema/permission is introduced. The explicit Render hold remains. Free-plan quota/billing review was skipped at the Owner's request; instance topology was inspected only because the shared per-process limiter depends on it.

### 20.1 Fresh configuration readback

- Supabase MCP get_project: Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY. list_migrations confirms M73=20261011224457 and M74=20261012140853, alongside earlier picker migrations. No migration was applied/reapplied.
- Bounded registry SELECT: Google and OL adapter1.0.0/policy_version1; OL enabled=false, matching/storage/public display allowed, image caching denied, attribution required, revalidation86400s, raw retention0. These unchanged values are fresh observations, not activation authority.
- get_edge_function: phase9-owner-ingestion ACTIVE v15, verify_jwt=true,35 returned files; no returned source contains OL markers. Updated compatible source still needs deployment after worker readiness.
- Render get_service/list_deploys: exact phase9-metadata-worker/srv-d9sqfdvqj5pc73dc66fg, workspace tea-d9j67irtqb8s739ritc0, branchmain, autoDeploy=no, Docker context., Dockerfile ./workers/phase9-metadata-worker/Dockerfile, default Docker CMD, /health, one instance. Current live commit f2d47cb1d015c8b93ded58baff35f125f99ad52c. No service/setting/secret was changed.
- Local git diff confirms environment.ts and metadata Dockerfile unchanged between that live revision and the reviewed feature. No new required environment name is introduced; retain the existing google_books bootstrap mode. OL explicit-search routing uses the registry/adapter, not a new provider-mode environment value. Secret values were not retrieved or compared.
- One initial /health GET timed out after30s. Subsequent /ready returned200/ready and one bounded /health retry returned200/alive. Cause of the initial timeout was not proved. These are old-process checks, not OL job/database or newly deployed readiness proof.
- git ls-remote: main and codex/edition-picker still d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e. Local source commit d04a333 is its descendant; publication can fast-forward if those refs remain unchanged. No fetch/push/merge occurred.
- Existing two repository workflows were inspected for deployment commands; publication triggers validation, not the held runtime deployment. CI after publication remains pending.

### 20.2 Actual Edge graph compilation

~~~powershell
& 'C:\Users\user\scoop\apps\deno\current\deno.exe' check --no-lock --config supabase/functions/phase9-owner-ingestion/deno.json supabase/functions/phase9-owner-ingestion/index.ts
~~~

PASS, normal exit0, no diagnostics/source/lock change. This checks the actual deploy entrypoint's reachable graph and adds proof not supplied by the browser mocks. No worker/full-repository/Jest/SQL/browser gate was repeated.

### 20.3 Compiled adapter against real Open Library

One read-only lookup used the existing compiled OpenLibraryEditionOptionsAdapter and buildMetadataQueryIdentity, for the generic public title Oliver Twist/Charles Dickens/en with no ISBN clue. The production transport, normalizer, factual validation and shared1s limiter were used. HTTP hooks/DB persistence were absent in this standalone adapter probe; its count is not a production SQL usage-accounting receipt.

Result: normal exit0; six requests (search, editions, four author records), allHTTP200/application-json. Ten original positions0-9;2eligible,4ineligible,4unavailable;6own metadata snapshots and2cover references. The adapter returned ambiguous_match/nonretryable because title-author alternatives require Owner choice, not an automatic ISBN selection. Existing factual retention policy yielded storagePermissionVerified=true and the24h permitted deadline. No new rights/permission grant is inferred from this check.

fetchedAt=2026-10-12T18:32:10.380Z (00:02 IST on13October); permittedDeadlineAt=2026-10-13T18:32:10.380Z. No provider raw bodies, descriptions, actual image files, author names/edition payloads or private credentials were written to logs/docs. Only status/count/flag evidence was retained. Zero Google requests, zero shared writes; OL registry remains disabled.

This proves a real response passes the compiled adapter for this sample. It does not prove every book returns10 selectable editions or the deployed Owner/API/worker persistence path. Prior native SQL/compiled worker/accounting/request-spacing and nine-browser fixtures retain their separate provenance. Actual Owner Search/select/Add and cleanup/recovery remain the post-activation check.

Evidence:
C:\Users\user\AppData\Local\Temp\bookconnect-config-check-2ed2a95c444a4b1ea2248b8fae83a1b4\owner-edge-deno-check.log
C:\Users\user\AppData\Local\Temp\bookconnect-config-check-2ed2a95c444a4b1ea2248b8fae83a1b4\live-open-library-adapter.log
C:\Users\user\AppData\Local\Temp\bookconnect-config-check-2ed2a95c444a4b1ea2248b8fae83a1b4\configuration-summary.txt

### 20.4 Preservation and next gate

No source/test/dependency/migration/env/configuration edit, privileged-key retrieval, provider activation, worker job invocation, Auth/inventory/Storage/billing or runtime deployment occurred. The source tree equals feature d04a333. Only seventeen existing owning/routing/audit/evidence documents record this checkpoint; its Git receipt will be documentation only. No Free-plan inspection or new service was performed.

Exact next authorized action: reconcile/publish the reviewed commit under the existing Owner authorization, wait for GitHub source CI, then report the exact manual compatible worker/API rollout while keeping OL disabled. STOP before Render deployment. Publication/CI and the final one-card live Owner workflow after authorized activation remain gates; no guarantee of never needing a later deployment is made.

Configuration closeout: continuity PASS/exit0,195definitions/0duplicates/0missing traces; exact17-document scope and feature-source preservation verified. The following Git receipt is documentation only; no publication, activation or deployment is included.

## 21. Owner-authorized publication and successful CI, 2026-10-13

### 21.1 Immutable review and publication receipt

The Owner requested proceeding with reviewed commit publication. The parent retained the explicit instruction to STOP before Render deployment. GPT-6 Luna/max performed a bounded post-commit attestation at 96bcdde9abc39c15675c19fa763971ce208e9828 and returned APPROVED. Feature d04a333206efac257cd55b2bfd224d1cf57d236d contains the implementation and already approved corrections; 02485f3 and 96bcdde contain documentation only. The reviewer checked both saved snapshots, found only the five previously approved client source/test deltas, no missing snapshot paths, and no unapproved product changes. This attestation ran no tests/build/browser/provider/native or live-service checks.

Fresh git status was clean; branch/HEAD matched. Both remote refs read d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e, an ancestor of the reviewed HEAD. The authorized git push --atomic origin HEAD:refs/heads/main HEAD:refs/heads/codex/edition-picker completed normally, with no force, merge, rebase, or Desktop checkout action. Both remote refs read back exactly 96bcdde9abc39c15675c19fa763971ce208e9828. All earlier main commits are retained by this fast-forward.

### 21.2 Actual GitHub result

[Clubs and shared app validation, run 38295345765](https://github.com/mdasheef99/Bookapp_reactexpo/actions/runs/38295345765) completed with conclusion success for head_sha 96bcdde9abc39c15675c19fa763971ce208e9828. Its job and every command passed: locked npm dependency installation, repository Jest tests, TypeScript and production Expo web export. The push-triggered run started at 2026-10-12T19:05:46Z and completed at 2026-10-12T19:08:59Z (13 October IST). GitHub CI is fresh verification; no corresponding broad local gate was repeated.

Only the existing main-push app workflow was triggered. The separate worker-container workflow does not trigger on ordinary main pushes; its absence is not represented as a new container-smoke pass. Prior worker build, native race/accounting, compiled spacing, adapter, and fixture-browser evidence retain their recorded provenance. CI does not establish deployed Owner/API/provider behavior.

Publication metadata, before-document hashes, exact sixteen-document manifest and CI receipt are saved in C:\Users\user\AppData\Local\Temp\bookconnect-ol-publication-1fb41e081adc4fd2bf458980c047759c. An initial documentation update stopped after one current-state header because another document had a different historical next heading; no product or Git state changed. The correction validates every current-state boundary before writing, then applies only the same sixteen planned documentation updates.

### 21.3 Preserved rollout boundary and next action

This step publishes Git refs and runs GitHub CI only. No source/test/dependency/migration/environment edit, shared database/Auth/inventory/Storage write, provider activation, Render/Supabase runtime deployment, service-setting/secret/billing change, or preview restart occurred. M65-M74 remain applied and byte-preserved; no migration was reapplied. Open Library stays disabled. Render autoDeploy was last verified off in section 20; no deployment API was called. The Free-plan review is explicitly waived.

This follow-up publication receipt is documentation only. Before committing it, verify exact changed-path scope, identical source/test/dependency/migration tree, continuity and whitespace; record those actual results below. Publish this receipt through a non-force fast-forward, preserving the same reviewed and CI-validated product source.

Exact next authorized action: report the rollout for the Owner's deployment decision and STOP before Render deployment. The concrete pending order is:
1. Manually deploy the existing metadata worker from the validated source, then check readiness and worker/RPC compatibility with Open Library still disabled.
2. Deploy the compatible phase9-owner-ingestion Edge and client, preserving the existing project, authentication and worker startup configuration.
3. After explicit provider activation authority, enable the already permitted OL provider and verify one actual Owner search, selection and Add, with cleanup/recovery evidence.

These steps remain pending. The existing explicit deployment hold has not been lifted. A successful live workflow is required before operational completion; no guarantee of never needing a later correction/deployment is made.

Publication closeout: mandatory continuity PASS/exit0, 96 Markdown files/62 required; exact sixteen-document scope PASS, no unexpected untracked paths, product tree identical to GitHub-validated 96bcdde, all ten M65-M74 hashes identical to the original aggregate snapshot, and whitespace PASS. Only existing line-ending/document-size advisories were emitted. No local product gates were rerun; GitHub supplied the fresh repository test/type/export result. This documentation-only receipt is committed and then published through the same ordinary atomic fast-forward process; Git and remote readback provide its actual receipt. The source remains unchanged. Final rollout authority remains STOP before Render deployment.

## 22. Owner-authorized Render deployment, 2026-10-13

### 22.1 Authority, target and fresh preflight

The Owner requested: proceed with the Render deployment. This lifts the earlier explicit Render hold for the existing metadata service; it does not enable Open Library or authorize a database mutation. The parent used the purpose-built Render MCP rather than browser controls. No browser workflow was run.

Preflight reverified the clean edition-picker worktree at 76348f3076a641d1a2dd6d5cdd6ab439b46da8da; both remote main and codex/edition-picker matched. The immutable Luna/max approval remains applicable and GitHub run 38296368634 completed success at that exact SHA. No source/test/dependency/migration change or repeated local gate was introduced. Relevant bootstrap, Dockerfile, runtime admission/readiness and picker section 13.14 were inspected.

Fresh Render get_service/list_deploys confirmed phase9-metadata-worker/srv-d9sqfdvqj5pc73dc66fg, workspace tea-d9j67irtqb8s739ritc0, repository Bookapp_reactexpo, branch main, autoDeploy=no, Docker context ., metadata Dockerfile, default CMD, /health and one instance. No other deployment was active. Prior live deploy was dep-db5b71ajnfac739scpag at f2d47cb1d015c8b93ded58baff35f125f99ad52c.

Fresh Supabase MCP get_project confirmed Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY. list_migrations confirmed all ten picker migrations M65-M74; M73 live version 20261011224457 and M74 20261012140853 remain present. A bounded registry SELECT confirmed Google enabled and OL disabled, both policy version 1, with the previously verified storage/display/cache/attribution flags unchanged. No privileged key was retrieved; the existing startup contract requires no new environment name or provider-mode switch.

### 22.2 Single deployment and exact live receipt

One Render trigger_deploy call used the exact existing service/workspace and clearCache=false. It returned dep-db6jc5rl550s73b6i0m0, build_in_progress, with the expected commit 76348f3076a641d1a2dd6d5cdd6ab439b46da8da. Subsequent readbacks observed update_in_progress and then live. There was no redeploy, cache purge, rollback or new service creation.

Created: 2026-10-12T19:33:43.816420Z. Finished LIVE: 2026-10-12T19:34:45.843113Z (13 October IST). Build logs include the actual npm run build:phase9:metadata-worker step. Final get_deploy again matched LIVE and the exact reviewed SHA. Final get_service confirmed the checked technical configuration unchanged.

[Render metadata service](https://dashboard.render.com/web/srv-d9sqfdvqj5pc73dc66fg). The deployed source is [76348f3](https://github.com/mdasheef99/Bookapp_reactexpo/commit/76348f3076a641d1a2dd6d5cdd6ab439b46da8da); the rollout receipt is local documentation only.

### 22.3 Focused post-deployment proof

Actual unauthenticated HTTPS probes returned:
- GET /health: 200, status alive.
- GET /ready: 200, status ready.
- POST /run with an empty JSON body and no token: 403, error forbidden.

The negative ingress probe rejects before the handler or queue claim; no authenticated run, provider request, logical usage reservation, inventory or candidate action was sent. Runtime logs show service_started at 19:34:42Z, the expected unauthorized denial and a ready result. Two invalid-route 404 denials were also observed; their sources were not investigated. No startup_failed event or runtime failure was observed in the fourteen returned recent log entries.

The metadata readiness callback returns true after valid environment/bootstrap startup. Consequently /ready is a process check, not SQL/provider/accounting or an authenticated job-completion test. The native DB/worker/accounting, live standalone adapter and fixture-browser evidence retain their previous independent scopes. No new end-to-end operational approval is claimed.

The post-deployment registry SELECT is byte-equivalent to the preflight row array: OL enabled=false, Google enabled=true, all policy and permission flags unchanged. M65-M74 remain byte-preserved; no migration was applied/reapplied.

Evidence is saved in C:\Users\user\AppData\Local\Temp\bookconnect-ol-render-deploy-e088713cf45e4629b4dd69a08b2a5522. Service/deploy readbacks and logs were consumed through MCP; only safe deployment/probe summaries are written locally. No secret, environment file, raw provider body or image is retained.

### 22.4 Scope, documentation and next gate

Changed external state: exactly one existing Render metadata-worker deployment. No service settings/secrets, provider flags, billing/quota review, Supabase functions/migrations, shared database/Auth/inventory/Storage or client/preview process changed. The Owner's Free-plan review waiver remains in effect; instance topology was read only to verify the existing per-process limiter assumption.

Sixteen existing routed documents replace the superseded current Render-hold header and record this rollout. This session leaves only those documentation edits uncommitted; it does not stage, commit or push. No product source/test/dependency/migration file is changed. The mandatory continuity/whitespace and exact-scope results are recorded at closeout.

Exact next action: report the verified metadata deployment and proceed to the compatible phase9-owner-ingestion Owner API/client rollout under its applicable authorization. Open Library remains disabled until compatible runtime/client and controlled activation gates are satisfied. The real authenticated Owner search/selection/Add/cleanup/recovery check remains pending. There is no need to create or reapply a migration for this deployment.

Deployment documentation closeout: continuity PASS/exit0; 96 Markdown files and 62 required files. Exact sixteen-document scope PASS; zero staged/untracked paths, unchanged product source at 76348f3, and all ten M65-M74 hashes preserved. The final evidence footnote changes no acceptance definition or trace. Final whitespace and Git status are checked after this note. No local product gate was rerun: immutable successful CI and the actual Render build/startup/HTTPS proof are the verification for this unchanged runtime source. Final state is sixteen modified documentation paths only; no stage/commit/push. The single Render deployment and no other shared mutation are recorded above. Next remains the compatible Owner API/client rollout and controlled live provider workflow; OL is disabled.

## 23. Owner API deployed and verified, 2026-10-13

The Owner requested proceeding with the next backend step and later resumed the interrupted turn. Exact checkout remains codex/edition-picker at published/CI-passing 76348f3076a641d1a2dd6d5cdd6ab439b46da8da, with the sixteen earlier Render documentation edits preserved. Fresh Supabase project and migration readbacks confirmed Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY and M65-M74 present. Render deployment dep-db6jc5rl550s73b6i0m0 remained LIVE at the same reviewed source.

Actual Deno check passed with no source/lock edit. Its complete local dependency graph contained 37 TypeScript modules plus the import map: 38 files, 187144 UTF-8 bytes. The package and SHA-256 manifest were prepared in memory/from the approved checkout, without a helper source file, .env file, credential retrieval or product edit.

### 23.1 Incident and successful deployment

The initial get-function bundle calls and MCP deployment returned Supabase internal errors. Metadata readbacks confirmed version 15 ACTIVE/JWT enabled unchanged. A CLI fallback was first rejected locally for mutually exclusive flags before deployment; the corrected --use-api invocation uploaded assets but received HTTP500/internal error, again without a published version change. No successful extra version is claimed; failed asset uploads may have left platform-managed transient artifacts.

The official Edge Function Degradation incident reports impaired deployment and function-body retrieval in ap-southeast-2 and other regions:
https://status.supabase.com/incidents/01M4RTJRV55MN1WZDT7KTSAKK5
Its observed symptoms match both independent failures. Local Docker was not running, so no Docker bundling or software update was attempted. On resumed work, Supabase reported reduced errors, current version was still15, project/worker/source/provider checks passed, and one bounded MCP upload succeeded.

Result: existing function f8aec89f-ae2a-431a-8a97-5775a2405b90 / phase9-owner-ingestion ACTIVE version16, verify_jwt=true. Entrypoint phase9-owner-ingestion/index.ts and import map phase9-owner-ingestion/deno.json were uploaded with all relative dependencies. No secrets, other functions, registry policy, migration or Render configuration changed.

### 23.2 Exact source and live probes

Post-deployment get_edge_function returned35 served files. Every served runtime file matches the reviewed upload after CRLF normalization. The three absent files are metadata.ts, providerReuse.ts and domain/isbn.ts; graph traversal confirms they are type-only dependencies, not missing runtime code. Actual runtime closure is35 including the import map. No unexpected omission/content mismatch remains.

HTTPS OPTIONS returned200/ok; POST without credentials returned401/Missing authorization header. These admission checks do not prove authenticated selection/Add. Actual Codex browser control then worked: the existing authenticated scan displayed one review card and four already-added books; the metadata/edition reader loaded the remaining Confessions of a Philosopher card.

The user tab contained an old dev/Metro script and reported disconnection. Reload exposed the stopped preview. The parent restarted the already-tested export from the client-correction evidence at localhost8083, managed command session96852, with a Node inline static server restricted to loopback; no new .cjs/helper, dependency, source or environment file. The artifact has the intended project/picker/Open Library/cache-denial markers. A fresh Codex tab loaded the real authenticated scan from that export. The old error-page tab rejected further navigation under Browser Use URL policy; a fresh tab in the same selected browser restored normal access.

No browser mocks, auth bypass, new provider request, selection, review save or Add were used. The actual edition reader reports pending for the old request documented below; this is live read evidence, not successful provider/selection/Add evidence. Picker polling was stopped by closing the sheet after capture.

Evidence: C:\Users\user\AppData\Local\Temp\bookconnect-ol-owner-api-e6a9a9c54f824e53b021b409e79c9518
Includes Deno/graph logs, upload SHA manifest, CLI error log, official incident HTML and legacy-pending-lookup.png. No credential values were printed or written.

## 24. Confirmed exhausted legacy request and bounded correction proposal

Sources: Pipeline section10 persistent jobs/recovery; picker sections4.3/5/9 and Master MAS-17. The five-attempt limit and controlled Owner retry are existing requirements, not new feature scope.

Live candidate f387251c-5479-449b-aa53-83a47bced16e in session93567d47-3874-4576-b3b4-1adb044b552b still references job4ffe137d-5ff5-4ef6-9a24-27a2911c027c. Job kind metadata_enrich, entity candidate, operation p9-owner-edition-options-v1, status in_progress, attempt_count=5/max_attempts=5, lease expired at2026-10-12T00:17:04.710671Z, no recorded safe failure. Candidate version1/metadata_revision4/review_versionNULL; request_generation0/options_version0/no stored alternatives. The underlying cause of the old worker abandonment is not established.

Fresh function readbacks prove both has_claimable_phase9_work and claim_phase9_metadata_jobs require attempt_count<max_attempts. They cannot wake/reclaim this exhausted request. Current choices/receipt status mapping reports in_progress as pending, and the existing request path treats it as already pending. M72 cannot retire it because the card still points to the same request and no valid fresh claim can be acquired. This explains the actual infinite Searching books label; no manual row reset or stale-claim replay was attempted.

Proposed M75 only: make exhausted expired edition requests report failed, and let the initiating Owner's explicit fresh-search command retire that unclaimable request and create at most one fresh request through existing version/idempotency/ownership checks. Preserve selection/selling metadata, original claim/audit/physical-call/usage records and retained permitted options; do not reset attempt counts, reuse stale tokens, send HTTP from SQL, relax lease or permission checks, or broaden automatic lookup behavior. Keep read-only reads free of job mutations. Exact helper/delegate changes must be verified against live signatures before implementation.

Focused proof must cover expired fifth attempt, active fifth lease, reclaimable earlier attempt, wrong Owner/card/generation, command replay/concurrent fresh requests, chosen/selling preservation, and late stale completion. Review precedes a fresh exact-project preflight and conditional application. The existing API/client protocol remains unchanged; no Render/API rebuild is required.

Proposed filename: 20261013000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql. M75 is PROPOSED / NOT_CREATED / NOT_APPLIED; no migration file or SQL mutation has occurred. The repository entrypoint separately gates file creation and live application. Owner authorization is requested for that exact correction workflow.

Current mutations: one successful Owner API deployment to version16 and a local preview restart. No registry activation, shared job/metadata/selection/inventory/Auth/Storage mutation, migration, commit/push or additional Render deployment. M65-M74 and all product files are preserved. Only the sixteen existing routed documentation paths are updated; they remain uncommitted.

## 25. Owner-authorized Open Library activation and old-scan closure, 2026-10-13

### 25.1 Current authority and sources

The parent recommended enabling the deployed explicit-only Open Library route and testing a fresh photo through Search Books, selection and private Add, leaving M75 deferred. It asked for that exact activation/live-test authority because the pasted handoff had explicitly held those actions. The Owner replied "ok". This is the controlling later decision. The earlier instruction "we will close this session and try again" is implemented as normal scan-session closure, not chat closure or data deletion. No renewed authority to create/apply M75, publish Git changes, redeploy, publish inventory, reset jobs or change provider permissions is inferred.

Sources: picker SDD §13.14 and DOC-3 §5.2.1 for explicit routing/retention; Unit 6G SDD §§14/23, U6G-AC13/18/20 for manual partial Close and read-only history. Existing requirements/acceptance definitions are unchanged.

### 25.2 Fresh preflight and bounded configuration mutation

- Exact worktree: C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect, codex/edition-picker, HEAD 76348f3076a641d1a2dd6d5cdd6ab439b46da8da. Sixteen inherited documentation modifications, zero staged/untracked files; executable source/tests/dependencies/migrations still match HEAD.
- Supabase MCP get_project reverified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ap-southeast-2, ACTIVE_HEALTHY. M73/M74 remain present at 20261011224457 / 20261012140853; M75 is absent. Render remains LIVE at 76348f3, dep-db6jc5rl550s73b6i0m0, existing service/workspace, one instance/main/autoDeploy off. Owner API remains ACTIVE v16, verify_jwt=true. No billing/quota review was repeated.
- Before: google_books enabled=true, open_library enabled=false; both adapter 1.0.0 / policy_version1. OL matching/storage/public display true, attribution true, image cache false, revalidation 86400 seconds, raw retention zero.
- One conditional, row-locked UPDATE changed only OL enabled=false -> true and updated_at. It required the exact installed flags/version and synchronized Google policy version. Receipt returned changed_rows=1 and other_fields_preserved=true. Timestamp: 2026-10-12T22:05:26.434106Z / 2026-10-13 03:35:26 IST.
- A separate SELECT confirmed both providers enabled, OL raw retention zero/image cache false/attribution true, zero OL physical-call rows at that checkpoint and the original exhausted job unchanged. No provider HTTP invocation, candidate mutation, migration or runtime deployment was part of activation. The Google alternatives retention implementation/evidence gate remains unresolved; activation supplies the already-approved independent OL route.
- One earlier read-only preflight query failed with 42P01 after incorrectly naming phase9_metadata_attempts. No mutation was involved. M73 references established the actual relation metadata_enrichment_attempts; the corrected readback succeeded. No credentials or raw provider payloads were fetched/printed/retained.

### 25.3 Actual browser and normal old-scan Close

The Codex in-app browser uses the tested static export at localhost:8083 with the existing authenticated account. Root navigation initially opened My Library; the known Owner scan URL and observed Inventory href restored the Owner surface. No rebuilt bundle, environment/helper file, dependency installation or login was required.

The actual session summary displayed five detected books, four private committed items and one missing review. The normal Close warning explicitly states the remaining card becomes read-only and already-added inventory stays intact. One normal Close confirmation was accepted. The actual UI then showed Session state: closed and the preserved-history explanation. A displayed screenshot records this visible result; no durable screenshot file was created.

Supabase readback: session93567d47-3874-4576-b3b4-1adb044b552b is status closed, version3, closed_at2026-10-12T22:08:44.023344Z / 2026-10-13 03:38:44 IST. All five candidate IDs/states/versions/committed-inventory links match the pre-Close read. The four linked store_inventory rows still exist. The unfinished candidate remains needs_review/version1 with no inventory link, now protected by the closed-session lifecycle fence. Job4ffe137d-5ff5-4ef6-9a24-27a2911c027c remains in_progress/5 attempts of5; no manual repair, reset, reuse or delete occurred. Closing the scan is not an exhausted-job recovery fix.

### 25.4 Fresh-photo handoff and exact remaining scope

Actual Inventory now exposes Start scan. The authenticated fresh setup at http://localhost:8083/inventory/scan is prepared with memory-only development defaults: label Edition picker live test; location Phase9 proof shelf; English hint; Good; INR25; Private; one copy per detected book. Start scanning was not submitted. No new photo was supplied, so no fresh session/image/Storage/provider/selection/Add action was performed. The browser tab is marked for the next turn.

Next exact authorized action: receive the Owner's new photo, submit one fresh scan through the normal UI, wait for actual processing, explicitly Search Books on a fresh card, inspect real OL eligibility/metadata/covers/attribution, select the intended book, retain selling values, Add privately, and verify the authoritative inventory and alternatives cleanup. Existing authority persists across turns. A new photo and real results are required; no fixture-browser/process-health/activation-only operational PASS is claimed. M75 recovery remains a deferred residual defect, including for any future exhausted request.

Changed external state in this checkpoint: one provider-registry configuration update and one authenticated normal Close of the existing scan. No new inventory/candidate/image was created or deleted, no Storage object changed, and no migration/deployment/stage/commit/push occurred. Sixteen existing routed documents prepend this checkpoint while preserving prior evidence. Product source, tests, dependencies and M65-M74 remain unchanged. Closeout validation results are recorded after the mandatory documentation/whitespace checks.
Activation/Close documentation closeout: Phase 9 continuity PASS/exit0; 96 Markdown files/62 required files; 195 requirement definitions, zero duplicates/missing traceability; regression probes PASS. Repository whitespace PASS, product paths changed0, staged0, untracked0, with only the same sixteen documentation paths modified. Existing LF/CRLF and document-size advisories remain; these status updates and provider/Close receipts belong to their existing routed responsibilities, so no unrelated split or required-content pruning was performed. No product/Python test suite was rerun for unchanged executable source. Supabase preflight/activation/readback and actual authenticated Close/browser setup are the verification performed. The fresh-photo Search/selection/Add proof remains NOT_RUN_MISSING_PHOTO. Nothing staged, committed, pushed or redeployed; no migration created/applied. Next authorized action is unchanged: receive the new photo and execute the approved fresh workflow.

## 26. Live Open Library edition-picker selection and private Add, 2026-10-13

### 26.1 Authority and input

The Owner asked to attach the supplied photo and complete the live test. The located file was `C:\Users\user\Pictures\Books\testimage.jpeg` (197,282 bytes; SHA-256 `e6c763dd9e4fbebb2adeb8e4ff095a93c108489111fccd967edaafe427f7bccf`). The file had been uploaded before; the app showed its duplicate-image prompt. The test used the visible Proceed action, which accepted it as a separate input and made independent candidates in a new authenticated session. This is a fresh-session test using a repeated image, not evidence from a unique photo.

Fresh session `7a81bdb6-ed34-40cb-b5a9-cff85402cf48` was created through the normal Owner UI with the previously configured private defaults: location `Phase9 proof shelf`, condition `good`, price 2500 minor units, quantity 1, language `en`, and publication `private`. Input `67df40f6-f3cf-4aea-92b4-931776e4058e` was stored in the normal image-extraction input flow; database readback recorded `duplicate_of_input_id=1e599d92-f1bd-47ad-80e8-8d42c4eb39cc`. The deployed vision worker claimed its `vision_extract` job and logged a completed Gemini analysis (`gemini-3.5-flash-lite`, `accepted_with_language_skips`). The Owner UI showed seven candidates: The Black Swan; A Hundred Years of Philosophy; False Dawn; Antifragile; Concise Encyclopedia of Western Philosophy & Philosophers; Charles Peirce; and Unended Quest.

### 26.2 Explicit search and selection

Candidate 2, `A Hundred Years of Philosophy` by John Passmore, first had an automatic Google `no_match`. The Owner explicitly invoked Search Books. The deployed metadata worker claimed request/job `59d90450-d117-43cd-b99c-fe91edf7ecc4`; its live Open Library path completed `edition_options_available`. Provider-call readback showed the search, editions, and one author stage, with no provider-call failure. Ten original result positions were retained; six were eligible and four ineligible. The UI showed the first five and exposed the rest through Show all, with ineligible choices disabled.

The test selected result 2, Open Library record `OL58911240M`: `A Hundred Years Of Philosophy`, John Passmore, English, Penguin Books, 1966, 642 pages. The photograph shows the Penguin mark. The provider row returned no ISBN or cover for this edition; the UI displayed its no-cover fallback. Its evidence was title/author/provider metadata requiring Owner confirmation, not automatic strong certainty. The Owner made the explicit selection through the picker. Price, quantity, condition, location, and private publication intent remained unchanged.

### 26.3 Add, cleanup, and authoritative readback

The standard Add to inventory action succeeded for this one ready card. Candidate `31d2159c-b2a5-4b67-b3a7-c6ca02da3526` became `committed`, version 4, with inventory link `7daee71e-77c7-4fec-bac1-2c954d1587b5`. The row reads title `A Hundred Years Of Philosophy`, author John Passmore, publisher Penguin Books, year 1966, condition good, quantity 1, shelf `Phase9 proof shelf`, price 2500 minor units, `publication_status=private`, `visibility_status=draft`, and listing quality `ready`. The authenticated Owner inventory page was filtered to this title and displayed exactly one result at Rs25, marked committed inventory / draft.

Post-Add edition-state readback showed `options_count=0`, `options_expires_at=null`, and no pending request. It retained the selected `edition_option` source, selected option ID `184460db-f382-4f0c-a264-c1e83d37b6d1`, selection ID `87a24d4b-40dd-4d5d-95e1-796fb9b18ea9`, and the selected metadata snapshot. The inventory row retained metadata snapshot version `edition-selection-v1:87a24d4b-40dd-4d5d-95e1-796fb9b18ea9:metadata-r5`. The session remains active with seven candidates, one committed, and six still in review; those six were not changed.

### 26.4 Scope and next action

The live Owner workflow now proves fresh-session upload, duplicate confirmation, vision extraction, explicit Open Library search, Owner edition selection, private Add, inventory readback, and clearing unused options after successful Add. The previous closed session's exhausted job remains `in_progress`, attempt 5/5 with an expired lease; it was not reset or changed. M75 remains PROPOSED / NOT_CREATED / NOT_APPLIED and outside this authority.

External effects in this test: a new image input/storage object, seven candidates, live vision/metadata provider calls, one private/draft inventory row, and cleanup of the unused edition options after Add. No code or migration changed; no deployment, provider-setting change, Git stage/commit/push, or publication occurred. No product test suite was rerun because executable source was unchanged. The browser displayed the filtered inventory result; no durable screenshot file was saved.

Sources: owner-edition-picker SDD §13.14 and DOC-3 §5.2.1 for explicit alternative search, evidence and retention; Unit 6G SDD §§14/23 and U6G-AC13/18/20 for Owner selection, versioned Add and partial-session behavior. Existing requirements are unchanged.

Next exact authorized action: Owner review/direction on the six remaining cards in session `7a81bdb6-ed34-40cb-b5a9-cff85402cf48`; separately decide whether to authorize local M75 recovery work. Keep the old exhausted job untouched and do not create/apply M75 without that separate authority.

## 27. Actual metadata sheet scroll regression and local correction, 2026-10-13

The Owner's current request was "its not scrollable can you check please" on scan 7a81bdb6-ed34-40cb-b5a9-cff85402cf48. This bounded reversible correction restores the already-required picker SDD §3 / §10 EP-AC03 surface, traced to DOC-3 §5.2.1 and the Unit 6G accessible review patterns. No new behavior, provider or server authority is introduced.

RED before source edits: the actual authenticated 375 × 580 in-app browser showed the first five saved Black Swan results. The sheet cap was522px, GlassCard content1640px with flexShrink0, and ScrollView clientHeight=scrollHeight=1600px. A normal wheel action did nothing (scrollTop0; unchanged screenshot); lower controls were clipped. Escape closed it; the main scan list scrolled normally (viewport467px/content7491px; observed scrollTop2280). Existing fixture tests used scrollIntoViewIfNeeded and did not establish ordinary wheel behavior.

Exact source changes: src/components/ui/GlassCard.tsx adds one optional contentStyle passed only to the inner content wrapper; src/features/imageInventory/components/CandidateMetadataSheet.tsx opts into flexShrink1/minHeight0 under its existing90% height cap. Gradient, padding, theme opacity, heading/focus, command locking and all provider/selection/selling contracts are preserved. Default GlassCard callers are unchanged.

Fresh commands and results:

- .\node_modules\.bin\jest.cmd --runInBand --runTestsByPath src/features/imageInventory/__tests__/ownerEditionPickerSheetStates.test.tsx src/features/imageInventory/__tests__/ownerEditionPickerMounted.test.tsx src/features/imageInventory/__tests__/ownerEditionPickerFullReview.test.tsx src/features/imageInventory/__tests__/batchReviewCard.test.tsx — four suites / 67 tests PASS, exit0,102.33s.
- .\node_modules\.bin\tsc.cmd --noEmit — PASS, exit0.
- Artifact build.cjs invokes the correct worktree Expo CLI export --platform web --clear into its web-export; public configuration was validated for anon role/exact project from the previously verified export and kept only in process memory. No value was printed or copied to an env file. Export PASS, exit0,2690modules/69assets; entry-32dbfea6ee677db700a0406c93dd4436.js.

The old localhost8083 process was verified as node.exe/PID33180 serving the known prior export before it was stopped. The new loopback-only artifact server runs in managed exec session69694. The browser was reloaded and its actual authenticated scan checked before reopening View metadata. No login, auth bypass or new lookup was used.

GREEN actual browser proof: ScrollView is now482px with1590px stable initial content; ordinary wheel moves scrollTop0 ->580. A second ordinary scroll exposes Show all, detected details and Close metadata. Show all expands the same saved ten positions; another ordinary scroll reaches scrollTop2686 in3168px content. Close metadata is fully within the viewport (top508/bottom560/height52). The user-facing page remains open with the corrected sheet. Current displayed counts: seven detected/six in review/one added. No result was selected.

Durable proof directory: C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-scroll-20261013. before.jpg/before.json reproduce RED; after.jpg/after.json capture GREEN; REPORT.md records the mechanism and exact limits; build.log/build-exit-code.txt record the fresh export. Screenshots contain displayed book facts, not raw provider response payloads or credentials.

Shared mutations: none. Only existing authenticated reads, ordinary scrolling, Escape, View metadata and Show all were used. No Search Books, selection, review Save, Add, provider enablement, migration, database/Storage/job repair, backend deployment or Git publication occurred. M75 was not created/applied. This proves web scrolling in the actual preview; physical native-device scrolling and a new selection/Add after this layout patch were not run. Earlier §26 owns that separate live workflow proof.

Closeout: the existing sixteen modified documentation paths were preserved, with two bounded product paths added to the uncommitted diff. Continuity/diff checks are run after this note and reported separately. Exact next authorized action: Owner review of the corrected sheet in localhost8083. Commit/push/deployment of the correction requires a separate instruction; no old-job recovery is inferred.

## 28. Missing covers and disabled edition choices, 2026-10-13

Authority/scope: the Owner asked why many books lack covers and why choices cannot be selected. Only source, current browser and bounded read-only Supabase checks were performed. Existing picker §§3/4.1/13.14 and EP-AC02/03/05 govern the observed behavior; DOC-3 §5.2.1 is the root routing source. No product/acceptance change is approved here.

Fresh MCP get_project matched Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY, ap-southeast-2. Information-schema readback verified phase9_candidate_edition_state fields before querying the existing session 7a81bdb6-ed34-40cb-b5a9-cff85402cf48. No DDL, write RPC or mutation was used. The saved Black Swan set is still fresh and unselected: ten positions, one eligible, seven ineligible, two unavailable. The query uses detected English title/author text without an observed ISBN.

Exact disabled-choice causes from source plus saved facts:

- Positions 1, 2 and 4 have non-English language; title/author mismatches also occur. One displayed author value is the provider-derived "invalid author ID" string. No trustworthy alias or language is invented.
- Positions 3 and 5 have no usable normalized metadata. The retained representation does not identify which original field or own-author resolution caused failure; no specific raw-data cause is claimed.
- Position 6 matches the normalized title/author/English language and is eligible. The browser's Select result 6 button is enabled, despite its absent cover. No selection command was sent.
- Position 7 has an unknown language value; the English query fails the language-equality guard.
- Positions 8, 9 and 10 have matching author/English language, but their title omits the leading article. normalizeBibliographicText only applies NFKC, whitespace normalization and lowercasing; evaluateEditionOption requires exact equality. The Penguin variants are therefore blocked by the title guard. This is not proof that the physical editions are identical; an Owner confirmation design must preserve actual conflicting-book and language guards.

The worker preserves original provider positions; the first five contain only rejected/unavailable rows. Show all exposes the one eligible position 6. EditionOptionList disables based on global pending/lock state, non-eligible status or absent metadata; a cover is not a selection condition. The current UI displays only "Not eligible for this book" instead of the failed field comparison.

Cover cause: five of eight usable metadata records have coverReference=null, and their DOM placeholders correspond to those null references. Three supplied cover references render successfully in actual img elements (complete=true, natural widths 180px and positive heights). The Open Library normalizer only builds a URL from a positive own-edition covers ID. There is no secondary cover lookup or ISBN/work-level fallback in this path. A missing reference therefore does not establish that no image exists anywhere for the book. Main scan thumbnails use matched/selected metadata, so unmatched or unselected cards can also have no cover.

The existing external View on Open Library tab currently lands on that site's human-verification route. No CAPTCHA was interacted with. That is separate from the in-app disabled Select edition buttons; View opens a reference page and does not select a BookConnect option.

Proof: the unchanged actual app's enabled position 6 is left in view. Screenshot C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-cover-selection-20261013/enabled-no-cover.jpg shows its cover placeholder and enabled selection control. No complete options payload, raw provider body, credential or cover asset was copied into persistent documentation.

Verification: source checks, exact-project/schema/data MCP reads and actual browser button/image inspection. No product test was repeated because source/tests were unchanged in this investigation; the earlier §27 67-test/TypeScript/export results remain dated evidence. Continuity/diff checks run after this documentation update and their output is saved beside the screenshot. Prior two product edits and documentation changes are preserved and unstaged. No commit/push/deployment/application, search, selection, Save/Add, provider/configuration or shared business mutation occurred.

Next authorized action: Owner review of these precise limitations. Article/author variants, unknown-language confirmation, per-field reasons and any own-edition cover fallback need an explicit bounded source-spec/implementation decision before behavior changes. Do not bypass the current eligibility guards or choose a different physical edition to manufacture a successful demonstration.

## 29. Extended solution audit and bounded proposal, 2026-10-13

The Owner asked for a solution and whether the earlier investigation was thorough. This extends §28's observed UI causes with tests of actual database guards, provider alternatives and all candidate provenance. It authorizes read-only investigation/proposal, not implementation or a migration. Sources: DOC-3 §5.2.1; picker §§3/4.1/4.3/5-7/13.14 and existing EP-AC02/03/05/11/13-15/18-20; Unit 6G identity review; Unit 7C §8.

Fresh get_project verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY / ap-southeast-2. Information-schema and pg_proc reads established the live helper signatures, IMMUTABLE bodies and relevant fields before data/predicate SELECTs. No UPDATE, DDL, write RPC or selection command was used.

SQL control matrix on saved metadata: positions 6/7/8/9 all pass current metadata validity. Original eligibility is true/false/false/false. Aligning only the title in an in-memory copy of the query gives true/false/true/true: the two Penguin rows are rejected by the title comparison, and unknown-language position7 remains rejected. The stored query and rows were not changed. Injecting either an own-ISBN or own-OLID cover URI into a copied metadata value fails the installed validator in every case.

Three live SQL functions contain the CoverID-only rule: phase9_edition_valid_metadata, phase9_complete_candidate_edition_options_v1 and phase9_unit6g_metadata_summary. Current src ownerBatchReviewContracts/ownerUxCandidateSchemas and shared ownerBatchReviewResponses/ownerMetadataSnapshot parsers restrict the same route and reject query parameters. Therefore a worker-only ISBN/OLID/default=false change would fail or be hidden across persistence/reader/wire boundaries. Existing applied migrations remain unedited.

Eleven bounded public GETs were made, without keys or worker/job endpoints. Two current own edition JSON records returned200, confirmed the same own ISBN-13 and had no positive cover ID; the unknown-language record has no language reference. Their two own ISBN-13 routes, two own OLID routes and one supplied own ISBN-10 route returned404 with default=false. The first six request starts were measured at minimum1000ms spacing; later controls were separate bounded requests. No raw JSON record body or cover image was retained.

Positive controls distinguish missing mappings from a broken connection: the known CoverID, its own ISBN-13 and its own OLID all returned302 to the same official archive image, matching the already-decoded image in the actual app. A header-only request to that archive object stopped at its subsequent CDN redirect (302/image-jpeg); no terminal image-body success is claimed for that probe. The earlier DOM inspection owns actual image decoding of all three supplied URLs. [Official Covers API](https://openlibrary.org/dev/docs/api/covers) documents identifier lookup and default=false not-found behavior. The sampled fallback routes do not recover these missing images; do not promise coverage for every edition or infer that no image exists anywhere.

All seven current automatic snapshots are no_match, derived from completed Google outcomes; some use an outcome from another cache/coalesced attempt. Only the previously added card has an explicit Owner choice. This does not mean seven fresh provider HTTP calls occurred, and it does not reconstruct why each original Google payload was rejected. The original photo shows Nassim Nicholas Taleb on Antifragile; stored observation says Nasrim Nicholas Taleb. Existing confirmed-identity review/search must correct that typo, while preserving the immutable observation. No correction was submitted here.

The concrete proposal (external evidence: `C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-solution-audit-20261013/PLAN.md`) recommends first addressing bounded English leading-article equivalence for explicit Owner selection in worker, own-author prioritization and SQL, with the same identity/identifier/language/authority guards. Keep weak evidence subject to explicit Owner selection; automatic winner/cache and strong-ISBN rules are not broadly relaxed. Old retained sets must receive a controlled versioned refresh, preserving prior choices/drafts/inventory/accounting; do not manually relabel old rows or reset jobs.

UI should communicate actual rejection/discovery states and available supplied format without changing provider order. Unknown language and OCR errors use the existing review/manual paths rather than fabricated provider facts. Missing cover remains optional. The Penguin rows already have usable covers, so a new URL policy is not needed for this immediate case. Unit7C §8 and StoreViewManagePhotosModal contain the existing post-commit upload/staging/sanitization route for owned book photographs; no upload test or business write was performed. Optional later ISBN/OLID fallback would need a separately approved narrow own-identifier validator change across all affected boundaries and a new forward migration; no such migration is created.

Proof required before correction completion: failing/then passing worker and SQL variant fixtures; wrong-author/known-language/identifier/unsafe-URL controls; own-author budget and original positions; old sets/expiry/replay/fencing; compact/full variant selection through Save/reopen/Add with exact snapshot, preserved selling details, one inventory row and options cleanup; then one Owner-directed actual live acceptance. Current helper/probe checks prove the diagnosis, not the proposed implementation. No new product tests were run for unchanged source; previous §27 tests remain dated scroll evidence.

Artifacts: PLAN.md; probe-results.json (initial six receipts); probe-own-isbn10-results.json; probe-control-results.json; probe-positive-identifiers-results.json. Code lives outside the repository in the same proof directory. Raw payloads, image files, credentials and complete alternative sets were not retained in these diagnostics. Final continuity/diff output is saved there after this note.

Mutations: documentation/artifacts only; no shared configuration, registry, Auth, inventory, Storage, job, migration, service or Git mutation. Existing two local scroll source edits are preserved. Exact next authorized action: Owner review of the proposed bounded correction. M75 old exhausted-job recovery is separate and deferred; broad automatic lookup/provider changes are not inferred.

## 30. Bounded title correction and related release audit, 2026-10-13

### 30.1 Authority and completed scope

The Owner approved only the reduced explicit title-selection fix and verification, deferred extra rejection messages/cover fallbacks/new OCR functionality, and then requested related local analysis/changes ahead of another worker deployment. Sources: DOC-3 §5.2.1; picker §§4.1/4.3/5-9/13.14; existing EP-AC02/05/11/13-15/18-20. The new 12-line helper allows exact normalized titles everywhere or one leading The difference only for known English query/result languages. Original catalogue title/query metadata remain unchanged. Worker final eligibility and safe own-author prioritization reuse this helper; automatic Google winner/cache/ranking and current-suggestion SQL equality remain exact. All original author, ISBN, language, reliable-volume, safe-own-record, ordering, budget, retention and authority checks remain.

Files: metadata/explicitEditionTitle.ts (new); metadata/googleBooks/editionOptions.ts; metadata/openLibrary/normalizer.ts; functions/__tests__/phase9_edition_title_variants.test.ts (new). The two prior scroll source changes are preserved. No Owner API/client wire/queue/provider/counter/configuration/dependency change is introduced.

### 30.2 Actual proof

Worker RED: five variant/own-author admission assertions failed for the expected strict-title reason; fifteen negative/existing controls passed. GREEN: four explicit suites/135 tests PASS, plus two automatic Google/routing suites/35 tests PASS (170 total). SQL baseline RED: three title-variation assertions failed, fourteen existing controls passed and two new workflow cases were skipped. SQL proposal GREEN:19/19 PASS against disposable current M65-M74; actual completion, selection, Save/reopen, once-only Add and cleanup passed with no cover. The scoped refresh preserved the full chosen snapshot, selling fields and unrelated session, rejected stale versions, retained the ineligible-row gate, and was idempotent. The existing M74 actual SQL/compiled-worker gate passed32/32. Metadata-worker compilation and root TypeScript no-emit PASS. These fixtures made no live provider calls.

The initial Node run encountered sandbox EPERM before tests and was rerun outside that sandbox under scoped approval. The first SQL probe used a legacy scalar helper that omitted bind parameters; the corrected parameterized probe then reproduced the real three failures. Workflow fixture mismatches were corrected to use current structural completion and private-versus-public snapshot expectations. No production behavior was changed to satisfy harness errors. Browser/live/native acceptance for the new title rule is not run; the earlier 67-test/Expo/ordinary-wheel proof belongs to scrolling only.

### 30.3 Fresh deployment and database evidence

Verified project: Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY / ap-southeast-2. M74 remains20261012140853; M73 remains20261011224457; M65-M74 files are unchanged. The private option predicate is IMMUTABLE, empty search_path, postgres-only EXECUTE; current public request reuses fresh/pending sets. State columns/FKs/checks/indexes/RLS and session status/expiry were read back. RLS is enabled with no direct policies, consistent with its private controlled-RPC boundary; no RLS/grant/trigger/schema mutation is proposed. Security advisor readback contains seven baseline notices, including the unchanged INFO rls_enabled_no_policy for this state table; no claim that the whole project is advisor-clean is made.

Render srv-d9sqfdvqj5pc73dc66fg / phase9-metadata-worker remains LIVE at76348f3076a641d1a2dd6d5cdd6ab439b46da8da, dep-db6jc5rl550s73b6i0m0, main, autoDeploy=no, Free/one instance. Owner API remains ACTIVE v16/verify_jwt=true. Type-erased runtime traversal finds34 Owner files and66 metadata-worker files. The Owner API, media worker and publication worker have no changed dependencies. Vision transitively bundles Google metadata through contracts/index.ts → metadata/index.ts, including the pure title helper; its dedicated runVisionAnalysisWorker path only calls claim_phase9_vision_jobs and never invokes lookupEditionOptions or the changed comparison. This is a bundled dependency, not a changed executed vision path. Hence the behavior correction needs one metadata-worker release and compatible SQL; no Owner API or other-worker redeploy is required. Post-worker refresh takes the active session lock in Owner-command order, serializing concurrent close/edit before touching temporary lists.

### 30.4 Concrete SQL/release proposal and migration ledger

Evidence directory: C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-title-variant-20261013 (literal external path, avoiding unsupported absolute-link parsing). SQL-PROPOSAL.md contains two separately gated blocks: (1) forward private explicit-option predicate replacement, with ACL/signature/security/automatic equality preserved; (2) post-worker temporary-list invalidation scoped solely to Owner scan7a81bdb6-ed34-40cb-b5a9-cff85402cf48. It clears only matching fresh temporary lists, increments options_version/request_generation, preserves all choices/selling/inventory/jobs/accounting, excludes pending work, and requires explicit new Search Books. No raw eligibility relabel, automatic lookup or job reset. Fresh read-only preflight finds one affected list; re-count before any execution. Pending requests must be reviewed after rollout and are not reset.

Ledger: title predicate PROPOSED / NOT_CREATED / NOT_APPLIED; filename and live version unset until separate local-creation approval. Refresh PROPOSED / NOT_EXECUTED. M75 exhausted-job recovery remains deferred / NOT_CREATED / NOT_APPLIED. Future order: predicate migration when separately approved → reviewed worker deployment and exact revision/health verification → newly approved/recounted current-scan refresh → controlled Owner browser selection/Save/reopen/Add acceptance. Keep provider/plan/secrets/cache/instance configuration unchanged. The prior scroll patch may accompany the next client publication. No shared command is sent in this local preparation.

### 30.5 Closeout and next action

Exact next authorized action: Owner decision on creating the local forward predicate migration and durable SQL regression from the reviewed proposal. No migration creation/application, scoped data update, staging/commit/push, deployment, provider invocation, selection/Add or Storage/database mutation occurred. Changes are local/uncommitted. Continuity and diff receipts are recorded in the external evidence directory after this entry. Existing long source documents retain cohesive normative sections plus chronological evidence; no content is pruned or split for a line target.

Final related gate: two vision worker/boundary suites29 tests PASS. Total current local proof is199 Jest tests plus51 SQL/compiled-worker cases (250); the ordinary title/automatic gates remain separately scoped above. The final SQL proposal also passed19/19 after adding the active-session lock. No shared action or formal migration creation occurred.

## 31. Owner retained SQL as a proposal, 2026-10-13

The Owner answered the separate local migration/test creation question with "Keep the SQL as a proposal". This declines creation of both the forward migration file and its repository SQL regression. The existing local worker patch, worker Jest regression, earlier scroll correction, external SQL-PROPOSAL.md and disposable SQL test evidence are preserved. DOC-3 §5.2.1 / picker §4.1 behavior and the completed local proof in §30 remain unchanged; AGENTS.md authorization boundaries govern this decision.

Ledger: title predicate PROPOSED / CREATION_DECLINED / NOT_CREATED / NOT_APPLIED, filename/live version unset; temporary-list refresh PROPOSED / NOT_EXECUTED; M75 deferred / NOT_CREATED / NOT_APPLIED. No source/test edit, migration, shared database/Storage write, data refresh, provider invocation, Git publication or deployment occurs for this decision. Changes remain uncommitted and nothing is staged.

Active work unit: bounded_title_worker_local_sql_proposal_retained. Exact next authorized action: retain the proposal/local patch for later explicit Owner direction, with no further migration or rollout work. Only continuity documentation and external authority notes change. No code tests are rerun because source is unchanged; documentation continuity and diff checks are run after this note, with receipts proposal-retained-continuity.log and proposal-retained-diff-check.log in the §30 evidence directory.

## 32. Further selection-correction review, 2026-10-13

The Owner requested recommendations apart from the retained title/SQL proposal. Current code/spec/test review identifies two worthwhile client improvements: discoverability of eligible rows beyond the first five while preserving provider order, and distinct recovery for uncertain selection responses versus changed/expired authority. Sources: picker §§3/4.1/6-7/9/13.2; DOC-3 §5.2.1; master §3 MAS-02/04/05/06/15/16. EditionOptionList slices original positions without an eligibility hint; CandidateEditionPicker discards structured error distinctions and offers the frozen-command retry for every error. The query hook already rereads authority; version-conflict, uncertain-retry, coverless-selection and preserved-draft coverage exist. These are recommendations, not new approved requirements.

Detailed rejected-row reason contracts remain deferred; public rows currently carry binary eligibility and safe metadata only. Displaying genuinely supplied editionStatement/format is optional client polish. Missing covers already use a placeholder and do not disable selection. No additional matcher rewrite, author/language relaxation, automatic query, provider/cover fallback or schema change is proposed as necessary by this review.

Evidence: literal external directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-selection-review-20261013, REPORT.md. Current code and relevant tests were inspected; no new source/test edit or code-test/browser/SQL/provider run occurred. Existing proof retains its original scope. No database/Storage write, migration, stage, commit, push or deployment. SQL stays PROPOSED / CREATION_DECLINED / NOT_CREATED / NOT_APPLIED; M75 stays deferred.

Next exact authorized action: present these bounded recommendations to the Owner while preserving the local patch and SQL proposal; implementation/rollout awaits later explicit direction. Active work unit remains bounded_title_worker_local_sql_proposal_retained. Documentation continuity/diff receipts are continuity.log and diff-check.log in the review evidence directory; these checks are run after this entry.

## 33. Four picker corrections planned and locally authorized, 2026-10-13

Owner requested plan-first implementation, then clarified Both — four corrections in total: discoverability, error recovery, disabled reasons and supplied edition/format display. Root DOC-3 §5.2.1 and picker §3.1 now own the approved behavior. The plan is work-units/owner-edition-picker-client-corrections-plan.md. Local source/tests/API compatibility and disposable SQL evidence are authorized; formal migration creation/application, Git publication, data refresh and deployment remain held. Prior local title/scroll changes are preserved.

Fresh MCP project/function readbacks confirm exact project and unchanged owned-read/identity/confirmation/ACL boundaries. The minimal compatible reason path uses exact opt-in bookconnect/edition-reasons-v1 via existing x-client-info CORS allowance, selectively forwarded to the authenticated RPC client. SQL derives reasons only on opted-in fresh owned reads from the existing stored query/rows; old direct RPC/client/API behavior remains. No provider call, state write, extra matcher, worker workflow or RPC signature is added. SDK source confirms X-Client-Info is the existing header key; use that casing in JavaScript to override it rather than append a duplicate.

Active work unit: owner_edition_picker_four_corrections_local_authorized. Next exact authorized action: red-first plan execution and bounded local proof, then report the reviewable implementation/proposals. No new completion/test claim. SQL is kept external and unexecuted; M75 remains deferred.

## 34. Four corrections locally complete; independent review approved, 2026-10-13

Authority: Owner plan-first implementation request and Both — four corrections in total; DOC-3 §5.2.1, DOC-8 approved amendment, picker §3.1 / existing §§6-7/9/13.2, master §3 MAS-02/03/04/05/06/15/16. The plan and owning requirement amendments preceded code. All four are locally implemented. Preserve prior local title/scroll work and the separate Desktop checkout.

Completed source: EditionOptionList (counts/remaining-result hint, original five/ten positions, enum text, supplied editionStatement/format); CandidateEditionPicker and new editionSelectionRecovery (read-only conflict refresh, registered nonretryable stop, uncertain exact-command retry); both row contracts (optional bounded rejectionReason without changing legacy shape); edition-read transport/service and caller-authenticated gateway/Edge entrypoint (exact supported standard-header capability only). StoredEditionRow, query/confirmation/selected snapshots, selling drafts, locks, eligibility and provider budgets are unchanged. No dependency, extra matcher, worker workflow or request/RPC signature is added.

Actual RED: six focused suites produced39 expected missing-feature failures and202 passing controls; external diagnostic baseline produced10 expected missing-field failures,10 passing controls and1 helper-ACL skip. GREEN: six focused suites241/241; nine surrounding client/executable actual-HTTP suites115/115; four explicit provider/title suites135/135. Total491 Jest tests in19 suites. Diagnostic SQL25/25, existing M74 author isolation20/20 and existing Open Library SQL/compiled-worker32/32:77 SQL cases,568 total local checks. Root TypeScript, metadata-worker compilation and fresh Expo web export PASS (2691 modules,69 assets). No Python tests run.

Independent read-only reviewer APPROVED; no Critical/Important findings. Its minor suggestion for direct exact-ISBN/unknown-language and known-English article coverage was resolved with four new passing external SQL cases, changing no production/proposal code. Review-time564 checks increased to568. Deployed reasons, native-device behavior and rollout readiness were explicitly outside its verdict.

Actual browser: fresh bundle5595b0ee87af5779e0aa8b0ab2ceacb0 loaded the existing owned scan7a81bdb6-ed34-40cb-b5a9-cff85402cf48. Initial5 rows show1 selectable of10 plus the remaining-results hint; reopen resets5, Show all reveals10 in original order and removes hint. Supplied paperback format is visible; coverless sixth record stays selectable. Ordinary PageDown moves the482px viewport to890 within3245px content. Normal sizing restored, tab left open; local preview managed session13631. No Search/Select/Save/Add/upload/new provider lookup or live mutation. Live API/SQL retains legacy fallback. Detailed reasons/recovery use mounted/HTTP fixtures and disposable SQL proof, not simulated live state.

SQL/authority: fresh Supabase MCP project/function/ACL readbacks matched ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo / ACTIVE_HEALTHY / ap-southeast-2. External SQL-PROPOSAL.md keeps exact legacy ownership/freshness/source/query/expiry/confirmation gates and postgres-only private helper. Opt-in reasons are presentation-only enum/null, never stored or used to promote eligibility. ACL/state/legacy equality, wrong-owner/store denial, malformed/missing headers, retention/private snapshot and real disposable Save/reopen/Add replay/cleanup controls passed. No live SQL, repository migration/test-file creation, refresh, business/job/provider/Storage mutation or Git publication. Title proposal CREATION_DECLINED; title/diagnostic both NOT_CREATED / NOT_APPLIED. M65-M74 unchanged, M75 deferred.

Release remains separately gated: reviewed combined forward SQL, one worker release for the prior title patch, Owner API header/schema publication and client publication, then separately authorized scoped scan refresh and operational acceptance. Reasons alone need no new worker/provider behavior. Original browser plan was executed with actual read-only presentation/scroll and controlled mounted/HTTP failure fixtures; no shared write or fake page state was added for test coverage. Obsolete SQL fixture payload was replaced with current structural completion; privileged probes are separated from authenticated RPCs, preserving production guards.

Evidence directory (literal path): C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-picker-four-corrections-20261013; REPORT.md, REVIEW.md, SQL-PROPOSAL.md, all test/build receipts and browser-count-hint.png/browser-format-coverless.png. Applied migrations and repository phase9 SQL tests have zero diff; index is empty and HEAD76348f3 unchanged. Final continuity/diff/index/status receipts are written after this closeout. Routing/spec/traceability/dictionary/current-vs-target/decision/implementation/security notes updated together. Existing long chronological documents remain cohesive authority/evidence; this bounded append does not prune history or require an artificial size split.

Active work unit: owner_edition_picker_four_corrections_local_complete_sql_proposals_retained. Exact next authorized action: Owner review of the local picker at localhost:8083 and the proposals. No further source/migration/publication/deployment/live-refresh work is authorized. The phase remains9; no AGENTS phase-pointer transition.

## 35. Independent all-five cover availability and strict-policy audit, 2026-10-13

Owner explicitly requested an independent fresh check of cover availability and strict/bad logic. This is read-only diagnosis under DOC-3 §5.2.1 / picker §§3/4.1/13.14 /04 Security §8; no behavior or requirement amendment. Fresh MCP reverified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY / ap-southeast-2, current saved rows and live private validator/summary definitions. All five usable coverless records (positions1/2/6/7/10) have no positive cover ID in fresh exact-edition JSON (HTTP200). Their own five OLID, five ISBN13 and two supplied ISBN10 cover routes all returned404 with default=false. The24 bounded public GETs include positive controls: all three stored CoverIDs302; result8 own OLID/ISBN13 redirect to the same official image as its CoverID; terminal control200/image-jpeg. Starts spaced at least1100ms, zero request errors; no raw JSON or image bodies retained.

Current normalizer uses only a positive exact-edition covers ID. Client/server validators and installed SQL only allow the HTTPS CoverID /b/id/<positive>-M.jpg route, without query/hash/port. A SELECT-only in-memory-copy test on result8 proves stored CoverID=true, own ISBN=false, own OLID=false, same CoverID with default=false=false, null=true. The known own ISBN/OLID routes work at the service but are rejected by our narrow policy. This is a real fallback limitation, not evidence of a hidden working URL for the five current missing mappings. The UI does not condition covers on eligibility. No claim that no image exists anywhere; no work/other-edition borrowing or guarantee of future fallback coverage.

Evidence literal directory: C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/cover-independent-audit-20261013; REPORT.md, probe.cjs and probe-results.json. No source edit, provider configuration/DB/Storage/business/job mutation, Search/Select/Save/Add, migration, staging/commit/push or deployment. Existing four-correction/title/scroll patch and held SQL remain unchanged, M65-M74 immutable, M75 deferred. Exact next authorized action remains Owner review of local corrections/proposals and this audit. Any future own-identifier cover fallback must first be an approved coherent worker/SQL/client/server change; no implementation is inferred here. Final continuity/diff/index/HEAD receipts follow this entry.

## 36. Current Select edition guards and enabled visual control, 2026-10-13

Owner asked why selection is not working/conditions and clarified All buttons look disabled. Read-only actual browser/MCP check under DOC-3 §5.2.1 / picker §§3/3.1/4.1/6-7/9/13.2/13.14: current Black Swan alternatives are fresh (checked15:02:16UTC; expiry23:06:11UTC; optionsVersion1; no selection). Actual AX shows result6 enabled; seven usable controls disabled; results3/5 unavailable. User was at bottom/result10. Ordinary scrolling left result6 visible; screenshot shows purple enabled text against the same dark background used by blocked controls. Visual distinction is subtle; no global lock/expiry is observed. No Select/Save/Add clicked, so no submission-success claim.

Installed live helper still requires exact normalized title and every normalized query author membership, base-language match, valid/coherent ISBNs and sufficient identity. The exact-ISBN unknown-query-language exception is retained. Current1/2/4 have title/author/language differences;7 unknown language;8/9/10 omit The;6 matches and stays coverless eligible. Only saved eligible non-null rows can be clicked, with fresh/coherent state and no card command/pending lock; server repeats initiating-Owner/store/session/card/lifecycle/query/version/eligibility checks. Title worker/SQL fix and old-list refresh remain held/unapplied; four UI corrections do not change these stored flags.

Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/selection-current-state-20261013; REPORT.md/result6-enabled.png. Fresh exact-project MCP reads confirm existing functions/rows. No source/test edit or new code-test claim, provider/shared data/job/Storage mutation, migration, staging/commit/push/deployment. Existing current work unit local_complete_sql_proposals_retained and Owner-review next action unchanged. No enabled-style implementation is inferred from this question. Continuity/diff receipts follow.

## 37. Open Library monthly-dump feasibility research, 2026-10-13

Owner explicitly asked to read https://openlibrary.org/developers/dumps and recommend how to proceed given API limitations. Research only, no import implementation. Owning constraints DOC-3 §§5.1/5.2/5.2.1, picker §§4.1/5-9/13.14 and04 Security §8 unchanged. Read the full page, official API/search/covers/licensing/processing guidance, current manifests and platform Free limits; checked actual adapter/transport.

Manifest/HEAD proof: latest observed monthly catalogue30 September2026, published2 October; actual compressed editions12.617GB, authors0.782GB, works4.073GB, all current types18.183GB, historical complete52.924GB. Covers metadata75.521MB is dimensions/date/ID, not images. Full13-category inventory/exact bytes/checksums/redirects are external manifest-results.json. The page size labels are older approximations; latest three core file links redirect to that snapshot. Core editions+authors13.400GB, with works17.473GB; a filtered retained subset still needs a full gzip scan/download. No binary dump or image archive fetched.

Official API guidance:1 request/s default,3 identified app/contact; bulk/high-traffic use should prefer dumps. Actual transport User-Agent lacks contact; adapter picks one work, first10 editions and four own-author reads. These are our approved bounds rather than full upstream coverage. Search API supports language-aware edition retrieval but nested edition result remains one relevant edition per its documentation. No rate/budget/ordering/policy change was made.

Recommendation, not approval: benchmark current seven books/representative sample; bounded offline editions+authors pilot (works if needed) with streamed TSV/JSON and own source references; measure coherent match/field/cover completeness, ambiguity, import/memory/index-size/latency; only then design a curated local catalogue using existing canonical-first coherent-source rules with permitted API miss/freshness fallback. Full mirror/paid hosting is premature without measurements. Catalogue updates must handle redirects/deletes and atomic snapshot rollback without changing Owner selections/inventory. Original selection/title guard, OCR and missing covers remain separate; raw/image/retention/adapter change needs approved source scope. Supabase Free500MB and Render Free ephemeral/no persistent disk cannot host a full raw mirror on existing Free allowances. No fixed cost or unmeasured coverage promise.

Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/open-library-dumps-research-20261013; REPORT.md, manifest.cjs and manifest-results.json. Only public documentation/manifests and HEAD read, no bulk payload download/import, source/tests/service/schema/data/Storage/provider registry/jobs/Git/deployment/migration mutation. No ingestion benchmark or code-test claim. Current four-correction local-complete/held-SQL status, M65-M74 immutability and deferred M75 preserved. Exact next authorized action: present research/recommendation; a concrete bulk-pilot or catalogue implementation direction remains a later decision. Continuity/diff/index receipts follow.

## 38. LibrariesHacked catalogue-import reference assessed, 2026-10-13

Owner asked about https://github.com/LibrariesHacked/openlibrary-search as follow-up to monthly-dump research. Read-only README/preprocessor/psql schemas/loader/index code plus fresh GitHub metadata/tree inspection. Observed revisiona6c0a606a7287b921c4beb4fd278d71b2477599f (30 January2026), complete21-file inventory, license:null/no license file. No repository implementation executed/copied, no bulk download or Python run.

Provides local PostgreSQL import plumbing, JSON source tables, work-author and edition-ISBN links, ISBN and pg_trgm title/subtitle/author indexes. README reports250GB free-space allowance and5-hour full load on one Macbook M3; these are maintainer figures, not measured current requirements. It ships no hosted catalogue/API, monthly update/deletion/rollback pipeline or cover recovery. The sample resolves authors through work-level relationships; BookConnect must use exact own-edition authors for selected facts. Preprocessor truncates extra columns, waits without retrieving worker exceptions and appends rerun checklist; psql does not request stop-on-error, with stage flags updated after copy commands. These static observations justify a measured/hardened adaptation, not an as-is production import.

Recommendation: use schema/index concepts as a reference for an isolated subset pilot, preserving DOC-3 §§5.1/5.2/5.2.1 coherent canonical-first authority, picker §§4.1/5-9/13.14 and04 Security §8. Trigram retrieval cannot promote weak candidates, missing data/covers remain absent, raw catalogue storage/new update/serving policy requires separate approved scope. Code-copy license terms unestablished.

Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/openlibrary-search-research-20261013; REPORT.md, inspect.cjs and inspection-results.json. No dataset/service/schema/Storage/provider/job/business mutation, source/tests edit, Git publication/deployment/migration. Current local-complete four corrections, held proposals/refresh and deferred M75 unchanged. Exact next authorized action present assessment; pilot/import needs later concrete direction. Continuity/diff receipts follow.

## 39. Internet Archive cover payloads versus mappings clarified, 2026-10-13

Owner asked about cover folders/Internet Archive links on the dump page. Read official dump/Covers API documents and four public archive metadata/file manifests, no image archive or217MBhistoric mapping payload downloaded. Distinguish monthly covers metadata (ID/dimensions/date), actual ZIP/TAR image groups, and the2011 identifier/OL-key-to-cover-ID mapping linked by Covers API documentation. Verified covers_0000:100 TAR/43.85GB; covers_0013:100 ZIP/212.41GB; m_covers_0013:100 ZIP/15.34GB; historical coverids gzip217.15MB. Decimal units, exact bytes/dates in evidence. Rolling complete monthly image dumps are not supplied per current documentation.

Known edition coverID -> official covers.openlibrary.org URL -> archive image works without downloading a whole group. Earlier completed same-day HTTP proof already showed cover13240739 reaching200/image-jpeg in m_covers_0013_24.zip; this task confirms the container manifest. Title/author search still needs a catalogue relation; image group alone provides no edition association. The217MB2011 mapping may be worth a targeted future test but was not searched; no missing-cover recovery claim. Current own-route404s do not prove no historic image exists anywhere.

Authority DOC-3 §§5.2/5.2.1 / picker §§3/4.1/13.14 /04 Security §8 unchanged. No rehosting/image-storage, cover borrowing, URL-policy relaxation or new recovery workflow authorized. Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/cover-archives-research-20261013; REPORT.md, inspect.cjs and inspection-results.json. No source/tests/Git/service/schema/data/Storage/provider/job mutation, lookup/Select/Save/Add, migration/deployment. Current local-complete corrections/held SQL, immutable M65-M74 and deferred M75 preserved. Exact next authorized action present explanation/limits; actual legacy-map scan/import is a later concrete direction. Continuity/diff receipts follow.

## 40. DuckDB/GraphQL/cover locations and torrent destinations verified, 2026-10-13

Owner asked to trace DuckDB, GraphQL, other page links, where covers are represented and the torrent link. Read-only full-page/link/source/manifest/descriptor audit. The torrent sentence refers to the immediately preceding Internet Archive ol_exports collection; each dated item has its own Download Options/TORRENT, not a single all-release torrent. Three descriptors returnedHTTP200 and were decoded in memory: current ol_dump_2026-09-30_archive.torrent180,959bytes/~36.98GBlisted; history254,310bytes/~52.94GBlisted; medium group0013 descriptor172,639bytes/~15.45GBlisted. Current descriptor includes combined and per-type data, covers metadata and auxiliary files, not actual cover images. Useful editions/authors13.400GB, plus works17.473GB; individual file selection avoids duplicate combined/per-type copies. No client started or swarm/speed tested.

DuckDB queries local files; PostgreSQL project supplies import/index scripts; schemas define formats; GraphQL wraps live API rather than dumps. Fresh pinned GraphQL5da6a38c5822a6d04603a5aae12ce0d5de51f660 root queries are ISBN/edition/work/author identifiers, no title+author free-text root. Books/work covers:[Int], resolvers fetch live provider URLs, no ready cover_url or offline catalogue. Fresh positive editionOL40344159M GET200 supplies covers:[13240739]; edition dump fifth TSV JSON carries that same optional field, enabling normal own-ID URL construction. Cover metadata is dimensions/date, images remain separate archives. Previously proved terminal13240739 JPEG is in m_covers_0013_24.zip, independently listed by the cover torrent. No new cover recovery proof.

Authority DOC-3 §§5.1/5.2/5.2.1 / picker §§3/4.1/5-9/13.14 /04 Security §8 unchanged. Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/dump-links-map-20261013; REPORT.md/inspect.cjs/inspection-results.json contain exact links/HTTP200/file lists and source revision. No data/image/torrent payload transfer, service/tool install, source/tests/schema/data/Storage/provider/job mutation, Select/Save/Add, migration/Git publication/deployment. Only small manifests/descriptors/source and one factual public record read. Current local-complete/held SQL, M65-M74 immutable and M75 deferred preserved. Exact next authorized action present map; actual dataset/torrent-service/import needs later instruction. Continuity/diff receipts follow.

## 41. Active Downloads folder inspected; file-content proof pending, 2026-10-13

Owner asked to inspect the approximately34-35GB download, text formats and SQLite alternatives, then clarified that it is still downloading in Downloads. Scoped read-only discovery found C:/Users/user/Downloads/ol_dump_2026-09-30. At18:14:32UTC ten .txt.gz files report36,922,908,563bytes (~34.387GiB), plus an active uTorrent part file. All ten first16-byte prefixes are zero; no gzip/record was decoded. This is consistent with allocated unfinished files, not a corruption or completion finding. Reported sizes match expected core manifest lengths but cannot establish received bytes. Checked C: free36,944,564,224bytes and falling during download; full extraction/import capacity is unestablished. No source file moved/modified, no integrity/count/coverage/benchmark claim. Node22.13.0 and psql available; DuckDB/sqlite3 not on PATH, no installation or database opened. RAM lookup denied; no assumption or escalation for it.

Official format/database documentation verified: ordinary catalogue TSV has5fields with JSON fifth; auxiliary formats differ, combined/current per-type files overlap, cover metadata is not JPEGs. Recommendation is DuckDB compressed inspection/subset first; SQLite is viable for a local read-heavy catalogue and35GB alone is no blocker; PostgreSQL is a later candidate for hosted concurrent writes/trigram retrieval. No adopted architecture/requirement/import/schema/source-policy change. DOC-3 §§5.1/5.2/5.2.1, picker §§4.1/5-9/13.14 and04 Security §8 coherent own-record/retention boundaries retained.

Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/download-format-inspection-20261013: REPORT.md, inspect.cjs, inspection-results.json and disk-capacity.json. Scoped Node sampling required filesystem escalation and was approved; no auto-review rejection. No code/migration/DB/Storage/provider/job/business mutation, install/import/service/Git/deployment change. Four picker corrections remain local_complete_sql_proposals_retained; SQL creation/application, refresh/publication and rollout held; M65-M74 unchanged/M75 deferred. Exact next research action after Owner confirms completion: validate core files and inspect a bounded real-record sample, without a full import or product integration. Main phase next action remains Owner review of local corrections/proposals. Continuity/diff/index/HEAD receipts follow this entry.

## 42. Supabase import/capacity and second-hand covers researched

Owner requested download/import format, Supabase/new-table/other-provider advice and cover treatment; clarified old books means second-hand copies of any publication year. No age cutoff is proposed. Fresh MCP verifies Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY/ap-southeast-2/PG17 and existing organization free/tier_free. A first combined SQL read timed out on connection; split read-only queries succeeded: database280226963bytes/267MB reported by PG, current canonical_editions/canonical_works/book_metadata_sources/book_search_aliases relation names present. No column/ACL/RLS/data-count review, schema compatibility or migration-plan claim. Published Free500MB limit cannot fit the full catalogue; new tables do not add capacity. Paid baseline8GB is not a35GBgzip-import capacity/cost guarantee. Recommended keep Supabase, measure local factual subset, separate reference data for a small pilot, consider separate paid same-provider project for broad catalogue load isolation; no architecture/hosting adoption.

Official TSV/JSON, edition optional covers/ISBN/date fields, bulk import guidance and PG17 client STDIN semantics were verified. Conceptual loader parses/normalizes local records, preserves own-edition author/provenance, serializes properly for approved bulk staging/reference load, validates counts/joins/rejects and builds indexes. No raw payload or blind bulk canonical promotion is approved. Existing code has own-edition authors/CoverID-only/unknown-language guards; dumps do not fix missing data or held predicates automatically. Cover metadata ID/dimensions/date is distinct from image JPEGs and book associations. Known own ID -> official cover display is first choice;2011 identifier-to-ID mapping is an untested recovery candidate, not an age filter or coverage promise. Actual-copy condition uses existing Owner photos/selling data, no age filter. No mapping/image archive fetched, no cover recovered.

Authority DOC-3 §§5.1/5.2/5.2.1, picker §§4.1/5-9/13.14 and04 Security §§8-9 retained. Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/supabase-catalogue-covers-research-20261013: REPORT.md and recording/proof receipts. Only research docs/evidence changed; no installation/import/billing/project/schema/Storage/provider/job/business/Git/deployment/migration mutation. Four-correction work unit and main Owner-review handoff unchanged; SQL/refresh/publication/rollout held, M65-M74 immutable/M75 deferred. Exact next research action after Owner confirms completion: validate core files and inspect a bounded cross-year factual/cover sample with retained/index size measurements; a cloud import/capacity change remains a later decision. Continuity/diff/index/HEAD receipts follow.

## 43. Catalogue size, free hosting and initial search engine researched, 2026-10-14

Owner requested books DB size, free storage providers and search engine. Reused prior verified snapshot/descriptor receipts: core editions/authors/works17.473GBgzip, all-types18.183GBgzip, torrent36.977GB/~34.438GiBwith overlapping files. No normalized/indexed catalogue built; final DB/working space unknown, no download-completion/count/benchmark claim. Fresh exact-project MCP verifies Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn healthy/ap-southeast-2/PG17. SELECT-only whole-app size280259731bytes/267MB, installed pg_trgm1.6 in extensions; this is not Open Library catalogue size or proof that necessary indexes exist. No table/schema/RLS/index/configuration change.

Primary current pricing/rules checked: Supabase500MBFree; Neon1GBPostgres/project plus100CU-hours monthly/project; Turso5GB with read/write quotas; D1 Free500MB/database and5GB/account; Oracle200GBcombined boot/block in home region with free VM capacity/idle-reclamation and self-management limits. Current new-user Cockroach pricing is time-limited credit, not an indefinite free managed offer. No accounts/eligibility/capacity provisioned, no exhaustive-market claim or whole-import fit guarantee. Recommend local subset/size/index measurement first, retaining Supabase app; conceptual PostgreSQL exact-ID/ISBN + full-text/pg_trgm retrieval uses existing installed capability. Retrieval cannot relax identity/known-language/coherent-source/confirmation or held SQL guards. No publication-year cutoff because Owner means second-hand copies.

Authority DOC-3 §§5.1/5.2/5.2.1, picker §§4.1/5-9/13.14 and04 Security §§8-9 unchanged. Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/catalogue-size-free-search-20261014: REPORT.md, recording script and proof receipts. Research only, no imported data/index/service/installation/migration/billing/provider/DB/Storage/job/business/Git/deployment mutation, no new source architecture adopted. Main four-correction work unit/Owner-review handoff and SQL/refresh/publication/rollout holds preserved; M65-M74 immutable/M75 deferred. Exact next research step after Owner confirms completion: core-file validation and bounded factual/index size, coverage and search query measurement before choosing hosting capacity. Continuity/diff/index/HEAD receipts follow.

## 44. Spine-photo title/author priority clarified; Pro budgets researched, 2026-10-14

Owner explicitly corrected earlier ISBN-first research wording: input is book-spine photos, so planned retrieval is OCR title+author first; ISBN is supplementary only when actually available. This supersedes §43's stated ISBN-first proposal for this input, without changing ISBN identity strength, current routing/guards or product implementation. Trace DOC-3 §§5.1/5.2/5.2.1 / picker §§4.1/5-9/13.14 /04 Security §§8-9. Owner also requested Pro support for GB-scale hosting. Fresh primary pricing/disk/compute docs verify Pro$25org/month,$10compute credit,8GBdisk/project,ordinary extra disk$0.125/GB/month provisioned/hourly. Separate File Storage allowance is not database disk. Published guidelines Micro10GBDB/1GBRAM/~$10,Small50GB/2GBRAM/~$15,Medium100GB/4GBRAM/~$60; not measured performance guarantees/hard limits.

Illustrative single-project published-rate budgets excluding taxes/otherusage:8GBMicro~$25;20GBSmall~$31.50;50GBSmall~$35.25;100GBMedium~$86.50. One shared$10credit included; another Micro project adds~$10compute. These are example capacities, not a full-import size prediction or account quote; organization-wide project count not freshly read. Disk/index/WAL/import headroom and spend-cap settings require later capacity review. No project/billing/disk/compute setting changed. Database size still unmeasured; source gzip bytes are not final row/index size. Recommend Pro with measured capacity, not a full-dump file upload or blind canonical import.

Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/supabase-pro-spine-search-20261014: REPORT.md and recording/proof receipts. Only research docs/evidence changed, no implementation/test/migration/DB/Storage/provider/job/business/Git/deployment/billing mutation. Existing main active work unit/Owner-review handoff unchanged; SQL/refresh/publication/rollout held, M65-M74 immutable/M75 deferred. Next research task after Owner confirms completion: core validation and bounded title/own-author sample, retained/index size and query measurement before disk/compute choice. Continuity/diff/index/HEAD receipts follow.

## 45. Populated-catalogue hosting and factual subset extraction explained, 2026-10-14

Owner requested hosting alternatives and how to separate/use part of the downloaded list. Fresh primary managed/VPS/free-VM/SQLite and DuckDB gzip/Parquet docs read. DigitalOcean Basic Regular4GiB/80GiB$24 and8GiB/160GiB$48 are VM examples excluding extras, not actual import/search fit. Hetzner virtual server options observed without a numeric quote; Oracle200GBcombined boot/block constraints retained. No account/capacity provisioning. Conceptual catalogue may be on another host while Auth/inventory stay Supabase; future backend query integration preserves server credentials/authority. No architecture adopted or external connection made.

Recommend smaller factual fields per edition first to preserve coverage, then agreed row criteria if needed. Language/stock/demand examples are not selected filters; no age cutoff because second-hand copies span all publication years. Keep own edition IDs/authors/provenance, optional covers/ISBNs and unknown fields; no arbitrary firstN or cover/ISBN-presence filter. Proposed processing builds local author lookup, streams complete edition TSV/JSON, resolves own refs, filters/projects, retains referenced author rows, exports compact tables, validates counts/joins/rejects/coverage and then loads/indexes approved reference catalogue. Type gzip still needs scanning; torrent cannot select title/language rows. Subset omissions need a later permitted miss/freshness lookup or Owner manual review, not a full-coverage promise or permission to extend persistent caching/TTL/raw storage.

Authority DOC-3 §§5.1/5.2/5.2.1,picker §§4.1/5-9/13.14,04 Security §§8-9 unchanged; main retrieval remains spine OCR title+author,ISBN supplementary. Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/catalogue-hosting-subset-20261014: REPORT.md and recording/proof receipts. No actual subset filter/import/export benchmark, source/code/test/migration/billing/DB/Storage/provider/job/business/Git/deployment mutation. Research notes only; prior local-complete main work unit/Owner-review handoff and all SQL/refresh/publication/rollout holds preserved, M65-M74 immutable/M75 deferred. Next research task after completion: core integrity and bounded factual/index size/joins/cover/query measurement before hosting/scope choice. Continuity/diff/index/HEAD receipts follow.

## 46. Local PostgreSQL tools and partial-import feasibility checked, 2026-10-14

Owner annotations ask local setup complexity and partial import/testing versus whole11-12GBfile. Read-only discovery confirms psql/postgres/initdb/pg_ctl in existing Scoop PostgreSQL bin; sqlite3/duckdb not on PATH,no PostgreSQL-named Windows service returned. Running manually started server/version/cluster/port/extensions not verified; no process/install/connection/DB created. A local PostgreSQL pilot is modest setup and same engine as Supabase; app integration/full hosting are later broader scope. Subset can retain photographed-title plausible editions plus representative sample and own referenced authors, load selected fields/rows,index title+author and test sample coverage/coverIDs/size/latency. Gzip extraction may scan much/all completed input but does not require storing all records/full decompressed copy; no executed filter/import or full-scale performance claim.

Primary PG database/COPY and DuckDB gzip docs read. Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-subset-feasibility-20261014: REPORT.md and proof receipts. Advice only, no new schema/filter/retention/source/adapter requirement under DOC-3 §§5.1/5.2/5.2.1,picker §§4.1/5-9/13.14,04 Security §§8-9. No code/test/download/DB/Storage/provider/job/business/billing/Git/deployment/migration mutation. Main local-complete work unit/Owner-review handoff and SQL/refresh/publication/rollout holds unchanged,M65-M74 immutable/M75 deferred. Next research task after completion: core validation and bounded factual/index sample measurement. Continuity/diff/index/HEAD receipts follow.

## 47. Local search latency target and actual machine resources checked, 2026-10-14

Owner requested private/local DB lookup duration/resources. No catalogue/query benchmark exists; under0.5s/book for selective indexed small-pilot lookups at low concurrency is an advisory target,not measured latency/acceptance requirement. Broad fuzzy/cold/memory-contended queries may take seconds; OCR/network/image/full-photo duration is separate. Fresh read-only Node OS facts:7.921997GiBRAM,0.568008GiBavailable snapshot,4logical CPUthreads/i5-5200U2.20GHz. Separate C:free29222215680bytes/~29.22GB snapshot. No physical-core/disk-medium/throughput/culprit process inferred. Availability changes; recommend small bounded streaming/one worker/low concurrency and roughly1-2GBheadroom planning budget after freeing memory,not a hardminimum/measured usage. No apps closed/configuration changed. Final full catalogue/index/temp/WAL sizes remain unmeasured.

Primary PG17 trigram index/resource and current hosted compute docs read. Indexes/caches avoid broad repeated reads when queries are selective; work_mem can multiply per operation/session and default isn't totalprocess bound. No GPU needed for regular title/author SQL search. Future sample proof should separate cold/warm correctness/timing and record median/tail,size/working memory; no benchmark/index/database/process/import created. Existing locally installed PG tools/readiness limits from §46 retained.

Evidence literal directory C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-search-resources-20261014: REPORT.md and proof receipts. Research only under DOC-3 §§5.1/5.2/5.2.1,picker §§4.1/5-9/13.14,04 Security §§8-9; no new requirements/architecture/retention/adoption. No source/test/download/DB/Storage/provider/job/business/billing/Git/deployment/migration mutation or benchmark claim. Main local-complete work unit/Owner-review handoff and all SQL/refresh/publication/rollout holds unchanged,M65-M74 immutable/M75 deferred. Next research task after completion: core validation and bounded factual/index size,coverage,cold/warm query/resource measurement. Continuity/diff/index/HEAD receipts follow.

## 48. Copied source validated and isolated local catalogue pilot authorized/started, 2026-10-14

Owner approved the in-session isolated local metadata lookup pilot, 2026-10-14. Follow-up question about using the whole catalogue does not authorize starting a full import. Intended eventual coverage is broad; current probe retains a bounded seeded reservoir plus all bounded title probes for the seven photographed books. Four copied archives at E:/Books/Books_dump have passed full gzip decompression; 16.34GiB together and E:111.69GiB free after copy. Fresh tools are PostgreSQL18.4 (including pg_trgm control files) and Node22.13.0; local Supabase remains PG17 and no integration compatibility is claimed.

An isolated cluster/database was initialized at E:/Books/metadata-pilot/pgdata, database/role metadata_pilot, port55432, actual listener127.0.0.1, SCRAM host auth, generated owner-only local password file, shared_buffers64MB/max_connections10. Exact data_directory/database/address/port readback passed before experimental DDL. No existing cluster, app schema or source archive changed. Parser tests were observed RED11/11 and GREEN11/11; SQL tests RED2/2 and GREEN2/2; actual client COPY roundtrip plus all current pilot tests14/14 PASS. Whole archive scan is in progress, with only projected factual fields retained: no raw provider JSON/prose/image files, no work-author/cover borrowing, missing fields explicit. Current actual OCR probe includes Nasrim and Knight; no identity correction is silently applied.

Fresh MCP verifies Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY/ap-southeast-2/PG17; SELECT-only candidate schema and the seven existing scan OCR clues were read. No shared DB/Storage/job/provider/inventory/billing/Git/deployment mutation, no formal migration file or application. Authority: user-approved local experiment; DOC-3 §§5.1/5.2/5.2.1, picker §§4.1/5–9/13.14 and04 Security §§8–9. Main four-correction work unit/Owner-review handoff and SQL/refresh/publication/rollout holds remain unchanged, M65–M74 immutable/M75 deferred.

Exact next authorized research action: finish extraction, bulk-load only the bounded factual sample, measure joins/covers/size/search/resource results, and report a full-import recommendation. Stop before full import or production integration. Evidence C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014 contains PILOT.md, parser/SQL/COPY tests and RED/GREEN receipts, bootstrap/data-directory readback and extraction-progress.log. This is an experimental catalogue, not an approved production schema or new adapter.

## 49. Bounded local catalogue pilot complete; interruption recovered and actual search measured, 2026-10-14

Owner-approved bounded local catalogue pilot completed; subsequent Owner requests to explain/continue and to resume after their own interruption were incorporated. This is supplemental retrieval feasibility research, not a production source/adapter adoption. Scope remains DOC-3 §§5.1/5.2/5.2.1, picker §§4.1/5–9/13.14,04 Security §§8–9 and the explicit local-pilot approval. Main Phase9/Unit6G work unit owner_edition_picker_four_corrections_local_complete_sql_proposals_retained and its Owner-review handoff remain unchanged; SQL/title/diagnostic proposals retained, no current-scan refresh, M65–M74 unchanged and M75 deferred.

The first E: extraction failed after approximately8.5million records with UNKNOWN/read. Windows recorded E: NTFS98 at18:56:46IST and disk controller11 at18:44:37; that controller-event device was not conclusively mapped to the physical external drive. No repair/delete was performed. The E: PostgreSQL process was already absent on the scoped stop attempt; no clean shutdown is claimed. No extraction manifest/sample was loaded from E:, and its experimental files remain preserved. Owner reported their own error and requested continuation. A subsequent read-only start/middle/end check of all four E: archives succeeded,12MiBtotal; this is not a repeat full integrity scan. Already progressing C: fallback work was retained.

Full gzip editions+authors streams from C:/Users/user/Downloads/ol_dump_2026-09-30/Books_dump completed:56,827,250edition rows,15,446,415author rows. Seed19 raw-row reservoir50,000 yielded49,995usable projections, plus1,821photographed-title probes, for51,816distinct editions and47,994own referenced authors. Unselected source-row validity is not measured; no age/cover/ISBN-presence filter. Own refs missing6,392editions; four additional unresolved joins; coverIDs12,217; unknown language6,881. Works/authors/covers are never borrowed into edition identity. No raw provider JSON/prose/image bytes persisted beyond existing downloaded archives, which were left untouched.

New isolated PG18.4 database/role metadata_pilot at C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/data/pgdata, actual127.0.0.1:55432, SCRAM/owner-only generated password,64MBshared_buffers/4MBwork_mem/64MBmaintenance/10connections. Exact directory/database/address/port readback passed before loading. Local factual tables, indexes, materialized search view and client COPY were created/loaded; no existing/shared schema was changed. Extraction696s,peak importer206MiBRSS; factual CSV13.64MiB; load/refresh/analyze11.88s. Database76,641,983bytes/~73.09MiB; entire pilot data directory/~190.84MiB includes cluster/WAL/CSV/logs at measurement. Whole current-layout relations/index extrapolation~64.52GiB, not measured; CSV/WAL/temp/reserve additional. E:111.63GiBfree,C:21.10GiBfree at final snapshot, not fixed capacity promises.

All seven original spine OCR title+author queries return candidates, including Nasrim and Knight. Warm CLI medians113–271ms and separate SQL EXPLAIN execution5.0–72.0ms on the small sample. Each query ran six times; CLI includes fresh psql/auth/connection and first run is not a proven cold-cache measurement. Actual plans/indexes retained. Corrected-author/title-only/synthetic-OCR controls explicitly labelled; suggestions do not confer existing selection eligibility, exact photographic identity or cover availability. Own positive IDs produce URLs, but no image HTTP check/download was performed. No online metadata API calls in local lookups.

Verification actually run: parserRED11/11→GREEN11/11; initial SQLRED2/2→GREEN2/2; stream/lazy-replacement failure evidence→GREEN14/14; complete suite17/17 PASS,0skipped, both before loading and after loading/restart. Tests cover own authors, missingness, UTF8/CSV/COPY, literal/injection inputs, reservoir/source-read error propagation. Windows startup-helper process/output-handle waiting and diagnostic EXPLAIN placement were corrected, with final successful controlled clean C: stop/start in3,887ms and fresh loaded-row/coverage readback. No Python tests ran. This task does not claim a new application browser, full-data or concurrent-store test.

Fresh Supabase MCP read-only identity/schema/OCR evidence earlier in this pilot matched Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY ap-southeast-2 PG17. Shared activity SELECT-only; no Supabase/Storage/inventory/provider/job/accounting/billing write, formal migration-file creation/application, staging/commit/push/deployment. Experimental local DDL/COPY only. Pilot artifacts and scripts are external evidence under C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014; the actual app worktree retains its prior unrelated modifications. Cohesive dated catalogue/Owner research evidence continues in tracker37; no behavior/security/acceptance/source contract is changed by these measurements.

Exact next research action: Owner review of completed REPORT.md/query/coverage/resource evidence and the full-build recommendation. Stop before a full import, production source-contract adoption or BookConnect integration/hosting/rollout. Present extractor deliberately caps50,000sample rows; it is not a completed full-data importer. A separately authorized full build should stream facts directly, not hold millions of objects, and measure index/temp/WAL/headroom before committing all capacity. Current C: pilot remains loopback-only and runnable using lookup.mjs/manage.ps1. No automatic service/scheduled task/remote access was added. Detailed receipts: REPORT.md,PILOT.md,extraction-progress-c.log,data/extraction-stats.json,load-c.log,benchmark-results.json,resource-results.json,external-read-recheck.json,startup-helper-proof.json,final-identity-c.log,pilot-tests-loaded-c.log. Continuity/diff/HEAD/index closeout receipts follow in the same evidence directory.

### 2026-10-14 local catalogue pilot closeout gates

Actual continuity gate PASS:97Markdown files/62required phase files; repository diff check PASS. Git readback:branch codex/edition-picker,HEAD 76348f3076a641d1a2dd6d5cdd6ab439b46da8da,43uncommitted paths,0staged. Existing modifications preserved; no staging/commit/push/deployment/shared application. SCRAM HBA/loopback identity verified; local password-file ACL metadata freshly confirms only the Owner account has an Allow entry. No credential contents were output. Receipts:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/continuity.log,git-proof-close.json,git-status-close.txt,diff-check-close.txt,pg-hba-proof.txt,password-acl-proof.json. Main phase handoff/holds unchanged; supplemental next action remains Owner review of the completed bounded pilot and full-build recommendation.

## 50. Expanded source space and cover ID distinction measured, 2026-10-14

Owner asked which books were retained, the space required to expand the whole current E: folder, next processing steps and whether covers are links/images. Seven titles were test queries; the unchanged pilot retains51,816editions and other source rows remain in the archives. Expanded source measurement:editions62,070,741,695bytes,authors5,958,402,890bytes,works23,680,798,986bytes,cover metadata417,233,633bytes; total92,127,177,204bytes/85.80GiB. Compressed files17,548,669,490bytes; compressed+expanded109,675,846,694bytes/102.14GiB. Fresh E:free119,862,530,048bytes/111.63GiB; saving all expanded copies leaves27,735,352,844bytes/25.83GiB. Editions/authors reuse completed original gzip scan counts, with copied sizes/ISIZE checked; works/covers completed fresh E:read-only gzip count/EOF/CRC verification. No raw expansion saved or source changed. The cover metadata first row has ID,width,height,date, not image payload. Own cover IDs generate URLs; no image download/HTTP probe. Current64.52GiBfull indexed-relations estimate plus working space would not fit together with85.80GiBnew raw expansion in current111.63GiBfree. Recommendation only:later separately approved full importer should stream facts without complete raw copies; present50,000-cap extractor remains a pilot. Exact evidence/methods:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/EXPANDED-SIZE.md,expanded-size-results.json,expanded-size-progress.log. User research approval/DOC-3 §§5.1/5.2/5.2.1,picker §§4.1/5–9/13.14,04 Security §§8–9; no source contract/schema/product/retention change, no shared Supabase/Storage/job/provider/business/Git/deployment/migration/system-repair mutation. No production test rerun needed for this read-only measurement. Main local-complete four-correction work unit and SQL/refresh/rollout holds unchanged,M65–M74immutable/M75deferred. Exact next supplemental action remains Owner review of scope/storage and separate full-import direction; no full build started. Closeout continuity/diff/index/HEAD receipts follow in the same evidence directory.

## 51. Identifiers, duplicate ISBNs, actual search and estimate scope clarified, 2026-10-14

Owner requested unique identifiers first, full Supabase/E: capacity, duplicate handling and actual search. Pilot51,816distinct edition IDs uses OLID M primary key; work W groups editions, author A identifies own author; cover ID identifies image. ISBN9781400063512 appears under four retained Black Swan OLIDs; no canonical merge or selection-predicate change. Current code indexes normalized title/own authors with full-text/trigram,threshold0.4,rank0.65title+0.35author+0.08language,limit10; fuzzy retrieval only, no app integration or online metadata call. Prior64.52GiB/~69.3GBestimate explicitly covers projected editions/authors/search/indexes only, excludes full works/descriptions/separate cover metadata/omitted JSON; full-all-fields SQL size and concurrency remain unmeasured. Fresh Supabase MCP exact project Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY/ap-southeast-2/PG17.6.1.063; org free/tier_free; DB282922131bytes. Schema/PK SELECT verifies canonical works/editions/source/inventory UUID id PKs and distinct source/work/ISBN links; no tenant business rows read or mutated. Fresh official Free500MB/Pro25USD+8GBdisk/0.125USDextraGBgeneral-purpose and provisioned disk pricing read; file-storage allowance separate, no purchase/upgrade/provisioning. Fresh E:111.63GiBfree; current64.52GiBestimate leaves47.11GiB before working space when avoiding raw expansion; no deletion justified or all-fields fit promised. Cloud quota independent of E:; raw85.80GiBexpansion+indexed DB would exceed current E:free. Authority:user read-only clarification,DOC-3 §§4–5,picker §§4.1/5–9/13.14,04 Security §§8–9. Main local-complete Unit6G work unit/release handoff and all SQL/refresh/Git/rollout holds unchanged,M65–M74immutable/M75deferred. No raw/local/shared schema/data/provider/Storage/job/account/billing/Git/deployment/system mutation; no new production tests required. Exact next supplemental action:Owner review of full-import field/storage scope and separate direction. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/IDENTIFIERS-SEARCH-CAPACITY.md,identifier-capacity-facts.json and referenced actual code/plans/size proofs; continuity/diff/index/HEAD receipts follow.

## 52. Full local E:catalogue goal clarified; fresh filesystem warning blocks readiness, 2026-10-14

Owner clarified full own PostgreSQL catalogue on E:with all downloaded book records, future redundant-source removal after validation; cloud hosting is out of current scope. Current turn is understanding/feasibility/hidden-limitations assessment, not a full-build/repair/deletion start. Fresh read-only Get-Volume E:NTFS Warning/Full Repair Needed,fsutil dirty query confirms Volume E:is Dirty; current Disk1GenericExternal USB device reportsHealthy/Online,MediaTypeUnspecified so rotation/USBspeed not verified. Volume507850518528bytes,free119862530048bytes/~111.63GiB; physical device~1TB. This is a concrete current filesystem-readiness warning, not proof of physical hardware failure; previous successful archive reads don't clear it. No CHKDSK/Repair-Volume/dirty-bitset-clear/format/dismount/delete/settings action. Repair would affect all E:files and needs separate direction. Laptop~7.92GiBRAM/i5-5200U/4logicalthreads,1.41GiBavailable snapshot. Current64.52GiBprojected factual catalogue/index estimate is partial-field,not full-all-fields fit;47.11GiBbefore staging/WAL/temp/reserve at current capacity. Full E:performance/index/temp/backup/restoration/update footprint unmeasured. Laptop runs server, external disk holdsdata; power/sleep/disconnect and drive-path/durability requirements matter, remote store access separate. Cover files remain IDs/metadata,not images. All four C:original compressed copies present at expected lengths; no new full integrity/restore claim. Full import must account all rows/rejects/duplicates,resolve own relationships,test unrelated titles and independentbackup/restore before removing E:sourcecopies; keep rebuild source offE. Existing capped extractor/working C:pilot unchanged. Authority:userclarifiedgoal,DOC-3 §§4–5,picker §§4.1/5–9/13.14,04 Security §§8–9;no new product/source/retention/selection contract adopted. Main Phase9/Unit6Gfourcorrectionslocalcomplete and all SQL/refresh/Git/rollout holds unchanged,M65–M74immutable/M75deferred. No cloud connector called this turn, no local/shared DB/source/provider/Storage/job/account/billing/Git/deployment/system mutation. No production test rerun for read-onlyfacts. Exact next supplemental action:Owner review of fresh E:filesystem warning and local-only feasibility; direction on whole-volume diagnostic/repair before full-plan/build. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/FULL-LOCAL-CATALOGUE-FEASIBILITY.md,external-drive-capability.json,external-volume-dirty-query.txt,original-source-copy-presence.json. Read-only commands exited0;continuity/diff/index/HEAD receipts follow.

## 53. Read-only filesystem diagnosis; repair held and local source/quality tests, 2026-10-14

Owner clarified this is local validation before later rented-server deployment, not production hosting from the laptop; requested filesystem diagnosis, exact PostgreSQL setup explanation and resource/data tests. Completed read-only chkdsk E: with no flags found incorrect NTFS $I30 directory-index entries and exited3 at2026-10-14T16:45:16Z; no completed clean-volume result. Dirty bit/Get-Volume warnings corroborate concern; this does not establish particular archive damage or physical disk failure. Owner explicitly selected Keep diagnosis only for now; no /f,/r,/x,/scan,Repair-Volume,dismount,dirty-bit mutation,source deletion or heavy E:build. PostgreSQL18.4 was already installed via Scoop on C:current->18.4-2; existing initdb/pg_ctl/psql created isolated E:cluster at127.0.0.1:55432/SCRAM, no installer/service/remote exposure; E:extraction interrupted before sample load, successful51,816edition/47,994author pilot is on separate C:cluster. New read-only pilot-quality SQL verifies zero duplicate edition/author/search IDs, exactly one search row peredition, four unresolved own author IDs,6,392editions without own author references,6,881unknownlanguage,12,217owncoverIDs,18ISBNvalues shared acrosseditionIDs,12page-count>10,000reviewflags. Twelve additional reservoir title+ownauthor searches all retrieve knowneditiontop10 in141-281ms including CLI; unrelated title+author control empty; retrieval consistency only, not semantic ground truth or full-scale throughput. Full C:source archive audit is running: UTF8/gzipEOF/CRC/rowJSON/identity/missingness/ownref checks with exact IDs and shared96MiBbitmap ceiling; helper5/5RED->5/5GREEN. No complete raw expansion saved, no source changed; full-source completion not yet claimed. Machine~7.92GiBRAM/4logicalthreads sufficient for observed bounded tests, not proven full indexed search; full E:build held duefilesystem, C:~21GiBfree cannot fit priorpartial64.52GiBprojection. Scope authority:usercurrentexplicittestdecision,DOC-3 §§4-5,picker §§4.1/5-9/13.14,04Security §§8-9; no product/source/eligibility/retention adoption. New evidence-only scripts/reports and continuity edits, no production/app code change; no Supabase/cloud connector, shared DB/Storage/provider/job/business/schema/formalmigration/Gitpublication/deployment/systemrepair/source deletion. NoPython tests run. Main Phase9/Unit6Gfourcorrectionslocalcomplete and SQL/refresh/Git/rollout holds unchanged,M65-M74immutable/M75deferred. Exact next supplemental authorized action:complete running read-only C:archive audit/report exact findings; full indexed build requires healthy adequatecapacityvolume, repair remains held. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md,pilot-quality.sql,pilot-quality-results.json,pilot-quality-examples.json,sparse-ids.test.mjs,source-id-red.log,source-id-green.log,full-source-audit-progress.json,external-chkdsk-readonly-result.json,external-chkdsk-readonly.log. Closeout continuity/diff/index/HEAD receipts follow; full-source final outcome will supersede running status explicitly.

## 54. Full original-source structural audit completed; full indexed search still held, 2026-10-14

The diagnosis-only source audit from §53 is complete; repair remains explicitly held. All four original C: gzip streams reached EOF/CRC and fatal UTF-8 decoding, decoded-byte lengths match prior independent measurements, total92127177204bytes/85.80GiB; no complete raw copies saved. Actual counts:56827250edition rows,15446415authors,41666337works,14938996cover metadata rows; zero JSON/row parse failures and zero duplicate validated IDs. Seven edition identity mismatches are accounted separately;56821543editions pass the existing pilot projector,5700additional identity-valid editions do not meet current field bounds. These bounds are not a universal source-invalidity rule and a full importer must retain row/rejection accounting. Authors2316missingnames/2317outside name projector;works131missingtitles. Own-reference exact bitmaps:70unique referenced author IDs absent from author records,2321without a projectable name,446edition work IDs absent from identity-valid works. All13191081distinct selected positive own cover IDs have cover-metadata entries; this is mapping coverage,not HTTP/JPEG availability. Raw editions13193140own positive cover-ID records,2055286own descriptions,35748277positive page counts;works1948759descriptions. Cover metadata77789dimension-field flags, zero column-count/ID/date flags; nonpositive/invalid dimensions are not a JPEG decode test. No image/metadata API GET made. Full source audit completed2026-10-14T18:16:48.706Z,elapsed4262s,peakNodeRSS126.3MiB,shared bitmaps29753344bytes; bounded ID helper5/5RED->GREEN, source readback3/3actual assertions PASS. Existing C:pilot read-only profile and12reservoir title+author consistency queries/negative control retain §53 proof; no all-catalogue indexed DB created, no production concurrency/semantic-ground-truth/restore test claimed. User intends later rented-server deployment; laptop only local validation. E:readonlyCHKDSKexit3/currentWarning/Full Repair Needed unresolved, repair declined; no E:repair/forced dismount/dirty-bit/source deletion/heavy build. Existing ScoopPostgreSQL18.4 initialized E:experiment but completed51,816edition pilot is on C:. Source archives unchanged; no schema/catalogue/appcode/sharedprovider/Storage/job/DB/formalmigration/cloudconnector/Gitpublication/deployment mutation. New evidence/continuity files only, noPython tests. Authority:usercurrentexplicitlocaltest/diagnosis-only decision,DOC-3 §§4-5,picker §§4.1/5-9/13.14,04Security §§8-9; no product/source/retention/eligibility adoption. MainPhase9/Unit6Gfourcorrectionslocalcomplete and all SQL/refresh/Git/rollout holds unchanged,M65-M74immutable/M75deferred. Exact next supplemental authorized action:Owner review of completed source/quality proof and full-import accounting scope; full indexed build needs a healthy volume with adequate working capacity, repair remains held. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md,full-source-audit-results.json,full-source-readback-proof.json,full-source-audit.log,pilot-quality-results.json,diagnosis-resource-snapshot.json,readiness-sources.json/html. Current closeout continuity/diff/index/HEAD receipts follow; no completion of an unrun full indexed benchmark is inferred.

## 55. E: pilot restore/restart passed; full main-metadata catalogue authorized and importing, 2026-10-15

The Owner challenged the prior filesystem warning as an absolute blocker and directed proceeding on E:. That warning is a residual risk, not a technical prohibition. Repair remains explicitly declined/diagnosis-only; no CHKDSK repair, dismount, dirty-bit change, source deletion or existing-folder overwrite is authorized. User scope choice: all books with main metadata, not preservation of every original JSON field. Latest direction: ignore C: and concentrate on E:. Subsequent full import reads only E:/Books/Books_dump and writes the new isolated E: catalogue; no C: database/source work continues.

Actual E: readiness proof: fresh E:/Books/metadata-e-trial-20261015/pgdata, loopback 55433, restored 51,816-edition/47,994-author pilot with all three ordered record/search digests equal before/after a clean 7,210 ms restart. Twelve known-record title+author searches passed; unrelated control returned zero. New trial database 74,847,935 bytes, export 4,729,852 bytes. This does not clear E: Full Repair Needed or establish full-scale indexed performance.

Full local mutation now authorized and started: new E:/Books/metadata-full-20261015/pgdata, metadata_catalogue role/database, loopback 55434, owner-only SCRAM password file. Existing Scoop PostgreSQL 18.4 binaries reused; no service/provider installation. fsync/full_page_writes/synchronous_commit/checksums ON; 128 MB shared buffers, 8 MB work memory, 128 MB maintenance memory. Separate authors/works/editions/cover tables plus quarantine and ingest checkpoints. Main metadata includes nullable titles/names, subtitles, own author/work references, language, all publishers, date/edition/format/pages/pagination, ISBN10/13 source values, own cover IDs and separately attributed edition/work descriptions. Source ISBN strings are retained; they are not asserted valid eligibility evidence. No representative-cover or work-author borrowing. Cover metadata is ID/dimensions/date, not JPEG images or HTTP availability. Private experiments do not adopt this source or alter application selection/retention.

Plan and tools: C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/PLAN.md, records.mjs/tests, stream.mjs/tests, schema.sql, db.mjs, bootstrap.mjs/control.ps1, integration.mjs, import.mjs, index.mjs/search.sql. Eight projector tests RED→GREEN and two streaming/backpressure/CRC tests RED→GREEN. First live batch committed 200,000 authors; next failed on author row 278,347 containing ASCII26/Ctrl-Z, which Windows psql interpreted as EOF. Read-only proof shows checkpoint and row count both exactly 200,000; failed batch rolled back. A new focused control-character test and actual PostgreSQL COPY case failed before the octal escape correction; all 11 unit tests and actual Unicode/null/array/terminator/Ctrl-Z COPY and checkpoint rollback proof now PASS. Build resumed from the durable checkpoint, not a report-derived position; no truncate/reset. Progress may advance after this checkpoint and is owned by PostgreSQL ingest_checkpoint plus progress.json/build-resumed.log. Completion/index/benchmark/restart of the full catalogue is not yet claimed. Fifteen GiB free-space guard and CRC/UTF8/error halts preserve diagnostic evidence and originals. Streaming avoids complete raw expansion and full CSV staging; indexes follow ingestion.

Authority: current explicit Owner local E: test/build and main-metadata decision; DOC-3 §§4–5, picker §§4.1/5–9/13.14 and 04 Security §§8–9 constrain provenance and scope. Main Phase 9 / Unit 6G workunit owner_edition_picker_four_corrections_local_complete_sql_proposals_retained and release handoff unchanged. No Supabase/shared DB/Storage/provider/appcode/formal migration/current-scan refresh/Git staging/commit/push/deployment. M65–M74 immutable, M75 deferred. No Python tests. Exact next supplemental authorized action: complete/checkpoint all four E: archive imports, build native title-and-author indexes under the space guard, then verify row accounting, actual sizes, metadata/restart and full-search timings. Filesystem repair and deleting originals remain held.

## 56. Full E: import paused after a reproducible data-block read error, 2026-10-15

The authorised E: import exposed a repeatable storage read failure during PostgreSQL's automatic vacuum of the completed authors table, relation base/16384/16467, block2450. The PostgreSQL log records Windows I/O worker error code23 and failure reading that block. Read-only Windows lookup maps 23 to "Data error (cyclic redundancy check)". Independent read-only PostgreSQL TID-range scan of the same authors block fails with "could not read blocks 2450..2450 ... Invalid argument"; direct fs.readSync of that exact E: file/block returns EIO. This confirms an actual read-path failure on E:, not just the previously known volume-health warning. It does not diagnose the physical medium or prove all other blocks/source archives are damaged. No CHKDSK/Repair-Volume, dismount, clear-dirty-bit or file deletion was run.

The import client (PID 32404, uniquely matched by command line) was stopped after this proof; verify that exact process is absent before any resume. The E: PostgreSQL server remains loopback-only on 55434. PostgreSQL durable checkpoint: authors 15,446,415/15,446,415 rows, EOF/CRC/UTF8 complete, zero quarantined, compressed SHA-256 d374d84a48ddbec3d717c78e5f0b39705fdad728fbc66371a454fc87f23f7044. Works 600,000 source rows loaded and 0 quarantined, then stopped; 40,666,337 expected. Editions and cover metadata not started. No indexes, full counts, search benchmark or clean full-database restart have been proved. The already committed E: author table has a page unreadable in two independent read paths and must not be called a reliable searchable catalogue.

User asks whether GPT-6 Luna at Max can continue; current session model is GPT-6 after the change. OpenAI official GPT-6 Luna model documentation says supported reasoning efforts include max and describes Luna as efficient for focused/high-volume tasks: https://developers.openai.com/api/docs/models/gpt-6-luna . Changing model does not address the E: OS I/O failure. The E: full import remains diagnosis-held, consistent with the Owner's earlier "Keep diagnosis only for now" filesystem-repair decision. Do not resume the bulk import/index build or run any volume repair without further evidence/explicit direction. Keep all originals and partial E: checkpoint data for diagnosis.

Evidence: C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/io-probe-results.json, io-probe.log, postgres.log on E:/Books/metadata-full-20261015, progress.json, build-resumed.log. The read-only phase-continuity validator and git diff check passed immediately before this bounded I/O probe; rerun after this status update. Phase9/Unit6G picker corrections, M65–M74 immutability, M75 deferred status, SQL/refresh/release/Git holds unchanged. No C: database/source reads, Supabase, shared mutation, migration, deployment, source deletion, or repair.

## 57. Explicit edition matching, client prompts and M76, 2026-10-16

Authority: in this session the Owner reviewed a read-only diagnosis (live Supabase reads of the active scan 7a81bdb6-ed34-40cb-b5a9-cff85402cf48), chose matching fixes for real cards (Encyclopedia "J. O. Urmson"/"Jonathan Ree"/"&", Charles Peirce "Knight", unknown Open Library language) and client fixes 4-6, then authorized implementation, commit/push and preflighted M76 application, stopping before the Render metadata-worker deployment and app publication. The vision-prompt tweak and OCR "did you mean" suggestion were not taken. Sources: DOC-3 §5.2.1 (2026-10-16 amendment), picker SDD §§3.1/4.1, existing EP-AC02/05/11/13-15/18-20; no acceptance ID added.

Live read-only findings (fresh MCP, ahntbtktjjmvfosgkmgn): latest migration M74 20261012140853; Google and Open Library enabled with matching/storage allowed; six edition jobs ever, one exhausted in_progress job on the closed-scan card f387251c (M75 not urgent); four edition-state rows, none fresh, two selections (Black Swan, A Hundred Years of Philosophy). Four of five unfinished active-scan cards never ran Search Books. Detected identities include "Nasrim Nicholas Taleb" (OCR typo), "Knight" (surname only) and "J. O. Urmson"/"Jonathan Ree" with "&".

Implementation:
- supabase/functions/_shared/imageInventory/metadata/explicitEditionTitle.ts: shared title/author keys and title, author and language rules; googleBooks/editionOptions.ts and openLibrary/normalizer.ts use them. Query identity and stored metadata are unchanged; automatic ranking is untouched.
- supabase/migrations/20261016000076_marketplace_phase9_edition_explicit_matching.sql (M76): new private IMMUTABLE helpers phase9_edition_title_key, phase9_edition_author_key, phase9_edition_explicit_query and phase9_edition_rejection_reason (postgres-only); CREATE OR REPLACE of phase9_edition_option_eligible (rewrites only matched query fields, preserves the exact-ISBN und exception, then reuses the strict identity check) and phase9_edition_choices (M70 body plus opt-in reasons from the retained proposal, now using the same comparison). phase9_edition_identity_compatible (automatic/current suggestion) is unchanged.
- Client: CandidateEditionPicker offers "Edit title/author" (existing manual path) when a fresh set has no eligible row; CandidateMetadataSheet shows a caller-supplied disabled reason; BatchReviewCard explains the unsaved title/author lock; the trigger reads "Find or change edition".
- Tests: supabase/tests/phase9/explicitEditionMatchingCases.json (22 shared cases), supabase/functions/__tests__/phase9_edition_explicit_matching.test.ts, supabase/tests/phase9/phase9EditionExplicitMatching.integration.test.mjs, five new sheet-state tests.

Verification actually run: new Jest matching plus title-variant 72/72; full Jest 343 suites, 3,491 passed, 0 failed, 4 pre-existing skips; M76 SQL 32/32; baseline M76_BASELINE=1 run shows 7 expected RED shared cases and proves a worker-only release is rejected (P9_EDITION_ROWS_INVALID); existing edition/Open Library SQL suites 288/288; structural worker 14/14; tsc --noEmit and metadata-worker build exit 0. No browser/native or live Search Books run.

Preflight (read-only): PostgreSQL 17.6 UTF8, standard_conforming_strings on; live phase9_edition_option_eligible body md5 517effed7983095e6886714eade0a42e and phase9_edition_choices 58e1c098c958aeee8b4bb049faf84e6c equal the local M68/M70 bodies; both postgres-owned, ACL {postgres=X/postgres}, empty search_path; the four new names are absent; live accent-folding probe returned "Jonathan Ree"; 0 fresh option sets. The sibling worktrees named in AGENTS.md are absent on this machine; the main checkout's unapplied Unit 6I M63/M64 do not touch edition functions.

Migration ledger: M76 20261016000076_marketplace_phase9_edition_explicit_matching.sql CREATED_LOCAL and committed; live version, application and readback are recorded in §58. Compatibility: SQL admits a superset of the old worker's eligible rows, so applying M76 before the new worker is safe; old clients/API keep the legacy response shape; reasons need the compatible Owner API header forwarding, which is not deployed. M75 deferred; no current-scan refresh is needed (no fresh sets).

Release holds: Render metadata worker, Owner API, client publication and live acceptance are not performed in this session. The catalogue-import notes in §§35-56 are committed unchanged as part of the worktree branch.

## 58. M76 applied and verified, 2026-10-16

Authority: the Owner's instruction in this session to apply the migration after preflight and to stop before the Render deployment. Before application the committed file was corrected twice without behaviour change (cc5e944): the accent range is built with pg_catalog.chr(768)/chr(879) so the applied SQL is plain ASCII, and the worker helper uses the readable U+0300-U+036F regex escape. After the change: M76 SQL 32/32, baseline 7 RED, matching Jest 72/72, worker build and tsc PASS.

Fresh pre-application re-verification (Supabase MCP, ahntbtktjjmvfosgkmgn): latest migration 20261012140853; phase9_edition_option_eligible md5 517effed7983095e6886714eade0a42e and phase9_edition_choices md5 58e1c098c958aeee8b4bb049faf84e6c unchanged; new helper names absent; 0 fresh option sets.

Application: apply_migration name marketplace_phase9_edition_explicit_matching, exact content of supabase/migrations/20261016000076_marketplace_phase9_edition_explicit_matching.sql at commit cc5e944 (SHA-256 90a6dfca30064866e8ab9ceb46d0491cdda7460bd8d74abb0d81ace62d53052f), result success. Live version 20261016153615.

Readback: body md5 equals the committed file for all six functions: phase9_edition_author_key e504d64e1dd0027d8a4dbc1e60798620, phase9_edition_choices 74bd8d4f44173f37bed5f2e508247a1b, phase9_edition_explicit_query 75a3eae62538cb3f00a7013de3c3b575, phase9_edition_option_eligible 02cf6ed61f9814fe36043848f03e17e1, phase9_edition_rejection_reason 1cbb8c6a9b65b786b13cf097f663eaf5, phase9_edition_title_key 21995cf4bf5da5721632b23d9babd247. phase9_edition_identity_compatible remains 87e07224072d8b512c938c12e23e43ef. All are postgres-owned with ACL {postgres=X/postgres} and search_path=""; helpers IMMUTABLE; choices STABLE SECURITY DEFINER. After three MCP connection timeouts, a read-only live probe succeeded: author keys "J. O. Urmson" -> jo urmson and "Jonathan Rée" -> jonathan ree, English title key "&" -> and; explicit eligibility true for the Encyclopedia, Charles Peirce/Knight and unknown-language Unended Quest cases and false for the Antifragile OCR typo and a different title, while phase9_edition_identity_compatible (automatic) stayed false for all five.

Mutations: one migration application (functions only). No table, row, job, selection, inventory, Storage, provider flag, Auth or configuration change. Not performed: Render metadata-worker deployment, Owner API deployment, client publication, current-scan refresh (none needed: no fresh sets), M75, live Search Books acceptance.

Next: Owner decision on deploying the codex/edition-picker metadata worker to Render; then Owner API/client publication and a controlled live Search Books check on Antifragile (after correcting the author), Charles Peirce and the Encyclopedia.

## 59. Independent review findings and worker/app corrections, 2026-10-16

Authority: the Owner asked for Haiku review agents, then authorized fixing the worker rules, Open Library ordering, app prompt and SDD wording without creating M77, committing and pushing, and stopping before any migration or deployment. Three read-only reviewers (SQL, worker, app) reported; every finding below was re-checked by direct code reading or a local probe before disposition.

Confirmed and corrected (worker; live M76 stays a superset, so completion is unaffected):
- Surname rule accepted a first name from a comma-form provider name ("John" vs "Smith, John") and joined initials as a surname ("J. O." vs "Ann Jo"); probe confirmed both true. Now surnames come only from uninverted provider names and the supplied author must be one word of two or more letters.
- Accent folding stripped Cyrillic/Greek marks ("Йод" matched "Иод"; probe confirmed). Now only marks following Latin letters a-z fold.
- Open Library prioritisation let unknown-language rows consume the four-author budget before known-language rows (adapter page-order allocation confirmed). openLibraryIdentityPriority now orders known-language identities first; a multi-row adapter test fails on the old ordering and passes now.

Confirmed and corrected (app): the "Edit title/author" prompt appeared when every row was only unavailable and over an Owner-confirmed selection (pressing it switches to manual and drops the selection id from the draft); both cases are now excluded, and the explanation has a polite live region. Normative "Change edition" wording in the picker SDD is updated; historical tracker text is unchanged.

Noted, not changed: Greek final sigma and other toLocaleLowerCase vs SQL lower() differences pre-date M76 and fail closed (a TS-eligible row could make completion reject the set); isbn10 acceptance in the strict SQL identity path pre-dates M76; SQL exception handlers map defects to a normal rejection (fail-closed by design); hyphen/apostrophe/comma name variants stay unmatched by design; a pre-existing mounted test can exceed 5 s only under heavy parallel load.

Proposed M77 (NOT_CREATED / NOT_APPLIED): narrow phase9_edition_title_key/author_key/explicit_query to the corrected worker rules for exact parity. Not required for safety because SQL remains a superset.

Verification actually run: matching, title-variant and all Open Library Jest suites 133/133 before the import tidy, explicit matching file 58/58 after it, with the budget test RED on the old ordering; sheet-state suite 28/28; full Jest, tsc, worker build, M76 SQL suite and the continuity validator are recorded in the closeout entry below. No database, Storage, provider, Render, Owner API or client deployment mutation.

Closeout verification (2026-10-16): full Jest 343 suites, 3,500 passed, 0 failed, 4 pre-existing skips; tsc --noEmit and metadata-worker build exit 0; structural worker 14/14; M76 SQL 32/32 (SQL unchanged); Phase 9 continuity validator PASS; no literal combining characters in changed code. Nothing applied or deployed.

## 60. Owner-requested self-review and live parity check, 2026-10-16

Authority: after §59 the Owner asked for a direct review rather than reliance on the Haiku reports. Read-only throughout: no source, migration, data, provider, Render, Owner API or client change in the review itself. This entry is documentation only.

Process note: M76 was applied (§58) before any independent review, and the original rule tests used only the author's own examples. The §59 edge cases (comma-form and joined-initial surnames, non-Latin marks, Open Library budget ordering) were therefore found after application. Future migrations in this work unit get an independent review before preflight/application.

Query-side parity: requestFromMetadataContext rebuilds the query in TypeScript and throws P9_METADATA_QUERY_IDENTITY_MISMATCH unless its key equals the SQL query identity, so worker and SQL compare against byte-identical query text; they can only diverge on provider-text normalization.

Live collation (read-only): datcollate/datctype en_US.UTF-8, provider ICU; lower('ΟΔΟΣ Ὅμηρος İSTANBUL ÉTÉ ЖУК') = 'οδος ὅμηρος i+U+0307 stanbul été жук', matching JavaScript toLocaleLowerCase. The §59 Greek final-sigma note applies only to the disposable PGlite harness (C-locale lower), not production.

Live parity check (read-only, one SELECT against live M76 functions, no writes): 190 distinct generated cases (title variants: leading The, & / and, accents, case, spacing, Cyrillic/Greek; author variants: initials, comma form, surname-only, first-name-only, accents, case, typo; languages en, en-GB, fr, ru, el, und). Corrected worker (bbc93ea build) accepted 44, live SQL 33. Fifteen worker-yes/SQL-no cases all used provider titles with repeated internal spaces supplied raw; both real decoders (Google normalizeGoogleEditionRows and Open Library normalizeOpenLibraryRows) collapse spacing before storage (verified: "Les   Misérables" -> "Les Misérables", eligible), and live phase9_edition_valid_metadata rejects the uncollapsed form, so production never submits that shape. Four SQL-only cases are the documented superset edges (Greek tonos folding; "Hugo, Victor" surname). Result: no reachable case where a worker-eligible row is rejected by live M76.

Disposable PGlite fuzz (2,619 query-consistent cases, 1,381 skipped where TS and C-locale SQL query normalization differ): 0 worker-yes/SQL-no.

Review of final app and Open Library code: the Edit title/author prompt is limited to fresh sets with no eligible row, at least one genuinely ineligible row or no rows, and no Owner-confirmed choice; an unconfirmed automatic suggestion can still be replaced through the same manual path as the existing Edit manually button. Open Library ordering serves known-language identities before unknown-language ones, each in page order, then the remaining safe rows. Minor: an empty fresh set shows both "No book results were returned." and the no-match prompt.

Haiku report disposition: confirmed real and fixed in §59 (comma/initials surname, non-Latin folding, Open Library ordering, prompt cases, SDD wording); not applicable in production (Greek final sigma under ICU); pre-existing and fail-closed (isbn10 strict-path acceptance, exception masking by design).

Decision support: M77 is not required for safety; live M76 accepts every reachable worker-eligible row and selection still requires the worker's stored eligible flag. M77 stays PROPOSED / NOT_CREATED / NOT_APPLIED as an optional exact-parity cleanup. Remaining real risk is untested behaviour on real provider data until the worker is deployed and a controlled live Search Books check runs.

Evidence files (scratch, not committed): parity-fuzz.mjs, live-gen.cjs, live-compact.cjs, live2.cases.json, live2.sql in this session's scratchpad. Next authorized action unchanged: Owner decision on the Render metadata-worker deployment; M77 creation separately.

## 61. Metadata sheet loading-flash fix, 2026-10-16

Authority: Owner approved fixing the flash found in the read-only local UI check. Client-only change; no migration, no database or storage write, no Render, Owner API or client publication.

Finding: while the first candidate-detail read was in flight, CandidateMetadataSheet showed "Loading metadata…" together with the red "Metadata details are unavailable right now." block and Retry, because the error condition did not exclude the loading state. It was a transient display fault, not a failed read.

Fix: the unavailable block and Retry now render only when `!query.isLoading` and (read error, or no detail, or no current detected identity).

Tests: two new tests in ownerEditionPickerSheetStates.test.tsx ("metadata detail loading state"): pending first read shows only the loading text (RED before the fix); a genuinely failed read still shows the error and Retry after loading ends. Verification run: src/features/imageInventory 770 passed; full Jest 3502 passed, 4 skipped; tsc --noEmit clean.

Database/storage mutations: none. Next authorized action unchanged: Owner decision on the Render metadata-worker deployment; M77 stays PROPOSED / NOT_CREATED / NOT_APPLIED.
