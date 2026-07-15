-- Phase 5 consumer discovery hardening.
-- Sources: DOC-1 §§7.2/7.4, DOC-5 §§11/14, DOC-11 §§6/13/14,
-- DOC-16 §5, and PHASE-5 acceptance criteria.
BEGIN;

-- Public discovery must never expose private inventory, even when table-level
-- defaults change independently of RLS.
REVOKE SELECT ON public.store_inventory FROM anon;

DROP POLICY IF EXISTS "marketplace listings public select"
    ON public.marketplace_book_listings;
DROP POLICY IF EXISTS "marketplace listings anonymous public select"
    ON public.marketplace_book_listings;
DROP POLICY IF EXISTS "marketplace listings authenticated select"
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
            JOIN public.marketplace_localities l ON l.id = s.locality_id
            WHERE s.id = marketplace_book_listings.store_id
              AND s.status = 'active'
              AND s.verification_status = 'approved'
              AND s.setup_status = 'complete'
              AND s.selling_status = 'allowed'
              AND l.is_pilot_enabled = true
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
                JOIN public.marketplace_localities l ON l.id = s.locality_id
                WHERE s.id = marketplace_book_listings.store_id
                  AND s.status = 'active'
                  AND s.verification_status = 'approved'
                  AND s.setup_status = 'complete'
                  AND s.selling_status = 'allowed'
                  AND l.is_pilot_enabled = true
            )
        )
        OR marketplace_sec.is_store_admin(store_id)
        OR marketplace_sec.is_platform_operator()
    );

DROP POLICY IF EXISTS "public profiles readable" ON public.public_store_profiles;

CREATE POLICY "public profiles readable"
    ON public.public_store_profiles
    FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.stores s
            JOIN public.marketplace_localities l ON l.id = s.locality_id
            WHERE s.id = public_store_profiles.store_id
              AND s.status = 'active'
              AND s.verification_status = 'approved'
              AND s.setup_status = 'complete'
              AND s.selling_status = 'allowed'
              AND l.is_pilot_enabled = true
        )
    );

-- Search analytics are retained for a bounded pilot-learning window. Cleanup
-- can be scheduled operationally without changing the consumer contract.
ALTER TABLE public.marketplace_search_events
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL
    DEFAULT (now() + INTERVAL '90 days');
ALTER TABLE public.book_demand_signals
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL
    DEFAULT (now() + INTERVAL '90 days');

CREATE INDEX IF NOT EXISTS idx_marketplace_search_events_expires
    ON public.marketplace_search_events(expires_at);
CREATE INDEX IF NOT EXISTS idx_book_demand_signals_expires
    ON public.book_demand_signals(expires_at);

CREATE TABLE IF NOT EXISTS public.marketplace_demand_rate_limits (
    actor_key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
    PRIMARY KEY (actor_key, window_start)
);

ALTER TABLE public.marketplace_demand_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_demand_rate_limits FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.record_marketplace_unavailable_search(TEXT, INTEGER, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.record_marketplace_unavailable_search(p_query TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_query TEXT := btrim(COALESCE(p_query, ''));
    v_normalized TEXT;
    v_actor_key TEXT := COALESCE(auth.uid()::text, 'anon');
    v_window_start TIMESTAMPTZ;
    v_request_count INTEGER;
    v_request_limit INTEGER;
BEGIN
    IF v_query = '' THEN
        RETURN false;
    END IF;
    IF char_length(v_query) > 200 OR v_query ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'invalid marketplace search query'
            USING ERRCODE = '22023';
    END IF;

    v_normalized := lower(regexp_replace(v_query, '\s+', ' ', 'g'));
    v_window_start := CASE
        WHEN auth.uid() IS NULL THEN date_trunc('minute', now())
        ELSE date_trunc('hour', now())
    END;
    v_request_limit := CASE WHEN auth.uid() IS NULL THEN 60 ELSE 30 END;

    INSERT INTO public.marketplace_demand_rate_limits (
        actor_key, window_start, request_count
    ) VALUES (
        v_actor_key, v_window_start, 1
    )
    ON CONFLICT (actor_key, window_start) DO UPDATE SET
        request_count = public.marketplace_demand_rate_limits.request_count + 1
    RETURNING request_count INTO v_request_count;

    IF v_request_count > v_request_limit THEN
        RAISE EXCEPTION 'marketplace demand capture rate limit exceeded'
            USING ERRCODE = 'P0001';
    END IF;

    -- Opportunistic bounded-retention cleanup keeps the public RPC limited to
    -- its three private demand-capture tables. A scheduled cleanup may be
    -- added operationally later without broadening client grants.
    DELETE FROM public.marketplace_search_events WHERE expires_at <= now();
    DELETE FROM public.book_demand_signals WHERE expires_at <= now();

    INSERT INTO public.marketplace_search_events (
        user_id, query, normalized_query, result_count, location_context,
        source, expires_at
    ) VALUES (
        auth.uid(), v_query, v_normalized, 0, NULL,
        'consumer_marketplace', now() + INTERVAL '90 days'
    );

    INSERT INTO public.book_demand_signals (
        user_id, signal_type, query_text, normalized_query,
        location_context, source, dedupe_key, expires_at
    ) VALUES (
        auth.uid(), 'unavailable_search', v_query, v_normalized,
        NULL, 'consumer_marketplace',
        v_actor_key || ':' || md5(v_normalized),
        now() + INTERVAL '90 days'
    )
    ON CONFLICT (dedupe_key) DO UPDATE SET
        signal_count = public.book_demand_signals.signal_count + 1,
        last_seen_at = now(),
        expires_at = now() + INTERVAL '90 days';

    DELETE FROM public.marketplace_demand_rate_limits
    WHERE window_start < now() - INTERVAL '2 days';

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_marketplace_unavailable_search(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_marketplace_unavailable_search(TEXT)
    TO anon, authenticated;

COMMIT;
