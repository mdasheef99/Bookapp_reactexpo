# Phase 9 Package 1: Live Database and Storage Audit

**Status:** `independently_approved`
**Audit date:** 2026-07-22
**Mode:** read-only Supabase MCP
**Project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)
**Branch/base:** `phase9-db-foundation` at `a398adb`
**Mutation status:** no database, Storage, runtime, or migration mutation

## 1. Authority and scope

This Package 1 audit is the fresh database gate required by SESSION-START §5, the approved WU0 plan §§8–10, WU0B artifact 06 §5, Master SDD §§3, 7, and 9, Data SDD §§2–10, Review SDD §§8–13, and Media SDD §§6–15. It does not reopen settled behavior or authorize migration-file creation/application.

## 2. Verified current-state evidence

### Project, tenancy, and history

- Exact project readback: `ACTIVE_HEALTHY`, region `ap-southeast-2`, PostgreSQL `17.6.1`.
- Live migration history ends at `20260716151841 marketplace_phase6_emergency_resume_zero_fix`; no Phase 9 migration exists.
- `public` contains 37 `store_id` columns and zero `tenant_id` columns. `store_id uuid` remains the canonical tenant discriminator.
- `store_administrators` plus `marketplace_sec.is_store_admin(store_id)` is the established Owner-membership seam. Client-supplied store identity is not authority.
- Proposed Package 1 relation names were collision-checked with `to_regclass`; all returned null.

### Catalogue, inventory, listing, and quantity

| Object | Live evidence |
| --- | --- |
| `canonical_works` | 1 row; 7 columns; PK `id`; unique `(title_normalized, primary_authors)`; language is not part of uniqueness. |
| `canonical_editions` | 1 row; 15 columns; nullable work link; unique ISBN-10 and ISBN-13; index `(title, authors)`; no FK index on `work_id`. |
| `book_metadata_sources` | 0 rows; hard-coded provider CHECK for `google_books`, `open_library`, `isbn_provider`, `manual`; raw and normalized JSONB; redundant provider/book index; missing FK indexes. |
| `store_inventory` | 5 rows, all condition `good`; 33 columns; canonical links nullable; `photos text[]`; no language/structured damage/freshness/publication lineage. |
| `marketplace_book_listings` | 5 rows, all condition `good`; unique `inventory_id`; safe projection has 27 columns; trigram author index but no title/alias search document. |
| `inventory_holds` | 0 rows; `soft|firm`, `active|released|converted_to_sale`; unique active hold per request item; store/inventory/request indexes present. |

Quantity evidence:

- Zero negative quantity rows.
- Zero rows violate `quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed`.
- `store_inventory_quantity_balance` remains `NOT VALID`; PostgreSQL enforces it for new/updated rows but historical certification is incomplete.
- Five inventory/listing rows are currently deterministic for condition transition because all are `good`; the audit still requires a fresh application-time recheck.

### Conditions and provider compatibility

- Current inventory/listing CHECK: `new|like_new|good|fair|damaged`.
- Approved target: `new|like_new|very_good|good|acceptable`, with damage represented separately.
- Safe mapping: `fair -> acceptable`; `damaged` requires adjudication and must never be blindly mapped. Current `damaged` count is zero.
- Provider provenance is schema-coupled today. The approved adapter/field-reuse contract requires registry data plus versioned rights, not a vendor CHECK release for every provider.

### RLS, grants, functions, and triggers

- RLS is enabled on all audited core relations.
- Canonical works/editions are `SELECT USING (true)` for `anon, authenticated`; metadata sources are platform-write only; inventory Owner policies use `is_store_admin`; listings have separate anonymous/authenticated public-read policies.
- `inventory_holds`, `marketplace_events`, and Phase 6 operational tables intentionally have RLS with no client policies and service-only grants.
- Broad base grants remain on canonical tables, metadata sources, listings, policy config, and inventory. RLS currently blocks unauthorized row effects, but Package 1 must revoke ambient privileges and grant only the minimum named surface (MED-21).
- `sync_marketplace_listing_from_inventory()` is `SECURITY DEFINER`, has blank `search_path`, is service-only executable, and is invoked after relevant inventory INSERT/UPDATE fields. It preserves unique listing identity but cannot project Phase 9 language/damage/media/search/freshness fields.
- Phase 6 helpers consistently pin blank `search_path`. Reusable patterns include claim/lease/retry, idempotency fingerprints, policy resolution, append-only events/audit, safe payload validation, and operational observations.
- Some trigger-only Phase 6 helpers remain executable by `anon/authenticated` through default privilege (`validate_phase6_event`, `validate_phase6_audit`, `project_phase6_ops_notification`, `reject_phase6_evidence_mutation`). This is pre-existing backlog and a pattern Package 1 must not copy.

### Storage

| Bucket | Current state | Phase 9 assessment |
| --- | --- | --- |
| `image-extraction-inputs` | private, 10 MiB, JPEG/PNG/WebP, 0 objects | Reusable final scan bucket after server-only policy hardening; not sufficient as staging. |
| `inventory-photos` | public, 5 MiB, JPEG/PNG/WebP, 0 objects | Reusable approved-derivative bucket only after removing direct Owner final-byte writes/listing capability. |
| `order-dispute-evidence` | private, 10 MiB, image/PDF, 0 objects | Keep separate; do not reuse for ordinary request photos. |
| `listing-photos` | public legacy bucket, 0 objects | Not a Phase 9 target; broad listing policy is an advisor warning. |

No `marketplace-media-staging` or `order-request-photos` bucket exists. Storage policies currently allow authenticated Owners direct insert/update/delete across several marketplace buckets using `<store_id>/...` path membership. This cannot prove purpose, request/customer binding, sanitization, or post-provision lifecycle control.

### Advisor baseline

- Security: 121 total notices. Phase 9-relevant notices include RLS-enabled/no-policy informational findings on service-only Phase 6 tables, public bucket listing on legacy `listing-photos`, authenticated-executable `SECURITY DEFINER` notices, and leaked-password protection disabled.
- Performance: 314 total notices. Relevant missing FK indexes include canonical edition/work links, metadata-source links, inventory canonical/source links, listing canonical/locality links, and request-item canonical/listing links. Existing low-data indexes are reported unused; that is not evidence to remove them before representative workload testing.
- Advisor remediation references: Supabase database lints [0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [0025](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing), and [0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## 3. Current-to-target gap matrix

| Area | Current | Approved target | Package |
| --- | --- | --- | --- |
| Tenant authority | `store_id`; Owner helper | server-derived `store_id` on every private row/path | M01–M08 |
| Catalogue metadata | limited edition fields | description/edition/volume/format plus selection lineage | M01 |
| Provider provenance | hard-coded CHECK | adapter registry and field-level reuse/retention policy | M01 |
| Aliases | absent | XOR canonical/inventory target; source-bearing; approved search-only | M01 |
| Inventory snapshot | unstructured photos, legacy condition | language, coherent snapshot, structured damage, sellability, freshness, commit/publication lineage | M01/M04 |
| Pipeline persistence | absent | initiator-owned sessions, inputs, candidates, attempts, dedicated jobs, usage/idempotency | M02 |
| Upload authority | path-membership Storage policies; no persisted one-use authority | server-derived store/actor/purpose/entity/path-bound capability with expiry, consumption, replay denial and revocation/failure evidence | M02/M05/M06/M08 |
| Media | path array and shared policies | typed purpose/privacy assets, links, validation lineage, holds/deletion evidence | M03/M06 |
| Conditions | legacy five values include `fair/damaged` | five approved base values plus separate damage | M04 |
| Quantity | valid rows, constraint unvalidated | controlled create/increment/edit in M05; preflight and validation only in separately authorized M09 | M05/M09 |
| Projection | synchronous trigger, current fields | private commit survives projection failure; projection-only retry | M05/M07 |
| Search | listing-first fields/indexes | approved aliases and store-grouped deterministic pagination | M07 |
| Request photos | absent | request-item/customer/store-scoped private evidence and Phase 6 soft-hold seam | M08 |
| Grants | broad ambient table/function privileges | authenticated access only through named command/query RPCs or positive-allowlist views; private tables/helpers remain inaccessible; worker/service grants are separate | every group |
| Cost idempotency | no Phase 9 reservation relation | one reservation per `(store_id, job_id, cost_kind, policy_version)` under retries/races | M02 |
| Migration references | target relations span proposed groups | create referenced relations first or add each deferred FK in the first group where both sides exist | M01-M08 |

## 4. Failing migration/RLS/security test plan

Create these tests before production SQL in the owning group:

1. Schema/red tests: all target tables/columns/constraints/indexes absent; legacy condition/provider CHECKs reject approved values/adapter keys; quantity constraint reports unvalidated.
2. Tenancy: Store A pooled/authenticated context cannot select/insert/update/delete Store B session, candidate, alias, media, inventory link, request photo, usage, idempotency, or job rows; forged `store_id` cannot establish authority.
3. Grants/read boundaries: `anon/authenticated` cannot directly read or mutate private Phase 9 base tables; only named RPC/query or positive-allowlist view access succeeds. Worker/service grants are separately asserted. Public projections recursively exclude paths, hashes, raw payloads, private notes, quantities/costs, actor/customer identifiers, job state, capabilities, and validation internals; trigger/internal helpers are not executable.
4. Initiator: same-store noninitiating Owner cannot resume/mutate/close a pilot session; worker claims do not grant cross-store reads.
5. Condition/backfill: prove the old CHECK is removed or temporarily broadened before any `fair -> acceptable` write; update listing/inventory validation trigger/function vocabulary in the same transaction; a synthetic `damaged` row blocks automatic migration pending separate damage capture/adjudication; compatible rows migrate; final inventory/listing CHECKs accept exactly the five target values and reject `fair|damaged`; damage/public-photo gates fail closed.
6. Quantity/concurrency: create/increment/edit and active-hold races preserve equality; reduce-below-hold fails; replay produces one effect. M09 preflight fails on any violating row, and the existing constraint remains `NOT VALID` until the separately authorized M09 validation succeeds.
7. Publication: private commit survives forced projection failure; retry cannot write inventory; listing identity stays unique.
8. Storage/capabilities: C02/C03, C15/C16 and C20/C21 prove server-derived store and initiating/eligible Owner binding, exact purpose/entity/path/envelope binding, issued/expiry/consumed state, atomic single-use consumption, replay denial, and revocation/failure cleanup. Cross-store, wrong-purpose/path/entity/ordinal, expired/replayed/revoked capability, direct enumeration, unsanitized public promotion, and customer A/B request-photo access all fail.
9. Job/cost: double claim, stale lease, crash-after-provider-success, retry exhaustion, and concurrent reservation replay produce one bounded result and exactly one row for `(store_id, job_id, cost_kind, policy_version)`.
10. Marketplace: aliases never alter identity; private fields/media are absent; store grouping precedes pagination and remains complete at tied boundaries.
11. Advisor delta: snapshot before/after each applied group; no new ERROR/WARN is accepted without explicit review.
12. Migration-order compilation: each M01-M08 migration applies from the prior state without referencing a relation that does not yet exist; tests assert every deferred FK appears in its declared first-possible group. M09 is excluded from the additive-group application run and has its own authorization/preflight test.

## 5. Genuine blockers

- No blocker to migration-file design or isolated failing-test creation after explicit authorization.
- Live application remains blocked by its separate authorization gate and fresh exact-project readback.
- Production media/provider enablement remains blocked on vendor DPA/reuse/residency terms, exact byte/pixel/capability/retention configuration, and legal approval of 180-day completed request-photo retention. These do not block additive schema work.
- Quantity constraint validation is a separately reviewed ninth forward migration/gate. It requires a fresh exact-project preflight for violations and separate live-application authorization; current zero-violation evidence removes a known data-repair blocker but does not authorize M09.
