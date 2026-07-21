# Work Unit 0B: Backend and API Technical-Design Authority and Router

**Definition status:** `definition_independently_approved`
**Implementation status:** `independently_approved`
**Definition date:** 2026-07-19
**Definition review:** `approved` on 2026-07-20 after correction verification
**Technical-design completion:** 2026-07-20; independently approved 2026-07-22
**Semantic-review correction:** 2026-07-22; dedicated C12 endpoint ownership and closed workflow/lifecycle/transition state validation verified by final context-isolated review (`approved`)
**Authority:** documentation-only technical design; no runtime or database authority
**Runtime/migration/Supabase/provider/storage/UI authority:** none

## 1. Purpose and source traceability

WU0B translates approved Phase 9 behavior and the WU0A contract package into implementation-ready backend/API design before any endpoint, repository, worker, migration, storage boundary, provider integration or UI is authorized. It traces to Master SDD §§3–9 and 14; Data SDD §§2–10 and 12; Extraction SDD §§2–14; Review SDD §§5–13 and 16; Media/Security SDD §§3 and 6–15; Marketplace SDD §§2–14; Photo Request SDD §§3–13; and the approved WU0 plan §§4–10.

WU0A remains authoritative for versioned contracts, validation bounds, deterministic policy, errors, provider reuse, grants, query semantics and red gates. The detailed artifacts may assign those rules to future components; they may not weaken or duplicate a conflicting rule.

## 2. Completed technical-design artifacts

| Artifact | Required content |
| --- | --- |
| [00 Authority, architecture and file map](./00b-technical-design/00-overview-authority-and-file-map.md) | authority, inspected source areas, component boundaries, exact proposed later files, non-goals/gates |
| [01 Command/query/DTO catalogue](./00b-technical-design/01-command-query-and-dto-catalogue.md) | C01–C30, Q01–Q11, per-operation boundaries/traceability, DTO projections, errors and rates |
| [02 Authorization, tenancy and privacy](./00b-technical-design/02-authorization-tenancy-and-privacy.md) | actor/tenant/capability/grant matrices, projection privacy, telemetry and denials |
| [03 State, transactions and idempotency](./00b-technical-design/03-state-transactions-idempotency-and-publication.md) | state machines, locks, versions, replay, quantity, private commit/publication and edits |
| [04 Jobs, providers and media](./00b-technical-design/04-jobs-providers-and-media-boundaries.md) | job/lease/retry/cost/crash design, adapter contracts, media purposes and lifecycle |
| [05 Marketplace and request photos](./00b-technical-design/05-marketplace-and-request-photo-design.md) | internal match/public store grouping, cursor/count/storefront, request photos and Phase 6 seam |
| [06 Red tests, acceptance and handoff](./00b-technical-design/06-red-tests-acceptance-and-handoff.md) | red mapping, acceptance, audit questions, independent-review gate and next action |

The artifacts are one design set. Common command/query envelope rules in artifact 01 apply to each catalogue row; boundary-specific matrices supply additional details and cannot be read as optional.

## 3. Locked design outcomes

- JWT identifies a user; target ownership and current membership derive the final `store_id`. Supplied store identity never authorizes.
- The initiating Owner alone mutates/resumes/closes the pilot session; same-store Owners receive only explicitly named post-session inventory scope.
- C02, C15 and C20 issue distinct scan, request-photo and public-copy media capabilities.
- C08–C10 share one closed commit action contract while retaining separate transaction/decision semantics.
- C22–C26 may share one closed edit transport but remain separate authorization, transaction, event and red-test actions.
- Q07 internal book matching is not client-facing. Q08 groups eligible results by store before pagination and uses a context-bound store cursor.
- Private inventory commit is authoritative; publication is separate. `committed_publication_failed` preserves one private commit and retry cannot mutate inventory.
- Jobs use Postgres `FOR UPDATE SKIP LOCKED` claim semantics after later database authorization; service authority is claim/action scoped.
- Public, Owner and customer DTOs use positive allowlists; media content, raw provider/model data, credentials, paths, tokens, PII and private operational fields are forbidden.
- Customer request photos remain private/request-scoped and cannot influence duplicate identity. Validated `provided` media must be followed by a current Owner quantity/price/terms confirmation and atomic bounded soft hold before customer acceptance through existing Phase 6 pre-payment seams.
- Master SDD §6 names are the sole persisted session/input/candidate vocabulary; job/publication/media groupings are not silently promoted into database states.
- C01–C30 and Q01–Q11 each select one primary boundary, transaction owner, SDD/WU0A trace, red tests and future implementation unit.
- Phase 7/8 payment, paid-order, ledger, settlement, refund and pickup behavior is forbidden.

## 4. Database-audit boundary

WU0B did not query Supabase. Concrete live table/function/constraint/index/policy/grant/trigger/bucket/storage/migration/advisor facts and exact migration compatibility are marked `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN` in the artifacts. Proposed future filenames are planning targets only and are not creation authority.

## 5. Write allowlist and non-goals

This completed unit changed only this router, the authorized seven-artifact directory, Phase 9 continuity/status documents and the continuity validator. It inspected runtime, migration and test source read-only.

It created no SQL, migration, endpoint, RPC, repository, service, worker, adapter, fixture, test, provider call, storage policy, UI, configuration, dependency, generated file, deployment or Supabase query/mutation.

## 6. Status and later gates

WU0B is `independently_approved`. A separate context-isolated reviewer inspected the entire artifact set, returned exact verdict `approved`, and verified the correction set before this status transition.

Later gates remain separate and ordered:

1. Independent WU0B technical-design review - complete 2026-07-22.
2. Fresh exact-project read-only Supabase schema/security/storage audit.
3. Exact database and migration design.
4. Migration-file creation.
5. Isolated migration testing.
6. Live migration application after separate authorization and another exact-project readback.
7. Fixture-backed runtime slices under separate runtime authorization.

Migration creation and live application can never share one authorization. The exact next action is: **Perform the consolidated Risk-Based Phase 9 SDD analysis in a new session.**
