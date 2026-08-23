# SDD-01: Clubs UI Overhaul

**Status:** draft — awaiting user approval before implementation
**Branch:** `feat/clubs-ui-overhaul` (from `origin/main` `c5e9714`)
**Depends on:** existing `useTheme()` hook, Library house style, installed libs only
**Non-goals:** service/API/schema changes, navigation restructuring, new dependencies,
chat/notifications features (separate plans), venue feature internals.

---

## 1. Goals

Make Clubs visually consistent with the post-overhaul Library section, fix
theme-breaking hardcoding, close UX-state gaps, and add restrained motion —
without changing any behavior, contract, or route.

## 2. Current-state audit (evidence 2026-08-22)

### 2.1 Theme violations (highest impact)
- Feedback-banner palette `#DCFCE7/#FEE2E2/#22C55E/#EF4444/#166534/#991B1B`
  copy-pasted in 9 screens: ClubDetailScreen L302/354/418, ClubEventsScreen L104,
  ClubInviteScreen L49, ClubApplicationsScreen L83, ClubDiscussionScreen L107,
  ClubDiscussionThreadScreen L344, ClubNominateBookScreen L187,
  ClubInvitationsInboxScreen L118–119.
- Danger literals ignoring `colors.error`: ClubDetailScreen L299 (`#DC2626`),
  ClubEventsScreen L121/133, ClubApplicationsScreen L95.
- Light-only placeholder surfaces `#E2E8F0`: ClubCard L113, ClubDetailScreen L518–519,
  ClubNominateBookScreen L268. Shadow `#000` ClubCard L103.
- White-on-accent text is acceptable and stays (intentional contrast literal).

### 2.2 Structural duplication
- Per-screen re-declarations of `headerRow/iconButton/headerTitle/sectionCard/
  noticeCard/feedbackBanner/primaryActionButton` in ≥10 files; radii drift 10→24.
- Triplicated label maps: `ClubCard.tsx` L7–24 vs `ClubDetailScreen.tsx` L16–33 vs
  `manageUtils.format*`. Duplicated `hasNominationVotingClosed`,
  `formatNominationStatus`, `isTooManyRequestsError`, cover-URL helpers,
  `normalizeApplicationAnswers` (two divergent copies).

### 2.3 Touch targets < 44px
Browse filter chips ~31px (`clubs/index.tsx` L402), ManageTabBar pills ~33px,
discussion vote/reaction chips ~26px, bare-text moderation buttons
(`ClubManageMembersSection` L190–251, `ClubManageJoinQuestionsSection` L119–127).

### 2.4 Missing UX states
- No retry button on error: authors, reading progress, venue picker, manage console.
- No empty state: invite inbox history.
- Pull-to-refresh missing outside browse/authors/inbox.
- Zero skeleton loaders (`SkeletonCard` exists unused at
  `src/components/search/SkeletonCard.tsx`).

### 2.5 Dead/broken code (fix during phases)
- Mojibake `�` in user copy: `ClubManageScreen.tsx` L466 → `·`.
- Redundant ternary `'Not going' : 'Not going'`: `ClubEventsScreen.tsx` L129.
- Dead styles: `cardHeaderTitle` (Manage L676), `title` (ReadingProgress L250),
  `input` (Thread L480), empty `modalButtonDanger` (Detail L531).
- External placeholder images via `via.placeholder.com`: ClubCard L33,
  Detail L47/166, Nominate L18, ReadingProgress L122, manageUtils L111 → replace
  with local themed fallback component.
- Three confirmation idioms (Alert.alert / custom overlay / bottom-sheet Modal) —
  keep all three but restyle consistently; consolidation is out of scope.

## 3. Design system (adopt from Library)

- Scaffold: `ScreenBackground` + `paddingHorizontal: 20, paddingTop: 60`.
- Header: title 32/700 letterSpacing −0.5; right icon buttons 40×40 radius 12
  borderWidth 1 bgCard/border; Ionicons `-outline` convention size 18.
- Surfaces: `GlassCard` padding 16 borderRadius 20 for cards; list rows
  `activeOpacity={0.9}`.
- Tags/chips: soft-tinted pill recipe (tinted bg+border at 0.2/0.3 alpha, 12/600),
  min height 44 when interactive; active filter = accent bg + white text.
- Typography scale: {11,12,13,14,15,16,18,20,24,32}; weights {500,600,700,800};
  no '900'. Buttons keep positive letterSpacing.
- Empty/error/loading recipes copied from LibraryShelf: icon 64 tertiary /
  alert 56 error + retry Button / centered accent ActivityIndicator.
- Motion vocabulary: stagger delay `index*50ms`, `Easing.bezier(0.34,1.56,0.64,1)`
  entrances, press lift translateY −12/scale 1.05, `expo-haptics` Light impact —
  ALL behind `useReducedMotion()` guard. No sound in Clubs.

## 4. New shared modules (Phase P1 creates; later phases consume)

Location `src/features/clubs/components/ui/`:

| Component | Replaces |
|---|---|
| `ClubFeedbackBanner.tsx` | 9× hardcoded banner palette (success/error/info variants, token-driven) |
| `ClubScreenHeader.tsx` | per-screen headerRow/back-row/iconButton blocks |
| `ClubSectionCard.tsx` | per-screen sectionCard blocks |
| `ClubStateViews.tsx` | Loading/Error(retry)/Empty screens states |
| `CoverFallback.tsx` | `via.placeholder.com` + `#E2E8F0` placeholders |
| `labels.ts` | triplicated CLUB_TYPE/ACCESS_LEVEL/MEETING_TYPE maps |
| Shared nomination/application helpers consolidated into `manageUtils.ts` |

## 5. Phased plan

Each phase is independently shippable; tests green required after each.

- **P1 Foundations:** create §4 modules with tests; purge hexes in
  Detail/Events/Discussion/Thread/Invite/Applications/Nominate/InvitationsInbox;
  fix mojibake, ternary, dead styles.
- **P2 Browse & card:** header/stat/filter recipes, ≥44px chips, SearchBar reuse,
  ClubCard GlassCard+tinted tags+local fallback, skeleton loading, stagger motion.
- **P3 Member screens:** events/reading/discussion/invite/applications/nominate/
  venues — primitives, retry buttons, invite empty state, pull-to-refresh where a
  ScrollView exists.
- **P4 Manage console:** ManageTabBar ≥44px + a11y roles, moderation buttons to
  real touch targets, bare-text errors → ErrorState(retry), one-line StyleSheets
  expanded.
- **P5 Motion polish:** entrance staggers + press-lift + haptics across remaining
  screens, reduced-motion verified.

## 6. Acceptance criteria

1. `rg "#DCFCE7|#FEE2E2|#22C55E|#EF4444|#166534|#991B1B|#DC2626|#B91C1C|#E2E8F0|#EF4444"` returns zero hits under `src/features/clubs/` except intentional white-on-accent literals documented here.
2. All interactive controls ≥44px hit area.
3. Every error surface offers retry; every list has empty/loading/error states.
4. Existing 18 clubs suites stay green; new primitives have focused Jest coverage.
5. `npx tsc --noEmit` passes; no new runtime dependencies.
6. Manual smoke on web export for browse/detail/manage at minimum.
