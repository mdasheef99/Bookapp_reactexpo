import type { StoreViewItem } from '../contracts/storeViewContracts';

export const EFFECTIVE_STATE_LABELS: Record<StoreViewItem['lifecycle']['effectiveState'], string> = {
    private: 'Private',
    live: 'Live',
    paused: 'Paused',
    needs_attention: 'Needs Attention',
    publication_failed: 'Publication Failed',
    out_of_stock: 'Out of Stock',
};

export const FILTER_LABELS = {
    all: 'All',
    private: 'Private',
    live: 'Live',
    paused: 'Paused',
    needs_attention: 'Needs Attention',
    out_of_stock: 'Out of Stock',
} as const;

export function formatCondition(value: StoreViewItem['presentation']['condition']): string {
    return value.split('_').map((part) => (
        part.charAt(0).toUpperCase() + part.slice(1)
    )).join(' ');
}

export function formatPrice(value: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(value / 100);
}

export function stockLabel(item: StoreViewItem): string {
    if (item.stockSummary.stockState === 'out_of_stock') return 'Out of stock';
    if (item.stockSummary.stockState === 'low_stock') return 'Low stock · 1 available';
    return `${item.stockSummary.quantityAvailable} available`;
}
