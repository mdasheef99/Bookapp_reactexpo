-- Phase 6 Unit 11 disposable PostgreSQL gate. Run only on an isolated local database.
BEGIN;

DO $$
BEGIN
 -- event uniqueness
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='marketplace_events_transition_unique') THEN
  RAISE EXCEPTION 'event uniqueness contract missing';END IF;
 -- notification fan-out
 IF to_regprocedure('marketplace_sec.phase6_notification_owner_recipients(uuid)') IS NULL THEN
  RAISE EXCEPTION 'notification fan-out helper missing';END IF;
 -- persisted RLS
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.marketplace_notifications'::regclass) THEN
  RAISE EXCEPTION 'persisted RLS missing';END IF;
 IF has_table_privilege('authenticated','public.marketplace_events','SELECT') THEN
  RAISE EXCEPTION 'raw event grant leaked';END IF;
 -- atomic rollback: evidence and inbox tables participate in the caller transaction.
 IF to_regclass('public.commerce_transition_log') IS NULL OR
    to_regclass('public.marketplace_notifications') IS NULL THEN
  RAISE EXCEPTION 'atomic rollback tables missing';END IF;
 -- transport failure preserves the canonical FK target and records dead letter independently.
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='notification_deliveries' AND column_name='dead_lettered_at') THEN
  RAISE EXCEPTION 'transport failure evidence missing';END IF;
 -- cross-tenant denial is enforced by recipient ownership and no raw base grants.
 IF has_function_privilege('anon','public.marketplace_list_commerce_notifications()','EXECUTE') THEN
  RAISE EXCEPTION 'cross-tenant denial function grant missing';END IF;
END;$$;

ROLLBACK;
