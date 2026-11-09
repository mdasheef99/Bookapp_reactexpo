# Phase 7/8: Decision Coverage

**Date:** 2026-11-10
**Status:** review record. It adds no decision. The
[decision register](./PHASE-7-8-decision-register.md) stays the authority; where this file and
the register differ, the register wins.
**Purpose:** list every planning question with the sections that relate to it, its current
answer and its status, so it is clear what is decided, what waits on Cashfree, the CA or the
lawyer, what the SDDs settle, and what the owner still has to decide.

## 1. How this was checked

- **Questions covered:** all 162 question-bank items (the §0.2 list and the §3 Q1–Q132 and
  E1–E30 rows), §0.3 and §0.4, handoff §11 items 1–29, and the register's open and
  in-principle rows.
- **Reviewers.** Three reviewers each took one part, from a read-only snapshot of the docs.
  The docs were hashed before and after; they were unchanged.
  - Money: Muse.
  - Operations: DeepSeek v4.1 flash.
  - Tax, legal, engineering and launch: GLM.
- **Second pass.** Sonnet reviewed the whole scope separately (§7).
- **Claude's check.** Claude checked the PENDING-OWNER rows, the contradictions and the
  missing questions against the files with grep. Rows that Claude changed are marked ✱.
- **Duplicate rows.** Some questions appear twice because the question bank asks them twice
  (for example §0.2 #14 and Q27 are both about books only). Each copy keeps its own row.

**Status values:**
- **DECIDED:** the register answers it fully.
- **DECIDED-PARTLY:** the row says which part is missing.
- **OUTSIDE:** waits on Cashfree, the CA, the lawyer or the delivery provider, with the
  question number.
- **SDD:** an engineering detail the SDDs settle.
- **AFTER-PILOT:** explicitly deferred until after the pilot.
- **PENDING-OWNER:** no decision anywhere.

**Totals (204 rows, with duplicates):**

| Status | Rows |
|---|---|
| DECIDED | 89 |
| DECIDED-PARTLY | 37 |
| OUTSIDE | 35 |
| SDD | 21 |
| AFTER-PILOT | 13 |
| PENDING-OWNER | 9 (§3 lists 16 after all checks) |

## 2. Result in one paragraph

Every question has an owner: a decision, an outside question, an SDD, or a deliberate
deferral. Nothing that blocks writing the SDDs or starting the build is undecided.

What is left is in three groups:
- Small owner confirmations (§3), now decided except four that wait on outside answers.
- Outside answers that the build is already designed around (§5). Settlement is built last,
  behind the Cashfree answers.
- Text fixes in older documents (§4).

## 3. What the owner still has to decide (checked)

**Decided on 2026-11-10 (register D-58 to D-69):**
- O-1 packaging → D-58;
- O-2 store without verification → D-59;
- O-3 statement CSV → D-60;
- O-4 readiness and missing books → D-61;
- O-5 pickup instructions → D-62;
- O-6 payout pause → D-63;
- O-7 risk alerts → D-64;
- O-12 cap base → D-65;
- O-13 held money in the cap → D-66;
- O-14 pickup cancel cutoff → D-67;
- O-15 restart after a pause → D-68;
- O-16 unclear-fault chargebacks → D-69.

**Still open; each waits on an outside answer:**

| # | Question | Waits on |
|---|---|---|
| O-8 | Fallback if Cashfree cannot hold store money until release (QB §0.2 #4) | Cashfree Q1–Q2 |
| O-9 | Delivery GST: customer pays quote plus GST, or BookConnect absorbs | CA Q2 |
| O-10 | Refund balance amount (D-54) | Cashfree Q8 |
| O-11 | Web checkout or the native Cashfree SDK (QB Q35) | Cashfree Q17 |

**Before live (already in register §10 or the live gate):**
- the pilot stores and dates (Q29, Q130);
- support staffing beyond the owner (Q101);
- offline stock sync;
- when the production Supabase project is created and migrated (Q119);
- who runs the small real-money test and for how much (Q131);
- the rollback plan beyond the pause (Q132, E30, SDD 09).

**Process (owner's call; no effect on the product):**
- whether the owner reviews money-critical PRs (Q125);
- whether the SDD-0 process rules move into a shared process document (Q123, Q126).

## 4. Corrections needed in existing documents (checked)

Applied 2026-11-10: C-1 to C-6 and C-8 to C-11. C-7 stays scheduled in handoff §9. C-12 needed
no change: the handoff's schedule rules (D-46) right below the timeline already explain it.

| # | Where | Problem | Fix |
|---|---|---|---|
| C-1 | Register D-49 | Says "CA question 4 confirms"; the exemption itself is CA question 1 | "CA questions 1 and 4 confirm" |
| C-2 | Admin console proposal, lines 94–96 | "return, dispute, and goodwill refunds above ₹1,000 require admin approval"; D-38 says every return and dispute needs approval at any amount (the proposal's module 4 already says so) | Limit the ₹1,000 typed-reason rule to goodwill refunds |
| C-3 | Handoff §5, line 156 | Recommends `deepseek-v4-pro` for money-critical SDDs; the owner's rule is DeepSeek v4.1 flash | Replace with v4.1 flash |
| C-4 | Register status line (line 5) | Mentions PROPOSED rows; none exist now | "No row is PROPOSED at present" |
| C-5 | CA question 1 | Cites Notification 9/2025; the exemption is in 10/2025 | Correct the citation (part of the pending research update) |
| C-6 | Question bank lines 34, 42, 274, 508 and "Still open" (524–535); §0.3 courier bullet | Older text: courier aggregator and ₹80 charge, 48-hour "eligibility", "design for 120 days", "orders must finish within 45 days", Q99–Q100 sent to the CA, and setup items listed as owner-only | Add one banner: the question bank is historical; the register and the three question documents win. Do not rewrite the rows |
| C-8 | Register D-29 (line 218) | Says the ₹1,000 manual-approval rule applies to "returns, disputes, and goodwill refunds"; D-38 makes every return and dispute need approval at any amount | Add "(returns and disputes: see D-38)" so only goodwill keeps the ₹1,000 rule |
| C-9 | Register Q57 (line 140) and handoff §7 (line 314) | "Approval rules per D-22" / "as clarified by D-29" leave out D-38, D-40 and D-45 | Point to D-22, D-29, D-38, D-40 and D-45 |
| C-10 | Register §10 sweep note (lines 289–292, written 2026-11-10) | Says no other owner decision is open; this review found the §3 items open | Replace with a pointer to this document's §3 |
| C-11 | Phase 6 impact check, lines 73 and 139 | Still say the emergency pause needs an owner decision; D-55 settles it | Mark as settled by D-55 |
| C-12 | Handoff §4 timeline, lines 91–92 | Lists SDDs written in weeks 1–2; D-46 moves SDD writing before day 1 (reported by Sonnet; Claude did not check lines 102–104) | Align with D-46 |
| C-7 | Research brief (45-day / six-month lines) and the Phase 7 tracker ("only after store confirmation") | Withdrawn or replaced by register §9, §12 and BC-08 | Already scheduled in handoff §9 |

## 5. Decided, but the rule depends on an outside answer

| Decision | Waits on |
|---|---|
| D-28, Q51, P-3, Q50a/Q50b: hold 3 days after handover, Monday payout | Cashfree Q1–Q3 |
| D-14, D-54: BookConnect refunds first and recovers from the store | Cashfree Q7–Q8; lawyer Q2–Q3 (repayment clause) |
| D-13, D-47: the store pays the Cashfree fees | Cashfree Q13–Q14 (rates, per-transaction reporting) |
| D-27: fee on refunded payments by cause | Cashfree Q11 (whole fee or only the refunded part) |
| Q68: chargebacks by fault | Cashfree Q12; lawyer Q2–Q3 |
| Q45b, D-09, D-39: delivery deductions on customer-caused failure | Lawyer Q4 |
| D-45, BC-38, Q62: store bears costs it causes | Lawyer Q2, Q13 |
| D-49: printed books only, so the pilot is GST-exempt | CA Q1, Q4 |
| D-50: receipt (who issues it) | CA Q7 |
| D-52: the owner as grievance officer | Lawyer Q6 |
| BC-28, Q3: BookConnect contracts delivery; no pooled customer money | Cashfree Q4; CA Q2; lawyer Q1, Q3, Q7 |
| D-24, BC-22: bike delivery priced from the provider's live quote | Delivery provider API check (handoff §6.4); no question document exists for the provider yet |
| Handoff §7 hosted checkout (SAQ A) | Cashfree Q17 |
| D-01: 4-week milestone | Easy Split enabled in the test account (Support Form sent by the owner) |

## 6. Missing questions found by the reviewers (checked; proposed, not decided)

**Owner decisions to add (small, product behaviour):**
- M-1. **Delivery charge on a store-fault return of a delivered book.** D-26 covers only "nothing
  was delivered". Is the forward delivery charge refunded?
- M-2. **Failed reverse pickup.** The customer is not available when the rider comes for a
  return. D-32 books the pickup, but D-09 covers only forward delivery.
- M-3. **Approved return never sent back.** D-10 waits for inspection with no timeout.
- M-4. **Store closed for part of the 3-day pickup window.** D-07 covers ordering while
  closed, not collection. Does the window pause?
- M-5. **Proof of delivery.** Q50b says "evidenced handover" but nothing defines the
  evidence: a photo, an OTP or a provider event.
- M-6. **Photo request before payment.** D-43 and D-53 set the 24-hour limits only after
  payment.
- M-16. **No rider available after payment.** Nothing says what happens when no rider
  accepts at "Ready to ship": wait, offer pickup, or refund.
- M-7. **Measuring abandonment at the delivery price.** D-24 and D-36 rely on this data,
  but nothing defines the measure or the threshold.

**Questions to add to the outside documents:**
- M-8. **Cashfree.** What happens if a store's vendor account is suspended or frozen during
  the pilot? This fits under Q5/Q5a.
- M-9. **Cashfree.** How is the payment charges webhook enabled for our account? This
  extends Q14, which D-13 relies on.
- M-10. **CA.** Is the 0.1% TDS taken at the split or at payout, and does its base include
  delivery? This extends CA Q6.
- M-17. **Lawyer.** How do ledger immutability, evidence photos and finance records sit
  with DPDP deletion requests and retention periods? This extends lawyer Q5.
- M-11. **Delivery provider.** It has no question document. The handoff §6.4 checklist is
  the only list, and it does not clearly ask about reverse pickup from the customer (D-32). A
  short document should be written in week 1.

**SDD detail (record in handoff §11 when the SDD skeletons are written):**
- M-12. Production key custody and rotation of the API secret (SDD 09).
- M-13. Rollback drill for live payments (SDD 09).
- M-14. Which lane owns a migration that touches Phase 6/9 tables if a collision appears.
- M-18. Payment retry cap per order (Q37), fee rounding to paise, and D-28 day rules around
  Sundays and bank holidays.
- M-19. How store acceptance of the agreement and of D-23 price changes is recorded and
  versioned.
- M-15. Items the reviewers found "not listed" in handoff §11:
  - the pending-payment display (Q39);
  - the notification event list (Q42);
  - ledger account balances and pending vs posted entries (E15–E17);
  - intent records, idempotency keys and locks (E22–E24);
  - primary-database reads (E26);
  - the migration number range (Q109);
  - the customer pickup screen (Q78);
  - the "packed" state for pickup (Q77).

## 7. Sonnet second pass

Sonnet reviewed the whole scope on its own (280 rows, including the handoff §11 and
register rows). Its approximate totals: 85 DECIDED, 41 DECIDED-PARTLY, 66 OUTSIDE, 69 SDD,
12 AFTER-PILOT, 7 PENDING-OWNER. These are higher than §1 because it counted the register
and handoff rows as separate questions.

- **Agreement.** It agreed with the three part-reviews on every DECIDED row checked.
- **Rows it added to §3:** O-11, O-12, O-13, O-14, O-15 and O-16.
- **Rows it added to §4:** C-8, C-9, C-10, C-11 and C-12.
- **Rows it added to §6:** M-16, M-17, M-18 and M-19, plus the reverse-pickup point in M-11.
- **Claude's check.** Claude checked C-8 to C-11 and the O-rows against the files. All were
  correct.
- **Different status, same answer.** Where Sonnet and a part-reviewer gave different
  statuses (for example Q48 and E13 as "SDD - not listed" rather than PENDING-OWNER), the
  facts were the same. This document uses the owner-decision status because the answer
  changes customer- or store-facing behaviour.

## 8. Full tables

The tables show the state before D-58 to D-69 were recorded; §3 maps the changes.

Columns as in §1.
- **Evidence** is `file:line`.
- **REG/QB/HO/RB/CF/CA/LW/ADMIN/IC** are, in order: the register, question bank, handoff,
  research brief, Cashfree questions, CA questions, lawyer questions, admin console proposal
  and Phase 6 impact check.
- Line numbers are from the 2026-11-10 snapshot.

### A. Money: QB §0.2, §3 A, C, G (reviewer: Muse)

| ID | Question | Related sections | Answer (decision IDs) | Status | Evidence |
|---|---|---|---|---|---|
| P0.2-1 | Pay-first eligibility; offline counter sales | QB §0.2#1; REG D-15, BC-09 | D-15: every in-stock listing payable now; stores mark counter sales sold promptly (BC-09). | DECIDED | PHASE-7-8-decision-register.md:204 |
| P0.2-2 | Who pays Cashfree charges in intro period | QB §0.2#2; REG D-13, D-47, Q20 | Store pays payment, split, payout, verification fees even in pilot (D-13, D-47; Q20). | DECIDED | PHASE-7-8-decision-register.md:202 |
| P0.2-3 | Shipping money: supplier, receiver, invoicer | QB §0.2#3; REG BC-28, §10; CA Q2; LW Q1,Q7 | BC-28 intends BookConnect contracts provider but money ownership/invoicing/GST need CA/lawyer (REG §10). | OUTSIDE | PHASE-7-8-questions-ca.md:43 |
| P0.2-4 | Fallback if Cashfree cannot hold to Monday/pickup | QB §0.2#4; REG P-3, D-28, §9; CF Q1,Q2 | No fallback recorded; hold-and-release capability awaits Cashfree Q1–Q2; owner picks a fallback only if Cashfree says no (P-3, D-28) | OUTSIDE (Cashfree Q1–Q2), then owner ✱ | PHASE-7-8-decision-register.md:185 |
| P0.2-5 | Store cannot/will not repay, no future sales | QB §0.2#5; REG D-14, D-08, D-30; LW Q3 | D-14 advance+recover+7-day repay, unrecovered counts to D-08/D-30; exit-recovery needs lawyer Q3. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:203 |
| P0.2-6 | Courier loss above compensation cap | QB §0.2#6; REG BC-35, D-09, D-31, D-41 | Pilot bike: provider fault BookConnect claims+absorbs (D-09/BC-35, ≤₹50 D-31/D-41); courier-cap case deferred with courier option. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:142 |
| P0.2-7 | Chargebacks by fault (fraud, platform, unclear) | QB §0.2#7; REG Q68, D-08; CF Q12 | Q68: store-caused recovered like Q67, compliant-store fraud borne by BookConnect (D-08); platform-error/unclear + fee/MoR await Cashfree Q12. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:156 |
| P0.2-8 | Max shipping difference absorbed | QB §0.2#8; REG D-31, D-41, D-08 | Bike: BookConnect absorbs first ₹50, above by cause (D-31/D-41), counted to D-08. | DECIDED | PHASE-7-8-decision-register.md:220 |
| P0.2-9 | Forward/return/extra costs by cause | QB §0.2#9; REG D-09, D-39, Q45b, BC-34 | D-09 allocates by cause with D-39 customer formula; wording needs lawyer. | DECIDED | PHASE-7-8-decision-register.md:198 |
| P0.2-10 | Payment methods at launch | QB §0.2#10; REG Q34, D-05 | UPI and cards only, no COD (D-05). | DECIDED | PHASE-7-8-decision-register.md:194 |
| P0.2-11 | Ordering while closed/paused/stale stock | QB §0.2#11; REG D-07, D-04, BC-41 | May order while closed (acts on open, D-04 applies); paused stores get none (D-07, BC-41). | DECIDED | PHASE-7-8-decision-register.md:196 |
| P0.2-12 | Missed-ack deadline and action | QB §0.2#12; REG D-04, BC-12/13 | 24 elapsed hours then auto-cancel + full refund (D-04); 30/45-min opening-hour reminders stand. | DECIDED | PHASE-7-8-decision-register.md:193 |
| P0.2-13 | Late payment, stock still available | QB §0.2#13; REG Q38, D-06 | Re-reserve and continue as normal paid order (D-06). | DECIDED | PHASE-7-8-decision-register.md:195 |
| P0.2-14 | Books only or stationery too | QB §0.2#14; REG D-49, Q30 | Only new/used printed books (HSN 4901), no stationery (D-49). | DECIDED | PHASE-7-8-decision-register.md:238 |
| P0.2-15 | Min/max order value and limits | QB §0.2#15; REG D-56, D-36, D-20 | Max ₹5,000/order setting, no minimums (D-56/D-36); store caps per D-20. | DECIDED | PHASE-7-8-decision-register.md:245 |
| P0.2-16 | When delivery is booked | QB §0.2#16; REG D-17, BC-30 | Booked at packed/“Ready to ship”, not acknowledgement (D-17). | DECIDED | PHASE-7-8-decision-register.md:206 |
| P0.2-17 | Who pays packaging (normal/unusual) | QB §0.2#17; REG BC-29, D-16, D-31 | Stores pack (BC-29); who pays ordinary packaging is not written (assumed the store); D-16 excess rule is courier-only, unused in the pilot | PENDING-OWNER (confirm) ✱ | PHASE-7-8-decision-register.md:205 |
| P0.2-18 | Courier misses/cancels collection | QB §0.2#18; REG D-09, D-31; HO §11 (not listed) | Cost by cause (D-09/D-31); rebooking/handling steps are delivery-SDD detail, not listed in HO §11. | SDD | PHASE-7-8-HANDOFF.md:541 |
| P0.2-19 | Handover/delivery evidence | QB §0.2#19; REG BC-27; HO §6.4 | Store photographs sealed parcel (BC-27); provider proof awaits delivery-provider API check. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:119 |
| P0.2-20 | Authorized staff; alternate collector | QB §0.2#20; REG D-44 | Staff may verify OTP; anyone with valid OTP may collect (D-44). | DECIDED | PHASE-7-8-decision-register.md:233 |
| P0.2-21 | Book missing/damaged at pickup | QB §0.2#21; REG D-44, Q65 | Customer may refuse; full refund, store fault if mismatched (D-44). | DECIDED | PHASE-7-8-decision-register.md:233 |
| P0.2-22 | Delivery localities/pincodes | QB §0.2#22; REG D-18, Q28 | Bengaluru urban BBMP pincodes provider serves, as a widenable setting (D-18). | DECIDED | PHASE-7-8-decision-register.md:207 |
| P0.2-23 | Refund at collection vs after inspection | QB §0.2#23; REG D-10, D-38 | Approved returns refunded only after store inspection passes (D-10/D-38). | DECIDED | PHASE-7-8-decision-register.md:199 |
| P0.2-24 | How return disputes are decided | QB §0.2#24; REG D-38, D-37, Q57 | Every return/dispute needs admin approval; failed inspection becomes dispute (D-38); stores reply in 24 biz hrs (D-37). | DECIDED | PHASE-7-8-decision-register.md:227 |
| P0.2-25 | Shipping deduction, voluntary cancel after collection | QB §0.2#25; REG Q45b, D-09, D-39; LW Q4 | Q45b is IN PRINCIPLE subject to law with D-39 formula; enforceability awaits lawyer Q4. | OUTSIDE | PHASE-7-8-questions-lawyer.md:58 |
| P0.2-26 | Shipping refund on partial refunds | QB §0.2#26; REG D-26 | Nothing-delivered non-customer-fault includes delivery charge; one-of-several keeps delivery charge (D-26). | DECIDED | PHASE-7-8-decision-register.md:215 |
| P0.2-27 | Automatic vs manual refunds | QB §0.2#27; REG D-22, D-29, D-38, D-40 | Auto categories run any amount (D-22/D-29/D-40); returns/disputes/goodwill need admin (D-38/D-29). | DECIDED | PHASE-7-8-decision-register.md:211 |
| P0.2-28 | Instant refunds and who pays extra | QB §0.2#28; REG D-48, D-27 | Standard speed only, 2–3 days, no instant pilot (D-48); fee by cause (D-27). | DECIDED | PHASE-7-8-decision-register.md:237 |
| P0.2-29 | Pilot start date and five stores | QB §0.2#29; REG Q19, §10 | Three-month duration decided (Q19); dates and store names open (REG §10). | DECIDED-PARTLY | PHASE-7-8-decision-register.md:60 |
| P0.2-30 | After waiver: notice/consent | QB §0.2#30; REG D-23, BC-02 | 30 days’ written notice + in-app acceptance to keep paid orders (D-23). | DECIDED | PHASE-7-8-decision-register.md:212 |
| P0.2-31 | Founding-store special terms | QB §0.2#31; REG Q20, D-23 | Intro 0%/₹0 three months, no auto conversion (Q20); post-pilot rates open under D-23. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:61 |
| P0.2-32 | Who handles complaints/disputes | QB §0.2#32; REG Q101, D-19, D-51 | Centrally coordinated (Q101), 10–7 Mon–Sat (D-19), in-app+email (D-51); staffing beyond owner open. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:169 |
| P0.2-33 | Penalties; suspending payments/payouts | QB §0.2#33; REG D-21, D-20 | 3 faults/30d pauses new orders; fraud/unpaid debt immediate (D-21); starter caps D-20. | DECIDED | PHASE-7-8-decision-register.md:210 |
| P0.2-34 | Exposure limits | QB §0.2#34; REG D-08, D-30, D-20 | ₹10k/month absorbed-loss cap (D-08/D-30) plus per-store D-20 caps. | DECIDED | PHASE-7-8-decision-register.md:197 |
| P0.2-35 | Pause/approve/restart authority | QB §0.2#35; REG D-55, D-08 | Pause blocks only new payments, paid orders continue (D-55); cap-hit pauses for owner review (D-08); roles/restart in admin SDD. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:244 |
| A-Q1 | App-collected vs counter payment | QB §A Q1; REG Q1 | Customers pay via BookConnect Cashfree checkout, not counter (Q1). | DECIDED | PHASE-7-8-decision-register.md:52 |
| A-Q2 | Legal seller: store or BookConnect | QB §A Q2; REG Q2; LW Q1; CA Q11 | Store intended seller of record, needs legal/accounting confirmation (Q2 IN PRINCIPLE). | OUTSIDE | PHASE-7-8-questions-lawyer.md:32 |
| A-Q3 | Hold customer money or via Cashfree only | QB §A Q3; REG Q3; CF Q4; LW Q3 | No unlicensed pooling; Cashfree model must support it (Q3 IN PRINCIPLE; CF Q4, LW Q3). | OUTSIDE | PHASE-7-8-questions-cashfree.md:41 |
| A-Q4 | Which payment provider | QB §A Q4; REG Q4 | Cashfree (Q4; capabilities verified separately). | DECIDED | PHASE-7-8-decision-register.md:55 |
| A-Q5 | Split from provider vs BookConnect payout | QB §A Q5; REG P-3; CF Q1–Q3 | Intends Easy Split provider-managed settlement, pending Cashfree written confirmation (P-3 IN PRINCIPLE). | OUTSIDE | PHASE-7-8-questions-cashfree.md:29 |
| A-Q6 | Revenue mix | QB §A Q6; REG Q6 | Future: store commission + subscription; pilot customer fee not approved (Q6). | DECIDED | PHASE-7-8-decision-register.md:56 |
| A-Q7 | Pilot commission rate | QB §A Q7; REG Q7 | 0% for first five stores in intro period (Q7). | DECIDED | PHASE-7-8-decision-register.md:57 |
| A-Q8 | Post-pilot commission rate | QB §A Q8; REG §10 | Explicitly deferred until after pilot (REG §10). | AFTER-PILOT | PHASE-7-8-decision-register.md:289 |
| A-Q9 | Commission base (price only or +charges) | QB §A Q9; REG §10 | Deferred with post-pilot pricing (Q8–Q12). | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-Q10 | Commission incl. or excl. GST | QB §A Q10; REG §10; CA Q5 | Deferred with post-pilot pricing; GST rate itself with CA Q5. | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-Q11 | Commission cap/minimum | QB §A Q11; REG §10 | Deferred with post-pilot pricing (Q8–Q12). | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-Q12 | Rate differ by store/category/source | QB §A Q12; REG §10, P-4 | Deferred; attribution P-4 open until after pilot. | AFTER-PILOT | PHASE-7-8-decision-register.md:186 |
| A-Q13 | Store subscription amount/start | QB §A Q13; REG Q13, D-23 | ₹0 intro (Q13); later rates/notice under D-23, not approved. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:58 |
| A-Q14 | Subscription billed via Cashfree or separate | QB §A Q14; REG §10 | Deferred until after pilot (Q14). | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-Q15 | Customer-side fee | QB §A Q15; REG Q15, D-11 | ₹0 pilot; delivery paid (Q15/D-11). | DECIDED | PHASE-7-8-decision-register.md:200 |
| A-Q16 | Who pays payment fees | QB §A Q16; REG Q16, D-13 | Store pays, disclosed per settlement line (D-13). | DECIDED | PHASE-7-8-decision-register.md:202 |
| A-Q17 | Who pays split fee | QB §A Q17; REG D-47 | Store pays Easy Split fee on settlement lines (D-47). | DECIDED | PHASE-7-8-decision-register.md:236 |
| A-Q18 | Who pays payout/verification fees | QB §A Q18; REG D-47 | Store pays payout + bank-verification fees (D-47). | DECIDED | PHASE-7-8-decision-register.md:236 |
| A-Q19 | Pilot timing | QB §A Q19; REG Q19, §10 | Three months decided; calendar dates not set (§10). | DECIDED-PARTLY | PHASE-7-8-decision-register.md:60 |
| A-Q20 | Store terms promise | QB §A Q20; REG Q20, D-23 | “Free” = 0%/₹0 three months, no auto conversion; gateway fee separate (Q20/D-23). | DECIDED | PHASE-7-8-decision-register.md:61 |
| A-Q21 | Founding-store terms after pilot | QB §A Q21; REG §10 | Deferred until after pilot (Q21–Q25). | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-Q22 | Record who brought customer | QB §A Q22; REG P-4 | Optional analytics only, open until after pilot (P-4). | AFTER-PILOT | PHASE-7-8-decision-register.md:186 |
| A-Q23 | Define “brought by BookConnect” | QB §A Q23; REG P-4 | No ownership/commission definition; P-4 open until after pilot. | AFTER-PILOT | PHASE-7-8-decision-register.md:186 |
| A-Q24 | Shadow invoices in pilot | QB §A Q24; REG §10 | Deferred with post-pilot pricing inputs (Q21–Q25). | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-Q25 | Post-pilot pricing inputs/date | QB §A Q25; REG §10, D-23 | Deferred; rates decided before waiver ends with D-23 notice. | AFTER-PILOT | PHASE-7-8-decision-register.md:292 |
| A-E1 | Loss exceeding store hold: who bears | QB §A E1; REG Q68, D-14, D-08 | BookConnect advances (D-14), bears compliant-fraud/unrecovered counted to D-08 (Q68/D-30). | DECIDED | PHASE-7-8-decision-register.md:156 |
| A-E2 | Refund reserve/float at Cashfree | QB §A E2; REG D-54; CF Q8 | In-principle refund balance (D-54); amount after Cashfree Q8. | OUTSIDE | PHASE-7-8-questions-cashfree.md:64 |
| A-E3 | Merchant of record for chargebacks | QB §A E3; REG §9; CF Q12 | Unverified; Cashfree Q12 asks debit/recovery/MoR/fee. | OUTSIDE | PHASE-7-8-questions-cashfree.md:78 |
| C-Q34 | Payment methods | QB §C Q34; REG Q34, D-05 | UPI and cards only (D-05). | DECIDED | PHASE-7-8-decision-register.md:194 |
| C-Q35 | Web checkout vs native SDK | QB §C Q35; HO §7; CF Q17 | Hosted-checkout baseline (HO §7) but web-vs-SDK awaits Cashfree Q17. | OUTSIDE | PHASE-7-8-questions-cashfree.md:101 |
| C-Q36 | Payment window | QB §C Q36; REG Q36, BC-08 | No pre-pay confirmation (BC-08); 10-minute reservation (Q36). | DECIDED | PHASE-7-8-decision-register.md:88 |
| C-Q37 | Failed-payment retry | QB §C Q37; REG Q37, BC-15 | Retry while reservation valid, no double charge/fulfilment (Q37/BC-15). | DECIDED | PHASE-7-8-decision-register.md:89 |
| C-Q38 | Pay after window closes | QB §C Q38; REG Q38, D-06, BC-10 | Unavailable → auto full refund; available → re-reserve (Q38/D-06/BC-10). | DECIDED | PHASE-7-8-decision-register.md:90 |
| C-Q39 | Pending-payment display | QB §C Q39; HO §11 (not listed) | No owner rule; payments-SDD detail, not listed in HO §11. | SDD | PHASE-7-8-HANDOFF.md:541 |
| C-Q40 | Receipt content and issuer | QB §C Q40; REG D-50; CA Q7 | Display decided (app + email if given, D-50); issuer follows CA Q7. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:239 |
| C-Q41 | Receipt channel: app/email/SMS | QB §C Q41; REG D-50 | App always, email if given, no SMS (D-50). | DECIDED | PHASE-7-8-decision-register.md:239 |
| C-Q42 | Customer notification set | QB §C Q42; REG D-02; HO §11 (not listed) | Channel in-app only (D-02); full event list is SDD detail, not listed in HO §11. | SDD | PHASE-7-8-decision-register.md:191 |
| C-Q43 | Phone required | QB §C Q43; REG D-50 | Phone required, Cashfree mandates it (D-50). | DECIDED | PHASE-7-8-decision-register.md:239 |
| C-Q44 | Email required | QB §C Q44; REG D-50 | Email optional (D-50). | DECIDED | PHASE-7-8-decision-register.md:239 |
| C-Q45 | Cancel-after-pay window | QB §C Q45; REG Q45, Q45b, D-39 | Before collection full refund (Q45); after collection Q45b IN PRINCIPLE per D-39, awaits lawyer Q4. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:135 |
| G-Q80 | Hold length; is 45 days enough | QB §G Q80; REG D-28, P-3, §9; CF Q1 | D-28: 3 days after handover then Monday payout; 45-day cap unverified, awaits Cashfree Q1. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:217 |
| G-Q81 | Orders unfinished within 45 days | QB §G Q81; REG §9; CF Q1,Q2,Q9 | No rule; hold behaviour + post-window route await Cashfree Q1/Q2/Q9 (lawyer Q9). | OUTSIDE | PHASE-7-8-questions-cashfree.md:68 |
| G-Q82 | Float for chargebacks/refund fees | QB §G Q82; REG D-54; CF Q8 | In-principle refund balance (D-54); funding/topup awaits Cashfree Q8. | OUTSIDE | PHASE-7-8-questions-cashfree.md:64 |
| G-Q83 | Negative balances handling | QB §G Q83; REG Q67, D-14 | Advance, record debt, recover next payout else 7-day repay (D-14). | DECIDED | PHASE-7-8-decision-register.md:203 |
| G-Q84 | Auto vs manual settlement match | QB §G Q84; REG Q84; HO §7 | Reconcile ledger to Cashfree facts (Q84); daily payment/refund + weekly settlement per HO §7. | DECIDED | PHASE-7-8-HANDOFF.md:344 |
| G-Q85 | Accounting exports for CA | QB §G Q85; CA Q10 | No owner rule; awaits CA Q10 (accounts/exports/cadence). | OUTSIDE | PHASE-7-8-questions-ca.md:95 |
| G-Q86 | Ledger accounts needed | QB §G Q86; REG Q86; CA Q10 | Principle decided (balanced, append-only, reversals — Q86); classes await CA Q10. | DECIDED-PARTLY | PHASE-7-8-decision-register.md:159 |
| G-E15 | Account normal balances/owners | QB §G E15; HO §11 (not listed) | No owner rule; ledger-SDD detail, not listed in HO §11. | SDD | PHASE-7-8-HANDOFF.md:534 |
| G-E16 | Pending vs posted entries | QB §G E16; HO §11 (not listed) | No owner rule; ledger-SDD detail, not listed in HO §11. | SDD | PHASE-7-8-HANDOFF.md:534 |
| G-E17 | Reject sourceless/destless money moves | QB §G E17; HO §7 | Baseline requires balanced append-only ledger (HO §7); DB constraint is SDD detail, not listed in HO §11. | SDD | PHASE-7-8-HANDOFF.md:295 |
| G-E18 | Reconciliation cadence/reviewer | QB §G E18; HO §7 | Daily payment/refund + weekly settlement with sign-off (HO §7); named reviewer in settlement SDD. | DECIDED-PARTLY | PHASE-7-8-HANDOFF.md:344 |

### B. Operations: QB §3 B, D, E, F, I (reviewer: DeepSeek v4.1 flash)

| ID | Question | Related sections | Answer (decision IDs) | Status | Evidence |
|---|---|---|---|---|---|
| Q26 | Pickup only, or delivery as well | QB §3 B Q26; REG Q26, D-24, BC-16/17 | Pickup plus same-day Bengaluru bike delivery at launch; standard courier and intercity deferred | DECIDED | REG:62, REG:213, REG:108-109 |
| Q27 | Books only, or stationery too | QB §3 B Q27; REG D-49, Q30 | Only new and used printed books (HSN 4901); no stationery or other items | DECIDED | REG:238 |
| Q28 | Bengaluru only, which localities | QB §3 B Q28; REG Q28, D-18 | Bengaluru only; delivery to provider-served BBMP pincodes, elsewhere pickup only; list is a setting | DECIDED | REG:63, REG:207 |
| Q29 | How many stores, and which | QB §3 B Q29; REG Q29, §10 | Five stores at start, ten considered later; the actual five stores are not named | DECIDED-PARTLY - missing: which five stores | REG:64, REG:277 |
| Q30 | Used, new, or both | QB §3 B Q30; REG Q30, D-49 | New and used books | DECIDED | REG:65, REG:238 |
| Q31 | Min/max order value | QB §3 B Q31; REG D-56, D-36, D-11 | No minimum (D-36); maximum ₹5,000 per order as a setting (D-56) | DECIDED | REG:245, REG:225 |
| Q32 | Limits per customer or per store | QB §3 B Q32; REG D-56, D-20 | No per-customer limit (setting off); per store 20 paid orders/day and ₹25,000 unsettled (D-20) | DECIDED | REG:245, REG:209 |
| Q33 | Pay for several stores at once | QB §3 B Q33; REG Q33 | One store per cart and payment | DECIDED | REG:66 |
| Q46 | What a store must complete before paid orders | QB §3 D Q46; REG BC-41, D-13, D-47, D-49 | Opening hours plus the three permissions decided; the exact Cashfree vendor KYC document list is still unverified (Cashfree Q5) | DECIDED-PARTLY - missing: vendor KYC document list | REG:163, CASHFREE:47-50 |
| Q47 | Who registers the store with Cashfree | QB §3 D Q47; REG BC-41; Cashfree Q5 | No REG decision; research says the platform adds vendors by dashboard or API, and the API route awaits Cashfree | OUTSIDE - Cashfree Q5 | QB:495, CASHFREE:47 |
| Q48 | Store never completes Cashfree verification | QB §3 D Q48; REG BC-41 | No rule; BC-41 implies the store simply never gets the accept-online-payment permission | PENDING-OWNER (confirm) ✱ | REG:163, REG:273-287 |
| Q49 | What a store sees when an order is paid | QB §3 D Q49; REG Q49; HO §11 #17 | Paid-order inbox with acknowledge, prepare and ready states, notified in-app | SDD - HO §11 item 17 | REG:93, HO:574 |
| Q50 | When the store gets its money | QB §3 D Q50; REG Q50a, Q50b, D-28, BC-37 | Pickup: on verified OTP handover (Q50a); delivery: on evidenced handover (Q50b, in principle); cash waits 3 days then the next Monday (D-28) | DECIDED-PARTLY - missing: delivery evidence standard and Cashfree hold | REG:150-153, REG:217 |
| Q51 | How often stores are paid | QB §3 D Q51; REG Q51, P-3; Cashfree Q3 | Weekly Monday payouts intended, subject to Cashfree capability and contract | DECIDED-PARTLY - missing: Cashfree confirmation of weekly Monday vendor payouts | REG:152, CASHFREE:38-40 |
| Q52 | What a statement shows, how often | QB §3 D Q52; REG D-13, D-47; HO §11 #11 | Fees must appear on every settlement line; statement content and period are left to the settlement SDD | DECIDED-PARTLY - missing: statement layout and frequency | REG:202, REG:236, HO:565 |
| Q53 | Can stores download statements or invoices | QB §3 D Q53 | Not addressed anywhere in these files | PENDING-OWNER | REG:202-247, HO:541-606 |
| Q54 | Wrong bank details, payout fails | QB §3 D Q54; REG BC-41; HO §11 #16 | Payout-account change controls, re-verification and a payout-failure queue are SDD detail | SDD - HO §11 item 16 | HO:573, ADMIN:76 |
| Q55 | Can a store cancel a paid order | QB §3 D Q55; REG D-45, D-15, D-21, D-22 | Store cannot cancel directly: it raises a refund request (D-45), bears the cost, and faults count (D-21); an unavailable book is a full refund (D-15) | DECIDED | REG:234, REG:204, REG:210 |
| Q56 | Store repeatedly cannot fulfil | QB §3 D Q56; REG D-21, D-20 | 3 store faults in 30 days pause new paid orders until admin review; fraud or unpaid debt pauses at once | DECIDED | REG:210 |
| E4 | Are new stores' payouts held longer | QB §3 E4; REG D-28, D-20, Q50a/Q50b | No age-based difference: all earned money waits 3 days after handover then the next Monday (D-28), with D-20 starter limits | DECIDED | REG:217, REG:209 |
| E5 | Which events pause payouts, who releases | QB §3 E5; REG D-21; Cashfree Q5a; ADMIN module 6 | D-21 pauses new paid orders (not payouts) on 3 faults, fraud or unpaid debt; a payout-pause and release rule is not decided | DECIDED-PARTLY - missing: payout-pause events and release authority | REG:210, CASHFREE:51-52 |
| E6 | Store-risk signals and thresholds | QB §3 E6; REG D-20, D-21, D-08 | Fault count (3/30 days), starter caps (20 orders, ₹25,000) and the ₹10,000 loss cap are set; dispute-rate, cancellation-rate and failed-payout alert thresholds are not | DECIDED-PARTLY - missing: alert signal list and thresholds | REG:209-210, REG:197 |
| E7 | Agreement states refund/dispute/chargeback duties | QB §3 E7; REG Q67, D-14, D-27; lawyer Q2 | Allocation is decided (Q62, Q67, D-14, D-27) but the agreement wording and enforceability wait on the lawyer | OUTSIDE - lawyer Q2 | LAWYER:43, REG:155 |
| Q57 | Who decides refunds | QB §3 E Q57; REG Q57, D-22, D-29, D-38 | BookConnect only; automatic categories per D-22/D-29, every return and dispute needs admin approval (D-38) | DECIDED | REG:140, REG:227 |
| Q58 | Store cannot fulfil after payment | QB §3 E Q58; REG Q55, D-22, D-35 | Automatic full refund; substitutes are not offered (D-35) | DECIDED | REG:97, REG:211, REG:224 |
| Q59 | Customer does not collect | QB §3 E Q59; REG Q72, Q59 | Full refund including any platform fee (₹0 in the pilot) | DECIDED | REG:131-132 |
| Q60 | Which return windows are allowed | QB §3 E Q60; REG Q60, Q61, D-12 | 48-hour reporting target for visible defects, not a cutoff on legal rights; no change-of-mind returns for new or used books | DECIDED | REG:139, REG:201 |
| Q61 | Used books returnable when | QB §3 E Q61; REG Q61, D-12 | Only for misdescription, defects, wrong edition, missing pages and similar, subject to legal rights | DECIDED | REG:138 |
| Q62 | Who bears the cost of a refund | QB §3 E Q62; REG Q62, BC-34, D-14, D-27 | Store-caused: store bears return delivery and the fee (D-27); BookConnect advances and recovers (D-14) | DECIDED | REG:141, REG:216, REG:203 |
| Q63 | Is commission reversed on refund | QB §3 E Q63; REG Q63 | No pilot commission exists to reverse (0% during the introductory period) | DECIDED | REG:161 |
| Q64 | Cashfree refund fee absorbed or passed | QB §3 E Q64; REG D-27; HO §11 #20; Cashfree Q11 | Allocated by cause (D-27); whether the whole fee or only the refunded part is non-returned waits on Cashfree | DECIDED-PARTLY - missing: whole vs refunded-part fee | REG:216, HO:582, CASHFREE:74 |
| Q65 | Partial refunds, more than one per order | QB §3 E Q65; REG Q65, D-29, D-35; Cashfree Q6 | One unavailable item is refunded automatically; more than one partial refund per order is not decided and provider support is unverified | DECIDED-PARTLY - missing: multiple partial refunds per order | REG:98, REG:218, CASHFREE:56-60 |
| Q66 | Refund speed standard or instant | QB §3 E Q66; REG D-48 | Standard speed only, customers told 2-3 working days; no instant refunds in the pilot | DECIDED | REG:237 |
| Q67 | Recovering money from a store already paid | QB §3 E Q67; REG D-14, Q67 | BookConnect refunds at once from its own balance, records a store debt, recovers from the next payout, else 7-day repayment | DECIDED | REG:203, REG:155 |
| Q68 | Chargebacks: manual or automated, who pays | QB §3 E Q68; REG Q68; HO §11 #6 | Store-caused recovered like Q67; fraud where the store complied is BookConnect's loss counted to D-08; evidence and fee treatment in the refunds SDD | DECIDED | REG:156, HO:557 |
| Q69 | Maximum time for refund requests | QB §3 E Q69; REG §9 refund window; Cashfree Q9 | Customer refund rights do not end with provider limits; the applicable Cashfree window (120/180 days/six months) is unverified | OUTSIDE - Cashfree Q9 | REG:269, CASHFREE:68-70 |
| Q70 | Substitute instead of a refund | QB §3 E Q70; REG D-35, D-42 | No substitutes; a wanted alternative is a new BookConnect order | DECIDED | REG:224, REG:231 |
| E8 | Vendor share reversed automatically or on request | QB §3 E8; REG §9; Cashfree Q6 | Whether the split share reverses automatically, including for partial refunds, is unverified | OUTSIDE - Cashfree Q6 | CASHFREE:56-60, REG:270 |
| E9 | Store balance too low to reverse | QB §3 E9; REG D-14, D-54; Cashfree Q7/Q8 | BookConnect pays the customer at once and recovers from later payouts; the refund float amount waits on Cashfree Q8 | DECIDED-PARTLY (D-54 amount after Cashfree Q8) ✱ | REG:203, REG:243 |
| E10 | Refund after pickup and settlement | QB §3 E10; REG E10, BC-40, D-14 | Pickup or payout does not close valid refunds, returns, disputes or chargebacks | DECIDED | REG:144, REG:162 |
| Q71 | How long to collect after ready | QB §3 F Q71; REG Q71, D-43, D-53 | Three calendar days from the ready notification; for photo-check orders the three days start when the photo check ends | DECIDED | REG:130, REG:232, REG:242 |
| Q72 | At the deadline: auto cancel and refund | QB §3 F Q72; REG Q72, Q59, D-22 | Cancel and full refund automatically, including any platform fee (₹0) | DECIDED | REG:131-132, REG:211 |
| Q73 | Pickup code format, single use, expiry | QB §3 F Q73; REG Q73, D-44; HO §11 #9 | OTP/code; format, single use, expiry and attempt limits are design detail for the pickup SDD | SDD - HO §11 item 9 | REG:133, HO:562, HO:318 |
| Q74 | Who checks the code | QB §3 F Q74; REG D-44 | Authorized store staff may verify the OTP; anyone presenting it may collect | DECIDED | REG:233 |
| Q75 | Book missing or damaged at pickup | QB §3 F Q75; REG D-44, D-21; HO §11 #27 | Customer may refuse and gets a full refund; a book not matching the listing is a store fault | DECIDED | REG:233, HO:599 |
| Q76 | Someone else collects | QB §3 F Q76; REG D-44 | Anyone presenting the customer's valid OTP may collect | DECIDED | REG:233 |
| Q77 | Must the store mark "packed" before ready | QB §3 F Q77; REG D-44; D-17 (delivery only) | Pickup requires only the pre-ready item check of D-44; whether a separate "packed" pickup state exists is not specified anywhere | SDD - NOT LISTED | REG:233, REG:206 |
| Q78 | What the customer sees about pickup | QB §3 F Q78 | Address, hours and instructions for pickup are not specified anywhere | SDD - NOT LISTED | QB:292, HO:571-575 |
| Q79 | Does pickup start the return window | QB §3 F Q79; REG D-44, Q60 | The Q60 condition-reporting window starts at verified OTP handover | DECIDED | REG:233 |
| E11 | Must the store confirm items in hand before ready | QB §3 E11; REG D-44 | Yes: before marking ready the store checks the book is present and matches the edition and condition | DECIDED | REG:233 |
| E12 | Resend ready notice, store's own instructions | QB §3 E12; REG D-44 | Resending the pickup notice is allowed and does not reset the three days; store-authored pickup instructions are not decided | DECIDED-PARTLY - missing: store-added pickup instructions | REG:233 |
| E13 | Part-ready order or all-or-nothing | QB §3 E13 | Not addressed anywhere in these files | PENDING-OWNER | REG:126-144 |
| E14 | Reminder before the pickup deadline | QB §3 E14; REG D-57 | One reminder 24 hours before the three-day deadline, in the app and by email when given | DECIDED | REG:246 |
| Q101 | Who handles refunds, disputes, payouts | QB §3 I Q101; REG Q101, §10 | BookConnect (the owner) centrally coordinates; staffing beyond the owner is open | DECIDED-PARTLY - missing: support staffing beyond the owner | REG:169, REG:279 |
| Q102 | Support response time | QB §3 I Q102; REG D-51, D-19 | First reply within one business day in D-19 hours; E-Commerce Rules 48-hour/one-month limits remain the outer limits | DECIDED | REG:240, REG:208 |
| Q103 | Support channels | QB §3 I Q103; REG D-51 | In-app complaint form with a ticket number plus a support email; no WhatsApp or phone in the pilot | DECIDED | REG:240 |
| Q104 | What finance screens show in the pilot | QB §3 I Q104; ADMIN §4.1 modules 1-10; SDD 08 | Lookup, exception queue, refunds, store money, reconciliation, chargebacks, store controls and settings screens | SDD - admin proposal §4.1 (not in HO §11) | ADMIN:69-81, HO:538 |
| Q105 | Who approves refunds and adjustments | QB §3 I Q105; REG Q105, D-22, D-29, D-38 | Only controlled BookConnect admin paths; automatic categories at any amount, returns and disputes always approved, typed reason above ₹1,000 | DECIDED | REG:170, REG:211, REG:227 |
| Q106 | How problem cases are tracked | QB §3 I Q106; REG D-10, D-37; ADMIN modules 3, 5, 12 | Overdue inspections and store responses go to the admin exception queue; the complaint-ticket tool choice is still open | DECIDED-PARTLY - missing: ticketing tool choice (Freshdesk or Zoho Desk) | REG:199, REG:226, ADMIN:120-122 |
| E19 | One view of stuck payments, failed payouts, negative balances | QB §3 I E19; ADMIN modules 3, 6; REG §10 | Approved admin console provides an exception queue and a per-store earned/paid/owed view including payout failures | DECIDED | REG:307-308, ADMIN:73-76 |
| E20 | Second-person approval for large refunds | QB §3 I E20; HO §7; ADMIN module 13 | Not for the pilot; 2FA, per-refund and daily limits and after-the-fact alerts apply until a second admin exists | AFTER-PILOT | HO:352-354, ADMIN:88 |

### C. Tax, legal, engineering, launch: QB §3 H, J, K, L, §0.3, §0.4 (reviewer: GLM)

| ID | Question | Related sections | Answer (decision IDs) | Status | Evidence |
|---|---|---|---|---|---|
| Q87 | Books GST-exempt? | QB §3-H; D-49; RB §2.1 | D-49 designs the pilot as GST-exempt (HSN 4901) but the exemption fact itself awaits the CA | OUTSIDE (CA Q1) | QB:321; REG:238; CA:38–43 |
| Q88 | GST TCS / operator registration | QB §3-H; RB §2.2 | No REG decision; likely nil TCS for exempt books, registration unresolved | OUTSIDE (CA Q3) | QB:322; RB:54–63; CA:53–57 |
| Q89 | Store GST registration needed? | QB §3-H; D-49 | D-49 assumes stores without GST registration can sell; confirmation awaits CA | OUTSIDE (CA Q4) | QB:323; REG:238; CA:58–61 |
| Q90 | Income-tax TDS s.393 applies / TAN | QB §3-H; RB §2.4 | No REG decision; research says it applies even to exempt books | OUTSIDE (CA Q6) | QB:324; RB:80–85; CA:67–74 |
| Q91 | TDS timing and base | QB §3-H | Same CA question covers base/timing/₹5-lakh exemption | OUTSIDE (CA Q6) | QB:325; CA:71–73 |
| Q92 | GST on commission/subscription | QB §3-H | No REG decision; pilot charges 0% (Q7, Q13); 18% research presumption | OUTSIDE (CA Q5) | QB:326; REG:56–57; CA:61–63 |
| Q93 | Who issues customer receipt/bill of supply | QB §3-H; D-50 | D-50 decided receipt channel (in-app, email if given); issuer left to CA Q7 | DECIDED-PARTLY (issuer per CA Q7) | REG:239; QB:327; CA:78–79 |
| Q94 | What BookConnect invoices stores, how often | QB §3-H; Q7/Q13 pilot fees | Pilot has 0% commission for five stores; delivery invoicing/GST is the open part | OUTSIDE (CA Q2, CA Q5) | QB:328; REG:56–57; CA:43–52 |
| Q95 | Business structure suitable | QB §3-H | Decided as a brand of the existing LLP; tax/legal fit still to review | DECIDED-PARTLY (registrations per CA Q12) | REG:67; QB:329; CA:103–106 |
| Q96 | Which E-Commerce Rules duties apply | QB §3-H; D-19/D-51/D-52 | 48-h ack (D-19), tickets (D-51), officer (D-52) decided; seller-detail display and exact Rule 5/6 clauses open | DECIDED-PARTLY (seller details per LW Q6) | REG:208,240,241; QB:330; LW:78–86 |
| Q97 | Who is grievance officer | QB §3-H; D-52 | Owner is the named officer, subject to lawyer confirmation | DECIDED (D-52; depends on LW Q6) | REG:241; QB:331; LW:78–81 |
| Q98 | Which policy pages needed | QB §3-H | No REG decision; lawyer asked which pages | OUTSIDE (LW Q6) | QB:332; LW:83–84 |
| Q99 | Privacy policy names Cashfree as processor | QB §3-H | Routed to the lawyer (CA doc rerouted Q99/Q100 from CA to lawyer) | OUTSIDE (LW Q5) | QB:333; LW:74–77; CA:141–143 |
| Q100 | Store agreement needed, coverage | QB §3-H | No standalone decision; its clauses are enumerated by D-13/D-14/D-20/D-21/D-23/D-27/D-45 etc. | OUTSIDE (LW Q2, LW Q13) | QB:334; LW:33–49,117–121; REG:202–210,216,234 |
| Q107 | Repo folder/branch for Phase 7/8 | QB §3-J; D-03, D-46 | Separate folder with fresh pull of origin/main; SDDs first on branch `docs/phase7-8-planning` | DECIDED (D-03, D-46) | QB:352; REG:192,235 |
| Q108 | Existing Supabase dev project for testing | QB §3-J; D-33 | D-33 authorizes test-mode migrations on the dev project (verify ref each migration) | DECIDED (D-33; HO §8) | QB:353; REG:222; HO:382–383 |
| Q109 | Migration number range | QB §3-J | Only a stage-0 check (timestamps vs live and Phase 9's range); no range recorded | SDD (HO §8 item 5; not in §11) | QB:354; HO:371–372 |
| Q110 | Migrations coordinated with Phase 9 | QB §3-J; D-33 | One-lane shared-file rule + timestamp check against live DB before each migration | DECIDED (D-33; HO §3 item 2) | QB:355; REG:222; HO:71 |
| Q111 | Phase 7 changes Phase 9's inventory tables? | QB §3-J; P-5 step 1 | SDD 01 (Phase 6 reconciliation, P-5 step 1) settles; impact check lists inventory-hold changes | SDD (SDD 01; HO §11 item 1 partial) | QB:356; REG:187; IC:53,101–103 |
| Q112 | Where Cashfree test keys live | QB §3-J | Server secrets only, never chat/repo/app; test keys only in dev project | DECIDED (owner-approved security baseline HO §7; not a REG row) | QB:357; HO:271–274,192 |
| Q113 | Which Cashfree API version | QB §3-J | `2026-01-01` recorded as the official version in research; no REG row/owner decision | SDD - NOT LISTED (RB:137) | QB:358; RB:137; QB:509 |
| Q114 | Payment-provider interface for swapping | QB §3-J | No second provider built in the pilot, so swap abstraction not required now | AFTER-PILOT (BC-44) | QB:359; REG:174 |
| Q115 | Money rules the DB enforces | QB §3-J; Q86 | Q86 (balanced, append-only, reversal-only) + security baseline (paise, no negative, refund cap, one payment per order) | DECIDED (Q86; HO §7) | QB:360; REG:159; HO:293–299 |
| Q116 | Phase 6 deferred items (browser test etc.) | QB §3-J; P-5 step 1 | P-5 step 1 reconciles Phase 6; deferred browser test sits in the timeline weeks 6–7; exact handling for the SDD | SDD (SDD 01; HO §4 weeks 6–7; not in §11) | QB:361; REG:187; HO:95–96,363 |
| Q117 | Vertical slices vs by layer | QB §3-J; P-5 | P-5 orders build stages so a working slice precedes the next; pickup before pickup-only launch disallowed | DECIDED (P-5) | QB:362; REG:187 |
| Q118 | How many slices, in what order | QB §3-J; P-5 | Sequence decided (P-5); exact slice list/count = the SDD set 00–09 at skeleton review | DECIDED-PARTLY (slice list = SDD, HO §11 planned set) | QB:363; REG:187; HO:534–539 |
| Q119 | Production Supabase project timing/migration move | QB §3-J | Baseline requires a separate production project and PITR before live, but when it is created/migrated is recorded nowhere | PENDING-OWNER | QB:364; HO:273–274,347–349 |
| E21 | Which Cashfree errors retryable/final/unknown | QB §3-J; SDD 02 | Constraints decided (BC-11, BC-15, D-29 `ONHOLD` treatment); per-call classification is engineering | SDD (SDD 02; HO §11 items 3, 7) | QB:368; REG:92,99,218; HO:547–549,559–560 |
| E22 | Intent-record-before-call / result-after | QB §3-J | Security baseline covers verification-after; before-call intents not written anywhere | SDD (SDD 02/03; HO §7; not in §11) | QB:369; HO:277–284 |
| E23 | Idempotency key creation/retention | QB §3-J | Baseline: own unique ID on every order and refund; creation point/retention unspecified | SDD (HO §7; not in §11) | QB:370; HO:290 |
| E24 | Preventing concurrent double money actions | QB §3-J | Baseline requires locks so two refunds cannot both pass; lock design is engineering | SDD (HO §7; not in §11) | QB:371; HO:291 |
| E25 | Webhook as trigger vs truth | QB §3-J | Verify signature, process once, then confirm status with the provider before acting | DECIDED (BC-11; HO §7) | QB:372; REG:92; HO:281–284; RB:157–158 |
| E26 | Primary-DB-only reads for idempotency/payment state | QB §3-J | Airbnb pattern noted in research only; no decision or baseline text | SDD - NOT LISTED | QB:373; QB:475; QB:168 |
| E27 | Redirect to hosted page for PCI SAQ A | QB security; HO §7 | Hosted Cashfree checkout decided in the security baseline; type (redirect vs embedded) awaits Cashfree | DECIDED (HO §7; depends on CF Q17) | QB:379; HO:280 |
| E28 | Redirect vs embedded/iframe, PCI scope | QB security | No REG decision; question sent to Cashfree | OUTSIDE (CF Q17) | QB:380; CF:101–103 |
| E29 | PCI self-assessment required at onboarding | QB security | No REG decision; question sent to Cashfree | OUTSIDE (CF Q18) | QB:381; CF:104–105 |
| Q120 | Authorize resuming Phases 7/8 as second lane | QB §3-K; §0.4 | Owner approved 2026-11-07 (§3 item 1); recording in DOC-13/ACTIVE.md pending day 1 | DECIDED (Q120 row; HO §3 item 1, §10) | QB:385; REG:172; HO:70,507–528 |
| Q121 | Approve the documentation pass | QB §3-K; §0.4 | Approved with the same §3 item 1 | DECIDED (REG §10; HO §3 item 1) | QB:386; REG:307; HO:70 |
| Q122 | Dev migrations approved in batch or one at a time | QB §3-K; D-33 | Standing authorization per approved slice; project verified before each migration, recorded in migration ledger | DECIDED (D-33) | QB:387; REG:222; HO:71 |
| Q123 | Does SDD-0's process apply to Phase 7? | QB §3-K | HO §5 defines the Phase 7/8 process (reviews, five additions); no statement anywhere maps or carries over "SDD-0" | DECIDED-PARTLY (SDD-0 mapping unanswered) | QB:388; HO:125–166 |
| Q124 | Which models for coding/review/tests | QB §3-K | Roles fixed (Claude SDDs, Codex Sol code, cheaper models tests); model names to re-confirm day 1 | DECIDED-PARTLY (names per HO §5 day 1) | QB:389; HO:127–131,156–157 |
| Q125 | Owner reviews money-critical PRs? | QB §3-K | No question answer, decision, or baseline text | PENDING-OWNER | QB:390 |
| Q126 | Move SDD-0 rules into shared process doc | QB §3-K | Nothing recorded | PENDING-OWNER | QB:391 |
| Q127 | Cashfree live account verified? | QB §3-L | Live approval/documents/timeline are a Cashfree answer; RB documents LLP onboarding needs | OUTSIDE (CF Q20) | QB:395; CF:111–113; RB:189–192 |
| Q128 | Easy Split enabled for live mode | QB §3-L; P-3 | P-3 in principle; activation "must be enabled for test and production" | OUTSIDE (CF Q20; P-3) | QB:396; REG:185; RB:174 |
| Q129 | CA answers received and applied | QB §3-L | Drafts ready, not sent (2026-11-09); needed weeks 2–4 / before live | OUTSIDE (CA Q1–Q12) | QB:397; CA:38–106; HO:179–181 |
| Q130 | Pilot stores signed up, registered as vendors | QB §3-L; REG §10 | Store names/launch dates are open owner items; vendor KYC is Cashfree's answer | PENDING-OWNER (KYC per CF Q5) | QB:398; REG:277–278; CF:47–50 |
| Q131 | Who tests a real-money payment, how much | QB §3-L; BC-43 | Live gate BC-43 requires one small real-money test (handoff); person and amount decided by nobody | PENDING-OWNER | QB:399; HO:121–123 |
| Q132 | Rollback plan for live payments | QB §3-L; D-55 | D-55 (paid orders continue during pause) + kill switch (baseline); no fuller rollback plan/drill recorded | DECIDED-PARTLY (plan beyond pause missing; SDD 09) | QB:400; REG:244; HO:333 |
| E30 | Kill switch per store/all; sandbox cycle rehearsed | QB §3-L; D-55, D-08 | Per-store/global pause decided (D-55, D-08; admin module 10); complete pay-pickup-refund-reconcile rehearsal not enumerated as a gate | DECIDED-PARTLY (rehearsal gate missing) | QB:404; REG:244,197; AC:80 |
| QB §0.3 Cashfree bullet | Easy Split, holds, refund funding, negatives, chargebacks, methods, checkout, PCI | QB §0.3 | Whole bullet mapped to the Cashfree questions (coverage check confirms) | OUTSIDE (CF Q1–Q19) | QB:117–119; CF:149–156 |
| QB §0.3 courier bullet | Courier aggregator terms | QB §0.3; D-24 | Superseded: bike delivery replaces the aggregator for the pilot; provider check is HO §6.4, and no question doc for the delivery provider exists in the folder | OUTSIDE (delivery provider; HO §6.4) | QB:120–122; REG:213; HO:260–266 |
| QB §0.3 CA bullet | LLP accounting, GST, TCS, TDS, invoices | QB §0.3 | All mapped to CA Q1–Q12 | OUTSIDE (CA Q1–Q12) | QB:123–124; CA:132–139 |
| QB §0.3 lawyer bullet | Seller of record, store agreement, deductions, rights, grievance/privacy | QB §0.3 | All mapped to lawyer Q1–Q13 | OUTSIDE (LW Q1–Q13) | QB:125–126; LW:148–155 |
| QB §0.4 resume authority | Resume Phases 7/8, record in DOC-13 | QB §0.4; Q120 | Approved 2026-11-07; DOC-13/ACTIVE.md recording still pending day 1 | DECIDED (HO §3 item 1; recording pending HO §10.4) | QB:130; REG:307; HO:30,70 |
| QB §0.4 documentation pass | Approve documentation pass | QB §0.4 | Approved with the same item | DECIDED (same) | QB:131–132; REG:307 |
| QB §0.4 workspace/migrations | Folder, branch, migration range, dev-migration approval | QB §0.4; D-03, D-46, D-33 | Folder (D-03), branch (D-46), per-migration authorization (D-33); the migration number range itself is recorded nowhere | DECIDED-PARTLY (migration range missing) | QB:133; REG:192,222,235; HO:371–372 |

### D. Handoff §11 engineering items 1–29: do their decisions exist?

| # | Relies on | In REG? |
|---|---|---|
| 1 | Q38, D-06 | Yes (REG:90, 195) |
| 2 | D-09, D-39, D-31, D-41 | Yes (REG:198, 228, 220, 230) |
| 3 | D-29 | Yes (REG:218) |
| 4 | D-20, D-07 | Yes (REG:209, 196) |
| 5 | D-04, D-02, D-21, D-27 | Yes (REG:193, 191, 210, 216) |
| 6 | Q68, D-14, D-08 | Partially — Q68 decides who pays; the "store complied" evidence standard and fee/reversal treatment are not REG decisions and need Cashfree (CF Q12) |
| 7 | D-48, refund flows | Partially — no REG row defines the `refund_failed` route; RBI original-method rule is HO §7:312–313 only; CF Q10/LW Q8 |
| 8 | P-5 step 1, BC-08 | Yes (REG:187, 85) |
| 9 | Q73, D-44 | Yes (REG:133, 233) |
| 10 | Q50a, Q50b, BC-37, P-3 | Yes-in-part: Q50a (REG:150), BC-37 (REG:153), P-3 (REG:185); Q50b is IN PRINCIPLE (REG:151) and Easy Split timing waits on CF Q1–Q3 |
| 11 | D-13 | Yes for the rule (REG:202); fee method is SDD choice, rates UNVERIFIED (CF Q13, Q14) |
| 12 | BC-40, REG §9 | Principle decided (REG:162); provider window mechanics UNVERIFIED (CF Q9; LW Q9) |
| 13 | P-6, D-18 | Yes (REG:188, 207) |
| 14 | D-10, D-38, D-40 | Yes (REG:199, 227, 229) |
| 15 | D-24, D-07 | Yes (REG:213, 196) |
| 16 | BC-41 | Rule decided (REG:163); "provider KYC rules to verify" → CF Q5 |
| 17 | D-02 | Yes (REG:191) |
| 18 | D-26–D-45 | Yes, all exist (REG:215–234) |
| 19 | D-14, D-27 | Yes (REG:203, 216) |
| 20 | D-27, REG §9 | Yes for rule; "non-returned fee" definition waits on CF Q11 |
| 21 | D-14, D-30 | Yes (REG:203, 219) |
| 22 | Q45, Q45b, D-09, D-31, D-39 | Q45 decided (REG:135); Q45b IN PRINCIPLE pending LW Q4 (REG:136) |
| 23 | D-28, D-20 | Both decided (REG:217, 209); the "held money counts as unsettled" classification itself is not in REG (recommended answer only) |
| 24 | D-34 | Yes (REG:223); wording is SDD |
| 25 | D-02, BC-13 | Yes (REG:191, 95) |
| 26 | D-43, D-53 | Yes (REG:232, 242) |
| 27 | D-44, D-45 | Yes (REG:233, 234) |
| 28 | D-42 | Yes (REG:231) |
| 29 | D-47–D-57 | Yes, all exist (REG:236–246) |

### E. Register open and in-principle items: is there an outside question for each?

| ID / item | REG status | Waiting on | Matching outside question? |
|---|---|---|---|
| Q2 seller of record | IN PRINCIPLE (the register's status line3) | Lawyer + CA | Yes — LW Q1, CA Q11 |
| Q3 no pooled funds | IN PRINCIPLE (the register's status line4) | Cashfree | Yes — CF Q4 |
| Q45b cancel after collection | IN PRINCIPLE (REG:136) | Lawyer | Yes — LW Q4 |
| Q50b delivery entitlement | IN PRINCIPLE (REG:151) | Cashfree timing | Partially — CF Q1–Q3 cover timing, not the evidence standard |
| Q51 weekly Monday payouts | IN PRINCIPLE (REG:152) | Cashfree | Yes — CF Q2, Q3 |
| BC-28 contract delivery provider | IN PRINCIPLE (REG:120) | CA + lawyer | Yes — CA Q2, LW Q7 |
| BC-38 store-fault delivery costs | IN PRINCIPLE (REG:157) | Lawyer (enforceability) | Yes — LW Q2 |
| P-3 Easy Split | IN PRINCIPLE (REG:185) | Cashfree written confirmation | Yes — CF Q1–Q4 |
| D-54 refund balance | IN PRINCIPLE (REG:243) | Cashfree Q8 | Yes — CF Q8 |
| P-4 source attribution | OPEN (REG:186) | Owner, post-pilot | No — deliberately internal, none needed |
| REG §9 Easy Split hold (45-day) | UNVERIFIED (REG:268) | Cashfree | Yes — CF Q1 |
| REG §9 refund window (120/180 days vs 6 months) | UNVERIFIED (REG:269) | Cashfree; also lawyer for lawful route | Yes — CF Q9, LW Q9 |
| REG §9 chargebacks/negative balances/refund funding/methods/Monday payouts/fees | UNVERIFIED (REG:270) | Cashfree | Yes — CF Q3, Q6, Q7, Q8, Q12, Q13, Q14 |
| REG §9 delivery rate cards | UNVERIFIED (REG:271) | Bike provider (weeks 1–2) | No question doc exists for the delivery provider — only the HO §6.4 API-check checklist (HO:260–266) |
| Pilot store names / launch dates / staffing / offline stock sync (REG §10) | OPEN — owner items (REG:277–281) | Owner + stage-0 checks | No — internal |
| Delivery GST: customer pays quote+GST or BookConnect absorbs | OPEN (REG:282–286) | CA then owner | Yes — CA Q2 (owner sub-decision has no Q-ID of its own) |

Also: no REG row currently carries PROPOSED status (all P-rows resolved: SUPERSEDED/IN PRINCIPLE/OPEN/DECIDED/DEFERRED, REG:183–189); the header's "PROPOSED rows still need owner approval" (the register's status line) is presently vacuous.
