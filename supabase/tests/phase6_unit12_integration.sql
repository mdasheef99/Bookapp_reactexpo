-- Phase 6 Unit 12 disposable PostgreSQL gate. Isolated local database only.
BEGIN;
DO $$
BEGIN
 IF to_regprocedure('public.claim_phase6_tasks(uuid,integer)') IS NULL THEN
  RAISE EXCEPTION 'claim_phase6_tasks missing';END IF;
 IF to_regprocedure('public.replay_phase6_dead_letter(uuid,text,uuid)') IS NULL THEN
  RAISE EXCEPTION 'replay_phase6_dead_letter missing';END IF;
 IF has_function_privilege('authenticated','public.claim_phase6_tasks(uuid,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'ordinary client can claim tasks';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND p.proname='claim_phase6_tasks'
   AND pg_get_functiondef(p.oid) LIKE '%FOR UPDATE SKIP LOCKED%') THEN
  RAISE EXCEPTION 'skip-locked claim missing';END IF;
 IF to_regclass('public.commerce_task_dead_letters') IS NULL THEN
  RAISE EXCEPTION 'dead-letter evidence missing';END IF;
 IF EXISTS(SELECT 1 FROM public.event_action_tasks WHERE task_type='cart_abandonment') THEN
  RAISE EXCEPTION 'per-cart abandonment task forbidden';END IF;
END;$$;
ROLLBACK;
