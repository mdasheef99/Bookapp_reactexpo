CREATE OR REPLACE FUNCTION public.submit_transaction_rating(
  p_transaction_id UUID,
  p_rating INTEGER,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_review TEXT DEFAULT NULL
)
RETURNS public.transaction_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_txn public.transactions;
  v_to_user_id UUID;
  v_rating public.transaction_ratings;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT *
    INTO v_txn
    FROM public.transactions
   WHERE id = p_transaction_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  IF v_txn.status != 'completed' THEN
    RAISE EXCEPTION 'Cannot rate transaction in status %: must be completed', v_txn.status;
  END IF;

  IF v_actor_id = v_txn.lender_id THEN
    v_to_user_id := v_txn.borrower_id;
  ELSIF v_actor_id = v_txn.borrower_id THEN
    v_to_user_id := v_txn.lender_id;
  ELSE
    RAISE EXCEPTION 'Actor % is not a participant in transaction %', v_actor_id, p_transaction_id;
  END IF;

  INSERT INTO public.transaction_ratings (
    transaction_id,
    from_user_id,
    to_user_id,
    rating,
    tags,
    review
  )
  VALUES (
    p_transaction_id,
    v_actor_id,
    v_to_user_id,
    p_rating,
    COALESCE(p_tags, ARRAY[]::TEXT[]),
    NULLIF(BTRIM(p_review), '')
  )
  RETURNING * INTO v_rating;

  RETURN v_rating;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT[], TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT[], TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can rate completed transactions they participated in" ON public.transaction_ratings;
DROP POLICY IF EXISTS "Participants can rate each other" ON public.transaction_ratings;

CREATE POLICY "Participants can rate completed transactions opposite party"
  ON public.transaction_ratings
  FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1
        FROM public.transactions
       WHERE transactions.id = transaction_ratings.transaction_id
         AND transactions.status = 'completed'
         AND (
           (
             transactions.lender_id = auth.uid()
             AND transaction_ratings.to_user_id = transactions.borrower_id
           )
           OR (
             transactions.borrower_id = auth.uid()
             AND transaction_ratings.to_user_id = transactions.lender_id
           )
         )
    )
  );
