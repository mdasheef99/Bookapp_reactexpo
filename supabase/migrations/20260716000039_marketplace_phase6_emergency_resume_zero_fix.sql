-- Phase 6 persisted-gate corrective: zero remaining reminder time resumes at
-- the next opening instant, whose closing boundary becomes the due time.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_interval RECORD;
BEGIN
 IF OLD.status='paused_for_emergency_closure' AND NEW.status=OLD.paused_from_status THEN
  IF NEW.status IN('submitted','store_reviewing') THEN
   IF COALESCE(OLD.confirmation_open_seconds_remaining,0)=0 THEN
    SELECT * INTO v_interval
      FROM marketplace_sec.next_store_open_interval(
        OLD.store_id,transaction_timestamp(),62);
    IF NOT FOUND THEN RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE';END IF;
    NEW.confirmation_reminder_at:=v_interval.opens_at_utc;
    NEW.confirmation_due_at:=v_interval.closes_at_utc;
   ELSE
    NEW.confirmation_reminder_at:=marketplace_sec.add_store_open_seconds(OLD.store_id,
     transaction_timestamp(),OLD.confirmation_open_seconds_remaining,62);
    NEW.confirmation_due_at:=marketplace_sec.store_closing_boundary_after(OLD.store_id,
     NEW.confirmation_reminder_at,62);
   END IF;
  ELSIF NEW.status='awaiting_clarification' THEN
   NEW.clarification_expires_at:=transaction_timestamp()+
    make_interval(secs=>COALESCE(OLD.clarification_seconds_remaining,0));
  ELSIF NEW.status='awaiting_customer_decision' THEN
   NEW.acceptance_expires_at:=transaction_timestamp()+
    make_interval(secs=>COALESCE(OLD.decision_seconds_remaining,0));
   UPDATE public.inventory_holds SET expires_at=NEW.acceptance_expires_at,version=version+1
    WHERE order_request_id=OLD.id AND hold_type='soft' AND status='active';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.apply_emergency_resume_calendar_timing()
 TO service_role;

COMMIT;
