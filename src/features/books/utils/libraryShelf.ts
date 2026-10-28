export type LibraryFilter = 'all' | 'reading' | 'completed' | 'wishlist';

export type LibraryBookEntry = {
    id: string;
    reading_status: string | null;
    ownership: string | null;
    available_for_lending?: boolean | null;
    condition?: string | null;
    rating?: number | null;
    review?: string | null;
    book: {
        title: string;
        authors?: string[] | null;
        cover_url?: string | null;
        page_count?: number | null;
    };
};

export type LibraryFilterChip = {
    key: LibraryFilter;
    label: string;
    count: number;
};

export function getLibraryFilterChips(entries: LibraryBookEntry[]): LibraryFilterChip[] {
    return [
        { key: 'all', label: 'All', count: filterLibraryBooks(entries, 'all').length },
        { key: 'reading', label: 'Reading', count: filterLibraryBooks(entries, 'reading').length },
        { key: 'completed', label: 'Finished', count: filterLibraryBooks(entries, 'completed').length },
        { key: 'wishlist', label: 'Wishlist', count: filterLibraryBooks(entries, 'wishlist').length },
    ];
}

export function filterLibraryBooks(entries: LibraryBookEntry[], activeFilter: LibraryFilter): LibraryBookEntry[] {
    if (activeFilter === 'all') return entries;
    if (activeFilter === 'wishlist') {
        return entries.filter((item) => item.ownership === 'wishlist');
    }

    return entries.filter((item) => item.reading_status === activeFilter && item.ownership !== 'wishlist');
}

export function getLibraryFilterLabel(filterChips: LibraryFilterChip[], activeFilter: LibraryFilter) {
    return filterChips.find((chip) => chip.key === activeFilter)?.label ?? 'All';
}

/** A label narrows the existing order before status filtering and chip counts. */
export function filterLibraryByLabel(entries: LibraryBookEntry[], memberships: readonly { entity_id: string; target_id: string }[], labelId: string): LibraryBookEntry[] {
    if (!labelId) return entries;
    const ids = new Set(memberships.filter(row => row.entity_id === labelId).map(row => row.target_id));
    return entries.filter(entry => ids.has(entry.id));
}
