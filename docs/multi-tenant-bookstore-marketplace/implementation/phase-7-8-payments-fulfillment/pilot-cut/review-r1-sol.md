## Summary

**Verdict: ready after fixes.** The manual duplicate-refund path omits explicit safeguards for identifying the payment Cashfree kept and handling reversals after a refund request. Case visibility, script security tests and slice dependencies also need clarification before approval. The cut preserves the main payment-verification, stock-locking and refund-key contracts.

## Angle coverage

A: Examined public endpoint authorization, webhook replay/rotation, aggregate provider traffic and every proposed admin action.  
B: Compared section headings and expanded test IDs; traced detection, deferred dependencies and indefinite polling.  
C: Checked conversion, ledger/refund stand-ins, SDD 05/08 receivers and Phase 9 prerequisites.

References below: **O** = `00-pilot-cut-overview.md`; **C1** = `01-checkout-reservation-pilot-cut.md`; **C2** = `02-cashfree-payments-pilot-cut.md`. **S1/S2** mean the authoritative SDD part files.

## Findings

| ID | Severity | Angle | Where | Problem | Failure scenario | Evidence | Proposed fix |
|---|---|---|---|---|---|---|---|
| PC-01 | major | A/C | C2 §1 rows §4.2, §13.2, §13.5; S2 §13.2/§13.5 | Removing the watch also removes its explicit protection for the receipt Cashfree kept. Recording that fact manually is insufficient unless refund commands enforce it. | A counts, B is duplicate; Cashfree returns A. An admin later refunds B because B has no reversal, leaving the fulfilled order without payment. | C2 §13.5: “The admin records which receipt Cashfree kept”; S2 §13.2: “never refunded; done”. | Retain a server-enforced kept-receipt guard, checked under the payment lock with fresh refunds evidence. Adapt DU-14 for the manual path. |
| PC-02 | major | A/C | C2 §13.2 and §2; S2 §13.2, DU-08/13/15 | Reversal handling records evidence and closes a check, but drops the explicit handover to stop unsent refunds and reconcile pending/unknown/succeeded submissions. | A duplicate refund intent exists; Cashfree reverses that attempt before submission. The case closes while the intent remains executable, or a double return loses its loss-accounting follow-up. | C2 §13.2: “closes the case's reversal check”; S2 §13.2: “stop an unsent intent if it can”. | Preserve the stop/reconcile handover and `duplicate_loss:<cf_payment_id>` identity. Test reversal before submission, unknown outcome and completed refund, including replays. |
| PC-03 | major | B/C | O §4; C2 §13.2/§4.2; register D-110 | The enquiry clock has conflicting anchors, and its durable timestamps are deferred. | An immediate duplicate case starts the five-day clock, producing a refund on day five instead of after the initial three-day wait plus five days. Alternatively, nobody opens the later enquiry case. | O §4: “admin case at 3 business days”; C2 §13.2: “An admin case opens at once”; D-110: “starts when the ‘Ask Cashfree about this payment’ case opens”. | Distinguish detection and enquiry cases. Preserve immutable enquiry-open/answer times, business-day calculation and non-resettable deadlines, using case fields if desired. Test both deadlines. |
| PC-04 | major | A/C | C2 introductory script rule and §2; C1 PC1-03; S2 §6, SE-07; handoff §7 | The retained access rules are sound, but the replacement security proof covers only timer requeue and failed conversion. | A wrong-amount, duplicate, correction, enquiry/answer or restart script accepts a forged actor or unlisted action without the omitted test detecting it. | C2 §2: “Admin console wiring: SE-07”; C1 PC1-03 names `requeue_checkout_timer` and `resolve_failed_conversion`; S2 SE-07: “forged admin actors and unlisted actions”. | Keep script-specific SE-07 coverage for every action. Name the server-side admin check, service boundary, reason/audit requirements and baseline authentication controls. Restart remains owner-only; client roles remain denied. |
| PC-05 | major | B/C | O §6 P7; C1 §20; C2 §19; S1 §20; handoff §7 | Action scripts do not define a case-review or notification service. The inherited owner-notice fallback is not mapped to a pilot command, recipient or test. | Wrong amount opens a case, but no operator sees it; the customer waits despite nominal “detection”. | O P7: “admin cases and the audited admin scripts”; S1 §20: “Until 08 exists, an owner notice in test mode”; handoff §7: “named owner and a recorded sign-off”. | Name the checked case-list/notification path, responsible person, review cadence, delivery-failure handling and overdue escalation. Test receipt by that person. |
| PC-06 | major | B/C | O §6 P4–P7; S1 §5.5/§6.7; S2 §9.3 | The replacement sequence does not assign early case primitives or all later dependencies. P6 also lacks the SDD 06/07 checked caller for its service-only ready helper. | P4 conversion fails before P7’s case work exists. P6’s store screen then needs a ready action whose authorized caller belongs to a later SDD. | O P7: “admin cases”; S1 §5.5: “opens an admin case in that same transaction”; S1 §6.7: “called by SDD 06”. | Move minimum durable case/refund-recording interfaces before P4. Explicitly assign fixed-contract stand-ins and handling of tasks produced before their workers exist. Pull forward the checked ready entry point or defer its usable UI. |
| PC-07 | major | A/B | C2 §11.2/§11.5; S2 §5/§11.1/§11.5 | Store count does not bound aggregate traffic or accumulated daily work. Existing leases and the 50-second invocation bound do not provide shared admission or backoff. | Four customers each use the retained ten checks/minute allowance: 40 payment reads before polling. Separately, 100 new payments/day continually enlarge the daily cohort. Repeated 429s delay verification and hold release. | C2 §11.5: “At five stores the volume is far below the sandbox limits”; S2 §11.5: “limits per minute based on IP and account ID”. | Retain lightweight shared endpoint admission/backoff, bounded batches and backlog-age reporting. Test mixed callers and accumulated history; preserve indefinite daily coverage rather than truncating it. |
| PC-08 | major | B/C | C2 §13.4, §19 and §2; S2 §13.4/§19 | WH-16 and HC-03 become Later without an explicit receiving acceptance gate. They cover independent recovery, beyond previous-secret acceptance. | Rotation loses a fee/refund/settlement delivery. Payment polling succeeds, but no receiving test proves recovery of the other fact. | C2 §2: “Receiver recovery gates: WH-16, HC-03”; S2 §19: “must run the named integration proof”. | Keep explicit receiver gates for SDD 03/04/05 and the independent-fee live gate. Defer execution until receivers exist, rather than tying recovery proof to the previous-secret feature. |
| PC-09 | major | B | C2 §2; S2 §15.2; C1 §2; S1 §14 | Test classifications contain omissions and incompatible retained assertions, detailed below. | A coder either implements deferred deletion/dispatch to pass retained tests or silently weakens those tests. The paid-termination error variant lacks a classification. | C2 §2 keeps “SE-01 to SE-05”; S2 SE-05 requires bodies “are deleted after the retention period”. | Correct the mechanical mapping, explicitly split altered assertions and add TE-03a. Retain security and recovery assertions independently of deferred UI/features. |
| PC-10 | major | A/B | O §4 D-81/D-98; C1 §5.7/§13; S1 §5.3/§5.10/§13; register D-111 | The claimed 25-minute exposure bound is false. The retained D-81 scan also flags a state the cut deliberately permits. | Fraud suspension occurs during a provider outage. Holds and a live checkout survive beyond 25 minutes; later verification converts that live checkout. The daily scan reports the permitted pause/live combination as an exception. | O §4: “at most 25 minutes”; D-111: “25 minutes is the usual time, not a deadline”. | Describe outage/failed-conversion exceptions before the owner decides D-81. Align the scan with the approved pilot policy; never enforce the claimed bound by guessing payment status or releasing holds. |

**Minor, not expanded**

- O §4’s claim that wrong amounts *need* a service fee exceeds CF-79. S2 §13.1 explicitly says that is not established as the only cause.
- O N-06 is broader than retained S1 §5.2, which permits customer cancellation before asynchronous termination. State that existing exception explicitly.
- C1 §17 explicitly defers D-103 with photos, but O §4 omits that decision ID.

## Detect table

C1 contains no explicitly classified Detect row. All three C2 Detect rows and the five requested O §4 items appear below. Timings are nominal: PC-07 leaves backlog delay unbounded.

| Item | Named detector; definition | How soon | Who is told; does it detect? |
|---|---|---|---|
| D-29 / C2 §13.1 | `apply_payment_check`, S2 §9.3, modified by C2 §13.1 | First successful fresh verification | Admin case immediately. Classification works; operational delivery/review is unspecified—PC-05. |
| D-78/D-110 / C2 §13.2 | `apply_payment_check` opens duplicate case; `commerce-payment-poll` reads reversals, S2 §9.3/§11, C2 §13.2 | Detection immediately on verification; reversals follow polling schedule | Admin case and customer duplicate notice. Duplicate detection works; timed enquiry/deadline detection has no named replacement runner and conflicting anchors—PC-03. |
| D-109 / C2 §13.5 | Fresh refunds processing in `apply_payment_check`, C2 §9.3/§13.5 | Next webhook-triggered read or scheduled poll; nominally daily in old cohort | Reconciliation case for admin. Reversal detection works; correction command and protected kept-receipt handling are incomplete—PC-01/05. |
| D-95 | Verification opens `conversion_failed`; S1 §5.10/§13 daily overdue scan, retained by C1 | Failure immediately; overdue escalation after seven days, next scan | Admin, then owner. Detection/escalation intent is explicit; pilot queue/notice wiring remains unresolved—PC-05/06. |
| D-81/D-98 | S1 §13 daily pause/live-checkout scan; late-payment D-98 check remains automatic in `resolve_late_payment`, §5.6 | Next daily scan; late refund on verification | Admin case for scan; customer refund outcome. Scan detects an intentionally allowed state, not necessarily a fault—PC-10. |
| Three 429s/hour | C2 §11.5 and PC2-04 promise aggregation; no named aggregation command | Third recorded 429, intended | Admin case promised; scheduling and visibility are not concretely assigned. |

## Owner decisions needed

O §4 already correctly requests decisions on wrong amounts, duplicate handling, counted-payment correction, failed-conversion retry, D-81/D-98, photos, alert reliability and operating limits.

Additionally:

- **D-103 — owner decision needed:** include photo-fault disputes/corrections in the explicit deferral bundle; C1 §17 already postpones them.
- **D-81/D-98:** obtain approval against the actual potentially extended exposure, not a guaranteed 25 minutes.
- **D-110:** preserve its existing enquiry-case clock when resolving PC-03; immediate detection must not silently change it.
- **D-111:** correct the inaccurate bound; its approved rule need not be reopened.

## Classification coverage

I compared all `##`/`###` headings, extracted test IDs with `rg -o`, expanded numeric ranges and compared unique identities.

| Check | Result |
|---|---|
| SDD 01 headings | 57 headings; 54 section rows. Only container headings §3, §5 and §8 lack their own rows; their children are covered. |
| SDD 02 headings | 54 headings; container headings §7, §9–§13 and §15 lack rows, with children covered. C2 additionally classifies fourth-level §4.1.1. No uncovered operative leaf heading found. |
| SDD 01 tests | **160 unique IDs; all mentioned.** Eight IDs intentionally split across Keep/Later: E-14, E-30, A-03, M-20, M-23, PR-09, O-01, O-02. However, **L-04’s platform-cancel subcase is unassigned**, despite the retained failed-conversion platform-cancel path. |
| SDD 02 tests | **129 unique IDs; 128 classified. TE-03a is missing.** |
| Duplicate classification | **RX2-03** occurs in the full kept RX2-01–06 range and again as classification-only. WH-01/WH-14 have intentional partial splits. |
| Conflicting scopes | **SE-05** retains deletion while WH-12/§10.6 are Later. **WH-08** retains receiver dispatch while §10.3 substitutes `deferred_type`. **SE-07** is deferred although checked admin recovery remains required. **WH-16/HC-03** need explicit receiver gates. |

The rough “220 tests” estimate is not the distinct-ID total: these two SDDs contain **289**. This does not measure executable test-case count.

## Unverified suspicions

- Stand-in adoption/backfill into real SDD 04 is unspecified; I did not establish a cross-upgrade double-refund path.
- Account-specific provider limits remain unverified; no network/provider checks were permitted.
- Whether manual refunds operate outside support hours is unspecified; reconcile that operational promise with D-19.

## Checked and fine

- **01 ↔ 02:** exact conversion/late-resolution contracts, fresh bound evidence, lock order and failed-conversion payment preservation remain; VE/E/TE tests cover them.
- **03 stand-in:** receipt, sale and reversal keys match S2 §9.3/§19; HC-01 retains caller-contract proof. Stand-ins remain prohibited for live money.
- **04:** category 5 consistently uses the internal payment ID, including failed conversion and later replay. Categories 6/6a consistently use `wrong_amount:<cf_payment_id>` and `duplicate:<cf_payment_id>`. HC-02 retains concurrent handover/cap checks.
- **05/08:** receiving ownership remains identifiable, but proof and operational replacements need PC-04/05/08.
- **Phase 9:** listing-trigger and publication lock-order prerequisites remain before P2, with RX-28. Photos move together; printed-book and receipt-sender live gates remain.
- Public start/check retain verified identity and ownership checks. Payment webhooks still require fresh provider reads; unknown-order deliveries open reconciliation cases rather than assigning tenants from webhook claims. Expiry retains the locked evidence wrapper and unknown-creation protection. CF-A35 remains blocked for every live refund category.

No files were changed, staged or committed. No network, database, provider, npm or deployment commands were run.