# TB-1 global tab bar: web verification (2026-10-18)

Target: Expo web dev server from `C:\Users\LEGION\Desktop\Bookconnect4_fu1a` (branch `sdd07/tab-bar`) on port 8084, Edge via Playwright, 390x844 unless stated. Harness: fixture transport and fake OTP login reused from `library-screen-audit-2026-10-18` and `fa-p1-prototype-2026-10-18/round3/overflow`. Theme phase forced with a `Date.prototype.getHours` override (12 daylight, 18 golden, 22 midnight).

Files: `tb1-tab-bar.pw.ts` (checks), `playwright.tb1.config.ts`, `tb1-results.json` (raw data), `run.log`, screenshots, `fu1a-git-status-before.txt` / `fu1a-git-status-after.txt` (identical).

## Results

| ID | Check | Verdict | Evidence / notes |
|---|---|---|---|
| V1a | Exactly 5 `role=tab` buttons, each phase | PASS | 5 in daylight, golden, midnight |
| V1b | Labels whole (no ellipsis or clipping) | **FAIL** | Labels are not rendered at 390 in any phase (icon-only). `decideIconOnly`: the bold "Marketplace" probe is about 70 px plus 10 px padding, which exceeds the 78 px slot. Labels appear at 430 (86 px slot, `d1-w430-library.png`). Inferred threshold is about 400 px wide. |
| V1c | Real icons, no "⏷" glyph | PASS | Glyphs are Ionicons private-use codepoints (U+F3B5, U+F5B0, U+F5A7, U+F49F, U+F4A9), font `ionicons` status `loaded`. No ⏷ (U+23F7). |
| V1d | Bar background not white at midnight | PASS | midnight `rgb(30, 41, 59)`. Daylight `rgb(255, 255, 255)` (white, informational). Golden `rgb(254, 243, 199)`. |
| V1e | Colours per phase | Recorded | Icon colour (all five tabs identical per phase, so the inactive tint is not distinguishable in computed style): daylight `rgb(15,23,42)`, golden `rgb(120,53,15)`, midnight `rgb(226,232,240)`. Label colours not recorded because labels are not rendered. |
| V1f | Screenshots, 15 files | PASS | `v1-<phase>-<tab>.png` |
| V2a | Zoom 2, 390 library home: scrollWidth = 390 | PASS | 390 / 390. `v2-library-home-zoom2-390.png` |
| V2b | Zoom 2, 390 book details: scrollWidth = 390 | PASS | 390 / 390. `v2-book-details-zoom2-390.png` |
| V2c | Zoom 2: labels hidden, aria-label kept on all tabs | PASS | 0 labels visible; all 5 have aria-label |
| V2d | Zoom 1, 320 wide: scrollWidth = 320 | PASS | 320 / 320. Labels hidden (icon-only). `v2-library-home-w320.png` |
| V3a | Marketplace, goto /marketplace/cart, Back lands on marketplace | PASS | /marketplace, /marketplace/cart, /marketplace |
| V3b | Clubs tab, Library tab, Back lands on Clubs | PASS | /clubs, /library, /clubs |
| V3c | In-app back button on cart | Not found | No button named "back" on the cart screen |
| V4a | Tab order from first Tab | PASS | Library, Exchange, Marketplace, Clubs, Profile |
| V4b | Keyboard focus outline | PASS | `2px solid rgb(15,23,42)`, `:focus-visible` true. `v4-focus.png` |
| V4c | Space on Clubs activates once | PASS | 1 click event, URL /clubs, aria-selected=true |
| V4d | Mouse click draws no outline | PASS | Profile outline-style `none`, `:focus-visible` false |
| V5 | axe | Not run | axe not installed |
| V6a | /marketplace/cart and /marketplace/requests render a screen, not 404 | PASS | No unmatched text. Cart shows a spinner, then "We could not complete that action" (see V7). Requests content was not reached (only tab labels in body text). |
| V6b | No tab button for cart, requests or book | PASS | Exactly 5 tab buttons on both routes |
| V7a | Page and console errors | 10 | Sample: `Failed to load resource: net::ERR_FAILED` (harness-aborted requests) |
| V7b | Non-GET requests other than fake auth = 0 | **FAIL** | Auth POSTs (fake login) and read-only `get_public_book_reviews` POST (answered by harness). Also POST `marketplace_get_active_cart` (4 times) and `marketplace_list_customer_order_requests` (2 times), aborted by the harness. |

## Findings

1. **Icon-only bar at 390 and 360.** Labels do not show at phone width, so the bar has no visible labels at the spec width. Labels show from about 400 px. This is the V1b failure.
2. **~~Cart RPC is a write.~~ Withdrawn — see the correction below.** `marketplace_get_active_cart` (migration `20260716000007_marketplace_phase6_cart_commands.sql`) is `VOLATILE SECURITY DEFINER` and runs `UPDATE public.marketplace_carts` (abandons expired carts). The cart screen calls it with POST on load. The harness aborted it, so no write reached Supabase. Treat as a finding for the cart owner, not a tab-bar defect.
3. **Harness note.** The neutral mouse click in V4 landed on a book card and opened book details before the keyboard checks. The tab bar was still present, so the tab results are unaffected.

## Not verified

- axe (V5) was not run.
- Requests screen content and cart content with real data were not verified (fixtures are empty and the RPCs are aborted).
- Inactive-tab icon tint could not be separated from the active tint in computed style.

## Cleanup

- Expo web on 8084 was started from fu1a and stopped. Port 8084 is closed.
- The restart for the final run was also stopped. A `node` process (`mcp-chrome-bridge`) that is not from this run was left alone.
- No Playwright processes remain.
- fu1a `git status --short` is identical before and after.

## Correction (2026-10-19)

Finding 2 is **false**. `marketplace_get_active_cart` is declared `STABLE SECURITY DEFINER` in `20260716000007_marketplace_phase6_cart_commands.sql`. The `UPDATE public.marketplace_carts` it cites belongs to a different function in the same file. Checked by the orchestrating session and re-checked by the library session against the local migration file (not the live database). It is not a finding.

## Reviews and probes

Copied into [`reviews/`](./reviews/), with terminal colour codes stripped:
- `tb1-probe-codex.md`, `tb1-probe-bunny.md`, `tb1-probe-muse.md` — no-edit probes of the spec;
- `tb1-review-argon.md`, `tb1-review-bunny.md` — read-only reviews of the build. Codex hit its usage limit and left no review.
