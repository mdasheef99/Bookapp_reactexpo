import type { GoogleBook } from './booksService';

interface CacheEntry {
    items: GoogleBook[];
    timestamp: number;
}

const MAX_ENTRIES = 20;
const TTL_MS = 60_000; // 60 seconds
const STALE_TTL_MS = 300_000; // 5 minutes (for 429 fallback)

const cache = new Map<string, CacheEntry>();

function getCacheKey(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCachedSearchResults(query: string): { items: GoogleBook[]; isStale: boolean } | null {
    const key = getCacheKey(query);
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

export function setCachedSearchResults(query: string, items: GoogleBook[]): void {
    const key = getCacheKey(query);
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
