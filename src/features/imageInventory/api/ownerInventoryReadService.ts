export const OWNER_INVENTORY_CONTRACT_VERSION = 'phase9-owner-inventory-v2';

export type OwnerInventoryFilters = Readonly<{
    query?: string;
    condition?: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable' | 'all';
    visibilityStatus?: 'draft' | 'needs_review' | 'published' | 'paused' | 'out_of_stock' | 'blocked' | 'all';
    quantityState?: 'available' | 'low_stock' | 'out_of_stock' | 'all';
    entryMethod?: 'manual' | 'image_extraction' | 'metadata_import' | 'all';
    dateAdded?: 'last_7_days' | 'last_30_days' | 'all';
    publicationStatus?: 'private' | 'published' | 'paused' | 'publication_failed' | 'all';
}>;
