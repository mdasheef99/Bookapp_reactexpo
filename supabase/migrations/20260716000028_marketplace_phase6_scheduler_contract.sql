-- Phase 6 Unit 12C: service-only scheduler boundary. No cron schedule is enabled here.
BEGIN;

ALTER TABLE public.marketplace_events DROP CONSTRAINT marketplace_events_source_check;
ALTER TABLE public.marketplace_events ADD CONSTRAINT marketplace_events_source_check CHECK(source IN(
 'consumer_app','store_owner_app','platform_ops','system_job','task_worker',
 'payment_provider','delivery_provider','edge_function')) NOT VALID;

CREATE TABLE public.commerce_scheduler_config(
 singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton),
 scheduler_kind TEXT NOT NULL DEFAULT 'pg_cron' CHECK(scheduler_kind='pg_cron'),
 scheduler_cadence TEXT NOT NULL DEFAULT '1 minute',
 scheduler_endpoint TEXT NOT NULL DEFAULT 'commerce-scheduler',
 claim_batch_default INTEGER NOT NULL DEFAULT 50 CHECK(claim_batch_default BETWEEN 1 AND 100),
 maximum_scheduler_fanout INTEGER NOT NULL DEFAULT 4 CHECK(maximum_scheduler_fanout BETWEEN 1 AND 4),
 maximum_worker_concurrency INTEGER NOT NULL DEFAULT 10 CHECK(maximum_worker_concurrency BETWEEN 1 AND 10),
 worker_timeout_seconds INTEGER NOT NULL DEFAULT 240 CHECK(worker_timeout_seconds BETWEEN 30 AND 270)
);
INSERT INTO public.commerce_scheduler_config DEFAULT VALUES;
CREATE TABLE public.commerce_scheduler_leases(
 lease_key TEXT PRIMARY KEY,lease_owner UUID NOT NULL,lease_expires_at TIMESTAMPTZ NOT NULL,
 acquired_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE public.commerce_scheduler_runs(
 id UUID PRIMARY KEY,lease_owner UUID NOT NULL,started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,status TEXT NOT NULL DEFAULT 'running'
  CHECK(status IN('running','succeeded','failed','overlap_skipped')),
 tasks_claimed INTEGER NOT NULL DEFAULT 0,workers_started INTEGER NOT NULL DEFAULT 0,
 safe_error_category TEXT
);
ALTER TABLE public.commerce_scheduler_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_scheduler_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_scheduler_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_scheduler_config,public.commerce_scheduler_leases,
 public.commerce_scheduler_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.commerce_scheduler_config,public.commerce_scheduler_leases,
 public.commerce_scheduler_runs TO service_role;

CREATE FUNCTION marketplace_sec.acquire_phase6_scheduler_lease(p_run_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 INSERT INTO public.commerce_scheduler_leases(lease_key,lease_owner,lease_expires_at)
 VALUES('phase6-scheduler',p_run_id,transaction_timestamp()+interval '55 seconds')
 ON CONFLICT(lease_key) DO UPDATE SET lease_owner=EXCLUDED.lease_owner,
  lease_expires_at=EXCLUDED.lease_expires_at,acquired_at=transaction_timestamp()
 WHERE public.commerce_scheduler_leases.lease_expires_at<=transaction_timestamp();
 IF NOT FOUND THEN RETURN false;END IF;
 INSERT INTO public.commerce_scheduler_runs(id,lease_owner) VALUES(p_run_id,p_run_id)
 ON CONFLICT DO NOTHING;
 RETURN true;
END;$$;

CREATE FUNCTION public.acquire_phase6_scheduler_lease(p_run_id UUID) RETURNS BOOLEAN
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.acquire_phase6_scheduler_lease($1)$$;
CREATE FUNCTION public.claim_phase6_tasks(p_lease_owner UUID,p_batch_size INTEGER DEFAULT 50)
RETURNS SETOF public.event_action_tasks LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT * FROM marketplace_sec.claim_phase6_tasks($1,$2)$$;
CREATE FUNCTION public.complete_phase6_task(p_task_id UUID,p_lease_owner UUID,p_outcome TEXT,
 p_retryable BOOLEAN,p_error_category TEXT,p_correlation_id UUID) RETURNS TEXT
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.complete_phase6_task($1,$2,$3,$4,$5,$6)$$;
CREATE FUNCTION public.claim_phase6_notification_delivery(p_delivery_id UUID,p_lease_owner UUID)
RETURNS JSONB LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.claim_phase6_notification_delivery($1,$2)$$;
CREATE FUNCTION public.record_phase6_delivery_result(p_delivery_id UUID,p_lease_owner UUID,
 p_succeeded BOOLEAN,p_retryable BOOLEAN,p_error_category TEXT,p_provider_reference TEXT)
RETURNS TEXT LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.record_phase6_delivery_result($1,$2,$3,$4,$5,$6)$$;
CREATE FUNCTION public.finish_phase6_scheduler_run(p_run_id UUID,p_status TEXT,p_claimed INTEGER,
 p_workers INTEGER,p_error TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_status NOT IN('succeeded','failed','overlap_skipped')
  THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 UPDATE public.commerce_scheduler_runs SET status=p_status,finished_at=transaction_timestamp(),
  tasks_claimed=p_claimed,workers_started=p_workers,safe_error_category=p_error WHERE id=p_run_id;
 DELETE FROM public.commerce_scheduler_leases WHERE lease_key='phase6-scheduler' AND lease_owner=p_run_id;
END;$$;

REVOKE ALL ON FUNCTION public.acquire_phase6_scheduler_lease(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_phase6_tasks(UUID,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_phase6_task(UUID,UUID,TEXT,BOOLEAN,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_phase6_notification_delivery(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_phase6_delivery_result(UUID,UUID,BOOLEAN,BOOLEAN,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_phase6_scheduler_run(UUID,TEXT,INTEGER,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_phase6_scheduler_lease(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_phase6_tasks(UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_phase6_task(UUID,UUID,TEXT,BOOLEAN,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_phase6_notification_delivery(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_phase6_delivery_result(UUID,UUID,BOOLEAN,BOOLEAN,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_phase6_scheduler_run(UUID,TEXT,INTEGER,INTEGER,TEXT) TO service_role;
COMMIT;
