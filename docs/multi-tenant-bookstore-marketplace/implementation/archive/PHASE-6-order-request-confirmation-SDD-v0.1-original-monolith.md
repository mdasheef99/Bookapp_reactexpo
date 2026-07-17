# Phase 6 Software Design Document: Order Request and Confirmation

**Product:** BookConnect multi-tenant bookstore marketplace  
**Status:** `draft_for_approval`  
**Version:** 0.1  
**Date:** 2026-07-16  
**Implementation status:** Not started  
**Approval gate:** No Phase 6 production implementation may begin until this SDD is explicitly approved.

---

## 1. Authority, Status, Scope, and Non-Goals

### 1.1 Authority

Requirements are resolved in this order:

1. Approved BookConnect specifications.
2. Explicit founder-approved Phase 6 decisions recorded in the 2026-07-16 Stage 1 approval.
3. Existing repository constraints and conventions.
4. Architecture derived to implement the above.
5. Industry guidance only where the first four are silent.

Controlling documents are the marketplace `README`, `DOC-13`, the Phase 6 tracker, `DOC-12`, `DOC-6`, `DOC-14`, and the domain-owned portions of DOC-0/1/2/3/5/7/8/9/10/15/16. The Phase 5 tracker controls the accepted discovery handoff; the Architecture Remediation Plan controls the previously accepted clarification/two-tier-hold reconciliation.

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

### 4.1 Request states

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

`unavailable` is a stock/item inability. `store_rejected` is a full request decline for a bounded non-stock reason. `confirmed`, `partially_confirmed`, `adjusted`, and `clarification_provided` are transition outcomes/events, not transient request states.

Item states: `requested`, `needs_clarification`, `confirmed_full`, `confirmed_partial`, `unavailable`, `rejected`.

Hold types: `soft`, `firm`. Hold states: `active`, `released`, `converted_to_sale`; Phase 6 never converts to sale. Promotion changes type on the existing active quantity and does not move inventory buckets.

### 4.2 Commands

Customer: `create_cart`, `replace_cart_store`, `set_cart_item_quantity`, `remove_cart_item`, `submit_order_request`, `provide_clarification`, `accept_confirmed_changes`, `cancel_order_request`.

Owner: `start_store_review`, `request_clarification`, `confirm_full`, `confirm_partial`, `mark_items_unavailable`, `reject_order_request`, `request_platform_support`.

System/support: `send_confirmation_reminder`, `expire_confirmation`, `expire_clarification`, `expire_customer_decision`, `expire_payment_ready`, `pause_for_emergency_closure`, `resume_after_emergency_closure`, `expire_emergency_closure_pause`, `cancel_for_store_ineligibility`, `support_cancel_request`, `support_extend_deadline`.

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
```

`support_requested` is an internal operational event, not a state-transition event.

---

## 5. Authorization, Eligibility, and Rollout

Guard definitions:

- `AUTH-C`: `auth.uid()` owns the cart/request.
- `AUTH-O`: actor has active owner relationship and Phase 6 owner capability for the derived store.
- `STORE`: active, verification approved, setup complete, selling allowed, not suspended/prohibited.
- `SUB`: latest subscription is trialing/active/past_due/grace; restricted/cancelled blocks new/progression commands.
- `ROLLOUT`: marketplace/cart-request flags, pilot locality, and store allowlist/entitlement enabled.
- `LIST-NEW`: active, price-valid, unmoderated listing with sellable inventory.
- `LIST-ACTIVE`: valid at submission; owner pause allowed, but moderation/prohibition/removal blocks.
- `INV`: locked inventory belongs to derived store/listing and has sufficient free bucket.
- `HOLD`: required hold is active/unexpired/quantity-consistent.
- `VERSION`: expected client version equals locked version.

| Operation | Required guards | Failure behavior |
|---|---|---|
| Phase 5 DB discovery | Existing public policy | Preserve anonymous/authenticated compatibility. |
| Cart mutation/replace | AUTH-C, STORE, SUB, ROLLOUT, LIST-NEW | No cart change on failure. |
| Request submit | Above + VERSION and all item/fulfilment validation | Atomic rejection; active cart preserved. |
| Review/clarify | AUTH-O, STORE, SUB, ROLLOUT, LIST-ACTIVE, VERSION | Reject stale/ineligible. |
| Full/partial confirm | Above + INV + price bounds | No subset commits. |
| Full rejection | AUTH-O, bounded non-stock reason, VERSION | Enter `store_rejected`; release eligible holds. |
| Owner support request | AUTH-O, nonterminal request, VERSION | Task/event/audit only. |
| Customer clarification | AUTH-C, unexpired clarification, VERSION | Reject stale/expired. |
| Customer acceptance | AUTH-C, STORE, SUB, ROLLOUT, LIST-ACTIVE, HOLD, VERSION | Do not promote on failure. |
| Customer cancellation | AUTH-C, VERSION | Always allow safe pre-payment closure. |
| History/detail | AUTH-C or owner capability | Current rollout/store state cannot erase history. |
| Reminder/expiry/release | Service, due/state/version | Never gated by rollout. |
| Suspension/prohibition | Service/support | Apply fail-closed policy in §10. |
| Support intervention | Explicit platform role/reason/VERSION | Audit/event mandatory. |

Server progression evaluates `marketplace_enabled`, `cart_order_request_enabled`, `marketplace_localities.is_pilot_enabled`, `commerce_order_requests_enabled`, `commerce_order_request_owner_commands_enabled`, and fulfilment flags. Flags are not authorization and cannot disable history/cancellation/cleanup.

---

## 6. Data Model, Constraints, Indexes, and Snapshots

New tables:

- `marketplace_carts`, `marketplace_cart_items`;
- `store_order_requests`, `store_order_request_items`;
- `store_order_request_private_snapshots`, `store_order_request_private_snapshot_tombstones`, `store_order_request_seller_snapshots`, `store_order_request_policy_snapshots`;
- `inventory_holds`, `commerce_transition_log`, `store_schedule_exceptions`.

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
- transition unique by entity/command; event unique by transition command;
- notification unique `(event_id,user_id,notification_type)`;
- delivery unique `(marketplace_notification_id,recipient_user_id,channel)`;
- one open/in-progress task per entity/task type.

Submission snapshots book/listing/inventory/canonical IDs, title/authors/ISBN/edition/format/condition/notes/image, quantity, price bound, INR, fulfilment eligibility, seller identity/disclosures/agreement versions, resolved policy ID/version/scope/value/time, customer order-scoped identity, contact/address when supplied, and fulfilment choice.

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

Mutable carts/requests/holds use integer `version >= 1`. Commands require expected version except safe creates and due tasks. Mismatch returns `409 STALE_VERSION` with no effects. Due tasks capture target version, lock current row, and resolve as no-op if state/version has advanced.

---

## 8. Cart, Submission, Price, Money, and Fulfilment

### 8.1 Cart and replacement

Cart states are `active`, `submitted`, `replaced`, `abandoned`; cart creation reserves nothing. Abandonment default is seven days, range one to thirty. Add/update re-reads public listing data and writes display snapshots.

Cross-store add is two-step: server returns `CROSS_STORE_REPLACEMENT_REQUIRED` plus a short-lived opaque token bound to customer, old cart/version, new listing, and expiry; confirmed replacement revalidates everything, marks old cart replaced, creates new active cart, and adds the item atomically. Failure preserves the old cart.

### 8.2 Submission transaction

1. Resolve customer and lock active cart/idempotency.
2. Verify expected version and single store.
3. Lock/re-read listing/inventory rows in sorted UUID order.
4. Resolve store/subscription/entitlement/locality/allowlist/moderation/fulfilment eligibility.
5. Establish immutable price bounds and validate quantities without holds.
6. Resolve/snapshot policies, schedule/timezone, seller, fulfilment, and private contact/address.
7. Calculate server-authoritative requested totals.
8. Insert request/items/snapshots, mark cart submitted, create SLA tasks.
9. Insert transition, `order_request.submitted`, owner fan-out, customer acknowledgement, and audit metadata.
10. Commit once.

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

All amounts are integer paise, currency is immutable `INR`, line total is checked quantity × confirmed unit price, unavailable/rejected lines contribute zero, and one versioned server calculator owns discounts/fees/totals. Mobile calculations are display-only.

### 8.4 Confirmation outcomes

- Full materially unchanged: `store_reviewing -> payment_ready`, firm holds, no second customer acceptance.
- Partial/material change: `store_reviewing -> awaiting_customer_decision`, soft holds, explicit acceptance.
- Material change includes reduction, unavailability, substitution, fulfilment change, delivery-minimum failure, fee increase, or replacement.
- Below delivery minimum: customer chooses pickup or cancellation; no revised/provider fee.
- No ordinary owner revision after a partial result is published.

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

| Key | Type | Default | Range | Snapshot |
|---|---|---:|---:|---|
| `commerce.cart_abandonment_seconds` | integer | 604800 | 86400-2592000 | Cart create |
| `commerce.confirmation_reminder_open_seconds` | integer | 21600 | fixed MVP unless approved | Submission |
| `commerce.confirmation_expiry_business_days` | integer | 1 | 1-2 | Submission |
| `commerce.clarification_timeout_seconds` | integer | 21600 | 900-86400 | Clarification |
| `commerce.acceptance_window_seconds` | integer | 1800 | 900-3600 | Partial result |
| `commerce.payment_ready_window_seconds` | integer | 3600 | 1800-7200 | Payment ready |
| `commerce.price_drift_tolerance_minor` | paise integer | 500 | 0-5000 | Submission |
| `commerce.emergency_closure_pause_seconds` | integer | 7200 | 900-21600 | Emergency pause |
| `commerce.max_emergency_closure_pauses` | integer | 1 | 0-2 | Submission |
| `commerce.command_idempotency_retention_seconds` | integer | 604800 | 86400-2592000 | Command |

Return/cancellation policy, delivery minimum, fulfilment eligibility, discounts, fees, and calculator version are also snapshotted. Values are server-read and not hardcoded in mobile.

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

**Short days**

```text
Mon 10:00-14:00, Tue 10:00-18:00; submit Mon 10:00.
Mon contributes 4h; reminder Tue 12:00; expiry Tue 18:00.
```

**Near closing**

```text
Mon/Tue 10:00-18:00; submit Mon 17:30.
Mon contributes 0.5h; reminder Tue 15:30; expiry Tue 18:00.
```

**Overnight**

```text
Fri/Sat 20:00-02:00; submit Fri 23:00.
First interval contributes 3h; reminder Sun 23:00; expiry Mon 02:00.
```

The interval splits at midnight for exception handling but retains its closing boundary for expiry.

**Holiday**

```text
Mon-Wed 10:00-18:00; Tue holiday; submit Mon 17:00.
Mon contributes 1h, Tue 0; reminder Wed 15:00; expiry Wed 18:00.
```

**Clarification pause**

```text
Mon/Tue 10:00-18:00; submit Mon 10:00; clarification Mon 12:00;
customer answers Mon 16:00. Two open hours consumed, four remain.
Mon contributes 2 more; reminder Tue 12:00; expiry Tue 18:00.
Clarification expires Mon 18:00 under the six-wall-hour default if unanswered.
```

**Emergency closure during review**

```text
Mon 10:00-18:00; submit 10:00; emergency closure 12:00-14:00.
Two hours consumed; request pauses with four remaining; resumes 14:00.
Reminder/expiry: 18:00.
If indefinite, the two-hour pause cap triggers escalation at 14:00 rather than an indefinite hold/deadline.
```

**Emergency closure while payment ready**

```text
Payment ready 12:00, firm hold expiry 13:00; closure begins 12:15.
Request/hold still expire at 13:00. Phase 7 refuses provider creation while ineligible.
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

Within the command transaction, derive store, resolve distinct active users with `phase6_order_notifications` (owner-only MVP), insert one notification per `(event,user,type)`, then one delivery per `(notification,user,channel)`. If no authorized recipient resolves, create a critical ops task but do not roll back the customer command. Replays dedupe through constraints.

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

Claim due rows in small batches using `FOR UPDATE SKIP LOCKED`, ordered by next attempt/creation. Claim atomically sets worker/lease/status/attempt. Execution locks target and verifies captured state/version/due; stale work resolves `resolved_noop`.

Retry maximum is 5 with 30s, 2m, 10m, 30m, 2h bounded-jitter backoff. Permanent no-op resolves. After fifth retryable failure, mark dead letter, preserve sanitized error, emit critical event/ops notification, and stop automatic retry. Manual replay requires role/reason/current state/audit/new command ID and preserves failure history.

The existing push select-then-bulk-update is replaced for commerce with an atomic delivery-claim RPC, per-attempt state, lease, retry, and dead letter. Provider responses are private/sanitized.

Reconciliation checks reserved counter versus active holds, expired active holds, holds beyond stock, impossible request/hold combinations, missing evidence/projections, duplicate effects, stuck jobs, failed delivery, cross-tenant denials, and idempotency conflicts. Canonical evidence may rebuild a missing safe projection; ambiguous/invariant failure is never blindly repaired.

`request_platform_support` validates owner capability/version/reason, creates internal event/audit/deduplicated support task, and changes no status/price/quantity/hold/deadline. Private note is bounded and excluded from events/notifications. Later support commands are separately authorized and transition normally.

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

All tables enable RLS. Authenticated direct INSERT/UPDATE/DELETE is revoked on authoritative tables. `anon` has no Phase 6 grant. Security-definer functions pin empty search path, schema-qualify objects, validate `auth.uid()`, and expose only named commands.

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

Local gate: focused Jest/DB integration, TypeScript no emit, web export, migration checks, file-size discipline, no residue. Live gate requires separate authorization and disposable customer/owner/inventory fixtures covering all outcomes, race, tenant denial, closure/support/events/fan-out/jobs/reconciliation, Phase 5 public-read regression, and zero-residue cleanup.

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

Every state-changing row requires idempotency, expected version, one transition row, one canonical event, and atomic audit/notification/task effects.

| Command | From -> To | Actor/guards | Inventory/timer | Event/notification |
|---|---|---|---|---|
| submit | active cart -> submitted | Customer; all new-request guards | No hold; reminder/expiry tasks | submitted; customer + owners |
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
| support extend | eligible active -> same | Support/admin/reason/policy | Replace task only | support intervened |

Non-transition: `request_platform_support` requires owner/nonterminal/version and atomically creates internal event, owner audit, deduplicated ops task, optional owner acknowledgement, with no commercial mutation.

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
| `inventory_holds` | store/inventory/request/item, soft/firm, active/released/converted, quantity/version/expiry/release reason/command | Unique active request item; inventory/status/expiry and request/status; no direct client |
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
  final_subtotal_minor INTEGER NULL CHECK >= 0
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK >= 0
  fee_minor INTEGER NOT NULL DEFAULT 0 CHECK >= 0
  final_total_minor INTEGER NULL CHECK >= 0
  money_calculator_version INTEGER NOT NULL
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
| `submit_order_request` | cart ID, fulfilment, private contact/address if required, policy acceptance, expected version | user/store/prices/policies/totals/deadlines; request/version |
| `start_store_review` | request ID, expected version | actor/store/capability; request/version |
| `request_clarification` | request ID, item IDs, bounded reasons, private prompts, expected version | store/deadline; safe request projection |
| `provide_clarification` | request ID, bounded response fields, expected version | customer/store; safe request projection |
| `confirm_full` | request ID, item confirmed quantities/prices at or below bound, expected version | totals/holds/store; payment-ready request/version |
| `confirm_partial` | request ID, item outcomes/quantities/prices/reasons, expected version | totals/soft holds/deadline; decision request/version |
| `mark_items_unavailable` | request ID, item IDs/reason codes, expected version | store/outcome; request/version |
| `reject_order_request` | request ID, rejection reason, optional private bounded note, expected version | store; terminal request/version |
| `accept_confirmed_changes` | request ID, explicit accepted result version, pickup choice when required, expected version | user/final totals/hold promotion; payment-ready request/version |
| `cancel_order_request` | request ID, bounded reason, expected version | user/release; terminal request/version |
| `request_platform_support` | request ID, support reason, optional private bounded note, expected version | owner/task/event/audit; same status/new support/request version |
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
| 409 | `STALE_VERSION`, `INVALID_STATE_TRANSITION` | State/version conflict |
| 409 | `IDEMPOTENCY_KEY_REUSED`, `COMMAND_IN_PROGRESS` | Idempotency conflict |
| 409 | `CROSS_STORE_REPLACEMENT_REQUIRED` | Explicit token flow required |
| 409 | `INSUFFICIENT_INVENTORY`, `PRICE_BOUND_EXCEEDED`, `HOLD_EXPIRED` | Commerce guard failed |
| 410 | `REQUEST_WINDOW_EXPIRED` | Deadline passed |
| 422 | `POLICY_CONFIGURATION_INVALID`, `STORE_SCHEDULE_INVALID` | Server configuration blocks safely |
| 423 | `COMMERCE_ROLLOUT_DISABLED` | Flag/locality/allowlist blocks progression |
| 500 | `COMMERCE_COMMAND_FAILED` | Sanitized unexpected failure |

---

## Appendix F. Approval Record

Stage 1 was approved on 2026-07-16 with anonymous database-policy compatibility/sign-in-first routing, distinct rejection, non-transitioning support request, differentiated closure/suspension, worked SLA examples, owner-only MVP entitlement, minimum customer identity, pickup-or-cancel, no partial revision, owner-paused listing continuation, and provider-independent `payment_ready` incorporated here.

The next gate is explicit approval of this SDD. Production implementation remains prohibited until that approval.