param(
  [string]$PsqlCommand = 'psql'
)

$ErrorActionPreference = 'Stop'
$psql = Get-Command $PsqlCommand -ErrorAction Stop
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationPath = Join-Path $repositoryRoot `
  'supabase/migrations/20260728000015_marketplace_phase9_metadata_foundation.sql'
$migration = Get-Content -LiteralPath $migrationPath -Raw
$match = [regex]::Match(
  $migration,
  '(?s)\A.*?\bBEGIN;\s*(?<body>.*)\s+COMMIT;\s*\z'
)
if (-not $match.Success) {
  throw 'M15 must retain one outer BEGIN/COMMIT transaction wrapper.'
}

$verificationSql = @"
\set ON_ERROR_STOP on
BEGIN;
DO `$postgres17`$
BEGIN
  IF current_setting('server_version_num')::integer < 170000
     OR current_setting('server_version_num')::integer >= 180000 THEN
    RAISE EXCEPTION 'P9_M15_REQUIRES_POSTGRES_17';
  END IF;
  IF to_regclass('public.phase9_metadata_lookups') IS NOT NULL
     OR to_regprocedure(
       'public.claim_phase9_metadata_jobs(integer,text)'
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'P9_M15_REQUIRES_CLEAN_M14_BASELINE';
  END IF;
END
`$postgres17`$;
$($match.Groups['body'].Value)
DO `$m15`$
BEGIN
  IF to_regclass('public.phase9_metadata_lookups') IS NULL
     OR to_regprocedure(
       'public.claim_phase9_metadata_jobs(integer,text)'
     ) IS NULL THEN
    RAISE EXCEPTION 'P9_M15_APPLICATION_INCOMPLETE';
  END IF;
END
`$m15`$;
SELECT current_setting('server_version') AS server_version,
  to_regprocedure(
    'public.claim_phase9_metadata_jobs(integer,text)'
  )::text AS claim_function;
ROLLBACK;
DO `$rollback`$
BEGIN
  IF to_regclass('public.phase9_metadata_lookups') IS NOT NULL
     OR to_regprocedure(
       'public.claim_phase9_metadata_jobs(integer,text)'
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'P9_M15_ROLLBACK_INCOMPLETE';
  END IF;
END
`$rollback`$;
"@

$temporarySql = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -LiteralPath $temporarySql -Value $verificationSql -Encoding utf8
  & $psql.Source -X --no-password -v ON_ERROR_STOP=1 -f $temporarySql
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL 17 M15 verification failed with exit code $LASTEXITCODE."
  }
}
finally {
  Remove-Item -LiteralPath $temporarySql -Force -ErrorAction SilentlyContinue
}
