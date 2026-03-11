BEGIN;

DROP POLICY IF EXISTS "Active listings are publicly viewable" ON public.listings;
DROP POLICY IF EXISTS "Users can view active listings" ON public.listings;
DROP POLICY IF EXISTS "Users can view active listings in their city" ON public.listings;

CREATE POLICY "Users can view active listings in their city"
ON public.listings
FOR SELECT
USING (
  auth.uid() = owner_id
  OR (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.city = listings.city
    )
  )
);

COMMIT;