-- Phase 2C: Platform review metadata
-- Adds explicit review fields used by the controlled store-review Edge
-- Function and Store Owner status surfaces.
BEGIN;

ALTER TABLE public.store_verification_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS required_follow_up JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS restriction_reason TEXT;

COMMENT ON COLUMN public.store_verification_requests.rejection_reason IS
  'Platform-visible rejection reason copied to Store Owner status after review.';

COMMENT ON COLUMN public.store_verification_requests.required_follow_up IS
  'Structured follow-up requested by platform reviewers before resubmission.';

COMMENT ON COLUMN public.stores.restriction_reason IS
  'Reason shown when platform restricts selling without fully suspending the store.';

COMMIT;
