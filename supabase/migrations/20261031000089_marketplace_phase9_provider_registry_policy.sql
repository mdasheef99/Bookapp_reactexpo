-- Phase 9 / slice 8a-1: 02c §§3.1,4.1,4.2,4.4,8,9,11.1.
-- Creation only. Forward from M88; no provider activation or 8a-2+ dependency.
BEGIN;

-- 02c §3.1: unconfigured rows acquire no new permission or route.
ALTER TABLE public.phase9_provider_registry
 ADD COLUMN automatic_lookup_allowed boolean NOT NULL DEFAULT false,
 ADD COLUMN explicit_search_allowed boolean NOT NULL DEFAULT false,
 ADD COLUMN shared_catalogue_allowed boolean NOT NULL DEFAULT false,
 ADD COLUMN automatic_role text,
 ADD COLUMN explicit_role text,
 ADD COLUMN automatic_order smallint,
 ADD COLUMN explicit_order smallint,
 ADD COLUMN accepted_adapter_versions text[] NOT NULL DEFAULT '{}',
 ADD COLUMN version_contracts jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN validation_contract text,
 ADD COLUMN host_policy_version text,
 ADD COLUMN approved_request_hosts text[] NOT NULL DEFAULT '{}',
 ADD COLUMN approved_book_hosts text[] NOT NULL DEFAULT '{}',
 ADD COLUMN approved_cover_hosts text[] NOT NULL DEFAULT '{}',
 ADD COLUMN options_retention_seconds integer,
 ADD COLUMN display_label text,
 ADD COLUMN protection_policy jsonb;

-- 02c §3.1: role is the nullable primary/secondary enum, order is 1/2, and
-- both are null together. The permission/purpose link stays in the validator
-- boundary (§4.2: purpose policy is never read from a CHECK).
ALTER TABLE public.phase9_provider_registry
 ADD CONSTRAINT phase9_provider_automatic_role_order_v1 CHECK (
  (automatic_role IS NULL)=(automatic_order IS NULL)
  AND (automatic_role IS NULL OR (automatic_role='primary' AND automatic_order=1)
   OR (automatic_role='secondary' AND automatic_order=2))),
 ADD CONSTRAINT phase9_provider_explicit_role_order_v1 CHECK (
  (explicit_role IS NULL)=(explicit_order IS NULL)
  AND (explicit_role IS NULL OR (explicit_role='primary' AND explicit_order=1)
   OR (explicit_role='secondary' AND explicit_order=2)));

-- 02c §§3.1/4.1: one pure validator for writes AND the distrustful service read.
-- Invalid rows use the documented P0001/P9_PROVIDER_CONFIGURATION_INVALID
-- boundary below; no installed-validator/host/retention permission is inferred.
CREATE FUNCTION marketplace_sec.phase9_provider_configuration_valid_v1(r public.phase9_provider_registry)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE
 purpose text; allowed boolean; role_name text; route_order smallint;
 versions text[]; hosts text[]; tuple record; key text; protection jsonb; n numeric;
 contract_keys constant text[] := ARRAY['validationContract','hostPolicyVersion','capabilityVersion',
  'normalizerVersion','payloadSchemaVersion','lookupSchemaVersion'];
 protection_keys constant text[] := ARRAY['version','minIntervalMs','storeWindowSeconds','storeMaxGets',
  'backoffBaseMs','backoffMaxMs','breakerFailures','breakerWindowSeconds','breakerCooldownMs',
  'halfOpenMax','mode','contactId'];
BEGIN
 IF r.automatic_lookup_allowed IS NULL OR r.explicit_search_allowed IS NULL
  OR r.shared_catalogue_allowed IS NULL THEN RETURN false; END IF;
 FOREACH purpose IN ARRAY ARRAY['automatic','explicit'] LOOP
  allowed := CASE purpose WHEN 'automatic' THEN r.automatic_lookup_allowed ELSE r.explicit_search_allowed END;
  role_name := CASE purpose WHEN 'automatic' THEN r.automatic_role ELSE r.explicit_role END;
  route_order := CASE purpose WHEN 'automatic' THEN r.automatic_order ELSE r.explicit_order END;
  IF (role_name IS NULL) <> (route_order IS NULL)
   OR (NOT allowed AND role_name IS NOT NULL)
   OR (role_name IS NOT NULL AND (role_name NOT IN ('primary','secondary')
    OR route_order IS DISTINCT FROM CASE role_name WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 END))
   THEN RETURN false; END IF;
 END LOOP;
 versions := r.accepted_adapter_versions;
 IF versions IS NULL OR pg_catalog.cardinality(versions)>8
  OR coalesce(pg_catalog.array_ndims(versions),1)<>1
  OR (SELECT count(DISTINCT v) FROM pg_catalog.unnest(versions) v)<>pg_catalog.cardinality(versions)
  OR EXISTS(SELECT 1 FROM pg_catalog.unnest(versions) v WHERE v COLLATE "C" !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$')
  OR pg_catalog.jsonb_typeof(r.version_contracts) IS DISTINCT FROM 'object'
  THEN RETURN false; END IF;
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(r.version_contracts))<>pg_catalog.cardinality(versions)
  THEN RETURN false; END IF;
 FOR tuple IN SELECT * FROM pg_catalog.jsonb_each(r.version_contracts) LOOP
  IF NOT (tuple.key=ANY(versions)) OR pg_catalog.jsonb_typeof(tuple.value) IS DISTINCT FROM 'object'
   OR NOT (tuple.value ?& contract_keys) OR tuple.value-contract_keys<>'{}'::jsonb
   THEN RETURN false; END IF;
  FOREACH key IN ARRAY contract_keys LOOP
   IF pg_catalog.jsonb_typeof(tuple.value->key) IS DISTINCT FROM 'string'
    OR (tuple.value->>key) COLLATE "C" !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'
    THEN RETURN false; END IF;
  END LOOP;
 END LOOP;
 IF pg_catalog.cardinality(versions)=0 THEN
  IF r.automatic_lookup_allowed OR r.explicit_search_allowed OR r.shared_catalogue_allowed
   OR r.validation_contract IS NOT NULL OR r.host_policy_version IS NOT NULL
   OR pg_catalog.cardinality(r.approved_request_hosts)>0
   OR pg_catalog.cardinality(r.approved_book_hosts)>0
   OR pg_catalog.cardinality(r.approved_cover_hosts)>0 THEN RETURN false; END IF;
 ELSE
  IF NOT coalesce(r.adapter_version=ANY(versions),false)
   OR r.validation_contract IS DISTINCT FROM r.version_contracts->r.adapter_version->>'validationContract'
   OR r.host_policy_version IS DISTINCT FROM r.version_contracts->r.adapter_version->>'hostPolicyVersion'
   THEN RETURN false; END IF;
 END IF;
 FOREACH purpose IN ARRAY ARRAY['request','book','cover'] LOOP
  hosts := CASE purpose WHEN 'request' THEN r.approved_request_hosts
   WHEN 'book' THEN r.approved_book_hosts ELSE r.approved_cover_hosts END;
  IF hosts IS NULL OR pg_catalog.cardinality(hosts)>8 OR coalesce(pg_catalog.array_ndims(hosts),1)<>1
   OR (SELECT count(DISTINCT h) FROM pg_catalog.unnest(hosts) h)<>pg_catalog.cardinality(hosts)
   OR EXISTS(SELECT 1 FROM pg_catalog.unnest(hosts) h WHERE pg_catalog.length(h)>253
    OR h COLLATE "C" !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    OR h COLLATE "C" ~ '^[0-9.]+$') THEN RETURN false; END IF;
 END LOOP;
 IF r.options_retention_seconds IS NOT NULL AND r.options_retention_seconds NOT BETWEEN 1 AND 86400
  THEN RETURN false; END IF;
 IF r.display_label IS NOT NULL AND (pg_catalog.length(r.display_label) NOT BETWEEN 1 AND 80
  OR pg_catalog.btrim(r.display_label)='' OR r.display_label ~ '[[:cntrl:]<>\\]'
  OR r.display_label ~ U&'[\007F-\009F]') THEN RETURN false; END IF;
 protection := r.protection_policy;
 IF protection IS NOT NULL THEN
  IF pg_catalog.jsonb_typeof(protection) IS DISTINCT FROM 'object'
   OR NOT (protection ?& protection_keys) OR protection-protection_keys<>'{}'::jsonb
   OR protection->>'version' IS DISTINCT FROM 'p9-protection-v1'
   OR protection->>'mode' NOT IN ('single_instance','shared_db')
   OR pg_catalog.jsonb_typeof(protection->'mode') IS DISTINCT FROM 'string'
   OR pg_catalog.jsonb_typeof(protection->'contactId') IS DISTINCT FROM 'string'
   OR (protection->>'contactId') COLLATE "C" !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$'
   THEN RETURN false; END IF;
  FOREACH key IN ARRAY ARRAY['minIntervalMs','storeWindowSeconds','storeMaxGets','backoffBaseMs',
   'backoffMaxMs','breakerFailures','breakerWindowSeconds','breakerCooldownMs','halfOpenMax'] LOOP
   IF pg_catalog.jsonb_typeof(protection->key) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
   n := (protection->>key)::numeric;
   IF n<1 OR n>2147483647 OR n<>pg_catalog.trunc(n) THEN RETURN false; END IF;
  END LOOP;
  IF (protection->>'halfOpenMax')::numeric<>1
   OR (protection->>'backoffBaseMs')::numeric>(protection->>'backoffMaxMs')::numeric THEN RETURN false; END IF;
 END IF;
 RETURN true;
END$$;
ALTER FUNCTION marketplace_sec.phase9_provider_configuration_valid_v1(public.phase9_provider_registry) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_configuration_valid_v1(public.phase9_provider_registry) FROM PUBLIC,anon,authenticated,service_role;

-- 02c §§3.1/4.1: route ambiguity is a distinct documented refusal, never a
-- partially returned configuration. Neither helper reads credentials or vault.
CREATE FUNCTION marketplace_sec.phase9_provider_configuration_assert_v1()
RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.phase9_provider_registry r
  WHERE NOT marketplace_sec.phase9_provider_configuration_valid_v1(r)) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='P9_PROVIDER_CONFIGURATION_INVALID';
 END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_provider_registry r
   WHERE r.enabled AND r.matching_allowed AND r.storage_allowed AND r.automatic_lookup_allowed
    AND r.automatic_role IS NOT NULL GROUP BY r.automatic_role HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM public.phase9_provider_registry r
   WHERE r.enabled AND r.matching_allowed AND r.storage_allowed AND r.explicit_search_allowed
    AND r.explicit_role IS NOT NULL GROUP BY r.explicit_role HAVING count(*)>1) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='P9_PROVIDER_ROUTE_INVALID';
 END IF;
END$$;
ALTER FUNCTION marketplace_sec.phase9_provider_configuration_assert_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_configuration_assert_v1() FROM PUBLIC,anon,authenticated,service_role;

-- 02c §3.1: serialize registry configuration statements before tuple locks.
-- Row checks give duplicate routes the documented domain error; unique indexes
-- additionally backstop concurrent transactions with an older MVCC snapshot.
CREATE FUNCTION marketplace_sec.phase9_provider_registry_guard_v1()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_LEVEL='ROW' THEN
  IF NOT marketplace_sec.phase9_provider_configuration_valid_v1(NEW) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='P9_PROVIDER_CONFIGURATION_INVALID';
  END IF;
  IF NEW.enabled AND NEW.matching_allowed AND NEW.storage_allowed AND EXISTS(
   SELECT 1 FROM public.phase9_provider_registry r
   WHERE r.adapter_key IS DISTINCT FROM CASE WHEN TG_OP='UPDATE' THEN OLD.adapter_key ELSE NEW.adapter_key END
    AND r.enabled AND r.matching_allowed AND r.storage_allowed
    AND ((NEW.automatic_lookup_allowed AND r.automatic_lookup_allowed AND r.automatic_role=NEW.automatic_role)
     OR (NEW.explicit_search_allowed AND r.explicit_search_allowed AND r.explicit_role=NEW.explicit_role))) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='P9_PROVIDER_ROUTE_INVALID';
  END IF;
  RETURN NEW;
 ELSIF TG_WHEN='BEFORE' THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(90891001);
 ELSE
  PERFORM marketplace_sec.phase9_provider_configuration_assert_v1();
 END IF;
 RETURN NULL;
END$$;
ALTER FUNCTION marketplace_sec.phase9_provider_registry_guard_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_registry_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER phase9_provider_registry_serialize_v1 BEFORE INSERT OR UPDATE OR DELETE
 ON public.phase9_provider_registry FOR EACH STATEMENT EXECUTE FUNCTION marketplace_sec.phase9_provider_registry_guard_v1();
CREATE TRIGGER phase9_provider_registry_validate_v1 AFTER INSERT OR UPDATE OR DELETE
 ON public.phase9_provider_registry FOR EACH STATEMENT EXECUTE FUNCTION marketplace_sec.phase9_provider_registry_guard_v1();
CREATE TRIGGER phase9_provider_registry_row_v1 BEFORE INSERT OR UPDATE
 ON public.phase9_provider_registry FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_provider_registry_guard_v1();
CREATE UNIQUE INDEX phase9_provider_automatic_role_v1 ON public.phase9_provider_registry(automatic_role)
 WHERE enabled AND matching_allowed AND storage_allowed AND automatic_lookup_allowed;
CREATE UNIQUE INDEX phase9_provider_explicit_role_v1 ON public.phase9_provider_registry(explicit_role)
 WHERE enabled AND matching_allowed AND storage_allowed AND explicit_search_allowed;

-- 02c §4.1: verify the recorded preflight tuple, then populate NEW fields only.
-- G is the installed Google descriptor's actual 1.0.0; never fabricate it from
-- M01's data-derived seed or change an existing flag/version/timestamp/note.
DO $$
BEGIN
 IF (SELECT count(*) FROM public.phase9_provider_registry
  WHERE adapter_key IN ('google_books','open_library') AND provider_kind='metadata'
   AND adapter_version='1.0.0')<>2 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='P9_PROVIDER_CONFIGURATION_INVALID';
 END IF;
END$$;
UPDATE public.phase9_provider_registry
 SET automatic_lookup_allowed=(adapter_key='google_books'),
  explicit_search_allowed=(adapter_key='open_library'),
  shared_catalogue_allowed=(adapter_key='open_library'),
  automatic_role=CASE WHEN adapter_key='google_books' THEN 'primary' END,
  explicit_role=CASE WHEN adapter_key='open_library' THEN 'primary' END,
  automatic_order=CASE WHEN adapter_key='google_books' THEN 1 END,
  explicit_order=CASE WHEN adapter_key='open_library' THEN 1 END,
  accepted_adapter_versions=ARRAY[adapter_version],
  version_contracts=pg_catalog.jsonb_build_object(adapter_version,pg_catalog.jsonb_build_object(
   'validationContract',CASE adapter_key WHEN 'google_books' THEN 'google-books-v1' ELSE 'open-library-v1' END,
   'hostPolicyVersion',CASE adapter_key WHEN 'google_books' THEN 'google-books-hosts-v1' ELSE 'open-library-hosts-v1' END,
   'capabilityVersion',CASE adapter_key WHEN 'google_books' THEN 'google-books-capability-v1' ELSE 'open-library-capability-v1' END,
   'normalizerVersion','p9-bibliographic-normalizer-v1',
   'payloadSchemaVersion','p9-metadata-v1','lookupSchemaVersion','p9-metadata-foundation-v1')),
  validation_contract=CASE adapter_key WHEN 'google_books' THEN 'google-books-v1' ELSE 'open-library-v1' END,
  host_policy_version=CASE adapter_key WHEN 'google_books' THEN 'google-books-hosts-v1' ELSE 'open-library-hosts-v1' END,
  approved_request_hosts=ARRAY[CASE adapter_key WHEN 'google_books' THEN 'www.googleapis.com' ELSE 'openlibrary.org' END],
  approved_book_hosts=ARRAY[CASE adapter_key WHEN 'google_books' THEN 'books.google.com' ELSE 'openlibrary.org' END],
  approved_cover_hosts=ARRAY[CASE adapter_key WHEN 'google_books' THEN 'books.google.com' ELSE 'covers.openlibrary.org' END],
  -- 02c §4.1: options bound 86400 only when independently verified; §2.1/§2.2
  -- (M65:91–122) records the OL explicit choice state deadline as ≤24h, so
  -- 86400 is the verified bound. No new verifier is implied.
  options_retention_seconds=CASE WHEN adapter_key='open_library' THEN 86400 END,
  display_label=CASE adapter_key WHEN 'google_books' THEN 'Google Books' ELSE 'Open Library' END
 WHERE adapter_key IN ('google_books','open_library');

-- 02c §4.2 / AC8-12: independent code veto, separate from private facts validity.
CREATE FUNCTION marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(p_adapter_key text,p_adapter_version text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_adapter_key<>'google_books' AND pg_catalog.btrim(p_adapter_key)<>''
  AND pg_catalog.btrim(p_adapter_version)<>'',false)
$$;
ALTER FUNCTION marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;

-- 02c §§4.2/4.4: interim OL-only bodies; capability/profile generalization is
-- 8a-2. Preserve M83 signatures, SHARE lock and strict eight-key policy DTO.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(p_adapter_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key
  AND p_adapter_key IN('open_library') AND r.provider_kind='metadata'
  AND marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(r.adapter_key,r.adapter_version)
  AND r.enabled AND r.matching_allowed AND r.storage_allowed AND r.public_display_allowed
  AND r.adapter_version<>'' AND r.policy_version>0 AND r.raw_retention_seconds>=0
  AND (r.revalidation_seconds IS NULL OR r.revalidation_seconds>0)
  AND marketplace_sec.phase9_catalogue_safe_text_v1(r.shared_source_note,1024))
$$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(p_adapter_key text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.phase9_provider_registry;
BEGIN
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_adapter_key FOR SHARE;
 IF r.adapter_key IS NULL THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object('version','psr-catalogue-source-policy-v1',
  'adapterKey',r.adapter_key,'adapterVersion',r.adapter_version,'policyVersion',r.policy_version,
  'rawRetentionSeconds',r.raw_retention_seconds,'revalidationSeconds',r.revalidation_seconds,
  'sharedSourceNote',r.shared_source_note,'sharedAdmitted',
   marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(r.adapter_key,r.adapter_version)
   AND marketplace_sec.phase9_catalogue_shared_admitted_v1(r.adapter_key));
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(text),
 marketplace_sec.phase9_catalogue_source_policy_v1(text) FROM PUBLIC,anon,authenticated,service_role;

-- 02c §4.1 configuration-read clarification: exact versioned, sorted, service
-- DTO; old worker contexts and their seven-key policies remain untouched.
-- Follow M13's invoker-wrapper/service-entry pattern: the entry can call the
-- postgres-only validators without granting service_role EXECUTE on helpers.
CREATE FUNCTION marketplace_sec.phase9_provider_configuration_read_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE providers jsonb;
BEGIN
 PERFORM marketplace_sec.phase9_provider_configuration_assert_v1();
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'adapterKey',r.adapter_key,'providerKind',r.provider_kind,'adapterVersion',r.adapter_version,
  'enabled',r.enabled,'matchingAllowed',r.matching_allowed,'storageAllowed',r.storage_allowed,
  'publicDisplayAllowed',r.public_display_allowed,'imageCacheAllowed',r.image_cache_allowed,
  'attributionRequired',r.attribution_required,'revalidationSeconds',r.revalidation_seconds,
  'rawRetentionSeconds',r.raw_retention_seconds,'policyVersion',r.policy_version,'sharedSourceNote',r.shared_source_note,
  'automaticLookupAllowed',r.automatic_lookup_allowed,'explicitSearchAllowed',r.explicit_search_allowed,
  'sharedCatalogueAllowed',r.shared_catalogue_allowed,'automaticRole',r.automatic_role,'explicitRole',r.explicit_role,
  'automaticOrder',r.automatic_order,'explicitOrder',r.explicit_order,'acceptedAdapterVersions',r.accepted_adapter_versions,
  'versionContracts',r.version_contracts,'validationContract',r.validation_contract,'hostPolicyVersion',r.host_policy_version,
  'approvedRequestHosts',r.approved_request_hosts,'approvedBookHosts',r.approved_book_hosts,'approvedCoverHosts',r.approved_cover_hosts,
  'optionsRetentionSeconds',r.options_retention_seconds,'displayLabel',r.display_label,'protectionPolicy',r.protection_policy
 ) ORDER BY r.adapter_key),'[]'::jsonb) INTO providers FROM public.phase9_provider_registry r;
 RETURN pg_catalog.jsonb_build_object('version','p9-provider-configuration-v1','providers',providers);
END$$;
ALTER FUNCTION marketplace_sec.phase9_provider_configuration_read_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_configuration_read_v1() FROM PUBLIC,anon,authenticated,service_role;
-- 02c §4.1 fixes the public entry as SECURITY INVOKER, so its delegated service
-- read needs EXECUTE for service_role. The postgres-only assert/valid helpers
-- stay revoked (§8); only this service read is delegated to the invoker wrapper.
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_provider_configuration_read_v1() TO service_role;

CREATE FUNCTION public.phase9_provider_configuration_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_provider_configuration_read_v1()
$$;
ALTER FUNCTION public.phase9_provider_configuration_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_provider_configuration_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_provider_configuration_v1() TO service_role;

SELECT marketplace_sec.phase9_provider_configuration_assert_v1();
COMMIT;
