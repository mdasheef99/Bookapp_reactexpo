# Phase 2 Store Onboarding and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 2 through three ordered execution plans: secure Store Owner access, store application/document submission, and platform review/setup.

**Architecture:** Supabase Auth remains the only identity provider. Store Owner authority is resolved from server-side marketplace records. Privileged writes must go through hardened policies and Edge Functions, never client-controlled route params, local storage, `user_profiles.account_type`, or P2P exchange tables.

**Tech Stack:** Expo Router, React Native, React Query, Supabase Auth, Supabase Postgres/RLS, Supabase Storage, Supabase Edge Functions, Jest.

---

## Implementation Order

Implement these plans in order. Do not start 2B or 2C until 2A is reviewed and complete.

1. [PHASE-2A Store Owner Gate, Auth, and Security](./PHASE-2A-store-owner-gate-auth-security-plan.md)
2. [PHASE-2B Store Application and Verification Documents](./PHASE-2B-store-application-documents-plan.md)
3. [PHASE-2C Platform Review, Setup, and Entitlements](./PHASE-2C-platform-review-setup-entitlements-plan.md)

## Phase-Level Rules

- Phase 2 starts with RLS/write-boundary hardening.
- Supabase phone OTP stays as the auth mechanism.
- Store Owner intent may be carried through navigation params, but it is not authority.
- Store Owner authorization comes from `stores`, `store_administrators`, `store_verification_requests`, and `platform_user_roles`.
- The seller document bucket is `seller-verification-docs`.
- Do not reuse P2P `listings`, `transactions`, borrower/lender states, or credit assumptions.
- Do not build inventory, payments, orders, delivery, or image-to-LLM in Phase 2.

## Acceptance Criteria Map

- Login / first-run Store Owner entry: 2A.
- Profile Store Owner entry: 2A.
- Store Owner gate state resolver: 2A.
- Broad owner write hardening: 2A.
- Store application create/save/submit: 2B.
- Seller agreement and prohibited-items acceptance: 2B.
- Private document upload and metadata: 2B.
- Platform approve/reject/request-info/restrict/suspend: 2C.
- Trial subscription and entitlement assignment: 2C.
- Setup checklist: 2C.
- Tracker updates and final verification: 2C.

## Current Open Decisions

1. Agreement version strings. Recommended:
   - `seller-agreement-v2026-06-27`
   - `prohibited-items-v2026-06-27`
2. Store type value mapping. Current schema default is `independent`; DOC-2 uses values such as `independent_bookstore`. Recommended: map UI values to current DB-compatible values in the Edge Function, then add a later schema alignment migration only if needed.
3. Platform review UI. Recommended: keep Phase 2 platform review API-only unless an internal operator UI is explicitly required before pilot.

## Review Gate

Do not implement feature code until this parent plan and all three sub-plans are reviewed. If approved, implement 2A first.
