# WU2 Addendum: Read-Only Owner Inventory Client Integration

**Status:** `locally_implemented_runtime_deferred`
**Date:** 2026-08-04
**Environment:** development application; no production rollout

## 1. Authority and source traceability

The 2026-08-04 attached user authorization owns this bounded WU2 and
supersedes only the prior handoff statement that client cutover was not yet
authorized. Product behavior remains owned by DOC-8 §5. Server-derived Owner
scope, private/public separation, and no direct client inventory write remain
owned by Phase 9 SDD 00 §§3, 5, 7, and 9 and SDD 03 §§9–13. The applied RPC,
DTO, filter, cursor, and safe-error contract remains owned by the
[WU1 addendum](./owner-inventory-read-boundary-wu1-sdd.md) §§3–7.

WU2 authorizes only the read-only `/inventory` client integration described
here. It does not authorize a migration, database/storage write, dashboard
change, stale-module deletion, inventory mutation, Unit 7 workflow, or change
to scan/review transport.

## 2. Decision and route boundary

The canonical Owner inventory route is:

```text
/(store-owner)/inventory
→ InventoryHubFoundationScreen + InventoryAccessBoundary
→ OwnerInventoryReadScreen
→ useOwnerInventoryRead
→ ownerInventoryReadService.listPage
→ public.phase9_owner_inventory_page_v1
```

The active route must not import or transitively reach `StoreInventoryScreen`,
`useStoreInventory`, `storeInventoryService`, or
`supabase.from('store_inventory')`. The old Phase 4 modules remain in the
repository only for separately gated cleanup or historical callers.

## 3. RPC adapter and strict client DTO

The dedicated service calls only
`phase9_owner_inventory_page_v1` with the exact eight WU1 arguments:

| RPC argument | Client source |
| --- | --- |
| `p_page_size` | bounded integer 1–50; WU2 default 25 |
| `p_cursor` | opaque server value or `null` |
| `p_query` | trimmed text up to 100 characters or `null` |
| `p_condition` | supported condition or `null` for all |
| `p_visibility_status` | supported visibility status or `null` for all |
| `p_quantity_state` | supported quantity state or `null` for all |
| `p_entry_method` | supported entry method or `null` for all |
| `p_date_added` | supported date window or `null` for all |

No client `store_id` is accepted or sent. The cursor is never decoded,
constructed, edited, or signed by the client.

The runtime decoder requires exact top-level `contractVersion`, `items`, and
`pageInfo` keys; exact `nextCursor`/`hasMore`; and the exact WU1 item allowlist.
Unknown keys, malformed UUIDs/timestamps/enums, invalid integer values, and
contract-version drift fail closed. The typed UI model maps database casing to
`id`, `storeId`, `title`, `authors`, `isbn10`, `isbn13`, `condition`,
`quantityAvailable`, `sellingPriceMinor`, `visibilityStatus`,
`listingQualityStatus`, `publicNotes`, `shelfLocation`, `entryMethod`,
`createdAt`, `updatedAt`, and `version`.

Timestamps must satisfy the repository's offset-aware ISO datetime schema;
date-only and implementation-dependent `Date.parse` formats are invalid.
Projection `version` is a positive integer, matching the live table contract.

## 4. Query, pagination, and identity isolation

The read hook uses a TanStack infinite query whose key includes:

- the Phase 9 private-query root and contract versions;
- authenticated Owner user ID;
- server-approved current store ID from the existing Owner gate; and
- normalized query plus every supported filter.

Filter/search changes create a fresh first-page query. React Query cancellation
signals are forwarded where the Supabase request supports them, and distinct
keys prevent older responses from replacing current-filter data. Pages append
in server order and deduplicate by inventory ID while preserving the first
observed row. Refresh fetches a separate first page and replaces accumulated
pages only after that request succeeds, so a refresh failure preserves loaded
rows. Invalid-cursor recovery remains a deliberate destructive reset to the
first page. One retry is allowed only for typed retryable reads. A later-page failure keeps
already loaded rows and exposes a retry/reset action.

The refresh cache swap requires an explicitly successful result from the
current identity/filter request generation. Filter, identity, unmount, and
newer-refresh transitions fence late continuations from repopulating stale or
removed private caches; failed refreshes never recommit cached prior data.

The new keys remain under the existing Phase 9 private inventory root, so
`coordinateImageInventoryIdentity` and `clearImageInventoryIdentityState`
cancel/remove them on logout, user replacement, store-context replacement, or
session invalidation before a new identity is authorized.

## 5. Read-only presentation and states

WU2 reuses `InventoryItem`, `InventoryFilterPanel`, the Phase 9 access boundary,
theme/layout primitives, and the existing scan recovery header. It passes a
narrow presentation model to `InventoryItem` and uses an Owner-read filter mode
whose values exactly match WU1.

The active route imports no add/edit/bulk components and passes no item action
callbacks. Manual add, duplicate check, edit, quantity, publish, pause,
archive/delete, and bulk actions are therefore absent rather than disabled.

The screen distinguishes:

- Owner access resolution;
- initial RPC loading;
- successful empty results;
- unauthorized/no eligible Owner access;
- invalid request/cursor with first-page reset;
- unavailable versus internal/malformed-response failure with truthful retry
  copy; and
- separately labelled next-page and refresh failures while preserving loaded
  rows.

Unauthorized states provide no card, header, or other screen-level retry action
that could imply access may be granted locally. A refresh error suppresses
successful-empty presentation even when the last successful page was empty.

Errors are never converted to an empty array or undefined success.

## 6. Verification and completion gate

Required local evidence is strict service decoding/translation, infinite-query
pagination/reset/stale protection/cache isolation, screen-state/read-only
coverage, a transitive route architecture check, relevant legacy inventory and
Phase 9 route regressions, TypeScript, continuity, and diff hygiene.

WU2 is only locally complete until an approved authenticated development Owner
session verifies positive Owner load, cross-store denial, inactive-Owner
denial, filters/pagination/live DTO, direct table denial, logout transition,
and unauthorized/unavailable presentation. No user/store fixture may be
created solely to close that gate without separate authorization.
