# Phase 7/8 Handoff and Session Start

**Created:** 2026-11-07
**Status:** planning handoff. Phases 7 and 8 are still `deferred` in DOC-13 and Phase 10 is
`not_started`. This document grants no implementation, migration, deployment, or
live-payment authority.
**Scope:** Phase 7 (payments, ledger, refunds, settlement via Cashfree Easy Split), Phase 8
(pickup), and the pilot subset of Phase 10 (same-day Bengaluru bike delivery, D-24).

**Start prompt for a fresh session (the owner pastes it):** "Read AGENTS.md, then
docs/multi-tenant-bookstore-marketplace/implementation/PHASE-7-8-HANDOFF.md in full, then
follow its §1 reading order. Until the handoff §10 recording step (step 4) is done, Phase 9 is still the active
phase in ACTIVE.md; the Phase 7/8 lane is approved (handoff §3) but has only the authority
stated in §10. State the phase, active work unit, next authorized action, blockers, and
database-mutation authority back to me before acting. I will tell you in the same message
whether day 1 is today; if I do not, do only step 3 of §10, report, and wait."

This document carries everything settled in the 2026-10-16 to 2026-11-07 planning
conversations that is not already in the decision register. A new session in a fresh
folder must be able to continue from the repository alone. Chat history and local AI
memory are not available there.

---

## 1. Reading order for a new session

1. [AGENTS.md](../../../AGENTS.md): repository rules and authorization boundaries.
2. [ACTIVE.md](./ACTIVE.md) and [DOC-13](../DOC-13-implementation-tracker.md): global status.
   Until the §3 approvals are recorded in DOC-13 and ACTIVE.md (§10 step 4), Phase 9
   remains the only active phase and Phases 7 and 8 stay `deferred` (register Q120).
3. **This document.**
4. [Decision register](./PHASE-7-8-decision-register.md): the owner's business decisions
   (authoritative over the question bank).
5. [Admin console proposal](./PHASE-7-8-admin-console-proposal.md).
6. [Cashfree/tax/compliance research brief](./PHASE-7-research-cashfree-tax-compliance.md).
7. [Question bank](./PHASE-7-8-question-bank.md): research history and enterprise
   patterns. Its section 0.1 and any ₹80 delivery-fee text are superseded.
8. Phase trackers: [Phase 7](./PHASE-7-payment-ledger-settlement.md),
   [Phase 8](./PHASE-8-pickup-fulfillment.md), [Phase 10](./PHASE-10-third-party-delivery.md).
   Their goals and scopes predate the decisions (see §9).
9. Root specifications, read in full during the documentation pass: DOC-0, 1, 2, 5, 6, 7, 8,
   9, 10, 12, 14, 15, 16 (all appear in the §9 conflict map).
10. [Phase 6 pay-first impact check](./PHASE-7-8-phase6-impact-check.md) (2026-11-08, read-only)
    and §9 "Photo-request rework": stage 0 findings made before day 1.

## 2. Where things stand (2026-11-07)

- **Owner approvals:** all seven §3 items approved on 2026-11-07.

- **Business decisions:** recorded in the register; D-01 to D-25 were taken on
  2026-11-07, D-26 to D-41 on 2026-11-08, D-42 to D-46 on 2026-11-09, and D-47 to D-77 on 2026-11-10. Remaining open items are in register §10: pilot stores and dates, bike-provider
  choice, support staffing, P-4, offline stock sync, and the CA and lawyer items. The 12 review owner questions were answered on 2026-11-08 (D-26 to D-37), and four final-read questions the same day (D-38 to D-41).
- **Provider facts:** several Cashfree and delivery facts are unconfirmed (register §9).
  SDDs must treat them as settings or as both-branch designs, never as fixed rules.
- **Code:** nothing built. Phase 6 implements "store confirms, then customer pays"; BC-08
  replaces this with reserve-first, pay-first checkout.
- **Repository:** the planning files were written on branch
  `codex/unit6i-owner-review-saved-books` (many commits behind `origin/main`). They must
  reach `origin/main` before the fresh folder is created (§10).

## 3. Owner approvals before day 1

**All seven items below were approved by the owner on 2026-11-07, as recommended.** The
"Record in" column names where each approval must also be written; register and admin
proposal entries are done (item 6 is in register BC-41; DOC-8 gets it in the documentation
pass); DOC-13, ACTIVE.md, and AGENTS.md entries happen on day 1 (§10).

| # | Item | Recommendation | Record in |
|---|---|---|---|
| 1 | Resume Phases 7 and 8, bring the Phase 10 pilot subset forward, and authorize the documentation pass (scope of authority: §10) | Yes, as a second lane beside Phase 9 | DOC-13, ACTIVE.md, AGENTS.md pointer |
| 2 | Shared-file rule for two lanes: this lane does not edit Phase 9 files; DOC-13, ACTIVE.md, and AGENTS.md are edited by one lane at a time; migration timestamps are checked against the live database before each new migration | Yes | ACTIVE.md |
| 3 | SDD folder `implementation/phase-7-8-payments-fulfillment/` | Yes | ACTIVE.md |
| 4 | P-3 (Easy Split in principle), P-5 (build sequence), P-6 (pickup independent of the delivery quote) | Yes to all three | Register §8 |
| 5 | Admin console option B: a separate admin website in the same repo, only calling audited server functions; scripts over the same functions during test-mode building | Yes | Admin proposal §6 |
| 6 | Store-hours rule: opening hours required before a store gets the "accept online payment" permission (BC-41); a "pause online orders" switch; India time zone | Yes | Register and DOC-8 in the documentation pass |
| 7 | The five process additions (§5) | Yes | This document |

**Shared-file mechanics (item 2):** before editing DOC-13, ACTIVE.md, or AGENTS.md, check
`git status` and the other lane's open branches for uncommitted or unmerged edits to those
files; make the edit as one small separate docs change; tell the owner. The owner
arbitrates any conflict.

## 4. Timeline (D-01, Option A)

Day 1 is the date the §3 approvals are recorded in DOC-13 and ACTIVE.md (§10 step 4), not
the date they were given; week 1 starts on day 1. "Done" means working with Cashfree test
money, not live.

| Weeks | Work |
|---|---|
| 1 | Stage 0 checks (§8); Cashfree test run; SDD skeletons reviewed; Cashfree questions sent; bike-provider API check starts |
| 1–2 | Root-document updates (§9) and SDDs written and reviewed (§5, §11) |
| 2–3 | Payment core: reservation, Cashfree order, webhook, verification, failures, late payments, ledger. Each slice's code starts only after its SDD and test list are approved |
| 3–4 | Pickup (Phase 8); refunds; store entitlement, payouts, recovery |
| 5–6 | Bengaluru bike delivery (D-24); admin website modules 1–10 and delivery module 11 in parallel (different files) |
| 6–7 | Integrated test-mode acceptance; Phase 6 deferred browser test |

Milestones (one plan): payments and pickup in test mode by the end of week 4 (D-01); bike
delivery by about week 5.5–6 (D-01); integrated acceptance in weeks 6–7, so about 6 weeks,
possibly 7 (admin proposal §5).

**Schedule rules (D-46, 2026-11-09):** the SDD set is written and reviewed before day 1
(§10 step 1), so the "SDDs written and reviewed" part of weeks 1–2 is mostly done before
the clock starts and weeks 1–2 go to root-document updates, the rest of stage 0, and
slice 1. The working week is Monday to Saturday (24 working days in 4 weeks). If week 4 is
at risk, the owner and Claude decide at that time what to cut or move. Still open: how much
owner time the running Phase 9 lane takes in these weeks (affects review speed).

**Checkpoints where the estimate is re-stated to the owner:** after the Phase 6 impact
check (week 1) and after SDD approval (end of week 2).

**Risks to the timeline:** size of the Phase 6 pay-first rework; Cashfree answers on holds
and refund splits; whether a bike-delivery provider has a usable API; this lane running
full time while Phase 9 continues.

**Daily tracking (owner requirement):** the lane tracker is
`implementation/phase-7-8-payments-fulfillment/TRACKER.md`, created on day 1 (it is the
"Phase 7/8 tracker" named in register D-01). Every working day add a dated entry: done, verified, blocked, decisions needed, next action. Compare against this
week plan and report slippage the same day.

**Live payments** additionally need: Cashfree live approval, the CA and lawyer answers,
the delivery provider contract, the five stores onboarded with KYC, reliable store alerts
(D-02), the complaint ticketing tool, and one small real-money test (BC-43).

## 5. Working process

**Roles (owner preference):**

- Claude writes and edits every SDD and orchestrates.
- Codex Sol writes implementation code.
- Cheaper models run test suites and browser checks with strict prompts.

**SDD reviews:**

| Reviewer | Angle |
|---|---|
| Codex Sol | Technical correctness: payment states, database guarantees, idempotency, migrations, security |
| DeepSeek | Money: ledger math, fees, refunds, recovery, every failure case |
| Muse | Consistency with owner decisions, root documents, and the register; nothing missing |
| Sonnet | Fresh full read: contradictions, gaps, unclear parts |

- Money-critical SDDs (payments, ledger, refunds, settlement) get all four reviewers.
  Supporting SDDs (pickup screens, admin screens) get Sol and Muse.
- Reviews are independent; reviewers do not see each other's findings.
- Claude verifies each finding against code and documents and fixes the real ones; the
  reviewer that raised a blocker re-reviews.
- A final Sonnet read covers the whole SDD folder.
- Reviewers cannot change product decisions; such findings go to the owner.

**How reviewers were run (planning-package review, 2026-11-07/08):** OpenCode CLI from a
read-only snapshot of the docs, `opencode run --agent plan --dir <snapshot> -m
opencode-go/<model>`, with models muse-spark-1.3-contributor, deepseek-v4.1-flash,
qwen3.8-flash, and glm-5.3-flash; files were hashed before and after. Haiku checked quotes
mechanically; Sonnet judged findings; Claude verified and fixed. The `plan` agent blocks
edits but allows shell commands, so the snapshot and hashes are the real protection. For
money-critical SDDs, the owner's rule is `opencode-go/deepseek-v4.1-flash` (not pro; owner, 2026-11-10).
Codex Sol is run through the Codex CLI. Confirm current model names with the owner on day 1.

**Five process additions (approved 2026-11-07, §3 item 7):**

1. The SDD skeleton (sections, states, tables) is reviewed before full writing.
2. Every money rule has a worked rupee example (for example a ₹400 book paid by UPI,
   refunded after payout).
3. A Cashfree test-mode run in week 1 checks the documented behaviour.
4. The test list is written and reviewed before code.
5. At most two review rounds per SDD; remaining disagreements go to the owner.

## 6. Outside parties: what to ask and when

Rule: ask early, and design so late answers change settings, not code. Claude drafts every
outside message; the owner sends it from the owner's own accounts. Claude never sends on
the owner's behalf.

| Party | Topic | Needed by | If late |
|---|---|---|---|
| Cashfree | Design questions below | End of week 1 | Design both branches; the week-1 test run answers part |
| Cashfree | Fees: payment, split, payout, refund, bank verification | Week 4 | Fees are settings |
| Cashfree | Live approval, Easy Split live, payment methods, refund time limit | Before live | Blocks live only |
| CA | TDS on store payments; who invoices whom; ledger account classes | Weeks 2–4 | Built as settings; adjusted later |
| CA | GST on delivery charges | Week 5 | Price breakdown adjusted |
| CA | Registrations, TCS, TAN, LLP filings | Before live | Blocks live only |
| Lawyer | Store agreement, customer terms, privacy policy, using drafts Claude writes | Ask in week 3, answers by week 6 | Text changes later |
| Delivery provider | API check (below) | Weeks 1–2 | Fall back to a courier aggregator (D-24) |
| Pilot stores | Five stores, hours, bank and KYC documents | Before live | Blocks live only |

**Ready-to-send versions (2026-11-09):** [Cashfree](./PHASE-7-8-questions-cashfree.md),
[CA](./PHASE-7-8-questions-ca.md), [lawyer](./PHASE-7-8-questions-lawyer.md). They merge
§6.1–6.3, the research brief, the question bank and the register, with a source for every
question. Where they differ from §6.1–6.3, the ready-to-send files win.

**Cashfree account:** the owner creates the test account and requests Easy Split in test
mode before week 1. Secret keys go only into server secrets, never into chat or the repo.

### 6.1 Cashfree questions (draft, not sent)

1. Can a vendor's split share be held until BookConnect releases it (for example 3 days after handover, then the
   next weekly Monday run, D-28)? What is the maximum hold?
2. How does a refund take back the vendor's share: full, partial, and repeated partial
   refunds? Before and after the vendor has been paid?
3. What happens when a vendor's balance is too low to cover a refund or chargeback?
4. Who is debited for a chargeback under Easy Split, and how is the vendor share recovered?
5. Can vendors be created, verified, and updated by API? Which KYC is required?
6. Refund time limit (API page says six months, terms 180 days, grievance policy 120 days):
   which applies to our account?
7. Fees for each method (UPI, cards), split, payout, refund, and bank verification;
   any startup or promotional pricing?
8. Can the payment fee be reported per transaction so it is deducted from the vendor
   share (D-13)?
9. When a refund to the original UPI or card account fails (account closed, rejected),
   where does the money go and what is the compliant alternative?
10. Is the payment fee returned when a payment is refunded, fully or partly?
11. How are duplicate successful payments for one order, or a paid amount different from
    the order amount, reported? Can the amount be locked at order creation?
12. Is webhook secret rotation with an overlap period supported?

### 6.2 CA questions (draft, not sent; updated for 2026-11-07 decisions)

1. Are new and used printed books (HSN 4901) still GST-exempt after the September 2025
   rate changes?
2. The delivery charge: BookConnect collects the provider's quote from the customer and
   pays the bike-delivery provider (no markup). What GST applies, and is it BookConnect's
   own supply or a pass-through?
3. E-commerce GST TCS: does it apply if books are exempt but delivery and future
   commission are taxable? Must BookConnect register as an e-commerce operator?
4. Do stores that sell only exempt books need GST registration to sell through BookConnect?
5. Income-tax deduction on payments to stores (s.393, formerly 194-O): rate (0.1%?); base
   (book amount only, or including delivery); the ₹5 lakh exemption; timing; TAN and forms.
6. GST on future commission and subscription (18%?). Must BookConnect register now during
   the zero-fee pilot?
7. Invoices: does the store issue the customer's bill of supply, or may BookConnect
   generate it for them? What does BookConnect invoice for delivery?
8. Accounting for: store money passing through Cashfree (not BookConnect revenue); the
   Cashfree fee deducted from the store share (D-13); refunds BookConnect advances and
   later recovers (D-14); chargebacks; delivery claims; losses written off (D-08).
9. Recovering a store's debt from future payouts: accounting and TDS effect.
10. Extra registrations or filings the LLP needs to run a marketplace.

### 6.3 Lawyer questions (draft, not sent; fixed-fee review of three drafts)

1. Contracts making the store the seller and BookConnect only the marketplace (Q2).
2. Store agreement: Cashfree fee deduction (D-13); recovery from payouts and 7-day
   repayment (D-14); starter limits and suspension (D-20, D-21); later pricing with 30
   days' notice and in-app acceptance (D-23); liability limits.
3. Customer terms, enforceability under the Consumer Protection Act: pay-first checkout
   and 10-minute reservation; 24-hour automatic cancellation (D-04); automatic partial
   refunds; deducting delivery costs on customer-caused failures (D-09, Q45b); refund after
   inspection (D-10); no change-of-mind returns for new and used books (D-12); 48-hour
   reporting target (Q60); the 3-day pickup window (Q71).
4. E-Commerce Rules 2020: seller details to display; whether the owner may be the
   grievance officer; minimum complaint-ticket system (48-hour acknowledgement, one-month
   resolution).
5. Privacy (DPDP Act 2023): sharing customer phone numbers and addresses with stores, the
   delivery provider, and Cashfree; what the privacy policy must say.
6. Delivery: BookConnect's liability to customers for lost parcels when it books the
   rider; what to check in the provider's terms.
7. Can BookConnect hold or withhold a store's money during disputes, fraud, or chargebacks?
8. Is store debt recovery enforceable if the store stops selling?
9. If a refund to the original account fails, which alternative refund route is permitted?

### 6.4 Delivery provider API check (weeks 1–2, D-24)

For Shiprocket Quick, Porter, Borzo, or another provider, confirm in their official
documentation or with sales: quote by pickup and drop address; booking; status webhooks
or polling; cancellation and its charge; failed-delivery and return-to-store handling and
charges; proof of pickup and delivery; serviceable area; business account terms and
billing; test or sandbox access.

## 7. Security baseline (goes into every SDD and its test list)

**Secrets and environments**

- Cashfree and delivery keys only in server secrets; never in the app, repo, or chat.
- Test keys only in the existing dev Supabase project; live keys only in a separate
  production project. Two-factor login on the Cashfree dashboard.

**Money integrity**

- The server calculates every amount from the database; the client sends only IDs (BC-05).
- A payment counts only after the server checks Cashfree directly (BC-11).
- Hosted Cashfree checkout, so card data never touches BookConnect (PCI SAQ A).

**Webhooks**

- Verify the signature on every message; reject stale timestamps to stop replays.
- Process each event once, then confirm status with the provider before acting.

**No duplicates**

- At most one successful payment per order, enforced by the database.
- Our own unique ID on every Cashfree order and refund.
- Locks on concurrent actions so two refunds cannot both pass.

**Database-enforced money rules**

- No client writes to finance tables.
- Ledger rows are append-only and balanced; corrections by reversal.
- No negative amounts; total refunds never exceed the amount paid.
- Amounts in paise.

**Tenant isolation**

- `store_id` always derived on the server.
- Customers see only their own payments.
- Stores see only a restricted settlement view.

**Admin**

- Admin role required; every action through an audited server function with a reason.
- Never edit finance tables directly in the Supabase dashboard.

**Refunds**

- Only to the original payment method (RBI rule).
- Approval rules per D-22 as clarified by D-29, D-38, D-40, D-45 and D-61.

**Pickup code**

- Random, single-use, expiring, attempt-limited, stored hashed.

**Abuse limits**

- Caps on orders, payment attempts, and reservations per customer.
- Starter store limits (D-20).

**Personal data**

- Phone and address shared only as needed with the store and delivery provider.
- Kept out of logs and Sentry.

**Monitoring**

- Alerts for stuck payments, failed webhooks, and reconciliation mismatches.
- A kill switch that stops new payments while refunds keep working.
- The D-08 loss-cap pause.

**Additional controls (added after the 2026-11-08 review)**

- A refund with an unknown outcome is queried by its stored own ID, never re-issued with a
  new ID.
- Webhook secrets rotate with an overlap period; failed events go to a retry queue and a
  replay job; payment status is also polled independently.
- Admin login uses two-factor authentication; sessions time out; money actions ask for
  re-authentication; audit rows cannot be edited or deleted and are exportable.
- Daily payment and refund reconciliation and weekly settlement reconciliation, with a
  named owner and a recorded sign-off.
- Raw Cashfree payloads, tokens, UPI or bank details, and full customer details are never
  logged (tested).
- Point-in-time recovery is on for the production project; a restore drill is done before
  live.
- A change of store bank details triggers re-verification, blocks payouts for a cooling
  period, and alerts the admin.
- Two-person approval cannot work while the owner is the only admin; compensating controls
  (two-factor login, per-refund and daily limits, after-the-fact alerts) apply until a
  second admin exists (admin proposal module 13).

**Attack tests**

- Forged webhook; tampered amount; replayed webhook; cross-store read; double refund.
- Each slice gets a Codex Sol security review.

## 8. Stage 0 checks (week 1, read-only unless authorized)

1. Phase 6 pay-first impact (done early on 2026-11-08: [impact check](./PHASE-7-8-phase6-impact-check.md),
   about 3.5–4.5 working days of rework; re-confirm on day 1): which states, tables, screens, and tests change (sizes the
   rework; first timeline checkpoint).
2. Store hours: data quality of `operating_hours`/`special_hours`, holiday handling,
   timezone.
3. Quick "mark sold" for counter sales in store screens (D-15).
4. Photo-request flow end to end (BC-06/07): checked early on 2026-11-08; see §9
   "Photo-request rework". Re-confirm the live row counts on day 1.
5. Live database vs local migrations for any earlier Phase 7 tables (Supabase MCP,
   read-only); migration numbering alongside Phase 9.
6. Existing notification tables (`marketplace_notifications`, `notification_*`) for
   in-app notices (D-02).
7. Cashfree test-mode run (§5 addition 3). This run is authorized by the owner's approval of
   §5 addition 3 (§3 item 7). It uses only Cashfree test-mode credentials the owner places in
   server secrets (never in chat or the repository), may create test orders and test refunds
   in the Cashfree test account, writes no database rows and no product code, and keeps any
   throwaway script and notes under `implementation/phase-7-8-payments-fulfillment/` (not in
   app or server code). Results go in TRACKER.md.

Supabase and branches: use the existing dev project; verify its project ref through
Supabase MCP on day 1 and again before each migration (AGENTS.md). Check migration
timestamps against the live list and Phase 9's range before each new file. One branch per
slice from the fresh folder's `main`. Creating a branch is allowed; staging, committing,
pushing, and opening a PR happen only when the owner asks (AGENTS.md). At the end of each
slice or docs change, report uncommitted files and ask once.

Take the dev project ref from the Phase 9 SESSION-START or migration ledger (read only) and
confirm it with Supabase MCP and the owner on day 1. At session close run the continuity
validator named in ACTIVE.md and record whether it covers this lane's files.


## 9. Known conflicts to fix in the documentation pass

Trackers must not originate behaviour. These conflicts are resolved by updating the root
specifications first, then the trackers. This map comes from a full sweep of the root
specifications, trackers, and research brief on 2026-11-08 (14 review runs, checked by
Haiku and Sonnet, spot-checked by Claude). Line numbers are approximate; use the ranges.
Nearly every row has one of two causes: the Phase 6 "store confirms, then customer pays"
design (replaced by BC-08), or the courier-aggregator delivery model (replaced for the
pilot by D-24).

| Document | Lines (approx.) | Current text | Required change |
|---|---|---|---|
| DOC-0 | 44–67, 301, 320–363, 441, 479 | Store confirms before payment; customer pays only for confirmed items; pay-first called a refund risk; 6 h–1 business day confirmation window | Pay-first (BC-08, BC-09); D-04 deadline |
| DOC-0 | 384–386, 408–410, 463 | Trial 3–6 months; commission on completed orders; pickup "when store enables it"; no-provider tariff; Shiprocket/Shipmozo/NimbusPost | Q19, Q7, Q13, Q20 waiver; D-24; BC-22; P-6 |
| DOC-1 | 248, 378–379 | Data shared with delivery partners after confirmation; request confirmed/rejected audit events | Share after verified payment and booking; audit events for acknowledgment and D-04 cancel |
| DOC-2 | 62, 183–202, 195, 288–291 | Order requests; per-store pickup toggle, delivery radius, minimum order value, store return templates; 6 h confirmation window; 3–6 month founding programme | BC-08 wording; D-24 (pickup always offered); D-18 central pincode list; D-12 uniform returns; Q19, Q20; minimum order per D-36 |
| DOC-5 | 19, 120–128, 242, 291, 373 | Order final only after store confirms; photo gate; pickup when store enables it | BC-08 messaging; D-25; D-24 |
| DOC-6 | 17, 39, 44, 100–142, 211, 246–268, 405–425, 592–617 | Whole confirm-before-pay flow: soft hold at confirmation, 60-minute payment window, expiry dead ends, no late-success path; confirmation window in open hours | BC-08, BC-09, Q36–Q38, BC-10, D-04, D-06, D-15 |
| DOC-6 | 45, 277–305, 603 | Delivery charge from a BookConnect policy tariff; minimum order value; free-delivery threshold; Phase 6 must not call a provider | Provider's live quote at checkout (BC-22, D-24); P-6 fallback; say where the quote is requested; minimums per D-36 |
| DOC-6 | 49–51, 317–345 | Paid-before-fulfilment cancel is policy-controlled; store-specific returns and refunds; substitute offers; commission without waiver | Q45, Q57, Q61, D-12, D-22, Q7; substitutes per D-35 |
| DOC-5 (242), DOC-6 (114, 138, 607), DOC-8 (309, 567), DOC-14 (47, 103, 111, 162, 455–456) | as listed | Requested photos must be provided and accepted before confirmation or `payment_ready` | Customer may pay without waiting (D-25); photo check before handover (D-43); full list below |
| DOC-7 | 15, 32, 38–39, 62–77, 233, 432 | Fulfilment starts after store confirms; policy tariff with minimum subtotal and free-delivery threshold; quote is cost only | BC-08; BC-22 quote at checkout; D-11; D-24; D-36 |
| DOC-7 | 47, 156, 237, 253–265, 452–453 | NDR/RTO/weight-dispute states; liability matrix; weight reconciliation; same-day deferred; reverse pickup deferred | D-24, D-17, D-09, BC-34, BC-35; same-day is the pilot method; return travel per D-32; courier states kept for the later option |
| DOC-8 | 74, 154, 190–191, 285, 438, 554–563 | Console built on "Requests Awaiting Confirmation", full/partial confirmation, confirmation SLA metrics | Paid-order inbox with acknowledgment (BC-12, D-04) |
| DOC-8 | 324, 343–344 | "Mark ready for delivery"; store-editable return policy and delivery availability | D-17 "Ready to ship"; D-12; D-18; store-hours rule (BC-41) |
| DOC-9 | 30, 118, 135, 166, 188–201, 472 | Admin assumes confirm-then-fulfil; operators decide all refunds; NDR/RTO/weight disputes; pause stores for billing | BC-08; D-22 automatic refunds; D-24; BC-02, D-23; admin option B modules |
| DOC-10 | 17, 114–130, 196–224, 253, 272, 451–452 | Events built on request confirmation, `confirmation_due_soon`, `order_request.expired`, `payment_ready_expired` | Pay-first events; BC-12 reminders; D-04 cancel |
| DOC-10 | 155–161, 185, 272–274 | Courier NDR/RTO/reattempt events; "MVP should include push" | D-24 events; D-02 (in-app only until Phase 11; reliable store alerts before live) |
| DOC-12 | 34, 126, 272–330, 412, 467, 488–492, 539 | Build flow: unpaid request, store confirmation, then payment; no-provider tariff; pickup-first pilot | P-5 sequence; BC-08; BC-22; Q26 |
| DOC-12 | 391, 544, 581, 642 | Shiprocket/Shipmozo/NimbusPost; aggregator pilot; weight-dispute metric | D-24 (courier later). Line ~310 "Phase 7/8 deferred" is a status line, updated with DOC-13 |
| DOC-14 | 35, 39–40, 103–113, 162, 208–210, 256, 266, 282–285, 320–322, 340–342, 443 | Payment after confirmation; 6 h SLA; hold at confirmation; cancel guarded by "payment not started"; all refunds via operator; substitute choice | BC-08, BC-09, D-04, Q45, Q65, D-22, D-06, D-14, BC-40; D-35 |
| DOC-14 | 111, 231 | Delivery eligibility at the "delivered" event; pickup forced below a delivery minimum | Q50b (handover to the delivery partner); D-36 |
| DOC-15 | 33–34, 113, 139, 174, 209, 213, 239 | Weekly settlement and founding terms; gateway fee on refund is a platform-borne loss; holdback tied to change-of-mind return windows; reattempt cost "by policy" | Q51, P-3; D-13 and D-27 (fee on refunds); D-12 (no change-of-mind returns); D-28 (payout timing); D-14; D-09; BC-23/24 |
| DOC-16 | 26, 29, 31–32, 43–45, 70–79, 93–102, 172–174, 194, 206–207, 241–246 | Locality gating; pickup-first with delivery later; confirmation metrics; 3–6 month waiver; commission; stale open questions | D-18; Q26, P-5; BC-08; Q7, Q13, Q20; mark decided questions (Q4, Q55) |
| Phase 7 tracker | 5, 44, 60, 76, 79 | Goal and acceptance "payment only after store confirmation"; provider not selected; "Phase 6 must be complete" | BC-08; Cashfree selected (Q4); acceptance per register; BC-08 reopens Phase 6 (P-5) |
| DOC-13 | ~1830 | Global Blocker: "Payment provider not selected." | Cashfree selected (Q4) |
| Phase 8 tracker | 5, 84 | Pickup before third-party delivery; pickup as the proof point before aggregator integration | Pickup and bike delivery launch together (Q26, P-5, D-24) |
| Phase 10 tracker | 21 | Shiprocket/Shipmozo/NimbusPost adapter, weight disputes | Pilot local bike-delivery adapter (D-24); courier scope deferred |
| DOC-13 | ~1822 | Phase 10 row: "Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators" | D-24 local bike-delivery adapter; change it in the same edit that adds "resumed" (§10 step 4) |
| Research brief | 26, 167, 213 | Orders must finish within about 45 days; six-month refund window; eligibility date = pickup + return window | Mark the 45-day and refund-window claims withdrawn or UNVERIFIED (register §9, §12); eligibility per Q50a, Q50b, P-3, D-28 |

The documentation pass must still read each root document in full and record any further
conflict it finds.

### Photo-request rework (cross-lane, found 2026-11-08)

Owner rule: a photo request is extra information about a listing; it never reserves the book
(BC-07) and never blocks payment (D-25). If the customer pays while a request is open, handover
waits for her photo check (D-43).

What exists (read-only check of code, docs, and the live dev database, 2026-11-08):
- Only migration `20260722000008_marketplace_phase9_request_photo_seam.sql` (live) and the
  `media_assets.request_photo_request_id` column (`20260722000003`). No app, worker, or edge code
  calls it; the live database has zero photo requests, soft holds, or photo jobs. Phase 9 Unit 9
  (photo screens) is `not_started`.
- It follows the old rule: the request is keyed to a Phase 6 order-request item; store confirm
  creates a soft hold and sets `awaiting_customer_decision` (seam ~line 212–216); customer accept
  requires the soft hold and promotes it to firm (~232–238).
- Latent defects: nothing claims the `request_photo_validation` or `request_photo_hold_expiry`
  jobs (the wake dispatcher allows only three other job kinds), so photos never reach `provided`
  and soft holds never expire; photo accept and Phase 6 `promote_request_soft_holds` conflict over
  firm promotion (Phase 6 raises on a non-soft hold); the `order_request_item.photos_requested`
  event has no notification routing; retention and listing-freshness rules (SDD 06 §10–11) are not
  implemented.
- Documents still saying "photos before payment" or "hold for the requester": Phase 9 SDD 06
  (lines 9, 21, 52, 64, 66, 218), Phase 9 decisions P9-D31/P9-D32 (`trackers/01-planning-and-decisions.md`
  96–97), master SDD 120, Phase 9 README 374, `trackers/02-implementation-and-verification.md`
  2374–2376, `supporting/database-current-vs-target.md` 878,
  `work-units/00b-backend-api-technical-design-plan.md` 45, Phase 9 TRACKER 1580 (SDD 06
  `approved_baseline`) and 1632, DOC-3 504–505, DOC-13 Phase 9 history (~1179–1199),
  `PHASE-9-image-to-llm-inventory.md` 53, plus the DOC-5/6/8/14 lines in the table above. Phase 6
  documents and DOC-12/15/16 have no photo text.

Fix plan (Phase 9 lane owns the code; this lane does not edit Phase 9 files):
1. Phase 9 rewrites SDD 06 and marks P9-D31/P9-D32 superseded by D-25/D-43: the request is keyed
   to the listing, not an order; no hold, accept, decline, or hold-expiry steps; keep the private
   bucket, upload capability, binding trigger, validation, and status read; the store can mark a
   request unfulfilled; a sold listing closes open requests.
2. One forward migration (never edit the applied file) implementing that, plus a job runner that
   actually processes photo validation, and event routing for photo notices. Update the tests that
   assert the old flow (`marketplacePhase9DatabaseFoundation.test.ts`,
   `supabase/tests/phase9/phase9Database.integration.test.mjs`,
   `phase9RequestExpiry.integration.test.mjs`) and the harness/runner migration lists. Rough size:
   about 2 days.
3. Photo screens (Unit 9) are built only on the new design.
4. This lane's slice 1 builds pay-first beside the old Phase 6 decision step and retires that step
   only after step 2 lands. D-43's "waiting for the customer to check photos" order step belongs to
   SDDs 06 (pickup) and 07 (delivery).

## 10. Next authorized action and day-1 steps

**Approvals:** given 2026-11-07 (§3). Recording them in DOC-13 and ACTIVE.md (step 4)
starts the documentation pass and read-only stage 0 work. Product code, migration files,
and dev database changes follow D-33: code per slice once its SDD and test list are
approved, and a standing authorization for test-mode migrations on the dev project for
approved slices; live payments stay gated by BC-43.

Steps, in the order they happen:

1. **Before the fresh folder (D-46), Claude in the docs worktree** (branch
   `docs/phase7-8-planning`, folder `Bookconnect-p78-docs`, never the Phase 9 working folder):
   create `implementation/phase-7-8-payments-fulfillment/` with `README.md`, `TRACKER.md` (with
   a "Migration ledger" section: local filename, live version, project ref verified,
   effects, readback result) and the SDD set (§11); review each SDD per §5; the owner
   approves each SDD and its test list. Documentation and read-only checks only.
2. **Owner:** chooses the route to `origin/main` for the planning files and approved SDDs;
   Claude commits, pushes, or opens a pull request only when the owner asks (AGENTS.md).
3. **Owner, or Claude on request:** create the fresh folder from the latest `origin/main`
   (D-03, D-46), then confirm these exist there: the handoff, decision register, admin
   proposal, question bank, research brief, Phase 6 impact check, and the
   `phase-7-8-payments-fulfillment/` folder with the approved SDDs. If any is missing, stop
   and tell the owner. After the merge, the uncommitted copies of these files in the Phase 9
   working folder are deleted there, or Git will refuse to merge `main` into that branch.
4. **Claude, when the owner says day 1 is today, in the fresh folder:** record the
   approvals (documentation only):
   - DOC-13: Phase 7, 8, and 10 rows get "resumed <date>: documentation pass and stage 0"
     and a link to this handoff, in the notes column only: keep the status value `deferred`
     for Phases 7 and 8 and `not_started` for Phase 10 unless the owner names a new value; in
     the same edit change the Phase 10 row's "Provider adapter for
     Shiprocket/Shipmozo/NimbusPost-style aggregators." to "Pilot: local same-day
     bike-delivery adapter (D-24); courier scope deferred.";
   - Phase 7, 8, and 10 trackers: update the Status line to the same wording as DOC-13 and add
     a dated note that the "Do not begin ... without separate authorization" text is
     satisfied by the §3 approvals as limited by §10; do not change goals or acceptance (the
     documentation pass does that);
   - ACTIVE.md: add a "Phase 7/8 lane" section linking this handoff, the SDD folder, and the
     shared-file rule;
   - AGENTS.md "Current marketplace session entry": keep the Phase 9 line and add a Phase
     7/8 lane line pointing to this handoff; under "Authorization boundaries" add one
     sentence: for this lane, D-33 is the owner's explicit authorization for test-mode
     migrations on the dev project (slice approved, project verified, ledger entry);
     production and live money stay gated by BC-43;
   - add a dated day-1 entry to `phase-7-8-payments-fulfillment/TRACKER.md` (created in
     step 1) and use its Migration ledger for every migration of this lane.
   ACTIVE.md and DOC-13 must agree with each other (AGENTS.md stop rule).
5. **Claude:** finish the remaining stage 0 checks (§8), send drafts of any Cashfree, CA,
   and lawyer messages not yet sent (§6), and start slice 1 under D-33.

## 11. Planned SDD set and what the SDDs must specify

**Planned SDD set (confirm at the skeleton review):** 00 master and state model; 01
reserve-first checkout and Phase 6 reconciliation (P-5 step 1); 02 Cashfree payments,
webhooks, verification, failures; 03 ledger and reconciliation; 04 refunds, returns,
recovery, chargebacks; 05 store entitlement, Easy Split, payouts; 06 pickup (Phase 8); 07
bike delivery (Phase 10 pilot); 08 admin server functions and console; 09 security baseline
and test plan.

**Engineering details the SDDs must specify (no owner decision needed):**

1. "Available" in Q38/D-06 means in stock and not held by another live reservation or an
   earlier paid order; a database constraint proves no double sale.
2. The D-09 refund formula with a worked rupee example (D-39: amount paid minus the quoted forward
   charge and the actual return-trip cost, never below zero; forward excess per D-31/D-41).
3. Duplicate payments and amount mismatches (D-29): the first verified payment counts and
   duplicates are refunded automatically; a payment of the wrong amount is not treated as
   paid and is refunded in full automatically, with an admin alert.
4. A store limit or pause arriving after a reservation: checked at reservation start; a
   customer with a live reservation may finish paying (D-20, D-07). A D-06 re-reservation of a
   paid order proceeds regardless of a later pause or limit, because the customer has already
   paid; the pause or limit only blocks new reservations.
5. D-04 store-fault attribution needs a recorded "alert delivered" fact; until reliable
   alerts exist (D-02), it does not count as a store fault for D-21 or for the D-27 fee
   allocation (BookConnect bears that fee). The refund never waits.
6. Chargebacks: evidence standard for "the store complied", chargeback fee treatment, and
   reversal if fault is reassigned.
7. A `refund_failed` state and admin queue item for refunds to closed accounts; the
   alternative route waits for the Cashfree and lawyer answers.
8. Phase 6 `payment_ready` requests on dev data when pay-first lands: migrate or expire them.
9. Pickup OTP design (Q73); who verifies and who collects per D-44.
10. Entitlement events per path (Q50a, Q50b, BC-37) and both-branch Easy Split timing until
    Cashfree confirms (P-3, register §9).
11. Cashfree fee method, per payment or per-method rate (D-13); fee shown on every
    settlement line.
12. Refunds after the provider window, with double-refund protection (register §9).
13. Quote expiry vs the 10-minute reservation; unavailable-quote fallback (P-6).
14. A returned book that fails inspection (D-10) goes to an admin dispute; return approval
    and automatic release after inspection per D-38; failed-delivery refunds per D-40.
15. Pickup cannot be disabled by a store (D-24): remove the per-store pickup toggle; a paused
    or closed store still shows pickup but takes no new orders (D-07).
16. Payout-account change controls and provider KYC fields (BC-41).
17. Store notification events (reminder, D-04 cancel, photo requests, pause, suspension,
    loss cap) delivered in-app under D-02.
18. Worked rupee examples for every 2026-11-08 decision (D-26 to D-45), per §5 addition 2; D-41's
    ₹80 example.
19. Post-payout store-fault refund debt (D-14, D-27): worked example with a ₹400 book, ₹70
    delivery, 2% fee (₹9.40), ₹60 reverse pickup: the store was paid ₹390.60; the customer
    gets ₹470; BookConnect pays ₹60 for the reverse trip; the store debt is ₹530 (the fee is
    already inside the payout deduction and must not be added twice).
20. "Non-returned fee" (D-27): whole fee or the refunded part only, once Cashfree confirms
    refundability (register §9); until then the ledger records the fee Cashfree reports.
21. A fee or cost with no payout to deduct from becomes a store debt (D-14) and counts
    toward D-08 only when final (D-30). Define the D-14 "repayment request": issued on
    the first payout run where the debt is not fully recovered, or immediately when the store
    has no earned money awaiting payout; the 7 days in D-14, D-21, and D-30 count from that
    date.
22. A voluntary cancellation before collection (Q45) refunds the delivery charge and is
    not customer fault under D-09; the provider fee follows D-31. A voluntary cancellation after
    collection is customer-caused, with the D-39 deduction (Q45b).
23. Whether money held under D-28 counts as "unsettled" for the D-20 ₹25,000 cap
    (recommended: yes).
24. D-34 wording when the store is closed the next day ("expected next opening day").
25. Reliable store-alert channel (D-02) and the interim BC-13 escalation target before the
    admin console exists (for example an owner notice in test mode).
26. D-43 photo check: order state, both 24-hour timers as settings, cancel and refund on silence (D-53),
    refund and fault on rejection, and the D-34 estimate text.
27. D-44 pickup refusal (full refund, store fault) and D-45 store-requested refunds (automatic
    up to ₹1,000, store bears the cost): states, ledger entries, and worked examples.
28. D-42: no off-platform settlement; the store screen offers only "unavailable" (refund),
    never a substitute price.
29. D-47 to D-57 (2026-11-10): fee deductions per settlement line (D-47), standard refunds
    (D-48), printed-books-only listing check (D-49), receipt email (D-50), ticket numbers and
    support email (D-51), pause scope (D-55), ₹5,000 order cap as a setting (D-56), pickup
    reminder (D-57), and `ONHOLD` refunds with the refund balance (D-54).
30. D-58 to D-69 (2026-11-10): missing-book flow with the store's call and in-app outcome
    (D-61), statement CSV (D-60), store pickup text (D-62), per-store payout pause and
    release (D-63), risk alerts as settings (D-64), cap on book total (D-65), held money in
    the unsettled cap (D-66, settles item 23), pickup cancel until ready (D-67), logged
    restart after reconciliation (D-68), unclear-fault chargebacks (D-69).
31. D-70 to D-77 (2026-11-10): store-fault return refund including delivery (D-70), one
    return rebook then drop-off (D-71), 5-day return lapse with day-4 reminder (D-72), pickup
    window on open days with the shown last date (D-73), proof-of-delivery rule in the
    provider check (D-74), pre-payment photo request expiry (D-75), drop-out metric (D-76),
    next-day rebook when no rider accepts (D-77).
