-- Clubs moderation maintenance:
-- 1) expose a narrowly scoped cleanup function for expired mute actions;
-- 2) document the raw book_clubs SELECT contract without changing the
--    club_public_details security-invoker view dependency.

CREATE OR REPLACE FUNCTION public.cleanup_expired_club_member_actions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  WITH expired_mutes AS (
    SELECT DISTINCT cma.club_id, cma.user_id
    FROM public.club_member_actions cma
    WHERE cma.action_type = 'muted'
      AND cma.expires_at IS NOT NULL
      AND cma.expires_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.club_member_actions newer
        WHERE newer.club_id = cma.club_id
          AND newer.user_id = cma.user_id
          AND newer.created_at > cma.created_at
          AND (
            newer.action_type = 'banned'
            OR (
              newer.action_type = 'muted'
              AND (newer.expires_at IS NULL OR newer.expires_at > now())
            )
          )
      )
  )
  UPDATE public.club_members cm
  SET status = 'active'
  FROM expired_mutes em
  WHERE cm.club_id = em.club_id
    AND cm.user_id = em.user_id
    AND cm.status = 'muted';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_club_member_actions() TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'cleanup-expired-club-member-actions'
    ) THEN
      PERFORM cron.schedule(
        'cleanup-expired-club-member-actions',
        '*/30 * * * *',
        'SELECT public.cleanup_expired_club_member_actions();'
      );
    END IF;
  END IF;
END;
$$;

COMMENT ON VIEW public.club_public_details IS
  'Public Clubs read contract. App browse/detail should use this view; raw book_clubs SELECT remains implementation support for RLS-backed manager/member/admin workflows and archived recovery.';
