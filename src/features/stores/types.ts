export type StoreOwnerGateState =
    | { state: 'unauthenticated' }
    | { state: 'consumer_only' }
    | { state: 'application_draft'; storeId: string; requestId: string }
    | { state: 'pending_verification'; storeId: string; requestId: string }
    | { state: 'needs_more_info'; storeId: string; requestId: string; requiredFollowUp?: unknown }
    | { state: 'approved_pending_setup'; storeId: string; storeName: string }
    | { state: 'active_owner'; storeId: string; storeName: string }
    | { state: 'selling_restricted'; storeId: string; storeName: string; reason?: string }
    | { state: 'suspended'; storeId: string; storeName: string; reason?: string }
    | { state: 'rejected'; storeId: string; requestId: string; reason?: string };

export interface StoreApplicationDraftInput {
    ownerFullName: string;
    ownerEmail?: string | null;
    supportContactChannel: 'phone' | 'email' | 'whatsapp';
    displayName: string;
    legalName?: string | null;
    legalSellerName: string;
    storeType: 'independent_bookstore' | 'second_hand_bookstore' | 'publisher_store' | 'library_store' | 'other';
    description?: string | null;
    city: string;
    state: string;
    pincode: string;
    localityId?: string | null;
    publicAddressMode: 'hidden' | 'locality_only' | 'full';
    sellerAgreementVersion: string;
    sellerAgreementAccepted: boolean;
    prohibitedItemsPolicyAccepted: boolean;
    supportPolicyAccepted: boolean;
    panStatus: 'not_collected' | 'provided' | 'not_applicable';
    gstin?: string | null;
    applicantNotes?: string | null;
}

export type StoreApplicationDraftWithIds = StoreApplicationDraftInput & {
    storeId: string;
    requestId: string;
};

export interface StoreApplicationStartResult {
    storeId: string;
    requestId: string | null;
}

export interface StoreVerificationDocumentInput {
    storeId: string;
    requestId: string;
    documentType: string;
    storagePath: string;
    maskedLabel?: string;
}

export type StoreSetupChecklistItem = {
    key: string;
    label: string;
    isComplete: boolean;
};

export interface StoreSetupChecklist {
    storeId: string;
    storeName: string;
    storeStatus: 'approved_pending_setup' | 'active' | 'selling_restricted' | 'suspended' | 'closed' | 'rejected' | string;
    verificationStatus: 'unverified' | 'pending' | 'approved' | 'rejected' | string;
    setupStatus: 'incomplete' | 'complete' | string;
    sellingStatus: 'not_allowed' | 'allowed' | 'restricted' | string;
    payoutAccountStatus: string;
    subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'grace_period' | 'restricted' | 'cancelled' | 'not_started' | string;
    checklist: StoreSetupChecklistItem[];
}

export type MarketplaceBookCondition = 'new' | 'like_new' | 'good' | 'fair' | 'damaged';
export type InventoryVisibilityStatus = 'draft' | 'needs_review' | 'published' | 'paused' | 'out_of_stock' | 'blocked';
export type ListingQualityStatus = 'ready' | 'missing_price' | 'missing_condition' | 'missing_metadata' | 'low_confidence_match' | 'needs_photo' | 'blocked';

export interface ManualInventoryInput {
    storeId: string;
    title: string;
    authors?: string[];
    isbn10?: string | null;
    isbn13?: string | null;
    publisher?: string | null;
    publishedDate?: string | null;
    coverUrl?: string | null;
    condition: MarketplaceBookCondition;
    conditionNotes?: string | null;
    quantityAvailable: number;
    sellingPriceMinor: number;
    publicNotes?: string | null;
    shelfLocation?: string | null;
    acquisitionCostMinor?: number | null;
    internalNotes?: string | null;
    visibilityStatus?: InventoryVisibilityStatus;
}

export interface StoreInventoryItem {
    id: string;
    store_id: string;
    title: string;
    authors: string[] | null;
    isbn_10: string | null;
    isbn_13: string | null;
    condition: MarketplaceBookCondition;
    quantity_available: number;
    selling_price_minor: number;
    visibility_status: InventoryVisibilityStatus;
    listing_quality_status: ListingQualityStatus;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface InventoryItemMutationInput {
    storeId: string;
    inventoryId: string;
}

export type InventoryItemUpdateInput = InventoryItemMutationInput & {
    sellingPriceMinor?: number;
    quantityAvailable?: number;
    condition?: MarketplaceBookCondition;
    publicNotes?: string | null;
};

export interface DuplicateInventorySearchInput {
    storeId: string;
    isbn13?: string | null;
    provider?: string | null;
    providerBookId?: string | null;
    title?: string | null;
    authors?: string[];
}

export interface PublicMarketplaceListing {
    id: string;
    store_id: string;
    canonical_edition_id: string | null;
    public_title: string;
    public_authors: string[] | null;
    public_cover_url: string | null;
    isbn_10: string | null;
    isbn_13: string | null;
    condition: MarketplaceBookCondition;
    public_condition_notes: string | null;
    selling_price_minor: number;
    availability_status: 'available' | 'low_stock' | 'confirmation_required' | 'unavailable';
    status: 'active' | 'paused' | 'out_of_stock' | 'blocked';
    moderation_status: 'approved' | 'pending' | 'blocked' | 'prohibited';
}

export interface PublicMarketplaceBookResult {
    groupingKey: string;
    title: string;
    authors: string[] | null;
    isbn13: string | null;
    coverUrl: string | null;
    offerCount: number;
    lowestPriceMinor: number;
    offers: PublicMarketplaceListing[];
}
