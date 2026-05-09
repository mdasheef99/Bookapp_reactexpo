import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import * as Haptics from 'expo-haptics';
import { searchGoogleBooksCached, type GoogleBook } from '@/features/books/services/booksService';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { getBookCoverUrl, isTooManyRequestsError, type FeedbackState } from './manageUtils';

interface Props {
    clubId: string;
    onOverride: (book: GoogleBook) => Promise<void>;
    onClose: () => void;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageBookOverrideSection({ clubId, onOverride, onClose, onFeedback }: Props) {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 400);
    const [results, setResults] = useState<GoogleBook[]>([]);
    const [searched, setSearched] = useState(false);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState<GoogleBook | null>(null);
    const [fromCache, setFromCache] = useState(false);
    const [overrideFeedback, setOverrideFeedback] = useState<FeedbackState>(null);

    // Auto-search after 400ms of typing inactivity to reduce Google Books 429 rate-limit errors.
    // `searching` is intentionally excluded from deps to avoid re-triggering when the flag flips.
    useEffect(() => {
        const trimmed = debouncedQuery.trim();
        if (trimmed.length >= 3 && !searching) {
            handleSearch(trimmed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery]);

    const handleSearch = async (searchQuery?: string) => {
        const trimmed = (searchQuery ?? query).trim();
        if (trimmed.length < 3) {
            setOverrideFeedback({ type: 'error', message: 'Enter at least 3 characters to search Google Books.' });
            return;
        }
        try {
            setOverrideFeedback(null);
            setSearching(true);
            setSearched(true);
            const response = await searchGoogleBooksCached(trimmed, 0, 10);
            setResults(response.items);
            setFromCache(response.fromCache);
        } catch (error) {
            setFromCache(false);
            if (isTooManyRequestsError(error)) {
                setOverrideFeedback({ type: 'error', message: 'Google Books search is temporarily rate-limited. Please try again in a moment.' });
            } else {
                setOverrideFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to search books right now.') });
            }
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const confirmOverride = (book: GoogleBook) => {
        Alert.alert(
            'Set current book',
            `Set "${book.volumeInfo.title || 'Untitled'}" as the current club read? This bypasses nominations and voting.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Set current book',
                    style: 'default',
                    onPress: async () => {
                        try {
                            setOverrideFeedback(null);
                            await onOverride(book);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setOverrideFeedback({ type: 'success', message: `"${book.volumeInfo.title || 'Untitled'}" is now the current club read.` });
                            setSelected(null);
                            setQuery('');
                            setResults([]);
                            setSearched(false);
                        } catch (error) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            setOverrideFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to set the current book right now.') });
                        }
                    },
                },
            ],
        );
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manual override</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Search Google Books and set a book directly.</Text>

            <TextInput
                testID="manage-override-search"
                value={query}
                onChangeText={setQuery}
                placeholder="Search for a book..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
            />
            <TouchableOpacity
                onPress={handleSearch}
                disabled={searching || !query.trim()}
                style={[styles.searchButton, { backgroundColor: colors.accent, opacity: searching || !query.trim() ? 0.5 : 1 }]}>
                <Text style={styles.searchButtonText}>{searching ? 'Searching…' : 'Search'}</Text>
            </TouchableOpacity>

            {overrideFeedback && (
                <View style={[styles.feedbackBanner, { backgroundColor: overrideFeedback.type === 'error' ? colors.errorLight : colors.accentLight, borderColor: overrideFeedback.type === 'error' ? colors.error : colors.accent }]}>
                    <Text style={{ color: overrideFeedback.type === 'error' ? colors.error : colors.accent }}>{overrideFeedback.message}</Text>
                </View>
            )}
            {fromCache && results.length > 0 && (
                <View style={[styles.cacheBanner, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}>
                    <Text style={{ color: colors.accent }}>Showing cached results</Text>
                </View>
            )}

            {searched && results.length === 0 && !searching && (
                <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No books found.</Text>
            )}

            <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
                {results.map((book) => {
                    const isSelected = selected?.id === book.id;
                    const coverUrl = getBookCoverUrl(book);
                    return (
                        <TouchableOpacity
                            key={book.id}
                            testID={`manage-override-result-${book.id}`}
                            onPress={() => setSelected(isSelected ? null : book)}
                            style={[styles.resultRow, { borderBottomColor: colors.border, backgroundColor: isSelected ? colors.bgSecondary : undefined }]}>
                            <Image source={{ uri: coverUrl }} style={styles.bookCover} resizeMode="cover" />
                            <View style={styles.resultInfo}>
                                <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{book.volumeInfo.title}</Text>
                                <Text style={[styles.resultAuthor, { color: colors.textSecondary }]}>{book.volumeInfo.authors?.join(', ') || 'Unknown author'}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {selected && (
                <TouchableOpacity
                    testID="manage-override-set"
                    onPress={() => confirmOverride(selected)}
                    style={[styles.overrideButton, { backgroundColor: colors.accent }]}>
                    <Text style={styles.overrideButtonText}>Set as current book</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeText, { color: colors.textSecondary }]}>Cancel override</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    sectionDesc: {
        fontSize: 13,
        marginBottom: 10,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        marginBottom: 8,
    },
    searchButton: {
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    feedbackBanner: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10,
    },
    placeholder: {
        fontSize: 14,
        fontStyle: 'italic',
        paddingVertical: 6,
    },
    resultsScroll: {
        maxHeight: 240,
        marginBottom: 10,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    bookCover: {
        width: 48,
        height: 72,
        borderRadius: 4,
        marginRight: 10,
    },
    resultInfo: {
        flex: 1,
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    resultAuthor: {
        fontSize: 12,
        marginTop: 2,
    },
    overrideButton: {
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    overrideButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    closeButton: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    closeText: {
        fontSize: 13,
    },
    cacheBanner: {
        borderRadius: 8,
        borderWidth: 1,
        padding: 10,
        marginTop: 10,
        alignItems: 'center',
    },
});
