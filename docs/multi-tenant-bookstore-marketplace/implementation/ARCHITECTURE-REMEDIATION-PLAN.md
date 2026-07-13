# Architecture Remediation Plan

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-06-18
**Status:** `complete`
**Owns:** Cross-document remediation tasks derived from the v0.2 architecture audit, organized by domain, to make the suite production-ready for the Bangalore pilot.
**Depends On:** README, DOC-1, DOC-2, DOC-4, DOC-6, DOC-12, DOC-14, DOC-15, DOC-16, PHASE-0, PHASE-1

---

## 1. Purpose

This document converts the architecture audit findings into a structured, reviewable remediation backlog. It does not itself change product behavior; it specifies the exact documentation and schema changes required, the target document for each change, and the architectural rationale.

Findings are grouped into five domains:

1. Data Dictionary and Documentation Alignment
2. Commerce State Machine and Logic
3. Financial and Ledger Foundation
4. Security, RLS, and Compliance
5. Phase 1 Foundation Promotion

Each task carries a stable ID, target document(s), the exact change, and the rationale. Apply tasks in the dependency order in Section 7.

---

## 2. How To Use This Plan

- Task markers follow the suite convention:

```text
[ ] not started
[/] in progress
[!] blocked
[x] complete
[-] deferred
```

- A task is complete only when the target document is updated, the canonical data dictionary (Section 3, DD-01) is respected, and DOC-13 is updated per README §9.
- Schema-shaping tasks must be reflected in the Phase 1 plan before any migration is written.
- Money values are integer minor units (paise) everywhere; see FIN-01.

---

## 3. Domain 1: Data Dictionary and Documentation Alignment

### 3.1 Canonical Table Register (DD-01)

**Target documents:** README §3, DOC-1 §6, DOC-6 §12, DOC-14 §14, DOC-15 §11, PHASE-1 plan.

**Change:** Adopt the following canonical names. All documents must reference these names; local re-definitions are removed in favor of a link to this register.

| Concept | Canonical name | Replaces |
|---|---|---|
| Money ledger | `finance_ledger_entries` | `settlement_ledger_entries` (DOC-6) |
| Settlement batch | `settlement_batches` | `store_settlements` (README, DOC-1) |
| Seller payout account | `seller_payout_accounts` | `payout_accounts` (DOC-15) |
| Security/compliance audit log | `marketplace_audit_logs` | `store_audit_logs` (DOC-1 §6) |
| Unpaid request header | `store_order_requests` | `store_orders` used for request stage |
| Unpaid request line item | `store_order_request_items` | `store_order_items` used for request stage |
| Paid order header | `store_orders` | (kept; paid stage only) |
| Paid order line item | `store_order_items` | (kept; paid stage only) |
| Invoice snapshot | `invoice_snapshots` | n/a |
| Commerce transition log | `commerce_transition_log` | n/a |
| Idempotency keys | `commerce_idempotency_keys` | n/a |
| Inventory hold | `inventory_holds` | n/a |
| Controlled locality | `marketplace_localities` | free-text `stores.locality` |
| Payment record | `payments` | n/a |
| Consumer cart header | `marketplace_carts` | n/a |
| Consumer cart line item | `marketplace_cart_items` | n/a |
| Image extraction session | `image_extraction_sessions` | n/a |
| Image extraction input | `image_extraction_inputs` | n/a |
| Image extraction candidate | `image_extraction_candidates` | n/a |
| Metadata enrichment attempt | `metadata_enrichment_attempts` | n/a |

**Rationale:** A ledger-first finance model has a single spine table; two names (`settlement_ledger_entries` vs `finance_ledger_entries`) invite two implementations and break reconciliation. The request-stage vs paid-stage tables are intentionally distinct entities and must not be collapsed. A single register removes drift between the README (the first document agents read) and the domain specs.

> **Audit reconciliation P-4:** This register is the *complete* canonical name source. The commerce, payment, cart, and image-extraction tables referenced by DD-02 (README refresh) are included above so DD-01 and DD-02 cannot drift.

### 3.2 Refresh README §3 to v0.2 Domain (DD-02)

**Target document:** README §3 ("New marketplace domain required").

**Change:** Replace the simplified table list with the v0.2 model. Add the four image-extraction tables from DOC-4 §14 (`image_extraction_sessions`, `image_extraction_inputs`, `image_extraction_candidates`, `metadata_enrichment_attempts`) and the commerce tables from DOC-6/DOC-14/DOC-15 (`marketplace_carts`, `marketplace_cart_items`, `store_order_requests`, `store_order_request_items`, `inventory_holds`, `payments`, `finance_ledger_entries`, `settlement_batches`, `invoice_snapshots`, `commerce_transition_log`, `commerce_idempotency_keys`). Reference DD-01 for canonical names.

**Rationale:** README §3 currently lists a single `image_extraction_sessions` table and `store_orders`/`store_order_items` only. It reads as a stale v0.1 enumeration and misleads new agents about the true domain surface.

### 3.3 Version Alignment to v0.2 (DD-03)

**Target documents:** DOC-4 (v0.1 → v0.2), DOC-15 (v0.1 → v0.2), and any other doc still below v0.2.

**Change:** Bump version headers to 0.2, set date to the alignment date, and sweep DOC-4/DOC-15 table and field names to match DD-01 and FIN-01. Record the sweep in DOC-13.

**Rationale:** The naming conflicts cluster around the two v0.1 documents. A version-alignment pass resolves most consistency drift mechanically and prevents the next agent from reintroducing legacy names.

### 3.4 Domain 1 Task List

- [x] DD-01: Publish canonical table register and link DOC-1/6/14/15 and PHASE-1 to it.
- [x] DD-02: Refresh README §3 with the full v0.2 domain table list.
- [x] DD-03: Bump DOC-4 and DOC-15 to v0.2 and sweep names to DD-01/FIN-01.

---

## 4. Domain 2: Commerce State Machine and Logic

### 4.1 Add Request-Level State `awaiting_clarification` (SM-01)

**Target documents:** DOC-14 §5 (Order Request State Machine), DOC-6 §11.1.

**Change:** Add a request-level state `awaiting_clarification`. Transition `store_reviewing -> awaiting_clarification` when any item enters `needs_clarification` (DOC-14 §6). Add `awaiting_clarification -> store_reviewing` when all clarifications are resolved, and `awaiting_clarification -> expired` on clarification timeout. Define the SLA rule explicitly: the confirmation SLA clock pauses while in `awaiting_clarification` and resumes on `clarification_provided`, bounded by a platform-configurable `clarification_timeout` policy value.

**Rationale:** The item machine already supports `needs_clarification`, but the request has no paused state, leaving SLA behavior undefined ("pause or continue SLA by policy"). A request-level state makes the timer semantics testable.

### 4.2 Add Request-Level State `awaiting_customer_decision` + Partial-Acceptance Window (SM-02)

**Target documents:** DOC-14 §5, DOC-6 §4 and §7, DOC-12 §7 (Policy Engine), PHASE-1 `marketplace_policy_config`.

**Change:**
- Add request-level state `awaiting_customer_decision`, entered from `partially_confirmed` (and from a below-minimum re-quote per DOC-6 §7).
- Introduce a **Partial-Acceptance Window** separate from the payment window. On partial/confirmed-with-changes, start `acceptance_expires_at`. A **soft hold** already exists from confirmation (see SM-03); on explicit customer acceptance (`awaiting_customer_decision -> payment_pending`) the soft hold converts to a **firm hold** and the payment window (`payment_expires_at`) starts.
- Add `acceptance_window` to the policy engine (default and min/max range), alongside the existing payment-window config.
- Add an `adjusted` path: `awaiting_customer_decision -> adjusted` for quantity reduction or pickup switch, then `-> payment_pending`.

**Rationale:** Today the payment window and inventory holds start at confirmation (DOC-14 §5 side effects), before the customer has accepted the partial result that DOC-6 §4 requires. Deliberation time competes with the pay clock and can expire holds while the customer is still deciding. Separating the acceptance and payment timers — and the soft/firm hold tiers (SM-03) — fixes the partial-availability and below-minimum-delivery edge cases.

> **Audit reconciliation P-1:** The earlier contradiction (SM-02 said holds start at acceptance; SM-03 said holds are created at confirmation) is resolved by the two-tier hold model in SM-03: a *soft hold* is created atomically at confirmation to close the oversell race, and it converts to a *firm hold* with `payment_expires_at` only on customer acceptance.

### 4.3 Fix Used-Book Oversell via Atomic Holds at Confirmation (SM-03)

**Target documents:** DOC-14 §6 (item guards), §7 (hold machine), §12 (concurrency), DOC-6 §6.

**Change:**
- Adopt a **two-tier hold model** on `inventory_holds` via a `hold_type` column (`soft` | `firm`):
  - **Soft hold (at confirmation):** store confirmation atomically creates/decrements the `inventory_holds` row (`hold_type='soft'`) for the confirmed quantity in the same transaction as the item state change. This closes the oversell race immediately, before the customer decides.
  - **Firm hold (at acceptance/payment):** on customer acceptance (`awaiting_customer_decision -> payment_pending`, SM-02) the soft hold is promoted to `hold_type='firm'` and `payment_expires_at` is set. Fully-available requests that skip the decision step are created directly as firm holds.
- Redefine the availability guard to: `available_quantity - sum(active_holds) >= requested_quantity` (counting both soft and firm active holds), evaluated under row-level locking on the inventory row.
- State explicitly that a confirmation must fail if it would drive effective available quantity below zero.
- Soft holds expire on `acceptance_expires_at`; firm holds expire on `payment_expires_at`. Expiry releases the held quantity in both cases.

**Rationale:** Used-book stock is frequently quantity 1. The current model creates holds only after confirmation and the guard ignores outstanding holds from other in-flight requests, so two customers can each get a hold on the same copy. A soft hold at confirmation closes the oversell window immediately; promotion to a firm hold at acceptance ties the longer payment clock to a committed customer (resolves audit item P-1 with SM-02).

### 4.4 Price-Drift Rule Between Add-to-Cart and Order Request (SM-04)

**Target documents:** DOC-6 §3.1 and §3.3, DOC-14 §5 (guard "quote valid"), and DOC-14 acceptance criterion **STM-03** (defined below).

**Change:** Define the binding price rule:
- The cart stores `price_snapshot_minor` at add-to-cart.
- At request submission, the server re-reads the current listing price. If the current price is **lower**, the lower price binds. If it is **higher**, the request is accepted at the snapshot price only within a platform-configurable drift tolerance; beyond tolerance the item is flagged `price_changed` and routed to `needs_clarification` for explicit customer re-confirmation.
- Store confirmation continues to be forbidden from increasing the confirmed unit price above the bound request price. This rule is tracked as DOC-14 acceptance criterion **STM-03** ("a store confirmation may never increase a line item's unit price above the price bound at request submission"); it remains unchanged by this task (resolves audit item P-5, dangling `STM-03` reference).

**Rationale:** The suite snapshots price at add-to-cart but never defines what happens when the underlying listing price changes before submission, leaving the "quote valid" guard undefined and creating a bait-and-switch/trust surface.

### 4.5 Domain 2 Task List

- [x] SM-01: Add `awaiting_clarification` request state + SLA pause rule.
- [x] SM-02: Add `awaiting_customer_decision` state and Partial-Acceptance Window policy.
- [x] SM-03: Make confirmation atomically create/decrement holds; hold-aware availability guard.
- [x] SM-04: Define add-to-cart → request price-drift binding rule with tolerance.

---

## 5. Domain 3: Financial and Ledger Foundation

### 5.1 Project-Wide Integer Minor Units Mandate (FIN-01)

**Target documents:** DOC-2 §13, DOC-4 §14, DOC-6 §12, DOC-15 §11, PHASE-1 plan, README.

**Change:** Mandate integer minor units (paise) for every money-bearing field and rename for clarity. Convert `amount_inr`, `subtotal_requested_inr`, `subtotal_confirmed_inr`, `delivery_quote_inr`, `price_snapshot_inr`, `owner_price_inr`, `base_price`, and `minimum_delivery_order_value` to `*_minor` integer columns (e.g., `amount_minor`, `subtotal_requested_minor`, `price_snapshot_minor`, `minimum_delivery_order_value_minor`). Add a one-line invariant to DOC-15 §5: "All monetary amounts are stored as non-negative integer paise (magnitude only); direction/sign is expressed by a separate `direction` column, never by the magnitude. No floating-point currency is permitted." (See FIN-02 for the sign convention; this resolves audit item P-2.)

**Rationale:** DOC-15 already requires minor units while DOC-6/DOC-2 use `_inr`, and PHASE-1 already wrote `minimum_delivery_order_value_minor`. The convention is therefore being decided inconsistently in the foundation. Unifying now prevents rupee/paise reconciliation drift and avoids a mid-pilot data migration.

### 5.2 Double-Entry Invariant and Gateway-Fee Reconciliation (FIN-02)

**Target documents:** DOC-15 §5 (Ledger Principles), §11 (`finance_ledger_entries`).

**Change:**
- **Sign convention (resolves P-2):** `finance_ledger_entries.amount_minor` is a non-negative magnitude; `direction IN ('debit','credit')` carries the sign. The signed value of an entry is `CASE direction WHEN 'credit' THEN amount_minor ELSE -amount_minor END`. Magnitude is never itself signed.
- **Balancing invariant (resolves P-3):** the invariant is net-zero **per balanced transaction group** (a `transaction_group_id`), not per order `source_id`. Each group's signed sum must equal zero; a settlement/reconciliation check enforces this.
- Add ledger entry type `gateway_fee_non_refundable_loss` and a rule: on refund, the gateway fee from the original `payment_gateway_fee` entry is not reversed. Instead the loss is posted as a balanced pair within the refund transaction group — a debit to a platform expense/clearing account and the offsetting credit — so the group still nets to zero and platform margin is computed correctly.
- Specify reconciliation tolerance and rounding (zero-paise tolerance; rounding only at tax/commission computation, recorded as explicit adjustment entries).

**Rationale:** DOC-15 asserts "balanced financial interpretation" and ships a `direction` column but defines neither the invariant nor refund gateway-fee handling. A naive "net-to-zero per `source_id`" breaks the moment a platform-borne loss is posted (the loss belongs to a platform account, not the order); scoping the invariant to a balanced transaction group with explicit platform clearing accounts keeps double-entry intact. Indian PA/PG fees are typically non-refundable, so each refund is a real loss that DOC-16's gross-margin-per-order metric cannot compute without this entry.

### 5.3 Reserved TCS/GST Structural Fields in Settlement (FIN-03)

**Target documents:** DOC-15 §6 and §11 (`settlement_batches`), DOC-6 §10 snapshot fields.

**Change:** Add reserved, nullable structural fields to `settlement_batches`: `tcs_deduction_minor`, `gst_on_commission_minor`, and `tax_adjustments_minor`, plus a `tax_treatment_version` marker. Add a corresponding `tax_collected_or_payable` usage note tying these to ledger entries. Values remain unset until legal/accounting review (DOC-15 §10, §12) but the columns exist from the first settlement migration.

**Rationale:** As e-commerce operator collecting consideration, BookConnect likely must deduct TCS at settlement. Deferring the value is acceptable; deferring the column forces a schema migration mid-pilot. Reserving the structure now satisfies the DOC-15 §12 review gate without rework.

**Technical requirement (extend `settlement_batches` in the foundation migration or a follow-up):**

```sql
ALTER TABLE public.settlement_batches
  ADD COLUMN tcs_deduction_minor     INTEGER,
  ADD COLUMN gst_on_commission_minor INTEGER,
  ADD COLUMN tax_adjustments_minor   INTEGER,
  ADD COLUMN tax_treatment_version   TEXT;
```

### 5.4 Settlement vs Return-Window Holdback (FIN-04)

**Target documents:** DOC-15 §6 (Settlement Eligibility), DOC-2 §7 (return templates).

**Change:** Add an explicit eligibility rule: an order is settlement-eligible only after its return window (`returns_within_3_days` / `returns_within_7_days` per the order's policy snapshot) has closed, or it is included with a `settlement_holdback` entry covering the refundable amount until the window closes.

**Rationale:** Weekly settlement plus a 3–7 day return window guarantees orders settle before their return window closes, forcing negative-balance churn (DOC-15 §7). An explicit holdback rule reconciles the cadence with the return policy.

### 5.5 Domain 3 Task List

- [x] FIN-01: Enforce integer minor-unit money fields across all docs and PHASE-1.
- [x] FIN-02: Define double-entry invariant + `gateway_fee_non_refundable_loss` handling.
- [x] FIN-03: Add reserved TCS/GST fields to `settlement_batches`.
- [x] FIN-04: Add return-window holdback rule to settlement eligibility.

---

## 6. Domain 4: Security, RLS, and Compliance

### 6.1 Edge Function Tenant-Assertion Test Matrix (SEC-01)

**Target documents:** DOC-1 §7.4 and §16 (Security Acceptance Criteria), PHASE-1 plan RLS Test Matrix, DOC-12 §12.

**Change:** Add a required test matrix for every service-role Edge Function / private-schema RPC that performs a privileged commerce or store action. Each function must have tests proving: (a) caller `auth.uid()` is resolved server-side; (b) caller store relationship is independently verified against `store_administrators`; (c) cross-tenant invocation (Store A actor targeting Store B entity) is denied; (d) platform-role actions require a `platform_user_roles` row. Add acceptance criterion SEC-16: "Every service-role function has a passing cross-tenant denial test."

**Rationale:** Edge Functions run as service-role and bypass RLS entirely, making in-function actor/tenant checks the only isolation. The current SEC-12/STM-10 criteria assert authorization in the abstract but do not require per-function denial tests, leaving the largest residual isolation surface untested.

### 6.2 Secured Notification Projection Instead of Raw Event Reads (SEC-02)

**Target documents:** DOC-1 §7, PHASE-1 plan RLS matrix (`marketplace_events` row), DOC-10, DOC-14 §13.

**Change:** Remove client read access to `marketplace_events`. Introduce a curated, column-safe projection table (e.g., `marketplace_notifications`) containing only display-safe fields (no raw `payload` jsonb, no payment/PII metadata), populated server-side from events. Store Owner and consumer clients read only the projection; realtime subscriptions bind to it.

**Rationale:** `marketplace_events.payload` is free-form jsonb marked private in DOC-14. Row-level read access by `store_id` does not provide column-level safety and can leak payment or PII payloads. A projection enforces least privilege and aligns with DOC-12 §11 ("realtime is not the source of truth").

### 6.3 DPDP: LLM Vendor as Data Processor + Egress/Residency (SEC-03)

**Target documents:** DOC-1 §10 (DPDP and Privacy Rules) and §13 (Storage Security), DOC-4 §15.

**Change:**
- Designate the multimodal LLM provider (and metadata providers) as data processors in DOC-1 §10, requiring a data-processing agreement before production use.
- Add image egress requirements: strip EXIF/geolocation before upload; transmit only the minimum necessary image data; prohibit vendor reuse for model training without explicit platform policy and consent (DOC-4 §15 reinforced).
- State a data-residency preference and require a residency/cross-border-transfer review as a payment/launch gate; add the LLM vendor to the privacy-notice third-party disclosure list (currently only delivery partners are disclosed).

**Rationale:** DOC-4 sends shelf/cover images to an external LLM; such images can contain PII (handwritten notes, faces, inserts). DOC-1's DPDP section never names the LLM vendor as a processor and discloses only delivery partners, leaving a cross-border egress blind spot under DPDP Rules 2025.

### 6.4 Supporting RLS Hardening (SEC-04)

**Target documents:** DOC-1 §7.1, PHASE-1 plan Task 7.

**Change:** Standardize on a single private-schema `is_store_admin(store_id)` helper (security-definer, fixed `search_path`, `EXECUTE` revoked from `anon`) used by all store-scoped policies — this matches the name already implemented in `20260618000001_marketplace_foundation.sql` (resolves audit item P-5; the plan no longer uses `is_store_owner`). Mandate that storage policies parse `storage.foldername()` AND join to `store_administrators` (path prefix alone is not isolation). Add FK indexes for every new foreign key.

**Rationale:** Repeated `EXISTS (... store_administrators ...)` subqueries risk recursive policy evaluation and N+1 cost (the unindexed-FK pattern PHASE-0 already flagged). A single helper and explicit storage ownership join make isolation correct and performant.

### 6.5 Domain 4 Task List

- [x] SEC-01: Add Edge Function tenant-assertion test matrix + acceptance criterion SEC-16.
- [x] SEC-02: Replace raw `marketplace_events` client reads with `marketplace_notifications` projection.
- [x] SEC-03: Add LLM vendor as processor; define image egress/residency requirements.
- [x] SEC-04: Standardize on `is_store_admin()` helper, storage ownership-join policy, and FK indexes.

---

## 7. Domain 5: Phase 1 Foundation Promotion

### 7.1 Promote `commerce_idempotency_keys` to Phase 1 (P1-01)

**Target documents:** PHASE-1 plan §"Proposed Schema Groups" and Task 5, DOC-14 §12 and §14, PHASE-1 tracker.

**Change:** Create `commerce_idempotency_keys` (`id`, `scope`, `key`, `request_hash`, `response_snapshot` private, `status`, `created_at`, `expires_at`) in the Phase 1 foundation migration, and define the contract used by event/audit writers. Update the PHASE-1 plan to list it explicitly rather than "add idempotency fields where future processing will use them."

**Rationale:** DOC-14 §12 requires idempotency from cart-to-request creation and store-confirmation submission (Phase 6). Because Phase 1 builds the append-only event/audit envelope these keys decorate, co-designing the table in Phase 1 avoids retrofitting every transition and webhook writer later.

**Technical requirement (add to the foundation migration; RLS denies all client access by default):**

```sql
CREATE TABLE public.commerce_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_snapshot JSONB,                 -- private; never client-readable
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (scope, key)
);

ALTER TABLE public.commerce_idempotency_keys ENABLE ROW LEVEL SECURITY;
-- No client policies: writes/reads are service-role only (RLS denies by default).
```

### 7.2 Promote Controlled `marketplace_localities` Entity to Phase 1 (P1-02)

**Target documents:** PHASE-1 plan (Store Tenant Core + policy config), DOC-2 §4.3, DOC-16 §2 and §5, DOC-12 §7.

**Change:** Add a controlled `marketplace_localities` table (`id`, `city`, `name`, `slug`, `is_pilot_enabled`, `geo` boundary optional) and make `stores.locality` a foreign key to it. Reference `marketplace_localities.id` from `marketplace_policy_config` locality scope and the pilot allowlist.

**Rationale:** `marketplace_policy_config.scope_type` already includes `city` and `locality`, and DOC-16 gates rollout by locality/allowlist, but `stores.locality` is free text. Promoting a controlled entity now prevents a later migration touching `stores`, policy config, and discovery, and makes locality-gated pilot rollout enforceable.

**Technical requirement (add to the foundation migration; convert `stores.locality` to a FK):**

```sql
CREATE TABLE public.marketplace_localities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_pilot_enabled BOOLEAN NOT NULL DEFAULT false,
  geo GEOGRAPHY(POLYGON),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Replace free-text stores.locality with a controlled FK:
--   stores.locality_id UUID REFERENCES public.marketplace_localities(id) ON DELETE SET NULL
CREATE INDEX idx_stores_locality ON public.stores(locality_id);

ALTER TABLE public.marketplace_localities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "localities readable" ON public.marketplace_localities
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "localities manage" ON public.marketplace_localities
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
```

For polymorphic `marketplace_policy_config` locality scope, document the contract that `scope_value` references `marketplace_localities.id` when `scope_type='locality'` (a hard FK is not possible on a polymorphic scope column).

### 7.3 Domain 5 Task List

- [x] P1-01: Add `commerce_idempotency_keys` to Phase 1 foundation + contract.
- [x] P1-02: Add `marketplace_localities` controlled entity; FK from `stores.locality`.

---

## 8. Recommended Remediation Order

Apply lowest-cost, highest-leverage first; later tasks depend on earlier decisions.

| Order | Tasks | Why first |
|---|---|---|
| 1 | FIN-01 | Money-unit convention is referenced by every later schema/snapshot. |
| 2 | DD-01, DD-02, DD-03 | Canonical names unblock all subsequent doc edits. |
| 3 | P1-01, P1-02 | Foundation tables must exist before commerce/finance phases. |
| 4 | SM-01, SM-02, SM-03, SM-04 | Commerce correctness depends on names + idempotency. |
| 5 | FIN-02, FIN-03, FIN-04 | Ledger rules depend on minor units and state machine. |
| 6 | SEC-01, SEC-02, SEC-03, SEC-04 | Security hardening spans all above surfaces. |

---

## 9. Acceptance Criteria

- [x] A single canonical table register exists and all domain docs link to it (DD-01).
- [x] README §3 reflects the full v0.2 domain model (DD-02).
- [x] DOC-4 and DOC-15 are at v0.2 with no legacy `_inr`/`payout_accounts`/`settlement_ledger_entries` names (DD-03, FIN-01).
- [x] DOC-14 defines `awaiting_clarification` and `awaiting_customer_decision` with SLA/window semantics (SM-01, SM-02).
- [x] Confirmation is hold-atomic and oversell is impossible in tests (SM-03).
- [x] A binding price-drift rule exists from add-to-cart to request (SM-04).
- [x] All money fields are integer minor units (FIN-01).
- [x] Ledger has a documented double-entry invariant and gateway-fee-loss handling (FIN-02).
- [x] `settlement_batches` reserves TCS/GST fields and a return-window holdback rule (FIN-03, FIN-04).
- [x] Every service-role function has a passing cross-tenant denial test (SEC-01/SEC-16).
- [x] Clients read a notification projection, not raw `marketplace_events` (SEC-02).
- [x] DPDP section names the LLM vendor as processor with egress/residency rules (SEC-03).
- [x] `commerce_idempotency_keys` and `marketplace_localities` are in the Phase 1 plan (P1-01, P1-02).
- [x] DOC-13 is updated with remediation status and handoff.

### 9.1 Migration Compliance Checklist (Split Foundation Migrations)

Verify the following against the four split foundation migrations. If any part has already been applied to any environment, an applied migration must never be edited in place — implement corrections as a **follow-up migration** instead.

| File | Part | Applied | Audit |
|---|---|---|---|
| `20260619000001_marketplace_foundation_schema.sql` | Tables + indexes | [x] 2026-06-19 | [x] PASS |
| `20260619000002_marketplace_foundation_helpers.sql` | `marketplace_sec` schema + helper functions + trigger | [x] 2026-06-19 | [x] PASS |
| `20260619000003_marketplace_foundation_rls.sql` | RLS enable + policies | [x] 2026-06-19 | [x] PASS |
| `20260619000004_marketplace_foundation_storage.sql` | Storage buckets + policies | [x] 2026-06-19 | [x] PASS |
| `20260619000005_marketplace_notifications_fk_indexes.sql` | Follow-up: missing FK indexes on `marketplace_notifications` | [x] 2026-06-19 | [x] PASS — see §11 |

- [x] **DD-01 (maintain PASS):** `seller_payout_accounts`, `settlement_batches`, `marketplace_audit_logs` use canonical names; no legacy v0.1 names present.
- [x] **FIN-01 (maintain PASS):** every money column is integer `_minor`; no `_inr`/numeric/float money columns. Confirmed live via `information_schema.columns`.
- [x] **P1-01:** `commerce_idempotency_keys` table exists with RLS enabled (SQL in §7.1).
- [x] **P1-02:** `marketplace_localities` table exists and `stores.locality` is a FK (`locality_id`) to it, with `idx_stores_locality` (SQL in §7.2).
- [x] **FIN-03:** `settlement_batches` reserves `tcs_deduction_minor`, `gst_on_commission_minor`, `tax_adjustments_minor`, `tax_treatment_version` (SQL in §5.3).
- [x] **SEC-04:** the helper is named `marketplace_sec.is_store_admin(store_id)`; storage policies join `store_administrators` AND parse `storage.foldername()`; every FK is indexed (including the follow-up fix in §11).
- [x] **SEC-02:** raw `marketplace_events` client SELECT is removed in favor of `marketplace_notifications` (in `20260619000003_marketplace_foundation_rls.sql`).
- [x] New tables have RLS enabled and all new foreign keys are indexed.

---

## 10. Audit Reconciliation Log (P-1 … P-5)

These five items were raised in the migration audit and are now resolved in-place above.

| ID | Issue | Resolution | Location |
|---|---|---|---|
| P-1 | SM-02/SM-03 hold-timing contradiction | Two-tier hold: soft hold at confirmation, firm hold at acceptance | §4.2 (SM-02), §4.3 (SM-03) |
| P-2 | Money sign ambiguity (signed magnitude vs `direction`) | Magnitude-only `amount_minor` + `direction` column carries the sign | §5.1 (FIN-01), §5.2 (FIN-02) |
| P-3 | Per-`source_id` net-zero breaks on platform-borne loss | Invariant scoped to a balanced `transaction_group_id` with platform clearing accounts | §5.2 (FIN-02) |
| P-4 | DD-01 register incomplete vs DD-02 | Payment/cart/image-extraction tables added to the canonical register | §3.1 (DD-01) |
| P-5 | Dangling `STM-03`; helper name mismatch | `STM-03` defined; plan standardized on `is_store_admin` | §4.4 (SM-04), §6.4 (SEC-04) |

---

## 11. Post-Deployment Audit Log (2026-06-19)

Comprehensive audit run against the live Supabase project after applying all four split migrations. Results recorded here as the permanent compliance record.

### Audit Results Summary

| Area | Check | Result |
|---|---|---|
| Financial integrity (FIN-01/03) | All `_minor` columns are `INTEGER`; zero `_inr` columns | ✅ PASS |
| `settlement_batches` nullability | `gross/net_amount_minor` NOT NULL+DEFAULT 0; TCS/GST/tax fields nullable | ✅ PASS |
| SECURITY DEFINER | All 4 `marketplace_sec` functions have `prosecdef = true` | ✅ PASS |
| Blank search_path | All 4 functions store `search_path=""` (PostgreSQL canonical form for `SET search_path = ''`) | ✅ PASS |
| `anon` EXECUTE revoked | `is_store_admin`, `has_platform_role`, `is_platform_operator` not callable by `anon` | ✅ PASS |
| `marketplace_sec` schema USAGE | `anon` has no USAGE on `marketplace_sec`; not exposed to PostgREST | ✅ PASS |
| Trigger projection (draft store) | Draft store NOT projected into `public_store_profiles` | ✅ PASS |
| Trigger projection (active store) | All-four-conditions UPDATE correctly projected with `locality_name` resolved | ✅ PASS |
| Trigger retraction | Downgrade to `suspended` correctly removed the projection | ✅ PASS |
| CASCADE cleanup | DELETE from `stores` cascaded cleanly to `public_store_profiles` | ✅ PASS |
| `stores.status` CHECK | 8 states match v0.2 spec | ✅ PASS |
| `store_subscriptions.status` CHECK | 6 states match v0.2 spec | ✅ PASS |
| `commerce_idempotency_keys.status` CHECK | 3 states match P1-01 spec | ✅ PASS |
| All other state-machine CHECKs (10 tables) | Match v0.2 spec exactly | ✅ PASS |
| Storage path isolation | All 4 policies use `foldername(objects.name)[1]` + `store_administrators` join + `auth.uid()` | ✅ PASS |
| Public bucket listing | `storefront-assets` and `inventory-photos` have no SELECT policy (API listing blocked) | ✅ PASS |
| Private bucket read | `seller-verification-docs`, `order-dispute-evidence`, `image-extraction-inputs` gated to owner OR platform role | ✅ PASS |
| `marketplace_events` client SELECT | No SELECT/ALL policy on `marketplace_events` (SEC-02) | ✅ PASS |
| Migration history | All 4 migrations recorded in `supabase_migrations.schema_migrations` in correct order | ✅ PASS |
| **FK indexes on `marketplace_notifications`** | **`user_id` and `store_id` columns had NO index — RLS policy caused seq scan on every read** | **⚠️ FAIL → FIXED** |

### Discrepancy Found and Remediated

**ID:** POST-AUDIT-01
**Spec requirement:** SEC-04 — *"Add FK indexes for every new foreign key."*
**Affected table:** `public.marketplace_notifications`
**Missing indexes:** `user_id`, `store_id` — both evaluated in the `notifications select own` RLS `USING` clause.
**Impact:** Sequential scan on every notification read; O(n) cost per authenticated request.
**Root cause:** The schema migration (Part A) created the FK references but did not include `CREATE INDEX` statements for `marketplace_notifications`.
**Remediation:** Follow-up migration `marketplace_notifications_fk_indexes` applied immediately via Supabase MCP:

```sql
CREATE INDEX idx_notifications_user  ON public.marketplace_notifications(user_id);
CREATE INDEX idx_notifications_store ON public.marketplace_notifications(store_id);
```

**Verified:** `pg_indexes` confirms both indexes exist. Status: **CLOSED**.

---

## 12. Related Documents


- [README](../README.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-4: Image-to-LLM Inventory Workflow](../DOC-4-image-to-llm-inventory-workflow.md)
- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-14: Commerce State Machines](../DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](../DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](../DOC-16-pilot-and-unit-economics.md)
- [PHASE-0: Codebase and DB Audit](./PHASE-0-codebase-db-audit.md)
- [PHASE-1: Foundation Schema and Security](./PHASE-1-foundation-schema-security.md)
- [Phase 1 Foundation Schema and Security Implementation Plan](./PHASE-1-foundation-schema-security-plan.md)
