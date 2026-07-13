# Phase 2C Platform Review, Setup, and Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let platform operators review store applications, transition stores into approved/setup/restricted states, assign founding trial entitlements, and show Store Owners a setup/status surface.

**Architecture:** Platform review uses a controlled Edge Function that verifies Supabase Auth and `platform_user_roles`. Approval does not make a store sellable; it moves the store to `approved_pending_setup`, keeps `selling_status = 'not_allowed'`, and exposes a setup checklist.

**Tech Stack:** Supabase Edge Functions, Supabase Postgres/RLS, React Native, React Query, Jest.

---

## Prerequisite

Phase 2A and 2B must be complete. Do not implement 2C before application submission and document metadata are in place.

## Files

- Extend: `supabase/functions/_shared/marketplaceAuth.ts`
- Create: `supabase/functions/store-review/index.ts`
- Create: `supabase/functions/__tests__/store_review_function.test.ts`
- Extend: `src/features/stores/types.ts`
- Extend: `src/features/stores/services/storeOwnerService.ts`
- Create: `src/features/stores/screens/StoreReviewStatusScreen.tsx`
- Create: `src/features/stores/screens/StoreSetupChecklistScreen.tsx`
- Create: `src/features/stores/screens/__tests__/StoreSetupChecklistScreen.test.tsx`
- Modify: `app/(store-owner)/status.tsx`
- Modify: `app/(store-owner)/setup.tsx`
- Modify: `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2-store-onboarding-verification.md`
- Modify: `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`

---

## Task 1: Add Platform Role Auth Helper

**Files:**
- Extend: `supabase/functions/_shared/marketplaceAuth.ts`
- Create: `supabase/functions/__tests__/store_review_function.test.ts`

- [ ] **Step 1: Add helper contract**

```ts
export async function requirePlatformRole(serviceClient: unknown, userId: string, roles: string[]) {
  // Query platform_user_roles by user_id, role in roles, status active.
  // Throw 403 if absent.
}
```

- [ ] **Step 2: Add static tests**

Assert `store-review/index.ts` references:

- `SUPABASE_SERVICE_ROLE_KEY`
- `requireAuthenticatedUser`
- `requirePlatformRole`
- `platform_user_roles`
- no trusted actor user ID from request body

---

## Task 2: Implement Store Review Edge Function

**Files:**
- Create: `supabase/functions/store-review/index.ts`
- Create/extend: `supabase/functions/__tests__/store_review_function.test.ts`
- Extend: `src/features/stores/types.ts`

- [ ] **Step 1: Define review input**

```ts
export type StoreReviewDecision = 'approve' | 'reject' | 'request_more_info' | 'suspend' | 'restrict';

export interface StoreReviewActionInput {
  storeId: string;
  verificationRequestId?: string;
  decision: StoreReviewDecision;
  reason: string;
  requiredFollowUp?: Record<string, unknown>;
}
```

- [ ] **Step 2: Implement `approve`**

Behavior:

- Require `platform_admin` or `store_reviewer`.
- Set `store_verification_requests.status = 'approved'`.
- Set `stores.status = 'approved_pending_setup'`.
- Set `stores.verification_status = 'approved'`.
- Keep `stores.setup_status = 'incomplete'`.
- Keep `stores.selling_status = 'not_allowed'`.
- Create founding trial `store_subscriptions` row if absent.
- Create starter `store_entitlements` rows if absent.
- Insert `store_status_history`, `platform_admin_actions`, `marketplace_events`, and `marketplace_audit_logs`.

- [ ] **Step 3: Implement `reject`**

Behavior:

- Require platform role.
- Require non-empty reason.
- Set request `rejected`.
- Set store `rejected`, verification `rejected`, selling `not_allowed`.
- Insert history, admin action, event, audit log.

- [ ] **Step 4: Implement `request_more_info`**

Behavior:

- Require platform role.
- Set request `needs_more_info`.
- Keep store `pending_verification`.
- Store follow-up detail in available request notes field.
- Insert admin action, event, audit log.

- [ ] **Step 5: Implement `suspend` and `restrict`**

Behavior:

- `suspend`: store `suspended`, selling `restricted`, `suspended_at = now()`.
- `restrict`: store `selling_restricted`, selling `restricted`.
- Require platform role and non-empty reason.
- Insert history, admin action, event, audit log.

- [ ] **Step 6: Add denial tests**

Test names:

- `denies review when caller has no platform role`
- `denies Store A owner reviewing Store B`
- `does not trust actor user id from request body`
- `requires reason for rejection and suspension`
- `approval keeps selling_status not_allowed until setup is complete`

- [ ] **Step 7: Run function tests**

```powershell
npm test -- --runInBand supabase/functions/__tests__/store_review_function.test.ts
```

Expected: pass.

---

## Task 3: Add Setup Checklist And Status Screens

**Files:**
- Create: `src/features/stores/screens/StoreReviewStatusScreen.tsx`
- Create: `src/features/stores/screens/StoreSetupChecklistScreen.tsx`
- Create: `src/features/stores/screens/__tests__/StoreSetupChecklistScreen.test.tsx`
- Extend: `src/features/stores/services/storeOwnerService.ts`
- Modify: `app/(store-owner)/status.tsx`
- Modify: `app/(store-owner)/setup.tsx`

- [ ] **Step 1: Define checklist model**

Checklist items:

- verification approved
- public profile basics present
- operating hours present
- pickup or delivery setting chosen
- return policy chosen
- payout status shown
- subscription/trial status present
- seller agreement accepted
- prohibited-items policy accepted

- [ ] **Step 2: Implement status screen**

Show statuses for:

- submitted
- needs more info
- rejected
- suspended
- selling restricted

Include support/contact path text only; do not add formal grievance tooling in Phase 2.

- [ ] **Step 3: Implement setup checklist screen**

Show:

- current store status
- setup checklist
- subscription/trial status
- clear statement that selling starts only after required setup is complete

Do not implement inventory or order management.

- [ ] **Step 4: Add tests**

Assertions:

- Approved pending setup does not display selling enabled.
- Suspended/restricted states show blocked status.
- Subscription status displays without platform-wide subscription controls.

- [ ] **Step 5: Run setup tests**

```powershell
npm test -- --runInBand src/features/stores/screens/__tests__/StoreSetupChecklistScreen.test.tsx
```

Expected: pass.

---

## Task 4: Final Verification And Trackers

**Files:**
- Modify: `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2-store-onboarding-verification.md`
- Modify: `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`

- [ ] **Step 1: Run focused Phase 2 tests**

```powershell
npm test -- --runInBand src/features/stores app/(store-owner) app/(auth)/__tests__/login.test.tsx app/(auth)/__tests__/verify-otp.test.tsx app/(auth)/__tests__/setup-profile.test.tsx app/(tabs)/profile/__tests__/profile.test.tsx supabase/functions/__tests__/store_application_function.test.ts supabase/functions/__tests__/store_review_function.test.ts supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts
```

Expected: pass.

- [ ] **Step 2: Run TypeScript**

```powershell
npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Run web export**

```powershell
npm run export:web
```

Expected: pass.

- [ ] **Step 4: Run Supabase verification**

Use Supabase MCP:

```sql
select version, name
from supabase_migrations.schema_migrations
where name like '%marketplace%'
order by version;
```

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public','storage')
  and (
    tablename in ('stores','store_verification_requests','store_verification_documents')
    or policyname like 'mkt%'
  )
order by schemaname, tablename, policyname;
```

```sql
select id, public
from storage.buckets
where id = 'seller-verification-docs';
```

Expected:

- Phase 2 hardening migration is listed.
- Broad owner update policies are absent.
- `seller-verification-docs` exists and is private.

- [ ] **Step 5: Update trackers**

Update Phase 2 tracker:

- Mark completed units.
- Add verification results.
- Record deviations if any.

Update DOC-13:

- Record latest milestone.
- Move next recommended task to Phase 3 only if all Phase 2 acceptance criteria are satisfied.

---

## 2C Completion Criteria

- Platform review requires `platform_user_roles`.
- Approve/reject/request-info/restrict/suspend actions are audited.
- Approval moves to `approved_pending_setup`, not sellable active state.
- Trial subscription and entitlements are represented.
- Setup/status screens exist.
- Final focused tests, TypeScript, web export, and Supabase verification pass.
