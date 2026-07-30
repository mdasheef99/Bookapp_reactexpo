# Phase 9 Unit 6 — Owner Capture, Review, and Recovery UX

| Status | Version/date | Repository checkpoint | Implementation authority |
| --- | --- | --- | --- |
| `approved_design_authority` | 1.0 / 2026-07-30 | reviewed exact tree based on `23c01ac3f5912c963c4441b35dc2232409c1c92a` | Unit 6A definition only; implementation, migration creation/application, deployment, and external mutation remain separately gated |

## 1. Status and authority

This is the approved Unit 6 implementation authority. Root marketplace
specifications outrank the approved Phase 9 Master/domain SDDs; current code and
M01–M28 prove implementation only and do not broaden scope.

The starting checkpoint and Git prove Unit 5C-5/5C-6 merged. The authorized
continuity closeout for this design records that fact and routes the next
separately authorized implementation session to Unit 6A only.

Authorities: [Master](../00-phase-9-master-sdd.md) §§2–10,
[Pipeline](../02-extraction-enrichment-pipeline-sdd.md) §§2–4/10–12,
[Owner Review](../03-owner-review-inventory-commit-sdd.md),
[Media](../04-media-security-privacy-sdd.md) §§3–6/9–13, and
[DOC-8](../../../DOC-8-store-owner-console.md) §§2–5/14–15.

## 2. Purpose

Give an eligible Store Owner a low-complexity mobile path to capture or select
spine images, observe durable processing, recover after interruption, review and
correct staged candidates, resolve exceptional linguistic variants, and produce
a versioned review-ready handoff for Unit 7. No Unit 6 action creates, increments,
publishes, merges, or otherwise mutates inventory.

## 3. Current implemented baseline

M05 exposes authenticated Owner session, candidate, review, missed/false, and
future commit RPCs. M11/M13 plus `phase9-owner-ingestion` harden scan upload and
registration; M11–M14 workers persist processing/retry/fencing/evidence;
M15–M17 persist metadata and selected snapshots; M18–M28 provide Owner variant
decisions/corrections and fail-closed rollout. No language is enabled.

Mobile has an Owner gate, one resolved active store, an Inventory tab, Image
Picker, TanStack Query, NetInfo, Sentry, and basic UI primitives. Image-to-LLM
is disabled and no Unit 6 route, service, or state exists.

### 3.1 Completeness gate

The required 24-topic product/backend/frontend/decision/gap matrix is supporting
matrix §2.1. Every topic is resolved or names a concrete gap; none requires a
blocking product decision. Section 33 supplies non-scope-changing defaults.

## 4. Scope

Scope covers entry/defaults, capture/gallery/preview/upload/progress, initiator
recovery, candidate review, false/missed/variant handling, readiness,
accessibility, offline/reconnect, observability, and Unit 7 handoff, plus only
the safe read/strict-review contracts needed to avoid private-table access.

## 5. Explicit non-goals

Excluded: inventory create/increment/merge, duplicate mutation, public
projection/display/media, customer photos, admin benchmark UI, rollout,
providers, commerce, support takeover, staff/manager scanning, localization,
and Realtime. Raw jobs/evidence/payloads/capabilities/paths/hashes/provider text
are never exposed.

## 6. Unit 6 versus Unit 7 boundary

Unit 6 saves review/publication/duplicate intent, marks false detections, creates
staged manual candidates, and stops at derived `review_ready`.

Unit 7 alone reauthorizes, locks/recomputes duplicates, validates sellability/
projection, and calls controlled commit. Unit 6 cannot call, wrap, simulate, or
optimistically apply it; preview is non-authoritative and writes nothing public.

## 7. Actors and authorization

Entry requires authenticated active Owner plus active/setup-complete/
selling-allowed store. `useStoreOwnerGate` supplies display context; the server
derives authority.

The Unit 6 pilot has one authorization rule: only the authenticated active
Owner whose `auth.uid()` equals the session's persisted `created_by` may
discover, read, resume, review, mutate, add a missed candidate to, mark a false
candidate in, or close that session. This rule applies equally to the active
session discovery result, the cross-session needs-review queue, candidate
summary/detail, review update, false/missed actions, readiness, and Close.
A different active Owner in the same store receives the same non-enumerating
denial as a cross-store caller. Staff, managers, support actors, client-supplied
store/session ownership, and override claims convey no Unit 6 authority.
Shared-store review is deferred product scope and requires a later source-spec
decision; it is not an implementation option.

## 8. End-to-end Owner journey

1. The hub resolves Owner/store and fetches one active session plus needs-review.
2. The Owner resumes or starts with visible defaults, then chooses camera/gallery,
   checks the preview guidance, and uploads.
3. Registration starts durable sanitation/analysis; the Owner may add an image
   or leave while ordered cards arrive and failures stay input-local.
4. The Owner confirms original fields, edits store fields, handles false/missed
   candidates, and sees exceptional variants only when offered.
5. Saved versions feed readiness. Close requires terminal inputs and never
   commits/discards; Unit 7 later consumes candidates independently.

## 9. Route hierarchy

Replace leaf `app/(store-owner)/inventory.tsx` with a nested Inventory Stack
while preserving the tab URL:

```text
inventory/{_layout,index,reviews}
inventory/scan/{index,preview,[sessionId]}
inventory/scan/[sessionId]/{candidate/[candidateId],missed,summary}
```

The supporting screen matrix gives exact files. Source selection is the OS
picker; variants use a detail sheet. Nested routes hide from tabs and deep links
reauthorize through the Owner gate.

## 10. Screen specifications

The complete per-screen contract—including purpose, entry, fields, actions,
backend calls, local/loading/empty/error/offline/conflict/accessibility states,
and exit guards—is in
[the Unit 6 contract matrix](./06-owner-capture-review-recovery-contract-matrix.md)
§2. Eight routed screens cover the hierarchy; the OS source picker and variant
sheet are the two specified major modals.

## 11. Text wireframes

```text
Inventory · Local Books
[ Scan book spines ]  [ Add manually ]
Resume scan · 2 images processing             [Resume]
Needs review · 6 books                        [Review]
Existing inventory...
```

```text
Scan session                          Saved on server
Image 1  Uploading 64% / Checking / Finding books
Image 2  Try a clearer photo                     [Retry]
[ Camera ] [ Gallery ] [ Add missed book ]
Ready 4 · Needs attention 2 · Processing 1
Candidate cards (virtualized, spine order)
```

```text
Book 3 · Needs attention
Original title* [................................]
Author 1        [................................] [Confirmed]
Metadata match  [Matched / Manual]
Condition [Good ⓘ] Quantity [1] Shelf [A1]
Damage [No / Yes]
  When Yes: [Types...] [Public note...] [Complete/readable/safe]
  Sellable [Yes / No]   Unsellable always saves private
Visibility [Save private]
Possible match: same edition · 3 available     [Review intent]
[Save review]                                  [Remove false detection]
```

## 12. Component architecture

`src/features/imageInventory/` owns strict DTO/API adapters, scoped TanStack
queries, ephemeral upload/form reducers, screens, and small session/capture/
progress/candidate/field/condition/attention/variant/readiness components.

Reuse core backgrounds/cards/buttons/theme/network/Sentry/Owner gate/Image
Picker/navigation guards and adapt Library/onboarding form patterns. Do not
reuse legacy inventory form/edit/condition domain logic: its vocabulary,
direct-table writes, and accessibility are unsuitable.

## 13. Frontend state ownership

Server owns authority, workflow states, snapshots, proposal lifecycle, versions,
safe errors, and idempotent results. TanStack Query owns decoded private
snapshots keyed by user/store/session/candidate/contract and is cleared on
identity change. Screen reducers own picker URI/progress, unsaved values, focus,
and a pending semantic action/key. Routes carry opaque IDs only.

Polling is visibility-aware: faster while an input is active, slower while
backgrounded, stopped on terminal state, and immediately refetched on reconnect/
foreground. Realtime is not required.

## 14. Draft persistence model

Only explicit review/false/missed/variant commands persist. Unsaved state is
memory-only; book/media/capability/snapshot/mutation data cannot enter
AsyncStorage/MMKV because secure-at-rest persistence is not approved.

Exit offers Stay or Leave unsaved and never deletes server state. Save replaces
the draft with canonical detail/version; same-key retry lives only with the
pending semantic action.

## 15. Backend contract inventory

Supporting matrix §1 records every action’s exact symbol/path, DTO, authority,
version/replay, tests, and ready/adapter/gap/U7 classification.

Supporting matrix §§1.1–1.4 are the implementation authority for the eight
missing Owner-safe operations. They fix the `phase9-owner-ux-v1` envelope,
request/response fields, nullability, enums, versions, cursor behavior,
idempotency, safe errors, privacy exclusions, forward-migration expectation,
and representative red tests. Implementation may change transport mechanics
only if the same strict contract and trust boundary survive independent review;
it may not defer field or enum selection to coding time.

## 16. Backend gaps

The genuine gaps are: an initiating-Owner active/review recovery query; an
Owner-safe session/input progress DTO with safe retry/terminal information; rich
paged candidate/detail DTOs with bounded metadata, confirmations, attention,
advisory duplicates, and readiness; and a strict versioned
`UpdateCandidateReviewRequest` with canonical detail response. M05’s arbitrary
`jsonb` review snapshot is insufficient for a security/publication boundary.
The session DTO must also return the canonical close summary.

Extend named Owner Edge/RPC boundaries with red auth/DTO tests, never table
grants or convenience endpoints. Upload retry gets a new capability; transient
worker retry stays server-owned.

The required forward work is one Owner Edge action family backed by eight
initiator-scoped RPCs: discovery, session summary, input page, candidate page,
candidate detail, strict review update, readiness, and Close. Existing M05
symbols remain evidence, not a reason to expose incomplete results. Unit 6A
must introduce or replace those boundaries in a new migration; it must not
alter already-applied M05 or grant authenticated table reads.

## 17. Session and candidate state model

Persisted states remain Master §6:
session `active→closing→closed` or system `expired`; input
`uploaded→validating→queued→processing→ready|failed|skipped`; candidate
`processing→ready|needs_review|possible_duplicate|failed→commit_in_progress→committed`.
Unit 6 adds presentation-only states: `uploading`, `checking_image`,
`finding_books`, `needs_attention`, `review_saved`, and `review_ready`.
`review_ready` is derived from the current returned candidate version; it is not
a new database state and becomes false after any relevant candidate, metadata,
duplicate-advice, or variant-source revision change.

Supporting matrix §2.4 deterministically maps every persisted/derived
session, input, sanitation, analysis, candidate, metadata, variant, retry,
terminal, and readiness condition to a presentation state. That matrix controls
labels, polling, actions, retry ownership, Close/readiness blocking, and live
announcements. Presentation labels and codes must never be written back as
database state.

## 18. Recovery and resume

Recovery always starts from the server, never a locally remembered route.
Inventory hub discovers the one initiator-owned active session, then navigates
by returned ID. A deep link reauthorizes before render. Foreground/reconnect
refetches summary, inputs, and visible candidates. Missing/expired sessions
return to the hub with bounded text. Logout clears all private query and local
workflow state without deleting the server session.

Recovery begins only after successful registration. Picker URI, upload
capability, and bytes are intentionally memory-only; process death after
authorization or byte transfer but before registration is non-resumable. On
relaunch no input is invented: the Owner sees “That upload was not registered.
Select the image again.” and performs a new deliberate upload. Server retention
and orphan reconciliation—not the mobile client—expire the unused capability
and remove an unregistered staged object.

## 19. Retry and idempotency

Start/close/save/false/missed/variant actions reuse one key for the same semantic
attempt and use a new key after changed input. Upload bytes retry only while the
capability is valid; expiry/object change requests another. Registration replay
returns the canonical input/job. Transient worker failure displays server-owned
retry; terminal failure creates a new deliberate upload. Validation, policy,
quota, over-15, and stale errors are never blindly retried.
Kill/relaunch tests cover authorization-only, mid-transfer, and
bytes-complete/pre-registration interruption and prove no duplicate input,
discoverable phantom progress, or client cleanup authority.

## 20. Stale/version conflict UX

On candidate, metadata, duplicate-advice, or proposal conflict, keep unsaved
local values in a comparison view, refetch canonical detail, identify fields
that changed, and require the
Owner to choose Use latest or Reapply my edits. Reapply validates against the new
candidate and metadata revisions and uses a new semantic idempotency key.
Approve/reject/replace follows the same rule; stale source linkage cannot be
overridden. Session conflicts
refetch and redirect on closed/expired/unauthorized state.

## 21. Offline behavior

Offline mode may show already loaded in-memory data with an explicit “May be out
of date” banner. Starting sessions, opening pickers for intended upload,
uploading, saving, retrying, closing, false/missed actions, and variant decisions
are disabled. No offline mutation queue exists. An already open unsaved form
stays in memory while mounted. On reconnect, refetch before enabling actions;
versions—not timestamps—decide whether the draft can save.

## 22. Privacy and media handling

Use local URIs only for pre-upload preview and release them when the screen
unmounts. Never base64-encode in JS, persist the URI, add it to query state, or
send it to Sentry. Signed URL/token responses use `no-store`, remain adapter-local,
and are never logged. Render only sanitized text DTOs; treat all model/provider
text as plain text. Scan media is never a cover, marketplace preview URL, public
derivative, duplicate signal, or customer-request image.

## 23. Accessibility

Actions require visible text or label/hint/role/state and 44×44 targets. Focus
follows input/candidate order and moves to bounded status/field after Save/error;
live regions announce milestones, not every poll. Status/attention/condition/
errors never rely on color, and condition help works on tap/focus/screen reader.
Layouts scale/reflow without forced two-column fields. Original Unicode is
preserved; mixed-direction behavior is tested before any RTL rollout.

## 24. Low-end Android performance

Do not decode image bytes into JS memory; upload from URI/blob transport and show
one bounded preview. Use `FlatList` virtualization, stable keys/callbacks,
memoized cards, incremental pagination, and lightweight placeholders. Do not
render all expanded metadata or all candidates at once. Poll only visible active
work, coalesce refetches, and avoid animated layout on every status tick.

Gates: responsive interaction at 15 candidates, no duplicate fetch storm on
foreground/reconnect, no unbounded image-memory growth across three sequential
captures, and acceptable screen-reader/large-text use on a representative
low-end Android device. Exact timing/memory thresholds require measured pilot
evidence rather than invented constants.

## 25. Validation and trust boundaries

Client checks MIME/declared bytes, required fields, integer quantity, INR display,
and obvious input length only for guidance. Server validates signature/decode/
pixels, store/session authority, strict DTOs, versions, state, field language/
script, condition/damage, price in integer minor units, duplicate evidence, and
variant source linkage. Client store IDs, stages, confidence, readiness, and
publication eligibility are never authoritative.

Supporting matrix §2.3 is the strict Unit 6 review-field contract. The client
may provide immediate guidance using the same bounds, but the server rejects
unknown keys and owns normalization, enum validation, cross-field rules,
`review_ready`, and the returned canonical value/version. Unit 7 must re-read
and revalidate every sellability, duplicate, damage/media, publication, and
version-dependent value; Unit 6 review readiness is not commit eligibility.

## 26. Analytics and observability

`phase9OwnerUxTelemetry` allowlists entry/source/upload/resume/candidate/
false-missed/variant/conflict/reconnect/readiness/close categories. Properties
are approved opaque IDs, ordinal/count/duration buckets, route/stage, safe code,
and contract/app version. Titles, authors, ISBN, notes, media data/URI/hash,
capabilities, raw errors/payloads, and PII are forbidden. Server events remain
authoritative for business outcomes.

## 27. Error, loading, and empty states

Every query has loading, empty, retryable, and terminal auth/not-found/expired
states. Upload distinguishes local read, transport, registration, sanitation,
and analysis. Registered `P9_*` copy is used; unknown errors are generic with
private correlation. Partial failure does not block other cards, quota preserves
manual entry, and success language waits for server confirmation.

## 28. Testing strategy

Red tests cover strict DTO/privacy/telemetry, reducers/idempotency/conflict,
components/accessibility/large text, routes/gates, Edge/RPC authorization,
upload expiry/progress, recovery/polling, 0/1/15/over-15/repeated-spine fixtures,
manual metadata fallback, stale variants, and native low-end Android recovery.
Provider output uses fixtures; every layer asserts Unit 7 effects absent.

## 29. Acceptance matrix

Supporting matrix §3 defines 40 identified, subunit-mapped criteria.

## 30. Implementation subunits

Supporting matrix §4 defines six independently reviewable merge units:
6A Owner-safe backend contract foundation; 6B Inventory route/query/identity/
cache foundation; 6C session entry/capture/upload/progress/recovery; 6D
candidate review/strict editing; 6E false/missed/variant decisions; and 6F
readiness/offline/privacy/accessibility/performance/telemetry/Unit 7 handoff.
Backend migration work and frontend navigation are deliberately separate.

## 31. Risks and mitigations

Privacy leakage is contained by scoped query keys, identity clearing, no
persisted drafts, and telemetry allowlists. Server versions prevent polling/
stale overwrite; capability plus registration replay prevents duplicate upload
effects. A separate feature module avoids legacy direct-write/condition drift.
URI transport, one preview, virtualization, and bounded polling protect low-end
devices. Architecture tests forbid commit/publication imports or effects.

## 32. Open decisions

There are no blocking product questions. Non-blocking choices to validate during
implementation are visual styling, whether the hub uses a card or banner for the
single resumable session, and exact polling intervals. None changes route
ownership, persistence, Unit 6/7 scope, security, or recovery.

## 33. Recommended defaults

Preserve `/inventory` as a nested Stack; combine progress and candidate list;
use explicit server saves with no persisted/offline draft queue; and use
poll/refetch rather than Realtime. Keep required current English default until
rollout authority, private first-session intent, and only server-approved later
defaults. Terminal image retry is a new upload while transient retry is
automatic. Variants expose only `allowed_actions` and may remain unresolved.
Duplicate intent is staged, while every resolution effect stays in Unit 7.

## 34. Definition of Unit 6 completion

Completion requires six independent merges, AC01–AC40 evidence, separately
authorized live DTO/adapters, camera/gallery/recovery/15-card/offline/stale/
accessibility/Android gates, clean privacy scans, zero Unit 7 effect, and exact
continuity records.

## 35. Unit 7 handoff contract

Unit 6 hands off a freshly read `OwnerCandidateDetail`: bound opaque IDs,
candidate/review versions, confirmations/readiness, staged sellable fields and
intent, advisory duplicate version/action, variant summary, blocking codes, and
allowed next actions.

Unit 7 must refetch and reauthorize this envelope, recompute duplicate and public
eligibility under its transaction locks, and treat every field as staleable.
Unit 6 never promises commit success. A Unit 7 result invalidates relevant Unit 6
queries; a failure returns to the candidate with its surviving review state and
does not silently repeat inventory effects.
