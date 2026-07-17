-- Phase 6 Unit 11A: canonical event, audit, inbox, and privacy contract.
BEGIN;

CREATE TABLE public.marketplace_event_schema_registry(
 event_type TEXT NOT NULL,
 schema_version INTEGER NOT NULL CHECK(schema_version>=1),
 entity_type TEXT NOT NULL,
 is_transition BOOLEAN NOT NULL,
 privacy_classification TEXT NOT NULL CHECK(privacy_classification IN('internal','confidential')),
 PRIMARY KEY(event_type,schema_version)
);
INSERT INTO public.marketplace_event_schema_registry VALUES
 ('marketplace_cart.submitted',1,'marketplace_cart',true,'internal'),
 ('marketplace_cart.replaced',1,'marketplace_cart',true,'internal'),
 ('marketplace_cart.abandoned',1,'marketplace_cart',true,'internal'),
 ('order_request.submitted',1,'store_order_request',false,'internal'),
 ('order_request.review_started',1,'store_order_request',true,'internal'),
 ('order_request.clarification_requested',1,'store_order_request',true,'internal'),
 ('order_request.clarification_provided',1,'store_order_request',true,'internal'),
 ('order_request.confirmed',1,'store_order_request',true,'internal'),
 ('order_request.partially_confirmed',1,'store_order_request',true,'internal'),
 ('order_request.unavailable',1,'store_order_request',true,'internal'),
 ('order_request.rejected',1,'store_order_request',true,'internal'),
 ('order_request.changes_accepted',1,'store_order_request',true,'internal'),
 ('order_request.cancelled',1,'store_order_request',true,'internal'),
 ('order_request.expired',1,'store_order_request',true,'internal'),
 ('order_request.payment_ready_expired',1,'store_order_request',true,'internal'),
 ('order_request.emergency_closure_paused',1,'store_order_request',true,'internal'),
 ('order_request.emergency_closure_resumed',1,'store_order_request',true,'internal'),
 ('order_request.store_ineligible',1,'store_order_request',true,'confidential'),
 ('order_request.support_requested',1,'store_order_request',false,'confidential'),
 ('order_request.support_intervened',1,'store_order_request',true,'confidential'),
 ('order_request.confirmation_due_soon',1,'store_order_request',false,'internal');

CREATE TABLE public.marketplace_notification_type_registry(
 notification_type TEXT PRIMARY KEY,
 audience TEXT NOT NULL CHECK(audience IN('customer','store','ops'))
);
-- Canonical seed includes 'commerce.order_request.submitted.store'.
INSERT INTO public.marketplace_notification_type_registry(notification_type,audience)
SELECT value, CASE WHEN value LIKE '%.customer' THEN 'customer'
 WHEN value LIKE '%.store' THEN 'store' ELSE 'ops' END
FROM jsonb_array_elements_text('[
 "commerce.marketplace_cart.replaced.customer","commerce.order_request.submitted.customer",
 "commerce.order_request.submitted.store","commerce.order_request.confirmation_due.store",
 "commerce.order_request.review_started.customer","commerce.order_request.clarification_required.customer",
 "commerce.order_request.clarification_received.store","commerce.order_request.payment_ready.customer",
 "commerce.order_request.confirmed.store","commerce.order_request.partial.customer",
 "commerce.order_request.partial.store","commerce.order_request.unavailable.customer",
 "commerce.order_request.unavailable.store","commerce.order_request.rejected.customer",
 "commerce.order_request.rejected.store","commerce.order_request.changes_accepted.store",
 "commerce.order_request.cancelled.customer","commerce.order_request.cancelled.store",
 "commerce.order_request.expired.customer","commerce.order_request.expired.store",
 "commerce.order_request.payment_ready_expired.customer","commerce.order_request.payment_ready_expired.store",
 "commerce.order_request.closure_paused.customer","commerce.order_request.closure_paused.store",
 "commerce.order_request.closure_paused.ops","commerce.order_request.closure_resumed.customer",
 "commerce.order_request.closure_resumed.store","commerce.order_request.store_ineligible.customer",
 "commerce.order_request.store_ineligible.store","commerce.order_request.store_ineligible.ops",
 "commerce.order_request.support_requested.store","commerce.order_request.support_requested.ops",
 "commerce.order_request.support_intervened.customer","commerce.order_request.support_intervened.store",
 "commerce.order_request.support_intervened.ops"]'::jsonb);

ALTER TABLE public.marketplace_notifications
 ADD COLUMN dedupe_key TEXT,
 ADD COLUMN deep_link_route TEXT,
 ADD COLUMN deep_link_data JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.marketplace_notifications SET
 dedupe_key=COALESCE(event_id::TEXT,id::TEXT)||':'||COALESCE(user_id::TEXT,'ops')||':'||notification_type,
 deep_link_route=CASE WHEN notification_type LIKE 'commerce.%' AND notification_type LIKE '%.store'
  THEN 'owner_order_request' WHEN notification_type LIKE 'commerce.%' THEN 'customer_order_request' END,
 deep_link_data=CASE WHEN notification_type LIKE 'commerce.%' AND entity_id IS NOT NULL
  THEN jsonb_build_object('requestId',entity_id) ELSE '{}'::jsonb END;
CREATE UNIQUE INDEX marketplace_notifications_commerce_dedupe_unique
 ON public.marketplace_notifications(dedupe_key) WHERE notification_type LIKE 'commerce.%';

ALTER TABLE public.marketplace_audit_logs
 ADD COLUMN command_name TEXT,
 ADD COLUMN actor_role TEXT,
 ADD COLUMN outcome TEXT NOT NULL DEFAULT 'succeeded' CHECK(outcome IN('succeeded','denied','resolved_noop','failed')),
 ADD COLUMN reason_code TEXT,
 ADD COLUMN version_before INTEGER,
 ADD COLUMN version_after INTEGER,
 ADD COLUMN correlation_id UUID,
 ADD COLUMN privacy_classification TEXT NOT NULL DEFAULT 'confidential'
  CHECK(privacy_classification IN('internal','confidential','restricted'));

CREATE FUNCTION marketplace_sec.assert_phase6_safe_payload(p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_key TEXT;
BEGIN
 FOREACH v_key IN ARRAY ARRAY['phone','address','clarification','support_note','command_id',
  'correlation_id','causation_id','snapshot_id'] LOOP
  IF COALESCE(p_payload,'{}'::jsonb)::TEXT ~* ('"'||v_key||'"[[:space:]]*:') THEN
   RAISE EXCEPTION 'UNSAFE_COMMERCE_PAYLOAD';
  END IF;
 END LOOP;
END;$$;

CREATE FUNCTION marketplace_sec.validate_phase6_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_registered public.marketplace_event_schema_registry%ROWTYPE;
BEGIN
 IF NEW.event_type LIKE 'order_request.%' OR NEW.event_type LIKE 'marketplace_cart.%' THEN
  SELECT * INTO v_registered FROM public.marketplace_event_schema_registry r
   WHERE r.event_type=NEW.event_type AND r.schema_version=NEW.schema_version;
  IF NOT FOUND OR v_registered.entity_type<>NEW.entity_type THEN RAISE EXCEPTION 'INVALID_EVENT_SCHEMA';END IF;
  PERFORM marketplace_sec.assert_phase6_safe_payload(NEW.payload);
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER marketplace_events_phase6_validate BEFORE INSERT ON public.marketplace_events
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.validate_phase6_event();
CREATE UNIQUE INDEX marketplace_events_transition_unique ON public.marketplace_events(command_id)
 WHERE command_id IS NOT NULL AND event_type IN('marketplace_cart.submitted',
 'marketplace_cart.replaced','marketplace_cart.abandoned','order_request.review_started',
 'order_request.clarification_requested','order_request.clarification_provided',
 'order_request.confirmed','order_request.partially_confirmed','order_request.unavailable',
 'order_request.rejected','order_request.changes_accepted','order_request.cancelled',
 'order_request.expired','order_request.payment_ready_expired',
 'order_request.emergency_closure_paused','order_request.emergency_closure_resumed',
 'order_request.store_ineligible','order_request.support_intervened');
-- Registry semantics: WHEN 'order_request.support_requested' THEN false (non-transitioning).

CREATE FUNCTION marketplace_sec.phase6_notification_owner_recipients(p_store_id UUID)
RETURNS TABLE(user_id UUID) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT DISTINCT sa.user_id FROM public.store_administrators sa
 WHERE sa.store_id=p_store_id AND sa.role='owner' AND sa.status='active'
 AND EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=sa.store_id
  AND se.feature_key='commerce_order_request_owner_notifications_enabled' AND se.is_enabled=true) $$;

CREATE FUNCTION marketplace_sec.phase6_notification_ops_recipients()
RETURNS TABLE(user_id UUID) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT DISTINCT pr.user_id FROM public.platform_user_roles pr
 WHERE pr.status='active' AND pr.role IN('platform_admin','support_agent') $$;

CREATE FUNCTION marketplace_sec.validate_phase6_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_audience TEXT;v_customer UUID;
BEGIN
 IF NEW.notification_type NOT LIKE 'commerce.%' THEN RETURN NEW;END IF;
 SELECT audience INTO v_audience FROM public.marketplace_notification_type_registry
  WHERE notification_type=NEW.notification_type;
 IF NOT FOUND OR NEW.event_id IS NULL OR NEW.user_id IS NULL THEN RAISE EXCEPTION 'INVALID_NOTIFICATION_TYPE';END IF;
 PERFORM marketplace_sec.assert_phase6_safe_payload(jsonb_build_object('title',NEW.title,'body',NEW.body));
 IF v_audience='customer' THEN
  IF NEW.entity_type='marketplace_cart' THEN
   SELECT user_id INTO v_customer FROM public.marketplace_carts WHERE id=NEW.entity_id;
  ELSE
   SELECT user_id INTO v_customer FROM public.store_order_requests WHERE id=NEW.entity_id;
  END IF;
  IF v_customer IS DISTINCT FROM NEW.user_id THEN RAISE EXCEPTION 'INVALID_NOTIFICATION_RECIPIENT';END IF;
 ELSIF v_audience='store' THEN
  IF NOT EXISTS(SELECT 1 FROM marketplace_sec.phase6_notification_owner_recipients(NEW.store_id) x WHERE x.user_id=NEW.user_id) THEN
   RAISE EXCEPTION 'INVALID_NOTIFICATION_RECIPIENT';END IF;
 ELSIF v_audience='ops' AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase6_notification_ops_recipients() x WHERE x.user_id=NEW.user_id) THEN
  RAISE EXCEPTION 'INVALID_NOTIFICATION_RECIPIENT';
 END IF;
 NEW.deep_link_route=CASE v_audience WHEN 'store' THEN 'owner_order_request'
  WHEN 'ops' THEN 'ops_order_request' ELSE 'customer_order_request' END;
 IF NEW.deep_link_route NOT IN ('customer_order_request','owner_order_request','ops_order_request') THEN RAISE EXCEPTION 'INVALID_DEEP_LINK';END IF;
 NEW.deep_link_data=jsonb_build_object('requestId',NEW.entity_id);
 NEW.dedupe_key=NEW.event_id::TEXT||':'||NEW.user_id::TEXT||':'||NEW.notification_type;
 RETURN NEW;
END;$$;
CREATE TRIGGER marketplace_notifications_phase6_validate BEFORE INSERT OR UPDATE
 ON public.marketplace_notifications FOR EACH ROW EXECUTE FUNCTION marketplace_sec.validate_phase6_notification();
ALTER TABLE public.marketplace_notifications ADD CONSTRAINT marketplace_notifications_safe_route
 CHECK(deep_link_route IS NULL OR deep_link_route IN ('customer_order_request','owner_order_request')
  OR deep_link_route='ops_order_request')
 NOT VALID;
DROP POLICY IF EXISTS "notifications recipient select" ON public.marketplace_notifications;
CREATE POLICY "notifications recipient select" ON public.marketplace_notifications
 FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE FUNCTION marketplace_sec.validate_phase6_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;
BEGIN
 IF NEW.entity_type IN('store_order_request','marketplace_cart') THEN
  PERFORM marketplace_sec.assert_phase6_safe_payload(NEW.details);
  IF NEW.entity_type='store_order_request' THEN
   SELECT * INTO v_request FROM public.store_order_requests WHERE id=NEW.entity_id;
  END IF;
  NEW.command_name=COALESCE(NEW.command_name,NEW.action);
  NEW.actor_role=COALESCE(NEW.actor_role,NEW.details->>'actorRole',CASE
   WHEN NEW.actor_user_id=v_request.user_id THEN 'customer'
   WHEN EXISTS(SELECT 1 FROM public.store_administrators sa WHERE sa.store_id=NEW.store_id
    AND sa.user_id=NEW.actor_user_id AND sa.role='owner' AND sa.status='active') THEN 'owner'
   WHEN EXISTS(SELECT 1 FROM public.platform_user_roles pr WHERE pr.user_id=NEW.actor_user_id
    AND pr.status='active') THEN 'platform_operator' ELSE 'system' END);
  NEW.reason_code=COALESCE(NEW.reason_code,NEW.details->>'reasonCode');
  NEW.version_before=COALESCE(NEW.version_before,(NEW.details->>'versionBefore')::INTEGER,v_request.version);
  NEW.version_after=COALESCE(NEW.version_after,(NEW.details->>'versionAfter')::INTEGER,
   CASE WHEN NEW.details->>'from' IS DISTINCT FROM NEW.details->>'to' AND NEW.details ? 'to'
    THEN v_request.version+1 ELSE v_request.version END);
  NEW.correlation_id=COALESCE(NEW.correlation_id,v_request.correlation_id);
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER marketplace_audit_logs_phase6_validate BEFORE INSERT ON public.marketplace_audit_logs
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.validate_phase6_audit();

CREATE FUNCTION marketplace_sec.project_phase6_ops_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_type TEXT;
BEGIN
 v_type:=CASE NEW.event_type WHEN 'order_request.support_requested'
  THEN 'commerce.order_request.support_requested.ops' WHEN 'order_request.store_ineligible'
  THEN 'commerce.order_request.store_ineligible.ops' ELSE NULL END;
 IF v_type IS NOT NULL THEN
  INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
   entity_type,entity_id,event_id,privacy_classification)
  SELECT NEW.store_id,x.user_id,v_type,'Commerce action required',
   'Open the operations queue to review this request.',NEW.entity_type,NEW.entity_id,NEW.id,'confidential'
  FROM marketplace_sec.phase6_notification_ops_recipients() x ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER marketplace_events_phase6_ops_projection AFTER INSERT ON public.marketplace_events
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.project_phase6_ops_notification();

CREATE FUNCTION marketplace_sec.reject_phase6_evidence_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY_EVIDENCE';END;$$;
CREATE TRIGGER marketplace_events_append_only BEFORE UPDATE OR DELETE ON public.marketplace_events
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.reject_phase6_evidence_mutation();
CREATE TRIGGER marketplace_audit_logs_append_only BEFORE UPDATE OR DELETE ON public.marketplace_audit_logs
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.reject_phase6_evidence_mutation();
CREATE TRIGGER commerce_transition_log_append_only BEFORE UPDATE OR DELETE ON public.commerce_transition_log
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.reject_phase6_evidence_mutation();
CREATE TRIGGER commerce_creation_log_append_only BEFORE UPDATE OR DELETE ON public.commerce_entity_creation_log
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.reject_phase6_evidence_mutation();

REVOKE ALL ON public.marketplace_event_schema_registry FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.marketplace_notification_type_registry FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.marketplace_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.marketplace_audit_logs FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.commerce_transition_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.marketplace_event_schema_registry,public.marketplace_notification_type_registry TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.assert_phase6_safe_payload(JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase6_notification_owner_recipients(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase6_notification_ops_recipients() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.assert_phase6_safe_payload(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase6_notification_owner_recipients(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase6_notification_ops_recipients() TO service_role;
COMMIT;
