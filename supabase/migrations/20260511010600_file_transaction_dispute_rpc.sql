CREATE OR REPLACE FUNCTION public.file_transaction_dispute(
  p_transaction_id UUID,
  p_actor_id UUID,
  p_reason TEXT
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn public.transactions;
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() != p_actor_id THEN
    RAISE EXCEPTION 'Actor must match authenticated user';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Dispute reason is required';
  END IF;

  SELECT *
    INTO v_txn
    FROM public.transactions
   WHERE id = p_transaction_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not a participant in transaction %', p_actor_id, p_transaction_id;
  END IF;

  IF v_txn.status != 'delivered' THEN
    RAISE EXCEPTION 'Cannot dispute transaction in status %: must be delivered', v_txn.status;
  END IF;

  UPDATE public.transactions
     SET status = 'disputed',
         updated_at = now()
   WHERE id = p_transaction_id
   RETURNING * INTO v_txn;

  INSERT INTO public.transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (
    p_transaction_id,
    'dispute_opened',
    p_actor_id,
    jsonb_build_object(
      'reason', v_reason,
      'opened_at', now()
    )
  );

  RETURN v_txn;
END;
$$;

REVOKE ALL ON FUNCTION public.file_transaction_dispute(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.file_transaction_dispute(UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.file_transaction_dispute(UUID, UUID, TEXT) TO authenticated;
