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
