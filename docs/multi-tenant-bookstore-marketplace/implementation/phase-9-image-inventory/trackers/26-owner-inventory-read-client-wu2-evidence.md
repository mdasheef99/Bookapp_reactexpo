# WU2 Read-Only Owner Inventory Client Evidence

**Status:** `locally_complete_authenticated_runtime_deferred`
**Date:** 2026-08-04
**Branch:** `codex/phase9-unit6f-readiness-quality-gates`

## Authorized scope

The attached user request authorized WU2 only: replace the active `/inventory`
direct-table read/mutation orchestration with the applied WU1 page RPC. No
migration, database/storage mutation, dashboard work, Unit 7 behavior, scan or
candidate transport change, broad stale-code deletion, commit, push, or deploy
was authorized.

## Exact-project read-only preflight

Supabase MCP re-verified development project `Bookconnect_reactexpo`, project
ref `ahntbtktjjmvfosgkmgn`, region `ap-southeast-2`, status `ACTIVE_HEALTHY`,
PostgreSQL `17.6.1.063`.

Read-only catalogue evidence confirmed:

- `public.phase9_owner_inventory_page_v1(integer,text,text,text,text,text,text,text)`;
- exact argument names/defaults and `jsonb` return;
- `STABLE SECURITY DEFINER`, postgres owner, empty `search_path`;
- `authenticated` and `service_role` execute, no anonymous execute;
- stable `public.phase9_owner_inventory(uuid)` unchanged; and
- `store_inventory_owner_read_page_idx` on
  `(store_id, updated_at DESC, id DESC)`.

No SQL write or other Supabase mutation occurred.

## Implemented dependency replacement

Old active path:

```text
/inventory → InventoryFoundationScreens → StoreInventoryScreen
→ useStoreInventory → storeInventoryService
→ supabase.from('store_inventory')
```

New active path:

```text
/inventory → InventoryFoundationScreens + InventoryAccessBoundary
→ OwnerInventoryReadScreen → useOwnerInventoryRead
→ ownerInventoryReadService.listPage
→ phase9_owner_inventory_page_v1
```

Retained presentation: `InventoryItem`, `InventoryFilterPanel`,
`ScreenBackground`, `GlassCard`, the Phase 9 Owner access boundary, and
`InventoryHubRecoveryCard`. The item component now accepts a narrow generic
view model; the filter panel has a WU1-exact read mode while preserving its
legacy default.

The active route no longer reaches `StoreInventoryScreen`,
`useStoreInventory`, `storeInventoryService`, direct `store_inventory`,
`AddInventoryForm`, `EditModal`, or `InventoryBulkActions`. The stale modules
were intentionally not deleted because WU2 did not authorize broad cleanup.

## Contract and behavior evidence

- RPC arguments are exactly `p_page_size`, `p_cursor`, `p_query`,
  `p_condition`, `p_visibility_status`, `p_quantity_state`, `p_entry_method`,
  and `p_date_added`; no store hint is accepted or sent.
- Page size is 1–50 with client default 25. The server cursor is forwarded
  unchanged and never decoded or constructed.
- Strict decoding requires exact response/item keys and maps the WU1 DTO to a
  camel-cased UI model. Unknown or malformed data becomes
  `P9_RESPONSE_INVALID`, never partial/empty success.
- `P9_AUTH_REQUIRED`/`P9_OWNER_NOT_AUTHORIZED` map to `unauthorized`;
  `P9_REQUEST_INVALID` to `invalid_request`; `P9_CURSOR_INVALID` to
  `invalid_cursor`; network failures to `unavailable`; and server/unexpected
  failures to bounded `internal` errors.
- Infinite-query keys include user, server-approved store context, contract,
  search, and all filters. Filter/search change resets to page one; stale
  responses remain on their old key; refresh restarts page one; pages append
  deterministically and deduplicate by ID.
- Logout/user/store/session transitions clear the new cache through the
  existing Phase 9 private-query cleanup transaction.
- Initial loading, successful empty, unauthorized, invalid request/cursor,
  unavailable/internal, and partial pagination/refresh failures are distinct.
  Later-page failures preserve loaded rows.
- The active screen passes no select/edit/quantity/publish/pause/bulk callbacks
  and imports no add/edit/bulk components. Scan/review routes and their existing
  Edge/RPC transport were not modified.

## Files changed by WU2

Production/client:

- `src/features/imageInventory/api/ownerInventoryReadService.ts`
- `src/features/imageInventory/queries/ownerInventoryReadQueries.ts`
- `src/features/imageInventory/screens/OwnerInventoryReadScreen.tsx`
- `src/features/imageInventory/screens/InventoryFoundationScreens.tsx`
- `src/features/stores/components/InventoryItem.tsx`
- `src/features/stores/components/InventoryFilterPanel.tsx`

Tests:

- `src/features/imageInventory/__tests__/ownerInventoryReadService.test.ts`
- `src/features/imageInventory/__tests__/ownerInventoryReadQueries.test.tsx`
- `src/features/imageInventory/__tests__/OwnerInventoryReadScreen.test.tsx`
- `src/features/imageInventory/__tests__/ownerInventoryReadArchitecture.test.ts`

Documentation/continuity files are listed by the final session diff and do not
alter product or database behavior.

## Verification receipt

- Red-first focused run: all four new suites failed before their production
  modules/route dependency existed.
- Focused WU2 Jest after correction-review closure: 4 suites / 50 tests
  passed.
- Phase 9 plus relevant legacy inventory/route Jest: 39 suites / 303 tests
  passed; pre-existing CandidateReview `act(...)` console warnings remain.
- TypeScript: `npx.cmd tsc --noEmit --allowImportingTsExtensions` passed.
- Transitive architecture test proves the active route reaches the WU1 RPC
  service and cannot reach direct `store_inventory`, the legacy service, or the
  stale mutation hook.
- Continuity validator passed with `WU1_DIFF_CHECK=PASS`,
  `WU2_DIFF_CHECK=PASS`, `REPOSITORY_DIFF_CHECK=PASS`,
  `PHASE9_CONTINUITY_CHECK=PASS`, `MARKDOWN_FILES_CHECKED=67`, and
  `REQUIRED_PHASE_FILES=53`. Its pre-existing size policy emitted one
  non-blocking split advisory for the 640-line implementation tracker.
- Jest printed its known post-run open-handle warning after both successful
  runs; a focused `--detectOpenHandles` diagnostic did not identify a handle.

## Independent-review correction receipt

The independent review returned `changes_requested` for three local-acceptance
findings. Red tests reproduced all three before production changes:

- offset-invalid/date-only timestamps and `version = 0` were accepted;
- destructive refresh discarded loaded rows before a failed first-page fetch;
- invalid request/cursor, unavailable/internal/malformed response, and
  refresh/next-page contexts were conflated.

The bounded correction now uses the shared offset-aware timestamp schema and a
positive version check; refresh uses a separately cancellable first-page query
and swaps the infinite-query cache only on success; invalid-cursor reset remains
destructive; and screen copy/actions distinguish category and operation context.
The review's P3 architecture-test limitation remains a non-blocking future
hardening note; no unsafe current route dependency was found.

The correction review then identified four remaining F2/F3 cases. Red tests
reproduced cached-refresh page loss, unauthorized retry actions, and
refresh-error/empty-state overlap; the stale-identity diagnostic already passed
through React Query cancellation. The final correction additionally requires
explicit refresh success, a current scope/request-generation match, and no
unauthorized action. It preserves all pages on failed cached refresh, prevents
late identity/filter/unmount/concurrent-refresh cache writes, suppresses empty
success during refresh failure, and shows stale preserved rows without implying
that retry can restore Owner authorization.

The final focused correction review found one remaining F3 loophole: the global
header Refresh control was still mounted during unauthorized initial and
partial states. Two red assertions reproduced it. The header control is now
absent whenever the active category is unauthorized, alongside the already
removed card actions; authorized states retain refresh. The screen suite passes
15/15, focused WU2 remains 4 suites/50 tests, and related regressions remain 39
suites/303 tests.

## Deferred runtime and stop boundary

No approved authenticated Owner JWT/browser session was available. Positive
Owner load, cross-store/inactive denial, all live filters/pagination/DTO keys,
authenticated direct-table denial, cache clearing on real logout/identity
transition, and rendered unauthorized/unavailable runtime states remain
explicitly deferred. WU2 is not fully closed until that matrix passes.

No dashboard work, Unit 7 commit/duplicate/quantity/publication workflow,
migration, database/storage write, deploy, commit, or push was started.

Next authorized action: obtain an approved development Owner session for the
deferred WU1/WU2 runtime matrix; afterward return to the separately gated
representative low-end Android Unit 6F evidence. Unit 7 remains gated.
