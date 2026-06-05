# Venues Frontend Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Clubs-first venue discovery and club venue-linking frontend from `docs/features/VENUES_FRONTEND_FEATURE_SPEC.md`.

**Architecture:** Add a standalone `src/features/venues/` module for venue reads, reusable cards, browse/detail screens, and a picker surface. Clubs consumes that module through routes, browse entry points, event selection, and a Manage Club venue section; Exchange and venue-owner flows remain documented but untouched.

**Tech Stack:** Expo Router, React Native, Supabase JS, TanStack Query, Jest, `@testing-library/react-native`, TypeScript.

---

## Scope Guard

This plan implements Phase 1 only:

- Clubs venue browse and detail.
- Club admin venue linking, unlinking, and primary venue marking.
- Event editor selection from linked venues with manual location fallback preserved.
- Route/test coverage and TypeScript verification.

This plan does not implement:

- Exchange pickup venue selection.
- Venue owner registration/manage.
- Admin venue verification.
- Map UI or `react-native-maps`.
- Geospatial radius search.
- A new bottom tab.

---

## File Structure

Create:

- `src/features/venues/services/venuesService.types.ts`
  - Venue domain types and filter input types.
- `src/features/venues/services/venuesService.ts`
  - Direct reads from `venues`, public approved venue browse/detail, club/event relationship reads where allowed.
- `src/features/venues/hooks/useVenues.ts`
  - TanStack Query keys and hooks for venue browse/detail/relationships.
- `src/features/venues/components/VenueTypeBadge.tsx`
  - Small reusable type/status label.
- `src/features/venues/components/VenueCard.tsx`
  - Shared venue card used by browse, picker, and club manage.
- `src/features/venues/screens/VenuesBrowseScreen.tsx`
  - Clubs-scoped venue discovery screen.
- `src/features/venues/screens/VenueDetailScreen.tsx`
  - Venue detail screen with related clubs/events where available.
- `src/features/venues/screens/VenuePickerScreen.tsx`
  - Reusable picker screen for club venue linking and event flows.
- `src/features/venues/services/__tests__/venuesService.test.ts`
  - Service query tests.
- `src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx`
  - Browse screen behavior tests.
- `src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx`
  - Detail screen behavior tests.
- `src/features/clubs/screens/manage/ClubManageVenuesSection.tsx`
  - Admin UI for club venue links.
- `app/(tabs)/clubs/venues.tsx`
  - Clubs venue browse route.
- `app/(tabs)/clubs/venues/[venueId].tsx`
  - Clubs venue detail route.

Modify:

- `app/(tabs)/clubs/_layout.tsx`
  - Register new venue browse/detail routes.
- `app/(tabs)/clubs/index.tsx`
  - Add venue discovery entry point.
- `app/(tabs)/clubs/[clubId]/venues.tsx`
  - Route to the reusable venue picker with club context.
- `src/features/clubs/services/clubsService.types.ts`
  - Expand venue link summaries if needed.
- `src/features/clubs/services/clubsEventsService.ts`
  - Add club venue link mutations or delegate exports to a new service.
- `src/features/clubs/services/clubsService.ts`
  - Export venue-link methods through the existing aggregate service if the project pattern requires it.
- `src/features/clubs/hooks/useClubs.ts`
  - Add link/unlink/set-primary hooks and invalidation.
- `src/features/clubs/screens/ClubEventEditorScreen.tsx`
  - Keep linked venue flow; continue routing the "Browse all venues" action to `/clubs/${clubId}/venues` with the serialized editor draft.
- `src/features/clubs/screens/ClubManageScreen.tsx`
  - Add `venues` manage tab and pass handlers/data into the section.
- `src/features/clubs/screens/manage/index.ts`
  - Export `ClubManageVenuesSection`.
- `src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx`
  - Update or replace assertions for reusable picker behavior.
- `src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx`
  - Confirm manual fallback and linked venue path still work.
- `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`
  - Add venue management tab behavior.
- `app/(tabs)/clubs/__tests__/index.test.tsx`
  - Add Clubs browse venue discovery entry behavior.

---

## Task 1: Venue Service and Types

**Files:**

- Create: `src/features/venues/services/venuesService.types.ts`
- Create: `src/features/venues/services/venuesService.ts`
- Test: `src/features/venues/services/__tests__/venuesService.test.ts`

- [x] **Step 1: Write failing service tests**

Create `src/features/venues/services/__tests__/venuesService.test.ts`:

```typescript
jest.mock('@/lib/supabase');

import { venuesService } from '../venuesService';
import { supabase } from '@/lib/supabase';

function mockQuery(response: Record<string, any>) {
    const builder: any = {};
    const methods = ['select', 'eq', 'ilike', 'or', 'order', 'range', 'single'];
    methods.forEach((method) => { builder[method] = jest.fn(() => builder); });
    builder.then = jest.fn((resolve: any) => resolve(response));
    return builder;
}

function expectExplicitSelect(builder: any, expectedColumn: string) {
    const selectArg = builder.select.mock.calls[0]?.[0];
    expect(selectArg).toEqual(expect.stringContaining(expectedColumn));
    expect(selectArg).not.toContain('*');
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('venuesService', () => {
    it('reads approved venues with city, type, search, and pagination filters', async () => {
        const builder = mockQuery({
            data: [{ id: 'venue-1', name: 'Central Library', city: 'Bengaluru', venue_type: 'library', verification_status: 'approved' }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await venuesService.getApprovedVenues({
            city: 'Bengaluru',
            venueType: 'library',
            search: 'Central',
            limit: 12,
            offset: 6,
        });

        expect(supabase.from).toHaveBeenCalledWith('venues');
        expectExplicitSelect(builder, 'operating_hours');
        expect(builder.eq).toHaveBeenCalledWith('verification_status', 'approved');
        expect(builder.eq).toHaveBeenCalledWith('city', 'Bengaluru');
        expect(builder.eq).toHaveBeenCalledWith('venue_type', 'library');
        expect(builder.or).toHaveBeenCalledWith('name.ilike.%Central%,description.ilike.%Central%,address_line1.ilike.%Central%,address_line2.ilike.%Central%,city.ilike.%Central%');
        expect(builder.range).toHaveBeenCalledWith(6, 17);
        expect(result[0].name).toBe('Central Library');
    });

    it('sanitizes venue search terms before building the PostgREST or filter', async () => {
        const builder = mockQuery({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await venuesService.getApprovedVenues({ search: ' Central),name.ilike.%% ' });

        expect(builder.or).toHaveBeenCalledWith('name.ilike.%Central name ilike%,description.ilike.%Central name ilike%,address_line1.ilike.%Central name ilike%,address_line2.ilike.%Central name ilike%,city.ilike.%Central name ilike%');
    });

    it('reads a single approved venue by id', async () => {
        const builder = mockQuery({
            data: { id: 'venue-1', name: 'Central Library', verification_status: 'approved' },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await venuesService.getVenueById('venue-1');

        expect(supabase.from).toHaveBeenCalledWith('venues');
        expect(builder.eq).toHaveBeenCalledWith('id', 'venue-1');
        expect(builder.eq).toHaveBeenCalledWith('verification_status', 'approved');
        expect(builder.single).toHaveBeenCalled();
        expect(result.id).toBe('venue-1');
    });
});
```

- [x] **Step 2: Run service tests and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/services/__tests__/venuesService.test.ts
```

Expected: fail because `src/features/venues/services/venuesService.ts` does not exist.

- [x] **Step 3: Add venue types**

Create `src/features/venues/services/venuesService.types.ts`:

```typescript
export type VenueVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Venue {
    id: string;
    venue_code: string | null;
    name: string;
    description: string | null;
    venue_type: string;
    cover_url: string | null;
    photos: string[] | null;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    pincode: string;
    operating_hours: Record<string, unknown> | null;
    amenities: string[] | null;
    max_capacity: number | null;
    booking_required: boolean | null;
    owner_user_id: string | null;
    verification_status: VenueVerificationStatus | string | null;
    is_exchange_partner: boolean | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface VenueFilters {
    search?: string;
    city?: string;
    venueType?: string;
    limit?: number;
    offset?: number;
}
```

- [x] **Step 4: Add venue service implementation**

Create `src/features/venues/services/venuesService.ts`:

```typescript
import { supabase } from '@/lib/supabase';
import type { Venue, VenueFilters } from './venuesService.types';

const VENUE_SELECT = `
    id,
    venue_code,
    name,
    description,
    venue_type,
    cover_url,
    photos,
    address_line1,
    address_line2,
    city,
    state,
    pincode,
    operating_hours,
    amenities,
    max_capacity,
    booking_required,
    owner_user_id,
    verification_status,
    is_exchange_partner,
    created_at,
    updated_at
`;

function normalizeVenueSearchTerm(search?: string) {
    return search?.trim()
        .replace(/[%(),.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() ?? '';
}

function applyVenueFilters(query: any, filters: VenueFilters) {
    if (filters.city?.trim()) query = query.eq('city', filters.city.trim());
    if (filters.venueType?.trim()) query = query.eq('venue_type', filters.venueType.trim());
    const term = normalizeVenueSearchTerm(filters.search);
    if (term) {
        query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,address_line1.ilike.%${term}%,address_line2.ilike.%${term}%,city.ilike.%${term}%`);
    }
    return query;
}

export const venuesService = {
    async getApprovedVenues(filters: VenueFilters = {}): Promise<Venue[]> {
        const { limit = 20, offset = 0 } = filters;
        let query = supabase.from('venues').select(VENUE_SELECT)
            .eq('verification_status', 'approved')
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1);

        query = applyVenueFilters(query, filters);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as Venue[];
    },

    async getVenueById(venueId: string): Promise<Venue> {
        const { data, error } = await supabase.from('venues')
            .select(VENUE_SELECT)
            .eq('id', venueId)
            .eq('verification_status', 'approved')
            .single();

        if (error) throw error;
        return data as Venue;
    },
};
```

- [x] **Step 5: Run service tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/services/__tests__/venuesService.test.ts
```

Expected: pass.

- [x] **Step 6: Commit Task 1**

Run:

```powershell
git add src/features/venues/services src/features/venues/services/__tests__
git commit -m "feat: add venue service"
```

---

## Task 2: Venue Hooks, Cards, and Browse Screen

**Files:**

- Create: `src/features/venues/hooks/useVenues.ts`
- Create: `src/features/venues/components/VenueTypeBadge.tsx`
- Create: `src/features/venues/components/VenueCard.tsx`
- Create: `src/features/venues/screens/VenuesBrowseScreen.tsx`
- Test: `src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx`
- Modify: `app/(tabs)/clubs/index.tsx`

- [x] **Step 1: Write failing browse screen tests**

Create `src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx`:

```typescript
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

import { fireEvent, render } from '@testing-library/react-native';
import VenuesBrowseScreen from '../VenuesBrowseScreen';

const mockRouterPush = jest.fn();
const mockUseApprovedVenues = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#EEF2FF',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            error: '#EF4444',
        },
    }),
}));

jest.mock('@/features/venues/hooks/useVenues', () => ({
    useApprovedVenues: (...args: unknown[]) => mockUseApprovedVenues(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseApprovedVenues.mockReturnValue({
        data: [
            { id: 'venue-1', name: 'Central Library', venue_type: 'library', address_line1: '12 Main St', address_line2: null, city: 'Bengaluru', verification_status: 'approved', amenities: ['Wi-Fi'], booking_required: false },
            { id: 'venue-2', name: 'Chapter Cafe', venue_type: 'cafe', address_line1: '8 Park Road', address_line2: 'First floor', city: 'Bengaluru', verification_status: 'approved', amenities: [], booking_required: true },
        ],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    });
});

describe('VenuesBrowseScreen', () => {
    it('renders approved venue cards and opens venue detail', () => {
        const { getByText, getByTestId } = render(<VenuesBrowseScreen />);

        expect(getByText('Club venues')).toBeOnTheScreen();
        expect(getByText('Central Library')).toBeOnTheScreen();
        expect(getByText('Chapter Cafe')).toBeOnTheScreen();

        fireEvent.press(getByTestId('venue-card-venue-1'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/venues/venue-1');
    });

    it('passes search and venue type filters to the venue hook', () => {
        const { getByTestId } = render(<VenuesBrowseScreen />);

        fireEvent.changeText(getByTestId('venues-search-input'), 'library');
        fireEvent.press(getByTestId('venues-filter-type-library'));

        expect(mockUseApprovedVenues).toHaveBeenLastCalledWith(expect.objectContaining({
            search: 'library',
            venueType: 'library',
            limit: 20,
            offset: 0,
        }));
    });

    it('shows an empty state when no venues match', () => {
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByText } = render(<VenuesBrowseScreen />);

        expect(getByText('No venues matched this search')).toBeOnTheScreen();
        expect(getByText('Try another venue type, city, or search term.')).toBeOnTheScreen();
    });
});
```

- [x] **Step 2: Run browse tests and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx
```

Expected: fail because `VenuesBrowseScreen` and hooks/components do not exist.

- [x] **Step 3: Add venue hooks**

Create `src/features/venues/hooks/useVenues.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { venuesService } from '../services/venuesService';
import type { VenueFilters } from '../services/venuesService.types';

export const venueKeys = {
    all: ['venues'] as const,
    approved: (filters: VenueFilters = {}) => [...venueKeys.all, 'approved', filters] as const,
    detail: (venueId: string) => [...venueKeys.all, 'detail', venueId] as const,
};

export function useApprovedVenues(filters: VenueFilters = {}) {
    return useQuery({
        queryKey: venueKeys.approved(filters),
        queryFn: () => venuesService.getApprovedVenues(filters),
        staleTime: 30_000,
        retry: false,
    });
}

export function useVenueDetail(venueId: string | null) {
    return useQuery({
        queryKey: venueKeys.detail(venueId ?? ''),
        queryFn: () => venuesService.getVenueById(venueId!),
        enabled: !!venueId,
        staleTime: 30_000,
        retry: false,
    });
}
```

- [x] **Step 4: Add venue display components**

Create `src/features/venues/components/VenueTypeBadge.tsx`:

```typescript
import { StyleSheet, Text, View } from 'react-native';

function formatVenueType(value?: string | null) {
    if (!value) return 'Venue';
    return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function VenueTypeBadge({
    type,
    colors,
}: {
    type?: string | null;
    colors: { accent: string; accentLight: string };
}) {
    return (
        <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>{formatVenueType(type)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    badgeText: { fontSize: 12, fontWeight: '800' },
});
```

Create `src/features/venues/components/VenueCard.tsx`:

```typescript
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '../services/venuesService.types';
import { VenueTypeBadge } from './VenueTypeBadge';

type VenueCardColors = {
    bgCard: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    accentLight: string;
};

export function VenueCard({
    venue,
    colors,
    onPress,
    rightLabel,
}: {
    venue: Partial<Venue> & { id: string; name: string };
    colors: VenueCardColors;
    onPress?: (venue: Partial<Venue> & { id: string; name: string }) => void;
    rightLabel?: string;
}) {
    const address = [venue.address_line1, venue.address_line2, venue.city].filter(Boolean).join(', ');
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress?.(venue)}
            disabled={!onPress}
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            testID={`venue-card-${venue.id}`}
        >
            <View style={styles.headerRow}>
                <View style={styles.titleBlock}>
                    <Text style={[styles.name, { color: colors.textPrimary }]}>{venue.name}</Text>
                    {address ? <Text style={[styles.address, { color: colors.textSecondary }]}>{address}</Text> : null}
                </View>
                {rightLabel ? <Text style={[styles.rightLabel, { color: colors.accent }]}>{rightLabel}</Text> : null}
            </View>
            <View style={styles.footerRow}>
                <VenueTypeBadge type={venue.venue_type} colors={colors} />
                {venue.booking_required ? (
                    <View style={styles.metaPill}>
                        <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>Booking required</Text>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    titleBlock: { flex: 1 },
    name: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
    address: { fontSize: 13, lineHeight: 18 },
    rightLabel: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    footerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontWeight: '700' },
});
```

- [x] **Step 5: Add venue browse screen**

Create `src/features/venues/screens/VenuesBrowseScreen.tsx`:

```typescript
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useApprovedVenues } from '../hooks/useVenues';
import { VenueCard } from '../components/VenueCard';

const VENUE_TYPE_FILTERS: Array<{ label: string; value?: string }> = [
    { label: 'All places' },
    { label: 'Libraries', value: 'library' },
    { label: 'Bookstores', value: 'bookstore' },
    { label: 'Cafes', value: 'cafe' },
    { label: 'Coworking', value: 'coworking' },
    { label: 'Other', value: 'other' },
];

export default function VenuesBrowseScreen() {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
    const filters = useMemo(() => ({
        search: search.trim() || undefined,
        venueType: selectedType,
        limit: 20,
        offset: 0,
    }), [search, selectedType]);
    const { data: venues = [], isLoading, isError, refetch, isRefetching } = useApprovedVenues(filters);

    const renderFilter = ({ label, value }: { label: string; value?: string }) => {
        const selected = selectedType === value || (!selectedType && !value);
        return (
            <TouchableOpacity
                key={label}
                onPress={() => setSelectedType(value)}
                style={[styles.filterChip, { backgroundColor: selected ? colors.accent : colors.bgCard, borderColor: selected ? colors.accent : colors.border }]}
                testID={`venues-filter-type-${value ?? 'all'}`}
            >
                <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    if (isLoading && venues.length === 0) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding club venues...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <FlatList
                data={venues}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Club venues</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Find libraries, bookstores, cafes, and community spaces where book clubs can gather.</Text>
                        <View style={[styles.searchShell, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search by venue, city, or address"
                                placeholderTextColor={colors.textTertiary}
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                testID="venues-search-input"
                            />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {VENUE_TYPE_FILTERS.map(renderFilter)}
                        </ScrollView>
                        {isError ? (
                            <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Could not load venues</Text>
                                <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Try refreshing to fetch approved club venues again.</Text>
                            </View>
                        ) : null}
                    </View>
                }
                renderItem={({ item }) => (
                    <VenueCard
                        venue={item}
                        colors={colors}
                        onPress={(venue) => router.push(`/(tabs)/clubs/venues/${venue.id}`)}
                    />
                )}
                ListEmptyComponent={
                    isError ? null : (
                        <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>No venues matched this search</Text>
                            <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Try another venue type, city, or search term.</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '600' },
    content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },
    header: { marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
    searchShell: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
    searchInput: { flex: 1, fontSize: 15 },
    filterRow: { gap: 10, paddingBottom: 10 },
    filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    filterText: { fontSize: 13, fontWeight: '700' },
    feedbackCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    feedbackTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    feedbackBody: { fontSize: 14, lineHeight: 20 },
});
```

- [x] **Step 6: Run browse tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx
```

Expected: pass.

- [x] **Step 7: Add Clubs browse entry test**

Modify `app/(tabs)/clubs/__tests__/index.test.tsx` with:

```typescript
it('opens venue discovery from the clubs browse screen', () => {
    const { getByTestId } = render(<ClubsBrowseScreen />);

    fireEvent.press(getByTestId('clubs-venues-discovery-link'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/venues');
});
```

- [x] **Step 8: Run Clubs browse test and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand app/(tabs)/clubs/__tests__/index.test.tsx
```

Expected: fail because `clubs-venues-discovery-link` does not exist.

- [x] **Step 9: Add Clubs browse entry UI**

Modify `app/(tabs)/clubs/index.tsx` after the author spotlight block:

```typescript
<TouchableOpacity
    activeOpacity={0.85}
    onPress={() => router.push('/(tabs)/clubs/venues')}
    style={[styles.venueDiscoveryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
    testID="clubs-venues-discovery-link"
>
    <View style={styles.venueDiscoveryIcon}>
        <Ionicons name="location-outline" size={18} color={colors.accent} />
    </View>
    <View style={styles.venueDiscoveryBody}>
        <Text style={[styles.venueDiscoveryTitle, { color: colors.textPrimary }]}>Find club venues</Text>
        <Text style={[styles.venueDiscoveryText, { color: colors.textSecondary }]}>Explore libraries, bookstores, cafes, and community spaces where clubs can meet.</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
</TouchableOpacity>
```

Add styles:

```typescript
venueDiscoveryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
},
venueDiscoveryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
},
venueDiscoveryBody: { flex: 1, gap: 3 },
venueDiscoveryTitle: { fontSize: 15, fontWeight: '800' },
venueDiscoveryText: { fontSize: 13, lineHeight: 18 },
```

- [x] **Step 10: Run Clubs browse test and verify GREEN**

Run:

```powershell
npm.cmd test -- --runInBand app/(tabs)/clubs/__tests__/index.test.tsx
```

Expected: pass.

- [x] **Step 11: Commit Task 2**

Run:

```powershell
git add src/features/venues/hooks src/features/venues/components src/features/venues/screens app/(tabs)/clubs/index.tsx app/(tabs)/clubs/__tests__/index.test.tsx
git commit -m "feat: add clubs venue discovery"
```

---

## Task 3: Venue Routes and Detail Screen

**Files:**

- Create: `app/(tabs)/clubs/venues.tsx`
- Create: `app/(tabs)/clubs/venues/[venueId].tsx`
- Modify: `app/(tabs)/clubs/_layout.tsx`
- Create: `src/features/venues/screens/VenueDetailScreen.tsx`
- Test: `src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx`

- [x] **Step 1: Write failing detail screen tests**

Create `src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx`:

```typescript
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { render } from '@testing-library/react-native';
import VenueDetailScreen from '../VenueDetailScreen';

const mockUseLocalSearchParams = jest.fn();
const mockUseVenueDetail = jest.fn();

jest.mock('expo-router', () => ({
    useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
    router: { back: jest.fn(), replace: jest.fn() },
}));

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#EEF2FF',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            error: '#EF4444',
        },
    }),
}));

jest.mock('@/features/venues/hooks/useVenues', () => ({
    useVenueDetail: (...args: unknown[]) => mockUseVenueDetail(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ venueId: 'venue-1' });
    mockUseVenueDetail.mockReturnValue({
        data: {
            id: 'venue-1',
            name: 'Central Library',
            venue_type: 'library',
            description: 'Quiet reading rooms and weekend events.',
            address_line1: '12 Main St',
            address_line2: null,
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            amenities: ['Wi-Fi', 'Reading room'],
            max_capacity: 40,
            booking_required: true,
            verification_status: 'approved',
        },
        isLoading: false,
        isError: false,
        error: null,
    });
});

describe('VenueDetailScreen', () => {
    it('renders venue identity, address, amenities, and capacity', () => {
        const { getByText } = render(<VenueDetailScreen />);

        expect(getByText('Central Library')).toBeOnTheScreen();
        expect(getByText('Quiet reading rooms and weekend events.')).toBeOnTheScreen();
        expect(getByText('12 Main St, Bengaluru, Karnataka 560001')).toBeOnTheScreen();
        expect(getByText('Wi-Fi')).toBeOnTheScreen();
        expect(getByText('Reading room')).toBeOnTheScreen();
        expect(getByText('Up to 40 people')).toBeOnTheScreen();
        expect(getByText('Booking required')).toBeOnTheScreen();
    });

    it('shows an error state when venue detail fails', () => {
        mockUseVenueDetail.mockReturnValue({ data: null, isLoading: false, isError: true, error: new Error('nope') });

        const { getByText } = render(<VenueDetailScreen />);

        expect(getByText('Unable to load venue')).toBeOnTheScreen();
        expect(getByText('Try returning to club venues and opening this place again.')).toBeOnTheScreen();
    });
});
```

- [x] **Step 2: Run detail tests and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx
```

Expected: fail because `VenueDetailScreen` does not exist.

- [x] **Step 3: Add venue detail screen**

Create `src/features/venues/screens/VenueDetailScreen.tsx`:

```typescript
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useTheme } from '@/hooks/useTheme';
import { useVenueDetail } from '../hooks/useVenues';
import { VenueTypeBadge } from '../components/VenueTypeBadge';

function formatAddress(venue: {
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
}) {
    return [
        venue.address_line1,
        venue.address_line2,
        venue.city,
        [venue.state, venue.pincode].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ');
}

export default function VenueDetailScreen() {
    const { venueId } = useLocalSearchParams<{ venueId: string }>();
    const { colors } = useTheme();
    const { data: venue, isLoading, isError } = useVenueDetail(venueId ?? null);

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (isError || !venue) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load venue</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>Try returning to club venues and opening this place again.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/clubs/venues')} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Venue</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <VenueTypeBadge type={venue.venue_type} colors={colors} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{venue.name}</Text>
                {venue.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{venue.description}</Text> : null}
                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formatAddress(venue)}</Text>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Venue details</Text>
                {venue.max_capacity ? <Text style={[styles.detailLine, { color: colors.textSecondary }]}>Up to {venue.max_capacity} people</Text> : null}
                <Text style={[styles.detailLine, { color: colors.textSecondary }]}>{venue.booking_required ? 'Booking required' : 'Drop-in friendly'}</Text>
                {venue.amenities?.length ? (
                    <View style={styles.amenityRow}>
                        {venue.amenities.map((amenity) => (
                            <View key={amenity} style={[styles.amenityPill, { backgroundColor: colors.bgSecondary }]}>
                                <Text style={[styles.amenityText, { color: colors.textPrimary }]}>{amenity}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Clubs and events</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>Club and event relationships will appear here after public venue relationship queries are verified.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    headerSpacer: { width: 40 },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    title: { fontSize: 28, fontWeight: '800', marginTop: 14, marginBottom: 8 },
    description: { fontSize: 14, lineHeight: 21 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
    infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
    detailLine: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
    amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    amenityPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    amenityText: { fontSize: 12, fontWeight: '700' },
    errorTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    errorBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
```

- [x] **Step 4: Add route files and stack registration**

Create `app/(tabs)/clubs/venues.tsx`:

```typescript
import VenuesBrowseScreen from '@/features/venues/screens/VenuesBrowseScreen';

export default function ClubsVenuesRoute() {
    return <VenuesBrowseScreen />;
}
```

Create `app/(tabs)/clubs/venues/[venueId].tsx`:

```typescript
import VenueDetailScreen from '@/features/venues/screens/VenueDetailScreen';

export default function ClubsVenueDetailRoute() {
    return <VenueDetailScreen />;
}
```

Modify `app/(tabs)/clubs/_layout.tsx` to include:

```typescript
<Stack.Screen name="venues" />
<Stack.Screen name="venues/[venueId]" />
```

- [x] **Step 5: Run detail tests and route type check**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx
npx.cmd tsc --noEmit
```

Expected: both pass.

- [x] **Step 6: Commit Task 3**

Run:

```powershell
git add app/(tabs)/clubs/venues.tsx app/(tabs)/clubs/venues src/features/venues/screens app/(tabs)/clubs/_layout.tsx
git commit -m "feat: add venue detail routes"
```

---

## Task 4: Club Venue Link Service, Hooks, and Manage UI

**Files:**

- Modify: `src/features/clubs/services/clubsEventsService.ts`
- Modify: `src/features/clubs/services/clubsService.ts`
- Modify: `src/features/clubs/hooks/useClubs.ts`
- Create: `src/features/clubs/screens/manage/ClubManageVenuesSection.tsx`
- Modify: `src/features/clubs/screens/manage/index.ts`
- Modify: `src/features/clubs/screens/ClubManageScreen.tsx`
- Test: `src/features/clubs/services/__tests__/clubsService.test.ts`
- Test: `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

- [x] **Step 1: Add failing service tests for club venue mutations**

Add to `src/features/clubs/services/__tests__/clubsService.test.ts`:

```typescript
it('links an approved venue to a club', async () => {
    const insertBuilder = mockQuery({ data: { club_id: 'club-1', venue_id: 'venue-1', is_primary: false }, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(insertBuilder);

    const result = await clubsService.addClubVenueLink('club-1', 'venue-1');

    expect(supabase.from).toHaveBeenCalledWith('club_venues');
    expect(insertBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-1', venue_id: 'venue-1', is_primary: false });
    expect(result.venue_id).toBe('venue-1');
});

it('removes a venue link from a club', async () => {
    const deleteBuilder = mockQuery({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(deleteBuilder);

    await clubsService.removeClubVenueLink('club-1', 'venue-1');

    expect(supabase.from).toHaveBeenCalledWith('club_venues');
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
    expect(deleteBuilder.eq).toHaveBeenCalledWith('venue_id', 'venue-1');
});

it('marks one linked venue as primary for a club', async () => {
    const clearBuilder = mockQuery({ data: null, error: null });
    const primaryBuilder = mockQuery({ data: { club_id: 'club-1', venue_id: 'venue-1', is_primary: true }, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(clearBuilder).mockReturnValueOnce(primaryBuilder);

    const result = await clubsService.setPrimaryClubVenue('club-1', 'venue-1');

    expect(clearBuilder.update).toHaveBeenCalledWith({ is_primary: false });
    expect(clearBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
    expect(primaryBuilder.update).toHaveBeenCalledWith({ is_primary: true });
    expect(primaryBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
    expect(primaryBuilder.eq).toHaveBeenCalledWith('venue_id', 'venue-1');
    expect(result.is_primary).toBe(true);
});
```

- [x] **Step 2: Run service tests and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/services/__tests__/clubsService.test.ts
```

Expected: fail because mutation methods do not exist.

- [x] **Step 3: Add club venue mutation methods**

In `src/features/clubs/services/clubsEventsService.ts`, add:

```typescript
export async function addClubVenueLink(clubId: string, venueId: string): Promise<ClubVenueLink> {
    const { data, error } = await supabase
        .from('club_venues')
        .insert({ club_id: clubId, venue_id: venueId, is_primary: false })
        .select(CLUB_VENUE_SELECT)
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to link this venue right now.'));
    const row = data as unknown as ClubVenueLinkRow;
    return { ...row, venue: normalizeRelatedOne(row.venue) };
}

export async function removeClubVenueLink(clubId: string, venueId: string): Promise<void> {
    const { error } = await supabase
        .from('club_venues')
        .delete()
        .eq('club_id', clubId)
        .eq('venue_id', venueId);

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to unlink this venue right now.'));
}

export async function setPrimaryClubVenue(clubId: string, venueId: string): Promise<ClubVenueLink> {
    const { error: clearError } = await supabase
        .from('club_venues')
        .update({ is_primary: false })
        .eq('club_id', clubId);

    if (clearError) throw new Error(getClubsEntitlementErrorMessage(clearError, 'Unable to update the primary venue right now.'));

    const { data, error } = await supabase
        .from('club_venues')
        .update({ is_primary: true })
        .eq('club_id', clubId)
        .eq('venue_id', venueId)
        .select(CLUB_VENUE_SELECT)
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to update the primary venue right now.'));
    const row = data as unknown as ClubVenueLinkRow;
    return { ...row, venue: normalizeRelatedOne(row.venue) };
}
```

Export these through `src/features/clubs/services/clubsService.ts` following the existing aggregate pattern.

- [x] **Step 4: Add hooks and invalidation**

In `src/features/clubs/hooks/useClubs.ts`, import the new input types only if needed and add:

```typescript
export function useAddClubVenueLink() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ clubId, venueId }: { clubId: string; venueId: string }) => clubsService.addClubVenueLink(clubId, venueId),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: clubKeys.eventVenues(vars.clubId) });
        },
    });
}

export function useRemoveClubVenueLink() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ clubId, venueId }: { clubId: string; venueId: string }) => clubsService.removeClubVenueLink(clubId, venueId),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: clubKeys.eventVenues(vars.clubId) });
        },
    });
}

export function useSetPrimaryClubVenue() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ clubId, venueId }: { clubId: string; venueId: string }) => clubsService.setPrimaryClubVenue(clubId, venueId),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: clubKeys.eventVenues(vars.clubId) });
        },
    });
}
```

- [x] **Step 5: Run service tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/services/__tests__/clubsService.test.ts
```

Expected: pass.

- [x] **Step 6: Add failing Manage Club venue tab test**

Add to `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx` using existing mocks in that file:

```typescript
it('shows a venue management tab for admins and can open venue linking', async () => {
    mockUseClubEventVenues.mockReturnValue({
        data: [{ club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { id: 'venue-1', name: 'Central Library', address_line1: '12 Main St', city: 'Bengaluru', verification_status: 'approved' } }],
        isLoading: false,
    });

    const { getByText, getByTestId } = render(<ClubManageScreen />);

    fireEvent.press(getByText('Venues'));

    await waitFor(() => expect(getByText('Central Library')).toBeOnTheScreen());
    expect(getByText('Primary')).toBeOnTheScreen();

    fireEvent.press(getByTestId('manage-venues-add'));

    expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/venues?returnTo=manage-venues');
});
```

- [x] **Step 7: Run Manage test and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx
```

Expected: fail because the Venues tab/section is not implemented.

- [x] **Step 8: Add Manage venues section**

Create `src/features/clubs/screens/manage/ClubManageVenuesSection.tsx`:

```typescript
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ClubVenueLink } from '@/features/clubs/services/clubsService';

export function ClubManageVenuesSection({
    venues,
    isLoading,
    isSaving,
    colors,
    onAddVenue,
    onRemoveVenue,
    onSetPrimaryVenue,
}: {
    venues: ClubVenueLink[];
    isLoading: boolean;
    isSaving: boolean;
    colors: any;
    onAddVenue: () => void;
    onRemoveVenue: (venueId: string) => void;
    onSetPrimaryVenue: (venueId: string) => void;
}) {
    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Linked venues</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>Choose approved venues this club can use for in-person or hybrid events.</Text>
                </View>
                <TouchableOpacity onPress={onAddVenue} style={[styles.addButton, { borderColor: colors.accent }]} testID="manage-venues-add">
                    <Text style={[styles.addButtonText, { color: colors.accent }]}>Add</Text>
                </TouchableOpacity>
            </View>
            {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
            {!isLoading && venues.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No venues are linked yet. Events can still use manual meetup locations.</Text>
            ) : null}
            {venues.map((venueLink) => {
                const venue = venueLink.venue;
                const venueId = venueLink.venue_id ?? venue?.id;
                if (!venue || !venueId) return null;
                return (
                    <View key={venueId} style={[styles.venueRow, { borderColor: colors.border }]}>
                        <View style={styles.venueBody}>
                            <Text style={[styles.venueName, { color: colors.textPrimary }]}>{venue.name}</Text>
                            <Text style={[styles.venueMeta, { color: colors.textSecondary }]}>{[venue.address_line1, venue.city].filter(Boolean).join(', ')}</Text>
                            {venueLink.is_primary ? <Text style={[styles.primaryText, { color: colors.accent }]}>Primary</Text> : null}
                        </View>
                        {!venueLink.is_primary ? (
                            <TouchableOpacity disabled={isSaving} onPress={() => onSetPrimaryVenue(venueId)} style={styles.textButton}>
                                <Text style={[styles.textButtonLabel, { color: colors.accent }]}>Primary</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity disabled={isSaving} onPress={() => onRemoveVenue(venueId)} style={styles.textButton}>
                            <Text style={[styles.textButtonLabel, { color: colors.error }]}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    headerText: { flex: 1 },
    title: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 20 },
    addButton: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
    addButtonText: { fontSize: 13, fontWeight: '800' },
    emptyText: { fontSize: 14, lineHeight: 20 },
    venueRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    venueBody: { flex: 1 },
    venueName: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
    venueMeta: { fontSize: 13, lineHeight: 18 },
    primaryText: { fontSize: 12, fontWeight: '800', marginTop: 4 },
    textButton: { paddingHorizontal: 4, paddingVertical: 6 },
    textButtonLabel: { fontSize: 12, fontWeight: '800' },
});
```

Export it from `src/features/clubs/screens/manage/index.ts`.

- [x] **Step 9: Wire Manage Club screen**

Modify `src/features/clubs/screens/ClubManageScreen.tsx`:

- Import `useClubEventVenues`, `useAddClubVenueLink`, `useRemoveClubVenueLink`, `useSetPrimaryClubVenue`.
- Import `ClubManageVenuesSection`.
- Add tab definition:

```typescript
{ key: 'venues', label: 'Venues', adminOnly: true },
```

- Add data/mutations:

```typescript
const { data: linkedVenues = [], isLoading: isLinkedVenuesLoading, refetch: refetchLinkedVenues } = useClubEventVenues(clubId ?? null, isAdmin);
const addClubVenueLink = useAddClubVenueLink();
const removeClubVenueLink = useRemoveClubVenueLink();
const setPrimaryClubVenue = useSetPrimaryClubVenue();
```

- Add handlers:

```typescript
const handleAddVenue = () => {
    router.push(`/clubs/${clubId}/venues?returnTo=manage-venues`);
};

const handleRemoveVenue = async (venueId: string) => {
    if (!clubId) throw new Error('Missing clubId');
    await removeClubVenueLink.mutateAsync({ clubId, venueId });
    await refetchLinkedVenues();
};

const handleSetPrimaryVenue = async (venueId: string) => {
    if (!clubId) throw new Error('Missing clubId');
    await setPrimaryClubVenue.mutateAsync({ clubId, venueId });
    await refetchLinkedVenues();
};
```

- Add render branch:

```typescript
{activeTab === 'venues' && (
    <ClubManageVenuesSection
        venues={linkedVenues}
        isLoading={isLinkedVenuesLoading}
        isSaving={addClubVenueLink.isPending || removeClubVenueLink.isPending || setPrimaryClubVenue.isPending}
        colors={colors}
        onAddVenue={handleAddVenue}
        onRemoveVenue={handleRemoveVenue}
        onSetPrimaryVenue={handleSetPrimaryVenue}
    />
)}
```

- [x] **Step 10: Run Manage test and verify GREEN**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx
```

Expected: pass.

- [x] **Step 11: Commit Task 4**

Run:

```powershell
git add src/features/clubs/services src/features/clubs/hooks src/features/clubs/screens src/features/clubs/screens/manage
git commit -m "feat: add club venue management"
```

---

## Task 5: Reusable Venue Picker for Club Event and Manage Flows

**Files:**

- Create: `src/features/venues/screens/VenuePickerScreen.tsx`
- Modify: `app/(tabs)/clubs/[clubId]/venues.tsx`
- Modify: `src/features/clubs/screens/ClubVenuePickerScreen.tsx` or replace its route usage
- Test: `src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx`
- Test: `src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx`

- [x] **Step 1: Update failing picker tests for manage venue linking**

In `src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx`, add a test that expects manage venue linking:

```typescript
it('links a selected venue when opened from Manage Club venues', async () => {
    mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'manage-venues' });
    mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
    mockUseApprovedVenues.mockReturnValue({
        data: [{ id: 'venue-9', name: 'New Library', venue_type: 'library', city: 'Bengaluru', address_line1: '9 MG Road', verification_status: 'approved' }],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    });
    mockUseAddClubVenueLink.mockReturnValue({ mutateAsync: mockAddClubVenueLink, isPending: false });

    const { getByTestId } = render(<ClubVenuePickerScreen />);

    await waitFor(() => expect(getByTestId('venue-card-venue-9')).toBeOnTheScreen());

    fireEvent.press(getByTestId('venue-card-venue-9'));

    await waitFor(() => expect(mockAddClubVenueLink).toHaveBeenCalledWith({ clubId: 'club-1', venueId: 'venue-9' }));
    expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/manage?tab=venues');
});
```

Add the corresponding mocks at the top of that test file:

```typescript
const mockUseApprovedVenues = jest.fn();
const mockUseAddClubVenueLink = jest.fn();
const mockAddClubVenueLink = jest.fn();

jest.mock('@/features/venues/hooks/useVenues', () => ({
    useApprovedVenues: (...args: unknown[]) => mockUseApprovedVenues(...args),
}));
```

Include `useAddClubVenueLink` in the existing `@/features/clubs/hooks/useClubs` mock.

- [x] **Step 2: Run picker tests and verify RED**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx
```

Expected: fail because the picker cannot browse approved venues or link from Manage.

- [x] **Step 3: Implement picker behavior**

Modify `src/features/clubs/screens/ClubVenuePickerScreen.tsx` so it supports two modes:

- `returnTo=event-editor` or `returnTo=events`
  - Keep current linked-venues-only behavior.
- `returnTo=manage-venues`
  - Load approved venues using `useApprovedVenues`.
  - Select venue via `useAddClubVenueLink`.
  - Return to `/clubs/${clubId}/manage?tab=venues`.

Add imports:

```typescript
import { useApprovedVenues } from '@/features/venues/hooks/useVenues';
import { VenueCard } from '@/features/venues/components/VenueCard';
import { useAddClubVenueLink, useClubEventVenues, useClubPublicDetail } from '@/features/clubs/hooks/useClubs';
```

Add mode and data:

```typescript
const isManageVenueLinking = returnTo === 'manage-venues';
const { data: approvedVenues = [], isLoading: isApprovedVenuesLoading, isError: isApprovedVenuesError } = useApprovedVenues({ limit: 50, offset: 0 });
const addClubVenueLink = useAddClubVenueLink();
```

In `handleSelectVenue`, branch first:

```typescript
if (returnTo === 'manage-venues') {
    await addClubVenueLink.mutateAsync({ clubId, venueId });
    router.replace(`/clubs/${clubId}/manage?tab=venues`);
    return;
}
```

Render `approvedVenues` with `VenueCard` in manage mode and preserve the linked venue cards for event mode.

- [x] **Step 4: Run picker tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx
```

Expected: pass.

- [x] **Step 5: Run event editor tests**

Run:

```powershell
npm.cmd test -- --runInBand src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx
```

Expected: pass, confirming manual fallback and event-editor venue return flow still work.

- [x] **Step 6: Commit Task 5**

Run:

```powershell
git add app/(tabs)/clubs/[clubId]/venues.tsx src/features/clubs/screens/ClubVenuePickerScreen.tsx src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx
git commit -m "feat: reuse venue picker for club flows"
```

---

## Task 6: Final Verification and Spec Tracker Update

**Files:**

- Modify: `docs/features/VENUES_FRONTEND_FEATURE_SPEC.md`

- [x] **Step 1: Update tracker statuses**

In `docs/features/VENUES_FRONTEND_FEATURE_SPEC.md`, update Phase 1 tracker rows that were completed:

```markdown
| Venue module scaffold | Phase 1 | Implemented | `src/features/venues/` now contains service, hooks, screens, components, and tests. |
| Approved venue browse | Phase 1 | Implemented | Clubs venue browse can search/filter approved venues. |
| Venue detail | Phase 1 | Implemented | Shows approved venue facts; public related clubs/events remain policy-gated. |
| Clubs route entry | Phase 1 | Implemented | Clubs stack includes venue browse/detail routes. |
| Clubs browse entry point | Phase 1 | Implemented | Clubs browse links into venue discovery. |
| Club venue linking UI | Phase 1 | Implemented | Manage Club includes venue link/unlink/primary controls. |
| Club venue link mutations | Phase 1 | Implemented | Clubs hooks/services support link, unlink, and primary updates. |
| Event editor venue picker reuse | Phase 1 | Implemented | Event editor still supports linked venue selection and manual fallback. |
```

Keep relationship-query rows as `Needs Verification` unless a public-safe query was implemented.

- [x] **Step 2: Run focused Jest suites**

Run:

```powershell
npm.cmd test -- --runInBand src/features/venues/services/__tests__/venuesService.test.ts src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx app/(tabs)/clubs/__tests__/index.test.tsx
```

Expected: all listed suites pass.

- [x] **Step 3: Run TypeScript**

Run:

```powershell
npx.cmd tsc --noEmit
```

Expected: pass.

- [x] **Step 4: Commit docs tracker update**

Run:

```powershell
git add docs/features/VENUES_FRONTEND_FEATURE_SPEC.md
git commit -m "docs: update venue feature tracker"
```

- [x] **Step 5: Final status check**

Run:

```powershell
git status --short
```

Expected: only unrelated pre-existing untracked files remain, such as `.codex/` and screenshot PNGs.
