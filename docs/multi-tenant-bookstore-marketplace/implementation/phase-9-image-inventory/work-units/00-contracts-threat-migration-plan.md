# Work Unit 0: Contracts, Threat Tests, and Migration Design Plan

**Status:** `approved`
**Date:** 2026-07-19
**Authority:** approved Phase 9 planning baseline; planning only
**Implementation:** not started
**Migration-file creation/application:** not authorized

## 1. Objective and exit outcome

Work Unit 0 converts the approved SDDs into a bounded implementation blueprint. It defines the future adapter contracts, recorded-fixture matrix, security tests, migration sequence, forward-correction strategy, and evidence gates needed before product code or migration files may be authorized.

This plan traces to Master SDD §§3, 7–9, 12, and 14; Data SDD §§4–6, 9, 11–12; Extraction SDD §§3–14; and Media/Security SDD §§3, 6–9, 15–16. It does not change any behavior or live system.

WU0 was approved after required corrections on 2026-07-19. Approval of this plan is not implementation, migration-file, or migration-application authorization; the tracker must name a separately authorized next unit before work begins.

## 2. Evidence basis

- Approved Phase 9 master and domain SDDs, data dictionary, requirements traceability, and complexity register.
- Fresh read-only Supabase verification of project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`), `ACTIVE_HEALTHY`, region `ap-southeast-2`, Postgres 17.6.1.
- Live tenancy uses `store_id` in 37 public columns and `tenant_id` in zero; server-derived `store_id` remains authoritative.
- Core canonical, metadata, inventory, and listing tables exist. Proposed extraction, enrichment, alias, typed-media, and request-photo tables do not.
- Current data contains five inventory rows, all condition `good`, and no observed quantity-balance violation. The equality constraint remains `NOT VALID`.
- Existing Expo/Supabase structure uses Zod validation, shared Edge Function authorization helpers, migration contract tests, and function contract tests. Future Phase 9 artifacts should follow these seams rather than create a second backend.

## 3. Non-goals and hard stop boundaries

This work unit does not:

- create SQL migration files, tables, columns, policies, buckets, functions, triggers, or seed data;
- apply a migration or mutate Supabase/storage;
- implement Edge Functions, app services, screens, schemas, or UI;
- select a vision model, metadata vendor, quota, price, or production timeout;
- make live model/provider calls or add credentials;
- implement Phase 7/8 payment, paid-order, pickup, refund, ledger, or settlement behavior.

## 4. Planned contract artifact layout

The following paths are proposed for later authorized work; they are not created by WU0:

| Concern | Proposed location | Rule |
| --- | --- | --- |
| Server-owned Phase 9 contracts | `supabase/functions/_shared/imageInventory/contracts/` | Single authoritative adapter/state schemas. |
| Deterministic domain helpers | `supabase/functions/_shared/imageInventory/domain/` | ISBN, normalization, error, retry, and idempotency logic. |
| Recorded fixtures | `supabase/functions/__tests__/fixtures/phase9/` | Sanitized, consented, versioned; no live provider dependency. |
| Edge Function contract/security tests | `supabase/functions/__tests__/` | Executable schema/domain tests plus necessary static boundary tests. |
| Migration contract tests | `supabase/migrations/__tests__/` | RLS, grants, constraints, functions, triggers, and forbidden-pattern assertions. |
| Mobile owner-safe DTO schemas | `src/features/stores/inventoryExtraction/` | Only server projections; never duplicate provider contracts or accept authority fields. |
| Authoritative validation matrix | server contract package plus generated/readable register | Field type/nullability, min/max, normalization, rejected content, visibility class, and unknown-key policy. |
| Canonical API error catalogue | server contract package plus generated/readable register | Stable `P9_*` code, HTTP status, retryability, safe message, severity, surviving effect, and idempotency reuse. |
| Bookstore-first query contract | server contract package and public DTO schema | Group/count identity, fields, cursor, ranking stages, privacy exclusions, and alias-match context. |
| Provider reuse policy | adapter configuration/normalized contract | Field-level storage/display/cache/attribution/expiry rights, separate from provenance. |
| Database grant matrix | migration design evidence | Every table/function/role exposure and intentional service-only boundary. |

Provider payloads are translated into internal contracts at the server adapter boundary. The mobile app never receives raw prompts, raw provider responses, credentials, signed reusable capabilities, or privileged fields.

## 5. Versioned contract definitions

### 5.1 Common adapter envelope

Every request/result records `contract_version`, `schema_version`, `adapter_key`, `adapter_version`, `correlation_id`, `attempt_id`, timestamps, and a typed outcome. The server generates identity, store scope, retryability, and state transitions. Provider/model prose cannot set them.

Adapter outcomes use a closed taxonomy such as `technical_failure`, `schema_invalid`, `broadly_unusable`, `no_books`, `wrong_language`, `over_candidate_limit`, `quality_rejected`, and `provider_no_match`. They are distinct from workflow states, policy denials, and public API errors. Deterministic policy—not vendor text—owns retryability and fallback eligibility.

The API error catalogue uses stable `P9_*` codes. Initial coverage includes `P9_OWNER_NOT_AUTHORIZED`, `P9_SESSION_NOT_ACTIVE`, `P9_CANDIDATE_VERSION_CONFLICT`, `P9_DUPLICATE_TARGET_CHANGED`, `P9_MEDIA_NOT_APPROVED`, `P9_QUANTITY_INVARIANT_FAILED`, and `P9_PUBLICATION_FAILED`. Each entry defines HTTP status, retryability, safe Owner message, log severity, surviving database effect, and required idempotency-key reuse.

### 5.2 Vision request

The request contains the selected BCP 47 language, sanitized image bytes or a non-reusable internal media reference, batch type `spine_stack`, hard candidate limit 15, prompt/schema/adapter versions, and the correlation/attempt identifiers. It contains no signed public URL, storage path authority, tool definition, database capability, secret, user PII, or free-form operational instruction.

### 5.3 Vision result

The result contains a typed outcome and at most 15 ordered candidates. Each candidate may include spine ordinal, original-script title, authors, optional visible-ISBN clue, bounded confidence/quality indicators, optional bounded geometry/rotation, and typed skip/rejection reasons. Strings, arrays, geometry, confidence, and total payload bytes receive hard schema bounds.

The schema rejects URLs, paths, SQL, HTML/active content, tool calls, commands, and unknown privileged fields. More than 15 candidates rejects the input for rescan; it is never truncated. A valid `no_books` result is terminal and does not trigger fallback. This covers MAS-01–MAS-03, EXT-02–EXT-10, and MED-07–MED-09.

### 5.4 Metadata lookup and selected result

The internal lookup request prefers normalized original title and authors, includes the selected language, and may include a checksum-valid visible ISBN clue. Resolution is local canonical first, then configured primary and secondary adapters sequentially.

Each adapter returns zero or more coherent edition candidates with provenance. Selection stores one coherent edition snapshot rather than field-stitching conflicting editions. The normalized result may contain description, ISBN-10/13, title/subtitle, authors, publisher/date, language, edition statement, volume, format/binding, pages, categories, cover reference, match rationale, confidence, and provider/version provenance. ISBNs must pass deterministic normalization/checksum/conversion rules before authority. Field-level policy separately identifies matching-only, storage, public-display, image-cache, attribution, and expiry/revalidation rights. This covers DAT-01–DAT-09, EXT-11–EXT-12, and MED-22.

### 5.5 Search alias result

Each automated alias-generation operation proposes at most three English/Latin-script title aliases typed as transliteration, translation, common title, or recognized title. The relational model may retain additional provider-recognized official or Owner/platform-verified aliases within configured abuse, quality, and storage limits. Every row has source, version, confidence where applicable, and approval state. Author aliases transliterate names; they do not translate them. Original-script data remains authoritative, and aliases cannot drive identity, canonical matching, or duplicate decisions. This covers MAS-04 and DAT-10–DAT-15.

### 5.6 Central validation matrix

Before contract implementation is accepted, one authoritative matrix defines field name, type, required/nullability, minimum, maximum, normalization, rejected characters/content, public/private/internal class, and unknown-key rejection. It covers title, subtitle, authors/count, description, ISBN clue, BCP 47 language, candidate count, aliases, provider categories, page count, geometry, damage note, quantity, money in paise, idempotency key, command ID, and raw payload size. Zod/types/database checks trace back to this register rather than inventing independent limits.

### 5.7 Session, duplicate, and publication outcomes

The initiating Owner is recorded and is the only Owner who may mutate/resume the session during the pilot. Phase 9 has no interactive support takeover or cross-store private-data access; recovery uses initiating-Owner retry, claimed-worker recovery, and reconciliation. Future support tooling requires separate design and authorization. Close remains terminal-input-only. Internally, `active -> closing -> closed`; `closing` rejects new inputs and finalizes the summary, while Close during processing leaves the session active. Uncommitted candidates remain `needs_review` and are neither committed nor deleted.

Private customer-request photos are later request-scoped evidence and never affect inventory duplicate identity or quantity compatibility. On projection failure the candidate remains persisted as `committed`, publication becomes `publication_failed`, and the command outcome is `committed_publication_failed`; inventory remains private, records audit/retry intent, and publication retries idempotently without creating or incrementing inventory again.

### 5.8 Marketplace query contract

The versioned query contract defines match-result identity, store-group identity, `bookstore_count`, `offer_count`, `title_count`, public fields/privacy exclusions, alias-match indication, store-catalogue context, cursor shape, ranking stages, and deterministic final tie-breaker. Pagination operates on store groups and binds the cursor to query/filter/ranking version so grouping after pagination cannot omit stores.

## 6. Recorded-fixture and deterministic-test matrix

| Fixture/test | Required assertion |
| --- | --- |
| English 1-spine and 15-spine success | Ordered candidates validate; 15 is accepted. |
| 16+ candidates | Entire input becomes reject/rescan; no truncation or partial commit. |
| Valid empty image | `no_books` is terminal; no costly fallback loop. |
| Wrong selected language | Typed skip/result; no automatic per-spine model switch. |
| Repeated spines | Candidates remain separate for owner review. |
| Valid and invalid visible ISBN clues | Valid clue aids lookup; neither becomes authority without validation. |
| Image-borne prompt injection | Text cannot request tools, URLs, secrets, writes, or policy changes. |
| Malicious/unknown output fields | Strict schema rejects paths, commands, active content, and authority fields. |
| Oversized strings/arrays/geometry | Deterministic size/count/range rejection. |
| Conflicting provider editions | Provenance remains visible; no silent field stitching. |
| Provider no-match | Store-local/manual candidate remains possible with nullable canonical link. |
| Primary technical/schema failure | At most one whole-image fallback; success/charge is idempotent. |
| Valid primary empty result | No fallback. |
| Alias variants | Automated output maximum three; bounded official/verified rows coexist; all remain provenance-bearing and search-only. |
| Replay by content/idempotency hash | No duplicate external charge, state advance, or inventory write. |
| Pilot Indian-script samples | Consented/sanitized language-specific fixtures; no unsupported broad accuracy claim. |

Model/provider assertions validate structure and deterministic policy, never exact generated prose.

## 7. Threat and security test plan

| Threat | Planned test/evidence | Traceability |
| --- | --- | --- |
| Cross-store access | Store A/B denial for session, input, candidate, attempt, media, alias, commit, and delete; pool/reused-connection scenarios included. | MAS-03, MAS-AC04, MED-01–MED-05 |
| Forged client `store_id` | Server membership resolution wins; forged target is denied and audited without raw content. | MAS-03, MED-01 |
| Prompt/tool injection | Image text and provider output cannot invoke tools or alter workflow/state. | MAS-02, EXT-09–EXT-10, MED-07–MED-08 |
| SSRF/path/active content | URL, path, SQL, HTML, script, and command-shaped fields are rejected or inertly encoded. | MED-08 |
| Malicious upload | MIME/header/signature/decode/dimension/byte/pixel/decompression/polyglot checks; re-encode and EXIF/GPS stripping. | MED-06, MED-13–MED-15 |
| Capability leakage | Purpose/entity/store-bound short expiry; replay, expiry, and cross-purpose denial. | MED-02–MED-05, MED-16 |
| Privacy-class crossing | Scan/request media never public; only approved derivative promoted. | MAS-08, MED-11–MED-16 |
| Cost/retry amplification | Pre-cost store quota, one vision fallback, sequential metadata fallback, circuit breaker, idempotent usage accounting. | MAS-10, EXT-08, EXT-13–EXT-17 |
| Canonical pollution | Uncertain results stay store-local; store edits cannot mutate shared canonical truth. | DAT-04–DAT-09 |
| Duplicate/quantity race | Advisory-only duplicate outcome; atomic idempotent commit preserves Phase 6 quantity/hold equality. | MAS-05–MAS-06, DAT-16–DAT-20 |
| Telemetry leakage | Static/runtime checks exclude images, raw payloads, prompts, signed URLs, and secrets from logs/events. | MED-09, MED-18 |
| Lifecycle replay | Deletion/orphan work is idempotent, hold-aware, observable, and leaves non-content evidence. | MAS-AC07, MED-10, MED-19 |
| Contract edge cases | Unknown keys, integer overflow, negative money/quantity, malformed BCP 47, Unicode control/bidi, and oversized raw payloads fail deterministically. | MAS-02, EXT-10, MED-08 |
| Database privilege abuse | Direct authoritative writes/helper execution, `search_path` poisoning, ambient EXECUTE, and storage enumeration are denied. | MAS-03, MED-20–MED-21 |
| Publication and pagination races | Projection failure preserves one private commit; store-group pagination neither omits nor duplicates stores. | MAS-11, MAS-AC06, MKT-02 |
| Worker/cost/lifecycle races | Lease expiry/double claim, cost reservation replay, and cleanup versus active hold are deterministic and idempotent. | EXT-13–EXT-17, MED-19 |

## 8. Future migration sequence

No filenames or timestamped migrations are created in this work unit. Later migration work follows expand → backfill/adjudicate → validate → switch → contract, with a separate authorization at creation and application.

1. **P9-M01 — registries and additive metadata:** provider registry/reuse policy, edition/inventory snapshot fields, provenance-bearing aliases; no writer/search switch.
2. **P9-M02 — extraction and operational persistence:** store/initiator-scoped sessions, inputs, candidates, attempts, jobs, usage/cost, idempotency, lifecycle, RLS, grants, and indexes.
3. **P9-M03 — typed media registry:** media assets, purpose links, sanitization lineage, retention/holds, and service-only lifecycle state; no bucket-policy switch.
4. **P9-M04 — condition and damage transition:** additive vocabulary/damage fields, backfill/adjudication, compatibility readers, and constraint sequencing.
5. **P9-M05 — controlled inventory commands:** candidate commit, duplicate recomputation, quantity locking, publication outcome/retry, post-commit commands, and compatibility-safe direct-write remediation.
6. **P9-M06 — storage boundary policies:** private staging, approved public promotion, private request storage, grant/policy matrix, and denial tests.
7. **P9-M07 — public projection and marketplace search:** safe fields, aliases, bookstore-first grouped query, indexes, cursor/ranking contract, and compatibility switch.
8. **P9-M08 — customer request-photo seam:** request/item links, customer acceptance gate, and Phase 6 guard integration; no payment implementation.

Required migration notes:

- Replace the hard-coded provider CHECK without losing existing provenance or requiring a schema release per vendor.
- Map `fair` to `acceptable`. Re-query live rows immediately before creation and application. Any then-existing `damaged` row requires adjudication; do not map it blindly. The current audit found none.
- Update the explicit listing projection trigger/function atomically with compatible projected fields. Preserve unique `inventory_id` listing identity.
- Preserve `quantity_total = available + reserved + sold + removed`. The `NOT VALID` constraint is directly relevant and still enforces new/updated rows, but historical certification remains pending. Re-audit rows, record/approve any repair, and validate through a separately reviewed forward migration before production enablement unless documented evidence shows validation is unsafe or unnecessary; this does not block contract/test work.
- Keep legacy columns/checks/readers until dual-read/write and backfill verification pass. Do not rewrite applied migration history; use `apply_migration` only after explicit live-application authorization.

## 9. Rollback and forward-correction strategy

- Before application, an unapproved/unapplied migration can be revised or discarded without touching live state.
- After application, prefer feature flag/allowlist/kill switch plus an additive forward corrective migration. Never rewrite live history.
- Do not use destructive rollback for canonical, inventory, media, or lifecycle data.
- Keep legacy condition/photo/provider representations readable until the new boundary and backfill are verified.
- Reverse storage access changes through reviewed forward policy changes; revoke exposure before data cleanup.
- Persist migration/version/adapter evidence so failed jobs and projections can be replayed deterministically.

## 10. Gates before migration-file creation

All of the following are required, followed by explicit user authorization:

- [ ] Re-verify the exact Supabase project identity.
- [ ] Freshly query affected tables, columns, rows, constraints, indexes, RLS policies, grants, functions, triggers, buckets, storage policies, live migrations, and advisors.
- [ ] Approve versioned contracts, error taxonomy, bounds, and sanitized recorded fixtures.
- [ ] Approve the central validation matrix, API error catalogue, provider reuse policy, grant matrix, and marketplace query contract.
- [ ] Make deterministic contract/security tests red for the intended behavior before production implementation.
- [ ] Approve Store A/B and forged-store denial tests across database, function, and storage boundaries.
- [ ] Record data mapping counts and an adjudication plan for non-deterministic condition/damage rows.
- [ ] Review query/index plans for initiator-only session recovery, job claiming, duplicate advice, alias search/store-group pagination, publication retry, and lifecycle cleanup.
- [ ] Review provider/check and projection-trigger compatibility sequencing.
- [ ] Record pre-existing advisor findings separately from any new Phase 9 notice.
- [ ] Confirm no Phase 7/8 behavior and no public/raw-media boundary regression.
- [ ] Update the migration ledger and all session-protocol documents required for the authorized action.

## 11. Pre-existing security findings and containment

The fresh advisor snapshot contains 121 notices. Relevant existing findings include one `rls_disabled_in_public` error for `public.spatial_ref_sys`, public bucket-listing warnings including legacy `listing-photos`, mutable function search paths, broadly executable `SECURITY DEFINER` functions, and leaked-password protection disabled. Table inspection also reports no RLS on `marketplace_event_schema_registry` and `marketplace_notification_type_registry`; their intended registry/service-only role requires explicit grants/exposure review rather than an assumed blanket fix.

These findings predate WU0. This plan neither remediates nor accepts them. Phase 9 must not copy the legacy public-listing or ambient privileged-function patterns, and a later migration review must classify every new advisor delta. See the [Supabase RLS-disabled advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

## 12. Implementation-time configuration decisions

The following remain configuration/legal/operations gates rather than schema blockers: concrete model/provider IDs, quotas, timeouts, pixel limits, final bucket names, retention legal review, supported language rollout order, vendor data-processing terms, and pilot accuracy thresholds. Defaults must remain bounded and observable; new languages remain adapter/config additions without changing identity semantics.

## 13. WU0 acceptance checklist

- [x] Versioned internal contract shapes and authority boundaries are defined.
- [x] Recorded-fixture and deterministic-test matrix is defined.
- [x] Threats map to MAS, DAT, EXT, and MED acceptance requirements.
- [x] Migration order, compatibility, and forward-correction rules are defined.
- [x] Pre-migration verification and explicit-authorization gates are defined.
- [x] Pre-existing security findings are separated from Phase 9 work.
- [x] Validation, errors, privileges, provider reuse, publication failure, session ownership, duplicate-photo, and marketplace-query semantics are locked.
- [x] No code, DDL, migration file, provider call, or Supabase/storage mutation was performed.

## 14. Next gate

WU0 is approved. The next authorization should name a narrow implementation unit and separately state whether contract/fixture code and migration-file creation are permitted. No next implementation unit is authorized by this approval. Migration application remains a later independent authorization with fresh exact-project readback.
