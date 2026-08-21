param(
  [int]$Port = 5450,
  [string]$DataDir = '',
  [switch]$IncludeU8C
)

$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$dbName = "bookconnect_u8b_$PID"
$defaultDataDir = Join-Path ([IO.Path]::GetTempPath()) "bookconnect-u8b-pg-$PID"
if ([string]::IsNullOrWhiteSpace($DataDir)) { $DataDir = $defaultDataDir }
$DataDir = [IO.Path]::GetFullPath($DataDir)
$serverLog = Join-Path $DataDir 'server.log'
$dataDirCreated = $false
$serverStarted = $false
$databaseCreated = $false
$exitCode = 1

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
if ($IncludeU8C) {
  $migrations += '20260820000050_marketplace_phase9_storefront_detail.sql'
  $migrations += '20260821000051_marketplace_phase9_public_media_order_invariant.sql'
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

  foreach ($migration in $migrations) {
    Invoke-PsqlFile $dbName (Join-Path $root "supabase\migrations\$migration") | Out-Null
  }
  if ($IncludeU8C) {
    Write-Output 'U8C migration chain through M51 applied in the disposable database'
  } else {
    Write-Output 'U8B migration chain through M49 applied in the disposable database'
  }

  $acceptance = Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\phase9_bookstore_first_postgres.sql')
  $acceptance | ForEach-Object { Write-Output $_ }
  Write-Output 'U8B_REAL_POSTGRES_ACCEPTANCE_PASS'
  if ($IncludeU8C) {
    $u8cAcceptance = Invoke-PsqlFile $dbName (Join-Path $root 'supabase\tests\phase9\phase9_storefront_detail_postgres.sql')
    $u8cAcceptance | ForEach-Object { Write-Output $_ }
    Write-Output 'U8C_REAL_POSTGRES_ACCEPTANCE_PASS'
  }
  $exitCode = 0
}
catch {
  Write-Error $_
}
finally {
  if ($databaseCreated -and $serverStarted) {
    try { Invoke-PsqlCommand 'postgres' "DROP DATABASE IF EXISTS $dbName" | Out-Null } catch { Write-Warning $_ }
  }
  if ($serverStarted) {
    $stopProcess = Start-Process -FilePath $pgctl -ArgumentList @('-D',$DataDir,'-m','fast','stop') -WindowStyle Hidden -PassThru -Wait
    if ($stopProcess.ExitCode -ne 0) {
      Start-Process -FilePath $pgctl -ArgumentList @('-D',$DataDir,'-m','immediate','stop') -WindowStyle Hidden -PassThru -Wait | Out-Null
    }
  }
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
  $resolvedDataDir = $DataDir.TrimEnd('\')
  $safeDisposablePath = $resolvedDataDir.StartsWith("$tempRoot\bookconnect-u8b-pg-", [StringComparison]::OrdinalIgnoreCase)
  if ($dataDirCreated -and $safeDisposablePath -and (Test-Path -LiteralPath $DataDir)) {
    Remove-Item -LiteralPath $DataDir -Recurse -Force
  }
}

exit $exitCode
