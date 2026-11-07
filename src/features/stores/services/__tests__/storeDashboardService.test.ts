import { supabase } from '@/lib/supabase';
import { storeDashboardService } from '../storeDashboardService';

jest.mock('@/lib/supabase');

const ZERO_COUNTS = { total: 0, published: 0, draft: 0, paused: 0, lowStock: 0, outOfStock: 0 };

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

describe('storeDashboardService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function mockQueries({
        rpc = { data: ZERO_COUNTS, error: null },
        entitlements = { data: [], error: null },
        usage = { data: [], error: null },
        subscription = { data: null, error: null },
        plan = { data: null, error: null },
        store = { data: null, error: null },
    }: {
        rpc?: { data: unknown; error: Error | null };
        entitlements?: { data: unknown; error: Error | null };
        usage?: { data: unknown; error: Error | null };
        subscription?: { data: unknown; error: Error | null };
        plan?: { data: unknown; error: Error | null };
        store?: { data: unknown; error: Error | null };
    } = {}) {
        const entitlementBuilder = createBuilder(entitlements);
        const usageBuilder = createBuilder(usage);
        const subscriptionBuilder = createBuilder(subscription);
        const planBuilder = createBuilder(plan);
        const storeBuilder = createBuilder(store);

        (supabase.rpc as jest.Mock).mockResolvedValue(rpc);
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'store_entitlements') return entitlementBuilder;
            if (table === 'store_usage_counters') return usageBuilder;
            if (table === 'store_subscriptions') return subscriptionBuilder;
            if (table === 'store_subscription_plans') return planBuilder;
            if (table === 'stores') return storeBuilder;
            return createBuilder({ data: null, error: null });
        });

        return { entitlementBuilder, usageBuilder, subscriptionBuilder, planBuilder, storeBuilder };
    }

    describe('getDashboardData', () => {
        it('returns the server inventory counts unchanged, including quantity/visibility overlap', async () => {
            const payload = { total: 5, published: 3, draft: 1, paused: 1, lowStock: 2, outOfStock: 1 };
            mockQueries({ rpc: { data: payload, error: null } });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(result.inventoryCounts).toEqual(payload);
        });

        it('passes the gate store id to the dashboard counts RPC exactly once and never reads store_inventory', async () => {
            mockQueries();

            await storeDashboardService.getDashboardData('store-1');

            expect(supabase.rpc).toHaveBeenCalledTimes(1);
            expect((supabase.rpc as jest.Mock).mock.calls[0]).toEqual([
                'phase9_owner_dashboard_inventory_counts_v1',
                { p_store_id: 'store-1' },
            ]);
            expect(supabase.from).not.toHaveBeenCalledWith('store_inventory');
        });

        const malformedCounts: Array<[string, unknown]> = [
            ['null', null],
            ['an array', []],
            ['a string', 'counts'],
            ['a Date', new Date()],
            ['a missing key', { total: 0, published: 0, draft: 0, paused: 0, lowStock: 0 }],
            ['an extra key', { ...ZERO_COUNTS, extra: 0 }],
            ['a negative count', { ...ZERO_COUNTS, draft: -1 }],
            ['a fractional count', { ...ZERO_COUNTS, draft: 1.5 }],
            ['NaN', { ...ZERO_COUNTS, draft: Number.NaN }],
            ['Infinity', { ...ZERO_COUNTS, draft: Number.POSITIVE_INFINITY }],
            ['a numeric string', { ...ZERO_COUNTS, draft: '0' }],
        ];
        it.each(malformedCounts)('rejects a malformed dashboard counts payload: %s', async (_label, payload) => {
            mockQueries({ rpc: { data: payload, error: null } });

            await expect(storeDashboardService.getDashboardData('store-1')).rejects.toThrow();
        });

        it.each(['P9_OWNER_NOT_AUTHORIZED', 'P9_AUTH_REQUIRED', 'P9_INTERNAL_ERROR'] as const)(
            'rethrows the %s RPC error unchanged',
            async (message) => {
                const error = new Error(message);
                mockQueries({ rpc: { data: null, error } });

                await expect(storeDashboardService.getDashboardData('store-1')).rejects.toBe(error);
            },
        );

        it('reads limits from store_entitlements scoped to the owner store', async () => {
            const { entitlementBuilder } = mockQueries({
                entitlements: {
                    data: [
                        { feature_key: 'inventory_item_limit', limit_value: 100, is_enabled: true },
                        { feature_key: 'monthly_image_extraction_limit', limit_value: 25, is_enabled: true },
                        { feature_key: 'active_listing_limit', limit_value: 100, is_enabled: true },
                    ],
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(supabase.from).toHaveBeenCalledWith('store_entitlements');
            expect(entitlementBuilder.eq).toHaveBeenCalledWith('store_id', 'store-1');
            expect(result.quotaUsage.inventoryItemLimit).toBe(100);
            expect(result.quotaUsage.monthlyImageExtractionLimit).toBe(25);
            expect(result.quotaUsage.activeListingLimit).toBe(100);
        });

        it('treats missing usage counter rows as zero', async () => {
            mockQueries({
                entitlements: {
                    data: [
                        { feature_key: 'inventory_item_limit', limit_value: 100, is_enabled: true },
                    ],
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(result.quotaUsage.inventoryItemUsed).toBe(0);
        });

        it('reads usage from existing store_usage_counters rows', async () => {
            const { usageBuilder } = mockQueries({
                entitlements: {
                    data: [
                        { feature_key: 'inventory_item_limit', limit_value: 100, is_enabled: true },
                    ],
                    error: null,
                },
                usage: {
                    data: [
                        { counter_key: 'inventory_item_limit', used_value: 42 },
                    ],
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(supabase.from).toHaveBeenCalledWith('store_usage_counters');
            expect(usageBuilder.eq).toHaveBeenCalledWith('store_id', 'store-1');
            expect(result.quotaUsage.inventoryItemUsed).toBe(42);
        });

        it('reads subscription status scoped to the store', async () => {
            const { subscriptionBuilder } = mockQueries({
                subscription: {
                    data: {
                        status: 'trialing',
                        plan_id: 'plan-1',
                        current_period_start: '2026-06-01T00:00:00Z',
                        current_period_end: '2026-09-01T00:00:00Z',
                    },
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(supabase.from).toHaveBeenCalledWith('store_subscriptions');
            expect(subscriptionBuilder.eq).toHaveBeenCalledWith('store_id', 'store-1');
            expect(result.subscriptionStatus.status).toBe('trialing');
            expect(result.subscriptionStatus.planName).toBeNull();
        });

        it('shows plan name when plan_id matches a store_subscription_plans row', async () => {
            mockQueries({
                subscription: {
                    data: { status: 'trialing', plan_id: 'plan-1' },
                    error: null,
                },
                plan: {
                    data: { name: 'Founding Trial' },
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(result.subscriptionStatus.planName).toBe('Founding Trial');
        });

        it('returns compliance blockers from store readiness fields', async () => {
            const { storeBuilder } = mockQueries({
                store: {
                    data: {
                        payout_account_status: 'not_started',
                        seller_agreement_accepted_at: null,
                        prohibited_items_policy_accepted_at: '2026-06-01T00:00:00Z',
                        support_policy_accepted_at: null,
                    },
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(supabase.from).toHaveBeenCalledWith('stores');
            expect(storeBuilder.eq).toHaveBeenCalledWith('id', 'store-1');
            expect(result.complianceBlockers).toEqual([
                { key: 'payout', label: 'Payout account not ready', isBlocked: true },
                { key: 'seller_agreement', label: 'Seller agreement not accepted', isBlocked: true },
                { key: 'prohibited_items_policy', label: 'Prohibited-items policy accepted', isBlocked: false },
                { key: 'support_policy', label: 'Support policy not accepted', isBlocked: true },
            ]);
        });
    });
});
