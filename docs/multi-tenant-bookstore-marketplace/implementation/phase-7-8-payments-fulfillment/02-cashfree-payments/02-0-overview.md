# SDD 02: Cashfree Payments, Webhooks and Verification

**Status:** full draft, 2026-11-11, written from the approved skeleton, the decision
register, the Cashfree fact record (CF-01 to CF-66) and approved SDD 01. **Review round 1
done** (Muse, DeepSeek, Codex Sol, Codex Luna; [findings](../../PHASE-7-8-sdd02-review-r1.md))
and revised on 2026-11-11 with the owner's decisions D-104 to D-108. Round 2 reviewed and
corrected the remaining design defects on 2026-11-12; evidence and exact edits are in
`p78sdd02r2/SOL-R2-REPORT.md`. Revised again on 2026-11-12 from the
[sandbox tests](../../PHASE-7-8-cashfree-sandbox-tests.md) (SBX-01 to SBX-10) and owner
decision D-114: termination answers (§12.1), webhook age limit and version guard (§7.2,
§10.1, §10.5), previous-secret window on key change (§13.4), live-money block on refunding
one of two successes (§13.1, CF-A35), tests TE-03/03a, WH-02/02a, WH-10. Owner/Cashfree gates remain in §16; no approval is implied.
Review round 3 (Codex Sol, 2026-11-12) findings applied the same day.
Not approved. No code or migration may be written from it until the owner approves it.
**Authority:** none yet. Business rules come from the
[decision register](../../PHASE-7-8-decision-register.md); this document must not add any.
Where it had to choose something the register does not decide, the choice is listed in
§17 for the owner.
**Owns:** the single Cashfree adapter; creating the Cashfree order and payment session;
the webhook endpoint; verification; the payment poll; terminating Cashfree orders; wrong-
amount and duplicate payments; the provider side of late payments.
**Related:** [master](../00-master-state-model-sdd.md) ·
[checkout (SDD 01)](../01-checkout-reservation/01-0-overview.md) ·
[ledger (SDD 03)](../03-ledger-reconciliation-sdd.md) ·
[refunds (SDD 04)](../04-refunds-returns-recovery-sdd.md) ·
[Cashfree facts](../../PHASE-7-8-cashfree-replies.md) ·
[Cashfree questions waiting](../../PHASE-7-8-cashfree-questions-pending.md)

**Split by topic from the start.** Section numbers run across the four files, so
"SDD 02 §9" means §9 in whichever file holds it. The earlier one-file skeleton
[02-cashfree-payments-sdd.md](../02-cashfree-payments-sdd.md) is kept for reference.

| Sections | File | Contents |
|---|---|---|
| §1–§3, §16–§20 | [02-0-overview.md](./02-0-overview.md) | Rules, facts, what exists, open points, choices, build order, handovers, traceability |
| §4–§7 | [02-1-data-and-adapter.md](./02-1-data-and-adapter.md) | Tables, settings, access, the Cashfree adapter |
| §8–§13 | [02-2-payment-flows.md](./02-2-payment-flows.md) | Starting a payment, verification, webhooks, poll, termination, wrong-amount and duplicate payments |
| §14–§15 | [02-3-races-and-tests.md](./02-3-races-and-tests.md) | Races, worked examples, tests |

---

## 1. Rules this SDD implements

| Rule | Source |
|---|---|
| Customers pay through Cashfree's hosted web checkout, offered for UPI and cards only; a success by another method is still counted and the admin alerted | Q1, Q4, Q34, D-05, D-90, D-105 |
| The server decides a payment's result by asking Cashfree; the app and the webhook body are never trusted on their own | BC-11 |
| Retries and delayed answers never cause a double charge or a double order | Q37, BC-15 |
| A payment still processing when the reservation ends is not failed; the books stay held for 15 more minutes | BC-10, D-102 |
| The first verified payment for the exact amount counts; any later success on the same Cashfree order is a duplicate | D-29, D-78, SDD 01 §5.6, D-109 |
| A wrong-amount first payment is not paid: refunded in full, admin alerted; the reservation runs out on its timer | D-29 |
| A duplicate success is reversed by Cashfree; BookConnect does not refund it unless Cashfree confirms it will not reverse, or does not answer in time | D-78, CF-30 |
| A success after the checkout expired follows D-06; after a cancel, D-85; checks are SDD 01 §5.6 | D-06, D-85, D-97, D-98 |
| Books stay held while Cashfree cannot be reached | D-101 |
| A verified payment that cannot be converted opens an admin case | D-95 |
| A pause stops new reservations; a checkout already reserved may finish paying; restart only by the owner after reconciliation is clean | D-55, D-68, D-81, D-104 |
| At most 5 "Pay" presses per checkout | D-106 |
| A checkout total is at least ₹1 | D-107 |
| Customer wording reuses SDD 01's; a duplicate payment has its own notice | D-48, D-108 |
| Keys live only in server secrets; test keys only on the dev project | handoff §7 |

## 2. Cashfree facts this SDD relies on

From the [fact record](../../PHASE-7-8-cashfree-replies.md). None is tested by us on sandbox
yet except where the record says so.

| Fact | ID |
|---|---|
| Base URL `https://sandbox.cashfree.com/pg`, API version `2026-01-01` | CF-41 |
| Order expiry must be over 15 minutes and under 30 days | CF-31 |
| An order is ended with `PATCH /orders/{order_id}` and `order_status: TERMINATED`; the answer may be `TERMINATION_REQUESTED`; a succeeded payment may stop termination | CF-32 |
| Terminating does not cancel an attempt already started; a UPI attempt started before expiry can still succeed, with no maximum given | CF-33, CF-65 |
| A second success on one order is reversed by Cashfree, within up to 5 calendar days, seen in transaction details, reports and webhooks | CF-30, CF-64 |
| Web checkout opens as redirect, popup or inline; card data stays on Cashfree's page; no PCI certificate needed | CF-34, CF-35 |
| Webhooks are signed with the client secret; one key pair at a time | CF-36 |
| Webhook delivery is at least once, retried at 2, 10 and 30 minutes; reject a timestamp over five minutes old | CF-37 (the age limit is replaced by D-114: retries keep their first timestamp, SBX-10) |
| Terminate, split and adjustment calls accept `x-idempotency-key` (the API reference adds: UUID format, and create order accepts it too) | CF-38 |
| `PAYMENT_CHARGES_WEBHOOK` reports each payment's charge | CF-29 |
| Sandbox simulates `SUCCESS`, `FAILED`, `PENDING`, `USER_DROPPED`; no disputes | CF-40, CF-66 |

**From Cashfree's API reference, not yet CF facts (§16 item 1).** On 2026-11-11 the API
names were read from Cashfree's reference for version `2026-01-01` and cross-checked by a
second independent read. They are recorded with sources in the
[names list](../../PHASE-7-8-cashfree-names-needed.md) and used in §7 and §10:

- the order calls `POST /orders`, `GET /orders/{order_id}`, `GET /orders/{order_id}/payments`,
  `GET /orders/{order_id}/refunds` and `PATCH /orders/{order_id}`;
- the payment statuses and method groups;
- the webhook events, headers and signing formula;
- `x-idempotency-key` (UUID) on create and terminate;
- the rate limits.

Cashfree's docs say that one order allows "multiple payment attempts until one succeeds",
each with its own `cf_payment_id` (the basis of Q37). What the docs leave open is queued for
Cashfree in [the questions file](../../PHASE-7-8-cashfree-questions-pending.md) (CF-A16 to
CF-A26) and listed in §16. Docs answers become CF facts once the owner agrees; sandbox items
once tested. The adapter (§7) is still the only place that uses these names.

## 3. What exists today (read-only check, 2026-11-11)

- No Cashfree code, table or secret exists in the repository. Nothing in `supabase/` or
  `src/` mentions Cashfree.
- Edge functions exist for `commerce-scheduler` and `commerce-task-worker` (Phase 6). The
  scheduler claims tasks once per invocation; its contract's cadence default is one minute.
  The worker dispatches a fixed list of task types and refuses any other with
  `unsupported_task_type`. SDD 01 migration 5 registers the `terminate_provider_order` task
  with a recording stub that this SDD replaces (§12).
- The task framework configures `max_attempts` with CHECK 1 to 5 and stops completed
  failures at that limit. Its existing expired-lease claim can increment beyond it after
  crashes; §10.4 adds bounded reclaim handling for this SDD's task types.
- `marketplace_sec` functions are not exposed to PostgREST; Phase 6 calls them through
  public service-role wrappers (§6). No `marketplace_private` schema exists yet (§4.3).
- The app has a web build and no `expo-dev-client` (checked 2026-11-10), which is why
  D-90 chose web checkout.
- Cashfree sandbox keys exist only in the owner's local `.env.local`. They are never
  printed, never given an `EXPO_PUBLIC_` prefix and never committed.

## 16. Open points and checks at slice start

1. **Fact record additions (before slice 2):** the docs answers in the
   [names list](../../PHASE-7-8-cashfree-names-needed.md) become CF facts once the owner
   agrees. The adapter's tests (AD-01 to AD-08) are written against them and against
   recorded sandbox answers.
2. **Questions with Cashfree** ([status table](../../PHASE-7-8-cashfree-questions-pending.md),
   updated 2026-11-12). Sandbox answered CF-A19's paid and repeated-termination cases on
   API version `2025-01-01`; the expired-order case remains untested and slice 5 rechecks
   the planned API version. CF-A20's signing formula and millisecond timestamp were
   confirmed by SBX-08. Cashfree's docs answer which secret signs an already-sent webhook
   (CF-A24; §13.4); they do not themselves measure API-key invalidation timing. The 409
   code is answered (CF-A23). Dropped: dashboard plus `notify_url` delivery (CF-A22; we use no
   `notify_url`) and list order (CF-A26; status decides, §9.3). Asked in the fourth mail:
   late success after termination (CF-A17; §11.2 keeps polling regardless, as SBX-03
   showed a terminated-requested order becoming `PAID`); create-order timeout and key
   retention (CF-A27; §7.2, §11.6); webhook response time (CF-A21); limits for the refunds
   list and terminate (CF-A29). Asked in the fifth mail (sent 2026-11-12): refunding one of two successes by
   API (CF-A35; §13.1 live-money block); `UNRECONCILED_AUTO_REFUND` (CF-A16; §9.3, §13.2);
   whether the five-minute advice applies to retries (CF-A21; §10.5, D-114); payment and
   order amounts differing (CF-A28; §13.1). No order waits for CF-A16: the first verified
   success counts and §13.5 corrects our records if Cashfree keeps the other payment
   (D-109). A negative order lookup after uncertain creation is not a final no-order
   answer (§7.2, §11.6).
3. **Sandbox checks, slice by slice:** one real webhook confirms §7.2's formula before the
   endpoint accepts anything (slice 4); termination answers (slice 5); same session after a
   failed attempt (slice 3); the UPI-and-card limit on the checkout page (slice 2).
   The completed real-phone payment and verified return are slice 3's gate.
   Before slice 4 acceptance, verify the version actually available and selected in the
   merchant dashboard and receive its subscribed event types through the registered
   endpoint, without `notify_url`. REST API version does not establish webhook
   configuration. If `2026-01-01` is unavailable, stop this gate and review an explicit
   alternative contract; do not silently broaden the allowlist.
4. **Order-level split timing:** SDD 05 adds the split call after verification; nothing in
   this SDD waits for it.
5. **Live keys:** never on the dev project. Production setup waits for account activation
   (CF-63) and is out of this SDD's test-mode scope.
6. **Sandbox test data:** UPI `testsuccess@gocash`, `testfailure@gocash`,
   `testinvalid@gocash` (Cashfree's sandbox page; a dropped payment is made with
   `POST /simulate`, SBX-04); cards with OTP `111000`; Cashfree's `POST /simulate` sets a
   payment `SUCCESS`, `FAILED`, `PENDING` or `USER_DROPPED`. `FAILED` needs a
   `payment_error_code` (for example `ISSUER_NOT_AVAILABLE`). Same-session retry after a
   dropped attempt works through Pay Order (SBX-04); slice 3 still checks it through the
   hosted checkout. Two successes on one order may be producible by starting two attempts
   while the order is unpaid and simulating both (not yet tried; CF-A25 withdrawn from the
   mail). A wrong amount has no documented way to be produced; those tests use recorded
   answers. The sandbox tests used API version `2025-01-01`; slices recheck on `2026-01-01`.
7. **SDD 01 changes made with this revision** (approved SDD 01, owner decisions): the
   minimum-total guard and setting (D-107) and the `checkout.duplicate_payment` notice
   (D-108). Both are recorded in SDD 01 and its reference copy.
8. **Owner decisions:** none open in this SDD. Round 2's questions were decided as D-109 to D-113 (2026-11-12).
   SDD 01 changes from them: the paid-but-no-order screen row (D-112) and the widened `PAID`
   refusal shortcut (D-113), in the parts and the reference copy.

## 17. Choices made in this document, for the owner

The register does not decide these. Each is my proposal and is not policy until approved.
Former items 4 and 8 are now decisions D-105 and D-104.

1. **The Cashfree order expires 16 minutes after creation** (`commerce.provider_order_expiry_seconds = 960`).
   Cashfree's minimum is just over 15 minutes (CF-31). Our own 10-minute reservation and
   15-minute grace are the real limits; we terminate the Cashfree order ourselves (§12).
2. **Poll speed:** every 20 seconds while the reservation or grace is running, then every
   5 minutes for 2 hours, then hourly (`commerce.payment_poll_*` settings). This sees a
   payment made near the end of the 10 minutes well inside the 15-minute grace.
3. **A closed payment Cashfree has not confirmed as ended after 24 hours** opens one admin
   case. Cashfree gave no maximum (CF-65).
4. *(Now D-105.)*
5. **The customer's "I've paid" check** (on return from Cashfree's page) is limited to 10
   calls a minute per customer, and only ever triggers verification.
6. Webhook intake always deduplicates by the verified timestamp/body digest (§10.2); the
   provider's idempotency header is never the sole identity.
7. **A duplicate success is first checked 3 business days later** (D-78's starting wait,
   `commerce.duplicate_reversal_wait_business_days = 3`), then follows D-78 (§13.2).
8. *(Now D-104.)*
9. **Stored webhook bodies are deleted after 180 days**; the derived records stay.
10. **How Cashfree's payment statuses are read** (§7.3): `CANCELLED` and `VOID` count as
    failed; `NOT_ATTEMPTED` (checkout opened, nothing paid) counts as dropped, so it neither
    blocks a new "Pay" nor holds the books; anything unknown counts as pending. If one of
    them later turns into a success, it is still counted (as a late payment if the checkout
    has closed).
11. **Our Cashfree reads stay under its rate limit** (§11.5): at most 25 reads of payments a
    minute in all, with the customer's check, webhooks and expiry workers first.
12. **How long we keep checking an order (B1):** after the checkout closes or converts,
    every 5 minutes for 2 hours, hourly for 7 days, then daily until 60 days; after that,
    SDD 03's daily reconciliation is the safety net. Cashfree gave no time limit for a late
    payment (CF-65), so some limit is a choice; this one costs about one read per order per
    hour in the first week.
13. **India working days for D-78's waits:** Monday to Friday, minus a holiday list the
    admin keeps (`commerce.india_bank_holidays`).
14. **UPI paid from a credit card or a wallet** (`upi_credit_card`, `upi_ppi`) counts as
    UPI, because it is what the `upi` setting allows; prepaid cards, EMI and every other
    group count as `other` (§7.3, D-105).

## 18. Build order (slices)

Each slice ends with its tests passing and its migrations applied to the dev project only
after the owner authorises it (AGENTS.md). Later behaviour a slice needs is a stub with a
fixed contract until its own slice lands (M14).

1. **Schema and wrappers:** §4 tables (with the private schema and the `store_orders`
   foreign key), §5 settings, §6 grants and public wrappers, `customer_payment_status`.
   Tests ST2-01 to ST2-05, SE-01, SE-02.
2. **Adapter, payment start and recovery:** §7 adapter with sandbox keys; §8 and §8.1;
   §11.6 recovery. Needs SDD 01 slice 2 (reservations). Tests AD-01 to AD-08, PA-01 to
   PA-03, PA-05 to PA-08, PA-10, PA-12 to PA-14. Recovery claims and provider-check
   persistence are built here; scheduled three-pass dispatch lands in slice 5. PA-04 and PA-09 move to slice 3 (they need §9).
3. **Verification:** §9 `apply_payment_check`, wired to SDD 01's `convert_paid_checkout`
   and `resolve_late_payment`, to SDD 03's posting stub and to the §13 entry points as stubs
   (a duplicate or wrong amount is classified and recorded; its watch and refund come in
   slice 6). The customer's "I've paid" check. Needs SDD 01 slice 3. Tests PA-04, PA-09,
   VE-01 to VE-04, VE-06 to VE-10, VE-12 to VE-16, VE-18 to VE-20, PA-11.
   VE-05, VE-11a, VE-11b and VE-17 run in slice 6. The real-phone verified return and
   PA-09 gate this slice. VE-21 also runs here.
4. **Webhooks:** §10 endpoint, atomic intake, worker branch, body deletion. Tests WH-01 to
   WH-05, WH-07 to WH-09, WH-11 to WH-13. Service-only work retrieval, atomic finish
   and crash-reclaim exhaustion are included. WH-06 and WH-10 run in slice 7.
5. **Poll and termination:** §11 `commerce-payment-poll`, rate budget; §12 provider steps
   for SDD 01's expiry workers and the real `terminate_provider_order` handler. Tests
   PO-01 to PO-09, TE-01 to TE-08. The locked evidence wrapper, poll fencing and
   atomic rate admission are built before the expiry integration is enabled.
6. **Wrong amount and duplicates:** §13.1 and §13.2, with SDD 04's refund request (or its
   stub) and SDD 01's duplicate notice. Needs SDD 01 slice 6 for D-81 cases. Tests VE-05,
   VE-11a, VE-11b, VE-17, DU-01 to DU-16.
7. **Races and rotation:** §14 races and the §13.4 rotation procedure rehearsed on sandbox.
   Tests WH-06, WH-10, RX2-01 to RX2-16, SE-03 to SE-06, ST2-06.

## 19. Handovers to other SDDs

| SDD | Direction | What |
|---|---|---|
| SDD 01 | 02 calls 01 | Inside verification, in SDD 01 §7's lock order: `marketplace_sec.convert_paid_checkout(p_request_id, p_payment_id, p_paid_at, p_command_id)` for a live checkout, with `p_paid_at` the verification time and `p_command_id` the check ID; `marketplace_sec.resolve_late_payment(...)` per SDD 01 §5.0 for a closed one. On `conversion_failed`, commit the verified payment, the admin case with its 7-day deadline and the hold extension together (SDD 01 §5.10, D-95) |
| SDD 01 | 01 needs from 02 | Provider steps for `expire_reservation` and `expire_payment_grace` (§12.1); the real `terminate_provider_order` handler (§12.2); `p_provider_checked_at` and `p_provider_terminated_at` from `provider_checks` (§4.4); the `store_orders.payment_id` foreign key (§4). The grace setting `commerce.payment_grace_seconds = 900` is confirmed (D-102) |
| SDD 01 | 02 needs from 01 | The minimum-total guard (D-107) and the `checkout.duplicate_payment` event and notice (D-108), emitted when §13.2 records a duplicate |
| SDD 01 | 02 reads | The checkout's `status`, `final_total_minor`, `reservation_expires_at` and owner before a payment may start (§8) |
| SDD 03 | 02 calls 03 | Post every observed receipt once by `receipt:<cf_payment_id>`, a sale only on conversion by `order:<order_id>`, and each provider reversal by `reversal:<cf_refund_id>` (§9.3 step 3); record `PAYMENT_CHARGES_WEBHOOK` charges (CF-29) as reported, never computed; a reconciliation case for a `reversed` success and an `unknown_order` webhook |
| SDD 03 | 03 calls 02 | Daily reconciliation (D-78) that finds a Cashfree payment not recorded or not classified calls §9.2 and §9.3 for its payment; this is the safety net after §11.2's window |
| SDD 04 | 02 calls 04 | Category 6 (wrong amount, D-29) with refund key `wrong_amount:<cf_payment_id>`; category 6a (duplicate) with key `duplicate:<cf_payment_id>` only under D-78's conditions. Each is capped at that attempt's amount, including pending/unknown refund intents. Fractional-paisa or unsupported-currency receipts need Cashfree's exact refundable amount (§13.1); nothing is rounded. Category 5 for late and cancelled cases comes through SDD 01 §5.6. All provider submissions, including category 5, are subject to §13.1's CF-A35 guard, enforced by SDD 04's sender. |
| SDD 05 | 05 uses | The verified payment and order for the split call after verification |
| SDD 08 | 02 needs | Admin cases: wrong amount (alert), duplicate "ask Cashfree", unconfirmed closed payment after 24 hours, dead webhook messages, `auth_failed`, failed conversion (SDD 01 §5.10), key-rotation restart (D-68). Checked commands to record the actual enquiry and Cashfree's answer (`cashfree_asked_at`, `cashfree_answered_at`, §13.2), and the holiday list (§17 item 13) |
| SDD 09 | Later | Carry §15's tests and the security list into the full test plan |

## 20. Traceability

| Decision or fact | Where |
|---|---|
| D-05, D-90, D-105 | §1, §7.2, §7.3, §8.1, §9.3 step 5, VE-13 |
| D-50 | §7.2 (`customer_phone`), AD-07 |
| BC-11 | §9, §10.3, VE-01, WH-04 |
| Q37, BC-15 | §4.1 constraints, §8, §9, PA-04, PA-09, VE-05, RX2-01 to RX2-04 |
| BC-10, D-102 | §11, §12.1, PO-02 |
| D-29 | §9.3, §13.1, DU-01 to DU-03 |
| D-29, D-78, D-109, D-110, D-113, CF-30, CF-64 | §9.3, §13.2, §13.5, DU-04 to DU-10, DU-14, DU-15, VE-05, VE-15, VE-21 |
| D-06, D-85, D-97, D-98 | §9.3 (through SDD 01 §5.6), VE-09, VE-10, VE-11a, VE-11b, VE-17 |
| D-21, D-81 | §8 (no pause guard), §12.2, RX2-07, VE-11a, VE-17 |
| D-95 | §8 guard 2, §9.3 step 4, VE-12 |
| D-101 | §11.3, §12.1, PO-04 |
| D-55, D-68, D-104, D-111 | §8, §13.4, PA-03, SE-06 |
| D-106 | §8 guard 6, PA-10 (§18 slice 2) |
| D-107 | §4.1, SDD 01 guard, ST2-05 |
| D-48, D-108, D-112 | §8 guard 2, §9.4, §13.2, DU-09 |
| CF-31, CF-32, CF-33, CF-65 | §5, §11, §12, §17 item 12 |
| CF-36, CF-37, CF-38 | §7, §10, §13.4 |
| Cashfree API reference names ([names list](../../PHASE-7-8-cashfree-names-needed.md)) | §2, §7.2, §7.3, §10.2, §10.3, §11.5, §12.1, §13.2, AD-05 to AD-08, PA-09, WH-11, PO-07, TE-06 |
| Review round 2 safeguards | §6 callable contracts; §9.3 bound/fresh checks, short evidence wait and receipt/sale separation; §13.5 records correction when Cashfree keeps the other payment; §10.4 atomic finish and crash exhaustion; §11.1 lease fencing; §11.5 atomic permits; §12.1 locked expiry; VE-18 to VE-20, WH-13, PO-09, TE-08, DU-11 to DU-15, VE-21, ST2-06, RX2-15, RX2-16 |
| Handoff §7 (keys, logs) | §6, §7.1, SE-03 to SE-06 |
| Review round 1 items | B1–B5, M1–M18, m1–m8 as noted in §4 to §13 |
