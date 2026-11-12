# Pilot Cut Review, Round 2 (OpenCode, 2026-11-13)

General read by three OpenCode models, read-only. Their reports are copied below unedited. The 12 consolidated fixes and their status are in the [overview](./00-pilot-cut-overview.md), §8.

---

## deepseek-v4.1-flash

### Verdict

**Ready after fixes.** The cut is about right for a sandbox pilot and too light for live money; it preserves the money/stock spine and its test mapping is careful, but unsent refunds, a missing “Mark ready” path and late case visibility are contradictions that must be fixed before approval.

### Findings

1. **Major — overview §2 N-07, §4 (D-29, D-78/D-110, D-95), §7; C2 §19.** The cut promises a refund but defers the only sender. N-07 says a paid customer “always ends with an order or a refund,” yet §7 says “refunds actually sent (SDD 04)” follow in later cuts; category 5/3 requests hit a recording stand-in, and 6/6a/failed-conversion wait for a P7 script. “The customer is never left waiting on the admin” is false: an overdue case is not money. **Change:** state the pilot is sandbox-only, redefine N-07 as order/refund/owner-visible case with a hard response deadline, or keep an automatic sender/fallback.

2. **Major — C1 §6.6, §6.7, §12; overview §7 P6.** No store can mark an order ready, but preparation expiry is kept. C1 §12 says the store order detail is “without ‘Mark ready’”; C1 §6.7 defers the button to SDD 06, while `expire_unprepared_order` still fires at `preparation_expires_at`. Every accepted order will therefore be cancelled/refunded. **Change:** defer preparation timers/expiry with SDD 06, or include a checked ready entry point or audited admin script in P6.

3. **Major — overview §5, §7 P1/P6/P7; C1 §2.** Cases opened before P7 are invisible. P1 has the “admin case record and its open function,” but the owner notice and digest are P7; §5 promises “an in-app owner notice for each new case ... plus a daily case digest.” P4/P5/P6 can open conversion-failure, wrong-amount, duplicate, poll-backlog, 429 and preparation cases. **Change:** move the owner notice and a minimal digest to P1/P4, or declare early slices test-data-only and reviewed from the case table.

4. **Major — C2 §13.1, PC2-03; C1 §2 (E-28), §5.3.** The wrong-amount obligation is not recorded when the payment is classified. C2 says “No refund request is made automatically” and the admin script later persists the category 6 intent; but kept E-28 and C1 §5.3 say verification “records its full-refund obligation.” The case is the only record until an admin acts. **Change:** keep a durable obligation/intent at classification with submission blocked, and let the script only submit; or change E-28/§5.3 to say the case is the obligation.

5. **Major — C1 §13; overview §5.** “Report only, no case ... listed in the digest” contradicts the case digest. The digest “lists open cases”; the D-81 scan and receipt-unsent scan open none, so there is no defined place for them. The D-81 scan is the only oversight for a live checkout under a suspension. **Change:** define the digest to include report-only findings (or open a low-severity case) and test it in PC1-04.

6. **Minor — overview §5 P1.** The case table is an unresolved schema fork. P1 says “if an existing case table fits (for example `finance_reconciliation_cases` ...), it is reused ... otherwise a minimal new table is created.” `finance_reconciliation_cases` belongs to SDD 03; mixing finance and operational case types may conflict. **Change:** name the table/type model in P1 and align it with SDD 03.

7. **Minor — overview §3 item 2; §7 P3/P4.** Deployment authority omits two needed functions. The rule “Applies to the webhook endpoint, the poll and the shared commerce-task-worker,” but P3/P4 need `commerce-payment-start` and `commerce-payment-check`. **Change:** say “every Edge Function deployment” and list all functions.

8. **Minor — overview §6; C2 §10.3/§19.** The charge handover has no agreed stand-in key. §6 lists receipt/order/reversal/duplicate_loss and refund keys but not charges; C2 says charges go to SDD 03’s stand-in, while HC-01 requires stable business keys. **Change:** define the charge key (e.g., `charge:<cf_payment_id>` or the message key) and add it to §6/HC-01.

9. **Minor — C2 §15.1.** The worked-example mapping is wrong. The cut says “In example 6 the refund deadline opens a ‘Refund due’ case”; SDD 02 example 6 is wrong amount, which has no refund deadline. Example 5’s completed reversal means no refund. **Change:** move the “Refund due” sentence to example 5’s non-reversal branch and give example 6 the wrong-amount admin case/script refund.

10. **Minor — C2 §5, §11.1.** `payment_poll_batch_max` has no default, and the backlog case is attributed to the digest. The cut adds “a bounded number” but no value; “The case digest ... over one hour opens a case” conflicts with the digest’s daily cadence. **Change:** set a default and name the daily reconciliation (or a dedicated check) as the opener.

### Unsure

- I could not verify the live `finance_reconciliation_cases` state (“empty today”); no DB commands were allowed.
- The owner decisions in overview §3 are “not yet in the register”; I treated them as unverified.
- The `deferred_type` “code” has no named column in the SDD event table; the live schema may differ.
- Whether the P7 owner notice reuses handoff §11 item 25 is unclear; that item is about store alerts, not admin cases.
- Whether the five-store pilot is meant to take live money; the cut implies sandbox but never says so outright.

### Strengths

- The test mapping is complete and the round-1 splits (E-14, A-03, M-20/M-23, PR-09, O-01/O-02, SE-05, WH-08, L-04, TE-03a) are reflected.
- The never-cut list is a strong spine: lock order, idempotency, fresh provider reads, CF-A35, `kept_by_cashfree`, tenant isolation and the receiver gates.
- The slice plan and P4 real-phone sandbox gate are sensible; the admin-script audit model and detect-and-alert case path are good additions.

---

## minimax-m3.1-flash-free

### Verdict

**Ready after fixes.** The cut is about the right weight for a five-store pilot — the mechanical work (every SDD section and all 289 test IDs classified, verified against the SDDs myself) is complete and the Detect class is concrete. Three money-facing gaps in the manual-refund path must be closed before a coder starts.

### Findings

1. **major** — `00-pilot-cut-overview.md` §6 (and `01` cut §6.3/§6.4/§6.6): the agreed refund-key list is incomplete for five categories the pilot builds. SDD 01 §20 lists "Categories: 1, 2, 3, 4, 5, 7, 8, 19" and SDD 04 §1 says "Each automatic refund is tied to the one cancellation event that caused it", but the cut names only four keys — "the payment ID for category 5, and the missing-book report ID for category 3". Categories 1 (store never accepts), 2 (no books), 4 (cancelled_all), 7 (customer cancel) and 19 (not prepared) have no key, yet P6 creates them, and §6 says SDD 04 later "adopts the recorded rows under the same keys". Fix: name each category's obligation key (event/command identity) in §6 and in the C1 rows before P6.

2. **major** — `02-cashfree-payments-pilot-cut.md` §13.1 and overview §4 (D-29): the wrong-amount case has no due time and no fallback, so N-07 ("a customer who paid always ends with an order or a refund") is not guaranteed. The cut states "No refund request is made automatically", and the obligation is recorded only when an admin later runs the script — so a customer whose amount mismatched has no refund row until a human acts, and no deadline forces that. The customer is meanwhile told "If you were charged, it will be refunded automatically" (SDD 01 §10 wording, kept by C1 §10). Fix: give this case a due time (e.g. same working day) with the same overdue treatment as the "Refund due" case, and say what the wrong-amount customer is told.

3. **major** — overview §4 (D-78/D-110 row) and §5: the manual duplicate refund cannot keep the promise the row asserts. D-110 says "The customer is never left waiting on an admin", and the row claims "The customer is never left waiting on the admin past that deadline", but §5 sets the cadence at "reviewed once every working day" and an overdue case only floats to the top of a digest. D-78's "BookConnect refunds it anyway" after five business days becomes "a case opens and waits for the owner". Fix: state the maximum delay the owner commits to, a backup owner, and what happens if nobody acts; otherwise soften the guarantee sentence and record the deviation for D-78/D-110.

4. **minor** — overview §5, case record: the reuse plan is optimistic and one claim is unverifiable from the repo. "it is reused with typed columns" — the live table has no due-time, entity or unique-key column and a fixed `status` CHECK, so reuse needs a migration adding a due time, an entity reference and a unique (type, entity) index. "empty today" is a live-database fact no document records. Fix: list the columns/index to add and cite where emptiness was checked.

5. **minor** — `01-checkout-reservation-pilot-cut.md` §3.6: the pilot redefines a schema rule instead of deferring it. SDD 01 §3.6 says `cancels_live_reservations` is "True only for the D-81 kinds"; the cut sets it "false for all kinds in the pilot", losing the kind→cancels mapping, and drops `PAUSE_KIND_NOT_AVAILABLE`. Fix: keep the column true for the D-81 kinds (the pilot simply does not act on it), or record the data migration §5.7 will need.

6. **minor** — `02-cashfree-payments-pilot-cut.md` §11.5 is marked **Keep** but adds "three 429s in one hour open one admin case", which is not in SDD 02 §11.5, contradicting overview §1: "A section marked Keep is built exactly as the SDD says." No counter, derivation or trigger is named for it (r1's PC-07 concern, only partly closed). Fix: mark the row Simplify and say where the count comes from (e.g. `provider_checks` rows with outcome `rate_limited`) and who opens the case.

7. **minor** — `02-cashfree-payments-pilot-cut.md` §11.1: `payment_poll_batch_max` has no default or upper bound, and one pass per minute competes with the shared 25-read/minute budget (§11.5, kept) under the SDD's "bounds the invocation to 50 seconds". Fix: state a default and that claims are bounded by permits and the invocation budget.

8. **minor** — `01-checkout-reservation-pilot-cut.md` §2: the test mapping still misses one split. The Later list names the photo cases of M-20, M-23, PR-09, O-01 and O-02, but O-03 also covers photo send and photo response, which the pilot drops — so O-03 is not fully classified, against the cut's promise that every test is mentioned. Fix: add "O-03's photo cases" to the Later list.

9. **minor** — overview §1/§2: the cut never states the pilot-wide constraint that no live money can move, even though every refund in the pilot is a recording stand-in (N-13) and the wrong-amount/duplicate paths are stand-ins by definition. Fix: add one line in §1 — sandbox keys only, no live refunds, stand-ins never adopted with real money.

### Unsure

- Whether `finance_reconciliation_cases` is genuinely empty today (no database commands permitted here).
- Whether the owner can meet the daily digest cadence across weeks; the cut assumes one admin.
- Whether `payment_poll_batch_max` has an intended value, and the real account read limits (CF-A29 still unanswered).
- Whether O-03's photo sub-cases were meant to be silently dropped rather than listed.

### Strengths

The classification discipline is the strongest part: I re-derived every SDD 01 and SDD 02 section row and all 289 test IDs against the SDD part files and found no unclassified ID and no reference to a section that does not exist; r1's nine mapping defects are genuinely fixed.

The Detect class is unusually well specified — case record, owner, cadence, overdue rule, delivery-failure check and audited close — which is exactly what the first round said was missing, and the never-cut list plus §1's precedence rule give a coder a single authority.

The slice order is now sound (case primitives and stand-ins in P1, before P4 needs them), and the deferrals are honest: photos, the alert channel and platform incidents move together with the fault rules that depend on them, and the pilot's exposure to D-81 is stated as a decision the owner must take rather than glossed.

---

## glm-5.3-flash-free

### Verdict

**Ready after fixes.** The cut is a coherent, well-sourced scope for a five-store sandbox pilot: the money/stock/data protections are kept automatic, the deferrals all have gates, and round 1's fixes genuinely landed. One kept test contradicts the cut's own scan deferrals, and a handful of small ambiguities need a sentence each before a coder can build without guessing.

### Findings

1. **Major — RC-01 kept, but it tests Later scans.** `01-checkout-reservation-pilot-cut.md` §2 keeps "RC-01 for the scans kept", and §13 defers "the two photo scans ... and the platform-incident scan". But SDD 01's RC-01 asserts "the §13 scans find missing timers for `awaiting_photo_check`" and "an incident open over 24 hours" (`01-5-tests.md:283-286`) — both are exactly the deferred scans. This is the same class of contradiction round 1's PC-09 fixed for SE-05/WH-08/L-04, missed for RC-01. Fix: split RC-01 ("without its `awaiting_photo_check` and platform-incident assertions"), move those assertions to Later with §6.5/§3.12, and cover the kept remainder in PC1-04.

2. **Minor — recurring conditions vs the case dedupe key.** Overview §5 says "Opening the same case twice does nothing (keyed by type and entity)". Some pilot conditions recur by design: "three 429s in one hour open one admin case" (02-cashfree cut §11.5, PC2-04), and re-opened scans after a case is closed. If the entity for a 429 case is just "the platform", the key suppresses every later occurrence forever. Fix: state that dedupe applies only among open cases of the same type/entity, or that time-bucketed entities (hour/day) are used for recurring detectors.

3. **Minor — money cases are unresolvable from P4 to P7.** P4 builds "wrong-amount and duplicate classification" and conversion, but "the audited admin scripts" — including the wrong-amount, duplicate and failed-conversion refund scripts (PC2-08, PC1-03) — arrive only in P7. Until then a failed conversion or a `refund_due` watch leaves a paid checkout the owner cannot resolve at all. If slices are only internal branches this is tolerable; if any slice is deployed early it is a real gap. Fix: either pull the three refund scripts into P4/P5, or state explicitly in §7 that no slice before P7 may be used where such cases can arise.

4. **Minor — misattributed machinery.** Overview §3 item 3 says "SDD 02 §19's discovery, cursor and health machinery is not needed". Per SDD 02 §19, that machinery belongs to SDD 03 ("SDD 03 owns discovery, coverage/health and durable retry", `02-0-overview.md:308`); §19 is only the handover promise, and the 02 cut itself says "SDD 03's discovery, cursor and health contract" (§11.2). A coder sent to §19 finds no machinery. Fix: phrase it as "the discovery, cursor and health machinery SDD 02 §19 hands to SDD 03", consistently in both files.

5. **Minor — new setting without a value.** The 02 cut §5 changes `payment_poll_live_seconds` to 60 (a number) but adds only "a bounded number of payments claimed per pass" for `payment_poll_batch_max`, and PC2-01 tests a backlog "larger than `payment_poll_batch_max`". Every other setting in that row cites a value or a decided source; settings are approved "as written" (register, 2026-11-12). Fix: propose a default (e.g. 25, matching §11.5's per-minute read cap) for the owner's approval.

6. **Minor — digest cadence can slip money deadlines by a working day.** Overview §5 sets "reviewed once every working day", yet §4 claims "The customer is never left waiting on the admin past that deadline" for the duplicate refund, and D-78 promises a refund "within 1 business day of Cashfree confirming". A deadline hit on Saturday evening is actioned Monday: the case is marked overdue at once, but the refund lands late. Fix: state plainly that the working-day cadence may add up to one working day past money deadlines and that the owner accepts this in the pilot (also interacts with D-19's 10am–7pm support hours — see Unsure).

### Unsure

- Whether the reused case table (e.g. `finance_reconciliation_cases`, "empty today") can carry typed due/status columns and the time-bucketed entities finding 2 needs — the P1 live-schema check is the right hedge, but finding 2 should be resolved before P1.
- Whether admin scripts may run outside D-19's published support hours; the cut never says, and findings 3 and 6 both touch this.
- Whether `PAYMENT_CHARGES_WEBHOOK` handled only by SDD 03's stand-in loses anything in the pilot given fees are not charged on sandbox; the WH-16 gate covers the real receiver, so I could not confirm harm.
- Whether marking refund/vendor/settlement webhooks `processed`/`deferred_type` (02 cut §10.3) is fully recoverable if SDD 04/05 are delayed past the 180-day body deletion gate; §10.6's "before live payments" gate probably covers it.

### Strengths

- The never-cut list is verifiably real: N-02's D-114 age limit, N-08's CF-A35 block and `kept_by_cashfree`, N-06's D-101 hold rule, and the D-111-aligned 25-minute wording all match the register and the SDD part files exactly.
- Test classification coverage is complete and now internally consistent for both SDDs' 289 test IDs (spot-checked ranges R/E/L/A/M/PR/O/RX and AD/PA/VE/WH/PO/TE/DU/SE/ST2/HC/RX2); the round-1 fixes (L-04's platform-cancel case, RX2-03 classified once, TE-03a, receiver gates) genuinely landed.
- The owner-decision discipline is exemplary: §3 records taken decisions, §4 cleanly separates what the cut would revisit, and nothing is cut silently — including restoring D-109 that round 1 of the cut had weakened.
- References check out: `commerce_apply_duplicate_watch`, handoff §11 item 25, SDD 03's skeleton §1/§7, `AD-04`'s sandbox guard, and `payment_poll_*` setting names all exist where cited.

No files were changed, staged or committed; no database, network, npm, Supabase or deployment commands were run.
