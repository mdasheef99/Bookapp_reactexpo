BEGIN;

ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS manual_location text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.club_events
SET event_type = CASE
  WHEN event_type = 'online' THEN 'virtual'
  WHEN event_type = 'offline' THEN 'in_person'
  ELSE event_type
END;

UPDATE public.club_events
SET status = COALESCE(status, 'scheduled'),
    updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE public.club_events DROP CONSTRAINT IF EXISTS club_events_event_type_check;
ALTER TABLE public.club_events DROP CONSTRAINT IF EXISTS club_events_status_check;
ALTER TABLE public.club_events DROP CONSTRAINT IF EXISTS club_events_format_requirements_check;
ALTER TABLE public.club_events DROP CONSTRAINT IF EXISTS club_events_cancelled_state_check;

ALTER TABLE public.club_events
  ADD CONSTRAINT club_events_event_type_check
    CHECK (event_type IN ('virtual', 'in_person', 'hybrid')),
  ADD CONSTRAINT club_events_status_check
    CHECK (status IN ('scheduled', 'cancelled')),
  ADD CONSTRAINT club_events_format_requirements_check
    CHECK (
      CASE
        WHEN event_type = 'virtual' THEN nullif(btrim(coalesce(meeting_link, '')), '') IS NOT NULL
        WHEN event_type = 'in_person' THEN venue_id IS NOT NULL OR nullif(btrim(coalesce(manual_location, '')), '') IS NOT NULL
        WHEN event_type = 'hybrid' THEN (venue_id IS NOT NULL OR nullif(btrim(coalesce(manual_location, '')), '') IS NOT NULL)
          AND nullif(btrim(coalesce(meeting_link, '')), '') IS NOT NULL
        ELSE FALSE
      END
    ),
  ADD CONSTRAINT club_events_cancelled_state_check
    CHECK (
      (status = 'scheduled' AND cancelled_at IS NULL AND cancelled_by IS NULL)
      OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION public.set_club_event_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_club_event_updated_at ON public.club_events;
CREATE TRIGGER set_club_event_updated_at
BEFORE UPDATE ON public.club_events
FOR EACH ROW
EXECUTE FUNCTION public.set_club_event_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_club_event(p_user_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.club_events ce
      WHERE ce.id = p_event_id
        AND public.can_user_hold_club_role(p_user_id, ce.club_id, 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.club_events ce
      WHERE ce.id = p_event_id
        AND ce.created_by = p_user_id
        AND public.is_active_eligible_club_manager(p_user_id, ce.club_id)
    ),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_club_event(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Moderators can create events" ON public.club_events;
DROP POLICY IF EXISTS "Eligible managers can create club events" ON public.club_events;
CREATE POLICY "Eligible managers can create club events"
ON public.club_events
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND status = 'scheduled'
  AND public.is_active_eligible_club_manager(auth.uid(), club_events.club_id)
);

DROP POLICY IF EXISTS "Creators can update their own events" ON public.club_events;
DROP POLICY IF EXISTS "Creators can update events" ON public.club_events;
DROP POLICY IF EXISTS "Admins or event creators can update club events" ON public.club_events;
CREATE POLICY "Admins or event creators can update club events"
ON public.club_events
FOR UPDATE
USING (public.can_manage_club_event(auth.uid(), club_events.id))
WITH CHECK (
  public.can_user_hold_club_role(auth.uid(), club_events.club_id, 'admin')
  OR (
    auth.uid() = created_by
    AND public.is_active_eligible_club_manager(auth.uid(), club_events.club_id)
  )
);

DROP POLICY IF EXISTS "Creators can delete their own events" ON public.club_events;
DROP POLICY IF EXISTS "Creators can delete events" ON public.club_events;
DROP POLICY IF EXISTS "Admins or event creators can delete club events" ON public.club_events;
CREATE POLICY "Admins or event creators can delete club events"
ON public.club_events
FOR DELETE
USING (public.can_manage_club_event(auth.uid(), club_events.id));

DROP POLICY IF EXISTS "Members can RSVP to club events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Members can RSVP to events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Active members can RSVP to scheduled club events" ON public.event_rsvps;
CREATE POLICY "Active members can RSVP to scheduled club events"
ON public.event_rsvps
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.club_events ce
    JOIN public.club_members cm
      ON cm.club_id = ce.club_id
    WHERE ce.id = event_rsvps.event_id
      AND ce.status = 'scheduled'
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Members can update their own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Active members can update their own RSVP" ON public.event_rsvps;
CREATE POLICY "Active members can update their own RSVP"
ON public.event_rsvps
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.club_events ce
    JOIN public.club_members cm
      ON cm.club_id = ce.club_id
    WHERE ce.id = event_rsvps.event_id
      AND ce.status = 'scheduled'
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Members can delete their own RSVP" ON public.event_rsvps;
CREATE POLICY "Members can delete their own RSVP"
ON public.event_rsvps
FOR DELETE
USING (auth.uid() = user_id);

COMMIT;