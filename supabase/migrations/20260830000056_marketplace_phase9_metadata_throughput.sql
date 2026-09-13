-- M56: Bound metadata throughput to a fifteen-job run budget while preserving
-- one wake per stage and a batch size of one for every non-metadata worker.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tick timestamptz:=date_trunc('minute',transaction_timestamp());
  v_kind text; v_url_name text; v_token_name text; v_url text; v_token text;
  v_row bigint; v_dispatch uuid; v_request bigint; v_reconciled integer:=0;
  v_dispatched integer:=0; v_missing integer:=0; v_failed integer:=0;
BEGIN
  UPDATE marketplace_sec.phase9_worker_wake_dispatches d SET
    response_state=CASE WHEN coalesce(r.timed_out,false) THEN 'timed_out'
      WHEN r.error_msg IS NOT NULL THEN 'network_failed'
      WHEN r.status_code BETWEEN 200 AND 299 THEN 'succeeded' ELSE 'http_failed' END,
    http_status=r.status_code,updated_at=transaction_timestamp()
  FROM net._http_response r WHERE d.request_id=r.id AND d.response_state='pending';
  GET DIAGNOSTICS v_reconciled=ROW_COUNT;
  DELETE FROM marketplace_sec.phase9_worker_wake_dispatches
    WHERE created_at<transaction_timestamp()-interval '7 days';
  FOR v_kind,v_url_name,v_token_name IN SELECT * FROM (VALUES
    ('media_validate_sanitize','phase9_media_worker_url','phase9_media_worker_ingress_token'),
    ('vision_extract','phase9_vision_worker_url','phase9_vision_worker_ingress_token'),
    ('metadata_enrich','phase9_metadata_worker_url','phase9_metadata_worker_ingress_token'),
    ('publication_retry','phase9_publication_worker_url','phase9_publication_worker_ingress_token')
  ) stages(kind,url_name,token_name) LOOP
    CONTINUE WHEN NOT marketplace_sec.has_claimable_phase9_work(v_kind);
    v_row:=NULL; v_dispatch:=NULL;
    INSERT INTO marketplace_sec.phase9_worker_wake_dispatches(
      tick_started_at,job_kind,dispatch_state,response_state
    ) VALUES(v_tick,v_kind,'configuration_missing','not_requested')
    ON CONFLICT(tick_started_at,job_kind) DO NOTHING
    RETURNING id,dispatch_id INTO v_row,v_dispatch;
    CONTINUE WHEN v_row IS NULL;
    BEGIN
      SELECT max(s.decrypted_secret) FILTER(WHERE s.name=v_url_name),
        max(s.decrypted_secret) FILTER(WHERE s.name=v_token_name)
      INTO v_url,v_token FROM vault.decrypted_secrets s
      WHERE s.name IN(v_url_name,v_token_name);
      IF v_url IS NULL OR v_token IS NULL
        OR v_url!~*'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$'
        OR char_length(v_token) NOT BETWEEN 32 AND 256 OR v_token~'[[:space:][:cntrl:]]'
      THEN v_missing:=v_missing+1; CONTINUE; END IF;
      v_request:=net.http_post(url:=rtrim(v_url,'/')||'/run',
        body:=jsonb_build_object('contractVersion','phase9-v1','batchSize',
          CASE WHEN v_kind='metadata_enrich' THEN 15 ELSE 1 END),
        params:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json',
          'Authorization','Bearer '||v_token,'x-phase9-dispatch-id',v_dispatch::text),
        timeout_milliseconds:=120000);
      UPDATE marketplace_sec.phase9_worker_wake_dispatches SET request_id=v_request,
        dispatch_state='enqueued',response_state='pending',updated_at=transaction_timestamp()
        WHERE id=v_row; v_dispatched:=v_dispatched+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE marketplace_sec.phase9_worker_wake_dispatches SET
        dispatch_state='enqueue_failed',response_state='not_requested',updated_at=transaction_timestamp()
        WHERE id=v_row; v_failed:=v_failed+1;
    END;
  END LOOP;
  RETURN jsonb_build_object('reconciled',v_reconciled,'dispatched',v_dispatched,
    'configured_missing',v_missing,'enqueue_failed',v_failed);
END$$;

ALTER FUNCTION marketplace_sec.dispatch_phase9_worker_wakes() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
  FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
