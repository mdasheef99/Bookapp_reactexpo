-- Phase 6 Unit 8B: Owner clarification request and customer response.
BEGIN;
CREATE FUNCTION public.request_clarification(p_request_id UUID,p_expected_version INTEGER,
  p_reason TEXT,p_customer_prompt TEXT,p_idempotency_key TEXT,p_command_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_replay JSONB;v_prompt TEXT;v_policy JSONB;v_seconds INTEGER;v_expiry TIMESTAMPTZ;v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR p_reason IS NULL OR
  p_reason NOT IN('edition','condition','quantity','fulfilment','delivery_minimum',
  'customer_note','price_drift','other') OR char_length(p_customer_prompt)>1000 THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_prompt:=marketplace_sec.sanitize_private_text(p_customer_prompt);
 IF v_prompt IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,'request_clarification',p_request_id::TEXT,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version,
  'reason',p_reason,'promptHash',encode(extensions.digest(v_prompt,'sha256'),'hex')),
  p_command_id,p_expected_version);IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND OR NOT marketplace_sec.has_phase6_owner_capability(v_request.store_id,
  'phase6_order_commands') THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status<>'store_reviewing' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 v_policy:=marketplace_sec.resolve_phase6_policy('commerce.clarification_timeout_seconds',
  v_request.store_id,transaction_timestamp());v_seconds:=(v_policy->'value')::INTEGER;
 IF v_seconds IS NULL OR v_seconds NOT BETWEEN 900 AND 86400 THEN
  RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
 v_expiry:=transaction_timestamp()+make_interval(secs=>v_seconds);
 INSERT INTO public.order_request_clarifications(order_request_id,store_id,reason_code,
  customer_prompt,requested_by,request_command_id,expires_at)
 VALUES(v_request.id,v_request.store_id,p_reason,v_prompt,v_actor,p_command_id,v_expiry);
 PERFORM marketplace_sec.record_owner_request_transition(v_request,'awaiting_clarification',
  'request_clarification','order_request.clarification_requested',
  'commerce.order_request.clarification_required.customer',p_command_id,p_idempotency_key,p_reason);
 UPDATE public.store_order_requests SET status='awaiting_clarification',version=version+1,
  clarification_expires_at=v_expiry,confirmation_open_seconds_remaining=GREATEST(0,
  extract(epoch FROM(confirmation_due_at-transaction_timestamp()))::INTEGER),
  latest_command_id=p_command_id,updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_id=v_request.id AND task_type IN('confirmation_reminder','confirmation_expiry')
  AND status IN('open','in_progress');
 INSERT INTO public.event_action_tasks(store_id,status,entity_type,entity_id,task_type,due_at,
  next_attempt_at,dedupe_key) VALUES(v_request.store_id,'open','store_order_request',v_request.id,
  'clarification_expiry',v_expiry,v_expiry,'clarification_expiry:'||v_request.id||':'||p_command_id);
 v_response:=jsonb_build_object('data',public.marketplace_get_owner_order_request(v_request.id),
  'commandId',p_command_id,'version',v_request.version+1);
 RETURN marketplace_sec.complete_phase6_command(v_actor,'request_clarification',p_request_id::TEXT,
  p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.provide_clarification(p_request_id UUID,p_expected_version INTEGER,
 p_customer_response TEXT,p_idempotency_key TEXT,p_command_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_clarification public.order_request_clarifications%ROWTYPE;v_text TEXT;v_replay JSONB;
 v_event UUID:=gen_random_uuid();v_due TIMESTAMPTZ;v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR
  char_length(p_customer_response)>2000 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_text:=marketplace_sec.sanitize_private_text(p_customer_response);
 IF v_text IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,'provide_clarification',p_request_id::TEXT,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version,
  'responseHash',encode(extensions.digest(v_text,'sha256'),'hex')),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND OR v_request.user_id<>v_actor THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status<>'awaiting_clarification' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 SELECT * INTO v_clarification FROM public.order_request_clarifications c
  WHERE c.order_request_id=v_request.id AND c.status='open' FOR UPDATE;
 IF NOT FOUND OR v_clarification.expires_at<=transaction_timestamp() THEN
  RAISE EXCEPTION 'REQUEST_WINDOW_EXPIRED';END IF;
 v_due:=transaction_timestamp()+make_interval(secs=>
  COALESCE(v_request.confirmation_open_seconds_remaining,0));
 UPDATE public.order_request_clarifications SET customer_response=v_text,responded_by=v_actor,
  status='responded',version=version+1,response_command_id=p_command_id,
  responded_at=transaction_timestamp() WHERE id=v_clarification.id;
 INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
  actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
  privacy_classification,payload)VALUES(v_event,'order_request.clarification_provided',
  'store_order_request',v_request.id,v_request.store_id,v_actor,v_actor,'customer','consumer_app',
  p_idempotency_key,p_command_id,v_request.correlation_id,'internal',
  jsonb_build_object('reasonCode',v_clarification.reason_code));
 INSERT INTO public.commerce_transition_log(entity_type,entity_id,previous_state,next_state,
  previous_version,next_version,actor_user_id,actor_role,command_name,command_id,idempotency_key,
  correlation_id,event_id)VALUES('store_order_request',v_request.id,'awaiting_clarification',
  'store_reviewing',v_request.version,v_request.version+1,v_actor,'customer',
  'provide_clarification',p_command_id,p_idempotency_key,v_request.correlation_id,v_event);
 INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(v_request.store_id,v_actor,'provide_clarification','store_order_request',v_request.id,
  jsonb_build_object('from','awaiting_clarification','to','store_reviewing','commandId',p_command_id));
 INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
  entity_type,entity_id,event_id,deep_link,privacy_classification)
 SELECT v_request.store_id,sa.user_id,'commerce.order_request.clarification_received.store',
  'Clarification received','Open the request to review the customer response.',
  'store_order_request',v_request.id,v_event,'/owner/requests/'||v_request.id,'internal'
 FROM public.store_administrators sa WHERE sa.store_id=v_request.store_id
  AND sa.role='owner' AND sa.status='active'
  AND EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=sa.store_id
   AND se.feature_key='commerce_order_request_owner_notifications_enabled'
   AND se.is_enabled=true);
 UPDATE public.store_order_requests SET status='store_reviewing',version=version+1,
  clarification_expires_at=NULL,confirmation_due_at=v_due,
  confirmation_open_seconds_remaining=NULL,latest_command_id=p_command_id,
  updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_id=v_request.id AND task_type='clarification_expiry' AND status IN('open','in_progress');
 INSERT INTO public.event_action_tasks(event_id,store_id,status,entity_type,entity_id,task_type,
  due_at,next_attempt_at,dedupe_key)VALUES(v_event,v_request.store_id,'open','store_order_request',
  v_request.id,'confirmation_expiry',v_due,v_due,'confirmation_expiry:resume:'||v_request.id||':'||p_command_id);
 v_response:=jsonb_build_object('data',public.marketplace_get_customer_order_request(v_request.id),
  'commandId',p_command_id,'version',v_request.version+1);
 RETURN marketplace_sec.complete_phase6_command(v_actor,'provide_clarification',p_request_id::TEXT,
  p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.marketplace_get_owner_order_request_clarification(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_result JSONB;
BEGIN
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id;
 IF NOT FOUND OR NOT marketplace_sec.has_phase6_owner_capability(v_request.store_id,
  'phase6_order_commands') THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 SELECT jsonb_build_object('clarificationId',c.id,'requestId',c.order_request_id,
  'reasonCode',c.reason_code,'customerPrompt',c.customer_prompt,
  'customerResponse',c.customer_response,'status',c.status,'version',c.version,
  'expiresAt',c.expires_at,'respondedAt',c.responded_at) INTO v_result
 FROM public.order_request_clarifications c WHERE c.order_request_id=v_request.id
 ORDER BY c.created_at DESC LIMIT 1;
 RETURN v_result;
END;$$;
CREATE FUNCTION public.marketplace_get_customer_order_request_clarification(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_result JSONB;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.store_order_requests r
  WHERE r.id=p_request_id AND r.user_id=v_actor) THEN
  RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 SELECT jsonb_build_object('clarificationId',c.id,'requestId',c.order_request_id,
  'reasonCode',c.reason_code,'customerPrompt',c.customer_prompt,
  'customerResponse',c.customer_response,'status',c.status,'version',c.version,
  'expiresAt',c.expires_at,'respondedAt',c.responded_at) INTO v_result
 FROM public.order_request_clarifications c WHERE c.order_request_id=p_request_id
 ORDER BY c.created_at DESC LIMIT 1;
 RETURN v_result;
END;$$;
REVOKE ALL ON FUNCTION public.request_clarification(UUID,INTEGER,TEXT,TEXT,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.provide_clarification(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.marketplace_get_owner_order_request_clarification(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.marketplace_get_customer_order_request_clarification(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_clarification(UUID,INTEGER,TEXT,TEXT,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.provide_clarification(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_owner_order_request_clarification(UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_customer_order_request_clarification(UUID) TO authenticated,service_role;
COMMIT;
