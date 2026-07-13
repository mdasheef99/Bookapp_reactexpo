-- Phase 2B: Store application metadata
-- Keeps owner contact, support preference, PAN/GST readiness, and original
-- application choices on the verification request instead of trusting client
-- state or overloading privileged store status columns.
BEGIN;

ALTER TABLE public.store_verification_requests
  ADD COLUMN IF NOT EXISTS application_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.store_verification_requests.application_metadata IS
  'Store owner application metadata collected during Phase 2B onboarding; written only through service-role Edge Function paths.';

COMMIT;
