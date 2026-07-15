import type { GroupedBookResult, MarketplaceListingOffer } from '../types';

export interface MarketplacePageOptions {
    page?: number;
    pageSize?: number;
}

export function normalizePage(options: MarketplacePageOptions = {}) {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize ?? 20)));
    const from = (page - 1) * pageSize;
    return { page, pageSize, from, to: from + pageSize - 1 };
}

export function cleanText(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed || null;
}

export function normalizeIsbn(value?: string | null): string | null {
    return cleanText(value)?.replace(/[-\s]/g, '').toUpperCase() ?? null;
}

export function looksLikeIsbn(query: string): boolean {
    const normalized = normalizeIsbn(query);
    return Boolean(normalized && (/^\d{9}[\dX]$/.test(normalized) || /^\d{13}$/.test(normalized)));
}

export function quotedIlikeFilter(value: string): string {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
    return `"%${escaped}%"`;
}

function normalizeSearchKey(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function groupingKeyForOffer(offer: MarketplaceListingOffer): string {
    if (offer.canonicalEditionId) return `edition:${offer.canonicalEditionId}`;
    if (offer.isbn13) return `isbn13:${offer.isbn13}`;
    const authorKey = offer.publicAuthors?.map(normalizeSearchKey).filter(Boolean).join('|') ?? '';
    return `title:${normalizeSearchKey(offer.publicTitle)}|${authorKey}`;
}

export function groupOffers(offers: MarketplaceListingOffer[]): GroupedBookResult[] {
    const groups = new Map<string, MarketplaceListingOffer[]>();
    offers.forEach((offer) => {
        const key = groupingKeyForOffer(offer);
        groups.set(key, [...(groups.get(key) ?? []), offer]);
    });

    return Array.from(groups.entries()).map(([groupingKey, entries]) => {
        const first = entries[0];
        return {
            groupingKey,
            title: first.publicTitle,
            authors: first.publicAuthors,
            isbn13: first.isbn13,
            coverUrl: first.publicCoverUrl,
            offerCount: entries.length,
            lowestPriceMinor: Math.min(...entries.map((offer) => offer.sellingPriceMinor)),
            offers: entries,
        };
    });
}
