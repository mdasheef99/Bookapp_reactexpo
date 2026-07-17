-- Phase 6 Unit 12A: private task claims, leases, retry, dead letter, and replay.
BEGIN;

ALTER TABLE public.event_action_tasks DROP CONSTRAINT event_action_tasks_status_check;
ALTER TABLE public.event_action_tasks ADD CONSTRAINT event_action_tasks_status_check CHECK(status IN(
 'open','in_progress','retry_scheduled','resolved','resolved_noop','cancelled','dead_letter')) NOT VALID;
ALTER TABLE public.event_action_tasks
 ADD COLUMN replay_count INTEGER NOT NULL DEFAULT 0 CHECK(replay_count>=0),
 ADD COLUMN last_error_category TEXT,
 ADD COLUMN last_correlation_id UUID,
 ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE public.event_action_tasks ADD CONSTRAINT event_action_tasks_request_provenance
 CHECK(entity_type<>'store_order_request' OR source_request_version IS NOT NULL) NOT VALID;

CREATE TABLE public.commerce_task_dead_letters(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id UUID NOT NULL REFERENCES public.event_action_tasks(id) ON DELETE RESTRICT,
 task_type TEXT NOT NULL,
 entity_type TEXT,
 entity_id UUID,
 attempt_count INTEGER NOT NULL CHECK(attempt_count>0),
 safe_error_category TEXT NOT NULL,
 correlation_id UUID,
 replay_status TEXT NOT NULL DEFAULT 'not_replayed'
  CHECK(replay_status IN('not_replayed','replayed','permanently_invalid')),
 replay_count INTEGER NOT NULL DEFAULT 0 CHECK(replay_count>=0),
 dead_lettered_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(task_id,attempt_count)
);
CREATE TABLE public.commerce_task_attempt_log(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),task_id UUID NOT NULL
  REFERENCES public.event_action_tasks(id) ON DELETE RESTRICT,
 task_type TEXT NOT NULL,attempt_count INTEGER NOT NULL,outcome TEXT NOT NULL,
 safe_error_category TEXT,correlation_id UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commerce_task_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_task_attempt_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_task_dead_letters,public.commerce_task_attempt_log
 FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.commerce_task_dead_letters,public.commerce_task_attempt_log TO service_role;

CREATE FUNCTION marketplace_sec.claim_phase6_tasks(
 p_lease_owner UUID,p_batch_size INTEGER DEFAULT 50
)
RETURNS SETOF public.event_action_tasks LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_lease_owner IS NULL OR p_batch_size<1 OR p_batch_size>100 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 RETURN QUERY WITH due AS(
  SELECT t.id FROM public.event_action_tasks t WHERE
   ((t.status IN('open','retry_scheduled') AND COALESCE(t.next_attempt_at,t.due_at,t.created_at)<=transaction_timestamp())
    OR (t.status='in_progress' AND t.lease_expires_at<=transaction_timestamp()))
   AND NOT(t.status='in_progress' AND t.lease_expires_at>transaction_timestamp())
  ORDER BY COALESCE(t.next_attempt_at,t.due_at,t.created_at),t.created_at,t.id
  FOR UPDATE SKIP LOCKED LIMIT p_batch_size
 ) UPDATE public.event_action_tasks t SET status='in_progress',lease_owner=p_lease_owner,
   lease_expires_at=transaction_timestamp()+interval '5 minutes',attempt_count=attempt_count+1,
   last_error_code=NULL,last_error_category=NULL
  FROM due WHERE t.id=due.id RETURNING t.*;
END;$$;

CREATE FUNCTION marketplace_sec.complete_phase6_task(
 p_task_id UUID,p_lease_owner UUID,p_outcome TEXT,p_retryable BOOLEAN,
 p_error_category TEXT,p_correlation_id UUID
)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
-- Stale named commands are acknowledged with status='resolved_noop'.
DECLARE v_task public.event_action_tasks%ROWTYPE;v_delay INTERVAL;v_status TEXT;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 SELECT * INTO v_task FROM public.event_action_tasks WHERE id=p_task_id
  AND lease_owner=p_lease_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_task.status IN('resolved','resolved_noop','cancelled') THEN
  UPDATE public.event_action_tasks SET lease_owner=NULL,lease_expires_at=NULL,
   completed_at=COALESCE(completed_at,transaction_timestamp()) WHERE id=v_task.id;
  RETURN v_task.status;
 END IF;
 IF p_outcome IN('resolved','resolved_noop') THEN
  v_status:=p_outcome;
  UPDATE public.event_action_tasks SET status=v_status,resolved_at=transaction_timestamp(),
   completed_at=transaction_timestamp(),lease_owner=NULL,lease_expires_at=NULL,
   last_correlation_id=p_correlation_id WHERE id=v_task.id;
 ELSE
  IF NOT p_retryable OR v_task.attempt_count>=v_task.max_attempts THEN
   v_status:='dead_letter';
   UPDATE public.event_action_tasks SET status='dead_letter',dead_lettered_at=transaction_timestamp(),
    last_error_code=p_error_category,last_error_category=p_error_category,
    last_correlation_id=p_correlation_id,lease_owner=NULL,lease_expires_at=NULL WHERE id=v_task.id;
   INSERT INTO public.commerce_task_dead_letters(task_id,task_type,entity_type,entity_id,
    attempt_count,safe_error_category,correlation_id)
   VALUES(v_task.id,v_task.task_type,v_task.entity_type,v_task.entity_id,v_task.attempt_count,
    COALESCE(p_error_category,'unknown'),p_correlation_id) ON CONFLICT DO NOTHING;
  ELSE
   v_status:='retry_scheduled';
   v_delay:=CASE v_task.attempt_count WHEN 1 THEN interval '30 seconds'
    WHEN 2 THEN interval '2 minutes' WHEN 3 THEN interval '10 minutes'
    WHEN 4 THEN interval '30 minutes' ELSE interval '2 hours' END;
   UPDATE public.event_action_tasks SET status='retry_scheduled',next_attempt_at=transaction_timestamp()+v_delay,
    last_error_code=p_error_category,last_error_category=p_error_category,
    last_correlation_id=p_correlation_id,lease_owner=NULL,lease_expires_at=NULL WHERE id=v_task.id;
  END IF;
 END IF;
 INSERT INTO public.commerce_task_attempt_log(task_id,task_type,attempt_count,outcome,
  safe_error_category,correlation_id) VALUES(v_task.id,v_task.task_type,v_task.attempt_count,
  v_status,p_error_category,p_correlation_id);
 RETURN v_status;
END;$$;

CREATE FUNCTION marketplace_sec.claim_phase6_notification_delivery(
 p_delivery_id UUID,p_lease_owner UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_delivery public.notification_deliveries%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 UPDATE public.notification_deliveries SET status='in_progress',attempt_count=attempt_count+1,
  lease_owner=p_lease_owner,lease_expires_at=transaction_timestamp()+interval '5 minutes',
  locked_at=transaction_timestamp(),locked_by=p_lease_owner::TEXT
 WHERE id=p_delivery_id AND marketplace_notification_id IS NOT NULL
  AND status IN('pending','failed') AND COALESCE(next_attempt_at,created_at)<=transaction_timestamp()
  AND (lease_expires_at IS NULL OR lease_expires_at<=transaction_timestamp()) RETURNING * INTO v_delivery;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('id',v_delivery.id,'marketplace_notification_id',v_delivery.marketplace_notification_id,
  'recipient_user_id',v_delivery.recipient_user_id,'channel',v_delivery.channel,
  'title',v_delivery.title,'body',v_delivery.body,'deep_link',v_delivery.deep_link,
  'attempt_count',v_delivery.attempt_count,'max_attempts',v_delivery.max_attempts);
END;$$;

CREATE FUNCTION public.replay_phase6_dead_letter(p_task_id UUID,p_reason TEXT,p_command_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_task public.event_action_tasks%ROWTYPE;v_actor UUID:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent'])
  OR NOT char_length(p_reason) BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 SELECT * INTO v_task FROM public.event_action_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status<>'dead_letter' OR EXISTS(SELECT 1 FROM public.commerce_task_dead_letters d
  WHERE d.task_id=v_task.id AND d.replay_status='permanently_invalid') THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 IF NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) AND NOT(
  marketplace_sec.has_platform_role(ARRAY['support_agent'])
  AND v_task.task_type='platform_support_request') THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 UPDATE public.event_action_tasks SET status='open',next_attempt_at=transaction_timestamp(),
  replay_count=replay_count+1,dead_lettered_at=NULL,lease_owner=NULL,lease_expires_at=NULL
  WHERE id=v_task.id;
 UPDATE public.commerce_task_dead_letters SET replay_status='replayed',replay_count=replay_count+1
  WHERE task_id=v_task.id AND replay_status='not_replayed';
 INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,command_name,actor_role,
  entity_type,entity_id,outcome,reason_code,correlation_id,details)
 VALUES(v_task.store_id,v_actor,'manual_replay','manual_replay','platform_operator',
  'event_action_task',v_task.id,'succeeded','support_override',p_command_id,
  jsonb_build_object('taskType',v_task.task_type,'reasonLength',char_length(p_reason),
   'replayCount',v_task.replay_count+1));
 RETURN jsonb_build_object('taskId',v_task.id,'status','open','replayCount',v_task.replay_count+1);
END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.claim_phase6_tasks(UUID,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.complete_phase6_task(UUID,UUID,TEXT,BOOLEAN,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.claim_phase6_notification_delivery(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.replay_phase6_dead_letter(UUID,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase6_tasks(UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.complete_phase6_task(UUID,UUID,TEXT,BOOLEAN,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase6_notification_delivery(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_phase6_dead_letter(UUID,TEXT,UUID) TO authenticated;
COMMIT;
