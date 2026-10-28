# 05 — Marketplace Rules

**Last checked:** 2026-10-24, against the code and the documents it cites.

This file summarises the rules most often broken by accident. It is a pointer,
not an authority: each rule names the document that owns it. If a summary here
and its source disagree, **the source wins**, and this file should be corrected.

Source documents are in `docs/multi-tenant-bookstore-marketplace/` (short names below):

- **DOC-1** — `DOC-1-identity-security-compliance.md`
- **DOC-3** — `DOC-3-canonical-books-metadata-inventory.md`
- **DOC-12** — `DOC-12-build-strategy-and-implementation-sequence.md`
- **DOC-14** — `DOC-14-commerce-state-machines.md`
- **P6 SDD** — `implementation/PHASE-6-order-request-confirmation-SDD.md`
- **P9 Master** — `implementation/phase-9-image-inventory/00-phase-9-master-sdd.md`
- **Picker SDD** — `implementation/phase-9-image-inventory/work-units/owner-edition-picker-sdd.md`
- **AGENTS** — repository [`AGENTS.md`](../AGENTS.md)

## Separation from the P2P exchange

| Rule | Source |
| --- | --- |
| Bookstore inventory is not P2P `listings`; bookstore orders are not P2P `transactions`; P2P transaction states and borrower/lender assumptions are not bookstore commerce. The marketplace uses its own tables, RLS, services, routes, query keys, state machines and tests. Only generic primitives (user identity, addresses, safe book metadata, location utilities) may be shared. | DOC-12 §3 |
| Avoid broad `SECURITY DEFINER` patterns and unreviewed public storage patterns from the older schema. | DOC-12 §3 |

## Tenancy and authority

| Rule | Source |
| --- | --- |
| Every store-owned row and media object is scoped by a **server-derived** `store_id`. Never trust a store ID from the app, route params, deep links, request bodies, AsyncStorage/MMKV or other client-controlled input. | DOC-1 §4.2; AGENTS "Database and Supabase rule"; P9 Master MAS-03 |
| Store Owner authority comes from an active `store_administrators` owner row plus capability/entitlement checks; platform review authority is an internal platform role, implemented as the `platform_user_roles` table that `store-review` checks. Consumer profile fields grant nothing. | DOC-1 §§3–4.2; P6 SDD §3 (capability resolver); code: `supabase/functions/_shared/marketplaceAuth.ts` |
| AI/provider output is untrusted input. Only validated deterministic code advances state or writes data. | P9 Master MAS-02 |
| No metadata provider is canonical. An accepted edition snapshot comes from one coherent provider result or reviewed manual data; never stitch fields across providers. | DOC-3 §5.2; P9 Master MAS-15 |
| Receiving provider metadata or a cover URL does not grant the right to store it, show it publicly or cache the image. Field-level reuse permissions, attribution and expiry apply, and explicit edition results fail closed without verified retention permission. | DOC-1 §13; Picker SDD §§8, 13.2 |

## Public vs private data

| Rule | Source |
| --- | --- |
| Private inventory and public marketplace data are separate. Only eligible, server-projected fields become public. Consumer code reads projections (`marketplace_book_listings`, `public_store_profiles`), never raw `store_inventory`. | P9 Master MAS-07; DOC-3 §15; DOC-1 §7.2 |
| Scan images, public-copy photos and customer-request photos are separate security and lifecycle classes and cannot be repurposed by path reuse; only validated, approved sanitised derivatives may be promoted to public use. | P9 Master MAS-08; DOC-1 §13 |
| Private inventory fields (shelf location, acquisition cost, internal notes, extraction confidence, duplicate-resolution details) never reach consumer screens or services. | DOC-3 §7; DOC-1 §7.2 |

## Inventory and stock

| Rule | Source |
| --- | --- |
| Stock is held in buckets: `quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed`. Holds move stock between buckets; nothing overwrites reserved or sold quantities directly. The database check was added `NOT VALID`: new inserts and updates are checked, existing rows were not validated. Treat the equation as a rule every command must keep. | P6 SDD §§9.1–9.4; constraint in `supabase/migrations/20260716000001_marketplace_phase6_order_request_core.sql` |
| Direct authenticated inventory counter writes are revoked; stock changes go through locked server commands. | P6 SDD §14 |
| A scanned book becomes inventory only after Owner review and an explicit **Add to Inventory**, and it creates exactly one new private row. A scan never increments an existing row. | P9 Master MAS-05 |
| One candidate's failure never blocks others; each commit is atomic and idempotent. | P9 Master MAS-06 |
| A valid private commit survives a failed publication; publication retries never create or increment inventory again. | P9 Master MAS-11 |
| Quota or cost failures never disable manual inventory entry; provider outages keep the manual path working. | P9 Master MAS-10, MAS-16 |

## Commerce and deferred phases

| Rule | Source |
| --- | --- |
| Order requests follow the DOC-14 state machines; Phase 6 ends at provider-independent `payment_ready`. | DOC-14 §§5–7; DOC-12 Phase 6 |
| Payment, ledger, refunds and settlement belong to Phase 7, and pickup fulfillment to Phase 8 (DOC-13 has their current status). Phase 9 reaches private inventory, public listings and request-photo acceptance only; it never creates payment-provider or paid-order effects. While Phases 7 and 8 are deferred, other phases do not implement their payment, ledger, refund, settlement or pickup behaviour either. | DOC-12 Phases 7–8; P9 Master MAS-09; AGENTS "Authorization boundaries" |

## Process rules

| Rule | Source |
| --- | --- |
| Planning approval ≠ implementation approval ≠ migration creation ≠ migration application. Each needs its own authorization. | AGENTS "Authorization boundaries" |
| Resolve database, RLS, Storage and tenant uncertainty through Supabase MCP, not local migration files alone; re-verify the exact project before creating a migration plan and again before applying it. | AGENTS "Database and Supabase rule" |
| Applied migrations are never edited; corrections are additive. | P6 SDD §14 (AGENTS "Documentation size and structure" adds: never change or split an applied migration for line-count reasons) |
