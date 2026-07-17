-- Phase 6 Unit 15C: task/notification/policy reconciliation and metrics.
BEGIN;
CREATE FUNCTION marketplace_sec.reconcile_phase6_operations(p_correlation_id UUID)
RETURNS INTEGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v RECORD;v_count INTEGER:=0;v_category TEXT;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 FOR v IN SELECT * FROM public.event_action_tasks WHERE status='in_progress'
  AND lease_expires_at<=transaction_timestamp()
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('expired_task_lease:'||v.id,
  'expired_task_lease','high','event_action_task',v.id,v.store_id,
  jsonb_build_object('taskType',v.task_type,'attemptCount',v.attempt_count),p_correlation_id);
  UPDATE public.event_action_tasks SET status='retry_scheduled',next_attempt_at=transaction_timestamp(),
   lease_owner=NULL,lease_expires_at=NULL WHERE id=v.id
   AND status='in_progress' AND lease_expires_at<=transaction_timestamp();v_count:=v_count+1;END LOOP;
 FOR v IN SELECT t.* FROM public.event_action_tasks t JOIN public.store_order_requests r ON
  t.entity_type='store_order_request' AND t.entity_id=r.id WHERE t.status IN('open','in_progress','retry_scheduled')
  AND t.source_request_version IS NOT NULL AND t.source_request_version<>r.version
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('superseded_task:'||v.id,
  'superseded_task','medium','event_action_task',v.id,v.store_id,
  jsonb_build_object('taskType',v.task_type,'sourceVersion',v.source_request_version),p_correlation_id);
  UPDATE public.event_action_tasks SET status='resolved_noop',resolved_at=transaction_timestamp(),
   completed_at=transaction_timestamp(),lease_owner=NULL,lease_expires_at=NULL WHERE id=v.id
   AND status IN('open','in_progress','retry_scheduled');v_count:=v_count+1;END LOOP;
 FOR v IN SELECT t.* FROM public.event_action_tasks t JOIN public.store_order_requests r ON
  t.entity_type='store_order_request' AND t.entity_id=r.id WHERE
  t.status IN('open','in_progress','retry_scheduled') AND r.status IN('unavailable','store_rejected',
   'customer_cancelled','platform_cancelled','expired','payment_ready_expired')
  AND t.task_type NOT IN('hold_reconciliation','commerce_consistency_reconciliation')
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('task_entity_incompatible:'||v.id,
  'task_entity_incompatible','high','event_action_task',v.id,v.store_id,
  jsonb_build_object('taskType',v.task_type),p_correlation_id);
  UPDATE public.event_action_tasks SET status='resolved_noop',resolved_at=transaction_timestamp(),
   completed_at=transaction_timestamp(),lease_owner=NULL,lease_expires_at=NULL WHERE id=v.id
   AND status IN('open','in_progress','retry_scheduled');v_count:=v_count+1;END LOOP;
 FOR v IN SELECT * FROM public.event_action_tasks WHERE
  (status IN('open','retry_scheduled') AND COALESCE(next_attempt_at,due_at,created_at)<transaction_timestamp()-interval '5 minutes'
   AND attempt_count=0) OR attempt_count>max_attempts OR status='dead_letter'
 LOOP v_category:=CASE WHEN v.status='dead_letter' THEN 'task_dead_letter'
  WHEN v.attempt_count>v.max_attempts THEN 'task_attempts_exceeded' ELSE 'due_task_never_claimed' END;
  PERFORM marketplace_sec.record_phase6_reconciliation_case(v_category||':'||v.id,v_category,
   CASE WHEN v.status='dead_letter' THEN 'critical' ELSE 'high' END,'event_action_task',v.id,v.store_id,
   jsonb_build_object('taskType',v.task_type,'attemptCount',v.attempt_count,'maxAttempts',v.max_attempts),
   p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT entity_id,(array_agg(id ORDER BY id))[1] id,
  (array_agg(store_id ORDER BY store_id))[1] store_id,task_type,count(*) amount
  FROM public.event_action_tasks WHERE status IN('open','in_progress','retry_scheduled')
  GROUP BY entity_type,entity_id,task_type HAVING count(*)>1
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('duplicate_active_task:'||v.id,
  'duplicate_active_task','high','event_action_task',v.id,v.store_id,
  jsonb_build_object('taskType',v.task_type,'activeTaskCount',v.amount),p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN SELECT n.id,n.store_id FROM public.marketplace_notifications n WHERE n.notification_type LIKE 'commerce.%'
  AND NOT EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.marketplace_notification_id=n.id)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('notification_delivery_missing:'||v.id,
  'notification_delivery_missing','high','marketplace_notification',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;
 FOR v IN SELECT event_id,user_id,notification_type,(array_agg(id ORDER BY id))[1] id,
  (array_agg(store_id ORDER BY store_id))[1] store_id,count(*) amount
  FROM public.marketplace_notifications WHERE notification_type LIKE 'commerce.%'
  GROUP BY event_id,user_id,notification_type HAVING count(*)>1
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('duplicate_canonical_notification:'||v.id,
  'duplicate_canonical_notification','high','marketplace_notification',v.id,v.store_id,
  jsonb_build_object('notificationCount',v.amount),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT d.id,n.store_id,d.attempt_count FROM public.notification_deliveries d
  JOIN public.marketplace_notifications n ON n.id=d.marketplace_notification_id WHERE d.status='dead_letter'
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('notification_dead_letter:'||v.id,
  'notification_dead_letter','critical','notification_delivery',v.id,v.store_id,
  jsonb_build_object('attemptCount',v.attempt_count),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT n.id,n.store_id,n.user_id FROM public.marketplace_notifications n
  JOIN public.marketplace_notification_type_registry r ON r.notification_type=n.notification_type
  WHERE r.audience='store' AND NOT EXISTS(SELECT 1 FROM
   marketplace_sec.phase6_notification_owner_recipients(n.store_id) x WHERE x.user_id=n.user_id)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('notification_no_valid_recipient:'||v.id,
  'notification_no_valid_recipient','critical','marketplace_notification',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;

 FOR v IN SELECT s.id FROM public.stores s JOIN public.store_entitlements e ON e.store_id=s.id
  AND e.feature_key='commerce_order_requests_enabled' AND e.is_enabled=true WHERE NOT EXISTS(
   SELECT 1 FROM marketplace_sec.phase6_notification_owner_recipients(s.id))
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('store_missing_entitled_owner:'||v.id,
  'store_missing_entitled_owner','critical','store',v.id,v.id,'{}',p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT s.id FROM public.stores s JOIN public.store_entitlements e ON e.store_id=s.id
  AND e.feature_key='commerce_order_requests_enabled' AND e.is_enabled=true
  WHERE s.status<>'active' OR s.verification_status<>'approved' OR s.setup_status<>'complete'
   OR s.selling_status<>'allowed'
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('rollout_eligibility_inconsistent:'||v.id,
  'rollout_eligibility_inconsistent','high','store',v.id,v.id,'{}',p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN WITH required(key,value_type,min_value,max_value) AS(VALUES
  ('commerce.cart_abandonment_seconds','integer',86400,2592000),
  ('commerce.confirmation_reminder_open_seconds','integer',3600,43200),
  ('commerce.confirmation_expiry_business_days','integer',1,2),
  ('commerce.clarification_timeout_seconds','integer',900,86400),
  ('commerce.acceptance_window_seconds','integer',900,3600),
  ('commerce.payment_ready_window_seconds','integer',1800,7200),
  ('commerce.price_drift_tolerance_minor','money_minor',0,5000),
  ('commerce.emergency_closure_pause_seconds','integer',900,21600),
  ('commerce.max_emergency_closure_pauses','integer',0,2),
  ('commerce.command_idempotency_retention_seconds','integer',86400,2592000),
  ('commerce.delivery_minimum_subtotal_minor','money_minor',0,1000000),
  ('commerce.delivery_fixed_tariff_minor','money_minor',0,100000))
 SELECT key FROM required q WHERE NOT EXISTS(SELECT 1 FROM public.marketplace_policy_config p
  WHERE p.policy_key=q.key AND p.scope_type='global' AND p.is_active=true
   AND p.effective_from<=transaction_timestamp() AND (p.effective_to IS NULL OR p.effective_to>transaction_timestamp()))
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('required_policy_missing:'||v.key,
  'required_policy_missing','critical','policy_config',NULL,NULL,jsonb_build_object('policyKey',v.key),
  p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN WITH required(key,value_type,min_value,max_value) AS(VALUES
  ('commerce.cart_abandonment_seconds','integer',86400,2592000),
  ('commerce.confirmation_reminder_open_seconds','integer',3600,43200),
  ('commerce.confirmation_expiry_business_days','integer',1,2),
  ('commerce.clarification_timeout_seconds','integer',900,86400),
  ('commerce.acceptance_window_seconds','integer',900,3600),
  ('commerce.payment_ready_window_seconds','integer',1800,7200),
  ('commerce.price_drift_tolerance_minor','money_minor',0,5000),
  ('commerce.emergency_closure_pause_seconds','integer',900,21600),
  ('commerce.max_emergency_closure_pauses','integer',0,2),
  ('commerce.command_idempotency_retention_seconds','integer',86400,2592000),
  ('commerce.delivery_minimum_subtotal_minor','money_minor',0,1000000),
  ('commerce.delivery_fixed_tariff_minor','money_minor',0,100000))
 SELECT p.id,p.store_id,p.policy_key FROM public.marketplace_policy_config p JOIN required q ON q.key=p.policy_key
  WHERE p.value_type<>q.value_type OR CASE WHEN jsonb_typeof(p.value)='number'
   THEN (p.value#>>'{}')::NUMERIC NOT BETWEEN q.min_value AND q.max_value ELSE true END
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('invalid_policy_value:'||v.id,
  'invalid_policy_value','critical','policy_config',v.id,v.store_id,
  jsonb_build_object('policyKey',v.policy_key),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT p.id,p.store_id,p.policy_key FROM public.marketplace_policy_config p
  WHERE p.policy_key IN('marketplace_enabled','cart_order_request_enabled','pickup_enabled','delivery_enabled',
   'commerce.store_allowlisted') AND (p.value_type<>'boolean' OR jsonb_typeof(p.value)<>'boolean')
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('invalid_policy_value:'||v.id,
  'invalid_policy_value','critical','policy_config',v.id,v.store_id,
  jsonb_build_object('policyKey',v.policy_key),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT a.id,a.store_id,a.policy_key FROM public.marketplace_policy_config a
  JOIN public.marketplace_policy_config b ON a.id<b.id AND a.policy_key=b.policy_key
   AND a.scope_type=b.scope_type AND COALESCE(a.normalized_scope_identity,a.scope_value,'global')=
   COALESCE(b.normalized_scope_identity,b.scope_value,'global') AND a.is_active AND b.is_active
   AND tstzrange(a.effective_from,a.effective_to,'[)')&&tstzrange(b.effective_from,b.effective_to,'[)')
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('overlapping_policy_range:'||v.id,
  'overlapping_policy_range','critical','policy_config',v.id,v.store_id,
  jsonb_build_object('policyKey',v.policy_key),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT p.store_id,p.iana_timezone FROM public.store_schedule_profiles p WHERE p.is_active
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p.iana_timezone)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('invalid_store_timezone:'||v.store_id,
  'invalid_store_timezone','critical','store',v.store_id,v.store_id,
  jsonb_build_object('timezoneValid',false),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT p.store_id FROM public.store_schedule_profiles p WHERE p.is_active AND NOT EXISTS(
  SELECT 1 FROM public.store_recurring_open_intervals i WHERE i.store_id=p.store_id)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('invalid_opening_schedule:'||v.store_id,
  'invalid_opening_schedule','critical','store',v.store_id,v.store_id,'{}',p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT s.id store_id FROM public.stores s JOIN public.store_entitlements e ON e.store_id=s.id
  AND e.feature_key='commerce_order_requests_enabled' AND e.is_enabled=true WHERE NOT EXISTS(
   SELECT 1 FROM public.store_schedule_profiles p WHERE p.store_id=s.id AND p.is_active)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('invalid_opening_schedule:'||v.store_id,
  'invalid_opening_schedule','critical','store',v.store_id,v.store_id,'{}',p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN SELECT r.id,r.store_id,r.status FROM public.store_order_requests r WHERE
  (r.status IN('submitted','store_reviewing') AND r.confirmation_due_at<transaction_timestamp()) OR
  (r.status='awaiting_clarification' AND r.clarification_expires_at<transaction_timestamp()) OR
  (r.status='awaiting_customer_decision' AND r.acceptance_expires_at<transaction_timestamp()) OR
  (r.status='payment_ready' AND r.payment_expires_at<transaction_timestamp()) OR
  (r.status='paused_for_emergency_closure' AND r.closure_pause_expires_at<transaction_timestamp())
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('request_past_state_deadline:'||v.id,
  'request_past_state_deadline','high','store_order_request',v.id,v.store_id,
  jsonb_build_object('requestStatus',v.status),p_correlation_id);v_count:=v_count+1;END LOOP;
 RETURN v_count;
END;$$;

CREATE FUNCTION marketplace_sec.observe_phase6_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,
  entity_id,store_id,correlation_id,safe_payload) SELECT 'request_transition',NEW.command_name,
  NEW.entity_type,NEW.entity_id,e.store_id,NEW.correlation_id,
  jsonb_build_object('previousState',NEW.previous_state,'nextState',NEW.next_state,
   'previousVersion',NEW.previous_version,'nextVersion',NEW.next_version)
  FROM public.marketplace_events e WHERE e.id=NEW.event_id;RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_transition AFTER INSERT ON public.commerce_transition_log
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.observe_phase6_transition();

CREATE FUNCTION marketplace_sec.observe_phase6_hold()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,
  entity_id,store_id,safe_payload) VALUES('hold_change',CASE WHEN TG_OP='INSERT' THEN 'created'
   WHEN NEW.status='released' THEN 'released' ELSE 'promoted' END,'inventory_hold',NEW.id,NEW.store_id,
  jsonb_build_object('holdType',NEW.hold_type,'holdStatus',NEW.status,'quantity',NEW.quantity));RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_hold AFTER INSERT OR UPDATE ON public.inventory_holds
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.observe_phase6_hold();

CREATE FUNCTION marketplace_sec.observe_phase6_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_type TEXT;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW;END IF;
 v_type:=CASE NEW.status WHEN 'in_progress' THEN 'task_claim' WHEN 'retry_scheduled' THEN 'retry'
  WHEN 'dead_letter' THEN 'dead_letter' ELSE 'task_execution' END;
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,
  entity_id,store_id,correlation_id,safe_payload) VALUES(v_type,NEW.status,'event_action_task',NEW.id,
  NEW.store_id,NEW.last_correlation_id,jsonb_build_object('taskType',NEW.task_type,
   'attemptCount',NEW.attempt_count));RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_task AFTER UPDATE OF status ON public.event_action_tasks
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.observe_phase6_task();

CREATE FUNCTION marketplace_sec.observe_phase6_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.marketplace_notification_id IS NULL THEN RETURN NEW;END IF;
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,
  entity_id,store_id,safe_payload) SELECT CASE WHEN NEW.status='dead_letter' THEN 'dead_letter'
   ELSE 'notification_transport' END,NEW.status,'notification_delivery',NEW.id,n.store_id,
   jsonb_build_object('channel',NEW.channel,'attemptCount',NEW.attempt_count)
  FROM public.marketplace_notifications n WHERE n.id=NEW.marketplace_notification_id;RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_delivery AFTER UPDATE OF status ON public.notification_deliveries
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.observe_phase6_delivery();

CREATE FUNCTION marketplace_sec.observe_phase6_idempotency()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW;END IF;
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,
  entity_id,correlation_id,safe_payload) VALUES('command_outcome',NEW.status,'commerce_command',
  NEW.logical_entity_id,NEW.correlation_id,jsonb_build_object('commandName',NEW.command_name));RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_idempotency AFTER INSERT OR UPDATE
 ON public.commerce_idempotency_keys FOR EACH ROW EXECUTE FUNCTION marketplace_sec.observe_phase6_idempotency();

CREATE FUNCTION marketplace_sec.observe_phase6_manual_replay()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF NEW.action='manual_replay' THEN INSERT INTO public.commerce_operational_observations(
  observation_type,outcome,entity_type,entity_id,store_id,correlation_id,safe_payload)
  VALUES('manual_replay',NEW.outcome,NEW.entity_type,NEW.entity_id,NEW.store_id,NEW.correlation_id,
   jsonb_build_object('reasonCode',NEW.reason_code));END IF;RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_manual_replay AFTER INSERT ON public.marketplace_audit_logs
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.observe_phase6_manual_replay();

CREATE FUNCTION marketplace_sec.observe_phase6_reconciliation_case()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_type TEXT;
BEGIN
 v_type:=CASE WHEN NEW.category IN('reserved_greater_than_active_holds','active_holds_greater_than_reserved',
  'inventory_bucket_total_inconsistent','negative_inventory_counter') THEN 'inventory_discrepancy'
  WHEN NEW.category LIKE '%policy%' OR NEW.category LIKE '%schedule%' OR NEW.category LIKE '%timezone%'
   THEN 'policy_misconfiguration' ELSE 'reconciliation_finding' END;
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,entity_id,
  store_id,correlation_id,safe_payload) VALUES(v_type,NEW.category,NEW.entity_type,NEW.entity_id,
  NEW.store_id,NEW.correlation_id,jsonb_build_object('severity',NEW.severity));RETURN NEW;
END;$$;
CREATE TRIGGER observe_phase6_reconciliation_case AFTER INSERT OR UPDATE
 ON public.commerce_reconciliation_cases FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.observe_phase6_reconciliation_case();

CREATE FUNCTION public.run_phase6_reconciliation(p_correlation_id UUID DEFAULT gen_random_uuid())
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_core INTEGER;v_ops INTEGER;v_started TIMESTAMPTZ:=clock_timestamp();
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 INSERT INTO public.commerce_reconciliation_runs(correlation_id) VALUES(p_correlation_id)
 ON CONFLICT(correlation_id) DO UPDATE SET status='running',started_at=transaction_timestamp(),finished_at=NULL;
 v_core:=marketplace_sec.reconcile_phase6_core(p_correlation_id);
 v_ops:=marketplace_sec.reconcile_phase6_operations(p_correlation_id);
 UPDATE public.commerce_reconciliation_runs SET status='succeeded',finding_count=v_core+v_ops,
  finished_at=transaction_timestamp() WHERE correlation_id=p_correlation_id;
 PERFORM marketplace_sec.record_phase6_observation('reconciliation_finding','succeeded',
  'reconciliation_run',NULL,NULL,p_correlation_id,
  floor(extract(epoch FROM clock_timestamp()-v_started)*1000)::INTEGER,
  jsonb_build_object('findingCount',v_core+v_ops));
 RETURN jsonb_build_object('correlationId',p_correlation_id,'findingCount',v_core+v_ops);
END;$$;

CREATE FUNCTION public.get_phase6_operational_metrics()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 RETURN jsonb_build_object(
  'oldestDueTaskAgeSeconds',(SELECT COALESCE(max(extract(epoch FROM transaction_timestamp()-
   COALESCE(next_attempt_at,due_at,created_at))),0)::BIGINT FROM public.event_action_tasks
   WHERE status IN('open','retry_scheduled')),
  'deadLetterTotal',(SELECT count(*) FROM public.event_action_tasks WHERE status='dead_letter')+
   (SELECT count(*) FROM public.notification_deliveries WHERE status='dead_letter'),
  'activeDiscrepancyTotal',(SELECT count(*) FROM public.commerce_reconciliation_cases WHERE status='open'),
  'requestsByStatus',(SELECT COALESCE(jsonb_object_agg(status,amount),'{}') FROM
   (SELECT status,count(*) amount FROM public.store_order_requests GROUP BY status) s),
  'holdMismatchCount',(SELECT count(*) FROM public.commerce_reconciliation_cases WHERE status='open'
   AND category IN('reserved_greater_than_active_holds','active_holds_greater_than_reserved')),
  'taskRetryCount',(SELECT count(*) FROM public.event_action_tasks WHERE status='retry_scheduled'),
  'notificationFailureCount',(SELECT count(*) FROM public.notification_deliveries
   WHERE status IN('failed','dead_letter')));
END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.reconcile_phase6_operations(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_transition() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_hold() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_task() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_delivery() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_idempotency() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_manual_replay() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.observe_phase6_reconciliation_case() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.run_phase6_reconciliation(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_phase6_operational_metrics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.reconcile_phase6_operations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_phase6_reconciliation(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_phase6_operational_metrics() TO service_role;
COMMIT;
