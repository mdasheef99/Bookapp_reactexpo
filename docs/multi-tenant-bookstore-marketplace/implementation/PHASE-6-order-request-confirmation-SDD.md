# Phase 6 Software Design Document: Order Request and Confirmation

**Product:** BookConnect multi-tenant bookstore marketplace
**Status:** `approved_for_local_implementation`
**Version:** 0.2
**Date:** 2026-07-16
**Implementation status:** Not started at documentation freeze; local implementation is authorized after the Stage 4 validation verdict.
**Approval record:** The founder correction directive dated 2026-07-16 approves this corrected monolith for local implementation only. Remote migrations, deployments, cron enablement, fixtures, and live smoke remain separately gated.

---

## 1. Authority, Status, Scope, and Non-Goals

### 1.1 Authority

Requirements are resolved in this order:

1. Approved BookConnect specifications.
2. Explicit founder decisions in the 2026-07-16 monolith-correction directive.
3. This corrected monolithic SDD.
4. The immutable v0.1 archive as a preservation baseline only.
5. Existing repository constraints and conventions.
6. Architecture derived to implement the above.
7. Industry guidance only where the first six are silent.

Controlling documents are the marketplace `README`, `DOC-13`, the Phase 6 tracker, `DOC-12`, `DOC-6`, `DOC-14`, and the domain-owned portions of DOC-0/1/2/3/5/7/8/9/10/15/16. The Phase 5 tracker controls the accepted discovery handoff; the Architecture Remediation Plan controls the previously accepted clarification/two-tier-hold reconciliation. This file is the only Phase 6 normative SDD; it must not be split. The immutable archive is `archive/PHASE-6-order-request-confirmation-SDD-v0.1-original-monolith.md`.

ONDC/Beckn is lifecycle inspiration only. No ONDC/Beckn entities, APIs, statuses, messages, or compliance requirements are imported.

### 1.2 Entry status

- Phase 5 is complete and accepted; Phase 6 implementation has not started.
- Existing anonymous Phase 5 public-projection database policies must remain compatible and regression-tested.
- The product still requires sign-in before marketplace access. Phase 6 does not expose anonymous Expo marketplace routing.
- Cart mutation, request submission/history, Store Owner actions, acceptance, cancellation, and support requests are authenticated.
- No live Supabase operation is authorized by this document.

### 1.3 In scope

- One active server-backed, single-store cart per authenticated customer and explicit cross-store replacement.
- Unpaid request submission and immutable book, seller, policy, price, currency, fulfilment, address, and contact snapshots.
- Full/partial confirmation, item unavailability, full-request rejection, clarification, owner support request, customer acceptance/cancellation, and history.
- Provider-independent `payment_ready`.
- Bucket-transfer inventory holds, concurrency, SLA/closure handling, expiry, jobs, reconciliation, events, audit, notifications, flags, and tenant security.
- Required customer and Store Owner routes/screens.

### 1.4 Non-goals

- Provider object/payment attempt, `payment_pending`, paid order, ledger, tax, commission, settlement, webhook, refund, pickup fulfilment, or delivery booking.
- Anonymous carts or anonymous request migration.
- Manager/staff delegation, ordinary partial-result revision, or a higher-price platform-correction path.
- Realtime as a correctness dependency.
- General notification rearchitecture beyond commerce requirements.

---

## 2. Phase Boundary and Merge-Blocking Invariants

### 2.1 `payment_ready` contract

Entry to `payment_ready` atomically establishes final quantities and integer-paise total, immutable `INR`, seller/customer-private/policy snapshots, active firm holds, `payment_expires_at`, expiry task, version increment, transition row, one canonical transition event, audit where required, and PII-safe customer/owner notifications.

Phase 6 creates no provider object, payment attempt, paid `store_order`, ledger, invoice, commission, settlement, or provider payload.

Phase 7 locks a still-valid `payment_ready` request, revalidates ownership/version/amount/currency/firm holds/payment flags/store payment eligibility, creates the provider object, and enters `payment_pending`. Suspension does not silently destroy a valid payment-ready hold; Phase 7 blocks provider creation while ineligible and the hold expires normally unless an authorized audited cancellation occurs.

### 2.2 Invariants

| ID | Merge-blocking invariant |
|---|---|
| INV-01 | No cart/request spans stores; one active cart per authenticated customer. |
| INV-02 | Customer ownership comes only from `auth.uid()`; authoritative user/store IDs are not accepted from clients. |
| INV-03 | Store commands derive the store from the request and require an active owner capability plus MVP entitlement. Manager/staff remain valid deferred roles. |
| INV-04 | Store A cannot read/mutate Store B; customers read only their own carts/requests. |
| INV-05 | Clients cannot directly write commerce status/version, item outcome, holds, counters, transitions, events, tasks, or audit. |
| INV-06 | Submitted commercial/private snapshots are immutable through normal commerce commands. |
| INV-07 | Confirmed unit price is never above the server bound, even with customer acceptance. |
| INV-08 | Unavailable/rejected quantities are not payable. Rejection and unavailability are distinct. |
| INV-09 | `quantity_available` is free stock; `quantity_reserved` equals active hold quantity; neither is subtracted twice. |
| INV-10 | Hold/bucket changes are atomic under locked inventory rows and releases are idempotent. |
| INV-11 | Idempotent replay cannot duplicate requests, holds, transitions, events, notifications, tasks, or releases. |
| INV-12 | Every state transition has one transition row and one canonical request-transition event. |
| INV-13 | `request_platform_support` creates event/audit/task but no status transition or commercial mutation. |
| INV-14 | Raw events, private snapshots, support notes, addresses, and phones never appear in generic client event/notification/log payloads. |
| INV-15 | Deep links grant no authority; target screens refetch and authorize. |
| INV-16 | Money is integer paise and currency is immutable `INR`. |
| INV-17 | Server clocks/jobs are authoritative; client countdowns are display-only. |
| INV-18 | Flags, locality, allowlist, store eligibility, moderation, and entitlements are server-enforced on every progression command. |
| INV-19 | History, cancellation, rejection cleanup, expiry, hold release, support cleanup, and reconciliation cannot be disabled by rollout flags. |
| INV-20 | Existing Phase 5 anonymous public-policy compatibility is preserved without changing sign-in-first app routing. |
| INV-21 | Request creation is direct into `submitted` and has creation evidence plus `order_request.submitted`; the cart separately transitions `active -> submitted` with its own transition evidence, command identity, and `marketplace_cart.submitted` event. |
| INV-22 | Submission commits no request, cart transition, evidence, event, notification, task, or hold unless at least one active entitled Owner exists. Later recipient loss is an operational condition and does not erase valid commerce. |
| INV-23 | Phase 6 computes and snapshots the deterministic BookConnect delivery tariff; `payment_ready` freezes the tariff-inclusive total and no provider call or later provider cost may silently increase it. |

---

## 3. Actors, Identity, Roles, and Entitlements

| Actor | Identity | Capability |
|---|---|---|
| Customer | `auth.uid()` | Own cart/request commands, clarification, acceptance, cancellation, history/detail. |
| Store Owner | `auth.uid()` + active owner relationship + capability entitlement | Own-store request read/review/clarify/confirm/unavailable/reject/support request. |
| Manager/Staff | Existing active relationship | No Phase 6 request capability in MVP; delegation remains deferred. |
| Support Agent | Active `support_agent` | Minimum case context and separately authorized support commands. |
| Platform Admin | Active `platform_admin` | Controlled support/policy/eligibility intervention. |
| System Job | Service-only executor | Reminder, expiry, closure, release, retry, dead letter, reconciliation. |

The server capability resolver accepts an actor, derived store, and capability. For `phase6_order_commands`, MVP requires `store_administrators.status='active'`, role `owner`, and `store_entitlements.feature_key='commerce_order_request_owner_commands_enabled'` enabled. Notification fan-out uses `phase6_order_notifications`, initially the same owner-only mapping, and deduplicates user IDs. Future manager/staff enablement changes capability mappings rather than rewriting role data.

All transactional user RPCs execute with caller JWT context so `auth.uid()` is available. Background functions are separate service-only commands and cannot impersonate customers/owners. Phase 6 tables/functions receive no `anon` grants; existing Phase 5 public policies remain untouched.

---

## 4. Canonical Vocabulary and State Model

### 4.1 Entity states

```text
submitted
store_reviewing
awaiting_clarification
awaiting_customer_decision
paused_for_emergency_closure
payment_ready

unavailable
store_rejected
customer_cancelled
platform_cancelled
expired
payment_ready_expired
```

Cart states: `active`, `submitted`, `replaced`, `abandoned`.

Request states are the tokens listed above. `unavailable` is a stock/item inability. `store_rejected` is a full request decline for a bounded non-stock reason. `confirmed`, `partially_confirmed`, `adjusted`, and `clarification_provided` are transition outcomes/events, not request states. No `draft_cart`, `created`, or pre-submission order-request state exists.

Item states: `requested`, `needs_clarification`, `confirmed_full`, `confirmed_partial`, `unavailable`, `rejected`.

Hold types: `soft`, `firm`. Hold statuses: `active`, `released`, `converted_to_sale`; Phase 6 never converts to sale. Promotion changes type on the existing active quantity and does not move inventory buckets.

### 4.2 Commands

Customer: `create_cart`, `replace_cart_store`, `set_cart_item_quantity`, `remove_cart_item`, `submit_order_request`, `provide_clarification`, `accept_confirmed_changes`, `cancel_order_request`.

Owner: `start_store_review`, `request_clarification`, `confirm_full`, `confirm_partial`, `mark_items_unavailable`, `reject_order_request`, `request_platform_support`.

System: `send_confirmation_reminder`, `expire_confirmation`, `expire_clarification`, `expire_customer_decision`, `expire_payment_ready`, `pause_for_emergency_closure`, `resume_after_emergency_closure`, `expire_emergency_closure_pause`, `cancel_for_store_ineligibility`, `cancel_for_rollout_shutdown`.

Support: `support_cancel_request`, `support_extend_confirmation_deadline`, `support_extend_customer_decision_deadline`, `support_resume_emergency_pause`.

No ordinary `revise_partial_confirmation` command exists.

### 4.3 Events

```text
order_request.submitted
order_request.review_started
order_request.clarification_requested
order_request.clarification_provided
order_request.confirmed
order_request.partially_confirmed
order_request.unavailable
order_request.rejected
order_request.changes_accepted
order_request.cancelled
order_request.expired
order_request.payment_ready_expired
order_request.emergency_closure_paused
order_request.emergency_closure_resumed
order_request.store_ineligible
order_request.support_requested
order_request.support_intervened
order_request.confirmation_due_soon
marketplace_cart.submitted
marketplace_cart.replaced
marketplace_cart.abandoned
```

`support_requested` is an internal operational event, not a state-transition event.

### 4.4 Canonical notification, task, reason, error, and policy catalogues

Notification names are exactly the `commerce.order_request.*` names in Appendix D plus `commerce.marketplace_cart.replaced.customer`; aliases are forbidden. Task categories are `confirmation_reminder`, `confirmation_expiry`, `clarification_expiry`, `customer_decision_expiry`, `payment_ready_expiry`, `emergency_pause_expiry`, `store_ineligibility_review`, `notification_delivery`, `hold_reconciliation`, `commerce_consistency_reconciliation`, and `platform_support_request`.

Reason-code sets are authoritative in Appendix E. Stable error codes are the Appendix E catalogue plus `ENTITLED_OWNER_UNAVAILABLE` and `DELIVERY_TARIFF_UNAVAILABLE`. Policy keys are authoritative in §10.2. Repository terminology uses `grace_period`, never `grace` as a stored status token.

---

## 5. Authorization, Eligibility, and Rollout

Guard definitions:

- `AUTH-C`: `auth.uid()` owns the cart/request.
- `AUTH-O`: actor has active owner relationship and Phase 6 owner capability for the derived store.
- `STORE`: active, verification approved, setup complete, selling allowed, not suspended/prohibited.
- `SUB`: latest subscription is `trialing`, `active`, `past_due`, or `grace_period`; `restricted`/`cancelled` block new/progression commands.
- `ROLLOUT`: marketplace/cart-request flags, pilot locality, and store allowlist/entitlement enabled.
- `LIST-NEW`: active, price-valid, unmoderated listing with sellable inventory.
- `LIST-ACTIVE`: valid at submission; owner pause allowed, but moderation/prohibition/removal blocks.
- `INV`: locked inventory belongs to derived store/listing and has sufficient free bucket.
- `HOLD`: required hold is active/unexpired/quantity-consistent.
- `VERSION`: expected client version equals locked version.
- `OWNER-AVAILABLE`: at least one active `store_administrators.role='owner'` user resolves the Phase 6 command capability and Owner notification entitlement for the derived store.

Eligibility outcomes are `allow`, `block_no_effects`, `pause`, `named_cancel`, `escalation_support`, `cleanup_only`, and `history_only`. A dash means the guard is not evaluated for that operation; it never means a client can supply the value.

| Operation | Store/verification/setup/selling | Subscription/entitlement/Owner available | Flag/locality/allowlist | Listing/moderation/inventory | Outcome on failure |
|---|---|---|---|---|---|
| Cart create/mutate | active/approved/complete/allowed | allowed subscription; cart entitlement | required | active, unblocked, sellable; valid inventory | `block_no_effects` |
| Cross-store replacement | same as cart; both old/new locked | same as cart | required for new store | new listing/inventory revalidated | `block_no_effects`; old cart preserved |
| Submission | active/approved/complete/allowed | command entitlement and `OWNER-AVAILABLE` mandatory | required | every original listing active or owner-paused, unmoderated, valid inventory; no holds | `block_no_effects`; missing Owner returns `ENTITLED_OWNER_UNAVAILABLE` and creates no phantom request/ops alert |
| Begin review | active/approved/complete/allowed | Owner capability; `OWNER-AVAILABLE` | required | original listing active or owner-paused; moderation clear | `block_no_effects` |
| Clarification request/response | active/approved/complete/allowed | Owner capability for request; customer ownership for response | progression flags required; response cleanup remains allowed if shutdown policy says so | original listing identity; moderation clear | owner request `block_no_effects`; customer response `allow` or named ineligibility handling |
| Full confirmation | active/approved/complete/allowed | Owner capability; `OWNER-AVAILABLE` | required | original listing/edition/condition only; moderation clear; locked inventory sufficient | `block_no_effects` |
| Partial confirmation | same as full | same as full | required | same as full; tariff recalculation valid | `block_no_effects` |
| Customer acceptance / `payment_ready` | active/approved/complete/allowed | customer ownership; store command entitlement remains valid | required | original listing/moderation valid; soft holds active; tariff valid | `block_no_effects`; no promotion |
| Unavailable | active owner command; compliance loss may use system path | Owner capability | command flag required for owner action | bounded stock/item reason on original listing | owner action `allow`; otherwise `escalation_support` |
| Store rejection | active owner command | Owner capability | command flag required | bounded non-stock reason; inventory not used as rejection reason | `block_no_effects` |
| Customer cancellation | historical store eligibility ignored | customer ownership | flags/locality/allowlist ignored | release any active holds | `cleanup_only` and `allow` |
| Platform cancellation | derived request store | authorized named system/support capability | ordinary disable alone does not cancel | lock request/holds; bounded reason | `named_cancel` only |
| Expiry/cleanup/reconciliation | current store eligibility ignored | service-only | flags ignored | due/state/version and locked rows | `cleanup_only`; stale work is no-op |
| Owner support request | request may be any nonterminal state | Owner capability; independent support-task version | not blocked by ordinary progression flag once request exists | no commercial validation/mutation | `escalation_support`; no request-version change |
| Support intervention | derived store; explicit case | support/admin capability by command | flags do not block cleanup | command-specific state/hold guard | `allow` or `block_no_effects`; always audited |
| History/read | historical ownership/capability | customer ownership or Owner read capability | flags ignored | safe projection only | `history_only` |
| Mid-request owner pause | preserve request path | existing capability | existing request remains visible | owner-paused listing may continue against snapshot | `allow` with live guards |
| Mid-request moderation/prohibition | fail closed | service/support | flags irrelevant | prohibited/removed listing | `named_cancel` for non-payment-ready; payment-ready blocks Phase 7 and expires normally unless audited cancel |
| Emergency closure | store remains otherwise eligible | service/platform | flags irrelevant | state-specific hold validity | `pause` only for §10.4 states |

Server progression evaluates canonical flags `marketplace_enabled`, `cart_order_request_enabled`, `pickup_enabled`, `delivery_enabled`, locality `marketplace_localities.is_pilot_enabled`, store entitlement `commerce_order_requests_enabled`, Owner capability `commerce_order_request_owner_commands_enabled`, and Owner notification entitlement `commerce_order_request_owner_notifications_enabled`. Flags are not authorization and cannot disable history, cancellation, expiry, release, reconciliation, or support cleanup. Ordinary flag disablement blocks new/progression commands but never silently cancels existing requests; `cancel_for_rollout_shutdown` is the separately authorized, audited emergency shutdown command.

---

## 6. Data Model, Constraints, Indexes, and Snapshots

New tables:

- `marketplace_carts`, `marketplace_cart_items`;
- `store_order_requests`, `store_order_request_items`;
- `store_order_request_private_snapshots`, `store_order_request_private_snapshot_tombstones`, `store_order_request_seller_snapshots`, `store_order_request_policy_snapshots`;
- `inventory_holds`, `commerce_entity_creation_log`, `commerce_transition_log`, `order_request_policy_acceptances`, `store_schedule_exceptions`.

Extended tables:

- `marketplace_events`: schema version, command/correlation/causation, privacy class;
- `marketplace_notifications`: event/recipient/deep-link/read/dedupe fields;
- `notification_deliveries`: commerce source plus claim/retry/dead-letter fields;
- `event_action_tasks`: entity/type/due/claim/retry/dead-letter/dedupe fields;
- `marketplace_policy_config`: typed version and non-overlap enforcement;
- `store_inventory`: controlled adjustments/reconciliation; direct owner bucket writes revoked before holds.

Key constraints:

- partial unique active cart per user; unique `(cart_id, listing_id)`;
- positive quantities; `0 <= confirmed <= requested`;
- all money non-negative integer paise and `currency_code='INR'`;
- confirmed price `<= server_bound_unit_price_minor`;
- `payment_ready` requires final total, firm holds, and payment expiry;
- awaiting decision requires active soft holds and acceptance expiry;
- rejected/unavailable items have zero payable quantity and bounded reasons;
- terminal pre-payment states have no active holds;
- creation/transition evidence unique by entity/command; event unique by evidence command;
- notification unique `(event_id,user_id,notification_type)`;
- delivery unique `(marketplace_notification_id,recipient_user_id,channel)`;
- one open/in-progress task per entity/task type.

Cross-table invariants are never described as ordinary row CHECKs. Enforcement is normative as follows:

| Invariant | Primary enforcement | Defense/recovery |
|---|---|---|
| One active cart/customer | partial unique index on `marketplace_carts(user_id) WHERE status='active'` | transaction-command lock/create scope; retry conflict |
| One store per cart | duplicated `store_id` plus deferred constraint trigger across cart/items | transaction guard; reconciliation |
| Request/cart identity | FK plus deferred constraint trigger verifying same user/store and submitted cart | submission command; reconciliation |
| Request creation directly in `submitted` | transaction command plus `commerce_entity_creation_log` unique entity/command | runtime schema; event/evidence reconciliation |
| Separate cart transition | transition unique `(entity_type,entity_id,command_id)` and event unique command/type | submission command |
| Request/store/item identity | FKs plus deferred constraint trigger | sorted-lock transaction guard |
| Immutable snapshots/policy acceptance | revoke writes plus immutability trigger | audited privacy deletion is a separate service command |
| Strict confirmed price bound | same-row CHECK `confirmed_unit_price_minor <= server_bound_unit_price_minor` | command/runtime validation |
| `payment_ready` prerequisites | deferred constraint trigger over request/items/firm holds/tariff snapshots | command guard; reconciliation |
| Awaiting-decision soft holds | deferred constraint trigger | command guard; reconciliation |
| Active holds equal reserved quantity | locked transaction command | reconciliation; never blind repair |
| Terminal request has no active holds | deferred constraint trigger | release command; reconciliation |
| Idempotent hold release | partial unique/indexed active hold plus conditional update `WHERE status='active'` | command-id evidence |
| Owner capability and recipient eligibility | SQL helper + transaction-command guard | Edge/runtime validation and security tests |
| Safe projection privacy | revoked base-table SELECT plus named views/RPCs and column allowlists | RLS row checks; response Zod validation |

`commerce_entity_creation_log` records entity type/ID, initial state/version, actor, command/idempotency/correlation/event IDs, and time; request creation uses it because there is no false previous request state. `commerce_transition_log` is for real state changes and therefore has non-null previous/next states. One submission HTTP command owns two independent idempotency sub-scopes derived from its command ID: `order_request:create:<cart_id>` and `marketplace_cart:submit:<cart_id>`. Replay returns the stored combined response; constraints prevent either evidence/event pair from duplicating.

Submission snapshots book/listing/inventory/canonical IDs, title/authors/ISBN/edition/format/condition/notes/image, quantity, price bound, INR, fulfilment eligibility, seller identity/disclosures/agreement versions, resolved policy and tariff ID/version/scope/value/time, customer order-scoped identity, contact/address when supplied, and fulfilment choice.

`order_request_policy_acceptances` is immutable evidence containing request ID, customer actor ID, accepted policy identifier/version, accepted timestamp, interface/source, command ID, correlation ID, and the relevant tariff/policy snapshot reference. Contact/address remain in the separately restricted private snapshot and are never copied into acceptance evidence.

Snapshot content has no normal UPDATE/DELETE grant. A future authorized privacy job may delete the complete private snapshot after approved retention and leave a non-PII tombstone; commercial history is not partially rewritten.

The existing inventory service that sets total and available to one input is incompatible with active holds. Implementation must replace it with a locked stock-adjustment command preserving reserved/sold/removed buckets and revoke direct owner counter writes.

Appendix B defines column groups, indexes, and access.

---

## 7. Command Boundary, Contracts, Idempotency, and Versioning

Use small audience-specific boundaries:

- `marketplace-cart`;
- `marketplace-order-request`;
- `store-order-request`;
- `commerce-support`.

Each state-changing HTTP action calls exactly one PostgreSQL transaction command. The command resolves `auth.uid()`, derives ownership/store, locks idempotency/entity/inventory in the prescribed order, validates capability/state/version/flags/policy/input, applies state/hold/transition/event/notification/task/audit effects, stores safe response, and commits once. Edge/runtime validation is repeated by the database security boundary.

Request:

```text
Authorization: Bearer <JWT>
Idempotency-Key: <UUID>
{
  "command": "canonical_name",
  "entityId": "uuid or null",
  "expectedVersion": 3,
  "payload": { ... }
}
```

Reject caller-supplied authoritative user/store/status/total/bound/hold/event/recipient fields.

Response:

```text
{
  "data": { safe canonical projection },
  "commandId": "uuid",
  "version": 4,
  "idempotencyReplay": false
}
```

Idempotency scope is actor + command + logical entity/create scope. The normalized payload and expected version are hashed. Same key/hash returns stored response; same key/different hash returns `409 IDEMPOTENCY_KEY_REUSED`; in-progress returns `409 COMMAND_IN_PROGRESS`. Default retention is seven days, policy range one to thirty days.

Mutable carts/requests/holds use integer `version >= 1`. Commands require expected version except safe creates and due tasks. Mismatch returns `409 STALE_VERSION` with no effects. Due tasks capture target version, lock current row, and resolve as no-op if state/version has advanced. `request_platform_support` validates the current commerce version but does not increment it; the deduplicated support task has its own `support_version` for later support updates.

---

## 8. Cart, Submission, Price, Money, and Fulfilment

### 8.1 Cart and replacement

Cart states are `active`, `submitted`, `replaced`, `abandoned`; cart creation reserves nothing. Abandonment default is seven days, range one to thirty. Add/update re-reads public listing data and writes display snapshots.

Cart abandonment is lazy, not one scheduled task per cart. A create/get command locks the customer create scope and current active cart; if `expires_at <= transaction_timestamp()`, it idempotently transitions that cart to `abandoned` with evidence/event, then creates or reuses the active cart. Simultaneous create requests serialize on the same idempotency/advisory create scope; the partial unique active-cart index is the final enforcement layer.

Cross-store add is two-step: server returns `CROSS_STORE_REPLACEMENT_REQUIRED` plus a short-lived opaque token bound to customer, old cart/version, new listing, and expiry; confirmed replacement revalidates everything, marks old cart replaced, creates new active cart, and adds the item atomically. Failure preserves the old cart.

### 8.2 Submission transaction

1. Resolve customer and lock active cart/idempotency.
2. Verify expected version and single store.
3. Lock/re-read listing/inventory rows in sorted UUID order.
4. Resolve store/subscription/entitlement/locality/allowlist/moderation/fulfilment eligibility.
5. Resolve at least one active entitled Owner; otherwise return `ENTITLED_OWNER_UNAVAILABLE` before any request/cart/evidence/event/notification/task/hold effect.
6. Establish immutable price bounds and validate quantities without holds.
7. Resolve/snapshot policies, deterministic BookConnect tariff, schedule/timezone, seller, fulfilment, policy acceptance, and private contact/address.
8. Calculate server-authoritative item subtotal, tariff charge, discounts/fees, and requested total.
9. Insert the request directly in `submitted`, its items/snapshots, request-creation evidence, `order_request.submitted`, SLA tasks, and canonical notifications.
10. Separately transition cart `active -> submitted`, insert cart transition evidence, and emit `marketplace_cart.submitted`, using distinct derived idempotency identities.
11. Commit once. Notification transport rows may later fail without rolling back commerce; missing Owner eligibility at step 5 is not a transport failure.

### 8.3 Price and INR

```text
if current listing price < cart snapshot:
    bound = current listing price
else:
    bound = cart snapshot
```

Tolerance classifies store absorption/attention but never raises the customer bound. Owner may honour, lower, mark unavailable, reject for a valid non-stock reason, or request support. Customer acceptance cannot authorize a price above bound. No higher-price correction command exists in Phase 6.

- If upward drift is within tolerance, submission continues normally at the lower immutable customer bound.
- If upward drift exceeds tolerance, submission may still create the unpaid request at that same bound, but the item is flagged `price_drift_review_required=true` for Store Owner attention. The owner may honour/lower, mark unavailable, or request support. The flag never creates a higher payable offer and customer clarification cannot raise the bound.
- A current lower price replaces the cart display snapshot as the bound and requires no material-change acceptance.

All amounts are integer paise, currency is immutable `INR`, line total is checked quantity × confirmed unit price, unavailable/rejected lines contribute zero, and one versioned server calculator owns item subtotal, discounts, fees, customer delivery tariff, and total. Mobile calculations are display-only. Phase 6 calls no delivery provider. Submission snapshots the provisional exact BookConnect tariff; partial/material confirmation recalculates it. Entry to `payment_ready` freezes exact confirmed quantities, tariff version/snapshot, customer delivery charge, and tariff-inclusive total for Phase 7 collection. Phase 10 may obtain provider operational cost, which cannot silently change the customer total.

### 8.4 Confirmation outcomes

- Full materially unchanged: `store_reviewing -> payment_ready`, firm holds, no second customer acceptance.
- Partial/material change: `store_reviewing -> awaiting_customer_decision`, soft holds, explicit acceptance.
- Material change includes reduction, unavailability, fulfilment change, delivery-minimum failure, or a customer tariff/fee increase within the server-approved policy result.
- Below delivery minimum: customer chooses pickup or cancellation; no revised/provider fee.
- No ordinary owner revision after a partial result is published.
- Substitutions and replacement listings are unsupported. Store commands act only on the snapshotted listing, edition, and condition. Cross-store **cart** replacement in §8.1 is distinct and remains supported.

### 8.5 Unavailability, rejection, and support

`mark_items_unavailable` uses bounded stock/item reasons. If none remains confirmable, request enters `unavailable`, emits `order_request.unavailable`, releases holds, cancels tasks, audits, and notifies.

`reject_order_request` is allowed from submitted/reviewing/clarification only. It uses bounded non-stock reasons, enters `store_rejected`, sets unresolved items `rejected`, emits `order_request.rejected`, releases eligible holds, cancels tasks, audits, and notifies customer/owners. After partial publication, owner must request support instead of revising/rejecting directly.

`request_platform_support` is allowed on any nonterminal request, including payment-ready. It creates/deduplicates an operational task, emits internal `support_requested`, audits the owner action, and optionally acknowledges owners. It changes no commerce status, price, quantity, hold, or deadline; only a later separately authorized support command may transition.

---

## 9. Inventory Accounting, Holds, Locking, and Concurrency

### 9.1 Bucket-transfer invariant

Repository evidence selects:

```text
quantity_total
  = quantity_available
  + quantity_reserved
  + quantity_sold
  + quantity_removed

sellable_available = quantity_available
quantity_reserved = SUM(active soft and firm hold quantity)
```

`quantity_available` is already unreserved free stock. No Phase 6 query may subtract `quantity_reserved` or active holds from it again. The existing `quantity_total >= bucket_sum` constraint is strengthened to equality only after a live-data audit; gaps are reported, never silently allocated.

### 9.2 Lock order

All commands lock in this order:

1. idempotency row/create scope;
2. request;
3. request items sorted by UUID;
4. inventory rows sorted by UUID;
5. holds sorted by UUID;
6. affected scheduled tasks.

No command locks inventory before request. Deadlock/serialization failure is retryable with the same idempotency key.

### 9.3 Hold operations

Create, under inventory lock:

```text
require quantity_available >= confirmed_quantity
quantity_available -= confirmed_quantity
quantity_reserved  += confirmed_quantity
insert one active hold for confirmed_quantity
```

- Full unchanged confirmation creates firm holds.
- Partial/material confirmation creates soft holds.
- Any insufficient line aborts the whole confirmation.

Promote: verify active/unexpired soft holds, change type to firm and expiry to `payment_expires_at`, record evidence, and do not move buckets.

Release, under lock and only where `status='active'`:

```text
hold.status = released
quantity_reserved  -= hold.quantity
quantity_available += hold.quantity
```

A replay that finds no active hold is a successful no-op. Phase 7 alone converts reserved to sold and marks `converted_to_sale`.

### 9.4 Inventory adjustment

Owner stock edits cannot overwrite bucket totals once holds exist. A controlled adjustment locks the row, rejects a total below reserved+sold+removed, expresses shrinkage through removed/reasoned adjustment, preserves holds, updates projection from resulting available, and audits.

### 9.5 Required races

- Two customers/one quantity-one book: one confirmation succeeds.
- Two owners/same request: one version wins.
- Acceptance versus decision expiry: one locked transition wins.
- Closure/suspension versus confirmation: one locked transition wins with live revalidation.
- Two workers/same task or delivery: one `SKIP LOCKED` claim wins.
- Future Phase 7 claim versus payment-ready expiry: request/holds are locked before provider creation.

---

## 10. Policy, SLA, Hours, and Closure Handling

### 10.1 Policy resolution

Precedence is `store -> locality -> city -> global`. Candidate values are type/range validated. Most-specific active effective value wins; absence falls back. Overlap at the same normalized key/scope fails closed and creates an ops task. Required key without valid global fallback blocks progression. Snapshots record key, typed value, policy ID/version, source scope, and resolution time. Live flags/eligibility are never snapshotted as authorization.

Effective-range overlap must be prevented for the same `(policy_key, scope_type, normalized scope identity)`.

### 10.2 Policy catalogue

Precedence for scoped policies is `store -> locality -> city -> global`. Required keys must have a valid global fallback; missing/malformed required policy blocks progression with `POLICY_CONFIGURATION_INVALID` and creates an ops task. Optional rollout controls default closed. Time windows and tariff inputs are snapshotted at the timing shown; authorization/rollout controls are evaluated live and never converted into permanent authorization snapshots.

| Canonical key | Type/unit | Default; allowed range | Req. | Scopes | Missing/malformed behavior | Snapshot/live timing |
|---|---|---|---|---|---|---|
| `commerce.cart_abandonment_seconds` | integer seconds | 604800; 86400-2592000 | required | global/city/locality/store | fail closed for cart create | snapshot cart create |
| `commerce.confirmation_reminder_open_seconds` | integer open seconds | 21600; 3600-43200 | required | global/city/locality/store | block submission | snapshot submission |
| `commerce.confirmation_expiry_business_days` | integer business days | 1; 1-2 | required | global/city/locality/store | block submission | snapshot submission |
| `commerce.clarification_timeout_seconds` | integer wall seconds | 21600; 900-86400 | required | global/city/locality/store | block clarification command | snapshot clarification request |
| `commerce.acceptance_window_seconds` | integer seconds | 1800; 900-3600 | required | global/city/locality/store | block partial publication | snapshot partial result |
| `commerce.payment_ready_window_seconds` | integer seconds | 3600; 1800-7200 | required | global/city/locality/store | block `payment_ready` | snapshot entry to `payment_ready` |
| `commerce.price_drift_tolerance_minor` | integer paise | 500; 0-5000 | required | global/city/locality/store | block submission | snapshot submission |
| `commerce.emergency_closure_pause_seconds` | integer seconds | 7200; 900-21600 | required | global/city/locality/store | do not pause; escalate | snapshot pause |
| `commerce.max_emergency_closure_pauses` | integer count | 1; 0-2 | required | global/city/locality/store | do not pause; escalate | snapshot submission and revalidate cap live |
| `commerce.command_idempotency_retention_seconds` | integer seconds | 604800; 86400-2592000 | required | global | server default only if valid global row | snapshot command record |
| `commerce.delivery_minimum_subtotal_minor` | integer paise | 0; 0-1000000 | required for delivery | global/city/locality/store | delivery unavailable; pickup remains | snapshot submission and final result |
| `commerce.delivery_fixed_tariff_minor` | integer paise | 0; 0-100000 | required for delivery | global/city/locality/store | delivery unavailable | snapshot submission and final result |
| `commerce.delivery_free_threshold_minor` | integer paise | 0; 0-1000000 | optional | global/city/locality/store | no free-delivery rule | snapshot submission and final result |
| `marketplace_enabled` | boolean | false | required rollout | global | closed | live every new/progression command |
| `cart_order_request_enabled` | boolean | false | required rollout | global/city/locality/store | closed | live every cart/request progression command |
| `pickup_enabled` | boolean | false | required when selected | global/city/locality/store | closed | live progression; eligibility snapshotted |
| `delivery_enabled` | boolean | false | required when selected | global/city/locality/store | closed | live progression; tariff snapshotted |
| `commerce.store_allowlisted` | boolean | false | required rollout | store | closed | live every new/progression command |

Return/cancellation policy, fulfilment eligibility, discounts, fees, and calculator version are also snapshotted. Locality rollout is additionally enforced by live `marketplace_localities.is_pilot_enabled`; store command/notification entitlements remain live rows, not policy snapshots. Values are server-read and not hardcoded in mobile.

### 10.3 Schedule model and algorithm

Every request snapshots IANA timezone (existing Bangalore stores default `Asia/Kolkata`), versioned weekly intervals, known holiday/planned-closure/special-hours exceptions, and SLA policies. `store_schedule_exceptions` supports `holiday`, `planned_closure`, `special_hours`, and `emergency_closure` with bounded times, reason, actor, state, and audit.

Normalize by parsing local weekly intervals, splitting overnight at midnight, applying date exceptions to each local-date segment, converting to UTC, and rejecting overlap/invalid timezone/zero or negative intervals. Missing/malformed schedule fails closed and creates an ops task; never assume 24/7.

At submission:

1. Iterate normalized open intervals after `submitted_at`.
2. Accumulate six open hours; store that instant as `confirmation_reminder_at`.
3. Set `confirmation_due_at` to the closing boundary of the operating interval/business date in which the sixth hour occurs.
4. Clarification stores remaining open seconds, pauses accumulation, and starts its wall-clock deadline.
5. Customer response resumes remaining seconds at the next open instant.
6. Store all instants in UTC with schedule/policy snapshot IDs.

### 10.4 Planned, emergency, and compliance closure

Planned closure known at submission blocks new requests during closure and is removed from SLA intervals. A planned closure added after submission is handled/audited as an emergency closure; it does not silently rewrite snapshots.

Emergency temporary closure is not compliance suspension and does not release every hold:

| State | Emergency action |
|---|---|
| submitted/reviewing/clarification | Enter `paused_for_emergency_closure`; preserve source state/remaining timers; create ops task. |
| awaiting decision with soft holds | Bounded pause if policy permits; soft holds survive only through closure-pause deadline. |
| payment ready with firm holds | No automatic pause/release; original payment expiry governs unless audited cancellation. Phase 7 rechecks eligibility. |

Pause records source state, exception ID, pause expiry, remaining timers, and pause count. Resume restores state/timers and revalidates holds/eligibility. At cap expiry, no-hold review state becomes policy-selected `expired`/`platform_cancelled`; soft-hold state becomes `platform_cancelled` and releases holds. Extra pauses require support authorization.

Loss of verification/selling eligibility/locality permission/moderation/compliance fails closed: submitted/reviewing/clarification/decision/paused states become `platform_cancelled`, soft holds release, and event/audit/notifications/ops task commit. Valid payment-ready firm holds are not silently released; Phase 7 payment creation remains blocked while invalid and natural expiry or audited cancellation releases them.

### 10.5 Worked examples

All use `Asia/Kolkata`, six accumulated open hours, expiry at the closing boundary containing hour six.

**Short days — 2026-07-20/21**

```text
Timezone Asia/Kolkata. Recurring Mon 10:00-14:00, Tue 10:00-18:00; no exceptions.
Submit 2026-07-20T10:00:00+05:30. Open intervals: [2026-07-20 10:00,14:00) = 14,400s;
[2026-07-21 10:00,18:00). Remaining 7,200s accumulates by 2026-07-21T12:00:00+05:30.
Reminder 2026-07-21T12:00:00+05:30; deadline 2026-07-21T18:00:00+05:30.
```

**Near closing — 2026-07-20/21**

```text
Timezone Asia/Kolkata. Recurring Mon/Tue 10:00-18:00; no exceptions.
Submit 2026-07-20T17:30:00+05:30. First interval contributes 1,800s; 19,800s remains.
Next interval begins 2026-07-21T10:00:00+05:30; reminder 2026-07-21T15:30:00+05:30;
deadline 2026-07-21T18:00:00+05:30.
```

**Overnight — corrected 2026-07-17/19**

```text
Timezone Asia/Kolkata. Recurring Friday and Saturday 20:00-02:00; no exceptions.
Submit Friday 2026-07-17T23:00:00+05:30. Open interval to Saturday 02:00 contributes 10,800s.
Next opening begins Saturday 2026-07-18T20:00:00+05:30; the remaining 10,800s completes at
Saturday 2026-07-18T23:00:00+05:30. Reminder is that instant; closing-boundary deadline is
Sunday 2026-07-19T02:00:00+05:30.
```

The interval splits at midnight for exception handling but retains its closing boundary for expiry.

**Holiday — 2026-07-20/22**

```text
Timezone Asia/Kolkata. Recurring Mon-Wed 10:00-18:00. Holiday exception closes all of
2026-07-21 local date. Submit 2026-07-20T17:00:00+05:30; Monday contributes 3,600s,
Tuesday contributes 0, Wednesday contributes remaining 18,000s. Reminder
2026-07-22T15:00:00+05:30; deadline 2026-07-22T18:00:00+05:30.
```

**Clarification pause — 2026-07-20/21**

```text
Timezone Asia/Kolkata. Recurring Mon/Tue 10:00-18:00; no exceptions. Submit
2026-07-20T10:00:00+05:30; clarification at 12:00 after 7,200 open seconds.
Customer responds 16:00; 14,400 open seconds remain. Monday contributes 7,200 more seconds,
then Tuesday contributes 7,200. Reminder 2026-07-21T12:00:00+05:30; deadline
2026-07-21T18:00:00+05:30. With the 21,600 wall-second clarification policy, an unanswered
clarification expires 2026-07-20T18:00:00+05:30.
```

**Emergency closure during review — 2026-07-20**

```text
Timezone Asia/Kolkata. Recurring Monday 10:00-18:00. Submit 2026-07-20T10:00:00+05:30;
emergency exception 12:00-14:00. Before pause, 7,200 open seconds accumulate and 14,400 remain.
Resume at 14:00; reminder and deadline both resolve to 2026-07-20T18:00:00+05:30.
For an indefinite closure, the 7,200-second pause cap expires at 14:00 and triggers the named
cap-expiry path rather than an indefinite hold/deadline.
```

**Emergency closure while payment ready — 2026-07-20**

```text
Timezone Asia/Kolkata. Payment ready 2026-07-20T12:00:00+05:30, firm-hold expiry
2026-07-20T13:00:00+05:30; closure begins 12:15. No pause occurs. Request/hold still expire
at 13:00. Phase 7 refuses provider creation while ineligible.
Only an audited support/platform cancellation may release earlier.
```

---

## 11. Events, Transition Evidence, Audit, Notifications, and Realtime

### 11.1 Event and transition evidence

Event envelope fields: ID, event type, `schema_version`, entity/store/user/actor, source, `command_id`, idempotency key, `correlation_id`, nullable `causation_event_id`, `privacy_classification`, severity, action flag, private payload, created timestamp. Schema version begins at 1 and a server registry validates `(event_type, version)`. Correlation is normally request ID. Privacy classes are `public`, `internal`, `confidential`, `restricted`; Phase 6 domain events are normally internal and exclude contact/address/free-form notes/tokens.

`commerce_transition_log` is append-only and stores previous/next status/version, actor, command, bounded reason, event/correlation IDs, and private metadata. Clients cannot write it. Support request has no transition row because status does not change.

Audit is mandatory for owner confirmation/rejection/support request, platform intervention, deadline extension, closure/suspension, private snapshot access, and manual replay. It records actor/role, derived store, entity, command, reason, before/after status/version where applicable, correlation/command, and time.

### 11.2 Notifications

`marketplace_notifications` is the canonical PII-safe commerce inbox. `notification_deliveries` is transport-attempt state for commerce, not a second inbox. Existing non-commerce rows remain legacy; a commerce event is never duplicated as both marketplace inbox and in-app delivery content. Commerce push rows reference `marketplace_notification_id`; presentation may merge commerce and legacy non-commerce sources.

Within the command transaction, derive store, resolve distinct active users with the Owner-only notification entitlement, and insert one canonical `marketplace_notifications` row per `(event,user,type)`. `notification_deliveries` contains transport attempts only. At submission, missing `OWNER-AVAILABLE` is an eligibility failure before any effect and therefore creates neither a request nor a phantom request ops alert. After a valid request exists, later recipient loss creates a critical ops task without erasing commerce. Push/email failure never rolls back commerce and never deletes the canonical inbox row. Replays dedupe through constraints.

Existing application inbox compatibility is explicit: the notification UI merges canonical commerce inbox rows with legacy non-commerce `notification_deliveries`; commerce in-app content is read from `marketplace_notifications`, while commerce delivery rows reference `marketplace_notification_id` and use only `push`/future external transport channels. The existing role-blind marketplace notification RLS must be replaced with recipient-own and explicit Owner-capability policies before Phase 6 exposure.

Required fan-out:

- Owners: submitted, clarification answered, acceptance, cancellation, reminder, expiry, support acknowledgement, payment-ready expiry.
- Customer: clarification, full/partial/unavailable/rejected, expiry, closure impact, support intervention, payment-ready/reminder/expiry.
- Ops: support request, missing owner, invalid schedule/policy, dead letter, reconciliation failure, compliance cancellation.

Transactional in-app projections remain even if push is unavailable. Deep links contain only route kind/opaque request ID. Target requires session, routes to customer/owner surface, refetches, authorizes ownership/capability, and returns indistinguishable denial without existence leakage.

### 11.3 Realtime

Phase 6 uses mutation invalidation, app-focus/notification-open refetch, manual refresh, and optional bounded active-screen polling. Realtime is optional later and only on safe RLS projections with row filters/logout unsubscribe/canonical refetch. Raw events, holds, snapshots, and tasks are never published.

---

## 12. Jobs, Retry, Reconciliation, and Support

Task types: confirmation reminder/expiry, clarification expiry, decision expiry, payment-ready expiry, emergency-pause expiry, store-ineligibility review, notification retry, hold reconciliation, commerce consistency reconciliation, platform support request.

### 12.1 Exact scheduler and worker contract

- `pg_cron` invokes the service-only `commerce-scheduler` Edge Function every minute. The cron request uses a dedicated scheduler bearer secret stored server-side; it is not a user JWT and is never exposed to clients.
- The scheduler calls a private, service-role-only PostgreSQL claim RPC. The RPC claims at most 50 tasks by default and rejects batch sizes above 100, using `FOR UPDATE SKIP LOCKED`, due-time order, and a single transaction.
- Maximum overlapping scheduler invocations is 1 logical lease. An overlapping invocation may claim other unlocked rows but cannot reclaim live leases. Scheduler fan-out starts at most 4 concurrent worker executions; each worker processes one claimed batch with at most 10 task executions concurrently.
- Claim sets `lease_owner` to the scheduler run UUID, `lease_expires_at` to five minutes after database time, increments `attempt_count` exactly once, and sets `status='in_progress'`. Workers must present the lease owner. Expired leases are recoverable by the next claim; live leases are never stolen.
- Retryable failures schedule the canonical 30s, 2m, 10m, 30m, 2h bounded-jitter sequence. Attempt 5 dead-letters the task. A stale state/version becomes `resolved_noop`, not a failed attempt retry.
- Scheduler only claims and dispatches. A worker calls the named transaction command that locks and revalidates the target; the Edge Function never performs ad-hoc status updates.
- Manual replay is restricted to `platform_admin` or the command-specific operations role, requires bounded reason, new command ID, current-state/version validation, and append-only audit linking the dead letter.
- Metrics/logs record scheduler run ID, task type/ID, lease owner, attempt, duration, sanitized result, and correlation ID. Alerts cover scheduler failure, stale-lease volume, dead letters, and backlog age. No payload/PII/provider body is logged.
- Cart abandonment remains lazy (§8.1) and never creates one cron task per cart.

Claim due rows in small batches using `FOR UPDATE SKIP LOCKED`, ordered by next attempt/creation. Claim atomically sets worker/lease/status/attempt. Execution locks target and verifies captured state/version/due; stale work resolves `resolved_noop`.

Retry maximum is 5 with 30s, 2m, 10m, 30m, 2h bounded-jitter backoff. Permanent no-op resolves. After fifth retryable failure, mark dead letter, preserve sanitized error, emit critical event/ops notification, and stop automatic retry. Manual replay requires role/reason/current state/audit/new command ID and preserves failure history.

The existing push select-then-bulk-update is replaced for commerce with an atomic delivery-claim RPC, per-attempt state, lease, retry, and dead letter. Provider responses are private/sanitized.

Reconciliation checks reserved counter versus active holds, expired active holds, holds beyond stock, impossible request/hold combinations, missing evidence/projections, duplicate effects, stuck jobs, failed delivery, cross-tenant denials, and idempotency conflicts. Canonical evidence may rebuild a missing safe projection; ambiguous/invariant failure is never blindly repaired.

`request_platform_support` validates owner capability/version/reason, creates internal event/audit/deduplicated support task, and changes no status/price/quantity/hold/deadline. Private note is bounded and excluded from events/notifications. Later support commands are separately authorized and transition normally.

### 12.2 Authorized support interventions

| Command | Actor/capability | Sources -> target | Reasons | Version/hold/deadline/task effects | Evidence |
|---|---|---|---|---|---|
| `support_cancel_request` | `platform_admin` or `support_agent` with assigned case | any nonterminal -> `platform_cancelled` | `support_override`, `customer_contact_issue`, `technical_error`, `suspected_abuse` | expected commerce version; release active holds; cancel due tasks; resolve support task | `order_request.support_intervened`, affected-party safe notifications, mandatory audit/idempotency |
| `support_extend_confirmation_deadline` | `platform_admin` or assigned `support_agent` | `submitted`/`store_reviewing` -> same | `technical_error`, `closure_exception`, `policy_exception` | expected commerce version; bounded one-time deadline/task replacement; no hold | support-intervened event/notifications/audit; idempotent command |
| `support_extend_customer_decision_deadline` | `platform_admin` only | `awaiting_customer_decision` -> same | `technical_error`, `customer_contact_issue` | expected version; active soft holds must remain valid; bounded replacement deadline/task, no bucket move | support-intervened event/notifications/audit; idempotent command |
| `support_resume_emergency_pause` | `platform_admin` only | `paused_for_emergency_closure` -> saved state | `closure_exception`, `support_override` | expected version; revalidate eligibility/holds; restore bounded timers; resolve pause task | `order_request.emergency_closure_resumed`, notifications/audit/idempotency |

No support command raises a price, substitutes a listing, or creates an ordinary owner revision loop. `request_platform_support` is not in this transition table because it changes neither commerce state nor commerce version.

---

## 13. Mobile UX, Privacy, Persistence, and Offline Behavior

Customer routes:

```text
/(tabs)/marketplace/cart
/(tabs)/marketplace/requests
/(tabs)/marketplace/requests/[requestId]
```

Store routes:

```text
/(store-owner)/orders
/(store-owner)/orders/[requestId]
```

All remain authenticated. This phase does not expose anonymous marketplace routing. Add-to-cart/cart/replacement/submission/history/detail/clarification/partial pickup-or-cancel/payment-ready/cancellation screens are required. Store adds Orders tab/list/detail and full/partial/unavailable/reject/clarify/support actions. `store_rejected` customer copy must not say out of stock.

Every mutation disables duplicate submit, uses idempotency key, and handles stale version by refetching. Offline state changes are never shown successful before server confirmation. Countdowns derive from server timestamps and refresh on foreground.

PII matrix:

| Data | Customer | Owner in Phase 6 | Support | Events/notifications/logs |
|---|---|---|---|---|
| Own identity | Own | Minimum order-scoped label/opaque ID | Minimum case context | Opaque ID only |
| Phone/address | Own | Hidden | Audited need only | Forbidden |
| Customer note | Own | If needed for confirmation | Case scoped | Never copied |
| Seller public identity/policy | Visible | Own | Visible | Safe summary only |
| Seller verification/payout | Hidden | Existing restricted surfaces only | Role-gated | Forbidden |

Phone/address remain private until a later fulfilment stage needs them. Final retention duration requires legal/privacy approval before production; no destructive cleanup is enabled before then.

Do not persist cart/request/address/contact/owner-request/notification commerce data in AsyncStorage/MMKV. Query keys include user and derived store. Logout cancels queries/mutations, clears React Query/notification/in-memory commerce state, unsubscribes channels, and resets navigation. Loading states must not show prior-user PII.

---

## 14. RLS, Grants, Validation, Security, and Observability

| Surface | Customer | Phase 6 Owner | Platform/support | Service |
|---|---|---|---|---|
| Carts/items | SELECT own safe rows | None | Audited case need | Full |
| Requests/items | SELECT own safe | SELECT derived-store with owner capability | Role/case scoped | Full |
| Private snapshots | No direct grant; own safe RPC | No phone/address | Audited case RPC | Full |
| Seller/policy snapshot | Own projection | Own-store projection | Case scoped | Full |
| Holds/transitions | Safe request projection only | Safe own-store projection | Case scoped | Full |
| Raw event/audit/task | None | Safe notification/support acknowledgement only | Explicit role | Full |
| Marketplace notification | Own recipient/read state | Own recipient/read state | Separate ops queue | Full |

Column exposure is controlled by named views/RPC projections, not base-table RLS alone:

| Projection | Allowed columns | Explicitly excluded |
|---|---|---|
| Customer request list | opaque request ID, safe store snapshot, status, safe totals/currency, fulfilment label, customer-visible deadlines, updated time | private snapshot IDs, internal command/correlation/causation IDs, support notes, raw events |
| Customer request detail | list fields plus own item snapshots/outcomes, policy/tariff display, own submitted note/clarification, safe transition timeline | internal reasons, task/hold row IDs, audit metadata, provider/internal fields |
| Owner request list | opaque request ID, order-scoped customer label (not global user ID), status, item count, fulfilment label, confirmation deadline | phone/address, customer profile/global ID, private snapshot references, internal support data |
| Owner request detail | list fields plus original book/edition/condition snapshots, quantities, price bounds, customer note only when required for confirmation, bounded clarification | phone/address, private snapshot references, command/correlation IDs, raw event payloads, internal support notes/private deadlines |
| Support/operator case view | minimum case-scoped request/store/customer opaque references, safe commerce state, assigned task and audited need-to-know private RPC | unrelated profile data, unrestricted raw snapshots/events; phone/address only through separately audited need RPC |

All tables enable RLS. Authenticated direct INSERT/UPDATE/DELETE is revoked on authoritative tables. `anon` has no Phase 6 grant. Security-definer functions pin empty search path, schema-qualify objects, validate `auth.uid()`, and expose only named commands.

Migration remediation is merge-blocking: add `marketplace_sec.has_phase6_owner_capability(store_id, capability)` requiring active `role='owner'` and entitlement; Phase 6 commands and Owner notification reads must not use role-blind `is_store_admin`. Replace the existing marketplace notification store-wide admin policy with recipient-own and capability-scoped safe projection access. Revoke direct authenticated inventory counter writes and replace the mobile service path that sets `quantity_available` and `quantity_total` to one input with a locked adjustment command that preserves reserved/sold/removed buckets. Extend canonical `marketplace_notifications` and legacy `notification_deliveries` through the compatibility contract in §11.2. Applied migrations are never edited in place; all remediation is additive.

One canonical TypeScript vocabulary matches database CHECKs; Zod validates HTTP input and DB projections; database repeats all security/state/value rules. Money rejects floats. Free text is length-bounded/private. Address schemas reject extra keys. Event registry validates type/version.

Stable external errors never expose tenant/entity existence or raw database text. Logs contain command/correlation/event/version/safe IDs/duration/result/retry only, excluding JWT/idempotency payload/address/phone/note/raw event/notification body.

Pilot metrics: submission; full/partial/unavailable/rejected; confirmation time; clarification/timeouts; acceptance/cancellation/expiry; closure pauses; hold conflicts/reconciliation; idempotency prevention/conflict; support; notification retry/dead letter; cross-tenant denial; missing owner recipient. Alert on invariant failure, dead letter, missing owner, malformed policy/schedule, reconciliation mismatch, duplicate effect, or any Phase 6 payment/provider write.

---

## 15. Red-Test-First Implementation, Migration, Verification, and Rollback

### 15.1 Build sequence

| Step | Red tests first | Production unit after red |
|---|---|---|
| 1 | Vocabulary/runtime schema | Shared types/Zod/reason/error registry |
| 2 | Table/constraint/index/grant/RLS/immutability | Schema migration |
| 3 | Tenant/capability/flag/locality/allowlist | Auth/policy helpers |
| 4 | Cart/idempotency/replacement | Cart commands |
| 5 | Submission/price/snapshot/INR | Submission command |
| 6 | Inventory race/hold/accounting | Confirmation/hold commands |
| 7 | Reject/unavailable/clarify/accept/cancel/support | Request commands |
| 8 | SLA/closure worked examples | Deadline/closure engine |
| 9 | Event/audit/fan-out/privacy/deep link | Notification/task integration |
| 10 | Claim/retry/dead letter/reconciliation | Workers |
| 11 | Customer/owner UI | Routes/services/hooks/screens |
| 12 | Full local then authorized live plan | Rollout preparation |

Database tests cover constraints, active cart, cross-store consistency, INR/bound price, snapshot immutability, customer/owner/manager-staff/platform RLS, direct-write denial, flags/locality/allowlist, idempotency, policy resolution, bucket/hold conservation, atomic evidence/fan-out, task claim/retry/dead letter, and Phase 5 anonymous-policy compatibility.

Command/UI tests cover all cart flows; price drift; full/partial/unavailable/rejected; clarification; pickup/cancel; support non-transition; closure/suspension; owner-paused listing; moderation; stale/duplicate/expiry; history/detail; deep links; logout cache; privacy; and error/offline states.

Concurrency tests use real PostgreSQL transactions for quantity-one competition, two owners, acceptance/expiry, closure/confirmation, suspension/confirmation, duplicate task/delivery claims, and future payment-ready expiry/provider-claim compatibility.

### 15.2 Migration sequence

1. Audit inventory buckets and schedule/policy data.
2. Add tables/constraints/indexes/RLS/revokes/narrow grants.
3. Extend event/notification/delivery/task/policy/inventory infrastructure.
4. Add append-only/immutable protections.
5. Seed typed policy defaults and disabled-by-default flags/entitlements.
6. Add transaction functions after red DB tests.
7. Deploy Edge Functions after command tests.
8. Add mobile after server boundary.
9. Enable only internal store/locality after separate live authorization.

Migrations are additive and preserve Phase 5 public policies.

Rollback before data may remove objects in reverse order after disabling flags. After request data exists, disable new/progression paths but retain history, cancellation, expiry, release, support, reconciliation, events, and snapshots; do not drop tables. Active holds release through audited commands or expiry. Never overwrite counters/delete evidence.

Local gate: focused Jest/DB integration, TypeScript no emit, web export, migration checks, file-size discipline, and no unintended local fixture residue. Destructive smoke runs belong in a staging/test Supabase project by default. Every run uses a `smoke_run_id`, disposable customer/Owner/store/inventory/request fixtures, and a cleanup report. Private snapshots are deleted or redacted under the test cleanup authority; test tasks and delivery attempts are resolved/removed according to test retention policy. Non-PII append-only event/audit evidence is retained with `smoke_run_id` and excluded from product metrics, so “zero residue” is never promised for append-only evidence. Production smoke and any remote write require separate authorization.

### 15.3 Invariant-level acceptance traceability

| Invariant | Requirement / implementation unit | Red test / production component | Security/concurrency evidence | Completion / live gate |
|---|---|---|---|---|
| INV-01 | single-store active cart; Units 2/5 | migration unique/FK tests; cart RPC | cross-store replacement race | local DB + authorized staged two-store smoke |
| INV-02 | server actor derivation; Units 3/5-9 | spoofed user/store red tests; command auth helper | cross-customer denial | local RLS + staged denial |
| INV-03, INV-04 | Owner capability/tenant; Units 3/4 | manager/staff and Store A/B denial; owner helper | concurrent owner commands | local security suite + staged denial |
| INV-05, INV-06 | command-only writes/immutable snapshots; Units 2/3/6 | grant/trigger tests; safe RPCs | direct-write denial | migration/RLS gate |
| INV-07, INV-08, INV-16, INV-23 | price, payable lines, INR/tariff; Units 1/4/6/7/9 | calculator/bound/float/provider-call red tests | stale price/tariff race | local deterministic tests + staged totals |
| INV-09, INV-10 | bucket accounting; Units 2/7/9 | conservation/release tests; hold commands | quantity-one and duplicate release races | real PostgreSQL gate + staged race |
| INV-11, INV-12, INV-21 | idempotency/evidence/request+cart split; Units 2/5/6/11 | replay and uniqueness red tests; creation/transition logs | duplicate submit race | DB integration + staged replay |
| INV-13 | support non-transition; Unit 8 | unchanged status/version/deadline/hold red test | duplicate support request | local command + staged support smoke |
| INV-14, INV-15 | privacy/deep links; Units 3/11/13/14 | projection/exclusion/deep-link tests | cross-tenant indistinguishable denial | local UI/RLS + staged denial |
| INV-17 | server clocks; Units 10/12 | fixed-date SLA/due-task red tests | expiry vs acceptance race | local deterministic + staged clock smoke |
| INV-18, INV-19 | live gates/cleanup; Units 4/9/12/15 | flag matrix and cleanup-while-disabled tests | shutdown/expiry race | local policy suite + staged kill-switch smoke |
| INV-20 | Phase 5 compatibility; Units 3/16 | anonymous/authenticated discovery regression | cross-role read checks | existing Phase 5 suite + staged public read |
| INV-22 | entitled Owner precondition; Units 4/6/11 | missing Owner zero-effects red test | Owner revoked during submit | local DB race + staged no-phantom check |

---

## 16. Traceability, Deferrals, and Approval Gate

| Area | Authority | SDD |
|---|---|---|
| Cart/replacement | README, DOC-5 §9, DOC-6 §3 | §§2, 6-8; App. A/B |
| Ownership/tenant | Founder, DOC-1, DOC-14 | §§2-7, 14; App. C |
| Anonymous DB/sign-in app | Phase 5 tracker, founder correction | §§1, 3, 5, 13-15 |
| Price/INR/snapshots | DOC-5/6/15, founder | §§2, 6, 8, 13 |
| Outcomes/rejection/support | DOC-6/9/14, founder | §§4, 8, 12; App. A/D/E |
| Inventory/holds | DOC-3/6, repository schema | §§2, 6, 9; App. B |
| Hours/closures | README, DOC-2/6/14, founder | §10; App. A |
| Phase 6/7 | DOC-12, founder | §2 |
| Events/notifications/privacy | DOC-10/14, founder | §§11-14; App. D |
| Flags/policy/rollout | DOC-12/16 | §§5, 10, 14 |
| Ops/audit | DOC-9/10 | §§11-12, 14-15 |

Deferred: provider/payment/ledger/tax/refund/settlement; pickup/delivery fulfilment and later-stage phone/address disclosure; manager/staff delegation; partial revision; higher-price correction; provider delivery quote; general notification convergence/Realtime.

Nonblocking operational gates: legal/privacy retention duration, Phase 7 legal/payment/accounting review, separate live authorization, and pending Phase 4 credential smoke.

Acceptance checklist:

- [ ] Authority and founder amendments accurate.
- [ ] Canonical vocabulary aligns with source corrections.
- [ ] Rejection distinct from unavailability.
- [ ] Support request non-transitioning.
- [ ] Owner-only is an MVP capability/entitlement, not permanent role assumption.
- [ ] Bucket-transfer accounting approved.
- [ ] Planned/emergency/suspension/payment-ready hold behavior approved.
- [ ] Worked SLA examples approved.
- [ ] Fan-out/dedupe/deep-link authorization approved.
- [ ] Phase 6 ends at provider-independent `payment_ready`.
- [ ] Tests/migration/rollback/live gate sufficient for separate implementation agent.
- [ ] Explicit SDD approval received before implementation.

---

## Appendix A. Transition-Command Matrix

Every state-changing row requires idempotency, expected version where applicable, one transition row, one canonical event, and atomic audit/notification/task effects. Entity creation uses creation evidence rather than inventing a previous state.

| Command | From -> To | Actor/guards | Inventory/timer | Event/notification |
|---|---|---|---|---|
| create request | no prior request -> `submitted` | Customer; all new-request guards including entitled Owner | No hold; reminder/expiry tasks | creation evidence + `order_request.submitted`; customer + owners |
| submit cart | cart `active -> submitted` | Same atomic HTTP command, separate cart idempotency sub-scope | No hold | cart transition evidence + `marketplace_cart.submitted` |
| start review | submitted -> reviewing | Owner; progression/version | None; SLA continues | review started |
| request clarification | reviewing -> clarification | Owner; reason/version | No hold; pause SLA/start timeout | clarification requested; customer |
| provide clarification | clarification -> reviewing | Customer; unexpired/version | Resume SLA | provided; owners |
| confirm full | reviewing -> payment ready | Owner; inventory/bound/all full | Firm holds; payment expiry | confirmed; customer + owners |
| confirm partial | reviewing -> customer decision | Owner; inventory/material change | Soft holds; decision expiry | partial; customer + owners |
| unavailable | reviewing -> unavailable | Owner; item reasons | Release; cancel tasks | unavailable; customer + owners |
| reject request | submitted/reviewing/clarification -> store rejected | Owner; non-stock reason | Release; cancel tasks | rejected; customer + owners |
| accept changes | customer decision -> payment ready | Customer; live guards/holds/version | Promote; replace expiry | changes accepted; customer + owners |
| customer cancel | active pre-payment -> customer cancelled | Customer/version | Release; cancel tasks | cancelled; customer + owners |
| reminder | submitted/reviewing -> same | Due job | None | due soon; owners |
| expire confirmation | submitted/reviewing -> expired | Due job | None | expired; customer + owners |
| expire clarification | clarification -> expired | Due job | Release if any | expired; both |
| expire decision | decision -> expired | Due job | Release soft | expired; both |
| expire payment ready | payment ready -> payment-ready expired | Due job | Release firm | payment-ready expired; both |
| pause emergency | eligible review/decision -> paused | System/platform; bounded policy | Preserve eligible holds; replace timers | closure paused; customer/owners/ops |
| resume emergency | paused -> saved state | System/platform; eligible | Revalidate/preserve; restore timers | closure resumed; both |
| closure cap expiry | paused -> expired/platform cancelled | Due job | Release soft | expired/cancelled; all |
| store ineligible | active non-payment-ready -> platform cancelled | System/platform | Release soft/eligible | store ineligible; all |
| support cancel | active -> platform cancelled | Support/admin/reason | Authorized release | support intervened; all |
| support extend confirmation | submitted/reviewing -> same | Support/admin/reason/policy/version | Replace confirmation task only | support intervened |
| support extend decision | customer decision -> same | Platform admin/reason/policy/version; valid soft holds | Replace decision task only | support intervened |
| rollout shutdown cancel | active non-payment-ready -> platform cancelled | Service/platform; explicit emergency authorization/reason | Release eligible holds | store ineligible/support intervened; audit |

Non-transition: `request_platform_support` requires owner/nonterminal/current commerce version and atomically creates internal event, owner audit, independently versioned deduplicated ops task, optional owner acknowledgement, with no commercial mutation or commerce-version increment.

---

## Appendix B. Schema Matrix

| Table | Core columns/constraints | Key indexes/access |
|---|---|---|
| `marketplace_carts` | id, user, store, active/submitted/replaced/abandoned, INR, version, expiry/time | Partial unique active/user; customer SELECT own; command writes only |
| `marketplace_cart_items` | cart/listing/inventory/store, positive quantity, display price/INR, versioned public snapshot | Unique cart/listing; cart FK index |
| `store_order_requests` | user/store/cart, canonical status/version/reason, fulfilment, requested/final totals/INR/calculator, all deadlines, closure source/remaining/pause count, correlation/time | User/status and store/status/due indexes; state CHECKs |
| `store_order_request_items` | request/listing/inventory/canonical, immutable book snapshot, requested/confirmed, bound/confirmed INR price, canonical outcome/reasons, fulfilment snapshot | Request/outcome and inventory indexes; price/quantity checks |
| `store_order_request_private_snapshots` | request PK, user, schema version, private contact/address JSON, fulfilment, time | No direct owner/client table grant; audited safe RPC |
| `store_order_request_private_snapshot_tombstones` | request PK, schema version, deletion reason/time; no PII | Service/privacy audit only |
| `store_order_request_seller_snapshots` | request PK, versioned seller/disclosure JSON | Safe customer/own-store projection |
| `store_order_request_policy_snapshots` | request/key/value/type/source policy/version/scope/time | Unique request/key; internal source metadata restricted |
| `order_request_policy_acceptances` | request/customer actor/policy/version/time/interface/command/correlation/snapshot ref | Immutable; customer-own safe evidence, Owner-hidden actor identity |
| `inventory_holds` | store/inventory/request/item, soft/firm, active/released/converted, quantity/version/expiry/release reason/command | Unique active request item; inventory/status/expiry and request/status; no direct client |
| `commerce_entity_creation_log` | entity/initial state+version/actor/command/idempotency/correlation/event/time | Unique entity and command; append-only; no false previous state |
| `commerce_transition_log` | prior/next state/version, actor, command/idempotency/reason/event/correlation/private metadata/time | Unique entity/command; append-only |
| `store_schedule_exceptions` | store/type/timezone/start/end/special hours/reason/status/actor/audit times | Store/time/type; validated bounded intervals |

Foundation extensions:

- `marketplace_events`: schema version, command, correlation, causation, privacy; append-only.
- `marketplace_notifications`: event, recipient, type/title/body/entity/deep link/read/privacy/dedupe.
- `notification_deliveries`: nullable commerce notification source, claim/attempt/next/lease/error/dead-letter; exactly one legacy/commerce source.
- `event_action_tasks`: task/entity/due/attempt/lease/error/resolution/dead-letter/dedupe.
- `marketplace_policy_config`: value type/version/validation and non-overlapping effective range.

### B.1 Canonical column contract

```text
marketplace_carts
  id UUID PK
  user_id UUID NOT NULL FK auth.users
  store_id UUID NOT NULL FK stores
  status TEXT NOT NULL CHECK active/submitted/replaced/abandoned
  currency_code CHAR(3) NOT NULL CHECK INR
  version INTEGER NOT NULL CHECK >= 1
  expires_at TIMESTAMPTZ NOT NULL
  created_at TIMESTAMPTZ NOT NULL
  updated_at TIMESTAMPTZ NOT NULL

marketplace_cart_items
  id UUID PK
  cart_id UUID NOT NULL FK marketplace_carts ON DELETE CASCADE
  listing_id UUID NOT NULL FK marketplace_book_listings
  inventory_id UUID NOT NULL FK store_inventory
  store_id UUID NOT NULL FK stores
  requested_quantity INTEGER NOT NULL CHECK > 0
  price_snapshot_minor INTEGER NOT NULL CHECK >= 0
  currency_code CHAR(3) NOT NULL CHECK INR
  listing_snapshot JSONB NOT NULL
  created_at TIMESTAMPTZ NOT NULL
  updated_at TIMESTAMPTZ NOT NULL

store_order_requests
  id UUID PK
  user_id UUID NOT NULL FK auth.users
  store_id UUID NOT NULL FK stores
  cart_id UUID NULL FK marketplace_carts
  status TEXT NOT NULL CHECK canonical request vocabulary
  status_reason_code TEXT NULL CHECK bounded catalogue
  version INTEGER NOT NULL CHECK >= 1
  fulfillment_method TEXT NOT NULL CHECK pickup/delivery
  final_fulfillment_method TEXT NULL CHECK pickup/delivery
  currency_code CHAR(3) NOT NULL CHECK INR
  requested_subtotal_minor INTEGER NOT NULL CHECK >= 0
  provisional_delivery_tariff_minor INTEGER NOT NULL CHECK >= 0
  final_subtotal_minor INTEGER NULL CHECK >= 0
  final_delivery_tariff_minor INTEGER NULL CHECK >= 0
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK >= 0
  fee_minor INTEGER NOT NULL DEFAULT 0 CHECK >= 0
  final_total_minor INTEGER NULL CHECK >= 0
  money_calculator_version INTEGER NOT NULL
  delivery_tariff_version INTEGER NOT NULL
  confirmation_reminder_at TIMESTAMPTZ NOT NULL
  confirmation_due_at TIMESTAMPTZ NOT NULL
  clarification_expires_at TIMESTAMPTZ NULL
  acceptance_expires_at TIMESTAMPTZ NULL
  payment_expires_at TIMESTAMPTZ NULL
  paused_from_status TEXT NULL
  closure_exception_id UUID NULL FK store_schedule_exceptions
  closure_pause_expires_at TIMESTAMPTZ NULL
  confirmation_open_seconds_remaining INTEGER NULL CHECK >= 0
  decision_seconds_remaining INTEGER NULL CHECK >= 0
  emergency_pause_count INTEGER NOT NULL DEFAULT 0 CHECK >= 0
  correlation_id UUID NOT NULL
  latest_command_id UUID NOT NULL
  customer_note TEXT NULL CHECK length <= policy maximum
  submitted_at TIMESTAMPTZ NOT NULL
  terminal_at TIMESTAMPTZ NULL
  created_at TIMESTAMPTZ NOT NULL
  updated_at TIMESTAMPTZ NOT NULL

store_order_request_items
  id UUID PK
  order_request_id UUID NOT NULL FK store_order_requests ON DELETE RESTRICT
  store_id UUID NOT NULL FK stores
  listing_id UUID NOT NULL FK marketplace_book_listings
  inventory_id UUID NOT NULL FK store_inventory
  canonical_work_id UUID NULL
  canonical_edition_id UUID NULL
  title_snapshot TEXT NOT NULL
  authors_snapshot JSONB NOT NULL
  isbn_10_snapshot TEXT NULL
  isbn_13_snapshot TEXT NULL
  edition_format_snapshot JSONB NOT NULL
  condition_snapshot TEXT NOT NULL
  condition_notes_snapshot TEXT NULL
  image_url_snapshot TEXT NULL
  requested_quantity INTEGER NOT NULL CHECK > 0
  confirmed_quantity INTEGER NULL CHECK >= 0 and <= requested
  server_bound_unit_price_minor INTEGER NOT NULL CHECK >= 0
  confirmed_unit_price_minor INTEGER NULL CHECK >= 0 and <= bound
  currency_code CHAR(3) NOT NULL CHECK INR
  confirmation_status TEXT NOT NULL CHECK canonical item vocabulary
  price_drift_review_required BOOLEAN NOT NULL DEFAULT false
  unavailable_reason_code TEXT NULL
  clarification_reason_code TEXT NULL
  rejection_reason_code TEXT NULL
  pickup_eligible_snapshot BOOLEAN NOT NULL
  delivery_eligible_snapshot BOOLEAN NOT NULL
  version INTEGER NOT NULL CHECK >= 1
  created_at TIMESTAMPTZ NOT NULL
  updated_at TIMESTAMPTZ NOT NULL

store_order_request_private_snapshots
  order_request_id UUID PK FK store_order_requests ON DELETE RESTRICT
  customer_user_id UUID NOT NULL FK auth.users
  schema_version INTEGER NOT NULL CHECK >= 1
  contact_snapshot JSONB NULL
  delivery_address_snapshot JSONB NULL
  created_at TIMESTAMPTZ NOT NULL

store_order_request_private_snapshot_tombstones
  order_request_id UUID PK FK store_order_requests ON DELETE RESTRICT
  schema_version INTEGER NOT NULL CHECK >= 1
  deletion_reason_code TEXT NOT NULL
  deleted_at TIMESTAMPTZ NOT NULL

store_order_request_seller_snapshots
  order_request_id UUID PK FK store_order_requests ON DELETE RESTRICT
  schema_version INTEGER NOT NULL CHECK >= 1
  seller_snapshot JSONB NOT NULL
  created_at TIMESTAMPTZ NOT NULL

store_order_request_policy_snapshots
  id UUID PK
  order_request_id UUID NOT NULL FK store_order_requests ON DELETE RESTRICT
  policy_key TEXT NOT NULL
  value_type TEXT NOT NULL
  resolved_value JSONB NOT NULL
  source_policy_id UUID NULL FK marketplace_policy_config
  source_policy_version INTEGER NOT NULL
  source_scope_type TEXT NOT NULL
  resolved_at TIMESTAMPTZ NOT NULL

order_request_policy_acceptances
  id UUID PK
  order_request_id UUID NOT NULL FK store_order_requests ON DELETE RESTRICT
  customer_actor_id UUID NOT NULL FK auth.users
  policy_identifier TEXT NOT NULL
  accepted_version TEXT NOT NULL
  accepted_at TIMESTAMPTZ NOT NULL
  interface_source TEXT NOT NULL
  command_id UUID NOT NULL
  correlation_id UUID NOT NULL
  policy_snapshot_id UUID NOT NULL FK store_order_request_policy_snapshots

commerce_entity_creation_log
  id UUID PK
  entity_type TEXT NOT NULL
  entity_id UUID NOT NULL
  initial_state TEXT NOT NULL
  initial_version INTEGER NOT NULL CHECK >= 1
  actor_user_id UUID NULL
  actor_role TEXT NOT NULL
  command_name TEXT NOT NULL
  command_id UUID NOT NULL
  idempotency_key TEXT NOT NULL
  correlation_id UUID NOT NULL
  event_id UUID NOT NULL FK marketplace_events
  created_at TIMESTAMPTZ NOT NULL

inventory_holds
  id UUID PK
  store_id UUID NOT NULL FK stores
  inventory_id UUID NOT NULL FK store_inventory
  order_request_id UUID NOT NULL FK store_order_requests
  order_request_item_id UUID NOT NULL FK store_order_request_items
  hold_type TEXT NOT NULL CHECK soft/firm
  status TEXT NOT NULL CHECK active/released/converted_to_sale
  quantity INTEGER NOT NULL CHECK > 0
  version INTEGER NOT NULL CHECK >= 1
  expires_at TIMESTAMPTZ NOT NULL
  release_reason_code TEXT NULL
  command_id UUID NOT NULL
  created_at TIMESTAMPTZ NOT NULL
  released_at TIMESTAMPTZ NULL

commerce_transition_log
  id UUID PK
  entity_type TEXT NOT NULL
  entity_id UUID NOT NULL
  previous_state TEXT NOT NULL
  next_state TEXT NOT NULL
  previous_version INTEGER NOT NULL
  next_version INTEGER NOT NULL
  actor_user_id UUID NULL
  actor_role TEXT NOT NULL
  command_name TEXT NOT NULL
  command_id UUID NOT NULL
  idempotency_key TEXT NOT NULL
  reason_code TEXT NULL
  correlation_id UUID NOT NULL
  event_id UUID NOT NULL FK marketplace_events
  metadata JSONB NOT NULL DEFAULT '{}'
  created_at TIMESTAMPTZ NOT NULL

store_schedule_exceptions
  id UUID PK
  store_id UUID NOT NULL FK stores
  exception_type TEXT NOT NULL CHECK holiday/planned_closure/special_hours/emergency_closure
  timezone TEXT NOT NULL
  starts_at TIMESTAMPTZ NOT NULL
  ends_at TIMESTAMPTZ NOT NULL CHECK ends_at > starts_at
  special_hours JSONB NULL
  reason_code TEXT NOT NULL
  status TEXT NOT NULL CHECK scheduled/active/cancelled/completed
  created_by UUID NOT NULL FK auth.users
  created_at TIMESTAMPTZ NOT NULL
  updated_at TIMESTAMPTZ NOT NULL
  cancelled_at TIMESTAMPTZ NULL
```

Use TEXT + CHECK rather than PostgreSQL enums to follow repository convention and permit additive vocabulary migrations. Add FK indexes, due-time partial indexes, `(user_id,status,updated_at)` and `(store_id,status,updated_at)` request indexes, inventory/hold expiry indexes, and policy resolution indexes described above.

---

### B.2 Command Payload Matrix

| Command | Client payload | Server-derived/response essentials |
|---|---|---|
| `create_cart` | listing ID, quantity | user/store/inventory/listing snapshot, cart/version |
| `replace_cart_store` | replacement token | user/old cart/new store; new cart/version |
| `set_cart_item_quantity` | cart item ID, quantity, expected version | cart/user/store; canonical cart projection |
| `remove_cart_item` | cart item ID, expected version | cart/user; remaining cart or abandoned state |
| `submit_order_request` | cart ID, fulfilment, private contact/address if required, policy acceptance, expected version | user/store/prices/tariff/policies/totals/deadlines; request creation + cart transition evidence/events; request/version |
| `start_store_review` | request ID, expected version | actor/store/capability; request/version |
| `request_clarification` | request ID, item IDs, bounded reasons, private prompts, expected version | store/deadline; safe request projection |
| `provide_clarification` | request ID, bounded response fields, expected version | customer/store; safe request projection |
| `confirm_full` | request ID, item confirmed quantities/prices at or below bound, expected version | totals/holds/store; payment-ready request/version |
| `confirm_partial` | request ID, item outcomes/quantities/prices/reasons, expected version | totals/soft holds/deadline; decision request/version |
| `mark_items_unavailable` | request ID, item IDs/reason codes, expected version | store/outcome; request/version |
| `reject_order_request` | request ID, rejection reason, optional private bounded note, expected version | store; terminal request/version |
| `accept_confirmed_changes` | request ID, explicit accepted result version, pickup choice when required, expected version | user/final totals/hold promotion; payment-ready request/version |
| `cancel_order_request` | request ID, bounded reason, expected version | user/release; terminal request/version |
| `request_platform_support` | request ID, support reason, optional private bounded note, expected commerce version | owner/task/event/audit; same status and same commerce version; independent support-task version |
| support/system commands | entity ID, expected version/due task/reason as applicable | actor/store/state/policy; canonical safe result |

---

## Appendix C. Security and Denial Matrix

| Attempt | Expected |
|---|---|
| Anonymous Phase 5 eligible public read | Existing compatible success |
| Anonymous Phase 6 read/command | Denied |
| Client supplies another user/store | Ignored/rejected; server derives |
| Cross-customer/store read/mutation | Indistinguishable denial |
| Manager/staff owner command | MVP capability denial |
| Direct status/hold/counter/event write | Grant/RLS denial |
| Raw event/private snapshot/phone/address read | Denied |
| Unauthorized deep link | Refetch denial before render |
| Disabled flag/locality/allowlist progression | Server denial |
| Disabled flag blocks cleanup/history | Test failure |
| Stale version | 409/no effects |
| Idempotency key reused with different payload | 409/no effects |
| Confirmation above bound | Domain/constraint denial |
| Phase 6 provider/payment/order/ledger write | Permission/test failure |

---

## Appendix D. Event and Notification Matrix

| Event | Notification type(s) | Recipients | Privacy/deep link |
|---|---|---|---|
| `marketplace_cart.submitted` | none (request acknowledgement is canonical) | None | Internal evidence only |
| `marketplace_cart.replaced` | `commerce.marketplace_cart.replaced.customer` | Customer | Own cart route; no old-cart contents in payload |
| `order_request.submitted` | `commerce.order_request.submitted.customer`, `commerce.order_request.submitted.store` | Customer + authorized owners | Internal; safe request detail |
| `order_request.confirmation_due_soon` | `commerce.order_request.confirmation_due.store` | Owners | Internal; owner detail |
| `order_request.review_started` | `commerce.order_request.review_started.customer` | Optional customer projection | Internal; customer detail |
| clarification requested/provided | `commerce.order_request.clarification_required.customer`, `commerce.order_request.clarification_received.store` | Customer / owners | Reason code only; correct detail |
| `order_request.confirmed` | `commerce.order_request.payment_ready.customer`, `commerce.order_request.confirmed.store` | Customer + owners | Safe total/expiry |
| `order_request.partially_confirmed` | `commerce.order_request.partial.customer`, `commerce.order_request.partial.store` | Customer + owners | Safe item outcomes |
| `order_request.unavailable` | `commerce.order_request.unavailable.customer`, `commerce.order_request.unavailable.store` | Customer + owners | Customer-safe stock reason |
| `order_request.rejected` | `commerce.order_request.rejected.customer`, `commerce.order_request.rejected.store` | Customer + owners | Bounded customer-safe non-stock reason |
| `order_request.changes_accepted` | `commerce.order_request.payment_ready.customer`, `commerce.order_request.changes_accepted.store` | Customer + owners | Safe final total/expiry |
| cancelled/expired/payment-ready expired | `commerce.order_request.cancelled.customer`, `commerce.order_request.cancelled.store`, `commerce.order_request.expired.customer`, `commerce.order_request.expired.store`, `commerce.order_request.payment_ready_expired.customer`, `commerce.order_request.payment_ready_expired.store` | Customer + owners | Actor class/bounded reason |
| emergency closure paused/resumed | `commerce.order_request.closure_paused.customer`, `commerce.order_request.closure_paused.store`, `commerce.order_request.closure_paused.ops`, `commerce.order_request.closure_resumed.customer`, `commerce.order_request.closure_resumed.store` | Customer + owners + ops as applicable | Bounded impact, no private note |
| `order_request.store_ineligible` | `commerce.order_request.store_ineligible.customer`, `commerce.order_request.store_ineligible.store`, `commerce.order_request.store_ineligible.ops` | Customer + owners + ops | Confidential event; safe projections |
| `order_request.support_requested` | `commerce.order_request.support_requested.store`, `commerce.order_request.support_requested.ops` | Ops + owner acknowledgement | Confidential; private note excluded |
| `order_request.support_intervened` | `commerce.order_request.support_intervened.customer`, `commerce.order_request.support_intervened.store`, `commerce.order_request.support_intervened.ops` | Affected parties + ops | Confidential event; safe projections |

All are schema version 1 initially, use request correlation, and dedupe per event/recipient/type.

---

## Appendix E. Reason and Error Catalogues

Unavailability: `out_of_stock`, `sold_offline`, `damaged`, `misplaced`, `wrong_edition`, `wrong_condition`, `listing_error`, `store_ineligible`, `other`.

Full rejection: `cannot_fulfil_request`, `store_capacity`, `fulfilment_method_unsupported`, `customer_request_not_serviceable`, `policy_or_compliance_constraint`, `suspected_abuse`, `other`. Stock reasons are invalid for rejection. Suspected abuse uses generic customer copy and creates ops work.

Clarification: `edition`, `condition`, `quantity`, `fulfilment`, `delivery_minimum`, `customer_note`, `price_drift`, `other`.

Support: `inventory_exception`, `price_correction_review`, `customer_contact_issue`, `fulfilment_exception`, `closure_exception`, `policy_exception`, `technical_error`, `suspected_abuse`, `other`. Price-correction review creates work only; it cannot raise Phase 6 bound.

Release/terminal: `customer_requested`, `confirmation_sla_elapsed`, `clarification_window_elapsed`, `customer_decision_window_elapsed`, `payment_ready_window_elapsed`, `store_rejected`, `request_unavailable`, `emergency_closure_cap_elapsed`, `store_ineligible`, `feature_disabled`, `support_override`.

| HTTP | Error | Meaning |
|---:|---|---|
| 400 | `INVALID_COMMAND`, `INVALID_QUANTITY`, `INVALID_FULFILMENT` | Schema/domain input invalid |
| 401 | `AUTHENTICATION_REQUIRED` | Missing/invalid session |
| 403/404 | `COMMERCE_ENTITY_UNAVAILABLE` | Safe unauthorized/missing denial |
| 403 | `STORE_COMMAND_NOT_ENTITLED` | Role/capability denied |
| 409 | `ENTITLED_OWNER_UNAVAILABLE` | Submission store has no active entitled Owner; zero commerce effects |
| 409 | `STALE_VERSION`, `INVALID_STATE_TRANSITION` | State/version conflict |
| 409 | `IDEMPOTENCY_KEY_REUSED`, `COMMAND_IN_PROGRESS` | Idempotency conflict |
| 409 | `CROSS_STORE_REPLACEMENT_REQUIRED` | Explicit token flow required |
| 409 | `INSUFFICIENT_INVENTORY`, `PRICE_BOUND_EXCEEDED`, `HOLD_EXPIRED` | Commerce guard failed |
| 410 | `REQUEST_WINDOW_EXPIRED` | Deadline passed |
| 422 | `POLICY_CONFIGURATION_INVALID`, `STORE_SCHEDULE_INVALID` | Server configuration blocks safely |
| 422 | `DELIVERY_TARIFF_UNAVAILABLE` | Required deterministic tariff cannot be resolved; no provider fallback |
| 423 | `COMMERCE_ROLLOUT_DISABLED` | Flag/locality/allowlist blocks progression |
| 500 | `COMMERCE_COMMAND_FAILED` | Sanitized unexpected failure |

---

## Appendix F. Approval Record

Stage 1 was approved on 2026-07-16 with anonymous database-policy compatibility/sign-in-first routing, distinct rejection, non-transitioning support request, differentiated closure/suspension, worked SLA examples, owner-only MVP entitlement, minimum customer identity, pickup-or-cancel, no partial revision, owner-paused listing continuation, and provider-independent `payment_ready` incorporated here.

The 2026-07-16 founder correction directive approved this corrected monolith for local implementation after the Stage 4 validation verdict. It explicitly forbids restoring or recreating the deleted three-document split. Remote migrations, deployments, cron enablement, fixtures, and production smoke remain separately authorized gates.

Unit 15 reconciliation/observability and the Unit 16 source release gate were completed locally on 2026-07-16 without changing this document's normative contract. Source verification passes 274/274 across 26 suites, including 158/158 migration/security/reconciliation assertions. Supabase CLI 2.20.12 is installed but no Docker/PostgreSQL daemon is available, so migrations 1-33, persisted RLS/grants, integration SQL, and real concurrency remain unexecuted. The implementation verdict is `PHASE 6 SOURCE-COMPLETE — DATABASE VERIFICATION REQUIRED`; no remote/live or Phase 7 action is authorized by this record.
