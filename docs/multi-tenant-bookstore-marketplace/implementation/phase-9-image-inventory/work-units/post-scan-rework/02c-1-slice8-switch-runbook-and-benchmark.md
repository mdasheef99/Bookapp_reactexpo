# Slice 8 Activation Evidence and Switch Runbook

| | |
|---|---|
| **Status** | Proposed design appendix, NOT IMPLEMENTED. Documentation only. |
| **Parent / authority** | [02c](./02c-slice8-open-library-first-sdd.md) remains the single slice-8 authority; OD-1..3, D31/D38, master sections 3/8 and DOC-1 section 13. Owner questions live only in [02c section 12](./02c-slice8-open-library-first-sdd.md#12-owner-questions-and-conflicts). This appendix grants no operations authority. |
| **Baseline** | Local source only; path/SQL aliases and current-behavior citations inherit [02c section 2](./02c-slice8-open-library-first-sdd.md#2-verified-evidence-flows-and-provider-inventory). No live readback. |
| **Migration** | No file created/applied; 02c 8a-3 owns gate/grants; 8a-5 owns admission-wait/queue helpers. No forward dependency. |
| **Size / risk** | High: grants versus network sends, missing-child drain and rollback. Separate appendix keeps activation evidence/operations reviewable; no new product policy. |
| **Review** | T3-07/09/10/11/12 design corrections; implementation/native/operational proof remains required. |

All new behavior below is **design**, not implemented. AC8-5/10/15, packages and
approvals remain in 02c; this file supplies their test/runbook detail. Author
caching and automatic full-list cache reuse are recommended deferrals (OQ8-9/10).

## 1. Benchmark and equivalence

Record the Google baseline **before disable**, with separate provider-call/retention
authority; never re-enable Google for comparison. Baseline/comparison recording is
required by the brief. **Adding a numerical wrong-pick gate to 8c is only a
recommendation, OQ8-4**, not a D38 decision. D38 (SDD-0:202) already gates slice-9
relaxed/tie activation; that gate remains unchanged.

The [spine file](./data/benchmark-spine-readings-2026-10-18.json) has 85 entries,
only short keys t/a/l. It supplies no ISBN or publisher clue. No live calls here.

| Artifact / contract (design) | Required content and interpretation |
|---|---|
| Labels | NEW reviewed JSON `{version:'p9-slice8-labels-v1',inputSha256,adjudicator,approvedAt,cases:[{caseId,source,query,status,acceptableEditionGroups,records}]}`. Core sources `{kind:'spine',index:0..84}` exactly once each; status labelled/unknown. Records `{adapterKey,providerRecordId,editionGroupId}` use provider-qualified identity, never compare an unqualified Google ID with an OL ID. |
| Edition equivalence | Adjudicator assigns a provider-independent editionGroupId using edition/language/publisher/date/format/ISBN evidence, recording uncertainty; same title/work alone is insufficient. Expected acceptable groups per labelled case are approved before scoring. A new/unmapped winner is unknown until adjudicated, not silently right/wrong. |
| Supplemental inputs | Separate labelled sources `{kind:'supplement',fixtureId}` carry explicit public/synthetic title/authors/language plus checksum-valid/invalid/conflicting ISBN and publisherClue cases. Core 85 queries have ISBN/publisher null. OQ8-4/6 approve supplements and comparisons; do not claim these clues came from the spine file. Report core/supplement counts separately. |
| Denominators | N=L labelled + U unknown cases. Per provider: selected correct C, adjudicated wrong W, unscored winner X, no-winner/manual M; N=C+W+X+M. Wrong-pick rate W/(C+W), N/A when zero; labelled correct coverage C/L, N/A when L=0. Also report X/N, U/N, M/N, calls/latency. Never exclude unknowns without showing counts, or score manual as correct. No combined supplement weighting without OQ8-4 approval. |
| Baseline/comparison | Exact artifacts/code/provider versions, **payload and lookup/cache schemas separately**, registry/policy/date, safe packets, retention authority, latency/calls/outcomes/groups. Same approved queries/labels for Google/OL. If Google recording is not permitted, Owner dispositions existing fixtures/incomplete baseline before switch. |
| Gate choice | OQ8-4 explicitly chooses comparison-only or added 8c gate, threshold/approver, denominator/completeness/unscored policy. No number invented. If approved, test reject/accept/exact-bound decisions; if declined, publish metrics without a new activation pass/fail rule. Slice-9 gate always separate. |
| Explicit equivalence | Refactored v1 exactly matches saved v1 rows/companions with fixed time/UUID. V2 preserves ordered editions/eligibility/facts/cover/URL/physical author budget except explicitly declared adapter/capability/lineage tuple/digest changes. Payload p9-metadata-v1 and lookup/cache p9-metadata-foundation-v1 checked independently; OQ8-6/7 owns any other transport/genre delta. No byte-identical v1/v2 claim. |
| Behavioral red | Prepare approved packets/labels first. Exercise current ranker on a labelled discriminating packet and assert acceptable group/ambiguity; record actual baseline behavioral mismatch with passing controls. For an added gate, execute a wrong-winner or over-threshold decision and observe rejection assertion fail before implementation; verify an injected wrong-as-correct scoring mutant is caught. Missing inputs/module/setup alone never counts as feature red. If no baseline mismatch exists, record that comparison as green control, not invented red evidence. |

Keep provider fixtures/labels offline thereafter. Unknown/no-ISBN cases remain
visible in the report; strict slice-8 ranking changes do not activate slice 9.

## 2. Switch, grants, drain and rollback

Proposed operations only; each step needs separate authority. Deploy 02d after
8b/before 9; 8c does not require it. Test absent/present prefill hook; if 8c ships
first, later 02d accepts the same OL v2 contract. Google remains off on rollback.

| Step | Required operation / stop rule (design) |
|---|---|
| 1 Prepare | Record immutable tested 8b artifact and full 02c section 4.1 manifests; exact deployed worker inventory, unique worker/claim identity, response timeout/contact and accepted-version proofs. Record pre-disable baseline/comparison and OQ8-4 gate choice; threshold pass only if Owner adds that gate. Retire every ungated old worker before pause. |
| 2 Close **new grants** | NEW private singleton phase9_external_admission_gate: mode open/paused/smoke, epoch bigint, smoke_job_ids UUID[]<=20, expires_at. Every physical-call registration holds gate FOR SHARE through call INSERT/commit; operator pause takes FOR UPDATE, increments epoch, commits paused. 8a-3 adds nullable physical-call grant_epoch (legacy NULL retained); all 8b grants store the server-derived epoch, not caller authority. Replayed registrations recover original call only, never a new grant/GET. |
| 3 Capture obligations | After pause commit, snapshot **job IDs**, not just lookup IDs: active metadata jobs plus any job with incomplete lookup, open reservation or unsettled physical call, and all old-epoch grants. Include zero-child jobs and every child ID. New Owner requests may queue but receive no external grant. Existing local/manual/recovery/finalization remains available. |
| 4 Quiesce/drain | A sender that passed its final check **may start its already granted GET after pause**. It is an old-grant obligation, not zero-spend-while-paused proof. Each known sender finishes/cancels/account-finalizes and acknowledges zero pending send/HTTP; alternatively prove its process stopped, bounded transport settled and ledger reconciled. Lease/grant expiry alone never proves no late send or no spend. No switch with unknown sender/result. |
| 5 Safe point | All pre-pause grant/call IDs classified/reconciled below; every sender quiescent/stopped, no pending dispatch or HTTP; no unresolved old-route accounting/completion; queued unadmitted jobs blocked by gate. Only then may Google be disabled/OL automatic activated. Native barrier between final check and GET must show pause accepts old obligation and switch waits. |
| 6 Switch while paused | Both registry rows FOR UPDATE in ascending adapter key, verify before-manifest hash, write final manifest in **one transaction**. Admission takes same sorted rows FOR SHARE, pins coherent snapshot; READ COMMITTED waiter sees before/after, never mixed pair. If policy_version must bump, update both together with recorded invalidation/old-source effects. Keep accepted v1 + v2 validators/field profiles; no relabel/delete. |
| 7 Readback/bounded smoke | General grants stay closed. Verify full rows/tuples; new smoke epoch allows only separately approved <=20-job cohort/budget/expiry/residue-cleanup script. Local, OL auto/explicit/approved ISBN, selected/Add/manual/no-cover, two stores; zero Google grants/egress/new shared data and honest usage. Abort on OL outage/429/breaker; health alone never passes. Drain smoke obligations before resume/rollback. |
| 8 Resume / failure | Passing smoke -> new open epoch/remove cohort/revalidate queued routes. Failure -> stay paused, recover/drain, recorded 8b artifact + rollback manifest under separate authority; Google stays disabled. Prefill rollback sets OL automatic_lookup_allowed=false, automatic_role/order=null; read back before resuming safe routes. SQL hook remains installed, with 02d §9 no-list/original replay receipts. No down migration/reset/unlink; local/manual and independently permitted explicit survive. |

Grant expiry is bounded by current claim lease and transport deadline; before
GET the worker still checks claim/cancellation/deadline. These are not an atomic
network fence: quiescence is the safe-point proof. A restarted worker cannot
replay a grant into HTTP. 8a-3/8b tests use a final-check/GET barrier, worker crash,
lease loss and pause/restart; every recorded grant remains an obligation until
settled. No exactly-once external-call guarantee (master section 8:560).

Fresh external misses while paused use private
phase9_job_admission_wait(job_id UUID PK/FK,blocked_epoch bigint,recorded_at timestamptz)
and service phase9_defer_metadata_admission_v1(fence jsonb,epoch bigint), 8a-5-owned.
Only no-lookup/no-reservation/no-call work may release lease/durably defer without
provider spend/allowance; existing authority returns drain_required, never a
neutral defer. Claim excludes current blocked epoch, avoiding repeated five-claim
burn. AutoFence or explicit fence is purpose/scope re-proved; no fake explicit job.

**Exhaustive drain report (design; read-only queries in the future script):**
Root captured_ids LEFT JOIN image_extraction_jobs j preserves every captured ID;
a missing job is BAD. Aggregate children **separately**
by job ID: phase9_metadata_lookups l; metadata_enrichment_attempts a via l;
phase9_usage_reservations u by u.job_id (including unbound reservations);
phase9_metadata_provider_calls pc by pc.job_id (including orphan calls). LEFT JOIN
those aggregates back to captured_ids; do not filter a nullable child in the root WHERE.
Also report any cross-scope/orphan reference as invalid. One row per captured job,
with full child-ID arrays and these explicitly derived query aliases:

| Alias -> real predicate/aggregate | Meaning |
|---|---|
| L / IL / PC | COUNT(l.id); COUNT(l.id) FILTER WHERE l.completed_at IS NULL; COUNT(pc.id), coalesce absent counts to 0. |
| MA | EXISTS incomplete external l WHERE NOT EXISTS a with a.lookup_id=l.id. No a.disposition comparison on a NULL row. |
| MR | EXISTS a of incomplete external l WHERE a.usage_reservation_id IS NULL OR NOT EXISTS u with matching id/job/store AND u.status IN ('reserved','consumed'). |
| UNKNOWN | EXISTS pc WHERE status IN ('registered','outcome_unknown') OR (edition_call_sequence IS NOT NULL AND edition_egress_started IS NULL). Existing status definitions M32:210-230; fan-out egress flag M73:653-674. |
| UNSENT | PC>0 AND every pc.status='stale_rejected' AND pc.edition_egress_started=false. No inference from an absent receipt. |
| KNOWN | PC>0 AND every call has finalized source-protocol-valid receipt or proven-unsent receipt; retain disposition/status/claim arrays, do not infer full success from one finalized GET. |
| BAD / SENDERS | BAD counts mismatched/missing job/candidate/store/lookup/attempt references or impossible source protocol. SENDERS is the operational worker inventory's not-yet-quiescent count for these grants, with evidence references; not an invented provider-call column. |

Evaluate this **ordered CASE, first matching branch only**; a read-only SELECT
for class n uses its predicate AND NOT any earlier predicate. Thus every captured
job appears exactly once, including no lookup/attempt/reservation/call:

| Class / predicate | Fenced action / exit |
|---|---|
| D0 BAD>0 | Stop: reconcile exact offending references, never omit/delete orphan children. |
| D1 UNKNOWN OR SENDERS>0 | Wait sender/finalization or exact original-identity recover/finalize; no new grant/refetch. Unknown/missing sender evidence remains stop, even if lease expired. |
| D2 L>0 AND IL=0 | Read/recover completed automatic/explicit receipt via phase9_recover_automatic_metadata_v1 / phase9_recover_candidate_edition_options_v1 where original fence available; audit digest/accounting/all children and require terminal job/cleared lease, otherwise stop. Completed alone does not outrank D1. |
| D3 L=0 | Explicit **absent-lookup** class, with/without job-level reservation. No provider calls can disappear (PC>0 => BAD/stop). Unadmitted queued job stays blocked; claimed no-egress job safely finishes/releases only proved unused reservation through its valid failure fence. Consumed/unproved usage stops. |
| D4 MA | Incomplete external lookup with **absent attempt**, regardless of unbound reservation. Recover any other children; valid failure fence/manual terminal, release only proved unused usage. No NULL disposition assumption. |
| D5 MR | External attempt with **absent/invalid reservation**: stop/reconcile proof, no completion or invented reservation/spend. Legitimate local/cache zero-egress is excluded by external predicate. |
| D6 PC=0 | Explicit **absent-call** class, attempts/reservations may be present. Local/cache uses its existing zero-egress recovery; external known-unsent only after quiescence, then valid purpose failure fence. No fabricated call. |
| D7 UNSENT | Exact finalization replay (phase9_finalize_edition_options_provider_call_v1), then purpose failure fence; no charge for proved-unsent call. |
| D8 KNOWN | Recover finalization/completion, preserving actual call spend once. Missing successful bytes -> manual through failure fence, never repeat HTTP. Partial/failure receipts remain their actual outcomes. |
| D9 ELSE | Stop: unmatched/inconsistent/unknown protocol; no default pass. Emit full IDs/flags/lease state. |

For D3/D4/D6-D8, mutation uses **current valid claim only**:
phase9_fail_metadata_job or phase9_fail_candidate_edition_options_v1(retry=false).
Lost lease -> original receipt-first recovery; if missing and job claimable,
reclaim solely for recovery/manual terminal with new token (no HTTP). Exhausted/
unclaimable/missing fence -> stop for the existing authorized Owner recovery
(M75:5-9/100-125 for explicit), never reset attempts/forge a lease. Independently
prove physical accounting settled before any reservation release or exit.

AC8-10 materializes aliases/CASE on native fixtures and asserts job count equals
sum(classes), unique classification and anti-join to captured IDs empty. Cover
all absent-child combinations, multiple children, orphan/scope mismatch, mixed
call statuses, committed response loss, every lease status and a final-check/GET
pause barrier. Quiescent D2 or safely resolved/deferred classes may exit; D0/D1/
D5/D9 and missing recovery proof block switch. No SELECT is executed here.

**Post-switch Google audit:** compare captured pre/post provider-origin IDs/counts:
canonical_provider_ids.adapter_key='google_books', book_metadata_sources.provider=
'google_books', typed-cache entries and new Google lookups/calls after switch_at.
Zero new grants/egress/shared effects; do not compare only URL text. Existing
private snapshots/choices/inventory are inventoried, never silently purged.

| AC8-10 compatibility/risk row | Required proof / response |
|---|---|
| Partial 8a + old worker | After each file, old Google auto/OL explicit contexts/completion/cache unchanged; **8a-1 interim allow-list/veto** and **legacy registration-C FK versus Select-L FK ACP-11 interleaving/invariant** pass. Failure stops chain/8b deploy; reviewed forward correction, no down migration. |
| Full 8a + 8b transition | Exact manifest including payload/lookup schemas; OL auto disabled, no-retention Google succeeds with hook absent/present receipt variants; record rollback artifact. |
| Switch/in-flight/lease loss | Exhaustive report + sender barrier + honest recovery/accounting, no duplicate HTTP or stale overwrite; general admission remains closed through bounded smoke. |
| v1 choices/v2 activation | Dispatch by accepted lineage version with distinct validators/schema tuple, original receipts/digest; alternative expiry/disable may hide rows, confirmed choice/saved-ID Add survives. Missing v1 support stops 8c. |
| Existing Google data | New independent veto, suppress saved auxiliary fallback/new-Add copy; chosen own snapshots/existing inventory links unchanged. OQ8-8/SDD-0 section 12.2 terms/cleanup still pre-launch. |
| OL outage/contact | Supply Owner contact before smoke; rate-limit/outage/breaker abort -> paused/recovery/recorded rollback, never outage-as-pass. |
| Policy split | Paired sorted locks/single transaction; concurrent admissions see only before/after manifest hashes, with recorded invalidations if both policy versions bump. |
| Rollback Google off | Only recorded 8b artifact, Google disabled; for prefill rollback OL automatic permission false/role/order null, readback and zero new OL automatic lists. Hook stays installed: new no-list completion skipped/no_retention, old saved/skipped receipts replay unchanged (02d §9/ACP-9). V1/v2/automatic/explicit/cache/typed ISBN/Add coherent; absent-hook not_installed also tested. Additive SQL/snapshots/links retained. |

**Dropped OD-3 row:** old Google-primary worker after Google disablement is neither
a required test nor a rollback target. No automatic full-list cache/author-cache
mechanism is needed for any row above.
