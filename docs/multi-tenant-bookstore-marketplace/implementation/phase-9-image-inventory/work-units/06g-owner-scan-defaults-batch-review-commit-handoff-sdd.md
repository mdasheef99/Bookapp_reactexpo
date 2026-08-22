# Phase 9 Unit 6G SDD: Owner Scan Defaults, Batch Review, and Commit Handoff

**Status:** `group1_approved_locally_complete_groups2_4_pending`
**Version/date:** 0.1 / 2026-08-21
**Authority:** the Owner workflow decisions recorded in P9-D81 through P9-D85;
DOC-3 §§5–9/15–16; DOC-4 §§2–5/9–15; DOC-8 §§2–5/14–15; Phase 9
Master §§2–9/14; Owner Review SDD §§2–6/8–16; Unit 6 §§8–35; Unit 7A
§§2–20; and Unit 7C §§1–16.
**Specializes:** Unit 6 session setup/review and the Owner-facing Unit 7A
handoff. It does not reopen Unit 6F native evidence, rewrite M39, or redesign
Unit 7C.
**Implementation authority:** Group 1 contract/persistence foundation was
explicitly approved and is locally implemented on the existing branch, with M52
unapplied. Groups 2–4, migration application, deployment, and live
database/Storage mutation remain separately unauthorized.

## 1. Decision and intended outcome

Unit 6G reduces the Owner's image-to-inventory path to two compact surfaces:

1. choose reusable values once before capture; and
2. review every detected book in one bounded scrollable page, changing only
   exceptions before adding one book or all ready books.

The Owner does not complete a long form and then press a separate Save button.
Per-card **Add to inventory** and top-level **Add all ready books (N)** are the
explicit review actions. Each action first persists the exact displayed review,
waits for the canonical server response, and only then invokes the existing
create-only Unit 7A commit for that candidate.

This remains human-in-the-loop. No model, worker, background poll, session
Close, or default selection creates inventory. A bulk action is one explicit
Owner authorization to orchestrate multiple independent candidate commands; it
is not one database transaction and does not weaken per-candidate validation,
version fencing, idempotency, or partial-failure isolation.

## 2. Scope

Included:

- a complete pre-scan defaults form with required location and optional
  condition, selling-price default, and batch label;
- fixed INR presentation with whole-rupee input while preserving minor-unit
  storage;
- one bounded session review aggregate for at most 15 candidate cards;
- compact inline edits using selectors, segmented controls, a stepper, and a
  price picker rather than unbounded free text where a closed choice exists;
- a small metadata bottom sheet/modal opened from a card;
- combined save-then-commit per card;
- combined save-then-commit orchestration for all currently ready cards;
- durable Owner removal of a real candidate from the scan, distinct from false
  detection and input removal;
- partial-success recovery and Store View cache synchronization; and
- accessibility, privacy, performance, and deterministic red-test gates.

Excluded:

- remembered last-used defaults and named presets;
- Undo/Restore for candidate removal or inventory commit;
- a batch database commit RPC or all-or-nothing session transaction;
- automatic publication, automatic inventory commit, or automatic metadata
  rematching;
- choosing another metadata match;
- notes editing in the Unit 6G card UI;
- acquisition cost, currency selection, paise entry, tax, supplier, lot, or
  promotion behavior;
- public use of scan media;
- post-commit quantity mutation through the review command; and
- Unit 7C redesign, Unit 8 behavior, or unrelated native Unit 6F closure.

## 3. Verified implementation baseline

The inspected repository and applied migration history establish these current
facts:

- `phase9_start_session` persists language, script, condition, location,
  quantity, and publication, but the current Owner Edge path accepts only
  language/script/condition and hardcodes location=`default`, quantity=`1`, and
  publication=`private`.
- `image_extraction_sessions` has no durable default selling price or batch
  label. `default_condition` is currently non-null.
- `OwnerCandidateSummary` contains identity/status/readiness only. It lacks the
  review values, cover, field source, and allowed actions required for compact
  inline editing.
- `OwnerCandidateDetail` and `phase9_update_candidate_review_v2` already carry
  the strict review fields and canonical versioned Save response.
- M39's `phase9_add_candidate_to_inventory_v1` already performs the required
  locked, server-authoritative, idempotent, create-only private commit.
- candidate dispositions are only `reviewed` and
  `skipped_false_detection`; there is no durable general Owner-removal value.
- `synchronizeCandidateCommitSuccess()` refreshes candidate/readiness/discovery
  and older Owner inventory reads, but not `storeViewKeys.all`.
- private Store View cards currently derive their cover from public listing
  state; Unit 6G must use candidate/metadata cover data and must not depend on a
  post-commit public cover.

M39 through M51 are applied and immutable. Unit 6G uses forward contracts only.

## 4. End-to-end flow

```text
Inventory -> Start scan
  -> choose required/optional defaults
  -> capture or select one image
  -> sanitation / vision / metadata workers
  -> one session page with processing and review cards
  -> edit exceptions inline or inspect metadata
  -> Add one OR Add all ready
       -> strict Save for candidate
       -> canonical returned versions
       -> server readiness / allowed-action check
       -> existing Unit 7A create-only private commit
       -> remove successful card from active review
  -> continue reviewing or close when input-terminal
  -> optional View in Store View by returned inventoryId
```

Close remains independent. It never adds, removes, or discards a candidate.

## 5. Pre-scan values

The setup screen owns the following exact effective values:

| Value | Owner control | Initial/effective behavior | Persistence and downstream use |
| --- | --- | --- | --- |
| Location | Required select-or-enter field | No hidden fallback; Start is disabled until non-empty | Durable session default; copied to `shelfLocation` unless a card overrides it |
| Language | Optional searchable dropdown | English (`en`) is preselected; the value remains a hint/fallback, never forced candidate identity | Durable session hint; valid detected candidate language wins and is labelled Detected |
| Condition | Optional five-value dropdown | `Not set`, New, Like New, Very Good, Good, Acceptable | Nullable durable session default; `Not set` makes each card require a condition |
| Selling price | Optional whole-rupee picker | `Not set` initially unless the Owner chooses a value | Nullable durable `default_price_minor`; inherited by cards and still revalidated on Save |
| Quantity | No pre-scan editor | Fixed at `1` | Existing durable session default remains `1`; each card has a post-scan stepper |
| Publication intent | Two-state segmented control | Save private initially; Owner may choose Prepare to publish later | Durable `private|publish` intent only; Unit 7A still creates private inventory |
| Batch label | Optional text | Empty | Durable session-only Owner label; not copied to inventory and never affects readiness |
| Currency | No selector | Fixed INR, displayed as `₹` | No currency column is added; canonical money remains integer minor units |
| Script | No control | Derived from detected/reviewed language and text when available | Existing nullable session/candidate/review lineage is preserved |

“Price” in Unit 6G always means the selling price (`priceMinor` /
`selling_price_minor`), not acquisition cost.

The batch label is trimmed Unicode NFC plain text, null when empty, and bounded
to 80 code points. It is visible in session recovery/review/summary only and is
forbidden from public DTOs, inventory rows, listings, analytics text, and
provider/model inputs.

## 6. Price interaction

The picker uses INR and whole rupees:

- `Not set`;
- ₹25 increments from ₹25 through ₹250;
- ₹50 increments from ₹300 through ₹1,000;
- ₹100 increments from ₹1,100 through ₹2,000; and
- `Custom`, accepting a non-negative whole-rupee amount within the existing
  safe minor-unit bound.

The UI multiplies the rupee value by 100 exactly and submits an integer
`priceMinor`. It never uses floating-point currency arithmetic and never asks
the Owner for paise. `Not set` is null and differs from an explicit ₹0. The
existing rule remains: ₹0 may be saved only for private intent and cannot
publish; positive price is required before later publication.

## 7. Default inheritance and field-source rules

Card drafts are derived deterministically in this precedence order:

1. current saved Owner review;
2. current accepted candidate/metadata values for bibliographic identity;
3. applicable session defaults; and
4. explicit missing state.

No later worker response silently overwrites a saved Owner review. Any changed
candidate, metadata, or review revision makes the draft stale and requires a
fresh read before Save.

The server-composed card projection uses one source-code vocabulary for every
displayed business field. The internal code-to-badge mapping is normative:

| Internal source code | Visible badge | Meaning |
| --- | --- | --- |
| `matched` | `Detected` | The current selected metadata/identity match is the source; the internal `matched` code is never rendered as a separate `Matched` badge. |
| `detected` | `Detected` | The current bounded observed identity is the source. |
| `default` | `Default` | The value is inherited from the persisted session default. |
| `custom` | `Custom` | The Owner's saved per-card value overrides the observed/selected/default value. |
| `missing` | `Missing` | The final value is absent or cannot yet be used. |

The source precedence is the same for every field: saved per-card provenance
first, accepted observed/selected identity second, applicable session default
third, and `missing` last. The server derives the source from the persisted
review/metadata/default relationship; the client cannot replace a server
source label with an equality comparison or a caller-supplied badge. A valid
detected language that differs from the English hint is accepted and is
`Detected`, not an error.

The allowed source codes are explicit:

| Displayed field | Allowed source codes | Missing/default rule |
| --- | --- | --- |
| Cover | `matched`, `missing` | Selected/observed allowlisted metadata cover only; no scan-media fallback. The server emits `matched` when the selected snapshot carries an approved cover and `missing` otherwise. |
| Title, authors | `matched`, `detected`, `custom`, `missing` | No setup default; empty authors are `Missing` while the existing review schema still permits an empty confirmed author array. |
| Language/script | `matched`, `detected`, `default`, `custom`, `missing` | The English hint is `Default` only until valid detected or explicit Owner language wins. |
| Condition, price, location, publication | `default`, `custom`, `missing` | An unset required final value is `Missing`. |
| Quantity, damage | `default`, `custom` | Quantity is server-fixed to `1` before scan, so it is never missing; damage is answered by the existing review schema and defaults to no-damage. |

The response enums may admit additional values (for example `missing` for
damage or `detected` for cover) as client-side supersets; the server never
emits them. The emission table above is normative for display logic.

Metadata state labels such as `Matched`, `Manual`, and `Pending` remain state
labels in the metadata-status field. They are not source badges and must not
contradict the canonical mapping above.

## 8. Unified post-scan page

The existing session progress route becomes the primary combined progress and
review surface. The cross-session Needs Review page remains only an entry point
and routes the Owner to the owning session page.

The page contains:

- session/batch label and capture progress;
- count summary: Ready, Processing, Needs attention, and Added;
- top action **Add all ready books (N)** when `N > 0`;
- a virtualized, stable-ordinal list of at most 15 cards; and
- existing Add missed book, session summary, and Close navigation where
  currently allowed.

Successful commits leave the active card list after authoritative success.
They remain represented by the Added count and server close summary. Failed or
stale cards remain in place with their edits, bounded error, and retry action.

## 9. Compact card contract

Every card shows all final business values in compact form. Inherited values
are visually subdued; missing, invalid, stale, or custom values receive the
attention treatment. Values are never hidden merely because they match a
default.

| Card element | Display/edit behavior |
| --- | --- |
| Cover | Allowlisted metadata cover thumbnail with the `Detected` source badge when its internal source is `matched` or `detected`, or a `Missing` placeholder; never scan media |
| Title and authors | Full accessible value, visually bounded summary; tap opens simple inline/manual edit |
| Metadata status | Matched, Manual, No match, Pending, or Needs attention; opens metadata sheet |
| Language | Searchable dropdown; source chip shows Detected, Default, or Custom |
| Condition | Exact five-value dropdown with accessible explanations |
| Selling price | Whole-rupee preset/custom picker from §6 |
| Quantity | Stepper, initial default 1, existing server bound enforced |
| Location | `Use batch location` or `Custom`; custom uses bounded text input |
| Publication intent | `Private` or `Prepare to publish`; explanatory text says commit remains private |
| Damage | No damage / Has damage segmented control; Yes expands exact existing type/note/sellability/complete-readable-safe fields |
| Source markers | Default, Detected, Custom, or Missing per §7; internal `matched` always presents as `Detected` |
| Metadata action | `View metadata` |
| Removal action | `Remove from this scan`, visually secondary/destructive and confirmation-gated |
| Primary action | `Add to inventory`; there is no separate Submit or Save button |

Public and internal notes are not rendered or editable in Unit 6G. When an
existing saved review contains notes, every Unit 6G Save must round-trip those
unchanged. A new review submits the existing canonical null-note object. Hiding
the fields must never erase existing data.

## 10. Metadata sheet

`View metadata` opens a small bottom sheet on mobile and an accessible modal on
larger layouts. It fetches the current candidate detail on demand and shows only
the bounded Owner-safe metadata:

- title and authors;
- language;
- ISBN-10/13;
- publisher and published date;
- edition/volume/format;
- page count; and
- metadata status/provenance category without provider payload, confidence,
  attempt, cost, or raw evidence.

Actions are:

- **Use detected details** — available only when the bounded observed identity
  is usable under `ObservedIdentitySummary`: title is safe text `1..512`,
  language is canonical BCP 47, script is null or ISO 15924, and every author
  is safe text `1..256` with at most 20 entries. An empty author array remains
  valid because the existing strict review schema permits it. The action
  copies the observed title/authors/language/script into the mounted review,
  marks title/authors as confirmed, and performs the exact existing metadata
  transition `metadataChoice = { mode: "manual", selectionId: null }`. It does
  not rematch and does not mutate a canonical work, edition, provider row, or
  selected snapshot. If a selected snapshot was previously displayed, it is
  no longer authoritative for this review: the subsequent strict Save and M39
  manual path use the Owner-confirmed observed identity, leave canonical work/
  edition and selected-provider metadata nullable, omit the selected cover,
  and use the existing `manual-review-v<reviewVersion>-metadata-r<revision>`
  metadata provenance. The candidate's existing bounded observation lineage
  remains provenance; raw provider/vision payload is never copied into the
  review or inventory.
- **Edit manually** — uses the same existing `metadataChoice.mode = "manual"`
  and `selectionId = null` terminology, retains nullable canonical linkage,
  and opens the identity fields. It is the fallback when observed identity is
  incomplete or unusable.

If the observed identity is incomplete, the action is not offered and a stale
or forged invocation has no mutation effect. The card remains Needs attention
with the existing `metadata_manual_required`, `title_confirmation_required`,
and/or `language_required` attention/blocker codes as applicable. The Owner must
edit the missing bounded identity manually; there is no partial copy, silent
fallback, or `Choose another match` action. A selected metadata path remains
available only when the Owner explicitly keeps a valid selected choice.

There is no **Choose another match** action in Unit 6G. Closing the sheet makes
no change.

## 11. Explicit review and local draft semantics

The card draft exists in memory only and is derived from the latest server
aggregate. No AsyncStorage/MMKV/offline mutation queue is introduced.

Pressing Add explicitly confirms every value visibly represented by that card,
including the shown title/authors and No damage when unchanged. Pressing Add all
does the same for every card included in `N`. The serializer sets exact title
and per-author confirmations only as part of that explicit action; merely
loading or scrolling a card confirms nothing.

Dirty exit uses the existing Stay/Leave-unsaved guard. Reconnect or foreground
refetches authority before enabling mutation. Offline data may remain visible
with the existing stale banner, but edit submission, removal, Add, and Add all
are disabled until a successful authoritative refetch.

There is one client command slot per candidate, shared by the internal Save
phase, per-card Add, Add-all membership, and Remove. Claiming the slot is
local and synchronous before any network request; all other controls for that
candidate are disabled while the slot is held. A candidate is never queued
behind another command. A second command receives a bounded `busy` result and
does not send a Save, commit, or removal request. This rule also applies when
the same candidate is visible in a bulk run and in a per-card control.

## 12. Per-card Add to inventory

One press performs this state machine:

```text
idle
  -> validating displayed draft
  -> refreshing authority when stale or not current
  -> saving strict review
  -> applying canonical returned candidate/review/metadata versions
  -> checking returned reviewReady + add_to_inventory capability
  -> committing through M39
  -> committed | save_failed | commit_failed | stale
```

Rules:

1. No commit call occurs if Save fails or returns a non-ready detail.
2. The commit request contains only M39's IDs/versions/idempotency fields; it
   never resubmits business values.
3. Save and commit use separate semantic idempotency identities.
4. An ambiguous transport result retries only with the same identity for that
   command until authority is reconciled.
5. No optimistic inventory effect or card removal is allowed.
6. Success returns `inventoryId`, removes the card after cache synchronization,
   keeps the Owner in review, and may offer **View in Store View**.

The Add command owns the candidate slot from its initial validation through
Save, readiness, M39, and reconciliation. A separately attempted internal
Save or Remove cannot interleave with it. The server remains the final fence:
each future Unit 6G mutation locks the candidate and checks the disposition,
expected versions, and idempotency identity before effect. If removal wins
between Save and M39, M39's existing `review_disposition='reviewed'`
eligibility check fails for `owner_removed_from_scan`; if M39 wins first,
removal fails closed on the committed state. No successful removal can be
followed by a successful inventory commit.

## 13. Add all ready books

### 13.1 Ready-to-submit versus commit-ready

The UI summary's `Ready` count means the current card draft is complete under
the strict review schema, candidate metadata is in a reviewable terminal state,
current server capabilities allow review, and no stale-source blocker is known.
It may still need to be saved.

`commit-ready` remains server-only and exists only after the strict Save returns
the current `reviewReady=true` detail with `add_to_inventory`. The coordinator
must never skip this transition.

### 13.2 Orchestration

Pressing **Add all ready books (N)** freezes the visible candidate IDs, draft
fingerprints, and current versions included in that action, confirms the count,
and executes the §12 state machine independently for each candidate.

- concurrency is bounded to three candidates;
- the coordinator claims one command slot per candidate before freezing
  membership; candidates already claimed by per-card Save/Add/Remove or another
  bulk run are skipped and reported as `busy`, never queued;
- order is stable candidate ordinal, although completion order may differ;
- one failure never stops unrelated candidates;
- no new candidate discovered after the press joins the running operation;
- no automatic retry uses a new key for an ambiguous command;
- leaving the screen creates no background client queue; and
- a later resume derives truth from server candidate/inventory state.

The batch result reports Added, Busy/skipped, Needs attention/stale,
Failed/retryable, and Still processing counts. The button may run again only
for the newly computed ready set; already committed candidates cannot be
repeated. A server-side race that wins after local slot claim is reported as a
stale/state result and cannot create a duplicate inventory row.

This is a narrow prospective specialization of Unit 7A's “no batch action”
wording. If this SDD is approved, the prohibited behavior remains automatic or
atomic batch commit. One deliberate Owner button may orchestrate the already
approved independent candidate commands.

## 14. Partial success, recovery, and cache synchronization

For each candidate:

- Save failure leaves the candidate uncommitted and preserves the local draft;
- commit failure leaves the canonical saved review intact;
- stale versions refetch and preserve edits for explicit Reapply;
- successful commit is final and idempotently reflected on resume; and
- an app interruption is reconciled from candidate state and the canonical M39
  result, never from a persisted local queue.

After each successful commit, candidate/detail/readiness/discovery/session
caches are synchronized. Store View list caches are invalidated once after a
single success or coalesced after a bulk run. This closes the current
`storeViewKeys.all` refresh gap without changing Unit 7C tables or commands.

## 15. Remove from this scan

Unit 6G adds the exact persisted review disposition:

```text
owner_removed_from_scan
```

It means: “the detected book may be real, but the Owner does not want this
candidate in this scan.” It is distinct from:

- `skipped_false_detection` — the observation is not a genuine book candidate;
- input removal — the whole current image is removed before candidate lineage;
  and
- inventory deletion/stock removal — a post-commit Unit 7C operation.

The command is initiating-Owner-only, candidate-version fenced, idempotent, and
allowed for any uncommitted candidate after it exists. It locks the candidate,
records the disposition plus bounded audit/event evidence, increments the
candidate/review-scope presentation revisions, and returns canonical removal
state. It never deletes the candidate, metadata, analysis, input, media object,
inventory, listing, or audit history.

Remove must first claim the same per-candidate command slot as Add/Save. The
server transaction then locks the candidate and changes the disposition before
releasing the lock. If an Add/Save already holds the slot, Remove reports
`busy` without a request; if an independently raced commit holds the server
lock, Remove returns the existing state conflict. A removal that commits first
sets the disposition so the unchanged M39 reviewed-only eligibility contract
cannot commit it afterward.

If metadata work is already running, completion may retain bounded metadata
lineage but cannot clear the disposition, return the card to the active queue,
or authorize commit. New worker work is not required solely for a removed
candidate. Removed candidates are excluded from active/ready/needs-review
counts, readiness blockers, and commit capability, and are reported separately
in the close summary.

Removal becomes visible only after server success. There is no Undo/Restore in
Unit 6G. The existing false-detection command remains available to the legacy
correction path and must never be invoked implicitly by the general Remove
action.

## 16. Versioned server and mobile contracts

Do not add fields to strict v1/v2 responses in place. Unit 6G introduces a new
contract version and forward RPC/action names conceptually equivalent to:

| ID | Edge action / RPC | Exact purpose |
| --- | --- | --- |
| U6G-C01 | `start_scan_session_v2` / `phase9_start_session_v2` | Start with language hint, nullable condition/price, required location, publication intent, optional batch label; server fixes quantity 1 and derives store/actor |
| U6G-Q01 | `read_scan_session_v3` / `phase9_owner_session_summary_v3` | Return new nullable/default fields and extended close summary without breaking v2 clients |
| U6G-Q02 | `read_scan_batch_review` / `phase9_owner_batch_review_v1` | Return one bounded session aggregate and at most 15 compact review-card DTOs |
| U6G-C02 | `remove_candidate_from_scan` / `phase9_owner_remove_candidate_v1` | Persist `owner_removed_from_scan` with exact version/replay behavior |
| U6G-C03 | `close_scan_session_v3` / `phase9_close_session_v3` | Perform the existing terminal-input Close mutation with the existing lock/version/idempotency rules and return the v3 readiness shape whose close summary includes bounded `ownerRemovedCandidates`; `close_scan_session`/`phase9_close_session_v2` remain unchanged |
| Reused | `read_scan_candidate` / candidate detail v2 | On-demand metadata sheet and conflict refresh |
| Reused | `update_candidate_review` / review update v2 | Strict canonical Save before every commit |
| Reused | `add_candidate_to_inventory` / M39 v1 | One create-only private commit per candidate |

`close_scan_session_v3` has the same request fields, initiating-Owner
authorization, terminal-input rule, candidate/session lock, expected-session
version, idempotency replay, and non-commit behavior as the existing v2 Close.
Its response is `OwnerSessionReadinessV3`: the existing readiness fields with a
strict `CloseSummaryV3` that adds only the bounded
`ownerRemovedCandidates: 0..15` count. The v2 `close_scan_session` response and
the existing `phase9_close_session_v2` function are not widened; a legacy v2
caller either continues to use the old summary for a legacy non-null session or
fails closed for a Unit 6G nullable session and must refetch/use v3. No
unbounded removed-candidate list is returned by Close.

The new aggregate is a read, not a mutation or snapshot promise. Its exact root
contains session ID/status/version/defaults/batch label/counts/presentation
revision and `items`. Each item contains only:

- session/candidate/input IDs and stable ordinal;
- candidate/metadata/review versions and states;
- bounded observed identity;
- bounded selected metadata summary and allowlisted cover reference;
- complete current saved strict review when present, including hidden notes for
  lossless round-trip but no rendered note fields;
- server-composed field-source labels, attention/blocker codes, readiness, and
  allowed actions; and
- updated timestamp.

The strict nested DTO bounds are frozen in the contract matrix: observed title
`1..512`, authors `0..20` entries of `1..256`, canonical BCP 47 language
`2..35`, nullable ISO 15924 script; selected metadata summary title `1..512`,
authors `1..20` entries of `1..256`, canonical language, and nullable approved
HTTPS cover reference `1..512`; attention codes are the existing 12-value
enum; blockers use the existing 17-value enum, one nullable bounded field name,
exactly one candidate/input UUID, and safe message `1..240`; card ordinals,
card arrays, and the aggregate item list are bounded by the 15-candidate
session cap, while session-level counters (`counts`, blocker counts, and every
close-summary total) are non-negative JSON-safe integers: SQL emits plain
`count(*)` totals without a numeric ceiling, legacy multi-image sessions
legitimately exceed 15 in lifetime totals, and any value above 2^53-1 fails
closed at the decoder instead of losing precision. The saved review,
when present, is exactly the existing strict review schema, including nullable
bounded hidden notes for lossless round-trip only.

It excludes geometry/confidence, raw scan/provider/model data, URLs/paths/tokens
other than the allowlisted cover reference, jobs/attempts/cost, duplicate
actions, other-store data, inventory private operations, and public listing
internals. Full bibliographic metadata remains bounded and on-demand through
the existing detail boundary. Batch-label text and private location are
Owner-session data only and never enter public DTOs, telemetry, or provider
inputs.

## 17. Persistence and migration assessment

Verdict: **MIGRATION_REQUIRED** for the complete target. No migration file is
created or applied by this documentation pass; applied migrations remain
byte-immutable.

| Delta | Classification | Required effect |
| --- | --- | --- |
| Durable default price and batch label | schema/additive, category 3 | Add nullable bounded session fields `default_price_minor` and `batch_label`; both must survive resume and remain session-only. No inventory column is added. |
| Optional pre-scan condition | schema/compatibility, category 3 | M02 currently has non-null `default_condition`; a forward change is required to represent null. Existing non-null rows remain readable. Legacy v2 summary/close responses stay unchanged and must fail closed rather than coerce null when used against a Unit 6G nullable session; v3 summary/close is the paired contract. |
| Candidate Owner removal | schema/state, category 4 | Extend the disposition CHECK with `owner_removed_from_scan`; update active/review/needs-review/readiness/commit predicates, candidate actions, session counters, presentation revisions, worker completion fences, and removal/commit state handling. |
| Close/summary contract | controlled API/schema, category 4 | Add `close_scan_session_v3` / `phase9_close_session_v3` and the versioned close-summary/readiness path with bounded `ownerRemovedCandidates`; keep v2 close and its strict response unchanged. The v3 wrapper corrects the inherited needs-review count so a removed candidate is reported exactly once. |
| Legacy page compatibility | controlled API, category 4 | Forward-replace `phase9_owner_candidates_page_v2` so the session scope excludes removed candidates; legacy clients stop seeing the card instead of failing strict decode on the new disposition value. Signature, grants, cursor semantics, and the `needs_review` scope are unchanged. |
| Audit/event and grants | controlled API/security, category 4 | Register `phase9.candidate.owner_removed_from_scan` as the bounded internal action/event; record candidate/session/version/actor-safe evidence without raw payload; expose only authenticated initiating-Owner RPC grants, with fixed search path and no direct table access; deliberately withhold `service_role` EXECUTE because no service-role consumer exists. |
| New session/start, batch-review, and remove RPCs | controlled API | Fixed search path, server-derived actor/store, initiator-only, strict DTOs/errors, exact version/replay fences with explicit NULL rejection for keys/command IDs/expected versions, and no direct table access. |
| Compact mobile flow and bulk coordinator | application | strict schemas, form/reducer, virtualized cards, metadata sheet, save-then-commit orchestration |
| Store View refresh | application/cache | invalidate/coalesce `storeViewKeys.all` after canonical commit success |

This is migration category 4 for the full feature because a new candidate
disposition changes lifecycle/readiness/list/audit semantics. It also contains
the smaller category 3 session-field delta for price and batch label. It is not
a database rewrite.

No migration is required for the fixed `INR` currency presentation, server-
fixed pre-scan quantity `1`, M39's existing private create-only commit and
`q/q/0/0/0` initialization, existing `store_inventory` columns, Unit 7C
tables or commands, or Store View cache invalidation. The last item is an
application query-cache effect, not a database schema effect. The card source
badges, strict aggregate DTOs, metadata sheet, and command-slot coordinator
are application/Edge contract work; only the versioned close/removal/session
boundaries and their controlled grants require database/RPC migration work.

Existing rows remain unchanged: condition/price/batch defaults preserve their
current values or null target values as applicable; no candidate is inferred as
removed; no inventory/listing row is rewritten. A fresh exact-project read-only
preflight and separate migration-file/application approvals are mandatory.

Legacy-v2 caller failure contract: against a Unit 6G nullable-condition
session, legacy `read_scan_session` decode fails closed by design and the
client must refetch through v3; the v2 Close fails with `P9_STATE_CONFLICT`
through the M52 fence. After a removal, legacy session-scope candidate pages
exclude the removed card (forward replacement), so no legacy surface ever
receives the new disposition value. Residual mixed-version exposure is limited
to old builds reading sessions created through the new Start; Groups 2–4 must
therefore ship promptly after M52 application to keep that window short.
Removed candidates on v1 readiness paths (`read_scan_readiness`/
`close_scan_session`) are still counted in `blockerCounts` until those callers
move to v3; every mutation they attempt fails closed at the removal fence, so
this is display-only debt recorded for the Group 2–4 cutover.

## 18. Unit 7A and Unit 7C compatibility

The saved review continues to materialize through M39 as follows:

| Review value | Existing private inventory effect | Post-commit owner |
| --- | --- | --- |
| Title/authors/language/metadata | store-owned inventory snapshot | Unit 7C Save |
| Condition | exact five-value enum | Unit 7C Save |
| Selling price | `selling_price_minor` | Unit 7C Save |
| Quantity `q` | `q/q/0/0/0` quantity buckets | Unit 7C Stock command only |
| Location | `shelf_location` | Unit 7C Save |
| Damage/sellability | current structured damage columns | Unit 7C Save/Media rules |
| Hidden preserved notes | current public/internal note columns | Unit 7C Save |
| Publication intent | retained provenance; inventory still draft/private | Unit 7B/7C later lifecycle |
| Metadata cover | inventory cover field when current rights permit | Unit 7C/public projection rules |
| Batch label | no inventory effect | session only |

When `metadataChoice.mode` is `selected`, M39 uses the current candidate-owned
selected snapshot and its permitted canonical/cover/provenance fields. When
`Use detected details` has selected the existing `manual` mode, M39 uses the
saved Owner-confirmed observed title/authors/language/script and the manual
metadata-version path, with nullable canonical IDs and no selected metadata
cover/provider payload. In both modes M39 remains one private create-only
commit; Unit 6G never adds a second commit path or post-commit editor.

Unit 6G never updates quantity buckets after commit, attaches scan media as
public media, or claims that `publish` intent published the item. Store View
remains the sole rich post-commit management surface and receives the stable
returned `inventoryId`.

## 19. State and count definitions

The page uses four primary display buckets:

| Bucket | Definition |
| --- | --- |
| Ready | Current local card is strict-schema complete and current server state is reviewable; Add will still perform canonical Save before commit |
| Processing | Candidate/metadata work is nonterminal and server-owned |
| Needs attention | Missing/invalid/stale/failed data or no current review capability |
| Added | Server-confirmed committed candidate in this session |

Owner-removed and false-detection candidates are absent from the active card
list and represented only in bounded summary counts. The v3 session/Close
summary adds the bounded `ownerRemovedCandidates` count; existing v2
`closeSummary` and `falseDetections` remain unchanged. Count derivation must be
one-snapshot server logic and reconcile with candidate/session rows. Client
counters are presentation only.

## 20. Authorization, security, and privacy

- Every read/mutation reuses the initiating-Owner-only session rule and derives
  store/actor from persisted relationships.
- Random, foreign-session, same-store-other-Owner, and cross-store candidate IDs
  remain non-enumerating.
- Direct authenticated reads/writes of extraction, inventory, listing, media,
  idempotency, audit, or event tables remain denied.
- Strict requests reject unknown fields and bound all text/numbers/enums.
- Scan URI/bytes/hash/path/capability, raw metadata/provider/model payload,
  bibliographic text, batch label, and private location are forbidden from
  telemetry/log/error context except opaque IDs and safe codes.
- Cover thumbnails use only the allowlisted metadata reference already approved
  for Owner display; scan media remains private and is never a cover fallback.
- Bulk operations do not send one unbounded request or caller-authoritative
  array of business values to a commit RPC.

## 21. Accessibility and performance

- Use `FlatList`, stable candidate IDs, memoized cards, stable callbacks, and
  bounded visible polling. Do not mount 15 expanded metadata forms.
- Metadata content is fetched only when the sheet opens; close releases its
  local expansion state.
- All values remain available to screen readers even when visually truncated.
- Edit controls have visible labels, 44×44 targets, logical focus order, exact
  selected/disabled/busy state, and non-color source/attention indicators.
- The top action announces the exact ready count and running/result counts.
- Removal confirmation receives focus and explains that no photo or existing
  inventory is deleted.
- Large text reflows cards vertically; no required field/action depends on a
  fixed two-column layout.
- Bounded commit concurrency and coalesced invalidation prevent request/refetch
  storms at 15 cards.

Representative low-end Android evidence remains required for Unit 6G's new
screen even though the older Unit 6F debt stays separately classified.

## 22. Observability

Allowlisted events may record:

- setup started/session started and which optional default categories were set
  as booleans only;
- ready/processing/attention count buckets;
- metadata sheet opened and detected/manual action category;
- per-card or bulk action, candidate-count bucket, save/commit result category,
  stale conflict, busy-skip category, retry class, and duration bucket;
- Owner removal versus false-detection category; and
- Store View cache synchronization outcome.

Never record title, author, ISBN, price, location, batch-label text, notes,
damage note, media reference, or raw error. Server audit/events remain the
business-outcome authority.

## 23. Acceptance matrix

| ID | Verifiable criterion |
| --- | --- |
| U6G-AC01 | Location is required before Start; language defaults to English as a non-authoritative hint. |
| U6G-AC02 | Condition and selling-price defaults may be unset; quantity is fixed to 1 before scan and editable per card. |
| U6G-AC03 | INR is fixed, the UI accepts whole rupees only, preset intervals are exact, and storage remains integer minor units. |
| U6G-AC04 | Optional batch label survives session resume, is session-only, and never affects inventory/readiness/public data. |
| U6G-AC05 | One bounded review aggregate returns at most 15 strict compact cards without N+1 full metadata reads; observed identity, metadata summary, blockers, attention codes, counts, actions, and privacy bounds are exact and schema-tied. |
| U6G-AC06 | Every card displays cover/placeholder, title/authors, metadata status, all final review values, canonical source indicators, View metadata, Remove, and Add. |
| U6G-AC07 | The one source mapping is `matched`/`detected` → Detected, `default` → Default, `custom` → Custom, and `missing` → Missing; inherited values are visible/subdued and custom/missing/stale values are explicit and non-color-coded. |
| U6G-AC08 | Metadata sheet shows the bounded list, supports Use detected details/Edit manually, has no Choose another match, and Use detected details performs the existing `manual`/null-selection transition with no selected canonical cover/provenance commit; incomplete observed identity falls back to manual editing. |
| U6G-AC09 | Notes are absent from Unit 6G UI and existing saved notes survive every unrelated Save unchanged. |
| U6G-AC10 | Per-card Add is the only submit action and performs strict Save, canonical version adoption, readiness/capability check, then M39 commit. |
| U6G-AC11 | Add all includes only its frozen ready set, performs the same independent save-then-commit state machine with concurrency at most three, and skips/report cards whose one command slot is already busy rather than queueing them. |
| U6G-AC12 | No model, worker, poll, default, navigation, or Close action commits inventory. |
| U6G-AC13 | Bulk partial success removes only confirmed successes; stale/failed/processing cards remain recoverable with exact results. |
| U6G-AC14 | Same-command replay and ambiguous retries cannot create a second inventory row; no session-wide transaction is claimed. |
| U6G-AC15 | General removal persists `owner_removed_from_scan`, remains distinct from false detection/input removal/inventory deletion, has no Undo, and cannot race into a successful inventory commit. |
| U6G-AC16 | Removed candidates cannot re-enter active/readiness/commit sets after worker completion and are counted separately. |
| U6G-AC17 | M39 still creates one private row per candidate with exact `q/q/0/0/0`; publish intent does not auto-publish. |
| U6G-AC18 | Successful commits invalidate/coalesce candidate/session/readiness/discovery and Store View list caches, and v3 session/Close responses return bounded `ownerRemovedCandidates` while v2 Close remains strict and unchanged. |
| U6G-AC19 | Offline is read-only, drafts are memory-only, and reconnect refetches authority before any mutation. |
| U6G-AC20 | Cross-store, same-store-noninitiator, random-ID, stale-version, changed-replay, and forbidden-field tests fail closed without effects. |
| U6G-AC21 | Scan/private/provider/job/attempt/cost data cannot leak through cards, metadata, logs, telemetry, or public media. |
| U6G-AC22 | Fifteen cards remain responsive with virtualized compact rendering, on-demand metadata, bounded polling, and bounded commits. |
| U6G-AC23 | Screen reader, focus, 44×44 target, large-text, non-color status, busy/result announcement, and removal-dialog gates pass. |
| U6G-AC24 | Unit 7C remains the sole post-commit editor; Unit 6G adds no Store View table/lifecycle/media/stock command. |

## 24. Required red-test groups

1. **Session defaults:** strict v2 start request, required location, optional
   condition/price/label, exact replay, old-session compatibility, and no
   currency/quantity caller authority.
2. **Price conversion:** every preset boundary, custom/zero/null, integer-safe
   rupee-to-minor conversion, and no float/paisa input.
3. **Batch aggregate:** 0/1/15 cards, repeated books, every state/source/null
   branch, strict keys, order, private-field scan, and no cross-owner data.
4. **Draft derivation:** saved > metadata/detected > default > missing,
   detected-language divergence, hidden-note preservation, and stale revisions.
5. **Per-card state machine:** Save fail/non-ready/stale/ambiguous/commit fail/
   success, no optimistic effect, and canonical versions only.
6. **Bulk coordinator:** frozen membership, concurrency cap, one-slot busy
   arbitration, completion order, partial success, interruption/resume, no
   duplicate/refetch storm, and exact retry identity.
7. **Removal lifecycle:** every uncommitted state, processing-worker race,
   replay/mismatch/concurrency, one-slot arbitration, counts/readiness/v3 Close/
   audit, no cascade, no restore, and commit denial.
8. **Strict DTO/privacy:** exact nested field bounds, enum/nullable rules,
   source-label mapping, aggregate cardinality, hidden-note round-trip, and
   rejection of raw provider/model/media/private fields.
9. **7A/7C handoff:** exact materialization, Store View invalidation, private
   outcome, quantity command separation, batch-label non-propagation, and no
   Unit 7C schema effect.
10. **Mobile quality:** accessibility, large text, narrow width, 15-card low-end
   Android, offline/reconnect, request bounding, and telemetry/privacy allowlist.

## 25. Bounded implementation order

Every slice requires separate authorization and independent review:

1. **6G-A — contract and red-test foundation:** freeze exact DTOs/errors/state
   predicates, add red database/Edge/mobile tests, and perform a fresh read-only
   exact-project preflight. No migration file or source behavior.
2. **6G-B — forward database/Edge boundary:** one reviewed forward migration
   for session fields, nullable condition compatibility, candidate disposition,
   predicates/counts/audit, and new versioned RPCs; strict Edge adapters. Live
   application remains separate.
3. **6G-C — setup and compact review UI:** new small feature modules for setup
   controls, batch aggregate query, cards, field controls, and metadata sheet.
4. **6G-D — commit orchestration:** per-card and bulk reducers/coordinator,
   save-then-commit integration, result recovery, and shared Store View cache
   invalidation.
5. **6G-E — adversarial/connected closure:** migration/security readback,
   authenticated Owner proof, 15-card/native accessibility/performance, partial
   success, continuity, and rollout evidence.

Database preflight, migration creation, migration application, Edge/mobile
deployment, and connected business-row proof remain distinct authorities.

## 26. Maintainability boundaries

Do not add Unit 6G behavior to the already large `CaptureScreens.tsx`,
`CandidateReviewScreens.tsx`, or `ownerIngestion.ts` bodies. Extract cohesive
modules for scan-default form state, batch-review contracts/service/query,
compact cards/metadata sheet, and the commit coordinator. Reuse the existing
strict review schema and M39 mutation; do not copy their validation or invent a
second commit path.

One reducer/state machine owns each card command, and one coordinator owns only
membership/concurrency/result aggregation. Server state remains authoritative;
TanStack Query owns canonical cached results; component state owns only mounted
drafts and presentation.

The command-slot registry is shared by per-card and bulk reducers, so no
screen-level button can bypass the one-candidate arbitration. Contract decoder
modules should reuse the existing condition, language, safe-text, cover,
attention, blocker, readiness, review, and idempotency schemas rather than
reimplementing them.

This structure raises maintainability relative to the current form-per-route
flow because field rules, card presentation, command sequencing, and cache
synchronization have one explicit owner each.

## 27. Final ambiguity challenge and approval gate

The SDD fixes the formerly ambiguous points as follows:

- condition is optional pre-scan and required before a card can be submitted;
- price is optional pre-scan, means selling price, and is whole-rupee INR UI
  over minor-unit storage;
- quantity is fixed at 1 pre-scan and editable post-scan;
- Add/Add all are explicit review actions and always Save before commit;
- Ready in the UI does not bypass server `reviewReady`;
- publication intent never auto-publishes;
- `Use detected details` means existing `manual` metadata choice with a null
  selection, so canonical/selected cover and provider provenance are not
  committed; unusable observed identity stays manual-required;
- `matched` is an internal source code whose only visible badge is `Detected`;
- one candidate has one active command slot; Add all skips and reports busy
  cards, and server disposition/version fences prevent removal/commit races;
- v3 Close returns the bounded owner-removed count while v2 Close stays
  unchanged; and
- general removal is a new durable disposition, not false detection; and
- batch label is session-only.

No remaining product ambiguity is known that would materially change the
proposed schema, command boundaries, card fields, commit safety, Unit 7A/7C
handoff, or implementation split.

**Next gate:** Owner review and explicit approval/correction of this SDD and its
contract matrix. No implementation or migration work may begin from draft
creation alone.
