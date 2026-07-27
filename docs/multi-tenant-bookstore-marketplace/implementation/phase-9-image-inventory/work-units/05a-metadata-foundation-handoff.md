# Phase 9 Unit 5A — Metadata Foundation Handoff

**Status:** `independently_approved_unapplied`
**Date:** 2026-07-28
**Branch:** `codex/phase9-unit5a-metadata-foundation`
**Baseline:** `ec076fb37161b86d8c8b3d6e532715f236f20713`

## Authorized scope and exclusions

Unit 5A implements only the durable provider-neutral metadata foundation:
strict ISBN normalization, versioned lookup and provider contracts,
provider-independent query identity, local-canonical-first resolution,
version-isolated cache and privacy-safe identical-query reuse, bounded sequential
routing, metadata attempt/cost lineage, immutable selected snapshots, and closed
manual-review outcomes.

Google Books is not implemented. No secondary provider is selected or enabled.
Aliases, transliteration, Owner UI, inventory commit, quantity behavior,
publication, credentials, provider calls, Render changes, scheduling, autoscaling,
M09, and live M15 application are excluded.

## Vertical feasibility trace

| Stage | Contract/composition | Durable destination and boundary |
| --- | --- | --- |
| vision candidate | existing `image_extraction_candidates` observation | existing service-only candidate row |
| normalized lookup | `NormalizedMetadataLookupRequest`; `planMetadataFoundation` | `phase9_metadata_lookups` through fenced service RPC |
| ISBN normalization | `normalizeIsbnClue`, checksum helpers, ISBN-10 conversion | normalized query/snapshot fields; invalid visible clue remains private evidence only |
| local canonical lookup | `localCanonicalResolution` | fenced local-completion RPC, `execution_mode=local`, canonical edition/snapshot links; no provider registry, attempt, reservation, or charge |
| cache lookup | `MetadataCacheEntry/Result` | versioned `phase9_metadata_cache_entries`; distinct policy/namespace versions, terminal-attempt provenance, public or same-store private scope |
| lookup/coalescing identity | `MetadataQueryIdentity`, `ProviderCacheIdentity`, `MetadataReuseIdentity` | lookup leader/source lineage; matching query, adapter/version, route, privacy, reuse, namespace |
| metadata attempt | `MetadataAttemptContext`, routing plan | extended `metadata_enrichment_attempts`; never M14 vision attempts |
| usage/cost reservation | existing reservation plus attempt context | `phase9_usage_reservations` FK, pricing version/evidence and calculated cost |
| normalized outcome | closed provider/routing outcomes | attempt disposition/outcome and lookup manual outcome |
| selected snapshot | `SelectedMetadataSnapshot` from one parsed edition/attempt | immutable `phase9_selected_metadata_snapshots`; candidate stores only its FK |
| Owner review | closed `ManualReviewOutcome` with manual completion | snapshot/manual outcome and candidate `ready`/`needs_review`; no inventory effect |
| RPC/database | service-only claim/register/finalize/select wrappers | token/attempt/expiry fenced, idempotent replay, RLS, no client grants |

The target data dictionary was compared with live M14. Live structures already
provide candidates, canonical works/editions, jobs, reservations, provider
registry, and a basic metadata-attempt table. Live M14 does not provide the Unit
5A lookup/cache/coalescing relations, immutable selected snapshot, or complete
metadata attempt/cost lineage. M15 supplies those targets locally and is not live.

## Runtime and data behavior

ISBN cleanup accepts only complete ISBN-10/13 clues after whitespace/hyphen
removal, uppercases `X`, strictly validates checksums, and converts valid ISBN-10
deterministically to ISBN-13. Partial, malformed, or checksum-invalid strings
cannot establish identity.

Lookup order is validated ISBN, exact normalized original title/authors/language,
then only explicitly approved strong evidence. Aliases and fuzzy evidence never
establish canonical identity. A strong local hit stops before cache/provider work
and the durable local-completion path creates zero provider registry dependency,
provider attempt, reservation, or cost.

Query identity includes strategy, normalized ISBN/title/authors/language/edition
clues, lookup-contract version, and normalizer version. It excludes provider,
credentials, store authority, and private store data. Provider cache identity adds
adapter, adapter/capability/schema/cache/reuse-policy versions. Coalescing is
leader/follower only for a fully identical namespace; public bibliographic reuse
may cross stores, while private reuse is same-store only. Followers retain leader
lineage and create no provider charge.

Negative and ambiguous cache rows retain their terminal provider-attempt source,
including a secondary adapter/cache identity when that role produced the outcome.
Cache-policy version is separate from cache namespace. Provider registry
`policy_version` binds reuse, and `storage_allowed=false` blocks retained normalized
payload, accepted snapshot selection, and positive cache persistence.

Routing requires exactly one enabled primary and zero or one explicitly selected
secondary, runs sequentially, permits at most one attempt per role, and terminates
on coherent primary success. The database rejects a secondary without a finalized
eligible primary predecessor. The current secondary remains null/disabled.

An accepted snapshot must exactly equal the normalized payload on its selected
accepted attempt; fields cannot be stitched across attempts. The immutable record
contains original-script title/authors, normalized ISBNs, language/script,
publisher/series/edition/volume/format clues, provenance, selection policy, match
evidence, manual outcome, and nullable canonical edition. Uncertainty does not
create or overwrite canonical rows. Every failure/denial outcome retains manual
completion.

## Persistence and security

M15 is `20260728000015_marketplace_phase9_metadata_foundation.sql`,
forward-only and additive after M14. It creates metadata lookup, cache, and
immutable selected-snapshot tables; extends metadata attempts; adds a candidate
snapshot FK; and adds static service-only RPCs for metadata claims, lookup and
attempt registration, finalization, and selection.

Private tables use RLS with no anon/authenticated policies or grants. Public
PostgREST wrappers are `SECURITY INVOKER`; authoritative helpers are fixed
empty-`search_path` definers because they perform atomic row locking and service
claim authorization. There is no dynamic SQL. Claim token hashes, attempt number,
worker, lease expiry, store/candidate/job relationships, provider enablement,
secondary eligibility, reservation linkage, and immutable snapshot coherence are
validated transactionally. Registry matching, reuse-policy, and storage rights are
revalidated before retained persistence. Unit 5A RPCs do not accept raw provider payloads, and a
constraint rejects raw payloads for M15-linked attempts.

## Verification

- Unit 5A focused Jest: 42/42.
- Phase 9 contracts/runtime Jest: 196/196.
- Phase 9 migration/schema-contract Jest: 56/56.
- Full Phase 9 PGlite migration/RPC suite: 76/76.
- Phase 9 media-worker and vision-worker TypeScript builds: passed.
- Continuity, link/acceptance validation, diff hygiene, and scoped secret scan:
  recorded in the final branch closeout.

No live database, Storage, provider, credential, or deployment mutation occurred.
The independent correction review returned `APPROVED`. The exact next gate is
user review and separate authorization for M15 preflight/application. Units 5B/5C
remain not started and require separate authorization.

## Live application checkpoint — 2026-07-28

Correction commit `1168655` was merged to `main`. The complete checked-in M15
file (60,915 bytes; SHA-256
`21c298e77e1008f2fd0fd50b33ede9ec1f74479779cf53679f5bb638dc69d9f4`;
Git blob `573c11dbe073c31b2729874a011e11413e6969d1`) was submitted once and
applied to `ahntbtktjjmvfosgkmgn` as
`20260727222159 marketplace_phase9_metadata_foundation`. M15 is present exactly
once and M09 remains absent.

Live schema, constraint, index, trigger, function, fixed-search-path, client
denial, fencing, lineage, cost, storage/reuse, coherent-snapshot, and
no-inventory/publication checks passed. The final security gate did not pass:
Supabase default privileges left direct `service_role` DML on all three new
tables (`service_role=arwdDxtm/postgres`). This supersedes the earlier expectation
that granting SELECT alone would narrow service-role table authority. No
unauthorized live grant correction was made. Unit 5A remains blocked on a
separately authorized forward-only ACL correction; Units 5B/5C, Google Books,
metadata credentials/provider calls, Gemini deployment/calls, Storage, inventory,
and publication remain untouched.

## M16 local ACL correction checkpoint — 2026-07-28

M16 explicitly revokes all six direct mutation privileges from `service_role`
on the three M15 tables and M14 `vision_provider_attempts`, while preserving
SELECT, RLS, postgres ownership, and hardened service-only RPCs. M14 is included
because direct attempt-table DML bypasses its atomic egress, claim, reservation,
cost, and fencing contract. Effective-privilege tests and focused M14/M15
regressions pass; independent review returned `APPROVED`. M16 is merged and live
once as `20260727231217`. The six reviewed privileges are removed, but
PostgreSQL 17.6 retained MAINTAIN (`service_role=rm/postgres`) on all four
tables. SELECT-only remains open; Unit 5B stays gated on separately authorized
M17 creation/review/application. See [M16 evidence](../trackers/09-m16-acl-correction-evidence.md).

## M17 live ACL closeout — 2026-07-28

M17 is live once as
`20260727233457 marketplace_phase9_maintain_acl_correction`. It uses the
PostgreSQL-17-safe `REVOKE ALL PRIVILEGES` plus explicit `GRANT SELECT` boundary
on M14 `vision_provider_attempts` and the three M15 tables. Live readback proves
`service_role=r/postgres`, no MAINTAIN or direct mutation authority, client
denial, RLS/postgres ownership, and unchanged service-only execution plus fixed
search paths for all 13 approved RPCs. All four tables remain empty.

Unit 5A is now live-verified. Google Books, a secondary provider, aliases,
credentials, provider calls, Owner UI, inventory commit, and publication remain
outside this completed unit. Unit 5B and Unit 5C are not started and require
separate authorization. See [M17 evidence](../trackers/10-m17-acl-correction-evidence.md).
