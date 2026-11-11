# SDD 01, part 2: Checkout commands

**Part of SDD 01.** Section numbers are those of the whole SDD, so a reference such as
"SDD 01 §5.3" means §5.3 in whichever part holds it. The map is in the
[overview](./01-0-overview.md). The full single-file copy
[01-checkout-reservation-sdd.md](../01-checkout-reservation-sdd.md) is kept for reference
only; build from these parts.

---

## 5. Checkout commands

Every command returns JSONB and is replay-safe. Customer commands use
`claim_phase6_command` with their actor, key and command ID. Every timer command in §5 and
§6 uses `claim_commerce_timer_command` and `complete_commerce_timer_command` (§8.1), with
the task ID as its command ID and no actor or expected version. §5.0 gives every exact
contract. Guards run in the order listed; the first that fails raises its code and nothing is written. The message
column is what the customer or store sees.

### 5.0 Command contracts

This table is the call contract for §5 and §6 and the shared commands exported in §20.
All answers are JSONB. `UUID`, `INTEGER`, `BOOLEAN`, `TEXT` and `TIMESTAMPTZ` in an answer
describe JSON values; timestamps are ISO 8601 strings. `TIMESTAMPTZ_OR_NULL` means a timestamp string or JSON null. Parameters have no implicit defaults. Nullable inputs are passed explicitly:
delivery address and quote for pickup, termination time when not needed, and a photo
rejection reason on approval. The saved contact may contain the optional email (D-50);
it never comes from a notice payload.
`p_items` is an array of `{"order_item_id":UUID,"quantity":INTEGER}`;
`p_shown_prices` is an array of `{"cart_item_id":UUID,"unit_price_minor":INTEGER}`.
Photo `p_decision` is `approve` or `reject`; missing-book outcomes are in §6.2.
SQL refusals use the section's code and message and roll back all effects.

Versioned customer and store commands use `claim_phase6_command` with the authenticated
actor. SDD 08 supplies its checked admin actor to the admin command claim; a client-supplied
actor is never trusted. Internal commands use the caller's checked command identity. A
command that writes the same event type for several rows derives one child command ID and
event key per row (§5.7).
An idempotency replay returns the stored answer before re-checking a changed version.
A no-op records no event, notice, refund or new task. An already resolved worker task
also records no completion or new command answer (§8.1).

For every time comparison under locks, read `clock_timestamp()` after all required locks
are taken. Never use `now()`, `transaction_timestamp()` or a time saved before a lock wait.
This includes provider-read freshness, action deadlines, timer due checks and recovery
windows. A timer acts only at or after its due time, with the matching status and due column.

| Command | Schema | Exact parameters | Idempotency inputs | JSON answer | No-op answer |
|---|---|---|---|---|---|
| `create_reservation` | `public` | `(p_cart_id UUID, p_expected_version INTEGER, p_fulfillment_method TEXT, p_contact_snapshot JSONB, p_delivery_address_snapshot JSONB, p_delivery_quote_id UUID, p_customer_note TEXT, p_shown_prices JSONB, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; cart and all business parameters hashed. | `{"outcome":"reserved","request_id":UUID,"version":INTEGER,"reservation_expires_at":TIMESTAMPTZ,"final_subtotal_minor":INTEGER,"final_delivery_tariff_minor":INTEGER,"final_total_minor":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `cancel_reservation` | `public` | `(p_request_id UUID, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; checkout hashed. | `{"outcome":"cancelled","request_id":UUID,"status":"customer_cancelled","version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `expire_reservation` | `public` | `(p_request_id UUID, p_task_due_at TIMESTAMPTZ, p_provider_checked_at TIMESTAMPTZ, p_provider_terminated_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":TEXT,"request_id":UUID,"status":TEXT,"version":INTEGER,"payment_grace_expires_at":TIMESTAMPTZ_OR_NULL}` | `{"outcome":"noop"}`; replay returns stored answer. |
| `expire_payment_grace` | `public` | `(p_request_id UUID, p_task_due_at TIMESTAMPTZ, p_provider_checked_at TIMESTAMPTZ, p_provider_terminated_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":TEXT,"request_id":UUID,"status":TEXT,"version":INTEGER,"payment_grace_expires_at":TIMESTAMPTZ_OR_NULL}` | `{"outcome":"noop"}`; replay returns stored answer. |
| `convert_paid_checkout` | `marketplace_sec` | `(p_request_id UUID, p_payment_id UUID, p_paid_at TIMESTAMPTZ, p_command_id UUID)` | Verified payment ID, checkout ID and command ID; unique order/payment and refund key. | `{"outcome":"converted","order_id":UUID}` or `{"outcome":"conversion_failed","reason":TEXT}` | Existing order/refund answer; no second effect. |
| `resolve_late_payment` | `marketplace_sec` | `(p_request_id UUID, p_payment_id UUID, p_paid_at TIMESTAMPTZ, p_command_id UUID)` | Verified payment ID, checkout ID and command ID; unique order/payment and refund key. | `{"outcome":"converted","order_id":UUID}` or `{"outcome":"refund_requested","payment_id":UUID}` | Existing order/refund answer; no second effect. |
| `cancel_for_store_ineligibility` | `marketplace_sec` | `(p_store_id UUID, p_reason_code TEXT, p_command_id UUID)` | Pause command ID; server-read store checkouts; state guards. | `{"outcome":"applied","request_ids":UUID[]}` | `{"outcome":"noop"}` when no unpaid live checkout remains. |
| `requeue_checkout_timer` | `marketplace_sec` | `(p_task_id UUID, p_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; source task and reason hashed; source replacement pointer. | `{"outcome":"requeued","task_id":UUID,"replacement_task_id":UUID}` | Same answer with the recorded replacement ID; no new task. |
| `resolve_failed_conversion` | `marketplace_sec` | `(p_request_id UUID, p_action TEXT, p_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; checkout, action and reason hashed; payment read on server. | `{"outcome":"converted","order_id":UUID}`; `{"outcome":"conversion_failed","reason":TEXT}`; `{"outcome":"refund_requested","payment_id":UUID}` | Stored answer on replay; `{"outcome":"noop"}` if the case was already resolved. |
| `accept_order` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `report_missing_books` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_items JSONB, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `record_missing_outcome` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_outcome TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `report_order_unavailable` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `cancel_paid_order` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `send_requested_photos` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `respond_to_photos` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_decision TEXT, p_reject_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `expire_missing_outcome` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_photo_send` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_photo_check` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `send_acceptance_reminder` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `escalate_acceptance` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_unaccepted_order` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `alert_unprepared_order` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_unprepared_order` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `mark_order_ready` | `marketplace_sec` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Checked SDD 06/07 caller, key, command ID; order and version hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `acknowledge_store_alert` | `public` | `(p_order_id UUID, p_idempotency_key TEXT, p_command_id UUID)` | Owner, key, command ID; order hashed. | `{"outcome":"acknowledged","order_id":UUID,"store_alert_delivered_at":TIMESTAMPTZ}` | Existing fact in the same answer shape; no second write. |
| `restock_order_item` | `marketplace_sec` | `(p_order_item_id UUID, p_quantity INTEGER, p_outcome TEXT, p_movement_key TEXT)` | Unique movement key; quantity and outcome match the recorded movement. | `{"outcome":"moved","movement_id":UUID}` | `{"outcome":"noop","movement_id":UUID}` on a recorded movement. |
| `set_commerce_pause` | `marketplace_sec` | `(p_scope TEXT, p_store_id UUID, p_kind TEXT, p_reason_code TEXT, p_note TEXT, p_command_id UUID)` | Command ID and the uncleared scope/store/kind unique key. | `{"outcome":"set","pause_id":UUID}` | Existing pause ID in the same answer shape. |
| `clear_commerce_pause` | `marketplace_sec` | `(p_pause_id UUID, p_reason TEXT, p_command_id UUID)` | Command ID and pause ID; checked caller from the owning path. | `{"outcome":"cleared","pause_id":UUID}` | `{"outcome":"noop","pause_id":UUID}` when already cleared. |
| `set_store_self_pause` | `public` | `(p_store_id UUID, p_paused BOOLEAN, p_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Owner, key, command ID; store, switch and reason hashed. | `{"outcome":"applied","store_id":UUID,"paused":BOOLEAN}` | Same switch answer when already in that state. |
| `record_platform_incident` | `marketplace_sec` | `(p_kind TEXT, p_started_at TIMESTAMPTZ, p_note TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; kind, start and note hashed. | `{"outcome":"recorded","incident_id":UUID}` | Stored answer on replay; no second incident. |
| `end_platform_incident` | `marketplace_sec` | `(p_incident_id UUID, p_ended_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; incident and end hashed. | `{"outcome":"ended","incident_id":UUID}` | Stored answer on replay; `{"outcome":"noop","incident_id":UUID}` when already ended. |

### 5.1 `create_reservation` (customer)

`public.create_reservation(p_cart_id UUID, p_expected_version INTEGER, p_fulfillment_method
TEXT, p_contact_snapshot JSONB, p_delivery_address_snapshot JSONB, p_delivery_quote_id
UUID, p_customer_note TEXT, p_shown_prices JSONB, p_idempotency_key TEXT, p_command_id
UUID)`. `p_shown_prices` lists each cart item's ID and the price the screen showed; it is only
compared, never charged. This command replaces `submit_order_request`, which is closed to new
carts as §15 says.

| # | Guard | Code | Message |
|---|---|---|---|
| 1 | Caller is signed in | `AUTHENTICATION_REQUIRED` | Please sign in. |
| 2 | Cart belongs to the caller, is `active`, not expired, version matches | `COMMERCE_ENTITY_UNAVAILABLE` / `STALE_VERSION` | Your cart has changed. Please review it. |
| 3 | Cart has at least one item and every item is from the cart's store (Q33) | `COMMERCE_ENTITY_UNAVAILABLE` | Your cart has changed. Please review it. |
| 4 | No live checkout exists for this cart | `RESERVATION_ALREADY_OPEN` | You already have a payment in progress for this cart. |
| 5 | Under the customer transaction advisory lock (§7): caller is under the attempts-per-hour and live-checkout caps; check paid orders today (India date) only if `commerce.customer_daily_paid_order_limit` is set (default off, D-56) | `RESERVATION_LIMIT_REACHED` | Too many attempts. Please try again later. |
| 6 | No uncleared platform pause with `blocks_new_orders` | `PLATFORM_PAUSED` | Online orders are paused for now. Please try again later. |
| 7 | Store passes `evaluate_reservation_eligibility` (§15): active, verified, set up, allowed to sell; subscription allowed; rollout flags and allowlist on; an entitled active owner exists; the schedule engine finds an open day within `commerce.schedule_horizon_days` (§4); and it has the online-payment permission (new entitlement `commerce_online_payment_enabled`, set by SDD 05) | `STORE_NOT_ACCEPTING_ORDERS` | This store is not taking online orders right now. |
| 8 | No uncleared store pause with `blocks_new_orders` | `STORE_NOT_ACCEPTING_ORDERS` | This store is not taking online orders right now. |
| 9 | Contact snapshot has a valid Indian mobile number (D-50) | `PHONE_REQUIRED` | Please add your phone number. |
| 10 | Method is `pickup`, or `delivery` once SDD 07 is live | `DELIVERY_NOT_AVAILABLE_YET` | Delivery is not available yet. Please choose pickup. |
| 11 | Delivery only, once SDD 07 is live: pincode served and a quote valid under SDD 07's rules (D-18, BC-22). Until then guard 10 refuses delivery first | `DELIVERY_NOT_SERVICEABLE` / `DELIVERY_QUOTE_UNAVAILABLE` | We cannot deliver to this address. / We could not get a delivery price. You can choose pickup. |
| 12 | Every listing is `active`, moderation `approved`, and from the cart's store | `ITEM_NOT_AVAILABLE` | One of your books is no longer available. |
| 13 | Book total is at most the cap (D-56) | `ORDER_TOTAL_ABOVE_LIMIT` | Orders are limited to ₹5,000 of books for now. |
| 13a | Order total (`final_total_minor`) is at least `commerce.min_checkout_total_minor` (D-107; Cashfree takes no order under ₹1) | `ORDER_TOTAL_BELOW_MINIMUM` | Orders must be at least ₹{minimum}, using the configured minimum (₹1 by default). |
| 14 | Stock: every item has `quantity_available >= requested_quantity` (checked by taking the hold) | `INSUFFICIENT_INVENTORY` | Someone else just reserved this book. |

A closed store may still take orders, including during a planned closure (D-07), so
opening hours are not a guard. Pickup is always offered (handoff §11 item 15), so
`stores.pickup_enabled`, its policy key and `listing.pickup_available` are not read.

The printed-book rule (D-49) governs what may be listed, so it is enforced when a book is
listed, by the Phase 9 lane (§18). Checkout does not re-check it, and no reliable field
exists today to check it with (§2). It must be in place before live payments.

Locks are taken in the §7 order before the guards that depend on them: guards 2 to 4 under
the cart lock, guard 5 under the customer advisory lock taken first, guards 7 and 8
under the store lock (`FOR SHARE`), guards 12 to 14 under stock rows in ID order, then
listings. The full order is customer advisory lock, payment, cart, store, checkout, order,
stock rows in ID order, listings (§7). Effects, in the same transaction:

- Price per item is the listing's current `selling_price_minor` read under the lock. The
  cart's snapshot price is not used (BC-05, D-11). If any price differs from
  `p_shown_prices`, the command raises `PRICE_CHANGED` ("A price has changed. Please review
  your cart.") and the app refreshes the cart, which now shows the current listing price
  (§15), so the next attempt sends the new price. This replaces Phase 6's lower-of-two rule,
  because the customer must see the exact amount before paying (§17).
- Insert the checkout as `reserved` with `reservation_expires_at = clock_timestamp() + window` read after the locks,
  `final_subtotal_minor`, `final_delivery_tariff_minor` (0 for pickup),
  `final_total_minor`, `money_calculator_version = 2`, `cart_version_at_reservation`.
- Insert the items, the private contact and address snapshot and the seller snapshot, as
  Phase 6 does, and the policy snapshots through a new `snapshot_reservation_policies` with
  the §4 keys. The old function requires delivery-tariff keys that D-36 retires.
- Take one `firm` hold per item (`create_reservation_holds`, §9), expiring at the
  reservation end.
- Leave the cart `active`. While a live checkout exists, every cart-editing command refuses
  with `RESERVATION_ALREADY_OPEN` (§15 lists the cart functions to change).
- Write the event `checkout.reserved`, the creation log and the audit log.
- Open the task `reservation_expiry`, due at `reservation_expires_at`, with
  `source_request_version` set to the checkout's version.
- No notice to the store: it hears about an order only when it is paid.

Answer: checkout ID, version, `reservation_expires_at`, the amounts. The app then calls
SDD 02's "create payment" with the checkout ID.

### 5.2 `cancel_reservation` (customer)

Allowed in `reserved` and `awaiting_payment_result`, only for the checkout's own customer
(otherwise `COMMERCE_ENTITY_UNAVAILABLE`). Takes the required §7 locks, including
payment before checkout, then releases the
holds (`reason = 'customer_cancelled'`), sets `customer_cancelled` with
`closed_reason_code = 'customer'`, resolves the open timers, writes `checkout.cancelled`,
and asks SDD 02 to terminate the Cashfree order by opening the task
`terminate_provider_order` (SDD 02 owns it). If the payment row already shows a verified
success, the command raises `ORDER_ALREADY_PAID` ("Your payment went through. Your order is
placed.") and changes nothing.

### 5.3 `expire_reservation` (timer)

The worker takes these steps, none of them inside a database lock (SDD 02 §7):

1. It asks Cashfree for the order's payments and records the answer.
2. If that shows a success not yet verified, it runs SDD 02's verification and acts on its
   outcome:
   - `paid` (converted, or a failed conversion under §5.10): it stops; the holds stay.
   - `amount_mismatch` (D-29): SDD 02 has refunded that money and terminates the order. It
     is not a payment for this checkout, so the worker continues with step 3, counting that
     attempt as finished.
3. If no attempt is pending, it terminates the Cashfree order (CF-32) and records the
   answer. `TERMINATION_REQUESTED` counts as terminated. If the answer is that a payment
   already succeeded, it runs verification and acts on its outcome as in step 2. When every
   success on the order is a recorded `amount_mismatch`, `duplicate_success` or `reversed`
   and none was counted (D-113), that refusal also counts as terminated, with the time of the answer passed as `p_provider_terminated_at`. Any
   success that still arrives later on that Cashfree order is a duplicate, which Cashfree
   reverses (CF-30): SDD 02 follows its duplicate rule (D-29, D-78), with no order and no
   immediate refund from us; it never reaches §5.6. The worker then
   reads the payments again.
4. It calls `public.expire_reservation(p_request_id, p_task_due_at, p_provider_checked_at,
   p_provider_terminated_at, p_idempotency_key, p_command_id)`.

| Under the checkout lock | Result |
|---|---|
| Checkout is no longer `reserved`, or `p_task_due_at` is not its `reservation_expires_at` | Does nothing |
| A verified success exists | Does nothing; the customer has paid and the holds stay, including while §5.10 resolves a failed conversion |
| Post-lock `clock_timestamp()` is before `reservation_expires_at` | Does nothing; not due yet |
| `p_provider_checked_at` missing or older than the setting (§4), using post-lock `clock_timestamp()` | Raises `PROVIDER_CHECK_STALE`; the task retries; holds stay |
| An attempt is still processing | `awaiting_payment_result`; `payment_grace_expires_at = reservation_expires_at + commerce.payment_grace_seconds`; holds extended to it; task `payment_grace_expiry` opened; event `checkout.payment_pending`, no notice (BC-10) |
| Nothing pending, and `p_provider_terminated_at` missing | Raises `PROVIDER_CHECK_STALE`; the task retries; holds stay |
| Nothing pending, order terminated | Holds released (`reason = 'reservation_expired'`); `reservation_expired`, `closed_reason_code = 'timer'`; emit `checkout.expired` only with no attempt ("You were not charged"); otherwise emit `checkout.payment_not_received` with its §10 wording. A success that arrives later is a late payment (§5.6) |

A "verified success" in these tables is a payment SDD 02 verified for the exact amount. An
attempt recorded as `amount_mismatch` is not one: for the guards it counts as a finished
attempt with no payment, so the checkout closes on its timer as D-29 requires. Its
customer sees `checkout.payment_not_received`, never "You were not charged".

If that grace end is already past when `expire_reservation` runs, it still enters
`awaiting_payment_result`. The new task keeps the past grace end as `due_at` and runs
at once; the worker does not grant another grace.

If Cashfree cannot be read or terminated, the task keeps retrying and the books stay held.
After the task's retries are used up it is dead-lettered and an admin case is opened; the
holds are still not released by guesswork. The way out is §5.9. The customer can also cancel
at any time, which releases the books (§5.2).

### 5.4 `expire_payment_grace` (timer)

Grace is entered only once: only `expire_reservation` enters `awaiting_payment_result`,
and only from `reserved`. This command never extends or restarts the grace.

At grace end the worker takes these steps outside database locks:

1. Read Cashfree's payments and record the answer.
2. If there is a success not yet verified, run SDD 02's verification and act on its outcome
   as §5.3 step 2 says: stop on `paid`; continue to step 3 on `amount_mismatch`.
3. Otherwise terminate the Cashfree order (CF-32), whether an attempt is still processing
   or not. If the answer says a payment already succeeded, verify and act as in step 2.
   `TERMINATION_REQUESTED` counts as terminated, and so does the refusal described in §5.3
   step 3 when every success is a recorded `amount_mismatch`, `duplicate_success` or
   `reversed` and none was counted (D-113). Then read the payments again.
4. Call `public.expire_payment_grace(p_request_id, p_task_due_at, p_provider_checked_at,
   p_provider_terminated_at, p_idempotency_key, p_command_id)`.

| Under the checkout lock | Result |
|---|---|
| No longer `awaiting_payment_result`, or `p_task_due_at` differs from `payment_grace_expires_at` | Does nothing |
| A verified success exists | Does nothing; the customer has paid and the holds stay, including while §5.10 resolves a failed conversion |
| Post-lock `clock_timestamp()` is before `payment_grace_expires_at` | Does nothing; not due yet |
| Provider read missing or older than `commerce.provider_check_max_age_seconds`, using post-lock `clock_timestamp()` | `PROVIDER_CHECK_STALE`; task retries; holds stay |
| Termination failed or `p_provider_terminated_at` is missing | `PROVIDER_CHECK_STALE`; task retries; holds stay |
| Fresh read has no success and order is terminated, including an attempt still processing | Release holds; set `reservation_expired`, `closed_reason_code = 'payment_failed'`; emit `checkout.payment_not_received` (§10) |

If termination fails, raise `PROVIDER_CHECK_STALE`; do not release the holds. The payment
stays on SDD 02's poll after this checkout closes. A later success is a late payment (§5.6).
The customer sees "We have not received your payment. If you were charged, it will be
refunded automatically." Never tell this customer they were not charged.

### 5.5 `convert_paid_checkout` (called by SDD 02's verification, in its transaction)

`marketplace_sec.convert_paid_checkout(p_request_id UUID, p_payment_id UUID, p_paid_at
TIMESTAMPTZ, p_command_id UUID)`. Not callable by any client role.

Guards: the checkout is `reserved` or `awaiting_payment_result`; the payment's verified
amount equals `final_total_minor` (SDD 02 has already checked; re-checked here); every item
has an active hold. A failed guard should be impossible. If one fails, the command **does not
raise**: it writes nothing and returns §5.0's `{"outcome":"conversion_failed","reason":TEXT}` answer. An
exception would roll back SDD 02's whole transaction, including the record that the payment
was verified. SDD 02 then commits the payment as verified and opens an admin case in that
same transaction, extends the holds as §5.10 says, and leaves the checkout in its current
live state. `resolve_failed_conversion` can retry within the D-04 window (§5.10).
If a retry cannot succeed, the admin refunds the payment in full (D-95); a case still open
after 7 days is escalated to the owner, and the §13 scan also finds it. Both expiry commands do nothing once a verified
success exists. The customer has paid, so the books stay held while this is resolved.

Locks, in the §7 order: customer advisory lock, payment, cart, store (`FOR UPDATE`,
for the daily limit), checkout, order if present, stock rows in ID order, then listings.
Effects:

- Holds become sales (`convert_request_holds`, §9).
- Checkout becomes `converted`. The cart becomes `submitted` only if it is still `active` at
  `cart_version_at_reservation`. A cart the customer changed after an expiry is left alone;
  the order is built from the checkout's items, not the cart.
- Insert `store_orders` (`awaiting_store`) and `store_order_items`, with `acceptance_due_at`,
  `promised_ready_by` (§8.3) and the snapshots.
- Read once whether a photo request was open for each item at this moment, through the
  function the Phase 9 lane provides; keep its request ID as `photo_request_id` and
  set `photo_requested` on those items,
  `photo_requested_at_payment` if there are any, and then
  `photo_send_due_at = paid_at + 24 hours` (D-43). Until that function exists the value is
  always false (§18).
- Create the receipt (§11). If the saved contact has an email, open `receipt_email`
  in this transaction, keyed by type and order ID (§8.1).
- Open `acceptance_expiry`; open `acceptance_reminder` and `acceptance_escalation` only
  when §8.2 gives an allowed due time and sets their columns. Open `photo_send_expiry`
  when photos were requested.
- Notices: "Order placed" to the customer; "New paid order" to the store's owners, which is
  also the store alert (§8.4).
- Daily limit (D-20, D-66): count this store's orders with `paid_at` on the current India
  date. If the count has reached the limit, set the pause `store_limit_daily_orders`. The
  unsettled-amount limit is set by SDD 05 in the same way.
- Events `checkout.converted` and `order.placed`.

### 5.6 `resolve_late_payment` (called by SDD 02's verification)

For a verified success on a checkout that is already closed. A success on a Cashfree
order that already has an `amount_mismatch` attempt never comes here: SDD 02 treats it as
a duplicate that Cashfree reverses (CF-30, D-78).

Every kind of payment that arrives late or twice, and where it is handled:

| Case | What happens | Where |
|---|---|---|
| First success on a checkout still `reserved` or `awaiting_payment_result` | Converted as a normal payment | §5.5 |
| First success after the checkout closed, including after a termination request (CF-65) | This section's table: an order if the books are free and nothing below applies, otherwise a full refund | §5.6 |
| A second success on a Cashfree order that already has a verified payment | Duplicate; Cashfree reverses it; no order and no immediate refund from us | SDD 02 (D-78, CF-30) |
| A success after a wrong-amount attempt on the same Cashfree order | Same as a duplicate | SDD 02 (D-78, CF-30), §5.3 |
| A success for the wrong amount | Refunded in full; never an order; the reservation runs out | SDD 02 (D-29), §5.3 |
| A success Cashfree has already reversed | Recorded by reconciliation; no order and no refund from us | SDD 02, SDD 03 |
| A success on a checkout the customer or the platform cancelled | Full refund, no order | This section (D-85) |
| A success that cannot be converted | Admin retry or refund | §5.10 (D-95) |

| Checkout state | Result |
|---|---|
| `customer_cancelled` or `platform_cancelled` | Full automatic refund, no order (D-85). Refund category 5 in SDD 04 |
| `reservation_expired`, and a D-81 pause is active for the store | Full automatic refund (D-98) |
| `reservation_expired`, and another checkout of the same cart at the same `cart_version_at_reservation` is live or converted | Full automatic refund: the customer is already buying exactly these books (D-97). A checkout of the cart at a different version does not count; the cart changed, so these are different orders |
| `reservation_expired`, every item still has enough stock | All items are taken again and sold in one step; then the same effects as §5.5. `converted` (D-06, D-84) |
| `reservation_expired`, any item short | Full automatic refund (Q38, D-84); nothing is taken |

- All or nothing, using the full §7 order: customer advisory lock, payment, cart, store,
  checkout, order if present, stock rows in ID order, then listings (D-84). The cart lock
  precedes the stock locks, so two late payments and a new reservation on one cart cannot pass this check
  together.
- Only stock is checked. Limits, the 3-fault pause, the loss cap, the global pause and the
  store's own switch do not block it (handoff §11 item 4).
- Stock moves straight from available to sold; a hold row is written as
  `converted_to_sale` for the record. No active hold is created, so the terminal guard is
  not involved.
- The customer is told in the app which happened and, for a refund, why, the amount and
  "2–3 working days" (§10, D-48).
- The refund is requested from SDD 04 with the payment ID as its key, so a repeat does
  nothing.

### 5.7 `cancel_for_store_ineligibility` (system, D-81)

Called only by `set_commerce_pause` for a kind that cancels live reservations, which has
taken any required earlier §7 locks, then the store lock (`FOR UPDATE`) before checkout,
stock and listings. A reservation cannot slip past it. For each
unpaid checkout of the store in `reserved` or `awaiting_payment_result`: holds released,
`platform_cancelled` with the matching `closed_reason_code`, tasks `reservation_expiry` and
`payment_grace_expiry` resolved, task `terminate_provider_order` opened,
event `checkout.platform_cancelled`, notice to the customer ("This store cannot take your order right now. You have not been
charged; if you were, it will be refunded automatically."). A payment that still succeeds
is refunded by §5.6. Paid orders are not touched by this command; they continue (D-21).
A checkout with a verified success awaiting failed-conversion recovery stays under §5.10;
it is not an unpaid reservation to cancel.

One pause can cancel many checkouts in one transaction, and both an event's command ID
(per event type) and its idempotency key must be unique. So each cancelled checkout gets
its own identity, derived from the pause command:

- child command ID `marketplace_sec.derived_command_uuid(p_command_id,
  'store-ineligible-cancel:' || request_id)`, used for that checkout's event, task and
  notice;
- event idempotency key `checkout.platform_cancelled:` plus the same `request_id`;
- the pause command ID is kept in each event's payload as `pause_command_id`, so the
  cancellations can be traced to the pause.

A replay of the same pause derives the same identities and changes nothing.

The existing Phase 6 function of the same name is replaced by a new version in a new
migration.

### 5.8 Checkout transitions

| From | To | By |
|---|---|---|
| (cart) | `reserved` | `create_reservation` |
| `reserved` | `converted` | `convert_paid_checkout` |
| `reserved` | `awaiting_payment_result` | `expire_reservation` |
| `reserved` | `reservation_expired` | `expire_reservation` |
| `reserved`, `awaiting_payment_result` | `customer_cancelled` | `cancel_reservation` |
| `reserved`, `awaiting_payment_result` | `platform_cancelled` | `cancel_for_store_ineligibility`; also `resolve_failed_conversion`'s `refund`, with `conversion_failed` (D-95, §5.10) |
| `awaiting_payment_result` | `converted` | `convert_paid_checkout` |
| `awaiting_payment_result` | `reservation_expired` | `expire_payment_grace` |
| `reservation_expired` | `converted` | `resolve_late_payment` |

No other transition exists. A trigger refuses any other change of status on a pay-first
row.

### 5.9 `requeue_checkout_timer` (admin, through SDD 08)

`marketplace_sec.requeue_checkout_timer(p_task_id UUID, p_reason TEXT,
p_idempotency_key TEXT, p_command_id UUID)`; JSON answer as in §5.0.

The way out of a dead-lettered expiry when Cashfree could not be read. Read the source
task's checkout on the server; take the §7 locks, then lock the source task. For a new
replacement, require that the source is dead-lettered, is `reservation_expiry` or
`payment_grace_expiry`, and belongs to a checkout still in `reserved` or
`awaiting_payment_result`. Otherwise raise `INVALID_COMMAND` and write nothing.

Open a new task of the same type and record its ID on the source in
`replaced_by_task_id`, in the same transaction. The source is dead-lettered, so it is
not open and cannot conflict with the open-task unique index. If another task of that
type is already `open`, `in_progress` or `retry_scheduled` for the checkout, resolve it
as `resolved_noop` before inserting the replacement (§8.1).
Its `due_at`, passed as `p_task_due_at`, stays the checkout's original
`reservation_expires_at` or `payment_grace_expires_at`; `next_attempt_at` is the
post-lock `clock_timestamp()`, so it runs now. The dedupe key is type, checkout ID,
original due time and admin `p_command_id`, never the requeue time.

A replay returns the recorded replacement ID, even if that replacement has since run.
Two concurrent calls lock the same source: the second returns the first replacement
instead of creating another. The replacement follows §5.3 or §5.4, including a fresh
Cashfree read, so an admin can retry but cannot release books without one. Audited.

### 5.10 `resolve_failed_conversion` (admin, through SDD 08; D-95)

`marketplace_sec.resolve_failed_conversion(p_request_id UUID, p_action TEXT, p_reason TEXT,
p_idempotency_key TEXT, p_command_id UUID)` is service role only and admin-only through
SDD 08. It acts on an unresolved `conversion_failed` case. It reads the verified payment
itself for `p_payment_id` and `p_paid_at`; the admin does not supply either. Take the §7
locks: customer advisory lock, payment, cart, store, checkout, order if present, stock
rows in ID order, then listings. Read `clock_timestamp()` after those locks.

| `p_action` | Result |
|---|---|
| `retry_convert` | Allowed only before the saved `paid_at + 24 hours` (D-04). Call `convert_paid_checkout` again with that payment and original `paid_at`. The order keeps `acceptance_due_at = paid_at + 24 hours`. Success closes the case and records the recovery action and order ID; another failure leaves the case open and holds active |
| `refund` | Release the holds; set `platform_cancelled`, `closed_reason_code = 'conversion_failed'`; resolve checkout tasks; request the whole payment from SDD 04 category 5, keyed by payment ID as in §5.6; close the case |
| Retry at or after `paid_at + 24 hours` | `INVALID_COMMAND`: "The 24-hour window to retry has passed. Escalate this case to the owner." Nothing changes |
| Anything else | `INVALID_COMMAND`; nothing changes |

After the D-04 window only `refund` can resolve the case, because the store could no
longer accept a new order. The admin may also refund inside the window when a retry
cannot succeed. Nothing refunds automatically: until an admin acts, the case stays open
with holds active (D-95).

An order created by `retry_convert` that expires unaccepted is fault `platform`,
regardless of alert delivery: failed conversion is a system failure under D-04. This
applies D-04 and adds no rule; §6.6 reads the recorded recovery action.

When SDD 02 records the failure, it also sets the admin case deadline to 7 days later
and extends active holds' `expires_at` to at least that deadline, in the same
transaction (D-95). If the deadline passes with the case open, the admin queue
escalates it to the owner. Nothing releases the holds by itself.
`expire_reservation` and `expire_payment_grace` do nothing on a verified success.

The action and reason are audited. A replay after conversion or an approved refund
does nothing. A retry racing SDD 02's verification of the same payment uses the same
payment lock and one-order constraints; only one conversion commits (§7).
The payment ID refund key also prevents a later §5.6 replay from refunding again.
The matching source changes (register D-95, master §5, SDD 04 category 5) are recorded in §20.
