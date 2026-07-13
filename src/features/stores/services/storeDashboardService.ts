import { supabase } from '@/lib/supabase';
import type {
    DashboardInventoryCounts,
    DashboardQuotaUsage,
    DashboardSubscriptionStatus,
    DashboardComplianceBlocker,
    StoreDashboardData,
} from '../types';

type InventoryCountRow = {
    visibility_status: string;
    quantity_available: number;
};

type EntitlementRow = {
    feature_key: string;
    limit_value: number | null;
    is_enabled: boolean;
};

type UsageCounterRow = {
    counter_key: string;
    used_value: number;
};

type SubscriptionRow = {
    status: string;
    plan_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
};

type PlanRow = {
    name: string;
};

type StoreComplianceRow = {
    payout_account_status?: string | null;
    seller_agreement_accepted_at?: string | null;
    prohibited_items_policy_accepted_at?: string | null;
    support_policy_accepted_at?: string | null;
};

const ENTITLEMENT_KEYS = ['inventory_item_limit', 'monthly_image_extraction_limit', 'active_listing_limit'] as const;

export const storeDashboardService = {
    async getDashboardData(storeId: string): Promise<StoreDashboardData> {
        const { data: inventoryRows, error: inventoryError } = await supabase
            .from('store_inventory')
            .select('visibility_status, quantity_available')
            .eq('store_id', storeId);

        if (inventoryError) throw inventoryError;

        const { data: entitlementRows, error: entitlementError } = await supabase
            .from('store_entitlements')
            .select('feature_key, limit_value, is_enabled')
            .eq('store_id', storeId);

        if (entitlementError) throw entitlementError;

        const { data: usageRows, error: usageError } = await supabase
            .from('store_usage_counters')
            .select('counter_key, used_value')
            .eq('store_id', storeId);

        if (usageError) throw usageError;

        const { data: subscriptionRow, error: subscriptionError } = await supabase
            .from('store_subscriptions')
            .select('status, plan_id, current_period_start, current_period_end')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (subscriptionError) throw subscriptionError;

        const { data: complianceRow, error: complianceError } = await supabase
            .from('stores')
            .select([
                'payout_account_status',
                'seller_agreement_accepted_at',
                'prohibited_items_policy_accepted_at',
                'support_policy_accepted_at',
            ].join(', '))
            .eq('id', storeId)
            .maybeSingle();

        if (complianceError) throw complianceError;

        let planName: string | null = null;
        if (subscriptionRow?.plan_id) {
            const { data: planRow } = await supabase
                .from('store_subscription_plans')
                .select('name')
                .eq('id', (subscriptionRow as SubscriptionRow).plan_id)
                .maybeSingle();

            planName = (planRow as PlanRow | null)?.name ?? null;
        }

        return {
            storeId,
            inventoryCounts: computeInventoryCounts((inventoryRows ?? []) as InventoryCountRow[]),
            quotaUsage: computeQuotaUsage(
                (entitlementRows ?? []) as EntitlementRow[],
                (usageRows ?? []) as UsageCounterRow[],
            ),
            subscriptionStatus: {
                status: (subscriptionRow as SubscriptionRow | null)?.status ?? 'not_started',
                planName,
                currentPeriodStart: (subscriptionRow as SubscriptionRow | null)?.current_period_start ?? null,
                currentPeriodEnd: (subscriptionRow as SubscriptionRow | null)?.current_period_end ?? null,
            },
            complianceBlockers: computeComplianceBlockers(complianceRow as StoreComplianceRow | null),
        };
    },
};

function computeInventoryCounts(rows: InventoryCountRow[]): DashboardInventoryCounts {
    const counts: DashboardInventoryCounts = {
        total: rows.length,
        published: 0,
        draft: 0,
        paused: 0,
        lowStock: 0,
        outOfStock: 0,
    };

    rows.forEach((row) => {
        const vs = row.visibility_status;
        if (vs === 'published') counts.published++;
        else if (vs === 'draft') counts.draft++;
        else if (vs === 'paused') counts.paused++;

        if (row.quantity_available === 0) counts.outOfStock++;
        else if (row.quantity_available === 1) counts.lowStock++;
    });

    return counts;
}

function getUsedValue(counterKey: string, usageRows: UsageCounterRow[]) {
    const match = usageRows.find((row) => row.counter_key === counterKey);
    return match?.used_value ?? 0;
}

function getLimitValue(featureKey: string, entitlementRows: EntitlementRow[]) {
    const match = entitlementRows.find((row) => row.feature_key === featureKey);
    if (!match || !match.is_enabled) return null;
    return match.limit_value;
}

function computeQuotaUsage(entitlements: EntitlementRow[], usageRows: UsageCounterRow[]): DashboardQuotaUsage {
    return {
        inventoryItemLimit: getLimitValue('inventory_item_limit', entitlements),
        inventoryItemUsed: getUsedValue('inventory_item_limit', usageRows) || 0,
        monthlyImageExtractionLimit: getLimitValue('monthly_image_extraction_limit', entitlements),
        monthlyImageExtractionUsed: getUsedValue('monthly_image_extraction_limit', usageRows) || 0,
        activeListingLimit: getLimitValue('active_listing_limit', entitlements),
        activeListingUsed: getUsedValue('active_listing_limit', usageRows) || 0,
    };
}

function computeComplianceBlockers(row: StoreComplianceRow | null): DashboardComplianceBlocker[] {
    const payoutReady = row?.payout_account_status === 'verified' || row?.payout_account_status === 'ready';
    return [
        { key: 'payout', label: payoutReady ? 'Payout account ready' : 'Payout account not ready', isBlocked: !payoutReady },
        {
            key: 'seller_agreement',
            label: row?.seller_agreement_accepted_at ? 'Seller agreement accepted' : 'Seller agreement not accepted',
            isBlocked: !row?.seller_agreement_accepted_at,
        },
        {
            key: 'prohibited_items_policy',
            label: row?.prohibited_items_policy_accepted_at ? 'Prohibited-items policy accepted' : 'Prohibited-items policy not accepted',
            isBlocked: !row?.prohibited_items_policy_accepted_at,
        },
        {
            key: 'support_policy',
            label: row?.support_policy_accepted_at ? 'Support policy accepted' : 'Support policy not accepted',
            isBlocked: !row?.support_policy_accepted_at,
        },
    ];
}
