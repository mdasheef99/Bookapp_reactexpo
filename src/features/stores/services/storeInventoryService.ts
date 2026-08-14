import { supabase } from '@/lib/supabase';
import type {
    DuplicateInventorySearchInput,
    InventoryItemMutationInput,
    InventoryItemUpdateInput,
    ManualInventoryInput,
    PublicMarketplaceBookResult,
    PublicMarketplaceListing,
    StoreInventoryItem,
} from '../types';
import { createCaptureUuid, createSemanticKey } from '@/features/imageInventory/capture/captureIds';
import { publicationService } from '@/features/imageInventory/api/publicationService';
import { consumerDiscoveryService } from '@/features/marketplace/services/consumerDiscoveryService';
import type { SafePublicationDto } from '@/features/marketplace/services/discoverySchemas';

function cleanText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
}

function requireManualInventoryInput(input: ManualInventoryInput) {
    if (!cleanText(input.title)) throw new Error('Title is required.');
    if (!input.storeId) throw new Error('Store is required.');
    if (input.quantityAvailable < 0) throw new Error('Quantity cannot be negative.');
    if (input.sellingPriceMinor < 0) throw new Error('Price cannot be negative.');
}

function requireNonNegative(value: number | undefined, message: string) {
    if (typeof value === 'number' && value < 0) throw new Error(message);
}

function normalizeIsbn(value?: string | null) {
    return cleanText(value)?.replace(/[-\s]/g, '') ?? null;
}

function toInventoryPayload(input: ManualInventoryInput) {
    return {
        store_id: input.storeId,
        title: cleanText(input.title),
        authors: input.authors?.map((author) => author.trim()).filter(Boolean) ?? null,
        isbn_10: normalizeIsbn(input.isbn10),
        isbn_13: normalizeIsbn(input.isbn13),
        publisher: cleanText(input.publisher),
        published_date: cleanText(input.publishedDate),
        cover_url: cleanText(input.coverUrl),
        condition: input.condition,
        condition_notes: cleanText(input.conditionNotes),
        quantity_total: input.quantityAvailable,
        quantity_available: input.quantityAvailable,
        selling_price_minor: input.sellingPriceMinor,
        public_notes: cleanText(input.publicNotes),
        shelf_location: cleanText(input.shelfLocation),
        acquisition_cost_minor: input.acquisitionCostMinor ?? null,
        internal_notes: cleanText(input.internalNotes),
        visibility_status: input.visibilityStatus ?? 'draft',
        entry_method: 'manual',
    };
}

function sanitizePublicListing(row: Partial<PublicMarketplaceListing>): PublicMarketplaceListing {
    return {
        id: row.id ?? '',
        store_id: row.store_id ?? '',
        canonical_edition_id: row.canonical_edition_id ?? null,
        public_title: row.public_title ?? '',
        public_authors: row.public_authors ?? null,
        public_cover_url: row.public_cover_url ?? null,
        isbn_10: row.isbn_10 ?? null,
        isbn_13: row.isbn_13 ?? null,
        condition: row.condition ?? 'good',
        public_condition_notes: row.public_condition_notes ?? null,
        selling_price_minor: row.selling_price_minor ?? 0,
        availability_status: row.availability_status ?? 'confirmation_required',
        status: row.status ?? 'active',
        moderation_status: row.moderation_status ?? 'approved',
    };
}

function legacyListingFromSafeDto(row: SafePublicationDto): PublicMarketplaceListing {
    const condition = row.condition === 'very_good'
        ? 'like_new'
        : row.condition === 'acceptable' ? 'fair' : row.condition;
    return sanitizePublicListing({
        id: row.listingId,
        store_id: row.storeId,
        canonical_edition_id: null,
        public_title: row.title,
        public_authors: row.authors,
        public_cover_url: row.coverUrl,
        isbn_10: row.isbn10,
        isbn_13: row.isbn13,
        condition,
        public_condition_notes: row.publicDamageNote,
        selling_price_minor: row.priceMinor,
        availability_status: row.availabilityStatus,
        status: row.status,
        moderation_status: row.moderationStatus,
    });
}

function groupingKeyForListing(listing: PublicMarketplaceListing) {
    if (listing.canonical_edition_id) return `edition:${listing.canonical_edition_id}`;
    if (listing.isbn_13) return `isbn13:${listing.isbn_13}`;
    const authorKey = listing.public_authors?.join('|').toLowerCase() ?? '';
    return `title:${listing.public_title.toLowerCase()}|${authorKey}`;
}

function groupListings(listings: PublicMarketplaceListing[]): PublicMarketplaceBookResult[] {
    const groups = new Map<string, PublicMarketplaceListing[]>();

    listings.forEach((listing) => {
        const key = groupingKeyForListing(listing);
        groups.set(key, [...(groups.get(key) ?? []), listing]);
    });

    return Array.from(groups.entries()).map(([groupingKey, offers]) => {
        const first = offers[0];
        return {
            groupingKey,
            title: first.public_title,
            authors: first.public_authors,
            isbn13: first.isbn_13,
            coverUrl: first.public_cover_url,
            offerCount: offers.length,
            lowestPriceMinor: offers.length > 0 ? Math.min(...offers.map((offer) => offer.selling_price_minor)) : 0,
            offers,
        };
    });
}

async function updateInventoryByStore(input: InventoryItemMutationInput, updates: Record<string, unknown>) {
    const { error } = await supabase
        .from('store_inventory')
        .update(updates)
        .eq('store_id', input.storeId)
        .eq('id', input.inventoryId)
        .single();

    if (error) throw error;
}

export const storeInventoryService = {
    async createManualInventoryItem(input: ManualInventoryInput): Promise<StoreInventoryItem> {
        requireManualInventoryInput(input);

        const { data, error } = await supabase
            .from('store_inventory')
            .insert(toInventoryPayload(input))
            .select()
            .single();

        if (error) throw error;
        return data as StoreInventoryItem;
    },

    async findPotentialDuplicates(input: DuplicateInventorySearchInput): Promise<StoreInventoryItem[]> {
        let query = supabase
            .from('store_inventory')
            .select('id, store_id, title, authors, isbn_10, isbn_13, condition, quantity_available, selling_price_minor, visibility_status, listing_quality_status, created_at, updated_at')
            .eq('store_id', input.storeId)
            .limit(10);

        const isbn13 = normalizeIsbn(input.isbn13);
        if (isbn13) {
            query = query.eq('isbn_13', isbn13);
        } else if (input.title) {
            query = query.ilike('title', cleanText(input.title) ?? '');
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as StoreInventoryItem[];
    },

    async listStoreInventory(storeId: string): Promise<StoreInventoryItem[]> {
        const { data, error } = await supabase
            .from('store_inventory')
            .select('id, store_id, title, authors, isbn_10, isbn_13, condition, quantity_available, selling_price_minor, visibility_status, listing_quality_status, public_notes, shelf_location, entry_method, created_at, updated_at')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as StoreInventoryItem[];
    },

    async publishInventoryItem(input: InventoryItemMutationInput): Promise<void> {
        const current = await publicationService.readStatus(input.inventoryId);
        await publicationService.setState({
            inventoryId: input.inventoryId,
            expectedInventoryVersion: current.inventoryVersion,
            expectedPublicationIntentVersion: current.publicationIntentVersion,
            intent: 'publish', idempotencyKey: createSemanticKey('legacy-publish'),
            commandId: createCaptureUuid(),
        });
    },

    async pauseInventoryItem(input: InventoryItemMutationInput): Promise<void> {
        const current = await publicationService.readStatus(input.inventoryId);
        await publicationService.setState({
            inventoryId: input.inventoryId,
            expectedInventoryVersion: current.inventoryVersion,
            expectedPublicationIntentVersion: current.publicationIntentVersion,
            intent: 'pause', idempotencyKey: createSemanticKey('legacy-pause'),
            commandId: createCaptureUuid(),
        });
    },

    async updateInventoryItem(input: InventoryItemUpdateInput): Promise<void> {
        requireNonNegative(input.sellingPriceMinor, 'Price cannot be negative.');
        requireNonNegative(input.quantityAvailable, 'Quantity cannot be negative.');

        const updates: Record<string, unknown> = {};
        if (typeof input.sellingPriceMinor === 'number') updates.selling_price_minor = input.sellingPriceMinor;
        if (typeof input.quantityAvailable === 'number') {
            updates.quantity_available = input.quantityAvailable;
            updates.quantity_total = input.quantityAvailable;
        }
        if (input.condition) updates.condition = input.condition;
        if (input.publicNotes !== undefined) updates.public_notes = cleanText(input.publicNotes);
        if (input.shelfLocation !== undefined) updates.shelf_location = cleanText(input.shelfLocation);

        await updateInventoryByStore(input, updates);
    },

    async searchPublicListings(queryText: string): Promise<PublicMarketplaceListing[]> {
        const rows = await consumerDiscoveryService.searchSafePublications(cleanText(queryText) ?? '');
        return rows.map(legacyListingFromSafeDto);
    },

    async searchPublicBookResults(queryText: string): Promise<PublicMarketplaceBookResult[]> {
        const listings = await storeInventoryService.searchPublicListings(queryText);
        return groupListings(listings);
    },
};
