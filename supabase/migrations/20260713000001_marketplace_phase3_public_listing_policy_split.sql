-- Split public listing reads by role so anonymous browsing does not require
-- execute access to private owner/operator authorization helpers.
BEGIN;

DROP POLICY IF EXISTS "marketplace listings public select"
    ON public.marketplace_book_listings;

CREATE POLICY "marketplace listings anonymous public select"
    ON public.marketplace_book_listings
    FOR SELECT TO anon
    USING (
        status = 'active'
        AND moderation_status = 'approved'
        AND EXISTS (
            SELECT 1
            FROM public.stores s
            WHERE s.id = marketplace_book_listings.store_id
              AND s.status = 'active'
              AND s.verification_status = 'approved'
              AND s.setup_status = 'complete'
              AND s.selling_status = 'allowed'
        )
    );

CREATE POLICY "marketplace listings authenticated select"
    ON public.marketplace_book_listings
    FOR SELECT TO authenticated
    USING (
        (
            status = 'active'
            AND moderation_status = 'approved'
            AND EXISTS (
                SELECT 1
                FROM public.stores s
                WHERE s.id = marketplace_book_listings.store_id
                  AND s.status = 'active'
                  AND s.verification_status = 'approved'
                  AND s.setup_status = 'complete'
                  AND s.selling_status = 'allowed'
            )
        )
        OR marketplace_sec.is_store_admin(store_id)
        OR marketplace_sec.is_platform_operator()
    );

COMMIT;
