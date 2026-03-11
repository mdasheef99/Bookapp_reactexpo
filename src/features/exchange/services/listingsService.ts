import { supabase } from '@/lib/supabase';
import { profileService, type UserProfileSummary } from '@/features/auth/services/profileService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListingStatus = 'active' | 'paused' | 'reserved' | 'completed';
export type BookCondition = 'new' | 'like_new' | 'good' | 'acceptable' | 'poor';
export type DeliveryOption = 'porter' | 'dunzo' | 'meetup';

export interface BookSummary {
    id: string;
    title: string;
    subtitle: string | null;
    authors: string[] | null;
    cover_url: string | null;
    average_rating: number | null;
}

export interface Listing {
    id: string;
    user_book_id: string;
    owner_id: string;
    book_id: string;
    condition: BookCondition;
    condition_notes: string | null;
    photos: string[];          // Array of public storage URLs
    delivery_options: DeliveryOption[];
    status: ListingStatus;
    city: string | null;
    exclusive_type: string | null;
    exclusive_until: string | null;
    signed_copy_count: number;
    created_at: string;
    updated_at: string;
}

/** Lean type for list / browse views — includes book but NOT owner profile. */
export interface ListingWithBook extends Listing {
    book: BookSummary | null;
}

/** Rich type for detail views — includes book AND owner profile. */
export interface ListingWithDetails extends Listing {
    owner: UserProfileSummary | null;
    book: BookSummary | null;
}

export interface CreateListingParams {
    userBookId: string;
    ownerId: string;
    bookId: string;
    condition: BookCondition;
    conditionNotes?: string;
    photoUris: string[];          // Local file URIs from camera/gallery (2-4 required)
    deliveryOptions: DeliveryOption[];
    city: string;
}

export interface ListingFilters {
    condition?: BookCondition;
    deliveryOption?: DeliveryOption;
    limit?: number;
    offset?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Upload a single photo to the listing-photos bucket.
 * Path: listing-photos/{ownerId}/{listingId}/{index}.jpg
 * Returns the public URL.
 */
async function uploadPhoto(
    ownerId: string,
    listingId: string,
    photoUri: string,
    index: number
): Promise<string> {
    // Fetch the local file as a blob (works in React Native via fetch)
    const response = await fetch(photoUri);
    const blob = await response.blob();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${ownerId}/${listingId}/${index}.${ext}`;

    const { error } = await supabase.storage
        .from('listing-photos')
        .upload(path, blob, { contentType: blob.type, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from('listing-photos').getPublicUrl(path);
    return data.publicUrl;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const listingsService = {
    /**
     * Create a new listing:
     * 1. Insert row (without photos) to get the listing id
     * 2. Upload 2-4 photos to storage under that listing id
     * 3. Update row with the public photo URLs
     */
    async createListing(params: CreateListingParams): Promise<Listing> {
        const { userBookId, ownerId, bookId, condition, conditionNotes,
                photoUris, deliveryOptions, city } = params;

        if (photoUris.length < 2 || photoUris.length > 4) {
            throw new Error('Listings require between 2 and 4 photos.');
        }

        // Step 1: Insert placeholder row to get a UUID
        const { data: draft, error: insertError } = await supabase
            .from('listings')
            .insert({
                user_book_id: userBookId,
                owner_id: ownerId,
                book_id: bookId,
                condition,
                condition_notes: conditionNotes ?? null,
                photos: ['placeholder'],   // Will be replaced after upload
                delivery_options: deliveryOptions,
                city,
                status: 'active',
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Step 2: Upload photos
        let photoUrls: string[];
        try {
            photoUrls = await Promise.all(
                photoUris.map((uri, i) => uploadPhoto(ownerId, draft.id, uri, i))
            );
        } catch (uploadError) {
            // Roll back the draft row on upload failure
            await supabase.from('listings').delete().eq('id', draft.id);
            throw uploadError;
        }

        // Step 3: Update row with real photo URLs
        const { data: listing, error: updateError } = await supabase
            .from('listings')
            .update({ photos: photoUrls })
            .eq('id', draft.id)
            .select()
            .single();

        if (updateError) throw updateError;
        return listing as Listing;
    },

    /**
     * Browse active listings filtered by city.
     * LEAN: Returns listings with book only — no owner profile.
     * Use profileService.getProfileSummary() when user taps into a listing.
     */
    async browseListings(city: string, filters: ListingFilters = {}): Promise<ListingWithBook[]> {
        const { condition, deliveryOption, limit = 20, offset = 0 } = filters;

        let query = supabase
            .from('listings')
            .select(`
                *,
                book:books(
                    id, title, subtitle, authors, cover_url, average_rating
                )
            `)
            .eq('status', 'active')
            .eq('city', city)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (condition) {
            query = query.eq('condition', condition);
        }
        if (deliveryOption) {
            query = query.contains('delivery_options', [deliveryOption]);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as ListingWithBook[];
    },

    /**
     * Get a single listing with full owner profile + book details.
     * RICH: Fetches listing+book in one query, then owner profile separately.
     */
    async getListingDetails(listingId: string): Promise<ListingWithDetails> {
        const { data, error } = await supabase
            .from('listings')
            .select(`
                *,
                book:books(
                    id, title, subtitle, authors, cover_url, average_rating
                )
            `)
            .eq('id', listingId)
            .single();

        if (error) throw error;

        // Fetch owner profile separately (1 extra query, but only for detail view)
        const owner = await profileService.getProfileSummary(data.owner_id);

        return { ...data, owner } as ListingWithDetails;
    },

    /**
     * Get all listings owned by the current user (my listings screen).
     * LEAN: No owner profile needed — it's the current user.
     */
    async getMyListings(ownerId: string): Promise<ListingWithBook[]> {
        const { data, error } = await supabase
            .from('listings')
            .select(`
                *,
                book:books(
                    id, title, subtitle, authors, cover_url, average_rating
                )
            `)
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as ListingWithBook[];
    },

    /** Pause an active listing (owner only). */
    async pauseListing(listingId: string): Promise<void> {
        const { error } = await supabase
            .from('listings')
            .update({ status: 'paused' })
            .eq('id', listingId);
        if (error) throw error;
    },

    /** Re-activate a paused listing (owner only). */
    async activateListing(listingId: string): Promise<void> {
        const { error } = await supabase
            .from('listings')
            .update({ status: 'active' })
            .eq('id', listingId);
        if (error) throw error;
    },

    /**
     * Delete a listing and its storage photos.
     * Only valid for listings that are not reserved/completed.
     */
    async deleteListing(listingId: string, ownerId: string): Promise<void> {
        // Fetch the listing to get photo URLs for cleanup
        const { data: listing, error: fetchError } = await supabase
            .from('listings')
            .select('photos, status')
            .eq('id', listingId)
            .single();

        if (fetchError) throw fetchError;
        if (listing.status === 'reserved' || listing.status === 'completed') {
            throw new Error('Cannot delete a reserved or completed listing.');
        }

        // Delete row first
        const { error: deleteError } = await supabase
            .from('listings')
            .delete()
            .eq('id', listingId);
        if (deleteError) throw deleteError;

        // Best-effort cleanup of storage photos (don't fail if this errors)
        try {
            const paths = (listing.photos as string[])
                .map(url => {
                    // Extract path after bucket name in URL
                    const match = url.match(/listing-photos\/(.+)$/);
                    return match ? match[1] : null;
                })
                .filter(Boolean) as string[];

            if (paths.length > 0) {
                await supabase.storage.from('listing-photos').remove(paths);
            }
        } catch {
            console.warn('listingsService.deleteListing: failed to clean up storage photos');
        }
    },

    /**
     * Upload a new profile avatar and return the public URL.
     * Path: profile-avatars/{userId}/avatar.{ext}
     */
    async uploadAvatar(userId: string, photoUri: string): Promise<string> {
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${userId}/avatar.${ext}`;

        const { error } = await supabase.storage
            .from('profile-avatars')
            .upload(path, blob, { contentType: blob.type, upsert: true });

        if (error) throw error;

        const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path);
        return data.publicUrl;
    },
};

