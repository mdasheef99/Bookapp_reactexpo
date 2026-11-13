# Pilot Cut Review, Round 4: Slice Division (Codex Sol, 2026-11-13)

Copied unedited. Applied in the [overview](./00-pilot-cut-overview.md), §7 and §8.

## Verdict

**Rework needed.** P5/P6 contain a dependency cycle, and the early slices can expose checkout before its completion and recovery paths exist. The scope can remain unchanged, but §7 needs clearer ownership, smaller units, and an explicit cutover boundary.

## Findings

1. **Major — P5/P6: worker handlers precede their commands.** P5 promises every kept §8.1 handler, including acceptance, missing-outcome and preparation handlers; their commands arrive in P6. P6 nevertheless needs P5. Evidence: overview §7 and [SDD 01 §8.1][timers]. **Change §7:** P5 supplies checkout/payment handlers; P6 adds each order command and its worker handler together. Include P6’s worker deployment approval.

2. **Major — P2–P4: the app can lose its working order path.** [SDD 01 §15][rework] closes old submission to new carts at reservation implementation. P2 supplies only reservation; P3 opens checkout, whose return calls the verification endpoint built in P4. Conversion then precedes operational checkout timers and store actions. Owner attendance does not complete these missing paths. **Change §7:** merge early UI as inactive, available through controlled test entry; move normal-route activation and old-submit closure/revocation together to P6, after the complete pilot path works.

3. **Major — P3: admin cases precede delivery.** The adapter opens `auth_failed` cases; start recovery can open unresolved-creation cases. Cut 02 §11.5 also opens a case on the third rate-limited read. Overview §5 postpones notices, digest and closing until P4. **Change §7:** move case delivery, digest checks, closing, and their admin security foundation into P1b, before any provider-facing slice.

4. **Major — P4/P5: verification needs duplicate-watch logic early.** Cut 02 keeps §13.5, which calls the duplicate watch within the counted-payment correction transaction; that watch arrives only in P5. P4’s duplicate refund-obligation scope also depends on the watch’s deadlines and recorded answers. Evidence: [SDD 02 §§13.2/13.5][flows]. **Change §7:** build callable watch transitions and enquiry/answer scripts with verification in P4b; leave scheduled dispatch to P5c.

5. **Major — P1–P6: retained infrastructure and screens lack explicit owners.** P1 names registration, but does not clearly assign task-scoped claim/completion, atomic replacement, resolved-task guards, notification validators/routes, or reconciliation exemptions. These are retained by cut 01 §3.9. Customer Waiting/result/detail screens and commerce projections also lack clear ownership beyond minimal cart/Paying and receipt. Evidence: [SDD 01 §3.9][schema] and cut 01 §12. **Change §7:** assign framework changes to P1b; checkout reads to P2, payment reads to P3, customer results/order reads to P4b, and owner reads/pause controls to P6.

6. **Major — P2–P7: kept tests need staged completion and named exits.** The original build orders explicitly defer cross-slice assertions; the replacement loses that mapping. PA-04/09/11 need P4 verification; E-13/E-24 need P5 requeue; E-17/E-21/O-04 finish only with P6 handlers; PC2-01’s backlog assertion needs P7. SE-06’s rotation rehearsal has no effective slice owner, and HC-01/02 have no named acceptance exit. Evidence: [01 §19][build1], [02 §18][build2], and both cuts §2. **Change §7:** name each test’s initial and final owning slice; run PC2-05 as each script arrives, complete PC2-03 after P6 refund paths, and assign rotation to P7.

7. **Minor — P1/P4/P5: split by responsibility.** Phase 9 history separates schema, worker and app units, including 8a-1…5 and 8c-1a/1b. Its units can still be substantial: `2ce9615` changes 12 files with 873 additions; ISBN unit `1d4f80e` changes 41 with 2,160 additions. **Change §7:** separate schema/framework, conversion/verification, and expiry/webhook/poll. P0 and P7 each have a meaningful acceptance boundary and should remain separate branches.

8. **Minor — P0/P1/P4/P5: complete the dependency/gate columns.** Overview §6 requires receiver interfaces before stand-ins, but P1 lists only P0. P4 needs its own deployment yes for `commerce-payment-check`; §3 already requires this globally. Phase 9’s prerequisites before P2, the phone gate after verification, and the webhook-version gate at endpoint acceptance are correctly placed. **Change §7:** name receiver-contract readiness, repeat deployment gates at every affected unit, and carry the signing/version/ingress and planned-version termination checks into their respective split units.

## Proposed slice table

All units run their applicable schema, security, contract and race checks. Earlier assertions may use fixed-contract test doubles; complete integration assertions belong to the last prerequisite.

**D** = a separately recorded owner yes for each Edge Function deployment or redeployment.

| Slice | Contents | Needs | Rough size |
|---|---|---|---|
| P0 | Disposable Postgres, test clock, SQL runner and CI checks | Cut approval; Day 1 recorded | M |
| P1a | Commerce/payment schemas, settings, constraints, transitions, grants | P0 | L |
| P1b | Task framework, validators/routes, cleanup exemptions, stand-ins; cases, notices, digest, delivery check and closing | P1a; SDD 03/04 interfaces agreed | L |
| P2 | Reservation/cancel, stock helpers, cart guards and checkout reads; inactive cart UI | P1b; both Phase 9 stock prerequisites | M |
| P3 | Adapter, start/recovery, shared budget, payment projection; inactive Paying/web checkout | P2; provider contract checks; D | M |
| P4a | Conversion, late resolution, schedule calculations, receipts, failed-conversion refund script | P3; payment-evidence test double | L |
| P4b | Verification, wrong amounts, duplicate/correction/watch commands and scripts; customer results/detail; real-phone verified-return gate | P4a; D | L |
| P5a | Reservation/grace expiry, locked evidence wrapper, real termination, checkout worker handlers and requeue script | P4b; planned-version termination checks; D | M |
| P5b | Webhook intake, atomic processing/finish, deferred event handling, worker branch | P5a; signing/version/ingress gates; D | M |
| P5c | Poll leases, scheduled start recovery and duplicate watch; poll/webhook races and recovery tests | P5b; D | M |
| P6 | Acceptance, missing books, preparation/ready, matching handlers, store screens/pause controls; coordinated app cutover | P5c; complete customer path; D | L |
| P7 | Remaining reconciliation/backlog scans, rotation rehearsal, final cross-slice proofs; unattended-use gate | P6; rotation deployment yeses | M |

## Unsure

- Actual Phase 9 prerequisite application, receiver-interface readiness and external gate results remain unverified.
- Size ratings estimate implementation scope; Phase 9 examples establish precedent, not a fixed size ceiling.
- Review only: no files changed, temporary files written, tests run, or network calls made.

[timers]: ../01-checkout-reservation/01-4-timers-stock-notices.md:13
[rework]: ../01-checkout-reservation/01-4-timers-stock-notices.md:309
[flows]: ../02-cashfree-payments/02-2-payment-flows.md:569
[schema]: ../01-checkout-reservation/01-1-data-and-settings.md:198
[build1]: ../01-checkout-reservation/01-0-overview.md:245
[build2]: ../02-cashfree-payments/02-0-overview.md:261