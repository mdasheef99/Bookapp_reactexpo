BEGIN;

CREATE TABLE public.club_discussion_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  body text,
  is_deleted boolean NOT NULL DEFAULT FALSE,
  is_edited boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  last_replied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_discussion_topics_title_present CHECK (nullif(btrim(title), '') IS NOT NULL),
  CONSTRAINT club_discussion_topics_body_present CHECK (
    COALESCE(is_deleted, FALSE)
    OR nullif(btrim(coalesce(body, '')), '') IS NOT NULL
  ),
  CONSTRAINT club_discussion_topics_deleted_state_check CHECK (
    (COALESCE(is_deleted, FALSE) = FALSE AND deleted_at IS NULL)
    OR (COALESCE(is_deleted, FALSE) = TRUE AND deleted_at IS NOT NULL)
  )
);

CREATE INDEX idx_club_discussion_topics_club_recent
  ON public.club_discussion_topics(club_id, last_replied_at DESC, created_at DESC);

CREATE TABLE public.club_discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.club_discussion_topics(id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES public.club_discussion_replies(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  body text,
  is_deleted boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT club_discussion_replies_body_present CHECK (
    COALESCE(is_deleted, FALSE)
    OR nullif(btrim(coalesce(body, '')), '') IS NOT NULL
  ),
  CONSTRAINT club_discussion_replies_deleted_state_check CHECK (
    (COALESCE(is_deleted, FALSE) = FALSE AND deleted_at IS NULL)
    OR (COALESCE(is_deleted, FALSE) = TRUE AND deleted_at IS NOT NULL)
  )
);

CREATE INDEX idx_club_discussion_replies_topic_created
  ON public.club_discussion_replies(topic_id, created_at ASC);

CREATE INDEX idx_club_discussion_replies_parent
  ON public.club_discussion_replies(parent_reply_id)
  WHERE parent_reply_id IS NOT NULL;

CREATE TABLE public.club_discussion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.club_discussion_topics(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.club_discussion_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  vote_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_discussion_votes_target_check CHECK (
    ((topic_id IS NOT NULL)::int + (reply_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT club_discussion_votes_vote_type_check CHECK (vote_type IN ('upvote', 'downvote')),
  CONSTRAINT club_discussion_votes_topic_user_unique UNIQUE (topic_id, user_id),
  CONSTRAINT club_discussion_votes_reply_user_unique UNIQUE (reply_id, user_id)
);

CREATE INDEX idx_club_discussion_votes_topic ON public.club_discussion_votes(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX idx_club_discussion_votes_reply ON public.club_discussion_votes(reply_id) WHERE reply_id IS NOT NULL;

CREATE TABLE public.club_discussion_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.club_discussion_topics(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.club_discussion_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_discussion_reactions_target_check CHECK (
    ((topic_id IS NOT NULL)::int + (reply_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT club_discussion_reactions_emoji_present CHECK (nullif(btrim(emoji), '') IS NOT NULL),
  CONSTRAINT club_discussion_reactions_topic_user_emoji_unique UNIQUE (topic_id, user_id, emoji),
  CONSTRAINT club_discussion_reactions_reply_user_emoji_unique UNIQUE (reply_id, user_id, emoji)
);

CREATE INDEX idx_club_discussion_reactions_topic ON public.club_discussion_reactions(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX idx_club_discussion_reactions_reply ON public.club_discussion_reactions(reply_id) WHERE reply_id IS NOT NULL;

CREATE TABLE public.club_discussion_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.club_discussion_topics(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.club_discussion_replies(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  CONSTRAINT club_discussion_reports_target_check CHECK (
    ((topic_id IS NOT NULL)::int + (reply_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT club_discussion_reports_reason_check CHECK (reason IN ('spam', 'abuse', 'off_topic', 'spoiler', 'other')),
  CONSTRAINT club_discussion_reports_status_check CHECK (status IN ('open', 'resolved')),
  CONSTRAINT club_discussion_reports_resolution_check CHECK (
    (status = 'open' AND resolved_at IS NULL AND resolved_by IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  )
);

CREATE INDEX idx_club_discussion_reports_status_created
  ON public.club_discussion_reports(status, created_at DESC);

CREATE INDEX idx_club_discussion_reports_topic
  ON public.club_discussion_reports(topic_id, created_at DESC)
  WHERE topic_id IS NOT NULL;

CREATE INDEX idx_club_discussion_reports_reply
  ON public.club_discussion_reports(reply_id, created_at DESC)
  WHERE reply_id IS NOT NULL;

CREATE TABLE public.club_discussion_topic_reads (
  topic_id uuid NOT NULL REFERENCES public.club_discussion_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  last_read_at timestamptz,
  unread_reply_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (topic_id, user_id),
  CONSTRAINT club_discussion_topic_reads_unread_nonnegative CHECK (unread_reply_count >= 0)
);

CREATE INDEX idx_club_discussion_topic_reads_user_topic
  ON public.club_discussion_topic_reads(user_id, topic_id);

CREATE OR REPLACE FUNCTION public.get_club_discussion_target_club_id(p_topic_id uuid, p_reply_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT t.club_id
      FROM public.club_discussion_topics t
      WHERE t.id = p_topic_id
    ),
    (
      SELECT t.club_id
      FROM public.club_discussion_replies r
      JOIN public.club_discussion_topics t
        ON t.id = r.topic_id
      WHERE r.id = p_reply_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_club_discussion(p_user_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_user_id IS NOT NULL
    AND p_club_id IS NOT NULL
    AND (
      public.is_active_eligible_club_manager(p_user_id, p_club_id)
      OR EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = p_club_id
          AND cm.user_id = p_user_id
          AND cm.status IN ('active', 'muted')
      )
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.can_participate_club_discussion(p_user_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_user_id IS NOT NULL
    AND p_club_id IS NOT NULL
    AND (
      public.is_active_eligible_club_manager(p_user_id, p_club_id)
      OR EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = p_club_id
          AND cm.user_id = p_user_id
          AND cm.status = 'active'
      )
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_club_discussion(p_user_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.is_active_eligible_club_manager(p_user_id, p_club_id), FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.get_club_discussion_target_club_id(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_club_discussion(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_participate_club_discussion(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_moderate_club_discussion(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_club_discussion_topic_updated_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.club_id IS DISTINCT FROM OLD.club_id
     OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Immutable discussion topic fields cannot be changed';
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body THEN
    IF COALESCE(OLD.is_deleted, FALSE) THEN
      RAISE EXCEPTION 'Deleted discussion topics cannot be edited';
    END IF;
    NEW.is_edited := TRUE;
  END IF;

  IF COALESCE(NEW.is_deleted, FALSE) THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
  ELSE
    NEW.deleted_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_club_discussion_topic_updated_fields ON public.club_discussion_topics;
CREATE TRIGGER set_club_discussion_topic_updated_fields
BEFORE UPDATE ON public.club_discussion_topics
FOR EACH ROW
EXECUTE FUNCTION public.set_club_discussion_topic_updated_fields();

CREATE OR REPLACE FUNCTION public.enforce_club_discussion_reply_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_topic_id uuid;
BEGIN
  IF NEW.parent_reply_id IS NOT NULL THEN
    SELECT r.topic_id
    INTO parent_topic_id
    FROM public.club_discussion_replies r
    WHERE r.id = NEW.parent_reply_id;

    IF parent_topic_id IS NULL THEN
      RAISE EXCEPTION 'Parent discussion reply not found';
    END IF;

    IF parent_topic_id <> NEW.topic_id THEN
      RAISE EXCEPTION 'Parent discussion reply must belong to the same topic';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.topic_id IS DISTINCT FROM OLD.topic_id
       OR NEW.parent_reply_id IS DISTINCT FROM OLD.parent_reply_id
       OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.body IS DISTINCT FROM OLD.body THEN
      RAISE EXCEPTION 'Discussion replies are immutable except for moderation state';
    END IF;
  END IF;

  IF COALESCE(NEW.is_deleted, FALSE) THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
  ELSE
    NEW.deleted_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_club_discussion_reply_state ON public.club_discussion_replies;
CREATE TRIGGER enforce_club_discussion_reply_state
BEFORE INSERT OR UPDATE ON public.club_discussion_replies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_club_discussion_reply_state();

CREATE OR REPLACE FUNCTION public.handle_club_discussion_reply_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  SELECT t.club_id
  INTO v_club_id
  FROM public.club_discussion_topics t
  WHERE t.id = NEW.topic_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Discussion topic not found';
  END IF;

  UPDATE public.club_discussion_topics
  SET last_replied_at = COALESCE(NEW.created_at, now())
  WHERE id = NEW.topic_id;

  INSERT INTO public.club_discussion_topic_reads (topic_id, user_id, last_read_at, unread_reply_count)
  SELECT NEW.topic_id, recipients.user_id, NULL, 1
  FROM (
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = v_club_id
      AND cm.status IN ('active', 'muted')
    UNION
    SELECT bc.admin_id
    FROM public.book_clubs bc
    WHERE bc.id = v_club_id
      AND bc.admin_id IS NOT NULL
  ) AS recipients
  WHERE recipients.user_id <> NEW.author_user_id
  ON CONFLICT (topic_id, user_id)
  DO UPDATE SET unread_reply_count = GREATEST(COALESCE(club_discussion_topic_reads.unread_reply_count, 0), 0) + 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_club_discussion_reply_insert ON public.club_discussion_replies;
CREATE TRIGGER handle_club_discussion_reply_insert
AFTER INSERT ON public.club_discussion_replies
FOR EACH ROW
EXECUTE FUNCTION public.handle_club_discussion_reply_insert();

CREATE OR REPLACE FUNCTION public.enforce_club_discussion_report_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.topic_id IS DISTINCT FROM OLD.topic_id
     OR NEW.reply_id IS DISTINCT FROM OLD.reply_id
     OR NEW.reporter_user_id IS DISTINCT FROM OLD.reporter_user_id
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.details IS DISTINCT FROM OLD.details
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Discussion report target and content are immutable';
  END IF;

  IF COALESCE(NEW.status, 'open') = 'resolved' THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());

    IF NEW.resolved_by IS NULL THEN
      RAISE EXCEPTION 'Resolved discussion reports require a resolver';
    END IF;
  ELSE
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_club_discussion_report_state ON public.club_discussion_reports;
CREATE TRIGGER enforce_club_discussion_report_state
BEFORE UPDATE ON public.club_discussion_reports
FOR EACH ROW
EXECUTE FUNCTION public.enforce_club_discussion_report_state();

ALTER TABLE public.club_discussion_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussion_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussion_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussion_topic_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members and managers can view discussion topics" ON public.club_discussion_topics;
CREATE POLICY "Members and managers can view discussion topics"
ON public.club_discussion_topics
FOR SELECT
USING (public.can_view_club_discussion(auth.uid(), club_id));

DROP POLICY IF EXISTS "Active members can create discussion topics" ON public.club_discussion_topics;
CREATE POLICY "Active members can create discussion topics"
ON public.club_discussion_topics
FOR INSERT
WITH CHECK (
  auth.uid() = author_user_id
  AND public.can_participate_club_discussion(auth.uid(), club_discussion_topics.club_id)
  AND COALESCE(is_deleted, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Authors can edit their own discussion topics" ON public.club_discussion_topics;
CREATE POLICY "Authors can edit their own discussion topics"
ON public.club_discussion_topics
FOR UPDATE
USING (
  auth.uid() = author_user_id
  AND public.can_participate_club_discussion(auth.uid(), club_discussion_topics.club_id)
)
WITH CHECK (
  auth.uid() = author_user_id
  AND public.can_participate_club_discussion(auth.uid(), club_discussion_topics.club_id)
  AND COALESCE(is_deleted, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Managers can moderate discussion topics" ON public.club_discussion_topics;
CREATE POLICY "Managers can moderate discussion topics"
ON public.club_discussion_topics
FOR UPDATE
USING (public.can_moderate_club_discussion(auth.uid(), club_discussion_topics.club_id))
WITH CHECK (public.can_moderate_club_discussion(auth.uid(), club_discussion_topics.club_id));

DROP POLICY IF EXISTS "Members and managers can view discussion replies" ON public.club_discussion_replies;
CREATE POLICY "Members and managers can view discussion replies"
ON public.club_discussion_replies
FOR SELECT
USING (
  public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
);

DROP POLICY IF EXISTS "Active members can create discussion replies" ON public.club_discussion_replies;
CREATE POLICY "Active members can create discussion replies"
ON public.club_discussion_replies
FOR INSERT
WITH CHECK (
  auth.uid() = author_user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
  AND COALESCE(is_deleted, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Managers can moderate discussion replies" ON public.club_discussion_replies;
CREATE POLICY "Managers can moderate discussion replies"
ON public.club_discussion_replies
FOR UPDATE
USING (
  public.can_moderate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
)
WITH CHECK (
  public.can_moderate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
);

DROP POLICY IF EXISTS "Members and managers can view discussion votes" ON public.club_discussion_votes;
CREATE POLICY "Members and managers can view discussion votes"
ON public.club_discussion_votes
FOR SELECT
USING (
  public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Active members can create discussion votes" ON public.club_discussion_votes;
CREATE POLICY "Active members can create discussion votes"
ON public.club_discussion_votes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Active members can update discussion votes" ON public.club_discussion_votes;
CREATE POLICY "Active members can update discussion votes"
ON public.club_discussion_votes
FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Active members can delete discussion votes" ON public.club_discussion_votes;
CREATE POLICY "Active members can delete discussion votes"
ON public.club_discussion_votes
FOR DELETE
USING (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Members and managers can view discussion reactions" ON public.club_discussion_reactions;
CREATE POLICY "Members and managers can view discussion reactions"
ON public.club_discussion_reactions
FOR SELECT
USING (
  public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Active members can create discussion reactions" ON public.club_discussion_reactions;
CREATE POLICY "Active members can create discussion reactions"
ON public.club_discussion_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Active members can update discussion reactions" ON public.club_discussion_reactions;
CREATE POLICY "Active members can update discussion reactions"
ON public.club_discussion_reactions
FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Active members can delete discussion reactions" ON public.club_discussion_reactions;
CREATE POLICY "Active members can delete discussion reactions"
ON public.club_discussion_reactions
FOR DELETE
USING (
  auth.uid() = user_id
  AND public.can_participate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Reporters and managers can view discussion reports" ON public.club_discussion_reports;
CREATE POLICY "Reporters and managers can view discussion reports"
ON public.club_discussion_reports
FOR SELECT
USING (
  auth.uid() = reporter_user_id
  OR public.can_moderate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Members and managers can create discussion reports" ON public.club_discussion_reports;
CREATE POLICY "Members and managers can create discussion reports"
ON public.club_discussion_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_user_id
  AND public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Managers can update discussion reports" ON public.club_discussion_reports;
CREATE POLICY "Managers can update discussion reports"
ON public.club_discussion_reports
FOR UPDATE
USING (
  public.can_moderate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
)
WITH CHECK (
  public.can_moderate_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, reply_id)
  )
);

DROP POLICY IF EXISTS "Users can view their discussion read state" ON public.club_discussion_topic_reads;
CREATE POLICY "Users can view their discussion read state"
ON public.club_discussion_topic_reads
FOR SELECT
USING (
  auth.uid() = user_id
  AND public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
);

DROP POLICY IF EXISTS "Users can create their discussion read state" ON public.club_discussion_topic_reads;
CREATE POLICY "Users can create their discussion read state"
ON public.club_discussion_topic_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
);

DROP POLICY IF EXISTS "Users can update their discussion read state" ON public.club_discussion_topic_reads;
CREATE POLICY "Users can update their discussion read state"
ON public.club_discussion_topic_reads
FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
);

DROP POLICY IF EXISTS "Users can delete their discussion read state" ON public.club_discussion_topic_reads;
CREATE POLICY "Users can delete their discussion read state"
ON public.club_discussion_topic_reads
FOR DELETE
USING (
  auth.uid() = user_id
  AND public.can_view_club_discussion(
    auth.uid(),
    public.get_club_discussion_target_club_id(topic_id, NULL)
  )
);

COMMIT;