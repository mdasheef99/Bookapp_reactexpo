# Phase 9 Unit 6G SDD: Owner Scan Defaults, Batch Review, and Commit Handoff

**Status:** `unit6g_session_lifecycle_fence_live_verified_m54_applied`
**Version/date:** 0.3 / 2026-08-29
**Authority:** the Owner workflow decisions recorded in P9-D81 through P9-D85;
DOC-3 §§5–9/15–16; DOC-4 §§2–5/9–15; DOC-8 §§2–5/14–15; Phase 9
Master §§2–9/14; Owner Review SDD §§2–6/8–16; Unit 6 §§8–35; Unit 7A
§§2–20; and Unit 7C §§1–16.
**Specializes:** Unit 6 session setup/review and the Owner-facing Unit 7A
handoff. It does not reopen Unit 6F native evidence, rewrite M39, or redesign
Unit 7C.
**Implementation authority:** Unit 6G-A and Unit 6G-B, including the exact M52
foundation and its recorded live application/readback, are retained. Historical
6G-C commit `e7ed166` and the frozen dirty 6G-D work are superseded as
implementation authority. The recomposed 6G-C/6G-D design below remains the
behavioral authority; its composition-only 6G-C UI checkpoint was implemented
locally on 2026-08-29 in the recomposition worktree and remains uncommitted and
undeployed. The Owner-authorized M54 lifecycle correction is live exactly once
as `20260829142337`: current final Save/Add/Remove mutations require an active,
unexpired session and non-mutable detail/batch projections are read-only.
Edge/client deployment, further database/Storage mutation, and Git publication
remain separately unauthorized.

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

**Architectural rule:** Unit 6 is the proven lifecycle backbone. Unit 6G
composes pre-scan defaults, consolidated review, general candidate removal, and
explicit private-inventory commit behavior onto Unit 6. Unit 6G must not
rebuild, replace, duplicate, or silently bypass Unit 6 lifecycle ownership.
The batch-review aggregate is candidate/review authority; it is not
input-processing authority.

## 2. Scope

Included:

- a complete pre-scan defaults form with required location and optional
  condition, selling-price default, and batch label;
- fixed INR presentation with whole-rupee input while preserving minor-unit
  storage;
- presentation of the existing Unit 6 session/input lifecycle together with
  one bounded candidate/review aggregate of 0..15 cards for a supported NEW
  Unit 6G single-image scan, with unsupported historical `>15` compatibility
  governed by §8.1;
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

Also excluded are replacement of the Unit 6 lifecycle controller, duplicate
implementations of Unit 6 processing/recovery logic, and any candidate-only
screen becoming the sole controller for a scan session.

## 2.1 Unit 6 predecessor inheritance and lifecycle ownership

Unit 6 is Unit 6G's lifecycle predecessor. Route or screen replacement does not
transfer lifecycle ownership. The currently mounted production route delegates
to `InventorySessionProgressScreen`; a Unit 6G review component may render
within or alongside that controller, or the controller may delegate its owned
responsibilities intact, but the batch aggregate may never become the sole
session controller. Changing the primary presentation requires
lifecycle-equivalence proof for every responsibility previously owned by that
route.

An inherited requirement cannot disappear because its original component is no
longer primary. Every inherited behavior requires an implementation owner/seam,
a regression-test owner, and closure evidence. The only allowed dispositions
are those used below.

The completed predecessor audit disposition is exact: 30
`INHERITED_UNCHANGED`, 7 `SUPERSEDED_BY_6G`, 3
`DEFERRED_WITH_EXPLICIT_OWNER`, 0 `INTENTIONALLY_REMOVED`, and 0
`NOT_APPLICABLE`, for all 40 Unit 6 acceptance criteria. Supersession changes
the interaction or command boundary; it never discards predecessor safety.

| Exact AC | Disposition | Surviving or superseding behavior | Implementation owner/seam | Regression-test owner | Closure evidence owner |
| --- | --- | --- | --- | --- | --- |
| U6-AC01 | `INHERITED_UNCHANGED` | `/inventory` remains the Store Owner tab root. | NEW 6G-C; existing inventory route shell | NEW 6G-C mounted-route and `inventoryDynamicRoutes` | NEW 6G-C functional route proof; 6G-E connected closure |
| U6-AC02 | `INHERITED_UNCHANGED` | Every nested route re-enters the Owner gate and denies unauthorized deep links. | NEW 6G-C; `InventoryAccessBoundary` | NEW 6G-C mounted-route and access-boundary suites | NEW 6G-C auth/deep-link proof; 6G-E connected closure |
| U6-AC03 | `INHERITED_UNCHANGED` | Active-session and review entry use server recovery evidence. | NEW 6G-C; discovery/session queries | NEW 6G-C Resume/discovery tests plus `ownerUxQueries` | NEW 6G-C mounted Resume proof |
| U6-AC04 | `INHERITED_UNCHANGED` | Only an active Owner enters; other roles/stores are denied. | Retained Unit 6/M52 Owner boundary; NEW 6G-C composition | Existing Edge/RPC auth plus NEW 6G-C route tests | 6G-B retained connected proof; 6G-E route closure |
| U6-AC05 | `INHERITED_UNCHANGED` | Only the initiating Owner reads, mutates, resumes, or closes the session. | Retained Unit 6/M52 initiator boundary | Existing cross-owner RPC tests plus NEW 6G-C mounted tests | 6G-B retained connected proof; 6G-E closure |
| U6-AC06 | `SUPERSEDED_BY_6G` | Start v2 replaces legacy Start fields; one semantic identity and exact replay safety remain mandatory. | NEW 6G-C Start-v2 adapter over Unit 6 capture lifecycle | NEW 6G-C ambiguous-Start/same-identity replay tests | NEW 6G-C mounted reconciliation proof; 6G-E closure |
| U6-AC07 | `INHERITED_UNCHANGED` | Leaving/backgrounding creates no pause; server processing continues. | Unit 6 lifecycle controller retained by NEW 6G-C | Mounted background/Resume plus existing capture tests | NEW 6G-C mounted proof; 6G-E connected closure |
| U6-AC08 | `INHERITED_UNCHANGED` | Nonterminal input denies Close with bounded guidance. | NEW 6G-C v3 summary/Close UI; retained M52 C03 | NEW 6G-C nonterminal v3 Close regression | NEW 6G-C mounted denial proof; 6G-E closure |
| U6-AC09 | `INHERITED_UNCHANGED` | Close never commits or discards an uncommitted candidate. | Retained M52 Close v3; NEW 6G-C client cutover | Existing Close noninterference plus mounted v3 tests | 6G-B retained DB proof; 6G-E closure |
| U6-AC10 | `INHERITED_UNCHANGED` | Camera and gallery remain equal sources with permission/cancel handling. | Unit 6 capture UI retained/delegated by NEW 6G-C | `CaptureScreens` plus mounted-route source tests | NEW 6G-C mounted upload proof; 6G-E native closure |
| U6-AC11 | `INHERITED_UNCHANGED` | Preview/count guidance and the server-authoritative over-15 rejection remain unchanged: `P9_VISION_OVER_LIMIT`, zero candidates, bounded guidance, and reachable replacement/recovery. | Existing Unit 6 lifecycle; NEW 6G-C composes presentation without changing candidate-limit semantics | Capture/over-limit regressions plus the mounted inherited-over-limit case | NEW 6G-C mounted failure/replacement proof; 6G-E closure |
| U6-AC12 | `INHERITED_UNCHANGED` | Upload shows byte progress without persisting/logging URI, bytes, URL, or token. | Unit 6 upload transport/context | `captureService`/`uploadTransport` privacy tests | NEW 6G-C mounted upload proof; 6G-E privacy closure |
| U6-AC13 | `INHERITED_UNCHANGED` | Capability refresh and registration replay never duplicate input/job. | Unit 6 capture service/registration seam | Existing capability/replay tests plus mounted success branch | NEW 6G-C registration proof; 6G-E closure |
| U6-AC14 | `INHERITED_UNCHANGED` | Foreground/reconnect/reload recovers session, input stages, and candidates. | Unit 6 queries/controller retained by NEW 6G-C | `CaptureProgressScreens`, `ownerUxQueries`, mounted success branch | NEW 6G-C recovery proof; 6G-E closure |
| U6-AC15 | `INHERITED_UNCHANGED` | Logout/account/store change clears private client state without deleting server state. | NEW 6G-C adds every new 6G query root to Unit 6 cleanup | `ownerUxQueries` and mounted identity-transition tests | NEW 6G-C cache-absence proof |
| U6-AC16 | `INHERITED_UNCHANGED` | Missing/expired/unauthorized recovery returns safely without enumeration. | Unit 6 session controller/access boundary | Existing unavailable-session plus mounted-route tests | NEW 6G-C safe-return proof; 6G-E closure |
| U6-AC17 | `SUPERSEDED_BY_6G` | Combined compact presentation replaces the old candidate presentation; zero/one/fifteen/partial/repeated behavior remains. | NEW 6G-C combined lifecycle/review surface | NEW 6G-C aggregate and mounted arrival tests | NEW 6G-C mounted/cardinality proof; 6G-E performance closure |
| U6-AC18 | `SUPERSEDED_BY_6G` | Compact cards replace the old card layout; ordinal stability, virtualization, and bounded rendering remain. | NEW 6G-C compact list | NEW 6G-C ordinal/virtualization tests | NEW 6G-C automated proof; 6G-E device closure |
| U6-AC19 | `INHERITED_UNCHANGED` | Full detail remains bounded/private and reachable for deep correction. | Existing Unit 6 candidate-detail route; NEW 6G-C navigation | `CandidateReviewScreens` plus reachability tests | NEW 6G-C deep-correction proof |
| U6-AC20 | `INHERITED_UNCHANGED` | Metadata outage/no-match retains manual preparation. | Existing Unit 6 correction/detail controller | Manual-fallback and mounted reachability tests | NEW 6G-C fallback proof |
| U6-AC21 | `SUPERSEDED_BY_6G` | Explicit Add confirmation replaces separate confirmation flow while exact title/author scope remains mandatory. | NEW 6G-C compact draft; NEW 6G-D Add command | NEW 6G-C exact-field tests; NEW 6G-D Add tests | NEW 6G-D canonical Save/Add proof |
| U6-AC22 | `INHERITED_UNCHANGED` | Strict review validation and accessible condition help remain. | Retained strict review schema plus compact/full editors | Existing `reviewForm`/detail plus NEW 6G-C compact tests | NEW 6G-C validation proof |
| U6-AC23 | `SUPERSEDED_BY_6G` | Save becomes part of Add; canonical returned versions, guarded draft, stale compare, and explicit Reapply remain mandatory. | NEW 6G-C draft/conflict navigation; NEW 6G-D Save→Add | `CandidateReviewScreens`, stale/Reapply, and NEW 6G-D tests | NEW 6G-C conflict proof; NEW 6G-D command proof |
| U6-AC24 | `INHERITED_UNCHANGED` | False detection records only its distinct disposition and no inventory effect. | Existing Unit 6 correction action; distinct from general Remove | `OwnerCorrectionScreens` plus mounted reachability | NEW 6G-C distinction proof |
| U6-AC25 | `INHERITED_UNCHANGED` | Missed book creates one staged manual candidate without rerunning vision/provider. | Existing Unit 6 missed-book route | Existing missed-book plus mounted reachability | NEW 6G-C reachability proof |
| U6-AC26 | `INHERITED_UNCHANGED` | Variant review exposes only server allowed actions. | Existing `VariantDecisionSheet` | Existing variant plus mounted reachability tests | NEW 6G-C reachability proof |
| U6-AC27 | `INHERITED_UNCHANGED` | Stale proposal preserves the decision/replacement and requires explicit Reapply. | Existing Unit 6 proposal conflict controller | Existing variant-stale plus mounted Reapply tests | NEW 6G-C stale-proposal proof |
| U6-AC28 | `INHERITED_UNCHANGED` | Server owns transient retry; terminal pre-lineage failure permits deliberate replacement. | Unit 6 input controller/workers | Existing retry tests plus mounted failure/recovery branch | NEW 6G-C mounted recovery proof |
| U6-AC29 | `SUPERSEDED_BY_6G` | New Save/Add identities replace standalone Save identity; replay is still restricted to the same semantic command. | NEW 6G-D per-candidate command slot/coordinator | NEW 6G-D same/changed/ambiguous replay tests | NEW 6G-D idempotency proof |
| U6-AC30 | `INHERITED_UNCHANGED` | Offline remains read-only with mounted-memory draft and refetch-before-mutation. | NEW 6G-C combined surface | Existing offline plus NEW 6G-C tests | NEW 6G-C offline/reconnect proof |
| U6-AC31 | `INHERITED_UNCHANGED` | Private media/capabilities/raw payload/PII stay out of persistence, logs, analytics, and routes. | Unit 6 privacy seams plus NEW 6G-C/6G-D DTOs | Existing privacy scans plus new strict DTO/telemetry tests | NEW 6G-C/6G-D privacy proof; 6G-E closure |
| U6-AC32 | `INHERITED_UNCHANGED` | Scan media never becomes public preview, cover, duplicate signal, or request media. | Existing media boundary; Unit 6G cover remains metadata-only | Strict DTO/media noninterference tests | NEW 6G-C proof; 6G-E closure |
| U6-AC33 | `INHERITED_UNCHANGED` | Screen-reader, target, focus, text alternative, and non-color behavior remain. | NEW 6G-C composed surface | NEW 6G-C component/mounted accessibility tests | NEW 6G-C automated proof; 6G-E native closure |
| U6-AC34 | `INHERITED_UNCHANGED` | Narrow-width and large-text reflow remains required. | NEW 6G-C compact/composed surface | NEW 6G-C layout/accessibility tests | NEW 6G-C automated proof; 6G-E native closure |
| U6-AC35 | `INHERITED_UNCHANGED` | Exact condition vocabulary/help works on tap, focus, and screen reader. | Reused condition schema/help in NEW 6G-C | Existing condition-help plus compact-card tests | NEW 6G-C accessibility proof |
| U6-AC36 | `DEFERRED_WITH_EXPLICIT_OWNER` | Representative low-end Android 15-card responsiveness remains required and is not inferred from unit tests. | 6G-E; older Unit 6F debt remains separately owned | 6G-E device/performance gate | 6G-E exact measured result or `NOT_RUN`/`UNRESOLVED` |
| U6-AC37 | `DEFERRED_WITH_EXPLICIT_OWNER` | Three-capture resource retention/fetch-storm evidence remains required. | 6G-E; older Unit 6F debt remains separately owned | 6G-E native resource/reconnect gate | 6G-E exact measured result or `NOT_RUN`/`UNRESOLVED` |
| U6-AC38 | `INHERITED_UNCHANGED` | Telemetry stays allowlisted and excludes bibliographic/media/capability data. | Unit 6 telemetry plus NEW 6G-C/6G-D categories | Existing telemetry plus new allowlist tests | NEW 6G-C/6G-D proof; 6G-E closure |
| U6-AC39 | `DEFERRED_WITH_EXPLICIT_OWNER` | Whole-route native accessibility/performance/privacy evidence remains required. | 6G-E; older Unit 6F debt remains separately owned | 6G-E connected/native verification matrix | 6G-E exact result or `NOT_RUN`/`UNRESOLVED` |
| U6-AC40 | `SUPERSEDED_BY_6G` | No automatic/public commit remains; only explicit Owner-authorized private M39 Add/Add-all supersedes the no-commit boundary. | NEW 6G-D only; NEW 6G-C contains no commit orchestration | NEW 6G-D commit/noninterference tests | NEW 6G-D private-effect proof; 6G-E closure |

The historical old 6G-C line replaced the lifecycle presentation with a
candidate-oriented controller and therefore does not satisfy this table. Its
commit `e7ed166` and the frozen dirty 6G-D files remain historical evidence
only; they are not implementation inputs for NEW 6G-C/6G-D.

## 3. Verified implementation baseline

### 3.1 Historical pre-M52 baseline that justified 6G-A/B

Before M52 was created and applied, the inspected repository/live baseline
showed that:

- the legacy Start path persisted language, script, condition, location,
  quantity, and publication, while the then-current Owner Edge path accepted
  only language/script/condition and hardcoded location=`default`, quantity=`1`,
  and publication=`private`;
- `image_extraction_sessions` had no durable default selling price or batch
  label, and `default_condition` was non-null;
- `OwnerCandidateSummary` lacked the compact review values, cover, field
  source, and allowed actions;
- `OwnerCandidateDetail` and `phase9_update_candidate_review_v2` already
  provided strict review fields and the canonical versioned Save response;
- M39 already provided the locked, server-authoritative, idempotent,
  create-only private commit;
- candidate dispositions did not yet include
  `owner_removed_from_scan`; and
- commit-success synchronization did not invalidate `storeViewKeys.all`, while
  private Store View cover presentation could not rely on public listing state.

These are historical design inputs, not current post-M52 schema facts.

### 3.2 Current post-M52 foundation before NEW 6G-C

M39 through M52 are applied and immutable at their recorded live versions.
Retained M52 is live exactly once as
`20260822025712 marketplace_phase9_unit6g_contract_persistence_foundation` and
provides the completed 6G-A/B foundation:

- durable nullable `default_price_minor` and `batch_label` session fields;
- nullable `default_condition`, with the legacy-v2 fail-closed compatibility
  fence and consistent v3 Unit 6G routing required for new clients;
- the durable `owner_removed_from_scan` disposition and its active/readiness/
  commit/worker/count/audit/event fences;
- Start v2, session/readiness/Close v3, bounded batch-review, and candidate-
  removal RPC/Edge contract seams with retained authenticated-Owner grants;
- `CloseSummaryV3` safe-integer lifetime counters, including
  `ownerRemovedCandidates`; and
- the forward-replaced paged Unit 6 session candidate read, which excludes
  Owner-removed candidates while retaining its signature, authorization,
  cursor, and page-size semantics.

The NEW 6G-C route/controller composition and client integration checkpoint is
implemented locally over this live foundation. The composition defect does not
justify another migration. Any independently proven new schema defect must be
reported for separate authority and must not be repaired in this documentation
pass. The local checkpoint is not a connected deployment or business-data
proof.

## 4. End-to-end flow

```text
Inventory -> Start scan
  -> 6G pre-scan defaults
  -> semantic Start v2
  -> camera/gallery
  -> preview
  -> Unit 6 private upload + registration
  -> ONE current input
  -> Unit 6 sanitation / vision / metadata
  -> combined mounted session surface observes:
       A. Unit 6 session/input lifecycle authority
       B. Unit 6G candidate/review aggregate authority
  -> candidates appear automatically as processing completes
  -> compact review/edit exceptions
  -> deeper Unit 6 correction path where necessary
  -> Remove OR Add one OR Add all ready
       -> strict Save for candidate
       -> canonical returned versions
       -> server readiness / allowed-action check
       -> existing M39 Unit 7A create-only private commit
       -> remove successful card from active review
  -> continue reviewing
  -> v3 summary/readiness/Close when input-terminal
  -> optional View in Store View by returned inventoryId
```

Close remains independent. It never commits, adds, removes, discards, or
publishes a remaining candidate.

## 5. Pre-scan values

The setup screen owns the following exact effective values:

| Value | Owner control | Initial/effective behavior | Persistence and downstream use |
| --- | --- | --- | --- |
| Location | Required select-or-enter field | No hidden fallback; Start is disabled until non-empty | Durable session default; copied to `shelfLocation` unless a card overrides it |
| Language | Optional-feeling searchable dropdown | English (`en`) is preselected, so Owner interaction may be unnecessary; `StartScanSessionV2Request.languageHint` is nevertheless a required non-null request field and remains a hint/fallback, never forced candidate identity | Durable session hint; valid detected candidate language wins and is labelled Detected |
| Condition | Optional five-value dropdown | `Not set`, New, Like New, Very Good, Good, Acceptable | Nullable durable session default; `Not set` makes each card require a condition |
| Selling price | Optional whole-rupee picker | `Not set` initially unless the Owner chooses a value | Nullable durable `default_price_minor`; inherited by cards and still revalidated on Save |
| Quantity | No pre-scan editor | Fixed at `1` | Existing durable session default remains `1`; each card has a post-scan stepper |
| Publication intent | Two-state segmented control | Save private initially; Owner may choose Prepare to publish later | Durable `private|publish` intent only; Unit 7A still creates private inventory |
| Batch label | Optional text | Empty | Durable session-only Owner label; not copied to inventory and never affects readiness |
| Currency | No selector | Fixed INR, displayed as `₹` | No currency column is added; canonical money remains integer minor units |
| Script | No control | Server-owned, derived, and nullable from detected/reviewed language and text when available; it is never an Owner-entered setup value | Existing nullable session/candidate/review lineage is preserved |

“Price” in Unit 6G always means the selling price (`priceMinor` /
`selling_price_minor`), not acquisition cost.

The batch label is trimmed Unicode NFC plain text, null when empty, and bounded
to 80 code points. It is visible in session recovery/review/summary only and is
forbidden from public DTOs, inventory rows, listings, analytics text, and
provider/model inputs.

One logical Start attempt has one stable semantic identity. A lost or ambiguous
Start v2 response is reconciled/replayed with the same idempotency key and
command ID; pressing Start again after ambiguity must not automatically create
a new identity. Picker, camera, and network continuations are fenced by the
current Owner/store and operation generation. Only a deliberate new Start after
the prior attempt has been reconciled may obtain a new identity.

The current session is single-image. Setup/capture may create an active session
before image selection, but the mounted lifecycle presents at most ONE current
image/input. It never accumulates Image 1/Image 2/Image 3, exposes an
append-more-images action, or continues the same session with another image.
Unit 6 alone owns deliberate removal and replacement before candidate lineage
where permitted. Replacement is recovery of the one current-image slot, not
multi-image accumulation.

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
| `matched` | `Provider matched` | The current selected metadata/identity match contains a usable value for this field; the provider match is explicitly distinguished from vision output. |
| `detected` | `Vision detected` | The current bounded observed identity is the source. |
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

Selected metadata state and compact-field usability are separate. A current
selected snapshot may contain an unusable value for one member while its other
members remain usable. The compact projection emits null only for that member;
the canonical selected snapshot is unchanged, and this precedence table governs
the detected/default/missing fallback for the affected field.

The allowed source codes are explicit:

| Displayed field | Allowed source codes | Missing/default rule |
| --- | --- | --- |
| Cover | `matched`, `missing` | Selected/observed allowlisted metadata cover only; no scan-media fallback. The server emits `matched` when the selected snapshot carries an approved cover and `missing` otherwise. |
| Title, authors | `matched`, `detected`, `custom`, `missing` | No setup default; empty authors are `Missing` while the existing review schema still permits an empty confirmed author array. |
| Language/script | `matched`, `detected`, `default`, `custom`, `missing` | The English hint is `Default` only until valid detected or explicit Owner language wins. |
| Condition, price, location, publication | `default`, `custom`, `missing` | An unset required final value is `Missing`. |
| Quantity, damage | `default`, `custom` | Quantity is server-fixed to `1` before scan, so it is never missing; damage is answered by the existing review schema and defaults to no-damage. |

Location has exactly three possible sources: `default`, `custom`, or `missing`.
It can never be detected or matched. Every field retains the exact source
vocabulary frozen by the retained server contracts.

While an unsaved edit is mounted, the client replaces the displayed persisted
badge for that field with a local `Custom` marker. It must not continue showing
the stale persisted source after the Owner has overridden the value. This
overlay is presentation-only: it cannot manufacture a persisted server source,
readiness, allowed action, or commit eligibility.

The response enums may admit additional values (for example `missing` for
damage or `detected` for cover) as client-side supersets; the server never
emits them. The emission table above is normative for display logic.

Metadata state labels such as `Matched`, `Manual`, and `Pending` remain state
labels in the metadata-status field. They are not source badges and must not
contradict the canonical mapping above.

## 8. Unified post-scan page

The existing session progress route remains the lifecycle controller and
becomes the primary combined progress and compact-review surface. Its Unit 6
controller must remain mounted or be explicitly delegated intact; Unit 6G may
render within or alongside it. A candidate-only aggregate screen must never be
the sole session controller. The cross-session Needs Review page remains only
an entry point and routes the Owner to the owning session page.

The combined surface observes two authorities concurrently:

1. Unit 6 session/input state is authoritative for active-session recovery,
   upload, registration, the ONE current input, sanitation, vision,
   pre-candidate processing, failure, retry, removal/replacement, foreground,
   reconnect, relaunch, and Resume.
2. The Unit 6G batch aggregate is supplemental candidate/review authority for
   compact cards, review state, candidate removal, and candidate-side counts.

Zero candidates never implies idle, complete, failed, or unrecoverable. The
batch aggregate may summarize candidate-side processing, but it cannot replace
Unit 6 input observation. Starting before image selection may legitimately
leave an active zero-input session after picker cancellation/interruption; the
mounted route must recover through Resume and allow camera/gallery selection,
not render zero cards as a dead end.

The page contains:

- session/batch label and capture progress;
- count summary: Ready, Processing, Needs attention, and Added;
- top action **Add all ready books (N)** when `N > 0`;
- a virtualized, stable-ordinal list of 0..15 cards for the supported NEW Unit
  6G current-image scan; and
- existing Add missed book, session summary, and Close navigation where
  currently allowed.

Compact review is primary for high-frequency edits, not exclusive. Every card
retains a reachable secondary full-correction route for false detection,
linguistic variants, proposal/source changed-authority comparison and explicit
Reapply, and any edit that compact controls cannot safely represent. The
existing missed-book route remains reachable from the combined session. This
does not restore `Choose another match`; metadata rematching remains excluded.

Successful commits leave the active card list after authoritative success.
They remain represented by the Added count and server close summary. Failed or
stale cards remain in place with their edits, bounded error, and retry action.

### 8.1 Single-image cap and unsupported historical overflow

The supported NEW Unit 6G product is exact: ONE current image is processed into
0..15 candidate books and therefore 0..15 compact review cards. Fifteen is a
current-scan product cap, not a universal database invariant and not a cap on
historical session-lifetime, aggregate, readiness, or `CloseSummaryV3`
counters. No normal Unit 6G scan exposes a sixteenth card, an append-image
control, or client pagination.

NEW 6G-C does not change Unit 6 candidate-limit semantics. For 1..15 detected
books, existing Unit 6 processing proceeds normally. If Unit 6 detects more
than 15 books in the one current image, Unit 6G inherits the existing behavior
unchanged: the input terminates with `P9_VISION_OVER_LIMIT`, creates zero
candidates, displays bounded failure guidance, and keeps Unit 6 deliberate
replacement/recovery reachable. A replacement image containing 1..15 books can
then continue normally in the same one-current-image slot.

Unit 6G does not retain a first/best/top 15, does not need a retained-candidate
selection rule, and does not reinterpret `candidateCapSkips`. The existing v3
field remains unchanged under its existing authority. Any future UX such as
“process 15 and skip the remainder” is explicitly deferred to a separate later
work unit and product/design decision; it is not NEW 6G-C scope.

Historical multi-input sessions with more than 15 active candidates are
unsupported compatibility data, not the supported NEW Unit 6G workflow. NEW
6G-C must not recreate multi-image capture or add pagination solely for those
sessions. Such a session must never be silently truncated into a seemingly
complete normal Unit 6G session: it must fail closed, unless an already-proven
complete safe legacy recovery route is used. No such complete mounted recovery
route is currently proven. Hidden candidates cannot be treated as reviewed or
handled, and server-authoritative v3 readiness/Close must not imply that omitted
historical candidates disappeared.

## 9. Compact card contract

Every card shows all final business values in compact form. Inherited values
are visually subdued; missing, invalid, stale, or custom values receive the
attention treatment. Values are never hidden merely because they match a
default.

| Card element | Display/edit behavior |
| --- | --- |
| Cover | Allowlisted metadata cover thumbnail with the `Provider matched` or `Vision detected` source badge when its internal source is `matched` or `detected`, or a `Missing` placeholder; never scan media |
| Title and authors | Full accessible value, visually bounded summary; tap opens simple inline/manual edit |
| Metadata status | Matched, Manual, No match, Pending, or Needs attention; opens metadata sheet |
| Language | Searchable dropdown; source chip shows Provider matched, Vision detected, Default, or Custom |
| Condition | Exact five-value dropdown with accessible explanations |
| Selling price | Whole-rupee preset/custom picker from §6 |
| Quantity | Stepper, initial default 1, existing server bound enforced |
| Location | `Use batch location` or `Custom`; custom uses bounded text input |
| Publication intent | `Private` or `Prepare to publish`; explanatory text says commit remains private |
| Damage | No damage / Has damage segmented control; Yes expands exact existing type/note/sellability/complete-readable-safe fields |
| Source markers | Default, Provider matched, Vision detected, Custom, or Missing per §7; provider and vision sources remain distinct |
| Metadata action | `View metadata` |
| Full correction action | `Open full correction`; routes to the existing Unit 6 candidate-detail controller for false detection, variants, stale compare/Reapply, and edits unsafe for compact controls |
| Removal action | `Remove from this scan`, visually secondary/destructive and confirmation-gated |
| Primary action | `Add to inventory`; there is no separate Submit or Save button |

Public and internal notes are not rendered or editable in Unit 6G. When an
existing saved review contains notes, every Unit 6G Save must round-trip those
unchanged. A new review submits the existing canonical null-note object. Hiding
the fields must never erase existing data.

### 9.1 Local UI field-placement checkpoint (2026-08-29)

The local composition checkpoint preserves the SDD's two-surface model and
places edits as follows:

- **Pre-scan setup:** optional batch label, required select-or-enter location,
  searchable language hint, optional condition, optional whole-rupee selling
  price (quick presets/full presets/custom), and publication intent. Quantity
  has no pre-scan editor and remains the server-fixed value `1`.
- **Compact post-scan card:** title, authors (add/remove), language, condition,
  selling price, quantity, location, publication intent, and damage disclosure
  (types, note, complete/readable/safe, and sellable flags). The metadata sheet
  provides the existing Use detected details/Edit manually decisions. Notes and
  script remain outside the compact card, as required above.
- **Full correction route:** original title/authors and confirmations, language
  tag, script, matched/manual metadata choice, quantity, price in minor units,
  shelf location, condition, damage details, public/internal notes, publication
  intent, and the existing false-detection/variant/stale-review actions.

The compact editor is rendered only when the card has a saved review or the
server exposes `save_review`, and mutation controls additionally require the
active-session/online authority gate. Closed or offline sessions therefore
remain read-only. M54 enforces the same rule at the database RPC boundary:
current Save/Add/Remove first reconcile completed exact replay, then lock and
require the initiating Owner's session to be `active` with future `expires_at`
before any new effect. Non-mutable detail and batch projections must not
advertise `save_review`, `remove_from_scan`, `add_missed`,
`add_to_inventory`, or variant mutation actions. A batch quantity selector or
“apply quantity to all” prompt is not part of the current pre-scan contract;
any such future behavior requires a separate product/SDD decision.

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

`Remove from this scan` is never a synonym for false detection. The compact
action records the retained M52 Owner-removal disposition. False detection
remains reachable through the existing full-correction controller and records
only `skipped_false_detection`. The missed-book route and variant sheet likewise
remain reachable rather than being copied into the compact card.

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

When candidate, metadata, review, or proposal authority changes, the Owner's
mounted draft survives. The existing comparison view must identify changed
authority and require **Use latest** or explicit **Reapply my edits** against
fresh versions and a new semantic identity. “Refresh and try again” alone is
not equivalent and must not replace this behavior.

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

Any private Unit 6G query root introduced by NEW 6G-C must join the existing
Unit 6 identity boundary in the same work unit. Logout, account transition,
store transition, eligibility loss, request cancellation/fencing, and
stale-result rejection must cancel and remove both Unit 6 and Unit 6G private
roots before the next identity can query. Cleanup cannot be deferred to 6G-D or
6G-E.

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
allowed only for an uncommitted candidate in an active, unexpired session. It
locks the session before the candidate after completed exact-replay
reconciliation, then
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
| U6G-C03 | `close_scan_session_v3` / `phase9_close_session_v3` | Perform the existing terminal-input Close mutation with the existing lock/version/idempotency rules and return the v3 readiness shape whose close summary includes safe-integer `ownerRemovedCandidates`; `close_scan_session`/`phase9_close_session_v2` remain unchanged |
| Reused | `read_scan_candidate` / candidate detail v2 | On-demand metadata sheet and conflict refresh |
| Reused | `update_candidate_review` / review update v2 | Strict canonical Save before every commit |
| Reused | `add_candidate_to_inventory` / M39 v1 | One create-only private commit per candidate |

`close_scan_session_v3` has the same request fields, initiating-Owner
authorization, terminal-input rule, candidate/session lock, expected-session
version, idempotency replay, and non-commit behavior as the existing v2 Close.
Its response is `OwnerSessionReadinessV3`: the existing readiness fields with a
strict `CloseSummaryV3` that adds only the
`ownerRemovedCandidates: NonNegativeSafeInteger` lifetime count. The v2 `close_scan_session` response and
the existing `phase9_close_session_v2` function are not widened; a legacy v2
caller either continues to use the old summary for a legacy non-null session or
fails closed for a Unit 6G nullable session and must refetch/use v3. No
unbounded removed-candidate list is returned by Close.

All Unit 6G client session, readiness/summary, and Close surfaces use the v3
family consistently: `read_scan_session_v3` supplies Unit 6G session/default/
terminality/close-state authority, the batch aggregate supplies supplemental
candidate blockers/state, and `close_scan_session_v3` returns
`OwnerSessionReadinessV3`. Unit 6G never chooses v2 or v3 based on nullable
condition or another runtime field. Legacy clients retain v2 compatibility;
the nullable-v2 fence is a compatibility safeguard, not preferred Unit 6G
routing.

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
`2..35`, nullable ISO 15924 script; selected metadata summary members are
independently nullable, with non-null title `1..512`, authors `1..20` entries
of `1..256`, canonical language, and approved HTTPS cover reference `1..512`.
The selected canonical snapshot is not rewritten; the compact projection emits
null for an unusable member and `fieldSources` governs that field's fallback.
Attention codes are the existing 12-value
enum; blockers use the existing 17-value enum, one nullable bounded field name,
exactly one candidate/input UUID, and safe message `1..240`; for a supported NEW
Unit 6G single-image scan, card ordinals, card arrays, and the aggregate item
list are bounded by the 15-candidate current-image cap. Session-level counters
(`counts`, blocker counts, and every close-summary total) are non-negative
JSON-safe integers: SQL emits plain `count(*)` totals without a numeric ceiling,
historical sessions may exceed 15 in lifetime totals, and any value above
2^53-1 fails closed at the decoder instead of losing precision. The saved review,
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

Verdict: **M52_RETAINED; NO_NEW_MIGRATION_FOR_RECOMPOSITION**. M52 already
provides the approved A/B persistence and versioned RPC foundation and remains
byte-immutable. This documentation pass creates or applies no migration. A new
migration may be proposed only for an independently proven schema defect, which
must first be reported and separately authorized; the C composition regression
alone is not such a defect.

| Delta | Retained M52 classification | Existing retained effect |
| --- | --- | --- |
| Durable default price and batch label | schema/additive, category 3 | M52 adds nullable bounded session fields `default_price_minor` and `batch_label`; both survive resume and remain session-only. No inventory column was added. |
| Optional pre-scan condition | schema/compatibility, category 3 | M52 makes `default_condition` nullable while preserving existing non-null rows and the legacy-v2 fail-closed fence; v3 summary/Close is the Unit 6G contract. |
| Candidate Owner removal | schema/state, category 4 | M52 adds `owner_removed_from_scan` and its active/review/readiness/commit, count, revision, worker-completion, and removal/commit fences. |
| Close/summary contract | controlled API/schema, category 4 | M52 adds `close_scan_session_v3` / `phase9_close_session_v3` and safe-integer `ownerRemovedCandidates`; v2 remains strict and unchanged, and the v3 wrapper prevents double-counting. |
| Legacy page compatibility | controlled API, category 4 | M52 forward-replaces `phase9_owner_candidates_page_v2` so legacy session scope excludes removed candidates without changing signature, grants, cursor semantics, or needs-review scope. |
| Audit/event and grants | controlled API/security, category 4 | M52 registers the bounded removal event/audit and exposes only the narrow authenticated Owner RPC grants; direct table access and unneeded `service_role` EXECUTE remain absent. |
| New session/start, batch-review, and remove RPCs | controlled API | M52 supplies fixed-search-path, server-derived, initiator-only strict RPCs with exact replay/version/NULL fences and no direct table access. |
| Compact mobile flow and bulk coordinator | application | strict schemas, form/reducer, virtualized cards, metadata sheet, save-then-commit orchestration |
| Store View refresh | application/cache | invalidate/coalesce `storeViewKeys.all` after canonical commit success |

The retained M52 change is migration category 4 for the full feature because a new candidate
disposition changes lifecycle/readiness/list/audit semantics. It also contains
the smaller category 3 session-field delta for price and batch label. It is not
a database rewrite.

No additional migration is required for the fixed `INR` currency presentation, server-
fixed pre-scan quantity `1`, M39's existing private create-only commit and
`q/q/0/0/0` initialization, existing `store_inventory` columns, Unit 7C
tables or commands, or Store View cache invalidation. The last item is an
application query-cache effect, not a database schema effect. The card source
badges, strict aggregate DTOs, metadata sheet, and command-slot coordinator
are application/Edge contract work; only the versioned close/removal/session
boundaries and their controlled grants require database/RPC migration work.

Existing rows remain unchanged: condition/price/batch defaults preserve their
current values or null target values as applicable; no candidate is inferred as
removed; no inventory/listing row is rewritten. No new database preflight,
migration file, or application is part of NEW 6G-C/6G-D. Those gates apply only
if a later independently proven schema defect receives separate authority.

Legacy-v2 caller failure contract: against a Unit 6G nullable-condition
session, legacy `read_scan_session` decode fails closed by design and the
client must refetch through v3; the v2 Close fails with `P9_STATE_CONFLICT`
through the M52 fence. After a removal, legacy session-scope candidate pages
exclude the removed card (forward replacement), so no legacy surface ever
receives the new disposition value. Residual mixed-version exposure is limited
to old builds reading sessions created through the new Start; Groups 2–4 must
therefore use the v3 cutover consistently rather than preserve mixed routing.
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
summary adds the `NonNegativeSafeInteger` `ownerRemovedCandidates` lifetime
count; existing v2
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
| U6G-AC05 | For a supported NEW Unit 6G single-image scan, one bounded review aggregate returns 0..15 strict compact cards without N+1 full metadata reads; observed identity, metadata summary, blockers, attention codes, counts, actions, and privacy bounds are exact and schema-tied. Historical lifetime counters remain safe integers rather than being capped at 15. |
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
| U6G-AC18 | Successful commits invalidate/coalesce candidate/session/readiness/discovery and Store View list caches, and v3 session/Close responses return `ownerRemovedCandidates` as a `NonNegativeSafeInteger` lifetime count while v2 Close remains strict and unchanged. |
| U6G-AC19 | Offline is read-only, drafts are memory-only, and reconnect refetches authority before any mutation. |
| U6G-AC20 | Cross-store, same-store-noninitiator, random-ID, stale-version, changed-replay, forbidden-field, closed/closing/expired-status, and active-with-past-expiry mutation tests fail closed without effects; those non-mutable session reads advertise only read-only actions. |
| U6G-AC21 | Scan/private/provider/job/attempt/cost data cannot leak through cards, metadata, logs, telemetry, or public media. |
| U6G-AC22 | The supported 15-card maximum remains responsive with virtualized compact rendering, on-demand metadata, bounded polling, and bounded commits. |
| U6G-AC23 | Screen reader, focus, 44×44 target, large-text, non-color status, busy/result announcement, and removal-dialog gates pass. |
| U6G-AC24 | Unit 7C remains the sole post-commit editor; Unit 6G adds no Store View table/lifecycle/media/stock command. |
| U6G-AC25 | Unit 6 remains mounted or explicitly delegated intact as lifecycle controller; a candidate-only aggregate never becomes the sole session controller, and primary-screen changes require lifecycle-equivalence proof. |
| U6G-AC26 | The combined route presents exactly ONE current image/input and uses Unit 6 session/input authority for upload, registration, sanitation, vision, pre-candidate failure/recovery/replacement; zero candidates never implies lifecycle completion or a dead end, and no append-image or multi-image session flow exists. |
| U6G-AC27 | One logical Start v2 attempt keeps one semantic identity across lost/ambiguous response and explicit replay; async picker/camera/network completions are generation/identity fenced, and only a reconciled deliberate new Start obtains a new identity. |
| U6G-AC28 | An active zero-input session resumes to camera/gallery selection and can continue; it never lands on an unrecoverable zero-card candidate page. |
| U6G-AC29 | Compact review is primary but existing full correction remains reachable for false detection, variants, changed-authority compare/Reapply, missed books, and unsafe-to-compact edits; general Remove remains distinct and `Choose another match` is not invented. |
| U6G-AC30 | Unit 6G uses `read_scan_session_v3` and `close_scan_session_v3` consistently for session/readiness/Close surfaces; nullable-v2 fencing is compatibility only, `languageHint` is required/non-null, and script is server-derived/nullable rather than setup input. |
| U6G-AC31 | Every new private Unit 6G query root joins Unit 6 identity/store/logout cancellation, removal, request fencing, and stale-result rejection in NEW 6G-C, not a later work unit. |
| U6G-AC32 | An unsaved mounted field override displays a local Custom marker instead of a stale persisted source badge, but the marker cannot manufacture server readiness or commit authority; location source remains exactly default/custom/missing. |
| U6G-AC33 | The currently mounted production route proves two executable branches: (A) Start through candidate arrival/enrichment, recovery refreshes, compact/full review, readiness, and Close; and (B) a separate pre-lineage terminal input failure through deliberate replacement and resumed processing. The over-limit case proves one image with >15 detected books returns `P9_VISION_OVER_LIMIT`, creates zero candidates, shows bounded failure guidance, and preserves Unit 6 replacement/recovery so a replacement image with <=15 books can continue normally. |
| U6G-AC34 | No live client verification is PASS until the exact reviewed Owner Edge bundle is deployed and read back with all five Unit 6G actions; local source, M52 application, or a client build is not deployment evidence. |

## 24. Required red-test groups

1. **Session defaults and semantic Start:** strict v2 start request, required
   non-null language hint/location/publication, optional condition/price/label,
   same-identity ambiguous replay, deliberate-new-Start identity only after
   reconciliation, operation-generation/identity fencing, old-session
   compatibility, and no script/currency/quantity caller authority.
2. **Price conversion:** every preset boundary, custom/zero/null, integer-safe
   rupee-to-minor conversion, and no float/paisa input.
3. **Batch aggregate:** supported single-image 0/1/15 cards, repeated books,
   every state/source/null branch, strict keys, order, private-field scan, and
   no cross-owner data. An unsupported historical multi-input `>15` fixture
   proves fail-closed/non-normal routing, no silent complete-session truncation,
   no hidden candidate treated as reviewed, and no new legacy pagination.
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
11. **MANDATORY RED/FULL mounted production-route composition:** exercise the
   currently mounted production route, not isolated old/new components, in two
   literal scenarios. **Scenario A — success/candidate arrival:** Start v2 →
   choose ONE image → preview → private upload → registration → zero candidates
   initially → visible Unit 6 processing → sanitation/vision → candidate
   creation up to the 15-card cap → automatic appearance while the route remains mounted → metadata
   enrichment → foreground/reconnect/reload → Resume → compact review → full
   correction reachability → v3 readiness → v3 Close. **Scenario B — pre-lineage
   failure/recovery:** Start/Resume → ONE current input → sanitation/vision/input
   terminal failure before candidate lineage → exact bounded reason/guidance →
   deliberate remove/replacement where Unit 6 permits → choose replacement
   image → registration → processing resumes. Separate cases prove active
   zero-input Resume; ambiguous Start replay; logout/account/store cleanup for
   Unit 6 and new 6G roots; stale compare/Reapply; false detection; variants;
    and missed-book reachability. Existing Unit 6 tests alone and isolated Unit
    6G component tests alone are insufficient.
12. **Inherited Unit 6 over-limit case:** ONE image containing more than 15
    detected books → existing `P9_VISION_OVER_LIMIT` → zero candidates →
    bounded failure guidance → Unit 6 replacement/recovery remains reachable →
    replacement image containing 1..15 books continues normally. No retained-
    15 rule, pagination, append-image behavior, or multi-image accumulation is
    introduced.
13. **Edge deployment cutover:** before 6G-E/live release PASS, deploy and read
   back the exact reviewed Owner Edge bundle and prove
   `start_scan_session_v2`, `read_scan_session_v3`,
   `read_scan_batch_review`, `remove_candidate_from_scan`, and
   `close_scan_session_v3`. Local source, migration application, and successful
   client build are explicitly insufficient.

## 25. Bounded implementation order

Every slice requires separate authorization and independent review:

1. **6G-A — RETAINED contract/red-test foundation:** retain the approved strict
   DTO/error/state contract and its red-test evidence. Do not redesign it.
2. **6G-B — RETAINED M52 + strict Edge/database boundary:** retain M52, strict
   dispatch/decoding, authenticated grants, and connected readback. Do not
   create a replacement migration for the composition defect.
3. **NEW 6G-C — RECOMPOSED PRE-COMMIT EXPERIENCE:** owns only pre-scan defaults
   UI; correct semantic Start v2 integration with Unit 6; combined Unit 6
   progress plus Unit 6G compact review; common inline editing; metadata/manual
   correction entry; continued reachability of Unit 6 correction paths; general
   Remove; v3 session/readiness/Close client cutover; immediate integration of
   new 6G queries into Unit 6 identity cleanup; and mounted-route predecessor
   lifecycle regressions; and single-current-image presentation with no append
   or pagination. It inherits Unit 6 `P9_VISION_OVER_LIMIT` behavior unchanged
   and must not implement Add/Add-all commit orchestration,
   replace the Unit 6 controller, or duplicate Unit 6 processing/recovery. The
   existing Unit 6 lifecycle remains the processing owner.
4. **NEW 6G-D — COMMIT ORCHESTRATION:** owns per-card Save → Add, exact-N Add
   all, maximum-three concurrent candidate chains, command-slot arbitration,
   unchanged M39 private create-only commit, partial success/reconciliation,
   canonical cache synchronization, and Store View invalidation/handoff.
5. **6G-E — CLOSURE:** owns exact reviewed Edge deployment/readback, connected
   live web proof, representative Expo/native proof, accessibility/performance
   closure, and rollout/provenance evidence.

Any new database preflight/migration work, Edge/mobile deployment, and connected
business-row proof remain distinct authorities. The 2026-08-29 composition-only
6G-C checkpoint is local and pending Owner review; it does not authorize any of
those external actions. Its independent design review remains COMPLETE (verdict
PASS_WITH_P3), and 6G-D/6G-E gates remain unchanged.

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
- `matched` and `detected` are distinct source codes whose visible badges are
  `Provider matched` and `Vision detected` respectively;
- one candidate has one active command slot; Add all skips and reports busy
  cards, and server disposition/version fences prevent removal/commit races;
- v3 Close returns the safe-integer owner-removed lifetime count while v2 Close stays
  unchanged; and
- general removal is a new durable disposition, not false detection; and
- batch label is session-only.

The supported product boundary is one current image. For 1..15 detected books,
Unit 6 processing proceeds normally and the compact review set remains bounded
to 0..15 cards. More than 15 detected books inherits Unit 6 unchanged:
`P9_VISION_OVER_LIMIT`, zero candidates, bounded failure guidance, and reachable
replacement/recovery. Historical multi-input overflow is unsupported
compatibility data and must fail closed rather than masquerade as a complete
Unit 6G scan; Unit 6G adds no pagination for it. Lifetime counters remain
`NonNegativeSafeInteger` values and are not capped at 15.

This revision additionally freezes Unit 6 as lifecycle predecessor, one-current-
input and zero-input recovery, stable Start identity, dual lifecycle/review
authority on the mounted route, continued full-correction reachability, v3-only
Unit 6G client routing, same-work-unit identity cleanup, and the mandatory
mounted-route and Edge-readback gates. Unit 6G-A/B and M52 are retained; the old
C/D implementation line is superseded.

The former requirement to design complete historical `>15` traversal or
pagination before approval is removed. Historical overflow is handled by the
fail-closed compatibility rule in §8.1.

Final ambiguity challenge:

1. No current wording authorizes multiple images in a supported Unit 6G
   session; replacement occupies the same one-current-image slot.
2. No client pagination is required or allowed for a normal supported scan.
3. A supported scan can expose 0..15 cards and never more.
4. More than 15 detected books creates zero candidates and returns the existing
   `P9_VISION_OVER_LIMIT`; no candidates are silently retained or hidden.
5. Bounded Unit 6 failure guidance and deliberate replacement/recovery remain
   reachable; a replacement image with 1..15 books can continue normally.
6. Unsupported historical overflow is separate and fails closed rather than
   masquerading as a complete supported scan.
7. Lifetime/aggregate/readiness/Close counters remain
   `NonNegativeSafeInteger` values and are not capped at 15.
8. No rule for WHICH 15 are retained is needed because the inherited over-limit
   path retains zero candidates. `candidateCapSkips` is not reinterpreted.

No product ambiguity remains for NEW 6G-C: it preserves existing Unit 6
candidate-limit behavior. A possible future “process 15 and skip the remainder”
experience is a deferred product/design decision owned by a separate later work
unit, not a prerequisite or hidden requirement for NEW 6G-C.

**Next gate:** Owner checkpoint disposition of this corrected three-document
authority set, including exact Unit 6 over-limit inheritance; its independent
final review is COMPLETE (verdict PASS_WITH_P3).
No 6G-E deployment, connected business-row proof, migration application, or Git
publication may begin without the applicable separate explicit Owner
authorization. The local 6G-C composition checkpoint is not release evidence.
