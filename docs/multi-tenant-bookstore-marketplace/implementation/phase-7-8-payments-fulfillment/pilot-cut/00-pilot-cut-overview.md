# Pilot Cut: Overview

**Created:** 2026-11-12. **Revised:** 2026-11-13 after review rounds 1 to 4 (§8).
**Status:** draft for owner review. Not approved. Grants no code, migration, deployment or
provider authority (AGENTS.md).
**What this is:** a lighter build scope for the five-store pilot, cut from the approved
SDDs. Some rare cases that the SDDs automate become "detect and alert": a named check opens
an admin case, the owner sees it, and a person resolves it with an audited script. The
analysis in the SDDs is kept; only the amount that is built now changes.
**Files:**

| File | Cuts |
|---|---|
| [01-checkout-reservation-pilot-cut.md](./01-checkout-reservation-pilot-cut.md) | [SDD 01](../01-checkout-reservation/01-0-overview.md) |
| [02-cashfree-payments-pilot-cut.md](./02-cashfree-payments-pilot-cut.md) | [SDD 02](../02-cashfree-payments/02-0-overview.md) |

The original SDDs are **not changed**. They remain the approved full design and the target
after the pilot.

---

## 1. Which document wins

For the pilot build, the pilot cut is the authority. To stop the two documents drifting:

- Each pilot-cut file classifies **every** section of its SDD and every test ID. No section
  or test is left unmentioned, so a coder never has to guess whether an omitted rule applies.
- A section marked **Keep** is built exactly as the SDD says.
- A section marked **Simplify** is built as the SDD says, except for the stated change.
- A section marked **Detect** is not automated: the stated check opens an admin case (§5)
  and the stated person resolves it.
- A section marked **Later** is not built for the pilot. Its gate says when it must be.
- The never-cut list (§2) overrides every classification. If a cut appears to conflict
  with it, the never-cut rule wins and the conflict goes to the owner.
- Business rules still come from the decision register. Where a cut changes how a
  decision is carried out, it is listed in §4 and needs the owner's decision first.

**Sandbox only.** Everything built under this cut runs on Cashfree sandbox keys on the dev
project. No live payment is taken and no live refund is sent until SDD 03's ledger and
SDD 04's refund sender replace their stand-ins (§6) and the receiver gates there pass.

## 2. Never cut (for the owner's approval)

These protect money, stock or customer data. They stay automatic in the pilot, whatever
any section below says.

| ID | Rule | Source |
|---|---|---|
| N-01 | A payment counts only after the server reads it from Cashfree. The customer's return and the webhook body only trigger that read | BC-11; SDD 02 §9 |
| N-02 | Webhooks: POST only, HMAC signature checked in constant time, D-114 age limit and the 5-minute future limit, registered version and body contract, 64 KB byte cap, only verified messages stored, event, body and task stored in one transaction | SDD 02 §7.2, §10.1, §10.2 |
| N-03 | Each Cashfree payment is counted at most once: one payment row per checkout, unique `cf_payment_id`, one counted attempt, one order per checkout. Every command is safe to repeat (idempotency key and command ID) | Q37, BC-15; SDD 01 §5.0; SDD 02 §4.1, §9.3 |
| N-04 | SDD 01 §7 lock order in every command; deadline checks read the time after the locks; a deadlock retries the whole transaction | SDD 01 §5.0, §7 |
| N-05 | A book is never held or sold twice: stock bucket CHECK, firm holds, one active hold per item, movement keys | SDD 01 §3.13, §9 |
| N-06 | No timer, scan or admin action releases stock without a fresh Cashfree read and a terminated Cashfree order. An unknown order creation is never treated as "no order". The one existing exception stays: the customer's own cancel (SDD 01 §5.2) releases the books at once and asks for termination afterwards; a payment that still succeeds is refunded in full (SDD 01 §5.6, D-85) | D-101; SDD 01 §5.2 to §5.4; SDD 02 §11.6, §12 |
| N-07 | A customer who paid always ends with an order or a recorded refund obligation, made automatically wherever the SDD makes it automatically. The one manual step that holds back a refund from being recorded is the failed-conversion refund (D-95), which has its case, its deadline and the owner's daily review; the other manual steps are listed in §5. Nothing is left silent | D-04, D-06, D-29, D-78, D-85, D-95 |
| N-08 | No live refund on an order with more than one successful payment (CF-A35). Refunds never exceed the amount paid for that payment. A payment Cashfree kept is never refunded by us (D-109) | SDD 02 §13.1, §13.5 |
| N-09 | Cashfree keys only in server secrets; the adapter refuses to start on the dev project unless the environment is `sandbox`; no key, webhook body, session ID or phone number in any log | Handoff §7; SDD 02 §6, §7.1 |
| N-10 | No client role writes any commerce or payment table or reaches an admin script; RLS on, table grants revoked, service-role wrappers only; `store_id` always taken on the server; customers and stores see only their own rows | SDD 01 §3.8; SDD 02 §6 |
| N-11 | Detection: the payment poll keeps checking every known Cashfree order daily with no end date (owner, 2026-11-12), the daily reconciliation scans run, and every case reaches the owner (§5) | SDD 01 §13; SDD 02 §11.2 |
| N-12 | Amounts are exact whole paise; a fractional or foreign-currency amount is never rounded into an order, refund or ledger amount | SDD 02 §7.3, §13.1 |
| N-13 | Ledger postings (SDD 03) are append-only, balanced and keyed once. Stand-ins (§6) never run against live money | SDD 03 outline §1, §7 |

## 3. Owner decisions taken on 2026-11-12, not yet in the register

Recorded here so they are not lost. They go into the decision register when the owner
says so.

| # | Decision | Effect |
|---|---|---|
| 1 | **Test setup:** disposable local Postgres, as Phase 9 uses; one private time function that returns `clock_timestamp()` in every deployed database and can be offset only in the test harness; SQL suites and `deno check` added to CI | SDD 01 §14's "run against the dev database" is replaced (SDD 01 cut, §2). Every "post-lock `clock_timestamp()`" in the SDDs is read through this function |
| 2 | **Edge Function deployment** to the dev project needs the owner's explicit yes each time, recorded in the tracker | Applies to every Edge Function deployment, including `commerce-payment-start`, `commerce-payment-check`, `commerce-payment-webhook`, the poll and the shared `commerce-task-worker` |
| 3 | **Late-payment safety net:** keep checking every known Cashfree order daily with no end date at pilot scale | SDD 02 §11.2 never clears the poll, so the discovery, cursor and health machinery that SDD 02 §19 hands to SDD 03 is not needed for the pilot |

## 4. Decisions this cut would revisit (owner to decide)

Each item below changes how an existing decision is carried out in the pilot. Nothing is
cut on these points until the owner decides.

| Decision | Today | Pilot proposal |
|---|---|---|
| D-95 (paid but no order) | Admin may retry conversion within 24 hours, or refund; 7-day case escalation | Admin refunds by script; the retry option comes later. The 7-day case deadline and its overdue report stay. The payment stays recorded and the books held until the admin acts (N-07) |
| D-81, D-98 (store suspended, permission lost, closed by admin) | Live checkouts cancelled at once | These pauses block new reservations only. A live checkout ends on its own timers: usually within 25 minutes, but longer if Cashfree cannot be read (D-101) or conversion failed (D-95), as D-111 already notes; holds are never released by guessing. A checkout that pays on time converts and the order continues (D-21); a later payment is refunded under D-98 |
| D-43, D-53, D-25, D-103 (photo check before handover, and photo-fault disputes) | Built in SDD 01 slice 7 | Later: waits on Phase 9's photo contract anyway. Until then no order carries a photo requirement |
| D-02, D-04 (alert delivered, store fault) | Alert acknowledgement and platform-incident records | Later: while `commerce.store_alert_channel_reliable` is false every missed acceptance is fault `platform` already, so neither is needed until the alert channel is declared reliable |
| SDD 01 §3.8 (`mark_order_ready` reached only through SDD 06's and SDD 07's checked commands) | No client caller | A pilot-only store wrapper, with the same server-side store check as `accept_order`, calls it in P6, because the preparation timers are kept. SDD 06's command replaces the wrapper; the two never run side by side. `ready_for_pickup` is the last state in the pilot: no handover or pickup expiry until SDD 06's cut, and sandbox orders left there are closed only by test data |
| SDD 02 §17 items 2 and 15 (poll speed, webhook abuse alerts) | 20-second polling; rejection counters and alerts | One poll pass a minute; rejection counters and flood test later. Size cap and signature checks stay (N-02). The shared Cashfree read budget (item 11) stays |

Wrong-amount (D-29), duplicate (D-78, D-110) and kept-payment (D-109) handling are **not**
changed: their refund obligations are recorded automatically as the SDD says. Earlier
drafts made them manual; review round 2 showed that saved nothing, since in the pilot the
obligations only reach SDD 04's recording stand-in.

## 5. Admin cases and who sees them

Every Detect item and every SDD "admin case" in the pilot goes through this path.

- **Record:** a new table `commerce_admin_cases` (SDD 03's
  `finance_reconciliation_cases` is left to SDD 03): type, entity, opened time, due time,
  status and a summary. The server opens a case in the same transaction as the fact that
  caused it. Opening a case of a type and entity that already has an **open** case does
  nothing; once closed, the same problem can open a new case. Each case type names its
  entity:

  | Case type | Entity |
  |---|---|
  | Payment cases: wrong amount, duplicate enquiry, kept by Cashfree, reversal after refund, CF-A35 block, long-unconfirmed | `cf_payment_id` |
  | Failed conversion, late-payment problems | payment ID |
  | Checkout scans (expired with no task, hold on a closed checkout, grace overdue) | checkout ID |
  | Order scans and timers (acceptance, preparation, missing outcome, no timer task) | order ID |
  | Dead-lettered task | task ID |
  | Cashfree 429s, poll backlog, case delivery failed | a fixed platform entity per type (`cashfree_rate_limit`, `payment_poll_backlog`, `case_delivery`) |

- **No personal data:** case summaries, audit `reason` text, owner notices and the digest
  carry only IDs (order, payment, checkout, case) and amounts, never names, phone numbers,
  emails or addresses. Script output goes to the owner's screen only and is not written to
  any other log.
- **Who:** the owner, as the only admin, until a second admin exists (handoff §7).
- **How they see it:** an in-app owner notice for each new case (a new owner notification
  type), plus a daily digest the owner reads through an audited script. The digest has two
  parts: open cases, oldest first, with overdue ones on top; and reports, the findings of
  report-only scans (SDD 01 cut, §13).
- **Cadence:** reviewed once every working day. A case past its due time is overdue; an
  overdue case stays at the top of every digest until closed. This can add up to one
  working day to each manual step. The manual steps are: the failed-conversion refund
  (D-95); recording the duplicate enquiry and Cashfree's answer (D-110; the no-answer
  clock runs from the case opening, so a late recording never delays the refund); a
  timer requeue after a dead-lettered task; and, before live money only, a refund held
  by the CF-A35 block (N-08).
- **Delivery failure:** the daily reconciliation also checks that the digest ran in the
  last 26 hours and that every case's notice was created (built in P1b with the digest); if not, it opens a
  "case delivery failed" case and the next digest shows it first.
- **Closing:** only by an audited script with a reason; closing never changes money.

The case record, owner notice, digest, digest-delivery check and case-close script all
come in P1b, before any slice can open a case (the Cashfree adapter in P3 already can). The other daily reconciliation scans come in P7. Until P7 is built,
no slice runs unattended: sandbox use is test sessions the owner is present for (§7).

## 6. Building while SDD 03 and SDD 04 are written

SDD 02 posts receipts, sales, reversals, losses and charges to SDD 03's ledger, and SDD 01
and SDD 02 record refund obligations with SDD 04. Until those SDDs are approved:

- those calls go to recording stand-ins with these keys:
  - ledger: `receipt:<cf_payment_id>`, `order:<order_id>`, `reversal:<cf_refund_id>`,
    `duplicate_loss:<cf_payment_id>`, `charge:<cf_payment_id>`;
  - refunds: category 3, the missing-book report ID; category 5, the payment ID;
    category 6, `wrong_amount:<cf_payment_id>`; category 6a, `duplicate:<cf_payment_id>`;
    categories 1, 2, 4, 7, 8 and 19, `cat<N>:<order_id>` (for example `cat4:<order_id>`).
    SDD 01 §20 asks only for "a stable key"; each of these categories ends an order, and an
    order ends once, so this key is unique. SDD 04's interface confirms the format;
- SDD 03 and SDD 04 write their interfaces first, so the stand-ins match; when the real
  function replaces a stand-in, it adopts the recorded rows under the same keys, so a
  request recorded earlier can never be sent twice;
- a stand-in proves only the caller's side, never that money moved (SDD 02 §19);
- no slice that depends on a stand-in is used with live money (N-13, §1).

**Receiver gates kept.** SDD 02's receiving proofs WH-16 and HC-03, and the independent fee
source (SDD 03 §6), are acceptance gates for SDD 03, 04 and 05. They run when those
receivers are built and must pass before live payments.

## 7. Pilot slices

Replaces SDD 01 §19 and SDD 02 §18 for the pilot. Each slice is one branch with its own
tests on the disposable database, reviewed and merged on its own, and leaves the app
working. Revised on 2026-11-13 after Sol's slice review (§8, round 4).

**D** = a separately recorded owner yes for each Edge Function deployment or redeployment
in that slice (§3 item 2).

| Slice | Contents | Needs | Size |
|---|---|---|---|
| P0 | Disposable Postgres runner, test time function, SQL suites and `deno check` in CI | Cut approved; day 1 recorded | M |
| P1a | Schema for checkout, order, pause, payment, attempt, check and webhook tables; settings; constraints; transition triggers; grants and service-role wrappers | P0 | L |
| P1b | Task framework: task types, task-scoped claim and completion, atomic replacement, resolved-task guards, reconciliation exemptions (SDD 01 §8.1, §15); notification types, validators and routes; ledger and refund recording stand-ins (§6); `commerce_admin_cases`, owner notice, digest, digest-delivery check and case-close script, with the shared admin-script security (§5) | P1a; SDD 03 and SDD 04 interfaces agreed (§6) | L |
| P2 | Reservation, cancel, stock helpers, cart guards (Phase 6 rework) and checkout reads; cart UI merged but switched off | P1b; Phase 9's lock-order migration and listing-trigger change (SDD 01 §18) | M |
| P3 | Cashfree adapter, payment start and start recovery, shared read budget, payment reads; Paying screen and web checkout merged but switched off | P2; provider contract checks; D | M |
| P4a | Conversion, late-payment resolution, schedule calculations, receipt in the app, failed-conversion refund script | P3; a test double for payment evidence | L |
| P4b | Verification; wrong-amount, duplicate and counted-payment-reversal handling with their automatic refund obligations; the duplicate-watch commands with the enquiry and answer scripts; customer Waiting, result and order-detail screens. Gate: one real-phone sandbox payment with a verified return, through a controlled test entry | P4a; D | L |
| P5a | Reservation and grace expiry, the locked evidence wrapper, real termination; checkout and payment handlers in `commerce-task-worker`; timer requeue script | P4b; termination checks against the planned API version; D | M |
| P5b | Webhook endpoint: intake, atomic processing and finish, deferred event types; its worker branch | P5a; signing, version and ingress checks (webhook-version check); D | M |
| P5c | Poll with leases, scheduled start recovery, scheduled duplicate watch; poll and webhook race and recovery tests | P5b; D | M |
| P6 | Store acceptance, missing books, preparation and "Mark ready" (pilot store wrapper, §4), each command with its worker handler; store order screens and pause switch. **Switch-over:** the new checkout is switched on and the old order submission is closed to new carts in the same slice (SDD 01 §15) | P5c; the whole customer path passing; D | L |
| P7 | Remaining daily reconciliation scans (SDD 01 §13; SDD 02 §11.1 backlog), key-rotation rehearsal (SE-06), final cross-slice tests. From here slices may run unattended | P6; D for the rotation | M |

**Switched off until P6.** Until the switch-over, the new screens are reachable only
through a controlled test entry, and the existing Phase 6 order path keeps working
unchanged. No customer can start a checkout that the built slices cannot finish.

**Tests by slice.** Each kept test runs in the slice that builds what it tests. A test
that also needs a later slice runs there with a fixed-contract test double and is
completed in the later slice; it must pass before that slice merges. Named cases:

| Test | Starts | Completed in |
|---|---|---|
| PA-04, PA-09, PA-11 | P3 | P4b (verification) |
| E-13, E-24 | P5a | P5a (requeue script) |
| E-17, E-21, O-04 | P5a | P6 (order handlers) |
| PC2-01's backlog assertion | P5c | P7 |
| PC2-03 (kept-payment refusal) | P4b | P6 (every refund path built) |
| PC2-05 (admin-script security) | P1b | each slice that adds a script |
| SE-06 (rotation rehearsal) | P7 | P7 |
| HC-01, HC-02 (receiving contracts) | P1b | when SDD 03 and SDD 04 replace their stand-ins |

Pickup handover (SDD 06), refunds actually sent (SDD 04), payouts (SDD 05) and the ledger
itself (SDD 03) follow in their own pilot cuts.

## 8. Review

**Round 1:** Codex Sol, 2026-11-13, three angles (attacker, what is missing, handovers):
[report](./review-r1-sol.md), "ready after fixes", 10 major and 3 minor findings, no
blocker. All fixed on 2026-11-13: the duplicate watch, §13.5 and the shared read budget
restored; case visibility (§5); script security; slice order; receiver gates; test
mapping; the D-111 wording.

**Round 2:** a general read by OpenCode DeepSeek 4.1 Flash, MiniMax M3.1 Flash and
GLM 5.3 Flash, 2026-11-13. All three: "ready after fixes", no blocker. Twelve fixes, all
applied on 2026-11-13:

| # | Fix |
|---|---|
| 1 | The store's "Mark ready" is built in P6, so the kept preparation timer cannot cancel every order |
| 2 | Owner notice, digest and refund scripts moved to P4 and P5, before cases can arise; wrong handoff reference removed |
| 3 | Wrong-amount and duplicate refund obligations recorded automatically again (§4) |
| 4 | Sandbox-only rule stated (§1) |
| 5 | Refund keys for every category and the charge key listed (§6) |
| 6 | RC-01 and O-03 split into kept and Later parts |
| 7 | The digest has a reports part for report-only scans (§5) |
| 8 | New `commerce_admin_cases` table; duplicate-case rule applies only to open cases |
| 9 | SDD 02 §11.5 reclassified Simplify; 429 count source named; `payment_poll_batch_max` = 25; backlog case opened by the daily reconciliation |
| 10 | `cancels_live_reservations` keeps the SDD's values; the pilot has no caller that acts on it |
| 11 | Deploy rule covers every Edge Function (§3) |
| 12 | References corrected: SDD 02 §19 machinery belongs to SDD 03; SDD 02 §15.1 examples 5 and 6 |

**Round 3 (final):** Claude Sonnet, 2026-11-13, a whole read. "Ready after fixes", 7
minor findings, no major. All applied on 2026-11-13:

| # | Fix |
|---|---|
| 1 | The shared task worker is deployed in P5; P6 depends on it (§7) |
| 2 | Admin-script credentials: dedicated role, secret never committed or printed (SDD 02 cut) |
| 3 | Every manual step listed (§5); N-07 wording narrowed |
| 4 | Digest-delivery check moved to P4; no unattended use before P7 (§5, §7) |
| 5 | Case entity named per case type (§5) |
| 6 | No personal data in case summaries, audit reasons, notices or the digest (§5) |
| 7 | The P6 "Mark ready" wrapper recorded as a pilot deviation from SDD 01 §3.8; `ready_for_pickup` is the last pilot state (§4) |

**Round 4 (slices only):** Codex Sol, 2026-11-13. "Rework needed": 6 major and 2 minor
findings on the slice division, scope unchanged. Fixed by replacing §7 with Sol's
12-slice table: the P5/P6 dependency loop removed (each order command now arrives with
its worker handler); new screens switched off until a single switch-over in P6, so the
Phase 6 order path keeps working; the case path moved to P1b; the duplicate-watch
commands moved to P4b; owners named for the task framework and every screen; test start
and finish slices named; receiver interfaces and a deploy yes added as needs.
[Report](./review-r4-sol-slices.md).

No further review round is planned. Next: the owner approves the never-cut list (§2), the
decisions in §4 and this cut.
