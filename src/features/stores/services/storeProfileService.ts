import { supabase } from '@/lib/supabase';
import type { StoreProfile, StoreProfileInput } from '../types';

export const RETURN_POLICY_TYPES = [
    'no_returns',
    'no_returns_except_wrong_item',
    'returns_within_3_days',
    'returns_within_7_days',
] as const;

export const OPERATING_HOURS_DAYS = [
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday',
] as const;

type DayEntry = {
    open: string | null;
    close: string | null;
    closed: boolean;
};

type DbProfileRow = {
    id: string;
    display_name: string | null;
    description: string | null;
    logo_url: string | null;
    cover_url: string | null;
    operating_hours: unknown;
    pickup_enabled: boolean | null;
    delivery_enabled: boolean | null;
    minimum_delivery_order_value_minor: number | null;
    return_policy_type: string | null;
    payout_account_status: string | null;
};

const PROFILE_SELECT = [
    'id',
    'display_name',
    'description',
    'logo_url',
    'cover_url',
    'operating_hours',
    'pickup_enabled',
    'delivery_enabled',
    'minimum_delivery_order_value_minor',
    'return_policy_type',
    'payout_account_status',
].join(', ');

function toCamelCase(row: DbProfileRow): StoreProfile {
    return {
        storeId: row.id,
        displayName: row.display_name ?? '',
        description: row.description ?? null,
        logoUrl: row.logo_url ?? null,
        coverUrl: row.cover_url ?? null,
        operatingHours: (row.operating_hours as Record<string, unknown>) ?? {},
        pickupEnabled: row.pickup_enabled ?? false,
        deliveryEnabled: row.delivery_enabled ?? false,
        minimumDeliveryOrderValueMinor: row.minimum_delivery_order_value_minor ?? null,
        returnPolicyType: row.return_policy_type ?? 'no_returns',
        payoutAccountStatus: row.payout_account_status ?? 'not_started',
    };
}

function validateReturnPolicyType(value: string): void {
    if (!RETURN_POLICY_TYPES.includes(value as typeof RETURN_POLICY_TYPES[number])) {
        throw new Error('Invalid return_policy_type');
    }
}

function isTime(value: unknown): value is string {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validateOperatingHours(hours: Record<string, unknown>): void {
    const missingDays = OPERATING_HOURS_DAYS.filter((day) => !(day in hours));
    if (missingDays.length > 0) {
        throw new Error('operating_hours must include all 7 days');
    }

    if (!('temporary_closure' in hours)) {
        throw new Error('operating_hours must include temporary_closure');
    }

    if (typeof hours.temporary_closure !== 'boolean') {
        throw new Error('temporary_closure must be a boolean');
    }

    for (const day of OPERATING_HOURS_DAYS) {
        const entry = hours[day] as DayEntry | undefined;
        if (!entry || typeof entry !== 'object') {
            throw new Error(`operating_hours day ${day} must be an object with open, close, closed`);
        }
        if (typeof entry.closed !== 'boolean') {
            throw new Error(`operating_hours day ${day}: closed must be a boolean`);
        }
        if (entry.closed) {
            if (entry.open !== null || entry.close !== null) {
                throw new Error(`operating_hours day ${day}: closed days must use null open and close`);
            }
            continue;
        }
        if (!isTime(entry.open)) {
            throw new Error(`operating_hours day ${day}: open time is required`);
        }
        if (!isTime(entry.close)) {
            throw new Error(`operating_hours day ${day}: close time is required`);
        }
        if (entry.open >= entry.close) {
            throw new Error(`operating_hours day ${day}: open time must be before close time`);
        }
    }
}

export const storeProfileService = {
    async getProfile(storeId: string): Promise<StoreProfile> {
        const { data, error } = await supabase
            .from('stores')
            .select(PROFILE_SELECT)
            .eq('id', storeId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Store not found');

        return toCamelCase(data as unknown as DbProfileRow);
    },

    async updateProfile(storeId: string, input: StoreProfileInput): Promise<StoreProfile> {
        if (input.returnPolicyType !== undefined) {
            validateReturnPolicyType(input.returnPolicyType);
        }

        if (input.operatingHours !== undefined) {
            validateOperatingHours(input.operatingHours as Record<string, unknown>);
        }

        const { data, error } = await supabase.functions.invoke('store-profile', {
            body: { type: 'update_profile', storeId, payload: input },
        });

        if (error) throw error;
        if (!data?.profile) throw new Error('Store profile update returned no profile');

        return toCamelCase(data.profile as DbProfileRow);
    },

    async completeSetup(storeId: string): Promise<void> {
        const { error } = await supabase.functions.invoke('store-profile', {
            body: { type: 'complete_setup', storeId },
        });

        if (error) throw error;
    },
};
