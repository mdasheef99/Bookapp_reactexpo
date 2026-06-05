-- Harden Exchange schema invariants that the client relies on.
-- This migration is intentionally idempotent around policy names because older
-- environments may have either the original policy or the documented tightened one.

-- Keep only one default address per user. If older data has multiple defaults,
-- preserve the newest default address and clear the rest before adding the index.
WITH ranked_defaults AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS default_rank
  FROM public.user_addresses
  WHERE is_default = true
)
UPDATE public.user_addresses AS address
SET is_default = false
FROM ranked_defaults
WHERE address.id = ranked_defaults.id
  AND ranked_defaults.default_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_per_user
  ON public.user_addresses(user_id)
  WHERE is_default = true;

-- Make address RLS checks explicit for each command.
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can create their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.user_addresses;

CREATE POLICY "Users can view their own addresses" ON public.user_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own addresses" ON public.user_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" ON public.user_addresses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" ON public.user_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Atomic default-address setter. This stays SECURITY INVOKER so normal RLS
-- applies; it simply groups the two updates into one transaction.
CREATE OR REPLACE FUNCTION public.set_default_user_address(
  p_user_id uuid,
  p_address_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot set another user''s default address'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_addresses
    WHERE id = p_address_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Address not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.user_addresses
  SET is_default = false
  WHERE user_id = p_user_id
    AND is_default = true
    AND id <> p_address_id;

  UPDATE public.user_addresses
  SET is_default = true
  WHERE id = p_address_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_user_address(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_user_address(uuid, uuid) TO authenticated;

-- The app and RPCs use "cancelled"; keep the table check in sync.
DO $$
DECLARE
  status_constraint_name text;
BEGIN
  SELECT conname
  INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
    AND pg_get_constraintdef(oid) ILIKE '%requested%'
    AND pg_get_constraintdef(oid) ILIKE '%disputed%'
  LIMIT 1;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.transactions DROP CONSTRAINT %I',
      status_constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN (
    'requested',
    'approved',
    'declined',
    'cancelled',
    'payment_pending',
    'ready_to_ship',
    'shipped',
    'delivered',
    'completed',
    'disputed'
  ));

-- All transaction state changes should go through controlled RPCs.
DROP POLICY IF EXISTS "Participants can update transaction status" ON public.transactions;
DROP POLICY IF EXISTS "Participants can update their transactions" ON public.transactions;
DROP POLICY IF EXISTS "No direct transaction updates" ON public.transactions;

CREATE POLICY "No direct transaction updates" ON public.transactions
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Transaction events live in public, so RLS must be enabled. Participants can
-- read their own event history; writes remain RPC/service-only by absence of
-- direct INSERT/UPDATE/DELETE policies.
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their transaction events" ON public.transaction_events;

CREATE POLICY "Participants can view their transaction events" ON public.transaction_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = transaction_events.transaction_id
        AND (
          transactions.lender_id = auth.uid()
          OR transactions.borrower_id = auth.uid()
        )
    )
  );
