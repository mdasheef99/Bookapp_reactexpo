# SDD 02 outside review and Sol's three-angle review (2026-11-12)

## How this round came about

On 2026-11-12 the owner pasted an outside review of SDD 02 (not stored word for word).
Its verdict was to keep the architecture but fix eight points. Claude checked each one
against the SDD text:

| Outside point | Result after checking |
|---|---|
| Refund when an order has two successes (CF-A35) | Already blocked in SDD 02 §13.1; open with Cashfree (mail 6, question 1) |
| Which payment survives after Cashfree's reversal | Same CF-A35 dependency; SDD 04 must use the surviving payment |
| Webhook version must be checked in the dashboard | Already in SDD 02 §16 item 3 (slice 4 gate) |
| Easy Split call failing after a paid order | SDD 05's job (see "Changes needed in other SDDs" below) |
| 24-hour webhook window: replay, flood, rotation, order, unbounded reads | Replay, rotation and ordering tests already existed; rate permits (§11.5) bound reads; **flood and oversize were real gaps**: fixed |
| §16 said "no owner decisions" while §17 held unapproved proposals | **Real**: fixed |
| 60-day poll window handover to SDD 03 | **Real**: no test; fixed with PO-10 and PO-11 |
| Security of the endpoint, wrappers and admin powers | Taken into Sol's angle A below |

Claude made the three real fixes, then Codex Sol (gpt-6.1-sol, xhigh) reviewed them from
three angles: attacker view, what is missing, and handovers between SDDs. Sol's report
follows unchanged. **Afterwards Claude simplified Sol's rejection counter for the pilot**
(owner's choice "Simplify, then commit"): one counter row per minute and reason (no 16
shards), and a simple once-a-minute alert check with a one-hour cooldown (no catch-up
cursor); future timestamps are rejected only beyond 5 minutes, not at zero skew. Where
the report below mentions shards, an evaluator cursor or zero future skew, SDD 02 as
committed (34a1fdc9) wins. The owner approved SDD 02 the same day (commit 2f001d27).

The list **"Changes needed in other SDDs"** near the end is a required input for writing
SDDs 03, 04, 05, 08 and 09.

---

# SDD 02 outside-review revision: review and fixes

Date: 2026-11-12. Branch: `docs/phase7-8-planning`.
Worktree: `C:\Users\user\Desktop\Bookconnect-p78-docs`.

Reviewed the requested uncommitted diff, then all four SDD 02 parts from angles
A (attacker), B (missing limits/failures/tests) and C (handovers). Checked findings
against the decision register, SDD 01's parts, SDD 03's outline and the relevant
SDD 04/05 recovery text before editing. Only the four SDD 02 parts and this excluded
report were written. Existing user edits were retained.

This round approves doing the review/fixes; it does not approve SDD 02 or turn §17
proposals into policy. No new decision ID or business rule was introduced. New
webhook limit choices are explicitly proposals in §17 item 15.

Locations below use final, post-fix line numbers. Bare filenames are relative to
`docs/multi-tenant-bookstore-marketplace/implementation/phase-7-8-payments-fulfillment/02-cashfree-payments/`.
Evidence describes the text supplied for review; these are design findings, not
claims about an implemented or live payment system.

## Findings

### F01 — Counter storage bounds did not bound contention or failure cost

- Angle: **A/B**. Severity: **High**.
- Location: `02-1-data-and-adapter.md:147` (§4.3a);
  `02-2-payment-flows.md:349` (§10.6); `02-3-races-and-tests.md:247` (WH-15).
- Evidence: the supplied primary key was `(minute_bucket, reason)`, so forged
  signatures in one minute all updated one row. Every rejection required a database
  call, without a lock/call deadline or a counter-failure response. WH-15 asserted
  genuine traffic still worked during 10,000 requests without stating capacity or
  concurrency. Small row counts alone cannot prove that claim.
- Fix applied: fixed server-chosen shards, constrained reasons, database-derived
  buckets, atomic saturating BIGINT increments, bounded lock/statement/caller waits
  and no endpoint retry. Rejection status survives telemetry failure; no fallback
  rejected-event row is allowed. Failed/uncertain counts are explicitly lower bounds
  with payload-free health metrics. WH-15 now requires measured genuine-delivery
  success at its stated load and records a failure if capacity is insufficient.
- Not fixed operationally, because this is a document-only task and external calls
  are prohibited: ingress admission/throttling and deployed capacity. §10.6 records
  the shared-pool/Edge exhaustion risk and assigns a pre-acceptance operations gate.
  An attacker can still undercut the alert threshold or cause count loss under
  exhaustion; these counters do not certify availability or absence of lost events.

### F02 — Alert check could be expensive, race, or be suppressed by case handling

- Angle: **A/B**. Severity: **High**.
- Location: `02-1-data-and-adapter.md:165` (§4.3a),
  `02-1-data-and-adapter.md:288` (§6); `02-3-races-and-tests.md:247` (WH-15).
- Evidence: the supplied counter wrapper read the setting and checked/opened an
  admin case on each rejection. "Unless one was opened in the last hour" specified
  no atomic gate, stable cursor, case-closure behavior or evaluator-failure path.
  Concurrent threshold crossings could all pass a check-then-insert implementation;
  a cooldown derived from open cases could disappear when one was closed.
- Fix applied: intake only increments. A checked minute scheduler reads policy once,
  evaluates fixed indexed bucket ranges in bounded catch-up batches, and locks one
  durable alert-state row. Case creation/update, cursor advance and rolling-hour
  cooldown commit atomically. Closure cannot reset the cooldown; an old evaluated
  breach cannot generate new cases. Independent auth/rotation/reconciliation cases
  are outside this generic cooldown. Invalid policy/evaluator failures fail health
  visibly. WH-15 covers 60/61, mixed reasons, concurrent evaluators, rollback,
  minute/hour boundaries, closure, saturation and deliberate below-threshold traffic.

### F03 — Stream cap lacked byte/encoding and stalled-read failure paths

- Angle: **A/B**. Severity: **High**.
- Location: `02-2-payment-flows.md:232` (§10.1);
  `02-3-races-and-tests.md:239` (WH-14).
- Evidence: the supplied stream rule handled absent/false lengths, but did not
  specify bytes versus characters, compressed/automatically decompressed content,
  oversized chunks, invalid UTF-8, malformed lengths, stream interruption or a
  receipt deadline. A below-cap slow stream could retain an invocation indefinitely.
- Fix applied: byte counts precede chunk retention, HMAC uses the exact capped bytes,
  strict UTF-8 preserves their representation, compressed input is refused before
  decompression, and ingress must prove no earlier full buffering/decompression.
  Explicit method/framing/encoding/interruption/deadline responses have fixed counter
  reasons. WH-14 covers 65,535/65,536/65,537 bytes, multibyte text, large/split chunks,
  false lengths, disconnects and a slow stream. The proposed deadline and encoding
  choices are in §17 item 15, awaiting approval.

### F04 — No verified maximum supported the cap for every subscribed event

- Angle: **B/C**. Severity: **Medium**.
- Location: `02-0-overview.md:172` (§16 item 3),
  `02-0-overview.md:244` (§17 item 15); WH-14.
- Evidence: item 15 justified the cap by saying payment messages were a few KB, but
  §10 also dispatches charges, refunds, vendors and settlements. The text supplied
  no verified maximum or fixture gate for all those families. The overview also
  promised refusal "before it is read", which is possible only for a declared
  over-limit length; a missing/false length necessarily needs a bounded read.
- Fix applied: removed the unsupported size assertion, distinguished declared-length
  refusal from streamed enforcement, and required all subscribed genuine fixtures
  plus actual ingress verification at slice 4. A genuine over-cap fixture returns
  the proposal for review; it cannot silently bypass the limit or be called covered.
- Not fixed as a provider fact, because external/provider checks are forbidden in
  this round. The gate is explicit and remains unrun.

### F05 — Removing rejected rows left recovery evidence and ownership implicit

- Angle: **A/B/C**. Severity: **High**.
- Location: `02-2-payment-flows.md:679` (§13.4 step 5),
  `02-0-overview.md:346` (§19); `02-3-races-and-tests.md:219` (WH-10),
  `02-3-races-and-tests.md:262` (WH-16).
- Evidence: no remaining section explicitly required storing a rejected row, so
  restoring such rows was unwarranted. However, §13.4/WH-10 promised recovery of an
  affected payment without specifying how to identify the affected interval once
  individual rejected deliveries were gone. Generic minute/reason counts cannot
  identify a real delivery, signing key, order, fee, refund or settlement. §11's
  ordinary poll also retires orders after its safe handover.
- Fix applied: record the trusted rotation mode/time/cutoff and recovery coverage,
  with no secret; enumerate affected known orders even after poll retirement, and
  recover other families through their owning independent provider sources. Use the
  last proven coverage point after an outage. Zero counts or a closed alert cannot
  justify D-68 restart. Expanded WH-10 and added WH-16 with explicit receiver owners.
  SDD 03's existing independent-fee-source live gate is retained explicitly.
- Individual rejected-payload forensic evidence is deliberately unavailable. That
  tradeoff is stated; recovery does not pretend counters can reconstruct it.

### F06 — Service-only wrappers did not fully specify the bypass boundary

- Angle: **A/B**. Severity: **High**.
- Location: `02-1-data-and-adapter.md:253` and
  `02-1-data-and-adapter.md:280` (§6); `02-3-races-and-tests.md:395` (SE-01).
- Evidence: the grants paragraph revoked public/client table privileges, but left
  direct service-role table access and underlying-function EXECUTE unspecified.
  RLS does not constrain a role that bypasses it. The intake wrapper was merely
  "called only for a verified message", without its own size/envelope consistency
  checks. These omissions could permit an integration to bypass named wrappers.
- Fix applied: explicit direct-table/direct-internal-function revocations, owner
  access through named checked wrappers, and structural intake checks. The wrapper
  now receives the exact signed timestamp text to check its digest binding; it
  validates type/time/body/key consistency and byte size. Retry arrival time and
  candidate ID may differ without changing the stored first event. SE-01 covers
  direct-access denials, bounded counter inputs and inconsistent envelopes.
- The trusted verifier still owns HMAC verification. Service-credential compromise
  is not solved by structural checks, and the SDD now says so rather than presenting
  wrappers as proof against a compromised trusted server.

### F07 — Admin recovery needed explicit limits and negative tests

- Angle: **A/B/C**. Severity: **High**.
- Location: `02-1-data-and-adapter.md:312` (§6),
  `02-2-payment-flows.md:613` (§13.2); `02-3-races-and-tests.md:409` (SE-07).
- Evidence: §13.2 and §19 named checked enquiry/answer commands and audit, but did
  not specify action/attempt/case binding, changed replay rejection or protection
  from resetting deadline fields. SDD 01 §5.0 already requires a checked admin actor,
  and §5.9/§5.10 restrict timer/failed-conversion recovery. D-68 restricts restart.
- Fix applied: carried those existing authority/replay/window rules into SDD 02's
  boundary, with server-stamped first answer time and immutable D-78 clocks. Recovery
  cannot inject checks, mark a signature valid, edit counter cooldowns, bypass a
  fresh refunds read/CF-A35 or restart as a non-owner. Added SE-07; the real admin
  endpoint authentication remains an SDD 08 acceptance responsibility.

### F08 — PO-10 prescribed the wrong late-payment result and duplicate identity

- Angle: **B/C**. Severity: **High**.
- Location: `02-3-races-and-tests.md:292` (PO-10);
  `02-0-overview.md:302` (§19).
- Evidence: supplied PO-10 said a closed checkout without an order always gets a
  refund and "No order is created". SDD 01 `01-2-checkout-commands.md:54` (§5.0) returns
  either `converted` or `refund_requested`; its `:309` (§5.6) converts an expired
  reservation when all stock is free, subject to its listed exceptions (D-06/D-84,
  D-97/D-98/D-85). "If the checkout converted it is a duplicate" also failed to
  distinguish the same counted receipt from a distinct extra success, and missed a
  duplicate after an amount mismatch with no order (§13.2).
- Fix applied: PO-10 separately tests late conversion, shortage/cancellation/pause/
  same-cart refund branches, ordinary-pause controls, counted-receipt replay,
  distinct extra successes including after mismatch, and first-success precedence.
  §19 gives the exact four-argument SDD 01 calls/answers and verification-time rule.
  Day 60 creates no new refund policy. Receipt/sale/refund/watch identities stay intact.

### F09 — An overlapping look-back alone did not prove no-gap coverage

- Angle: **B/C**. Severity: **High**.
- Location: `02-0-overview.md:313` (§19),
  `02-2-payment-flows.md:395` (§11.2); `02-3-races-and-tests.md:307` (PO-11).
- Evidence: "begins no later than where ... 60 days end" named no time field,
  complete source, durable cursor, failed-run catch-up or old-order enumeration.
  CF-65 gives no fixed late-success bound. A rolling creation-date scan can lose an
  old order whose payment changes today. The existing "healthy" handover also did
  not say how already-cleared poll rows recover after reconciliation later fails.
  SDD 03 §6/§8/§10 list runs, run records and broad test headings, not these mechanics.
- Fix applied in SDD 02: explicit source/pagination/retention/time-field proof,
  overlapping durable coverage, retry ownership, unknown-order case ownership,
  old-order change coverage or continued enumeration, and checked health evidence.
  Polling continues/resumes for affected cleared rows on absent/stale/failed health,
  preserving its original window anchor. Added PO-11 and strengthened PO-10;
  recording stubs cannot authorize retirement.
- Not fixed in SDD 03, because edits there are prohibited. Its full source/cursor/
  health/repair contract and real integration tests are still required before this
  safety net exists; a statement in SDD 02 does not implement that dependency.

### F10 — Reconciliation could skip corrections on already-classified payments

- Angle: **B/C**. Severity: **High**.
- Location: `02-2-payment-flows.md:108` (§9.1),
  `02-2-payment-flows.md:193` (§9.3 step 3); §19 and PO-11.
- Evidence: supplied §19 routed only payments "not recorded or not classified".
  A late automatic reversal of the counted success is neither: it needs §13.5 and
  §13.2, which §10.3 explicitly called for auto-refund webhooks but the new daily
  handover did not explicitly invoke. A missing/rejected webhook could therefore
  leave a classified receipt's correction undiscovered or unapplied after day 60.
- Fix applied: every trigger's current fresh refunds evidence feeds the watches and
  counted-payment correction under existing locks/idempotency. Daily discovery also
  owns new reversals/corrections on already classified payments. PO-11 proves repair
  without a webhook; HC-01 covers one-time reversal/loss posting and failed handovers.

### F11 — New tests/cleanup and receiving contracts lacked complete acceptance routing

- Angle: **B/C**. Severity: **Medium**.
- Location: `02-0-overview.md:280` (§18),
  `02-0-overview.md:332` (§19); `02-2-payment-flows.md:332` (§10.6), WH-12.
- Evidence: slice 4's test list stopped at WH-13, omitting new WH-14/15. Counter
  deletion had no explicit capped wrapper/rollback/boundary test. §19's receiving
  rows had no consistent owner/proof mapping; WH-08's generic handover assertion did
  not prove receiver idempotency, failure ownership or rotation recovery. SDD 03's
  outline does not define receipt-versus-sale posting lines or its repair interface.
- Fix applied: scheduled alert/cleanup work and WH-14/15 are in slice 4; PO-10/11 are
  receiver gates with caller/fallback proofs first. Cleanup has capped body/counter
  batches, retained alert state and failure/boundary tests. Added the owner/proof
  matrix for every §19 boundary and HC-01/02/03 for ledger/refund/split receivers.
  Stubs prove only calling contracts; receiver integration and existing live-money
  gates remain mandatory. No existing safety rule or test definition was removed.

### F12 — Open-item wording counted closed placeholders as unapproved proposals

- Angle: **B**. Severity: **Low**.
- Location: `02-0-overview.md:195` (§16 item 8).
- Evidence: the supplied wording said "15 proposed settings and choices", but
  §17 items 4 and 8 are explicitly already D-105/D-104. Numbered entries are not the
  same as remaining unapproved proposals.
- Fix applied: refers to the remaining proposals, explicitly excludes those two
  closed items, and preserves separate business-decision, proposal, provider-check
  and whole-SDD approval states. No decision register was edited.

### F13 — Timestamp age validation did not rule out negative ages

- Angle: **A/B**. Severity: **Medium**.
- Location: `02-2-payment-flows.md:260` (§10.1),
  `02-0-overview.md:247` (§17 item 15); WH-02.
- Evidence: the age rule specified the 24-hour maximum and malformed-timestamp
  rejection, without a future-time boundary. A comparison of age only to a maximum
  can accept negative ages. A signature alone does not define a clock-skew policy.
- Fix applied as a proposal: explicit rejection of future timestamps, with zero
  future-skew allowance called out in item 15 and a controlled-clock test in WH-02.
  It does not claim D-114 approved that new boundary; owner approval remains required.

## Removed-design sweep

Searched all four files for `signature_ok`, `p_signature_ok`, `random key`, and
rejected event/row wording. The three removed tokens have **zero matches**. Remaining
rejected-row references explicitly say that those rows/IDs/bodies do not exist and
cannot be a recovery queue. Provider refund status `REJECTED` in §13.2 remains valid
and is unrelated to rejected webhook intake. No rejected event persistence was restored.

## Changes needed in other SDDs — not edited

1. **SDD 01:** no business-rule or §5.0 contract change is needed. Its `converted`/
   `refund_requested` late outcomes are the authority; the defect was in PO-10.
   When implementation is approved, run the shared PO-10 fixtures and SE-07 recovery
   negatives against its existing commands. Preserve D-06/D-84, D-85, D-97/D-98,
   payment-key category 5 refunds, lock order and the original failed-conversion window.
2. **SDD 03 (§3, §6, §8, §10):** write explicit receipt/sale/reversal/charge/loss/case
   interfaces and posting lines with the stable keys/lineage in §19; implement the
   independent discovery source and its pagination/retention/change-time proof,
   durable cursor, overlap, retries, old-order coverage, checked health reader and
   retirement/resumption contract. Accept PO-10/11, HC-01 and WH-16 against the real
   receiver. A separate verified source for lost charge facts remains required
   before live activation. Do not assume the outline already supplies these pieces.
3. **SDD 04 (§3 and recovery/test sections):** carry category 6/6a's attempt identity,
   exact amount/currency, stable obligation keys and pending/unknown cap accounting
   into the full interfaces. Carry SDD 01's category 5 payment key. Enforce CF-A35 in
   every real sender immediately before live submission, including already-queued
   intents and admin recovery; coordinate a later automatic reversal without another
   refund. Add HC-02 and WH-16 recovery proofs. Existing status-poll text is useful
   but does not replace the full receiving contract.
4. **SDD 05 (§3/§4 and test section):** make the converted-order-only split contract
   explicit, with business-key idempotency and retry ownership; define independent
   lost vendor/settlement recovery over the trusted rotation/outage interval.
   Add HC-03 and WH-16 integration proofs. Existing daily vendor reads/weekly
   settlement reconciliation must prove the affected interval rather than imply
   that rejected webhook rows can be replayed.
5. **SDD 08 (when written):** implement checked enquiry/answer/requeue/recovery/restart
   actions and the bounded alert/case projection. Preserve immutable D-78 clocks,
   owner-only D-68 restart, SDD 01 recovery windows and the CF-A35 block; implement
   SE-07 and rotation-restart negatives. Rejection counters never authorize money or
   prove reconciliation is clean.
6. **SDD 09 (when written):** carry every §15 test ID, receiver owner and acceptance
   stage into the test plan; separate caller recording-contract evidence from real
   integration/load/provider evidence.

## Verification and session close

- `git diff --check`: PASS.
- Existing local Phase 9 continuity validator: PASS (123 Markdown files, 62 required
  phase files; document-size advisories only). This checks repository continuity;
  it does not prove the new payment design works.
- Focused local checks: four SDD files; all Markdown file links resolve; removed
  design tokens absent; 113 unique test definitions. All 107 original definitions
  remain; six added: WH-16, PO-11, SE-07, HC-01, HC-02, HC-03.
- Runtime, database, sandbox, ingress and flood tests: NOT RUN. The changes specify
  future acceptance tests; no implementation or migration was written. No Python
  tests were run.
- Size/cohesion assessment: part 1 remains the data/access/adapter topic; part 2
  remains the payment flow contract; part 3 remains races/tests. Keeping these
  cohesive topics preserves the existing cross-part section references. No safety
  content was pruned or file split just to satisfy a line target.
- Phase 9 current state and its unrelated logs were left unchanged. This report
  records the exact document-only scope because the user restricted writes to SDD 02
  and this excluded report; the Phase 7/8 folder does not yet have its planned tracker.
- No external service, Cashfree or Supabase call; no database, Storage, provider,
  permissions or deployment mutation. No staging, commit or push. The four SDD 02
  files remain modified and unstaged; the pre-existing untracked
  `p78sdd02review.sha256` was preserved. This report is excluded by `p78outside/`.

DONE
