# DOC-1: Identity, Security, and Compliance

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
**Status:** Planning draft
**Depends On:** DOC-0
**Owns:** Authentication model, Store Owner access, tenant isolation, RLS principles, privacy boundaries, DPDP-sensitive handling, and security acceptance criteria.

---

## 1. Purpose

This document defines the identity and security architecture for the BookConnect bookstore marketplace.

The marketplace is multi-tenant: every store-owned object must be scoped to one store, and every Store Owner action must be authorized through a verified store relationship. Consumer-facing search must use safe public projections and must never expose private store inventory or customer data.

---

## 2. Identity Principles

1. Supabase Auth remains the primary user identity provider.
2. A user may be a consumer and a Store Owner with the same Supabase user account.
3. Store Owner access is not inferred from app route, email, local storage, or user-supplied store IDs.
4. Store Owner access is derived from server-side store ownership records.
5. Store Owner and consumer app surfaces have separate navigation and access gates.
6. Store Staff/manager access is deferred from MVP.
7. Platform Operator access is separate from Store Owner access.

---

## 3. Roles and Access

| Role | Access Source | Allowed Surface | Notes |
|---|---|---|---|
| Consumer | Authenticated user session | Consumer app | Can search/order from public store listings. |
| Store Applicant | Authenticated user with verification request | Store onboarding | Can complete onboarding but cannot sell until approved. |
| Store Owner | `store_administrators.role = 'owner'` for active store | Store Owner surface | Can manage only owned store. |
| Store Staff | Future role | Deferred | Not part of MVP. |
| Platform Operator | Internal platform role | Platform ops/admin | Can approve stores, resolve disputes, manage platform-level configuration. |
| Delivery Partner | External system identity | Backend integration only | No mobile app access. |

---

## 4. Store Owner Access Model

### 4.1 Store Ownership Query

The Store Owner surface must resolve access by querying store ownership for the authenticated user.

Conceptual query:

```sql
select
  sa.store_id,
  sa.role,
  s.status,
  s.display_name,
  s.verification_status
from store_administrators sa
join stores s on s.id = sa.store_id
where sa.user_id = auth.uid()
  and sa.role = 'owner'
  and s.status in ('active', 'approved_pending_setup')
limit 1;
```

MVP assumes one active owned store per user. Multi-store ownership is deferred but should not be made impossible by schema design.

### 4.2 Store Owner Context

The Store Owner surface should expose:

```typescript
interface StoreOwnerContextValue {
  storeId: string;
  storeName: string;
  storeStatus: 'approved_pending_setup' | 'active' | 'selling_restricted' | 'suspended' | 'closed';
  verificationStatus: 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended';
  role: 'owner';
}
```

`storeId` must only come from this context or server-validated responses. It must not come from route params, deep links, AsyncStorage, MMKV, or client-controlled input.

---

## 5. Onboarding States

The Store Owner gate must support more states than a simple authorized/unauthorized check.

| State | Condition | App Behavior |
|---|---|---|
| unauthenticated | No valid Supabase session | Route to Store Owner login/signup. |
| consumer_only | User has no store application or owner role | Show bookstore onboarding entry. |
| application_draft | User started application but has not submitted | Resume onboarding. |
| pending_verification | Application submitted but not approved | Show review status screen. |
| rejected | Application rejected | Show reason and support/contact path. |
| approved_pending_setup | Store approved but setup incomplete | Continue store setup. |
| active_owner | Owner role and active store | Enter Store Owner dashboard. |
| suspended | Store or owner access suspended | Block selling; show support path. |

These states are owned by DOC-2, but the auth gate must route them correctly.

### 5.1 Store Owner Entry Routing

The app must provide two human entry points into the Store Owner gate:

| Entry Point | Intended User | Required Behavior |
|---|---|---|
| Login / first-run auth screen | New or unauthenticated bookstore owner | Present a Store Owner login/signup/apply option. After authentication, evaluate the Store Owner gate and route by onboarding state. |
| Profile section | Existing signed-in user | Present a Store Owner Console / Apply as Bookstore option. On tap, evaluate the Store Owner gate and route by onboarding state. |

Both entry points must use the same Supabase auth session model. Do not create a separate identity system for bookstore owners in MVP. The selected entry point may set a navigation intent such as `store_owner`, but authorization must come only from server-side ownership/application records.

---

## 6. Tenant Boundary

Every store-owned table must include `store_id`.

Required store-scoped tables:

- `store_administrators`
- `store_verification_requests`
- `store_subscriptions`
- `store_entitlements`
- `store_inventory`
- `marketplace_book_listings`
- `image_extraction_sessions`
- `store_order_requests`
- `store_order_request_items`
- `store_orders`
- `store_order_items`
- `delivery_shipments`
- `finance_ledger_entries`
- `settlement_batches`
- `marketplace_audit_logs`
- `commerce_idempotency_keys`

Defense-in-depth rule:

- Client queries must include `store_id` filters for store-scoped data.
- RLS must enforce `store_id` ownership regardless of client filters.
- Server-side Edge Functions must independently verify the caller's store relationship.

---

## 7. RLS Policy Principles

### 7.1 Store Owner Read/Write

Store Owners can read and mutate rows for stores they own.

Conceptual policy:

```sql
marketplace_sec.is_store_admin(target_table.store_id)
```

where `marketplace_sec.is_store_admin(UUID)` is a `SECURITY DEFINER` helper in the private `marketplace_sec` schema with a pinned `search_path` and `EXECUTE` revoked from `anon` (see SEC-04).

### 7.2 Consumer Public Reads

Consumers can read only approved public marketplace projections:

- active stores
- public store profile fields
- public marketplace listings
- public book metadata
- store fulfillment availability

Consumers must not read:

- internal inventory location
- store acquisition cost
- OCR confidence
- duplicate resolution state
- seller verification documents
- payout details
- settlement data
- other customers' order data

### 7.3 Customer Order Reads

Customers can read their own order requests and orders.

Store Owners can read order data for their own store.

Platform Operators can read orders through internal tools, not through the Store Owner surface.

### 7.4 No Public Privileged Functions

The Supabase audit found many existing broad `SECURITY DEFINER` functions. New bookstore marketplace work should avoid this pattern.

Rules:

- Privileged marketplace state transitions should be Edge Functions or private-schema RPCs.
- If an RPC is required, it must set `search_path`.
- `EXECUTE` must be revoked from `anon` unless explicitly public.
- Sensitive functions must validate `auth.uid()` internally.
- Functions must not accept trusted user IDs from the client when `auth.uid()` can be used.

---

## 8. Client Security Rules

1. Mobile app uses only public anon/publishable Supabase keys.
2. Service-role keys must never be bundled into the app.
3. Store Owner `storeId` must not be persisted as an authority.
4. Deep links into Store Owner routes must pass through the Store Owner access gate.
5. Excluded platform/operator routes must not exist in Store Owner navigation.
6. Local storage must not persist customer PII.
7. React Query cache must be cleared on logout.
8. MMKV may store non-PII workflow state, but must be purged on logout.

---

## 9. Data Classification

| Data Category | Examples | Local Persistence |
|---|---|---|
| Public book metadata | title, author, ISBN, cover | Allowed through normal app cache |
| Public store profile | name, area, city, public hours | Allowed through normal app cache |
| Store private inventory | shelf location, cost, notes, OCR confidence | Store Owner cache only; clear on logout |
| Customer PII | name, phone, address, email | Do not persist to MMKV/AsyncStorage |
| Payment data | gateway order ID, payment ID | Server-side only except non-sensitive checkout references |
| Seller verification | documents, bank details, GST docs | Server-side only; never public |
| Settlement data | payout account, ledger, adjustments | Server-side and platform ops only |
| Image extraction state | session ID and minimal UI cursor | Local cache only; authoritative candidate/session state is server-side and cleared locally on logout |
| Scan images/raw AI payloads | spine images, model/provider responses | Never persist in normal client storage, logs, analytics, events, or notifications |
| Customer-requested copy photos | current-copy request evidence | Private request-scoped access only; never public or stored as a reusable local URL/token |

---

## 10. DPDP and Privacy Rules

BookConnect is the data fiduciary for marketplace customer data. Store Owners process data only for store fulfillment.

As of this planning update, the Digital Personal Data Protection Rules, 2025 have been published by MeitY. The compliance model must therefore treat DPDP as an active implementation constraint, not a future concern. Exact legal obligations and effective dates must be reviewed with counsel before launch.

Rules:

- Store Owners see customer PII only for orders requiring fulfillment.
- Store Owners cannot browse global customer profiles.
- Store Owners cannot export customer PII.
- Customer address and phone may be shared with delivery partners only after order confirmation/payment and only for fulfillment.
- Privacy policy must disclose third-party delivery partner sharing and image-to-LLM data processor sharing (including the LLM vendor and any metadata-enrichment providers used by the image extraction workflow).
- Customer data must not be logged to Sentry or device logs.
- Support/dispute workflows must minimize customer data shown to store owners.

Additional planning requirements:

- notices must explain what personal data is processed for marketplace orders, delivery, support, refunds, seller onboarding, and image-to-LLM extraction (including that shelf/cover images may be processed by an LLM vendor and metadata providers)
- consent/notice text must be clear and independently understandable where required
- data principal rights and grievance paths must route through BookConnect platform operations
- breach notification and incident response processes must be defined before production payments
- retention rules must distinguish operational evidence from unnecessary local/client storage
- child/minor-specific flows are not targeted in the Bangalore pilot and must be revisited before broader consumer growth, school programs, or minor-oriented features

---

## 11. India Marketplace Compliance Guardrails

The marketplace must include compliance surfaces appropriate for an India-facing e-commerce marketplace before customer payment launch.

Required planning assumptions:

- customer-facing marketplace pages must disclose seller/store identity and policy information required for a marketplace model
- return, refund, exchange, delivery, cancellation, and grievance paths must be visible before payment
- seller agreement must prohibit counterfeit, pirated, unlawful, misleading, or restricted listings
- seller contact/grievance routing must be implemented through BookConnect-approved channels, not raw personal contact leakage
- formal customer grievances, data-rights requests, and legal escalations are platform operations responsibilities
- payment, tax, GST/TCS, invoice, and settlement treatment must be reviewed with legal/accounting/payment partners before production launch
- BookConnect support and platform operations own formal customer grievances, disputes, refunds, and data-rights routing
- seller-of-record and marketplace-facilitator positioning must be reflected in customer-facing copy and order snapshots

This specification is an engineering guardrail, not legal advice.

---

## 12. Retention and Evidence Rules

The system must distinguish cache minimisation from legally/operationally necessary evidence retention.

Do not persist customer PII in mobile storage, but retain server-side evidence needed for:

- order item snapshots
- price and policy snapshots shown before payment
- payment webhook records
- delivery webhook records
- pickup verification records
- condition photos used in disputes
- refund and dispute decisions
- seller verification documents
- seller agreement acceptance
- platform admin audit logs

Retention periods must be policy-controlled and reviewed before launch. Store Owner and consumer clients must never receive raw payment webhook payloads, raw delivery webhook payloads, or seller verification documents unless explicitly required by their role.

---

## 13. Storage Security

Required storage buckets:

| Bucket | Public? | Purpose |
|---|---|---|
| `storefront-assets` | Public read by URL, no broad listing | Store logos, banners, public storefront images. |
| `inventory-photos` | Public read by URL for approved sanitized listing images, no broad listing | Public actual-copy/damage derivatives only; never raw client uploads. |
| `seller-verification-docs` | Private | Seller KYC/business verification documents. |
| `order-dispute-evidence` | Private | Support/dispute images and attachments. |
| `image-extraction-inputs` | Private or short-lived signed URL | Images uploaded for LLM extraction. |

Phase 9 also requires a private short-lived media-staging boundary and a private request-item photo boundary. Final names must be collision-checked during migration review; the planning names are `marketplace-media-staging` and `order-request-photos`.

Image extraction egress rules (DPDP/data processor alignment):

- Uploaded extraction images must have EXIF/geolocation stripped before transmission to the LLM vendor.
- Only the minimum image data required for book extraction should be sent to the LLM vendor and metadata providers.
- The LLM vendor and metadata providers are data processors; a data-processing agreement must be in place before production use.
- Vendor reuse of images for model training or marketing is prohibited unless explicit platform policy and consent allow it.
- Provider normalization must record field-level reuse policy separately from provenance: matching-only, storage allowed, public display allowed, image caching allowed, attribution required, and expiry/revalidation required. Receiving a cover, description, or other field is not itself publication permission.
- A cross-border data residency/transfer review must be completed before production launch and documented as a payment/launch gate.

Phase 9 media and AI security rules:

- clients request a purpose- and entity-bound upload authorization; the server generates the final object path
- validate file signature, detected MIME, decode, byte/dimension/pixel limits, then re-encode and strip EXIF/GPS before model egress or public promotion
- scan images, public copy/damage media, and customer-request photos are separate purposes with separate access and retention
- no scan image becomes public automatically; only an approved sanitized derivative may enter `inventory-photos`
- the vision model receives no tools, credentials, signed URLs, customer PII, store authority, or database/provider access
- model/provider output is untrusted, must satisfy a strict versioned schema, and must never directly construct a database query, storage path, URL, or rendered active content
- customer-request photos are private to the relevant request customer, store, and action-specific platform support role
- signed URLs/tokens, raw images, raw payloads, and prompts must not appear in logs, Sentry, analytics, events, notifications, or audit metadata
- lifecycle deletion, dispute/legal holds, orphan cleanup, and deletion evidence are server-managed and observable

Storage policies must avoid broad object listing. Public buckets should provide object URL access without allowing clients to enumerate all objects.

Every new Phase 9 table exposed through the API has RLS. Default `PUBLIC` table/function privileges and default function `EXECUTE` are revoked; `anon` and `authenticated` receive only explicit minimum grants. Raw attempts, jobs, usage/cost, and lifecycle tables remain service-only. Privileged helpers live outside `public` where practical, pin `search_path`, schema-qualify every table/function reference, and have direct-execution and search-path-poisoning denial tests. Owner/customer reads use bounded safe commands or projections rather than authoritative operational tables.

---

## 14. Platform Exclusions From Store Owner Surface

Store Owners must not access:

- platform-wide user management
- platform-wide subscriptions and revenue
- other stores' data
- other stores' customer orders
- seller verification decisions for other stores
- platform moderation queues
- global delivery provider configuration
- platform settlement controls
- DPDP erasure request processing

Store Owners may access:

- their own subscription status and plan limits
- their own store orders
- their own settlement summary
- their own public storefront configuration
- their own order/customer data needed for fulfillment

---

## 15. Audit Logging

The marketplace should audit security-sensitive actions:

- store application submitted
- store approved/rejected/suspended
- payout account added or changed
- owner access changed
- inventory published/unpublished
- order request confirmed/rejected
- payment created/refunded
- delivery assigned/cancelled
- support/dispute action taken
- platform operator override
- seller verification document access
- customer grievance/dispute access
- payment/refund/settlement decisions
- delivery exception overrides

Audit logs must include:

- actor user ID
- actor role
- store ID if applicable
- target entity type and ID
- action
- timestamp
- structured metadata

Audit logs should be append-only for normal application code.

---

## 16. Security Acceptance Criteria

| ID | Criterion |
|---|---|
| SEC-01 | Consumer cannot read private inventory fields. |
| SEC-02 | Store Owner A cannot read or mutate Store Owner B data. |
| SEC-03 | Store Owner cannot access platform operator routes or APIs. |
| SEC-04 | Store applicant cannot sell until approved. |
| SEC-05 | Suspended store cannot publish listings or accept orders. |
| SEC-06 | Store Owner `storeId` is derived from authenticated ownership records only. |
| SEC-07 | Customer PII is cleared from client cache on logout. |
| SEC-08 | Customer PII is not written to MMKV or AsyncStorage. |
| SEC-09 | Service-role key is absent from mobile bundle. |
| SEC-10 | Seller verification documents are private and not accessible through public URLs. |
| SEC-11 | Delivery partner payload receives only data required for fulfillment. |
| SEC-12 | Privileged marketplace transitions validate actor authorization server-side. |
| SEC-13 | Customer-facing marketplace APIs expose policy and seller disclosure data without leaking private seller/customer data. |
| SEC-14 | Payment, delivery, and dispute evidence is retained server-side and not exposed to unauthorized clients. |
| SEC-15 | Store Owner console cannot process formal customer erasure or grievance requests directly. |
| SEC-16 | Every service-role function has a passing cross-tenant denial test. |
| SEC-17 | Unvalidated media cannot reach a model or public bucket. |
| SEC-18 | Store A cannot upload, read, promote, link, or delete Store B media. |
| SEC-19 | Scan and customer-request media cannot be retrieved through public marketplace APIs/URLs. |
| SEC-20 | Model/provider output has no tool authority and cannot directly cause a database/storage/publication action. |
| SEC-21 | Media retention, holds, deletion, and orphan cleanup are persisted, idempotent, and tested. |
| SEC-22 | Phase 9 tables/functions follow an explicit least-privilege grant matrix with RLS, revoked ambient privileges, pinned `search_path`, and direct-use denial tests. |
| SEC-23 | Provider provenance cannot grant storage/display/cache rights; field-level policy controls reuse, attribution, and revalidation. |

---

## 17. Open Implementation Risks

| Risk | Required Planning Response |
|---|---|
| Same user can be consumer and Store Owner | Navigation must support explicit surface switching from Login for first-time users and Profile for existing users. |
| Store can be approved but subscription inactive | Entitlement checks must be separate from identity checks. |
| Existing DB has public privileged functions | New marketplace functions must use stricter grants and private schemas/Edge Functions. |
| Store Owner needs customer contact for fulfillment | Show only order-scoped PII and avoid local persistence. |
| Public listing needs store availability | Use public projection, not raw `store_inventory`. |
| Seller docs are sensitive | Store in private bucket with signed access only for platform ops. |
| Legal/accounting interpretation can change checkout copy, seller onboarding fields, and settlement reporting. | Treat legal/accounting review as a payment-launch gate. |
| DPDP Rules 2025 and implementation timeline affect privacy notices, rights handling, breach process, and child/minor handling | Treat DPDP/privacy review as a launch gate before production payments and before broader consumer growth. |
| LLM vendor data processor and image egress/residency | Require data-processing agreement, EXIF stripping, minimum-data transfer, and cross-border residency review before production image extraction. |
| Children/minors or school communities may trigger additional privacy/product obligations | Not targeted in pilot; revisit before broader launch or school/community programs. |

---

## 18. External References

Use current official sources during privacy/compliance review:

- [MeitY Digital Personal Data Protection Act, 2023 PDF](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [MeitY Digital Personal Data Protection Rules, 2025 PDF](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [MeitY DPDP commencement notification, 2025 PDF](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [Consumer Protection rules index](https://consumeraffairs.gov.in/pages/consumer-protection-acts)

---

## 19. Related Documents

- [README](./README.md)
- [DOC-0: Product Architecture](./DOC-0-product-architecture.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
