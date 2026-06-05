import type { DeliveryOption } from '@/features/exchange/services/listingsService';

export interface DeliveryOptionMeta {
    value: DeliveryOption;
    label: string;
    emoji: string;
    filterLabel: string;
    icon: string;
    enabled: boolean;
}

export const DELIVERY_OPTION_META: Record<DeliveryOption, DeliveryOptionMeta> = {
    meetup: {
        value: 'meetup',
        label: 'Meetup',
        emoji: '🤝',
        filterLabel: '🤝 Meetup',
        icon: 'people-outline',
        enabled: true,
    },
    porter: {
        value: 'porter',
        label: 'Porter',
        emoji: '🚲',
        filterLabel: '🚲 Porter',
        icon: 'bicycle-outline',
        enabled: false,
    },
    dunzo: {
        value: 'dunzo',
        label: 'Dunzo',
        emoji: '🚗',
        filterLabel: '🚗 Dunzo',
        icon: 'car-outline',
        enabled: false,
    },
};

export const exchangeCapabilities = {
    paymentsEnabled: false,
    deliveryOptions: DELIVERY_OPTION_META,
} as const;

export const ENABLED_DELIVERY_OPTIONS = Object.values(DELIVERY_OPTION_META)
    .filter(option => option.enabled)
    .map(option => option.value);

export function isDeliveryOptionEnabled(option: DeliveryOption): boolean {
    return DELIVERY_OPTION_META[option]?.enabled ?? false;
}

export function getEnabledDeliveryOptions(options: DeliveryOption[]): DeliveryOption[] {
    return options.filter(isDeliveryOptionEnabled);
}

export function getDefaultRequestDeliveryOption(options: DeliveryOption[]): DeliveryOption | null {
    return getEnabledDeliveryOptions(options)[0] ?? null;
}
