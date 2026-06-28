import { storeOwnerService } from '../storeOwnerService';
import { supabase } from '@/lib/supabase';
import type { StoreApplicationDraftInput } from '../../types';

jest.mock('@/lib/supabase');

function createBuilder(response: { data: unknown; error: Error | null }) {
    const builder: any = {
        select: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        order: jest.fn(() => builder),
        limit: jest.fn(() => builder),
        maybeSingle: jest.fn(() => Promise.resolve(response)),
    };
    return builder;
}

function mockStoreAdminQuery(adminResponse: { data: unknown; error: Error | null }) {
    const builder = createBuilder(adminResponse);
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);
    return builder;
}

function mockVerificationQuery(requestResponse: { data: unknown; error: Error | null }) {
    const builder = createBuilder(requestResponse);
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);
    return builder;
}

const baseStore = {
    id: 'store-1',
    display_name: 'Reader Lane Books',
    status: 'draft',
    setup_status: 'incomplete',
};

const draftInput: StoreApplicationDraftInput & { storeId: string; requestId: string } = {
    storeId: 'store-1',
    requestId: 'request-1',
    ownerFullName: 'Reader Owner',
    ownerEmail: 'owner@example.com',
    supportContactChannel: 'phone',
    displayName: 'Reader Lane Books',
    legalName: 'Reader Lane Books LLP',
    legalSellerName: 'Reader Lane Books',
    storeType: 'independent_bookstore',
    description: 'Neighborhood bookstore',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    publicAddressMode: 'locality_only',
    sellerAgreementVersion: 'seller-agreement-v2026-06-27',
    sellerAgreementAccepted: true,
    prohibitedItemsPolicyAccepted: true,
    supportPolicyAccepted: true,
    panStatus: 'not_collected',
};

describe('storeOwnerService.getGateState', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns unauthenticated without a user id', async () => {
        await expect(storeOwnerService.getGateState(null)).resolves.toEqual({ state: 'unauthenticated' });
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns consumer_only when the user has no store administrator rows', async () => {
        mockStoreAdminQuery({ data: null, error: null });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({ state: 'consumer_only' });

        expect(supabase.from).toHaveBeenCalledWith('store_administrators');
    });

    it('returns application_draft for a draft verification request', async () => {
        mockStoreAdminQuery({ data: { store_id: 'store-1', stores: baseStore }, error: null });
        mockVerificationQuery({ data: { id: 'request-1', status: 'draft' }, error: null });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({
            state: 'application_draft',
            storeId: 'store-1',
            requestId: 'request-1',
        });
    });

    it('returns pending_verification for a submitted verification request', async () => {
        mockStoreAdminQuery({ data: { store_id: 'store-1', stores: baseStore }, error: null });
        mockVerificationQuery({ data: { id: 'request-1', status: 'submitted' }, error: null });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({
            state: 'pending_verification',
            storeId: 'store-1',
            requestId: 'request-1',
        });
    });

    it('returns needs_more_info for a request needing follow-up', async () => {
        mockStoreAdminQuery({ data: { store_id: 'store-1', stores: baseStore }, error: null });
        mockVerificationQuery({
            data: { id: 'request-1', status: 'needs_more_info', required_follow_up: { field: 'gstin' } },
            error: null,
        });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({
            state: 'needs_more_info',
            storeId: 'store-1',
            requestId: 'request-1',
            requiredFollowUp: { field: 'gstin' },
        });
    });

    it('returns approved_pending_setup for an approved store with incomplete setup', async () => {
        mockStoreAdminQuery({
            data: { store_id: 'store-1', stores: { ...baseStore, status: 'approved_pending_setup' } },
            error: null,
        });
        mockVerificationQuery({ data: { id: 'request-1', status: 'approved' }, error: null });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({
            state: 'approved_pending_setup',
            storeId: 'store-1',
            storeName: 'Reader Lane Books',
        });
    });

    it('returns active_owner for an active approved store', async () => {
        mockStoreAdminQuery({
            data: { store_id: 'store-1', stores: { ...baseStore, status: 'active', setup_status: 'complete' } },
            error: null,
        });
        mockVerificationQuery({ data: { id: 'request-1', status: 'approved' }, error: null });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({
            state: 'active_owner',
            storeId: 'store-1',
            storeName: 'Reader Lane Books',
        });
    });

    it('returns suspended when the store is suspended', async () => {
        mockStoreAdminQuery({
            data: { store_id: 'store-1', stores: { ...baseStore, status: 'suspended', suspension_reason: 'policy' } },
            error: null,
        });
        mockVerificationQuery({ data: { id: 'request-1', status: 'approved' }, error: null });

        await expect(storeOwnerService.getGateState('user-1')).resolves.toEqual({
            state: 'suspended',
            storeId: 'store-1',
            storeName: 'Reader Lane Books',
            reason: 'policy',
        });
    });

    it('does not read authority from user_profiles.account_type', async () => {
        mockStoreAdminQuery({ data: null, error: null });

        await storeOwnerService.getGateState('user-1');

        expect(supabase.from).not.toHaveBeenCalledWith('user_profiles');
    });
});

describe('storeOwnerService application actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (supabase.functions.invoke as jest.Mock).mockResolvedValue({
            data: { storeId: 'store-1', requestId: 'request-1' },
            error: null,
        });
    });

    it('starts or resumes a store application through the Edge Function', async () => {
        await expect(storeOwnerService.startOrResumeApplication()).resolves.toEqual({
            storeId: 'store-1',
            requestId: 'request-1',
        });

        expect(supabase.functions.invoke).toHaveBeenCalledWith('store-application', {
            body: { type: 'start_or_resume' },
        });
    });

    it('saves a draft through the Edge Function without privileged fields', async () => {
        await storeOwnerService.saveApplicationDraft(draftInput);

        expect(supabase.functions.invoke).toHaveBeenCalledWith('store-application', {
            body: {
                type: 'save_draft',
                storeId: 'store-1',
                requestId: 'request-1',
                payload: expect.objectContaining({ displayName: 'Reader Lane Books' }),
            },
        });
    });

    it('submits an application through the Edge Function', async () => {
        await storeOwnerService.submitApplication(draftInput);

        expect(supabase.functions.invoke).toHaveBeenCalledWith('store-application', {
            body: {
                type: 'submit',
                storeId: 'store-1',
                requestId: 'request-1',
                payload: expect.objectContaining({ sellerAgreementAccepted: true }),
            },
        });
    });

    it('records verification document metadata through the Edge Function', async () => {
        await storeOwnerService.recordVerificationDocument({
            storeId: 'store-1',
            requestId: 'request-1',
            documentType: 'storefront_photo',
            storagePath: 'store-1/request-1/storefront_photo/file.jpg',
            maskedLabel: 'file.jpg',
        });

        expect(supabase.functions.invoke).toHaveBeenCalledWith('store-application', {
            body: {
                type: 'record_document',
                payload: {
                    storeId: 'store-1',
                    requestId: 'request-1',
                    documentType: 'storefront_photo',
                    storagePath: 'store-1/request-1/storefront_photo/file.jpg',
                    maskedLabel: 'file.jpg',
                },
            },
        });
    });
});
