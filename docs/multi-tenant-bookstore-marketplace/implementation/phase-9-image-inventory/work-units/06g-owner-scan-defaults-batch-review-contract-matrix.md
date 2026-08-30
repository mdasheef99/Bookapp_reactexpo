# Phase 9 Unit 6G Contract and Screen Matrix

**Status:** `unit6g_metadata_quality_local_complete_pending_review`
**Date:** 2026-08-30
**Owner:** [Unit 6G SDD](./06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md)

This matrix operationalizes the recomposed Unit 6G SDD. Unit 6G-A/B and the
exact M52 foundation are retained; historical 6G-C commit `e7ed166` and frozen
dirty 6G-D work are superseded as implementation authority. Independent final
review of this recomposed three-document authority is COMPLETE (verdict
PASS_WITH_P3); the local composition-only UI checkpoint is pending Owner
review. NEW
6G-C/6G-D each then require separate explicit Owner authorization; NEW 6G-C is
composition-only/pre-commit. The composition-only 6G-C UI checkpoint was
implemented locally on 2026-08-29 in the recomposition worktree; it remains
uncommitted and undeployed. Root specifications and the SDD outrank this
matrix.

**M54 implementation overlay (2026-08-29):** The current final Save/Add/Remove
RPCs reconcile completed exact replay, then lock and require the initiating
Owner's session to be active and unexpired before any new effect. Closed,
closing, expired-status, and active-with-past-expiry detail/batch reads remain
available but expose only `view_readiness` at detail and
`view_metadata,view_readiness` at batch-card level; nested variant mutation
actions are empty. M54 is live exactly once as `20260829142337`. It does not
redefine older manual/false-detection/variant sibling RPC compatibility.

## 1. Pre-scan setup matrix

| Field | Control and exact choices | Required to Start | Canonical request/storage | Card inheritance | Validation/error |
| --- | --- | --- | --- | --- | --- |
| Location | Select-or-enter; one `Batch location` value | Yes | `location` / `default_location`, Unicode NFC, 1..120 | Every unsaved card uses it; post-scan `Use batch location` or Custom | Focus field; “Choose or enter a location.” No hidden `default` string |
| Language | Searchable language dropdown; English initially selected, so Owner interaction may feel optional | Yes: `languageHint` is a required non-null request field | `languageHint='en'` initially / `selected_language` | Fallback only. Valid detected language wins and is marked Detected | Canonical BCP 47, 2..35; never rejects a differently detected valid language |
| Condition | `Not set`, New, Like New, Very Good, Good, Acceptable | No | `condition:null|new|like_new|very_good|good|acceptable` / nullable `default_condition` | Value when set; otherwise card Missing | Exact enum; accessible condition help |
| Selling price | Not set, preset values, Custom | No | `priceMinor:null|safe integer` / `default_price_minor` | Value when set; otherwise card Missing | Whole rupees only; exact x100 conversion; private permits explicit zero, publish does not |
| Quantity | Read-only display “1 per detected book” or omitted from edit controls | Server fixed | Not caller-authoritative; `default_quantity=1` | Every unsaved card starts at 1 | No pre-scan quantity request field |
| Publication intent | Private / Prepare to publish later | Effective value yes | `publication:private|publish` / `default_publication` | Inherited unless overridden | Copy states that Add still creates private inventory |
| Batch label | Optional bounded input | No | `batchLabel:null|string` / `batch_label` | No per-card or inventory inheritance | trim+NFC, 1..80 when present; plain text; private/telemetry-forbidden |
| Currency | Static `INR (₹)` | Fixed | No request/database currency field | All Unit 6G prices | No selector and no paise field |
| Script | No Owner control | No | Server-owned/derived/nullable existing field; forbidden as a setup request key | Detected/saved value | Not guessed from English fallback alone and never entered by the Owner |

### 1.1 Exact price presets

```text
Not set
25, 50, 75, 100, 125, 150, 175, 200, 225, 250
300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000
1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000
Custom
```

All numbers are displayed as rupees and submitted as `number * 100` integer
minor units. The preset arrays are static presentation data, not database rows.

### 1.2 Proposed start request/response

```text
StartScanSessionV2Request {
  contractVersion: "phase9-owner-batch-review-v1"
  languageHint: Bcp47                         // R, client initial "en"
  condition: Condition | null                 // R key, nullable value
  location: string                            // R, non-empty
  priceMinor: SafeInteger | null              // R key, nullable value
  publication: "private" | "publish"         // R
  batchLabel: string | null                    // R key, nullable value
  idempotencyKey: string                       // R
  commandId: uuid                              // R
}

StartScanSessionV2Response {
  contractVersion: "phase9-owner-batch-review-v1"
  data: {
    sessionId: uuid
    sessionVersion: PositiveInteger
    defaults: SessionDefaultsV2
    batchLabel: string | null
  }
}
```

Unknown keys—including `storeId`, `userId`, `quantity`, `currency`,
`currencyCode`, `script`, and `priceRupees`—are rejected. Store, actor,
quantity 1, and money conversion policy are not caller authority.

One logical Start attempt owns one stable `idempotencyKey`/`commandId`. A lost
or ambiguous response is reconciled/replayed with that same identity; another
Start press does not automatically allocate a new identity. Picker/camera/
network continuation is fenced by Owner/store identity and operation
generation. Only a deliberate new Start after reconciliation obtains a new
identity. Direct acceptance and red tests belong to NEW 6G-C's mounted-route
group, not only the isolated request decoder.

## 2. Session review page matrix

**Route-composition invariant:** the existing Unit 6 session lifecycle/
controller remains mounted or is explicitly delegated intact. A Unit 6G review
component may render within or alongside it, but a candidate-only aggregate
screen must never become the sole session controller. Changing the primary
screen presentation requires lifecycle-equivalence proof for every
responsibility previously owned by that route.

| Region | Content | Server source | Local state | Actions and gates |
| --- | --- | --- | --- | --- |
| Header | Batch label when present; Unit 6 capture/session status | `read_scan_session_v3` plus Unit 6 session/input authority; aggregate supplies candidate-side additions only | Expansion only | Back uses dirty/busy guard |
| Input progress | `Image processing: R ready, A need attention, P processing` | Unit 6 input lifecycle only | None beyond mounted Unit 6 controller | `need attention` describes terminal image/input attention only; it is not a candidate-review count |
| Summary | Ready, Processing, Need review, Added | Unit 6G aggregate states plus mounted draft validation for Ready | Current mounted draft fingerprints | Candidate counts are announced separately; `0` input attention and `15` candidate need-review may coexist correctly |
| Bulk action | `Add all ready books (N)` | Candidate capabilities/versions plus strict-valid current drafts | Frozen run membership/results and shared per-candidate command slots | Visible when N>0; online/current authority; one confirmation for N>1; already locked cards are skipped and reported Busy, never queued |
| Input lifecycle | ONE current input: zero-input recoverable, uploading/registered, sanitation/vision processing, ready, terminal failure, deliberate removal/replacement | Unit 6 session/input queries only; the batch aggregate is never input-processing authority | Local upload progress/URI only before registration | Zero candidates never implies idle/complete/failure; existing Unit 6 remove/replacement and Resume rules remain authoritative |
| Card list | For a supported NEW Unit 6G single-image scan, 0..15 stable-ordinal compact cards | Batch aggregate | Per-card mounted draft/command reducer | FlatList virtualization, no expanded metadata mount, no sixteenth card or pagination |
| Full correction | Existing candidate-detail route plus false/variant/stale comparison controls | Unit 6 candidate detail/correction contracts | Existing mounted full-correction draft | Reachable for false detection, variants, compare/Reapply, and edits unsafe for compact controls; no invented Choose another match |
| Footer | Add missed, v3 Summary/Close | `read_scan_session_v3`, batch candidate state, and `close_scan_session_v3` | Auto-close attempt identity and manual partial-close confirmation only | Missed flow remains reachable; Close never commits/removes/discards/publishes. Exact all-committed state invokes v3 Close automatically; otherwise manual Close remains available with an explicit read-only-remainder warning |

The combined page observes Unit 6 lifecycle authority and Unit 6G candidate/
review authority concurrently. An active session with zero current input must
Resume to camera/gallery selection. Candidates must arrive automatically while
the route remains mounted as Unit 6 processing completes.

## 3. Card field matrix

| Field | Display | Editor | Draft source precedence | Required before Add | Source badge |
| --- | --- | --- | --- | --- | --- |
| Cover | 56–72 px bounded thumbnail/placeholder | None | selected metadata/observed allowlisted reference → missing | No | Provider matched, Vision detected, or Missing; never scan image |
| Title | Full screen-reader value; visually bounded lines | Plain text inline/manual | saved custom → selected metadata/observed → missing | Yes | Custom, Provider matched, Vision detected, or Missing |
| Authors | Ordered accessible list; “Author unknown” allowed | Simple ordered fields/add/remove | saved custom → selected metadata/observed → missing | Decision required; empty confirmed array permitted | Custom, Provider matched, Vision detected, or Missing |
| Metadata status | Provider metadata selected / Manual metadata / No provider match / Metadata processing / Multiple possible matches / Metadata temporarily unavailable / Metadata failed | Metadata sheet | current metadata state/revision | Terminal selected/manual path | State label only; not a field-source badge |
| Language | Canonical language label/code | Searchable dropdown | saved custom → selected metadata/observed → session hint → missing | Yes | Custom/Provider matched/Vision detected/Default/Missing |
| Condition | Label plus help marker | Five-value dropdown | saved review → session default | Yes | Custom/Default/Missing |
| Selling price | Locale-aware `₹` whole amount | Preset/custom picker | saved review → session default | Yes; 0 only private | Custom/Default/Missing |
| Quantity | Integer | Stepper with accessible +/- and direct bounded entry fallback | saved custom → server-fixed 1 | Yes, 1..10,000 | Custom/Default |
| Location | Batch/custom summary | `Use batch location` / `Custom` text | saved custom → batch location → missing | Yes | Custom/Default/Missing |
| Publication intent | Private/Prepare to publish | Segmented selector | saved custom → session intent → missing | Yes | Custom/Default/Missing |
| Damage | No damage/Has damage summary | Segmented; Yes expands exact existing fields | saved custom → explicit No-damage draft → missing | Explicitly confirmed by Add | Custom/Default/Missing |
| Notes | Not displayed | None | Existing saved values retained internally; otherwise canonical null object | No | None |

### 3.1 Damage expansion

The expansion reuses the current strict schema exactly:

```text
hasDamage
damageTypes[]
damageNote
isSellable
completeReadableSafe
```

No new condition value is introduced. Mould/contamination and unsellable rules
continue to force private intent. Public damage-photo eligibility remains Unit
7B/7C and is not implied by Unit 6G review readiness.

### 3.2 Card actions

| Action | Visibility | Confirmation | Result |
| --- | --- | --- | --- |
| View metadata | Current candidate exists | None | On-demand current detail sheet; no draft mutation until an action is chosen |
| Use detected details | Observed title/language pass `ObservedIdentitySummary`; authors `0..20`; script valid/null | None; action itself explicit | Atomically copies observed title/authors/language/script, confirms title/authors, and sets existing `metadataChoice={mode:"manual",selectionId:null}`; selected snapshot/canonical/cover/provider data is not authoritative for Save/M39 |
| Edit manually | Candidate reviewable | None | Opens identity editors with existing `metadataChoice.mode="manual"` and null selection; canonical link remains nullable |
| Open full correction | Candidate exists and Unit 6 detail authorization succeeds | None | Routes to the existing Unit 6 candidate-detail controller for false detection, linguistic variants, changed-authority comparison/Reapply, and edits that compact controls cannot represent safely |
| Mark false detection | Only inside the existing full-correction path when candidate detail returns `mark_false` | Existing destructive confirmation | Records `skipped_false_detection`; it does not call general Remove and does not delete candidate/evidence/inventory |
| Remove from this scan | Any uncommitted candidate; not already false/removed; command slot idle | Required | Claims the shared slot, calls U6G-C02, and leaves only after canonical success; busy reports without a request |
| Add to inventory | Draft complete, online, current/refetchable authority, not busy | Action itself confirms displayed values | Strict Save then canonical M39 commit; success leaves list |
| Retry | Prior retryable save/commit failure | No new business confirmation if fingerprint unchanged | Reuses same identity only for the same ambiguous command; otherwise new deliberate attempt |

No `Choose another match`, duplicate action, separate Save, separate Submit,
Undo, or automatic commit action is rendered.

The per-card Add path sends the complete strict review through Save before M39.
Title/author metadata changes do not replace or reset Owner-entered condition,
selling price, quantity, location, damage, publication intent, or retained
notes. A successful response returns the canonical `inventoryId`; exact replay
returns that same result rather than creating another inventory row.

The on-demand sheet automatically renders an allowlisted selected cover when
present, plus title, subtitle, authors, bounded plain-text description,
language, ISBNs, publisher/date, edition/volume/format, page count, and
categories/genre. Missing optional values are omitted. There is no cover
checkbox, scan-media fallback, provider-rematch action, or new mutation seam.

General Remove and false detection are different actions, contracts,
dispositions, audit meanings, and UI copy. The existing missed-book route stays
reachable from the combined page; it is not represented as a candidate-card
mutation.

If observed title/language/script is incomplete or unusable, **Use detected
details** is absent. A stale/forged invocation makes no change; the existing
manual/title/language attention/blocker codes remain, and the Owner must use
**Edit manually**. No partial copy, silent selected-metadata fallback, or new
metadata-choice mode exists.

The M39 effect is exact: `mode="selected"` loads the current candidate-owned
snapshot and may materialize its permitted canonical IDs, bibliographic fields,
cover, and selected-snapshot provenance. `mode="manual"` does not load that
snapshot; it materializes the saved Owner-confirmed title/authors/language,
leaves selected/canonical/provider fields and cover nullable, and uses the
existing manual review/metadata revision provenance string. Neither action
mutates shared canonical metadata. Both still enter the same unchanged private
create-only M39 path after strict Save.

## 4. Batch review aggregate contract

### 4.1 Request

```text
ReadScanBatchReviewRequest {
  contractVersion: "phase9-owner-batch-review-v1"
  sessionId: uuid
}
```

This is read-only. Idempotency/command/store/user/page/cursor fields are
forbidden. For a supported NEW Unit 6G single-image scan, the compact review
set contains 0..15 candidate cards, so the aggregate is bounded and not
paginated. This is a current-scan product cap, not a universal limit on
historical session-lifetime counters.

The aggregate is candidate/review authority only. It is supplemental to Unit 6
session/input observation and cannot determine upload, registration,
sanitation, vision, zero-input recovery, input terminal failure, or replacement.
Zero aggregate items cannot be interpreted as an idle, complete, or
unrecoverable session.

NEW 6G-C does not change Unit 6 candidate-limit semantics. For 1..15 detected
books, existing Unit 6 processing proceeds normally. If the one current image
contains more than 15 detected books, Unit 6G inherits the current Unit 6 path
unchanged: `P9_VISION_OVER_LIMIT`, zero candidates, bounded failure guidance,
and reachable deliberate replacement/recovery. A replacement image containing
1..15 books can continue normally in the same one-current-image slot.

No first/best/top 15 is retained, no selection rule is required or invented,
and `candidateCapSkips` keeps its existing authority without reinterpretation.
Any future UX such as “process 15 and skip the remainder” is deferred to a
separate later work unit and product/design decision. It is not NEW 6G-C scope
and introduces no pagination, append-image action, or multi-image accumulation.

Historical multi-input sessions whose active state exceeds the supported bound
are unsupported compatibility data. They must not be silently truncated into
a seemingly complete Unit 6G scan, and hidden candidates must not be treated as
reviewed or handled. They fail closed unless an already-proven complete safe
legacy recovery path is used; none is currently proven. NEW 6G-C adds no
pagination solely for those sessions, and v3 readiness/Close remains server-
authoritative. M52 is unchanged by this documentation pass.

### 4.2 Response root

```text
OwnerBatchReview {
  sessionId: uuid
  status: "active" | "closing" | "closed" | "expired"
  sessionVersion: PositiveInteger
  presentationRevision: PositiveInteger
  defaults: SessionDefaultsV2
  batchLabel: SafeText[1..80] | null
  counts: BatchReviewCounts
  items: OwnerBatchReviewCard[0..15]
  updatedAt: timestamp
}

SessionDefaultsV2 {
  languageHint: CanonicalBcp47[2..35]
  condition: Condition | null
  location: SafeText[1..120]
  priceMinor: SafeInteger[0..2147483647] | null
  quantity: 1
  publication: "private" | "publish"
  script: Iso15924 | null
}

BatchReviewCounts {
  detected: NonNegativeSafeInteger
  processing: NonNegativeSafeInteger
  needsAttention: NonNegativeSafeInteger
  reviewReadySaved: NonNegativeSafeInteger
  committed: NonNegativeSafeInteger
  ownerRemoved: NonNegativeSafeInteger
  falseDetections: NonNegativeSafeInteger
}
```

Every object is strict: all listed keys are required unless marked nullable,
unknown keys fail decoding, integers must be safe, and timestamps require an
explicit offset. The seven counts are one-snapshot server derivations and each
candidate belongs to the appropriate lifecycle bucket without caller-provided
count authority. Session-level counters (`counts`, `blockerCounts`, and every
`CloseSummaryV3` field) are non-negative JSON-safe integers rather than a
tight numeric cap: SQL emits plain `count(*)` totals, historical session
lifetime totals such as `imagesSubmitted` or `committedInventoryItems` may
exceed 15, and any value above 2^53-1 fails closed at the decoder instead of
silently losing precision. Only the supported NEW Unit 6G current-image
candidate set, compact card ordinals/arrays, and aggregate item list are capped
at 15.
`batchLabel` and location are Owner-private session values;
they may be rendered here but are forbidden from public DTOs and telemetry.

`Ready` over mounted drafts is not returned as business authority. The server
returns `reviewReadySaved`; the client may present a larger ready-to-submit
count only after strict local validation over the current aggregate revision.

### 4.3 Card DTO

```text
OwnerBatchReviewCard {
  sessionId: uuid
  candidateId: uuid
  inputId: uuid | null
  ordinal: Integer[1..15]
  candidateState: CandidateState
  candidateVersion: PositiveInteger
  metadataState: MetadataState
  metadataRevision: PositiveInteger
  reviewVersion: PositiveInteger | null
  reviewDisposition:
    "reviewed" | "skipped_false_detection" |
    "owner_removed_from_scan" | null
  observed: ObservedIdentitySummary
  metadataSummary: MetadataCardSummary | null
  review: OwnerCandidateReview | null
  fieldSources: CardFieldSources
  attentionCodes: UniqueAttentionCode[0..12]
  blockers: UniqueReadinessBlocker[0..17]
  reviewReady: boolean
  allowedActions: UniqueBatchReviewAllowedAction[0..6]
  updatedAt: timestamp
}
```

`BatchReviewAllowedAction` is a subset of:

```text
save_review
view_metadata
remove_from_scan
add_to_inventory
add_missed
view_readiness
```

Duplicate actions remain forbidden. `add_to_inventory` means the currently
saved review is server-ready; a locally complete unsaved card first uses
`save_review` and must receive `add_to_inventory` before commit.
`Open full correction` is client navigation/delegation to the existing Unit 6
detail/correction capability; it is not a `BatchReviewAllowedAction` and does
not widen the retained A/B DTO.

### 4.4 Strict nested DTOs

These target schemas reuse the current `safeTextSchema`, `languageSchema`,
`conditionSchema`, `candidateStateSchema`, `metadataStateSchema`,
`attentionCodeSchema`, `blockerCodes`, `blockerSchema`, cover allowlist, and
`ownerCandidateReviewSchema`. Unit 6G narrows aggregate arrays and blocker
fields; it does not relax an existing bound.

```text
ObservedIdentitySummary {
  title: SafeText[1..512]
  authors: UniqueSafeText[0..20] each [1..256]
  language: CanonicalBcp47[2..35]
  script: Iso15924 /^[A-Z][a-z]{3}$/ | null
}

MetadataCardSummary {
  title: SafeText[1..512] | null
  authors: UniqueSafeText[1..20] each [1..256] | null
  language: CanonicalBcp47[2..35] | null
  coverReference: ApprovedCoverReference[1..512] | null
}
```

`metadataSummary` is non-null only for a current `selected` metadata snapshot;
otherwise it is null and `metadataState` carries the exact existing state. A
selected snapshot does not make every compact-card member usable: each summary
member is projected independently and is null when its value fails that
member's bound or allowlist. `fieldSources` then selects the existing detected,
default, or missing fallback for that field. The canonical selected snapshot is
unchanged. `ApprovedCoverReference` is HTTPS, host exactly `books.google.com`, has
no username/password, and is never a scan-media URL. The summary contains no
selection/canonical/provider IDs, description, ISBN, publisher/date, format,
pages, categories, confidence, provenance payload, or raw provider response;
the current bounded detail schema remains the on-demand metadata-sheet source.

```text
AttentionCode =
  "input_processing" |
  "metadata_pending" |
  "metadata_manual_required" |
  "title_confirmation_required" |
  "author_confirmation_required" |
  "language_required" |
  "duplicate_choice_required" |
  "damage_details_required" |
  "field_validation_required" |
  "variant_source_stale" |
  "candidate_failed" |
  "review_ready"

ReadinessBlocker {
  code: BlockerCode
  candidateId: uuid | null
  inputId: uuid | null
  field: BlockerField | null
  safeMessage: SafeText[1..240]
}

BlockerCode =
  "input_processing" | "candidate_processing" | "candidate_failed" |
  "review_missing" | "title_unconfirmed" |
  "author_confirmation_incomplete" | "language_missing" |
  "metadata_choice_missing" | "quantity_invalid" | "price_invalid" |
  "condition_missing" | "damage_answer_missing" |
  "damage_details_missing" | "location_missing" |
  "publication_intent_missing" | "duplicate_intent_missing" |
  "variant_source_stale"

BlockerField =
  "originalTitle" | "authors" | "originalLanguage" |
  "metadataChoice" | "quantity" | "priceMinor" | "baseCondition" |
  "damageDisclosure" | "shelfLocation" | "publicationIntent" |
  "duplicateIntent" | "variantSource"
```

Attention and blocker arrays are unique, stable-ordered, and bounded to the
enum cardinalities (`0..12` and `0..17`). `ReadinessBlocker` preserves the
current exactly-one-entity rule: exactly one of `candidateId` and `inputId` is
non-null. Card blockers are candidate-scoped (`candidateId` is the card ID and
`inputId` is null); input processing is represented in aggregate/session
readiness, not duplicated as an unbounded card list. Unknown codes/fields or
unsafe messages fail strict decoding.

`OwnerCandidateReview` is exactly the current strict review schema: title
`1..512`; authors `0..20` of `1..256`; BCP 47 language; nullable ISO script;
`metadataChoice.mode` `selected|manual` with non-null selection UUID exactly
when selected; quantity `1..10000`; price minor `0..2147483647`; the five-value
condition; existing nine-value unique damage-type list with nullable note
`<=1000`; shelf location `1..120`; nullable public/internal notes each
`<=1000`; publication `private|publish`; existing nullable duplicate-intent
object for lossless compatibility only; exact title/author confirmations; and
`candidateDisposition="reviewed"`. Review value and positive review version
are both null or both non-null. Hidden notes and legacy duplicate intent are
never rendered or sent to telemetry.

`CandidateState` and `MetadataState` remain the exact current enums:

```text
CandidateState = "processing" | "ready" | "needs_review" |
  "possible_duplicate" | "failed" | "commit_in_progress" | "committed"
MetadataState = "pending" | "selected" | "manual" | "no_match" |
  "ambiguous" | "temporarily_unavailable" | "failed"
Condition = "new" | "like_new" | "very_good" | "good" | "acceptable"
```

The aggregate forbids raw provider/model/scan payload, confidence, geometry,
object paths, signed URLs, hashes, tokens, jobs, attempts, cost, store/user
authority fields, and unbounded metadata. Only the allowlisted cover URL may
be URL-shaped. All objects are strict and all arrays have the maxima above.

### 4.5 Field sources

```text
CardFieldSources {
  cover: "detected" | "matched" | "missing"
  title: "detected" | "matched" | "custom" | "missing"
  authors: "detected" | "matched" | "custom" | "missing"
  language: "detected" | "matched" | "default" | "custom" | "missing"
  condition: "default" | "custom" | "missing"
  price: "default" | "custom" | "missing"
  quantity: "default" | "custom"
  location: "default" | "custom" | "missing"
  publication: "default" | "custom" | "missing"
  damage: "default" | "custom" | "missing"
}
```

The server composes sources for saved/current values. The client may overlay
`custom` on a mounted edit but cannot claim server readiness from that label.
`matched` is valid only when the corresponding selected compact-summary member
is non-null. Usability is evaluated independently per member, so one unusable
selected value cannot confer `matched` authority on itself or invalidate usable
siblings.

Location source is exactly `default|custom|missing`; it can never be
`detected|matched`. After a mounted Owner override, presentation displays a
local Custom marker instead of the stale persisted badge. That marker is local
only and cannot alter the persisted source, aggregate revision, readiness,
allowed actions, or commit eligibility.

| Internal source | Visible badge | Canonical meaning |
| --- | --- | --- |
| `matched` | Provider matched | Current selected metadata/identity match contains a usable value for this field; it remains distinct from vision output |
| `detected` | Vision detected | Current bounded observed identity |
| `default` | Default | Persisted session default |
| `custom` | Custom | Saved/mounted per-card override |
| `missing` | Missing | Final value absent/unusable |

Every field follows saved custom → selected/observed → applicable session
default → missing. Metadata status `Matched` is a state label, not a source
badge. The server is authoritative for persisted source codes; the client may
mark an unsaved edit `custom` only as local presentation until Save/refetch.

### 4.6 Versioned Close response

The existing v2 request/response and `phase9_close_session_v2` remain strict
and unchanged. Unit 6G adds the preferred existing-pattern version:

```text
CloseScanSessionV3Request {
  contractVersion: "phase9-owner-batch-review-v1"
  sessionId: uuid
  expectedSessionVersion: PositiveInteger
  idempotencyKey: /^[A-Za-z0-9._:-]{16,128}$/
  commandId: uuid
}

OwnerSessionReadinessV3 {
  sessionId: uuid
  sessionStatus: "active" | "closing" | "closed" | "expired"
  sessionVersion: PositiveInteger
  allInputsTerminal: boolean
  closeSummary: CloseSummaryV3
  blockerCounts: ExactRecord<BlockerCode, NonNegativeSafeInteger>
  nextBlockingCandidateId: uuid | null
  closeState: "not_closeable" | "closeable" | "closed" | "expired"
  closeAllowed: boolean
  presentationRevision: PositiveInteger
}

CloseSummaryV3 {
  imagesSubmitted: NonNegativeSafeInteger
  imagesProcessed: NonNegativeSafeInteger
  imagesFailed: NonNegativeSafeInteger
  imagesSkipped: NonNegativeSafeInteger
  candidatesDetected: NonNegativeSafeInteger
  candidatesReviewReady: NonNegativeSafeInteger
  candidatesNeedsReview: NonNegativeSafeInteger
  candidatesFailed: NonNegativeSafeInteger
  falseDetections: NonNegativeSafeInteger
  ownerRemovedCandidates: NonNegativeSafeInteger
  manualMissedCandidates: NonNegativeSafeInteger
  committedInventoryItems: NonNegativeSafeInteger
  quantitiesAddedToExisting: NonNegativeSafeInteger
  privateItems: NonNegativeSafeInteger
  publishedItems: NonNegativeSafeInteger
  languageSkips: NonNegativeSafeInteger
  candidateCapSkips: NonNegativeSafeInteger
  qualitySkips: NonNegativeSafeInteger
}
```

`close_scan_session_v3` / `phase9_close_session_v3` uses the same initiating-
Owner authorization, session lock, terminal-input check, expected-version and
idempotency/replay semantics as v2, then returns the strict v3 readiness in the
same canonical post-close snapshot. The one new summary field is a
`NonNegativeSafeInteger` session-lifetime count; Close returns no removed-
candidate list or private/raw details. Legacy
v2 callers never receive an unknown key or null-incompatible condition; a v2
call against a Unit 6G nullable session fails closed and the client uses v3.

Unit 6G client routing is unconditional: session/default/terminality and the
readiness summary use `read_scan_session_v3` with supplemental candidate state
from `read_scan_batch_review`, and Close uses `close_scan_session_v3`. Runtime
field values such as nullable condition never select v2. Legacy v2 remains a
compatibility contract; its nullable-session fence is not preferred Unit 6G
routing.

### Group 1 correction decisions (2026-08-21 rereview pass)

1. `phase9_unit6g_close_summary` overrides the inherited v2
   `candidatesNeedsReview` with an active-only count, so an owner-removed
   candidate is reported exactly once, in `ownerRemovedCandidates`, and never
   also as needing review. The unchanged v2 close summary is untouched.
2. All three command RPCs explicitly reject a null `p_idempotency_key`,
   `p_command_id`, and (for remove/close) a null expected version with
   `P9_REQUEST_INVALID`; PL/pgSQL NULL-comparison fail-open is closed.
3. The batch-review items query bounds its input to 15 rows server-side,
   matching the DTO cap independently of creation-time caps.
4. M52 forward-replaces `public.phase9_owner_candidates_page_v2` so the
   legacy session-scope page excludes `owner_removed_from_scan` candidates;
   legacy clients stop seeing the card instead of failing strict decode on an
   unknown disposition value. Grants, ownership, signature, cursor semantics,
   and the `needs_review` scope behavior are unchanged.
5. `service_role` EXECUTE is deliberately withheld from all five new public
   RPCs (unlike the M47/M48 compatibility restorations): no worker, scheduler,
   or service-role consumer exists; every caller is the authenticated
   Owner-scoped Edge path.
6. Rollout constraint: old app builds still decode-fail against Unit 6G
   nullable-condition sessions through legacy `read_scan_session`, by design
   (SDD §17). NEW 6G-C/6G-D must use the v3 session/readiness/Close family
   consistently; the nullable-v2 fence remains compatibility protection only.

Source-emission note: the server never emits `missing` for quantity or damage
and never emits `detected` for cover; response enums admit these values only
as harmless client-side supersets of the SDD §7 emission table.

## 5. Candidate removal contract

### 5.1 Request/response

```text
RemoveCandidateFromScanRequest {
  contractVersion: "phase9-owner-batch-review-v1"
  sessionId: uuid
  candidateId: uuid
  expectedCandidateVersion: PositiveInteger
  idempotencyKey: string
  commandId: uuid
}

RemoveCandidateFromScanResponse {
  sessionId: uuid
  candidateId: uuid
  candidateVersion: PositiveInteger
  sessionVersion: PositiveInteger
  presentationRevision: PositiveInteger
  reviewDisposition: "owner_removed_from_scan"
  removedAt: timestamp
}
```

The request has no free-text reason and no delete/cascade/media/inventory
fields. The bounded registered audit/event action is exactly
`phase9.candidate.owner_removed_from_scan`; its payload contains only the
candidate/session IDs, old/new disposition, expected/result versions,
command/idempotency correlation, and actor-safe audit identity. It contains no
book text, location, price, label, media, provider, model, or raw payload.

### 5.2 State/side-effect matrix

| Current condition | Result |
| --- | --- |
| `processing|ready|needs_review|possible_duplicate|failed`, uncommitted and not false/removed | Lock, authorize, persist disposition, increment version/review scope, audit/event, canonical response |
| Same exact completed command | Exact canonical replay; no extra version/audit/event |
| Same key changed fingerprint | `P9_IDEMPOTENCY_MISMATCH`; no effect |
| Stale version | `P9_CANDIDATE_VERSION_CONFLICT`; no effect |
| `commit_in_progress|committed` | `P9_STATE_CONFLICT`; no removal or inventory effect |
| Already false or Owner-removed under new key | Stable already-handled/state conflict; no second effect |
| Same-store other Owner, cross-store, mismatched session/candidate | Existing non-enumerating denial/not-found boundary |
| Worker completion races removal | Candidate lock/order and disposition fence ensure removal cannot be cleared or reactivated |
| Save completes immediately before removal | Removal may persist only while still uncommitted; the later M39 call sees non-`reviewed` disposition and fails closed |
| M39 commits immediately before removal | Removal sees committed authority and returns `P9_STATE_CONFLICT`; inventory remains intact |

## 6. Save-then-commit coordinator matrix

### 6.1 Per-candidate command identity

| Semantic action | Key lifetime | Changed input behavior |
| --- | --- | --- |
| Save review | Retain while same review fingerprint + candidate/metadata base revisions is pending/ambiguous | New key after deliberate changed values or Reapply to refreshed revisions |
| Add candidate | Retain while same canonical returned candidate/review/metadata versions is pending/ambiguous | Refetch/reconcile before any new attempt; business fields never enter fingerprint |
| Remove candidate | Retain while same session/candidate/version command is pending/ambiguous | New deliberate attempt only after canonical refetch permits it |

### 6.2 Bulk states

```text
idle
confirming
running { claimed, saving, committing, succeeded, busy, failed, stale }
reconciling
complete { added, busy, needsAttention, failed, stillProcessing }
```

One shared local command registry owns `idle|claimed|saving|committing|
removing|reconciling` per candidate across per-card Add, its internal Save,
Add all, and Remove. Claim is synchronous before any request. At most three
candidates occupy `saving|committing` concurrently, and one candidate never
has more than one network command in flight. Running membership is immutable;
newly ready cards wait for the next Owner action.

On Add-all press, the coordinator attempts to claim each ready candidate in
stable ordinal order. A candidate already claimed by any per-card or bulk
command is excluded from runnable membership, reported `busy`, and never
queued. A render-to-claim race may therefore make the result's Busy count
nonzero even if the button label's preceding `N` included that card. Once the
bulk coordinator owns a slot, per-card Add/Remove is disabled until that
candidate reaches a terminal/reconciled state. No second Add request can share
the candidate, and committed candidates never re-enter a later membership.

The server is the independent safety boundary. Save, removal, and M39 serialize
on the candidate row and recheck current versions/state/disposition under lock.
If removal commits first, the unchanged M39 reviewed-only eligibility rejects
the candidate; if M39 commits first, removal rejects the committed state. A
successful removal cannot race into a successful inventory commit.

### 6.3 Failure presentation

| Failure | Card behavior | Bulk behavior |
| --- | --- | --- |
| Candidate command slot busy | Keep existing command stage; send no request | Skip candidate, increment Busy, never queue |
| Local invalid | Focus first field; no request | Excluded from N, remains Needs attention |
| Authority refresh unavailable | Keep draft; retry refresh | Candidate fails without stopping others |
| Save validation | Show exact safe field error | Needs attention count |
| Candidate/metadata stale | Preserve draft; show compare/Reapply | Stale/needs-attention result |
| Save ambiguous | Same-key retry/reconcile | Candidate remains running/failed-safe |
| Commit stale/ineligible | Refetch; keep saved review | Failed/needs-attention result |
| Commit ambiguous | Same-key retry/reconcile | No new-key automatic retry |
| Commit success | Canonical cache sync, card leaves | Added count; continue queue |
| Some commits succeed, another fails | Successful inventory rows remain; failed card stays editable/retryable while active | Continue unrelated cards; report exact Added/Failed/Needs-attention counts; no rollback |
| Owner manually closes after partial success | Confirm that uncommitted candidates become read-only; confirmed inventory remains unchanged | Stop review; Close performs no remaining Add and no inventory delete |
| Final detected candidate commits | Refetch exact session/batch authority; invoke v3 Close only when strict all-committed policy passes | No separate bulk rule; the same strict auto-close policy runs after canonical cache synchronization |
| Store View invalidation failure | Inventory success remains; bounded refetch warning/retry | Never roll back/repeat commit |

## 7. Cache synchronization matrix

| Event | Required cache effect |
| --- | --- |
| Session start | discovery + new session summary/aggregate |
| Review Save | exact candidate detail + aggregate item; invalidate session candidate/readiness/discovery scopes |
| Owner removal | remove from aggregate after canonical response; invalidate candidate pages, readiness, discovery, session summary |
| Close v3 success | replace session/readiness v3 from canonical response; invalidate aggregate/session discovery; preserve v2 cache keys as separate contract data |
| Automatic Close after all committed | same v3 Close cache effects; no inventory mutation; record one close command/audit result with source `auto_close_after_all_committed` |
| Per-card commit success | exact candidate/detail/readiness/discovery/session plus legacy Owner inventory reads and `storeViewKeys.all` |
| Bulk commit success set | per-candidate canonical updates; coalesce session/discovery/readiness and one Store View all invalidation after run |
| Reconnect/foreground | refetch session aggregate before enabling mutations; no local result overwrites a newer aggregate revision |
| NEW 6G-C introduces a private query root | In the same work unit, register it beneath or alongside the Unit 6 private identity boundary and extend cancellation, removal, generation fencing, and stale-result rejection; cleanup cannot be deferred |
| Identity/store/logout/eligibility change | cancel/fence requests first, clear all Unit 6 and new Unit 6G private image-inventory roots plus prior-identity Store View caches, reject late responses, and only then authorize the next identity/store |

## 8. Screen-state mapping

| Server/draft condition | Card presentation | Allowed primary action |
| --- | --- | --- |
| Active session, zero current input | Recoverable “Choose an image” state; never a zero-card dead end | Resume to Unit 6 camera/gallery choice |
| Local upload or registered input before candidates | Uploading/Registered with Unit 6 byte/registration authority | Existing cancel/retry rules only; aggregate item count is irrelevant |
| Unit 6 sanitation/vision processing with zero candidates | Checking image/Finding books remains visible | Leave/view status; no candidate inference or premature Close |
| Input terminal failure with zero candidate lineage | Image needs attention with deliberate remove/replacement guidance | Unit 6 recovery/replacement only when permitted |
| Candidate arrives while route remains mounted | Insert stable-ordinal compact card automatically and retain visible input state | Compact review when reviewable; full correction remains reachable |
| Candidate or metadata nonterminal | Processing | None; secondary Remove when server allows |
| Reviewable + current draft strict-valid | Ready | Add to inventory |
| Saved `reviewReady=true` + `add_to_inventory` | Ready | Add to inventory (commit directly after authority check) |
| Missing condition/price/location/language/title/damage answer | Needs attention | Edit exact field |
| Failed metadata with observed/manual path available | Needs attention | Edit manually then Add |
| Stale aggregate/revisions | Updating authority / Needs attention | Refetch, compare, Reapply |
| Offline | May be out of date | No mutation |
| Save/commit/removal in flight | Busy with exact stage | No duplicate action/navigation without guard; Add all reports Busy if it cannot claim the slot |
| Committed | Removed from active list; Added count | Optional View in Store View |
| Every detected candidate committed; inputs terminal; no processing/review/removed/false-detection remainder; commands idle; online/focused | No active cards; closing/closed announcement | Invoke version-fenced v3 Close once |
| Partial success, session still active | Added rows absent from cards; failed/uncommitted cards remain editable | Retry individual Add or open Summary for warned manual Close |
| Partial success, session manually closed | Added inventory unchanged; uncommitted candidates retained as read-only history | No mutation; a new scan is required to revisit those books |
| `owner_removed_from_scan` or false | Removed from active list; separate summary count | None |

## 9. Migration current-to-target matrix

| Delta | Current after M54 | Verification |
| --- | --- | --- |
| Session lifecycle command fence | `phase9_update_candidate_review_v2`, `phase9_add_candidate_to_inventory_v1`, and `phase9_owner_remove_candidate_v1` share one active/unexpired session lock fence after completed replay | closing/closed/expired/past-expiry zero-effect PGlite plus connected closed-candidate proof |
| Non-mutable action projection | final detail/batch projections retain only read-only actions; nested variant actions empty | structural assertions, PGlite projection proof, live function readback |
| Compatibility boundary | public signatures/grants and active behavior preserved; older sibling correction/variant lifecycle behavior unchanged | related contract regression and explicit residual review |

| Area | Current | Unit 6G target | Compatibility rule |
| --- | --- | --- | --- |
| `default_condition` | Historical M02 column was `NOT NULL`; v2 summary decoder requires one of five values | nullable for Unit 6G sessions | Retained M52 makes it nullable; existing non-null rows remain valid, v3 exposes null, and legacy v2 fails closed rather than coercing. |
| Session price | Historically absent from M02 sessions | nullable `default_price_minor`, integer `0..2147483647` | Retained M52 supplies the resumable field; existing sessions read null and no inventory backfill occurred. |
| Batch label | Historically absent from M02 sessions | nullable safe text `1..80` `batch_label` | Retained M52 supplies the session-only resumable field. |
| Candidate disposition | Historical M02 CHECK allowed null/`reviewed`/`skipped_false_detection` | exact `owner_removed_from_scan` | Retained M52 supplies the category-4 lifecycle, predicate, revision, worker, readiness, and commit fences with no row inference/backfill. |
| Close summary/Close mutation | M29 helper/v2 Close has no owner-removed count | strict summary/readiness v3 and `close_scan_session_v3` / `phase9_close_session_v3` with `ownerRemovedCandidates` | Retained M52 supplies v3; existing v2 remains unchanged and Unit 6G uses v3 consistently. |
| Close audit | Session records `closed_at` but the deployed v3 Close has no dedicated close business event/audit | one exact-replay-safe audit/event records authenticated actor, store/session, manual versus all-committed automatic source, command/idempotency identity, versions, and server time | Forward migration required; client telemetry is not actor authority and historical closes are not backfilled or guessed. |
| Legacy candidate mutations | Manual-candidate, skip/false-detection, and variant decision/replacement siblings do not all enforce active plus unexpired session state | shared lifecycle fence matching final Save/Add/Remove | Forward migration required; preserve exact replay, signatures, grants, ownership, fixed search paths, and active-session behavior. |
| Removal mutation/audit | Historically no general candidate-removal RPC or event | U6G-C02, exact `phase9.candidate.owner_removed_from_scan`, version/replay/presentation fences | Retained M52 supplies the controlled RPC/helper/registry/audit boundary; server-derived Owner/store; no delete cascade. |
| RPC ownership/grants | M29 functions use fixed search path and narrow authenticated grants | new start/read/batch/remove/Close v3 functions follow the same pattern | Internal helpers revoke PUBLIC/anon/authenticated; public Owner RPCs revoke PUBLIC/anon and grant EXECUTE only to `authenticated`; direct tables remain denied. |
| Card page | small summary, paged | bounded review aggregate | existing cross-session page remains entry/recovery compatibility |
| Review Save | existing strict v2 | reused | hidden notes round-trip; no duplicate field restored |
| Commit | existing M39 v1 | reused | no batch array/RPC, no M39 edit |
| Currency | no session/inventory currency discriminator | fixed INR presentation | No migration; static UI policy over existing integer minor-unit price. |
| Quantity | M02 already has `default_quantity=1`; strict review and M39 already support per-card quantity | fixed 1 pre-scan, editable after scan | No migration; caller still cannot set setup quantity and M39 keeps `q/q/0/0/0`. |
| `store_inventory` / Unit 7C | existing fields and M43–M46 commands own post-commit values | unchanged | No migration and no Unit 7C command/table change. |
| Store View cache | post-commit cache independent | invalidate/coalesce `storeViewKeys.all` after canonical success | Application-only; no migration/RPC lifecycle change. |

The retained M52 classification is category 4 because the new disposition changes
lifecycle/readiness/count/audit/security behavior. Nullable condition plus
durable price/batch label is the category 3 session component. Strict DTOs,
source badges, metadata action semantics, one-slot orchestration, currency,
quantity UI, and Store View invalidation are application/Edge work unless they
participate in the explicitly versioned RPC response above. The composition
correction requires no new migration. Any independently proven schema defect is
reported for separate authority rather than repaired here.

## 10. Acceptance-to-work-unit map

| Work unit | Primary acceptance | Required independent review |
| --- | --- | --- |
| 6G-A — RETAINED contract/red tests | U6G-AC01–AC18, AC20–AC21 contract foundation | architecture, strict DTO/source/metadata semantics, lifecycle, migration-design, security; no redesign |
| 6G-B — RETAINED M52 DB/Edge | U6G-AC01–AC05, AC11–AC18, AC20–AC21, AC30 contract portion | exact retained SQL/function/grant/Close/concurrency and connected readback; no replacement migration |
| NEW 6G-C — recomposed pre-commit experience | U6G-AC01–AC09, AC15–AC16, AC19–AC23, AC25–AC33 plus inherited Unit 6 rows below | mounted production-route lifecycle composition, mobile UX, identity/cache, accessibility, privacy, performance; no Add/Add-all commit orchestration |
| NEW 6G-D — commit orchestration | U6G-AC10–AC14, AC17–AC19, AC24 plus the narrow U6-AC40 supersession | idempotency/concurrency, exact-N/max-three, M39 noninterference, Unit 7A/7C handoff, canonical cache/Store View invalidation |
| 6G-E — closure | U6G-AC01–AC34 and inherited closure evidence below | exact Edge deploy/readback, connected web/native whole-route, accessibility/performance, rollout/provenance |

### 10.1 Predecessor-inheritance acceptance ownership

This ledger is identical in arithmetic and disposition to SDD §2.1: 30
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

## 11. Mandatory red/full integration and release groups

### 11.1 NEW 6G-C mounted production-route composition

The RED/FULL group exercises the currently mounted production route, not an
isolated legacy progress component or isolated Unit 6G component, in two
literal scenarios.

**Scenario A — success/candidate arrival:**

```text
Start v2
-> choose ONE image
-> preview
-> private upload
-> registration
-> zero candidates initially
-> Unit 6 input processing visible
-> sanitation/vision continue
-> candidates up to the 15-card cap arrive automatically without unrelated navigation/refetch
-> metadata enrichment updates the candidate
-> foreground refresh
-> reconnect refresh
-> app/page reload
-> active-session Resume
-> compact review remains functional
-> full correction remains reachable
-> v3 readiness
-> v3 Close
```

**Scenario B — pre-lineage failure/recovery:**

```text
Start/Resume
-> ONE current input
-> sanitation/vision/input terminal failure before candidate lineage
-> exact bounded reason/guidance
-> deliberate remove/replacement where Unit 6 permits
-> choose replacement image
-> registration
-> processing resumes
```

Separate cases prove active zero-input Resume; ambiguous Start replay with the
same logical identity; logout/account/store cancellation and cleanup including
every new 6G root; stale draft compare/Reapply; and false-detection, variant,
and missed-book reachability. Old Unit 6 tests alone and isolated Unit 6G tests
alone are insufficient because the mounted route must prove composition.

**Inherited Unit 6 over-limit case:**

```text
ONE image containing >15 detected books
-> existing P9_VISION_OVER_LIMIT
-> zero candidates
-> bounded failure guidance
-> Unit 6 replacement/recovery remains reachable
-> replacement image containing 1..15 books continues normally
```

This case is not a multi-image test and retains no candidates from the failed
over-limit input. It introduces no selection rule, pagination, or append-image
behavior. A separate unsupported-historical-overflow case proves fail-closed/
non-normal routing, no silent truncation, no hidden candidate treated as
reviewed, and no new pagination.

### 11.2 6G-E exact Edge deployment cutover

No live client verification using `phase9-owner-batch-review-v1` may be PASS
until the exact reviewed Owner Edge bundle is deployed and read back with all
five actions:

- `start_scan_session_v2`;
- `read_scan_session_v3`;
- `read_scan_batch_review`;
- `remove_candidate_from_scan`; and
- `close_scan_session_v3`.

Local source existence, M52 application, and a successful client build are not
Edge deployment evidence.

## 12. Draft approval boundary

Approval must explicitly cover:

1. nullable pre-scan condition and price;
2. fixed INR/whole-rupee presentation over minor-unit storage;
3. session-only durable batch label;
4. one-page all-fields compact card design for one current image and 0..15
   cards, with no append-image flow or normal-scan pagination;
5. Add/Add all as combined explicit Save-then-commit actions;
6. client orchestration over independent M39 commits with concurrency three;
7. one active command per candidate, with Add all skipping/reporting Busy;
8. the exact `owner_removed_from_scan` disposition, v3 Close count, and no Undo;
9. the existing `manual` metadata transition for Use detected details;
10. strict nested DTO/privacy bounds and canonical source-badge mapping; and
11. no automatic publication or Unit 7C redesign;
12. Unit 6 lifecycle ownership and one-current-input/zero-input recovery;
13. stable semantic Start identity and generation fencing;
14. compact-primary/full-correction reachability with distinct false/Remove;
15. consistent v3 Unit 6G routing and same-work-unit identity cleanup; and
16. mandatory mounted-route composition plus exact Edge readback gates; and
17. fail-closed unsupported historical overflow without new legacy pagination.

The former requirement for complete historical `>15` traversal/pagination is
removed. The exact next action is Owner checkpoint disposition of this corrected
single-image authority and its unchanged Unit 6 over-limit behavior; its
independent final review is COMPLETE (verdict PASS_WITH_P3). Candidate-limit
UX optimization is deferred to a separate later
work unit/design decision. NEW 6G-C's composition-only UI checkpoint is locally
implemented and pending Owner review; it remains uncommitted and undeployed.
