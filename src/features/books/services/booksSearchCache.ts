import type { GoogleBook } from './booksService';

interface CacheEntry {
    items: GoogleBook[];
    timestamp: number;
}

const MAX_ENTRIES = 20;
const TTL_MS = 60_000; // 60 seconds
const STALE_TTL_MS = 300_000; // 5 minutes (for 429 fallback)

const cache = new Map<string, CacheEntry>();

function getCacheKey(query: string, filters?: Record<string, unknown>, startIndex?: number, maxResults?: number): string {
    const base = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const filterKey = filters ? JSON.stringify(filters) : '';
    return `${base}|${filterKey}|${startIndex ?? 0}|${maxResults ?? 20}`;
}

export function getCachedSearchResults(query: string, filters?: Record<string, unknown>, startIndex?: number, maxResults?: number): { items: GoogleBook[]; isStale: boolean } | null {
    const key = getCacheKey(query, filters, startIndex, maxResults);
    const entry = cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age <= TTL_MS) {
        return { items: entry.items, isStale: false };
    }
    if (age <= STALE_TTL_MS) {
        return { items: entry.items, isStale: true };
    }
    cache.delete(key);
    return null;
}

export function setCachedSearchResults(query: string, items: GoogleBook[], filters?: Record<string, unknown>, startIndex?: number, maxResults?: number): void {
    const key = getCacheKey(query, filters, startIndex, maxResults);
    cache.set(key, { items, timestamp: Date.now() });

    // LRU eviction
    while (cache.size > MAX_ENTRIES) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
            cache.delete(firstKey);
        }
    }
}

export function clearSearchCache(): void {
    cache.clear();
}
