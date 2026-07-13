# Phase 2A Store Owner Gate, Auth, and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the Phase 2 entry path by hardening marketplace write boundaries, preserving Store Owner auth intent, and adding a server-record-backed Store Owner gate.

**Architecture:** Store Owners use the existing Supabase phone OTP session. Navigation intent can route users toward Store Owner onboarding, but authorization is resolved only from marketplace tables. Before adding onboarding writes, remove broad owner update policies that could mutate privileged status/review fields through generic PostgREST updates.

**Tech Stack:** Supabase Postgres/RLS, Supabase Auth, Expo Router, React Query, Jest.

---

## Scope

Includes:

- RLS/write-boundary hardening for Phase 1 onboarding tables.
- Store Owner gate types, service, and hook.
- Store Owner route group skeleton.
- Login, OTP, setup-profile, root guard, and Profile entry routing.

Excludes:

- Application save/submit Edge Function.
- Document upload.
- Platform review actions.
- Setup checklist details.

## Key Security Finding

Phase 1 RLS allows store admins to update `public.stores` and `store_verification_requests`. RLS cannot restrict specific columns in normal PostgREST updates. Phase 2A must remove broad owner updates before UI or Edge Function onboarding work begins.

## Files

- Create: `supabase/migrations/20260627000001_marketplace_phase2_onboarding_hardening.sql`
- Create: `supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts`
- Create: `src/features/stores/types.ts`
- Create: `src/features/stores/services/storeOwnerService.ts`
- Create: `src/features/stores/hooks/useStoreOwnerGate.ts`
- Create: `src/features/stores/screens/StoreOwnerGateScreen.tsx`
- Create: `src/features/stores/services/__tests__/storeOwnerService.test.ts`
- Create: `src/features/stores/hooks/__tests__/useStoreOwnerGate.test.tsx`
- Create: `src/features/stores/screens/__tests__/StoreOwnerGateScreen.test.tsx`
- Create: `app/(store-owner)/_layout.tsx`
- Create: `app/(store-owner)/index.tsx`
- Create: `app/(store-owner)/onboarding.tsx`
- Create: `app/(store-owner)/status.tsx`
- Create: `app/(store-owner)/setup.tsx`
- Create: `app/(store-owner)/__tests__/index.test.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/verify-otp.tsx`
- Modify: `app/(auth)/setup-profile.tsx`
- Modify: `app/(tabs)/profile/index.tsx`
- Modify: `src/lib/__mocks__/supabase.ts`
- Modify: `app/(auth)/__tests__/login.test.tsx`
- Modify: `app/(auth)/__tests__/verify-otp.test.tsx`
- Modify: `app/(auth)/__tests__/setup-profile.test.tsx`
- Modify: `app/(tabs)/profile/__tests__/profile.test.tsx`

---

## Task 1: Harden Onboarding Write Boundaries

**Files:**
- Create: `supabase/migrations/20260627000001_marketplace_phase2_onboarding_hardening.sql`
- Create: `supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts`

- [ ] **Step 1: Write failing migration test**

```ts
import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260627000001_marketplace_phase2_onboarding_hardening.sql',
);

describe('marketplace Phase 2 onboarding hardening migration', () => {
  it('removes broad owner updates from privileged onboarding tables', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('DROP POLICY IF EXISTS "stores update" ON public.stores');
    expect(sql).toContain('DROP POLICY IF EXISTS "verif_req update" ON public.store_verification_requests');
    expect(sql).toContain('DROP POLICY IF EXISTS "verif_doc update" ON public.store_verification_documents');
    expect(sql).toContain('CREATE POLICY "stores platform update" ON public.stores');
    expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin'])");
    expect(sql).toContain('CREATE POLICY "verif_req platform update" ON public.store_verification_requests');
    expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer'])");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- --runInBand supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts
```

Expected: fail because the migration file does not exist yet.

- [ ] **Step 3: Create migration**

```sql
BEGIN;

DROP POLICY IF EXISTS "stores update" ON public.stores;
CREATE POLICY "stores platform update" ON public.stores
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

DROP POLICY IF EXISTS "verif_req update" ON public.store_verification_requests;
CREATE POLICY "verif_req platform update" ON public.store_verification_requests
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

DROP POLICY IF EXISTS "verif_doc update" ON public.store_verification_documents;
CREATE POLICY "verif_doc platform update" ON public.store_verification_documents
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

COMMENT ON POLICY "stores platform update" ON public.stores IS
  'Phase 2 hardening: privileged store fields are updated through controlled Edge Functions or platform roles, not broad owner PostgREST updates.';

COMMIT;
```

- [ ] **Step 4: Verify migration test passes**

Run:

```powershell
npm test -- --runInBand supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts
```

Expected: pass.

- [ ] **Step 5: Verify live policies before applying**

Use Supabase MCP:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('stores','store_verification_requests','store_verification_documents')
order by tablename, policyname;
```

Expected: broad owner update policies are present before migration.

- [ ] **Step 6: Apply migration after approval**

Use Supabase MCP `apply_migration` with name:

```text
marketplace_phase2_onboarding_hardening
```

Expected: migration applies cleanly.

---

## Task 2: Add Store Owner Types, Gate Service, And Hook

**Files:**
- Create: `src/features/stores/types.ts`
- Create: `src/features/stores/services/storeOwnerService.ts`
- Create: `src/features/stores/hooks/useStoreOwnerGate.ts`
- Create: `src/features/stores/services/__tests__/storeOwnerService.test.ts`
- Create: `src/features/stores/hooks/__tests__/useStoreOwnerGate.test.tsx`
- Modify: `src/lib/__mocks__/supabase.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
export type StoreOwnerGateState =
  | { state: 'unauthenticated' }
  | { state: 'consumer_only' }
  | { state: 'application_draft'; storeId: string; requestId: string }
  | { state: 'pending_verification'; storeId: string; requestId: string }
  | { state: 'needs_more_info'; storeId: string; requestId: string; requiredFollowUp?: unknown }
  | { state: 'approved_pending_setup'; storeId: string; storeName: string }
  | { state: 'active_owner'; storeId: string; storeName: string }
  | { state: 'selling_restricted'; storeId: string; storeName: string; reason?: string }
  | { state: 'suspended'; storeId: string; storeName: string; reason?: string }
  | { state: 'rejected'; storeId: string; requestId: string; reason?: string };
```

- [ ] **Step 2: Write service tests**

Test cases:

```ts
describe('storeOwnerService.getGateState', () => {
  it('returns unauthenticated without a user id', async () => {});
  it('returns consumer_only when the user has no store administrator rows', async () => {});
  it('returns application_draft for a draft verification request', async () => {});
  it('returns pending_verification for a submitted verification request', async () => {});
  it('returns needs_more_info for a request needing follow-up', async () => {});
  it('returns approved_pending_setup for an approved store with incomplete setup', async () => {});
  it('returns active_owner for an active approved store', async () => {});
  it('returns suspended when the store is suspended', async () => {});
  it('does not read authority from user_profiles.account_type', async () => {});
});
```

- [ ] **Step 3: Implement `storeOwnerService.getGateState(userId)`**

Rules:

- `null` user ID returns `unauthenticated`.
- Query `store_administrators` joined to `stores` for the current user.
- Query latest `store_verification_requests` for the owned store.
- Map `stores.status` and request status to `StoreOwnerGateState`.
- Never query `user_profiles.account_type`.

- [ ] **Step 4: Implement hook**

`useStoreOwnerGate(userId)` uses:

```ts
['stores', 'ownerGate', userId ?? 'anonymous']
```

Set `enabled: Boolean(userId)`.

- [ ] **Step 5: Run tests**

```powershell
npm test -- --runInBand src/features/stores/services/__tests__/storeOwnerService.test.ts src/features/stores/hooks/__tests__/useStoreOwnerGate.test.tsx
```

Expected: pass.

---

## Task 3: Add Store Owner Routes And Gate Screen

**Files:**
- Create: `app/(store-owner)/_layout.tsx`
- Create: `app/(store-owner)/index.tsx`
- Create: `app/(store-owner)/onboarding.tsx`
- Create: `app/(store-owner)/status.tsx`
- Create: `app/(store-owner)/setup.tsx`
- Create: `src/features/stores/screens/StoreOwnerGateScreen.tsx`
- Create: `src/features/stores/screens/__tests__/StoreOwnerGateScreen.test.tsx`
- Create: `app/(store-owner)/__tests__/index.test.tsx`

- [ ] **Step 1: Add route group layout**

Use Expo Router `Stack` with `headerShown: false`.

- [ ] **Step 2: Add index route**

Render `StoreOwnerGateScreen`.

- [ ] **Step 3: Implement gate routing**

State routing:

- `unauthenticated` -> `/(auth)/login?intent=store_owner`
- `consumer_only` -> show start application CTA
- `application_draft` -> `/(store-owner)/onboarding`
- `pending_verification` -> `/(store-owner)/status`
- `needs_more_info` -> `/(store-owner)/onboarding`
- `approved_pending_setup` -> `/(store-owner)/setup`
- `active_owner` -> setup/status skeleton until Phase 4 console exists
- `selling_restricted`, `suspended`, `rejected` -> `/(store-owner)/status`

- [ ] **Step 4: Run route tests**

```powershell
npm test -- --runInBand app/(store-owner)/__tests__/index.test.tsx src/features/stores/screens/__tests__/StoreOwnerGateScreen.test.tsx
```

Expected: pass.

---

## Task 4: Add Login, OTP, Setup Profile, Root Guard, And Profile Entry

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/verify-otp.tsx`
- Modify: `app/(auth)/setup-profile.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`
- Modify: `app/(tabs)/profile/index.tsx`
- Modify: `app/(auth)/__tests__/login.test.tsx`
- Modify: `app/(auth)/__tests__/verify-otp.test.tsx`
- Modify: `app/(auth)/__tests__/setup-profile.test.tsx`
- Modify: `app/(tabs)/profile/__tests__/profile.test.tsx`

- [ ] **Step 1: Add Login Store Owner entry**

Add secondary action:

- Label: `Apply as a bookstore`
- After valid OTP request, push `/(auth)/verify-otp` with `{ phone, intent: 'store_owner' }`.

- [ ] **Step 2: Preserve intent in OTP verification**

Rules:

- Returning user + no intent -> `/(tabs)/library`
- Returning user + `store_owner` intent -> `/(store-owner)`
- New user + no intent -> `/(auth)/setup-profile`
- New user + `store_owner` intent -> `/(auth)/setup-profile?intent=store_owner`

- [ ] **Step 3: Preserve intent after setup profile**

Rules:

- No intent -> `/(tabs)/library`
- `store_owner` intent -> `/(store-owner)`

- [ ] **Step 4: Adjust root auth guard**

Authenticated users inside `(store-owner)` routes must not be redirected to `/(tabs)/library`.

- [ ] **Step 5: Add Profile Account menu entry**

Add:

- Label: `Store Owner Console`
- Accessibility label: `Store Owner Console`
- Route: `/(store-owner)`

- [ ] **Step 6: Run tests**

```powershell
npm test -- --runInBand app/(auth)/__tests__/login.test.tsx app/(auth)/__tests__/verify-otp.test.tsx app/(auth)/__tests__/setup-profile.test.tsx app/(tabs)/profile/__tests__/profile.test.tsx
```

Expected: pass.

---

## 2A Completion Criteria

- Broad owner update policies are hardened.
- Store Owner gate resolves states from marketplace records.
- Login and Profile entry route into the Store Owner gate.
- No feature uses `user_profiles.account_type` as Store Owner authority.
- All 2A tests pass.
- Phase 2B may start only after these criteria are met.
