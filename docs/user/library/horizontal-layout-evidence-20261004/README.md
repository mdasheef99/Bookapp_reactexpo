# Horizontal layout checkpoint A — 2026-10-04

Application source: Home integration, Arrange hint, horizontal layout helper, volume, cabinet and Shelf-style control. Tests: new geometry suite and additional Shelf/Home integration cases. Source checkpoint before work: `e372945`; changes remain uncommitted.

## Verification actually run

- Initial `layout-red.txt`: missing-module RED, zero assertions executed. Initial `jest.txt`: 52 pass/one integration failure caused by a nonexistent filter test ID; corrected to the existing accessibility label.
- `jest-final.txt`: **77 tests in six suites PASS**, including geometry, Home/Shelf integration, shared order/state and existing vertical drag. Existing Node `punycode` warning remains.
- `web-export-final.txt`: fresh Expo web export PASS with `--max-workers 0`.
- `tsc-final.txt`: global TypeScript FAIL, exit 2, **36 diagnostics outside Library, zero Library diagnostics**, matching the established baseline.
- `build-identity.json`: HTML equality and matching local/served bundle SHA-256. Final entry `entry-75ea8aa53da898ce1c9907d450477b5f.js` was observed in the authenticated app.
- `live-facts.json`: eight canonical entries, Wishlist restricted to its one real entry, temporary Dune Later move reflected in Vertical draft, Cancel restored the original sequence. Dune tap opened `/library/ae665879-eda1-40f1-a775-7d698a861b27`; detail content was observed and Back returned to Horizontal. Reload restored Horizontal. Save was not invoked.
- `responsive-facts.json`: 320/430/1280px rectangles; default cabinet 528px; minimum live book target height 44px; both pile contacts have zero gap. 390×844 measurements/capture also confirm reference sizing. These are web checks, not native/font-scale/assistive/performance certification.
- [Phone capture](./app-horizontal-390.jpg) and [desktop capture](./app-horizontal-desktop.jpg) show the actual app after vertical page scrolling so both tiers are visible. Existing root tab clutter is outside this scope.

## Isolated overflow fixture

The original checkpoint A `fixture-entry.js` rendered **17 artificial entries** through actual component/layout, without account/query/order storage. The current B/C harness also uses the actual shared arrangement/gesture hooks and a synthetic storage key isolated on port 19010, with a reset control. Theme/fonts/images/icons/router are mocked; it cannot certify actual materials, native momentum or performance. Generated bundle/HTML are ignored; rebuild with the saved script. Dated A evidence below remains historical.

`fixture-facts.json`: at 390px, upper track 342px viewport/848px content and lower 342px/568px. Upper scrolling changed only upper offset (0→342.4); lower then changed only lower (0→225.6). All five full/partial piles touch their plank within 0.000016px browser rounding. [Scrolled fixture](./fixture-scroll-390.jpg) demonstrates the second pile and partial final pile supported on the plank. An initial visible scrollbar consumed track height and clipped bottom faces; hiding it corrected that issue and has a regression assertion.

Temporary fixture tab/server closed. Temporary viewport reset. Actual app left All/Shelf/Horizontal; `library_shelfStyle:v1` was written by the explicit UI selection. Original saved shelf order remains unchanged; temporary draft was canceled. No books, Supabase database/Storage, migrations, external publication or dependencies changed.

## Scope limits and next action

A was a layout checkpoint. The current completed B/C source and web checks are recorded below; native/assistive/performance acceptance remains unverified. No stage, commit, push or deployment.

## Alignment follow-up

User accepted A and requested better alignment. `alignment-jest.txt`: existing geometry/Shelf suites **47/47 PASS**. `alignment-export.txt`: fresh web export PASS. `alignment-build-identity.json`: served HTML matches local; local/served `entry-410b139a7cdc3d0697f4de2b21a40386.js` SHA-256 `87C9E7596B9CC21D2DD9F0D26D65B8F790FDE3E995CD122019E3C692DCA49817` matches; the browser loaded that entry. `alignment-facts.json`: 320/390/430px checks, common book left x=40 and title x≈63.8 within each pile, zero plank gaps. [Aligned capture](./alignment-390.jpg) shows the current refined app. Existing global TypeScript/native/overflow-fixture results above were not rerun for this small visual pass. Source scope is the layout helper, volume and horizontal cabinet only; order/storage/data remain untouched. Viewport reset; All/Shelf/Horizontal retained. No new test cases, dependencies, commit/push/deploy or database/Storage action.

## Completed browsing and horizontal Arrange

- `interactions-jest-final.txt`: **134 tests / 11 suites PASS**, including timer/cancellation/reduced motion, truthful quick look, pure projected drops through 902 entries and actual horizontal/shared/vertical lifecycle regressions. `interactions-timer-jest.txt` records the real press-responder fake-clock check at 449/450ms; `interactions-web-timer.txt` verifies the actual React Native Web responder opens at 450ms with zero activation delay and suppresses release navigation. Earlier logs retain corrected harness/assertion failures.
- `interactions-typescript-final.txt`: **36 errors outside Library, zero Library errors**; an initially introduced hook-test inference diagnostic was fixed. `interactions-export-final.txt`: fresh web export PASS.
- `interactions-build-identity.json`: final source export entry `entry-3009c7c404666084dfc21441b1a44acf.js`, local SHA-256 `02321BE0A73522DCD1B32860F9BCFD370EE58B97B26F9FBD47F1E23C816C8464`. The preceding build, `entry-ac8af888beb978e522e87f80b39c0092.js`, matched served/local HTML and was observed in the authenticated app. After the final web press-delay adjustment, `localhost:19006` refused connections and the browser session was unavailable, so served identity and re-observation of the final artifact are UNVERIFIED.
- [Quick-look capture](./interactions-quick-look.jpg): actual Dune facts, no invented progress. Browser checks confirm Close focus, Escape/return, Tab containment and View details by ID. Account mouse drags both tier-boundary directions, Undo and Cancel restore original saved sequence; no account Save.
- `interactions-responsive-facts.json`: final app 320/390/430/1280px, 528px cabinet, minimum 44px face and zero plank gaps. Keyboard feedback retains opacity 1.
- `interactions-fixture-facts.json`: actual isolated 17-entry gesture/order source; independent controls, keyboard end limits (upper 505.6px/lower 225.6px at 390), next-pile edge drag advances upper only 0→111.2px, synthetic Save/reload. [Overflow drag capture](./interactions-overflow-drag.jpg). Initial unchanged attempt came from the harness's consuming outer scrollbar resizing the viewport on drag lock; hiding it like Home fixes the harness. Mocked appearance/router remain explicit limits.
- Synthetic fixture key reset through its UI; temporary tab/server closed. Original account order preserved; no books/database/Storage/migration/dependency/publication change. Current source/docs uncommitted.

Native momentum/gesture loss, native back/assistive focus, physical reduced-motion settings and representative large-library rendering performance remain NOT_RUN. The 902-entry geometry test is not performance certification. Exact next action: user review of completed horizontal web behavior.

Cleanup: browser connection became unavailable during the optional final shelf capture/viewport reset. Last confirmed app state was All/Shelf/Horizontal after Dune return. Quick-look screenshot and preceding-build checks remain valid; resetting the temporary 390×844 viewport is UNVERIFIED. Isolated fixture tab/server/key cleanup had completed. No extra final shelf capture or final-bundle live observation is claimed. Initial continuity/diff closeout caught new blank EOF lines in scoped Phase 9 notes; removed and rerun.

## Horizontal realism parity evidence (2026-10-04)

- `horizontal-realism-finish.jpg`: actual authenticated eight-book shelf after the walnut frame/convex book-face refinement; original order, both tiers, default viewport. The current appearance palette is nighttime.
- Four existing horizontal layout/arrangement/drag/press suites: 32/32 PASS. TypeScript: 36 historical errors outside Library, zero Library errors.
- Exported/browser-observed entry `entry-4b1dc543240303ea96173d1793ed5f83.js`; local/served HTML and bundle match. SHA-256 `AC3570BD790800DCC006EAA14D362B01B64BFBDA671B7741A5F95D0FB5097424`.
- Browser verified 320px and default pane, empty Reading state, Dune detail/return, actual upper-pile drag before first, Undo restoration and Cancel. No saved account order mutation. Temporary viewport reset, All/Shelf/Horizontal restored.
- This is visual/material verification plus bounded interaction regression, not new native, assistive, live overflow or large-library performance certification. No new fixture or live books added.
