param(
  [int]$Port = 5450,
  [string]$DataDir = '',
  [switch]$IncludeU8C,
  [switch]$IncludeUnit6gBaseline,
  [switch]$IncludeMediaCorrection,
  [switch]$IncludeDuplicateConfirmation,
  [switch]$IncludeEditionPicker,
  [switch]$IncludeOpenLibrary,
  [ValidateSet('', 'duplicate-confirmation', 'media-correction', 'edition-picker', 'open-library',
    'bookstore-first', 'storefront-detail', 'catalogue-link', 'lean-catalogue-identity',
    'edition-first-save', 'lean-catalogue-completion', 'lean-catalogue-local-hook', 'lean-catalogue-cache')]
  [string]$OnlyGroup = ''
)

$ErrorActionPreference = 'Stop'
if ($IncludeMediaCorrection) { $IncludeUnit6gBaseline = $true }
if ($IncludeDuplicateConfirmation) { $IncludeMediaCorrection = $true; $IncludeUnit6gBaseline = $true }
if ($IncludeOpenLibrary) { $IncludeEditionPicker = $true }
if ($IncludeEditionPicker) { $IncludeUnit6gBaseline = $true }
$env:PGCLIENTENCODING = 'UTF8'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$dbName = "bookconnect_u8b_$PID"
$defaultDataDir = Join-Path ([IO.Path]::GetTempPath()) "bookconnect-u8b-pg-$PID"
if ([string]::IsNullOrWhiteSpace($DataDir)) { $DataDir = $defaultDataDir }
$DataDir = [IO.Path]::GetFullPath($DataDir)
$serverLog = Join-Path $DataDir 'server.log'
$leanSetupFile = Join-Path $DataDir 'lean-catalogue-setup.sql'
$dataDirCreated = $false
$serverStarted = $false
$databaseCreated = $false
$catalogueDbName = "bookconnect_u8b_${PID}81"
$catalogueDatabaseCreated = $false
$completionDbName = "bookconnect_u8b_${PID}84"
$completionDatabaseCreated = $false
$cacheDbName = "bookconnect_u8b_${PID}87"
$cacheDatabaseCreated = $false
$exitCode = 1
$nativeGroups = [Collections.Generic.List[object]]::new()

$initdb = (Get-Command initdb -ErrorAction Stop).Source
$pgctl = (Get-Command pg_ctl -ErrorAction Stop).Source
$psql = (Get-Command psql -ErrorAction Stop).Source

$migrations = @(
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
  '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
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
  '20260818000049_marketplace_phase9_bookstore_first_discovery.sql'
)
if ($IncludeU8C -or $IncludeUnit6gBaseline) {
  $migrations += '20260820000050_marketplace_phase9_storefront_detail.sql'
  $migrations += '20260821000051_marketplace_phase9_public_media_order_invariant.sql'
}
if ($IncludeUnit6gBaseline) {
  $migrations += @(
    '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql',
    '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql',
    '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql',
    '20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql',
    '20260830000056_marketplace_phase9_metadata_throughput.sql'
  )
}
if ($IncludeMediaCorrection -or $IncludeEditionPicker) {
  $migrations += @(
    '20260906000057_marketplace_phase9_media_output_intents.sql',
    '20260906000058_marketplace_phase9_media_completion_receipts.sql',
    '20260906000059_marketplace_phase9_media_output_cleanup.sql'
  )
}
if ($IncludeDuplicateConfirmation -or $IncludeEditionPicker) {
  $migrations += '20260911000060_marketplace_phase9_duplicate_confirmation.sql'
}

# Picker SDD §§9-11: opt-in full prerequisites; M63/M64 belong to the separate Unit 6I checkout.
if ($IncludeEditionPicker) {
  $migrations += @(
    '20260913000061_marketplace_phase9_representative_edition_cover.sql',
    '20260913000062_marketplace_phase9_representative_cover_detail_projection.sql',
    '20261007000065_marketplace_phase9_edition_picker_state.sql',
    '20261007000066_marketplace_phase9_edition_picker_commands.sql',
    '20261007000067_marketplace_phase9_edition_picker_operation_fences.sql',
    '20261007000068_marketplace_phase9_edition_picker_worker_completion.sql',
    '20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql',
    '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
    '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
    '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
    '20261011000073_marketplace_phase9_open_library_edition_options.sql',
    '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
    '20261016000076_marketplace_phase9_edition_explicit_matching.sql',
    '20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql',
    '20261017000077_marketplace_phase9_edition_matching_variants.sql',
    '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql'
  )
}

function Invoke-PsqlFile([string]$database, [string]$file) {
  $argList = @('-h','127.0.0.1','-p',"$Port",'-U','postgres','-d',$database,
    '-X','-v','ON_ERROR_STOP=1','-f',$file)
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $psql @argList 2>&1
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($exit -ne 0) {
    throw "psql failed for $file (exit $exit)`n$($output -join [Environment]::NewLine)"
  }
  return $output
}

function Invoke-PsqlCommand([string]$database, [string]$sql) {
  $argList = @('-h','127.0.0.1','-p',"$Port",'-U','postgres','-d',$database,
    '-X','-v','ON_ERROR_STOP=1','-c',$sql)
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $psql @argList 2>&1
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($exit -ne 0) {
    throw "psql command failed (exit $exit): $sql`n$($output -join [Environment]::NewLine)"
  }
  return $output
}

# Owner B1 / 02b sections 11-12: one failed acceptance group must not hide later proofs.
function Invoke-NativeGroup([string]$name, [scriptblock]$action) {
  if ($OnlyGroup -and $name -ne $OnlyGroup) { return }
  $passed = $false
  try {
    & $action
    $passed = $true
  } catch {
    Write-Error $_ -ErrorAction Continue
  } finally {
    $nativeGroups.Add([pscustomobject]@{ Name = $name; Passed = $passed })
  }
}

try {
  if (Test-Path -LiteralPath $DataDir) {
    throw "Refusing to reuse existing disposable PostgreSQL data directory: $DataDir"
  }
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
  $dataDirCreated = $true
  $initdbArgs = @('-D',$DataDir,'-U','postgres','-A','trust','--no-sync','-E','UTF8','--locale=C')
  $initOutput = & $initdb @initdbArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "initdb failed`n$($initOutput -join [Environment]::NewLine)" }

  $startOutput = Join-Path $DataDir 'pgctl-start.log'
  $startError = Join-Path $DataDir 'pgctl-start-error.log'
  $startProcess = Start-Process -FilePath $pgctl -ArgumentList @(
    '-D',$DataDir,'-l',$serverLog,'-o',"`"-p $Port -c listen_addresses=127.0.0.1 -c autovacuum=off -c fsync=off -c full_page_writes=off`"",'start'
  ) -WindowStyle Hidden -RedirectStandardOutput $startOutput -RedirectStandardError $startError -PassThru
  Start-Sleep -Milliseconds 250
  $serverStarted = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    $checkExit = 1
    try {
      & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -X -Atc 'SELECT 1' *> $null
      $checkExit = $LASTEXITCODE
    } catch {
      $checkExit = 1
    }
    if ($checkExit -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'PostgreSQL did not become ready within 15 seconds' }

  Write-Output "U8B disposable PostgreSQL cluster ready on port $Port"
  $databaseReady = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    try {
      Invoke-PsqlCommand 'postgres' "CREATE DATABASE $dbName" | Out-Null
      $databaseReady = $true
      break
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $databaseReady) { throw "could not create disposable database $dbName while PostgreSQL was starting" }
  $databaseCreated = $true
  Write-Output "U8B disposable database $dbName created"
  Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\phase6_baseline.sql') | Out-Null
  Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\unit7b_postgres_compatibility.sql') | Out-Null
  Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\phase9_bookstore_first_postgres_bootstrap.sql') | Out-Null
  Write-Output 'U8B disposable baseline and bootstrap applied'

  if ($IncludeUnit6gBaseline) {
    Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\unit6g_postgres_bootstrap.sql') | Out-Null
  }

  foreach ($migration in $migrations) {
    Invoke-PsqlFile $dbName (Join-Path $root "supabase\migrations\$migration") | Out-Null
  }
  if ($IncludeOpenLibrary) {
    Write-Output 'Open Library native proof uses M01-M62 + M65-M78; M09 and M63/M64 excluded'
  } elseif ($IncludeEditionPicker) {
    Write-Output 'Edition picker unchanged prerequisite chain M01-M62 + M65-M78 applied; M63/M64 excluded'
  } elseif ($IncludeUnit6gBaseline) {
    Write-Output 'Unit 6G migration chain through M56 applied in the disposable database'
  } elseif ($IncludeU8C) {
    Write-Output 'U8C migration chain through M51 applied in the disposable database'
  } else {
    Write-Output 'U8B migration chain through M49 applied in the disposable database'
  }

  if ($IncludeDuplicateConfirmation) {
    Invoke-NativeGroup 'duplicate-confirmation' {
      & node (Join-Path $PSScriptRoot 'phase9DuplicateConfirmationConcurrency.postgres.mjs') $Port $dbName $psql
      if ($LASTEXITCODE -ne 0) { throw 'Unit 6H duplicate confirmation PostgreSQL acceptance failed' }
    }
  } elseif ($IncludeMediaCorrection) {
    Invoke-NativeGroup 'media-correction' {
      & node (Join-Path $PSScriptRoot 'phase9MediaConcurrency.postgres.mjs') $Port $dbName $psql
      if ($LASTEXITCODE -ne 0) { throw 'Unit 6G media correction PostgreSQL acceptance failed' }
    }
  }

  if ($IncludeEditionPicker) {
    Invoke-NativeGroup 'edition-picker' {
      & node (Join-Path $PSScriptRoot 'phase9EditionPickerConcurrency.postgres.mjs') $Port $dbName $psql
      if ($LASTEXITCODE -ne 0) { throw 'Task 8 edition picker PostgreSQL acceptance failed' }
      Write-Output 'EDITION_PICKER_REAL_POSTGRES_ACCEPTANCE_PASS'
    }
  }

  if ($IncludeOpenLibrary) {
    Invoke-NativeGroup 'open-library' {
      & node (Join-Path $PSScriptRoot 'phase9OpenLibraryConcurrency.postgres.mjs') $Port $dbName $psql
      if ($LASTEXITCODE -ne 0) { throw 'Open Library native PostgreSQL acceptance failed' }
      Write-Output 'OPEN_LIBRARY_REAL_POSTGRES_ACCEPTANCE_PASS'
    }
  }

  Invoke-NativeGroup 'bookstore-first' {
    $acceptance = Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\phase9_bookstore_first_postgres.sql')
    $acceptance | ForEach-Object { Write-Output $_ }
    Write-Output 'U8B_REAL_POSTGRES_ACCEPTANCE_PASS'
  }
  if ($IncludeU8C) {
    Invoke-NativeGroup 'storefront-detail' {
      $u8cAcceptance = Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\phase9_storefront_detail_postgres.sql')
      $u8cAcceptance | ForEach-Object { Write-Output $_ }
      Write-Output 'U8C_REAL_POSTGRES_ACCEPTANCE_PASS'
    }
  }

  # 02a §§7.1/10: keep ALL existing native suites on their exact M78-tail
  # database. Only the catalogue-link clone receives M79/M80, alignment and M81/M82.
  # M09/M63/M64 exclusions and the default target remain unchanged.
  if ($IncludeOpenLibrary) {
    Invoke-PsqlCommand 'postgres' "CREATE DATABASE $catalogueDbName TEMPLATE $dbName" | Out-Null
    $catalogueDatabaseCreated = $true
    foreach ($migration in @(
      '20261023000079_marketplace_phase9_isbn_match_metadata_state.sql',
      '20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql'
    )) {
      Invoke-PsqlFile $catalogueDbName (Join-Path $root "supabase\migrations\$migration") | Out-Null
    }
    $catalogueSetup = & node (Join-Path $PSScriptRoot 'catalogueLinkFixture.mjs') '--native-setup-sql'
    if ($LASTEXITCODE -ne 0) { throw 'catalogue-link test-schema alignment emission failed' }
    Invoke-PsqlCommand $catalogueDbName ($catalogueSetup -join [Environment]::NewLine) | Out-Null
    # §11: date + 000081 is fourteen digits TOTAL; absent M81 is a red test baseline.
    $catalogueM81 = @(Get-ChildItem -LiteralPath (Join-Path $root 'supabase\migrations') -File |
      Where-Object { $_.Name -match '^[0-9]{8}000081_marketplace_phase9_catalogue_link_at_add\.sql$' })
    if ($catalogueM81.Count -gt 1) { throw 'multiple catalogue-link M81 files found' }
    if ($catalogueM81.Count -eq 1) { Invoke-PsqlFile $catalogueDbName $catalogueM81[0].FullName | Out-Null }
    Invoke-PsqlFile $catalogueDbName (Join-Path $root 'supabase\migrations\20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql') | Out-Null
    # 02b §§9/11/12: live source ACL baseline, then optional 7a artifact only.
    $leanSetup = & node (Join-Path $PSScriptRoot 'leanCatalogueFixture.mjs') '--native-lean-setup-sql'
    if ($LASTEXITCODE -ne 0) { throw 'lean-catalogue test-schema alignment emission failed' }
    if ([string]::IsNullOrWhiteSpace(($leanSetup -join [Environment]::NewLine))) {
      throw 'lean-catalogue test-schema alignment emission returned no SQL'
    }
    # Windows PowerShell 5.1 native arguments do not preserve quoted SQL identifiers.
    [IO.File]::WriteAllText($leanSetupFile, ($leanSetup -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    Invoke-PsqlFile $catalogueDbName $leanSetupFile | Out-Null
    $catalogueM83 = @(Get-ChildItem -LiteralPath (Join-Path $root 'supabase\migrations') -File |
      Where-Object { $_.Name -match '^[0-9]{8}000083_marketplace_phase9_lean_catalogue_identity\.sql$' })
    if ($catalogueM83.Count -gt 1) { throw 'multiple lean-catalogue M83 files found' }
    if ($catalogueM83.Count -eq 1) { Invoke-PsqlFile $catalogueDbName $catalogueM83[0].FullName | Out-Null }
    # 02b sections 7/11-12: legacy fixtures keep M83 completion semantics.
    # Detect M84 here, but apply it only to its own clone below.
    $catalogueM84 = @(Get-ChildItem -LiteralPath (Join-Path $root 'supabase\migrations') -File |
      Where-Object { $_.Name -match '^[0-9]{8}000084_marketplace_phase9_catalogue_companions_completion\.sql$' })
    if ($catalogueM84.Count -gt 1) { throw 'multiple lean-catalogue M84 files found' }
    $leanScope = if ($catalogueM84.Count -eq 1) { 'm83' } else { 'all' }
    Invoke-NativeGroup 'catalogue-link' {
      & node (Join-Path $PSScriptRoot 'phase9CatalogueLinkConcurrency.postgres.mjs') $Port $catalogueDbName $psql
      if ($LASTEXITCODE -ne 0) { throw 'Catalogue-link native PostgreSQL acceptance failed' }
      Write-Output 'CATALOGUE_LINK_REAL_POSTGRES_ACCEPTANCE_PASS'
    }
    Invoke-NativeGroup 'lean-catalogue-identity' {
      & node (Join-Path $PSScriptRoot 'phase9LeanCatalogueConcurrency.postgres.mjs') $Port $catalogueDbName $psql $leanScope
      if ($LASTEXITCODE -ne 0) { throw 'Lean-catalogue identity native PostgreSQL acceptance failed' }
      Write-Output 'LEAN_CATALOGUE_IDENTITY_REAL_POSTGRES_ACCEPTANCE_PASS'
    }
    # Owner M82 brief: run the same first-save assertions on the disposable clone.
    $savedFirstSavePort = $env:PHASE9_FIRST_SAVE_NATIVE_PORT
    $savedFirstSaveDatabase = $env:PHASE9_FIRST_SAVE_NATIVE_DATABASE
    try {
      $env:PHASE9_FIRST_SAVE_NATIVE_PORT = "$Port"
      $env:PHASE9_FIRST_SAVE_NATIVE_DATABASE = $catalogueDbName
      Invoke-NativeGroup 'edition-first-save' {
        & node --test (Join-Path $PSScriptRoot 'phase9EditionChoiceFirstSave.integration.test.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Edition first-save native PostgreSQL acceptance failed' }
        Write-Output 'EDITION_FIRST_SAVE_REAL_POSTGRES_ACCEPTANCE_PASS'
      }
    } finally {
      $env:PHASE9_FIRST_SAVE_NATIVE_PORT = $savedFirstSavePort
      $env:PHASE9_FIRST_SAVE_NATIVE_DATABASE = $savedFirstSaveDatabase
    }
    if ($catalogueM84.Count -eq 1) {
      Invoke-PsqlCommand 'postgres' "CREATE DATABASE $completionDbName TEMPLATE $catalogueDbName" | Out-Null
      $completionDatabaseCreated = $true
      Invoke-PsqlFile $completionDbName $catalogueM84[0].FullName | Out-Null
      Invoke-NativeGroup 'lean-catalogue-completion' {
        & node (Join-Path $PSScriptRoot 'phase9LeanCatalogueConcurrency.postgres.mjs') $Port $completionDbName $psql 'm84'
        if ($LASTEXITCODE -ne 0) { throw 'Lean-catalogue M84 completion native PostgreSQL acceptance failed' }
        Write-Output 'LEAN_CATALOGUE_COMPLETION_REAL_POSTGRES_ACCEPTANCE_PASS'
      }
      # 02b section 12 amendment: cache acceptance owns an independent M84-M88 clone.
      Invoke-NativeGroup 'lean-catalogue-cache' {
        $cacheChain = @()
        foreach ($number in @('85','86','87','88')) {
          $files = @(Get-ChildItem -LiteralPath (Join-Path $root 'supabase\migrations') -File |
            Where-Object { $_.Name -match "^[0-9]{8}0000${number}_marketplace_phase9_[a-z0-9_]+\.sql$" })
          if ($files.Count -gt 1) { throw "multiple lean-catalogue M$number files found" }
          if ($files.Count -eq 1) { $cacheChain += $files[0] }
        }
        if ($cacheChain.Count -ne 4) {
          Write-Output 'LEAN_CATALOGUE_CACHE SKIPPED (M85-M88 not present)'
          return
        }
        Invoke-PsqlCommand 'postgres' "CREATE DATABASE $cacheDbName TEMPLATE $catalogueDbName" | Out-Null
        $script:cacheDatabaseCreated = $true
        Invoke-PsqlFile $cacheDbName $catalogueM84[0].FullName | Out-Null
        foreach ($file in $cacheChain) { Invoke-PsqlFile $cacheDbName $file.FullName | Out-Null }
        & node (Join-Path $PSScriptRoot 'phase9LeanCatalogueConcurrency.postgres.mjs') $Port $cacheDbName $psql 'm88'
        if ($LASTEXITCODE -ne 0) { throw 'Lean-catalogue M88 cache native PostgreSQL acceptance failed' }
        Write-Output 'LEAN_CATALOGUE_CACHE_REAL_POSTGRES_ACCEPTANCE_PASS'
      }
      Invoke-NativeGroup 'lean-catalogue-local-hook' {
        & node (Join-Path $PSScriptRoot 'phase9LeanCatalogueLocalHook.postgres.mjs') $Port $completionDbName $psql 'm84'
        if ($LASTEXITCODE -ne 0) { throw 'Lean-catalogue M84 local hook native PostgreSQL acceptance failed' }
        Write-Output 'LEAN_CATALOGUE_LOCAL_HOOK_REAL_POSTGRES_ACCEPTANCE_PASS'
      }
    }
  }
  if ($OnlyGroup -and $nativeGroups.Count -eq 0) {
    throw "Native group '$OnlyGroup' is unavailable; check Include switches and migration files"
  }
  $exitCode = if (@($nativeGroups | Where-Object { -not $_.Passed }).Count -gt 0) { 1 } else { 0 }
}
catch {
  Write-Error $_ -ErrorAction Continue
}
finally {
  # Task 8 / EP-AC12: cleanup failures are failures, with evidence retained in command output.
  $cleanupErrors = [Collections.Generic.List[string]]::new()
  try {
    if ($dataDirCreated -and (Test-Path -LiteralPath $leanSetupFile)) {
      Remove-Item -LiteralPath $leanSetupFile -Force
    }
  } catch { $cleanupErrors.Add("lean setup SQL cleanup: $_") }
  $stopVerified = -not $serverStarted
  if ($cacheDatabaseCreated -and $serverStarted) {
    try {
      Invoke-PsqlCommand 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$cacheDbName'" | Out-Null
      Invoke-PsqlCommand 'postgres' "DROP DATABASE IF EXISTS $cacheDbName" | Out-Null
      $cacheExists = Invoke-PsqlCommand 'postgres' "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='$cacheDbName')"
      if (-not @($cacheExists | ForEach-Object { "$_".Trim() }).Contains('f')) { throw 'cache database removal readback failed' }
      Write-Output "POSTGRES_TEARDOWN_DATABASE_REMOVED=$cacheDbName"
    } catch { $cleanupErrors.Add("cache database cleanup: $_") }
  }
  if ($completionDatabaseCreated -and $serverStarted) {
    try {
      Invoke-PsqlCommand 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$completionDbName'" | Out-Null
      Invoke-PsqlCommand 'postgres' "DROP DATABASE IF EXISTS $completionDbName" | Out-Null
      $completionExists = Invoke-PsqlCommand 'postgres' "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='$completionDbName')"
      if (-not @($completionExists | ForEach-Object { "$_".Trim() }).Contains('f')) { throw 'completion database removal readback failed' }
      Write-Output "POSTGRES_TEARDOWN_DATABASE_REMOVED=$completionDbName"
    } catch { $cleanupErrors.Add("completion database cleanup: $_") }
  }
  if ($catalogueDatabaseCreated -and $serverStarted) {
    try {
      Invoke-PsqlCommand 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$catalogueDbName'" | Out-Null
      Invoke-PsqlCommand 'postgres' "DROP DATABASE IF EXISTS $catalogueDbName" | Out-Null
      $catalogueExists = Invoke-PsqlCommand 'postgres' "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='$catalogueDbName')"
      if (-not @($catalogueExists | ForEach-Object { "$_".Trim() }).Contains('f')) { throw 'catalogue database removal readback failed' }
      Write-Output "POSTGRES_TEARDOWN_DATABASE_REMOVED=$catalogueDbName"
    } catch { $cleanupErrors.Add("catalogue database cleanup: $_") }
  }
  if ($databaseCreated -and $serverStarted) {
    try {
      $sessions = Invoke-PsqlCommand 'postgres' "SELECT count(*) FROM pg_stat_activity WHERE datname='$dbName'"
      $sessionCount = @($sessions | ForEach-Object { "$_".Trim() } | Where-Object { $_ -match '^\d+$' })[0]
      Write-Output "POSTGRES_TEARDOWN_CONNECTIONS_BEFORE_DROP=$sessionCount"
      Invoke-PsqlCommand 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$dbName'" | Out-Null
      Invoke-PsqlCommand 'postgres' "DROP DATABASE IF EXISTS $dbName" | Out-Null
      $exists = Invoke-PsqlCommand 'postgres' "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='$dbName')"
      if (-not @($exists | ForEach-Object { "$_".Trim() }).Contains('f')) { throw 'database removal readback failed' }
      Write-Output "POSTGRES_TEARDOWN_DATABASE_REMOVED=$dbName"
    } catch { $cleanupErrors.Add("database cleanup: $_") }
  }
  if ($serverStarted) {
    try {
      $stopProcess = Start-Process -FilePath $pgctl -ArgumentList @('-D',$DataDir,'-m','fast','stop') -WindowStyle Hidden -PassThru -Wait
      if ($stopProcess.ExitCode -ne 0) {
        $stopProcess = Start-Process -FilePath $pgctl -ArgumentList @('-D',$DataDir,'-m','immediate','stop') -WindowStyle Hidden -PassThru -Wait
        if ($stopProcess.ExitCode -ne 0) { throw "pg_ctl stop failed: $($stopProcess.ExitCode)" }
      }
      & $pgctl -D $DataDir status *> $null
      if ($LASTEXITCODE -ne 3) { throw 'pg_ctl did not verify the created cluster stopped' }
      $stopVerified = $true
      Write-Output 'POSTGRES_TEARDOWN_CLUSTER_STOPPED'
    } catch { $cleanupErrors.Add("cluster cleanup: $_") }
  }
  try {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
    $resolvedDataDir = [IO.Path]::GetFullPath($DataDir).TrimEnd('\')
    $safeDisposablePath = $resolvedDataDir.StartsWith("$tempRoot\bookconnect-u8b-pg-", [StringComparison]::OrdinalIgnoreCase)
    if ($dataDirCreated -and $safeDisposablePath -and $stopVerified -and (Test-Path -LiteralPath $resolvedDataDir)) {
      $actualPath = (Resolve-Path -LiteralPath $resolvedDataDir).Path.TrimEnd('\')
      $item = Get-Item -LiteralPath $actualPath
      if ($actualPath -ne $resolvedDataDir -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "unsafe recursive cleanup path: $actualPath"
      }
      Remove-Item -LiteralPath $actualPath -Recurse -Force
      if (Test-Path -LiteralPath $actualPath) { throw 'created temporary directory remains' }
      Write-Output "POSTGRES_TEARDOWN_TEMP_DIRECTORY_REMOVED=$actualPath"
    } elseif ($dataDirCreated -and (Test-Path -LiteralPath $DataDir)) {
      Write-Output "POSTGRES_TEARDOWN_DIRECTORY_RETAINED=$DataDir"
      if (-not $stopVerified) { throw 'running cluster directory retained after stop failure' }
    }
  } catch { $cleanupErrors.Add("directory cleanup: $_") }
  if ($cleanupErrors.Count -gt 0) {
    $exitCode = 1
    $cleanupErrors | ForEach-Object { Write-Error "POSTGRES_TEARDOWN_FAILURE: $_" -ErrorAction Continue }
  } else { Write-Output 'POSTGRES_TEARDOWN_PASS' }
}

foreach ($group in $nativeGroups) {
  $result = if ($group.Passed) { 'PASS' } else { 'FAIL' }
  Write-Output "NATIVE_GROUP $($group.Name) $result"
}

exit $exitCode
