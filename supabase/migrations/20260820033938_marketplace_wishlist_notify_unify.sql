BEGIN;

-- Unify wishlist notify to cover both legacy user_wishlist and canonical user_books.ownership='wishlist'
CREATE OR REPLACE FUNCTION public.notify_wishlist_matches(p_listing_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(processed_listings integer, created_deliveries integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    -- Notify users from both canonical user_books wishlist and legacy user_wishlist, deduplicated by user_id
    FOR wishlist_record IN
      SELECT DISTINCT ON (uid) uid as user_id, src_id as id FROM (
        SELECT ub.user_id as uid, ub.id as src_id
        FROM public.user_books ub
        JOIN public.books wb ON wb.id = ub.book_id
        WHERE ub.ownership = 'wishlist'
          AND wb.google_books_id = listing_record.google_books_id
          AND ub.user_id IS DISTINCT FROM listing_record.owner_id
        UNION
        SELECT uw.user_id as uid, uw.id as src_id
        FROM public.user_wishlist uw
        WHERE uw.google_books_id = listing_record.google_books_id
          AND uw.user_id IS DISTINCT FROM listing_record.owner_id
      ) combined
      ORDER BY uid, src_id
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

CREATE OR REPLACE FUNCTION public.route_wishlist_listing_match_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  listing_book public.books%ROWTYPE;
  event_record public.notification_events;
  wishlist_record record;
BEGIN
  IF NEW.status <> 'active' OR NEW.book_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.book_id IS NOT DISTINCT FROM NEW.book_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO listing_book
  FROM public.books
  WHERE id = NEW.book_id;

  IF listing_book.id IS NULL OR listing_book.google_books_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR wishlist_record IN
    SELECT DISTINCT ON (uid) uid as user_id, src_id as id FROM (
      SELECT ub.user_id as uid, ub.id as src_id
      FROM public.user_books ub
      JOIN public.books wb ON wb.id = ub.book_id
      WHERE ub.ownership = 'wishlist'
        AND wb.google_books_id = listing_book.google_books_id
        AND ub.user_id IS DISTINCT FROM NEW.owner_id
      UNION
      SELECT uw.user_id as uid, uw.id as src_id
      FROM public.user_wishlist uw
      WHERE uw.google_books_id = listing_book.google_books_id
        AND uw.user_id IS DISTINCT FROM NEW.owner_id
    ) combined
    ORDER BY uid, src_id
  LOOP
    event_record := public.create_notification_event(
      'wishlist.listing_matched',
      'listing',
      NEW.id,
      NEW.owner_id,
      'listings',
      'wishlist_listing:' || NEW.id::text || ':' || wishlist_record.user_id::text,
      'info',
      false,
      jsonb_build_object(
        'listing_id', NEW.id,
        'book_id', listing_book.id,
        'google_books_id', listing_book.google_books_id,
        'wishlist_id', wishlist_record.id,
        'title', listing_book.title
      )
    );

    PERFORM public.enqueue_notification_delivery(
      event_record.id,
      wishlist_record.user_id,
      'wishlist',
      ARRAY['in_app', 'push'],
      'Wishlist book available',
      'A book from your wishlist is now listed.',
      '/(tabs)/exchange/' || NEW.id::text,
      'wishlist',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMIT;
