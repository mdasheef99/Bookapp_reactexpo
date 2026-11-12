# Phase 7/8 Payments and Fulfilment: SDD Folder

**Status:** skeletons for owner review (2026-11-10). Nothing here is approved, and nothing
here authorizes code, migrations, or provider calls.
**Lane entry:** [handoff](../PHASE-7-8-HANDOFF.md). Business rules:
[decision register](../PHASE-7-8-decision-register.md).

A skeleton lists the sections, states, tables, timers and open points of an SDD. It is
reviewed before the full SDD is written (handoff §5, process addition 1).

| # | SDD | State | Reviewers when written in full |
|---|---|---|---|
| 00 | [Master and state model](./00-master-state-model-sdd.md) | Skeleton | Sol, DeepSeek, Muse, Sonnet |
| 01 | [Reserve-first checkout and paid-order acceptance](./01-checkout-reservation/01-0-overview.md) (six parts; [single-file reference copy](./01-checkout-reservation-sdd.md)) | Approved by the owner 2026-11-11 (D-95 to D-103 applied) | Sol, DeepSeek, Muse, Sonnet |
| 02 | [Cashfree payments and webhooks](./02-cashfree-payments/02-0-overview.md) (four parts; [skeleton reference copy](./02-cashfree-payments-sdd.md)) | Full draft 2026-11-11; review round 1 done and fixed (Muse, DeepSeek, Sol, Luna); round 2 by Codex Sol; round 3, outside review and Sol's three-angle review done; **approved by the owner on 2026-11-12** (with its §17 choices); no code authorised | Sol, DeepSeek, Muse, Sonnet |
| 03 | [Ledger and reconciliation](./03-ledger-reconciliation-sdd.md) | Skeleton | Sol, DeepSeek, Muse, Sonnet |
| 04 | [Refunds, returns, recovery, chargebacks](./04-refunds-returns-recovery-sdd.md) | Skeleton | Sol, DeepSeek, Muse, Sonnet |
| 05 | [Store money: vendors, Easy Split, payouts](./05-store-money-easy-split-sdd.md) | Skeleton; not approved until its Cashfree facts are tested on sandbox | Sol, DeepSeek, Muse, Sonnet |
| 06 | [Pickup](./06-pickup-sdd.md) | Skeleton | Sol, Muse |
| 07 | Bike delivery | Not started: waits on the provider check | Sol, Muse |
| 08 | Admin server functions and console; customer support intake (D-51) | Not started | Sol, Muse |
| 09 | Security baseline and test plan | Not started | Sol, DeepSeek, Muse, Sonnet |

Every Cashfree fact in these SDDs cites a CF ID from the
[Cashfree fact record](../PHASE-7-8-cashfree-replies.md), which gives its source. A
Cashfree statement without a CF ID is a defect.

Not yet created: `TRACKER.md` with the migration ledger (handoff §10 step 1).
