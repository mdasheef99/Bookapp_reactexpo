# SDD 06: Customer Current-Copy Photo Request Extension

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

## 1. Decision

Allow a customer to request 1–3 new current-copy photos for a specific order-request item. Once requested, photos are mandatory for that item: the store must provide them before confirming it, and the customer must accept the provided photos before the request can become `payment_ready`. If the store cannot provide them, the item is unfulfilled/unavailable for that request.

This is an orthogonal item-level substate integrated with the existing Phase 6 `awaiting_customer_decision` path. It does not add payment-provider, paid-order, pickup, refund, ledger, or settlement behavior.

## 2. Product behavior

- Customer requests current-copy photos before submitting, or as part of, the unpaid order request.
- The request is for one listing/request item and one current physical copy/compatible quantity decision.
- Existing canonical covers and public damage/copy photos do not automatically fulfill it.
- Store uploads 1–3 new photos after the photo request timestamp.
- Store still reviews availability/quantity/condition under Phase 6.
- Customer sees photos and explicitly accepts or declines the item/confirmed result.
- No proceed-without-photo option exists for a requested item.
- If the store reports the copy unavailable or cannot provide photos, that item is unavailable/unfulfilled and excluded from payable items.
- Repeated failures feed listing freshness/review/pause policy.

## 3. Item photo state

Recommended orthogonal state:

| State | Meaning |
| --- | --- |
| `none` | No photo requested. |
| `requested` | Customer requested photos; store has not started/provided. |
| `uploading` | Store has authorized in-progress uploads; not customer-visible as complete. |
| `provided` | 1–3 sanitized private photos are linked; customer decision required. |
| `accepted` | Customer accepted the provided current-copy photos and confirmed result. |
| `declined` | Customer declined/withdrew this item. |
| `unfulfilled` | Store cannot provide required photos or item is not available. |
| `expired` | Applicable clarification/decision/request deadline expired. |

State is versioned and server-controlled. Uploading bytes alone does not enter `provided`; all required media must validate and the store must submit the photo response command.

## 4. Phase 6 request seam

### Submission

- Cart/request item snapshots `photo_requested` and the applicable policy/version.
- Request submission remains unpaid `submitted` and creates no hold merely because a photo was requested.
- Customer copy states that the store must provide requested photos before confirmation and payment.

### Store review

- A requested item cannot be submitted as `confirmed_full`/`confirmed_partial` until photo state is `provided`.
- Store may:
  - upload/provide photos and confirm availability;
  - mark the item unavailable;
  - mark photo request unfulfilled with a bounded reason;
  - request platform support without changing status.
- No “photos unavailable but continue” outcome exists.

### Customer decision

- A request containing a provided-photo item enters/uses `awaiting_customer_decision`, even if quantities/prices are otherwise unchanged.
- Phase 6 creates the appropriate soft holds only when the store submits a valid confirmation outcome.
- Customer acceptance atomically records photo acceptance/current request version, promotes eligible holds, and can enter `payment_ready` if every other guard passes.
- Customer decline makes the item unavailable/withdrawn for the payable result and releases/recalculates eligible holds/amounts.
- `payment_ready` guard requires every requested, included item to have `photo_state = accepted`.

### Expiry/cancellation

- Existing Phase 6 customer-decision/clarification/request expiry remains authoritative.
- Cancellation/expiry releases eligible holds and moves nonterminal photo states to expired/cancelled evidence as appropriate.
- The photo substate does not extend deadlines silently; any policy extension uses existing authorized support behavior.

## 5. Store Owner experience

Order item shows:

- “Customer requested current-copy photos” badge;
- requested count/instructions, bounded by policy;
- capture/upload action, camera and gallery where permitted;
- 1–3 sanitized preview thumbnails;
- replace/remove before final response;
- Provide photos and confirm;
- Cannot provide / Item unavailable;
- deadline and support action.

The store must photograph the actual intended copy after the request. It cannot link a scan image, another customer's private request image, or an unrelated inventory photo by supplying a path.

## 6. Customer experience

Customer sees:

- store/listing/item identity;
- 1–3 private current-copy photos;
- capture/provided timestamp bucket or friendly freshness indication;
- confirmed condition, damage disclosure, quantity, price, and fulfillment result;
- Accept photos and confirmed item;
- Decline/remove item or cancel according to Phase 6 behavior.

Photos use short-lived authorized access. URLs/tokens are not persisted in local storage, analytics, events, or notifications. Push notifications state that photos are ready without embedding them.

## 7. Media and authorization

Customer-request photos are request-scoped evidence created after inventory identity. They never participate in duplicate matching, quantity compatibility, or inventory-row separation. Public actual-copy/damage media remains a separate copy-specific signal.

- Purpose is `customer_request` and privacy class is private request evidence.
- Upload authorization binds final `store_id`, request ID, request item ID, photo request ID, uploader, sequence, and expiry.
- Capture time must be after the photo request; server upload time is authoritative evidence. Device capture time may be stored only as untrusted/supporting metadata after EXIF stripping.
- Store A cannot upload/read/delete Store B request photos.
- Customer can read only their own request-item photos.
- Owner may replace/remove before final `provided`; after provision/acceptance, deletion follows lifecycle/hold commands, not ordinary direct owner deletion.
- Platform access is action-specific for support/dispute, not broad finance/reviewer access.
- Public listing and search projections contain no request-photo IDs, paths, or URLs.

## 8. Command contracts

Conceptual commands:

```text
request_item_photos(request_item_id, expected_request_version, count, idempotency)
authorize_request_photo_upload(photo_request_id, expected_version, sequence)
provide_item_photos(photo_request_id, media_ids, expected_version, confirmation_input, idempotency)
mark_photo_request_unfulfilled(photo_request_id, expected_version, reason, idempotency)
accept_photo_confirmation(request_id, expected_version, accepted_item_ids, idempotency)
decline_photo_confirmation(request_id, expected_version, item_ids, idempotency)
```

Every command derives actor and final store/customer scope server-side, validates current commerce/photo state, uses bounded inputs, emits safe events/audit where needed, and returns an idempotent canonical result.

## 9. Data and events

Proposed data is described in the data dictionary:

- `order_request_photo_requests` item-level state/version/policy/timestamps/reason;
- `order_request_media_links` private sequence and media IDs;
- request/cart item snapshot fields for requested policy/count;
- safe customer/owner read projections without raw object paths.

Minimum events/notifications:

- `order_request_item.photos_requested`;
- `order_request_item.photos_provided`;
- `order_request_item.photos_accepted`;
- `order_request_item.photos_declined`;
- `order_request_item.photos_unfulfilled`;
- `order_request_item.photos_expired`.

Raw events are not client-readable. Notifications contain no signed URL, image, customer PII, or private note.

## 10. Retention

| Outcome | Default retention |
| --- | --- |
| Failed/unattached upload | 24 hours |
| Unpaid request cancelled/rejected/expired/unfulfilled | 30 days |
| Customer declined before payment | 30 days |
| Completed transaction | 180 days from completion |
| Dispute | until resolved + 30 days or normal longer rule |
| Legal/security hold | until released |

Before Phase 7 paid-order implementation, Phase 9 can implement the unpaid lifecycle and retain the future completed-transaction policy fields without pretending transaction completion exists. The 180-day baseline requires legal review before production.

Deletion removes object bytes while retaining bounded request/media/deletion audit metadata. A later order/dispute reference prevents premature deletion.

## 11. Repeated failure and listing freshness

Record internal metrics:

- request-to-provided duration;
- unfulfilled/expired rate by listing/store;
- customer decline rate;
- request after `last_verified_at` age;
- mismatch/wrong-copy/support reports.

Policy may:

- mark listing needs review;
- require inventory reverification;
- pause a listing after configured repeated unfulfilled/current-copy failures;
- create a platform support/moderation task.

Do not expose an unexplained public reliability score in Phase 9.

## 12. Failure behavior

| Failure | Behavior |
| --- | --- |
| One of multiple uploads fails validation | Keep validated staging photos editable; do not enter provided until 1–3 valid photos submitted. |
| Store cannot locate/capture item | Mark unfulfilled/unavailable; no payment readiness. |
| Customer access expired | Reauthorize after final request/customer check; do not reuse old URL. |
| Customer does not decide | Existing decision expiry releases holds and expires photo decision. |
| Item/listing changed while photos pending | Stale version; store/customer refresh and re-evaluate. |
| Object missing after provided | Fail closed, remove item from payment-ready eligibility, create ops/repair signal. |
| Store tries unrelated media ID/path | Reject final link authorization. |

## 13. Security and privacy tests

- customer A/B and Store A/B access/link/upload/delete denial;
- pre-request/reused scan/public/other-request media rejection;
- capture/upload timestamp and 1–3 limit;
- unvalidated/missing object cannot become provided;
- signed URL not logged/persisted and final authorization checked;
- no public projection/request notification leakage;
- accepted/unfulfilled/declined/expired races and idempotency;
- soft/firm hold and amount recalculation compatibility;
- `payment_ready` denial without accepted requested photos;
- retention/hold/deletion/recovery.

## 14. Acceptance criteria

| ID | Criterion |
| --- | --- |
| PHO-01 | Customer can request photos for a specific unpaid request item. |
| PHO-02 | Requested photos must be newly uploaded after the request and linked to the intended item. |
| PHO-03 | At least one and at most three validated photos can be provided. |
| PHO-04 | Store cannot confirm a requested-photo item before photos are provided. |
| PHO-05 | Request cannot enter `payment_ready` until every included requested-photo item is accepted. |
| PHO-06 | No proceed-without-photo outcome exists. |
| PHO-07 | Store inability to provide photos makes the item unfulfilled/unavailable and releases/recalculates holds/amounts. |
| PHO-08 | Existing Phase 6 customer-decision, expiry, cancellation, version, idempotency, event, and audit invariants are preserved. |
| PHO-09 | Request media remains private to the request customer/store/authorized support role. |
| PHO-10 | Request media never appears in public marketplace or notifications. |
| PHO-11 | Retention/deletion/holds follow the outcome lifecycle. |
| PHO-12 | Repeated failures can trigger listing freshness/review/pause policy. |
| PHO-13 | No payment-provider, paid-order, pickup, refund, ledger, or settlement implementation is introduced. |
| PHO-14 | Private request-photo evidence never affects inventory duplicate identity, quantity compatibility, or row separation. |

## 15. Deferred

- customer video/live-call proof;
- automated visual comparison to the scan/listing;
- public reliability score;
- transaction/dispute UI owned by deferred later phases;
- AI damage adjudication from customer request photos.
