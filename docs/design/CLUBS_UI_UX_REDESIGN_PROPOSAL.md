# BookTalks Clubs — UI/UX Redesign Proposal

**Date:** 2026-04-24  
**Target:** NativeWind v4 / Tailwind CSS v3 + React Native 0.81 + Expo SDK 54  
**Dependencies assumed available:** `expo-linear-gradient`, `expo-image`, `expo-haptics`, `react-native-reanimated`, `@expo/vector-icons`

---

## 1. Design Direction: "Shelf & Salon"

Move from a generic SaaS-list aesthetic to a **literary atmosphere** that feels like browsing a curated bookshop shelf and stepping into a private reading salon.

| Current | Proposed |
|---------|----------|
| Flat white cards, slate borders | Warm paper tones, layered depth, soft shadows |
| Indigo-only accent | Genre-aware accent colors + warm amber warmth |
| Text-heavy metadata rows | Icon-forward, spacious typography |
| Placeholder initials avatars | Real-photo avatars with illustrated fallback rings |
| Instant screen jumps | Shared-element transitions, spring animations |

### Color evolution (Daylight phase — clubs-specific enrichment)

Keep the existing CSS-variable theme architecture. Extend it with **clubs-specific semantic tokens** without breaking global usage.

```css
/* global.css — additive clubs tokens */
.daylight {
  --club-shelf-bg: #F1F5F9;           /* Slate 100 — browse backdrop */
  --club-paper-bg: #FFFFFF;           /* Card face */
  --club-paper-elevated: #FAFAF9;     /* Warm stone-50 for inner surfaces */
  --club-ink-primary: #0F172A;        /* Unchanged */
  --club-ink-secondary: #475569;      /* Unchanged */
  --club-ink-tertiary: #94A3B8;       /* Unchanged */
  --club-spine-indigo: #6366F1;      /* Primary action */
  --club-spine-amber: #F59E0B;        /* Warm highlight: events, live badges */
  --club-spine-rose: #E11D48;         /* Author clubs, exclusive content */
  --club-spine-sage: #10B981;         /* Success / joined state */
  --club-shadow: rgba(15, 23, 42, 0.06);
  --club-shadow-lg: rgba(15, 23, 42, 0.10);
}
```

All new club surfaces should prefer these tokens while existing library/exchange screens stay untouched.

### Typography scale (clubs-specific)

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `club-display` | 32px | 800 | Browse header, detail hero title |
| `club-heading` | 22px | 700 | Section titles (Discussion, Events) |
| `club-body` | 15px | 400 | Descriptions, long-form text |
| `club-body-strong` | 15px | 600 | Labels, button text |
| `club-caption` | 12px | 500 | Metadata, timestamps, chips |
| `club-micro` | 11px | 700 | Badges, tier pills, uppercase tracking |

Use `lineHeight` ratios of 1.35 for body, 1.2 for headings.

---

## 2. Component-Level Enhancements

### 2.1 `ClubCard` — From list item to "shelf spine"

**Current:** horizontal row, cover thumbnail 88×132, flat border, low shadow.  
**Proposed:** vertical "book-cover-forward" card with rich layering.

**Layout change:**
- **Shape:** Vertical card, `w-[46%]` (2-column grid on mobile) or `w-full` with cover as hero background.
- **Cover:** `expo-image` with `transition={400}`, `contentFit="cover"`. Height 180px. Add a **bottom gradient overlay** (`expo-linear-gradient`) so white text sits safely on any cover art.
- **Spine strip:** A 4px left border in the club's **genre color** (from `GENRE_COLORS` in `src/lib/constants.ts`). If no genre, fall back to `accent`.
- **Status badge:** Floating pill top-right:
  - `public` → translucent white chip
  - `approval` → amber dot + "Apply"
  - `invite_only` → rose dot + "Invite"
  - `author_club` → rose chip with `@` icon
- **Metadata:** Replace icon+text rows with **3-dot micro layout**: member count dot meeting type dot access level. Use `club-micro` uppercase.
- **Current book:** Show a tiny 28×40px cover thumbnail + title in a "now reading" sub-row with `bgSecondary` background.
- **Press state:** `expo-haptics` light impact on press + scale spring to `0.97` via `react-native-reanimated`.
- **Skeleton:** `SkeletonClubCard` — shimmer gradient over the cover area and 3–4 rounded gray lines below.

**Tailwind / NativeWind snippet:**
```tsx
<View className="w-[46%] rounded-2xl bg-white shadow-sm active:scale-[0.97]">
  <View className="relative h-44 rounded-t-2xl overflow-hidden">
    <Image source={cover} className="w-full h-full" />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} className="absolute inset-0" />
    <View className="absolute top-3 right-3">
      <ClubTypePill type={club.club_type} />
    </View>
    <Text className="absolute bottom-3 left-3 text-white text-lg font-bold" numberOfLines={2}>
      {club.name}
    </Text>
  </View>
  <View className="p-3 gap-1">
    <View className="flex-row items-center gap-2">
      <View className="w-1 h-8 rounded-full bg-genre" />
      <Text className="text-xs font-bold uppercase text-tertiary tracking-wider">
        {club.meeting_type}
      </Text>
    </View>
    <Text className="text-sm font-semibold text-primary" numberOfLines={1}>
      {club.current_book_title}
    </Text>
    <View className="flex-row items-center gap-1.5 mt-1">
      <Ionicons name="people" size={12} color={colors.textTertiary} />
      <Text className="text-xs text-tertiary">{club.member_count}</Text>
      <Text className="text-xs text-tertiary">•</Text>
      <AccessLevelBadge level={club.access_level} />
    </View>
  </View>
</View>
```

---

### 2.2 `ClubDetailScreen` — Hero + tabbed salon

**Current:** single long ScrollView, dense text blocks, no visual hierarchy.  
**Proposed:** **hero cover image + floating segmented control + content panels**.

#### Hero section (top 35% of screen)
- Full-bleed club cover image with a **vignette + blur backdrop**.
- Club name in `club-display` white text with a subtle text-shadow.
- Host avatar row: host photo (or initials ring) + host name + tier badge.
- **Floating quick-action bar** below the hero:
  - Join / Apply / Accept Invite (primary CTA, full-width when non-member)
  - Manage (gear icon) when admin/moderator
  - Invite (share icon) when admin
- **Tier entitlement gate:** if the user's tier blocks joining, replace the CTA with an **upward gradient banner** (indigo → violet) saying "Upgrade to Pro to join Pro clubs" with a lock icon. This is a quick aesthetic win that also increases conversion clarity.

#### Segmented navigation (sticky under hero)
Replace the monolithic scroll with **4 tabs** rendered via a sticky `ScrollView` header or a lightweight local state switch:
1. **About** — description, meeting type, access rules, member cap, host bio
2. **Current Book** — large cover, title, author, reading progress bar, status toggle chips
3. **Discussion** — topic count badge, latest topic preview card, "View all →" chevron
4. **Events** — next upcoming event as a featured card, RSVP chip, then a mini list

Use a **pill-shaped segmented control** with spring animation on the active indicator.

#### Shared-element transition
When tapping a `ClubCard` from browse, animate the cover image from its grid position into the hero position using `react-native-reanimated` layout animations or Expo Router's future shared-element support (fallback: fade + slight scale).

---

### 2.3 `ClubMemberList` — From rows to an "attendee wall"

**Current:** flat rows, solid-color circle initials, chevron, minimal info.  
**Proposed:** grid-forward member presence.

**Option A — Admin/Moderator view (dense list):**
- Keep rows but upgrade:
  - **Avatars:** `expo-image` circular 44px. If no `avatar_url`, generate a **generative pattern fallback** (e.g., colored geometric shape based on user_id hash) instead of plain initials on a solid circle. Initials still overlaid in white.
  - **Role ribbons:** Small right-edge vertical color strip:
    - Admin → indigo
    - Moderator → amber
    - Member → transparent
  - **Tier badge:** Pro/Pro+ users get a tiny "Pro" or "★" pill next to their name.
  - **Press:** opens a bottom-sheet profile preview (name, city, trust score, tier, "Message" / "Report" actions).

**Option B — Member gallery (browse-only, 4 columns):**
- For the detail "About" tab, show the first 8 member avatars in a horizontal scroll with a "+42 more" overflow chip.

---

### 2.4 Discussion Threads — "Marginalia" aesthetic

**Current:** functional but plain.  
**Proposed:** treat topics like annotated book margins.

- **Topic card:** `bg-paper-elevated`, left border 3px in `accent-light`. Title in `club-heading`. Preview 2 lines in `club-body`.
- **Unread dot:** A small amber pulse dot (animated via reanimated loop) on unread topics.
- **Reply threading:** Visual indent using a **faded vertical line** (Slate 200) that gets slightly darker per depth level, max 4 levels.
- **Vote buttons:** Not generic thumbs-up/down. Use **"Agree" / "Insightful"** language with book-themed icons (`book-outline` for insightful, `checkmark-circle` for agree). Tapped state triggers a quick haptic + color fill spring.
- **Reaction bar:** Horizontal scroll of emoji reactions with a "+" chip that opens a bottom-sheet picker.
- **New topic CTA:** Floating action button (FAB) in bottom-right of discussion screen, indigo with a feather-pen icon. On scroll down, FAB shrinks to a mini dot; on scroll up, expands back.

---

### 2.5 Event RSVP Cards — "Ticket" visual

**Current:** plain list rows.  
**Proposed:** ticket-shaped cards with a perforated left edge.

- **Card shape:** Rounded rectangle with a **semi-circle cutout on the left** (achievable via SVG mask or absolute-positioned circles with background color) to resemble a ticket stub.
- **Left strip:** Event date stacked (day number large, month small) in a colored block.
- **Body:** Event title, time, location pin, virtual link icon.
- **RSVP chip:** 3-state toggle (Going / Maybe / Not going) rendered as a **sliding pill** inside the card. Use reanimated `Animated.View` for the thumb position.
- **Past events:** Opacity 0.55, grayscale tint, "Completed" ribbon.

---

### 2.6 Nomination & Voting Flow — "Ballot box"

**Current:** vertical list with vote counts as plain text.  
**Proposed:** ranked-choice visual weight.

- **Nomination card:** Book cover left (60×90), title/author right, with a **vertical bar chart** showing vote share behind the card at 10% opacity.
- **Vote action:** A heart/bookmark-style toggle. When tapped:
  - Haptic medium impact
  - A `+1` particle floats upward and fades (reanimated)
  - The bar chart behind animates its width
- **Finalize CTA:** When voting is closed (backend-validated), the admin sees a **pulsing indigo banner** at the top of the screen: "Voting ended — finalize winner". Pressing it triggers a **confetti-like burst** (simple reanimated particles) and the winner card expands to full-hero size with a "Now Reading" crown badge.
- **Bug fix:** The finalize button must be gated by `hasNominationVotingClosed()` (already computed in the screen) rather than raw `status === 'active'`.

---

## 3. Interaction Patterns & Motion

### 3.1 Loading & Empty States

| Surface | Skeleton | Empty State Illustration |
|---------|----------|--------------------------|
| Browse grid | 2-column shimmer cards with gray cover rectangles | Open book with magnifying glass + "No clubs match your search" |
| Detail hero | Blur pulse on hero area, text lines below | — |
| Discussion list | 3 topic rows with left-border lines | Empty notebook page with "Be the first to start a discussion" |
| Member list | 6 avatar rows pulsing | Empty theater seats + "Members appear here" |
| Events | Ticket-card skeletons | Calendar page with "No upcoming events" |

All empty states should use the **same illustration style**: simple line-art SVGs in `textTertiary` color, centered, with a CTA button below.

### 3.2 Gestures

- **Browse → Detail:** Card press uses `activeOpacity` but also a **spring scale** to `0.96` over 100ms.
- **Detail pull-to-refresh:** Standard `RefreshControl`, but tint the spinner with the club's genre color.
- **Discussion swipe-to-reply:** Swipe right on a topic row to reveal a "Reply" action (indigo background, white reply icon). Swipe left to reveal "Report" (rose background).
- **Bottom sheets:** All management flows (member actions, invite creation, application review, event creation) should open in a **modal bottom sheet** rather than full-screen pushes. This keeps context anchored. Use `@gorhom/bottom-sheet` or a custom reanimated sheet.

### 3.3 Transitions

- **Browse filter chips:** When a filter is selected, the chip width animates via layout animation; the active background color cross-fades over 200ms.
- **Segmented tab switch:** Content cross-fades (opacity 0→1, 150ms) with a simultaneous slight translate-Y (8px → 0).
- **RSVP toggle:** The active thumb slides with a spring (`stiffness: 300, damping: 25`).

---

## 4. Prioritization

### Phase 1 — Quick Aesthetic Wins (1–2 days, high impact)

1. **ClubCard grid refactor:** switch FlatList to 2-column masonry-style grid, apply cover-gradient overlay, genre spine strip, status pills.
2. **Avatar upgrades:** replace solid-color initials with `expo-image` + hash-based geometric fallback pattern.
3. **Typography audit:** apply the `club-*` scale tokens to all clubs screens for consistency.
4. **Tier gating banner:** upgrade the plain "You cannot join" text to the gradient upgrade CTA banner.
5. **Skeleton screens:** add `SkeletonClubCard`, `SkeletonClubDetail`, `SkeletonDiscussionRow` using `expo-linear-gradient` shimmer.

### Phase 2 — Structural Improvements (3–5 days)

1. **ClubDetail tabbed layout:** split the monolithic scroll into About / Current Book / Discussion / Events tabs with sticky header.
2. **Hero cover + shared transition:** implement the full-bleed hero with gradient overlay and back-button blur-safe area.
3. **Discussion "marginalia" styling:** left-border topics, unread pulse dot, reply depth lines, upgraded vote buttons.
4. **Event ticket cards:** implement the ticket cutout shape and RSVP sliding toggle.
5. **Bottom-sheet modals:** wrap Manage Club, Invite, Application Review, Event Create in bottom sheets.

### Phase 3 — Delight & Polish (2–3 days)

1. **Nomination voting particles:** floating `+1` and bar-chart background animation.
2. **Finalize confetti:** simple reanimated particle burst on winner selection.
3. **Member profile bottom-sheet:** tap any avatar to open a rich preview with trust score, tier badge, city, and action buttons.
4. **Genre-aware theming:** map the accent color of a club detail screen to the club's primary genre color (with WCAG contrast enforcement).
5. **Accessibility pass:** ensure all new color combinations meet WCAG AA on both Daylight and Golden themes.

---

## 5. Implementation Notes for Developers

### NativeWind className adoption

The current codebase mixes `StyleSheet.create()` with raw props. This proposal assumes **incremental migration**: new or heavily touched components should use NativeWind `className` strings for layout/spacing/color, while keeping `StyleSheet.create()` only for dynamic values (e.g., animated transforms, genre-derived colors).

Example hybrid pattern:
```tsx
<View className="flex-row items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
  {/* static layout via Tailwind */}
  <View style={{ borderLeftColor: genreColor, borderLeftWidth: 4 }} className="h-10 rounded-l-md" />
  {/* dynamic color via inline style, rest via Tailwind */}
</View>
```

### Reanimated spring presets

Use a consistent spring preset across all clubs interactions:
```tsx
const CLUB_SPRING = { damping: 20, stiffness: 250, mass: 0.8 };
```

### Haptics matrix

| Action | Haptic |
|--------|--------|
| Card press | `Haptics.ImpactLight` |
| Vote / RSVP toggle | `Haptics.ImpactMedium` |
| Admin destructive (remove member, archive) | `Haptics.ImpactHeavy` |
| Success (join club, finalize book) | `Haptics.NotificationSuccessType` |
| Error (entitlement blocked) | `Haptics.NotificationErrorType` |

---

## 6. Acceptance Criteria

- [ ] Browse screen renders in a 2-column grid on portrait phones with no clipping.
- [ ] ClubCard shows genre-colored spine strip and status pill on every card.
- [ ] ClubDetail hero displays full-bleed cover with gradient overlay and readable white text.
- [ ] Tab switch on ClubDetail is smooth (≤200ms perceived) with no layout jump.
- [ ] Discussion rows show left-border indent and unread pulse on unread topics.
- [ ] Event cards have ticket visual with RSVP 3-state toggle.
- [ ] All new surfaces have skeleton loaders and illustrated empty states.
- [ ] Haptics are triggered on every primary action listed in §5.
- [ ] No regressions in Golden theme (all new tokens have Golden equivalents).
