# Phase 9 Requirements Traceability

**Last updated:** 2026-08-21

## Multilingual vision-response resilience correction

| Requirement | Owning source | Evidence/status |
| --- | --- | --- |
| MAS-01/02; EXT-03/10 | Provider count/array evidence from 16-100 normalizes to canonical `too_many_books` with zero observations; values above the defensive maximum and malformed/unknown structure fail closed | Pipeline SDD §§3, 5, 7, 9, 12, 14-15; decoder resilience fixtures 1-4 |
| MAS-04/19; MAS-AC16; EXT-20/40 | Original Unicode title/authors remain unchanged; null/missing language becomes `und`, known names map, valid BCP 47 stays strict, and bounded unknown human labels degrade to `und`; malformed enrichment is rejected independently | Master SDD §§3, 5, 14; Pipeline SDD §§5, 7, 9; resilience fixtures 5-9 |
| MAS-02; EXT-10/17; MED-08/09/18/24/28/29 | Unknown keys, active content, non-string language, invalid identity, malformed ordinals, and raw-payload overflow remain rejected; logs expose only a sanitized code-owned field path and closed category | Pipeline SDD §§5, 9, 13-15; Security SDD §§8, 11, 13, 15-16; resilience strictness/privacy fixtures |
| Scope/rollout gate | No migration, Supabase/Storage write, deployment, provider call, removed-input retry, Unit 7 effect, stage, commit, or push is part of the local correction | Phase 9 tracker and implementation log, 2026-08-11 |

## Automatic worker wake dispatcher

| Requirement | Owning source | Evidence/status |
| --- | --- | --- |
| Due media, vision, and metadata jobs wake their matching request-driven worker without moving claim/lease/fencing authority out of the existing RPCs | Master SDD §§8–10; pipeline SDD §§10, 14–15 | Local M36 private parity helper/dispatcher; 18 predicate-parity cases plus independent due-stage request cases for all three kinds |
| Worker origins/tokens are Vault-only; provider/service-role credentials and secret-bearing observability are forbidden | Security SDD §§9, 13, 15; dispatcher SDD §4 | Six fixed secret names; private seven-day observation excludes values; pg_net may transiently hold the bearer header in its private request queue, but M36 returns and durably logs neither it nor other secret-bearing output; structural and PGlite secret-exclusion/ACL tests |
| Scheduler creation is safe by default and bounded | Pipeline SDD §§14–15; dispatcher SDD §§4.1, 5 | One named 60-second cron created inactive; one stage/tick fence; explicit 120-second timeout backed by measured cold wake, provider ceiling, margin arithmetic, and scaled delayed HTTP-service proof |
| Timeout and duplicate wake behavior preserves normal provider idempotency | Pipeline SDD §§10, 14–15 | Dispatcher timeout/active-lease suppression plus full Phase 9 exact vision replay and finalized metadata physical-call reconstruction regressions |
| No activation or operational mutation occurs in the local work unit | Dispatcher SDD §§2, 5, 7 | M36 unapplied; no live Cron/Vault/Render/worker/provider/Storage/job/inventory/publication mutation |

## Compact provider/language-hint correction

| Requirement | Evidence |
| --- | --- |
| EXT-22/23/40; MED-30 | Gemini JSON mode returns one compact `vision` object with flattened optional Romanization/translation fields per observation and at most five authors; no provider response schema is sent. BookConnect normalizes evidenced `success`/null-language aliases, validates locally, and attaches server-owned provenance. |
| MAS-19; DAT-10-14 | Flattened enrichment is independently non-fatal and `author_romanizations` aligns positionally one-to-one with `author_guesses`, using null for unavailable entries. |
| MAS-AC17/18 | Original-script title/authors remain canonical; Romanization and optional English title translation remain separate M18/M19 proposals. |
| Approved auto-detect target | A selected language is a hint; a differently detected valid book persists a candidate and continues through unchanged M32 metadata-job creation. |

See [tracker 27](../trackers/27-compact-gemini-multilingual-language-hint-evidence.md).

## Metadata local-runtime safety and manual invocation

| Requirement | Owning source | Evidence/status |
| --- | --- | --- |
| Privileged worker startup accepts only the exact approved development Supabase HTTPS origin and rejects foreign/suffix/userinfo/query/fragment/path/malformed targets before client composition | Repository `AGENTS.md` database rule; Unit 4A Â§11; current user authorization | Focused metadata environment tests 7/7; inherited foreign process URL was not used |
| Metadata has no peer worker; media/vision mutual ingress-token distinctness remains mandatory | Unit 4A Â§3/Â§11; M32 manual claim architecture | Metadata omits/rejects the peer hash; existing media/vision positive and same-token negative tests remain green |
| Manual invoker supports metadata without client-supplied candidate/store/session/query/provider/lease/attempt authority | Unit 4A Â§7/Â§11; M32 database claim boundary | Runtime/invoker suite proves metadata mapping, exact body, timeout, response bound, unknown rejection, and output redaction |
| Temporary provider secrets remain process-only and an adapter-only credential smoke causes no database/provider-attempt persistence | Unit 5B provider boundary; current user authorization | Exactly one HTTP 200 request; credential accepted; bounds/decoder/provider-neutral normalization passed; no database/provider-attempt persistence |

## WU2 read-only Owner inventory client integration

| Requirement | Owning source | Evidence/status |
| --- | --- | --- |
| Owner `/inventory` reads only through `phase9_owner_inventory_page_v1`; no client store identity is sent and no direct `store_inventory` read remains reachable from the route | DOC-8 §5; Phase 9 master SDD §§3/5/7/9; WU1 addendum §§4–7; WU2 addendum §§2–4 | Route-graph architecture test and [tracker 26](../trackers/26-owner-inventory-read-client-wu2-evidence.md) |
| Decode the exact WU1 envelope/item contract and fail closed on malformed, extra, or invalid fields | WU1 addendum §§4–7; SDD 03 §§9–13 | Strict runtime decoder includes offset-aware timestamps and positive projection versions; service tests distinguish invalid response, unauthorized, invalid request/cursor, unavailable, and internal states |
| Search/filter changes restart at page one; opaque cursors, first-seen de-duplication, partial-page failures, and identity/store cache isolation are preserved | DOC-8 §5; WU1 addendum §5; WU2 addendum §§4–6 | Query tests cover page reset, retry, cursor forwarding, de-duplication, cached-refresh failure, and late identity/filter fencing; cache swaps require explicit success/current generation while invalid-cursor reset remains destructive |
| WU2 remains read-only and does not start dashboard remediation, inventory writes, publication, deployment, or Unit 7 | Phase 9 master SDD §§3/7/9; WU2 addendum §§1/7 | Architecture assertions and scoped diff; authenticated Owner runtime remains deferred |

## WU1 controlled Owner-inventory read boundary (2026-08-04 correction pass)

| Requirement | Owning source | Evidence/status |
| --- | --- | --- |
| Pagination does not overclaim repeatable state or expose raw unexpected database errors | WU1 addendum §5/§7; existing quantity/publication command paths | `asOf` is documented as an ordering horizon only; explicit NULL page sizes fail closed; unexpected SQL failures map to `P9_INTERNAL_ERROR`; correction regression tests are 9/9 locally green |
| Preserve the existing Owner detail read contract and establish a separate server-scoped, filterable, deterministic list boundary | DOC-8 §5; Phase 9 SDD 00 §§3/5/7/9; SDD 03 §§9–13 | [WU1 addendum](../work-units/owner-inventory-read-boundary-wu1-sdd.md); unapplied draft `20260803000031`; red-first/static and local PGlite tests; no client or live migration change |
| Client-supplied store identity cannot grant authority; private inventory remains outside direct authenticated table access | Phase 9 SDD 00 §9; current-vs-target §RLS/grants | Server-derived `phase9_owner_ux_assert_owner()`, fixed `search_path`, narrow execute grants, and cross-context cursor checks in the WU1 draft; live application separately gated |
| Owner list pagination remains complete and deterministic across ties/context changes | Phase 9 query/cursor conventions; DOC-8 §5 | Signed context-bound cursor over `updated_at DESC, id DESC`, 1–50 page bounds, explicit `hasMore/nextCursor`, and no offset pagination |

## Unit 6A implementation receipt

Matrix §1.1-§1.4 boundaries, decoding, stale/replay/Close fences, and Unit 7 noninterference are locally implemented and tested; [tracker 19](../trackers/19-unit6a-owner-safe-backend-evidence.md) records the evidence. M29 is unapplied.

## Historical Unit 5C Lite target reconciliation (2026-07-29)

At this historical checkpoint, Unit 5C Lite was the approved target. The then-current selected-language runtime,
`p9-vision-v2`, and live M01 `book_search_aliases` remain unchanged. Unit 5C-2
implements only private provisional persistence; activation/search/UI remain
separately authorized.

### Unit 5C-1 implementation mapping (2026-07-29)

| Requirement | Implementation evidence |
| --- | --- |
| MAS-19; EXT-40; MED-30 | `search_variant_proposals_v1` parser and safe companion decoder isolate missing/rejected sidecars from valid `p9-vision-v2`. |
| DAT-10â€“14 | Observation-qualified title/author sources, per-field BCP 47/ISO 15924, bounded proposal types, already-Latin suppression, deterministic-key separation, and field-local deduplication. |
| EXT-41 | No provider generation/call, metadata query, persistence, activation, search, inventory, or publication seam is invoked. |

### Unit 5C-2 implementation mapping (2026-07-29)

| Requirement | Implementation evidence |
| --- | --- |
| MAS-19; EXT-22/23/40; MED-23/30 | M18 delegates to the M12 active-claim fence and independently validates the sidecar; M19 fingerprints the first accepted envelope and rejects changed accepted replay atomically. Stale/mismatched claims persist no proposal. |
| DAT-10–14 | Private rows carry exact store/analysis/candidate/observation/field/author linkage, language/script, bounded type/provenance, deterministic identity, and proposed/non-searchable lifecycle defaults. |
| MAS-AC17; MKT-05/16 | Bounded read requires store plus analysis/candidate/observation scope; M18 creates no active alias/search projection and preserves M01 unchanged. |

### Unit 5C-3 implementation mapping (2026-07-29)

| Requirement | Unit 5C-3 evidence |
| --- | --- |
| MAS-19; EXT-22/23/40 | The existing single Gemini call may return an optional companion; independent bounds/schema/provenance validation fails closed while valid canonical `p9-vision-v2` remains usable. Raw provider responses are not persisted. |
| MAS-20/21/22; MAS-AC17/18 | Accepted companions persist through M18/M19 and reconcile confirmed Owner title and each individual author independently, with store/observation/source-field isolation and narrow deterministic normalization. |
| MAS-23/24/25 | Material-change classification, default-deny activation, no stale auto-reactivation, and trusted `proposed -> active`, `proposed -> stale`, and `active -> stale` transitions are implemented. |
| MKT-05/16 | M21 forward-removes M20's temporary alias/search effects. Active store-scoped alias materialization and Roman-query search consumption remain Unit 5C-4, not Unit 5C-3. |
| SEC-01/04; OBS-06 | Missing/malformed/oversized/unsupported/provenance-mismatched companions have no product effect; lifecycle smoke is rollback-only, zero-residue, and no raw provider payload enters persistence/logging. |

The exact implementation evidence is [tracker 15](../trackers/15-unit5c3-runtime-reconciliation-evidence.md).

### Unit 5C-4 implementation mapping (2026-07-29)

| Requirement | Unit 5C-4 evidence |
| --- | --- |
| MAS-AC17; DAT-13/14; MKT-05/16 | M22/M23 consume only current active proposals, validate exact store/source/eligible-target authority, materialize independent title/one-based-author aliases, retract stale/inactive effects, and validate current lifecycle fail closed at search time. |
| MAS-AC17; REV-21/22 | Live M24/M25 exposes private store-scoped Owner review/approve/reject/replace with exact versions, immutable decision audit, candidate-first locking, one-based authors, and preserved source/model provenance. |
| MAS-AC17; MED-21 | Live M26-M28 keeps all rollout flags false by default, derives structural review eligibility from at least 100 complete samples plus reconciled population evidence without hiding truthful failed/invalid/governed-excluded cases, requires explicit platform approval plus one exact current evidence tuple for activation, and exposes platform-only evidence reconstruction. |
| MKT-05/16 | Roman title/author search deduplicates results while preserving original title/author, ISBN, canonical/legacy approved aliases, listing eligibility, and public projection/display identity. |
| MED-21/23; SEC-01/04 | Store isolation, private-proposal non-exposure, RLS/ACL, fixed function search paths, trusted materialization authority, no unintended `MAINTAIN`, and no unrestricted application-side service-role DML were verified. |

The exact implementation evidence is [tracker 16](../trackers/16-unit5c4-active-variant-search-evidence.md).
Owner decision authority/UI, customer display changes, benchmark/rollout
controls, inventory/publication/commerce, Google Books Roman-query fallback,
and global alias authority remain deferred.
| MED-21/23 | RLS, client denial, service SELECT-only/no-MAINTAIN table access, RPC-only mutation, and fixed-empty-search-path private/public functions are live-verified on PostgreSQL 17.6. |
| REV-22; DAT-12/13 | Owner approval/rejection/manual replacement and exceptional review remain explicitly unimplemented; trusted automatic activation and stale propagation are implemented through Unit 5C-3. |

| Requirement | Owning SDD | Primary acceptance IDs |
| --- | --- | --- |
| Original title/author preserved as primary with per-field language/script | 00 Master; 01 Data; Unit 5C Lite | MAS-04; MAS-AC16; DAT-10 |
| Auto-detect default; optional hints; no language-forcing | 00 Master; 02 Extraction; Unit 5C Lite | MAS-01; EXT-04/05/20 |
| Compact optional enrichment isolated from strict persisted vision result and mapped into the existing private proposal contract | 00 Master; 02 Extraction; 04 Media; Unit 5C Lite | MAS-19; EXT-40; MED-30 |
| Independent title/author confirmation and activation | 00 Master; 01 Data; 03 Review; Unit 5C Lite | MAS-18; DAT-12; REV-22 |
| Deterministic keys separate from linguistic variants | 01 Data; 05 Marketplace; Unit 5C Lite | DAT-14; MKT-16 |
| Bounded provisional Roman forms; translation separate/inactive | 01 Data; Unit 5C Lite | DAT-11/12 |
| Material source changes make dependent variants stale | 01 Data; Unit 5C Lite | DAT-13 |
| Store-scoped, active-only search authority | 00 Master; 01 Data; 05 Marketplace; Unit 5C Lite | MAS-AC17; DAT-13/14; MKT-05/16 |
| Owner-confirmed nullable-canonical listing under existing publication gates | 01 Data; 03 Review; 05 Marketplace | DAT-07; REV-23; MKT-17 |
| Positive selling price required; price-on-request excluded | 00 Master; 03 Review; 05 Marketplace | MAS-AC18; REV-02/23; MKT-17 |
| Roman-query provider fallback remains a future Unit 5B extension | 02 Extraction; Unit 5C Lite | EXT-41 |
| Private spine image never becomes public media | 04 Media; 05 Marketplace | MED-15/16; MKT-08 |

| Requirement | Owning SDD | Primary acceptance IDs |
| --- | --- | --- |
| Historical current-runtime selected-language capture; Unit 5C target is traced above | 02 Extraction | EXT-01–EXT-05 |
| Simple Start/Close session and summary | 02 Extraction; 03 Review | EXT-06; REV-01 |
| Model-agnostic primary/fallback vision | 02 Extraction; Unit 4 design | EXT-07–EXT-10; EXT-19 |
| Vision count/language/repeated-position policy | 00 Master; 01 Data; 02 Extraction; Unit 4 design | MAS-01/02; DAT-26/27; EXT-19–EXT-21 |
| Attempt-token-fenced vision persistence and replay | 02 Extraction; 04 Media; Unit 4 design | EXT-22/23; MED-23 |
| Atomic media-to-vision reservation and guarded nonterminal repair | 02 Extraction; 04 Media; M33 migration/tests | EXT-13/14/22/30; MED-23; active-session and initiating-Owner media binding exclude malformed history |
| Immutable analysis evidence separate from metadata/Owner edits | 01 Data; 02 Extraction; 04 Media; Unit 4 design | DAT-26/27; EXT-24; MED-24 |
| Fixture vision runtime has zero metadata/inventory/publication effect | 00 Master; 02 Extraction; Unit 4 design | MAS-05/07; MAS-AC02/03/11; EXT-25 |
| Provider-agnostic local/primary/secondary metadata | 01 Data; 02 Extraction | DAT-05–DAT-09; EXT-11 |
| Replaceable provider-neutral metadata boundary and downstream independence | 00 Master; 01 Data; 02 Extraction; 05 Marketplace | MAS-13; MAS-AC12; DAT-31/33; EXT-28; MKT-15 |
| Exactly one primary, optional secondary, and at most two sequential attempts | 00 Master; 02 Extraction | MAS-14; MAS-AC13; EXT-26/27 |
| Coherent single-provider selection; no provider canonical authority or field stitching | 00 Master; 01 Data | MAS-15; DAT-06/33 |
| Provider-independent query identity and provider/version cache isolation | 01 Data; 02 Extraction | DAT-28/29; EXT-26–28 |
| Attempt role/routing/capability/cache/coalescing/cost lineage | 01 Data; 02 Extraction | DAT-30; EXT-28/30 |
| Complete provider outage preserves manual reviewed inventory | 00 Master; 02 Extraction; 03 Review | MAS-10/16; MAS-AC05; EXT-16/29; REV-20 |
| Provider licensing/publication allowlist, shadow-evaluation gate, and coalescing privacy | 04 Media; 01 Data | MED-22/25/26/27; DAT-31 |
| Availability/quality/correction scorecards and promotion gate | 01 Data; 02 Extraction; 03 Review | DAT-32; EXT-38/39; REV-21 |
| Horizontally safe claims, graceful shutdown, spend reconciliation and capacity admission | 00 Master; 02 Extraction | MAS-17; MAS-AC14/15; EXT-30–37 |
| Physical-call finalization response loss preserves committed evidence or records uncertain egress without payload retention | 00 Master; 02 Extraction; 04 Security | MAS-02/17; MAS-AC14/15; EXT-17/30–37; MED-18/28/29 |
| Provider output is parsed as one exact complete coherent edition before persistence | 00 Master; 01 Data; 02 Extraction | MAS-13/15; MAS-AC12/13; DAT-05–09/33; EXT-11/26–28 |
| Raw provider payload disabled by default and credentials excluded from every unsafe surface | 02 Extraction; 04 Media; P9 decisions | EXT-15/17; MED-09/17/18/28/29; P9-D63 |
| Autoscaling disabled until fixed multi-replica evidence | 00 Master; 02 Extraction | MAS-AC14; EXT-36 |
| Title/author priority; visible ISBN only as clue | 02 Extraction; 01 Data | EXT-12; DAT-03 |
| Description, ISBN-10/13, rich metadata, cover | 01 Data | DAT-01–DAT-04 |

### Unit 5A implementation mapping (2026-07-28)

| Requirement | Implementation evidence |
| --- | --- |
| DAT-01–04, DAT-28/29 | strict ISBN helpers; provider-neutral metadata/identity contracts; local-first resolution |
| DAT-30, EXT-26–30 | routing/cache/coalescing modules; M15 lookup, cache, attempt, reservation and pricing lineage |
| MAS-10/16, MAS-AC05, REV-20 | closed manual outcomes and immutable nullable-canonical selected snapshot; no inventory/publication side effect |
| MED-22/25/26/27, DAT-31 | privacy-scoped coalescing/cache namespaces, reuse-policy isolation, service-only RLS/grants, no raw payload input |
| MED-21/23 | M16/M17 explicit four-table service SELECT-only/RPC-mutation boundary; PostgreSQL 17 effective-privilege and RPC-grant regression/live evidence |

M15 is live once as `20260727222159`; this mapping has live schema/function
evidence. M16 is live once as `20260727231217`, and M17 is live once as
`20260727233457`. PostgreSQL 17.6 now verifies SELECT-only service access,
RPC-only mutation, RLS, ownership, and client denial on the four sensitive
tables as recorded in tracker 10.
| Historical alias baseline, superseded for the Unit 5C target by the reconciliation above | 00 Master; 01 Data; 05 Marketplace | MAS-04; DAT-10–DAT-14; MKT-05 |
| Canonical alias kinds/sources/statuses and supersession lifecycle | 01 Data | DAT-11–DAT-14 |
| Additional languages can be added later | 01 Data; 02 Extraction | DAT-15; EXT-04 |
| Advisory duplicates; no image comparison; repeated spines retained | 01 Data; 03 Review | DAT-16–DAT-20; REV-07 |
| Customer-request photos excluded from inventory duplicate identity | 01 Data; 06 Photo request | DAT-16–DAT-20; PHO-14 |
| Quantity/price/location/condition before commit | 03 Review | REV-02–REV-05 |
| Zero-price private inventory; positive-price publication | 03 Review | REV-02; REV-05 |
| Preselected defaults | 03 Review; 02 Extraction | REV-06; EXT-06 |
| Five conditions with explanations | 01 Data; 03 Review | DAT-21; REV-08 |
| Damage separate; discount by price; photos 1–3 | 01 Data; 04 Media | DAT-22–DAT-25; MED-11 |
| Unsellable damaged item remains private | 01 Data; 03 Review | DAT-24; REV-11 |
| Owner review and partial per-candidate commit | 00 Master; 03 Review | MAS-06; REV-01–REV-14 |
| Owner post-push edits | 03 Review | REV-15–REV-17 |
| Bookstore-first marketplace and complete store catalogue | 00 Master; 05 Marketplace | MAS-AC06; MKT-01–MKT-04 |
| Search/display metadata and cover/placeholder | 05 Marketplace | MKT-05–MKT-10 |
| Distinct store/offer/title counts; exact quantity private | 05 Marketplace | MKT-11–MKT-13 |
| Requested current-copy photo is mandatory | 06 Photo request | PHO-01–PHO-08 |
| Maximum three request photos and lifecycle deletion | 00 Master; 06 Photo request; 04 Media | MAS-AC07; PHO-03; PHO-09–PHO-12; MED-12 |
| Multi-tenant `store_id` safety | 00 Master; 04 Media; all data SDDs | MAS-03; MAS-AC04; MED-01–MED-05 |
| Private scan/raw payloads and retention | 04 Media; 02 Extraction | MED-06–MED-10; EXT-15 |
| Security across model, provider, upload, storage, logs, recovery | 00 Master; 04 Media | MAS-AC01; MED-01–MED-20 |
| Provider field reuse rights separate from provenance | 02 Extraction; 04 Media | EXT-18; MED-22 |
| Private commit survives publication failure with idempotent retry | 00 Master; 03 Review | MAS-11; MAS-AC10; REV-18/19 |
| Candidate remains `committed`; publication failure is a separate status/outcome | 00 Master; 03 Review | MAS-11; MAS-AC10; REV-18/19 |
| Initiating Owner owns session resume/mutation in pilot | 00 Master; 02 Extraction | MAS-12; EXT-06 |
| Interactive support takeover excluded; worker/reconciliation recovery only | 00 Master; 02 Extraction; 04 Media | MAS-12; MAS-AC09; EXT-06; MED-04/MED-19 |
| Versioned bookstore-first query/cursor/count contract | 05 Marketplace | MKT-14 |
| Quota/retry policy model-agnostic and configurable | 02 Extraction | EXT-13–EXT-17 |
| Distinct scan, public-copy, and request-photo media classes | 00 Master; 04 Media; 06 Photo request | MAS-08; MED-06–MED-12; PHO-09–PHO-12 |
| Phase 7/8 independence | 00 Master; 06 Photo request | MAS-09; MAS-AC08; PHO-13 |

## Unit 8 bookstore-first Marketplace trace (2026-08-20)

The controlling specialized design is [Unit 8 bookstore-first customer
Marketplace](../work-units/08-marketplace-bookstore-first-sdd.md). It preserves
the broad Marketplace acceptance IDs and WU0B Q07-Q10 split while making the
post-5C/7A/7B/7C implementation contract explicit.

| Requirement | Authority and acceptance trace |
| --- | --- |
| Private Owner inventory identity never becomes customer identity | P9-D73/P9-D75; Unit 7C §§1–2; Unit 8 §§4/17–18; DISC-06; MKT-08/09/12 |
| Offer identity/count is listing-based and never multiplied by quantity | P9-D75/P9-D77; DOC-5 §10.1; Unit 7B §§7/11; Unit 8 §5; MKT-11–13 |
| Title identity is canonical edition → validated ISBN → listing-scoped; title/author/alias text never merges | P9-D67/P9-D76; Unit 5C §§3/6/10; Unit 8 §§4/14; MKT-05/16/17 |
| Q07 remains internal and matches only eligible safe public candidates | WU0B Q07; Unit 8 §§6–7/18; RT-MARKET-01 |
| Q08 groups stores before deterministic store-group pagination and binds cursor context | P9-D77; DOC-5 §§4.2/7; Unit 8 §§8–10; DISC-10/14; MKT-01/02/11/14; RT-MARKET-02/03 |
| Q09 returns a complete title-group-paginated storefront with match pin/clear behavior | P9-D77; DOC-5 §4.3; Unit 8 §§11–12; DISC-10/12; MKT-03/04; RT-MARKET-04 |
| Q10 rechecks current eligibility and exposes approved public detail/gallery only | P9-D77; Unit 7B §§6–7/11; Unit 7C §§7–9; Unit 8 §§13/15–18; DISC-13; MKT-06–10 |
| Publicly eligible media has unique non-null order 1–3; Q10 orders by `public_order,id`, returns max three, and excludes private/unapproved media | P9-D80; Unit 7B §6; Unit 8 §§15/20; M50/M51; PostgreSQL/PGlite/client contract tests |
| `canonical_edition_exact` is reserved/unreachable in text-query v1 | P9-D80; Unit 8 §7; no authoritative edition-context input exists in Q07 v1 |
| Zero-stock/paused/history states cannot remain customer-discoverable or addressable | Unit 7C §§7/9/11; Unit 8 §§6/13/16; MKT-07/15 |
| Legacy unsafe RPCs remain customer-denied while safe v2 compatibility remains | P9-D78; Unit 8 §§3/18/20; M47/M48 security evidence in implementation tracker |
| U8B/U8C/U8D and migration-history reconciliation are separately authorized gates; U8B/U8C/U8D connected closure is now live-verified | P9-D78; Unit 8 §§21–22; [connected rollout evidence](./unit8-connected-rollout-2026-08-21.md) |

## U8B bounded corrective trace (2026-08-20)

| Corrective behavior | Authority and evidence |
| --- | --- |
| Provider/canonical cover provenance is distinct from approved actual-copy fallback; placeholder remains last | DOC-5 §§9–11; Unit 8 §§15/18/20; MKT-07/08; M49 `phase9_q08_actual_copy_cover`; U8B-FIX5-B/D and COVER-01 |
| Q08 cursor binds to the effective relevant publication-policy state, including changes masked by unrelated policy versions | Unit 8 §§8–10/19–20; MKT-14; M49 `phase9_q08_current_policy_version`; U8B-FIX4-01 |
| Malformed decrypted cursor payloads fail closed with the bounded public cursor error | Unit 8 §19; M49 Q08 cursor validation; U8B-CURSOR-04b |
| Real PostgreSQL accepts the production SQL/security boundary without applying M49 to Supabase | Unit 8 §§18/20/22; `phase9_bookstore_first_postgres.sql`; `run-phase9-bookstore-first-postgres.ps1`; `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` |

The U8B integration suite completed `63/63`. The disposable real-PostgreSQL
result was followed by the authorized connected M49-M51 rollout and Q08/Q09/Q10
acceptance; the live evidence is recorded in
[unit8-connected-rollout-2026-08-21.md](./unit8-connected-rollout-2026-08-21.md).

## Unit 7C Owner Store View trace (2026-08-14)

The controlling design is [Unit 7C Owner Store View and post-commit inventory
management](../work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md).

WU1 local evidence is M43 plus the Unit 7C integration/static/vertical fixtures:
Store View reads, Save, stock, lifecycle reuse, revisions, rollback, replay,
tenant denial, ACL/RLS, and generated/default projection ownership are covered.
WU2A evidence is forward-only M44 plus red/green and real-PostgreSQL proofs for
authoritative filter-before-pagination, multi-page completeness, actor/store/filter-bound
cursors, invalid filters, tenancy, and unchanged page-v1/detail-v1 behavior.
WU3 evidence adds strict separate Save/stock Edge/client commands, Store View
edit/stock UI, authoritative cache refresh and stale handling, and capability-
driven reuse of Unit 7B publication/retry commands. Media/history and final
navigation cutover remain without implementation evidence and are not inferred.

| Requirement | Authority and acceptance trace |
| --- | --- |
| Add-to-Inventory preserves review and optionally deep-links by stable `inventoryId` | P9-D73; DOC-4 §§9–11; Unit 7C §§1–3; U7C-A |
| Store View is the rich post-commit surface; Inventory remains acquisition/review/recovery | P9-D73; DOC-8 §§2–5 as superseded; Unit 7C §§3/12; U7C-A/B |
| `store_inventory` is authoritative; listing rows are controlled customer projections | P9-D74; DOC-3 §§6–8/15; Unit 7C §§1–2/6/13; U7C-B/C |
| Ordinary Save is exact-versioned, idempotent, synchronous, transactional, and rollback-safe | P9-D74; Unit 7C §§2/6; U7C-C |
| Stock is separate and preserves buckets/holds; live zero stock projects unavailable without failing lifecycle | P9-D74; DOC-3 §§6.2/7–8; Unit 7C §7; U7C-D/H |
| Media replacement retains approved public media until an atomic safe swap | P9-D74; Unit 7B §6; Unit 7C §8; U7C-E/H |
| Unit 7B lifecycle commands and intent fencing are reused without a second path | Unit 7B §§3–5/8–15; Unit 7C §9; U7C-F |
| Attention, effective state, and capabilities are server-derived; Out of Stock is operational | P9-D73/74; Unit 7C §§2/4–5; U7C-B |
| Store View filters use the authoritative UI bucket before stable keyset pagination (`needs_attention` = `attentionState/action_required`; other named states = `effectiveState`) and bind cursor context to actor, store, and filter | Unit 7C §§5/13–15; M44; U7C-B/H; WU2A integration and real PostgreSQL filter proof |
| Owner-approved committed metadata cannot be silently overwritten or mutate canonical/provider truth | DOC-3 §5.3; DOC-4 §11; Unit 7C §§2/10; U7C-C |
| Activity and append-only safe public revisions remain distinct | P9-D74; Unit 7C §11; U7C-G/H |
| Real PostgreSQL seams precede broad adversarial proof and cannot use manual derived-state repair | Unit 7C §§14–15; U7C-H |

`U7C-A` through `U7C-H` denote the eight normative acceptance areas in Unit 7C
§14. WU1/WU2A supply only the database evidence listed above; full acceptance,
especially media and UI/runtime cutover, must not be inferred from it.

## Unit 7A create-only commit trace (2026-08-12)

The controlling design is
[Unit 7A create-only inventory commit](../work-units/07a-create-only-inventory-commit-sdd.md).
This section supersedes the older duplicate/increment mappings only for Unit 7A;
those rows remain historical context for any separately authorized future work.

| Requirement | Authority and acceptance trace |
| --- | --- |
| One explicit eligible candidate commit creates exactly one new inventory row | P9-D71; Unit 7A §§3, 7, 10; U7A-AC01/06 |
| No duplicate lookup, merge, increment, manual match, target row, or “keep separate” branch | P9-D71; DOC-3 §9; DOC-4 §§8–11; Unit 7A §§4/7/15; U7A-AC03 |
| Quantity comes only from the current server-held saved review and initializes `total=available=q`, other buckets zero | P9-D71/72; Unit 7A §§5/7; U7A-AC02 |
| Expected candidate/review/metadata revisions fail closed on stale state | Unit 7A §§5/6/9; U7A-AC04 |
| Exact replay is stable; mismatched replay and concurrent double submit cannot create a second row | Unit 7A §§8/9; U7A-AC05/06 |
| One-to-one immutable candidate provenance is retained | Unit 7A §10; U7A-AC07 |
| Only `skipped_false_detection` is skipped; valid uncommitted candidates remain uncommitted | P9-D72; Unit 7A §12; U7A-AC08 |
| Commit creates private inventory only; publication is separately authorized Unit 7B | P9-D71; DOC-4 §11; Unit 7A §§13/15; U7A-AC09 |
| Unit 6 duplicate controls/DTO blockers are removed or made explicitly legacy before Unit 7A enablement | P9-D71; Unit 6 SDD §6; Unit 6 contract matrix §2.3; Unit 7A §4; U7A-AC10 |
| Existing M05 is not safe to connect; a forward migration is required, while M09/global historical strengthening is not required by Unit 7A | P9-D72; Unit 7A §16 |

Local implementation evidence is recorded in
[tracker 29](../trackers/29-unit7a-create-only-commit-evidence.md). Dedicated
PGlite cases U7A-01 through U7A-13 map in order to saved-review/current-metadata
authority, exact quantity buckets, authorization/non-enumeration, three revision
fences, create-only cardinality, exact replay, changed replay, same-candidate
concurrency, transaction rollback, canonical immutability, private-media
isolation, reciprocal provenance, and duplicate non-interference. The Edge and
mobile contract/mutation tests cover the authenticated command DTO, absence of
business fields, online/non-optimistic behavior, exact ambiguous retry,
identity/route fencing, version refresh, and private-cache invalidation. M39 is
unapplied, so live ACL/function and authenticated Owner smoke evidence remain
pending rather than inferred from local tests.

### Unit 7B local implementation trace

The frozen Unit 7B SDD §19 contains 20 numbered load-bearing tests. The exact
number-to-invariant-to-test mapping is maintained in
[07b-red-test-traceability.md](../work-units/07b-red-test-traceability.md). The
corrected disposable suite passes 27/27, covering all 20 rows, expanded RT15
cases, and the five Sol Light correction cases. M40 and the Edge/client/UI/worker changes implement the SDD's
dual-version fence, transient-only retry, stale-lease protection, single
projection writer, public DTO privacy, sanitized media/fallback rules,
controlled Owner read boundary, closed-summary freeze, and one-command audit/
event ownership. The actual disposable database-to-Owner-Edge-runtime-to-client-
decoder-to-query/UI gate is 4/4; focused Jest is 25/25; Unit 7A plus dispatcher
is 42/42. Real PostgreSQL upgrade/concurrency and the Deno graph pass. Full
PGlite is 281/282 on the unchanged metadata fixture, and broad Jest passes 2010
real tests with only six unchanged empty collectors. Docker remains
`NOT_RUN/BLOCKED_ENVIRONMENT`. Connected-project and live acceptance evidence
remain `NOT_RUN`.

## Local ingestion-runtime and Unit 4 trace (2026-07-26)

Server-generated upload paths, content-hashed canonical completion, immutable service-only source snapshots, opaque token-and-attempt validation leases, sanitized private linking, and one vision-job identity trace to 02 Extraction EXT-01 through EXT-06 and 04 Media MED-01 through MED-10. M11 is live as `20260726182238`; Owner ingestion and the dedicated media worker are deployed and live-verified. Owner Edge hashes completion bytes but never decodes or sanitizes media. Animated/multi-frame PNG/WebP is rejected, and ImageMagick's 64 MP internal working allowance remains subordinate to the 16 MP source ceiling.

The [Unit 4 design](../work-units/04-fixture-vision-analysis-runtime-design.md) traces `p9-vision-v2`, count/language/repeated-position policy, exact lease fencing, transactional evidence/candidate persistence, M12 schema/grants, privacy allowlists, stable errors, and the red-first matrix to MAS-01/02/05/07, MAS-AC11, DAT-16/26/27, EXT-02-10/19-25, and MED-08/09/21/23/24. The corrected contract/analyzer/policy/worker/M12 implementation and [live deployment evidence](../trackers/06-fixture-pipeline-deployment-evidence.md) cover authoritative claims, relationship reconciliation, retryability, canonical validation, path rejection, every recorded fixture outcome, service-only denial, and zero commerce effects. M12 is live as `20260726182539`, M13 as `20260727025046`, and the fixture worker is deployed; no real provider has been called.

### 2026-08-05 operational evidence

The server-only Unit 4B configuration/startup check is additionally traced to
SDD 00 §§3/5/9/11, SDD 02 §§5/9/11/12, SDD 04 §§8/10/13, and the Unit 4B
handoff. Render deployment/startup was verified at `7eaf921`; the Gemini
provider call itself remains unverified and separately gated. No product,
schema, Storage, or client behavior requirement changed.

### 2026-08-07 structural metadata integration trace

| Requirement | Local implementation evidence |
| --- | --- |
| MAS-06/13/17; EXT-10/22/30 | M32 atomic candidate/job trigger, unique semantic dedupe, fenced context, reclaim-safe logical/physical lineage |
| DAT-05/28/30/33; EXT-11/28 | provider-neutral fail-closed gateway/adapter contract, exact-ISBN-first local/cache/primary order, atomic leader reservation and durable follower attachment, Google Books contained in its adapter |
| REV-04/20/21; EXT-12/16 | existing M15 degraded outcomes, SAME-candidate snapshot/transition, corrected Owner metadata-state/read DTO |
| MED-21/23/24/26 | service-only RPC grants, cross-store/stale-claim denial, no raw scan/provider payload in context or lineage |
| MAS-05/07/09 | central worker/PGlite test proves zero inventory, listing, publication, or Unit 7 effect |

## Root specification mapping

| Root source | Phase 9 responsibility |
| --- | --- |
| DOC-0 | Storefront/product surface and bookstore-first discovery. |
| DOC-1 | Identity, tenant, privacy, media, vendor, and public/private boundaries. |
| DOC-3 | Canonical/edition identity, metadata, inventory, condition/damage, duplicates, listing projection. |
| DOC-4 | Session/capture/model/provider/review/recovery/quota workflow. |
| DOC-5 | Consumer search, store results, catalogue, counts, book detail. |
| DOC-6 | Request-photo gate before payment readiness. |
| DOC-8 | Store Owner capture/review/edit/request-response UX. |
| DOC-13 | Global status and handoff. |
| DOC-14 | Existing request state machine seam and photo acceptance guard. |

## Non-requirements explicitly excluded

- per-spine model switching or automatic model routing by language;
- model tools or model-driven database/provider calls;
- image similarity/cover comparison for duplicate detection;
- automatic duplicate merge;
- automatic publishing without owner review;
- exact physical quantity in public discovery;
- translation of the entire application UI;
- a promotions/coupon engine;
- payment, paid order, pickup, refund, ledger, or settlement implementation;
- manager/staff scanning in the pilot;
- continuous canonical metadata refresh.
- more than two metadata providers or automatic/dynamic provider promotion;
- provider-specific infrastructure per store, machine-learned routing, or dynamic cost auctions;
- Kubernetes, predictive autoscaling, multi-region workers, or per-language worker fleets;
