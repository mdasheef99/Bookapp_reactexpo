# Picker SDD §§11–12 and SESSION-START §8: exact local migration continuity; no application.
param([string]$repoRoot, [string]$phaseRoot, [string]$tracker)

function Assert-Phase9MigrationSet {
    param([string[]]$ExpectedNames, [string[]]$ActualNames, [string[]]$AllNames, [string[]]$DraftNames)
    if (@($AllNames | Where-Object { $_ -notmatch '^[0-9]{14}_marketplace_phase9.*[.]sql$' }).Count -gt 0) {
        throw 'PHASE9_MIGRATION_SET_INVALID: malformed filename'
    }
    $duplicates = @($AllNames | Group-Object { [int]$_.Substring(8,6) } | Where-Object Count -gt 1)
    $unexpected = @($AllNames | Where-Object { [int]$_.Substring(8,6) -ge 31 -and $DraftNames -notcontains $_ })
    if ($ActualNames.Count -ne $ExpectedNames.Count -or
        (Compare-Object $ExpectedNames $ActualNames) -or $duplicates.Count -ne 0 -or
        $unexpected.Count -ne 0 -or $AllNames -match '000009|quantity.*validat') {
        throw 'PHASE9_MIGRATION_SET_INVALID: expected the exact approved baseline and authorized local forward files'
    }
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
    '20260821000051_marketplace_phase9_public_media_order_invariant.sql',
    '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql',
    '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql',
    '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql',
    '20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql',
    '20260830000056_marketplace_phase9_metadata_throughput.sql',
    '20260906000057_marketplace_phase9_media_output_intents.sql',
    '20260906000058_marketplace_phase9_media_completion_receipts.sql',
    '20260906000059_marketplace_phase9_media_output_cleanup.sql',
    '20260911000060_marketplace_phase9_duplicate_confirmation.sql',
    '20260913000061_marketplace_phase9_representative_edition_cover.sql',
    '20260913000062_marketplace_phase9_representative_cover_detail_projection.sql'
)
# Local creation authority persists in its recorded checkpoint; this does not authorize application.
if ($tracker.Contains('Current status: task2_locally_complete') -and
    $tracker.Contains('local M65') -and $tracker.Contains('NOT_APPLIED')) {
    $draftMigrationNames += @(
        '20261007000065_marketplace_phase9_edition_picker_state.sql',
        '20261007000066_marketplace_phase9_edition_picker_commands.sql',
        '20261007000067_marketplace_phase9_edition_picker_operation_fences.sql'
    )
}
# Task 4's explicit local-file authority covers one forward migration only.
if ($tracker.Contains('Current status: task4_locally_verified_pending_review') -and
    $tracker.Contains('one forward local migration') -and $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261007000068_marketplace_phase9_edition_picker_worker_completion.sql'
}
# Task 5 authorizes exactly one local forward artifact; application remains separate.
if ($tracker.Contains('Current status: task5_locally_verified_pending_review') -and
    $tracker.Contains('Task 5 local backend implementation') -and
    $tracker.Contains('one forward local migration') -and $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql'
}
# The Owner explicitly authorized only local M70 creation for the Task 6 confirmation correction.
if ($tracker.Contains('Current status: task6_locally_complete_pending_review') -and
    $tracker.Contains('Owner authorized local M70 creation') -and
    $tracker.Contains('20261008000070_marketplace_phase9_edition_picker_confirmation.sql') -and
    $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261008000070_marketplace_phase9_edition_picker_confirmation.sql'
}

# Owner's bounded eligibility correction authorizes exactly local M71, never application.
if ($tracker.Contains('Owner authorized local M71 creation') -and
    $tracker.Contains('20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql') -and
    $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql'
}

# Owner's queue correction authorizes exactly local M72; shared application stays separate.
if ($tracker.Contains('Owner authorized local M72 creation') -and
    $tracker.Contains('20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql') -and
    $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql'
}

# Owner's explicit fallback approval permits local M73 only; application stays separate.
if ($tracker.Contains('Owner authorized local M73 creation') -and
    $tracker.Contains('20261011000073_marketplace_phase9_open_library_edition_options.sql') -and
    $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261011000073_marketplace_phase9_open_library_edition_options.sql'
}

# Owner's author-isolation approval permits exactly local M74; shared application stays separate.
if ($tracker.Contains('Owner authorized local M74 creation') -and
    $tracker.Contains('20261012000074_marketplace_phase9_open_library_author_isolation.sql') -and
    $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261012000074_marketplace_phase9_open_library_author_isolation.sql'
}

# Owner's 2026-10-16 explicit-matching approval permits exactly M76; M75 stays deferred.
if ($tracker.Contains('Owner authorized local M76 creation') -and
    $tracker.Contains('20261016000076_marketplace_phase9_edition_explicit_matching.sql') -and
    $tracker.Contains('CREATED_LOCAL / NOT_APPLIED')) {
    $draftMigrationNames += '20261016000076_marketplace_phase9_edition_explicit_matching.sql'
}

# Owner's 2026-10-17 decision authorizes exactly M75 (exhausted-search recovery) and M77 (matching variants).
if ($tracker.Contains('Owner authorized M75 and M77 creation and application') -and
    $tracker.Contains('20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql') -and
    $tracker.Contains('20261017000077_marketplace_phase9_edition_matching_variants.sql')) {
    $draftMigrationNames += '20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql'
    $draftMigrationNames += '20261017000077_marketplace_phase9_edition_matching_variants.sql'
}

# Owner's 2026-10-22 slice 5a approval permits exactly M78 (owner ISBN edition lookup), local and unapplied.
if ($tracker.Contains('Owner authorized local M78 creation') -and
    $tracker.Contains('20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql') -and
    ($tracker.Contains('CREATED_LOCAL / NOT_APPLIED') -or $tracker.Contains('M78 applied'))) {
    $draftMigrationNames += '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql'
}
# Owner's 2026-10-23 instruction permits exactly M79 and M80 (card metadata state follow-ups), applied and verified.
if ($tracker.Contains('Owner authorized M79 and M80 creation and application') -and
    $tracker.Contains('20261023000079_marketplace_phase9_isbn_match_metadata_state.sql') -and
    $tracker.Contains('20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql')) {
    $draftMigrationNames += '20261023000079_marketplace_phase9_isbn_match_metadata_state.sql'
    $draftMigrationNames += '20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql'
}
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
    $tracker.Contains('**Implementation status:** `unit7c_m46_correction_pass_connected_save_reproof_complete`') -or
    $tracker.Contains('**Implementation status:** `unit6g_group1_contract_persistence_locally_complete`') -or
    $tracker.Contains('**Implementation status:** `unit6g_field_authority_correction_locally_verified_m53_unapplied`') -or
    $tracker.Contains('**Implementation status:** `unit6g_fa_001_live_verified_m53_applied`') -or
    $tracker.Contains('**Implementation status:** `unit6g_session_lifecycle_fence_live_verified_m54_applied`') -or
    $tracker.Contains('**Implementation status:** `unit6g_direct_add_closeout_connected_partial_pass_client_deploy_pending`') -or
    $tracker.Contains('**Implementation status:** `unit6g_metadata_throughput_local_complete_rollout_gated`') -or
    $tracker.Contains('**Implementation status:** `unit6g_media_completion_correction_integrated_review_pending`') -or
    $tracker.Contains('**Implementation status:** `unit6g_media_completion_correction_locally_verified_commit_authorization_pending`') -or
    $tracker.Contains('**Implementation status:** `unit6g_media_completion_correction_m57_m59_live_verified_runtime_deployment_pending`') -or
    $tracker.Contains('**Implementation status:** `unit6h_duplicate_confirmation_local_postgres_verified_connected_rollout_gated`') -or
    $tracker.Contains('**Implementation status:** `unit6h_representative_cover_m62_locally_verified_rollout_pending`'))
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
Assert-Phase9MigrationSet -ExpectedNames $expectedMigrationNames -ActualNames $actualMigrationNames `
    -AllNames @($phase9Migrations.Name) -DraftNames $draftMigrationNames
