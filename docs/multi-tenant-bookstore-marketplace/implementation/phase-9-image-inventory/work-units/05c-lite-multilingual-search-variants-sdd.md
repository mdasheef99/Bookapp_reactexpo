# Phase 9 Unit 5C Lite: Model-Assisted Multilingual Search Variants

**Status:** approved target design; Units 5C-1 through 5C-4 merged/live-verified; exceptional Owner decisions and benchmark/rollout backend next; visual UI not started
**Decision date:** 2026-07-29
**Scope:** Unit 5C specification only
**Supersedes:** the previously governing selected-language and post-metadata English-alias method

## 1. Decision

Unit 5C Lite preserves confirmed original-language bibliographic fields and
adds bounded, store-scoped linguistic search variants without turning model or
provider text into identity authority.

The target flow is:

```text
vision extraction preserves observed original title/author
  -> optional versioned variant sidecar proposes bounded linguistic forms
  -> Unit 5A/5B resolves metadata when possible
  -> Owner or trusted evidence confirms title and author independently
  -> deterministic Unit 5C reconciliation validates each proposal
  -> only active store-scoped variants become searchable
  -> later inventory/publication units retain their existing gates
```

This decision remains the behavior authority; implementation status is recorded
below and in the routed evidence trackers.

**Implementation checkpoint (2026-07-29):** Unit 5C-1 now implements the
optional provider-neutral sidecar contract, observation-qualified title/author
source association, strict validation, deterministic comparison/deduplication,
and sanitized fixture handoff. Unit 5C-2 adds private
`phase9_search_variant_proposals` persistence plus token/attempt-fenced
service-only read/write RPCs. M18 is live once as `20260729004216`; its bounded
M19 accepted-envelope replay fence is live once as `20260729020008`; rows enter
only as `proposed` and `search_eligible=false`. Active Gemini generation,
`p9-vision-v2`, M01 aliases, activation/lifecycle commands, search, and UI
remain unchanged.

## 2. Current runtime versus approved target

Current runtime remains unchanged:

- sessions require a selected language and default to English;
- mismatched or unknown-language observations are retained as evidence but do
  not become candidates;
- `p9-vision-v2` is a strict closed contract;
- `book_search_aliases` is live with its M01 target/source/status vocabulary;
- Unit 5B is fixture/mock verified only and performs no Roman-query fallback;
- no Unit 5C generation, activation, or search-projection runtime exists;
  Unit 5C-2 private proposal persistence and replay fencing are live.

Approved target:

- auto-detection is the default and language controls are optional hints;
- title and each author carry their own BCP 47 language and ISO 15924 script;
- confirmed original-language fields remain primary;
- title and author confirmation is independent;
- `search_variant_proposals_v1` is an optional sidecar associated with the same
  analysis, not an unversioned field added to `p9-vision-v2`;
- model proposals are provisional and non-searchable until reconciled;
- deterministic search keys and linguistic variants are separate;
- only active, store-scoped variants participate in search;
- metadata failure still permits an Owner-confirmed store record with a nullable
  canonical link;
- public publication continues to require a positive selling price.

Unit 5C-2 reconciles the provisional persistence delta through a separate
private companion table while preserving the live M01 alias representation.
Activation, stale propagation, alias/search projection, and UI still require
separate authorization.

## 3. Original-field authority

Preserve separately:

- original title and optional subtitle;
- original author names;
- field-level language;
- field-level script;
- observed source and confirmed source;
- confirmation actor/method and timestamp.

Confirmed original title and author values are the primary bibliographic and
display values. Romanizations, translations, provider spellings, common names,
and alternate author forms are separate variants. They never silently replace
confirmed original text and never establish canonical identity or duplicate
evidence.

Title and author confirmation are independent. A title proposal cannot activate
until its exact source title is confirmed. An author proposal cannot activate
until its exact source author is confirmed. Candidate approval alone does not
approve every field.

Initial variant targets are `title` and `author`. Subtitle, series, publisher,
and other targets require separate authority.

## 4. Language and script

Auto-detection is the target default. An optional scan hint or store common-
language preference guides analysis but never forces every spine or field into
one language.

Target evaluation order:

1. per-field detected language and script;
2. optional scan-session language hint;
3. optional store common-language preference;
4. unrestricted auto-detection.

The model may report `matched`, `mixed`, `different`, or `uncertain`. A mixed-
language spine can retain a title in one script and an author in another.
Language uses BCP 47 and script uses ISO 15924; a combined tag such as
`mni-Mtei` must not be stored as though it were only a language code.

No new store-language or scan-language UI is authorized by Unit 5C Lite.

## 5. Optional vision companion

`p9-vision-v2` remains the current strict canonical result. The target adds an
independently versioned optional companion associated by the same opaque
analysis identity:

```json
{
  "sidecar_version": "search_variant_proposals_v1",
  "analysis_reference": "opaque-analysis-reference",
  "title": {},
  "authors": []
}
```

A missing, invalid, timed-out, or rejected sidecar cannot invalidate valid
title, author, ISBN clue, language/script, geometry, confidence, or ordinary
Unit 4B processing. The sidecar is optional enrichment and has no tool,
database, provider-query, inventory, or publication authority.

For each eligible confirmed-source field, the initial Gemini call may propose:

- one primary plain Roman form;
- zero to two optional common Roman spellings;
- at most one separately typed English translation candidate.

No proposal is required. Routine Owner correction does not trigger another
model call; later regeneration would be an explicit, separately metered action.

## 6. Search keys and linguistic variants

Deterministic search keys are implementation representations such as Unicode,
whitespace, punctuation, case, diacritic, initial, and safe equivalent-character
normalization. They are not aliases, require no approval, and should normally be
derived at query/index time rather than stored as variant rows.

Linguistic variants include transliteration, a practical plain Roman form,
common Roman spelling, translation candidate, recognized title, pen name, or a
materially different author-name form. They require provenance, target,
language, script, lifecycle, scope, and activation rules.

When confirmed source text is already predominantly Latin script, do not create
a duplicate Romanization. Use deterministic normalization unless a materially
different, evidence-backed linguistic form improves discovery. Romanization is
optional.

Translation and transliteration are distinct. Translation candidates remain
inactive by default and are never labelled official without trusted evidence.

## 7. Lifecycle and reconciliation

Target lifecycle:

```text
proposed -> active
proposed -> rejected
active -> stale
stale -> active only after fresh reconciliation/approval
```

The later persistence design may map this target lifecycle onto the live M01
`proposed|approved|rejected` representation, but this documentation session
does not invent or apply a migration. Search eligibility always means active
under the target contract; rejected or stale variants are excluded.

Normalization-only source changes—such as whitespace, safe punctuation, or
case differences—may retain a proposal when normalized source identity is
unchanged. A material title/author text, language, script, or target change
makes dependent proposals stale and non-searchable until reconciled.

Owner correction never silently rewrites source linkage. Each retained proposal
must still refer to the confirmed field text from which it was derived.

## 8. Automatic activation

Activation is field-specific. A conservative primary plain Roman proposal may
activate automatically only when all of the following hold:

- its exact source field is confirmed;
- normalized observed source equals normalized confirmed source;
- source text is not predominantly Latin;
- the exact language/model/prompt/schema/benchmark combination is enabled;
- output is predominantly Latin, bounded, structurally valid, and non-identical;
- it represents only the confirmed field;
- it adds no edition, volume, absent subtitle, publisher, category,
  description, or marketing text;
- it is not a translation;
- it does not duplicate or conflict with an existing active/trusted variant;
- its target and store scope are valid.

Model confidence is supporting evidence only. Failure of any condition leaves
the proposal inactive and requiring approval.

Owner-approved and trusted variants follow the same source/target/scope
validation. One approval cannot activate unrelated title and author proposals.

## 9. Language enablement and evidence

Initial benchmark candidates are English, Kannada, Tamil, Telugu, Malayalam,
and Hindi. English and already-Latin fields primarily use deterministic keys.
Other supported languages are experimental and cannot auto-activate until
explicitly enabled.

Urdu requires a separate right-to-left, Perso-Arabic, mixed-direction, Roman
Urdu, and fixture gate.

Each production language requires at least 100 representative spine instances
covering orientation, typography, damage, mixed scripts, multi-book images,
occlusion, glare/blur, and ISBN presence/absence. Record model, prompt, schema,
dataset, sample count, accuracy/usefulness, unsafe invention, correction,
rejection, search-success results, decision, approver, and date.

Enablement is reversible per language for vision, Romanization, and automatic
activation independently. Monitor Owner correction/rejection, unreadable and
wrong-language outcomes, metadata no-match, zero-result searches, and
alias-assisted search success.

## 10. Scope and search authority

Unit 5C Lite variants are store-scoped. An active variant improves discovery
only for the associated store listing. It does not become a platform-wide
canonical alias.

Before inventory/listing exists, a proposal may remain associated with the
private confirmed candidate or inventory draft and transfer only through the
later controlled inventory/publication workflow. Global canonical promotion
requires a separately authorized catalogue-governance process.

Only active variants enter later search indexing. Alias hits display confirmed
original title and author as primary values; an approved Roman form may appear
secondarily. Source text already in Latin script is displayed once.

## 11. Metadata-independent fallback

Metadata resolution may be `not_attempted`, `no_match`, `ambiguous`,
`material_conflict`, `temporarily_unavailable`, `policy_denied`,
`owner_resolved`, or `canonical_linked`.

Failure or ambiguity does not block an Owner-confirmed store record. Such a
record keeps a nullable canonical-edition link, confirmed original title,
confirmed author when available, language/script, store ownership, and normal
later review/publication eligibility. It never creates shared canonical truth.

Later publication requires confirmed title, confirmed/accepted language, store,
positive selling price, and availability. Author is optional. The existing
positive-price contract is unchanged; price-on-request is excluded.

Public display prioritizes original title and author, followed by approved
plain Roman variants when available. Do not force Romanization, translation,
provider-only titles, or speculative English titles. Private spine scans never
become public product images; use a placeholder or separately approved public
media.

## 12. Unit boundaries

Unit 5C Lite includes companion-contract design, validation, reconciliation,
lifecycle, language enablement, store scope, active-only search contract, and
exceptional approval contract.

It excludes provider HTTP calls, Roman-query Google Books execution, secondary
providers, UI implementation, migrations, inventory commit, public projection,
search indexing, canonical promotion, repeated Gemini calls, credentials,
deployment, and commerce changes.

Roman-query metadata fallback belongs to a separately authorized Unit 5B
extension. That future extension may use at most two distinct logical metadata
query plans for a newly encountered candidate. Cache hits and safely coalesced
followers consume no new query plan; transport retries of the identical query
remain the same plan. All egress continues through Unit 5B attempt, reservation,
cost, cache, coalescing, fencing, ranking, and finalization controls.

## 13. Later implementation slices

Separately authorize and review:

1. companion contract and recorded fixtures;
2. validation and field-level reconciliation;
3. persistence and lifecycle mapping;
4. language enablement and benchmark evidence;
5. active-only search integration;
6. exceptional Owner-review integration.

Current runtime remains authoritative until each affected implementation seam
is separately changed and verified.
