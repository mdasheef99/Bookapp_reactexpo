import { supabase } from '@/lib/supabase';
import type { StoreSubscriptionStatus } from '../types';

type SubscriptionRow = {
    status: string;
    plan_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
};

type PlanRow = {
    name: string;
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

export const storeSubscriptionService = {
    async getSubscriptionStatus(storeId: string): Promise<StoreSubscriptionStatus> {
        const { data: subscriptionRow, error: subscriptionError } = await supabase
            .from('store_subscriptions')
            .select('status, plan_id, current_period_start, current_period_end')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (subscriptionError) throw subscriptionError;

        let planName: string | null = null;
        const sub = subscriptionRow as SubscriptionRow | null;

        if (sub?.plan_id) {
            const { data: planRow } = await supabase
                .from('store_subscription_plans')
                .select('name')
                .eq('id', sub.plan_id)
                .maybeSingle();

            planName = (planRow as PlanRow | null)?.name ?? null;
        }

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

        const entitlements = ((entitlementRows ?? []) as EntitlementRow[]).map((ent) => {
            const usageMatch = ((usageRows ?? []) as UsageCounterRow[]).find(
                (u) => u.counter_key === ent.feature_key,
            );
            return {
                featureKey: ent.feature_key,
                limitValue: ent.limit_value,
                isEnabled: ent.is_enabled,
                usedValue: usageMatch?.used_value ?? 0,
            };
        });

        return {
            storeId,
            status: sub?.status ?? 'not_started',
            planName,
            currentPeriodStart: sub?.current_period_start ?? null,
            currentPeriodEnd: sub?.current_period_end ?? null,
            entitlements,
        };
    },
};