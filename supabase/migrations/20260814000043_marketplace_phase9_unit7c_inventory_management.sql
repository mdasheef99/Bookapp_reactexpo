-- Phase 9 Unit 7C WU1: controlled post-commit inventory management.
-- Source: Unit 7C SDD §§2, 5-7, 9, 11, 13-15.
-- Forward-only candidate. M39-M42 remain immutable.

BEGIN;

CREATE TABLE public.phase9_publication_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  inventory_id uuid NOT NULL REFERENCES public.store_inventory(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  inventory_version integer NOT NULL CHECK (inventory_version >= 1),
  publication_intent_version integer NOT NULL CHECK (publication_intent_version >= 1),
  -- Historical evidence intentionally does not foreign-key the projection row:
  -- Make Private may retract/delete that derived row while the revision survives.
  listing_id uuid,
  source_action text NOT NULL CHECK (source_action IN (
    'initial_publish','republish','retry','save_details','stock_adjustment','media_change'
  )),
  command_id uuid NOT NULL,
  public_snapshot jsonb NOT NULL CHECK (jsonb_typeof(public_snapshot)='object'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (inventory_id,revision_number)
);

CREATE INDEX phase9_publication_revisions_store_inventory_idx
  ON public.phase9_publication_revisions(store_id,inventory_id,revision_number DESC);

ALTER TABLE public.phase9_publication_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase9_publication_revisions
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_reject_publication_revision_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'P9_APPEND_ONLY_HISTORY';
END$$;

CREATE TRIGGER phase9_publication_revisions_append_only
BEFORE UPDATE OR DELETE ON public.phase9_publication_revisions
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_reject_publication_revision_mutation();

CREATE FUNCTION marketplace_sec.phase9_append_publication_revision_v1(
  p_inventory public.store_inventory,p_source_action text,p_command_id uuid,
  p_force boolean DEFAULT false
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_listing public.marketplace_book_listings; v_snapshot jsonb;
  v_previous jsonb; v_revision integer;
BEGIN
  IF p_inventory.id IS NULL OR p_command_id IS NULL OR p_source_action NOT IN (
    'initial_publish','republish','retry','save_details','stock_adjustment','media_change'
  ) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_inventory.visibility_status<>'published'
    OR p_inventory.publication_status<>'published' THEN RETURN NULL; END IF;
  SELECT * INTO v_listing FROM public.marketplace_book_listings
    WHERE inventory_id=p_inventory.id;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'P9_PUBLICATION_TRANSIENT'; END IF;
  v_snapshot:=marketplace_sec.phase9_public_listing_json(v_listing);
  SELECT r.public_snapshot INTO v_previous
  FROM public.phase9_publication_revisions r
  WHERE r.inventory_id=p_inventory.id ORDER BY r.revision_number DESC LIMIT 1;
  IF NOT p_force AND v_previous IS NOT DISTINCT FROM v_snapshot THEN RETURN NULL; END IF;
  SELECT coalesce(max(r.revision_number),0)+1 INTO v_revision
  FROM public.phase9_publication_revisions r WHERE r.inventory_id=p_inventory.id;
  INSERT INTO public.phase9_publication_revisions(
    store_id,inventory_id,revision_number,inventory_version,
    publication_intent_version,listing_id,source_action,command_id,public_snapshot
  ) VALUES(
    p_inventory.store_id,p_inventory.id,v_revision,p_inventory.version,
    p_inventory.publication_intent_version,v_listing.id,p_source_action,p_command_id,v_snapshot
  );
  RETURN v_revision;
END$$;

-- Hook the existing Unit 7B lifecycle path without adding a second publication writer.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_record_publication(
  p_inventory public.store_inventory,p_action text,p_outcome text,p_command_id uuid,
  p_actor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_source text;
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
        WHEN 'private' THEN 'private' ELSE 'failed' END,
    'store_inventory',p_inventory.id,p_actor,
    jsonb_build_object('commandId',p_command_id,
      'publicationIntentVersion',p_inventory.publication_intent_version));
  IF p_outcome='published' THEN
    IF p_action='retry' THEN v_source:='retry';
    ELSIF EXISTS(SELECT 1 FROM public.phase9_publication_revisions r
      WHERE r.inventory_id=p_inventory.id) THEN v_source:='republish';
    ELSE v_source:='initial_publish'; END IF;
    PERFORM marketplace_sec.phase9_append_publication_revision_v1(
      p_inventory,v_source,p_command_id,true);
  END IF;
END$$;

-- M42 forward successor: generated/default-owned listing fields remain omitted.
-- A published zero-stock row is a valid out-of-stock projection, while C26 keeps
-- initial zero-stock publication ineligible through the unchanged eligibility gate.
CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store public.stores; v_locality text; v_media_count integer;
  v_primary uuid; v_primary_path text; v_cover text; v_availability text;
  v_status text; v_reason text;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE id=NEW.store_id;
  SELECT name INTO v_locality FROM public.marketplace_localities WHERE id=v_store.locality_id;
  IF NEW.visibility_status='paused' THEN
    UPDATE public.marketplace_book_listings SET status='paused',
      availability_status='unavailable',updated_at=transaction_timestamp()
      WHERE inventory_id=NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.visibility_status<>'published'
    OR NEW.publication_status NOT IN ('publication_pending','published') THEN
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

  v_reason:=marketplace_sec.phase9_publication_ineligibility(NEW);
  IF v_reason IS NOT NULL AND v_reason<>'stock' THEN
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
  v_status:=CASE WHEN NEW.quantity_available=0 THEN 'out_of_stock' ELSE 'active' END;

  INSERT INTO public.marketplace_book_listings(
    inventory_id,store_id,canonical_work_id,canonical_edition_id,public_title,
    public_authors,public_cover_url,isbn_10,isbn_13,condition,
    public_condition_notes,selling_price_minor,availability_status,
    fulfillment_options,status,listing_quality_status,
    store_city,store_locality_id,store_locality_name,pickup_available,
    delivery_available,language,public_description,edition_statement,volume,
    format,has_damage,public_damage_notes,damage_types,primary_public_media_id,
    public_media_count,last_inventory_verified_bucket,search_document,updated_at
  ) VALUES(
    NEW.id,NEW.store_id,NEW.canonical_work_id,NEW.canonical_edition_id,NEW.title,
    NEW.authors,v_cover,NEW.isbn_10,NEW.isbn_13,
    NEW.condition,coalesce(NEW.public_notes,NEW.condition_notes),NEW.selling_price_minor,
    v_availability,array_remove(ARRAY[
      CASE WHEN v_store.pickup_enabled THEN 'pickup' END,
      CASE WHEN v_store.delivery_enabled THEN 'delivery' END],NULL),
    v_status,NEW.listing_quality_status,v_store.city,v_store.locality_id,
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
    public_cover_url=excluded.public_cover_url,
    isbn_10=excluded.isbn_10,isbn_13=excluded.isbn_13,condition=excluded.condition,
    public_condition_notes=excluded.public_condition_notes,
    selling_price_minor=excluded.selling_price_minor,
    availability_status=excluded.availability_status,
    fulfillment_options=excluded.fulfillment_options,status=excluded.status,
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

CREATE FUNCTION public.phase9_update_store_inventory_details_v1(
  p_inventory_id uuid,p_expected_inventory_version integer,p_changes jsonb,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_proposed public.store_inventory;
  v_store uuid; v_replay jsonb; v_result jsonb; v_fingerprint text;
  v_reason text; v_revision integer; v_changed_fields text[]; v_public_changed boolean;
BEGIN
  IF p_command_id IS NULL OR coalesce(char_length(p_idempotency_key),0) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_changes)<>'object' OR p_changes='{}'::jsonb THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) AS key
    WHERE key<>ALL(ARRAY['title','authors','language','publicDescription',
      'sellingPriceMinor','condition','publicConditionNote','hasDamage','damageTypes',
      'damageNote','isSellable','shelfLocation','internalNotes'])) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',auth.uid(),p_command_id,
    p_inventory_id,p_expected_inventory_version,p_changes::text),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7CC01',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_inventory FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF v_inventory.version<>p_expected_inventory_version THEN
    RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  v_proposed:=v_inventory;

  IF p_changes?'title' THEN
    IF jsonb_typeof(p_changes->'title')<>'string' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.title:=btrim(p_changes->>'title');
  END IF;
  IF p_changes?'authors' THEN
    IF jsonb_typeof(p_changes->'authors')<>'array' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    SELECT coalesce(array_agg(btrim(value) ORDER BY ordinal),'{}'::text[])
      INTO v_proposed.authors
    FROM jsonb_array_elements_text(p_changes->'authors') WITH ORDINALITY AS a(value,ordinal);
  END IF;
  IF p_changes?'language' THEN
    IF jsonb_typeof(p_changes->'language')<>'string' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.language:=replace(btrim(p_changes->>'language'),'_','-');
  END IF;
  IF p_changes?'publicDescription' THEN
    IF jsonb_typeof(p_changes->'publicDescription') NOT IN ('string','null') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.description:=nullif(btrim(p_changes->>'publicDescription'),'');
  END IF;
  IF p_changes?'sellingPriceMinor' THEN
    IF jsonb_typeof(p_changes->'sellingPriceMinor')<>'number'
      OR (p_changes->>'sellingPriceMinor')!~ '^[0-9]+$' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.selling_price_minor:=(p_changes->>'sellingPriceMinor')::integer;
  END IF;
  IF p_changes?'condition' THEN
    IF jsonb_typeof(p_changes->'condition')<>'string' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.condition:=p_changes->>'condition';
  END IF;
  IF p_changes?'publicConditionNote' THEN
    IF jsonb_typeof(p_changes->'publicConditionNote') NOT IN ('string','null') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.public_notes:=nullif(btrim(p_changes->>'publicConditionNote'),'');
  END IF;
  IF p_changes?'hasDamage' THEN
    IF jsonb_typeof(p_changes->'hasDamage')<>'boolean' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.has_damage:=(p_changes->>'hasDamage')::boolean;
    IF NOT v_proposed.has_damage THEN
      v_proposed.damage_types:='{}'::text[]; v_proposed.damage_notes:=NULL;
    END IF;
  END IF;
  IF p_changes?'damageTypes' THEN
    IF jsonb_typeof(p_changes->'damageTypes')<>'array' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    SELECT coalesce(array_agg(value ORDER BY ordinal),'{}'::text[])
      INTO v_proposed.damage_types
    FROM jsonb_array_elements_text(p_changes->'damageTypes') WITH ORDINALITY AS d(value,ordinal);
  END IF;
  IF p_changes?'damageNote' THEN
    IF jsonb_typeof(p_changes->'damageNote') NOT IN ('string','null') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.damage_notes:=nullif(btrim(p_changes->>'damageNote'),'');
  END IF;
  IF p_changes?'isSellable' THEN
    IF jsonb_typeof(p_changes->'isSellable')<>'boolean' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.is_sellable:=(p_changes->>'isSellable')::boolean;
  END IF;
  IF p_changes?'shelfLocation' THEN
    IF jsonb_typeof(p_changes->'shelfLocation') NOT IN ('string','null') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.shelf_location:=nullif(btrim(p_changes->>'shelfLocation'),'');
  END IF;
  IF p_changes?'internalNotes' THEN
    IF jsonb_typeof(p_changes->'internalNotes') NOT IN ('string','null') THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_proposed.internal_notes:=nullif(btrim(p_changes->>'internalNotes'),'');
  END IF;

  IF char_length(v_proposed.title) NOT BETWEEN 1 AND 512
    OR coalesce(array_length(v_proposed.authors,1),0)>20
    OR EXISTS(SELECT 1 FROM unnest(v_proposed.authors) a
      WHERE char_length(a) NOT BETWEEN 1 AND 256)
    OR v_proposed.language IS NULL
    OR v_proposed.language !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    OR coalesce(char_length(v_proposed.description),0)>5000
    OR v_proposed.selling_price_minor<0
    OR v_proposed.condition NOT IN ('new','like_new','very_good','good','acceptable')
    OR coalesce(char_length(v_proposed.public_notes),0)>1000
    OR coalesce(char_length(v_proposed.damage_notes),0)>1000
    OR coalesce(char_length(v_proposed.shelf_location),0)>120
    OR coalesce(char_length(v_proposed.internal_notes),0)>1000
    OR coalesce(array_length(v_proposed.damage_types,1),0)>9
    OR EXISTS(SELECT 1 FROM unnest(v_proposed.damage_types) d WHERE d NOT IN
      ('cover','binding','pages','water','staining','writing','missing_parts',
       'mould_or_contamination','other'))
    OR (v_proposed.has_damage AND (coalesce(array_length(v_proposed.damage_types,1),0)=0
      OR v_proposed.damage_notes IS NULL))
    OR (NOT v_proposed.has_damage AND (coalesce(array_length(v_proposed.damage_types,1),0)>0
      OR v_proposed.damage_notes IS NOT NULL))
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  v_proposed.listing_quality_status:=marketplace_sec.phase9_inventory_quality_status_v1(v_proposed);
  IF ROW(v_inventory.title,v_inventory.authors,v_inventory.language,v_inventory.description,
      v_inventory.selling_price_minor,v_inventory.condition,v_inventory.public_notes,
      v_inventory.has_damage,v_inventory.damage_types,v_inventory.damage_notes,
      v_inventory.is_sellable,v_inventory.shelf_location,v_inventory.internal_notes)
    IS NOT DISTINCT FROM
    ROW(v_proposed.title,v_proposed.authors,v_proposed.language,v_proposed.description,
      v_proposed.selling_price_minor,v_proposed.condition,v_proposed.public_notes,
      v_proposed.has_damage,v_proposed.damage_types,v_proposed.damage_notes,
      v_proposed.is_sellable,v_proposed.shelf_location,v_proposed.internal_notes)
  THEN RAISE EXCEPTION 'P9_NO_CHANGES'; END IF;
  v_public_changed:=ROW(v_inventory.title,v_inventory.authors,v_inventory.language,
      v_inventory.description,v_inventory.selling_price_minor,v_inventory.condition,
      v_inventory.public_notes,v_inventory.has_damage,v_inventory.damage_types,
      v_inventory.damage_notes,v_inventory.is_sellable,v_inventory.listing_quality_status)
    IS DISTINCT FROM
    ROW(v_proposed.title,v_proposed.authors,v_proposed.language,
      v_proposed.description,v_proposed.selling_price_minor,v_proposed.condition,
      v_proposed.public_notes,v_proposed.has_damage,v_proposed.damage_types,
      v_proposed.damage_notes,v_proposed.is_sellable,v_proposed.listing_quality_status);

  IF v_inventory.visibility_status='published'
    AND v_inventory.publication_status='published' THEN
    v_reason:=marketplace_sec.phase9_publication_ineligibility(v_proposed);
    IF v_reason='damage_media' THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
    IF v_reason IS NOT NULL AND v_reason<>'stock' THEN
      RAISE EXCEPTION 'P9_PUBLICATION_INELIGIBLE:%',v_reason; END IF;
  END IF;

  SELECT array_agg(key ORDER BY key) INTO v_changed_fields
  FROM jsonb_object_keys(p_changes) AS key;
  IF v_public_changed THEN
    UPDATE public.store_inventory SET
      title=v_proposed.title,authors=v_proposed.authors,language=v_proposed.language,
      description=v_proposed.description,selling_price_minor=v_proposed.selling_price_minor,
      condition=v_proposed.condition,public_notes=v_proposed.public_notes,
      has_damage=v_proposed.has_damage,damage_types=v_proposed.damage_types,
      damage_notes=v_proposed.damage_notes,is_sellable=v_proposed.is_sellable,
      shelf_location=v_proposed.shelf_location,internal_notes=v_proposed.internal_notes,
      listing_quality_status=v_proposed.listing_quality_status,
      version=version+1,updated_at=transaction_timestamp()
    WHERE id=p_inventory_id RETURNING * INTO v_inventory;
  ELSE
    UPDATE public.store_inventory SET shelf_location=v_proposed.shelf_location,
      internal_notes=v_proposed.internal_notes,version=version+1,
      updated_at=transaction_timestamp()
    WHERE id=p_inventory_id RETURNING * INTO v_inventory;
  END IF;

  v_revision:=marketplace_sec.phase9_append_publication_revision_v1(
    v_inventory,'save_details',p_command_id,false);
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details
  ) VALUES(v_inventory.store_id,'phase9.inventory.details_updated','store_inventory',
    v_inventory.id,auth.uid(),jsonb_build_object('commandId',p_command_id,
      'inventoryVersion',v_inventory.version,'changedFields',v_changed_fields));
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,source,payload
  ) VALUES(v_inventory.store_id,'inventory.details.updated','store_inventory',
    v_inventory.id,auth.uid(),'store_owner_app',jsonb_build_object(
      'commandId',p_command_id,'inventoryVersion',v_inventory.version));
  v_result:=jsonb_build_object('inventoryId',v_inventory.id,
    'inventoryVersion',v_inventory.version,
    'publicationIntentVersion',v_inventory.publication_intent_version,
    'publicRevisionNumber',v_revision,'outcome','details_updated');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7CC01',
    p_idempotency_key,v_result,'inventory_details_updated');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_adjust_inventory_stock_v2(
  p_inventory_id uuid,p_expected_inventory_version integer,p_delta integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_store uuid; v_replay jsonb;
  v_result jsonb; v_fingerprint text; v_revision integer;
BEGIN
  IF p_command_id IS NULL OR coalesce(char_length(p_idempotency_key),0) NOT BETWEEN 1 AND 200
    OR p_delta=0 OR abs(p_delta)>10000 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',auth.uid(),p_command_id,
    p_inventory_id,p_expected_inventory_version,p_delta),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7CC02',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_inventory FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF v_inventory.version<>p_expected_inventory_version THEN
    RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  PERFORM 1 FROM public.inventory_holds h
    WHERE h.inventory_id=p_inventory_id AND h.status='active' FOR UPDATE;
  IF v_inventory.quantity_total<0 OR v_inventory.quantity_available<0
    OR v_inventory.quantity_reserved<0 OR v_inventory.quantity_sold<0
    OR v_inventory.quantity_removed<0
    OR v_inventory.quantity_total<>v_inventory.quantity_available+
      v_inventory.quantity_reserved+v_inventory.quantity_sold+v_inventory.quantity_removed
    OR v_inventory.quantity_available+p_delta<0
    OR v_inventory.quantity_total+p_delta<0
  THEN RAISE EXCEPTION 'P9_QUANTITY_INVARIANT_FAILED'; END IF;

  UPDATE public.store_inventory SET
    quantity_total=quantity_total+p_delta,
    quantity_available=quantity_available+p_delta,
    version=version+1,updated_at=transaction_timestamp()
  WHERE id=p_inventory_id RETURNING * INTO v_inventory;
  v_revision:=marketplace_sec.phase9_append_publication_revision_v1(
    v_inventory,'stock_adjustment',p_command_id,false);
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details
  ) VALUES(v_inventory.store_id,'phase9.inventory.stock_adjusted','store_inventory',
    v_inventory.id,auth.uid(),jsonb_build_object('commandId',p_command_id,
      'inventoryVersion',v_inventory.version,'delta',p_delta));
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,source,payload
  ) VALUES(v_inventory.store_id,'inventory.stock.adjusted','store_inventory',
    v_inventory.id,auth.uid(),'store_owner_app',jsonb_build_object(
      'commandId',p_command_id,'inventoryVersion',v_inventory.version));
  v_result:=jsonb_build_object('inventoryId',v_inventory.id,
    'inventoryVersion',v_inventory.version,
    'publicationIntentVersion',v_inventory.publication_intent_version,
    'stockState',CASE WHEN v_inventory.quantity_available=0 THEN 'out_of_stock'
      WHEN v_inventory.quantity_available=1 THEN 'low_stock' ELSE 'available' END,
    'publicRevisionNumber',v_revision,'outcome','stock_adjusted');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7CC02',
    p_idempotency_key,v_result,'inventory_stock_adjusted');
  RETURN v_result;
END$$;

CREATE FUNCTION marketplace_sec.phase9_store_view_item_v1(
  p_inventory public.store_inventory,p_detail boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_listing public.marketplace_book_listings; v_reasons text[]:='{}';
  v_capabilities text[]:=ARRAY['edit_details','adjust_stock','manage_photos'];
  v_reason text; v_effective text; v_result jsonb; v_stock text;
BEGIN
  SELECT * INTO v_listing FROM public.marketplace_book_listings
    WHERE inventory_id=p_inventory.id;
  v_reason:=marketplace_sec.phase9_publication_ineligibility(p_inventory);
  IF p_inventory.listing_quality_status='missing_metadata' THEN
    v_reasons:=array_append(v_reasons,'missing_metadata');
  ELSIF p_inventory.listing_quality_status='missing_price' THEN
    v_reasons:=array_append(v_reasons,'missing_price');
  ELSIF p_inventory.listing_quality_status='missing_condition' THEN
    v_reasons:=array_append(v_reasons,'missing_condition');
  ELSIF p_inventory.listing_quality_status='needs_photo' THEN
    v_reasons:=array_append(v_reasons,'damage_evidence_required');
  END IF;
  IF NOT p_inventory.is_sellable AND NOT ('not_sellable'=ANY(v_reasons)) THEN
    v_reasons:=array_append(v_reasons,'not_sellable'); END IF;
  IF p_inventory.publication_status='publication_failed' THEN
    v_reasons:=array_append(v_reasons,'publication_failed'); END IF;
  IF v_reason='damage_media' AND NOT ('damage_evidence_required'=ANY(v_reasons)) THEN
    v_reasons:=array_append(v_reasons,'damage_evidence_required');
  ELSIF v_reason='moderation' THEN v_reasons:=array_append(v_reasons,'moderation_blocked');
  ELSIF v_reason IN ('store_policy','pilot_locality','marketplace_feature','store_allowlist') THEN
    v_reasons:=array_append(v_reasons,'store_policy_blocked');
  ELSIF v_reason='subscription' THEN v_reasons:=array_append(v_reasons,'subscription_restricted');
  ELSIF v_reason='entitlement' THEN v_reasons:=array_append(v_reasons,'entitlement_blocked');
  ELSIF v_reason='active_listing_limit' THEN v_reasons:=array_append(v_reasons,'active_listing_limit_reached');
  ELSIF v_reason='price' AND NOT ('missing_price'=ANY(v_reasons)) THEN
    v_reasons:=array_append(v_reasons,'missing_price');
  ELSIF v_reason='condition' AND NOT ('missing_condition'=ANY(v_reasons)) THEN
    v_reasons:=array_append(v_reasons,'missing_condition'); END IF;

  v_stock:=CASE WHEN p_inventory.quantity_available=0 THEN 'out_of_stock'
    WHEN p_inventory.quantity_available=1 THEN 'low_stock' ELSE 'available' END;
  IF p_inventory.publication_status='publication_failed' THEN v_effective:='publication_failed';
  ELSIF array_length(v_reasons,1)>0 THEN v_effective:='needs_attention';
  ELSIF p_inventory.quantity_available=0 THEN v_effective:='out_of_stock';
  ELSIF p_inventory.visibility_status='published' THEN v_effective:='live';
  ELSIF p_inventory.visibility_status='paused' THEN v_effective:='paused';
  ELSE v_effective:='private'; END IF;
  IF p_inventory.visibility_status='published' THEN
    v_capabilities:=v_capabilities||ARRAY['pause','make_private'];
  ELSIF p_inventory.visibility_status='paused' THEN
    v_capabilities:=v_capabilities||ARRAY['make_private'];
    IF array_length(v_reasons,1) IS NULL AND p_inventory.quantity_available>0 THEN
      v_capabilities:=v_capabilities||ARRAY['republish']; END IF;
  ELSE
    IF array_length(v_reasons,1) IS NULL AND p_inventory.quantity_available>0 THEN
      v_capabilities:=v_capabilities||ARRAY['publish']; END IF;
  END IF;
  IF p_inventory.publication_status='publication_failed'
    AND (v_reasons <@ ARRAY['publication_failed']::text[])
    AND p_inventory.quantity_available>0 THEN
    v_capabilities:=v_capabilities||ARRAY['retry_publication']; END IF;

  v_result:=jsonb_build_object(
    'identity',jsonb_build_object('inventoryId',p_inventory.id),
    'presentation',jsonb_build_object('title',p_inventory.title,
      'authors',coalesce(p_inventory.authors,'{}'),'language',p_inventory.language,
      'publicDescription',p_inventory.description,'condition',p_inventory.condition,
      'publicConditionNote',p_inventory.public_notes,'hasDamage',p_inventory.has_damage,
      'damageTypes',p_inventory.damage_types,'damageNote',p_inventory.damage_notes,
      'isSellable',p_inventory.is_sellable,'sellingPriceMinor',p_inventory.selling_price_minor),
    'stockSummary',jsonb_build_object('quantityAvailable',p_inventory.quantity_available,
      'stockState',v_stock),
    'lifecycle',jsonb_build_object('publicationState',p_inventory.publication_status,
      'effectiveState',v_effective,'visibilityStatus',p_inventory.visibility_status),
    'attention',jsonb_build_object('attentionState',CASE WHEN array_length(v_reasons,1)>0
      THEN 'action_required' ELSE 'none' END,'attentionReasons',to_jsonb(v_reasons)),
    'capabilities',to_jsonb(v_capabilities),
    'versions',jsonb_build_object('inventoryVersion',p_inventory.version,
      'publicationIntentVersion',p_inventory.publication_intent_version),
    'mediaSummary',jsonb_build_object('approvedCount',(SELECT count(*) FROM public.inventory_media_links l
      WHERE l.inventory_id=p_inventory.id AND l.approval_status='approved')),
    'publicState',CASE WHEN v_listing.id IS NULL THEN NULL
      ELSE marketplace_sec.phase9_public_listing_json(v_listing) END
  );
  IF p_detail THEN
    v_result:=v_result||jsonb_build_object(
      'privateOperations',jsonb_build_object('shelfLocation',p_inventory.shelf_location,
        'internalNotes',p_inventory.internal_notes),
      'stock',jsonb_build_object('quantityTotal',p_inventory.quantity_total,
        'quantityAvailable',p_inventory.quantity_available,
        'quantityReserved',p_inventory.quantity_reserved,
        'quantitySold',p_inventory.quantity_sold,
        'quantityRemoved',p_inventory.quantity_removed),
      'historySummary',jsonb_build_object(
        'publicRevisionCount',(SELECT count(*) FROM public.phase9_publication_revisions r
          WHERE r.inventory_id=p_inventory.id),
        'latestPublicRevision',(SELECT jsonb_build_object('revisionNumber',r.revision_number,
          'sourceAction',r.source_action,'createdAt',r.created_at)
          FROM public.phase9_publication_revisions r WHERE r.inventory_id=p_inventory.id
          ORDER BY r.revision_number DESC LIMIT 1)));
  END IF;
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_store_view_page_v1(
  p_page_size integer DEFAULT 20,p_cursor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_cursor_time timestamptz; v_cursor_id uuid;
  v_decoded text; v_items jsonb; v_has_next boolean; v_next text;
BEGIN
  IF p_page_size NOT BETWEEN 1 AND 50 OR coalesce(char_length(p_cursor),0)>512 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_store:=marketplace_sec.phase9_owner_store(NULL);
  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_decoded:=convert_from(decode(p_cursor,'base64'),'UTF8');
      v_cursor_time:=split_part(v_decoded,'|',1)::timestamptz;
      v_cursor_id:=split_part(v_decoded,'|',2)::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END;
  END IF;
  WITH candidates AS MATERIALIZED (
    SELECT i
    FROM public.store_inventory i WHERE i.store_id=v_store
      AND (v_cursor_time IS NULL OR i.updated_at<v_cursor_time
        OR (i.updated_at=v_cursor_time AND i.id<v_cursor_id))
    ORDER BY i.updated_at DESC,i.id DESC LIMIT p_page_size+1
  ), numbered AS (
    SELECT c.i,row_number() OVER (ORDER BY (c.i).updated_at DESC,(c.i).id DESC) AS rn
    FROM candidates c
  )
  SELECT coalesce(jsonb_agg(marketplace_sec.phase9_store_view_item_v1(n.i,false)
      ORDER BY (n.i).updated_at DESC,(n.i).id DESC) FILTER (WHERE n.rn<=p_page_size),'[]'::jsonb),
    count(*)>p_page_size,
    max(CASE WHEN n.rn=p_page_size THEN encode(convert_to((n.i).updated_at::text||'|'||(n.i).id::text,
      'UTF8'),'base64') END)
  INTO v_items,v_has_next,v_next FROM numbered n;
  RETURN jsonb_build_object('items',v_items,'pageInfo',jsonb_build_object(
    'hasNextPage',v_has_next,'nextCursor',CASE WHEN v_has_next THEN v_next END));
END$$;

CREATE FUNCTION public.phase9_store_view_detail_v1(p_inventory_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory;
BEGIN
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN marketplace_sec.phase9_store_view_item_v1(v_inventory,true);
END$$;

ALTER TABLE public.phase9_publication_revisions OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_reject_publication_revision_mutation() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_append_publication_revision_v1(
  public.store_inventory,text,uuid,boolean) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_record_publication(
  public.store_inventory,text,text,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.sync_marketplace_listing_from_inventory() OWNER TO postgres;
ALTER FUNCTION public.phase9_update_store_inventory_details_v1(
  uuid,integer,jsonb,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_adjust_inventory_stock_v2(
  uuid,integer,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_store_view_item_v1(
  public.store_inventory,boolean) OWNER TO postgres;
ALTER FUNCTION public.phase9_store_view_page_v1(integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_store_view_detail_v1(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  marketplace_sec.phase9_reject_publication_revision_mutation(),
  marketplace_sec.phase9_append_publication_revision_v1(public.store_inventory,text,uuid,boolean),
  marketplace_sec.phase9_record_publication(public.store_inventory,text,text,uuid,uuid),
  marketplace_sec.phase9_store_view_item_v1(public.store_inventory,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sync_marketplace_listing_from_inventory()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory()
  TO service_role;

REVOKE ALL ON FUNCTION
  public.phase9_update_store_inventory_details_v1(uuid,integer,jsonb,text,uuid),
  public.phase9_adjust_inventory_stock_v2(uuid,integer,integer,text,uuid),
  public.phase9_store_view_page_v1(integer,text),
  public.phase9_store_view_detail_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  public.phase9_update_store_inventory_details_v1(uuid,integer,jsonb,text,uuid),
  public.phase9_adjust_inventory_stock_v2(uuid,integer,integer,text,uuid),
  public.phase9_store_view_page_v1(integer,text),
  public.phase9_store_view_detail_v1(uuid)
  TO authenticated,service_role;

COMMIT;
