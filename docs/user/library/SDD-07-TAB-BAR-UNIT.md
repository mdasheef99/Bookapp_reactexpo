# SDD-07 tab-bar unit — TB-1 (decision D07-01)

**Update 2026-10-21:** `main` already shows the five tabs (the marketplace routes now sit under one folder), so the tab-count/label goal is met there; icons, theme colours/contrast and the 200%-zoom check are still open. This parked build targets the old layout and is not to be revived as built; see SDD-07 §13.7.

**Status:** BUILT, REVIEWED and PARKED, 2026-10-19. **Uncommitted** on `sdd07/tab-bar` in `Bookconnect4_fu1a`. It waits for the owner's "Marketplace" label decision (§13) and commit approval. See §13 for the build record.
**Approval:** APPROVED 2026-10-18. Owner's words: "I approve TB-1 decisions TB-D1 to TB-D5 as recommended. I'll forward the clubs heads-up myself. Build TB-1 on sdd07/tab-bar (probe the models first), don't commit until I approve."
- Decisions TB-D1 to TB-D5 are approved as recommended (§5).
- The owner forwards the clubs heads-up (§10) personally.
- **Build authorized** on `sdd07/tab-bar` in `Bookconnect4_fu1a`, created off `sdd07/fu1a-fu3` at `6644689`. Model probes come first.
- **Commit NOT authorized** until the owner approves the built result.
- Originally a SPEC DRAFT, 2026-10-18.
**Authority:** owner's words (2026-10-18), relayed by the orchestrating session: "Start the tab-bar unit D07-01: write its spec first (docs only), including the clubs heads-up, and show me before any build."
**Parent:** [SDD-07](./SDD-07-book-section-ui-overhaul.md) §9 decisions D07-01 (own app-wide unit) and D07-15 (200%-zoom overflow), and DP-06 known-open item RA-W01.
**Format:** follows the unit specs in the [foundation plan](./SDD-07-FOUNDATION-PLAN.md) §3.

## 1. Goal

The global tab bar shows exactly five tabs with readable labels and real icons, passes WCAG 2.2 AA contrast in all three theme phases, and causes no horizontal overflow at 200% zoom. No route that is reachable today becomes unreachable.

## 2. Why

- **RA-W01:** tab labels measure 4.02:1 when selected and 3.27:1 when inactive, at 10px, on a white bar in every phase. The inactive label fails 1.4.3, and the bar ignores the midnight and golden themes.
- **SDD-07 §4 item 6** (audit captures `A01-fold`, all phone captures): at 390 px the bar shows nine tabs, truncated labels ("Exch", "Mark", repeated "mark…"), and "⏷" fallback glyphs for icons.
- **D07-15:** at zoom 2 on 390 px, page `scrollWidth` is 399. With the tab bar hidden it is 390, so the 9px overflow is the tab bar ([overflow results](./evidence/fa-p1-prototype-2026-10-18/round3/overflow/overflow-results.json)).
- These break DP-06 (accessible from the start) and K3/C-rules in [Appendix A](./SDD-07-book-section-ui-overhaul.md#appendix-a--essence-checklist-used-for-every-flow-a-review). Every library screen sits above this bar, so Flow A acceptance depends on it.

## 3. Current state (read-only evidence, 2026-10-18)

**`app/(tabs)/_layout.tsx`** (identical content in both worktrees; last commit touching it in both is `4a51032`):

```tsx
<Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
    <Tabs.Screen name="library" options={{ title: 'My Library' }} />
    <Tabs.Screen name="exchange" options={{ title: 'Exchange' }} />
    <Tabs.Screen name="marketplace/index" options={{ title: 'Marketplace' }} />
    <Tabs.Screen name="clubs" options={{ title: 'Clubs' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    <Tabs.Screen name="marketplace/store/[storeId]" options={{ href: null }} />
</Tabs>
```

- No `tabBarIcon`, no colours, no `backBehavior`.
- **Why there are nine tabs:**
  - `clubs`, `exchange`, `library` and `profile` each have a `_layout.tsx`, so each is one tab.
  - `app/(tabs)/marketplace/` has **no** `_layout.tsx`. Each file in it is a separate tab route: `index`, `cart`, `book/[listingId]`, `requests/index`, `requests/[requestId]` and `store/[storeId]`.
  - Only `store/[storeId]` is hidden, so four extra tabs appear: `cart`, `book/[listingId]`, `requests/index` and `requests/[requestId]`.
- **Call sites that must keep working** (they push the routes this unit hides):

  | Call site | Target |
  |---|---|
  | `src/features/marketplace/commerce/components/AddToCartButton.tsx:21` | cart |
  | `src/features/marketplace/screens/MarketplaceSearchScreen.tsx:33` | cart |
  | `src/features/marketplace/screens/MarketplaceSearchScreen.tsx:36` | requests |
  | `src/features/marketplace/commerce/screens/CustomerRequestsScreen.tsx:20` | requests/[requestId] |
  | `src/features/marketplace/commerce/services/customerCommerceService.ts:84` (route builder) | requests/[requestId] |
  | `src/features/marketplace/components/GroupedBookCard.tsx:80` (`pathname: '/marketplace/book/[listingId]'`) | book/[listingId] |
  | `app/(tabs)/profile/notifications.tsx:38` | requests/[requestId] |

- **Back behaviour today:** expo-router's JS `Tabs` uses React Navigation's `TabRouter` default, `backBehavior = 'firstRoute'` (`node_modules/@react-navigation/routers/lib/module/TabRouter.js:90`). Native/hardware Back from cart, a request or a listing therefore goes to My Library, not to the screen the user came from. On web the browser Back button follows URL history instead.
- **Existing test** `app/(tabs)/__tests__/_layout.test.tsx`: mocks `Tabs`, collects `Tabs.Screen` props, and asserts the exact name list `[library, exchange, marketplace/index, clubs, profile, marketplace/store/[storeId]]`, that there are no credit-history/addresses screens, and that the store route has `href: null`.
- **Theme:** `src/hooks/useTheme.ts` exports `THEME_COLORS` for daylight (05–17), golden (17–20) and midnight. `useTheme` is used in 205 files under `src` and `app`, including clubs, exchange, marketplace and profile.
- **Icons:** `@expo/vector-icons` ~15.0.3 is already a dependency. Nothing to install.
- **Line endings:** the file is LF in the index in both worktrees. The working copy is CRLF in the library tree and LF in the clubs tree (`core.autocrlf=true`). Content is identical.

**Contrast of `THEME_COLORS` against each candidate bar background** (computed 2026-10-18):

| Phase / background | textPrimary | textSecondary | textTertiary | accent | border |
|---|---|---|---|---|---|
| daylight bgPrimary `#F8FAFC` | 17.06 | 7.24 | 2.45 | 4.27 | 1.18 |
| daylight bgSecondary `#F1F5F9` | 16.30 | 6.92 | 2.34 | 4.08 | 1.13 |
| daylight **bgCard `#FFFFFF`** | 17.85 | 7.58 | 2.56 | 4.47 | 1.23 |
| golden bgPrimary `#FFF7ED` | 8.54 | 6.68 | 4.73 | 3.35 | 1.27 |
| golden bgSecondary `#FFEDD5` | 7.92 | 6.19 | 4.38 | 3.11 | 1.18 |
| golden **bgCard `#FEF3C7`** | 8.15 | 6.37 | 4.51 | 3.20 | 1.22 |
| midnight bgPrimary `#020617` | 16.36 | 7.87 | 4.24 | 6.76 | 1.95 |
| midnight bgSecondary `#0F172A` | 14.48 | 6.96 | 3.75 | 5.98 | 1.72 |
| midnight **bgCard `#1E293B`** | 11.87 | 5.71 | 3.07 | 4.90 | 1.41 |

Reading: `textPrimary` and `textSecondary` pass 4.5:1 everywhere. `accent` fails 4.5:1 as label text in daylight and golden but passes 3:1 as a non-text UI part on every `bgCard`. `textTertiary` fails in daylight and midnight. `border` is under 3:1 everywhere, so it can only be decorative.

## 4. Files

| File | Change |
|---|---|
| `app/(tabs)/_layout.tsx` | Hide the four extra marketplace routes; add icons, theme colours, label style, `backBehavior`; keep `headerShown: false` and `sceneStyle: { backgroundColor: 'transparent' }`. |
| `app/(tabs)/__tests__/_layout.test.tsx` | Update the expected screen list and add the new assertions (§7). It is **updated, not weakened**: every existing assertion stays. |
| `app/(tabs)/__tests__/tabBarContrast.test.ts` (new) | Contrast test over the tab-bar colour pairs in all three phases. |

Nothing else. No change to `useTheme.ts`, the marketplace screens, the clubs screens or any library screen.

## 5. Decisions for the owner

Each decision lists the recommendation first.

### TB-D1 — How to remove the extra marketplace tabs

**Recommended: hide them with `href: null`** in the tabs layout: `marketplace/cart`, `marketplace/book/[listingId]`, `marketplace/requests/index`, `marketplace/requests/[requestId]`. Same pattern as the existing store route. All call sites in §3 keep working, because `href: null` removes the tab button, not the route.
- Also set **`backBehavior="history"`**, so Back from a hidden route returns to the screen the user came from instead of jumping to My Library. Verified in §9 (step V3) on web and, where available, Android.
- **Alternative:** add `app/(tabs)/marketplace/_layout.tsx` with a Stack, so marketplace becomes one tab with its own back stack. This is the cleaner long-term shape, but it changes marketplace navigation, route names and the Phase 9 code paths. It belongs to the marketplace track (Phase 9 authority), not to SDD-07. Recorded as a follow-up, not done here.

### TB-D2 — Bar colours

**Recommended: follow the app theme (`useTheme`) per phase**, so the bar is no longer white at midnight:

| Part | Token | Lowest ratio over the three phases | Rule |
|---|---|---|---|
| Bar background | `bgCard` | — | — |
| Selected label and icon | `textPrimary` | 8.15 (golden) | 1.4.3 text ≥ 4.5 |
| Inactive label and icon | `textSecondary` | 5.71 (midnight) | 1.4.3 text ≥ 4.5 |
| Selected indicator (bar above the icon, 3px) | `accent` | 3.20 (golden) | 1.4.11 UI part ≥ 3 |
| Top border of the bar | `border` | decorative | not counted |

- The selected tab is never shown by colour alone (1.4.1): filled icon vs outline, bold vs regular label, plus the accent indicator.
- `accent` is **not** used as label text (fails 4.5:1 in daylight and golden). `textTertiary` is **not** used (fails in daylight and midnight).
- **Alternative:** use the library palette (`LibraryAppearance`/FU-1a) for the bar everywhere. Rejected: the bar is app-wide, so a library-only palette would restyle clubs, exchange, marketplace and profile in library colours.

### TB-D3 — Icons

**Recommended: Ionicons** from `@expo/vector-icons` (already installed), outline when inactive and filled when selected:

| Tab | Inactive | Selected |
|---|---|---|
| Library | `library-outline` | `library` |
| Exchange | `swap-horizontal-outline` | `swap-horizontal` |
| Marketplace | `storefront-outline` | `storefront` |
| Clubs | `people-outline` | `people` |
| Profile | `person-circle-outline` | `person-circle` |

Icons are decorative: the label (or, under TB-D5, the accessible name) carries the meaning. Size 24.

### TB-D4 — Labels

**Recommended:**
- Rename "My Library" to **"Library"**, so all five labels are single short words. The screen keeps its own "My Library" title.
- Label style 12/16 (up from 10px). Never truncated with an ellipsis, never broken mid-word.
- **Alternative:** keep "My Library". It truncates at 390 px with the icon above, and is the longest label.

### TB-D5 — Labels that don't fit (large text and 200% zoom) — new decision

Single-word labels can't wrap without breaking mid-word.
- At 390 px each tab is about 78 px wide and "Marketplace" at 12px is about 66 px, so it fits at 1.0×. At a 1.3× font scale it no longer fits.
- At 200% browser zoom on a 390 px window, the layout width is 195 CSS px (each tab about 39 px), which is below WCAG Reflow's 320 px baseline but is the D07-15 case.

**Recommended: a measured icon-only fallback.**
- When any label would not fit on one line, the bar hides **all** labels (consistent across tabs) and shows icons only.
- Each tab keeps its name as its accessible name (`tabBarAccessibilityLabel`), so screen readers are unaffected.
- The bar must never make the page wider than the viewport (closes D07-15).
- On iOS the platform norm is that tab labels don't scale with Dynamic Type; the system Large Content Viewer covers it. The fallback still applies on web and Android.
- **Alternative:** let labels shrink with `adjustsFontSizeToFit`. Rejected: it drops below 12px and below readable size, which is what RA-W01 is about.

### Also required (not a choice)

- **Targets:** each tab is at least 48dp tall and as wide as its share of the bar (DP-06 project minimum).
- **Web focus:** a visible focus ring on each tab with ≥ 3:1 contrast against `bgCard` (2.4.7, 2.4.11). `textPrimary` as the ring colour meets this in all phases.
- **Semantics:** each tab has role `tab` with a selected state; tab order matches visual order (left to right).
- **Hidden routes:** when cart, a listing or a request is open, no tab is highlighted. Accepted for now (see §9 risk R1).

## 6. Steps

Built on branch `sdd07/tab-bar` in the `Bookconnect4_fu1a` worktree, created off `sdd07/fu1a-fu3` at `6644689`. The owner approved §5 and forwards the clubs heads-up (§10). Model probes come before the build, per the implementation protocol.

1. Update `_layout.test.tsx` first with the new expectations (§7). It fails.
2. In `_layout.tsx`:
   1. hide the four marketplace routes with `href: null`;
   2. set `backBehavior="history"`;
   3. read `useTheme()` and set `tabBarStyle` (background `bgCard`, top border `border`), `tabBarActiveTintColor` (`textPrimary`), `tabBarInactiveTintColor` (`textSecondary`) and the label style (12/16, bold when selected);
   4. add `tabBarIcon` per tab (TB-D3), with the accent indicator for the selected tab;
   5. rename the library title to "Library";
   6. add the TB-D5 fit check and the icon-only fallback with accessible names.
3. Add `tabBarContrast.test.ts`.
4. Run the tests in §7, then the verification in §9.
5. Write the evidence README and update SDD-07, the TRACKER and the roadmap. Commit only with the owner's approval.

## 7. Tests

| Test | Asserts |
|---|---|
| `_layout.test.tsx` (updated) | Exactly five visible tabs in this order: library, exchange, marketplace/index, clubs, profile. Five hidden routes, each with `href: null`: store/[storeId], cart, book/[listingId], requests/index, requests/[requestId]. Existing assertions kept (no credit-history/addresses screens; store hidden). `backBehavior` is `history`. `sceneStyle` is still transparent. Every visible tab has `tabBarIcon` and an accessible label. With `useTheme` mocked per phase, the tint and background options equal the TB-D2 tokens. Library title is "Library". |
| `tabBarContrast.test.ts` (new) | For each phase: selected and inactive label ≥ 4.5:1 on `bgCard`; accent indicator ≥ 3:1 on `bgCard`; focus ring ≥ 3:1. Uses the same contrast function as the FU-1a registry test. |
| Route reachability (in `_layout.test.tsx`) | Every route pushed by a §3 call site is declared as a screen, so `router.push` still resolves. |
| Fit fallback (unit) | Given a measured label width wider than its tab, all labels hide and every tab keeps its accessible name. |

Plus the existing suites for marketplace, clubs and profile still pass.

## 8. Done criteria

| Criterion | Rule |
|---|---|
| Five tabs at 390 px, no truncation, no "⏷" glyphs | SDD-07 §4 item 6; K3 (obvious navigation) |
| Text contrast ≥ 4.5:1 and indicator ≥ 3:1 in all three phases; RA-W01 closed | DP-06 / WCAG 1.4.3, 1.4.11 |
| Selected tab shown by shape and weight, not colour alone | DP-06 / 1.4.1 |
| No horizontal overflow at 200% zoom on 390 px (`scrollWidth` = viewport); D07-15 closed | DP-06 (200% text) |
| 48dp targets, visible focus ring, role `tab` with selected state, order = visual order | DP-06 / 2.5.8 (project 48), 2.4.7, 4.1.2 |
| Bar follows the theme phase, quiet and unbadged | DP-04 (no engagement pull), C-rules (calm) |
| Every §3 call site still reaches its route; Back returns to the previous screen | Regression |
| Tests in §7 pass; evidence recorded | Session-close contract |

## 9. Risks

| Id | Risk | Mitigation |
|---|---|---|
| R1 | No tab is highlighted on cart, listing or request screens. | Accepted for TB-1; the TB-D1 alternative (marketplace Stack) fixes it later in the marketplace track. |
| R2 | `backBehavior="history"` changes Back for every tab, including clubs. | Verify V3 on all five tabs; the change only affects Back after switching tabs, which today jumps to My Library. |
| R3 | Shared file with the clubs worktree; a parallel edit would conflict. | Clubs heads-up (§10). The library side owns the file until TB-1 merges. |
| R4 | Line endings: CRLF working copy here, LF in clubs. | The index is LF in both and content is identical, so a normal merge is clean. Check `git diff --stat` shows content lines only. |
| R5 | Theme phase changes on a timer; the bar must re-render. | It reads `useTheme()`, which already re-renders on phase change. Checked in V1 by forcing each phase. |
| R6 | Native default font differs from web, so label widths differ. | The fit check measures on the device rather than using a fixed width. |
| R7 | The FU-2 web capture's "My Library" probe matched the tab bar label (home has no heading). | Renaming to "Library" breaks that probe; update the capture script to target a screen heading. |

## 10. Clubs heads-up (forwarded by the owner, 2026-10-18)

> **Heads-up from the library worktree — global tab bar (TB-1, SDD-07 D07-01).**
> - **What changes:** one shared file, `app/(tabs)/_layout.tsx`, plus its test `app/(tabs)/__tests__/_layout.test.tsx` and a new `app/(tabs)/__tests__/tabBarContrast.test.ts`. Built on library branch `sdd07/tab-bar` (off `sdd07/fu1a-fu3`).
> - **Please don't edit `app/(tabs)/_layout.tsx` or its test** until TB-1 has merged. If you need a change there, tell the library session and it will go into TB-1.
> - **What you'll see on the Clubs tab:**
>   - five tabs only (the extra marketplace tabs are hidden);
>   - real icons (Clubs = Ionicons `people`);
>   - bar colours follow `useTheme` per phase instead of white;
>   - 12px labels;
>   - Back after switching tabs returns to the previous screen instead of My Library.
> - **What doesn't change:** the clubs routes and screens. Your in-screen tab bars (`ClubDetailScreen.tsx`, `ClubManageScreen.tsx`, `ManageTabBar` in `manage/index.ts`) are untouched. No new dependencies.
> - **Merge:** the file is identical in both worktrees today (last commit `4a51032`), so whichever side merges second has no conflict as long as clubs doesn't edit it. If there is a conflict, take the TB-1 version and re-apply your change on top.
> - **Ports:** library verification uses 8083+; clubs stays on 8081.

## 11. Verification plan

| Id | Check | How |
|---|---|---|
| V1 | Each of the five tabs in daylight, golden and midnight at 390×844: five tabs, icons, labels whole, colours as TB-D2 | Web capture (Haiku, port 8083+), phase forced per run; 15 screenshots |
| V2 | 200% zoom at 390 px: `scrollWidth` = 390 on library home and Book Details; labels switch to icon-only; names still exposed | Same run as the D07-15 overflow script |
| V3 | Back: open cart, a listing and a request from marketplace, press Back → returns to marketplace; switch Clubs → Library → Back returns to Clubs | Web (in-app Back and browser Back); Android emulator if available |
| V4 | Keyboard: Tab moves through the five tabs left to right with a visible ring; Enter/Space selects | Web |
| V5 | Axe on the tab bar: no violations | Only if FU-5d (`@axe-core/playwright`) is installed by then; otherwise recorded as not run |
| V6 | Call sites in §3 still navigate | Unit test + one web click each for cart, listing and request |
| V7 | TalkBack / VoiceOver | **Not covered** by this unit's tooling; recorded as a manual follow-up |

No database or storage access; capture runs use the library `.env` only with the owner's OK, as for FU-2.

## 12. Out of scope

- Marketplace navigation redesign or a marketplace `_layout.tsx` (TB-D1 alternative; marketplace track).
- Clubs in-screen tab bars (`ClubDetailScreen`, `ClubManageScreen`, `ManageTabBar`).
- The store-owner layout and any non-`(tabs)` navigator.
- Restyling any screen above the bar, and changes to `useTheme.ts` tokens.
- Badges or counts on tabs (DP-04).

## 13. Build and review record (2026-10-18/19)

**Status:** BUILT, REVIEWED, PARKED. Uncommitted on `sdd07/tab-bar` (`Bookconnect4_fu1a`, off `6644689`). Nothing committed or pushed.
**Owner context:** the owner redirected focus back to the library section ("we are working in the library section right??"), then asked for the review: "why dont you review them using codex and open code and follow the process, and later we will go to the next task".

**Probes** (no-edit, same spec): Codex `gpt-6.1-sol` xhigh ≈ space-bunny-free max > Muse Spark 1.3 xhigh. Codex built it.

**Files built:** `app/(tabs)/_layout.tsx`, `app/(tabs)/__tests__/_layout.test.tsx`, new `app/(tabs)/__tests__/tabBarContrast.test.ts`. Matches §4.

**Web verification** (Haiku; [evidence](./evidence/tb1-tab-bar-2026-10-18/README.md)):

| Check | Result |
|---|---|
| Exactly 5 tabs in all three phases; real Ionicons, no "⏷" | PASS |
| Bar not white at midnight (`rgb(30,41,59)` = `bgCard`) | PASS |
| 200% zoom at 390 px: `scrollWidth` 390 on library home and Book Details; 320 px at zoom 1: 320 | PASS — **D07-15 closed on this branch** |
| Back history: cart → Back → marketplace; Clubs → Library → Back → Clubs | PASS |
| Keyboard order, `:focus-visible` ring, Space activates once, no ring on mouse click | PASS |
| Hidden marketplace routes still open, with no tab button | PASS |
| Labels visible at 390 and 360 px | **OPEN** — see below |
| axe | Not run (FU-5d not installed) |

- **Open: icon-only at phone width.** At 390 and 360 px the bar falls back to icon-only (TB-D5), because bold "Marketplace" (about 70 px) plus 10 px padding exceeds the 78 px slot. The spec's estimate in TB-D4/TB-D5 (66 px) was too low. Labels appear from about 400 px. **Owner decision pending:**
  1. rename the label to "Market";
  2. keep "Marketplace" with tighter padding;
  3. accept icon-only at phone width.
- The run used a placeholder-only `.env` (no real key), deleted afterwards.
- **Correction to the evidence README:** its finding that `marketplace_get_active_cart` writes is **false**. The function is `STABLE` in `20260716000007_marketplace_phase6_cart_commands.sql`; the `UPDATE` it cites is in another function. Checked by the orchestrator and re-checked here against the local migration file (not the live database). Not a finding.

**Independent review** (read-only; [reviews](./evidence/tb1-tab-bar-2026-10-18/reviews/)):
- Gemini 4 Argon and space-bunny-free: both "YES WITH FIXES". Codex hit its ChatGPT usage limit mid-review and produced no findings.
- **Applied** (by space-bunny):
  - iOS role back to `button` (bottom-tabs VoiceOver workaround), and the iOS accessible label keeps ", tab, N of 5";
  - the measurement ref is written in `useLayoutEffect`;
  - safe-area insets are part of the measurement key;
  - the caller's `onKeyDown`/`onKeyUp` are composed, not replaced;
  - focus CSS uses `:focus:not(:focus-visible)`.
- **Rejected:** Argon F1 (native probe clamping). A clamped probe equals the slot width, and slot + 10 > slot still triggers icon-only, so detection stays correct.
- **Deferred:** labels on the first frame before measurement; a prop test against the real `BottomTabItem`; a shared contrast helper (it would touch library test files).

**Verified by the orchestrator:** Jest 83 suites / 1,145 tests pass. `tsc`: 36 pre-existing errors, 0 in `app/(tabs)`.

**Database/storage mutations:** none.
**Next exact action:** TB-1 stays parked until the owner decides the "Marketplace" label and approves the commit. Library work resumes with foundation Wave 2 (FU-1b notes screens, FU-1c Book Details onto library tokens) when the owner says go.
