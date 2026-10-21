# SDD-08 Unit 4: Android passage-card check (2026-10-21)

The full record is in [SDD-08 §12.5](../../SDD-08-export-and-share.md#125-unit-4-passage-card-2026-10-21).

**Setup:**
- a fresh API 36 x86_64 emulator (wiped, Wi-Fi and data off);
- debug dev client `com.bookconnect.library.dev`, built with `:app:assembleDebug --offline`;
- local Metro on 8084, the dev-auth bypass, and a placeholder `.env` that was deleted afterwards.

A temporary route inside the library stack ([source](./native/diagnostic-route-source.tsx), since removed) opened the real `PassageCardPreview` with six fixtures:
- A: short English;
- B: long English;
- C: Hindi;
- D: long Kannada;
- E: long CJK without spaces;
- F: 20 short lines.

Nothing was sent to any service, and nothing was signed in.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Build, install, manifests unchanged | PASS | `NATIVE-RUN.json` |
| 2 | Fit runs on device (Share enabled for A–F) | PASS | `shot-preview-A..F.png` |
| 3 | PNG 1080×1350, named, sharp, not clipped, real script | PASS | `card-A..F.png` |
| 4 | Caption agrees with `…` (B, D, E, F shortened; A, C not) | PASS | previews and cards |
| 5 | Preview line breaks match the PNG | PASS | previews and cards |
| 6 | Attempt directory and capture file removed | PASS | `find-*.txt` |
| 7 | Cancel during capture, then reopen | PARTIAL: clean close; an immediate reopen tap was lost in the dismiss animation, and a later reopen worked | screenshots |
| 8 | Offline entry | NOT TESTED (Jest covers it) | — |
| 9 | Cleanup and git status | PASS | `git-status-before.txt`, `git-status-after.txt` |

The emulator dropped off adb once and was relaunched. All A–F results come from the second boot.
