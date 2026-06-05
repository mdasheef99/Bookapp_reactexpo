# Clubs Non-Chat Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Clubs work that is not chat, notifications, or venue frontend.

**Architecture:** Add product-depth UI and validation using the existing Clubs data contracts before introducing new backend policy. Author and lifecycle work stay read-oriented/guidance-oriented; reading schedule validation remains local before save; moderation captures clearer resolution intent without mutating live Supabase Auth users.

**Tech Stack:** Expo Router, React Native, TanStack Query hooks in `useClubs.ts`, existing Clubs services, Jest with `@testing-library/react-native`.

---

### Task 1: Author Club Landing And Discovery

**Files:**
- Create: `app/(tabs)/clubs/authors.tsx`
- Create: `src/features/clubs/screens/ClubAuthorsScreen.tsx`
- Modify: `app/(tabs)/clubs/_layout.tsx`
- Modify: `app/(tabs)/clubs/index.tsx`
- Test: `app/(tabs)/clubs/__tests__/index.test.tsx`

- [x] Write failing tests that Browse exposes an Author clubs landing entry when author clubs exist and still does not expose Create Club.
- [x] Implement an author landing route that lists author clubs using the existing browse hook filtered to `author_club`.
- [x] Add Browse navigation from the Author clubs spotlight/filter state to the landing route.
- [x] Run focused Browse tests.

### Task 2: Reading Schedule Product Depth

**Files:**
- Modify: `src/features/clubs/screens/manage/ClubManageReadingScheduleSection.tsx`
- Test: `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

- [x] Write failing tests for richer chapter-aware target validation and clearer reminder/multi-plan guidance.
- [x] Add local validation that chapter-like milestone targets must not move backward.
- [x] Add visible guidance that reminders and multi-plan schedules are deferred until the app-wide notification/calendar pipeline exists.
- [x] Run focused Manage tests.

### Task 3: Admin Lifecycle Policy Depth

**Files:**
- Modify: `src/features/clubs/screens/manage/ClubManageLifecycleSection.tsx`
- Test: `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

- [x] Write failing tests for downgrade automation and archive retention policy guidance.
- [x] Add explicit guidance that automatic successor selection and archive deletion require policy approval and rollout verification.
- [x] Keep archive/restore and transfer request behavior unchanged.
- [x] Run focused Manage tests.

### Task 4: Moderation Resolution Depth

**Files:**
- Modify: `src/features/clubs/screens/manage/ClubManagePlatformComplaintsSection.tsx`
- Test: `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

- [x] Write failing tests for clearer resolution notes/policy guidance on platform complaints.
- [x] Add visible resolution notes/policy guidance while preserving the existing table-backed resolution action behavior.
- [x] Do not add a new backend RPC unless product/security requests a durable notes contract.
- [x] Run focused Manage tests.

### Task 5: Docs And Verification

**Files:**
- Modify: `docs/features/CLUBS_IMPLEMENTATION_INVENTORY.md`
- Modify: `docs/audits/CLUBS_PENDING_INVENTORY_2026-04-24.md`
- Modify: `docs/audits/CLUBS_WORK_SESSION_HANDOFF_2026-06-04.md`

- [x] Update source-of-truth docs to record completed non-chat/non-notification/non-venue work and remaining deferred items.
- [x] Run focused Jest for Browse and Manage.
- [x] Run `npx.cmd tsc --noEmit`.
- [x] Browser smoke changed UI surfaces if Expo web can be started with the approved workflow.
