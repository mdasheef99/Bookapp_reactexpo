-- Disposable Unit 8 PostgreSQL integration gate.
-- Run only against a freshly reset local Supabase database:
--   psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase6_unit8_integration.sql
-- The transaction always rolls back its fixtures.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id,email) VALUES
 ('81000000-0000-0000-0000-000000000001','p6u8-customer@example.invalid'),
 ('81000000-0000-0000-0000-000000000002','p6u8-other-customer@example.invalid'),
 ('81000000-0000-0000-0000-000000000003','p6u8-owner@example.invalid'),
 ('81000000-0000-0000-0000-000000000004','p6u8-manager@example.invalid'),
 ('81000000-0000-0000-0000-000000000005','p6u8-other-owner@example.invalid'),
 ('81000000-0000-0000-0000-000000000006','p6u8-support@example.invalid'),
 ('81000000-0000-0000-0000-000000000007','p6u8-admin@example.invalid');
INSERT INTO public.stores(id,display_name,status,verification_status,setup_status,selling_status)
VALUES
 ('82000000-0000-0000-0000-000000000001','P6 U8 Store','active','approved','complete','allowed'),
 ('82000000-0000-0000-0000-000000000002','P6 U8 Other','active','approved','complete','allowed');
DO $$BEGIN
 IF to_regclass('public.store_schedule_profiles') IS NOT NULL THEN
  EXECUTE $sql$INSERT INTO public.store_schedule_profiles(store_id,iana_timezone) VALUES
   ('82000000-0000-0000-0000-000000000001','Asia/Kolkata'),
   ('82000000-0000-0000-0000-000000000002','Asia/Kolkata')$sql$;
  EXECUTE $sql$INSERT INTO public.store_recurring_open_intervals(store_id,weekday,opens_at,closes_at)
   SELECT s.id,d,'00:00','23:59' FROM public.stores s CROSS JOIN generate_series(0,6) d
   WHERE s.id IN('82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002')$sql$;
 END IF;
END$$;
INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
 ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000003','owner','active'),
 ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000004','manager','active'),
 ('82000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000005','owner','active');
INSERT INTO public.store_entitlements(store_id,feature_key,is_enabled) VALUES
 ('82000000-0000-0000-0000-000000000001','commerce_order_request_owner_commands_enabled',true),
 ('82000000-0000-0000-0000-000000000001','commerce_order_request_owner_notifications_enabled',true),
 ('82000000-0000-0000-0000-000000000002','commerce_order_request_owner_commands_enabled',true),
 ('82000000-0000-0000-0000-000000000002','commerce_order_request_owner_notifications_enabled',true);
INSERT INTO public.platform_user_roles(user_id,role,status) VALUES
 ('81000000-0000-0000-0000-000000000006','support_agent','active'),
 ('81000000-0000-0000-0000-000000000007','platform_admin','active');
INSERT INTO public.marketplace_policy_config(policy_key,scope_type,value,value_type,is_active) VALUES
 ('commerce.clarification_timeout_seconds','global','3600'::jsonb,'integer',true),
 ('commerce.confirmation_expiry_business_days','global','1'::jsonb,'integer',true),
 ('commerce.max_emergency_closure_pauses','global','1'::jsonb,'integer',true);
INSERT INTO public.marketplace_carts(id,user_id,store_id,status,expires_at)
VALUES('83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',
 '82000000-0000-0000-0000-000000000001','submitted',transaction_timestamp()+interval '1 day');
INSERT INTO public.store_order_requests(id,user_id,store_id,cart_id,status,version,
 fulfillment_method,requested_subtotal_minor,provisional_delivery_tariff_minor,
 money_calculator_version,delivery_tariff_version,confirmation_reminder_at,confirmation_due_at,
 correlation_id,latest_command_id)
VALUES('84000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',
 '82000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',
 'store_reviewing',1,'pickup',10000,0,1,1,transaction_timestamp()+interval '30 minutes',
 transaction_timestamp()+interval '1 hour','85000000-0000-0000-0000-000000000001',
 '85000000-0000-0000-0000-000000000002');
INSERT INTO public.event_action_tasks(store_id,status,entity_type,entity_id,task_type,due_at,next_attempt_at)
VALUES('82000000-0000-0000-0000-000000000001','open','store_order_request',
 '84000000-0000-0000-0000-000000000001','confirmation_expiry',
 transaction_timestamp()+interval '1 hour',transaction_timestamp()+interval '1 hour');

-- Anonymous cannot invoke an Owner command.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$BEGIN
 BEGIN
  PERFORM public.request_clarification('84000000-0000-0000-0000-000000000001',1,
   'edition','Which edition?','unit8-anon-denied','86000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'anonymous clarification unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
RESET ROLE;

-- Manager, cross-store Owner, and cross-customer paths fail with zero effects.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000004',true);
DO $$BEGIN
 BEGIN
  PERFORM public.request_clarification('84000000-0000-0000-0000-000000000001',1,
   'edition','Which edition?','unit8-manager-denied','86000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'manager clarification unexpectedly succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='manager clarification unexpectedly succeeded' THEN RAISE;END IF;
 END;
END$$;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000005',true);
DO $$BEGIN
 BEGIN
  PERFORM public.request_platform_support('84000000-0000-0000-0000-000000000001',1,
   'technical_error','private','unit8-cross-store','86000000-0000-0000-0000-000000000003');
  RAISE EXCEPTION 'cross-store support unexpectedly succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='cross-store support unexpectedly succeeded' THEN RAISE;END IF;
 END;
END$$;
RESET ROLE;

-- Active entitled Owner requests clarification.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000003',true);
SELECT public.request_clarification('84000000-0000-0000-0000-000000000001',1,
 'edition','Please identify the edition.','unit8-clarification-request',
 '86000000-0000-0000-0000-000000000004');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '84000000-0000-0000-0000-000000000001' AND status='awaiting_clarification' AND version=2)
  THEN RAISE EXCEPTION 'clarification transition/version missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.order_request_clarifications WHERE order_request_id=
  '84000000-0000-0000-0000-000000000001' AND status='open')
  THEN RAISE EXCEPTION 'private clarification row missing';END IF;
 IF EXISTS(SELECT 1 FROM public.marketplace_events WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND payload::text ILIKE '%identify the edition%')
  THEN RAISE EXCEPTION 'raw prompt leaked to generic event';END IF;
END$$;

-- Unrelated customer cannot respond; the owning customer can and replay is deduplicated.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000002',true);
DO $$BEGIN
 BEGIN
  PERFORM public.provide_clarification('84000000-0000-0000-0000-000000000001',2,
   'Not mine','unit8-cross-customer','86000000-0000-0000-0000-000000000005');
  RAISE EXCEPTION 'cross-customer response unexpectedly succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='cross-customer response unexpectedly succeeded' THEN RAISE;END IF;
 END;
END$$;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
SELECT public.provide_clarification('84000000-0000-0000-0000-000000000001',2,
 'Second edition, paperback.','unit8-customer-response','86000000-0000-0000-0000-000000000006');
SELECT public.provide_clarification('84000000-0000-0000-0000-000000000001',2,
 'Second edition, paperback.','unit8-customer-response','86000000-0000-0000-0000-000000000006');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '84000000-0000-0000-0000-000000000001' AND status='store_reviewing' AND version=3)
  THEN RAISE EXCEPTION 'customer response transition/version missing';END IF;
 IF (SELECT count(*) FROM public.marketplace_events WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND event_type='order_request.clarification_provided')<>1
  THEN RAISE EXCEPTION 'clarification replay duplicated event';END IF;
 IF EXISTS(SELECT 1 FROM public.marketplace_events WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND payload::text ILIKE '%paperback%')
  THEN RAISE EXCEPTION 'raw response leaked to generic event';END IF;
END$$;

-- Support request is non-transitioning and replay does not duplicate effects.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000003',true);
SELECT public.request_platform_support('84000000-0000-0000-0000-000000000001',3,
 'technical_error','Private diagnostic detail.','unit8-owner-support',
 '86000000-0000-0000-0000-000000000007');
SELECT public.request_platform_support('84000000-0000-0000-0000-000000000001',3,
 'technical_error','Private diagnostic detail.','unit8-owner-support',
 '86000000-0000-0000-0000-000000000007');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '84000000-0000-0000-0000-000000000001' AND status='store_reviewing' AND version=3)
  THEN RAISE EXCEPTION 'support request mutated commerce';END IF;
 IF (SELECT count(*) FROM public.event_action_tasks WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND task_type='platform_support_request')<>1
  THEN RAISE EXCEPTION 'support task was not deduplicated';END IF;
 IF (SELECT count(*) FROM public.marketplace_events WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND event_type='order_request.support_requested')<>1
  THEN RAISE EXCEPTION 'support replay duplicated event';END IF;
 IF EXISTS(SELECT 1 FROM public.commerce_transition_log WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND command_name='request_platform_support')
  THEN RAISE EXCEPTION 'support request created fake transition';END IF;
END$$;

-- Ordinary Owner cannot intervene. Platform admin can extend once; stale replay is zero-effect.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000003',true);
DO $$BEGIN
 BEGIN
  PERFORM public.support_extend_confirmation_deadline(
   '84000000-0000-0000-0000-000000000001',3,'technical_error',900,
   'unit8-owner-intervention','86000000-0000-0000-0000-000000000008');
  RAISE EXCEPTION 'ordinary Owner intervention unexpectedly succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='ordinary Owner intervention unexpectedly succeeded' THEN RAISE;END IF;
 END;
END$$;
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000007',true);
SELECT public.support_extend_confirmation_deadline(
 '84000000-0000-0000-0000-000000000001',3,'technical_error',900,
 'unit8-admin-extension','86000000-0000-0000-0000-000000000009');
DO $$BEGIN
 BEGIN
  PERFORM public.support_cancel_request('84000000-0000-0000-0000-000000000001',3,
   'technical_error','unit8-stale-support','86000000-0000-0000-0000-000000000010');
  RAISE EXCEPTION 'stale intervention unexpectedly succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='stale intervention unexpectedly succeeded' THEN RAISE;END IF;
 END;
END$$;
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '84000000-0000-0000-0000-000000000001' AND status='store_reviewing' AND version=4)
  THEN RAISE EXCEPTION 'support extension version missing';END IF;
 IF (SELECT count(*) FROM public.commerce_transition_log WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND command_name=
  'support_extend_confirmation_deadline')<>0 THEN
  RAISE EXCEPTION 'same-state extension created fake transition';END IF;
 IF (SELECT count(*) FROM public.marketplace_events WHERE entity_id=
  '84000000-0000-0000-0000-000000000001' AND event_type=
  'order_request.support_intervened')<>1 THEN RAISE EXCEPTION 'support event count mismatch';END IF;
END$$;

ROLLBACK;
