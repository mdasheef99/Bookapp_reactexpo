# SDD 02: Cashfree Payments, Webhooks and Verification

**Status:** approved by the owner on 2026-11-12, after three review rounds, the sandbox tests,
R5, an outside review and Sol's three-angle review, including the remaining technical choices
in §17 as written. Approval of this design does not authorise code or migrations (AGENTS.md);
building starts only when the owner authorises it. Cashfree gates in §16 still apply before
live payments.

History: full draft, 2026-11-11. R5 carried in on 2026-11-12. Written from the approved skeleton, the decision
register, the Cashfree fact record (CF-01 to CF-66) and approved SDD 01. **Review round 1
done** (Muse, DeepSeek, Codex Sol, Codex Luna; [findings](../../PHASE-7-8-sdd02-review-r1.md))
and revised on 2026-11-11 with the owner's decisions D-104 to D-108. Round 2 reviewed and
corrected the remaining design defects on 2026-11-12; evidence and exact edits are in
[round 2 report](../../PHASE-7-8-sdd02-review-r2-sol.md). Revised again on 2026-11-12 from the
[sandbox tests](../../PHASE-7-8-cashfree-sandbox-tests.md) (SBX-01 to SBX-10) and owner
decision D-114: termination answers (§12.1), webhook age limit and version guard (§7.2,
§10.1, §10.5), previous-secret window on key change (§13.4), live-money block on refunding
one of two successes (§13.1, CF-A35), tests TE-03/03a, WH-02/02a, WH-10. Revised again on
2026-11-12 after an outside review: open-items wording (§16 item 8), webhook size cap
and rejection counter (§4.3a, §10.1, WH-14, WH-15), and the late-payment handover to
SDD 03 (§19, PO-10). This round's checked findings and fixes are recorded in
[outside-review report](../../PHASE-7-8-sdd02-review-outside.md). Owner/Cashfree
gates remain in §16.
Review round 3 (Codex Sol, 2026-11-12) findings applied the same day.
R5 references added (CF-76 to CF-83, CF-90; §§2, 4.2, 7.2–7.3, 10.5,
11.2, 11.5–11.6, 12, 13.1–13.2, 15.2–17). The polling schedule and CF-A35 live-money
block are unchanged.
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
| Terminating does not cancel an attempt already started; no new attempt can start. While an attempt is pending, the order stays `TERMINATION_REQUESTED` without a fixed time limit; confirm the result with Get Order | CF-33, CF-65, CF-76 |
| `USER_DROPPED` is final. `NOT_ATTEMPTED` can become `SUCCESS` on sandbox; live behaviour is unknown, so polling is not shortened | CF-77 |
| A second success on one order is reversed by Cashfree, within up to 5 calendar days, seen in transaction details, reports and webhooks; Auto Refunds in the dashboard also lists it | CF-30, CF-64, CF-83 |
| Web checkout opens as redirect, popup or inline; card data stays on Cashfree's page; no PCI certificate needed | CF-34, CF-35 |
| Webhooks are signed with the client secret; one key pair at a time | CF-36 |
| Webhook delivery is at least once, retried at 2, 10 and 30 minutes; reject a timestamp over five minutes old | CF-37 (the age limit is replaced by D-114: retries keep their first timestamp, SBX-10) |
| Without HTTP 200, webhook retries default to 2, 10 and 30 minutes; custom retry policy and manual Batch Resend for missed payment webhooks are in the dashboard. Response timeout and retry-age advice remain open | CF-80 |
| Limits are per minute based on IP and account ID, visible in response headers and Developers > Rate Limits in the dashboard; R5 supplies no numbers | CF-81 |
| Terminate, split and adjustment calls accept `x-idempotency-key` (the API reference adds: UUID format, and create order accepts it too) | CF-38 |
| `PAYMENT_CHARGES_WEBHOOK` reports each payment's charge | CF-29 |
| Sandbox simulates `SUCCESS`, `FAILED`, `PENDING`, `USER_DROPPED`; no disputes, and two successes on one order cannot be simulated. Multiple-success tests use recorded answers | CF-40, CF-66, CF-82 |
| Create Order timeouts can be retried with the same key; retention and a 404's finality are still unknown. A service fee can make the payment amount differ from the order amount | CF-78, CF-79 |

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
   `notify_url`) and list order (CF-A26; status decides, §9.3). **After R5:** CF-A17 is mostly
   answered: `TERMINATION_REQUESTED` lasts while an attempt is pending, without a fixed
   time limit (CF-76); `USER_DROPPED` is final, but `NOT_ATTEMPTED` → `SUCCESS` is confirmed
   only on sandbox (CF-77). Live behaviour of `NOT_ATTEMPTED` is still open; §11.2 keeps
   its full schedule. CF-A27 remains open: R5 repeats safe same-key retry (CF-78), not
   key retention or whether a 404 is final (§7.2, §11.6). CF-A21 remains open for response
   timeout and whether the five-minute advice applies to retries (CF-80; §10.5, D-114
   stays). CF-A29 goes to the owner to read Developers > Rate Limits and response headers:
   per minute, IP and account ID confirmed, no numbers supplied (CF-81). CF-A25 is closed:
   sandbox cannot simulate two successes; tests use recorded answers (CF-82).
   CF-A35 is **not answered**: how to refund one chosen payment by API; §13.1's live-money
   block stays exactly as written. Automatic reversal and its dashboard listing (CF-83)
   do not answer it. CF-A16 also remains open for `UNRECONCILED_AUTO_REFUND` (CF-83;
   §9.3, §13.2). CF-A28 is partly answered: R5 names the service-fee case only (CF-79;
   §13.1). Live payment methods depend on commercials and onboarding, with the Account
   Manager assisting (CF-90); D-05 still specifies UPI and cards only.
   No order waits for CF-A16: the first verified
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
   Also verify the complete subscribed payment, charge, refund, vendor and settlement
   fixtures fit §10.1's proposed byte/time/encoding limits through the actual ingress
   path (WH-14). There is no verified provider-wide maximum message size here; if a
   genuine event exceeds the cap, return to §17 item 15 for review, never silently drop
   it or bypass the cap. Record WH-15's measured flood capacity and the operations
   owner for ingress controls. This document-only review does not run those gates.
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
   hosted checkout. Two successes on one order cannot be simulated on sandbox (CF-82;
   CF-A25 closed); those cases use recorded answers. A wrong amount has no documented
   way to be produced; those tests also use recorded answers. The sandbox tests used
   API version `2025-01-01`; slices recheck on `2026-01-01`.
7. **SDD 01 changes made with this revision** (approved SDD 01, owner decisions): the
   minimum-total guard and setting (D-107) and the `checkout.duplicate_payment` notice
   (D-108). Both are recorded in SDD 01 and its reference copy.
8. **What is still open here.** No business decision is open: round 2's questions were
   decided as D-109 to D-113 (2026-11-12); SDD 01 changes from them: the paid-but-no-order
   screen row (D-112) and the widened `PAID` refusal shortcut (D-113), in the parts and the
   reference copy. The remaining settings and choices in §17
   were approved with this SDD on 2026-11-12 (items 4 and 8 were already decisions). Cashfree questions and provider checks in items 1
   to 3 remain open (CF-A35 blocks live refunds of one of two successes).
   SDD 02 was approved by the owner on 2026-11-12.

## 17. Choices made in this document, for the owner

The register does not decide these. They were my proposals; the owner approved them as
written with SDD 02 on 2026-11-12.
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
    blocks a new "Pay" nor holds the books; anything unknown counts as pending. CF-77
    confirms `USER_DROPPED` is final and `NOT_ATTEMPTED` can become success on sandbox;
    live behaviour of the latter is unknown. A later verified success on the remaining
    paths is still counted (late if the checkout has closed); polling is not shortened.
11. **Our Cashfree reads stay under its rate limit** (§11.5): at most 25 reads of payments a
    minute in all, with the customer's check, webhooks and expiry workers first.
12. **How long we keep checking an order (B1):** after the checkout closes or converts,
    every 5 minutes for 2 hours, hourly for 7 days, then daily until 60 days; after that,
    SDD 03's daily reconciliation is the safety net (contract in §19, test PO-10). Cashfree gave no time limit for a late
    payment (CF-65), so some limit is a choice; this one costs about one read per order per
    hour in the first week.
13. **India working days for D-78's waits:** Monday to Friday, minus a holiday list the
    admin keeps (`commerce.india_bank_holidays`).
14. **UPI paid from a credit card or a wallet** (`upi_credit_card`, `upi_ppi`) counts as
    UPI, because it is what the `upi` setting allows; prepaid cards, EMI and every other
    group count as `other` (§7.3, D-105).
15. **Webhook abuse limits** (§4.3a, §10.1): a body over 64 KB
    (`WEBHOOK_MAX_BODY_BYTES = 65536`, a constant in the function) is refused: unread when
    its declared length is over, otherwise as soon as the streamed byte count passes it.
    Compressed bodies are refused, and the whole body must arrive within 10 seconds. A
    signed timestamp more than 5 minutes in the future is rejected (room for ordinary clock
    difference). Rejected messages are only counted per minute and reason; more than 60 in
    one minute (`commerce.webhook_rejections_alert_per_minute = 60`) opens at most one admin
    case an hour. Counter rows are kept 30 days. At slice 4, check every subscribed event
    type fits these limits. They bound work and storage, not availability under a large
    flood (§10.6).

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
4. **Webhooks:** §10 endpoint, atomic intake, worker branch, body/counter deletion and
   scheduled rejection alerts. Tests WH-01 to WH-05, WH-07 to WH-09, WH-11 to WH-15.
   Service-only work retrieval, atomic finish, bounded telemetry and crash-reclaim
   exhaustion are included. WH-06 and WH-10 run in slice 7. WH-16 and HC-01 to HC-03
   use recording contracts here and run against real receivers in their owning SDDs.
5. **Poll and termination:** §11 `commerce-payment-poll`, rate budget; §12 provider steps
   for SDD 01's expiry workers and the real `terminate_provider_order` handler. Tests
   PO-01 to PO-09, TE-01 to TE-08. The locked evidence wrapper, poll fencing and
   atomic rate admission are built before the expiry integration is enabled.
   PO-10 and PO-11 are SDD 03 acceptance gates; this slice tests the fail-closed poll
   continuation/resumption with health-contract doubles, never clears it on a stub.
6. **Wrong amount and duplicates:** §13.1 and §13.2, with SDD 04's refund request (or its
   stub) and SDD 01's duplicate notice. Needs SDD 01 slice 6 for D-81 cases. Tests VE-05,
   VE-11a, VE-11b, VE-17, DU-01 to DU-16.
7. **Races and rotation:** §14 races and the §13.4 rotation procedure rehearsed on sandbox.
   Tests WH-06, WH-10, RX2-01 to RX2-16, SE-03 to SE-07, ST2-06. SE-07's actual admin
   authentication/recovery wiring is also an SDD 08 acceptance gate.

## 19. Handovers to other SDDs

| SDD | Direction | What |
|---|---|---|
| SDD 01 | 02 calls 01 | Inside verification, in SDD 01 §7's lock order: `marketplace_sec.convert_paid_checkout(p_request_id, p_payment_id, p_paid_at, p_command_id)` for a live checkout; `marketplace_sec.resolve_late_payment(p_request_id, p_payment_id, p_paid_at, p_command_id)` for a closed one, using SDD 01 §5.0's exact inputs/JSON answers. `p_paid_at` is the verification time, never the provider's payment time; `p_command_id` is the check ID. Late resolution can return `converted` or `refund_requested` under §5.6; day 60 adds no refund rule. On `conversion_failed`, commit the verified payment, the admin case with its 7-day deadline and the hold extension together (SDD 01 §5.10, D-95) |
| SDD 01 | 01 needs from 02 | Provider steps for `expire_reservation` and `expire_payment_grace` (§12.1); the real `terminate_provider_order` handler (§12.2); `p_provider_checked_at` and `p_provider_terminated_at` from `provider_checks` (§4.4); the `store_orders.payment_id` foreign key (§4). The grace setting `commerce.payment_grace_seconds = 900` is confirmed (D-102) |
| SDD 01 | 02 needs from 01 | The minimum-total guard (D-107) and the `checkout.duplicate_payment` event and notice (D-108), emitted when §13.2 records a duplicate |
| SDD 01 | 02 reads | The checkout's `status`, `final_total_minor`, `reservation_expires_at` and owner before a payment may start (§8) |
| SDD 03 | 02 calls 03 | Post every observed receipt once by `receipt:<cf_payment_id>`, a sale only on conversion by `order:<order_id>`, and each provider reversal by `reversal:<cf_refund_id>` (§9.3 step 3); record `PAYMENT_CHARGES_WEBHOOK` charges (CF-29) as reported, never computed; a reconciliation case for a `reversed` success and an `unknown_order` webhook |
| SDD 03 | 03 calls 02 | Daily reconciliation (D-78) that finds an unrecorded/unclassified payment or a new reversal/correction calls §9.2 and §9.3, including §13.2/§13.5 on fresh refunds evidence. Record `triggered_by = reconciliation`; every read needs §11.5's permit. SDD 03 owns discovery, coverage/health and durable retry until this handover succeeds, including after the 60-day poll window. It must pass PO-10 and PO-11 before taking over from daily polling |
| SDD 04 | 02 calls 04 | Category 6 (wrong amount, D-29) with refund key `wrong_amount:<cf_payment_id>`; category 6a (duplicate) with key `duplicate:<cf_payment_id>` only under D-78's conditions. Each is capped at that attempt's amount, including pending/unknown refund intents. Fractional-paisa or unsupported-currency receipts need Cashfree's exact refundable amount (§13.1); nothing is rounded. Category 5 for late and cancelled cases comes through SDD 01 §5.6. All provider submissions, including category 5, are subject to §13.1's CF-A35 guard, enforced by SDD 04's sender. |
| SDD 05 | 05 uses | The verified payment and order for the split call after verification |
| SDD 08 | 02 needs | Admin cases: wrong amount (alert), duplicate "ask Cashfree", unconfirmed closed payment after 24 hours, dead webhook messages, `auth_failed`, failed conversion (SDD 01 §5.10), bounded webhook-abuse alerts (§4.3a), key-rotation recovery and restart (D-68). Checked commands to record the actual enquiry and Cashfree's answer (`cashfree_asked_at`, `cashfree_answered_at`, §13.2), and the holiday list (§17 item 13). Verify the admin actor/action; restart is owner-only, audited and gated on real reconciliation, never on rejection counts |
| SDD 09 | Later | Carry §15's tests and the security list into the full test plan |

**Coverage before polling may stop.** SDD 03 must name and verify its independent
provider source, pagination/completeness rules, provider retention and the time field
used for its look-back. Overlap the last successfully covered interval; resume from a
durable cursor after missed runs, and advance coverage only after discovered facts are
durably repaired or queued for retry. An order created months ago may still gain a
success or reversal now (CF-65, D-78): a rolling creation-date look-back cannot exclude
it. Use a verified change-time source covering those old orders, or keep enumerating
known provider order IDs through the existing reads. No finite undisclosed provider
cutoff is assumed. An unknown provider order opens the reconciliation case and remains
owned by SDD 03; never invent its customer/store association from webhook data.

SDD 03 must supply durable progress, outstanding-repair and health evidence with a
checked reader for §11.2's scheduler, and specify how a failed/stale run causes polling
to resume even on already-retired rows. Read-permit denial, provider outage, stale
checks or a failed money transaction retain retry ownership and the original coverage
gap. Its current outline (§6, §8, §10) does not supply this mechanism, source coverage
or acceptance tests; these are requirements for its full draft, not capabilities
provided by the outline. Daily polling remains the fallback until proved.

**Receiving owners and proof.** A recording stub proves the caller's contract only.
It never proves money posting, recovery or permission to clear the poll. Each receiver
must run the named integration proof before its handover is accepted; §18's staged
build order and all live-activation gates still apply.

| Boundary | Owning SDD and required proof |
|---|---|
| Verification → conversion/late resolution | 01 owns §5.0/§5.5/§5.6; 02 wires it. VE-01, VE-09 to VE-12, VE-17, VE-18 and PO-10 cover exact answers, locks and no second effect |
| Expiry/grace/termination evidence and payment FK | 02 owns §12 and the FK; 01 owns the expiry commands. TE-01 to TE-08, PA-08, ST2-02; use the locked wrapper, not caller-supplied evidence times |
| Minimum total, duplicate notice and checkout reads | 01 owns the fields/notice; 02 consumes/emits them. ST2-05, PA-01/02, DU-09/12, SE-02 |
| Receipts, sales, reversals, losses, reported charges and unknown-order cases | 03 owns posting/case repair; 02 supplies stable business identities, amounts/currency and check/event lineage. VE-20, DU-13 to DU-15, WH-07/08 and HC-01 |
| Reconciliation → payment repair and safe poll retirement/resumption | 03 owns discovery, cursor, retry and coverage health; 02 owns verification/poll fallback. PO-10/11 and PO-07/09 |
| Wrong-amount, duplicate and late/cancelled refund obligations | 04 owns intent/sender/cap/recovery; 02 owns categories 6/6a and 01 owns category 5. DU-01 to DU-08, DU-13/16, PO-10 and HC-02; preserve CF-A35 even for previously queued intents |
| Verified order → split; vendor/settlement event handover | 05 owns split and independent recovery; 02 dispatches verified envelopes. WH-08, HC-03; a duplicate, mismatch, refund-only or unresolved receipt never authorizes a second split |
| Lost/rejected payment, fee, refund, vendor or settlement delivery, including rotation | 02 owns payment reads and the trusted rotation record; 03 owns fees/reconciliation, 04 refunds, 05 vendors/settlements. WH-10/16 and HC-01 to HC-03; no rejected row is available as a recovery queue. A missing independent fee source blocks live activation (SDD 03 §6) |
| Cases, enquiry/answer, audited recovery, owner restart | 08 owns checked admin actor/actions and case projection; 02 preserves its guards. SE-07, DU-05 to DU-07, WH-15, WH-10/16 and SE-06 |
| Test-plan handover | 09 owns carrying every §15 ID and the receiver gates above into the full test plan; acceptance checks the mapping without claiming unrun tests passed |

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
| D-06, D-85, D-97, D-98 | §9.3 (through SDD 01 §5.6), §19, VE-09, VE-10, VE-11a, VE-11b, VE-17, PO-10 |
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
| Outside-review corrections (no new business decisions) | §17 item 15 remains proposed; §4.3a, §6, §10.1/§10.6, §11.2, §13.2/§13.4, §19; WH-12/14/15/16, PO-10/11, HC-01 to HC-03, SE-07 |
