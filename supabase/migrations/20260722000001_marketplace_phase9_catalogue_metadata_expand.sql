-- Phase 9 M01: catalogue metadata, provider registry, aliases, and additive snapshots.
BEGIN;

CREATE TABLE public.phase9_provider_registry (
  adapter_key text PRIMARY KEY,
  provider_kind text NOT NULL CHECK (provider_kind IN ('vision','metadata','alias')),
  adapter_version text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  matching_allowed boolean NOT NULL DEFAULT false,
  storage_allowed boolean NOT NULL DEFAULT false,
  public_display_allowed boolean NOT NULL DEFAULT false,
  image_cache_allowed boolean NOT NULL DEFAULT false,
  attribution_required boolean NOT NULL DEFAULT false,
  revalidation_seconds integer CHECK (revalidation_seconds IS NULL OR revalidation_seconds>0),
  raw_retention_seconds integer NOT NULL DEFAULT 604800 CHECK (raw_retention_seconds>=0),
  policy_version integer NOT NULL DEFAULT 1 CHECK (policy_version>0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
INSERT INTO public.phase9_provider_registry(
  adapter_key,provider_kind,adapter_version,matching_allowed,storage_allowed,policy_version
) SELECT DISTINCT provider,'metadata','legacy-v1',true,true,1
  FROM public.book_metadata_sources
ON CONFLICT(adapter_key) DO NOTHING;

ALTER TABLE public.canonical_editions
  ADD COLUMN description text,
  ADD COLUMN edition_statement text,
  ADD COLUMN volume text,
  ADD COLUMN format text,
  ADD COLUMN metadata_verified_at timestamptz,
  ADD COLUMN metadata_selection_version text;

ALTER TABLE public.book_metadata_sources
  DROP CONSTRAINT book_metadata_sources_provider_check,
  ADD COLUMN adapter_key text,
  ADD COLUMN adapter_version text,
  ADD COLUMN schema_version text,
  ADD COLUMN request_status text,
  ADD COLUMN match_strength numeric CHECK (match_strength IS NULL OR match_strength BETWEEN 0 AND 1),
  ADD COLUMN match_rationale text,
  ADD COLUMN reuse_policy_version integer CHECK (reuse_policy_version IS NULL OR reuse_policy_version>0),
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN raw_delete_after timestamptz;
UPDATE public.book_metadata_sources SET adapter_key=provider WHERE adapter_key IS NULL;
ALTER TABLE public.book_metadata_sources
  ADD CONSTRAINT book_metadata_sources_adapter_fk FOREIGN KEY(adapter_key)
    REFERENCES public.phase9_provider_registry(adapter_key);

CREATE TABLE public.book_search_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  inventory_id uuid REFERENCES public.store_inventory(id),
  alias_text text NOT NULL CHECK (char_length(alias_text) BETWEEN 1 AND 300),
  alias_normalized text NOT NULL CHECK (char_length(alias_normalized) BETWEEN 1 AND 300),
  alias_language text NOT NULL CHECK (char_length(alias_language) BETWEEN 2 AND 35),
  alias_script text,
  alias_type text NOT NULL CHECK (alias_type IN
    ('transliteration','translation','common_spelling','recognized_title')),
  source_type text NOT NULL CHECK (source_type IN
    ('automated','provider_official','owner_verified','platform_verified')),
  source_ref text NOT NULL CHECK (char_length(source_ref) BETWEEN 1 AND 200),
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  approval_status text NOT NULL DEFAULT 'proposed'
    CHECK (approval_status IN ('proposed','approved','rejected')),
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT book_search_aliases_exact_target CHECK (
    (canonical_edition_id IS NOT NULL AND inventory_id IS NULL AND store_id IS NULL)
    OR (canonical_edition_id IS NULL AND inventory_id IS NOT NULL AND store_id IS NOT NULL)
  ),
  CONSTRAINT book_search_aliases_approval_coherence CHECK (
    (approval_status='approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
    OR approval_status<>'approved'
  )
);
CREATE UNIQUE INDEX book_search_aliases_target_text_unique
  ON public.book_search_aliases(
    coalesce(canonical_edition_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(inventory_id,'00000000-0000-0000-0000-000000000000'::uuid),alias_normalized,source_type
  );
CREATE INDEX book_search_aliases_inventory_idx ON public.book_search_aliases(inventory_id)
  WHERE inventory_id IS NOT NULL;
CREATE INDEX book_search_aliases_approved_lookup_idx
  ON public.book_search_aliases(alias_normalized,store_id) WHERE approval_status='approved';

CREATE FUNCTION marketplace_sec.validate_phase9_alias_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.inventory_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.store_inventory i WHERE i.id=NEW.inventory_id AND i.store_id=NEW.store_id
  ) THEN RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED'; END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER phase9_alias_tenant_guard BEFORE INSERT OR UPDATE OF inventory_id,store_id
ON public.book_search_aliases FOR EACH ROW EXECUTE FUNCTION marketplace_sec.validate_phase9_alias_tenant();

ALTER TABLE public.store_inventory
  ADD COLUMN language text,
  ADD COLUMN description text,
  ADD COLUMN edition_statement text,
  ADD COLUMN volume text,
  ADD COLUMN format text,
  ADD COLUMN has_damage boolean NOT NULL DEFAULT false,
  ADD COLUMN damage_notes text,
  ADD COLUMN damage_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN is_sellable boolean NOT NULL DEFAULT true,
  ADD COLUMN last_verified_at timestamptz,
  ADD COLUMN acquisition_type text,
  ADD COLUMN cost_basis_method text,
  ADD COLUMN printed_mrp_minor integer CHECK (printed_mrp_minor IS NULL OR printed_mrp_minor>=0),
  ADD COLUMN metadata_snapshot_version text,
  ADD COLUMN created_from_candidate_id uuid,
  ADD COLUMN created_by uuid,
  ADD COLUMN publication_status text NOT NULL DEFAULT 'private'
    CHECK (publication_status IN ('private','publication_pending','published','publication_failed')),
  ADD COLUMN publication_intent_version integer NOT NULL DEFAULT 1 CHECK (publication_intent_version>0),
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version>0);

ALTER TABLE public.marketplace_book_listings
  ADD COLUMN language text,
  ADD COLUMN public_description text,
  ADD COLUMN edition_statement text,
  ADD COLUMN volume text,
  ADD COLUMN format text,
  ADD COLUMN has_damage boolean NOT NULL DEFAULT false,
  ADD COLUMN public_damage_notes text,
  ADD COLUMN damage_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN primary_public_media_id uuid,
  ADD COLUMN public_media_count smallint NOT NULL DEFAULT 0 CHECK (public_media_count BETWEEN 0 AND 3),
  ADD COLUMN last_inventory_verified_bucket text,
  ADD COLUMN search_document tsvector;

CREATE INDEX canonical_editions_work_id_idx ON public.canonical_editions(work_id);
CREATE INDEX book_metadata_sources_canonical_edition_idx
  ON public.book_metadata_sources(canonical_edition_id);
CREATE INDEX store_inventory_canonical_edition_idx ON public.store_inventory(canonical_edition_id);
CREATE INDEX store_inventory_metadata_source_idx ON public.store_inventory(source_book_id);
CREATE INDEX marketplace_book_listings_canonical_edition_idx
  ON public.marketplace_book_listings(canonical_edition_id);

ALTER TABLE public.phase9_provider_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_search_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase9_provider_registry,public.book_search_aliases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.phase9_provider_registry,public.book_search_aliases TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.validate_phase9_alias_tenant() FROM PUBLIC,anon,authenticated;

COMMIT;
