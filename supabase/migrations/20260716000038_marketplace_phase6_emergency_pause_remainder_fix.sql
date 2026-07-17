-- Phase 6 persisted-gate corrective: a reminder that is already due has zero
-- open seconds remaining, not an absent remainder.
BEGIN;

CREATE FUNCTION marketplace_sec.ensure_phase6_emergency_pause_remainder()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('submitted','store_reviewing')
     AND NEW.status = 'paused_for_emergency_closure'
     AND NEW.confirmation_open_seconds_remaining IS NULL THEN
    NEW.confirmation_open_seconds_remaining:=0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ab_store_order_requests_emergency_pause_remainder
BEFORE UPDATE ON public.store_order_requests
FOR EACH ROW
EXECUTE FUNCTION marketplace_sec.ensure_phase6_emergency_pause_remainder();

REVOKE ALL ON FUNCTION marketplace_sec.ensure_phase6_emergency_pause_remainder()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.ensure_phase6_emergency_pause_remainder()
 TO service_role;

COMMIT;
