import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserAccountType = 'user' | 'venue_owner' | 'author' | 'admin';
export type UserMembershipTier = 'free' | 'pro' | 'pro_plus';

const PROFILE_SOURCE_TABLE = 'user_profiles';

export interface UserProfile {
    id: string;
    user_id: string;
    display_name: string;
    username?: string | null;
    avatar_url: string | null;
    city: string;
    email: string | null;
    referral_code: string | null;
    account_type: UserAccountType;
    is_verified_author: boolean;
    membership_tier: UserMembershipTier;
    trust_score: number | null;
    created_at: string;
    updated_at: string;
}

/** Lightweight profile shape for display in cards / list items. */
export interface UserProfileSummary {
    id: string;
    user_id: string;
    display_name: string;
    username?: string | null;
    avatar_url: string | null;
    trust_score: number | null;
    city: string;
    membership_tier: UserMembershipTier;
}

const SUMMARY_COLUMNS = 'id, user_id, display_name, username, avatar_url, trust_score, city, membership_tier';

// ─── Service ──────────────────────────────────────────────────────────────────

export const profileService = {
    /**
     * Fetch a single user profile by auth user_id.
     * Canonical app-side source: public.user_profiles.
     * Returns the full profile for detail views.
     */
    async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from(PROFILE_SOURCE_TABLE)
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data as UserProfile | null;
    },

    /**
     * Fetch a lightweight profile summary by auth user_id.
     * Canonical app-side source: public.user_profiles.
     * Use this for cards, avatars, and list items.
     */
    async getProfileSummary(userId: string): Promise<UserProfileSummary | null> {
        const { data, error } = await supabase
            .from(PROFILE_SOURCE_TABLE)
            .select(SUMMARY_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data as UserProfileSummary | null;
    },

    /**
     * Fetch multiple profile summaries in one query.
     * Useful for transaction detail views where both lender + borrower are needed.
     * Pass an array of auth user_ids.
     */
    async getProfileSummaries(userIds: string[]): Promise<UserProfileSummary[]> {
        if (userIds.length === 0) return [];

        const { data, error } = await supabase
            .from(PROFILE_SOURCE_TABLE)
            .select(SUMMARY_COLUMNS)
            .in('user_id', userIds);

        if (error) throw error;
        return (data ?? []) as UserProfileSummary[];
    },
};

