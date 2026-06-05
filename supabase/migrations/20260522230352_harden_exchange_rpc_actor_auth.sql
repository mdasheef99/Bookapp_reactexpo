-- Harden Exchange RPC bodies against client-supplied actor/user id spoofing.
--
-- Phase 1 already tightened grants and pinned search_path. This migration keeps
-- the current business logic intact while making the user-facing RPCs verify
-- that the supplied user id matches auth.uid(). service_role remains allowed so
-- trusted edge functions and server jobs can continue to call these functions.

CREATE OR REPLACE FUNCTION public.request_transaction(
  p_listing_id uuid,
  p_borrower_id uuid,
  p_delivery_type text,
  p_message text DEFAULT NULL::text,
  p_shipping_address_id uuid DEFAULT NULL::uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_listing public.listings;
  v_balance public.user_credit_balances;
  v_txn public.transactions;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_borrower_id THEN
    RAISE EXCEPTION 'Borrower must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Step 1: Validate and lock the listing
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing % not found', p_listing_id;
  END IF;

  IF v_listing.status != 'active' THEN
    RAISE EXCEPTION 'Listing is not active (current status: %)', v_listing.status;
  END IF;

  -- Step 2: Validate borrower is not the lender
  IF v_listing.owner_id = p_borrower_id THEN
    RAISE EXCEPTION 'Cannot borrow your own listing';
  END IF;

  -- Step 3: Validate delivery type
  IF p_delivery_type NOT IN ('porter', 'dunzo', 'meetup') THEN
    RAISE EXCEPTION 'Invalid delivery type: %', p_delivery_type;
  END IF;

  -- Step 4: Lock and check borrower's credit balance
  SELECT * INTO v_balance FROM public.user_credit_balances
  WHERE user_id = p_borrower_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit balance found for borrower %', p_borrower_id;
  END IF;

  IF v_balance.available < 1 THEN
    RAISE EXCEPTION 'Insufficient credits: available=%, required=1', v_balance.available;
  END IF;

  -- Step 5: Create the transaction
  INSERT INTO public.transactions (
    listing_id, lender_id, borrower_id, status,
    delivery_type, message, shipping_address_id
  )
  VALUES (
    p_listing_id, v_listing.owner_id, p_borrower_id, 'requested',
    p_delivery_type, p_message, p_shipping_address_id
  )
  RETURNING * INTO v_txn;

  -- Step 6: Place credit hold on borrower (1 credit)
  INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (
    p_borrower_id,
    'hold_placed',
    1,
    v_txn.id,
    jsonb_build_object('listing_id', p_listing_id, 'requested_at', now()),
    'hold_placed_' || v_txn.id::text
  );

  -- Step 7: Record transaction event
  INSERT INTO public.transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (
    v_txn.id,
    'requested',
    p_borrower_id,
    jsonb_build_object('listing_id', p_listing_id, 'delivery_type', p_delivery_type)
  );

  -- Step 8: Update listing status to reserved
  UPDATE public.listings SET status = 'reserved', updated_at = now()
  WHERE id = p_listing_id;

  RETURN v_txn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_transaction(
  p_transaction_id uuid,
  p_actor_id uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_txn public.transactions;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Actor must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the transaction row
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Only lender can approve
  IF v_txn.lender_id != p_actor_id THEN
    RAISE EXCEPTION 'Only the lender can approve a transaction';
  END IF;

  -- Must be in 'requested' status
  IF v_txn.status != 'requested' THEN
    RAISE EXCEPTION 'Cannot approve transaction in status %: must be requested', v_txn.status;
  END IF;

  -- Transition to approved
  UPDATE public.transactions
  SET status = 'approved', updated_at = now()
  WHERE id = p_transaction_id
  RETURNING * INTO v_txn;

  -- Record transaction event
  INSERT INTO public.transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (
    p_transaction_id,
    'approved',
    p_actor_id,
    jsonb_build_object('approved_at', now())
  );

  RETURN v_txn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_transaction(
  p_transaction_id uuid,
  p_actor_id uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_txn public.transactions;
  v_hold_event public.credit_events;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Actor must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the transaction row
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Only lender can decline
  IF v_txn.lender_id != p_actor_id THEN
    RAISE EXCEPTION 'Only the lender can decline a transaction';
  END IF;

  -- Must be in 'requested' status
  IF v_txn.status != 'requested' THEN
    RAISE EXCEPTION 'Cannot decline transaction in status %: must be requested', v_txn.status;
  END IF;

  -- Find the hold_placed event
  SELECT * INTO v_hold_event FROM public.credit_events
  WHERE transaction_id = p_transaction_id
    AND event_type = 'hold_placed'
    AND user_id = v_txn.borrower_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Release the hold (returns credits to borrower's available balance)
  IF FOUND THEN
    INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
    VALUES (
      v_txn.borrower_id,
      'hold_released',
      v_hold_event.amount,
      p_transaction_id,
      'transaction_declined',
      jsonb_build_object('declined_by', p_actor_id, 'declined_at', now()),
      'hold_released_transaction_declined_' || p_transaction_id::text
    );
  END IF;

  -- Transition to declined
  UPDATE public.transactions
  SET status = 'declined', updated_at = now()
  WHERE id = p_transaction_id
  RETURNING * INTO v_txn;

  -- Record transaction event
  INSERT INTO public.transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (
    p_transaction_id,
    'declined',
    p_actor_id,
    jsonb_build_object('declined_at', now())
  );

  -- Reset listing back to active
  UPDATE public.listings SET status = 'active', updated_at = now()
  WHERE id = v_txn.listing_id;

  RETURN v_txn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_transaction(
  p_transaction_id uuid,
  p_actor_id uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_txn public.transactions;
  v_hold_event public.credit_events;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Actor must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the transaction row
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Only allow cancellation from valid states
  IF v_txn.status NOT IN ('approved', 'payment_pending', 'ready_to_ship') THEN
    RAISE EXCEPTION 'Cannot cancel transaction in status %: must be approved, payment_pending, or ready_to_ship', v_txn.status;
  END IF;

  -- Verify actor is a participant
  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not a participant in transaction %', p_actor_id, p_transaction_id;
  END IF;

  -- Check if there's a hold to release
  SELECT * INTO v_hold_event FROM public.credit_events
  WHERE transaction_id = p_transaction_id
    AND event_type = 'hold_placed'
    AND user_id = v_txn.borrower_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Release the hold if one exists (returns credits to available balance)
  IF FOUND THEN
    INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
    VALUES (
      v_txn.borrower_id,
      'hold_released',
      v_hold_event.amount,
      p_transaction_id,
      'transaction_cancelled',
      jsonb_build_object('cancelled_by', p_actor_id, 'cancelled_at', now()),
      'cancel_hold_release_' || p_transaction_id::text
    );
  END IF;

  -- Update transaction status to cancelled
  UPDATE public.transactions
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_transaction_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_transaction(
  p_transaction_id uuid,
  p_actor_id uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_txn public.transactions;
  v_hold_event public.credit_events;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Actor must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the transaction row
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Only allow completion from 'delivered' or 'disputed' states
  IF v_txn.status NOT IN ('delivered', 'disputed') THEN
    RAISE EXCEPTION 'Cannot complete transaction in status %: must be delivered or disputed', v_txn.status;
  END IF;

  -- Verify actor is a participant
  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not a participant in transaction %', p_actor_id, p_transaction_id;
  END IF;

  -- Find the original hold_placed event for this transaction
  SELECT * INTO v_hold_event FROM public.credit_events
  WHERE transaction_id = p_transaction_id
    AND event_type = 'hold_placed'
    AND user_id = v_txn.borrower_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hold_placed event found for transaction %', p_transaction_id;
  END IF;

  -- Step 1: Release the borrower's hold (hold -> spent, not back to available)
  INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
  VALUES (
    v_txn.borrower_id,
    'hold_released',
    v_hold_event.amount,
    p_transaction_id,
    'transaction_completed',
    jsonb_build_object('completed_by', p_actor_id, 'completed_at', now()),
    'complete_hold_release_' || p_transaction_id::text
  );

  -- Step 2: Debit the borrower (record the spend from the held amount)
  INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (
    v_txn.borrower_id,
    'borrow_spent',
    ABS(v_hold_event.amount),
    p_transaction_id,
    jsonb_build_object('completed_by', p_actor_id),
    'complete_borrow_spent_' || p_transaction_id::text
  );

  -- Step 3: Credit the lender
  INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (
    v_txn.lender_id,
    'lend_completed',
    1,
    p_transaction_id,
    jsonb_build_object('borrower_id', v_txn.borrower_id),
    'complete_lend_credit_' || p_transaction_id::text
  );

  -- Step 4: Update transaction status to completed
  UPDATE public.transactions
  SET status = 'completed',
      updated_at = now()
  WHERE id = p_transaction_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_transaction_status(
  p_transaction_id uuid,
  p_new_status text,
  p_actor_id uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_txn public.transactions;
  v_current_status text;
  v_allowed_transitions text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Actor must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the transaction row to prevent concurrent status updates
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Verify actor is a participant (lender or borrower)
  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not a participant in transaction %', p_actor_id, p_transaction_id;
  END IF;

  v_current_status := v_txn.status;

  -- Define valid transitions from each state
  CASE v_current_status
    WHEN 'requested' THEN
      v_allowed_transitions := ARRAY['approved', 'declined'];
    WHEN 'approved' THEN
      v_allowed_transitions := ARRAY['cancelled', 'payment_pending'];
    WHEN 'payment_pending' THEN
      v_allowed_transitions := ARRAY['cancelled', 'ready_to_ship'];
    WHEN 'ready_to_ship' THEN
      v_allowed_transitions := ARRAY['cancelled', 'shipped'];
    WHEN 'shipped' THEN
      v_allowed_transitions := ARRAY['delivered'];
    WHEN 'delivered' THEN
      v_allowed_transitions := ARRAY['completed', 'disputed'];
    WHEN 'disputed' THEN
      v_allowed_transitions := ARRAY['completed'];
    ELSE
      -- Terminal states: completed, declined, cancelled
      v_allowed_transitions := ARRAY[]::text[];
  END CASE;

  -- Validate the transition
  IF NOT (p_new_status = ANY(v_allowed_transitions)) THEN
    RAISE EXCEPTION 'Invalid transition: % -> % (allowed: %)', v_current_status, p_new_status, v_allowed_transitions;
  END IF;

  -- Role-based permission checks for specific transitions
  CASE
    WHEN p_new_status = 'approved' AND p_actor_id != v_txn.lender_id THEN
      RAISE EXCEPTION 'Only the lender can approve a transaction';
    WHEN p_new_status = 'declined' AND p_actor_id != v_txn.lender_id THEN
      RAISE EXCEPTION 'Only the lender can decline a transaction';
    WHEN p_new_status = 'payment_pending' AND p_actor_id != v_txn.borrower_id THEN
      RAISE EXCEPTION 'Only the borrower can move to payment_pending';
    WHEN p_new_status = 'shipped' AND p_actor_id != v_txn.lender_id THEN
      RAISE EXCEPTION 'Only the lender can mark as shipped';
    WHEN p_new_status = 'delivered' AND p_actor_id != v_txn.borrower_id THEN
      RAISE EXCEPTION 'Only the borrower can confirm delivery';
    ELSE
      NULL; -- Other transitions allowed by either participant
  END CASE;

  -- Perform the update
  UPDATE public.transactions
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_transaction_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_signup_bonus(
  p_user_id uuid
)
RETURNS public.credit_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event public.credit_events;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'User must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent: if bonus already granted, return existing event
  SELECT * INTO v_event FROM public.credit_events
  WHERE idempotency_key = 'signup_bonus_' || p_user_id::text;

  IF FOUND THEN
    RETURN v_event;
  END IF;

  -- Grant 1 credit signup bonus
  INSERT INTO public.credit_events (user_id, event_type, amount, metadata, idempotency_key)
  VALUES (
    p_user_id,
    'signup_bonus',
    1,
    jsonb_build_object('granted_at', now()),
    'signup_bonus_' || p_user_id::text
  )
  RETURNING * INTO v_event;

  RETURN v_event;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.approve_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.decline_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decline_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.decline_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.complete_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.transition_transaction_status(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_transaction_status(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_transaction_status(uuid, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) TO authenticated, service_role;
