-- Phase 6 Unit 10D: emergency pause/resume/expiry and compliance cancellation.
BEGIN;
CREATE FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF OLD.status='paused_for_emergency_closure' AND NEW.status=OLD.paused_from_status THEN
  IF NEW.status IN('submitted','store_reviewing') THEN
   NEW.confirmation_reminder_at:=marketplace_sec.add_store_open_seconds(OLD.store_id,
    transaction_timestamp(),COALESCE(OLD.confirmation_open_seconds_remaining,0),62);
   NEW.confirmation_due_at:=marketplace_sec.store_closing_boundary_after(OLD.store_id,
    NEW.confirmation_reminder_at,62);
  ELSIF NEW.status='awaiting_clarification' THEN
   NEW.clarification_expires_at:=transaction_timestamp()+
    make_interval(secs=>COALESCE(OLD.clarification_seconds_remaining,0));
  ELSIF NEW.status='awaiting_customer_decision' THEN
   NEW.acceptance_expires_at:=transaction_timestamp()+
    make_interval(secs=>COALESCE(OLD.decision_seconds_remaining,0));
   UPDATE public.inventory_holds SET expires_at=NEW.acceptance_expires_at,version=version+1
    WHERE order_request_id=OLD.id AND hold_type='soft' AND status='active';
  END IF;
 END IF;RETURN NEW;
END;$$;
CREATE TRIGGER aa_store_order_requests_emergency_resume_calendar
 BEFORE UPDATE ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing();

CREATE FUNCTION public.pause_for_emergency_closure(
 p_request_id UUID,p_expected_version INTEGER,p_exception_id UUID,
 p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_exception public.store_schedule_exceptions%ROWTYPE;
 v_replay JSONB;v_pause_snapshot UUID;v_count_snapshot UUID;v_pause_seconds INTEGER;
 v_max_count INTEGER;v_live_max_count INTEGER;v_cap TIMESTAMPTZ;v_event UUID;v_response JSONB;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_exception_id IS NULL OR p_command_id IS NULL THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command('pause_for_emergency_closure',p_request_id,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version,
   'exceptionId',p_exception_id),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status NOT IN('submitted','store_reviewing','awaiting_clarification',
  'awaiting_customer_decision') THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 IF (v_request.status IN('submitted','store_reviewing') AND
      v_request.confirmation_due_at<=transaction_timestamp()) OR
    (v_request.status='awaiting_clarification' AND
      v_request.clarification_expires_at<=transaction_timestamp()) OR
    (v_request.status='awaiting_customer_decision' AND
      v_request.acceptance_expires_at<=transaction_timestamp()) THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 SELECT * INTO v_exception FROM public.store_schedule_exceptions e WHERE e.id=p_exception_id
  AND e.store_id=v_request.store_id AND e.exception_type='emergency_closure'
  AND e.status='active' AND e.starts_at<=transaction_timestamp()
  AND e.ends_at>transaction_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 v_pause_snapshot:=marketplace_sec.ensure_request_policy_snapshot(v_request.id,
  'commerce.emergency_closure_pause_seconds');
 v_count_snapshot:=marketplace_sec.ensure_request_policy_snapshot(v_request.id,
  'commerce.max_emergency_closure_pauses');
 SELECT (s.resolved_value)::INTEGER INTO v_pause_seconds
  FROM public.store_order_request_policy_snapshots s WHERE s.id=v_pause_snapshot;
 SELECT (s.resolved_value)::INTEGER INTO v_max_count
  FROM public.store_order_request_policy_snapshots s WHERE s.id=v_count_snapshot;
 v_live_max_count:=(marketplace_sec.resolve_phase6_policy('commerce.max_emergency_closure_pauses',
  v_request.store_id,transaction_timestamp())->'value')::INTEGER;
 IF v_pause_seconds NOT BETWEEN 900 AND 21600 OR v_max_count NOT BETWEEN 0 AND 2 OR
  v_live_max_count NOT BETWEEN 0 AND 2 OR
  v_request.emergency_pause_count>=LEAST(v_max_count,v_live_max_count) THEN
  RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
 v_cap:=LEAST(v_exception.ends_at,transaction_timestamp()+make_interval(secs=>v_pause_seconds));
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_type='store_order_request'
  AND t.entity_id=v_request.id AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' AND h.hold_type='firm') THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 v_event:=marketplace_sec.record_phase6_request_transition(v_request,
  'paused_for_emergency_closure','pause_for_emergency_closure',
  'order_request.emergency_closure_paused','commerce.order_request.closure_paused.customer',
  'commerce.order_request.closure_paused.store',NULL,'system','task_worker',p_command_id,
  p_idempotency_key,'closure_exception');
 UPDATE public.store_order_requests SET status='paused_for_emergency_closure',
  paused_from_status=v_request.status,closure_exception_id=v_exception.id,
  closure_pause_expires_at=v_cap,emergency_pause_count=emergency_pause_count+1,
  confirmation_open_seconds_remaining=CASE WHEN v_request.status IN('submitted','store_reviewing')
   AND v_request.confirmation_reminder_at>transaction_timestamp() THEN
   marketplace_sec.store_open_seconds_between(v_request.store_id,transaction_timestamp(),
    v_request.confirmation_reminder_at,62) ELSE confirmation_open_seconds_remaining END,
  clarification_seconds_remaining=CASE WHEN v_request.status='awaiting_clarification' THEN
   GREATEST(0,extract(epoch FROM(v_request.clarification_expires_at-transaction_timestamp()))::INTEGER)
   ELSE clarification_seconds_remaining END,
  decision_seconds_remaining=CASE WHEN v_request.status='awaiting_customer_decision' THEN
   GREATEST(0,extract(epoch FROM(v_request.acceptance_expires_at-transaction_timestamp()))::INTEGER)
   ELSE decision_seconds_remaining END,
  clarification_expires_at=NULL,acceptance_expires_at=NULL,version=version+1,
  latest_command_id=p_command_id,updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.inventory_holds SET expires_at=GREATEST(expires_at,v_cap),version=version+1
  WHERE order_request_id=v_request.id AND hold_type='soft' AND status='active'
   AND v_request.status='awaiting_customer_decision';
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND status IN('open','in_progress');
 PERFORM marketplace_sec.schedule_phase6_deadline_task(v_request.id,v_request.version+1,
  'emergency_pause_expiry',v_cap,v_pause_snapshot,v_event);
 v_response:=jsonb_build_object('requestId',v_request.id,'status','paused_for_emergency_closure',
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command('pause_for_emergency_closure',p_request_id,
  p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.resume_after_emergency_closure(
 p_request_id UUID,p_expected_version INTEGER,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_exception public.store_schedule_exceptions%ROWTYPE;
 v_replay JSONB;v_next TEXT;v_event UUID;v_task TEXT;v_due TIMESTAMPTZ;v_policy UUID;v_response JSONB;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command('resume_after_emergency_closure',p_request_id,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,
   'expectedVersion',p_expected_version),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status<>'paused_for_emergency_closure' OR
  transaction_timestamp()>=v_request.closure_pause_expires_at THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 SELECT * INTO v_exception FROM public.store_schedule_exceptions e
  WHERE e.id=v_request.closure_exception_id FOR UPDATE;
 IF NOT FOUND OR v_exception.status NOT IN('completed','cancelled') THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_id=v_request.id
  AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 v_next:=v_request.paused_from_status;
 v_event:=marketplace_sec.record_phase6_request_transition(v_request,v_next,
  'resume_after_emergency_closure','order_request.emergency_closure_resumed',
  'commerce.order_request.closure_resumed.customer','commerce.order_request.closure_resumed.store',
  NULL,'system','task_worker',p_command_id,p_idempotency_key,'closure_exception');
 UPDATE public.store_order_requests SET status=v_next,paused_from_status=NULL,
  closure_exception_id=NULL,closure_pause_expires_at=NULL,version=version+1,
  latest_command_id=p_command_id,updated_at=transaction_timestamp() WHERE id=v_request.id;
 IF v_next NOT IN('submitted','store_reviewing','awaiting_clarification',
  'awaiting_customer_decision') THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 v_task:=CASE v_next WHEN 'submitted' THEN 'confirmation_expiry'
  WHEN 'store_reviewing' THEN 'confirmation_expiry' WHEN 'awaiting_clarification' THEN
  'clarification_expiry' ELSE 'customer_decision_expiry' END;
 SELECT CASE v_task WHEN 'confirmation_expiry' THEN r.confirmation_due_at
  WHEN 'clarification_expiry' THEN r.clarification_expires_at ELSE r.acceptance_expires_at END
  INTO v_due FROM public.store_order_requests r WHERE r.id=v_request.id;
 v_policy:=marketplace_sec.ensure_request_policy_snapshot(v_request.id,CASE v_task
  WHEN 'confirmation_expiry' THEN 'commerce.confirmation_expiry_business_days'
  WHEN 'clarification_expiry' THEN 'commerce.clarification_timeout_seconds'
  ELSE 'commerce.acceptance_window_seconds' END);
 UPDATE public.event_action_tasks SET status='resolved',resolved_at=transaction_timestamp()
  WHERE entity_id=v_request.id AND task_type='emergency_pause_expiry' AND status IN('open','in_progress');
 PERFORM marketplace_sec.schedule_phase6_deadline_task(v_request.id,v_request.version+1,
  v_task,v_due,v_policy,v_event);
 v_response:=jsonb_build_object('requestId',v_request.id,'status',v_next,
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command('resume_after_emergency_closure',
  p_request_id,p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION marketplace_sec.cancel_phase6_for_system_reason(
 p_request_id UUID,p_expected_version INTEGER,p_command TEXT,p_reason TEXT,p_event TEXT,
 p_customer_notification TEXT,p_store_notification TEXT,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_replay JSONB;v_response JSONB;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command(p_command,p_request_id,p_idempotency_key,
  jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version,
   'reasonCode',p_reason),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status NOT IN('submitted','store_reviewing','awaiting_clarification',
  'awaiting_customer_decision','paused_for_emergency_closure') THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_id=v_request.id
  AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 PERFORM marketplace_sec.release_request_holds(v_request.id,p_reason,p_command_id);
 PERFORM marketplace_sec.record_phase6_request_transition(v_request,'platform_cancelled',
  p_command,p_event,p_customer_notification,p_store_notification,NULL,'system','task_worker',
  p_command_id,p_idempotency_key,p_reason);
 UPDATE public.store_order_requests SET status='platform_cancelled',status_reason_code=p_reason,
  version=version+1,clarification_expires_at=NULL,acceptance_expires_at=NULL,
  closure_pause_expires_at=NULL,terminal_at=transaction_timestamp(),latest_command_id=p_command_id,
  updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_id=v_request.id AND status IN('open','in_progress');
 PERFORM marketplace_sec.assert_no_active_request_holds(v_request.id);
 v_response:=jsonb_build_object('requestId',v_request.id,'status','platform_cancelled',
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command(p_command,p_request_id,p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.expire_emergency_closure_pause(UUID,INTEGER,TEXT,UUID) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests r WHERE r.id=$1
  AND r.status='paused_for_emergency_closure' AND r.closure_pause_expires_at<=transaction_timestamp())
  THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 RETURN marketplace_sec.cancel_phase6_for_system_reason($1,$2,'expire_emergency_closure_pause',
  'emergency_closure_cap_elapsed','order_request.expired','commerce.order_request.expired.customer',
  'commerce.order_request.expired.store',$3,$4);END;$$;

CREATE FUNCTION public.cancel_for_store_ineligibility(UUID,INTEGER,TEXT,UUID) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_store UUID;BEGIN
 SELECT r.store_id INTO v_store FROM public.store_order_requests r WHERE r.id=$1;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=v_store AND
  (s.status='suspended' OR s.selling_status<>'allowed' OR s.verification_status<>'approved'
   OR COALESCE((SELECT ss.status NOT IN('trialing','active','past_due','grace_period')
    FROM public.store_subscriptions ss WHERE ss.store_id=s.id
    ORDER BY ss.created_at DESC,ss.id DESC LIMIT 1),true)
   OR NOT EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=s.id
    AND se.feature_key='commerce_order_requests_enabled' AND se.is_enabled=true)
   OR NOT EXISTS(SELECT 1 FROM public.marketplace_localities ml WHERE ml.id=s.locality_id
    AND ml.is_pilot_enabled=true))) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 RETURN marketplace_sec.cancel_phase6_for_system_reason($1,$2,'cancel_for_store_ineligibility',
  'store_ineligible','order_request.store_ineligible',
  'commerce.order_request.store_ineligible.customer','commerce.order_request.store_ineligible.store',
  $3,$4);END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pause_for_emergency_closure(UUID,INTEGER,UUID,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resume_after_emergency_closure(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.cancel_phase6_for_system_reason(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_emergency_closure_pause(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_for_store_ineligibility(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing() TO service_role;
GRANT EXECUTE ON FUNCTION public.pause_for_emergency_closure(UUID,INTEGER,UUID,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.resume_after_emergency_closure(UUID,INTEGER,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.cancel_phase6_for_system_reason(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_emergency_closure_pause(UUID,INTEGER,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_for_store_ineligibility(UUID,INTEGER,TEXT,UUID) TO service_role;
COMMIT;
