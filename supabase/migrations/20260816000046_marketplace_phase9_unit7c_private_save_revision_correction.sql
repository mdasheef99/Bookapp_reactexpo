BEGIN;

-- M46: a private-only Save must not create public history. The existing
-- v_public_changed calculation remains the sole gate; public changes can still
-- create a first valid revision when no historical revision exists.
CREATE OR REPLACE FUNCTION public.phase9_update_store_inventory_details_v1(
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

  IF v_public_changed THEN
    v_revision:=marketplace_sec.phase9_append_publication_revision_v1(
      v_inventory,'save_details',p_command_id,false);
  ELSE
    v_revision:=NULL;
  END IF;
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


ALTER FUNCTION public.phase9_update_store_inventory_details_v1(
  uuid,integer,jsonb,text,uuid
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_update_store_inventory_details_v1(
  uuid,integer,jsonb,text,uuid
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_update_store_inventory_details_v1(
  uuid,integer,jsonb,text,uuid
) TO authenticated,service_role;
COMMENT ON FUNCTION public.phase9_update_store_inventory_details_v1(
  uuid,integer,jsonb,text,uuid
) IS 'Unit 7C M46: append public revision history only for customer-visible Save changes';

COMMIT;
