-- Phase 9 M16: narrow RPC-only mutation boundary correction for M14/M15 tables.
-- Forward-only security correction. This file is not authorization to apply it.
BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public.vision_provider_attempts,
  public.phase9_metadata_lookups,
  public.phase9_metadata_cache_entries,
  public.phase9_selected_metadata_snapshots
FROM service_role;

GRANT SELECT
ON TABLE
  public.vision_provider_attempts,
  public.phase9_metadata_lookups,
  public.phase9_metadata_cache_entries,
  public.phase9_selected_metadata_snapshots
TO service_role;

REVOKE ALL
ON TABLE
  public.vision_provider_attempts,
  public.phase9_metadata_lookups,
  public.phase9_metadata_cache_entries,
  public.phase9_selected_metadata_snapshots
FROM PUBLIC, anon, authenticated;

COMMIT;
