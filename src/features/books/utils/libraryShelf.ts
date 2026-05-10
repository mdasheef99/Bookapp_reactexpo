export type LibraryFilter = 'all' | 'reading' | 'completed' | 'wishlist';

export type LibraryBookEntry = {
    id: string;
    reading_status: string | null;
    ownership: string | null;
    available_for_lending?: boolean | null;
    book: {
        title: string;
        authors?: string[] | null;
        cover_url?: string | null;
    };
};

export type LibraryFilterChip = {
    key: LibraryFilter;
    label: string;
    count: number;
};

export function getLibraryFilterChips(entries: LibraryBookEntry[]): LibraryFilterChip[] {
    return [
        { key: 'all', label: 'All', count: entries.length },
        { key: 'reading', label: 'Reading', count: entries.filter((item) => item.reading_status === 'reading').length },
        { key: 'completed', label: 'Completed', count: entries.filter((item) => item.reading_status === 'completed').length },
        { key: 'wishlist', label: 'Wishlist', count: entries.filter((item) => item.ownership === 'wishlist').length },
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
