# Phase 9 Implementation and Verification Tracker

**Status:** `wu0_approved_awaiting_authorization`
**Last updated:** 2026-07-19
**Use:** only after the Phase 9 planning set is approved
**Active work unit:** `0_approved_awaiting_next_authorization`

This tracker is intentionally separate from planning decisions. It will hold implementation evidence and can grow without turning the master tracker into a worklog.

## Work units

| Unit | Scope | Status | Required gate |
| --- | --- | --- | --- |
| 0 | [Contract fixtures, threat tests, migration plan, rollback/forward-correction plan](../work-units/00-contracts-threat-migration-plan.md) | `approved` | Corrections incorporated; no implementation/migration authorization |
| 0A | Server contracts, deterministic helpers, validation/error/provider/query/grant registers, fixtures, and red contract/security tests | `not_started` | explicit user authorization; no SQL/live writes |
| 1 | Data dictionary migration: metadata fields, aliases, condition/damage, media registry | `not_started` | fresh Supabase audit + migration review |
| 2 | Extraction session/input/candidate/enrichment/job tables, RLS, indexes, retention fields | `not_started` | Unit 1 verified |
| 3 | Private media staging, server upload authorization, validation/re-encode/promotion boundary | `not_started` | storage policy/security review |
| 4 | Vision adapter contract, primary/fallback orchestration, strict output validation | `not_started` | recorded fixtures; no live model in CI |
| 5 | Canonical-first metadata adapter/cache, ISBN validation, provider selection, aliases | `not_started` | provider fixtures and cost tests |
| 6 | Owner session/defaults/capture/review UI with accessibility and recovery | `not_started` | Units 2–5 verified |
| 7 | Controlled per-candidate commit, advisory duplicates, idempotency, projection changes | `not_started` | quantity/hold concurrency tests |
| 8 | Marketplace bookstore-first search, multilingual aliases, counts, full store catalogue | `not_started` | public/private projection tests |
| 9 | Damaged-book public media and mandatory customer photo-request extension | `not_started` | DOC-6/14 seam tests; no payment implementation |
| 10 | Lifecycle worker, deletion evidence, orphan cleanup, alerts, retention holds | `not_started` | lifecycle failure/replay tests |
| 11 | Pilot fixtures, security/regression/E2E/accessibility/cost verification and handoff | `not_started` | all prior units complete |

## Migration ledger

No Phase 9 migrations exist. Every future entry must record:

| Local filename | Live version/name | Project verified | Applied by | Rollback/forward fix | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| _none_ | _none_ | _n/a_ | _n/a_ | _n/a_ | _n/a_ | `not_started` |

Rules:

- Re-run Supabase `get_project` immediately before creating a live migration plan and again immediately before applying it.
- Use `apply_migration` for DDL; never use raw `execute_sql` for DDL.
- Never hard-code generated fixture IDs into data migrations.
- Prefer forward corrective migrations after application; do not rewrite live history.
- Record all bucket, policy, function, grant, trigger, constraint, index, and data-backfill effects.

## Required verification matrix

### Database and tenancy

- [ ] Every store-owned Phase 9 row has `store_id`.
- [ ] Store A cannot read, write, sign, promote, commit, or delete Store B data/media.
- [ ] Client-supplied `store_id` never establishes authority.
- [ ] Only the initiating Owner mutates/resumes a pilot session; support intervention is separately authorized/audited.
- [ ] Canonical tables cannot be mutated by Store Owner commands.
- [ ] RLS/grants and function `search_path`/EXECUTE are verified live.
- [ ] Grant matrix proves API-exposed tables have RLS and raw attempts/jobs/usage/cost/lifecycle structures plus private helpers are not directly callable by client roles.
- [ ] Inventory equality and active-hold semantics survive increment/new-row/partial failure races.
- [ ] Duplicate check and commit are concurrency-safe and idempotent.

### AI/provider contracts

- [ ] Prompt-injection text embedded in an image cannot cause tools, URLs, queries, or writes.
- [ ] Model output is rejected unless it satisfies the versioned schema and limits.
- [ ] Central validation matrix and API error catalogue generate/trace every contract limit and safe error behavior.
- [ ] A valid empty/no-book result does not trigger expensive retry loops.
- [ ] Primary failure triggers at most one allowed vision fallback.
- [ ] Metadata provider fallback is sequential and field conflicts are visible in provenance.
- [ ] Provider storage/display/cache/attribution/expiry permissions are enforced independently of provenance.
- [ ] ISBN checksums/conversion, title/author normalization, and alias rules have deterministic fixtures.
- [ ] CI uses recorded model/provider fixtures; no exact natural-language output assertion.

### Media and privacy

- [ ] MIME header, signature, decode, dimensions, byte/pixel limits, random path, re-encode, and EXIF/GPS stripping pass.
- [ ] Scan images and request photos cannot be retrieved through a public URL.
- [ ] Only approved sanitized derivatives become public inventory media.
- [ ] Signed request-photo URLs are short-lived and authorized against the final request item/customer/store.
- [ ] Deletion jobs are idempotent, observable, legal/dispute-hold aware, and leave tombstone evidence without retaining the image.
- [ ] Raw images/payloads never enter application logs, Sentry, analytics, notifications, or audit metadata.

### Owner UX and accessibility

- [ ] Start/Close-only session behavior works across foreground/background/logout/network loss.
- [ ] Camera and gallery uploads support one selected language and enforce the 15-spine cap.
- [ ] Minimal review fields, defaults, add-missed/remove-false, duplicate warning, condition explanations, and preview are keyboard/screen-reader accessible.
- [ ] A failed candidate does not block successful candidate commits.
- [ ] Projection failure retains one private `committed_publication_failed` inventory effect and idempotent retry cannot repeat it.
- [ ] Session summary accurately reports committed/private/published/needs-review/failed/skipped counts.

### Marketplace and customer photos

- [ ] Search returns each eligible matching bookstore once and all eligible stores across pagination.
- [ ] Versioned store-group cursor/ranking contract survives ties, context changes, multiple offers, and page boundaries.
- [ ] Storefront shows the complete active public catalogue and distinct title count.
- [ ] Original-script and approved alias searches return the same eligible listing without changing displayed identity.
- [ ] Exact inventory quantity, shelf, cost, raw payload, private notes, and request photos never appear publicly.
- [ ] Requested photo item cannot reach `payment_ready` without provided and accepted current-copy photos.
- [ ] Request-photo evidence never affects duplicate identity, quantity compatibility, or row separation.
- [ ] Store inability to provide requested photos marks the item unfulfilled/unavailable and releases eligible holds.

### Operational readiness

- [ ] Metrics cover extraction quality, owner corrections, fallback, latency, cost, quota, cleanup backlog, and repeated request-photo failures.
- [ ] Alerts cover stuck jobs, cleanup failures, unexpected fallback/cost spikes, and cross-tenant denials.
- [ ] Model/provider/prompt/schema versions support rollback and incident correlation.
- [ ] Feature flag, store allowlist, locality gate, and kill switch are verified.
- [ ] No Phase 7/8 payment, paid-order, pickup, refund, ledger, or settlement behavior is introduced.

## Append-only implementation log

No product implementation activity recorded.

### 2026-07-19 — Work Unit 0 planning checkpoint

- Date/session: 2026-07-19 Work Unit 0 planning
- Authorized work unit and scope: WU0 planning only; documentation commit authorized; no product code or migration creation/application
- Completed: approved baseline committed as `f9f6890`; versioned contracts, fixture matrix, threat tests, migration sequence, forward-correction rules, and pre-migration gates planned
- Files/components/migrations: documentation only; no migration file, app/function code, bucket, policy, or live data change
- Verification actually run: fresh exact-project read-only Supabase audit; continuity validator PASS (22 Markdown files, 17 required phase files); local links/350-line limit PASS; `git diff --check` PASS
- Supabase/external mutations: none
- Decisions/deviations/risks: no new product behavior; pre-existing RLS/public-bucket/privileged-function/password findings remain separate review gates
- Tracker/source-doc updates: WU0 plan, Phase 9 tracker, implementation tracker, handoff/router references, DOC-13, audit refresh, validator
- Next authorized action and gate: user review of WU0 plan; implementation, migration-file creation, and migration application remain unauthorized

### 2026-07-19 — Work Unit 0 correction and approval checkpoint

- Date/session: 2026-07-19 WU0 required-corrections incorporation
- Authorized work unit and scope: authoritative documentation corrections and commit only
- Completed: alias, validation/error, publication failure, request-photo duplicate, session ownership/Close, privilege, quantity, marketplace query, provider reuse, security-test, and migration-sequence corrections
- Files/components/migrations: documentation only; no migration, contract code, endpoint, app, bucket, policy, provider, or live data change
- Verification actually run: continuity validator PASS (22 Markdown files, 17 required phase files); local links/350-line limit PASS; 134 Phase 9 acceptance IDs unique; `git diff --check` PASS; no product/function/migration/app file changed
- Supabase/external mutations: none
- Decisions/deviations/risks: terminal-input Close retained; quantity validation stays a separately reviewed production gate; WU0 approved without authorizing WU0A
- Tracker/source-doc updates: root source specs, all affected Phase 9 SDDs/supporting records, trackers, handoffs, and validator
- Next authorized action and gate: none; await explicit authorization for named WU0A contract/test scope, with migrations still separately gated

When implementation is authorized, append one entry per material development session using the exact closeout shape in [SESSION-START](../SESSION-START.md): authorized unit/scope, completed work, files/components/migrations, verification actually run, external mutations, decisions/deviations/risks, documentation updates, and next authorized action/gate. Never rewrite an older evidence entry to make a later result look contemporaneous.
