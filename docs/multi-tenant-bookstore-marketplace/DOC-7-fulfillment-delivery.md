# DOC-7: Fulfillment and Delivery

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1, DOC-2, DOC-6
**Owns:** Pickup, third-party delivery orchestration, quote timing, provider adapter model, store readiness, shipment states, delivery exceptions, and delivery privacy boundaries.

---

## 1. Purpose

This document defines fulfillment after a store confirms availability and the customer pays.

BookConnect acts as marketplace facilitator. Bookstores sell the books. BookConnect coordinates delivery through third-party delivery partners where delivery is available, and supports customer pickup where delivery is unavailable or not preferred.

Delivery must be designed as an orchestration layer, not hardcoded to a single provider.

---

## 2. Fulfillment Modes

| Mode | Description | MVP |
|---|---|---|
| `store_pickup` | Customer picks up from bookstore. | Yes |
| `third_party_delivery` | BookConnect books delivery through a delivery partner. | Yes |
| `store_managed_delivery` | Store delivers using its own staff. | Deferred |
| `postal_shipping` | Store ships through courier/postal network. | Deferred |

MVP should support pickup and third-party local delivery.

---

## 3. Delivery Principles

- Quote before payment; book delivery after payment and store readiness.
- Never expose delivery provider credentials to mobile clients.
- Do not share customer address with the store or delivery partner before it is needed.
- Recalculate quote after partial availability.
- Treat delivery as a state machine with provider webhooks and internal audit events.
- Keep provider integration behind a server-side adapter.
- Allow pickup fallback when delivery is not serviceable.
- Do not promise delivery during store closed hours unless the store has explicitly prepared the package.
- Model Indian aggregator states such as NDR, RTO, failed pickup, weight dispute, and provider billing adjustment explicitly.

---

## 4. Delivery Quote Timing

Delivery is evaluated in three stages.

| Stage | Timing | Purpose |
|---|---|---|
| Estimate | Before order request submission. | Tell customer whether delivery may be possible. |
| Final quote | After store confirms availability. | Show exact payable delivery fee before payment. |
| Booking | After payment and store readiness. | Create actual shipment with delivery partner. |

The final quote must include expiry time. If the customer pays after quote expiry, the system must re-quote before payment.

If the delivery quote changes materially after payment because of provider failure, platform operations must decide whether to absorb the difference, reassign provider, or cancel/refund.

---

## 5. Minimum Delivery Value

Delivery minimums should be policy-driven.

Inputs:

- store location
- customer delivery address
- confirmed book subtotal
- provider serviceability
- delivery fee
- store operating hours
- platform campaign rules

If confirmed subtotal is below minimum:

- show pickup as preferred option
- allow delivery with additional fee only if platform policy permits
- do not hide the reason from the customer

Minimum delivery rules should live in platform configuration, not in mobile code.

---

## 6. Store Readiness Flow

After payment:

```text
Paid order
  -> store receives fulfillment task
  -> store picks books from shelf
  -> store packs order
  -> store marks ready
  -> pickup code generated or delivery booking starts
```

Store readiness fields:

- packed item count
- package notes
- pickup instructions
- estimated ready time
- store readiness timestamp

The store should not be able to mark ready if the paid order still has unavailable items requiring platform or customer action.

---

## 7. Pickup Flow

Pickup should be simple and verifiable.

Customer flow:

1. pays for confirmed order
2. receives pickup instructions
3. receives pickup code
4. visits store during pickup window
5. shows pickup code
6. store marks order picked up

Store flow:

1. sees paid pickup order
2. packs books
3. marks ready for pickup
4. verifies pickup code at handoff
5. marks picked up

Pickup code should be short-lived enough to prevent misuse but valid across the pickup window.

---

## 8. Third-Party Delivery Flow

```text
Paid delivery order
  -> store packs order
  -> store marks ready
  -> BookConnect requests provider booking
  -> provider assigns rider/courier
  -> courier picks up from store
  -> courier delivers to customer
  -> provider webhook confirms delivery
  -> order marked delivered/completed
```

Delivery booking should be delayed until the store marks ready unless the provider supports scheduled pickup reliably.

Reasons:

- small stores may need time to locate used books
- delivery partners may charge waiting or cancellation fees
- provider pickup before package readiness creates bad customer and store experience

---

## 9. Provider Adapter

All providers must be hidden behind a common server-side adapter.

Required adapter operations:

- check serviceability
- get quote
- create shipment
- generate label/manifest if provider requires it
- cancel shipment
- fetch shipment status
- raise or sync NDR action
- request reattempt where supported
- handle RTO status
- record weight/billing discrepancy
- handle webhook
- normalize provider status
- store raw provider payload privately

The app must consume only normalized BookConnect delivery states.

Provider-specific secrets, tokens, signing keys, webhook validation, and retries must stay server-side.

---

## 10. Shipment States

Recommended normalized shipment states:

| State | Meaning |
|---|---|
| `not_required` | Pickup order; no shipment. |
| `quote_requested` | Delivery estimate/quote is being requested. |
| `quote_available` | Quote available for customer review. |
| `booking_pending` | Paid order waiting for provider booking. |
| `booked` | Provider accepted shipment. |
| `pickup_scheduled` | Provider scheduled pickup. |
| `courier_to_store` | Courier heading to bookstore. |
| `picked_up` | Package collected from store. |
| `in_transit` | Package moving through provider network. |
| `out_for_delivery` | Courier approaching customer. |
| `delivered` | Delivery completed. |
| `failed_delivery` | Delivery failed. |
| `ndr_open` | Non-delivery report requires action or customer/store response. |
| `reattempt_scheduled` | Delivery reattempt scheduled. |
| `rto_initiated` | Return-to-origin started. |
| `returned_to_store` | Package returned to bookstore. |
| `cancelled` | Shipment cancelled. |
| `weight_dispute` | Provider billing/weight discrepancy requires reconciliation. |
| `lost_or_damaged` | Provider exception requiring platform review. |

Provider statuses must map into these states.

---

## 11. Delivery Exceptions

| Exception | Handling |
|---|---|
| Provider unavailable after payment | Reassign provider or platform review. |
| Store not ready at pickup | Delay pickup, notify customer, track store reliability. |
| Courier cannot find store | Store contact through masked/provider channel. |
| Customer unavailable | Provider retry policy; then return to store or platform review. |
| Package damaged | Platform dispute workflow. |
| Package lost | Provider claim and customer refund/replacement workflow. |
| Address invalid | Customer correction before booking where possible. |
| Delivery fee changes | Re-quote before payment; after payment, platform ops decides. |
| Pickup failed | Reschedule pickup if store/package readiness is valid; otherwise platform review. |
| NDR raised | Follow provider NDR workflow; notify customer/store only with needed action. |
| RTO initiated | Track return-to-store and link to refund/dispute policy. |
| Weight discrepancy | Reconcile provider billing and decide whether store/platform absorbs adjustment. |

Exception handling must preserve customer trust even when provider operations fail.

---

## 12. Delivery Cost and Liability Matrix

The implementation must not defer liability ownership until after delivery launch. Exact commercial rules require business/legal/provider review, but the system must model who caused the issue, who pays initially, and who may be charged or credited later.

Default planning matrix:

| Case | Initial Customer Handling | Default Internal Owner | Required System Output |
|---|---|---|---|
| Provider unavailable before payment | Re-quote, pickup option, or cancel. | No charge. | Quote failure event. |
| Provider unavailable after payment | Platform review; customer gets delay/cancel/refund path. | Platform/provider review. | Delivery exception case. |
| Store not ready for pickup | Delay/reschedule or customer cancellation if severe. | Store fault unless provider/platform caused issue. | Store reliability event. |
| Failed pickup due to provider | Reschedule or reassign. | Provider/platform review. | Provider escalation record. |
| Customer unavailable/NDR | Reattempt or RTO by policy. | Customer/policy. | NDR action task. |
| RTO due to customer non-response | Refund policy may exclude delivery fee where allowed. | Customer/policy. | RTO and refund decision record. |
| Package lost/damaged in transit | Customer trust response first: refund/replacement/partial resolution. | Provider/platform claim. | Dispute/provider claim case. |
| Weight/billing discrepancy | No surprise customer charge after payment without policy approval. | Store/platform/provider review. | Reconciliation case. |

DOC-15 owns financial settlement, reversals, reserves, and delivery cost adjustments.

---

## 13. Packaging and Handoff

Bookstores need lightweight but clear packing rules:

- pack books so corners and covers are protected
- include order identifier or label
- include no unrelated customer PII inside the package
- mark fragile/special handling only if provider supports it
- verify item count before handoff

At courier pickup:

- store confirms courier identity or pickup code
- courier confirms package pickup
- timestamp and event are recorded

---

## 14. Delivery Privacy

Customer address and phone are sensitive.

Rules:

- show full delivery address to store only when needed for fulfillment, if business process requires it
- share customer address with delivery provider only after payment and booking
- prefer masked phone/contact relay where provider supports it
- do not store provider rider personal data beyond operational need
- do not log customer address or phone in client-accessible logs
- delivery webhooks must be verified server-side

---

## 15. Data Model

```text
store_delivery_settings
  id
  store_id
  pickup_enabled
  third_party_delivery_enabled
  min_delivery_order_value_minor
  packing_time_minutes
  pickup_instructions
  delivery_notes
  created_at
  updated_at

delivery_quotes
  id
  order_request_id
  store_id
  user_id
  delivery_address_id
  provider
  quote_amount_minor
  serviceable
  min_order_value_minor
  estimated_pickup_at nullable
  estimated_delivery_at nullable
  expires_at
  raw_provider_payload private
  created_at

delivery_shipments
  id
  store_order_id
  store_id
  provider
  provider_shipment_id nullable
  status
  pickup_address_snapshot
  delivery_address_snapshot private
  quoted_amount_minor
  final_amount_minor nullable
  tracking_url nullable
  awb nullable
  label_url nullable
  provider_billing_weight nullable
  declared_weight nullable
  booked_at nullable
  picked_up_at nullable
  delivered_at nullable
  created_at
  updated_at

delivery_tracking_events
  id
  shipment_id
  provider
  provider_status
  normalized_status
  message nullable
  raw_payload private
  occurred_at
  created_at

delivery_exception_cases
  id
  shipment_id
  store_order_id
  exception_type
  status
  provider_reference nullable
  required_action nullable
  resolution nullable
  notes private
  created_at
  updated_at

pickup_codes
  id
  store_order_id
  store_id
  user_id
  code_hash
  status
  expires_at
  verified_at nullable
  created_at
```

---

## 16. Third-Party Delivery Considerations

Before selecting delivery partners, BookConnect should evaluate:

- serviceable cities/localities
- pickup from small retail stores
- API maturity and webhook quality
- quote expiry behavior
- cancellation and waiting charges
- NDR and reattempt workflow quality
- RTO workflow and charges
- pickup failure handling
- weight discrepancy/billing adjustment process
- proof of pickup and proof of delivery
- support for scheduled pickup
- support for customer/rider masked calling
- insurance or loss/damage claims process
- reverse logistics for returns
- settlement and invoicing model
- data processing terms and privacy obligations
- operational support escalation
- peak-time reliability

The right integration is likely provider-agnostic at first, because coverage and reliability can differ by city.

---

## 17. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| FUL-01 | Customer can choose pickup or delivery where available. |
| FUL-02 | Delivery estimate is shown before request and final quote before payment. |
| FUL-03 | Delivery booking occurs only after payment and store readiness. |
| FUL-04 | Store can mark paid order ready for pickup or delivery. |
| FUL-05 | Pickup orders use a pickup verification code. |
| FUL-06 | Delivery provider integration is server-side and adapter-based. |
| FUL-07 | Provider webhooks update normalized shipment states. |
| FUL-08 | Customer address is shared only when operationally required. |
| FUL-09 | Delivery exceptions produce platform-reviewable events. |
| FUL-10 | NDR, RTO, failed pickup, lost/damaged, and weight dispute cases are modeled as first-class exceptions. |
| FUL-11 | Delivery exception cases record initial customer handling, likely fault, and financial owner/reconciliation path. |

---

## 18. Deferred Items

- store-managed delivery
- postal shipping
- multi-provider automated optimization
- customer courier selection
- same-day delivery guarantees
- reverse pickup for returns
- cash on delivery
- live map tracking

---

## 19. Related Documents

- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-8: Store Owner Console](./DOC-8-store-owner-console.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
