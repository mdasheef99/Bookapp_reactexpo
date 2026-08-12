# DOC-13: Implementation Tracker

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-08-13
**Status:** Live implementation tracker
**Depends On:** DOC-12 and all phase trackers in `implementation/`
**Purpose:** Track live implementation progress, blockers, deviations, and handoff state without turning source specifications into status logs.

---

## 1. Tracking Rules
This file is the master status board. It should stay concise.
Detailed implementation notes belong in the relevant phase tracker under [`implementation/`](./implementation/).
Every new session must start from repository `AGENTS.md`, [`implementation/ACTIVE.md`](./implementation/ACTIVE.md), this tracker, and the active phase session-start/tracker. Chat history and old root kickstart documents are not status authority.
Every coding session must update tracking before ending if it changes any of the following:
- phase status
- current milestone
- blockers
- risk level
- completed migrations/services/screens/tests
- RLS/security verification
- source-spec deviations
- next recommended task
- handoff notes
Every material session must also leave one exact active work unit and next authorized action in the active phase tracker, record verification/external mutations in its detailed log, and run the active continuity validator. When the active phase changes, update DOC-13, `implementation/ACTIVE.md`, both README handoffs, the outgoing/incoming phase trackers, and the current pointer in repository `AGENTS.md` together.

> 2026-08-09 Phase 9 schema-free Gemini JSON correction is locally complete.
> Gemini now receives JSON MIME mode and the flat `vision` prompt with no provider
> response schema; BookConnect retains strict local validation and unchanged
> M18/M19 mapping. Red-first proved the old request still carried the schema;
> final exact-path focused Jest is 59/59 and vision-worker TypeScript passes.
> The approved bounded capture returned eight observations and proved the exact
> local mismatches: provider `image_outcome: success` and one null
> `detected_language`. Red-first reproduced the failure; BookConnect now
> normalizes those aliases to canonical `analyzed` and `und`; later main-line
> live-payload evidence also maps known language names to BCP 47 tags, strips
> safe ISBN labels, and reconciles analyzed visible-book count to accepted
> observation count. Exact-path
> focused Jest is 60/60 and the vision-worker build passes. The separate final
> proof transmission was blocked by the approval boundary and remains pending
> explicit approval. M34, Git, Render,
> Supabase/jobs, metadata, Owner UI, inventory/publication, scheduler, and Unit 7
> remain untouched by this correction.

> 2026-08-09 Phase 9 corrected-production provider proof stopped before M34.
> Reviewed local `HEAD` is unpushed commit `dc19107`. The replacement Gemini key
> was installed only on the existing Render vision service and automatically
> caused one restart at prior source SHA `83cf61a`. The exact full committed
> request used the matching sanitized WebP and configured model but returned
> HTTP 400 `INVALID_ARGUMENT`. With image, prompt, model, and request otherwise
> unchanged, the core `vision` schema returned HTTP 200 when only the optional
> multilingual subtree was omitted; changing nullable encoding did not fix the
> full schema. M33 is live once as `20260809023834`; M34 remains unapplied. No
> job, database/Storage mutation, push, corrected deployment, metadata, Owner UI
> continuation, inventory/publication, scheduler, or Unit 7 action occurred.
> Next: smallest multilingual provider-schema compatibility correction, then
> rerun the exact provider-only request before any downstream execution.

> 2026-08-09 Phase 9 bounded local correction: Gemini now returns only compact
> visual identity plus optional compact multilingual enrichment, capped at five
> authors. Enrichment is non-fatal, original-script identity stays canonical,
> and selected session language is a hint in TypeScript and local forward M34.
> The independent review's required diagnostics correction now prevents bounded
> provider request IDs or error codes from carrying configured privileged values.
> Red-first evidence failed 1/22 analyzer and 1/6 egress assertions; corrected
> analyzer/egress Jest is 22/22 and 6/6, and the complete focused scope is 47/47.
> Vision-worker TypeScript and current-tree PGlite
> 59/59 through M32/M33/M34 passed. M34 is unapplied; no provider, Render, job,
> Supabase, inventory/publication, stage, commit, or push mutation occurred.
If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.
---
## 2. Current Status

> **2026-08-12 Unit 7A live proof completion checkpoint (04:41–~05:00 UTC):**
> `phase9-owner-ingestion` is ACTIVE as version 5. The deployed bundle contains
> the `add_to_inventory` member in the `allowedActions` enum in
> `supabase/functions/_shared/imageInventory/contracts/ownerUxResponses.ts`.
> This resolved the `OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` on
> candidate detail and exposed Add to Inventory.
>
> At 04:41 UTC, the authenticated Owner clicked Add to Inventory for candidate
> `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals` by P. F. Strawson) in
> session `166a20cb-c919-4e06-8e4a-1cd53e4ef393`. The first live commit created
> store_inventory row `5f5a2bc9-d702-4aeb-af55-2a9df6c16478` with
> `created_from_candidate_id=f6266e3a-e920-4fa0-a993-c02c739f5108`,
> `entry_method=image_extraction`, `visibility_status=draft`,
> `publication_status=private`, `selling_price_minor=250000`, and quantities
> `total/available/reserved/sold/removed=1/1/0/0/0`. Candidate readback is
> `state=committed`, `committed_inventory_id=5f5a2bc9-d702-4aeb-af55-2a9df6c16478`,
> `outcome=committed_private`; session `committed_count=1`.
>
> At approximately 05:00 UTC, the exact original command was replayed through
> the deployed Edge as the authenticated Owner with
> `idempotencyKey='commit:1779df52-2f35-413d-81f5-8c71769e176b'`,
> `commandId='9a1182db-6e96-4c24-b484-dad57 909818'`,
> `expectedCandidateVersion=2`, `expectedReviewVersion=1`, and
> `expectedMetadataRevision=4`. The response was the canonical recorded result:
> `inventoryId=5f5a2bc9-d702-4aeb-af55-2a9df6c16478`, `candidateVersion=3`,
> `inventoryVersion=1`, `outcome=committed_private`. Post-replay readback found
> one inventory row for the candidate, session `committed_count=1`, one completed
> idempotency row, one audit log, and one event: zero new effects.
>
> New verdict: `UNIT_7A_LIVE_PROOF` is **PASS** and
> `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY` is cleared. The controlled
> proof is complete: one Owner UI commit plus exact replay, both verified with
> zero side effects on replay. Unit 7B publication, Unit 7C post-commit edits,
> manual RPC fallback, and merge to `main` remain separately gated. The same
> session's `Thinking, Fast and Slow` candidate remains uncommitted
> (`review_ready=false`) and is not part of this proof. Supabase also reported
> an existing RLS-disabled advisory for three registry/system tables; no
> remediation was applied.

> **2026-08-12 current authority reconciliation — Unit 6 / Unit 7 sequencing:**
> The automatic/functional Unit 6 pipeline is **PASS**: M38 automatic proof
> completed media, vision/Gemini, metadata, and Owner-review handoff, with no
> inventory/listing side effects. Native Unit 6F validation remains deferred
> `NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery physical-device
> parity, native recovery/reconnect, 15-card representative-device
> performance, offline/reconnect, accessibility/large text, and low-end
> Android resource/performance. The project owner accepts this deferred native
> validation risk and authorizes Unit 7 to begin. This changes sequencing only;
> it does not alter Unit 6 requirements or acceptance criteria. The detailed
> Unit 6F evidence and AC36/AC39 mapping remain preserved in tracker 24.

> **2026-08-12 Unit 7A create-only planning checkpoint:** the Owner froze the
> controlled commit as create-only. Every eligible reviewed candidate commit
> creates exactly one new private inventory row from the current server-held
> saved review, with `total=available=q` and reserved/sold/removed all zero.
> Duplicate lookup, merge, increment, manual match, and “keep separate” are not
> Unit 7A behaviors; historical Unit 6 duplicate controls are superseded for
> this path and must be non-actionable/non-blocking before enablement.
> Publication is Unit 7B. The design is ready for separately authorized red
> tests and requires a forward migration; no test, runtime, migration file,
> database, external-service, or Git action occurred in this planning session.

> **2026-08-12 Unit 7A local implementation checkpoint:** the frozen create-only
> contract is implemented locally on
> `codex/phase9-unit7a-create-only-inventory` from exact `origin/main`
> `f2ccc6a20f065ec000fd3a3ac89ba4f014b52cb4`. Forward M39 adds the
> authenticated current-revision-fenced create command and revokes the unsafe
> M05 callable without deleting legacy history. Edge/mobile now expose only the
> strict online, non-optimistic add action; duplicate controls are non-actionable.
> Red-first dedicated PGlite is 13/13, Phase 9 Edge/mobile/migration regression
> is 42 suites and 479/479, and TypeScript passes with the documented import
> flag. Fresh read-only Supabase preflight verified the exact healthy project
> and M38 live tail; M39 remains unapplied. No database/Storage, deployment,
> provider, inventory/listing/publication, stage, commit, push, or PR mutation
> occurred. The next authorized action is complete local-diff review; live
> application/deployment, authenticated smoke, and Git publication require
> separate explicit authorization. [Detailed evidence](./implementation/phase-9-image-inventory/trackers/29-unit7a-create-only-commit-evidence.md).

> **2026-08-12 Unit 7A M39 application checkpoint:** exact-project schema,
> security, migration-history, and existing-data preflight passed on
> `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`; genuine PostgreSQL 17
> independent-connection exact-replay and competing-command contention passed.
> Reviewed M39 was applied once with no retry and is live as
> `20260812003419 marketplace_phase9_create_only_inventory_commit`. Immediate
> readback matched the reviewed function body and authenticated-only ACL, kept
> internal helpers restricted, and confirmed M05 has no application-role
> execution. Pre/post counts were identical: inventory/listings `5/5`, no
> inventory/public-media links, unchanged candidate/session state, and zero
> Unit 7A idempotency/audit/event effects. Edge/runtime deployment and the
> controlled live Add-to-Inventory/exact-replay proof remain `NOT_RUN`.

> **2026-08-12 Unit 7A Owner Edge deployment blocker:** the M39 evidence commit
> was pushed normally to the feature branch. Dependency tracing selected only
> `phase9-owner-ingestion`, and its focused Edge/runtime/security suites passed
> 182/182. The one authorized deployment attempt failed during bundling before
> activation: `domain/validation.ts` imports `../contracts/registers` without a
> `.ts` extension. No retry, source repair, database mutation, or unrelated Edge
> deployment occurred. Owner Edge version 3 remains ACTIVE with JWT verification;
> pre/post inventory, listing, candidate, session, idempotency, audit, event,
> media, and publication state is identical. Live Unit 7A proof remains blocked.

> **2026-08-12 Unit 7A corrected Edge deployment and controlled-proof stop:**
> the corrected `phase9-owner-ingestion` bundle is active as version 4 with
> deployment ID `f8aec89f-ae2a-431a-8a97-5775a2405b90`; the deployment attempt
> budget is exhausted at `1/1`. Exact-project read-only preflight and readback
> confirmed M39 exactly once, the authenticated-only Unit 7A RPC ACL, M05
> revocation, and the unchanged zero-effect baseline. The authenticated Codex
> Browser Owner path selected existing eligible reviewed candidate
> `d61d2193-4674-49d1-ae09-aed120dfe261` with reviewed quantity `q=1`, but its
> candidate-detail route failed twice and never exposed Add to Inventory. No
> RPC fallback, commit, replay, or business mutation occurred; final readback
> remains inventory/listings `5/5`, candidates `18 ready/36 needs_review/1
> failed`, committed total `0`, Unit 7A idempotency/audit/event `0/0/0`, and
> inventory-media links `0`. Exact verdict:
> `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`. Next: restore the functioning
> authenticated Owner candidate-detail/Add-to-Inventory path, then resume only
> the authorized one commit followed by exact same-command replay. Unit 7B/7C
> and manual RPC remain out of scope.

> **2026-08-12 latest Owner review-save result:** after the new one-image scan,
> the user authorized saving candidate
> `5b8a7220-d460-40fc-ad5c-330c84d69903` with an invented private price of
> `250000` paise. The save path succeeded: the candidate is `ready`,
> `reviewed`, `review_ready=true`, quantity `1`, and has no committed
> inventory ID. Opening its next-step detail failed on the initial load and
> exact retry, so Add to Inventory was never exposed. Read-only readback shows
> inventory `5`, session committed total `0`, Unit 7A idempotency/audit/event
> `0/0/0`, and all five existing inventory rows still private. The latest
> gate remains `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`.

> **2026-08-12 fresh-image observation:** the user-started session
> `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one image, then media
> validation moved to a retryable failure. Final read-only readback shows the
> input `skipped` with `quality_reason=P9_OWNER_REMOVED`, its job cancelled at
> attempt `2/5`, and zero candidates/commits. This observation did not change
> the Unit 7A proof verdict; the removed input must not be revived without a
> new explicit target decision.

> **2026-08-12 fresh-processing continuation:** the same session later
> accepted a second image and completed successfully with two candidates:
> `Individuals` / `P. F. Strawson` and `Thinking, Fast and Slow` / `Daniel
> Kahneman`. Both are `state=ready` but `review_ready=false`. The first review
> screen loads matched metadata and remains private, but price and Owner
> confirmations are still required; no new review or inventory write was made.

> **2026-08-12 latest fresh review action:** candidate
> `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved privately
> with quantity `1` and price `250000` paise. Server readback confirms
> `ready`/`reviewed`/`review_ready=true`, but its next-step detail failed twice
> and never exposed Add to Inventory. Inventory remains `5`; Unit 7A
> idempotency/audit/event remains `0/0/0`; no inventory commit occurred.

> Historical pre-correction status marker preserved for continuity:
> `unit7a_edge_deployment_blocked_by_source_routing_mismatch`.
> Historical phase-table status marker: | Phase 9: Image-to-LLM Inventory | `unit7a_edge_deployment_blocked_by_source_routing_mismatch` |

> 2026-08-11 Phase 9 multilingual vision-response resilience correction:
> user-supplied physical Android evidence closes the native FileSystem transport
> proof through signed Storage `2xx`, exactly one object, input registration, and
> sanitation. The downstream Gemini job then failed deterministically as
> `P9_VISION_SCHEMA_INVALID`; the input was later removed and remains untouched.
> Red-first local correction now converts bounded 16-100 count/array evidence to
> complete-image `too_many_books`, preserves Unicode while bounded unknown human
> language labels degrade to `und`, isolates optional enrichment, and emits only
> closed content-free schema diagnostics. Resilience passes 21/21; existing
> analyzer/captured payload plus resilience 46/46; focused worker/extraction/
> multilingual/security/Unit 6 polling 120/120; Image Inventory 294/294;
> repository TypeScript and the vision-worker build pass. No migration, remote
> mutation, deployment, provider call, Git publication, removed-input retry, or
> Unit 7 action occurred. Next: bounded review, then separately authorized
> deployment and one fresh post-deployment Android image proof.
>
> 2026-08-11 Phase 9 native transport replacement: the bounded local correction
> now explicitly preserves the proven browser Blob/FormData XHR path and routes
> Android/iOS through Expo FileSystem `UploadTask` with URI-backed
> `BINARY_CONTENT`, signed `PUT`, exact file-size and MIME/header validation,
> native byte progress, cancellation, and bounded secret-safe HTTP diagnostics.
> Red-first transport coverage is 6/6; focused capture/upload is 37/37; the full
> Image Inventory scope is 39 suites and 294/294; repository TypeScript passes.
> At that local checkpoint no fresh Android proof or external mutation had
> occurred. The later physical proof recorded above passed Storage `2xx` and
> registration, superseding that transport gate. The separate deployed
> `P9_SINGLE_IMAGE_LIMIT` mapping drift remains unchanged and no Edge deployment
> is authorized.
>
> 2026-08-11 Phase 9 mobile upload correction: read-only evidence isolated the
> failed Android path to the signed Storage PUT after successful capability and
> signed-URL issuance and before object creation/registration. The narrow local
> fix sends raw `ArrayBuffer` bytes with explicit MIME/cache headers instead of
> React Native `Blob`/`FormData`, preserving progress, cancellation, size,
> registration, and retry behavior. Red-first transport coverage, focused
> capture/upload tests (26/26), all Image Inventory tests (290/290 reported
> passing), and repository TypeScript pass. No post-fix native upload or other
> external mutation occurred; native runtime proof remains separately gated.
>
> 2026-08-11 authorized native follow-up: Expo Go raw-byte PUTs reached Storage
> but returned HTTP 400; no object or input was created. A later development
> reload caused reauthorization while the prior capability remained live. The
> database raised `P9_SINGLE_IMAGE_LIMIT`, but deployed Edge version 3 mapped it
> to generic HTTP 500. Further correction or deployment is not authorized.
> 2026-08-10 Phase 9 Unit 6 closure: `origin/main` is published at exact
> approved SHA `a138baa7d3bbc086da019bc052a5ae31d0e15882`; M38 is live once as
> `20260810130638 marketplace_phase9_metadata_retry_correction`; and only the
> metadata worker was redeployed, exactly once, from that SHA. One authenticated
> Owner upload automatically completed media, vision/Gemini, six metadata jobs,
> and the Needs Review UI. There were zero manual runs/claims/repairs/operator
> retries, inventory/listings stayed 5/5, and the historical failed metadata job
> was untouched. Duplicate replay was not tested and Unit 7 was not started.
> Unit 6 closure verdict is `PASS`; no next work unit is authorized.
> 2026-08-10 Phase 9 metadata retry/provider-attempt correction is locally
> implemented red-first on a fresh `origin/main` branch. Exact-project read-only
> evidence confirms M32-M37 live exactly once. Forward-only M38 adds metadata
> context v2 with the selected physical call's claim-attempt number; later claims
> no longer replay an older retryable provider result, while same-claim and
> terminal-result reconciliation remain spend-safe. Focused metadata Jest is
> 148/148 and full Phase 9 PGlite is 242/242; metadata build, entrypoint smoke,
> and deployment-runtime validation pass. The exact Google Books HTTP 503-to-200
> regression proves two fetches and two physical calls across claim attempts 1
> and 2, successful ready-state resolution, and no dead-letter/exhaustion. The
> independent correction-only verdict is `APPROVED`. M38 is local/unapplied. No database,
> deployment, provider, job, media/vision, query-policy, Unit 7, inventory,
> listing, or publication mutation is authorized in this correction session.
> Correction commit `8c55fea` is published on
> `codex/phase9-metadata-retry-correction`; this Git-only effect did not mutate
> Supabase, Render, providers, jobs, Storage, inventory, listings, or publication.

> 2026-08-10 Phase 9 Unit 6 pre-main reconciliation has assembled an isolated
> candidate from fresh `origin/main` `388d8bf`. Merge checkpoint `8e327d7`
> contains the complete packaged M32/M33/M35/Unit 6/runtime source, exact M36
> dispatcher ancestry, and the proven Google Books `projection=full` correction.
> Unrelated Store Owner Orders and Phase 4 content plus superseded Gemini tree
> content were restored to authoritative `origin/main` versions before commit.
> The prior complete candidate gate remains green; immutable-M35/local-M37
> corrections pass focused Jest 5 suites/189 and Phase 9 DB continuity 241/241.
> Independent final correction-only re-review remains, and `origin/main` push
> requires a new explicit user instruction. M36/M37 application and all
> Supabase, Vault, Cron, Render, worker/provider, Storage, live-image,
> duplicate-replay, Unit 7, inventory, listing, and publication mutations remain
> prohibited.

> 2026-08-09 Phase 9 metadata-runtime safety checkpoint: M32 remains live exactly
> once on verified healthy project `ahntbtktjjmvfosgkmgn`. Shared worker startup
> now fails closed on any non-approved Supabase origin; metadata no longer accepts
> the media/vision peer fingerprint; and the bounded manual invoker supports
> `metadata`. Focused changed-scope Jest is 84/84 and the metadata-worker build
> passes. Exactly one process-only Google Books adapter request returned HTTP 200;
> the credential was accepted and bounds/decoder/provider-neutral normalization
> passed with `no_acceptable_match`. No candidate, privileged worker,
> database/provider persistence, Gemini/Render change, deployment, scheduler,
> inventory/publication, Unit 7, or Git mutation occurred. The one-candidate proof
> still requires separate authorization and a fresh process-only Google Books key after revocation of
> the chat-exposed temporary key. A sanitized JWT inspection and authenticated
> read on 2026-08-09 proved that the inherited service-role key belongs to and
> is accepted by the exact project; only the inherited `SUPABASE_URL` is foreign
> and must be overridden for the worker process.

> 2026-08-09 authorized Expo web proof: the legitimate Profile → Store Owner
> Console → Inventory path loaded under the authenticated Owner session. The
> screen resumed an older capture with 6 processing images and 1 review item;
> exact-project read-only baseline was 4 sessions, 3 active/closing, 18 inputs,
> 27 jobs, 8 pending jobs, 13 candidates, and zero metadata jobs/attempts/
> provider calls/lookups/cache entries. Because the shared worker queue could
> not be isolated to a fresh image, and no Google Books credential was present
> in the process, the proof stopped before session creation or upload. No
> database, Storage, Gemini, Google Books, worker, or provider mutation occurred.

> 2026-06-30 refresh: Phase 1 foundation remains applied in live Supabase. Phase 2A Store Owner gate/auth/security hardening is implemented locally and its write-boundary hardening migration is applied live. Phase 2B has controlled store application/document writes through the `store-application` Edge Function, app service wrappers, onboarding UI, metadata persistence, pilot locality validation, sanitized DB errors, and private document upload tests. Phase 2C platform review/setup entitlements is implemented locally and deployed: review metadata migration is live, `store-review` is deployed with JWT verification enabled, and Store Owner setup/status screens exist. Phase 2B authenticated live smoke passed; Phase 2C unauthenticated live smoke returned `401`; authenticated platform-review smoke is pending platform-operator test credentials. Phase 3 manual inventory/canonical/listing projection migration is applied live through Supabase MCP and schema/RLS verified. A 2026-06-29 Supabase MCP smoke confirmed the inventory trigger projects a publishable row into `marketplace_book_listings`, then cleaned up the disposable smoke inventory/listing and restored the store fixture. Anonymous public-read smoke is still blocked by the public listing RLS policy calling `marketplace_sec` helper functions that `anon` cannot execute. Phase 4 Store Owner Console is locally complete: dashboard, owner inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, route tabs, and focused tests are implemented with TypeScript and web export passing.

> 2026-07-15 review refresh: Git is synchronized by content with the recently merged `origin/main`. Supabase MCP and `.env` both identify project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`). Phase 4 remediation adds the controlled `store-profile` function, approved-store setup completion, stricter checklist readiness, inventory workflow fixes, and migration `20260715000001_marketplace_phase4_security_hardening.sql`. Store tests pass 13 suites/118 tests; TypeScript and production web export pass. The migration is live as `20260715115929 marketplace_phase4_security_hardening`; grants verify `anon=false`, `authenticated=false`, `service_role=true`. `store-profile` version 1 is ACTIVE with `verify_jwt=true`; unauthenticated live smoke returned `401`. Positive authenticated owner-write smoke awaits an approved disposable credential.

> 2026-07-15 Phase 5 review refresh: Consumer discovery is locally complete after red-test remediation. Public-only services now include runtime validation, safe filter construction, explicit paging/retry, store-name discovery, and book availability detail. Migrations `20260715155047 marketplace_phase3_public_listing_policy_split` and `20260715155103 marketplace_phase5_discovery_hardening` are live and read-only verification confirms the anonymous/authenticated policy split, pilot-locality eligibility, private inventory/analytics boundary, constrained boolean demand RPC, rate limiting, and 90-day retention. Relevant Jest 8 suites/54 tests, TypeScript, production web export, and `git diff --check` pass. No fixture or RPC smoke write was performed; positive discovery smoke remains fixture-gated.

> 2026-07-15 Phase 5 acceptance refresh: The authorized positive smoke exposed private-`stores` RLS evaluation returning zero public rows. Red-first migration `20260715000003_marketplace_phase5_public_policy_projection_fix.sql` now evaluates public eligibility through `public_store_profiles` plus the pilot locality and is live as `20260715174111 marketplace_phase5_public_policy_projection_fix`. Anonymous/authenticated title, author, ISBN, store, profile, book-detail, canonical grouping, offer comparison, private-boundary, demand-RPC, disabled-locality, and cleanup checks all pass. Targeted Jest passed 8 suites/52 tests and TypeScript passed. Phase 5 is complete and accepted; Phase 6 was not started.

> 2026-07-16 Phase 6 monolith correction: the exact v0.1 pasted monolith is preserved in the implementation archive and the corrected v0.2 monolith is the sole normative Phase 6 SDD. The intentionally deleted three-document split must not be restored. The corrected design includes direct request creation plus separate cart transition evidence, entitled-Owner availability before submission, cross-table enforcement, safe projections, no substitutions, independent support-task versioning, exact pg_cron/Edge worker architecture, deterministic tariff, fixed ISO-date SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical commerce inbox behavior. Local implementation is authorized only after the Stage 4 documentation validation verdict; remote/live changes remain separately gated.

> 2026-07-17 Phase 6 checkpoint refresh: Phase 5 remains complete. Phase 6 Units 1-15 are source-complete, migrations M01-M39 were applied to the development Supabase project, and persisted command/authorization behavior was verified through provider-independent `payment_ready`. M34-M39 are forward-only corrective migrations added after the initial M01-M33 apply. The prior complete repository checkpoint passed 908/908 tests, TypeScript, and production web export. Initial browser authentication/navigation/Marketplace/cart-empty smoke passed without console errors and controlled `phase6_browser_*` development fixtures remain available. The development scheduler rollout is active: scheduler v5 uses custom-secret authentication, worker v2 keeps strict service-role authorization, and scheduler dispatch explicitly forwards its server-side service-role bearer token. Cron job 5 runs each minute; the first scheduled empty-queue run and tagged synthetic dispatch/retry/dead-letter paths passed, with focused regression 4/4. Comprehensive customer/Store Owner browser E2E, browser-created persisted-effect verification, full responsive/accessibility review, and real timed commerce-command verification remain deferred. This is not a production-readiness declaration; Phase 7 is not started.

> 2026-07-18 Phase 6 completion and roadmap decision: Supabase MCP readback reconfirmed the healthy `Bookconnect_reactexpo` development project, all M01-M39 Phase 6 migrations, RLS on authoritative Phase 6 tables, active scheduler v5/worker v3, and successful one-minute cron job 5 executions. Existing inventory has zero quantity-balance violations; the equality constraint remains `NOT VALID` and must be validated by a forward migration before production. Phase 6 is recorded as complete with comprehensive browser E2E, responsive/accessibility review, browser-created persisted-effect review, and real timed commerce-command E2E deliberately deferred. Phases 7 and 8 are deferred by product decision. Phase 9 planning is now the active milestone and must remain independent of payment, paid-order, pickup, ledger, refund, and settlement behavior.

> 2026-07-19 Phase 9 planning refresh: the complete Phase 9 planning set was drafted under `implementation/phase-9-image-inventory/` with a master SDD, six domain SDDs, data dictionary, live database/storage current-vs-target audit, requirements traceability, complexity register, and three-level local tracker split. Supabase was re-verified read-only as project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`); `store_id` is canonical (37 public-schema columns, zero `tenant_id`). Phase 9 begins with camera/gallery same-language spine stacks capped at 15, provider/model adapters, mandatory owner review, advisory duplicates without image comparison, multilingual search aliases, separate damage/media, bookstore-first discovery, and mandatory customer-requested current-copy photos. Repository `AGENTS.md`, `implementation/ACTIVE.md`, Phase 9 `SESSION-START.md`, tracker markers, update matrix, and a read-only continuity validator now provide deterministic new-session resume/closeout. The user approved this planning baseline on 2026-07-19 and authorized the Work Unit 0 plan only. No Phase 9 migration, code, function, bucket/policy, or data mutation occurred.

> 2026-07-19 Phase 9 Work Unit 0 checkpoint: the [contracts/threat/migration-design plan](./implementation/phase-9-image-inventory/work-units/00-contracts-threat-migration-plan.md) is complete and pending user review. It defines versioned internal adapter contracts, recorded fixtures, deterministic and cross-tenant security tests, a six-step expand/backfill/validate/switch migration sequence, forward-correction rules, and explicit pre-migration gates. A fresh exact-project read-only Supabase audit confirmed the baseline facts and pre-existing security backlog. No product code, migration file, provider call, bucket/policy, or Supabase/storage mutation occurred.

> 2026-07-19 Phase 9 WU0 approval refresh: the user accepted the `approved_with_required_corrections` review and authorized documentation correction/commit only. The approved WU0 now separates automated alias proposals from bounded official/verified aliases; excludes private request photos from duplicate identity; locks initiator-only pilot session authority and terminal-input Close; preserves private inventory on publication failure; requires central validation/error/provider/query/grant registers; strengthens privilege/security gates; clarifies the `NOT VALID` quantity gate; and uses eight logical migration groups. WU0A contract/test implementation, migration-file creation/application, provider calls, storage changes, and product code remain unauthorized.

> 2026-07-19 Phase 9 WU0A checkpoint: the user explicitly authorized the bounded server contract/test foundation. Versioned vision, metadata, alias, and marketplace contracts; strict fail-closed parsers; ISBN/BCP 47/fallback/session/duplicate/quantity/publication helpers; central validation/error/provider-reuse/grant/query registers; sanitized synthetic fixtures; and future red implementation gates now exist under the shared server boundary. Focused Jest passed 4 suites/24 tests, all Edge Function test files passed 9 suites/36 tests, and strict standalone TypeScript passed. No migration, callable endpoint, database/storage/provider/network operation, mobile/product write, deployment, or Supabase mutation occurred. WU0A is complete; no later unit is authorized.

> 2026-07-19 Phase 9 WU0A independent approval: an authorized independent review classified every working-tree file and found correctable contract/test gaps, with no unrelated or sensitive change. Corrections centralized limits, required configured HTTPS cover hosts, completed server-owned adapter envelopes and session/publication semantics, strengthened grant/query/privacy registers, and expanded adversarial/no-match/alias fixtures. Final focused Jest passed 4 suites/41 tests, all Edge Function tests passed 9 suites/53 tests, and strict standalone TypeScript passed. WU0A is approved complete. Migration creation/application, callable endpoints, providers, storage, UI/product writes, and external mutations remain unauthorized. WU0B backend/API technical design is next eligible but requires separate authorization.

> 2026-07-19 Phase 9 WU0B definition checkpoint: a planning-only WU0B document now defines the future command/query/DTO inventories, actor and authorization matrix, state/transaction/idempotency boundaries, worker/provider/marketplace/privacy design requirements, red-test mapping, acceptance/non-goal criteria, exact later file-allowlist requirement, and separately ordered review/audit/migration gates. The repository startup chain is normalized as `AGENTS.md` → `ACTIVE.md` → DOC-13 → Phase 9 `SESSION-START.md` → Phase 9 `TRACKER.md`. The definition is not independently reviewed and grants no WU0B implementation authority. No runtime, test, migration, Supabase/Storage, provider, dependency, GitHub, or other external mutation occurred.

> 2026-07-20 Phase 9 WU0B definition-review correction: the independent review returned `approved_with_required_corrections`. The documentation-only correction now routes ACTIVE.md to WU0B, separates scan/public-copy/request-photo upload authority, adds post-commit inventory command coverage, makes listing matching service-internal and public pagination store-grouped, separates implementation completion from independent approval, and hardens the continuity validator against stale ordering and contradictory authority text. Independent re-review remains required. WU0B implementation, runtime endpoints, migrations, Supabase/Storage, providers, UI, and external mutations remain unauthorized.

> 2026-07-20 Phase 9 WU0B definition independent approval: the complete corrected documentation/validator diff was re-reviewed. A missing intermediate definition-approved marker was added so approval cannot be confused with implementation authority. Final verdict is `approved`. The next eligible action is separate authorization for bounded WU0B technical-design implementation only; runtime endpoints, migrations, Supabase/Storage, providers, UI, and Phase 7/8 behavior remain unauthorized.

> 2026-07-20 Phase 9 WU0B technical-design completion: the authorized documentation-only implementation now provides seven bounded artifacts covering 26 commands, 11 queries, DTO/error/rate contracts, authorization/tenancy/privacy, state/transaction/idempotency/publication, jobs/providers/media/lifecycle, marketplace/request-photo seams, red tests, audit questions, and exact proposed later file paths. The authority document routes the artifact set and the validator enforces completeness, size and gate integrity. WU0B is `implementation_complete_needs_review`, not independently approved. No Supabase query/mutation, migration, runtime/test/config/dependency/generated change, provider call, Storage/UI change, deployment, push or merge occurred during this work unit.

> 2026-07-20 Phase 9 WU0B semantic-review correction: an independent review returned `rejected_needs_redesign` on four bounded design gaps. Author corrections now require Owner quantity/price/terms confirmation and an atomic soft hold before request-photo acceptance; use Master SDD §6 as the sole persisted session/input/candidate vocabulary; assign primary boundaries, SDD/WU0A traces, red tests and future units to C01–C30/Q01–Q11; and give every red test exact source ownership and implementation responsibility. WU0B remains `implementation_complete_needs_review` pending a fresh focused reviewer. No Supabase audit or later gate has started.

> 2026-07-20 Phase 9 WU0B focused re-review correction: the focused verdict was `approved_with_required_corrections` because three persisted-state claims still conflicted with their owning SDDs and the validator checked only positive markers. The bounded correction now uses request-photo `none`; records `skipped_false_detection` as a review disposition without inventing a candidate state; maps hold status to `active|released|converted_to_sale` while expiry releases a hold; and makes all three contradictory forms validator failures. WU0B remains `implementation_complete_needs_review` pending a new context-isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B final-review correction: the next isolated verdict was `approved_with_required_corrections` on two narrow ambiguities. C12 and Q11 now select one `AE` authenticated actor-dispatch boundary that rejects mixed/unknown credentials and selects closed Owner/worker or customer/Owner authorization and projection branches. The validator now scans every WU0B artifact for closed state claims and semantic variants rather than three literal phrases; photo, candidate-disposition and hold-expiry wording-variant negative probes pass. WU0B remains `implementation_complete_needs_review` pending a final context-isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B implementation-ownership/semantic-closure correction: a further isolated review showed C12 lacked one exact future boundary file and the validator missed workflow/lifecycle/terminal/persisted-as/transition/arrow wording. C12 is now owned only by the proposed `image-inventory-publication-retry` endpoint, with Owner and worker entrypoints forbidden from duplicating it; Q11 remains request-photo-boundary-owned. Closed state parsing and eleven negative probes cover the reported variants while preserving valid photo expiry versus hold release. WU0B remains `implementation_complete_needs_review` pending another isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B direct-claim closure correction: repeated isolated fuzz review confirmed C12/Q11 ownership but expanded the semantic surface to direct/hyphenated persisted claims, direct state/status/workflow/lifecycle assignments including `=`/`:`, generic terminal, becomes/advances/transitions, `from ... to|into|arrow ...`, possessive declarations, and label/parenthesized arrows. A normalized domain-aware parser now validates a generated 105-case five-domain/twenty-one-form matrix plus two special disposition/photo probes, alongside two C12 ownership/duplication probes. WU0B remains `implementation_complete_needs_review` pending another isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B final independent approval: the final context-isolated review returned exact verdict `approved`. The existing continuity evidence passes 107 semantic cases plus two C12 ownership/duplication probes, and the bounded set remains documentation/validator-only. WU0B is `independently_approved`. The next action is a consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, migrations, runtime implementation and merge to `main` remain unauthorized.

> 2026-07-22 Phase 9 bounded contract correction: the authorized correction aligned canonical alias vocabulary and lifecycle-only supersession, separated zero-price private save from positive-price publication, removed `committed_publication_failed` from persisted state vocabularies, completed exact C01–C30/Q01–Q11 stable-error mappings and metadata, excluded interactive support takeover/cross-store private access, and added the missing contract/design verification rows while preserving later runtime/release gates. Focused WU0A Jest passed 4 suites/45 tests; TypeScript, continuity/link/size checks, 107 semantic cases, two C12 probes, and `git diff --check` passed. A fresh correction-only review returned exact verdict `approved`. No Supabase access, migration, provider/storage action, runtime implementation, or deployment occurred.

> 2026-07-22 Phase 9 Package 1 audit checkpoint: user-authorized exact-project read-only Supabase audit verified project `ahntbtktjjmvfosgkmgn`, live history through Phase 6 M39, canonical `store_id` tenancy, catalogue/inventory/listing/quantity/condition/provider compatibility, RLS/grants/functions/triggers, Storage, reusable Phase 6 infrastructure, and advisor findings. Two bounded artifacts now record current evidence, the gap matrix, exact proposed schema/RLS/function/index/storage changes, eight migration groups, failing security tests, and genuine blockers. No migration/runtime file was created and no database, Storage, provider, deployment, or external mutation occurred. Package 1 is `audit_complete_needs_review`; migration tests, file creation, and live application remain separately gated.

> 2026-07-22 Phase 9 Package 1 review correction: the six required findings are corrected documentation-only. The design now gives an executable legacy-condition compatibility sequence; persisted purpose/path/entity-bound single-use capabilities for C02/C03, C15/C16 and C20/C21; named-only private access with separate worker/service grants; unique cost reservations on `(store_id, job_id, cost_kind, policy_version)`; exact deferred-FK addition groups; and eight additive Phase 9 groups plus separately reviewed/authorized M09 quantity validation with preflight. Package 1 is `corrections_complete_needs_review`; no Supabase re-query/mutation or migration/runtime file occurred.

> 2026-07-22 Phase 9 Package 1 independent approval: the correction-only reviewer returned exact verdict `approved` and verified all six findings, the 107 existing semantic negative cases, both C12 probes, and unchanged WU0A/WU0B validation strength. Package 1 is `independently_approved`. Failing tests, migration-file creation, M09/live application and runtime remain separately unauthorized. No reviewer edit or Supabase query/mutation occurred.

> 2026-07-22 Phase 9 Package 1 M01-M08 implementation checkpoint: the initial contract suite failed 17/17 with the files absent; M01-M08 now pass 12/12 focused static contracts, 19/19 isolated database/security checks, 26 migration suites/206 tests, and 9 Edge Function suites/57 tests. TypeScript, continuity, and whitespace checks pass. A focused independent database/security review and correction-only follow-ups returned exact verdict `approved`. M09 was not created or validated. No migration was applied to connected Supabase and no Storage, function deployment, provider, UI, or runtime mutation occurred. Status is `package1_m01_m08_independently_approved_not_applied`.

> 2026-07-22 Phase 9 Package 1 live application: repository preparation fast-forwarded and pushed `main` at `69edd90`, then created `phase9-db-live-application`. Exact-project preflight on `ahntbtktjjmvfosgkmgn` was clean. M01-M05 applied and were readback-verified. M06 failed atomically with PostgreSQL `42501 must be owner of table objects` because `storage.objects` is owned by `supabase_storage_admin`; it has no history row and left no bucket/policy residue. M07-M08 were not attempted. M09 was not created/applied. Auth hardening/runtime work was untouched and is deferred to a separate session/branch before private-ingestion mobile integration.

> 2026-07-22 Phase 9 Package 1 live continuation: live readback proved `storage.objects` RLS was already enabled. Correction commit `e07efa1` removed only the redundant owner-only RLS statement from unapplied M06, added policy-preservation contracts, passed focused/full validation, and received independent correction-only approval. M06-M08 then applied once as `20260722095443`, `20260722095545`, and `20260722095729`. Verification stopped because M08's broad public-function grant loop revoked anonymous execution from the three M07 discovery RPCs. M01-M08 remain live and immutable; a separately reviewed forward grant correction is required. M09, auth, providers, mobile, and runtime remain untouched.

> 2026-07-22 Phase 9 Package 1 live verification accepted: red-first forward migration M10 restored `anon` execution to exactly the three public discovery RPCs, made the 24-field projection `security_invoker=true`, and removed all direct client/service view grants without exposing underlying tables. Focused contracts passed 3/3, isolated database/security 20/20, migration regressions 27 suites/209 tests, Edge/security 9 suites/57 tests, TypeScript, continuity, and whitespace checks; independent correction-only review was `approved`. Commit `31253ad` was pushed before M10 applied once as `20260722125256 marketplace_phase9_public_boundary_security_correction`. Live readback proves zero other anonymous Phase 9 RPCs, authenticated-only request-photo RPCs, service-only helpers, zero private client table grants, and removal of the Phase 9 `security_definer_view` advisor error. M09 remains absent and the quantity CHECK remains `NOT VALID`; auth/providers/mobile/runtime remain untouched.

> 2026-07-22 auth hardening checkpoint: approved Work Units 1 and 2 are locally complete and the correction-only final review returned `APPROVED` on `codex/auth-hardening-core`. Production bypass requires development runtime, development app environment, and explicit opt-in; preview/production opt-in is rejected. Zustand owns canonical session/status and one root bootstrap owns guarded restoration. Current-device logout now persists a non-secret deletion-intent marker, retries only the exact Supabase token key after SDK failure, and blocks restart restoration until removal succeeds. Identity replacement remains hidden through cleanup failure and an explicit root retry. Focused verification passed 11 suites/84 tests, isolated TypeScript, and diff hygiene; the reviewer independently passed 7 suites/52 tests. Secure persistence, Android backup, authoritative profile completion, OTP UX, native/offline verification, remote EAS verification, M09, and Phase 9 runtime remain separately gated. No database, Supabase, Storage, migration, deployment, or external mutation occurred.

> 2026-07-23 Phase 9 ingestion-runtime dedicated-worker closeout: the accepted database checkpoint remains `package1_m01_m08_m10_live_verified`. Local M11 and runtime now enforce initiating-Owner/server-path intake, immutable canonical completion replay, content-hashed service-only source snapshots, opaque token-and-attempt lease fencing, retry-safe partial completion, 10 MiB/16 MP and multi-frame rejection, private sanitized linking, and exactly one vision job. ImageMagick WASM sanitation remains outside Edge in a dedicated service-authenticated claimed worker; its 64 MP internal working allowance does not change the 16 MP source ceiling. Focused Jest passed 9 suites/74 tests, Phase 9 PGlite passed 26/26, and both TypeScript checks passed. Three local 8/12/16 MP runs each passed WebP correctness, metadata removal, and stable hashes; median times were 11.77/11.40/14.27 s and ending RSS 169/191/225 MB. A read-only independent review of the current unstaged candidate found one stale M06 Storage-documentation contradiction; after correction, re-review found no remaining merge blocker. This is sizing evidence only. Nothing was applied, deployed, staged, committed, pushed, or merged.

> 2026-07-26 Phase 9 Unit 4 SDD-readiness checkpoint: the ingestion foundation is now accepted as committed on `main` at `0a8e57a`; M11 remains unapplied and both ingestion services remain undeployed. Exact-project read-only Supabase verification reconfirmed M01-M08/M10 as the live tail, worker-ID-fenced generic jobs, private extraction-table grants, no M11/vision RPCs, incomplete immutable candidate provenance, and no deployed ingestion/vision function. The focused Unit 4 design finalizes `p9-vision-v2`, deterministic count/language/repeated-position rules, token/attempt state transitions, one authoritative evidence/candidate/completion transaction, exact replay after response loss, minimum forward M12, stable errors, privacy allowlists, and 31 red-first cases. No code, test, migration file, provider call, Supabase/Storage mutation, deployment, stage, commit, or push occurred.

> 2026-07-26 Phase 9 Unit 4 local implementation checkpoint: the accepted design is implemented with strict `p9-vision-v2`, deterministic `FixtureSpineImageAnalyzer`, platform-owned count/language/repeated-position policy, a dedicated service-authenticated worker, and forward-only local M12 `20260726000012_marketplace_phase9_vision_analysis_runtime.sql`. M12 adds immutable image/observation evidence, candidate provenance/publisher clues, vision-specific attempt/token-fenced claim/context/persist/fail RPCs, exact completion replay, service-only grants, and no inventory/publication/metadata effect. Verification passed 16 Phase 9 Jest suites/108 tests, Phase 9 PGlite 39/39, repository TypeScript, and strict vision-worker TypeScript. M11/M12 remain unapplied, all services remain undeployed, and no provider, Supabase/Storage, stage, commit, push, or merge action occurred.

> 2026-07-26 Phase 9 Unit 4 first-review correction checkpoint: the independent review returned `CHANGES_REQUIRED`. Corrections now require exact authoritative current-claim validation before any job mutation, use existing `resolved` for stale-safe job-only reconciliation of invalid/missing input/session/media relationships, clear leases, and persist/return only bounded safe results. M12 now owns canonical UTF-8 byte counting, SHA-256, and recursive result validation; worker transport uses exact typed safe-code mapping. Verification passed 16 Phase 9 Jest suites/116 tests, Phase 9 PGlite 52/52, repository TypeScript, strict vision-worker TypeScript, continuity, and diff hygiene. Correction-only independent re-review is next. M11/M12 remain unapplied, services undeployed, and no provider, Supabase/Storage, stage, commit, push, or merge action occurred.

> 2026-07-26 Phase 9 Unit 4 final correction checkpoint: the last bounded review identified database retryability ownership, catch-all RPC behavior, absolute/UNC path validation, and executable boundary coverage. PostgreSQL now derives retryability from a closed safe-code catalogue; rejected RPC promises and unknown permanent domain failures have separate bounded classifications; TypeScript/SQL reject path-shaped evidence without rejecting slash prose; and PGlite covers every authoritative RPC plus exact 262,143/262,145-byte canonical boundaries. Final verification passed 16 Phase 9 Jest suites/132 tests, Phase 9 PGlite 57/57, repository TypeScript, strict vision-worker TypeScript, continuity, and diff hygiene. Final Git integration of this exact candidate is authorized; M11/M12 remain unapplied, all services remain undeployed, and no provider, metadata, inventory/publication, Supabase, or Storage operation occurred.

> 2026-07-26 Phase 9 deployment-runtime scaffolding checkpoint: Unit 4 is integrated on `main` at `e9ba2d9`. Local Work Unit 4A adds provider-neutral executable Node services for sanitation and fixture vision, strict positive-allowlist environment loading, distinct-secret fingerprint checks, non-mutating health/readiness, one-request concurrency, bounded bodies, graceful shutdown, safe structured logging, dynamically request-bound allowlisted fixtures, a sanitized manual invoker, deterministic builds/containers, deployment validation, and JWT-enabled local Owner Edge configuration. Explicit Phase 9 Jest passed 17 suites/150 tests, PGlite passed 57/57, repository TypeScript, both strict worker builds, and the deployment validator passed. M11/M12 remain unapplied, all services remain undeployed, fixture evidence is retained by policy, and no Supabase/Storage, secret, provider, staging, commit, push, or merge operation occurred. Independent review is next.

> 2026-07-26 Phase 9 M11/M12 live-application checkpoint: exact project `ahntbtktjjmvfosgkmgn` was healthy and the clean repository baseline was `cc98901`. M11 applied once as `20260726182238`; M12 applied once after it as `20260726182539`. Live readback verified the ingestion columns/constraints/indexes, immutable analysis tables and triggers, candidate lineage, reconciliation constraints, and service-only hardened RPCs. Inventory/listings/events stayed 5/5/14, quantity violations stayed zero, both private buckets stayed unchanged with zero objects, and no service, secret, or provider was deployed/configured/called. M12's first truncated MCP transport submission failed atomically with no history row or partial object before the unchanged SQL was resubmitted losslessly. Security advisors ended at 174 (`INFO 48/WARN 125/ERROR 1`), with the only M12 delta being two expected service-only RLS/no-policy INFO notices.

> 2026-07-27 Phase 9 M11/M12 closeout checkpoint: the eight-file documentation-only ledger/live-state/handoff/evidence update was committed and fast-forwarded to `main` as `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`; local and remote refs matched and the worktree was clean. Final read-only Supabase confirmation found the exact project healthy, M11/M12 still present exactly once at their recorded versions, and no Phase 9 ingestion/vision Edge Function. No deployment, secret configuration, Storage-object operation, provider call, or further Supabase mutation occurred.

> 2026-07-27 Phase 9 fixture-pipeline deployment checkpoint: the JWT-verified Owner Edge Function and separate free-plan `phase9-media-sanitation` / `phase9-fixture-vision` Render services are live. M13 is live once as `20260727025046` with 13 minimum postgres-owned, empty-`search_path` `SECURITY INVOKER` wrappers; existing `service_role` grants proved sufficient and the private schema remains unexposed. Both Render services are live at `96991a99a8e24146db709653ebc287b8c2404430`, auto deploy is off, and health/readiness/auth/log-privacy checks pass. Deployed `one_book` plus eight fresh-process fixture cases passed normal claim/fencing/persistence/failure paths with `batchSize: 1`; commerce stayed 5 inventory/5 listings/5 published. No real provider, metadata, UI, inventory, publication, scheduling, autoscaling, or Library work occurred. [Detailed evidence](./implementation/phase-9-image-inventory/trackers/06-fixture-pipeline-deployment-evidence.md).

> 2026-07-27 Phase 9 provider/scale SDD reconciliation: the documentation-only reconciliation now defines replaceable provider-neutral metadata contracts, exactly one primary and zero or one secondary, bounded sequential fallback, coherent single-source selection, cache/query/attempt/cost/capability/quality lineage, manual degradation, horizontally safe workers, graceful shutdown, capacity admission, fairness, independent stage scaling, and a fixed-multi-replica gate before autoscaling. Real Gemini design is a separately gated prospective Unit 4B; Unit 5 remains Metadata/aliases. Status is `needs_independent_review`. No runtime, migration, provider, Supabase/Storage, Render, deployment, scheduling, or autoscaling mutation occurred.

> 2026-07-27 Phase 9 provider/scale F1–F3 correction: the bounded documentation correction preserves the required provider-neutral primary/optional-secondary seam while deferring secondary selection and activation, distinguishes media/vision/metadata capacity signals, disables raw provider/model payload persistence by default with separately approved diagnostic capture deleted within seven days, and excludes credentials from mobile, Git, documentation, build arguments, logs, telemetry, errors, and model context. Status remains `needs_independent_review`; no runtime, migration, provider, database, Storage, deployment, scheduling, or autoscaling mutation occurred.

> 2026-07-27 Phase 9 Unit 4B checkpoint: the founder authorized the local Gemini
> adapter and narrowly superseded the initial primary vision model ID from
> `gemini-3.5-flash` to configuration-driven `gemini-3.5-flash-lite`; the earlier
> decision remains historical. The adapter is locally implemented behind
> `SpineImageAnalyzer` with strict schema normalization, bounded usage/cost
> evidence, safe error classes, and server-only credential boundaries. No live
> provider call, credential configuration, migration, database/Storage mutation,
> deployment, scheduling, autoscaling, metadata, UI, inventory, or publication
> change occurred. One independent Unit 4B review is next.

> 2026-07-27 Phase 9 Unit 4B persistence correction: the two confirmed review
> blockers are corrected locally. Forward-only M14 adds dedicated service-only
> provider-attempt lineage and bounded register/finalize/associate/mark RPCs;
> Gemini now receives a private media handle only after atomic final claim and
> complete store/session/input/media validation. Focused mocked/PGlite evidence
> covers durable usage/injected cost, duplicates, accepted/stale/unknown outcomes,
> and zero download/provider calls after rejection. M14 was not applied and no
> provider, credential, Storage, deployment, metadata, UI, or commerce mutation
> occurred. One correction-only independent review is next.
>
> 2026-07-27 Phase 9 Unit 4B final correction: the egress fence now performs
> complete claim/media validation immediately before private download and again
> immediately before Gemini invocation. Logical spend identity is stable across
> claim retries and separate from unique provider-attempt identity. TypeScript and
> M14 apply the same bounded semantic pricing allowlist, and the Phase 9 migration
> test names the exact ordered M01-M08/M10-M14 set. M14 remains unapplied; no live
> provider, credential, database, Storage, deployment, or product mutation occurred.
>
> 2026-07-28 Phase 9 M14 application: exact-project preflight confirmed M14 absent,
> M01-M08/M10-M13 each once, M09 absent, and every dependent relation, constraint,
> function, grant, and RLS assumption. M14 then applied once as
> `20260727183546 marketplace_phase9_vision_provider_attempts`. Live readback proves
> the empty 34-column provider-attempt table, approved constraints/indexes, exact
> private/public RPC signatures, RLS, and zero anon/authenticated authority; M12/M13
> fixture seams remain intact and Phase 9 PGlite passed 67/67. No Storage, Edge
> Function, credential, Gemini, Render, autoscaling, metadata, or product mutation
> occurred. Gemini deployment and live verification remain deferred.
>
> 2026-07-28 Phase 9 M15 application and security stop: correction commit
> `1168655` was fast-forwarded to `main`; the complete checked-in 60,915-byte
> M15 payload (SHA-256 `21c298e77e1008f2fd0fd50b33ede9ec1f74479779cf53679f5bb638dc69d9f4`,
> Git blob `573c11dbe073c31b2729874a011e11413e6969d1`) was submitted once to
> project `ahntbtktjjmvfosgkmgn` and applied as
> `20260727222159 marketplace_phase9_metadata_foundation`. Schema, constraints,
> indexes, immutable trigger, RPC signatures, fixed search paths, client denials,
> fencing, lineage, cost, and no-inventory/publication checks passed. Closeout
> stopped because Supabase default privileges left
> `service_role=arwdDxtm/postgres` on all three new metadata tables despite M15's
> intended read-only grant. M15 remains live once and M09 absent; a separately
> authorized forward-only grant correction is required before Unit 5B.
>
> 2026-07-28 Phase 9 M16 local correction checkpoint: forward-only
> `20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql` is
> created, locally effective-privilege verified, and independently approved.
> It covers `vision_provider_attempts` plus the three M15 tables because all four
> are RPC-only mutation boundaries. M16 is not live; M15 remains live exactly
> once, M09 remains absent, and Unit 5B remains gated on merge plus separately
> authorized exact-project application/readback. [Evidence](./implementation/phase-9-image-inventory/trackers/09-m16-acl-correction-evidence.md).
>
> 2026-07-28 Phase 9 M16 application stop: approved commit `f59d8ed` was
> fast-forwarded to `main`, and exact M16 applied once as
> `20260727231217 marketplace_phase9_sensitive_table_acl_correction`.
> INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER are now denied to
> `service_role` on all four RPC-only tables; SELECT, RLS, ownership, 13 RPC
> grants/search paths, and client denial pass. PostgreSQL 17.6 raw ACL readback
> exposed inherited MAINTAIN (`service_role=rm/postgres`) on all four tables.
> Unit 5B remains gated on separately authorized forward M17 correction/review/
> application. M09 remains absent; no data, Storage, provider, or product change occurred.
>
> 2026-07-28 Phase 9 M17 closeout: correction commit `cbd98c7` was
> fast-forwarded to `main`, and exact M17 applied once as
> `20260727233457 marketplace_phase9_maintain_acl_correction`. PostgreSQL 17.6
> readback proves `service_role=r/postgres` on the M14 provider-attempt table
> and all three M15 metadata tables: SELECT only, including no MAINTAIN.
> RLS/postgres ownership, client denial, and all 13 hardened RPC
> grants/signatures/fixed search paths remain intact. Unit 5A is live-verified;
> Units 5B/5C remain not started and separately authorized. [Evidence](./implementation/phase-9-image-inventory/trackers/10-m17-acl-correction-evidence.md).

> 2026-07-28 Phase 9 Unit 5B candidate: the Google Books API v1 primary
> metadata adapter, bounded server-only transport, coherent-edition
> normalization/ranking, and Unit 5A-ordered production composition are locally
> implemented with sanitized schema-derived fixtures. The official provider
> audit records storage/reuse as registry- and legal-review-gated. No migration,
> credential, live Google Books call, provider-registry/Supabase/Storage
> mutation, deployment, inventory, publication, or alias effect occurred. The
> exact pushed candidate requires independent review; Unit 5C remains unstarted.

> 2026-07-29 Phase 9 Unit 5C Lite documentation candidate: the founder approved
> the target specification and confirmed positive-price publication remains
> unchanged; price-on-request is excluded. Governing documents now separate the
> implemented selected-language/strict-`p9-vision-v2`/live-M01 state from the
> auto-detect, per-field language/script, original-first, optional-sidecar,
> independently reconciled, store-scoped active-only target. Implementation is
> not started. The exact documentation tip awaits independent review; no code,
> migration, Supabase/Storage, provider, deployment, UI, index, inventory,
> publication, or commerce mutation occurred.

> 2026-07-29 Phase 9 Unit 5C Lite documentation approval: independent review of
> candidate `d73a9b1` required one bounded correction because three stable
> handoffs still presented selected-language/three-English-alias wording without
> the current-runtime/superseded-target distinction. Corrected tip `3d19ce5`
> passed the full continuity/alignment suite and independent re-review returned
> `APPROVED` with no findings. The candidate is ready for push/merge. Unit 5C
> implementation, migrations, UI, provider calls, indexing, inventory,
> publication, and commerce remain unauthorized.

> 2026-07-29 Phase 9 Unit 5C-1 implementation candidate: the approved Unit 5C
> Lite documentation is merged on `main` at `b44277aa5f3965c7f02295c4ac855abc467413e1`.
> The provider-neutral optional sidecar contract, observation-qualified
> title/author source association, BCP 47/ISO 15924 validation, deterministic
> comparison/deduplication, and sanitized fixture-gated companion decoder are
> locally complete. Active Gemini generation, strict `p9-vision-v2`, worker
> persistence, M01 aliases, migration/schema, provider calls, UI, index,
> inventory, publication, deployment, and commerce remain unchanged. Exact-tip
> independent review is required before user merge authorization.

> 2026-07-29 Phase 9 Unit 5C-2 persistence candidate: Unit 5C-1 is merged to
> `main` at `8aadf178aa2b14293a7c0168f3b41e90ebf61d52`. M18 adds a separate
> private store/analysis/candidate/observation/field-scoped proposal table and
> token/attempt-fenced service read/write RPCs while preserving the existing M01
> `book_search_aliases` representation. The exact reviewed migration is live
> once on development project `ahntbtktjjmvfosgkmgn` as
> `20260729004216 marketplace_phase9_search_variant_proposals`. PostgreSQL 17.6
> readback and a rollback-only synthetic smoke prove proposed/non-searchable
> persistence, duplicate-free replay, mismatched-claim zero effects,
> title/individual-author separation, store-bounded reads, client denial,
> service SELECT-only/RPC mutation, no MAINTAIN, unchanged aliases, and zero
> smoke residue. Gemini generation, activation, search exposure, Owner UI,
> inventory/listing creation, publication, deployment, and commerce remain
> unchanged. The first staged-tree review found an accepted-envelope replay
> defect. The authorized forward M19 fingerprint fence is live once as
> `20260729020008`; changed accepted replay now rolls back without appending.
> The corrected exact tree was independently approved with no findings and
> fast-forward merged to `main` at
> `b3980349d9d446fbf1820ef869f6664953d9a599`. Unit 5C Batch 1 remains
> separately gated and unauthorized.

> 2026-07-29 Phase 9 Unit 5C-3 closeout: optional multilingual companion
> generation now shares the existing single Gemini call while canonical
> `p9-vision-v2` remains independently strict. Accepted sidecars persist through
> M18/M19 and reconcile confirmed Owner title and individual-author fields with
> narrow deterministic normalization, default-deny activation, and trusted
> proposed/active/stale lifecycle transitions. M20 is live as `20260729054842`;
> it temporarily contained combined Unit 5C-3/5C-4 behavior. Immutable forward
> M21 is live as `20260729060238` and removed the public search RPC, alias
> materializer, inventory/listing linkage, and related trigger/search effects.
> The final Unit 5C-3-only tree `eabe1040b4dbe89cf5163754fd719a11673a8682`
> received independent verdict `APPROVED` and merged to `main` at
> `f09301b76fb14714f942a98f0ceffa5d5a0c3178`. Unit 5C-4 active store-scoped
> alias materialization and search consumption is the next active task in a new
> session; display/UI/actions, benchmarks, rollout, inventory/publication,
> commerce, provider fallback, and global alias authority remain deferred.

> 2026-07-29 Phase 9 Unit 5C-4 closeout: active Unit 5C-3 proposals now
> materialize only within exact store/source-field and eligible existing-target
> authority, with independent title/one-based-author linkage, idempotent
> materialization/retraction, and fail-closed Roman title/author search that
> preserves original, ISBN, canonical, and legacy approved-alias behavior.
> Exact tree `db8ea75ed2904e8c381eec814f96804198d16b1e` received verdict
> `APPROVED` and fast-forward merged at
> `d092f081d95b8c551bfcadcfd58fe8c98c77dfb2`. M22 is live as
> `20260729075459`; immutable M23 is live as `20260729082153` and
> forward-corrects legacy approved-alias ranking plus stricter source
> reconciliation. PGlite 35/35, Jest 53/53, scoped TypeScript, continuity,
> secret/pyc checks, and zero-residue rollback smoke passed. No display schema,
> Owner decision authority/UI, benchmark/rollout, inventory/publication,
> commerce, provider fallback, or global alias authority was added. The next
> active batch combines Unit 5C-5/5C-6 backend work after this closeout merges.

> 2026-07-26 Phase 9 Unit 4A review-correction checkpoint: the independent review returned `CHANGES_REQUIRED` for unsafe Docker context, pre-authentication slot starvation/read deadlines, nondeterministic shutdown evidence, source-string-only deployment claims, and identity-only fixture tests. All five corrections plus bounded invoker responses are locally focused-green. A deny-by-default Docker context, pre-admission constant-time authentication, fixed body deadline, deterministic shutdown test, real compiled-entrypoint smoke, per-fixture semantic matrix, synthetic-only container script, and minimal-permission pull-request workflow now exist. The mandatory GitHub Actions image build/start gate is next; no live credential, image push, deployment, migration, provider, Supabase, or Storage operation is authorized.

> 2026-07-30 Phase 9 Unit 5C-5/5C-6 backend closeout: exact tree
> `66db5be740940a8c882bb7ea312817f4c33bb2db` received independent Review A
> `APPROVED` and Review B `APPROVED`. Exact M24-M28 applied once to
> `ahntbtktjjmvfosgkmgn` as `20260730022442`, `20260730022524`,
> `20260730022559`, `20260730022636`, and `20260730022713`; M18-M23 remained
> unchanged and M29 remained absent.
> Live strict-role, RLS/ACL/search-path/no-MAINTAIN, benchmark evidence,
> revocation, exact rollout, and real two-connection replacement concurrency
> checks passed with zero synthetic residue. Final local verification passed
> Jest 140/140, PGlite 53/53, scoped TypeScript, and continuity 195/0/0.
> Implementation commit `4b667fc6674d606a8f88e2a4ee933d79bf332f53`
> preserves the approved tree. No language is benchmarked or approved, no
> capability is enabled, visual UI remains deferred, and no
> inventory/publication/commerce behavior was added.

> 2026-07-30 Phase 9 Unit 6 design-authority closeout: Unit 5C-5/5C-6 is
> merged on `main`; M24-M28 remain immutable and were applied live exactly
> once. No language is benchmarked, approved, or enabled; no capability is enabled. The Unit 6 Owner
> Capture, Review, and Recovery UX SDD and contract matrix are
> `approved_design_authority` after independent backend/security and
> product/UX/recovery/accessibility reviews both returned zero final findings.
> The design fixes eight exact Owner-safe contracts, strict review fields,
> deterministic presentation mapping, initiator-only queue/session ownership,
> 40 mapped acceptance criteria, and independent 6A-6F merge boundaries. Unit
> 6 implementation has not started. The next authorized work is Phase 9 Unit
> 6A — Owner-safe backend contract foundation only; Unit 7 remains separately
> gated. No runtime migration, deployment, Supabase, Storage, provider, or
> other external mutation occurred in the design session.

> 2026-07-30 Phase 9 Unit 6A live verification: M29 is live exactly once as
> `20260730162700 marketplace_phase9_owner_safe_contracts`. Authenticated
> Owner RPC smoke passed 21/21 bounded receipts through ordinary user sessions:
> initiating Owner reads/mutations, four actor denials, non-enumeration,
> DTO/private-table privacy, review version/replay fences, readiness, Close,
> and Unit 7 noninterference. Post-smoke readback proves zero mutable workflow,
> inventory, listing, public-projection, commerce, or Unit 7 residue.
> `retained_immutable_synthetic_audit_evidence` consists only of two immutable
> marketplace events and the minimum inert store/Auth anchors under explicit
> authorization; the store is closed/non-selling with no public profile or
> membership, and the user is banned. No append-only protection was changed.
> No deployment, Unit 6B, or Unit 7 work occurred.

> 2026-07-30 Phase 9 Unit 6B local completion: Unit 6A is merged on `main` and
> live-verified through M29. Unit 6B adds the nested guarded Inventory route
> tree, exact five-read Owner UX adapters, strict portable response/request
> contracts, identity-complete React Query keys/defaults, and serialized
> cancel-before-remove private-cache cleanup. Feature commit `9ef9eb3` is
> locally verified; [tracker 20](./implementation/phase-9-image-inventory/trackers/20-unit6b-route-query-cache-evidence.md)
> owns the detailed receipt. No migration, Supabase/Storage mutation,
> deployment, provider call, or other external mutation occurred.

> 2026-07-31 Phase 9 Unit 6C merge completion: Unit 6B is merged at `9ef9eb3`.
> Unit 6C implementation commit `b87469d` adds Owner Start/Resume discovery,
> explicit camera/gallery setup, preview, cancellable signed transport,
> byte-versus-registration retry, progress polling, route/session recovery,
> terminal handoff, and repeatable identity cleanup. The final affected command
> passed 9 suites/56 tests, TypeScript passed, and the authorized diff-only
> closure returned `CLOSED`. Bounded Expo web compiled 2,216 modules and proved
> authorization-first route privacy with zero errors; the supplied account had
> no Active Store Owner membership, so Owner-only/native/upload states remain
> deterministic-test evidence. No migration, Supabase/Storage mutation, live
> upload, deployment, provider call, inventory/publication, or commerce change
> occurred. [Tracker 21](./implementation/phase-9-image-inventory/trackers/21-unit6c-capture-upload-recovery-evidence.md)
> owns the detailed receipt. The fast-forward merge is on `main` through
> evidence commit `092562d`.

> 2026-07-31 Phase 9 Unit 6D merge completion: Unit 6D implementation commit
> `c363b60` adds the Owner candidate list and strict candidate editing flow,
> fail-closed refresh authority, explicit condition/damage/sellability handling,
> conflict recovery, dirty-navigation protection, and identity-scoped query
> cleanup. Focused verification passed 11 suites/98 tests, the corrected
> candidate suite passed 14/14, compatible TypeScript and diff checks passed,
> and the final narrow sensitive-slice closure returned `CLOSED`. The bounded
> browser receipt proved authorization-first privacy with zero console errors;
> authenticated mutation states remain deterministic-test evidence because the
> supplied account had no Active Store Owner membership. No migration,
> Supabase/Storage mutation, deployment, provider call, inventory/publication,
> commerce, or other external mutation occurred. [Tracker 22](./implementation/phase-9-image-inventory/trackers/22-unit6d-candidate-review-evidence.md)
> owns the detailed receipt.

> 2026-08-01 Phase 9 Unit 6E finalization: the previously closed diff-only
> correction checkpoint `8bceab260a953b4d832fd55f34f58db12fa009b1` was frozen
> at tree `8a70bbb3b102ecda22f2904f20952852849567f1` with no later or uncommitted
> contamination. The checked-in M30 correction was applied exactly once after
> exact-project M29 preflight; Supabase readback records
> `20260801093048 marketplace_phase9_unit6e_review_corrections` with no later
> migration. Focused verification passed 12 suites/95 tests, remote-backed
> integration passed 3/3, compatible TypeScript passed, and continuity passed
> with 195 definitions and zero duplicate/missing traceability. The bounded
> authenticated browser reached `/library`, `/profile`, `/status`, and
> `/inventory`; the supplied account remained under Store Owner application
> review, so private scan data was withheld and no Owner mutation was attempted.
> No Storage, provider, deployment, inventory, publication, or commerce mutation
> occurred. [Tracker 23](./implementation/phase-9-image-inventory/trackers/23-unit6e-review-corrections-evidence.md)
> owns the detailed receipt; Unit 6F now requires separate authorization.

> 2026-08-02 Phase 9 Unit 6F browser/readback closeout: the feature branch
> `codex/phase9-unit6f-readiness-quality-gates` was verified at final correction
> head `a0d55b5e50d4dc3990851643d10bc05a54c54514`. Authenticated Expo web
> verification covered canonical Review Save persistence, stale-scope fencing,
> confirmation safeguards, exact `Confirming…`, one Close, closed-session
> persistence, narrow reflow, and zero inventory/listing/publication effects.
> Focused deterministic verification passed 22 suites/155 tests, auth/owner
> verification passed 15 suites/114 tests, app auth/Owner route tests passed
> 5 suites/11 tests, TypeScript passed, and continuity passed. The mandatory
> representative low-end Android evidence required by Unit 6 SDD §§24, 28, and
> 34 and U6-AC36/U6-AC39 was not run; Unit 6F remains incomplete and unmerged.
> [Tracker 24](./implementation/phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md)
> owns the detailed receipt and `USER_ACTION_REQUIRED_NATIVE_EVIDENCE` verdict.

> 2026-08-02 Phase 9 Unit 6F native UUID remediation checkpoint: the bounded
> scan-startup correction added SDK54-compatible `expo-crypto`, removed the
> browser-global crypto dependency, and made capture attempt identities lazy
> and render-stable. Focused capture verification passed 2 suites/17 tests,
> the full image-inventory suite passed 33 suites/223 tests, TypeScript passed,
> and no Supabase/Storage/migration/external mutation occurred. No Android
> device or emulator was available to `adb`, so the mandatory native gate
> remains outstanding; `store_inventory` investigation was intentionally not
> started. Tracker 24 owns the detailed evidence.

> 2026-08-03 local web runtime and route-warning checkpoint: the concrete
> Store Owner Orders route was corrected from `orders` to `orders/index`, with
> a regression assertion. Production web export passed after bundling 2,245
> modules. The Codex in-app browser authenticated with the supplied development
> OTP and rendered `/library`, `/dashboard`, and `/inventory` without browser
> errors; only existing framework, notifications, Sentry, and style warnings
> were observed. A fresh exact-project read-only check confirmed
> `store_inventory` RLS is enabled, authenticated table SELECT/INSERT/UPDATE
> are denied, the owner policies remain present, and the controlled inventory
> RPCs are executable by authenticated clients. The legacy store dashboard and
> inventory services still call `.from('store_inventory')`; the inventory hook
> currently swallows that read error. No database, migration, Storage,
> deployment, inventory, listing, or publication mutation occurred. The
> native Unit 6F evidence gate remains outstanding.

> 2026-08-03 WU1 owner-inventory read-boundary re-sequencing: the user
> explicitly authorized WU1 ahead of the Unit 6F native gate, limited to the
> contract addendum, red tests, local/static validation, and an unapplied
> forward migration draft. The exact development project
> `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) was re-verified read-only;
> live migration history still ends at M30. The stable
> `phase9_owner_inventory(uuid)` detail RPC remains intact. Focused contract
> tests passed 6/6 after the intentional pre-draft red run, and local PGlite
> draft parse/readback passed 1/1. No SQL was applied and no client/UI/service,
> dashboard, inventory, listing, publication, Storage, deployment, or external
> mutation occurred. [WU1 evidence](./implementation/phase-9-image-inventory/trackers/25-owner-inventory-read-boundary-wu1-evidence.md)
> owns the detailed receipt; separate SQL/security approval is required before
> applying the draft, after which the Unit 6F native gate resumes.

> 2026-08-04 WU1 correction checkpoint: the review findings were handled within
> the existing local-only boundary. Explicit NULL page sizes now fail closed;
> unexpected SQL failures map to `P9_INTERNAL_ERROR`; `asOf` is documented as an
> ordering horizon rather than a repeatable database snapshot; and the
> continuity validator requires the WU1 addendum/evidence artifacts and boundary
> markers. The correction-focused Jest suite is 9/9 green after an intentional
> 3-test red run; corrected PGlite passed 1/1, continuity passed with 65
> Markdown files/51 required phase files, and `git diff --check` passed. The
> draft remains unapplied, live migration history remains
> at M30, and no client/UI/service, write-path, database, Storage, deployment,
> inventory, listing, publication, or external mutation occurred. Independent
> review and separate application approval remain required.

> 2026-08-04 WU1 correction closure: the cursor helper call is now outside the
> narrow cast-error handler, so unexpected helper failures reach
> `P9_INTERNAL_ERROR` while malformed timestamp/UUID values remain
> `P9_CURSOR_INVALID`. Local behavior coverage now passes equal-timestamp
> keyset pagination, filters, empty results, invalid page-size/cursor,
> Owner/anonymous scope, and unexpected-helper normalization. Focused WU1
> Jest is 10/10, local PGlite is 3/3, and continuity reports separate
> `WU1_DIFF_CHECK=PASS`, `REPOSITORY_DIFF_CHECK=PASS`, and
> `PHASE9_CONTINUITY_CHECK=PASS`. No Supabase mutation occurred; WU1 remains
> unapplied and independent review plus separate application approval remain
> required.

> 2026-08-04 WU1 exact-project application and readback: the user-authorized
> development-only migration `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`
> was applied exactly once through Supabase MCP to
> `ahntbtktjjmvfosgkmgn` and is recorded live as
> `20260803221216 marketplace_phase9_owner_inventory_read_boundary`.
> Preflight matched `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, and the M30
> tail; the new RPC/index were absent before application. Post-readback proves
> the exact eight-argument `jsonb` RPC, `STABLE SECURITY DEFINER`, postgres
> owner, empty `search_path`, narrow execute ACLs, exact descending index,
> unchanged detail RPC, and unchanged `store_inventory` RLS/policies/table
> ACL/trigger boundaries. Anonymous REST execution returned HTTP 401. No rows,
> users, fixtures, listings, publications, Storage objects, providers,
> deployments, or client/dashboard/write-path behavior changed. Positive Owner
> JWT runtime cases remain deferred because no approved Owner credential or
> active Owner browser session was available; Unit 6F native evidence remains
> outstanding and Unit 7 remains separately gated.
>
> 2026-08-04 WU2 read-only Owner inventory client integration: the active
> Store Owner `/inventory` route now calls
> `phase9_owner_inventory_page_v1` through a strict exact-shape DTO decoder,
> identity/store/contract/filter-isolated infinite-query cache, opaque cursor
> pagination, exact WU1 filters, and distinct read error/partial-page states.
> The reachable route graph no longer imports the legacy direct-table inventory
> service. After correction-review closure, focused WU2 tests pass 4 suites/50
> tests and the related regression set passes 39 suites/303 tests;
> strict offset timestamps/positive versions, non-destructive failed refresh,
> explicit current-generation refresh fencing, no unauthorized retry, and
> truthful category/operation/empty states are covered. TypeScript passes with
> `--allowImportingTsExtensions`. No migration, database/storage row, Edge
> Function, deployment, dashboard, write path, or Unit 7 behavior changed.
> Authenticated Owner runtime remains deferred pending an approved session.
> A final focused correction removed the global header Refresh control from
> unauthorized initial and partial states; screen 15/15, focused 4 suites/50,
> and related 39 suites/303 remain green without external mutation.

> 2026-08-05 Android 11 observation and browser follow-up: the user reports
> accessible large-text use and a connected native camera. No device model,
> font-scale/screen receipt, performance trace, or offline/reconnect evidence
> was supplied, so this is not promoted to the mandatory Unit 6F native gate.
> Browser follow-up covered authenticated Owner read/filter/search/review/Resume,
> sanitized fixture upload, disposable Review Save, logout/re-authentication,
> and unavailable-session Retry with zero browser errors. The disposable session
> remained active with four images processing, so Close was unavailable on that
> session; cross-store and inactive-Owner fixtures remain deferred. Unit 6F
> remains incomplete under SDD §§24, 28, and 34; Unit 7 remains gated.

> 2026-08-05 15-card/Gemini clarification: code tracing confirms that the
> image-inventory UI consumes decoded Owner candidate DTOs and does not invoke
> Gemini directly. Deterministic `ownerUxTestFixtures.ts` data covers fifteen
> ordered candidates, an independent partial failure, and the over-fifteen
> safeguard; the focused suites pass 2 suites/20 tests. This closes the local
> fixture-backed UI/contract check only. Live Gemini/provider verification,
> native fifteen-card responsiveness/memory, the remaining representative
> Android Unit 6F evidence, and the deferred WU1/WU2 runtime cases remain
> pending; Unit 7 remains gated.

| Field | Value |
|---|---|
| Current phase | Phase 9: Image-to-LLM Inventory - **Unit 7B candidate pending Luna xhigh review** |
| Overall status | `in_progress` |
| Last updated | 2026-08-12 |
| Latest handoff | Finding-001 is closed after the bounded latest-subscription precedence correction. The correction matrix is 6/6 and focused migration plus Owner-publication/discovery/worker suites are 24/24. The correction is integrated on the Unit 7B feature branch; the next gate is exact-SHA release verification. |
| Current risk level | Real-PostgreSQL concurrency, Docker container smoke, and the Deno Edge graph remain `NOT_RUN`, deferred rather than skipped, and `REQUIRED_BEFORE_LIVE` on the final post-correction SHA before the Stage J exact-SHA release gate. The unrelated full PGlite result is 276/277 and repository Jest fails only six empty collectors after all 2012 real tests pass. |
| Next recommended task | Run the exact-SHA release gate on the final Unit 7B feature-branch commit, then the three deferred gates before Stage J. Connected preflight/application, deployment, and live proof remain unauthorized. |

---

## 3. Phase Summary

| Phase | Status | Tracker | Notes |
|---|---|---|---|
| Phase 0: Codebase and DB Audit | `needs_review` | [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md) | Audit complete; review before Phase 1. |
| Phase 1: Foundation Schema and Security | `needs_review` | [PHASE-1](./implementation/PHASE-1-foundation-schema-security.md) | Foundation migrations applied and post-deployment audit passed. Follow-up index fix applied. Ready for Phase 2 planning. |
| Phase 2: Store Onboarding and Verification | `needs_review` | [PHASE-2](./implementation/PHASE-2-store-onboarding-verification.md) | Phase 2A implemented locally and hardening migration applied live; Phase 2B service/UI/metadata slice is implemented, deployed, and authenticated-smoke-verified; Phase 2C review/setup entitlement slice is implemented and deployed. Authenticated platform-review smoke remains. |
| Phase 3: Inventory, Canonical Books, and Listings | `in_progress` | [PHASE-3](./implementation/PHASE-3-inventory-canonical-listings.md) | Manual inventory/projection slice implemented, tested, exported, and live-applied; trigger projection and anonymous/authenticated public-read smoke passed and cleaned up. Remaining phase status should be reconciled separately against its tracker. |
| Phase 4: Store Owner Console | `locally_complete` | [PHASE-4](./implementation/PHASE-4-store-owner-console.md) | Dashboard, inventory console, storefront/profile settings, subscription/quota view, compliance blockers, route tabs, tests, TypeScript, and web export complete locally. Security hardening and `store-profile` are deployed; positive authenticated owner-write smoke remains credential-gated. |
| Phase 5: Consumer Discovery | `complete` | [PHASE-5](./implementation/PHASE-5-consumer-discovery.md) | Implementation, live projection-based RLS correction, anonymous/authenticated discovery, canonical offer comparison, disabled-locality exclusion, private-access denials, constrained demand RPC, regression tests, TypeScript, and zero-residue cleanup all pass. Accepted 2026-07-15. |
| Phase 6: Order Request and Confirmation | `complete_e2e_deferred` | [PHASE-6 tracker](./implementation/PHASE-6-order-request-confirmation.md) · [verification/traceability](./implementation/PHASE-6-verification-and-traceability.md) · [corrected monolithic SDD](./implementation/PHASE-6-order-request-confirmation-SDD.md) · [immutable v0.1 archive](./implementation/archive/PHASE-6-order-request-confirmation-SDD-v0.1-original-monolith.md) | M01-M39 and persisted behavior through `payment_ready` are verified in development. Scheduler v5/worker v3 and cron job 5 are active. Comprehensive browser E2E and real timed commerce-command E2E are explicitly deferred, not silently passed. |
| Phase 7: Payment, Ledger, and Settlement | `deferred` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Deferred 2026-07-18; resume only through separate authorization and DOC-15/payment/legal/accounting gates. |
| Phase 8: Pickup Fulfillment | `deferred` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Deferred with Phase 7 because it requires verified paid-order creation. |
| Phase 9: Image-to-LLM Inventory | `unit7b_corrections_pass_ready_for_exact_sha_release_gate` | [master tracker](./implementation/phase-9-image-inventory/TRACKER.md) · [Unit 7B SDD](./implementation/phase-9-image-inventory/work-units/07b-publication-sdd.md) · [Unit 7B evidence](./implementation/phase-9-image-inventory/trackers/30-unit7b-safe-publication-evidence.md) | Unit 7A/M39 remain live and byte-unchanged. Finding-001 is closed after the bounded latest-subscription-order correction: matrix 6/6 and focused migration plus Owner-publication/discovery/worker suites 24/24. Prior cross-layer proof remains 4/4; deferred-gate, PGlite, broad-Jest, and Docker dispositions are unchanged. The next gate is exact-SHA release verification. M40 is local/unapplied; connected preflight/application, deployments, live proofs, Unit 7C, and main integration remain gated. |
| Phase 10: Third-Party Delivery | `not_started` | [PHASE-10](./implementation/PHASE-10-third-party-delivery.md) | Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators. |
| Phase 11: Notifications and Realtime | `not_started` | [PHASE-11](./implementation/PHASE-11-notifications-realtime.md) | Events, push/in-app, selected realtime. |
| Phase 12: Demand, Bookclubs, and Places | `not_started` | [PHASE-12](./implementation/PHASE-12-demand-bookclubs-places.md) | Growth layer after commerce loop. |

---

## 4. Global Blockers

- Payment provider not selected.
- Delivery provider not selected.
- Legal/accounting review pending before production payments.
- India marketplace compliance review pending before production payments.
- DOC-14 commerce state-machine review pending before feature coding beyond Phase 0/Phase 1 foundation.
- DOC-15 finance/tax/settlement review pending before payment work.
- DOC-16 Bangalore pilot/unit-economics review pending before pilot launch planning.
- Existing Supabase security advisor issues must be remediated separately or explicitly isolated before marketplace production launch.
- Phase 4 review remediation is deployed; positive authenticated profile/setup smoke remains pending an approved disposable Store Owner credential.
- Phase 9 Unit 6 automatic/functional pipeline is complete/PASS; native Unit 6F
  validation remains deferred `NOT_RUN`/`UNRESOLVED` debt and is not marked
  PASS. Duplicate replay was not tested, Unit 7 has not started, and the
  project owner has authorized Unit 7 under the current authority overlay.

---

## 5. Global Decisions Made During Implementation

- 2026-07-18: Phase 6 is complete with comprehensive browser E2E explicitly deferred. Phases 7 and 8 are deferred by product decision, and Phase 9 planning is authorized next. This sequencing decision changes roadmap order only; DOC-14 payment/paid-order/pickup transition guards remain authoritative and no Phase 7/8 behavior may be folded into Phase 9.

- 2026-06-19: Architecture Remediation Plan executed (v0.2 sweep).
  - Money fields standardized to integer `_minor` (paise) across DOC-2, DOC-3, DOC-4, DOC-5, DOC-6, DOC-7, DOC-8, DOC-9, DOC-15, README, and PHASE-1 plan.
  - Canonical table names applied: `finance_ledger_entries`, `settlement_batches`, `seller_payout_accounts`, `marketplace_audit_logs`, `marketplace_localities`, `commerce_idempotency_keys`, `marketplace_notifications`.
  - DOC-4 and DOC-15 bumped to v0.2.
  - Commerce state machines refined with `awaiting_clarification`, `awaiting_customer_decision`, and two-tier soft/firm inventory holds.
  - `marketplace_localities` promoted to Phase 1; `stores.locality` converted to `locality_id` FK.
  - `commerce_idempotency_keys` promoted to Phase 1.
  - `settlement_batches` reserved TCS/GST tax fields (`tcs_deduction_minor`, `gst_on_commission_minor`, `tax_adjustments_minor`, `tax_treatment_version`).
  - `marketplace_notifications` projection added; raw `marketplace_events` client SELECT removed.
  - Security helper standardized on `marketplace_sec.is_store_admin(store_id)`; SEC-16 added to acceptance criteria.
  - DPDP section updated to name LLM vendor as data processor with image egress/residency rules.

- 2026-06-19: v0.2 sweep consistency gap-fill (DOC-12, DOC-16).
  - Post-push audit identified three remediation plan targets that were marked `[x]` but not yet edited: DOC-12 §7 (SM-02: `acceptance_window` policy), DOC-12 §12 (SEC-01: cross-tenant denial test requirement / SEC-16), and DOC-16 §2 + §5 (P1-02: `marketplace_localities.is_pilot_enabled` enforcement).
  - DOC-10 (SEC-02 target) confirmed to not exist as a standalone file; the `marketplace_events` raw-read removal was correctly applied to DOC-1 §7 and DOC-14 §13 instead. No action needed.
  - All three live edits applied; remediation plan task list now accurately reflects actual document coverage.

- 2026-06-19: Phase 1 foundation migrations applied to live Supabase project.
  - Four split migrations applied in order via Supabase MCP: schema (A), helpers (B), RLS (C), storage (D).
  - Post-deployment audit run across all 5 high-risk areas: financial column types, security helper definitions, trigger projection sync, CHECK constraints, and storage path isolation.
  - **Audit finding (SEC-04):** `marketplace_notifications` was missing FK indexes on `user_id` and `store_id` — columns evaluated in the `notifications select own` RLS USING clause. Fixed immediately via follow-up migration `marketplace_notifications_fk_indexes`.
  - All other checks passed: 27 tables present, all monetary columns `INTEGER`, all state machine CHECK constraints match v0.2 spec, all `marketplace_sec` functions are SECURITY DEFINER with blank `search_path`, trigger live-tested with full projection/retraction/locality-name cycle, all storage policies use `foldername[1]` path isolation with `store_administrators` join, `marketplace_events` has no client SELECT policy.

---

## 6. Source Spec Deviations

- 2026-07-18 sequencing deviation: DOC-12 originally placed Phase 7 payment and Phase 8 pickup before Phase 9 image inventory. Product direction defers Phases 7/8 and advances Phase 9 after the completed Phase 6 inventory/hold boundary. DOC-12 and the Phase 7/8/9 trackers were updated; DOC-14 requires no behavioral change.

When adding a deviation, include:

- date
- phase
- source spec affected
- original plan
- implemented behavior
- reason
- whether source spec was updated

---

## 7. Latest Completed Milestones

Implementation milestones completed:

- Phase 0 audit completed and recorded in [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md).
- Phase 1 foundation schema/security implementation plan created: [PHASE-1 plan](./implementation/PHASE-1-foundation-schema-security-plan.md).
- Current app routes/auth/Profile integration points audited for future Store Owner entry.
- Current P2P exchange boundary audited; P2P `listings`, `transactions`, credit tables, and transaction RPCs are confirmed as forbidden reuse for bookstore commerce.
- Live Supabase schema, RLS/policies, storage buckets, Edge Functions, realtime publication state, and advisor findings audited.
- Confirmed no marketplace/store/seller/inventory/order/payment/ledger/settlement/shipment schema exists yet.
- Phase 1 foundation migrations (split A–D + follow-up index fix) applied to live Supabase project and verified by comprehensive post-deployment audit (2026-06-19). All v0.2 standards confirmed in live DB.

Documentation milestones completed:

- Source specs `DOC-0` through `DOC-16` created.
- v0.2 architecture remediation sweep completed: `ARCHITECTURE-REMEDIATION-PLAN.md` tasks applied across DOC-1, DOC-2, DOC-4, DOC-6, DOC-12, DOC-14, DOC-15, DOC-16, README, and PHASE-1 plan; foundation migration aligned with remediation plan. Post-sweep consistency audit confirmed DOC-12 (SM-02 §7, SEC-01 §12) and DOC-16 (P1-02 §2/§5) gap-filled.
- India marketplace, payment, delivery, compliance, and operations guardrails added.
- Tracking scaffolds created.
- Store Owner entry rule implemented and documented: Login / first-run auth for new users, Profile section for existing signed-in users, both routed through the Store Owner gate.
- Phase 2B store application slice implemented, deployed, and authenticated-smoke-verified: controlled Edge Function actions, app service wrappers, onboarding UI, application metadata persistence, pilot locality validation, sanitized DB errors, private verification document upload tests, and cross-tenant denial.
- Phase 2C platform review/setup entitlement slice implemented and deployed: `store-review` Edge Function, `platform_user_roles` auth helper, review metadata migration, founding-trial subscription/entitlement assignment on approval, and Store Owner status/setup checklist screens. Approval moves stores to `approved_pending_setup`, sets verification approved, and keeps setup incomplete plus selling not allowed.
- Phase 4 Store Owner Console locally completed: dashboard, inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, Store Owner tab routes, and focused service/screen/route tests. Local verification passed `src/features/stores` Jest, Store Owner route Jest, TypeScript, and web export.
- Phase 4 security/workflow review remediation deployed (2026-07-15): controlled profile/setup boundary, approved-store setup workflow, inventory publish/filter/save corrections, trigger-helper EXECUTE hardening, and regression coverage. Function/JWT/grant/401 verification passed; positive owner-write smoke is credential-gated.
- Phase 5 discovery accepted (2026-07-15): projection-based public RLS correction deployed as `20260715174111`; anonymous/authenticated discovery, canonical offer comparison, private-boundary denials, constrained demand capture, locality disablement, and zero-residue cleanup passed.
- Phase 6 corrected monolith approved for local implementation (2026-07-16): the temporary split was intentionally deleted and superseded; the exact v0.1 monolith is archived immutably and the v0.2 monolith carries direct submitted request semantics, separate cart evidence, cross-table invariants, safe projections, entitled-owner gate, no substitutions, support-task versioning, exact scheduler, corrected SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical notification fallback. No production or live changes occurred during documentation correction.
- Phase 6 Units 1-10 checkpoint and Units 11-12 source pass (2026-07-16): no P0/P1 contradiction was found; migrations 24-28 add canonical event/audit/inbox enforcement plus transport-independent notification delivery, bounded task claims/leases/retries/dead letters/manual replay, named reminder/expiry commands, and service-only scheduler/worker dispatch. Focused tests pass 182/182 and migration/security contracts 126/126; PostgreSQL execution and cron activation remain gated, and no Phase 7 behavior was added.
- Phase 6 Units 13-14 UI pass (2026-07-16): customer cart/request and Store Owner Orders routes, typed services/hooks, safe versioned projections, explicit replacement, clarification/decision/cancellation, review/outcome/support actions, deep-link refetch, and complete logout/cache cleanup are locally implemented. Focused Units 1-14 tests pass 250/250, migration/security contracts 134/134, TypeScript and production web export pass; migrations 1-30 remain local/unapplied and the PostgreSQL gate remains pending.
- Phase 6 Unit 15 and Unit 16 source gate (2026-07-16): forward migrations 31-33 add service-only reconciliation cases, deterministic stale-task cleanup, PII-safe structured observations, and operational metrics. Red-first Unit 15 passes 24/24; the complete source gate passes 274/274 and migration/security/reconciliation contracts 158/158. TypeScript, web export, Phase 5/notification compatibility, privacy/boundary scans, and diff hygiene pass. The [verification/traceability record](./implementation/PHASE-6-verification-and-traceability.md) gives the source-complete/database-pending matrix and rollout/rollback plan. No local Docker/PostgreSQL daemon exists, so Phase 6 is not locally database-verified.
- Unit 15 final static review caught and fixed invalid transition/task column references before handoff; regression contracts now assert derived request/cart store scope and valid lease-only cleanup columns.
- Phase 6 source/database checkpoint (2026-07-17): development Supabase has M01-M39, including forward-only corrective M34-M39; persisted command/authorization verification reaches `payment_ready`. Initial browser auth/navigation/Marketplace/cart-empty smoke passed with no console errors and controlled development fixtures remain. Scheduler v5/worker v2 and cron job 5 are active; comprehensive browser customer/Owner E2E, responsive/accessibility review, and real timed commerce-command checks remain deferred.
- Phase 6 completion/readback (2026-07-18): Supabase MCP reconfirmed M01-M39, authoritative-table RLS, active scheduler v5/worker v3, successful cron job 5 runs, and zero existing inventory quantity-balance violations. Comprehensive browser E2E remains explicitly deferred. Phases 7/8 are deferred and Phase 9 planning is authorized.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

**Phase 6 remains complete with comprehensive browser E2E deferred; Phases 7 and 8 remain deferred; the bounded Phase 9 fixture pipeline is deployed and live-verified.**

The Phase 1 foundation is applied, audited, and fully v0.2 compliant. The following tables are live and ready for feature implementation:

- `stores`, `store_administrators`, `store_status_history` — store creation and admin assignment
- `store_verification_requests`, `store_verification_documents` — verification submission and review
- `seller_payout_accounts` — payout account metadata collection
- `seller-verification-docs` bucket - document upload with path-scoped store isolation
- `marketplace_sec.is_store_admin()` — canonical RLS helper for all store-scoped policies

Next work:
1. Run a read-only vertical integration audit of upload, media, Gemini/vision,
   metadata enrichment, candidate readiness, and Unit 6 consumption under the
   existing Unit 4B/5A/5B authority.
2. Produce an exact code/schema/live-state gap matrix and review it before any
   implementation, migration, deployment, provider call, scheduler, or external
   mutation.
3. WU1/WU2 authenticated runtime evidence and representative low-end Android
   Unit 6F evidence remain open as separately tracked validation debt. The
   project owner accepts the deferred native-validation risk and authorizes
   Unit 7 to begin; do not represent the native debt as PASS or alter the Unit
   6 requirements/acceptance criteria. Dashboard remediation,
   inventory/publication writes, and commerce behavior remain separately gated.
4. Keep M09, customer display, Owner/customer/platform-admin visual UI,
   production-language approval without qualifying evidence, autoscaling,
   inventory commit, publication, commerce, Google Books Roman-query fallback,
   global alias authority, Library, and Phases 7/8 separately gated.
5. Re-verify the exact project, migrations, schema, Storage, services, and
   advisors before every later mutation; record any migration in the Phase 9
   ledger with exact effects and readback.

---

### 2026-08-05 Unit 4B Gemini configuration/startup evidence

The user authorized a temporary server-only Gemini configuration check. Render
service `phase9-fixture-vision` was deployed from remote `main` commit
`7eaf921efcaefccab4d0189dc26779796f164ed4` as deployment
`dep-d9pdei9t0dsc73ddgbh0`. The final deployment emitted
`service_started` for the vision worker and reached Render `live` status. The
masked `PHASE9_GEMINI_API_KEY` is present alongside Gemini mode,
`gemini-3.5-flash-lite`, and 30-second timeout; the fixture-only variable was
removed. A first env-inconsistent attempt failed at startup and was corrected.

This receipt proves deployment/startup configuration only. No authenticated
`/run`, real Gemini inference, M14 usage/cost receipt, Supabase/Storage/migration
mutation, or product effect occurred. The key value was never read or recorded
by the agent. The next exact action is to revoke the exposed temporary key,
enter a fresh key directly in Render, and separately approve one sanitized-media
provider-call smoke.

### 2026-08-08 controlled Phase 9 metadata proof preflight

The user-authorized live proof verified `Bookconnect_reactexpo`
(`ahntbtktjjmvfosgkmgn`) as `ACTIVE_HEALTHY` and confirmed M32 live exactly once
as `20260808020404 marketplace_phase9_structural_metadata_integration`. Exactly
one minimum `google_books` / `metadata` registry row was configured with adapter
`1.0.0`, enabled/matching/storage allowed, 86,400-second revalidation, and policy
1; public display and image caching remain disabled. The proof stopped before
creating a fresh candidate because `PHASE9_GOOGLE_BOOKS_API_KEY` is missing and
the available local service credential resolves to a different Supabase host.
Metadata jobs, attempts, lookups, cache entries, snapshots, usage reservations,
and physical provider calls remain zero; inventory/listing counts remain 5/5;
metadata and Phase 9 scheduler counts remain zero. No migration was applied by
this session, no provider egress occurred, and Unit 7 remains gated. The exact
next action is to configure both credentials through the approved secret
mechanism and rerun the bounded one-candidate proof.

### 2026-08-08 Phase 0 credential inventory rerun

The mandatory credential gate was re-run before any fresh test data. Source
inspection confirmed Gemini requires `PHASE9_GEMINI_API_KEY`,
`PHASE9_GEMINI_MODEL_ID`, and `PHASE9_GEMINI_TIMEOUT_MS`; Google Books requires
`PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
`PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. None are readable by the current
process or defined in the checked-in env files. The process Supabase URL/service
credential target `nxjnoqjxzkipeghhfxee.supabase.co`, not the approved
`ahntbtktjjmvfosgkmgn` project, so it was not used against the target. Exact
project/read-only registry/count verification passed; no worker, upload,
Gemini/Google Books request, candidate, or remote mutation occurred. The exact
next action is to configure the target service URL/key and all source-defined
real-provider variables through the approved secret mechanism, verify without
printing values, and rerun the same bounded proof. Verdict:
`LIVE_METADATA_BLOCKED_MISSING_CREDENTIALS`.
### 2026-08-09 Phase 9 stale-state cleanup and fresh web-upload gate

The authorized development cleanup completed with `0` active/closing Phase 9
sessions and `0` stale pending media/vision jobs. Inventory, listings,
stores/users, canonical data, unrelated data, migrations, deployment, scheduler,
Unit 7, and Git publication were untouched. Immutable audit evidence was
retained. The actual Expo web Owner flow then uploaded the supplied multi-book
image successfully and created one fresh media job. Processing stopped before
media sanitation because the current invoker process lacks the media worker URL
and ingress token; no Gemini or Google Books call occurred. The exact next gate
is process-local authenticated worker invocation configuration, followed by the
fresh media job only.

The existing Render media URL and masked ingress-token configuration were then
located under explicit follow-up authority. They were supplied process-locally
to the existing invoker without printing or persisting the token. The fresh
media job resolved after one attempt and created one open fresh vision job; no
unrelated media job was processed. The next gate is the existing authenticated
vision-worker invocation for this same fresh input.

The same fresh vision job was then invoked twice through the existing Render
vision service. Both claims safely scheduled retry with
`P9_VISION_ANALYZER_UNAVAILABLE`; Gemini was not called and no provider attempt,
usage reservation, candidate, or M32 metadata job exists. Live function
readback proves the media completion function creates the vision job without
the usage reservation required by vision provider registration. The bounded
proof is stopped at this genuine integration failure. The next gate is a
separately authorized forward migration/code correction and focused regression
evidence; the current task did not authorize that change.

The user subsequently authorized systematic local implementation. Forward-only
M33 is now created locally and unapplied. It atomically creates and validates
the required vision reservation before media completion, fails closed and rolls
back on conflicting lineage, and repairs only valid unleased
`open|retry_scheduled` jobs while excluding terminal history. Focused static
tests pass, M33 applies after the full local M32 tail, and combined
ingestion/vision/provider/M33 PGlite passes 61/61. The current fresh job remains
unchanged at attempt `2/5`; the later duplicate open media input remains
untouched. Exact next gate: independent M33 review, followed by separately
authorized exact-project application/readback. No live migration, worker,
provider, Storage, inventory, publication, scheduler, Unit 7, stage, commit,
push, or deployment action occurred.

The independent review returned `APPROVED_WITH_REQUIRED_CORRECTIONS`. The local
correction pass now requires an active session and initiating-Owner media
binding in both the private helper and one-time repair, with direct regressions
for closed-session and wrong-initiator nonterminal history. The shared PGlite
migration sequence now includes M31 before M32, so its full-tail claim is
literal. Red tests failed on both findings before implementation; final M33
static is 3/3, focused static is 39/39, M33 integration is 5/5, combined PGlite
is 61/61, and database foundation/catalog is 17/17. M33 remains unapplied and
the next gate is independent correction-only rereview.
### 2026-08-10 Phase 9 real-image proof completed through Owner review

M34 is live once on verified project `ahntbtktjjmvfosgkmgn`. The preserved
sanitized input completed vision at attempt 5 with
`accepted_with_language_skips`: 8 visible observations, 7 candidates, and one
bounded unknown-language skip. The seven resulting M32 metadata jobs were
claimed once by the local dedicated metadata worker and resolved into the
Owner-safe manual-review path. Google Books authentication was rechecked using
the previously supplied process-only credential and returned HTTP 200; the
false no-match cause was `projection=lite`, which omits required `language`.
Commit `e4f2b34` changes the request to `projection=full`; focused adapter Jest
is 26/26, the metadata-worker build passes, and a live bounded response decoded
8 editions instead of 0. The existing terminal snapshots were not rewritten.
Owner UI proof passed through Profile -> Store Owner Console -> Inventory: the
hub shows 7 needing attention, all seven books render in the review queue, and
candidate detail preserves title/author/language with private review selected.
No review was saved, no inventory/listing/publication mutation occurred, and
Unit 7 remains gated.

### 2026-08-10 Phase 9 single-image safe removal live

The Owner decision now permits one current image per Start/Close session and
retains explicit Remove image before candidate lineage; only successful removal
enables one replacement. Mobile append UI and direct second-upload authorization
are blocked. Local M35 adds the authenticated logical-remove RPC, exact-job
cancellation, hold-aware cleanup scheduling, current-input read filtering, and
server-side issuance/registration guards. Structural Jest is 6/6 and isolated
M01-M35 PGlite behavior is 3/3, including legacy two-capability handling and
atomic rejection with preserved candidate/inventory/listing state. M35 was
applied once as `20260809223135` to verified project `ahntbtktjjmvfosgkmgn`.
The three explicitly targeted legacy inputs were logically removed, all three
exact jobs were cancelled, and zero candidates/inventory/listings changed.
Owner Edge `phase9-owner-ingestion` v3 was separately authorized, deployed,
and read back with all four overlay files matching exactly and JWT verification
enabled. The three private staging objects remain for lifecycle cleanup. One
new input was registered after removal and remains untouched pending a new
explicit decision. No Git stage/commit/push occurred.
