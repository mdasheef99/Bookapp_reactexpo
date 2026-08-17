\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.assert_true(p_ok boolean,p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok,false) THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:%',p_message; END IF;
END$$;

CREATE TEMP TABLE expected_store_view_state(
  inventory_id uuid PRIMARY KEY,
  effective_state text NOT NULL
);

INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
VALUES('7d000000-0000-4000-8000-000000000001','Unit 7C WU2A Locality',true);
INSERT INTO public.stores(
  id,display_name,status,verification_status,setup_status,selling_status,
  pickup_enabled,delivery_enabled,city,locality_id
) VALUES(
  '7d000000-0000-4000-8000-000000000002','Unit 7C WU2A Store','active',
  'approved','complete','allowed',true,false,'Pune',
  '7d000000-0000-4000-8000-000000000001'
);
INSERT INTO public.store_administrators(store_id,user_id,role,status)
VALUES('7d000000-0000-4000-8000-000000000002',
  '7d000000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.store_subscriptions(store_id,status)
VALUES('7d000000-0000-4000-8000-000000000002','trialing');
INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
VALUES('7d000000-0000-4000-8000-000000000002','active_listing_limit',100,true);
INSERT INTO public.marketplace_policy_config(
  policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
) VALUES
  ('marketplace_enabled','global',NULL,'true','boolean',1,true,
    transaction_timestamp()-interval '1 day'),
  ('commerce.store_allowlisted','store','7d000000-0000-4000-8000-000000000002',
    'true','boolean',1,true,transaction_timestamp()-interval '1 day');

WITH source_states(state_name) AS (
  VALUES ('private'),('live'),('paused'),('needs_attention'),('out_of_stock')
), inserted AS (
  INSERT INTO public.store_inventory(
    id,store_id,title,authors,language,description,edition_statement,volume,format,
    condition,selling_price_minor,quantity_total,quantity_available,quantity_reserved,
    quantity_sold,quantity_removed,visibility_status,publication_status,
    publication_intent_version,version,is_sellable,has_damage,damage_types,damage_notes,
    entry_method,created_by,public_notes,shelf_location,internal_notes
  )
  SELECT gen_random_uuid(),'7d000000-0000-4000-8000-000000000002',
    state_name||'-'||ordinal,ARRAY['WU2A Author'],'en','WU2A description',
    'First edition','1','paperback','good',725,3,3,0,0,0,'draft','private',
    1,1,true,false,'{}'::text[],NULL,'manual',
    '7d000000-0000-4000-8000-000000000003','Clean copy','Shelf WU2A','Private note'
  FROM source_states CROSS JOIN generate_series(1,4) ordinal
  RETURNING id,title
)
INSERT INTO expected_store_view_state(inventory_id,effective_state)
SELECT id,split_part(title,'-',1) FROM inserted;

WITH inserted AS (
  INSERT INTO public.store_inventory(
    id,store_id,title,authors,language,description,edition_statement,volume,format,
    condition,selling_price_minor,quantity_total,quantity_available,quantity_reserved,
    quantity_sold,quantity_removed,visibility_status,publication_status,
    publication_intent_version,version,is_sellable,has_damage,damage_types,damage_notes,
    entry_method,created_by,public_notes,shelf_location,internal_notes
  ) VALUES(
    gen_random_uuid(),'7d000000-0000-4000-8000-000000000002','publication-failed-1',
    ARRAY['WU2A Author'],'en','WU2A description','First edition','1','paperback',
    'good',725,3,3,0,0,0,'draft','private',1,1,true,false,'{}'::text[],NULL,
    'manual','7d000000-0000-4000-8000-000000000003','Clean copy','Shelf WU2A','Private note'
  ) RETURNING id
)
INSERT INTO expected_store_view_state(inventory_id,effective_state)
SELECT id,'publication_failed' FROM inserted;

INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
VALUES('7e000000-0000-4000-8000-000000000001','Unit 7C WU2A Foreign Locality',true);
INSERT INTO public.stores(
  id,display_name,status,verification_status,setup_status,selling_status,
  pickup_enabled,delivery_enabled,city,locality_id
) VALUES(
  '7e000000-0000-4000-8000-000000000002','Unit 7C WU2A Foreign Store','active',
  'approved','complete','allowed',true,false,'Pune',
  '7e000000-0000-4000-8000-000000000001'
);
INSERT INTO public.store_administrators(store_id,user_id,role,status)
VALUES('7e000000-0000-4000-8000-000000000002',
  '7e000000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.store_subscriptions(store_id,status)
VALUES('7e000000-0000-4000-8000-000000000002','trialing');
INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
VALUES('7e000000-0000-4000-8000-000000000002','active_listing_limit',100,true);
INSERT INTO public.marketplace_policy_config(
  policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
) VALUES('commerce.store_allowlisted','store','7e000000-0000-4000-8000-000000000002',
  'true','boolean',1,true,transaction_timestamp()-interval '1 day');
INSERT INTO public.store_inventory(
  id,store_id,title,authors,language,description,edition_statement,volume,format,
  condition,selling_price_minor,quantity_total,quantity_available,quantity_reserved,
  quantity_sold,quantity_removed,visibility_status,publication_status,
  publication_intent_version,version,is_sellable,has_damage,damage_types,damage_notes,
  entry_method,created_by,public_notes,shelf_location,internal_notes
)
SELECT gen_random_uuid(),'7e000000-0000-4000-8000-000000000002',
  'foreign-'||ordinal,ARRAY['Foreign Author'],'en','Foreign description',
  'First edition','1','paperback','good',725,3,3,0,0,0,'draft','private',
  1,1,true,false,'{}'::text[],NULL,'manual',
  '7e000000-0000-4000-8000-000000000003','Clean copy','Foreign Shelf','Private note'
FROM generate_series(1,2) ordinal;

CREATE FUNCTION marketplace_sec.phase9_wu2a_projection_fault()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('phase9.wu2a_projection_fault',true)='on'
    AND NEW.visibility_status='published' THEN
    RAISE EXCEPTION 'P9_PUBLICATION_TRANSIENT';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER phase9_wu2a_projection_fault
  BEFORE UPDATE ON public.store_inventory
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_wu2a_projection_fault();

GRANT SELECT ON expected_store_view_state TO authenticated;
SELECT set_config('request.jwt.claim.sub','7d000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

SELECT public.phase9_update_store_inventory_details_v1(
  inventory_id,1,'{"publicDescription":"WU2A prepared"}'::jsonb,
  'wu2a-prepare-'||inventory_id,gen_random_uuid())
FROM expected_store_view_state;

SELECT public.phase9_set_publication_state_v2(
  inventory_id,2,1,'publish','wu2a-live-'||inventory_id,gen_random_uuid())
FROM expected_store_view_state WHERE effective_state='live';

SELECT public.phase9_set_publication_state_v2(
  inventory_id,2,1,'publish','wu2a-paused-publish-'||inventory_id,gen_random_uuid())
FROM expected_store_view_state WHERE effective_state='paused';
SELECT public.phase9_set_publication_state_v2(
  inventory_id,2,2,'pause','wu2a-paused-pause-'||inventory_id,gen_random_uuid())
FROM expected_store_view_state WHERE effective_state='paused';

SELECT public.phase9_update_store_inventory_details_v1(
  inventory_id,2,'{"isSellable":false}'::jsonb,
  'wu2a-attention-'||inventory_id,gen_random_uuid())
FROM expected_store_view_state WHERE effective_state='needs_attention';

SELECT public.phase9_adjust_inventory_stock_v2(
  inventory_id,2,-3,'wu2a-stock-'||inventory_id,gen_random_uuid())
FROM expected_store_view_state WHERE effective_state='out_of_stock';

SELECT set_config('phase9.wu2a_projection_fault','on',false);
SELECT pg_temp.assert_true((public.phase9_set_publication_state_v2(
  inventory_id,2,1,'publish','wu2a-failed-'||inventory_id,gen_random_uuid()
)->>'outcome')='committed_publication_failed','publication failure path did not commit')
FROM expected_store_view_state WHERE effective_state='publication_failed';
SELECT set_config('phase9.wu2a_projection_fault','off',false);

SELECT pg_temp.assert_true(jsonb_array_length(
  public.phase9_store_view_page_v2(1,NULL,'all')->'items')=1,
  'authenticated execution failed');
RESET ROLE;

CREATE FUNCTION pg_temp.collect_store_view_filter(p_filter text,p_page_size integer)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_page jsonb;
  v_cursor text;
  v_ids uuid[]:='{}';
  v_pages integer:=0;
  v_duplicates integer;
BEGIN
  LOOP
    v_page:=public.phase9_store_view_page_v2(p_page_size,v_cursor,p_filter);
    v_pages:=v_pages+1;
    IF p_filter<>'all' AND EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_page->'items') item
      WHERE CASE WHEN p_filter='needs_attention'
        THEN item#>>'{attention,attentionState}'<>'action_required'
        ELSE item#>>'{lifecycle,effectiveState}'<>p_filter END
    ) THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:% leaked another state',p_filter; END IF;
    SELECT v_ids||coalesce(array_agg((item#>>'{identity,inventoryId}')::uuid),'{}'::uuid[])
    INTO v_ids FROM jsonb_array_elements(v_page->'items') item;
    IF (v_page#>>'{pageInfo,hasNextPage}')::boolean THEN
      v_cursor:=v_page#>>'{pageInfo,nextCursor}';
      IF v_cursor IS NULL THEN
        RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:missing next cursor';
      END IF;
    ELSE
      IF v_page#>'{pageInfo,nextCursor}'<>'null'::jsonb THEN
        RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:terminal cursor was not null';
      END IF;
      EXIT;
    END IF;
    IF v_pages>=100 THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:cursor did not terminate'; END IF;
  END LOOP;
  SELECT count(*)-count(DISTINCT id) INTO v_duplicates FROM unnest(v_ids) id;
  IF v_duplicates<>0 THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:duplicate traversal'; END IF;
  RETURN jsonb_build_object('ids',to_jsonb(v_ids),'pages',v_pages);
END$$;

DO $$
DECLARE
  v_filter text;
  v_page_size integer;
  v_first jsonb;
  v_repeat jsonb;
  v_expected integer;
  v_missing integer;
BEGIN
  FOREACH v_filter IN ARRAY ARRAY[
    'all','private','live','paused','needs_attention','out_of_stock'
  ] LOOP
    FOREACH v_page_size IN ARRAY ARRAY[1,2,3] LOOP
      v_first:=pg_temp.collect_store_view_filter(v_filter,v_page_size);
      v_repeat:=pg_temp.collect_store_view_filter(v_filter,v_page_size);
      v_expected:=CASE WHEN v_filter='all' THEN 21
        WHEN v_filter='needs_attention' THEN 5 ELSE 4 END;
      IF jsonb_array_length(v_first->'ids')<>v_expected THEN
        RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:% size % expected %',
          v_filter,jsonb_array_length(v_first->'ids'),v_expected;
      END IF;
      IF (v_first->>'pages')::integer<=1 THEN
        RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:% did not span pages',v_filter;
      END IF;
      IF v_first->'ids'<>v_repeat->'ids' THEN
        RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:% traversal was not deterministic',v_filter;
      END IF;
      SELECT count(*) INTO v_missing FROM (
        (SELECT inventory_id FROM expected_store_view_state
          WHERE v_filter='all'
            OR (v_filter='needs_attention'
              AND effective_state IN ('needs_attention','publication_failed'))
            OR effective_state=v_filter)
        EXCEPT
        (SELECT value::uuid FROM jsonb_array_elements_text(v_first->'ids'))
      ) missing;
      IF v_missing<>0 THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:% omitted rows',v_filter; END IF;
    END LOOP;
  END LOOP;
END$$;

DO $$
DECLARE v_cursor text; v_failed boolean:=false;
BEGIN
  v_cursor:=public.phase9_store_view_page_v2(1,NULL,'needs_attention')#>>'{pageInfo,nextCursor}';
  BEGIN
    PERFORM public.phase9_store_view_page_v2(1,v_cursor,'private');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_CURSOR_INVALID' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:filter cursor mismatch accepted'; END IF;
  v_failed:=false;
  BEGIN
    PERFORM public.phase9_store_view_page_v2(1,NULL,'unknown');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_REQUEST_INVALID' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:invalid filter accepted'; END IF;
  v_failed:=false;
  PERFORM set_config('request.jwt.claim.sub','7e000000-0000-4000-8000-000000000003',false);
  BEGIN
    PERFORM public.phase9_store_view_page_v2(1,v_cursor,'needs_attention');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_CURSOR_INVALID' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:cross-store cursor accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub','7d000000-0000-4000-8000-000000000003',false);
END$$;

DO $$
DECLARE v_failed jsonb; v_ordinary integer; v_out_of_stock integer;
BEGIN
  SELECT item INTO v_failed
  FROM jsonb_array_elements(public.phase9_store_view_page_v2(10,NULL,'needs_attention')->'items') item
  WHERE item#>>'{lifecycle,effectiveState}'='publication_failed';
  PERFORM pg_temp.assert_true(v_failed IS NOT NULL,
    'publication_failed was omitted from needs_attention');
  PERFORM pg_temp.assert_true(v_failed#>>'{lifecycle,effectiveState}'='publication_failed',
    'publication_failed was relabeled by the filter');
  PERFORM pg_temp.assert_true(v_failed#>>'{attention,attentionState}'='action_required',
    'publication_failed attention state changed');
  PERFORM pg_temp.assert_true(v_failed#>'{attention,attentionReasons}' ? 'publication_failed',
    'publication_failed attention reason was omitted');
  PERFORM pg_temp.assert_true(v_failed->'capabilities' ? 'retry_publication',
    'publication_failed retry capability was omitted');
  SELECT count(*) INTO v_ordinary
  FROM jsonb_array_elements(public.phase9_store_view_page_v2(10,NULL,'needs_attention')->'items') item
  WHERE item#>>'{lifecycle,effectiveState}'='needs_attention';
  PERFORM pg_temp.assert_true(v_ordinary=4,
    'ordinary needs_attention rows were not returned');
  SELECT count(*) INTO v_out_of_stock
  FROM jsonb_array_elements(public.phase9_store_view_page_v2(10,NULL,'needs_attention')->'items') item
  WHERE item#>>'{lifecycle,effectiveState}'='out_of_stock';
  PERFORM pg_temp.assert_true(v_out_of_stock=0,
    'out_of_stock leaked into needs_attention');
END$$;

SELECT pg_temp.assert_true((
  SELECT lifecycle->>'effectiveState'='publication_failed'
    AND attention->>'attentionState'='action_required'
    AND attention->'attentionReasons' ? 'publication_failed'
  FROM jsonb_to_record(public.phase9_store_view_detail_v1(
    (SELECT inventory_id FROM expected_store_view_state
      WHERE effective_state='publication_failed')
  )) AS x(lifecycle jsonb,attention jsonb)
),'M43 publication_failed composition changed');

SELECT pg_temp.assert_true(jsonb_array_length(
  public.phase9_store_view_page_v1(1,NULL)->'items')=1,
  'existing Store View page v1 regressed');
SELECT pg_temp.assert_true(public.phase9_store_view_detail_v1(
  (SELECT inventory_id FROM expected_store_view_state LIMIT 1)
)->'identity'->>'inventoryId' IS NOT NULL,'existing Store View detail v1 regressed');

SELECT pg_temp.assert_true((SELECT pg_get_userbyid(p.proowner)='postgres'
  AND p.prosecdef AND EXISTS(
    SELECT 1 FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%')
  AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='phase9_store_view_page_v2'),
  'page v2 security metadata is incorrect');

SELECT set_config('request.jwt.claim.sub','7e000000-0000-4000-8000-000000000003',false);
SELECT pg_temp.assert_true(jsonb_array_length(
  public.phase9_store_view_page_v2(10,NULL,'all')->'items')=2,
  'foreign Owner did not receive exactly the foreign store rows');
SELECT pg_temp.assert_true(NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(
    public.phase9_store_view_page_v2(10,NULL,'all')->'items') item
  JOIN public.store_inventory i
    ON i.id=(item#>>'{identity,inventoryId}')::uuid
  WHERE i.store_id<>'7e000000-0000-4000-8000-000000000002'
),'foreign Owner traversal crossed store scope');

SELECT set_config('request.jwt.claim.sub','7d000000-0000-4000-8000-000000000099',false);
DO $$
DECLARE v_failed boolean:=false;
BEGIN
  BEGIN PERFORM public.phase9_store_view_page_v2(1,NULL,'all');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_OWNER_NOT_AUTHORIZED' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'UNIT7C_WU2A_PROOF:unknown Owner enumerated data'; END IF;
END$$;

SELECT 'UNIT_7C_WU2A_REAL_POSTGRES_FILTER_PASS' AS result;
