BEGIN;

CREATE OR REPLACE FUNCTION public.notify_wishlist_matches(p_listing_id uuid DEFAULT NULL)
RETURNS TABLE(processed_listings integer, created_deliveries integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  listing_record record;
  wishlist_record record;
  event_record public.notification_events;
  delivery_count integer;
BEGIN
  processed_listings := 0;
  created_deliveries := 0;

  FOR listing_record IN
    SELECT
      l.id,
      l.owner_id,
      l.book_id,
      b.google_books_id,
      b.title
    FROM public.listings l
    JOIN public.books b ON b.id = l.book_id
    WHERE l.status = 'active'
      AND b.google_books_id IS NOT NULL
      AND (p_listing_id IS NULL OR l.id = p_listing_id)
  LOOP
    processed_listings := processed_listings + 1;

    FOR wishlist_record IN
      SELECT uw.id, uw.user_id
      FROM public.user_wishlist uw
      WHERE uw.google_books_id = listing_record.google_books_id
        AND uw.user_id IS DISTINCT FROM listing_record.owner_id
    LOOP
      event_record := public.create_notification_event(
        'wishlist.listing_matched',
        'listing',
        listing_record.id,
        listing_record.owner_id,
        'wishlist-notify',
        'wishlist_notify:' || listing_record.id::text || ':' || wishlist_record.user_id::text,
        'info',
        false,
        jsonb_build_object(
          'listing_id', listing_record.id,
          'book_id', listing_record.book_id,
          'google_books_id', listing_record.google_books_id,
          'wishlist_id', wishlist_record.id,
          'title', listing_record.title
        )
      );

      delivery_count := public.enqueue_notification_delivery(
        event_record.id,
        wishlist_record.user_id,
        'wishlist',
        ARRAY['in_app', 'push'],
        'Wishlist book available',
        'A book from your wishlist is now listed.',
        '/(tabs)/exchange/' || listing_record.id::text,
        'wishlist',
        false
      );
      created_deliveries := created_deliveries + delivery_count;
    END LOOP;
  END LOOP;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_wishlist_matches(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_wishlist_matches(uuid) TO service_role;

COMMIT;
