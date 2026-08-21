param(
    [switch]$RunSemanticNegativeProbes
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Get-DocumentSizeSignals {
    param([hashtable]$LineCounts)
    $signals = [System.Collections.Generic.List[object]]::new()
    foreach ($path in $LineCounts.Keys) {
        $count = [int]$LineCounts[$path]
        if ($count -gt 500) {
            $signals.Add([pscustomobject]@{ Path = $path; Lines = $count; Level = 'split_advisory' })
        } elseif ($count -ge 400) {
            $signals.Add([pscustomobject]@{ Path = $path; Lines = $count; Level = 'cohesion_assessment' })
        }
    }
    return $signals
}
function Get-Wu0bSemanticStateErrors {
    param([hashtable]$Bodies)
    $errors = [System.Collections.Generic.List[string]]::new()
    $claimRules = @(
        @{ Name = 'session'; Domain = 'session'; Allowed = @('active', 'closing', 'closed', 'expired') },
        @{ Name = 'image-input'; Domain = '(?:image_input|input)'; Allowed = @('uploaded', 'validating', 'queued', 'processing', 'ready', 'failed', 'skipped') },
        @{ Name = 'candidate'; Domain = 'candidate'; Allowed = @('processing', 'ready', 'needs_review', 'possible_duplicate', 'failed', 'commit_in_progress', 'committed') },
        @{ Name = 'request-photo'; Domain = '(?:request_photo|photo)'; Allowed = @('none', 'requested', 'uploading', 'provided', 'accepted', 'declined', 'unfulfilled', 'expired') },
        @{ Name = 'hold'; Domain = 'holds?'; Allowed = @('active', 'released', 'converted_to_sale') }
    )
    foreach ($relative in $Bodies.Keys) {
        $lineNumber = 0
        foreach ($line in ($Bodies[$relative] -split "`r?`n")) {
            $lineNumber++
            $compact = ($line.ToLowerInvariant() -replace '[^a-z0-9]', '')
            $semantic = $line.ToLowerInvariant().Replace(([string][char]0x2192), ' arrow ') -replace "'s\b", '' -replace '->', ' arrow ' -replace '=', ' equals ' -replace ':', ' colon ' -replace 'is[\s-]*persisted[\s-]*as', 'is persisted as' -replace 'persisted[\s-]*as', 'persisted as' -replace 'request[\s-]*photo', 'request_photo' -replace 'image[\s-]*input', 'image_input' -replace '[^a-z0-9_]+', ' ' -replace '\s+', ' '
            if ($compact -match '(?:notrequested|unrequested|pendingrequest)') { $errors.Add("PHOTO_UNKNOWN_STATE:${relative}:$lineNumber") }
            if ($line -match '(?i)skipped_false_detection' -and $line -notmatch '(?i)review disposition.*not (?:a )?candidate state') { $errors.Add("CANDIDATE_DISPOSITION_AS_STATE:${relative}:$lineNumber") }
            foreach ($rule in $claimRules) {
                $context = '(?:(?:state|status|workflow|lifecycle)\s+){0,2}'; $allowed = $rule.Allowed -join '|'
                $patterns = @(
                    "\b$($rule.Domain)\b\s+$context(?:is\s+)?persisted\s+as\s+([a-z_]+)", "\b$($rule.Domain)\b\s+$context(?:becomes)\s+([a-z_]+)",
                    "\b$($rule.Domain)\b\s+$context(?:advances|transitions)\s+(?:to|into)\s+([a-z_]+)", "\b$($rule.Domain)\b\s+$context(?:(?:advances|transitions)\s+)?from\s+(?:$allowed)\s+(?:to|into|arrow)\s+([a-z_]+)",
                    "\b$($rule.Domain)\b\s+(?:(?:persisted\s+)?(?:state|status|workflow|lifecycle)\s+)+(?:is|equals|colon)\s+([a-z_]+)", "\b$($rule.Domain)\b\s+${context}terminal(?:\s+(?:state|status|outcome))?\s+(?:is|becomes)\s+([a-z_]+)", "\b$($rule.Domain)\b\s+$context(?:(?:colon|equals)\s+)?(?:$allowed)\s+arrow\s+([a-z_]+)"
                )
                foreach ($pattern in $patterns) { foreach ($match in [regex]::Matches($semantic, $pattern)) {
                    $value = $match.Groups[1].Value.ToLowerInvariant(); if ($value -notin $rule.Allowed) { $errors.Add("UNKNOWN_$($rule.Name.ToUpperInvariant().Replace('-', '_'))_STATE:${value}:${relative}:$lineNumber") }
                } }
            }
        }
    }
    return $errors
}
$phaseRoot = Split-Path -Parent $PSScriptRoot
$implementationRoot = Split-Path -Parent $phaseRoot
$marketplaceRoot = Split-Path -Parent $implementationRoot
$repoRoot = (Resolve-Path (Join-Path $marketplaceRoot '..\..')).Path
$requiredPhaseFiles = @(
    'README.md', 'SESSION-START.md', 'TRACKER.md', '00-phase-9-master-sdd.md',
    '01-data-canonical-metadata-sdd.md', '02-extraction-enrichment-pipeline-sdd.md',
    '03-owner-review-inventory-commit-sdd.md', '04-media-security-privacy-sdd.md',
    '05-marketplace-discovery-display-sdd.md', '06-customer-photo-request-extension-sdd.md',
    'supporting/data-dictionary.md', 'supporting/database-current-vs-target.md',
    'supporting/requirements-traceability.md', 'supporting/complexity-and-scope-register.md',
    'trackers/01-planning-and-decisions.md', 'trackers/02-implementation-and-verification.md', 'trackers/03-unit4-implementation-evidence.md',
    'trackers/04-deployment-runtime-scaffolding-evidence.md', 'trackers/05-m11-m12-live-application-evidence.md',
    'trackers/06-fixture-pipeline-deployment-evidence.md',
    'trackers/12-unit5c-lite-sdd-evidence.md',
    'trackers/13-unit5c1-variant-contract-evidence.md',
    'trackers/14-unit5c2-variant-persistence-evidence.md',
    'trackers/15-unit5c3-runtime-reconciliation-evidence.md',
    'trackers/16-unit5c4-active-variant-search-evidence.md',
    'trackers/18-unit6-owner-ux-design-evidence.md',
    'trackers/19-unit6a-owner-safe-backend-evidence.md',
    'trackers/20-unit6b-route-query-cache-evidence.md',
    'trackers/21-unit6c-capture-upload-recovery-evidence.md',
    'trackers/22-unit6d-candidate-review-evidence.md', 'trackers/23-unit6e-review-corrections-evidence.md', 'trackers/24-unit6f-readiness-quality-gates-evidence.md', 'trackers/25-owner-inventory-read-boundary-wu1-evidence.md', 'trackers/26-owner-inventory-read-client-wu2-evidence.md',
    'trackers/29-unit7a-create-only-commit-evidence.md',
    'work-units/00-contracts-threat-migration-plan.md', 'work-units/00b-backend-api-technical-design-plan.md',
    'work-units/00b-technical-design/00-overview-authority-and-file-map.md', 'work-units/00b-technical-design/01-command-query-and-dto-catalogue.md',
    'work-units/00b-technical-design/02-authorization-tenancy-and-privacy.md', 'work-units/00b-technical-design/03-state-transactions-idempotency-and-publication.md',
    'work-units/00b-technical-design/04-jobs-providers-and-media-boundaries.md', 'work-units/00b-technical-design/05-marketplace-and-request-photo-design.md',
    'work-units/00b-technical-design/06-red-tests-acceptance-and-handoff.md',
    'work-units/01-package1-live-audit.md', 'work-units/01-package1-database-design.md',
    'work-units/04-fixture-vision-analysis-runtime-design.md', 'work-units/04a-deployment-runtime-scaffolding-sdd.md',
    'work-units/04b-gemini-vision-adapter-handoff.md',
    'work-units/05c-lite-multilingual-search-variants-sdd.md',
    'work-units/06-owner-capture-review-recovery-ux-sdd.md',
    'work-units/owner-inventory-read-boundary-wu1-sdd.md',
    'work-units/owner-inventory-read-client-wu2-sdd.md',
    'work-units/06-owner-capture-review-recovery-contract-matrix.md',
    'work-units/07a-create-only-inventory-commit-sdd.md',
    'work-units/08-marketplace-bookstore-first-sdd.md'
)
$missing = @()
foreach ($relative in $requiredPhaseFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $phaseRoot $relative))) {
        $missing += $relative
    }
}
$requiredGlobal = @(
    (Join-Path $repoRoot 'AGENTS.md'),
    (Join-Path $marketplaceRoot 'README.md'),
    (Join-Path $implementationRoot 'README.md'),
    (Join-Path $implementationRoot 'ACTIVE.md'),
    (Join-Path $implementationRoot 'PHASE-9-image-to-LLM-inventory.md'),
    (Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md')
)
foreach ($path in $requiredGlobal) {
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $path
    }
}
if ($missing.Count -gt 0) { Write-Error ("Missing continuity files:`n" + ($missing -join "`n")) }
$trackerPath = Join-Path $phaseRoot 'TRACKER.md'
$tracker = [IO.File]::ReadAllText($trackerPath)
$trackerMarkers = @(
    '**Planning status:**', '**Implementation status:**', '**Current milestone:**', '**Active work unit:**',
    '**Next authorized action:**', '**Implementation authority:**',
    '**Migration creation/application authority:**'
)
foreach ($marker in $trackerMarkers) {
    if (-not $tracker.Contains($marker)) {
        Write-Error "TRACKER.md is missing required marker: $marker"
    }
}
$active = [IO.File]::ReadAllText((Join-Path $implementationRoot 'ACTIVE.md'))
if (-not $active.Contains('phase-9-image-inventory/SESSION-START.md')) { Write-Error 'ACTIVE.md does not route to the Phase 9 session entrypoint.' }
if (-not $active.Contains('DOC-13-implementation-tracker.md')) { Write-Error 'ACTIVE.md does not route to DOC-13.' }
$legacyM32Handoff = $active.Contains('Structural vision-candidate to metadata-worker to Owner-readback integration has completed the final bounded correction pass') -and
    $active.Contains('Forward M32 is repository-only and unapplied') -and
    $active.Contains('M30 and WU1 remain the recorded live migration tail') -and
    $active.Contains('No provider call, deployment, scheduler, database/Storage mutation') -and
    $active.Contains('Unit 7 work occurred') -and
    $active.Contains('exact-project preflight and M32 application remain separately gated')
$liveM32Handoff = $active.Contains('M32 (`20260808020404`)') -and
    $active.Contains('controlled live proof configured exactly one Google Books registry row') -and
    $active.Contains('stopped before candidate creation') -and
    $active.Contains('No provider call, candidate, metadata job, deployment, metadata scheduler, inventory/publication effect, or Unit 7 work occurred')
$metadataSafetyHandoff = $active.Contains('M32 is live exactly once as `20260808020404`') -and
    $active.Contains('fails closed unless `SUPABASE_URL` is the exact approved HTTPS origin') -and
    $active.Contains('bounded invoker supports `metadata`') -and
    $active.Contains('Exactly one process-only Google Books adapter request returned HTTP 200') -and
    $active.Contains('scheduler/dispatch, deployment, Unit 7, inventory, and publication remain unchanged/excluded')
$dispatcherHandoff = $active.Contains('Phase 9 Automatic Worker Wake Dispatcher') -and
    $active.Contains('M36 is local/unapplied') -and
    $active.Contains('no Phase 9 cron') -and
    $active.Contains('no Phase 9 Vault secrets') -and
    $active.Contains('Migration application, Vault/Cron/Render mutation')
$integrationHandoff = $active.Contains('Phase 9 Unit 6 pre-main integration reconciliation') -and
    $active.Contains('M36 remains local/unapplied') -and
    $active.Contains('Supabase, Vault, Cron, Render') -and
    $active.Contains('Unit 7') -and
    $active.Contains('publication mutations remain prohibited')
$metadataRetryHandoff = $active.Contains('phase9_metadata_retry_provider_attempt_correction') -and
    $active.Contains('M32-M37 are live exactly once') -and
    $active.Contains('Local forward M38') -and
    $active.Contains('independently `APPROVED`') -and
    $active.Contains('M38 application, deployment, live-job mutation') -and
    $active.Contains('media, vision, query-policy, Unit 7')
$unit6ClosureHandoff = $active.Contains('Unit 6 is complete') -and
    $active.Contains('M32-M38 are live exactly once') -and
    $active.Contains('a138baa7d3bbc086da019bc052a5ae31d0e15882') -and
    $active.Contains('Duplicate replay was not tested') -and
    $active.Contains('Unit 7 was not started')
$mobileUploadCorrectionHandoff = $active.Contains('Android attempt') -and
    $active.Contains('raw `ArrayBuffer` bytes') -and
    $active.Contains('No post-fix native upload or external mutation was authorized') -and
    $active.Contains('Unit 7')
$mobileUploadNativeFailureHandoff = $active.Contains('authorized Expo Go proof shows Android still reaches signed Storage PUT') -and
    $active.Contains('HTTP 400') -and
    $active.Contains('P9_SINGLE_IMAGE_LIMIT') -and
    $active.Contains('No object or input was created') -and
    $active.Contains('Unit 7')
$mobileUploadFileSystemHandoff = $active.Contains('Expo FileSystem `UploadTask`') -and
    $active.Contains('294/294') -and
    $active.Contains('fresh Android Storage `2xx` proof is not yet run') -and
    $active.Contains('P9_SINGLE_IMAGE_LIMIT') -and
    $active.Contains('Unit 7 remains unauthorized')
$visionResponseResilienceHandoff = $active.Contains('signed Storage `2xx`') -and
    $active.Contains('P9_VISION_SCHEMA_INVALID') -and
    $active.Contains('16-100') -and
    $active.Contains('21/21') -and
    $active.Contains('Unit 7 remains unauthorized')
$unit7aCreateOnlyHandoff = $active.Contains('Unit 7A create-only inventory commit design is frozen') -and
    $active.Contains('exactly one new private inventory row') -and
    $active.Contains('publication is Unit 7B') -and
    $active.Contains('forward migration') -and
    $active.Contains('separately authorized load-bearing red tests')
$unit7aLocalCompleteHandoff = $active.Contains('Unit 7A create-only inventory commit is locally complete and review-pending') -and
    $active.Contains('Local unapplied M39') -and
    $active.Contains('479/479') -and
    $active.Contains('No live migration') -and
    $active.Contains('M39 application')
$unit7aM39LiveHandoff = $active.Contains('M39 is live exactly once as `20260812003419 marketplace_phase9_create_only_inventory_commit`') -and
    $active.Contains('Post-apply source/ACL readback passed') -and
    $active.Contains('Controlled live Add-to-Inventory and exact-replay proof')
$unit7aEdgeBlockedHandoff = $active.Contains('The sole authorized `phase9-owner-ingestion` deployment attempt failed before activation') -and
    $active.Contains('`../contracts/registers` without `.ts`') -and
    $active.Contains('version 3 remains ACTIVE') -and
    $active.Contains('controlled live Add-to-Inventory/exact replay')
if (-not ($legacyM32Handoff -or $liveM32Handoff -or $metadataSafetyHandoff -or $dispatcherHandoff -or $integrationHandoff -or $metadataRetryHandoff -or $unit6ClosureHandoff -or $mobileUploadCorrectionHandoff -or $mobileUploadNativeFailureHandoff -or $mobileUploadFileSystemHandoff -or $visionResponseResilienceHandoff -or $unit7aCreateOnlyHandoff -or $unit7aLocalCompleteHandoff -or $unit7aM39LiveHandoff -or $unit7aEdgeBlockedHandoff)) {
    Write-Error 'ACTIVE.md does not preserve the current Phase 9 handoff and external-mutation gates.'
}
$doc13 = [IO.File]::ReadAllText((Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
if ($doc13 -notmatch '\| Current phase \| Phase 9:') { Write-Error 'DOC-13 does not identify Phase 9 as the current marketplace phase.' }
if (-not ($doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6e_finalized_unit6f_separately_gated`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6f_browser_verified_native_gate_pending`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `wu1_owner_inventory_read_boundary_locally_complete_unapplied`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `wu1_owner_inventory_read_boundary_applied_runtime_deferred`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `wu2_owner_inventory_client_locally_complete_runtime_deferred`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `structural_metadata_integration_locally_complete_unapplied`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `structural_metadata_corrections_complete_pending_rereview_unapplied`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `final_targeted_corrections_complete_ready_for_approval_rereview_unapplied`') -or
    $doc13.Contains('M32 live exactly once; controlled metadata proof blocked before provider egress') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `m33_local_complete_awaiting_review_and_application`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6_pre_main_integration_reconciliation`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6_complete_live_verified`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6_mobile_upload_transport_correction_locally_verified`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6_mobile_upload_transport_native_failed_diagnosed`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6_mobile_filesystem_transport_locally_verified_live_pending`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit6_multilingual_vision_response_resilience_locally_verified_review_pending`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7a_create_only_design_frozen`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7a_locally_complete_review_pending`') -or
    $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7a_m39_live_runtime_deployment_pending`') -or
     $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7a_edge_deployment_blocked_by_source_routing_mismatch`') -or
     $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7b_live_rollout_pass_ready_for_main_authorization`') -or
     $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7b_main_integrated_next_scope_authorization`') -or
     $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `unit7c_wu5_store_view_cutover_locally_complete`')) -or
    -not $doc13.Contains('20260727222159 marketplace_phase9_metadata_foundation') -or
    -not $doc13.Contains('20260727231217 marketplace_phase9_sensitive_table_acl_correction') -or
    -not $doc13.Contains('20260727233457 marketplace_phase9_maintain_acl_correction') -or
    -not $doc13.Contains('20260729004216 marketplace_phase9_search_variant_proposals') -or
    -not $doc13.Contains('20260729020008') -or
    -not $doc13.Contains('20260729054842') -or
    -not $doc13.Contains('20260729060238') -or
    -not $doc13.Contains('20260729075459') -or
    -not $doc13.Contains('20260729082153') -or
    -not $doc13.Contains('20260730022442') -or
    -not $doc13.Contains('20260730022524') -or
    -not $doc13.Contains('20260730022559') -or
    -not $doc13.Contains('20260730022636') -or
    -not $doc13.Contains('20260730022713')) { Write-Error 'DOC-13 does not preserve the M15-M28 live chain.' }
if (-not $doc13.Contains('No language is benchmarked or approved') -or
    -not $doc13.Contains('no capability is enabled')) {
    Write-Error 'DOC-13 does not preserve the fail-closed Unit 5C-5/5C-6 closeout.'
}
$implementationTracker = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/02-implementation-and-verification.md'))
if (-not ($implementationTracker.Contains('**Status:** `unit6e_finalized_unit6f_separately_gated`') -or
    $implementationTracker.Contains('**Status:** `unit6f_browser_verified_native_gate_pending`') -or
    $implementationTracker.Contains('**Status:** `wu1_owner_inventory_read_boundary_locally_complete_unapplied`') -or
    $implementationTracker.Contains('**Status:** `wu1_owner_inventory_read_boundary_applied_runtime_deferred`') -or
    $implementationTracker.Contains('**Status:** `wu2_owner_inventory_client_locally_complete_runtime_deferred`') -or
    $implementationTracker.Contains('**Status:** `structural_metadata_integration_locally_complete_unapplied`') -or
    $implementationTracker.Contains('**Status:** `final_targeted_corrections_complete_ready_for_approval_rereview_unapplied`') -or
    $implementationTracker.Contains('**Status:** `live_metadata_vertical_proof_blocked_before_provider_egress`') -or
    $implementationTracker.Contains('**Status:** `metadata_runtime_safety_complete_google_books_adapter_smoke_blocked`') -or
    $implementationTracker.Contains('**Status:** `metadata_runtime_safety_and_google_books_adapter_smoke_complete`') -or
    $implementationTracker.Contains('**Status:** `m33_vision_reservation_correction_local_complete_awaiting_review_and_application`') -or
    $implementationTracker.Contains('**Status:** `compact_gemini_multilingual_language_hint_local_complete_unapplied`') -or
    $implementationTracker.Contains('**Status:** `compact_gemini_required_diagnostics_correction_complete_awaiting_rereview`') -or
    $implementationTracker.Contains('**Status:** `single_image_safe_remove_local_complete_m35_unapplied`') -or
    $implementationTracker.Contains('**Status:** `single_image_safe_remove_m35_live_edge_v3_verified`') -or
    $implementationTracker.Contains('**Status:** `automatic_worker_wake_dispatcher_local_review_corrections_applied`') -or
    $implementationTracker.Contains('**Status:** `unit6_pre_main_integration_reconciliation_in_progress`') -or
    $implementationTracker.Contains('**Status:** `unit6_pre_main_candidate_corrections_verified_rereview_pending`') -or
    $implementationTracker.Contains('**Status:** `metadata_retry_correction_locally_complete_approved`') -or
    $implementationTracker.Contains('**Status:** `unit6_complete_live_verified`') -or
    $implementationTracker.Contains('**Status:** `unit6_mobile_upload_transport_correction_locally_verified`') -or
    $implementationTracker.Contains('**Status:** `unit6_mobile_filesystem_transport_locally_verified_live_pending`') -or
    $implementationTracker.Contains('**Status:** `unit6_multilingual_vision_response_resilience_locally_verified_review_pending`') -or
    $implementationTracker.Contains('**Status:** `unit7a_locally_complete_review_pending`') -or
    $implementationTracker.Contains('**Status:** `unit7a_m39_live_runtime_deployment_pending`') -or
     $implementationTracker.Contains('**Status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`') -or
     $implementationTracker.Contains('**Status:** `unit7b_live_rollout_pass_ready_for_main_authorization`') -or
     $implementationTracker.Contains('**Status:** `unit7b_main_integrated_next_scope_authorization`') -or
     $implementationTracker.Contains('**Status:** `unit7c_wu5_store_view_cutover_locally_complete`') -or
     $implementationTracker.Contains('**Status:** `unit8_repository_complete_closure_ready_operationally_pending`')) -or
    -not ($implementationTracker.Contains('**Active work unit:** `unit6f_awaiting_separate_authorization`') -or
    $implementationTracker.Contains('**Active work unit:** `unit6f_browser_verified_native_gate_pending`') -or
    $implementationTracker.Contains('**Active work unit:** `owner_inventory_read_boundary_wu1`') -or
    $implementationTracker.Contains('**Active work unit:** `owner_inventory_read_client_wu2`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_core_pipeline_vertical_integration_audit`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_structural_metadata_integration`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_structural_metadata_integration_correction_pass`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_structural_metadata_integration_correction_pass_complete`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_controlled_live_metadata_vertical_proof`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_metadata_worker_configuration_safe_invocation_and_supabase_target_guard`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_metadata_worker_configuration_safe_invocation_and_supabase_target_guard_complete`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_m33_vision_reservation_correction`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_compact_gemini_multilingual_language_hint_correction`') -or
    $implementationTracker.Contains('**Active work unit:** `unit6c_single_image_safe_remove`') -or
    $implementationTracker.Contains('**Active work unit:** `phase9_metadata_retry_provider_attempt_correction`') -or
    $implementationTracker.Contains('**Active work unit:** `unit6_complete`') -or
    $implementationTracker.Contains('**Active work unit:** `unit6_mobile_upload_transport_correction_local_complete`') -or
    $implementationTracker.Contains('**Active work unit:** `unit6_mobile_filesystem_transport_live_proof_pending`') -or
     $implementationTracker.Contains('**Active work unit:** `phase9_multilingual_vision_response_resilience_review`') -or
     $implementationTracker.Contains('**Active work unit:** `unit7b_main_authorization_preparation`') -or
     $implementationTracker.Contains('**Active work unit:** `phase9_post_unit7b_handoff`') -or
     $implementationTracker.Contains('**Active work unit:** `unit7c_wu5_store_view_cutover`') -or
     $implementationTracker.Contains('**Active work unit:** `unit8_closure_ready`') -or
    $implementationTracker.Contains('**Active work unit:** `unit7a_create_only_commit_red_tests_pending_separate_authorization`') -or
    $implementationTracker.Contains('**Active work unit:** `unit7a_create_only_commit_locally_complete_review_pending`') -or
    $implementationTracker.Contains('**Active work unit:** `unit7a_owner_edge_import_resolution_correction_requires_separate_authorization`') -or
    $implementationTracker.Contains('**Active work unit:** `unit7a_post_m39_feature_push_and_owner_edge_deployment`') -or
    $implementationTracker.Contains('**Active work unit:** [`automatic_worker_wake_dispatcher`') -or
    $implementationTracker.Contains('**Active work unit:** [`unit6_pre_main_integration_reconciliation`')) -or
    -not $implementationTracker.Contains('20-unit6b-route-query-cache-evidence.md') -or
    -not $implementationTracker.Contains('22-unit6d-candidate-review-evidence.md') -or
    -not $implementationTracker.Contains('23-unit6e-review-corrections-evidence.md') -or
    -not $implementationTracker.Contains('24-unit6f-readiness-quality-gates-evidence.md') -or
    -not $implementationTracker.Contains('20260729000018_marketplace_phase9_search_variant_proposals.sql') -or
    -not $implementationTracker.Contains('20260729000019_marketplace_phase9_search_variant_replay_fence.sql') -or
    -not $implementationTracker.Contains('20260729000020_marketplace_phase9_variant_runtime_search.sql') -or
    -not $implementationTracker.Contains('20260729000021_marketplace_phase9_defer_active_variant_search.sql') -or
    -not $implementationTracker.Contains('20260729000022_marketplace_phase9_active_variant_search.sql') -or
    -not $implementationTracker.Contains('20260729000023_marketplace_phase9_active_variant_search_correction.sql') -or
    -not $implementationTracker.Contains('20260730022442') -or
    -not $implementationTracker.Contains('20260730022524') -or
    -not $implementationTracker.Contains('20260730022559') -or
    -not $implementationTracker.Contains('20260730022636') -or
    -not $implementationTracker.Contains('20260730022713') -or
    -not $implementationTracker.Contains('20260801093048 marketplace_phase9_unit6e_review_corrections')) {
    Write-Error 'Implementation tracker does not preserve the Unit 6E/M30 handoff.'
}
$providerScaleMarkers = @{
    '00-phase-9-master-sdd.md' = @('MAS-13', 'MAS-17', 'MAS-AC14')
    '01-data-canonical-metadata-sdd.md' = @('DAT-28', 'DAT-33')
    '02-extraction-enrichment-pipeline-sdd.md' = @('EXT-26', 'EXT-39', 'CPU, memory, dimensions, decoding, and re-encoding', 'persistence: disabled by default')
    '04-media-security-privacy-sdd.md' = @('MED-28', 'MED-29', 'mandatory deletion within 7 days')
    'supporting/requirements-traceability.md' = @('Exactly one primary, optional secondary', 'Autoscaling disabled until fixed multi-replica evidence', 'Raw provider payload disabled by default')
    'trackers/01-planning-and-decisions.md' = @('P9-D57', 'P9-D63', 'P9-D64', 'gemini-3.5-flash-lite')
}
foreach ($relative in $providerScaleMarkers.Keys) {
    $body = [IO.File]::ReadAllText((Join-Path $phaseRoot $relative))
    foreach ($marker in $providerScaleMarkers[$relative]) {
        if (-not $body.Contains($marker)) { Write-Error "Provider/scale reconciliation marker missing from ${relative}: $marker" }
    }
}
$unit5cMarkers = @{
    'work-units/05c-lite-multilingual-search-variants-sdd.md' = @(
        'Current runtime versus approved target', 'auto-detection is the default',
        'search_variant_proposals_v1', 'Deterministic search keys',
        'title and author confirmation is independent', 'store-scoped',
        'positive selling price', 'price-on-request is excluded',
        'Roman-query metadata fallback belongs'
    )
    'supporting/data-dictionary.md' = @('live current representation', 'Unit 5C Lite target and live Unit 5C-3 reconciliation foundation', 'phase9_search_variant_proposals', 'M23')
    'supporting/database-current-vs-target.md' = @('M18 live closeout', 'M20/M21 Unit 5C-3 closeout', 'M22/M23 Unit 5C-4 closeout')
    'supporting/requirements-traceability.md' = @('Unit 5C Lite target reconciliation', 'MAS-AC18', 'Unit 5C-4 implementation mapping')
    'trackers/01-planning-and-decisions.md' = @('P9-D65', 'P9-D69')
}
foreach ($relative in $unit5cMarkers.Keys) {
    $body = [IO.File]::ReadAllText((Join-Path $phaseRoot $relative))
    foreach ($marker in $unit5cMarkers[$relative]) {
        if (-not $body.Contains($marker)) { Write-Error "Unit 5C Lite reconciliation marker missing from ${relative}: $marker" }
    }
}
$unit5cHandoffMarkers = @{
    (Join-Path $marketplaceRoot 'README.md') = @(
        'The current runtime uses one selected language',
        'Unit 5C Lite target',
        'former target requirement for up to three automated English aliases is',
        'Later generation',
        'positive selling price',
        'price-on-request is excluded'
    )
    (Join-Path $implementationRoot 'README.md') = @(
        'selected session language only as a',
        'non-authoritative hint',
        'compact Gemini contract',
        'original-language title and author as primary',
        'M18/M19 private proposal envelope',
        'field-specific, store-scoped'
    )
    (Join-Path $implementationRoot 'PHASE-9-image-to-LLM-inventory.md') = @(
        'selected session language as a non-authoritative',
        'compact Gemini contract',
        'former giant nested provider sidecar is superseded',
        'M18/M19 private proposal envelope',
        'original-language title and author as primary values'
    )
}
foreach ($path in $unit5cHandoffMarkers.Keys) {
    $body = [IO.File]::ReadAllText($path)
    foreach ($marker in $unit5cHandoffMarkers[$path]) {
        if (-not $body.Contains($marker)) {
            Write-Error "Unit 5C Lite handoff marker missing from ${path}: $marker"
        }
    }
}
$securitySdd = [IO.File]::ReadAllText((Join-Path $phaseRoot '04-media-security-privacy-sdd.md'))
$securityCorrectionMarkers = @(
    'client and build bundles, prompts, fixtures, notifications, logs, telemetry, errors, documentation, Git, or model context',
    'Non-secret provider and model identifiers remain permitted',
    'private, schema-bounded, positive-allowlist diagnostic capture',
    'credentials, secrets, signed URLs, reusable capabilities, PII, raw media, or unrestricted prompts/responses',
    'idempotent deletion, bounded retries, alerts, and failed-deletion reconciliation'
)
foreach ($marker in $securityCorrectionMarkers) {
    if (-not $securitySdd.Contains($marker)) { Write-Error "F3 security correction marker missing: $marker" }
}
$requirementFiles = @(
    '00-phase-9-master-sdd.md', '01-data-canonical-metadata-sdd.md', '02-extraction-enrichment-pipeline-sdd.md',
    '03-owner-review-inventory-commit-sdd.md', '04-media-security-privacy-sdd.md',
    '05-marketplace-discovery-display-sdd.md', '06-customer-photo-request-extension-sdd.md'
)
$definitionPattern = '(?m)^\| ((?:MAS-AC\d{2}|MAS-\d{2}|DAT-\d{2}|EXT-\d{2}|REV-\d{2}|MED-\d{2}|MKT-\d{2}|PHO-\d{2})) \|'
$requirementIds = @()
foreach ($relative in $requirementFiles) {
    $requirementIds += [regex]::Matches([IO.File]::ReadAllText((Join-Path $phaseRoot $relative)), $definitionPattern) |
        ForEach-Object { $_.Groups[1].Value }
}
$duplicateRequirementIds = @($requirementIds | Group-Object | Where-Object Count -gt 1)
if ($duplicateRequirementIds.Count -gt 0) {
    Write-Error "Duplicate requirement definitions: $(($duplicateRequirementIds.Name | Sort-Object) -join ', ')"
}
$traceability = [IO.File]::ReadAllText((Join-Path $phaseRoot 'supporting/requirements-traceability.md'))
$traceableIds = [System.Collections.Generic.HashSet[string]]::new()
$tracePattern = '(?<prefix>MAS-AC|MAS|DAT|EXT|REV|MED|MKT|PHO)-?(?<start>\d{2})(?:(?:-|[^\x00-\x7F]{1,4})(?:(?:MAS-AC|MAS|DAT|EXT|REV|MED|MKT|PHO)-?)?(?<end>\d{2})|(?<more>(?:/\d{2})+))?'
foreach ($match in [regex]::Matches($traceability, $tracePattern)) {
    $prefix = $match.Groups['prefix'].Value
    $numbers = @([int]$match.Groups['start'].Value)
    if ($match.Groups['end'].Success) {
        $numbers = @($numbers[0]..[int]$match.Groups['end'].Value)
    } elseif ($match.Groups['more'].Success) {
        $numbers += @($match.Groups['more'].Value.Split('/', [StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object { [int]$_ })
    }
    foreach ($number in $numbers) {
        [void]$traceableIds.Add(("$prefix-{0:D2}" -f $number).Replace('MAS-AC-', 'MAS-AC'))
    }
}
$missingTraceability = @($requirementIds | Where-Object { -not $traceableIds.Contains($_) })
if ($missingTraceability.Count -gt 0) {
    Write-Error "Requirement definitions missing traceability: $($missingTraceability -join ', ')"
}
$duplicateDefinitionProbe = @($requirementIds + $requirementIds[0])
$duplicateDefinitionProbeMatches = @($duplicateDefinitionProbe | Group-Object | Where-Object Count -gt 1)
if ($duplicateDefinitionProbeMatches.Count -ne 1 -or $duplicateDefinitionProbeMatches[0].Name -ne $requirementIds[0]) {
    Write-Error 'Duplicate requirement-definition negative probe failed.'
}
$missingMappingProbe = [System.Collections.Generic.HashSet[string]]::new($traceableIds)
if (-not $missingMappingProbe.Remove($requirementIds[0]) -or
    @($requirementIds | Where-Object { -not $missingMappingProbe.Contains($_) }).Count -ne 1) {
    Write-Error 'Missing requirement-mapping negative probe failed.'
}
Write-Output "REQUIREMENT_DEFINITIONS=$($requirementIds.Count)"
Write-Output "REQUIREMENT_DEFINITION_DUPLICATES=$($duplicateRequirementIds.Count)"
Write-Output "REQUIREMENT_TRACEABILITY_MISSING=$($missingTraceability.Count)"
Write-Output 'REQUIREMENT_VALIDATOR_REGRESSION_PROBES=PASS'
if (-not $implementationTracker.Contains('| 4B | [Gemini vision adapter]') -or
    -not $implementationTracker.Contains('optional whole-image fallback remains unselected/disabled') -or
    -not $implementationTracker.Contains('| 5A | [Metadata foundation]') -or
    -not $implementationTracker.Contains('| 5B/5C | Google Books primary adapter / [Unit 5C Lite multilingual variants]') -or
    -not $implementationTracker.Contains('5C-5/5C-6 merged and live')) {
    Write-Error 'Implementation routing must keep Unit 4B and its disabled fallback separate from Unit 5A/5B/5C.'
}
if ($implementationTracker -notmatch '(?m)^\| 0A \|.*\| `approved_complete` \|') { Write-Error 'Implementation tracker no longer preserves WU0A approved-complete evidence.' }
if ($implementationTracker -notmatch '(?m)^\| 0B \|.*\| `independently_approved` \|.*Risk-Based Phase 9 SDD analysis next;.*no Supabase query') { Write-Error 'Implementation tracker does not preserve WU0B approval and later-authority separation.' }
if (-not $implementationTracker.Contains('`definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`')) { Write-Error 'Implementation tracker omits the intermediate definition-approved authorization gate.' }
$wu0Index = $implementationTracker.IndexOf('| 0 |')
$wu0aIndex = $implementationTracker.IndexOf('| 0A |')
$wu0bIndex = $implementationTracker.IndexOf('| 0B |')
$unit1Index = $implementationTracker.IndexOf('| 1 |')
if ($wu0Index -lt 0 -or $wu0aIndex -le $wu0Index -or $wu0bIndex -le $wu0aIndex -or $unit1Index -le $wu0bIndex) { Write-Error 'Implementation tracker must route WU0 to WU0A to WU0B to Unit 1 in order.' }
$workUnitPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00-contracts-threat-migration-plan.md'))
if (-not $workUnitPlan.Contains('**Status:** `approved`') -or
    -not $workUnitPlan.Contains('**Authority:** approved Phase 9 planning baseline; planning only') -or
    -not $workUnitPlan.Contains('**Implementation:** not started') -or
    -not $workUnitPlan.Contains('**Migration-file creation/application:** not authorized')) {
    Write-Error 'Work Unit 0 approval or non-authority integrity markers are missing.'
}
$wu0bPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00b-backend-api-technical-design-plan.md'))
if (-not $wu0bPlan.Contains('**Definition status:** `definition_independently_approved`') -or
    -not $wu0bPlan.Contains('**Implementation status:** `independently_approved`') -or
    -not $wu0bPlan.Contains('**Definition review:** `approved` on 2026-07-20 after correction verification') -or
    -not $wu0bPlan.Contains('**Authority:** documentation-only technical design; no runtime or database authority') -or
    -not $wu0bPlan.Contains('**Runtime/migration/Supabase/provider/storage/UI authority:** none')) {
    Write-Error 'WU0B router status or non-authority boundary is missing.'
}
$artifactRelativePaths = @(
    '00b-technical-design/00-overview-authority-and-file-map.md', '00b-technical-design/01-command-query-and-dto-catalogue.md',
    '00b-technical-design/02-authorization-tenancy-and-privacy.md', '00b-technical-design/03-state-transactions-idempotency-and-publication.md',
    '00b-technical-design/04-jobs-providers-and-media-boundaries.md', '00b-technical-design/05-marketplace-and-request-photo-design.md',
    '00b-technical-design/06-red-tests-acceptance-and-handoff.md'
)
$artifactBodies = @{}
foreach ($relative in $artifactRelativePaths) {
    if (-not $wu0bPlan.Contains("./$relative")) {
        Write-Error "WU0B router does not link required artifact: $relative"
    }
    $artifactBodies[$relative] = [IO.File]::ReadAllText((Join-Path $phaseRoot "work-units/$relative"))
}
if (
    -not (
        $tracker.Contains('**Implementation status:** `unit6e_finalized_unit6f_separately_gated`') -or
        $tracker.Contains('**Implementation status:** `unit6f_browser_verified_native_gate_pending`') -or
        $tracker.Contains('**Implementation status:** `wu1_owner_inventory_read_boundary_locally_complete_unapplied`') -or
        $tracker.Contains('**Implementation status:** `wu1_owner_inventory_read_boundary_applied_runtime_deferred`') -or
        $tracker.Contains('**Implementation status:** `wu2_owner_inventory_client_locally_complete_runtime_deferred`') -or
        $tracker.Contains('**Implementation status:** `structural_metadata_integration_locally_complete_unapplied`') -or
        $tracker.Contains('**Implementation status:** `structural_metadata_review_corrections_complete_pending_rereview_unapplied`') -or
        $tracker.Contains('**Implementation status:** `final_targeted_corrections_complete_ready_for_approval_rereview_unapplied`') -or
        $tracker.Contains('**Implementation status:** `live_metadata_vertical_proof_blocked_before_provider_egress`') -or
        $tracker.Contains('**Implementation status:** `metadata_runtime_safety_complete_google_books_adapter_smoke_blocked_key_unavailable`') -or
        $tracker.Contains('**Implementation status:** `metadata_runtime_safety_and_google_books_adapter_smoke_complete`') -or
        $tracker.Contains('**Implementation status:** `m33_vision_reservation_correction_local_complete_awaiting_review_and_application`') -or
        $tracker.Contains('**Implementation status:** `compact_gemini_multilingual_language_hint_local_complete_unapplied`') -or
        $tracker.Contains('**Implementation status:** `compact_gemini_required_diagnostics_correction_complete_awaiting_rereview`') -or
        $tracker.Contains('**Implementation status:** `compact_gemini_provider_schema_rejected_blocked_before_m34`') -or
        $tracker.Contains('**Implementation status:** `flat_gemini_observation_contract_local_complete_provider_proof_permission_required`') -or
        $tracker.Contains('**Implementation status:** `schema_free_gemini_json_mode_provider_accepted_decoder_normalization_required`') -or
        $tracker.Contains('**Implementation status:** `schema_free_gemini_json_mode_decoder_normalization_local_complete_final_provider_proof_approval_required`') -or
        $tracker.Contains('**Implementation status:** `single_image_safe_remove_local_complete_m35_application_and_edge_rollout_gated`') -or
        $tracker.Contains('**Implementation status:** `single_image_safe_remove_m35_live_edge_v3_verified`') -or
        $tracker.Contains('**Implementation status:** `automatic_worker_wake_dispatcher_local_review_corrections_applied`') -or
        $tracker.Contains('**Implementation status:** `unit6_pre_main_integration_reconciliation_in_progress`') -or
        $tracker.Contains('**Implementation status:** `unit6_pre_main_candidate_corrections_verified_rereview_pending`') -or
        $tracker.Contains('**Implementation status:** `metadata_retry_correction_locally_complete_approved`') -or
        $tracker.Contains('**Implementation status:** `unit6_complete_live_verified`') -or
        $tracker.Contains('**Implementation status:** `unit6_mobile_upload_transport_correction_locally_verified`') -or
        $tracker.Contains('**Implementation status:** `unit6_mobile_upload_transport_native_failed_diagnosed`') -or
        $tracker.Contains('**Implementation status:** `unit6_mobile_filesystem_transport_locally_verified_live_pending`') -or
        $tracker.Contains('**Implementation status:** `unit6_multilingual_vision_response_resilience_locally_verified_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7a_locally_complete_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7a_m39_live_runtime_deployment_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`') -or
        $tracker.Contains('**Implementation status:** `unit7b_local_implementation_complete_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7b_review_remediation_implemented_local_gate_blocked`') -or
        $tracker.Contains('**Implementation status:** `unit7b_review_candidate_commit_authorized_luna_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7b_review_candidate_pushed_luna_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7b_corrected_review_candidate_ready_luna_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7b_edge_deployed_render_worker_authorization_required`') -or
        $tracker.Contains('**Implementation status:** `unit7b_live_rollout_blocked_generated_authors_projection`') -or
        $tracker.Contains('**Implementation status:** `unit7b_live_rollout_pass_ready_for_main_authorization`') -or
        $tracker.Contains('**Implementation status:** `unit7b_main_integrated_next_scope_authorization`') -or
        $tracker.Contains('**Implementation status:** `unit7c_wu5_store_view_cutover_locally_complete`') -or
        $tracker.Contains('**Implementation status:** `unit7c_wu5_committed_m43_m44_m45_applied_review_pending`') -or
        $tracker.Contains('**Implementation status:** `unit7c_m46_correction_pass_connected_save_reproof_complete`') -or
        $tracker.Contains('**Implementation status:** `unit7c_resumed_connected_canary_pass_main_integrated`') -or
        $tracker.Contains('**Implementation status:** `u8b_bounded_corrective_scope_locally_complete_operationally_pending`') -or
        $tracker.Contains('**Implementation status:** `unit8_repository_complete_closure_ready_operationally_pending`')
    ) -or
    ($tracker -notmatch '(?m)^\*\*Active work unit:\*\* `(unit7a_post_m39_feature_push_and_owner_edge_deployment|unit7a_create_only_commit_locally_complete_review_pending|unit7a_create_only_commit_red_tests_pending_separate_authorization|unit6f_awaiting_separate_authorization|unit6f_browser_verified_native_gate_pending|owner_inventory_read_boundary_wu1|owner_inventory_read_client_wu2|phase9_core_pipeline_vertical_integration_audit|phase9_structural_metadata_integration|phase9_structural_metadata_integration_correction_pass|phase9_structural_metadata_integration_correction_pass_complete|phase9_controlled_live_metadata_vertical_proof|phase9_metadata_worker_configuration_safe_invocation_and_supabase_target_guard|phase9_m33_vision_reservation_correction|phase9_compact_gemini_multilingual_language_hint_correction|phase9_multilingual_vision_response_resilience_review|unit6c_single_image_safe_remove|phase9_metadata_retry_provider_attempt_correction|unit6_complete|unit6_mobile_upload_transport_correction_local_complete|unit6_mobile_upload_transport_native_failure_diagnosed|unit6_mobile_filesystem_transport_live_proof_pending)`\r?$' -and
        -not $tracker.Contains('**Active work unit:** `unit7a_owner_edge_bundle_fix_narrow_review_pending`') -and
        -not $tracker.Contains('**Active work unit:** `unit7a_owner_edge_import_resolution_correction_requires_separate_authorization`') -and
        -not $tracker.Contains('**Active work unit:** `unit7b_independent_review`') -and
        -not $tracker.Contains('**Active work unit:** `unit7b_local_gate_remediation`') -and
        -not $tracker.Contains('**Active work unit:** `unit7b_review_candidate_publication`') -and
        -not $tracker.Contains('**Active work unit:** `unit7b_luna_xhigh_review`') -and
         -not $tracker.Contains('**Active work unit:** `unit7b_runtime_rollout`') -and
        -not $tracker.Contains('**Active work unit:** `unit7b_main_authorization_preparation`') -and
        -not $tracker.Contains('**Active work unit:** `phase9_post_unit7b_handoff`') -and
        -not $tracker.Contains('**Active work unit:** `unit7c_wu5_store_view_cutover`') -and
        -not $tracker.Contains('**Active work unit:** `unit8_marketplace_sdd_frozen`') -and
        -not $tracker.Contains('**Active work unit:** `unit8_u8b_independent_rereview_pending`') -and
        -not $tracker.Contains('**Active work unit:** `unit8_closure_ready`') -and
        -not $tracker.Contains('**Active work unit:** [`automatic_worker_wake_dispatcher`') -and
        -not $tracker.Contains('**Active work unit:** [`unit6_pre_main_integration_reconciliation`')) -or
    -not (
        $tracker.Contains('**Next authorized action:** obtain separate authorization before beginning Phase 9 Unit 6F') -or
        $tracker.Contains('**Next authorized action:** obtain representative low-end Android evidence') -or
        $tracker.Contains('**Next authorized action:** obtain separate approval to apply the WU1 migration draft') -or
        $tracker.Contains('**Next authorized action:** obtain independent review of the corrected WU1 draft') -or
        $tracker.Contains('**Next authorized action:** obtain an approved development Owner JWT') -or
        $tracker.Contains('**Next authorized action:** obtain an approved development Owner session') -or
        $tracker.Contains('**Next authorized action:** run a read-only vertical integration audit under existing Unit 4B/5A/5B authority') -or
        $tracker.Contains('**Next authorized action:** independent review and exact-project read-only preflight for M32 application; application remains separately gated') -or
        $tracker.Contains('**Next authorized action:** independent correction-only rereview of M32 and the complete structural integration diff') -or
        $tracker.Contains('**Next authorized action:** independent approval rereview of the frozen M32/structural integration diff') -or
        $tracker.Contains('**Next authorized action:** configure the exact target-project service credential and Google Books credential through the approved secret mechanism, then rerun the same bounded one-candidate proof') -or
        $tracker.Contains('**Next authorized action:** make the already-authorized temporary Google Books key available to one process-scoped adapter-only smoke') -or
        $tracker.Contains('**Next authorized action:** obtain separate authorization for `CONTROLLED_ONE_CANDIDATE_METADATA_VERTICAL_PROOF`') -or
        $tracker.Contains('**Next authorized action:** independently review M33, then separately authorize exact-project application/readback') -or
        $tracker.Contains('**Next authorized action:** independently rereview the two M33 corrections and complete local diff, then separately authorize exact-project application/readback') -or
        $tracker.Contains('**Next authorized action:** independently review the exact compact Gemini/M34 correction before any provider-only proof, deployment, migration application, or preserved attempt-5 invocation') -or
        $tracker.Contains('**Next authorized action:** independently rereview the compact Gemini/M34 correction and privileged-diagnostics fix before any provider-only proof, deployment, migration application, or preserved attempt-5 invocation') -or
        $tracker.Contains('**Next authorized action:** make the smallest provider-schema compatibility correction limited to `multilingual_search_enrichment`, rerun the exact provider-only request, and proceed to M34/push/deployment/job execution only after HTTP 200 plus production decode') -or
        $tracker.Contains('**Next authorized action:** obtain explicit approval to send the sanitized `testimage.jpeg` bytes to Google Gemini for one provider-only request, then require HTTP 200 plus production decode before M34/push/deployment/job execution') -or
        $tracker.Contains('**Next authorized action:** obtain explicit approval for one additional sanitized-image Gemini retry to capture provider diagnostics, then require HTTP 200 plus production decode before M34/push/deployment/job execution') -or
        $tracker.Contains('**Next authorized action:** obtain explicit approval for one further sanitized-image Gemini probe only if needed to isolate the rejected schema component; require HTTP 200 plus production decode before M34/push/deployment/job execution') -or
        $tracker.Contains('**Next authorized action:** capture the bounded returned JSON on one explicitly approved sanitized-image retry, then make only the decoder normalization proven necessary and require production decode before M34/push/deployment/job execution') -or
        $tracker.Contains('**Next authorized action:** obtain explicit approval for one final sanitized-image Gemini request and require successful production decode before M34/push/deployment/job execution') -or
        $tracker.Contains('**Next authorized action:** review M35 and explicitly authorize its exact-project application; Edge deployment and any live removal remain separate approvals') -or
        $tracker.Contains('**Next authorized action:** refresh and observe the new post-removal input without mutation; any further image removal requires a new explicit target decision') -or
        $tracker.Contains('**Next authorized action:** review the local automatic-worker-wake implementation and explicitly authorize or reject a separate deployment/external-mutation unit') -or
        $tracker.Contains('**Next authorized action:** complete local verification and independent review, assemble a clean candidate from fresh `origin/main`, then push that exact verified candidate normally to `origin/main`') -or
        $tracker.Contains('**Next authorized action:** rerun the required gates on the isolated candidate, obtain independent final approval, verify fresh-main ancestry/content, then push that exact candidate normally to `origin/main`') -or
        $tracker.Contains('**Next authorized action:** obtain independent final approval of the corrected isolated candidate, verify fresh-main ancestry/content, then push that exact candidate normally to `origin/main`') -or
        $tracker.Contains('**Next authorized action:** obtain independent final approval of the corrected isolated candidate, verify fresh-main ancestry/content, report publish readiness, and wait for a new explicit user instruction before any push') -or
        $tracker.Contains('**Next authorized action:** publish the approved bounded correction branch; operational M38 application and metadata-only redeployment require a separate explicit session') -or
        $tracker.Contains('**Next authorized action:** open a separately authorized operational session if M38 application and metadata-only redeployment are desired; no operational action is authorized now') -or
        $tracker.Contains('**Next authorized action:** none in this session; Unit 7 remains not started and requires a new explicit authorization') -or
        $tracker.Contains('**Next authorized action:** none; a native-device signed-upload proof would create Storage/database state and requires separate explicit authorization, while Unit 7 remains not started') -or
        $tracker.Contains('**Next authorized action:** none; a further transport correction, Edge deployment, or additional live upload requires separate explicit authorization, while Unit 7 remains not started') -or
        $tracker.Contains('**Next authorized action:** perform exactly one fresh Android Owner upload through the normal UI and require signed Storage `2xx`, exactly one object, and successful input registration; stop on the first failure. Edge deployment and Unit 7 remain separately unauthorized.') -or
        $tracker.Contains('**Next authorized action:** bounded independent review of the multilingual vision-response resilience correction; deployment requires separate authorization, followed by exactly one fresh Android image proof after deployment. Unit 7 remains unauthorized.') -or
        $tracker.Contains('**Next authorized action:** separately authorize the Unit 7A load-bearing red-test implementation against the frozen create-only SDD.') -or
        $tracker.Contains('**Next authorized action:** review the complete local Unit 7A diff.') -or
        $tracker.Contains('**Next authorized action:** record and push the M39 checkpoint') -or
        $tracker.Contains('**Next authorized action:** none. Obtain separate authorization for a reviewed source-only correction') -or
        $tracker.Contains('**Next authorized action:** narrow independent review only of the four explicit-extension edits') -or
        $tracker.Contains('**Next authorized action:** obtain explicit authorization to provision or identify the approved `phase9-publication-worker` Render service') -or
        $tracker.Contains('**Next authorized action:** decide whether to authorize a forward-only correction for the confirmed Unit 7B generated-column projection defect') -or
        $tracker.Contains('**Next authorized action:** one focused independent review of the complete local Unit 7B diff.') -or
        $tracker.Contains('**Next authorized action:** rerun the outstanding real-PostgreSQL concurrency, Docker container, and Deno graph gates in a capable local environment') -or
        $tracker.Contains('**Next authorized action:** create and push one intentional Unit 7B-only review candidate for Luna xhigh review') -or
        $tracker.Contains('**Next authorized action:** Luna xhigh review of the committed and pushed Unit 7B candidate') -or
        $tracker.Contains('**Next authorized action:** obtain explicit authorization for the next Phase 9 scope') -or
        $tracker.Contains('**Next authorized action:** obtain separate authorization to commit the exact proven WU5 vertical; do not apply M43/M44/M45, mutate connected Supabase/Storage, deploy, push, or begin integrated Unit 7C review.') -or
        $tracker.Contains('**Next authorized action:** request separate authorization for U8B bookstore-first discovery backend work.') -or
        $tracker.Contains('**Next authorized action:** independent U8B re-review/closure, followed only by separately authorized migration-history reconciliation, dedicated Q08 Vault provisioning, and live Supabase verification. Do not apply M49 or begin U8C.') -or
        $tracker.Contains('**Next authorized action:** none in this bounded session; Unit 8 repository closure is ready. Any migration-history repair, Vault provisioning, live migration application, deployment, commit, or push requires separate authorization.')
    ) -or
    -not $tracker.Contains('M29 is live once as `20260730162700 marketplace_phase9_owner_safe_contracts`') -or
    -not $tracker.Contains('M30 is live exactly once as `20260801093048 marketplace_phase9_unit6e_review_corrections`') -or
    -not $tracker.Contains('20-unit6b-route-query-cache-evidence.md') -or
    -not $tracker.Contains('22-unit6d-candidate-review-evidence.md') -or
    -not $tracker.Contains('23-unit6e-review-corrections-evidence.md') -or
    -not $tracker.Contains('24-unit6f-readiness-quality-gates-evidence.md')
) {
    Write-Error 'TRACKER.md does not preserve the Unit 6E finalization and Unit 6F gate.'
}
$packageAudit = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/01-package1-live-audit.md'))
$packageDesign = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/01-package1-database-design.md'))
if (-not $packageDesign.Contains('temporary compatibility CHECKs accepting the union') -or
    -not $packageDesign.Contains('phase9_upload_capabilities') -or
    -not $packageDesign.Contains('no direct base-table SELECT or DML') -or
    -not $packageDesign.Contains('unique constraint `(store_id, job_id, cost_kind, policy_version)`') -or
    -not $packageDesign.Contains('Add `image_extraction_inputs.media_asset_id -> media_assets(id)`') -or
    -not $packageDesign.Contains('Separately reviewed gate, not one of the eight additive Phase 9 groups:')) {
    Write-Error 'Package 1 design is missing one or more required six-finding correction markers.'
}
if (-not $packageAudit.Contains('C02/C03, C15/C16 and C20/C21') -or
    -not $packageAudit.Contains('M09 preflight fails on any violating row') -or
    -not $packageAudit.Contains('cannot directly read or mutate private Phase 9 base tables')) {
    Write-Error 'Package 1 audit gap/test plan is missing required correction coverage.'
}
$migrationNames = @(
    '20260722000001_marketplace_phase9_catalogue_metadata_expand.sql',
    '20260722000002_marketplace_phase9_extraction_persistence.sql',
    '20260722000003_marketplace_phase9_media_registry.sql',
    '20260722000004_marketplace_phase9_condition_damage_transition.sql',
    '20260722000005_marketplace_phase9_controlled_inventory_commands.sql',
    '20260722000006_marketplace_phase9_storage_boundaries.sql',
    '20260722000007_marketplace_phase9_public_projection_search.sql',
    '20260722000008_marketplace_phase9_request_photo_seam.sql',
    '20260722000010_marketplace_phase9_public_boundary_security_correction.sql',
    '20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql',
    '20260726000012_marketplace_phase9_vision_analysis_runtime.sql',
    '20260727000013_marketplace_phase9_service_rpc_wrappers.sql',
    '20260727000014_marketplace_phase9_vision_provider_attempts.sql',
    '20260728000015_marketplace_phase9_metadata_foundation.sql',
    '20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql',
    '20260728000017_marketplace_phase9_maintain_acl_correction.sql',
    '20260729000018_marketplace_phase9_search_variant_proposals.sql',
    '20260729000019_marketplace_phase9_search_variant_replay_fence.sql',
    '20260729000020_marketplace_phase9_variant_runtime_search.sql',
    '20260729000021_marketplace_phase9_defer_active_variant_search.sql',
    '20260729000022_marketplace_phase9_active_variant_search.sql',
    '20260729000023_marketplace_phase9_active_variant_search_correction.sql',
    '20260729000024_marketplace_phase9_owner_variant_decisions.sql',
    '20260729000025_marketplace_phase9_owner_variant_corrections.sql',
    '20260729000026_marketplace_phase9_variant_benchmark_rollout.sql',
    '20260729000027_marketplace_phase9_exact_rollout_activation.sql',
    '20260729000028_marketplace_phase9_variant_benchmark_evidence_read.sql',
    '20260730000029_marketplace_phase9_owner_safe_contracts.sql',
    '20260801000030_marketplace_phase9_unit6e_review_corrections.sql'
)
foreach ($name in $migrationNames) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "supabase/migrations/$name"))) { Write-Error "Missing approved Phase 9 migration: $name" }
}
$draftMigrationNames = @(
    '20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql',
    '20260807000032_marketplace_phase9_structural_metadata_integration.sql',
    '20260809000033_marketplace_phase9_vision_reservation_correction.sql',
    '20260809000034_marketplace_phase9_vision_language_hint_correction.sql',
    '20260810000035_marketplace_phase9_single_image_removal.sql',
    '20260810000036_marketplace_phase9_worker_wake_dispatcher.sql',
    '20260810000037_marketplace_phase9_owner_discovery_scope_correction.sql',
    '20260810000038_marketplace_phase9_metadata_retry_correction.sql',
    '20260812000039_marketplace_phase9_create_only_inventory_commit.sql',
    '20260812000040_marketplace_phase9_safe_publication.sql',
    '20260813000041_marketplace_phase9_unit7a_quality_handoff.sql',
    '20260814000042_marketplace_phase9_generated_authors_projection.sql',
    '20260814000043_marketplace_phase9_unit7c_inventory_management.sql',
    '20260814000044_marketplace_phase9_store_view_filter_contract.sql',
    '20260815000045_marketplace_phase9_unit7c_media_history.sql',
    '20260816000046_marketplace_phase9_unit7c_private_save_revision_correction.sql',
    '20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql',
    '20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql',
    '20260818000049_marketplace_phase9_bookstore_first_discovery.sql',
    '20260820000050_marketplace_phase9_storefront_detail.sql',
    '20260821000051_marketplace_phase9_public_media_order_invariant.sql'
)
$phase9Migrations = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'supabase/migrations') -Filter '*marketplace_phase9*.sql')
$wu1AppliedStatus = ($tracker.Contains('**Implementation status:** `wu1_owner_inventory_read_boundary_applied_runtime_deferred`') -or
    $tracker.Contains('**Implementation status:** `wu2_owner_inventory_client_locally_complete_runtime_deferred`') -or
    $tracker.Contains('**Implementation status:** `structural_metadata_integration_locally_complete_unapplied`') -or
    $tracker.Contains('**Implementation status:** `live_metadata_vertical_proof_blocked_before_provider_egress`') -or
    $tracker.Contains('**Implementation status:** `m33_vision_reservation_correction_local_complete_awaiting_review_and_application`') -or
    $tracker.Contains('**Implementation status:** `compact_gemini_multilingual_language_hint_local_complete_unapplied`') -or
    $tracker.Contains('**Implementation status:** `compact_gemini_required_diagnostics_correction_complete_awaiting_rereview`') -or
    $tracker.Contains('**Implementation status:** `single_image_safe_remove_local_complete_m35_application_and_edge_rollout_gated`') -or
    $tracker.Contains('**Implementation status:** `single_image_safe_remove_m35_live_edge_v3_verified`') -or
    $tracker.Contains('**Implementation status:** `automatic_worker_wake_dispatcher_local_review_corrections_applied`') -or
    $tracker.Contains('**Implementation status:** `metadata_retry_correction_locally_complete_approved`') -or
    $tracker.Contains('**Implementation status:** `unit6_complete_live_verified`') -or
    $tracker.Contains('**Implementation status:** `unit6_mobile_upload_transport_correction_locally_verified`') -or
    $tracker.Contains('**Implementation status:** `unit6_mobile_upload_transport_native_failed_diagnosed`') -or
    $tracker.Contains('**Implementation status:** `unit6_mobile_filesystem_transport_locally_verified_live_pending`') -or
    $tracker.Contains('**Implementation status:** `unit6_multilingual_vision_response_resilience_locally_verified_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7a_locally_complete_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7a_m39_live_runtime_deployment_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`') -or
    $tracker.Contains('**Implementation status:** `unit7b_local_implementation_complete_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7b_review_remediation_implemented_local_gate_blocked`') -or
    $tracker.Contains('**Implementation status:** `unit7b_review_candidate_commit_authorized_luna_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7b_review_candidate_pushed_luna_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7b_corrected_review_candidate_ready_luna_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit7b_edge_deployed_render_worker_authorization_required`') -or
    $tracker.Contains('**Implementation status:** `unit7b_live_rollout_pass_ready_for_main_authorization`') -or
    $tracker.Contains('**Implementation status:** `unit7b_main_integrated_next_scope_authorization`') -or
    $tracker.Contains('**Implementation status:** `unit7c_wu1_locally_complete`') -or
    $tracker.Contains('**Implementation status:** `unit7c_wu2a_filter_contract_locally_complete`') -or
    $tracker.Contains('**Implementation status:** `unit7c_wu5_store_view_cutover_locally_complete`') -or
    $tracker.Contains('**Implementation status:** `unit7c_m46_correction_pass_connected_save_reproof_complete`'))
$expectedMigrationNames = @($migrationNames)
if ($wu1AppliedStatus) { $expectedMigrationNames += $draftMigrationNames }
$appliedPhase9Migrations = if ($wu1AppliedStatus) {
    @($phase9Migrations)
} else {
    @($phase9Migrations | Where-Object { $draftMigrationNames -notcontains $_.Name })
}
$actualMigrationNames = @($appliedPhase9Migrations.Name | Sort-Object)
$duplicateMigrationVersions = @($phase9Migrations | Group-Object { [int]$_.Name.Substring(8,6) } | Where-Object Count -gt 1)
$unexpectedCorrectionMigrations = @($phase9Migrations | Where-Object {
    [int]$_.Name.Substring(8,6) -ge 31 -and $draftMigrationNames -notcontains $_.Name
})
foreach ($draftName in $draftMigrationNames) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "supabase/migrations/$draftName"))) {
        Write-Error "Missing authorized Phase 9 migration artifact: $draftName"
    }
}
$wu1Addendum = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/owner-inventory-read-boundary-wu1-sdd.md'))
$wu1Evidence = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/25-owner-inventory-read-boundary-wu1-evidence.md'))
$wu1Sql = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql'))
if (-not $wu1Addendum.Contains('ordering horizon') -or
    $wu1Addendum -notmatch 'not a repeatable database\s+snapshot' -or
    -not $wu1Addendum.Contains('does not modify those write paths') -or
    -not $wu1Evidence.Contains('No live migration') -or
    -not $wu1Sql.Contains('p_page_size IS NULL') -or
    -not $wu1Sql.Contains('EXCEPTION WHEN others THEN') -or
    -not $wu1Sql.Contains('P9_INTERNAL_ERROR')) {
    Write-Error 'WU1 artifact or boundary invariants are incomplete.'
}
if ($wu1AppliedStatus -and -not $wu1Evidence.Contains('WU1_LIVE_APPLICATION=TRUE')) {
    Write-Error 'Applied WU1 status is missing the live application receipt.'
}
$wu2Addendum = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/owner-inventory-read-client-wu2-sdd.md'))
$wu2Evidence = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/26-owner-inventory-read-client-wu2-evidence.md'))
if (-not $wu2Addendum.Contains('phase9_owner_inventory_page_v1') -or
    -not $wu2Addendum.Contains('No client `store_id` is accepted or sent') -or
    -not $wu2Evidence.Contains('39 suites / 303 tests') -or
    -not $wu2Evidence.Contains('migration, database/storage mutation')) {
    Write-Error 'WU2 artifact or read-only boundary evidence is incomplete.'
}
$expectedMigrationCount = $expectedMigrationNames.Count
if ($actualMigrationNames.Count -ne $expectedMigrationCount -or
    (Compare-Object $expectedMigrationNames $actualMigrationNames) -or
    $duplicateMigrationVersions.Count -ne 0 -or
    $unexpectedCorrectionMigrations.Count -ne 0 -or
    $phase9Migrations.Name -match '000009|quantity.*validat') {
    Write-Error 'Phase 9 migration set must contain M01-M08 plus normalized M10-M50 exactly once; WU1/M32-M50 are included only when the tracker records the current structural handoff.'
}
$wu2aSql = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260814000044_marketplace_phase9_store_view_filter_contract.sql'))
$wu2aIntegrationPath = Join-Path $repoRoot 'supabase/tests/phase9/phase9Unit7cStoreViewFilterContract.integration.test.mjs'
$wu2aRealPath = Join-Path $repoRoot 'supabase/tests/phase9/phase9_unit7c_store_view_filter_vertical.sql'
if (-not $wu2aSql.Contains('phase9_store_view_page_v2') -or
    -not $wu2aSql.Contains('phase9_store_view_item_v1(i,false)') -or
    -not $wu2aSql.Contains('filtered AS MATERIALIZED') -or
    -not $wu2aSql.Contains("v_parts[2]<>v_filter") -or
    -not $wu2aSql.Contains('v_parts[3]<>auth.uid()::text') -or
    -not $wu2aSql.Contains('v_parts[4]<>v_store::text') -or
    -not (Test-Path -LiteralPath $wu2aIntegrationPath) -or
    -not (Test-Path -LiteralPath $wu2aRealPath)) {
    Write-Error 'Unit 7C WU2A filtered-pagination artifacts or invariants are incomplete.'
}
$m24 = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260729000024_marketplace_phase9_owner_variant_decisions.sql'))
$m25 = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260729000025_marketplace_phase9_owner_variant_corrections.sql'))
$m26 = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260729000026_marketplace_phase9_variant_benchmark_rollout.sql'))
$m27 = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260729000027_marketplace_phase9_exact_rollout_activation.sql'))
$m28 = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260729000028_marketplace_phase9_variant_benchmark_evidence_read.sql'))
$m30 = [IO.File]::ReadAllText((Join-Path $repoRoot 'supabase/migrations/20260801000030_marketplace_phase9_unit6e_review_corrections.sql'))
if (-not $m24.Contains('phase9_owner_decide_search_variant') -or -not $m24.Contains('phase9_is_store_owner') -or
    -not $m25.Contains('phase9_owner_replace_search_variant') -or
    -not $m26.Contains('phase9_trusted_benchmark_result') -or -not $m26.Contains('phase9_review_search_variant_benchmark') -or
    -not $m27.Contains('phase9_set_search_variant_language_rollout') -or -not $m27.Contains('phase9_search_variant_automatic_activation_allowed')) {
    Write-Error 'Phase 9 M24-M27 responsibility or dependency markers are incomplete.'
}
if (-not $m28.Contains('phase9_platform_search_variant_benchmark_summary') -or
    -not $m28.Contains('phase9_platform_search_variant_benchmark_evidence') -or
    -not $m28.Contains("SECURITY DEFINER SET search_path=''") -or
    $m28 -match '(?im)^\s*(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+TRIGGER)\b' -or
    $m28.Contains('phase9_review_search_variant_benchmark') -or
    $m28.Contains('phase9_set_search_variant_language_rollout')) {
    Write-Error 'Phase 9 M28 must remain limited to platform benchmark summary and paginated evidence reads, required indexes, authorization, fixed search_path, and ACLs.'
}
if (-not $m30.Contains('phase9_confirmed_variant_source') -or
    -not $m30.Contains('phase9_owner_search_variant_review') -or
    -not $m30.Contains('phase9_owner_candidate_detail_v2') -or
    -not $m30.Contains("SECURITY DEFINER SET search_path=''") -or
    $m30 -match '(?im)^\s*(?:GRANT|REVOKE|ALTER\s+FUNCTION|INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+TRIGGER)\b') {
    Write-Error 'Phase 9 M30 must remain an additive Unit 6E function-compatibility correction with preserved ACLs and no data, table, or trigger mutation.'
}
$wu1TestHarnesses = @(
    'supabase/migrations/__tests__/marketplacePhase9OwnerInventoryReadBoundary.test.ts',
    'supabase/tests/phase9/phase9OwnerInventoryReadBoundary.integration.test.mjs'
)
foreach ($relative in $wu1TestHarnesses) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relative))) {
        Write-Error "Missing WU1 test harness file: $relative"
    }
}
$wu1BoundaryMarkers = @(
    'WU1_NO_LIVE_APPLICATION=TRUE',
    'WU1_NO_CLIENT_UI_SERVICE_OR_STALE_CODE_CHANGE=TRUE',
    'WU1_NO_WRITE_PATH_OR_DASHBOARD_CHANGE=TRUE',
    'WU1_REMOTE_JWT_RLS_RUNTIME=DEFERRED_UNTIL_AFTER_APPLICATION'
)
foreach ($marker in $wu1BoundaryMarkers) {
    if (-not $wu1Evidence.Contains($marker)) {
        Write-Error "WU1 evidence is missing required boundary marker: $marker"
    }
}
if ($wu1Sql -match '(?i)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.phase9_owner_inventory\s*\(' -or
    $wu1Sql -match '(?i)ALTER\s+FUNCTION\s+public\.phase9_owner_inventory\s*\(' -or
    $wu1Sql -match '(?i)^\s*CREATE\s+POLICY\b' -or
    $wu1Sql -match '(?i)GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE).*store_inventory') {
    Write-Error 'WU1 draft crosses the stable-detail, RLS/policy, or direct-table-grant boundary.'
}
foreach ($relative in @('supabase/tests/phase9/phase6_baseline.sql','supabase/tests/phase9/databaseHarness.mjs',
    'supabase/tests/phase9/phase9Database.integration.test.mjs','supabase/tests/phase9/phase9IngestionRuntime.integration.test.mjs','supabase/tests/phase9/phase9VisionRuntime.integration.test.mjs','supabase/migrations/__tests__/marketplacePhase9DatabaseFoundation.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9PublicBoundarySecurityCorrection.test.ts','supabase/migrations/__tests__/marketplacePhase9VisionAnalysisRuntime.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9ServiceRpcWrappers.test.ts',
    'supabase/tests/phase9/phase9VisionProviderAttempts.integration.test.mjs',
    'supabase/tests/phase9/phase9MetadataFoundation.integration.test.mjs',
    'supabase/migrations/__tests__/marketplacePhase9MetadataFoundation.test.ts',
    'supabase/tests/phase9/phase9SensitiveTableAclCorrection.integration.test.mjs',
    'supabase/migrations/__tests__/marketplacePhase9SensitiveTableAclCorrection.test.ts',
    'supabase/tests/phase9/phase9MaintainAclCorrection.integration.test.mjs',
    'supabase/migrations/__tests__/marketplacePhase9MaintainAclCorrection.test.ts',
    'supabase/tests/phase9/phase9SearchVariantPersistence.integration.test.mjs',
    'supabase/migrations/__tests__/marketplacePhase9SearchVariantPersistence.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9SearchVariantReplayFence.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9VariantRuntimeSearch.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9ActiveVariantSearch.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9ActiveVariantSearchCorrection.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9LegacyRpcSecurityRemediation.test.ts',
    'supabase/migrations/__tests__/marketplacePhase9LegacyRpcServiceRoleCompatibility.test.ts',
    'supabase/tests/phase9/phase9BookstoreFirstDiscovery.integration.test.mjs',
    'supabase/tests/phase9/phase9BookstoreFirstDiscoveryTestHelpers.mjs',
    'supabase/tests/phase9/phase9_bookstore_first_postgres.sql',
    'supabase/tests/phase9/phase9_bookstore_first_postgres_bootstrap.sql',
    'supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1')) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relative))) { Write-Error "Missing Phase 9 migration test harness file: $relative" }
}
$packageJson = [IO.File]::ReadAllText((Join-Path $repoRoot 'package.json'))
if (-not $packageJson.Contains('"test:phase9:db"') -or -not $packageJson.Contains('"test:phase9:u8b:postgres"')) { Write-Error 'package.json does not expose the isolated Phase 9 database suites.' }
if ($tracker -match '(?i)\b(?:Supabase audit|migration-file creation|live migration application|product/runtime implementation) (?:is|are) authorized\b') {
    Write-Error 'TRACKER.md incorrectly represents a later authorization.'
}
$nextActionCount = [regex]::Matches($tracker, '(?m)^\*\*Next authorized action:\*\*').Count
if ($nextActionCount -ne 1) { Write-Error "TRACKER.md must contain exactly one current next-action marker; found $nextActionCount." }
$catalogue = $artifactBodies['00b-technical-design/01-command-query-and-dto-catalogue.md']
$commandIds = @([regex]::Matches($catalogue, '\bC(?:0[1-9]|[12][0-9]|30)\b') | ForEach-Object Value | Sort-Object -Unique)
$queryIds = @([regex]::Matches($catalogue, '\bQ(?:0[1-9]|1[01])\b') | ForEach-Object Value | Sort-Object -Unique)
if ($commandIds.Count -ne 30 -or $queryIds.Count -ne 11) { Write-Error "WU0B catalogue coverage mismatch: commands=$($commandIds.Count), queries=$($queryIds.Count)." }
$requiredCategoryChecks = @{
    '00b-technical-design/00-overview-authority-and-file-map.md' = @('## 4. Internal component boundary map', '## 5. Exact proposed later implementation file allowlist', 'DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN')
    '00b-technical-design/01-command-query-and-dto-catalogue.md' = @('## 2. Command catalogue', '## 3. Query catalogue', '## 4. Per-operation boundary and traceability', '## 5. Requirement-to-operation traceability', '## 6. DTO projection inventory', '## 7. Stable error-to-HTTP catalogue', '## 8. Rate and abuse classes')
    '00b-technical-design/02-authorization-tenancy-and-privacy.md' = @('## 2. Actor and tenancy matrix', '## 4. Grant design target', '## 6. Event and telemetry positive allowlist', '## 7. Forbidden-field matrix')
    '00b-technical-design/03-state-transactions-idempotency-and-publication.md' = @('## 1. Authoritative persisted-state mapping', '## 2. Authoritative transition matrix', '## 3. Transaction boundaries', '## 4. Optimistic concurrency and idempotency', 'committed_publication_failed')
    '00b-technical-design/04-jobs-providers-and-media-boundaries.md' = @('## 1. Persistent job contract', 'FOR UPDATE SKIP LOCKED', '## 4. Adapter interfaces', '## 5. Media validation and capability boundaries')
    '00b-technical-design/05-marketplace-and-request-photo-design.md' = @('Q07 is a service-internal matching stage', 'Q08 consumes', '## 5. Request-photo aggregate', '## 9. Explicit Phase 7/8 exclusions')
    '00b-technical-design/06-red-tests-acceptance-and-handoff.md' = @('## 1. Red-test mapping', 'independently_approved', 'DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN', 'Perform the consolidated Risk-Based Phase 9 SDD analysis in a new session.')
}
$photoDesign = $artifactBodies['00b-technical-design/05-marketplace-and-request-photo-design.md']
$ownerConfirmationIndex = $photoDesign.IndexOf('C28 Owner confirms item; C30 creates/refreshes soft hold')
$customerAcceptanceIndex = $photoDesign.IndexOf('C17 accept or C18 decline')
if ($ownerConfirmationIndex -lt 0 -or $customerAcceptanceIndex -le $ownerConfirmationIndex -or
    -not $photoDesign.Contains('active unexpired matching soft hold') -or
    -not $photoDesign.Contains('Customer acceptance before Owner confirmation')) {
    Write-Error 'WU0B request-photo flow does not enforce Owner confirmation and an active soft hold before customer acceptance.'
}
$stateDesign = $artifactBodies['00b-technical-design/03-state-transactions-idempotency-and-publication.md']
$requiredPersistedStateMarkers = @(
    '| Session | `active`, `closing`, `closed`, `expired` |',
    '| Image input | `uploaded`, `validating`, `queued`, `processing`, `ready`, `failed`, `skipped` |',
    '| Candidate | `processing`, `ready`, `needs_review`, `possible_duplicate`, `failed`, `commit_in_progress`, `committed` |',
    '| Request photo | Owning Photo SDD values: `none`, `requested`, `uploading`, `provided`, `accepted`, `declined`, `unfulfilled`, `expired` |'
)
foreach ($marker in $requiredPersistedStateMarkers) {
    if (-not $stateDesign.Contains($marker)) {
        Write-Error "WU0B persisted-state mapping conflicts with or omits the Master/owning SDD marker: $marker"
    }
}
$semanticStateErrors = @(Get-Wu0bSemanticStateErrors -Bodies $artifactBodies)
if ($semanticStateErrors.Count -gt 0) { Write-Error "WU0B contains contradictory or unknown persisted-state claims: $($semanticStateErrors -join ', ')" }
$requiredHoldMarker = '| Holds | Phase 6 `hold_type=''soft''|''firm''`; persisted status is `active`, `released`, or `converted_to_sale` |'
if (-not $stateDesign.Contains($requiredHoldMarker)) { Write-Error 'WU0B hold mapping omits the exact Phase 6 persisted statuses.' }
if ($RunSemanticNegativeProbes) {
    $probeDomains = @(
        @{ D='session'; A='active'; X='archived'; E='UNKNOWN_SESSION_STATE' }, @{ D='input'; A='ready'; X='discarded'; E='UNKNOWN_IMAGE_INPUT_STATE' },
        @{ D='candidate'; A='ready'; X='archived'; E='UNKNOWN_CANDIDATE_STATE' }, @{ D='request-photo'; A='provided'; X='abandoned'; E='UNKNOWN_REQUEST_PHOTO_STATE' },
        @{ D='hold'; A='active'; X='expired'; E='UNKNOWN_HOLD_STATE' }
    )
    $probeForms = @('{D} persisted as {X}', '{D} persisted-as {X}', '{D} is-persisted-as {X}', '{D} becomes {X}', '{D} advances to {X}', '{D} advances into {X}', '{D} transitions to {X}', '{D} from {A} to {X}', '{D} from {A} into {X}', '{D} state: {A} -> {X}', '{D} (`{A}`) -> `{X}`', '{D} terminal is {X}', '{D} state is {X}', '{D} status is {X}', '{D} workflow is {X}', '{D} lifecycle is {X}', "{D}'s persisted state is {X}", '{D} from {A} -> {X}', '{D} from ({A}) -> ({X})', '{D} state = {X}', '{D} state: {X}')
    $probeCount = 0; $probeRelative = '00b-technical-design/03-state-transactions-idempotency-and-publication.md'
    foreach ($domain in $probeDomains) { foreach ($form in $probeForms) {
        $probeText = $form.Replace('{D}', $domain.D).Replace('{A}', $domain.A).Replace('{X}', $domain.X); $probeErrors = @(Get-Wu0bSemanticStateErrors -Bodies @{ $probeRelative = $probeText })
        if (($probeErrors -join '|') -notmatch $domain.E) { Write-Error "WU0B semantic matrix probe failed: $probeText" }; $probeCount++
    } }
    foreach ($special in @(@{ T='Request-photo status becomes unrequested'; E='PHOTO_UNKNOWN_STATE|UNKNOWN_REQUEST_PHOTO_STATE' }, @{ T='Candidate terminal status becomes skipped_false_detection'; E='CANDIDATE_DISPOSITION_AS_STATE|UNKNOWN_CANDIDATE_STATE' })) {
        if ((@(Get-Wu0bSemanticStateErrors -Bodies @{ $probeRelative = $special.T }) -join '|') -notmatch $special.E) { Write-Error "WU0B semantic special probe failed: $($special.T)" }; $probeCount++
    }
    Write-Output "SEMANTIC_NEGATIVE_MATRIX=PASS cases=$probeCount"
}
$boundaryStart = $catalogue.IndexOf('## 4. Per-operation boundary and traceability')
$boundaryEnd = $catalogue.IndexOf('## 5. Requirement-to-operation traceability')
if ($boundaryStart -lt 0 -or $boundaryEnd -le $boundaryStart) { Write-Error 'WU0B per-operation boundary section is missing.' }
$boundarySection = $catalogue.Substring($boundaryStart, $boundaryEnd - $boundaryStart)
$boundaryCodes = 'OE|CE|AE|PE|IE|RPC|WH|MQ'
foreach ($id in @($commandIds + $queryIds)) {
    $escapedId = [regex]::Escape($id)
    $row = [regex]::Match($boundarySection, "(?m)^\| $escapedId .*\|\r?$").Value
    $primaryBoundaryCount = @([regex]::Matches($row, "\| (?:$boundaryCodes);")).Count
    if ([string]::IsNullOrWhiteSpace($row) -or $primaryBoundaryCount -ne 1 -or
        $row -notmatch '(MAS|DAT|EXT|REV|MED|MKT|PHO)-' -or
        $row -notmatch '; [VAEGMRP/]+;' -or $row -notmatch 'RT-[A-Z0-9-]+' -or $row -notmatch '; U(?:[1-9]|10|11)') {
        Write-Error "WU0B operation $id lacks a selected boundary, SDD/WU0A trace, red test, or future unit."
    }
}
$c12BoundaryRow = [regex]::Match($boundarySection, '(?m)^\| C12 .*\|\r?$').Value
$q11BoundaryRow = [regex]::Match($boundarySection, '(?m)^\| Q11 .*\|\r?$').Value
if ($c12BoundaryRow -notmatch '\| AE;' -or $c12BoundaryRow -notmatch 'Owner path:' -or
    $c12BoundaryRow -notmatch 'worker path:' -or $c12BoundaryRow -notmatch 'mixed/unknown denied' -or
    $c12BoundaryRow -notmatch 'image-inventory-publication-retry/index\.ts' -or $c12BoundaryRow -notmatch 'one shared publication-retry service') {
    Write-Error 'WU0B C12 does not define one shared boundary with closed Owner and claimed-worker authorization paths.'
}
if ($q11BoundaryRow -notmatch '\| AE;' -or $q11BoundaryRow -notmatch 'Customer path:' -or
    $q11BoundaryRow -notmatch 'Owner path:' -or $q11BoundaryRow -notmatch 'mixed/unknown denied') {
    Write-Error 'WU0B Q11 does not define one shared boundary with separate customer and Owner authorization/projection paths.'
}
$overviewDesign = $artifactBodies['00b-technical-design/00-overview-authority-and-file-map.md']
if ($overviewDesign -notmatch 'C12 shared publication-retry boundary.*image-inventory-publication-retry/index\.ts' -or
    $overviewDesign -notmatch 'Owner and worker boundaries do not implement C12') {
    Write-Error 'WU0B exact future-file map does not assign C12 to one dedicated shared boundary.'
}
if ($RunSemanticNegativeProbes) {
    if ($c12BoundaryRow.Replace('image-inventory-publication-retry/index.ts', 'image-inventory-owner/index.ts') -match 'image-inventory-publication-retry/index\.ts') { Write-Error 'C12 boundary-owner negative probe failed.' }
    if ($overviewDesign.Replace('Owner and worker boundaries do not implement C12', 'Owner and worker boundaries may implement C12') -match 'Owner and worker boundaries do not implement C12') { Write-Error 'C12 duplicate-owner negative probe failed.' }
    Write-Output 'BOUNDARY_NEGATIVE_PROBE_C12_EXACT_OWNER=PASS'; Write-Output 'BOUNDARY_NEGATIVE_PROBE_C12_NO_DUPLICATION=PASS'
}
$redDesign = $artifactBodies['00b-technical-design/06-red-tests-acceptance-and-handoff.md']
$redRows = @([regex]::Matches($redDesign, '(?m)^\| RT-[A-Z0-9-]+ \|.*\|\r?$') | ForEach-Object Value)
foreach ($row in $redRows) {
    if ($row -notmatch '(MAS|DAT|EXT|REV|MED|MKT|PHO)-|DOC-6 §' -or
        $row -notmatch '\| U(?:[1-9]|10|11)(?:/U(?:[1-9]|10|11))* \|\r?$') {
        Write-Error "WU0B red-test row lacks an owning SDD requirement or future implementation unit: $row"
    }
}
$referencedRedIds = @([regex]::Matches($boundarySection, 'RT-[A-Z0-9-]+') | ForEach-Object Value | Sort-Object -Unique)
$definedRedIds = @($redRows | ForEach-Object { [regex]::Match($_, 'RT-[A-Z0-9-]+').Value } | Sort-Object -Unique)
$missingRedOwners = @($referencedRedIds | Where-Object { $_ -notin $definedRedIds })
if ($missingRedOwners.Count -gt 0) { Write-Error "WU0B operation red tests lack detailed ownership rows: $($missingRedOwners -join ', ')." }
foreach ($relative in $requiredCategoryChecks.Keys) {
    if ($artifactBodies[$relative] -notmatch '(?m)^\*\*Status:\*\* `independently_approved`\r?$') { Write-Error "WU0B artifact $relative is not independently approved." }
    foreach ($marker in $requiredCategoryChecks[$relative]) {
        if (-not $artifactBodies[$relative].Contains($marker)) {
            Write-Error "WU0B artifact $relative is missing required category marker: $marker"
        }
    }
}
$allWu0bText = $wu0bPlan + "`n" + (($artifactBodies.Values) -join "`n")
if ($allWu0bText -match '(?im)^\*\*(?:Status|Implementation status):\*\* `implementation_complete_needs_review`\s*$' -or
    $allWu0bText -match '(?i)\b(?:Supabase audit|migration-file creation|live migration application|runtime implementation) (?:is|are) authorized\b' -or
    $allWu0bText -match '(?i)\bMigration(?:-file)? creation and (?:live )?(?:migration )?application (?:are|is)\s+(?:jointly |together )?authorized\b') {
    Write-Error 'WU0B artifacts contain a stale review status or later authority.'
}
$laterGates = @(
    '1. Independent WU0B technical-design review - complete 2026-07-22.', '2. Fresh exact-project read-only Supabase schema/security/storage audit.',
    '3. Exact database and migration design.', '4. Migration-file creation.', '5. Isolated migration testing.',
    '6. Live migration application after separate authorization and another exact-project readback.',
    '7. Fixture-backed runtime slices under separate runtime authorization.'
)
$previousGateIndex = -1
foreach ($gate in $laterGates) {
    $gateIndex = $wu0bPlan.IndexOf($gate)
    if ($gateIndex -le $previousGateIndex) {
        Write-Error "WU0B definition is missing or misorders later gate: $gate"
    }
    $previousGateIndex = $gateIndex
}
if (-not $wu0bPlan.Contains('Migration creation and live application can never share one authorization.')) { Write-Error 'WU0B definition does not keep migration creation and application separately gated.' }
$agents = [IO.File]::ReadAllText((Join-Path $repoRoot 'AGENTS.md'))
if (-not $agents.Contains('phase-9-image-inventory/SESSION-START.md')) { Write-Error 'Repository AGENTS.md does not point to the Phase 9 session entrypoint.' }
$sessionStart = [IO.File]::ReadAllText((Join-Path $phaseRoot 'SESSION-START.md'))
if (-not $sessionStart.Contains('## 6. Documentation update matrix') -or
    -not $sessionStart.Contains('## 8. Mandatory closeout transaction')) {
    Write-Error 'SESSION-START.md is missing its update matrix or closeout transaction.'
}
if (-not $sessionStart.Contains('| 0B Backend/API technical design or review (only if authorized)') -or
    -not $sessionStart.Contains('00b-backend-api-technical-design-plan.md') -or
    -not $sessionStart.Contains('all seven linked `00b-technical-design/` artifacts')) {
    Write-Error 'SESSION-START.md does not route the WU0B authority and artifact set.'
}
if (-not $sessionStart.Contains('06-owner-capture-review-recovery-ux-sdd.md') -or
    -not $sessionStart.Contains('18-unit6-owner-ux-design-evidence.md') -or
    -not $sessionStart.Contains('20-unit6b-route-query-cache-evidence.md') -or
    -not $sessionStart.Contains('22-unit6d-candidate-review-evidence.md') -or
    -not $sessionStart.Contains('23-unit6e-review-corrections-evidence.md') -or
    -not $sessionStart.Contains('Unit 6B is') -or
    -not $sessionStart.Contains('Unit 6D') -or
    -not $sessionStart.Contains('Unit 6E') -or
    -not ($sessionStart.Contains('Unit 6F only') -or $sessionStart.Contains('After that gate, return to the representative low-end Android Unit 6F evidence') -or $sessionStart.Contains('then resume the representative Unit 6F native evidence') -or $sessionStart.Contains('then return to the representative low-end Android Unit 6F') -or $sessionStart.Contains('representative low-end Android Unit 6F evidence')) -or
    -not $sessionStart.Contains('20260801093048 marketplace_phase9_unit6e_review_corrections')) {
    Write-Error 'SESSION-START.md does not preserve the Unit 6E finalization and Unit 6F gate.'
}
$phaseReadme = [IO.File]::ReadAllText((Join-Path $phaseRoot 'README.md'))
if (-not ($phaseReadme.Contains('**Status:** `unit6e_finalized_unit6f_separately_gated`') -or
    $phaseReadme.Contains('**Status:** `unit7a_create_only_design_frozen`') -or
    $phaseReadme.Contains('**Status:** `unit7a_create_only_locally_complete_review_pending`') -or
    $phaseReadme.Contains('**Status:** `unit6f_browser_verified_native_gate_pending`') -or
    $phaseReadme.Contains('**Status:** `wu1_owner_inventory_read_boundary_locally_complete_unapplied`') -or
    $phaseReadme.Contains('**Status:** `wu1_owner_inventory_read_boundary_applied_runtime_deferred`') -or
    $phaseReadme.Contains('**Status:** `wu2_owner_inventory_client_locally_complete_runtime_deferred`') -or
    $phaseReadme.Contains('**Status:** `structural_metadata_integration_locally_complete_unapplied`') -or
    $phaseReadme.Contains('**Status:** `live_metadata_vertical_proof_blocked_before_provider_egress`') -or
    $phaseReadme.Contains('**Status:** `metadata_runtime_safety_locally_complete_adapter_smoke_pending`') -or
    $phaseReadme.Contains('**Status:** `metadata_runtime_safety_and_adapter_smoke_complete`') -or
    $phaseReadme.Contains('**Status:** `automatic_worker_wake_dispatcher_local_review_corrections_applied`') -or
    $phaseReadme.Contains('**Status:** `unit6_pre_main_integration_reconciliation_in_progress`') -or
    $phaseReadme.Contains('**Status:** `unit6_complete_live_verified`') -or
    $phaseReadme.Contains('**Status:** `unit7b_live_rollout_pass_ready_for_main_authorization`') -or
    $phaseReadme.Contains('**Status:** `unit7b_main_integrated_next_scope_authorization`') -or
    $phaseReadme.Contains('**Status:** `unit7c_wu5_store_view_cutover_locally_complete`') -or
    $phaseReadme.Contains('**Status:** `unit7c_wu5_committed_m43_m44_m45_applied_review_pending`') -or
    $phaseReadme.Contains('**Status:** `unit7c_m46_correction_pass_connected_save_reproof_complete`') -or
    $phaseReadme.Contains('**Status:** `unit8_marketplace_sdd_frozen`') -or
    $phaseReadme.Contains('**Status:** `u8b_bounded_corrective_scope_locally_complete_operationally_pending`') -or
    $phaseReadme.Contains('**Status:** `unit8_repository_complete_closure_ready_operationally_pending`')) -or
    -not ($phaseReadme.Contains('M01-M08/M10-M29 are live once') -or $phaseReadme.Contains('M01-M08/M10-M30 are live once') -or $phaseReadme.Contains('M01-M08/M10-M38 and WU1 are live once') -or $phaseReadme.Contains('M01-M08/M10-M42 are live once') -or $phaseReadme.Contains('M01-M08/M10-M45 are live once') -or $phaseReadme.Contains('M01-M08/M10-M46 are live once') -or $phaseReadme.Contains('M01-M08/M10-M48 are live once')) -or
    -not $phaseReadme.Contains('Unit 6B is merged at `9ef9eb3`') -or
    -not $phaseReadme.Contains('Unit 6D is') -or
    -not $phaseReadme.Contains('22-unit6d-candidate-review-evidence.md') -or
    -not $phaseReadme.Contains('23-unit6e-review-corrections-evidence.md') -or
    -not $phaseReadme.Contains('24-unit6f-readiness-quality-gates-evidence.md') -or
    -not $phaseReadme.Contains('M30 was applied exactly once')) {
    Write-Error 'Phase 9 README disagrees with the Unit 6E finalization checkpoint.'
}
$pipeline = [IO.File]::ReadAllText((Join-Path $phaseRoot '02-extraction-enrichment-pipeline-sdd.md'))
if (-not $pipeline.Contains('M11 `20260726182238`, M12 `20260726182539`, and M13 `20260727025046` are live') -or
    -not $pipeline.Contains('All nine recorded fixture cases passed') -or
    $pipeline -match '(?i)no (?:runtime )?code, tests?, or migration(?: file)? (?:exists|yet)') {
    Write-Error 'Extraction pipeline SDD contains stale Unit 4 implementation status.'
}
$master = [IO.File]::ReadAllText((Join-Path $phaseRoot '00-phase-9-master-sdd.md'))
if (-not $master.Contains('Documentation and development-session continuity')) { Write-Error 'Master SDD is missing the continuity contract.' }

$markdownFiles = @(Get-ChildItem -LiteralPath $phaseRoot -Recurse -Filter '*.md')
$extraMarkdownPaths = @((Join-Path $repoRoot 'AGENTS.md'), (Join-Path $implementationRoot 'ACTIVE.md'),
    (Join-Path $implementationRoot 'README.md'), (Join-Path $marketplaceRoot 'README.md'),
    (Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
foreach ($path in $extraMarkdownPaths) {
    $markdownFiles += Get-Item -LiteralPath $path
}

$brokenLinks = @()
foreach ($file in $markdownFiles) {
    $body = [IO.File]::ReadAllText($file.FullName)
    foreach ($match in [regex]::Matches($body, '\]\(([^)]+)\)')) {
        $target = $match.Groups[1].Value.Trim()
        if ($target -match '^(https?://|mailto:|#)') {
            continue
        }
        $target = $target.Split('#')[0]
        if ([string]::IsNullOrWhiteSpace($target)) {
            continue
        }
        $target = [Uri]::UnescapeDataString($target.Trim('<', '>'))
        $resolved = [IO.Path]::GetFullPath((Join-Path $file.DirectoryName $target))
        if (-not (Test-Path -LiteralPath $resolved)) {
            $brokenLinks += "$($file.FullName) -> $($match.Groups[1].Value)"
        }
    }
}
if ($brokenLinks.Count -gt 0) { Write-Error ("Broken local links:`n" + ($brokenLinks -join "`n")) }

$lineCounts = @{}
foreach ($file in (Get-ChildItem -LiteralPath $phaseRoot -Recurse -Filter '*.md')) {
    $lineCounts[$file.FullName] = [IO.File]::ReadAllLines($file.FullName).Count
}
$sizeSignals = @(Get-DocumentSizeSignals -LineCounts $lineCounts)
foreach ($signal in $sizeSignals) {
    if ($signal.Level -eq 'split_advisory') {
        Write-Warning "DOCUMENT_SIZE_SPLIT_ADVISORY lines=$($signal.Lines) path=$($signal.Path)"
    } else {
        Write-Output "DOCUMENT_SIZE_COHESION_ASSESSMENT lines=$($signal.Lines) path=$($signal.Path)"
    }
}
$sizeRegression = @(Get-DocumentSizeSignals -LineCounts @{
    'cohesive-351.md' = 351
    'cohesive-400.md' = 400
    'cohesive-500.md' = 500
    'consider-split-501.md' = 501
})
if (@($sizeRegression | Where-Object Path -eq 'cohesive-351.md').Count -ne 0 -or
    @($sizeRegression | Where-Object { $_.Level -eq 'cohesion_assessment' }).Count -ne 2 -or
    @($sizeRegression | Where-Object { $_.Level -eq 'split_advisory' }).Count -ne 1) {
    Write-Error 'Documentation-size policy regression failed.'
}
Write-Output 'DOCUMENT_SIZE_POLICY_REGRESSION=PASS above_350_allowed=true advisory_above_500=true'

$wu1DiffPaths = @(
    'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/owner-inventory-read-boundary-wu1-sdd.md',
    'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md',
    'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/25-owner-inventory-read-boundary-wu1-evidence.md',
    'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1',
    'supabase/migrations/20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql',
    'supabase/migrations/__tests__/marketplacePhase9OwnerInventoryReadBoundary.test.ts',
    'supabase/tests/phase9/phase9OwnerInventoryReadBoundary.integration.test.mjs'
)
Push-Location $repoRoot
try {
    & git diff --check -- $wu1DiffPaths
    if ($LASTEXITCODE -ne 0) {
        throw 'WU1-scoped git diff --check failed.'
    }
    Write-Output 'WU1_DIFF_CHECK=PASS'

    $wu2DiffPaths = @(
        'src/features/imageInventory/api/ownerInventoryReadService.ts',
        'src/features/imageInventory/queries/ownerInventoryReadQueries.ts',
        'src/features/imageInventory/screens/OwnerInventoryReadScreen.tsx',
        'src/features/imageInventory/screens/InventoryFoundationScreens.tsx',
        'src/features/imageInventory/__tests__/ownerInventoryReadService.test.ts',
        'src/features/imageInventory/__tests__/ownerInventoryReadQueries.test.tsx',
        'src/features/imageInventory/__tests__/OwnerInventoryReadScreen.test.tsx',
        'src/features/imageInventory/__tests__/ownerInventoryReadArchitecture.test.ts',
        'src/features/stores/components/InventoryFilterPanel.tsx',
        'src/features/stores/components/InventoryItem.tsx',
        'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/owner-inventory-read-client-wu2-sdd.md',
        'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/26-owner-inventory-read-client-wu2-evidence.md'
    )
    & git diff --check -- $wu2DiffPaths
    if ($LASTEXITCODE -ne 0) {
        throw 'WU2-scoped git diff --check failed.'
    }
    Write-Output 'WU2_DIFF_CHECK=PASS'

    & git diff --check --
    if ($LASTEXITCODE -eq 0) {
        Write-Output 'REPOSITORY_DIFF_CHECK=PASS'
    } else {
        Write-Warning 'Repository-wide git diff --check failed outside the WU1-scoped verdict.'
        Write-Output 'REPOSITORY_DIFF_CHECK=FAIL'
    }
}
finally {
    Pop-Location
}

Write-Output "PHASE9_CONTINUITY_CHECK=PASS"
Write-Output "MARKDOWN_FILES_CHECKED=$($markdownFiles.Count)"
Write-Output "REQUIRED_PHASE_FILES=$($requiredPhaseFiles.Count)"
