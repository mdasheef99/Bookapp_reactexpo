# Phase 2B Store Application and Verification Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated Store Owner start, save, submit, and resume a bookstore application, including seller policy acceptance and private verification document metadata.

**Architecture:** Application writes use a controlled Edge Function with server-side caller resolution and store-admin checks. The client uploads files only to the private `seller-verification-docs` bucket under `{store_id}/...`, then records metadata through the Edge Function.

**Tech Stack:** Supabase Edge Functions, Supabase Storage, React Native, React Query, Jest.

---

## Prerequisite

Phase 2A must be complete. Do not implement 2B while broad owner update policies can mutate privileged onboarding columns.

## Files

- Create: `supabase/functions/_shared/marketplaceAuth.ts`
- Create: `supabase/functions/store-application/index.ts`
- Create: `supabase/functions/__tests__/store_application_function.test.ts`
- Extend: `src/features/stores/types.ts`
- Extend: `src/features/stores/services/storeOwnerService.ts`
- Extend: `src/features/stores/services/__tests__/storeOwnerService.test.ts`
- Create: `src/features/stores/screens/StoreOnboardingScreen.tsx`
- Create: `src/features/stores/screens/__tests__/StoreOnboardingScreen.test.tsx`
- Modify: `app/(store-owner)/onboarding.tsx`

---

## Task 1: Add Shared Marketplace Edge Function Auth Helpers

**Files:**
- Create: `supabase/functions/_shared/marketplaceAuth.ts`
- Create/modify: `supabase/functions/__tests__/store_application_function.test.ts`

- [ ] **Step 1: Add static tests for required auth checks**

The test should assert `store-application/index.ts` references:

- `SUPABASE_SERVICE_ROLE_KEY`
- `requireAuthenticatedUser`
- `requireStoreAdmin`
- no trusted `user_id` from request body
- denial behavior for wrong store actor

- [ ] **Step 2: Implement shared helper names**

`marketplaceAuth.ts` should expose:

```ts
export async function requireAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Response('Missing Authorization header', { status: 401 });
  // Create a Supabase client using the anon key and caller Authorization header.
  // Resolve and return auth.getUser().data.user.
}

export async function requireStoreAdmin(serviceClient: unknown, userId: string, storeId: string) {
  // Query store_administrators by store_id, user_id, status active.
  // Throw 403 if no relationship exists.
}
```

- [ ] **Step 3: Run tests**

```powershell
npm test -- --runInBand supabase/functions/__tests__/store_application_function.test.ts
```

Expected: fail until `store-application/index.ts` exists, then pass after Task 2.

---

## Task 2: Implement Store Application Edge Function

**Files:**
- Create: `supabase/functions/store-application/index.ts`
- Extend: `src/features/stores/types.ts`

- [ ] **Step 1: Define input contract in `types.ts`**

```ts
export interface StoreApplicationDraftInput {
  ownerFullName: string;
  ownerEmail?: string | null;
  supportContactChannel: 'phone' | 'email' | 'whatsapp';
  displayName: string;
  legalName?: string | null;
  legalSellerName: string;
  storeType: 'independent_bookstore' | 'second_hand_bookstore' | 'publisher_store' | 'library_store' | 'other';
  description?: string | null;
  city: string;
  state: string;
  pincode: string;
  localityId?: string | null;
  publicAddressMode: 'hidden' | 'locality_only' | 'full';
  sellerAgreementVersion: string;
  sellerAgreementAccepted: boolean;
  prohibitedItemsPolicyAccepted: boolean;
  supportPolicyAccepted: boolean;
  panStatus: 'not_collected' | 'provided' | 'not_applicable';
  gstin?: string | null;
  applicantNotes?: string | null;
}
```

- [ ] **Step 2: Add function actions**

```ts
type StoreApplicationAction =
  | { type: 'start_or_resume' }
  | { type: 'save_draft'; storeId: string; requestId: string; payload: StoreApplicationDraftInput }
  | { type: 'submit'; storeId: string; requestId: string; payload: StoreApplicationDraftInput }
  | { type: 'record_document'; payload: { storeId: string; requestId: string; documentType: string; storagePath: string; maskedLabel?: string } };
```

- [ ] **Step 3: Implement `start_or_resume`**

Server behavior:

- Resolve caller from Supabase Auth.
- If caller already has active `store_administrators`, return current store/request.
- Otherwise create:
  - `stores`: `draft`, `unverified`, `incomplete`, `not_allowed`
  - `store_administrators`: `owner`, `active`
  - `store_verification_requests`: `draft`
  - `marketplace_events`
  - `marketplace_audit_logs`

- [ ] **Step 4: Implement `save_draft`**

Server behavior:

- Resolve caller.
- Require active store admin relation.
- Whitelist application fields only.
- Reject any attempt to set privileged fields: `status`, `verification_status`, `setup_status`, `selling_status`, `approved_at`, `suspended_at`, `reviewed_by`, `reviewed_at`.

- [ ] **Step 5: Implement `submit`**

Server behavior:

- Validate required fields.
- Require seller agreement, prohibited-items policy, and support policy acceptance.
- Set `stores.status = 'pending_verification'`.
- Set `stores.verification_status = 'pending'`.
- Set acceptance timestamps and versions.
- Set request `status = 'submitted'`, `submitted_at = now()`.
- Insert event and audit log.

- [ ] **Step 6: Implement `record_document`**

Server behavior:

- Resolve caller.
- Require active store admin relation.
- Require `storagePath` starts with `${storeId}/`.
- Insert `store_verification_documents` metadata.

- [ ] **Step 7: Run function tests**

```powershell
npm test -- --runInBand supabase/functions/__tests__/store_application_function.test.ts
```

Expected: pass.

---

## Task 3: Add Client Service Methods

**Files:**
- Extend: `src/features/stores/services/storeOwnerService.ts`
- Extend: `src/features/stores/services/__tests__/storeOwnerService.test.ts`

- [ ] **Step 1: Add service methods**

```ts
startOrResumeApplication(): Promise<StoreOwnerGateState>
saveApplicationDraft(input: StoreApplicationDraftInput & { storeId: string; requestId: string }): Promise<void>
submitApplication(input: StoreApplicationDraftInput & { storeId: string; requestId: string }): Promise<void>
recordVerificationDocument(input: {
  storeId: string;
  requestId: string;
  documentType: string;
  storagePath: string;
  maskedLabel?: string;
}): Promise<void>
```

- [ ] **Step 2: Test Edge Function invocation payloads**

Assert each method calls `supabase.functions.invoke('store-application', ...)` with expected action names.

- [ ] **Step 3: Run service tests**

```powershell
npm test -- --runInBand src/features/stores/services/__tests__/storeOwnerService.test.ts
```

Expected: pass.

---

## Task 4: Build Store Onboarding Screen And Document Upload

**Files:**
- Create: `src/features/stores/screens/StoreOnboardingScreen.tsx`
- Create: `src/features/stores/screens/__tests__/StoreOnboardingScreen.test.tsx`
- Modify: `app/(store-owner)/onboarding.tsx`
- Extend: `src/features/stores/services/storeOwnerService.ts`

- [ ] **Step 1: Add minimal onboarding form**

Fields:

- owner full name
- owner email
- support contact channel
- display name
- legal name
- legal seller name
- store type
- description
- city
- state
- pincode
- public address mode
- seller agreement checkbox and version
- prohibited/counterfeit/pirated-book policy checkbox
- support/grievance policy checkbox
- PAN status
- GSTIN optional
- applicant notes

- [ ] **Step 2: Add save draft and submit**

Save draft calls `saveApplicationDraft`.

Submit calls `submitApplication` after required field and policy validation.

- [ ] **Step 3: Add private document upload**

Storage path:

```ts
const storagePath = `${storeId}/${requestId}/${documentType}/${Date.now()}-${safeFileName}`;
```

Bucket:

```ts
seller-verification-docs
```

After upload, call `recordVerificationDocument`.

- [ ] **Step 4: Add tests**

Assertions:

- Submit disabled until required policy checkboxes are accepted.
- Document upload uses `seller-verification-docs`.
- Document path starts with `${storeId}/`.
- No public URL is requested for seller verification documents.

- [ ] **Step 5: Run onboarding tests**

```powershell
npm test -- --runInBand src/features/stores/screens/__tests__/StoreOnboardingScreen.test.tsx src/features/stores/services/__tests__/storeOwnerService.test.ts
```

Expected: pass.

---

## 2B Completion Criteria

- Application can start/resume through Edge Function.
- Draft save and submit use whitelisted server-side writes.
- Seller agreement and prohibited-items acceptance are versioned.
- Seller documents upload to `seller-verification-docs/{store_id}/...`.
- Document metadata is store-scoped.
- Cross-tenant denial tests exist for application/document actions.
- All 2B tests pass.
