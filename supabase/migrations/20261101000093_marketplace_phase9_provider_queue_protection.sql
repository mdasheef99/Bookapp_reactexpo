-- Owner-authorized 8a-5 FILE only, 2026-11-01. NOT APPLIED.
-- Authority: 02c §§4.3–4.4/7/9; 02c-1 §2; OD-2026-10-31-4/6.
-- M89–M92 unchanged. No registry activation/operating values, worker or prefill.
BEGIN;

CREATE SEQUENCE marketplace_sec.phase9_admission_ticket AS bigint NO CYCLE;
CREATE TABLE marketplace_sec.phase9_store_admission (
 store_id uuid PRIMARY KEY REFERENCES public.stores(id),
 last_ticket bigint NOT NULL DEFAULT 0 CHECK (last_ticket>=0),
 window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 window_seconds integer CHECK (window_seconds>0),
 gets_used integer NOT NULL DEFAULT 0 CHECK (gets_used>=0),
 next_due_at timestamptz NOT NULL DEFAULT '-infinity'
);
CREATE TABLE marketplace_sec.phase9_job_admission_wait (
 job_id uuid PRIMARY KEY REFERENCES public.image_extraction_jobs(id),
 blocked_epoch bigint NOT NULL CHECK (blocked_epoch>=0),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Distinguish v2 claims from preserved legacy workers, even before begin/run.
CREATE TABLE marketplace_sec.phase9_metadata_admissions (
 job_id uuid PRIMARY KEY REFERENCES public.image_extraction_jobs(id),
 claim_attempt_number integer NOT NULL CHECK (claim_attempt_number BETWEEN 1 AND 5),
 claim_worker text NOT NULL,
 claim_lease_token_hash text NOT NULL CHECK (claim_lease_token_hash ~ '^[a-f0-9]{64}$'),
 store_id uuid REFERENCES public.stores(id),
 adapter_key text REFERENCES public.phase9_provider_registry(adapter_key),
 adapter_version text,
 fence jsonb,
 policy jsonb,
 slots_remaining smallint NOT NULL DEFAULT 0 CHECK (slots_remaining BETWEEN 0 AND 6),
 CHECK (slots_remaining=0 OR (store_id IS NOT NULL AND adapter_key IS NOT NULL
  AND adapter_version IS NOT NULL AND fence IS NOT NULL AND policy IS NOT NULL))
);
CREATE TABLE marketplace_sec.phase9_automatic_provider_runs (
 job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
 query_identity_hash text NOT NULL CHECK (query_identity_hash ~ '^[a-f0-9]{64}$'),
 adapter_key text NOT NULL REFERENCES public.phase9_provider_registry(adapter_key),
 adapter_version text NOT NULL CHECK (char_length(adapter_version) BETWEEN 1 AND 64),
 round smallint NOT NULL CHECK (round IN (0,1)),
 lookup_id uuid REFERENCES public.phase9_metadata_lookups(id),
 primary_attempt_id uuid REFERENCES public.metadata_enrichment_attempts(id),
 claim_attempt_number integer NOT NULL CHECK (claim_attempt_number BETWEEN 1 AND 5),
 claim_worker text NOT NULL CHECK (claim_worker ~ '^[A-Za-z0-9._:-]{16,128}$'),
 claim_lease_token_hash text NOT NULL CHECK (claim_lease_token_hash ~ '^[a-f0-9]{64}$'),
 candidate_version integer NOT NULL CHECK (candidate_version>0),
 captured_request_id uuid,
 request_generation integer NOT NULL CHECK (request_generation>=0),
 fence_digest text NOT NULL CHECK (fence_digest ~ '^[a-f0-9]{64}$'),
 retry_not_before timestamptz CHECK (isfinite(retry_not_before)),
 status text NOT NULL CHECK (status IN ('queued','running','finalized','unknown')),
 due_at timestamptz,
 retry_allowed boolean NOT NULL DEFAULT false,
 no_egress_recheck boolean NOT NULL DEFAULT false,
 outcome text,
 receipt_digest text CHECK (receipt_digest ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(job_id,query_identity_hash,adapter_key,adapter_version,round),
 CHECK ((lookup_id IS NULL)=(primary_attempt_id IS NULL)),
 CHECK (NOT retry_allowed OR (round=0 AND status='finalized' AND due_at IS NOT NULL))
);
-- 02c §9: no API-role table/sequence grants, including service_role.
ALTER SEQUENCE marketplace_sec.phase9_admission_ticket OWNER TO postgres;
REVOKE ALL ON SEQUENCE marketplace_sec.phase9_admission_ticket FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE marketplace_sec.phase9_store_admission OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_store_admission ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sec.phase9_job_admission_wait OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_job_admission_wait ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sec.phase9_automatic_provider_runs OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_automatic_provider_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sec.phase9_metadata_admissions OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_metadata_admissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_sec.phase9_store_admission,marketplace_sec.phase9_job_admission_wait,
 marketplace_sec.phase9_automatic_provider_runs,marketplace_sec.phase9_metadata_admissions FROM PUBLIC,anon,authenticated,service_role;

-- 02c §4.3: initialize outside the claim path, where conflicting INSERTs would
-- wait before SKIP LOCKED. A store and its admission row become visible together.
INSERT INTO marketplace_sec.phase9_store_admission(store_id) SELECT id FROM public.stores;
CREATE FUNCTION marketplace_sec.phase9_seed_store_admission_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO marketplace_sec.phase9_store_admission(store_id) VALUES(NEW.id);
 RETURN NULL;
END$$;
CREATE TRIGGER phase9_seed_store_admission_v1 AFTER INSERT ON public.stores
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_seed_store_admission_v1();
CREATE FUNCTION marketplace_sec.phase9_release_closed_admission_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE released_store uuid;
BEGIN
 IF TG_WHEN='BEFORE' THEN
  IF auth.role()='service_role' AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
   WHERE a.job_id=OLD.id AND a.claim_attempt_number=OLD.attempt_count
    AND a.claim_worker IS NOT DISTINCT FROM OLD.lease_owner
    AND a.claim_lease_token_hash IS NOT DISTINCT FROM OLD.lease_token_hash) THEN
   IF OLD.lease_expires_at IS NULL OR OLD.lease_expires_at<=clock_timestamp()
    OR NOT EXISTS(SELECT 1 FROM public.image_extraction_candidates c
     JOIN public.image_extraction_sessions s ON s.id=c.session_id AND s.store_id=c.store_id
     WHERE c.id=OLD.entity_id AND c.store_id=OLD.store_id AND c.expires_at>clock_timestamp()
      AND s.expires_at>clock_timestamp() AND marketplace_sec.phase9_owner_ux_session_mutable(s))
   THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=NEW.id RETURNING store_id INTO released_store;
 IF released_store IS NOT NULL THEN PERFORM marketplace_sec.phase9_wake_store_admission_v1(released_store); END IF;
 RETURN NULL;
END$$;
CREATE TRIGGER phase9_guard_terminal_admission_v1 BEFORE UPDATE ON public.image_extraction_jobs
 FOR EACH ROW WHEN (OLD.status='in_progress' AND NEW.status IN ('resolved','dead_letter'))
 EXECUTE FUNCTION marketplace_sec.phase9_release_closed_admission_v1();
CREATE TRIGGER phase9_release_closed_admission_v1 AFTER UPDATE ON public.image_extraction_jobs
 FOR EACH ROW WHEN (OLD.status='in_progress' AND (NEW.status<>'in_progress'
  OR NEW.lease_token_hash IS DISTINCT FROM OLD.lease_token_hash))
 EXECUTE FUNCTION marketplace_sec.phase9_release_closed_admission_v1();
CREATE FUNCTION marketplace_sec.phase9_run_fence_digest_v1(f jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT encode(extensions.digest(((f-'leaseToken')||jsonb_build_object('leaseTokenHash',
  encode(extensions.digest(f->>'leaseToken','sha256'),'hex')))::text,'sha256'),'hex')
$$;

-- Re-read wall-clock scope after the final blocking lock, without taking a
-- later lock out of order. The caller already owns session/job/candidate locks.
CREATE FUNCTION marketplace_sec.phase9_admission_scope_current_v1(f jsonb,p_hash text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.image_extraction_jobs j
 JOIN public.image_extraction_candidates c ON c.id=j.entity_id AND c.store_id=j.store_id
 JOIN public.image_extraction_sessions s ON s.id=c.session_id AND s.store_id=c.store_id
 LEFT JOIN public.phase9_candidate_edition_state e ON e.candidate_id=c.id
 WHERE j.id=(f->>'jobId')::uuid AND j.job_kind='metadata_enrich' AND j.entity_type='candidate'
  AND j.status='in_progress' AND j.lease_expires_at>clock_timestamp()
  AND j.lease_owner=f->>'worker' AND j.lease_token_hash=p_hash AND j.attempt_count=(f->>'claimAttempt')::integer
  AND c.id=(f->>'candidateId')::uuid AND c.store_id=(f->>'storeId')::uuid AND c.session_id=(f->>'sessionId')::uuid
  AND marketplace_sec.phase9_owner_ux_session_mutable(s) AND s.expires_at>clock_timestamp() AND c.expires_at>clock_timestamp()
  AND (NOT f ? 'candidateVersion' OR c.version=(f->>'candidateVersion')::integer)
  AND coalesce(e.request_generation,0)=(f->>'requestGeneration')::integer
  AND e.request_id IS NOT DISTINCT FROM coalesce(f->>'requestId',f->>'capturedRequestId')::uuid
  AND (j.operation_version IS NOT DISTINCT FROM 'p9-owner-edition-options-v1')=(f ? 'requestId')
  AND CASE WHEN f ? 'requestId' THEN marketplace_sec.phase9_edition_query_identity(c)
   ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END=f->>'queryIdentity')
$$;

-- 02c §4.3: session-first shared fence helper; supplied tenant is comparison only.
CREATE FUNCTION marketplace_sec.phase9_admission_fence_v1(f jsonb,p_explicit boolean DEFAULT false)
RETURNS public.image_extraction_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR f IS NULL OR p_explicit IS NULL
 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 IF p_explicit THEN
  IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR NOT f ?& ARRAY['jobId','worker','leaseToken','claimAttempt',
   'candidateId','storeId','sessionId','requestId','requestGeneration','queryIdentity']
   OR f-ARRAY['jobId','worker','leaseToken','claimAttempt','candidateId','storeId','sessionId',
    'requestId','requestGeneration','queryIdentity']<>'{}'::jsonb
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  -- Reuse AutoFence's strict UUID/integer/string validation before any cast.
  IF NOT marketplace_sec.phase9_auto_fence_valid_v1((f-'requestId')||
   jsonb_build_object('candidateVersion',1,'capturedRequestId',f->'requestId'))
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  PERFORM 1 FROM public.image_extraction_sessions WHERE id=(f->>'sessionId')::uuid FOR KEY SHARE;
  c:=marketplace_sec.phase9_edition_assert_fence((f->>'jobId')::uuid,f->>'worker',f->>'leaseToken',
   (f->>'claimAttempt')::integer,(f->>'candidateId')::uuid,(f->>'storeId')::uuid,
   (f->>'sessionId')::uuid,(f->>'requestId')::uuid,(f->>'requestGeneration')::integer,f->>'queryIdentity');
  IF c.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 ELSE
  IF NOT coalesce(marketplace_sec.phase9_auto_fence_valid_v1(f),false)
  THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
  result:=marketplace_sec.phase9_recover_automatic_metadata_v1(f);
  IF result->>'status' IS DISTINCT FROM 'missing' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  c:=marketplace_sec.phase9_assert_structural_metadata_candidate((f->>'jobId')::uuid,f->>'worker',f->>'leaseToken',
   (f->>'claimAttempt')::integer,(f->>'candidateId')::uuid,(f->>'candidateVersion')::integer);
 END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid FOR UPDATE;
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,encode(extensions.digest(f->>'leaseToken','sha256'),'hex'))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN j;
END$$;

-- Owner OD-2026-11-01-1 / 02c §4.3: hold a whole bounded round under the
-- store mutex. A hold is NOT a call. Expired/replaced/closed claims contribute
-- no ungranted slots; physical grants stay in gets_used across claim release.
CREATE FUNCTION marketplace_sec.phase9_reserved_store_holds_v1(p_store uuid)
RETURNS TABLE(slots smallint,lease_expires_at timestamptz,session_expires_at timestamptz,
 candidate_expires_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.slots_remaining,j.lease_expires_at,s.expires_at,c.expires_at
 FROM marketplace_sec.phase9_metadata_admissions a
 JOIN public.image_extraction_jobs j ON j.id=a.job_id
 JOIN public.image_extraction_candidates c ON c.id=j.entity_id AND c.store_id=j.store_id
 JOIN public.image_extraction_sessions s ON s.id=c.session_id AND s.store_id=c.store_id
 LEFT JOIN public.phase9_candidate_edition_state e ON e.candidate_id=c.id
 WHERE a.store_id=p_store AND j.status='in_progress' AND j.lease_expires_at>clock_timestamp()
  AND j.attempt_count=a.claim_attempt_number AND j.lease_owner=a.claim_worker
  AND j.lease_token_hash=a.claim_lease_token_hash AND marketplace_sec.phase9_owner_ux_session_mutable(s)
  AND s.expires_at>clock_timestamp()
  AND c.expires_at>clock_timestamp()
  AND (NOT a.fence ? 'candidateVersion' OR c.version=(a.fence->>'candidateVersion')::integer)
  AND coalesce(e.request_generation,0)=(a.fence->>'requestGeneration')::integer
  AND e.request_id IS NOT DISTINCT FROM
   coalesce(a.fence->>'requestId',a.fence->>'capturedRequestId')::uuid
$$;
CREATE FUNCTION marketplace_sec.phase9_reserved_store_slots_v1(p_store uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(sum(h.slots),0) FROM marketplace_sec.phase9_reserved_store_holds_v1(p_store) h
$$;
-- One store counter implies one consistent store window/cap across configured
-- active v2 routes. Provider-specific pacing/breaker settings may still differ.
CREATE FUNCTION marketplace_sec.phase9_capacity_configuration_valid_v1(p_policy jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
 WHERE r.enabled AND r.matching_allowed AND r.storage_allowed
  AND ((r.automatic_lookup_allowed AND r.automatic_role IS NOT NULL)
   OR (r.explicit_search_allowed AND r.explicit_role IS NOT NULL)) AND r.protection_policy IS NOT NULL
  AND (r.protection_policy->'storeWindowSeconds' IS DISTINCT FROM p_policy->'storeWindowSeconds'
   OR r.protection_policy->'storeMaxGets' IS DISTINCT FROM p_policy->'storeMaxGets'))
$$;
CREATE FUNCTION marketplace_sec.phase9_wake_store_admission_v1(p_store uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cap marketplace_sec.phase9_store_admission; policy jsonb; stamp timestamptz; due timestamptz;
 minimum_budget integer; held_until timestamptz; reserved bigint;
BEGIN
 -- Terminal callers may already hold canonical advisory locks. Never wait on
 -- the store here: a busy store keeps its existing durable recheck time.
 SELECT * INTO cap FROM marketplace_sec.phase9_store_admission WHERE store_id=p_store FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 stamp:=clock_timestamp();
 SELECT protection_policy INTO policy FROM public.phase9_provider_registry r WHERE r.enabled
  AND r.matching_allowed AND r.storage_allowed AND ((r.automatic_lookup_allowed AND r.automatic_role IS NOT NULL)
   OR (r.explicit_search_allowed AND r.explicit_role IS NOT NULL))
  AND protection_policy IS NOT NULL ORDER BY adapter_key LIMIT 1;
 IF policy IS NULL THEN RETURN; END IF;
 IF NOT marketplace_sec.phase9_capacity_configuration_valid_v1(policy) THEN RETURN; END IF;
 cap.window_seconds:=coalesce(cap.window_seconds,(policy->>'storeWindowSeconds')::numeric::integer);
 due:=cap.window_started_at+make_interval(secs=>cap.window_seconds);
 reserved:=marketplace_sec.phase9_reserved_store_slots_v1(p_store);
 IF due<=stamp OR (cap.gets_used=0 AND reserved=0 AND cap.window_seconds<>(policy->>'storeWindowSeconds')::numeric::integer) THEN
  cap.window_started_at:=stamp;cap.gets_used:=0;
  cap.window_seconds:=(policy->>'storeWindowSeconds')::numeric::integer;
  due:=stamp+make_interval(secs=>cap.window_seconds);
 END IF;
 SELECT coalesce(min(CASE WHEN marketplace_sec.phase9_provider_stage_valid_v1(r.adapter_key,r.adapter_version,NULL,NULL,'isbn')
  THEN 1 ELSE 6 END),1) INTO minimum_budget FROM public.phase9_provider_registry r
  WHERE r.enabled AND r.matching_allowed AND r.storage_allowed AND ((r.automatic_lookup_allowed AND r.automatic_role IS NOT NULL)
   OR (r.explicit_search_allowed AND r.explicit_role IS NOT NULL))
   AND r.protection_policy IS NOT NULL;
 IF cap.gets_used+reserved+minimum_budget<=(policy->>'storeMaxGets')::numeric::integer
 THEN due:='-infinity';
 ELSIF cap.gets_used<(policy->>'storeMaxGets')::numeric::integer THEN
  SELECT min(least(h.lease_expires_at,h.session_expires_at,h.candidate_expires_at))
   INTO held_until FROM marketplace_sec.phase9_reserved_store_holds_v1(p_store) h WHERE h.slots>0;
  due:=least(due,coalesce(held_until,due));
 END IF;
 UPDATE marketplace_sec.phase9_store_admission SET window_started_at=cap.window_started_at,gets_used=cap.gets_used,
  window_seconds=cap.window_seconds,next_due_at=due WHERE store_id=p_store;
END$$;
CREATE FUNCTION marketplace_sec.phase9_reserve_round_capacity_v1(
 f jsonb,p_key text,p_version text,p_allow_children boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r public.phase9_provider_registry;
 cap marketplace_sec.phase9_store_admission; hold marketplace_sec.phase9_metadata_admissions;
 budget integer; reserved bigint; due timestamptz; held_until timestamptz; stamp timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid;
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_key FOR SHARE;
 IF r.protection_policy IS NULL OR NOT marketplace_sec.phase9_capacity_configuration_valid_v1(r.protection_policy)
 THEN RETURN jsonb_build_object('status','configuration_required'); END IF;
 IF r.protection_policy->>'mode' IS DISTINCT FROM 'single_instance'
 THEN RAISE EXCEPTION 'P9_PROVIDER_CONFIGURATION_INVALID'; END IF;
 budget:=CASE WHEN marketplace_sec.phase9_provider_stage_valid_v1(p_key,p_version,NULL,NULL,'isbn') THEN 1
  WHEN marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version) IS NOT NULL THEN 6 ELSE NULL END;
 IF budget IS NULL OR budget>(r.protection_policy->>'storeMaxGets')::numeric::integer
 THEN RETURN jsonb_build_object('status','configuration_required'); END IF;
 -- Only a usable configuration mints the current claim as v2; a refused
 -- configuration must leave a legacy claim's stale/no marker untouched.
 INSERT INTO marketplace_sec.phase9_metadata_admissions(job_id,claim_attempt_number,claim_worker,claim_lease_token_hash)
 VALUES(j.id,j.attempt_count,f->>'worker',j.lease_token_hash)
 ON CONFLICT(job_id) DO UPDATE SET claim_attempt_number=excluded.claim_attempt_number,
  claim_worker=excluded.claim_worker,claim_lease_token_hash=excluded.claim_lease_token_hash,
  slots_remaining=CASE WHEN marketplace_sec.phase9_metadata_admissions.claim_lease_token_hash=excluded.claim_lease_token_hash
   THEN marketplace_sec.phase9_metadata_admissions.slots_remaining ELSE 0 END;
 SELECT * INTO cap FROM marketplace_sec.phase9_store_admission WHERE store_id=j.store_id FOR UPDATE;
 SELECT * INTO hold FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=j.id FOR UPDATE;
 stamp:=clock_timestamp();
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,j.lease_token_hash) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF hold.slots_remaining>0 AND hold.adapter_key=p_key AND hold.adapter_version=p_version
  AND hold.fence=f-'leaseToken' AND hold.policy=r.protection_policy
 THEN RETURN jsonb_build_object('status','reserved','slots',hold.slots_remaining); END IF;
 IF hold.slots_remaining>0 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 cap.window_seconds:=coalesce(cap.window_seconds,(r.protection_policy->>'storeWindowSeconds')::numeric::integer);
 due:=cap.window_started_at+make_interval(secs=>cap.window_seconds);
 reserved:=marketplace_sec.phase9_reserved_store_slots_v1(j.store_id);
 IF due<=stamp OR (cap.gets_used=0 AND reserved=0 AND cap.window_seconds<>(r.protection_policy->>'storeWindowSeconds')::numeric::integer) THEN
  UPDATE marketplace_sec.phase9_store_admission SET window_started_at=stamp,gets_used=0,next_due_at='-infinity',
   window_seconds=(r.protection_policy->>'storeWindowSeconds')::numeric::integer
   WHERE store_id=j.store_id RETURNING * INTO cap;
  due:=stamp+make_interval(secs=>(r.protection_policy->>'storeWindowSeconds')::numeric::integer);
 END IF;
 IF cap.window_seconds<>(r.protection_policy->>'storeWindowSeconds')::numeric::integer
  OR cap.gets_used+reserved+budget>(r.protection_policy->>'storeMaxGets')::numeric::integer THEN
  IF NOT p_allow_children AND (EXISTS(SELECT 1 FROM public.phase9_metadata_lookups WHERE job_id=j.id)
   OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations WHERE job_id=j.id)
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id))
  THEN RETURN jsonb_build_object('status','drain_required'); END IF;
  SELECT min(least(h.lease_expires_at,h.session_expires_at,h.candidate_expires_at))
   INTO held_until FROM marketplace_sec.phase9_reserved_store_holds_v1(j.store_id) h WHERE h.slots>0;
  due:=least(due,coalesce(held_until,due));
  UPDATE marketplace_sec.phase9_store_admission SET next_due_at=due WHERE store_id=j.store_id;
  UPDATE public.image_extraction_jobs SET status='retry_scheduled',attempt_count=attempt_count-1,
   next_attempt_at=due,lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,updated_at=stamp WHERE id=j.id;
  RETURN jsonb_build_object('status','capacity_wait','dueAt',due);
 END IF;
 UPDATE marketplace_sec.phase9_metadata_admissions SET store_id=j.store_id,adapter_key=p_key,adapter_version=p_version,
  fence=f-'leaseToken',policy=r.protection_policy,slots_remaining=budget WHERE job_id=j.id;
 UPDATE marketplace_sec.phase9_store_admission SET window_seconds=cap.window_seconds WHERE store_id=j.store_id;
 RETURN jsonb_build_object('status','reserved','slots',budget);
END$$;

-- 02c §§4.3/4.4: new entry only; legacy claim tuple/signature unchanged.
CREATE FUNCTION marketplace_sec.phase9_claim_metadata_jobs_v2(p_batch_size integer,p_worker text)
RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE admission marketplace_sec.phase9_store_admission; job public.image_extraction_jobs;
 gate marketplace_sec.phase9_external_admission_gate; issued integer:=0; stamp timestamptz; new_token text;
 blocked_stores uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 10
  OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT * INTO gate FROM marketplace_sec.phase9_external_admission_gate WHERE singleton;
 LOOP
  stamp:=clock_timestamp();
  SELECT s.* INTO admission FROM marketplace_sec.phase9_store_admission s
  WHERE s.next_due_at<=stamp AND NOT s.store_id=ANY(blocked_stores) AND EXISTS(SELECT 1 FROM public.image_extraction_jobs j
   WHERE j.store_id=s.store_id AND j.job_kind='metadata_enrich' AND j.entity_type='candidate'
    AND j.status IN ('open','retry_scheduled','in_progress') AND j.next_attempt_at<=stamp
    AND (j.status<>'in_progress' OR j.lease_expires_at<=stamp) AND j.attempt_count<j.max_attempts
    AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_job_admission_wait w
     WHERE w.job_id=j.id AND w.blocked_epoch=gate.epoch))
  ORDER BY s.last_ticket,s.store_id FOR UPDATE OF s SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN EXIT; END IF;
  SELECT j.* INTO job FROM public.image_extraction_jobs j WHERE j.id=(SELECT head.id
   FROM public.image_extraction_jobs head WHERE head.store_id=admission.store_id
   AND head.job_kind='metadata_enrich' AND head.entity_type='candidate'
   AND head.status IN ('open','retry_scheduled','in_progress') AND head.next_attempt_at<=stamp
   AND (head.status<>'in_progress' OR head.lease_expires_at<=stamp) AND head.attempt_count<head.max_attempts
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_job_admission_wait w
    WHERE w.job_id=head.id AND w.blocked_epoch=gate.epoch)
   ORDER BY head.next_attempt_at,head.id LIMIT 1)
   AND j.store_id=admission.store_id
   AND j.job_kind='metadata_enrich' AND j.entity_type='candidate'
   AND j.status IN ('open','retry_scheduled','in_progress') AND j.next_attempt_at<=stamp
   AND (j.status<>'in_progress' OR j.lease_expires_at<=stamp) AND j.attempt_count<j.max_attempts
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_job_admission_wait w
    WHERE w.job_id=j.id AND w.blocked_epoch=gate.epoch)
   ORDER BY j.next_attempt_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1;
  -- A locked store head is not a service turn. Exclude it for this statement.
  IF NOT FOUND THEN
   -- Do not spin on an admission row whose only jobs are locked.
   blocked_stores:=array_append(blocked_stores,admission.store_id);CONTINUE;
  END IF;
  UPDATE marketplace_sec.phase9_store_admission SET last_ticket=nextval('marketplace_sec.phase9_admission_ticket')
   WHERE store_id=admission.store_id;
  new_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  UPDATE public.image_extraction_jobs j SET status='in_progress',lease_owner=p_worker,
   lease_token_hash=encode(extensions.digest(new_token,'sha256'),'hex'),
   lease_expires_at=stamp+interval '5 minutes',attempt_count=j.attempt_count+1,updated_at=stamp
   WHERE j.id=job.id RETURNING j.* INTO job;
  INSERT INTO marketplace_sec.phase9_metadata_admissions(job_id,claim_attempt_number,claim_worker,claim_lease_token_hash)
   VALUES(job.id,job.attempt_count,p_worker,job.lease_token_hash)
   ON CONFLICT(job_id) DO UPDATE SET claim_attempt_number=excluded.claim_attempt_number,
    claim_worker=excluded.claim_worker,claim_lease_token_hash=excluded.claim_lease_token_hash,
    slots_remaining=0,adapter_key=NULL,adapter_version=NULL,fence=NULL,policy=NULL;
  DELETE FROM marketplace_sec.phase9_job_admission_wait w WHERE w.job_id=job.id;
  id:=job.id;attempt_count:=job.attempt_count;lease_token:=new_token;RETURN NEXT;
  issued:=issued+1; IF issued>=p_batch_size THEN EXIT; END IF;
 END LOOP;
END$$;

-- 02c-1 §2: only zero-obligation work may release a paused claim neutrally.
CREATE FUNCTION marketplace_sec.phase9_defer_metadata_admission_v1(f jsonb,p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; gate marketplace_sec.phase9_external_admission_gate;
BEGIN
 j:=marketplace_sec.phase9_admission_fence_v1(f,f ? 'requestId');
 SELECT * INTO gate FROM marketplace_sec.phase9_external_admission_gate WHERE singleton FOR SHARE;
 IF p_epoch IS NULL OR p_epoch<0 OR p_epoch IS DISTINCT FROM gate.epoch OR gate.mode='open'
  OR (gate.mode='smoke' AND j.id=ANY(gate.smoke_job_ids) AND gate.expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.job_id=j.id)
  OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id)
  OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id)
   OR EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id
    AND (r.round<>0 OR r.status NOT IN ('running','queued') OR r.retry_allowed OR r.no_egress_recheck
     OR r.lookup_id IS NOT NULL OR r.primary_attempt_id IS NOT NULL
     OR CASE WHEN r.round=0 AND r.status='queued' AND NOT r.retry_allowed AND NOT r.no_egress_recheck
      AND r.lookup_id IS NULL AND r.primary_attempt_id IS NULL
      THEN (r.query_identity_hash IS DISTINCT FROM encode(extensions.digest(f->>'queryIdentity','sha256'),'hex')
       OR r.candidate_version IS DISTINCT FROM (f->>'candidateVersion')::integer
       OR r.captured_request_id IS DISTINCT FROM (f->>'capturedRequestId')::uuid
       OR r.request_generation IS DISTINCT FROM (f->>'requestGeneration')::integer)
      ELSE r.fence_digest IS DISTINCT FROM marketplace_sec.phase9_run_fence_digest_v1(f) END))
 THEN RETURN jsonb_build_object('status','drain_required'); END IF;
 PERFORM 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=j.store_id FOR UPDATE;
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,j.lease_token_hash) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='queued' WHERE job_id=j.id;
 UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
 INSERT INTO marketplace_sec.phase9_job_admission_wait(job_id,blocked_epoch) VALUES(j.id,gate.epoch)
 ON CONFLICT(job_id) DO UPDATE SET blocked_epoch=excluded.blocked_epoch,recorded_at=clock_timestamp();
 UPDATE public.image_extraction_jobs SET status='retry_scheduled',attempt_count=attempt_count-1,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
 RETURN jsonb_build_object('status','deferred','blockedEpoch',gate.epoch);
END$$;

-- 02c §4.3: begin is not an HTTP permit. Registration is still the grant boundary.
CREATE FUNCTION marketplace_sec.phase9_begin_automatic_provider_run_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; prior marketplace_sec.phase9_automatic_provider_runs;
 registry public.phase9_provider_registry; query_hash text; token_hash text; next_round smallint:=0;
 capacity jsonb; resume_queued boolean:=false;
BEGIN
 j:=marketplace_sec.phase9_admission_fence_v1(f);
 PERFORM marketplace_sec.phase9_external_grant_epoch_v1(j.id);
 PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=p_key FOR SHARE;
 IF registry.adapter_key IS NULL OR NOT registry.enabled OR NOT registry.matching_allowed
  OR NOT registry.storage_allowed OR NOT registry.automatic_lookup_allowed
  OR p_key IS NULL OR p_version IS NULL OR registry.adapter_version IS DISTINCT FROM p_version
  OR registry.automatic_role IS DISTINCT FROM 'primary'
  OR NOT coalesce(p_version=ANY(registry.accepted_adapter_versions),false)
  OR NOT marketplace_sec.phase9_provider_automatic_supported_v1(p_key,p_version)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF registry.protection_policy IS NULL THEN RETURN jsonb_build_object('status','configuration_required'); END IF;
  IF registry.protection_policy->>'mode' IS DISTINCT FROM 'single_instance'
  THEN RAISE EXCEPTION 'P9_PROVIDER_CONFIGURATION_INVALID'; END IF;
 query_hash:=encode(extensions.digest(f->>'queryIdentity','sha256'),'hex');
 token_hash:=encode(extensions.digest(f->>'leaseToken','sha256'),'hex');
 SELECT * INTO prior FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id
  ORDER BY r.round DESC LIMIT 1 FOR UPDATE;
 IF prior.job_id IS NOT NULL THEN
  IF prior.query_identity_hash IS DISTINCT FROM query_hash OR prior.adapter_key IS DISTINCT FROM p_key
   OR prior.adapter_version IS DISTINCT FROM p_version
   OR prior.candidate_version IS DISTINCT FROM (f->>'candidateVersion')::integer
   OR prior.captured_request_id IS DISTINCT FROM (f->>'capturedRequestId')::uuid
   OR prior.request_generation IS DISTINCT FROM (f->>'requestGeneration')::integer
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF prior.claim_attempt_number=j.attempt_count AND prior.claim_worker=f->>'worker'
   AND prior.claim_lease_token_hash=token_hash
  THEN
   IF prior.fence_digest IS DISTINCT FROM marketplace_sec.phase9_run_fence_digest_v1(f)
   THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
   RETURN jsonb_build_object('status','replayed','round',prior.round,'runStatus',prior.status);
  END IF;
  IF prior.round=0 AND prior.status='queued' AND NOT prior.retry_allowed AND prior.lookup_id IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups WHERE job_id=j.id)
   AND NOT EXISTS(SELECT 1 FROM public.phase9_usage_reservations WHERE job_id=j.id)
   AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id)
  THEN resume_queued:=true;
  ELSIF prior.round<>0 OR NOT prior.retry_allowed OR prior.status<>'finalized'
   OR prior.claim_attempt_number>=j.attempt_count OR prior.claim_lease_token_hash=token_hash
   OR prior.due_at>clock_timestamp()
  THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
  IF NOT resume_queued THEN next_round:=1; END IF;
 ELSIF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id) THEN
  RETURN jsonb_build_object('status','recovery_only');
 END IF;
 capacity:=marketplace_sec.phase9_reserve_round_capacity_v1(f,p_key,p_version,next_round=1);
 IF capacity->>'status'<>'reserved' THEN RETURN capacity; END IF;
 IF resume_queued THEN
  UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='running',claim_attempt_number=j.attempt_count,
   claim_worker=f->>'worker',claim_lease_token_hash=token_hash,fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f)
   WHERE job_id=j.id AND query_identity_hash=query_hash AND adapter_key=p_key AND adapter_version=p_version AND round=0;
  RETURN jsonb_build_object('status','started','round',0);
 END IF;
 INSERT INTO marketplace_sec.phase9_automatic_provider_runs(job_id,query_identity_hash,adapter_key,adapter_version,
  round,lookup_id,primary_attempt_id,claim_attempt_number,claim_worker,claim_lease_token_hash,
  candidate_version,captured_request_id,request_generation,fence_digest,status)
 VALUES(j.id,query_hash,p_key,p_version,next_round,prior.lookup_id,prior.primary_attempt_id,j.attempt_count,
  f->>'worker',token_hash,(f->>'candidateVersion')::integer,(f->>'capturedRequestId')::uuid,
  (f->>'requestGeneration')::integer,marketplace_sec.phase9_run_fence_digest_v1(f),'running');
 RETURN jsonb_build_object('status','started','round',next_round);
END$$;

-- Explicit new-worker work opts into the identical store accounting. The
-- caller first reserves, then creates provider lineage; legacy RPCs stay callable.
CREATE FUNCTION marketplace_sec.phase9_reserve_metadata_provider_round_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r public.phase9_provider_registry;
BEGIN
 j:=marketplace_sec.phase9_admission_fence_v1(f,true);
 PERFORM marketplace_sec.phase9_external_grant_epoch_v1(j.id);
 PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_key;
 IF r.adapter_key IS NULL OR NOT r.enabled OR NOT r.matching_allowed OR NOT r.storage_allowed
  OR NOT r.explicit_search_allowed OR NOT coalesce(r.explicit_role IN ('primary','secondary'),false)
  OR r.adapter_version IS DISTINCT FROM p_version
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id AND status<>'finalized')
 THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 RETURN marketplace_sec.phase9_reserve_round_capacity_v1(f,p_key,p_version,false);
END$$;
CREATE FUNCTION marketplace_sec.phase9_release_metadata_provider_round_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; a marketplace_sec.phase9_metadata_admissions;
BEGIN
 j:=marketplace_sec.phase9_admission_fence_v1(f,true);
 SELECT * INTO a FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=j.id FOR UPDATE;
 IF a.claim_lease_token_hash IS DISTINCT FROM j.lease_token_hash OR a.claim_attempt_number<>j.attempt_count
  OR a.claim_worker IS DISTINCT FROM f->>'worker' OR a.fence IS DISTINCT FROM f-'leaseToken'
  OR a.adapter_key IS DISTINCT FROM p_key OR a.adapter_version IS DISTINCT FROM p_version
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id
  AND claim_attempt_number=j.attempt_count AND status<>'finalized')
 THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 IF a.slots_remaining=0 THEN RETURN jsonb_build_object('status','released'); END IF;
 PERFORM 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=j.store_id FOR UPDATE;
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,j.lease_token_hash) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
 PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
 RETURN jsonb_build_object('status','released');
END$$;

-- 02c §4.3: new INSERTs only. A replay never spends a second capacity unit.
CREATE FUNCTION marketplace_sec.phase9_provider_run_grant_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.metadata_enrichment_attempts; l public.phase9_metadata_lookups;
 run marketplace_sec.phase9_automatic_provider_runs; cap marketplace_sec.phase9_store_admission;
 policy jsonb; stamp timestamptz:=clock_timestamp(); h marketplace_sec.phase9_metadata_admissions;
 hold_current boolean; run_current boolean:=false;
BEGIN
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=NEW.logical_attempt_id;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
 IF EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=NEW.job_id
  AND r.claim_attempt_number=NEW.claim_attempt_number
  AND r.claim_worker IS NOT DISTINCT FROM NEW.claim_worker
  AND r.claim_lease_token_hash IS NOT DISTINCT FROM NEW.claim_lease_token_hash) THEN
  SELECT * INTO run FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=NEW.job_id
   AND r.claim_attempt_number=NEW.claim_attempt_number
   AND r.claim_worker IS NOT DISTINCT FROM NEW.claim_worker
   AND r.claim_lease_token_hash IS NOT DISTINCT FROM NEW.claim_lease_token_hash
   ORDER BY r.round DESC LIMIT 1 FOR UPDATE;
  IF run.status<>'running' OR run.adapter_key IS DISTINCT FROM a.adapter_key
   OR run.adapter_version IS DISTINCT FROM a.adapter_version OR a.provider_role IS DISTINCT FROM 'primary'
   OR run.query_identity_hash IS DISTINCT FROM encode(extensions.digest(l.query_identity,'sha256'),'hex')
   OR run.claim_attempt_number<>NEW.claim_attempt_number OR run.claim_worker IS DISTINCT FROM NEW.claim_worker
   OR run.claim_lease_token_hash IS DISTINCT FROM NEW.claim_lease_token_hash
   OR (run.primary_attempt_id IS NOT NULL AND (run.primary_attempt_id IS DISTINCT FROM a.id OR run.lookup_id IS DISTINCT FROM l.id))
  THEN RAISE EXCEPTION 'P9_PROVIDER_RUN_NOT_ADMITTED'; END IF;
  run_current:=true;
  UPDATE marketplace_sec.phase9_automatic_provider_runs SET lookup_id=l.id,primary_attempt_id=a.id
   WHERE job_id=run.job_id AND query_identity_hash=run.query_identity_hash AND adapter_key=run.adapter_key
    AND adapter_version=run.adapter_version AND round=run.round;
 END IF;
 SELECT protection_policy INTO policy FROM public.phase9_provider_registry WHERE adapter_key=a.adapter_key FOR SHARE;
 IF policy IS NOT NULL THEN
  IF policy->>'mode' IS DISTINCT FROM 'single_instance'
   OR NOT marketplace_sec.phase9_capacity_configuration_valid_v1(policy)
  THEN RAISE EXCEPTION 'P9_PROVIDER_CONFIGURATION_INVALID'; END IF;
  SELECT * INTO cap FROM marketplace_sec.phase9_store_admission WHERE store_id=NEW.store_id FOR UPDATE;
  SELECT * INTO h FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=NEW.job_id FOR UPDATE;
  hold_current:=h.job_id IS NOT NULL AND h.claim_attempt_number=NEW.claim_attempt_number
   AND h.claim_worker IS NOT DISTINCT FROM NEW.claim_worker
   AND h.claim_lease_token_hash IS NOT DISTINCT FROM NEW.claim_lease_token_hash;
  stamp:=clock_timestamp();
  IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs j
   JOIN public.image_extraction_candidates c ON c.id=j.entity_id AND c.store_id=j.store_id
   JOIN public.image_extraction_sessions s ON s.id=c.session_id AND s.store_id=c.store_id
   WHERE j.id=NEW.job_id AND j.status='in_progress' AND j.lease_expires_at>stamp
    AND j.attempt_count=NEW.claim_attempt_number AND j.lease_owner=NEW.claim_worker
    AND j.lease_token_hash=NEW.claim_lease_token_hash AND c.expires_at>stamp
    AND marketplace_sec.phase9_owner_ux_session_mutable(s) AND s.expires_at>stamp)
   OR (hold_current AND NOT marketplace_sec.phase9_admission_scope_current_v1(h.fence,NEW.claim_lease_token_hash))
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF hold_current AND (h.slots_remaining<1 OR h.adapter_key IS DISTINCT FROM a.adapter_key
   OR h.adapter_version IS DISTINCT FROM a.adapter_version OR h.policy IS DISTINCT FROM policy
   OR h.claim_attempt_number<>NEW.claim_attempt_number OR h.claim_worker IS DISTINCT FROM NEW.claim_worker
   OR h.claim_lease_token_hash IS DISTINCT FROM NEW.claim_lease_token_hash)
  THEN RAISE EXCEPTION 'P9_PROVIDER_RUN_NOT_ADMITTED'; END IF;
  IF NOT hold_current AND NOT run_current
  THEN RAISE EXCEPTION 'P9_PROVIDER_RUN_NOT_ADMITTED'; END IF;
  cap.window_seconds:=coalesce(cap.window_seconds,(policy->>'storeWindowSeconds')::numeric::integer);
  IF cap.window_started_at+make_interval(secs=>cap.window_seconds)<=stamp THEN
   cap.window_started_at:=stamp;cap.gets_used:=0;cap.window_seconds:=(policy->>'storeWindowSeconds')::numeric::integer;
  END IF;
  IF cap.window_seconds<>(policy->>'storeWindowSeconds')::numeric::integer THEN RAISE EXCEPTION 'P9_PROVIDER_CONFIGURATION_INVALID'; END IF;
  IF NOT hold_current AND cap.gets_used+marketplace_sec.phase9_reserved_store_slots_v1(NEW.store_id)
   >=(policy->>'storeMaxGets')::numeric::integer THEN RAISE EXCEPTION 'P9_PROVIDER_CAPACITY_WAIT'; END IF;
  IF hold_current THEN
   UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=slots_remaining-1 WHERE job_id=NEW.job_id;
  END IF;
  UPDATE marketplace_sec.phase9_store_admission SET window_started_at=cap.window_started_at,
   window_seconds=cap.window_seconds,gets_used=cap.gets_used+1,next_due_at=CASE WHEN cap.gets_used+1>=(policy->>'storeMaxGets')::numeric::integer
    THEN cap.window_started_at+make_interval(secs=>(policy->>'storeWindowSeconds')::numeric::integer)
    ELSE '-infinity'::timestamptz END WHERE store_id=NEW.store_id;
  PERFORM marketplace_sec.phase9_wake_store_admission_v1(NEW.store_id);
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER phase9_provider_run_grant_v1 BEFORE INSERT ON public.phase9_metadata_provider_calls
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_provider_run_grant_v1();

-- Timestamp rendering must not make a receipt depend on a worker's TimeZone.
CREATE FUNCTION marketplace_sec.phase9_run_receipt_digest_v1(p_job uuid,p_attempt uuid,p_claim integer)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' SET TimeZone='UTC' AS $$
 SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.created_at,c.id),'[]'::jsonb)::text,
  'sha256'),'hex') FROM public.phase9_metadata_provider_calls c
 WHERE c.job_id=p_job AND c.logical_attempt_id=p_attempt AND c.claim_attempt_number=p_claim
$$;

-- 02c §4.3: finalized persisted receipts, never caller assertions, grant retry.
CREATE FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(f jsonb,p_key text,p_version text,p_not_before timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; run marketplace_sec.phase9_automatic_provider_runs;
 calls jsonb; final_call public.phase9_metadata_provider_calls; registry public.phase9_provider_registry;
 policy jsonb; safe boolean; due timestamptz;
BEGIN
 -- Receipt-first recovery after a scheduled retry has released the old lease.
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT coalesce(marketplace_sec.phase9_auto_fence_valid_v1(f),false)
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 IF p_not_before IS NOT NULL AND NOT isfinite(p_not_before) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT r.* INTO run FROM marketplace_sec.phase9_automatic_provider_runs r
  JOIN public.image_extraction_jobs old_job ON old_job.id=r.job_id
  JOIN public.image_extraction_candidates c ON c.id=old_job.entity_id AND c.store_id=old_job.store_id
  WHERE r.job_id=(f->>'jobId')::uuid AND r.adapter_key=p_key AND r.adapter_version=p_version
   AND r.query_identity_hash=encode(extensions.digest(f->>'queryIdentity','sha256'),'hex')
   AND r.claim_attempt_number=(f->>'claimAttempt')::integer AND r.claim_worker=f->>'worker'
   AND r.claim_lease_token_hash=encode(extensions.digest(f->>'leaseToken','sha256'),'hex')
   AND c.id=(f->>'candidateId')::uuid AND c.store_id=(f->>'storeId')::uuid AND c.session_id=(f->>'sessionId')::uuid
   AND r.fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f) ORDER BY r.round DESC LIMIT 1;
 IF run.status='finalized' THEN
  IF run.retry_not_before IS DISTINCT FROM p_not_before THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('status',CASE WHEN run.retry_allowed THEN 'retry_scheduled' ELSE 'finalized' END,
   'round',run.round,'dueAt',run.due_at);
 ELSIF run.status='unknown' THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 j:=marketplace_sec.phase9_admission_fence_v1(f);
 SELECT * INTO run FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id
  AND r.query_identity_hash=encode(extensions.digest(f->>'queryIdentity','sha256'),'hex')
  AND r.adapter_key=p_key AND r.adapter_version=p_version
  AND r.candidate_version=(f->>'candidateVersion')::integer
  AND r.captured_request_id IS NOT DISTINCT FROM (f->>'capturedRequestId')::uuid
  AND r.request_generation=(f->>'requestGeneration')::integer
  AND r.fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f) ORDER BY r.round DESC LIMIT 1 FOR UPDATE;
 IF run.job_id IS NULL OR run.claim_attempt_number<>j.attempt_count OR run.claim_worker IS DISTINCT FROM f->>'worker'
  OR run.claim_lease_token_hash IS DISTINCT FROM encode(extensions.digest(f->>'leaseToken','sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF run.status<>'running' THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
 PERFORM 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=j.store_id FOR UPDATE;
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,j.lease_token_hash) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at,c.id) INTO calls FROM public.phase9_metadata_provider_calls c
  WHERE c.job_id=j.id AND c.logical_attempt_id=run.primary_attempt_id AND c.claim_attempt_number=j.attempt_count;
 SELECT * INTO final_call FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id
  AND c.logical_attempt_id=run.primary_attempt_id AND c.claim_attempt_number=j.attempt_count
  ORDER BY c.created_at DESC,c.id DESC LIMIT 1;
 IF final_call.id IS NULL OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id
  AND c.claim_attempt_number=j.attempt_count AND (c.status<>'finalized' OR c.logical_attempt_id IS DISTINCT FROM run.primary_attempt_id))
 THEN
  UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='unknown' WHERE job_id=run.job_id
   AND query_identity_hash=run.query_identity_hash AND adapter_key=p_key AND adapter_version=p_version AND round=run.round;
  UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
  PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
  RETURN jsonb_build_object('status','recovery_only');
 END IF;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=p_key FOR SHARE;
 policy:=registry.protection_policy;
 safe:=final_call.retryable IS TRUE AND final_call.logical_outcome IN ('rate_limited','provider_unavailable','timeout','network_failure');
 IF safe AND run.round=0 AND j.attempt_count<j.max_attempts AND policy IS NOT NULL
  AND registry.enabled AND registry.matching_allowed AND registry.storage_allowed
  AND registry.automatic_lookup_allowed AND registry.automatic_role='primary'
  AND registry.adapter_version=p_version AND policy->>'mode'='single_instance'
  AND marketplace_sec.phase9_capacity_configuration_valid_v1(policy) THEN
  -- One retry: first exponential step, bounded jitter; no invented numeric policy.
  due:=clock_timestamp()+make_interval(secs=>least((policy->>'backoffMaxMs')::double precision,
   (policy->>'backoffBaseMs')::double precision*(1+random()))/1000);
  due:=greatest(due,p_not_before);
 END IF;
 UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='finalized',retry_allowed=(due IS NOT NULL),
  due_at=due,retry_not_before=p_not_before,outcome=final_call.logical_outcome,
  receipt_digest=marketplace_sec.phase9_run_receipt_digest_v1(j.id,run.primary_attempt_id,j.attempt_count) WHERE job_id=run.job_id
   AND query_identity_hash=run.query_identity_hash AND adapter_key=p_key AND adapter_version=p_version AND round=run.round;
 UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
 PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
 IF due IS NULL THEN RETURN jsonb_build_object('status','finalized','round',run.round); END IF;
 UPDATE public.image_extraction_jobs SET status='retry_scheduled',next_attempt_at=due,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 RETURN jsonb_build_object('status','retry_scheduled','round',run.round,'dueAt',due);
END$$;

-- Worker observes the breaker; SQL owns its one durable, unsent recheck.
CREATE FUNCTION marketplace_sec.phase9_schedule_automatic_provider_recheck_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r marketplace_sec.phase9_automatic_provider_runs;
 registry public.phase9_provider_registry; due timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT coalesce(marketplace_sec.phase9_auto_fence_valid_v1(f),false)
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 SELECT * INTO r FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=(f->>'jobId')::uuid
  AND adapter_key=p_key AND adapter_version=p_version
  AND fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f) ORDER BY round DESC LIMIT 1;
 IF r.status='finalized' AND r.no_egress_recheck THEN
  RETURN jsonb_build_object('status',CASE WHEN r.retry_allowed THEN 'retry_scheduled' ELSE 'finalized' END,
   'round',r.round,'dueAt',r.due_at);
 END IF;
 j:=marketplace_sec.phase9_admission_fence_v1(f);
 SELECT * INTO r FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=j.id
  AND adapter_key=p_key AND adapter_version=p_version ORDER BY round DESC LIMIT 1 FOR UPDATE;
 IF r.job_id IS NULL OR r.status<>'running' OR r.fence_digest IS DISTINCT FROM marketplace_sec.phase9_run_fence_digest_v1(f)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id AND claim_attempt_number=j.attempt_count)
 THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 IF r.round=0 AND (EXISTS(SELECT 1 FROM public.phase9_metadata_lookups WHERE job_id=j.id)
  OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations WHERE job_id=j.id))
 THEN RETURN jsonb_build_object('status','drain_required'); END IF;
 PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=p_key FOR SHARE;
 PERFORM 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=j.store_id FOR UPDATE;
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,j.lease_token_hash) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF r.round=0 AND j.attempt_count<j.max_attempts AND registry.enabled AND registry.matching_allowed
  AND registry.storage_allowed AND registry.automatic_lookup_allowed AND registry.automatic_role='primary'
  AND registry.adapter_version=p_version AND registry.protection_policy->>'mode'='single_instance'
  AND marketplace_sec.phase9_capacity_configuration_valid_v1(registry.protection_policy)
 THEN due:=clock_timestamp()+make_interval(secs=>(registry.protection_policy->>'breakerCooldownMs')::double precision/1000); END IF;
 UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='finalized',outcome='circuit_breaker_open',
  no_egress_recheck=true,retry_allowed=(due IS NOT NULL),due_at=due,
  receipt_digest=marketplace_sec.phase9_run_receipt_digest_v1(j.id,r.primary_attempt_id,j.attempt_count)
  WHERE job_id=r.job_id AND query_identity_hash=r.query_identity_hash
   AND adapter_key=r.adapter_key AND adapter_version=r.adapter_version AND round=r.round;
 UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
 PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
 IF due IS NULL THEN RETURN jsonb_build_object('status','finalized','round',r.round); END IF;
 UPDATE public.image_extraction_jobs SET status='retry_scheduled',next_attempt_at=due,lease_owner=NULL,
  lease_token_hash=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 RETURN jsonb_build_object('status','retry_scheduled','round',r.round,'dueAt',due);
END$$;

-- This proof widens only manual technical completion, never provider success,
-- a fresh grant, selected metadata, retained alternatives or catalogue writes.
CREATE FUNCTION marketplace_sec.phase9_automatic_terminal_run_v1(p_command jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE f jsonb:=p_command->'fence'; o jsonb:=p_command#>'{result,outcome}';
 r marketplace_sec.phase9_automatic_provider_runs; first marketplace_sec.phase9_automatic_provider_runs;
 last_call public.phase9_metadata_provider_calls; j public.image_extraction_jobs;
BEGIN
 IF NOT coalesce((o->>'retryable')::boolean,false) OR o->>'outcome' NOT IN
  ('timeout','network_failure','rate_limited','provider_unavailable','circuit_breaker_open')
  OR o->'selected'<>'null'::jsonb OR o->'candidates'<>'[]'::jsonb OR o->'evidence'<>'[]'::jsonb
  OR o->'representativeCover'<>'null'::jsonb OR p_command#>'{result,rows}'<>'null'::jsonb
  OR p_command#>'{result,retention}'<>'null'::jsonb
  OR p_command#>'{result,catalogueCompanions}'<>'null'::jsonb
  OR p_command->'selectedOptionId'<>'null'::jsonb THEN RETURN NULL; END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid;
 SELECT * INTO r FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=j.id
  AND fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f) ORDER BY round DESC LIMIT 1;
 IF r.job_id IS NULL OR r.status<>'finalized' OR r.retry_allowed OR r.due_at IS NOT NULL
  OR r.outcome IS DISTINCT FROM o->>'outcome' OR r.claim_attempt_number<>j.attempt_count
  OR r.claim_worker IS DISTINCT FROM j.lease_owner OR r.claim_lease_token_hash IS DISTINCT FROM j.lease_token_hash
  OR r.lookup_id IS DISTINCT FROM (CASE WHEN p_command->>'source'='external' THEN (p_command->>'lookupId')::uuid END)
  OR r.primary_attempt_id IS DISTINCT FROM (p_command->>'attemptId')::uuid
  OR r.receipt_digest IS DISTINCT FROM marketplace_sec.phase9_run_receipt_digest_v1(j.id,r.primary_attempt_id,r.claim_attempt_number)
 THEN RETURN NULL; END IF;
 IF r.round=1 THEN
  SELECT * INTO first FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=r.job_id
   AND query_identity_hash=r.query_identity_hash AND adapter_key=r.adapter_key AND adapter_version=r.adapter_version AND round=0;
  IF first.status IS DISTINCT FROM 'finalized' OR NOT first.retry_allowed
   OR first.claim_attempt_number>=r.claim_attempt_number OR first.claim_lease_token_hash=r.claim_lease_token_hash
   OR first.candidate_version<>r.candidate_version OR first.captured_request_id IS DISTINCT FROM r.captured_request_id
   OR first.request_generation<>r.request_generation
   OR (NOT first.no_egress_recheck AND (first.lookup_id IS DISTINCT FROM r.lookup_id
    OR first.primary_attempt_id IS DISTINCT FROM r.primary_attempt_id))
   OR (first.no_egress_recheck AND (first.lookup_id IS NOT NULL OR first.primary_attempt_id IS NOT NULL))
   OR first.receipt_digest IS DISTINCT FROM marketplace_sec.phase9_run_receipt_digest_v1(j.id,first.primary_attempt_id,first.claim_attempt_number)
  THEN RETURN NULL; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id
  AND (c.status<>'finalized' OR c.logical_attempt_id IS DISTINCT FROM r.primary_attempt_id
   OR c.claim_attempt_number NOT IN (r.claim_attempt_number,coalesce(first.claim_attempt_number,r.claim_attempt_number))))
 THEN RETURN NULL; END IF;
 IF r.no_egress_recheck THEN
  IF r.outcome<>'circuit_breaker_open' OR o->'providerRequestId'<>'null'::jsonb
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id AND claim_attempt_number=r.claim_attempt_number)
  THEN RETURN NULL; END IF;
  RETURN 'no_egress_terminal';
 END IF;
 SELECT * INTO last_call FROM public.phase9_metadata_provider_calls WHERE job_id=j.id
  AND logical_attempt_id=r.primary_attempt_id AND claim_attempt_number=r.claim_attempt_number ORDER BY created_at DESC,id DESC LIMIT 1;
 IF last_call.id IS NULL OR NOT last_call.retryable OR last_call.logical_outcome IS DISTINCT FROM r.outcome
  OR last_call.normalized_outcome IS DISTINCT FROM r.outcome
 THEN RETURN NULL; END IF;
 RETURN 'physical_terminal';
END$$;

-- Preserve the original draft signature; 8b may pass a safely parsed header
-- floor through the new overload. SQL never claims to verify remote headers.
CREATE FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_finish_automatic_provider_run_v1(f,p_key,p_version,NULL)
$$;

-- 02c §§3.1/4.3/8: new grants re-prove the persisted request/claim fence.
-- Keep the parent session prefix BEFORE the legacy functions lock a job.
CREATE FUNCTION marketplace_sec.phase9_assert_queue_grant_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates;
 run marketplace_sec.phase9_automatic_provider_runs; session_id uuid; f jsonb; registry public.phase9_provider_registry;
 a marketplace_sec.phase9_metadata_admissions;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions x
  JOIN public.image_extraction_jobs current ON current.id=x.job_id
  WHERE x.job_id=p_job_id AND x.claim_attempt_number=current.attempt_count
   AND x.claim_worker IS NOT DISTINCT FROM current.lease_owner
   AND x.claim_lease_token_hash IS NOT DISTINCT FROM current.lease_token_hash)
  AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs x WHERE x.job_id=p_job_id
   AND x.claim_attempt_number=p_attempt_count
   AND x.claim_worker IS NOT DISTINCT FROM p_worker
   AND x.claim_lease_token_hash IS NOT DISTINCT FROM encode(extensions.digest(p_lease_token,'sha256'),'hex'))
 THEN RETURN; END IF; -- Legacy claims keep their existing authority boundary.
 SELECT candidate.session_id INTO session_id FROM public.image_extraction_jobs job
  JOIN public.image_extraction_candidates candidate ON candidate.id=job.entity_id AND candidate.store_id=job.store_id
  WHERE job.id=p_job_id AND job.job_kind='metadata_enrich' AND job.entity_type='candidate';
 IF session_id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 PERFORM 1 FROM public.image_extraction_sessions WHERE id=session_id FOR KEY SHARE;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 SELECT * INTO c FROM public.image_extraction_candidates WHERE id=j.entity_id AND store_id=j.store_id FOR UPDATE;
 IF j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1' THEN
  SELECT * INTO run FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id
   AND r.claim_attempt_number=j.attempt_count AND r.claim_worker IS NOT DISTINCT FROM j.lease_owner
   AND r.claim_lease_token_hash IS NOT DISTINCT FROM j.lease_token_hash
   ORDER BY r.round DESC LIMIT 1 FOR UPDATE;
  IF run.job_id IS NULL OR run.status<>'running' OR run.claim_attempt_number<>j.attempt_count
   OR run.claim_worker IS DISTINCT FROM p_worker OR run.claim_lease_token_hash IS DISTINCT FROM j.lease_token_hash
  THEN RAISE EXCEPTION 'P9_PROVIDER_RUN_NOT_ADMITTED'; END IF;
  f:=jsonb_build_object('jobId',j.id,'worker',p_worker,'leaseToken',p_lease_token,'claimAttempt',p_attempt_count,
   'candidateId',c.id,'storeId',c.store_id,'sessionId',c.session_id,'candidateVersion',run.candidate_version,
   'queryIdentity',marketplace_sec.phase9_metadata_candidate_query_identity(c),
   'capturedRequestId',run.captured_request_id,'requestGeneration',run.request_generation);
  IF run.fence_digest IS DISTINCT FROM marketplace_sec.phase9_run_fence_digest_v1(f)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  PERFORM marketplace_sec.phase9_admission_fence_v1(f);
  PERFORM marketplace_sec.phase9_external_grant_epoch_v1(j.id);
  PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
  SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=run.adapter_key;
  IF registry.protection_policy IS NULL OR registry.protection_policy->>'mode' IS DISTINCT FROM 'single_instance'
  THEN RAISE EXCEPTION 'P9_PROVIDER_CONFIGURATION_INVALID'; END IF;
 ELSE
  SELECT * INTO a FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=j.id FOR UPDATE;
  IF a.fence IS NULL OR a.claim_attempt_number<>j.attempt_count OR a.claim_worker IS DISTINCT FROM p_worker
   OR a.claim_lease_token_hash IS DISTINCT FROM j.lease_token_hash
  THEN RAISE EXCEPTION 'P9_PROVIDER_RUN_NOT_ADMITTED'; END IF;
  f:=a.fence||jsonb_build_object('leaseToken',p_lease_token);
  PERFORM marketplace_sec.phase9_admission_fence_v1(f,true);
  PERFORM marketplace_sec.phase9_external_grant_epoch_v1(j.id);
  PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
  SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=a.adapter_key;
  IF registry.protection_policy IS NULL OR registry.protection_policy IS DISTINCT FROM a.policy
  THEN RAISE EXCEPTION 'P9_PROVIDER_CONFIGURATION_INVALID'; END IF;
 END IF;
END$$;
-- Exact legacy bodies are private delegates. Preserve original function OIDs
-- with CREATE OR REPLACE so existing SQL/PLpgSQL call plans cannot bypass guards.
CREATE FUNCTION marketplace_sec.phase9_register_metadata_provider_call_pre_queue_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_physical_call_identity uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; a public.metadata_enrichment_attempts;
 l public.phase9_metadata_lookups; pc public.phase9_metadata_provider_calls; explicit boolean; grant_epoch bigint;
BEGIN
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 explicit:=j.operation_version='p9-owner-edition-options-v1';
 IF explicit THEN c:=marketplace_sec.phase9_edition_worker_candidate(j);
 ELSE
  SELECT * INTO c FROM public.image_extraction_candidates WHERE id=j.entity_id AND store_id=j.store_id;
  c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
   p_job_id,p_worker,p_lease_token,p_attempt_count,c.id,c.version);
 END IF;
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0
  JOIN public.phase9_metadata_lookups l0 ON l0.id=a0.lookup_id
  JOIN public.phase9_usage_reservations u ON u.id=a0.usage_reservation_id
  WHERE a0.id=p_attempt_id AND a0.candidate_id=c.id AND a0.store_id=c.store_id AND a0.provider_role='primary'
   AND a0.disposition='unresolved' AND l0.job_id=j.id AND l0.candidate_id=c.id AND l0.store_id=c.store_id
   AND l0.completed_at IS NULL AND l0.leader_lookup_id IS NULL
   AND a0.adapter_key=l0.adapter_key AND a0.adapter_version=l0.adapter_version
   AND l0.query_identity=CASE WHEN explicit THEN marketplace_sec.phase9_edition_query_identity(c)
    ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END
   AND l0.claim_attempt_number=p_attempt_count AND l0.claim_worker=p_worker
   AND l0.claim_lease_token_hash=pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed')
   AND u.adapter_key=l0.adapter_key AND u.adapter_version=l0.adapter_version
   AND u.policy_version::text=l0.reuse_policy_version FOR UPDATE OF a0;
 IF a.id IS NULL OR p_physical_call_identity IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
 IF NOT marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,NULL,NULL,l.lookup_strategy)
  AND NOT (NOT explicit AND marketplace_sec.phase9_provider_legacy_route_v1(a.adapter_key,a.adapter_version,false,'primary'))
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE physical_call_identity=p_physical_call_identity
  OR (logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count) ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF pc.id IS NOT NULL THEN
  IF pc.physical_call_identity IS DISTINCT FROM p_physical_call_identity OR pc.logical_attempt_id IS DISTINCT FROM a.id
   OR pc.job_id IS DISTINCT FROM j.id OR pc.claim_attempt_number IS DISTINCT FROM p_attempt_count
   OR pc.claim_worker IS DISTINCT FROM p_worker
   OR pc.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   OR pc.edition_call_sequence IS NOT NULL OR pc.edition_call_stage IS NOT NULL
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 grant_epoch:=marketplace_sec.phase9_external_grant_epoch_v1(j.id);
 IF NOT marketplace_sec.phase9_metadata_route_valid_v1(a.adapter_key,a.adapter_version,explicit,a.provider_role,
   a.capability_version,a.schema_version,a.normalizer_version)
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=a.adapter_key
   AND r.policy_version::text=l.reuse_policy_version)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
  physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,grant_epoch)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,
  pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex'),grant_epoch) RETURNING * INTO pc;
 RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END$$;

CREATE FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_pre_queue_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_physical_call_identity uuid,p_call_sequence integer,p_call_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; a public.metadata_enrichment_attempts;
 l public.phase9_metadata_lookups; pc public.phase9_metadata_provider_calls; explicit boolean; grant_epoch bigint;
BEGIN
 IF NOT coalesce(auth.role()='service_role' AND p_physical_call_identity IS NOT NULL
  AND p_call_sequence BETWEEN 0 AND 5
  AND p_call_stage ~ '^[A-Za-z][A-Za-z0-9._:-]*$',false) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 explicit:=j.operation_version='p9-owner-edition-options-v1';
 IF explicit THEN c:=marketplace_sec.phase9_edition_worker_candidate(j);
 ELSE
  SELECT * INTO c FROM public.image_extraction_candidates WHERE id=j.entity_id AND store_id=j.store_id;
  c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
   p_job_id,p_worker,p_lease_token,p_attempt_count,c.id,c.version);
 END IF;
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0
  JOIN public.phase9_metadata_lookups l0 ON l0.id=a0.lookup_id
  JOIN public.phase9_usage_reservations u ON u.id=a0.usage_reservation_id
  WHERE a0.id=p_attempt_id AND a0.disposition='unresolved' AND a0.candidate_id=c.id AND a0.store_id=c.store_id
   AND l0.job_id=j.id AND l0.candidate_id=c.id AND l0.store_id=c.store_id
   AND l0.completed_at IS NULL AND l0.leader_lookup_id IS NULL
   AND l0.query_identity=CASE WHEN explicit THEN marketplace_sec.phase9_edition_query_identity(c)
    ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END
   AND l0.claim_attempt_number=p_attempt_count AND l0.claim_worker=p_worker
   AND l0.claim_lease_token_hash=pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed')
   AND u.adapter_key=l0.adapter_key AND u.adapter_version=l0.adapter_version
   AND u.policy_version::text=l0.reuse_policy_version FOR UPDATE OF a0;
 IF a.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
 IF NOT marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,p_call_sequence,p_call_stage,l.lookup_strategy)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls
  WHERE physical_call_identity=p_physical_call_identity OR
   (logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
    AND (edition_call_sequence=p_call_sequence OR edition_call_stage=p_call_stage))
  ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF pc.id IS NOT NULL THEN
  IF pc.physical_call_identity IS DISTINCT FROM p_physical_call_identity OR pc.logical_attempt_id IS DISTINCT FROM a.id
   OR pc.job_id IS DISTINCT FROM j.id OR pc.claim_attempt_number IS DISTINCT FROM p_attempt_count
   OR pc.claim_worker IS DISTINCT FROM p_worker
   OR pc.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   OR pc.edition_call_sequence IS DISTINCT FROM p_call_sequence OR pc.edition_call_stage IS DISTINCT FROM p_call_stage
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 grant_epoch:=marketplace_sec.phase9_external_grant_epoch_v1(j.id);
 IF NOT marketplace_sec.phase9_metadata_route_valid_v1(a.adapter_key,a.adapter_version,explicit,a.provider_role,
   a.capability_version,a.schema_version,a.normalizer_version)
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=a.adapter_key
   AND r.storage_allowed AND r.policy_version::text=l.reuse_policy_version)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF (a.provider_role='primary' AND (a.adapter_key IS DISTINCT FROM l.adapter_key OR a.adapter_version IS DISTINCT FROM l.adapter_version))
  OR (a.provider_role='secondary' AND NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts pred
   WHERE pred.id=a.predecessor_attempt_id AND pred.lookup_id=l.id AND pred.candidate_id=c.id AND pred.store_id=c.store_id
    AND pred.provider_role='primary' AND pred.attempt_sequence=1 AND pred.adapter_key=l.adapter_key
    AND pred.adapter_version=l.adapter_version AND pred.disposition IN ('rejected','failed')
    AND pred.normalized_outcome=a.predecessor_outcome))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF p_call_sequence>0 AND (SELECT count(*) FROM public.phase9_metadata_provider_calls prior
  WHERE prior.logical_attempt_id=a.id AND prior.claim_attempt_number=p_attempt_count
   AND prior.edition_call_sequence<p_call_sequence AND prior.status='finalized'
   AND prior.edition_egress_started=true AND prior.retryable=false
   AND marketplace_sec.phase9_provider_stage_continues_v1(a.adapter_key,a.adapter_version,
    prior.edition_call_sequence,prior.edition_call_stage,prior.normalized_outcome))<>p_call_sequence
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
  physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,edition_call_sequence,edition_call_stage,grant_epoch)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,
  pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex'),p_call_sequence,p_call_stage,grant_epoch) RETURNING * INTO pc;
 RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END$$;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_provider_call_pre_queue_v1(uuid,uuid,text,text,integer,uuid),
 marketplace_sec.phase9_register_edition_options_provider_call_pre_queue_v1(uuid,uuid,text,text,integer,uuid,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_metadata_provider_call(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_physical_call_identity uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE physical_call_identity=p_physical_call_identity) THEN
  PERFORM marketplace_sec.phase9_assert_queue_grant_v1(p_job_id,p_worker,p_lease_token,p_attempt_count);
 END IF;
 RETURN marketplace_sec.phase9_register_metadata_provider_call_pre_queue_v1(
  p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_physical_call_identity);
END$$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_physical_call_identity uuid,p_call_sequence integer,p_call_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE physical_call_identity=p_physical_call_identity) THEN
  PERFORM marketplace_sec.phase9_assert_queue_grant_v1(p_job_id,p_worker,p_lease_token,p_attempt_count);
 END IF;
 RETURN marketplace_sec.phase9_register_edition_options_provider_call_pre_queue_v1(
  p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_physical_call_identity,p_call_sequence,p_call_stage);
END$$;
ALTER FUNCTION marketplace_sec.phase9_assert_queue_grant_v1(uuid,text,text,integer) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_assert_queue_grant_v1(uuid,text,text,integer),
 marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid),
 marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid),
 marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text) TO service_role;

-- 02c §4.3: M92 terminal transaction with exact durable retry-exhaustion proof.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb:=p_command->'fence'; result jsonb:=p_command->'result'; o jsonb:=result->'outcome';
 c public.image_extraction_candidates; sess public.image_extraction_sessions; j public.image_extraction_jobs;
 l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
 state public.phase9_candidate_edition_state; prior marketplace_sec.phase9_automatic_completion_effects;
 m jsonb:=nullif(o->'selected','null'::jsonb); r jsonb; cm jsonb; companion jsonb; proof jsonb;
 rows jsonb:=nullif(result->'rows','null'::jsonb); companions jsonb:=coalesce(nullif(result->'catalogueCompanions','null'::jsonb),'[]'::jsonb);
 policy jsonb; receipts jsonb; terminal jsonb; envelope jsonb; response jsonb; replay jsonb;
 digest text; claim_hash text; summary text; logical_outcome text; valid boolean; selected_id uuid;
 v_lookup_id uuid; v_attempt_id uuid; v_snapshot_id uuid; pair record;
 selected_work uuid; selected_edition uuid; registry public.phase9_provider_registry;
 v_results jsonb:='[]'; keys bigint[]:=ARRAY[]::bigint[]; next_keys bigint[]; key bigint;
 seen uuid[]:=ARRAY[]::uuid[]; fetched timestamptz; deadline timestamptz; queue_terminal text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
  OR pg_catalog.jsonb_typeof(p_command) IS DISTINCT FROM 'object'
  OR NOT p_command ?& ARRAY['fence','lookupId','attemptId','result','selectedOptionId','source']
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(p_command))<>6
  OR NOT marketplace_sec.phase9_auto_fence_valid_v1(f)
  OR NOT marketplace_sec.phase9_auto_result_valid_v1(result)
  OR pg_catalog.jsonb_typeof(p_command->'lookupId') IS DISTINCT FROM 'string'
  OR p_command->>'lookupId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  OR pg_catalog.jsonb_typeof(p_command->'source') IS DISTINCT FROM 'string'
  OR p_command->>'source' NOT IN ('external','local') THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 IF (p_command->'attemptId'<>'null'::jsonb AND (pg_catalog.jsonb_typeof(p_command->'attemptId')<>'string'
  OR p_command->>'attemptId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
  OR (p_command->'selectedOptionId'<>'null'::jsonb AND (pg_catalog.jsonb_typeof(p_command->'selectedOptionId')<>'string'
  OR p_command->>'selectedOptionId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 v_lookup_id:=(p_command->>'lookupId')::uuid; v_attempt_id:=(p_command->>'attemptId')::uuid;
 selected_id:=(p_command->>'selectedOptionId')::uuid;
 claim_hash:=pg_catalog.encode(extensions.digest(f->>'leaseToken','sha256'),'hex');
 -- Raw lease token is excluded; exact JSON result/retention/selection are hashed.
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  (p_command||pg_catalog.jsonb_build_object('fence',(f-'leaseToken')||
   pg_catalog.jsonb_build_object('leaseTokenHash',claim_hash)))::text,'UTF8')),'hex');
 replay:=marketplace_sec.phase9_recover_automatic_metadata_v1(f);
 IF replay->>'status'='replayed' THEN
  SELECT * INTO prior FROM marketplace_sec.phase9_automatic_completion_effects e WHERE e.job_id=(f->>'jobId')::uuid;
  IF prior.lookup_id IS DISTINCT FROM v_lookup_id OR prior.completion_digest IS DISTINCT FROM digest
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN replay;
 ELSIF replay->>'status'='stale_rejected' THEN RETURN replay; END IF;
 -- Session -> job -> candidate -> state -> lookup/attempt -> calls -> policy -> identities.
 SELECT * INTO sess FROM public.image_extraction_sessions WHERE id=(f->>'sessionId')::uuid FOR KEY SHARE;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid FOR UPDATE;
 SELECT * INTO prior FROM marketplace_sec.phase9_automatic_completion_effects e WHERE e.job_id=j.id;
 IF prior.lookup_id IS NOT NULL THEN
  IF prior.completion_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_recover_automatic_metadata_v1(f);
 END IF;
 IF sess.store_id::text IS DISTINCT FROM f->>'storeId'
  OR NOT marketplace_sec.phase9_owner_ux_session_mutable(sess)
  OR j.entity_id::text IS DISTINCT FROM f->>'candidateId' OR j.store_id IS DISTINCT FROM sess.store_id
  OR j.job_kind IS DISTINCT FROM 'metadata_enrich' OR j.entity_type IS DISTINCT FROM 'candidate'
  OR j.operation_version='p9-owner-edition-options-v1'
  OR j.status IS DISTINCT FROM 'in_progress' OR j.lease_owner IS DISTINCT FROM f->>'worker'
  OR j.lease_token_hash IS DISTINCT FROM claim_hash OR j.attempt_count<>(f->>'claimAttempt')::integer
  OR j.lease_expires_at IS NULL OR j.lease_expires_at<=pg_catalog.clock_timestamp()
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(j.id,f->>'worker',f->>'leaseToken',
  (f->>'claimAttempt')::integer,(f->>'candidateId')::uuid,(f->>'candidateVersion')::integer);
 IF c.session_id IS DISTINCT FROM sess.id OR c.store_id IS DISTINCT FROM sess.store_id
  OR c.expires_at<=pg_catalog.clock_timestamp()
  OR marketplace_sec.phase9_metadata_candidate_query_identity(c) IS DISTINCT FROM f->>'queryIdentity'
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO state FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF coalesce(state.request_generation,0)<>(f->>'requestGeneration')::integer
  OR state.request_id IS DISTINCT FROM (f->>'capturedRequestId')::uuid
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=v_lookup_id AND job_id=j.id
  AND candidate_id=c.id AND store_id=c.store_id AND query_identity=f->>'queryIdentity' FOR UPDATE;
 IF l.id IS NULL AND EXISTS(SELECT 1 FROM public.phase9_metadata_lookups source WHERE source.id=v_lookup_id)
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF l.id IS NOT NULL AND (l.claim_attempt_number<>(f->>'claimAttempt')::integer
  OR l.claim_worker IS DISTINCT FROM f->>'worker' OR l.claim_lease_token_hash IS DISTINCT FROM claim_hash
  OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL)
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF rows IS NULL AND selected_id IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 IF m IS NULL AND selected_id IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 IF rows IS NOT NULL AND m IS NOT NULL AND (selected_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row WHERE row->>'optionId'=selected_id::text
   AND row->>'eligibility'='eligible' AND row->'metadata'=m))
 THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 summary:=CASE o->>'outcome' WHEN 'coherent_match' THEN 'accepted_metadata_match'
  WHEN 'ambiguous_match' THEN 'ambiguous' WHEN 'material_conflict' THEN 'material_conflict'
  WHEN 'no_acceptable_match' THEN 'no_match' WHEN 'insufficient_query' THEN 'manual_metadata_required'
  WHEN 'cost_quota_denied' THEN 'cost_quota_denied'
  WHEN 'policy_denied' THEN 'policy_denied' WHEN 'provider_disabled' THEN 'policy_denied'
  WHEN 'legal_launch_denied' THEN 'policy_denied' WHEN 'cancelled' THEN 'policy_denied'
  WHEN 'authentication_configuration_failure' THEN 'policy_denied' ELSE 'technical_failure' END;
 -- 02c §4.3: 8a-5 owns retry scheduling while claims remain. Exhaustion
 -- uses the existing terminal transaction; an expired fifth lease cannot be
 -- reclaimed by M15 or failed by the lease-fenced M32 failure handler.
 queue_terminal:=marketplace_sec.phase9_automatic_terminal_run_v1(p_command);
 IF (o->>'retryable')::boolean AND (queue_terminal IS NULL AND j.attempt_count<j.max_attempts OR summary<>'technical_failure')
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF p_command->>'source'='local' THEN
  -- Zero-egress manual result. Existing canonical-local/cache hits continue
  -- through their validated legacy boundaries, with no invented provider rows.
  IF v_attempt_id IS NOT NULL OR m IS NOT NULL OR rows IS NOT NULL OR companions<>'[]'::jsonb
   OR o->'candidates'<>'[]'::jsonb OR o->'representativeCover'<>'null'::jsonb
   OR EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a0 WHERE a0.lookup_id=v_lookup_id)
   OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id)
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.job_id=j.id)
   OR (l.id IS NOT NULL AND l.execution_mode<>'local')
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF l.id IS NULL THEN
   INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,execution_mode,
    schema_version,lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
    privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash)
   VALUES(v_lookup_id,c.id,c.store_id,j.id,f->>'queryIdentity','local','p9-metadata-foundation-v1',
    CASE WHEN marketplace_sec.phase9_metadata_normalized_isbn13(c.observed_isbn_clue) IS NULL
     THEN 'bibliographic' ELSE 'isbn' END,'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','store_private',(f->>'claimAttempt')::integer,f->>'worker',claim_hash)
   RETURNING * INTO l;
  END IF;
 ELSE
  IF l.id IS NULL OR v_attempt_id IS NULL OR l.execution_mode<>'external'
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=v_attempt_id AND lookup_id=l.id
   AND candidate_id=c.id AND store_id=c.store_id FOR UPDATE;
  IF a.id IS NULL OR a.disposition<>'unresolved' OR a.provider_role NOT IN ('primary','secondary')
   OR a.normalizer_version IS DISTINCT FROM l.normalizer_version OR a.schema_version IS DISTINCT FROM l.schema_version
   OR a.routing_policy_version IS DISTINCT FROM l.routing_policy_version
   OR (a.provider_role='primary' AND (a.adapter_key IS DISTINCT FROM l.adapter_key OR a.adapter_version IS DISTINCT FROM l.adapter_version))
   OR (a.provider_role='secondary' AND NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts pred
    WHERE pred.id=a.predecessor_attempt_id AND pred.lookup_id=l.id AND pred.candidate_id=c.id AND pred.store_id=c.store_id
     AND pred.provider_role='primary' AND pred.adapter_key=l.adapter_key AND pred.adapter_version=l.adapter_version
     AND pred.disposition IN ('rejected','failed') AND pred.normalized_outcome=a.predecessor_outcome
     AND pred.normalized_outcome IN ('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open',
      'network_failure','response_too_large','unsupported_content_type')))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF queue_terminal='no_egress_terminal' THEN
   -- Exact persisted unsent breaker decision; no fabricated current receipt.
   pc:=NULL;
  ELSE
  PERFORM 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
   AND call.claim_attempt_number=j.attempt_count ORDER BY call.created_at,call.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
   AND call.claim_attempt_number=j.attempt_count AND (call.job_id IS DISTINCT FROM j.id
    OR call.candidate_id IS DISTINCT FROM c.id OR call.store_id IS DISTINCT FROM c.store_id
    OR call.claim_worker IS DISTINCT FROM f->>'worker' OR call.claim_lease_token_hash IS DISTINCT FROM claim_hash
    OR call.status IS DISTINCT FROM 'finalized'
    OR (call.retryable AND NOT ((j.attempt_count>=j.max_attempts OR coalesce(queue_terminal='physical_terminal',false)) AND (o->>'retryable')::boolean))))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id
   AND claim_attempt_number=j.attempt_count ORDER BY created_at DESC,id DESC LIMIT 1;
  IF pc.id IS NULL THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF pc.edition_call_sequence IS NULL THEN
    -- 02c §§3.2/4.3: installed single-call protocol, including legacy receipts.
   IF pc.logical_outcome IS DISTINCT FROM o->>'outcome' OR pc.provider_request_id IS DISTINCT FROM o->>'providerRequestId'
    OR pc.normalized_candidate IS DISTINCT FROM m
    OR pc.match_evidence IS DISTINCT FROM o->'evidence'
     OR pc.retryable IS DISTINCT FROM (o->>'retryable')::boolean
    OR (SELECT count(*) FROM public.phase9_metadata_provider_calls call
     WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count)<>1
     OR pc.edition_call_stage IS NOT NULL
     OR (NOT coalesce(marketplace_sec.phase9_provider_stage_valid_v1(
       a.adapter_key,a.adapter_version,NULL,NULL,l.lookup_strategy),false)
      AND NOT marketplace_sec.phase9_provider_legacy_route_v1(a.adapter_key,a.adapter_version,false,a.provider_role))
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  ELSE
   -- 02c §4.3: fan-out receipts do not bind selected metadata bytes. A winner
   -- must therefore have the exact retained row and companion checked below.
   IF m IS NOT NULL AND rows IS NULL THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('callSequence',call.edition_call_sequence,
    'callStage',call.edition_call_stage,'status',call.status,'egressStarted',call.edition_egress_started,
    'retryable',call.retryable,'normalizedOutcome',call.normalized_outcome,'logicalOutcome',call.logical_outcome,
    'normalizedCandidate',call.normalized_candidate,'matchEvidence',call.match_evidence) ORDER BY call.created_at,call.id)
   INTO receipts FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count;
   terminal:=receipts->(pg_catalog.jsonb_array_length(receipts)-1);
   envelope:=pg_catalog.jsonb_build_object('providerRole',a.provider_role,'primaryAdapterKey',l.adapter_key,
    'predecessorOutcome',a.predecessor_outcome,'queryKind',l.lookup_strategy,'rows',coalesce(rows,'[]'::jsonb),
    'terminalReceipt',terminal,'receipts',receipts);
   IF (o->>'retryable')::boolean THEN
    -- 02c §4.3: the success/list validator cannot validate a technical
    -- failure. On exhaustion only, prove the terminal failure and its complete
    -- registered stage prefix; no retained list or selected bytes are admitted.
    IF rows IS NOT NULL OR m IS NOT NULL OR companions<>'[]'::jsonb
     OR o->'candidates'<>'[]'::jsonb OR o->'evidence'<>'[]'::jsonb
     OR o->'representativeCover'<>'null'::jsonb OR pc.retryable IS DISTINCT FROM true
     OR pc.normalized_outcome IS DISTINCT FROM o->>'outcome'
     OR pc.logical_outcome IS DISTINCT FROM o->>'outcome'
     OR pc.provider_request_id IS DISTINCT FROM o->>'providerRequestId'
     OR pg_catalog.jsonb_array_length(receipts)<>pc.edition_call_sequence+1
     OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call
      WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count
       AND (call.edition_egress_started IS DISTINCT FROM true
        OR call.edition_call_sequence NOT BETWEEN 0 AND pc.edition_call_sequence
        OR NOT coalesce(marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,
         call.edition_call_sequence,call.edition_call_stage,l.lookup_strategy),false)
        OR call.normalized_candidate IS NOT NULL OR call.match_evidence IS DISTINCT FROM '[]'::jsonb
        OR (call.id<>pc.id AND (call.retryable OR NOT coalesce(
         marketplace_sec.phase9_provider_stage_continues_v1(a.adapter_key,a.adapter_version,
          call.edition_call_sequence,call.edition_call_stage,call.normalized_outcome),false)))))
    THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
    valid:=true; logical_outcome:=pc.logical_outcome;
   ELSE
     -- 02c §4.3: this validator proves the successful list/physical protocol.
     -- Its explicit-list summary does not rank the automatic winner or ties.
     IF o->>'outcome' NOT IN ('coherent_match','ambiguous_match','material_conflict','no_acceptable_match')
      OR (o->>'outcome'='ambiguous_match' AND pg_catalog.jsonb_array_length(o->'candidates')=0)
     THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
    SELECT checked.valid,checked.logical_outcome INTO valid,logical_outcome
     FROM marketplace_sec.phase9_provider_call_contract_v1(a.adapter_key,a.adapter_version,envelope) checked;
   END IF;
    IF NOT coalesce(valid,false)
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END IF;
  END IF;
  PERFORM 1 FROM public.phase9_usage_reservations u WHERE u.id=a.usage_reservation_id
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  policy:=marketplace_sec.phase9_catalogue_source_policy_v2(a.adapter_key,a.adapter_version);
  SELECT * INTO registry FROM public.phase9_provider_registry pr WHERE pr.adapter_key=a.adapter_key;
  IF queue_terminal IS NULL AND (policy IS NULL OR policy->>'policyVersion' IS DISTINCT FROM l.reuse_policy_version
   OR NOT coalesce(registry.enabled AND registry.matching_allowed AND registry.storage_allowed
    AND registry.adapter_version=a.adapter_version AND registry.automatic_lookup_allowed
    AND registry.automatic_role=a.provider_role AND registry.automatic_order=CASE a.provider_role WHEN 'primary' THEN 1 ELSE 2 END
    AND marketplace_sec.phase9_provider_automatic_supported_v1(a.adapter_key,a.adapter_version)
    AND registry.version_contracts->a.adapter_version=marketplace_sec.phase9_provider_validation_contract_v1(a.adapter_key,a.adapter_version)
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'capabilityVersion']=a.capability_version
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'lookupSchemaVersion']=a.schema_version
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'normalizerVersion']=a.normalizer_version,false))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF rows IS NOT NULL THEN
   fetched:=(result#>>'{retention,sourceFetchedAt}')::timestamptz;
   deadline:=(result#>>'{retention,permittedDeadlineAt}')::timestamptz;
   IF result#>>'{retention,policyVersion}' IS DISTINCT FROM policy->>'policyVersion'
    OR NOT marketplace_sec.phase9_provider_retention_valid_v1(result#>>'{retention,retentionContract}',fetched,deadline,policy)
    OR fetched>pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
    OR (registry.options_retention_seconds IS NOT NULL AND deadline>fetched+registry.options_retention_seconds*interval '1 second')
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END IF;
  FOR proof IN SELECT value FROM pg_catalog.jsonb_array_elements(o->'candidates')
   UNION ALL SELECT value->'metadata' FROM pg_catalog.jsonb_array_elements(coalesce(rows,'[]'::jsonb))
    WHERE value->'metadata'<>'null'::jsonb LOOP
   IF proof->>'correlationId' IS DISTINCT FROM l.id::text OR proof->>'attemptId' IS DISTINCT FROM a.id::text
    OR proof->>'adapterKey' IS DISTINCT FROM a.adapter_key OR proof->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR proof->>'normalizerVersion' IS DISTINCT FROM a.normalizer_version
    OR (proof->>'fetchedAt')::timestamptz>pg_catalog.clock_timestamp()
   THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  END LOOP;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,'[]'::jsonb)) LOOP
   IF r->'metadata'='null'::jsonb THEN CONTINUE; END IF;
   IF (r#>>'{metadata,fetchedAt}')::timestamptz IS DISTINCT FROM fetched
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END LOOP;
  FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(companions) LOOP
   IF rows IS NULL AND pg_catalog.jsonb_array_length(companions)>1
   THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
   IF rows IS NULL THEN proof:=m;
   ELSE SELECT value->'metadata' INTO proof FROM pg_catalog.jsonb_array_elements(rows)
    WHERE value->>'optionId'=companion->>'optionId'; END IF;
   IF proof IS NULL OR NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(companion,proof,
    CASE WHEN rows IS NULL THEN NULL ELSE (companion->>'optionId')::uuid END),false)
    OR (rows IS NOT NULL AND (companion->>'optionId')::uuid=ANY(seen))
   THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
   seen:=pg_catalog.array_append(seen,(companion->>'optionId')::uuid);
   INSERT INTO marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,candidate_id,store_id,session_id,
    provider_record_id,option_id,payload_version,metadata_digest,companion)
   VALUES(l.id,a.id,c.id,c.store_id,c.session_id,companion->>'providerRecordId',(companion->>'optionId')::uuid,
    companion->>'version',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(proof::text,'UTF8')),'hex'),companion);
  END LOOP;
  IF rows IS NOT NULL AND m IS NOT NULL AND NOT selected_id=ANY(seen)
  THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
  INSERT INTO marketplace_sec.phase9_catalogue_lookup_effects(lookup_id,candidate_id,store_id,session_id,
   request_generation,completion_digest,canonical_results,completion_response)
  VALUES(l.id,c.id,c.store_id,c.session_id,(f->>'requestGeneration')::integer,digest,'[]','{}');
  -- Complete bounded plan before acquiring any canonical identity lock.
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,CASE WHEN m IS NOT NULL THEN
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,'eligibility','eligible','metadata',m)) ELSE '[]'::jsonb END)) LOOP
   IF (policy->>'sharedAdmitted')::boolean AND r->>'eligibility'='eligible' THEN
    SELECT value INTO cm FROM pg_catalog.jsonb_array_elements(companions)
     WHERE value->'optionId' IS NOT DISTINCT FROM r->'optionId';
    -- Explicit eligibility stays authoritative; automatic query is independently derived.
    IF marketplace_sec.phase9_edition_option_eligible(r->'metadata',marketplace_sec.phase9_edition_query_identity(c)) THEN
     keys:=keys||marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',cm);
    END IF;
   END IF;
  END LOOP;
  FOR key IN SELECT DISTINCT k FROM pg_catalog.unnest(keys) k ORDER BY k LOOP
   PERFORM pg_catalog.pg_advisory_xact_lock(key);
  END LOOP;
  IF j.lease_expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
  THEN RAISE SQLSTATE 'P9A01'; END IF;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,CASE WHEN m IS NOT NULL THEN
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,'eligibility','eligible','metadata',m)) ELSE '[]'::jsonb END)) LOOP
   IF NOT (policy->>'sharedAdmitted')::boolean OR r->>'eligibility'<>'eligible'
    OR NOT marketplace_sec.phase9_edition_option_eligible(r->'metadata',marketplace_sec.phase9_edition_query_identity(c)) THEN CONTINUE; END IF;
   SELECT value INTO cm FROM pg_catalog.jsonb_array_elements(companions)
    WHERE value->'optionId' IS NOT DISTINCT FROM r->'optionId';
   next_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',cm);
   IF NOT next_keys<@keys THEN CONTINUE; END IF;
   SELECT * INTO pair FROM marketplace_sec.phase9_catalogue_resolve_v1(r->'metadata',cm,policy);
   v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'optionId',r->'optionId','canonicalWorkId',pair.canonical_work_id,'canonicalEditionId',pair.canonical_edition_id));
  END LOOP;
  -- Preserve every original position, including an explicit skipped pair.
  IF rows IS NOT NULL THEN
   SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('optionId',original->'optionId',
    'canonicalWorkId',hit->'canonicalWorkId','canonicalEditionId',hit->'canonicalEditionId')
    ORDER BY (original->>'ordinal')::integer),'[]'::jsonb) INTO v_results
   FROM pg_catalog.jsonb_array_elements(rows) original LEFT JOIN LATERAL (
    SELECT value AS hit FROM pg_catalog.jsonb_array_elements(v_results)
    WHERE value->'optionId'=original->'optionId') resolved ON true;
  END IF;
  SELECT (value->>'canonicalWorkId')::uuid,(value->>'canonicalEditionId')::uuid
   INTO selected_work,selected_edition FROM pg_catalog.jsonb_array_elements(v_results)
   WHERE m IS NOT NULL AND value->>'optionId' IS NOT DISTINCT FROM selected_id::text;
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET canonical_results=v_results
   WHERE lookup_id=l.id;
  UPDATE public.metadata_enrichment_attempts SET disposition=CASE WHEN m IS NULL THEN 'rejected' ELSE 'accepted' END,
    -- 02c §§4.2/4.3: accepted attempts use the canonical outcome consumed by
    -- the existing representative-cover writer; physical receipts stay intact.
    normalized_outcome=CASE WHEN m IS NOT NULL THEN summary ELSE o->>'outcome' END,
    normalized_payload=m,provider_request_id=pc.provider_request_id,
   status='completed',completed_at=pg_catalog.transaction_timestamp() WHERE id=a.id;
  UPDATE public.phase9_usage_reservations SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0),
   updated_at=pg_catalog.transaction_timestamp() WHERE id=a.usage_reservation_id;
  IF o->'representativeCover'<>'null'::jsonb THEN
   proof:=o->'representativeCover';
   IF m IS NULL OR m->>'coverReference' IS NOT NULL OR pg_catalog.jsonb_typeof(proof)<>'object'
    OR NOT proof ?& ARRAY['coverReference','sourceRelation','sourceProviderRecordId','selectionPolicyVersion','matchEvidence']
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(proof))<>5 OR NOT EXISTS(
     SELECT 1 FROM pg_catalog.jsonb_array_elements(o->'candidates') source
     WHERE source->>'providerRecordId'=proof->>'sourceProviderRecordId'
      AND source->>'providerRecordId'<>m->>'providerRecordId' AND source->'coverReference'=proof->'coverReference'
      AND marketplace_sec.phase9_metadata_normalized_text(source->>'title')=marketplace_sec.phase9_metadata_normalized_text(m->>'title')
      AND pg_catalog.split_part(pg_catalog.lower(source->>'language'),'-',1)=pg_catalog.split_part(pg_catalog.lower(m->>'language'),'-',1)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['subtitle','series','volume']) field
       WHERE source->>field IS NOT NULL AND m->>field IS NOT NULL
        AND marketplace_sec.phase9_metadata_normalized_text(source->>field)<>marketplace_sec.phase9_metadata_normalized_text(m->>field))
      AND marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(source->'authors')))
       =marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors'))))
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
   PERFORM marketplace_sec.phase9_store_metadata_representative_cover_v1(a.id,l.id,j.id,f->>'worker',
    f->>'leaseToken',(f->>'claimAttempt')::integer,c.id,c.version,proof->>'coverReference',
    proof->>'sourceProviderRecordId',proof->>'sourceRelation',proof->>'selectionPolicyVersion',proof->'matchEvidence');
  END IF;
 END IF;
 -- Late stale refusal rolls back private and shared writes in this block too.
 IF j.lease_expires_at<=pg_catalog.clock_timestamp() OR sess.expires_at<=pg_catalog.clock_timestamp()
  OR c.expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
 THEN RAISE SQLSTATE 'P9A01'; END IF;
 -- 02d alone owns alternatives publication. Preserve selected bytes and binding.
 INSERT INTO public.phase9_selected_metadata_snapshots(candidate_id,store_id,lookup_id,canonical_edition_id,selected_attempt_id,
  outcome_source_attempt_id,snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)
 VALUES(c.id,c.store_id,l.id,selected_edition,CASE WHEN m IS NOT NULL THEN a.id END,a.id,
  'p9-selected-v1','p9-metadata-selection-v1',m,o->'evidence',summary) RETURNING id INTO v_snapshot_id;
 UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=v_snapshot_id,
  canonical_edition_id=selected_edition,
  metadata_attempt_id=CASE WHEN m IS NOT NULL THEN a.id END,
  state=CASE WHEN m IS NOT NULL THEN 'ready' ELSE 'needs_review' END,updated_at=pg_catalog.transaction_timestamp() WHERE id=c.id;
 UPDATE public.phase9_metadata_lookups SET normalized_outcome=summary,outcome_source_attempt_id=a.id,canonical_edition_id=selected_edition,
  reuse_source_attempt_id=CASE WHEN m IS NOT NULL THEN a.id END,completed_at=pg_catalog.transaction_timestamp() WHERE id=l.id;
 response:=pg_catalog.jsonb_build_object('version','p9-auto-completion-v1','status','completed',
  'lookupId',l.id,'snapshotId',v_snapshot_id,'outcome',summary,'selectedOptionId',selected_id,
  'prefill',pg_catalog.jsonb_build_object('status','skipped','reason','not_installed'));
 INSERT INTO marketplace_sec.phase9_automatic_completion_effects(lookup_id,job_id,candidate_id,store_id,session_id,
  candidate_version,query_identity,claim_worker,claim_lease_token_hash,claim_attempt_number,request_generation,
  captured_request_id,selected_option_id,snapshot_id,completion_digest,receipt)
 VALUES(l.id,j.id,c.id,c.store_id,c.session_id,(f->>'candidateVersion')::integer,f->>'queryIdentity',f->>'worker',claim_hash,
  (f->>'claimAttempt')::integer,(f->>'requestGeneration')::integer,(f->>'capturedRequestId')::uuid,
  selected_id,v_snapshot_id,digest,response);
 IF a.id IS NOT NULL THEN
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET completion_response=response WHERE lookup_id=l.id;
  IF selected_work IS NOT NULL THEN PERFORM marketplace_sec.phase9_catalogue_count_search_v1(
   c.id,c.store_id,c.session_id,l.id,selected_work); END IF;
 END IF;
 UPDATE public.image_extraction_jobs SET status=CASE WHEN summary='technical_failure' THEN 'dead_letter' ELSE 'resolved' END,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,completed_at=pg_catalog.transaction_timestamp(),
   -- 02c §4.3 / M32 terminal semantics: record failure evidence and clear old retries on success.
   dead_lettered_at=CASE WHEN summary='technical_failure' THEN pg_catalog.transaction_timestamp() END,
   last_safe_error_code=CASE WHEN summary='technical_failure' THEN
      CASE WHEN j.attempt_count>=j.max_attempts THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'
       ELSE 'P9_METADATA_TECHNICAL_FAILURE' END
     WHEN summary='accepted_metadata_match' THEN NULL ELSE pg_catalog.upper('P9_METADATA_'||summary) END,
   last_safe_error_category=CASE WHEN summary<>'accepted_metadata_match' THEN 'metadata' END,
  updated_at=pg_catalog.transaction_timestamp() WHERE id=j.id;
 RETURN response;
EXCEPTION WHEN SQLSTATE 'P9A01' THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected');
 WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow
 OR numeric_value_out_of_range THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID';
END$$;

-- Service wrappers are invokers; private delegated entries alone are definers.
CREATE FUNCTION public.phase9_reserve_metadata_provider_round_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_reserve_metadata_provider_round_v1(f,p_key,p_version)
$$;
CREATE FUNCTION public.phase9_release_metadata_provider_round_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_release_metadata_provider_round_v1(f,p_key,p_version)
$$;
CREATE FUNCTION public.phase9_schedule_automatic_provider_recheck_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_schedule_automatic_provider_recheck_v1(f,p_key,p_version)
$$;
-- Newly introduced delegates are postgres-only unless explicitly exposed below.
DO $$DECLARE fn regprocedure; BEGIN
 FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='marketplace_sec' AND p.proname IN
    ('phase9_reserved_store_holds_v1','phase9_reserved_store_slots_v1','phase9_reserve_round_capacity_v1',
     'phase9_run_receipt_digest_v1',
    'phase9_release_closed_admission_v1','phase9_admission_scope_current_v1',
    'phase9_capacity_configuration_valid_v1','phase9_wake_store_admission_v1',
    'phase9_automatic_terminal_run_v1','phase9_reserve_metadata_provider_round_v1',
    'phase9_release_metadata_provider_round_v1','phase9_schedule_automatic_provider_recheck_v1',
    'phase9_register_metadata_provider_call_pre_queue_v1','phase9_register_edition_options_provider_call_pre_queue_v1')
 LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',fn);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',fn);
 END LOOP;
END$$;
ALTER FUNCTION public.phase9_reserve_metadata_provider_round_v1(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_release_metadata_provider_round_v1(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_schedule_automatic_provider_recheck_v1(jsonb,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_reserve_metadata_provider_round_v1(jsonb,text,text),
 public.phase9_release_metadata_provider_round_v1(jsonb,text,text),
 public.phase9_schedule_automatic_provider_recheck_v1(jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_reserve_metadata_provider_round_v1(jsonb,text,text),
 marketplace_sec.phase9_release_metadata_provider_round_v1(jsonb,text,text),
 marketplace_sec.phase9_schedule_automatic_provider_recheck_v1(jsonb,text,text),
 public.phase9_reserve_metadata_provider_round_v1(jsonb,text,text),
 public.phase9_release_metadata_provider_round_v1(jsonb,text,text),
 public.phase9_schedule_automatic_provider_recheck_v1(jsonb,text,text) TO service_role;
CREATE FUNCTION public.phase9_claim_metadata_jobs_v2(p_batch_size integer,p_worker text)
RETURNS TABLE(id uuid,attempt_count integer,lease_token text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM marketplace_sec.phase9_claim_metadata_jobs_v2(p_batch_size,p_worker)
$$;
CREATE FUNCTION public.phase9_defer_metadata_admission_v1(f jsonb,p_epoch bigint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_defer_metadata_admission_v1(f,p_epoch)
$$;
CREATE FUNCTION public.phase9_begin_automatic_provider_run_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_begin_automatic_provider_run_v1(f,p_key,p_version)
$$;
CREATE FUNCTION public.phase9_finish_automatic_provider_run_v1(f jsonb,p_key text,p_version text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_finish_automatic_provider_run_v1(f,p_key,p_version)
$$;
CREATE FUNCTION public.phase9_finish_automatic_provider_run_v1(f jsonb,p_key text,p_version text,p_not_before timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_finish_automatic_provider_run_v1(f,p_key,p_version,p_not_before)
$$;
ALTER FUNCTION marketplace_sec.phase9_admission_fence_v1(jsonb,boolean) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_provider_run_grant_v1() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_seed_store_admission_v1() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_run_fence_digest_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_admission_fence_v1(jsonb,boolean),
 marketplace_sec.phase9_provider_run_grant_v1(),marketplace_sec.phase9_seed_store_admission_v1(),
 marketplace_sec.phase9_run_fence_digest_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz),
 public.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz),
 public.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz) TO service_role;
ALTER FUNCTION marketplace_sec.phase9_claim_metadata_jobs_v2(integer,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_defer_metadata_admission_v1(jsonb,bigint) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_begin_automatic_provider_run_v1(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_claim_metadata_jobs_v2(integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_defer_metadata_admission_v1(jsonb,bigint) OWNER TO postgres;
ALTER FUNCTION public.phase9_begin_automatic_provider_run_v1(jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_finish_automatic_provider_run_v1(jsonb,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_claim_metadata_jobs_v2(integer,text),
 marketplace_sec.phase9_defer_metadata_admission_v1(jsonb,bigint),
 marketplace_sec.phase9_begin_automatic_provider_run_v1(jsonb,text,text),
 marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text),
 public.phase9_claim_metadata_jobs_v2(integer,text),public.phase9_defer_metadata_admission_v1(jsonb,bigint),
 public.phase9_begin_automatic_provider_run_v1(jsonb,text,text),public.phase9_finish_automatic_provider_run_v1(jsonb,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_claim_metadata_jobs_v2(integer,text),
 marketplace_sec.phase9_defer_metadata_admission_v1(jsonb,bigint),
 marketplace_sec.phase9_begin_automatic_provider_run_v1(jsonb,text,text),
 marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text),
 public.phase9_claim_metadata_jobs_v2(integer,text),public.phase9_defer_metadata_admission_v1(jsonb,bigint),
 public.phase9_begin_automatic_provider_run_v1(jsonb,text,text),public.phase9_finish_automatic_provider_run_v1(jsonb,text,text)
 TO service_role;
COMMIT;
