-- Cleanup for committed Unit 10 concurrency fixtures.
\set ON_ERROR_STOP on
BEGIN;
UPDATE public.store_order_requests SET closure_exception_id=NULL,paused_from_status=NULL
 WHERE store_id='92000000-0000-0000-0000-000000000002';
DELETE FROM public.store_recurring_open_intervals WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
DELETE FROM public.store_schedule_profiles WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
DELETE FROM public.store_schedule_exceptions WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
COMMIT;
\ir phase6_unit9_cleanup.sql
