-- Harden Clubs RPC/function execute grants.
--
-- Supabase's default function privilege is EXECUTE for PUBLIC, and some
-- CREATE OR REPLACE FUNCTION migrations can leave anon callable even when
-- the function body checks auth.uid(). Keep client-callable Clubs RPCs
-- authenticated-only, and keep trigger-only functions off client roles.

-- Invitation/application RPCs.
REVOKE EXECUTE ON FUNCTION public.create_club_invitation(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_club_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_club_join_application(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_club_invitation(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_club_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_club_join_application(uuid, text, text) TO authenticated, service_role;

-- Book nomination/current-book RPCs.
REVOKE EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cast_club_book_vote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_club_book_vote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_club_book_nomination(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_club_current_book_from_nomination(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_club_current_book_status_overview(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_club_current_book_reading_status(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_club_book_vote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_club_book_vote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_club_book_nomination(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_club_current_book_from_nomination(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_club_current_book_status_overview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_club_current_book_reading_status(uuid, text) TO authenticated, service_role;

-- Entitlement/policy helper functions used by RLS policies and app checks.
REVOKE EXECUTE ON FUNCTION public.membership_tier_rank(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.club_access_level_rank(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_membership_tier(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_meets_access_level(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_meets_club_access_level(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_user_hold_club_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_eligible_club_manager(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_club_members(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_club_event(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_club_discussion_target_club_id(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_club_discussion(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_participate_club_discussion(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_moderate_club_discussion(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.membership_tier_rank(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_access_level_rank(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_membership_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_meets_access_level(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_meets_club_access_level(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_user_hold_club_role(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_eligible_club_manager(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_club_members(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_club_event(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_club_discussion_target_club_id(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_club_discussion(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_participate_club_discussion(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_moderate_club_discussion(uuid, uuid) TO authenticated, service_role;

-- Trigger/enforcement functions should run only as triggers, not public RPCs.
REVOKE EXECUTE ON FUNCTION public.enforce_single_club_admin_membership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_book_club_entitlement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_author_club_owner_consistency() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_vote_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_club_event_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_club_discussion_topic_updated_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_club_discussion_reply_state() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_club_discussion_reply_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_club_discussion_report_state() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_single_club_admin_membership() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_book_club_entitlement() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_author_club_owner_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_vote_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_member_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_club_event_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_club_discussion_topic_updated_fields() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_club_discussion_reply_state() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_club_discussion_reply_insert() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_club_discussion_report_state() TO service_role;
