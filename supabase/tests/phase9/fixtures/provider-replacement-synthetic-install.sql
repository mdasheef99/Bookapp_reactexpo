-- TEST ONLY. Synthetic permission/data; never a production rights grant.
-- 02c §§3.1/4.2/5.1/9 AC8-9a/11 and §11.1: provider-owned installation only.
-- Companion contract: provider-replacement-synthetic.json. Requires 8a-2 only.
-- No registry rows, generic workflows, stage CHECKs, migrations or golden edits.
-- Physical registration/completion/cache proofs remain gated on 8a-3/4.
BEGIN;

DO $test_only$
BEGIN
 IF current_user <> 'postgres' OR NOT coalesce((
  (pg_catalog.version() LIKE '%(PGlite %' AND pg_catalog.inet_server_addr() IS NULL
   AND pg_catalog.current_database()='postgres')
  OR (pg_catalog.current_database() ~ '^bookconnect_u8b_[0-9]+$'
   AND pg_catalog.inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet))
 ),false) THEN
  RAISE EXCEPTION 'P9_TEST_ONLY_SYNTHETIC_INSTALL: disposable PGlite/native harness database required';
 END IF;
 IF pg_catalog.to_regprocedure('marketplace_sec.phase9_provider_validation_contract_v1(text,text)') IS NULL THEN
  RAISE EXCEPTION 'P9_TEST_ONLY_SYNTHETIC_INSTALL: package 8a-2 required';
 END IF;
END
$test_only$;

-- Pure own-record facts. Foreign hosts, IDs and versions never acquire rights.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_test_synthetic_facts_v1(
 p_record text,p_work text,p_book text,p_cover text)
RETURNS TABLE(valid boolean,cover_ref text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_record ~ '^ED-[1-9][0-9]*$'
  AND (p_work IS NULL OR p_work ~ '^WORK-[1-9][0-9]*$')
  AND (p_book IS NULL OR p_book='https://catalogue.example.test/books/'||p_record)
  AND (p_cover IS NULL OR p_cover ~ '^https://catalogue[.]example[.]test/covers/[1-9][0-9]*[.]jpg$'),false),
  pg_catalog.substring(p_cover,'/covers/([1-9][0-9]*)[.]jpg$')
$$;

-- Expose the synthetic protocol without changing any physical-call workflow.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_test_synthetic_stage_valid_v1(
 p_key text,p_version text,p_sequence integer,p_stage text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_key='synthetic_catalogue' AND p_version='1.0.0'
  AND ((p_sequence=0 AND p_stage='discover')
   OR (p_sequence=1 AND p_stage='edition:ED-42')
   OR (p_sequence=2 AND p_stage='person:AUTH-7')),false)
$$;

-- Explicit test clock and trusted source-policy input; no remote-header proof.
-- Its installed field profile declares the same retention bound for 8a-4.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_test_synthetic_retention_valid_v1(
 p_key text,p_version text,p_contract text,p_fetched_at timestamptz,
 p_deadline timestamptz,p_current_policy jsonb,p_now timestamptz)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RETURN coalesce(p_key='synthetic_catalogue' AND p_version='1.0.0'
  AND p_contract='synthetic-options-v1'
  AND p_current_policy->>'version'='psr-catalogue-source-policy-v1'
  AND p_current_policy->>'adapterKey'=p_key AND p_current_policy->>'adapterVersion'=p_version
  AND (p_current_policy->>'policyVersion')::integer>0
  AND (p_current_policy->>'revalidationSeconds')::integer>0
  AND pg_catalog.isfinite(p_now) AND pg_catalog.isfinite(p_fetched_at)
  AND pg_catalog.isfinite(p_deadline) AND p_fetched_at<=p_now AND p_deadline>p_now
  AND p_deadline>p_fetched_at
  AND p_deadline<=p_fetched_at+LEAST(3600,
   (p_current_policy->>'revalidationSeconds')::integer)*INTERVAL '1 second',false);
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_test_synthetic_field_profile_v1()
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT pg_catalog.jsonb_build_object('version','synthetic-retained-fields-v1',
  'adapterKey','synthetic_catalogue','adapterVersion','1.0.0',
  'purposeContracts',pg_catalog.jsonb_build_object('synthetic-catalogue-v1',
   pg_catalog.jsonb_build_object('automaticAllowed',true,'retentionContract','synthetic-options-v1')),
  'retentionContracts',pg_catalog.jsonb_build_object('synthetic-catalogue-v1',
   pg_catalog.jsonb_build_object('synthetic-options-v1',pg_catalog.jsonb_build_object('maxSeconds',3600))),
  'fields',
  pg_catalog.jsonb_object_agg(field,pg_catalog.jsonb_build_object(
   'matchingOnly',false,'storageAllowed',true,'publicDisplayAllowed',true,
   'imageCachingAllowed',false,'attributionRequired',true,'revalidationSeconds',3600,
   'authorityReference','Test-only synthetic facts; no production rights grant')))
 FROM pg_catalog.unnest(ARRAY['title','subtitle','authors','language','script',
  'publisher','publishedDate','editionStatement','series','volume','format','pageCount',
  'isbn10','isbn13','categories','description','coverReference','providerRecordId',
  'workExternalId','oclc','lccn']) AS fields(field)
$$;

-- Preserve the complete installed implementations as test-only delegates.
-- Only fixed provider dispatch boundaries gain a synthetic entry. Reinstallation
-- keeps the original delegates, so it cannot create recursive wrappers.
DO $delegates$
DECLARE f record; definition text;
BEGIN
 FOR f IN SELECT * FROM (VALUES
  ('phase9_provider_validation_contract_v1','phase9_test_original_validation_contract_v1','text,text'),
  ('phase9_provider_field_profile_v1','phase9_test_original_field_profile_v1','text,text'),
  ('phase9_provider_retained_fields_valid_v1','phase9_test_original_retained_fields_valid_v1','text,text,jsonb'),
  ('phase9_provider_facts_valid_v1','phase9_test_original_facts_valid_v1','text,text,text,text,text,text'),
  ('phase9_provider_call_contract_v1','phase9_test_original_call_contract_v1','text,text,jsonb')
 ) AS functions(name,delegate,arguments) LOOP
  IF pg_catalog.to_regprocedure('marketplace_sec.'||f.delegate||'('||f.arguments||')') IS NULL THEN
   definition:=pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
    'marketplace_sec.'||f.name||'('||f.arguments||')'));
   IF definition IS NULL THEN RAISE EXCEPTION 'Missing 8a-2 dispatcher: %',f.name; END IF;
   EXECUTE pg_catalog.replace(definition,'FUNCTION marketplace_sec.'||f.name||'(',
    'FUNCTION marketplace_sec.'||f.delegate||'(');
  END IF;
 END LOOP;
END
$delegates$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_validation_contract_v1(p_key text,p_version text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN p_key='synthetic_catalogue' AND p_version='1.0.0' THEN
  pg_catalog.jsonb_build_object('validationContract','synthetic-catalogue-v1',
   'hostPolicyVersion','synthetic-hosts-v1','capabilityVersion','synthetic-capability-v1',
   'normalizerVersion','p9-bibliographic-normalizer-v1',
   'payloadSchemaVersion','p9-metadata-v1','lookupSchemaVersion','p9-metadata-foundation-v1')
 ELSE marketplace_sec.phase9_test_original_validation_contract_v1(p_key,p_version) END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_field_profile_v1(p_key text,p_version text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN p_key='synthetic_catalogue' AND p_version='1.0.0'
  THEN marketplace_sec.phase9_test_synthetic_field_profile_v1()
 ELSE marketplace_sec.phase9_test_original_field_profile_v1(p_key,p_version) END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_retained_fields_valid_v1(
 p_key text,p_version text,p_metadata jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN p_key='synthetic_catalogue' AND p_version='1.0.0'
  THEN coalesce(pg_catalog.jsonb_typeof(p_metadata)='object',false)
 ELSE marketplace_sec.phase9_test_original_retained_fields_valid_v1(p_key,p_version,p_metadata) END
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_facts_valid_v1(
 p_key text,p_version text,p_record text,p_work text,p_book text,p_cover text)
RETURNS TABLE(valid boolean,cover_ref text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_key='synthetic_catalogue' AND p_version='1.0.0' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_test_synthetic_facts_v1(p_record,p_work,p_book,p_cover);
 ELSE RETURN QUERY SELECT * FROM marketplace_sec.phase9_test_original_facts_valid_v1(
  p_key,p_version,p_record,p_work,p_book,p_cover);
 END IF;
END$$;

-- 02c §§3.2/4.2/9: the fixture installs its own physical protocol into the
-- provider-owned dispatchers. Generic registration/completion/CHECKs stay frozen.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_test_synthetic_call_contract_v1(c jsonb)
RETURNS TABLE(valid boolean,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb; seen integer[]:=ARRAY[]::integer[]; sequence integer;
BEGIN
 valid:=false; logical_outcome:=NULL;
 IF NOT marketplace_sec.phase9_provider_call_shape_v1(c)
  OR pg_catalog.jsonb_array_length(c->'receipts')<>3 THEN RETURN NEXT; RETURN; END IF;
 FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(c->'receipts') LOOP
  IF pg_catalog.jsonb_typeof(r->'callSequence') IS DISTINCT FROM 'number'
   OR r->>'callSequence' !~ '^[0-2]$' THEN RETURN NEXT; RETURN; END IF;
  sequence:=(r->>'callSequence')::integer;
  IF sequence=ANY(seen) OR NOT marketplace_sec.phase9_test_synthetic_stage_valid_v1('synthetic_catalogue','1.0.0',sequence,r->>'callStage')
   OR r->>'status' IS DISTINCT FROM 'finalized' OR r->'egressStarted' IS DISTINCT FROM 'true'::jsonb
   OR r->'retryable' IS DISTINCT FROM 'false'::jsonb OR r->>'normalizedOutcome' IS DISTINCT FROM 'no_acceptable_match'
   OR r->'normalizedCandidate' IS DISTINCT FROM 'null'::jsonb OR r->'matchEvidence' IS DISTINCT FROM '[]'::jsonb
  THEN RETURN NEXT; RETURN; END IF;
  seen:=pg_catalog.array_append(seen,sequence);
 END LOOP;
 valid:=true;
 logical_outcome:=CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'rows') row
  WHERE row->>'eligibility'='eligible' AND row#>>'{metadata,matchRationale}'='exact_validated_isbn') THEN 'coherent_match'
 WHEN EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'rows') row
  WHERE row->>'eligibility'='eligible') THEN 'ambiguous_match' ELSE 'no_acceptable_match' END;
 RETURN NEXT;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_call_contract_v1(p_key text,p_version text,p_completion jsonb)
RETURNS TABLE(valid boolean,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_key='synthetic_catalogue' AND p_version='1.0.0' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_test_synthetic_call_contract_v1(p_completion);
 ELSE RETURN QUERY SELECT * FROM marketplace_sec.phase9_test_original_call_contract_v1(p_key,p_version,p_completion);
 END IF;
END$$;

-- The facts/profile installer remains usable at 8a-2. Extend the stage
-- dispatcher only if 8a-3 has installed it; no later production object is faked.
DO $stage_install$
DECLARE definition text;
BEGIN
 IF pg_catalog.to_regprocedure('marketplace_sec.phase9_provider_stage_valid_v1(text,text,integer,text,text)') IS NULL
 THEN RETURN; END IF;
 IF pg_catalog.to_regprocedure('marketplace_sec.phase9_test_original_stage_valid_v1(text,text,integer,text,text)') IS NULL THEN
  definition:=pg_catalog.pg_get_functiondef('marketplace_sec.phase9_provider_stage_valid_v1(text,text,integer,text,text)'::regprocedure);
  EXECUTE pg_catalog.replace(definition,'FUNCTION marketplace_sec.phase9_provider_stage_valid_v1(',
   'FUNCTION marketplace_sec.phase9_test_original_stage_valid_v1(');
 END IF;
 EXECUTE $install$
  CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_stage_valid_v1(
   p_key text,p_version text,p_sequence integer,p_stage text,p_query_kind text)
  RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $body$
   SELECT CASE WHEN p_key='synthetic_catalogue' AND p_version='1.0.0'
    THEN marketplace_sec.phase9_test_synthetic_stage_valid_v1(p_key,p_version,p_sequence,p_stage)
   ELSE marketplace_sec.phase9_test_original_stage_valid_v1(p_key,p_version,p_sequence,p_stage,p_query_kind) END
  $body$
 $install$;
END
$stage_install$;

-- 02c sections 3.2/4.3/5.1: purpose/retention declarations above are read by
-- the installed dispatchers. This installer replaces no M92 function.

-- The harness deliberately has hostile default grants. Restrict all fixture
-- functions and delegates, preserving the postgres-only production boundary.
DO $acl$
DECLARE signature text;
BEGIN
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND p.proname=ANY(ARRAY[
   'phase9_test_synthetic_facts_v1','phase9_test_synthetic_stage_valid_v1',
   'phase9_test_synthetic_retention_valid_v1','phase9_test_synthetic_field_profile_v1',
   'phase9_test_synthetic_call_contract_v1','phase9_test_original_call_contract_v1',
   'phase9_test_original_stage_valid_v1','phase9_provider_stage_valid_v1','phase9_provider_call_contract_v1',
   'phase9_test_original_validation_contract_v1','phase9_test_original_field_profile_v1',
   'phase9_test_original_retained_fields_valid_v1','phase9_test_original_facts_valid_v1',
   'phase9_provider_validation_contract_v1','phase9_provider_field_profile_v1',
   'phase9_provider_retained_fields_valid_v1','phase9_provider_facts_valid_v1']) LOOP
  EXECUTE 'ALTER FUNCTION '||signature||' OWNER TO postgres';
  EXECUTE 'REVOKE ALL ON FUNCTION '||signature||' FROM PUBLIC,anon,authenticated,service_role';
 END LOOP;
END
$acl$;
COMMIT;
