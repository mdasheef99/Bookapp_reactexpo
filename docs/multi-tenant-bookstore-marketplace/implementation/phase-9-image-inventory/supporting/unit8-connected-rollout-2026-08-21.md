# Unit 8 connected rollout evidence — 2026-08-21

## Scope and target

This record captures the authorized connected Unit 8 rollout against the
development Supabase project `Bookconnect_reactexpo`
(`ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`,
`ap-southeast-2`). The repository source was checked out at
`phase9-unit8-u8b-bookstore-discovery`, HEAD `a47ac76455a6e89e2d56da91558efb3b2e680bb4`.

The rollout was forward-only. No historical migration replay or repair,
unrelated migration, source edit, Storage/business-data fixture mutation,
Edge/service deployment, or Vault-secret replacement was performed.

## Preflight and Vault

- The target project was reverified healthy.
- M49, M50, M51, Q08, Q09, Q10, and the M51 asset guard were absent before
  application; all approved prerequisites, `extensions` pgcrypto, and Vault
  infrastructure were present.
- Existing eligible media preconditions were clear: one eligible link, zero
  invalid orders, duplicate-order groups, NULL eligible orders, or inventories
  over three.
- A new cryptographically strong `phase9_q08_cursor_secret` was provisioned
  with `vault.create_secret`. Metadata readback showed one resolvable secret
  meeting the minimum length; its value was never logged or returned.

## Migration applications

Each migration was applied individually through the explicit Supabase migration
application path and read back exactly once:

| Local migration | Live version | Result |
| --- | --- | --- |
| `20260818000049_marketplace_phase9_bookstore_first_discovery.sql` | `20260821060156` | PASS |
| `20260820000050_marketplace_phase9_storefront_detail.sql` | `20260821060742` | PASS |
| `20260821000051_marketplace_phase9_public_media_order_invariant.sql` | `20260821061213` | PASS |

## Connected verification

- Q08: bookstore search, grouping/ranking, no-result behavior, encrypted
  cursor round-trip, malformed/tampered/policy-bound cursor rejection, and
  privacy-safe DTOs passed. A valid public query returned one bookstore; no
  Q08 continuation was available in the current one-store dataset.
- Q09: storefront returned four title groups. Page-size-one continuation
  returned a second page with zero listing overlap. Malformed, expired, and
  wrong-store match contexts degraded to `unavailable` without leaking data.
- Q10: eligible detail returned `q10-v1`; the live public-media listing
  returned one gallery item with valid order, ascending order/id behavior, and
  no private fields. Unknown listings returned NULL.
- Anon and authenticated role probes invoked Q08, Q09, and Q10 successfully;
  private table SELECT remained denied. Legacy v2 projection RPCs remained
  available only through their trusted compatibility path.
- Stock readback found ten positive-stock inventory rows and zero zero-stock
  rows, so no destructive zero-stock fixture was created. Existing listing
  availability remained bounded to `low_stock` and `confirmation_required`.
- Phase 9 continuity validation passed.

## Media invariant

M51 readback confirms the intended bounded contract:

- publicly eligible links require non-NULL `public_order` in `1..3`;
- the existing unique `(inventory_id, public_order)` index supplies per-
  inventory uniqueness and therefore the three-slot maximum;
- the existing nullable `smallint` column preserves NULL for private/staging
  or otherwise noneligible links;
- link approval/update and later media-asset lifecycle transitions are guarded;
- the existing `1..3` check rejects order 4; no cardinality redesign was added;
- live counts remain zero for invalid, duplicate, NULL-eligible, and over-three
  cases;
- Q10 remains ordered by `public_order,id` and bounded to three.

No live write fixture was inserted solely to force a negative order-4 or
fourth-item rejection; enforcement was verified from the live check, unique
index, trigger definitions, and invariant counts.

## Verdict and handoff

**`UNIT8_LIVE_ROLLOUT_PASS`**. Unit 8 is live-verified on the development
project. The next action is repository integration/release handling; `main`
must remain an operator-controlled merge target, and the next Phase 9 work unit
requires a separate scope decision. Native Unit 6F validation remains deferred
and unrelated.

## Repository integration follow-up

After this connected evidence was captured, the pushed
`phase9-unit8-u8b-bookstore-discovery` branch was fast-forwarded into `main`
at release commit `4c1d98d` and `origin/main` was pushed. No additional live
database change, migration-history repair, unrelated deployment, or protected
housekeeping-file change occurred during that repository integration.
