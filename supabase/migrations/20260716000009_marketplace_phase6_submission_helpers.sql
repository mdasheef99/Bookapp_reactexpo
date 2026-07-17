-- Phase 6 Unit 6A: deterministic submission identities and policy snapshots.
BEGIN;

CREATE FUNCTION marketplace_sec.derived_command_uuid(p_command_id UUID, p_label TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    substr(md5(p_command_id::TEXT || ':' || p_label),1,8) || '-' ||
    substr(md5(p_command_id::TEXT || ':' || p_label),9,4) || '-5' ||
    substr(md5(p_command_id::TEXT || ':' || p_label),14,3) || '-a' ||
    substr(md5(p_command_id::TEXT || ':' || p_label),18,3) || '-' ||
    substr(md5(p_command_id::TEXT || ':' || p_label),21,12)
  )::UUID;
$$;

CREATE FUNCTION marketplace_sec.snapshot_submission_policies(
  p_request_id UUID, p_store_id UUID, p_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_key TEXT; v_policy JSONB;
BEGIN
  FOREACH v_key IN ARRAY ARRAY[
    'commerce.confirmation_reminder_open_seconds',
    'commerce.confirmation_expiry_business_days',
    'commerce.price_drift_tolerance_minor',
    'commerce.delivery_minimum_subtotal_minor',
    'commerce.delivery_fixed_tariff_minor',
    'commerce.delivery_free_threshold_minor'
  ] LOOP
    v_policy := marketplace_sec.resolve_phase6_policy(v_key,p_store_id,p_at);
    IF v_policy IS NULL THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID'; END IF;
    INSERT INTO public.store_order_request_policy_snapshots(
      order_request_id,policy_key,value_type,resolved_value,source_policy_id,
      source_policy_version,source_scope_type,resolved_at
    ) VALUES(
      p_request_id,v_key,v_policy->>'value_type',v_policy->'value',
      (v_policy->>'policy_id')::UUID,(v_policy->>'policy_version')::INTEGER,
      v_policy->>'scope_type',p_at
    );
  END LOOP;
END;
$$;

CREATE FUNCTION marketplace_sec.submission_confirmation_window(
  p_store_id UUID, p_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_reminder INTEGER; v_days INTEGER;
BEGIN
  v_reminder := (marketplace_sec.resolve_phase6_policy(
    'commerce.confirmation_reminder_open_seconds',p_store_id,p_at)->'value')::INTEGER;
  v_days := (marketplace_sec.resolve_phase6_policy(
    'commerce.confirmation_expiry_business_days',p_store_id,p_at)->'value')::INTEGER;
  IF v_reminder NOT BETWEEN 3600 AND 43200 OR v_days NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';
  END IF;
  -- Unit 10 replaces elapsed-time boundaries with the open-hours calendar engine.
  RETURN jsonb_build_object('reminderAt',p_at+make_interval(secs=>v_reminder),
    'dueAt',p_at+make_interval(days=>v_days));
END;
$$;

REVOKE ALL ON FUNCTION marketplace_sec.derived_command_uuid(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.snapshot_submission_policies(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.submission_confirmation_window(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.derived_command_uuid(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.snapshot_submission_policies(UUID,UUID,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.submission_confirmation_window(UUID,TIMESTAMPTZ) TO service_role;

COMMIT;
