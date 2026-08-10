BEGIN;

CREATE TABLE marketplace_sec.phase9_worker_wake_dispatches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tick_started_at timestamptz NOT NULL,
  job_kind text NOT NULL CHECK (job_kind IN (
    'media_validate_sanitize','vision_extract','metadata_enrich'
  )),
  request_id bigint UNIQUE,
  dispatch_state text NOT NULL CHECK (dispatch_state IN (
    'configuration_missing','enqueued','enqueue_failed'
  )),
  response_state text NOT NULL CHECK (response_state IN (
    'not_requested','pending','succeeded','http_failed','timed_out',
    'network_failed','response_unknown'
  )),
  http_status integer CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(tick_started_at,job_kind)
);

ALTER TABLE marketplace_sec.phase9_worker_wake_dispatches OWNER TO postgres;
REVOKE ALL ON TABLE marketplace_sec.phase9_worker_wake_dispatches
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE marketplace_sec.phase9_worker_wake_dispatches_id_seq
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.has_claimable_phase9_work(p_job_kind text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF p_job_kind NOT IN (
    'media_validate_sanitize','vision_extract','metadata_enrich'
  ) THEN
    RAISE EXCEPTION 'P9_DISPATCH_KIND_INVALID';
  END IF;

  RETURN EXISTS(
    SELECT 1
    FROM public.image_extraction_jobs j
    WHERE j.job_kind=p_job_kind
      AND j.status IN ('open','retry_scheduled','in_progress')
      AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts
  );
END$$;

ALTER FUNCTION marketplace_sec.has_claimable_phase9_work(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.has_claimable_phase9_work(text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_tick timestamptz:=date_trunc('minute',transaction_timestamp());
  v_job_kind text;
  v_url_name text;
  v_token_name text;
  v_url text;
  v_token text;
  v_row_id bigint;
  v_dispatch_id uuid;
  v_request_id bigint;
  v_reconciled integer:=0;
  v_dispatched integer:=0;
  v_configuration_missing integer:=0;
  v_enqueue_failed integer:=0;
BEGIN
  UPDATE marketplace_sec.phase9_worker_wake_dispatches d
  SET response_state=CASE
      WHEN coalesce(r.timed_out,false) THEN 'timed_out'
      WHEN r.error_msg IS NOT NULL THEN 'network_failed'
      WHEN r.status_code BETWEEN 200 AND 299 THEN 'succeeded'
      ELSE 'http_failed'
    END,
    http_status=r.status_code,
    updated_at=transaction_timestamp()
  FROM net._http_response r
  WHERE d.request_id=r.id AND d.response_state='pending';
  GET DIAGNOSTICS v_reconciled=ROW_COUNT;

  UPDATE marketplace_sec.phase9_worker_wake_dispatches d
  SET response_state='response_unknown',updated_at=transaction_timestamp()
  WHERE d.response_state='pending'
    AND d.created_at<transaction_timestamp()-interval '15 minutes'
    AND NOT EXISTS(SELECT 1 FROM net._http_response r WHERE r.id=d.request_id);

  DELETE FROM marketplace_sec.phase9_worker_wake_dispatches
  WHERE created_at<transaction_timestamp()-interval '7 days';

  FOR v_job_kind,v_url_name,v_token_name IN
    SELECT * FROM (VALUES
      ('media_validate_sanitize','phase9_media_worker_url','phase9_media_worker_ingress_token'),
      ('vision_extract','phase9_vision_worker_url','phase9_vision_worker_ingress_token'),
      ('metadata_enrich','phase9_metadata_worker_url','phase9_metadata_worker_ingress_token')
    ) AS stages(job_kind,url_name,token_name)
  LOOP
    CONTINUE WHEN NOT marketplace_sec.has_claimable_phase9_work(v_job_kind);

    v_row_id:=NULL;
    v_dispatch_id:=NULL;
    INSERT INTO marketplace_sec.phase9_worker_wake_dispatches(
      tick_started_at,job_kind,dispatch_state,response_state
    ) VALUES(v_tick,v_job_kind,'configuration_missing','not_requested')
    ON CONFLICT (tick_started_at,job_kind) DO NOTHING
    RETURNING id,dispatch_id INTO v_row_id,v_dispatch_id;
    CONTINUE WHEN v_row_id IS NULL;

    BEGIN
      SELECT
        max(s.decrypted_secret) FILTER (WHERE s.name=v_url_name),
        max(s.decrypted_secret) FILTER (WHERE s.name=v_token_name)
      INTO v_url,v_token
      FROM vault.decrypted_secrets s
      WHERE s.name IN (v_url_name,v_token_name);

      IF v_url IS NULL OR v_token IS NULL
        OR v_url !~* '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$'
        OR char_length(v_token) NOT BETWEEN 32 AND 256
        OR v_token ~ '[[:space:][:cntrl:]]' THEN
        v_configuration_missing:=v_configuration_missing+1;
        CONTINUE;
      END IF;

      v_request_id:=net.http_post(
        url := rtrim(v_url,'/')||'/run',
        body := jsonb_build_object('contractVersion','phase9-v1','batchSize',1),
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer '||v_token,
          'x-phase9-dispatch-id',v_dispatch_id::text
        ),
        timeout_milliseconds := 120000
      );

      UPDATE marketplace_sec.phase9_worker_wake_dispatches
      SET request_id=v_request_id,dispatch_state='enqueued',
        response_state='pending',updated_at=transaction_timestamp()
      WHERE id=v_row_id;
      v_dispatched:=v_dispatched+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE marketplace_sec.phase9_worker_wake_dispatches
      SET dispatch_state='enqueue_failed',response_state='not_requested',
        updated_at=transaction_timestamp()
      WHERE id=v_row_id;
      v_enqueue_failed:=v_enqueue_failed+1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'reconciled',v_reconciled,
    'dispatched',v_dispatched,
    'configured_missing',v_configuration_missing,
    'enqueue_failed',v_enqueue_failed
  );
END$$;

ALTER FUNCTION marketplace_sec.dispatch_phase9_worker_wakes() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
  FROM PUBLIC,anon,authenticated,service_role;

DO $$
DECLARE v_cron_job_id bigint;
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL
    OR to_regnamespace('vault') IS NULL THEN
    RAISE EXCEPTION 'P9_DISPATCH_EXTENSION_MISSING';
  END IF;
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='phase9-worker-wake-dispatcher') THEN
    PERFORM cron.unschedule('phase9-worker-wake-dispatcher');
  END IF;
  v_cron_job_id:=cron.schedule(
    'phase9-worker-wake-dispatcher',
    '* * * * *',
    'SELECT marketplace_sec.dispatch_phase9_worker_wakes();'
  );
  PERFORM cron.alter_job(v_cron_job_id,active=>false);
END$$;

COMMIT;
