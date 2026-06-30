import { supabase } from '@/lib/supabase';
import { storeDashboardService } from '../storeDashboardService';

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

describe('storeDashboardService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function mockQueries({
        inventory = { data: [], error: null },
        entitlements = { data: [], error: null },
        usage = { data: [], error: null },
        subscription = { data: null, error: null },
        plan = { data: null, error: null },
        store = { data: null, error: null },
    }: {
        inventory?: { data: unknown; error: Error | null };
        entitlements?: { data: unknown; error: Error | null };
        usage?: { data: unknown; error: Error | null };
        subscription?: { data: unknown; error: Error | null };
        plan?: { data: unknown; error: Error | null };
        store?: { data: unknown; error: Error | null };
    } = {}) {
        const inventoryBuilder = createBuilder(inventory);
        const entitlementBuilder = createBuilder(entitlements);
        const usageBuilder = createBuilder(usage);
        const subscriptionBuilder = createBuilder(subscription);
        const planBuilder = createBuilder(plan);
        const storeBuilder = createBuilder(store);

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'store_inventory') return inventoryBuilder;
            if (table === 'store_entitlements') return entitlementBuilder;
            if (table === 'store_usage_counters') return usageBuilder;
            if (table === 'store_subscriptions') return subscriptionBuilder;
            if (table === 'store_subscription_plans') return planBuilder;
            if (table === 'stores') return storeBuilder;
            return createBuilder({ data: null, error: null });
        });

        return { inventoryBuilder, entitlementBuilder, usageBuilder, subscriptionBuilder, planBuilder, storeBuilder };
    }

    describe('getDashboardData', () => {
        it('aggregates inventory counts by visibility status from the owner store', async () => {
            const { inventoryBuilder } = mockQueries({
                inventory: {
                    data: [
                        { visibility_status: 'published', quantity_available: 5 },
                        { visibility_status: 'published', quantity_available: 1 },
                        { visibility_status: 'draft', quantity_available: 3 },
                        { visibility_status: 'paused', quantity_available: 2 },
                        { visibility_status: 'published', quantity_available: 0 },
                    ],
                    error: null,
                },
            });

            const result = await storeDashboardService.getDashboardData('store-1');

            expect(result.inventoryCounts).toEqual({
                total: 5,
                published: 3,
                draft: 1,
                paused: 1,
                lowStock: 1,
                outOfStock: 1,
            });
        });

        it('queries store_inventory scoped to the store owner', async () => {
            const { inventoryBuilder } = mockQueries();

            await storeDashboardService.getDashboardData('store-1');

            expect(supabase.from).toHaveBeenCalledWith('store_inventory');
            expect(inventoryBuilder.eq).toHaveBeenCalledWith('store_id', 'store-1');
            expect(inventoryBuilder.select).toHaveBeenCalledWith('visibility_status, quantity_available');
        });

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

        it('never selects private inventory columns in the dashboard query', async () => {
            const { inventoryBuilder } = mockQueries({
                inventory: { data: [], error: null },
            });

            await storeDashboardService.getDashboardData('store-1');

            const selectedColumns = inventoryBuilder.select.mock.calls[0]?.[0] ?? '';
            expect(selectedColumns).not.toContain('acquisition_cost_minor');
            expect(selectedColumns).not.toContain('shelf_location');
            expect(selectedColumns).not.toContain('internal_notes');
            expect(selectedColumns).not.toContain('metadata_confidence');
            expect(selectedColumns).not.toContain('duplicate_resolution_state');
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
