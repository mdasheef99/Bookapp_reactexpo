BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_exchange_city_key(p_city text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT NULLIF(lower(regexp_replace(btrim(p_city), '[[:space:]]+', ' ', 'g')), '');
$$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS city_key text
  GENERATED ALWAYS AS (public.normalize_exchange_city_key(city)) STORED;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city_key text
  GENERATED ALWAYS AS (public.normalize_exchange_city_key(city)) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_city_key ON public.listings(city_key);
CREATE INDEX IF NOT EXISTS idx_venues_city_key ON public.venues(city_key);

CREATE OR REPLACE FUNCTION public.set_primary_club_venue(
  p_club_id uuid,
  p_venue_id uuid
)
RETURNS public.club_venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_target public.club_venues;
BEGIN
  PERFORM 1
  FROM public.book_clubs
  WHERE id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club % not found', p_club_id;
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.is_active_eligible_club_manager(auth.uid(), p_club_id) THEN
    RAISE EXCEPTION 'Only an eligible club manager can set the primary venue'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_target
  FROM public.club_venues
  WHERE club_id = p_club_id
    AND venue_id = p_venue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue % is not linked to club %', p_venue_id, p_club_id
      USING ERRCODE = '23503';
  END IF;

  UPDATE public.club_venues
  SET is_primary = (venue_id = p_venue_id)
  WHERE club_id = p_club_id;

  SELECT *
  INTO v_target
  FROM public.club_venues
  WHERE club_id = p_club_id
    AND venue_id = p_venue_id;

  RETURN v_target;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_primary_club_venue(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_primary_club_venue(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_primary_club_venue(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_transaction(
  p_listing_id uuid,
  p_borrower_id uuid,
  p_delivery_type text,
  p_message text DEFAULT NULL::text,
  p_shipping_address_id uuid DEFAULT NULL::uuid,
  p_pickup_venue_id uuid DEFAULT NULL::uuid
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_listing public.listings;
  v_balance public.user_credit_balances;
  v_pickup_venue public.venues;
  v_txn public.transactions;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_borrower_id THEN
    RAISE EXCEPTION 'Borrower must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing % not found', p_listing_id;
  END IF;

  IF v_listing.status != 'active' THEN
    RAISE EXCEPTION 'Listing is not active (current status: %)', v_listing.status;
  END IF;

  IF v_listing.owner_id = p_borrower_id THEN
    RAISE EXCEPTION 'Cannot borrow your own listing';
  END IF;

  IF p_delivery_type NOT IN ('porter', 'dunzo', 'meetup') THEN
    RAISE EXCEPTION 'Invalid delivery type: %', p_delivery_type;
  END IF;

  IF p_delivery_type = 'meetup' AND p_pickup_venue_id IS NULL THEN
    RAISE EXCEPTION 'A pickup venue is required for meetup exchanges';
  END IF;

  IF p_delivery_type != 'meetup' AND p_pickup_venue_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup venues are only supported for meetup exchanges';
  END IF;

  IF p_pickup_venue_id IS NOT NULL THEN
    SELECT * INTO v_pickup_venue
    FROM public.venues
    WHERE id = p_pickup_venue_id
      AND verification_status = 'approved'
      AND is_exchange_partner IS TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pickup venue % is not available for exchange pickup', p_pickup_venue_id;
    END IF;

    IF v_listing.city_key IS NULL
       OR v_pickup_venue.city_key IS NULL
       OR v_pickup_venue.city_key IS DISTINCT FROM v_listing.city_key THEN
      RAISE EXCEPTION 'Pickup venue must be in the same city as the listing'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_balance
  FROM public.user_credit_balances
  WHERE user_id = p_borrower_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit balance found for borrower %', p_borrower_id;
  END IF;

  IF v_balance.available < 1 THEN
    RAISE EXCEPTION 'Insufficient credits: available=%, required=1', v_balance.available;
  END IF;

  INSERT INTO public.transactions (
    listing_id, lender_id, borrower_id, status,
    delivery_type, message, shipping_address_id, pickup_venue_id
  )
  VALUES (
    p_listing_id, v_listing.owner_id, p_borrower_id, 'requested',
    p_delivery_type, p_message, p_shipping_address_id, p_pickup_venue_id
  )
  RETURNING * INTO v_txn;

  INSERT INTO public.credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (
    p_borrower_id,
    'hold_placed',
    1,
    v_txn.id,
    jsonb_build_object('listing_id', p_listing_id, 'requested_at', now()),
    'hold_placed_' || v_txn.id::text
  );

  INSERT INTO public.transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (
    v_txn.id,
    'requested',
    p_borrower_id,
    jsonb_build_object(
      'listing_id', p_listing_id,
      'delivery_type', p_delivery_type,
      'pickup_venue_id', p_pickup_venue_id
    )
  );

  UPDATE public.listings SET status = 'reserved', updated_at = now()
  WHERE id = p_listing_id;

  RETURN v_txn;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid, uuid) TO authenticated, service_role;

COMMIT;
