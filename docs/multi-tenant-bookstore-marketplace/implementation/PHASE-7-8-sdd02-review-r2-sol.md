<!-- Copied into git on 2026-11-12 from the local, git-excluded file p78sdd02r2/SOL-R2-REPORT.md. Line numbers refer to SDD 02 as it was then. -->

# SDD 02 review round 2 — Sol

2026-11-12. Review and corrections are local documentation only. No network calls, Git commands, runtime tests, package installs, scripts writing files, secret-file reads, database/storage writes or deployments.

Input-line references below identify the author's committed rewrite before these edits; §4 records the exact final replacements with final line locations. `P/` = `docs/multi-tenant-bookstore-marketplace/implementation/phase-7-8-payments-fulfillment/`. F0 = `P/02-cashfree-payments/02-0-overview.md`; F1 = `P/02-cashfree-payments/02-1-data-and-adapter.md`; F2 = `P/02-cashfree-payments/02-2-payment-flows.md`; F3 = `P/02-cashfree-payments/02-3-races-and-tests.md`. SDD 01 parts are in `P/01-checkout-reservation/`; the reference copy is `P/01-checkout-reservation-sdd.md`.

## 1. Round-1 items

| ID | Status before me | Evidence in rewritten text | Change / remaining dependency |
|---|---|---|---|
| B1 | fixed | F2:242 (§11.2): “including `paid` ones” | Kept daily polling until SDD 03's repair handover is healthy; added the poll-window anchor. |
| B2 | fixed | F2:132 (§9.3): “The amount does not matter: Cashfree reverses any second success” | Preserved duplicate-before-amount precedence; retention gate now protects identification. |
| B3 | partly fixed | F2:121 (§9.3): “The first one Cashfree completed is the one it keeps” | Removed this unsupported assertion and time sorting; unresolved-success gate pending CF-A16 and owner Q1. Updated races/examples/tests. |
| B4 | partly fixed | F2:97 (§9.2): “If the payments list holds more than one success” | Refund evidence is now required for every reported success, including a single first success; confirmed representation required. |
| B5 | partly fixed | F2:352 (§13.2): “Keep watching; check again next business day” | Pending reversals no longer override fallback deadlines; bound/fresh check, post-refund branch and idempotent loss handoff. Enquiry-not-sent anchor remains owner Q2. |
| M1 | partly fixed | F2:54 (§9.3): “The command ID is `p_check_id`” | Bound replay to the full payment/check tuple; validate check kinds, owner and successful/fresh evidence. Distinguish repeated HTTP calls from one provider effect. |
| M2 | partly fixed | F2:281 (§11.6): “`not_found` becomes `start_failed`” | Negative lookups stay unknown; frozen round recovery, current-round metadata, safe closed/deadline answer, no-order expiry boundary and termination cases. CF finality remains open. |
| M3 | partly fixed | F2:149 (§9.3): “otherwise `pending` while any attempt is pending” | Allowed verification before creation recording; closed payments stay closed with pending attempts; defined unresolved-success transitions and paid-before-conversion persistence. |
| M4 | partly fixed | F2:115 (§9.3): “It never changes the payment's status” | Older successes remain unresolved until a fresh read; request-time ordering prevents delayed old responses becoming the status watermark. |
| M5 | partly fixed | F2:138 (§9.3): “whatever the conversion answered” | Separated idempotent receipt posting from sale-on-conversion; no sale on failure/refund; admin retry posts the sale once. Receipt posting is appropriate even without an order. |
| M6 | fixed | F1:148 (§4.4): “`cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time`” | Kept discriminated snapshots/exact amount text; added explicit order-check binding, refund currency and nullable provider completion time. |
| M7 | fixed | F1:43 (§4.1): “**When BookConnect verified**” | None; verification time still drives SDD 01 deadlines. |
| M8 | fixed | F1:42 (§4.1): “Composite FK `(verified_attempt_id, id)`” | None to those fixes; private schema/body and reciprocal order FK are specified. |
| M9 | partly fixed | F1:197 (§6): “each passing its arguments unchanged” | Added complete callable contracts for check persistence, private-body dispatch, atomic finish, expiry, poll finish, permits and purge. |
| M10 | partly fixed | F2:175 (§10.1): “inserts the    event by `message_key`” | Atomic intake retained; defined atomic task/event/case completion and crash exhaustion before a sixth dispatch. |
| M11 | fixed | F2:343 (§13.2): “The watch is state on the attempt, not a long-waiting task” | Kept durable watch; tightened its command identity, deadline and refund intent handling. |
| M12 | fixed | F2:233 (§11.1): “runs three passes about 20 seconds apart” | Added explicit schedule/authentication requirement, bounded work and fenced leases; timing is a budget-constrained target. |
| M13 | fixed | F2:224 (§10.6): “A daily scheduler step deletes” | Named the service-only bounded purge executor; retained derived records. |
| M14 | partly fixed | F0:192 (§18): “PA-04 and PA-09 move to slice 3” | Moved the phone-return/reuse acceptance gate to slice 3, assigned omitted PA tests, spelled VE-11a/b and added all new test IDs to slices/traceability. |
| M15 | fixed | F2:34 (§8): “There is no pause guard” | None to payment-pause behavior. Rotation bound contradiction remains owner Q3. |
| M16 | fixed | F2:147 (§9.3): “alerted to fix the method setting (D-105)” | None; UPI/card offered, other-method success still counted with admin alert after the same verification safeguards. |
| M17 | partly fixed | F1:41 (§4.1): “Accepted "Pay" presses for this checkout (D-106)” | Explicit first-row pay_presses=1 and once-only increments; PA-10 is now in slice 2. |
| M18 | partly fixed | F2:29 (§8): “Your reservation has ended. Please reserve again.” | Reused SDD 01's ended screen by attempt state; duplicate wording/event already correct. Failed-conversion wording remains owner Q4, with approved Waiting text meanwhile. |
| m1 | fixed | F1:34 (§4.1): “CHECK `>= 100` (D-107)” | Hardened SDD 01's added setting against values below 100 and made its minimum message use the setting; mirrored both edits and R-21. |
| m2 | fixed | F2:169 (§10.1): “orders carry no `notify_url`” | None; dashboard-only registration is explicit. |
| m3 | fixed | F0:219 (§19): “refund key `wrong_amount:<cf_payment_id>`” | Preserved exact keys/caps; added the attempt-level pending/unknown-intent contract and exact amount/currency exception handling. |
| m4 | fixed | F0:236 (§20): “D-21, D-81” | None to the added decisions; updated affected test references. |
| m5 | partly fixed | F2:269 (§11.5): “after the reads already counted that minute” | Replaced observational accounting with atomic per-endpoint permits, a declared budget table and persisted shared backoff. |
| m6 | partly fixed | F3:133 (§15.2): “after a D-81 cancellation: refunded (D-98)” | Corrected cancellation to D-85; VE-17 separately tests expired checkout/D-98; VE-11b checks same cart version. |
| m7 | partly fixed | F2:78 (§8.1): “Before slice 2 is accepted” | SDK/redirect already specified; moved complete real-phone payment/verified return to slice 3, where verification exists. |
| m8 | fixed | F2:61 (§8): “Answer `RESERVATION_ENDED` with no session” | Kept closed-checkout behavior; additionally blocked session return after the actual reservation deadline. |
| MU-01 | rejection still right | SDD 01 part 2:295 (§5.6): “Same as a duplicate”; F2 §13.1 still follows it. | None to the rejected proposal; no correct extra payment after a mismatch becomes an order. |
| MU-10 | rejection still right | SDD 01 part 2:187 (§5.3): “Raises `PROVIDER_CHECK_STALE`; the task retries; holds stay”. | None to approved SDD 01. Explicitly bound SDD 02 evidence at its own boundary; a stale read still retries safely. |
| LU-04 | rejection still right | F2:134 (§9.3): “The checkout is `reserved` or `awaiting_payment_result`” | None; approved SDD 01 classifies conversion by checkout status. The new session-return deadline check does not change that rule. |

## 2. D-104 to D-108

| Decision | Status before me | Evidence | Change / remaining dependency |
|---|---|---|---|
| D-104 | partly fixed | F2:34 (§8): “There is no pause guard”; §13.4 still claimed a 25-minute maximum. | Existing reservations may pay; no pause guard remains. Rotation is explicitly held behind D-101/D-95 safeguards; owner Q3 reconciles the absolute bound. SDD 01's pause kinds agree. |
| D-105 | fixed | F2:147 (§9.3): “alerted to fix the method setting (D-105)” | None to the decision; retained counted-other-method behavior. SDD 01 has no conflicting method guard. |
| D-106 | partly fixed | F2:38 (§8): “Effects, after the guards pass: add 1 to `pay_presses`.” | First insertion now starts at 1; replay does not count; PA-10 assigned. This belongs to SDD 02; SDD 01's per-customer reservation caps remain. |
| D-107 | fixed at default; partly configurable | SDD 01 part 1:350/reference:434 (§4): “`commerce.min_checkout_total_minor`”; part 2:106/reference:553 guard 13a; R-21 part 5:38/reference:1457. | Validated minimum >=100, dynamic amount in the existing message, and configurable-value tests, identically in each part/reference location. |
| D-108 | partly fixed | SDD 01 part 4:219/reference:1341: “Emitted once per duplicate”; type seed part 1:267/reference:351. | Exact owner duplicate notice is already identical. Added per-attempt event identity, reused ended/Waiting wording; owner Q4 owns any new failed-conversion message. |

## 3. New findings

These include distinct failures introduced or exposed by the rewrite; where a round-1 row overlaps, the scenario here explains the remaining mechanism. No deployed vulnerability or sandbox result is claimed.

| ID | Severity | Where / short exact evidence | Concrete scenario | Fix / authority / remaining gate |
|---|---|---|---|---|
| S2-01 | Blocker | F2:114 (§9.3): “An older check may only insert attempts not yet recorded” | An older read first reveals a success after a newer empty read. It can finalize the attempt while the payment is forbidden to become paid; later checks skip it. | Older successes stay success_unresolved, request a fresh check and cannot convert/refund; monotone receipt posting remains safe. VE-07/VE-18, RX2-15; SDD 01 §5.5/§7, D-95. |
| S2-02 | Blocker | F1:243 (§7.2): “`not_found` → no order” | Create times out; a negative lookup is applied, books later release, then the in-flight create completes. The design falsely promises no charge/no provider work. | Retain unknown round; retry same body/key and reconcile stable order ID. No definitive-no-order shortcut without finality proof. PA-14, TE-08; CF-A23/proposed CF-A27 remains. |
| S2-03 | Major | F1:68 (§4.1.1): “`paid_late` if a success still arrives”; F2:149 (§9.3): “otherwise `pending` while any attempt is pending” | A closed_unpaid payment with a later pending attempt is forced through a forbidden move. A webhook can also verify before the creation recorder, but initiating cannot reach paid. | Closed stays closed; allow initiating→pending/paid/paid_late; persist final paid fields before conversion. ST2-06; SDD 01 §5.5/§7. |
| S2-04 | Major | F1:41 (§4.1): “INTEGER NOT NULL DEFAULT 0”; F2:38 (§8): “after the guards pass: add 1 to `pay_presses`” | The first press increments no row; insertion uses default zero. A literal build may permit a sixth press. | Insert pay_presses=1, increment existing row once, never replay. PA-10; D-106. |
| S2-05 | Major | F2:59 (§8): “Checkout still `reserved`” | The create call ends after the reservation deadline while the timer has not changed its row. The recorder/projection can still return a session despite D-104's within-reservation limit. | Post-lock deadline guard on session return/projection, closed/paid identity handling and close synchronization. PA-02/PA-08; SDD 01 §5.0, D-104. |
| S2-06 | Major | F2:103 (§9.3): “p_refunds_check_id UUID)”; F2:150 (§9.3): “If the order    status is `TERMINATED`” | apply_payment_check has no input identifying the separately stored order-status check; failed/wrong-kind/other-payment checks are not excluded explicitly. | Added nullable order-check ID, full tuple binding, kind/outcome/payment validation and post-lock freshness. VE-18; SDD 01 §5.0/§5.3/§5.4. |
| S2-07 | Major | F1:53 (§4.1): “`provider_paid_at` are set exactly when” | Cashfree omits completion time (CF-A26 is open); the otherwise verified paid row violates this exact-presence constraint. | Provider time is optional, never invented; verified ID and verification time remain mandatory. ST2-06; SDD 01 §3.4 paid_at and CF-A26. |
| S2-08 | Major | F2:352 (§13.2): “Keep watching; check again next business day”; F1:93 (§4.2): “When the admin recorded asking Cashfree” | A permanently pending reversal masks fallback branches; an unopened enquiry clock remains NULL, so five days never elapse. | Pending status does not reset deadlines; actual asked/answered timestamps and refund_due_at are defined. Unsent-enquiry anchor needs owner Q2. DU-11; D-78. |
| S2-09 | Major | F1:83 (§4.2): “NULL when it is not a whole number of paise”; F2:329 (§13.1): “that attempt's full amount” | A fractional-paisa or wrong-currency first receipt reaches a whole-paisa INR refund/ledger contract with no exact representable amount. | Persist exact evidence/intent and case; do not round a refund or ledger amount. Cashfree must establish the exact correction/refundable currency. VE-20; D-29, DOC-15 §5; proposed CF-A28. |
| S2-10 | Major | F1:206 (§6): “No function returns a webhook body”; F2:193 (§10.3): “It reads the event and body” | The Deno worker cannot read the unexposed private body through the listed RPCs; lifecycle completion is also unspecified. | Added sanitized dispatch and atomic finish RPCs, provider-check persistence and purge contracts. WH-13; foundation helpers :8, Phase 6 wrapper pattern, SDD 02 §6/§10. |
| S2-11 | Major | F2:211 (§10.4): “After the last attempt the task is dead-lettered” | A crash occurs after task dead-lettering but before event/case update, or on every fifth leased attempt before completion. Existing claim keeps incrementing. | Atomic event/task/case finish and bounded reclaim before sixth dispatch; worker branch skips generic completion. WH-13. Actual 20260716000026:53–58 increments claims; :87 alone checks the cap. |
| S2-12 | Major | F2:237 (§11.1): “the lease ends when §9.3 sets the next poll time” | Webhook verification can release a poll's live lease; an expired poll owner can then clear a replacement lease. | Token fencing and separate conditional finish for poll and start recovery; ordinary verification cannot release it. PO-08, RX2-16; SDD 01 §7, Phase 6 leased-work pattern. |
| S2-13 | Major | F2:269 (§11.5): “after the reads already counted that minute” | 25 claimed polls and simultaneous foreground reads exceed the cap. The stated counter relation has no migration definition. | Declared account/environment/endpoint budget with pre-call atomic permits, conservative minute-boundary handling and shared retry_not_before. PO-09; names A6/N4, §17 item 11. |
| S2-14 | Major | F2:137 (§9.3): “called once for the counted attempt” | Two ₹400 successes produce ₹800 at Cashfree but only one receipt/reversal handoff in the ledger contract. | Every representable successful receipt posts once; separate sale/reversal/refund/loss identities, including unresolved and duplicate receipts. VE-20/DU-13; SDD 03 §3, DOC-15 §5/FIN-04. |
| S2-15 | Major | F2:54 (§9.3): “The command ID is `p_check_id`”; F2:339 (§13.2): “SDD 01 emits `checkout.duplicate_payment`” | One snapshot finds two duplicates. Reusing the check command ID for both same-type events violates the applied unique index, rolling back verification. | Per-attempt child command/event keys preserve correlation and replay safety; DU-12. Actual 20260716000003:13: “ON public.marketplace_events(command_id, event_type) WHERE command_id IS NOT NULL”. |
| S2-16 | Major | F2:87 (§9.1): “through `commerce-payment-check` (limited by §5)” | The return endpoint takes a provider order ID but has no specified JWT/ownership gate before its service-role verification call. | Verify JWT and server-resolved owner before provider reads; return only checked customer projection. VE-19. This is a missing future boundary, not a claim of a deployed exploit; SDD 01 §5.0, SDD 02 §6. |
| S2-17 | Minor | F3:29 (§14 RX2-13): “A's round no longer matches” | If recorder A commits first while its round is current, it acts; the table incorrectly says no-op in both orders. | Corrected both orders and the distinction between unknown recovery and a genuinely old round. PA-12/PA-13, RX2-13; §8/§11.6. |
| S2-18 | Minor | F3:108 (§15.2): “- PA-10 the sixth "Pay"”; F3:133 (§15.2): “after a D-81 cancellation: refunded (D-98)” | New PA-10–13 tests have no slice; VE-11a still conflates D-85 cancellation with D-98 expiry; phone payment gates precede verification. | Assigned every test, corrected VE-11a/b, added VE-17, moved phone/reuse gate to slice 3; §18/§20 IDs resolve. D-85/D-97/D-98, SDD 01 §5.6. |
| S2-19 | Major | F2:377 (§13.4): “at most the 10-minute reservation plus the 15-minute grace” | D-101 can hold books through an outage; D-95 leaves a paid failed-conversion checkout live. The rotation wait conditions cannot always clear in 25 minutes. | Explicit safe stop; do not rotate on elapsed time alone. Owner Q3 must reconcile D-104 with D-101/D-95. SE-06. |
| S2-20 | Minor | F2:28 (§8): “Your payment went through. Your order is …” | The paid guard also handles failed conversion, where no order exists, but its message implies an order. | Use existing order wording only with an order, otherwise approved Waiting text; owner Q4 owns any new message. D-95/D-108; no unauthorized SDD 01 edit. |
| S2-21 | Minor | SDD 01 part 1:350/reference:434 (§4): “`commerce.min_checkout_total_minor`”; guard 13a says “Orders must be at least ₹1.” | Setting is lowered to 50 or raised to 200. The guard can permit an unpayable total or give the wrong threshold. | Validate >=100, render configured minimum, extend R-21; identical changes in part/reference. D-107 and CF minimum, names B13. |
| S2-22 | Major | F1:40 (§4.1): “the same value is sent on every round” | A definitely refused first round is retried after a minute. Its frozen 16-minute expiry is now within 15 minutes, contrary to CF-31. | Freeze body/expiry within a round; only a new round after definitive no-order refreshes expiry and key. Uncertain retries never extend it. PA-14; CF-31, §17 item 1. |
| S2-23 | Major | SDD 01 part 2:173 (§5.3): “every success on the order is a recorded `amount_mismatch`”. | A mismatch plus duplicate/reversed success leaves the provider PAID and refusing termination. The approved shortcut excludes that combination; treating it as terminated would change SDD 01. | No broadening edit. SDD 02 explicitly holds/retries and identifies owner Q5; recommend approving a narrowly expanded completed-noncounted-receipt rule after CF-A16. |
| S2-24 | Minor | F3:27 (§14 RX2-11): “The fresh refunds check sees the reversal; no refund” | Reversal completes after the outside-lock read but before our refund-intent commit. Provider-first does not ensure the read saw it. | Race table now distinguishes observed reversal from this accepted remote race; DU-13 tests the gap and one loss case. D-78, §13.2. |

## 4. Edit list

The inventory below is the final net change, not intermediate patch attempts. Old/new blocks reproduce replacement text exactly; blank-only old blocks mean insertion. Long blocks are edit text, not evidence quotations. Every existing-file edit is confined to the allowed paths. The report itself is a new file (`p78sdd02r2/SOL-R2-REPORT.md`): old text none; new text is this complete report.

### E-01 — P/02-cashfree-payments/02-0-overview.md:6 (preamble; input line 6)

Old:

```text
and its 31 confirmed items fixed by me on 2026-11-11, with the owner's decisions D-104 to
D-108. Round 2 is to be run by Codex Sol, which confirms the fixes and fixes what remains.
```

New:

```text
and revised on 2026-11-11 with the owner's decisions D-104 to D-108. Round 2 reviewed and
corrected the remaining design defects on 2026-11-12; evidence and exact edits are in
`p78sdd02r2/SOL-R2-REPORT.md`. Owner/Cashfree gates remain in §16; no approval is implied.
```

### E-02 — P/02-cashfree-payments/02-0-overview.md:103 (3. What exists today (read-only check, 2026-11-11); input line 102)

Old:

```text
- Task retries are capped at 5 attempts by the framework (`max_attempts` CHECK 1 to 5).
```

New:

```text
- The task framework configures `max_attempts` with CHECK 1 to 5 and stops completed
  failures at that limit. Its existing expired-lease claim can increment beyond it after
  crashes; §10.4 adds bounded reclaim handling for this SDD's task types.
```

### E-03 — P/02-cashfree-payments/02-0-overview.md:125 (16. Open points and checks at slice start; input line 122)

Old:

```text
   test data (CF-A25); completion time and list order (CF-A26; §9.3). Every rule here is
   safe whichever way they are answered; answers may only simplify.
```

New:

```text
   test data (CF-A25); completion time and list order (CF-A26; §9.3). Unknown retention/reversal evidence blocks selection and fulfilment (§9.3); CF-A16
   and any needed owner decision must land before that gate can be removed. A negative
   order lookup after uncertain creation is not a final no-order answer (§7.2, §11.6).
   Additional questions: can a create finish after a timed-out call and negative lookup,
   and when is refusal/absence final; and what exact amount/currency can be refunded for
   a fractional-paisa or unexpected-currency receipt? (§13.1).
```

### E-04 — P/02-cashfree-payments/02-0-overview.md:133 (16. Open points and checks at slice start; input line 126)

Old:

```text
   failed attempt (slice 2); the UPI-and-card limit on the checkout page (slice 2).
```

New:

```text
   failed attempt (slice 3); the UPI-and-card limit on the checkout page (slice 2).
   The completed real-phone payment and verified return are slice 3's gate.
```

### E-05 — P/02-cashfree-payments/02-0-overview.md:147 (16. Open points and checks at slice start; input line 139)

Old:

```text

```

New:

```text
8. **Owner decisions still needed:** the first-verified rule versus Cashfree's retained
   receipt if CF-A16 differs; the fallback clock when an admin enquiry is not sent;
   the claimed 25-minute key-rotation maximum versus D-101/D-95 exceptions; and wording
   when payment succeeded but conversion failed; and SDD 01's termination-refusal shortcut
   when a wrong-amount receipt also has duplicate/reversed receipts. No new business rule
   is implied here.
```

### E-06 — P/02-cashfree-payments/02-0-overview.md:206 (18. Build order (slices); input line 192)

Old:

```text
   PA-03 and PA-05 to PA-08. PA-04 and PA-09 move to slice 3 (they need §9).
```

New:

```text
   PA-03, PA-05 to PA-08, PA-10, PA-12 to PA-14. Recovery claims and provider-check
   persistence are built here; scheduled three-pass dispatch lands in slice 5. PA-04 and PA-09 move to slice 3 (they need §9).
```

### E-07 — P/02-cashfree-payments/02-0-overview.md:212 (18. Build order (slices); input line 197)

Old:

```text
   VE-01 to VE-04, VE-06 to VE-10, VE-12 to VE-16. VE-05 and VE-11 run in slice 6.
```

New:

```text
   VE-01 to VE-04, VE-06 to VE-10, VE-12 to VE-16, VE-18 to VE-20, PA-11.
   VE-05, VE-11a, VE-11b and VE-17 run in slice 6. The real-phone verified return and
   PA-09 gate this slice; the unresolved CF-A16 retention gate must be resolved first.
```

### E-08 — P/02-cashfree-payments/02-0-overview.md:216 (18. Build order (slices); input line 199)

Old:

```text
   WH-05, WH-07 to WH-09, WH-11, WH-12. WH-06 and WH-10 run in slice 7.
```

New:

```text
   WH-05, WH-07 to WH-09, WH-11 to WH-13. Service-only work retrieval, atomic finish
   and crash-reclaim exhaustion are included. WH-06 and WH-10 run in slice 7.
```

### E-09 — P/02-cashfree-payments/02-0-overview.md:220 (18. Build order (slices); input line 202)

Old:

```text
   PO-01 to PO-08, TE-01 to TE-07.
```

New:

```text
   PO-01 to PO-09, TE-01 to TE-08. The locked evidence wrapper, poll fencing and
   atomic rate admission are built before the expiry integration is enabled.
```

### E-10 — P/02-cashfree-payments/02-0-overview.md:224 (18. Build order (slices); input line 205)

Old:

```text
   VE-11, DU-01 to DU-10.
```

New:

```text
   VE-11a, VE-11b, VE-17, DU-01 to DU-13. The unattended-enquiry owner decision must
   be applied before accepting the fallback integration.
```

### E-11 — P/02-cashfree-payments/02-0-overview.md:227 (18. Build order (slices); input line 207)

Old:

```text
   Tests WH-06, WH-10, RX2-01 to RX2-14, SE-03 to SE-06.
```

New:

```text
   Tests WH-06, WH-10, RX2-01 to RX2-16, SE-03 to SE-06, ST2-06.
```

### E-12 — P/02-cashfree-payments/02-0-overview.md:237 (19. Handovers to other SDDs; input line 217)

Old:

```text
| SDD 03 | 02 calls 03 | Post the counted payment once, keyed by `cf_payment_id`, in the verification transaction (§9.3 step 3); record `PAYMENT_CHARGES_WEBHOOK` charges (CF-29) as reported, never computed; a reconciliation case for a `reversed` success and an `unknown_order` webhook |
```

New:

```text
| SDD 03 | 02 calls 03 | Post every observed receipt once by `receipt:<cf_payment_id>`, a sale only on conversion by `order:<order_id>`, and each provider reversal by `reversal:<cf_refund_id>` (§9.3 step 3); record `PAYMENT_CHARGES_WEBHOOK` charges (CF-29) as reported, never computed; a reconciliation case for a `reversed` success and an `unknown_order` webhook |
```

### E-13 — P/02-cashfree-payments/02-0-overview.md:239 (19. Handovers to other SDDs; input line 219)

Old:

```text
| SDD 04 | 02 calls 04 | Category 6 (wrong amount, D-29) with refund key `wrong_amount:<cf_payment_id>`; category 6a (duplicate) with key `duplicate:<cf_payment_id>` only under D-78's conditions. Each is capped at that attempt's amount, so refunds for one attempt never exceed what that attempt paid. Category 5 for late and cancelled cases comes through SDD 01 §5.6 |
```

New:

```text
| SDD 04 | 02 calls 04 | Category 6 (wrong amount, D-29) with refund key `wrong_amount:<cf_payment_id>`; category 6a (duplicate) with key `duplicate:<cf_payment_id>` only under D-78's conditions. Each is capped at that attempt's amount, including pending/unknown refund intents. Fractional-paisa or unsupported-currency receipts need Cashfree's exact refundable amount (§13.1); nothing is rounded. Category 5 for late and cancelled cases comes through SDD 01 §5.6 |
```

### E-14 — P/02-cashfree-payments/02-0-overview.md:241 (19. Handovers to other SDDs; input line 221)

Old:

```text
| SDD 08 | 02 needs | Admin cases: wrong amount (alert), duplicate "ask Cashfree", unconfirmed closed payment after 24 hours, dead webhook messages, `auth_failed`, failed conversion (SDD 01 §5.10), key-rotation restart (D-68). A checked command to record Cashfree's answer on a duplicate (`cashfree_answer`, §13.2), and the holiday list (§17 item 13) |
```

New:

```text
| SDD 08 | 02 needs | Admin cases: wrong amount (alert), duplicate "ask Cashfree", unconfirmed closed payment after 24 hours, dead webhook messages, `auth_failed`, failed conversion (SDD 01 §5.10), key-rotation restart (D-68). Checked commands to record the actual enquiry and Cashfree's answer (`cashfree_asked_at`, `cashfree_answered_at`, §13.2), and the holiday list (§17 item 13) |
```

### E-15 — P/02-cashfree-payments/02-0-overview.md:255 (20. Traceability; input line 235)

Old:

```text
| D-06, D-85, D-97, D-98 | §9.3 (through SDD 01 §5.6), VE-09 to VE-11 |
| D-21, D-81 | §8 (no pause guard), §12.2, RX2-07, VE-11 |
```

New:

```text
| D-06, D-85, D-97, D-98 | §9.3 (through SDD 01 §5.6), VE-09, VE-10, VE-11a, VE-11b, VE-17 |
| D-21, D-81 | §8 (no pause guard), §12.2, RX2-07, VE-11a, VE-17 |
```

### E-16 — P/02-cashfree-payments/02-0-overview.md:260 (20. Traceability; input line 240)

Old:

```text
| D-106 | §8 guard 6, PA-10 |
```

New:

```text
| D-106 | §8 guard 6, PA-10 (§18 slice 2) |
```

### E-17 — P/02-cashfree-payments/02-0-overview.md:266 (20. Traceability; input line 246)

Old:

```text

```

New:

```text
| Review round 2 safeguards | §6 callable contracts; §9.3 bound/fresh checks, unresolved retained identity and receipt/sale separation; §10.4 atomic finish and crash exhaustion; §11.1 lease fencing; §11.5 atomic permits; §12.1 locked expiry; VE-18 to VE-20, WH-13, PO-09, TE-08, DU-11 to DU-13, ST2-06, RX2-15, RX2-16 |
```

### E-18 — P/02-cashfree-payments/02-1-data-and-adapter.md:17 (4. Tables; input line 17)

Old:

```text
except that new task types are added to the task framework's allowed list as SDD 01 does.
```

New:

```text
except the task-type registration and crash-reclaim guard in §10.4. The migration also
creates `marketplace_sec.cashfree_api_budget(account_scope TEXT, environment TEXT,
endpoint TEXT, window_started_at TIMESTAMPTZ, used INTEGER CHECK (used >= 0),
retry_not_before TIMESTAMPTZ, PRIMARY KEY (account_scope, environment, endpoint,
window_started_at))` for §11.5. `account_scope` is a non-secret server-configured identifier;
no key is stored. Only service-role functions can access it.
```

### E-19 — P/02-cashfree-payments/02-1-data-and-adapter.md:45 (4.1 `payments` (one per checkout); input line 40)

Old:

```text
| `provider_order_expires_at` | TIMESTAMPTZ NOT NULL | Fixed when the first round begins: post-lock time plus §5's expiry; the same value is sent on every round, so a retried request body never changes |
```

New:

```text
| `create_request_snapshot` | JSONB NOT NULL | Frozen create body built by the server for the current round, including contact snapshot phone and return URL; service-only, never returned or logged. Identical on every retry within that round (§7.2) |
| `provider_order_expires_at` | TIMESTAMPTZ NOT NULL | Fixed for each round: post-lock time plus §5's expiry. Only a new round after definitive no-order may refresh it; uncertain retries never change the body |
```

### E-20 — P/02-cashfree-payments/02-1-data-and-adapter.md:50 (4.1 `payments` (one per checkout); input line 44)

Old:

```text
| `provider_paid_at` | TIMESTAMPTZ | Cashfree's completion time of the counted attempt, for reconciliation only |
```

New:

```text
| `provider_paid_at` | TIMESTAMPTZ | Cashfree's completion time of the counted attempt, for reconciliation only; nullable when Cashfree omits it |
```

### E-21 — P/02-cashfree-payments/02-1-data-and-adapter.md:53 (4.1 `payments` (one per checkout); input line 47)

Old:

```text
| `next_poll_at` | TIMESTAMPTZ | Null only when the poll window of §11.2 has ended |
```

New:

```text
| `next_poll_at` | TIMESTAMPTZ | NULL before creation resolves or for definitive no-order, otherwise only after §11.2's safe reconciliation handover |
```

### E-22 — P/02-cashfree-payments/02-1-data-and-adapter.md:55 (4.1 `payments` (one per checkout); input line 49)

Old:

```text

```

New:

```text
| `poll_lease_token` | UUID | Fences completion by an expired poll owner (§11.1) |
| `poll_window_started_at` | TIMESTAMPTZ | Set once when the checkout closes or converts; anchors §11.2 even for a paid checkout |
```

### E-23 — P/02-cashfree-payments/02-1-data-and-adapter.md:61 (4.1 `payments` (one per checkout); input line 53)

Old:

```text
Constraints: `verified_attempt_id`, `paid_at` and `provider_paid_at` are set exactly when
`status` is `paid` or `paid_late`. `amount_minor` and `provider_order_expires_at` never
change after creation. Because `request_id` is unique, a checkout can never have two
```

New:

```text
Constraints: `verified_attempt_id` and `paid_at` are set exactly when `status` is `paid`
or `paid_late`. `provider_paid_at` is copied if present and never invented. `amount_minor` never changes after creation. The expiry and create body change only
when a definitively refused round is replaced; they never change within a round. Because `request_id` is unique, a checkout can never have two
```

### E-24 — P/02-cashfree-payments/02-1-data-and-adapter.md:70 (4.1.1 Payment states; input line 62)

Old:

```text
| `initiating` | A creation round is open; Cashfree may or may not have the order yet | `created`; `start_failed` (only when Cashfree **confirmed** there is no order); `closed_unpaid` (the checkout closed during the round, M3) |
| `start_failed` | Cashfree confirmed it holds no order for this ID: it refused the request, or a read after a timeout found none. Nothing was charged | `initiating` (a new round, §8); `closed_unpaid` when the checkout closes |
```

New:

```text
| `initiating` | A creation round is open; Cashfree may or may not have the order yet | `created`; `pending`, `paid`, `paid_late` if verification wins before the recorder; `start_failed` (only a definitive refusal, §7.2); `closed_unpaid` (the checkout closed and creation is resolved, M3) |
| `start_failed` | Cashfree definitively refused creation with no unresolved invocation (§7.2). A negative read after timeout is insufficient. Nothing was charged | `initiating` (a new round, §8); `closed_unpaid` when the checkout closes |
```

### E-25 — P/02-cashfree-payments/02-1-data-and-adapter.md:76 (4.1.1 Payment states; input line 68)

Old:

```text
| `closed_unpaid` | The checkout closed with no counted success | `paid_late` if a success still arrives; otherwise stays, still polled (§11.2) |
```

New:

```text
| `closed_unpaid` | The checkout closed with no counted success | `paid_late` if a success still arrives; otherwise stays, even with a pending attempt, still polled (§11.2) |
```

### E-26 — P/02-cashfree-payments/02-1-data-and-adapter.md:78 (4.1.1 Payment states; input line 70)

Old:

```text
A trigger allows only these moves. §9.3 computes the payment's status once, at the end of
its transaction, and writes it only if it differs, so no transaction makes an intermediate
move the trigger would refuse.
```

New:

```text
A trigger allows only these moves. §9.3 computes one final payment state and writes it
only if it differs. It persists a counted receipt's paid state and verified fields before
calling SDD 01 conversion in the same transaction, with no intermediate status move the
trigger would refuse.
```

### E-27 — P/02-cashfree-payments/02-1-data-and-adapter.md:95 (4.2 `payment_attempts` (one per Cashfree payment); input line 86)

Old:

```text
| `status` | TEXT NOT NULL | `pending`, `success`, `failed`, `dropped`, `amount_mismatch`, `duplicate_success`, `reversed` |
```

New:

```text
| `status` | TEXT NOT NULL | `pending`, `success_unresolved`, `success`, `failed`, `dropped`, `amount_mismatch`, `duplicate_success`, `reversed` |
```

### E-28 — P/02-cashfree-payments/02-1-data-and-adapter.md:100 (4.2 `payment_attempts` (one per Cashfree payment); input line 91)

Old:

```text
| `watch_stage` | TEXT | For `duplicate_success` only (§13.2): `waiting_reversal`, `asked_cashfree`, `refund_due`, `refund_requested`, `reversed`, `closed` |
```

New:

```text
| `watch_stage` | TEXT | For `duplicate_success` only (§13.2): `waiting_reversal`, `asked_cashfree`, `refund_due`, `refund_requested`, `reversed` |
```

### E-29 — P/02-cashfree-payments/02-1-data-and-adapter.md:104 (4.2 `payment_attempts` (one per Cashfree payment); input line 95)

Old:

```text

```

New:

```text
| `cashfree_answered_at` | TIMESTAMPTZ | When the checked admin command records the answer; anchors the 1-business-day deadline |
| `refund_due_at` | TIMESTAMPTZ | Fixed D-78 deadline; a pending reversal never moves it later |
| `last_watch_check_id` | UUID, FK `provider_checks(id)` | Last refunds check consumed by §13.2; replay changes nothing |
```

### E-30 — P/02-cashfree-payments/02-1-data-and-adapter.md:111 (4.2 `payment_attempts` (one per Cashfree payment); input line 99)

Old:

```text
then classified like any success (§9.3); `success`, `amount_mismatch`,
```

New:

```text
then classified like any success (§9.3). `success_unresolved` means a reported success
whose retained-payment identity or reversal evidence is unknown (§9.3); it may move to
`success`, `amount_mismatch`, `duplicate_success` or `reversed`. `success`, `amount_mismatch`,
```

### E-31 — P/02-cashfree-payments/02-1-data-and-adapter.md:145 (4.4 `provider_checks` (every call we make to Cashfree about a payment); input line 131)

Old:

```text
| `id` | UUID PK | Also the command ID of the step that applies it (§9.3, M1) |
```

New:

```text
| `id` | UUID PK | One HTTP invocation's evidence; a completed row is immutable. Also the verification command ID (§9.3, M1); duplicate watches derive per-attempt child IDs |
```

### E-32 — P/02-cashfree-payments/02-1-data-and-adapter.md:153 (4.4 `provider_checks` (every call we make to Cashfree about a payment); input line 139)

Old:

```text

```

New:

```text
| `retry_after_seconds` | INTEGER | Cashfree's rate-limit wait, when supplied; persisted for cross-invocation backoff (§11.5) |
```

### E-33 — P/02-cashfree-payments/02-1-data-and-adapter.md:165 (4.4 `provider_checks` (every call we make to Cashfree about a payment); input line 150)

Old:

```text
| `read_refunds` | For each refund: `cf_refund_id`, `cf_payment_id`, `refund_type`, `refund_status`, amount text and paise, `processed_at` |
```

New:

```text
| `read_refunds` | For each refund: `cf_refund_id`, `cf_payment_id`, `refund_type`, `refund_status`, amount text and paise, currency, `processed_at` |
```

### E-34 — P/02-cashfree-payments/02-1-data-and-adapter.md:168 (4.4 `provider_checks` (every call we make to Cashfree about a payment); input line 153)

Old:

```text
Checks are ordered by `(answered_at, id)`; "newer" and "older" in §9.3 mean exactly this
(M4). SDD 01's expiry commands receive `p_provider_checked_at = answered_at` of a fresh `ok`
```

New:

```text
Checks are ordered by `(requested_at, id)`; "newer" and "older" in §9.3 mean exactly this
(M4). A slow earlier request cannot overwrite a later request's snapshot. SDD 01's expiry commands receive `p_provider_checked_at = answered_at` of a fresh `ok`
```

### E-35 — P/02-cashfree-payments/02-1-data-and-adapter.md:192 (5. Settings (`marketplace_policy_config`); input line 177)

Old:

```text
| `commerce.cashfree_reads_per_minute` | 25 | §11.5; all reads together, under Cashfree's sandbox limit of 30 |
```

New:

```text
| `commerce.cashfree_reads_per_minute` | 25 | §11.5; every trigger shares the per-endpoint cap, under Cashfree's sandbox payment-read limit of 30 |
```

### E-36 — P/02-cashfree-payments/02-1-data-and-adapter.md:203 (6. Access; input line 188)

Old:

```text
- No client role can insert, update or delete any §4 table. All writes go through the
  functions in §8 to §13.
```

New:

```text
- Enable RLS on all new public tables and revoke all table privileges from `PUBLIC`,
  `anon` and `authenticated`; do not add direct client read policies. No client role can
  read or write attempts, checks, events or sessions by table access. Customer payment
  reads use only the checked projection below. Service writes use the §6 wrappers.
```

### E-37 — P/02-cashfree-payments/02-1-data-and-adapter.md:215 (6. Access; input line 198)

Old:

```text

```

New:

```text
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
```

### E-38 — P/02-cashfree-payments/02-1-data-and-adapter.md:242 (6. Access; input line 202)

Old:

```text
  `payment_session_id`. It never returns attempts, checks or webhook data.
```

New:

```text
  `payment_session_id`, only before the post-lock reservation deadline and while §8's
  pending, mismatch and unresolved-success guards permit it. A read does not grant a new
  Pay press: only §8 authorizes opening checkout. It never returns attempts, checks or
  webhook data.
```

### E-39 — P/02-cashfree-payments/02-1-data-and-adapter.md:272 (7.2 Operations; input line 229)

Old:

```text
| `createOrder(payment)` | `POST /orders` with `order_id` = our `provider_order_id`; `order_amount` in rupees from `amount_minor` (2 decimals); `order_currency: INR`; `customer_details.customer_id` = the checkout's `user_id` without dashes (Cashfree allows letters and digits only) and `customer_phone` = the 10-digit mobile number from the contact snapshot (SDD 01 guard 9, D-50); `order_expiry_time` = `provider_order_expires_at` (ISO 8601 with offset); `order_meta.payment_methods: "upi,cc,dc"` (D-05); `order_meta.return_url` carrying our `provider_order_id` (Cashfree adds nothing to it). No `notify_url`: webhooks come only from the one dashboard endpoint (§10.1, m2). Returns `cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time` | `x-idempotency-key`: a UUID derived from the payment ID and `start_round`, so a timeout retry within a round repeats safely and a new round gets a new key. The body is the same on every call for one payment. |
| `getOrder(id)` | `GET /orders/{order_id}`; returns `order_status` and `payment_session_id`. HTTP 404 is outcome `not_found` | Read only |
```

New:

```text
| `createOrder(payment)` | `POST /orders` with `order_id` = our `provider_order_id`; `order_amount` in rupees from `amount_minor` (2 decimals); `order_currency: INR`; `customer_details.customer_id` = the checkout's `user_id` without dashes (Cashfree allows letters and digits only) and `customer_phone` = the 10-digit mobile number from the contact snapshot (SDD 01 guard 9, D-50); `order_expiry_time` = `provider_order_expires_at` (ISO 8601 with offset); `order_meta.payment_methods: "upi,cc,dc"` (D-05); `order_meta.return_url` carrying our `provider_order_id` (Cashfree adds nothing to it). No `notify_url`: webhooks come only from the one dashboard endpoint (§10.1, m2). Returns `cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time` | `x-idempotency-key`: a UUID derived from the payment ID and `start_round`, so a timeout retry within a round repeats safely and a new round gets a new key. Send the frozen `create_request_snapshot`, never rebuild it from mutable configuration. The body is the same on every call within one round. |
| `getOrder(id)` | `GET /orders/{order_id}`; returns `cf_order_id`, `order_status`, `payment_session_id` and `order_expiry_time`. HTTP 404 is outcome `not_found` | Read only |
```

### E-40 — P/02-cashfree-payments/02-1-data-and-adapter.md:277 (7.2 Operations; input line 234)

Old:

```text
| `verifyWebhook(raw, headers)` | Base64 of HMAC-SHA256, keyed with the client secret (CF-36), over the `x-webhook-timestamp` value directly followed by the raw body, with no separator; compared in constant time with `x-webhook-signature`. Then the age rule (CF-37) on the timestamp, read as epoch milliseconds (§16 item 7) | Pure function |
```

New:

```text
| `verifyWebhook(raw, headers)` | Base64 of HMAC-SHA256, keyed with the client secret (CF-36), over the `x-webhook-timestamp` value directly followed by the raw body, with no separator; compared in constant time with `x-webhook-signature`. Then the age rule (CF-37) on the timestamp, read as epoch milliseconds (§16 item 2, CF-A20) | Pure function |
```

### E-41 — P/02-cashfree-payments/02-1-data-and-adapter.md:285 (7.2 Operations; input line 242)

Old:

```text
| 400 or 422 for this request (a definite refusal) | `refused`: no order exists; Cashfree's code is kept |
| Timeout, unreachable, 5xx or 429 | Unknown: read the order. `ok` → created; `not_found` → no order; any other read result → still unknown, and the round stays `initiating` for recovery (§11.6) |
```

New:

```text
| 400 or 422 | `refused` only for a definitive validation refusal with no earlier create still unresolved. `idempotency_error` is never proof no order exists: read the stable order ID and otherwise keep `initiating` (CF-A23; additional finality question in §16) |
| Timeout, unreachable, 5xx or 429 | Unknown: read the order. `ok` → created; `not_found` or any other result → still unknown, and the round stays `initiating` for recovery (§11.6). A negative lookup does not prove an in-flight create cannot finish later |
```

### E-42 — P/02-cashfree-payments/02-1-data-and-adapter.md:298 (7.2 Operations; input line 255)

Old:

```text

```

New:

```text
Each physical retry gets a new check ID and preserves the original invocation's evidence;
an HTTP timeout is a completed `timeout` check. A termination retry may reuse its provider
idempotency key only for that same uncertain invocation, never rewrite its check row.
```

### E-43 — P/02-cashfree-payments/02-1-data-and-adapter.md:332 (7.3 Mapping; input line 286)

Old:

```text

```

New:

```text

Refund type and status are preserved unchanged, including unknown values. Only a
completed, full-amount, same-currency automatic reversal linked to the same
`cf_payment_id` is reversal evidence. The candidate automatic-refund names in §9.3 and
§13.2 remain unconfirmed (names D9, CF-A16); absence of such a row is not proof of no
reversal until Cashfree confirms the representation. Unknown or incomplete evidence
keeps success resolution pending, with an admin case; it never authorizes a refund or
fulfilment. Once the representation is confirmed, a known incomplete reversal does not
postpone D-78's fallback deadlines (§13.2). Decimal text is parsed exactly, never with rounding or binary-float equality.
```

### E-44 — P/02-cashfree-payments/02-2-payment-flows.md:28 (8. Starting a payment; input line 28)

Old:

```text
| 2. The payment is not `paid` or `paid_late` | `ORDER_ALREADY_PAID` | SDD 01's wording: "Your payment went through. Your order is …" (SDD 01 §5.2) |
| 3. Checkout is `reserved` and the time is before `reservation_expires_at` | `RESERVATION_ENDED` | Your reservation has ended. Please reserve again. |
| 4. The payment is not `initiating`, and no attempt is `pending` | `PAYMENT_IN_PROGRESS` | A payment is already in progress. Please wait for it to finish. |
```

New:

```text
| 2. The payment is not `paid` or `paid_late` | `ORDER_ALREADY_PAID` | For an existing order, SDD 01's wording: "Your payment went through. Your order is …" (§5.2). Without an order, the approved Waiting text (§9.4) pending the owner's failed-conversion wording decision (§16 item 8) |
| 3. Checkout is `reserved` and the time is before `reservation_expires_at` | `RESERVATION_ENDED` | SDD 01 §12's ended screen, selected by whether an attempt exists (§9.4) |
| 4. The payment is neither `initiating` nor `pending`, and no attempt is `pending` or `success_unresolved` | `PAYMENT_IN_PROGRESS` | A payment is already in progress. Please wait for it to finish. |
```

### E-45 — P/02-cashfree-payments/02-2-payment-flows.md:38 (8. Starting a payment; input line 38)

Old:

```text
Effects, after the guards pass: add 1 to `pay_presses`. Then by the payment's state:
```

New:

```text
Effects, after the guards pass: set `pay_presses = 1` on insertion, or increment an
existing row once. A replay never increments it. Then by the payment's state:
```

### E-46 — P/02-cashfree-payments/02-2-payment-flows.md:43 (8. Starting a payment; input line 42)

Old:

```text
| No payment row | Insert one: `initiating`, `start_round = 1`, `start_command_id = p_command_id`, `start_started_at` and `provider_order_expires_at` from the post-lock time, `amount_minor = final_total_minor` |
| `start_failed` | New round: `start_round + 1`, `start_command_id`, `start_started_at`; status `initiating` |
```

New:

```text
| No payment row | Insert one: `initiating`, `start_round = 1`, `start_command_id = p_command_id`, `start_started_at` and `provider_order_expires_at` from the post-lock time, `amount_minor = final_total_minor`, `pay_presses = 1`; freeze `create_request_snapshot` from server-owned amount/contact/return configuration |
| `start_failed` | New round: `start_round + 1`, `start_command_id`, `start_started_at`; refresh expiry from the post-lock clock and freeze that round's body (CF-31); status `initiating` |
```

### E-47 — P/02-cashfree-payments/02-2-payment-flows.md:48 (8. Starting a payment; input line 47)

Old:

```text
Only one round can be `initiating` at a time (guard 4), so concurrent presses make one
Cashfree call per round.
```

New:

```text
Only one round can be `initiating` at a time (guard 4). Replayed HTTP requests may repeat
a create call with the same frozen body and provider key; they create one provider order,
not necessarily one physical HTTP call. On replay the app first reads the current payment
state and opens checkout only after a newly accepted Pay press or its own still-valid
start answer; a stale stored session never bypasses the current guards.
```

### E-48 — P/02-cashfree-payments/02-2-payment-flows.md:59 (8. Starting a payment; input line 55)

Old:

```text
customer advisory lock, payment, checkout. It acts only if the payment is still
`initiating` and `p_start_round = start_round`; otherwise it changes nothing and returns
the payment's current state (a stale or repeated call, M2).
```

New:

```text
customer advisory lock, payment, checkout. It acts only if `p_start_round = start_round`; an old round changes nothing. An `ok`
answer may fill missing provider identity for the current round even if verification
already won, but never replaces conflicting identity or changes a `paid`/`paid_late`
state. The table's state changes apply only while still `initiating`. Replays return the
current state without another effect (M2). Validate that the check belongs
to this payment and round and is a `create_order` or recovery `read_order` check; other
inputs raise `INVALID_COMMAND`. An `ok` answer always persists the provider IDs, session
and initial poll time before applying the table. A session is returned only while the
checkout is `reserved` and post-lock time is before `reservation_expires_at`; after that,
return `RESERVATION_ENDED` without a session and let the expiry worker finish. If the
checkout closed, set `poll_window_started_at` and enqueue termination in the same commit.
```

### E-49 — P/02-cashfree-payments/02-2-payment-flows.md:74 (8. Starting a payment; input line 62)

Old:

```text
| No order (`refused` or `not_found`) | `start_failed`. The app shows "We couldn't start the payment. Nothing was charged. Please try again." | `closed_unpaid`, `closed_at`. Nothing to terminate |
```

New:

```text
| No order (definitive `refused`, §7.2) | `start_failed`. The app shows "We couldn't start the payment. Nothing was charged. Please try again." | `closed_unpaid`, `closed_at`. Nothing to terminate |
```

### E-50 — P/02-cashfree-payments/02-2-payment-flows.md:90 (8.1 Web checkout in the app (m7); input line 78)

Old:

```text
calls `commerce-payment-check`. Before slice 2 is accepted, the owner pays once on a real
phone on sandbox (D-90).
```

New:

```text
calls `commerce-payment-check`. Before slice 3 is accepted, the owner pays once on a real
phone on sandbox, including the verified return (D-90).
```

### E-51 — P/02-cashfree-payments/02-2-payment-flows.md:98 (9.1 What triggers it; input line 86)

Old:

```text

```

New:

```text
`commerce-payment-check` verifies the JWT and resolves the checkout's owner on the server
before any provider call. A stranger or unknown order gets `COMMERCE_ENTITY_UNAVAILABLE`
with no provider call. The answer is only the caller's `customer_payment_status`
projection, never §9.3's internal attempts or check IDs.
```

### E-52 — P/02-cashfree-payments/02-2-payment-flows.md:113 (9.2 Reading Cashfree (outside locks); input line 97)

Old:

```text
is needed, and record the checks (§4.4). If the payments list holds more than one success,
or a success while the payment already has a counted attempt, also call `getRefunds`, so
a success Cashfree has already reversed is recognised (B4). No database lock is held during
a call. If Cashfree cannot be reached, the check records `unreachable`, nothing else
```

New:

```text
is needed, and record the checks (§4.4). For every reported success, including a single first success,
also call `getRefunds`, so a success Cashfree has already reversed is recognised (B4). No database lock is held during
a call. The caller passes each read's check ID explicitly to §9.3; checks from another
payment or of a different kind are never interchangeable. If Cashfree cannot be reached, the check records `unreachable`, nothing else
```

### E-53 — P/02-cashfree-payments/02-2-payment-flows.md:119 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 103)

Old:

```text
### 9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID)`
```

New:

```text
### 9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`
```

### E-54 — P/02-cashfree-payments/02-2-payment-flows.md:123 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 107)

Old:

```text
(M1). `p_refunds_check_id` is NULL unless §9.2 read refunds.
```

New:

```text
(M1). `p_refunds_check_id` is NULL unless §9.2 read refunds. Bind both IDs and
`p_payment_id` and nullable `p_order_check_id` to the saved command inputs; any changed tuple raises `INVALID_COMMAND`.
The checks must belong to this payment: `p_check_id` is `read_payments`, the optional
refunds check is `read_refunds`, and the optional order check is `read_order`. They must
have outcome `ok` and be
complete. Any required read that failed or is older than
`commerce.provider_check_max_age_seconds` by the post-lock clock returns
`PROVIDER_CHECK_STALE` before classification, conversion or refund; the trigger retries
with fresh checks. A missing refunds check for a reported success also fails closed.
A cached pre-refund check cannot authorize a later refund request. Order status is used
only from `p_order_check_id`, never inferred from a payments list. NULL means that no
order-status fact is applied.
```

### E-55 — P/02-cashfree-payments/02-2-payment-flows.md:140 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 113)

Old:

```text
**Newer and older checks (M4).** A check is older if its `(answered_at, id)` is at or
before that of `last_check_id`. An older check may only insert attempts not yet recorded
and move recorded attempts forward (§4.2). It never changes the payment's status,
`last_check_id`, `provider_closed_confirmed_at` or `next_poll_at`. Any backward move is
skipped, never attempted.
```

New:

```text
**Newer and older checks (M4).** A check is older if its `(requested_at, id)` is at or
before that of `last_check_id`. Only `read_payments` checks participate in this ordering.
An older check may add attempt evidence and a reported success as `success_unresolved`,
but may not finalize a newly discovered success or invoke conversion or refund. Receipt
posting remains allowed and idempotent, as step 3 requires for every observed receipt.
It returns `needs_fresh_read = true`; the caller obtains and applies a new check, even if
the older check was otherwise replayed. It never changes the payment's status,
`last_check_id`, `provider_closed_confirmed_at` or `next_poll_at`. A recorded terminal
attempt is not downgraded by an older pending/failed answer. This prevents both a stale
status overwrite and a success marked terminal with no matching paid payment.
```

### E-56 — P/02-cashfree-payments/02-2-payment-flows.md:151 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 119)

Old:

```text
**Order of successes (B3).** Successes not yet classified are taken in Cashfree's
completion order: `provider_completed_at`, then `provider_started_at`, then
`cf_payment_id`. The first one Cashfree completed is the one it keeps (CF-30; confirming
this is CF-A16).
```

New:

```text
**Which success can count (B3).** D-29 says the first verified payment counts. CF-30
says Cashfree reverses the extra payment; it does not identify which one it keeps.
Completion time, start time, ID and list order are not proof, even if a snapshot shows
only one success: another success may be discovered later. CF-A16 and CF-A26 are gates
before enabling first-success selection or fulfilment. The adapter must obtain confirmed
retention/reversal evidence consistent with D-29; if that would require changing the
first-verified rule, the owner must decide first (§16). Until then, record unclassified
successes as `success_unresolved`, open one reconciliation case per payment, keep polling,
refuse further Pay and do not convert, refund an assumed winner or let an expiry worker
release these books. This is unresolved money, not an unsuccessful attempt. Confirmed
already-reversed receipts can still be recorded without an order or our refund.
```

### E-57 — P/02-cashfree-payments/02-2-payment-flows.md:165 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 126)

Old:

```text
1. **Record or update the attempt** by `cf_payment_id`, only forward (§4.2).
```

New:

```text
1. **Record or update the attempt** by `cf_payment_id`, only forward (§4.2). A newly
   reported success remains `success_unresolved` until step 2 chooses its final class.
```

### E-58 — P/02-cashfree-payments/02-2-payment-flows.md:171 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 131)

Old:

```text
| The refunds check shows a completed automatic reversal of this payment (`refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND`, `refund_status` `SUCCESS`, full amount) | `reversed`: no order, no refund from us; a reconciliation case for SDD 03 (SDD 01 §5.6) |
| The payment already has a counted attempt, or any attempt on it is `amount_mismatch` | `duplicate_success` (§13.2; D-78; SDD 01 §5.6). The amount does not matter: Cashfree reverses any second success (CF-30) |
```

New:

```text
| Confirmed Cashfree reversal evidence shows a completed automatic reversal of this payment (candidate `refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND`, `refund_status` `SUCCESS`, same currency and full amount; representation gated by CF-A16) | `reversed`: no order, no refund from us; a reconciliation case for SDD 03 (SDD 01 §5.6) |
| The retained/extra identity is unresolved, including unavailable or unconfirmed reversal evidence | `success_unresolved`: the gate above applies; no conversion or refund |
| This is a distinct extra success after the payment already has a counted attempt or an `amount_mismatch`, with provider identity confirmed | `duplicate_success` (§13.2; D-78; SDD 01 §5.6). The amount does not matter: Cashfree reverses any second success (CF-30) |
```

### E-59 — P/02-cashfree-payments/02-2-payment-flows.md:178 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 137)

Old:

```text
3. **SDD 03's posting** of the received money is called once for the counted attempt, in
   this transaction, keyed by its `cf_payment_id`, whatever the conversion answered: the
   money was received either way, and SDD 03 decides the entries for an order, a refund or
   a failed conversion. Because the key is the payment ID, the failed-conversion retry
   (SDD 01 §5.10) can never post it again (M5).
```

New:

```text
3. **SDD 03's receipt posting** is called once for every observed successful receipt,
   including unresolved, wrong-amount and duplicate receipts, keyed by
   `receipt:<cf_payment_id>`. For an unrepresentable fractional amount or unsupported
   currency, record exact receipt evidence and a reconciliation case first; do not invent
   a whole-paisa ledger amount. Posting waits for Cashfree's exact monetary correction. It records receipt of money, not a sale. A sale posting runs
   only on `converted`, keyed by `order:<order_id>`, including a later successful admin
   retry (SDD 01 §5.10). No sale posts for `conversion_failed` or `refund_requested`.
   Reversals use `reversal:<cf_refund_id>`; SDD 04 posts our refunds by its own refund ID.
   Repeated checks and conversion retries cannot post the same fact twice (M5; SDD 03 §3).
```

### E-60 — P/02-cashfree-payments/02-2-payment-flows.md:194 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 149)

Old:

```text
   `paid_late` stay; otherwise `pending` while any attempt is pending, `created` while the
   checkout is live, `closed_unpaid` (with `closed_at`) once it is closed. If the order
```

New:

```text
   `paid_late` stay; otherwise `closed_unpaid` (with `closed_at`) once the checkout closed,
   even while attempts remain pending. While live, use `pending` for any pending or
   unresolved success; otherwise retain `initiating` until creation is recorded, or use
   `created` for a known provider order. A `start_failed` payment is not sent to this step. If the order
```

### E-61 — P/02-cashfree-payments/02-2-payment-flows.md:200 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 153)

Old:

```text
7. Set `last_check_id` and `next_poll_at` (§11.2), for a check that is not older.
```

New:

```text
7. Set `last_check_id` and `next_poll_at` (§11.2), for a check that is not older. Set
   `poll_window_started_at` once on close or conversion. Never release another trigger's
   poll lease; only its token holder finishes it (§11.1).
```

### E-62 — P/02-cashfree-payments/02-2-payment-flows.md:204 (9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`; input line 155)

Old:

```text
Answer: `{"payment_status":TEXT,"checkout_status":TEXT,"order_id":UUID_OR_NULL,"classified":[{"cf_payment_id":TEXT,"status":TEXT}]}`.
```

New:

```text
Answer: `{"payment_status":TEXT,"checkout_status":TEXT,"order_id":UUID_OR_NULL,"classified":[{"cf_payment_id":TEXT,"status":TEXT}],"needs_fresh_read":BOOLEAN}`.
```

### E-63 — P/02-cashfree-payments/02-2-payment-flows.md:243 (10.3 Processing; input line 194)

Old:

```text
event and body, acts, and sets `processed` with a code. A message never changes money state
```

New:

```text
cleaned dispatch envelope through `commerce_read_webhook_work`, acts, and uses
`commerce_finish_webhook_work` to complete it. No raw body leaves the database. A message never changes money state
```

### E-64 — P/02-cashfree-payments/02-2-payment-flows.md:262 (10.4 Retries; input line 212)

Old:

```text
case opens. A dead payment message never strands a payment, because the poll reads the same
```

New:

```text
case opens. The finish wrapper validates event/task identity, the live lease owner and
attempt number, then calls the framework completion and updates the event and case in
one transaction. It handles success, retry and final failure; terminal replays are no-ops.
This branch does not also call the worker's generic completion path. A crash after an
idempotent domain handover but before finish replays that handover without another effect.
The migration adds a pre-dispatch reclaim guard for this SDD's task types: an expired
lease already at `max_attempts` is dead-lettered with its event and case atomically,
without dispatching a sixth attempt. The existing Phase 6 claim increments on every
expired-lease reclaim, so its configured cap alone does not provide this guard.
A dead payment message never strands a payment, because the poll reads the same
```

### E-65 — P/02-cashfree-payments/02-2-payment-flows.md:285 (10.6 Deleting old bodies (M13); input line 226)

Old:

```text
events. Events, attempts and checks stay.
```

New:

```text
events, through `commerce_purge_webhook_bodies`. The daily runner uses the scheduler's
checked service boundary; it repeats bounded batches until no expired body remains.
Events, attempts and checks stay.
```

### E-66 — P/02-cashfree-payments/02-2-payment-flows.md:293 (11.1 What it polls, and how often it runs (M12); input line 232)

Old:

```text
A new Edge Function `commerce-payment-poll`, started once a minute by the same scheduler
mechanism as `commerce-scheduler`, runs three passes about 20 seconds apart within one
invocation (about 50 seconds in all). Each pass calls `public.commerce_claim_payment_polls`,
which takes up to the §11.5 budget of payments with `next_poll_at <= now()` and no live
lease, oldest first, and sets `poll_lease_until` to two minutes ahead. Each claimed payment
runs §9.2 and §9.3; the lease ends when §9.3 sets the next poll time. A crashed run's
leases simply expire.
```

New:

```text
A new Edge Function `commerce-payment-poll` needs its own authenticated once-a-minute
scheduler registration; the existing scheduler contract enables no cron by itself.
Use the scheduler's checked secret boundary, with no public unauthenticated dispatch.
It starts passes at about 0, 20 and 40 seconds, bounds the invocation to 50 seconds,
and stops claiming work it cannot finish within that budget. Each pass calls
`public.commerce_claim_payment_polls`, which claims due rows oldest first with
`FOR UPDATE SKIP LOCKED`, sets `poll_lease_until` two minutes ahead and a fresh
`poll_lease_token`. Each claim runs §9.2 and §9.3 and then
`commerce_finish_payment_poll` with its token. Ordinary verification never releases the
lease. A stale owner cannot clear or reschedule a replacement lease. Stop provider calls
before lease expiry; a crashed run's lease expires. Recovery in §11.6 uses this same
claim/fence. Twenty seconds is a target under the shared read budget, not a guarantee
under load. Calls denied a permit are rescheduled without guessing a payment outcome.
```

### E-67 — P/02-cashfree-payments/02-2-payment-flows.md:310 (11.2 Schedule (§17 items 2 and 12); input line 243)

Old:

```text
ones, so a later duplicate or a late success is always found (B1):
```

New:

```text
ones; §11.6 recovers `initiating`. A later duplicate or late success is discovered by this
poll or by the required daily reconciliation after its window (B1):
```

### E-68 — P/02-cashfree-payments/02-2-payment-flows.md:317 (11.2 Schedule (§17 items 2 and 12); input line 249)

Old:

```text
  after the close; then `next_poll_at` is cleared.
```

New:

```text
  after `poll_window_started_at`; then `next_poll_at` is cleared. The same timestamp
  anchors every after-close interval above and is not reset by later checks or refunds.
```

### E-69 — P/02-cashfree-payments/02-2-payment-flows.md:320 (11.2 Schedule (§17 items 2 and 12); input line 251)

Old:

```text
  (D-78: every attempt is reconciled daily) and hands anything new to §9 (§19).
```

New:

```text
  (D-78: every attempt is reconciled daily) and hands anything new to §9 (§19). Do not
  clear the poll until that repair handover is implemented and healthy; otherwise keep
  daily polling. Unresolved successes and duplicate watches also retain their recovery.
```

### E-70 — P/02-cashfree-payments/02-2-payment-flows.md:339 (11.5 Cashfree's rate limits; input line 268)

Old:

```text
per minute) counts **every** read of payments by any trigger. The poll claims only what
remains of `commerce.cashfree_reads_per_minute` after the reads already counted that minute,
so customer return checks, webhooks and expiry workers come first and the total stays
under Cashfree's limit (m5). On `rate_limited` (HTTP 429) nothing changes (as for
```

New:

```text
per account, environment and endpoint, §4) admits **every** provider read by any trigger
before the HTTP call. `commerce_take_cashfree_read_permit` locks the current budget row,
checks its rolling prior-minute usage and `retry_not_before`, and atomically consumes one
permit or returns a retry time. A permit is consumed even if the call times out. Poll
claims are not permits. Payment reads share `commerce.cashfree_reads_per_minute` (25);
order reads also share a conservative 25/minute local cap, below the documented 60;
refund reads use the same conservative cap pending confirmation of their limit. Customer
checks, webhooks and expiry work are dispatched before background poll claims; they still
need permits and may wait. Budget denial is retryable under the same task backoff;
no payment outcome changes.
No caller bypasses the counter. Keep minute rows for at least two minutes and count the
current and previous bucket so boundary bursts cannot exceed the rolling cap (m5).
Use the greatest `retry_not_before` across retained bucket rows, so crossing a minute
boundary never bypasses provider backoff. On `rate_limited` (HTTP 429) nothing changes (as for
```

### E-71 — P/02-cashfree-payments/02-2-payment-flows.md:355 (11.5 Cashfree's rate limits; input line 274)

Old:

```text
task, and the customer's check answers "We are still confirming your payment."
```

New:

```text
task, and the customer's check uses §9.4's confirming text. Persist the endpoint's
`retry_not_before` so all invocations observe the same backoff.
```

### E-72 — P/02-cashfree-payments/02-2-payment-flows.md:363 (11.6 Recovering a start round (M2); input line 281)

Old:

```text
`record_provider_order` with it: an existing order becomes `created`, `not_found` becomes
`start_failed`, and anything else stays `initiating` for the next pass. A crash at any point
of §8 therefore ends in a known state.
```

New:

```text
`record_provider_order` with it: an existing order follows §8 step 3, including its
closed-checkout branch. A `not_found` after an uncertain create stays `initiating`:
CF-A23 does not establish finality of a negative read. While still eligible to pay, recovery
may retry the identical frozen create body and original round key, never a fresh round
for an unknown outcome. If Cashfree refuses that frozen expiry or the result stays unknown,
keep reconciling the stable order ID and open an admin case; never report "Nothing was
charged" from a negative lookup alone. After closure, recovery never returns a session;
once it finds an order it schedules termination and the normal poll. The additional
create-finality question in §16 must be answered before relying on a negative lookup to
release stock. Uncertain retries preserve that round's original expiry; they never silently extend it.
Only a new round after definitive no-order refreshes it, so a retry more than a minute
later can still meet Cashfree's over-15-minute minimum (CF-31).
```

### E-73 — P/02-cashfree-payments/02-2-payment-flows.md:398 (12.1 Provider steps for SDD 01's expiry workers; input line 307)

Old:

```text
  The exact answers for a paid, expired or already terminated order are CF-A19.
- **No Cashfree order (M2).** If no payment row exists, or the payment is `start_failed`
  (Cashfree confirmed no order), there is nothing to read or terminate: the worker passes
  its own post-step time as both provider times, and the payment (if any) becomes
  `closed_unpaid` when the checkout closes. If the payment is `initiating`, the worker first
  runs §11.6's recovery read for it; while the round is still unknown it retries the task
  and never closes a checkout while a Cashfree order might exist unread.
```

New:

```text
  The exact answers for a paid, expired or already terminated order are CF-A19. Approved
  SDD 01's `PAID` refusal shortcut says every success must be `amount_mismatch`; it does
  not cover mismatch plus duplicate/reversed successes. Do not broaden that guard here:
  without a terminating answer, retain the holds and raise the owner question in §16.
- **Locked evidence boundary (M2; RX2-08).** The worker calls
  `commerce_expire_with_payment_evidence` (§6), not SDD 01's expiry RPC directly. In the
  full SDD 01 §7 order, this wrapper takes the customer advisory lock, re-resolves and locks
  the payment if present, then cart, store, checkout and any remaining required rows. It
  re-reads the payment before using the no-order shortcut. Only if no payment exists, or
  a definitive `start_failed` with no unresolved create exists, may it derive both provider
  times from its post-lock clock. A payment inserted since the worker's earlier read
  invalidates that shortcut and raises `PROVIDER_CHECK_STALE`. Otherwise it validates the
  supplied check IDs, their payment/kinds/outcomes and fresh payments read using the
  post-lock clock, then calls the unchanged SDD 01 expiry command in this transaction,
  deriving the two timestamps from that evidence. NULL IDs are accepted only for the
  locked no-order case. `success_unresolved` or incomplete reversal/retention evidence
  always returns `PROVIDER_CHECK_STALE`, including at grace end; it cannot release stock.
  When creation is `initiating`, run §11.6 recovery outside locks and retry while unknown.
  When the checkout closes, this transaction sets the unpaid payment `closed_unpaid`,
  `closed_at`, `poll_window_started_at` and `next_poll_at` together. An unknown create is
  never treated as no order. Customer cancellation remains SDD 01 §5.2's explicit option.
```

### E-74 — P/02-cashfree-payments/02-2-payment-flows.md:423 (12.2 `terminate_provider_order` task (replaces SDD 01's stub); input line 318)

Old:

```text
§13.1. The `commerce-task-worker` branch (M11) calls `terminateOrder`, records the check
and resolves the task on any answer in §12.1's "terminated" rows. On `ACTIVE` or an error
```

New:

```text
§13.1. First synchronize the closed checkout in a database transaction under customer
advisory lock, payment, then checkout: preserve counted `paid`/`paid_late`; keep an unknown
`initiating` round recoverable; otherwise set unpaid `closed_unpaid` and `closed_at`.
Set `poll_window_started_at` once and schedule the known provider order's poll, including
customer and D-81 cancellations. A definitive no-order payment needs no payment poll.
The `commerce-task-worker` branch (M11) calls `terminateOrder`, records the check
and resolves the task on any answer in §12.1's "terminated" rows. On `PAID`, first
run verification: resolve if the counted receipt is handled, or all receipts are known
mismatch/duplicate/reversed cases; otherwise retry and alert the admin. With no payment
row or definitive `start_failed`, resolve without a provider call. An `initiating` payment
runs recovery first and never treats a negative lookup as completed termination. On `ACTIVE` or an error
```

### E-75 — P/02-cashfree-payments/02-2-payment-flows.md:448 (13.1 Wrong amount (D-29); input line 334)

Old:

```text

```

New:

```text
The request carries the attempt ID, `cf_payment_id`, exact amount text and currency as
well as whole paise when representable. SDD 04 locks this payment and deduplicates by
that attempt/key; all sent, pending and unknown refunds count toward the attempt's cap.
A fractional-paisa or unsupported-currency receipt is never rounded into an INR refund:
record the mismatch and an admin case, and obtain Cashfree's exact refundable amount and
currency before the money call (additional question in §16). D-29 still requires its full
refund. Persist the refund intent with SDD 04 in this transaction; external refund calls
happen later, outside locks.
```

### E-76 — P/02-cashfree-payments/02-2-payment-flows.md:464 (13.2 Duplicate success (D-78); input line 342)

Old:

```text

```

New:

```text
Use a child event command UUID derived from the attempt ID and `checkout.duplicate_payment`,
and event key `checkout.duplicate_payment:<cf_payment_id>`; keep the check ID as
correlation. Two duplicates in one check get separate identities. This obeys Phase 6's
unique `(command_id, event_type)` index and emits each notice once across later checks.
```

### E-77 — P/02-cashfree-payments/02-2-payment-flows.md:473 (13.2 Duplicate success (D-78); input line 347)

Old:

```text
`read_refunds` check taken **just before** (B5):
```

New:

```text
`read_refunds` check taken **just before** (B5). Its check must belong to this payment,
have kind `read_refunds`, outcome `ok` and be fresh by the post-lock clock (§9.3's maximum
age). Missing, failed, stale or unconfirmed reversal evidence never means "no reversal".
Validate the check ID/attempt binding; store `last_watch_check_id`. Replays are no-ops.
Re-read the attempt, refund intent and reversal facts under the payment lock before
requesting a refund. The rows below are evaluated in order; ordinary waiting never
postpones a D-78 deadline:
```

### E-78 — P/02-cashfree-payments/02-2-payment-flows.md:481 (13.2 Duplicate success (D-78); input line 349)

Old:

```text

```

New:

```text
SDD 08's checked command records `cashfree_asked_at` on the actual enquiry, and
`cashfree_answered_at` on `will_not_reverse`, once with an audit trail. Opening the case
alone is not a claim that Cashfree was contacted. An uncontacted case remains due and
visible to the owner; the fallback anchor if nobody contacts Cashfree needs the owner's
decision (§16), rather than silently inventing a contact time.

```

### E-79 — P/02-cashfree-payments/02-2-payment-flows.md:489 (13.2 Duplicate success (D-78); input line 351)

Old:

```text
| A completed automatic reversal of this `cf_payment_id`: `refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND`, `refund_status` `SUCCESS`, full amount | `reversal_seen_at`; `watch_stage = reversed`; done |
| Such a reversal still `PENDING`, `PENDING_APPROVAL` or `ONHOLD` | Keep watching; check again next business day |
| Such a reversal `CANCELLED` or `REJECTED`, or none, and `watch_stage = waiting_reversal` at its due time | Open the admin case "Ask Cashfree about this payment"; `watch_stage = asked_cashfree` |
| The admin records "Cashfree will not reverse" (SDD 08's checked command sets `cashfree_answer`) | `refund_due`, due within 1 business day |
| No answer `commerce.duplicate_refund_no_answer_business_days` business days after `cashfree_asked_at` | `refund_due` |
| `refund_due` and still no completed reversal in the fresh refunds check | Request SDD 04 category 6a's refund with key `duplicate:<cf_payment_id>`; `refund_requested_at`; `watch_stage = refund_requested` |
| A reversal completes after our refund | `reversal_seen_at`; open a reconciliation case; the extra amount is BookConnect's loss (D-78) |
```

New:

```text
| A confirmed completed full-amount, same-currency automatic reversal of this `cf_payment_id` appears after our refund intent (`refund_requested_at` set) | Set `reversal_seen_at` once; alert SDD 04 to stop an unsent intent if it can. If our refund succeeded or its result is unknown, open one reconciliation case and hand SDD 03 the confirmed extra loss when known (D-78); never send another refund |
| A completed automatic reversal of this `cf_payment_id`, before our refund intent: confirmed representation, `refund_status` `SUCCESS`, same currency and full amount | Set `reversal_seen_at`; `watch_stage = reversed`; post the reversal to SDD 03 once; done |
| No completed reversal and `watch_stage = waiting_reversal` at its due time, including a `PENDING`, `PENDING_APPROVAL`, `ONHOLD`, `CANCELLED` or `REJECTED` reversal | Open one admin case "Ask Cashfree about this payment"; `watch_stage = asked_cashfree`; keep the enquiry due until recorded |
| The admin records "Cashfree will not reverse", and no refund intent exists | Set `refund_due_at` no later than 1 business day after `cashfree_answered_at`; `watch_stage = refund_due` |
| No answer `commerce.duplicate_refund_no_answer_business_days` business days after `cashfree_asked_at`, and no refund intent exists | Set `refund_due_at` to that deadline; `watch_stage = refund_due` |
| `refund_due` and no completed reversal in the fresh refunds check | Persist SDD 04 category 6a's intent with attempt identity, exact amount/currency and key `duplicate:<cf_payment_id>`; set `refund_requested_at` and `watch_stage = refund_requested`; one request only, outside-lock sender later |
| Incomplete reversal and no refund deadline reached | Keep watching; next check no later than the earlier of next business day and the current policy deadline |
| `refund_requested` and no completed reversal | Continue daily reconciliation with SDD 03 and SDD 04, including after the ordinary payment-poll window; never request again |
```

### E-80 — P/02-cashfree-payments/02-2-payment-flows.md:498 (13.2 Duplicate success (D-78); input line 359)

Old:

```text

```

New:

```text
The same check may advance the watch through enquiry/answer/deadline rows and request the
refund in that transaction; it must not wait for another day after a deadline. The first
completed-reversal row also posts that reversal once by its provider refund ID. SDD 03
posts any confirmed double-return loss with key `duplicate_loss:<cf_payment_id>`, feeding
D-08 once and never charging the store. The watch's daily runner has the same checked
scheduler boundary as §11.1. SDD 04 receives pending/unknown refund amounts in the same
attempt-level cap used for wrong amounts (§13.1).

```

### E-81 — P/02-cashfree-payments/02-2-payment-flows.md:524 (13.4 Key rotation (CF-36, D-104); input line 377)

Old:

```text
   `initiating` or `pending`: at most the 10-minute reservation plus the 15-minute grace.
```

New:

```text
   `initiating` or `pending`: D-104 records at most the 10-minute reservation plus the
   15-minute grace. D-101's unreachable check and D-95's failed conversion can keep these
   conditions unresolved beyond that time. Do not override either safeguard or rotate
   merely because 25 minutes elapsed; the owner must reconcile this bound (§16 item 8).
```

### E-82 — P/02-cashfree-payments/02-3-races-and-tests.md:19 (14. Races; input line 19)

Old:

```text
| RX2-03 | Two checks each showing two successes | — | Both classify in completion order (§9.3): the first completed counts, the second is `duplicate_success` | Same result |
```

New:

```text
| RX2-03 | Two checks showing multiple successes | — | While retained identity is unconfirmed, record `success_unresolved`; no order/refund. Once the CF-A16 gate is resolved, the first eligible verified receipt counts under D-29, extras follow D-78 | Same safeguards; list or arrival order never proves retained identity |
```

### E-83 — P/02-cashfree-payments/02-3-races-and-tests.md:26 (14. Races; input line 26)

Old:

```text
| RX2-10 | Wrong-amount success completed first | Correct success completed later, same order | A is `amount_mismatch`; B is `duplicate_success` (§13.1) | Same: classification follows Cashfree's completion order, not which check arrives first (§9.3, B3) |
| RX2-11 | Duplicate watch's refund request | A late reversal | Refund sent; the reversal opens a reconciliation case (D-78) | The fresh refunds check sees the reversal; no refund |
```

New:

```text
| RX2-10 | A retained wrong-amount receipt and an extra correct success on the same order | Their checks arrive in the opposite order | After confirmed identity, A is `amount_mismatch`; B is `duplicate_success` (§13.1) | If identity is not yet provable, B stays `success_unresolved`; never count it from completion time alone (§9.3, B3) |
| RX2-11 | Duplicate watch's refund request | A late provider reversal | Refund sent; a later confirmed double return opens a reconciliation case (D-78) | If the fresh read already contains the completed reversal, no refund. If reversal completes after that outside-lock read but before our commit, the accepted D-78 race remains; reconcile once |
```

### E-84 — P/02-cashfree-payments/02-3-races-and-tests.md:29 (14. Races; input line 29)

Old:

```text
| RX2-13 | `record_provider_order` for round 1 (slow) | §11.6 recovery for round 1, then a new "Pay" starting round 2 | A's round no longer matches: it changes nothing and returns the current state | Same |
```

New:

```text
| RX2-13 | `record_provider_order` for current round 1 (slow) | §11.6 recovery for round 1 | A records the order; recovery is idempotent; a new Pay reuses round 1 | Recovery finding the order records it first; A cannot regress it. A negative lookup keeps the same round unknown. A genuinely old-round response after a definitive refusal/new round changes nothing |
```

### E-85 — P/02-cashfree-payments/02-3-races-and-tests.md:31 (14. Races; input line 31)

Old:

```text

```

New:

```text
| RX2-15 | An older check first reveals a success | A newer empty/failed check already applied | Unresolved evidence is retained; a fresh read is required before classification; no orphan terminal success | The newer read never erases a classified success; any new unresolved receipt still requires a fresh check |
| RX2-16 | Poll owner A expires or a webhook verifies during A's read | Poll owner B claims after the real lease expires | Webhook does not clear A's lease; A cannot release B's token | B owns the replacement token; A's stale finish does nothing |
```

### E-86 — P/02-cashfree-payments/02-3-races-and-tests.md:54 (15.1 Worked examples; input line 52)

Old:

```text
5. **Duplicate.** She pays twice in two tabs. The success Cashfree completed first converts;
```

New:

```text
5. **Duplicate.** She pays twice in two tabs. Once the retained-payment identity is confirmed, the first eligible verified success converts;
```

### E-87 — P/02-cashfree-payments/02-3-races-and-tests.md:63 (15.1 Worked examples; input line 61)

Old:

```text
   and she can reserve again. If a ₹400 success had completed after it on the same order,
```

New:

```text
   and she can reserve again. If a ₹400 extra success followed it on the same order,
```

### E-88 — P/02-cashfree-payments/02-3-races-and-tests.md:80 (15.2 Tests; input line 78)

Old:

```text
  a second; 400/422 is `refused`; timeout, 5xx and 429 lead to a read.
```

New:

```text
  a second; only definitive validation refusal is `refused`; `idempotency_error`, timeout,
  5xx and 429 lead to a read, with a negative read still unknown.
```

### E-89 — P/02-cashfree-payments/02-3-races-and-tests.md:102 (15.2 Tests; input line 99)

Old:

```text
- PA-06 replaying a start returns the stored answer; Cashfree is called once; the same key
  and command ID with a different checkout raise `INVALID_COMMAND`.
```

New:

```text
- PA-06 replaying a start returns the stored answer and current safe projection; concurrent
  replays before recording may repeat HTTP calls with one frozen provider key/body but
  create one Cashfree order. A changed checkout raises `INVALID_COMMAND`; a stale session
  cannot bypass a closed checkout, pending attempt, mismatch or exhausted Pay limit.
```

### E-90 — P/02-cashfree-payments/02-3-races-and-tests.md:117 (15.2 Tests; input line 112)

Old:

```text
- PA-12 a stale `record_provider_order` (old round, or payment no longer `initiating`)
  changes nothing (RX2-13).
```

New:

```text
- PA-12 a stale `record_provider_order` from an old round changes nothing; a current-round
  answer may fill missing identity after verification but cannot regress money state
  (RX2-13).
```

### E-91 — P/02-cashfree-payments/02-3-races-and-tests.md:121 (15.2 Tests; input line 115)

Old:

```text
  order becomes `created`, `not_found` becomes `start_failed`, an error stays `initiating`.
```

New:

```text
  order follows §8 step 3; `not_found` after uncertainty and errors stay `initiating`.
```

### E-92 — P/02-cashfree-payments/02-3-races-and-tests.md:123 (15.2 Tests; input line 117)

Old:

```text

```

New:

```text
- PA-14 a timed-out create followed by `not_found` remains unknown, including when the
  original create later succeeds; recovery uses the same body/key, closure never returns
  a session, and no new round or no-charge promise is inferred. A bare 422 idempotency
  error does not authorize expiry as no-order. A definitively refused round retried more
  than a minute later gets a fresh over-15-minute expiry; retries within one uncertain
  round keep exactly the same body/key.

```

### E-93 — P/02-cashfree-payments/02-3-races-and-tests.md:137 (15.2 Tests; input line 124)

Old:

```text
- VE-05 two successes: the one completed first counts whichever is listed or read first;
  the other is `duplicate_success` with `watch_stage = waiting_reversal` and no refund
  request. Runs in slice 6.
```

New:

```text
- VE-05 two successes: unknown retained identity leaves successes unresolved with no order/refund;
  after the CF-A16/owner gates, the first eligible verified receipt counts under D-29 and
  a confirmed extra is `duplicate_success` with `watch_stage = waiting_reversal`. Include
  reversed start/completion order, tied or missing times and a first read showing only
  the later-discovered extra; never choose by time/ID. Runs in slice 6.
```

### E-94 — P/02-cashfree-payments/02-3-races-and-tests.md:143 (15.2 Tests; input line 128)

Old:

```text
- VE-07 a check whose `(answered_at, id)` is at or before `last_check_id`'s may add new
  attempts and move attempts forward but changes no payment field; nothing moves back.
```

New:

```text
- VE-07 a check whose `(requested_at, id)` is at or before `last_check_id`'s may add
  unresolved evidence but never leave a terminal success without a paid payment. It
  requests a fresh read before classifying; no status/schedule watermark moves back.
  Exercise earlier-request/later-answer and both commit orders.
```

### E-95 — P/02-cashfree-payments/02-3-races-and-tests.md:150 (15.2 Tests; input line 133)

Old:

```text
- VE-11a a success after a D-81 cancellation: refunded (D-98). VE-11b a success while
  another live checkout of the same cart exists: handled per D-97 through SDD 01 §5.6.
```

New:

```text
- VE-11a a success after a D-81 cancellation: refunded (D-85). VE-11b a late success while
  another live or converted checkout of the same cart and same version exists: refunded
  per D-97 through SDD 01 §5.6; a different cart version is the control.
```

### E-96 — P/02-cashfree-payments/02-3-races-and-tests.md:155 (15.2 Tests; input line 137)

Old:

```text
  posting is made once, and the admin case and hold extension commit in the same
  transaction; nothing is rolled back (D-95).
```

New:

```text
  receipt posts once, no sale posts, and the admin case and hold extension commit in the
  same transaction (D-95). A successful admin retry posts one sale without reposting the
  receipt; a refund outcome posts no sale.
```

### E-97 — P/02-cashfree-payments/02-3-races-and-tests.md:162 (15.2 Tests; input line 143)

Old:

```text
  no order, no refund, a reconciliation case; a reversal still pending does not count.
```

New:

```text
  no order, no refund, a reconciliation case; a reversal still pending does not count. Include a single first success already reversed,
  plus unavailable and unconfirmed refund evidence: neither may create an order.
```

### E-98 — P/02-cashfree-payments/02-3-races-and-tests.md:167 (15.2 Tests; input line 147)

Old:

```text

```

New:

```text
- VE-17 a success on `reservation_expired` while a D-81 ineligibility pause is active
  is refunded under D-98; ordinary pauses are controls. Runs in slice 6.
- VE-18 wrong-payment/wrong-kind/failed/missing/stale payment, refund or order checks are
  rejected before money effects; changed replay inputs raise `INVALID_COMMAND`; two
  distinct checks of the same payment both apply. Lock waits cross the freshness limit.
- VE-19 a customer return with another customer's, missing or malformed provider order
  ID makes no provider call and reveals no payment state; an authorized return returns
  only the customer projection.
- VE-20 representable receipts for counted, wrong-amount, duplicate and unresolved successes post once;
  conversion alone posts the sale, reversal alone posts its reversal, and a later admin
  retry cannot repost the receipt. Fractional or unsupported-currency evidence is kept
  exactly and never rounded into a refund or ledger money amount.

```

### E-99 — P/02-cashfree-payments/02-3-races-and-tests.md:200 (15.2 Tests; input line 167)

Old:

```text

```

New:

```text
- WH-13 crash after domain handover/before finish replays safely; task/event/admin-case
  completion is atomic. The fifth attempt crashing before completion is terminalized
  before a sixth dispatch. Stale lease owners cannot mark the event processed or dead.

```

### E-100 — P/02-cashfree-payments/02-3-races-and-tests.md:214 (15.2 Tests; input line 177)

Old:

```text
- PO-07 all Cashfree reads together (customer checks, webhooks, workers, poll, watch) stay
  within `commerce.cashfree_reads_per_minute`; the poll takes what is left; a 429 changes
```

New:

```text
- PO-07 all triggers (customer checks, webhooks, workers, poll, watch) share the
  per-endpoint `commerce.cashfree_reads_per_minute` cap; the poll takes what is left; a 429 changes
```

### E-101 — P/02-cashfree-payments/02-3-races-and-tests.md:217 (15.2 Tests; input line 180)

Old:

```text
- PO-08 two overlapping poll runs never read the same payment at once (leases); a crashed
  run's leases expire and the payments are picked up again.
```

New:

```text
- PO-08 two overlapping poll runs never read the same payment at once under a live lease;
  a webhook does not release the poll lease; expired owners cannot finish a replacement
  token. Crashes recover through lease expiry, including creation-recovery claims.
- PO-09 concurrent mixed-trigger calls consume atomic permits before HTTP dispatch,
  including calls across minute boundaries; denied permits retry/defer without changing
  a payment outcome. Test nine live payments against the 25/minute budget: 20 seconds is a target,
  not an unconditional timing guarantee. All instances share provider 429 backoff.
```

### E-102 — P/02-cashfree-payments/02-3-races-and-tests.md:237 (15.2 Tests; input line 195)

Old:

```text

```

New:

```text
- TE-08 the locked expiry wrapper re-checks no-order after a concurrent first Pay;
  initiating/unknown creation and unresolved successes never release stock. Both expiry
  phases use the correct bound check IDs. A paid termination task resolves after verified
  handling; no-payment/definitive-no-order termination resolves without a provider call.

```

### E-103 — P/02-cashfree-payments/02-3-races-and-tests.md:246 (15.2 Tests; input line 199)

Old:

```text
- DU-03 a correct success completed after a wrong amount on the same order is a duplicate
```

New:

```text
- DU-03 a confirmed extra correct success after a wrong amount on the same order is a duplicate
```

### E-104 — P/02-cashfree-payments/02-3-races-and-tests.md:259 (15.2 Tests; input line 212)

Old:

```text

```

New:

```text
- DU-11 an automatic reversal left `PENDING`, `PENDING_APPROVAL` or `ONHOLD` through
  the initial wait still triggers the enquiry and, after recorded contact and the
  no-answer deadline, one fallback refund; pending status never resets a deadline.
- DU-12 one check with two new duplicate receipts emits two notices with distinct child
  command IDs and per-attempt keys; replays or another check emit no further notices.
- DU-13 a completed reversal after a pending, unknown or succeeded BookConnect refund
  intent takes the post-refund branch once; an unsent intent is stopped where possible,
  and a confirmed double return posts one loss to BookConnect, never the store. Include
  provider reversal between the outside-lock read and refund-intent commit (RX2-11). Daily
  reconciliation continues beyond the ordinary payment poll window.

```

### E-105 — P/02-cashfree-payments/02-3-races-and-tests.md:277 (15.2 Tests; input line 219)

Old:

```text

```

New:

```text
- ST2-06 verification before creation recording can reach pending/paid/paid_late;
  a closed unpaid payment stays closed with later pending evidence; unresolved success
  can reach each final class only with confirmed evidence. Missing provider completion
  time never prevents recording an otherwise verified receipt.
```

### E-106 — P/02-cashfree-payments/02-3-races-and-tests.md:292 (15.2 Tests; input line 230)

Old:

```text
- RX2-01 to RX2-14 each run in both orders, as §14's table says.
```

New:

```text
- RX2-01 to RX2-16 each run in both orders, as §14's table says.
```

### E-107 — SDD 01 §4, mirrored

Both locations: `P/01-checkout-reservation/01-1-data-and-settings.md:350` and `P/01-checkout-reservation-sdd.md:434`.

Old (both):

```text
| `commerce.min_checkout_total_minor` | 100 | D-107; also enforced by SDD 02 `payments.amount_minor` CHECK |
```

New (both):

```text
| `commerce.min_checkout_total_minor` | 100 | D-107; validate an integer at least 100; also enforced by SDD 02 `payments.amount_minor` CHECK |
```

### E-108 — SDD 01 §5.1 guard 13a, mirrored

Both locations: `P/01-checkout-reservation/01-2-checkout-commands.md:106` and `P/01-checkout-reservation-sdd.md:553`.

Old (both):

```text
| 13a | Order total (`final_total_minor`) is at least `commerce.min_checkout_total_minor` (D-107; Cashfree takes no order under ₹1) | `ORDER_TOTAL_BELOW_MINIMUM` | Orders must be at least ₹1. |
```

New (both):

```text
| 13a | Order total (`final_total_minor`) is at least `commerce.min_checkout_total_minor` (D-107; Cashfree takes no order under ₹1) | `ORDER_TOTAL_BELOW_MINIMUM` | Orders must be at least ₹{minimum}, using the configured minimum (₹1 by default). |
```

### E-109 — SDD 01 §14 R-21, mirrored

Both locations: `P/01-checkout-reservation/01-5-tests.md:38` and `P/01-checkout-reservation-sdd.md:1457`.

Old (both):

```text
- R-21 a checkout total of 99 paise is refused with `ORDER_TOTAL_BELOW_MINIMUM`; 100 paise is accepted (D-107).
```

New (both):

```text
- R-21 a checkout total of 99 paise is refused with `ORDER_TOTAL_BELOW_MINIMUM`; 100 paise is accepted (D-107). The setting rejects values below 100; with a 200-paise setting, 199 is refused with ₹2 in the message and 200 is accepted.
```

## 5. Owner questions

1. **Which receipt counts?** D-29 says first verified; CF-A16 has not established which receipt Cashfree keeps. Options: retain first-verified with proof before fulfilment, or explicitly amend it to Cashfree's retained receipt once confirmed. Recommend confirming Cashfree's rule first, then making this choice explicitly. Time/ID sorting is disabled; unresolved successes stay held. The rejected MU-01 is not reopened.
2. **Nobody sends the duplicate enquiry:** start the five-day fallback clock when the case becomes due, or keep actual contact as the anchor and define a bounded unattended-case action. Recommend a due-case anchor to prevent indefinite customer waiting, but that changes/clarifies D-78 and needs approval. The design records actual contact honestly and exposes the unanswered case.
3. **Rotation after 25 minutes:** keep the wait conditions even when an outage or failed conversion lasts longer, or approve a separate recovery/rotation procedure for those exceptions. Recommend keeping the safeguards and treating 25 minutes as the ordinary window, not permission to rotate over unresolved work. D-104's absolute statement conflicts with D-101/D-95; it is not silently rewritten.
4. **Paid but no order:** approve a specific paid-awaiting-order message, or explicitly reuse the approved Waiting text. Recommend: “Your payment went through. We are creating your order.” This is proposed wording only; the edits reuse the already approved Waiting text meanwhile. Approved SDD 01 §5.2 is not edited outside the allowed additions.

5. **Wrong amount plus another completed receipt:** approved SDD 01's PAID-termination shortcut only allows every success to be amount_mismatch. Options: keep holding until Cashfree actually terminates, or explicitly broaden that shortcut to confirmed duplicate/reversed non-counted receipts too. Recommend the narrow broadening after CF-A16 establishes receipt identity, so known unpaid checkouts do not remain held indefinitely. This changes approved SDD 01 outside the allowed additions, so it is not edited here.

Other unapproved author proposals in SDD 02 §17 remain owner proposals, including polling windows and business-day calendar. They were not converted into approved policy.

## 6. Cashfree questions

Do not edit the pending file; additions/clarifications for the owner to send:

- **CF-A16 (expand):** Which exact `cf_payment_id` is retained, how can we prove that before fulfilment even if another success is discovered later, and how are completed versus pending reversals represented? Confirm exact linkage, full amount and currency. This is a selection/fulfilment gate, including a snapshot showing one success only.
- **CF-A26 (clarify):** Are missing/tied completion times possible? Times and list order will not be used as retained-payment proof.
- **CF-A23 (expand), proposed CF-A27:** After a create times out and lookup returns 404, can that create later succeed? Which responses prove no order will ever appear? Is a 422 idempotency error compatible with an existing order? How should an identical retry behave once the frozen expiry is less than 15 minutes away?
- **Proposed CF-A28:** If payment amount has fractional paise or unexpected currency, what exact amount/currency is refundable, and how is authoritative corrected evidence obtained? BookConnect must not round or guess.
- **Proposed CF-A29:** Confirm the refunds-read endpoint's per-account sandbox limit and whether endpoint limits use fixed or rolling windows. Local permits are conservative and all 429 backoff is shared regardless.

CF-A17–CF-A25 remain the existing questions/gates; this review makes no sandbox claim and sends no message.

## 7. Uncertain

- The automatic-refund type names are API-reference candidates, not confirmed reversal facts. Unknown representation now blocks monetary selection/refund; it is not treated as an empty list.
- Provider create finality, late/missing attempts, session reuse, signature timestamp behavior and rotation effects need the already listed Cashfree/sandbox checks. No live state was read.
- SDDs 03–05 remain skeletons. They contain older CF-15/CF-51/end-of-window assumptions outside the editable scope; nothing in this review approves those assumptions. SDD 02 now declares its receipt/sale/reversal/refund handovers and keeps recovery active until real reconciliation is healthy.
- The asserted local location of Cashfree keys was not checked; no key/environment file was opened.

## 8. Coverage

All four SDD 02 parts (§1–§20) and all five supplied round-1 reports were read fully. Read-only parallel checks independently examined decision consistency, schema/code compatibility and race/test dependencies; I checked the supporting evidence and made all edits.

| Source | Coverage |
|---|---|
| Decision register | Payment/checkout/refund decisions and rules cited by SDD 02, especially D-29/D-78/D-81/D-95/D-101/D-104–D-108; other domains not exhaustively reviewed |
| Cashfree replies | Payment/checkout, reversal, webhook, keys and relevant refund facts; no fresh provider verification |
| Names-needed | API-answer tables, N1–N8, open reversal/time/session/error/rate-limit details; no external page fetched |
| Pending questions | CF-A16–CF-A26 and carried-over questions read; unchanged |
| Master | Relevant checkout states, timing, money, abuse limits and §14 race/lock requirements; unrelated fulfilment details only contextual |
| SDD 01 parts/reference | Relevant §3/§4 data/settings, §5 command/expiry/conversion/late-payment rules, §7 locks, §8 task framework, §10/§12 messages, §14 tests, build slices/handover; additions compared to reference. Unrelated approved behavior not re-audited exhaustively |
| SDD 03 | Receipt/posting, ledger constraints, daily reconciliation and open evidence read; no implementation approval |
| SDD 04 | Refund categories 5/6/6a, states, caps, races and evidence contract; other returns/recovery detail not exhaustive |
| SDD 05 | Relevant provider/split/settlement handovers and open facts; other domain detail not exhaustive |
| DOC-6/7/14/15 | Relevant payment/privacy, fulfilment boundaries, state/idempotency and ledger rules; later decision register/master/approved SDD 01 take precedence over older confirm-first rules |
| Applied migrations | Full Phase 6 infrastructure extension, task claim/completion and scheduler contracts; targeted foundation schema/helpers/RLS, request core, policy, event/task/idempotency and inventory-price dependencies. Unrelated migrations and Phase 9 ignored |
| Edge code | Both commerce-task-worker/index.ts and commerce-scheduler/index.ts read fully; no code edited |
| Startup routing | ACTIVE.md, DOC-13 and CODEBASE_MAP/README.md consulted for routing/authority; this task does not change their Phase 9 work unit |

Concrete schema/code evidence used:

- `supabase/migrations/20260619000002_marketplace_foundation_helpers.sql:8`: “NOT exposed to PostgREST/REST API”.
- `supabase/migrations/20260716000003_marketplace_phase6_infrastructure_extensions.sql:13`: “ON public.marketplace_events(command_id, event_type) WHERE command_id IS NOT NULL”.
- Same migration `:58`: “CHECK (max_attempts BETWEEN 1 AND 5)”; `:68–72` keeps open-task and permanent dedupe uniqueness.
- `supabase/migrations/20260716000026_marketplace_phase6_task_claim_retry.sql:58`: “attempt_count=attempt_count+1”; `:87` tests the cap during completion.
- `supabase/migrations/20260716000028_marketplace_phase6_scheduler_contract.sql:1`: “No cron schedule is enabled here”; `:12` defaults cadence to one minute.
- `supabase/functions/commerce-task-worker/index.ts:89`: “if (!command) throw new Error('unsupported_task_type')”; `:109` calls generic completion.
- `supabase/functions/commerce-scheduler/index.ts:29`: “client.rpc('claim_phase6_tasks'”; one dispatch pass per invocation.
- `supabase/migrations/20260716000001_marketplace_phase6_order_request_core.sql:90`: “final_total_minor INTEGER CHECK (final_total_minor >= 0)”.
- `supabase/migrations/20260628000003_marketplace_phase3_inventory_canonical_listings.sql:107`: “selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0)”.

Verification actually performed: fresh on-disk reads matched the intended final content of all four SDD 02 files, with one top-level document title each; all 114 test IDs (including race ranges and VE-11a/b) resolve and have slice assignments; every SDD 01 replacement matches its reference-copy line exactly. The edit inventory was calculated from the original input snapshots and these readbacks. Transient duplicated text during patch application was detected and removed before this check.

No runtime, Python, sandbox, repository validator or network tests ran; this is document review and structural verification, not evidence that an implementation passes. No staging, commit, push, deployment or database/storage application occurred. No Git command was run, so Git status is not asserted. The uncommitted session changes are the four SDD 02 parts, SDD 01's data/settings part, checkout-commands part, tests part and reference copy, plus this new report. No scratch/backup/copy file was created.

After the fixes, only the explicit owner/Cashfree gates above remain; SDD 02 is still unapproved and first-success selection is deliberately disabled until its retention evidence is resolved.

VERDICT: READY WITH FIXES
