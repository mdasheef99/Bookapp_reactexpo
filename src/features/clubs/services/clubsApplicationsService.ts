import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { CLUB_JOIN_APPLICATION_SELECT, mapApplicationsWithProfiles, normalizeOptionalText } from './clubsService.shared';
import type { ClubJoinApplication, ClubJoinApplicationStatus, ClubJoinApplicationWithProfile, ReviewApplicationDecision } from './clubsService.types';

export async function getMyJoinApplication(clubId: string, userId: string): Promise<ClubJoinApplication | null> {
    const { data, error } = await supabase.from('club_join_applications').select(CLUB_JOIN_APPLICATION_SELECT).eq('club_id', clubId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data as ClubJoinApplication | null;
}

export async function getClubApplications(clubId: string, status: ClubJoinApplicationStatus = 'pending'): Promise<ClubJoinApplicationWithProfile[]> {
    const { data, error } = await supabase.from('club_join_applications').select(CLUB_JOIN_APPLICATION_SELECT).eq('club_id', clubId).eq('status', status).order('created_at', { ascending: true });
    if (error) throw error;
    return mapApplicationsWithProfiles((data ?? []) as ClubJoinApplication[]);
}

export async function reviewJoinApplication(applicationId: string, decision: ReviewApplicationDecision, declineReason?: string | null): Promise<ClubJoinApplication> {
    const { data, error } = await supabase.rpc('review_club_join_application', {
        p_application_id: applicationId,
        p_decision: decision,
        p_decline_reason: normalizeOptionalText(declineReason),
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to review this join application right now.'));
    return data as ClubJoinApplication;
}
