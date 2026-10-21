# SDD-08 Unit 3: Android native export check (2026-10-21)

The full record is in [SDD-08 §12.4](../../SDD-08-export-and-share.md#124-unit-3-native-delivery-2026-10-21).

**Setup:**
- a fresh API 36 x86_64 AVD (emulator-5570, wiped at launch, Wi-Fi and data off);
- debug dev client `com.bookconnect.library.dev`, built with `.\gradlew.bat :app:assembleDebug --offline -PreactNativeArchitectures=x86_64` on JDK 21 ([apk.sha256](./apk.sha256));
- local Metro on 8084, the dev-auth bypass, and a placeholder `.env` that was deleted afterwards.

A temporary diagnostic route ([source](./native/diagnostic-route-source.tsx), since removed from `app/`) called the real export builders and `deliverTextFile`/`deliverPdfFile` with fixture data. Nothing was sent to Supabase or any other service, and nothing was signed in.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Build and install | PASS | `NATIVE-RUN.json`, `apk.sha256` |
| 2 | Hermes file names and `Asia/Kolkata` date match Node | PASS | `shot-02-route.png`, `node-reference-hermes-facts.txt` |
| 3 | CSV share: BOM, CRLF, formula guard, Indic text, cleanup | PASS | `library.csv`, `shot-03`/`shot-04` |
| 4 | Markdown share and cleanup | PASS | `notes.md`, `md-find-open.txt`, `shot-05`/`shot-06` |
| 5 | PDF share; Devanagari and Kannada glyphs | PASS on retry; the first attempt hung (renderer crash), which is fixed by a timeout | `notes-page1.png`, `notes-shared-attempt2.pdf`, `shot-07`–`shot-10`, `pdf-find-*.txt` |
| 6 | Share targets | PARTIAL: listed; only Print was used (no sign-in) | `shot-09-print-target.png` |
| 7 | Two direct concurrent calls | The second was rejected by Android and cleaned up; this is a harness bypass of the hook's lock, not a defect | `shot-11`/`shot-12`, `rapid-find-*.txt` |
| 8 | Cleanup and git status | PASS | `git-status-before.txt`, `git-status-after.txt` |

The rendered page 1 (`notes-page1.png`) is from the file left by the hung first attempt. `final-find-leftovers.txt` lists what that attempt left before the fix.
