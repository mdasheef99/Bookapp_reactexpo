BEGIN;

CREATE OR REPLACE FUNCTION public.membership_tier_rank(p_membership_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(p_membership_tier, 'free')
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 1
    WHEN 'pro_plus' THEN 2
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.club_access_level_rank(p_access_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(p_access_level, 'all')
    WHEN 'all' THEN 0
    WHEN 'pro' THEN 1
    WHEN 'pro_plus' THEN 2
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_membership_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT up.membership_tier::text
      FROM public.user_profiles up
      WHERE up.user_id = p_user_id
    ),
    'free'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_meets_access_level(p_user_id uuid, p_access_level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.membership_tier_rank(public.get_user_membership_tier(p_user_id))
    >= public.club_access_level_rank(COALESCE(p_access_level, 'all'));
$$;

CREATE OR REPLACE FUNCTION public.user_meets_club_access_level(p_user_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_clubs bc
    WHERE bc.id = p_club_id
      AND public.user_meets_access_level(p_user_id, COALESCE(bc.access_level, 'all'))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_user_hold_club_role(p_user_id uuid, p_club_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH club_record AS (
    SELECT bc.id, bc.admin_id, COALESCE(bc.access_level, 'all') AS access_level
    FROM public.book_clubs bc
    WHERE bc.id = p_club_id
  )
  SELECT CASE
    WHEN p_user_id IS NULL OR p_club_id IS NULL OR p_role IS NULL THEN FALSE
    WHEN p_role = 'member' THEN EXISTS (
      SELECT 1
      FROM club_record cr
      WHERE public.user_meets_access_level(p_user_id, cr.access_level)
    )
    WHEN p_role = 'moderator' THEN EXISTS (
      SELECT 1
      FROM club_record cr
      WHERE public.user_meets_access_level(p_user_id, cr.access_level)
        AND public.membership_tier_rank(public.get_user_membership_tier(p_user_id))
          >= public.membership_tier_rank('pro')
    )
    WHEN p_role = 'admin' THEN EXISTS (
      SELECT 1
      FROM club_record cr
      WHERE cr.admin_id = p_user_id
        AND public.user_meets_access_level(p_user_id, cr.access_level)
        AND public.membership_tier_rank(public.get_user_membership_tier(p_user_id))
          >= public.membership_tier_rank('pro')
    )
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_eligible_club_manager(p_user_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.can_user_hold_club_role(p_user_id, p_club_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = p_club_id
        AND cm.user_id = p_user_id
        AND cm.role = 'moderator'
        AND cm.status = 'active'
        AND public.can_user_hold_club_role(p_user_id, p_club_id, 'moderator')
    ),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.membership_tier_rank(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_access_level_rank(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_membership_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_meets_access_level(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_meets_club_access_level(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_user_hold_club_role(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_eligible_club_manager(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_book_club_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_tier text;
  active_club_count integer;
  max_allowed integer;
BEGIN
  IF NEW.admin_id IS NULL THEN
    RAISE EXCEPTION 'Club admin is required';
  END IF;

  IF COALESCE(NEW.is_archived, FALSE) = FALSE THEN
    admin_tier := public.get_user_membership_tier(NEW.admin_id);

    IF public.membership_tier_rank(admin_tier) < public.membership_tier_rank('pro') THEN
      RAISE EXCEPTION 'Only Pro or Pro+ users can create or own clubs';
    END IF;

    IF NOT public.user_meets_access_level(NEW.admin_id, COALESCE(NEW.access_level, 'all')) THEN
      RAISE EXCEPTION 'Club admin membership tier must satisfy the club access level';
    END IF;

    SELECT COUNT(*)
    INTO active_club_count
    FROM public.book_clubs bc
    WHERE bc.admin_id = NEW.admin_id
      AND COALESCE(bc.is_archived, FALSE) = FALSE
      AND (TG_OP = 'INSERT' OR bc.id <> NEW.id);

    active_club_count := active_club_count + 1;
    max_allowed := CASE admin_tier
      WHEN 'pro' THEN 5
      WHEN 'pro_plus' THEN 15
      ELSE 0
    END;

    IF active_club_count > max_allowed THEN
      RAISE EXCEPTION 'Membership tier club creation limit reached';
    END IF;

    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = NEW.id
        AND cm.status IN ('active', 'muted')
        AND NOT public.user_meets_access_level(cm.user_id, COALESCE(NEW.access_level, 'all'))
    ) THEN
      RAISE EXCEPTION 'Cannot change club access level while active members do not satisfy the new access level';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_book_club_entitlement ON public.book_clubs;
CREATE TRIGGER trigger_enforce_book_club_entitlement
BEFORE INSERT OR UPDATE OF admin_id, access_level, is_archived
ON public.book_clubs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_book_club_entitlement();

CREATE OR REPLACE FUNCTION public.enforce_club_member_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  club_access_level text;
BEGIN
  SELECT COALESCE(bc.access_level, 'all')
  INTO club_access_level
  FROM public.book_clubs bc
  WHERE bc.id = NEW.club_id;

  IF club_access_level IS NULL THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF COALESCE(NEW.status, 'active') IN ('active', 'muted')
     AND NOT public.user_meets_access_level(NEW.user_id, club_access_level) THEN
    RAISE EXCEPTION 'User membership tier does not satisfy this club access level';
  END IF;

  IF NEW.role = 'moderator' AND NOT public.can_user_hold_club_role(NEW.user_id, NEW.club_id, 'moderator') THEN
    RAISE EXCEPTION 'Only Pro or Pro+ users who meet the club access level may be moderators';
  END IF;

  IF NEW.role = 'admin' AND NOT public.can_user_hold_club_role(NEW.user_id, NEW.club_id, 'admin') THEN
    RAISE EXCEPTION 'Only the club owner with an eligible Pro or Pro+ membership tier may be an admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_club_member_entitlement ON public.club_members;
CREATE TRIGGER trigger_enforce_club_member_entitlement
BEFORE INSERT OR UPDATE OF club_id, user_id, role, status
ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_club_member_entitlement();

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.book_clubs;
CREATE POLICY "Authenticated users can create clubs"
ON public.book_clubs
FOR INSERT
WITH CHECK (
  auth.uid() = admin_id
  AND public.membership_tier_rank(public.get_user_membership_tier(auth.uid())) >= public.membership_tier_rank('pro')
  AND public.user_meets_access_level(auth.uid(), COALESCE(access_level, 'all'))
);

DROP POLICY IF EXISTS "Admins can update their clubs" ON public.book_clubs;
CREATE POLICY "Admins can update their clubs"
ON public.book_clubs
FOR UPDATE
USING (public.can_user_hold_club_role(auth.uid(), id, 'admin'))
WITH CHECK (public.can_user_hold_club_role(auth.uid(), id, 'admin'));

DROP POLICY IF EXISTS "System can add members" ON public.club_members;
CREATE POLICY "Eligible users can join public clubs and owners can add their admin membership"
ON public.club_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    (
      role = 'member'
      AND COALESCE(status, 'active') = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.book_clubs bc
        WHERE bc.id = club_members.club_id
          AND bc.club_type = 'public'
          AND COALESCE(bc.is_archived, FALSE) = FALSE
      )
      AND public.user_meets_club_access_level(auth.uid(), club_members.club_id)
    )
    OR (
      role = 'admin'
      AND COALESCE(status, 'active') = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.book_clubs bc
        WHERE bc.id = club_members.club_id
          AND bc.admin_id = auth.uid()
      )
      AND public.can_user_hold_club_role(auth.uid(), club_members.club_id, 'admin')
    )
  )
);

DROP POLICY IF EXISTS "Admins can manage members" ON public.club_members;
CREATE POLICY "Admins can manage members"
ON public.club_members
FOR UPDATE
USING (
  public.can_user_hold_club_role(auth.uid(), club_members.club_id, 'admin')
  AND club_members.user_id <> auth.uid()
)
WITH CHECK (
  public.can_user_hold_club_role(auth.uid(), club_members.club_id, 'admin')
  AND club_members.user_id <> auth.uid()
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
  OR (
    public.can_user_hold_club_role(auth.uid(), club_members.club_id, 'admin')
    AND club_members.user_id <> auth.uid()
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

  IF COALESCE(club_record.is_archived, FALSE) THEN
    RAISE EXCEPTION 'Archived clubs cannot send invitations';
  END IF;

  IF club_record.club_type <> 'invite_only' THEN
    RAISE EXCEPTION 'Invitations are only enabled for invite-only clubs in v1';
  END IF;

  IF NOT public.is_active_eligible_club_manager(current_user_id, p_club_id) THEN
    RAISE EXCEPTION 'Only eligible moderators or admins can send invitations';
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

  IF NOT public.user_meets_club_access_level(invitee_profile.user_id, p_club_id) THEN
    RAISE EXCEPTION 'User membership tier does not satisfy this club access level';
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
    FROM public.book_clubs bc
    WHERE bc.id = invitation_record.club_id
      AND COALESCE(bc.is_archived, FALSE) = TRUE
  ) THEN
    RAISE EXCEPTION 'Archived clubs cannot accept new members';
  END IF;

  IF NOT public.user_meets_club_access_level(current_user_id, invitation_record.club_id) THEN
    RAISE EXCEPTION 'Your membership tier does not satisfy this club access level';
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

  IF NOT public.is_active_eligible_club_manager(current_user_id, application_record.club_id) THEN
    RAISE EXCEPTION 'Only eligible moderators or admins can review applications';
  END IF;

  IF p_decision = 'approved' THEN
    IF EXISTS (
      SELECT 1
      FROM public.book_clubs bc
      WHERE bc.id = application_record.club_id
        AND COALESCE(bc.is_archived, FALSE) = TRUE
    ) THEN
      RAISE EXCEPTION 'Archived clubs cannot accept new members';
    END IF;

    IF NOT public.user_meets_club_access_level(application_record.user_id, application_record.club_id) THEN
      RAISE EXCEPTION 'Applicant membership tier does not satisfy this club access level';
    END IF;

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

DROP POLICY IF EXISTS "Participants and moderators can view invitations" ON public.club_invitations;
CREATE POLICY "Participants and moderators can view invitations"
ON public.club_invitations
FOR SELECT
USING (
  auth.uid() = inviter_user_id
  OR auth.uid() = invitee_user_id
  OR public.is_active_eligible_club_manager(auth.uid(), club_invitations.club_id)
);

DROP POLICY IF EXISTS "Applications viewable by applicant and club moderators" ON public.club_join_applications;
CREATE POLICY "Applications viewable by applicant and club moderators"
ON public.club_join_applications
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_active_eligible_club_manager(auth.uid(), club_join_applications.club_id)
);

DROP POLICY IF EXISTS "Moderators can update applications" ON public.club_join_applications;
CREATE POLICY "Moderators can update applications"
ON public.club_join_applications
FOR UPDATE
USING (public.is_active_eligible_club_manager(auth.uid(), club_join_applications.club_id))
WITH CHECK (public.is_active_eligible_club_manager(auth.uid(), club_join_applications.club_id));

DROP POLICY IF EXISTS "Moderators can delete messages" ON public.club_messages;
CREATE POLICY "Moderators can delete messages"
ON public.club_messages
FOR UPDATE
USING (public.is_active_eligible_club_manager(auth.uid(), club_messages.club_id));

DROP POLICY IF EXISTS "Moderators can create events" ON public.club_events;
CREATE POLICY "Moderators can create events"
ON public.club_events
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND public.is_active_eligible_club_manager(auth.uid(), club_events.club_id)
);

DROP POLICY IF EXISTS "Reporters and moderators can view complaints" ON public.club_complaints;
CREATE POLICY "Reporters and moderators can view complaints"
ON public.club_complaints
FOR SELECT
USING (
  auth.uid() = reporter_id
  OR public.is_active_eligible_club_manager(auth.uid(), club_complaints.club_id)
);

DROP POLICY IF EXISTS "Moderators can update complaints" ON public.club_complaints;
CREATE POLICY "Moderators can update complaints"
ON public.club_complaints
FOR UPDATE
USING (public.is_active_eligible_club_manager(auth.uid(), club_complaints.club_id));

DROP POLICY IF EXISTS "Moderators and affected users can view actions" ON public.club_member_actions;
CREATE POLICY "Moderators and affected users can view actions"
ON public.club_member_actions
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_active_eligible_club_manager(auth.uid(), club_member_actions.club_id)
);

DROP POLICY IF EXISTS "Moderators can create actions" ON public.club_member_actions;
CREATE POLICY "Moderators can create actions"
ON public.club_member_actions
FOR INSERT
WITH CHECK (
  auth.uid() = performed_by
  AND public.is_active_eligible_club_manager(auth.uid(), club_member_actions.club_id)
);

COMMIT;