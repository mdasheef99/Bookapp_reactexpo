import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import type {
    ClubComplaint,
    ClubComplaintStatus,
    ClubComplaintWithProfiles,
    ResolveClubComplaintInput,
} from './clubsService.types';

const CLUB_COMPLAINT_SELECT = 'id, club_id, reporter_id, reported_user_id, message_id, reason, description, status, resolved_by, resolution_action, resolved_at, created_at';
const OPEN_COMPLAINT_STATUSES: ClubComplaintStatus[] = ['pending', 'reviewing'];

function getUniqueProfileIds(complaints: ClubComplaint[]) {
    return Array.from(new Set(complaints.flatMap((complaint) => [
        complaint.reporter_id,
        complaint.reported_user_id,
        complaint.resolved_by,
    ]).filter((value): value is string => Boolean(value))));
}

export async function getClubComplaints(
    clubId: string,
    statuses: ClubComplaintStatus[] = OPEN_COMPLAINT_STATUSES,
): Promise<ClubComplaintWithProfiles[]> {
    const { data, error } = await supabase
        .from('club_complaints')
        .select(CLUB_COMPLAINT_SELECT)
        .eq('club_id', clubId)
        .in('status', statuses)
        .order('created_at', { ascending: false });

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to load platform complaints right now.'));

    const rows = (data ?? []) as ClubComplaint[];
    const profileIds = getUniqueProfileIds(rows);
    const profiles = profileIds.length > 0 ? await profileService.getProfileSummaries(profileIds) : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return rows.map((complaint) => ({
        ...complaint,
        reporterProfile: complaint.reporter_id ? profileByUserId.get(complaint.reporter_id) ?? null : null,
        reportedUserProfile: complaint.reported_user_id ? profileByUserId.get(complaint.reported_user_id) ?? null : null,
        resolvedByProfile: complaint.resolved_by ? profileByUserId.get(complaint.resolved_by) ?? null : null,
    }));
}

export async function resolveClubComplaint(
    complaintId: string,
    input: ResolveClubComplaintInput,
): Promise<ClubComplaint> {
    const shouldCloseComplaint = input.status === 'resolved' || input.status === 'dismissed';
    const { data, error } = await supabase
        .from('club_complaints')
        .update({
            status: input.status,
            resolution_action: input.resolutionAction ?? null,
            resolved_at: shouldCloseComplaint ? new Date().toISOString() : null,
        })
        .eq('id', complaintId)
        .select(CLUB_COMPLAINT_SELECT)
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to resolve this platform complaint right now.'));
    return data as ClubComplaint;
}
