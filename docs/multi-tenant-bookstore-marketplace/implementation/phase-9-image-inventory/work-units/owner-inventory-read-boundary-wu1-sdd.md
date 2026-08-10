# WU1 Addendum: Controlled Owner-Inventory Read Boundary

Status: design and contract authority for the applied WU1 read boundary. The
draft was applied once to the authorized development project after the
separate self-review/application gate; no client, dashboard, or write-path
change was made. This addendum deliberately re-sequences WU1 ahead of the
currently recorded Phase 9 Unit 6F native gate.

**Application checkpoint (2026-08-04):** Supabase MCP applied the exact draft
`20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql` once to
`Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`), recorded live as
`20260803221216 marketplace_phase9_owner_inventory_read_boundary`. Post-apply
readback passed; positive authenticated Owner runtime remains separately
deferred because no approved Owner JWT was available in this session.

## 1. Authority and evidence

The current user authorization is the scope authority for this bounded WU1.
Existing product and UI behavior remains owned by [DOC-8 §5](../../../DOC-8-store-owner-console.md#5-inventory-module).
Phase 9 server ownership, authorization, quantity, publication, and privacy
rules remain owned by [SDD 00 §§3, 5, 7, and 9](../00-phase-9-master-sdd.md)
and [SDD 03 §§9–13](../03-owner-review-inventory-commit-sdd.md). This addendum
does not replace or reinterpret those documents.

The exact development project was re-verified read-only before this draft:

| Evidence | Verified value |
| --- | --- |
| Supabase project | `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` |
| Status | `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.063`; `ap-southeast-2` |
| `store_inventory.updated_at` | `timestamptz NOT NULL DEFAULT now()` |
| Existing detail RPC | `public.phase9_owner_inventory(uuid) RETURNS jsonb` |
| Existing list RPC | None found |
| Existing useful indexes | store, title, ISBN/condition, publication retry; no owner-page `(store_id, updated_at, id)` index |
| Live table boundary | `authenticated` has no direct `store_inventory` table privileges; this draft adds no table grants |

This is a development-only project. The legacy callers in the repository are
stale internal code paths, not external production consumers. WU1 establishes a
controlled replacement boundary; it does not delete or migrate those callers.

## 2. Decision and non-goals

### 2.1 Detail decision

`public.phase9_owner_inventory(uuid)` is stable and remains intact. WU1 does
not replace, overload, alter, or grant new table access around it.

Its current behavior is preserved exactly:

- input: `p_inventory_id uuid`;
- server reads one `public.store_inventory` row by ID;
- the row is returned only when `marketplace_sec.phase9_is_store_owner(store_id)`
  authorizes the authenticated caller;
- absent and unauthorized rows raise `P9_OWNER_NOT_AUTHORIZED`;
- the JSON object allowlist is exactly
  `id`, `store_id`, `title`, `condition`, `quantity_total`,
  `quantity_available`, `publication_status`, and `version`;
- it remains `STABLE SECURITY DEFINER`, owned by `postgres`, with an empty
  `search_path`, and the current execute grants remain unchanged.

### 2.2 Explicit non-goals

WU1 does not modify routes, screens, hooks, services, Edge Functions, existing
applied migrations, existing live grants or policies, dashboard behavior,
manual creation, duplicate checking, metadata/commercial edits, condition or
damage commands, quantity behavior, publication, pause, bulk operations,
marketplace discovery, or stale-code deletion. It does not redesign the
dashboard or inventory interface. It does not change the Phase 4 UI contract or
the Phase 9 Unit 6F native gate; it only records that this read-contract draft
is sequenced before that gate.

Before the attached user authorization, no Supabase application was authorized
by WU1. That pre-application boundary was consumed exactly once by the
authorized development migration application recorded above; no second
application or unrelated database mutation is authorized by this addendum.

## 3. New list RPC

WU1 adds one separate, read-only contract:

```sql
public.phase9_owner_inventory_page_v1(
  p_page_size integer DEFAULT 25,
  p_cursor text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_visibility_status text DEFAULT NULL,
  p_quantity_state text DEFAULT NULL,
  p_entry_method text DEFAULT NULL,
  p_date_added text DEFAULT NULL
) RETURNS jsonb
```

The caller supplies no `store_id`. The function derives the store from the
authenticated active Owner capability and queries only that store. A returned
`store_id` is informational DTO data, never an authority input.

The response is exactly:

```json
{
  "contractVersion": "phase9-owner-inventory-v1",
  "items": [/* OwnerInventoryListItem[] */],
  "pageInfo": {
    "nextCursor": "string|null",
    "hasMore": "boolean"
  }
}
```

### 3.1 List DTO allowlist

Every item contains exactly these keys. No raw extraction, provider,
internal-note, acquisition-cost, exact inventory-bucket, customer, order,
media-path, or authorization fields are returned.

| Key | Type | Meaning |
| --- | --- | --- |
| `id` | UUID | Inventory row identity; detail/command lookup identity only. |
| `store_id` | UUID | Server-derived owner store echoed for display/debug; never client authority. |
| `title` | text | Store-owned display title. |
| `authors` | text[] | null | Store-owned author display values. |
| `isbn_10` | text | null | Safe inventory identifier. |
| `isbn_13` | text | null | Safe inventory identifier. |
| `condition` | text | Current persisted condition value. |
| `quantity_available` | integer | Owner-facing available quantity only. |
| `selling_price_minor` | integer | Owner-facing current price in minor units. |
| `visibility_status` | text | Owner inventory/listing status. |
| `listing_quality_status` | text | Controlled listing-readiness status. |
| `public_notes` | text | null | Owner’s public listing note; included because the existing console edit flow reads it. |
| `shelf_location` | text | null | Owner-private location; included for the existing console edit flow and never public-projected. |
| `entry_method` | text | `manual`, `image_extraction`, or `metadata_import`. |
| `created_at` | timestamptz | Inventory creation timestamp; supports date-added filtering. |
| `updated_at` | timestamptz | Ordering key; live column is non-null. |
| `version` | integer | Current optimistic-concurrency version for a later separately authorized command boundary. |

The allowlist is intentionally aligned with the current Phase 4 inventory list
and edit surface. Adding a field later requires a separately reviewed contract
version, not an accidental `SELECT *` expansion.

## 4. Filters and semantics

All filters are optional. Omitted, empty, or `NULL` means `all` for categorical
filters. Unknown values raise `P9_REQUEST_INVALID`; they are never silently
ignored.

| Argument | Accepted values and semantics |
| --- | --- |
| `p_query` | Trimmed substring, maximum 100 characters, matched case-insensitively against `title`, each `authors` element, `isbn_10`, or `isbn_13`. It is a literal substring, not a wildcard expression. |
| `p_condition` | Exact value: `new`, `like_new`, `very_good`, `good`, or `acceptable`. This follows the active Phase 9 condition check; WU1 does not create a condition mapping or write path. |
| `p_visibility_status` | Exact live constrained value: `draft`, `needs_review`, `published`, `paused`, `out_of_stock`, or `blocked`. |
| `p_quantity_state` | `available` means `quantity_available > 1`; `low_stock` means `= 1`; `out_of_stock` means `= 0`; `all` has no quantity predicate. These are the current console filter semantics. |
| `p_entry_method` | Exact value: `manual`, `image_extraction`, or `metadata_import`. |
| `p_date_added` | `last_7_days` or `last_30_days`, measured against the first-page `asOf` ordering horizon using `created_at`; `asOf` is not a repeatable database snapshot; `all` has no date predicate. |

The filter context is part of every cursor. A later page with a changed query,
filter, page size, actor, store, contract, or ordering returns
`P9_CURSOR_INVALID` rather than silently restarting.

Page-size handling is fail-closed: omitting `p_page_size` uses the declared
default of 25, while an explicit `NULL`, zero, negative value, or value above
50 raises `P9_REQUEST_INVALID`. An explicit `NULL` is never treated as an
unbounded SQL `LIMIT`.

## 5. Deterministic pagination

The list is ordered descending by the stable pair
`updated_at DESC, id DESC`, where `id` is the persisted `store_inventory.id`
column. `updated_at` is non-null in the verified schema; the UUID ID is the
final tie-breaker. The SQL predicate for a later page is the
strict keyset comparison:

```sql
(updated_at, id) < (cursor.updatedAt, cursor.id)
```

Offset pagination is not used. The function reads `page_size + 1` rows, returns
at most `page_size`, sets `hasMore` from the extra row, and emits a cursor from
the last returned row only when another row exists. `page_size` is an integer
from 1 through 50; the default is 25.

The first page captures `asOf = transaction_timestamp()`. The query excludes
rows whose `updated_at` is later than that value, and the cursor carries the
same `asOf`. In WU1 this is an ordering horizon, not a repeatable database
snapshot: it prevents rows whose ordering timestamp advances after the first
page from entering the old chain, but it does not freeze every DTO field or
filter-relevant value across separate page transactions. Existing quantity and
publication write paths can change values without changing `updated_at`; WU1
does not modify those write paths. A caller may therefore observe current row
state in an older cursor chain, and full cross-page state consistency is not
promised. A row with a newly advanced `updated_at` may be observed on a fresh
first page, not inside the old chain. Deletion can reduce a later page; keyset
ordering still prevents offset-style drift and duplicate IDs for the ordering
horizon.

### 5.1 Cursor encoding and validation

The list reuses the existing private Phase 9 signed cursor helper. Its external
format is the existing base64-encoded JSON payload followed by a dot and the
server-side SHA-256 signature. WU1 does not expose the signing secret.

The signed payload contains exactly the context needed to validate a page
chain, including:

```json
{
  "kind": "inventory",
  "actor": "authenticated-user-uuid",
  "store": "server-derived-store-uuid",
  "query": "normalized-query",
  "condition": "all|condition",
  "visibility": "all|status",
  "quantity": "all|quantity-state",
  "entry": "all|entry-method",
  "dateAdded": "all|date-filter",
  "size": 25,
  "contract": "phase9-owner-inventory-v1",
  "order": "updated_at.desc,id.desc",
  "asOf": "RFC3339 timestamp",
  "updatedAt": "last-row timestamp",
  "id": "last-row UUID"
}
```

Malformed base64, an invalid signature, missing/invalid ordering values, a
changed context, a changed page size, or a cursor from another actor/store
raises `P9_CURSOR_INVALID`. The function never accepts a caller-supplied store
or trusts an unsigned cursor.

## 6. Authorization, security, and ownership

The function first calls the existing server-side
`marketplace_sec.phase9_owner_ux_assert_owner()`. It therefore requires:

- a non-null authenticated `auth.uid()`;
- an active `store_administrators` Owner relationship;
- an active store with complete setup and selling allowed; and
- the derived store to scope every inventory row.

Unauthenticated callers receive `P9_AUTH_REQUIRED`; authenticated non-Owners,
inactive Owners, and invalid store capability receive
`P9_OWNER_NOT_AUTHORIZED`. No client store hint is accepted.

The draft function is `STABLE SECURITY DEFINER`, owned by `postgres`, and pins
`search_path=''`. The draft revokes execute from `PUBLIC`, `anon`,
`authenticated`, and `service_role` before granting only `EXECUTE` to
`authenticated` and `service_role`. It grants no table privileges, creates no
RLS policy, and does not alter the existing detail function’s grants.

## 7. Structured errors

The SQL boundary preserves the registered safe categories relevant to this read
and maps unexpected database failures to `P9_INTERNAL_ERROR` without returning
the underlying PostgreSQL message or private row data:

| Code | Adapter status | Meaning |
| --- | ---: | --- |
| `P9_AUTH_REQUIRED` | 401 | No authenticated actor. |
| `P9_OWNER_NOT_AUTHORIZED` | 403 | Actor is not an eligible Owner for the derived store. |
| `P9_REQUEST_INVALID` | 400 | Page size, filter, or query bound is invalid. |
| `P9_CURSOR_INVALID` | 400 | Cursor is malformed, tampered, or bound to another context/order. |
| `P9_INTERNAL_ERROR` | 500 | Unexpected database failure; the underlying database message and private row data are not returned. |

HTTP mapping is an adapter concern and is not implemented in WU1 because
routes, services, and Edge Functions are explicitly out of scope.

## 8. Index evidence and migration boundary

The verified live table has store, title, ISBN/condition, canonical/source, and
publication-retry indexes, but no composite index matching the new mandatory
tenant plus descending keyset order. The draft therefore creates only:

```sql
store_inventory_owner_read_page_idx
  ON public.store_inventory (store_id, updated_at DESC, id DESC)
```

No search, filter, or speculative covering indexes are added. Their need must
be measured after the boundary exists and reviewed separately.

The forward draft was
`20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`. It was
applied exactly once as
`20260803221216 marketplace_phase9_owner_inventory_read_boundary`; it must not
be reapplied or replaced by another migration under this work unit.

## 9. Red tests and completion gate

`marketplacePhase9OwnerInventoryReadBoundary.test.ts` is written before the
draft and is red against the pre-WU1 repository. It checks the exact signature,
allowlists, signed cursor context, keyset predicate, bounds, owner derivation,
security attributes, narrow grants, no detail-RPC redefinition, and the
evidence-backed index. The companion PGlite test applies the draft to an
isolated local database and exercises supported page boundaries, equal-timestamp
ordering, filters, empty results, malformed cursors, owner scope, and unexpected
helper-failure normalization. These tests are local behavior evidence only;
WU1 completion does not mean exact-project JWT/RLS behavior or client
integration is verified.

## 10. Post-application gate and remaining runtime

The exact-project application and post-application readback are complete. The
recorded receipt covers the live migration version, function
security/owner/search path, execute privileges, index definition, unchanged
detail RPC/table boundary, and anonymous denial. Positive Owner, cross-store,
inactive-Owner, filter, cursor-context, live-DTO, and authenticated direct-table
runtime cases remain deferred until an approved Owner JWT is available; no
client cutover, legacy-caller change, or second migration application is
authorized by WU1.
