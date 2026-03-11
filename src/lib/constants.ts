// Search component constants
export const RECENT_SEARCHES_KEY = 'booktalks_recent_searches';
export const MAX_RECENT_SEARCHES = 5;

// Genre color mapping
export const GENRE_COLORS: Record<string, string> = {
    'Fiction': '#8B5CF6',
    'Non-Fiction': '#10B981',
    'Mystery': '#6366F1',
    'Romance': '#EC4899',
    'Science Fiction': '#06B6D4',
    'Fantasy': '#A855F7',
    'Biography': '#F59E0B',
    'History': '#EF4444',
    'Self-Help': '#14B8A6',
    'Business': '#3B82F6',
    'Children': '#F97316',
    'Young Adult': '#D946EF',
    'Horror': '#DC2626',
    'Thriller': '#7C3AED',
    'Poetry': '#F472B6',
    'default': '#6B7280',
};

// Sort options
export type SortOption = 'relevance' | 'rating' | 'newest' | 'title';
export const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
    { value: 'relevance', label: 'Relevance', icon: 'sparkles' },
    { value: 'rating', label: 'Highest Rated', icon: 'star' },
    { value: 'newest', label: 'Newest First', icon: 'calendar' },
    { value: 'title', label: 'Title A-Z', icon: 'text' },
];
