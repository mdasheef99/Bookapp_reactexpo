# Unit 7C SDD: Owner Store View and Post-Commit Inventory Management

**Status:** normative design frozen 2026-08-14; WU1-WU5 locally complete; M46 correction and resumed connected canary PASS 2026-08-16; integrated into `main` at `2be793e6212b1b485737c5045d701c99169490e4`
**Authority:** final Owner contract reconciliation ending `UNIT_7C_READY_FOR_SDD`; DOC-3 §§5.3, 6–9, 14–16; DOC-4 §§2, 9–11, 14–15; DOC-5 §§5, 10–15; DOC-8 §§2–5, 8, 14–15; Phase 9 master SDD §§3–7, 9, 12–14; Unit 7A §§11, 13–20; Unit 7B §§2–15, 18–21.
**Implementation checkpoint:** WU1-WU5 are locally complete; M43-M45 remain byte-immutable and M46 is live exactly once as `20260816150126`. The exact M46 correction is committed at `f4a9e858396474dcd08123eb976a47b019ef26f8` and integrated into `main` at `2be793e6212b1b485737c5045d701c99169490e4`; deployed Owner Edge v8 still serves source HEAD `5cfc08ebbe8b20a94cbf6d0616d894a840bc8882` with JWT verification enabled. M46 gates public-revision insertion on `v_public_changed`; the exact M01→M46 proof, authenticated private-only Save reproof, and resumed connected stale/stock/publication/media/history/browser canary passed. Final canary readback is inventory version `6`, publication intent version `4`, four revisions, nine audit/events, one approved public media link, and stable listing identity. The original false revision is preserved intentionally; no repair/reset or historical rewrite occurred.
**Migration authority:** M46 application authority is exhausted after the single approved application. The bounded connected canary is complete; no additional migration, Edge redeploy, or further connected business mutation is authorized by this handoff.

## 1. Decision and scope

After Unit 7A commits a reviewed candidate, the returned `inventoryId` becomes the stable Owner-management identity. Inventory remains the acquisition, processing, recovery, and review workspace. Store View becomes the sole rich post-commit management surface for the committed `store_inventory` item.

`store_inventory` remains the authoritative committed Owner record. `marketplace_book_listings` remains a customer-safe derived projection. Unit 7C adds controlled reads and commands for details, stock, media, and history while reusing Unit 7B publication lifecycle behavior unchanged.

This decision narrowly supersedes DOC-8 §§3/5 where the older recommended IA puts the committed inventory list and publication controls inside Inventory and presents Storefront as a primary tab. All unrelated DOC-8 console behavior remains intact.

## 2. Normative architectural guarantees

1. `inventoryId` is stable through Private, Live, Paused, Needs Attention, and Out of Stock.
2. `listingId` is neither the Owner identity nor guaranteed stable after retraction/republish.
3. `store_inventory` owns every committed Owner-effective inventory value.
4. `marketplace_book_listings` is projection-only; no Owner UI or Unit 7C command writes it directly.
5. Clients use versioned Owner DTOs and controlled Edge/RPC operations only.
6. Clients cannot directly write inventory, listing, media-link, audit/event, or history tables.
7. The server derives store ownership; no mutation accepts caller-authoritative `storeId`.
8. Cross-store and nonexistent inventory IDs fail through the same non-enumerating boundary.
9. Every Unit 7C mutation carries and locks against exact `inventory.version`.
10. Existing lifecycle commands also retain Unit 7B's publication-intent-version fence.
11. Exact idempotent replay returns the canonical result with zero new effects.
12. Reusing an idempotency identity with a changed fingerprint fails without effects.
13. Ordinary Save Changes is one synchronous PostgreSQL transaction.
14. Any Save failure rolls back the inventory edit and preserves the prior live projection.
15. Ordinary edits expose no persistent or UI-only `Updating` state.
16. Stock is a separate operational command, not an ordinary detail edit.
17. A valid live `1 -> 0` commits and projects out-of-stock/unavailable without lifecycle error.
18. A valid live `0 -> 1` restores public availability synchronously when otherwise eligible.
19. Raw, private, staged, failed, or unapproved media never becomes public.
20. Replacement retains the old approved media until the approved swap commits atomically.
21. Owner metadata edits affect committed inventory only; canonical/provider records stay unchanged.
22. Automatic enrichment never silently overwrites Owner-approved committed metadata.
23. Activity/audit history and exact public revision history are distinct truths.
24. Effective state, attention reasons, and capabilities are server-composed, not React-derived.
25. Out of Stock is a valid stock state, not by itself a Needs Attention reason.

## 3. Owner information architecture and handoff

Primary Owner tabs are `Dashboard | Inventory | Store View | Orders | Subscription`. Store Profile is secondary settings at `/(store-owner)/store-profile`; legacy `/(store-owner)/storefront` may remain only as its compatibility redirect during cutover.

Inventory owns scan/start capture, session resume, processing/recovery, review queue, candidate review, add-missed-book, and session summary/close. It no longer owns the rich committed-book list, publication controls, or public-photo management after cutover.

After Add to Inventory, the app stays in multi-candidate review, offers **Continue Reviewing**, and may offer **View in Store View** using the returned `inventoryId`. It never forces navigation. Target routes are:

```text
/(store-owner)/store-view
/(store-owner)/store-view/[inventoryId]
```

## 4. Store View aggregate, states, and actions

The conceptual `StoreInventoryItem` aggregate contains `identity`, `ownerEffectivePresentation`, `stock`, `lifecycle`, `attention`, `capabilities`, `versions`, `publicMedia`, `publicState`, and `historySummary`. DTOs represent these domain concepts rather than the needs of an initial React card.

| Effective state | Server-authorized actions |
| --- | --- |
| Private | Edit, Publish, Manage Photos |
| Live | Edit, Pause, Make Private, Manage Photos |
| Paused | Edit, Republish, Make Private, Manage Photos |
| Needs Attention | Fix according to the bounded reason and returned capabilities |
| Publication Failed | Retry publication only when server-marked retryable |
| Out of Stock | Adjust Stock; other actions only when returned by the server |

The detail route is the unified management hub: Book summary, Status/actions, Selling details, Stock/private operations, Photos, and Activity/history. It may reuse customer visual primitives, but it is Owner-oriented and may show safe private operations. Pixel identity with the customer experience is not required.

## 5. Store View read contracts

Provide versioned, controlled Owner reads for a page and detail; neither accepts caller store authority nor returns raw listing rows.

```text
StoreViewPageItem {
  identity { inventoryId }
  presentation
  stockSummary
  lifecycle { publicationState, effectiveState }
  attention { attentionState, attentionReasons[] }
  capabilities[]
  versions { inventoryVersion, publicationIntentVersion }
  mediaSummary
  publicState
}
StoreViewPage { items[], pageInfo /* opaque */ }
```

The detail extends the same aggregate with the full allowed Owner-effective presentation, private operations (`shelfLocation`, `internalNotes`), exact stock buckets, Owner-safe media records, and history summary. It contains no duplicate desired/current presentation model and no ordinary edit-sync state.

The page-v2 read accepts only `all`, `private`, `live`, `paused`,
`needs_attention`, and `out_of_stock`. It composes the authoritative Store View
item first, filters on that item's server-composed bucket, and only then applies
stable `(updated_at DESC, id DESC)` keyset pagination. `all` has no state
restriction; `private`, `live`, `paused`, and `out_of_stock` match
`effectiveState`; `needs_attention` matches `attentionState = action_required`.
Its opaque versioned cursor is bound to the authenticated actor/store and filter,
and is rejected when that context changes. M43 composes
`publication_failed` as a distinct effective state while also returning
action-required attention; page v2 preserves that composition, so such rows are
available under both `all` and `needs_attention` and are never relabeled as
`needs_attention`.

`attentionState` is `none | action_required`. The only Unit 7C `attentionReasons` are: `missing_metadata`, `missing_price`, `missing_condition`,
`damage_evidence_required`, `not_sellable`, `moderation_blocked`,
`store_policy_blocked`, `subscription_restricted`, `entitlement_blocked`,
`active_listing_limit_reached`, and `publication_failed`.

Capabilities are limited to `edit_details`, `adjust_stock`, `manage_photos`,
`publish`, `pause`, `republish`, `make_private`, and `retry_publication`.
Out of Stock lives in `stockSummary/effectiveState`, never in attention reasons.

## 6. Ordinary Save Changes

```text
UpdateStoreInventoryDetails {
  inventoryId, expectedInventoryVersion, changes, idempotencyKey, commandId
}
```

The exact editable fields are `title`, `authors`, `language`, `publicDescription`, `sellingPriceMinor`, `condition`, `publicConditionNote`, `hasDamage`, `damageTypes`, `damageNote`, `isSellable`, `shelfLocation`, and `internalNotes`.

Excluded are all quantity fields; visibility/publication state and intent/version; media IDs, paths, roles, order, and direct cover URL; ISBN-10/13; canonical work/edition and `sourceBookId`; provider/enrichment provenance; acquisition/cost; reserved/sold/removed buckets; and generated listing/search fields.

For a new command, the database resolves Owner/store, locks the inventory row,
checks the exact version and idempotency fingerprint, validates the whole proposed
state, rejects a no-op, recomputes quality/attention/capabilities, increments
`inventory.version` once, refreshes a live projection through the existing trigger,
appends a public revision when required, appends one audit/event effect, completes
the replay record, and commits—all in one transaction.

A live public-field edit refreshes the current projection and records a revision.
A live private-only edit updates inventory and audit/event only. Private/paused edits
do not publish. Failure anywhere rolls back all business effects; there is no
`LIVE_UPDATE_FAILED` state. C22/C24/C25 must not be invoked sequentially as Save;
their safe validation helpers may be extracted and reused.

## 7. Stock command and zero-stock correction

```text
AdjustStoreInventoryStock {
  inventoryId, expectedInventoryVersion, delta, idempotencyKey, commandId
}
```

`delta` is nonzero and server-bounded. Under the locked row it changes
`quantity_total` and `quantity_available` in lockstep while preserving:

```text
quantity_total = quantity_available + quantity_reserved
               + quantity_sold + quantity_removed
```

It cannot make a bucket negative, consume reserved/held copies, or directly alter
reserved/sold/removed. The command applies one version increment, one audit/event,
and standard replay semantics. Low-stock is operational presentation, not failure.
Private/paused stock changes create no public revision unless a public DTO changes.

The forward database change must correct the current projection trigger behavior
that treats zero stock as a publication-ineligibility exception. For a live item,
`1 -> 0` commits and projects `out_of_stock`/`unavailable` while retaining live
intent; `0 -> 1` synchronously restores availability if every other gate passes.
A public revision is appended only when the effective customer DTO changes.
This supersedes Unit 7B only for post-publication stock transitions; an initial
Publish at zero stock remains ineligible.

## 8. Media management

Manage Photos remains separate from Save. Reuse Unit 7B upload authorization,
bounded staging, upload completion, validation/sanitization, approved derivative,
and status flow. Unit 7C adds controlled Owner-safe media list/read plus reorder,
remove, and atomic approved-link replacement operations.

The prior approved media stays public during replacement processing; failed
processing changes nothing publicly. The final authorized approved reorder,
removal, or replacement is version-fenced and atomic. Removing required damage
evidence is rejected when it would leave a live listing unsafe unless the same
atomic operation installs valid replacement evidence. Only the final effective
public-media change can append a public revision. No persistent edit draft exists.

## 9. Publication lifecycle reuse

Reuse Unit 7B C26 Publish/Pause/Private and C12 retry paths unchanged:

```text
Private -> Publish
Live -> Pause | Make Private
Paused -> Republish through existing publish intent | Make Private
publication_failed -> Retry publication when retryable
worker retry -> existing token-fenced worker path
```

Unit 7C introduces no lifecycle command. Make Private may retract the projection;
a later republish may receive a different `listingId` without changing `inventoryId`.

## 10. Metadata authority

Owner metadata edits are only `title`, `authors`, `language`, and
`publicDescription`, stored on `store_inventory`. ISBN mutation, canonical work or
edition reassignment, provider rematching, source-book reassignment, search-alias
approval, and edition/volume/format identity expansion are deferred. Unit 7C adds
no generalized field-level provenance system.

## 11. Activity and public revision history

Activity records what the Owner commanded or what operational action happened.
The append-only public revision records the exact safe snapshot that became live:

```text
publication_revision {
  id, store_id, inventory_id, revision_number, inventory_version,
  publication_intent_version, listing_id nullable, source_action,
  command_id, public_snapshot, created_at
}
```

`public_snapshot` uses a positive customer-safe allowlist. It excludes private
quantity internals beyond customer-visible availability, shelf location, internal
notes, actor PII, provider payloads, and media storage paths/tokens.

| Action/outcome | Activity/audit | Public revision |
| --- | --- | --- |
| Initial Publish | Yes | Yes (Revision 1) |
| Live public Save | Yes | Yes |
| Live private-only Save; private/paused Save | Yes | No |
| Stock or media change | Yes | Only when the public DTO changes |
| Pause or Make Private | Yes | No |
| Republish; successful retry | Yes | Yes |
| Committed publication failure | Yes | No |
| Rolled-back command; exact replay | No new effect | No new effect |

History is read-only in Unit 7C; Undo/Restore is excluded.

## 12. UI cutover

Remove the rich committed-card list, publication controls, and public-photo
management from Inventory while retaining acquisition/review/recovery/session
workflows. Add Store View list/detail, relocate existing 7B publication behavior,
and reuse the safe media workflow there. Do not reuse the legacy
`StoreInventoryScreen`, `EditModal`, or direct-update service. Demote Storefront,
keep Store Profile in secondary settings, and extract shared customer-presentation
primitives only where useful.

## 13. Forward-only database and application delta

Database responsibility: local M43 completes the atomic Owner edit orchestration
RPC, stock adjustment v2, live zero-stock projection correction, Store View
page/detail RPCs, append-only publication-revision table/helper, audit/event
additions, and strictly required trigger updates. Owner media
read/reorder/remove/replace RPCs remain deferred. M39–M42 stay byte-immutable;
connected M43 application remains separately gated.

Bounded forward correction M44 adds only Store View page v2 with authoritative
server-side filters and actor/store/filter-bound cursor context. M39–M43 remain byte-immutable;
M43/M44 connected application remains separately gated.

Expected application responsibility: versioned Edge schemas/actions and DTO
decoders, Store View routes/list/detail components, controlled mutations and cache
refresh, post-commit optional CTA, navigation cutover, and Store Profile secondary
route/legacy compatibility redirect.

Not required: async edit jobs/sync state, new lifecycle commands, stored Needs
Attention values, direct listing edits, generalized revisions/event sourcing,
persistent drafts, preview, or undo.

## 14. Normative acceptance matrix

| Area | Future implementation must prove |
| --- | --- |
| A. Post-commit handoff | Add returns `inventoryId`; Continue Reviewing preserves flow; optional CTA deep-links to that item without forced navigation. |
| B. Store View reads | Private/live/paused/attention/out-of-stock render from versioned reads; tenancy is isolated; reasons/capabilities are server-composed. |
| C. Save Changes | Private and live-public success; live private-only edit; stale rejection; invalid live edit fully rolls back; exact replay +0; changed replay rejected; same inventory identity and in-place live listing identity. |
| D. Stock | Live `1 -> 0` commits/out-of-stock; `0 -> 1` restores; bucket violations and active-hold conflicts reject; audit/revision classification is exact. |
| E. Media | Old approved media remains while processing; failure changes nothing; approved swap is atomic; damage evidence stays safe; replay adds no effect. |
| F. Lifecycle | Existing Publish/Pause/Private/Retry semantics pass unchanged and no duplicate lifecycle path exists. |
| G. History | Initial Revision 1; live public edit +1; private-only edit, replay, and failed/rolled-back command +0; snapshot contains only allowlisted public data. |
| H. Real PostgreSQL seams | Before broad adversarial tests, prove trigger/default/generated listing ownership, price projection, stock `1 -> 0`, condition/damage eligibility, revision append, and media replacement without manual repair between steps. |

Security/concurrency tests must also cover non-enumeration, server-derived tenancy,
row-lock/version races, command fingerprint mismatch, public privacy, and direct-table
write denial. Deterministic logic starts with red tests; no test may manually repair
production-derived state between proof steps.

## 15. Bounded implementation order

1. Forward database contract and red tests.
2. Early real-PostgreSQL vertical happy-path seam proof.
3. Store View read contracts.
4. Controlled Save Changes.
5. Stock correction and command.
6. Publication history.
7. Media management additions.
8. Store View UI/detail/cutover.
9. Post-commit CTA.
10. Adversarial, security, concurrency, and idempotency tests.
11. One focused independent review.
12. Separately authorized controlled live verification.

## 16. Out of scope and implementation gate

Persistent edit drafts, Preview, Undo/Restore, bulk editing, seller analytics,
merchandising/featured books, scheduled publication, ISBN/canonical reassignment,
generalized event sourcing, generalized field provenance, direct listing editing,
major customer Marketplace redesign, and unrelated Unit 6F native evidence are out.

The design has no known product or architecture blocker. The next authorized action
after this documentation task is to obtain explicit approval for Unit 7C forward
database contract/red-test implementation. Migration creation/application,
deployment, and live verification remain distinct later gates.
