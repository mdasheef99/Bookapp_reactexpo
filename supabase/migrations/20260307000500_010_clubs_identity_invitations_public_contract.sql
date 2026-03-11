BEGIN;

-- Clubs foundational alignment migration.
-- Live-source-of-truth mismatches being addressed here:
-- 1) public.user_profiles has display_name but no username
-- 2) live Clubs policies still reference legacy 'lead' in multiple tables
-- 3) live book_clubs visibility does not match the approved public-detail product direction
-- 4) invite-only Clubs have no invitation table/workflow yet
-- 5) Clubs need a curated public detail contract for safe non-member reads

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username text;

UPDATE public.user_profiles
SET username = NULL
WHERE username IS NOT NULL AND btrim(username) = '';

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_format_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format_check
  CHECK (
    username IS NULL OR (
      username = lower(btrim(username))
      AND username ~ '^[a-z0-9_]{3,30}$'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_key
  ON public.user_profiles (lower(username))
  WHERE username IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'book_clubs_lead_id_fkey'
      AND conrelid = 'public.book_clubs'::regclass
  ) THEN
    ALTER TABLE public.book_clubs
      RENAME CONSTRAINT book_clubs_lead_id_fkey TO book_clubs_admin_id_fkey;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_author_club_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  author_profile public.user_profiles%ROWTYPE;
BEGIN
  IF NEW.club_type <> 'author_club' THEN
    RETURN NEW;
  END IF;

  IF NEW.author_id IS NULL THEN
    RAISE EXCEPTION 'author_club requires author_id';
  END IF;

  SELECT *
  INTO author_profile
  FROM public.user_profiles
  WHERE id = NEW.author_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'author_id must reference an existing user_profiles row';
  END IF;

  IF author_profile.user_id IS DISTINCT FROM NEW.admin_id THEN
    RAISE EXCEPTION 'author_club author_id must belong to the same auth user as admin_id';
  END IF;

  IF COALESCE(author_profile.is_verified_author, FALSE) = FALSE THEN
    RAISE EXCEPTION 'author_club admin must have a verified author profile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_author_club_owner_consistency ON public.book_clubs;

CREATE TRIGGER enforce_author_club_owner_consistency
BEFORE INSERT OR UPDATE OF club_type, author_id, admin_id
ON public.book_clubs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_author_club_owner_consistency();

CREATE OR REPLACE FUNCTION public.enforce_single_club_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_user_id uuid;
BEGIN
  SELECT admin_id
  INTO owner_user_id
  FROM public.book_clubs
  WHERE id = NEW.club_id;

  IF owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = owner_user_id THEN
    IF NEW.role <> 'admin' OR COALESCE(NEW.status, 'active') <> 'active' THEN
      RAISE EXCEPTION 'Primary club owner membership must remain active admin';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin' THEN
    RAISE EXCEPTION 'Only the primary club owner may hold the admin role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_club_admin_membership ON public.club_members;

CREATE TRIGGER enforce_single_club_admin_membership
BEFORE INSERT OR UPDATE OF club_id, user_id, role, status
ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_club_admin_membership();

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT club_invitations_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])),
  CONSTRAINT club_invitations_inviter_not_invitee_check
    CHECK (inviter_user_id <> invitee_user_id),
  CONSTRAINT club_invitations_response_timestamp_check
    CHECK (
      (status = 'pending' AND responded_at IS NULL)
      OR (status <> 'pending' AND responded_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS club_invitations_club_id_idx
  ON public.club_invitations (club_id);

CREATE INDEX IF NOT EXISTS club_invitations_invitee_user_id_idx
  ON public.club_invitations (invitee_user_id);

CREATE INDEX IF NOT EXISTS club_invitations_inviter_user_id_idx
  ON public.club_invitations (inviter_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS club_invitations_pending_unique_idx
  ON public.club_invitations (club_id, invitee_user_id)
  WHERE status = 'pending';

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.club_invitations FROM PUBLIC;
GRANT SELECT ON public.club_invitations TO authenticated, service_role;

DROP POLICY IF EXISTS "Participants and moderators can view invitations" ON public.club_invitations;

CREATE POLICY "Participants and moderators can view invitations"
ON public.club_invitations
FOR SELECT
USING (
  auth.uid() = inviter_user_id
  OR auth.uid() = invitee_user_id
  OR EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_invitations.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_invitations.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.create_club_invitation(
  p_club_id uuid,
  p_invitee_username text,
  p_note text DEFAULT NULL
)
RETURNS public.club_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  invitee_profile public.user_profiles%ROWTYPE;
  club_record public.book_clubs%ROWTYPE;
  created_invitation public.club_invitations%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO club_record
  FROM public.book_clubs
  WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF club_record.club_type <> 'invite_only' THEN
    RAISE EXCEPTION 'Invitations are only enabled for invite-only clubs in v1';
  END IF;

  IF NOT (
    club_record.admin_id = current_user_id
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = p_club_id
        AND cm.user_id = current_user_id
        AND cm.role IN ('admin', 'moderator')
        AND cm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Only moderators or admins can send invitations';
  END IF;

  SELECT * INTO invitee_profile
  FROM public.user_profiles
  WHERE lower(username) = lower(btrim(p_invitee_username));

  IF NOT FOUND OR invitee_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Username not found';
  END IF;

  IF invitee_profile.user_id = current_user_id THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = invitee_profile.user_id
      AND cm.status IN ('active', 'muted')
  ) THEN
    RAISE EXCEPTION 'User is already a member';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = invitee_profile.user_id
      AND cm.status = 'banned'
  ) THEN
    RAISE EXCEPTION 'Banned users cannot be invited';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_join_applications cja
    WHERE cja.club_id = p_club_id
      AND cja.user_id = invitee_profile.user_id
      AND cja.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'User already has a pending join application';
  END IF;

  INSERT INTO public.club_invitations (
    club_id,
    inviter_user_id,
    invitee_user_id,
    status,
    note
  )
  VALUES (
    p_club_id,
    current_user_id,
    invitee_profile.user_id,
    'pending',
    NULLIF(btrim(p_note), '')
  )
  RETURNING * INTO created_invitation;

  RETURN created_invitation;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A pending invitation already exists for this user and club';
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_club_invitation(
  p_invitation_id uuid
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  invitation_record public.club_invitations%ROWTYPE;
  created_membership public.club_members%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO invitation_record
  FROM public.club_invitations
  WHERE id = p_invitation_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found';
  END IF;

  IF invitation_record.invitee_user_id <> current_user_id THEN
    RAISE EXCEPTION 'You can only accept invitations addressed to you';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = invitation_record.club_id
      AND cm.user_id = current_user_id
      AND cm.status = 'banned'
  ) THEN
    RAISE EXCEPTION 'Banned users cannot accept club invitations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = invitation_record.club_id
      AND cm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'User already has a membership record for this club';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (invitation_record.club_id, current_user_id, 'member', 'active')
  RETURNING * INTO created_membership;

  UPDATE public.club_invitations
  SET status = 'accepted',
      responded_at = now()
  WHERE id = invitation_record.id;

  RETURN created_membership;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_club_join_application(
  p_application_id uuid,
  p_decision text,
  p_decline_reason text DEFAULT NULL
)
RETURNS public.club_join_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  application_record public.club_join_applications%ROWTYPE;
  updated_application public.club_join_applications%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_decision NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Decision must be approved or declined';
  END IF;

  SELECT * INTO application_record
  FROM public.club_join_applications
  WHERE id = p_application_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending application not found';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.book_clubs bc
      WHERE bc.id = application_record.club_id
        AND bc.admin_id = current_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = application_record.club_id
        AND cm.user_id = current_user_id
        AND cm.role IN ('admin', 'moderator')
        AND cm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Only moderators or admins can review applications';
  END IF;

  IF p_decision = 'approved' THEN
    IF EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = application_record.club_id
        AND cm.user_id = application_record.user_id
    ) THEN
      RAISE EXCEPTION 'User already has a membership record for this club';
    END IF;

    INSERT INTO public.club_members (club_id, user_id, role, status)
    VALUES (application_record.club_id, application_record.user_id, 'member', 'active');
  END IF;

  UPDATE public.club_join_applications
  SET status = p_decision,
      reviewed_by = current_user_id,
      reviewed_at = now(),
      decline_reason = CASE WHEN p_decision = 'declined' THEN NULLIF(btrim(p_decline_reason), '') ELSE NULL END
  WHERE id = application_record.id
  RETURNING * INTO updated_application;

  RETURN updated_application;
END;
$$;

REVOKE ALL ON FUNCTION public.create_club_invitation(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_club_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_club_join_application(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_club_invitation(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_club_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_club_join_application(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.club_public_details AS
SELECT
  bc.id,
  bc.name,
  bc.description,
  bc.cover_url,
  bc.club_type,
  bc.access_level,
  bc.meeting_type,
  bc.member_count,
  bc.max_members,
  bc.current_book_id,
  b.google_books_id AS current_book_google_books_id,
  b.title AS current_book_title,
  b.authors AS current_book_authors,
  b.cover_url AS current_book_cover_url,
  b.retail_price AS current_book_retail_price,
  b.currency_code AS current_book_currency_code,
  bc.admin_id,
  admin_profile.id AS admin_profile_id,
  admin_profile.display_name AS admin_display_name,
  admin_profile.avatar_url AS admin_avatar_url,
  admin_profile.city AS admin_city,
  bc.author_id,
  author_profile.user_id AS author_user_id,
  author_profile.display_name AS author_display_name,
  author_profile.avatar_url AS author_avatar_url,
  author_profile.city AS author_city,
  bc.created_at,
  bc.updated_at
FROM public.book_clubs bc
LEFT JOIN public.books b
  ON b.id = bc.current_book_id
LEFT JOIN public.user_profiles admin_profile
  ON admin_profile.user_id = bc.admin_id
LEFT JOIN public.user_profiles author_profile
  ON author_profile.id = bc.author_id
WHERE COALESCE(bc.is_archived, FALSE) = FALSE;

REVOKE ALL ON public.club_public_details FROM PUBLIC;
GRANT SELECT ON public.club_public_details TO authenticated, service_role;

DROP POLICY IF EXISTS "Clubs are viewable based on type" ON public.book_clubs;
CREATE POLICY "Clubs are viewable based on type"
ON public.book_clubs
FOR SELECT
USING (
  COALESCE(is_archived, FALSE) = FALSE
  OR auth.uid() = admin_id
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = book_clubs.id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can view club members" ON public.club_members;
CREATE POLICY "Members can view club members"
ON public.club_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_members.club_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
  OR EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_members.club_id
      AND bc.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can leave, admins can remove" ON public.club_members;
CREATE POLICY "Members can leave, admins can remove"
ON public.club_members
FOR DELETE
USING (
  (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.book_clubs bc
      WHERE bc.id = club_members.club_id
        AND bc.admin_id = auth.uid()
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_members.club_id
      AND bc.admin_id = auth.uid()
      AND club_members.user_id <> auth.uid()
  )
);

DROP POLICY IF EXISTS "Applications viewable by applicant and club moderators" ON public.club_join_applications;
CREATE POLICY "Applications viewable by applicant and club moderators"
ON public.club_join_applications
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_join_applications.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_join_applications.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Moderators can update applications" ON public.club_join_applications;
CREATE POLICY "Moderators can update applications"
ON public.club_join_applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_join_applications.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_join_applications.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_join_applications.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_join_applications.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can apply to join clubs" ON public.club_join_applications;
CREATE POLICY "Users can apply to join clubs"
ON public.club_join_applications
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_join_applications.club_id
      AND bc.club_type IN ('approval', 'author_club')
      AND COALESCE(bc.is_archived, FALSE) = FALSE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_join_applications.club_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'banned'
  )
);

DROP POLICY IF EXISTS "Join questions are viewable with clubs" ON public.club_join_questions;
CREATE POLICY "Join questions are viewable with clubs"
ON public.club_join_questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_join_questions.club_id
      AND (
        bc.club_type IN ('approval', 'author_club')
        OR auth.uid() = bc.admin_id
        OR EXISTS (
          SELECT 1
          FROM public.club_members cm
          WHERE cm.club_id = bc.id
            AND cm.user_id = auth.uid()
            AND cm.status IN ('active', 'muted')
        )
      )
  )
);

DROP POLICY IF EXISTS "Members can view club messages" ON public.club_messages;
CREATE POLICY "Members can view club messages"
ON public.club_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_messages.club_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
  AND (is_deleted = FALSE OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Moderators can delete messages" ON public.club_messages;
CREATE POLICY "Moderators can delete messages"
ON public.club_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_messages.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_messages.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
CREATE POLICY "Members can view reactions"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.club_messages cm
    JOIN public.club_members cmem
      ON cmem.club_id = cm.club_id
    WHERE cm.id = message_reactions.message_id
      AND cmem.user_id = auth.uid()
      AND cmem.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Moderators can create events" ON public.club_events;
CREATE POLICY "Moderators can create events"
ON public.club_events
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    EXISTS (
      SELECT 1
      FROM public.book_clubs bc
      WHERE bc.id = club_events.club_id
        AND bc.admin_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = club_events.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'moderator')
        AND cm.status = 'active'
    )
  )
);

DROP POLICY IF EXISTS "Members can view club events" ON public.club_events;
CREATE POLICY "Members can view club events"
ON public.club_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_events.club_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can view event RSVPs" ON public.event_rsvps;
CREATE POLICY "Members can view event RSVPs"
ON public.event_rsvps
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.club_events ce
    JOIN public.club_members cm
      ON cm.club_id = ce.club_id
    WHERE ce.id = event_rsvps.event_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Members can RSVP to events" ON public.event_rsvps;
CREATE POLICY "Members can RSVP to events"
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
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'muted')
  )
);

DROP POLICY IF EXISTS "Reporters and moderators can view complaints" ON public.club_complaints;
CREATE POLICY "Reporters and moderators can view complaints"
ON public.club_complaints
FOR SELECT
USING (
  auth.uid() = reporter_id
  OR EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_complaints.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_complaints.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Moderators can update complaints" ON public.club_complaints;
CREATE POLICY "Moderators can update complaints"
ON public.club_complaints
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_complaints.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_complaints.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Moderators and affected users can view actions" ON public.club_member_actions;
CREATE POLICY "Moderators and affected users can view actions"
ON public.club_member_actions
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = club_member_actions.club_id
      AND bc.admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = club_member_actions.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
      AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Moderators can create actions" ON public.club_member_actions;
CREATE POLICY "Moderators can create actions"
ON public.club_member_actions
FOR INSERT
WITH CHECK (
  auth.uid() = performed_by
  AND (
    EXISTS (
      SELECT 1
      FROM public.book_clubs bc
      WHERE bc.id = club_member_actions.club_id
        AND bc.admin_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = club_member_actions.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'moderator')
        AND cm.status = 'active'
    )
  )
);

COMMIT;