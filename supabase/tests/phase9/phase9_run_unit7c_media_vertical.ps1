param(
  [int]$Port = 5444,
  [string]$DataDir = "$env:LOCALAPPDATA\Temp\opencode\pg-wu4",
  [int]$MaxAttempts = 6
)
$ErrorActionPreference = 'Continue'
$env:PGCLIENTENCODING = 'UTF8'
$root = git rev-parse --show-toplevel
$url = "postgresql://postgres@127.0.0.1:$Port/wu4proof"
$stateFile = "$DataDir\wu4-state.txt"
$logFile = "$DataDir\wu4-run.log"

function Log([string]$message) {
  $line = "$(Get-Date -Format o) $message"
  try { $line | Out-File -FilePath $logFile -Append -Encoding utf8 } catch {}
  Write-Output $line
}

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
  '20260815000045_marketplace_phase9_unit7c_media_history.sql'
)

function Ensure-Server {
  $alive = $false
  & cmd /c "pg_ctl -D `"$DataDir`" status >nul 2>&1"
  if ($LASTEXITCODE -eq 0) {
    psql -h 127.0.0.1 -p $Port -U postgres -Atc "SELECT 1" *> $null
    $alive = ($LASTEXITCODE -eq 0)
  }
  if ($alive) { return }
  for ($attempt = 1; $attempt -le 10; $attempt += 1) {
    & cmd /c "pg_ctl -D `"$DataDir`" stop >nul 2>&1" | Out-Null
    Start-Sleep -Seconds 3
    & cmd /c "pg_ctl -D `"$DataDir`" -l `"$DataDir\server-$PID.log`" -o `"-p $Port -c listen_addresses=127.0.0.1 -c autovacuum=off -c fsync=off -c full_page_writes=off`" start" | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Start-Sleep -Seconds 2
      psql -h 127.0.0.1 -p $Port -U postgres -Atc "SELECT 1" *> $null
      if ($LASTEXITCODE -eq 0) { return }
    }
    Log "server restart attempt $attempt failed"
    Start-Sleep -Seconds 5
  }
  throw 'server could not be started'
}

function Run-Psql([string]$sql) {
  psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -c $sql *> $null
  return $LASTEXITCODE
}

function Run-PsqlFile([string]$file) {
  psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -f $file *> $null
  return $LASTEXITCODE
}

if (-not (Test-Path "$DataDir\PG_VERSION")) {
  New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
  & initdb -D $DataDir -U postgres -A trust --no-sync -E UTF8 --locale=C *> $null
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
  Log 'cluster initialized'
}
Ensure-Server

$state = @()
if (Test-Path $stateFile) { $state = @(Get-Content $stateFile) }

$overallAttempts = 0
while ($overallAttempts -lt 12) {
  $overallAttempts += 1
  try {
    if ($state -notcontains 'seeded') {
      Ensure-Server
      psql -h 127.0.0.1 -p $Port -U postgres -d postgres -X -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS wu4proof" *> $null
      $ok = ($LASTEXITCODE -eq 0)
      if ($ok) {
        psql -h 127.0.0.1 -p $Port -U postgres -d postgres -X -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE wu4proof" *> $null
        $ok = ($LASTEXITCODE -eq 0)
      }
      if ($ok) {
        psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -c "DROP ROLE IF EXISTS anon; DROP ROLE IF EXISTS authenticated; DROP ROLE IF EXISTS service_role" *> $null
        $ok = ($LASTEXITCODE -eq 0)
      }
      if ($ok) {
        psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -f "$root\supabase\tests\phase9\phase6_baseline.sql" *> $null
        $ok = ($LASTEXITCODE -eq 0)
      }
      if ($ok) {
        $shim = "CREATE SCHEMA IF NOT EXISTS extensions; CREATE OR REPLACE FUNCTION extensions.digest(value text, algorithm text) RETURNS bytea LANGUAGE sql IMMUTABLE AS `$`$ SELECT CASE WHEN algorithm='sha256' THEN sha256(convert_to(value,'UTF8')) ELSE NULL END `$`$; ALTER TABLE public.marketplace_events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system_job', ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';"
        psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -c $shim *> $null
        $ok = ($LASTEXITCODE -eq 0)
      }
      if ($ok) {
        psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -f "$root\supabase\tests\phase9\unit7b_postgres_compatibility.sql" *> $null
        $ok = ($LASTEXITCODE -eq 0)
      }
      if ($ok) {
        $state += 'seeded'
        $state | Out-File -FilePath $stateFile -Encoding utf8
        Log 'seed + baseline + shims applied'
      } else {
        throw 'seeding incomplete'
      }
    }

    foreach ($migration in $migrations) {
      if ($state -contains $migration) { continue }
      Ensure-Server
      $exit = Run-PsqlFile "$root\supabase\migrations\$migration"
      if ($exit -eq 0) {
        $state += $migration
        $state | Out-File -FilePath $stateFile -Encoding utf8
        Log "applied $migration"
      } else {
        throw "migration $migration failed"
      }
    }

    if ($state -notcontains 'vertical') {
      Ensure-Server
      psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -c "ALTER TABLE public.phase9_publication_revisions DISABLE TRIGGER phase9_publication_revisions_append_only; DELETE FROM public.phase9_publication_revisions WHERE inventory_id IN ('d5000000-0000-4000-8000-000000000011','d5000000-0000-4000-8000-000000000012'); ALTER TABLE public.phase9_publication_revisions ENABLE TRIGGER phase9_publication_revisions_append_only" *> $null
      psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -q -c "DELETE FROM public.phase9_idempotency_keys WHERE actor_or_service IN ('d5000000-0000-4000-8000-000000000003','d5000000-0000-4000-8000-000000000099'); DELETE FROM public.marketplace_events WHERE entity_id IN ('d5000000-0000-4000-8000-000000000011','d5000000-0000-4000-8000-000000000012'); DELETE FROM public.marketplace_audit_logs WHERE entity_id IN ('d5000000-0000-4000-8000-000000000011','d5000000-0000-4000-8000-000000000012'); DELETE FROM public.image_extraction_jobs WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.inventory_media_links WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.phase9_upload_capabilities WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.marketplace_book_listings WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.media_lifecycle_attempts WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.media_assets WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.store_inventory WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.store_administrators WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.store_subscriptions WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.store_entitlements WHERE store_id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.marketplace_policy_config WHERE store_id='d5000000-0000-4000-8000-000000000002' OR policy_key='marketplace_enabled'; DELETE FROM public.stores WHERE id='d5000000-0000-4000-8000-000000000002'; DELETE FROM public.marketplace_localities WHERE id='d5000000-0000-4000-8000-000000000001'" *> $null
      $output = & psql -h 127.0.0.1 -p $Port -U postgres -d wu4proof -X -v ON_ERROR_STOP=1 -At -f "$root\supabase\tests\phase9\phase9_unit7c_media_vertical.sql" 2>&1
      $exit = $LASTEXITCODE
      $text = ($output | Out-String).Trim()
      Log "vertical exit $exit"
      if ($exit -eq 0) {
        $state += 'vertical'
        $state | Out-File -FilePath $stateFile -Encoding utf8
        Log 'vertical PASS'
        Write-Output $text
      } else {
        Log "vertical output: $text"
        throw 'vertical failed'
      }
    }
    Log 'proof complete'
    exit 0
  } catch {
    Log "attempt $overallAttempts failed: $_"
    Start-Sleep -Seconds 20
  }
}
Log 'gave up after repeated environment failures'
exit 1
