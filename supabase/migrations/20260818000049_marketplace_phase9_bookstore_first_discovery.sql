-- Phase 9 Unit 8B: Bookstore-first discovery backend (Q07/Q08) — CORRECTED
-- Authority: 08-marketplace-bookstore-first-sdd.md frozen 2026-08-20, DOC-0/3/5, Unit 5C Lite, Unit 7A/7B/7C, WU0B Q07-Q10.
-- Scope: Q07 internal matching, title/group identity, store grouping, matched-title selection,
-- truthful offer aggregation, counts, deterministic ranking, encrypted cursor, safe DTO, minimal grants.
-- This migration is repository-only and MUST NOT be applied to connected Supabase until
-- the parked migration-history mismatch is reconciled via separately authorized prerequisite.
-- No new business table is introduced. Existing v2 search/detail and legacy store-search RPC remain unchanged.

BEGIN;

-- ================================================================
-- Prerequisite fail-closed: production must have real upstream objects
-- Do NOT silently create substitutes. If any required object is missing,
-- the migration fails with a clear prerequisite error.
-- ================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='pgp_sym_encrypt' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'MISSING_PREREQ extensions.pgp_sym_encrypt missing - pgcrypto in extensions schema is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='pgp_sym_decrypt' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'MISSING_PREREQ extensions.pgp_sym_decrypt missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='digest' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'MISSING_PREREQ extensions.digest missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='public_store_profiles') THEN
    RAISE EXCEPTION 'MISSING_PREREQ public.public_store_profiles is required - upstream Phase 9 schema must exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='phase9_variant_compare_key' AND n.nspname='marketplace_sec') THEN
    RAISE EXCEPTION 'MISSING_PREREQ marketplace_sec.phase9_variant_compare_key is required for NFKC normalization';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='phase9_metadata_normalized_isbn13' AND n.nspname='marketplace_sec') THEN
    RAISE EXCEPTION 'MISSING_PREREQ marketplace_sec.phase9_metadata_normalized_isbn13 is required for ISBN checksum validation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='phase9_publication_ineligibility' AND n.nspname='marketplace_sec') THEN
    RAISE EXCEPTION 'MISSING_PREREQ marketplace_sec.phase9_publication_ineligibility is required for eligibility reuse';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='phase9_store_publication_ineligibility' AND n.nspname='marketplace_sec') THEN
    RAISE EXCEPTION 'MISSING_PREREQ marketplace_sec.phase9_store_publication_ineligibility is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='phase9_public_media_eligible' AND n.nspname='marketplace_sec') THEN
    RAISE EXCEPTION 'MISSING_PREREQ marketplace_sec.phase9_public_media_eligible is required for approved actual-copy cover provenance';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name='vault') THEN
    RAISE EXCEPTION 'MISSING_PREREQ vault schema is required for cursor secret';
  END IF;
END $$;

-- ================================================================
-- Helpers: normalization (reuse Unit 5C NFKC authority), ISBN, ranks
-- ================================================================

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_normalize(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT marketplace_sec.phase9_variant_compare_key(p_text)
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_normalize_isbn(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT upper(regexp_replace(coalesce(p_text,''), '[-[:space:]]', '', 'g'))
$$;

-- Checksum-valid ISBN using authoritative metadata normalizer; true only when checksum passes
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_is_valid_isbn(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT marketplace_sec.phase9_metadata_normalized_isbn13(p_text) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_condition_rank(p_condition text)
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT CASE p_condition
    WHEN 'new' THEN 0
    WHEN 'like_new' THEN 1
    WHEN 'very_good' THEN 2
    WHEN 'good' THEN 3
    WHEN 'acceptable' THEN 4
    ELSE 5 END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_availability_rank(p_availability text)
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT CASE p_availability
    WHEN 'available' THEN 0
    WHEN 'low_stock' THEN 1
    WHEN 'confirmation_required' THEN 2
    ELSE 3 END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_title_group_key(p_listing public.marketplace_book_listings)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT CASE
    WHEN p_listing.canonical_edition_id IS NOT NULL THEN 'edition:'||p_listing.canonical_edition_id::text
    WHEN coalesce(marketplace_sec.phase9_metadata_normalized_isbn13(p_listing.isbn_13), marketplace_sec.phase9_metadata_normalized_isbn13(p_listing.isbn_10)) IS NOT NULL
      THEN 'isbn:'||coalesce(marketplace_sec.phase9_metadata_normalized_isbn13(p_listing.isbn_13), marketplace_sec.phase9_metadata_normalized_isbn13(p_listing.isbn_10))
    ELSE 'listing:'||p_listing.id::text END
$$;

-- ================================================================
-- Q07 internal matching (store-scoped, 8 classes, no canonical)
-- Rank: 0 isbn_exact, 1 original_title_author_exact, 2 original_title_exact,
-- 3 original_author_exact, 4 active_title_variant_exact, 5 active_author_variant_exact,
-- 6 original_terms_all, 7 active_variant_terms_all ; NULL = no match
-- Requires authoritative Unit 5C lifecycle for variant classes.
-- ================================================================

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q07_has_active_variant(
  p_listing public.marketplace_book_listings,
  p_normalized_query text,
  p_target_type text
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.phase9_search_variant_proposals p
    WHERE p.store_id = p_listing.store_id
      AND p.inventory_id = p_listing.inventory_id
      AND p.status='active' AND p.search_eligible
      AND p.target_type = p_target_type
      AND marketplace_sec.phase9_variant_compare_key(p.variant_normalized) = p_normalized_query
   ) OR EXISTS(
    SELECT 1 FROM public.phase9_search_variant_alias_links link
    JOIN public.phase9_search_variant_proposals p ON p.id=link.proposal_id AND p.status='active' AND p.search_eligible AND p.target_type = p_target_type
    JOIN public.book_search_aliases a ON a.id=link.alias_id
    WHERE link.store_id = p_listing.store_id
      AND link.inventory_id = p_listing.inventory_id
      AND link.retracted_at IS NULL
      AND a.store_id = p_listing.store_id
      AND a.inventory_id = p_listing.inventory_id
      AND a.approval_status='approved'
      AND marketplace_sec.phase9_variant_compare_key(a.alias_normalized) = p_normalized_query
   )
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q07_match_class(
  p_query text,
  p_listing public.marketplace_book_listings
) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_nq text := marketplace_sec.phase9_variant_compare_key(p_query);
  v_q_isbn13 text := marketplace_sec.phase9_metadata_normalized_isbn13(p_query);
  v_title_norm text;
  v_title_author_norm text;
  v_author_title_norm text;
  v_terms text[];
  v_title_author_tokens text[];
  v_all_terms_match boolean;
  term text;
  v_author text;
BEGIN
  IF v_nq IS NULL OR char_length(v_nq)=0 THEN RETURN NULL; END IF;

  -- 0 isbn_exact : checksum-valid ISBN equality using canonical normalized form
  IF v_q_isbn13 IS NOT NULL THEN
    IF marketplace_sec.phase9_metadata_normalized_isbn13(p_listing.isbn_10) = v_q_isbn13
       OR marketplace_sec.phase9_metadata_normalized_isbn13(p_listing.isbn_13) = v_q_isbn13 THEN
      RETURN 0;
    END IF;
  END IF;

  v_title_norm := marketplace_sec.phase9_variant_compare_key(p_listing.public_title);
  v_title_author_norm := marketplace_sec.phase9_variant_compare_key(coalesce(p_listing.public_title,'')||' '||array_to_string(coalesce(p_listing.public_authors,'{}'::text[]),' '));
  v_author_title_norm := marketplace_sec.phase9_variant_compare_key(array_to_string(coalesce(p_listing.public_authors,'{}'::text[]),' ')||' '||coalesce(p_listing.public_title,''));

  -- 1 original_title_author_exact
  IF v_nq = v_title_author_norm OR v_nq = v_author_title_norm THEN
    RETURN 1;
  END IF;

  -- 2 original_title_exact
  IF v_nq = v_title_norm AND char_length(v_title_norm)>0 THEN
    RETURN 2;
  END IF;

  -- 3 original_author_exact
  IF p_listing.public_authors IS NOT NULL THEN
    FOR v_author IN SELECT unnest(p_listing.public_authors) LOOP
      IF v_nq = marketplace_sec.phase9_variant_compare_key(v_author) THEN
        RETURN 3;
      END IF;
    END LOOP;
  END IF;

  -- 4 active_title_variant_exact (store-scoped, requires active lifecycle)
  IF marketplace_sec.phase9_q07_has_active_variant(p_listing, v_nq, 'title') THEN
    RETURN 4;
  END IF;

  -- 5 active_author_variant_exact
  IF marketplace_sec.phase9_q07_has_active_variant(p_listing, v_nq, 'author') THEN
    RETURN 5;
  END IF;

  -- Prepare tokens for all-terms checks: NFKC normalized then split
  v_terms := regexp_split_to_array(v_nq, ' +');
  SELECT array_agg(t) INTO v_terms FROM unnest(v_terms) t WHERE char_length(t)>0;
  IF v_terms IS NULL OR array_length(v_terms,1)=0 THEN RETURN NULL; END IF;

  -- Token set for original title/author
  v_title_author_tokens := regexp_split_to_array(v_title_author_norm, ' +');
  SELECT array_agg(t) INTO v_title_author_tokens FROM unnest(v_title_author_tokens) t WHERE char_length(t)>0;

  -- 6 original_terms_all : every normalized query token exists as COMPLETE token
  v_all_terms_match := true;
  FOREACH term IN ARRAY v_terms LOOP
    IF NOT (term = ANY(v_title_author_tokens)) THEN
      v_all_terms_match := false; EXIT;
    END IF;
  END LOOP;
  IF v_all_terms_match THEN RETURN 6; END IF;

  -- 7 active_variant_terms_all: every token appears as complete token in some active variant for same listing
  v_all_terms_match := true;
  FOREACH term IN ARRAY v_terms LOOP
    IF NOT EXISTS(
      SELECT 1 FROM public.phase9_search_variant_proposals p
      WHERE p.store_id=p_listing.store_id AND p.inventory_id=p_listing.inventory_id
        AND p.status='active' AND p.search_eligible
        AND term = ANY(regexp_split_to_array(marketplace_sec.phase9_variant_compare_key(p.variant_normalized), ' +'))
      UNION ALL
      SELECT 1 FROM public.phase9_search_variant_alias_links link
      JOIN public.phase9_search_variant_proposals p ON p.id=link.proposal_id AND p.status='active' AND p.search_eligible
      JOIN public.book_search_aliases a ON a.id=link.alias_id
      WHERE link.store_id=p_listing.store_id AND link.inventory_id=p_listing.inventory_id
        AND link.retracted_at IS NULL AND a.store_id=p_listing.store_id AND a.inventory_id=p_listing.inventory_id
        AND a.approval_status='approved'
        AND term = ANY(regexp_split_to_array(marketplace_sec.phase9_variant_compare_key(a.alias_normalized), ' +'))
      LIMIT 1
    ) THEN
      v_all_terms_match := false; EXIT;
    END IF;
  END LOOP;
  IF v_all_terms_match THEN RETURN 7; END IF;

  RETURN NULL;
END
$$;

-- ================================================================
-- Cursor helpers: encrypted self-contained payload via Vault + pgcrypto
-- Production uses extensions schema-qualified pgcrypto; no plaintext fallback
-- ================================================================

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_cursor_secret()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='phase9_q08_cursor_secret' LIMIT 1;
  IF v_secret IS NULL OR char_length(v_secret)<16 THEN
    RAISE EXCEPTION 'P9_CURSOR_SECRET_MISSING';
  END IF;
  RETURN v_secret;
END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_cursor_encrypt(p_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text := marketplace_sec.phase9_q08_cursor_secret();
  v_enc bytea;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
  v_enc := extensions.pgp_sym_encrypt(p_payload::text, v_secret);
  RETURN encode(v_enc, 'base64');
END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_cursor_decrypt(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text := marketplace_sec.phase9_q08_cursor_secret();
  v_raw bytea;
  v_dec text;
  v_json jsonb;
BEGIN
  IF p_token IS NULL OR char_length(p_token)=0 OR char_length(p_token)>8000 THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
  BEGIN
    v_raw := decode(p_token, 'base64');
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END;
  IF v_raw IS NULL OR octet_length(v_raw)=0 THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
  BEGIN
    v_dec := extensions.pgp_sym_decrypt(v_raw, v_secret);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END;
  BEGIN
    v_json := v_dec::jsonb;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END;
  IF jsonb_typeof(v_json)<>'object' THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
  RETURN v_json;
END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_current_policy_version()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT encode(
    extensions.digest(
      coalesce((
        SELECT string_agg(
          concat_ws('|',
            coalesce(policy_key,''),
            coalesce(scope_type,''),
            coalesce(normalized_scope_identity,''),
            coalesce(scope_value,''),
            coalesce(store_id::text,''),
            policy_version::text,
            is_active::text,
            effective_from::text,
            coalesce(effective_to::text,''),
            value::text,
            id::text
          ), E'\n'
          ORDER BY policy_key, scope_type, coalesce(normalized_scope_identity,''),
            coalesce(scope_value,''), coalesce(store_id::text,''), effective_from,
            effective_to, policy_version, id
        )
        FROM public.marketplace_policy_config
        WHERE policy_key IN ('marketplace_enabled','commerce.store_allowlisted')
          AND is_active
          AND effective_from <= transaction_timestamp()
          AND (effective_to IS NULL OR effective_to > transaction_timestamp())
      ), 'phase9-q08-publication-policy-empty-v1'),
      'sha256'
    ), 'hex'
  )
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_q08_actual_copy_cover(p_listing_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT '/storage/v1/object/public/inventory-photos/' || asset.object_path
  FROM public.marketplace_book_listings listing
  JOIN public.inventory_media_links link
    ON link.inventory_id=listing.inventory_id
   AND link.media_asset_id=listing.primary_public_media_id
   AND link.store_id=listing.store_id
  JOIN public.media_assets asset
    ON asset.id=link.media_asset_id
   AND asset.store_id=listing.store_id
  WHERE listing.id=p_listing_id
    AND link.role IN ('actual_copy','primary_fallback')
    AND marketplace_sec.phase9_public_media_eligible(link,asset)
  LIMIT 1
$$;

-- ================================================================
-- Q08 bookstore-first search: public, positive-allowlist DTO, group-before-pagination,
-- deterministic ranking, keyset cursor, store profile source only.
-- Eligibility: current safe publication via authoritative helper reuse.
-- Fulfillment filtering is HARD eligibility BEFORE group selection.
-- ================================================================

CREATE OR REPLACE FUNCTION public.phase9_bookstore_search_v1(
  p_query text,
  p_page_size integer DEFAULT 20,
  p_cursor text DEFAULT NULL,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_locality jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_normalized_query text;
  v_fingerprint text;
  v_cursor_json jsonb;
  v_contract_version text := 'phase9-q08-v1';
  v_ranking_version text := 'phase9-q08-ranking-v1';
  v_projection_version text := 'phase9-public-projection-v1';
  v_policy_version text;
  v_bookstore_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_has_next boolean := false;
  v_next_cursor text := NULL;
  v_last_match integer;
  v_last_avail integer;
  v_last_offer integer;
  v_last_locality integer;
  v_last_fulfillment integer;
  v_last_price integer;
  v_last_cond integer;
  v_last_store uuid;
  v_cursor_provided boolean := p_cursor IS NOT NULL;
  v_pickup_filter boolean;
  v_delivery_filter boolean;
  v_locality_id uuid;
  v_locality_city text;
  v_locality_state text;
BEGIN
  -- Bounded validation before unsafe casts
  IF p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_query IS NULL OR char_length(btrim(p_query))=0 OR char_length(p_query)>200 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_filters IS NOT NULL AND jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_locality IS NOT NULL AND jsonb_typeof(p_locality)<>'object' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_cursor IS NOT NULL AND char_length(p_cursor)>8000 THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;

  -- Validate filters shape: only pickup/delivery booleans allowed, unknown keys fail closed with P9_REQUEST_INVALID
  IF p_filters IS NOT NULL AND p_filters <> '{}'::jsonb THEN
    FOR v_normalized_query IN SELECT jsonb_object_keys(p_filters) LOOP
      IF v_normalized_query NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    END LOOP;
    BEGIN
      IF p_filters ? 'pickup' THEN
        IF jsonb_typeof(p_filters->'pickup') <> 'boolean' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
      END IF;
      IF p_filters ? 'delivery' THEN
        IF jsonb_typeof(p_filters->'delivery') <> 'boolean' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='P9_REQUEST_INVALID' THEN RAISE; END IF;
      RAISE EXCEPTION 'P9_REQUEST_INVALID';
    END;
  END IF;

  -- Validate locality shape
  IF p_locality IS NOT NULL AND p_locality <> 'null'::jsonb THEN
    FOR v_normalized_query IN SELECT jsonb_object_keys(p_locality) LOOP
      IF v_normalized_query NOT IN ('localityId','city','state') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    END LOOP;
    IF p_locality ? 'localityId' AND p_locality->>'localityId' IS NOT NULL THEN
      BEGIN v_locality_id := (p_locality->>'localityId')::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END;
    END IF;
    IF p_locality ? 'city' AND jsonb_typeof(p_locality->'city') <> 'string' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    IF p_locality ? 'state' AND jsonb_typeof(p_locality->'state') <> 'string' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  END IF;

  v_normalized_query := marketplace_sec.phase9_variant_compare_key(p_query);
  IF v_normalized_query IS NULL OR char_length(v_normalized_query)=0 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  -- Extract validated filter booleans
  BEGIN
    v_pickup_filter := coalesce((p_filters->>'pickup')::boolean, false);
    v_delivery_filter := coalesce((p_filters->>'delivery')::boolean, false);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END;

  -- Fingerprint uses extensions.digest with NFKC normalized query; no fallback to avoid drift
  v_fingerprint := encode(extensions.digest(v_normalized_query,'sha256'),'hex');

  -- Current effective policy version binds cursor to eligibility policy changes
  v_policy_version := marketplace_sec.phase9_q08_current_policy_version();

  IF v_cursor_provided THEN
    BEGIN
      v_cursor_json := marketplace_sec.phase9_q08_cursor_decrypt(p_cursor);
      IF (v_cursor_json->>'contractVersion') IS DISTINCT FROM v_contract_version THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF (v_cursor_json->>'rankingVersion') IS DISTINCT FROM v_ranking_version THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF (v_cursor_json->>'projectionVersion') IS DISTINCT FROM v_projection_version THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF v_cursor_json->>'policyVersion' IS DISTINCT FROM v_policy_version THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF (v_cursor_json->>'queryFingerprint') IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF coalesce(v_cursor_json->'filters','{}'::jsonb) IS DISTINCT FROM coalesce(p_filters,'{}'::jsonb) THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF coalesce(v_cursor_json->'locality','null'::jsonb) IS DISTINCT FROM coalesce(p_locality,'null'::jsonb) THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      IF (v_cursor_json->>'pageSize')::integer IS DISTINCT FROM p_page_size THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      v_last_match := (v_cursor_json->>'lastMatchClassRank')::integer;
      v_last_avail := (v_cursor_json->>'lastBestAvailabilityRank')::integer;
      v_last_offer := (v_cursor_json->>'lastOfferCount')::integer;
      v_last_locality := (v_cursor_json->>'lastLocalityRank')::integer;
      v_last_fulfillment := (v_cursor_json->>'lastFulfillmentRank')::integer;
      v_last_price := (v_cursor_json->>'lastLowestPrice')::integer;
      v_last_cond := (v_cursor_json->>'lastBestConditionRank')::integer;
      v_last_store := (v_cursor_json->>'lastStoreId')::uuid;
      IF v_last_match IS NULL OR v_last_avail IS NULL OR v_last_offer IS NULL OR v_last_locality IS NULL OR v_last_fulfillment IS NULL OR v_last_price IS NULL OR v_last_cond IS NULL OR v_last_store IS NULL THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM IN ('P9_CURSOR_INVALID','P9_CURSOR_SECRET_MISSING') THEN RAISE; END IF;
      RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  END IF;

  -- Compute bookstoreCount and paginated items in one transaction-consistent snapshot
  WITH eligible_listings AS (
    SELECT l.*
    FROM public.marketplace_book_listings l
    JOIN public.store_inventory i ON i.id = l.inventory_id AND i.store_id = l.store_id
    WHERE l.status='active'
      AND l.availability_status<>'unavailable'
      AND l.moderation_status='approved'
      AND l.listing_quality_status='ready'
      AND i.visibility_status='published'
      AND i.publication_status='published'
      AND NOT EXISTS (
        SELECT 1 FROM public.listing_moderation_flags f
        WHERE f.listing_id=l.id AND f.status IN ('open','under_review')
      )
      AND marketplace_sec.phase9_store_publication_ineligibility(l.store_id,false) IS NULL
      AND marketplace_sec.phase9_publication_ineligibility(i) IS NULL
  ),
  q07 AS (
    SELECT el.*,
           marketplace_sec.phase9_q07_match_class(p_query, el) AS match_rank,
           marketplace_sec.phase9_title_group_key(el) AS group_key,
           marketplace_sec.phase9_q08_condition_rank(el.condition) AS cond_rank,
           marketplace_sec.phase9_q08_availability_rank(el.availability_status) AS avail_rank
    FROM eligible_listings el
  ),
  q07_with_provenance AS (
    SELECT q07.*, NULLIF(btrim(i.cover_url),'') AS provider_cover_source
    FROM q07
    JOIN public.store_inventory i ON i.id=q07.inventory_id AND i.store_id=q07.store_id
  ),
  -- Fulfillment is HARD eligibility BEFORE grouping: filter offers not matching requested modes
  q07_filtered AS (
    SELECT * FROM q07_with_provenance
    WHERE match_rank IS NOT NULL
      AND (
        (NOT v_pickup_filter OR 'pickup' = ANY(fulfillment_options))
        AND (NOT v_delivery_filter OR 'delivery' = ANY(fulfillment_options))
      )
  ),
  store_group AS (
    SELECT
      store_id,
      group_key,
      min(match_rank) AS best_match_rank,
      count(DISTINCT id) AS offer_count,
      min(selling_price_minor) AS lowest_price,
      min(cond_rank) AS best_cond_rank,
      max(cond_rank) AS worst_cond_rank,
      bool_or(has_damage) AS has_damaged,
      bool_or(NOT has_damage) AS has_undamaged,
      count(DISTINCT id) FILTER (WHERE 'pickup' = ANY(fulfillment_options)) AS pickup_cnt,
      count(DISTINCT id) FILTER (WHERE 'delivery' = ANY(fulfillment_options)) AS delivery_cnt,
      min(avail_rank) AS best_avail_rank,
      -- representative fields for display: deterministic cheapest->best condition->undamaged->id
      (array_agg(public_title ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1] AS rep_title,
      ((array_agg(public_authors::text ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1])::text[] AS rep_authors,
      (array_agg(language ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1] AS rep_language,
      (array_agg(isbn_13 ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1] AS rep_isbn13,
      (array_agg(isbn_10 ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1] AS rep_isbn10,
      -- Group-level cover precedence: 1) upstream provider/canonical source, 2) approved representative actual-copy, 3) placeholder
      (array_agg(provider_cover_source ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC) FILTER (WHERE provider_cover_source IS NOT NULL))[1] AS provider_cover,
      (array_agg(marketplace_sec.phase9_q08_actual_copy_cover(id) ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1] AS rep_cover,
      (array_agg(id ORDER BY selling_price_minor ASC, cond_rank ASC, has_damage ASC, id ASC))[1] AS rep_listing_id
    FROM q07_filtered
    GROUP BY store_id, group_key
  ),
  -- For each store, pick best group deterministically by Q07 match then availability then offerCount etc
  ranked_per_store AS (
    SELECT sg.*, row_number() OVER (PARTITION BY store_id ORDER BY best_match_rank ASC, best_avail_rank ASC, offer_count DESC, lowest_price ASC, best_cond_rank ASC, group_key ASC) AS rn
    FROM store_group sg
  ),
  selected_group AS (
    SELECT * FROM ranked_per_store WHERE rn=1
  ),
  -- Enrich with public store profile and compute locality/fulfillment ranks
  with_profile AS (
    SELECT
      sg.*,
      psp.display_name, psp.logo_url, psp.city, psp.state, psp.locality_id, psp.locality_name, psp.pickup_enabled, psp.delivery_enabled, psp.return_policy_type,
      CASE
        WHEN p_locality IS NULL OR p_locality = 'null'::jsonb THEN 0
        WHEN (p_locality->>'localityId') IS NOT NULL AND (p_locality->>'localityId')::uuid = psp.locality_id THEN 0
        WHEN lower(coalesce(p_locality->>'city','')) = lower(coalesce(psp.city,'')) AND coalesce(p_locality->>'city','')<>'' THEN 1
        WHEN lower(coalesce(p_locality->>'state','')) = lower(coalesce(psp.state,'')) AND coalesce(p_locality->>'state','')<>'' THEN 2
        ELSE 3 END AS locality_rank,
      0 AS fulfillment_rank
    FROM selected_group sg
    JOIN public.public_store_profiles psp ON psp.store_id = sg.store_id
  ),
  -- Total after fulfillment-eligible grouping (no second hard filter needed, but keep for safety)
  total_count AS (
    SELECT count(*)::int AS cnt FROM with_profile
  ),
  -- Apply keyset predicate for pagination
  keyed AS (
    SELECT fp.*,
      row_number() OVER (ORDER BY best_match_rank ASC, best_avail_rank ASC, offer_count DESC, locality_rank ASC, fulfillment_rank ASC, lowest_price ASC, best_cond_rank ASC, store_id ASC) AS order_rn
    FROM with_profile fp
    WHERE NOT v_cursor_provided
       OR (
         best_match_rank > v_last_match
         OR (best_match_rank = v_last_match AND best_avail_rank > v_last_avail)
         OR (best_match_rank = v_last_match AND best_avail_rank = v_last_avail AND offer_count < v_last_offer)
         OR (best_match_rank = v_last_match AND best_avail_rank = v_last_avail AND offer_count = v_last_offer AND locality_rank > v_last_locality)
         OR (best_match_rank = v_last_match AND best_avail_rank = v_last_avail AND offer_count = v_last_offer AND locality_rank = v_last_locality AND fulfillment_rank > v_last_fulfillment)
         OR (best_match_rank = v_last_match AND best_avail_rank = v_last_avail AND offer_count = v_last_offer AND locality_rank = v_last_locality AND fulfillment_rank = v_last_fulfillment AND lowest_price > v_last_price)
         OR (best_match_rank = v_last_match AND best_avail_rank = v_last_avail AND offer_count = v_last_offer AND locality_rank = v_last_locality AND fulfillment_rank = v_last_fulfillment AND lowest_price = v_last_price AND best_cond_rank > v_last_cond)
         OR (best_match_rank = v_last_match AND best_avail_rank = v_last_avail AND offer_count = v_last_offer AND locality_rank = v_last_locality AND fulfillment_rank = v_last_fulfillment AND lowest_price = v_last_price AND best_cond_rank = v_last_cond AND store_id > v_last_store)
       )
  ),
  ordered AS (
    SELECT * FROM keyed ORDER BY best_match_rank ASC, best_avail_rank ASC, offer_count DESC, locality_rank ASC, fulfillment_rank ASC, lowest_price ASC, best_cond_rank ASC, store_id ASC
  ),
  limited AS (
    SELECT * FROM ordered LIMIT p_page_size+1
  ),
  paginated AS (
    SELECT * FROM limited ORDER BY best_match_rank ASC, best_avail_rank ASC, offer_count DESC, locality_rank ASC, fulfillment_rank ASC, lowest_price ASC, best_cond_rank ASC, store_id ASC LIMIT p_page_size
  ),
  last_row AS (
    SELECT * FROM paginated ORDER BY best_match_rank ASC, best_avail_rank ASC, offer_count DESC, locality_rank ASC, fulfillment_rank ASC, lowest_price ASC, best_cond_rank ASC, store_id ASC OFFSET (SELECT greatest(count(*)-1,0) FROM paginated) LIMIT 1
  )
  SELECT
    (SELECT cnt FROM total_count),
    (SELECT count(*)::int FROM limited) > p_page_size,
    (SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'store', jsonb_build_object(
          'publicStoreId', store_id,
          'displayName', display_name,
          'logo', logo_url,
          'locality', locality_name,
          'city', city,
          'state', state,
          'pickup', pickup_enabled,
          'delivery', delivery_enabled,
          'returnPolicy', return_policy_type
        ),
        'matchedBook', jsonb_build_object(
          'originalTitle', rep_title,
          'authors', coalesce(rep_authors::text[], ARRAY[]::text[]),
          'language', rep_language,
          'publicIsbn', coalesce(rep_isbn13, rep_isbn10),
          'cover', coalesce(provider_cover, rep_cover, '/placeholder.png'),
          'boundedMatchKind', CASE best_match_rank
            WHEN 0 THEN 'isbn_exact'
            WHEN 1 THEN 'original_title_author_exact'
            WHEN 2 THEN 'original_title_exact'
            WHEN 3 THEN 'original_author_exact'
            WHEN 4 THEN 'active_title_variant_exact'
            WHEN 5 THEN 'active_author_variant_exact'
            WHEN 6 THEN 'original_terms_all'
            WHEN 7 THEN 'active_variant_terms_all'
            ELSE 'unknown' END
        ),
        'offerSummary', jsonb_build_object(
          'offerCount', offer_count,
          'lowestPriceMinor', lowest_price,
          'currency', 'INR',
          'conditionSummary', jsonb_build_object(
            'best', CASE best_cond_rank WHEN 0 THEN 'new' WHEN 1 THEN 'like_new' WHEN 2 THEN 'very_good' WHEN 3 THEN 'good' WHEN 4 THEN 'acceptable' ELSE 'unknown' END,
            'worst', CASE worst_cond_rank WHEN 0 THEN 'new' WHEN 1 THEN 'like_new' WHEN 2 THEN 'very_good' WHEN 3 THEN 'good' WHEN 4 THEN 'acceptable' ELSE 'unknown' END,
            'distinct', (
              SELECT coalesce(jsonb_agg(c ORDER BY marketplace_sec.phase9_q08_condition_rank(c)), '[]'::jsonb)
              FROM (SELECT DISTINCT unnest(
                (SELECT array_agg(condition) FROM q07_filtered q2 WHERE q2.store_id=paginated.store_id AND q2.group_key=paginated.group_key)
              ) AS c) t WHERE c IN ('new','like_new','very_good','good','acceptable')
            )
          ),
          'damageSummary', jsonb_build_object('hasUndamagedOffers', has_undamaged, 'hasDamagedOffers', has_damaged),
          'fulfillmentSummary', jsonb_build_object('pickupOfferCount', pickup_cnt, 'deliveryOfferCount', delivery_cnt),
          'availabilityBand', CASE best_avail_rank WHEN 0 THEN 'available' WHEN 1 THEN 'low_stock' WHEN 2 THEN 'confirmation_required' ELSE 'available' END,
          'confirmationBeforePayment', true
        )
      ) ORDER BY best_match_rank ASC, best_avail_rank ASC, offer_count DESC, locality_rank ASC, fulfillment_rank ASC, lowest_price ASC, best_cond_rank ASC, store_id ASC
    ), '[]'::jsonb) FROM paginated),
    (SELECT CASE WHEN (SELECT count(*)::int FROM limited) > p_page_size THEN
      jsonb_build_object(
        'contractVersion', v_contract_version,
        'rankingVersion', v_ranking_version,
        'projectionVersion', v_projection_version,
        'policyVersion', v_policy_version,
        'queryFingerprint', v_fingerprint,
        'filters', coalesce(p_filters,'{}'::jsonb),
        'locality', coalesce(p_locality,'null'::jsonb),
        'pageSize', p_page_size,
        'lastMatchClassRank', best_match_rank,
        'lastBestAvailabilityRank', best_avail_rank,
        'lastOfferCount', offer_count,
        'lastLocalityRank', locality_rank,
        'lastFulfillmentRank', fulfillment_rank,
        'lastLowestPrice', lowest_price,
        'lastBestConditionRank', best_cond_rank,
        'lastStoreId', store_id
      ) END FROM last_row)
  INTO v_bookstore_count, v_has_next, v_items, v_cursor_json;

  -- Build nextCursor token if needed: last_row already is last paginated row
  IF v_has_next AND v_cursor_json IS NOT NULL THEN
    v_next_cursor := marketplace_sec.phase9_q08_cursor_encrypt(v_cursor_json);
  ELSE
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'contractVersion', v_contract_version,
    'rankingVersion', v_ranking_version,
    'bookstoreCount', coalesce(v_bookstore_count,0),
    'items', coalesce(v_items,'[]'::jsonb),
    'pageInfo', jsonb_build_object('nextCursor', v_next_cursor, 'hasNextPage', coalesce(v_has_next,false))
  );
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IN ('P9_CURSOR_INVALID','P9_CURSOR_SECRET_MISSING','P9_REQUEST_INVALID') THEN RAISE; END IF;
  -- Any other error is surfaced boundedly without leaking SQL internals
  IF SQLERRM LIKE 'MISSING_PREREQ%' THEN RAISE; END IF;
  RAISE EXCEPTION 'P9_REQUEST_INVALID';
END
$$;

-- Grants: Q07 internal denied for anon/authenticated, Q08 public allowlist
REVOKE ALL ON FUNCTION marketplace_sec.phase9_q07_match_class(text, public.marketplace_book_listings) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q07_match_class(text, public.marketplace_book_listings) TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q07_has_active_variant(public.marketplace_book_listings, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q07_has_active_variant(public.marketplace_book_listings, text, text) TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_normalize(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_normalize(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_normalize_isbn(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_normalize_isbn(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_is_valid_isbn(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_is_valid_isbn(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_condition_rank(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_condition_rank(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_availability_rank(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_availability_rank(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_title_group_key(public.marketplace_book_listings) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_title_group_key(public.marketplace_book_listings) TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_cursor_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_cursor_secret() TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_cursor_encrypt(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_cursor_encrypt(jsonb) TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_cursor_decrypt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_cursor_decrypt(text) TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_current_policy_version() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_current_policy_version() TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_q08_actual_copy_cover(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_q08_actual_copy_cover(uuid) TO service_role;

-- Q08 public: revoke PUBLIC then allow anon/authenticated/service_role per safe Marketplace convention
REVOKE ALL ON FUNCTION public.phase9_bookstore_search_v1(text, integer, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.phase9_bookstore_search_v1(text, integer, text, jsonb, jsonb) TO anon, authenticated, service_role;

ALTER FUNCTION marketplace_sec.phase9_q07_match_class(text, public.marketplace_book_listings) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q07_has_active_variant(public.marketplace_book_listings, text, text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_normalize(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_normalize_isbn(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_is_valid_isbn(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_condition_rank(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_availability_rank(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_title_group_key(public.marketplace_book_listings) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_cursor_secret() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_cursor_encrypt(jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_cursor_decrypt(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_current_policy_version() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_actual_copy_cover(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_bookstore_search_v1(text, integer, text, jsonb, jsonb) OWNER TO postgres;

-- Do not mutate v2 functions, keep them as is
-- Ensure legacy RPC remains unchanged (no REVOKE)
-- Leave public_store_profiles already accessible (no creation here)

COMMIT;
