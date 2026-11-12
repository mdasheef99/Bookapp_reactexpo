# SDD 02, part 1: Tables, settings, access and the Cashfree adapter

**Part of SDD 02.** Section numbers run across the four files; the map is in the
[overview](./02-0-overview.md). Revised 2026-11-11 after review round 1
([findings](../../PHASE-7-8-sdd02-review-r1.md)); review item IDs (B1, M2, …) are noted
where a rule changed.
**Status:** full draft; R5 carried in on 2026-11-12. Not approved.

---

## 4. Tables

All money is whole paise (`_minor`, INTEGER, CHECK `>= 0`). All times are `TIMESTAMPTZ`.
Every table has `created_at` and `updated_at`. One new migration creates the four tables
below, the new schema `marketplace_private` with its one table (§4.3), the foreign key
`store_orders.payment_id → payments(id)` that SDD 01 §3 assigns to this migration (M8),
the task types of §10 to §13 and the settings of §5. No applied Phase 6 table changes,
except the task-type registration and crash-reclaim guard in §10.4. The migration also
creates `marketplace_sec.cashfree_api_budget(account_scope TEXT, environment TEXT,
endpoint TEXT, window_started_at TIMESTAMPTZ, used INTEGER CHECK (used >= 0),
retry_not_before TIMESTAMPTZ, PRIMARY KEY (account_scope, environment, endpoint,
window_started_at))` for §11.5. `account_scope` is a non-secret server-configured identifier;
no key is stored. Only service-role functions can access it.

### 4.1 `payments` (one per checkout)

One Cashfree order per checkout. A failed attempt is retried on the same Cashfree order
(Q37), so there is no second payment row for one checkout.

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `request_id` | UUID NOT NULL, FK `store_order_requests(id)` | UNIQUE: one payment per checkout |
| `order_id` | UUID, FK `store_orders(id)` | Set when the order exists |
| `store_id`, `user_id` | UUID NOT NULL | Copied from the checkout; never from the client |
| `provider` | TEXT NOT NULL DEFAULT `cashfree` | CHECK = `cashfree` |
| `provider_order_id` | TEXT NOT NULL UNIQUE | Ours: `bc_` plus the payment ID without dashes (35 characters). Sent to Cashfree as its order ID |
| `cf_order_id` | TEXT UNIQUE | Cashfree's own order reference, once created |
| `payment_session_id` | TEXT | Returned to the paying customer only (§6) |
| `amount_minor` | INTEGER NOT NULL | The checkout's `final_total_minor` at start. CHECK `>= 100` (D-107) |
| `currency` | TEXT NOT NULL DEFAULT `INR` | CHECK = `INR` |
| `status` | TEXT NOT NULL | §4.1.1 |
| `start_round` | INTEGER NOT NULL DEFAULT 1 | Which order-creation round is current (§8, M2) |
| `start_command_id` | UUID NOT NULL | The `begin_payment` command that opened the current round |
| `start_started_at` | TIMESTAMPTZ NOT NULL | When the current round began; drives recovery (§11.6) |
| `create_request_snapshot` | JSONB NOT NULL | Frozen create body built by the server for the current round, including contact snapshot phone and return URL; service-only, never returned or logged. Identical on every retry within that round (§7.2) |
| `provider_order_expires_at` | TIMESTAMPTZ NOT NULL | Fixed for each round: post-lock time plus §5's expiry. Only a new round after definitive no-order may refresh it; uncertain retries never change the body |
| `pay_presses` | INTEGER NOT NULL DEFAULT 0 | Accepted "Pay" presses for this checkout (D-106) |
| `verified_attempt_id` | UUID | The one counted attempt. Composite FK `(verified_attempt_id, id)` → `payment_attempts(id, payment_id)`, so it always belongs to this payment (M8) |
| `paid_at` | TIMESTAMPTZ | **When BookConnect verified** the counted success: post-lock `clock_timestamp()` in §9.3. This is SDD 01's `paid_at` (M7) |
| `provider_paid_at` | TIMESTAMPTZ | Cashfree's completion time of the counted attempt, for reconciliation only; nullable when Cashfree omits it |
| `closed_at` | TIMESTAMPTZ | When the checkout closed with no counted success |
| `provider_closed_confirmed_at` | TIMESTAMPTZ | When Cashfree showed the order `TERMINATED` or `EXPIRED` with no attempt pending. Information only: it does **not** stop the poll (B1) |
| `next_poll_at` | TIMESTAMPTZ | NULL before creation resolves or for definitive no-order, otherwise only after §11.2's safe reconciliation handover |
| `poll_lease_until` | TIMESTAMPTZ | Set while one poll run owns this row (§11.1) |
| `poll_lease_token` | UUID | Fences completion by an expired poll owner (§11.1) |
| `poll_window_started_at` | TIMESTAMPTZ | Set once when the checkout closes or converts; anchors §11.2 even for a paid checkout |
| `closed_alert_raised_at` | TIMESTAMPTZ | Set once when §11.4's admin case opens |
| `last_check_id` | UUID, FK `provider_checks(id)` | The newest check applied to the payment's status (§9.3) |
| `version` | INTEGER NOT NULL DEFAULT 1 | |

Constraints: `verified_attempt_id` and `paid_at` are set exactly when `status` is `paid`
or `paid_late`. `provider_paid_at` is copied if present and never invented. `amount_minor` never changes after creation. The expiry and create body change only
when a definitively refused round is replaced; they never change within a round. Because `request_id` is unique, a checkout can never have two
counted payments.

#### 4.1.1 Payment states

| State | Meaning | Next |
|---|---|---|
| `initiating` | A creation round is open; Cashfree may or may not have the order yet | `created`; `pending`, `paid`, `paid_late` if verification wins before the recorder; `start_failed` (only a definitive refusal, §7.2); `closed_unpaid` (the checkout closed and creation is resolved, M3) |
| `start_failed` | Cashfree definitively refused creation with no unresolved invocation (§7.2). A negative read after timeout is insufficient. Nothing was charged | `initiating` (a new round, §8); `closed_unpaid` when the checkout closes |
| `created` | Cashfree order exists; no attempt yet, or only finished unsuccessful ones | `pending`, `paid`, `paid_late`, `closed_unpaid` |
| `pending` | An attempt is in progress or its result is unknown | `created`, `paid`, `paid_late`, `closed_unpaid` |
| `paid` | Verified success for the exact amount while the checkout was live | Final. Later attempts on the order are recorded on `payment_attempts` only (duplicates, §13.2); the payment's status never changes again (M3) |
| `paid_late` | Verified success after the checkout closed | Final, as `paid` |
| `closed_unpaid` | The checkout closed with no counted success | `paid_late` if a success still arrives; otherwise stays, even with a pending attempt, still polled (§11.2) |

A trigger allows only these moves. §9.3 computes one final payment state and writes it
only if it differs. It persists a counted receipt's paid state and verified fields before
calling SDD 01 conversion in the same transaction, with no intermediate status move the
trigger would refuse.

### 4.2 `payment_attempts` (one per Cashfree payment)

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | UNIQUE `(id, payment_id)` for §4.1's composite FK |
| `payment_id` | UUID NOT NULL FK | |
| `cf_payment_id` | TEXT NOT NULL UNIQUE | Cashfree's payment ID (a string) |
| `method_group` | TEXT | `upi`, `card` or `other` (§7.3, D-105) |
| `amount_text` | TEXT NOT NULL | The amount exactly as Cashfree sent it, in rupees |
| `amount_minor` | INTEGER | The amount in paise; NULL when it is not a whole number of paise (M6) |
| `currency` | TEXT NOT NULL | As Cashfree reports it |
| `provider_status` | TEXT NOT NULL | Cashfree's raw status, unchanged |
| `status` | TEXT NOT NULL | `pending`, `success_unresolved`, `success`, `failed`, `dropped`, `amount_mismatch`, `duplicate_success`, `reversed` |
| `provider_started_at` | TIMESTAMPTZ | Cashfree's `payment_time` (when the attempt started) |
| `provider_completed_at` | TIMESTAMPTZ | Cashfree's reported `payment_completion_time`; may already be populated while pending (SBX-05). It is never evidence of a terminal result; `payment_status` decides. |
| `classified_by_check_id` | UUID, FK `provider_checks(id)` | The check that classified a success |
| `refund_requested_at` | TIMESTAMPTZ | Set when §13 asks SDD 04 for a refund of this attempt |
| `watch_stage` | TEXT | For `duplicate_success` only (§13.2): `waiting_reversal`, `asked_cashfree`, `refund_due`, `refund_requested`, `reversed`, `kept_by_cashfree` (§13.5) |
| `watch_due_at` | TIMESTAMPTZ | When the duplicate watch next acts (§13.2) |
| `cashfree_asked_at` | TIMESTAMPTZ | When the admin recorded asking Cashfree (§13.2) |
| `ask_case_opened_at` | TIMESTAMPTZ | When the "Ask Cashfree" case opened; starts the no-answer period (D-110, §13.2) |
| `cashfree_answer` | TEXT | `will_not_reverse`, or NULL |
| `cashfree_answered_at` | TIMESTAMPTZ | When the checked admin command records the answer; anchors the 1-business-day deadline |
| `refund_due_at` | TIMESTAMPTZ | Fixed D-78 deadline; a pending reversal never moves it later |
| `last_watch_check_id` | UUID, FK `provider_checks(id)` | Last refunds check consumed by §13.2; replay changes nothing |
| `reversal_seen_at` | TIMESTAMPTZ | Set when a completed reversal of this attempt is seen (§13.2), including of the counted attempt (§13.5) |

An attempt only moves forward: `pending` to any other state; `failed` or a non-terminal
`dropped` to a success class only if Cashfree later reports a success for the same payment
ID, which is then classified like any success (§9.3). Raw `USER_DROPPED` is terminal and
cannot become `SUCCESS` (CF-77). The mapped `dropped` state also includes `NOT_ATTEMPTED`,
which can become `SUCCESS` on sandbox; live behaviour is unknown (CF-77). Keep
`provider_status` to distinguish them, and keep §11.2's full polling schedule.
`success_unresolved` means a reported success
waiting for a fresh payments and refunds read (§9.3); it may move to
`success`, `amount_mismatch`, `duplicate_success` or `reversed`. `success`, `amount_mismatch`,
`duplicate_success` and `reversed` to nothing. §9.3 skips a backward move instead of
attempting it, so the trigger never aborts a check.

### 4.3 `provider_webhook_events` and the private body table

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `provider` | TEXT NOT NULL | `cashfree` |
| `message_key` | TEXT NOT NULL UNIQUE | §10.2 |
| `event_type` | TEXT NOT NULL | Cashfree's event name |
| `event_time` | TIMESTAMPTZ | From the signed timestamp |
| `received_at` | TIMESTAMPTZ NOT NULL | |
| `signature_ok` | BOOLEAN NOT NULL | |
| `processing_status` | TEXT NOT NULL | `rejected` (final), `queued`, `processed` (final), `dead` (final) |
| `last_error_code` | TEXT | Short code only; never the body |
| `payment_id` | UUID FK | When the message names a known payment |
| `body_purged_at` | TIMESTAMPTZ | Set when §10.6 deletes the body |

`marketplace_private.provider_webhook_bodies(event_id UUID PRIMARY KEY REFERENCES
provider_webhook_events(id) ON DELETE CASCADE, body TEXT NOT NULL, received_at TIMESTAMPTZ
NOT NULL)`. The body is the raw text exactly as received. The schema is new, owned by the
migration, with no grants to `anon` or `authenticated` and no PostgREST exposure; only the
service-role functions of §10 read or write it. A rejected message stores no body. Because
a rejected message has no trustworthy key, rejected rows use a random key and are counted,
not de-duplicated. Retries of processing are the task framework's (§10.4), not columns here.

### 4.4 `provider_checks` (every call we make to Cashfree about a payment)

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | One HTTP invocation's evidence; a completed row is immutable. Also the verification command ID (§9.3, M1); duplicate watches derive per-attempt child IDs |
| `payment_id` | UUID NOT NULL FK | |
| `kind` | TEXT NOT NULL | `create_order`, `read_order`, `read_payments`, `read_refunds`, `terminate` |
| `start_round` | INTEGER | For `create_order` and its recovery `read_order`: the round it belongs to |
| `requested_at` | TIMESTAMPTZ NOT NULL | |
| `answered_at` | TIMESTAMPTZ | Null if no answer |
| `outcome` | TEXT NOT NULL | `ok`, `not_found`, `refused`, `provider_error`, `timeout`, `unreachable`, `rate_limited` |
| `error_code` | TEXT | Cashfree's `code`, or ours (`auth_failed`) |
| `retry_after_seconds` | INTEGER | Cashfree's rate-limit wait, when supplied; persisted for cross-invocation backoff (§11.5) |
| `order_status` | TEXT | Mapped: `ACTIVE`, `PAID`, `EXPIRED`, `TERMINATED`, `TERMINATION_REQUESTED`, `UNKNOWN` |
| `terminate_refused_for_success` | BOOLEAN | For `terminate`: Cashfree's answer shows the order `PAID` (§12.1) |
| `snapshot` | JSONB | The cleaned answer, by kind (below). Never card, bank or UPI-handle details |
| `triggered_by` | TEXT NOT NULL | `start`, `start_recovery`, `return`, `webhook`, `poll`, `expiry_worker`, `grace_worker`, `terminate_task`, `duplicate_watch`, `admin` |

Snapshot by kind (M6):

| Kind | Snapshot |
|---|---|
| `create_order`, `read_order` | `cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time` |
| `read_payments` | For each payment: `cf_payment_id`, raw and mapped status, `amount_text`, `amount_minor` (or null), currency, mapped method group, `provider_started_at`, `provider_completed_at` |
| `read_refunds` | For each refund: `cf_refund_id`, `cf_payment_id`, `refund_type`, `refund_status`, amount text and paise, currency, `processed_at` |
| `terminate` | `order_status` |

Checks are ordered by `(requested_at, id)`; "newer" and "older" in §9.3 mean exactly this
(M4). A slow earlier request cannot overwrite a later request's snapshot. SDD 01's expiry commands receive `p_provider_checked_at = answered_at` of a fresh `ok`
`read_payments` check, and `p_provider_terminated_at = answered_at` of a `terminate` check
that ended the order (§12.1).

## 5. Settings (`marketplace_policy_config`)

| Key | Default | Source |
|---|---|---|
| `commerce.provider_order_expiry_seconds` | 960 | CF-31; §17 item 1 |
| `commerce.payment_poll_live_seconds` | 20 | §17 item 2 |
| `commerce.payment_poll_after_close_seconds` | 300 | §17 item 2 |
| `commerce.payment_poll_after_close_hours` | 2 | §17 item 2 |
| `commerce.payment_poll_slow_seconds` | 3600 | §17 item 2 |
| `commerce.payment_poll_hourly_days` | 7 | §17 item 12 |
| `commerce.payment_poll_daily_days` | 60 | §17 item 12 |
| `commerce.payment_start_recovery_seconds` | 30 | §11.6 |
| `commerce.closed_payment_alert_hours` | 24 | §17 item 3, CF-65 |
| `commerce.webhook_max_age_seconds` | 86400 | D-114 (was 300 from CF-37; retries keep their first timestamp, SBX-10) |
| `commerce.customer_payment_check_per_minute` | 10 | §17 item 5 |
| `commerce.payment_pay_presses_per_checkout` | 5 | D-106 |
| `commerce.duplicate_reversal_wait_business_days` | 3 | D-78 |
| `commerce.duplicate_refund_no_answer_business_days` | 5 | D-78 |
| `commerce.webhook_body_retention_days` | 180 | §17 item 9 |
| `commerce.cashfree_reads_per_minute` | 25 | §11.5; every trigger shares the per-endpoint cap, under Cashfree's sandbox payment-read limit of 30 |

Existing keys used and not redefined: `commerce.payment_grace_seconds` (900, D-102),
`commerce.provider_check_max_age_seconds` (60) and the minimum order total (100 paise,
D-107) from SDD 01 §4. Processing retries use the task framework's `max_attempts` (at most
5; M10). Business days are India working days: Monday to Friday, excluding the national
holidays listed in the setting `commerce.india_bank_holidays` (a list of dates kept by the
admin), added by this migration.

## 6. Access

- Enable RLS on all new public tables and revoke all table privileges from `PUBLIC`,
  `anon` and `authenticated`; do not add direct client read policies. No client role can
  read or write attempts, checks, events or sessions by table access. Customer payment
  reads use only the checked projection below. Service writes use the §6 wrappers.
- **Callable entry points (M9).** The database functions live in `marketplace_sec`, which
  is not exposed to PostgREST. Each Edge Function calls a public wrapper that follows the
  Phase 6 pattern: `SECURITY DEFINER SET search_path = ''`, `REVOKE ALL` from `PUBLIC`,
  `anon` and `authenticated`, `GRANT EXECUTE` to `service_role` only, and an internal check
  that the caller is the service role. The wrappers are `public.commerce_begin_payment`,
  `public.commerce_record_provider_order`, `public.commerce_apply_payment_check`,
  `public.commerce_record_webhook`, `public.commerce_claim_payment_polls` and
  `public.commerce_apply_duplicate_watch`, each passing its arguments unchanged.
  The additional service-only wrappers below follow the same grants and role checks.

  | Public wrapper (same internal name without `commerce_`) | Exact parameters | Result |
  |---|---|---|
  | `commerce_record_provider_check` | `(p_check_id UUID, p_payment_id UUID, p_kind TEXT, p_start_round INTEGER, p_requested_at TIMESTAMPTZ, p_answered_at TIMESTAMPTZ, p_outcome TEXT, p_error_code TEXT, p_retry_after_seconds INTEGER, p_order_status TEXT, p_terminate_refused_for_success BOOLEAN, p_snapshot JSONB, p_triggered_by TEXT)` | Check ID; validate §4.4's shape. A repeated ID must have identical inputs or raise `INVALID_COMMAND`; a rate-limited read also extends the budget's `retry_not_before` atomically |
  | `commerce_read_webhook_work` | `(p_event_id UUID, p_task_id UUID, p_lease_owner UUID, p_attempt_number INTEGER)` | Under the live task lease, extract a cleaned dispatch envelope from the private body: event type, provider order/payment/refund/vendor IDs, statuses, currency, amounts and charge fields needed by §10.3 only. Never the raw body or customer details |
  | `commerce_finish_webhook_work` | `(p_event_id UUID, p_task_id UUID, p_lease_owner UUID, p_attempt_number INTEGER, p_outcome TEXT, p_retryable BOOLEAN, p_code TEXT, p_correlation_id UUID)` | Atomically complete the task, event and final-failure case under the current lease (§10.4) |
  | `commerce_expire_with_payment_evidence` | `(p_request_id UUID, p_task_due_at TIMESTAMPTZ, p_phase TEXT, p_payments_check_id UUID, p_termination_check_id UUID, p_idempotency_key TEXT, p_command_id UUID)` | SDD 01 expiry answer; §12.1. `p_phase` is `reservation` or `grace`; nullable check IDs are explicit |
  | `commerce_finish_payment_poll` | `(p_payment_id UUID, p_lease_token UUID, p_next_poll_at TIMESTAMPTZ)` | Release/reschedule only the matching lease; stale owners do nothing |
  | `commerce_purge_webhook_bodies` | `(p_batch_size INTEGER)` | Delete the next retention-expired batch and stamp its events in one transaction (§10.6) |
  | `commerce_take_cashfree_read_permit` | `(p_endpoint TEXT)` | Derive account/environment on the server; atomically return `allowed` and `retry_at` under §11.5 |

  The existing wrappers have these contracts: `commerce_begin_payment` and
  `commerce_record_provider_order` use §8's signatures; `commerce_apply_payment_check`
  uses §9.3's; `commerce_record_webhook(p_event_id UUID, p_message_key TEXT,
  p_event_type TEXT, p_event_time TIMESTAMPTZ, p_received_at TIMESTAMPTZ,
  p_signature_ok BOOLEAN, p_body TEXT)` returns the existing or inserted event ID (§10.1).
  A rejected intake has NULL body, a random key and no task.
  `commerce_claim_payment_polls(p_batch_size INTEGER)` returns payment IDs, round numbers,
  lease tokens and lease deadlines, including §11.6 recovery work.
  `commerce_apply_duplicate_watch(p_attempt_id UUID, p_refunds_check_id UUID)` returns
  `watch_stage` and `watch_due_at`; derive its command UUID from the attempt ID and check
  ID, so one refunds read may safely advance several watches (§13.2).
- A customer reads their own payment only through
  `public.customer_payment_status(p_request_id UUID)` (authenticated, `SECURITY DEFINER`),
  which checks the caller is the checkout's `user_id` and returns status, amount and, while
  the payment is `created` or `pending` and the checkout is `reserved`, the
  `payment_session_id`, only before the post-lock reservation deadline and while §8's
  pending, mismatch and unresolved-success guards permit it. A read does not grant a new
  Pay press: only §8 authorizes opening checkout. It never returns attempts, checks or
  webhook data.
- Store owners see payment state only through the order fields SDD 01 already exposes.
- Admins read through SDD 08's checked wrappers.
- `marketplace_private.provider_webhook_bodies` and the Cashfree keys are service-role only.
  No function returns a webhook body, a key or a full Cashfree answer.
- Logs record IDs, states and short error codes only, never a body, a key, a session ID
  or a phone number.

## 7. The Cashfree adapter

### 7.1 One module

`supabase/functions/_shared/cashfree/` is the only code that calls Cashfree. It runs only
in Edge Functions with the service role. It reads `CASHFREE_APP_ID`,
`CASHFREE_SECRET_KEY` and `CASHFREE_ENV` from server secrets. On the dev project it refuses
to start unless `CASHFREE_ENV` is `sandbox`. Keys are never logged, never sent to the app
and never put in an `EXPO_PUBLIC_` variable.

### 7.2 Operations

Names below are from Cashfree's API reference for version `2026-01-01`, recorded with
sources in the [names list](../../PHASE-7-8-cashfree-names-needed.md) (§16 item 1). Every
call sends `x-client-id`, `x-client-secret` and `x-api-version: 2026-01-01` to
`https://sandbox.cashfree.com/pg` (CF-41).

| Operation | Cashfree call | Idempotency |
|---|---|---|
| `createOrder(payment)` | `POST /orders` with `order_id` = our `provider_order_id`; `order_amount` in rupees from `amount_minor` (2 decimals); `order_currency: INR`; `customer_details.customer_id` = the checkout's `user_id` without dashes (Cashfree allows letters and digits only) and `customer_phone` = the 10-digit mobile number from the contact snapshot (SDD 01 guard 9, D-50); `order_expiry_time` = `provider_order_expires_at` (ISO 8601 with offset); `order_meta.payment_methods: "upi,cc,dc"` (D-05); `order_meta.return_url` carrying our `provider_order_id` (Cashfree adds nothing to it). No `notify_url`: webhooks come only from the one dashboard endpoint (§10.1, m2). Returns `cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time` | `x-idempotency-key`: a UUID derived from the payment ID and `start_round`, so a timeout retry within a round repeats safely and a new round gets a new key. Send the frozen `create_request_snapshot`, never rebuild it from mutable configuration. The body is the same on every call within one round. |
| `getOrder(id)` | `GET /orders/{order_id}`; returns `cf_order_id`, `order_status`, `payment_session_id` and `order_expiry_time`. HTTP 404 is outcome `not_found` | Read only |
| `getPayments(id)` | `GET /orders/{order_id}/payments`; a plain list with no paging and no promised order (§9.3 sorts it) | Read only |
| `getRefunds(id)` | `GET /orders/{order_id}/refunds` | Read only |
| `terminateOrder(id)` | `PATCH /orders/{order_id}` with `order_status: TERMINATED` (CF-32). The answer is the order: its `order_status` decides the result (§12.1). Two HTTP 400 codes are also results, not errors: `order_already_paid`, and `request_invalid` with "order termination already requested" (SBX-01, SBX-02; §12.1) | `x-idempotency-key` = the `terminate` check's ID, so a timeout retry of one call repeats safely and each new attempt is a fresh request (CF-38; Cashfree requires a UUID) |
| `verifyWebhook(raw, headers)` | Base64 of HMAC-SHA256, keyed with the client secret (CF-36), over the `x-webhook-timestamp` value directly followed by the raw body, with no separator; compared in constant time with `x-webhook-signature`. Then enforce the D-114 age limit, `commerce.webhook_max_age_seconds = 86400`, on the signed timestamp interpreted as epoch milliseconds, confirmed by SBX-08. The signature is accepted with the current client secret or, only during a normal rotation's recorded 24-hour window, with the previous one; known or suspected compromise disables previous-secret verification immediately (§13.4). Then require the registered version and the event-specific body contract (§10.1); the version header alone is not proof of the body's format. Formula confirmed on sandbox webhooks (SBX-08) | Pure function |

Normalize HTTP 400 `order_already_paid` to `outcome = ok`, `order_status = PAID`, and
`terminate_refused_for_success = true`. Normalize HTTP 400 `request_invalid` only with
message “order termination already requested” to `outcome = ok`,
`order_status = TERMINATION_REQUESTED`, and `terminate_refused_for_success = false`.
Preserve the provider error code and store the normalized order status in the terminate
snapshot. Both results follow the corresponding status branch in §12.1 and §12.2; other
errors retain their existing handling.

**Create outcomes (M2).**

| Cashfree's answer to `createOrder` | Outcome |
|---|---|
| 200 | `ok`: order created |
| 409, code `order_already_exists` or `order_id_already_exists` | Read the order (`getOrder`): `ok` gives the existing order |
| 400 or 422 | `refused` only for a definitive validation refusal with no earlier create still unresolved. `idempotency_error` is never proof no order exists: read the stable order ID and otherwise keep `initiating` (CF-A23; additional finality question in §16) |
| Timeout, unreachable, 5xx or 429 | Unknown: read the order. `ok` → created; `not_found` or any other result → still unknown, and the round stays `initiating` for recovery (§11.6). A negative lookup does not prove an in-flight create cannot finish later |
| 401 | `provider_error`, `auth_failed`, one admin case; the round stays `initiating` |

CF-78 confirms retrying a timed-out Create Order with the same `x-idempotency-key`.
It does not answer how long the key is retained or whether a 404 is final (CF-A27);
the unknown-outcome recovery above remains unchanged.

"Derived" UUIDs are name-based (version 5) with a fixed BookConnect namespace, so the same
inputs always give the same key.

Each operation returns a typed result: the mapped fields, `outcome` and Cashfree's error
code (`code` and `type` from its error answer). It never passes a raw Cashfree answer
upward. Every call has a 10-second timeout and writes one `provider_checks` row (except
`verifyWebhook`). Wrong keys answer HTTP 401 `authentication_error`: `provider_error` with
code `auth_failed`, and one admin case. HTTP 429 is `rate_limited`; the adapter returns
Cashfree's `x-ratelimit-retry` seconds so the caller waits at least that long (§11.5).
Each physical retry gets a new check ID and preserves the original invocation's evidence;
an HTTP timeout is a completed `timeout` check. A termination retry may reuse its provider
idempotency key only for that same uncertain invocation, never rewrite its check row.

### 7.3 Mapping

Payment statuses (`payment_status`; Cashfree lists exactly these seven, §17 item 10):

| Cashfree | Mapped |
|---|---|
| `SUCCESS` | `success` |
| `PENDING` | `pending` |
| `FAILED`, `CANCELLED`, `VOID` | `failed` |
| `USER_DROPPED`, `NOT_ATTEMPTED` | `dropped` |
| Anything else | `pending` |

A status it does not know maps to `pending`, so an unknown status never releases stock or
refunds anything. `USER_DROPPED` is final (CF-77). Other failed/dropped paths retain §4.2's
late-success handling: `NOT_ATTEMPTED` → `SUCCESS` is confirmed only on sandbox, and its
live behaviour is unknown (CF-77). None of this shortens §11.2's polling.
Amounts are converted between rupees and paise only
here: `amount_minor` is set only when the amount is an exact whole number of paise, and
`amount_text` always keeps Cashfree's value, so §9.3 can treat a fractional amount as a
mismatch (M6). Times are read as ISO 8601 with offset.

Method groups (`payment_group`, D-105):

| Cashfree | Mapped |
|---|---|
| `upi`, `upi_credit_card`, `upi_ppi` | `upi` |
| `credit_card`, `debit_card` | `card` |
| Every other value (`upi_ppi_offline`, `prepaid_card`, EMI groups, `net_banking`, `wallet`, `pay_later`, `cardless_emi`, `bank_transfer`, `paypal`, `cash`) and anything unknown | `other` |

The snapshot (§4.4) keeps only the fields listed there. It drops `payment_method` (masked
card, UPI ID, payer account, IFSC, phone), `bank_reference`, `auth_id` and `error_details`
text.

Refund type and status are preserved unchanged, including unknown values. Only a
completed, full-amount, same-currency automatic reversal linked to the same
`cf_payment_id` is reversal evidence. Cashfree's refund API and its
`AUTO_REFUND_STATUS_WEBHOOK` documentation show automatic refunds as `refund_type`
`PAYMENT_AUTO_REFUND` naming the refunded `cf_payment_id` (read 2026-11-12; sandbox
confirmation and the meaning of `UNRECONCILED_AUTO_REFUND` are CF-A16). No such row means
"not reversed yet"; a reversal that appears later is handled by §13.2 or §13.5, so counting
and fulfilment never wait for it. A failed or missing refunds read is not "no reversal":
the success waits for a fresh read (§9.3). It never authorizes our refund on its own. A
known incomplete reversal does not postpone D-78's fallback deadlines (§13.2). Decimal text is parsed exactly, never with rounding or binary-float equality.
