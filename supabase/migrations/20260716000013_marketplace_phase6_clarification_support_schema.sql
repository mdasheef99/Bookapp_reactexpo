-- Phase 6 Unit 8A: private clarification and support data.
BEGIN;
CREATE TABLE public.order_request_clarifications(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  reason_code TEXT NOT NULL CHECK(reason_code IN('edition','condition','quantity','fulfilment',
    'delivery_minimum','customer_note','price_drift','other')),
  customer_prompt TEXT NOT NULL CHECK(char_length(customer_prompt) BETWEEN 1 AND 1000),
  customer_response TEXT CHECK(char_length(customer_response)<=2000),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  responded_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','responded','expired','cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
  request_command_id UUID NOT NULL UNIQUE,
  response_command_id UUID UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),responded_at TIMESTAMPTZ
);
CREATE INDEX order_request_clarifications_request_idx ON public.order_request_clarifications(order_request_id,created_at);
CREATE UNIQUE INDEX order_request_clarifications_one_open
  ON public.order_request_clarifications(order_request_id) WHERE status='open';
CREATE TABLE public.order_request_support_notes(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  category TEXT NOT NULL CHECK(category IN('inventory_exception','price_correction_review',
    'customer_contact_issue','fulfilment_exception','closure_exception','policy_exception',
    'technical_error','suspected_abuse','other')),
  private_description TEXT NOT NULL CHECK(char_length(private_description) BETWEEN 1 AND 2000),
  command_id UUID NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_request_clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_request_support_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_request_clarifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_request_support_notes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_request_clarifications TO service_role;
GRANT ALL ON public.order_request_support_notes TO service_role;

CREATE FUNCTION marketplace_sec.sanitize_private_text(p_value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT NULLIF(btrim(regexp_replace(p_value,'[[:cntrl:]]',' ','g')),'') $$;
CREATE FUNCTION marketplace_sec.has_assigned_support_case(p_request_id UUID,p_actor UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(SELECT 1 FROM public.support_cases sc WHERE sc.assigned_to=p_actor
  AND sc.status NOT IN('resolved','closed','cancelled')
  AND sc.metadata->>'orderRequestId'=p_request_id::TEXT) $$;
REVOKE ALL ON FUNCTION marketplace_sec.sanitize_private_text(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.has_assigned_support_case(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.sanitize_private_text(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.has_assigned_support_case(UUID,UUID) TO service_role;
COMMIT;
