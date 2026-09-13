# DOC-8: Store Owner Console

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
**Status:** Planning draft
**Depends On:** DOC-1, DOC-2, DOC-3, DOC-4, DOC-6, DOC-7
**Owns:** Store Owner product surface, operating dashboard, inventory tools, order request management, fulfillment actions, store settings, subscription visibility, and MVP/deferred console modules.

---

## 1. Purpose

This document defines the bookstore owner console.

The Store Owner console is a separate product surface inside BookConnect. It must have its own access gate, onboarding state handling, and navigation. It is not an extension of the consumer marketplace UI.

The console exists so bookstores can:

- onboard and verify their store
- digitize inventory
- publish listings
- respond to customer order requests
- fulfill paid pickup/delivery orders
- manage store hours, policies, and delivery settings
- understand subscription, quota, and sales performance

---

## 2. Store Owner Surface Boundary

The console is available only to authenticated users with a verified relationship to a store.

Access states:

| State | Meaning | Behavior |
|---|---|---|
| `not_applied` | User has no store application. | Show seller onboarding entry. |
| `application_draft` | User started onboarding. | Resume onboarding. |
| `pending_review` | Store application submitted. | Show pending review status. |
| `approved_inactive` | Store approved but setup incomplete. | Show setup checklist. |
| `active` | Store can sell. | Show console dashboard. |
| `suspended` | Platform suspended store. | Show restricted status and support path. |
| `rejected` | Application rejected. | Show decision and support path. |

Consumer marketplace access remains separate and should not be blocked by store-owner application status.

### 2.1 Console Entry Points

The Store Owner console must be reachable through two app-level entry points:

| Entry Point | Behavior |
|---|---|
| Login / first-run auth screen | New or unauthenticated bookstore owners can choose Store Owner login/signup. After authentication, route through the Store Owner gate. |
| Profile section | Existing signed-in users can choose Store Owner Console / Apply as Bookstore. Route through the Store Owner gate without signing them out of the consumer account. |

If the gate resolves to `active`, enter the console dashboard. If the gate resolves to an onboarding state, show the correct onboarding/status/setup screen. If the gate resolves to suspension or rejection, show the appropriate restricted status screen. The entry point must not create access by itself.

---

## 3. Navigation Structure

Recommended MVP console sections:

```text
Store Owner Console
  -> Dashboard
  -> Inventory
     -> Image-to-LLM Add Books
     -> Manual Add Book
     -> Review and Recovery
     -> Session Summary
  -> Store View
     -> Committed Inventory List
     -> Book Management Detail
  -> Orders
     -> Requests Awaiting Confirmation
     -> Paid Orders
     -> Pickup/Delivery Fulfillment
  -> Subscription
     -> Plan
     -> Quota Usage
     -> Billing Status
  -> Store Profile (secondary settings)
     -> Public Profile
     -> Hours and Policies
```

Unit 7C freezes the primary tabs as Dashboard, Inventory, Store View, Orders,
and Subscription. Store Profile is secondary settings; the older Storefront
route may remain only as a compatibility redirect during cutover. Inventory
owns acquisition/review/session/recovery. Store View is the sole rich
post-commit management surface keyed by stable `inventoryId`.

Deferred sections:

- manager delegation
- community showcase
- advanced banner/carousel marketing
- full export center
- enterprise multi-branch management

---

## 4. Dashboard

The dashboard should answer: "What needs attention now?"

MVP dashboard cards:

| Card | Purpose |
|---|---|
| Pending order requests | Requests waiting for store confirmation. |
| Confirmation SLA | Requests nearing expiry during open hours. |
| Paid orders to pack | Orders that need pickup/delivery preparation. |
| Inventory health | Active listings, drafts, low-stock items. |
| Image extraction quota | Used/remaining monthly quota. |
| Subscription status | Active, trialing, past due, blocked, or upgrade needed. |
| Demand signals | Customer searches or alerts for unavailable books. |

The first screen should prioritize operational tasks over decorative analytics.

---

## 5. Inventory Module

Inventory is the console's acquisition, review, session, and recovery workspace.
After the Unit 7C cutover, rich committed-book management belongs to Store View.

MVP features:

- image-to-LLM add books
- manual add book
- legacy/deferred duplicate-resolution surfaces; no duplicate action affects the
  Unit 7A scanned-candidate commit
- post-commit list/edit/stock/publication/media operations in Store View
- 15-spine camera/gallery sessions with Start/Close summary; current runtime
  requires selected language, while the approved target uses optional hints and
  per-field detection
- initiating-Owner resume/mutation during the Owner-only pilot, with separately authorized/audited support intervention
- session defaults for condition, shelf/location, quantity, and private/publish
  preference; language is an optional target-design hint
- numbered spine review, add-missed/remove-false, attention-only field highlighting, and marketplace preview
- explicit Add to Inventory creates one new private inventory row per reviewed
  candidate; reviewed quantity initializes that row and never increments an
  existing row
- five public conditions with accessible explanations and separate damage disclosure/photo flow

The proposed Unit 6G refinement keeps this Inventory ownership while simplifying
the active scan: required batch location; English-default optional language
hint; optional condition/selling-price defaults; fixed quantity 1 and INR;
optional session-only batch label; and one scrollable page of compact cards.
Cards show every final value with Default/Detected/Custom/Missing cues; the
internal `matched` source code is displayed as Detected rather than a separate
Matched source badge,
use a bounded metadata sheet, and provide Remove plus one Add action. A top Add
all ready books action runs independent save-then-commit commands with partial
success. Store View remains the only rich post-commit management surface.

Required filters:

- search title/author/ISBN
- condition
- listing status
- quantity status
- date added
- source: image extraction or manual

Private fields:

- acquisition cost
- shelf/location
- internal notes
- raw extraction payload

Public fields:

- title
- author(s)
- condition
- price
- public condition notes
- cover/condition photos
- store availability

---

## 6. Order Request Management

Before payment, the store manages unpaid order requests.

For each request, the store must see:

- customer first name or display name
- requested items
- requested quantities
- condition and price snapshot
- fulfillment method
- confirmation deadline
- customer note if present
- store hours timer context

Allowed actions:

- confirm all
- confirm partial quantities
- mark item unavailable
- reject full request
- add store note to customer
- request platform support

The store cannot increase item price during confirmation.

If the customer requested current-copy photos, the store must upload 1-3 new validated private photos before confirming that item. If the store cannot provide them, the item is unfulfilled/unavailable; there is no “photos unavailable but continue” action. The customer must accept the photos/result before the request can become `payment_ready`.

---

## 7. Paid Order Fulfillment

After payment, the console switches from confirmation to fulfillment.

Paid order actions:

| Action | Applies To | Result |
|---|---|---|
| Mark packed | Pickup and delivery | Records package readiness progress. |
| Mark ready for pickup | Pickup | Notifies customer and exposes pickup code flow. |
| Verify pickup code | Pickup | Completes pickup handoff. |
| Mark ready for delivery | Delivery | Allows delivery booking. |
| Confirm courier handoff | Delivery | Records pickup by delivery partner. |
| Request support | Any | Opens platform ops queue. |

Stores should not directly change payment or refund state. Refunds and disputes go through platform operations.

---

## 8. Storefront and Marketing

MVP storefront management should stay practical.

Store owner can edit:

- public store name
- description
- address/map pin confirmation
- opening hours
- pickup instructions
- return policy
- delivery availability settings
- specialties/categories
- featured books

Deferred marketing features:

- hero customization
- promotional banners
- carousel campaigns
- community showcase
- quote management

These can come later after the marketplace loop proves demand.

---

## 9. Subscription and Quotas

Store owners must be able to see their own plan and limits.

This is different from platform-wide subscription administration, which remains excluded from the Store Owner console.

Console subscription view:

- current plan
- billing status
- renewal date or trial end
- active listing limit
- image extraction quota
- staff/user entitlement if future manager access is added
- commission rate summary
- upgrade/downgrade prompts
- feature locks with clear reason

Seller finance view:

- weekly settlement status
- gross sales
- commission
- delivery charges passed through or charged
- refunds/adjustments
- payout amount
- payout reference when available
- tax/GST/TCS fields if applicable after accounting review

If subscription is past due or restricted:

- existing paid orders remain fulfillable
- existing pending requests may be restricted by policy
- new listings or image extraction may be blocked
- customer-facing store visibility follows platform policy

---

## 10. Insights

MVP insights should help stores act, not overwhelm them.

Useful MVP metrics:

- total active listings
- books added this week/month
- order requests received
- request confirmation rate
- average confirmation time
- paid orders
- sales value
- top searched unavailable books
- zero-stock listings
- quota used
- confirmation SLA performance
- unavailable-after-upload rate
- seller cancellation rate
- refund/dispute count
- delivery exception count

Deferred analytics:

- cohort analytics
- customer profiling
- advanced exports
- predictive inventory recommendations
- customer lifetime value

Customer-level profiling is not part of this console.

---

## 11. Notifications

Store owners need timely notifications for:

- new order request
- request nearing confirmation expiry
- customer paid after confirmation
- order ready-to-pack
- delivery provider exception
- pickup reminder
- subscription issue
- image extraction quota warning

Notification event definitions live in DOC-10.

---

## 12. Compliance and Policy Explanations

The Store Owner console should explain operational constraints without exposing platform internals.

Store owners should be able to see:

- why a feature is locked by subscription, quota, verification, suspension, or policy
- current return policy and whether it is customer-visible
- confirmation SLA expectations
- pickup/delivery readiness requirements
- settlement statement status
- compliance status such as missing payout/tax/verification information

Store owners should not see:

- internal platform risk score
- other stores' performance
- payment provider internals
- customer grievance workflows except cases assigned to their order
- platform-wide tax/subscription configuration

---

## 13. Data Model

The console primarily operates on tables defined in other documents.

Additional console-specific tables may include:

```text
store_activity_logs
  id
  store_id
  actor_user_id
  action_type
  entity_type
  entity_id
  metadata private
  created_at

store_featured_listings
  id
  store_id
  listing_id
  display_order
  is_active
  created_at
  updated_at

store_setup_checklist
  id
  store_id
  profile_completed
  hours_completed
  return_policy_completed
  delivery_settings_completed
  first_inventory_added
  subscription_active
  payout_ready
  compliance_ready
  created_at
  updated_at

store_statement_summaries
  id
  store_id
  period_start
  period_end
  gross_sales_minor
  commission_minor
  delivery_adjustments_minor
  refunds_minor
  net_payout_minor
  status
  created_at
  updated_at
```

Activity logs should be append-only from the client perspective.

---

## 14. Security and Privacy

- Store ID must come from server-verified Store Owner context.
- Store owners can access only their own store data.
- Customer PII is visible only where operationally required.
- Customer address is visible only for orders requiring fulfillment.
- Payment details are not managed by the store console.
- Store documents from onboarding are not shown in daily console flows.
- Inventory private fields must not leak to public storefront or consumer search.
- Scan images and customer-request photos must not leak into public inventory media; only approved sanitized actual-copy/damage derivatives are public.
- Store owner actions on order requests and fulfillment must be audited.
- Store statement data is store-scoped and must not expose platform-wide revenue or other stores' settlement data.
- Trust metrics shown to stores should be operational and explanatory, not a public ranking unless product explicitly launches reliability scores.

---

## 15. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| CON-01 | Store owner can access console only after appropriate onboarding/access state. |
| CON-01A | New or unauthenticated users can enter the Store Owner path from Login / first-run auth. |
| CON-01B | Existing signed-in users can enter the Store Owner path from Profile without losing consumer app access. |
| CON-02 | Dashboard shows pending requests, paid fulfillment tasks, inventory health, subscription status, and quota usage. |
| CON-03 | Owner can add books through image workflow and manual entry. |
| CON-04 | Owner can publish, unpublish, and edit inventory/listing records. |
| CON-05 | Owner can confirm full or partial order request availability. |
| CON-06 | Owner can fulfill pickup and delivery orders after payment. |
| CON-07 | Owner can manage public store profile, hours, policies, and delivery settings. |
| CON-08 | Owner can view own subscription and quota status. |
| CON-09 | Console does not expose platform-wide subscription management or cross-store data. |
| CON-10 | Owner can view own settlement summaries and policy/compliance blockers. |
| CON-11 | Owner can see operational trust metrics needed to improve confirmation and fulfillment. |
| CON-12 | Owner can run a simple Start/Close camera/gallery session with one current image and at most 15 spines. Before candidate lineage exists, the Owner may explicitly remove that image and choose one replacement. The approved target auto-detects field language/script and treats language controls as optional hints. |
| CON-13 | Owner review supports defaults, add-missed/remove-false, five conditions, damage evidence, and independent explicit commits; each Unit 7A commit creates one new private inventory row, while legacy duplicate choices have no Unit 7A effect and must not be presented as actionable. |
| CON-14 | Owner can edit controlled inventory fields after commit without mutating shared canonical metadata. |
| CON-15 | Requested-photo items require 1-3 private current-copy photos or an unavailable/unfulfilled outcome. |
| CON-16 | Only the initiating Owner mutates/resumes a pilot scan session; support intervention is separately controlled and audited. |
| CON-17 | Owner can apply optional scan defaults once, review all candidates compactly on one bounded page, remove an unwanted candidate distinctly, and add one or all ready books without a separate Save button or automatic/atomic batch commit. |

---

## 16. Related Documents

- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-4: Image-to-LLM Inventory Workflow](./DOC-4-image-to-llm-inventory-workflow.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
