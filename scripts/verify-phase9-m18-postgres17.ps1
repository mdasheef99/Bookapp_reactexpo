param(
  [string]$PsqlCommand = 'psql'
)

$ErrorActionPreference = 'Stop'
$psql = Get-Command $PsqlCommand -ErrorAction Stop
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationPath = Join-Path $repositoryRoot `
  'supabase/migrations/20260729000018_marketplace_phase9_search_variant_proposals.sql'
$migration = Get-Content -LiteralPath $migrationPath -Raw
$match = [regex]::Match(
  $migration,
  '(?s)\A.*?\bBEGIN;\s*(?<body>.*)\s+COMMIT;\s*\z'
)
if (-not $match.Success) {
  throw 'M18 must retain one outer BEGIN/COMMIT transaction wrapper.'
}

$verificationSql = @"
\set ON_ERROR_STOP on
BEGIN;
DO `$postgres17`$
BEGIN
  IF current_setting('server_version_num')::integer < 170000
     OR current_setting('server_version_num')::integer >= 180000 THEN
    RAISE EXCEPTION 'P9_M18_REQUIRES_POSTGRES_17';
  END IF;
  IF to_regclass('public.phase9_search_variant_proposals') IS NOT NULL
     OR to_regprocedure(
       'public.phase9_persist_vision_analysis_with_variants(uuid,text,text,integer,jsonb,jsonb)'
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'P9_M18_REQUIRES_CLEAN_M17_BASELINE';
  END IF;
END
`$postgres17`$;
$($match.Groups['body'].Value)
DO `$m18`$
DECLARE
  v_bad boolean;
BEGIN
  IF to_regclass('public.phase9_search_variant_proposals') IS NULL
     OR to_regprocedure(
       'public.phase9_persist_vision_analysis_with_variants(uuid,text,text,integer,jsonb,jsonb)'
     ) IS NULL
     OR to_regprocedure(
       'public.phase9_read_search_variant_proposals(uuid,uuid,uuid,uuid,text,text)'
     ) IS NULL THEN
    RAISE EXCEPTION 'P9_M18_APPLICATION_INCOMPLETE';
  END IF;
  SELECT NOT c.relrowsecurity OR pg_get_userbyid(c.relowner)<>'postgres'
    INTO v_bad
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='phase9_search_variant_proposals';
  IF coalesce(v_bad,true)
     OR NOT has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','SELECT'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','INSERT'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','UPDATE'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','DELETE'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','TRUNCATE'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','REFERENCES'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','TRIGGER'
     )
     OR has_table_privilege(
       'service_role','public.phase9_search_variant_proposals','MAINTAIN'
     )
     OR has_table_privilege(
       'anon','public.phase9_search_variant_proposals','SELECT'
     )
     OR has_table_privilege(
       'authenticated','public.phase9_search_variant_proposals','SELECT'
     ) THEN
    RAISE EXCEPTION 'P9_M18_TABLE_ACL_INVALID';
  END IF;
  IF NOT has_function_privilege(
       'service_role',
       'public.phase9_persist_vision_analysis_with_variants(uuid,text,text,integer,jsonb,jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.phase9_persist_vision_analysis_with_variants(uuid,text,text,integer,jsonb,jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.phase9_persist_vision_analysis_with_variants(uuid,text,text,integer,jsonb,jsonb)',
       'EXECUTE'
     )
     OR EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE p.proname IN (
         'phase9_persist_vision_analysis_with_variants',
         'phase9_read_search_variant_proposals'
       )
         AND n.nspname IN ('public','marketplace_sec')
         AND NOT ('search_path=""'=ANY(p.proconfig))
     ) THEN
    RAISE EXCEPTION 'P9_M18_FUNCTION_ACL_INVALID';
  END IF;
END
`$m18`$;
SELECT current_setting('server_version') AS server_version,
  c.relacl::text AS proposal_acl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='phase9_search_variant_proposals';
ROLLBACK;
DO `$rollback`$
BEGIN
  IF to_regclass('public.phase9_search_variant_proposals') IS NOT NULL
     OR to_regprocedure(
       'public.phase9_persist_vision_analysis_with_variants(uuid,text,text,integer,jsonb,jsonb)'
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'P9_M18_ROLLBACK_INCOMPLETE';
  END IF;
END
`$rollback`$;
"@

$temporarySql = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -LiteralPath $temporarySql -Value $verificationSql -Encoding utf8
  & $psql.Source -X --no-password -v ON_ERROR_STOP=1 -f $temporarySql
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL 17 M18 verification failed with exit code $LASTEXITCODE."
  }
}
finally {
  Remove-Item -LiteralPath $temporarySql -Force -ErrorAction SilentlyContinue
}
