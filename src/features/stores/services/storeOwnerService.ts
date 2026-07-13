import { supabase } from '@/lib/supabase';
import type {
    StoreApplicationDraftWithIds,
    StoreApplicationStartResult,
    StoreOwnerGateState,
    StoreSetupChecklist,
    StoreVerificationDocumentInput,
} from '../types';

type StoreRow = {
    id: string;
    display_name?: string | null;
    status?: string | null;
    setup_status?: string | null;
    suspension_reason?: string | null;
    restriction_reason?: string | null;
};

type StoreAdminRow = {
    store_id: string;
    stores?: StoreRow | StoreRow[] | null;
};

type VerificationRequestRow = {
    id: string;
    status?: string | null;
    rejection_reason?: string | null;
    required_follow_up?: unknown;
};

type StoreSetupRow = StoreRow & {
    verification_status?: string | null;
    selling_status?: string | null;
    operating_hours?: Record<string, unknown> | null;
    pickup_enabled?: boolean | null;
    delivery_enabled?: boolean | null;
    return_policy_type?: string | null;
    payout_account_status?: string | null;
    seller_agreement_accepted_at?: string | null;
    prohibited_items_policy_accepted_at?: string | null;
};

type SubscriptionRow = {
    status?: string | null;
};

function normalizeStore(row: StoreAdminRow): StoreRow | null {
    if (Array.isArray(row.stores)) return row.stores[0] ?? null;
    return row.stores ?? null;
}

function storeName(store: StoreRow) {
    return store.display_name ?? 'Bookstore';
}

function mapGateState(store: StoreRow, request: VerificationRequestRow | null): StoreOwnerGateState {
    const storeId = store.id;

    if (store.status === 'active') {
        return { state: 'active_owner', storeId, storeName: storeName(store) };
    }

    if (store.status === 'approved_pending_setup') {
        return { state: 'approved_pending_setup', storeId, storeName: storeName(store) };
    }

    if (store.status === 'selling_restricted') {
        return {
            state: 'selling_restricted',
            storeId,
            storeName: storeName(store),
            reason: store.restriction_reason ?? undefined,
        };
    }

    if (store.status === 'suspended') {
        return {
            state: 'suspended',
            storeId,
            storeName: storeName(store),
            reason: store.suspension_reason ?? undefined,
        };
    }

    if (store.status === 'rejected' && request) {
        return {
            state: 'rejected',
            storeId,
            requestId: request.id,
            reason: request.rejection_reason ?? undefined,
        };
    }

    if (!request) return { state: 'consumer_only' };

    if (request.status === 'draft') {
        return { state: 'application_draft', storeId, requestId: request.id };
    }

    if (request.status === 'needs_more_info') {
        return {
            state: 'needs_more_info',
            storeId,
            requestId: request.id,
            requiredFollowUp: request.required_follow_up ?? undefined,
        };
    }

    if (request.status === 'rejected') {
        return {
            state: 'rejected',
            storeId,
            requestId: request.id,
            reason: request.rejection_reason ?? undefined,
        };
    }

    return { state: 'pending_verification', storeId, requestId: request.id };
}

export const storeOwnerService = {
    async getGateState(userId: string | null): Promise<StoreOwnerGateState> {
        if (!userId) return { state: 'unauthenticated' };

        const { data: adminRow, error: adminError } = await supabase
            .from('store_administrators')
            .select('store_id, stores(id, display_name, status, setup_status, suspension_reason, restriction_reason)')
            .eq('user_id', userId)
            .eq('role', 'owner')
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

        if (adminError) throw adminError;
        if (!adminRow) return { state: 'consumer_only' };

        const store = normalizeStore(adminRow as StoreAdminRow);
        if (!store) return { state: 'consumer_only' };

        const { data: requestRow, error: requestError } = await supabase
            .from('store_verification_requests')
            .select('id, status, rejection_reason, required_follow_up')
            .eq('store_id', store.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (requestError) throw requestError;
        return mapGateState(store, requestRow as VerificationRequestRow | null);
    },

    async startOrResumeApplication(): Promise<StoreApplicationStartResult> {
        const { data, error } = await supabase.functions.invoke('store-application', {
            body: { type: 'start_or_resume' },
        });
        if (error) throw error;
        return data as StoreApplicationStartResult;
    },

    async saveApplicationDraft(input: StoreApplicationDraftWithIds): Promise<void> {
        const { storeId, requestId, ...payload } = input;
        const { error } = await supabase.functions.invoke('store-application', {
            body: { type: 'save_draft', storeId, requestId, payload },
        });
        if (error) throw error;
    },

    async submitApplication(input: StoreApplicationDraftWithIds): Promise<void> {
        const { storeId, requestId, ...payload } = input;
        const { error } = await supabase.functions.invoke('store-application', {
            body: { type: 'submit', storeId, requestId, payload },
        });
        if (error) throw error;
    },

    async recordVerificationDocument(input: StoreVerificationDocumentInput): Promise<void> {
        const { error } = await supabase.functions.invoke('store-application', {
            body: { type: 'record_document', payload: input },
        });
        if (error) throw error;
    },

    async getSetupChecklist(storeId: string): Promise<StoreSetupChecklist> {
        const { data: store, error: storeError } = await supabase
            .from('stores')
            .select([
                'id',
                'display_name',
                'status',
                'verification_status',
                'setup_status',
                'selling_status',
                'operating_hours',
                'pickup_enabled',
                'delivery_enabled',
                'return_policy_type',
                'payout_account_status',
                'seller_agreement_accepted_at',
                'prohibited_items_policy_accepted_at',
            ].join(', '))
            .eq('id', storeId)
            .maybeSingle();

        if (storeError) throw storeError;
        if (!store) throw new Error('Store not found');

        const row = store as unknown as StoreSetupRow;
        const { data: subscription } = await supabase
            .from('store_subscriptions')
            .select('status')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const operatingHours = row.operating_hours ?? {};
        const hasOperatingHours = Object.keys(operatingHours).length > 0;
        const hasReturnPolicy = Boolean(row.return_policy_type && row.return_policy_type !== 'no_returns');

        return {
            storeId,
            storeName: storeName(row),
            storeStatus: row.status ?? 'draft',
            verificationStatus: row.verification_status ?? 'unverified',
            setupStatus: row.setup_status ?? 'incomplete',
            sellingStatus: row.selling_status ?? 'not_allowed',
            payoutAccountStatus: row.payout_account_status ?? 'not_started',
            subscriptionStatus: (subscription as SubscriptionRow | null)?.status ?? 'not_started',
            checklist: [
                { key: 'verification', label: 'Verification approved', isComplete: row.verification_status === 'approved' },
                { key: 'profile', label: 'Public profile basics', isComplete: Boolean(row.display_name) },
                { key: 'hours', label: 'Operating hours', isComplete: hasOperatingHours },
                { key: 'fulfillment', label: 'Pickup or delivery setting', isComplete: Boolean(row.pickup_enabled || row.delivery_enabled) },
                { key: 'return_policy', label: 'Return policy chosen', isComplete: hasReturnPolicy },
                { key: 'payout', label: 'Payout status shown', isComplete: Boolean(row.payout_account_status) },
                { key: 'subscription', label: 'Subscription or trial status', isComplete: Boolean((subscription as SubscriptionRow | null)?.status) },
                { key: 'seller_agreement', label: 'Seller agreement accepted', isComplete: Boolean(row.seller_agreement_accepted_at) },
                {
                    key: 'prohibited_policy',
                    label: 'Prohibited-items policy accepted',
                    isComplete: Boolean(row.prohibited_items_policy_accepted_at),
                },
            ],
        };
    },
};
