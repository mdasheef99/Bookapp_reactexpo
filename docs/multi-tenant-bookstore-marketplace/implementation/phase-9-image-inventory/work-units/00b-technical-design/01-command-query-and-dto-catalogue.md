# WU0B Command, Query, DTO, Error, and Rate Catalogue

**Status:** `implementation_complete_needs_review`
**Authority:** design only; WU0A contracts/registers remain normative

## 1. Shared envelopes and notation

Every command request is a strict, unknown-key-rejecting object containing `contract_version`, UUID `command_id`, 16–128 character `idempotency_key`, target ID, expected target version when stateful, and the named payload. JWT is the trust boundary for user commands; service-role JWT plus a claimed task is the boundary for workers. The actor resolver derives entity ownership and final `store_id`; supplied store identity never authorizes. Every mutation records the canonical result against `(actor-or-service, operation, idempotency_key)` and rejects key reuse with a different request fingerprint.

In the tables: `Tx` means one database transaction after authorization and validation; `RO` means read-only; `V` means an expected-version predicate; `I` means canonical idempotent replay. Events contain only entity/store/actor IDs subject to access policy, operation, version, state/outcome, and bounded code/count. `T0` is IDs/outcome/duration only; `T1` adds bounded counts/categories; `T2` adds byte/dimension/MIME validation summaries. All forbid raw media/model/provider data, prompts, tokens, paths, credentials, customer PII, private notes, and authorization headers. Red references are expanded in [06](./06-red-tests-acceptance-and-handoff.md).

## 2. Command catalogue

| ID / request DTO | Actor, boundary, server authority and preconditions | Transaction, version, idempotency and surviving effect | Errors / HTTP; event; telemetry; rate; red |
| --- | --- | --- | --- |
| C01 `StartSessionRequest` | Verified initiating Owner via Owner Edge boundary; derive eligible active store; language/defaults/policy valid; no conflicting active-session policy | Tx create session/defaults; V policy snapshot; I actor+store+policy; denial leaves none | `AUTHZ`403, `CONFLICT`409, `QUOTA`429; `session.started`; T0; R2; TENANT/STATE |
| C02 `AuthorizeScanUploadRequest` | Initiating Owner; derive active session/store; purpose fixed `scan_input`; envelope within media limits | Tx persist single-use short-lived capability record; V session; I actor+session+media ordinal; failure leaves no authority | `AUTHZ`403, `STATE`409, `MEDIA`422, `QUOTA`429; `input.upload_authorized`; T2; R3; UPLOAD/TENANT |
| C03 `SubmitAcceptedInputRequest` | Initiating Owner; verify capability, sanitized media identity/hash, purpose and session | Tx link input + reserve orchestration/cost identity; V session/capability; I media hash+session; replay returns job identity | `MEDIA`422, `STATE`409, `REPLAY_MISMATCH`409, `QUOTA`429; `input.accepted`; T1; R3; UPLOAD/WORKER |
| C04 `CloseSessionRequest` | Initiating Owner; derive session/store; every accepted input terminal | Tx `active→closing→closed` summary; V session; I actor+session+close; nonterminal failure leaves active | `AUTHZ`403, `STATE`409, `VERSION`409; `session.close_requested`, `session.closed`; T1; R2; STATE |
| C05 `UpdateCandidateReviewRequest` | Initiating Owner; candidate belongs to active/closed reviewable session; strict WU0A metadata/condition fields | Tx staged snapshot only; V candidate; I actor+candidate+action; failure leaves prior review | `AUTHZ`403, `VERSION`409, `VALIDATION`422; `candidate.review_updated`; T1; R2; TENANT/STATE/DTO |
| C06 `AddMissedCandidateRequest` | Initiating Owner; derive session/input; bounded manual identity; session reviewable and under candidate cap | Tx create staged manual candidate; V session/input; I session+manual ordinal; no provider/job effect | `STATE`409, `LIMIT`422, `VALIDATION`422; `candidate.manual_added`; T1; R2; STATE/DTO |
| C07 `SkipCandidateRequest` | Initiating Owner; candidate reviewable; bounded reason code | Tx terminal `skipped_false_detection`; V candidate; I candidate+skip; replay returns terminal result | `AUTHZ`403, `STATE`409, `VERSION`409; `candidate.skipped`; T1; R2; STATE |
| C08 `CommitCandidateRequest(action=create_private)` | Initiating Owner; complete review; recompute same-store duplicate advice; valid quantity/media/condition | Tx private inventory + candidate link + audit only; V candidate/duplicate snapshot; I candidate+commit; publication excluded | WU0A `P9_*` including `P9_DUPLICATE_TARGET_CHANGED`409 and `P9_QUANTITY_INVARIANT_FAILED`409; `candidate.committed_private`; T1; R1; COMMIT/TENANT |
| C09 `CommitCandidateRequest(action=increment_match)` | Initiating Owner; target same store and compatible under locked recomputation | Tx lock target; increment total+available only; V candidate+inventory; I candidate+commit; failure leaves both unchanged | `P9_DUPLICATE_TARGET_CHANGED`409, `P9_QUANTITY_INVARIANT_FAILED`409; `inventory.quantity_incremented`; T1; R1; COMMIT |
| C10 `CommitCandidateRequest(action=create_separate)` | Initiating Owner; explicit separate decision after duplicate warning; complete review | Tx new private inventory and candidate link; V candidate/advice; I candidate+commit; request photos ignored | `VERSION`409, `VALIDATION`422, `P9_QUANTITY_INVARIANT_FAILED`409; `inventory.created_separate`; T1; R1; COMMIT |
| C11 `RequestPublicationRequest` | Same-store authorized Owner; derive inventory/store; eligible approved public metadata/media | Tx record intent then separate projection Tx; V inventory; I inventory+publication version; inventory survives projection failure | `P9_MEDIA_NOT_APPROVED`422, `P9_PUBLICATION_FAILED`202; `publication.requested|published|failed`; T1; R2; PUBLICATION/DTO |
| C12 `RetryPublicationRequest` | Same-store Owner or claimed narrow worker; reauthorize inventory and eligibility | Projection-only Tx; V intent/inventory; I original publication identity; never changes inventory quantity/existence | `AUTHZ`403, `STATE`409, `P9_PUBLICATION_FAILED`202; `publication.retried`; T1; R4; PUBLICATION |
| C13 `MarkNeedsReviewRequest` | Initiating Owner; derive candidate/session; bounded reason | Tx mark review state; V candidate/session; I candidate+reason action; no inventory effect | `AUTHZ`403, `STATE`409, `VERSION`409; `candidate.needs_review`; T1; R2; STATE |
| C14 `RequestCurrentCopyPhotosRequest` | Owning customer through customer boundary; derive request item/store/customer; count 1–3 and item eligible | Tx create/version photo substate; V request item; I customer+item+request; no hold/payment effect alone | `AUTHZ`403, `STATE`409, `LIMIT`422; `photos.requested`; T1; R2; PHOTO/TENANT |
| C15 `AuthorizeRequestPhotoUploadRequest` | Authorized owning-store Owner; derive request item/store; state `requested|uploading`; sequence 1–3 | Tx single-use `customer_request` capability; V photo request; I request+sequence; failure leaves no media link | `AUTHZ`403, `STATE`409, `MEDIA`422, `LIMIT`422; `photos.upload_authorized`; T2; R3; PHOTO/UPLOAD |
| C16 `ProvideRequestPhotosRequest` | Owning-store Owner; validate 1–3 newly captured sanitized request-purpose media IDs | Tx link media then `provided`; V photo request; I request+media-set hash; upload alone survives only as private unlinked staged media | `MEDIA`422, `STATE`409, `VERSION`409; `photos.provided`; T1; R2; PHOTO/LIFECYCLE |
| C17 `AcceptRequestPhotosRequest` | Owning customer; derive request/items; approved evidence present | Tx accept items then call existing Phase 6 recalculation/hold command seam; V request; I customer+request+accept; only validated Phase 6 effects survive | `AUTHZ`403, `STATE`409, `VERSION`409; `photos.accepted`; T1; R1; PHOTO/PHASE6 |
| C18 `DeclineRequestPhotosRequest` | Owning customer; derive request/items; items photo-decision eligible | Tx decline/withdraw and existing Phase 6 release/recalculation seam; V request; I customer+request+decline; no paid-order effect | `AUTHZ`403, `STATE`409, `VERSION`409; `photos.declined`; T1; R1; PHOTO/PHASE6 |
| C19 `MarkRequestItemUnfulfilledRequest` | Authorized owning-store Owner; derive item/store; bounded reason | Tx unavailable + existing Phase 6 release/recalculation seam; V request item; I item+unfulfilled; no payment effect | `AUTHZ`403, `STATE`409, `VERSION`409; `photos.unfulfilled`; T1; R1; PHOTO/PHASE6 |
| C20 `AuthorizePublicCopyUploadRequest` | Same-store Owner; derive candidate/inventory/store; purpose fixed `public_copy`; approved role/envelope | Tx single-use public-copy capability; V entity; I entity+role+ordinal; no public link/publication effect | `AUTHZ`403, `STATE`409, `MEDIA`422, `LIMIT`422; `public_media.upload_authorized`; T2; R3; UPLOAD/DTO |
| C21 `SubmitPublicCopyMediaRequest` | Same-store Owner; approved sanitized public-copy IDs only; role/order bounds | Tx link approval evidence and recompute eligibility; V entity; I entity+media-set hash; request/scan media rejected | `MEDIA`422, `STATE`409, `VERSION`409; `public_media.submitted`; T1; R2; UPLOAD/PUBLICATION |
| C22 `InventoryEditRequest(action=metadata)` | Same-store Owner; derive inventory/store; WU0A-bounded store snapshot; canonical truth immutable | Tx store fields + rematch/eligibility intent; V inventory; I inventory+edit command; previous snapshot survives denial | `AUTHZ`403, `VERSION`409, `VALIDATION`422; `inventory.metadata_updated`; T1; R2; EDIT/DTO |
| C23 `InventoryEditRequest(action=quantity)` | Same-store Owner; derive inventory/store; bounded transfer and active-hold compatibility | Tx lock inventory/holds; preserve bucket equality; V inventory; I inventory+adjustment; failure leaves quantities unchanged | `P9_QUANTITY_INVARIANT_FAILED`409, `VERSION`409; `inventory.quantity_adjusted`; T1; R1; COMMIT/EDIT |
| C24 `InventoryEditRequest(action=commercial_details)` | Same-store Owner; bounded price, shelf/location, public/internal notes; public/private classes enforced | Tx store fields + safe projection refresh if public fields changed; V inventory; I command; prior projection survives failure truthfully | `AUTHZ`403, `VERSION`409, `VALIDATION`422; `inventory.commercial_details_updated`; T1; R2; EDIT/DTO |
| C25 `InventoryEditRequest(action=condition_damage_media)` | Same-store Owner; condition/damage/sellability and approved public media only | Tx disclosure/link update; atomically retract/block ineligible projection; V inventory; I command; private inventory survives | `MEDIA`422, `VALIDATION`422, `VERSION`409; `inventory.condition_damage_updated`; T1; R2; EDIT/PUBLICATION |
| C26 `InventoryEditRequest(action=publication_state)` | Same-store Owner; intent `private|publish|pause`; eligibility reauthorized | Tx intent; C11/C12 projection semantics; V inventory; I command; private/pause retracts projection only | `P9_MEDIA_NOT_APPROVED`422, `P9_PUBLICATION_FAILED`202, `VERSION`409; `publication.intent_changed|retracted`; T1; R2; PUBLICATION |

## 3. Query catalogue

All queries are RO, have no mutation idempotency key, reject unknown parameters, bind authorization before selection, return safe projection DTOs only, and emit query kind/outcome/duration/counts without query text or returned content.

| ID / request → response | Actor, boundary, authority and preconditions | Ordering/version/cache; failure effects | Errors / HTTP; rate; red |
| --- | --- | --- | --- |
| Q01 `SessionSummaryQuery` → `OwnerSessionSummary` | Initiating Owner; Owner boundary derives session/store | session ID; contract version; private/no shared cache; RO none | `AUTHZ`403, `NOT_FOUND`404; R2; TENANT/DTO |
| Q02 `SessionCandidatesQuery` → `OwnerCandidatePage` | Initiating Owner; derive session/store | ordinal then ID cursor; private/no shared cache | `AUTHZ`403, `CURSOR`400; R2; TENANT/DTO |
| Q03 `NeedsReviewQuery` → `OwnerNeedsReviewPage` | Same-store authorized Owner; derive store | updated-at then ID cursor; short private cache with store/version key | `AUTHZ`403, `CURSOR`400; R2; TENANT/DTO |
| Q04 `CandidateDetailQuery` → `OwnerCandidateDetail` | Initiator while session-bound; later same-store access only via approved policy | candidate/version; no shared cache | `AUTHZ`403, `NOT_FOUND`404; R2; TENANT/DTO |
| Q05 `OwnerInventoryQuery` → `OwnerInventoryDetail` | Same-store Owner; derive inventory/store | inventory version; private short cache | `AUTHZ`403, `NOT_FOUND`404; R2; TENANT/DTO |
| Q06 `PublicationStatusQuery` → `OwnerPublicationStatus` | Same-store Owner; derive inventory/store | intent/projection version; private short cache | `AUTHZ`403, `NOT_FOUND`404; R2; PUBLICATION/DTO |
| Q07 `InternalBookMatchQuery` → `InternalMatchSet` | Service-only inside Q08; no client callable boundary | query/ranking version; no independent client cursor/cache | `AUTHZ`403, `VALIDATION`422; R4; MARKET/DTO |
| Q08 `MarketplaceStoreSearchQuery` → `PublicStoreGroupPage` | Public boundary; eligible public projection only | context-authenticated cursor, rank then `store_id`; public versioned cache | `CURSOR`400, `RATE`429; R5; MARKET/DTO |
| Q09 `StorefrontCatalogueQuery` → `PublicStorefrontCatalogue` | Public; active public store/profile/projection only | complete stable title/offer ordering; optional pinned match context | `NOT_FOUND`404, `CURSOR`400; R5; MARKET/DTO |
| Q10 `ListingDetailQuery` → `PublicListingDetail` | Public; eligible projection only | listing/projection version; public cache | `NOT_FOUND`404; R5; MARKET/DTO |
| Q11 `RequestPhotoStatusQuery` → actor-specific `CustomerPhotoStatus` or `OwnerPhotoStatus` | Owning customer or owning-store Owner; derive request/item/store | request version; private/no shared cache; capability fetched separately after reauth | `AUTHZ`403, `NOT_FOUND`404; R2; PHOTO/TENANT/DTO |

## 4. DTO projection inventory

| Projection | Positive allowlist |
| --- | --- |
| Owner session/candidate | IDs, ordinal, bounded reviewed metadata/provenance summary, warnings, state/version, actionable stable errors and counts |
| Owner inventory/publication | Store-owned fields, approved private quantity buckets, condition/damage, media role IDs, intent/projection status/version |
| Customer photo | Own request/item IDs, photo state/version, approved evidence metadata; short-lived media capability only in dedicated response |
| Public store group | WU0A register fields: public store identity/locality, match summary, availability band, cover, price-from, condition/damage summary, counts and cursor |
| Public storefront/listing | Approved authoritative metadata, price, condition/damage, public-copy media and disclosures; complete active catalogue semantics |
| Internal match/job | Opaque IDs, contract/policy versions, bounded scores/reasons, attempt/lease metadata and provider reference IDs; never exposed externally |

## 5. Stable error-to-HTTP catalogue

WU0A’s seven `P9_*` entries remain unchanged. Before runtime implementation, its catalogue must add the following closed entries with the same fields and idempotency-reuse semantics: `P9_AUTH_REQUIRED`401, `P9_REQUEST_INVALID`400, `P9_NOT_FOUND`404, `P9_STATE_CONFLICT`409, `P9_VERSION_CONFLICT`409, `P9_IDEMPOTENCY_MISMATCH`409, `P9_LIMIT_EXCEEDED`422, `P9_QUOTA_EXCEEDED`429, `P9_RATE_LIMITED`429, and `P9_CURSOR_INVALID`400. Table shorthand maps `AUTHZ` to `P9_OWNER_NOT_AUTHORIZED`, `MEDIA` to `P9_MEDIA_NOT_APPROVED`, and the remaining labels to these required additions. Unexpected errors return `P9_INTERNAL_ERROR`500 with no internal detail and require a catalogue addition before runtime.

## 6. Rate and abuse classes

| Class | Boundary | Design |
| --- | --- | --- |
| R1 critical mutation | Commit, quantity, customer decision, unfulfilled | Per actor+store/entity; low burst; idempotent retries exempt only after fingerprint match |
| R2 normal private | Review/edit/status/session/photo actions | Per actor+store plus entity caps; suspicious cross-entity failures tighten limits |
| R3 upload authority | All three capability issuers | Per actor+store+IP, daily store media quota, purpose/entity/ordinal hard caps |
| R4 service/worker | Claims, retry, internal match | Service identity+kind+store; batch/attempt/lease caps; circuit breaker |
| R5 public query | Marketplace/storefront/listing | Per IP/session, normalized-context cache, bounded page size 50; enumeration anomaly controls |

Locked hard limits are 15 candidates, one whole-image vision fallback, 1–3 request/public-copy photos, WU0A field bounds, and strict payload size. Concrete time windows, quotas, and capability TTLs are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN` or later configuration approval; they may not be unbounded.
