# Post-Scan Rework — Slice 8 Open Library First and Replaceable Providers

| | |
|---|---|
| **Status** | **Pass-2 design draft, 2026-10-30; NOT IMPLEMENTED.** Owner authorized these documents only. Every proposed behavior below needs design approval and separately authorized build packages. |
| **Parent** | [SDD-2 Slice 8](./02-catalogue-and-matching-sdd.md#slice-8--open-library-first-clues-google-off); [SDD-0](./00-overview-sdd.md) §§4–7/14–15. Detailed slice-8 contracts/ACs are owned here; genre transport is gated by OQ8-7. OD-1–4 govern split, rollback and D30 placement; migration-rule amendments remain unapproved (OQ8-5). |
| **Authority** | [OD-2026-10-30-1–3](../../../../DECISIONS.md#log); PSR-D22/D25/D27–D29/D31–D40, R04–R10/R12; master SDD §3 MAS-02/03/10/13–17; DOC-3 §5.2/§5.2.1; DOC-1 §13. |
| **Baseline** | Local checkout `C:\Users\user\Desktop\Bookconnect-main`, branch `phase9/slice8-providers`, code baseline `c93e628` recorded for the initial draft. Evidence is local source, not live readback or a fresh Git-status claim. [ACTIVE](../../../ACTIVE.md) records slice 7b-2 closeout; its dated deployment observations are not reverified here. |
| **Migration** | Proposed responsibility split in §4.4; filenames/numbers unassigned. No SQL file created, edited or applied. R06: forward replacements only. |
| **Size / risk** | Large / high: routing, physical receipts, retention, shared admission and old/new worker compatibility. 8a is too large for one reviewable migration; proposed subpackages require Owner approval (§10/§12). |
| **Review** | Complex SDD; Terra round-3 findings addressed as design corrections/questions, not implementation proof or approval. SDD-0 §15 required review/operational gates remain open. |

All sections headed **Design** and all NEW names are proposals, not implemented
behavior. Current-behavior claims point to inspected `file:line` evidence in §2.
Paths use repository root; `I/` = `supabase/functions/_shared/imageInventory/`,
`W/` = `workers/phase9-metadata-worker/`, `DB/` = `supabase/migrations/`,
`T/` = `supabase/functions/__tests__/`, `P/` = `supabase/tests/phase9/`.
Migration aliases in §2.1 are exact local files, never live-version assertions.

## Contents

1. Goal, inherited decisions and boundaries
2. Verified evidence, flows and provider inventory
3. Design — provider replacement contract
4. Design — 8a database generalization
5. Design — 8b compatible worker
6. Design — benchmark and equivalence
7. Design — 8c switch, recovery and rollback
8. Design — security and tenant isolation
9. Acceptance checks and red-first proof
10. Build packages and review stops
11. Read-only build preflight and documentation matrix
12. Owner questions and conflicts

## 1. Goal, inherited decisions and boundaries

**Design goal:** catalogue/local resolution first, then one configured Open
Library automatic primary; Google disabled for automatic **and** explicit use,
installed for a separately approved future choice (D25/D32, OD-1).

**Names:** 8a-1…5 are proposed subpackages of database part 8a, not extra
approved slices. P0…P4 and OQ-P1 are local to 02d; AC8 checks belong here,
ACP checks there. Q5 = cross-instance pacing; Q18 = second-provider reuse rights;
Q19 = per-store provider choice (SDD-0 §14). “Drain” uses activation appendix §2's row classes.

| Inherited authority | Consequence in this design |
|---|---|
| OD-1; D32; MAS-13; DOC-3 §5.2 | Installed providers switch through registry values. A new provider requires its adapter, reviewed validator migration and registry row; no new canonical/candidate/inventory schema or provider-name workflow lists. Limits are explicit in §3.3. |
| OD-2 | **8a database**, **8b worker**, **8c switch**. 8b deploys with Google still automatic-primary. This replaces the stage-1 audit's conflicting part labels. |
| OD-3 | The **8b worker** is the rollback floor after 8c; Google stays disabled. Drop AC8-10's old-Google-primary-worker-after-disable row. |
| D27/D28 | Checksum-valid scanned ISBN enables direct transport; publisher is a loose ranking signal only, never a query/eligibility filter. Full relaxed matching/tie-pick is slice 9. |
| D22/D29, SDD-0 §5 | Own Open Library edition cover or placeholder; no Google fallback, scan-photo cover, next page, even provider split, or cross-provider stitching. |
| D33–D40; 02a §6.1; 02b §§1/3/5–10/14 | Keep companion, identity/conflict, count, scan-origin privacy, expiry, receipt, no-update and cache invariants. Replace admission's OL allow-list only after parity and negative proof. |
| OD-4/D30 | [02d](./02d-edition-sheet-prefill-sdd.md) owns automatic-result sheet persistence after 8b and before slice 9; it is separately built. |

**Included:** provider configuration/validation, automatic OL, clue transport,
Owner-gated subjects→genres, bounded fan-out/accounting, queue fairness, pacing/caps/breaker,
offline comparison, compatible rollout and switch runbook.
**Excluded:** slice 9 relaxed automatic rules/full tie picker, paid-provider
integration, per-store provider choice (Q19), canonical refresh/overwrite/reset,
fuzzy merge, model changes, Add/publication redesign and operational work here.
Author-name caching and automatic full-list cache reuse are **recommended deferrals**
(OQ8-9/10); neither is an OL-first build dependency. Existing explicit cache behavior
and automatic local/selected-snapshot reuse remain as built.
Source: SDD-2 Slices 8–9; SDD-0 §§5/11/14; 02b §14 settled OQ1–8.

## 2. Verified evidence, flows and provider inventory

### 2.1 SQL evidence keys

| Key | Exact file under DB/ and inspected responsibility |
|---|---|
| M01 | `20260722000001_marketplace_phase9_catalogue_metadata_expand.sql`:4–24 registry/seed; :34–48 source provider CHECK removal/FK; :147–150 RLS/grants. |
| M15 | `20260728000015_marketplace_phase9_metadata_foundation.sql`:195–224 claim ordering/leases. |
| M32 | `20260807000032_marketplace_phase9_structural_metadata_integration.sql`:68–87 original identity; :89–130 enqueue. Identity is superseded by M55. |
| M54 | `20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql`:12–32 Owner active-session FOR UPDATE lock. |
| M55 | `20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql`:9–34 current automatic query identity. |
| M61 | `20260913000061_marketplace_phase9_representative_edition_cover.sql`:14–17/138–152 Google-only persistent cover CHECKs; :45–64 writer; :125–147 public boundary. |
| M62 | `20260913000062_marketplace_phase9_representative_cover_detail_projection.sql`:7–36 detail fallback reader. |
| M65 | `20261007000065_marketplace_phase9_edition_picker_state.sql`:91–122 private edition state, FKs, ≤24h deadline, RLS/revocations. |
| M68 | `20261007000068_marketplace_phase9_edition_picker_worker_completion.sql`:15–48 normalized validator; :370–407 single-call registration; :496–524 original automatic-payload guard. |
| M73 | `20261011000073_marketplace_phase9_open_library_edition_options.sql`:6–10 OL seed; :12–88 metadata/row validation; :287–355 lookup/attempt/usage; :581–690 fallback/fan-out receipts; :790–820 summary cover rules. |
| M75 | `20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql`:24–56 choices; :82–130 explicit request/freshness/idempotency. |
| M78 | `20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql`:38–78 context; :223–280 fan-out register; :407–413 current physical-call stage CHECK. |
| M81 | `20261025000081_marketplace_phase9_catalogue_link_at_add.sql`:124–154 old OL-only Add admission; superseded by M83/M84. |
| M83 | `20261026000083_marketplace_phase9_lean_catalogue_identity.sql`:129–179 shared admission/source policy/facts validator; :1355–1357 OL note. |
| M84 | `20261027000084_marketplace_phase9_catalogue_companions_completion.sql`:106–214 current provider validator; :217–231 chosen-companion reader; :937–977 Select; :1564–1596 current recovery. |
| M85 | `20261028000085_marketplace_phase9_catalogue_cache_schema.sql`:10–71 pure cache validation; :178–203 current source policy; :205–252 legacy-cache discrimination. |
| M86 | `20261028000086_marketplace_phase9_catalogue_cache_scope_publication.sql`:184–412 current v2 completion, including :251–328 row/provider/receipt checks and :383–405 transactional completion. |
| M87 | `20261028000087_marketplace_phase9_catalogue_cache_reuse.sql`:7 reuse core; :219/:256 service/public entries. |
| M88 | `20261029000088_marketplace_phase9_catalogue_cache_hardening.sql`:6–143 current cache publication; :39–50 primary/version guards, :55–114 privacy/deadlines/key, :123–138 post-lock expiry and winner receipt. |

### 2.2 Current flows and costs (code paths, not measured traffic)

| Path | Verified sequence and physical-call upper bound |
|---|---|
| Automatic | Vision observations → metadata job (M32:89–130) → claim/context (`W/index.ts:88–92,178–183`) → bootstrap Google (`W/bootstrap.ts:34–46`) → local → legacy cache → coalescing → reserve → primary sequence 1 → egress → finalize → selection/manual (`I/runtime/metadataProductionComposition.ts:158–305`; `metadataProductionGateway.ts:71–182,245–309`). One adapter invocation; one Google fetch in the success path (`I/metadata/googleBooks/adapter.ts:106–143`). No automatic secondary is wired. |
| Explicit | Search Books → request/read/Select UI (`src/features/imageInventory/components/CandidateEditionPicker.tsx:78–113`) → edition job/context → `editionProviderRoute` → recovery → typed cache → policy/reserve/attempt → provider/fallback → completion v2 (`W/index.ts:92–149`; `I/runtime/metadataEditionOptions.ts:26–173`; `metadataEditionOptionsRpc.ts:56–94`). Cache hit: zero GETs. OL: search (1) + edition(s) (1) + authors (0–4) = ≤6 provider GETs. Google→OL: 1 + ≤6 = ≤7 provider GETs, not accounting RPCs (`I/metadata/openLibrary/adapter.ts:31–105`). One reservation is passed to the secondary; writes are enumerated in §4.2 (`metadataEditionOptions.ts:81–124`; `metadataEditionProviderCalls.ts:77–95`). |
| Explicit choice retention | State is private, max ten rows/24h (M65:91–122); read freshness uses identity/deadline/source policy (M75:29–35; M85:180–200). Completion rows/companions/effects/accounting/cache are atomic (M86:251–405). A chosen snapshot survives alternatives expiry (02a §6; M75:36–43). |
| Actual policy choice | Helper initially reads `providerPolicies[0]` (`I/runtime/metadataGatewayContext.ts:131`), but real worker replaces it with key+version `.find()` (`W/index.ts:115–127`). OL-only explicit route is available when Google options retention is unconfigured (`W/editionProviderRoute.ts:9–23`; `I/metadata/googleBooks/adapter.ts:47`; `W/bootstrap.ts:34–45`). |

### 2.3 Clue survival and drops

| Clue | Current evidence | Design destination (§5) |
|---|---|---|
| Title/authors | Context rebuild preserves all authors; Google wire sends only author[0]; OL joins authors (`I/runtime/metadataGatewayContext.ts:119–125`; `I/metadata/googleBooks/request.ts:17–22`; `I/metadata/openLibrary/adapter.ts:44–46`). | Keep original normalized key/order and all supplied authors for validation. |
| Publisher | Context folds it into `editionClues`; Google scores editionStatement/series/volume/format, not actual publisher (`metadataGatewayContext.ts:125`; `I/metadata/googleBooks/ranking.ts:33–64`). OL keeps first actual publisher for display, never queries it (`I/metadata/openLibrary/normalizer.ts:67–84`; adapter:42–46). | Compare real publisher loosely as a signal; absent/different publisher never rejects. |
| Language | Present in query and OL allocation/eligibility; absent from Google/OL wire parameters (`request.ts:17–30`; OL adapter:42–46; normalizer:103–113). | Preserve known/unknown language semantics; ranking signal, no query filter that removes display alternatives. |
| ISBN | Query builder validates checksum and chooses bibliographic mode whenever title **or** author exists (`I/metadata/queryIdentity.ts:49–69`); Google ISBN only when title and first-author are both absent (`request.ts:17–22`); OL ISBN parameter only without title (adapter:46). | Transport may choose validated ISBN independently of stable identity strategy; no ISBN assumption for spines. |
| Script | Context has script (M78:73), request builder omits it (`metadataGatewayContext.ts:119–126`). | No script-based identity relaxation or new language rollout in slice 8. |

### 2.4 Full provider-name inventory, grouped by replacement

This is an inventory of semantic fences, including repeated homes, not a claim
that the context pack's grouped **104** rows are 104 independent edits. Every
named SQL function below must be dispositioned; superseded historical bodies
are evidence only. Adding a grep exemption must name its adapter/policy purpose.

| Group / current homes (`file:line`) | Design replacement / owning part |
|---|---|
| Types `W/bootstrap.ts:15–20`, construction :22–48, service wiring :50–70; `W/index.ts:2–3,26–28` | Installed manifest keyed by adapter/version; automatic and explicit roles from registry / 8b. |
| Explicit routing/resume: `W/editionProviderRoute.ts:9–23` (`instanceof`, both literals, OL `1.0.0`) | Purpose-aware registry route; pin resumed identity, never relabel / 8b. |
| Purpose dispatch/policy/configuration: `W/index.ts:92–150`; `I/runtime/metadataGatewayContext.ts:99–147` | Same route resolver for both purposes, exact versioned policy / 8b. |
| Automatic primary-only ports: `I/runtime/metadataProductionComposition.ts:109–125,208–240`; `metadataProductionGateway.ts:63–64,167–182,245–270` | Declared call protocol and bounded primary/optional secondary execution, generic receipts / 8b; SQL support / 8a. |
| Explicit class-specific fencing/fallback/finalization: `I/runtime/metadataEditionOptions.ts:2–13,28,86–124` | Adapter descriptor declares single/fan-out protocol, retention, hooks; no provider-class inference / 8b. |
| OL policy/fallback literals: `I/runtime/metadataEditionProviderCalls.ts:7–9,23–31,77–95` | Selected descriptor/key/version for hooks and secondary, generic failure type / 8b. |
| Google module: `I/metadata/googleBooks/index.ts:4–23`, `request.ts:3–30`, `adapter.ts:44–102`, `decoder.ts:11–15,87,141`, `ranking.ts:47–121`, `editionOptions.ts:29,86–98,106–123` | Retain provider identity/endpoint/decoder/host rules in its adapter. Move provider-independent eligibility/retention helpers out of Google-owned module; no behavior change / 8b. |
| Barrel export: `I/metadata/index.ts:8` exports `./googleBooks`; route imports adapter directly (`W/editionProviderRoute.ts:1–3`) | No route election through this barrel found; leave export untouched / 8b. |
| OL module: `I/metadata/openLibrary/index.ts:2–7` spreads `GOOGLE_BOOKS_CAPABILITY` at :5; `adapter.ts:13–18,32–46,52–105`, `normalizer.ts:11–19,55–85,128–145`, `transport.ts:18–20,43,89–122`, `catalogueWrite.ts:18–44` | Replace the spread with independent explicit OL v1/v2 declarations; retain own formats/URLs/extraction; v2 automatic adapter/general hooks / 8b. |
| RPC serializer/parser: `I/runtime/metadataEditionOptionsRpc.ts:1–97` | No provider literal found; retain strict existing explicit receipt parser; add a separate automatic parser/port (§4.3), never feed it a list-less receipt / 8b. |
| Owner/server book URL pair: `I/contracts/ownerEditionPicker.ts:47–54`; client `src/features/imageInventory/contracts/ownerEditionPicker.ts:46–53` | One-time generic presentation boundary, §3.3 / 8b proposal gated OQ8-2. Retain legacy wire key. |
| Owner/server cover pair: `I/contracts/ownerMetadataSnapshot.ts:12–15`, `ownerBatchReviewResponses.ts:29–32`; client `contracts/ownerBatchReviewContracts.ts:68–71`, `ownerUxCandidateSchemas.ts:44–50` (under `src/features/imageInventory/`) | Same reviewed presentation policy; no arbitrary-URL widening / 8b, OQ8-2. |
| Provider label/cache behavior: `src/features/imageInventory/components/EditionOptionList.tsx:42–66`, `MetadataCover.tsx:16` | Registry-derived trusted display label/image-cache permission projected by server; no host-to-provider ternary / 8b, OQ8-2. |
| Registry seed/policy | M01:4–24/147–150, M73:6–10, M83:1355–1357 → additive capabilities and explicit transition data / 8a; route switch data / 8c. |
| Pure metadata/row allow-lists and URLs | `phase9_edition_valid_metadata` (M73:12–61), `phase9_edition_valid_rows` (M73:63–88), normalized wrapper (M68:15–48) → fixed per-provider pure validators/static dispatcher / 8a. |
| Source/read admission | `phase9_edition_source_policy` (M85:180–200), `phase9_edition_worker_context` (M78:38–78) → purpose capability plus existing lineage/cache proof / 8a. |
| Lookup/attempt lists and pairing | `phase9_register_structural_metadata_lookup` (M73:287–307), `phase9_register_structural_metadata_attempt` (:309–330), `phase9_reserve_metadata_usage` (:332–355) → installed contract + purpose/role/version policy / 8a. |
| Single/fan-out calls | `phase9_register_metadata_provider_call` (M68:370–407), `phase9_register_edition_options_provider_call_v1` (M78:223–280), `phase9_finish_edition_primary_for_fallback_v1` (M73:581–610), `phase9_finalize_edition_options_provider_call_v1` (:655–677) → generic scope/sequence/policy plus provider protocol validation / 8a. |
| Physical-call table CHECK | `phase9_metadata_provider_calls.phase9_edition_http_stage`: introduced M73:507–515; latest replacement M78:407–413 allows search/edition(s)/`author:OL…A` only; no later replacement found locally → forward common shape CHECK plus provider-specific stage/ID validation, including v2 `isbn` / 8a. |
| Catalogue admission/validator | `phase9_catalogue_shared_admitted_v1` (M83:129–137) → capability; `phase9_catalogue_provider_ids_valid_v1` (M84:106–214) → static dispatch to provider-owned facts/receipt validators; predecessor pairing moves into generic role proof / 8a. |
| Summary/representative covers | `phase9_unit6g_metadata_summary` (M73:790–837); `phase9_owner_ux_with_representative_cover` (M62:7–36); `phase9_set_inventory_representative_cover` (`DB/20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql`:235–264); private/public writer (M61:45/125); M61 CHECKs above → legacy-only CHECKs retained, writes/read fallback/new Add gated as §4.2 / 8a/8c. |
| Completion/recovery **current**, not old literal bodies | `phase9_complete_candidate_edition_options_v2` (M86:184–412), v1 delegate (M84), `phase9_recover_candidate_edition_options_v1` (M84:1564–1596) → audit calls to generalized validators/policy; keep signatures, receipt-first recovery, role/tenant proof / 8a. |
| Catalogue/cache consumers, indirect restrictions | M84:217–231 companion reader; M83:138–148 source-policy builder; M84 Add/Select/helper, M85:10–71 cache validator, M87:7/219 reuse, M88:6–143 publication → parity audit under new capability/version policy; no duplicate provider allow-lists / 8a. |
| Automatic identity and claim scheduling | M55:9–34 identity remains; M15:195–224 claim is global due-time/ID ordered, no per-store fairness → forward claim/cap boundary for D31 / 8a; worker uses it / 8b. |
| Configuration outside pack's worker folder | `workers/phase9-runtime/environment.ts:76–79,227–245` only real mode `google_books`, Google key required → provider-neutral installed-adapter boot and optional credentials when disabled / 8b. |
| Worker setup documentation: `W/README.md:29–35` requires Google real mode/key/timeouts | Update prepared-provider setup in 8b and registry switch/rollback instructions in 8c; retain conditional Google setup, never remove its adapter / 8b/8c. |
| Worker/edge tests and seeds | `T/phase9_metadata_worker.test.ts:55,188`, `phase9_open_library_worker.test.ts:16,92`; `P/editionPickerFixture.mjs:61,109–126`, `openLibraryPostgresFixture.mjs:7,21–30,55`, `editionOptionsCompletionFixture.mjs:38,50–58` → parameterized descriptors/registry, preserve provider-specific fixtures / 8a/8b. |
| Regression families (paths searched locally) | `T/phase9_metadata_*`, `phase9_open_library_*`, `phase9_google_books_*`, `phase9_catalogue_*`, `phase9_owner_isbn_worker`; `P/phase9Edition*`, `phase9OpenLibrary*`, `phase9LeanCatalogue*`, `phase9Catalogue*`, `phase9OwnerIsbn*`; migration guards and app edition/cover/contract tests → add synthetic provider and transition cases, do not delete Google regressions / 8a/8b. |

Historical Phase 9 provider literals occur in M65/66/67/68/69/71/73/74/78/81/
83/84/85; forward replacements above use the **latest** bodies, including
M84 recovery, M85 source policy, M86 completion and M88 publication. M61's
cover-only fence is an additional current home. M01's provider seed is separate.
Non-Phase-9 Clubs/Library/legacy `google_books_id` and wishlist schemas are outside
this change; M01:34–48 already drops the old source-table provider-name CHECK.

### 2.5 Context-pack verification and corrections

| Spot-check | Result against opened source |
|---|---|
| bootstrap Google primary / OL fallback / no secondary | Confirmed `W/bootstrap.ts:34–46`. |
| route `instanceof` and resumed provider literals | Confirmed `W/editionProviderRoute.ts:9–23`. |
| edition-only routing and real key/version policy override | Confirmed `W/index.ts:92,101,115–127`; helper-first-row is not actual final policy. |
| automatic OL guard | Confirmed `I/metadata/openLibrary/adapter.ts:17–18`. |
| OL limit/parameters/ISBN condition | Confirmed adapter:42–46; no publisher/language query parameter. |
| OL six-call/four-author bound | Confirmed adapter:32,88–105. |
| OL own facts/first publisher/own cover | Confirmed normalizer:55–85; publisher is retained, only additional publisher values are dropped. |
| Google title/first-author/ISBN fallback | Confirmed request:17–22; ISBN requires no title **and** no author. |
| Google publisher scoring gap | Confirmed ranking:33–64; actual publisher not scored. |
| OL `instanceof` receipt path and literal fallback | Confirmed `metadataEditionOptions.ts:86–124`, `metadataEditionProviderCalls.ts:23,83–90`. |
| M01/M73 registry rows | Confirmed M01:20–24 data-derived legacy-v1 seed, **enabled defaults false** (:8); M73:9 disabled OL/raw retention 0. No live row inferred. |
| M73 metadata cover regex / edition rows | Metadata regex confirmed :55–57. **Correction to Part A.7:** rows are not shape/count only: :79–82 calls metadata validator and checks book-URL pair. |
| M83 allow-list / M84 accounting pairing / M85 cache source policy | Confirmed M83:129–147; M84:146–197; M85:180–200. M85's named pair is the external-source branch, cache-hit admission is separate. |
| Reported ISBN identity mismatch | **Historical, not current SQL:** M55:9–34 supersedes M32:68–87 and agrees with TS bibliographic precedence (`queryIdentity.ts:57–60`). Keep regression, do not “fix” from M32. |
| Explicit request bumps generation | **Correction to Part B flow:** M75:119–125 creates request ID/clears options without incrementing generation. Identity reset owns generation; request ID and generation are distinct fences. |
| Provider-agnostic app claim | **Incomplete:** client/server URL pairs and UI attribution/cache rule remain; exact evidence in §2.4. |

**Provider-only privacy evidence:** `P/phase9LeanCatalogueCachePrivacy.integration.test.mjs:13-45`
constructs scan/typed/confirmed/edited/unknown, not a distinct provider-only origin.
Tracker 38:2069-2077 records the duplicate/undefined producer as UNPROVEN.
M86:7-47 requires immutable scan proof for public scope and defaults other origins
private. OQ8-11 recommends preserving that rule and deferring only the unproved case.

## 3. Design — provider replacement contract (OD-1)

### 3.1 Registry policy versus installed implementation

Proposed additive registry dictionary (NEW; absent configuration denies new
v2 egress, not legacy calls). Operator row updates use separately authorized
configuration transactions; only migrations install validator/host contracts.

| Registry value / type and bounds | Meaning and default |
|---|---|
| `automatic_lookup_allowed`, `explicit_search_allowed`, `shared_catalogue_allowed`: boolean NOT NULL DEFAULT false | Independent permissions plus existing enabled/matching/storage/display checks; Google permanently vetoed in code (§4.2). |
| `automatic_role`, `explicit_role`: nullable enum primary/secondary | At most one enabled eligible role of each kind per purpose; null when purpose permission false. Manual is no provider. |
| `automatic_order`, `explicit_order`: nullable smallint 1…2 | Primary=1, secondary=2, null iff role null; duplicate active roles/order refuse with `P9_PROVIDER_ROUTE_INVALID`. MAS-14 bounds route to two. |
| `accepted_adapter_versions`: text[] 0…8 unique entries, each safe ASCII identifier 1…64 | Default []; active configured row requires 1…8 including active version. Historical entry authorizes validation only, never new attempt or revoked reuse. |
| `version_contracts`: jsonb ≤8 entries keyed by accepted version | Exact entry `{validationContract,hostPolicyVersion,capabilityVersion,normalizerVersion,payloadSchemaVersion,lookupSchemaVersion}`, identifiers 1…128. Payload schema validates metadata; lookup schema binds lookup/attempt/cache columns/keys. Never substitute one for the other. |
| `validation_contract`, `host_policy_version`: identifier 1…128 or null | Active-version aliases of `version_contracts`; must agree. Fixed dispatcher IDs, never SQL names/imports. Initial IDs: `google-books-v1`, `open-library-v1`, `open-library-v2`; host IDs `google-books-hosts-v1`, `open-library-hosts-v1`. |
| `approved_request_hosts`, `approved_book_hosts`, `approved_cover_hosts`: text[] DEFAULT '{}', ≤8 each | Unique lowercase DNS names ≤253, no wildcard/IP/port/path; compiled HTTPS/path policy intersection. Registry cannot widen trust; unknown host fails closed. |
| `options_retention_seconds`: nullable integer 1…86400; `display_label`: safe text 1…80 or null | Deadline is minimum of verified evidence/current policy; a number never grants retention. No credentials/private licence text. Existing raw/revalidation/attribution/image-cache/note fields retained. |
| `protection_policy`: nullable exact-key jsonb | `{version:'p9-protection-v1',minIntervalMs,storeWindowSeconds,storeMaxGets,backoffBaseMs,backoffMaxMs,breakerFailures,breakerWindowSeconds,breakerCooldownMs,halfOpenMax:1,mode:'single_instance'\|'shared_db',contactId}`. Positive safe integers ≤2^31−1, base≤max; contactId safe 1…64 resolves server config, never an email/secret in shared output. Initial values/mode/fairness mechanism require OQ8-1/3. |

Installed code declares immutable key/version, automatic/explicit methods,
single-call/fan-out protocol, stages/max calls, allowed outcomes, ID/work grammar,
host/path/redirect validators, schema/normalizer/capability versions, retention
verifier and credentials readiness. SQL per-provider validators implement the
corresponding pure facts/receipt rules. Generic code checks the intersection of
installed support and current registry permission (MAS-02/13/14, DOC-1 §13).

**Field-level reuse restriction (design; DOC-1 §13:318–326):** first implementation
admits only an installed permission profile covering **every retained field for
each operation actually performed**. Provider provenance is separate from permission.
No general per-field redaction/permission engine is proposed here; mixed-rights
providers require Q18 review/extension before new retention, sharing or presentation.
The reviewed install record lists each field separately with `matchingOnly`,
`storageAllowed`, `publicDisplayAllowed`, `imageCachingAllowed`,
`attributionRequired`, expiry/revalidation policy and authority reference.
This is an audited full-field profile, not a provenance-derived grant or a new
runtime per-field projection engine; an incomplete profile denies the operation.

| OL retained fields → recorded permission profile | DOC-1 policy applied separately from provenance |
|---|---|
| title/subtitle/authors/language/script, publisher/date, editionStatement/series/volume/format/pageCount, ISBNs/categories/description | Reviewed `ol-retained-fields-v1` profile records matching, normalized storage and public-display permission, required attribution and expiry/revalidation for **each named field**. Blank/unknown permission denies that operation; no grant inferred from receiving data. Genres remain OQ8-7. |
| Own cover URL | Same explicit field profile for matching/storage/display of the reference; image-cache permission remains false, so no binary cover download/cache. Display does not grant image caching. |
| Work/edition IDs, OCLC/LCCN | Field profile covers normalized permanent shared cross-references under D35; own-record validators and independent Google veto still apply. |
| Confidence/rationale, request/correlation/attempt IDs and receipts | Private provenance/decision evidence only; no public fact/cache projection, no licence inferred from lineage. Raw JSON/headers remain unretained under current OL raw policy. |

Record the reviewed field profile/authority/version in the install manifest and
preflight; intersect existing registry flags/deadlines at each operation. SQL
dispatch accepts only the installed full-field profile and cannot enable a mixed-
rights provider by a permissive row. OL permission documentation must be read back
before build; absent evidence is a stop, not an assertion that permission exists.
Google's existing private automatic path is preserved without expanding permission;
new Google retained lists still require an independent verifier. AC8-9a's synthetic
provider uses test-only permission for every fixture field; production admission is Q18.

### 3.2 Routing and adding a provider

- Resolve local first; use cache/coalescing only through its proved purpose contract.
- `resolveProviderRoute` (§5.1) intersects the registry snapshot and installed manifest.
  Exactly one primary/zero-or-one secondary; no primary returns manual, invalid order
  returns `P9_PROVIDER_ROUTE_INVALID` without egress.
- Lookup/attempt columns pin adapter/version/policy. Resume those columns; policy
  denial terminalizes safely and never relabels an old receipt.
- Each `beforeRequest` rechecks claim/policy; coherent primary ends routing.
- Secondary registration requires the persisted allowlisted predecessor outcome;
  policy/quota/input/auth denials never authorize fallback.
- Add provider: install adapter/fixtures/**manifest entry as part of the adapter deliverable**, then validator/dispatcher migration, then
  disabled/default-false row. Q18 rights precede shared enablement. AC8-9a freezes
  generic definitions; AC8-9b additionally gates third-host client activation.

Source: DOC-3 §5.2; MAS-13–17; SDD-2 Slice 8 validation/accounting and AC8-9.

### 3.3 Limits to “registry values only”

**Design promise:** switching already installed, tested versions with provisioned
credentials, permitted data use and compatible client support changes registry
values only, through §7's drain/readback. It needs no source edit/redeploy.
Adding a provider still installs code, validator dispatch and credentials; new
protocols outside the common contract require a reviewed contract extension.
Mixed field-rights providers also require a reviewed extension/Q18; this first
contract supports approved full-field reuse profiles, not arbitrary rights models.
A capability does not grant licensing, create a Google retention verifier, add
host trust, bypass expiry or authorize a second provider's canonical facts.
**Limit:** full third-provider replacement is not established while OQ8-2's
presentation work is unapproved/unproved. AC8-9a can pass for the backend;
AC8-9b and full OD-1 acceptance cannot. An OL-only 8c does not require 9b;
activation of a third host does require approved/built OQ8-2 and 9b.

**Presentation gap (OQ8-2):** §2.4 proves a third host currently fails both Edge
and app validators and is labelled Google by the UI. Proposed one-time 8b change:
versioned opt-in read presentation policy (safe adapter label, validated book/cover
hosts and image-cache permission), emitted only by the trusted server after
installed-validator + registry checks. Keep immutable metadata/row keys and
`googleBooksUrl`; descriptors are read projection, never copied into shared facts.
Clients validate bounded HTTPS URLs against this server policy, reject credentials,
ports/unsafe destinations, use its attribution and keep unknown-policy covers as
placeholders. Legacy clients keep their existing Google/OL projection; third-host
activation requires compatible client rollout, with a safe unsupported-result
projection that preserves ordinal and exposes no unsafe URL. Do not silently
relax Zod to arbitrary HTTPS. Proposed opt-in contract, conditional on OQ8-2:

| Presentation contract | Proposed exact boundary |
|---|---|
| Negotiation | NEW opt-in header `x-bookconnect-provider-presentation: p9-provider-presentation-v1` (allowlisted in CORS by approved package); absent/unknown value gets legacy DTO. Response adds `presentation` only for exact token; existing x-client-info/rejection-reason negotiation unchanged. No stored metadata/row extension. |
| Policy DTO | `{version:'p9-provider-presentation-v1',policies:[{adapterKey,adapterVersion,policyVersion,label,bookHosts,coverHosts,imageCacheAllowed,attributionRequired,expiresAt}],rowBindings:[{optionId,policyIndex}],suggestionBinding:{selectionId,policyIndex}\|null}`; ≤8 unique policy key/version pairs, ≤10 unique row bindings; indices 0…7 must exist. Safe key/version ≤64, label ≤80, positive safe policyVersion; hosts as §3.1, deadline ≤response time+24h/current source permission. |
| Binding/validation | Server binds private metadata key/version to policy, validates installed facts/paths then projects safe DTO. Owner snapshots omit adapter identity (`I/contracts/ownerMetadataSnapshot.ts:26–42`), so client binds by exact optionId/selectionId, not nonexistent metadata keys. Strict-parse version/keys/bounds/deadline and unique complete bindings before links/images; policies never authorize writes/SQL admission. |
| Unsupported/expired/missing policy | Third-provider row remains at its ordinal/UUID as `unavailable`, metadata/URL null; third-provider current suggestion projects absent; cover placeholder. Legacy Google/OL projection uses existing validators and chosen snapshots remain stored unchanged. No false Google attribution. |
| Untrusted/forged input | Never accept a client-supplied policy; reject extra keys, private/local/IP hosts, credentials, ports, unsafe paths, version mismatches or expired policy before rendering links/images. Server adapter validator still owns ID/path grammar; app receives only already validated links. |
| Proof | Paired server/app supported/legacy/expired/forged/unknown-version fixtures plus current suggestion/cover projection. This one-time boundary is frozen before a third provider; later additions only add adapter/validator/row. |

## 4. Design — 8a database generalization

### 4.1 Transition policy and compatible context

**Manifest schema (design):** record every §3.1 field, existing registry permission,
active/accepted versions, contract tuple and protection policy, plus worker artifact,
credential/verifier readiness and hash. Store reviewed before/transition/final/rollback
JSON in the future rollout evidence. No unfilled field permits deployment.

| Stage / provider | enabled; auto role/order; explicit role/order; shared | Active / accepted / validator / host contract |
|---|---|---|
| 8a→8b Google | live enabled unchanged; true primary/1; false null/null for inspected no-verifier deployment; false | `G / [G] / google-books-v1 / google-books-hosts-v1` |
| 8a→8b OL | live enabled unchanged; false null/null; true primary/1; true | `1.0.0 / [1.0.0] / open-library-v1 / open-library-hosts-v1` |
| 8c Google | false; false null/null; false null/null; false | G and its accepted tuple retained for old saved lineage only |
| 8c OL | true; true primary/1; true primary/1; true | `2.0.0 / [1.0.0,2.0.0] / open-library-v2 / open-library-hosts-v1`; v1 retains its own validator tuple |
| Rollback to 8b, Google off | Google as final; OL final tuple/explicit primary retained; automatic false/null for prefill rollback or unsafe OL, otherwise final OL primary | No downgrade of active/accepted tuples; 8b must already support both. Rollback is worker/config recovery, not v1 relabelling. |
| Other rows at all stages | All NEW capabilities false; roles/orders null | No newly accepted versions/hosts or enablement |

`G` is preflight's actual Google version and must match the installed descriptor
(`1.0.0` in `I/metadata/googleBooks/index.ts:4–8`); mismatch stops the package.
Google request/book/cover hosts = `[www.googleapis.com]` / `[books.google.com]` /
`[books.google.com]`; OL = `[openlibrary.org]` / `[openlibrary.org]` /
`[covers.openlibrary.org]`, intersected with compiled paths. Labels Google Books /
Open Library; options bound 86400 only when independently verified. Populate exact
existing v1 tuple from the artifact: normalizer=`p9-bibliographic-normalizer-v1`,
**payloadSchemaVersion=`p9-metadata-v1`** (`I/contracts/versions.ts:3`),
**lookupSchemaVersion=`p9-metadata-foundation-v1`** (`W/index.ts:132`;
`I/runtime/metadataGatewayContext.ts:68–73`). Existing lookup/attempt/cache
`schema_version` and CacheVersions wire key `schemaVersion` mean the latter;
metadata's own `schemaVersion` means the former. Capabilities Google=`google-books-capability-v1`,
OL=`open-library-capability-v1` (`I/metadata/googleBooks/index.ts:4–23`;
`openLibrary/index.ts:4–7`, `normalizer.ts:129`). Any mismatch stops, not silently
“preserved”. V2 capability=`open-library-capability-v2`, same normalizer/**both schemas** unless an
approved OQ8-6/7 change requires an explicitly versioned tuple. Record every tuple,
never derive v1 validation from active v2. Protection values await OQ8-1/3.

Do not seed a fabricated Google version: M01's row is data-derived and M73's OL
seed is disabled (§2.1). Build preflight must resolve actual versions/flags.
If actual live state differs from this compatibility assumption, stop for review.
The OL explicit primary above is a **new registry representation** of the observed
route, not preservation of a nonexistent role column (`W/editionProviderRoute.ts:9–23`).
A different live route/verifier/permission baseline stops for manifest review;
permission alone never assigns Google an explicit route.

**Context compatibility:** the old decoder rejects unknown policy keys
(`I/runtime/metadataJobContext.ts:110–122`). Keep current RPC/DTO exact for old
workers; add a NEW service-only provider-configuration read/versioned context
extension for 8b. Do not append capabilities to the old array indiscriminately.
Same signatures/delegates and omitted-companion handling remain callable (R06).

**8a invariant:** add fields with §3.1 defaults, then populate only NEW fields
from the reviewed transition manifest. Do not change any existing row's
`enabled`, `adapter_version`, `policy_version`, matching/storage/display/retention
values during any 8a subpackage. M85:188–200 and M87:55–59 join active version and
`policy_version::text=reuse_policy_version`; the old worker selects exact key/version
(`W/index.ts:115–127`). Legacy RPCs therefore retain legacy policy semantics;
new version/purpose checks belong to v2 entrypoints until 8b is deployed.
After **each** partial 8a step, execute old-worker context→route→completion/cache
fixtures proving Google automatic and OL explicit unchanged. Any policy/version
bump is an 8c transaction with invalidation/readback evidence, never an 8a default.

### 4.2 Validation and function dispositions

| Responsibility | Proposed forward change; existing evidence is §2.4 |
|---|---|
| Interim 8a-1 → 8a-2 | 8a-1 installs the independent Google veto **first**, but retains M83's OL allow-list in admission/source-policy bodies and leaves old fields/DTOs unchanged. New capability data cannot widen admission. 8a-2 installs provider/profile validators, then atomically replaces the interim list with capability + veto + installed full-field profile. No 8a-1 call references an 8a-2 function; test both states with all-permissive Google and old-worker controls. |
| Pure validation | Keep metadata/rows/cache CHECK functions IMMUTABLE. Separate common shape/size/ordinal/UUID checks from fixed dispatch to NEW provider facts/URL validators. Register/version/purpose policy is STABLE in a separate boundary, never read from a CHECK. Unknown provider refuses. |
| Provider validators | NEW OL v1/v2 and Google facts/call-contract functions in 8a-2; independent veto already exists from 8a-1. Dispatcher literals stay only in this boundary. Preserve v1 grammars/receipts and distinct payload/lookup schema checks. Provider migration adds validator/profile + dispatcher entry, no generic workflow edit. |
| Physical-call stage CHECK | Forward-replace M78:407–413, never edit M73/M78. Keep paired-null/sequence shape and receipts compatible; enforce provider-stage/ID grammar against locked attempt/version at registration/completion, not relation reads in CHECK. OL v1 remains valid; v2 isbn sequence 0 is reserved but **denied until OQ8-6/fixtures approved**, with bounded author/redirect sequence then. Foreign/unknown stages/IDs/ISBN refuse; synthetic stages need no OL names. |
| Roles/predecessor | Move Google-primary/OL-secondary pairing out of M84's OL branch; generic code proves configured route, actual predecessor/role/sequence/outcome and tenant/claim relation. Provider validator checks only its own receipt grammar/stages/budgets. |
| Catalogue admission | Replace M83's OL allow-list with **both** `shared_catalogue_allowed` and the independent code veto below, retaining metadata-kind, enabled/matching/storage/public display, accepted-version, note, policy and retention. `phase9_catalogue_source_policy_v1` still locks registry FOR SHARE and passes trusted `sharedAdmitted`; no worker boolean. |
| Add/Select/identity/cache | Audit latest Add/helper/Select and 02a §6.1 dependencies; use matching metadata/attempt/registry accepted version rather than active-version literal. Preserve exact one pair/NULL pair, no-update/conflict rollback, ISBN/blocklist/hidden policy, count-once and source deadlines. Cache publication/reuse consume admission, never infer it from storage. |
| Read source policy/context | Replace remaining pair lists in M85/M78 with purpose-specific capability and current policy; cache-hit still requires same-store private receipt and zero egress. Catalogue/local results use their own validated source proof, never invented provider receipts. |
| Registration/usage/fallback | Replace all §2.4 lookup/attempt/reservation/call fences forward. Common layer proves current claim/query/store, role/sequence/predecessor and reservation; descriptor validator proves physical protocol. Existing wrappers/ACLs remain. |
| Completion/recovery | Latest v1 delegate/v2 and M84 recovery retain original completed receipts, slim recovery, exact digest and no re-fetch after uncertain commit. Do not restore M73/M78 obsolete completion bodies. |
| Cover display | Selected own-record cover uses pure installed rules. Legacy representative writer/read/trigger use the separate active-source gate below; Google-only representative CHECKs remain unchanged as a legacy feature. No alternate-cover fact enters a selected snapshot/canonical URL. |

**Database Google veto (D35/R05):** M83:132 currently excludes Google in code;
capability-only admission would lose that exclusion. Propose one IMMUTABLE,
code-owned `phase9_provider_permanent_reuse_allowed_v1(key text,version text)`
predicate (Google always false), separate from private-lookup facts validation.
Bind the actual selected source/attempt, not a fallback lookup's primary or its URL. Even all-permissive
registry values or a forged admitted policy cannot enable Google canonical/source/
provider-ID writes, shared counts, public cache or edition-list cache in either
scope, or a new Google-sourced Add link. Permitted private lookup/selection and
legacy private selected-snapshot caching survive; Add succeeds unlinked. Existing
snapshots/inventory links are not reset. M84:191–206, M85:52–64, M86:334–357 and
M88:14–30 explain why shape validity and the trusted policy alone are insufficient.

| Forward target (private schema unless public wrapper noted) | Bound source / required veto; AC8-12 subcase |
|---|---|
| `phase9_catalogue_shared_admitted_v1`, version-aware `phase9_catalogue_source_policy_v2` | Locked registry key + lineage version; predicate AND capability, never caller's sharedAdmitted / A admission. Existing v1 delegates active version. |
| `phase9_catalogue_resolve_v1(p_metadata,p_companion,p_source_policy)` | Parsed metadata key/version equals companion and policy; independent predicate before canonical/provider-ID/source writes, including forged policy / B resolver. |
| `phase9_complete_candidate_edition_options_v2`, NEW automatic completion | Each row's key/version equals its locked actual attempt; veto **shared sub-operations/count attribution** only. Valid private Google completion survives; OL secondary behind Google remains independently admissible / C completion. |
| `phase9_catalogue_choice_target_v1`, `phase9_edition_legacy_select_candidate` | Chosen metadata + accepted companion/source attempt, before resolving/counting; Google selection remains private / D Select. |
| `phase9_catalogue_link_for_add_v1`, public `phase9_add_candidate_to_inventory_v1` | Re-prove chosen metadata/source key/version before **any** saved-ID hint (M84:705–832) or new resolver call. Google yields NULL/NULL; Add stays valid/unlinked with no shared added count / E Add. |
| `phase9_catalogue_valid_cache_v1(p_payload)` | Every non-null row's metadata key/version; pure veto for edition-list payload in either scope / F payload. |
| `phase9_catalogue_store_cache_v1(p_lookup_id,p_source_policy)` (M88:6) | Lookup + `outcome_source_attempt_id` key/version + all rows agree; predicate before winner/effect early returns and publication; retain primary-only guard / G publication. |
| `phase9_catalogue_reuse_cache_core_v1` | Existing explicit cache tuple + every row + receiving attempt; independent veto before shared effects/list publication / H reuse. Automatic full-list reuse deferred OQ8-10. |
| `phase9_store_metadata_cache`, `phase9_metadata_cache_reuse_context`, `phase9_complete_metadata_cache_reuse` (M85:205/258/377) | Legacy selected-snapshot source attempt and payload; veto for public scope. Permitted store-private selected-snapshot branch remains; no conversion into edition-list cache / I legacy cache. |
| `phase9_catalogue_count_search_v1` and Select/Add count helpers | Only source-bound admitted canonical result from the preceding guarded operation; verify effect's originating attempt, never count a Google hint / J counts. |

AC8-12 sets every existing/NEW permissive Google flag true, valid notes/versions/
retention, and also supplies a forged admitted policy. A…J must show zero new
shared effect/cache/link; private positive controls and OL-secondary positive
control prevent an overbroad veto. Validators may accept private Google facts;
that is not permanent-reuse permission.

**Historical SQL disposition (local evidence; live hashes required §11.1):**

| Home | Function / proposed disposition |
|---|---|
| M65:21 | `phase9_edition_valid_metadata`: M73:12–61 supersedes Google-only worker gate; replace active dispatcher, preserve exact v1 validation. |
| `DB/20261007000066_marketplace_phase9_edition_picker_commands.sql`:15/93 | `phase9_edition_lookup_receipt` now M75:59; Select renamed `phase9_edition_legacy_select_candidate`, now M84:898. Forward active source-policy reader + guarded Select; no stale M66 body copied. |
| `DB/20261007000067_marketplace_phase9_edition_picker_operation_fences.sql`:73–76/210–215 | `phase9_edition_worker_context` now M78:38; automatic `phase9_metadata_job_context` retains generic registry read. Preserve old context shape; new config RPC supplies capabilities. |
| `DB/20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql`:254/276 | Representative Add trigger remains active; gate it below. `phase9_edition_options_due` now M73:154–164 delegates source policy; generalize that policy. |
| `DB/20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql`:37 | `phase9_edition_legacy_select_candidate` now M84:898; same guarded Select disposition. |
| `DB/20261012000074_marketplace_phase9_open_library_author_isolation.sql`:31–98 | Completion v1 now M84:1549 delegate→M86 v2; call registration now M78:223. Generalize latest bodies; preserve author-content failure isolation. |
| M78:56/241/303–364 | Context, fan-out registration and old completion pairings: context/registration generalized; completion superseded as above. Hash every deployed overload before declaring a historical body inactive. |

**Legacy auxiliary covers (design; AC8-7/10):** gate M62 detail reader, M73 compact
summary representative branch, M69 new-Add trigger and both M61 writer wrappers
on the originating representative row's provider being currently enabled for
automatic lookup. Before 8b, legacy mode uses existing enabled policy; v2 mode uses
the automatic capability too. Google off thus suppresses **previously saved**
representatives as well as new writes/copies, including 8b rollback. Keep M61's
two Google-only CHECKs, immutable auxiliary rows, chosen own-cover snapshot bytes
and existing inventory links/representative bytes. No deletion or broadening to OL.
Test saved pre-switch Google records through detail, compact read and new Add;
existing inventory treatment remains the pre-launch terms gate (SDD-0 §12.2).

**GETs versus accounting:** current fallback uses one lookup/reservation, two
logical-attempt registrations; Google has one register/finalize call pair, OL has
one register/finalize pair per actual GET (≤6), plus one
`phase9_finish_edition_primary_for_fallback_v1` and one completion-v2 transaction
(`metadataEditionOptions.ts:81–124`; `metadataEditionProviderCalls.ts:44–95`).
Thus successful full fallback has ≤7 provider GETs and ≤14 physical receipt RPCs,
plus those logical operations/context reads; exact receipt replay can add RPCs,
never GETs or spend. 8b preserves truthful per-call accounting, not a single fake receipt.

Accepted versions are a compatibility mechanism, not perpetual rights. Policy
revocation still denies new reuse/shared writes; already chosen snapshots/inventory
are retained under existing rules. Source-policy builder binds the **selected
accepted version** from trusted lineage while retaining the strict eight-key
02b policy shape. Never treat active and historical versions as interchangeable.
Propose NEW private `phase9_catalogue_source_policy_v2(adapter_key text,adapter_version text)`;
the existing single-key builder keeps its signature and delegates using the active
version. New callers supply only the version re-proved from their locked lineage.
Parity must include saved v1 choices after v2 activation and cleanup (AC8-10/14).

### 4.3 Automatic completion, fairness and protection prerequisites

**NEW automatic contract (design; 8a-4/8b):** separate from the explicit parser,
whose completed receipt requires options version/deadline (`metadataEditionOptionsRpc.ts:19–32`).
All UUIDs/timestamps/JSON use existing strict schemas; safe integers only.

| Name / exact proposed input | Result / validation |
|---|---|
| `AutoFence` | `{jobId:uuid,worker:text,leaseToken:hex64,claimAttempt:1…5,candidateId:uuid,storeId:uuid,sessionId:uuid,candidateVersion:positiveInt,queryIdentity:text≤2048,capturedRequestId:uuid\|null,requestGeneration:nonnegativeInt}`. Scope is re-derived, supplied values only compared. |
| `AutoCompletion` | `{fence:AutoFence,lookupId:uuid,attemptId:uuid\|null,result:MetadataResultV2,selectedOptionId:uuid\|null,source:'external'\|'local'}`. `attemptId=null` only validated zero-egress local/manual outcome. Existing automatic selected-snapshot cache/coalescing keeps its existing boundary; no full-list cache command (OQ8-10). |
| Service `phase9_complete_automatic_metadata_v1(p_command jsonb)` | Exact external/local command above. Re-prove scope/claim/protocol/source/selected bytes/companion digest; worker applies strict automatic rank, SQL validates authority/identity/selection binding, not a new SQL ranker. Current explicit predicate controls catalogue writes (02b §14 OQ3); one snapshot/manual + catalogue/effects/accounting/job terminal transaction. |
| `AutoReceipt` | `{version:'p9-auto-completion-v1',status:'completed'\|'replayed',lookupId:uuid,snapshotId:uuid\|null,outcome:MetadataCanonicalOutcome,selectedOptionId:uuid\|null,prefill:PrefillResult}`. No rows/raw data in receipt. `PrefillResult` before 02d is `{status:'skipped',reason:'not_installed'}`; 02d owns other variants. |
| Service `phase9_recover_automatic_metadata_v1(p_fence jsonb)` | Strict AutoFence; returns AutoReceipt with `status:'replayed'`, or exact `{status:'missing'}` / `{status:'stale_rejected'}`. Receipt-first recovery uses persisted claim/digest, not a now-expired active lease; never restores expired list or repeats HTTP. |
| Terminal refusal | `{status:'stale_rejected'}` means no mutation. `P9_AUTO_COMMAND_INVALID`, `P9_EDITION_ROWS_INVALID`, `P9_CATALOGUE_COMPANION_INVALID`, `P9_AUTO_SOURCE_INVALID`, `P9_IDEMPOTENCY_MISMATCH` roll back command. Timeout/network/unknown RPC result is completion-uncertain: recover only. Lock contention: 02d §3.2; never a provider retry. |
| Persistence | NEW private `phase9_automatic_completion_effects`: lookup_id PK/FK, job/candidate/store/session IDs, claim worker/hash/number, generation/captured request, selected_option_id nullable, snapshot_id nullable, digest sha256, receipt jsonb, completed_at. Postgres-only writes/read via service recovery, RLS/revoke API roles; raw token/rows absent. Digest includes exact result/list/companion/source proof/selection/identity/retention bytes. Bound original companions remain private under 02b. |

| Valid result variant | Completion and recovery must preserve |
|---|---|
| Coherent suggestion, no retainable list (Google transition) | Validate `outcome.selected` and physical receipt; commit snapshot, rows/retention absent, selectedOptionId=null, no shared Google effects. **8b-only hook absent:** prefill `{status:'skipped',reason:'not_installed'}`. **02d hook installed:** `{status:'skipped',reason:'no_retention'}`. Recovery preserves whichever receipt originally committed; installation never rewrites it. Positive no-list test (`googleBooks/adapter.ts:49–67,87–101`). |
| Retainable list + coherent winner | Winner must match one row's metadata/UUID and accepted companion. Store selected binding, preserve all rows separately; no chosen count. |
| Retainable ambiguous/no-match list | Save list via 02d, snapshot manual outcome, no selected binding; no relaxed winner inferred from explicit eligibility. |
| Zero-egress manual/local result | No reservation/physical call; truthful local lineage, no invented list. Manual entry stays available. |
| Legacy automatic cache/local hit / skipped prefill / stale | Keep current selected-only/local result, no invented list (02d §3.3). Skip does not undo a valid automatic result; wholly stale command commits nothing. No new automatic full-list reuse. |

Identity conflict skips only that edition's catalogue sub-operation. No post-terminal
catalogue call; replay returns the original digest/receipt, never another searched count.

8b does not save sheet options: 02d adds that transactional hook. Persist the
automatic receipt/digest and selected-option binding so recovery never needs a
second fetch. Preserve companion v1 row UUIDs; for a current-suggestion Add,
forward the chosen-companion reader to resolve the accepted automatic receipt's
selected-option ID, same metadata digest/lookup/attempt/provider record. Do not
guess the latest row or weaken explicit option binding (M84:217–231).
Keep legacy automatic RPCs as compatibility delegates; old Google behavior is
unchanged while 8b is staged. No after-terminal catalogue call.

**Provider retry allowance (design; D31, existing per-claim identity):**

| Durable field / transition | Rule and migration owner |
|---|---|
| One allowance | Private phase9_automatic_provider_runs PK (job_id,query_identity_hash,adapter_key,adapter_version,round), round 0/1, lookup/primary attempt IDs (nullable before any egress grant), claim stamp, queued/running/finalized/unknown, due/outcome/receipt digest. 8a-5 owns private schema/ACL/allowance. No physical-call round column. |
| Retry requires **new claim** | Known safe finalized retryable failure records round 0, schedules existing job retry_scheduled/backoff, clears lease. Round 1 binds only a newly issued **larger claim_attempt_number/new lease token**. Resume same lookup/primary attempt identity if already registered; otherwise first create it under the retry claim. No secondary/duplicate primary. No retry HTTP from the failing claim. |
| Existing call identity retained | M73:516-519 unique (logical_attempt_id,claim_attempt_number,sequence/stage), M78:255-265 replay unchanged. New claim uses fresh call UUIDs/sequences 0..5. Same-claim stage/identity replay recovers that call only; another UUID at an occupied stage refuses. 8a-3 retains indexes/predicates; 8a-5 gates next-claim retry. |
| Completion/replay/accounting | Complete using the successful round's current claim/sequence; prior calls/spend immutable and count once. Unknown registration/finalization/completion recovers original identities only, never a new provider round. Bypass old rejected-terminal shortcut only for the persisted allowed retry. |
| Lease budget | Five claims remain (M15:219; M32:1056). Reclaim with no known-safe retry authorization is recovery-only; higher claim number alone grants nothing. No allowance reset/sixth claim. Normal claim-1 transient failure retries on claim 2. |
| Bound/reservation | OL <=6 per round / <=12 per logical primary including retry; Google <=1/<=2. One lookup reservation/idempotent per-call accounting; no refund. Secondary disabled in both manifests. |

| Outcome | Proposed result (AC8-5; OQ8-1/3 values open) |
|---|---|
| Finalized 429/5xx/proved safe transient | At most one delayed retry on a new claim; second failure manual/no edition. |
| Unknown send/result, registered orphan, lost completion | Recovery-only; no new GET/round or invented unsent receipt. |
| Kill/policy/auth/input/quota denial | No retry/fallback bypass; manual survives. |
| Pacing/temporary capacity | Durable queue/due-time deferral, no provider attempt/spend. Master section 8:561 requires queued capacity admission; hard per-store search-cap treatment is OQ8-3, not unconditional terminal-cap behavior. |
| Breaker open | No HTTP while open/fallback bypass. D31 all-provider-down retry/recheck uses the one next-claim allowance and approved cooldown; still open -> manual, no second recheck loop. |
| Ambiguous/conflict/no match | Manual; retain permitted fetched list, no technical retry. |

Terminal/manual snapshot keeps existing needs_review/safe reason and resolved or
exhausted-technical dead_letter job (M32:1068-1077/1109-1128), no new candidate
state. Capacity wait stays durable until admission or existing manual supersession;
OQ8-3 must settle cap/capacity/recheck behavior without disabling manual Add.

**Fair queue proposal — mechanism and values require OQ8-3 approval:**

| Schema / algorithm (8a-5, design) | Contract / proof |
|---|---|
| `marketplace_sec.phase9_store_admission` | `store_id uuid PK/FK`, `last_ticket bigint DEFAULT 0`, `window_started_at timestamptz`, `gets_used int≥0`, `next_due_at timestamptz`; global monotonic bigint sequence supplies tickets (not wall clock). Private postgres writes, no API reads; retention/window policy OQ8-3. |
| Claim rewrite | NEW phase9_claim_metadata_jobs_v2(batch_size int1..10,worker text) retains existing claim tuple. One due head per server store (next_attempt_at,id); stores by (last_ticket,store_id), admission row then head job FOR UPDATE SKIP LOCKED. Assign ticket + existing lease/claim atomically. No session/candidate/shared lock; legacy claim signature unchanged. |
| Cap versus scheduling | OQ8-3 distinguishes temporary capacity (durable due-time deferral/no provider spend) from hard search quota/manual result. Recommend queued capacity per master section 8:561; remove unconditional manual_cap. Any terminal purpose-specific failure RPC runs after admission locks release with session-first prefix. |
| Service round / starvation | One ticket advance per eligible store before a just-served store wins again. Locked/not-due/capacity-blocked stores excluded until due; no cap-handling priority flood. With N eligible unlocked stores/one free slot, B waits <=N admissions independent of A backlog; no wall-clock promise for locks/outages. |
| Tests/gate | Two native connections, A:B backlog 1000:1 and reversed, explicit B included, repeated workers/restart, capped/locked A; prove service bound and unchanged lease fencing. AC8-6 cannot build/pass before the mechanism and operating limits are approved. No Redis/new queue service. |

Cross-instance pacing/breaker follows OQ8-1; shared permits require a separately
reviewed schema under the amended migration plan, not hidden extra migrations.

### 4.4 Proposed migration split by responsibility

This is a **design estimate**, not a compliant/approved migration plan or filename
reservation. R12/D45 permit at most one migration per slice; SDD-0 §7.3 guardrail 1
also requires one session. **OQ8-5 must explicitly amend these rules for 8a-1…5
and 02d before any SQL creation.** Approval of OD-2 alone did not amend them.
If approved, each row has one separately approved migration, working against
earlier rows only; never add a forward dependency. Soft target
300–500 lines each; **stop and flag >~800 before creation**, do not compress SQL
or split an applied file. OD-2's 8a/8b/8c names remain unchanged.

| 8a subpackage | Owned objects / expected size / idle compatibility |
|---|---|
| 8a-1 registry/policy | Columns/configuration/transition data, independent Google veto and **interim OL-only** admission/source policy (section 4.2); ~300-500 lines. No forward validator dependency; old contexts/routes unchanged. |
| 8a-2 pure validators | OL v1/v2/Google facts/call/profile validators + fixed dispatcher; then atomically generalize interim admission to capability + existing veto + installed field profile; ~400-500. Native interim/old-worker proof; saved bytes unchanged. |
| 8a-3 route/physical accounting | Structural lookup/attempt/usage, stage CHECK, grant_epoch column, admission-gate schema/ACL (initially open) and gate-locked physical grant wrappers; ~400-600. No reference to later queue helpers; existing per-claim uniqueness retained. No author-proof schema. Native legacy-FK/old-worker proof; >~800 stop/re-scope. |
| 8a-4 automatic transaction | New automatic completion/receipt recovery and selected-companion support; audit current explicit v1/v2/recovery and Add/Select policy calls; ~400–700. New entry idle until 8b. If body duplication exceeds ~800, stop for a semantic split/factored private core review. |
| 8a-5 queue/protection | Automatic run/retry ledger, proposed fair admission/cap state/ACL and admission-wait helpers using the already installed gate (§7), optional shared permits/breaker; ~300–500 estimate requires rescoping after function-size readback. OQ8-1/3/5 gates; no extra migration silently added. |

No migration is needed merely to edit 8c registry values; those operational row
updates need separate authority and before/after readback. 02d owns its own migration.

## 5. Design — 8b compatible worker (Google remains primary)

### 5.1 Installed list and versioned OL automatic adapter

Authoritative NEW port (design; definitions proposed for `I/metadata/providerDescriptor.ts`
and strict Zod result schema in `I/metadata/providerResult.ts`, not implemented):

```typescript
type Purpose = 'automatic' | 'edition_options';
type LookupInput = { query: MetadataQueryIdentity; correlationId: UUID;
  attemptId: UUID; signal: AbortSignal; purpose: Purpose; http: ProviderHttpPort };
type RetentionContractId = string; // strict schema: /^[a-z][a-z0-9-]{0,63}$/ (1..64 ASCII)
type RetainedList = { sourceFetchedAt: Timestamp; permittedDeadlineAt: Timestamp;
  policyVersion: PositiveInt; storagePermissionVerified: true;
  retentionContract: RetentionContractId };
type MetadataResultV2 = { version: 'p9-metadata-result-v2'; purpose: Purpose;
  outcome: MetadataProviderOutcome; rows: readonly StoredEditionRow[] | null;
  catalogueCompanions: readonly CatalogueWriteCompanion[] | null;
  retention: RetainedList | null };
type ProviderDescriptor = { adapterKey: string; adapterVersion: string;
  capabilityVersion: string; normalizerVersion: string;
  payloadSchemaVersion: string; lookupSchemaVersion: string;
  validationContract: string; hostPolicyVersion: string;
  retentionContract: RetentionContractId | null;
  protocol: { kind: 'single'; maxGets: 1 } | { kind: 'fanout'; maxGets: 6 };
  purposes: readonly Purpose[]; credentialsReady(): boolean;
  retentionReady(purpose: Purpose): boolean;
  invoke(input: LookupInput): Promise<MetadataResultV2> };
type RouteInput = { purpose: Purpose; registry: RegistrySnapshot;
  installed: ReadonlyMap<string, ProviderDescriptor>; resumed: Lineage | null };
type Route = { primary: ProviderDescriptor; secondary: ProviderDescriptor | null;
  policyVersions: Readonly<Record<string, PositiveInt>> };
// resolveProviderRoute(input: RouteInput): Route | {manual:true}; invalid config throws.
```

`UUID`, `Timestamp`, `PositiveInt` use existing validators; arrays/strings use
§3.1/edition-row bounds. `Lineage` is locked lookup/attempt provider/version/role/
sequence/claim/policy, never a client object. RegistrySnapshot is one coherent
service-only read of §3.1 fields plus existing permissions and snapshot hash.
Allowed retention IDs are declared per adapter/version in its installed manifest/
descriptor and matching installed SQL validator; registry values cannot invent one.
Initial declarations are `open-library-options-v1` and `google-books-options-v1`,
not a generic enum. Null descriptor contract forbids retained lists. A new adapter
declares its own ID/verifier; its validator migration adds the matching dispatch.

| Protocol / validation port | Proposed signature and lifecycle |
|---|---|
| `ProviderHttpPort.get` | `(input:{url:URL,stage:string≤128,sequence:0…5,signal:AbortSignal}) → Promise<{json:unknown,headers:Headers,receiptId:UUID}>`; single uses local ordinal 0, mapped to legacy SQL paired-NULL stage/sequence; fan-out writes increasing stage/sequence. Preserve v1 validator grammar; reject above maxGets. No unfenced fetcher. |
| `beforeRequest` | `(lookupId,attemptId,claim,stage,sequence,url) → {callId:UUID,grantEpoch:bigint}`; verify compiled path/registry intersection and provider stage validator, reserve/pace, register physical identity, reload claim immediately before GET. Denial prevents HTTP; already-granted sends remain drain obligations (appendix §2). |
| `afterRequest` | `(callId,{status:'finalized'\|'outcome_unknown'\|'stale_rejected',egressStarted:boolean,outcome,retryable,providerRequestId}) → {receiptId:UUID}`; one durable finalization or exact replay. Uncertain registration/finalization recovers only; permit release never invents unsent proof. |
| TS result validation | Strict known keys/version/purpose, `failClosedMetadataProviderOutcome` on `outcome` only, separate row/companion schemas, key/version/UUID/own-URL/fetched-time binding; rows ≤10. Worker result schema checks retention-ID syntax and equality to the installed key/version descriptor/verifier; unknown or cross-provider ID raises `P9_PROVIDER_RESULT_INVALID`. List/retention/companions all null when no retainable list; [] is a verified empty list. Other mismatch raises that same error, unknown version `P9_PROVIDER_RESULT_VERSION_INVALID`. |
| SQL dispatch | NEW fixed facts/stage dispatchers and `phase9_provider_retention_valid_v1(contract,source_fetched_at,deadline,current_policy)`; v1/v2 mapping §4.1. Reject malformed/unknown retention IDs or IDs not declared by the installed validator for locked source key/version. Pure shape rules IMMUTABLE; locked current-policy/lineage checks separate. Validate metadata payload schema against payload contract and lookup/attempt/cache schema against lookup contract. No registry-to-function execution or SQL ranker. |
| Retention trust boundary | Reuse existing controlled-worker verifier + `boundOptionsRetentionEvidence` (`I/metadata/openLibrary/adapter.ts:27–36`; `googleBooks/editionOptions.ts:154–204`). It examines each actual response's headers and shortens approved source deadline; no-store/invalid/expired denies retention. SQL re-proves claim/source/version/field profile, finalized call grammar, current policy and ≤24h deadline, **not remote headers/names absent from M32:210–230**. A boolean alone grants no permission. Unknown verifier/profile denies retention; no new DB evidence issuer/table or independent header-proof claim. Google verifier absent => retention=null. |
| Google wrap | Invoke legacy automatic `lookup` once; copy its entire parsed outcome unchanged into `outcome`; set rows/companions/retention=null when no independent list verifier (observed transition). No fabricated option UUID/selectedOptionId; `outcome.selected` still commits (§4.3). Explicit wrapper maps validated original rows + verified evidence, deriving explicit summary separately; never uses that summary as an automatic winner. |

- Replace `primary`/OL fallback/class checks with installed descriptor map and
  purpose-aware route from §3. Missing descriptor/credentials/validator fails closed.
- Keep OL v1 `lookup()` guard intact. Install proposed OL adapter **2.0.0** and
  capability v2 for automatic support, explicitly versioned in SQL/registry/cache.
  `2.0.0` is the proposed manifest version, not an existing version.
- Extract common OL fetch/normalize and generic eligibility/retention helpers;
  v1 explicit results remain golden-equivalent. V2 returns original ≤10 rows,
  companions, retention evidence and separately strict-ranked automatic outcome.
  Provider-owned facts stay one coherent edition; no cross-provider stitching.
- Use the port above; never add envelope keys to immutable metadata or to the
  current strict outcome parser (`providerAdapter.ts:91–124`). Red contracts prove
  unknown-version rejection and the no-retention Google positive path first.
- Automatic fan-out uses §4's per-call protocol, not one fabricated Google-style
  receipt. Resume/uncertainty obey existing recovery-only behavior; no new fetch
  just because a completion response was lost (02b §10).
- Keep Google descriptors/tests installed. Remove global dependency on a Google
  key for non-Google startup (§2.4 environment evidence); adding a provider may
  need secret provisioning, switching prepared installed providers does not.
- Deploy after 8a readback in the transition state (§4.1). OL automatic remains
  disabled; record exact 8b artifact as rollback target before 8c.

### 5.2 Clues, bounded retrieval and rank boundary

| Input | Proposed handling (D27; slice 9 boundary) |
|---|---|
| title + authors | Search title and supplied authors; validate every supplied author using existing predicates. No typo/fuzzy relaxation invented. Most spines use this path; missing ISBN is ordinary. |
| publisher | Compare actual edition publisher with the deterministic signal below; absent/misread clue never filters retrieval or makes an identity eligible. |
| language | Preserve normalized identity, known-language restrictions and unknown-language explicit rule. Prefer language-compatible candidates for allocation/rank, retain other-language display rows; no language URL filter. |
| checksum-valid ISBN | **Gated OQ8-6:** proposed direct automatic ISBN transport before title retrieval even when title exists changes retrieval/spend, so needs its own labelled comparison and recorded transport fixtures. Until approval retain legacy search transport; no `isbn` stage activation. Validate returned ISBN and supplied title/author conflict; stable identity remains M55/TS. |
| subjects | **Blocked on OQ8-7:** D43 says all provider genres, but current metadata permits only 20×128-character categories (`I/contracts/metadata.ts:105–107`, `registers.ts:38–39`) and explicit OL emits [] (`normalizer.ts:130`). The draft's bounded/automatic-only enrichment and unchanged explicit golden rows do not meet that wording. No truncation or explicit-path exclusion is approved here. |

**Publisher signal (design, OL v2 only):** NFKC, locale-independent lowercase,
replace runs outside Unicode letters/numbers with a space, split whitespace,
deduplicate in first-seen order. Inputs ≤256 characters; ≤32 tokens of ≤64
characters, otherwise signal 0 (do not truncate into a match). Let A/B be clue/
actual-publisher token sets; signal=1 iff both nonempty, intersection nonempty
and `2*|A∩B| >= min(|A|,|B|)`, else 0. No fuzzy spelling, synonyms or stop words.

Rank strict identities by existing `secondaryScore = ISBN + language + editionClue`
(`googleBooks/ranking.ts:62–64`), then publisher signal. Determine ambiguity by
equality of **both** scores before any provider-ID stable display ordering. Publisher
therefore resolves only an existing secondary-score tie; it never beats stronger
identity/secondary evidence or changes the eligible set. Freeze fixtures:
`Faber & Faber`/`Faber`=1; `Penguin`/`Penguin Random House`=1;
`Penguin`/`HarperCollins`=0; null/anything=0; equal scores+equal signal=ambiguous.
Google transition keeps its legacy ranker unchanged. No general D28 picker ships.
Exact ISBN never overrides an
explicit conflicting supplied identity. Full D28 language→publisher→times chosen→
cover→ISBN→provider-order choice stays slice 9 (SDD-2 Slice 9, D26/D28/D38).

### 5.3 Call optimization without changed edition lists

| Proposed optimization | Guard/proof before activation |
|---|---|
| Search `fields` includes `author_name` | Request along with author keys/needed edition fields; subjects depend on OQ8-7. Work author names are hints; do not replace an edition's own references or silently use search names as authoritative endpoint names. Conflicting/missing pairing falls back to validated author resolution. |
| Normalized author cache | **Deferred proposal, not approved (OQ8-9): recommend no shared author cache in OL-first.** All allocated author reads remain physical and fenced, <=4 authors/<=6 total GETs per provider round. |
| `/isbn/<validated-isbn>.json` | Gated OQ8-6 for **both** automatic and explicit use. Recorded status/404/redirect/429/5xx/retention-header fixtures required before validator/stage activation or AC8-3 acceptance. Compiled HTTPS path only; reject redirect or separately validate/account every hop within six GETs. Explicit optimization requires complete ordered-list parity, including author-less/work fallback; otherwise keep legacy transport. No narrowed bibliographic list or second attempt disguised as optimization. |
| Search/edition `limit` | Keep one work/≤10 original edition positions for equivalence. Do not increase limit to compensate for OCR misreads; that changes results and belongs to a new Owner decision. Over-limit/malformed responses fail closed. |

V2 uses ≤6 actual GETs per provider round, ≤12 per logical primary only with
§4.3's one new-claim retry; no hidden retries in fetch. Both manifests disable
secondary routing. Direct ISBN may use fewer calls; it does not promise
network behavior not yet measured. Physical retrieval must preserve the same normalized list under the recorded
provider facts (section 6); no shared author-cache hit changes author allocation.
Do not ship an optimization that cannot prove equivalence; keep the legacy plan.

**Author caching deferred (OQ8-9):** M32:210-230 receipts contain no author name
or response headers. A worker-supplied digest cannot independently prove either.
Remove the proposed issuer/proof/cache tables and wrapper from this build;
future trust/retention work requires a separately reviewed design. Physical
normalized-author reads retain current allocation and response validation.

### 5.4 Protection and manual fallback

Design: global provider pacing (Q5), bounded timeout/response size/cancellation,
identifying User-Agent with Owner-supplied contact email, per-store fair queue/cap,
bounded exponential backoff + jitter respecting safe Retry-After, and provider
circuit breaker with cooldown/single half-open probe. All state needed for
multi-instance correctness is durable; a process limiter alone is not global.
Exact cap/window/backoff/breaker thresholds require OQ8-1/3, not hard-coded policy.

Only §4.3's durable run allowance can schedule **one automatic retry** (D31);
lease recovery/unknown egress never creates that allowance. Policy/auth/input/quota denial has no secondary bypass. After outage,
ambiguity, hard quota, breaker or kill switch: no edition, plain recoverable reason,
explicit search when permitted and manual title/author Add remain available
(MAS-10/16). A busy store cannot starve a second store's explicit search.
Temporary capacity stays queued per §4.3; cap treatment remains OQ8-3.

## 6. Design — benchmark and equivalence (D38)

[Activation appendix section 1](./02c-1-slice8-switch-runbook-and-benchmark.md#1-benchmark-and-equivalence)
owns packets, qualified edition equivalence, labelled/unknown denominators,
supplemental ISBN/publisher clues and behavioral red-first proof. Record the
Google baseline before disable. **Adding an 8c threshold gate is OQ8-4**, not
already decided by D38; slice-9 D38 gating remains mandatory.

## 7. Design — 8c switch, recovery and rollback (OD-2/3)

[Activation appendix section 2](./02c-1-slice8-switch-runbook-and-benchmark.md#2-switch-grants-drain-and-rollback)
owns pause closing new grants, already-granted sender obligations/safe point,
exhaustive disjoint job-root drain, bounded smoke, paired registry updates and
the AC8-10 partial-8a/legacy-FK/lease/v1-v2/rollback matrix. 8c does not require
02d. Rollback floor is the recorded 8b worker with Google disabled; the old
Google-primary-after-disable row stays dropped (OD-3). No operations occur here.
For 02d prefill rollback, pause/drain then set OL `automatic_lookup_allowed=false`,
`automatic_role`/`automatic_order` null in that manifest and read back. Leave the
SQL hook installed; 02d §9 defines no-list completion and original replay receipts.

## 8. Design — security, ACL and tenant isolation

Inherit 02b §9, master §3 and DOC-1 §13; no role gains direct shared/private writes.

| Boundary | Required proof |
|---|---|
| Registry/config | No PUBLIC/anon/authenticated route-write grant; service configuration access only through audited existing operator authority. Configuration cannot select SQL/imports or expand compiled host policy. Secrets stay server-side. |
| SQL | Pure validators IMMUTABLE/no definer; live-policy readers STABLE, locked builders/mutators VOLATILE; postgres owner, empty search_path, fully qualified calls; no dynamic SQL from registry. Service wrappers invoker/EXECUTE service-only; private helpers postgres-only. |
| Claim/store | Server job→candidate→session store identity; service UUID compared, never authority. Exact lease hash/attempt/query/request/version checks on each transition/fetch. Cross-store stale/forged claims write nothing. |
| Shared data | Only admitted coherent public provider facts; no Owner title edits, typed ISBN query, prices/labels/notes/shelf/damage/store IDs, raw JSON or private effect pointers. 02b scan-origin proof and independent payload projection remain mandatory. |
| Cache/companions | Original fetched deadline, all version keys and current permissions; fresh receiving lineage, no cross-store UUIDs/fake receipts; source/companion binding immutable. Primary-only publication and M88 post-lock expiry remain. |
| Output/URLs | Common safe text/size/known-key checks plus own-record/host/path rules; reject unsafe redirects/protocols/credentials. No image download/cache permission inferred from a URL. Proposed presentation change needs the same negative matrix. |

Native disposable PostgreSQL tests prove locks/leases/policy changes and role
operations; sequential PGlite alone cannot prove fairness/concurrent isolation.
No destructive ACL probe or fresh live evidence is authorized in this task.

## 9. Acceptance checks and red-first proof

All NEW suite names below are proposed. Write feature assertions and observe
failure on baseline before production edits; a missing-file/setup failure alone
is insufficient. Preserve the existing Google/OL/catalogue/ISBN/app suites.
Fixtures only for provider/model responses; no live calls in deterministic tests.

| AC / authority | Given / When / Then | Red-first proof and owning part |
|---|---|---|
| AC8-1 D25/D33 | Existing nonhidden admitted catalogue edition resolves locally with own cover/placeholder and no provider call. | Extend local/structural worker integration, positive/hidden/blocklisted controls; existing local case is regression, new registry-selected no-egress assertion red before 8b route change. |
| AC8-2 D25/D32 | Fresh missing book after 8c, **no-retry case**: one OL primary round <=6 GETs, zero Google; coherent result ends route. With D31 retry, same logical attempt <=12 GETs across two distinct claims (AC8-5). | Recorded worker/SQL fixtures; red baseline selects Google/OL automatic throws. Assert both per-round and total bounds / 8b. |
| AC8-3 D27/R09 | **Gated OQ8-6 + recorded transport fixtures:** valid ISBN/title variants admit v2 isbn stage through real CHECK/receipts; invalid ISBN/stage/redirect refuses; no conflict winner. | Red actual M78 CHECK/registration plus recorded status/redirect/headers/429 cases and labelled automatic transport comparison; no stage activation or pass before fixtures/Owner answer. M55 identity parity regression / 8a/8b. |
| AC8-4 D27/D28 | §5.2 token/signal/secondary-score rules yield exact expected ranking; noisy/missing publisher leaves eligible set unchanged; unresolved equality manual. | Frozen punctuation/partial/unrelated/null/overbound/equal fixtures + conflicting secondary scores. Red actual publisher absent from current ranker / 8b. |
| AC8-5 D31/MAS-16 | Known 429/5xx gets at most one durable retry on a **new claim**; same-claim repeat cannot send. Unknown egress recovery-only; <=12 OL/<=2 Google GETs per logical attempt. | Actual run-ledger/claim/index/replay/accounting SQL plus fake clock; same-claim, normal retry claim, unrelated lease reclaim, five-claim exhaustion and lost response. Red baseline lacks bounded allowance; policy gated OQ8-1/3 / 8a/8b. |
| AC8-6 D31/R04 | Approved queue mechanism gives B its §4.3 N-admission bound under A flood/cap; pacing deferral/cap denial no provider attempt/spend. | **Gated OQ8-3 mechanism/limits**; native 1000:1/reversed backlog, two connections, lock/cap/restart/explicit cases; red M15 global due/id order. No asserted wall-clock starvation proof / 8a/8b. |
| AC8-7 D22/D29/R05 | Missing OL cover placeholder; saved pre-switch Google auxiliary covers suppressed in detail/compact/new Add after switch/rollback; chosen own snapshot/existing inventory unchanged. | Seed saved representatives; exercise M62/M73/M69 gates + M61 legacy CHECK controls and disabled Google egress spy; red current readers still expose saved fallback / 8a/8c. |
| AC8-8 D43 | **Conditional on OQ8-7:** both automatic and explicit fixtures meet the Owner-approved all-genres transport, projection and oversized/unsafe-input policy; no silent truncation or unapproved path omission. | Recorded >20/over-128/missing/unsafe subjects fixtures and approved legacy/v2 expectations; red current normalizer emits [] and all-genres transport absent. Do not claim D43 acceptance before the answer / 8b. |
| AC8-9a OD-1/D32/D35 backend | Synthetic adapter/manifest + facts/stage/retention/full-field profile and row only; stages discover/edition:ED-42/person:AUTH-7, own retention ID synthetic-options-v1. Automatic/explicit SQL read/Select/Add, explicit typed cache and existing automatic selected-snapshot cache succeed. | Native/worker frozen-hash test proves no generic result-schema edit; reject unknown/cross-provider retention ID, payload p9-metadata-foundation-v1 or lookup/cache p9-metadata-v1 swaps; accept payload p9-metadata-v1 **and** lookup/cache p9-metadata-foundation-v1 for OL v1/v2 and synthetic fixtures. Stage/ID/tenant/rights negatives; storage-only capability refuses. No automatic full-list cache dependency (OQ8-10); third-host DTO is 9b / 8a/8b. |
| AC8-9b OD-1 client | **Gated OQ8-2:** synthetic third-host rows/current suggestion/cover/attribution pass paired server/app negotiated DTO; unsupported/expired/forged policy yields safe projection. | Real paired schema/UI/Select/Add tests + frozen generic app projection hashes; red current host pairs/Google ternary. Required for full OD-1 and third-host activation, not OL-only 8c / 8b presentation. |
| AC8-10 OD-2/3/R06 | Every activation appendix §2 compatibility row passes, including 8b rollback with Google off; old-worker-after-off row excluded. | NEW `P/phase9ProviderRollout.integration.test.mjs` + worker fixtures/native races; red capabilities/new completion absent. Required smoke is separate, not substitution for matrix / all parts. |
| AC8-11 MAS-02/R07 | Pure validators IMMUTABLE; malformed envelope/facts/receipts/stages/redirects and unsupported/mixed field profile denied. Controlled retention verifier denies invalid headers/deadline; SQL does not claim remote-header proof. | Real role/SQL and worker verifier fixtures, including missing verifier, no-store and wrong schema tuple. Red new dispatch/full-field contract; existing negative controls retained / 8a/8b. No author-cache issuer tests. |
| AC8-12 D35/02a §6.1 | OL parity; set **every Google registry permission/capability true**, valid versions/retention/note/roles, and prove §4.2's code veto: zero canonical/source/provider-ID/shared-count/cache-publication/reuse effects or new Add link, including saved-ID hint. Valid private options/completion and unlinked Add survive. | SQL admission→companion completion→private resolver→cache validator/publication/reuse (both edition-list scopes, legacy public scope)→Select/Add matrix; also forged admitted policy, manual/storage-only/expiry negatives. Red a capability-only implementation passes Google; current allow-list denial is retained control. Synthetic positive closes AC7-21(b) / 8a. |
| AC8-13 R04/02b section 8 | Defined scan/typed/confirmed/edited/unknown origin fixtures retain private/shared scope and fresh receiving lineage in **existing explicit** reuse. Provider-facts-only remains explicitly UNPROVEN, not represented by an unknown-origin duplicate. | Existing privacy fixture evidence §2.5; real two-store explicit-cache tests and prefill privacy negatives. OQ8-11 must define a distinct producer or record unreachable origin before claiming that case; no new automatic reuse / 8a/8b. |
| AC8-14 D35/R06 | Automatic accepted companion reaches saved-snapshot Add after options cleanup; old v1 choices/lineage/digest unchanged, no duplicate counts/spend. | Completion/companion/Add integration and native races; red no automatic transaction/selected binding / 8a/8b. |
| AC8-15 OD-1/D38 | Record pre-disable Google baseline and qualified/adjudicated OL comparison. **8c threshold gate is proposed, conditional OQ8-4**; slice-9 D38 gate remains mandatory there. | Approved complete packets/labels first, then behavioral red: wrong-winner scoring, tie/unknown classification or (if gate approved) just-over-threshold comparison incorrectly accepted. Missing fixture/gate input alone is not red. Fixed passing/exact-bound controls; no new numeric policy / 8b. |
| AC8-16 D30/R06 | Subject to OQ8-6/7, explicit lists obey v1 exact/v2 declared tuple-and-approved-delta golden contract. Original <=4-author allocation, failed-author rows, deadlines and <=6 physical GETs per round remain truthful. | Saved packets/fixed UUID/time, actual header bounds, all author reads physical, payload/lookup schema parity tests; recorded known failures are green controls. Red actual refactor/approved transport behavior, no author-cache warm/cold requirement / 8b. |
| AC8-17 OD-1/MAS-13 | Installed OL-only runtime starts without Google credentials; unknown manifest/invalid order denied, existing prepared provider switches need no code edit. | Environment/bootstrap tests first fail Google-only real-mode/key requirement / 8b. |

Done means recorded red→green, worker build/typecheck, focused edge/Jest and
`npm.cmd run test:phase9:db`, native isolation/fairness/rollback suites, migration
readback when separately authorized, independent review, continuity validator and
`git diff --check` (SDD-0 §§7.3/15). 8c additionally needs authorized smoke evidence.
No such implementation result is asserted by this draft.

## 10. Build packages and review stops

| Order / part | Proposed package / size-risk | Review point and stop |
|---|---|---|
| 0 | Resolve §12 build-gating questions; fresh read-only preflight / S | Owner approves design/subsplit; no implementation from document approval alone. |
| 1 / 8a | Tests only for capabilities/validators/roles/legacy context/synthetic provider / M-high | Record meaningful red + passing controls on M88 baseline; report before SQL creation. |
| 2 / 8a | §4.4 subpackages 8a-1→5, one forward migration each / L-high | Separate create/apply approvals per file, 300–500 soft target, >~800 stop; independent security/lock/body review and compatibility after each. |
| 3 / 8a | Native/API-role/generalization closeout / M-high | AC8-9a backend hashes/old-worker proof; AC8-9b remains separately gated. No worker deployment yet. |
| 4 / 8b | Worker routing/manifest/environment tests, golden packets and protection tests only / M | Capture old outputs and red new assertions before production refactor. |
| 5 / 8b | Generic route/protocol/context + adapters/clues/approved genres/protection / L-high | Bounded cohesive modules; separate egress/recovery from ranking. No author cache, SQL ranker or automatic full-list reuse dependency. |
| 6 / 8b | Presentation adaptation conditional OQ8-2 / M-high | **Hard gate for AC8-9b/full OD-1/third-host activation.** OL-only 8c may proceed without it, with limit stated; paired contracts/security/legacy projection required when approved. |
| 7 / 8b | Comparison, native regressions, build/review and transition-state deploy / M-high | Google remains primary. Record immutable 8b artifact/versions as rollback floor. Deploy separately authorized. |
| 8 / D30 | [02d packages](./02d-edition-sheet-prefill-sdd.md#8-build-packages-and-documentation) / separate | After 8b, before slice 9; migration/worker/app scope owned there. |
| 9 / 8c | Rehearsed drain/switch/rollback matrix, operational script / M-high | Owner approves benchmark/pacing/config and operations; no code/SQL deletion. Execute/read back/smoke only under separate authority. |

8a-1–5 are a proposed **exception to still-binding R12/D45/§7.3**, not compliant
under OD-2 alone; OQ8-5 must amend those rules for separately approved subunits.
Independent reviews follow SDD-0 §15; unavailable named reviewer tools are reported,
never represented as completed reviews. No stage/commit/push/deploy authority here.

## 11. Read-only build preflight and documentation matrix

### 11.1 Facts to collect before build (none collected live here)

- Exact Supabase project identity and complete migration/function readback through
  M88; M78 may have SQL-editor application without a migration-ledger row
  (01a §10). Reverify new migration numbers locally/live; no guessed M89 filename.
- Registry **all** metadata rows/versions/enabled/policies/grants; data-derived
  Google row and operationally enabled OL must be reconciled with M01/M73 seeds.
- Current definitions/dependencies/owner/ACL/volatility/search_path/overloads for
  every §2.4 function, CHECK dependencies, RLS/effective privileges and source writers.
  Before **each** 8a subpackage hash the live definitions below; historical local
  SQL homes are not proof of the deployed body or byte-identical supersession.
- Actual deployed artifact/config/adapters/retention verifiers, number of worker
  instances, concurrent jobs, pacing/contact configuration and route policies.
- Backlog by store, waits/throughput, leases/in-flight/reservations/unknown physical
  calls, stored versions/selected companions/cache keys, options expiry/cleanup.
- Read-only evidence sufficient to disposition known gaps: AC7-21(b), provider-only
  query privacy, in-flight/selected rollback, live Google/expiry/M88/field comparison
  (ACTIVE open-items block). Do not convert old smoke into proof for these cases.
- Owner-authorized provider documentation/response fixtures for `/isbn` redirects,
  `author_name` bindings, response/header retention and rate limits; no fresh web,
  HTTP, Supabase or Render access is allowed in this documentation task.

**Frozen-definition method (design, AC8-9a/b):** future test golden
`P/fixtures/provider-replacement-generic-sha256.json` records `{baselineArtifact,
sql:[{signature,sha256}],files:[{path,sha256}]}`. For each exact schema-qualified
overload use `encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')`,
sorted by signature; CHECKs use the same hash of `pg_get_constraintdef(oid,true)`.
Record owners/ACL/volatility/search_path separately. No formatting tolerance:
even whitespace change requires an explicit re-baseline/review, never auto-update.
File hash command: `Get-FileHash -Algorithm SHA256 -LiteralPath <path>`; store
lowercase hex over exact file bytes, with no line-ending/format normalization.

| Freeze point | Objects fixed before installing synthetic provider |
|---|---|
| SQL after generalized 8a | All overloads of `phase9_complete_candidate_edition_options_v1/v2`, `phase9_recover_candidate_edition_options_v1`, NEW automatic complete/recover, structural lookup/attempt/reserve, single/fan-out register/finalize/fallback, source policy/context, catalogue resolver/choice/Add helpers, typed/legacy cache publication/reuse and stage table CHECK. Synthetic validator/dispatcher entries are the **only** SQL changes permitted by that test. |
| Worker after generic 8b | Byte SHA256 of `W/index.ts`, `bootstrap.ts`, `editionProviderRoute.ts`; `I/runtime/metadataProductionComposition.ts`, `metadataProductionGateway.ts`, `metadataEditionOptions.ts`, `metadataEditionProviderCalls.ts`, `metadataEditionOptionsRpc.ts`; NEW `I/metadata/providerDescriptor.ts`, `providerResult.ts`, `I/runtime/metadataAutomaticCompletion.ts`. Manifest data entry/new adapter/fixtures excluded; no workflow edits. |
| Client after approved OQ8-2 | Paired generic Owner DTO projection/validation modules, `EditionOptionList.tsx`, `MetadataCover.tsx`; new provider requires no host/name branch. These hashes gate 9b, not 9a. |

After 02d, extend/review the baseline once with its prefill/refresh helpers, then
repeat replacement without generic edits. Deferred OQ8-10 is not a cache-helper
baseline change or permission to auto-refresh hashes per provider.

Native fixture tests snapshot definitions before/after installing synthetic facts,
stage and retention validators and a registry row. Report each permitted validator
delta; every generic hash must match. Live preflight uses this same definition
hash method plus dependency/ACL readback; no live hash has been collected here.

### 11.2 Documentation update matrix

| Trigger | Owning update at implementation (not performed here) |
|---|---|
| Product/provider rules | DOC-3 §5.2/§5.2.1 and DOC-1 §13 if policy changes; master MAS rules retained; this SDD/SDD-2 traceability, not a tracker-originated requirement. |
| Schema/ACL/registry | Data dictionary, current-vs-target audit, migration ledger, implementation/security verification; record filename/live mapping/effects/readback. |
| Code/tests/operational proof | Tracker 38 + verification tracker: actual red/green/native/security/build/benchmark/rollback, external mutations or none. |
| State/authority changes | Orchestrator rewrites ACTIVE; DOC-13 only global change, TRACKER evidence/routing; SESSION-START remains protocol (2026-10-30 consolidation). |
| Map descriptions changed | CODEBASE_MAP 03 routing/RPC, 05 rule pointers, 06 commands/guards, 04 only moved feature paths; 09 design documents. No status/live data in map. |

**Current correction scope:** 02c/02d and the activation appendix, minimal
SDD-0/SDD-2 pointers/traceability and map 09 appendix row. DECISIONS links remain
valid and unchanged. ACTIVE/trackers/DOC-13 are orchestrator-owned and untouched. Planning-only
closeout runs local continuity/link/whitespace checks, no product tests or SQL.

### 11.3 Documentation-only verification

2026-10-30 correction verification commands/results are reported in the closeout;
local Markdown targets/GitHub heading anchors and table structure are checked
with an inline filesystem-only script, followed by `git diff --check`. No stale
link-count claim is carried forward. **Continuity validator gate is BLOCKED**, not
passed: current local run stops at `PHASE9_MIGRATION_SET_INVALID` after 195
requirement definitions, zero duplicates/missing traceability and passing validator
regression probes (the earlier unchanged checker/tracker baseline also failed).
It must be resolved/re-run by its owning scope
before build closeout; no migration/validator fix is authorized here.
No product test, Python test, network/DB/Storage/Render operation, stage, commit,
push or branch switch was performed. ACTIVE/trackers/DOC-13 remain untouched.

## 12. Owner questions and conflicts

Only Owner decisions are open below; recommendations are **not approvals**.
Implementation choices within an approved contract remain with the builder.

| Question | Recommendation and effect | Gate |
|---|---|---|
| OQ8-1 / SDD-0 Q5: single-instance enforcement or shared DB pacing before OL-first; contact identity? | Recommend one enforced instance and one shared in-process 1 GET/s permit, with durable claim/fairness and Owner contact email. Multiple instances require shared permits/breaker first. Author caching separately deferred OQ8-9. | Before protection build and 8c; no inferred operating approval. |
| OQ8-2: approve one-time provider-neutral presentation work in 8b? | Approve §3.3's typed opt-in DTO/security/legacy projection. Otherwise only backend AC8-9a/OL switch can pass; full third-host replacement/AC8-9b remains unaccepted. | Before presentation package/9b/third-host activation; not OL-only 8c. |
| OQ8-3: approve fairness/limits and distinguish hard quota, temporary capacity and all-provider-down retry? | Recommend ticket mechanism and durable capacity deferral per master section 8:561; hard quota may end manual. Set D31 one next-claim retry/recheck/cooldown without breaker traffic/loops and measurable cap/window/backoff. No unconditional manual_cap policy is decided. | Before protection build/AC8-5/6 and switch. |
| OQ8-4: **add a wrong-edition benchmark threshold gate to 8c**, or collect comparison only? Who adjudicates, approves threshold and authorizes baseline calls/retention? | Recommend adding the 8c gate; it is not decided by D38 (which gates slice 9). Approve section 6 qualified/equivalence labels and denominators, name adjudicator/approver, separately authorize pre-disable Google recording. If gate declined, record comparison without a new pass/fail threshold; preserve slice-9 gate. | Before comparison/activation plan; unrecordable baseline needs explicit disposition, no Google re-enable later. |
| OQ8-5: explicitly amend R12/D45 and SDD-0 §7.3 guardrail 1 for multi-session 8a-1…5 plus 02d? | Approve each semantic subunit with at most one migration, separate create/apply/green/Owner gates; retain OD-2 names/R06, adjust scope after size/dependency evidence, stop >~800. Five files are **not compliant until amendment recorded**; propagate approved map/rule amendment then. | Before any migration creation; no amendment presumed here. |
| OQ8-6: approve automatic direct-ISBN transport and how should explicit parity coexist? | Automatic ISBN+title retrieval needs its own labelled spend/result comparison and recorded status/redirect/retention fixtures. Explicit optimization only with complete-list parity; otherwise retain legacy search. No automatic or explicit isbn-stage activation before answer/proof. Narrowing explicit lists needs explicit approval. | Before direct transport/AC8-3/16; schema may reserve bounded stage shape but dispatcher denies activation. |
| OQ8-7: D43 all genres versus 20×128 categories and explicit-v1 [] goldens? | Recommend a separate versioned all-genres transport for **both** automatic and explicit lookups, preserving bounded legacy categories/rows; Owner approves its oversized/unsafe-input policy and companion/cache scope. Truncation, automatic-only genres, or changed v2 categories/goldens each needs an explicit decision; none is chosen here. | Before subjects/genre build and AC8-8/16; record approved full-data versus compatibility expectations. |
| OQ8-8 / SDD-0 §12.2: pre-existing Google data terms/cleanup before real stores? | Inventory private snapshots/picker/inventory/auxiliary covers read-only; settle retention/display terms or approve a separate cleanup plan before launch. Keep chosen bytes/existing links during this transition; no blanket purge is approved. | Pre-launch, not permission to erase data or a blocker for documentation/build. |
| OQ8-9: defer author-name caching from OL-first? | Recommend defer: keep every author read physical, existing <=6 GET plan. No cache issuer/proof/table or migration/package dependency; revisit only with a reviewed trusted verifier/retention boundary. | Optional future optimization, not 8c prerequisite. |
| OQ8-10: defer automatic full-list cache reuse/SQL ranking? | Recommend defer: keep automatic catalogue/local and legacy selected-snapshot cache/coalescing, existing explicit typed-cache behavior; prefill only a newly fetched retained list. No new SQL ranker/command. A future smaller worker-ranked form would still need source/fence/parity review. | Optional future optimization; no AC/package depends on approval now. |
| OQ8-11: how to disposition provider-facts-only privacy origin without a distinct producer? | Recommend keep UNPROVEN/private and defer separate acceptance until an actual producer with distinct persisted origin evidence is specified, or Owner records it unreachable. Never duplicate the unknown fixture and call it proof. | Only that privacy case; current scan-only public scope remains mandatory. |
| Q18, with Q15/Q16/Q17: future second-provider licensing/field rights/retention/overwrite/expiry? | Keep deferred while OL alone. Require §3.1's approved full-field profile before retention/sharing/presentation; mixed field rights require a reviewed extension, not permissive flags. Permanent public/cover/attribution rights precede shared capability; expiry-requiring canonical facts stay disabled until all readers enforce expiry/withdrawal. No overwrite/fuzzy merge/reset in slice 8. | Future second-provider admission, not current OL-only design blocker. |
| Q19: per-store provider choice? | Keep deferred; current registry route is global, shared-row visibility never varies by store provider choice. | No implementation/AC in this slice. |

**Settled conflict dispositions:** OD-2 replaces old split/migration estimate;
OD-3 removes the obsolete rollback row; OD-4 moves D30 to 02d. Search labels use
actual “Search Books”/“Retry search”; no “Search again” button is invented.
Q3 write timing and Q4 searched semantics are **already answered** by 02b §14
OQ3/OQ6; do not reopen them from the context pack. Preserve first-row/no-refresh,
current explicit predicate for catalogue writes, one searched attribution per
completed lookup on its sole/first-resolved work, and no chosen count for an
automatic suggestion. The accepted proof gaps in ACTIVE remain unproved until
the named build checks run; this draft closes no implementation milestone.

Cohesion assessment: this document owns the provider-replacement contract across
SQL and worker. Activation evidence/runbook detail is in 02c-1 under this authority;
the independently shippable D30 state-machine change is separated into 02d.
