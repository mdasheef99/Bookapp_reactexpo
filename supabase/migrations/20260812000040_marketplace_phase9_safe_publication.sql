-- Phase 9 Unit 7B: safe public projection and controlled publication.
-- Forward-only reconciliation of M03/M05/M07/M29/M31/M36/M37.
BEGIN;

ALTER TABLE public.image_extraction_jobs
  ADD COLUMN lease_token uuid;

ALTER TABLE public.phase9_upload_capabilities
  ADD COLUMN public_copy_role text,
  ADD CONSTRAINT phase9_capability_public_copy_role_check CHECK (
    public_copy_role IS NULL OR public_copy_role IN ('damage','actual_copy','primary_fallback')
  );

ALTER TABLE public.media_assets
  DROP CONSTRAINT media_assets_purpose_privacy_check,
  ADD CONSTRAINT media_assets_purpose_privacy_check CHECK (
    (purpose='scan_input' AND privacy_class='private_scan') OR
    (purpose='public_copy' AND (
      (privacy_class='private_scan' AND bucket_id='marketplace-media-staging') OR
      (privacy_class='public' AND bucket_id='inventory-photos')
    )) OR
    (purpose='customer_request' AND privacy_class='private_request') OR
    (purpose='dispute_evidence' AND privacy_class='restricted')
  );

ALTER TABLE public.marketplace_book_listings
  ADD COLUMN IF NOT EXISTS store_locality_id uuid REFERENCES public.marketplace_localities(id),
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX inventory_media_one_primary_fallback_idx
  ON public.inventory_media_links(inventory_id)
  WHERE role='primary_fallback';

CREATE INDEX image_extraction_publication_claim_idx
  ON public.image_extraction_jobs(next_attempt_at,id)
  WHERE job_kind='publication_retry'
    AND status IN ('open','retry_scheduled','in_progress');

CREATE OR REPLACE FUNCTION marketplace_sec.validate_inventory_media_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_asset public.media_assets; v_inventory public.store_inventory;
BEGIN
  SELECT * INTO v_asset FROM public.media_assets WHERE id=NEW.media_asset_id;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=NEW.inventory_id;
  IF v_asset.id IS NULL OR v_inventory.id IS NULL
    OR v_asset.store_id<>NEW.store_id OR v_inventory.store_id<>NEW.store_id
    OR v_asset.purpose<>'public_copy' OR v_asset.privacy_class<>'public'
    OR v_asset.bucket_id<>'inventory-photos'
    OR v_asset.lifecycle_status NOT IN ('approved','linked')
    OR v_asset.validation_version IS NULL OR v_asset.reencode_version IS NULL
    OR v_asset.exif_strip_version IS NULL
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  IF NEW.role='primary_fallback' AND NEW.approval_status<>'approved' THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED';
  END IF;
  RETURN NEW;
END$$;


CREATE FUNCTION public.phase9_owner_inventory_page_v2(
  p_page_size integer DEFAULT 25,p_cursor text DEFAULT NULL,p_query text DEFAULT NULL,
  p_condition text DEFAULT NULL,p_visibility_status text DEFAULT NULL,
  p_quantity_state text DEFAULT NULL,p_entry_method text DEFAULT NULL,
  p_date_added text DEFAULT NULL,p_publication_status text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_query text:=lower(btrim(coalesce(p_query,'')));
  v_condition text:=coalesce(nullif(btrim(p_condition),''),'all');
  v_visibility text:=coalesce(nullif(btrim(p_visibility_status),''),'all');
  v_quantity text:=coalesce(nullif(btrim(p_quantity_state),''),'all');
  v_entry text:=coalesce(nullif(btrim(p_entry_method),''),'all');
  v_date text:=coalesce(nullif(btrim(p_date_added),''),'all');
  v_publication text:=coalesce(nullif(btrim(p_publication_status),''),'all');
  v_payload jsonb; v_as_of timestamptz:=transaction_timestamp();
  v_after_updated timestamptz; v_after_id uuid; v_items jsonb;
  v_more boolean; v_next text;
BEGIN
  v_store:=marketplace_sec.phase9_owner_ux_assert_owner();
  IF p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50 OR char_length(v_query)>100
    OR v_condition NOT IN ('all','new','like_new','very_good','good','acceptable')
    OR v_visibility NOT IN ('all','draft','needs_review','published','paused','out_of_stock','blocked')
    OR v_quantity NOT IN ('all','available','low_stock','out_of_stock')
    OR v_entry NOT IN ('all','manual','image_extraction','metadata_import')
    OR v_date NOT IN ('all','last_7_days','last_30_days')
    OR v_publication NOT IN ('all','private','published','paused','publication_failed')
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_cursor IS NOT NULL THEN
    v_payload:=marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor);
    IF v_payload->>'contract'<>'phase9-owner-inventory-v2'
      OR v_payload->>'actor'<>auth.uid()::text OR v_payload->>'store'<>v_store::text
      OR v_payload->>'query'<>v_query OR v_payload->>'condition'<>v_condition
      OR v_payload->>'visibility'<>v_visibility OR v_payload->>'quantity'<>v_quantity
      OR v_payload->>'entry'<>v_entry OR v_payload->>'dateAdded'<>v_date
      OR v_payload->>'publication'<>v_publication
    THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
    BEGIN v_as_of:=(v_payload->>'asOf')::timestamptz;
      v_after_updated:=(v_payload->>'updatedAt')::timestamptz;
      v_after_id:=(v_payload->>'id')::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END;
  END IF;
  WITH eligible AS (
    SELECT i.*,(SELECT l.status FROM public.marketplace_book_listings l
      WHERE l.inventory_id=i.id) AS listing_status
    FROM public.store_inventory i WHERE i.store_id=v_store AND i.updated_at<=v_as_of
      AND (p_cursor IS NULL OR (i.updated_at,i.id)<(v_after_updated,v_after_id))
      AND (v_query='' OR position(v_query in lower(i.title))>0
        OR position(v_query in lower(coalesce(i.isbn_10,'')))>0
        OR position(v_query in lower(coalesce(i.isbn_13,'')))>0
        OR EXISTS(SELECT 1 FROM unnest(coalesce(i.authors,'{}')) a
          WHERE position(v_query in lower(a))>0))
      AND (v_condition='all' OR i.condition=v_condition)
      AND (v_visibility='all' OR i.visibility_status=v_visibility)
      AND (v_quantity='all' OR (v_quantity='available' AND i.quantity_available>1)
        OR (v_quantity='low_stock' AND i.quantity_available=1)
        OR (v_quantity='out_of_stock' AND i.quantity_available=0))
      AND (v_entry='all' OR i.entry_method=v_entry)
      AND (v_date='all' OR (v_date='last_7_days' AND i.created_at>=v_as_of-interval '7 days')
        OR (v_date='last_30_days' AND i.created_at>=v_as_of-interval '30 days'))
      AND (v_publication='all'
        OR (v_publication='paused' AND i.visibility_status='paused')
        OR (v_publication='private' AND i.publication_status='private' AND i.visibility_status<>'paused')
        OR (v_publication='published' AND i.publication_status='published')
        OR (v_publication='publication_failed' AND i.publication_status='publication_failed'))
  ), page AS (SELECT * FROM eligible ORDER BY updated_at DESC,id DESC LIMIT p_page_size+1),
  sliced AS (SELECT * FROM page ORDER BY updated_at DESC,id DESC LIMIT p_page_size)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'title',s.title,'authors',s.authors,'isbn10',s.isbn_10,'isbn13',s.isbn_13,
      'condition',s.condition,'quantityAvailable',s.quantity_available,
      'sellingPriceMinor',s.selling_price_minor,'visibilityStatus',s.visibility_status,
      'listingQualityStatus',s.listing_quality_status,'publicNotes',s.public_notes,
      'entryMethod',s.entry_method,'createdAt',s.created_at,'updatedAt',s.updated_at,
      'inventoryVersion',s.version,'publicationStatus',s.publication_status,
      'publicationIntentVersion',s.publication_intent_version,
      'publicationRetryable',s.publication_status='publication_failed',
      'publicationFailureReason',CASE WHEN s.publication_status='publication_failed'
        THEN 'projection_temporarily_unavailable' END,
      'publicListingStatus',s.listing_status
    ) ORDER BY s.updated_at DESC,s.id DESC),'[]'::jsonb),
    (SELECT count(*)>p_page_size FROM page),
    (SELECT marketplace_sec.phase9_owner_ux_cursor(jsonb_build_object(
      'contract','phase9-owner-inventory-v2','actor',auth.uid(),'store',v_store,
      'query',v_query,'condition',v_condition,'visibility',v_visibility,
      'quantity',v_quantity,'entry',v_entry,'dateAdded',v_date,
      'publication',v_publication,'asOf',v_as_of::text,
      'updatedAt',s.updated_at::text,'id',s.id))
      FROM sliced s ORDER BY s.updated_at ASC,s.id ASC LIMIT 1)
  INTO v_items,v_more,v_next FROM sliced s;
  IF NOT v_more THEN v_next:=NULL; END IF;
  RETURN jsonb_build_object('contractVersion','phase9-owner-inventory-v2',
    'items',v_items,'pageInfo',jsonb_build_object('nextCursor',v_next,'hasMore',v_more));
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM=ANY(ARRAY['P9_AUTH_REQUIRED','P9_OWNER_NOT_AUTHORIZED',
    'P9_REQUEST_INVALID','P9_CURSOR_INVALID','P9_INTERNAL_ERROR']) THEN RAISE; END IF;
  RAISE EXCEPTION 'P9_INTERNAL_ERROR';
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_close_summary(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'imagesSubmitted',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id),
    'imagesProcessed',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='ready'),
    'imagesFailed',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='failed'),
    'imagesSkipped',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='skipped'),
    'candidatesDetected',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id),
    'candidatesReviewReady',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.review_ready),
    'candidatesNeedsReview',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.review_disposition IS DISTINCT FROM 'skipped_false_detection' AND NOT c.review_ready),
    'candidatesFailed',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.state='failed'),
    'falseDetections',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.review_disposition='skipped_false_detection'),
    'manualMissedCandidates',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.input_id IS NULL),
    'committedInventoryItems',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.state='committed' AND c.committed_inventory_id IS NOT NULL),
    'quantitiesAddedToExisting',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.state='committed' AND c.commit_outcome='quantity_incremented'),
    'privateItems',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.state='committed' AND c.committed_inventory_id IS NOT NULL AND c.committed_listing_id IS NULL),
    'publishedItems',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=p_session_id AND c.state='committed' AND c.committed_listing_id IS NOT NULL),
    'languageSkips',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='skipped' AND i.quality_reason='P9_VISION_LANGUAGE_MISMATCH'),
    'candidateCapSkips',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='skipped' AND i.quality_reason='P9_VISION_CANDIDATE_CAP'),
    'qualitySkips',(SELECT count(*) FROM public.image_extraction_inputs i WHERE i.session_id=p_session_id AND i.state='failed' AND i.quality_reason='P9_VISION_QUALITY_REJECTED')
  )
$$;

CREATE FUNCTION public.claim_phase9_publication_jobs(
  p_batch_size integer DEFAULT 1,p_worker text DEFAULT NULL
) RETURNS TABLE(
  job_id uuid,lease_token uuid,lease_owner text,lease_expires_at timestamptz,
  operation text,inventory_id uuid,publication_intent_version integer,
  attempt_number integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_batch_size NOT BETWEEN 1 AND 10
    OR coalesce(char_length(p_worker),0) NOT BETWEEN 16 AND 128
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN QUERY WITH candidates AS (
    SELECT j.id FROM public.image_extraction_jobs j
    WHERE j.job_kind='publication_retry'
      AND j.entity_type='store_inventory'
      AND j.status IN ('open','retry_scheduled','in_progress')
      AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts
    ORDER BY j.next_attempt_at,j.id FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), claimed AS (
    UPDATE public.image_extraction_jobs j SET status='in_progress',
      lease_owner=p_worker,lease_token=gen_random_uuid(),
      lease_expires_at=transaction_timestamp()+interval '5 minutes',
      attempt_count=j.attempt_count+1,updated_at=transaction_timestamp()
    FROM candidates c WHERE j.id=c.id RETURNING j.*
  ) SELECT c.id,c.lease_token,c.lease_owner,c.lease_expires_at,
      c.job_kind,c.entity_id,c.operation_version::integer,c.attempt_count
    FROM claimed c;
END$$;

CREATE FUNCTION public.phase9_retry_publication_worker_v1(
  p_inventory_id uuid,p_expected_publication_intent_version integer,
  p_job_id uuid,p_lease_token uuid,p_attempt_number integer,p_worker text,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_inventory public.store_inventory;
  v_reason text; v_replay jsonb; v_result jsonb; v_listing uuid; v_outcome text;
  v_actor text:='worker:'||p_worker;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_job.id IS NULL OR v_inventory.id IS NULL
    OR v_job.job_kind<>'publication_retry' OR v_job.entity_type<>'store_inventory'
    OR v_job.entity_id<>p_inventory_id OR v_job.store_id<>v_inventory.store_id
    OR v_job.operation_version<>p_expected_publication_intent_version::text
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  v_replay:=marketplace_sec.phase9_replay(v_actor,'U7BC12W',p_idempotency_key,
    concat_ws('|',p_command_id,p_inventory_id,p_expected_publication_intent_version,
      p_job_id,p_lease_token,p_attempt_number,p_worker));
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id FOR UPDATE;
  IF v_job.status<>'in_progress'
    OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.attempt_count<>p_attempt_number
    OR v_inventory.publication_intent_version<>p_expected_publication_intent_version
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  PERFORM 1 FROM public.stores WHERE id=v_inventory.store_id FOR UPDATE;
  v_reason:=marketplace_sec.phase9_publication_ineligibility(v_inventory);
  IF v_reason IS NOT NULL THEN
    UPDATE public.image_extraction_jobs SET status='cancelled',lease_owner=NULL,
      lease_token=NULL,lease_expires_at=NULL,completed_at=transaction_timestamp(),
      last_safe_error_code=CASE WHEN v_reason='damage_media' THEN 'P9_MEDIA_NOT_APPROVED'
        ELSE 'P9_PUBLICATION_INELIGIBLE' END,
      last_safe_error_category='deterministic',updated_at=transaction_timestamp()
      WHERE id=p_job_id;
    UPDATE public.store_inventory SET visibility_status='draft',publication_status='private',
      updated_at=transaction_timestamp() WHERE id=p_inventory_id RETURNING * INTO v_inventory;
    v_result:=marketplace_sec.phase9_publication_result(
      p_inventory_id,'owner_correction_required',v_reason);
    PERFORM marketplace_sec.phase9_finish_replay(v_actor,'U7BC12W',p_idempotency_key,
      v_result,'none');
    RETURN v_result;
  END IF;
  BEGIN
    UPDATE public.store_inventory SET visibility_status='published',
      publication_status='publication_pending',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id;
    SELECT id INTO v_listing FROM public.marketplace_book_listings WHERE inventory_id=p_inventory_id;
    IF v_listing IS NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_TRANSIENT'; END IF;
    UPDATE public.store_inventory SET publication_status='published',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id RETURNING * INTO v_inventory;
    UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
      lease_token=NULL,lease_expires_at=NULL,completed_at=transaction_timestamp(),
      updated_at=transaction_timestamp() WHERE id=p_job_id;
    v_outcome:='published';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_PUBLICATION_TRANSIENT' THEN RAISE; END IF;
    UPDATE public.store_inventory SET visibility_status='draft',
      publication_status='publication_failed',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id RETURNING * INTO v_inventory;
    v_outcome:='committed_publication_failed';
  END;
  PERFORM marketplace_sec.phase9_record_publication(
    v_inventory,'retry',v_outcome,p_command_id,NULL);
  v_result:=marketplace_sec.phase9_publication_result(p_inventory_id,v_outcome,
    CASE WHEN v_outcome='committed_publication_failed' THEN 'projection_temporarily_unavailable' END);
  PERFORM marketplace_sec.phase9_finish_replay(v_actor,'U7BC12W',p_idempotency_key,
    v_result,'projection_only');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_fail_publication_job_v1(
  p_job_id uuid,p_lease_token uuid,p_worker text,p_attempt_number integer,
  p_category text,p_safe_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_category NOT IN ('transient','deterministic') THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.id IS NULL OR v_job.job_kind<>'publication_retry'
    OR v_job.status<>'in_progress' OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.attempt_count<>p_attempt_number
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_status:=CASE WHEN p_category='deterministic' THEN 'cancelled'
    WHEN v_job.attempt_count>=v_job.max_attempts THEN 'dead_letter'
    ELSE 'retry_scheduled' END;
  UPDATE public.image_extraction_jobs SET status=v_status,lease_owner=NULL,
    lease_token=NULL,lease_expires_at=NULL,last_safe_error_category=p_category,
    last_safe_error_code=p_safe_code,
    next_attempt_at=CASE WHEN v_status='retry_scheduled' THEN transaction_timestamp()+
      make_interval(secs=>least(900,15*(2^greatest(v_job.attempt_count-1,0))))
      ELSE next_attempt_at END,
    completed_at=CASE WHEN v_status='cancelled' THEN transaction_timestamp() ELSE completed_at END,
    dead_lettered_at=CASE WHEN v_status='dead_letter' THEN transaction_timestamp() ELSE dead_lettered_at END,
    updated_at=transaction_timestamp() WHERE id=p_job_id;
  RETURN v_status;
END$$;

CREATE FUNCTION marketplace_sec.phase9_public_listing_json(p_listing public.marketplace_book_listings)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'listingId',p_listing.id,'storeId',p_listing.store_id,
    'title',p_listing.public_title,'authors',coalesce(p_listing.public_authors,'{}'),
    'language',p_listing.language,'description',p_listing.public_description,
    'editionStatement',p_listing.edition_statement,'volume',p_listing.volume,
    'format',p_listing.format,'isbn10',p_listing.isbn_10,'isbn13',p_listing.isbn_13,
    'condition',p_listing.condition,'hasDamage',p_listing.has_damage,
    'publicDamageNote',p_listing.public_damage_notes,'damageTypes',p_listing.damage_types,
    'priceMinor',p_listing.selling_price_minor,'currency','INR',
    'availabilityStatus',p_listing.availability_status,
    'coverUrl',p_listing.public_cover_url,'publicMediaCount',p_listing.public_media_count,
    'fulfillmentOptions',p_listing.fulfillment_options,'status',p_listing.status,
    'moderationStatus',p_listing.moderation_status,
    'qualityStatus',p_listing.listing_quality_status,
    'friendlyInventoryFreshnessSignal',coalesce(p_listing.last_inventory_verified_bucket,'not_recently_verified'))
$$;

-- DOC-2 §10.3/§10.4, DOC-5 §11, and DOC-16 §2: one server-owned
-- rollout primitive is shared by publication and anonymous discovery. Listing
-- admission remains a distinct flag because its count must be checked under
-- the publication transaction's inventory lock.
CREATE FUNCTION marketplace_sec.phase9_store_publication_ineligibility(
  p_store_id uuid,p_check_listing_admission boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store public.stores; v_limit integer; v_policy boolean;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE id=p_store_id;
  IF v_store.id IS NULL OR v_store.status<>'active'
    OR v_store.verification_status<>'approved'
    OR v_store.setup_status<>'complete' OR v_store.selling_status<>'allowed'
  THEN RETURN 'store_policy'; END IF;
  IF v_store.locality_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.marketplace_localities l
    WHERE l.id=v_store.locality_id AND l.is_pilot_enabled
  ) THEN RETURN 'pilot_locality'; END IF;
  IF NOT COALESCE((SELECT s.status IN
      ('trialing','active','past_due','grace_period')
    FROM public.store_subscriptions s
    WHERE s.store_id=p_store_id
    ORDER BY s.updated_at DESC,s.id DESC LIMIT 1),false)
  THEN RETURN 'subscription'; END IF;
  SELECT e.limit_value INTO v_limit FROM public.store_entitlements e
    WHERE e.store_id=p_store_id AND e.feature_key='active_listing_limit'
      AND e.is_enabled;
  IF v_limit IS NULL THEN RETURN 'entitlement'; END IF;
  SELECT (pc.value)::boolean INTO v_policy
  FROM public.marketplace_policy_config pc
  WHERE pc.policy_key='marketplace_enabled' AND pc.is_active
    AND pc.effective_from<=transaction_timestamp()
    AND (pc.effective_to IS NULL OR pc.effective_to>transaction_timestamp())
    AND pc.scope_type IN ('global','city','locality','store')
    AND CASE pc.scope_type WHEN 'store' THEN pc.store_id=p_store_id
      WHEN 'locality' THEN coalesce(pc.normalized_scope_identity,pc.scope_value)=v_store.locality_id::text
      WHEN 'city' THEN lower(coalesce(pc.normalized_scope_identity,pc.scope_value))=lower(v_store.city)
      ELSE true END
  ORDER BY CASE pc.scope_type WHEN 'store' THEN 4 WHEN 'locality' THEN 3
    WHEN 'city' THEN 2 ELSE 1 END DESC,pc.effective_from DESC,pc.policy_version DESC
  LIMIT 1;
  IF NOT coalesce(v_policy,false) THEN RETURN 'marketplace_feature'; END IF;
  v_policy:=NULL;
  SELECT (pc.value)::boolean INTO v_policy
  FROM public.marketplace_policy_config pc
  WHERE pc.policy_key='commerce.store_allowlisted' AND pc.is_active
    AND pc.effective_from<=transaction_timestamp()
    AND (pc.effective_to IS NULL OR pc.effective_to>transaction_timestamp())
    AND ((pc.scope_type='store' AND pc.store_id=p_store_id)
      OR pc.scope_type='global')
  ORDER BY CASE pc.scope_type WHEN 'store' THEN 2 ELSE 1 END DESC,
    pc.effective_from DESC,pc.policy_version DESC LIMIT 1;
  IF NOT coalesce(v_policy,false) THEN RETURN 'store_allowlist'; END IF;
  IF p_check_listing_admission AND (SELECT count(*) FROM public.marketplace_book_listings l
    WHERE l.store_id=p_store_id AND l.status='active')>=v_limit
  THEN RETURN 'active_listing_limit'; END IF;
  RETURN NULL;
END$$;

CREATE FUNCTION public.phase9_public_listing_detail_v2(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_public_listing_json(l)
  FROM public.marketplace_book_listings l JOIN public.stores s ON s.id=l.store_id
  WHERE l.id=p_listing_id AND l.status='active' AND l.availability_status<>'unavailable'
    AND l.moderation_status='approved' AND l.listing_quality_status='ready'
    AND marketplace_sec.phase9_store_publication_ineligibility(l.store_id,false) IS NULL
$$;

CREATE FUNCTION public.phase9_public_listing_search_v2(
  p_query text DEFAULT NULL,p_store_id uuid DEFAULT NULL,p_page_size integer DEFAULT 20
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF p_page_size NOT BETWEEN 1 AND 50 OR char_length(coalesce(p_query,''))>200 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  WITH eligible AS (
    SELECT l.id AS listing_id,l.public_title,l.selling_price_minor,
      CASE WHEN p_store_id IS NOT NULL THEN 'listing:'||l.id::text
      WHEN l.canonical_edition_id IS NOT NULL THEN 'edition:'||l.canonical_edition_id::text
      WHEN l.isbn_13 IS NOT NULL THEN 'isbn13:'||l.isbn_13
      WHEN l.isbn_10 IS NOT NULL THEN 'isbn10:'||l.isbn_10
      ELSE 'manual:'||lower(btrim(l.public_title))||'|'||
        lower(array_to_string(coalesce(l.public_authors,'{}'), '|')) END AS group_key
    FROM public.marketplace_book_listings l
    WHERE l.status='active' AND l.availability_status<>'unavailable'
      AND l.moderation_status='approved' AND l.listing_quality_status='ready'
      AND marketplace_sec.phase9_store_publication_ineligibility(l.store_id,false) IS NULL
      AND (p_store_id IS NULL OR l.store_id=p_store_id)
      AND (coalesce(btrim(p_query),'')='' OR
        (regexp_replace(upper(p_query),'[-[:space:]]','','g')~'^([0-9]{9}[0-9X]|[0-9]{13})$'
          AND (l.isbn_10=regexp_replace(upper(p_query),'[-[:space:]]','','g')
            OR l.isbn_13=regexp_replace(upper(p_query),'[-[:space:]]','','g')))
        OR l.search_document@@plainto_tsquery('simple',p_query)
        OR lower(l.public_title) LIKE '%'||lower(btrim(p_query))||'%'
        OR l.id IN (SELECT m.listing_id
          FROM marketplace_sec.phase9_active_variant_listing_ids(p_query) m))
  ), selected_groups AS (
    SELECT group_key,min(public_title) title
    FROM eligible GROUP BY group_key ORDER BY title,group_key LIMIT p_page_size
  )
  SELECT coalesce(jsonb_agg(marketplace_sec.phase9_public_listing_json(l)
    ORDER BY g.title,g.group_key,e.selling_price_minor,l.id),'[]'::jsonb) INTO v_rows
  FROM eligible e JOIN selected_groups g USING(group_key)
  JOIN public.marketplace_book_listings l ON l.id=e.listing_id;
  RETURN v_rows;
END$$;

-- Unit 7B SDD §6: selection and lifecycle refresh must evaluate the same
-- complete public-copy predicate so no stale URL survives an eligibility loss.
CREATE FUNCTION marketplace_sec.phase9_public_media_eligible(
  p_link public.inventory_media_links,p_asset public.media_assets
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_link.id IS NOT NULL AND p_asset.id IS NOT NULL
    AND p_link.media_asset_id=p_asset.id
    AND p_link.store_id=p_asset.store_id
    AND p_link.approval_status='approved'
    AND p_link.role IN ('damage','actual_copy','primary_fallback')
    AND p_asset.purpose='public_copy' AND p_asset.privacy_class='public'
    AND p_asset.bucket_id='inventory-photos'
    AND p_asset.lifecycle_status IN ('approved','linked')
    AND p_asset.validation_version IS NOT NULL
    AND p_asset.reencode_version IS NOT NULL
    AND p_asset.exif_strip_version IS NOT NULL
    AND p_asset.source_media_asset_id IS NOT NULL
    AND p_asset.deleted_at IS NULL
    AND p_asset.object_path<>''
    AND p_asset.object_path!~ '(^|/)\.\.(/|$)|[?#\\]'
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_publication_ineligibility(
  p_inventory public.store_inventory
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store public.stores; v_damage_count integer;
  v_listing public.marketplace_book_listings;
BEGIN
  IF marketplace_sec.phase9_store_publication_ineligibility(
    p_inventory.store_id,NOT EXISTS(SELECT 1 FROM public.marketplace_book_listings l
      WHERE l.inventory_id=p_inventory.id)) IS NOT NULL
  THEN RETURN marketplace_sec.phase9_store_publication_ineligibility(
    p_inventory.store_id,NOT EXISTS(SELECT 1 FROM public.marketplace_book_listings l
      WHERE l.inventory_id=p_inventory.id)); END IF;
  SELECT * INTO v_listing FROM public.marketplace_book_listings
    WHERE inventory_id=p_inventory.id;
  IF v_listing.id IS NOT NULL AND (v_listing.moderation_status<>'approved'
    OR EXISTS(SELECT 1 FROM public.listing_moderation_flags f
      WHERE f.listing_id=v_listing.id AND f.status IN ('open','under_review')))
  THEN RETURN 'moderation'; END IF;
  IF p_inventory.selling_price_minor<=0 THEN RETURN 'price'; END IF;
  IF p_inventory.quantity_available<=0 THEN RETURN 'stock'; END IF;
  IF NOT p_inventory.is_sellable THEN RETURN 'sellability'; END IF;
  IF p_inventory.condition NOT IN ('new','like_new','very_good','good','acceptable')
    THEN RETURN 'condition'; END IF;
  IF coalesce(char_length(btrim(p_inventory.title)),0)=0
    OR coalesce(char_length(btrim(p_inventory.language)),0)=0
    OR p_inventory.listing_quality_status<>'ready'
  THEN RETURN 'metadata'; END IF;
  IF p_inventory.has_damage THEN
    SELECT count(*) INTO v_damage_count
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE l.inventory_id=p_inventory.id AND l.role='damage'
      AND marketplace_sec.phase9_public_media_eligible(l,a);
    IF coalesce(char_length(btrim(p_inventory.damage_notes)),0)=0
      OR coalesce(array_length(p_inventory.damage_types,1),0)=0
      OR v_damage_count NOT BETWEEN 1 AND 3
    THEN RETURN 'damage_media'; END IF;
  END IF;
  RETURN NULL;
END$$;

CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store public.stores; v_locality text; v_media_count integer;
  v_primary uuid; v_primary_path text; v_cover text; v_availability text;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE id=NEW.store_id;
  SELECT name INTO v_locality FROM public.marketplace_localities WHERE id=v_store.locality_id;
  IF NEW.visibility_status='paused' THEN
    UPDATE public.marketplace_book_listings SET status='paused',
      availability_status='unavailable',updated_at=transaction_timestamp()
      WHERE inventory_id=NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.visibility_status<>'published' OR NEW.publication_status NOT IN ('publication_pending','published') THEN
    IF EXISTS(SELECT 1 FROM public.store_order_request_items ri
      JOIN public.marketplace_book_listings l ON l.id=ri.listing_id
      WHERE l.inventory_id=NEW.id) THEN
      UPDATE public.marketplace_book_listings SET status='paused',
        availability_status='unavailable',updated_at=transaction_timestamp()
        WHERE inventory_id=NEW.id;
    ELSE DELETE FROM public.marketplace_book_listings WHERE inventory_id=NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  IF marketplace_sec.phase9_publication_ineligibility(NEW) IS NOT NULL THEN
    RAISE EXCEPTION 'P9_PUBLICATION_INELIGIBLE';
  END IF;
  SELECT count(*),(array_agg(a.id) FILTER (WHERE l.role='primary_fallback'))[1],
    max(a.object_path) FILTER (WHERE l.role='primary_fallback')
  INTO v_media_count,v_primary,v_primary_path
  FROM public.inventory_media_links l JOIN public.media_assets a ON a.id=l.media_asset_id
  WHERE l.inventory_id=NEW.id AND marketplace_sec.phase9_public_media_eligible(l,a);
  v_cover:=coalesce(NEW.cover_url,
    CASE WHEN v_primary_path IS NULL THEN NULL ELSE
      '/storage/v1/object/public/inventory-photos/'||v_primary_path END);
  v_availability:=CASE WHEN NEW.quantity_available=1 THEN 'low_stock'
    WHEN NEW.quantity_available>1 THEN 'available' ELSE 'unavailable' END;

  INSERT INTO public.marketplace_book_listings(
    inventory_id,store_id,canonical_work_id,canonical_edition_id,public_title,
    public_authors,authors_text,public_cover_url,isbn_10,isbn_13,condition,
    public_condition_notes,selling_price_minor,availability_status,
    fulfillment_options,status,moderation_status,listing_quality_status,
    store_city,store_locality_id,store_locality_name,pickup_available,
    delivery_available,language,public_description,edition_statement,volume,
    format,has_damage,public_damage_notes,damage_types,primary_public_media_id,
    public_media_count,last_inventory_verified_bucket,search_document,updated_at
  ) VALUES(
    NEW.id,NEW.store_id,NEW.canonical_work_id,NEW.canonical_edition_id,NEW.title,
    NEW.authors,array_to_string(NEW.authors,' '),v_cover,NEW.isbn_10,NEW.isbn_13,
    NEW.condition,coalesce(NEW.public_notes,NEW.condition_notes),NEW.selling_price_minor,
    v_availability,array_remove(ARRAY[
      CASE WHEN v_store.pickup_enabled THEN 'pickup' END,
      CASE WHEN v_store.delivery_enabled THEN 'delivery' END],NULL),
    'active','approved',NEW.listing_quality_status,v_store.city,v_store.locality_id,
    v_locality,v_store.pickup_enabled,v_store.delivery_enabled,NEW.language,
    NEW.description,NEW.edition_statement,NEW.volume,NEW.format,NEW.has_damage,
    NEW.damage_notes,NEW.damage_types,v_primary,least(v_media_count,3),
    CASE WHEN NEW.last_verified_at IS NULL THEN 'not_recently_verified'
      WHEN NEW.last_verified_at>transaction_timestamp()-interval '7 days' THEN 'recent'
      ELSE 'needs_confirmation' END,
    to_tsvector('simple',coalesce(NEW.title,'')||' '||array_to_string(NEW.authors,' ')),
    transaction_timestamp()
  ) ON CONFLICT(inventory_id) DO UPDATE SET
    canonical_work_id=excluded.canonical_work_id,
    canonical_edition_id=excluded.canonical_edition_id,
    public_title=excluded.public_title,public_authors=excluded.public_authors,
    authors_text=excluded.authors_text,public_cover_url=excluded.public_cover_url,
    isbn_10=excluded.isbn_10,isbn_13=excluded.isbn_13,condition=excluded.condition,
    public_condition_notes=excluded.public_condition_notes,
    selling_price_minor=excluded.selling_price_minor,
    availability_status=excluded.availability_status,
    fulfillment_options=excluded.fulfillment_options,status='active',
    listing_quality_status=excluded.listing_quality_status,
    store_city=excluded.store_city,store_locality_id=excluded.store_locality_id,
    store_locality_name=excluded.store_locality_name,
    pickup_available=excluded.pickup_available,delivery_available=excluded.delivery_available,
    language=excluded.language,public_description=excluded.public_description,
    edition_statement=excluded.edition_statement,volume=excluded.volume,format=excluded.format,
    has_damage=excluded.has_damage,public_damage_notes=excluded.public_damage_notes,
    damage_types=excluded.damage_types,primary_public_media_id=excluded.primary_public_media_id,
    public_media_count=excluded.public_media_count,
    last_inventory_verified_bucket=excluded.last_inventory_verified_bucket,
    search_document=excluded.search_document,updated_at=transaction_timestamp();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS store_inventory_listing_sync ON public.store_inventory;
DROP TRIGGER IF EXISTS sync_marketplace_listing_from_inventory_trg ON public.store_inventory;
DROP TRIGGER IF EXISTS phase9_store_inventory_listing_sync ON public.store_inventory;
CREATE TRIGGER phase9_store_inventory_listing_sync
AFTER INSERT OR UPDATE OF visibility_status,publication_status,title,authors,
  language,description,edition_statement,volume,format,isbn_10,isbn_13,condition,
  public_notes,condition_notes,selling_price_minor,quantity_available,is_sellable,
  has_damage,damage_notes,damage_types,cover_url,last_verified_at
ON public.store_inventory FOR EACH ROW
EXECUTE FUNCTION public.sync_marketplace_listing_from_inventory();

CREATE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_change record; v_inventory public.store_inventory; v_was_primary boolean;
BEGIN
  FOR v_change IN
    SELECT DISTINCT inventory_id,media_asset_id FROM (
      SELECT OLD.inventory_id,OLD.media_asset_id WHERE TG_OP IN ('UPDATE','DELETE')
      UNION ALL
      SELECT NEW.inventory_id,NEW.media_asset_id WHERE TG_OP IN ('INSERT','UPDATE')
    ) changed
  LOOP
    SELECT * INTO v_inventory FROM public.store_inventory
      WHERE id=v_change.inventory_id FOR UPDATE;
    CONTINUE WHEN v_inventory.id IS NULL;
    SELECT EXISTS(SELECT 1 FROM public.marketplace_book_listings l
      WHERE l.inventory_id=v_change.inventory_id
        AND l.primary_public_media_id=v_change.media_asset_id) INTO v_was_primary;
    IF v_inventory.visibility_status='published'
      AND (marketplace_sec.phase9_publication_ineligibility(v_inventory) IS NOT NULL
        OR (v_was_primary AND NOT EXISTS(
          SELECT 1 FROM public.inventory_media_links link
          JOIN public.media_assets asset ON asset.id=link.media_asset_id
          WHERE link.inventory_id=v_change.inventory_id
            AND link.media_asset_id=v_change.media_asset_id
            AND link.role='primary_fallback'
            AND marketplace_sec.phase9_public_media_eligible(link,asset)))) THEN
      UPDATE public.store_inventory SET visibility_status='blocked',publication_status='private',
        updated_at=transaction_timestamp() WHERE id=v_change.inventory_id;
    ELSE
      UPDATE public.store_inventory SET cover_url=cover_url WHERE id=v_change.inventory_id;
    END IF;
  END LOOP;
  RETURN coalesce(NEW,OLD);
END$$;

CREATE TRIGGER phase9_inventory_media_projection_refresh
AFTER INSERT OR UPDATE OF inventory_id,store_id,media_asset_id,role,public_order,
  approval_status OR DELETE ON public.inventory_media_links
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change();

CREATE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_asset_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory_id uuid; v_inventory public.store_inventory;
BEGIN
  FOR v_inventory_id IN SELECT DISTINCT l.inventory_id
    FROM public.inventory_media_links l WHERE l.media_asset_id=coalesce(NEW.id,OLD.id)
  LOOP
    SELECT * INTO v_inventory FROM public.store_inventory
      WHERE id=v_inventory_id FOR UPDATE;
    IF v_inventory.visibility_status='published'
      AND (TG_OP='DELETE'
        OR marketplace_sec.phase9_publication_ineligibility(v_inventory) IS NOT NULL
        OR EXISTS(SELECT 1 FROM public.marketplace_book_listings listing
          WHERE listing.inventory_id=v_inventory_id
            AND listing.primary_public_media_id=coalesce(NEW.id,OLD.id)
            AND (TG_OP='DELETE' OR NOT EXISTS(
              SELECT 1 FROM public.inventory_media_links link
              WHERE link.inventory_id=v_inventory_id AND link.media_asset_id=NEW.id
                AND marketplace_sec.phase9_public_media_eligible(link,NEW))))) THEN
      UPDATE public.store_inventory SET visibility_status='blocked',publication_status='private',
        updated_at=transaction_timestamp() WHERE id=v_inventory_id;
    ELSE
      UPDATE public.store_inventory SET cover_url=cover_url WHERE id=v_inventory_id;
    END IF;
  END LOOP;
  RETURN coalesce(NEW,OLD);
END$$;

CREATE TRIGGER phase9_media_asset_projection_lifecycle
AFTER UPDATE OF store_id,purpose,privacy_class,bucket_id,object_path,
  validation_version,reencode_version,exif_strip_version,source_media_asset_id,
  lifecycle_status,delete_after,deleted_at ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_asset_change();

CREATE TRIGGER phase9_media_asset_projection_delete
BEFORE DELETE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_asset_change();

CREATE FUNCTION marketplace_sec.phase9_publication_result(
  p_inventory_id uuid,p_outcome text,p_failure_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'inventoryId',i.id,'inventoryVersion',i.version,
    'publicationIntentVersion',i.publication_intent_version,
    'publicationStatus',i.publication_status,'visibilityStatus',i.visibility_status,
    'publicationRetryable',i.publication_status='publication_failed',
    'publicationFailureReason',p_failure_reason,'outcome',p_outcome,
    'listingId',(SELECT l.id FROM public.marketplace_book_listings l WHERE l.inventory_id=i.id)
  ) FROM public.store_inventory i WHERE i.id=p_inventory_id
$$;

CREATE FUNCTION marketplace_sec.phase9_record_publication(
  p_inventory public.store_inventory,p_action text,p_outcome text,p_command_id uuid,
  p_actor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details
  ) VALUES(p_inventory.store_id,'phase9.publication.'||p_action,'store_inventory',
    p_inventory.id,p_actor,jsonb_build_object('commandId',p_command_id,
      'outcome',p_outcome,'publicationIntentVersion',p_inventory.publication_intent_version));
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,payload
  ) VALUES(p_inventory.store_id,'inventory.publication.'||
      CASE p_outcome WHEN 'published' THEN 'published'
        WHEN 'paused' THEN 'paused' WHEN 'pause' THEN 'paused'
        WHEN 'private' THEN 'private'
        ELSE 'failed' END,
    'store_inventory',p_inventory.id,p_actor,
    jsonb_build_object('commandId',p_command_id,
      'publicationIntentVersion',p_inventory.publication_intent_version));
END$$;

CREATE FUNCTION public.phase9_set_publication_state_v2(
  p_inventory_id uuid,p_expected_inventory_version integer,
  p_expected_publication_intent_version integer,p_intent text,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_store uuid; v_reason text;
  v_replay jsonb; v_result jsonb; v_outcome text; v_listing uuid;
BEGIN
  IF p_intent NOT IN ('publish','pause','private') OR p_command_id IS NULL THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7BC26',p_idempotency_key,
    concat_ws('|',auth.uid(),p_command_id,p_inventory_id,p_expected_inventory_version,
      p_expected_publication_intent_version,p_intent));
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_inventory FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.version<>p_expected_inventory_version
    OR v_inventory.publication_intent_version<>p_expected_publication_intent_version
  THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF p_intent='publish' THEN
    PERFORM 1 FROM public.stores WHERE id=v_inventory.store_id FOR UPDATE;
  END IF;
  IF p_intent='publish' AND v_inventory.publication_status='published' THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;

  IF p_intent='publish' THEN
    v_reason:=marketplace_sec.phase9_publication_ineligibility(v_inventory);
    IF v_reason='damage_media' THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
    IF v_reason IS NOT NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_INELIGIBLE:%',v_reason; END IF;
  END IF;

  UPDATE public.store_inventory SET
    publication_intent_version=publication_intent_version+1,
    updated_at=transaction_timestamp() WHERE id=p_inventory_id
    RETURNING * INTO v_inventory;

  IF p_intent='publish' THEN
    BEGIN
      UPDATE public.store_inventory SET visibility_status='published',
        publication_status='publication_pending',updated_at=transaction_timestamp()
        WHERE id=p_inventory_id RETURNING * INTO v_inventory;
      SELECT id INTO v_listing FROM public.marketplace_book_listings
        WHERE inventory_id=p_inventory_id;
      IF v_listing IS NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_TRANSIENT'; END IF;
      UPDATE public.store_inventory SET publication_status='published',
        updated_at=transaction_timestamp() WHERE id=p_inventory_id
        RETURNING * INTO v_inventory;
      v_outcome:='published';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM<>'P9_PUBLICATION_TRANSIENT' THEN RAISE; END IF;
      UPDATE public.store_inventory SET visibility_status='draft',
        publication_status='publication_failed',updated_at=transaction_timestamp()
        WHERE id=p_inventory_id RETURNING * INTO v_inventory;
      INSERT INTO public.image_extraction_jobs(
        store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version
      ) VALUES(v_inventory.store_id,'store_inventory',p_inventory_id,
        'publication_retry','publication_retry:'||p_inventory_id::text||':'||
          v_inventory.publication_intent_version::text,
        v_inventory.publication_intent_version::text)
      ON CONFLICT(dedupe_key) DO NOTHING;
      v_outcome:='committed_publication_failed';
    END;
  ELSE
    UPDATE public.store_inventory SET
      visibility_status=CASE WHEN p_intent='pause' THEN 'paused' ELSE 'draft' END,
      publication_status='private',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id RETURNING * INTO v_inventory;
    UPDATE public.image_extraction_jobs SET status='cancelled',lease_owner=NULL,
      lease_token=NULL,lease_expires_at=NULL,completed_at=transaction_timestamp(),
      updated_at=transaction_timestamp()
      WHERE entity_id=p_inventory_id AND entity_type='store_inventory'
        AND job_kind='publication_retry'
        AND status IN ('open','retry_scheduled','in_progress');
    v_outcome:=p_intent;
  END IF;

  PERFORM marketplace_sec.phase9_record_publication(
    v_inventory,p_intent,v_outcome,p_command_id,auth.uid());
  v_result:=marketplace_sec.phase9_publication_result(p_inventory_id,v_outcome,
    CASE WHEN v_outcome='committed_publication_failed' THEN 'projection_temporarily_unavailable' END);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7BC26',
    p_idempotency_key,v_result,CASE WHEN v_outcome='committed_publication_failed'
      THEN 'private_inventory_committed' ELSE 'publication_state_changed' END);
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_retry_publication_owner_v1(
  p_inventory_id uuid,p_expected_publication_intent_version integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_store uuid; v_reason text;
  v_replay jsonb; v_result jsonb; v_listing uuid; v_outcome text;
BEGIN
  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7BC12O',p_idempotency_key,
    concat_ws('|',auth.uid(),p_command_id,p_inventory_id,p_expected_publication_intent_version));
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF v_inventory.publication_intent_version<>p_expected_publication_intent_version
    OR v_inventory.publication_status<>'publication_failed'
  THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  PERFORM 1 FROM public.stores WHERE id=v_inventory.store_id FOR UPDATE;
  v_reason:=marketplace_sec.phase9_publication_ineligibility(v_inventory);
  IF v_reason='damage_media' THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_INELIGIBLE:%',v_reason; END IF;
  BEGIN
    UPDATE public.store_inventory SET visibility_status='published',
      publication_status='publication_pending',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id;
    SELECT id INTO v_listing FROM public.marketplace_book_listings WHERE inventory_id=p_inventory_id;
    IF v_listing IS NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_TRANSIENT'; END IF;
    UPDATE public.store_inventory SET publication_status='published',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id RETURNING * INTO v_inventory;
    UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
      lease_token=NULL,lease_expires_at=NULL,completed_at=transaction_timestamp(),
      updated_at=transaction_timestamp()
      WHERE entity_id=p_inventory_id AND job_kind='publication_retry'
        AND operation_version=p_expected_publication_intent_version::text
        AND status IN ('open','retry_scheduled','in_progress');
    v_outcome:='published';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_PUBLICATION_TRANSIENT' THEN RAISE; END IF;
    UPDATE public.store_inventory SET visibility_status='draft',
      publication_status='publication_failed',updated_at=transaction_timestamp()
      WHERE id=p_inventory_id RETURNING * INTO v_inventory;
    v_outcome:='committed_publication_failed';
  END;
  PERFORM marketplace_sec.phase9_record_publication(v_inventory,'retry',v_outcome,p_command_id,auth.uid());
  v_result:=marketplace_sec.phase9_publication_result(p_inventory_id,v_outcome,
    CASE WHEN v_outcome='committed_publication_failed' THEN 'projection_temporarily_unavailable' END);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7BC12O',
    p_idempotency_key,v_result,'projection_only');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_publication_status_v2(p_inventory_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory;
BEGIN
  SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN marketplace_sec.phase9_publication_result(v.id,
    CASE WHEN v.publication_status='publication_failed' THEN 'committed_publication_failed'
      ELSE v.publication_status END,
    CASE WHEN v.publication_status='publication_failed'
      THEN 'projection_temporarily_unavailable' END);
END$$;

CREATE FUNCTION public.phase9_authorize_public_copy_upload_v2(
  p_inventory_id uuid,p_role text,p_ordinal integer,p_declared_mime text,
  p_declared_bytes bigint,p_envelope_sha256 text,
  p_expires_at timestamptz,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; v_id uuid; v_path text; v_replay jsonb; v_result jsonb;
BEGIN
  SELECT * INTO v FROM public.store_inventory WHERE id=p_inventory_id;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF p_role NOT IN ('damage','actual_copy','primary_fallback') OR p_ordinal NOT BETWEEN 1 AND 3
    OR p_declared_mime NOT IN ('image/jpeg','image/png','image/webp')
    OR p_declared_bytes NOT BETWEEN 1 AND 10485760
    OR p_envelope_sha256!~'^[a-f0-9]{64}$' OR p_expires_at<=transaction_timestamp()
    OR p_expires_at>transaction_timestamp()+interval '20 minutes'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7BC20',p_idempotency_key,
    concat_ws('|',p_command_id,p_inventory_id,p_role,p_ordinal,p_declared_mime,
      p_declared_bytes,p_envelope_sha256));
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  v_path:=v.store_id::text||'/public_copy/'||v.id::text||'/'||gen_random_uuid()::text;
  INSERT INTO public.phase9_upload_capabilities(store_id,issued_to_user_id,
    initiating_owner_user_id,purpose,bound_entity_type,bound_entity_id,bound_ordinal,
    bucket_id,object_path,envelope_sha256,nonce_hash,expires_at,declared_mime,declared_bytes,
    public_copy_role)
  VALUES(v.store_id,auth.uid(),auth.uid(),'public_copy','inventory',v.id,p_ordinal,
    'marketplace-media-staging',v_path,p_envelope_sha256,
    encode(extensions.digest(concat_ws('|',p_idempotency_key,p_command_id),'sha256'),'hex'),p_expires_at,
    p_declared_mime,p_declared_bytes,p_role)
  RETURNING id INTO v_id;
  v_result:=jsonb_build_object('capabilityId',v_id,'bucket','marketplace-media-staging',
    'path',v_path,'expiresAt',p_expires_at);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7BC20',
    p_idempotency_key,v_result,'capability_issued'); RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_public_copy_upload_context_v1(
  p_actor uuid,p_capability_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap public.phase9_upload_capabilities; v_inventory public.store_inventory;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=v_cap.bound_entity_id;
  IF v_cap.id IS NULL OR v_cap.purpose<>'public_copy' OR v_cap.bound_entity_type<>'inventory'
    OR v_cap.issued_to_user_id<>p_actor OR v_cap.initiating_owner_user_id<>p_actor
    OR v_cap.status<>'issued' OR v_cap.expires_at<=transaction_timestamp()
    OR v_inventory.id IS NULL OR v_inventory.store_id<>v_cap.store_id OR NOT EXISTS(
      SELECT 1 FROM public.store_administrators sa JOIN public.stores s ON s.id=sa.store_id
      WHERE sa.store_id=v_cap.store_id AND sa.user_id=p_actor AND sa.role='owner'
        AND sa.status='active' AND s.status='active' AND s.setup_status='complete'
        AND s.selling_status='allowed')
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN jsonb_build_object('bucket_id',v_cap.bucket_id,'object_path',v_cap.object_path,
    'declared_mime',v_cap.declared_mime,'declared_bytes',v_cap.declared_bytes);
END$$;

CREATE FUNCTION public.phase9_register_public_copy_upload_v1(
  p_actor uuid,p_capability_id uuid,p_object_identity text,p_source_sha256 text,
  p_observed_mime text,p_observed_bytes bigint,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap public.phase9_upload_capabilities; v_inventory public.store_inventory;
  v_source uuid; v_job uuid; v_result jsonb; v_replay jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id FOR UPDATE;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=v_cap.bound_entity_id FOR UPDATE;
  IF v_cap.id IS NULL OR v_cap.purpose<>'public_copy' OR v_cap.bound_entity_type<>'inventory'
    OR v_cap.issued_to_user_id<>p_actor OR v_cap.initiating_owner_user_id<>p_actor
    OR v_inventory.id IS NULL OR v_inventory.store_id<>v_cap.store_id
    OR NOT EXISTS(SELECT 1 FROM public.store_administrators sa JOIN public.stores s ON s.id=sa.store_id
      WHERE sa.store_id=v_cap.store_id AND sa.user_id=p_actor AND sa.role='owner'
        AND sa.status='active' AND s.status='active' AND s.setup_status='complete'
        AND s.selling_status='allowed')
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF p_observed_mime<>v_cap.declared_mime OR p_observed_bytes<>v_cap.declared_bytes
    OR p_object_identity!~'^[0-9a-f]{64}$' OR p_source_sha256!~'^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  IF v_cap.status='consumed' AND v_cap.completion_canonical_response IS NOT NULL THEN
    IF v_cap.source_object_identity<>p_object_identity OR v_cap.source_sha256<>p_source_sha256
      OR v_cap.observed_mime<>p_observed_mime OR v_cap.observed_bytes<>p_observed_bytes
    THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
    RETURN v_cap.completion_canonical_response;
  END IF;
  IF v_cap.status<>'issued' OR v_cap.expires_at<=transaction_timestamp()
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_replay:=marketplace_sec.phase9_replay(p_actor::text,'U7BC20_COMPLETE',p_idempotency_key,
    concat_ws('|',p_command_id,p_capability_id,p_object_identity,p_source_sha256,
      p_observed_mime,p_observed_bytes));
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
    sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status)
  VALUES(v_cap.store_id,p_actor,'public_copy','private_scan',v_cap.bucket_id,v_cap.object_path,
    p_source_sha256,p_observed_mime,p_observed_bytes,1,1,'phase9-public-copy-source','staged')
  RETURNING id INTO v_source;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
  VALUES(v_cap.store_id,'media_asset',v_source,'media_validate_sanitize',
    'public-copy-validate:'||v_source::text,'phase9-public-copy-v1') RETURNING id INTO v_job;
  v_result:=jsonb_build_object('media_asset_id',v_source,'job_id',v_job,'state','processing');
  UPDATE public.phase9_upload_capabilities SET status='consumed',consumed_at=transaction_timestamp(),
    consumed_media_asset_id=v_source,source_object_identity=p_object_identity,
    source_sha256=p_source_sha256,observed_mime=p_observed_mime,observed_bytes=p_observed_bytes,
    completion_canonical_response=v_result,version=version+1,updated_at=transaction_timestamp()
    WHERE id=v_cap.id;
  PERFORM marketplace_sec.phase9_finish_replay(p_actor::text,'U7BC20_COMPLETE',p_idempotency_key,
    v_result,'public_copy_validation_job_created');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_public_copy_status_v1(p_source_media_asset_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_source public.media_assets; v_derivative uuid; v_state text;
BEGIN
  SELECT * INTO v_source FROM public.media_assets WHERE id=p_source_media_asset_id;
  IF v_source.id IS NULL OR v_source.purpose<>'public_copy'
    OR NOT marketplace_sec.phase9_is_store_owner(v_source.store_id)
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT id INTO v_derivative FROM public.media_assets
    WHERE source_media_asset_id=v_source.id AND purpose='public_copy'
      AND bucket_id='inventory-photos' AND lifecycle_status IN ('approved','linked')
    ORDER BY created_at DESC LIMIT 1;
  v_state:=CASE WHEN v_derivative IS NOT NULL THEN 'approved'
    WHEN v_source.lifecycle_status='failed' THEN 'failed' ELSE 'processing' END;
  RETURN jsonb_build_object('mediaAssetId',coalesce(v_derivative,v_source.id),'state',v_state);
END$$;

CREATE FUNCTION public.phase9_media_validation_context_v2(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_source public.media_assets;
  v_cap public.phase9_upload_capabilities; v_snapshot text; v_target text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  IF v_job.entity_type<>'media_asset' THEN
    RETURN marketplace_sec.phase9_media_validation_context(p_job_id,p_worker,p_lease_token,p_attempt_count);
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_job.entity_id FOR UPDATE;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities
    WHERE consumed_media_asset_id=v_source.id FOR UPDATE;
  IF v_job.job_kind<>'media_validate_sanitize' OR v_job.status<>'in_progress'
    OR v_job.lease_owner<>p_worker OR v_job.attempt_count<>p_attempt_count
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR v_source.purpose<>'public_copy' OR v_source.lifecycle_status NOT IN ('staged','validated')
    OR v_cap.id IS NULL OR v_cap.purpose<>'public_copy' OR v_cap.status<>'consumed'
    OR v_cap.source_sha256<>v_source.sha256 OR v_cap.bucket_id<>v_source.bucket_id
    OR v_cap.object_path<>v_source.object_path
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_snapshot:=coalesce(v_cap.completion_canonical_response->>'snapshot_path',
    v_job.store_id::text||'/public_copy/'||v_source.id::text||'/source-attempt-'||
      v_job.attempt_count::text||'.bin');
  v_target:=v_job.store_id::text||'/public_copy/'||v_cap.bound_entity_id::text||'/'||
    v_source.id::text||'/attempt-'||v_job.attempt_count::text||'.webp';
  RETURN jsonb_build_object('source_media_asset_id',v_source.id,
    'source_bucket',v_source.bucket_id,'source_path',v_source.object_path,
    'source_object_identity',v_cap.source_object_identity,'source_sha256',v_source.sha256,
    'source_bytes',v_source.bytes,'source_mime',v_source.detected_mime,
    'snapshot_bucket','image-extraction-inputs','snapshot_path',v_snapshot,
    'source_snapshot_path',v_cap.completion_canonical_response->>'snapshot_path',
    'source_snapshot_sha256',v_cap.completion_canonical_response->>'snapshot_sha256',
    'source_snapshot_bytes',(v_cap.completion_canonical_response->>'snapshot_bytes')::bigint,
    'target_bucket','inventory-photos','target_path',v_target);
END$$;

CREATE FUNCTION public.phase9_revalidate_media_validation_lease_v2(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_source_identity text,p_source_sha256 text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_source public.media_assets;
  v_cap public.phase9_upload_capabilities;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  IF v_job.entity_type<>'media_asset' THEN RETURN marketplace_sec.phase9_revalidate_media_validation_lease(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256); END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_job.entity_id;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE consumed_media_asset_id=v_source.id;
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR v_cap.source_object_identity<>p_source_identity OR v_source.sha256<>p_source_sha256
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN true;
END$$;

CREATE FUNCTION public.phase9_bind_media_validation_snapshot_v2(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_snapshot_path text,p_snapshot_sha256 text,p_snapshot_bytes bigint,p_snapshot_mime text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_source public.media_assets;
  v_cap public.phase9_upload_capabilities; v_expected text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  IF v_job.entity_type<>'media_asset' THEN RETURN marketplace_sec.phase9_bind_media_validation_snapshot(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_snapshot_path,p_snapshot_sha256,
    p_snapshot_bytes,p_snapshot_mime); END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_job.entity_id FOR UPDATE;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities
    WHERE consumed_media_asset_id=v_source.id FOR UPDATE;
  v_expected:=v_job.store_id::text||'/public_copy/'||v_source.id::text||'/source-attempt-'||
    v_job.attempt_count::text||'.bin';
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR p_snapshot_path<>v_expected OR p_snapshot_sha256<>v_source.sha256
    OR p_snapshot_bytes<>v_source.bytes OR p_snapshot_mime<>v_source.detected_mime
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.phase9_upload_capabilities SET completion_canonical_response=
    completion_canonical_response||jsonb_build_object('snapshot_path',p_snapshot_path,
      'snapshot_sha256',p_snapshot_sha256,'snapshot_bytes',p_snapshot_bytes),
    updated_at=transaction_timestamp() WHERE id=v_cap.id;
  RETURN true;
END$$;

CREATE FUNCTION public.phase9_complete_media_validation_v2(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_source_identity text,p_source_sha256 text,p_snapshot_path text,p_target_path text,
  p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_source public.media_assets;
  v_cap public.phase9_upload_capabilities; v_media uuid; v_expected text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  IF v_job.entity_type<>'media_asset' THEN RETURN marketplace_sec.phase9_complete_media_validation(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256,
    p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height); END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_job.entity_id FOR UPDATE;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities
    WHERE consumed_media_asset_id=v_source.id FOR UPDATE;
  v_expected:=v_job.store_id::text||'/public_copy/'||v_cap.bound_entity_id::text||'/'||
    v_source.id::text||'/attempt-'||v_job.attempt_count::text||'.webp';
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR v_cap.source_object_identity<>p_source_identity OR v_source.sha256<>p_source_sha256
    OR v_cap.completion_canonical_response->>'snapshot_path'<>p_snapshot_path
    OR p_target_path<>v_expected OR p_sha256!~'^[0-9a-f]{64}$'
    OR p_bytes NOT BETWEEN 1 AND 10485760 OR p_width NOT BETWEEN 1 AND 8192
    OR p_height NOT BETWEEN 1 AND 8192 OR p_width::bigint*p_height::bigint>16000000
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
    sha256,detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,
    exif_strip_version,source_media_asset_id,retention_class,lifecycle_status)
  VALUES(v_source.store_id,v_source.uploaded_by,'public_copy','public','inventory-photos',p_target_path,
    p_sha256,'image/webp',p_bytes,p_width,p_height,'phase9-media-v1',transaction_timestamp(),
    'magick-wasm-0.0.41-webp','magick-wasm-0.0.41-strip',v_source.id,
    'phase9-public-copy','approved')
  ON CONFLICT(bucket_id,object_path) DO NOTHING RETURNING id INTO v_media;
  IF v_media IS NULL THEN SELECT id INTO v_media FROM public.media_assets
    WHERE bucket_id='inventory-photos' AND object_path=p_target_path
      AND source_media_asset_id=v_source.id AND sha256=p_sha256;
  END IF;
  IF v_media IS NULL THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  UPDATE public.media_assets SET lifecycle_status='validated',validation_version='phase9-media-v1',
    validated_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE id=v_source.id;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,
    lease_token_hash=NULL,completed_at=transaction_timestamp(),updated_at=transaction_timestamp()
    WHERE id=v_job.id;
  RETURN jsonb_build_object('media_asset_id',v_media,'source_media_asset_id',v_source.id,
    'state','approved');
END$$;

CREATE FUNCTION public.phase9_fail_media_validation_v2(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_retryable boolean,p_safe_error_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_source public.media_assets; v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id;
  IF v_job.entity_type<>'media_asset' THEN RETURN marketplace_sec.phase9_fail_media_validation(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_retryable,p_safe_error_code); END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_job.entity_id FOR UPDATE;
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_status:=CASE WHEN p_retryable AND v_job.attempt_count<v_job.max_attempts THEN 'retry_scheduled'
    WHEN v_job.attempt_count>=v_job.max_attempts THEN 'dead_letter' ELSE 'resolved' END;
  UPDATE public.image_extraction_jobs SET status=v_status,lease_owner=NULL,lease_expires_at=NULL,
    lease_token_hash=NULL,next_attempt_at=transaction_timestamp()+interval '2 minutes',
    last_safe_error_category='media_validation',last_safe_error_code=left(p_safe_error_code,128),
    completed_at=CASE WHEN v_status='resolved' THEN transaction_timestamp() END,
    dead_lettered_at=CASE WHEN v_status='dead_letter' THEN transaction_timestamp() END,
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  IF v_status IN ('resolved','dead_letter') THEN UPDATE public.media_assets
    SET lifecycle_status='failed',updated_at=transaction_timestamp() WHERE id=v_source.id; END IF;
  RETURN v_status;
END$$;

CREATE OR REPLACE FUNCTION public.phase9_media_validation_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.phase9_media_validation_context_v2(
    p_job_id,p_worker,p_lease_token,p_attempt_count)
$$;
CREATE OR REPLACE FUNCTION public.phase9_revalidate_media_validation_lease(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_source_identity text,p_source_sha256 text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.phase9_revalidate_media_validation_lease_v2(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256)
$$;
CREATE OR REPLACE FUNCTION public.phase9_bind_media_validation_snapshot(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_snapshot_path text,p_snapshot_sha256 text,p_snapshot_bytes bigint,p_snapshot_mime text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.phase9_bind_media_validation_snapshot_v2(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_snapshot_path,p_snapshot_sha256,
    p_snapshot_bytes,p_snapshot_mime)
$$;
CREATE OR REPLACE FUNCTION public.phase9_complete_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_source_identity text,p_source_sha256 text,p_snapshot_path text,p_target_path text,
  p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.phase9_complete_media_validation_v2(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256,
    p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height)
$$;
CREATE OR REPLACE FUNCTION public.phase9_fail_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_retryable boolean,p_safe_error_code text
) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.phase9_fail_media_validation_v2(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_retryable,p_safe_error_code)
$$;

CREATE FUNCTION public.phase9_submit_public_copy_media_v2(
  p_inventory_id uuid,p_capability_id uuid,p_media_asset_id uuid,p_role text,
  p_public_order integer,p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_cap public.phase9_upload_capabilities;
  v_asset public.media_assets; v_source public.media_assets; v_link uuid; v_replay jsonb;
BEGIN
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7BC21',p_idempotency_key,
    concat_ws('|',p_command_id,p_inventory_id,p_capability_id,p_media_asset_id,p_role,p_public_order));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'mediaLinkId')::uuid; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id FOR UPDATE;
  SELECT * INTO v_asset FROM public.media_assets WHERE id=p_media_asset_id;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_asset.source_media_asset_id;
  IF v_cap.id IS NULL OR v_cap.status<>'consumed'
    OR v_cap.bound_entity_id<>p_inventory_id OR v_cap.store_id<>v_inventory.store_id
    OR v_cap.issued_to_user_id<>auth.uid() OR v_cap.bound_ordinal<>p_public_order
    OR p_role<>v_cap.public_copy_role
    OR v_cap.consumed_media_asset_id<>v_source.id
    OR v_source.bucket_id<>v_cap.bucket_id OR v_source.object_path<>v_cap.object_path
    OR v_source.sha256<>v_cap.source_sha256 OR v_asset.store_id<>v_inventory.store_id
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  INSERT INTO public.inventory_media_links(store_id,inventory_id,media_asset_id,role,
    public_order,approval_status,approved_by,approved_at)
  VALUES(v_inventory.store_id,p_inventory_id,p_media_asset_id,p_role,p_public_order,
    'approved',auth.uid(),transaction_timestamp()) RETURNING id INTO v_link;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7BC21',p_idempotency_key,
    jsonb_build_object('mediaLinkId',v_link),'public_media_linked'); RETURN v_link;
END$$;

ALTER TABLE marketplace_sec.phase9_worker_wake_dispatches
  DROP CONSTRAINT phase9_worker_wake_dispatches_job_kind_check,
  ADD CONSTRAINT phase9_worker_wake_dispatches_job_kind_check CHECK(job_kind IN (
    'media_validate_sanitize','vision_extract','metadata_enrich','publication_retry'));

CREATE OR REPLACE FUNCTION marketplace_sec.has_claimable_phase9_work(p_job_kind text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_job_kind NOT IN ('media_validate_sanitize','vision_extract','metadata_enrich','publication_retry')
    THEN RAISE EXCEPTION 'P9_DISPATCH_KIND_INVALID'; END IF;
  RETURN EXISTS(SELECT 1 FROM public.image_extraction_jobs j
    WHERE j.job_kind=p_job_kind AND j.status IN ('open','retry_scheduled','in_progress')
      AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tick timestamptz:=date_trunc('minute',transaction_timestamp());
  v_kind text; v_url_name text; v_token_name text; v_url text; v_token text;
  v_row bigint; v_dispatch uuid; v_request bigint; v_reconciled integer:=0;
  v_dispatched integer:=0; v_missing integer:=0; v_failed integer:=0;
BEGIN
  UPDATE marketplace_sec.phase9_worker_wake_dispatches d SET
    response_state=CASE WHEN coalesce(r.timed_out,false) THEN 'timed_out'
      WHEN r.error_msg IS NOT NULL THEN 'network_failed'
      WHEN r.status_code BETWEEN 200 AND 299 THEN 'succeeded' ELSE 'http_failed' END,
    http_status=r.status_code,updated_at=transaction_timestamp()
  FROM net._http_response r WHERE d.request_id=r.id AND d.response_state='pending';
  GET DIAGNOSTICS v_reconciled=ROW_COUNT;
  DELETE FROM marketplace_sec.phase9_worker_wake_dispatches
    WHERE created_at<transaction_timestamp()-interval '7 days';
  FOR v_kind,v_url_name,v_token_name IN SELECT * FROM (VALUES
    ('media_validate_sanitize','phase9_media_worker_url','phase9_media_worker_ingress_token'),
    ('vision_extract','phase9_vision_worker_url','phase9_vision_worker_ingress_token'),
    ('metadata_enrich','phase9_metadata_worker_url','phase9_metadata_worker_ingress_token'),
    ('publication_retry','phase9_publication_worker_url','phase9_publication_worker_ingress_token')
  ) stages(kind,url_name,token_name) LOOP
    CONTINUE WHEN NOT marketplace_sec.has_claimable_phase9_work(v_kind);
    v_row:=NULL; v_dispatch:=NULL;
    INSERT INTO marketplace_sec.phase9_worker_wake_dispatches(
      tick_started_at,job_kind,dispatch_state,response_state
    ) VALUES(v_tick,v_kind,'configuration_missing','not_requested')
    ON CONFLICT(tick_started_at,job_kind) DO NOTHING
    RETURNING id,dispatch_id INTO v_row,v_dispatch;
    CONTINUE WHEN v_row IS NULL;
    BEGIN
      SELECT max(s.decrypted_secret) FILTER(WHERE s.name=v_url_name),
        max(s.decrypted_secret) FILTER(WHERE s.name=v_token_name)
      INTO v_url,v_token FROM vault.decrypted_secrets s
      WHERE s.name IN(v_url_name,v_token_name);
      IF v_url IS NULL OR v_token IS NULL
        OR v_url!~*'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$'
        OR char_length(v_token) NOT BETWEEN 32 AND 256 OR v_token~'[[:space:][:cntrl:]]'
      THEN v_missing:=v_missing+1; CONTINUE; END IF;
      v_request:=net.http_post(url:=rtrim(v_url,'/')||'/run',
        body:=jsonb_build_object('contractVersion','phase9-v1','batchSize',1),
        params:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json',
          'Authorization','Bearer '||v_token,'x-phase9-dispatch-id',v_dispatch::text),
        timeout_milliseconds:=120000);
      UPDATE marketplace_sec.phase9_worker_wake_dispatches SET request_id=v_request,
        dispatch_state='enqueued',response_state='pending',updated_at=transaction_timestamp()
        WHERE id=v_row; v_dispatched:=v_dispatched+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE marketplace_sec.phase9_worker_wake_dispatches SET
        dispatch_state='enqueue_failed',response_state='not_requested',updated_at=transaction_timestamp()
        WHERE id=v_row; v_failed:=v_failed+1;
    END;
  END LOOP;
  RETURN jsonb_build_object('reconciled',v_reconciled,'dispatched',v_dispatched,
    'configured_missing',v_missing,'enqueue_failed',v_failed);
END$$;

REVOKE ALL ON FUNCTION public.phase9_request_publication(uuid,integer,text,uuid),
  public.phase9_retry_publication(uuid,integer,text,uuid,text),
  public.phase9_set_publication_state(uuid,integer,text,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_project_inventory(uuid)
  FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.phase9_set_publication_state_v2(uuid,integer,integer,text,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_retry_publication_owner_v1(uuid,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.claim_phase9_publication_jobs(integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_retry_publication_worker_v1(uuid,integer,uuid,uuid,integer,text,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_fail_publication_job_v1(uuid,uuid,text,integer,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_inventory_page_v2(integer,text,text,text,text,text,text,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_publication_status_v2(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_authorize_public_copy_upload_v2(uuid,text,integer,text,bigint,text,timestamptz,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_public_copy_upload_context_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_register_public_copy_upload_v1(uuid,uuid,text,text,text,bigint,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_public_copy_status_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_media_validation_context_v2(uuid,text,text,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_revalidate_media_validation_lease_v2(uuid,text,text,integer,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_fail_media_validation_v2(uuid,text,text,integer,boolean,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_submit_public_copy_media_v2(uuid,uuid,uuid,text,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_public_listing_detail_v2(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_public_listing_search_v2(text,uuid,integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.phase9_set_publication_state_v2(uuid,integer,integer,text,text,uuid),
  public.phase9_retry_publication_owner_v1(uuid,integer,text,uuid),
  public.phase9_owner_inventory_page_v2(integer,text,text,text,text,text,text,text,text),
  public.phase9_publication_status_v2(uuid),
  public.phase9_authorize_public_copy_upload_v2(uuid,text,integer,text,bigint,text,timestamptz,text,uuid),
  public.phase9_public_copy_status_v1(uuid),
  public.phase9_submit_public_copy_media_v2(uuid,uuid,uuid,text,integer,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_set_publication_state_v2(uuid,integer,integer,text,text,uuid),
  public.phase9_retry_publication_owner_v1(uuid,integer,text,uuid),
  public.phase9_owner_inventory_page_v2(integer,text,text,text,text,text,text,text,text),
  public.phase9_publication_status_v2(uuid),
  public.phase9_authorize_public_copy_upload_v2(uuid,text,integer,text,bigint,text,timestamptz,text,uuid),
  public.phase9_public_copy_status_v1(uuid),
  public.phase9_submit_public_copy_media_v2(uuid,uuid,uuid,text,integer,text,uuid)
  TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.phase9_public_copy_upload_context_v1(uuid,uuid),
  public.phase9_register_public_copy_upload_v1(uuid,uuid,text,text,text,bigint,text,uuid),
  public.phase9_media_validation_context_v2(uuid,text,text,integer),
  public.phase9_revalidate_media_validation_lease_v2(uuid,text,text,integer,text,text),
  public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text),
  public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
  public.phase9_fail_media_validation_v2(uuid,text,text,integer,boolean,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_public_copy_upload_context_v1(uuid,uuid),
  public.phase9_register_public_copy_upload_v1(uuid,uuid,text,text,text,bigint,text,uuid),
  public.phase9_media_validation_context_v2(uuid,text,text,integer),
  public.phase9_revalidate_media_validation_lease_v2(uuid,text,text,integer,text,text),
  public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text),
  public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
  public.phase9_fail_media_validation_v2(uuid,text,text,integer,boolean,text)
  TO service_role;

REVOKE ALL ON FUNCTION public.claim_phase9_publication_jobs(integer,text),
  public.phase9_retry_publication_worker_v1(uuid,integer,uuid,uuid,integer,text,text,uuid),
  public.phase9_fail_publication_job_v1(uuid,uuid,text,integer,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_phase9_publication_jobs(integer,text),
  public.phase9_retry_publication_worker_v1(uuid,integer,uuid,uuid,integer,text,text,uuid),
  public.phase9_fail_publication_job_v1(uuid,uuid,text,integer,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.phase9_public_listing_detail_v2(uuid),
  public.phase9_public_listing_search_v2(text,uuid,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_public_listing_detail_v2(uuid),
  public.phase9_public_listing_search_v2(text,uuid,integer) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION
  marketplace_sec.validate_inventory_media_link(),
  marketplace_sec.phase9_public_listing_json(public.marketplace_book_listings),
  marketplace_sec.phase9_store_publication_ineligibility(uuid,boolean),
  marketplace_sec.phase9_public_media_eligible(public.inventory_media_links,public.media_assets),
  marketplace_sec.phase9_publication_ineligibility(public.store_inventory),
  marketplace_sec.phase9_publication_result(uuid,text,text),
  marketplace_sec.phase9_record_publication(public.store_inventory,text,text,uuid,uuid),
  marketplace_sec.phase9_owner_ux_close_summary(uuid),
  marketplace_sec.phase9_refresh_listing_for_media_change(),
  marketplace_sec.phase9_refresh_listing_for_media_asset_change(),
  marketplace_sec.has_claimable_phase9_work(text),
  marketplace_sec.dispatch_phase9_worker_wakes()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.store_inventory,public.marketplace_book_listings FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_marketplace_listing_from_inventory() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory() TO service_role;

COMMIT;
