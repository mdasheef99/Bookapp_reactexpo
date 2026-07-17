-- Disposable Unit 9 PostgreSQL integration gate. Run only after a fresh local reset:
-- psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase6_unit9_integration.sql
\set ON_ERROR_STOP on
\if :{?fixture_only}
\else
\set fixture_only false
\endif
BEGIN;

INSERT INTO auth.users(id,email) VALUES
 ('91000000-0000-0000-0000-000000000001','p6u9-customer@example.invalid'),
 ('91000000-0000-0000-0000-000000000002','p6u9-other@example.invalid'),
 ('91000000-0000-0000-0000-000000000003','p6u9-owner@example.invalid'),
 ('91000000-0000-0000-0000-000000000004','p6u9-admin@example.invalid');
INSERT INTO public.marketplace_localities(id,city,name,slug,is_pilot_enabled)
VALUES('92000000-0000-0000-0000-000000000001','Bengaluru','Unit 9','p6-u9',true);
INSERT INTO public.stores(id,display_name,city,locality_id,pickup_enabled,delivery_enabled,
 status,verification_status,setup_status,selling_status)
VALUES('92000000-0000-0000-0000-000000000002','P6 Unit 9','Bengaluru',
 '92000000-0000-0000-0000-000000000001',true,true,'active','approved','complete','allowed');
DO $$BEGIN
 IF to_regclass('public.store_schedule_profiles') IS NOT NULL THEN
  EXECUTE $sql$INSERT INTO public.store_schedule_profiles(store_id,iana_timezone)
   VALUES('92000000-0000-0000-0000-000000000002','Asia/Kolkata')$sql$;
  EXECUTE $sql$INSERT INTO public.store_recurring_open_intervals(store_id,weekday,opens_at,closes_at)
   SELECT '92000000-0000-0000-0000-000000000002',d,'00:00','23:59'
   FROM generate_series(0,6) d$sql$;
 END IF;
END$$;
INSERT INTO public.store_administrators(store_id,user_id,role,status)
VALUES('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000003','owner','active');
INSERT INTO public.store_entitlements(store_id,feature_key,is_enabled) VALUES
 ('92000000-0000-0000-0000-000000000002','commerce_order_requests_enabled',true),
 ('92000000-0000-0000-0000-000000000002','commerce_order_request_owner_commands_enabled',true),
 ('92000000-0000-0000-0000-000000000002','commerce_order_request_owner_notifications_enabled',true);
INSERT INTO public.store_subscriptions(store_id,status)
VALUES('92000000-0000-0000-0000-000000000002','active');
INSERT INTO public.platform_user_roles(user_id,role,status)
VALUES('91000000-0000-0000-0000-000000000004','platform_admin','active');
INSERT INTO public.marketplace_policy_config(policy_key,scope_type,store_id,value,value_type,
 normalized_scope_identity,is_active) VALUES
 ('marketplace_enabled','store','92000000-0000-0000-0000-000000000002','true','boolean',
  '92000000-0000-0000-0000-000000000002',true),
 ('cart_order_request_enabled','store','92000000-0000-0000-0000-000000000002','true','boolean',
  '92000000-0000-0000-0000-000000000002',true),
 ('commerce.store_allowlisted','store','92000000-0000-0000-0000-000000000002','true','boolean',
  '92000000-0000-0000-0000-000000000002',true),
 ('pickup_enabled','store','92000000-0000-0000-0000-000000000002','true','boolean',
  '92000000-0000-0000-0000-000000000002',true),
 ('delivery_enabled','store','92000000-0000-0000-0000-000000000002','true','boolean',
  '92000000-0000-0000-0000-000000000002',true),
 ('commerce.payment_ready_window_seconds','store','92000000-0000-0000-0000-000000000002',
  '3600','integer','92000000-0000-0000-0000-000000000002',true),
 ('commerce.acceptance_window_seconds','store','92000000-0000-0000-0000-000000000002',
  '1800','integer','92000000-0000-0000-0000-000000000002',true),
 ('commerce.max_emergency_closure_pauses','store','92000000-0000-0000-0000-000000000002',
  '2','integer','92000000-0000-0000-0000-000000000002',true);

INSERT INTO public.store_inventory(id,store_id,title,condition,quantity_total,quantity_available,
 quantity_reserved,selling_price_minor,visibility_status,listing_quality_status) VALUES
 ('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002',
  'Acceptance Book','good',10,8,2,1000,'draft','ready'),
 ('93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002',
  'Decision Expiry Book','good',10,9,1,1000,'draft','ready'),
 ('93000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002',
  'Payment Expiry Book','good',10,9,1,1000,'draft','ready');
INSERT INTO public.marketplace_book_listings(id,inventory_id,store_id,public_title,condition,
 selling_price_minor,pickup_available,delivery_available,status,moderation_status) VALUES
 ('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','Acceptance Book','good',1000,true,true,'active','approved'),
 ('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002',
  '92000000-0000-0000-0000-000000000002','Decision Expiry Book','good',1000,true,true,'active','approved'),
 ('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003',
  '92000000-0000-0000-0000-000000000002','Payment Expiry Book','good',1000,true,true,'active','approved');

INSERT INTO public.marketplace_carts(id,user_id,store_id,status,expires_at) VALUES
 ('95000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','submitted',transaction_timestamp()+interval '1 day'),
 ('95000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','submitted',transaction_timestamp()+interval '1 day'),
 ('95000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','submitted',transaction_timestamp()+interval '1 day'),
 ('95000000-0000-0000-0000-000000000004','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','submitted',transaction_timestamp()+interval '1 day');
INSERT INTO public.store_order_requests(id,user_id,store_id,cart_id,status,version,
 fulfillment_method,requested_subtotal_minor,provisional_delivery_tariff_minor,
 final_subtotal_minor,final_delivery_tariff_minor,final_total_minor,final_fulfillment_method,
 money_calculator_version,delivery_tariff_version,confirmation_reminder_at,confirmation_due_at,
 acceptance_expires_at,payment_expires_at,correlation_id,latest_command_id) VALUES
 ('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000001',
  'awaiting_customer_decision',1,'delivery',2000,500,2000,500,2500,'delivery',1,1,
  transaction_timestamp(),transaction_timestamp()+interval '1 hour',
  transaction_timestamp()+interval '30 minutes',NULL,
  '97000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000002'),
 ('96000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000002',
  'awaiting_customer_decision',1,'pickup',1000,0,1000,0,1000,'pickup',1,1,
  transaction_timestamp(),transaction_timestamp()+interval '1 hour',
  transaction_timestamp()-interval '1 second',NULL,
  '97000000-0000-0000-0000-000000000003','97000000-0000-0000-0000-000000000004'),
 ('96000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000003',
  'payment_ready',1,'pickup',1000,0,1000,0,1000,'pickup',1,1,
  transaction_timestamp(),transaction_timestamp()+interval '1 hour',NULL,
  transaction_timestamp()-interval '1 second',
  '97000000-0000-0000-0000-000000000005','97000000-0000-0000-0000-000000000006'),
 ('96000000-0000-0000-0000-000000000004','91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000004',
  'store_reviewing',1,'pickup',1000,0,NULL,NULL,NULL,NULL,1,1,
  transaction_timestamp(),transaction_timestamp()+interval '1 hour',NULL,NULL,
  '97000000-0000-0000-0000-000000000007','97000000-0000-0000-0000-000000000008');

INSERT INTO public.store_order_request_items(id,order_request_id,store_id,listing_id,inventory_id,
 title_snapshot,authors_snapshot,condition_snapshot,requested_quantity,confirmed_quantity,
 server_bound_unit_price_minor,confirmed_unit_price_minor,confirmation_status,
 pickup_eligible_snapshot,delivery_eligible_snapshot) VALUES
 ('98000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001','Acceptance Book','[]','good',2,2,1000,1000,
  'confirmed_partial',true,true),
 ('98000000-0000-0000-0000-000000000002','96000000-0000-0000-0000-000000000002',
  '92000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000002','Decision Expiry Book','[]','good',1,1,1000,1000,
  'confirmed_partial',true,true),
 ('98000000-0000-0000-0000-000000000003','96000000-0000-0000-0000-000000000003',
  '92000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000003',
  '93000000-0000-0000-0000-000000000003','Payment Expiry Book','[]','good',1,1,1000,1000,
  'confirmed_full',true,true);
INSERT INTO public.store_order_request_policy_snapshots(order_request_id,policy_key,value_type,
 resolved_value,source_policy_version,source_scope_type) SELECT r.id,k.key,'money_minor',k.value,
 1,'store' FROM public.store_order_requests r CROSS JOIN(VALUES
 ('commerce.delivery_minimum_subtotal_minor','1000'::jsonb),
 ('commerce.delivery_fixed_tariff_minor','500'::jsonb),
 ('commerce.delivery_free_threshold_minor','5000'::jsonb)) AS k(key,value);
INSERT INTO public.inventory_holds(store_id,inventory_id,order_request_id,order_request_item_id,
 hold_type,status,quantity,expires_at,command_id) VALUES
 ('92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000001',
  'soft','active',2,transaction_timestamp()+interval '30 minutes','99000000-0000-0000-0000-000000000001'),
 ('92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002',
  '96000000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000002',
  'soft','active',1,transaction_timestamp()+interval '30 minutes','99000000-0000-0000-0000-000000000002'),
 ('92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000003',
  '96000000-0000-0000-0000-000000000003','98000000-0000-0000-0000-000000000003',
  'firm','active',1,transaction_timestamp()+interval '30 minutes','99000000-0000-0000-0000-000000000003');
INSERT INTO public.event_action_tasks(store_id,status,entity_type,entity_id,task_type,due_at,next_attempt_at)
VALUES
 ('92000000-0000-0000-0000-000000000002','open','store_order_request',
  '96000000-0000-0000-0000-000000000001','customer_decision_expiry',
  transaction_timestamp()+interval '30 minutes',transaction_timestamp()+interval '30 minutes'),
 ('92000000-0000-0000-0000-000000000002','open','store_order_request',
  '96000000-0000-0000-0000-000000000002','customer_decision_expiry',
  transaction_timestamp()-interval '1 second',transaction_timestamp()-interval '1 second'),
 ('92000000-0000-0000-0000-000000000002','open','store_order_request',
 '96000000-0000-0000-0000-000000000003','payment_ready_expiry',
  transaction_timestamp()-interval '1 second',transaction_timestamp()-interval '1 second');

\if :fixture_only
COMMIT;
\quit
\endif

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
DO $$BEGIN BEGIN
 PERFORM public.accept_confirmed_changes('96000000-0000-0000-0000-000000000001',1,NULL,
  'unit9-cross-customer','9a000000-0000-0000-0000-000000000001');
 RAISE EXCEPTION 'cross-customer acceptance unexpectedly succeeded';
EXCEPTION WHEN raise_exception THEN IF SQLERRM='cross-customer acceptance unexpectedly succeeded' THEN RAISE;END IF;END;END$$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
SELECT public.accept_confirmed_changes('96000000-0000-0000-0000-000000000001',1,NULL,
 'unit9-accept-confirmed','9a000000-0000-0000-0000-000000000002');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id='96000000-0000-0000-0000-000000000001'
  AND status='payment_ready' AND version=2 AND final_total_minor=2500 AND payment_ready_at IS NOT NULL)
  THEN RAISE EXCEPTION 'acceptance result mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.inventory_holds WHERE order_request_id=
  '96000000-0000-0000-0000-000000000001' AND hold_type='firm' AND status='active')
  THEN RAISE EXCEPTION 'soft hold was not promoted';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_inventory WHERE id='93000000-0000-0000-0000-000000000001'
  AND quantity_available=8 AND quantity_reserved=2) THEN RAISE EXCEPTION 'promotion moved buckets';END IF;
END$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
SELECT public.cancel_order_request('96000000-0000-0000-0000-000000000001',2,
 'customer_requested','unit9-cancel-payment-ready','9a000000-0000-0000-0000-000000000003');
SELECT public.cancel_order_request('96000000-0000-0000-0000-000000000001',2,
 'customer_requested','unit9-cancel-payment-ready','9a000000-0000-0000-0000-000000000003');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_inventory WHERE id='93000000-0000-0000-0000-000000000001'
  AND quantity_available=10 AND quantity_reserved=0) THEN RAISE EXCEPTION 'cancel release mismatch';END IF;
 IF EXISTS(SELECT 1 FROM public.inventory_holds WHERE order_request_id=
  '96000000-0000-0000-0000-000000000001' AND status='active') THEN RAISE EXCEPTION 'active hold remained';END IF;
END$$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.expire_customer_decision('96000000-0000-0000-0000-000000000002',1,
 'unit9-expire-decision','9a000000-0000-0000-0000-000000000004');
SELECT public.expire_payment_ready('96000000-0000-0000-0000-000000000003',1,
 'unit9-expire-payment','9a000000-0000-0000-0000-000000000005');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000004',true);
SELECT public.cancel_for_rollout_shutdown('96000000-0000-0000-0000-000000000004',1,
 'feature_disabled','unit9-rollout-cancel','9a000000-0000-0000-0000-000000000006');
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM public.store_order_requests r JOIN public.inventory_holds h
  ON h.order_request_id=r.id WHERE r.status IN('customer_cancelled','platform_cancelled','expired',
  'payment_ready_expired') AND h.status='active') THEN RAISE EXCEPTION 'terminal active hold';END IF;
 IF EXISTS(SELECT 1 FROM public.marketplace_events e WHERE e.entity_id IN(
  '96000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000002',
  '96000000-0000-0000-0000-000000000003') AND e.payload::text ILIKE '%example.invalid%')
  THEN RAISE EXCEPTION 'private data leaked into event';END IF;
END$$;
ROLLBACK;
