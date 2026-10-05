import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import * as Haptics from 'expo-haptics';
import { SearchBar } from '@/components/search/SearchBar';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { booksService, type GoogleBook } from '@/features/books/services/booksService';
import { useClubMembership, useClubPublicDetail, useNominateClubBook } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { clubManageColors as colors } from './manage/managePalette';

function getBookCoverUrl(book: GoogleBook | null): string {
    const imageUrl = book?.volumeInfo.imageLinks?.thumbnail ?? book?.volumeInfo.imageLinks?.smallThumbnail;
    if (!imageUrl) return 'https://via.placeholder.com/120x180?text=No+Cover';
    return imageUrl.replace(/^http:\/\//i, 'https://').replace('zoom=1', 'zoom=0');
}

function getDefaultVotingEndsAt(days: number = 7): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}

const VOTING_DEADLINE_PRESETS = [
    { days: 3, label: '3 days' },
    { days: 7, label: '7 days' },
    { days: 14, label: '14 days' },
];

const SHORT_QUERY_MESSAGE = 'Enter at least 3 characters to search Google Books.';

function isTooManyRequestsError(error: unknown): boolean {
    if (error && typeof error === 'object') {
        const e = error as Record<string, unknown>;
        const response = e.response;
        const responseStatus = response && typeof response === 'object' ? (response as { status?: unknown }).status : undefined;
        if (e.status === 429 || responseStatus === 429) return true;
        const message = String(e.message ?? e.error ?? error);
        if (message.includes('429') || message.toLowerCase().includes('too many requests')) return true;
    }
    return false;
}

export default function ClubNominateBookScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const nominateMutation = useNominateClubBook();
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 400);
    const [results, setResults] = useState<GoogleBook[]>([]);
    const [searched, setSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedBook, setSelectedBook] = useState<GoogleBook | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [fromCache, setFromCache] = useState(false);
    const [votingDays, setVotingDays] = useState(7);
    const [manualTitle, setManualTitle] = useState('');
    const [manualAuthor, setManualAuthor] = useState('');
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const canNominate = membership?.status === 'active';

    // Auto-search after 400ms of typing inactivity to reduce Google Books 429 rate-limit errors.
    // `isSearching` is intentionally excluded from deps to avoid re-triggering when the flag flips.
    useEffect(() => {
        const trimmed = debouncedQuery.trim();
        if (trimmed.length >= 3 && !isSearching) {
            handleSearch(trimmed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery]);

    useEffect(() => () => {
        if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    }, []);

    const handleSearch = async (searchQuery?: string) => {
        const trimmed = (searchQuery ?? query).trim();
        if (trimmed.length < 3) {
            setFeedback({ type: 'error', message: SHORT_QUERY_MESSAGE });
            return;
        }

        try {
            setFeedback(null);
            setIsSearching(true);
            setSearched(true);
            const response = await booksService.searchGoogleBooksCached(trimmed, 0, 10);
            setResults(response.items);
            setFromCache(response.fromCache);
        } catch (error) {
            setFromCache(false);
            if (isTooManyRequestsError(error)) {
                setFeedback({ type: 'error', message: 'Google Books search is temporarily rate-limited. Please try again in a moment, or enter book details manually below.' });
            } else {
                setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to search books right now.') });
            }
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleNominate = async () => {
        if (!clubId || !selectedBook) {
            setFeedback({ type: 'error', message: 'Choose a book before submitting your nomination.' });
            return;
        }

        try {
            setFeedback(null);
            await nominateMutation.mutateAsync({
                clubId,
                googleBook: selectedBook,
                votingEndsAt: getDefaultVotingEndsAt(votingDays),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setFeedback({ type: 'success', message: `Your nomination was submitted successfully! Voting closes in ${votingDays} days.` });
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace(`/clubs/${clubId}?tab=nominations`);
            }, 1500);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to nominate this book right now.') });
        }
    };

    const handleManualNominate = async () => {
        const title = manualTitle.trim();
        const author = manualAuthor.trim();
        if (!clubId || !title) {
            setFeedback({ type: 'error', message: 'Enter a book title before submitting a manual nomination.' });
            return;
        }

        const manualBook: GoogleBook = {
            id: `manual:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'}:${Date.now()}`,
            volumeInfo: {
                title,
                authors: author ? [author] : undefined,
            },
            saleInfo: { saleability: 'NOT_FOR_SALE' },
        };

        try {
            setFeedback(null);
            await nominateMutation.mutateAsync({
                clubId,
                googleBook: manualBook,
                votingEndsAt: getDefaultVotingEndsAt(votingDays),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setFeedback({ type: 'success', message: `Your nomination was submitted successfully! Voting closes in ${votingDays} days.` });
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace(`/clubs/${clubId}?tab=nominations`);
            }, 1500);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to nominate this book right now.') });
        }
    };

    if (isClubLoading || isMembershipLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.contentColumn}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}?tab=nominations`)}
                        style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                        accessibilityRole="button"
                        accessibilityLabel="Go back to club nominations"
                    >
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headingBlock}>
                        <Text style={[styles.eyebrow, { color: colors.accent }]}>CLUB NOMINATION</Text>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nominate a book</Text>
                    </View>
                </View>
                <Text style={[styles.introText, { color: colors.textSecondary }]}>
                    {club?.name ? `For ${club.name}. ` : ''}Search by title or author, or enter the details manually.
                </Text>

                {!userId ? <View style={[styles.gateCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.gateTitle, { color: colors.textPrimary }]}>Sign in required</Text>
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>You must be signed in before you can nominate a book.</Text>
                </View> : null}
                {userId && !canNominate ? <View style={[styles.gateCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.gateTitle, { color: colors.textPrimary }]}>Active membership required</Text>
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>Only active club members can nominate books for this club.</Text>
                </View> : null}

                {feedback ? <View
                    style={[
                        styles.feedbackBanner,
                        { backgroundColor: feedback.type === 'success' ? '#E7F4E9' : colors.errorLight, borderColor: feedback.type === 'success' ? '#8DBA91' : colors.error },
                    ]}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                >
                    <Ionicons name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={19} color={feedback.type === 'success' ? '#2F6B37' : colors.error} />
                    <Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#2F6B37' : colors.error }]}>{feedback.message}</Text>
                </View> : null}

                {canNominate ? <>
                    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={styles.sectionHeading}>
                            <View style={[styles.sectionIcon, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name="search" size={17} color={colors.accent} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Find a book</Text>
                                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>Search Google Books by title or author.</Text>
                            </View>
                        </View>
                        <SearchBar
                            query={query}
                            onQueryChange={setQuery}
                            onSubmit={handleSearch}
                            onClear={() => { setQuery(''); setResults([]); setSearched(false); setSelectedBook(null); setFeedback(null); }}
                            loading={isSearching}
                            placeholder="Book title or author"
                            autoFocus={false}
                            paletteOverride={colors}
                            compact
                        />
                        <TouchableOpacity
                            onPress={() => handleSearch()}
                            disabled={isSearching}
                            style={[styles.secondarySearchButton, { borderColor: colors.border, backgroundColor: colors.bgPrimary, opacity: isSearching ? 0.65 : 1 }]}
                            testID="club-nomination-search"
                            accessibilityRole="button"
                        >
                            <Ionicons name="search" size={17} color={colors.accent} />
                            <Text style={[styles.secondarySearchText, { color: colors.accent }]}>{isSearching ? 'Searching…' : 'Search Google Books'}</Text>
                        </TouchableOpacity>

                        {fromCache && results.length > 0 && !feedback ? <View style={[styles.cacheBanner, { backgroundColor: colors.accentLight, borderColor: colors.border }]}>
                            <Ionicons name="time-outline" size={15} color={colors.accent} />
                            <Text style={[styles.cacheText, { color: colors.accent }]}>Showing cached results</Text>
                        </View> : null}
                        {searched && !isSearching && results.length === 0 && feedback?.type !== 'error' ? <View style={[styles.emptyCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.bgSecondary }]}><Ionicons name="book-outline" size={20} color={colors.accent} /></View>
                            <View style={styles.sectionHeadingText}>
                                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No matches found</Text>
                                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>Try another title, author, or broader search term.</Text>
                            </View>
                        </View> : null}
                        {results.length > 0 && feedback?.message !== SHORT_QUERY_MESSAGE ? <View style={styles.resultsList}>
                            <Text style={[styles.resultsLabel, { color: colors.textTertiary }]}>{results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'}</Text>
                            {results.map((book) => {
                                const selected = selectedBook?.id === book.id;
                                return <TouchableOpacity
                                    key={book.id}
                                    onPress={() => setSelectedBook(book)}
                                    style={[styles.resultCard, { backgroundColor: selected ? colors.accentLight : colors.bgPrimary, borderColor: selected ? colors.accent : colors.border }]}
                                    testID={`club-nomination-result-${book.id}`}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    aria-pressed={selected}
                                >
                                    <Image source={{ uri: getBookCoverUrl(book) }} style={styles.resultCover} contentFit="cover" transition={200} />
                                    <View style={styles.resultBody}>
                                        <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={2}>{book.volumeInfo.title || 'Untitled book'}</Text>
                                        <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={2}>{book.volumeInfo.authors?.join(', ') || 'Author information unavailable'}</Text>
                                        {book.volumeInfo.publishedDate ? <Text style={[styles.resultMeta, { color: colors.textTertiary }]} numberOfLines={1}>{`Published ${book.volumeInfo.publishedDate}`}</Text> : null}
                                    </View>
                                    <View style={[styles.selectionMark, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.bgCard }]}>
                                        {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                                    </View>
                                </TouchableOpacity>;
                            })}
                        </View> : null}
                    </View>

                    {selectedBook ? <View testID="club-nomination-selected-section" style={[styles.sectionCard, styles.selectedSection, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.sectionHeading}>
                            <View style={[styles.sectionIcon, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name="checkmark" size={17} color={colors.accent} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your selection</Text>
                                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>Choose the voting period, then confirm.</Text>
                            </View>
                        </View>
                        <View style={[styles.selectedCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
                            <Image source={{ uri: getBookCoverUrl(selectedBook) }} style={styles.selectedCover} contentFit="cover" transition={200} />
                            <View style={styles.resultBody}>
                                <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={3}>{selectedBook.volumeInfo.title || 'Untitled book'}</Text>
                                <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={2}>{selectedBook.volumeInfo.authors?.join(', ') || 'Author information unavailable'}</Text>
                            </View>
                        </View>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Voting period</Text>
                        <View style={styles.presetRow} accessibilityRole="radiogroup" accessibilityLabel="Voting period" testID="club-nomination-voting-period">
                            {VOTING_DEADLINE_PRESETS.map((preset) => {
                                const selected = votingDays === preset.days;
                                return <TouchableOpacity
                                    key={preset.days}
                                    onPress={() => setVotingDays(preset.days)}
                                    style={[styles.presetChip, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentLight : colors.bgPrimary }]}
                                    testID={`club-nomination-voting-days-${preset.days}`}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    aria-checked={selected}
                                >
                                    <Text style={[styles.presetText, { color: selected ? colors.accent : colors.textPrimary }]}>{preset.label}</Text>
                                </TouchableOpacity>;
                            })}
                        </View>
                        <TouchableOpacity
                            onPress={handleNominate}
                            disabled={nominateMutation.isPending}
                            style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: nominateMutation.isPending ? 0.65 : 1 }]}
                            testID="club-submit-nomination"
                            accessibilityRole="button"
                        >
                            <Text style={styles.primaryActionText}>{nominateMutation.isPending ? 'Submitting…' : 'Nominate this book'}</Text>
                        </TouchableOpacity>
                    </View> : null}

                    <View style={[styles.sectionCard, styles.manualSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={styles.sectionHeading}>
                            <View style={[styles.sectionIcon, { backgroundColor: colors.bgSecondary }]}>
                                <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Can’t find it?</Text>
                                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>Add the book details manually. Author is optional.</Text>
                            </View>
                        </View>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Title</Text>
                        <TextInput
                            value={manualTitle}
                            onChangeText={setManualTitle}
                            placeholder="Book title"
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}
                            testID="club-nomination-manual-title"
                            accessibilityLabel="Book title"
                            returnKeyType="next"
                        />
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Author <Text style={[styles.optionalLabel, { color: colors.textTertiary }]}>(optional)</Text></Text>
                        <TextInput
                            value={manualAuthor}
                            onChangeText={setManualAuthor}
                            placeholder="Author name"
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}
                            testID="club-nomination-manual-author"
                            accessibilityLabel="Author (optional)"
                            returnKeyType="done"
                        />
                        <TouchableOpacity
                            onPress={handleManualNominate}
                            disabled={nominateMutation.isPending}
                            style={[styles.primaryActionButton, styles.manualActionButton, { backgroundColor: colors.bgCard, borderColor: colors.accent, opacity: nominateMutation.isPending ? 0.65 : 1 }]}
                            testID="club-submit-manual-nomination"
                            accessibilityRole="button"
                        >
                            <Text style={[styles.manualActionText, { color: colors.accent }]}>{nominateMutation.isPending ? 'Submitting…' : 'Nominate manually'}</Text>
                        </TouchableOpacity>
                    </View>
                </> : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40, alignItems: 'center' },
    contentColumn: { width: '100%', maxWidth: 760 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    iconButton: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headingBlock: { flex: 1, gap: 1 },
    eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14, letterSpacing: 1.15 },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 27, lineHeight: 33 },
    introText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 18 },
    gateCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
    gateTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, marginBottom: 3 },
    sectionCard: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 14 },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    sectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    sectionHeadingText: { flex: 1, gap: 2 },
    sectionTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 25 },
    sectionDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
    secondarySearchButton: { minHeight: 46, marginTop: 10, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    secondarySearchText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
    bodyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    emptyCard: { borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    emptyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19 },
    resultsList: { marginTop: 16, gap: 8 },
    resultsLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14, letterSpacing: 0.9, marginBottom: 1 },
    resultCard: { borderWidth: 1, borderRadius: 13, padding: 10, minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 11 },
    resultCover: { width: 50, height: 72, borderRadius: 7, backgroundColor: colors.bgSecondary },
    resultBody: { flex: 1, gap: 3, justifyContent: 'center' },
    resultTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19 },
    resultMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
    selectionMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    selectedSection: { borderColor: colors.accent },
    selectedCard: { borderWidth: 1, borderRadius: 13, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
    selectedCover: { width: 48, height: 70, borderRadius: 7, backgroundColor: colors.bgSecondary },
    label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, marginBottom: 8 },
    optionalLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
    input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 13 },
    presetRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
    presetChip: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
    presetText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17 },
    primaryActionButton: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    primaryActionText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    manualSection: { marginBottom: 8 },
    manualActionButton: { borderWidth: 1.5 },
    manualActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    feedbackBanner: { marginBottom: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    feedbackText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    cacheBanner: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    cacheText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
});
