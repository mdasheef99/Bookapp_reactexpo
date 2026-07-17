-- Phase 6 Unit 12B: missing named reminder and confirmation-expiry commands.
BEGIN;

CREATE FUNCTION public.send_confirmation_reminder(
 p_request_id UUID,p_expected_version INTEGER,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_replay JSONB;v_event UUID:=gen_random_uuid();
 v_response JSONB;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command('send_confirmation_reminder',p_request_id,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version),
  p_command_id,p_expected_version);IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status NOT IN('submitted','store_reviewing') OR
  transaction_timestamp()<v_request.confirmation_reminder_at THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 INSERT INTO public.marketplace_events(id,event_type,schema_version,entity_type,entity_id,store_id,user_id,
  actor_role,source,idempotency_key,command_id,correlation_id,privacy_classification,payload)
 VALUES(v_event,'order_request.confirmation_due_soon',1,'store_order_request',v_request.id,
  v_request.store_id,v_request.user_id,'system','task_worker',p_idempotency_key,p_command_id,
  v_request.correlation_id,'internal',jsonb_build_object('status',v_request.status));
 INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
  entity_type,entity_id,event_id,privacy_classification)
 SELECT v_request.store_id,x.user_id,'commerce.order_request.confirmation_due.store',
  'Confirmation due soon','Review this request before the confirmation deadline.',
  'store_order_request',v_request.id,v_event,'internal'
 FROM marketplace_sec.phase6_notification_owner_recipients(v_request.store_id) x;
 INSERT INTO public.marketplace_audit_logs(store_id,action,command_name,actor_role,entity_type,
  entity_id,outcome,version_before,version_after,correlation_id,details)
 VALUES(v_request.store_id,'send_confirmation_reminder','send_confirmation_reminder','system',
  'store_order_request',v_request.id,'succeeded',v_request.version,v_request.version,
  v_request.correlation_id,jsonb_build_object('reminderAt',v_request.confirmation_reminder_at));
 v_response:=jsonb_build_object('requestId',v_request.id,'status',v_request.status,
  'version',v_request.version,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command('send_confirmation_reminder',p_request_id,
  p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.expire_confirmation(
 p_request_id UUID,p_expected_version INTEGER,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_replay JSONB;v_response JSONB;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command('expire_confirmation',p_request_id,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version),
  p_command_id,p_expected_version);IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status NOT IN('submitted','store_reviewing') OR
  transaction_timestamp()<v_request.confirmation_due_at THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_id=v_request.id
  AND t.status IN('open','in_progress','retry_scheduled') ORDER BY t.id FOR UPDATE;
 PERFORM marketplace_sec.release_request_holds(v_request.id,'confirmation_sla_elapsed',p_command_id);
 PERFORM marketplace_sec.record_phase6_request_transition(v_request,'expired','expire_confirmation',
  'order_request.expired','commerce.order_request.expired.customer','commerce.order_request.expired.store',
  NULL,'system','task_worker',p_command_id,p_idempotency_key,'confirmation_sla_elapsed');
 UPDATE public.store_order_requests SET status='expired',status_reason_code='confirmation_sla_elapsed',
  version=version+1,terminal_at=transaction_timestamp(),latest_command_id=p_command_id,
  updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status=CASE WHEN task_type='confirmation_expiry'
  THEN 'resolved' ELSE 'cancelled' END,resolved_at=transaction_timestamp()
  WHERE entity_id=v_request.id AND status IN('open','in_progress','retry_scheduled');
 PERFORM marketplace_sec.assert_no_active_request_holds(v_request.id);
 v_response:=jsonb_build_object('requestId',v_request.id,'status','expired',
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command('expire_confirmation',p_request_id,
  p_idempotency_key,v_response);
END;$$;

REVOKE ALL ON FUNCTION public.send_confirmation_reminder(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_confirmation(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_confirmation_reminder(UUID,INTEGER,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_confirmation(UUID,INTEGER,TEXT,UUID) TO service_role;
COMMIT;
