-- Disposable test prerequisite from Phase 6 M24, verified against live columns
-- 2026-09-06. Never apply this fixture to Supabase.
CREATE TABLE public.marketplace_event_schema_registry(
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK(schema_version>=1),
  entity_type text NOT NULL,
  is_transition boolean NOT NULL,
  privacy_classification text NOT NULL
    CHECK(privacy_classification IN('internal','confidential')),
  PRIMARY KEY(event_type,schema_version)
);
REVOKE ALL ON public.marketplace_event_schema_registry FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.marketplace_event_schema_registry TO service_role;
