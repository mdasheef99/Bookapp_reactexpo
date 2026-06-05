# DOC-2: Store Onboarding, Verification, and Subscriptions

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1
**Owns:** Store onboarding, seller verification, store profile setup, operating settings, subscriptions, entitlements, and OCR/inventory quotas.

---

## 1. Purpose

This document defines how bookstores become sellers on BookConnect and how their access is governed after approval.

Onboarding and verification are mandatory because BookConnect is a marketplace facilitator: customers place orders through the app, delivery partners may collect books from stores, and BookConnect handles payment and settlement flows. A bad seller creates risk across customer trust, refunds, delivery, and compliance.

---

## 2. Onboarding Goals

The onboarding flow must:

- let a bookstore owner apply from inside the app
- be discoverable from the Login / first-run auth screen for new users
- be discoverable from the Profile section for existing signed-in users
- collect enough information for platform review
- verify the store is a real bookstore or eligible seller
- configure public store details
- configure fulfillment settings
- collect payout information before settlement
- select or assign a subscription plan
- create owner access only after approval
- prevent selling until required setup is complete

### 2.1 Onboarding Entry Points

| Entry Point | Behavior |
|---|---|
| Login / first-run auth screen | New or unauthenticated users can choose the Store Owner path, authenticate, and then start or resume seller onboarding. |
| Profile section | Existing signed-in users can choose Store Owner Console / Apply as Bookstore and then start, resume, or view seller onboarding status. |

The onboarding entry point must never bypass verification. A user who enters from Login or Profile and has no store application is routed to `not_started`; a user with a draft is routed to `draft`; an approved active owner is routed to the Store Owner console.

---

## 3. Onboarding State Machine

| State | Meaning | Allowed Actions |
|---|---|---|
| `not_started` | User has no store application. | Start application. |
| `draft` | Application started but not submitted. | Edit, save, submit. |
| `submitted` | Application submitted for review. | View status, contact support. |
| `needs_more_info` | Platform requested additional information. | Edit requested fields, resubmit. |
| `approved_pending_setup` | Seller approved but operational setup incomplete. | Complete profile, fulfillment, payout, subscription. |
| `active` | Store can publish listings and receive orders. | Full Store Owner MVP access. |
| `rejected` | Application rejected. | View reason, contact support, optionally reapply if allowed. |
| `suspended` | Store was active but access is restricted. | View suspension status, contact support. |
| `closed` | Store voluntarily or administratively closed. | Read-only historical view if allowed. |

Only `active` stores can accept order requests and publish new marketplace listings.

---

## 4. Required Store Application Data

### 4.1 Owner Identity

Required:

- authenticated Supabase user ID
- owner full name
- phone number
- email
- preferred support contact channel

Optional or later:

- government ID verification
- alternate contact person

### 4.2 Store Identity

Required:

- legal or operating store name
- public display name
- store type: `independent_bookstore`, `second_hand_bookstore`, `publisher_store`, `library_store`, `other`
- description
- primary language(s)
- year established if available

### 4.3 Store Location

Required:

- address line 1
- address line 2
- city
- state
- pincode
- geolocation point
- public area/locality label

The geolocation point is required for nearby search and delivery serviceability.

### 4.4 Business Verification

Required for review:

- storefront photo or proof of physical presence
- business contact number
- document upload appropriate to store type
- platform seller agreement acceptance
- legal seller name
- PAN or equivalent tax identity where required by platform/payment policy
- GSTIN where available/applicable
- prohibited/counterfeit/pirated-book policy acceptance
- grievance/support routing policy acceptance

Possible document types:

- GST certificate if applicable
- shop establishment certificate if applicable
- business registration document
- rental/ownership proof
- library/cafe/venue proof for non-traditional sellers
- platform-approved manual verification note

GST should not be mandatory for every small store at MVP unless legal/accounting review requires it. The platform should support small/local bookstores that may not have formal enterprise documentation.

### 4.5 Payout Information

Required before first settlement:

- beneficiary name
- bank account number
- IFSC
- account type
- payout contact
- verification status

Payout information is private and visible only to platform operations and the store owner in masked form.

---

## 5. Store Profile Setup

Public store profile fields:

- store display name
- logo
- cover image
- short description
- city/locality
- public address or area-level address, depending on store preference
- public contact preference if enabled
- opening hours
- pickup availability
- delivery availability
- return policy summary
- bookclub-friendly status

Private store fields:

- legal name
- verification documents
- payout details
- internal notes
- support history
- platform risk flags

---

## 6. Operating Settings

Each store must configure:

- weekly opening hours
- temporary closure/vacation mode
- order confirmation SLA preference within platform limits
- pickup enabled/disabled
- pickup instructions
- delivery enabled/disabled
- delivery radius or pincode coverage if store-defined
- minimum order value for delivery
- packaging readiness expectation
- return policy
- cancellation policy

MVP confirmation timer:

- timer runs only during open hours
- target confirmation window is 6 hours to 1 business day
- platform can set a shorter recommended SLA for reliability scoring

---

## 7. Return Policy Model

Stores choose from platform-defined return policy templates.

Recommended MVP templates:

| Policy | Meaning |
|---|---|
| `no_returns_except_wrong_item` | No returns unless wrong book/edition or undisclosed damage. |
| `returns_within_3_days` | Returns accepted within 3 days if condition is unchanged. |
| `returns_within_7_days` | Returns accepted within 7 days if condition is unchanged. |

For used books, the customer must see the store's return policy before payment.

BookConnect should still reserve platform-level override rights for fraud, wrong item, counterfeit item, or severe misrepresentation.

---

## 8. Seller Agreement

Before approval, the owner must accept a seller agreement covering:

- accurate inventory responsibility
- timely order confirmation
- offline sale sync expectations
- packaging expectations
- customer data handling
- prohibited/counterfeit/pirated book restrictions
- return and cancellation obligations
- payout and settlement terms
- commission and subscription terms
- platform suspension rights
- dispute cooperation requirements
- seller disclosure and policy display obligations
- tax and payout information accuracy
- customer grievance escalation through BookConnect-approved channels
- audit and evidence retention for disputes, refunds, and compliance

Acceptance should be versioned:

```text
seller_agreement_version
accepted_at
accepted_by_user_id
ip/device metadata if legally useful
```

---

## 9. Seller Compliance and Risk Review

Store verification should support small local bookstores while still managing marketplace risk.

Risk review signals:

- incomplete or inconsistent store identity
- unverifiable physical location
- repeated duplicate applications
- suspicious payout details
- unusually high-value inventory without evidence
- repeated cancelled/unavailable orders after approval
- counterfeit/piracy complaints
- policy or grievance non-cooperation

Required compliance posture:

- GSTIN should be captured where available or legally/business required, but lack of GSTIN should not automatically block a very small bookstore unless policy/legal review requires it
- PAN/tax identity and payout details should be captured according to payment/settlement partner requirements
- seller agreement acceptance is mandatory before selling
- platform must be able to suspend selling while allowing existing paid orders to be fulfilled or resolved

---

## 10. Subscription Model

BookConnect uses a hybrid monetization model:

- subscription for bookstore management tools
- small commission on completed book sales

Store Owners can manage only their own plan and billing status. Platform-wide subscription management is reserved for platform operators.

### 10.1 Founding Store Program

Initial pilot monetization should not create too much friction before order volume is proven.

Recommended pilot model:

- free or discounted subscription for 3 to 6 months
- limited free image-to-LLM credits
- concierge/manual onboarding support for first stores
- commission on completed paid orders
- visible plan/quota status from day one
- paid upgrade path after the store sees demand and operational value

This does not replace the long-term hybrid subscription plus commission model. It stages monetization so early Bangalore stores can prove supply, inventory workflow, and order demand first.

### 10.2 Plan Tiers

Initial planning tiers:

| Tier | Target Store | Includes |
|---|---|---|
| `starter` | Small/local stores | Limited inventory, limited image extraction, basic storefront, basic order tools. |
| `growth` | Mid-size bookstores | Higher inventory limits, higher extraction quota, storefront marketing tools, basic analytics. |
| `enterprise` | Large/multi-location sellers | Custom limits, priority support, advanced analytics, future staff delegation. |

Exact prices are not defined in this spec. Pricing belongs to business/legal review.

### 10.3 Entitlements

Entitlements should be represented as explicit limits rather than hardcoded plan checks.

Examples:

- `inventory_item_limit`
- `monthly_image_extraction_limit`
- `manual_entry_limit`
- `active_listing_limit`
- `storefront_banner_limit`
- `featured_book_limit`
- `analytics_enabled`
- `export_enabled`
- `priority_support_enabled`
- `staff_accounts_limit` (deferred)

### 10.4 Subscription Statuses

| Status | Meaning | Behavior |
|---|---|---|
| `trialing` | Trial plan active. | Allow within trial entitlements. |
| `active` | Paid or manually active plan. | Allow according to entitlements. |
| `past_due` | Payment failed or renewal pending. | Grace period; warn owner. |
| `grace_period` | Limited grace after payment issue. | Allow core operations; block quota expansion. |
| `restricted` | Subscription inactive beyond grace. | Block publishing new inventory/listings; keep order fulfillment accessible. |
| `cancelled` | Plan cancelled. | Read-only or downgraded behavior. |

Important: subscription restriction must not prevent a store from fulfilling already paid orders.

---

## 11. Commission Model

Each completed order can generate a platform commission.

Commission planning fields:

- commission rate
- fixed platform fee if any
- delivery fee pass-through
- tax/GST treatment fields
- promotion/discount attribution
- refund adjustment rules

Commission is calculated in the commerce/settlement layer, not inside the subscription module.

Commission configuration must remain separate from tax/GST/TCS treatment. Legal/accounting review must decide how commission invoices, seller payouts, TCS if applicable, and credit notes are represented.

---

## 12. Quotas and Usage Tracking

Usage counters should track:

- image extraction calls
- metadata provider calls
- active inventory count
- active public listing count
- storefront asset count
- monthly order volume
- failed confirmation count

Image extraction quota should count attempted processing, not only successful inventory additions, because API costs are incurred even when extraction fails.

Quota behavior:

- warn at 80 percent usage
- block paid/external-cost actions at 100 percent unless plan allows overage
- allow manual entry if image quota is exhausted, unless inventory/listing limits are also reached

---

## 13. Suggested Data Model

```text
stores
  id
  display_name
  legal_name
  legal_seller_name
  pan_status
  gstin nullable
  store_type
  description
  status
  verification_status
  payout_account_status
  seller_agreement_accepted_at
  prohibited_items_policy_accepted_at
  address fields
  location geography(Point)
  operating_hours jsonb
  pickup_enabled
  delivery_enabled
  minimum_delivery_order_value
  return_policy_type
  bookclub_hosting_interest
  created_at
  updated_at

store_administrators
  id
  store_id
  user_id
  role
  status
  assigned_at
  assigned_by

store_verification_requests
  id
  store_id
  submitted_by
  status
  submitted_at
  reviewed_by
  reviewed_at
  rejection_reason
  required_follow_up jsonb

store_verification_documents
  id
  store_id
  verification_request_id
  document_type
  storage_path
  status
  reviewed_by
  reviewed_at

store_subscription_plans
  id
  code
  name
  status
  billing_period
  base_price
  entitlements jsonb

store_subscriptions
  id
  store_id
  plan_id
  status
  started_at
  current_period_start
  current_period_end
  grace_until
  billing_provider
  provider_subscription_id

store_usage_counters
  id
  store_id
  period_start
  period_end
  metric
  used
  limit_value

store_risk_reviews
  id
  store_id
  risk_type
  status
  severity
  notes private
  reviewed_by nullable
  created_at
  updated_at
```

Exact schema should be finalized during implementation planning and DB migration design.

---

## 14. Platform Review Workflow

1. Store applicant submits onboarding form.
2. Platform operator reviews store details and documents.
3. Operator approves, rejects, or requests more information.
4. On approval:
   - store status becomes `approved_pending_setup`
   - owner record is created or activated
   - subscription/trial entitlement is assigned
5. Owner completes operational setup.
6. Store becomes `active`.

Platform review actions:

- approve
- reject
- request more information
- suspend later if required
- restrict selling while preserving fulfillment of existing paid orders
- mark store for enhanced review

Platform operators must be able to suspend a store for:

- verification fraud
- repeated order failures
- prohibited listings
- customer disputes
- payout/payment issues
- legal/compliance reasons

---

## 15. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| ONB-01 | User can start, save, submit, and resume a store application. |
| ONB-01A | New users can discover the Store Owner onboarding path from Login / first-run auth. |
| ONB-01B | Existing signed-in users can discover the Store Owner onboarding path from Profile. |
| ONB-02 | Store cannot publish listings before approval. |
| ONB-03 | Store cannot receive order requests before required setup is complete. |
| ONB-04 | Platform operator can approve, reject, or request more information. |
| ONB-05 | Approved store owner can access only their own Store Owner surface. |
| SUB-01 | Store Owner can see current plan, status, limits, and usage. |
| SUB-02 | Quota exhaustion blocks image extraction but not existing order fulfillment. |
| SUB-03 | Inactive subscription blocks publishing new listings after grace period. |
| SUB-04 | Pilot/founding-store trial status can be represented without bypassing entitlements or usage tracking. |
| VER-01 | Seller documents are private and inaccessible through public URLs. |
| VER-02 | Store approval creates an auditable record. |
| VER-03 | Store application captures legal seller, tax/payout readiness, seller agreement, and prohibited-items acceptance. |
| VER-04 | Platform can flag seller risk without exposing private review notes to the store. |

---

## 16. Deferred Items

- multi-store ownership management
- staff/manager delegation
- automated KYC provider integration
- automatic GST validation
- full enterprise multi-branch hierarchy
- self-service payout account changes without platform review
- public store reliability score

---

## 17. Open Implementation Risks

| Risk | Planning Response |
|---|---|
| Small bookstores may lack formal documents | Allow manual platform verification path. |
| Subscription failure could block real customer orders | Never block fulfillment of already accepted/paid orders. |
| Seller docs contain sensitive data | Use private storage and platform-ops-only access. |
| Return policies can vary by store | Use platform-defined templates, not free-form hidden rules. |
| Commission and GST treatment need legal/accounting input | Keep financial fields explicit and review before implementation. |
| Payment aggregator and payout partner requirements may add mandatory seller onboarding fields | Keep onboarding schema extensible. |
| Seller risk review may overburden small stores | Support manual review and lightweight evidence for legitimate local bookstores. |
| Upfront subscription may reduce small-store adoption before liquidity exists | Use a founding-store trial/discount model during pilot and review conversion after value is proven. |

---

## 18. Related Documents

- [README](./README.md)
- [DOC-0: Product Architecture](./DOC-0-product-architecture.md)
- [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-8: Store Owner Console](./DOC-8-store-owner-console.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
