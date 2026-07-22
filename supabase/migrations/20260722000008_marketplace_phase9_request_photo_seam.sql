-- Phase 9 M08: request-photo persistence, capability seam, and Phase 6 soft-hold integration.
BEGIN;

CREATE TABLE public.order_request_photo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  order_request_id uuid NOT NULL REFERENCES public.store_order_requests(id),
  order_request_item_id uuid NOT NULL REFERENCES public.store_order_request_items(id),
  customer_user_id uuid NOT NULL,
  requested_count smallint NOT NULL CHECK (requested_count BETWEEN 1 AND 3),
  state text NOT NULL DEFAULT 'requested' CHECK (state IN
    ('none','requested','uploading','provided','accepted','declined','unfulfilled','expired')),
  instructions text CHECK (instructions IS NULL OR char_length(instructions)<=500),
  unfulfilled_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  requested_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  provided_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  unfulfilled_at timestamptz,
  expired_at timestamptz,
  confirmation_proposal_version integer,
  confirmed_price_paise integer,
  confirmed_quantity integer,
  confirmation_terms jsonb,
  policy_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE UNIQUE INDEX order_request_photo_one_active_item
  ON public.order_request_photo_requests(order_request_item_id)
  WHERE state IN ('requested','uploading','provided');
CREATE INDEX order_request_photo_actor_state_idx
  ON public.order_request_photo_requests(store_id,customer_user_id,state,updated_at DESC);
CREATE TABLE public.order_request_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  photo_request_id uuid NOT NULL REFERENCES public.order_request_photo_requests(id),
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id),
  sequence smallint NOT NULL CHECK (sequence BETWEEN 1 AND 3),
  provided_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(photo_request_id,sequence),
  UNIQUE(media_asset_id)
);
ALTER TABLE public.media_assets ADD CONSTRAINT media_request_photo_request_fk
  FOREIGN KEY(request_photo_request_id) REFERENCES public.order_request_photo_requests(id);
CREATE FUNCTION marketplace_sec.validate_request_photo_binding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.purpose='customer_request' AND NOT EXISTS(
    SELECT 1 FROM public.order_request_photo_requests r
    WHERE r.id=NEW.bound_entity_id AND r.store_id=NEW.store_id
  ) THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER phase9_capability_request_photo_guard
BEFORE INSERT OR UPDATE ON public.phase9_upload_capabilities
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.validate_request_photo_binding();
CREATE FUNCTION public.phase9_request_current_copy_photos(
  p_request_item_id uuid,p_expected_version integer,p_count integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item public.store_order_request_items; v_request public.store_order_requests; v_id uuid; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C14',p_idempotency_key,
  concat_ws('|',p_request_item_id,p_expected_version,p_count));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'photo_request_id')::uuid; END IF;
  SELECT * INTO v_item FROM public.store_order_request_items WHERE id=p_request_item_id;
  SELECT * INTO v_request FROM public.store_order_requests WHERE id=v_item.order_request_id;
  IF v_item.id IS NULL OR v_item.version<>p_expected_version OR v_request.user_id<>auth.uid()
    OR p_count NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  INSERT INTO public.order_request_photo_requests(store_id,order_request_id,order_request_item_id,
    customer_user_id,requested_count) VALUES(v_item.store_id,v_request.id,v_item.id,v_request.user_id,p_count)
    RETURNING id INTO v_id;
  INSERT INTO public.marketplace_events(store_id,event_type,entity_type,entity_id,actor_user_id,payload)
    VALUES(v_item.store_id,'order_request_item.photos_requested','photo_request',v_id,auth.uid(),
      jsonb_build_object('count',p_count,'command_id',p_command_id));
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C14',p_idempotency_key,
    jsonb_build_object('photo_request_id',v_id),'photo_request_created'); RETURN v_id;
END$$;
CREATE FUNCTION public.phase9_authorize_request_photo_upload(
  p_photo_request_id uuid,p_expected_version integer,p_sequence integer,p_path text,p_envelope_sha256 text,
  p_expires_at timestamptz,p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_id uuid; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C15',p_idempotency_key,
  concat_ws('|',p_photo_request_id,p_expected_version,p_sequence,p_path,p_envelope_sha256,p_expires_at));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'capability_id')::uuid; END IF;
  SELECT * INTO v FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id) OR v.version<>p_expected_version
    OR v.state NOT IN ('requested','uploading') OR p_sequence NOT BETWEEN 1 AND v.requested_count
    OR p_path NOT LIKE v.store_id::text||'/customer_request/'||v.id::text||'/%' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  INSERT INTO public.phase9_upload_capabilities(store_id,issued_to_user_id,initiating_owner_user_id,
    purpose,bound_entity_type,bound_entity_id,bound_ordinal,bucket_id,object_path,envelope_sha256,
    nonce_hash,expires_at) VALUES(v.store_id,auth.uid(),auth.uid(),'customer_request','photo_request',v.id,
      p_sequence,'order-request-photos',p_path,p_envelope_sha256,p_idempotency_key,p_expires_at)
    RETURNING id INTO v_id;
  UPDATE public.order_request_photo_requests SET state='uploading',version=version+1,
    updated_at=transaction_timestamp() WHERE id=v.id;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C15',p_idempotency_key,
    jsonb_build_object('capability_id',v_id),'capability_issued'); RETURN v_id;
END$$;

CREATE FUNCTION public.phase9_supply_request_photo(
  p_photo_request_id uuid,p_capability_id uuid,p_media_asset_id uuid,p_sequence integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap public.phase9_upload_capabilities; v_request public.order_request_photo_requests;
  v_link uuid; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C16',p_idempotency_key,
  concat_ws('|',p_photo_request_id,p_capability_id,p_media_asset_id,p_sequence));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'media_link_id')::uuid; END IF;
  SELECT * INTO v_request FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id;
  IF v_request.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_request.store_id)
    OR p_sequence<>v_cap.bound_ordinal THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  PERFORM marketplace_sec.phase9_consume_upload_capability(p_capability_id,'customer_request',p_photo_request_id,
    v_cap.bucket_id,v_cap.object_path,v_cap.envelope_sha256,p_media_asset_id);
  UPDATE public.media_assets SET request_photo_request_id=p_photo_request_id,lifecycle_status='staged'
    WHERE id=p_media_asset_id;
  INSERT INTO public.order_request_media_links(store_id,photo_request_id,media_asset_id,sequence)
    VALUES(v_request.store_id,v_request.id,p_media_asset_id,p_sequence) RETURNING id INTO v_link;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES(v_request.store_id,'photo_request',v_request.id,'request_photo_validation',
      'request-photo-validation:'||v_request.id::text||':'||p_media_asset_id::text,p_media_asset_id::text)
    ON CONFLICT(dedupe_key) DO NOTHING;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C16',p_idempotency_key,
    jsonb_build_object('media_link_id',v_link),'request_media_linked'); RETURN v_link;
END$$;

CREATE FUNCTION marketplace_sec.complete_request_photo_validation(
  p_job_id uuid,p_worker text,p_photo_request_id uuid,p_success boolean
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_request public.order_request_photo_requests;
  v_media uuid; v_state text; v_replay jsonb;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_replay:=marketplace_sec.phase9_replay('worker:'||p_worker,'C27',p_job_id::text,
    concat_ws('|',p_job_id,p_worker,p_photo_request_id,p_success));
  IF v_replay IS NOT NULL THEN RETURN v_replay->>'outcome'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_request FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  v_media:=nullif(v_job.operation_version,'')::uuid;
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.store_id<>v_request.store_id OR v_job.entity_type<>'photo_request'
    OR v_job.entity_id<>p_photo_request_id OR v_job.job_kind<>'request_photo_validation'
    OR NOT EXISTS(SELECT 1 FROM public.order_request_media_links l WHERE l.photo_request_id=v_request.id
      AND l.media_asset_id=v_media) THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF p_success THEN UPDATE public.media_assets m SET lifecycle_status='validated',validated_at=transaction_timestamp(),
      updated_at=transaction_timestamp() FROM public.order_request_media_links l
      WHERE l.photo_request_id=v_request.id AND l.media_asset_id=v_media
        AND l.media_asset_id=m.id AND m.lifecycle_status='staged';
  ELSE UPDATE public.media_assets m SET lifecycle_status='failed',updated_at=transaction_timestamp()
      FROM public.order_request_media_links l WHERE l.photo_request_id=v_request.id
        AND l.media_asset_id=v_media AND l.media_asset_id=m.id AND m.lifecycle_status='staged'; END IF;
  IF p_success AND (SELECT count(*) FROM public.order_request_media_links l JOIN public.media_assets m
      ON m.id=l.media_asset_id WHERE l.photo_request_id=v_request.id AND m.lifecycle_status='validated')
      =v_request.requested_count THEN
    UPDATE public.order_request_photo_requests SET state='provided',provided_at=transaction_timestamp(),
      version=version+1,updated_at=transaction_timestamp() WHERE id=v_request.id;
  END IF;
  UPDATE public.image_extraction_jobs SET status=CASE WHEN p_success THEN 'resolved' ELSE 'resolved_noop' END,
    completed_at=transaction_timestamp(),lease_owner=NULL,lease_expires_at=NULL WHERE id=v_job.id;
  SELECT state INTO v_state FROM public.order_request_photo_requests WHERE id=v_request.id;
  v_state:=CASE WHEN NOT p_success THEN 'validation_failed' WHEN v_state='provided' THEN 'provided'
    ELSE 'validation_pending' END;
  PERFORM marketplace_sec.phase9_finish_replay('worker:'||p_worker,'C27',p_job_id::text,
    jsonb_build_object('outcome',v_state),'single_media_validation'); RETURN v_state;
END$$;

CREATE FUNCTION marketplace_sec.create_or_refresh_request_soft_hold(
  p_photo_request_id uuid,p_quantity integer,p_expires_at timestamptz,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_item public.store_order_request_items;
  v_existing public.inventory_holds; v_hold uuid;
BEGIN
  SELECT * INTO v FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  SELECT * INTO v_item FROM public.store_order_request_items WHERE id=v.order_request_item_id FOR UPDATE;
  IF v.state<>'provided' OR p_quantity<1 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO v_existing FROM public.inventory_holds WHERE order_request_item_id=v_item.id
    AND hold_type='soft' AND status='active' FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    UPDATE public.store_inventory SET quantity_available=quantity_available+v_existing.quantity,
      quantity_reserved=quantity_reserved-v_existing.quantity,version=version+1
      WHERE id=v_existing.inventory_id;
    UPDATE public.inventory_holds SET status='released',version=version+1,released_at=transaction_timestamp(),
      release_reason_code='refreshed'
      WHERE id=v_existing.id;
  END IF;
  UPDATE public.store_inventory SET quantity_available=quantity_available-p_quantity,
    quantity_reserved=quantity_reserved+p_quantity,version=version+1
    WHERE id=v_item.inventory_id AND quantity_available>=p_quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_INSUFFICIENT_AVAILABLE_QUANTITY'; END IF;
  INSERT INTO public.inventory_holds(id,store_id,inventory_id,order_request_id,order_request_item_id,
    hold_type,status,quantity,expires_at,command_id) VALUES(gen_random_uuid(),v.store_id,v_item.inventory_id,
    v.order_request_id,v_item.id,'soft','active',p_quantity,p_expires_at,p_command_id) RETURNING id INTO v_hold;
  RETURN v_hold;
END$$;

CREATE FUNCTION public.phase9_confirm_request_photo_item(
  p_photo_request_id uuid,p_expected_version integer,p_quantity integer,p_price_paise integer,
  p_terms jsonb,p_hold_expires_at timestamptz,p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_hold uuid; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C28',p_idempotency_key,
  concat_ws('|',p_photo_request_id,p_expected_version,p_quantity,p_price_paise,p_terms,p_hold_expires_at));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'hold_id')::uuid; END IF;
  SELECT * INTO v FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id) OR v.version<>p_expected_version
    OR v.state<>'provided' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_hold:=marketplace_sec.create_or_refresh_request_soft_hold(v.id,p_quantity,p_hold_expires_at,p_command_id);
  UPDATE public.order_request_photo_requests SET confirmation_proposal_version=coalesce(confirmation_proposal_version,0)+1,
    confirmed_price_paise=p_price_paise,confirmed_quantity=p_quantity,confirmation_terms=p_terms,
    version=version+1,updated_at=transaction_timestamp() WHERE id=v.id;
  UPDATE public.store_order_requests SET status='awaiting_customer_decision',version=version+1 WHERE id=v.order_request_id;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,
    next_attempt_at) VALUES(v.store_id,'photo_request',v.id,'request_photo_hold_expiry',
      'request-photo-hold-expiry:'||v.id::text||':'||(v.version+1)::text,(v.version+1)::text,p_hold_expires_at)
    ON CONFLICT(dedupe_key) DO NOTHING;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C28',p_idempotency_key,
    jsonb_build_object('hold_id',v_hold),'proposal_and_soft_hold_created'); RETURN v_hold;
END$$;

CREATE FUNCTION public.phase9_accept_request_photos(
  p_photo_request_id uuid,p_expected_version integer,p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C17',p_idempotency_key,
  concat_ws('|',p_photo_request_id,p_expected_version));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'photo_request_id')::uuid; END IF;
  SELECT * INTO v FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  IF v.id IS NULL OR v.customer_user_id<>auth.uid() OR v.version<>p_expected_version OR v.state<>'provided'
    OR NOT EXISTS(SELECT 1 FROM public.inventory_holds WHERE order_request_item_id=v.order_request_item_id
      AND hold_type='soft' AND status='active' AND expires_at>transaction_timestamp()) THEN
    RAISE EXCEPTION 'P9_SOFT_HOLD_REQUIRED'; END IF;
  UPDATE public.inventory_holds SET hold_type='firm',version=version+1
    WHERE order_request_item_id=v.order_request_item_id AND hold_type='soft' AND status='active';
  UPDATE public.order_request_photo_requests SET state='accepted',accepted_at=transaction_timestamp(),
    version=version+1,updated_at=transaction_timestamp() WHERE id=v.id;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C17',p_idempotency_key,
    jsonb_build_object('photo_request_id',v.id),'photo_request_accepted'); RETURN v.id;
END$$;

CREATE FUNCTION marketplace_sec.release_request_photo_hold(p_photo_request_id uuid,p_state text,p_reason text,p_command_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_hold public.inventory_holds;
BEGIN
  SELECT * INTO v FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  SELECT * INTO v_hold FROM public.inventory_holds WHERE order_request_item_id=v.order_request_item_id
    AND hold_type='soft' AND status='active' FOR UPDATE;
  IF v_hold.id IS NOT NULL THEN
    UPDATE public.store_inventory SET quantity_available=quantity_available+v_hold.quantity,
      quantity_reserved=quantity_reserved-v_hold.quantity,version=version+1 WHERE id=v_hold.inventory_id;
    UPDATE public.inventory_holds SET status='released',version=version+1,released_at=transaction_timestamp(),
      release_reason_code=coalesce(p_reason,p_state),command_id=p_command_id WHERE id=v_hold.id;
  END IF;
  UPDATE public.order_request_photo_requests SET state=p_state,unfulfilled_reason=p_reason,
    declined_at=CASE WHEN p_state='declined' THEN transaction_timestamp() END,
    unfulfilled_at=CASE WHEN p_state='unfulfilled' THEN transaction_timestamp() END,
    expired_at=CASE WHEN p_state='expired' THEN transaction_timestamp() END,
    version=version+1,updated_at=transaction_timestamp() WHERE id=v.id; RETURN v.id;
END$$;

CREATE FUNCTION marketplace_sec.expire_request_photo_soft_hold(
  p_job_id uuid,p_worker text,p_photo_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_request public.order_request_photo_requests;
  v_hold public.inventory_holds; v_result uuid; v_replay jsonb;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_replay:=marketplace_sec.phase9_replay('worker:'||p_worker,'C29',p_job_id::text,
    concat_ws('|',p_job_id,p_worker,p_photo_request_id));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'photo_request_id')::uuid; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_request FROM public.order_request_photo_requests WHERE id=p_photo_request_id FOR UPDATE;
  SELECT * INTO v_hold FROM public.inventory_holds WHERE order_request_item_id=v_request.order_request_item_id
    AND hold_type='soft' AND status='active' FOR UPDATE;
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.lease_expires_at<=transaction_timestamp() OR v_job.entity_id<>p_photo_request_id
    OR v_job.store_id<>v_request.store_id OR v_job.entity_type<>'photo_request'
    OR v_job.job_kind<>'request_photo_hold_expiry' OR v_job.operation_version<>v_request.version::text
    OR v_request.state<>'provided' OR v_hold.id IS NULL OR v_hold.expires_at>transaction_timestamp()
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_result:=marketplace_sec.release_request_photo_hold(p_photo_request_id,'expired','soft_hold_expired',v_job.correlation_id);
  UPDATE public.image_extraction_jobs SET status='resolved',completed_at=transaction_timestamp(),
    lease_owner=NULL,lease_expires_at=NULL,updated_at=transaction_timestamp() WHERE id=v_job.id;
  PERFORM marketplace_sec.phase9_finish_replay('worker:'||p_worker,'C29',p_job_id::text,
    jsonb_build_object('photo_request_id',v_result),'soft_hold_expired');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_decline_request_photos(
  p_photo_request_id uuid,p_expected_version integer,p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_result uuid; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C18',p_idempotency_key,
  concat_ws('|',p_photo_request_id,p_expected_version));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'photo_request_id')::uuid; END IF;
  SELECT * INTO v FROM public.order_request_photo_requests r WHERE r.id=p_photo_request_id;
  IF v.customer_user_id<>auth.uid() OR v.version<>p_expected_version OR v.state<>'provided'
    OR v.confirmation_proposal_version IS NULL OR NOT EXISTS(SELECT 1 FROM public.inventory_holds
      WHERE order_request_item_id=v.order_request_item_id AND hold_type='soft' AND status='active')
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_result:=marketplace_sec.release_request_photo_hold(v.id,'declined',NULL,p_command_id);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C18',p_idempotency_key,
    jsonb_build_object('photo_request_id',v_result),'photo_request_declined'); RETURN v_result; END$$;

CREATE FUNCTION public.phase9_mark_request_photo_unfulfilled(
  p_photo_request_id uuid,p_expected_version integer,p_reason text,p_idempotency_key text,p_command_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests; v_result uuid; v_replay jsonb;
BEGIN v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'C19',p_idempotency_key,
  concat_ws('|',p_photo_request_id,p_expected_version,p_reason));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'photo_request_id')::uuid; END IF;
  SELECT * INTO v FROM public.order_request_photo_requests r WHERE r.id=p_photo_request_id;
  IF NOT marketplace_sec.phase9_is_store_owner(v.store_id) OR v.version<>p_expected_version THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_result:=marketplace_sec.release_request_photo_hold(v.id,'unfulfilled',p_reason,p_command_id);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'C19',p_idempotency_key,
    jsonb_build_object('photo_request_id',v_result),'photo_request_unfulfilled'); RETURN v_result; END$$;

CREATE FUNCTION public.phase9_request_photo_status(p_photo_request_id uuid)
RETURNS TABLE(id uuid,order_request_item_id uuid,state text,version integer,requested_count smallint,provided_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.order_request_photo_requests;
BEGIN SELECT * INTO v FROM public.order_request_photo_requests r WHERE r.id=p_photo_request_id;
  IF v.id IS NULL OR NOT (v.customer_user_id=auth.uid() OR marketplace_sec.phase9_is_store_owner(v.store_id)) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT v.id,v.order_request_item_id,v.state,v.version,v.requested_count,v.provided_at;
END$$;

ALTER TABLE public.order_request_photo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_request_media_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_request_photo_requests,public.order_request_media_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.order_request_photo_requests,public.order_request_media_links TO service_role;
DO $$DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'phase9_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',f.signature);
END LOOP; END$$;
REVOKE ALL ON FUNCTION marketplace_sec.validate_request_photo_binding(),
  marketplace_sec.complete_request_photo_validation(uuid,text,uuid,boolean),
  marketplace_sec.create_or_refresh_request_soft_hold(uuid,integer,timestamptz,uuid),
  marketplace_sec.release_request_photo_hold(uuid,text,text,uuid),
  marketplace_sec.expire_request_photo_soft_hold(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.complete_request_photo_validation(uuid,text,uuid,boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.expire_request_photo_soft_hold(uuid,text,uuid) TO service_role;

COMMIT;
