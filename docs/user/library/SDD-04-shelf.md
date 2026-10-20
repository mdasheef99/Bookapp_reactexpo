# SDD-04: Library Shelf — Single Shelf + viewMode Toggle

**Status:** implemented 2026-08-20 + motion 2026-08-20 — `app/(tabs)/library/index.tsx:25 viewMode` + `LibraryShelf.tsx:308` single shelf Stitch + `BookSpine` Reanimated leaning/press + `assets/sounds/tak.mp3` `expo-audio`/`Haptics` verified
**Date:** 2026-08-20 (updated 2026-08-20 verified)
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo` @ `main` `15243d8` `C:/Users/LEGION/Desktop/Bookconnect4_expo`
**Git base:** `15243d8` + `SDD-01 20260820033938/20260820034004` + `SDD-02 64` + `SDD-03 20260820064258+20260821100001 vault 1` + `LibraryShelf 671→~800 lines viewMode` + `feat/library-shelf-motion` Reanimated + tak
**Scope:** `app/(tabs)/library/index.tsx:23` `src/components/library/LibraryShelf.tsx:132` `src/lib/supabase.ts` `useTheme.ts:22` read-only for now (shelf walnut literal intentional, see §3)

## 1. Decision
Build **one shelf** Stitch dark `walnut-deep #1A110A` `walnut-grain #3D2B1F` `brass-accent #B8860B` + `viewMode shelf|list` toggle that switches `LibraryShelf` vs `LibraryBookList` `app/(tabs)/library/index.tsx:23`. Themes `daylight/golden/midnight` `useTheme.ts:22` deferred - toggle/header use `colors` via `useTheme:22`, **shelf walnut palette is literal Stitch** (`LibraryShelf.tsx:322 #3D2B1F→#1A110A`, `374 #4A3424→#2A1C12`) intentionally not themed, with brass border `rgba(184,134,11,0.3)` + letter-press.

## 2. SOT Evidence
- `LibraryScreen:23` `useLibraryBooks:20` `filterLibraryBooks:30` `LibraryHeader:15` `LibrarySummary:51` `LibraryFilterBar:77` `LibraryBookList:246` `FlatList` - no `viewMode` yet
- `LibraryShelf.tsx:132` `LibraryBookRow:132` `GlassCard 80x120` `bookCover` + tags; Stitch sample 2-shelf with `book-spine` `shelf-gradient` `leather-texture` `shelf-ledge perspective` `spotlight` - will collapse to **one shelf** `flex items-end gap-1 min-h-[180px]` with `book-spine` `width 32-44 height 130-160` `rotate 180 [writing-mode:vertical-rl]` `drop-shadow` `inner-brass-border`
- `booksService.ts:284` `cover_url` `getHighResCoverUrl:112` `http->https &zoom=1->0` available for `expo-image` front, `GENRE_COLORS` `src/lib/constants.ts:6` fallback
- `useTheme.ts:22` `daylight #F8FAFC` `golden #FFF7ED` `midnight #020617` auto `getCurrentPhase:73` - deferred, shelf reads `colors` only via `useTheme` no override

## 3. Contracts
- `viewMode: 'shelf'|'list'` state in `LibraryScreen:25` persisted `AsyncStorage` `LIBRARY_VIEW_MODE_KEY='library_viewMode'` like `useRecentSearches.ts:6` `RECENT_SEARCHES_KEY` (`src/lib/storage.ts` note: AsyncStorage for Expo Go, not MMKV), default `list` for a11y
- `LibraryHeader:19` toggle `albums-outline/list-outline` `a11yLabel Toggle view` + `a11yHint` switches `viewMode`, no DB
- Shelf: `LibraryShelf:308` single shelf `filteredBooks` `onBookPress router.push /(tabs)/library/${item.id}` same as `LibraryBookList:261`, `book-spine 34-44×132-156` `getSpineSize:297` `backgroundColor getSpineColor:292` **title-hash → GENRE_COLORS** fallback (`GENRE_COLORS:6` default `#6B7280`) — `cover_url` dominant via `react-native-image-colors` **deferred** (dep not installed, `cover_url` passed directly to `expo-image:353` without `getHighResCoverUrl:112`), `Text rotate -90deg width 110/90 letter-press` `numberOfLines 1`
- List: existing `LibraryBookList:261` unchanged `FlatList refreshControl`
- Walnut shelf literal (`#1A110A` etc) intentional Stitch — not a `useTheme` violation; header/summary/filter still use `colors` via `useTheme`
- No `user_book_pages`/`reading_notes`/`store_inventory` touch, no `CODEBASE_INTELLIGENCE` write

## 4. Motion + Audio (Stitch -> RN) — IMPLEMENTED `feat/library-shelf-motion`

**Stitch HTML:** `book-spine` `transition transform 0.4s cubic-bezier(0.34,1.56,0.64,1), filter 0.4s` `transform-origin bottom center` + `.leaning perspective(600px) rotateX(12deg) translateY(-4px) scale(1.02)` via `IntersectionObserver rootMargin -20% threshold 0.5` staggered `i*50` + `:hover translateY(-12px) scale(1.05) brightness(1.15)` + `DOMContentLoaded` `shelves opacity 0 translateY(20px) -> 1 0 0.8s`

**RN `LibraryShelf.tsx:308` + `BookSpine:308`:** `Reanimated 2` `useSharedValue translateY/scale/rotateX/leaning` `useAnimatedStyle perspective 600 rotateX 12deg` `withSpring damping 12` `withDelay i*50` for `leaning` (single shelf in viewport staggered), `onPressIn withSpring -12 stiffness300 scale1.05 zIndex10 + playTak()` `onPressOut` back `leaning -4/1.02`, `Animated.View` wrapper `transformOrigin bottom center` via `perspective`. **Audio:** `assets/sounds/tak.mp3 80ms wood` `expo-audio createAudioPlayer` preload `useEffect` `setAudioModeAsync playsInSilentMode:false` `volume 0.3` `onPressIn replayAsync debounce 100ms lastTakRef` + `Haptics.impactAsync Light` `search.tsx:265` `useReducedMotion()` guard + silent `playsInSilentMode:false`.

## 5. Verification (2026-08-20 live + motion)
- `supabase MCP ahntbtktjjmvfosgkmgn` `user_books 12 reading_notes 3 books 15 vault 1` orphans `0/0` (11/2/14 base + `b600783f/375d1a2e/ffe33fb0/af679a19` vault test)
- `npx jest --runInBand --testPathPattern "library/__tests__"` **14 passed 4 suites** (`app 10` + `src LibraryShelf 4` 2 viewMode + 2 motion `entrance/leaning` `tak+Haptics`), `library` pattern **20 passed 5 suites** (+ vault 6), `src/features/books 76`
- `npx tsc --noEmit --skipLibCheck` Library `0` (global `36`), `npm run export:web` `5.36MB entry-a26e6bd` (2287 modules, 5.35MB prior + motion), `Maestro flows/library-smoke.yaml:1` `My Library` both modes + leaning/tak (`BookConnect_Pixel5_API36` `emulator-5554`)
- `getHighResCoverUrl:112` now wired `LibraryShelf.tsx:353` `getHighResCoverUrl(cover_url) ?? cover_url` + `expo-image` front

## 6. Out of Scope
No 3 themes override, no bento zones, no `getHighResCoverUrl` palette DB column, no `user_book_pages` change - deferred to `SDD-05 themes` + `bento`

## 7. Next
`SDD-04` docs updated for motion+tak - implement `feat/library-shelf-motion` branch `Reanimated` + `tak.mp3` `LibraryShelf` `leaning`/`hover` + `expo-audio` after sign-off, then `SDD-05 themes daylight/golden/midnight + SDD-06 bento zones` + optional `react-native-image-colors` per `book.google_books_id` + `getHighResCoverUrl:112` wiring deferred.
