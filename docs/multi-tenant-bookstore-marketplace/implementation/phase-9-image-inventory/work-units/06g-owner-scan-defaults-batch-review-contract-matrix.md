# Phase 9 Unit 6G Contract and Screen Matrix

**Status:** `group1_contract_persistence_locally_implemented_supporting_authority`
**Date:** 2026-08-21
**Owner:** [Unit 6G SDD](./06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md)

This matrix makes Unit 6G implementation-reviewable. Group 1 contract/
persistence implementation is locally complete on the approved branch; M52 is
not applied. Groups 2–4, deployment, and live mutation remain separately
gated. Root specifications and the SDD outrank this matrix.

## 1. Pre-scan setup matrix

| Field | Control and exact choices | Required to Start | Canonical request/storage | Card inheritance | Validation/error |
| --- | --- | --- | --- | --- | --- |
| Location | Select-or-enter; one `Batch location` value | Yes | `location` / `default_location`, Unicode NFC, 1..120 | Every unsaved card uses it; post-scan `Use batch location` or Custom | Focus field; “Choose or enter a location.” No hidden `default` string |
| Language | Searchable language dropdown; English initially selected | Effective value yes; Owner interaction no | `languageHint='en'` initially / `selected_language` | Fallback only. Valid detected language wins and is marked Detected | Canonical BCP 47, 2..35; never rejects a differently detected valid language |
| Condition | `Not set`, New, Like New, Very Good, Good, Acceptable | No | `condition:null|new|like_new|very_good|good|acceptable` / nullable `default_condition` | Value when set; otherwise card Missing | Exact enum; accessible condition help |
| Selling price | Not set, preset values, Custom | No | `priceMinor:null|safe integer` / `default_price_minor` | Value when set; otherwise card Missing | Whole rupees only; exact x100 conversion; private permits explicit zero, publish does not |
| Quantity | Read-only display “1 per detected book” or omitted from edit controls | Server fixed | Not caller-authoritative; `default_quantity=1` | Every unsaved card starts at 1 | No pre-scan quantity request field |
| Publication intent | Private / Prepare to publish later | Effective value yes | `publication:private|publish` / `default_publication` | Inherited unless overridden | Copy states that Add still creates private inventory |
| Batch label | Optional bounded input | No | `batchLabel:null|string` / `batch_label` | No per-card or inventory inheritance | trim+NFC, 1..80 when present; plain text; private/telemetry-forbidden |
| Currency | Static `INR (₹)` | Fixed | No request/database currency field | All Unit 6G prices | No selector and no paise field |
| Script | No control | No | Existing nullable derived field | Detected/saved value | Not guessed from English fallback alone |

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

## 2. Session review page matrix

| Region | Content | Server source | Local state | Actions and gates |
| --- | --- | --- | --- | --- |
| Header | Batch label when present; capture/session status | Batch aggregate | Expansion only | Back uses dirty/busy guard |
| Summary | Ready, Processing, Needs attention, Added | Aggregate states plus mounted draft validation for Ready | Current mounted draft fingerprints | Counts announced on meaningful changes only |
| Bulk action | `Add all ready books (N)` | Candidate capabilities/versions plus strict-valid current drafts | Frozen run membership/results and shared per-candidate command slots | Visible when N>0; online/current authority; one confirmation for N>1; already locked cards are skipped and reported Busy, never queued |
| Input progress | Existing checking/finding/ready/failed presentation | Session/input queries or aggregate summary | None | Existing input remove/replacement rules unchanged |
| Card list | At most 15 stable-ordinal compact cards | Batch aggregate | Per-card mounted draft/command reducer | FlatList virtualization, no expanded metadata mount |
| Footer | Add missed, Summary/Close | Existing allowed actions/readiness | None | Close never commits/removes/discards |

## 3. Card field matrix

| Field | Display | Editor | Draft source precedence | Required before Add | Source badge |
| --- | --- | --- | --- | --- | --- |
| Cover | 56–72 px bounded thumbnail/placeholder | None | selected metadata/observed allowlisted reference → missing | No | Detected or Missing; internal `matched` is displayed as Detected; never scan image |
| Title | Full screen-reader value; visually bounded lines | Plain text inline/manual | saved custom → selected metadata/observed → missing | Yes | Custom, Detected, or Missing |
| Authors | Ordered accessible list; “Author unknown” allowed | Simple ordered fields/add/remove | saved custom → selected metadata/observed → missing | Decision required; empty confirmed array permitted | Custom, Detected, or Missing |
| Metadata status | Matched/Manual/No match/Pending/Needs attention | Metadata sheet | current metadata state/revision | Terminal selected/manual path | State label only; not a field-source badge |
| Language | Canonical language label/code | Searchable dropdown | saved custom → selected metadata/observed → session hint → missing | Yes | Custom/Detected/Default/Missing |
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
| Remove from this scan | Any uncommitted candidate; not already false/removed; command slot idle | Required | Claims the shared slot, calls U6G-C02, and leaves only after canonical success; busy reports without a request |
| Add to inventory | Draft complete, online, current/refetchable authority, not busy | Action itself confirms displayed values | Strict Save then canonical M39 commit; success leaves list |
| Retry | Prior retryable save/commit failure | No new business confirmation if fingerprint unchanged | Reuses same identity only for the same ambiguous command; otherwise new deliberate attempt |

No `Choose another match`, duplicate action, separate Save, separate Submit,
Undo, or automatic commit action is rendered.

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
forbidden. One session has at most 15 candidate positions, so the aggregate is
bounded and not paginated.

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
tight numeric cap: SQL emits plain `count(*)` totals, legacy multi-image
sessions legitimately exceed 15 in lifetime totals such as `imagesSubmitted`
or `committedInventoryItems`, and any value above 2^53-1 fails closed at the
decoder instead of silently losing precision. Only per-card ordinals,
card arrays, and aggregate item lists remain bounded by the 15-candidate cap.
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
  title: SafeText[1..512]
  authors: UniqueSafeText[1..20] each [1..256]
  language: CanonicalBcp47[2..35]
  coverReference: ApprovedCoverReference[1..512] | null
}
```

`metadataSummary` is non-null only for a current complete `selected` metadata
snapshot; otherwise it is null and `metadataState` carries the exact existing
state. `ApprovedCoverReference` is HTTPS, host exactly `books.google.com`, has
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

| Internal source | Visible badge | Canonical meaning |
| --- | --- | --- |
| `matched` | Detected | Current selected metadata/identity match; never a separate visible Matched source badge |
| `detected` | Detected | Current bounded observed identity |
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
same canonical post-close snapshot. The one new summary field is the bounded
count; Close returns no removed-candidate list or private/raw details. Legacy
v2 callers never receive an unknown key or null-incompatible condition; a v2
call against a Unit 6G nullable session fails closed and the client uses v3.

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
   (SDD §17). Groups 2–4 should ship promptly after M52 application to keep
   the mixed-version window short.

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
| Store View invalidation failure | Inventory success remains; bounded refetch warning/retry | Never roll back/repeat commit |

## 7. Cache synchronization matrix

| Event | Required cache effect |
| --- | --- |
| Session start | discovery + new session summary/aggregate |
| Review Save | exact candidate detail + aggregate item; invalidate session candidate/readiness/discovery scopes |
| Owner removal | remove from aggregate after canonical response; invalidate candidate pages, readiness, discovery, session summary |
| Close v3 success | replace session/readiness v3 from canonical response; invalidate aggregate/session discovery; preserve v2 cache keys as separate contract data |
| Per-card commit success | exact candidate/detail/readiness/discovery/session plus legacy Owner inventory reads and `storeViewKeys.all` |
| Bulk commit success set | per-candidate canonical updates; coalesce session/discovery/readiness and one Store View all invalidation after run |
| Reconnect/foreground | refetch session aggregate before enabling mutations; no local result overwrites a newer aggregate revision |
| Identity/store/logout change | cancel/fence requests and clear all private image-inventory and Store View caches for the prior identity |

## 8. Screen-state mapping

| Server/draft condition | Card presentation | Allowed primary action |
| --- | --- | --- |
| Candidate or metadata nonterminal | Processing | None; secondary Remove when server allows |
| Reviewable + current draft strict-valid | Ready | Add to inventory |
| Saved `reviewReady=true` + `add_to_inventory` | Ready | Add to inventory (commit directly after authority check) |
| Missing condition/price/location/language/title/damage answer | Needs attention | Edit exact field |
| Failed metadata with observed/manual path available | Needs attention | Edit manually then Add |
| Stale aggregate/revisions | Updating authority / Needs attention | Refetch, compare, Reapply |
| Offline | May be out of date | No mutation |
| Save/commit/removal in flight | Busy with exact stage | No duplicate action/navigation without guard; Add all reports Busy if it cannot claim the slot |
| Committed | Removed from active list; Added count | Optional View in Store View |
| `owner_removed_from_scan` or false | Removed from active list; separate summary count | None |

## 9. Migration current-to-target matrix

| Area | Current | Unit 6G target | Compatibility rule |
| --- | --- | --- | --- |
| `default_condition` | M02 column is `NOT NULL`; v2 summary decoder requires one of five values | nullable for Unit 6G sessions | Forward migration required. Existing non-null rows remain valid; v3 summary/Close exposes null. Legacy v2 response shape is unchanged and fails closed rather than coercing a nullable Unit 6G session. |
| Session price | absent from M02 sessions | nullable `default_price_minor`, integer `0..2147483647` | Forward session-column migration required for resume; existing sessions read null; no inventory backfill. |
| Batch label | absent from M02 sessions | nullable safe text `1..80` `batch_label` | Forward session-column migration required for resume; existing sessions read null; session-only. |
| Candidate disposition | M02 CHECK permits null/`reviewed`/`skipped_false_detection` only | add exact `owner_removed_from_scan` | Forward category-4 lifecycle migration; no existing-row inference/backfill. Active/review/readiness/commit/action/worker predicates update together. |
| Close summary/Close mutation | M29 helper/v2 Close has no owner-removed count | add strict summary/readiness v3 and `close_scan_session_v3` / `phase9_close_session_v3` with `ownerRemovedCandidates` | Existing v2 helper/RPC/strict response remains unchanged; Unit 6G uses v3. |
| Removal mutation/audit | no general candidate-removal RPC or event | U6G-C02, exact `phase9.candidate.owner_removed_from_scan`, version/replay/presentation fences | New controlled RPC/helper/registry/audit changes; server-derived Owner/store; no delete cascade. |
| RPC ownership/grants | M29 functions use fixed search path and narrow authenticated grants | new start/read/batch/remove/Close v3 functions follow the same pattern | Internal helpers revoke PUBLIC/anon/authenticated; public Owner RPCs revoke PUBLIC/anon and grant EXECUTE only to `authenticated`; direct tables remain denied. |
| Card page | small summary, paged | bounded review aggregate | existing cross-session page remains entry/recovery compatibility |
| Review Save | existing strict v2 | reused | hidden notes round-trip; no duplicate field restored |
| Commit | existing M39 v1 | reused | no batch array/RPC, no M39 edit |
| Currency | no session/inventory currency discriminator | fixed INR presentation | No migration; static UI policy over existing integer minor-unit price. |
| Quantity | M02 already has `default_quantity=1`; strict review and M39 already support per-card quantity | fixed 1 pre-scan, editable after scan | No migration; caller still cannot set setup quantity and M39 keeps `q/q/0/0/0`. |
| `store_inventory` / Unit 7C | existing fields and M43–M46 commands own post-commit values | unchanged | No migration and no Unit 7C command/table change. |
| Store View cache | post-commit cache independent | invalidate/coalesce `storeViewKeys.all` after canonical success | Application-only; no migration/RPC lifecycle change. |

Overall classification is category 4 because the new disposition changes
lifecycle/readiness/count/audit/security behavior. Nullable condition plus
durable price/batch label is the category 3 session component. Strict DTOs,
source badges, metadata action semantics, one-slot orchestration, currency,
quantity UI, and Store View invalidation are application/Edge work unless they
participate in the explicitly versioned RPC response above. No migration is
created or applied by this draft.

## 10. Acceptance-to-work-unit map

| Work unit | Primary acceptance | Required independent review |
| --- | --- | --- |
| 6G-A contract/red tests | AC01–AC18, AC20–AC21 | architecture, strict DTO/source/metadata semantics, lifecycle, migration-design, security |
| 6G-B DB/Edge | AC01–AC05, AC11–AC18, AC20–AC21 | exact SQL/function/grant/Close/concurrency and current-data review |
| 6G-C UI | AC01–AC09, AC19, AC22–AC23 | mobile UX, accessibility, privacy, performance |
| 6G-D coordinator/cache | AC10–AC14, AC17–AC19, AC24 | idempotency/concurrency, Unit 7A/7C handoff, cache review |
| 6G-E closure | AC01–AC24 | adversarial exact-project, authenticated Owner, native quality, continuity |

## 11. Draft approval boundary

Approval must explicitly cover:

1. nullable pre-scan condition and price;
2. fixed INR/whole-rupee presentation over minor-unit storage;
3. session-only durable batch label;
4. one-page all-fields compact card design;
5. Add/Add all as combined explicit Save-then-commit actions;
6. client orchestration over independent M39 commits with concurrency three;
7. one active command per candidate, with Add all skipping/reporting Busy;
8. the exact `owner_removed_from_scan` disposition, v3 Close count, and no Undo;
9. the existing `manual` metadata transition for Use detected details;
10. strict nested DTO/privacy bounds and canonical source-badge mapping; and
11. no automatic publication or Unit 7C redesign.

Until then, the exact next action is review/correction of this documentation
only.
