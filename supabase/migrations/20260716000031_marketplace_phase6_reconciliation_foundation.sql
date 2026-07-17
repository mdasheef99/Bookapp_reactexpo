-- Phase 6 Unit 15A: restricted reconciliation cases and non-PII observations.
BEGIN;

CREATE TABLE public.commerce_reconciliation_runs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),correlation_id UUID NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'running' CHECK(status IN('running','succeeded','failed')),
 finding_count INTEGER NOT NULL DEFAULT 0 CHECK(finding_count>=0),
 started_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),finished_at TIMESTAMPTZ,
 safe_error_category TEXT
);
CREATE TABLE public.commerce_reconciliation_cases(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),finding_key TEXT NOT NULL UNIQUE,
 category TEXT NOT NULL,severity TEXT NOT NULL CHECK(severity IN('critical','high','medium','low')),
 entity_type TEXT NOT NULL,entity_id UUID,store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
 safe_payload JSONB NOT NULL DEFAULT '{}'::jsonb,correlation_id UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','acknowledged','resolved')),
 first_observed_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
 last_observed_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
 occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK(occurrence_count>=1),resolved_at TIMESTAMPTZ
);
CREATE INDEX commerce_reconciliation_cases_active_idx
 ON public.commerce_reconciliation_cases(status,severity,last_observed_at DESC);
CREATE INDEX commerce_reconciliation_cases_entity_idx
 ON public.commerce_reconciliation_cases(entity_type,entity_id);

CREATE TABLE public.commerce_operational_observations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),observation_type TEXT NOT NULL CHECK(observation_type IN(
  'command_outcome','idempotency_replay','stale_version','hold_change','inventory_discrepancy',
  'request_transition','task_claim','task_execution','retry','stale_lease','dead_letter',
  'notification_transport','reconciliation_finding','manual_replay','policy_misconfiguration')),
 outcome TEXT NOT NULL,entity_type TEXT,entity_id UUID,store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
 correlation_id UUID,duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms>=0),
 safe_payload JSONB NOT NULL DEFAULT '{}'::jsonb,observed_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp()
);
CREATE INDEX commerce_operational_observations_type_time_idx
 ON public.commerce_operational_observations(observation_type,observed_at DESC);

ALTER TABLE public.commerce_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_reconciliation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_operational_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_reconciliation_runs,public.commerce_reconciliation_cases,
 public.commerce_operational_observations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.commerce_reconciliation_runs,public.commerce_reconciliation_cases,
 public.commerce_operational_observations TO service_role;

CREATE FUNCTION marketplace_sec.validate_phase6_operational_payload()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 PERFORM marketplace_sec.assert_phase6_safe_payload(NEW.safe_payload);
 RETURN NEW;
END;$$;
CREATE TRIGGER commerce_reconciliation_cases_safe_payload BEFORE INSERT OR UPDATE
 ON public.commerce_reconciliation_cases FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.validate_phase6_operational_payload();
CREATE TRIGGER commerce_operational_observations_safe_payload BEFORE INSERT OR UPDATE
 ON public.commerce_operational_observations FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.validate_phase6_operational_payload();

CREATE FUNCTION marketplace_sec.record_phase6_reconciliation_case(
 p_finding_key TEXT,p_category TEXT,p_severity TEXT,p_entity_type TEXT,p_entity_id UUID,
 p_store_id UUID,p_safe_payload JSONB,p_correlation_id UUID
) RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_id UUID;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_finding_key IS NULL OR p_category IS NULL OR p_entity_type IS NULL
  OR p_correlation_id IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 PERFORM marketplace_sec.assert_phase6_safe_payload(p_safe_payload);
 INSERT INTO public.commerce_reconciliation_cases(finding_key,category,severity,entity_type,
  entity_id,store_id,safe_payload,correlation_id)
 VALUES(p_finding_key,p_category,p_severity,p_entity_type,p_entity_id,p_store_id,
  COALESCE(p_safe_payload,'{}'::jsonb),p_correlation_id)
 ON CONFLICT(finding_key) DO UPDATE SET last_observed_at=transaction_timestamp(),
  occurrence_count=public.commerce_reconciliation_cases.occurrence_count+1,
  severity=EXCLUDED.severity,safe_payload=EXCLUDED.safe_payload,
  correlation_id=EXCLUDED.correlation_id,status='open',resolved_at=NULL
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE FUNCTION marketplace_sec.record_phase6_observation(
 p_type TEXT,p_outcome TEXT,p_entity_type TEXT,p_entity_id UUID,p_store_id UUID,
 p_correlation_id UUID,p_duration_ms INTEGER,p_safe_payload JSONB
) RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_id UUID;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 PERFORM marketplace_sec.assert_phase6_safe_payload(p_safe_payload);
 INSERT INTO public.commerce_operational_observations(observation_type,outcome,entity_type,
  entity_id,store_id,correlation_id,duration_ms,safe_payload)
 VALUES(p_type,p_outcome,p_entity_type,p_entity_id,p_store_id,p_correlation_id,p_duration_ms,
  COALESCE(p_safe_payload,'{}'::jsonb)) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.record_phase6_reconciliation_case(TEXT,TEXT,TEXT,TEXT,UUID,UUID,JSONB,UUID)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_phase6_observation(TEXT,TEXT,TEXT,UUID,UUID,UUID,INTEGER,JSONB)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.validate_phase6_operational_payload()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_phase6_reconciliation_case(TEXT,TEXT,TEXT,TEXT,UUID,UUID,JSONB,UUID)
 TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_phase6_observation(TEXT,TEXT,TEXT,UUID,UUID,UUID,INTEGER,JSONB)
 TO service_role;
COMMIT;
