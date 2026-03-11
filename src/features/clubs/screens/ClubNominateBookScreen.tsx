import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '@/components/search/SearchBar';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { booksService, type GoogleBook } from '@/features/books/services/booksService';
import { useClubMembership, useClubPublicDetail, useNominateClubBook } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';

function getBookCoverUrl(book: GoogleBook | null): string {
    const imageUrl = book?.volumeInfo.imageLinks?.thumbnail ?? book?.volumeInfo.imageLinks?.smallThumbnail;
    if (!imageUrl) return 'https://via.placeholder.com/120x180?text=No+Cover';
    return imageUrl.replace(/^http:\/\//i, 'https://').replace('zoom=1', 'zoom=0');
}

export default function ClubNominateBookScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const nominateMutation = useNominateClubBook();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GoogleBook[]>([]);
    const [searched, setSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedBook, setSelectedBook] = useState<GoogleBook | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    const canNominate = membership?.status === 'active';

    const handleSearch = async () => {
        const trimmed = query.trim();
        if (trimmed.length < 3) {
            setFeedback({ type: 'error', message: 'Enter at least 3 characters to search Google Books.' });
            return;
        }

        try {
            setFeedback(null);
            setIsSearching(true);
            setSearched(true);
            const response = await booksService.searchGoogleBooks(trimmed, 0, 10);
            setResults(response.items);
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to search books right now.') });
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
            await nominateMutation.mutateAsync({ clubId, googleBook: selectedBook });
            router.back();
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to nominate this book right now.') });
        }
    };

    if (isClubLoading || isMembershipLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Nominate a book</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club nomination</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{club?.name ? `Search for a book to nominate for ${club.name}.` : 'Search for a book to nominate for this club.'}</Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>You must be signed in before you can nominate a book.</Text></View> : null}
                {userId && !canNominate ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Active membership required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Only active club members can nominate books for this club.</Text></View> : null}
                {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
            </View>

            {canNominate ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Search Google Books</Text>
                <SearchBar query={query} onQueryChange={setQuery} onSubmit={handleSearch} onClear={() => { setQuery(''); setResults([]); setSearched(false); setSelectedBook(null); setFeedback(null); }} loading={isSearching} colors={colors} placeholder="Search by title or author" autoFocus={false} />
                <TouchableOpacity onPress={handleSearch} disabled={isSearching} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: isSearching ? 0.65 : 1 }]} testID="club-nomination-search"><Text style={styles.primaryActionText}>{isSearching ? 'Searching…' : 'Search Google Books'}</Text></TouchableOpacity>
                {searched && !isSearching && results.length === 0 ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No matches found</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Try another title, author, or broader search term.</Text></View> : null}
                {results.map((book) => { const selected = selectedBook?.id === book.id; return <TouchableOpacity key={book.id} onPress={() => setSelectedBook(book)} style={[styles.resultCard, { backgroundColor: colors.bgPrimary, borderColor: selected ? colors.accent : colors.border }]} testID={`club-nomination-result-${book.id}`}> 
                    <Image source={{ uri: getBookCoverUrl(book) }} style={styles.resultCover} contentFit="cover" transition={200} />
                    <View style={styles.resultBody}>
                        <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={2}>{book.volumeInfo.title || 'Untitled book'}</Text>
                        <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={2}>{book.volumeInfo.authors?.join(', ') || 'Author information unavailable'}</Text>
                        {book.volumeInfo.publishedDate ? <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>{`Published: ${book.volumeInfo.publishedDate}`}</Text> : null}
                        <Text style={[styles.resultMeta, { color: selected ? colors.accent : colors.textTertiary }]}>{selected ? 'Selected for nomination' : 'Tap to select this book'}</Text>
                    </View>
                </TouchableOpacity>; })}
            </View> : null}

            {canNominate && selectedBook ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Selected nomination</Text>
                <View style={[styles.selectedCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
                    <Image source={{ uri: getBookCoverUrl(selectedBook) }} style={styles.selectedCover} contentFit="cover" transition={200} />
                    <View style={styles.resultBody}>
                        <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{selectedBook.volumeInfo.title || 'Untitled book'}</Text>
                        <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>{selectedBook.volumeInfo.authors?.join(', ') || 'Author information unavailable'}</Text>
                        <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Submitting this will create a live club nomination using the existing Clubs nomination workflow.</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleNominate} disabled={nominateMutation.isPending} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: nominateMutation.isPending ? 0.65 : 1 }]} testID="club-submit-nomination"><Text style={styles.primaryActionText}>{nominateMutation.isPending ? 'Submitting…' : 'Nominate this book'}</Text></TouchableOpacity>
            </View> : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' }, headerSpacer: { width: 40 },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, sectionBody: { fontSize: 14, lineHeight: 20 },
    noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 }, noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 }, noticeBody: { fontSize: 14, lineHeight: 20 },
    resultCard: { marginTop: 12, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 12 }, resultCover: { width: 72, height: 108, borderRadius: 12, backgroundColor: '#E2E8F0' }, resultBody: { flex: 1, gap: 4, justifyContent: 'center' }, resultTitle: { fontSize: 15, fontWeight: '700' }, resultMeta: { fontSize: 13, lineHeight: 18 }, selectedCard: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 12 }, selectedCover: { width: 88, height: 132, borderRadius: 12, backgroundColor: '#E2E8F0' },
    primaryActionButton: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});