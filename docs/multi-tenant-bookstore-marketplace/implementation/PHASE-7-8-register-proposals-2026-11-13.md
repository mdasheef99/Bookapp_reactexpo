# Phase 7/8: Register Proposals of 2026-11-13

**Status:** approved by the owner on 2026-11-13 ("Approve all 11"). Recorded in the
[decision register](./PHASE-7-8-decision-register.md) as D-116 to D-126, in the order of the
rows below. Kept as the record of what was proposed. When the owner approves a row,
it is copied into register §8 with the next free D-number and status `DECIDED`, and this
file is kept as the record. Numbers below are provisional (the register ends at D-115).

## What you are approving

| Document | What it is |
|---|---|
| [Pilot cut overview](./phase-7-8-payments-fulfillment/pilot-cut/00-pilot-cut-overview.md) | Never-cut list (§2), the five pilot changes (§4), admin cases (§5), stand-ins (§6), the 12 slices (§7), review history (§8) |
| [SDD 01 cut](./phase-7-8-payments-fulfillment/pilot-cut/01-checkout-reservation-pilot-cut.md), [SDD 02 cut](./phase-7-8-payments-fulfillment/pilot-cut/02-cashfree-payments-pilot-cut.md) | Every SDD section and test, marked Keep, Simplify, Detect or Later |
| [Pilot state model](./phase-7-8-payments-fulfillment/pilot-cut/03-pilot-state-model.md) | Tables, states, timers, settings and faults for the pilot; replaces the out-of-date SDD 00 for the pilot |
| [Build process](./phase-7-8-payments-fulfillment/BUILD-PROCESS.md) | How each slice is built and checked, the test harness, model roles |
| The rows below | What goes into the decision register |

Reviews done: Codex Sol (pilot cut), three OpenCode models, Claude Sonnet, Codex Sol
(slices), Codex Sol (test harness), Haiku (comparison with SDD 00). All findings applied.

## Rows for the register

Rows 1 to 3 were decided by the owner on 2026-11-12 and only need recording. Rows 4 to 11
need the owner's decision; each shows the recommended answer.

| # | Proposed row | Status asked | Recommended | Where it is used |
|---|---|---|---|---|
| 1 | **Test setup (owner, 2026-11-12):** Phase 7/8 tests run on a disposable local Postgres, as Phase 9's do, with one private time function that returns `clock_timestamp()` in every deployed database and can be moved only in tests; SQL suites and Edge Function checks run in CI | DECIDED (record only) | — | Pilot overview §3 item 1; build process §1.1 |
| 2 | **Edge Function deployments (owner, 2026-11-12):** each deployment or redeployment to the dev project needs the owner's explicit yes, recorded in the tracker | DECIDED (record only) | — | Pilot overview §3 item 2; build process §6 |
| 3 | **Late-payment safety net (owner, 2026-11-12):** at pilot scale the payment poll keeps reading every known Cashfree order daily with no end date | DECIDED (record only) | — | Pilot overview §3 item 3; SDD 02 cut §11.2 |
| 4 | **Pilot build scope:** the [pilot cut](./phase-7-8-payments-fulfillment/pilot-cut/00-pilot-cut-overview.md) of SDD 01 and SDD 02 is the build scope for the five-store pilot, including its never-cut list (N-01 to N-13), admin-case path and stand-in keys. Everything runs on Cashfree sandbox only until SDD 03 and SDD 04 replace their stand-ins. SDD 01 and SDD 02 stay unchanged as the full design | PROPOSED | Approve | Whole pilot cut |
| 5 | **Pilot changes to five decisions (pilot overview §4):** (a) D-95: a failed conversion is refunded by admin script; the retry option comes later; the 7-day deadline stays. (b) D-81, D-98: these pauses block new reservations only; a live checkout ends on its own timers. (c) D-43, D-53, D-25, D-103: photo checks come later. (d) D-02, D-04: alert acknowledgement and platform incidents come later; every missed acceptance is fault `platform`. (e) SDD 02 §17 items 2 and 15: one poll pass a minute; webhook rejection counters later | PROPOSED | Approve all five | Pilot overview §4 |
| 6 | **Temporary "Mark ready" (pilot overview §4):** in the pilot a store marks an order ready through a pilot-only wrapper with the same checks as Accept, instead of SDD 06's command; SDD 06's command later replaces it, and the two never run side by side; `ready_for_pickup` is the last pilot state | PROPOSED | Approve | SDD 01 cut §6.7; slice P6 |
| 7 | **Suspended store and paid orders:** a store under a D-81 pause cannot accept or mark ready an order already paid; the order times out as fault `platform` and is refunded in full automatically | PROPOSED | Approve | SDD 01 cut §3.6, §5.7 |
| 8 | **Customer data to Cashfree:** the customer's ID (without dashes) and phone number go to Cashfree to create a payment order; no name, email or address. This adds Cashfree to the recipients of the customer's phone | PROPOSED | Approve | [Pilot state model](./phase-7-8-payments-fulfillment/pilot-cut/03-pilot-state-model.md) §8; SDD 02 §7.2; DOC-1 in the documentation pass |
| 9 | **Amendment to D-46 (1):** building may start once SDD 01, SDD 02 and their pilot cut are approved. The pilot cuts of SDD 03 to SDD 06 are written during the build, each approved before the first slice that needs it; the SDD 03 and SDD 04 interfaces come before slice P1b. D-46 (2) and (3) are unchanged | PROPOSED | Approve | Pilot overview §7 |
| 10 | **Build process:** the [Phase 7/8 build process](./phase-7-8-payments-fulfillment/BUILD-PROCESS.md) (two flows by risk, model roles, test harness, gates) and the 12 pilot slices P0 to P7 | PROPOSED | Approve | Build process; pilot overview §7 |
| 11 | **Second active lane:** Phase 7/8 becomes an active lane alongside Phase 9. Each lane keeps its own branch, checkout and tracker; any migration is checked against both trackers first (AGENTS.md); Phase 7/8 slice P2 waits for Phase 9's lock-order migration and listing-trigger change | PROPOSED | Approve | ACTIVE.md, DOC-13, AGENTS.md pointer |

## After approval

1. Copy rows 1 to 11 into the register with D-numbers.
2. The documentation pass (handoff §9) brings the root specifications in line, starting
   with what the pilot touches (DOC-6, DOC-14, DOC-1, DOC-0).
3. Merge the planning branch into `main` (needs the owner's yes to push to `main`).
4. Record day 1 in DOC-13 and ACTIVE.md (D-33), with Phase 7/8 as a second active lane.
5. Start slice P0.
