import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/features/auth/services/profileService';
import type { MembershipTier } from '@/features/clubs/services/clubsService.types';

// CACHE-02 fix: shared React Query hook replacing the imperative
// profileService.getProfileSummary() effect calls that were duplicated in
// ClubDetailScreen / ClubEventEditorScreen / ClubEventsScreen. One cached
// query per viewer; consumers share the entry instead of refetching per mount.
export function useViewerMembershipTier(userId: string | null | undefined): {
    tier: MembershipTier | null;
    isLoading: boolean;
} {
    const query = useQuery({
        queryKey: ['viewer-membership-tier', userId ?? 'anon'],
        queryFn: () => profileService.getProfileSummary(userId as string),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
        select: (profile) => profile?.membership_tier ?? null,
    });

    return { tier: query.data ?? null, isLoading: query.isLoading };
}
