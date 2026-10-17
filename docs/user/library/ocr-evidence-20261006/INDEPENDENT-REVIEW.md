# OCR U1 independent review — 2026-10-06

Reviewer: user-requested gpt-6-luna, high reasoning, separate read-only agent. Primary agent verified findings against current source and added one isolated mocked cancellation reproduction. Workspace: Bookconnect4_library / codex/library-cover-shelf; extensive mixed changes preserved. Marketplace Phase9 Unit7C/M46 and DOC13/ACTIVE status unchanged. Review is not release or cloud-enablement approval.

## Verdict

Bounded native offline smoke evidence is credible, and existing six focused suites pass59/59 on the reviewer's fresh run. Three source/configuration findings remain open; one minor documentation inconsistency was corrected during closeout. U1 stays partial. No application source, build configuration, dependencies, migrations or external state changed in this review.

## R1 — Development package ID applies to every EAS profile (Luna P1, release gate)

Evidence: app.json:41 sets android.package=com.bookconnect.library.dev globally. eas.json:13–24 defines preview/production without identifier overrides; no dynamic app.config file exists. The native proof explicitly limits this identity to development, but the configuration does not enforce that limit. A later preview/production build would use the development ID. This does not invalidate the current development smoke test; it blocks safe preview/production preparation.

Recommended correction: scope the dev identity to development builds and fail closed for preview/production until the release package is approved. No approved previous release package was found in the committed app.json; do not invent one or claim an existing application identity was restored. Verify resolved configuration for all profiles without a deployment.

## R2 — Review overflow is labelled as a 500-word cut and can be saved (Luna P2)

Evidence: ocrService.ts:24–28 bounds review text at20,000 code points and sets reviewOverflow. NoteEditor.tsx:189–192 maps that flag to wasTruncated; :362–365 renders Truncated to500 words. Edit before saving. canSave at:253 checks only nonempty state/busy/500-word count. A single whitespace-free token exceeding20,000 code points is capped, sets overflow, counts as one word and remains note-save eligible. No explicit incomplete-review decision is required. Primary source verification confirms the same issue applies to initial OCR prefill, not only future cloud output.

Recommended correction: separate extraction overflow from save word limits, disclose the actual review bound and block incomplete review saves until an explicit passage/partial-text decision or recapture. Editing must not clear overflow merely because word count falls below500. Add a focused editor regression for overflowed long tokens and truthful status copy. Full U2 passage-selection UI can stay deferred; the current U1 warning/save-state defect still needs correction.

## R3 — Already-aborted Edge requests can reach mocked provider egress (primary P2 before cloud enablement)

Evidence: handler.ts:54 subscribes to future abort events but never reads req.signal.aborted before work starts. A previously aborted request does not fire a new abort event; the internal controller stays active through authentication/quota/egress checks.

Isolated reproduction used the exact handler.ts transpiled in memory with Node's Request/Response and mocked authentication/quota/fetch. AbortController.abort occurred before constructing the POST Request. Result: preAbortedRequest=true, status=200, mockedEgressCalls=1. No real provider or database contacted; no test source added. Current production entrypoint has no durable quota adapter and stays CLOUD_DISABLED, so this is a blocker before enabling cloud rather than evidence of a current upload.

Recommended correction: propagate pre-existing request cancellation immediately and test that neither quota reservation nor provider dispatch happens for an already-canceled request. Preserve the existing bounded timeout/late-egress fences. Cancellation cannot undo an already-dispatched provider call.

## R4 — SDD native-status headline contradicted its own proof (Luna P3, resolved)

SDD-03 line3 said real native OCR unverified while line5/section11 recorded a verified bounded Android smoke. Primary corrected the headline to bounded Android offline native smoke verified; full native/cloud acceptance pending. No completion status or product scope expanded.

## Verification and limitations

Luna fresh exact-path Jest: six suites /59 tests PASS (OCR editor/service/Edge core/word bounds/vault service/migration source contract). Primary cancellation probe output above is mock-based; it does not claim a live provider failure. Source/configuration findings R1/R2 verified directly; no new native build, camera/save run, provider call, Deno graph compile or full TypeScript run during review. Prior native-result.json matches logged raw text and2664/1052/1044ms timings. Temporary probe source calls recognizePageText directly and was removed from app routes.

Existing acceptance debt remains explicit: camera-to-save, representative printed pages, language/iOS/web parity, physical-device resources/p95, durable quota contention and live cloud inference. One public sign on an emulator does not establish these. Review found no evidence that the smoke result or59-test claims were fabricated, and no automatic cloud upload was introduced in the reviewed local-first path.

Exact next authorized action: report this verified review to the user. Proposed correction unit: resolve R1/R2/R3 locally with targeted regressions/config-resolution checks before proposing cloud quota migrations or deployment. Release package identity remains a required product/configuration decision. No staging, commit, push, database/Storage/provider writes, migration creation/application or deployment; mixed changes preserved.

Closeout: cancellation probe repeated with the real Google JPEG, unchanged result plus quota mock1, recorded in review-preaborted-result.json. Reviewer's59 tests PASS; continuity PASS (195 definitions, zero duplicate/missing,76 Markdown files), diff hygiene PASS, staged diff empty. No source/config correction in this review; three findings remain open.


## Subsequent authorized correction — 2026-10-06

Original verdict above is historical review evidence. R1 and R2 are now corrected locally: dynamic development/release identity gate and truthful character-overflow warning with explicit partial-review save consent. R3 remains open and explicitly deferred by user; no cloud handler correction was made. R4 remains resolved. U1 remains partial; these corrections do not establish release/cloud or full native acceptance. Focused regression/configuration verification is recorded in the Library tracker.


R1/R2 verification: seven exact-path Jest suites /66 tests PASS. Actual @expo/config readback: development resolves com.bookconnect.library.dev; preview/production reject absent release identity and resolve com.example.approvedfixture only when explicitly supplied for the test (fixture is not an approved product identity). Root TypeScript:36 pre-existing E2E/Phase9 diagnostics, zero OCR/NoteEditor diagnostics. Phase9 continuity PASS (195 definitions, zero duplicate/missing traceability,76 Markdown files); git diff --check PASS and staged diff empty. Long established logs remain cohesive dated evidence; size notices are advisory. Fresh native rebuild/camera-to-save and live cloud/provider testing NOT_RUN. No database/Storage or external mutation. Web export result recorded separately below when complete.

Fresh correction web export PASS (2,342 modules; 5.48 MB entry), temporary BookConnect-ocr-review-corrections-web output; existing app preview not replaced. Native rebuild and rendered-device review of these two changes NOT_RUN. Final active unit/next action unchanged: report the completed R1/R2 fixes; R3 explicitly deferred, U1 partial. Nothing staged, committed, pushed, deployed or applied.
