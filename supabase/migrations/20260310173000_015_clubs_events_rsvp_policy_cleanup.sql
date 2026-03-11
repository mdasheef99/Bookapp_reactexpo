BEGIN;

DROP POLICY IF EXISTS "Members can update their RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Members can delete their RSVP" ON public.event_rsvps;

COMMIT;