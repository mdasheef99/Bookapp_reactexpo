# Task 6: Resolved Owner confirmation read-contract gap

Status: implemented, locally verified and independently APPROVED for the bounded local Task 6 checkpoint.
Date: 2026-10-08. Phase 9 / completed Unit 6G baseline.
Sources: DOC-3 §§5.2/6, DOC-4 §§9-11, DOC-8 §5 → picker §§6-7/9,
EP-AC11/19 and Unit 6G §§11-14. This restores required resume behavior;
no product requirement or acceptance ID is added.

## Original evidence and accepted scope

M65 exposes automatic and held current_suggestion with the same original
selectionId/source/optionId/snapshot shape. reviewVersion remains null before
the first selling review. M66 privately records selected_by/selected_at;
M69 projects a held choice into metadata before review. An opaque UUID, source,
selected state or metadata similarity cannot prove Owner confirmation.
The preceding client review preserved this gap explicitly rather than guessing.

The Owner's why dont you complete it request authorizes the bounded
backend/shared-DTO/client correction. Separate explicit Yes, create the local
migration authorizes M70 only. M65-M69 edits, live application, deployment and
Tasks 7-8 are outside this correction.

## Implemented confirmation contract

Both strict selection branches require confirmedByOwner: boolean. No request
accepts it. M70's reader derives it from M69's valid private held projection:
matching store/session/card/query identity and selection ID, safe metadata,
compatible saved review when present, selected_by and selected_at evidence.
Automatic suggestions are false; valid held choices are true even when
current_suggestion has reviewVersion=null and alternatives have expired.
selection=null remains null. Owner IDs/private evidence are never exposed.

M70 preserves existing signatures, locks, fingerprints and stored receipts through
private legacy delegates. Every selection reply projects current confirmation,
including old receipts missing the field and new receipts recorded as true.
A superseded or query-invalid reply reports false, retaining its original
snapshot/versions; replay never rewrites stored JSON or restores alternatives.

Fresh full/compact draft initialization uses the flag only under the existing
session/card/candidate/metadata/selection fences. Full drafts confirm the chosen
title and all chosen authors, preserve authoritative null/different scripts and
leave price unset until entered. Generic refresh/conflict rebasing preserves
manual identity and selling edits. Full/compact command adoption and mounted
callbacks reject unconfirmed history even when current reread is unavailable.

Confirmation/read does not create a selling review or grant Add readiness.
Legacy strong selected mode and manual review remain compatible; existing
manual identity invalidation still clears readiness and needs canonical resave.
Lookup receipts remain slim and gain no metadata/confirmation authority.
No new UI, edition-number override, queue, provider, persisted field or automatic
alternative collection is added.

## Verification and limits

Meaningful initial RED: 13 failed/9 passed client/server/draft regressions and
10 failed/3 passed SQL cases against unchanged production. Later replay-adoption
and mounted fallback regressions reproduced their individual defects before
correction. Fixture setup failures are recorded separately in the evidence.
Final gates: 22 Jest suites/387 tests, 20 M70 full-stack SQL plus 32 historical
M69 SQL tests, strict TypeScript, metadata worker build and 14 structural tests.
Private ACL/scope, true pre-M70 upgrade/receipt preservation, expiry, independent
cards, no manufactured review/readiness and actual resumed Save/Add are covered.

The implementation gates above are local self-verification. The Owner-supplied
independent read-only Task 6 review is APPROVED; its separate rerun evidence is
recorded in [the review handoff](../trackers/02-implementation-and-verification.md#2026-10-08---task-6-independent-review-approved).
Neither gate proves independent-connection PostgreSQL races. Task 7 display,
browser/provider/rollout and Task 8 real race/operational checks remain pending. M65-M69 hashes are
unchanged; M65-M70 are CREATED_LOCAL / NOT_APPLIED. Production retention remains
disabled. No stage/commit/push/deploy or live database/Storage/provider write.

Exact next action: separate Owner authorization for Task 7, Metadata-sheet
display and interaction. Tasks 7-8 remain pending.
[Exact scope and verification](../trackers/02-implementation-and-verification.md#2026-10-08---task-6-confirmation-correction-local-completion).
[Forward compatibility and rollback](../supporting/database-current-vs-target.md#2026-10-08---task-6-m70-local-confirmation-correction).
