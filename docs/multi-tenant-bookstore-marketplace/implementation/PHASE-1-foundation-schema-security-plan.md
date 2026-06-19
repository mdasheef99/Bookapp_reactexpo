# Phase 1 Foundation Schema and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the separate bookstore marketplace foundation so Phase 1 migrations and RLS tests can be implemented without making product or security decisions on the fly.

**Architecture:** Build a separate marketplace domain beside the existing consumer/P2P/bookclub domain. Store-owned data is tenant-scoped by `store_id`; privileged platform actions are separated from Store Owner actions; public consumer reads use safe projections, not raw private tables.

**Tech Stack:** Supabase Postgres, Supabase Auth, Row Level Security, Supabase Storage, Edge Functions or private-schema server functions for privileged actions, Expo app later through existing Supabase client and React Query patterns.

---

## Plan Status

| Field | Value |
|---|---|
| Status | `needs_review` |
| Last updated | 2026-05-22 |
| Produces code? | No. This is a pre-migration implementation plan. |
| Next action | Founder/technical review, then convert approved sections into migrations and RLS tests. |

---

## Required Reading Before Implementation

1. [README](../README.md)
2. [DOC-13: Implementation Tracker](../DOC-13-implementation-tracker.md)
3. [PHASE-0: Codebase and DB Audit](./PHASE-0-codebase-db-audit.md)
4. [PHASE-1: Foundation Schema and Security](./PHASE-1-foundation-schema-security.md)
5. [DOC-0: Product Architecture](../DOC-0-product-architecture.md)
6. [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
7. [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
8. [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
9. [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
10. [DOC-14: Commerce State Machines](../DOC-14-commerce-state-machines.md)
11. [DOC-15: Finance, Tax, and Settlement Operating Model](../DOC-15-finance-tax-settlement-operating-model.md)

---

## Non-Negotiable Constraints

- Do not reuse P2P `listings`, `transactions`, `transaction_events`, `credit_events`, or `user_credit_balances`.
- Do not infer Store Owner access from `user_profiles.account_type`, route params, local storage, or client-selected store IDs.
- Do not put new privileged marketplace transitions in exposed public `SECURITY DEFINER` RPCs.
- Do not expose service-role keys, payment secrets, delivery secrets, raw webhooks, seller documents, payout details, or customer PII to the mobile app.
- Do not create Store Owner UI, consumer marketplace UI, live payments, delivery integration, or inventory screens in Phase 1.
- Do not enable broad realtime publication for marketplace tables in Phase 1.

---

## Phase 1 Scope

Phase 1 creates the data/security spine only:

- Store tenant identity.
- Store owner/admin membership.
- Store status and verification state.
- Platform policy configuration.
- Append-only marketplace events and admin/audit logs.
- Minimal platform roles and operator primitives.
- Minimal support/refund/reconciliation/settlement/moderation/delivery case queues as placeholders for later flows.
- Private and public storage bucket contracts.
- RLS and test matrix proving tenant isolation.

Phase 1 does not need production-grade business workflows. It must create the foundations that later phases can safely attach to.

---

## Proposed Schema Groups

### 1. Store Tenant Core

Create these tables first:

| Table | Purpose | Tenant Scope |
|---|---|---|
| `marketplace_localities` | Controlled city/locality entity for pilot gating and policy scoping. | Platform-level. |
| `stores` | Canonical bookstore tenant and public/private profile base. | Own row by `id`; store-owned root; FK to `marketplace_localities`. |
| `store_administrators` | Server-authoritative Store Owner membership. | `store_id`; user-scoped via `user_id`. |
| `store_status_history` | Append-only record of store status changes. | `store_id`. |

Recommended `stores` fields:

- identity: `id`, `display_name`, `legal_name`, `legal_seller_name`, `store_type`
- public profile: `description`, `logo_url`, `cover_url`, `city`, `state`, `pincode`, `locality_id` (FK to `marketplace_localities`), `public_address_mode`
- location: `location`
- operating settings: `operating_hours`, `pickup_enabled`, `delivery_enabled`, `minimum_delivery_order_value_minor`, `return_policy_type`
- status: `status`, `verification_status`, `setup_status`, `selling_status`, `suspension_reason`
- compliance: `seller_agreement_version`, `seller_agreement_accepted_at`, `prohibited_items_policy_accepted_at`, `support_policy_accepted_at`
- payout readiness: `payout_account_status`
- timestamps: `created_at`, `updated_at`, `approved_at`, `suspended_at`, `closed_at`

Recommended `stores.status` values:

- `draft`
- `pending_verification`
- `approved_pending_setup`
- `active`
- `selling_restricted`
- `suspended`
- `closed`
- `rejected`

Recommended `store_administrators` fields:

- `id`
- `store_id`
- `user_id`
- `role`
- `status`
- `assigned_at`
- `assigned_by`
- `revoked_at`
- `revoked_by`

MVP role values:

- `owner`

Deferred role values:

- `manager`
- `staff`

Do not implement manager/staff behavior in Phase 1, but do not make the schema owner-only forever.

### 2. Verification, Documents, And Payout Readiness

Create:

| Table | Purpose | Tenant Scope |
|---|---|---|
| `store_verification_requests` | Store application/review lifecycle. | `store_id`. |
| `store_verification_documents` | Metadata for private seller documents. | `store_id`. |
| `seller_payout_accounts` | Masked payout account metadata and verification state. | `store_id`. |
| `store_risk_reviews` | Internal risk flags and manual verification notes. | `store_id`. |

Important boundaries:

- `store_verification_documents.storage_path` points to private storage only.
- Store Owners may see document status and masked document metadata, not raw platform review notes.
- Platform Operators may review documents through role-gated server/admin paths.
- Payout account details should be stored so Store Owners can view masked status, while full sensitive details remain server/platform-only.

Recommended `store_verification_requests.status` values:

- `draft`
- `submitted`
- `needs_more_info`
- `approved`
- `rejected`
- `cancelled`

Recommended `seller_payout_accounts.status` values:

- `not_started`
- `submitted`
- `verified`
- `needs_review`
- `rejected`
- `disabled`

### 3. Subscription, Entitlement, Usage, And Policy Config

Create:

| Table | Purpose | Tenant Scope |
|---|---|---|
| `store_subscription_plans` | Platform-defined plans. | Platform-level. |
| `store_subscriptions` | Store's current plan and billing status. | `store_id`. |
| `store_entitlements` | Resolved explicit limits/features for a store. | `store_id`. |
| `store_usage_counters` | Periodic usage tracking. | `store_id`. |
| `marketplace_policy_config` | Platform-configurable SLA/payment/delivery/commission/rollout values. | Platform-level, optionally city/locality scoped. |

Policy config must support at least:

- confirmation SLA
- payment window expiry
- commission rate
- inventory/listing limits
- image extraction quotas
- return policy templates
- pilot city/locality gates
- store allowlist behavior
- storage retention windows
- suspension thresholds

Do not hardcode policy values in mobile clients.

Recommended `marketplace_policy_config.scope_type` values:

- `global`
- `city`
- `locality`
- `store`

Recommended `store_subscriptions.status` values:

- `trialing`
- `active`
- `past_due`
- `grace_period`
- `restricted`
- `cancelled`

Subscription restriction must not block fulfillment or support resolution for already accepted/paid orders in later phases.

### 4. Platform Roles And Admin Audit

Create:

| Table | Purpose | Tenant Scope |
|---|---|---|
| `platform_user_roles` | Internal BookConnect operator roles. | Platform-level. |
| `platform_admin_actions` | Append-only platform action log. | Platform-level with optional `store_id`. |

Recommended platform roles:

- `platform_admin`
- `store_reviewer`
- `support_agent`
- `finance_ops`
- `moderator`
- `delivery_ops`

Rules:

- Platform roles are not Store Owner roles.
- Platform role checks must not use user-editable metadata.
- Phase 1 may seed no roles in production data unless explicitly approved; implementation can rely on test fixtures for RLS tests.
- Every platform override/review action must write an admin action entry.

### 5. Event And Audit Foundation

Create:

| Table | Purpose | Tenant Scope |
|---|---|---|
| `marketplace_events` | Append-only product/commerce/system event stream. | Optional `store_id`, optional `user_id`. |
| `marketplace_notifications` | Column-safe client-readable notification projection populated from events. | Optional `store_id`, optional `user_id`. |
| `marketplace_audit_logs` | Append-only security/compliance audit trail. | Optional `store_id`. |
| `event_action_tasks` | Queue items derived from events for ops follow-up. | Optional `store_id`, assigned role. |
| `commerce_idempotency_keys` | Cross-scope idempotency contract for transitions/webhooks. | None; service-role only. |

Recommended `marketplace_events` fields:

- `id`
- `event_type`
- `entity_type`
- `entity_id`
- `store_id`
- `user_id`
- `actor_user_id`
- `actor_role`
- `source`
- `idempotency_key`
- `severity`
- `requires_action`
- `payload`
- `created_at`

Recommended event sources:

- `consumer_app`
- `store_owner_app`
- `platform_ops`
- `system_job`
- `payment_provider`
- `delivery_provider`
- `edge_function`

Phase 1 does not need all event types from DOC-10. It must support the envelope and write initial store/admin events:

- `store.application_created`
- `store.application_submitted`
- `store.application_approved`
- `store.application_rejected`
- `store.suspended`
- `store.reactivated`
- `store.selling_restricted`
- `store.policy_config_changed`
- `admin.action_recorded`

### 6. Minimal Ops Queues

Create minimal case tables now so later payment/delivery/support phases do not invent incompatible foundations:

| Table | Purpose | Tenant Scope |
|---|---|---|
| `support_cases` | Customer/store/platform support case shell. | Optional `store_id`; optional order later. |
| `refund_cases` | Refund workflow shell for later payment phase. | Optional `store_id`; order/payment nullable in Phase 1. |
| `finance_reconciliation_cases` | Payment/ledger/provider mismatch shell. | Optional `store_id`. |
| `settlement_batches` | Settlement batch shell for later ledger phase. | `store_id`. |
| `moderation_cases` | Store/listing moderation case shell. | Optional `store_id`. |
| `delivery_ops_cases` | Delivery exception shell for later delivery phase. | Optional `store_id`. |

These tables should support statuses and auditability but should not implement payment/delivery behavior yet.

Recommended shared case fields:

- `id`
- `store_id`
- `case_type`
- `status`
- `priority`
- `assigned_role`
- `assigned_to`
- `opened_by`
- `reason`
- `private_notes`
- `metadata`
- `created_at`
- `updated_at`
- `resolved_at`

Recommended common case statuses:

- `open`
- `under_review`
- `waiting_on_store`
- `waiting_on_customer`
- `waiting_on_provider`
- `resolved`
- `closed`
- `cancelled`

### 7. Storage Buckets

Create or plan these storage buckets:

| Bucket | Public? | Purpose | Phase 1 Requirement |
|---|---|---|---|
| `storefront-assets` | Public URL access, no broad listing | Store logos, banners, public storefront images. | Safe public-read contract. |
| `inventory-photos` | Public URL access for published listing images, no broad listing | Used-book condition photos. | Bucket can exist before inventory tables. |
| `seller-verification-docs` | Private | Seller KYC/business docs. | Required for Phase 2. |
| `order-dispute-evidence` | Private | Dispute/support evidence. | Bucket can exist before orders. |
| `image-extraction-inputs` | Private or signed URL only | Raw inventory extraction images. | Bucket can exist before image workflow. |

Storage policy principles:

- Public buckets must not allow clients to list all objects.
- Private bucket access must be mediated by strict policies or server-generated signed URLs.
- Storage paths must include `store_id` as the first path segment for store-scoped assets.
- Seller documents must never be public URLs.
- Store Owners cannot access another store's private files.

---

## RLS Policy Matrix

### Store Owner Access

| Table Group | Store Owner Read | Store Owner Write | Notes |
|---|---|---|---|
| `stores` | Own store only; limited private fields. | Own store setup fields only where status allows. | Platform-only fields require platform role. |
| `store_administrators` | Own membership rows. | No direct writes in MVP. | Platform/server-controlled. |
| `store_verification_requests` | Own store request/status. | Draft/needs-more-info fields only before submission. | Review fields platform-only. |
| `store_verification_documents` | Own document metadata/status. | Upload metadata for own store during onboarding. | Raw access through private storage rules. |
| `seller_payout_accounts` | Own masked payout status. | Initial submit/update only through controlled server path. | Full account fields private. |
| `store_subscriptions` / `store_entitlements` / `store_usage_counters` | Own store only. | No direct client writes. | Usage should be server/system-owned. |
| `marketplace_events` | None for clients; server-side only. | No direct writes from client. | Clients read `marketplace_notifications` instead. |
| ops/case tables | Own store cases where store participation is required. | Store responses only in later phases. | Platform notes hidden. |

### Consumer Access

| Table Group | Consumer Read | Consumer Write | Notes |
|---|---|---|---|
| `stores` | Public active store projection only. | None. | Avoid exposing private legal/payout/internal fields. |
| `storefront-assets` | Object URL access only. | None. | No bucket listing. |
| all private foundation tables | None. | None. | Consumer order access comes in later phases. |

### Platform Operator Access

| Table Group | Platform Read | Platform Write | Notes |
|---|---|---|---|
| store/verification/payout/risk | Role-gated. | Role-gated. | Every sensitive action audited. |
| policy config | Admin/finance/config roles only. | Admin/config roles only. | Changes audited. |
| ops/case tables | Role-gated by case type. | Role-gated by case type. | Support cannot make finance-only decisions. |
| private documents | Reviewer/admin only. | Reviewer/admin only. | Document access must be logged. |

---

## RLS Test Matrix

Phase 1 implementation is not acceptable without tests proving:

- Store Owner A can read own `stores` row.
- Store Owner A cannot read Store Owner B private store fields.
- Store Owner A cannot update Store Owner B rows.
- Consumer can read only public active store projection.
- Consumer cannot read seller verification documents, payout accounts, risk reviews, private notes, admin actions, raw marketplace events, or policy internals.
- Store applicant cannot publish/sell because publishing/order tables do not exist yet and selling status is not active.
- Platform role `store_reviewer` can read verification request and document metadata.
- Platform role `support_agent` cannot change payout account or settlement status.
- Platform role `finance_ops` can access finance/reconciliation shell tables but not seller document payloads unless explicitly granted.
- Suspended/restricted store status is visible to the Store Owner but does not grant selling rights.
- Storage path isolation prevents one store from accessing another store's private files.
- Public storage buckets do not permit broad listing.
- Service-role key is absent from app/client environment files.

Test fixtures should include:

- consumer-only user
- Store Owner A
- Store Owner B
- store applicant with draft request
- active store
- suspended store
- platform admin
- store reviewer
- support agent
- finance ops

---

## Implementation Task Plan

### Task 1: Confirm Live Baseline Before Migration

**Files:**
- Read: `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-0-codebase-db-audit.md`
- Read: `supabase/migrations/*`
- Modify: none

- [ ] Use Supabase MCP to list public tables and advisors.
- [ ] Confirm no marketplace tables already exist.
- [ ] Confirm current storage buckets and policies.
- [ ] Confirm no public realtime publication exists for marketplace tables.
- [ ] Record any new drift in `PHASE-1-foundation-schema-security.md` before writing migrations.

### Task 2: Create Migration Design For Store Tenant Core

**Files:**
- Modify later: new Supabase migration under `supabase/migrations/`
- Update after implementation: `PHASE-1-foundation-schema-security.md`

- [ ] Define `stores` with explicit status, verification, setup, selling, public profile, private legal, and policy fields.
- [ ] Define `store_administrators` with `store_id`, `user_id`, `role`, `status`, assignment, and revocation fields.
- [ ] Define `store_status_history` as append-only.
- [ ] Add indexes for all foreign keys and common lookup paths.
- [ ] Add constraints for allowed status/role values.
- [ ] Do not reference P2P `listings` or `transactions`.

### Task 3: Create Migration Design For Verification And Payout Readiness

**Files:**
- Modify later: new Supabase migration under `supabase/migrations/`
- Update after implementation: `PHASE-1-foundation-schema-security.md`

- [ ] Define `store_verification_requests`.
- [ ] Define `store_verification_documents`.
- [ ] Define `seller_payout_accounts`.
- [ ] Define `store_risk_reviews`.
- [ ] Keep platform review notes/private notes separate from Store Owner-visible fields.
- [ ] Ensure document rows reference private storage paths only.

### Task 4: Create Migration Design For Policy, Subscription, Entitlement, And Usage

**Files:**
- Modify later: new Supabase migration under `supabase/migrations/`
- Update after implementation: `PHASE-1-foundation-schema-security.md`

- [ ] Define `store_subscription_plans`.
- [ ] Define `store_subscriptions`.
- [ ] Define `store_entitlements`.
- [ ] Define `store_usage_counters`.
- [ ] Define `marketplace_policy_config`.
- [ ] Ensure policy config can support global, city, locality, and store scopes.
- [ ] Ensure usage counters can be reset by period without losing historical data.

### Task 5: Create Migration Design For Platform Roles, Audit, Events, And Ops Queues

**Files:**
- Modify later: new Supabase migration under `supabase/migrations/`
- Update after implementation: `PHASE-1-foundation-schema-security.md`

- [ ] Define `platform_user_roles`.
- [ ] Define `platform_admin_actions`.
- [ ] Define `marketplace_events` (no client SELECT policy).
- [ ] Define `marketplace_notifications` (column-safe projection for clients).
- [ ] Define `marketplace_audit_logs`.
- [ ] Define `event_action_tasks`.
- [ ] Define `support_cases`, `refund_cases`, `finance_reconciliation_cases`, `settlement_batches`, `moderation_cases`, and `delivery_ops_cases`.
- [ ] Define `commerce_idempotency_keys` with `(scope, key)` unique and service-role-only access.
- [ ] Keep all event/audit/case private payloads inaccessible to consumers.

### Task 6: Create Storage Bucket And Policy Design

**Files:**
- Modify later: Supabase storage migration or documented storage setup
- Update after implementation: `PHASE-1-foundation-schema-security.md`

- [ ] Define `storefront-assets`.
- [ ] Define `inventory-photos`.
- [ ] Define `seller-verification-docs`.
- [ ] Define `order-dispute-evidence`.
- [ ] Define `image-extraction-inputs`.
- [ ] Enforce first path segment as `store_id` for store-scoped assets.
- [ ] Prevent broad object listing on public buckets.
- [ ] Require private access or signed URL access for private buckets.

### Task 7: Implement RLS And Grants

**Files:**
- Modify later: new Supabase migration under `supabase/migrations/`
- Update after implementation: `PHASE-1-foundation-schema-security.md`

- [ ] Enable RLS on every new exposed table.
- [ ] Grant table access only where RLS policies intentionally allow it.
- [ ] Write Store Owner policies through a single private-schema helper `marketplace_sec.is_store_admin(store_id)` (or equivalent) that checks `store_administrators`.
- [ ] Write consumer public-read policies only for safe public store fields/projections.
- [ ] Write platform operator policies through `platform_user_roles`.
- [ ] Avoid public `SECURITY DEFINER` functions.
- [ ] If helper functions are required, place them in a private/unexposed schema, set `search_path`, and restrict `EXECUTE`.

### Task 8: Implement RLS, Storage, And Advisor Verification

**Files:**
- Create later: RLS/security tests in the repo's established Supabase test location or documented SQL test harness.
- Update after implementation: `PHASE-1-foundation-schema-security.md`
- Update after implementation: `DOC-13-implementation-tracker.md`

- [ ] Add fixtures for consumer, applicant, Store Owner A, Store Owner B, suspended store, and platform roles.
- [ ] Test cross-store denial.
- [ ] Test consumer private-data denial.
- [ ] Test platform role separation.
- [ ] Test private storage denial and public no-listing behavior.
- [ ] Run Supabase security advisor.
- [ ] Run Supabase performance advisor.
- [ ] Fix new Phase 1 advisor findings before marking Phase 1 complete.

---

## Deliberate Deferrals

Do not implement these in Phase 1:

- Store Owner app routes or UI.
- Seller application form UI.
- Inventory CRUD.
- Public marketplace search.
- Cart/order request.
- Payment provider integration.
- Finance ledger entries for real payments.
- Settlement calculations.
- Pickup code workflow.
- Delivery provider integration.
- Image-to-LLM extraction.
- Notification UI or broad realtime publication.

Phase 1 may create safe schema shells for future finance/ops flows, but it must not pretend those flows are implemented.

---

## Review Questions Before Migration

1. Are the table names acceptable as the permanent marketplace foundation?
2. Should `stores` remain in `public` with strict RLS, or should private admin-heavy tables move into a private schema with controlled views/API paths?
3. Which platform roles should exist at MVP launch versus internal test only?
4. Should payout account details be stored directly in Supabase, tokenized with a payment/payout provider, or deferred to provider onboarding?
5. Should public store profile access be through a table with column-safe RLS or a dedicated security-invoker projection?
6. Should existing Supabase advisor issues be remediated before or after Phase 1 foundation migrations?
7. What is the minimum operational queue set required before payment launch: support, refund, reconciliation, settlement, moderation, delivery, or all six?

---

## Acceptance Criteria For This Plan

- [x] Plan names the proposed foundation tables.
- [x] Plan identifies tenant boundaries.
- [x] Plan separates Store Owner, consumer, and platform operator access.
- [x] Plan includes storage bucket policy requirements.
- [x] Plan includes RLS/security test matrix.
- [x] Plan explicitly forbids P2P table reuse.
- [x] Plan defers UI, payment, delivery, and inventory implementation.
- [x] Plan is ready for review before migration work.

---

## Handoff

This plan is ready for review. After review, the implementation agent should convert the approved plan into migrations and RLS/security tests in small commits, updating [PHASE-1](./PHASE-1-foundation-schema-security.md) and [DOC-13](../DOC-13-implementation-tracker.md) after each meaningful checkpoint.
