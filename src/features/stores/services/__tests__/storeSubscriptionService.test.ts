import { supabase } from '@/lib/supabase';
import { storeSubscriptionService } from '../storeSubscriptionService';

jest.mock('@/lib/supabase');

function createBuilder(response: { data: unknown; error: Error | null }) {
    const builder: any = {
        select: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        order: jest.fn(() => builder),
        limit: jest.fn(() => builder),
        single: jest.fn(() => Promise.resolve(response)),
        maybeSingle: jest.fn(() => Promise.resolve(response)),
        then: jest.fn((resolve: any) => resolve({ data: response.data, error: response.error })),
    };
    return builder;
}

const MOCK_STORE_ID = 'test-store-1';

const MOCK_SUBSCRIPTION_ROW = {
    status: 'active',
    plan_id: 'plan-1',
    current_period_start: '2026-06-01T00:00:00Z',
    current_period_end: '2026-07-01T00:00:00Z',
};

const MOCK_PLAN_ROW = { name: 'Founding Store' };

const MOCK_ENTITLEMENT_ROWS = [
    { feature_key: 'inventory_item_limit', limit_value: 100, is_enabled: true },
    { feature_key: 'monthly_image_extraction_limit', limit_value: 25, is_enabled: true },
    { feature_key: 'active_listing_limit', limit_value: 50, is_enabled: true },
    { feature_key: 'custom_reporting', limit_value: null, is_enabled: false },
];

const MOCK_USAGE_ROWS = [
    { counter_key: 'inventory_item_limit', used_value: 12 },
    { counter_key: 'active_listing_limit', used_value: 3 },
];

describe('storeSubscriptionService', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    describe('getSubscriptionStatus', () => {
        it('queries store_subscriptions scoped to the store owner', async () => {
            const subBuilder = createBuilder({ data: MOCK_SUBSCRIPTION_ROW, error: null });
            const planBuilder = createBuilder({ data: MOCK_PLAN_ROW, error: null });
            const entBuilder = createBuilder({ data: MOCK_ENTITLEMENT_ROWS, error: null });
            const usageBuilder = createBuilder({ data: MOCK_USAGE_ROWS, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(subBuilder)
                .mockReturnValueOnce(planBuilder)
                .mockReturnValueOnce(entBuilder)
                .mockReturnValueOnce(usageBuilder);

            await storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID);

            expect(supabase.from).toHaveBeenCalledWith('store_subscriptions');
            expect(subBuilder.eq).toHaveBeenCalledWith('store_id', MOCK_STORE_ID);
        });

        it('returns full subscription status with plan name, period, and entitlements', async () => {
            const subBuilder = createBuilder({ data: MOCK_SUBSCRIPTION_ROW, error: null });
            const planBuilder = createBuilder({ data: MOCK_PLAN_ROW, error: null });
            const entBuilder = createBuilder({ data: MOCK_ENTITLEMENT_ROWS, error: null });
            const usageBuilder = createBuilder({ data: MOCK_USAGE_ROWS, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(subBuilder)
                .mockReturnValueOnce(planBuilder)
                .mockReturnValueOnce(entBuilder)
                .mockReturnValueOnce(usageBuilder);

            const result = await storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID);

            expect(result).toEqual({
                storeId: MOCK_STORE_ID,
                status: 'active',
                planName: 'Founding Store',
                currentPeriodStart: '2026-06-01T00:00:00Z',
                currentPeriodEnd: '2026-07-01T00:00:00Z',
                entitlements: [
                    { featureKey: 'inventory_item_limit', limitValue: 100, isEnabled: true, usedValue: 12 },
                    { featureKey: 'monthly_image_extraction_limit', limitValue: 25, isEnabled: true, usedValue: 0 },
                    { featureKey: 'active_listing_limit', limitValue: 50, isEnabled: true, usedValue: 3 },
                    { featureKey: 'custom_reporting', limitValue: null, isEnabled: false, usedValue: 0 },
                ],
            });
        });

        it('treats missing usage counter rows as zero', async () => {
            const subBuilder = createBuilder({ data: MOCK_SUBSCRIPTION_ROW, error: null });
            const planBuilder = createBuilder({ data: MOCK_PLAN_ROW, error: null });
            const entBuilder = createBuilder({ data: MOCK_ENTITLEMENT_ROWS, error: null });
            const usageBuilder = createBuilder({ data: [], error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(subBuilder)
                .mockReturnValueOnce(planBuilder)
                .mockReturnValueOnce(entBuilder)
                .mockReturnValueOnce(usageBuilder);

            const result = await storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID);

            expect(result.entitlements.every((e) => e.usedValue === 0)).toBe(true);
        });

        it('treats missing subscription row as not_started with empty entitlements', async () => {
            const subBuilder = createBuilder({ data: null, error: null });
            const entBuilder = createBuilder({ data: [], error: null });
            const usageBuilder = createBuilder({ data: [], error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(subBuilder)
                .mockReturnValueOnce(entBuilder)
                .mockReturnValueOnce(usageBuilder);

            const result = await storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID);

            expect(result.status).toBe('not_started');
            expect(result.planName).toBeNull();
            expect(result.currentPeriodStart).toBeNull();
            expect(result.currentPeriodEnd).toBeNull();
            expect(result.entitlements).toEqual([]);
        });

        it('handles missing plan (plan_id present but no matching plan row)', async () => {
            const subBuilder = createBuilder({ data: MOCK_SUBSCRIPTION_ROW, error: null });
            const planBuilder = createBuilder({ data: null, error: null });
            const entBuilder = createBuilder({ data: MOCK_ENTITLEMENT_ROWS, error: null });
            const usageBuilder = createBuilder({ data: MOCK_USAGE_ROWS, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(subBuilder)
                .mockReturnValueOnce(planBuilder)
                .mockReturnValueOnce(entBuilder)
                .mockReturnValueOnce(usageBuilder);

            const result = await storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID);

            expect(result.planName).toBeNull();
        });

        it('throws on database error', async () => {
            const dbError = new Error('Connection failed');
            const builder = createBuilder({ data: null, error: dbError });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await expect(storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID))
                .rejects.toThrow('Connection failed');
        });

        it('queries store_entitlements and store_usage_counters scoped to store', async () => {
            const subBuilder = createBuilder({ data: MOCK_SUBSCRIPTION_ROW, error: null });
            const planBuilder = createBuilder({ data: MOCK_PLAN_ROW, error: null });
            const entBuilder = createBuilder({ data: MOCK_ENTITLEMENT_ROWS, error: null });
            const usageBuilder = createBuilder({ data: MOCK_USAGE_ROWS, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(subBuilder)
                .mockReturnValueOnce(planBuilder)
                .mockReturnValueOnce(entBuilder)
                .mockReturnValueOnce(usageBuilder);

            await storeSubscriptionService.getSubscriptionStatus(MOCK_STORE_ID);

            expect(supabase.from).toHaveBeenNthCalledWith(3, 'store_entitlements');
            expect(entBuilder.eq).toHaveBeenCalledWith('store_id', MOCK_STORE_ID);

            expect(supabase.from).toHaveBeenNthCalledWith(4, 'store_usage_counters');
            expect(usageBuilder.eq).toHaveBeenCalledWith('store_id', MOCK_STORE_ID);
        });
    });
});