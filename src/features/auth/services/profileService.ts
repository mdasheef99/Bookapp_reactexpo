import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserAccountType = 'user' | 'venue_owner' | 'author' | 'admin';
export type UserMembershipTier = 'free' | 'pro' | 'pro_plus';

const PROFILE_SOURCE_TABLE = 'user_profiles';
const PROFILE_SUMMARY_SOURCE = 'profile_public_summaries';
const PROFILE_COLUMNS = 'id, user_id, display_name, username, avatar_url, city, email, referral_code, account_type, is_verified_author, membership_tier, trust_score, created_at, updated_at';
const SUMMARY_COLUMNS = 'id, user_id, display_name, username, avatar_url, trust_score, city, membership_tier';

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

export interface UpdateProfileInput {
    display_name?: string;
    username?: string | null;
    city?: string;
}

function normalizeUsername(username?: string | null) {
    const value = username?.trim();
    return value ? value.toLowerCase().replace(/\s+/g, '_') : null;
}

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
            .select(PROFILE_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data as UserProfile | null;
    },

    /**
     * Check whether a user has completed profile setup.
     * Uses an id-only query for routing decisions.
     */
    async hasProfile(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from(PROFILE_SOURCE_TABLE)
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return Boolean(data?.id);
    },

    /**
     * Fetch a lightweight profile summary by auth user_id.
     * Canonical app-side source: public.profile_public_summaries.
     * Use this for cards, avatars, and list items.
     */
    async getProfileSummary(userId: string): Promise<UserProfileSummary | null> {
        const { data, error } = await supabase
            .from(PROFILE_SUMMARY_SOURCE)
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
            .from(PROFILE_SUMMARY_SOURCE)
            .select(SUMMARY_COLUMNS)
            .in('user_id', userIds);

        if (error) throw error;
        return (data ?? []) as UserProfileSummary[];
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile | null> {
        const payload: Record<string, string | null> = {
            updated_at: new Date().toISOString(),
        };

        if (input.display_name !== undefined) payload.display_name = input.display_name.trim();
        if (input.city !== undefined) payload.city = input.city.trim();
        if (input.username !== undefined) payload.username = normalizeUsername(input.username);

        const { data, error } = await supabase
            .from(PROFILE_SOURCE_TABLE)
            .update(payload)
            .eq('user_id', userId)
            .select(PROFILE_COLUMNS)
            .maybeSingle();

        if (error) throw error;
        return data as UserProfile | null;
    },

    async uploadAvatar(userId: string, photoUri: string): Promise<string> {
        const response = await fetch(photoUri);
        if (!response.ok) {
            throw new Error('Could not read the selected profile photo.');
        }
        const blob = await response.blob();
        const contentType = blob.type || 'image/jpeg';
        const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
        const path = `${userId}/avatar.${ext}`;

        const { error } = await supabase.storage
            .from('profile-avatars')
            .upload(path, blob, { contentType, upsert: true });

        if (error) throw error;

        const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path);
        const publicUrl = data?.publicUrl;
        if (!publicUrl) {
            throw new Error('Could not create a public URL for the profile photo.');
        }

        const { error: updateError } = await supabase
            .from(PROFILE_SOURCE_TABLE)
            .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select('*')
            .maybeSingle();

        if (updateError) throw updateError;
        return publicUrl;
    },
};

