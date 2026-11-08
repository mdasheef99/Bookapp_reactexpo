# Phase 7/8 Admin Console Proposal

**Status:** option B approved by the owner on 2026-11-07 (separate admin website in the same
repo, server functions only). Not a source specification; DOC-9 is updated in the
documentation pass. No implementation authority until DOC-13 records the phase resumption.
**Related:** [DOC-9 Platform Operations and Admin](../DOC-9-platform-ops-admin.md) (§2.1 admin
MVP primitives, §14 security), [decision register](./PHASE-7-8-decision-register.md),
[question bank](./PHASE-7-8-question-bank.md) (question bank items 104–106, E19, E30; decisions D-08, D-20 to D-22)

---

## 1. The problem

Once real money flows, payments, refunds, payouts, and courier cases will go wrong every
week, and someone must act:

| Situation | Required action |
|---|---|
| Customer paid but no order appeared (crash, delayed webhook) | Find it; create the order or refund |
| Return or dispute | Review both sides' evidence; approve or reject the return request or dispute at any amount (D-38); an approved return's refund is released automatically after the store's inspection passes |
| Return, dispute, or goodwill refund above ₹1,000 (D-22, D-29); automatic refunds run at any amount with an alert afterwards | A person approves it |
| BookConnect records disagree with Cashfree's report | Investigate and correct, with a recorded reason |
| A store owes money after a refund | See its balance; recover from the next payout or by repayment |
| Chargeback received | Record it, gather evidence, decide who pays |
| Store payout failed (wrong bank details) | See it; retry after correction |
| Serious incident | Stop new payments at once while refunds keep working |

As of 2026-11-07 the app has only customer (`(tabs)`), store-owner (`(store-owner)`), and
login (`(auth)`) route groups. No admin surface exists. DOC-9 §2.1 requires refund/dispute,
reconciliation, and settlement queues before live payments.

**The main risk is not the missing screen.** Without one, finance tables get edited directly
in the Supabase dashboard. That bypasses every money rule: no double-refund protection, no
ledger entry, no record of who acted or why.

## 2. How larger companies handle it (general industry practice, not researched here)

- A separate internal back-office web app used only by staff on desktop; never shipped in the
  customer app; behind company sign-in and two-factor login.
- Strict roles: support can view orders but not move money; finance approves refunds; very
  few people can pause payments.
- Two-person approval for large refunds and adjustments (maker-checker).
- A full audit trail of every action: who, what, when, why.
- Customer support often runs in a separate ticketing tool (Zendesk, Freshdesk) linked to
  the ops console.
- Startups often begin with an internal-tool builder (Retool, Appsmith) or a framework admin
  on top of their own server functions, then build a custom console later.

## 3. Options

| Option | Pros | Cons |
|---|---|---|
| A. Hidden admin section inside the existing app | Fastest, same codebase | Admin code ships in the mobile app; mobile screens are poor for this work; mixes customer and staff security |
| **B. Separate admin website in the same repo (recommended)** | Clean security separation, desktop-friendly, own login rules, same Supabase and server functions | Somewhat more setup at the start |
| C. Third-party tool (Retool or similar) | Very fast screens | Another company gets access to money data; monthly cost; risk of direct table editing |

DOC-9 §14 already requires platform admin APIs to be separate from store-owner APIs, which
fits option B.

**Core principle for every option:** the console only calls **server functions**. Each
function checks the admin role, applies the money rules, and writes an audit record. The
console is buttons and lists over those functions. No direct dashboard edits to finance
tables, ever.

## 4. Scope

### 4.1 Before live payments (must-have)

| # | Module | What it does |
|---|---|---|
| 1 | Access and audit | Admin login with two-factor; admin role; log of every action with its reason |
| 2 | Order and payment lookup | Search by order, customer, or store; one timeline of payment attempts, webhooks, states, and ledger lines |
| 3 | Exception queue | Stuck or unknown payments; paid-but-no-order; late payments; unacknowledged orders past the deadline; failed webhooks |
| 4 | Refunds | Approve or reject return requests and disputes at any amount (D-38), with a typed reason above ₹1,000; goodwill refunds; full or partial; status until money returns |
| 5 | Returns and disputes | Customer and store evidence side by side; decision with reason; store-fault record |
| 6 | Store money | Each store's earned, paid, and owed amounts; payouts and failures; recovery adjustments; payout pause |
| 7 | Reconciliation | Cashfree report vs BookConnect records; mismatches resolved with a reason |
| 8 | Chargebacks | Record, evidence, outcome, who pays |
| 9 | Store controls | The three store permissions (orders, online payment, payouts — BC-41); Cashfree vendor status; suspend; fault counts |
| 10 | Emergency and settings | Global or per-store pause of new payments (refunds keep working); fee and deadline settings with a change log |

### 4.2 Later

| # | Module | When |
|---|---|---|
| 11 | Delivery problems: failed rider pickups, failed deliveries and return to store, lost parcels, cause recording for D-09 (weight disputes only if a courier option is added) | With delivery (weeks 5–6) |
| 12 | Customer complaints with ticket numbers (E-Commerce Rules: acknowledge in 48 hours, resolve in one month) | Before live; suggestion: free tier of Freshdesk or Zoho Desk instead of building |
| 13 | Listing moderation, analytics, team roles, two-person approval | After the pilot |

### 4.3 Parameters every module defines

- Who may use it (role).
- What customer data it shows (minimum necessary).
- Allowed actions and amount limits (for example, return, dispute, and goodwill refunds
  above ₹1,000 require admin approval with a typed reason; automatic refunds run at any
  amount with an alert above ₹1,000; D-22, D-29).
- Settings it owns, each with a change log: loss cap (D-08), refund approval threshold
  (D-22), starter store limits (D-20), suspension rule (D-21), delivery pincodes (D-18).
- A mandatory reason for every money action.
- Deadline timers where relevant.
- An audit record for every action.

## 5. Size and timing

| Part | Size | When |
|---|---|---|
| Server-side admin functions | About 3–4 days; mostly built inside the payment, refund, and payout slices anyway | Weeks 2–4, used through scripts during test-mode building |
| Admin website, modules 1–10 | About 6–8 screens; about 1.5 weeks with Codex Sol and reviews | In parallel with the delivery weeks (5–6); different files |
| Delivery module (11) | About 2 days | Week 6 |
| Complaint ticketing (12) | About half a day of setup with an off-the-shelf tool | Before live |

Timeline effect: payments and pickup in 4 weeks is unchanged (scripts over real server
functions). With the console running alongside delivery, everything works in test mode in
about 6 weeks, possibly 7.

## 6. Decision (recorded)

Option B (a separate admin website in the same repo, calling only audited server functions,
with scripts over the same functions during test-mode building) was approved by the owner
on 2026-11-07 (handoff §3 item 5). It is built during the delivery weeks. Customer complaint
tickets use an off-the-shelf tool; the choice (Freshdesk or Zoho Desk free tier suggested)
is confirmed when module 12 is set up.
