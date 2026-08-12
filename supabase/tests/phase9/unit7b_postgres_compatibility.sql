-- Disposable PostgreSQL-only stand-ins for Supabase platform extensions used
-- by the M36 dispatcher. Production remains backed by Vault, pg_net, and cron.
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE,
  decrypted_secret text, created_at timestamptz DEFAULT transaction_timestamp()
);
CREATE SCHEMA net;
CREATE TABLE net._http_response(
  id bigint PRIMARY KEY, status_code integer, timed_out boolean, error_msg text
);
CREATE FUNCTION net.http_post(
  url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE SCHEMA cron;
CREATE TABLE cron.job(
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, jobname text UNIQUE,
  schedule text, command text, database text, username text, active boolean DEFAULT true
);
CREATE FUNCTION cron.schedule(job_name text,schedule text,command text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO cron.job(jobname,schedule,command)
  VALUES(job_name,schedule,command) RETURNING jobid INTO v;
  RETURN v;
END $$;
CREATE FUNCTION cron.unschedule(job_name text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM cron.job WHERE jobname=cron.unschedule.job_name;
  RETURN true;
END $$;
CREATE FUNCTION cron.alter_job(
  job_id bigint,schedule text DEFAULT NULL,command text DEFAULT NULL,
  database text DEFAULT NULL,username text DEFAULT NULL,active boolean DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
  UPDATE cron.job SET active=coalesce(alter_job.active,cron.job.active)
  WHERE jobid=job_id
$$;

-- Phase 6 baseline compatibility columns supplied by the full production chain.
CREATE TABLE public.marketplace_localities(
  id uuid PRIMARY KEY,name text NOT NULL,is_pilot_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.store_subscriptions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid NOT NULL,
  status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE public.store_entitlements(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid NOT NULL,
  feature_key text NOT NULL,limit_value integer,is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE(store_id,feature_key)
);
CREATE TABLE public.marketplace_policy_config(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),policy_key text NOT NULL,
  scope_type text NOT NULL,scope_value text,store_id uuid,value jsonb NOT NULL,
  value_type text NOT NULL,policy_version integer NOT NULL,is_active boolean NOT NULL,
  effective_from timestamptz NOT NULL,effective_to timestamptz,
  normalized_scope_identity text
);
CREATE TABLE public.listing_moderation_flags(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_id uuid NOT NULL
    REFERENCES public.marketplace_book_listings(id),store_id uuid NOT NULL,
  flag_type text NOT NULL,status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
ALTER TABLE public.stores
  ADD COLUMN verification_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN city text,
  ADD COLUMN locality_id uuid REFERENCES public.marketplace_localities(id);
ALTER TABLE public.store_order_request_items
  ADD COLUMN listing_id uuid REFERENCES public.marketplace_book_listings(id);
