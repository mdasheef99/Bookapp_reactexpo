# Phase 7/8 stage 0: Phase 6 pay-first impact check

**Date:** 2026-11-08 (read-only; no files, database, or provider changed)
**Method:** a Sonnet subagent mapped the Phase 6 migrations, worker, commerce frontend, and
tests against pay-first (BC-08, D-04, D-06, D-15, D-22, D-35); Claude re-read the key lines.
**Status:** stage 0 input for SDD 01 and slice 1, not a decision. Re-confirm on day 1.

**Corrections from Claude's check:**
- The payment-window policy bounds (1800–7200 s) are defined in
  `20260716000033_marketplace_phase6_observability.sql:96`, not in migration 0003 as cited below.
- In `20260716000012`, holds are created at store confirm by `create_bucket_transfer_holds`
  (line ~99); line ~121–122 is the release on rejection.

**Open for SDD 01:** emergency pause is now settled by D-55 (paid orders continue; the D-04
clock runs and unaccepted paid orders are refunded automatically); late-payment re-reserve design (D-06); whether paid orders stay in `store_order_requests` or
move to a separate orders table.

---

Legend: V = VERIFIED (I read the lines), I = INFERRED (grep/names/counts only). Paths: M = supabase/migrations/20260716, prefix `marketplace_phase6_` omitted. Code paths under src/features/marketplace/commerce = C/.
Scale: 39 phase6 migrations, 5,947 SQL lines; commerce frontend 1,501 lines; tests 3,369 lines.

## 1. State machine as built (V unless noted)
Table `store_order_requests`, CHECK at M0000001_order_request_core.sql:73-78 (12 states). Cart: active/submitted/replaced/abandoned (:10).
| From | To | Command (actor) | Defined in |
|---|---|---|---|
| (cart) | submitted | submit_order_request (customer) | M0000010:92-168; starts reminder+expiry tasks :168-175 |
| submitted | store_reviewing | start_store_review (owner) | M0000012:~57 |
| store_reviewing | payment_ready | confirm_full: firm holds, payment_expires_at | M0000012:105-111 |
| store_reviewing | awaiting_customer_decision | confirm_partial: soft holds, acceptance_expires_at | M0000012:112-117 |
| store_reviewing | unavailable | mark_items_unavailable | M0000012:~131 |
| submitted/store_reviewing/awaiting_clarification | store_rejected | reject_order_request | M0000012:~148 |
| store_reviewing <-> awaiting_clarification | request_clarification / provide_clarification | M0000014 (I for exact edges) |
| awaiting_customer_decision | payment_ready | accept_confirmed_changes (customer): promotes soft->firm | M0000018:4-97 |
| submitted/reviewing/clarif./decision/paused/payment_ready | customer_cancelled | cancel_order_request | M0000018:99+ |
| submitted/store_reviewing | expired | expire_confirmation (task) | M0000027:44 (I: sets expired) |
| awaiting_clarification | expired | expire_clarification | M0000022 (I) |
| awaiting_customer_decision | expired | expire_customer_decision | M0000019:56-121 |
| payment_ready | payment_ready_expired | expire_payment_ready | M0000019:56-121 |
| any open | paused_for_emergency_closure and back / expired | pause/resume/expire_emergency_closure_pause | M0000023 |
| any open | platform_cancelled | support_cancel_request, cancel_for_store_ineligibility, cancel_for_rollout_shutdown | M0000016, M0000023:235, M0000019:4 |
Terminal: unavailable, store_rejected, customer_cancelled, platform_cancelled, expired, payment_ready_expired (trigger M0000017:217-231).
Items: confirmation_status requested/needs_clarification/confirmed_full/confirmed_partial/unavailable/rejected (M0000001:147-149).
Holds: `inventory_holds` hold_type soft|firm, status active|released|converted_to_sale (M0000001:172-183). `converted_to_sale` is defined but NO function uses it (V grep: only the CHECK). Payment-ready is the end of the line: nothing after it.

## 2. Component inventory
| Component | file:line | Verdict | Reason (pay-first rule) |
|---|---|---|---|
| table store_order_requests | M0000001:68-123 | CHANGE | Status CHECK :73-78 lacks reserved/paid/accepted/refund states; keep identity/money/version/snapshot columns. NOT VALID/DROP+ADD constraint in follow-up migration |
| cols confirmation_due_at/reminder_at NOT NULL | M0000001:~95-96 | CHANGE | Set at submit; D-04 24h elapsed acceptance deadline needs new nullable `acceptance_due_at` or reuse with new calculator |
| cols acceptance_expires_at, payment_expires_at, payment_ready_at, accepted_proposal_version, clarification_*, decision_seconds_remaining | M0000001:99-103, M0000017/21 | RETIRE (leave columns, stop using) | Confirm-then-pay fields. payment_expires_at could be re-purposed as reservation_expires_at (10 min) |
| table store_order_request_items (confirmed_quantity, confirmed_unit_price, confirmation_status) | M0000001:126-168 | CHANGE | Store no longer sets qty/price (D-35 no substitutes, price fixed at buy). Keep requested qty + server_bound_unit_price; confirmation_status collapses to accepted/rejected |
| table inventory_holds | M0000001:172-190 | KEEP (+small CHANGE) | Core of reservation. Needs `order_request_id` per hold (already) and a 10-min expires_at; unique-active index :186 fine. Use converted_to_sale on payment |
| store_inventory balance CHECK + REVOKE UPDATE | M0000001:~200-206 | KEEP | Reservation moves available->reserved already; stock-lock invariant exists |
| marketplace_carts/cart_items + cart commands | M0000001:5-43, M0000007/8 | KEEP | Buy -> cart -> submit still the entry; no confirm-first coupling |
| submit_order_request | M0000010:4-175 | CHANGE | Must create holds (10 min), skip store reminder/expiry tasks :168-175, drop "store will confirm" copy :156-166, and gate on in-stock (D-15). Rename semantic to create_reservation |
| create_bucket_transfer_holds | M0000011:23-56 | KEEP / reuse | Already locks inventory, `quantity_available>=` guard, raises INSUFFICIENT_INVENTORY. Today only called from confirm (M0000012:121); change caller to submit and read requested_quantity instead of confirmed_quantity (:32-35) |
| release_request_holds | M0000011:58-77 | KEEP | Reservation expiry/refund release path |
| promote_request_soft_holds, assert_payment_ready_holds | M0000017:134-176 | RETIRE | soft->firm promotion belongs to partial-accept |
| assert_payment_ready_eligibility | M0000017:82-132 | CHANGE | Eligibility re-check (store active, entitlements, rollout, listing active, hold valid) is useful at reservation and at payment-verify; rename + drop "confirmed_quantity" filters |
| enforce_payment_ready_invariants trigger | M0000017:178-208 | RETIRE | Freezes totals in payment_ready; needs equivalent for new "reserved/paid" state |
| enforce_phase6_terminal_invariants trigger | M0000017:217-231 | CHANGE | Add new terminal states (refunded, refund_pending...) to IN list; no-active-holds rule still right |
| record_phase6_request_transition / claim_phase6_command / complete_phase6_command | M0000017:232+, M0000006:25-100 | KEEP | Idempotent command + event + transition log + audit + notification; all reusable |
| execute_owner_outcome (start_store_review, confirm_full, confirm_partial, mark_items_unavailable, reject) | M0000012:4-157 | CHANGE (largely rewrite) | 150 lines; becomes accept / reject-with-refund on a PAID order. Remove price/qty edit loop :43-82, delivery tariff recompute :83-100, payment_ready/soft branch :103-117. Keep lock order, concurrency, version checks, notification wiring |
| public wrappers confirm_full/confirm_partial/mark_items_unavailable/reject_order_request | M0000012:159-167 | CHANGE/RETIRE | confirm_partial RETIRE (D-35); confirm_full -> accept_paid_order; mark_items_unavailable and reject -> reject => auto refund (D-22) |
| accept_confirmed_changes | M0000018:4-97 | RETIRE | Customer decision after partial confirm; no equivalent (no substitutes) |
| cancel_order_request | M0000018:99+ | CHANGE | Customer cancel semantics after payment => refund rules (D-09/D-22); allowed states list needs rewrite |
| execute_phase6_expiry / expire_customer_decision / expire_payment_ready | M0000019:56-125 | CHANGE | Reuse pattern (lock, release holds, transition, resolve tasks) for: expire_reservation (10 min, unpaid) and expire_acceptance (24h paid -> trigger refund). expire_customer_decision RETIRE |
| expire_confirmation, send_confirmation_reminder | M0000027:4-90 | CHANGE | Becomes acceptance reminder + 24h elapsed expiry with REFUND side effect (new). Today expiry is not refund-aware |
| request_clarification / provide_clarification / expire_clarification / clarification tables | M0000013/14/22 | RETIRE | Clarification before payment makes no sense when store acts after paid (I: could remain as post-paid chat, but D-35 says no substitutes) |
| request_platform_support, support_* interventions | M0000015/16/34-36 | CHANGE (light) | Keep cancel/extend; extend_customer_decision_deadline RETIRE; extend-confirmation-deadline maps to acceptance deadline (I: not fully read) |
| schedule engine (store open hours, business days, closing boundary) | M0000020:24-210; M0000021:80-122 | CHANGE/bypass | `submission_confirmation_window` computes reminder from OPEN seconds and expiry at store-closing boundary 1-2 business days (M0000021:105-122). D-04 says 24 ELAPSED hours: replace with plain `now()+24h`; schedule engine stays for other uses (I) |
| emergency pause/resume (paused_for_emergency_closure, pause_remainder triggers) | M0000023, M0000038, M0000039 | RETIRE or CHANGE | Pauses the confirmation clock by store hours. D-04 elapsed 24h likely means no pause; owner decision needed. 3 migrations of fixes tied to this |
| trigger apply_decision_payment_deadline | M0000021:176-195 | RETIRE | Sets acceptance/payment expiry on entering those states |
| trigger enrich_phase6_deadline_task | M0000021:197-225 | CHANGE | CASE maps task_type -> due_at column (:211-218); must add reservation_expiry and paid_acceptance_expiry types |
| schedule_phase6_deadline_task | M0000021:124-147 | CHANGE | task_type allowlist :133-135; add 2 types, otherwise KEEP (dedupe key per request version) |
| event_action_tasks + claim/complete/retry/dead-letter | M0000026:15-110; M0000028 | KEEP | Generic deadline framework with lease, retry, dead-letter. Directly hosts the 10-min and 24h timers |
| scheduler contract (cron lease, runs) | M0000028 | KEEP | No coupling |
| worker commerce-task-worker | supabase/functions/commerce-task-worker/index.ts:8-16 | CHANGE (tiny) | COMMANDS map task_type->RPC; add 2-3 entries, drop payment_ready/customer_decision/clarification. Handler body generic (V read all 122 lines). Refund RPC is new (Cashfree call needs its own worker) |
| event/notification registry + validate triggers | M0000024:4-86,100-168 | CHANGE | Registry rows for order_request.* events/notifications (V: list of 19 event names, e.g. order_request.confirmed, partially_confirmed, payment_ready_expired, clarification_*). Add paid/accepted/refunded rows; retire ~6. Framework KEEP |
| notification transport (push/in-app) | M0000025 | KEEP | I |
| UI-safe projections customer/owner | M0000029:32-76, M0000030:5-40 | CHANGE | Expose payment_ready_at/payment_expires_at (M0000029:39,49,75-76); add reservation/payment/refund fields |
| authorization-safe reads | M0000004:89-188 | CHANGE (light) | Superseded by 29/30; status lists |
| reconciliation scans | M0000032:31-50 | CHANGE | Hard-codes payment_ready_missing_firm_hold, awaiting_customer_decision hold checks (:37-41, :50, M0000033:160-161 expiry checks). Add reservation/paid/orphan-payment checks (NEW) |
| observability triggers/metrics | M0000033:169-277 | KEEP (+CHANGE :160-161) | Generic on transition/hold/task |
| audit log, transition log, entity creation log (append-only) | M0000002, M0000024:227-236 | KEEP | Reuse for payments/refunds |
| policy config: payment_ready_window_seconds bounds 1800-7200 | M0000003:96,115 (policy bounds); M0000018:~77 `BETWEEN 300 AND 86400`; M0000021:176 | CHANGE | 10 min = 600 s is BELOW the 1800 policy minimum -> new policy key `reservation_window_seconds` with own bounds |
| cart eligibility resolver | M0000005 | KEEP | I |
| vocabulary.ts (states, commands, events) | C/vocabulary.ts:3-58 | CHANGE | Enumerates 12 states, commands, system commands; test asserts exact lists |
| ui/presentation.ts, ownerPresentation.ts, types.ts, ownerTypes.ts | C/ui/*.ts (presentation.ts:7-41; ownerPresentation.ts:7-20) | CHANGE | Labels "Your decision needed", "Payment ready", canAccept logic, state ordering |
| CustomerRequestDetailScreen | C/screens/CustomerRequestDetailScreen.tsx:37-46 | CHANGE | awaiting_customer_decision accept panel RETIRE; payment_ready panel -> Cashfree checkout + 10-min countdown (NEW) |
| CustomerCartScreen | C/screens/CustomerCartScreen.tsx | CHANGE | "Send request" -> "Reserve and pay" |
| OwnerOrderDetailScreen, OwnerOrdersScreen | C/screens | CHANGE | Confirm-with-quantities UI -> Accept/Reject on paid order |
| services/hooks (customer/ownerCommerceService, hooks) | C/services, C/hooks | CHANGE | RPC names (accept_confirmed_changes etc.) |
| timeEngine.ts (252), eligibility.ts (189) | C/timeEngine.ts, C/eligibility.ts | KEEP/CHANGE (I) | timeEngine likely mirrors business-day confirmation window: update if client previews deadlines |
| AddToCartButton, commerceStore, commandIdentity, commerceSession, schemas | C/* | KEEP | I |

## 3. Reuse vs missing
REUSABLE (V): inventory locking and reserve/release (M0000011:23-77, quantity_available>= guard, balance CHECK), inventory_holds table with expires_at and unique-active index, event_action_tasks deadline framework with lease/retry/dead-letter and version-scoped dedupe, generic worker task->RPC map, idempotent command claim/complete, transition log + audit + events + notification registry/validation, reconciliation/observability scaffold, cart + submit snapshotting (price, seller, policies), owner capability checks, eligibility asserts.
NOT PRESENT in Phase 6 (NEW-NEEDED):
- Reservation as the FIRST step: holds are created only at store confirm (M0000012:121), never at submit. 10-min hold window and only in-stock gate (D-15).
- Payment entities: payment attempts, Cashfree order/session, webhook endpoint + signature verify, verification RPC, ledger, refunds, refund status. Phase 6 has zero payment tables (V: no phase6 migration creates one; `payment_ready` is a status only).
- Hold -> sale conversion (`converted_to_sale` + `quantity_sold`) on verified payment: unused today.
- Late-payment path (D-06): re-reserve if still available else refund; needs hold re-acquire for a request already expired/terminal (terminal trigger M0000017:217 and hold guards block this).
- Paid-order acceptance deadline 24h elapsed + refund side effect (D-04); existing expiry only releases holds and flips state.
- Auto-refund orchestration on reject/unavailable/expiry (D-22, D-35) and tasks to retry refunds.
- New states (names indicative): reserved(awaiting_payment), reservation_expired, paid, store_accepted, refund_pending, refunded, plus Phase 8 pickup/OTP states.
- Idempotent webhook-vs-reservation-expiry race handling (INFERRED, high risk).

## 4. Hard couplings (confirm-before-pay baked in)
1. Status CHECK enumerates 12 states, M0000001:73-78; also item confirmation_status CHECK :147-149. (V)
2. Triggers depend on payment_ready name: M0000017:178-208 guard, :217-231 terminal list; M0000021:176-195 deadline; M0000033:160-161 and M0000032:37-50 reconciliation. (V)
3. Holds are only created from confirmed_quantity (M0000011:32-35; M0000017:82-132 filters `confirmed_quantity>0`). (V)
4. Confirmation window computed from store open hours/closing boundary (M0000021:105-122; M0000020 engine; submit uses at M0000010 ~:80). Conflicts with D-04 elapsed 24h. (V)
5. Emergency-closure pause/resume (M0000023/38/39) rewrites deadlines of confirmation clock; 3 fix migrations show it is the most fragile area. (V names, I behaviour)
6. confirmation tasks created in submit (M0000010:168-175) and cancelled by owner outcomes (M0000012:132-135). (V)
7. Policy bounds 1800-7200 for payment window (M0000003:96) and 300-86400 inline check (M0000018:~77, M0000021 ~:188): 10 min not allowed. (V)
8. Notification/event registry rows and `assert_phase6_safe_payload` named to order-request events (M0000024:4-86). Tests assert exact lists (vocabulary.test.ts). (V/I)
9. Owner commands need price<=server_bound and qty<=requested (M0000012:48-58): price negotiation model. (V)
10. Tests: static SQL-text assertions (e.g. OwnerOutcomes.test.ts:46 `toContain("'payment_ready'")`) so renamed states fail those tests mechanically but cheaply. Integration SQL tests (unit8/9/10) assert full confirm->payment_ready->expiry sequences against a live DB (I).
Note AGENTS.md rule: applied migrations must not be edited -> every CHANGE is a NEW follow-up migration with CREATE OR REPLACE / DROP+ADD CONSTRAINT (V rule; whether 0001-0039 are applied live is UNVERIFIED, I assume yes).

## 5. Counts
- Migrations needing a follow-up (touching): 0001 (CHECKs), 0003 (policy bounds), 0010, 0012, 0017, 0018, 0019, 0021, 0023/38/39, 0024, 0027, 0029/0030, 0032/33, 0016/34-36 = ~16 of 39. Expect 4-6 NEW migrations (state/CHECK + policy; reservation-at-submit; paid-order accept/reject/expiry; deadline/registry/projection; reconciliation) since CREATE OR REPLACE can batch.
- Functions: CHANGE ~14 (submit, create_bucket_transfer_holds, assert_payment_ready_eligibility, execute_owner_outcome + 5 wrappers collapsed, cancel_order_request, execute_phase6_expiry, expire_confirmation, send_confirmation_reminder, schedule_phase6_deadline_task, enrich trigger, projections x2, reconcile x2, terminal trigger). RETIRE ~12 (accept_confirmed_changes, confirm_partial, promote_request_soft_holds, assert_payment_ready_holds, payment_ready guard trigger, decision/payment deadline trigger, 3 clarification commands, expire_customer_decision, support_extend_customer_decision_deadline, expire_clarification; emergency pause 4 fns decision-dependent). KEEP ~35.
- Tests: migration static tests 14 files / 1,617 lines: REWRITE 5 (CustomerDecisionExpiry 219, OwnerOutcomes 96, ClarificationSupport 181, ScheduleClosure 263 partially, OrderRequestFoundation 79 state list), EDIT 5 (EventNotification, SchedulerTasks, Reconciliation, RequestSubmission, OwnerUi/CustomerUi projection), KEEP 4 (AuthorizationSafeReads, CartCommands, EligibilityResolver, +). SQL integration 7 files ~800 lines: rewrite unit8, unit9, unit10 (+concurrency ps1); keep cleanup scripts. Frontend tests 10 files 824 lines: rewrite 4 (CustomerRequestDetailScreen, customerUi, ownerUi, vocabulary), edit 3 (screens), keep 3 (eligibility, commerceSession, timeEngine maybe).
- UI files to change: ~12 of ~19 (vocabulary, 4 ui/*.ts, 5 screens, 2 services, 2 hooks lightly).

## 6. Estimate (Codex-implemented, excluding Cashfree/ledger/refund provider code)
| Work | Days |
|---|---|
| SDD decisions: state list, emergency-pause fate, partial/clarification retirement, 24h clock | 0.5 |
| SQL: new states/CHECK/policy + reserve-at-submit + paid accept/reject + expiry/ref-trigger hooks + registry + projections | 1.5-2 |
| Worker + reconciliation + tests (static) | 0.5-1 |
| SQL integration/concurrency tests against live (reserve race, expiry race, late payment) | 0.5-1 |
| Frontend vocabulary/screens/tests rewrite | 1 |
Total: 3.5-4.5 working days, plus review loop. Verdict: GOOD case, at its upper end (not 2-3 d, far from 1 wk+). Reason: stock-lock, holds, task framework, worker, event/audit, idempotent commands all reusable; the rewrite is concentrated in owner_outcome (150 lines), 3 triggers, the confirmation-window calculator, the state CHECK and UI labels. Whole state machine is not woven through RLS (V: RLS goes by capability/store, not status; I: not every policy read).
Biggest uncertainties:
1. Emergency-closure pause and business-hours clock vs D-04 "24 elapsed hours": 3 fix migrations and 263-line test show fragility; if owner wants to keep pause semantics this adds ~1 day. (I behaviour)
2. Late-payment re-reserve (D-06) vs terminal-state triggers/unique-active hold index: reviving expired requests may require new "reservation_expired but recoverable" state and careful race tests; cost 0.5-1.5 days. (I)
3. Whether to evolve `store_order_requests` into the paid order or add a separate orders table (DOC-14 not read): separate table raises UI/projection churn +1-2 days; also unverified: which migrations are applied live and unit8-10 integration tests currently pass (not run; read-only).
Not read fully (I): M0000002-9, 13-16, 20, 22, 25-28, 30-31, 34-39 bodies; test bodies beyond counts; Phase 6 docs not skimmed.
