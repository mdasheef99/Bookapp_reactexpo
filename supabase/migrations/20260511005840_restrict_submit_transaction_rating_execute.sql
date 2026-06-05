REVOKE ALL ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT[], TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT[], TEXT) TO authenticated;
