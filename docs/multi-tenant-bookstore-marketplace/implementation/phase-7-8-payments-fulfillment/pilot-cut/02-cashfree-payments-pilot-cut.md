# Pilot Cut of SDD 02: Cashfree Payments, Webhooks and Verification

**Created:** 2026-11-12. **Revised:** 2026-11-13 after review rounds 1 to 4 (overview §8).
**Status:** approved by the owner on 2026-11-13 (D-119); grants no authority by itself.
**Cuts:** [SDD 02](../02-cashfree-payments/02-0-overview.md) (approved 2026-11-12), which
is not changed. Rules for reading this file, the never-cut list (N-01 to N-13), admin
cases (§5), stand-in keys (§6) and the decisions it would revisit are in the
[overview](./00-pilot-cut-overview.md). Sandbox only (overview §1).

Classes: **Keep** (build as the SDD says), **Simplify** (build as the SDD says except the
stated change), **Detect** (not automated: a check opens an admin case and a person
resolves it), **Later** (not built for the pilot; gate stated).

**Admin scripts.** Where this file or the SDD 01 cut says "admin script", it means an
audited script run by the owner over a dedicated server function (admin console option B).
The pilot's scripts: duplicate enquiry recorded, duplicate answer recorded (§13.2),
failed-conversion refund and timer requeue (SDD 01 cut), case close and digest
(overview §5). For every script:

- the script connects as a dedicated admin-script database role whose secret lives only
  on the owner's machine outside the repository, is never committed, printed or logged,
  and can be revoked on its own; the owner is the only holder until a second admin exists;
- the server function is in `marketplace_sec`, with execute revoked from `public`, `anon`
  and `authenticated` and granted only to the admin-script role; no client path reaches it;
- the function checks the platform-admin actor named in the call against the admin list,
  and rejects a forged or unlisted actor and any unlisted action before any other call;
- the function takes a fixed command ID; a replay with the same inputs does nothing, and a
  replay with changed inputs is refused (SDD 01 §5.0);
- the function stamps the server time after its locks; no script input can set or reset a
  deadline, an enquiry time or an answer time;
- every call writes an audit row (actor, action, entity, reason, result); the reason and
  the script output carry IDs and amounts only, never personal data (overview §5);
- no script bypasses the CF-A35 block (N-08), the `kept_by_cashfree` mark, or a fresh
  Cashfree read where the SDD requires one.

---

## 1. Sections

| SDD 02 section | Class | Pilot rule |
|---|---|---|
| §1 Rules | Keep | |
| §2 Cashfree facts | Keep | |
| §3 What exists | Keep | Reference only; re-check at slice start |
| §4 intro: `cashfree_api_budget` table | Keep | Needed by §11.5 |
| §4.1 `payments` | Simplify | All columns kept. `next_poll_at` is never cleared after the first windows (§11.2) |
| §4.1.1 Payment states | Keep | |
| §4.2 `payment_attempts` | Keep | Including every duplicate-watch column (§13.2) and `kept_by_cashfree` (§13.5) |
| §4.3 Webhook events and private bodies | Keep | N-02 |
| §4.3a Rejection counters and alert | Later | Gate: before live payments. Until then a rejected message is answered as §10.1 says and nothing is counted |
| §4.4 `provider_checks` | Keep | |
| §5 Settings | Simplify | `payment_poll_live_seconds` = 60 (one pass a minute). New `payment_poll_batch_max` = 25 (payments claimed per pass, equal to the per-minute read cap in §11.5). Leave out `webhook_rejections_alert_per_minute` until §4.3a. `payment_poll_daily_days` is not used: daily polling has no end (§11.2). All other settings kept, including the duplicate business days, `cashfree_reads_per_minute` and `india_bank_holidays` |
| §6 Access | Simplify | Every rule kept (N-10). Not built: `commerce_count_webhook_rejection`, `commerce_check_webhook_rejections` (§4.3a) and `commerce_purge_webhook_bodies` (§10.6). Admin-script functions follow the rule at the top of this file |
| §7.1 One adapter module | Keep | N-09 |
| §7.2 Operations | Keep | Including `verifyWebhook`'s previous-secret window (§13.4) and HTTP 429 returning Cashfree's wait time |
| §7.3 Mapping | Keep | |
| §8 Starting a payment | Keep | |
| §8.1 Web checkout | Keep | The real-phone payment and verified return gate pilot slice P4b |
| §9.1 Triggers | Keep | |
| §9.2 Reading Cashfree | Keep | Every read takes a permit (§11.5) |
| §9.3 Applying the answer | Simplify | Kept in full (N-01, N-03), except that postings go to SDD 03's recording stand-in and refund obligations to SDD 04's, with the overview §6 keys |
| §9.4 What the customer sees | Keep | |
| §10.1 Endpoint | Simplify | Every check kept (N-02), including the 64 KB byte cap, refusal of compressed bodies and the 10-second receipt deadline. No counter call on rejection |
| §10.2 Message key | Keep | |
| §10.3 Processing | Simplify | Payment events and `AUTO_REFUND_STATUS_WEBHOOK`: kept (§9.2, §9.3, the watch, §13.5). `PAYMENT_CHARGES_WEBHOOK`: handed to SDD 03's stand-in, keyed `charge:<cf_payment_id>`. `REFUND_STATUS_WEBHOOK`, vendor and settlement events: stored verified and marked `processed` with code `deferred_type` until SDD 04 and SDD 05 exist; those SDDs recover the facts from Cashfree reads (gate WH-16, overview §6) |
| §10.4 Retries | Keep | |
| §10.5 Staleness and retries | Keep | |
| §10.6 Deleting old bodies | Later | Gate: before live payments, and in any case before the first body is 180 days old |
| §11.1 Poll runner | Simplify | One pass a minute, not three. Each pass claims at most `payment_poll_batch_max` payments, oldest `next_poll_at` first, and still needs a permit for every read. Claims, leases and lease tokens kept. The daily reconciliation opens one case when the oldest overdue `next_poll_at` is more than one hour late; the digest reports its age |
| §11.2 Schedule | Simplify | Live checkout: every minute. After close or conversion: every 5 minutes for 2 hours, hourly for 7 days, then daily with no end (overview §3 item 3). `next_poll_at` is never cleared, so the discovery, cursor and health machinery SDD 02 §19 hands to SDD 03 is not needed for the pilot. Cashfree has not said how long an order stays readable or whether a 404 is final (CF-A27, CF-A36), so a poll read of an order we created that answers `not_found` changes no payment state, keeps the order on the daily poll and opens one admin case |
| §11.3 Cashfree unreachable | Keep | N-06 |
| §11.4 Long-unconfirmed closed payments | Keep | Already detect-and-alert |
| §11.5 Rate limits | Simplify | Kept in full: shared permit counter for every read, persisted `retry_not_before`, priority for customer checks, webhooks and expiry work over poll claims. Added: when a read records its third `provider_checks` row with outcome `rate_limited` within one hour, that same transaction opens one admin case |
| §11.6 Start recovery | Keep | N-06 |
| §12.1 Expiry provider steps and the locked evidence wrapper | Keep | N-06 |
| §12.2 `terminate_provider_order` | Keep | |
| §13.1 Wrong amount | Keep | Category 6 obligation recorded automatically with key `wrong_amount:<cf_payment_id>`, to SDD 04's function or stand-in. The CF-A35 block and the attempt-level cap apply (N-08) |
| §13.2 Duplicate success | Simplify | Kept in full, including the automatic category 6a obligation keyed `duplicate:<cf_payment_id>`. Only change: SDD 08's checked enquiry and answer commands are built as admin scripts |
| §13.3 What never happens | Keep | |
| §13.4 Key rotation | Keep | Manual runbook as written, including the 24-hour previous-secret window: Cashfree signs each webhook with the secret active when the event was sent (CF-A24) and retries at 2, 10 and 30 minutes (CF-80), so retries after a swap still carry the old signature. On known or suspected compromise the previous secret is disabled at once, as the SDD says. Restart only by the owner after clean reconciliation (D-68) |
| §13.5 Cashfree gives back the counted payment | Keep | Including the server-enforced `kept_by_cashfree` mark that every refund path refuses (N-08) |
| §14 Races | Simplify | §2 below |
| §15.1 Worked examples | Simplify | All stand; example 7's poll runs once a minute, not 20 seconds later |
| §15.2 Tests | Simplify | §2 below |
| §16 Open points and checks | Keep | The sandbox checks per slice still apply; the webhook-version check gates pilot slice P5b |
| §17 Choices | Simplify | Items 2 and 12: replaced by §11.1 and §11.2 above. Item 15: size and time limits kept, counters and alert Later. Item 9: Later with §10.6. Others unchanged, with SDD 08's part done by admin scripts |
| §18 Build order | Replaced | By the pilot slices in the overview, §7 |
| §19 Handovers | Simplify | SDD 01: unchanged. SDD 03: receipts, sales, reversals, `duplicate_loss` and charges go to the recording stand-in; discovery, cursor and health are not needed (§11.2). SDD 04: categories 5, 6 and 6a recorded automatically through its function or stand-in with the overview §6 keys. SDD 05: Later. SDD 08: replaced by admin scripts. Receiver gates WH-16 and HC-03 move to SDD 03, 04 and 05 (overview §6) |
| §20 Traceability | Keep | Decisions changed by this cut are listed in the overview, §4 |

## 2. Tests (SDD 02 §15.2 and §14)

**Kept:**
- Adapter: AD-01 to AD-08.
- Payment start: PA-01 to PA-14.
- Verification: VE-01 to VE-10, VE-11b, VE-13 to VE-21. VE-12 without its admin-retry
  part.
- Webhooks: WH-01 without its counter assertions, WH-02, WH-02a, WH-03 to WH-07, WH-09,
  WH-10, WH-11, WH-13, WH-14 without its counter-failure case. WH-08 for charges only; refund,
  vendor and settlement events are PC2-04.
- Poll and termination: PO-02 to PO-09, TE-01 to TE-03, TE-03a, TE-04 to TE-08. PO-01 with
  "never clears `next_poll_at`" in place of "then clears".
- Wrong amount and duplicates: DU-01 to DU-16, with the enquiry and answer in DU-06 and
  DU-11 recorded by the admin scripts.
- Schema and security: ST2-01 to ST2-06, SE-01 to SE-04. SE-05 for storage and access
  only. SE-06 as one rehearsal of the manual runbook on sandbox. SE-07 applied to every
  admin script (PC2-05).
- Receiving contracts: HC-01 and HC-02 against the recording stand-ins.
- Races, each in both orders: RX2-01 to RX2-06, RX2-08 to RX2-11, RX2-13 to RX2-16.

**Later, with the section they test:**
- Rejection counters and flood (§4.3a): WH-15, and the counter parts of WH-01 and WH-14.
- Body deletion (§10.6): WH-12 and SE-05's deletion part.
- SDD 03 coverage handover (not needed while polling never ends): PO-10, PO-11.
- D-81 cancellation and failed-conversion retry (SDD 01 cut): VE-11a, RX2-07, RX2-12.
- Receiver gates, run with SDD 03, 04 and 05 (overview §6): WH-16, HC-03.

**Added by this cut:**
- PC2-01 with the test clock, a success first seen on day 61 and on day 400 after close is
  found by the daily poll and resolved once through SDD 01 §5.6; `next_poll_at` is never
  cleared. The test asserts only the recorded refund obligation: day 400 is past Cashfree's
  refund window (CF-20, CF-69), so SDD 04 pays it by another route, and no pilot code
  assumes Cashfree's refund API will accept it. A backlog of more than 25 payments drains over several passes, and the daily
  reconciliation opens one case when the oldest overdue `next_poll_at` is more than one
  hour late.
- PC2-02 a 429 changes no payment state; every caller waits at least the given time; the
  third `rate_limited` check within an hour opens one admin case, and a fourth while it is
  open opens no second case.
- PC2-03 every refund path refuses an attempt marked `kept_by_cashfree`.
- PC2-04 refund, vendor and settlement webhooks are stored verified, marked
  `deferred_type`, and cause no money effect; a charges webhook posts once to the stand-in
  keyed `charge:<cf_payment_id>`.
- PC2-05 each admin script (enquiry recorded, answer recorded, failed-conversion refund,
  timer requeue, case close, digest) is refused for `anon`, `authenticated`, a customer, a
  store owner and a forged or unlisted actor; refuses a changed replay; cannot set or
  reset a deadline; and writes one audit row per accepted call.
- PC2-06 a daily poll read that answers `not_found` for an order we created changes no
  payment state, keeps the order on the daily poll, and opens one admin case; a second
  `not_found` while that case is open opens no second case.
