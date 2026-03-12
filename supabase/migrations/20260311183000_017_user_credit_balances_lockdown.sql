BEGIN;

-- Lock down derived balance rows to system-managed writes only.
DROP POLICY IF EXISTS "System can manage credit balances" ON public.user_credit_balances;

REVOKE ALL ON TABLE public.user_credit_balances FROM anon;
REVOKE ALL ON TABLE public.user_credit_balances FROM authenticated;

GRANT SELECT ON TABLE public.user_credit_balances TO authenticated;

COMMIT;