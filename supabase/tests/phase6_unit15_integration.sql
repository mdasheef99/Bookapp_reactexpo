-- Disposable Unit 15 PostgreSQL gate. Run only against a freshly reset local Supabase database.
-- The transaction always rolls back its non-PII fixtures and reconciliation evidence.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.stores(id,display_name,status,verification_status,setup_status,selling_status)
VALUES('f1500000-0000-0000-0000-000000000001','P6 Unit 15','active','approved','complete','allowed');
INSERT INTO public.store_entitlements(store_id,feature_key,is_enabled) VALUES
 ('f1500000-0000-0000-0000-000000000001','commerce_order_requests_enabled',true);
INSERT INTO public.store_inventory(id,store_id,title,condition,quantity_total,quantity_available,
 quantity_reserved,quantity_sold,quantity_removed,selling_price_minor,visibility_status,listing_quality_status)
VALUES('f1500000-0000-0000-0000-000000000002','f1500000-0000-0000-0000-000000000001',
 'Reconciliation Fixture','good',5,3,2,0,0,1000,'draft','ready');
INSERT INTO public.store_schedule_profiles(store_id,iana_timezone)
VALUES('f1500000-0000-0000-0000-000000000001','Invalid/Unit15');
INSERT INTO public.event_action_tasks(id,store_id,status,entity_type,entity_id,task_type,due_at,
 attempt_count,max_attempts,lease_owner,lease_expires_at)
VALUES
 ('f1500000-0000-0000-0000-000000000003','f1500000-0000-0000-0000-000000000001',
  'in_progress','store','f1500000-0000-0000-0000-000000000001','hold_reconciliation',
  transaction_timestamp()-interval '10 minutes',1,5,'f1500000-0000-0000-0000-000000000004',
  transaction_timestamp()-interval '1 minute'),
 ('f1500000-0000-0000-0000-000000000005','f1500000-0000-0000-0000-000000000001',
  'dead_letter','store','f1500000-0000-0000-0000-000000000001','commerce_consistency_reconciliation',
  transaction_timestamp()-interval '10 minutes',5,5,NULL,NULL);
INSERT INTO public.marketplace_policy_config(id,policy_key,scope_type,value,value_type,is_active,
 normalized_scope_identity,effective_from,effective_to) VALUES
 ('f1500000-0000-0000-0000-000000000006','commerce.acceptance_window_seconds','global',
  '10','integer',true,'global',transaction_timestamp()-interval '2 days',NULL),
 ('f1500000-0000-0000-0000-000000000007','commerce.acceptance_window_seconds','global',
  '1800','integer',true,'global',transaction_timestamp()-interval '1 day',NULL);

DO $$BEGIN
 IF to_regprocedure('public.run_phase6_reconciliation(uuid)') IS NULL THEN
  RAISE EXCEPTION 'run_phase6_reconciliation missing';END IF;
 IF to_regprocedure('public.get_phase6_operational_metrics()') IS NULL THEN
  RAISE EXCEPTION 'operational metrics missing';END IF;
 IF has_function_privilege('authenticated','public.run_phase6_reconciliation(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'ordinary client can run reconciliation';END IF;
END$$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.run_phase6_reconciliation('f1500000-0000-0000-0000-000000000010');
SELECT public.run_phase6_reconciliation('f1500000-0000-0000-0000-000000000011');
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  finding_key='reserved_greater_than_active_holds:f1500000-0000-0000-0000-000000000002'
  AND category='reserved_greater_than_active_holds' AND occurrence_count=2) THEN
  RAISE EXCEPTION 'inventory mismatch was not detected idempotently';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='expired_task_lease') THEN RAISE EXCEPTION 'expired lease not detected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_action_tasks WHERE id=
  'f1500000-0000-0000-0000-000000000003' AND status='retry_scheduled'
  AND lease_owner IS NULL AND lease_expires_at IS NULL) THEN
  RAISE EXCEPTION 'deterministic stale lease recovery failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='task_dead_letter') THEN RAISE EXCEPTION 'dead letter alert missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='store_missing_entitled_owner') THEN RAISE EXCEPTION 'missing Owner not detected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='invalid_policy_value') THEN RAISE EXCEPTION 'invalid policy not detected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='overlapping_policy_range') THEN RAISE EXCEPTION 'policy overlap not detected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='invalid_store_timezone') THEN RAISE EXCEPTION 'invalid timezone not detected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE
  category='invalid_opening_schedule') THEN RAISE EXCEPTION 'invalid schedule not detected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_inventory WHERE id=
  'f1500000-0000-0000-0000-000000000002' AND quantity_available=3 AND quantity_reserved=2)
  THEN RAISE EXCEPTION 'ambiguous inventory was silently repaired';END IF;
 IF EXISTS(SELECT 1 FROM public.commerce_reconciliation_cases WHERE safe_payload::TEXT ~*
  'phone|address|email|contact_snapshot') THEN RAISE EXCEPTION 'operational payload contains PII';END IF;
 PERFORM public.get_phase6_operational_metrics();
 BEGIN
  PERFORM marketplace_sec.record_phase6_reconciliation_case('unsafe','prohibited_pii_payload',
   'critical','store',NULL,NULL,jsonb_build_object('phone','secret'),gen_random_uuid());
  RAISE EXCEPTION 'unsafe payload accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='unsafe payload accepted' THEN RAISE;END IF;
 END;
END$$;
RESET ROLE;
ROLLBACK;
