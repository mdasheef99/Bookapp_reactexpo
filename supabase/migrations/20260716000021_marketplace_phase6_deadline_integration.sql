-- Phase 6 Unit 10B: policy snapshots, calendar deadlines, and task provenance.
BEGIN;
ALTER TABLE public.store_order_requests ADD COLUMN clarification_seconds_remaining INTEGER
 CHECK(clarification_seconds_remaining>=0);
ALTER TABLE public.store_order_requests
 ADD COLUMN store_timezone_snapshot TEXT,
 ADD COLUMN store_schedule_version_snapshot INTEGER CHECK(store_schedule_version_snapshot>=1),
 ADD COLUMN store_schedule_snapshot JSONB CHECK(store_schedule_snapshot IS NULL OR
  jsonb_typeof(store_schedule_snapshot)='object'),
 ADD CONSTRAINT store_order_requests_schedule_snapshot_required CHECK(
  store_timezone_snapshot IS NOT NULL AND store_schedule_version_snapshot IS NOT NULL
  AND store_schedule_snapshot IS NOT NULL) NOT VALID;
ALTER TABLE public.event_action_tasks
 ADD COLUMN source_request_version INTEGER CHECK(source_request_version>=1),
 ADD COLUMN policy_snapshot_id UUID REFERENCES public.store_order_request_policy_snapshots(id)
  ON DELETE RESTRICT;

CREATE FUNCTION marketplace_sec.ensure_request_policy_snapshot(p_request_id UUID,p_policy_key TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_policy JSONB;v_id UUID;
BEGIN
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 SELECT s.id INTO v_id FROM public.store_order_request_policy_snapshots s
  WHERE s.order_request_id=p_request_id AND s.policy_key=p_policy_key;
 IF FOUND THEN RETURN v_id;END IF;
 v_policy:=marketplace_sec.resolve_phase6_policy(p_policy_key,v_request.store_id,
  transaction_timestamp());
 IF v_policy IS NULL THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
 INSERT INTO public.store_order_request_policy_snapshots(order_request_id,policy_key,value_type,
  resolved_value,source_policy_id,source_policy_version,source_scope_type,resolved_at)
 VALUES(p_request_id,p_policy_key,v_policy->>'value_type',v_policy->'value',
  (v_policy->>'policy_id')::UUID,(v_policy->>'policy_version')::INTEGER,
  v_policy->>'scope_type',transaction_timestamp()) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE FUNCTION marketplace_sec.snapshot_submission_schedule()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_timezone TEXT;v_schedule_version INTEGER;v_weekly JSONB;v_exceptions JSONB;
BEGIN
 PERFORM marketplace_sec.validate_store_open_schedule(NEW.store_id);
 SELECT p.iana_timezone,p.version INTO v_timezone,v_schedule_version
  FROM public.store_schedule_profiles p WHERE p.store_id=NEW.store_id AND p.is_active=true;
 IF EXISTS(SELECT 1 FROM public.store_schedule_exceptions e WHERE e.store_id=NEW.store_id
  AND e.exception_type='planned_closure' AND e.status IN('scheduled','active')
  AND e.starts_at<=NEW.submitted_at AND e.ends_at>NEW.submitted_at) THEN
  RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('weekday',i.weekday,
  'opens',to_char(i.opens_at,'HH24:MI'),'closes',to_char(i.closes_at,'HH24:MI'))
  ORDER BY i.weekday,i.opens_at),'[]'::JSONB) INTO v_weekly
  FROM public.store_recurring_open_intervals i WHERE i.store_id=NEW.store_id;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'type',e.exception_type,
  'timezone',e.timezone,'startsAt',e.starts_at,'endsAt',e.ends_at,
  'specialHours',e.special_hours,'reasonCode',e.reason_code) ORDER BY e.starts_at,e.id),
  '[]'::JSONB) INTO v_exceptions FROM public.store_schedule_exceptions e
  WHERE e.store_id=NEW.store_id AND e.exception_type IN('holiday','planned_closure','special_hours')
   AND e.status IN('scheduled','active') AND e.ends_at>NEW.submitted_at;
 NEW.store_timezone_snapshot:=v_timezone;
 NEW.store_schedule_version_snapshot:=v_schedule_version;
 NEW.store_schedule_snapshot:=jsonb_build_object('weekly',v_weekly,'exceptions',v_exceptions);
 RETURN NEW;
END;$$;
CREATE TRIGGER a_store_order_requests_submission_schedule
 BEFORE INSERT ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.snapshot_submission_schedule();

CREATE FUNCTION marketplace_sec.snapshot_submission_pause_policy()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$BEGIN
 PERFORM marketplace_sec.ensure_request_policy_snapshot(NEW.id,'commerce.max_emergency_closure_pauses');
 RETURN NULL;
END;$$;
CREATE TRIGGER a_store_order_requests_submission_pause_policy
 AFTER INSERT ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.snapshot_submission_pause_policy();

CREATE FUNCTION marketplace_sec.confirmation_deadline_after_business_days(
 p_store_id UUID,p_from TIMESTAMPTZ,p_business_days INTEGER,p_horizon_days INTEGER DEFAULT 62
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_timezone TEXT;v_local_date DATE;v_close TIMESTAMPTZ;
 v_count INTEGER:=0;v_day INTEGER;
BEGIN
 IF p_business_days NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
 SELECT p.iana_timezone INTO v_timezone FROM public.store_schedule_profiles p
  WHERE p.store_id=p_store_id AND p.is_active=true;
 IF v_timezone IS NULL THEN RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE';END IF;
 v_local_date:=(p_from AT TIME ZONE v_timezone)::DATE;
 FOR v_day IN 0..p_horizon_days LOOP
  SELECT max(x.closes_at_utc) INTO v_close
   FROM marketplace_sec.effective_store_open_intervals(p_store_id,v_local_date+v_day) x
   WHERE x.closes_at_utc>p_from;
  IF v_close IS NOT NULL THEN
   v_count:=v_count+1;
   IF v_count=p_business_days THEN RETURN v_close;END IF;
  END IF;
 END LOOP;
 RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE';
END;$$;

CREATE OR REPLACE FUNCTION marketplace_sec.submission_confirmation_window(
 p_store_id UUID,p_at TIMESTAMPTZ
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_reminder INTEGER;v_days INTEGER;v_reminder_at TIMESTAMPTZ;v_due_at TIMESTAMPTZ;
BEGIN
 v_reminder:=(marketplace_sec.resolve_phase6_policy(
  'commerce.confirmation_reminder_open_seconds',p_store_id,p_at)->'value')::INTEGER;
 v_days:=(marketplace_sec.resolve_phase6_policy(
  'commerce.confirmation_expiry_business_days',p_store_id,p_at)->'value')::INTEGER;
 IF v_reminder NOT BETWEEN 3600 AND 43200 OR v_days NOT BETWEEN 1 AND 2 THEN
  RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
 v_reminder_at:=marketplace_sec.add_store_open_seconds(p_store_id,p_at,v_reminder,62);
 v_due_at:=marketplace_sec.store_closing_boundary_after(p_store_id,v_reminder_at,62);
 RETURN jsonb_build_object('reminderAt',v_reminder_at,'dueAt',v_due_at,
  'reminderOpenSeconds',v_reminder,'expiryBusinessDays',v_days);
END;$$;

CREATE FUNCTION marketplace_sec.schedule_phase6_deadline_task(
 p_request_id UUID,p_request_version INTEGER,p_task_type TEXT,p_due_at TIMESTAMPTZ,
 p_policy_snapshot_id UUID,p_event_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_store UUID;v_id UUID;v_dedupe TEXT;
BEGIN
 IF p_task_type NOT IN('confirmation_reminder','confirmation_expiry','clarification_expiry',
  'customer_decision_expiry','payment_ready_expiry','emergency_pause_expiry') OR
  p_due_at IS NULL OR p_request_version IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT r.store_id INTO v_store FROM public.store_order_requests r WHERE r.id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=p_request_id AND task_type=p_task_type
   AND status IN('open','in_progress');
 v_dedupe:=p_request_id||':'||p_request_version||':'||p_task_type;
 INSERT INTO public.event_action_tasks(event_id,store_id,status,entity_type,entity_id,task_type,
  due_at,next_attempt_at,dedupe_key,source_request_version,policy_snapshot_id)
 VALUES(p_event_id,v_store,'open','store_order_request',p_request_id,p_task_type,p_due_at,
  p_due_at,v_dedupe,p_request_version,p_policy_snapshot_id) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE FUNCTION marketplace_sec.apply_clarification_calendar_timing()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_snapshot UUID;v_seconds INTEGER;
BEGIN
 IF OLD.status='store_reviewing' AND NEW.status='awaiting_clarification' THEN
  NEW.confirmation_open_seconds_remaining:=CASE WHEN OLD.confirmation_reminder_at<=transaction_timestamp()
   THEN 0 ELSE marketplace_sec.store_open_seconds_between(OLD.store_id,
    transaction_timestamp(),OLD.confirmation_reminder_at,62) END;
  v_snapshot:=marketplace_sec.ensure_request_policy_snapshot(OLD.id,
   'commerce.clarification_timeout_seconds');
  SELECT (s.resolved_value)::INTEGER INTO v_seconds FROM public.store_order_request_policy_snapshots s
   WHERE s.id=v_snapshot;
  IF v_seconds NOT BETWEEN 900 AND 86400 THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
  NEW.clarification_expires_at:=transaction_timestamp()+make_interval(secs=>v_seconds);
 ELSIF OLD.status='awaiting_clarification' AND NEW.status='store_reviewing' THEN
  NEW.confirmation_reminder_at:=marketplace_sec.add_store_open_seconds(OLD.store_id,
   transaction_timestamp(),COALESCE(OLD.confirmation_open_seconds_remaining,0),62);
  NEW.confirmation_due_at:=marketplace_sec.store_closing_boundary_after(OLD.store_id,
   NEW.confirmation_reminder_at,62);
  NEW.confirmation_open_seconds_remaining:=NULL;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER a_store_order_requests_clarification_calendar
 BEFORE UPDATE ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.apply_clarification_calendar_timing();

CREATE FUNCTION marketplace_sec.apply_decision_payment_deadline()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_key TEXT;v_snapshot UUID;v_seconds INTEGER;
BEGIN
 IF NEW.status IN('awaiting_customer_decision','payment_ready') AND OLD.status<>NEW.status THEN
  v_key:=CASE NEW.status WHEN 'awaiting_customer_decision' THEN 'commerce.acceptance_window_seconds'
   ELSE 'commerce.payment_ready_window_seconds' END;
  v_snapshot:=marketplace_sec.ensure_request_policy_snapshot(OLD.id,v_key);
  SELECT (s.resolved_value)::INTEGER INTO v_seconds FROM public.store_order_request_policy_snapshots s
   WHERE s.id=v_snapshot;
  IF v_seconds NOT BETWEEN 300 AND 86400 THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
  IF NEW.status='awaiting_customer_decision' THEN
   NEW.acceptance_expires_at:=transaction_timestamp()+make_interval(secs=>v_seconds);
  ELSE NEW.payment_expires_at:=transaction_timestamp()+make_interval(secs=>v_seconds);END IF;
 END IF;RETURN NEW;
END;$$;
CREATE TRIGGER a_store_order_requests_decision_payment_deadline
 BEFORE UPDATE ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.apply_decision_payment_deadline();

CREATE FUNCTION marketplace_sec.enrich_phase6_deadline_task()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_key TEXT;
BEGIN
 IF NEW.entity_type='store_order_request' AND NEW.task_type IN('confirmation_reminder',
  'confirmation_expiry','clarification_expiry','customer_decision_expiry','payment_ready_expiry',
  'emergency_pause_expiry') THEN
  SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=NEW.entity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
  v_key:=CASE NEW.task_type WHEN 'confirmation_reminder' THEN 'commerce.confirmation_reminder_open_seconds'
   WHEN 'confirmation_expiry' THEN 'commerce.confirmation_expiry_business_days'
   WHEN 'clarification_expiry' THEN 'commerce.clarification_timeout_seconds'
   WHEN 'customer_decision_expiry' THEN 'commerce.acceptance_window_seconds'
   WHEN 'payment_ready_expiry' THEN 'commerce.payment_ready_window_seconds'
   ELSE 'commerce.emergency_closure_pause_seconds' END;
  NEW.source_request_version:=v_request.version;
  NEW.policy_snapshot_id:=marketplace_sec.ensure_request_policy_snapshot(v_request.id,v_key);
  NEW.dedupe_key:=v_request.id||':'||v_request.version||':'||NEW.task_type;
  NEW.due_at:=CASE NEW.task_type WHEN 'confirmation_reminder' THEN v_request.confirmation_reminder_at
   WHEN 'confirmation_expiry' THEN v_request.confirmation_due_at
   WHEN 'clarification_expiry' THEN v_request.clarification_expires_at
   WHEN 'customer_decision_expiry' THEN v_request.acceptance_expires_at
   WHEN 'payment_ready_expiry' THEN v_request.payment_expires_at
   ELSE v_request.closure_pause_expires_at END;
  NEW.next_attempt_at:=NEW.due_at;
 END IF;RETURN NEW;
END;$$;
CREATE TRIGGER a_event_action_tasks_phase6_deadline
 BEFORE INSERT ON public.event_action_tasks FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.enrich_phase6_deadline_task();

REVOKE ALL ON FUNCTION marketplace_sec.ensure_request_policy_snapshot(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.snapshot_submission_schedule() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.snapshot_submission_pause_policy() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.confirmation_deadline_after_business_days(UUID,TIMESTAMPTZ,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.schedule_phase6_deadline_task(UUID,INTEGER,TEXT,TIMESTAMPTZ,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.apply_clarification_calendar_timing() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.apply_decision_payment_deadline() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.enrich_phase6_deadline_task() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.ensure_request_policy_snapshot(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.snapshot_submission_schedule() TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.snapshot_submission_pause_policy() TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.confirmation_deadline_after_business_days(UUID,TIMESTAMPTZ,INTEGER,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.schedule_phase6_deadline_task(UUID,INTEGER,TEXT,TIMESTAMPTZ,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.apply_clarification_calendar_timing() TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.apply_decision_payment_deadline() TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.enrich_phase6_deadline_task() TO service_role;
COMMIT;
