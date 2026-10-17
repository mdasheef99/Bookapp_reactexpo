# OCR U1 local correction evidence — 2026-10-06

Current status: local corrections and bounded Android offline native service/module sample proof PASS; full U1 native/cloud acceptance remains partial. The final Android section below supersedes the earlier runtime attempt. Marketplace Phase 9 completed Unit 7C/M46 remains unchanged. User authorized corrections and testing with a Google image. No database/Storage mutations, migration creation/application, provider upload, deployment, staging, commit or push.

## Implemented scope

- ML Kit 1.5.2 default import and object-result contract corrected; English Latin local extraction supported. Other language selections report unsupported local script and require explicit cloud consent; native Hindi support awaits proof.
- Versioned full review text is retained up to 20,000 Unicode code points; notes over 500 words cannot silently truncate on save. Vault bounds and excerpts count Unicode code points. Larger passage selection remains U2.
- Cloud retry requires per-image confirmation; no automatic upload. Capture cancellation, account change, editor close and stale results clear/ignore image work. Safe errors and 30-second deadlines preserve existing editor text.
- Edge handler validates authenticated identity, bounded JSON/image payload, provider errors and output. Uses DOCUMENT_TEXT_DETECTION. Production entrypoint has no durable quota adapter: CLOUD_DISABLED is mandatory until separately approved provisioning. No process-local quota substitutes for persistent reservations.
- Gallery/crop/selection/detail/overwrite completion, local draft recovery, capture search/export and resurfacing remain U2–U5. This checkpoint does not claim those features.

## Verification

Six explicit-path Jest suites: **59/59 PASS** (NoteEditor OCR, service, Edge core, word bounds, vault service, migration source contract). These are mocked/unit/source-contract checks, not provider inference or live save tests. New coverage includes consent, cancellation/account isolation, timeout, malformed/oversized images, provider failures, Unicode limits and retained text beyond word 500.

Strict standalone TypeScript check of handler.ts: PASS. Initial PowerShell unquoted --lib argument was rejected; quoted rerun passed. Root typecheck and web export results are recorded in the tracker closeout and accompanying text logs. Deno runtime compilation is NOT_RUN (Deno unavailable).

## Google image and runtime attempt

Source: [Google Cloud OCR documentation](https://docs.cloud.google.com/vision/docs/ocr), [official sample JPEG](https://storage.googleapis.com/cloud-samples-data/vision/ocr/sign.jpg). Local file: google-ocr-sign.jpg; 869,950 bytes; SHA-256 C5B8A6B12FAFB5D5467AD68699FF838A8C856AF9C3183902F82859FC1516294A. Visually inspected road sign; it is not a representative multilingual book-page benchmark. Handler test accepts its real JPEG/base64 input, then correctly reports CLOUD_DISABLED without provider egress. This validates input handling, **not OCR accuracy**.

Started existing BookConnect_Pixel5_API36 emulator headlessly; Android booted. Installed package inspection found host.exp.exponent (Expo Go), no BookConnect development client. Expo Go cannot load the native ML Kit module. Emulator started for this check was shut down. No native app install/build or real OCR result obtained. Cloud credentials/deployed OCR function/quota gate are unavailable; no image uploaded to Google.

Exact next action: prepare an Android development-client build containing ML Kit and run the sample offline, recording recognized text and latency. Real hi/kn/ml cloud tests follow only after separately approved durable quota migration, credentials and function deployment. U1 remains pending until its runtime evidence is recorded; U6 requires the broader printed-page benchmark.

Final build/continuity evidence: fresh Expo web export PASS (temporary output; initial sandbox process-spawn restriction resolved via approved retry). Root TypeScript remains at 36 existing E2E/Phase9 errors, none in the corrected OCR/NoteEditor files. Phase9 continuity PASS (195 definitions, zero duplicate/missing traceability, 76 Markdown files) and git diff --check PASS. No native/provider proof inferred from these checks.

## Android offline native proof — 2026-10-06 (current checkpoint)

**PASS, bounded smoke only:** user-authorized local Android development-client build and three actual calls through corrected recognizePageText to native ML Kit 1.5.2. This supersedes the earlier NOT_RUN sample checkpoint above. U1 cloud acceptance and broader native camera/printed-page acceptance remain pending; U2–U6 remain pending.

Build: Expo SDK54, React Native0.81.5, newArchEnabled=true, expo-dev-client6.0.21; Gradle8.14.3; process-local Java21 (existing JAVA_HOME14 was unsuitable), Build Tools36 and NDK27.1 installed by Gradle under existing SDK licenses. Android prebuild PASS after retry of a package-write failure while dependency install completed. No ML Kit namespace/module patch needed. Android command now uses expo run:android; iOS command restored unchanged. Package ID com.bookconnect.library.dev is a local development identity; production application identity is not approved by this checkpoint. Generated android is ignored and remains local.

assembleDebug x86_64 PASS: 508 tasks executed, 36m46s first build including downloads/compilation. APK android/app/build/outputs/apk/debug/app-debug.apk: 95,567,996 bytes; SHA-256 42C6050C8D95D00229FCC7EB2BB4C32E78BFDFDEB1A9BB60FCB3542E937A903D. This is the whole single-ABI debug app with developer tools and all wrapper scripts, not an ML Kit-only size or release APK measurement. Windows CMake path/deprecation warnings were non-failing.

Runtime: BookConnect_Pixel5_API36 / Android16/API36/x86_64 emulator, final 3GiB guest RAM/four cores. An earlier resource-constrained emulator boot lost Android system services before installation; retried with competing typecheck stopped and adequate resources. No OCR inference happened in that failed attempt. Final APK installation PASS. Screenshot ocr-native-screen.png and native-result.json record actual output; native-proof-screen-source.txt preserves the temporary probe, which was removed from app routes after the run. Android bundle PASS (2651 modules). Existing dev auth/root layout remains unchanged; this is a service/module diagnostic, not an authenticated scan-to-save proof.

Offline readback: airplane_mode_on=1, wifi_on=0, mobile_data=0. Local ADB reverse tunnel served only Metro8083 and the public sample asset. Service never invoked recognizePageViaCloud; no provider upload/response or note/vault save. Image loading excluded from recorded recognition timing.

| Call | Native recognition time | Outcome |
| --- | --- | --- |
| First service call in fresh app process | 2664ms | on-device, nonempty review, no overflow |
| Warm2 | 1052ms | same text |
| Warm3 | 1044ms | same text |

Raw recognized text in every run:

```text
ZNNZ
WAITING?
PLEASE
TURNOFF
YOUR
ENGINE
```

Manual visible text is WAITING? / PLEASE / TURN OFF / YOUR / ENGINE. Recognizer adds ZNNZ from the graphic and merges TURN OFF. Do not silently auto-correct OCR or claim perfect accuracy. The fixture is one large road sign, not the required clean/difficult printed-page multilingual benchmark; emulator timings are not physical-device latency/p95 or resource acceptance. Camera/gallery/editor save, Hindi/Kannada/Malayalam, iOS/web parity, cancellation on device, low-end physical hardware and cloud quota/provider inference remain unverified.

Cleanup: temporary probe route removed, local tunnel removed, test emulator/Metro/owned build daemon shut down. The development app remains installed in that AVD; SDK/Gradle caches and ignored generated Android build remain available for reuse. No database/Storage writes, migration creation/application, cloud credential/deployment, staging, commit or push. Existing mixed edits preserved. Exact next handoff action: review this native proof and authorize U1 durable cloud-quota migration design before any migration file, provider provisioning or deployment; broader printed-page/camera proof remains acceptance debt.

Final verification after cleanup:59/59 focused tests PASS after dependency installation; final isolated root typecheck retains36 existing E2E/Phase9 diagnostics, none in OCR/NoteEditor. Earlier paused typechecks are not acceptance evidence. Continuity PASS (195 definitions, zero duplicate/missing traceability,76 Markdown files); diff hygiene PASS, staged diff empty. No fresh web export required/run in this Android-only checkpoint; preceding U1 web export remains separate historical evidence.
