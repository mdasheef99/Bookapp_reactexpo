-- Phase 6 Unit 10A: normalized schedules and deterministic open-time engine.
BEGIN;
CREATE TABLE public.store_schedule_profiles(
 store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
 iana_timezone TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 is_active BOOLEAN NOT NULL DEFAULT true,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.store_recurring_open_intervals(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),store_id UUID NOT NULL
  REFERENCES public.stores(id) ON DELETE CASCADE,
 weekday SMALLINT NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 opens_at TIME NOT NULL,closes_at TIME NOT NULL,CHECK(opens_at<>closes_at),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(store_id,weekday,opens_at,closes_at)
);
CREATE INDEX store_recurring_open_intervals_lookup
 ON public.store_recurring_open_intervals(store_id,weekday,opens_at);
ALTER TABLE public.store_schedule_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_recurring_open_intervals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_schedule_profiles FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.store_recurring_open_intervals FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.store_schedule_profiles TO service_role;
GRANT ALL ON public.store_recurring_open_intervals TO service_role;

CREATE FUNCTION marketplace_sec.validate_store_open_schedule(p_store_id UUID)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_timezone TEXT;v_bad INTEGER;v_row RECORD;
BEGIN
 SELECT p.iana_timezone INTO v_timezone FROM public.store_schedule_profiles p
  WHERE p.store_id=p_store_id AND p.is_active=true;
 IF v_timezone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z
  WHERE z.name=v_timezone) THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 WITH spans AS(
  SELECT i.id,i.weekday*1440+(extract(hour FROM i.opens_at)::INTEGER*60+
   extract(minute FROM i.opens_at)::INTEGER) AS begins,
   i.weekday*1440+(extract(hour FROM i.closes_at)::INTEGER*60+
   extract(minute FROM i.closes_at)::INTEGER)+CASE WHEN i.closes_at<=i.opens_at THEN 1440 ELSE 0 END AS ends
  FROM public.store_recurring_open_intervals i WHERE i.store_id=p_store_id),
 expanded AS(SELECT id,begins,ends FROM spans UNION ALL
  SELECT id,begins+10080,ends+10080 FROM spans UNION ALL
  SELECT id,begins-10080,ends-10080 FROM spans)
 SELECT count(*) INTO v_bad FROM expanded a JOIN expanded b ON a.id<>b.id
  AND int4range(a.begins,a.ends,'[)') && int4range(b.begins,b.ends,'[)')
 WHERE a.begins BETWEEN 0 AND 10079;
 IF v_bad>0 OR EXISTS(SELECT 1 FROM public.store_schedule_exceptions e
  WHERE e.store_id=p_store_id AND e.timezone<>v_timezone AND e.status IN('scheduled','active')) THEN
  RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM public.store_schedule_exceptions e
  WHERE e.store_id=p_store_id AND e.exception_type='special_hours'
   AND e.status IN('scheduled','active') AND (e.special_hours IS NULL OR
    jsonb_typeof(e.special_hours)<>'array' OR jsonb_array_length(e.special_hours)=0)) THEN
  RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 FOR v_row IN SELECT e.special_hours FROM public.store_schedule_exceptions e
  WHERE e.store_id=p_store_id AND e.exception_type='special_hours'
   AND e.status IN('scheduled','active')
 LOOP
  BEGIN
   WITH spans AS(
    SELECT x.ordinality,(extract(hour FROM(x.value->>'opens')::TIME)::INTEGER*60+
     extract(minute FROM(x.value->>'opens')::TIME)::INTEGER) AS begins,
     (extract(hour FROM(x.value->>'closes')::TIME)::INTEGER*60+
     extract(minute FROM(x.value->>'closes')::TIME)::INTEGER) AS raw_ends
    FROM jsonb_array_elements(v_row.special_hours) WITH ORDINALITY x(value,ordinality)),
   ranges AS(SELECT ordinality,begins,raw_ends,
    raw_ends+CASE WHEN raw_ends<=begins THEN 1440 ELSE 0 END AS ends
    FROM spans)
   SELECT count(*) INTO v_bad FROM ranges a LEFT JOIN ranges b ON a.ordinality<b.ordinality
    AND int4range(a.begins,a.ends,'[)')&&int4range(b.begins,b.ends,'[)')
   WHERE a.begins=a.raw_ends OR b.ordinality IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END;
  IF v_bad>0 THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 END LOOP;
END;$$;

CREATE FUNCTION marketplace_sec.effective_store_open_intervals(
 p_store_id UUID,p_local_date DATE
)
RETURNS TABLE(opens_at_utc TIMESTAMPTZ,closes_at_utc TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_timezone TEXT;v_special JSONB;v_row RECORD;v_open TIME;v_close TIME;
BEGIN
 PERFORM marketplace_sec.validate_store_open_schedule(p_store_id);
 SELECT p.iana_timezone INTO v_timezone FROM public.store_schedule_profiles p
  WHERE p.store_id=p_store_id AND p.is_active=true;
 IF EXISTS(SELECT 1 FROM public.store_schedule_exceptions e WHERE e.store_id=p_store_id
  AND e.exception_type IN('holiday','planned_closure','emergency_closure')
  AND e.status IN('scheduled','active') AND e.starts_at<((p_local_date+1)::TIMESTAMP AT TIME ZONE v_timezone)
  AND e.ends_at>(p_local_date::TIMESTAMP AT TIME ZONE v_timezone)) THEN RETURN;END IF;
 SELECT e.special_hours INTO v_special FROM public.store_schedule_exceptions e
  WHERE e.store_id=p_store_id AND e.exception_type='special_hours'
   AND e.status IN('scheduled','active')
   AND (e.starts_at AT TIME ZONE v_timezone)::DATE=p_local_date
  ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
 IF v_special IS NOT NULL THEN
  FOR v_row IN SELECT * FROM jsonb_to_recordset(v_special) AS x(opens TEXT,closes TEXT)
  LOOP
   BEGIN v_open:=v_row.opens::TIME;v_close:=v_row.closes::TIME;
   EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END;
   IF v_open=v_close THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
   opens_at_utc:=(p_local_date+v_open) AT TIME ZONE v_timezone;
   closes_at_utc:=((p_local_date+CASE WHEN v_close<=v_open THEN 1 ELSE 0 END)+v_close)
    AT TIME ZONE v_timezone;RETURN NEXT;
  END LOOP;RETURN;
 END IF;
 FOR v_row IN SELECT i.opens_at,i.closes_at FROM public.store_recurring_open_intervals i
  WHERE i.store_id=p_store_id AND i.weekday=extract(dow FROM p_local_date)::INTEGER
  ORDER BY i.opens_at
 LOOP
  opens_at_utc:=(p_local_date+v_row.opens_at) AT TIME ZONE v_timezone;
  closes_at_utc:=((p_local_date+CASE WHEN v_row.closes_at<=v_row.opens_at THEN 1 ELSE 0 END)
   +v_row.closes_at) AT TIME ZONE v_timezone;RETURN NEXT;
 END LOOP;
 FOR v_row IN SELECT i.opens_at,i.closes_at FROM public.store_recurring_open_intervals i
  WHERE i.store_id=p_store_id AND i.weekday=extract(dow FROM(p_local_date-1))::INTEGER
   AND i.closes_at<=i.opens_at ORDER BY i.opens_at
 LOOP
  opens_at_utc:=p_local_date::TIMESTAMP AT TIME ZONE v_timezone;
  closes_at_utc:=(p_local_date+v_row.closes_at) AT TIME ZONE v_timezone;RETURN NEXT;
 END LOOP;
 FOR v_row IN SELECT x.opens::TIME AS opens_at,x.closes::TIME AS closes_at
  FROM public.store_schedule_exceptions e CROSS JOIN LATERAL
   jsonb_to_recordset(e.special_hours) AS x(opens TEXT,closes TEXT)
  WHERE e.store_id=p_store_id AND e.exception_type='special_hours'
   AND e.status IN('scheduled','active')
   AND (e.starts_at AT TIME ZONE v_timezone)::DATE=p_local_date-1
   AND x.closes::TIME<=x.opens::TIME ORDER BY x.opens::TIME
 LOOP
  opens_at_utc:=p_local_date::TIMESTAMP AT TIME ZONE v_timezone;
  closes_at_utc:=(p_local_date+v_row.closes_at) AT TIME ZONE v_timezone;RETURN NEXT;
 END LOOP;
END;$$;

CREATE FUNCTION marketplace_sec.next_store_open_interval(
 p_store_id UUID,p_from TIMESTAMPTZ,p_horizon_days INTEGER DEFAULT 62
)
RETURNS TABLE(opens_at_utc TIMESTAMPTZ,closes_at_utc TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_timezone TEXT;v_date DATE;v_day INTEGER;
BEGIN
 IF p_from IS NULL OR p_horizon_days NOT BETWEEN 1 AND 366 THEN
  RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 SELECT p.iana_timezone INTO v_timezone FROM public.store_schedule_profiles p
  WHERE p.store_id=p_store_id AND p.is_active=true;
 IF v_timezone IS NULL THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 v_date:=(p_from AT TIME ZONE v_timezone)::DATE;
 FOR v_day IN 0..p_horizon_days LOOP
  RETURN QUERY SELECT GREATEST(x.opens_at_utc,p_from),x.closes_at_utc
   FROM marketplace_sec.effective_store_open_intervals(p_store_id,v_date+v_day) x
   WHERE x.closes_at_utc>p_from ORDER BY x.opens_at_utc LIMIT 1;
  IF FOUND THEN RETURN;END IF;
 END LOOP;
END;$$;

CREATE FUNCTION marketplace_sec.add_store_open_seconds(
 p_store_id UUID,p_from TIMESTAMPTZ,p_seconds INTEGER,p_horizon_days INTEGER DEFAULT 62
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_cursor TIMESTAMPTZ:=p_from;v_remaining INTEGER:=p_seconds;v_interval RECORD;
 v_available INTEGER;v_steps INTEGER:=0;
BEGIN
 IF p_seconds IS NULL OR p_seconds<0 THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 IF p_seconds=0 THEN RETURN p_from;END IF;
 WHILE v_remaining>0 AND v_steps<=p_horizon_days*8 LOOP
  SELECT * INTO v_interval FROM marketplace_sec.next_store_open_interval(
   p_store_id,v_cursor,p_horizon_days);
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE';END IF;
  v_available:=extract(epoch FROM(v_interval.closes_at_utc-v_interval.opens_at_utc))::INTEGER;
  IF v_remaining<=v_available THEN
   RETURN v_interval.opens_at_utc+make_interval(secs=>v_remaining);END IF;
  v_remaining:=v_remaining-v_available;v_cursor:=v_interval.closes_at_utc;v_steps:=v_steps+1;
 END LOOP;
 RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE';
END;$$;

CREATE FUNCTION marketplace_sec.store_open_seconds_between(
 p_store_id UUID,p_from TIMESTAMPTZ,p_to TIMESTAMPTZ,p_horizon_days INTEGER DEFAULT 62
)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_cursor TIMESTAMPTZ:=p_from;v_interval RECORD;v_total INTEGER:=0;v_steps INTEGER:=0;
BEGIN
 IF p_to<p_from THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 WHILE v_cursor<p_to AND v_steps<=p_horizon_days*8 LOOP
  SELECT * INTO v_interval FROM marketplace_sec.next_store_open_interval(
   p_store_id,v_cursor,p_horizon_days);
  IF NOT FOUND OR v_interval.opens_at_utc>=p_to THEN RETURN v_total;END IF;
  v_total:=v_total+GREATEST(0,extract(epoch FROM(LEAST(p_to,v_interval.closes_at_utc)-
   GREATEST(v_cursor,v_interval.opens_at_utc)))::INTEGER);
  v_cursor:=v_interval.closes_at_utc;v_steps:=v_steps+1;
 END LOOP;RETURN v_total;
END;$$;

CREATE FUNCTION marketplace_sec.store_closing_boundary_after(
 p_store_id UUID,p_at TIMESTAMPTZ,p_horizon_days INTEGER DEFAULT 62
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_timezone TEXT;v_date DATE;v_close TIMESTAMPTZ;
BEGIN
 SELECT p.iana_timezone INTO v_timezone FROM public.store_schedule_profiles p
  WHERE p.store_id=p_store_id AND p.is_active=true;
 IF v_timezone IS NULL THEN RAISE EXCEPTION 'STORE_SCHEDULE_INVALID';END IF;
 v_date:=(p_at AT TIME ZONE v_timezone)::DATE;
 SELECT max(x.closes_at_utc) INTO v_close
  FROM marketplace_sec.effective_store_open_intervals(p_store_id,v_date) x
  WHERE x.opens_at_utc<=p_at AND x.closes_at_utc>=p_at;
 IF v_close IS NULL THEN RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE';END IF;
 RETURN v_close;
END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.validate_store_open_schedule(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.effective_store_open_intervals(UUID,DATE) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.next_store_open_interval(UUID,TIMESTAMPTZ,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.add_store_open_seconds(UUID,TIMESTAMPTZ,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.store_open_seconds_between(UUID,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.store_closing_boundary_after(UUID,TIMESTAMPTZ,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.validate_store_open_schedule(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.effective_store_open_intervals(UUID,DATE) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.next_store_open_interval(UUID,TIMESTAMPTZ,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.add_store_open_seconds(UUID,TIMESTAMPTZ,INTEGER,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.store_open_seconds_between(UUID,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.store_closing_boundary_after(UUID,TIMESTAMPTZ,INTEGER) TO service_role;
COMMIT;
