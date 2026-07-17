-- Disposable Unit 10 PostgreSQL gate. The wrapper first loads the Unit 9 fixture.
-- Do not point this at a remote database.
\set ON_ERROR_STOP on
\if :{?fixture_only}
\else
\set fixture_only false
\endif
BEGIN;

INSERT INTO public.store_schedule_profiles(store_id,iana_timezone)
VALUES('92000000-0000-0000-0000-000000000002','Asia/Kolkata')
ON CONFLICT(store_id) DO UPDATE SET iana_timezone=excluded.iana_timezone,version=
 public.store_schedule_profiles.version+1;
DELETE FROM public.store_recurring_open_intervals WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
INSERT INTO public.store_recurring_open_intervals(store_id,weekday,opens_at,closes_at) VALUES
 ('92000000-0000-0000-0000-000000000002',5,'20:00','02:00'),
 ('92000000-0000-0000-0000-000000000002',6,'20:00','02:00');
INSERT INTO public.marketplace_policy_config(policy_key,scope_type,store_id,value,value_type,
 normalized_scope_identity,is_active) VALUES
 ('commerce.confirmation_reminder_open_seconds','store','92000000-0000-0000-0000-000000000002',
  '10800','integer','92000000-0000-0000-0000-000000000002',true),
 ('commerce.confirmation_expiry_business_days','store','92000000-0000-0000-0000-000000000002',
  '2','integer','92000000-0000-0000-0000-000000000002',true),
 ('commerce.clarification_timeout_seconds','store','92000000-0000-0000-0000-000000000002',
  '3600','integer','92000000-0000-0000-0000-000000000002',true),
 ('commerce.emergency_closure_pause_seconds','store','92000000-0000-0000-0000-000000000002',
  '3600','integer','92000000-0000-0000-0000-000000000002',true),
 ('commerce.max_emergency_closure_pauses','store','92000000-0000-0000-0000-000000000002',
  '2','integer','92000000-0000-0000-0000-000000000002',true)
ON CONFLICT DO NOTHING;
INSERT INTO public.store_schedule_exceptions(id,store_id,exception_type,timezone,starts_at,ends_at,
 reason_code,status,created_by) VALUES
 ('9c000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002',
  'emergency_closure','Asia/Kolkata',transaction_timestamp()-interval '1 minute',
  transaction_timestamp()+interval '1 hour','emergency_safety','active',
  '91000000-0000-0000-0000-000000000004');

\if :fixture_only
COMMIT;
\quit
\endif

DO $$DECLARE v_store CONSTANT UUID:='92000000-0000-0000-0000-000000000002';BEGIN
 IF marketplace_sec.store_open_seconds_between(v_store,'2026-07-17 17:30+00',
  '2026-07-17 20:30+00')<>10800 THEN RAISE EXCEPTION 'Kolkata first interval mismatch';END IF;
 IF marketplace_sec.add_store_open_seconds(v_store,'2026-07-17 17:30+00',21600,62)
  <>'2026-07-18 17:30+00'::timestamptz THEN RAISE EXCEPTION 'Kolkata sixth hour mismatch';END IF;
 IF (SELECT opens_at_utc FROM marketplace_sec.next_store_open_interval(v_store,
  '2026-07-17 20:30+00',62))<>'2026-07-18 14:30+00'::timestamptz THEN
  RAISE EXCEPTION 'Kolkata next opening mismatch';END IF;
 IF marketplace_sec.confirmation_deadline_after_business_days(v_store,
  '2026-07-17 17:30+00',2,62)<>'2026-07-18 20:30+00'::timestamptz THEN
  RAISE EXCEPTION 'Kolkata closing boundary mismatch';END IF;
 IF marketplace_sec.store_closing_boundary_after(v_store,'2026-07-18 17:30+00',62)
  <>'2026-07-18 20:30+00'::timestamptz THEN
  RAISE EXCEPTION 'Kolkata reminder closing boundary mismatch';END IF;
END$$;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM public.store_order_requests WHERE store_id=
  '92000000-0000-0000-0000-000000000002' AND (store_timezone_snapshot IS NULL
  OR store_schedule_version_snapshot IS NULL OR store_schedule_snapshot IS NULL)) THEN
  RAISE EXCEPTION 'submission schedule snapshot missing';END IF;
END$$;

INSERT INTO public.store_schedule_exceptions(id,store_id,exception_type,timezone,starts_at,ends_at,
 reason_code,status,created_by) VALUES
 ('9c000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002',
  'holiday','Asia/Kolkata','2026-07-17 18:30+00','2026-07-18 18:30+00','holiday','active',
  '91000000-0000-0000-0000-000000000004');
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM marketplace_sec.effective_store_open_intervals(
  '92000000-0000-0000-0000-000000000002','2026-07-18')) THEN
  RAISE EXCEPTION 'full closure did not override recurring hours';END IF;
END$$;
DELETE FROM public.store_schedule_exceptions WHERE id='9c000000-0000-0000-0000-000000000002';

INSERT INTO public.store_schedule_exceptions(id,store_id,exception_type,timezone,starts_at,ends_at,
 special_hours,reason_code,status,created_by) VALUES
 ('9c000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002',
  'special_hours','Asia/Kolkata','2026-07-18 18:30+00','2026-07-19 18:30+00',
  '[{"opens":"10:00","closes":"12:00"}]','special_hours','active',
  '91000000-0000-0000-0000-000000000004');
DO $$BEGIN
 IF (SELECT opens_at_utc FROM marketplace_sec.effective_store_open_intervals(
  '92000000-0000-0000-0000-000000000002','2026-07-19') LIMIT 1)
  <>'2026-07-19 04:30+00'::timestamptz THEN RAISE EXCEPTION 'special hours mismatch';END IF;
END$$;
DELETE FROM public.store_schedule_exceptions WHERE id='9c000000-0000-0000-0000-000000000003';

SET LOCAL ROLE service_role;
DO $$BEGIN
 IF has_function_privilege('anon','marketplace_sec.add_store_open_seconds(uuid,timestamptz,integer,integer)','EXECUTE')
  OR has_function_privilege('authenticated','public.pause_for_emergency_closure(uuid,integer,uuid,text,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'schedule or closure privilege leaked';END IF;
END$$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.pause_for_emergency_closure('96000000-0000-0000-0000-000000000004',1,
 '9c000000-0000-0000-0000-000000000001','unit10-pause','9d000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '96000000-0000-0000-0000-000000000004' AND status='paused_for_emergency_closure'
  AND version=2 AND confirmation_open_seconds_remaining IS NOT NULL) THEN
  RAISE EXCEPTION 'emergency pause result mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_action_tasks WHERE entity_id=
  '96000000-0000-0000-0000-000000000004' AND task_type='emergency_pause_expiry'
  AND source_request_version=2 AND policy_snapshot_id IS NOT NULL AND status='open') THEN
  RAISE EXCEPTION 'emergency task provenance mismatch';END IF;
END$$;
UPDATE public.store_schedule_exceptions SET status='completed',updated_at=transaction_timestamp()
 WHERE id='9c000000-0000-0000-0000-000000000001';
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.resume_after_emergency_closure('96000000-0000-0000-0000-000000000004',2,
 'unit10-resume','9d000000-0000-0000-0000-000000000002');
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '96000000-0000-0000-0000-000000000004' AND status='store_reviewing' AND version=3) THEN
  RAISE EXCEPTION 'emergency resume result mismatch';END IF;
 BEGIN
  PERFORM public.resume_after_emergency_closure('96000000-0000-0000-0000-000000000004',2,
   'unit10-stale','9d000000-0000-0000-0000-000000000003');
  RAISE EXCEPTION 'stale resume unexpectedly succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='stale resume unexpectedly succeeded' THEN RAISE;END IF;
 END;
END$$;
RESET ROLE;

UPDATE public.store_entitlements SET is_enabled=false WHERE store_id=
 '92000000-0000-0000-0000-000000000002' AND feature_key='commerce_order_requests_enabled';
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_requests WHERE id=
  '96000000-0000-0000-0000-000000000004' AND status='store_reviewing') THEN
 RAISE EXCEPTION 'feature disable silently mutated request';END IF;
END$$;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.inventory_holds WHERE order_request_id=
  '96000000-0000-0000-0000-000000000003' AND hold_type='firm' AND status='active') THEN
  RAISE EXCEPTION 'planned/feature closure released payment-ready hold';END IF;
END$$;
ROLLBACK;
