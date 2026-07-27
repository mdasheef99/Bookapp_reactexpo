param(
  [string]$PsqlCommand = 'psql'
)

$ErrorActionPreference = 'Stop'
$psql = Get-Command $PsqlCommand -ErrorAction Stop
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationPath = Join-Path $repositoryRoot `
  'supabase/migrations/20260728000017_marketplace_phase9_maintain_acl_correction.sql'
$migration = Get-Content -LiteralPath $migrationPath -Raw
$match = [regex]::Match(
  $migration,
  '(?s)\A.*?\bBEGIN;\s*(?<body>.*)\s+COMMIT;\s*\z'
)
if (-not $match.Success) {
  throw 'M17 must retain one outer BEGIN/COMMIT transaction wrapper.'
}

$verificationSql = @"
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE p9_m17_counts AS
SELECT
  (SELECT count(*) FROM public.vision_provider_attempts) AS vision_attempts,
  (SELECT count(*) FROM public.phase9_metadata_lookups) AS metadata_lookups,
  (SELECT count(*) FROM public.phase9_metadata_cache_entries) AS cache_entries,
  (SELECT count(*) FROM public.phase9_selected_metadata_snapshots) AS snapshots;
DO `$pre`$
DECLARE
  v_table text;
  v_privilege text;
BEGIN
  IF current_setting('server_version_num')::integer < 170000
     OR current_setting('server_version_num')::integer >= 180000 THEN
    RAISE EXCEPTION 'P9_M17_REQUIRES_POSTGRES_17';
  END IF;
  FOREACH v_table IN ARRAY ARRAY[
    'public.vision_provider_attempts',
    'public.phase9_metadata_lookups',
    'public.phase9_metadata_cache_entries',
    'public.phase9_selected_metadata_snapshots'
  ] LOOP
    IF NOT has_table_privilege('service_role',v_table,'SELECT')
       OR NOT has_table_privilege('service_role',v_table,'MAINTAIN') THEN
      RAISE EXCEPTION 'P9_M17_REQUIRES_LIVE_M16_ACL: %',v_table;
    END IF;
    FOREACH v_privilege IN ARRAY ARRAY[
      'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF has_table_privilege('service_role',v_table,v_privilege) THEN
        RAISE EXCEPTION 'P9_M17_UNEXPECTED_PRE_PRIVILEGE: % %',v_table,v_privilege;
      END IF;
    END LOOP;
  END LOOP;
END
`$pre`$;
$($match.Groups['body'].Value)
DO `$post`$
DECLARE
  v_table text;
  v_role text;
  v_privilege text;
  v_rpc_count integer;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.vision_provider_attempts',
    'public.phase9_metadata_lookups',
    'public.phase9_metadata_cache_entries',
    'public.phase9_selected_metadata_snapshots'
  ] LOOP
    IF NOT has_table_privilege('service_role',v_table,'SELECT') THEN
      RAISE EXCEPTION 'P9_M17_SELECT_MISSING: %',v_table;
    END IF;
    FOREACH v_privilege IN ARRAY ARRAY[
      'MAINTAIN','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF has_table_privilege('service_role',v_table,v_privilege) THEN
        RAISE EXCEPTION 'P9_M17_PRIVILEGE_REMAINS: % %',v_table,v_privilege;
      END IF;
    END LOOP;
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY[
        'SELECT','MAINTAIN','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
      ] LOOP
        IF has_table_privilege(v_role,v_table,v_privilege) THEN
          RAISE EXCEPTION 'P9_M17_CLIENT_PRIVILEGE: % % %',v_role,v_table,v_privilege;
        END IF;
      END LOOP;
    END LOOP;
    IF NOT (SELECT c.relrowsecurity AND pg_get_userbyid(c.relowner)='postgres'
      FROM pg_class c WHERE c.oid=v_table::regclass) THEN
      RAISE EXCEPTION 'P9_M17_TABLE_BOUNDARY_CHANGED: %',v_table;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_rpc_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname=ANY(ARRAY[
      'claim_phase9_metadata_jobs','phase9_associate_vision_provider_attempt',
      'phase9_complete_local_metadata_match','phase9_finalize_metadata_attempt',
      'phase9_finalize_vision_provider_attempt','phase9_invalidate_metadata_cache',
      'phase9_mark_vision_provider_attempt','phase9_register_metadata_attempt',
      'phase9_register_metadata_lookup','phase9_register_vision_provider_attempt',
      'phase9_select_metadata_snapshot','phase9_store_metadata_cache',
      'phase9_validate_vision_provider_egress'
    ])
    AND has_function_privilege('service_role',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND p.proconfig=ARRAY['search_path=""'];
  IF v_rpc_count<>13 THEN
    RAISE EXCEPTION 'P9_M17_RPC_BOUNDARY_CHANGED: %',v_rpc_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM p9_m17_counts b CROSS JOIN LATERAL (
      SELECT
        (SELECT count(*) FROM public.vision_provider_attempts) AS vision_attempts,
        (SELECT count(*) FROM public.phase9_metadata_lookups) AS metadata_lookups,
        (SELECT count(*) FROM public.phase9_metadata_cache_entries) AS cache_entries,
        (SELECT count(*) FROM public.phase9_selected_metadata_snapshots) AS snapshots
    ) a
    WHERE (b.vision_attempts,b.metadata_lookups,b.cache_entries,b.snapshots)
      IS DISTINCT FROM
      (a.vision_attempts,a.metadata_lookups,a.cache_entries,a.snapshots)
  ) THEN
    RAISE EXCEPTION 'P9_M17_DATA_CHANGED';
  END IF;
END
`$post`$;
ROLLBACK;
DO `$rollback`$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.vision_provider_attempts',
    'public.phase9_metadata_lookups',
    'public.phase9_metadata_cache_entries',
    'public.phase9_selected_metadata_snapshots'
  ] LOOP
    IF NOT has_table_privilege('service_role',v_table,'SELECT')
       OR NOT has_table_privilege('service_role',v_table,'MAINTAIN') THEN
      RAISE EXCEPTION 'P9_M17_ROLLBACK_INCOMPLETE: %',v_table;
    END IF;
  END LOOP;
END
`$rollback`$;
"@

$temporarySql = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -LiteralPath $temporarySql -Value $verificationSql -Encoding utf8
  & $psql.Source -X --no-password -v ON_ERROR_STOP=1 -f $temporarySql
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL 17 M17 verification failed with exit code $LASTEXITCODE."
  }
}
finally {
  Remove-Item -LiteralPath $temporarySql -Force -ErrorAction SilentlyContinue
}
